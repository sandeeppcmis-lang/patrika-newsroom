#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh  —  Patrika Newsroom: pull latest code and restart
#
# Run this on your Ubuntu server after every git push:
#   chmod +x deploy.sh     (first time only)
#   ./deploy.sh
#
# Or set up a GitHub webhook / cron to run it automatically.
# ─────────────────────────────────────────────────────────────────────────────
set -e   # exit on any error

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "▶ Deploying from $APP_DIR ..."

# 1. Pull latest code
echo "▶ Pulling latest from GitHub..."
git pull origin main

# 2. Install / update backend dependencies
echo "▶ Installing backend dependencies..."
npm install --omit=dev

# 3. Build frontend
echo "▶ Building frontend..."
cd frontend
npm install --omit=dev
npm run build
cd ..

# 4. Create logs directory if missing
mkdir -p logs

# 5. Restart (or start) PM2
echo "▶ Restarting PM2..."
if pm2 list | grep -q "patrika-newsroom"; then
  pm2 reload ecosystem.config.js --update-env
else
  pm2 start ecosystem.config.js
  pm2 save
fi

echo ""
echo "✅ Deploy complete! App running on port $(node -e "require('dotenv').config(); console.log(process.env.PORT||3000)")"
echo "   Check logs: pm2 logs patrika-newsroom"
