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
)

// AuctionHandler wraps the WebSocket hub so handlers can push events.
type AuctionHandler struct {
	Hub *hub.Hub
}

// placeBidRequest is the expected JSON body for POST /api/auctions/{id}/bid
type placeBidRequest struct {
	UserID string  `json:"user_id"`
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

// PlaceBid handles POST /api/auctions/{id}/bid
// It uses PostgreSQL row-level locking (SELECT ... FOR UPDATE) to guarantee
// that concurrent bids on the same auction are serialised safely.
func (h *AuctionHandler) PlaceBid(w http.ResponseWriter, r *http.Request) {
	auctionID := chi.URLParam(r, "id")

	var req placeBidRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.UserID == "" || req.Amount <= 0 {
		http.Error(w, "user_id and positive amount are required", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// ── Begin transaction ─────────────────────────────────────────────────
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx) // no-op if committed

	// ── Lock the auction row ──────────────────────────────────────────────
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

	// ── Lock the bidder's wallet ──────────────────────────────────────────
	var bidderBalance float64
	err = tx.QueryRow(ctx, `
		SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE`,
		req.UserID,
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

	// ── Refund previous highest bidder ───────────────────────────────────
	if prevHighBidderID != nil && *prevHighBidderID != req.UserID {
		_, err = tx.Exec(ctx, `
			UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2`,
			currentHighBid, *prevHighBidderID,
		)
		if err != nil {
			http.Error(w, "database error", http.StatusInternalServerError)
			return
		}
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

	// ── Deduct from new bidder's wallet ──────────────────────────────────
	_, err = tx.Exec(ctx, `
		UPDATE users SET wallet_balance = wallet_balance - $1 WHERE id = $2`,
		req.Amount, req.UserID,
	)
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO transactions (user_id, amount, type, status, reference)
		VALUES ($1, $2, 'BID_HOLD', 'COMPLETED', $3)`,
		req.UserID, req.Amount, auctionID,
	)
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}

	// ── Update auction ────────────────────────────────────────────────────
	_, err = tx.Exec(ctx, `
		UPDATE auctions
		SET current_highest_bid = $1, highest_bidder_id = $2
		WHERE id = $3`,
		req.Amount, req.UserID, auctionID,
	)
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}

	// ── Record the bid ────────────────────────────────────────────────────
	_, err = tx.Exec(ctx, `
		INSERT INTO bids (auction_id, user_id, amount) VALUES ($1, $2, $3)`,
		auctionID, req.UserID, req.Amount,
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

	// ── Push WebSocket events (after successful commit) ────────────────────
	bidPayloadBytes, _ := json.Marshal(BidPayload{
		AuctionID: auctionID,
		Amount:    req.Amount,
		BidderID:  req.UserID,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	})
	h.Hub.BroadcastToAuction(auctionID, hub.Message{
		Type:    hub.TypeBroadcastNewBid,
		Payload: json.RawMessage(bidPayloadBytes),
	})

	if prevHighBidderID != nil && *prevHighBidderID != req.UserID {
		outbidBytes, _ := json.Marshal(OutbidPayload{
			AuctionID:  auctionID,
			YourBid:    currentHighBid,
			NewHighBid: req.Amount,
			NewBidder:  req.UserID,
		})
		h.Hub.SendToUser(*prevHighBidderID, hub.Message{
			Type:    hub.TypeOutbidAlert,
			Payload: json.RawMessage(outbidBytes),
		})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":     true,
		"auction_id":  auctionID,
		"new_high_bid": req.Amount,
	})
}

// GetAuction handles GET /api/auctions/{id}
func (h *AuctionHandler) GetAuction(w http.ResponseWriter, r *http.Request) {
	auctionID := chi.URLParam(r, "id")
	ctx := r.Context()

	row := db.Pool.QueryRow(ctx, `
		SELECT a.id, a.product_id, p.title, p.description, p.image_url,
		       a.start_price, a.current_highest_bid, a.highest_bidder_id,
		       a.end_time, a.status
		FROM auctions a
		JOIN products p ON p.id = a.product_id
		WHERE a.id = $1`,
		auctionID,
	)

	var result struct {
		ID               string   `json:"id"`
		ProductID        string   `json:"product_id"`
		Title            string   `json:"title"`
		Description      string   `json:"description"`
		ImageURL         *string  `json:"image_url"`
		StartPrice       float64  `json:"start_price"`
		CurrentHighBid   float64  `json:"current_highest_bid"`
		HighestBidderID  *string  `json:"highest_bidder_id"`
		EndTime          string   `json:"end_time"`
		Status           string   `json:"status"`
	}

	var endTime time.Time
	err := row.Scan(
		&result.ID, &result.ProductID, &result.Title, &result.Description,
		&result.ImageURL, &result.StartPrice, &result.CurrentHighBid,
		&result.HighestBidderID, &endTime, &result.Status,
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

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}
