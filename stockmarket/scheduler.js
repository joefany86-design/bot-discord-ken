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
  cron.schedule('0 8-22/2 * * *', () => {
    console.log('⏰ [Scheduler] Menjalankan update berkala harga saham...');
    
    // Cek jam operasional
    if (!stocks.isMarketOpen()) {
      console.log('⚠️ [Scheduler] Pasar sedang tutup. Update harga dibatalkan.');
      return;
    }

    const database = require('./database');
    const economy = require('./economy');

    client.guilds.cache.forEach(guild => {
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
          .setColor(0x00FF88)
          .setTitle(`📈  LAPORAN PERGERAKAN SAHAM  ─  ${guild.name}`)
          .setDescription(
            `${summaryLine}\n` +
            `${updateText}` +
            `─────────────────────────────────────`
          )
          .setFooter({ text: `Sentinel Bot  •  Live Market Updates  •  ${updates.length} saham diperbarui` })
          .setTimestamp();

        targetChannel.send({ embeds: [reportEmbed] }).catch(err => {
          console.error(`❌ Gagal mengirim Laporan Bursa Berkala di guild ${guild.name}:`, err.message);
        });
      }

      // ── AUTO-TRADING ENGINE: Jalankan robot investasi otomatis bagi member yang mengaktifkannya ──
      try {
        const autoTraders = database.all('SELECT * FROM wallets WHERE guild_id = ? AND auto_trade = 1', [guild.id]);
        const tradeLogs = []; // { type: 'BUY'|'SELL', userId, ticker, shares, price, total, profit, profitPct }

        autoTraders.forEach(trader => {
          try {
            const userId = trader.user_id;
            const portfolio = stocks.getPortfolio(userId, guild.id);
            
            // 1. Cek Profit-Taking (Jual Otomatis jika Untung >= 15%)
            portfolio.items.forEach(item => {
              if (item.shares > 0 && item.profitPercent >= 15.0) {
                const sharesToSell = item.shares;
                const sellRes = stocks.sellStock(userId, guild.id, item.ticker, sharesToSell);
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
        });

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

  // 3. Cron Job: Dividen Mingguan (Setiap Minggu malam pukul 21:00 WIB)
  cron.schedule('0 21 * * 0', () => {
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
          .setColor(0x00FF88) // Neon Emerald Green
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
  cron.schedule('0 0 * * *', () => {
    console.log('⏰ [Scheduler] Menjalankan pemrosesan perbankan harian (Bunga & Penagihan Pinjaman)...');

    const database = require('./database');
    const economy = require('./economy');
    const bank = require('./bank');
    const embeds = require('./embeds');

    client.guilds.cache.forEach(guild => {
      // Tentukan target channel notifikasi
      let targetChannel = null;
      if (config.REPORT_CHANNEL_ID) {
        targetChannel = guild.channels.cache.get(config.REPORT_CHANNEL_ID);
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

        savingsAccounts.forEach(account => {
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

          const finalInterestPercent = maxRate * mult;
          
          // Batas maksimal saldo tabungan yang diperhitungkan untuk bunga harian (INTEREST_CAP)
          const interestCap = config.bank.INTEREST_CAP || 20000;
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
          database.run(
            'UPDATE bank_savings SET balance = CASE WHEN balance + ? < 0 THEN 0 ELSE balance + ? END, last_interest_at = ? WHERE user_id = ? AND guild_id = ?',
            [netChange, netChange, nowUnix, userId, guild.id]
          );

          if (netChange > 0) {
            totalInterestDistributed += netChange;
          } else if (netChange < 0) {
            totalTaxDrained += Math.abs(netChange);
          }
          accountsCount++;
        });

        if (accountsCount > 0 && targetChannel) {
          console.log(`🏦 [Bank Scheduler] Pemrosesan harian selesai untuk ${accountsCount} rekening.`);
          
          const bankReportEmbed = new EmbedBuilder()
            .setColor(0x00A2E8)
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
                  .setColor(0x00FF88)
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
    });
  }, {
    timezone: 'Asia/Jakarta'
  });

  console.log('✅ Cron Scheduler bursa saham telah diaktifkan secara otomatis.');
}

module.exports = {
  initScheduler
};
