package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/karti/orange-city-mart/backend/db"
	"github.com/karti/orange-city-mart/backend/hub"
	authmw "github.com/karti/orange-city-mart/backend/middleware"
)

// ChatHandler needs the hub to broadcast messages in real-time.
type ChatHandler struct {
	Hub *hub.Hub
}

// roomID deterministically builds a room identifier from two user IDs.
func roomID(a, b string) string {
	ids := []string{a, b}
	sort.Strings(ids)
	return strings.Join(ids, "_")
}

// ─────────────────────────────────────────────────────────────────────────────
// GetConversations  GET /api/chat/conversations
//
// Returns all rooms the caller has exchanged messages with, including the
// other party's name and a preview of the last message.
// ─────────────────────────────────────────────────────────────────────────────
func (h *ChatHandler) GetConversations(w http.ResponseWriter, r *http.Request) {
	callerID, ok := authmw.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	ctx := r.Context()

	type Conversation struct {
		RoomID       string  `json:"room_id"`
		OtherUserID  string  `json:"other_user_id"`
		OtherName    string  `json:"other_name"`
		LastBody     *string `json:"last_body"`
		LastImageURL *string `json:"last_image_url"`
		LastAt       string  `json:"last_at"`
		UnreadCount  int     `json:"unread_count"`
	}

	// Find all rooms for this caller, get the latest message per room,
	// and resolve the other party's name.
	rows, err := db.Pool.Query(ctx, `
		WITH latest AS (
			SELECT DISTINCT ON (room_id)
			       room_id, body, image_url, created_at
			FROM messages
			WHERE room_id LIKE '%' || $1 || '%'
			ORDER BY room_id, created_at DESC
		)
		SELECT l.room_id, l.body, l.image_url, l.created_at,
		       u.id, u.name
		FROM latest l
		JOIN users u ON (
		    -- derive the other user ID from the room_id string
		    u.id::text = CASE
		        WHEN split_part(l.room_id, '_', 1) = $1
		            THEN split_part(l.room_id, '_', 2)
		        ELSE split_part(l.room_id, '_', 1)
		    END
		)
		ORDER BY l.created_at DESC`,
		callerID,
	)
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var convos []Conversation
	for rows.Next() {
		var c Conversation
		var lastAt time.Time
		err := rows.Scan(&c.RoomID, &c.LastBody, &c.LastImageURL, &lastAt,
			&c.OtherUserID, &c.OtherName)
		if err != nil {
			continue
		}
		c.LastAt = lastAt.UTC().Format(time.RFC3339)
		convos = append(convos, c)
	}
	if convos == nil {
		convos = []Conversation{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(convos)
}

// ─────────────────────────────────────────────────────────────────────────────
// GetMessages  GET /api/chat/rooms/{roomId}/messages
//
// Returns the last 50 messages for a room, oldest-first.
// Validates that the caller is a member of the room.
// ─────────────────────────────────────────────────────────────────────────────
func (h *ChatHandler) GetMessages(w http.ResponseWriter, r *http.Request) {
	callerID, ok := authmw.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	rid := chi.URLParam(r, "roomId")

	// Security: caller must be one of the two members of the room.
	if !strings.Contains(rid, callerID) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	ctx := r.Context()

	rows, err := db.Pool.Query(ctx, `
		SELECT m.id, m.sender_id, u.name AS sender_name,
		       m.body, m.image_url, m.created_at
		FROM (
		    SELECT * FROM messages
		    WHERE room_id = $1
		    ORDER BY created_at DESC
		    LIMIT 50
		) m
		JOIN users u ON u.id = m.sender_id
		ORDER BY m.created_at ASC`,
		rid,
	)
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type Msg struct {
		ID         string  `json:"id"`
		SenderID   string  `json:"sender_id"`
		SenderName string  `json:"sender_name"`
		Body       *string `json:"body"`
		ImageURL   *string `json:"image_url"`
		CreatedAt  string  `json:"created_at"`
	}

	var msgs []Msg
	for rows.Next() {
		var m Msg
		var createdAt time.Time
		if err := rows.Scan(&m.ID, &m.SenderID, &m.SenderName,
			&m.Body, &m.ImageURL, &createdAt); err != nil {
			continue
		}
		m.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		msgs = append(msgs, m)
	}
	if msgs == nil {
		msgs = []Msg{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(msgs)
}

// ─────────────────────────────────────────────────────────────────────────────
// SendMessage  POST /api/chat/rooms/{roomId}/messages
//
// Persists a message (text body or image_url) and broadcasts it to all
// WebSocket clients in the room.
// ─────────────────────────────────────────────────────────────────────────────
func (h *ChatHandler) SendMessage(w http.ResponseWriter, r *http.Request) {
	callerID, ok := authmw.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	rid := chi.URLParam(r, "roomId")

	if !strings.Contains(rid, callerID) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	var req struct {
		Body     *string `json:"body"`
		ImageURL *string `json:"image_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Body == nil && req.ImageURL == nil {
		http.Error(w, "body or image_url required", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// Fetch sender name for the WS broadcast payload.
	var senderName string
	err := db.Pool.QueryRow(ctx, `SELECT name FROM users WHERE id = $1`, callerID).
		Scan(&senderName)
	if err == pgx.ErrNoRows {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}

	// Persist the message.
	var msgID string
	var createdAt time.Time
	err = db.Pool.QueryRow(ctx, `
		INSERT INTO messages (room_id, sender_id, body, image_url)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at`,
		rid, callerID, req.Body, req.ImageURL,
	).Scan(&msgID, &createdAt)
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}

	type ChatMsgPayload struct {
		ID         string  `json:"id"`
		RoomID     string  `json:"room_id"`
		SenderID   string  `json:"sender_id"`
		SenderName string  `json:"sender_name"`
		Body       *string `json:"body"`
		ImageURL   *string `json:"image_url"`
		CreatedAt  string  `json:"created_at"`
	}

	payload := ChatMsgPayload{
		ID:         msgID,
		RoomID:     rid,
		SenderID:   callerID,
		SenderName: senderName,
		Body:       req.Body,
		ImageURL:   req.ImageURL,
		CreatedAt:  createdAt.UTC().Format(time.RFC3339),
	}
	payloadBytes, _ := json.Marshal(payload)
	h.Hub.BroadcastToChat(rid, hub.Message{
		Type:    hub.TypeChatMessage,
		Payload: json.RawMessage(payloadBytes),
	})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(payload)
}
