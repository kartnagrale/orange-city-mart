package com.ocm.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.UUID;

/**
 * POST /api/upload – accepts an image file, saves to ./uploads/, returns URL.
 * Mirrors Go handlers/upload.go.
 */
@RestController
@RequestMapping("/api")
public class UploadController {

    @Value("${app.upload.dir:./uploads}")
    private String uploadDir;

    @PostMapping("/upload")
    public ResponseEntity<?> upload(
            @RequestParam("image") MultipartFile file,
            Authentication auth
    ) {
        if (auth == null) return ResponseEntity.status(401).body("unauthorized");
        if (file.isEmpty()) return ResponseEntity.badRequest().body("no file provided");

        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            return ResponseEntity.badRequest().body("only image files are allowed");
        }

        String originalName = file.getOriginalFilename();
        String ext = "";
        if (originalName != null && originalName.contains(".")) {
            ext = originalName.substring(originalName.lastIndexOf('.'));
        }
        String filename = UUID.randomUUID() + ext;

        try {
            Path dir = Paths.get(uploadDir);
            Files.createDirectories(dir);
            Files.copy(file.getInputStream(), dir.resolve(filename));
        } catch (IOException e) {
            return ResponseEntity.internalServerError().body("failed to save file");
        }

        String url = "/uploads/" + filename;
        return ResponseEntity.ok(Map.of("url", url));
    }
}
