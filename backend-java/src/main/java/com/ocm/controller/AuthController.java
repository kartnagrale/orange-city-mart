package com.ocm.controller;

import com.ocm.security.JwtUtil;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * POST /api/auth/register
 * POST /api/auth/login
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final JdbcTemplate db;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AuthController(JdbcTemplate db, PasswordEncoder passwordEncoder, JwtUtil jwtUtil) {
        this.db = db;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    // ── Register ──────────────────────────────────────────────────────────────

    record RegisterRequest(String name, String email, String password) {}

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest req) {
        if (req.name() == null || req.email() == null || req.password() == null ||
            req.name().isBlank() || req.email().isBlank() || req.password().isBlank()) {
            return ResponseEntity.badRequest().body("name, email and password are required");
        }
        if (req.password().length() < 8) {
            return ResponseEntity.badRequest().body("password must be at least 8 characters");
        }

        String hash = passwordEncoder.encode(req.password());

        try {
            Map<String, Object> row = db.queryForMap(
                "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?) " +
                "RETURNING id, name, email, wallet_balance",
                req.name(), req.email(), hash
            );
            return ResponseEntity.status(HttpStatus.CREATED)
                .body(buildAuthResponse(row));
        } catch (DuplicateKeyException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body("email already registered");
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("database error");
        }
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    record LoginRequest(String email, String password) {}

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req) {
        if (req.email() == null || req.password() == null ||
            req.email().isBlank() || req.password().isBlank()) {
            return ResponseEntity.badRequest().body("email and password are required");
        }

        Map<String, Object> row;
        try {
            row = db.queryForMap(
                "SELECT id, name, email, wallet_balance, password_hash FROM users WHERE email = ?",
                req.email()
            );
        } catch (org.springframework.dao.EmptyResultDataAccessException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("invalid email or password");
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("database error");
        }

        String storedHash = (String) row.get("password_hash");
        if (!passwordEncoder.matches(req.password(), storedHash)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("invalid email or password");
        }

        return ResponseEntity.ok(buildAuthResponse(row));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Map<String, Object> buildAuthResponse(Map<String, Object> row) {
        String userId = row.get("id").toString();
        String token = jwtUtil.signToken(userId);

        Map<String, Object> userInfo = new LinkedHashMap<>();
        userInfo.put("id", userId);
        userInfo.put("name", row.get("name"));
        userInfo.put("email", row.get("email"));
        userInfo.put("wallet_balance", row.get("wallet_balance"));

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("token", token);
        response.put("user", userInfo);
        return response;
    }
}
