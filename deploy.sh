#!/bin/bash
echo "=== Memulai Deploy bot-discord-2026 ke VPS Rumahweb ==="

# Pindah ke direktori script
cd "$(dirname "$0")" || exit 1

# Dorong perubahan lokal ke GitHub jika ada yang belum didorong
echo "-> Memastikan perubahan lokal terdorong ke GitHub..."
git push origin main

# Jalankan update dan reload di VPS via SSH
echo "-> Menghubungkan ke VPS (202.10.45.104) untuk deploy..."
ssh root@202.10.45.104 "cd /root/bot-discord-2026 && \
                       echo '-> [VPS] Mengambil update dari GitHub...' && \
                       git pull origin main && \
                       echo '-> [VPS] Menulis flag deploy...' && \
                       git log -1 --pretty=format:'{\"commit\":\"%h\",\"message\":\"%s\",\"author\":\"%an\"}' > deploy_flag.json && \
                       echo '-> [VPS] Menginstall dependencies...' && \
                       npm install --production && \
                       echo '-> [VPS] Mereload PM2...' && \
                       pm2 reload ecosystem.config.js --env production"

echo "=== Deploy ke VPS Rumahweb Selesai! ==="
