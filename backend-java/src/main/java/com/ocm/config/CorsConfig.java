package com.ocm.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.List;

/**
 * Mirrors Go CORS logic:
 *  - If FRONTEND_URL is empty (local dev) → allow any origin.
 *  - Otherwise → restrict to known origins + FRONTEND_URL.
 */
@Configuration
public class CorsConfig {

    @Value("${app.frontend-url:}")
    private String frontendUrl;

    @Bean
    public CorsFilter corsFilter() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Accept", "Authorization", "Content-Type", "multipart/form-data", "*"));

        boolean isLocal = frontendUrl == null || frontendUrl.isBlank();
        if (isLocal) {
            config.addAllowedOriginPattern("*");
        } else {
            List<String> origins = new java.util.ArrayList<>(List.of(
                "http://localhost:5173",
                "http://frontend:5173",
                "https://kartnagrale.github.io"
            ));
            origins.add(frontendUrl);
            config.setAllowedOrigins(origins);
            config.setAllowCredentials(true);
        }

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return new CorsFilter(source);
    }
}
