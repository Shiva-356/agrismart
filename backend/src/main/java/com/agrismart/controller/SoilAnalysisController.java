package com.agrismart.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;

/**
 * Proxies validated soil photograph uploads to the AgriSmart Python ML service
 * ({@code POST /predict/soil}). Never fabricates soil labels or chemical lab values
 * when the ML service is unavailable.
 */
@RestController
@RequestMapping("/api/soil-analysis")
public class SoilAnalysisController {

    private static final Logger log = LoggerFactory.getLogger(SoilAnalysisController.class);
    private static final long MAX_IMAGE_BYTES = 10L * 1024L * 1024L;

    private final String mlApiUrl;
    private final HttpClient httpClient;
    private final Duration readTimeout;

    public SoilAnalysisController(
            @Value("${agrismart.ml.api-url:}") String mlApiUrl,
            @Value("${agrismart.ml.connect-timeout-seconds:3}") int connectTimeoutSeconds,
            @Value("${agrismart.ml.read-timeout-seconds:10}") int readTimeoutSeconds
    ) {
        this.mlApiUrl = mlApiUrl == null ? "" : mlApiUrl.trim();
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(Math.max(1, connectTimeoutSeconds)))
                .build();
        this.readTimeout = Duration.ofSeconds(Math.max(2, readTimeoutSeconds));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> analyzeSoilImage(
            @RequestParam(value = "image", required = false) MultipartFile image,
            @RequestParam(value = "file", required = false) MultipartFile fallbackFile
    ) {
        MultipartFile target = image != null ? image : fallbackFile;
        if (target == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                    "error", "Missing image file. Attach a JPEG or PNG photograph in the 'image' field.",
                    "errorCode", "MISSING_IMAGE_FILE"
            ));
        }

        if (target.isEmpty() || target.getSize() == 0) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                    "error", "Uploaded image file is empty (0 bytes).",
                    "errorCode", "EMPTY_IMAGE"
            ));
        }

        if (target.getSize() > MAX_IMAGE_BYTES) {
            return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(Map.of(
                    "error", "Image exceeds the 10 MB upload limit.",
                    "errorCode", "IMAGE_TOO_LARGE"
            ));
        }

        final byte[] bytes;
        try {
            bytes = target.getBytes();
        } catch (IOException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                    "error", "Unable to read uploaded image stream.",
                    "errorCode", "CORRUPT_IMAGE"
            ));
        }

        String detectedMime = detectSupportedMime(bytes);
        if (detectedMime == null) {
            return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).body(Map.of(
                    "error", "Unsupported image format. Upload a valid JPEG (.jpg/.jpeg) or PNG (.png) soil photograph.",
                    "errorCode", "UNSUPPORTED_IMAGE_FORMAT"
            ));
        }

        if (mlApiUrl.isEmpty()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                    "error", "Soil classification ML service URL (AGRISMART_ML_API_URL) is not configured.",
                    "errorCode", "SOIL_ML_SERVICE_UNAVAILABLE"
            ));
        }

        String boundary = "----AgriSmartSoilBoundary" + UUID.randomUUID().toString().replace("-", "");
        String safeFilename = target.getOriginalFilename() != null && !target.getOriginalFilename().isBlank()
                ? target.getOriginalFilename().replaceAll("[^a-zA-Z0-9._-]", "_")
                : (detectedMime.equals("image/png") ? "soil.png" : "soil.jpg");

        try {
            byte[] multipartBody = buildMultipartBody(boundary, safeFilename, detectedMime, bytes);
            String endpoint = mlApiUrl.replaceAll("/+$", "") + "/predict/soil";

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint))
                    .timeout(readTimeout)
                    .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                    .POST(HttpRequest.BodyPublishers.ofByteArray(multipartBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            return ResponseEntity.status(response.statusCode())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(response.body());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                    "error", "Soil classification request interrupted.",
                    "errorCode", "SOIL_ML_SERVICE_UNAVAILABLE"
            ));
        } catch (Exception ex) {
            log.warn("Failed to reach soil ML service at {}: {}", mlApiUrl, ex.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                    "error", "Soil classification ML service is unreachable.",
                    "errorCode", "SOIL_ML_SERVICE_UNAVAILABLE"
            ));
        }
    }

    private static String detectSupportedMime(byte[] bytes) {
        if (bytes.length >= 3
                && (bytes[0] & 0xFF) == 0xFF
                && (bytes[1] & 0xFF) == 0xD8
                && (bytes[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        if (bytes.length >= 8
                && (bytes[0] & 0xFF) == 0x89
                && bytes[1] == 0x50
                && bytes[2] == 0x4E
                && bytes[3] == 0x47
                && bytes[4] == 0x0D
                && bytes[5] == 0x0A
                && bytes[6] == 0x1A
                && bytes[7] == 0x0A) {
            return "image/png";
        }
        return null;
    }

    private static byte[] buildMultipartBody(
            String boundary,
            String filename,
            String mimeType,
            byte[] fileBytes
    ) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream(fileBytes.length + 256);
        String header = "--" + boundary + "\r\n"
                + "Content-Disposition: form-data; name=\"image\"; filename=\"" + filename + "\"\r\n"
                + "Content-Type: " + mimeType + "\r\n\r\n";
        out.write(header.getBytes(StandardCharsets.UTF_8));
        out.write(fileBytes);
        String footer = "\r\n--" + boundary + "--\r\n";
        out.write(footer.getBytes(StandardCharsets.UTF_8));
        return out.toByteArray();
    }
}
