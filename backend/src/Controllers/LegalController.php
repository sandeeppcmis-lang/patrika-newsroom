<?php
namespace App\Controllers;
use App\Core\{Auth, Response, Database};

class LegalController {

    // Roles that can view legal cases
    private const VIEW_ROLES = ['Admin', 'Management', 'Legal'];
    // Roles that can add / edit / delete cases
    private const EDIT_ROLES = ['Admin', 'Legal'];

    /** GET /legal — list all cases (filtered by edition if ?edition= provided) */
    public function index(): void {
        Auth::requireRole(self::VIEW_ROLES);
        try {
            $edition = $_GET['edition'] ?? '';
            if ($edition && $edition !== 'All') {
                $stmt = Database::pdo()->prepare(
                    'SELECT * FROM legal_cases WHERE edition = ? ORDER BY hearing ASC'
                );
                $stmt->execute([$edition]);
                $rows = $stmt->fetchAll();
            } else {
                $rows = Database::pdo()
                    ->query('SELECT * FROM legal_cases ORDER BY hearing ASC')
                    ->fetchAll();
            }
            Response::json($rows ?: []);
        } catch (\Throwable $e) {
            // Fallback mock data until DB is seeded
            Response::json([
                ['id'=>1,'case_no'=>'CIV/2025/118','edition'=>'Jaipur','court'=>'Rajasthan HC','party'=>'State vs Patrika','hearing'=>'2026-05-28','status'=>'Active','risk'=>'High','advocate'=>'Adv. S. Mehta','notes'=>''],
                ['id'=>2,'case_no'=>'DEF/2024/77','edition'=>'Kota','court'=>'District Court','party'=>'XYZ Builders','hearing'=>'2026-06-04','status'=>'Pending Docs','risk'=>'Medium','advocate'=>'Adv. R. Gupta','notes'=>''],
                ['id'=>3,'case_no'=>'CIV/2026/04','edition'=>'Indore','court'=>'MP HC','party'=>'ABC Trust','hearing'=>'2026-05-22','status'=>'Active','risk'=>'Low','advocate'=>'Adv. N. Iyer','notes'=>''],
            ]);
        }
    }

    /**
     * POST /legal
     * Body: { case_no, edition, court, party, advocate, hearing, status, risk, documents?, notes? }
     * Creates a new case or updates an existing one (matched by case_no).
     */
    public function saveCase(): void {
        Auth::requireRole(self::EDIT_ROLES);

        $in = json_decode(file_get_contents('php://input'), true) ?? [];

        // Validate required fields
        $required = ['case_no', 'edition', 'court', 'party', 'advocate', 'hearing', 'status', 'risk'];
        foreach ($required as $field) {
            if (empty(trim($in[$field] ?? ''))) {
                Response::error("Field '{$field}' is required", 422);
            }
        }

        $data = [
            'case_no'   => trim($in['case_no']),
            'edition'   => trim($in['edition']),
            'court'     => trim($in['court']),
            'party'     => trim($in['party']),
            'advocate'  => trim($in['advocate']),
            'hearing'   => trim($in['hearing']),
            'status'    => trim($in['status']),
            'risk'      => trim($in['risk']),
            'documents' => trim($in['documents'] ?? ''),
            'notes'     => trim($in['notes']     ?? ''),
        ];

        try {
            $pdo = Database::pdo();

            // Check if case_no already exists (edit vs create)
            $existing = $pdo->prepare('SELECT id FROM legal_cases WHERE case_no = ?');
            $existing->execute([$data['case_no']]);
            $row = $existing->fetch();

            if ($row) {
                // UPDATE existing case
                $stmt = $pdo->prepare(
                    'UPDATE legal_cases SET
                        edition=:edition, court=:court, party=:party, advocate=:advocate,
                        hearing=:hearing, status=:status, risk=:risk,
                        documents=:documents, notes=:notes
                     WHERE case_no=:case_no'
                );
            } else {
                // INSERT new case
                $stmt = $pdo->prepare(
                    'INSERT INTO legal_cases
                        (case_no, edition, court, party, advocate, hearing, status, risk, documents, notes)
                     VALUES
                        (:case_no, :edition, :court, :party, :advocate, :hearing, :status, :risk, :documents, :notes)'
                );
            }

            $stmt->execute($data);
            Response::json(['ok' => true, 'case' => $data, 'action' => $row ? 'updated' : 'created']);

        } catch (\Throwable $e) {
            Response::error('Database error: ' . $e->getMessage(), 500);
        }
    }

    /**
     * DELETE /legal/{id}
     * Deletes a case by its numeric id.
     */
    public function deleteCase(array $args): void {
        Auth::requireRole(self::EDIT_ROLES);

        $id = (int)($args['id'] ?? 0);
        if (!$id) Response::error('Invalid case ID', 422);

        try {
            $stmt = Database::pdo()->prepare('DELETE FROM legal_cases WHERE id = ?');
            $stmt->execute([$id]);
            Response::json(['ok' => true, 'deleted_id' => $id]);
        } catch (\Throwable $e) {
            Response::error('Database error: ' . $e->getMessage(), 500);
        }
    }
}
