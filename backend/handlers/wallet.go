package handlers

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/karti/orange-city-mart/backend/db"
	authmw "github.com/karti/orange-city-mart/backend/middleware"
)

// verifySignature validates the HMAC-SHA256 request signature.
func verifySignature(message, signature string) bool {
	secret := os.Getenv("JWT_SECRET")
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(message))
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}

// GetWallet handles GET /api/wallet
// Returns the authenticated user's wallet balance and transaction history.
func GetWallet(w http.ResponseWriter, r *http.Request) {
	userID, ok := authmw.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	ctx := r.Context()

	var balance float64
	err := db.Pool.QueryRow(ctx,
		`SELECT wallet_balance FROM users WHERE id = $1`, userID,
	).Scan(&balance)
	if err != nil {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}

	rows, err := db.Pool.Query(ctx, `
		SELECT id, amount, type, status, reference, created_at
		FROM transactions WHERE user_id = $1
		ORDER BY created_at DESC LIMIT 50`,
		userID,
	)
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type txRow struct {
		ID        string  `json:"id"`
		Amount    float64 `json:"amount"`
		Type      string  `json:"type"`
		Status    string  `json:"status"`
		Reference *string `json:"reference"`
		CreatedAt string  `json:"created_at"`
	}
	var txns []txRow
	for rows.Next() {
		var t txRow
		var ts time.Time
		_ = rows.Scan(&t.ID, &t.Amount, &t.Type, &t.Status, &t.Reference, &ts)
		t.CreatedAt = ts.UTC().Format(time.RFC3339)
		txns = append(txns, t)
	}
	if txns == nil {
		txns = []txRow{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"balance":      balance,
		"transactions": txns,
	})
}

// Deposit handles POST /api/wallet/deposit
func Deposit(w http.ResponseWriter, r *http.Request) {
	userID, ok := authmw.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		Amount float64 `json:"amount"`
		UPIREF string  `json:"upi_ref"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Amount <= 0 {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.UPIREF == "" {
		req.UPIREF = "FE" + strconv.FormatInt(time.Now().UnixMilli(), 10)
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// Idempotency check
	var count int
	_ = tx.QueryRow(ctx,
		`SELECT COUNT(*) FROM transactions WHERE reference = $1 AND type = 'DEPOSIT'`,
		req.UPIREF,
	).Scan(&count)
	if count > 0 {
		http.Error(w, "duplicate transaction", http.StatusConflict)
		return
	}

	_, err = tx.Exec(ctx,
		`UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2`,
		req.Amount, userID,
	)
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}
	_, err = tx.Exec(ctx,
		`INSERT INTO transactions (user_id, amount, type, status, reference) VALUES ($1, $2, 'DEPOSIT', 'COMPLETED', $3)`,
		userID, req.Amount, req.UPIREF,
	)
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}
	if err = tx.Commit(ctx); err != nil {
		http.Error(w, "commit failed", http.StatusInternalServerError)
		return
	}

	var newBalance float64
	_ = db.Pool.QueryRow(ctx, `SELECT wallet_balance FROM users WHERE id = $1`, userID).Scan(&newBalance)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":     true,
		"new_balance": newBalance,
	})
}

// Withdraw handles POST /api/wallet/withdraw
func Withdraw(w http.ResponseWriter, r *http.Request) {
	userID, ok := authmw.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		Amount float64 `json:"amount"`
		UPIID  string  `json:"upi_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Amount <= 0 {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	var balance float64
	err = tx.QueryRow(ctx,
		`SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE`, userID,
	).Scan(&balance)
	if err != nil {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}
	if balance < req.Amount {
		http.Error(w, "insufficient balance", http.StatusPaymentRequired)
		return
	}
	_, err = tx.Exec(ctx,
		`UPDATE users SET wallet_balance = wallet_balance - $1 WHERE id = $2`,
		req.Amount, userID,
	)
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}
	_, err = tx.Exec(ctx,
		`INSERT INTO transactions (user_id, amount, type, status, reference) VALUES ($1, $2, 'WITHDRAW', 'COMPLETED', $3)`,
		userID, req.Amount, req.UPIID,
	)
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}
	if err = tx.Commit(ctx); err != nil {
		http.Error(w, "commit failed", http.StatusInternalServerError)
		return
	}

	var newBalance float64
	_ = db.Pool.QueryRow(ctx, `SELECT wallet_balance FROM users WHERE id = $1`, userID).Scan(&newBalance)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":     true,
		"new_balance": newBalance,
	})
}

// formatAmount converts a float64 to a string for signature verification.
func formatAmount(f float64) string {
	return strconv.FormatFloat(f, 'f', 2, 64)
}
