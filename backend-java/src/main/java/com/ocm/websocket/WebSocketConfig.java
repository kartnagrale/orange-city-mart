package com.ocm.websocket;

import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final Hub hub;
    private final JdbcTemplate db;

    public WebSocketConfig(Hub hub, JdbcTemplate db) {
        this.hub = hub;
        this.db = db;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry
            .addHandler(new OcmWebSocketHandler(hub, db), "/ws")
            .setAllowedOriginPatterns("*");  // CORS for WS — mirroring Go's CheckOrigin: always true
    }
}
