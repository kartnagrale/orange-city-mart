package com.ocm.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.lang.NonNull;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.AbstractWebSocketHandler;

import java.util.Map;

/**
 * Handles individual WebSocket connections.
 *
 * Query params (same as Go):
 *   ?user_id=&auction_id=&room_id=
 *
 * Incoming frame type "chat_send" is handled inline (mirroring Go readPump).
 */
public class OcmWebSocketHandler extends AbstractWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(OcmWebSocketHandler.class);

    private final Hub hub;
    private final JdbcTemplate db;
    private final ObjectMapper objectMapper = new ObjectMapper();

    // Keep a mapping from session id → client so we can unregister on close
    private final java.util.concurrent.ConcurrentHashMap<String, WsClient> sessions = new java.util.concurrent.ConcurrentHashMap<>();

    public OcmWebSocketHandler(Hub hub, JdbcTemplate db) {
        this.hub = hub;
        this.db = db;
    }

    @Override
    public void afterConnectionEstablished(@NonNull WebSocketSession session) {
        String query = session.getUri() != null ? session.getUri().getQuery() : "";
        String userId    = getParam(query, "user_id");
        String auctionId = getParam(query, "auction_id");
        String roomId    = getParam(query, "room_id");

        WsClient client = new WsClient(userId, auctionId, roomId, session);
        sessions.put(session.getId(), client);
        hub.register(client);
        log.debug("WS connected: userId={} auctionId={} roomId={}", userId, auctionId, roomId);
    }

    @Override
    protected void handleTextMessage(@NonNull WebSocketSession session, @NonNull TextMessage message) {
        WsClient client = sessions.get(session.getId());
        if (client == null || client.getUserId() == null || client.getUserId().isBlank()) return;
        if (client.getRoomId() == null || client.getRoomId().isBlank()) return;

        try {
            JsonNode frame = objectMapper.readTree(message.getPayload());
            String type = frame.path("type").asText();
            if (!"chat_send".equals(type)) return;

            JsonNode payload = frame.path("payload");
            String body     = payload.has("body")      && !payload.get("body").isNull()      ? payload.get("body").asText()      : null;
            String imageUrl = payload.has("image_url") && !payload.get("image_url").isNull() ? payload.get("image_url").asText() : null;

            if (body == null && imageUrl == null) return;

            // Persist
            Map<String, Object> saved = db.queryForMap("""
                INSERT INTO messages (room_id, sender_id, body, image_url)
                VALUES (?, ?::uuid, ?, ?)
                RETURNING id, created_at
                """, client.getRoomId(), client.getUserId(), body, imageUrl);

            String senderName = "";
            try {
                senderName = db.queryForObject(
                    "SELECT name FROM users WHERE id = ?::uuid", String.class, client.getUserId());
            } catch (Exception ignored) {}

            Map<String, Object> chatPayload = new java.util.LinkedHashMap<>();
            chatPayload.put("id", saved.get("id").toString());
            chatPayload.put("room_id", client.getRoomId());
            chatPayload.put("sender_id", client.getUserId());
            chatPayload.put("sender_name", senderName);
            chatPayload.put("body", body);
            chatPayload.put("image_url", imageUrl);
            chatPayload.put("created_at", saved.get("created_at").toString());

            hub.broadcastToChat(client.getRoomId(), Map.of("type", "chat_message", "payload", chatPayload));

        } catch (Exception e) {
            log.warn("WS: failed to handle message from {}: {}", client.getUserId(), e.getMessage());
        }
    }

    @Override
    public void afterConnectionClosed(@NonNull WebSocketSession session, @NonNull CloseStatus status) {
        WsClient client = sessions.remove(session.getId());
        if (client != null) hub.unregister(client);
    }

    @Override
    public void handleTransportError(@NonNull WebSocketSession session, @NonNull Throwable exception) {
        log.warn("WS transport error: {}", exception.getMessage());
        afterConnectionClosed(session, CloseStatus.SERVER_ERROR);
    }

    // ── Query param helper ────────────────────────────────────────────────────

    private String getParam(String query, String name) {
        if (query == null || query.isBlank()) return "";
        for (String part : query.split("&")) {
            String[] kv = part.split("=", 2);
            if (kv.length == 2 && kv[0].equals(name)) return kv[1];
        }
        return "";
    }
}
