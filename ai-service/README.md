# Patrika Newsroom — AI Microservice

FastAPI service that powers the platform's AI features. Ships as a working
**scaffold**: every endpoint returns structured data today, and each place that
needs a real model is marked `# >>> INTEGRATION POINT` in `main.py`.

## Endpoints
| Method | Path                   | Purpose                                  |
|--------|------------------------|------------------------------------------|
| GET    | `/`                    | Health check                             |
| POST   | `/assistant`           | Newsroom chatbot (LangChain SQL agent)   |
| POST   | `/content/quality`     | Grammar / headline / readability / risk  |
| GET    | `/trends`              | Trending topic suggestions               |
| GET    | `/production/predict`  | Page-delay prediction                    |
| POST   | `/ocr`                 | E-paper OCR (Tesseract)                  |
| POST   | `/transcribe`          | Hindi speech-to-text (Whisper)           |

## Run locally
```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # add your OPENAI_API_KEY
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

The PHP backend talks to this service via `AI_SERVICE_URL` in `backend/.env`
(default `http://localhost:8001`).

## Going to production
1. Uncomment the AI libraries in `requirements.txt`.
2. For OCR install the system package: `apt-get install tesseract-ocr tesseract-ocr-hin`.
3. Replace each `# >>> INTEGRATION POINT` block with the real model call.
