package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/karti/orange-city-mart/backend/db"
	"github.com/karti/orange-city-mart/backend/hub"
	authmw "github.com/karti/orange-city-mart/backend/middleware"
)

// AuctionHandler wraps the WebSocket hub so handlers can push events.
type AuctionHandler struct {
	Hub *hub.Hub
}

// placeBidRequest is the expected JSON body for POST /api/auctions/{id}/bid
type placeBidRequest struct {
	Amount float64 `json:"amount"`
}

// BidPayload is broadcast to the entire auction room on a successful bid.
type BidPayload struct {
	AuctionID string  `json:"auction_id"`
	Amount    float64 `json:"amount"`
	BidderID  string  `json:"bidder_id"`
	Timestamp string  `json:"timestamp"`
}

// OutbidPayload is sent exclusively to the user who was just outbid.
type OutbidPayload struct {
	AuctionID  string  `json:"auction_id"`
	YourBid    float64 `json:"your_bid"`
	NewHighBid float64 `json:"new_high_bid"`
	NewBidder  string  `json:"new_bidder"`
}

// ─────────────────────────────────────────────────────────────────────────────
// PlaceBid  POST /api/auctions/{id}/bid
//
// Soft-block flow:
//  1. Deduct bid amount from bidder's wallet.
//  2. Insert a bid_holds row with status='SOFT'.
//  3. Release the previous winner's SOFT hold: credit their wallet back,
//     mark their bid_hold RELEASED.
//  4. Update auction current_highest_bid / highest_bidder_id.
//  5. Persist the raw bid row (for history).
//
// ─────────────────────────────────────────────────────────────────────────────
func (h *AuctionHandler) PlaceBid(w http.ResponseWriter, r *http.Request) {
	auctionID := chi.URLParam(r, "id")

	// Caller identity comes from JWT, not request body.
	userID, ok := authmw.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req placeBidRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Amount <= 0 {
		http.Error(w, "positive amount required", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// ── Begin transaction ──────────────────────────────────────────────────
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// ── Lock auction row ───────────────────────────────────────────────────
	var (
		currentHighBid   float64
		prevHighBidderID *string
		status           string
		endTime          time.Time
	)
	err = tx.QueryRow(ctx, `
		SELECT current_highest_bid, highest_bidder_id, status, end_time
		FROM auctions
		WHERE id = $1
		FOR UPDATE`,
		auctionID,
	).Scan(&currentHighBid, &prevHighBidderID, &status, &endTime)
	if err == pgx.ErrNoRows {
		http.Error(w, "auction not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}

	if status != "ACTIVE" || time.Now().After(endTime) {
		http.Error(w, "auction is not active", http.StatusConflict)
		return
	}
	if req.Amount <= currentHighBid {
		http.Error(w, "bid must be greater than current highest bid", http.StatusConflict)
		return
	}

	// ── Lock bidder wallet ─────────────────────────────────────────────────
	var bidderBalance float64
	err = tx.QueryRow(ctx, `
		SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE`, userID,
	).Scan(&bidderBalance)
	if err == pgx.ErrNoRows {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}
	if bidderBalance < req.Amount {
		http.Error(w, "insufficient wallet balance", http.StatusPaymentRequired)
		return
	}

	// ── Release previous highest bidder's soft hold ────────────────────────
	if prevHighBidderID != nil && *prevHighBidderID != userID {
		// Mark the previous holder's SOFT hold as RELEASED
		_, err = tx.Exec(ctx, `
			UPDATE bid_holds
			SET status = 'RELEASED', updated_at = NOW()
			WHERE auction_id = $1 AND user_id = $2 AND status = 'SOFT'`,
			auctionID, *prevHighBidderID,
		)
		if err != nil {
			http.Error(w, "database error", http.StatusInternalServerError)
			return
		}

		// Credit their wallet back
		_, err = tx.Exec(ctx, `
			UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2`,
			currentHighBid, *prevHighBidderID,
		)
		if err != nil {
			http.Error(w, "database error", http.StatusInternalServerError)
			return
		}

		// Record refund transaction
		_, err = tx.Exec(ctx, `
			INSERT INTO transactions (user_id, amount, type, status, reference)
			VALUES ($1, $2, 'REFUND', 'COMPLETED', $3)`,
			*prevHighBidderID, currentHighBid, auctionID,
		)
		if err != nil {
			http.Error(w, "database error", http.StatusInternalServerError)
			return
		}
	}

	// ── Deduct from new bidder's wallet (soft-block) ───────────────────────
	_, err = tx.Exec(ctx, `
		UPDATE users SET wallet_balance = wallet_balance - $1 WHERE id = $2`,
		req.Amount, userID,
	)
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}

	// Record BID_HOLD transaction
	_, err = tx.Exec(ctx, `
		INSERT INTO transactions (user_id, amount, type, status, reference)
		VALUES ($1, $2, 'BID_HOLD', 'COMPLETED', $3)`,
		userID, req.Amount, auctionID,
	)
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}

	// Insert new SOFT bid_hold row for the winner
	_, err = tx.Exec(ctx, `
		INSERT INTO bid_holds (auction_id, user_id, amount, status)
		VALUES ($1, $2, $3, 'SOFT')`,
		auctionID, userID, req.Amount,
	)
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}

	// ── Update auction ─────────────────────────────────────────────────────
	_, err = tx.Exec(ctx, `
		UPDATE auctions
		SET current_highest_bid = $1, highest_bidder_id = $2
		WHERE id = $3`,
		req.Amount, userID, auctionID,
	)
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}

	// ── Record the raw bid (for history) ───────────────────────────────────
	_, err = tx.Exec(ctx, `
		INSERT INTO bids (auction_id, user_id, amount) VALUES ($1, $2, $3)`,
		auctionID, userID, req.Amount,
	)
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}

	// ── Commit ────────────────────────────────────────────────────────────
	if err = tx.Commit(ctx); err != nil {
		http.Error(w, "commit failed", http.StatusInternalServerError)
		return
	}

	// ── Push WebSocket events (after commit) ─────────────────────────────
	bidPayloadBytes, _ := json.Marshal(BidPayload{
		AuctionID: auctionID,
		Amount:    req.Amount,
		BidderID:  userID,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	})
	h.Hub.BroadcastToAuction(auctionID, hub.Message{
		Type:    hub.TypeBroadcastNewBid,
		Payload: json.RawMessage(bidPayloadBytes),
	})

	if prevHighBidderID != nil && *prevHighBidderID != userID {
		outbidBytes, _ := json.Marshal(OutbidPayload{
			AuctionID:  auctionID,
			YourBid:    currentHighBid,
			NewHighBid: req.Amount,
			NewBidder:  userID,
		})
		h.Hub.SendToUser(*prevHighBidderID, hub.Message{
			Type:    hub.TypeOutbidAlert,
			Payload: json.RawMessage(outbidBytes),
		})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":      true,
		"auction_id":   auctionID,
		"new_high_bid": req.Amount,
	})
}

// ─────────────────────────────────────────────────────────────────────────────
// GetAuction  GET /api/auctions/{id}
//
// Also lazily transitions an expired ACTIVE auction to ENDED:
//   - Winner's SOFT hold → HARD
//   - All other SOFT holds for this auction → RELEASED + wallet credited
//   - Creates a settlements row (PENDING)
//
// ─────────────────────────────────────────────────────────────────────────────
func (h *AuctionHandler) GetAuction(w http.ResponseWriter, r *http.Request) {
	auctionID := chi.URLParam(r, "id")
	ctx := r.Context()

	// Attempt lazy end transition (best-effort, separate transaction)
	_ = endAuctionIfExpired(ctx, auctionID)

	row := db.Pool.QueryRow(ctx, `
		SELECT a.id, a.product_id, p.title, p.description, p.image_url,
		       p.seller_id, u.name AS seller_name,
		       a.start_price, a.current_highest_bid, a.highest_bidder_id,
		       a.end_time, a.status,
		       s.winner_approved_at, s.seller_approved_at, s.status
		FROM auctions a
		JOIN products p ON p.id = a.product_id
		JOIN users u ON u.id = p.seller_id
		LEFT JOIN settlements s ON s.auction_id = a.id
		WHERE a.id = $1`,
		auctionID,
	)

	var result struct {
		ID               string  `json:"id"`
		ProductID        string  `json:"product_id"`
		Title            string  `json:"title"`
		Description      string  `json:"description"`
		ImageURL         *string `json:"image_url"`
		SellerID         string  `json:"seller_id"`
		SellerName       string  `json:"seller_name"`
		StartPrice       float64 `json:"start_price"`
		CurrentHighBid   float64 `json:"current_highest_bid"`
		HighestBidderID  *string `json:"highest_bidder_id"`
		EndTime          string  `json:"end_time"`
		Status           string  `json:"status"`
		WinnerApprovedAt *string `json:"winner_approved_at"`
		SellerApprovedAt *string `json:"seller_approved_at"`
		SettlementStatus *string `json:"settlement_status"`
	}

	var endTime time.Time
	var winnerApprovedAt, sellerApprovedAt *time.Time
	var settlementStatus *string

	err := row.Scan(
		&result.ID, &result.ProductID, &result.Title, &result.Description,
		&result.ImageURL, &result.SellerID, &result.SellerName,
		&result.StartPrice, &result.CurrentHighBid,
		&result.HighestBidderID, &endTime, &result.Status,
		&winnerApprovedAt, &sellerApprovedAt, &settlementStatus,
	)
	if err == pgx.ErrNoRows {
		http.Error(w, "auction not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}
	result.EndTime = endTime.UTC().Format(time.RFC3339)
	if winnerApprovedAt != nil {
		s := winnerApprovedAt.UTC().Format(time.RFC3339)
		result.WinnerApprovedAt = &s
	}
	if sellerApprovedAt != nil {
		s := sellerApprovedAt.UTC().Format(time.RFC3339)
		result.SellerApprovedAt = &s
	}
	result.SettlementStatus = settlementStatus

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// endAuctionIfExpired is called lazily when an auction page is fetched.
// It serialises the end-transition inside a DB transaction.
func endAuctionIfExpired(ctx context.Context, auctionID string) error {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var (
		status          string
		endTime         time.Time
		highestBid      float64
		highestBidderID *string
		sellerID        string
	)
	err = tx.QueryRow(ctx, `
		SELECT a.status, a.end_time, a.current_highest_bid, a.highest_bidder_id,
		       p.seller_id
		FROM auctions a
		JOIN products p ON p.id = a.product_id
		WHERE a.id = $1
		FOR UPDATE`, auctionID,
	).Scan(&status, &endTime, &highestBid, &highestBidderID, &sellerID)
	if err != nil {
		return err
	}

	// Only transition ACTIVE auctions whose time has elapsed
	if status != "ACTIVE" || !time.Now().After(endTime) {
		return nil
	}

	// Mark auction ENDED
	_, err = tx.Exec(ctx, `UPDATE auctions SET status = 'ENDED' WHERE id = $1`, auctionID)
	if err != nil {
		return err
	}

	if highestBidderID != nil {
		// Winner's SOFT hold → HARD
		_, err = tx.Exec(ctx, `
			UPDATE bid_holds SET status = 'HARD', updated_at = NOW()
			WHERE auction_id = $1 AND user_id = $2 AND status = 'SOFT'`,
			auctionID, *highestBidderID,
		)
		if err != nil {
			return err
		}

		// Refund all other SOFT holds for this auction
		rows, err := tx.Query(ctx, `
			SELECT id, user_id, amount FROM bid_holds
			WHERE auction_id = $1 AND status = 'SOFT' AND user_id != $2`,
			auctionID, *highestBidderID,
		)
		if err != nil {
			return err
		}
		type holdRow struct {
			id     string
			userID string
			amount float64
		}
		var others []holdRow
		for rows.Next() {
			var h holdRow
			_ = rows.Scan(&h.id, &h.userID, &h.amount)
			others = append(others, h)
		}
		rows.Close()

		for _, h := range others {
			_, err = tx.Exec(ctx, `
				UPDATE bid_holds SET status = 'RELEASED', updated_at = NOW() WHERE id = $1`, h.id)
			if err != nil {
				return err
			}
			_, err = tx.Exec(ctx, `
				UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2`,
				h.amount, h.userID)
			if err != nil {
				return err
			}
			_, err = tx.Exec(ctx, `
				INSERT INTO transactions (user_id, amount, type, status, reference)
				VALUES ($1, $2, 'REFUND', 'COMPLETED', $3)`,
				h.userID, h.amount, auctionID)
			if err != nil {
				return err
			}
		}

		// Create settlement record (idempotent via ON CONFLICT DO NOTHING)
		_, err = tx.Exec(ctx, `
			INSERT INTO settlements (auction_id, winner_id, seller_id, amount)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (auction_id) DO NOTHING`,
			auctionID, *highestBidderID, sellerID, highestBid,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// ─────────────────────────────────────────────────────────────────────────────
// GetAuctionBids  GET /api/auctions/{id}/bids
// Returns the last 20 bids for an auction with masked bidder names.
// ─────────────────────────────────────────────────────────────────────────────
func (h *AuctionHandler) GetAuctionBids(w http.ResponseWriter, r *http.Request) {
	auctionID := chi.URLParam(r, "id")
	ctx := r.Context()

	rows, err := db.Pool.Query(ctx, `
		SELECT b.amount, b.created_at, u.name
		FROM bids b
		JOIN users u ON u.id = b.user_id
		WHERE b.auction_id = $1
		ORDER BY b.created_at DESC
		LIMIT 20`,
		auctionID,
	)
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type BidHistory struct {
		Amount    float64 `json:"amount"`
		PlacedAt  string  `json:"placed_at"`
		BidderTag string  `json:"bidder_tag"`
	}

	var bids []BidHistory
	for rows.Next() {
		var amount float64
		var placedAt time.Time
		var name string
		if err := rows.Scan(&amount, &placedAt, &name); err != nil {
			continue
		}
		// Mask name: keep first 4 chars then ***
		tag := name
		if len(name) > 4 {
			tag = name[:4] + "***"
		}
		bids = append(bids, BidHistory{
			Amount:    amount,
			PlacedAt:  placedAt.UTC().Format(time.RFC3339),
			BidderTag: tag,
		})
	}
	if bids == nil {
		bids = []BidHistory{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(bids)
}

// ─────────────────────────────────────────────────────────────────────────────
// ApproveSettlement  POST /api/auctions/{id}/settle
//
// The authenticated caller (winner or seller) records their approval.
// When both have approved, the hard-blocked amount is transferred to the seller.
// ─────────────────────────────────────────────────────────────────────────────
func (h *AuctionHandler) ApproveSettlement(w http.ResponseWriter, r *http.Request) {
	auctionID := chi.URLParam(r, "id")
	callerID, ok := authmw.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// Lock settlement row
	var (
		settlementID     string
		winnerID         string
		sellerID         string
		amount           float64
		winnerApprovedAt *time.Time
		sellerApprovedAt *time.Time
		settlementStatus string
	)
	err = tx.QueryRow(ctx, `
		SELECT id, winner_id, seller_id, amount,
		       winner_approved_at, seller_approved_at, status
		FROM settlements
		WHERE auction_id = $1
		FOR UPDATE`, auctionID,
	).Scan(&settlementID, &winnerID, &sellerID, &amount,
		&winnerApprovedAt, &sellerApprovedAt, &settlementStatus)
	if err == pgx.ErrNoRows {
		http.Error(w, "settlement not found — auction may still be active", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}
	if settlementStatus == "COMPLETED" {
		http.Error(w, "settlement already completed", http.StatusConflict)
		return
	}

	// Record the caller's approval
	switch callerID {
	case winnerID:
		if winnerApprovedAt != nil {
			http.Error(w, "you have already approved", http.StatusConflict)
			return
		}
		now := time.Now()
		winnerApprovedAt = &now
		_, err = tx.Exec(ctx, `
			UPDATE settlements SET winner_approved_at = NOW() WHERE id = $1`, settlementID)
	case sellerID:
		if sellerApprovedAt != nil {
			http.Error(w, "you have already approved", http.StatusConflict)
			return
		}
		now := time.Now()
		sellerApprovedAt = &now
		_, err = tx.Exec(ctx, `
			UPDATE settlements SET seller_approved_at = NOW() WHERE id = $1`, settlementID)
	default:
		http.Error(w, "you are not a party to this settlement", http.StatusForbidden)
		return
	}
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}

	// If both parties approved, execute the transfer
	bothApproved := winnerApprovedAt != nil && sellerApprovedAt != nil
	if bothApproved {
		// Mark settlement COMPLETED
		_, err = tx.Exec(ctx, `
			UPDATE settlements SET status = 'COMPLETED' WHERE id = $1`, settlementID)
		if err != nil {
			http.Error(w, "database error", http.StatusInternalServerError)
			return
		}

		// Mark the winner's HARD hold as SETTLED
		_, err = tx.Exec(ctx, `
			UPDATE bid_holds SET status = 'SETTLED', updated_at = NOW()
			WHERE auction_id = $1 AND user_id = $2 AND status = 'HARD'`,
			auctionID, winnerID,
		)
		if err != nil {
			http.Error(w, "database error", http.StatusInternalServerError)
			return
		}

		// Credit the seller's wallet
		_, err = tx.Exec(ctx, `
			UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2`,
			amount, sellerID,
		)
		if err != nil {
			http.Error(w, "database error", http.StatusInternalServerError)
			return
		}

		// Record TRANSFER transactions for both parties
		_, err = tx.Exec(ctx, `
			INSERT INTO transactions (user_id, amount, type, status, reference)
			VALUES ($1, $2, 'TRANSFER', 'COMPLETED', $3)`,
			winnerID, amount, auctionID)
		if err != nil {
			http.Error(w, "database error", http.StatusInternalServerError)
			return
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO transactions (user_id, amount, type, status, reference)
			VALUES ($1, $2, 'TRANSFER', 'COMPLETED', $3)`,
			sellerID, amount, auctionID)
		if err != nil {
			http.Error(w, "database error", http.StatusInternalServerError)
			return
		}
	}

	if err = tx.Commit(ctx); err != nil {
		http.Error(w, "commit failed", http.StatusInternalServerError)
		return
	}

	resp := map[string]interface{}{
		"success":           true,
		"both_approved":     bothApproved,
		"winner_approved":   winnerApprovedAt != nil,
		"seller_approved":   sellerApprovedAt != nil,
		"settlement_status": "PENDING",
	}
	if bothApproved {
		resp["settlement_status"] = "COMPLETED"
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
