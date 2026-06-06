<?php
// Loads .env (simple parser) and exposes config().
function load_env(string $path): void {
    if (!is_file($path)) return;
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        [$k, $v] = array_pad(explode('=', $line, 2), 2, '');
        $_ENV[trim($k)] = trim($v);
    }
}
load_env(__DIR__ . '/../.env');

function config(string $key, $default = null) {
    return $_ENV[$key] ?? $default;
}
