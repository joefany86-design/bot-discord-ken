const cron = require('node-cron');
const stocks = require('./stocks');
const config = require('./config');
const { EmbedBuilder } = require('discord.js');

/**
 * Inisialisasi seluruh cron scheduler untuk otomasi bursa saham.
 */
function initScheduler(client) {
  // 1. Cron Job: Update harga saham setiap 2 jam (08:00 - 22:00 WIB)
  // Menit 0, setiap 2 jam, dari pukul 08:00 s/d 22:00 WIB
  cron.schedule('0 8-22/2 * * *', () => {
    console.log('⏰ [Scheduler] Menjalankan update berkala harga saham...');
    
    // Cek jam operasional
    if (!stocks.isMarketOpen()) {
      console.log('⚠️ [Scheduler] Pasar sedang tutup. Update harga dibatalkan.');
      return;
    }

    client.guilds.cache.forEach(guild => {
      // Inisialisasi saham jika belum ada
      stocks.initDefaultStocks(guild);

      const updates = stocks.updateStockPrices(guild.id);
      if (updates.length === 0) return;

      console.log(`📈 [Scheduler] Perubahan harga saham berhasil diproses untuk guild: ${guild.name}`);
      
      // Opsional: Kirim log perubahan harga ke channel default/pengumuman jika diset
      // Kita bisa buat postingan log atau biarkan user melihat secara langsung via .market
    });
  }, {
    timezone: 'Asia/Jakarta'
  });

  // 2. Cron Job: Laporan Harian Pasar Saham (Daily Report)
  // Pukul 23:05 WIB (Sesaat setelah pasar tutup pukul 23:00 WIB)
  cron.schedule('5 23 * * *', () => {
    console.log('⏰ [Scheduler] Mempersiapkan Laporan Pasar Harian...');

    client.guilds.cache.forEach(guild => {
      const activeStocks = stocks.getStocks(guild.id);
      if (activeStocks.length === 0) return;

      // Cari saham terbaik & terburuk
      let bestStock = null;
      let worstStock = null;
      let maxGain = -Infinity;
      let maxLoss = Infinity;

      activeStocks.forEach(s => {
        const diff = s.current_price - s.previous_price;
        const gainPct = s.previous_price > 0 ? (diff / s.previous_price) * 100 : 0;
        
        if (gainPct > maxGain) {
          maxGain = gainPct;
          bestStock = s;
        }
        if (gainPct < maxLoss) {
          maxLoss = gainPct;
          worstStock = s;
        }
      });

      // Cari Top 3 Investor Terkaya di Server untuk diposting
      const economy = require('./economy');
      const leaderboard = economy.getLeaderboard(guild.id, 3);

      const embed = new EmbedBuilder()
        .setColor(0x1E1F22)
        .setTitle(`📋 LAPORAN HARIAN BURSA SAHAM — ${guild.name}`)
        .setDescription(
          `🔔 **Bursa saham resmi ditutup untuk hari ini!**\n` +
          `Berikut adalah rekapitulasi perdagangan pasar server:`
        )
        .addFields(
          {
            name: '🏆 Performa Terbaik Hari Ini',
            value: bestStock 
              ? `📈 **${bestStock.stock_ticker}** (#${bestStock.stock_name}) \`+${maxGain.toFixed(1)}%\`\n👉 Harga Akhir: **Rp ${bestStock.current_price.toLocaleString('id-ID')}**`
              : 'Tidak ada data',
            inline: true
          },
          {
            name: '💀 Performa Terburuk Hari Ini',
            value: worstStock 
              ? `📉 **${worstStock.stock_ticker}** (#${worstStock.stock_name}) \`${maxLoss.toFixed(1)}%\`\n👉 Harga Akhir: **Rp ${worstStock.current_price.toLocaleString('id-ID')}**`
              : 'Tidak ada data',
            inline: true
          }
        )
        .setTimestamp();

      if (leaderboard.length > 0) {
        let topList = '';
        leaderboard.forEach((u, i) => {
          const m = client.users.cache.get(u.userId);
          const name = m ? m.username : `<@${u.userId}>`;
          topList += `🥇 **${i + 1}. ${name}** — Total Aset: **Rp ${u.totalWealth.toLocaleString('id-ID')}**\n`;
        });
        embed.addFields({ name: '👑 Top 3 Investor Terkaya Server', value: topList, inline: false });
      }

      // Kirim laporan ke channel khusus jika diset, atau fallback ke channel default/system channel guild
      let targetChannel = null;
      if (config.REPORT_CHANNEL_ID) {
        targetChannel = guild.channels.cache.get(config.REPORT_CHANNEL_ID);
      }
      if (!targetChannel) {
        targetChannel = guild.systemChannel || Array.from(guild.channels.cache.values()).find(
          c => c.name.includes('general') || c.name.includes('chat') || c.name.includes('bot')
        );
      }

      if (targetChannel) {
        targetChannel.send({ embeds: [embed] }).catch(err => {
          console.error(`❌ Gagal mengirim Laporan Harian di guild ${guild.name}:`, err.message);
        });
      }
    });
  }, {
    timezone: 'Asia/Jakarta'
  });

  // 3. Cron Job: Dividen Mingguan (Setiap Senin pagi pukul 08:00 WIB, saat Market Open)
  cron.schedule('0 8 * * 1', () => {
    console.log('⏰ [Scheduler] Mendistribusikan Dividen Saham Mingguan...');

    client.guilds.cache.forEach(guild => {
      const distributions = stocks.distributeWeeklyDividends(guild.id);
      if (distributions.length === 0) return;

      console.log(`💸 [Scheduler] Dividen berhasil didistribusikan ke ${distributions.length} investor di server ${guild.name}.`);

      // Cari channel utama untuk posting notifikasi dividen (prioritaskan REPORT_CHANNEL_ID jika diset)
      let targetChannel = null;
      if (config.REPORT_CHANNEL_ID) {
        targetChannel = guild.channels.cache.get(config.REPORT_CHANNEL_ID);
      }
      if (!targetChannel) {
        targetChannel = guild.systemChannel || Array.from(guild.channels.cache.values()).find(
          c => c.name.includes('general') || c.name.includes('chat') || c.name.includes('bot')
        );
      }

      if (targetChannel) {
        const embed = new EmbedBuilder()
          .setColor(0x00FF88)
          .setTitle('💸 DISTRIBUSI DIVIDEN MINGGUAN!')
          .setDescription(
            `🎉 Selamat Hari Senin! Pembayaran dividen mingguan untuk seluruh investor setia saham channel server telah berhasil dikirim langsung ke dompet digital Anda.\n\n` +
            `👉 Total Investor Menerima Dividen: **${distributions.length} member**\n` +
            `*Periksa portofolio & saldo terbaru Anda sekarang dengan mengetik \`.porto\` atau \`.bal\`!*`
          )
          .setTimestamp();
        
        targetChannel.send({ embeds: [embed] }).catch(() => {});
      }
    });
  }, {
    timezone: 'Asia/Jakarta'
  });

  // 4. Cron Job: Random Economic Events (Berdasarkan konfigurasi schedule & peluang)
  cron.schedule(config.events?.CRON_SCHEDULE || '0 9,12,15,18,21 * * *', () => {
    console.log('⏰ [Scheduler] Memeriksa pemicu event ekonomi acak berkala...');
    
    // Pastikan pasar sedang aktif (agar tidak men-trigger crash/bull pas pasar tutup, walaupun opsional)
    const stocks = require('./stocks');
    if (!stocks.isMarketOpen()) {
      console.log('⚠️ [Scheduler] Pasar sedang tutup. Trigger event acak ditangguhkan.');
      return;
    }

    client.guilds.cache.forEach(guild => {
      const probability = config.events?.TRIGGER_PROBABILITY || 0.30;
      if (Math.random() < probability) {
        try {
          const eventsModule = require('./events');
          eventsModule.triggerRandomEvent(client, guild);
        } catch (err) {
          console.error(`❌ Gagal memicu event acak di guild ${guild.name}:`, err.message);
        }
      }
    });
  }, {
    timezone: 'Asia/Jakarta'
  });

  // 5. Voice Active Earnings: Memberikan koin keaktifan setiap 1 menit bagi yang berada di Voice Channel
  setInterval(() => {
    console.log('⏰ [Scheduler] Memproses koin keaktifan Voice Channel...');
    const economy = require('./economy');

    client.guilds.cache.forEach(guild => {
      guild.channels.cache.forEach(channel => {
        // Hanya proses channel suara (voice channel & stage channel)
        if (channel.isVoiceBased()) {
          // Cari seluruh member manusia (bukan bot) di channel ini
          const activeMembers = channel.members.filter(member => {
            if (member.user.bot) return false;
            
            // Hindari AFK farming: abaikan jika sedang deafen (tuli) baik self atau server
            if (member.voice.selfDeaf || member.voice.serverDeaf) return false;

            // Hindari AFK farming: abaikan jika sedang mute (bisu) baik self atau server
            if (member.voice.selfMute || member.voice.serverMute) return false;
            
            return true;
          });

          // Cek syarat minimal jumlah member di voice channel (opsional, jika diset > 1)
          const minMembers = config.economy.VOICE_MIN_MEMBERS !== undefined ? config.economy.VOICE_MIN_MEMBERS : 2;
          if (activeMembers.size < minMembers) return;

          // Berikan koin ke masing-masing member yang aktif
          const earnAmount = config.economy.VOICE_EARN_AMOUNT !== undefined ? config.economy.VOICE_EARN_AMOUNT : 2;
          const earnLimit = config.economy.VOICE_EARN_LIMIT_DAILY || 300;

          activeMembers.forEach(member => {
            try {
              // Cek sisa kuota harian Voice Earn
              const dailyEarned = economy.getDailyVoiceEarnings(member.id, guild.id);
              if (dailyEarned >= earnLimit) return; // Sudah mencapai batas harian

              const remaining = earnLimit - dailyEarned;
              const finalEarn = Math.min(earnAmount, remaining);
              if (finalEarn > 0) {
                economy.addBalance(member.id, guild.id, finalEarn, 'VOICE', channel.id);
              }
            } catch (err) {
              console.error(`❌ Gagal memproses Voice Earn untuk ${member.id}:`, err.message);
            }
          });
        }
      });
    });
  }, config.economy.VOICE_EARN_INTERVAL_MS || 60000);

  console.log('✅ Cron Scheduler bursa saham telah diaktifkan secara otomatis.');
}

module.exports = {
  initScheduler
};
