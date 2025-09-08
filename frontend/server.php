<?php
// Simple PHP server to serve the video analysis dashboard
// Usage: php -S localhost:8080 server.php

$request_uri = $_SERVER['REQUEST_URI'];
$path = parse_url($request_uri, PHP_URL_PATH);
$file_path = __DIR__ . '/frontend' . $path;

// Handle root requests
if ($path === '/') {
    $file_path = __DIR__ . '/frontend/index.html';
}

// Handle directory requests
if (is_dir($file_path)) {
    $file_path = rtrim($file_path, '/') . '/index.html';
}

// Check if file exists
if (file_exists($file_path) && !is_dir($file_path)) {
    $extension = pathinfo($file_path, PATHINFO_EXTENSION);
    
    // Set appropriate content type
    $content_types = [
        'html' => 'text/html',
        'css' => 'text/css',
        'js' => 'application/javascript',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'svg' => 'image/svg+xml',
        'ico' => 'image/x-icon',
        'woff' => 'font/woff',
        'woff2' => 'font/woff2',
        'ttf' => 'font/ttf',
        'json' => 'application/json'
    ];
    
    if (isset($content_types[$extension])) {
        header('Content-Type: ' . $content_types[$extension]);
    }
    
    // Add CORS headers for API calls
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    
    readfile($file_path);
} else {
    // File not found, return 404
    http_response_code(404);
    echo "File not found: " . htmlspecialchars($path);
}
?>