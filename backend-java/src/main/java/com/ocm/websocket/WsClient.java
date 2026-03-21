package com.ocm.websocket;

import org.springframework.web.socket.WebSocketSession;

/**
 * Represents a single connected WebSocket client.
 * Mirrors the Go hub.Client struct.
 */
public class WsClient {

    private final String userId;
    private final String auctionId;
    private final String roomId;
    private final WebSocketSession session;

    public WsClient(String userId, String auctionId, String roomId, WebSocketSession session) {
        this.userId    = userId;
        this.auctionId = auctionId;
        this.roomId    = roomId;
        this.session   = session;
    }

    public String getUserId()    { return userId; }
    public String getAuctionId() { return auctionId; }
    public String getRoomId()    { return roomId; }
    public WebSocketSession getSession() { return session; }
}
