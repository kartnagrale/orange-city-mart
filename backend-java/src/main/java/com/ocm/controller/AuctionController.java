package com.ocm.controller;

import com.ocm.websocket.Hub;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * GET  /api/auctions/{id}          – auction detail (with lazy-end transition)
 * GET  /api/auctions/{id}/bids     – last 20 bids with masked names
 * POST /api/auctions/{id}/bid      – place bid (soft-block wallet flow)
 * POST /api/auctions/{id}/settle   – winner/seller approve settlement
 */
@RestController
@RequestMapping("/api/auctions")
public class AuctionController {

    private final JdbcTemplate db;
    private final Hub hub;

    public AuctionController(JdbcTemplate db, Hub hub) {
        this.db = db;
        this.hub = hub;
    }

    // ── Get Auction ───────────────────────────────────────────────────────────

    @GetMapping("/{id}")
    public ResponseEntity<?> getAuction(@PathVariable String id) {
        // Lazy transition (best-effort)
        try { endAuctionIfExpired(id); } catch (Exception ignored) {}

        List<Map<String, Object>> rows = db.queryForList("""
            SELECT a.id, a.product_id, p.title, p.description, p.image_url,
                   p.seller_id, u.name AS seller_name,
                   a.start_price, a.current_highest_bid, a.highest_bidder_id,
                   a.end_time, a.status,
                   s.winner_approved_at, s.seller_approved_at, s.status AS settlement_status
            FROM auctions a
            JOIN products p ON p.id = a.product_id
            JOIN users u ON u.id = p.seller_id
            LEFT JOIN settlements s ON s.auction_id = a.id
            WHERE a.id = ?::uuid
            """, id);

        if (rows.isEmpty()) return ResponseEntity.status(404).body("auction not found");
        Map<String, Object> row = rows.get(0);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", s(row.get("id")));
        out.put("product_id", s(row.get("product_id")));
        out.put("title", row.get("title"));
        out.put("description", row.get("description"));
        out.put("image_url", row.get("image_url"));
        out.put("seller_id", s(row.get("seller_id")));
        out.put("seller_name", row.get("seller_name"));
        out.put("start_price", row.get("start_price"));
        out.put("current_highest_bid", row.get("current_highest_bid"));
        out.put("highest_bidder_id", row.get("highest_bidder_id") != null ? s(row.get("highest_bidder_id")) : null);
        out.put("end_time", ProductController.formatTs(row.get("end_time")));
        out.put("status", row.get("status"));
        out.put("winner_approved_at", ProductController.formatTs(row.get("winner_approved_at")));
        out.put("seller_approved_at", ProductController.formatTs(row.get("seller_approved_at")));
        out.put("settlement_status", row.get("settlement_status"));
        return ResponseEntity.ok(out);
    }

    // ── Get Auction Bids ──────────────────────────────────────────────────────

    @GetMapping("/{id}/bids")
    public ResponseEntity<?> getAuctionBids(@PathVariable String id) {
        List<Map<String, Object>> rows = db.queryForList("""
            SELECT b.amount, b.created_at, u.name
            FROM bids b
            JOIN users u ON u.id = b.user_id
            WHERE b.auction_id = ?::uuid
            ORDER BY b.created_at DESC
            LIMIT 20
            """, id);

        List<Map<String, Object>> bids = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String name = (String) row.get("name");
            String tag = (name != null && name.length() > 4) ? name.substring(0, 4) + "***" : name;
            Map<String, Object> b = new LinkedHashMap<>();
            b.put("amount", row.get("amount"));
            b.put("placed_at", ProductController.formatTs(row.get("created_at")));
            b.put("bidder_tag", tag);
            bids.add(b);
        }
        return ResponseEntity.ok(bids);
    }

    // ── Place Bid ─────────────────────────────────────────────────────────────

    record PlaceBidRequest(double amount) {}

    @PostMapping("/{id}/bid")
    public ResponseEntity<?> placeBid(
            @PathVariable String id,
            @RequestBody PlaceBidRequest req,
            Authentication auth
    ) {
        if (auth == null) return ResponseEntity.status(401).body("unauthorized");
        if (req.amount() <= 0) return ResponseEntity.badRequest().body("positive amount required");
        String userId = (String) auth.getPrincipal();

        // Lock auction row
        List<Map<String, Object>> aRows = db.queryForList("""
            SELECT a.current_highest_bid, a.highest_bidder_id, a.status, a.end_time, p.seller_id
            FROM auctions a
            JOIN products p ON p.id = a.product_id
            WHERE a.id = ?::uuid
            """, id);
        if (aRows.isEmpty()) return ResponseEntity.status(404).body("auction not found");

        Map<String, Object> auction = aRows.get(0);
        String sellerId = auction.get("seller_id") != null ? auction.get("seller_id").toString() : null;
        String status = (String) auction.get("status");
        OffsetDateTime endTime = toOdt(auction.get("end_time"));
        double currentHighBid = ((Number) auction.get("current_highest_bid")).doubleValue();
        Object prevHighBidderRaw = auction.get("highest_bidder_id");
        String prevHighBidder = prevHighBidderRaw != null ? prevHighBidderRaw.toString() : null;

        // Self-bid guard: seller cannot bid on their own auction
        if (userId.equals(sellerId)) {
            return ResponseEntity.status(403).body("you cannot bid on your own auction");
        }

        if (!"ACTIVE".equals(status) || OffsetDateTime.now().isAfter(endTime)) {
            return ResponseEntity.status(409).body("auction is not active");
        }
        if (req.amount() <= currentHighBid) {
            return ResponseEntity.status(409).body("bid must be greater than current highest bid");
        }

        // Lock bidder wallet
        List<Map<String, Object>> walletRows = db.queryForList(
            "SELECT wallet_balance FROM users WHERE id = ?::uuid FOR UPDATE", userId);
        if (walletRows.isEmpty()) return ResponseEntity.status(404).body("user not found");

        double bidderBalance = ((Number) walletRows.get(0).get("wallet_balance")).doubleValue();
        if (bidderBalance < req.amount()) {
            return ResponseEntity.status(402).body("insufficient wallet balance");
        }

        // Release previous highest bidder's SOFT hold
        if (prevHighBidder != null && !prevHighBidder.equals(userId)) {
            db.update("""
                UPDATE bid_holds SET status = 'RELEASED', updated_at = NOW()
                WHERE auction_id = ?::uuid AND user_id = ?::uuid AND status = 'SOFT'
                """, id, prevHighBidder);
            db.update("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?::uuid",
                currentHighBid, prevHighBidder);
            db.update("""
                INSERT INTO transactions (user_id, amount, type, status, reference)
                VALUES (?::uuid, ?, 'REFUND', 'COMPLETED', ?)
                """, prevHighBidder, currentHighBid, id);
        }

        // Deduct from new bidder wallet
        db.update("UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?::uuid",
            req.amount(), userId);
        db.update("""
            INSERT INTO transactions (user_id, amount, type, status, reference)
            VALUES (?::uuid, ?, 'BID_HOLD', 'COMPLETED', ?)
            """, userId, req.amount(), id);
        db.update("""
            INSERT INTO bid_holds (auction_id, user_id, amount, status)
            VALUES (?::uuid, ?::uuid, ?, 'SOFT')
            """, id, userId, req.amount());

        // Update auction
        db.update("""
            UPDATE auctions SET current_highest_bid = ?, highest_bidder_id = ?::uuid WHERE id = ?::uuid
            """, req.amount(), userId, id);
        db.update("INSERT INTO bids (auction_id, user_id, amount) VALUES (?::uuid, ?::uuid, ?)",
            id, userId, req.amount());

        // Broadcast via WebSocket hub (after DB commit is handled by @Transactional)
        String ts = OffsetDateTime.now().toInstant().toString();
        hub.broadcastToAuction(id, Map.of(
            "type", "broadcast_new_bid",
            "payload", Map.of(
                "auction_id", id,
                "amount", req.amount(),
                "bidder_id", userId,
                "timestamp", ts
            )
        ));

        if (prevHighBidder != null && !prevHighBidder.equals(userId)) {
            hub.sendToUser(prevHighBidder, Map.of(
                "type", "outbid_alert",
                "payload", Map.of(
                    "auction_id", id,
                    "your_bid", currentHighBid,
                    "new_high_bid", req.amount(),
                    "new_bidder", userId
                )
            ));
        }

        return ResponseEntity.ok(Map.of(
            "success", true,
            "auction_id", id,
            "new_high_bid", req.amount()
        ));
    }

    // ── Approve Settlement ────────────────────────────────────────────────────

    @PostMapping("/{id}/settle")
    public ResponseEntity<?> approveSettlement(
            @PathVariable String id,
            Authentication auth
    ) {
        if (auth == null) return ResponseEntity.status(401).body("unauthorized");
        String callerId = (String) auth.getPrincipal();

        // Lock settlement row
        List<Map<String, Object>> sRows = db.queryForList("""
            SELECT id, winner_id, seller_id, amount,
                   winner_approved_at, seller_approved_at, status
            FROM settlements WHERE auction_id = ?::uuid FOR UPDATE
            """, id);
        if (sRows.isEmpty()) {
            return ResponseEntity.status(404).body("settlement not found — auction may still be active");
        }
        Map<String, Object> s = sRows.get(0);
        String settlId = s.get("id").toString();
        String winnerId = s.get("winner_id").toString();
        String sellerId = s.get("seller_id").toString();
        double amount = ((Number) s.get("amount")).doubleValue();
        boolean winnerApproved = s.get("winner_approved_at") != null;
        boolean sellerApproved = s.get("seller_approved_at") != null;
        String settlStatus = (String) s.get("status");

        if ("COMPLETED".equals(settlStatus)) {
            return ResponseEntity.status(409).body("settlement already completed");
        }

        if (callerId.equals(winnerId)) {
            if (winnerApproved) return ResponseEntity.status(409).body("you have already approved");
            db.update("UPDATE settlements SET winner_approved_at = NOW() WHERE id = ?::uuid", settlId);
            winnerApproved = true;
        } else if (callerId.equals(sellerId)) {
            if (sellerApproved) return ResponseEntity.status(409).body("you have already approved");
            db.update("UPDATE settlements SET seller_approved_at = NOW() WHERE id = ?::uuid", settlId);
            sellerApproved = true;
        } else {
            return ResponseEntity.status(403).body("you are not a party to this settlement");
        }

        boolean bothApproved = winnerApproved && sellerApproved;
        if (bothApproved) {
            db.update("UPDATE settlements SET status = 'COMPLETED' WHERE id = ?::uuid", settlId);
            db.update("""
                UPDATE bid_holds SET status = 'SETTLED', updated_at = NOW()
                WHERE auction_id = ?::uuid AND user_id = ?::uuid AND status = 'HARD'
                """, id, winnerId);
            db.update("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?::uuid",
                amount, sellerId);
            db.update("INSERT INTO transactions (user_id, amount, type, status, reference) VALUES (?::uuid, ?, 'TRANSFER', 'COMPLETED', ?)",
                winnerId, amount, id);
            db.update("INSERT INTO transactions (user_id, amount, type, status, reference) VALUES (?::uuid, ?, 'TRANSFER', 'COMPLETED', ?)",
                sellerId, amount, id);
        }

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", true);
        resp.put("both_approved", bothApproved);
        resp.put("winner_approved", winnerApproved);
        resp.put("seller_approved", sellerApproved);
        resp.put("settlement_status", bothApproved ? "COMPLETED" : "PENDING");
        return ResponseEntity.ok(resp);
    }

    // ── Lazy End Transition ───────────────────────────────────────────────────

    public void endAuctionIfExpired(String auctionId) {
        List<Map<String, Object>> rows = db.queryForList("""
            SELECT a.status, a.end_time, a.current_highest_bid, a.highest_bidder_id,
                   p.seller_id
            FROM auctions a
            JOIN products p ON p.id = a.product_id
            WHERE a.id = ?::uuid FOR UPDATE
            """, auctionId);
        if (rows.isEmpty()) return;

        Map<String, Object> row = rows.get(0);
        String status = (String) row.get("status");
        OffsetDateTime endTime = toOdt(row.get("end_time"));

        if (!"ACTIVE".equals(status) || !OffsetDateTime.now().isAfter(endTime)) return;

        db.update("UPDATE auctions SET status = 'ENDED' WHERE id = ?::uuid", auctionId);

        Object highestBidderRaw = row.get("highest_bidder_id");
        if (highestBidderRaw == null) return;

        String highestBidderId = highestBidderRaw.toString();
        String sellerId = row.get("seller_id").toString();
        double highestBid = ((Number) row.get("current_highest_bid")).doubleValue();

        // Winner SOFT → HARD
        db.update("""
            UPDATE bid_holds SET status = 'HARD', updated_at = NOW()
            WHERE auction_id = ?::uuid AND user_id = ?::uuid AND status = 'SOFT'
            """, auctionId, highestBidderId);

        // Refund all other SOFT holds
        List<Map<String, Object>> otherHolds = db.queryForList("""
            SELECT id, user_id, amount FROM bid_holds
            WHERE auction_id = ?::uuid AND status = 'SOFT' AND user_id != ?::uuid
            """, auctionId, highestBidderId);

        for (Map<String, Object> hold : otherHolds) {
            String holdId = hold.get("id").toString();
            String hUserId = hold.get("user_id").toString();
            double hAmount = ((Number) hold.get("amount")).doubleValue();
            db.update("UPDATE bid_holds SET status = 'RELEASED', updated_at = NOW() WHERE id = ?::uuid", holdId);
            db.update("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?::uuid", hAmount, hUserId);
            db.update("INSERT INTO transactions (user_id, amount, type, status, reference) VALUES (?::uuid, ?, 'REFUND', 'COMPLETED', ?)",
                hUserId, hAmount, auctionId);
        }

        // Create settlement (idempotent)
        db.update("""
            INSERT INTO settlements (auction_id, winner_id, seller_id, amount)
            VALUES (?::uuid, ?::uuid, ?::uuid, ?)
            ON CONFLICT (auction_id) DO NOTHING
            """, auctionId, highestBidderId, sellerId, highestBid);
    }

    private String s(Object o) { return o == null ? null : o.toString(); }

    private static OffsetDateTime toOdt(Object o) {
        if (o == null) return null;
        if (o instanceof OffsetDateTime odt) return odt;
        if (o instanceof Timestamp ts) return ts.toInstant().atOffset(ZoneOffset.UTC);
        return OffsetDateTime.parse(o.toString());
    }
}
