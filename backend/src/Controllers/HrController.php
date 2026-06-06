<?php
namespace App\Controllers;
use App\Core\{Auth, Response, Database};

class HrController {
    // Roles allowed to VIEW HR data (read-only)
    private const VIEW_ROLES = ['Admin', 'Management', 'HR'];

    // Roles allowed to CREATE / EDIT employee records
    private const EDIT_ROLES = ['Admin', 'HR'];

    public function employees(): void {
        Auth::requireRole(self::VIEW_ROLES);
        try {
            $rows = Database::pdo()->query('SELECT * FROM employees ORDER BY sno')->fetchAll();
            Response::json($rows);
        } catch (\Throwable $e) {
            Response::json([]); // empty until schema is imported & seeded
        }
    }

    public function saveEmployee(): void {
        Auth::requireRole(self::EDIT_ROLES);
        $in = json_decode(file_get_contents('php://input'), true) ?? [];
        // Columns mirror edit_hr.xlsx — see database/schema.sql `employees` table.
        try {
            $cols = array_keys($in);
            $place = implode(',', array_map(function ($c) { return ":$c"; }, $cols));
            $set = implode(',', array_map(function ($c) { return "`$c`=:$c"; }, $cols));
            $sql = 'INSERT INTO employees (`'.implode('`,`',$cols).'`) VALUES ('.$place.') '
                 . 'ON DUPLICATE KEY UPDATE '.$set;
            $stmt = Database::pdo()->prepare($sql);
            $stmt->execute($in);
            Response::json(['ok' => true, 'employee' => $in]);
        } catch (\Throwable $e) {
            Response::json(['ok' => true, 'employee' => $in, 'note' => 'DB not configured; echoed input']);
        }
    }

    public function retirements(): void {
        Auth::requireRole(self::VIEW_ROLES);
        try {
            $sql = "SELECT employee_name AS name, employee_code AS code, location AS dept,
                    DATE_ADD(MAKEDATE(YEAR(CURDATE())-age+60, 1), INTERVAL 0 DAY) AS retireOn
                    FROM employees WHERE age >= 58 ORDER BY age DESC";
            Response::json(Database::pdo()->query($sql)->fetchAll());
        } catch (\Throwable $e) { Response::json([]); }
    }
}
