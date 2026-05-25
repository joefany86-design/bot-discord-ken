/**
 * Ice Breaker Module — Entry Point
 * 
 * Modul utama untuk fitur Truth or Dare & Would You Rather otomatis.
 * Bertindak sebagai host acara interaktif yang muncul di jam-jam santai.
 */
const cron = require('node-cron');
const config = require('./config');
const questions = require('./questions');
const {
  buildTruthEmbed,
  buildDareEmbed,
  buildWyrEmbed,
  buildTodResultEmbed,
  buildWyrResultEmbed,
  collectVotes
} = require('./utils');

// ═══════════════════════════════════════════════════
// STATE TRACKING
// ═══════════════════════════════════════════════════

// Nomor sesi per guild
const sessionNumbers = new Map();

// Cooldown per guild untuk sesi otomatis (timestamp terakhir)
const autoCooldowns = new Map();

// Cooldown per user untuk perintah manual (Map<guildId, Map<userId, timestamp>>)
const manualCooldowns = new Map();

// Shuffle queue per guild agar pertanyaan tidak berulang sebelum semua habis
// Format: Map<guildId, { truths: [...], dares: [...], wyr: [...] }>
const questionQueues = new Map();

// Track sesi aktif per guild agar tidak overlap
const activeSessions = new Map();

// ═══════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════

/**
 * Mengacak (shuffle) array menggunakan Fisher-Yates algorithm.
 * @param {Array} array
 * @returns {Array} - Array yang sudah diacak.
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Mengambil pertanyaan berikutnya dari queue (auto-refill jika habis).
 * @param {string} guildId
 * @param {string} type - 'truths', 'dares', atau 'wyr'
 * @returns {*} - Pertanyaan/tantangan/dilema berikutnya.
 */
function getNextQuestion(guildId, type) {
  if (!questionQueues.has(guildId)) {
    questionQueues.set(guildId, {
      truths: [],
      dares: [],
      wyr: []
    });
  }

  const queues = questionQueues.get(guildId);

  // Refill queue jika habis
  if (queues[type].length === 0) {
    const sourceMap = {
      truths: questions.truths,
      dares: questions.dares,
      wyr: questions.wouldYouRather
    };
    queues[type] = shuffleArray(sourceMap[type]);
  }

  return queues[type].shift();
}

/**
 * Mendapatkan nomor sesi berikutnya untuk guild.
 * @param {string} guildId
 * @returns {number}
 */
function getNextSessionNumber(guildId) {
  const current = sessionNumbers.get(guildId) || 0;
  const next = current + 1;
  sessionNumbers.set(guildId, next);
  return next;
}

/**
 * Memilih mode permainan secara acak.
 * @returns {string} - 'truth', 'dare', atau 'wyr'
 */
function pickRandomMode() {
  const modes = ['truth', 'dare', 'wyr'];
  return modes[Math.floor(Math.random() * modes.length)];
}

/**
 * Mengecek apakah guild masih dalam cooldown otomatis.
 * @param {string} guildId
 * @returns {boolean}
 */
function isAutoCooldown(guildId) {
  const lastRun = autoCooldowns.get(guildId);
  if (!lastRun) return false;
  return (Date.now() - lastRun) < config.AUTO_COOLDOWN_MS;
}

/**
 * Mengecek apakah user masih dalam cooldown manual.
 * @param {string} guildId
 * @param {string} userId
 * @returns {number|false} - Sisa waktu cooldown dalam detik, atau false.
 */
function getManualCooldownRemaining(guildId, userId) {
  const guildCooldowns = manualCooldowns.get(guildId);
  if (!guildCooldowns) return false;

  const lastUsed = guildCooldowns.get(userId);
  if (!lastUsed) return false;

  const elapsed = Date.now() - lastUsed;
  if (elapsed >= config.MANUAL_COOLDOWN_MS) return false;

  return Math.ceil((config.MANUAL_COOLDOWN_MS - elapsed) / 1000);
}

/**
 * Menetapkan cooldown manual untuk user.
 * @param {string} guildId
 * @param {string} userId
 */
function setManualCooldown(guildId, userId) {
  if (!manualCooldowns.has(guildId)) {
    manualCooldowns.set(guildId, new Map());
  }
  manualCooldowns.get(guildId).set(userId, Date.now());
}

// ═══════════════════════════════════════════════════
// CORE: MENJALANKAN SESI ICE BREAKER
// ═══════════════════════════════════════════════════

/**
 * Menjalankan satu sesi ice breaker di channel tertentu.
 * @param {TextChannel} channel - Channel Discord tujuan.
 * @param {string} guildId - ID server.
 * @param {string} [forceMode] - Mode yang dipaksa ('truth', 'dare', 'wyr'), atau null untuk acak.
 * @returns {Promise<boolean>} - true jika berhasil dijalankan.
 */
async function runIceBreakerSession(channel, guildId, forceMode = null) {
  // Cek apakah ada sesi aktif di guild ini
  if (activeSessions.get(guildId)) {
    console.log(`[IceBreaker] Sesi masih aktif di guild ${guildId}, melewati...`);
    return false;
  }

  activeSessions.set(guildId, true);

  try {
    const mode = forceMode || pickRandomMode();
    const sessionNumber = getNextSessionNumber(guildId);

    let sentMessage;
    let questionText;

    if (mode === 'truth') {
      questionText = getNextQuestion(guildId, 'truths');
      const embed = buildTruthEmbed(questionText, sessionNumber);
      sentMessage = await channel.send({ embeds: [embed] });

    } else if (mode === 'dare') {
      questionText = getNextQuestion(guildId, 'dares');
      const embed = buildDareEmbed(questionText, sessionNumber);
      sentMessage = await channel.send({ embeds: [embed] });

    } else if (mode === 'wyr') {
      const wyrData = getNextQuestion(guildId, 'wyr');
      questionText = wyrData;
      const embed = buildWyrEmbed(wyrData.optionA, wyrData.optionB, sessionNumber);
      sentMessage = await channel.send({ embeds: [embed] });
    }

    if (!sentMessage) {
      activeSessions.delete(guildId);
      return false;
    }

    console.log(`[IceBreaker] Sesi #${sessionNumber} (${mode}) dimulai di guild ${guildId}`);

    // Kumpulkan voting
    const results = await collectVotes(sentMessage, mode, config.VOTE_DURATION_MS);

    // Kirim hasil
    if (mode === 'truth' || mode === 'dare') {
      const resultEmbed = buildTodResultEmbed(
        mode,
        questionText,
        sessionNumber,
        results.accepted || [],
        results.skipped || []
      );
      await channel.send({ embeds: [resultEmbed] });

    } else if (mode === 'wyr') {
      const resultEmbed = buildWyrResultEmbed(
        questionText.optionA,
        questionText.optionB,
        sessionNumber,
        results.votersA || [],
        results.votersB || []
      );
      await channel.send({ embeds: [resultEmbed] });
    }

    console.log(`[IceBreaker] Sesi #${sessionNumber} (${mode}) selesai di guild ${guildId}`);

    // Set cooldown otomatis
    autoCooldowns.set(guildId, Date.now());

    return true;
  } catch (error) {
    console.error(`[IceBreaker] Error di guild ${guildId}:`, error.message);
    return false;
  } finally {
    activeSessions.delete(guildId);
  }
}

// ═══════════════════════════════════════════════════
// SCHEDULER: INISIALISASI CRON JOBS
// ═══════════════════════════════════════════════════

/**
 * Menginisialisasi semua jadwal ice breaker otomatis.
 * @param {Client} client - Instance Discord Client.
 */
function initIceBreakers(client) {
  console.log('══════════════════════════════════════');
  console.log('  [IceBreaker] Menginisialisasi Ice Breaker otomatis...');
  const targets = config.targets || [];
  console.log(`  [IceBreaker] Terdaftar ${targets.length} target server/channel`);

  config.schedules.forEach(schedule => {
    cron.schedule(schedule.cron, async () => {
      console.log(`[IceBreaker] Cron terpicu: ${schedule.label} (${schedule.cron})`);

      for (const target of targets) {
        if (!target.guildId || !target.channelId) {
          console.error('[IceBreaker] Gagal: guildId atau channelId kosong.');
          continue;
        }

        // Cek cooldown otomatis
        if (isAutoCooldown(target.guildId)) {
          console.log(`[IceBreaker] Guild ${target.guildId} masih dalam cooldown, melewati...`);
          continue;
        }

        try {
          const guild = client.guilds.cache.get(target.guildId)
            || await client.guilds.fetch(target.guildId).catch(() => null);
          if (!guild) {
            console.error(`[IceBreaker] Gagal: Bot tidak berada di server ${target.guildId}`);
            continue;
          }

          const channel = guild.channels.cache.get(target.channelId)
            || await guild.channels.fetch(target.channelId).catch(() => null);
          if (!channel || !channel.isTextBased()) {
            console.error(`[IceBreaker] Gagal: Channel ${target.channelId} tidak ditemukan/bukan text channel.`);
            continue;
          }

          await runIceBreakerSession(channel, target.guildId);
        } catch (error) {
          console.error(`[IceBreaker] Error saat cron di guild ${target.guildId}:`, error.message);
        }
      }
    }, {
      scheduled: true,
      timezone: config.TIMEZONE
    });

    console.log(`  ✅ Jadwal "${schedule.label}" terdaftar (${schedule.cron} WIB)`);
  });

  // Log database stats
  console.log(`  [IceBreaker] Database: ${questions.truths.length} truths, ${questions.dares.length} dares, ${questions.wouldYouRather.length} WYR`);
  console.log('  [IceBreaker] Status: AKTIF');
  console.log('══════════════════════════════════════');
}

// ═══════════════════════════════════════════════════
// HANDLER: PERINTAH MANUAL
// ═══════════════════════════════════════════════════

/**
 * Menangani perintah manual ice breaker dari user.
 * @param {Message} message - Pesan Discord.
 * @param {Client} client - Instance Discord Client.
 * @returns {Promise<boolean>} - true jika perintah berhasil diproses.
 */
async function handleIceBreakerCommand(message, client) {
  const content = message.content.slice(1).trim().toLowerCase();
  const { guildId, channel, author } = message;

  // Map perintah ke mode
  const commandMap = {
    'truth': 'truth',
    'dare': 'dare',
    'wyr': 'wyr',
    'wouldyourather': 'wyr',
    'tod': null,          // Random truth or dare
    'icebreaker': null,   // Random semua mode
    'ice': null           // Alias singkat
  };

  if (!(content in commandMap)) return false;

  // Cek cooldown manual
  const cooldownRemaining = getManualCooldownRemaining(guildId, author.id);
  if (cooldownRemaining) {
    const { EmbedBuilder } = require('discord.js');
    const embed = new EmbedBuilder()
      .setColor(0xFF3366)
      .setDescription(`⏳ **Cooldown!** Kamu bisa menggunakan perintah ice breaker lagi dalam **${cooldownRemaining} detik**.`);
    await message.reply({ embeds: [embed] });
    return true;
  }

  // Tentukan mode
  let mode = commandMap[content];
  if (mode === null) {
    // 'tod' → random truth atau dare, 'icebreaker'/'ice' → random semua
    if (content === 'tod') {
      mode = Math.random() < 0.5 ? 'truth' : 'dare';
    } else {
      mode = pickRandomMode();
    }
  }

  // Set cooldown
  setManualCooldown(guildId, author.id);

  // Jalankan sesi
  await runIceBreakerSession(channel, guildId, mode);
  return true;
}

module.exports = {
  initIceBreakers,
  handleIceBreakerCommand
};
