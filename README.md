# 🍊 Orange City Mart

Orange City Mart is a full-stack, enterprise-grade, peer-to-peer marketplace built entirely on Free and Open-Source Software (FOSS). It allows users to buy, sell, auction items, chat in real-time, and manage a digital wallet. 

This project was developed with a strong focus on concurrency, race-condition safety, and real-time bidirectional communication, making it highly robust under simultaneous user interactions (like exact-millisecond competitive bidding).

## 🚀 Technical Stack

### Backend (Go / Golang)
- **Framework & Routing:** `go-chi/chi` - Lightweight, idiomatic router.
- **Database:** PostgreSQL.
- **DB Driver & Toolkit:** `jackc/pgx/v5` for high-performance PostgreSQL driver and standard SQL queries.
- **Real-Time Communication:** `gorilla/websocket` - Native WebSockets in Go for chat and live bidding.
- **Authentication:** `golang-jwt/jwt` for stateless JWT-based authentication.
- **Security:** `bcrypt` for password hashing.

### Frontend (React + Vite)
- **Framework:** React 18 initialized via Vite for ultra-fast HMR and building.
- **Language:** TypeScript for type safety across components.
- **Styling:** Tailwind CSS - Utility-first CSS framework for rapid and responsive UI development.
- **State & Connection:** Custom hooks (e.g., `useAuctionSocket`) for managing real-time WebSocket state.

### Infrastructure
- **Containerization:** Docker & Docker Compose.
- **Database Service:** Official PostgreSQL Docker image.

---

## 🏗️ Architecture & Core Modules

### 1. Robust PostgreSQL Database Schema
The schema is designed for data integrity and monetary safety. Key tables:
- `users`: Stores core identity, hashed passwords, and a `wallet_balance` explicitly tracked with numeric/decimal types.
- `products`: Catalog items, tagged by type (`FIXED` vs `AUCTION`).
- `auctions`: Tracks auction lifecycles, start price, and the `current_highest_bid`.
- `bids`: Immutable ledger of every bid ever placed.
- `transactions`: Double-entry style logging for `DEPOSIT`, `WITHDRAW`, `BID_HOLD`, and `REFUND`.

### 2. Race-Condition Proof Auction Engine (Go Logic)
The core of the system is the **Auction Engine**. When multiple users bid on a highly contested item at the exact same millisecond:
- **Pessimistic Locking:** We execute `SELECT ... FOR UPDATE` within a PostgreSQL transaction block on the `auctions` row and the bidder's `users` row. This serializes concurrent read/write access at the database level.
- **Validation:** Inside the transaction, it strictly validates that the incoming `bid > current_highest_bid` and `wallet_balance >= bid`.
- **Atomic Money Transfer:** The new bid is deducted as a `BID_HOLD`. The previous highest bidder's `BID_HOLD` is instantly returned via a `REFUND` transaction.
- All these steps are atomic; if any check fails, the transaction rolls back cleanly preventing phantom reads or negative balances.

### 3. High-Performance WebSocket Hub
A central Hub pattern in Go using channels (`chan`) and goroutines safely fans out messages to connected clients without blocking the main event loops.
- **Granular Rooms:** Connections can subscribe to standard Chat Rooms or specific "Auction Rooms" (grouped by `auction_id`).
- **Live Event Dispatching:** Upon a successful DB commit for a bid:
  - `broadcast_new_bid`: Pushes the new highest bid to all viewers of that specific auction.
  - `outbid_alert`: Sends a targeted WebSocket payload *only* to the specific user ID who was just outbid, powering instant UI toast notifications.

### 4. Digital Wallet API
Provides `/api/wallet/deposit` and `/api/wallet/withdraw` endpoints.
- Simulates external payment gateway integrations (like UPI webhooks) with signature verification mechanisms.
- Uses strict transactional boundaries to safely increment or decrement `wallet_balance` in PostgreSQL.

### 5. Media Management
- End-to-end Photo Upload pipelines for product listings, supporting multipart form parsing in Go and local static serving of assets with proper MIME type headers.

---

## 🛠️ Local Development & Setup

### Prerequisites
- [Docker](https://docs.docker.com/engine/install/) and [Docker Compose](https://docs.docker.com/compose/install/) installed.

### Quick Start (Dockerized)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/karti/orange-city-mart.git
   cd orange-city-mart
   ```

2. **Run the stack:**
   This command spins up the PostgreSQL database, the Go Backend server, and the Vite Frontend server.
   ```bash
   docker-compose up --build
   ```

3. **Access the application:**
   - **Frontend:** http://localhost:5173
   - **Backend API:** http://localhost:8080
   - **Database:** `localhost:5432` (Credentials in `docker-compose.yml` / `.env`)

---

## 👨‍💻 Discussion Points

- **Why Go for the Backend?** Go's native concurrency model (Goroutines/Channels) makes it exceptionally well-suited for handling thousands of live WebSocket connections with a minimal memory footprint—perfect for our real-time auction engine.
- **Handling Database Concurrency:** Be ready to thoroughly explain the `SELECT FOR UPDATE` row-level lock strategy used in the database transactions when placing a bid. This is a classic solution to distributed race conditions and demonstrates strong SQL knowledge.
- **ACID System Design:** Talk about the isolation of the digital wallet hold/refund mechanism. By instantly doing a `BID_HOLD` and immediately issuing a `REFUND` to the outbid user inside an atomic transaction, we guarantee that users can never double-spend their balances across concurrent auction bids.
