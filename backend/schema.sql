-- Orange City Mart - PostgreSQL Schema
-- Auto-executed by the postgres container on first boot

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          VARCHAR(255) NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    wallet_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    upi_id        VARCHAR(100),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(500) NOT NULL,
    description TEXT,
    category    VARCHAR(100),
    type        VARCHAR(10) NOT NULL CHECK (type IN ('FIXED', 'AUCTION')),
    price       NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    image_url   TEXT,
    location    VARCHAR(200) DEFAULT 'Nagpur',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auctions table
CREATE TABLE IF NOT EXISTS auctions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id          UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    start_price         NUMERIC(12, 2) NOT NULL,
    current_highest_bid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    highest_bidder_id   UUID REFERENCES users(id),
    end_time            TIMESTAMPTZ NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ENDED', 'CANCELLED')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bids table
CREATE TABLE IF NOT EXISTS bids (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount     NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount     NUMERIC(12, 2) NOT NULL,
    type       VARCHAR(20) NOT NULL CHECK (type IN ('DEPOSIT', 'WITHDRAW', 'BID_HOLD', 'REFUND', 'TRANSFER')),
    status     VARCHAR(20) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
    reference  TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bid Holds table
-- One active hold per (auction, user) at any time.
-- SOFT  = money deducted from wallet while auction is live (can be released on outbid)
-- HARD  = auction ended, winner's hold is locked until settlement
-- RELEASED = outbid / refunded; wallet already credited back
-- SETTLED  = escrow complete; money transferred to seller
CREATE TABLE IF NOT EXISTS bid_holds (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auction_id  UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount      NUMERIC(12, 2) NOT NULL,
    status      VARCHAR(10) NOT NULL DEFAULT 'SOFT'
                CHECK (status IN ('SOFT', 'HARD', 'RELEASED', 'SETTLED')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Settlements table
-- Created when an auction ends. Tracks dual-approval before money moves to seller.
CREATE TABLE IF NOT EXISTS settlements (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auction_id          UUID UNIQUE NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    winner_id           UUID NOT NULL REFERENCES users(id),
    seller_id           UUID NOT NULL REFERENCES users(id),
    amount              NUMERIC(12, 2) NOT NULL,
    winner_approved_at  TIMESTAMPTZ,
    seller_approved_at  TIMESTAMPTZ,
    status              VARCHAR(10) NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PENDING', 'COMPLETED')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages table for peer-to-peer chat
-- room_id = sorted(userA_id, userB_id) joined by "_"
-- either body OR image_url is set per message (never both null)
CREATE TABLE IF NOT EXISTS messages (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id     TEXT NOT NULL,
    sender_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body        TEXT,
    image_url   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_body_or_image CHECK (body IS NOT NULL OR image_url IS NOT NULL)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_seller_id    ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_type         ON products(type);
CREATE INDEX IF NOT EXISTS idx_products_category     ON products(category);
CREATE INDEX IF NOT EXISTS idx_auctions_product_id   ON auctions(product_id);
CREATE INDEX IF NOT EXISTS idx_auctions_status       ON auctions(status);
CREATE INDEX IF NOT EXISTS idx_auctions_end_time     ON auctions(end_time);
CREATE INDEX IF NOT EXISTS idx_bids_auction_id       ON bids(auction_id);
CREATE INDEX IF NOT EXISTS idx_bids_user_id          ON bids(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id  ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_bid_holds_auction_id  ON bid_holds(auction_id);
CREATE INDEX IF NOT EXISTS idx_bid_holds_user_id     ON bid_holds(user_id);
CREATE INDEX IF NOT EXISTS idx_bid_holds_status      ON bid_holds(status);
CREATE INDEX IF NOT EXISTS idx_settlements_auction   ON settlements(auction_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_auctions_updated_at
    BEFORE UPDATE ON auctions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bid_holds_updated_at
    BEFORE UPDATE ON bid_holds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Seed Data ────────────────────────────────────────────────────────────────
-- Password for all demo users: demo1234
-- Hash generated with bcrypt.DefaultCost

INSERT INTO users (id, name, email, password_hash, wallet_balance, upi_id) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Ravi Kumar',   'ravi@ocm.local',   '$2a$10$yfSnHRIm.17dPmMoFEHlIucPmHmZ5ANVPlbObTGTyMj.C30XxZoNe', 50000.00, 'ravi@upi'),
  ('22222222-2222-2222-2222-222222222222', 'Priya Sharma', 'priya@ocm.local',  '$2a$10$yfSnHRIm.17dPmMoFEHlIucPmHmZ5ANVPlbObTGTyMj.C30XxZoNe', 25000.00, 'priya@upi'),
  ('33333333-3333-3333-3333-333333333333', 'Amit Desai',   'amit@ocm.local',   '$2a$10$yfSnHRIm.17dPmMoFEHlIucPmHmZ5ANVPlbObTGTyMj.C30XxZoNe', 75000.00, 'amit@upi')
ON CONFLICT (email) DO NOTHING;

-- ── Products (mix of FIXED and AUCTION) ──────────────────────────────────────
INSERT INTO products (id, seller_id, title, description, category, type, price, image_url, location) VALUES
  ('aaaaaaaa-0001-0001-0001-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
   'Vintage Vespa Scooter', 'Classic 1980s Vespa in excellent condition. Original parts intact.',
   'Vehicles', 'AUCTION', 15000.00,
   'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=600&q=80', 'Dharampeth'),

  ('aaaaaaaa-0002-0002-0002-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333',
   'Sony PlayStation 5', 'PS5 with 2 controllers and 5 games. Like new condition.',
   'Electronics', 'AUCTION', 32500.00,
   'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=600&q=80', 'Sadar'),

  ('aaaaaaaa-0003-0003-0003-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
   'Fender Acoustic Guitar', 'Fender CD-60S Dreadnought acoustic. Barely played, with hardshell case.',
   'Music', 'AUCTION', 6200.00,
   'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=600&q=80', 'Civil Lines'),

  ('aaaaaaaa-0004-0004-0004-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222',
   'MacBook Pro M1 (2020)', '8GB RAM, 256GB SSD. Excellent battery life. Comes with original charger.',
   'Electronics', 'FIXED', 82000.00,
   'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&q=80', 'Sadar'),

  ('aaaaaaaa-0005-0005-0005-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333',
   'Leather Sofa 3-Seater', 'Brown genuine leather sofa in great condition. 3 years old.',
   'Furniture', 'FIXED', 22000.00,
   'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80', 'Civil Lines'),

  ('aaaaaaaa-0006-0006-0006-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
   'Nike Air Max (Size 9)', 'Red Nike Air Max 270. Worn twice. Original box included.',
   'Fashion', 'FIXED', 4500.00,
   'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80', 'Dharampeth'),

  ('aaaaaaaa-0007-0007-0007-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222',
   'Vintage Bicycle 1970s', 'Restored vintage bicycle. New gear cables, new tyres. Great for city rides.',
   'Vehicles', 'AUCTION', 8500.00,
   'https://images.unsplash.com/photo-1508789454646-bef72439f197?w=600&q=80', 'Dharampeth'),

  ('aaaaaaaa-0008-0008-0008-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333',
   'Accent Armchair Yellow', 'Modern accent armchair in mustard yellow. Barely used.',
   'Furniture', 'FIXED', 9800.00,
   'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80', 'Manish Nagar'),

  ('aaaaaaaa-0009-0009-0009-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
   'Sony WH-1000XM4 Headphones', 'Top-tier noise cancelling headphones. 30 hours battery. Includes case.',
   'Electronics', 'FIXED', 12000.00,
   'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80', 'Sadar'),

  ('aaaaaaaa-0010-0010-0010-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222',
   'Gaming Laptop RTX 4070', 'ASUS ROG Strix, i9 13th gen, 32GB RAM, 1TB SSD, RTX 4070.',
   'Electronics', 'AUCTION', 75000.00,
   'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=600&q=80', 'Sadar')
ON CONFLICT (id) DO NOTHING;

-- ── Auctions (end 48h-96h from epoch 2026-02-22 00:00 UTC) ──────────────────
INSERT INTO auctions (id, product_id, start_price, current_highest_bid, highest_bidder_id, end_time, status) VALUES
  ('bbbbbbbb-0001-0001-0001-bbbbbbbbbbbb', 'aaaaaaaa-0001-0001-0001-aaaaaaaaaaaa',
   10000.00, 15000.00, '22222222-2222-2222-2222-222222222222',
   NOW() + INTERVAL '48 hours', 'ACTIVE'),

  ('bbbbbbbb-0002-0002-0002-bbbbbbbbbbbb', 'aaaaaaaa-0002-0002-0002-aaaaaaaaaaaa',
   25000.00, 32500.00, '11111111-1111-1111-1111-111111111111',
   NOW() + INTERVAL '12 hours', 'ACTIVE'),

  ('bbbbbbbb-0003-0003-0003-bbbbbbbbbbbb', 'aaaaaaaa-0003-0003-0003-aaaaaaaaaaaa',
   4000.00,  6200.00,  '22222222-2222-2222-2222-222222222222',
   NOW() + INTERVAL '72 hours', 'ACTIVE'),

  ('bbbbbbbb-0007-0007-0007-bbbbbbbbbbbb', 'aaaaaaaa-0007-0007-0007-aaaaaaaaaaaa',
   5000.00,  8500.00,  '33333333-3333-3333-3333-333333333333',
   NOW() + INTERVAL '36 hours', 'ACTIVE'),

  ('bbbbbbbb-0010-0010-0010-bbbbbbbbbbbb', 'aaaaaaaa-0010-0010-0010-aaaaaaaaaaaa',
   60000.00, 75000.00, '11111111-1111-1111-1111-111111111111',
   NOW() + INTERVAL '24 hours', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- ── Bids (for priya@ocm.local who is the demo login user) ───────────────────
INSERT INTO bids (auction_id, user_id, amount) VALUES
  ('bbbbbbbb-0001-0001-0001-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 12000.00),
  ('bbbbbbbb-0001-0001-0001-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 15000.00),
  ('bbbbbbbb-0003-0003-0003-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 5000.00),
  ('bbbbbbbb-0003-0003-0003-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 6200.00),
  ('bbbbbbbb-0002-0002-0002-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 28000.00),
  ('bbbbbbbb-0002-0002-0002-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 32500.00)
ON CONFLICT DO NOTHING;

-- ── Wallet transactions for priya ────────────────────────────────────────────
INSERT INTO transactions (user_id, amount, type, status, reference) VALUES
  ('22222222-2222-2222-2222-222222222222', 25000.00, 'DEPOSIT',  'COMPLETED', 'UPI2026022201'),
  ('22222222-2222-2222-2222-222222222222', 15000.00, 'BID_HOLD', 'COMPLETED', 'bbbbbbbb-0001-0001-0001-bbbbbbbbbbbb'),
  ('22222222-2222-2222-2222-222222222222',  6200.00, 'BID_HOLD', 'COMPLETED', 'bbbbbbbb-0003-0003-0003-bbbbbbbbbbbb'),
  ('22222222-2222-2222-2222-222222222222',  5000.00, 'DEPOSIT',  'COMPLETED', 'UPI2026022101')
ON CONFLICT DO NOTHING;
