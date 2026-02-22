package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/karti/orange-city-mart/backend/db"
	authmw "github.com/karti/orange-city-mart/backend/middleware"
)

// ── Create Product ─────────────────────────────────────────────────────────────
// POST /api/products  (requires auth)
func CreateProduct(w http.ResponseWriter, r *http.Request) {
	userID, ok := authmw.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var body struct {
		Title       string  `json:"title"`
		Description string  `json:"description"`
		Category    string  `json:"category"`
		Type        string  `json:"type"`        // FIXED | AUCTION
		Price       float64 `json:"price"`       // used for FIXED; start_price for AUCTION
		StartPrice  float64 `json:"start_price"` // optional, for AUCTION
		EndTime     string  `json:"end_time"`    // RFC3339, for AUCTION
		Location    string  `json:"location"`
		ImageURL    string  `json:"image_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	if body.Title == "" || body.Category == "" || body.Location == "" {
		http.Error(w, "title, category, and location are required", http.StatusBadRequest)
		return
	}
	if body.Type != "FIXED" && body.Type != "AUCTION" {
		http.Error(w, "type must be FIXED or AUCTION", http.StatusBadRequest)
		return
	}

	ctx := r.Context()

	// Effective price stored in products.price
	effectivePrice := body.Price
	if body.Type == "AUCTION" && body.StartPrice > 0 {
		effectivePrice = body.StartPrice
	}

	// Insert product
	var productID string
	err := db.Pool.QueryRow(ctx, `
		INSERT INTO products (seller_id, title, description, category, type, price, image_url, location)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		RETURNING id`,
		userID, body.Title, body.Description, body.Category,
		body.Type, effectivePrice, nullableString(body.ImageURL), body.Location,
	).Scan(&productID)
	if err != nil {
		http.Error(w, "could not create product: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// If AUCTION, insert auction row
	if body.Type == "AUCTION" {
		endTime, err := time.Parse(time.RFC3339, body.EndTime)
		if err != nil {
			// Try datetime-local format (no timezone)
			endTime, err = time.ParseInLocation("2006-01-02T15:04", body.EndTime, time.Local)
			if err != nil {
				http.Error(w, "invalid end_time format", http.StatusBadRequest)
				return
			}
		}
		_, err = db.Pool.Exec(ctx, `
			INSERT INTO auctions (product_id, start_price, current_highest_bid, end_time, status)
			VALUES ($1,$2,$3,$4,'ACTIVE')`,
			productID, effectivePrice, 0, endTime,
		)
		if err != nil {
			http.Error(w, "could not create auction: "+err.Error(), http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"id": productID})
}

// nullableString returns nil if s is empty (for nullable TEXT columns).
func nullableString(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}
