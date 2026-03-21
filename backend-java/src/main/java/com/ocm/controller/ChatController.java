package com.ocm.controller;

import com.ocm.websocket.Hub;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * GET  /api/chat/conversations                  – all rooms the caller participates in
 * GET  /api/chat/rooms/{roomId}/messages        – last 50 messages, oldest first
 * POST /api/chat/rooms/{roomId}/messages        – persist + broadcast a message
 */
@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final JdbcTemplate db;
    private final Hub hub;

    public ChatController(JdbcTemplate db, Hub hub) {
        this.db = db;
        this.hub = hub;
    }

    // ── Get Conversations ─────────────────────────────────────────────────────

    @GetMapping("/conversations")
    public ResponseEntity<?> getConversations(Authentication auth) {
        if (auth == null) return ResponseEntity.status(401).body("unauthorized");
        String callerId = (String) auth.getPrincipal();

        List<Map<String, Object>> rows = db.queryForList("""
            WITH latest AS (
                SELECT DISTINCT ON (room_id)
                       room_id, body, image_url, created_at
                FROM messages
                WHERE room_id LIKE '%' || ? || '%'
                ORDER BY room_id, created_at DESC
            )
            SELECT l.room_id, l.body, l.image_url, l.created_at,
                   u.id, u.name
            FROM latest l
            JOIN users u ON (
                u.id::text = CASE
                    WHEN split_part(l.room_id, '_', 1) = ?
                        THEN split_part(l.room_id, '_', 2)
                    ELSE split_part(l.room_id, '_', 1)
                END
            )
            ORDER BY l.created_at DESC
            """, callerId, callerId);

        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> c = new LinkedHashMap<>();
            c.put("room_id", row.get("room_id"));
            c.put("other_user_id", row.get("id").toString());
            c.put("other_name", row.get("name"));
            c.put("last_body", row.get("body"));
            c.put("last_image_url", row.get("image_url"));
            c.put("last_at", ProductController.formatTs(row.get("created_at")));
            c.put("unread_count", 0);
            result.add(c);
        }
        return ResponseEntity.ok(result);
    }

    // ── Get Messages ──────────────────────────────────────────────────────────

    @GetMapping("/rooms/{roomId}/messages")
    public ResponseEntity<?> getMessages(
            @PathVariable String roomId,
            Authentication auth
    ) {
        if (auth == null) return ResponseEntity.status(401).body("unauthorized");
        String callerId = (String) auth.getPrincipal();

        if (!roomId.contains(callerId)) {
            return ResponseEntity.status(403).body("forbidden");
        }

        List<Map<String, Object>> rows = db.queryForList("""
            SELECT m.id, m.sender_id, u.name AS sender_name,
                   m.body, m.image_url, m.created_at
            FROM (
                SELECT * FROM messages
                WHERE room_id = ?
                ORDER BY created_at DESC
                LIMIT 50
            ) m
            JOIN users u ON u.id = m.sender_id
            ORDER BY m.created_at ASC
            """, roomId);

        List<Map<String, Object>> msgs = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", row.get("id").toString());
            m.put("sender_id", row.get("sender_id").toString());
            m.put("sender_name", row.get("sender_name"));
            m.put("body", row.get("body"));
            m.put("image_url", row.get("image_url"));
            m.put("created_at", ProductController.formatTs(row.get("created_at")));
            msgs.add(m);
        }
        return ResponseEntity.ok(msgs);
    }

    // ── Send Message ──────────────────────────────────────────────────────────

    record SendMessageRequest(String body, String image_url) {}

    @PostMapping("/rooms/{roomId}/messages")
    public ResponseEntity<?> sendMessage(
            @PathVariable String roomId,
            @RequestBody SendMessageRequest req,
            Authentication auth
    ) {
        if (auth == null) return ResponseEntity.status(401).body("unauthorized");
        String callerId = (String) auth.getPrincipal();

        if (!roomId.contains(callerId)) {
            return ResponseEntity.status(403).body("forbidden");
        }
        if (req.body() == null && req.image_url() == null) {
            return ResponseEntity.badRequest().body("body or image_url required");
        }

        // Fetch sender name
        List<Map<String, Object>> nameRows = db.queryForList(
            "SELECT name FROM users WHERE id = ?::uuid", callerId);
        if (nameRows.isEmpty()) return ResponseEntity.status(404).body("user not found");
        String senderName = (String) nameRows.get(0).get("name");

        // Persist
        Map<String, Object> saved = db.queryForMap("""
            INSERT INTO messages (room_id, sender_id, body, image_url)
            VALUES (?, ?::uuid, ?, ?)
            RETURNING id, created_at
            """, roomId, callerId, req.body(), req.image_url());

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", saved.get("id").toString());
        payload.put("room_id", roomId);
        payload.put("sender_id", callerId);
        payload.put("sender_name", senderName);
        payload.put("body", req.body());
        payload.put("image_url", req.image_url());
        payload.put("created_at", ProductController.formatTs(saved.get("created_at")));

        // Broadcast
        hub.broadcastToChat(roomId, Map.of("type", "chat_message", "payload", payload));

        return ResponseEntity.status(201).body(payload);
    }
}
