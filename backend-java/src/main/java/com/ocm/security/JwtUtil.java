package com.ocm.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * Thin wrapper around JJWT 0.12 for HS256 token sign / verify.
 * Mirrors the Go signJWT() / middleware.RequireAuth behaviour.
 */
@Component
public class JwtUtil {

    private final SecretKey key;
    private final long expiryHours;

    public JwtUtil(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.expiry-hours:24}") long expiryHours
    ) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expiryHours = expiryHours;
    }

    /** Sign a new JWT whose 'sub' claim is the user UUID. */
    public String signToken(String userId) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .subject(userId)
                .issuedAt(new Date(now))
                .expiration(new Date(now + expiryHours * 3_600_000L))
                .signWith(key)
                .compact();
    }

    /**
     * Parse the token and return the subject (user UUID).
     * Returns null if the token is invalid or expired.
     */
    public String getUserId(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return claims.getSubject();
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }
}
