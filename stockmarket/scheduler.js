const cron = require('node-cron');
const stocks = require('./stocks');
const config = require('./config');
const { EmbedBuilder } = require('discord.js');

// Guard: mencegah setInterval bertumpuk jika initScheduler dipanggil ulang (bot reconnect)
let voiceEarnInterval = null;


/**
 * Inisialisasi seluruh cron scheduler untuk otomasi bursa saham.
 */
function initScheduler(client) {

  // 1. Cron Job: Update harga saham setiap 2 jam (08:00 - 22:00 WIB)
  // Menit 0, setiap 2 jam, dari pukul 08:00 s/d 22:00 WIB
  cron.schedule('0 8-22/2 * * *', async () => {
    console.log('⏰ [Scheduler] Menjalankan update berkala harga saham...');
    
    // Cek jam operasional
    if (!stocks.isMarketOpen()) {
      console.log('⚠️ [Scheduler] Pasar sedang tutup. Update harga dibatalkan.');
      return;
    }

    const database = require('./database');
    const economy = require('./economy');

    for (const guild of client.guilds.cache.values()) {
      // Inisialisasi saham jika belum ada
      stocks.initDefaultStocks(guild);

      const updates = stocks.updateStockPrices(guild.id);
      if (updates.length === 0) return;

      console.log(`📈 [Scheduler] Perubahan harga saham berhasil diproses untuk guild: ${guild.name}`);
      
      // Tentukan channel laporan (prioritaskan REPORT_CHANNEL_ID jika diset)
      let targetChannel = null;
      if (config.REPORT_CHANNEL_ID) {
        targetChannel = guild.channels.cache.get(config.REPORT_CHANNEL_ID);
      }
      if (!targetChannel) {
        targetChannel = guild.systemChannel || Array.from(guild.channels.cache.values()).find(
          c => c.name.includes('general') || c.name.includes('chat') || c.name.includes('bot')
        );
      }

      // ── AUTO MARKET REPORT: Kirim log perubahan harga otomatis ke channel ──
      if (targetChannel && updates.length > 0) {
        // Helper: buat activity bar visual
        const getActivityBar = (score, maxScore = 100) => {
          const barLen = 8;
          const filled = Math.min(barLen, Math.max(0, Math.round((score / maxScore) * barLen)));
          return '█'.repeat(filled) + '░'.repeat(barLen - filled);
        };

        // Hitung statistik ringkasan
        const gainers = updates.filter(u => u.changePct > 0 && !u.isPumped);
        const losers = updates.filter(u => u.changePct < 0 && !u.isCrashed);
        const pumped = updates.filter(u => u.isPumped);
        const crashed = updates.filter(u => u.isCrashed);

        let updateText = '';
        updates.forEach((u, idx) => {
          // Tentukan badge tren
          let trendBadge = '';
          let trendArrow = '';
          let priceColor = '';
          const sign = u.changePct >= 0 ? '+' : '';

          if (u.isCrashed) {
            trendBadge = '\n> ⚠️ `「  BUBBLE BURST / CRASH  」` 💀';
            trendArrow = '💥';
            priceColor = '🔴';
          } else if (u.isPumped) {
            trendBadge = '\n> 🎯 `「  BULL RUN / PUMPED  」` 🔥';
            trendArrow = '🚀';
            priceColor = '🟢';
          } else if (u.changePct > 0) {
            trendArrow = '📈';
            priceColor = '🟢';
          } else if (u.changePct < 0) {
            trendArrow = '📉';
            priceColor = '🔴';
          } else {
            trendArrow = '↔️';
            priceColor = '⚪';
          }

          const activityBar = getActivityBar(u.activity);

          updateText += `> ${priceColor} **${u.ticker}** · \`#${u.name}\`\n`;
          updateText += `> ┊ 💵 Harga   ─  **Rp ${u.newPrice.toLocaleString('id-ID')}**  ·  ${trendArrow} \`${sign}${u.changePct}%\`\n`;
          updateText += `> ┊ ⚡ Aktivitas ─  \`${activityBar}\` \`${u.activity.toFixed(1)} poin\``;
          updateText += trendBadge;
          updateText += '\n\n';
        });

        // Summary bar
        let summaryLine = '```\n';
        summaryLine += `  📊 Ringkasan:  `;
        const parts = [];
        if (pumped.length > 0)  parts.push(`🚀 ${pumped.length} Pumped`);
        if (gainers.length > 0) parts.push(`🟢 ${gainers.length} Naik`);
        if (losers.length > 0)  parts.push(`🔴 ${losers.length} Turun`);
        if (crashed.length > 0) parts.push(`💀 ${crashed.length} Crash`);
        summaryLine += parts.join('  │  ') || '⚪ Stabil';
        summaryLine += '\n```';

        const reportEmbed = new EmbedBuilder()
          .setColor(0x10B981) // Velvet Emerald Green
          .setTitle(`📈  LAPORAN PERGERAKAN SAHAM  ─  ${guild.name}`)
          .setDescription(
            `${summaryLine}\n` +
            `${updateText}` +
            `─────────────────────────────────────`
          )
          .setFooter({ text: `Bot Kosan 1A  •  Live Market Updates  •  ${updates.length} saham diperbarui` })
          .setTimestamp();

        targetChannel.send({ embeds: [reportEmbed] }).catch(err => {
          console.error(`❌ Gagal mengirim Laporan Bursa Berkala di guild ${guild.name}:`, err.message);
        });
      }

      // ── AUTO-TRADING ENGINE: Jalankan robot investasi otomatis bagi member yang mengaktifkannya ──
      try {
        const autoTraders = database.all('SELECT * FROM wallets WHERE guild_id = ? AND auto_trade = 1', [guild.id]);
        const tradeLogs = []; // { type: 'BUY'|'SELL', userId, ticker, shares, price, total, profit, profitPct }

        for (const trader of autoTraders) {
          try {
            const userId = trader.user_id;
            const member = guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null);
            const portfolio = stocks.getPortfolio(userId, guild.id);
            
            // 1. Cek Profit-Taking (Jual Otomatis jika Untung >= 15%)
            portfolio.items.forEach(item => {
              if (item.shares > 0 && item.profitPercent >= 15.0) {
                const sharesToSell = item.shares;
                const sellRes = stocks.sellStock(userId, guild.id, item.ticker, sharesToSell, member);
                tradeLogs.push({
                  type: 'SELL',
                  userId,
                  ticker: item.ticker,
                  shares: sharesToSell,
                  price: sellRes.pricePerShare,
                  total: sellRes.finalRevenue,
                  profitPct: item.profitPercent
                });
              }
            });

            // Ambil dompet ter-update setelah penjualan
            const freshWallet = economy.getWallet(userId, guild.id);
            let balance = freshWallet.balance;

            // 2. Cek Auto-Buy / DCA (Jika saldo menganggur >= Rp 150)
            if (balance >= 150) {
              const availableStocks = stocks.getStocks(guild.id);
              if (availableStocks.length > 0) {
                // Cari saham termurah di bursa yang available_shares > 0
                const purchasable = availableStocks
                  .filter(s => s.available_shares > 0 && s.current_price <= balance)
                  .sort((a, b) => a.current_price - b.current_price);

                if (purchasable.length > 0) {
                  const stockToBuy = purchasable[0];
                  // Alokasikan maksimal 30% dari saldo
                  const maxAllocation = Math.floor(balance * 0.3);
                  let sharesToBuy = Math.floor(maxAllocation / stockToBuy.current_price);
                  if (sharesToBuy === 0) sharesToBuy = 1;

                  const userPortfolio = database.get(
                    'SELECT shares FROM portfolios WHERE user_id = ? AND guild_id = ? AND channel_id = ?',
                    [userId, guild.id, stockToBuy.channel_id]
                  );
                  const currentShares = userPortfolio ? userPortfolio.shares : 0;
                  const maxHold = config.market.MAX_SHARES_HOLD_PER_USER || 100;
                  
                  // Sesuaikan dengan quota bursa & hold user
                  sharesToBuy = Math.min(sharesToBuy, stockToBuy.available_shares, maxHold - currentShares);

                  if (sharesToBuy > 0) {
                    const buyRes = stocks.buyStock(userId, guild.id, stockToBuy.stock_ticker, sharesToBuy);
                    tradeLogs.push({
                      type: 'BUY',
                      userId,
                      ticker: stockToBuy.stock_ticker,
                      shares: sharesToBuy,
                      price: buyRes.pricePerShare,
                      total: buyRes.totalPrice
                    });
                  }
                }
              }
            }
          } catch (traderErr) {
            console.error(`❌ Gagal mengeksekusi Auto-Trade untuk user ${trader.user_id}:`, traderErr.message);
          }
        }

        // Kirim Laporan Robot Auto-Trading jika ada transaksi otomatis yang dieksekusi
        if (tradeLogs.length > 0 && targetChannel) {
          // Pisahkan SELL dan BUY
          const sells = tradeLogs.filter(t => t.type === 'SELL');
          const buys = tradeLogs.filter(t => t.type === 'BUY');

          let tradeText = '';

          // ── SELL / Take Profit ──
          if (sells.length > 0) {
            let totalProfit = 0;
            tradeText += `**📤  TAKE PROFIT ─ Likuidasi Otomatis**\n`;
            sells.forEach(s => {
              totalProfit += s.total;
              tradeText += `> ┊ 🟢 <@${s.userId}> menjual **${s.shares}** lbr **${s.ticker}**\n`;
              tradeText += `> ┊    @ Rp ${s.price.toLocaleString('id-ID')}  ·  \`+${s.profitPct}%\`  ·  **+Rp ${s.total.toLocaleString('id-ID')}**\n`;
            });
            tradeText += `> ┊ 💰 Total Hasil Likuidasi: **Rp ${totalProfit.toLocaleString('id-ID')}**\n\n`;
          }

          // ── BUY / DCA ──
          if (buys.length > 0) {
            let totalSpent = 0;
            tradeText += `**📥  DOLLAR-COST AVERAGING ─ Cicilan Otomatis**\n`;
            buys.forEach(b => {
              totalSpent += b.total;
              tradeText += `> ┊ 🔵 <@${b.userId}> membeli **${b.shares}** lbr **${b.ticker}**\n`;
              tradeText += `> ┊    @ Rp ${b.price.toLocaleString('id-ID')}  ·  **Rp ${b.total.toLocaleString('id-ID')}**\n`;
            });
            tradeText += `> ┊ 💸 Total Investasi Masuk: **Rp ${totalSpent.toLocaleString('id-ID')}**\n`;
          }

          // Summary
          const uniqueTraders = [...new Set(tradeLogs.map(t => t.userId))].length;

          const autoTradeEmbed = new EmbedBuilder()
            .setColor(0x7C4DFF)
            .setTitle(`🤖  ROBOT AUTO-TRADING  ─  ${guild.name}`)
            .setDescription(
              `\`\`\`\n  ⚡ ${tradeLogs.length} transaksi  │  👥 ${uniqueTraders} trader  │  📤 ${sells.length} sell  │  📥 ${buys.length} buy\n\`\`\`\n` +
              `${tradeText}\n` +
              `─────────────────────────────────────`
            )
            .setFooter({ text: 'Ketik .autotrade untuk mengelola robot trading Anda!' })
            .setTimestamp();

          targetChannel.send({ embeds: [autoTradeEmbed] }).catch(() => {});
        }
      } catch (tradeEngineErr) {
        console.error('❌ Gagal menjalankan Auto-Trading Engine:', tradeEngineErr.message);
      }
    }
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
        .setColor(0x1E1F22) // Dark Onyx
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

  // 3. Cron Job: Dividen Mingguan (Setiap Minggu malam pukul 21:00 WIB)
  cron.schedule('0 21 * * 0', () => {
    console.log('⏰ [Scheduler] Mendistribusikan Dividen Saham Mingguan...');

    client.guilds.cache.forEach(guild => {
      const distributions = stocks.distributeWeeklyDividends(guild.id);
      if (distributions.length === 0) return;

      console.log(`💸 [Scheduler] Dividen berhasil didistribusikan ke ${distributions.length} investor di server ${guild.name}.`);

      // Cari channel utama untuk posting notifikasi dividen (prioritaskan ANNOUNCEMENT_CHANNEL_ID jika diset)
      let targetChannel = null;
      const targetChanId = config.ANNOUNCEMENT_CHANNEL_ID || config.REPORT_CHANNEL_ID;
      if (targetChanId) {
        targetChannel = guild.channels.cache.get(targetChanId);
      }
      if (!targetChannel) {
        targetChannel = guild.systemChannel || Array.from(guild.channels.cache.values()).find(
          c => c.name.includes('general') || c.name.includes('chat') || c.name.includes('bot')
        );
      }

      if (targetChannel) {
        const totalPayout = distributions.reduce((sum, d) => sum + d.amount, 0);
        const uniqueRecipients = new Set(distributions.map(d => d.userId)).size;
        const topEarner = [...distributions].sort((a, b) => b.amount - a.amount)[0];
        const topUser = topEarner ? (client.users.cache.get(topEarner.userId)?.username || `<@${topEarner.userId}>`) : '-';
        const topPayoutText = topEarner ? `👑 **${topUser}** (+Rp ${topEarner.amount.toLocaleString('id-ID')} via **${topEarner.ticker}**)` : '`-`';

        let listText = '';
        distributions.slice(0, 10).forEach((d) => {
          const user = client.users.cache.get(d.userId);
          const username = user ? user.username : `<@${d.userId}>`;
          listText += `> 💰 **${username}** Menerima **Rp ${d.amount.toLocaleString('id-ID')}** dari **${d.ticker}**\n` +
                      `> ┊ 📈 *Rate:* \`${d.rate}%\` · ⚡ *Skor Aktif:* \`${d.activity}\` · 📦 *Hold:* \`${d.shares} lbr\`\n`;
        });
        if (distributions.length > 10) {
          listText += `> *...dan ${distributions.length - 10} transaksi dividen lainnya!*`;
        }

        const embed = new EmbedBuilder()
          .setColor(0x10B981) // Velvet Emerald Green
          .setTitle('💸 DISTRIBUSI DIVIDEN BURSA MINGGUAN! 📈')
          .setDescription(
            `🎉 **Selamat Hari Minggu Malam!**\n` +
            `Sistem Bursa Saham telah membagikan dividen mingguan dinamis langsung ke dompet Anda! Dividen dihitung secara proporsional berdasarkan jumlah lembar saham yang di-hold dan keaktifan chat masing-masing channel selama 7 hari terakhir.`
          )
          .addFields(
            {
              name: '📊 Ringkasan Distribusi',
              value: `├─ 👥 **Total Penerima:** \`${uniqueRecipients} Warga\`\n` +
                     `├─ 💸 **Total Transaksi:** \`${distributions.length} Transaksi\`\n` +
                     `├─ 💰 **Dana Cair:** **Rp ${totalPayout.toLocaleString('id-ID')}**\n` +
                     `└─ 🏆 **Penerima Tertinggi:** ${topPayoutText}`,
              inline: false
            },
            {
              name: '📋 Rincian Transaksi Teratas',
              value: listText || '> *Tidak ada transaksi*',
              inline: false
            },
            {
              name: '💡 Tips Finansial',
              value: `Hold saham channel teraktif untuk mendapatkan tingkat keuntungan (rate) dividen mingguan yang jauh lebih tinggi! Gunakan \`.porto\` untuk cek portofolio Anda atau \`.bal\` untuk saldo saat ini.`,
              inline: false
            }
          )
          .setFooter({ text: 'Bursa Saham Kosan 1A • Dividen Mingguan Otomatis' })
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

  // 5. Voice Active Earnings: Memberikan koin keaktifan setiap interval bagi yang berada di Voice Channel
  // Guard: bersihkan interval sebelumnya jika ada (mencegah duplikasi saat reconnect)
  if (voiceEarnInterval) {
    clearInterval(voiceEarnInterval);
    voiceEarnInterval = null;
    console.log('⚠️ [Scheduler] Voice Earn interval sebelumnya dibersihkan (mencegah duplikasi).');
  }
  voiceEarnInterval = setInterval(() => {
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
          
          activeMembers.forEach(member => {
            try {
              const kos = require('./kos');
              let earnLimit = config.economy.VOICE_EARN_LIMIT_DAILY || 300;
              if (kos.hasUpgrade(member.id, guild.id, 'WIFI')) {
                earnLimit += 10;
              }

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

  // 6. Cron Job: Sistem Perbankan (Bunga Tabungan & Penagihan Pinjaman Harian)
  // Berjalan setiap hari pada pukul 00:00 WIB (Midnight Jakarta)
  cron.schedule('0 0 * * *', async () => {
    console.log('⏰ [Scheduler] Menjalankan pemrosesan perbankan harian (Bunga & Penagihan Pinjaman)...');

    const database = require('./database');
    const economy = require('./economy');
    const bank = require('./bank');
    const embeds = require('./embeds');

    for (const guild of client.guilds.cache.values()) {
      // Tentukan target channel notifikasi perbankan
      let targetChannel = null;
      const targetChanId = config.BANK_REPORT_CHANNEL_ID || config.REPORT_CHANNEL_ID;
      if (targetChanId) {
        targetChannel = guild.channels.cache.get(targetChanId);
      }
      if (!targetChannel) {
        targetChannel = guild.systemChannel || Array.from(guild.channels.cache.values()).find(
          c => c.name.includes('general') || c.name.includes('chat') || c.name.includes('bot')
        );
      }

      // ── A. PROSES BUNGA DAN PENYUSUTAN TABUNGAN HARIAN (MIDNIGHT BANK PROCESSING) ──
      try {
        const savingsAccounts = database.all('SELECT * FROM bank_savings WHERE balance > 0 AND guild_id = ?', [guild.id]);
        let totalInterestDistributed = 0;
        let totalTaxDrained = 0;
        let accountsCount = 0;
        const nowUnix = Math.floor(Date.now() / 1000);
        const activeThresholdTime = nowUnix - 24 * 3600;
        const kos = require('./kos');

        for (const account of savingsAccounts) {
          const userId = account.user_id;
          const activeRental = kos.getActiveRental(userId, guild.id);
          const roomTier = activeRental ? activeRental.room_tier : 'DEFAULT';

          // 1. Kueri keaktifan chat (transaksi EARN) 24 jam terakhir
          const chatRow = database.get(
            "SELECT COUNT(*) as cnt FROM transactions WHERE user_id = ? AND guild_id = ? AND type = 'EARN' AND created_at >= ?",
            [userId, guild.id, activeThresholdTime]
          );
          const activeMsgs = chatRow ? chatRow.cnt : 0;

          // 2. Hitung multiplier bunga harian aktif
          let mult = 0;
          if (activeMsgs > 5 && activeMsgs <= 20) {
            mult = 0.5;
          } else if (activeMsgs > 20) {
            mult = 1.0;
          }

          // 3. Ambil rate maksimal bunga kos tier
          const maxRate = config.bank.INTEREST_RATE_ROOMS[roomTier] !== undefined
            ? config.bank.INTEREST_RATE_ROOMS[roomTier]
            : config.bank.INTEREST_RATE_ROOMS.DEFAULT;

          // Cek gacha role untuk bonus bunga & interest cap
          let extraRate = 0;
          let extraCap = 0;
          const member = guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null);
          if (member) {
            const economy = require('./economy');
            const gachaTier = economy.getMemberGachaTier(member, guild.id);
            if (gachaTier === 'EPIC') {
              extraCap = 5000;
            } else if (gachaTier === 'LEGENDARY') {
              extraCap = 15000;
            } else if (gachaTier === 'MYTHIC') {
              extraRate = 0.50;
              extraCap = 30000;
            }
          }

          const finalInterestPercent = (maxRate + extraRate) * mult;
          
          // Batas maksimal saldo tabungan yang diperhitungkan untuk bunga harian (INTEREST_CAP)
          const interestCap = (config.bank.INTEREST_CAP || 20000) + extraCap;
          const balanceForInterest = Math.min(account.balance, interestCap);
          const interestAmount = Math.floor(balanceForInterest * (finalInterestPercent / 100));

          // 4. Hitung Biaya Keamanan Harian (Pajak Admin Penyusutan)
          const feeConfig = config.bank.DAILY_SECURITY_FEE[roomTier] !== undefined
            ? config.bank.DAILY_SECURITY_FEE[roomTier]
            : config.bank.DAILY_SECURITY_FEE.DEFAULT;

          const flatFee = feeConfig.flat;
          const percentFee = feeConfig.percent;
          const securityFeeAmount = Math.floor(account.balance * (percentFee / 100)) + flatFee;

          // 5. Hitung perubahan saldo bersih (Net Change)
          const netChange = interestAmount - securityFeeAmount;

          // 6. Jalankan update saldo bank (capping di minimal Rp 0 jika menyusut di bawah 0)
          const oldBalance = account.balance;
          database.run(
            'UPDATE bank_savings SET balance = CASE WHEN balance + ? < 0 THEN 0 ELSE balance + ? END, last_interest_at = ? WHERE user_id = ? AND guild_id = ?',
            [netChange, netChange, nowUnix, userId, guild.id]
          );
          const updatedAccount = database.get('SELECT balance FROM bank_savings WHERE user_id = ? AND guild_id = ?', [userId, guild.id]);
          const newBalanceVal = updatedAccount ? updatedAccount.balance : 0;
          const actualFeePaid = Math.max(0, oldBalance + interestAmount - newBalanceVal);
          if (actualFeePaid > 0) {
            economy.addBalance(config.OWNER_ID, guild.id, actualFeePaid, 'TAX_COLLECT_DAILY_SECURITY');
          }

          if (netChange > 0) {
            totalInterestDistributed += netChange;
          } else if (netChange < 0) {
            totalTaxDrained += Math.abs(netChange);
          }
          accountsCount++;
        }

        if (accountsCount > 0 && targetChannel) {
          console.log(`🏦 [Bank Scheduler] Pemrosesan harian selesai untuk ${accountsCount} rekening.`);
          
          const bankReportEmbed = new EmbedBuilder()
            .setColor(0xD4AF37) // Imperial Gold
            .setTitle(`🏦 LAPORAN KINERJA PERBANKAN HARIAN — ${guild.name}`)
            .setDescription(
              `🔔 **Tengah malam telah tiba! Sistem Bank Kosan 1A telah memproses seluruh tabungan warga:**\n\n` +
              `📊 **Ringkasan Akumulasi Perbankan:**\n` +
              `┊ 👥 Akun Diproses: **${accountsCount} Rekening**\n` +
              `┊ 📈 Bunga Didistribusikan: **+Rp ${totalInterestDistributed.toLocaleString('id-ID')}** (Bagi warga aktif chat)\n` +
              `┊ 📉 Penyusutan Saldo Pasif: **-Rp ${totalTaxDrained.toLocaleString('id-ID')}** (Biaya keamanan dibakar!)\n\n` +
              `💡 *Tips Kosan: Naikkan kelas sewa kamar kos Anda untuk menikmati potongan pajak bank harian dan bunga Sultan yang lebih tinggi!*`
            )
            .setTimestamp()
            .setFooter({ text: 'Bank Sentral Kosan 1A • Keamanan Terjamin' });

          targetChannel.send({ embeds: [bankReportEmbed] }).catch(err => {
            console.error('❌ Gagal mengirim Laporan Perbankan Tengah Malam:', err.message);
          });
        }
      } catch (err) {
        console.error('❌ Gagal memproses bunga tabungan harian:', err.message);
      }

      // ── B. PEMERIKSAAN JATUH TEMPO PINJAMAN & AUTO-DEBET & PENALTY ──
      try {
        const activeLoans = database.all("SELECT * FROM bank_loans WHERE status = 'ACTIVE' AND guild_id = ?", [guild.id]);
        const nowUnix = Math.floor(Date.now() / 1000);

        activeLoans.forEach(loan => {
          if (loan.due_at <= nowUnix) {
            // Pinjaman melewati batas jatuh tempo!
            const userId = loan.user_id;
            const wallet = economy.getWallet(userId, guild.id);
            const totalDue = loan.total_due;

            if (wallet.balance >= totalDue) {
              // Skenario A: Auto-Debet berhasil melunasi utang pokok + bunga kontrak!
              database.transaction(() => {
                database.run(
                  'UPDATE wallets SET balance = balance - ? WHERE user_id = ? AND guild_id = ?',
                  [totalDue, userId, guild.id]
                );
                database.run(
                  "UPDATE bank_loans SET status = 'PAID', total_due = 0 WHERE id = ?",
                  [loan.id]
                );
                database.run(
                  'INSERT INTO transactions (user_id, guild_id, type, amount) VALUES (?, ?, ?, ?)',
                  [userId, guild.id, 'LOAN_AUTO_DEBIT', -totalDue]
                );
              })();

              if (targetChannel) {
                const autoDebitEmbed = new EmbedBuilder()
                  .setColor(0x10B981) // Velvet Emerald Green
                  .setTitle(`🏛️ AUTO-DEBET LUNAS OTOMATIS — ${guild.name}`)
                  .setDescription(
                    `Tagihan pinjaman berjangka tempo milik <@${userId}> telah jatuh tempo.\n\n` +
                    `✅ **Auto-Debet Sukses:** Pembayaran tagihan senilai **Rp ${totalDue.toLocaleString('id-ID')}** telah berhasil didebet otomatis dari dompet.\n` +
                    `🏦 **Status Pinjaman:** **LUNAS (PAID)**`
                  )
                  .setTimestamp();
                targetChannel.send({ embeds: [autoDebitEmbed] }).catch(() => {});
              }
            } else {
              // Skenario B: Saldo kurang, pinjaman menjadi OVERDUE!
              // Tambahkan denda 5% pertama kali
              const penalty = Math.round(loan.principal_amount * 0.05);
              database.transaction(() => {
                database.run(
                  "UPDATE bank_loans SET status = 'OVERDUE', penalty_accumulated = penalty_accumulated + ? WHERE id = ?",
                  [penalty, loan.id]
                );
                // Matikan robot trading AI jika aktif
                database.run(
                  'UPDATE wallets SET auto_trade = 0 WHERE user_id = ? AND guild_id = ?',
                  [userId, guild.id]
                );
              })();

              // Kirim notifikasi teguran publik
              if (targetChannel) {
                const userObj = client.users.cache.get(userId);
                if (userObj) {
                  const overdueLoan = bank.getActiveLoan(userId, guild.id);
                  const noticeEmbed = embeds.bankOverdueNoticeEmbed(userObj, overdueLoan);
                  targetChannel.send({ content: `<@${userId}>`, embeds: [noticeEmbed] }).catch(() => {});
                }
              }
            }
          }
        });

        // ── C. UPDATE DENDA LATE-PENALTY BAGI YANG SUDAH OVERDUE ──
        // (Berjalan bagi pinjaman yang sudah berstatus OVERDUE untuk menambahkan denda harian +5%)
        const overdueLoans = database.all("SELECT * FROM bank_loans WHERE status = 'OVERDUE' AND guild_id = ?", [guild.id]);
        overdueLoans.forEach(loan => {
          const penalty = Math.round(loan.principal_amount * 0.05);
          database.run(
            'UPDATE bank_loans SET penalty_accumulated = penalty_accumulated + ? WHERE id = ?',
            [penalty, loan.id]
          );
        });

      } catch (err) {
        console.error('❌ Gagal memproses penagihan pinjaman harian:', err.message);
      }
    }
  }, {
    timezone: 'Asia/Jakarta'
  });
  // 7. Cron Job: Undian Lotre Mingguan (Minggu 21:00 WIB)
  cron.schedule(config.lottery?.DRAW_CRON || '0 21 * * 0', () => {
    console.log('🎟️ [Scheduler] Menjalankan undian lotre mingguan...');

    const database = require('./database');
    const lottery = require('./lottery');
    const embeds = require('./embeds');

    client.guilds.cache.forEach(guild => {
      // Tentukan target channel pengumuman lotre
      let targetChannel = null;
      const targetChanId = config.ANNOUNCEMENT_CHANNEL_ID || config.REPORT_CHANNEL_ID;
      if (targetChanId) {
        targetChannel = guild.channels.cache.get(targetChanId);
      }
      if (!targetChannel) {
        targetChannel = guild.systemChannel || Array.from(guild.channels.cache.values()).find(
          c => c.name.includes('general') || c.name.includes('chat') || c.name.includes('bot')
        );
      }

      try {
        const result = lottery.drawWinner(guild.id);

        if (!result) {
          console.log(`🎟️ [Lotre] Tidak ada peserta lotre di guild ${guild.name}. Undian di-skip.`);
          return;
        }

        console.log(`🎟️ [Lotre] Pemenang di ${guild.name}: ${result.winnerId} mendapat Rp ${result.prizeAmount}. Burn: Rp ${result.burnAmount}`);

        if (targetChannel) {
          const drawEmbed = new EmbedBuilder()
            .setColor(0xD4AF37) // Imperial Gold
            .setTitle('🎟️ 🏆 UNDIAN LOTRE MINGGUAN — PEMENANG TELAH DITENTUKAN!')
            .setDescription(
              `🎉 **Selamat kepada pemenang lotre minggu ini!**\n\n` +
              `👑 **Pemenang:** <@${result.winnerId}>\n` +
              `🎫 Tiket Pemenang: **${result.winnerTickets} tiket**\n\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `📊 **Statistik Undian Minggu Ini:**\n` +
              `┊ 💰 Total Pool: **Rp ${result.totalPool.toLocaleString('id-ID')}**\n` +
              `┊ 🎫 Total Tiket Terjual: **${result.totalTickets} tiket**\n` +
              `┊ 👥 Jumlah Peserta: **${result.participantCount} orang**\n` +
              `┊ 🏆 Hadiah Pemenang (${100 - result.burnPercent}%): **+Rp ${result.prizeAmount.toLocaleString('id-ID')}**\n` +
              `┊ 🔥 Koin Dibakar (${result.burnPercent}%): **-Rp ${result.burnAmount.toLocaleString('id-ID')}**\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `💡 *Beli tiket lotre minggu depan dengan perintah \`.lotre beli <jumlah>\`!*`
            )
            .setTimestamp()
            .setFooter({ text: 'Lotre Mingguan Bot Kosan 1A • Keberuntungan Anda Menanti!' });

          targetChannel.send({ content: `🎉 <@${result.winnerId}> telah memenangkan lotre minggu ini!`, embeds: [drawEmbed] }).catch(err => {
            console.error('❌ Gagal mengirim pengumuman lotre:', err.message);
          });
        }
      } catch (err) {
        console.error(`❌ Gagal menjalankan undian lotre di guild ${guild.name}:`, err.message);
      }
    });
  }, {
    timezone: 'Asia/Jakarta'
  });

  // 8. Cron Job: Pajak Progresif Bank Mingguan (Senin 00:00 WIB)
  cron.schedule('0 0 * * 1', () => {
    console.log('🏦 [Scheduler] Menjalankan pemungutan pajak progresif bank mingguan...');

    const database = require('./database');
    const embeds = require('./embeds');

    const brackets = config.bank.PROGRESSIVE_TAX_BRACKETS || [
      { min: 0, max: 19999, rate: 0 },
      { min: 20000, max: 49999, rate: 2.5 },
      { min: 50000, max: 99999, rate: 5.0 },
      { min: 100000, max: Number.MAX_SAFE_INTEGER, rate: 10.0 },
    ];

    client.guilds.cache.forEach(guild => {
      // Tentukan target channel pajak progresif
      let targetChannel = null;
      const targetChanId = config.BANK_REPORT_CHANNEL_ID || config.REPORT_CHANNEL_ID;
      if (targetChanId) {
        targetChannel = guild.channels.cache.get(targetChanId);
      }
      if (!targetChannel) {
        targetChannel = guild.systemChannel || Array.from(guild.channels.cache.values()).find(
          c => c.name.includes('general') || c.name.includes('chat') || c.name.includes('bot')
        );
      }

      try {
        // Ambil semua tabungan dengan saldo >= threshold terendah yang kena pajak
        const minTaxableBalance = brackets.find(b => b.rate > 0)?.min || 20000;
        const taxableAccounts = database.all(
          'SELECT * FROM bank_savings WHERE balance >= ? AND guild_id = ?',
          [minTaxableBalance, guild.id]
        );

        let totalTaxCollected = 0;
        let accountsTaxed = 0;

        taxableAccounts.forEach(account => {
          // Cari bracket yang sesuai
          const bracket = brackets.find(b => account.balance >= b.min && account.balance <= b.max);
          if (!bracket || bracket.rate <= 0) return;

          const taxAmount = Math.floor(account.balance * (bracket.rate / 100));
          if (taxAmount <= 0) return;

          const actualTaxCollected = Math.min(account.balance, taxAmount);

          // Potong saldo tabungan
          database.run(
            'UPDATE bank_savings SET balance = CASE WHEN balance - ? < 0 THEN 0 ELSE balance - ? END WHERE user_id = ? AND guild_id = ?',
            [taxAmount, taxAmount, account.user_id, guild.id]
          );

          if (actualTaxCollected > 0) {
            const economy = require('./economy');
            economy.addBalance(config.OWNER_ID, guild.id, actualTaxCollected, 'TAX_COLLECT_PROGRESSIVE');
          }

          totalTaxCollected += actualTaxCollected;
          accountsTaxed++;
        });

        console.log(`🏦 [Pajak Progresif] Guild ${guild.name}: ${accountsTaxed} rekening dipajaki, total Rp ${totalTaxCollected} dibakar.`);

        if (accountsTaxed > 0 && targetChannel) {
          const taxEmbed = new EmbedBuilder()
            .setColor(0xFF3366) // Crimson Rose
            .setTitle('🏦 📉 PAJAK PROGRESIF MINGGUAN — LAPORAN PEMUNGUTAN')
            .setDescription(
              `⚖️ **Bank Sentral Kosan 1A telah melaksanakan pemungutan pajak progresif mingguan.**\n\n` +
              `📊 **Ringkasan Pemungutan:**\n` +
              `┊ 👥 Rekening Kena Pajak: **${accountsTaxed} rekening**\n` +
              `┊ 🔥 Total Koin Dibakar: **-Rp ${totalTaxCollected.toLocaleString('id-ID')}**\n\n` +
              `📋 **Tarif Pajak Berlaku:**\n` +
              `┊ Rp 0 - 19.999: **0%** (Bebas Pajak)\n` +
              `┊ Rp 20.000 - 49.999: **2.5%**\n` +
              `┊ Rp 50.000 - 99.999: **5.0%**\n` +
              `┊ ≥ Rp 100.000: **10.0%** (Sultan Tax)\n\n` +
              `💡 *Tips: Belanjakan tabungan Anda di bursa saham, toko role, atau lotre mingguan untuk menghindari pajak berlebih!*`
            )
            .setTimestamp()
            .setFooter({ text: 'Bank Sentral Kosan 1A • Stabilitas Ekonomi Server' });

          targetChannel.send({ embeds: [taxEmbed] }).catch(err => {
            console.error('❌ Gagal mengirim laporan pajak progresif:', err.message);
          });
        }
      } catch (err) {
        console.error(`❌ Gagal memproses pajak progresif di guild ${guild.name}:`, err.message);
      }
    });
  }, {
    timezone: 'Asia/Jakarta'
  });

  // 9. Cron Job: Pengingat Publik Jatuh Tempo Pinjaman (Setiap 30 Menit)
  cron.schedule('*/30 * * * *', async () => {
    console.log('⏰ [Scheduler] Memeriksa pinjaman jatuh tempo (overdue) untuk dikirimkan pengingat...');
    const database = require('./database');
    const embeds = require('./embeds');

    client.guilds.cache.forEach(async guild => {
      let targetChannel = null;
      const targetChanId = config.BANK_REPORT_CHANNEL_ID || config.REPORT_CHANNEL_ID;
      if (targetChanId) {
        targetChannel = guild.channels.cache.get(targetChanId) || await guild.channels.fetch(targetChanId).catch(() => null);
      }
      if (!targetChannel) return;

      try {
        const overdueLoans = database.all("SELECT * FROM bank_loans WHERE status = 'OVERDUE' AND guild_id = ?", [guild.id]);
        for (const loan of overdueLoans) {
          const userObj = client.users.cache.get(loan.user_id) || await client.users.fetch(loan.user_id).catch(() => null);
          if (userObj) {
            const noticeEmbed = embeds.bankOverdueNoticeEmbed(userObj, loan);
            await targetChannel.send({ content: `<@${loan.user_id}>`, embeds: [noticeEmbed] }).catch(() => {});
          }
        }
      } catch (err) {
        console.error(`❌ Gagal mengirim pengingat jatuh tempo di guild ${guild.name}:`, err.message);
      }
    });
  }, {
    timezone: 'Asia/Jakarta'
  });

  // 10. Cron Job: Auto-Clean Channel (ID: 1503324994153873458) setiap 30 menit
  cron.schedule('*/30 * * * *', async () => {
    console.log('⏰ [Scheduler] Membersihkan channel 1503324994153873458 secara otomatis...');
    const targetChannelId = '1503324994153873458';
    try {
      const channel = client.channels.cache.get(targetChannelId) || await client.channels.fetch(targetChannelId).catch(() => null);
      if (channel) {
        let fetched;
        do {
          fetched = await channel.messages.fetch({ limit: 100 }).catch(() => null);
          if (fetched && fetched.size > 0) {
            try {
              await channel.bulkDelete(fetched);
            } catch (err) {
              for (const msg of fetched.values()) {
                await msg.delete().catch(() => {});
              }
            }
          }
        } while (fetched && fetched.size > 0);
        console.log(`🧹 [Scheduler] Channel ${targetChannelId} telah dibersihkan.`);
      }
    } catch (err) {
      console.error(`❌ Gagal membersihkan channel ${targetChannelId}:`, err.message);
    }
  }, {
    timezone: 'Asia/Jakarta'
  });

  // 13. Cron Job: Pemeriksaan & penyelesaian lelang kadaluwarsa (setiap 1 menit)
  cron.schedule('* * * * *', async () => {
    try {
      const auction = require('./auction');
      await auction.checkAndCloseExpiredAuctions(client);
    } catch (err) {
      console.error('❌ Error checking expired auctions in cron:', err.message);
    }
  }, {
    timezone: 'Asia/Jakarta'
  });

  // 14. Cron Job: Reset Season Arena PvP Bot (Setiap Hari Minggu pukul 23:59 WIB)
  cron.schedule('59 23 * * 0', async () => {
    try {
      const pvpBot = require('./pvpBot');
      await pvpBot.resetRankedSeason(client);
    } catch (err) {
      console.error('❌ Error executing PvP Arena Season Reset in cron:', err.message);
    }
  }, {
    timezone: 'Asia/Jakarta'
  });

  // 15. Cron Job: Auto-Send World Cup Schedule & Scores (Setiap Hari pukul 08:00 WIB)
  cron.schedule('0 8 * * *', async () => {
    try {
      console.log('⏰ [Scheduler] Memulai pengiriman otomatis Jadwal Piala Dunia...');
      const worldcup = require('./worldcup');
      const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
      const embed = worldcup.generateWorldCupEmbed(client);

      const btnOutcome = new ButtonBuilder()
        .setCustomId('wcb_btn_outcome')
        .setLabel('🎟️ Tebak Hasil (1X2)')
        .setStyle(ButtonStyle.Primary);
      const btnExact = new ButtonBuilder()
        .setCustomId('wcb_btn_exact')
        .setLabel('⚽ Tebak Skor Tepat')
        .setStyle(ButtonStyle.Success);
        
      const row = new ActionRowBuilder().addComponents(btnOutcome, btnExact);

      client.guilds.cache.forEach(guild => {
        const channelId = worldcup.getWorldCupChannel(guild.id);
        if (channelId) {
          const channel = guild.channels.cache.get(channelId);
          if (channel) {
            channel.send({ embeds: [embed], components: [row] })
              .then(() => console.log(`✅ Berhasil mengirim jadwal Piala Dunia ke channel bola di guild ${guild.name}`))
              .catch(err => console.error(`❌ Gagal mengirim jadwal Piala Dunia di guild ${guild.name}:`, err.message));
          }
        }
      });
    } catch (err) {
      console.error('❌ Error executing World Cup scheduler in cron:', err.message);
    }
  }, {
    timezone: 'Asia/Jakarta'
  });

  // Helper to format date in Indonesian locale (Asia/Jakarta timezone)
  const getIndonesianDate = () => {
    return new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Jakarta'
    });
  };

  // Quotes arrays that change every day
  const morningQuotes = [
    '"Setiap hari adalah kesempatan baru untuk menjadi versi terbaik dirimu."',
    '"Jangan biarkan hari kemarin merampas terlalu banyak hal berharga hari ini."',
    '"Keberhasilan dimulai dari keputusan untuk mencoba hari ini."',
    '"Fokuslah pada langkah kecil yang kamu ambil hari ini, karena itulah penentu langkah besarmu esok."',
    '"Mulailah hari dengan bersyukur. Hari yang baik dimulai dari pikiran yang baik."',
    '"Apapun rintangan hari ini, ingatlah tujuan besarmu."',
    '"Mimpi tidak akan terwujud dengan sendirinya, ayo bangun dan usahakan hari ini!"',
    '"Hari baru, semangat baru! Jangan takut gagal, takutlah jika tidak mencoba."',
    '"Energi positifmu adalah magnet keberuntunganmu hari ini."',
    '"Kerja kerasmu hari ini adalah tabungan kesuksesanmu di masa depan."'
  ];

  const afternoonQuotes = [
    '"Tetap semangat! Separuh hari telah kamu lalui, tuntaskan hari ini dengan maksimal."',
    '"Ingatlah untuk selalu menghargai setiap progres kecil yang sudah kamu buat hari ini."',
    '"Istirahat sejenak, hirup napas dalam-dalam, dan lanjutkan perjuanganmu."',
    '"Jangan menyerah saat lelah, beristirahatlah sejenak lalu bangkit kembali."',
    '"Fokus pada solusi, bukan pada masalahnya. Kamu pasti bisa!"',
    '"Tantangan siang ini hanyalah anak tangga menuju kesuksesanmu."',
    '"Tetap jaga hidrasi dan kesehatanmu di tengah padatnya aktivitas siang ini."',
    '"Setiap usaha keras yang kamu lakukan saat ini akan membuahkan hasil yang manis."',
    '"Lakukan yang terbaik yang kamu bisa saat ini, hasil akhir tidak akan mengkhianati usaha."',
    '"Makan siang yang cukup dan kembalikan fokusmu untuk sisa hari ini!"'
  ];

  const nightQuotes = [
    '"Hari telah usai, lepaskan segala beban pikiran dan bersiaplah untuk beristirahat."',
    '"Apapun hasil hari ini, kamu telah berjuang dengan sangat baik. Terima kasih diriku."',
    '"Tidurlah dengan damai, biarkan malam memulihkan kembali energimu untuk esok hari."',
    '"Kegelapan malam adalah cara alam mengingatkan kita pentingnya beristirahat."',
    '"Tutup hari ini dengan rasa syukur agar esok dimulai dengan ketenangan."',
    '"Hari esok membawa harapan baru. Istirahatlah agar siap menyambutnya."',
    '"Biarkan lelahmu hari ini larut dalam keheningan malam yang menenangkan."',
    '"Setiap hari yang selesai adalah bukti ketangguhanmu melewati hidup."',
    '"Mimpi indah menantimu. Lepaskan semua yang tidak bisa kamu ubah malam ini."',
    '"Persiapkan diri dengan tidur yang nyenyak untuk lembaran baru esok pagi."'
  ];

  // 16. Cron Job: Ucapan Selamat Pagi Otomatis (07:00 WIB)
  cron.schedule('0 7 * * *', async () => {
    try {
      const channel = await client.channels.fetch('1422642326798598348');
      if (channel) {
        const date = new Date();
        const quote = morningQuotes[date.getDate() % morningQuotes.length];
        
        const embed = new EmbedBuilder()
          .setColor(0xFFB020)
          .setTitle('🌅 | Selamat Pagi & Selamat Beraktivitas!')
          .setDescription(`📅 **${getIndonesianDate()}**\n\nSelamat pagi semuanya! Awali hari ini dengan senyuman dan energi positif. Semoga segala rencana dan urusan kalian hari ini berjalan dengan lancar. Jangan lupa sarapan agar tetap bersemangat! ☕✨`)
          .addFields({ name: '💡 Motivasi Hari Ini', value: `*${quote}*` })
          .setTimestamp()
          .setFooter({ text: 'Sistem Salam Otomatis', iconURL: client.user.displayAvatarURL() });
        await channel.send({ content: '@everyone', embeds: [embed] });
        console.log('✅ Selamat Pagi embed sent to channel 1422642326798598348');
      }
    } catch (err) {
      console.error('❌ Error executing Selamat Pagi scheduler:', err.message);
    }
  }, {
    timezone: 'Asia/Jakarta'
  });

  // 17. Cron Job: Ucapan Selamat Siang Otomatis (13:00 WIB)
  cron.schedule('0 13 * * *', async () => {
    try {
      const channel = await client.channels.fetch('1422642326798598348');
      if (channel) {
        const date = new Date();
        const quote = afternoonQuotes[date.getDate() % afternoonQuotes.length];

        const embed = new EmbedBuilder()
          .setColor(0x00A8FF)
          .setTitle('☀️ | Selamat Siang & Tetap Semangat!')
          .setDescription(`📅 **${getIndonesianDate()}**\n\nSelamat siang semuanya! Sudahkah kalian beristirahat sejenak atau makan siang? Jaga kesehatan dan hidrasi tubuh kalian. Terus berjuang untuk sisa aktivitas hari ini! 🍲🥤`)
          .addFields({ name: '💡 Tips Siang Hari', value: `*${quote}*` })
          .setTimestamp()
          .setFooter({ text: 'Sistem Salam Otomatis', iconURL: client.user.displayAvatarURL() });
        await channel.send({ content: '@everyone', embeds: [embed] });
        console.log('✅ Selamat Siang embed sent to channel 1422642326798598348');
      }
    } catch (err) {
      console.error('❌ Error executing Selamat Siang scheduler:', err.message);
    }
  }, {
    timezone: 'Asia/Jakarta'
  });

  // 18. Cron Job: Ucapan Selamat Malam Otomatis (21:00 WIB)
  cron.schedule('0 21 * * *', async () => {
    try {
      const channel = await client.channels.fetch('1422642326798598348');
      if (channel) {
        const date = new Date();
        const quote = nightQuotes[date.getDate() % nightQuotes.length];

        const embed = new EmbedBuilder()
          .setColor(0x1A237E)
          .setTitle('🌌 | Selamat Malam & Selamat Beristirahat!')
          .setDescription(`📅 **${getIndonesianDate()}**\n\nSelamat malam semuanya! Waktunya melepas lelah dari rutinitas hari ini. Bersantailah bersama keluarga atau lakukan hal yang menenangkan. Semoga tidur malam kalian nyenyak dan mimpi indah! 💤⭐️`)
          .addFields({ name: '💡 Refleksi Malam', value: `*${quote}*` })
          .setTimestamp()
          .setFooter({ text: 'Sistem Salam Otomatis', iconURL: client.user.displayAvatarURL() });
        await channel.send({ content: '@everyone', embeds: [embed] });
        console.log('✅ Selamat Malam embed sent to channel 1422642326798598348');
      }
    } catch (err) {
      console.error('❌ Error executing Selamat Malam scheduler:', err.message);
    }
  }, {
    timezone: 'Asia/Jakarta'
  });

  console.log('✅ Cron Scheduler bursa saham telah diaktifkan secara otomatis.');
}

module.exports = {
  initScheduler
};
