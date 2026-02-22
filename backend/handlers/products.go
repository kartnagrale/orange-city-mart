package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/karti/orange-city-mart/backend/db"
)

// ── List Products ─────────────────────────────────────────────────────────────
// GET /api/products?q=&category=&type=&limit=
func ListProducts(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	category := strings.TrimSpace(r.URL.Query().Get("category"))
	pType := strings.TrimSpace(r.URL.Query().Get("type")) // FIXED | AUCTION

	ctx := r.Context()

	// Build a dynamic query
	args := []any{}
	where := []string{"1=1"}
	i := 1

	if q != "" {
		where = append(where, "p.title ILIKE $"+itoa(i))
		args = append(args, "%"+q+"%")
		i++
	}
	if category != "" && category != "All" {
		where = append(where, "p.category = $"+itoa(i))
		args = append(args, category)
		i++
	}
	if pType != "" && pType != "All" {
		where = append(where, "p.type = $"+itoa(i))
		args = append(args, pType)
		i++
	}

	query := `
		SELECT p.id, p.title, p.description, p.category, p.type, p.price,
		       p.image_url, p.location, p.created_at,
		       a.id, a.current_highest_bid, a.end_time, a.status
		FROM products p
		LEFT JOIN auctions a ON a.product_id = p.id AND a.status = 'ACTIVE'
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY p.created_at DESC
		LIMIT 50`

	rows, err := db.Pool.Query(ctx, query, args...)
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type ProductRow struct {
		ID            string   `json:"id"`
		Title         string   `json:"title"`
		Description   string   `json:"description"`
		Category      string   `json:"category"`
		Type          string   `json:"type"`
		Price         float64  `json:"price"`
		ImageURL      *string  `json:"image_url"`
		Location      string   `json:"location"`
		CreatedAt     string   `json:"created_at"`
		AuctionID     *string  `json:"auction_id"`
		CurrentBid    *float64 `json:"current_bid"`
		EndTime       *string  `json:"end_time"`
		AuctionStatus *string  `json:"auction_status"`
	}

	var items []ProductRow
	for rows.Next() {
		var p ProductRow
		var createdAt time.Time
		var endTime *time.Time
		err := rows.Scan(
			&p.ID, &p.Title, &p.Description, &p.Category, &p.Type, &p.Price,
			&p.ImageURL, &p.Location, &createdAt,
			&p.AuctionID, &p.CurrentBid, &endTime, &p.AuctionStatus,
		)
		if err != nil {
			continue
		}
		p.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		if endTime != nil {
			s := endTime.UTC().Format(time.RFC3339)
			p.EndTime = &s
		}
		items = append(items, p)
	}
	if items == nil {
		items = []ProductRow{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

// ── Get Single Product ────────────────────────────────────────────────────────
// GET /api/products/:id
func GetProduct(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	ctx := r.Context()

	type ProductDetail struct {
		ID            string   `json:"id"`
		SellerID      string   `json:"seller_id"`
		SellerName    string   `json:"seller_name"`
		Title         string   `json:"title"`
		Description   string   `json:"description"`
		Category      string   `json:"category"`
		Type          string   `json:"type"`
		Price         float64  `json:"price"`
		ImageURL      *string  `json:"image_url"`
		Location      string   `json:"location"`
		AuctionID     *string  `json:"auction_id"`
		CurrentBid    *float64 `json:"current_bid"`
		EndTime       *string  `json:"end_time"`
		AuctionStatus *string  `json:"auction_status"`
	}

	var p ProductDetail
	var endTime *time.Time

	err := db.Pool.QueryRow(ctx, `
		SELECT p.id, p.seller_id, u.name, p.title, p.description, p.category,
		       p.type, p.price, p.image_url, p.location,
		       a.id, a.current_highest_bid, a.end_time, a.status
		FROM products p
		JOIN users u ON u.id = p.seller_id
		LEFT JOIN auctions a ON a.product_id = p.id
		WHERE p.id = $1`, id,
	).Scan(
		&p.ID, &p.SellerID, &p.SellerName, &p.Title, &p.Description, &p.Category,
		&p.Type, &p.Price, &p.ImageURL, &p.Location,
		&p.AuctionID, &p.CurrentBid, &endTime, &p.AuctionStatus,
	)
	if err != nil {
		http.Error(w, "product not found", http.StatusNotFound)
		return
	}
	if endTime != nil {
		s := endTime.UTC().Format(time.RFC3339)
		p.EndTime = &s
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(p)
}

func itoa(i int) string {
	return strconv.Itoa(i)
}
