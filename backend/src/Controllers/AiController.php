<?php
namespace App\Controllers;
use App\Core\Response;
class AiController {
    public function assistant(): void {
        $in = json_decode(file_get_contents('php://input'), true) ?? [];
        $q = $in['q'] ?? '';
        $url = rtrim(config('AI_SERVICE_URL', ''), '/');
        if ($url) {
            // Forward to the Python FastAPI ai-service (LangChain + OpenAI).
            $ch = curl_init("$url/assistant");
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
                CURLOPT_POSTFIELDS => json_encode(['q' => $q]),
                CURLOPT_TIMEOUT => 30,
            ]);
            $res = curl_exec($ch);
            if ($res !== false) { header('Content-Type: application/json'); echo $res; exit; }
        }
        Response::json([
            'answer' => "AI service not connected. You asked: \"$q\". Configure AI_SERVICE_URL in .env and run ai-service/.",
            'suggestions' => ['Show delayed editions today','Top front-page reporter','Low-quality content list','Legal cases for Jaipur'],
        ]);
    }
}
