const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

// Font yang tersedia di VPS: DejaVu Sans, DejaVu Sans Mono, Noto Color Emoji
const FONT_MAIN = 'DejaVu Sans';
const FONT_MONO = 'DejaVu Sans Mono';

/**
 * Helper: Draw rounded rectangle path
 */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Helper: Wrap text to fit a max width, returns array of lines
 */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Generates a premium, neatly-structured visual KTP Resident ID card.
 * Uses explicit DejaVu Sans font names for VPS compatibility.
 */
async function generateIdCard({ nickname, ageRange, origin, gameId, hobbies, avatarUrl, tag }) {
  const W = 1100;
  const H = 640;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // ─── 1. OUTER BACKGROUND ───────────────────────────────────
  ctx.fillStyle = '#080c18';
  ctx.fillRect(0, 0, W, H);

  // ─── 2. MAIN CARD BODY ─────────────────────────────────────
  const cardX = 20, cardY = 20, cardW = W - 40, cardH = H - 40, cardR = 24;

  // Card shadow
  ctx.save();
  ctx.shadowColor = 'rgba(99, 102, 241, 0.4)';
  ctx.shadowBlur = 35;
  roundRect(ctx, cardX, cardY, cardW, cardH, cardR);
  ctx.fillStyle = '#111827';
  ctx.fill();
  ctx.restore();

  // Card inner fill (solid dark with slight gradient for depth)
  roundRect(ctx, cardX, cardY, cardW, cardH, cardR);
  ctx.save();
  ctx.clip();
  const innerGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
  innerGrad.addColorStop(0, '#1a1f3a');
  innerGrad.addColorStop(0.5, '#111827');
  innerGrad.addColorStop(1, '#1a1f3a');
  ctx.fillStyle = innerGrad;
  ctx.fillRect(cardX, cardY, cardW, cardH);

  // Subtle diagonal lines for texture
  ctx.globalAlpha = 0.04;
  ctx.strokeStyle = '#818cf8';
  ctx.lineWidth = 1;
  for (let i = -H; i < W + H; i += 35) {
    ctx.beginPath();
    ctx.moveTo(i, cardY);
    ctx.lineTo(i + H, cardY + cardH);
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;
  ctx.restore();

  // Card border (gradient glow)
  roundRect(ctx, cardX, cardY, cardW, cardH, cardR);
  const borderGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY);
  borderGrad.addColorStop(0, '#38bdf8');
  borderGrad.addColorStop(0.5, '#818cf8');
  borderGrad.addColorStop(1, '#c084fc');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 3;
  ctx.stroke();

  // ─── 3. TOP HOLOGRAPHIC STRIP ──────────────────────────────
  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, 10, cardR);
  ctx.clip();
  const stripGrad = ctx.createLinearGradient(cardX, 0, cardX + cardW, 0);
  stripGrad.addColorStop(0, '#38bdf8');
  stripGrad.addColorStop(0.5, '#818cf8');
  stripGrad.addColorStop(1, '#c084fc');
  ctx.fillStyle = stripGrad;
  ctx.fillRect(cardX, cardY, cardW, 10);
  ctx.restore();

  // ─── 4. HEADER ─────────────────────────────────────────────
  const headerY = cardY + 50;

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 30px "${FONT_MAIN}"`;
  ctx.textAlign = 'center';
  ctx.fillText('KARTU IDENTITAS RESMI WARGA', W / 2, headerY);

  ctx.fillStyle = '#60a5fa';
  ctx.font = `bold 20px "${FONT_MAIN}"`;
  ctx.fillText('KOSAN 1A  -  RESIDENT IDENTIFICATION CARD', W / 2, headerY + 34);
  ctx.textAlign = 'left';

  // Header separator
  const sepY = headerY + 52;
  ctx.strokeStyle = 'rgba(96, 165, 250, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(60, sepY);
  ctx.lineTo(W - 60, sepY);
  ctx.stroke();

  // ─── 5. PHOTO SECTION (Left) ──────────────────────────────
  const photoX = cardX + 50;
  const photoY = sepY + 30;
  const photoSize = 200;

  // Photo background panel
  roundRect(ctx, photoX - 6, photoY - 6, photoSize + 12, photoSize + 12, 14);
  ctx.fillStyle = '#1e293b';
  ctx.fill();

  // Photo border (gradient)
  roundRect(ctx, photoX - 3, photoY - 3, photoSize + 6, photoSize + 6, 12);
  const photoBorder = ctx.createLinearGradient(photoX, photoY, photoX + photoSize, photoY + photoSize);
  photoBorder.addColorStop(0, '#38bdf8');
  photoBorder.addColorStop(1, '#818cf8');
  ctx.strokeStyle = photoBorder;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Draw Avatar (rounded rectangle clip)
  try {
    if (avatarUrl) {
      const avatarImg = await loadImage(avatarUrl);
      ctx.save();
      roundRect(ctx, photoX, photoY, photoSize, photoSize, 10);
      ctx.clip();
      ctx.drawImage(avatarImg, photoX, photoY, photoSize, photoSize);
      ctx.restore();
    }
  } catch (e) {
    // Fallback placeholder
    ctx.save();
    roundRect(ctx, photoX, photoY, photoSize, photoSize, 10);
    ctx.clip();
    ctx.fillStyle = '#334155';
    ctx.fillRect(photoX, photoY, photoSize, photoSize);
    ctx.fillStyle = '#94a3b8';
    ctx.font = `bold 60px "${FONT_MAIN}"`;
    ctx.textAlign = 'center';
    ctx.fillText('?', photoX + photoSize / 2, photoY + photoSize / 2 + 20);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  // VERIFIED badge
  const badgeY = photoY + photoSize + 16;
  const badgeW = photoSize + 12;
  const badgeH = 40;
  roundRect(ctx, photoX - 6, badgeY, badgeW, badgeH, 10);
  ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
  ctx.fill();
  roundRect(ctx, photoX - 6, badgeY, badgeW, badgeH, 10);
  ctx.strokeStyle = 'rgba(34, 197, 94, 0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#22c55e';
  ctx.font = `bold 16px "${FONT_MAIN}"`;
  ctx.textAlign = 'center';
  ctx.fillText('[V] VERIFIED RESIDENT', photoX - 6 + badgeW / 2, badgeY + 27);
  ctx.textAlign = 'left';

  // Username tag
  ctx.fillStyle = '#94a3b8';
  ctx.font = `15px "${FONT_MAIN}"`;
  ctx.textAlign = 'center';
  ctx.fillText('@' + (tag || 'member'), photoX - 6 + badgeW / 2, badgeY + badgeH + 24);
  ctx.textAlign = 'left';

  // ─── 6. DATA FIELDS (Right) ───────────────────────────────
  const dataX = photoX + photoSize + 55;
  const dataW = W - dataX - 80;
  let dataY = sepY + 30;
  const fieldH = 76;

  const fields = [
    { icon: '[1]', label: 'NAMA PANGGILAN',    value: nickname || '-' },
    { icon: '[2]', label: 'RENTANG UMUR',      value: ageRange ? ageRange + ' Tahun' : '-' },
    { icon: '[3]', label: 'DAERAH ASAL',       value: origin || '-' },
    { icon: '[4]', label: 'ROBLOX / MLBB ID',  value: gameId || '-' },
    { icon: '[5]', label: 'HOBI / INTEREST',   value: hobbies || '-' },
  ];

  fields.forEach((f, idx) => {
    const rowY = dataY;

    // Alternating row background
    if (idx % 2 === 0) {
      roundRect(ctx, dataX - 16, rowY - 10, dataW + 32, fieldH - 6, 8);
      ctx.fillStyle = 'rgba(30, 41, 59, 0.5)';
      ctx.fill();
    }

    // Label (small, muted blue)
    ctx.fillStyle = '#60a5fa';
    ctx.font = `bold 14px "${FONT_MAIN}"`;
    ctx.fillText(f.icon + '  ' + f.label, dataX, rowY + 10);

    // Value (large, bright white)
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 24px "${FONT_MAIN}"`;
    const valLines = wrapText(ctx, f.value, dataW);
    valLines.forEach((line, li) => {
      ctx.fillText(line, dataX, rowY + 40 + li * 28);
    });

    // Divider line (except last)
    if (idx < fields.length - 1) {
      const divY = rowY + fieldH - 10;
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(dataX, divY);
      ctx.lineTo(dataX + dataW, divY);
      ctx.stroke();
    }

    dataY += fieldH;
  });

  // ─── 7. FOOTER ────────────────────────────────────────────
  const footerY = H - 48;

  // Footer separator
  ctx.strokeStyle = 'rgba(96, 165, 250, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, footerY - 14);
  ctx.lineTo(W - 60, footerY - 14);
  ctx.stroke();

  // NIK (left)
  const nik = 'NIK.1A-' + Date.now().toString().slice(-8);
  ctx.fillStyle = '#64748b';
  ctx.font = `bold 14px "${FONT_MONO}"`;
  ctx.textAlign = 'left';
  ctx.fillText(nik, 60, footerY + 6);

  // Date (center)
  const now = new Date();
  const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const dateStr = 'Diterbitkan: ' + now.getDate() + ' ' + months[now.getMonth()] + ' ' + now.getFullYear();
  ctx.fillStyle = '#64748b';
  ctx.font = `14px "${FONT_MAIN}"`;
  ctx.textAlign = 'center';
  ctx.fillText(dateStr, W / 2, footerY + 6);

  // Issued for (right)
  ctx.fillStyle = '#818cf8';
  ctx.font = `bold 14px "${FONT_MAIN}"`;
  ctx.textAlign = 'right';
  ctx.fillText('ISSUED FOR: @' + (tag || 'MEMBER'), W - 60, footerY + 6);
  ctx.textAlign = 'left';

  return canvas.toBuffer('image/png');
}

module.exports = { generateIdCard };
