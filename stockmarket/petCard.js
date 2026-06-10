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

// Font strategy: Load custom Inter fonts if available, fall back to DejaVu Sans.
try {
  const fontsDir = path.join(__dirname, '..', 'assets', 'fonts');
  const regFontPath = path.join(fontsDir, 'Inter-Regular.otf');
  const boldFontPath = path.join(fontsDir, 'Inter-Bold.otf');

  let hasCustomFont = false;
  if (fs.existsSync(regFontPath)) {
    GlobalFonts.registerFromPath(regFontPath, 'Inter');
    hasCustomFont = true;
  }
  if (fs.existsSync(boldFontPath)) {
    GlobalFonts.registerFromPath(boldFontPath, 'Inter');
  }

  if (hasCustomFont) {
    console.log('[PetCard] ✅ Custom Inter fonts registered successfully.');
    GlobalFonts.setAlias('DejaVu Sans', 'Inter');
    GlobalFonts.setAlias('Segoe UI', 'Inter');
    GlobalFonts.setAlias('Arial', 'Inter');
  } else {
    console.log('[PetCard] ⚠️ Custom Inter font files not found, falling back to system fonts.');
    if (GlobalFonts.has('DejaVu Sans')) {
      GlobalFonts.setAlias('Segoe UI', 'DejaVu Sans');
      GlobalFonts.setAlias('Arial', 'DejaVu Sans');
      console.log('[PetCard] ✅ Font aliases set: Segoe UI -> DejaVu Sans, Arial -> DejaVu Sans');
    } else {
      console.warn('[PetCard] ⚠️ DejaVu Sans not found in system fonts, text may not render.');
    }
  }
} catch (e) {
  console.warn('[PetCard] ⚠️ Custom font registration failed:', e.message);
  try {
    if (GlobalFonts.has('DejaVu Sans')) {
      GlobalFonts.setAlias('Segoe UI', 'DejaVu Sans');
      GlobalFonts.setAlias('Arial', 'DejaVu Sans');
    }
  } catch (err) {}
}



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
const EXP_WIDTH = 1600;
const EXP_HEIGHT = 900;

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

  const barFontSize = Math.max(11, Math.floor(height * 0.45));
  const padding = Math.max(8, Math.floor(height * 0.25));

  // Label teks (di dalam bar)
  if (label) {
    ctx.font = `bold ${barFontSize}px "DejaVu Sans", sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + padding, y + height / 2);
  }

  // Value teks (di dalam bar, kanan)
  if (valueText) {
    ctx.font = `${barFontSize}px "DejaVu Sans", sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(valueText, x + width - padding, y + height / 2);
  }
  ctx.textBaseline = 'alphabetic'; // reset baseline
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
  ctx.font = `bold ${fontSize}px "DejaVu Sans", sans-serif`;
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
    ctx.font = 'bold 40px "DejaVu Sans", sans-serif';
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
    ctx.font = 'bold 9px "DejaVu Sans", sans-serif';
    const w = ctx.measureText(text).width + 16;
    drawBadge(ctx, avatarCX - w / 2, avatarCY + avatarRadius + 40, text, '#FF9800', '#FFFFFF', 9);
  } else {
    const statusLabels = {
      BABY: 'Baby', ADULT: 'Adult', EGG: 'Telur', DEAD: 'Mati', ACTIVE: 'Aktif'
    };
    ctx.font = '11px "DejaVu Sans", sans-serif';
    ctx.fillStyle = statusColor;
    ctx.textAlign = 'center';
    ctx.fillText(statusLabels[statusKey] || statusKey, avatarCX, avatarCY + avatarRadius + 52);
  }

  // ── [5] IDENTITAS PET (tengah) ──
  const infoX = 245;
  let infoY = 48;

  // Pet Name (besar, bold)
  ctx.font = 'bold 26px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  // Truncate nama jika terlalu panjang
  let displayName = pet.pet_name || 'Unknown Pet';
  if (displayName.length > 18) displayName = displayName.substring(0, 17) + '…';
  ctx.fillText(displayName, infoX, infoY + 26);

  // Species + Level
  infoY += 38;
  ctx.font = '14px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(`${pet.pet_type} · Lv.${pet.level}`, infoX, infoY + 14);

  // Badges row
  infoY += 26;
  let badgeX = infoX;
  const maxBadgeX = 490 - 15; // 475

  const drawBadgeWithWrap = (text, bgColor, textColor = '#FFFFFF', fontSize = 12) => {
    ctx.font = `bold ${fontSize}px "DejaVu Sans", sans-serif`;
    const w = ctx.measureText(text).width + 20; // padX = 10
    if (badgeX + w > maxBadgeX) {
      infoY += 26;
      badgeX = infoX;
    }
    const realW = drawBadge(ctx, badgeX, infoY, text, bgColor, textColor, fontSize);
    badgeX += realW + 6;
  };

  // Rarity badge
  drawBadgeWithWrap(rarity, rarityTheme.primary, '#FFFFFF', 12);

  // Element badge
  drawBadgeWithWrap(element, 'rgba(255,255,255,0.15)', '#FFFFFF', 12);

  // Trait badge(s)
  if (pet.trait) {
    drawBadgeWithWrap(pet.trait.toUpperCase(), 'rgba(255,200,0,0.2)', '#FFD54F', 12);
  }

  // Second trait (gacha_trait2)
  if (pet.gacha_trait2) {
    drawBadgeWithWrap(pet.gacha_trait2.toUpperCase(), 'rgba(255,200,0,0.2)', '#FFD54F', 12);
  }

  // Accessory badge
  if (pet.accessory) {
    const accNames = { COLLAR_IRON: 'Kalung Besi', SWORD_TOY: 'Pedang Mainan', SHIELD_TOY: 'Tameng Mainan', LUCKY_AMULET: 'Jimat Keberuntungan' };
    const accName = accNames[pet.accessory] || pet.accessory;
    drawBadgeWithWrap(accName.toUpperCase(), 'rgba(100,255,200,0.15)', '#80CBC4', 12);
  }

  // ── [6] STATS BARS (kanan atas) ──
  const barX = 490;
  let barY = 48;
  const barWidth = 395;
  const barHeight = 22;
  const barGap = 8;

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
  ctx.font = 'bold 15px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.textAlign = 'left';
  ctx.fillText('COMBAT STATS', statsX, statsY + 18);

  // Stats grid (2 rows x 4 cols)
  const gridY1 = statsY + 36;
  const gridY2 = statsY + 74;
  const colWidth = 160;

  const drawStatItem = (x, y, label, value, color) => {
    ctx.font = '13px "DejaVu Sans", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.textAlign = 'left';
    ctx.fillText(label, x, y);

    ctx.font = 'bold 22px "DejaVu Sans", sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(value, x, y + 24);
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
  let bottomY = sep2Y + 18;
  ctx.font = '14px "DejaVu Sans", sans-serif';
  ctx.textAlign = 'left';

  // Column 1: Auto-Feed
  const autoFeedLabel = pet.auto_feed === 1 ? 'Makan Otomatis' : pet.auto_feed === 2 ? 'Makan & Minum Otomatis' : 'Nonaktif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('Auto-Feed:', statsX, bottomY);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(autoFeedLabel, statsX + 85, bottomY);

  // Column 2: Expedition Status
  const expX = statsX + 280;
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
    ctx.font = 'bold 14px "DejaVu Sans", sans-serif';
    ctx.fillText(`COOLDOWN (${cdStr})`, expX + 75, bottomY);
  } else {
    const tiketSisa = Math.max(0, 6 - expCount);
    ctx.fillStyle = tiketSisa > 0 ? '#00E676' : '#FF9800';
    ctx.font = 'bold 14px "DejaVu Sans", sans-serif';
    ctx.fillText(`${tiketSisa}/6 Tiket`, expX + 75, bottomY);
  }
  ctx.font = '14px "DejaVu Sans", sans-serif'; // reset font style

  // Column 1 Line 2: Curse Status
  if (pet.curse_until && pet.curse_until > nowSec) {
    const curseY = bottomY + 20;
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

      ctx.font = '14px "DejaVu Sans", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.textAlign = 'left';
      const ownerName = ownerUser.username || ownerUser.displayName || 'User';
      ctx.fillText(`Owner: ${ownerName}`, oaCx + oaR + 8, footerY + 13);
    }
  }

  // Watermark (kanan bawah)
  ctx.font = '13px "DejaVu Sans", sans-serif';
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
  ctx.font = 'bold 22px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FF4444';
  ctx.textAlign = 'center';
  ctx.fillText('PVP ARENA RESULT', CARD_WIDTH / 2, 45);

  // VS emblem (center)
  ctx.font = 'bold 40px "DejaVu Sans", sans-serif';
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
    ctx.font = 'bold 28px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(pet1.pet_type.charAt(0), p1x, p1y + 10);
  }

  // Pet 1 info
  ctx.font = 'bold 15px "DejaVu Sans", sans-serif';
  ctx.fillStyle = result.winner === pet1.pet_name ? '#00E676' : '#FF5252';
  ctx.textAlign = 'center';
  const p1Result = result.winner === pet1.pet_name ? 'WINNER' : 'DEFEATED';
  ctx.fillText(p1Result, p1x, 80);

  ctx.font = 'bold 14px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  let p1Name = pet1.pet_name;
  if (p1Name.length > 16) p1Name = p1Name.substring(0, 15) + '…';
  ctx.fillText(p1Name, p1x, 210);

  ctx.font = '12px "DejaVu Sans", sans-serif';
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
    ctx.font = 'bold 28px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(pet2.pet_type.charAt(0), p2x, p2y + 10);
  }

  // Pet 2 info
  ctx.font = 'bold 15px "DejaVu Sans", sans-serif';
  ctx.fillStyle = result.winner === pet2.pet_name ? '#00E676' : '#FF5252';
  ctx.textAlign = 'center';
  const p2Result = result.winner === pet2.pet_name ? 'WINNER' : 'DEFEATED';
  ctx.fillText(p2Result, p2x, 80);

  ctx.font = 'bold 14px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  let p2Name = pet2.pet_name;
  if (p2Name.length > 16) p2Name = p2Name.substring(0, 15) + '…';
  ctx.fillText(p2Name, p2x, 210);

  ctx.font = '12px "DejaVu Sans", sans-serif';
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
  ctx.font = '10px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.textAlign = 'center';
  ctx.fillText('Kosan 1A RPG · PvP Arena', CARD_WIDTH / 2, 295);

  return canvas.toBuffer('image/png');
}


// ═══════════════════════════════════════════════
// NEW GENERATORS: Profile Tabs (Dashboard, Portfolio, Property) & Leaderboards
// ═══════════════════════════════════════════════

/**
 * Generate kartu profil dashboard utama
 */
async function generateProfileDashboardCard(user, wallet, bankBalance, portfolioValue, extraData) {
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');

  const totalWealth = wallet.balance + bankBalance + portfolioValue;

  const getTierInfo = (t) => {
    if (t >= 50000) return { name: 'DIAMOND', emoji: '💎', color: '#00E5FF', darkColor: '#00363A' };
    if (t >= 20000) return { name: 'GOLD', emoji: '👑', color: '#FFD700', darkColor: '#3A3000' };
    if (t >= 10000) return { name: 'SILVER', emoji: '🥈', color: '#BDC3C7', darkColor: '#1F2421' };
    if (t >= 5000) return { name: 'BRONZE', emoji: '🥉', color: '#E67E22', darkColor: '#2B1100' };
    return { name: 'STARTER', emoji: '🪵', color: '#95A5A6', darkColor: '#1C2022' };
  };
  const tier = getTierInfo(totalWealth);

  // Background - Dark Celestial Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  bgGrad.addColorStop(0, '#0D0E15');
  bgGrad.addColorStop(0.5, '#16192B');
  bgGrad.addColorStop(1, '#0D0E15');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Decorative grid lines
  ctx.globalAlpha = 0.03;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  for (let i = 0; i < CARD_WIDTH; i += 40) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CARD_HEIGHT); ctx.stroke();
  }
  for (let i = 0; i < CARD_HEIGHT; i += 40) {
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(CARD_WIDTH, i); ctx.stroke();
  }
  ctx.globalAlpha = 1.0;

  // Dark Overlay Card Container
  const margin = 15;
  drawRoundedRect(ctx, margin, margin, CARD_WIDTH - margin * 2, CARD_HEIGHT - margin * 2, 20);
  ctx.fillStyle = 'rgba(13, 15, 28, 0.82)';
  ctx.fill();

  // Card Glow Border
  const borderGrad = ctx.createLinearGradient(margin, margin, CARD_WIDTH - margin, CARD_HEIGHT - margin);
  borderGrad.addColorStop(0, tier.color);
  borderGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
  borderGrad.addColorStop(1, tier.color);
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // LEFT PANEL: User Info
  // Avatar loading & drawing
  let avatarImg = null;
  if (user.displayAvatarURL) {
    const avatarURL = user.displayAvatarURL({ extension: 'png', size: 256 });
    avatarImg = await loadImageSafe(avatarURL);
  }
  const cx = 145, cy = 135, r = 65;
  if (avatarImg) {
    drawCircleAvatar(ctx, avatarImg, cx, cy, r, tier.color, `${tier.color}40`);
  } else {
    // Fallback avatar
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = tier.color; ctx.fill();
    ctx.font = 'bold 36px "Inter", "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#111'; ctx.textAlign = 'center';
    ctx.fillText((user.username || 'U').charAt(0).toUpperCase(), cx, cy + 12);
  }

  // Tag & Username
  ctx.font = 'bold 20px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  const nameText = user.username ? user.username.toUpperCase() : 'USER';
  ctx.fillText(nameText, cx, 230);

  // Tier Badge
  drawBadge(ctx, cx - 80, 245, `${tier.name} MEMBER`, tier.darkColor, tier.color, 11);

  // Stats
  ctx.textAlign = 'left';
  ctx.fillStyle = '#A0AABF';
  ctx.font = '13px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillText(`Daily Streak: ${wallet.streak_days} Hari`, 55, 305);
  ctx.fillText(`Auto-Trade: ${wallet.auto_trade ? 'Aktif' : 'Nonaktif'}`, 55, 335);
  ctx.fillText(`Masuk Sel: ${wallet.jail_count || 0} Kali`, 55, 365);

  // Vertical Separator Line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath(); ctx.moveTo(280, 40); ctx.lineTo(280, 380); ctx.stroke();

  // RIGHT PANEL: Financial Dashboard Grid
  ctx.textAlign = 'left';
  ctx.font = 'bold 22px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('FINANCIAL DASHBOARD', 315, 60);

  const drawFinancialBox = (x, y, w, h, title, amount, mainColor) => {
    // Glass card background
    drawRoundedRect(ctx, x, y, w, h, 14);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Side accent light indicator
    ctx.fillStyle = mainColor;
    drawRoundedRect(ctx, x, y + 10, 4, h - 20, 2);
    ctx.fill();

    // Box labels
    ctx.font = 'bold 11px "Inter", "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#8E9AA8';
    ctx.fillText(title.toUpperCase(), x + 18, y + 30);

    ctx.font = 'bold 18px "Inter", "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('Rp ' + Math.floor(amount).toLocaleString('id-ID'), x + 18, y + 65);
  };

  const gridX1 = 315, gridX2 = 605, gridW = 270, gridH = 90;
  drawFinancialBox(gridX1, 85, gridW, gridH, 'Saldo Dompet', wallet.balance, '#FFD700');
  drawFinancialBox(gridX2, 85, gridW, gridH, 'Saldo Bank', bankBalance, '#00E676');
  drawFinancialBox(gridX1, 195, gridW, gridH, 'Nilai Investasi', portfolioValue, '#00B0FF');
  drawFinancialBox(gridX2, 195, gridW, gridH, 'Total Kekayaan', totalWealth, tier.color);

  // Status Effects & Luxury Badges Row
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath(); ctx.moveTo(315, 305); ctx.lineTo(875, 305); ctx.stroke();

  // Draw Luxury Badges
  let badgeX = 315;
  let hasBadges = false;
  try {
    const db = require('./database');
    const luxuryItems = db.all(
      "SELECT item_id FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id IN ('LAMBO', 'GOLD', 'KEY', 'ROLEX', 'IPHONE') AND quantity > 0",
      [user.id, wallet.guild_id]
    );
    if (luxuryItems && luxuryItems.length > 0) {
      hasBadges = true;
      luxuryItems.forEach(item => {
        let text = '', color = '#7F8C8D';
        if (item.item_id === 'LAMBO') { text = 'LAMBO'; color = '#E74C3C'; }
        if (item.item_id === 'GOLD') { text = 'GOLD'; color = '#F1C40F'; }
        if (item.item_id === 'KEY') { text = 'PENTHOUSE'; color = '#9B59B6'; }
        if (item.item_id === 'ROLEX') { text = 'ROLEX'; color = '#1ABC9C'; }
        if (item.item_id === 'IPHONE') { text = 'IPHONE'; color = '#34495E'; }
        badgeX += drawBadge(ctx, badgeX, 330, text, color, '#FFFFFF', 10) + 8;
      });
    }
  } catch (e) {
    console.error('[Canvas Dashboard] Failed to load badges:', e.message);
  }

  if (!hasBadges) {
    ctx.font = 'italic 12px "Inter", "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#5A6270';
    ctx.fillText('Belum memiliki Lencana Status Mewah', 315, 345);
  }

  // Draw warnings (WANTED / JAILED)
  const nowSec = Math.floor(Date.now() / 1000);
  const isWanted = extraData.wantedUntil && extraData.wantedUntil > nowSec;
  const isJailed = wallet.jail_until && wallet.jail_until > nowSec;
  if (isWanted || isJailed) {
    ctx.fillStyle = 'rgba(255, 51, 102, 0.1)';
    drawRoundedRect(ctx, 315, 370, 560, 32, 6);
    ctx.fill();
    ctx.font = 'bold 11px "Inter", "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#FF3366';
    let msg = 'STATUS AKTIF: ';
    if (isJailed) msg += 'DIPENJARA ';
    if (isWanted) msg += 'BURONAN (WANTED) ';
    ctx.fillText(msg, 325, 390);
  }

  return canvas.toBuffer('image/png');
}

/**
 * Generate kartu portofolio saham
 */
async function generatePortfolioCard(user, wallet, portfolioValue, portfolioItems) {
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background - Dark Celestial Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  bgGrad.addColorStop(0, '#0a0d16');
  bgGrad.addColorStop(0.5, '#111526');
  bgGrad.addColorStop(1, '#0a0d16');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const margin = 15;
  drawRoundedRect(ctx, margin, margin, CARD_WIDTH - margin * 2, CARD_HEIGHT - margin * 2, 20);
  ctx.fillStyle = 'rgba(12, 14, 27, 0.85)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.15)'; // Green portfolio outline tint
  ctx.lineWidth = 2;
  ctx.stroke();

  // LEFT PANEL: Portfolio Summary
  ctx.font = 'bold 22px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.fillText('PORTOFOLIO INVESTASI', 45, 60);

  ctx.font = '12px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#8E9AA8';
  ctx.fillText('TOTAL NILAI INVESTASI', 45, 95);

  ctx.font = 'bold 28px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#10B981';
  ctx.fillText('Rp ' + Math.floor(portfolioValue).toLocaleString('id-ID'), 45, 130);

  // Profit / Loss calculation
  let totalProfit = 0;
  let totalInvested = 0;
  if (portfolioItems && portfolioItems.length > 0) {
    portfolioItems.forEach(i => {
      totalProfit += i.profitRp || 0;
      totalInvested += i.totalInvested || ((i.shares || 0) * (i.avgPriceRp || 0));
    });
  }

  let profitPercent = 0;
  if (totalInvested > 0) {
    profitPercent = Math.round((totalProfit / totalInvested) * 1000) / 10;
  }

  const sign = totalProfit > 0 ? '+' : '';
  const plColor = totalProfit > 0 ? '#10B981' : totalProfit < 0 ? '#FF3366' : '#8E9AA8';
  ctx.font = 'bold 14px "DejaVu Sans", sans-serif';
  ctx.fillStyle = plColor;
  ctx.fillText(`${totalProfit > 0 ? '▲' : totalProfit < 0 ? '▼' : '─'} Profit/Loss: ${sign}${profitPercent}% (${sign}Rp ${Math.abs(totalProfit).toLocaleString('id-ID')})`, 45, 160);

  // Allocation Bar chart
  ctx.font = 'bold 11px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#8E9AA8';
  ctx.fillText('ALOKASI ASET SAHAM', 45, 210);

  const barX = 45, barY = 225, barW = 280, barH = 22;
  drawRoundedRect(ctx, barX, barY, barW, barH, 6);
  ctx.fillStyle = '#1A1D2C';
  ctx.fill();

  if (portfolioItems && portfolioItems.length > 0 && portfolioValue > 0) {
    let currentX = barX;
    const colors = ['#60A5FA', '#34D399', '#FB7185', '#FBBF24', '#C084FC', '#22D3EE'];
    ctx.save();
    drawRoundedRect(ctx, barX, barY, barW, barH, 6);
    ctx.clip();

    portfolioItems.forEach((item, idx) => {
      const shareVal = item.currentValue || (item.shares * (item.currentPriceRp || 0));
      const pct = shareVal / portfolioValue;
      const segmentW = barW * pct;
      ctx.fillStyle = colors[idx % colors.length];
      ctx.fillRect(currentX, barY, segmentW, barH);
      currentX += segmentW;
    });
    ctx.restore();

    // Allocation Legends below
    let legendY = 270;
    portfolioItems.slice(0, 4).forEach((item, idx) => {
      const shareVal = item.currentValue || (item.shares * (item.currentPriceRp || 0));
      const pct = Math.round((shareVal / portfolioValue) * 100);
      ctx.fillStyle = colors[idx % colors.length];
      ctx.beginPath(); ctx.arc(45, legendY - 4, 5, 0, Math.PI * 2); ctx.fill();

      ctx.font = 'bold 12px "DejaVu Sans", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(`${item.ticker}`, 60, legendY);

      ctx.font = '12px "DejaVu Sans", sans-serif';
      ctx.fillStyle = '#A0AABF';
      ctx.fillText(`${pct}% (${item.shares} lbr)`, 120, legendY);

      legendY += 28;
    });
  } else {
    ctx.font = 'italic 12px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#5A6270';
    ctx.fillText('Tidak ada aset saham dalam portofolio.', 45, 250);
  }

  // Vertical Separator
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath(); ctx.moveTo(350, 40); ctx.lineTo(350, 380); ctx.stroke();

  // RIGHT PANEL: Stocks Details Table
  ctx.font = 'bold 14px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('RINCIAN KEPEMILIKAN ASET SAHAM', 380, 60);

  // Table header row
  const tableYStart = 90;
  ctx.font = 'bold 11px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#5A6270';
  ctx.fillText('KODE', 380, tableYStart);
  ctx.fillText('JUMLAH', 460, tableYStart);
  ctx.fillText('RATA-RATA', 550, tableYStart);
  ctx.fillText('HARGA SEKARANG', 660, tableYStart);
  ctx.textAlign = 'right';
  ctx.fillText('P/L (%)', 875, tableYStart);
  ctx.textAlign = 'left';

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(380, tableYStart + 8); ctx.lineTo(875, tableYStart + 8); ctx.stroke();

  if (portfolioItems && portfolioItems.length > 0) {
    let rowY = tableYStart + 35;
    portfolioItems.slice(0, 6).forEach(item => {
      ctx.font = 'bold 13px "DejaVu Sans", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(item.ticker, 380, rowY);

      ctx.font = '13px "DejaVu Sans", sans-serif';
      ctx.fillStyle = '#A0AABF';
      ctx.fillText(`${item.shares} lbr`, 460, rowY);
      ctx.fillText(`Rp ${Math.floor(item.avgPriceRp).toLocaleString('id-ID')}`, 550, rowY);
      ctx.fillText(`Rp ${Math.floor(item.currentPriceRp).toLocaleString('id-ID')}`, 660, rowY);

      // Profit status
      const plPct = item.profitPercent || 0;
      const profitText = `${plPct > 0 ? '+' : ''}${plPct}%`;
      const badgeColor = plPct > 0 ? 'rgba(16, 185, 129, 0.15)' : plPct < 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)';
      const textCol = plPct > 0 ? '#10B981' : plPct < 0 ? '#EF4444' : '#8E9AA8';

      // Draw P/L badge pill
      ctx.textAlign = 'right';
      drawBadge(ctx, 810, rowY - 12, profitText, badgeColor, textCol, 11);
      ctx.textAlign = 'left';

      // Subtle row border line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.beginPath(); ctx.moveTo(380, rowY + 10); ctx.lineTo(875, rowY + 10); ctx.stroke();

      rowY += 44;
    });
  } else {
    ctx.font = 'italic 13px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#5A6270';
    ctx.fillText('Gunakan perintah .buy <kode_saham> <jumlah> untuk berinvestasi.', 380, tableYStart + 50);
  }

  return canvas.toBuffer('image/png');
}

/**
 * Generate kartu kos & kebun properti
 */
async function generatePropertyCard(user, wallet, extraData) {
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background - Dark Celestial Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  bgGrad.addColorStop(0, '#0c0d16');
  bgGrad.addColorStop(0.5, '#151323');
  bgGrad.addColorStop(1, '#0c0d16');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const margin = 15;
  drawRoundedRect(ctx, margin, margin, CARD_WIDTH - margin * 2, CARD_HEIGHT - margin * 2, 20);
  ctx.fillStyle = 'rgba(12, 11, 23, 0.85)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.15)'; // Purple estate tint outline
  ctx.lineWidth = 2;
  ctx.stroke();

  // LEFT PANEL: Kos Rental Management
  ctx.font = 'bold 22px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.fillText('STATUS KOSAN & PROPERTI', 45, 60);

  const kos = extraData.kosRental;
  let roomTitle = 'Kos Biasa / Tanpa Sewa';
  let roomColor = '#95A5A6';
  let roomGlow = 'rgba(149, 165, 166, 0.1)';
  let roomIcon = 'home';

  if (kos) {
    if (kos.room_tier === 'KIPAS') { roomTitle = 'Kamar Kipas Angin'; roomColor = '#3498DB'; roomIcon = 'wind'; roomGlow = 'rgba(52, 152, 219, 0.15)'; }
    else if (kos.room_tier === 'AC') { roomTitle = 'Kamar AC Nyaman'; roomColor = '#2ECC71'; roomIcon = 'snowflake'; roomGlow = 'rgba(46, 204, 113, 0.15)'; }
    else if (kos.room_tier === 'PENTHOUSE') { roomTitle = 'Penthouse Eksekutif'; roomColor = '#F1C40F'; roomIcon = 'crown'; roomGlow = 'rgba(241, 196, 15, 0.2)'; }
  }

  // Draw Kos Room Card block
  const kosX = 45, kosY = 85, kosW = 280, kosH = 120;
  drawRoundedRect(ctx, kosX, kosY, kosW, kosH, 12);
  ctx.fillStyle = roomGlow;
  ctx.fill();
  ctx.strokeStyle = roomColor + '40';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Draw premium vector icon instead of raw emoji
  let vectorIconName = 'home';
  if (roomIcon === 'wind') vectorIconName = 'wave'; 
  else if (roomIcon === 'snowflake') vectorIconName = 'clock'; // placeholder
  else if (roomIcon === 'crown') vectorIconName = 'trophy';
  drawPremiumIcon(ctx, vectorIconName, kosX + 40, kosY + 60, 32, roomColor);

  ctx.font = 'bold 16px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(roomTitle, kosX + 80, kosY + 45);

  ctx.font = '12px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#A0AABF';
  if (kos) {
    const endsDate = new Date(kos.ends_at * 1000);
    const endsStr = endsDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    ctx.fillText(`Masa Sewa s/d:`, kosX + 80, kosY + 75);
    ctx.fillText(`${endsStr}`, kosX + 80, kosY + 95);
  } else {
    ctx.fillText(`Kamar standart non-sewa.`, kosX + 80, kosY + 75);
    ctx.fillText(`Ketik .kos untuk melihat opsi sewa.`, kosX + 80, kosY + 95);
  }

  // Upgrades list
  ctx.font = 'bold 12px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#8E9AA8';
  ctx.fillText('FASILITAS TAMBAHAN KOS', 45, 235);

  const upgrades = extraData.kosUpgrades || [];
  if (upgrades.length > 0) {
    let uY = 265;
    upgrades.slice(0, 4).forEach((upgrade, idx) => {
      let uLabel = upgrade.upgrade_id || upgrade;
      const mapping = {
        WIFI: 'Internet High-Speed Wifi',
        BED: 'Kasur Busa Ortopedik Premium',
        TV: 'Smart TV 4K Ultra HD',
        DISPENSER: 'Dispenser Air Otomatis'
      };
      const label = mapping[uLabel.toUpperCase()] || uLabel;
      ctx.font = '12px "Inter", "DejaVu Sans", sans-serif';
      ctx.fillStyle = '#10B981';
      ctx.fillText(`+ ${label}`, 45, uY);
      uY += 26;
    });
  } else {
    ctx.font = 'italic 12px "Inter", "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#5A6270';
    ctx.fillText('Kamar belum di-upgrade.', 45, 265);
    ctx.fillText('Beli fasilitas via .kos upgrade.', 45, 290);
  }

  // Vertical Separator
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath(); ctx.moveTo(350, 40); ctx.lineTo(350, 380); ctx.stroke();

  // RIGHT PANEL: Garden Slots Grid
  ctx.font = 'bold 14px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('KEBUN DIGITAL ANDA', 380, 60);

  const slots = extraData.gardenSlots || [];
  const startGX = 380, startGY = 85, gridWidth = 240, gridHeight = 135;

  const drawGardenSlot = (x, y, w, h, slotIndex, slotData) => {
    drawRoundedRect(ctx, x, y, w, h, 10);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Slot header
    ctx.font = 'bold 10px "Inter", "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#8E9AA8';
    ctx.fillText(`SLOT ${slotIndex + 1}`, x + 12, y + 22);

    if (slotData && slotData.seed_id) {
      const seedMapping = {
        PADI: 'Padi',
        JAGUNG: 'Jagung',
        CABAI: 'Cabai',
        TOMAT: 'Tomat',
        WORTEL: 'Wortel'
      };
      const plantName = seedMapping[slotData.seed_id.toUpperCase()] || slotData.seed_id;
      
      // Draw plant icon (using premium leaf vector icon)
      drawPremiumIcon(ctx, 'leaf', x + 24, y + 52, 24, '#2ECC71');

      ctx.font = 'bold 12px "Inter", "DejaVu Sans", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(plantName, x + 50, y + 48);

      // Water count
      ctx.font = '10px "Inter", "DejaVu Sans", sans-serif';
      ctx.fillStyle = '#3498DB';
      ctx.fillText(`Air: ${slotData.water_count || 0}/3`, x + 50, y + 66);

      // Grow progress logic
      let pct = 0;
      try {
        const config = require('./config');
        const seedConfig = config.garden.SEEDS[slotData.seed_id.toUpperCase()];
        if (seedConfig) {
          const duration = seedConfig.grow_time_seconds;
          const plantedAt = slotData.planted_at;
          const elapsed = Math.floor(Date.now() / 1000) - plantedAt;
          pct = Math.min(1, Math.max(0, elapsed / duration));
        }
      } catch (e) {
        pct = 0.5; // fallback
      }

      const isReady = pct >= 1;
      const progressColorStart = isReady ? '#00E676' : '#E91E63';
      const progressColorEnd = isReady ? '#00E676' : '#FFD54F';
      const progressText = isReady ? 'SIAP PANEN' : `${Math.round(pct * 100)}% TUMBUH`;
      drawProgressBar(ctx, x + 12, y + 80, w - 24, 14, pct, progressColorStart, progressColorEnd, null, progressText);

    } else {
      ctx.font = 'italic 12px "Inter", "DejaVu Sans", sans-serif';
      ctx.fillStyle = '#5A6270';
      ctx.fillText('Tanah Kosong', x + 12, y + 55);
      ctx.font = '10px "Inter", "DejaVu Sans", sans-serif';
      ctx.fillText('Ketik .plant untuk menanam', x + 12, y + 75);
    }
  };

  // Render 4 slots (2 columns x 2 rows)
  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const sX = startGX + col * (gridWidth + 15);
    const sY = startGY + row * (gridHeight + 15);
    
    // Find slot info
    const slotData = slots.find(s => s.slot_index === i);
    drawGardenSlot(sX, sY, gridWidth, gridHeight, i, slotData);
  }

  return canvas.toBuffer('image/png');
}

/**
 * Generate visual leaderboard card
 */
async function generateLeaderboardCard(title, listData, unitLabel = 'Rp') {
  const width = 920;
  const height = 500;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background - Dark Celestial Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0a0d16');
  bgGrad.addColorStop(0.5, '#131122');
  bgGrad.addColorStop(1, '#0a0d16');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  const margin = 15;
  drawRoundedRect(ctx, margin, margin, width - margin * 2, height - margin * 2, 20);
  ctx.fillStyle = 'rgba(12, 11, 23, 0.85)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.2)'; // Indigo leaderboard tint
  ctx.lineWidth = 2;
  ctx.stroke();

  // Header Title
  ctx.font = 'bold 22px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.fillText(title.toUpperCase(), width / 2, 55);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath(); ctx.moveTo(45, 75); ctx.lineTo(width - 45, 75); ctx.stroke();

  // Format helper
  const formatValue = (val) => {
    if (unitLabel === 'Rp') {
      return 'Rp ' + Math.floor(val).toLocaleString('id-ID');
    }
    return Math.floor(val).toLocaleString('id-ID') + ' ' + unitLabel;
  };

  // Slice list data to top 10
  const top10 = listData.slice(0, 10);
  const first = top10.find(u => u.rank === 1);
  const second = top10.find(u => u.rank === 2);
  const third = top10.find(u => u.rank === 3);

  // LEFT AREA: Juara Podium (Draw juaras 1, 2, 3)
  const drawPodiumMember = async (pX, pY, pW, pH, member, color, rankNum, crownEmoji) => {
    if (!member) return;

    // Draw avatar above podium
    const avX = pX + pW / 2;
    const avY = pY - 45;
    const avR = 30;

    let avImg = null;
    if (member.avatarURL) {
      avImg = await loadImageSafe(member.avatarURL);
    }

    if (avImg) {
      drawCircleAvatar(ctx, avImg, avX, avY, avR, color, `${color}40`);
    } else {
      ctx.beginPath(); ctx.arc(avX, avY, avR, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.font = 'bold 20px "DejaVu Sans", sans-serif';
      ctx.fillStyle = '#111'; ctx.textAlign = 'center';
      ctx.fillText(member.name.charAt(0).toUpperCase(), avX, avY + 7);
    }

    // Draw podium block
    drawRoundedRect(ctx, pX, pY, pW, pH, 10);
    ctx.fillStyle = color + '22';
    ctx.fill();
    ctx.strokeStyle = color + '60';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw crown / ranking indicator
    ctx.font = 'bold 22px "DejaVu Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(crownEmoji, avX, avY - avR - 10);

    // Rank Number
    ctx.font = 'bold 36px "DejaVu Sans", sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(rankNum.toString(), avX, pY + pH / 2 + 10);

    // Name
    ctx.font = 'bold 12px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(member.name.substring(0, 14), avX, pY + pH - 35);

    // Value
    ctx.font = '10px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#A0AABF';
    ctx.fillText(formatValue(member.value), avX, pY + pH - 15);
  };

  // Draw Juara 2 (Silver)
  await drawPodiumMember(45, 240, 95, 180, second, '#BDC3C7', 2, '🥈');
  // Draw Juara 1 (Gold)
  await drawPodiumMember(155, 200, 110, 220, first, '#FFD700', 1, '👑');
  // Draw Juara 3 (Bronze)
  await drawPodiumMember(280, 260, 95, 160, third, '#E67E22', 3, '🥉');

  // Separator between Podium and List
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath(); ctx.moveTo(400, 95); ctx.lineTo(400, 460); ctx.stroke();

  // RIGHT AREA: Rank 4 to 10 List
  const listX = 425;
  let listY = 115;
  const listRowH = 48;

  ctx.textAlign = 'left';
  const remaining = top10.slice(3); // ranks 4-10
  if (remaining.length > 0) {
    for (const item of remaining) {
      // Background row capsule
      drawRoundedRect(ctx, listX, listY - 14, 435, listRowH - 8, 6);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.01)';
      ctx.fill();

      // Rank
      ctx.font = 'bold 13px "DejaVu Sans", sans-serif';
      ctx.fillStyle = '#8E9AA8';
      ctx.fillText(`#${item.rank}`, listX + 10, listY + 10);

      // Avatar mini
      const mAvX = listX + 50, mAvY = listY + 5, mAvR = 14;
      let mAvImg = null;
      if (item.avatarURL) {
        mAvImg = await loadImageSafe(item.avatarURL);
      }
      if (mAvImg) {
        drawCircleAvatar(ctx, mAvImg, mAvX, mAvY, mAvR, '#99AAB5', null);
      } else {
        ctx.beginPath(); ctx.arc(mAvX, mAvY, mAvR, 0, Math.PI * 2);
        ctx.fillStyle = '#555'; ctx.fill();
      }

      // Name
      ctx.font = 'bold 13px "DejaVu Sans", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(item.name.substring(0, 18), listX + 80, listY + 10);

      // Value
      ctx.font = 'bold 13px "DejaVu Sans", sans-serif';
      ctx.fillStyle = '#10B981';
      ctx.textAlign = 'right';
      ctx.fillText(formatValue(item.value), listX + 425, listY + 10);
      ctx.textAlign = 'left';

      listY += listRowH;
    }
  } else {
    ctx.font = 'italic 13px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#5A6270';
    ctx.fillText('Tidak ada kontestan tambahan.', listX + 15, listY + 50);
  }

  return canvas.toBuffer('image/png');
}

/**
 * Discord Attachment wrappers for new canvas cards
 */
async function getProfileDashboardAttachment(user, wallet, bankBalance, portfolioValue, extraData) {
  try {
    const buffer = await generateProfileDashboardCard(user, wallet, bankBalance, portfolioValue, extraData);
    return new AttachmentBuilder(buffer, { name: 'dashboard_card.png' });
  } catch (e) {
    console.error('[PetCard] Error generating dashboard attachment:', e);
    return null;
  }
}

async function getPortfolioAttachment(user, wallet, portfolioValue, portfolioItems) {
  try {
    const buffer = await generatePortfolioCard(user, wallet, portfolioValue, portfolioItems);
    return new AttachmentBuilder(buffer, { name: 'portfolio_card.png' });
  } catch (e) {
    console.error('[PetCard] Error generating portfolio attachment:', e);
    return null;
  }
}

async function getPropertyAttachment(user, wallet, extraData) {
  try {
    const buffer = await generatePropertyCard(user, wallet, extraData);
    return new AttachmentBuilder(buffer, { name: 'property_card.png' });
  } catch (e) {
    console.error('[PetCard] Error generating property attachment:', e);
    return null;
  }
}

async function getLeaderboardAttachment(title, listData, unitLabel = 'Rp') {
  try {
    const buffer = await generateLeaderboardCard(title, listData, unitLabel);
    return new AttachmentBuilder(buffer, { name: 'leaderboard_card.png' });
  } catch (e) {
    console.error('[PetCard] Error generating leaderboard attachment:', e);
    return null;
  }
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
  ctx.font = 'bold 24px "DejaVu Sans", sans-serif';
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
  ctx.font = 'bold 12px "DejaVu Sans", sans-serif';
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
    ctx.font = 'bold 14px "DejaVu Sans", sans-serif';
    ctx.fillStyle = rankColor;
    ctx.textAlign = 'center';
    ctx.fillText(`${i + 1}`, columns[0].x, y);

    // Pet Name
    ctx.font = 'bold 14px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    let petName = s.petName;
    if (petName.length > 20) petName = petName.slice(0, 18) + '…';
    ctx.fillText(petName, columns[1].x, y);

    // Pawang (Owner)
    ctx.font = '13px "DejaVu Sans", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    let ownerText = pawangName;
    if (ownerText.length > 20) ownerText = ownerText.slice(0, 18) + '…';
    ctx.fillText(ownerText, columns[2].x, y);

    // Stats
    ctx.font = '14px "DejaVu Sans", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.textAlign = 'center';
    ctx.fillText(`${s.played}`, columns[3].x, y);
    ctx.fillText(`${s.won}`, columns[4].x, y);
    ctx.fillText(`${s.lost}`, columns[5].x, y);

    // Points
    ctx.font = 'bold 15px "DejaVu Sans", sans-serif';
    ctx.fillStyle = rankColor;
    ctx.fillText(`${s.points}`, columns[6].x, y);
  }

  // Footer Watermark
  ctx.font = '10px "DejaVu Sans", sans-serif';
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

function getPetElementMatch(participant, mapId) {
  if (!participant) return 'neutral';
  const petType = (participant.pet_type || '').toUpperCase();
  const petRarity = (participant.gacha_rarity || '').toUpperCase();
  const petEl = (participant.gacha_element || '').toUpperCase();
  const mapChoice = parseInt(mapId);

  if (petRarity === 'MYTHIC' || petRarity === 'IMMORTAL') {
    return 'up';
  }

  let elementMod = 0;
  if (mapChoice === 1) {
    if (petEl === 'FIRE' || petType === 'PHOENIX' || petType === 'DRAGON') elementMod = 15;
    else if (petEl === 'WATER' || petType === 'LEVIATHAN') elementMod = -15;
  } else if (mapChoice === 2) {
    if (petEl === 'DRAGON' || petType === 'ARCHDRAGON') elementMod = 15;
    else if (petType === 'PHOENIX') elementMod = -15;
  } else if (mapChoice === 3) {
    if (petEl === 'WATER' || petType === 'LEVIATHAN') elementMod = 15;
    else if (petEl === 'EARTH' || petType === 'TURTLE' || petType === 'BEHEMOTH') elementMod = -15;
  } else if (mapChoice === 4) {
    if (petEl === 'EARTH' || petType === 'TURTLE' || petType === 'BEHEMOTH' || petEl === 'DRAGON' || petType === 'ARCHDRAGON') elementMod = 15;
    else if (petType === 'PHOENIX') elementMod = -15;
  } else if (mapChoice === 5) {
    if (petEl === 'EARTH' || petType === 'TURTLE' || petType === 'BEHEMOTH') elementMod = 15;
    else if (petEl === 'FIRE' || petType === 'PHOENIX' || petType === 'DRAGON') elementMod = -15;
  } else if (mapChoice === 6) {
    if (petEl === 'DRAGON' || petType === 'ARCHDRAGON' || petEl === 'EARTH' || petType === 'TURTLE' || petType === 'BEHEMOTH') elementMod = 15;
    else if (petEl === 'WATER' || petType === 'LEVIATHAN') elementMod = -15;
  } else if (mapChoice === 7) {
    if (petEl === 'FIRE' || petType === 'PHOENIX' || petType === 'DRAGON') elementMod = 15;
    else if (petEl === 'EARTH' || petType === 'TURTLE' || petType === 'BEHEMOTH') elementMod = -15;
  } else if (mapChoice === 8) {
    if (petEl === 'DRAGON' || petType === 'ARCHDRAGON') elementMod = 15;
    else if (petEl === 'FIRE' || petType === 'PHOENIX' || petType === 'DRAGON') elementMod = -15;
  } else if (mapChoice === 9) {
    if (petEl === 'DRAGON' || petType === 'ARCHDRAGON' || petEl === 'FIRE' || petType === 'PHOENIX') elementMod = 15;
    else if (petEl === 'EARTH' || petType === 'TURTLE' || petType === 'BEHEMOTH') elementMod = -15;
  } else if (mapChoice === 10) {
    if (petRarity === 'LEGENDARY') elementMod = 15;
    else if (petRarity === 'COMMON' || !petRarity) elementMod = -15;
  }

  if (elementMod > 0) return 'up';
  if (elementMod < 0) return 'down';
  return 'neutral';
}

/**
 * Generate visual expedition PVE result card
 */
async function generateExpeditionCard(res, mapChoice, guild) {
  const selectedMap = getExpeditionMap(mapChoice);
  const element = (selectedMap?.element || 'EARTH').toUpperCase();
  const theme = ELEMENT_THEMES[element] || ELEMENT_THEMES.EARTH;

  // ─── Helper: Strip emoji & markdown for canvas rendering ───
  const cleanText = (t) => (t || '')
    .replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u27BF]|\uD83E[\uDD00-\uDFFF]|\uD83F[\uDC00-\uDFFF]|\u200D|\uFE0F|\uFE0E/g, '')
    .replace(/\*\*/g, '').replace(/^[>•]\s*/, '').trim();

  // Helper to resolve Discord user mentions to readable names
  const resolveMentions = (t) => {
    return (t || '').replace(/<@(\d+)>/g, (match, userId) => {
      if (guild) {
        try {
          const member = guild.members.cache.get(userId);
          if (member) return `@${member.user.username}`;
        } catch (e) {}
      }
      return '@Pawang';
    });
  };

  // Helper to wrap text
  const wrapText = (text, context, maxWidth) => {
    const words = (text || '').split(' ').filter(w => w.length > 0);
    if (words.length === 0) return [];
    const lines = [];
    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine + ' ' + word;
      const width = context.measureText(testLine).width;
      if (width < maxWidth) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  };

  // ─── Data Preparation & Wrapping ───
  const processedLogs = [];
  const tempCanvas = createCanvas(1, 1);
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.font = '22px "DejaVu Sans", sans-serif';
  const MAX_LOG_WIDTH = 1420; // Leaving safe room within card width (1600px)

  for (let logIdx = 0; logIdx < (res.logs || []).length; logIdx++) {
    const rawLogItem = res.logs[logIdx];
    const textWithMentions = resolveMentions(rawLogItem);
    const rawSubLines = textWithMentions.split('\n');
    
    let isFirstForThisItem = true;
    for (let subLineIdx = 0; subLineIdx < rawSubLines.length; subLineIdx++) {
      const subLine = rawSubLines[subLineIdx];
      const cleanedSubLine = cleanText(subLine);
      if (!cleanedSubLine) continue;

      const wrapped = wrapText(cleanedSubLine, tempCtx, MAX_LOG_WIDTH);
      for (let wIdx = 0; wIdx < wrapped.length; wIdx++) {
        processedLogs.push({
          text: wrapped[wIdx],
          isFirst: isFirstForThisItem,
          parentLogItem: rawLogItem
        });
        isFirstForThisItem = false;
      }
    }
  }

  const rewards = res.rewards || [];
  // Slice to a reasonable max number of log lines to prevent overflow (e.g. 10 wrapped lines max)
  const logsToShow = processedLogs.slice(0, 10);
  const rewardsCount = rewards.length;
  const rewardRows = Math.ceil(Math.max(1, rewardsCount) / 3);
  const hasChest = res.chestAwardedUser && res.chestDropItem;
  const hasMvpBeban = res.bestPet && res.worstPet && res.bestPet.petName !== res.worstPet.petName;

  // ─── Dynamic Canvas Height ───
  const PM = 30;
  const HEADER_H = 200;
  const LOG_LINE_H = 36;
  const LOG_SECTION_H = logsToShow.length > 0 ? (50 + logsToShow.length * LOG_LINE_H + 25) : 10;
  const CHEST_H = hasChest ? 70 : 0;
  const REWARD_CARD_H = 280;
  const REWARD_GAP = 24;
  const REWARD_SECTION_H = rewardsCount > 0 ? (50 + rewardRows * (REWARD_CARD_H + REWARD_GAP) + 5) : 10;
  const FOOTER_H = hasMvpBeban ? 95 : 60;
  const canvasH = Math.max(1100, HEADER_H + LOG_SECTION_H + CHEST_H + REWARD_SECTION_H + FOOTER_H + PM * 2);

  const canvas = createCanvas(EXP_WIDTH, canvasH);
  const ctx = canvas.getContext('2d');

  // ═══════════════════════════════════════════════
  // BACKGROUND — map image or themed gradient
  // ═══════════════════════════════════════════════
  let bgImg = null;
  const mapPath = path.join(__dirname, '..', 'assets', 'maps', `map${mapChoice}.png`);
  if (fs.existsSync(mapPath)) {
    try { bgImg = await loadImage(mapPath); } catch (e) {}
  }
  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, EXP_WIDTH, canvasH);
  } else {
    const bgGrad = ctx.createLinearGradient(0, 0, EXP_WIDTH, canvasH);
    bgGrad.addColorStop(0, theme.bg[0] || '#0f0f26');
    bgGrad.addColorStop(0.5, theme.bg[2] || '#1d0f3a');
    bgGrad.addColorStop(1, theme.bg[0] || '#0f0f26');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, EXP_WIDTH, canvasH);
  }

  // ═══════════════════════════════════════════════
  // GLASSMORPHIC PANEL OVERLAY
  // ═══════════════════════════════════════════════
  drawRoundedRect(ctx, PM, PM, EXP_WIDTH - PM * 2, canvasH - PM * 2, 24);
  ctx.fillStyle = 'rgba(10, 10, 30, 0.88)';
  ctx.fill();
  const panelBorderGrad = ctx.createLinearGradient(PM, PM, EXP_WIDTH - PM, canvasH - PM);
  panelBorderGrad.addColorStop(0, res.success ? 'rgba(0,230,118,0.4)' : 'rgba(213,0,0,0.4)');
  panelBorderGrad.addColorStop(1, res.success ? 'rgba(105,240,174,0.4)' : 'rgba(255,23,68,0.4)');
  ctx.strokeStyle = panelBorderGrad;
  ctx.lineWidth = 3;
  ctx.stroke();

  const cX = PM + 40;
  const cW = EXP_WIDTH - PM * 2 - 80;
  let curY = PM + 16;

  // ═══════════════════════════════════════════════
  // SECTION 1: HEADER
  // ═══════════════════════════════════════════════

  // Status pill badge
  const pillW = 320;
  const pillH = 42;
  drawRoundedRect(ctx, cX, curY + 6, pillW, pillH, pillH / 2);
  ctx.fillStyle = res.success ? 'rgba(0,230,118,0.12)' : 'rgba(213,0,0,0.12)';
  ctx.fill();
  ctx.strokeStyle = res.success ? 'rgba(0,230,118,0.35)' : 'rgba(213,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = 'bold 23px "DejaVu Sans", sans-serif';
  ctx.fillStyle = res.success ? '#00E676' : '#FF1744';
  ctx.textAlign = 'center';
  ctx.fillText(res.success ? 'EKSPEDISI BERHASIL' : 'EKSPEDISI GAGAL', cX + pillW / 2, curY + 34);

  // Main title
  ctx.textAlign = 'left';
  ctx.font = 'bold 45px "DejaVu Sans", sans-serif';
  const titleGrad = ctx.createLinearGradient(cX, curY + 95, cX + 780, curY + 95);
  titleGrad.addColorStop(0, res.success ? '#00E676' : '#FF1744');
  titleGrad.addColorStop(1, res.success ? '#B9F6CA' : '#FF8A80');
  ctx.fillStyle = titleGrad;
  ctx.fillText('EKSPEDISI PET SELESAI!', cX, curY + 85);

  // Zone name
  ctx.font = 'bold 32px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(cleanText(res.zoneName), cX, curY + 125);

  // Stats row
  ctx.font = '24px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText(`Tim Lv.${res.teamPower}  ·  Peluang ${res.successRate}%  ·  Elemen: ${element}`, cX, curY + 160);

  curY += HEADER_H;

  // ─── Divider ───
  ctx.beginPath();
  ctx.moveTo(cX, curY);
  ctx.lineTo(cX + cW, curY);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();
  curY += 5;

  // ═══════════════════════════════════════════════
  // SECTION 2: LOG PERJALANAN
  // ═══════════════════════════════════════════════
  if (logsToShow.length > 0) {
    ctx.font = 'bold 26px "DejaVu Sans", sans-serif';
    ctx.fillStyle = res.success ? '#69F0AE' : '#FF8A80';
    ctx.textAlign = 'left';
    ctx.fillText('LOG PERJALANAN', cX, curY + 30);
    curY += 55;

    ctx.font = '22px "DejaVu Sans", sans-serif';
    for (let i = 0; i < logsToShow.length; i++) {
      const item = logsToShow[i];

      // Draw colored indicator dot ONLY if it is the first line of a log item
      if (item.isFirst) {
        // Color-code dots based on content of the original log item
        let dotColor = 'rgba(255,255,255,0.35)';
        const testText = item.parentLogItem;
        if (/keuntungan|berhasil|bonus|sukses|menaklukan|disita/i.test(testText)) dotColor = '#69F0AE';
        else if (/kelemahan|gagal|terluka|meledak|kerugian/i.test(testText)) dotColor = '#FF8A80';
        else if (/jalur|kejadian|air terjun|peti|menyusup|meminum/i.test(testText)) dotColor = '#FFD740';

        ctx.beginPath();
        ctx.arc(cX + 6, curY - 5, 5, 0, Math.PI * 2);
        ctx.fillStyle = dotColor;
        ctx.fill();
      }

      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(item.text, cX + 24, curY);
      curY += LOG_LINE_H;
    }
    curY += 20;

    // ─── Divider ───
    ctx.beginPath();
    ctx.moveTo(cX, curY);
    ctx.lineTo(cX + cW, curY);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
    curY += 5;
  }

  // ═══════════════════════════════════════════════
  // SECTION 2.5: CHEST DROP BANNER (if applicable)
  // ═══════════════════════════════════════════════
  if (hasChest) {
    const chestBannerH = 52;
    const chestBannerW = cW - 70;
    const chestBannerX = cX + 35;
    drawRoundedRect(ctx, chestBannerX, curY + 2, chestBannerW, chestBannerH, 12);
    ctx.fillStyle = 'rgba(255,215,0,0.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,0,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

    let chestWinner = 'Pawang';
    if (guild) {
      try {
        const m = guild.members.cache.get(res.chestAwardedUser);
        if (m) chestWinner = m.user.username;
      } catch (e) {}
    }
    ctx.font = 'bold 23px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'center';
    ctx.fillText(`PETI KUNO DIBUKA! @${chestWinner} mendapat: ${res.chestDropItem}`, cX + cW / 2, curY + 34);
    curY += chestBannerH + 20;
  }

  // ═══════════════════════════════════════════════
  // SECTION 3: HASIL JARAHAN & STATUS KRU
  // ═══════════════════════════════════════════════
  if (rewardsCount > 0) {
    ctx.font = 'bold 26px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#FFD740';
    ctx.textAlign = 'left';
    ctx.fillText('HASIL JARAHAN & STATUS KRU', cX, curY + 30);
    curY += 60;

    // ─── Card layout calculation (max 3 per row, centered) ───
    const maxCols = Math.min(3, rewardsCount);
    const cardGap = 24;
    const cardW = Math.floor((cW - (maxCols - 1) * cardGap) / maxCols);

    for (let i = 0; i < rewardsCount; i++) {
      const r = rewards[i];
      const col = i % 3;
      const row = Math.floor(i / 3);

      // Calculate centering for possibly-incomplete last row
      const colsInRow = Math.min(3, rewardsCount - row * 3);
      const rowW = colsInRow * cardW + (colsInRow - 1) * cardGap;
      const rowStartX = cX + Math.floor((cW - rowW) / 2);
      const cx = rowStartX + col * (cardW + cardGap);
      const cy = curY + row * (REWARD_CARD_H + REWARD_GAP);

      // ─── Card Panel Background ───
      drawRoundedRect(ctx, cx, cy, cardW, REWARD_CARD_H, 14);
      ctx.fillStyle = 'rgba(255,255,255,0.035)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // ─── Pet Name ───
      ctx.font = 'bold 25px "DejaVu Sans", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      let pn = r.petName || 'Pet';
      if (pn.length > 20) pn = pn.substring(0, 18) + '..';
      ctx.fillText(pn, cx + 20, cy + 40);

      // ─── Owner ───
      let owner = 'Pawang';
      if (guild) {
        try {
          const m = guild.members.cache.get(r.userId);
          if (m) owner = m.user.username;
        } catch (e) {}
      }
      if (owner.length > 20) owner = owner.substring(0, 18) + '..';
      ctx.font = '20px "DejaVu Sans", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillText(`@${owner}`, cx + 20, cy + 68);

      // ─── Separator line ───
      ctx.beginPath();
      ctx.moveTo(cx + 16, cy + 80);
      ctx.lineTo(cx + cardW - 16, cy + 80);
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // ─── Stat Rows ───
      const lx = cx + 20;
      const vx = cx + cardW - 20;
      let sy = cy + 110;
      const srh = 34;

      const drawStat = (label, value, color) => {
        ctx.font = '21px "DejaVu Sans", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillText(label, lx, sy);
        ctx.textAlign = 'right';
        ctx.fillStyle = color;
        let vDisp = value;
        if (vDisp.length > 20) vDisp = vDisp.substring(0, 18) + '..';
        ctx.fillText(vDisp, vx, sy);
        sy += srh;
      };

      // Koin
      drawStat('Koin', res.success ? `+Rp ${(r.koin || 0).toLocaleString('id-ID')}` : '+Rp 0', '#FFD740');
      // XP
      drawStat('XP', `+${r.xpGained || 0} XP`, '#69F0AE');
      // Level
      if (r.levelUp) {
        drawStat('Level', `Naik ke Lv.${r.newLevel}!`, '#00E5FF');
      }
      // Item
      drawStat('Item', r.dropItem || 'Tidak ada', r.dropItem ? '#E040FB' : 'rgba(255,255,255,0.25)');

      // ─── Status Badge (bottom of card) ───
      const statusRaw = cleanText(r.statusText || (res.success ? 'Sehat & Bahagia' : 'Luka & Stress'));
      let sColor = '#FFFFFF';
      let sBg = 'rgba(255,255,255,0.05)';
      if (/sehat|bahagia/i.test(statusRaw)) { sColor = '#69F0AE'; sBg = 'rgba(105,240,174,0.1)'; }
      else if (/terluka|luka|parah/i.test(statusRaw)) { sColor = '#FF8A80'; sBg = 'rgba(255,138,128,0.1)'; }
      else if (/bau|busuk/i.test(statusRaw)) { sColor = '#FFD740'; sBg = 'rgba(255,215,64,0.1)'; }
      else if (/stress|derita|menderita/i.test(statusRaw)) { sColor = '#FF8A80'; sBg = 'rgba(255,138,128,0.1)'; }

      let sDisp = statusRaw;
      if (sDisp.length > 25) sDisp = sDisp.substring(0, 23) + '..';
      ctx.font = '20px "DejaVu Sans", sans-serif';
      const sbTextW = ctx.measureText(sDisp).width;
      const sbW = Math.min(cardW - 32, sbTextW + 30);
      const sbX = cx + (cardW - sbW) / 2;
      const sbY = cy + REWARD_CARD_H - 45;
      drawRoundedRect(ctx, sbX, sbY, sbW, 36, 18);
      ctx.fillStyle = sBg;
      ctx.fill();
      ctx.strokeStyle = sColor + '40';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = sColor;
      ctx.textAlign = 'center';
      ctx.fillText(sDisp, sbX + sbW / 2, sbY + 24);
    }

    curY += rewardRows * (REWARD_CARD_H + REWARD_GAP) + 5;
  }

  // ═══════════════════════════════════════════════
  // FOOTER: MVP & BEBAN + WATERMARK
  // ═══════════════════════════════════════════════
  if (hasMvpBeban) {
    ctx.textAlign = 'center';
    const footY = curY + 20;

    // MVP badge
    ctx.font = 'bold 23px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#FFD700';
    const mvpName = (res.bestPet.petName || '').length > 16 ? res.bestPet.petName.substring(0, 14) + '..' : res.bestPet.petName;
    ctx.fillText(`MVP: ${mvpName} (Lv.${res.bestPet.level})`, EXP_WIDTH / 2 - 230, footY);

    // Separator dot
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('·', EXP_WIDTH / 2, footY);

    // BEBAN badge
    ctx.fillStyle = '#FF5252';
    const bebanName = (res.worstPet.petName || '').length > 16 ? res.worstPet.petName.substring(0, 14) + '..' : res.worstPet.petName;
    ctx.fillText(`BEBAN: ${bebanName} (Lv.${res.worstPet.level})`, EXP_WIDTH / 2 + 230, footY);
  }

  // Watermark
  ctx.font = '18px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.textAlign = 'center';
  ctx.fillText('Kosan 1A RPG · Pet Expedition Result', EXP_WIDTH / 2, canvasH - PM - 12);

  return canvas.toBuffer('image/png');
}

async function getExpeditionCardAttachment(res, mapChoice, guild) {
  try {
    const buffer = await generateExpeditionCard(res, mapChoice, guild);
    if (!buffer) return null;
    return new AttachmentBuilder(buffer, { name: 'expedition_result.png' });
  } catch (e) {
    console.error('[PetCard] Error generating expedition card:', e);
    return null;
  }
}

async function generateExpeditionLobbyCard(initiatorId, selectedMap, participants, successRate, elementalLogs, endTimeUnix, mapChoice, guild) {
  const canvas = createCanvas(EXP_WIDTH, EXP_HEIGHT);
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
    ctx.drawImage(bgImg, 0, 0, EXP_WIDTH, EXP_HEIGHT);
  } else {
    // Fallback thematic gradient
    const theme = ELEMENT_THEMES[(selectedMap.element || 'EARTH').toUpperCase()] || ELEMENT_THEMES.EARTH;
    const colors = theme.bg;
    const grad = ctx.createLinearGradient(0, 0, EXP_WIDTH, EXP_HEIGHT);
    for (let i = 0; i < colors.length; i++) {
      grad.addColorStop(i / (colors.length - 1), colors[i]);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, EXP_WIDTH, EXP_HEIGHT);
  }

  // Glassmorphic overlay panel
  const panelMargin = 20;
  drawRoundedRect(ctx, panelMargin, panelMargin, EXP_WIDTH - panelMargin * 2, EXP_HEIGHT - panelMargin * 2, 24);
  ctx.fillStyle = 'rgba(10, 10, 30, 0.82)';
  ctx.fill();

  // Panel border glow
  const borderGrad = ctx.createLinearGradient(panelMargin, panelMargin, EXP_WIDTH - panelMargin, EXP_HEIGHT - panelMargin);
  borderGrad.addColorStop(0, '#FFD70080');
  borderGrad.addColorStop(1, '#FF8A8080');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Vertical divider between left and right sections
  const dividerX = 570;
  ctx.beginPath();
  ctx.moveTo(dividerX, 55);
  ctx.lineTo(dividerX, EXP_HEIGHT - 55);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // ─── LEFT PANEL (MAP & MATCH INFO) ───
  const leftX = 65;
  let leftY = 85;

  // Title: LOBI EKSPEDISI TIM
  ctx.font = 'bold 38px "DejaVu Sans", sans-serif';
  const titleGrad = ctx.createLinearGradient(leftX, leftY, leftX + 440, leftY);
  titleGrad.addColorStop(0, '#FFD700');
  titleGrad.addColorStop(1, '#FF8A80');
  ctx.fillStyle = titleGrad;
  ctx.textAlign = 'left';
  ctx.fillText('LOBI EKSPEDISI TIM', leftX, leftY + 38);
  leftY += 65;

  // Zone Name
  ctx.font = 'bold 33px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  const cleanZoneName = selectedMap.name.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim();
  ctx.fillText(cleanZoneName, leftX, leftY + 30);
  leftY += 55;

  // Rec level & element
  ctx.font = '25px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(`Rekomendasi: Lv. ${selectedMap.recommendedLevel}+`, leftX, leftY + 25);
  ctx.fillText(`Elemen Zona: ${selectedMap.element || 'Normal'}`, leftX, leftY + 58);
  leftY += 80;

  // Success rate progress bar
  const pct = Math.min(1, Math.max(0, successRate / 100));
  const barColorStart = pct > 0.6 ? '#00E676' : pct > 0.3 ? '#FF9800' : '#FF1744';
  const barColorEnd = pct > 0.6 ? '#69F0AE' : pct > 0.3 ? '#FFD54F' : '#FF8A80';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = 'bold 25px "DejaVu Sans", sans-serif';
  ctx.fillText('PELUANG TIM', leftX, leftY + 22);
  drawProgressBar(ctx, leftX, leftY + 38, 460, 36, pct, barColorStart, barColorEnd, '', `${successRate}%`);
  leftY += 95;

  // Preparation Countdown timer
  const nowSec = Math.floor(Date.now() / 1000);
  const sisaWaktu = Math.max(0, endTimeUnix - nowSec);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = 'bold 25px "DejaVu Sans", sans-serif';
  ctx.fillText('BATAS WAKTU PERSIAPAN', leftX, leftY + 22);

  const timePct = Math.min(1, Math.max(0, sisaWaktu / 30)); // 30s max lobby duration
  drawProgressBar(ctx, leftX, leftY + 38, 460, 36, timePct, '#00E5FF', '#2979FF', '', `${sisaWaktu} Detik`);
  leftY += 100;

  // Leader / Initiator Pawang
  let leaderName = 'Pawang';
  if (guild) {
    try {
      const member = guild.members.cache.get(initiatorId);
      if (member) leaderName = member.user.username;
    } catch (e) {}
  }
  ctx.font = '22px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('Pemimpin Perjalanan:', leftX, leftY + 22);
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 22px "DejaVu Sans", sans-serif';
  ctx.fillText(`@${leaderName}`, leftX + 235, leftY + 22);

  // ─── RIGHT PANEL (GRID OF CREW SLOTS) ───
  // 6 slots: 3 columns x 2 rows
  const slotsColCount = 3;
  const slotsRowCount = 2;
  const colWidth = 300;
  const rowHeight = 280;
  const startSlotX = 610;
  const startSlotY = 110;
  const gap = 20;

  for (let idx = 0; idx < 6; idx++) {
    const colIdx = idx % slotsColCount;
    const rowIdx = Math.floor(idx / slotsColCount);
    const slotX = startSlotX + colIdx * (colWidth + gap);
    const slotY = startSlotY + rowIdx * (rowHeight + gap);

    const participant = participants[idx];

    if (participant) {
      const rarityTheme = RARITY_COLORS[(participant.gacha_rarity || 'COMMON').toUpperCase()] || RARITY_COLORS.COMMON;

      // Draw filled slot background
      drawRoundedRect(ctx, slotX, slotY, colWidth, rowHeight, 14);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.fill();
      ctx.strokeStyle = rarityTheme.primary + '30';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Avatar
      const avCx = slotX + colWidth / 2;
      const avCy = slotY + 85;
      const avR = 52;

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
        ctx.font = 'bold 28px "DejaVu Sans", sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(participant.pet_type.charAt(0), avCx, avCy + 10);
      }

      // Element advantage/disadvantage indicator (↑ / ↓)
      const elMatch = getPetElementMatch(participant, mapChoice);
      if (elMatch !== 'neutral') {
        const indX = avCx + 30;
        const indY = avCy - 30;
        const indR = 12;
        ctx.beginPath();
        ctx.arc(indX, indY, indR, 0, Math.PI * 2);
        ctx.fillStyle = elMatch === 'up' ? '#00E676' : '#FF1744';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = 'bold 18px "DejaVu Sans", sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText(elMatch === 'up' ? '↑' : '↓', indX, indY + 7);
      }

      // Slot Index Indicator (Badge)
      drawBadge(ctx, slotX + 11, slotY + 11, `${idx + 1}`, rarityTheme.primary, '#FFFFFF', 12);

      // Name & Level
      ctx.font = 'bold 20px "DejaVu Sans", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      let petName = participant.pet_name || 'Pet';
      if (petName.length > 14) petName = petName.slice(0, 12) + '…';
      ctx.fillText(petName, avCx, slotY + avR * 2 + 65);

      ctx.font = '17px "DejaVu Sans", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillText(`Lv.${participant.level} ${participant.pet_type}`, avCx, slotY + avR * 2 + 88);

      // Owner Username
      let ownerName = participant.username || 'Pawang';
      if (ownerName.length > 15) ownerName = ownerName.slice(0, 13) + '…';
      ctx.font = 'italic 17px "DejaVu Sans", sans-serif';
      ctx.fillStyle = rarityTheme.primary;
      ctx.fillText(`@${ownerName}`, avCx, slotY + avR * 2 + 112);

    } else {
      // Draw empty slot (dashed border)
      ctx.save();
      ctx.setLineDash([8, 8]);
      drawRoundedRect(ctx, slotX, slotY, colWidth, rowHeight, 14);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      ctx.font = 'bold 18px "DejaVu Sans", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.textAlign = 'center';
      ctx.fillText('SLOT KOSONG', slotX + colWidth / 2, slotY + rowHeight / 2 - 6);
      ctx.font = '16px "DejaVu Sans", sans-serif';
      ctx.fillText('Menunggu Pawang...', slotX + colWidth / 2, slotY + rowHeight / 2 + 19);
    }
  }

  // Footer Watermark
  ctx.font = '16px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.textAlign = 'right';
  ctx.fillText('Kosan 1A RPG · Expedition Lobby', EXP_WIDTH - 50, EXP_HEIGHT - 38);

  return canvas.toBuffer('image/png');
}

async function getExpeditionLobbyAttachment(initiatorId, selectedMap, participants, successRate, elementalLogs, endTimeUnix, mapChoice, guild) {
  try {
    const buffer = await generateExpeditionLobbyCard(initiatorId, selectedMap, participants, successRate, elementalLogs, endTimeUnix, mapChoice, guild);
    if (!buffer) return null;
    return new AttachmentBuilder(buffer, { name: 'lobby_card.png' });
  } catch (e) {
    console.error('[PetCard] Error generating expedition lobby card:', e);
    return null;
  }
}

async function generateExpeditionLoadingCard(selectedMap, leaderId, participants, mapChoice, guild) {
  const canvas = createCanvas(EXP_WIDTH, EXP_HEIGHT);
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
    ctx.drawImage(bgImg, 0, 0, EXP_WIDTH, EXP_HEIGHT);
  } else {
    // Fallback thematic gradient
    const theme = ELEMENT_THEMES[(selectedMap.element || 'EARTH').toUpperCase()] || ELEMENT_THEMES.EARTH;
    const colors = theme.bg;
    const grad = ctx.createLinearGradient(0, 0, EXP_WIDTH, EXP_HEIGHT);
    for (let i = 0; i < colors.length; i++) {
      grad.addColorStop(i / (colors.length - 1), colors[i]);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, EXP_WIDTH, EXP_HEIGHT);
  }

  // Dark overlay
  const panelMargin = 20;
  drawRoundedRect(ctx, panelMargin, panelMargin, EXP_WIDTH - panelMargin * 2, EXP_HEIGHT - panelMargin * 2, 24);
  ctx.fillStyle = 'rgba(10, 10, 30, 0.82)';
  ctx.fill();

  // Panel border glow
  const borderGrad = ctx.createLinearGradient(panelMargin, panelMargin, EXP_WIDTH - panelMargin, EXP_HEIGHT - panelMargin);
  borderGrad.addColorStop(0, '#00E5FF80');
  borderGrad.addColorStop(1, '#7C4DFF80');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 3;
  ctx.stroke();

  // ─── HEADER SECTION ───
  let textY = 110;
  ctx.font = 'bold 40px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#00E5FF';
  ctx.textAlign = 'center';
  ctx.fillText('🧭 MASUK ZONA EKSPEDISI...', EXP_WIDTH / 2, textY);

  textY += 48;
  ctx.font = '26px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillText(`Mempersiapkan penjelajahan di ${selectedMap.name} · Boss: ${selectedMap.boss}`, EXP_WIDTH / 2, textY);

  // ─── LOADING BAR ───
  const barWidth = 1040;
  const barHeight = 38;
  const barX = (EXP_WIDTH / 2) - (barWidth / 2);
  const barY = 218;

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
  ctx.font = 'bold 22px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('MENYELARASKAN KRU PET & LOGISTIK TIM... 100%', EXP_WIDTH / 2, barY + barHeight / 2);
  ctx.textBaseline = 'alphabetic'; // reset

  // ─── MEMBERS / PETS SECTION ───
  let startY = 380;
  ctx.font = 'bold 26px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.textAlign = 'center';
  ctx.fillText('KRU PETUALANG TIM', EXP_WIDTH / 2, startY);

  const colWidth = 250;
  const colGap = 35;
  const numParticipants = participants.length;
  const totalWidth = (numParticipants * colWidth) + ((numParticipants - 1) * colGap);
  const startX = (EXP_WIDTH / 2) - (totalWidth / 2);

  let drawY = startY + 35;

  for (let i = 0; i < numParticipants; i++) {
    const p = participants[i];
    const px = startX + i * (colWidth + colGap);
    const cx = px + colWidth / 2;

    // Draw Column Glass Panel
    drawRoundedRect(ctx, px, drawY, colWidth, 280, 14);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw Pet Avatar inside Column
    const avatarCY = drawY + 80;
    const avatarR = 52;

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
      ctx.font = 'bold 28px "DejaVu Sans", sans-serif';
      ctx.fillStyle = rarityTheme.primary;
      ctx.textAlign = 'center';
      ctx.fillText(p.pet_name.charAt(0), cx, avatarCY + 10);
    }

    // Leader Badge if initiator
    if (p.userId === leaderId) {
      ctx.font = 'bold 12px "DejaVu Sans", sans-serif';
      const badgeText = '👑 KOMANDAN';
      const tw = ctx.measureText(badgeText).width + 16;
      drawBadge(ctx, cx - tw / 2, avatarCY + avatarR + 8, badgeText, '#FFD700', '#1a1a2e', 12);
    }

    // Owner Name
    ctx.font = '20px "DejaVu Sans", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.textAlign = 'center';
    ctx.fillText(`@${p.username}`, cx, drawY + 185);

    // Pet Name
    ctx.font = 'bold 24px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    let petNameDisp = p.pet_name;
    if (petNameDisp.length > 15) petNameDisp = petNameDisp.substring(0, 14) + '…';
    ctx.fillText(petNameDisp, cx, drawY + 217);

    // Level + Species
    ctx.font = '20px "DejaVu Sans", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.textAlign = 'center';
    ctx.fillText(`Lv. ${p.level} ${p.pet_type}`, cx, drawY + 248);
  }

  // Footer Watermark
  ctx.font = '18px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.textAlign = 'center';
  ctx.fillText('Kosan 1A RPG · Pet Expedition Loading Screen', EXP_WIDTH / 2, EXP_HEIGHT - 38);

  return canvas.toBuffer('image/png');
}

async function getExpeditionLoadingAttachment(selectedMap, leaderId, participants, mapChoice, guild) {
  try {
    const buffer = await generateExpeditionLoadingCard(selectedMap, leaderId, participants, mapChoice, guild);
    if (!buffer) return null;
    return new AttachmentBuilder(buffer, { name: 'expedition_loading.png' });
  } catch (e) {
    console.error('[PetCard] Error generating expedition loading card:', e);
    return null;
  }
}

async function generateExpeditionStageTransitionCard(stageNum, stageTitle, selectedMap, mapChoice) {
  const canvas = createCanvas(EXP_WIDTH, EXP_HEIGHT);
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
    ctx.drawImage(bgImg, 0, 0, EXP_WIDTH, EXP_HEIGHT);
  } else {
    const theme = ELEMENT_THEMES[(selectedMap?.element || 'EARTH').toUpperCase()] || ELEMENT_THEMES.EARTH;
    const colors = theme.bg;
    const grad = ctx.createLinearGradient(0, 0, EXP_WIDTH, EXP_HEIGHT);
    for (let i = 0; i < colors.length; i++) {
      grad.addColorStop(i / (colors.length - 1), colors[i]);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, EXP_WIDTH, EXP_HEIGHT);
  }

  // Dark overlay
  const panelMargin = 20;
  drawRoundedRect(ctx, panelMargin, panelMargin, EXP_WIDTH - panelMargin * 2, EXP_HEIGHT - panelMargin * 2, 24);
  ctx.fillStyle = 'rgba(10, 10, 30, 0.85)';
  ctx.fill();

  // Border glow gold
  const borderGrad = ctx.createLinearGradient(panelMargin, panelMargin, EXP_WIDTH - panelMargin, EXP_HEIGHT - panelMargin);
  borderGrad.addColorStop(0, '#FFB80080');
  borderGrad.addColorStop(1, '#FFD70080');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Icon based on stage
  let stageIcon = '🗺️';
  if (stageNum === 1) stageIcon = '🧭';
  if (stageNum === 2) stageIcon = '🎲';
  if (stageNum === 3) stageIcon = '⚔️';

  // Text details
  ctx.textAlign = 'center';
  
  // Header
  ctx.font = 'bold 38px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFB800';
  ctx.fillText(`${stageIcon} TRANSISI EXPEDITION: STAGE ${stageNum}/3`, EXP_WIDTH / 2, 210);

  // Title
  ctx.font = 'bold 60px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(stageTitle.toUpperCase(), EXP_WIDTH / 2, 360);

  // Map / Path text
  ctx.font = '32px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillText(`Memasuki wilayah ${selectedMap?.name || 'Ekspedisi'} bagian dalam...`, EXP_WIDTH / 2, 510);

  // Flavour text
  ctx.font = 'italic 24px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText('Kru pet terus berjalan menembus kabut tebal, bersiaplah menghadapi apa pun yang menghalangi jalan!', EXP_WIDTH / 2, 620);

  // Watermark
  ctx.font = '18px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillText('Kosan 1A RPG · Pet Expedition Transition Screen', EXP_WIDTH / 2, EXP_HEIGHT - 38);

  return canvas.toBuffer('image/png');
}

async function getExpeditionStageTransitionAttachment(stageNum, stageTitle, selectedMap, mapChoice) {
  try {
    const buffer = await generateExpeditionStageTransitionCard(stageNum, stageTitle, selectedMap, mapChoice);
    if (!buffer) return null;
    return new AttachmentBuilder(buffer, { name: 'expedition_stage_transition.png' });
  } catch (e) {
    console.error('[PetCard] Error generating stage transition card:', e);
    return null;
  }
}

async function generateExpeditionQteStepCard(stepNumber, totalSteps, bossName, targetMemberName, petObj, mapChoice) {
  const canvas = createCanvas(EXP_WIDTH, EXP_HEIGHT);
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
    ctx.drawImage(bgImg, 0, 0, EXP_WIDTH, EXP_HEIGHT);
  } else {
    const grad = ctx.createLinearGradient(0, 0, EXP_WIDTH, EXP_HEIGHT);
    grad.addColorStop(0, '#110000');
    grad.addColorStop(1, '#331100');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, EXP_WIDTH, EXP_HEIGHT);
  }

  // Dark overlay panel
  const panelMargin = 20;
  drawRoundedRect(ctx, panelMargin, panelMargin, EXP_WIDTH - panelMargin * 2, EXP_HEIGHT - panelMargin * 2, 24);
  ctx.fillStyle = 'rgba(15, 10, 10, 0.88)';
  ctx.fill();

  // Orange border glow
  const borderGrad = ctx.createLinearGradient(panelMargin, panelMargin, EXP_WIDTH - panelMargin, EXP_HEIGHT - panelMargin);
  borderGrad.addColorStop(0, '#FF910080');
  borderGrad.addColorStop(1, '#FF3D0080');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Load dynamic boss image
  let bossImg = null;
  const bossPath = path.join(__dirname, '..', 'assets', 'bosses', `boss${mapChoice}.png`);
  if (fs.existsSync(bossPath)) {
    try {
      bossImg = await loadImage(bossPath);
    } catch (e) {
      console.warn("Failed to load boss image:", e.message);
    }
  }

  // Header Text
  ctx.textAlign = 'center';
  ctx.font = 'bold 40px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FF9100';
  ctx.fillText(`⚔️ BOS BATTLE ━━ TAHAP ${stepNumber}/${totalSteps}`, EXP_WIDTH / 2, 75);

  // Draw Boss Avatar / Portrait
  const bossCx = EXP_WIDTH / 2;
  const bossCy = 140;
  const bossR = 52;
  if (bossImg) {
    drawCircleAvatar(ctx, bossImg, bossCx, bossCy, bossR, '#FF1744', 'rgba(255, 23, 68, 0.4)');
  } else {
    ctx.beginPath();
    ctx.arc(bossCx, bossCy, bossR, 0, Math.PI * 2);
    ctx.fillStyle = '#3a0000';
    ctx.fill();
    ctx.strokeStyle = '#FF1744';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.font = 'bold 30px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#FF1744';
    ctx.fillText('👿', bossCx, bossCy + 11);
  }

  // Boss Name
  ctx.textAlign = 'center';
  ctx.font = 'bold 24px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FF1744';
  ctx.fillText(bossName.toUpperCase(), EXP_WIDTH / 2, 215);

  // Boss HP Bar (Visual Fluff)
  const hpBarW = 350;
  const hpBarH = 12;
  const hpBarX = EXP_WIDTH / 2 - hpBarW / 2;
  const hpBarY = 235;
  drawRoundedRect(ctx, hpBarX, hpBarY, hpBarW, hpBarH, hpBarH / 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fill();
  const hpPct = Math.max(0.1, (totalSteps - stepNumber + 1) / totalSteps);
  drawRoundedRect(ctx, hpBarX, hpBarY, hpBarW * hpPct, hpBarH, hpBarH / 2);
  ctx.fillStyle = '#FF1744';
  ctx.fill();

  // Visual QTE progress tracker
  const nodeRadius = 14;
  const nodeGap = 20;
  const totalNodesWidth = (totalSteps * nodeRadius * 2) + ((totalSteps - 1) * nodeGap);
  const startNodesX = (EXP_WIDTH / 2) - (totalNodesWidth / 2);
  const nodesY = 275;

  for (let step = 1; step <= totalSteps; step++) {
    const cx = startNodesX + (step - 1) * (nodeRadius * 2 + nodeGap) + nodeRadius;
    
    // Draw glow
    ctx.beginPath();
    ctx.arc(cx, nodesY, nodeRadius + 4, 0, Math.PI * 2);
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
  const leftX = 125;
  const rightX = 855;
  const columnsY = 330;
  const columnsH = 360;

  // 1. LEFT COLUMN: Target Pet Profile panel
  drawRoundedRect(ctx, leftX, columnsY, 610, columnsH, 14);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Pet avatar
  const avCx = leftX + 105;
  const avCy = columnsY + columnsH / 2;
  const avR = 70;

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
    ctx.font = 'bold 33px "DejaVu Sans", sans-serif';
    ctx.fillStyle = rarityTheme.primary;
    ctx.textAlign = 'center';
    ctx.fillText(petObj?.pet_name?.charAt(0) || 'P', avCx, avCy + 12);
  }

  // Pet details next to avatar
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 32px "DejaVu Sans", sans-serif';
  let petNameDisp = petObj?.pet_name || 'Pet';
  if (petNameDisp.length > 18) petNameDisp = petNameDisp.substring(0, 17) + '…';
  ctx.fillText(petNameDisp, leftX + 215, columnsY + 90);

  ctx.font = '24px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillText(`Lv. ${petObj?.level || 1} ${petObj?.pet_type || 'Hewan'}`, leftX + 215, columnsY + 138);

  // Element and Rarity Badges
  let badgeX = leftX + 215;
  ctx.font = 'bold 18px "DejaVu Sans", sans-serif';
  const rBadgeW = drawBadge(ctx, badgeX, columnsY + 180, petRarity, rarityTheme.primary, '#FFFFFF', 18);
  badgeX += rBadgeW + 11;
  drawBadge(ctx, badgeX, columnsY + 180, (petObj?.gacha_element || 'EARTH').toUpperCase(), 'rgba(255, 255, 255, 0.15)', '#FFFFFF', 18);

  // 2. RIGHT COLUMN: Target Player Turn details
  drawRoundedRect(ctx, rightX, columnsY, 610, columnsH, 14);
  ctx.fillStyle = 'rgba(255, 145, 0, 0.05)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 145, 0, 0.15)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = '26px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillText('⏳ GILIRAN TARGET:', rightX + 305, columnsY + 90);

  ctx.font = 'bold 40px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FF9100';
  let usernameDisp = `@${targetMemberName}`;
  if (usernameDisp.length > 20) usernameDisp = usernameDisp.substring(0, 19) + '…';
  ctx.fillText(usernameDisp, rightX + 305, columnsY + 180);

  ctx.font = 'italic 22px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText('Segera perintahkan pet Anda sebelum waktu habis!', rightX + 305, columnsY + 265);

  // Footer Watermark
  ctx.font = '18px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.textAlign = 'center';
  ctx.fillText('Kosan 1A RPG · Pet Expedition Boss Battle', EXP_WIDTH / 2, EXP_HEIGHT - 38);

  return canvas.toBuffer('image/png');
}

async function getExpeditionQteStepAttachment(stepNumber, totalSteps, bossName, targetMemberName, petObj, mapChoice) {
  try {
    const buffer = await generateExpeditionQteStepCard(stepNumber, totalSteps, bossName, targetMemberName, petObj, mapChoice);
    if (!buffer) return null;
    return new AttachmentBuilder(buffer, { name: 'expedition_qte_step.png' });
  } catch (e) {
    console.error('[PetCard] Error generating QTE step card:', e);
    return null;
  }
}

async function generateExpeditionQteFailureCard(mapName, failedMemberName, reasonType, failResults, mapChoice, guild) {
  const canvas = createCanvas(EXP_WIDTH, EXP_HEIGHT);
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
    ctx.drawImage(bgImg, 0, 0, EXP_WIDTH, EXP_HEIGHT);
  }

  // Red/Dark theme overlay
  const panelMargin = 20;
  drawRoundedRect(ctx, panelMargin, panelMargin, EXP_WIDTH - panelMargin * 2, EXP_HEIGHT - panelMargin * 2, 24);
  ctx.fillStyle = 'rgba(25, 10, 10, 0.92)';
  ctx.fill();

  // Dark Red border glow
  const borderGrad = ctx.createLinearGradient(panelMargin, panelMargin, EXP_WIDTH - panelMargin, EXP_HEIGHT - panelMargin);
  borderGrad.addColorStop(0, '#D5000080');
  borderGrad.addColorStop(1, '#FF174480');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Title
  ctx.textAlign = 'center';
  ctx.font = 'bold 40px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FF1744';
  ctx.fillText('🏰 EKSPEDISI GAGAL ━━ PERTEMPURAN KACAU!', EXP_WIDTH / 2, 110);

  ctx.font = '25px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillText(`💥 Alarm penjaga berbunyi di ${mapName}! Tim dipaksa mundur! 💥`, EXP_WIDTH / 2, 160);

  const leftX = 70;
  const rightX = 820;
  const columnsY = 215;
  const columnsH = 540;
  const colW = 710;

  // 1. LEFT COLUMN: Failure explanation
  drawRoundedRect(ctx, leftX, columnsY, colW, columnsH, 14);
  ctx.fillStyle = 'rgba(213, 0, 0, 0.04)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(213, 0, 0, 0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.font = 'bold 30px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FF8A80';
  ctx.fillText('🔍 PENYEBAB KEKALAHAN:', leftX + 35, columnsY + 65);

  // Cause text word wrap
  ctx.font = '24px "DejaVu Sans", sans-serif';
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
  let yPos = columnsY + 120;
  const maxWidth = 640;
  const lineHeight = 40;

  for (let n = 0; n < words.length; n++) {
    let testLine = line + words[n] + ' ';
    let metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, leftX + 35, yPos);
      line = words[n] + ' ';
      yPos += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, leftX + 35, yPos);

  ctx.font = 'italic 22px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText('Dampak: Seluruh pet kehilangan status HP/kesehatan,', leftX + 35, columnsY + 415);
  ctx.fillText('lapar/haus meningkat, dan kebahagiaan menurun drastis.', leftX + 35, columnsY + 455);

  // 2. RIGHT COLUMN: Pet impact lists
  drawRoundedRect(ctx, rightX, columnsY, colW, columnsH, 14);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = 'bold 30px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillText('🐾 DAMPAK KONDISI KRU PET:', rightX + 35, columnsY + 65);

  let rowY = columnsY + 125;
  const rowHeight = 80;

  for (let i = 0; i < Math.min(5, failResults.length); i++) {
    const r = failResults[i];
    let pOwner = 'Pawang';
    if (guild) {
      try {
        const m = guild.members.cache.get(r.userId);
        if (m) pOwner = m.user.username;
      } catch (err) {}
    }

    ctx.font = 'bold 24px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`🦖 ${r.petName} (@${pOwner})`, rightX + 35, rowY);

    ctx.font = '22px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#FF8A80';
    ctx.fillText(`└─ ${r.statusText || 'Luka & Stress'}`, rightX + 35, rowY + 32);

    rowY += rowHeight;
  }

  // Footer Watermark
  ctx.font = '18px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.textAlign = 'center';
  ctx.fillText('Kosan 1A RPG · Pet Expedition Failure Screen', EXP_WIDTH / 2, EXP_HEIGHT - 38);

  return canvas.toBuffer('image/png');
}

async function getExpeditionQteFailureAttachment(mapName, failedMemberName, reasonType, failResults, mapChoice, guild) {
  try {
    const buffer = await generateExpeditionQteFailureCard(mapName, failedMemberName, reasonType, failResults, mapChoice, guild);
    if (!buffer) return null;
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
  const canvas = createCanvas(EXP_WIDTH, EXP_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Map background
  let bgImg = null;
  const mapPath = path.join(__dirname, '..', 'assets', 'maps', `map${mapChoice}.png`);
  if (fs.existsSync(mapPath)) {
    try { bgImg = await loadImage(mapPath); } catch (e) {}
  }
  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, EXP_WIDTH, EXP_HEIGHT);
  } else {
    const theme = ELEMENT_THEMES[(selectedMap?.element || 'EARTH').toUpperCase()] || ELEMENT_THEMES.EARTH;
    const grad = ctx.createLinearGradient(0, 0, EXP_WIDTH, EXP_HEIGHT);
    theme.bg.forEach((c, i) => grad.addColorStop(i / (theme.bg.length - 1), c));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, EXP_WIDTH, EXP_HEIGHT);
  }

  // Dark overlay
  const pm = 20;
  drawRoundedRect(ctx, pm, pm, EXP_WIDTH - pm * 2, EXP_HEIGHT - pm * 2, 24);
  ctx.fillStyle = 'rgba(10, 10, 30, 0.88)';
  ctx.fill();
  const borderGrad = ctx.createLinearGradient(pm, pm, EXP_WIDTH - pm, EXP_HEIGHT - pm);
  borderGrad.addColorStop(0, '#FF910080');
  borderGrad.addColorStop(1, '#FFD70080');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Header
  ctx.textAlign = 'center';
  ctx.font = 'bold 38px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FF9100';
  ctx.fillText('🧭 STAGE 1 ━━ PEMILIHAN JALUR TIM', EXP_WIDTH / 2, 110);

  ctx.font = 'italic 22px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillText('"Decide wisely, Commander, for every path holds its own fortune and peril..."', EXP_WIDTH / 2, 160);

  // Map & Commander info bar
  ctx.font = '22px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText(`🗺️ Peta: ${selectedMap?.name || 'Ekspedisi'}  ·  👤 Komandan: @${commanderName}`, EXP_WIDTH / 2, 200);

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

  const panelW = 460;
  const panelH = 420;
  const panelGap = 35;
  const totalW = (paths.length * panelW) + ((paths.length - 1) * panelGap);
  const startX = (EXP_WIDTH - totalW) / 2;
  const panelY = 240;

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
    drawRoundedRect(ctx, px, panelY, panelW, 8, 14);
    ctx.clip();
    ctx.fillStyle = p.color;
    ctx.fillRect(px, panelY, panelW, 8);
    ctx.restore();

    // Icon circle
    const iconCx = px + panelW / 2;
    const iconCy = panelY + 90;
    ctx.beginPath();
    ctx.arc(iconCx, iconCy, 40, 0, Math.PI * 2);
    ctx.fillStyle = `${p.color}30`;
    ctx.fill();
    ctx.strokeStyle = `${p.color}80`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Icon text (fallback letter since emoji renders as boxes in some canvas)
    ctx.font = 'bold 30px "DejaVu Sans", sans-serif';
    ctx.fillStyle = p.color;
    ctx.textAlign = 'center';
    const iconLabel = i === 0 ? 'A' : i === 1 ? 'B' : 'C';
    ctx.fillText(iconLabel, iconCx, iconCy + 10);

    // Title
    ctx.font = 'bold 24px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(p.title, px + panelW / 2, panelY + 175);

    // Description
    ctx.font = '19px "DejaVu Sans", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(p.desc1, px + panelW / 2, panelY + 230);
    ctx.fillText(p.desc2, px + panelW / 2, panelY + 260);

    // Bonus badge
    ctx.font = 'bold 18px "DejaVu Sans", sans-serif';
    const badgeText = p.bonus;
    const badgeW = ctx.measureText(badgeText).width + 30;
    const badgeH = 38;
    const badgeX = px + (panelW - badgeW) / 2;
    const badgeY = panelY + 330;
    drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2);
    ctx.fillStyle = `${p.color}30`;
    ctx.fill();
    ctx.strokeStyle = `${p.color}60`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = p.bonusColor;
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + 25);
  }

  // Footer
  ctx.font = '19px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.textAlign = 'center';
  ctx.fillText('⚔️ Batas keputusan: 15 detik · Pilih jalur dengan tombol di bawah', EXP_WIDTH / 2, EXP_HEIGHT - 70);

  ctx.font = '16px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillText('Kosan 1A RPG · Pet Expedition Stage 1', EXP_WIDTH / 2, EXP_HEIGHT - 38);

  return canvas.toBuffer('image/png');
}

async function getStage1PathSelectionAttachment(selectedMap, commanderName, mapChoice) {
  try {
    const buffer = await generateStage1PathSelectionCard(selectedMap, commanderName, mapChoice);
    if (!buffer) return null;
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
  const canvas = createCanvas(EXP_WIDTH, EXP_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Map background
  let bgImg = null;
  const mapPath = path.join(__dirname, '..', 'assets', 'maps', `map${mapChoice}.png`);
  if (fs.existsSync(mapPath)) {
    try { bgImg = await loadImage(mapPath); } catch (e) {}
  }
  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, EXP_WIDTH, EXP_HEIGHT);
  } else {
    const grad = ctx.createLinearGradient(0, 0, EXP_WIDTH, EXP_HEIGHT);
    grad.addColorStop(0, '#1a0a00');
    grad.addColorStop(1, '#331a00');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, EXP_WIDTH, EXP_HEIGHT);
  }

  const pm = 20;
  drawRoundedRect(ctx, pm, pm, EXP_WIDTH - pm * 2, EXP_HEIGHT - pm * 2, 24);
  ctx.fillStyle = 'rgba(10, 10, 30, 0.88)';
  ctx.fill();

  // Green checkmark border for completed stage
  const borderGrad = ctx.createLinearGradient(pm, pm, EXP_WIDTH - pm, EXP_HEIGHT - pm);
  borderGrad.addColorStop(0, '#00E67680');
  borderGrad.addColorStop(1, '#FFB80080');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Header
  ctx.textAlign = 'center';
  ctx.font = 'bold 38px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#00E676';
  ctx.fillText('🧭 STAGE 1 SELESAI ━━ JALUR DIPILIH ✅', EXP_WIDTH / 2, 110);

  // Path choice color
  const pathColors = { SAFE: '#4CAF50', SHORTCUT: '#2196F3', SWAMP: '#F44336' };
  const chosenColor = pathColors[pathChoice] || '#FFB800';

  // Result box
  const boxW = 1200;
  const boxH = 400;
  const boxX = (EXP_WIDTH - boxW) / 2;
  const boxY = 180;
  drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 14);
  ctx.fillStyle = `${chosenColor}15`;
  ctx.fill();
  ctx.strokeStyle = `${chosenColor}40`;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.font = 'bold 26px "DejaVu Sans", sans-serif';
  ctx.fillStyle = chosenColor;
  ctx.fillText('📢 Keputusan Jalur:', boxX + 30, boxY + 65);

  // Wrap path text
  ctx.font = '22px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  const cleanPathText = pathText.replace(/\*\*/g, '').replace(/└─\s*/g, '  → ');
  const lines = cleanPathText.split('\n');
  let ty = boxY + 120;
  for (const line of lines) {
    if (ty > boxY + boxH - 12) break;
    ctx.fillText(line.substring(0, 100), boxX + 30, ty);
    ty += 38;
  }

  // Map & Commander info
  ctx.textAlign = 'center';
  ctx.font = '20px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText(`🗺️ ${selectedMap?.name || 'Ekspedisi'}  ·  👤 @${commanderName}  ·  ⏳ Menghubungkan ke Stage 2...`, EXP_WIDTH / 2, 680);

  // Watermark
  ctx.font = '16px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillText('Kosan 1A RPG · Pet Expedition Stage 1 Complete', EXP_WIDTH / 2, EXP_HEIGHT - 38);

  return canvas.toBuffer('image/png');
}

async function getStage1ResultAttachment(selectedMap, commanderName, pathText, pathChoice, mapChoice) {
  try {
    const buffer = await generateStage1ResultCard(selectedMap, commanderName, pathText, pathChoice, mapChoice);
    if (!buffer) return null;
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
  const canvas = createCanvas(EXP_WIDTH, EXP_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Map background
  let bgImg = null;
  const mapPath = path.join(__dirname, '..', 'assets', 'maps', `map${mapChoice}.png`);
  if (fs.existsSync(mapPath)) {
    try { bgImg = await loadImage(mapPath); } catch (e) {}
  }
  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, EXP_WIDTH, EXP_HEIGHT);
  } else {
    const grad = ctx.createLinearGradient(0, 0, EXP_WIDTH, EXP_HEIGHT);
    grad.addColorStop(0, '#1a001a');
    grad.addColorStop(1, '#330033');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, EXP_WIDTH, EXP_HEIGHT);
  }

  const pm = 20;
  drawRoundedRect(ctx, pm, pm, EXP_WIDTH - pm * 2, EXP_HEIGHT - pm * 2, 24);
  ctx.fillStyle = 'rgba(15, 5, 20, 0.90)';
  ctx.fill();
  const borderGrad = ctx.createLinearGradient(pm, pm, EXP_WIDTH - pm, EXP_HEIGHT - pm);
  borderGrad.addColorStop(0, '#E040FB80');
  borderGrad.addColorStop(1, '#7C4DFF80');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Load dynamic event image
  let eventImg = null;
  const eventImgPath = path.join(__dirname, '..', 'assets', 'events', 'chest.png');
  if (fs.existsSync(eventImgPath)) {
    try { eventImg = await loadImage(eventImgPath); } catch (e) {}
  }

  // Header
  ctx.textAlign = 'center';
  ctx.font = 'bold 38px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#E040FB';
  ctx.fillText('📦 STAGE 2 ━━ PETI KUNO TERKUNCI', EXP_WIDTH / 2, 75);

  // Draw Event Image or Fallback
  const eventX = EXP_WIDTH / 2 - 47;
  const eventY = 85;
  const eventSize = 95;
  if (eventImg) {
    ctx.drawImage(eventImg, eventX, eventY, eventSize, eventSize);
  } else {
    ctx.beginPath();
    ctx.arc(EXP_WIDTH / 2, eventY + 47, 40, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(224, 64, 251, 0.15)';
    ctx.fill();
    ctx.strokeStyle = '#E040FB';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = 'bold 40px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#E040FB';
    ctx.fillText('📦', EXP_WIDTH / 2, eventY + 62);
  }

  ctx.font = 'italic 22px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillText('"A dusty relic of the past lies before you. What secrets or traps does it hold?"', EXP_WIDTH / 2, 255);

  ctx.font = '22px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText(`🗺️ ${selectedMap?.name || 'Ekspedisi'}  ·  👤 @${commanderName}`, EXP_WIDTH / 2, 292);

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

  const panelW = 460;
  const panelH = 395;
  const panelGap = 35;
  const totalW = (opts.length * panelW) + ((opts.length - 1) * panelGap);
  const startX = (EXP_WIDTH - totalW) / 2;
  const panelY = 320;

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
    drawRoundedRect(ctx, px, panelY, panelW, 8, 14);
    ctx.clip();
    ctx.fillStyle = o.color;
    ctx.fillRect(px, panelY, panelW, 8);
    ctx.restore();

    // Icon circle
    const iconCx = px + panelW / 2;
    const iconCy = panelY + 60;
    ctx.beginPath();
    ctx.arc(iconCx, iconCy, 32, 0, Math.PI * 2);
    ctx.fillStyle = `${o.color}30`;
    ctx.fill();
    ctx.strokeStyle = `${o.color}80`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = 'bold 30px "DejaVu Sans", sans-serif';
    ctx.fillStyle = o.color;
    ctx.textAlign = 'center';
    ctx.fillText(o.letter, iconCx, iconCy + 10);

    // Title
    ctx.font = 'bold 23px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(o.title, px + panelW / 2, panelY + 155);

    // Description
    ctx.font = '19px "DejaVu Sans", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(o.desc1, px + panelW / 2, panelY + 205);
    ctx.fillText(o.desc2, px + panelW / 2, panelY + 232);

    // Badge
    ctx.font = 'bold 17px "DejaVu Sans", sans-serif';
    const bText = o.badge;
    const bW = ctx.measureText(bText).width + 28;
    const bH = 35;
    const bX = px + (panelW - bW) / 2;
    const bY = panelY + 300;
    drawRoundedRect(ctx, bX, bY, bW, bH, bH / 2);
    ctx.fillStyle = `${o.badgeColor}30`;
    ctx.fill();
    ctx.strokeStyle = `${o.badgeColor}60`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = o.badgeColor;
    ctx.fillText(bText, bX + bW / 2, bY + 24);
  }

  ctx.font = '19px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.textAlign = 'center';
  ctx.fillText('⚔️ Batas keputusan: 15 detik · Pilih opsi dengan tombol di bawah', EXP_WIDTH / 2, EXP_HEIGHT - 70);

  ctx.font = '16px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillText('Kosan 1A RPG · Pet Expedition Stage 2 — Ancient Chest', EXP_WIDTH / 2, EXP_HEIGHT - 38);

  return canvas.toBuffer('image/png');
}

async function getStage2ChestAttachment(selectedMap, commanderName, hasLockpick, mapChoice) {
  try {
    const buffer = await generateStage2ChestCard(selectedMap, commanderName, hasLockpick, mapChoice);
    if (!buffer) return null;
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
  const canvas = createCanvas(EXP_WIDTH, EXP_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Map background
  let bgImg = null;
  const mapPath = path.join(__dirname, '..', 'assets', 'maps', `map${mapChoice}.png`);
  if (fs.existsSync(mapPath)) {
    try { bgImg = await loadImage(mapPath); } catch (e) {}
  }
  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, EXP_WIDTH, EXP_HEIGHT);
  } else {
    const grad = ctx.createLinearGradient(0, 0, EXP_WIDTH, EXP_HEIGHT);
    grad.addColorStop(0, '#001a33');
    grad.addColorStop(1, '#003366');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, EXP_WIDTH, EXP_HEIGHT);
  }

  const pm = 20;
  drawRoundedRect(ctx, pm, pm, EXP_WIDTH - pm * 2, EXP_HEIGHT - pm * 2, 24);
  ctx.fillStyle = 'rgba(5, 15, 30, 0.90)';
  ctx.fill();
  const borderGrad = ctx.createLinearGradient(pm, pm, EXP_WIDTH - pm, EXP_HEIGHT - pm);
  borderGrad.addColorStop(0, '#00E5FF80');
  borderGrad.addColorStop(1, '#00BCD480');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Load dynamic event image
  let eventImg = null;
  const eventImgPath = path.join(__dirname, '..', 'assets', 'events', 'waterfall.png');
  if (fs.existsSync(eventImgPath)) {
    try { eventImg = await loadImage(eventImgPath); } catch (e) {}
  }

  // Header
  ctx.textAlign = 'center';
  ctx.font = 'bold 38px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#00E5FF';
  ctx.fillText('💧 STAGE 2 ━━ AIR TERJUN SUCI', EXP_WIDTH / 2, 75);

  // Draw Event Image or Fallback
  const eventX = EXP_WIDTH / 2 - 47;
  const eventY = 85;
  const eventSize = 95;
  if (eventImg) {
    ctx.drawImage(eventImg, eventX, eventY, eventSize, eventSize);
  } else {
    ctx.beginPath();
    ctx.arc(EXP_WIDTH / 2, eventY + 47, 40, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 229, 255, 0.15)';
    ctx.fill();
    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = 'bold 40px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#00E5FF';
    ctx.fillText('💧', EXP_WIDTH / 2, eventY + 62);
  }

  ctx.font = 'italic 22px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillText('"A crystal-clear spring of magical waters, offering rejuvenation to weary travelers."', EXP_WIDTH / 2, 255);

  ctx.font = '22px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText(`🗺️ ${selectedMap?.name || 'Ekspedisi'}  ·  👤 @${commanderName}`, EXP_WIDTH / 2, 292);

  // Two option panels, centered
  const panelW = 580;
  const panelH = 395;
  const panelGap = 45;
  const totalW = 2 * panelW + panelGap;
  const startX = (EXP_WIDTH - totalW) / 2;
  const panelY = 320;

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
    drawRoundedRect(ctx, px, panelY, panelW, 8, 14);
    ctx.clip();
    ctx.fillStyle = o.color;
    ctx.fillRect(px, panelY, panelW, 8);
    ctx.restore();

    // Icon circle
    const iconCx = px + panelW / 2;
    const iconCy = panelY + 60;
    ctx.beginPath();
    ctx.arc(iconCx, iconCy, 38, 0, Math.PI * 2);
    ctx.fillStyle = `${o.color}30`;
    ctx.fill();
    ctx.strokeStyle = `${o.color}80`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = 'bold 32px "DejaVu Sans", sans-serif';
    ctx.fillStyle = o.color;
    ctx.textAlign = 'center';
    ctx.fillText(o.letter, iconCx, iconCy + 11);

    ctx.font = 'bold 27px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(o.title, px + panelW / 2, panelY + 155);

    ctx.font = '20px "DejaVu Sans", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(o.desc1, px + panelW / 2, panelY + 205);
    ctx.fillText(o.desc2, px + panelW / 2, panelY + 232);

    // Badge
    ctx.font = 'bold 18px "DejaVu Sans", sans-serif';
    const bW = ctx.measureText(o.badge).width + 28;
    const bH = 38;
    const bX = px + (panelW - bW) / 2;
    const bY = panelY + 300;
    drawRoundedRect(ctx, bX, bY, bW, bH, bH / 2);
    ctx.fillStyle = `${o.badgeColor}30`;
    ctx.fill();
    ctx.strokeStyle = `${o.badgeColor}60`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = o.badgeColor;
    ctx.fillText(o.badge, bX + bW / 2, bY + 25);
  }

  ctx.font = '19px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.textAlign = 'center';
  ctx.fillText('⚔️ Batas keputusan: 15 detik · Pilih opsi dengan tombol di bawah', EXP_WIDTH / 2, EXP_HEIGHT - 70);

  ctx.font = '16px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillText('Kosan 1A RPG · Pet Expedition Stage 2 — Sacred Waterfall', EXP_WIDTH / 2, EXP_HEIGHT - 38);

  return canvas.toBuffer('image/png');
}

async function getStage2WaterfallAttachment(selectedMap, commanderName, mapChoice) {
  try {
    const buffer = await generateStage2WaterfallCard(selectedMap, commanderName, mapChoice);
    if (!buffer) return null;
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
  const canvas = createCanvas(EXP_WIDTH, EXP_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Map background
  let bgImg = null;
  const mapPath = path.join(__dirname, '..', 'assets', 'maps', `map${mapChoice}.png`);
  if (fs.existsSync(mapPath)) {
    try { bgImg = await loadImage(mapPath); } catch (e) {}
  }
  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, EXP_WIDTH, EXP_HEIGHT);
  } else {
    const grad = ctx.createLinearGradient(0, 0, EXP_WIDTH, EXP_HEIGHT);
    grad.addColorStop(0, isChest ? '#1a001a' : '#001a33');
    grad.addColorStop(1, isChest ? '#330033' : '#003366');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, EXP_WIDTH, EXP_HEIGHT);
  }

  const pm = 20;
  drawRoundedRect(ctx, pm, pm, EXP_WIDTH - pm * 2, EXP_HEIGHT - pm * 2, 24);
  ctx.fillStyle = 'rgba(10, 10, 30, 0.88)';
  ctx.fill();

  const accentColor = isChest ? '#E040FB' : '#00E5FF';
  const borderGrad = ctx.createLinearGradient(pm, pm, EXP_WIDTH - pm, EXP_HEIGHT - pm);
  borderGrad.addColorStop(0, `${accentColor}80`);
  borderGrad.addColorStop(1, '#00E67680');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Header
  ctx.textAlign = 'center';
  ctx.font = 'bold 38px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#00E676';
  const titleIcon = isChest ? '📦' : '💧';
  ctx.fillText(`${titleIcon} STAGE 2 SELESAI ━━ KEJADIAN SELESAI ✅`, EXP_WIDTH / 2, 110);

  // Result box
  const boxW = 1200;
  const boxH = 400;
  const boxX = (EXP_WIDTH - boxW) / 2;
  const boxY = 180;
  drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 14);
  ctx.fillStyle = `${accentColor}10`;
  ctx.fill();
  ctx.strokeStyle = `${accentColor}30`;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Load and draw dynamic event image inside result box
  let eventImg = null;
  const eventImgPath = path.join(__dirname, '..', 'assets', 'events', isChest ? 'chest.png' : 'waterfall.png');
  if (fs.existsSync(eventImgPath)) {
    try { eventImg = await loadImage(eventImgPath); } catch (e) {}
  }
  if (eventImg) {
    ctx.drawImage(eventImg, boxX + boxW - 160, boxY + 50, 120, 120);
  } else {
    // Draw fallback emoji in glowing circle
    const circleX = boxX + boxW - 100;
    const circleY = boxY + 110;
    ctx.beginPath();
    ctx.arc(circleX, circleY, 46, 0, Math.PI * 2);
    ctx.fillStyle = isChest ? 'rgba(224, 64, 251, 0.15)' : 'rgba(0, 229, 255, 0.15)';
    ctx.fill();
    ctx.strokeStyle = isChest ? '#E040FB' : '#00E5FF';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = 'bold 46px "Inter", "DejaVu Sans", sans-serif';
    ctx.fillStyle = isChest ? '#E040FB' : '#00E5FF';
    ctx.textAlign = 'center';
    ctx.fillText(isChest ? '📦' : '💧', circleX, circleY + 15);
  }

  ctx.textAlign = 'left';
  ctx.font = 'bold 26px "DejaVu Sans", sans-serif';
  ctx.fillStyle = accentColor;
  ctx.fillText('📢 Keputusan:', boxX + 30, boxY + 65);

  ctx.font = '22px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  const cleanEventText = eventText.replace(/\*\*/g, '').replace(/└─\s*/g, '  → ');
  const evLines = cleanEventText.split('\n');
  let ey = boxY + 120;
  for (const line of evLines) {
    if (ey > boxY + boxH - 12) break;
    ctx.fillText(line.substring(0, 70), boxX + 30, ey);
    ey += 38;
  }

  ctx.textAlign = 'center';
  ctx.font = '20px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText(`👤 @${commanderName}  ·  ⏳ Gerbang Bos Akhir terbuka...`, EXP_WIDTH / 2, 680);

  ctx.font = '16px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillText('Kosan 1A RPG · Pet Expedition Stage 2 Complete', EXP_WIDTH / 2, EXP_HEIGHT - 38);

  return canvas.toBuffer('image/png');
}

async function getStage2ResultAttachment(selectedMap, commanderName, eventText, isChest, mapChoice) {
  try {
    const buffer = await generateStage2ResultCard(selectedMap, commanderName, eventText, isChest, mapChoice);
    if (!buffer) return null;
    return new AttachmentBuilder(buffer, { name: 'expedition_stage2_result.png' });
  } catch (e) {
    console.error('[PetCard] Error generating Stage 2 result card:', e);
    return null;
  }
}

// ═══════════════════════════════════════════════
// PREMIUM MINIMALIST ICONS VECTOR DRAWING HELPER
// ═══════════════════════════════════════════════
function drawPremiumIcon(ctx, name, cx, cy, size = 18, color = '#FFFFFF') {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (name === 'controller') {
    const w = size * 1.3;
    const h = size * 0.8;
    drawRoundedRect(ctx, cx - w/2, cy - h/2, w, h, 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - w/4 - 3, cy);
    ctx.lineTo(cx - w/4 + 3, cy);
    ctx.moveTo(cx - w/4, cy - 3);
    ctx.lineTo(cx - w/4, cy + 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + w/4 - 2, cy - 2, 1.5, 0, Math.PI*2);
    ctx.arc(cx + w/4 + 3, cy + 2, 1.5, 0, Math.PI*2);
    ctx.fill();
  }
  else if (name === 'briefcase') {
    const w = size * 1.1;
    const h = size * 0.8;
    drawRoundedRect(ctx, cx - w/2, cy - h/2 + 2, w, h - 2, 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy - h/2 + 2, 4, Math.PI, 0);
    ctx.stroke();
    ctx.fillRect(cx - 2, cy, 4, 3);
  }
  else if (name === 'paw') {
    ctx.beginPath();
    ctx.arc(cx, cy + 2, 5, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - 5, cy - 4, 2, 0, Math.PI*2);
    ctx.arc(cx - 1, cy - 7, 2, 0, Math.PI*2);
    ctx.arc(cx + 3, cy - 7, 2, 0, Math.PI*2);
    ctx.arc(cx + 7, cy - 4, 2, 0, Math.PI*2);
    ctx.fill();
  }
  else if (name === 'bag') {
    const w = size * 0.9;
    const h = size * 1.0;
    drawRoundedRect(ctx, cx - w/2, cy - h/2 + 3, w, h - 3, 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy - h/2 + 4, 5, Math.PI, 0);
    ctx.stroke();
  }
  else if (name === 'chart') {
    const w = size;
    const h = size;
    ctx.beginPath();
    ctx.moveTo(cx - w/2, cy - h/2);
    ctx.lineTo(cx - w/2, cy + h/2);
    ctx.lineTo(cx + w/2, cy + h/2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - w/2 + 2, cy + h/4);
    ctx.lineTo(cx - w/6, cy - h/6);
    ctx.lineTo(cx + w/6, cy + h/8);
    ctx.lineTo(cx + w/2 - 2, cy - h/3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + w/2 - 2, cy - h/3, 2, 0, Math.PI*2);
    ctx.fill();
  }
  else if (name === 'bank') {
    const w = size * 1.1;
    const h = size * 0.9;
    ctx.fillRect(cx - w/2, cy + h/2 - 2, w, 2);
    ctx.beginPath();
    ctx.moveTo(cx - w/2, cy - h/2 + 3);
    ctx.lineTo(cx, cy - h/2 - 3);
    ctx.lineTo(cx + w/2, cy - h/2 + 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(cx - w/3 - 1, cy - h/2 + 4, 2, h - 7);
    ctx.fillRect(cx - 1, cy - h/2 + 4, 2, h - 7);
    ctx.fillRect(cx + w/3 - 2, cy - h/2 + 4, 2, h - 7);
  }
  else if (name === 'spy') {
    const r = size * 0.45;
    ctx.beginPath();
    ctx.arc(cx, cy - 2, r, 0, Math.PI*2);
    ctx.stroke();
    ctx.fillRect(cx - r - 1, cy - 4, r * 2 + 2, 2);
    ctx.beginPath();
    ctx.arc(cx - 2.5, cy, 2.5, 0, Math.PI);
    ctx.arc(cx + 2.5, cy, 2.5, 0, Math.PI);
    ctx.fill();
  }
  else if (name === 'scales') {
    const w = size * 1.1;
    const h = size * 0.9;
    ctx.fillRect(cx - w/4, cy + h/2 - 2, w/2, 2);
    ctx.fillRect(cx - 0.75, cy - h/2, 1.5, h);
    ctx.fillRect(cx - w/2, cy - h/2 + 2, w, 1.5);
    ctx.beginPath();
    ctx.moveTo(cx - w/2 + 2, cy - h/2 + 4);
    ctx.lineTo(cx - w/2 - 3, cy + h/4);
    ctx.lineTo(cx - w/2 + 7, cy + h/4);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + w/2 - 2, cy - h/2 + 4);
    ctx.lineTo(cx + w/2 - 7, cy + h/4);
    ctx.lineTo(cx + w/2 + 3, cy + h/4);
    ctx.closePath();
    ctx.stroke();
  }
  else if (name === 'user') {
    const r = size * 0.35;
    ctx.beginPath();
    ctx.arc(cx, cy - r, r, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy + size * 0.45, size * 0.5, Math.PI, 0);
    ctx.fill();
  }
  else if (name === 'bed') {
    const w = size * 1.1;
    const h = size * 0.7;
    ctx.beginPath();
    ctx.moveTo(cx - w/2, cy - h/2);
    ctx.lineTo(cx - w/2, cy + h/2);
    ctx.moveTo(cx + w/2, cy - h/2);
    ctx.lineTo(cx + w/2, cy + h/2);
    ctx.moveTo(cx - w/2, cy + h/4);
    ctx.lineTo(cx + w/2, cy + h/4);
    ctx.stroke();
    ctx.fillRect(cx - w/2 + 3, cy - h/2 + 2, 4, 5);
    drawRoundedRect(ctx, cx - w/2 + 8, cy - h/2 + 4, w - 10, h/2, 2);
    ctx.fill();
  }
  else if (name === 'leaf') {
    const h = size;
    ctx.beginPath();
    ctx.moveTo(cx, cy + h/2);
    ctx.quadraticCurveTo(cx - 3, cy, cx - 1, cy - h/4);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx - 4, cy - 2, 3.5, 1.8, -Math.PI/4, 0, Math.PI*2);
    ctx.ellipse(cx + 2, cy - 3, 3.5, 1.8, Math.PI/4, 0, Math.PI*2);
    ctx.fill();
  }
  else if (name === 'list') {
    const w = size * 0.8;
    const h = size * 1.0;
    drawRoundedRect(ctx, cx - w/2, cy - h/2 + 2, w, h - 2, 2);
    ctx.stroke();
    ctx.fillRect(cx - 2.5, cy - h/2, 5, 2.5);
    ctx.beginPath();
    ctx.moveTo(cx - w/2 + 3, cy - 1);
    ctx.lineTo(cx + w/2 - 3, cy - 1);
    ctx.moveTo(cx - w/2 + 3, cy + 3);
    ctx.lineTo(cx + w/2 - 3, cy + 3);
    ctx.stroke();
  }
  else if (name === 'ticket') {
    const w = size * 1.1;
    const h = size * 0.7;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 12);
    drawRoundedRect(ctx, -w/2, -h/2, w, h, 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.setLineDash([2, 2]);
    ctx.moveTo(-w/6, -h/2);
    ctx.lineTo(-w/6, h/2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w/4, 0, 1.5, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
  else if (name === 'lock') {
    const w = size * 0.75;
    const h = size * 0.65;
    ctx.beginPath();
    ctx.arc(cx, cy - 1.5, w/3, Math.PI, 0);
    ctx.stroke();
    drawRoundedRect(ctx, cx - w/2, cy - 0.5, w, h, 1.5);
    ctx.fill();
  }
  else if (name === 'trophy') {
    const w = size * 0.9;
    const h = size * 0.9;
    ctx.beginPath();
    ctx.moveTo(cx - w/2, cy - h/2);
    ctx.lineTo(cx + w/2, cy - h/2);
    ctx.lineTo(cx + w/3, cy + h/6);
    ctx.quadraticCurveTo(cx, cy + h/3, cx - w/3, cy + h/6);
    ctx.closePath();
    ctx.fill();
    
    ctx.fillRect(cx - 2, cy + h/3, 4, h/4);
    ctx.fillRect(cx - w/3, cy + h/2 + 1, w * 0.66, 2);
    
    // handles
    ctx.beginPath();
    ctx.arc(cx - w/3 - 1, cy - h/8, 3, -Math.PI/2, Math.PI/2, true);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + w/3 + 1, cy - h/8, 3, -Math.PI/2, Math.PI/2, false);
    ctx.stroke();
  }
  else if (name === 'clock') {
    ctx.beginPath();
    ctx.arc(cx, cy, size/2, 0, Math.PI*2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - size/3);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + size/4, cy);
    ctx.stroke();
  }
  else if (name === 'shield') {
    const w = size * 0.9;
    const h = size * 1.0;
    ctx.beginPath();
    ctx.moveTo(cx - w/2, cy - h/2);
    ctx.lineTo(cx + w/2, cy - h/2);
    ctx.lineTo(cx + w/2, cy);
    ctx.quadraticCurveTo(cx, cy + h/2, cx - w/2, cy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
  }
  else if (name === 'gift') {
    const w = size * 0.9;
    const h = size * 0.9;
    drawRoundedRect(ctx, cx - w/2, cy - h/4, w, h * 0.7, 2);
    ctx.stroke();
    ctx.fillRect(cx - w/2, cy - h/2 + 2, w, 2);
    // Ribbon
    ctx.fillRect(cx - 1.5, cy - h/2 + 2, 3, h - 2);
  }
  else if (name === 'fire') {
    const w = size * 0.8;
    const h = size * 1.0;
    ctx.beginPath();
    ctx.moveTo(cx, cy + h/2);
    ctx.quadraticCurveTo(cx - w/2, cy + h/4, cx - w/4, cy - h/8);
    ctx.quadraticCurveTo(cx - w/2, cy - h/2, cx, cy - h/2);
    ctx.quadraticCurveTo(cx + w/4, cy - h/4, cx + w/3, cy);
    ctx.quadraticCurveTo(cx + w/2, cy + h/4, cx, cy + h/2);
    ctx.closePath();
    ctx.fill();
  }
  else if (name === 'wave') {
    const w = size * 1.0;
    ctx.beginPath();
    ctx.moveTo(cx - w/2, cy + 2);
    ctx.quadraticCurveTo(cx - w/4, cy - 3, cx, cy + 2);
    ctx.quadraticCurveTo(cx + w/4, cy + 7, cx + w/2, cy + 2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(cx - w/2, cy - 3);
    ctx.quadraticCurveTo(cx - w/4, cy - 8, cx, cy - 3);
    ctx.quadraticCurveTo(cx + w/4, cy + 2, cx + w/2, cy - 3);
    ctx.stroke();
  }
  else if (name === 'mountain') {
    const w = size * 1.1;
    const h = size * 0.9;
    ctx.beginPath();
    ctx.moveTo(cx - w/2, cy + h/2);
    ctx.lineTo(cx, cy - h/2);
    ctx.lineTo(cx + w/2, cy + h/2);
    ctx.closePath();
    ctx.stroke();
    
    // Draw minor peak
    ctx.beginPath();
    ctx.moveTo(cx - w/4, cy + h/2);
    ctx.lineTo(cx - w/8, cy);
    ctx.lineTo(cx + w/8, cy + h/2);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Generate premium card for Sentinel Portal Hub control center
 */
async function generatePortalHubCard(client) {
  const CARD_WIDTH = 1000;
  const CARD_HEIGHT = 560;

  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background - Dark Celestial Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  bgGrad.addColorStop(0, '#0a0813');
  bgGrad.addColorStop(0.5, '#151128');
  bgGrad.addColorStop(1, '#0a0813');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Decorative grid lines (futuristic cyber grid)
  ctx.globalAlpha = 0.04;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  for (let i = 0; i < CARD_WIDTH; i += 40) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CARD_HEIGHT); ctx.stroke();
  }
  for (let i = 0; i < CARD_HEIGHT; i += 40) {
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(CARD_WIDTH, i); ctx.stroke();
  }
  ctx.globalAlpha = 1.0;

  // Subtle radial glow behind avatar
  const radialGlow = ctx.createRadialGradient(75, 70, 0, 75, 70, 120);
  radialGlow.addColorStop(0, 'rgba(124, 77, 255, 0.2)');
  radialGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = radialGlow;
  ctx.fillRect(0, 0, 300, 150);

  // Main Container Card (glassmorphic border)
  const margin = 20;
  drawRoundedRect(ctx, margin, margin, CARD_WIDTH - margin * 2, CARD_HEIGHT - margin * 2, 20);
  ctx.fillStyle = 'rgba(10, 8, 20, 0.84)';
  ctx.fill();

  // Glow Border
  const borderGrad = ctx.createLinearGradient(margin, margin, CARD_WIDTH - margin, CARD_HEIGHT - margin);
  borderGrad.addColorStop(0, '#7C4DFF');
  borderGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
  borderGrad.addColorStop(1, '#00E5FF');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Load bot avatar
  let avatarImg = null;
  if (client && client.user && client.user.displayAvatarURL) {
    try {
      const avatarURL = client.user.displayAvatarURL({ extension: 'png', size: 128 });
      avatarImg = await loadImageSafe(avatarURL);
    } catch (e) {
      console.warn('[PetCard] Failed to load bot avatar for Portal Hub card');
    }
  }

  // Draw Avatar with glow
  drawCircleAvatar(ctx, avatarImg, 75, 70, 26, '#7C4DFF', 'rgba(124, 77, 255, 0.4)');

  // Title & Subtitle next to avatar
  ctx.font = 'bold 24px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.fillText('SENTINEL PORTAL HUB', 135, 68);

  ctx.font = 'bold 11px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#00E5FF';
  ctx.fillText('— PUSAT KONTROL UTAMA —', 135, 86);

  // Decorative controller icon inside header
  drawPremiumIcon(ctx, 'controller', 115, 60, 16, '#00E5FF');

  // Header separator line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 115);
  ctx.lineTo(960, 115);
  ctx.stroke();

  // ── COLUMN 1: EKONOMI & FINANSIAL ──
  const col1X = 45;
  const colWidth = 445;

  // Title accent bar
  ctx.fillStyle = '#FFD700';
  drawRoundedRect(ctx, col1X, 135, 4, 18, 2);
  ctx.fill();

  // Column header text
  ctx.font = 'bold 14px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFD700';
  ctx.textAlign = 'left';
  ctx.fillText('EKONOMI & FINANSIAL', col1X + 32, 149);
  drawPremiumIcon(ctx, 'briefcase', col1X + 16, 143, 14, '#FFD700');

  const leftItems = [
    { icon: 'bag', title: 'Toko Role', desc: 'Beli kasta role prestise & gacha.' },
    { icon: 'chart', title: 'Bursa Saham', desc: 'Investasi saham channel server.' },
    { icon: 'bank', title: 'Bank Sentral', desc: 'Simpan uang (tabungan) & pinjam koin.' },
    { icon: 'spy', title: 'Black Market', desc: 'Beli peralatan aksi kriminal (rob).' },
    { icon: 'scales', title: 'Pasar Lelang', desc: 'Bursa jual-beli barang & pet warga.' },
    { icon: 'user', title: 'Profil & Aset', desc: 'Lihat peralatan & barang mewah.' }
  ];

  let leftY = 172;
  const itemHeight = 44;
  const itemGap = 8;

  leftItems.forEach(item => {
    // Glassmorphic item box
    drawRoundedRect(ctx, col1X, leftY, colWidth, itemHeight, 8);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Icon circle backing
    ctx.beginPath();
    ctx.arc(col1X + 24, leftY + 22, 14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fill();

    // Premium Icon
    drawPremiumIcon(ctx, item.icon, col1X + 24, leftY + 22, 16, '#FFD700');

    // Title
    ctx.font = 'bold 12px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.fillText(item.title, col1X + 48, leftY + 18);

    // Desc
    ctx.font = '10px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#A0AABF';
    ctx.fillText(item.desc, col1X + 48, leftY + 33);

    leftY += itemHeight + itemGap;
  });

  // ── COLUMN 2: DUNIA PET & GAYA HIDUP ──
  const col2X = 510;

  // Title accent bar
  ctx.fillStyle = '#00E676';
  drawRoundedRect(ctx, col2X, 135, 4, 18, 2);
  ctx.fill();

  // Column header text
  ctx.font = 'bold 14px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#00E676';
  ctx.textAlign = 'left';
  ctx.fillText('DUNIA PET & GAYA HIDUP', col2X + 32, 149);
  drawPremiumIcon(ctx, 'paw', col2X + 16, 143, 14, '#00E676');

  const rightItems = [
    { icon: 'paw', title: 'Kandang Pet', desc: 'Pusat perawatan, kerja, buru, & kelola pet.' },
    { icon: 'bed', title: 'Sewa Kosan', desc: 'Sewa kamar kos & upgrade fasilitas.' },
    { icon: 'leaf', title: 'Cozy Garden', desc: 'Menanam bunga & berkebun cozy.' },
    { icon: 'list', title: 'Misi Harian', desc: 'Selesaikan misi harian untuk koin & barang.' },
    { icon: 'ticket', title: 'Lotre Mingguan', desc: 'Beli tiket lotre mingguan berhadiah pool besar.' }
  ];

  let rightY = 172;
  rightItems.forEach(item => {
    // Glassmorphic item box
    drawRoundedRect(ctx, col2X, rightY, colWidth, itemHeight, 8);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Icon circle backing
    ctx.beginPath();
    ctx.arc(col2X + 24, rightY + 22, 14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fill();

    // Premium Icon
    drawPremiumIcon(ctx, item.icon, col2X + 24, rightY + 22, 16, '#00E676');

    // Title
    ctx.font = 'bold 12px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.fillText(item.title, col2X + 48, rightY + 18);

    // Desc
    ctx.font = '10px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#A0AABF';
    ctx.fillText(item.desc, col2X + 48, rightY + 33);

    rightY += itemHeight + itemGap;
  });

  // Footer separator
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath();
  ctx.moveTo(40, 485);
  ctx.lineTo(960, 485);
  ctx.stroke();

  // Footer notice (Centered with dynamic lock placement)
  ctx.font = 'italic 11px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFD700';
  ctx.textAlign = 'center';
  const noticeText = 'Klik tombol di bawah ini untuk membuka panel secara Pribadi / Private (Hanya Anda yang dapat melihatnya)';
  const textWidth = ctx.measureText(noticeText).width;
  ctx.fillText(noticeText, 500, 506);
  
  const lockX = 500 - (textWidth / 2) - 10;
  drawPremiumIcon(ctx, 'lock', lockX, 501, 10, '#FFD700');

  // Bottom corner metadata
  ctx.font = '10px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.textAlign = 'left';
  ctx.fillText('Sentinel Bot • Server Kosan 1A', 45, 532);

  ctx.textAlign = 'right';
  ctx.fillText('Pusat Kontrol Utama', 955, 532);

  return canvas.toBuffer('image/png');
}

async function getPortalHubAttachment(client) {
  try {
    const buffer = await generatePortalHubCard(client);
    return new AttachmentBuilder(buffer, { name: 'portal_hub.png' });
  } catch (e) {
    console.error('[PetCard] Error generating portal hub attachment:', e);
    return null;
  }
}

/**
 * Generate premium card for PvP Pet League registration phase
 */
async function generateTournamentRegistrationCard(event, participants) {
  const CARD_WIDTH = 1000;
  const CARD_HEIGHT = 560;

  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background - Dark Celestial Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  bgGrad.addColorStop(0, '#0f051d');
  bgGrad.addColorStop(0.5, '#190a2e');
  bgGrad.addColorStop(1, '#0f051d');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Cyber grid
  ctx.globalAlpha = 0.04;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  for (let i = 0; i < CARD_WIDTH; i += 40) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CARD_HEIGHT); ctx.stroke();
  }
  for (let i = 0; i < CARD_HEIGHT; i += 40) {
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(CARD_WIDTH, i); ctx.stroke();
  }
  ctx.globalAlpha = 1.0;

  // Main Card Container
  const margin = 20;
  drawRoundedRect(ctx, margin, margin, CARD_WIDTH - margin * 2, CARD_HEIGHT - margin * 2, 20);
  ctx.fillStyle = 'rgba(12, 6, 25, 0.85)';
  ctx.fill();

  // Glow Border
  const borderGrad = ctx.createLinearGradient(margin, margin, CARD_WIDTH - margin, CARD_HEIGHT - margin);
  borderGrad.addColorStop(0, '#7C4DFF');
  borderGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
  borderGrad.addColorStop(1, '#FF3366');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Header Title
  ctx.font = 'bold 24px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.fillText('LIGA PET — ADMIN CUP', 85, 70);

  ctx.font = 'bold 11px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FF3366';
  ctx.fillText('📢 PENDAFTARAN LIGA PVP PET TELAH DIBUKA!', 85, 88);

  // Trophy icon in header
  drawPremiumIcon(ctx, 'trophy', 50, 68, 24, '#FFD700');

  // Header separator line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 115);
  ctx.lineTo(960, 115);
  ctx.stroke();

  // ── LEFT COLUMN: TOURNAMENT DETAILS ──
  const col1X = 45;
  const colWidth = 445;

  ctx.fillStyle = '#FF3366';
  drawRoundedRect(ctx, col1X, 135, 4, 18, 2);
  ctx.fill();

  ctx.font = 'bold 14px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FF3366';
  ctx.fillText('ℹ️ DETAIL PERTANDINGAN', col1X + 12, 149);

  // Time details Y = 175
  const drawDetailBox = (x, y, icon, title, val) => {
    drawRoundedRect(ctx, x, y, colWidth, 75, 8);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.stroke();

    drawPremiumIcon(ctx, icon, x + 24, y + 37, 20, '#FF3366');

    ctx.font = 'bold 11px "DejaVu Sans", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText(title.toUpperCase(), x + 56, y + 28);

    ctx.font = 'bold 14px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(val, x + 56, y + 49);
  };

  const endSec = event.registration_end_at;
  const endDate = new Date(endSec * 1000);
  const dateStr = endDate.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric' });
  const timeStr = endDate.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }) + ' WIB';

  drawDetailBox(col1X, 172, 'clock', 'Batas Waktu Pendaftaran', `${dateStr} @ ${timeStr}`);
  
  const hpLimitText = event.max_hp < 999999 ? `Maksimal ${event.max_hp.toLocaleString('id-ID')} HP` : 'Bebas / Tanpa Batas';
  drawDetailBox(col1X, 258, 'shield', 'Batasan HP Pet', hpLimitText);
  
  const rewardText = event.reward_desc || 'Sesuai Ketentuan Server';
  drawDetailBox(col1X, 344, 'gift', 'Hadiah Liga', rewardText);

  // ── RIGHT COLUMN: PARTICIPANTS LIST ──
  const col2X = 510;

  ctx.fillStyle = '#00E5FF';
  drawRoundedRect(ctx, col2X, 135, 4, 18, 2);
  ctx.fill();

  ctx.font = 'bold 14px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#00E5FF';
  ctx.fillText(`👥 PESERTA TERDAFTAR (${participants.length})`, col2X + 12, 149);

  let rightY = 172;
  const itemHeight = 44;
  const itemGap = 6;
  const maxToDisplay = 6; // Max 6 participants displayed, otherwise show "+X more"

  const displayedList = participants.slice(0, maxToDisplay);

  if (participants.length === 0) {
    ctx.font = 'italic 12px "DejaVu Sans", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillText('Belum ada peserta yang mendaftar. Jadilah yang pertama!', col2X + 10, 200);
  } else {
    displayedList.forEach((p, idx) => {
      drawRoundedRect(ctx, col2X, rightY, colWidth, itemHeight, 8);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Rarity Color Circle
      const rColor = RARITY_COLORS[p.rarity] || RARITY_COLORS.COMMON;
      ctx.beginPath();
      ctx.arc(col2X + 24, rightY + 22, 5, 0, Math.PI * 2);
      ctx.fillStyle = rColor.primary;
      ctx.fill();

      // Pet details
      ctx.font = 'bold 12px "DejaVu Sans", sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(`${p.petName} (Lv.${p.level})`, col2X + 44, rightY + 18);

      // Owner/Pawang details
      ctx.font = '10px "DejaVu Sans", sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fillText(`Pawang: @${p.username}`, col2X + 44, rightY + 33);

      rightY += itemHeight + itemGap;
    });

    if (participants.length > maxToDisplay) {
      const remaining = participants.length - maxToDisplay;
      ctx.font = 'italic 12px "DejaVu Sans", sans-serif';
      ctx.fillStyle = '#00E5FF';
      ctx.fillText(`... dan ${remaining} peserta lainnya telah terdaftar di arena.`, col2X + 10, rightY + 16);
    }
  }

  // Footer separator
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath();
  ctx.moveTo(40, 485);
  ctx.lineTo(960, 485);
  ctx.stroke();

  // Footer notice
  ctx.font = 'italic 11px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFD700';
  ctx.textAlign = 'center';
  ctx.fillText('Klik tombol di bawah ini untuk bergabung atau menarik pendaftaran pet Anda.', 500, 506);

  // Bottom corner metadata
  ctx.font = '10px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.textAlign = 'left';
  ctx.fillText('Liga Pet PvP • Kosan 1A', 45, 532);

  ctx.textAlign = 'right';
  ctx.fillText('Registration Phase', 955, 532);

  return canvas.toBuffer('image/png');
}

async function getTournamentRegistrationAttachment(event, participants) {
  try {
    const buffer = await generateTournamentRegistrationCard(event, participants);
    return new AttachmentBuilder(buffer, { name: 'tournament_registration.png' });
  } catch (e) {
    console.error('[PetCard] Error generating tournament registration attachment:', e);
    return null;
  }
}

/**
 * Generate premium card for Administrator Unified Control Panel
 */
async function generateAdminDashboardCard(client, stats) {
  const CARD_WIDTH = 1000;
  const CARD_HEIGHT = 560;

  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background - Dark purple gradient
  const bgGrad = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  bgGrad.addColorStop(0, '#0c0617');
  bgGrad.addColorStop(0.5, '#150a26');
  bgGrad.addColorStop(1, '#0c0617');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Cyber grid
  ctx.globalAlpha = 0.04;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  for (let i = 0; i < CARD_WIDTH; i += 40) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CARD_HEIGHT); ctx.stroke();
  }
  for (let i = 0; i < CARD_HEIGHT; i += 40) {
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(CARD_WIDTH, i); ctx.stroke();
  }
  ctx.globalAlpha = 1.0;

  // Main Card Container
  const margin = 20;
  drawRoundedRect(ctx, margin, margin, CARD_WIDTH - margin * 2, CARD_HEIGHT - margin * 2, 20);
  ctx.fillStyle = 'rgba(10, 5, 20, 0.85)';
  ctx.fill();

  // Glow Border
  const borderGrad = ctx.createLinearGradient(margin, margin, CARD_WIDTH - margin, CARD_HEIGHT - margin);
  borderGrad.addColorStop(0, '#7C4DFF');
  borderGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
  borderGrad.addColorStop(1, '#00E5FF');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Header Title
  ctx.font = 'bold 24px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.fillText('PUSAT KONTROL TERPADU ADMINISTRATOR', 85, 70);

  ctx.font = 'bold 11px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#7C4DFF';
  ctx.fillText('🛡️ CONFIGURATION & SERVER METRICS PANEL', 85, 88);

  // Shield icon in header
  drawPremiumIcon(ctx, 'shield', 50, 68, 24, '#7C4DFF');

  // Load Bot Avatar
  let botImg = null;
  try {
    const avatarURL = client.user.displayAvatarURL({ extension: 'png', size: 128 });
    botImg = await loadImageSafe(avatarURL);
  } catch (e) {
    console.warn('[PetCard] Failed to load bot avatar for Admin Panel:', e);
  }

  if (botImg) {
    const avatarX = 930;
    const avatarY = 68;
    const avatarR = 25;
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(botImg, avatarX - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
    ctx.restore();
    
    // Avatar border
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
    ctx.strokeStyle = '#7C4DFF';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Header separator line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 115);
  ctx.lineTo(960, 115);
  ctx.stroke();

  // ── LEFT COLUMN: SERVER STATISTICS ──
  const col1X = 45;
  const colWidth = 445;

  ctx.fillStyle = '#00E5FF';
  drawRoundedRect(ctx, col1X, 135, 4, 18, 2);
  ctx.fill();

  ctx.font = 'bold 14px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#00E5FF';
  ctx.fillText('📊 STATISTIK SERVER REAL-TIME', col1X + 12, 149);

  // Detail boxes for stats
  const drawDetailBox = (x, y, icon, title, val, iconColor = '#7C4DFF') => {
    drawRoundedRect(ctx, x, y, colWidth, 75, 8);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.stroke();

    drawPremiumIcon(ctx, icon, x + 24, y + 37, 20, iconColor);

    ctx.font = 'bold 11px "DejaVu Sans", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText(title.toUpperCase(), x + 56, y + 28);

    ctx.font = 'bold 14px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(val, x + 56, y + 49);
  };

  drawDetailBox(col1X, 172, 'user', 'Warga Terdaftar', `${stats.walletsCount.toLocaleString('id-ID')} Jiwa`, '#00E5FF');
  drawDetailBox(col1X, 258, 'paw', 'Pet Aktif di Server', `${stats.activePetsCount.toLocaleString('id-ID')} Peliharaan`, '#00E5FF');
  drawDetailBox(col1X, 344, 'bank', 'Koin Beredar (Dompet + Bank)', `Rp ${stats.totalCoins.toLocaleString('id-ID')}`, '#00E5FF');

  // ── RIGHT COLUMN: CONFIG ABYUS SYSTEM ──
  const col2X = 510;

  ctx.fillStyle = '#7C4DFF';
  drawRoundedRect(ctx, col2X, 135, 4, 18, 2);
  ctx.fill();

  ctx.font = 'bold 14px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#7C4DFF';
  ctx.fillText('⚙️ CONFIG ABYUS SYSTEM', col2X + 12, 149);

  // Detail box 1: Multiplier
  drawDetailBox(col2X, 172, 'chart', 'Chat Multiplier', `${stats.multiplier}x`, '#7C4DFF');

  // Detail box 2: Gacha mode
  drawDetailBox(col2X, 258, 'ticket', 'Gacha Role Mode', stats.gachaMode, '#7C4DFF');

  // Detail box 3: Event Status (with glowing dot drawn on canvas)
  const drawEventStatusBox = (x, y) => {
    drawRoundedRect(ctx, x, y, colWidth, 75, 8);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const isEventActive = stats.isActiveEvent;
    const dotColor = isEventActive ? '#FF3366' : '#00E676';
    const statusText = isEventActive ? 'Abuse Event Aktif' : 'Normal / Aman';

    // Draw Event Status Icon (glowing pulse dot)
    ctx.beginPath();
    ctx.arc(x + 24, y + 37, 6, 0, Math.PI * 2);
    ctx.fillStyle = dotColor;
    ctx.shadowColor = dotColor;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0; // reset shadow

    ctx.font = 'bold 11px "DejaVu Sans", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText('STATUS EVENT', x + 56, y + 28);

    ctx.font = 'bold 14px "DejaVu Sans", sans-serif';
    ctx.fillStyle = dotColor;
    ctx.fillText(statusText, x + 56, y + 49);
  };

  drawEventStatusBox(col2X, 344);

  // Footer separator
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath();
  ctx.moveTo(40, 485);
  ctx.lineTo(960, 485);
  ctx.stroke();

  // Footer notice
  ctx.font = 'italic 11px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFD700';
  ctx.textAlign = 'center';
  ctx.fillText('Gunakan menu dropdown di bawah untuk mengakses sub-panel kontrol.', 500, 506);

  // Bottom corner metadata
  ctx.font = '10px "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.textAlign = 'left';
  ctx.fillText('Sentinel Bot • Admin Dashboard', 45, 532);

  ctx.textAlign = 'right';
  ctx.fillText('Unified Control Hub', 955, 532);

  return canvas.toBuffer('image/png');
}

async function getAdminDashboardAttachment(client, stats) {
  try {
    const buffer = await generateAdminDashboardCard(client, stats);
    return new AttachmentBuilder(buffer, { name: 'admin_dashboard.png' });
  } catch (e) {
    console.error('[PetCard] Error generating admin dashboard attachment:', e);
    return null;
  }
}

/**
 * Generate premium card for Pet Safari biome selection lobby
 */
async function generateSafariLobbyCard(guildName) {
  const CARD_WIDTH = 1600;
  const CARD_HEIGHT = 900;

  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background - Deep Forest / Wilderness Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  bgGrad.addColorStop(0, '#04140b');
  bgGrad.addColorStop(0.5, '#092415');
  bgGrad.addColorStop(1, '#04140b');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Cyber grid
  ctx.globalAlpha = 0.03;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  for (let i = 0; i < CARD_WIDTH; i += 50) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CARD_HEIGHT); ctx.stroke();
  }
  for (let i = 0; i < CARD_HEIGHT; i += 50) {
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(CARD_WIDTH, i); ctx.stroke();
  }
  ctx.globalAlpha = 1.0;

  // Main Card Container
  const margin = 35;
  drawRoundedRect(ctx, margin, margin, CARD_WIDTH - margin * 2, CARD_HEIGHT - margin * 2, 24);
  ctx.fillStyle = 'rgba(6, 18, 10, 0.85)';
  ctx.fill();

  // Glow Border
  const borderGrad = ctx.createLinearGradient(margin, margin, CARD_WIDTH - margin, CARD_HEIGHT - margin);
  borderGrad.addColorStop(0, '#2ECC71');
  borderGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
  borderGrad.addColorStop(1, '#2ECC71');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Header Title
  ctx.font = 'bold 40px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.fillText('PET SAFARI ADVENTURE', 125, 110);

  ctx.font = 'bold 22px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#2ECC71';
  ctx.fillText(`WILAYAH SAFARI LIAR KOSAN 1A • ${guildName.toUpperCase()}`, 125, 142);

  // Paw icon in header
  drawPremiumIcon(ctx, 'paw', 72, 110, 40, '#2ECC71');

  // Header separator line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(70, 180);
  ctx.lineTo(1530, 180);
  ctx.stroke();

  // ── LEFT COLUMN: WELCOME BADGE ──
  const col1X = 70;
  const colWidth = 710;

  ctx.fillStyle = '#2ECC71';
  drawRoundedRect(ctx, col1X, 215, 7, 30, 3.5);
  ctx.fill();

  ctx.font = 'bold 26px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#2ECC71';
  ctx.fillText('JELAJAHI WILAYAH SAFARI', col1X + 22, 238);

  // Large circular badge
  const badgeCX = col1X + colWidth / 2;
  const badgeCY = 480;
  const badgeRadius = 126;

  // Outer glow ring
  ctx.beginPath();
  ctx.arc(badgeCX, badgeCY, badgeRadius + 20, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(46, 204, 113, 0.15)';
  ctx.lineWidth = 6;
  ctx.stroke();

  // Inner ring
  ctx.beginPath();
  ctx.arc(badgeCX, badgeCY, badgeRadius, 0, Math.PI * 2);
  ctx.strokeStyle = '#2ECC71';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Fill
  ctx.beginPath();
  ctx.arc(badgeCX, badgeCY, badgeRadius - 2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(46, 204, 113, 0.05)';
  ctx.fill();

  // Large paw icon inside badge
  drawPremiumIcon(ctx, 'paw', badgeCX, badgeCY, 80, '#2ECC71');

  // Welcome desc text
  ctx.font = '22px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.textAlign = 'center';
  ctx.fillText('Temukan dan tangkap berbagai spesies pet liar legendaris!', badgeCX, 660);
  ctx.fillText('Persiapkan Safari Ball Anda sebelum menjelajah.', badgeCX, 695);

  // ── RIGHT COLUMN: BIOMES LIST ──
  const col2X = 820;

  ctx.fillStyle = '#FFD700';
  drawRoundedRect(ctx, col2X, 215, 7, 30, 3.5);
  ctx.fill();

  ctx.font = 'bold 26px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFD700';
  ctx.fillText('BIOME TERSEDIA', col2X + 22, 238);

  const drawBiomeCapsule = (x, y, icon, title, costText, speciesText, iconColor) => {
    drawRoundedRect(ctx, x, y, colWidth, 120, 12);
    // Draw a subtle biome specific glowing background instead of plain dark
    const capsuleGrad = ctx.createLinearGradient(x, y, x + colWidth, y);
    capsuleGrad.addColorStop(0, 'rgba(255, 255, 255, 0.01)');
    capsuleGrad.addColorStop(0.1, 'rgba(255, 255, 255, 0.02)');
    capsuleGrad.addColorStop(1, `${iconColor}08`); // Hex transparency
    ctx.fillStyle = capsuleGrad;
    ctx.fill();

    // Glow Border per Biome color
    ctx.strokeStyle = `${iconColor}33`; // 20% alpha
    ctx.lineWidth = 1.5;
    ctx.stroke();

    drawPremiumIcon(ctx, icon, x + 40, y + 60, 30, iconColor);

    // Title
    ctx.font = 'bold 22px "Inter", "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.fillText(title, x + 85, y + 40);

    // Cost Badge
    ctx.font = 'bold 18px "Inter", "DejaVu Sans", sans-serif';
    ctx.fillStyle = costText === 'GRATIS' ? '#2ECC71' : '#FFD700';
    ctx.fillText(costText === 'GRATIS' ? 'GRATIS' : `Biaya: ${costText}`, x + 85, y + 70);

    // Species
    ctx.font = 'italic 19px "Inter", "DejaVu Sans", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText(`Fauna: ${speciesText}`, x + 85, y + 100);
  };

  drawBiomeCapsule(col2X, 270, 'leaf', 'Hutan Hijau (Green Forest)', 'GRATIS', 'Slime, Kucing, Golem', '#2ECC71');
  drawBiomeCapsule(col2X, 400, 'fire', 'Lembah Volcanic (Volcanic Valley)', 'Rp 150', 'Naga, Phoenix, Kitsune, Behemoth...', '#E74C3C');
  drawBiomeCapsule(col2X, 530, 'wave', 'Danau Abyss (Abyss Lake)', 'Rp 150', 'Kura-Kura, Siren, Yeti, Leviathan...', '#3498DB');
  drawBiomeCapsule(col2X, 660, 'mountain', 'Pegunungan Kuno (Ancient Peak)', 'Rp 250', 'Pegasus, Kirin, Behemoth, Archdragon...', '#9B59B6');

  // Footer separator
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath();
  ctx.moveTo(70, 810);
  ctx.lineTo(1530, 810);
  ctx.stroke();

  // Footer notice
  ctx.font = 'italic 20px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFD700';
  ctx.textAlign = 'center';
  ctx.fillText('Pilih biome wilayah yang ingin Anda jelajahi di bawah ini.', 800, 840);

  // Bottom corner metadata
  ctx.font = '17px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.textAlign = 'left';
  ctx.fillText('Kosan 1A • Safari Wilderness', 70, 875);

  ctx.textAlign = 'right';
  ctx.fillText('Biome Lobby Selection', 1530, 875);

  return canvas.toBuffer('image/png');
}

async function getSafariLobbyAttachment(guildName) {
  try {
    const buffer = await generateSafariLobbyCard(guildName);
    return new AttachmentBuilder(buffer, { name: 'safari_lobby.png' });
  } catch (e) {
    console.error('[PetCard] Error generating safari lobby attachment:', e);
    return null;
  }
}

/**
 * Generate premium card for active Pet Safari encounter
 */
async function generateSafariEncounterCard(petObj, biomeKey, catchChance, escapeChance, state) {
  const CARD_WIDTH = 1600;
  const CARD_HEIGHT = 900;

  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Biome Themes
  const BIOME_STYLING = {
    forest: {
      bgGrad: ['#04140b', '#092415', '#04140b'],
      accent: '#2ECC71',
      icon: 'leaf',
      label: 'HUTAN HIJAU'
    },
    volcano: {
      bgGrad: ['#1a0505', '#2a0a0a', '#1a0505'],
      accent: '#E74C3C',
      icon: 'fire',
      label: 'LEMBAH VOLCANIC'
    },
    abyss: {
      bgGrad: ['#040f1a', '#081a2e', '#040f1a'],
      accent: '#3498DB',
      icon: 'wave',
      label: 'DANAU ABYSS'
    },
    mountain: {
      bgGrad: ['#0e0514', '#1b0924', '#0e0514'],
      accent: '#9B59B6',
      icon: 'mountain',
      label: 'PEGUNUNGAN KUNO'
    }
  };

  const style = BIOME_STYLING[biomeKey] || BIOME_STYLING.forest;

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  bgGrad.addColorStop(0, style.bgGrad[0]);
  bgGrad.addColorStop(0.5, style.bgGrad[1]);
  bgGrad.addColorStop(1, style.bgGrad[2]);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Cyber grid
  ctx.globalAlpha = 0.03;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  for (let i = 0; i < CARD_WIDTH; i += 50) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CARD_HEIGHT); ctx.stroke();
  }
  for (let i = 0; i < CARD_HEIGHT; i += 50) {
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(CARD_WIDTH, i); ctx.stroke();
  }
  ctx.globalAlpha = 1.0;

  // Outer radial ambient glow from right where pet is
  const radGlow = ctx.createRadialGradient(1180, 440, 80, 1180, 440, 400);
  radGlow.addColorStop(0, `${style.accent}1F`); // 12% alpha
  radGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = radGlow;
  ctx.fillRect(800, 70, 800, 700);

  // Container
  const margin = 35;
  drawRoundedRect(ctx, margin, margin, CARD_WIDTH - margin * 2, CARD_HEIGHT - margin * 2, 24);
  ctx.fillStyle = 'rgba(6, 10, 8, 0.85)';
  ctx.fill();

  // Glow Border
  const borderGrad = ctx.createLinearGradient(margin, margin, CARD_WIDTH - margin, CARD_HEIGHT - margin);
  borderGrad.addColorStop(0, style.accent);
  borderGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
  borderGrad.addColorStop(1, style.accent);
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Header Title
  ctx.font = 'bold 40px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.fillText('SAFARI WILD ENCOUNTER', 125, 110);

  ctx.font = 'bold 22px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = style.accent;
  ctx.fillText(`${style.label} • WILAYAH SAFARI LIAR KOSAN 1A`, 125, 142);

  drawPremiumIcon(ctx, style.icon, 72, 110, 40, style.accent);

  // Header separator
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(70, 180);
  ctx.lineTo(1530, 180);
  ctx.stroke();

  // ── LEFT SIDE: STATUS AND BARS ──
  const colX = 70;
  const colW = 710;

  // Pet Meta & Description Box
  drawRoundedRect(ctx, colX, 200, colW, 160, 14);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.stroke();

  // Name, Rarity & Level
  ctx.font = 'bold 35px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  const cleanName = (petObj.typeName || petObj.name || '')
    .replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u27BF]|\uD83E[\uDD00-\uDFFF]|\uD83F[\uDC00-\uDFFF]|\u200D|\uFE0F|\uFE0E/g, '')
    .trim();
  ctx.fillText(cleanName, colX + 26, 250);

  const rarityInfo = RARITY_COLORS[petObj.rarity] || RARITY_COLORS.COMMON;
  ctx.font = 'bold 19px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = rarityInfo.primary;
  ctx.fillText(`${petObj.rarity.toUpperCase()} • LEVEL ${petObj.level} • ELEMEN: ${petObj.element}`, colX + 28, 288);

  // Short description
  ctx.font = 'italic 20px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillText(`"${petObj.description || 'Spesies liar tangguh dan sangat waspada.'}"`, colX + 28, 336);

  // Status & Parameter Bars
  const barY = 425;
  ctx.font = 'bold 36px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('STATUS & PELUANG', colX, barY - 20);

  // Catch Chance Bar
  drawProgressBar(ctx, colX, barY, colW, 72, catchChance, '#F39C12', '#2ECC71', 'PELUANG TANGKAP', `${Math.round(catchChance * 100)}%`);

  // Escape Risk Bar
  const displayEscape = state.sleepTurns > 0 ? 0 : escapeChance;
  drawProgressBar(ctx, colX, barY + 92, colW, 72, displayEscape, '#E74C3C', '#C0392B', 'RISIKO KABUR', `${Math.round(displayEscape * 100)}%`);

  // Gear & Inventory Status
  const invY = 645;
  ctx.font = 'bold 36px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('PERLENGKAPAN SAFARI', colX, invY - 20);

  drawRoundedRect(ctx, colX, invY, colW, 90, 10);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.01)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.stroke();

  ctx.font = 'bold 26px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillText(`Safari Ball: ${state.balls}/5   Bait: ${state.baits}/3   Mainan: ${state.toys}/3`, colX + 28, invY + 55);

  // Status Badge (Sleep, Alert, etc.)
  const badgeX = colX + 440;
  const badgeY = invY + 18;
  ctx.save();
  ctx.beginPath();
  if (state.sleepTurns > 0) {
    ctx.fillStyle = 'rgba(52, 152, 219, 0.2)';
    ctx.strokeStyle = '#3498DB';
    drawRoundedRect(ctx, badgeX, badgeY, 240, 54, 8);
    ctx.fill(); ctx.stroke();
    ctx.font = 'bold 24px "Inter", "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#3498DB';
    ctx.fillText('TERTIDUR', badgeX + 60, badgeY + 36);
  } else {
    ctx.fillStyle = 'rgba(231, 76, 60, 0.15)';
    ctx.strokeStyle = '#E74C3C';
    drawRoundedRect(ctx, badgeX, badgeY, 240, 54, 8);
    ctx.fill(); ctx.stroke();
    ctx.font = 'bold 24px "Inter", "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#E74C3C';
    ctx.fillText('WASPADA', badgeX + 60, badgeY + 36);
  }
  ctx.restore();

  // ── RIGHT SIDE: PET ILLUSTRATION AND GLOW ──
  const petCX = 1180;
  const petCY = 440;
  const petRadius = 180;

  // Outer premium aura/ring
  ctx.beginPath();
  ctx.arc(petCX, petCY, petRadius + 24, 0, Math.PI * 2);
  ctx.strokeStyle = `${rarityInfo.primary}33`; // Rarity glow color
  ctx.lineWidth = 8;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(petCX, petCY, petRadius, 0, Math.PI * 2);
  ctx.strokeStyle = rarityInfo.primary;
  ctx.lineWidth = 6;
  ctx.stroke();

  // Draw background image or avatar placeholder
  const embeds = require('./embeds');
  const petToImage = {
    ...petObj,
    pet_type: petObj.pet_type || petObj.speciesId || 'SLIME',
    status: petObj.status || 'ADULT'
  };
  const petImgUrl = embeds.getPetImage(petToImage);
  const petImg = await loadImageSafe(petImgUrl);

  if (petImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(petCX, petCY, petRadius - 3, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(petCX - petRadius, petCY - petRadius, petRadius * 2, petRadius * 2);
    ctx.drawImage(petImg, petCX - petRadius + 16, petCY - petRadius + 16, (petRadius - 16) * 2, (petRadius - 16) * 2);
    ctx.restore();
  } else {
    // Default silhouette
    ctx.save();
    ctx.beginPath();
    ctx.arc(petCX, petCY, petRadius - 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fill();
    drawPremiumIcon(ctx, 'paw', petCX, petCY, 100, `${style.accent}44`);
    ctx.restore();
  }

  // Trait indicator (if any)
  if (petObj.trait) {
    ctx.save();
    const traitX = petCX - 120;
    const traitY = petCY + petRadius + 27;
    ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
    ctx.strokeStyle = '#FFD700';
    drawRoundedRect(ctx, traitX, traitY, 240, 42, 8);
    ctx.fill(); ctx.stroke();
    ctx.font = 'bold 18px "Inter", "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'center';
    ctx.fillText(`TRAIT: ${petObj.trait}`, petCX, traitY + 27);
    ctx.restore();
  }

  // Footer separator
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath();
  ctx.moveTo(70, 800);
  ctx.lineTo(1530, 800);
  ctx.stroke();

  // Bottom text/status logs (show last log line)
  const lastLog = state.logs && state.logs.length > 0 ? state.logs[state.logs.length - 1] : 'Mencari pet liar...';
  const cleanLog = lastLog.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u27BF]|\uD83E[\uDD00-\uDFFF]|\uD83F[\uDC00-\uDFFF]|\u200D|\uFE0F|\uFE0E/g, '').replace(/\*\*/g, '').trim();

  ctx.font = 'italic 22px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.textAlign = 'center';
  ctx.fillText(cleanLog, 800, 835);

  // Bottom corner metadata
  ctx.font = '17px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.textAlign = 'left';
  ctx.fillText('Kosan 1A • Safari Wilderness', 70, 875);

  ctx.textAlign = 'right';
  ctx.fillText(`Giliran: ${state.turns} • Wild Encounter`, 1530, 875);

  return canvas.toBuffer('image/png');
}

async function getSafariEncounterAttachment(petObj, biomeKey, catchChance, escapeChance, state) {
  try {
    const buffer = await generateSafariEncounterCard(petObj, biomeKey, catchChance, escapeChance, state);
    return new AttachmentBuilder(buffer, { name: 'safari_encounter.png' });
  } catch (e) {
    console.error('[PetCard] Error generating safari encounter attachment:', e);
    return null;
  }
}

/**
 * Generate visual expedition map list selection card
 */
async function generateExpeditionMapListCard(maps) {
  const canvasW = 1600;
  const canvasH = 1280;
  const canvas = createCanvas(canvasW, canvasH);
  const ctx = canvas.getContext('2d');

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, canvasW, canvasH);
  bgGrad.addColorStop(0, '#060814');
  bgGrad.addColorStop(0.5, '#0B0F2B');
  bgGrad.addColorStop(1, '#060814');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Background glowing circles
  const radGrad1 = ctx.createRadialGradient(1330, 133, 66, 1330, 133, 530);
  radGrad1.addColorStop(0, 'rgba(124, 77, 255, 0.15)');
  radGrad1.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = radGrad1;
  ctx.beginPath();
  ctx.arc(1330, 133, 530, 0, Math.PI * 2);
  ctx.fill();

  const radGrad2 = ctx.createRadialGradient(266, 1060, 66, 266, 1060, 660);
  radGrad2.addColorStop(0, 'rgba(0, 168, 255, 0.12)');
  radGrad2.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = radGrad2;
  ctx.beginPath();
  ctx.arc(266, 1060, 660, 0, Math.PI * 2);
  ctx.fill();

  // Grid background lines (subtle)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  for (let i = 0; i < canvasW; i += 80) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvasH); ctx.stroke();
  }
  for (let j = 0; j < canvasH; j += 80) {
    ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(canvasW, j); ctx.stroke();
  }

  // Header Title (clean, no emojis)
  ctx.font = 'bold 42px "DejaVu Sans"';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.fillText('PILIH ZONA EKSPEDISI TIM PET', canvasW / 2, 65);

  ctx.font = '19px "DejaVu Sans"';
  ctx.fillStyle = '#A0AEC0';
  ctx.fillText('Pilihlah salah satu dari 10 zona ekspedisi di bawah untuk memulai petualangan bersama tim pet Anda!', canvasW / 2, 100);

  const ELEMENT_COLORS = {
    FIRE: { accent: '#FF5252', bg: 'rgba(255, 82, 82, 0.12)' },
    WATER: { accent: '#40C4FF', bg: 'rgba(64, 196, 255, 0.12)' },
    EARTH: { accent: '#69F0AE', bg: 'rgba(105, 240, 172, 0.12)' },
    DRAGON: { accent: '#E040FB', bg: 'rgba(224, 64, 251, 0.12)' }
  };

  const cleanTextLocal = (t) => (t || '')
    .replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u27BF]|\uD83E[\uDD00-\uDFFF]|\uD83F[\uDC00-\uDFFF]|\u200D|\uFE0F|\uFE0E/g, '')
    .replace(/\*\*/g, '').trim();

  const wrapTextLocal = (wordsText, maxWidth) => {
    const words = wordsText.split(' ');
    const lines = [];
    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(currentLine + ' ' + word).width;
      if (width < maxWidth) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  };

  // Load map images in parallel
  const mapImageMap = new Map();
  await Promise.all(
    maps.map(async (m) => {
      const mapPath = path.join(__dirname, '..', 'assets', 'maps', `map${m.id}.png`);
      if (fs.existsSync(mapPath)) {
        try {
          const img = await loadImage(mapPath);
          mapImageMap.set(m.id, img);
        } catch (e) {
          console.warn(`[PetCard] Failed to load map ${m.id}:`, e.message);
        }
      }
    })
  );

  // Render cards
  const startY = 146;
  const cardW = 730;
  const cardH = 193;
  const marginX = 53;
  const gapBetweenCols = 27;
  const gapBetweenRows = 24;

  for (let index = 0; index < maps.length; index++) {
    const m = maps[index];
    const col = index % 2;
    const row = Math.floor(index / 2);

    const x = marginX + col * (cardW + gapBetweenCols);
    const y = startY + row * (cardH + gapBetweenRows);

    const theme = ELEMENT_COLORS[m.element.toUpperCase()] || ELEMENT_COLORS.EARTH;

    // Draw card background
    drawRoundedRect(ctx, x, y, cardW, cardH, 22);
    ctx.fillStyle = 'rgba(10, 13, 27, 0.9)';
    ctx.fill();

    // Draw border
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner glowing left border line
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + 2, y + 22);
    ctx.quadraticCurveTo(x + 2, y + 2, x + 22, y + 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + 2, y + 22);
    ctx.lineTo(x + 2, y + cardH - 22);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + 2, y + cardH - 22);
    ctx.quadraticCurveTo(x + 2, y + cardH - 2, x + 22, y + cardH - 2);
    ctx.stroke();

    // ── Left Side: Map Image Thumbnail ──
    const imgX = x + 16;
    const imgY = y + 16;
    const imgSize = 161;

    ctx.save();
    drawRoundedRect(ctx, imgX, imgY, imgSize, imgSize, 16);
    ctx.clip();

    const mapImg = mapImageMap.get(m.id);
    if (mapImg) {
      ctx.drawImage(mapImg, imgX, imgY, imgSize, imgSize);
    } else {
      ctx.fillStyle = '#1B1E30';
      ctx.fillRect(imgX, imgY, imgSize, imgSize);
    }
    ctx.restore();

    // Thumbnail outline border with glow
    ctx.save();
    ctx.shadowColor = theme.accent;
    ctx.shadowBlur = 8;
    drawRoundedRect(ctx, imgX, imgY, imgSize, imgSize, 16);
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Circular ID Badge on top-left of image
    const badgeR = 19;
    const badgeX = imgX + 24;
    const badgeY = imgY + 24;

    ctx.fillStyle = theme.accent;
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
    ctx.fill();

    // Inner circle
    ctx.fillStyle = '#060814';
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, badgeR - 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 16px "DejaVu Sans"';
    ctx.fillStyle = theme.accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(m.id), badgeX, badgeY);

    // ── Right Side: Text & Badges ──
    const textX = imgX + imgSize + 20;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // 1. Map Name (strip emojis)
    const cleanMapName = cleanTextLocal(m.name);
    ctx.font = 'bold 20px "DejaVu Sans"';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(cleanMapName, textX, y + 37);

    // 2. Badges: Element Pill & Level Pill
    const rawEl = m.element.toUpperCase();
    const elemText = (rawEl === 'FIRE' ? '🔥 ' : rawEl === 'WATER' ? '🌊 ' : rawEl === 'EARTH' ? '🌿 ' : '🐉 ') + m.element;
    ctx.font = 'bold 13px "DejaVu Sans"';
    const elemW = ctx.measureText(elemText).width + 22;
    const badgeH = 24;
    const badgeYPos = y + 50;

    drawRoundedRect(ctx, textX, badgeYPos, elemW, badgeH, 12);
    ctx.fillStyle = theme.bg;
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = theme.accent;
    ctx.fillText(elemText, textX + 11, badgeYPos + 17);

    // Recommended Level Badge Pill
    const lvlText = `Lv. ${m.recommendedLevel}+`;
    ctx.font = '13px "DejaVu Sans"';
    const lvlW = ctx.measureText(lvlText).width + 22;
    const lvlX = textX + elemW + 11;

    drawRoundedRect(ctx, lvlX, badgeYPos, lvlW, badgeH, 12);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.stroke();

    ctx.fillStyle = '#CBD5E0';
    ctx.fillText(lvlText, lvlX + 11, badgeYPos + 17);

    // 3. Stats Row: Win Rate & Prize
    const statY = y + 98;
    ctx.font = '16px "DejaVu Sans"';
    ctx.fillStyle = '#A0AEC0';
    ctx.fillText('📊 Rate:', textX, statY);
    const rateLabelW = ctx.measureText('📊 Rate:').width;

    ctx.fillStyle = m.baseSuccessRate >= 60 ? '#4ADE80' : (m.baseSuccessRate >= 35 ? '#FBBF24' : '#F87171');
    ctx.fillText(`${m.baseSuccessRate}%`, textX + rateLabelW + 8, statY);
    const rateValW = ctx.measureText(`${m.baseSuccessRate}%`).width;

    // Prize range text
    const prizeStartX = textX + rateLabelW + 8 + rateValW + 27;
    ctx.fillStyle = '#A0AEC0';
    ctx.fillText('🪙 Hadiah:', prizeStartX, statY);
    const prizeLabelW = ctx.measureText('🪙 Hadiah:').width;
    ctx.fillStyle = '#FBBF24'; // Gold
    ctx.font = 'bold 16px "DejaVu Sans"';
    ctx.fillText(`Rp ${m.minPrize.toLocaleString('id-ID')} - ${m.maxPrize.toLocaleString('id-ID')}`, prizeStartX + prizeLabelW + 8, statY);

    // 4. Boss Name Row
    const bossY = y + 125;
    ctx.font = '16px "DejaVu Sans"';
    ctx.fillStyle = '#A0AEC0';
    ctx.fillText('💀 Boss:', textX, bossY);
    const bossLabelW = ctx.measureText('💀 Boss:').width;
    ctx.fillStyle = '#FF5252'; // Red for boss name
    ctx.font = 'bold 16px "DejaVu Sans"';
    ctx.fillText(m.boss, textX + bossLabelW + 8, bossY);

    // 5. Description Text
    const descY = y + 153;
    ctx.font = 'italic 14px "DejaVu Sans"';
    ctx.fillStyle = '#718096';
    const descLines = wrapTextLocal(m.description, cardW - (imgSize + 47));
    if (descLines.length > 0) {
      ctx.fillText(descLines[0], textX, descY);
      if (descLines.length > 1) {
        ctx.fillText(descLines[1], textX, descY + 19);
      }
    }
  }

  return canvas.toBuffer('image/png');
}

async function getExpeditionMapListAttachment(maps) {
  try {
    const buffer = await generateExpeditionMapListCard(maps);
    return new AttachmentBuilder(buffer, { name: 'pet_expedition_maps.png' });
  } catch (e) {
    console.error('[PetCard] Error generating expedition map list attachment:', e);
    return null;
  }
}

async function generateArenaVsCard(playerPet, botPet, tierKey) {
  const canvas = createCanvas(CARD_WIDTH, 360);
  const ctx = canvas.getContext('2d');

  // 1. Draw split background
  // Left half (Player: Blue)
  const leftGrad = ctx.createLinearGradient(0, 0, CARD_WIDTH / 2, 360);
  leftGrad.addColorStop(0, '#0a0f24');
  leftGrad.addColorStop(1, '#1e295d');
  ctx.fillStyle = leftGrad;
  ctx.fillRect(0, 0, CARD_WIDTH / 2, 360);

  // Right half (Bot: Purple)
  const rightGrad = ctx.createLinearGradient(CARD_WIDTH / 2, 0, CARD_WIDTH, 360);
  rightGrad.addColorStop(0, '#311042');
  rightGrad.addColorStop(1, '#0c061a');
  ctx.fillStyle = rightGrad;
  ctx.fillRect(CARD_WIDTH / 2, 0, CARD_WIDTH / 2, 360);

  // 2. Draw middle diagonal slash
  ctx.beginPath();
  ctx.moveTo(CARD_WIDTH / 2 - 40, 0);
  ctx.lineTo(CARD_WIDTH / 2 + 40, 360);
  ctx.strokeStyle = '#111122';
  ctx.lineWidth = 15;
  ctx.stroke();

  // Glow line
  ctx.beginPath();
  ctx.moveTo(CARD_WIDTH / 2 - 40, 0);
  ctx.lineTo(CARD_WIDTH / 2 + 40, 360);
  ctx.strokeStyle = '#e040fb';
  ctx.lineWidth = 2;
  ctx.shadowBlur = 8;
  ctx.shadowColor = '#e040fb';
  ctx.stroke();
  ctx.shadowBlur = 0; // reset shadow

  // 3. Load Images
  let playerImg = null;
  let botImg = null;
  const embeds = require('./embeds');

  try {
    const playerPetWithDefaults = { status: 'ADULT', level: 10, ...playerPet };
    const playerImgUrl = embeds.getPetImage(playerPetWithDefaults);
    if (playerImgUrl) playerImg = await loadImageSafe(playerImgUrl);
  } catch (e) {
    console.error('[PetCard] Failed to load player pet image:', e);
  }

  try {
    const dummyBot = { pet_type: botPet.pet_type, status: 'ADULT', level: 10 };
    const botImgUrl = embeds.getPetImage(dummyBot);
    if (botImgUrl) botImg = await loadImageSafe(botImgUrl);
  } catch (e) {
    console.error('[PetCard] Failed to load bot pet image:', e);
  }

  // 4. Draw Player Pet (Left Side)
  const pX = 220;
  const avatarY = 120;
  const avatarR = 55;

  // Outer glow ring
  ctx.beginPath();
  ctx.arc(pX, avatarY, avatarR + 3, 0, Math.PI * 2);
  ctx.fillStyle = '#00e5ff';
  ctx.shadowBlur = 15;
  ctx.shadowColor = '#00e5ff';
  ctx.fill();
  ctx.shadowBlur = 0; // reset

  // Avatar Image
  if (playerImg) {
    drawCircleAvatar(ctx, playerImg, pX, avatarY, avatarR, '#0f172a', '#00e5ff');
  } else {
    ctx.beginPath();
    ctx.arc(pX, avatarY, avatarR, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.font = 'bold 36px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((playerPet.pet_name || 'Pet')[0].toUpperCase(), pX, avatarY);
  }

  // Label PLAYER
  ctx.textBaseline = 'alphabetic';
  ctx.font = 'bold 13px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#00e5ff';
  ctx.textAlign = 'center';
  ctx.fillText('🏆 PLAYER', pX, 45);

  // Pet Name
  ctx.font = 'bold 22px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(playerPet.pet_name || 'My Pet', pX, 205);

  // Element
  ctx.font = '13px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`Element: ${playerPet.gacha_element || 'EARTH'}`, pX, 228);

  // Stats Grid 2x2
  const statYStart = 270;
  ctx.font = 'bold 13px "DejaVu Sans", sans-serif';
  ctx.textAlign = 'left';

  // STR
  ctx.fillStyle = '#f87171';
  ctx.fillText(`STR: ${playerPet.stat_str || 0}`, pX - 90, statYStart);
  // DEF
  ctx.fillStyle = '#60a5fa';
  ctx.fillText(`DEF: ${playerPet.stat_def || 0}`, pX + 20, statYStart);
  // VIT
  ctx.fillStyle = '#34d399';
  ctx.fillText(`VIT: ${playerPet.stat_vit || 0}`, pX - 90, statYStart + 25);
  // DEX
  ctx.fillStyle = '#fbbf24';
  ctx.fillText(`DEX: ${playerPet.stat_dex || 0}`, pX + 20, statYStart + 25);


  // 5. Draw Bot Pet (Right Side)
  const bX = 700;

  // Outer glow ring (Red/Purple)
  ctx.beginPath();
  ctx.arc(bX, avatarY, avatarR + 3, 0, Math.PI * 2);
  ctx.fillStyle = '#f43f5e';
  ctx.shadowBlur = 15;
  ctx.shadowColor = '#f43f5e';
  ctx.fill();
  ctx.shadowBlur = 0; // reset

  // Avatar Image
  if (botImg) {
    drawCircleAvatar(ctx, botImg, bX, avatarY, avatarR, '#0f172a', '#f43f5e');
  } else {
    ctx.beginPath();
    ctx.arc(bX, avatarY, avatarR, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.font = 'bold 36px "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((botPet.name || 'Bot')[0].toUpperCase(), bX, avatarY);
  }

  // Label OPPONENT BOT
  ctx.textBaseline = 'alphabetic';
  ctx.font = 'bold 13px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#f43f5e';
  ctx.textAlign = 'center';
  ctx.fillText('🤖 OPPONENT BOT', bX, 45);

  // Bot Name
  ctx.font = 'bold 22px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(botPet.name || 'Bot', bX, 205);

  // Bot Archetype Badge
  const badgeText = botPet.archetype || 'BALANCED';
  ctx.font = 'bold 11px "DejaVu Sans", sans-serif';
  const badgeW = ctx.measureText(badgeText).width + 16;
  const badgeH = 20;
  const badgeX = bX - badgeW / 2;
  const badgeY = 216;

  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 6);
  ctx.fillStyle = 'rgba(244,63,94,0.15)';
  ctx.fill();
  ctx.strokeStyle = '#f43f5e';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#ff8a9d';
  ctx.textAlign = 'center';
  ctx.fillText(badgeText, bX, badgeY + 14);

  // Stats Grid 2x2
  ctx.font = 'bold 13px "DejaVu Sans", sans-serif';
  ctx.textAlign = 'left';

  // STR
  ctx.fillStyle = '#f87171';
  ctx.fillText(`STR: ${botPet.stat_str || 0}`, bX - 90, statYStart);
  // DEF
  ctx.fillStyle = '#60a5fa';
  ctx.fillText(`DEF: ${botPet.stat_def || 0}`, bX + 20, statYStart);
  // VIT
  ctx.fillStyle = '#34d399';
  ctx.fillText(`VIT: ${botPet.stat_vit || 0}`, bX - 90, statYStart + 25);
  // DEX
  ctx.fillStyle = '#fbbf24';
  ctx.fillText(`DEX: ${botPet.stat_dex || 0}`, bX + 20, statYStart + 25);


  // 6. Draw Center VS
  ctx.textAlign = 'center';
  ctx.shadowBlur = 20;
  ctx.shadowColor = '#e040fb';
  const vsGrad = ctx.createLinearGradient(CARD_WIDTH / 2 - 20, 120, CARD_WIDTH / 2 + 20, 180);
  vsGrad.addColorStop(0, '#f5d0fe');
  vsGrad.addColorStop(0.5, '#e040fb');
  vsGrad.addColorStop(1, '#86198f');
  ctx.fillStyle = vsGrad;
  ctx.font = 'italic bold 56px "DejaVu Sans", sans-serif';
  ctx.fillText('VS', CARD_WIDTH / 2, 175);
  ctx.shadowBlur = 0; // reset

  // Tier info label
  ctx.font = 'bold 14px "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#e040fb';
  ctx.fillText((tierKey || 'ARENA LIGA').replace('_', ' '), CARD_WIDTH / 2, 215);

  // Card Outer Border
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, CARD_WIDTH - 4, 356);

  return canvas.toBuffer('image/png');
}

async function getArenaVsCardAttachment(playerPet, botPet, tierKey) {
  try {
    const buffer = await generateArenaVsCard(playerPet, botPet, tierKey);
    return new AttachmentBuilder(buffer, { name: 'arena_vs.png' });
  } catch (e) {
    console.error('[PetCard] Error generating arena VS card attachment:', e);
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
  generateProfileDashboardCard,
  generatePortfolioCard,
  generatePropertyCard,
  generateLeaderboardCard,
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
  getProfileDashboardAttachment,
  getPortfolioAttachment,
  getPropertyAttachment,
  getLeaderboardAttachment,
  generatePortalHubCard,
  getPortalHubAttachment,
  generateTournamentRegistrationCard,
  getTournamentRegistrationAttachment,
  generateAdminDashboardCard,
  getAdminDashboardAttachment,
  generateSafariEncounterCard,
  getSafariEncounterAttachment,
  generateSafariLobbyCard,
  getSafariLobbyAttachment,
  generateHeistLobbyCard,
  getHeistLobbyAttachment,
  generateHeistStepCard,
  getHeistStepAttachment,
  generateHeistFailureCard,
  getHeistFailureAttachment,
  generateHeistResultCard,
  getHeistResultAttachment,
  generateExpeditionMapListCard,
  getExpeditionMapListAttachment,
  generateArenaVsCard,
  getArenaVsCardAttachment,
  loadImageSafe,
  RARITY_COLORS,
  ELEMENT_THEMES,
};

// ═══════════════════════════════════════════════
// DYNAMIC HEIST CANVAS CARDS GENERATOR
// ═══════════════════════════════════════════════

async function generateHeistLobbyCard(initiatorUser, participants, successRate, minPrize, maxPrize, prepFee, endTimeUnix) {
  const canvas = createCanvas(EXP_WIDTH, EXP_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Load Dark Celestial/Cyber Background
  const bgGrad = ctx.createLinearGradient(0, 0, EXP_WIDTH, EXP_HEIGHT);
  bgGrad.addColorStop(0, '#0c0202');
  bgGrad.addColorStop(0.5, '#220808');
  bgGrad.addColorStop(1, '#0c0202');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, EXP_WIDTH, EXP_HEIGHT);

  // Cyber Grid lines
  ctx.globalAlpha = 0.04;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  for (let i = 0; i < EXP_WIDTH; i += 40) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, EXP_HEIGHT); ctx.stroke();
  }
  for (let i = 0; i < EXP_HEIGHT; i += 40) {
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(EXP_WIDTH, i); ctx.stroke();
  }
  ctx.globalAlpha = 1.0;

  // Dark overlay panel
  const panelMargin = 15;
  drawRoundedRect(ctx, panelMargin, panelMargin, EXP_WIDTH - panelMargin * 2, EXP_HEIGHT - panelMargin * 2, 18);
  ctx.fillStyle = 'rgba(12, 6, 6, 0.88)';
  ctx.fill();

  // Red neon border glow
  const borderGrad = ctx.createLinearGradient(panelMargin, panelMargin, EXP_WIDTH - panelMargin, EXP_HEIGHT - panelMargin);
  borderGrad.addColorStop(0, '#FF3D0080');
  borderGrad.addColorStop(1, '#D5000080');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Header Title
  ctx.font = 'bold 22px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#D50000';
  ctx.textAlign = 'center';
  ctx.fillText('CENTRAL BANK HEIST • LOBI OPERASI', EXP_WIDTH / 2, 55);

  ctx.font = 'italic 11px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fillText('Persiapkan tim elit Anda. Bobol sistem keamanan dan bawa pulang jarahan!', EXP_WIDTH / 2, 78);

  // Split into left & right panel
  const splitX = 430;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath(); ctx.moveTo(splitX, 105); ctx.lineTo(splitX, 420); ctx.stroke();

  // LEFT PANEL: Kru Info
  ctx.textAlign = 'left';
  ctx.font = 'bold 13px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#D50000';
  ctx.fillText('DAFTAR KRU OPERASI', 45, 120);

  let startY = 145;
  const rolesList = ['Otak Kriminal', 'Peretas Keamanan', 'Ahli Peledak', 'Jaga Sandera', 'Pembawa Jarahan', 'Pembalap Pelarian'];
  
  for (let i = 0; i < 6; i++) {
    const isJoined = i < participants.length;
    const participantId = isJoined ? participants[i] : null;
    const roleName = rolesList[i] || 'Anggota Kru Backup';

    // Box row
    drawRoundedRect(ctx, 45, startY - 14, 360, 32, 6);
    ctx.fillStyle = isJoined ? 'rgba(213, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.01)';
    ctx.fill();
    ctx.strokeStyle = isJoined ? 'rgba(213, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.03)';
    ctx.stroke();

    ctx.font = 'bold 11px "Inter", "DejaVu Sans", sans-serif';
    ctx.fillStyle = isJoined ? '#FFFFFF' : '#5A6270';
    ctx.fillText(isJoined ? `KRU ${i + 1}: ID ${participantId.slice(-6)}` : `KRU ${i + 1}: MENUNGGU...`, 60, startY + 6);

    ctx.font = 'italic 9px "Inter", "DejaVu Sans", sans-serif';
    ctx.fillStyle = isJoined ? '#FF3D00' : '#454C5E';
    ctx.textAlign = 'right';
    ctx.fillText(roleName.toUpperCase(), 390, startY + 6);
    ctx.textAlign = 'left';

    startY += 40;
  }

  // RIGHT PANEL: Analisis Risiko & Informasi
  const rightX = 465;
  ctx.textAlign = 'left';
  ctx.font = 'bold 13px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#D50000';
  ctx.fillText('ANALISIS RISIKO & ESTIMASI', rightX, 120);

  // Success bar
  const barY = 145;
  ctx.font = '11px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#8E9AA8';
  ctx.fillText('PELUANG SUKSES TIM', rightX, barY);
  drawProgressBar(ctx, rightX, barY + 8, 410, 20, successRate / 100, '#D50000', '#FF3D00', null, `${successRate}%`);

  // Info boxes
  const boxY = 210;
  const drawInfoRow = (y, label, val, color) => {
    drawRoundedRect(ctx, rightX, y, 410, 48, 8);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.stroke();

    ctx.font = 'bold 9px "Inter", "DejaVu Sans", sans-serif';
    ctx.fillStyle = '#8E9AA8';
    ctx.textAlign = 'left';
    ctx.fillText(label.toUpperCase(), rightX + 16, y + 18);

    ctx.font = 'bold 14px "Inter", "DejaVu Sans", sans-serif';
    ctx.fillStyle = color || '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.fillText(val, rightX + 16, y + 36);
  };

  drawInfoRow(boxY, 'Estimasi Jarahan Brankas', `Rp ${minPrize.toLocaleString('id-ID')} - Rp ${maxPrize.toLocaleString('id-ID')}`, '#FFD700');
  drawInfoRow(boxY + 62, 'Biaya Persiapan / Kru', `Rp ${prepFee.toLocaleString('id-ID')}`, '#FFFFFF');
  
  const secondsLeft = Math.max(0, endTimeUnix - Math.floor(Date.now() / 1000));
  drawInfoRow(boxY + 124, 'Operasi Dimulai Dalam', `${secondsLeft} Detik`, '#FF3D00');

  // Watermark footer
  ctx.textAlign = 'center';
  ctx.font = '9px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillText('Kosan 1A RPG • Central Bank Heist Lobby', EXP_WIDTH / 2, EXP_HEIGHT - 22);

  return canvas.toBuffer('image/png');
}

async function getHeistLobbyAttachment(initiatorUser, participants, successRate, minPrize, maxPrize, prepFee, endTimeUnix) {
  try {
    const buffer = await generateHeistLobbyCard(initiatorUser, participants, successRate, minPrize, maxPrize, prepFee, endTimeUnix);
    return new AttachmentBuilder(buffer, { name: 'heist_lobby.png' });
  } catch (e) {
    console.error('[PetCard] Error generating heist lobby card:', e);
    return null;
  }
}

async function generateHeistStepCard(stepNumber, totalSteps, stepTitle, stepDesc, targetUser, endTimeQteUnix) {
  const canvas = createCanvas(EXP_WIDTH, EXP_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, EXP_WIDTH, EXP_HEIGHT);
  bgGrad.addColorStop(0, '#0f0505');
  bgGrad.addColorStop(0.5, '#221111');
  bgGrad.addColorStop(1, '#0f0505');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, EXP_WIDTH, EXP_HEIGHT);

  // Overlay
  const panelMargin = 15;
  drawRoundedRect(ctx, panelMargin, panelMargin, EXP_WIDTH - panelMargin * 2, EXP_HEIGHT - panelMargin * 2, 18);
  ctx.fillStyle = 'rgba(12, 8, 8, 0.9)';
  ctx.fill();

  // Orange/Red border glow
  const borderGrad = ctx.createLinearGradient(panelMargin, panelMargin, EXP_WIDTH - panelMargin, EXP_HEIGHT - panelMargin);
  borderGrad.addColorStop(0, '#FF910080');
  borderGrad.addColorStop(1, '#FF3D0080');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Header Title
  ctx.font = 'bold 22px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FF9100';
  ctx.textAlign = 'center';
  ctx.fillText(`FASE EKSEKUSI QTE: TAHAP ${stepNumber}/${totalSteps}`, EXP_WIDTH / 2, 55);

  ctx.font = 'italic 11px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fillText('Sistem keamanan aktif mendeteksi peretas! Cepat ambil tindakan!', EXP_WIDTH / 2, 78);

  // User Target Box
  const targetX = 50, targetY = 115, targetW = 820, targetH = 85;
  drawRoundedRect(ctx, targetX, targetY, targetW, targetH, 12);
  ctx.fillStyle = 'rgba(255, 145, 0, 0.05)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 145, 0, 0.2)';
  ctx.stroke();

  // Avatar target loading
  let avatarImg = null;
  if (targetUser && targetUser.displayAvatarURL) {
    const avatarURL = targetUser.displayAvatarURL({ extension: 'png', size: 128 });
    avatarImg = await loadImageSafe(avatarURL);
  }
  
  if (avatarImg) {
    drawCircleAvatar(ctx, avatarImg, targetX + 50, targetY + 42, 30, '#FF9100', 'rgba(255, 145, 0, 0.2)');
  }

  ctx.textAlign = 'left';
  ctx.font = 'bold 15px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('TARGET OPERASI SAAT INI', targetX + 105, targetY + 36);

  ctx.font = 'bold 11px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FF9100';
  ctx.fillText(targetUser ? targetUser.username.toUpperCase() : 'USER TARGET', targetX + 105, targetY + 56);

  // Role Description Box
  const roleY = 220;
  drawRoundedRect(ctx, targetX, roleY, targetW, 140, 12);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.stroke();

  ctx.font = 'bold 12px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FF9100';
  ctx.fillText(`PERAN KRU: ${stepTitle.toUpperCase()}`, targetX + 24, roleY + 35);

  const cleanDesc = stepDesc.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u27BF]|\uD83E[\uDD00-\uDFFF]|\uD83F[\uDC00-\uDFFF]|\u200D|\uFE0F|\uFE0E/g, '').replace(/\*\*/g, '').trim();
  ctx.font = '13px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(cleanDesc, targetX + 24, roleY + 65);

  const secondsLeft = Math.max(0, endTimeQteUnix - Math.floor(Date.now() / 1000));
  ctx.font = 'bold 11px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#E74C3C';
  ctx.fillText(`Sisa Waktu Reaksi: ${secondsLeft} detik`, targetX + 24, roleY + 105);

  // Warning footer notice
  ctx.textAlign = 'center';
  ctx.font = 'italic 10px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 51, 102, 0.7)';
  ctx.fillText('Peringatan: Salah klik atau klik oleh kru lain memicu kegagalan instan (Interference Fail)!', EXP_WIDTH / 2, 400);

  // Progress Bar QTE
  drawProgressBar(ctx, targetX, 420, targetW, 16, stepNumber / totalSteps, '#FF9100', '#FF3D00', null, `Tingkat Kemajuan: Tahap ${stepNumber}/${totalSteps}`);

  return canvas.toBuffer('image/png');
}

async function getHeistStepAttachment(stepNumber, totalSteps, stepTitle, stepDesc, targetUser, endTimeQteUnix) {
  try {
    const buffer = await generateHeistStepCard(stepNumber, totalSteps, stepTitle, stepDesc, targetUser, endTimeQteUnix);
    return new AttachmentBuilder(buffer, { name: 'heist_step.png' });
  } catch (e) {
    console.error('[PetCard] Error generating heist step QTE card:', e);
    return null;
  }
}

async function generateHeistFailureCard(failedUser, reasonType) {
  const canvas = createCanvas(EXP_WIDTH, EXP_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, EXP_WIDTH, EXP_HEIGHT);
  bgGrad.addColorStop(0, '#1a0000');
  bgGrad.addColorStop(0.5, '#3a0000');
  bgGrad.addColorStop(1, '#1a0000');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, EXP_WIDTH, EXP_HEIGHT);

  // Overlay
  const panelMargin = 15;
  drawRoundedRect(ctx, panelMargin, panelMargin, EXP_WIDTH - panelMargin * 2, EXP_HEIGHT - panelMargin * 2, 18);
  ctx.fillStyle = 'rgba(15, 6, 6, 0.9)';
  ctx.fill();

  ctx.strokeStyle = '#D50000';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Header Title
  ctx.font = 'bold 24px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#D50000';
  ctx.textAlign = 'center';
  ctx.fillText('OPERASI HEIST GAGAL TOTAL!', EXP_WIDTH / 2, 60);

  // Large alert icon
  drawPremiumIcon(ctx, 'shield', EXP_WIDTH / 2, 145, 60, '#D50000');

  // Description
  ctx.font = 'bold 15px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('ALARM BERBUNYI! TIM SWAT MENGEPUNG BANK!', EXP_WIDTH / 2, 220);

  let causeText = '';
  if (reasonType === 'Timeout') {
    causeText = `${failedUser ? failedUser.username : 'Target'} lambat bereaksi! Batas waktu habis.`;
  } else {
    causeText = `${failedUser ? failedUser.username : 'Kru'} salah klik di luar gilirannya (Interferensi)!`;
  }

  ctx.font = '13px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#A0AABF';
  ctx.fillText(causeText, EXP_WIDTH / 2, 260);
  ctx.fillText('Seluruh kru perampok dijebloskan ke penjara virtual dan didenda kerugian.', EXP_WIDTH / 2, 290);

  // Footer notice
  ctx.font = 'italic 10px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillText('Kosan 1A RPG • Heist Failure Report', EXP_WIDTH / 2, EXP_HEIGHT - 22);

  return canvas.toBuffer('image/png');
}

async function getHeistFailureAttachment(failedUser, reasonType) {
  try {
    const buffer = await generateHeistFailureCard(failedUser, reasonType);
    return new AttachmentBuilder(buffer, { name: 'heist_failure.png' });
  } catch (e) {
    console.error('[PetCard] Error generating heist failure card:', e);
    return null;
  }
}

async function generateHeistResultCard(success, totalReward, rewardPerPerson, fineAmount, jailHours) {
  const canvas = createCanvas(EXP_WIDTH, EXP_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, EXP_WIDTH, EXP_HEIGHT);
  bgGrad.addColorStop(0, success ? '#001a0d' : '#1a000b');
  bgGrad.addColorStop(0.5, success ? '#043615' : '#33081b');
  bgGrad.addColorStop(1, success ? '#001a0d' : '#1a000b');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, EXP_WIDTH, EXP_HEIGHT);

  // Overlay
  const panelMargin = 15;
  drawRoundedRect(ctx, panelMargin, panelMargin, EXP_WIDTH - panelMargin * 2, EXP_HEIGHT - panelMargin * 2, 18);
  ctx.fillStyle = success ? 'rgba(6, 20, 12, 0.9)' : 'rgba(20, 6, 12, 0.9)';
  ctx.fill();

  ctx.strokeStyle = success ? '#00E676' : '#FF3366';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Header Title
  ctx.font = 'bold 24px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = success ? '#00E676' : '#FF3366';
  ctx.textAlign = 'center';
  ctx.fillText(success ? 'OPERASI BANK HEIST SUKSES BESAR!' : 'OPERASI HEIST GAGAL NORMAL', EXP_WIDTH / 2, 60);

  // Large medal/badge icon
  if (success) {
    drawPremiumIcon(ctx, 'trophy', EXP_WIDTH / 2, 145, 60, '#FFD700');
  } else {
    drawPremiumIcon(ctx, 'shield', EXP_WIDTH / 2, 145, 60, '#FF3366');
  }

  // Details
  ctx.font = 'bold 15px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(success ? 'Kru Berhasil Menggondol Koin Brankas Bank!' : 'Kru Tertangkap Polisi di Luar Gedung!', EXP_WIDTH / 2, 220);

  ctx.font = '13px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = '#A0AABF';
  if (success) {
    ctx.fillText(`Total Jarahan: Rp ${totalReward.toLocaleString('id-ID')}`, EXP_WIDTH / 2, 260);
    ctx.fillText(`Bagian Per Orang: +Rp ${rewardPerPerson.toLocaleString('id-ID')}`, EXP_WIDTH / 2, 290);
  } else {
    ctx.fillText(`Denda Kerugian per Kru: Rp ${fineAmount.toLocaleString('id-ID')}`, EXP_WIDTH / 2, 260);
    ctx.fillText(`Masa Tahanan Sel: ${jailHours} Jam`, EXP_WIDTH / 2, 290);
  }

  // Footer notice
  ctx.font = 'italic 10px "Inter", "DejaVu Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillText('Kosan 1A RPG • Heist Operational Report', EXP_WIDTH / 2, EXP_HEIGHT - 22);

  return canvas.toBuffer('image/png');
}

async function getHeistResultAttachment(success, totalReward, rewardPerPerson, fineAmount, jailHours) {
  try {
    const buffer = await generateHeistResultCard(success, totalReward, rewardPerPerson, fineAmount, jailHours);
    return new AttachmentBuilder(buffer, { name: 'heist_result.png' });
  } catch (e) {
    console.error('[PetCard] Error generating heist result card:', e);
    return null;
  }
}


