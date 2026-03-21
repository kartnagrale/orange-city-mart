package com.ocm.websocket;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Thread-safe WebSocket hub that mirrors the Go hub.Hub exactly.
 *
 * Rooms:
 *  - userIndex    : userId   → session  (for targeted messages)
 *  - auctionRooms : auctionId → sessions (broadcast new bids / outbid alerts)
 *  - chatRooms    : roomId    → sessions (peer-to-peer chat)
 */
@Component
public class Hub {

    private static final Logger log = LoggerFactory.getLogger(Hub.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    // All registered clients
    private final ConcurrentHashMap<String, WsClient> userIndex      = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, CopyOnWriteArrayList<WsClient>> auctionRooms = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, CopyOnWriteArrayList<WsClient>> chatRooms    = new ConcurrentHashMap<>();

    // ── Registration ──────────────────────────────────────────────────────────

    public void register(WsClient client) {
        if (client.getUserId() != null && !client.getUserId().isBlank()) {
            userIndex.put(client.getUserId(), client);
        }
        if (client.getAuctionId() != null && !client.getAuctionId().isBlank()) {
            auctionRooms.computeIfAbsent(client.getAuctionId(), k -> new CopyOnWriteArrayList<>())
                .add(client);
        }
        if (client.getRoomId() != null && !client.getRoomId().isBlank()) {
            chatRooms.computeIfAbsent(client.getRoomId(), k -> new CopyOnWriteArrayList<>())
                .add(client);
        }
        log.debug("Hub: registered client userId={} auctionId={} roomId={}",
            client.getUserId(), client.getAuctionId(), client.getRoomId());
    }

    public void unregister(WsClient client) {
        if (client.getUserId() != null) userIndex.remove(client.getUserId());
        removeFromRoom(auctionRooms, client.getAuctionId(), client);
        removeFromRoom(chatRooms, client.getRoomId(), client);
    }

    private void removeFromRoom(
            ConcurrentHashMap<String, CopyOnWriteArrayList<WsClient>> map,
            String key, WsClient client
    ) {
        if (key == null || key.isBlank()) return;
        CopyOnWriteArrayList<WsClient> list = map.get(key);
        if (list != null) {
            list.remove(client);
            if (list.isEmpty()) map.remove(key);
        }
    }

    // ── Broadcast helpers ─────────────────────────────────────────────────────

    /** Send to every client watching an auction room. */
    public void broadcastToAuction(String auctionId, Object payload) {
        List<WsClient> clients = auctionRooms.getOrDefault(auctionId, new CopyOnWriteArrayList<>());
        send(new ArrayList<>(clients), payload);
    }

    /** Send targeted message to a single connected user. */
    public void sendToUser(String userId, Object payload) {
        WsClient client = userIndex.get(userId);
        if (client != null) send(List.of(client), payload);
    }

    /** Send to every client in a chat room. */
    public void broadcastToChat(String roomId, Object payload) {
        List<WsClient> clients = chatRooms.getOrDefault(roomId, new CopyOnWriteArrayList<>());
        send(new ArrayList<>(clients), payload);
    }

    private void send(List<WsClient> clients, Object payload) {
        String json;
        try {
            json = objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            log.error("Hub: failed to marshal payload", e);
            return;
        }
        TextMessage msg = new TextMessage(json);
        for (WsClient c : clients) {
            WebSocketSession session = c.getSession();
            if (session != null && session.isOpen()) {
                try {
                    synchronized (session) {
                        session.sendMessage(msg);
                    }
                } catch (Exception e) {
                    log.warn("Hub: failed to send to client {}: {}", c.getUserId(), e.getMessage());
                }
            }
        }
    }
}
