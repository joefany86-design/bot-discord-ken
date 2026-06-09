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
const fs = require('fs');
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
  const statusKey = (pet.status || 'ACTIVE').toUpperCase();
  if (statusKey === 'WEAK') {
    const text = '🩹 RECOVERING';
    ctx.font = 'bold 9px "Segoe UI", Arial, sans-serif';
    const w = ctx.measureText(text).width + 16;
    drawBadge(ctx, avatarCX - w / 2, avatarCY + avatarRadius + 40, text, '#FF9800', '#FFFFFF', 9);
  } else {
    const statusLabels = {
      BABY: 'Baby', ADULT: 'Adult', EGG: 'Telur', DEAD: 'Mati', ACTIVE: 'Aktif'
    };
    ctx.font = '11px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = statusColor;
    ctx.textAlign = 'center';
    ctx.fillText(statusLabels[statusKey] || statusKey, avatarCX, avatarCY + avatarRadius + 52);
  }

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

  // ── [9] AUTO-FEED & EXPEDITION & CURSE STATUS ──
  let bottomY = sep2Y + 16;
  ctx.font = '12px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'left';

  // Column 1: Auto-Feed
  const autoFeedLabel = pet.auto_feed === 1 ? 'Makan Otomatis' : pet.auto_feed === 2 ? 'Makan & Minum Otomatis' : 'Nonaktif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('Auto-Feed:', statsX, bottomY);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(autoFeedLabel, statsX + 75, bottomY);

  // Column 2: Expedition Status
  const expX = statsX + 260;
  const nowSec = Math.floor(Date.now() / 1000);
  const expCooldown = options.expeditionCooldownUntil || 0;
  const expCount = options.dailyExpeditionCount || 0;

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('Ekspedisi:', expX, bottomY);

  if (expCooldown > nowSec) {
    const sisaSec = expCooldown - nowSec;
    const mins = Math.floor(sisaSec / 60);
    const secs = sisaSec % 60;
    const cdStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    ctx.fillStyle = '#FF5252';
    ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`COOLDOWN (${cdStr})`, expX + 65, bottomY);
  } else {
    const tiketSisa = Math.max(0, 6 - expCount);
    ctx.fillStyle = tiketSisa > 0 ? '#00E676' : '#FF9800';
    ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`${tiketSisa}/6 Tiket`, expX + 65, bottomY);
  }
  ctx.font = '12px "Segoe UI", Arial, sans-serif'; // reset font style

  // Column 1 Line 2: Curse Status
  if (pet.curse_until && pet.curse_until > nowSec) {
    const curseY = bottomY + 18;
    ctx.fillStyle = '#FF5252';
    ctx.fillText(`Kutukan: ${pet.curse_type || 'Curse'} (aktif)`, statsX, curseY);
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

function getExpeditionMap(mapId) {
  try {
    const petModule = require('./pet');
    return petModule.EXPEDITION_MAPS.find(m => m.id === parseInt(mapId)) || null;
  } catch (e) {
    return null;
  }
}

/**
 * Generate visual expedition PVE result card
 */
async function generateExpeditionCard(res, mapChoice, guild) {
  const canvas = createCanvas(CARD_WIDTH, 360);
  const ctx = canvas.getContext('2d');

  const selectedMap = getExpeditionMap(mapChoice);
  const element = (selectedMap?.element || 'EARTH').toUpperCase();
  const theme = ELEMENT_THEMES[element] || ELEMENT_THEMES.EARTH;

  // Background - map thematic gradient
  const bgGrad = ctx.createLinearGradient(0, 0, CARD_WIDTH, 360);
  bgGrad.addColorStop(0, theme.bg[0] || '#0f0f26');
  bgGrad.addColorStop(0.5, theme.bg[2] || '#1d0f3a');
  bgGrad.addColorStop(1, theme.bg[0] || '#0f0f26');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CARD_WIDTH, 360);

  // Decorative border glow
  drawRoundedRect(ctx, 10, 10, CARD_WIDTH - 20, 340, 16);
  ctx.fillStyle = 'rgba(10,10,30,0.75)';
  ctx.fill();
  ctx.strokeStyle = res.success ? 'rgba(0,230,118,0.3)' : 'rgba(213,0,0,0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Left Section: Result & Map Info
  const leftX = 40;
  
  // Banner / Status Ribbon
  ctx.font = 'bold 36px "Segoe UI", Arial, sans-serif';
  const bannerGrad = ctx.createLinearGradient(leftX, 80, leftX + 300, 80);
  if (res.success) {
    bannerGrad.addColorStop(0, '#00E676');
    bannerGrad.addColorStop(1, '#B9F6CA');
    ctx.fillStyle = bannerGrad;
    ctx.fillText('EKSPEDISI SUKSES', leftX, 85);
  } else {
    bannerGrad.addColorStop(0, '#FF1744');
    bannerGrad.addColorStop(1, '#FF8A80');
    ctx.fillStyle = bannerGrad;
    ctx.fillText('EKSPEDISI GAGAL', leftX, 85);
  }

  // Strip Emojis from Zone Name to avoid box outlines
  ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  const cleanZoneName = res.zoneName.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim();
  ctx.fillText(cleanZoneName, leftX, 125);

  // Stats Details
  ctx.font = '14px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillText(`Kombinasi Level Tim: Lv. ${res.teamPower}`, leftX, 165);
  ctx.fillText(`Peluang Sukses: ${res.successRate}%`, leftX, 190);
  ctx.fillText(`Elemen Wilayah: ${element}`, leftX, 215);

  // Chest Drop Reward if applicable
  if (res.chestAwardedUser && res.chestDropItem) {
    let winnerName = 'Pawang';
    if (guild) {
      try {
        const member = guild.members.cache.get(res.chestAwardedUser);
        if (member) winnerName = member.user.username;
      } catch (e) {}
    }
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`Peti Terkunci dibuka oleh ${winnerName}!`, leftX, 260);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '13px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`└─ Drop Item: ${res.chestDropItem}`, leftX, 280);
  }

  // Right Section: MVP & Worst Pets (or single explorer)
  const drawPetPanel = async (pUser, pName, pLevel, title, x, y, badgeColor, isMvp) => {
    let petElement = 'EARTH';
    let petRarity = 'COMMON';
    let petType = 'PET';
    try {
      const db = require('./database');
      const petData = db.get('SELECT gacha_element, gacha_rarity, pet_type FROM user_pets WHERE pet_name = ?', [pName]);
      if (petData) {
        petElement = petData.gacha_element || 'EARTH';
        petRarity = petData.gacha_rarity || 'COMMON';
        petType = petData.pet_type || 'PET';
      }
    } catch (err) {}

    const rarityTheme = RARITY_COLORS[petRarity.toUpperCase()] || RARITY_COLORS.COMMON;
    
    // Draw avatar ring
    ctx.beginPath();
    ctx.arc(x, y, 42, 0, Math.PI * 2);
    ctx.fillStyle = rarityTheme.primary;
    ctx.fill();
    ctx.strokeStyle = rarityTheme.glow;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Inner dark circle
    ctx.beginPath();
    ctx.arc(x, y, 38, 0, Math.PI * 2);
    ctx.fillStyle = '#101026';
    ctx.fill();

    // Fallback Letter
    ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(petType.charAt(0).toUpperCase(), x, y + 8);

    // Badge Label (MVP / BEBAN)
    ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = badgeColor;
    ctx.fillText(title.toUpperCase(), x, y - 52);

    // Name & Owner details
    ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    let petDisplayName = pName;
    if (petDisplayName.length > 14) petDisplayName = petDisplayName.slice(0, 12) + '…';
    ctx.fillText(petDisplayName, x, y + 60);

    ctx.font = '11px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText(`Lv.${pLevel} ${petType}`, x, y + 78);

    let ownerName = 'Pawang';
    if (guild) {
      try {
        const member = guild.members.cache.get(pUser);
        if (member) ownerName = member.user.username;
      } catch (e) {}
    }
    if (ownerName.length > 14) ownerName = ownerName.slice(0, 12) + '…';
    ctx.fillText(`@${ownerName}`, x, y + 95);
  };

  const rightCenterX = CARD_WIDTH - 240;
  
  if (res.bestPet && res.worstPet && res.bestPet.petName !== res.worstPet.petName) {
    await drawPetPanel(res.bestPet.userId, res.bestPet.petName, res.bestPet.level, 'MVP', rightCenterX - 85, 170, '#FFD700', true);
    await drawPetPanel(res.worstPet.userId, res.worstPet.petName, res.worstPet.level, 'BEBAN', rightCenterX + 85, 170, '#FF5252', false);
  } else if (res.bestPet) {
    await drawPetPanel(res.bestPet.userId, res.bestPet.petName, res.bestPet.level, 'EXPLORER', rightCenterX, 170, '#00E676', false);
  }

  // Footer Watermark
  ctx.font = '10px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.textAlign = 'center';
  ctx.fillText('Kosan 1A RPG · Pet Expedition Result', CARD_WIDTH / 2, 335);

  return canvas.toBuffer('image/png');
}

async function getExpeditionCardAttachment(res, mapChoice, guild) {
  try {
    const buffer = await generateExpeditionCard(res, mapChoice, guild);
    return new AttachmentBuilder(buffer, { name: 'expedition_result.png' });
  } catch (e) {
    console.error('[PetCard] Error generating expedition card:', e);
    return null;
  }
}

async function generateExpeditionLobbyCard(initiatorId, selectedMap, participants, successRate, elementalLogs, endTimeUnix, mapChoice, guild) {
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');

  // 1. Draw Map Background
  let bgImg = null;
  const mapPath = path.join(__dirname, '..', 'assets', 'maps', `map${mapChoice}.png`);
  if (fs.existsSync(mapPath)) {
    try {
      bgImg = await loadImage(mapPath);
    } catch (err) {
      console.warn("Gagal load peta lobby bg:", err.message);
    }
  }

  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, CARD_WIDTH, CARD_HEIGHT);
  } else {
    // Fallback thematic gradient
    const theme = ELEMENT_THEMES[(selectedMap.element || 'EARTH').toUpperCase()] || ELEMENT_THEMES.EARTH;
    const colors = theme.bg;
    const grad = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
    for (let i = 0; i < colors.length; i++) {
      grad.addColorStop(i / (colors.length - 1), colors[i]);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  }

  // Glassmorphic overlay panel
  const panelMargin = 15;
  drawRoundedRect(ctx, panelMargin, panelMargin, CARD_WIDTH - panelMargin * 2, CARD_HEIGHT - panelMargin * 2, 18);
  ctx.fillStyle = 'rgba(10, 10, 30, 0.82)';
  ctx.fill();

  // Panel border glow
  const borderGrad = ctx.createLinearGradient(panelMargin, panelMargin, CARD_WIDTH - panelMargin, CARD_HEIGHT - panelMargin);
  borderGrad.addColorStop(0, '#FFD70080');
  borderGrad.addColorStop(1, '#FF8A8080');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Vertical divider between left and right sections
  const dividerX = 330;
  ctx.beginPath();
  ctx.moveTo(dividerX, 35);
  ctx.lineTo(dividerX, CARD_HEIGHT - 35);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // ─── LEFT PANEL (MAP & MATCH INFO) ───
  const leftX = 40;
  let leftY = 48;

  // Title: LOBI EKSPEDISI TIM
  ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
  const titleGrad = ctx.createLinearGradient(leftX, leftY, leftX + 250, leftY);
  titleGrad.addColorStop(0, '#FFD700');
  titleGrad.addColorStop(1, '#FF8A80');
  ctx.fillStyle = titleGrad;
  ctx.textAlign = 'left';
  ctx.fillText('LOBI EKSPEDISI TIM', leftX, leftY + 22);
  leftY += 38;

  // Zone Name
  ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  const cleanZoneName = selectedMap.name.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim();
  ctx.fillText(cleanZoneName, leftX, leftY + 16);
  leftY += 28;

  // Rec level & element
  ctx.font = '12px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(`Rekomendasi: Lv. ${selectedMap.recommendedLevel}+`, leftX, leftY + 12);
  ctx.fillText(`Elemen Zona: ${selectedMap.element || 'Normal'}`, leftX, leftY + 28);
  leftY += 40;

  // Success rate progress bar
  const pct = Math.min(1, Math.max(0, successRate / 100));
  const barColorStart = pct > 0.6 ? '#00E676' : pct > 0.3 ? '#FF9800' : '#FF1744';
  const barColorEnd = pct > 0.6 ? '#69F0AE' : pct > 0.3 ? '#FFD54F' : '#FF8A80';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  ctx.fillText('PELUANG TIM', leftX, leftY + 12);
  drawProgressBar(ctx, leftX, leftY + 20, 260, 16, pct, barColorStart, barColorEnd, '', `${successRate}%`);
  leftY += 50;

  // Preparation Countdown timer
  const nowSec = Math.floor(Date.now() / 1000);
  const sisaWaktu = Math.max(0, endTimeUnix - nowSec);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  ctx.fillText('BATAS WAKTU PERSIAPAN', leftX, leftY + 12);

  const timePct = Math.min(1, Math.max(0, sisaWaktu / 30)); // 30s max lobby duration
  drawProgressBar(ctx, leftX, leftY + 20, 260, 16, timePct, '#00E5FF', '#2979FF', '', `${sisaWaktu} Detik`);
  leftY += 52;

  // Leader / Initiator Pawang
  let leaderName = 'Pawang';
  if (guild) {
    try {
      const member = guild.members.cache.get(initiatorId);
      if (member) leaderName = member.user.username;
    } catch (e) {}
  }
  ctx.font = '12px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('Pemimpin Perjalanan:', leftX, leftY + 12);
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
  ctx.fillText(`@${leaderName}`, leftX + 130, leftY + 12);

  // ─── RIGHT PANEL (GRID OF CREW SLOTS) ───
  // 6 slots: 3 columns x 2 rows
  const slotsColCount = 3;
  const slotsRowCount = 2;
  const colWidth = 172;
  const rowHeight = 156;
  const startSlotX = 360;
  const startSlotY = 48;

  for (let idx = 0; idx < 6; idx++) {
    const colIdx = idx % slotsColCount;
    const rowIdx = Math.floor(idx / slotsColCount);
    const slotX = startSlotX + colIdx * (colWidth + 12);
    const slotY = startSlotY + rowIdx * (rowHeight + 12);

    const participant = participants[idx];

    if (participant) {
      const rarityTheme = RARITY_COLORS[(participant.gacha_rarity || 'COMMON').toUpperCase()] || RARITY_COLORS.COMMON;

      // Draw filled slot background
      drawRoundedRect(ctx, slotX, slotY, colWidth, rowHeight, 12);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.fill();
      ctx.strokeStyle = rarityTheme.primary + '30';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Avatar
      const avCx = slotX + colWidth / 2;
      const avCy = slotY + 48;
      const avR = 30;

      let petImg = null;
      try {
        const embeds = require('./embeds');
        petImg = await loadImageSafe(embeds.getPetImage(participant));
      } catch (err) {}

      if (petImg) {
        drawCircleAvatar(ctx, petImg, avCx, avCy, avR, rarityTheme.primary, rarityTheme.glow);
      } else {
        // Fallback letter avatar
        ctx.beginPath();
        ctx.arc(avCx, avCy, avR, 0, Math.PI * 2);
        ctx.fillStyle = rarityTheme.primary;
        ctx.fill();
        ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(participant.pet_type.charAt(0), avCx, avCy + 6);
      }

      // Slot Index Indicator (Badge)
      drawBadge(ctx, slotX + 8, slotY + 8, `${idx + 1}`, rarityTheme.primary, '#FFFFFF', 9);

      // Name & Level
      ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      let petName = participant.pet_name || 'Pet';
      if (petName.length > 14) petName = petName.slice(0, 12) + '…';
      ctx.fillText(petName, avCx, slotY + avR * 2 + 38);

      ctx.font = '10px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillText(`Lv.${participant.level} ${participant.pet_type}`, avCx, slotY + avR * 2 + 52);

      // Owner Username
      let ownerName = participant.username || 'Pawang';
      if (ownerName.length > 15) ownerName = ownerName.slice(0, 13) + '…';
      ctx.font = 'italic 10px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = rarityTheme.primary;
      ctx.fillText(`@${ownerName}`, avCx, slotY + avR * 2 + 68);

    } else {
      // Draw empty slot (dashed border)
      ctx.save();
      ctx.setLineDash([6, 6]);
      drawRoundedRect(ctx, slotX, slotY, colWidth, rowHeight, 12);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.textAlign = 'center';
      ctx.fillText('SLOT KOSONG', slotX + colWidth / 2, slotY + rowHeight / 2 - 4);
      ctx.font = '9px "Segoe UI", Arial, sans-serif';
      ctx.fillText('Menunggu Pawang...', slotX + colWidth / 2, slotY + rowHeight / 2 + 10);
    }
  }

  // Footer Watermark
  ctx.font = '9px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.textAlign = 'right';
  ctx.fillText('Kosan 1A RPG · Expedition Lobby', CARD_WIDTH - 30, CARD_HEIGHT - 22);

  return canvas.toBuffer('image/png');
}

async function getExpeditionLobbyAttachment(initiatorId, selectedMap, participants, successRate, elementalLogs, endTimeUnix, mapChoice, guild) {
  try {
    const buffer = await generateExpeditionLobbyCard(initiatorId, selectedMap, participants, successRate, elementalLogs, endTimeUnix, mapChoice, guild);
    return new AttachmentBuilder(buffer, { name: 'lobby_card.png' });
  } catch (e) {
    console.error('[PetCard] Error generating expedition lobby card:', e);
    return null;
  }
}

async function generateExpeditionLoadingCard(selectedMap, leaderId, participants, mapChoice, guild) {
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');

  // 1. Draw Map Background
  let bgImg = null;
  const mapPath = path.join(__dirname, '..', 'assets', 'maps', `map${mapChoice}.png`);
  if (fs.existsSync(mapPath)) {
    try {
      bgImg = await loadImage(mapPath);
    } catch (err) {
      console.warn("Gagal load peta loading bg:", err.message);
    }
  }

  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, CARD_WIDTH, CARD_HEIGHT);
  } else {
    // Fallback thematic gradient
    const theme = ELEMENT_THEMES[(selectedMap.element || 'EARTH').toUpperCase()] || ELEMENT_THEMES.EARTH;
    const colors = theme.bg;
    const grad = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
    for (let i = 0; i < colors.length; i++) {
      grad.addColorStop(i / (colors.length - 1), colors[i]);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  }

  // Dark overlay
  const panelMargin = 15;
  drawRoundedRect(ctx, panelMargin, panelMargin, CARD_WIDTH - panelMargin * 2, CARD_HEIGHT - panelMargin * 2, 18);
  ctx.fillStyle = 'rgba(10, 10, 30, 0.82)';
  ctx.fill();

  // Panel border glow
  const borderGrad = ctx.createLinearGradient(panelMargin, panelMargin, CARD_WIDTH - panelMargin, CARD_HEIGHT - panelMargin);
  borderGrad.addColorStop(0, '#00E5FF80');
  borderGrad.addColorStop(1, '#7C4DFF80');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 2;
  ctx.stroke();

  // ─── HEADER SECTION ───
  let textY = 55;
  ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#00E5FF';
  ctx.textAlign = 'center';
  ctx.fillText('🧭 MASUK ZONA EKSPEDISI...', CARD_WIDTH / 2, textY);

  textY += 28;
  ctx.font = '14px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillText(`Mempersiapkan penjelajahan di ${selectedMap.name} · Boss: ${selectedMap.boss}`, CARD_WIDTH / 2, textY);

  // ─── LOADING BAR ───
  textY += 35;
  const barWidth = 600;
  const barHeight = 22;
  const barX = (CARD_WIDTH / 2) - (barWidth / 2);
  const barY = textY;

  // Background loading bar
  drawRoundedRect(ctx, barX, barY, barWidth, barHeight, barHeight / 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Filled loading bar
  ctx.save();
  drawRoundedRect(ctx, barX, barY, barWidth, barHeight, barHeight / 2);
  ctx.clip();
  const loadGrad = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
  loadGrad.addColorStop(0, '#00E5FF');
  loadGrad.addColorStop(1, '#7C4DFF');
  ctx.fillStyle = loadGrad;
  ctx.fillRect(barX, barY, barWidth, barHeight);
  ctx.restore();

  // Loading text inside loading bar
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.fillText('MENYELARASKAN KRU PET & LOGISTIK TIM... 100%', CARD_WIDTH / 2, barY + barHeight / 2 + 4);

  // ─── MEMBERS / PETS SECTION ───
  let startY = 175;
  ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.textAlign = 'center';
  ctx.fillText('KRU PETUALANG TIM', CARD_WIDTH / 2, startY);

  const colWidth = 150;
  const colGap = 20;
  const numParticipants = participants.length;
  const totalWidth = (numParticipants * colWidth) + ((numParticipants - 1) * colGap);
  const startX = (CARD_WIDTH / 2) - (totalWidth / 2);

  let drawY = startY + 25;

  for (let i = 0; i < numParticipants; i++) {
    const p = participants[i];
    const px = startX + i * (colWidth + colGap);
    const cx = px + colWidth / 2;

    // Draw Column Glass Panel
    drawRoundedRect(ctx, px, drawY, colWidth, 160, 12);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw Pet Avatar inside Column
    const avatarCY = drawY + 45;
    const avatarR = 30;

    let petImg = null;
    try {
      const embeds = require('./embeds');
      petImg = await loadImageSafe(embeds.getPetImage(p));
    } catch (e) {}

    const rarityTheme = RARITY_COLORS[(p.gacha_rarity || 'COMMON').toUpperCase()] || RARITY_COLORS.COMMON;

    if (petImg) {
      drawCircleAvatar(ctx, petImg, cx, avatarCY, avatarR, rarityTheme.primary, rarityTheme.glow);
    } else {
      ctx.beginPath();
      ctx.arc(cx, avatarCY, avatarR, 0, Math.PI * 2);
      ctx.fillStyle = '#222244';
      ctx.fill();
      ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = rarityTheme.primary;
      ctx.textAlign = 'center';
      ctx.fillText(p.pet_name.charAt(0), cx, avatarCY + 6);
    }

    // Leader Badge if initiator
    if (p.userId === leaderId) {
      ctx.font = 'bold 9px "Segoe UI", Arial, sans-serif';
      const badgeText = '👑 KOMANDAN';
      const tw = ctx.measureText(badgeText).width + 12;
      drawBadge(ctx, cx - tw / 2, avatarCY + avatarR + 6, badgeText, '#FFD700', '#1a1a2e', 9);
    }

    // Owner Name
    ctx.font = '11px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.textAlign = 'center';
    ctx.fillText(`@${p.username}`, cx, drawY + 112);

    // Pet Name
    ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    let petNameDisp = p.pet_name;
    if (petNameDisp.length > 15) petNameDisp = petNameDisp.substring(0, 14) + '…';
    ctx.fillText(petNameDisp, cx, drawY + 130);

    // Level + Species
    ctx.font = '10px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.textAlign = 'center';
    ctx.fillText(`Lv. ${p.level} ${p.pet_type}`, cx, drawY + 146);
  }

  // Footer Watermark
  ctx.font = '9px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.textAlign = 'center';
  ctx.fillText('Kosan 1A RPG · Pet Expedition Loading Screen', CARD_WIDTH / 2, CARD_HEIGHT - 22);

  return canvas.toBuffer('image/png');
}

async function getExpeditionLoadingAttachment(selectedMap, leaderId, participants, mapChoice, guild) {
  try {
    const buffer = await generateExpeditionLoadingCard(selectedMap, leaderId, participants, mapChoice, guild);
    return new AttachmentBuilder(buffer, { name: 'expedition_loading.png' });
  } catch (e) {
    console.error('[PetCard] Error generating expedition loading card:', e);
    return null;
  }
}

async function generateExpeditionStageTransitionCard(stageNum, stageTitle, selectedMap, mapChoice) {
  const canvas = createCanvas(CARD_WIDTH, 320);
  const ctx = canvas.getContext('2d');

  // Load Map Background
  let bgImg = null;
  const mapPath = path.join(__dirname, '..', 'assets', 'maps', `map${mapChoice}.png`);
  if (fs.existsSync(mapPath)) {
    try {
      bgImg = await loadImage(mapPath);
    } catch (err) {}
  }

  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, CARD_WIDTH, 320);
  } else {
    const theme = ELEMENT_THEMES[(selectedMap?.element || 'EARTH').toUpperCase()] || ELEMENT_THEMES.EARTH;
    const colors = theme.bg;
    const grad = ctx.createLinearGradient(0, 0, CARD_WIDTH, 320);
    for (let i = 0; i < colors.length; i++) {
      grad.addColorStop(i / (colors.length - 1), colors[i]);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CARD_WIDTH, 320);
  }

  // Dark overlay
  const panelMargin = 15;
  drawRoundedRect(ctx, panelMargin, panelMargin, CARD_WIDTH - panelMargin * 2, 320 - panelMargin * 2, 18);
  ctx.fillStyle = 'rgba(10, 10, 30, 0.85)';
  ctx.fill();

  // Border glow gold
  const borderGrad = ctx.createLinearGradient(panelMargin, panelMargin, CARD_WIDTH - panelMargin, 320 - panelMargin);
  borderGrad.addColorStop(0, '#FFB80080');
  borderGrad.addColorStop(1, '#FFD70080');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Icon based on stage
  let stageIcon = '🗺️';
  if (stageNum === 1) stageIcon = '🧭';
  if (stageNum === 2) stageIcon = '🎲';
  if (stageNum === 3) stageIcon = '⚔️';

  // Text details
  ctx.textAlign = 'center';
  
  // Header
  ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#FFB800';
  ctx.fillText(`${stageIcon} TRANSISI EXPEDITION: STAGE ${stageNum}/3`, CARD_WIDTH / 2, 80);

  // Title
  ctx.font = 'bold 32px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(stageTitle.toUpperCase(), CARD_WIDTH / 2, 135);

  // Map / Path text
  ctx.font = '16px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillText(`Memasuki wilayah ${selectedMap?.name || 'Ekspedisi'} bagian dalam...`, CARD_WIDTH / 2, 185);

  // Flavour text
  ctx.font = 'italic 12px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText('Kru pet terus berjalan menembus kabut tebal, bersiaplah menghadapi apa pun yang menghalangi jalan!', CARD_WIDTH / 2, 225);

  // Watermark
  ctx.font = '9px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillText('Kosan 1A RPG · Pet Expedition Transition Screen', CARD_WIDTH / 2, 280);

  return canvas.toBuffer('image/png');
}

async function getExpeditionStageTransitionAttachment(stageNum, stageTitle, selectedMap, mapChoice) {
  try {
    const buffer = await generateExpeditionStageTransitionCard(stageNum, stageTitle, selectedMap, mapChoice);
    return new AttachmentBuilder(buffer, { name: 'expedition_stage_transition.png' });
  } catch (e) {
    console.error('[PetCard] Error generating stage transition card:', e);
    return null;
  }
}

async function generateExpeditionQteStepCard(stepNumber, totalSteps, bossName, targetMemberName, petObj, mapChoice) {
  const canvas = createCanvas(CARD_WIDTH, 360);
  const ctx = canvas.getContext('2d');

  // Load Map Background
  let bgImg = null;
  const mapPath = path.join(__dirname, '..', 'assets', 'maps', `map${mapChoice}.png`);
  if (fs.existsSync(mapPath)) {
    try {
      bgImg = await loadImage(mapPath);
    } catch (err) {}
  }

  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, CARD_WIDTH, 360);
  } else {
    const grad = ctx.createLinearGradient(0, 0, CARD_WIDTH, 360);
    grad.addColorStop(0, '#110000');
    grad.addColorStop(1, '#331100');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CARD_WIDTH, 360);
  }

  // Dark overlay panel
  const panelMargin = 15;
  drawRoundedRect(ctx, panelMargin, panelMargin, CARD_WIDTH - panelMargin * 2, 360 - panelMargin * 2, 18);
  ctx.fillStyle = 'rgba(15, 10, 10, 0.88)';
  ctx.fill();

  // Orange border glow
  const borderGrad = ctx.createLinearGradient(panelMargin, panelMargin, CARD_WIDTH - panelMargin, 360 - panelMargin);
  borderGrad.addColorStop(0, '#FF910080');
  borderGrad.addColorStop(1, '#FF3D0080');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Header Text
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#FF9100';
  ctx.fillText(`⚔️ BOS BATTLE ━━ TAHAP ${stepNumber}/${totalSteps}`, CARD_WIDTH / 2, 55);

  ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillText(`🚨 SERANGAN BERSAMA KEPADA ${bossName.toUpperCase()}! 🚨`, CARD_WIDTH / 2, 80);

  // Visual QTE progress tracker
  const nodeRadius = 10;
  const nodeGap = 16;
  const totalNodesWidth = (totalSteps * nodeRadius * 2) + ((totalSteps - 1) * nodeGap);
  const startNodesX = (CARD_WIDTH / 2) - (totalNodesWidth / 2);
  const nodesY = 105;

  for (let step = 1; step <= totalSteps; step++) {
    const cx = startNodesX + (step - 1) * (nodeRadius * 2 + nodeGap) + nodeRadius;
    
    // Draw glow
    ctx.beginPath();
    ctx.arc(cx, nodesY, nodeRadius + 3, 0, Math.PI * 2);
    ctx.fillStyle = step <= stepNumber ? 'rgba(0, 230, 118, 0.3)' : 'rgba(255, 255, 255, 0.05)';
    ctx.fill();

    // Main node
    ctx.beginPath();
    ctx.arc(cx, nodesY, nodeRadius, 0, Math.PI * 2);
    ctx.fillStyle = step <= stepNumber ? '#00E676' : '#424242';
    ctx.fill();

    // Node border
    ctx.strokeStyle = step <= stepNumber ? '#B9F6CA' : '#212121';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Draw two column sections: target pet info (left) & target player instructions (right)
  const leftX = 75;
  const rightX = 490;
  const columnsY = 145;

  // 1. LEFT COLUMN: Target Pet Profile panel
  drawRoundedRect(ctx, leftX, columnsY, 350, 150, 12);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Pet avatar
  const avCx = leftX + 60;
  const avCy = columnsY + 75;
  const avR = 40;

  let petImg = null;
  try {
    const embeds = require('./embeds');
    petImg = await loadImageSafe(embeds.getPetImage(petObj));
  } catch (e) {}

  const petRarity = (petObj?.gacha_rarity || 'COMMON').toUpperCase();
  const rarityTheme = RARITY_COLORS[petRarity] || RARITY_COLORS.COMMON;

  if (petImg) {
    drawCircleAvatar(ctx, petImg, avCx, avCy, avR, rarityTheme.primary, rarityTheme.glow);
  } else {
    ctx.beginPath();
    ctx.arc(avCx, avCy, avR, 0, Math.PI * 2);
    ctx.fillStyle = '#222244';
    ctx.fill();
    ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = rarityTheme.primary;
    ctx.textAlign = 'center';
    ctx.fillText(petObj?.pet_name?.charAt(0) || 'P', avCx, avCy + 8);
  }

  // Pet details next to avatar
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
  let petNameDisp = petObj?.pet_name || 'Pet';
  if (petNameDisp.length > 18) petNameDisp = petNameDisp.substring(0, 17) + '…';
  ctx.fillText(petNameDisp, leftX + 120, columnsY + 55);

  ctx.font = '12px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillText(`Lv. ${petObj?.level || 1} ${petObj?.pet_type || 'Hewan'}`, leftX + 120, columnsY + 80);

  // Element and Rarity Badges
  let badgeX = leftX + 120;
  ctx.font = 'bold 9px "Segoe UI", Arial, sans-serif';
  const rBadgeW = drawBadge(ctx, badgeX, columnsY + 95, petRarity, rarityTheme.primary, '#FFFFFF', 9);
  badgeX += rBadgeW + 6;
  drawBadge(ctx, badgeX, columnsY + 95, (petObj?.gacha_element || 'EARTH').toUpperCase(), 'rgba(255, 255, 255, 0.15)', '#FFFFFF', 9);

  // 2. RIGHT COLUMN: Target Player Turn details
  drawRoundedRect(ctx, rightX, columnsY, 350, 150, 12);
  ctx.fillStyle = 'rgba(255, 145, 0, 0.05)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 145, 0, 0.15)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = '14px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillText('⏳ GILIRAN TARGET:', rightX + 175, columnsY + 45);

  ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#FF9100';
  let usernameDisp = `@${targetMemberName}`;
  if (usernameDisp.length > 20) usernameDisp = usernameDisp.substring(0, 19) + '…';
  ctx.fillText(usernameDisp, rightX + 175, columnsY + 80);

  ctx.font = 'italic 11px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText('Segera perintahkan pet Anda sebelum waktu habis!', rightX + 175, columnsY + 115);

  // Footer Watermark
  ctx.font = '9px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.textAlign = 'center';
  ctx.fillText('Kosan 1A RPG · Pet Expedition Boss Battle', CARD_WIDTH / 2, 340);

  return canvas.toBuffer('image/png');
}

async function getExpeditionQteStepAttachment(stepNumber, totalSteps, bossName, targetMemberName, petObj, mapChoice) {
  try {
    const buffer = await generateExpeditionQteStepCard(stepNumber, totalSteps, bossName, targetMemberName, petObj, mapChoice);
    return new AttachmentBuilder(buffer, { name: 'expedition_qte_step.png' });
  } catch (e) {
    console.error('[PetCard] Error generating QTE step card:', e);
    return null;
  }
}

async function generateExpeditionQteFailureCard(mapName, failedMemberName, reasonType, failResults, mapChoice, guild) {
  const canvas = createCanvas(CARD_WIDTH, 420);
  const ctx = canvas.getContext('2d');

  // Load Map Background
  let bgImg = null;
  const mapPath = path.join(__dirname, '..', 'assets', 'maps', `map${mapChoice}.png`);
  if (fs.existsSync(mapPath)) {
    try {
      bgImg = await loadImage(mapPath);
    } catch (err) {}
  }

  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, CARD_WIDTH, 420);
  }

  // Red/Dark theme overlay
  const panelMargin = 15;
  drawRoundedRect(ctx, panelMargin, panelMargin, CARD_WIDTH - panelMargin * 2, 420 - panelMargin * 2, 18);
  ctx.fillStyle = 'rgba(25, 10, 10, 0.92)';
  ctx.fill();

  // Dark Red border glow
  const borderGrad = ctx.createLinearGradient(panelMargin, panelMargin, CARD_WIDTH - panelMargin, 420 - panelMargin);
  borderGrad.addColorStop(0, '#D5000080');
  borderGrad.addColorStop(1, '#FF174480');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Title
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#FF1744';
  ctx.fillText('🏰 EKSPEDISI GAGAL ━━ PERTEMPURAN KACAU!', CARD_WIDTH / 2, 55);

  ctx.font = '13px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillText(`💥 Alarm penjaga berbunyi di ${mapName}! Tim dipaksa mundur! 💥`, CARD_WIDTH / 2, 80);

  const leftX = 40;
  const rightX = 480;
  const columnsY = 110;

  // 1. LEFT COLUMN: Failure explanation
  drawRoundedRect(ctx, leftX, columnsY, 400, 240, 12);
  ctx.fillStyle = 'rgba(213, 0, 0, 0.04)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(213, 0, 0, 0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#FF8A80';
  ctx.fillText('🔍 PENYEBAB KEKALAHAN:', leftX + 20, columnsY + 35);

  // Cause text word wrap
  ctx.font = '13px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  
  let causeText = '';
  if (reasonType === 'Timeout') {
    causeText = `@${failedMemberName} lambat mengambil keputusan! Batas waktu QTE 6 detik habis saat pertarungan memanas. Tim kehilangan momentum!`;
  } else {
    causeText = `@${failedMemberName} salah merespon (Interferensi)! Mengklik tombol skill pet di luar giliran merusak koordinasi tim secara instan!`;
  }

  // Draw wrapped text
  const words = causeText.split(' ');
  let line = '';
  let yPos = columnsY + 65;
  const maxWidth = 360;
  const lineHeight = 20;

  for (let n = 0; n < words.length; n++) {
    let testLine = line + words[n] + ' ';
    let metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, leftX + 20, yPos);
      line = words[n] + ' ';
      yPos += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, leftX + 20, yPos);

  ctx.font = 'italic 11px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText('Dampak: Seluruh pet kehilangan status HP/kesehatan,', leftX + 20, columnsY + 180);
  ctx.fillText('lapar/haus meningkat, dan kebahagiaan menurun drastis.', leftX + 20, columnsY + 198);

  // 2. RIGHT COLUMN: Pet impact lists
  drawRoundedRect(ctx, rightX, columnsY, 400, 240, 12);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillText('🐾 DAMPAK KONDISI KRU PET:', rightX + 20, columnsY + 35);

  let rowY = columnsY + 60;
  const rowHeight = 40;

  for (let i = 0; i < Math.min(4, failResults.length); i++) {
    const r = failResults[i];
    let pOwner = 'Pawang';
    if (guild) {
      try {
        const m = guild.members.cache.get(r.userId);
        if (m) pOwner = m.user.username;
      } catch (err) {}
    }

    ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`🦖 ${r.petName} (@${pOwner})`, rightX + 20, rowY);

    ctx.font = '11px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#FF8A80';
    ctx.fillText(`└─ ${r.statusText || 'Luka & Stress'}`, rightX + 20, rowY + 16);

    rowY += rowHeight;
  }

  // Footer Watermark
  ctx.font = '9px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.textAlign = 'center';
  ctx.fillText('Kosan 1A RPG · Pet Expedition Failure Screen', CARD_WIDTH / 2, 395);

  return canvas.toBuffer('image/png');
}

async function getExpeditionQteFailureAttachment(mapName, failedMemberName, reasonType, failResults, mapChoice, guild) {
  try {
    const buffer = await generateExpeditionQteFailureCard(mapName, failedMemberName, reasonType, failResults, mapChoice, guild);
    return new AttachmentBuilder(buffer, { name: 'expedition_qte_failure.png' });
  } catch (e) {
    console.error('[PetCard] Error generating QTE failure card:', e);
    return null;
  }
}

// ═══════════════════════════════════════════════
// STAGE 1: PEMILIHAN JALUR TIM — Canvas Card
// ═══════════════════════════════════════════════

async function generateStage1PathSelectionCard(selectedMap, commanderName, mapChoice) {
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Map background
  let bgImg = null;
  const mapPath = path.join(__dirname, '..', 'assets', 'maps', `map${mapChoice}.png`);
  if (fs.existsSync(mapPath)) {
    try { bgImg = await loadImage(mapPath); } catch (e) {}
  }
  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, CARD_WIDTH, CARD_HEIGHT);
  } else {
    const theme = ELEMENT_THEMES[(selectedMap?.element || 'EARTH').toUpperCase()] || ELEMENT_THEMES.EARTH;
    const grad = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
    theme.bg.forEach((c, i) => grad.addColorStop(i / (theme.bg.length - 1), c));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  }

  // Dark overlay
  const pm = 15;
  drawRoundedRect(ctx, pm, pm, CARD_WIDTH - pm * 2, CARD_HEIGHT - pm * 2, 18);
  ctx.fillStyle = 'rgba(10, 10, 30, 0.88)';
  ctx.fill();
  const borderGrad = ctx.createLinearGradient(pm, pm, CARD_WIDTH - pm, CARD_HEIGHT - pm);
  borderGrad.addColorStop(0, '#FF910080');
  borderGrad.addColorStop(1, '#FFD70080');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Header
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#FF9100';
  ctx.fillText('🧭 STAGE 1 ━━ PEMILIHAN JALUR TIM', CARD_WIDTH / 2, 55);

  ctx.font = 'italic 13px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillText('"Decide wisely, Commander, for every path holds its own fortune and peril..."', CARD_WIDTH / 2, 80);

  // Map & Commander info bar
  ctx.font = '13px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText(`🗺️ Peta: ${selectedMap?.name || 'Ekspedisi'}  ·  👤 Komandan: @${commanderName}`, CARD_WIDTH / 2, 105);

  // ─── THREE PATH OPTION PANELS ───
  const paths = [
    {
      icon: '🛣️', title: 'JALUR AMAN', color: '#4CAF50', glowColor: '#4CAF5040',
      desc1: 'Perjalanan lancar tanpa',
      desc2: 'risiko ekstra.',
      bonus: '+0% Sukses', bonusColor: '#81C784'
    },
    {
      icon: '🧗', title: 'JALUR PINTAS TERJAL', color: '#2196F3', glowColor: '#2196F340',
      desc1: 'Mendaki tebing terjal.',
      desc2: 'Pet kelelahan (-15 HP)',
      bonus: '+15% Sukses', bonusColor: '#64B5F6'
    },
    {
      icon: '🌲', title: 'RAWA BERACUN', color: '#F44336', glowColor: '#F4433640',
      desc1: 'Rawa berlumpur. 30%',
      desc2: 'risiko efek negatif.',
      bonus: '+25% Sukses', bonusColor: '#EF9A9A'
    }
  ];

  const panelW = 260;
  const panelH = 210;
  const panelGap = 20;
  const totalW = (paths.length * panelW) + ((paths.length - 1) * panelGap);
  const startX = (CARD_WIDTH - totalW) / 2;
  const panelY = 125;

  for (let i = 0; i < paths.length; i++) {
    const p = paths[i];
    const px = startX + i * (panelW + panelGap);

    // Panel background
    drawRoundedRect(ctx, px, panelY, panelW, panelH, 14);
    ctx.fillStyle = p.glowColor;
    ctx.fill();
    ctx.strokeStyle = `${p.color}60`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner glass overlay
    drawRoundedRect(ctx, px + 2, panelY + 2, panelW - 4, panelH - 4, 12);
    ctx.fillStyle = 'rgba(10, 10, 30, 0.6)';
    ctx.fill();

    // Top accent stripe
    ctx.save();
    drawRoundedRect(ctx, px, panelY, panelW, 6, 14);
    ctx.clip();
    ctx.fillStyle = p.color;
    ctx.fillRect(px, panelY, panelW, 6);
    ctx.restore();

    // Icon circle
    const iconCx = px + panelW / 2;
    const iconCy = panelY + 50;
    ctx.beginPath();
    ctx.arc(iconCx, iconCy, 24, 0, Math.PI * 2);
    ctx.fillStyle = `${p.color}30`;
    ctx.fill();
    ctx.strokeStyle = `${p.color}80`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Icon text (fallback letter since emoji renders as boxes in some canvas)
    ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = p.color;
    ctx.textAlign = 'center';
    const iconLabel = i === 0 ? 'A' : i === 1 ? 'B' : 'C';
    ctx.fillText(iconLabel, iconCx, iconCy + 7);

    // Title
    ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(p.title, px + panelW / 2, panelY + 95);

    // Description
    ctx.font = '11px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(p.desc1, px + panelW / 2, panelY + 120);
    ctx.fillText(p.desc2, px + panelW / 2, panelY + 136);

    // Bonus badge
    ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
    const badgeText = p.bonus;
    const badgeW = ctx.measureText(badgeText).width + 20;
    const badgeH = 22;
    const badgeX = px + (panelW - badgeW) / 2;
    const badgeY = panelY + 160;
    drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2);
    ctx.fillStyle = `${p.color}30`;
    ctx.fill();
    ctx.strokeStyle = `${p.color}60`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = p.bonusColor;
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + 15);
  }

  // Footer
  ctx.font = '11px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.textAlign = 'center';
  ctx.fillText('⚔️ Batas keputusan: 15 detik · Pilih jalur dengan tombol di bawah', CARD_WIDTH / 2, CARD_HEIGHT - 40);

  ctx.font = '9px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillText('Kosan 1A RPG · Pet Expedition Stage 1', CARD_WIDTH / 2, CARD_HEIGHT - 22);

  return canvas.toBuffer('image/png');
}

async function getStage1PathSelectionAttachment(selectedMap, commanderName, mapChoice) {
  try {
    const buffer = await generateStage1PathSelectionCard(selectedMap, commanderName, mapChoice);
    return new AttachmentBuilder(buffer, { name: 'expedition_stage1.png' });
  } catch (e) {
    console.error('[PetCard] Error generating Stage 1 path selection card:', e);
    return null;
  }
}

// ═══════════════════════════════════════════════
// STAGE 1 RESULT — Canvas Card
// ═══════════════════════════════════════════════

async function generateStage1ResultCard(selectedMap, commanderName, pathText, pathChoice, mapChoice) {
  const canvas = createCanvas(CARD_WIDTH, 320);
  const ctx = canvas.getContext('2d');

  // Map background
  let bgImg = null;
  const mapPath = path.join(__dirname, '..', 'assets', 'maps', `map${mapChoice}.png`);
  if (fs.existsSync(mapPath)) {
    try { bgImg = await loadImage(mapPath); } catch (e) {}
  }
  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, CARD_WIDTH, 320);
  } else {
    const grad = ctx.createLinearGradient(0, 0, CARD_WIDTH, 320);
    grad.addColorStop(0, '#1a0a00');
    grad.addColorStop(1, '#331a00');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CARD_WIDTH, 320);
  }

  const pm = 15;
  drawRoundedRect(ctx, pm, pm, CARD_WIDTH - pm * 2, 320 - pm * 2, 18);
  ctx.fillStyle = 'rgba(10, 10, 30, 0.88)';
  ctx.fill();

  // Green checkmark border for completed stage
  const borderGrad = ctx.createLinearGradient(pm, pm, CARD_WIDTH - pm, 320 - pm);
  borderGrad.addColorStop(0, '#00E67680');
  borderGrad.addColorStop(1, '#FFB80080');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Header
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#00E676';
  ctx.fillText('🧭 STAGE 1 SELESAI ━━ JALUR DIPILIH ✅', CARD_WIDTH / 2, 60);

  // Path choice color
  const pathColors = { SAFE: '#4CAF50', SHORTCUT: '#2196F3', SWAMP: '#F44336' };
  const chosenColor = pathColors[pathChoice] || '#FFB800';

  // Result box
  const boxW = 700;
  const boxH = 120;
  const boxX = (CARD_WIDTH - boxW) / 2;
  const boxY = 85;
  drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 12);
  ctx.fillStyle = `${chosenColor}15`;
  ctx.fill();
  ctx.strokeStyle = `${chosenColor}40`;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = chosenColor;
  ctx.fillText('📢 Keputusan Jalur:', boxX + 25, boxY + 30);

  // Wrap path text
  ctx.font = '13px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  const cleanPathText = pathText.replace(/\*\*/g, '').replace(/└─\s*/g, '  → ');
  const lines = cleanPathText.split('\n');
  let ty = boxY + 55;
  for (const line of lines) {
    if (ty > boxY + boxH - 10) break;
    ctx.fillText(line.substring(0, 80), boxX + 25, ty);
    ty += 20;
  }

  // Map & Commander info
  ctx.textAlign = 'center';
  ctx.font = '12px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText(`🗺️ ${selectedMap?.name || 'Ekspedisi'}  ·  👤 @${commanderName}  ·  ⏳ Menghubungkan ke Stage 2...`, CARD_WIDTH / 2, 250);

  // Watermark
  ctx.font = '9px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillText('Kosan 1A RPG · Pet Expedition Stage 1 Complete', CARD_WIDTH / 2, 290);

  return canvas.toBuffer('image/png');
}

async function getStage1ResultAttachment(selectedMap, commanderName, pathText, pathChoice, mapChoice) {
  try {
    const buffer = await generateStage1ResultCard(selectedMap, commanderName, pathText, pathChoice, mapChoice);
    return new AttachmentBuilder(buffer, { name: 'expedition_stage1_result.png' });
  } catch (e) {
    console.error('[PetCard] Error generating Stage 1 result card:', e);
    return null;
  }
}

// ═══════════════════════════════════════════════
// STAGE 2: PETI KUNO TERKUNCI — Canvas Card
// ═══════════════════════════════════════════════

async function generateStage2ChestCard(selectedMap, commanderName, hasLockpick, mapChoice) {
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Map background
  let bgImg = null;
  const mapPath = path.join(__dirname, '..', 'assets', 'maps', `map${mapChoice}.png`);
  if (fs.existsSync(mapPath)) {
    try { bgImg = await loadImage(mapPath); } catch (e) {}
  }
  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, CARD_WIDTH, CARD_HEIGHT);
  } else {
    const grad = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
    grad.addColorStop(0, '#1a001a');
    grad.addColorStop(1, '#330033');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  }

  const pm = 15;
  drawRoundedRect(ctx, pm, pm, CARD_WIDTH - pm * 2, CARD_HEIGHT - pm * 2, 18);
  ctx.fillStyle = 'rgba(15, 5, 20, 0.90)';
  ctx.fill();
  const borderGrad = ctx.createLinearGradient(pm, pm, CARD_WIDTH - pm, CARD_HEIGHT - pm);
  borderGrad.addColorStop(0, '#E040FB80');
  borderGrad.addColorStop(1, '#7C4DFF80');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Header
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#E040FB';
  ctx.fillText('📦 STAGE 2 ━━ PETI KUNO TERKUNCI', CARD_WIDTH / 2, 55);

  ctx.font = 'italic 13px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillText('"A dusty relic of the past lies before you. What secrets or traps does it hold?"', CARD_WIDTH / 2, 80);

  ctx.font = '13px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText(`🗺️ ${selectedMap?.name || 'Ekspedisi'}  ·  👤 @${commanderName}`, CARD_WIDTH / 2, 105);

  // Three option panels
  const opts = [
    {
      title: 'GUNAKAN LOCKPICK', color: '#2196F3', glowColor: '#2196F340',
      desc1: 'Membuka peti aman.',
      desc2: 'Dijamin 1 item langka!',
      badge: hasLockpick ? '🟢 Tersedia' : '🔴 Tidak Ada',
      badgeColor: hasLockpick ? '#4CAF50' : '#F44336',
      letter: 'L'
    },
    {
      title: 'DOBRAK PAKSA', color: '#F44336', glowColor: '#F4433640',
      desc1: '40% sukses, 60%',
      desc2: 'ledakan (-15 HP semua)',
      badge: 'Risiko Tinggi',
      badgeColor: '#FF9800',
      letter: 'D'
    },
    {
      title: 'LEWATI', color: '#9E9E9E', glowColor: '#9E9E9E30',
      desc1: 'Tinggalkan peti dan',
      desc2: 'lanjut aman.',
      badge: 'Tanpa Risiko',
      badgeColor: '#78909C',
      letter: 'S'
    }
  ];

  const panelW = 260;
  const panelH = 210;
  const panelGap = 20;
  const totalW = (opts.length * panelW) + ((opts.length - 1) * panelGap);
  const startX = (CARD_WIDTH - totalW) / 2;
  const panelY = 125;

  for (let i = 0; i < opts.length; i++) {
    const o = opts[i];
    const px = startX + i * (panelW + panelGap);

    drawRoundedRect(ctx, px, panelY, panelW, panelH, 14);
    ctx.fillStyle = o.glowColor;
    ctx.fill();
    ctx.strokeStyle = `${o.color}60`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    drawRoundedRect(ctx, px + 2, panelY + 2, panelW - 4, panelH - 4, 12);
    ctx.fillStyle = 'rgba(10, 10, 30, 0.6)';
    ctx.fill();

    // Top accent
    ctx.save();
    drawRoundedRect(ctx, px, panelY, panelW, 6, 14);
    ctx.clip();
    ctx.fillStyle = o.color;
    ctx.fillRect(px, panelY, panelW, 6);
    ctx.restore();

    // Icon circle
    const iconCx = px + panelW / 2;
    const iconCy = panelY + 50;
    ctx.beginPath();
    ctx.arc(iconCx, iconCy, 24, 0, Math.PI * 2);
    ctx.fillStyle = `${o.color}30`;
    ctx.fill();
    ctx.strokeStyle = `${o.color}80`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = o.color;
    ctx.textAlign = 'center';
    ctx.fillText(o.letter, iconCx, iconCy + 7);

    // Title
    ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(o.title, px + panelW / 2, panelY + 95);

    // Description
    ctx.font = '11px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(o.desc1, px + panelW / 2, panelY + 118);
    ctx.fillText(o.desc2, px + panelW / 2, panelY + 134);

    // Badge
    ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif';
    const bText = o.badge;
    const bW = ctx.measureText(bText).width + 20;
    const bH = 20;
    const bX = px + (panelW - bW) / 2;
    const bY = panelY + 160;
    drawRoundedRect(ctx, bX, bY, bW, bH, bH / 2);
    ctx.fillStyle = `${o.badgeColor}30`;
    ctx.fill();
    ctx.strokeStyle = `${o.badgeColor}60`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = o.badgeColor;
    ctx.fillText(bText, bX + bW / 2, bY + 14);
  }

  ctx.font = '11px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.textAlign = 'center';
  ctx.fillText('⚔️ Batas keputusan: 15 detik · Pilih opsi dengan tombol di bawah', CARD_WIDTH / 2, CARD_HEIGHT - 40);

  ctx.font = '9px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillText('Kosan 1A RPG · Pet Expedition Stage 2 — Ancient Chest', CARD_WIDTH / 2, CARD_HEIGHT - 22);

  return canvas.toBuffer('image/png');
}

async function getStage2ChestAttachment(selectedMap, commanderName, hasLockpick, mapChoice) {
  try {
    const buffer = await generateStage2ChestCard(selectedMap, commanderName, hasLockpick, mapChoice);
    return new AttachmentBuilder(buffer, { name: 'expedition_stage2_chest.png' });
  } catch (e) {
    console.error('[PetCard] Error generating Stage 2 chest card:', e);
    return null;
  }
}

// ═══════════════════════════════════════════════
// STAGE 2: AIR TERJUN SUCI — Canvas Card
// ═══════════════════════════════════════════════

async function generateStage2WaterfallCard(selectedMap, commanderName, mapChoice) {
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Map background
  let bgImg = null;
  const mapPath = path.join(__dirname, '..', 'assets', 'maps', `map${mapChoice}.png`);
  if (fs.existsSync(mapPath)) {
    try { bgImg = await loadImage(mapPath); } catch (e) {}
  }
  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, CARD_WIDTH, CARD_HEIGHT);
  } else {
    const grad = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
    grad.addColorStop(0, '#001a33');
    grad.addColorStop(1, '#003366');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  }

  const pm = 15;
  drawRoundedRect(ctx, pm, pm, CARD_WIDTH - pm * 2, CARD_HEIGHT - pm * 2, 18);
  ctx.fillStyle = 'rgba(5, 15, 30, 0.90)';
  ctx.fill();
  const borderGrad = ctx.createLinearGradient(pm, pm, CARD_WIDTH - pm, CARD_HEIGHT - pm);
  borderGrad.addColorStop(0, '#00E5FF80');
  borderGrad.addColorStop(1, '#00BCD480');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Header
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#00E5FF';
  ctx.fillText('💧 STAGE 2 ━━ AIR TERJUN SUCI', CARD_WIDTH / 2, 55);

  ctx.font = 'italic 13px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillText('"A crystal-clear spring of magical waters, offering rejuvenation to weary travelers."', CARD_WIDTH / 2, 80);

  ctx.font = '13px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText(`🗺️ ${selectedMap?.name || 'Ekspedisi'}  ·  👤 @${commanderName}`, CARD_WIDTH / 2, 105);

  // Two option panels, centered
  const panelW = 340;
  const panelH = 220;
  const panelGap = 30;
  const totalW = 2 * panelW + panelGap;
  const startX = (CARD_WIDTH - totalW) / 2;
  const panelY = 125;

  const opts = [
    {
      title: 'MINUM BERSAMA', color: '#00E5FF', glowColor: '#00E5FF30',
      desc1: 'Seluruh pet memulihkan',
      desc2: '+20 HP & +20 Hidrasi',
      badge: 'Pemulihan Tim', badgeColor: '#00E676', letter: 'M'
    },
    {
      title: 'LEWATI', color: '#78909C', glowColor: '#78909C30',
      desc1: 'Lanjut perjalanan',
      desc2: 'tanpa istirahat.',
      badge: 'Tanpa Efek', badgeColor: '#90A4AE', letter: 'S'
    }
  ];

  for (let i = 0; i < opts.length; i++) {
    const o = opts[i];
    const px = startX + i * (panelW + panelGap);

    drawRoundedRect(ctx, px, panelY, panelW, panelH, 14);
    ctx.fillStyle = o.glowColor;
    ctx.fill();
    ctx.strokeStyle = `${o.color}60`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    drawRoundedRect(ctx, px + 2, panelY + 2, panelW - 4, panelH - 4, 12);
    ctx.fillStyle = 'rgba(10, 10, 30, 0.6)';
    ctx.fill();

    // Top accent stripe
    ctx.save();
    drawRoundedRect(ctx, px, panelY, panelW, 6, 14);
    ctx.clip();
    ctx.fillStyle = o.color;
    ctx.fillRect(px, panelY, panelW, 6);
    ctx.restore();

    // Icon circle
    const iconCx = px + panelW / 2;
    const iconCy = panelY + 55;
    ctx.beginPath();
    ctx.arc(iconCx, iconCy, 28, 0, Math.PI * 2);
    ctx.fillStyle = `${o.color}30`;
    ctx.fill();
    ctx.strokeStyle = `${o.color}80`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = o.color;
    ctx.textAlign = 'center';
    ctx.fillText(o.letter, iconCx, iconCy + 8);

    ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(o.title, px + panelW / 2, panelY + 110);

    ctx.font = '12px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(o.desc1, px + panelW / 2, panelY + 138);
    ctx.fillText(o.desc2, px + panelW / 2, panelY + 156);

    // Badge
    ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
    const bW = ctx.measureText(o.badge).width + 24;
    const bH = 22;
    const bX = px + (panelW - bW) / 2;
    const bY = panelY + 175;
    drawRoundedRect(ctx, bX, bY, bW, bH, bH / 2);
    ctx.fillStyle = `${o.badgeColor}30`;
    ctx.fill();
    ctx.strokeStyle = `${o.badgeColor}60`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = o.badgeColor;
    ctx.fillText(o.badge, bX + bW / 2, bY + 15);
  }

  ctx.font = '11px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.textAlign = 'center';
  ctx.fillText('⚔️ Batas keputusan: 15 detik · Pilih opsi dengan tombol di bawah', CARD_WIDTH / 2, CARD_HEIGHT - 40);

  ctx.font = '9px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillText('Kosan 1A RPG · Pet Expedition Stage 2 — Sacred Waterfall', CARD_WIDTH / 2, CARD_HEIGHT - 22);

  return canvas.toBuffer('image/png');
}

async function getStage2WaterfallAttachment(selectedMap, commanderName, mapChoice) {
  try {
    const buffer = await generateStage2WaterfallCard(selectedMap, commanderName, mapChoice);
    return new AttachmentBuilder(buffer, { name: 'expedition_stage2_waterfall.png' });
  } catch (e) {
    console.error('[PetCard] Error generating Stage 2 waterfall card:', e);
    return null;
  }
}

// ═══════════════════════════════════════════════
// STAGE 2 RESULT — Canvas Card
// ═══════════════════════════════════════════════

async function generateStage2ResultCard(selectedMap, commanderName, eventText, isChest, mapChoice) {
  const canvas = createCanvas(CARD_WIDTH, 320);
  const ctx = canvas.getContext('2d');

  // Map background
  let bgImg = null;
  const mapPath = path.join(__dirname, '..', 'assets', 'maps', `map${mapChoice}.png`);
  if (fs.existsSync(mapPath)) {
    try { bgImg = await loadImage(mapPath); } catch (e) {}
  }
  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, CARD_WIDTH, 320);
  } else {
    const grad = ctx.createLinearGradient(0, 0, CARD_WIDTH, 320);
    grad.addColorStop(0, isChest ? '#1a001a' : '#001a33');
    grad.addColorStop(1, isChest ? '#330033' : '#003366');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CARD_WIDTH, 320);
  }

  const pm = 15;
  drawRoundedRect(ctx, pm, pm, CARD_WIDTH - pm * 2, 320 - pm * 2, 18);
  ctx.fillStyle = 'rgba(10, 10, 30, 0.88)';
  ctx.fill();

  const accentColor = isChest ? '#E040FB' : '#00E5FF';
  const borderGrad = ctx.createLinearGradient(pm, pm, CARD_WIDTH - pm, 320 - pm);
  borderGrad.addColorStop(0, `${accentColor}80`);
  borderGrad.addColorStop(1, '#00E67680');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Header
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#00E676';
  const titleIcon = isChest ? '📦' : '💧';
  ctx.fillText(`${titleIcon} STAGE 2 SELESAI ━━ KEJADIAN SELESAI ✅`, CARD_WIDTH / 2, 60);

  // Result box
  const boxW = 700;
  const boxH = 120;
  const boxX = (CARD_WIDTH - boxW) / 2;
  const boxY = 85;
  drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 12);
  ctx.fillStyle = `${accentColor}10`;
  ctx.fill();
  ctx.strokeStyle = `${accentColor}30`;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = accentColor;
  ctx.fillText('📢 Keputusan:', boxX + 25, boxY + 30);

  ctx.font = '13px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  const cleanEventText = eventText.replace(/\*\*/g, '').replace(/└─\s*/g, '  → ');
  const evLines = cleanEventText.split('\n');
  let ey = boxY + 55;
  for (const line of evLines) {
    if (ey > boxY + boxH - 10) break;
    ctx.fillText(line.substring(0, 80), boxX + 25, ey);
    ey += 20;
  }

  ctx.textAlign = 'center';
  ctx.font = '12px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText(`👤 @${commanderName}  ·  ⏳ Gerbang Bos Akhir terbuka...`, CARD_WIDTH / 2, 250);

  ctx.font = '9px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillText('Kosan 1A RPG · Pet Expedition Stage 2 Complete', CARD_WIDTH / 2, 290);

  return canvas.toBuffer('image/png');
}

async function getStage2ResultAttachment(selectedMap, commanderName, eventText, isChest, mapChoice) {
  try {
    const buffer = await generateStage2ResultCard(selectedMap, commanderName, eventText, isChest, mapChoice);
    return new AttachmentBuilder(buffer, { name: 'expedition_stage2_result.png' });
  } catch (e) {
    console.error('[PetCard] Error generating Stage 2 result card:', e);
    return null;
  }
}

module.exports = {
  generatePetCard,
  generatePvpCard,
  generateStandingsCard,
  generateExpeditionCard,
  generateExpeditionLobbyCard,
  generateExpeditionLoadingCard,
  generateExpeditionStageTransitionCard,
  generateExpeditionQteStepCard,
  generateExpeditionQteFailureCard,
  generateStage1PathSelectionCard,
  generateStage1ResultCard,
  generateStage2ChestCard,
  generateStage2WaterfallCard,
  generateStage2ResultCard,
  getPetCardAttachment,
  getPvpCardAttachment,
  getStandingsCardAttachment,
  getExpeditionCardAttachment,
  getExpeditionLobbyAttachment,
  getExpeditionLoadingAttachment,
  getExpeditionStageTransitionAttachment,
  getExpeditionQteStepAttachment,
  getExpeditionQteFailureAttachment,
  getStage1PathSelectionAttachment,
  getStage1ResultAttachment,
  getStage2ChestAttachment,
  getStage2WaterfallAttachment,
  getStage2ResultAttachment,
  loadImageSafe,
  RARITY_COLORS,
  ELEMENT_THEMES,
};


