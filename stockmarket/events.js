const db = require('./database');
const config = require('./config');
const stocks = require('./stocks');
const embeds = require('./embeds');
const { EmbedBuilder } = require('discord.js');

// Tipe Event yang didukung
const EVENT_TYPES = {
  MARKET_CRASH: 'MARKET_CRASH',
  BULL_RUN: 'BULL_RUN',
  DOUBLE_EARNING: 'DOUBLE_EARNING',
  BREAKING_NEWS: 'BREAKING_NEWS'
};

// Bank berita dinamis bertema lokal server
const NEWS_TEMPLATES = [
  {
    id: 'NEWS_001',
    headline: '📰 KOPI HITAM BOOMING DI LOUNGE!',
    desc: 'Warga lounge beramai-ramai memborong kopi hitam untuk maraton mengobrol. Produktivitas nongkrong meningkat drastis!',
    tickerTarget: '$LOUNGE',
    minImpact: 0.15,
    maxImpact: 0.35,
    isPositive: true
  },
  {
    id: 'NEWS_002',
    headline: '📰 KEKACAUAN DI CHANNEL LOUNGE!',
    desc: 'Terjadi perdebatan sengit tentang merk mie instan terbaik di Lounge. Suasana memanas, obrolan menjadi tidak kondusif!',
    tickerTarget: '$LOUNGE',
    minImpact: -0.25,
    maxImpact: -0.10,
    isPositive: false
  },
  {
    id: 'NEWS_003',
    headline: '📰 SPAM KUCING DI GENERAL CHAT!',
    desc: 'Admin ketiduran! Terjadi invasi spam gambar kucing lucu secara masif di General Chat. Investor panik dan kabur!',
    tickerTarget: '$GENERAL',
    minImpact: -0.30,
    maxImpact: -0.15,
    isPositive: false
  },
  {
    id: 'NEWS_004',
    headline: '📰 BOOMING WACANA DI GENERAL!',
    desc: 'General chat dipenuhi wacana liburan bersama warga server yang sangat meyakinkan. Antusiasme member melonjak tinggi!',
    tickerTarget: '$GENERAL',
    minImpact: 0.15,
    maxImpact: 0.30,
    isPositive: true
  },
  {
    id: 'NEWS_005',
    headline: '📰 UPGRADE VPS SENTINEL BOT!',
    desc: 'Developer melakukan migrasi VPS ke kecepatan tinggi dengan port jaringan premium. Delay respons bot nyaris nol!',
    tickerTarget: '$BOT',
    minImpact: 0.20,
    maxImpact: 0.35,
    isPositive: true
  },
  {
    id: 'NEWS_006',
    headline: '📰 KABEL VPS DIGIGIT TIKUS!',
    desc: 'Koneksi ke VPS server bot mengalami gangguan karena kabel fiber optic eksternal digigit tikus tanah. Sentinel lag parah!',
    tickerTarget: '$BOT',
    minImpact: -0.30,
    maxImpact: -0.15,
    isPositive: false
  },
  {
    id: 'NEWS_007',
    headline: '📰 SUNTIKAN MODAL ASING BURSA SAHAM!',
    desc: 'Seorang konglomerat misterius menyuntikkan dana segar Rp 10.000.000 ke dalam bursa saham server Kosan 1A!',
    tickerTarget: 'RANDOM',
    minImpact: 0.15,
    maxImpact: 0.30,
    isPositive: true
  },
  {
    id: 'NEWS_008',
    headline: '📰 SENTIMEN NEGATIF GLOBAL!',
    desc: 'Sentimen negatif melanda industri cloud hosting global. Biaya sewa server meningkat, pasar ikut terpukul lesu!',
    tickerTarget: 'RANDOM',
    minImpact: -0.20,
    maxImpact: -0.10,
    isPositive: false
  }
];

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
    console.error('❌ Gagal hapus active event sebelum trigger di DB:', err.message);
  }

  let eventTitle = '';
  let effectSummary = '';
  
  const embed = new EmbedBuilder().setTimestamp();

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

    eventTitle = '🚨 EVENT EKONOMI: MARKET CRASH! 📉';
    effectSummary = '⚠️ Semua harga saham anjlok sebesar -20% secara instan!\n*Saat yang tepat untuk serok muatan di harga murah?*';
    
    const crashAnsi = '```ansi\n\u001b[1;31m⚠️ SEMUA HARGA SAHAM ANJLOK -20% INSTAN!\u001b[0m\n```';

    embed.setColor(embeds.COLORS.ERROR)
      .setTitle(eventTitle)
      .setDescription(
        '💥 **KEPANIKAN MASSAL DI LANTAI BURSA!**\n' +
        'Krisis finansial global mendadak menyerang server Kosan 1A! Sentimen negatif memicu aksi jual panik berantai (panic selling) dari para investor kelas kakap hingga eceran.'
      )
      .addFields(
        {
          name: '📉 Dampak Kerusakan',
          value: crashAnsi,
          inline: false
        },
        {
          name: '💡 Analisis Strategis',
          value: '🛒 **Saatnya Serok Muatan Murah?**\n' +
                 'Ini adalah momen emas untuk membeli saham-saham unggulan di harga diskon (**Buy the Dip!**). Siapkan koin Rupiah Anda dan borong stok sebelum pasar pulih!',
          inline: false
        }
      );

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

    eventTitle = '🟢 EVENT EKONOMI: BULL RUN! 🚀';
    effectSummary = '🚀 Semua harga saham melonjak sebesar +15% secara instan!\n*Para holder saham tersenyum lebar melihat portofolio mereka menghijau!*';
    
    const bullAnsi = '```ansi\n\u001b[1;32m🚀 SEMUA HARGA SAHAM MELONJAK +15% INSTAN!\u001b[0m\n```';

    embed.setColor(embeds.COLORS.SUCCESS)
      .setTitle(eventTitle)
      .setDescription(
        '📈 **GAIRAH PASAR MEROKET TINGGI!**\n' +
        'Optimisme investasi sedang meluap hebat di seluruh server Kosan 1A! Suntikan likuiditas asing dan antusiasme warga memicu tren hijau raksasa di lantai bursa.'
      )
      .addFields(
        {
          name: '📈 Dampak Keuntungan',
          value: bullAnsi,
          inline: false
        },
        {
          name: '💡 Analisis Strategis',
          value: '💰 **Waktunya Ambil Keuntungan?**\n' +
                 'Para pemegang saham (holders) tersenyum lebar melihat portofolio mereka menghijau royo-royo. Apakah Anda akan melikuidasi profit sekarang atau HODL ke bulan?',
          inline: false
        }
      );

  } else if (type === EVENT_TYPES.DOUBLE_EARNING) {
    // Berdurasi 1 jam
    const endsAt = nowUnix + config.events.DOUBLE_EARNING_DURATION;
    try {
      db.run(
        'INSERT INTO active_events (guild_id, event_type, ends_at) VALUES (?, ?, ?)',
        [guildId, EVENT_TYPES.DOUBLE_EARNING, endsAt]
      );
    } catch (err) {
      console.error('❌ Gagal menyimpan active_event DOUBLE_EARNING ke DB:', err.message);
    }

    eventTitle = '💰 EVENT EKONOMI: DOUBLE EARNING HOUR! ⚡';
    effectSummary = '🔥 Selama 1 jam ke depan, pendapatan chat bernilai 2 KALI LIPAT! Selesai pada: <t:' + endsAt + ':F>';
    
    const doubleAnsi = '```ansi\n\u001b[1;36m🔥 2X LIPAT PENDAPATAN DARI SETIAP CHAT!\u001b[0m\n```';

    embed.setColor(embeds.COLORS.PURPLE)
      .setTitle(eventTitle)
      .setDescription(
        '🔥 **BOOSTER ENERGI AKTIVITAS CHAT DIAKTIFKAN!**\n' +
        'Waktunya memanen koin Rupiah Server! Selama satu jam penuh, keaktifan mengobrol di seluruh channel text server sedang mendapatkan pelipat gandaan berkah.'
      )
      .addFields(
        {
          name: '⚡ Efek Booster',
          value: doubleAnsi,
          inline: false
        },
        {
          name: '🕒 Informasi Waktu',
          value: '├─ **Durasi Aktif:** `1 Jam Penuh`\n' +
                 '└─ **Selesai Pada:** <t:' + endsAt + ':F> (<t:' + endsAt + ':R>)',
          inline: false
        },
        {
          name: '💡 Tips Warga',
          value: '💬 Segera merapat ke Lounge atau channel obrolan aktif lainnya! Ketik pesan berfaedah Anda sebanyak-banyaknya untuk melipatgandakan tabungan Anda secara instan.',
          inline: false
        }
      );

  } else if (type === EVENT_TYPES.BREAKING_NEWS) {
    // 1. Pilih template berita acak
    const news = NEWS_TEMPLATES[Math.floor(Math.random() * NEWS_TEMPLATES.length)];
    
    // 2. Tentukan ticker target
    let targetTicker = news.tickerTarget;
    let selectedStock = null;
    const activeStocks = stocks.getStocks(guildId) || [];
    
    if (activeStocks.length === 0) {
      return { success: false, reason: 'Tidak ada saham aktif di guild ini' };
    }
    
    if (targetTicker === 'RANDOM') {
      // Pilih saham aktif secara acak
      selectedStock = activeStocks[Math.floor(Math.random() * activeStocks.length)];
      targetTicker = selectedStock.stock_ticker;
    } else {
      // Cari saham aktif berdasarkan ticker
      selectedStock = activeStocks.find(s => s.stock_ticker.toUpperCase() === targetTicker.toUpperCase());
      
      // Jika ticker target tidak ditemukan (belum terdaftar di server ini), fallback ke acak
      if (!selectedStock) {
        selectedStock = activeStocks[Math.floor(Math.random() * activeStocks.length)];
        targetTicker = selectedStock.stock_ticker;
      }
    }
    
    // 3. Kalkulasi dampak harga
    const oldPrice = selectedStock.current_price;
    const isPositive = news.isPositive;
    const randomImpact = news.minImpact + Math.random() * (news.maxImpact - news.minImpact);
    
    let newPrice;
    if (isPositive) {
      newPrice = Math.min(config.market.MAX_PRICE, Math.round(oldPrice * (1 + randomImpact)));
    } else {
      newPrice = Math.max(config.market.MIN_PRICE, Math.round(oldPrice * (1 + randomImpact)));
    }
    
    // 4. Update harga di database
    db.run(
      'UPDATE stocks SET previous_price = ?, current_price = ? WHERE channel_id = ? AND guild_id = ?',
      [oldPrice, newPrice, selectedStock.channel_id, guildId]
    );

    // Rekam riwayat harga
    db.run(
      'INSERT INTO price_history (channel_id, guild_id, price, activity_score) VALUES (?, ?, ?, 0.0)',
      [selectedStock.channel_id, guildId, newPrice]
    );
    
    // Tentukan warna & persentase perubahan teks
    const pctChange = ((newPrice - oldPrice) / oldPrice) * 100;
    const pctSign = pctChange >= 0 ? '+' : '';
    const pctText = '`' + pctSign + pctChange.toFixed(1) + '%`';
    
    eventTitle = '📰 BREAKING NEWS: INFORMASI BURSA UTAMA! 🚨';
    effectSummary = 'Saham ' + selectedStock.stock_ticker + ' ' + (isPositive ? 'NAIK' : 'TURUN') + ' ' + pctText + ' menjadi Rp ' + newPrice.toLocaleString('id-ID');
    
    const escChar = String.fromCharCode(27);
    const nlChar = String.fromCharCode(10);
    const trendDirText = isPositive ? '🟢 Naik Signifikan' : '🔴 Turun Tajam';
    const percentChangeText = isPositive ? '+' + pctChange.toFixed(1) + '%' : pctChange.toFixed(1) + '%';
    const priceTransitionAnsi = '```ansi' + nlChar + escChar + '[1;30mRp ' + oldPrice.toLocaleString('id-ID') + escChar + '[0m ➔ ' + escChar + '[1;' + (isPositive ? '32m' : '31m') + 'Rp ' + newPrice.toLocaleString('id-ID') + escChar + '[0m' + nlChar + '```';

    embed.setColor(isPositive ? embeds.COLORS.SUCCESS : embeds.COLORS.ERROR)
      .setTitle(eventTitle)
      .setDescription(
        '📢 **LAPORAN KHUSUS STASIUN RADAR KOSAN 1A**' + nlChar +
        'Sebuah peristiwa mengejutkan baru saja terjadi dan memicu kepanikan serta spekulasi intens di kalangan pelaku pasar saham!'
      )
      .addFields(
        {
          name: '📰 Berita Utama',
          value: '**' + news.headline + '**' + nlChar + '*“' + news.desc + '”*',
          inline: false
        },
        {
          name: '🎯 Dampak Saham Spesifik',
          value: '├─ **Saham Terdampak:** **' + selectedStock.stock_ticker + '** (`#' + selectedStock.stock_name + '`)' + nlChar +
                 '├─ **Arah Pergerakan:** ' + trendDirText + nlChar +
                 '└─ **Persentase Perubahan:** `' + percentChangeText + '`',
          inline: false
        },
        {
          name: '💵 Penyesuaian Harga',
          value: priceTransitionAnsi,
          inline: false
        },
        {
          name: '💡 Rekomendasi Trader',
          value: 'Periksa portofolio Anda terhadap ticker **' + selectedStock.stock_ticker + '** segera! Ambil tindakan sebelum pelaku pasar lain mendominasi antrean beli/jual!',
          inline: false
        }
      );
  }

  embed.setFooter({ text: 'Event Ekonomi Random Server Kosan 1A', iconURL: client.user?.displayAvatarURL() || null });

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

  if (targetChannel) {
    targetChannel.send({ content: '@everyone', embeds: [embed] }).catch(err => {
      console.error('❌ Gagal mengirim pengumuman event di guild ' + guild.name + ':', err.message);
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
