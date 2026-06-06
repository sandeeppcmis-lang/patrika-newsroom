<?php
namespace App\Core;

class Router {
    private $routes = [];

    public function add(string $method, string $pattern, callable $handler): void {
        $this->routes[] = [$method, $pattern, $handler];
    }
    public function get($p, $h)  { $this->add('GET', $p, $h); }
    public function post($p, $h) { $this->add('POST', $p, $h); }

    public function dispatch(string $method, string $uri): void {
        $fullPath = '/' . trim(parse_url($uri, PHP_URL_PATH), '/');

        // Strip the base directory prefix (handles subdirectory installs like /patrika-newsroom/api).
        // SCRIPT_NAME is e.g. /patrika-newsroom/api/index.php → base = /patrika-newsroom/api
        $base = rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? ''), '/');
        if ($base !== '' && strpos($fullPath, $base) === 0) {
            $path = substr($fullPath, strlen($base)) ?: '/';
        } else {
            // Fallback: strip any /api prefix for simple setups
            $path = preg_replace('#^/api#', '', $fullPath) ?: '/';
        }
        $path = '/' . trim($path, '/') ?: '/';
        if ($method === 'OPTIONS') { http_response_code(204); exit; }

        foreach ($this->routes as [$m, $pattern, $handler]) {
            $regex = '#^' . preg_replace('#\{(\w+)\}#', '(?P<$1>[^/]+)', $pattern) . '$#';
            if ($m === $method && preg_match($regex, $path, $params)) {
                $args = array_filter($params, 'is_string', ARRAY_FILTER_USE_KEY);
                $handler($args);
                return;
            }
        }
        Response::error('Not found: ' . $path, 404);
    }
}
