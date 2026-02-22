package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/karti/orange-city-mart/backend/db"
	authmw "github.com/karti/orange-city-mart/backend/middleware"
)

// ListMyBids handles GET /api/bids (requires auth)
// Returns all bids placed by the authenticated user, enriched with auction+product info.
func ListMyBids(w http.ResponseWriter, r *http.Request) {
	userID, ok := authmw.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	ctx := r.Context()

	rows, err := db.Pool.Query(ctx, `
		SELECT
			b.id, b.amount, b.created_at,
			a.id, a.current_highest_bid, a.end_time, a.status,
			a.highest_bidder_id,
			p.id, p.title, p.image_url
		FROM bids b
		JOIN auctions a ON a.id = b.auction_id
		JOIN products p ON p.id = a.product_id
		WHERE b.user_id = $1
		ORDER BY b.created_at DESC`, userID)
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type BidRow struct {
		ID              string  `json:"id"`
		Amount          float64 `json:"amount"`
		PlacedAt        string  `json:"placed_at"`
		AuctionID       string  `json:"auction_id"`
		CurrentHighBid  float64 `json:"current_high_bid"`
		EndTime         string  `json:"end_time"`
		AuctionStatus   string  `json:"auction_status"`
		HighestBidderID *string `json:"highest_bidder_id"`
		ProductID       string  `json:"product_id"`
		ProductTitle    string  `json:"product_title"`
		ProductImageURL *string `json:"product_image_url"`
		// Computed
		IsWinning bool `json:"is_winning"`
	}

	var bids []BidRow
	for rows.Next() {
		var b BidRow
		var createdAt, endTime time.Time
		err := rows.Scan(
			&b.ID, &b.Amount, &createdAt,
			&b.AuctionID, &b.CurrentHighBid, &endTime, &b.AuctionStatus,
			&b.HighestBidderID,
			&b.ProductID, &b.ProductTitle, &b.ProductImageURL,
		)
		if err != nil {
			continue
		}
		b.PlacedAt = createdAt.UTC().Format(time.RFC3339)
		b.EndTime = endTime.UTC().Format(time.RFC3339)
		b.IsWinning = b.HighestBidderID != nil && *b.HighestBidderID == userID
		bids = append(bids, b)
	}
	if bids == nil {
		bids = []BidRow{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(bids)
}
