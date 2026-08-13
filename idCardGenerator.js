const { createCanvas, loadImage } = require('@napi-rs/canvas');

/**
 * Generates an ultra-premium visual ID card (KTP Resident Kosan 1A).
 * @param {Object} data - Form data
 * @param {string} data.nickname - Nama Panggilan
 * @param {string} data.ageRange - Rentang Umur
 * @param {string} data.origin - Daerah Asal
 * @param {string} data.gameId - ID Roblox / MLBB
 * @param {string} data.hobbies - Hobi / Ketertarikan
 * @param {string} data.avatarUrl - URL Avatar Member Discord
 * @param {string} data.tag - Username Discord / Tag
 * @returns {Promise<Buffer>} PNG Buffer of the ID card
 */
async function generateIdCard({ nickname, ageRange, origin, gameId, hobbies, avatarUrl, tag }) {
  const width = 1000;
  const height = 580;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Background Gradient (Dark Cyberpunk / Sleek Midnight KTP Theme)
  const bgGradient = ctx.createLinearGradient(0, 0, width, height);
  bgGradient.addColorStop(0, '#0f172a');
  bgGradient.addColorStop(0.5, '#1e1b4b');
  bgGradient.addColorStop(1, '#090d16');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  // 2. Decorative Cyber Circuits / Glow Accents
  ctx.save();
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.15)';
  ctx.lineWidth = 2;
  for (let i = 0; i < width; i += 40) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 150, height);
    ctx.stroke();
  }
  ctx.restore();

  // Top Accent Bar (Gold - Cyan Hologram Strip)
  const topStrip = ctx.createLinearGradient(0, 0, width, 0);
  topStrip.addColorStop(0, '#38bdf8');
  topStrip.addColorStop(0.5, '#818cf8');
  topStrip.addColorStop(1, '#c084fc');
  ctx.fillStyle = topStrip;
  ctx.fillRect(0, 0, width, 10);

  // Card Outer Border Glow
  ctx.strokeStyle = 'rgba(129, 140, 248, 0.4)';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  // 3. Card Header Badge
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('KARTU IDENTITAS RESMI WARGA', 320, 60);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('KOSAN 1A RESIDENT IDENTIFICATION CARD', 320, 95);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(320, 110);
  ctx.lineTo(940, 110);
  ctx.stroke();

  // 4. Avatar Frame (Left Side Photo Box)
  const avatarX = 50;
  const avatarY = 60;
  const avatarSize = 220;

  // Photo Box Background & Border
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);

  try {
    if (avatarUrl) {
      const avatarImg = await loadImage(avatarUrl);
      ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
    }
  } catch (e) {
    console.error('Failed to load avatar:', e.message);
  }

  // Avatar Border Frame
  ctx.strokeStyle = '#818cf8';
  ctx.lineWidth = 4;
  ctx.strokeRect(avatarX, avatarY, avatarSize, avatarSize);

  // Hologram Badge under avatar
  ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
  ctx.fillRect(avatarX, avatarY + avatarSize + 15, avatarSize, 45);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1;
  ctx.strokeRect(avatarX, avatarY + avatarSize + 15, avatarSize, 45);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VERIFIED RESIDENT', avatarX + avatarSize / 2, avatarY + avatarSize + 43);
  ctx.textAlign = 'left';

  // 5. Data Fields Render
  const startX = 320;
  let currentY = 155;
  const lineGap = 70;

  const fields = [
    { label: 'NAMA PANGGILAN', val: nickname || '-' },
    { label: 'RENTANG UMUR', val: ageRange ? `${ageRange} Tahun` : '-' },
    { label: 'DAERAH ASAL', val: origin || '-' },
    { label: 'ROBLOX / MLBB ID', val: gameId || '-' },
    { label: 'HOBI / INTEREST', val: hobbies || '-' }
  ];

  fields.forEach(f => {
    // Label (Cyan Small Bold)
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(f.label.toUpperCase(), startX, currentY);

    // Value (Bright White/Gold Bold)
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(f.val, startX, currentY + 28);

    // Subtle underline divider
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(startX, currentY + 38);
    ctx.lineTo(940, currentY + 38);
    ctx.stroke();

    currentY += lineGap;
  });

  // 6. Card Footer Info (Watermark / NIK Stamp)
  const nik = `NIK.1A-${Date.now().toString().slice(-8)}`;
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(nik, startX, 535);

  ctx.fillStyle = '#818cf8';
  ctx.font = 'italic bold 14px sans-serif';
  ctx.fillText(`ISSUED FOR: @${tag || 'MEMBER'}`, 680, 535);

  return canvas.toBuffer('image/png');
}

module.exports = { generateIdCard };
