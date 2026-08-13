const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');

// Register fonts
const FONT_MAIN = 'DejaVu Sans';
const FONT_MONO = 'DejaVu Sans Mono';
const FONT_SIGNATURE = 'Great Vibes';

// Register Great Vibes font from local fonts directory
try {
  GlobalFonts.registerFromPath(
    path.join(__dirname, 'fonts', 'GreatVibes-Regular.ttf'),
    'Great Vibes'
  );
} catch (e) {
  console.warn('⚠️ Great Vibes font not found, signature will use fallback italic.');
}

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
 * Helper: Draw a decorative signature flourish underline using bezier curves.
 * The flourish adapts to the width of the signature text.
 */
function drawSignatureFlourish(ctx, x, y, textWidth) {
  const endX = x + textWidth;
  ctx.save();
  ctx.strokeStyle = 'rgba(192, 132, 252, 0.6)';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  // Main underline swoop
  ctx.moveTo(x - 10, y);
  ctx.quadraticCurveTo(x + textWidth * 0.3, y + 12, x + textWidth * 0.6, y - 2);
  ctx.quadraticCurveTo(x + textWidth * 0.85, y - 14, endX + 30, y + 5);
  ctx.stroke();
  // Small decorative loop at end
  ctx.beginPath();
  ctx.arc(endX + 35, y + 2, 6, Math.PI * 0.8, Math.PI * 2.3);
  ctx.stroke();
  ctx.restore();
}

/**
 * Generates a premium, neatly-structured visual KTP Resident ID card
 * with AI-generated signature based on the member's name.
 */
async function generateIdCard({ nickname, ageRange, origin, gameId, hobbies, avatarUrl, tag }) {
  const W = 1100;
  const H = 700; // Taller to accommodate signature area
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

  // Card inner fill
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

  // ─── 7. SIGNATURE AREA ────────────────────────────────────
  const sigAreaY = dataY + 10;
  const sigAreaX = photoX - 6;
  const sigAreaW = W - sigAreaX - 60;
  const sigAreaH = 80;

  // Signature box background
  roundRect(ctx, sigAreaX, sigAreaY, sigAreaW, sigAreaH, 12);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
  ctx.fill();

  // Signature box border (subtle dashed style via dotted line segments)
  roundRect(ctx, sigAreaX, sigAreaY, sigAreaW, sigAreaH, 12);
  ctx.strokeStyle = 'rgba(129, 140, 248, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  // "Tanda Tangan / Signature" label (left side)
  ctx.fillStyle = '#475569';
  ctx.font = `bold 12px "${FONT_MAIN}"`;
  ctx.fillText('TANDA TANGAN / SIGNATURE', sigAreaX + 18, sigAreaY + 18);

  // Generate and draw the AI-style signature using the nickname
  const signatureName = nickname || tag || 'Warga';

  // Capitalize first letter of each word for signature style
  const signatureText = signatureName
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  // Draw signature text with Great Vibes font (calligraphy)
  ctx.save();
  // Slight rotation for natural signature feel
  const sigTextX = sigAreaX + 40;
  const sigTextY = sigAreaY + 58;
  ctx.translate(sigTextX, sigTextY);
  ctx.rotate(-0.03); // Very slight tilt

  // Ink color gradient (dark blue to purple like real signature pen)
  const sigGrad = ctx.createLinearGradient(0, -20, 300, 10);
  sigGrad.addColorStop(0, '#a78bfa');
  sigGrad.addColorStop(0.5, '#c084fc');
  sigGrad.addColorStop(1, '#818cf8');
  ctx.fillStyle = sigGrad;
  ctx.font = `42px "${FONT_SIGNATURE}"`;
  ctx.fillText(signatureText, 0, 0);

  // Measure signature width for flourish
  const sigWidth = ctx.measureText(signatureText).width;

  // Draw decorative flourish underline
  drawSignatureFlourish(ctx, 0, 12, sigWidth);

  ctx.restore();

  // "Verified by AI" small watermark on right side of signature box
  ctx.fillStyle = '#475569';
  ctx.font = `11px "${FONT_MAIN}"`;
  ctx.textAlign = 'right';
  ctx.fillText('Auto-generated by AI Concierge', sigAreaX + sigAreaW - 18, sigAreaY + sigAreaH - 12);
  ctx.textAlign = 'left';

  // ─── 8. FOOTER ────────────────────────────────────────────
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
