/**
 * Utility Functions untuk Ice Breaker
 * 
 * Berisi helper untuk membangun embed, mengumpulkan voting,
 * dan membuat visual progress bar.
 */
const { EmbedBuilder } = require('discord.js');
const config = require('./config');

// ═══════════════════════════════════════════════════
// EMBED BUILDERS
// ═══════════════════════════════════════════════════

/**
 * Membangun embed untuk pertanyaan Truth.
 * @param {string} question - Pertanyaan truth.
 * @param {number} sessionNumber - Nomor sesi.
 * @returns {EmbedBuilder}
 */
function buildTruthEmbed(question, sessionNumber) {
  const mode = config.modes.truth;
  const durationMin = Math.floor(config.VOTE_DURATION_MS / 60000);

  return new EmbedBuilder()
    .setColor(mode.color)
    .setTitle(`${mode.title} — Sesi #${sessionNumber}`)
    .setDescription([
      `${mode.emoji}`,
      '',
      `> **${question}**`,
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      `${mode.reactAccept} — **${mode.labelAccept}**`,
      `${mode.reactSkip} — **${mode.labelSkip}**`,
      '',
      `⏱️ Voting ditutup dalam **${durationMin} menit**!`
    ].join('\n'))
    .setFooter({ text: `🎲 Ice Breaker Otomatis • Sesi #${sessionNumber}` })
    .setTimestamp();
}

/**
 * Membangun embed untuk tantangan Dare.
 * @param {string} challenge - Tantangan dare.
 * @param {number} sessionNumber - Nomor sesi.
 * @returns {EmbedBuilder}
 */
function buildDareEmbed(challenge, sessionNumber) {
  const mode = config.modes.dare;
  const durationMin = Math.floor(config.VOTE_DURATION_MS / 60000);

  return new EmbedBuilder()
    .setColor(mode.color)
    .setTitle(`${mode.title} — Sesi #${sessionNumber}`)
    .setDescription([
      `${mode.emoji}`,
      '',
      `> **${challenge}**`,
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      `${mode.reactAccept} — **${mode.labelAccept}**`,
      `${mode.reactSkip} — **${mode.labelSkip}**`,
      '',
      `⏱️ Voting ditutup dalam **${durationMin} menit**!`
    ].join('\n'))
    .setFooter({ text: `🎲 Ice Breaker Otomatis • Sesi #${sessionNumber}` })
    .setTimestamp();
}

/**
 * Membangun embed untuk Would You Rather.
 * @param {string} optionA - Pilihan A.
 * @param {string} optionB - Pilihan B.
 * @param {number} sessionNumber - Nomor sesi.
 * @returns {EmbedBuilder}
 */
function buildWyrEmbed(optionA, optionB, sessionNumber) {
  const mode = config.modes.wyr;
  const durationMin = Math.floor(config.VOTE_DURATION_MS / 60000);

  return new EmbedBuilder()
    .setColor(mode.color)
    .setTitle(`${mode.title} — Sesi #${sessionNumber}`)
    .setDescription([
      `${mode.emoji}`,
      '',
      `🅰️ **${optionA}**`,
      '',
      '**— ATAU —**',
      '',
      `🅱️ **${optionB}**`,
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      `React ${mode.reactA} atau ${mode.reactB} untuk memilih!`,
      '',
      `⏱️ Voting ditutup dalam **${durationMin} menit**!`
    ].join('\n'))
    .setFooter({ text: `🎲 Ice Breaker Otomatis • Sesi #${sessionNumber}` })
    .setTimestamp();
}

// ═══════════════════════════════════════════════════
// VISUAL PROGRESS BAR
// ═══════════════════════════════════════════════════

/**
 * Membuat visual progress bar.
 * @param {number} percentage - Persentase (0–100).
 * @param {number} length - Panjang bar (jumlah karakter).
 * @returns {string}
 */
function createProgressBar(percentage, length = 20) {
  const filled = Math.round((percentage / 100) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

// ═══════════════════════════════════════════════════
// RESULT EMBED BUILDERS
// ═══════════════════════════════════════════════════

/**
 * Membangun embed hasil voting Truth or Dare.
 * @param {string} mode - 'truth' atau 'dare'.
 * @param {string} question - Pertanyaan/tantangan.
 * @param {number} sessionNumber - Nomor sesi.
 * @param {Array} accepted - User yang menerima.
 * @param {Array} skipped - User yang skip.
 * @returns {EmbedBuilder}
 */
function buildTodResultEmbed(mode, question, sessionNumber, accepted, skipped) {
  const modeConfig = config.modes[mode];
  const totalVoters = accepted.length + skipped.length;

  const acceptedList = accepted.length > 0
    ? accepted.map(u => `<@${u.id}>`).join(', ')
    : '_Tidak ada yang berani..._';

  const skippedList = skipped.length > 0
    ? skipped.map(u => `<@${u.id}>`).join(', ')
    : '_Semua pada berani! 💪_';

  const modeLabel = mode === 'truth' ? 'TRUTH' : 'DARE';

  return new EmbedBuilder()
    .setColor(modeConfig.color)
    .setTitle(`📊 HASIL ${modeLabel} — Sesi #${sessionNumber}`)
    .setDescription([
      `> **${question}**`,
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      `${modeConfig.reactAccept} **${modeConfig.labelAccept}** (${accepted.length} orang):`,
      acceptedList,
      '',
      `${modeConfig.reactSkip} **${modeConfig.labelSkip}** (${skipped.length} orang):`,
      skippedList,
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      `👥 **Total Partisipan:** ${totalVoters} orang`,
      '',
      accepted.length > 0 ? '🏆 Salut untuk yang berani! 💪' : '😅 Belum ada yang berani kali ini...'
    ].join('\n'))
    .setFooter({ text: `🎲 Ice Breaker • Sesi #${sessionNumber}` })
    .setTimestamp();
}

/**
 * Membangun embed hasil voting Would You Rather.
 * @param {string} optionA - Pilihan A.
 * @param {string} optionB - Pilihan B.
 * @param {number} sessionNumber - Nomor sesi.
 * @param {Array} votersA - User yang memilih A.
 * @param {Array} votersB - User yang memilih B.
 * @returns {EmbedBuilder}
 */
function buildWyrResultEmbed(optionA, optionB, sessionNumber, votersA, votersB) {
  const modeConfig = config.modes.wyr;
  const totalVoters = votersA.length + votersB.length;

  let percentA = 0;
  let percentB = 0;

  if (totalVoters > 0) {
    percentA = Math.round((votersA.length / totalVoters) * 100);
    percentB = 100 - percentA;
  }

  const barA = createProgressBar(percentA);
  const barB = createProgressBar(percentB);

  const winnerLine = totalVoters === 0
    ? '😅 Belum ada yang vote kali ini...'
    : percentA > percentB
      ? '🏆 **Pilihan A menang!**'
      : percentB > percentA
        ? '🏆 **Pilihan B menang!**'
        : '🤝 **Seri! Kedua pilihan sama populer!**';

  return new EmbedBuilder()
    .setColor(modeConfig.color)
    .setTitle(`📊 HASIL WOULD YOU RATHER — Sesi #${sessionNumber}`)
    .setDescription([
      `🅰️ **${optionA}**`,
      `${barA} **${percentA}%** (${votersA.length} votes)`,
      '',
      `🅱️ **${optionB}**`,
      `${barB} **${percentB}%** (${votersB.length} votes)`,
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      `👥 **Total Partisipan:** ${totalVoters} orang`,
      '',
      winnerLine
    ].join('\n'))
    .setFooter({ text: `🎲 Ice Breaker • Sesi #${sessionNumber}` })
    .setTimestamp();
}

// ═══════════════════════════════════════════════════
// VOTE COLLECTOR
// ═══════════════════════════════════════════════════

/**
 * Mengumpulkan voting via reaksi emoji.
 * @param {Message} message - Pesan yang sudah dikirim (dengan embed).
 * @param {string} mode - 'truth', 'dare', atau 'wyr'.
 * @param {number} duration - Durasi collecting dalam ms.
 * @returns {Promise<Object>} - Hasil voting.
 */
async function collectVotes(message, mode, duration) {
  const modeConfig = config.modes[mode];

  if (mode === 'truth' || mode === 'dare') {
    // React dengan emoji pilihan
    await message.react(modeConfig.reactAccept);
    await message.react(modeConfig.reactSkip);

    // Tunggu durasi voting
    await new Promise(resolve => setTimeout(resolve, duration));

    // Ambil data reaksi terbaru
    const fetchedMessage = await message.fetch();
    const acceptReaction = fetchedMessage.reactions.cache.get(modeConfig.reactAccept);
    const skipReaction = fetchedMessage.reactions.cache.get(modeConfig.reactSkip);

    // Ambil daftar user (filter bot)
    const accepted = acceptReaction
      ? (await acceptReaction.users.fetch()).filter(u => !u.bot).map(u => u)
      : [];
    const skipped = skipReaction
      ? (await skipReaction.users.fetch()).filter(u => !u.bot).map(u => u)
      : [];

    return { accepted: [...accepted.values()], skipped: [...skipped.values()] };
  }

  if (mode === 'wyr') {
    // React dengan emoji A dan B
    await message.react(modeConfig.reactA);
    await message.react(modeConfig.reactB);

    // Tunggu durasi voting
    await new Promise(resolve => setTimeout(resolve, duration));

    // Ambil data reaksi terbaru
    const fetchedMessage = await message.fetch();
    const reactionA = fetchedMessage.reactions.cache.get(modeConfig.reactA);
    const reactionB = fetchedMessage.reactions.cache.get(modeConfig.reactB);

    // Ambil daftar user (filter bot)
    const votersA = reactionA
      ? (await reactionA.users.fetch()).filter(u => !u.bot).map(u => u)
      : [];
    const votersB = reactionB
      ? (await reactionB.users.fetch()).filter(u => !u.bot).map(u => u)
      : [];

    return { votersA: [...votersA.values()], votersB: [...votersB.values()] };
  }

  return {};
}

module.exports = {
  buildTruthEmbed,
  buildDareEmbed,
  buildWyrEmbed,
  buildTodResultEmbed,
  buildWyrResultEmbed,
  createProgressBar,
  collectVotes
};
