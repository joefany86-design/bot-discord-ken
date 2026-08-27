#!/bin/bash
echo "=== Memulai Deploy bot-discord-2026 ke VPS AWS ==="

# Pindah ke direktori script
cd "$(dirname "$0")" || exit 1

# Dorong perubahan lokal ke GitHub jika ada yang belum didorong
echo "-> Memastikan perubahan lokal terdorong ke GitHub..."
git push origin main

# Jalankan update dan reload di VPS via SSH
echo "-> Menghubungkan ke VPS AWS (47.130.4.227) untuk deploy..."
ssh -i /Users/joefany/Downloads/AWS/Joefanycah86.pem ubuntu@47.130.4.227 "cd /home/ubuntu/bot-discord-2026 && \
                       echo '-> [VPS] Mengambil update dari GitHub...' && \
                       git reset --hard && \
                       git pull origin main && \
                       echo '-> [VPS] Menulis flag deploy...' && \
                       git log -1 --pretty=format:'{\"commit\":\"%h\",\"message\":\"%s\",\"author\":\"%an\"}' > deploy_flag.json && \
                       echo '-> [VPS] Menginstall dependencies...' && \
                       npm install --production && \
                       echo '-> [VPS] Mereload PM2...' && \
                       pm2 reload ecosystem.config.js --update-env || pm2 start ecosystem.config.js --update-env"

echo "=== Deploy ke VPS AWS Selesai! ==="

