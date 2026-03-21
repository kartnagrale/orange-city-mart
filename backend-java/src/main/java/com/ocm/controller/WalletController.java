package com.ocm.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * GET  /api/wallet              – balance + last 50 transactions
 * POST /api/wallet/deposit      – add funds
 * POST /api/wallet/withdraw     – withdraw funds
 */
@RestController
@RequestMapping("/api/wallet")
public class WalletController {

    private final JdbcTemplate db;

    public WalletController(JdbcTemplate db) {
        this.db = db;
    }

    // ── Get Wallet ────────────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<?> getWallet(Authentication auth) {
        if (auth == null) return ResponseEntity.status(401).body("unauthorized");
        String userId = (String) auth.getPrincipal();

        List<Map<String, Object>> balRows = db.queryForList(
            "SELECT wallet_balance FROM users WHERE id = ?::uuid", userId
        );
        if (balRows.isEmpty()) return ResponseEntity.status(404).body("user not found");

        Object balance = balRows.get(0).get("wallet_balance");

        List<Map<String, Object>> txRows = db.queryForList("""
            SELECT id, amount, type, status, reference, created_at
            FROM transactions WHERE user_id = ?::uuid
            ORDER BY created_at DESC LIMIT 50
            """, userId);

        List<Map<String, Object>> txns = new ArrayList<>();
        for (Map<String, Object> row : txRows) {
            Map<String, Object> t = new LinkedHashMap<>();
            t.put("id", row.get("id").toString());
            t.put("amount", row.get("amount"));
            t.put("type", row.get("type"));
            t.put("status", row.get("status"));
            t.put("reference", row.get("reference"));
            t.put("created_at", ProductController.formatTs(row.get("created_at")));
            txns.add(t);
        }

        return ResponseEntity.ok(Map.of("balance", balance, "transactions", txns));
    }

    // ── Deposit ───────────────────────────────────────────────────────────────

    record DepositRequest(double amount, String upi_ref) {}

    @PostMapping("/deposit")
    @Transactional
    public ResponseEntity<?> deposit(@RequestBody DepositRequest req, Authentication auth) {
        if (auth == null) return ResponseEntity.status(401).body("unauthorized");
        if (req.amount() <= 0) return ResponseEntity.badRequest().body("invalid request body");
        String userId = (String) auth.getPrincipal();

        String ref = (req.upi_ref() != null && !req.upi_ref().isBlank())
            ? req.upi_ref()
            : "FE" + System.currentTimeMillis();

        // Idempotency check
        Integer count = db.queryForObject(
            "SELECT COUNT(*) FROM transactions WHERE reference = ? AND type = 'DEPOSIT'",
            Integer.class, ref
        );
        if (count != null && count > 0) {
            return ResponseEntity.status(409).body("duplicate transaction");
        }

        db.update("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?::uuid",
            req.amount(), userId);
        db.update("""
            INSERT INTO transactions (user_id, amount, type, status, reference)
            VALUES (?::uuid, ?, 'DEPOSIT', 'COMPLETED', ?)
            """, userId, req.amount(), ref);

        Object newBalance = db.queryForObject(
            "SELECT wallet_balance FROM users WHERE id = ?::uuid", Object.class, userId);

        return ResponseEntity.ok(Map.of("success", true, "new_balance", newBalance));
    }

    // ── Withdraw ──────────────────────────────────────────────────────────────

    record WithdrawRequest(double amount, String upi_id) {}

    @PostMapping("/withdraw")
    @Transactional
    public ResponseEntity<?> withdraw(@RequestBody WithdrawRequest req, Authentication auth) {
        if (auth == null) return ResponseEntity.status(401).body("unauthorized");
        if (req.amount() <= 0) return ResponseEntity.badRequest().body("invalid request body");
        String userId = (String) auth.getPrincipal();

        List<Map<String, Object>> rows = db.queryForList(
            "SELECT wallet_balance FROM users WHERE id = ?::uuid FOR UPDATE", userId);
        if (rows.isEmpty()) return ResponseEntity.status(404).body("user not found");

        double balance = ((Number) rows.get(0).get("wallet_balance")).doubleValue();
        if (balance < req.amount()) {
            return ResponseEntity.status(402).body("insufficient balance");
        }

        db.update("UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?::uuid",
            req.amount(), userId);
        db.update("""
            INSERT INTO transactions (user_id, amount, type, status, reference)
            VALUES (?::uuid, ?, 'WITHDRAW', 'COMPLETED', ?)
            """, userId, req.amount(), req.upi_id());

        Object newBalance = db.queryForObject(
            "SELECT wallet_balance FROM users WHERE id = ?::uuid", Object.class, userId);

        return ResponseEntity.ok(Map.of("success", true, "new_balance", newBalance));
    }
}
