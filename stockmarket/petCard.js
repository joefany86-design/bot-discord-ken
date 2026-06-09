/**
 * ══════════════════════════════════════════════════════════════════════
 *  PET CARD CANVAS RENDERER — Premium RPG-Style Visual Pet Profile
 * ══════════════════════════════════════════════════════════════════════
 *  Menggunakan @napi-rs/canvas untuk menggambar kartu profil pet
 *  secara otomatis sebagai gambar PNG cantik untuk Discord.
 * ══════════════════════════════════════════════════════════════════════
 */

const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const { AttachmentBuilder } = require('discord.js');
const path = require('path');
const https = require('https');
const http = require('http');

// ═══════════════════════════════════════════════
// KONFIGURASI WARNA & TEMA
// ═══════════════════════════════════════════════

const RARITY_COLORS = {
  COMMON:    { primary: '#8A95A5', glow: '#B0BEC5', label: 'COMMON',    emoji: '⚪' },
  RARE:      { primary: '#00A8FF', glow: '#4FC3F7', label: 'RARE',      emoji: '🟢' },
  EPIC:      { primary: '#7C4DFF', glow: '#B388FF', label: 'EPIC',      emoji: '🟣' },
  LEGENDARY: { primary: '#FFD700', glow: '#FFF176', label: 'LEGENDARY', emoji: '🟡' },
  MYTHIC:    { primary: '#FF3366', glow: '#FF80AB', label: 'MYTHIC',    emoji: '🔴' },
  IMMORTAL:  { primary: '#E040FB', glow: '#EA80FC', label: 'IMMORTAL',  emoji: '✨' },
};

const ELEMENT_THEMES = {
  FIRE:   { bg: ['#1a0000', '#5D0000', '#8B0000', '#CC3300', '#FF4500'], icon: '🔥', name: 'Fire' },
  WATER:  { bg: ['#000d1a', '#001a33', '#003366', '#006699', '#0099CC'], icon: '🌊', name: 'Water' },
  EARTH:  { bg: ['#0a0800', '#1B0F00', '#3E2723', '#5D4037', '#6D8B3A'], icon: '🌿', name: 'Earth' },
  DRAGON: { bg: ['#0d001a', '#1A0033', '#4A148C', '#7B1FA2', '#CE93D8'], icon: '🐉', name: 'Dragon' },
};

const STAT_BAR_COLORS = {
  hp:        { start: '#FF4444', end: '#00E676' },     // Merah → Hijau (berdasarkan %)
  hunger:    { start: '#FF8F00', end: '#FFD54F' },     // Oranye gradient
  thirst:    { start: '#0288D1', end: '#4FC3F7' },     // Biru gradient
  happiness: { start: '#E91E63', end: '#F48FB1' },     // Pink gradient
  xp:        { start: '#7C4DFF', end: '#B388FF' },     // Ungu gradient
};

const CARD_WIDTH = 920;
const CARD_HEIGHT = 420;

// Image cache untuk menghindari re-download
const imageCache = new Map();

// ═══════════════════════════════════════════════
// UTILITAS RENDERING
// ═══════════════════════════════════════════════

/**
 * Load gambar dari URL dengan caching dan error handling
 */
async function loadImageSafe(url) {
  if (!url) return null;

  // Cek cache
  if (imageCache.has(url)) {
    return imageCache.get(url);
  }

  try {
    // Download gambar sebagai buffer
    const buffer = await downloadImage(url);
    if (!buffer) return null;

    const img = await loadImage(buffer);
    // Cache (max 50 entries)
    if (imageCache.size > 50) {
      const firstKey = imageCache.keys().next().value;
      imageCache.delete(firstKey);
    }
    imageCache.set(url, img);
    return img;
  } catch (e) {
    console.warn(`[PetCard] Gagal load gambar: ${url} — ${e.message}`);
    return null;
  }
}

/**
 * Download gambar dari URL sebagai Buffer
 */
function downloadImage(url) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const request = protocol.get(url, { timeout: 8000 }, (res) => {
      // Handle redirects
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
 * Gambar progress bar dengan gradient
 */
function drawProgressBar(ctx, x, y, width, height, percentage, colorStart, colorEnd, label, valueText) {
  const pct = Math.min(1, Math.max(0, percentage));

  // Background bar (gelap)
  drawRoundedRect(ctx, x, y, width, height, height / 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fill();

  // Border halus
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Filled bar
  if (pct > 0.01) {
    const filledWidth = Math.max(height, width * pct); // Minimal setinggi radius
    ctx.save();
    drawRoundedRect(ctx, x, y, filledWidth, height, height / 2);
    ctx.clip();

    const grad = ctx.createLinearGradient(x, y, x + filledWidth, y);
    grad.addColorStop(0, colorStart);
    grad.addColorStop(1, colorEnd);
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, filledWidth, height);

    // Shine effect
    const shine = ctx.createLinearGradient(x, y, x, y + height);
    shine.addColorStop(0, 'rgba(255,255,255,0.25)');
    shine.addColorStop(0.5, 'rgba(255,255,255,0.05)');
    shine.addColorStop(1, 'rgba(255,255,255,0.15)');
    ctx.fillStyle = shine;
    ctx.fillRect(x, y, filledWidth, height);

    ctx.restore();
  }

  // Label teks (di dalam bar)
  if (label) {
    ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 8, y + height / 2 + 4);
  }

  // Value teks (di dalam bar, kanan)
  if (valueText) {
    ctx.font = '11px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.textAlign = 'right';
    ctx.fillText(valueText, x + width - 8, y + height / 2 + 4);
  }
}

/**
 * Gambar avatar lingkaran dengan border + glow
 */
function drawCircleAvatar(ctx, img, cx, cy, radius, borderColor, glowColor) {
  // Glow effect
  if (glowColor) {
    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.01)';
    ctx.fill();
    ctx.restore();
  }

  // Border
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
  ctx.fillStyle = borderColor || '#FFD700';
  ctx.fill();

  // Inner border (dark)
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 1, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1a2e';
  ctx.fill();

  // Avatar image (clipped circle)
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

  // Background pill
  drawRoundedRect(ctx, x, y, width, height, height / 2);
  ctx.fillStyle = bgColor;
  ctx.fill();

  // Text
  ctx.fillStyle = textColor;
  ctx.textAlign = 'left';
  ctx.fillText(text, x + padX, y + height - padY - 1);

  return width; // Return width untuk positioning berikutnya
}

/**
 * Gambar bintang emas
 */
function drawStars(ctx, x, y, count, size = 16) {
  for (let i = 0; i < count; i++) {
    const sx = x + i * (size + 4);
    // Star shape
    ctx.save();
    ctx.translate(sx + size / 2, y + size / 2);

    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size / 2);
    grad.addColorStop(0, '#FFFFFF');
    grad.addColorStop(0.3, '#FFD700');
    grad.addColorStop(1, '#FFA000');

    ctx.fillStyle = grad;
    ctx.beginPath();
    const spikes = 5;
    const outerRadius = size / 2;
    const innerRadius = size / 4;
    for (let j = 0; j < spikes * 2; j++) {
      const r = j % 2 === 0 ? outerRadius : innerRadius;
      const angle = (j * Math.PI) / spikes - Math.PI / 2;
      if (j === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
      else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    ctx.closePath();
    ctx.fill();

    // Glow
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();
  }
}

/**
 * Gambar background elemen dengan gradient multi-stop
 */
function drawElementBackground(ctx, width, height, element) {
  const theme = ELEMENT_THEMES[element] || ELEMENT_THEMES.EARTH;
  const colors = theme.bg;

  // Gradient utama (diagonal)
  const grad = ctx.createLinearGradient(0, 0, width, height);
  for (let i = 0; i < colors.length; i++) {
    grad.addColorStop(i / (colors.length - 1), colors[i]);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Radial glow center
  const radGlow = ctx.createRadialGradient(width * 0.35, height * 0.4, 0, width * 0.35, height * 0.4, width * 0.5);
  radGlow.addColorStop(0, `${colors[colors.length - 1]}40`);
  radGlow.addColorStop(0.5, `${colors[Math.floor(colors.length / 2)]}20`);
  radGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = radGlow;
  ctx.fillRect(0, 0, width, height);

  // Subtle particle dots
  ctx.globalAlpha = 0.08;
  for (let i = 0; i < 40; i++) {
    const px = Math.random() * width;
    const py = Math.random() * height;
    const pr = Math.random() * 3 + 1;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fillStyle = colors[colors.length - 1];
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;

  // Diagonal decorative lines
  ctx.globalAlpha = 0.04;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  for (let i = -height; i < width + height; i += 30) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + height, height);
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;
}

// ═══════════════════════════════════════════════
// GENERATOR KARTU PET PROFIL UTAMA
// ═══════════════════════════════════════════════

/**
 * Generate kartu profil pet sebagai Buffer PNG
 * @param {Object} pet - Data pet dari getPet()
 * @param {Object} ownerUser - Discord User object
 * @param {Object} options - Opsi tambahan { xpNeeded, maxHP }
 * @returns {Promise<Buffer>} PNG buffer
 */
async function generatePetCard(pet, ownerUser, options = {}) {
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');

  const element = (pet.gacha_element || 'EARTH').toUpperCase();
  const rarity = (pet.gacha_rarity || 'COMMON').toUpperCase();
  const rarityTheme = RARITY_COLORS[rarity] || RARITY_COLORS.COMMON;
  const elementTheme = ELEMENT_THEMES[element] || ELEMENT_THEMES.EARTH;
  const starCount = Math.min(5, Math.max(1, pet.star_level || 1));
  const maxHP = options.maxHP || 100;
  const xpNeeded = options.xpNeeded || (pet.level * 100);

  // ── [1] BACKGROUND ELEMEN ──
  drawElementBackground(ctx, CARD_WIDTH, CARD_HEIGHT, element);

  // ── [2] DARK PANEL OVERLAY (glassmorphism) ──
  const panelMargin = 15;
  drawRoundedRect(ctx, panelMargin, panelMargin, CARD_WIDTH - panelMargin * 2, CARD_HEIGHT - panelMargin * 2, 18);
  ctx.fillStyle = 'rgba(10, 10, 30, 0.72)';
  ctx.fill();
  // Panel border gradient
  const borderGrad = ctx.createLinearGradient(panelMargin, panelMargin, CARD_WIDTH - panelMargin, CARD_HEIGHT - panelMargin);
  borderGrad.addColorStop(0, `${rarityTheme.primary}60`);
  borderGrad.addColorStop(0.5, `${rarityTheme.primary}20`);
  borderGrad.addColorStop(1, `${rarityTheme.primary}60`);
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 2;
  ctx.stroke();

  // ── [3] SECTION DIVIDERS ──
  // Vertical divider after avatar section
  const dividerX = 225;
  ctx.beginPath();
  ctx.moveTo(dividerX, 40);
  ctx.lineTo(dividerX, CARD_HEIGHT - 40);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // ── [4] PET AVATAR SECTION (kiri) ──
  const avatarCX = 125;
  const avatarCY = 155;
  const avatarRadius = 72;

  // Coba load gambar pet
  let petImageUrl = null;
  try {
    const embeds = require('./embeds');
    petImageUrl = embeds.getPetImage(pet);
  } catch (e) { /* fallback */ }

  const petImg = petImageUrl ? await loadImageSafe(petImageUrl) : null;

  if (petImg) {
    drawCircleAvatar(ctx, petImg, avatarCX, avatarCY, avatarRadius, rarityTheme.primary, rarityTheme.glow);
  } else {
    // Fallback: solid circle dengan inisial
    ctx.save();
    ctx.shadowColor = rarityTheme.glow;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(avatarCX, avatarCY, avatarRadius + 3, 0, Math.PI * 2);
    ctx.fillStyle = rarityTheme.primary;
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(avatarCX, avatarCY, avatarRadius, 0, Math.PI * 2);
    const fallbackGrad = ctx.createRadialGradient(avatarCX, avatarCY, 0, avatarCX, avatarCY, avatarRadius);
    fallbackGrad.addColorStop(0, '#2a2a4a');
    fallbackGrad.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = fallbackGrad;
    ctx.fill();

    // Species emoji as text
    const speciesEmojis = {
      SLIME: 'S', DRAGON: 'D', CAT: 'C', GOLEM: 'G', PHOENIX: 'Ph',
      TURTLE: 'T', LEVIATHAN: 'Lv', BEHEMOTH: 'Bh', ARCHDRAGON: 'AD',
      SIREN: 'Sr', PEGASUS: 'Pg', KITSUNE: 'Kt', KIRIN: 'Kr',
      YETI: 'Y', CERBERUS: 'Cb', TYPHON: 'Ty', VALKYRIE: 'Vk',
      IFRIT: 'If', FENRIR: 'Fn', BAHAMUT: 'Bm', KRAKEN: 'Kk',
      JORMUNGANDR: 'Jm', CHRONOS: 'Ch', OUROBOROS: 'Ob',
      AZATHOTH: 'Az', YGGDRASIL: 'Yg'
    };
    const initial = speciesEmojis[pet.pet_type.toUpperCase()] || pet.pet_type.charAt(0);
    ctx.font = 'bold 40px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = rarityTheme.primary;
    ctx.textAlign = 'center';
    ctx.fillText(initial, avatarCX, avatarCY + 14);
  }

  // Status indicator dot
  const statusColors = {
    BABY: '#4FC3F7', ADULT: '#00E676', WEAK: '#FF9800',
    EGG: '#FFD700', DEAD: '#9E9E9E', ACTIVE: '#00E676'
  };
  const statusColor = statusColors[pet.status] || statusColors.ACTIVE;
  ctx.beginPath();
  ctx.arc(avatarCX + avatarRadius - 8, avatarCY + avatarRadius - 8, 10, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1a2e';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(avatarCX + avatarRadius - 8, avatarCY + avatarRadius - 8, 7, 0, Math.PI * 2);
  ctx.fillStyle = statusColor;
  ctx.fill();

  // Stars under avatar
  drawStars(ctx, avatarCX - ((starCount * 20) / 2), avatarCY + avatarRadius + 18, starCount, 14);

  // Status text under stars
  const statusLabels = {
    BABY: 'Baby', ADULT: 'Adult', WEAK: 'Lemah', EGG: 'Telur', DEAD: 'Mati', ACTIVE: 'Aktif'
  };
  ctx.font = '11px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = statusColor;
  ctx.textAlign = 'center';
  const statusKey = (pet.status || 'ACTIVE').toUpperCase();
  ctx.fillText(statusLabels[statusKey] || statusKey, avatarCX, avatarCY + avatarRadius + 52);

  // ── [5] IDENTITAS PET (tengah) ──
  const infoX = 245;
  let infoY = 48;

  // Pet Name (besar, bold)
  ctx.font = 'bold 26px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  // Truncate nama jika terlalu panjang
  let displayName = pet.pet_name || 'Unknown Pet';
  if (displayName.length > 18) displayName = displayName.substring(0, 17) + '…';
  ctx.fillText(displayName, infoX, infoY + 26);

  // Species + Level
  infoY += 38;
  ctx.font = '14px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(`${pet.pet_type} · Lv.${pet.level}`, infoX, infoY + 14);

  // Badges row
  infoY += 26;
  let badgeX = infoX;
  const maxBadgeX = 490 - 15; // 475

  const drawBadgeWithWrap = (text, bgColor, textColor = '#FFFFFF', fontSize = 10) => {
    ctx.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;
    const w = ctx.measureText(text).width + 20; // padX = 10
    if (badgeX + w > maxBadgeX) {
      infoY += 22;
      badgeX = infoX;
    }
    const realW = drawBadge(ctx, badgeX, infoY, text, bgColor, textColor, fontSize);
    badgeX += realW + 6;
  };

  // Rarity badge
  drawBadgeWithWrap(rarity, rarityTheme.primary, '#FFFFFF', 10);

  // Element badge
  drawBadgeWithWrap(element, 'rgba(255,255,255,0.15)', '#FFFFFF', 10);

  // Trait badge(s)
  if (pet.trait) {
    drawBadgeWithWrap(pet.trait.toUpperCase(), 'rgba(255,200,0,0.2)', '#FFD54F', 10);
  }

  // Second trait (gacha_trait2)
  if (pet.gacha_trait2) {
    drawBadgeWithWrap(pet.gacha_trait2.toUpperCase(), 'rgba(255,200,0,0.2)', '#FFD54F', 10);
  }

  // Accessory badge
  if (pet.accessory) {
    const accNames = { COLLAR_IRON: 'Kalung Besi', SWORD_TOY: 'Pedang Mainan', SHIELD_TOY: 'Tameng Mainan', LUCKY_AMULET: 'Jimat Keberuntungan' };
    const accName = accNames[pet.accessory] || pet.accessory;
    drawBadgeWithWrap(accName.toUpperCase(), 'rgba(100,255,200,0.15)', '#80CBC4', 10);
  }

  // ── [6] STATS BARS (kanan atas) ──
  const barX = 490;
  let barY = 48;
  const barWidth = 395;
  const barHeight = 18;
  const barGap = 6;

  // HP Bar
  const hpPct = Math.min(1, Math.max(0, pet.health / maxHP));
  const hpColorStart = hpPct > 0.5 ? '#00C853' : hpPct > 0.25 ? '#FF9800' : '#FF1744';
  const hpColorEnd = hpPct > 0.5 ? '#69F0AE' : hpPct > 0.25 ? '#FFD54F' : '#FF8A80';
  drawProgressBar(ctx, barX, barY, barWidth, barHeight, hpPct,
    hpColorStart, hpColorEnd, 'HP', `${Math.round(pet.health)}/${maxHP}`);
  barY += barHeight + barGap;

  // Hunger Bar
  const hungerPct = Math.min(1, Math.max(0, pet.hunger / 100));
  drawProgressBar(ctx, barX, barY, barWidth, barHeight, hungerPct,
    STAT_BAR_COLORS.hunger.start, STAT_BAR_COLORS.hunger.end, 'KENYANG', `${Math.round(pet.hunger)}%`);
  barY += barHeight + barGap;

  // Thirst Bar
  const thirstPct = Math.min(1, Math.max(0, pet.thirst / 100));
  drawProgressBar(ctx, barX, barY, barWidth, barHeight, thirstPct,
    STAT_BAR_COLORS.thirst.start, STAT_BAR_COLORS.thirst.end, 'HIDRASI', `${Math.round(pet.thirst)}%`);
  barY += barHeight + barGap;

  // Happiness Bar
  const happyPct = Math.min(1, Math.max(0, pet.happiness / 100));
  drawProgressBar(ctx, barX, barY, barWidth, barHeight, happyPct,
    STAT_BAR_COLORS.happiness.start, STAT_BAR_COLORS.happiness.end, 'SENANG', `${Math.round(pet.happiness)}%`);
  barY += barHeight + barGap;

  // XP Bar
  const xpPct = xpNeeded > 0 ? Math.min(1, Math.max(0, pet.xp / xpNeeded)) : 0;
  drawProgressBar(ctx, barX, barY, barWidth, barHeight, xpPct,
    STAT_BAR_COLORS.xp.start, STAT_BAR_COLORS.xp.end, 'XP', `${pet.xp}/${xpNeeded}`);

  // ── [7] COMBAT STATS GRID (bawah) ──
  const statsY = 210;
  const statsX = 245;

  // Horizontal divider
  ctx.beginPath();
  ctx.moveTo(statsX, statsY);
  ctx.lineTo(CARD_WIDTH - 30, statsY);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Stats title
  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.textAlign = 'left';
  ctx.fillText('COMBAT STATS', statsX, statsY + 18);

  // Stats grid (2 rows x 4 cols)
  const gridY1 = statsY + 30;
  const gridY2 = statsY + 62;
  const colWidth = 160;

  const drawStatItem = (x, y, label, value, color) => {
    ctx.font = '11px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.textAlign = 'left';
    ctx.fillText(label, x, y);

    ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(value, x, y + 22);
  };

  // Row 1: ATK, DEF, PvP Record
  const speciesInfo = getGachaSpecies(pet.pet_type);
  const baseAtk = (speciesInfo ? speciesInfo.baseAtk : 10) + pet.level * 5 + (pet.stat_str || 0) * 2;
  const baseDef = speciesInfo ? speciesInfo.baseDef : 0;

  drawStatItem(statsX, gridY1, 'ATK', String(baseAtk), '#FF7043');
  drawStatItem(statsX + colWidth, gridY1, 'DEF', `${baseDef}%`, '#42A5F5');
  drawStatItem(statsX + colWidth * 2, gridY1, 'PVP', `${pet.pvp_wins || 0}W / ${pet.pvp_losses || 0}L`, '#FFD54F');

  // Row 2: STR, DEX, VIT
  drawStatItem(statsX, gridY2, 'STR', String(pet.stat_str || 0), '#EF5350');
  drawStatItem(statsX + colWidth, gridY2, 'DEX', String(pet.stat_dex || 0), '#66BB6A');
  drawStatItem(statsX + colWidth * 2, gridY2, 'VIT', String(pet.stat_vit || 0), '#AB47BC');

  // ── [8] HORIZONTAL SEPARATOR ──
  const sep2Y = statsY + 94;
  ctx.beginPath();
  ctx.moveTo(statsX, sep2Y);
  ctx.lineTo(CARD_WIDTH - 30, sep2Y);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // ── [9] AUTO-FEED & CURSE STATUS ──
  let bottomY = sep2Y + 16;
  ctx.font = '12px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'left';

  const autoFeedLabel = pet.auto_feed === 1 ? 'Makan Otomatis' : pet.auto_feed === 2 ? 'Makan & Minum Otomatis' : 'Nonaktif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('Auto-Feed:', statsX, bottomY);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(autoFeedLabel, statsX + 85, bottomY);

  const nowSec = Math.floor(Date.now() / 1000);
  if (pet.curse_until && pet.curse_until > nowSec) {
    bottomY += 18;
    ctx.fillStyle = '#FF5252';
    ctx.fillText(`Kutukan: ${pet.curse_type || 'Curse'} (aktif)`, statsX, bottomY);
  }

  // ── [10] OWNER INFO + WATERMARK (bawah) ──
  const footerY = CARD_HEIGHT - 42;

  // Owner avatar (kecil)
  if (ownerUser) {
    const ownerAvatarUrl = ownerUser.displayAvatarURL ? ownerUser.displayAvatarURL({ extension: 'png', size: 64 }) : null;
    const ownerImg = ownerAvatarUrl ? await loadImageSafe(ownerAvatarUrl) : null;

    if (ownerImg) {
      // Small circle avatar
      const oaCx = 45;
      const oaCy = footerY + 8;
      const oaR = 14;

      ctx.save();
      ctx.beginPath();
      ctx.arc(oaCx, oaCy, oaR + 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(oaCx, oaCy, oaR, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(ownerImg, oaCx - oaR, oaCy - oaR, oaR * 2, oaR * 2);
      ctx.restore();

      ctx.font = '12px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.textAlign = 'left';
      const ownerName = ownerUser.username || ownerUser.displayName || 'User';
      ctx.fillText(`Owner: ${ownerName}`, oaCx + oaR + 8, footerY + 13);
    }
  }

  // Watermark (kanan bawah)
  ctx.font = '11px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.textAlign = 'right';
  ctx.fillText('Kosan 1A RPG · Pet Card', CARD_WIDTH - 30, footerY + 6);

  // Timestamp
  const now = new Date();
  const timeStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  ctx.fillText(timeStr, CARD_WIDTH - 30, footerY + 20);

  // ── [11] RARITY CORNER GLOW ──
  // Top-right corner rarity accent
  const cornerGlow = ctx.createRadialGradient(CARD_WIDTH - 50, 50, 0, CARD_WIDTH - 50, 50, 120);
  cornerGlow.addColorStop(0, `${rarityTheme.primary}30`);
  cornerGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = cornerGlow;
  ctx.fillRect(CARD_WIDTH - 170, 0, 170, 170);

  // Return PNG buffer
  return canvas.toBuffer('image/png');
}


// ═══════════════════════════════════════════════
// GENERATOR KARTU PVP BATTLE RESULT
// ═══════════════════════════════════════════════

/**
 * Generate kartu hasil PvP sebagai Buffer PNG
 * @param {Object} pet1 - Pet penyerang
 * @param {Object} pet2 - Pet bertahan
 * @param {Object} result - { winner, loser, logs, pet1HP, pet2HP, damageDealt1, damageDealt2 }
 * @returns {Promise<Buffer>} PNG buffer
 */
async function generatePvpCard(pet1, pet2, result) {
  const canvas = createCanvas(CARD_WIDTH, 320);
  const ctx = canvas.getContext('2d');

  // Background - dark arena
  const bgGrad = ctx.createLinearGradient(0, 0, CARD_WIDTH, 320);
  bgGrad.addColorStop(0, '#0a0a1e');
  bgGrad.addColorStop(0.3, '#1a0a2e');
  bgGrad.addColorStop(0.5, '#2a0a1e');
  bgGrad.addColorStop(0.7, '#1a0a2e');
  bgGrad.addColorStop(1, '#0a0a1e');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CARD_WIDTH, 320);

  // Decorative lines
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = '#FF4444';
  ctx.lineWidth = 1;
  for (let i = -320; i < CARD_WIDTH + 320; i += 25) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 320, 320);
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;

  // Panel overlay
  drawRoundedRect(ctx, 12, 12, CARD_WIDTH - 24, 296, 16);
  ctx.fillStyle = 'rgba(10,10,30,0.75)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,50,50,0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Title
  ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#FF4444';
  ctx.textAlign = 'center';
  ctx.fillText('PVP ARENA RESULT', CARD_WIDTH / 2, 45);

  // VS emblem (center)
  ctx.font = 'bold 40px "Segoe UI", Arial, sans-serif';
  const vsGrad = ctx.createLinearGradient(CARD_WIDTH / 2 - 30, 100, CARD_WIDTH / 2 + 30, 200);
  vsGrad.addColorStop(0, '#FF4444');
  vsGrad.addColorStop(1, '#FF8A80');
  ctx.fillStyle = vsGrad;
  ctx.textAlign = 'center';
  ctx.fillText('VS', CARD_WIDTH / 2, 175);

  // Pet 1 (kiri)
  const p1x = 180;
  const p1y = 140;
  const rarity1 = RARITY_COLORS[(pet1.gacha_rarity || 'COMMON').toUpperCase()] || RARITY_COLORS.COMMON;

  let petImg1 = null;
  try {
    const embeds = require('./embeds');
    petImg1 = await loadImageSafe(embeds.getPetImage(pet1));
  } catch (e) { /* fallback */ }

  if (petImg1) {
    drawCircleAvatar(ctx, petImg1, p1x, p1y, 50, rarity1.primary, rarity1.glow);
  } else {
    ctx.beginPath();
    ctx.arc(p1x, p1y, 50, 0, Math.PI * 2);
    ctx.fillStyle = rarity1.primary;
    ctx.fill();
    ctx.font = 'bold 28px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(pet1.pet_type.charAt(0), p1x, p1y + 10);
  }

  // Pet 1 info
  ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = result.winner === pet1.pet_name ? '#00E676' : '#FF5252';
  ctx.textAlign = 'center';
  const p1Result = result.winner === pet1.pet_name ? 'WINNER' : 'DEFEATED';
  ctx.fillText(p1Result, p1x, 80);

  ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  let p1Name = pet1.pet_name;
  if (p1Name.length > 16) p1Name = p1Name.substring(0, 15) + '…';
  ctx.fillText(p1Name, p1x, 210);

  ctx.font = '12px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(`Lv.${pet1.level} ${pet1.pet_type}`, p1x, 228);

  // HP bar pet 1
  const p1hp = result.pet1HP != null ? result.pet1HP : pet1.health;
  const p1maxHP = result.pet1MaxHP || 100;
  const p1hpPct = Math.min(1, Math.max(0, p1hp / p1maxHP));
  drawProgressBar(ctx, p1x - 70, 240, 140, 14, p1hpPct,
    p1hpPct > 0.5 ? '#00C853' : '#FF1744', p1hpPct > 0.5 ? '#69F0AE' : '#FF8A80',
    '', `HP: ${Math.round(p1hp)}`);

  // Pet 2 (kanan)
  const p2x = CARD_WIDTH - 180;
  const p2y = 140;
  const rarity2 = RARITY_COLORS[(pet2.gacha_rarity || 'COMMON').toUpperCase()] || RARITY_COLORS.COMMON;

  let petImg2 = null;
  try {
    const embeds = require('./embeds');
    petImg2 = await loadImageSafe(embeds.getPetImage(pet2));
  } catch (e) { /* fallback */ }

  if (petImg2) {
    drawCircleAvatar(ctx, petImg2, p2x, p2y, 50, rarity2.primary, rarity2.glow);
  } else {
    ctx.beginPath();
    ctx.arc(p2x, p2y, 50, 0, Math.PI * 2);
    ctx.fillStyle = rarity2.primary;
    ctx.fill();
    ctx.font = 'bold 28px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(pet2.pet_type.charAt(0), p2x, p2y + 10);
  }

  // Pet 2 info
  ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = result.winner === pet2.pet_name ? '#00E676' : '#FF5252';
  ctx.textAlign = 'center';
  const p2Result = result.winner === pet2.pet_name ? 'WINNER' : 'DEFEATED';
  ctx.fillText(p2Result, p2x, 80);

  ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  let p2Name = pet2.pet_name;
  if (p2Name.length > 16) p2Name = p2Name.substring(0, 15) + '…';
  ctx.fillText(p2Name, p2x, 210);

  ctx.font = '12px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(`Lv.${pet2.level} ${pet2.pet_type}`, p2x, 228);

  // HP bar pet 2
  const p2hp = result.pet2HP != null ? result.pet2HP : pet2.health;
  const p2maxHP = result.pet2MaxHP || 100;
  const p2hpPct = Math.min(1, Math.max(0, p2hp / p2maxHP));
  drawProgressBar(ctx, p2x - 70, 240, 140, 14, p2hpPct,
    p2hpPct > 0.5 ? '#00C853' : '#FF1744', p2hpPct > 0.5 ? '#69F0AE' : '#FF8A80',
    '', `HP: ${Math.round(p2hp)}`);

  // Footer watermark
  ctx.font = '10px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.textAlign = 'center';
  ctx.fillText('Kosan 1A RPG · PvP Arena', CARD_WIDTH / 2, 295);

  return canvas.toBuffer('image/png');
}

// ═══════════════════════════════════════════════
// HELPER: Get GACHA_SPECIES data
// ═══════════════════════════════════════════════

function getGachaSpecies(petType) {
  try {
    const pet = require('./pet');
    return pet.GACHA_SPECIES[petType.toUpperCase()] || null;
  } catch (e) {
    return null;
  }
}


// ═══════════════════════════════════════════════
// DISCORD ATTACHMENT BUILDER WRAPPER
// ═══════════════════════════════════════════════

/**
 * Generate kartu pet dan return sebagai Discord AttachmentBuilder
 */
async function getPetCardAttachment(pet, ownerUser, options = {}) {
  try {
    const buffer = await generatePetCard(pet, ownerUser, options);
    return new AttachmentBuilder(buffer, { name: 'pet_card.png' });
  } catch (e) {
    console.error('[PetCard] Error generating pet card:', e);
    return null;
  }
}

/**
 * Generate kartu PvP dan return sebagai Discord AttachmentBuilder
 */
async function getPvpCardAttachment(pet1, pet2, result) {
  try {
    const buffer = await generatePvpCard(pet1, pet2, result);
    return new AttachmentBuilder(buffer, { name: 'pvp_card.png' });
  } catch (e) {
    console.error('[PetCard] Error generating PvP card:', e);
    return null;
  }
}

/**
 * Generate visual tournament standings card
 * @param {Array} standings List of participant standing objects
 * @param {Discord.Guild} guild Discord guild for resolving names
 */
async function generateStandingsCard(standings, guild) {
  const rowHeight = 44;
  const headerHeight = 90;
  const footerHeight = 40;
  const maxRows = Math.min(10, standings.length);
  const canvasHeight = headerHeight + (maxRows * rowHeight) + footerHeight;

  const canvas = createCanvas(CARD_WIDTH, canvasHeight);
  const ctx = canvas.getContext('2d');

  // Background gradient - deep dark celestial arena
  const bgGrad = ctx.createLinearGradient(0, 0, CARD_WIDTH, canvasHeight);
  bgGrad.addColorStop(0, '#0a0a1a');
  bgGrad.addColorStop(0.5, '#150a2e');
  bgGrad.addColorStop(1, '#0a0a1a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CARD_WIDTH, canvasHeight);

  // Decorative border glow
  drawRoundedRect(ctx, 10, 10, CARD_WIDTH - 20, canvasHeight - 20, 16);
  ctx.fillStyle = 'rgba(10,10,30,0.6)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(99,102,241,0.2)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Header Title
  ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
  const titleGrad = ctx.createLinearGradient(CARD_WIDTH / 2 - 200, 0, CARD_WIDTH / 2 + 200, 0);
  titleGrad.addColorStop(0, '#FFD700');
  titleGrad.addColorStop(0.5, '#FF8A80');
  titleGrad.addColorStop(1, '#CE93D8');
  ctx.fillStyle = titleGrad;
  ctx.textAlign = 'center';
  ctx.fillText('KLASEMEN LIGA PET - ADMIN CUP', CARD_WIDTH / 2, 48);

  // Column Headers Configuration
  const columns = [
    { name: 'Pos', x: 50, align: 'center' },
    { name: 'Pet Name', x: 110, align: 'left' },
    { name: 'Pawang (Owner)', x: 340, align: 'left' },
    { name: 'P', x: 580, align: 'center' },
    { name: 'W', x: 660, align: 'center' },
    { name: 'L', x: 740, align: 'center' },
    { name: 'Pts', x: 830, align: 'center' }
  ];

  // Draw Header Row
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';

  columns.forEach(col => {
    ctx.textAlign = col.align;
    ctx.fillText(col.name.toUpperCase(), col.x, headerHeight - 12);
  });

  // Header bottom border line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30, headerHeight - 4);
  ctx.lineTo(CARD_WIDTH - 30, headerHeight - 4);
  ctx.stroke();

  // Draw standings rows
  for (let i = 0; i < maxRows; i++) {
    const s = standings[i];
    const y = headerHeight + (i * rowHeight) + 26;

    // Alternate row backgrounds (zebra striping)
    if (i % 2 === 0) {
      drawRoundedRect(ctx, 30, headerHeight + (i * rowHeight), CARD_WIDTH - 60, rowHeight - 4, 8);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.fill();
    }

    // Resolve pawang name
    let pawangName = 'Pawang';
    if (guild) {
      try {
        const member = guild.members.cache.get(s.userId);
        if (member) {
          pawangName = member.user.username;
        }
      } catch (e) {
        // fallback
      }
    }

    // Colors per rank
    let rankColor = '#FFFFFF';
    let rowBgHighlight = null;
    if (i === 0) {
      rankColor = '#FFD700'; // Gold
      rowBgHighlight = 'rgba(255, 215, 0, 0.05)';
    } else if (i === 1) {
      rankColor = '#C0C0C0'; // Silver
      rowBgHighlight = 'rgba(192, 192, 192, 0.05)';
    } else if (i === 2) {
      rankColor = '#CD7F32'; // Bronze
      rowBgHighlight = 'rgba(205, 127, 50, 0.05)';
    }

    if (rowBgHighlight) {
      drawRoundedRect(ctx, 30, headerHeight + (i * rowHeight), CARD_WIDTH - 60, rowHeight - 4, 8);
      ctx.fillStyle = rowBgHighlight;
      ctx.fill();
      ctx.strokeStyle = rankColor + '22'; // 10% opacity border
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Rank (Pos)
    ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = rankColor;
    ctx.textAlign = 'center';
    ctx.fillText(`${i + 1}`, columns[0].x, y);

    // Pet Name
    ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    let petName = s.petName;
    if (petName.length > 20) petName = petName.slice(0, 18) + '…';
    ctx.fillText(petName, columns[1].x, y);

    // Pawang (Owner)
    ctx.font = '13px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    let ownerText = pawangName;
    if (ownerText.length > 20) ownerText = ownerText.slice(0, 18) + '…';
    ctx.fillText(ownerText, columns[2].x, y);

    // Stats
    ctx.font = '14px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.textAlign = 'center';
    ctx.fillText(`${s.played}`, columns[3].x, y);
    ctx.fillText(`${s.won}`, columns[4].x, y);
    ctx.fillText(`${s.lost}`, columns[5].x, y);

    // Points
    ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = rankColor;
    ctx.fillText(`${s.points}`, columns[6].x, y);
  }

  // Footer Watermark
  ctx.font = '10px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.textAlign = 'center';
  ctx.fillText('Kosan 1A RPG · Pet PvP League Standings', CARD_WIDTH / 2, canvasHeight - 15);

  return canvas.toBuffer('image/png');
}

async function getStandingsCardAttachment(standings, guild) {
  try {
    const buffer = await generateStandingsCard(standings, guild);
    return new AttachmentBuilder(buffer, { name: 'standings_card.png' });
  } catch (e) {
    console.error('[PetCard] Error generating standings card:', e);
    return null;
  }
}

module.exports = {
  generatePetCard,
  generatePvpCard,
  generateStandingsCard,
  getPetCardAttachment,
  getPvpCardAttachment,
  getStandingsCardAttachment,
  loadImageSafe,
  RARITY_COLORS,
  ELEMENT_THEMES,
};

