#!/bin/bash
echo "=== Memulai Deploy bot-discord-2026 ==="

# Ambil update terbaru dari Git
git pull origin main

# Install dependency baru jika ada
npm install --production

# Reload bot menggunakan PM2 (tanpa downtime)
pm2 reload ecosystem.config.js --env production

echo "=== Deploy bot-discord-2026 Selesai! ==="
