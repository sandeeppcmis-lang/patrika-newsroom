# Deployment Guide

This guide deploys the four parts of the platform onto a typical Linux server
(Apache/Nginx + PHP-FPM + MySQL + Python). Adjust paths to your host.

---

## 0. Prerequisites
- PHP 8.1+ with `pdo_mysql`, `curl`, `mbstring`
- MySQL 8 (or MariaDB 10.5+)
- Node 18+ (only to build the frontend; not needed at runtime)
- Python 3.10+ (for the AI service)
- A web server (Apache with `mod_rewrite`, or Nginx)

---

## 1. Database
```bash
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql
```
Create an app user (recommended):
```sql
CREATE USER 'patrika'@'localhost' IDENTIFIED BY 'CHANGE_ME';
GRANT ALL PRIVILEGES ON patrika_newsroom.* TO 'patrika'@'localhost';
FLUSH PRIVILEGES;
```
The seed creates demo user **admin / patrika123** and sample editions, employees,
legal cases and calendar events.

---

## 2. Backend (PHP REST API)
```bash
cd backend
cp .env.example .env
# edit .env -> DB_*, JWT_SECRET (set a long random string), AI_SERVICE_URL,
#              and the WhatsApp/Telegram/SMTP keys when you have them
composer install      # optional; the code runs without third-party packages
```
The web root for the API is **backend/public/**.

**Apache** — point a VirtualHost (or alias) at `backend/public`. The included
`.htaccess` rewrites all requests to `index.php` and sets CORS headers.

**Nginx** example:
```nginx
location /api/ {
    root /var/www/patrika/backend/public;
    try_files $uri /index.php$is_args$args;
}
location ~ \.php$ {
    fastcgi_pass unix:/run/php/php8.1-fpm.sock;
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME $document_root/index.php;
}
```
Test: `curl http://your-server/api/` should return a JSON status.

---

## 3. Frontend (static build)
A pre-built `frontend/dist/` is already included. To rebuild:
```bash
cd frontend
npm install
npm run build         # -> frontend/dist/
```
Serve `frontend/dist/` as static files. Two common setups:

- **Same domain (recommended):** serve `dist/` at `/` and the PHP API at `/api/`.
  The frontend calls `/api` by default, so no extra config is needed.
- **Separate domain:** set the API base when building, e.g. edit
  `frontend/src/api/client.js` `API_BASE`, or front both behind a reverse proxy.

Apache static host example (document root = `frontend/dist`): ensure SPA
fallback so deep links work:
```apache
FallbackResource /index.html
```
Nginx:
```nginx
location / {
    root /var/www/patrika/frontend/dist;
    try_files $uri /index.html;
}
```

---

## 4. AI Service (Python / FastAPI)
```bash
cd ai-service
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # add OPENAI_API_KEY when ready
uvicorn main:app --host 127.0.0.1 --port 8001
```
Run it under a process manager (systemd / supervisor) in production. Example
systemd unit:
```ini
[Unit]
Description=Patrika AI Service
After=network.target

[Service]
WorkingDirectory=/var/www/patrika/ai-service
ExecStart=/var/www/patrika/ai-service/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8001
Restart=always

[Install]
WantedBy=multi-user.target
```
Point `AI_SERVICE_URL=http://127.0.0.1:8001` in `backend/.env`.

---

## 5. Wiring the real AI + integrations
- **OpenAI / Whisper / Tesseract / LangChain:** uncomment libs in
  `ai-service/requirements.txt`, set keys in `ai-service/.env`, and replace each
  `# >>> INTEGRATION POINT` block in `ai-service/main.py`.
- **WhatsApp / Telegram / SMTP / SMS:** add credentials to `backend/.env` and
  implement the send calls where the PHP controllers note `TODO`.
- **OCR system dependency:** `apt-get install tesseract-ocr tesseract-ocr-hin`.

---

## 6. Security checklist before going live
- Set a strong, unique `JWT_SECRET`.
- Replace the demo-mode auth fallback with real users-table auth (see the
  commented block in `backend/src/Controllers/AuthController.php`).
- Restrict CORS (`.htaccess` / FastAPI `allow_origins`) to your domain.
- Serve everything over HTTPS.
- Create a least-privilege MySQL user (not root).
