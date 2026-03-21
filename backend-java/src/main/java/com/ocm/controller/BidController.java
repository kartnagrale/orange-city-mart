package com.ocm.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * GET /api/bids – authenticated user's bids enriched with auction + product info
 */
@RestController
@RequestMapping("/api/bids")
public class BidController {

    private final JdbcTemplate db;

    public BidController(JdbcTemplate db) {
        this.db = db;
    }

    @GetMapping
    public ResponseEntity<?> listMyBids(Authentication auth) {
        if (auth == null) return ResponseEntity.status(401).body("unauthorized");
        String userId = (String) auth.getPrincipal();

        List<Map<String, Object>> rows = db.queryForList("""
            SELECT
                b.id, b.amount, b.created_at,
                a.id AS auction_id, a.current_highest_bid, a.end_time, a.status AS auction_status,
                a.highest_bidder_id,
                p.id AS product_id, p.title AS product_title, p.image_url AS product_image_url
            FROM bids b
            JOIN auctions a ON a.id = b.auction_id
            JOIN products p ON p.id = a.product_id
            WHERE b.user_id = ?::uuid
            ORDER BY b.created_at DESC
            """, userId);

        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> b = new LinkedHashMap<>();
            b.put("id", row.get("id").toString());
            b.put("amount", row.get("amount"));
            b.put("placed_at", ProductController.formatTs(row.get("created_at")));
            b.put("auction_id", row.get("auction_id").toString());
            b.put("current_high_bid", row.get("current_highest_bid"));
            b.put("end_time", ProductController.formatTs(row.get("end_time")));
            b.put("auction_status", row.get("auction_status"));

            Object highestBidderIdRaw = row.get("highest_bidder_id");
            String highestBidderId = highestBidderIdRaw != null ? highestBidderIdRaw.toString() : null;
            b.put("highest_bidder_id", highestBidderId);
            b.put("product_id", row.get("product_id").toString());
            b.put("product_title", row.get("product_title"));
            b.put("product_image_url", row.get("product_image_url"));
            b.put("is_winning", highestBidderId != null && highestBidderId.equals(userId));
            result.add(b);
        }

        return ResponseEntity.ok(result);
    }
}
