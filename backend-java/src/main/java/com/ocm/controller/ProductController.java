package com.ocm.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * GET  /api/products          – list with optional ?q= &category= &type= filters
 * GET  /api/products/{id}     – single product detail
 * POST /api/products          – create product (auth required)
 */
@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final JdbcTemplate db;

    public ProductController(JdbcTemplate db) {
        this.db = db;
    }

    // ── List ──────────────────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<?> listProducts(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String type
    ) {
        if (q != null) q = q.trim();
        if (category != null) category = category.trim();
        if (type != null) type = type.trim();

        // Explicit aliases to avoid duplicate column names for JDBC queryForList
        StringBuilder sql = new StringBuilder("""
            SELECT p.id AS product_id, p.title, p.description, p.category, p.type, p.price,
                   p.image_url, p.location, p.created_at,
                   a.id AS auction_id, a.current_highest_bid, a.end_time, a.status AS auction_status
            FROM products p
            LEFT JOIN auctions a ON a.product_id = p.id AND a.status = 'ACTIVE'
            WHERE 1=1
            """);

        List<Object> args = new ArrayList<>();

        if (q != null && !q.isBlank()) {
            sql.append(" AND LOWER(p.title) LIKE LOWER(?)");
            args.add("%" + q + "%");
        }
        if (category != null && !category.isBlank() && !category.equals("All")) {
            sql.append(" AND p.category = ?");
            args.add(category);
        }
        if (type != null && !type.isBlank() && !type.equals("All")) {
            sql.append(" AND p.type = ?");
            args.add(type);
        }
        sql.append(" ORDER BY p.created_at DESC LIMIT 50");

        List<Map<String, Object>> rows = db.queryForList(sql.toString(), args.toArray());
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            result.add(mapProductRow(row));
        }
        return ResponseEntity.ok(result);
    }

    // ── Get Single ────────────────────────────────────────────────────────────

    @GetMapping("/{id}")
    public ResponseEntity<?> getProduct(@PathVariable String id) {
        List<Map<String, Object>> rows = db.queryForList("""
            SELECT p.id AS product_id, p.seller_id, u.name AS seller_name, u.upi_id,
                   p.title, p.description, p.category,
                   p.type, p.price, p.image_url, p.location,
                   a.id AS auction_id, a.current_highest_bid,
                   a.end_time, a.status AS auction_status
            FROM products p
            JOIN users u ON u.id = p.seller_id
            LEFT JOIN auctions a ON a.product_id = p.id
            WHERE p.id = ?::uuid
            """, id);

        if (rows.isEmpty()) {
            return ResponseEntity.status(404).body("product not found");
        }
        Map<String, Object> row = rows.get(0);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", str(row.get("product_id")));
        out.put("seller_id", str(row.get("seller_id")));
        out.put("seller_name", row.get("seller_name"));
        out.put("seller_upi_id", row.get("upi_id"));
        out.put("title", row.get("title"));
        out.put("description", row.get("description"));
        out.put("category", row.get("category"));
        out.put("type", row.get("type"));
        out.put("price", row.get("price"));
        out.put("image_url", row.get("image_url"));
        out.put("location", row.get("location"));
        out.put("auction_id", row.get("auction_id") != null ? str(row.get("auction_id")) : null);
        out.put("current_bid", row.get("current_highest_bid"));
        out.put("end_time", formatTs(row.get("end_time")));
        out.put("auction_status", row.get("auction_status"));
        return ResponseEntity.ok(out);
    }

    // ── Create Product ────────────────────────────────────────────────────────

    record CreateProductRequest(
        String title, String description, String category,
        String type, Double price, Double start_price, String image_url,
        String location, String end_time
    ) {}

    @PostMapping
    public ResponseEntity<?> createProduct(
            @RequestBody CreateProductRequest req,
            Authentication auth
    ) {
        if (auth == null) return ResponseEntity.status(401).body("unauthorized");
        String sellerId = (String) auth.getPrincipal();

        boolean isAuction = "AUCTION".equals(req.type());
        Double effectivePrice = isAuction ? req.start_price() : req.price();

        if (req.title() == null || req.type() == null || effectivePrice == null) {
            return ResponseEntity.badRequest().body("title, type and price/start_price are required");
        }

        try {
            Map<String, Object> product = db.queryForMap("""
                INSERT INTO products (seller_id, title, description, category, type, price, image_url, location)
                VALUES (?::uuid, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id, title, type, price
                """,
                sellerId, req.title(), req.description(), req.category(),
                req.type(), effectivePrice, req.image_url(),
                req.location() != null ? req.location() : "Nagpur"
            );

            if (isAuction && req.end_time() != null) {
                db.update("""
                    INSERT INTO auctions (product_id, start_price, end_time)
                    VALUES (?::uuid, ?, ?::timestamptz)
                    """,
                    str(product.get("id")), effectivePrice, req.end_time()
                );
            }

            return ResponseEntity.status(201).body(Map.of(
                "id", str(product.get("id")),
                "title", product.get("title"),
                "type", product.get("type"),
                "price", product.get("price")
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("database error: " + e.getMessage());
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Map<String, Object> mapProductRow(Map<String, Object> row) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", str(row.get("product_id")));
        out.put("title", row.get("title"));
        out.put("description", row.get("description"));
        out.put("category", row.get("category"));
        out.put("type", row.get("type"));
        out.put("price", row.get("price"));
        out.put("image_url", row.get("image_url"));
        out.put("location", row.get("location"));
        out.put("created_at", formatTs(row.get("created_at")));
        out.put("auction_id", row.get("auction_id") != null ? str(row.get("auction_id")) : null);
        out.put("current_bid", row.get("current_highest_bid"));
        out.put("end_time", formatTs(row.get("end_time")));
        out.put("auction_status", row.get("auction_status"));
        return out;
    }

    static String str(Object o) {
        return o == null ? null : o.toString();
    }

    static String formatTs(Object ts) {
        if (ts == null) return null;
        if (ts instanceof java.time.OffsetDateTime odt) {
            return odt.toInstant().toString();
        }
        return ts.toString();
    }
}
