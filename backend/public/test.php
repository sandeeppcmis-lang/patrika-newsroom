<?php
// ============================================================
// Patrika Newsroom — Server Diagnostic Script
// Upload this to: backend/public/test.php
// Visit: https://editorialreview.patrika.com/patrika-newsroom/backend/public/test.php
// DELETE this file after debugging is done.
// ============================================================
header('Content-Type: text/html; charset=utf-8');
?><!DOCTYPE html>
<html>
<head>
<title>Patrika API Diagnostics</title>
<style>
  body { font-family: monospace; background: #0f172a; color: #e2e8f0; padding: 2rem; }
  h2   { color: #f59e0b; border-bottom: 1px solid #334155; padding-bottom: .5rem; }
  .ok  { color: #4ade80; } .fail { color: #f87171; } .warn { color: #fbbf24; }
  .box { background: #1e293b; padding: 1rem; border-radius: 6px; margin: .5rem 0; }
  table { border-collapse: collapse; width: 100%; }
  td,th { padding: .4rem .8rem; border: 1px solid #334155; text-align: left; }
  th { background: #1e293b; }
</style>
</head>
<body>

<h1 style="color:#c9a227">🔬 Patrika Newsroom — Diagnostics</h1>

<?php

// ── 1. PHP Version ────────────────────────────────────────────
echo '<h2>1. PHP Environment</h2><div class="box"><table>';
$phpOk = version_compare(PHP_VERSION, '7.3', '>=');
echo '<tr><th>PHP Version</th><td class="' . ($phpOk ? 'ok' : 'fail') . '">' . PHP_VERSION . ' ' . ($phpOk ? '✓' : '✗ Need 7.3+') . '</td></tr>';
foreach (['pdo', 'pdo_mysql', 'curl', 'mbstring', 'json'] as $ext) {
    $ok = extension_loaded($ext);
    echo '<tr><td>' . $ext . '</td><td class="' . ($ok ? 'ok' : 'fail') . '">' . ($ok ? '✓ loaded' : '✗ MISSING') . '</td></tr>';
}
echo '</table></div>';

// ── 2. .env file ─────────────────────────────────────────────
echo '<h2>2. .env File</h2><div class="box">';
$envPath = __DIR__ . '/../.env';
$envExPath = __DIR__ . '/../.env.example';
if (!file_exists($envPath)) {
    echo '<p class="fail">✗ backend/.env NOT FOUND</p>';
    if (file_exists($envExPath)) {
        echo '<p class="warn">Found .env.example — you need to copy it to .env and fill in your RDS details.</p>';
        echo '<pre style="color:#94a3b8">' . htmlspecialchars(file_get_contents($envExPath)) . '</pre>';
    }
} else {
    echo '<p class="ok">✓ backend/.env exists</p>';
    // Parse and display (mask password)
    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    echo '<table><tr><th>Key</th><th>Value</th></tr>';
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0 || strpos($line, '=') === false) continue;
        list($k, $v) = array_pad(explode('=', trim($line), 2), 2, '');
        $display = (stripos($k, 'pass') !== false || stripos($k, 'secret') !== false || stripos($k, 'token') !== false)
            ? str_repeat('*', max(4, strlen($v) - 2)) . substr($v, -2)
            : ($v ?: '<span class="warn">empty</span>');
        $missing = empty($v) ? ' class="warn"' : '';
        echo "<tr><td>$k</td><td$missing>$display</td></tr>";
    }
    echo '</table>';
}
echo '</div>';

// ── 3. Load config and try DB ────────────────────────────────
echo '<h2>3. Database Connection (RDS)</h2><div class="box">';
// Load .env manually
$env = [];
if (file_exists($envPath)) {
    foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (strpos(trim($line), '#') === 0 || strpos($line, '=') === false) continue;
        list($k, $v) = array_pad(explode('=', trim($line), 2), 2, '');
        $env[trim($k)] = trim($v);
    }
}
$host = $env['DB_HOST'] ?? '';
$name = $env['DB_NAME'] ?? '';
$user = $env['DB_USER'] ?? '';
$pass = $env['DB_PASS'] ?? '';

if (!$host || !$name || !$user) {
    echo '<p class="fail">✗ DB credentials incomplete in .env (DB_HOST, DB_NAME, DB_USER required)</p>';
} else {
    echo '<p>Attempting: <code>' . htmlspecialchars("mysql:host=$host;dbname=$name") . '</code></p>';
    try {
        $pdo = new PDO(
            "mysql:host=$host;dbname=$name;charset=utf8mb4",
            $user, $pass,
            [PDO::ATTR_TIMEOUT => 5, PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
        echo '<p class="ok">✓ Connected to RDS successfully!</p>';
        // Count rows in key tables
        echo '<table><tr><th>Table</th><th>Rows</th></tr>';
        foreach (['users','employees','editorial_plan','legal_cases','alerts','editions'] as $t) {
            try {
                $c = $pdo->query("SELECT COUNT(*) FROM `$t`")->fetchColumn();
                echo "<tr><td>$t</td><td class='ok'>$c</td></tr>";
            } catch (Exception $e) {
                echo "<tr><td>$t</td><td class='fail'>missing / error</td></tr>";
            }
        }
        echo '</table>';
    } catch (PDOException $e) {
        echo '<p class="fail">✗ DB connection failed: ' . htmlspecialchars($e->getMessage()) . '</p>';
        echo '<p class="warn">Common RDS fixes:</p><ul>
            <li>Ensure the RDS security group allows inbound MySQL (port 3306) from this server\'s IP</li>
            <li>Check DB_HOST is the full RDS endpoint (e.g. <code>xxx.rds.amazonaws.com</code>)</li>
            <li>Confirm DB_NAME matches the created database</li>
            <li>Confirm DB_USER / DB_PASS are correct</li>
        </ul>';
    }
}
echo '</div>';

// ── 4. API Route Test ────────────────────────────────────────
echo '<h2>4. API Routes (mod_rewrite)</h2><div class="box">';
$apiBase = 'https://editorialreview.patrika.com/patrika-newsroom/backend/public';
$routes = ['/api/', '/api/dashboard', '/api/hr/employees'];
foreach ($routes as $route) {
    $url = $apiBase . $route;
    $ctx = stream_context_create(['http' => ['timeout' => 5, 'ignore_errors' => true,
        'header' => 'Accept: application/json']]);
    $resp = @file_get_contents($url, false, $ctx);
    $code = isset($http_response_header[0]) ? $http_response_header[0] : 'no response';
    $ok   = strpos($code, '200') !== false;
    echo '<p class="' . ($ok ? 'ok' : 'fail') . '">' . ($ok ? '✓' : '✗') . ' GET '
        . htmlspecialchars($url) . ' → <code>' . htmlspecialchars($code) . '</code></p>';
}
echo '</div>';

// ── 5. .htaccess / mod_rewrite ───────────────────────────────
echo '<h2>5. Apache / .htaccess</h2><div class="box"><table>';
$htOk = file_exists(__DIR__ . '/.htaccess');
echo '<tr><td>backend/public/.htaccess exists</td><td class="' . ($htOk ? 'ok' : 'fail') . '">' . ($htOk ? '✓' : '✗') . '</td></tr>';
$mrOk = function_exists('apache_get_modules') && in_array('mod_rewrite', apache_get_modules());
echo '<tr><td>mod_rewrite loaded</td><td class="' . ($mrOk ? 'ok' : 'warn') . '">' . ($mrOk ? '✓' : '? (cannot detect — try a test request above)') . '</td></tr>';
$docRoot = $_SERVER['DOCUMENT_ROOT'] ?? 'unknown';
$scriptDir = dirname($_SERVER['SCRIPT_FILENAME'] ?? '');
echo '<tr><td>DOCUMENT_ROOT</td><td>' . htmlspecialchars($docRoot) . '</td></tr>';
echo '<tr><td>This script path</td><td>' . htmlspecialchars($scriptDir) . '</td></tr>';
echo '<tr><td>REQUEST_URI</td><td>' . htmlspecialchars($_SERVER['REQUEST_URI'] ?? '') . '</td></tr>';
echo '</table></div>';

echo '<p style="color:#64748b;margin-top:2rem">⚠️ Delete this file (test.php) after debugging.</p>';
?>
</body>
</html>
