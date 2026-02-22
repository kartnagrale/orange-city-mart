package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/gorilla/websocket"
	"github.com/karti/orange-city-mart/backend/db"
	"github.com/karti/orange-city-mart/backend/handlers"
	"github.com/karti/orange-city-mart/backend/hub"
	authmw "github.com/karti/orange-city-mart/backend/middleware"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func main() {
	// ── Database ──────────────────────────────────────────────────────────
	ctx := context.Background()
	if err := db.Connect(ctx); err != nil {
		log.Fatalf("cannot connect to database: %v", err)
	}
	log.Println("✅ Connected to PostgreSQL")

	// ── WebSocket Hub ─────────────────────────────────────────────────────
	wsHub := hub.NewHub()
	go wsHub.Run()

	// ── Handlers ──────────────────────────────────────────────────────────
	auctionHandler := &handlers.AuctionHandler{Hub: wsHub}

	// ── Router ────────────────────────────────────────────────────────────
	r := chi.NewRouter()

	// ── Static file server for uploaded images ────────────────────────────
	uploadsFS := http.FileServer(http.Dir("./uploads"))
	r.Handle("/uploads/*", http.StripPrefix("/uploads/", uploadsFS))

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "http://frontend:5173"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "multipart/form-data"},
		AllowCredentials: true,
	}))

	// Health
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"status":"ok"}`))
	})

	// ── Auth (public) ─────────────────────────────────────────────────────
	r.Post("/api/auth/register", handlers.Register)
	r.Post("/api/auth/login", handlers.Login)

	// ── Products (public read) ────────────────────────────────────────────
	r.Get("/api/products", handlers.ListProducts)
	r.Get("/api/products/{id}", handlers.GetProduct)

	// ── WebSocket ─────────────────────────────────────────────────────────
	r.Get("/ws", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("ws upgrade error: %v", err)
			return
		}
		userID := r.URL.Query().Get("user_id")
		auctionID := r.URL.Query().Get("auction_id")
		roomID := r.URL.Query().Get("room_id")
		wsHub.NewClient(userID, auctionID, roomID, conn)
	})

	// ── Auctions ──────────────────────────────────────────────────────────
	r.Route("/api/auctions", func(r chi.Router) {
		r.Get("/{id}", auctionHandler.GetAuction)
		r.With(authmw.RequireAuth).Post("/{id}/bid", auctionHandler.PlaceBid)
	})

	// ── Protected routes ──────────────────────────────────────────────────
	r.Group(func(r chi.Router) {
		r.Use(authmw.RequireAuth)
		r.Post("/api/upload", handlers.UploadImage)
		r.Post("/api/products", handlers.CreateProduct)
		r.Get("/api/wallet", handlers.GetWallet)
		r.Post("/api/wallet/deposit", handlers.Deposit)
		r.Post("/api/wallet/withdraw", handlers.Withdraw)
		r.Get("/api/bids", handlers.ListMyBids)
	})

	// ── Server ────────────────────────────────────────────────────────────
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("🚀 Orange City Mart backend listening on :%s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
