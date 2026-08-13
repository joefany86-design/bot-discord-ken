const { createCanvas, loadImage } = require('@napi-rs/canvas');

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
 * Helper: Draw circular clipped image
 */
function drawCircularImage(ctx, img, x, y, size) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, x, y, size, size);
  ctx.restore();
}

/**
 * Helper: Wrap text to fit a max width
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
 */
async function generateIdCard({ nickname, ageRange, origin, gameId, hobbies, avatarUrl, tag }) {
  const W = 1100;
  const H = 620;
  const PAD = 40;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // ─── 1. OUTER CARD BACKGROUND ───────────────────────────────
  // Subtle dark gradient base
  const outerGrad = ctx.createLinearGradient(0, 0, W, H);
  outerGrad.addColorStop(0, '#070b14');
  outerGrad.addColorStop(1, '#0c1222');
  ctx.fillStyle = outerGrad;
  ctx.fillRect(0, 0, W, H);

  // ─── 2. MAIN CARD BODY (Rounded, Glassmorphism) ──────────────
  const cardX = 20, cardY = 20, cardW = W - 40, cardH = H - 40;
  const cardR = 24;

  // Card drop shadow
  ctx.save();
  ctx.shadowColor = 'rgba(99, 102, 241, 0.35)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 6;
  roundRect(ctx, cardX, cardY, cardW, cardH, cardR);
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.restore();

  // Card inner gradient overlay
  roundRect(ctx, cardX, cardY, cardW, cardH, cardR);
  ctx.save();
  ctx.clip();
  const innerGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  innerGrad.addColorStop(0, 'rgba(30, 27, 75, 0.9)');
  innerGrad.addColorStop(0.5, 'rgba(15, 23, 42, 0.95)');
  innerGrad.addColorStop(1, 'rgba(30, 27, 75, 0.85)');
  ctx.fillStyle = innerGrad;
  ctx.fillRect(cardX, cardY, cardW, cardH);

  // Subtle diagonal grid texture inside card
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.06)';
  ctx.lineWidth = 1;
  for (let i = -H; i < W + H; i += 30) {
    ctx.beginPath();
    ctx.moveTo(i, cardY);
    ctx.lineTo(i + H, cardY + cardH);
    ctx.stroke();
  }
  ctx.restore();

  // Card border glow
  roundRect(ctx, cardX, cardY, cardW, cardH, cardR);
  const borderGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY);
  borderGrad.addColorStop(0, 'rgba(56, 189, 248, 0.6)');
  borderGrad.addColorStop(0.5, 'rgba(129, 140, 248, 0.6)');
  borderGrad.addColorStop(1, 'rgba(192, 132, 252, 0.6)');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // ─── 3. TOP ACCENT HOLOGRAPHIC STRIP ─────────────────────────
  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, 8, cardR);
  ctx.clip();
  const stripGrad = ctx.createLinearGradient(cardX, 0, cardX + cardW, 0);
  stripGrad.addColorStop(0, '#38bdf8');
  stripGrad.addColorStop(0.35, '#818cf8');
  stripGrad.addColorStop(0.65, '#c084fc');
  stripGrad.addColorStop(1, '#38bdf8');
  ctx.fillStyle = stripGrad;
  ctx.fillRect(cardX, cardY, cardW, 8);
  ctx.restore();

  // ─── 4. HEADER SECTION ───────────────────────────────────────
  const headerY = cardY + 38;

  // National-style emblem text
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('KARTU IDENTITAS RESMI WARGA', W / 2, headerY);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('KOSAN 1A  •  RESIDENT IDENTIFICATION CARD', W / 2, headerY + 30);
  ctx.textAlign = 'left';

  // Header separator line
  const sepY = headerY + 46;
  const lineGrad = ctx.createLinearGradient(PAD + 40, 0, W - PAD - 40, 0);
  lineGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
  lineGrad.addColorStop(0.2, 'rgba(56, 189, 248, 0.5)');
  lineGrad.addColorStop(0.5, 'rgba(129, 140, 248, 0.6)');
  lineGrad.addColorStop(0.8, 'rgba(192, 132, 252, 0.5)');
  lineGrad.addColorStop(1, 'rgba(192, 132, 252, 0)');
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(PAD + 40, sepY);
  ctx.lineTo(W - PAD - 40, sepY);
  ctx.stroke();

  // ─── 5. PHOTO SECTION (Left Column) ─────────────────────────
  const photoX = cardX + 50;
  const photoY = sepY + 25;
  const photoSize = 190;

  // Photo background panel
  roundRect(ctx, photoX - 8, photoY - 8, photoSize + 16, photoSize + 16, 16);
  ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
  ctx.fill();

  // Photo border
  roundRect(ctx, photoX - 4, photoY - 4, photoSize + 8, photoSize + 8, 14);
  const photoBorderGrad = ctx.createLinearGradient(photoX, photoY, photoX + photoSize, photoY + photoSize);
  photoBorderGrad.addColorStop(0, '#38bdf8');
  photoBorderGrad.addColorStop(1, '#818cf8');
  ctx.strokeStyle = photoBorderGrad;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Draw Avatar (rounded corners)
  try {
    if (avatarUrl) {
      const avatarImg = await loadImage(avatarUrl);
      ctx.save();
      roundRect(ctx, photoX, photoY, photoSize, photoSize, 12);
      ctx.clip();
      ctx.drawImage(avatarImg, photoX, photoY, photoSize, photoSize);
      ctx.restore();
    }
  } catch (e) {
    // Fallback: Grey placeholder
    ctx.save();
    roundRect(ctx, photoX, photoY, photoSize, photoSize, 12);
    ctx.clip();
    ctx.fillStyle = '#334155';
    ctx.fillRect(photoX, photoY, photoSize, photoSize);
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('📷', photoX + photoSize / 2, photoY + photoSize / 2 + 16);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  // ─── VERIFIED BADGE under photo ──────────────────────────────
  const badgeY = photoY + photoSize + 18;
  const badgeW = photoSize + 16;
  const badgeH = 38;
  roundRect(ctx, photoX - 8, badgeY, badgeW, badgeH, 10);
  ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.fill();
  roundRect(ctx, photoX - 8, badgeY, badgeW, badgeH, 10);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('✅ VERIFIED RESIDENT', photoX - 8 + badgeW / 2, badgeY + 25);
  ctx.textAlign = 'left';

  // ─── Username under badge ────────────────────────────────────
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`@${tag || 'member'}`, photoX - 8 + badgeW / 2, badgeY + badgeH + 22);
  ctx.textAlign = 'left';

  // ─── 6. DATA FIELDS (Right Column) ──────────────────────────
  const dataX = photoX + photoSize + 60;
  const dataW = W - dataX - PAD - 40;
  let dataY = sepY + 30;
  const fieldGap = 72;

  const fields = [
    { icon: '👤', label: 'NAMA PANGGILAN',    value: nickname || '-' },
    { icon: '🎂', label: 'RENTANG UMUR',      value: ageRange ? `${ageRange} Tahun` : '-' },
    { icon: '📍', label: 'DAERAH ASAL',       value: origin || '-' },
    { icon: '🎮', label: 'ROBLOX / MLBB ID',  value: gameId || '-' },
    { icon: '✨', label: 'HOBI / INTEREST',   value: hobbies || '-' },
  ];

  fields.forEach((f, idx) => {
    // Field row background (alternating subtle tint)
    if (idx % 2 === 0) {
      roundRect(ctx, dataX - 14, dataY - 12, dataW + 28, fieldGap - 8, 8);
      ctx.fillStyle = 'rgba(30, 41, 59, 0.35)';
      ctx.fill();
    }

    // Label
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`${f.icon}  ${f.label}`, dataX, dataY + 6);

    // Value
    ctx.fillStyle = '#f1f5f9';
    ctx.font = 'bold 21px sans-serif';

    // Wrap long text (especially hobbies)
    const lines = wrapText(ctx, f.value, dataW);
    lines.forEach((line, li) => {
      ctx.fillText(line, dataX, dataY + 32 + li * 24);
    });

    // Bottom divider (except last)
    if (idx < fields.length - 1) {
      const divY = dataY + fieldGap - 14;
      const divGrad = ctx.createLinearGradient(dataX, 0, dataX + dataW, 0);
      divGrad.addColorStop(0, 'rgba(129, 140, 248, 0.25)');
      divGrad.addColorStop(1, 'rgba(129, 140, 248, 0)');
      ctx.strokeStyle = divGrad;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(dataX, divY);
      ctx.lineTo(dataX + dataW, divY);
      ctx.stroke();
    }

    dataY += fieldGap;
  });

  // ─── 7. FOOTER ──────────────────────────────────────────────
  const footerY = H - 52;

  // Footer separator
  const footLineGrad = ctx.createLinearGradient(PAD + 40, 0, W - PAD - 40, 0);
  footLineGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
  footLineGrad.addColorStop(0.3, 'rgba(56, 189, 248, 0.3)');
  footLineGrad.addColorStop(0.7, 'rgba(129, 140, 248, 0.3)');
  footLineGrad.addColorStop(1, 'rgba(129, 140, 248, 0)');
  ctx.strokeStyle = footLineGrad;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD + 40, footerY - 10);
  ctx.lineTo(W - PAD - 40, footerY - 10);
  ctx.stroke();

  // NIK number (left)
  const nik = `NIK.1A-${Date.now().toString().slice(-8)}`;
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(nik, cardX + 50, footerY + 8);

  // Issued date (center)
  const now = new Date();
  const dateStr = `Diterbitkan: ${now.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`;
  ctx.fillStyle = '#475569';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(dateStr, W / 2, footerY + 8);
  ctx.textAlign = 'left';

  // Issued for (right)
  ctx.fillStyle = '#818cf8';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`ISSUED FOR: @${tag || 'MEMBER'}`, W - cardX - 50, footerY + 8);
  ctx.textAlign = 'left';

  return canvas.toBuffer('image/png');
}

module.exports = { generateIdCard };
