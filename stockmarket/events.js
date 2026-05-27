const db = require('./database');
const config = require('./config');
const stocks = require('./stocks');
const embeds = require('./embeds');
const { EmbedBuilder } = require('discord.js');

// Tipe Event yang didukung
const EVENT_TYPES = {
  MARKET_CRASH: 'MARKET_CRASH',
  BULL_RUN: 'BULL_RUN',
  DOUBLE_EARNING: 'DOUBLE_EARNING'
};

/**
 * Mengambil status event yang sedang aktif di Guild.
 * Melakukan pembersihan otomatis (self-cleaning) jika event sudah kedaluwarsa.
 */
function getActiveEvent(guildId) {
  try {
    const row = db.get('SELECT event_type, ends_at FROM active_events WHERE guild_id = ?', [guildId]);
    if (!row) return null;

    const nowUnix = Math.floor(Date.now() / 1000);
    if (nowUnix > row.ends_at) {
      db.run('DELETE FROM active_events WHERE guild_id = ?', [guildId]);
      return null;
    }

    return {
      type: row.event_type,
      endsAt: row.ends_at,
      timeLeftSec: row.ends_at - nowUnix
    };
  } catch (err) {
    console.error(`❌ Gagal mengambil active event dari DB untuk guild ${guildId}:`, err.message);
    return null;
  }
}

/**
 * Memicu event spesifik untuk Guild tertentu.
 */
function triggerEvent(client, guild, type) {
  const guildId = guild.id;
  const nowUnix = Math.floor(Date.now() / 1000);

  // Jika memicu event baru, hapus event aktif sebelumnya agar tidak tumpang tindih
  try {
    db.run('DELETE FROM active_events WHERE guild_id = ?', [guildId]);
  } catch (err) {
    console.error(`❌ Gaps hapus active event sebelum trigger di DB:`, err.message);
  }

  let eventTitle = '';
  let eventDesc = '';
  let embedColor = 0x5865F2;
  let effectSummary = '';

  // Inisialisasi saham default jika belum ada
  stocks.initDefaultStocks(guild);

  if (type === EVENT_TYPES.MARKET_CRASH) {
    // Kurangi harga semua saham aktif sebesar 20%
    const activeStocks = stocks.getStocks(guildId) || [];
    if (activeStocks.length > 0) {
      activeStocks.forEach(s => {
        const oldPrice = s.current_price;
        // Kurangi 20%
        const newPrice = Math.max(config.market.MIN_PRICE, Math.round(oldPrice * 0.8));
        
        // Update di DB
        db.run(
          'UPDATE stocks SET previous_price = ?, current_price = ? WHERE channel_id = ? AND guild_id = ?',
          [oldPrice, newPrice, s.channel_id, guildId]
        );

        // Rekam riwayat harga
        db.run(
          'INSERT INTO price_history (channel_id, guild_id, price, activity_score) VALUES (?, ?, ?, 0.0)',
          [s.channel_id, guildId, newPrice]
        );
      });
    }

    eventTitle = '🚨 EVENT EKONOMI: MARKET CRASH!';
    eventDesc = '📉 **Kepanikan melanda server!** Krisis finansial global menyebabkan kepanikan massal di lantai bursa.';
    effectSummary = '⚠️ Semua harga saham anjlok sebesar **-20%** secara instan!\n*Saat yang tepat untuk serok muatan di harga murah?*';
    embedColor = embeds.COLORS.ERROR; // Red

  } else if (type === EVENT_TYPES.BULL_RUN) {
    // Naikkan harga semua saham aktif sebesar 15%
    const activeStocks = stocks.getStocks(guildId) || [];
    if (activeStocks.length > 0) {
      activeStocks.forEach(s => {
        const oldPrice = s.current_price;
        // Naikkan 15%
        const newPrice = Math.min(config.market.MAX_PRICE, Math.round(oldPrice * 1.15));
        
        // Update di DB
        db.run(
          'UPDATE stocks SET previous_price = ?, current_price = ? WHERE channel_id = ? AND guild_id = ?',
          [oldPrice, newPrice, s.channel_id, guildId]
        );

        // Rekam riwayat harga
        db.run(
          'INSERT INTO price_history (channel_id, guild_id, price, activity_score) VALUES (?, ?, ?, 0.0)',
          [s.channel_id, guildId, newPrice]
        );
      });
    }

    eventTitle = '🟢 EVENT EKONOMI: BULL RUN!';
    eventDesc = '📈 **Optimisme pasar meroket!** Sentimen positif meluap dan gairah investasi sedang membara di seluruh server.';
    effectSummary = '🚀 Semua harga saham melonjak sebesar **+15%** secara instan!\n*Para holder saham tersenyum lebar melihat portofolio mereka menghijau!*';
    embedColor = embeds.COLORS.SUCCESS; // Green

  } else if (type === EVENT_TYPES.DOUBLE_EARNING) {
    // Berdurasi 1 jam
    const endsAt = nowUnix + config.events.DOUBLE_EARNING_DURATION;
    try {
      db.run(
        'INSERT INTO active_events (guild_id, event_type, ends_at) VALUES (?, ?, ?)',
        [guildId, EVENT_TYPES.DOUBLE_EARNING, endsAt]
      );
    } catch (err) {
      console.error(`❌ Gagal menyimpan active_event DOUBLE_EARNING ke DB:`, err.message);
    }

    eventTitle = '💰 EVENT EKONOMI: DOUBLE EARNING HOUR!';
    eventDesc = '⚡ **Waktunya panen koin!** Keaktifan mengobrol di seluruh channel text server sedang mendapatkan booster spesial.';
    effectSummary = `🔥 Selama **1 jam ke depan**, setiap koin **${config.CURRENCY_NAME}** yang kamu dapatkan dari mengirim pesan (chatting) akan bernilai **2 KALI LIPAT**!\n\n🕒 Event berakhir pada: <t:${endsAt}:F> (<t:${endsAt}:R>)`;
    embedColor = embeds.COLORS.PURPLE; // Purple
  }

  // Kirim pengumuman ke channel laporan atau system channel
  let targetChannel = null;
  if (config.REPORT_CHANNEL_ID) {
    targetChannel = guild.channels.cache.get(config.REPORT_CHANNEL_ID);
  }
  if (!targetChannel) {
    targetChannel = guild.systemChannel || Array.from(guild.channels.cache.values()).find(
      c => c.isTextBased() && (c.name.includes('general') || c.name.includes('chat') || c.name.includes('bot'))
    );
  }

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(eventTitle)
    .setDescription(eventDesc)
    .addFields({ name: '✨ Efek Event', value: effectSummary })
    .setFooter({ text: 'Event Ekonomi Random Server Kosan 1A' })
    .setTimestamp();

  if (targetChannel) {
    targetChannel.send({ content: '@everyone', embeds: [embed] }).catch(err => {
      console.error(`❌ Gagal mengirim pengumuman event di guild ${guild.name}:`, err.message);
    });
  }

  return {
    success: true,
    type,
    title: eventTitle,
    effect: effectSummary
  };
}

/**
 * Memilih event secara acak dan memicunya untuk Guild tertentu.
 */
function triggerRandomEvent(client, guild) {
  const types = Object.values(EVENT_TYPES);
  const randomType = types[Math.floor(Math.random() * types.length)];
  console.log(`🎲 [Event Engine] Memulai event ${randomType} untuk guild: ${guild.name}`);
  return triggerEvent(client, guild, randomType);
}

module.exports = {
  EVENT_TYPES,
  getActiveEvent,
  triggerEvent,
  triggerRandomEvent
};
