/**
 * ══════════════════════════════════════════════════════════════════════
 *  PROFILE CARD CANVAS RENDERER — Premium Discord Profile Card
 * ══════════════════════════════════════════════════════════════════════
 *  Menggunakan @napi-rs/canvas untuk menggambar kartu profil balance
 *  secara otomatis sebagai gambar PNG cantik untuk Discord.
 * ══════════════════════════════════════════════════════════════════════
 */

const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { AttachmentBuilder } = require('discord.js');
const https = require('https');
const http = require('http');
const dbModule = require('./database');
const db = dbModule.db;

// ═══════════════════════════════════════════════
// KONFIGURASI WARNA & TEMA KEKAYAAN (WEALTH TIER)
// ═══════════════════════════════════════════════
const TIER_THEMES = {
  DIAMOND: {
    primary: '#00F0FF',
    glow: '#00F0FF',
    label: 'DIAMOND MEMBER',
    emoji: '💎',
    bg: ['#041a30', '#020d18', '#01050b'],
    cardBorder: 'rgba(0, 240, 255, 0.25)'
  },
  GOLD: {
    primary: '#F1C40F',
    glow: '#F5D76E',
    label: 'GOLD MEMBER',
    emoji: '👑',
    bg: ['#2e1f06', '#170f03', '#0c0801'],
    cardBorder: 'rgba(241, 196, 15, 0.25)'
  },
  SILVER: {
    primary: '#BDC3C7',
    glow: '#E2E8F0',
    label: 'SILVER MEMBER',
    emoji: '🥈',
    bg: ['#1c1c1f', '#0e0e10', '#070708'],
    cardBorder: 'rgba(189, 195, 199, 0.25)'
  },
  BRONZE: {
    primary: '#E67E22',
    glow: '#FFB74D',
    label: 'BRONZE MEMBER',
    emoji: '🥉',
    bg: ['#26150a', '#130a05', '#0b0603'],
    cardBorder: 'rgba(230, 126, 34, 0.25)'
  },
  STARTER: {
    primary: '#95A5A6',
    glow: '#CFD8DC',
    label: 'STARTER MEMBER',
    emoji: '🪵',
    bg: ['#18181b', '#09090b', '#040405'],
    cardBorder: 'rgba(149, 165, 166, 0.25)'
  }
};

const CARD_WIDTH = 920;
const CARD_HEIGHT = 420;

// Image cache untuk menghindari re-download avatar berulang kali
const avatarCache = new Map();

// ═══════════════════════════════════════════════
// UTILITAS RENDERING
// ═══════════════════════════════════════════════

/**
 * Load avatar user dari URL dengan caching dan error handling
 */
async function loadAvatarSafe(url) {
  if (!url) return null;
  if (avatarCache.has(url)) {
    return avatarCache.get(url);
  }

  try {
    const buffer = await downloadImage(url);
    if (!buffer) return null;

    const img = await loadImage(buffer);
    if (avatarCache.size > 100) {
      const firstKey = avatarCache.keys().next().value;
      avatarCache.delete(firstKey);
    }
    avatarCache.set(url, img);
    return img;
  } catch (e) {
    console.warn(`[ProfileCard] Gagal memuat avatar: ${url} — ${e.message}`);
    return null;
  }
}

/**
 * Download gambar dari URL sebagai Buffer
 */
function downloadImage(url) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const request = protocol.get(url, { timeout: 5000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadImage(res.headers.location).then(resolve);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return resolve(null);
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', () => resolve(null));
    });
    request.on('error', () => resolve(null));
    request.on('timeout', () => { request.destroy(); resolve(null); });
  });
}

/**
 * Gambar rounded rectangle
 */
function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Gambar avatar lingkaran dengan border + glow
 */
function drawCircleAvatar(ctx, img, cx, cy, radius, borderColor, glowColor) {
  if (glowColor) {
    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.01)';
    ctx.fill();
    ctx.restore();
  }

  // Border luar
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
  ctx.fillStyle = borderColor || '#FFD700';
  ctx.fill();

  // Border dalam (gelap)
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 1, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0a14';
  ctx.fill();

  // Draw avatar image
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.restore();
}

/**
 * Gambar badge pill-shape
 */
function drawBadge(ctx, x, y, text, bgColor, textColor = '#FFFFFF', fontSize = 11) {
  ctx.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
  const metrics = ctx.measureText(text);
  const padX = 10;
  const padY = 4;
  const width = metrics.width + padX * 2;
  const height = fontSize + padY * 2;

  drawRoundedRect(ctx, x, y, width, height, height / 2);
  ctx.fillStyle = bgColor;
  ctx.fill();

  ctx.fillStyle = textColor;
  ctx.textAlign = 'left';
  ctx.fillText(text, x + padX, y + height - padY - 1);

  return width;
}

/**
 * Draw background dengan gradient multi-stop dan partikel dekoratif
 */
function drawBackground(ctx, width, height, tierTheme) {
  const colors = tierTheme.bg;

  // Diagonal gradient
  const grad = ctx.createLinearGradient(0, 0, width, height);
  for (let i = 0; i < colors.length; i++) {
    grad.addColorStop(i / (colors.length - 1), colors[i]);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Radial glow center
  const radGlow = ctx.createRadialGradient(width * 0.35, height * 0.4, 0, width * 0.35, height * 0.4, width * 0.6);
  radGlow.addColorStop(0, `${tierTheme.primary}25`);
  radGlow.addColorStop(0.5, `${tierTheme.primary}10`);
  radGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = radGlow;
  ctx.fillRect(0, 0, width, height);

  // Subtle diagonal design lines
  ctx.globalAlpha = 0.03;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  for (let i = -height; i < width + height; i += 35) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + height, height);
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;

  // Ambient dust particles
  ctx.globalAlpha = 0.08;
  for (let i = 0; i < 25; i++) {
    const px = Math.random() * width;
    const py = Math.random() * height;
    const pr = Math.random() * 2 + 1;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fillStyle = tierTheme.primary;
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;
}

// ═══════════════════════════════════════════════
// DYNAMIC PROFILE CANVAS GENERATOR
// ═══════════════════════════════════════════════

/**
 * Generate visual dashboard balance card
 * @param {Object} user Discord User object
 * @param {Object} wallet Data dompet
 * @param {number} bankBalance Saldo bank
 * @param {number} portfolioValue Total nilai saham
 * @param {Object} extraData Data tambahan (wanted, jail, curse, dll)
 * @returns {Promise<Buffer>} PNG buffer
 */
async function generateProfileCard(user, wallet, bankBalance, portfolioValue, extraData = {}) {
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');

  const totalWealth = wallet.balance + bankBalance + portfolioValue;

  // Tentukan Wealth Tier
  const getTier = (wealth) => {
    if (wealth >= 50000) return TIER_THEMES.DIAMOND;
    if (wealth >= 20000) return TIER_THEMES.GOLD;
    if (wealth >= 10000) return TIER_THEMES.SILVER;
    if (wealth >= 5000) return TIER_THEMES.BRONZE;
    return TIER_THEMES.STARTER;
  };

  const tier = getTier(totalWealth);

  // Status flags
  const nowSec = Math.floor(Date.now() / 1000);
  const isJailed = wallet.jail_until && wallet.jail_until > nowSec;
  const isWanted = extraData.wantedUntil && extraData.wantedUntil > nowSec;
  const isCursed = extraData.curseUntil && extraData.curseUntil > nowSec;

  // 1. Background
  drawBackground(ctx, CARD_WIDTH, CARD_HEIGHT, tier);

  // 2. Glassmorphism Panel Wrapper
  const panelMargin = 15;
  drawRoundedRect(ctx, panelMargin, panelMargin, CARD_WIDTH - panelMargin * 2, CARD_HEIGHT - panelMargin * 2, 18);
  ctx.fillStyle = 'rgba(8, 8, 20, 0.76)';
  ctx.fill();

  // Glass glow outline
  const outlineGrad = ctx.createLinearGradient(panelMargin, panelMargin, CARD_WIDTH - panelMargin, CARD_HEIGHT - panelMargin);
  if (isJailed || isWanted) {
    outlineGrad.addColorStop(0, '#FF3366cc');
    outlineGrad.addColorStop(0.5, '#FF336630');
    outlineGrad.addColorStop(1, '#FF3366cc');
  } else {
    outlineGrad.addColorStop(0, `${tier.primary}60`);
    outlineGrad.addColorStop(0.5, `${tier.primary}20`);
    outlineGrad.addColorStop(1, `${tier.primary}60`);
  }
  ctx.strokeStyle = outlineGrad;
  ctx.lineWidth = 2;
  ctx.stroke();

  // 3. Left-to-Right Section Divider
  const dividerX = 235;
  ctx.beginPath();
  ctx.moveTo(dividerX, 40);
  ctx.lineTo(dividerX, CARD_HEIGHT - 40);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 4. Left Profile Column
  const avatarCX = 125;
  const avatarCY = 115;
  const avatarRadius = 64;

  // Avatar loading
  const avatarURL = user.displayAvatarURL ? user.displayAvatarURL({ extension: 'png', size: 256 }) : null;
  const avatarImg = await loadAvatarSafe(avatarURL);

  if (avatarImg) {
    drawCircleAvatar(ctx, avatarImg, avatarCX, avatarCY, avatarRadius, isJailed || isWanted ? '#FF3366' : tier.primary, tier.glow);
  } else {
    // Fallback avatar circle
    ctx.beginPath();
    ctx.arc(avatarCX, avatarCY, avatarRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#1e1e32';
    ctx.fill();
    ctx.strokeStyle = tier.primary;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = 'bold 36px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText((user.username || 'U').charAt(0).toUpperCase(), avatarCX, avatarCY + 13);
  }

  // Username
  ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  let displayName = user.username || 'User';
  if (displayName.length > 15) displayName = displayName.substring(0, 14) + '…';
  ctx.fillText(displayName, avatarCX, avatarCY + avatarRadius + 28);

  // Wealth Tier Badge
  const badgeY = avatarCY + avatarRadius + 42;
  const tierText = `${tier.emoji} ${tier.label}`;
  ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
  const badgeWidth = ctx.measureText(tierText).width + 20;
  drawBadge(ctx, avatarCX - badgeWidth / 2, badgeY, tierText, `${tier.primary}20`, tier.primary, 10);

  // Luxury Badges & Status Icons (Di bawah badge tier)
  let prestigeY = badgeY + 28;
  let ownedLuxury = [];
  try {
    const inv = db.prepare(
      "SELECT item_id FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id IN ('LAMBO', 'GOLD', 'KEY', 'ROLEX', 'IPHONE') AND quantity > 0"
    ).all(user.id, wallet.guild_id);
    ownedLuxury = inv.map(i => i.item_id);
  } catch (e) {
    console.error("Gagal kueri inventori untuk profileCard:", e.message);
  }

  if (ownedLuxury.length > 0) {
    ctx.font = 'bold 9px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.textAlign = 'center';
    ctx.fillText('LENCANA KEMEWAHAN', avatarCX, prestigeY + 8);
    prestigeY += 16;

    // Draw small luxury badge emojis in a row
    const luxuryIcons = {
      LAMBO: '🏎️',
      GOLD: '👑',
      KEY: '🔑',
      ROLEX: '⌚',
      IPHONE: '📱'
    };
    const rowText = ownedLuxury.map(item => luxuryIcons[item] || '').join('  ');
    ctx.font = '20px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(rowText, avatarCX, prestigeY + 16);
  } else {
    // Info status standard if no luxury badges
    ctx.font = '11px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.textAlign = 'center';
    ctx.fillText('Akun Terdaftar', avatarCX, prestigeY + 10);

    const regDate = new Date(wallet.created_at * 1000).toLocaleDateString('id-ID', { year: 'numeric', month: 'short' });
    ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillText(regDate, avatarCX, prestigeY + 25);
  }

  // 5. Right Financial Grid Panel (x >= 255)
  const gridX = 255;
  const gridY = 85;
  const cardW = 308;
  const cardH = 88;
  const gapX = 17;
  const gapY = 16;

  // Dashboard Title
  ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = isJailed || isWanted ? '#FF3366' : tier.primary;
  ctx.textAlign = 'left';
  ctx.fillText('🏠 STATUS SALDO & KEUANGAN WARGA', gridX, 52);

  // Helper untuk menggambar kartu finansial
  const drawFinancialCard = (x, y, label, amount, icon, isTotal = false) => {
    // Card Background
    drawRoundedRect(ctx, x, y, cardW, cardH, 12);
    ctx.fillStyle = isTotal ? 'rgba(0, 0, 0, 0.55)' : 'rgba(0, 0, 0, 0.35)';
    ctx.fill();

    // Outline
    ctx.strokeStyle = isTotal
      ? (isJailed || isWanted ? '#FF336660' : `${tier.primary}50`)
      : 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Text Label
    ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = isTotal
      ? (isJailed || isWanted ? '#FF80AB' : tier.primary)
      : 'rgba(255, 255, 255, 0.45)';
    ctx.fillText(label.toUpperCase(), x + 18, y + 25);

    // Text Amount
    ctx.font = 'bold 21px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = isTotal
      ? '#FFFFFF'
      : 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(`Rp ${amount.toLocaleString('id-ID')}`, x + 18, y + 58);

    // Icon (kanan)
    ctx.font = '28px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(icon, x + cardW - 18, y + 54);
    ctx.textAlign = 'left'; // Reset alignment
  };

  // Card 1: Dompet (Wallet Balance)
  drawFinancialCard(gridX, gridY, 'Saldo Dompet', wallet.balance, '🪙');

  // Card 2: Tabungan (Bank Balance)
  drawFinancialCard(gridX + cardW + gapX, gridY, 'Tabungan Bank', bankBalance, '🏦');

  // Card 3: Saham (Stock Portfolio)
  drawFinancialCard(gridX, gridY + cardH + gapY, 'Nilai Investasi', portfolioValue, '📈');

  // Card 4: Total Kekayaan (Total Assets)
  drawFinancialCard(gridX + cardW + gapX, gridY + cardH + gapY, 'Total Aset', totalWealth, '💎', true);

  // 6. Bottom Stats Row (x >= 255)
  const statsY = 308;
  const colW = 210;

  // Divider line above bottom stats
  ctx.beginPath();
  ctx.moveTo(gridX, statsY - 12);
  ctx.lineTo(CARD_WIDTH - 30, statsY - 12);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1;
  ctx.stroke();

  const drawMiniStat = (x, y, label, value, icon) => {
    ctx.font = '12px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillText(`${icon} ${label}:`, x, y);

    const offset = ctx.measureText(`${icon} ${label}: `).width;
    ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(value, x + offset, y);
  };

  // Streak Daily
  const streakStatus = wallet.streak_days >= 7 ? `${wallet.streak_days} Hari 🔥` : `${wallet.streak_days} Hari`;
  drawMiniStat(gridX, statsY + 6, 'Gaji Streak', streakStatus, '🔥');

  // Auto-Trade
  const autoTradeStatus = wallet.auto_trade === 1 ? 'Aktif 🟢' : 'Nonaktif 🔴';
  drawMiniStat(gridX + colW, statsY + 6, 'Auto-Trade', autoTradeStatus, '🤖');

  // Jail Counts
  drawMiniStat(gridX + colW * 2, statsY + 6, 'Masuk Sel', `${wallet.jail_count || 0} Kali`, '👮');

  // 7. Status Warnings Banner (JAILED / WANTED / CURSED)
  if (isJailed || isWanted || isCursed) {
    const bannerY = statsY + 25;
    const bannerW = CARD_WIDTH - gridX - 30; // 635px
    const bannerH = 36;

    drawRoundedRect(ctx, gridX, bannerY, bannerW, bannerH, 8);
    ctx.fillStyle = 'rgba(255, 51, 102, 0.15)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 51, 102, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    let bannerText = '';
    if (isJailed) {
      const remainingSec = wallet.jail_until - nowSec;
      const mins = Math.ceil(remainingSec / 60);
      bannerText = `🚨 DI DALAM PENJARA: Anda ditahan! Bebas dalam ${mins} menit lagi.`;
    } else if (isWanted) {
      const remainingSec = extraData.wantedUntil - nowSec;
      const mins = Math.ceil(remainingSec / 60);
      bannerText = `🚔 STATUS WANTED: Anda buron! Masa pengejaran sisa ${mins} menit lagi.`;
    } else if (isCursed) {
      const remainingSec = extraData.curseUntil - nowSec;
      const mins = Math.ceil(remainingSec / 60);
      bannerText = `💀 TERKUTUK (${extraData.curseType}): Status terkena efek kutukan ${mins} menit.`;
    }

    ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#FF4D79';
    ctx.textAlign = 'center';
    ctx.fillText(bannerText, gridX + bannerW / 2, bannerY + 22);
  } else {
    // Footer Watermark inside the panel
    const watermarkY = statsY + 36;
    ctx.font = '10px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.textAlign = 'right';
    ctx.fillText('Kosan 1A Economy · Profile Dashboard', CARD_WIDTH - 30, watermarkY);
  }

  return canvas.toBuffer('image/png');
}

/**
 * Generate profile card dan kembalikan sebagai Discord AttachmentBuilder
 */
async function getProfileCardAttachment(user, wallet, bankBalance, portfolioValue, extraData = {}) {
  try {
    const buffer = await generateProfileCard(user, wallet, bankBalance, portfolioValue, extraData);
    return new AttachmentBuilder(buffer, { name: 'profile_card.png' });
  } catch (e) {
    console.error('[ProfileCard] Error generating profile card:', e);
    return null;
  }
}

module.exports = {
  TIER_THEMES,
  generateProfileCard,
  getProfileCardAttachment
};
