package hub

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
)

// MessageType constants for WebSocket payloads.
const (
	TypeBroadcastNewBid = "broadcast_new_bid"
	TypeOutbidAlert     = "outbid_alert"
	TypeChatMessage     = "chat_message"
)

// Message is the generic WebSocket message envelope.
type Message struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

// Client represents a single connected WebSocket client.
type Client struct {
	ID        string // user ID from JWT
	AuctionID string // optional: auction room the client is watching
	RoomID    string // optional: chat room
	conn      *websocket.Conn
	send      chan []byte
	hub       *Hub
}

// Hub manages all WebSocket connections with two room types:
//   - AuctionRooms: keyed by auction_id  → real-time bidding broadcasts
//   - ChatRooms:    keyed by chat "room"  → peer-to-peer chat
type Hub struct {
	mu           sync.RWMutex
	clients      map[*Client]struct{} // all connected clients
	userIndex    map[string]*Client   // userID → client (for targeted messages)
	auctionRooms map[string][]*Client // auctionID → clients watching it
	chatRooms    map[string][]*Client // roomID    → clients in it
	db           *pgxpool.Pool        // for persisting chat messages

	register   chan *Client
	unregister chan *Client
}

// NewHub creates and returns an initialised Hub.
func NewHub(db *pgxpool.Pool) *Hub {
	return &Hub{
		clients:      make(map[*Client]struct{}),
		userIndex:    make(map[string]*Client),
		auctionRooms: make(map[string][]*Client),
		chatRooms:    make(map[string][]*Client),
		db:           db,
		register:     make(chan *Client, 256),
		unregister:   make(chan *Client, 256),
	}
}

// Run is the central event loop. It must be started in its own goroutine.
func (h *Hub) Run() {
	for {
		select {
		case c := <-h.register:
			h.mu.Lock()
			h.clients[c] = struct{}{}
			if c.ID != "" {
				h.userIndex[c.ID] = c
			}
			if c.AuctionID != "" {
				h.auctionRooms[c.AuctionID] = append(h.auctionRooms[c.AuctionID], c)
			}
			if c.RoomID != "" {
				h.chatRooms[c.RoomID] = append(h.chatRooms[c.RoomID], c)
			}
			h.mu.Unlock()

		case c := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[c]; ok {
				delete(h.clients, c)
				delete(h.userIndex, c.ID)
				h.removeFromSlice(h.auctionRooms, c.AuctionID, c)
				h.removeFromSlice(h.chatRooms, c.RoomID, c)
				close(c.send)
			}
			h.mu.Unlock()
		}
	}
}

func (h *Hub) removeFromSlice(m map[string][]*Client, key string, c *Client) {
	if key == "" {
		return
	}
	clients := m[key]
	for i, cl := range clients {
		if cl == c {
			m[key] = append(clients[:i], clients[i+1:]...)
			break
		}
	}
	if len(m[key]) == 0 {
		delete(m, key)
	}
}

// BroadcastToAuction sends a message to every client watching an auction.
// Non-blocking: slow clients whose send buffer is full are skipped.
func (h *Hub) BroadcastToAuction(auctionID string, msg Message) {
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("hub: marshal error: %v", err)
		return
	}

	h.mu.RLock()
	clients := make([]*Client, len(h.auctionRooms[auctionID]))
	copy(clients, h.auctionRooms[auctionID])
	h.mu.RUnlock()

	for _, c := range clients {
		select {
		case c.send <- data:
		default:
			log.Printf("hub: dropped message for slow client %s", c.ID)
		}
	}
}

// SendToUser sends a targeted message to a single user by their ID.
func (h *Hub) SendToUser(userID string, msg Message) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	h.mu.RLock()
	c, ok := h.userIndex[userID]
	h.mu.RUnlock()

	if !ok {
		return // user not connected — that's fine
	}

	select {
	case c.send <- data:
	default:
		log.Printf("hub: dropped targeted message for user %s", userID)
	}
}

// BroadcastToChat sends a message to every client in a chat room.
func (h *Hub) BroadcastToChat(roomID string, msg Message) {
	data, _ := json.Marshal(msg)

	h.mu.RLock()
	clients := make([]*Client, len(h.chatRooms[roomID]))
	copy(clients, h.chatRooms[roomID])
	h.mu.RUnlock()

	for _, c := range clients {
		select {
		case c.send <- data:
		default:
		}
	}
}

// NewClient creates a new client, registers it, and starts its read/write pumps.
func (h *Hub) NewClient(userID, auctionID, roomID string, conn *websocket.Conn) *Client {
	c := &Client{
		ID:        userID,
		AuctionID: auctionID,
		RoomID:    roomID,
		conn:      conn,
		send:      make(chan []byte, 256),
		hub:       h,
	}
	h.register <- c
	go c.writePump()
	go c.readPump()
	return c
}

// readPump drains incoming messages and handles chat_send frames.
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	for {
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			break
		}
		// Only process messages from authenticated chat clients.
		if c.ID == "" || c.RoomID == "" {
			continue
		}
		var frame struct {
			Type    string `json:"type"`
			Payload struct {
				Body     *string `json:"body"`
				ImageURL *string `json:"image_url"`
			} `json:"payload"`
		}
		if err := json.Unmarshal(data, &frame); err != nil {
			continue
		}
		if frame.Type != "chat_send" {
			continue
		}
		if frame.Payload.Body == nil && frame.Payload.ImageURL == nil {
			continue
		}

		// Persist message to DB.
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		var msgID, senderName string
		var createdAt time.Time
		err = c.hub.db.QueryRow(ctx, `
			INSERT INTO messages (room_id, sender_id, body, image_url)
			VALUES ($1, $2, $3, $4)
			RETURNING id, created_at`,
			c.RoomID, c.ID, frame.Payload.Body, frame.Payload.ImageURL,
		).Scan(&msgID, &createdAt)
		if err != nil {
			cancel()
			log.Printf("hub: failed to persist chat message: %v", err)
			continue
		}
		_ = c.hub.db.QueryRow(ctx, `SELECT name FROM users WHERE id = $1`, c.ID).Scan(&senderName)
		cancel()

		// Build and broadcast chat_message event.
		type chatPayload struct {
			ID         string  `json:"id"`
			RoomID     string  `json:"room_id"`
			SenderID   string  `json:"sender_id"`
			SenderName string  `json:"sender_name"`
			Body       *string `json:"body"`
			ImageURL   *string `json:"image_url"`
			CreatedAt  string  `json:"created_at"`
		}
		payloadBytes, _ := json.Marshal(chatPayload{
			ID:         msgID,
			RoomID:     c.RoomID,
			SenderID:   c.ID,
			SenderName: senderName,
			Body:       frame.Payload.Body,
			ImageURL:   frame.Payload.ImageURL,
			CreatedAt:  createdAt.UTC().Format(time.RFC3339),
		})
		c.hub.BroadcastToChat(c.RoomID, Message{
			Type:    TypeChatMessage,
			Payload: json.RawMessage(payloadBytes),
		})
	}
}

// writePump sends queued messages to the WebSocket connection.
func (c *Client) writePump() {
	defer c.conn.Close()
	for msg := range c.send {
		if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			break
		}
	}
}
