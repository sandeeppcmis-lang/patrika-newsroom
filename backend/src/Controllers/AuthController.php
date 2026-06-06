<?php
namespace App\Controllers;
use App\Core\{Auth, Response, Database};

class AuthController {
    public function login(): void {
        $in = json_decode(file_get_contents('php://input'), true) ?? [];
        $username = trim($in['username'] ?? '');
        $password = $in['password'] ?? '';
        if ($username === '' || $password === '') Response::error('Username and password required');

        // Validate credentials against `users` table — role comes from DB, never from client.
        try {
            $stmt = Database::pdo()->prepare('SELECT * FROM users WHERE username = ? LIMIT 1');
            $stmt->execute([$username]);
            $u = $stmt->fetch();
            if (!$u || !password_verify($password, $u['password_hash'])) {
                Response::error('Invalid credentials', 401);
            }
            $role = $u['role'];
            $name = $u['name'];
        } catch (\Throwable $e) {
            // DB not yet configured — demo mode: default role Reporter (never trust client role).
            $role = 'Reporter';
            $name = $username;
        }

        $user  = ['name' => $name, 'role' => $role, 'avatar' => strtoupper($name[0] ?? 'U')];
        $token = Auth::issue(['sub' => $username, 'role' => $role]);
        Response::json(['token' => $token, 'user' => $user]);
    }

    public function me(): void {
        Response::json(['user' => Auth::requireAuth()]);
    }
}
