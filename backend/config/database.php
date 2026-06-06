<?php
namespace App\Core;
use PDO;

/**
 * Multi-connection Database helper.
 *
 * Usage:
 *   Database::pdo()           → primary DB   (DB_HOST / DB_NAME / DB_USER / DB_PASS)
 *   Database::pdo('db2')      → secondary DB (DB2_HOST / DB2_NAME / DB2_USER / DB2_PASS)
 *   Database::pdo('db3')      → any extra DB (DB3_HOST / DB3_NAME / DB3_USER / DB3_PASS)
 *
 * Each connection is opened once and then reused (singleton per key).
 */
class Database {

    /** @var PDO[] */
    private static array $connections = [];

    /**
     * Get a PDO connection by name.
     *
     * @param string $name  'default' | 'db2' | 'db3' | any key you add to .env
     */
    public static function pdo(string $name = 'default'): PDO {
        if (!isset(self::$connections[$name])) {
            self::$connections[$name] = self::connect($name);
        }
        return self::$connections[$name];
    }

    // ── Private factory ───────────────────────────────────────────────────────

    private static function connect(string $name): PDO {
        // Map connection name → .env key prefix
        // 'default' → DB_HOST / DB_NAME / DB_USER / DB_PASS
        // 'db2'     → DB2_HOST / DB2_NAME / DB2_USER / DB2_PASS
        // 'db3'     → DB3_HOST / DB3_NAME / DB3_USER / DB3_PASS
        $prefix = ($name === 'default') ? 'DB' : strtoupper($name);

        $host = config("{$prefix}_HOST", 'localhost');
        $db   = config("{$prefix}_NAME", '');
        $user = config("{$prefix}_USER", 'root');
        $pass = config("{$prefix}_PASS", '');

        if (!$db) {
            throw new \RuntimeException(
                "Database '{$name}' is not configured. " .
                "Add {$prefix}_HOST, {$prefix}_NAME, {$prefix}_USER, {$prefix}_PASS to backend/.env"
            );
        }

        $dsn = "mysql:host={$host};dbname={$db};charset=utf8mb4";

        return new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_PERSISTENT         => false,
        ]);
    }

    /**
     * Run a raw SELECT on any connection and return all rows.
     * Handy for quick cross-DB reads.
     *
     * Example:
     *   $rows = Database::query('db2', 'SELECT * FROM employees WHERE dept = ?', ['Editorial']);
     */
    public static function query(string $connection, string $sql, array $params = []): array {
        $stmt = self::pdo($connection)->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }
}
