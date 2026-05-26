const { EmbedBuilder } = require('discord.js');
const config = require('./config');

// Palette Warna Premium (HSL tailored / vibrant)
const COLORS = {
  INFO: 0x5865F2,     // Blurple Discord
  SUCCESS: 0x00FF88,  // Neon Emerald Green
  ERROR: 0xFF3366,    // Neon Hot Pink
  WARN: 0xFFB300,     // Gold Amber
  DARK: 0x1E1F22,     // Premium Grey-Dark
  PURPLE: 0x7C4DFF    // Deep Purple
};

/**
 * Format angka ke mata uang Rupiah Server (e.g. Rp 1.500)
 */
function formatCurrency(amount) {
  return `${config.CURRENCY_SYMBOL} ${amount.toLocaleString('id-ID')}`;
}

module.exports = {
  COLORS,
  formatCurrency,

  // 1. Embed Saldo / Profile
  profileEmbed(user, wallet, portfolioValue) {
    const totalWealth = wallet.balance + portfolioValue;
    return new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle(`💼 Dompet Keuangan — ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { 
          name: '💵 Saldo Rupiah Server', 
          value: `**${formatCurrency(wallet.balance)}**`, 
          inline: true 
        },
        { 
          name: '📊 Nilai Investasi Saham', 
          value: `**${formatCurrency(portfolioValue)}**`, 
          inline: true 
        },
        { 
          name: '💎 Total Kekayaan', 
          value: `**${formatCurrency(totalWealth)}**`, 
          inline: false 
        },
        { 
          name: '🔥 Streak Keaktifan', 
          value: `\`${wallet.streak_days} hari berturut-turut\` ${wallet.streak_days >= 3 ? '⚡' : ''}`, 
          inline: true 
        },
        { 
          name: '📈 Total Earning', 
          value: `\`${formatCurrency(wallet.total_earned)}\``, 
          inline: true 
        }
      )
      .setFooter({ text: 'Ketik .daily untuk klaim koin harian!' })
      .setTimestamp();
  },

  // 2. Embed Klaim Harian (.daily)
  dailyClaimEmbed(user, result) {
    const embed = new EmbedBuilder()
      .setThumbnail(user.displayAvatarURL({ dynamic: true }));

    if (result.success) {
      embed
        .setColor(COLORS.SUCCESS)
        .setTitle('🎉 Hadiah Harian Berhasil Diklaim!')
        .setDescription(
          `Selamat **${user.username}**! Kamu mendapatkan **${formatCurrency(result.reward)}** hari ini.\n\n` +
          `💰 Hadiah Dasar: \`${formatCurrency(result.baseReward)}\`\n` +
          `🔥 Bonus Streak: \`${formatCurrency(result.streakBonus)}\` (${result.streak} hari)`
        )
        .setFooter({ text: 'Kembali lagi besok untuk mempertahankan streak!' });
    } else {
      // Hitung sisa waktu (jam, menit, detik)
      const hours = Math.floor(result.timeLeftMs / (1000 * 60 * 60));
      const minutes = Math.floor((result.timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((result.timeLeftMs % (1000 * 60)) / 1000);
      
      embed
        .setColor(COLORS.WARN)
        .setTitle('⏳ Kamu Sudah Klaim Hari Ini!')
        .setDescription(
          `Sabar ya, kamu baru bisa mengklaim hadiah harian berikutnya dalam:\n` +
          `👉 **${hours} jam ${minutes} menit ${seconds} detik**`
        );
    }
    return embed.setTimestamp();
  },

  // 3. Embed Pasar Saham (.market)
  marketEmbed(stocks, isMarketOpen) {
    const embed = new EmbedBuilder()
      .setColor(isMarketOpen ? COLORS.SUCCESS : COLORS.ERROR)
      .setTitle(`📈 Bursa Saham Server — ${isMarketOpen ? '🟢 BUKA' : '🔴 TUTUP'}`)
      .setDescription(
        `Investasikan koin **${config.CURRENCY_NAME}** Anda ke channel server teraktif!\n` +
        `*Harga saham ter-update otomatis setiap 2 jam berdasarkan keaktifan chat.*`
      );

    if (stocks.length === 0) {
      embed.addFields({ name: '🚫 Bursa Kosong', value: 'Belum ada saham channel terdaftar.' });
    } else {
      stocks.forEach(stock => {
        const diff = stock.current_price - stock.previous_price;
        const pct = stock.previous_price > 0 ? ((diff / stock.previous_price) * 100).toFixed(1) : '0.0';
        const trendEmoji = diff > 0 ? '📈' : diff < 0 ? '📉' : '↔️';
        const trendColor = diff > 0 ? '+' : '';
        
        embed.addFields({
          name: `${stock.stock_ticker} — #${stock.stock_name}`,
          value: `👉 Harga: **${formatCurrency(stock.current_price)}** per lembar\n` +
                 `📊 Perubahan: \`${trendEmoji} ${trendColor}${pct}%\` | Stok: \`${stock.available_shares}/${stock.total_shares} lembar\``,
          inline: false
        });
      });
    }

    embed.setFooter({ text: 'Beli saham dengan: .buy <ticker> <jumlah>' }).setTimestamp();
    return embed;
  },

  // 4. Embed Detail Saham (.stock $TICKER)
  stockDetailEmbed(stock, priceHistory) {
    const diff = stock.current_price - stock.previous_price;
    const pct = stock.previous_price > 0 ? ((diff / stock.previous_price) * 100).toFixed(1) : '0.0';
    const trendEmoji = diff > 0 ? '🟢 Naik' : diff < 0 ? '🔴 Turun' : '🟡 Stabil';
    
    // Bikin representasi visual chart sederhana dari history harga
    let chartVisual = 'Belum ada data riwayat harga.';
    if (priceHistory && priceHistory.length > 0) {
      const prices = priceHistory.slice(-5).map(h => h.price);
      if (prices.length > 1) {
        chartVisual = '`[' + prices.map(p => `Rp ${p}`).join(' ➔ ') + ']`';
      }
    }

    return new EmbedBuilder()
      .setColor(diff >= 0 ? COLORS.SUCCESS : COLORS.ERROR)
      .setTitle(`📊 Detail Saham: ${stock.stock_ticker} (${stock.stock_name})`)
      .addFields(
        { name: '💰 Harga Saat Ini', value: `**${formatCurrency(stock.current_price)}** per lembar`, inline: true },
        { name: '💵 Harga Sebelumnya', value: `${formatCurrency(stock.previous_price)}`, inline: true },
        { name: '📉 Performa Hari Ini', value: `\`${trendEmoji} (${diff >= 0 ? '+' : ''}${pct}%)\``, inline: true },
        { name: '🏛️ Stok Pasar', value: `\`${stock.available_shares} / ${stock.total_shares} lembar\``, inline: true },
        { name: '🔥 Skor Aktivitas Saat Ini', value: `\`${stock.activity_score.toFixed(1)} poin\``, inline: true },
        { name: '📈 Tren Perubahan Harga', value: chartVisual, inline: false }
      )
      .setFooter({ text: 'Gunakan perintah .buy atau .sell untuk bertransaksi!' })
      .setTimestamp();
  },

  // 5. Embed Portofolio (.portfolio / .porto)
  portfolioEmbed(user, portfolio, wallet) {
    const totalWealth = wallet.balance + portfolio.totalPortfolioValue;
    const embed = new EmbedBuilder()
      .setColor(COLORS.PURPLE)
      .setTitle(`💼 Portofolio Investasi — ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setDescription(
        `💰 Saldo Koin: **${formatCurrency(wallet.balance)}**\n` +
        `📊 Valuasi Saham: **${formatCurrency(portfolio.totalPortfolioValue)}**\n` +
        `💎 Total Kekayaan: **${formatCurrency(totalWealth)}**`
      );

    if (portfolio.items.length === 0) {
      embed.addFields({ name: '🚫 Portofolio Kosong', value: 'Anda belum memiliki aset saham channel apa pun.' });
    } else {
      portfolio.items.forEach(item => {
        const profitSign = item.profitRp >= 0 ? '+' : '';
        const profitPercentSign = item.profitRp >= 0 ? '📈' : '📉';
        
        embed.addFields({
          name: `${item.ticker} — #${item.name}`,
          value: `👉 Aset: \`${item.shares} lembar\` (Rata-rata: ${formatCurrency(item.avgPrice)})\n` +
                 `📊 Valuasi: **${formatCurrency(item.currentValue)}**\n` +
                 `📈 Keuntungan: \`${profitPercentSign} ${profitSign}${formatCurrency(item.profitRp)} (${profitSign}${item.profitPercent}%)\``,
          inline: false
        });
      });
    }

    embed.setFooter({ text: 'Ketik .market untuk melihat pasar saham!' }).setTimestamp();
    return embed;
  },

  // 6. Embed Transaksi Beli / Jual
  transactionSuccessEmbed(user, isBuy, details) {
    const embed = new EmbedBuilder()
      .setColor(isBuy ? COLORS.SUCCESS : COLORS.WARN)
      .setTitle(isBuy ? '📥 Pembelian Saham Sukses!' : '📤 Penjualan Saham Sukses!')
      .setThumbnail(user.displayAvatarURL({ dynamic: true }));

    if (isBuy) {
      embed.setDescription(
        `Selamat **${user.username}**! Transaksi pembelian saham berhasil diproses.\n\n` +
        `📈 Saham: **${details.ticker}** (#${details.stockName})\n` +
        `📦 Lembar: \`${details.shares} lembar\`\n` +
        `💵 Harga Satuan: \`${formatCurrency(details.pricePerShare)}\`\n` +
        `💰 Total Biaya: **${formatCurrency(details.totalPrice)}**`
      );
    } else {
      embed.setDescription(
        `Selamat **${user.username}**! Transaksi penjualan saham berhasil diproses.\n\n` +
        `📉 Saham: **${details.ticker}** (#${details.stockName})\n` +
        `📦 Lembar: \`${details.shares} lembar\`\n` +
        `💵 Harga Satuan: \`${formatCurrency(details.pricePerShare)}\`\n` +
        `💰 Pendapatan Kotor: \`${formatCurrency(details.rawRevenue)}\`\n` +
        `💸 Pajak Penjualan (5%): \`${formatCurrency(details.tax)}\`\n` +
        `💰 Koin Masuk: **${formatCurrency(details.finalRevenue)}**`
      );
    }

    return embed.setTimestamp();
  },

  // 7. Embed Leaderboard Terkaya
  leaderboardEmbed(guildName, leaderboard, client) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.DARK)
      .setTitle(`🏆 Papan Peringkat Orang Terkaya — ${guildName}`)
      .setDescription(`Daftar 10 konglomerat dengan total aset (Saldo + Nilai Saham) tertinggi.`);

    if (leaderboard.length === 0) {
      embed.addFields({ name: '🚫 Kosong', value: 'Belum ada data ekonomi untuk server ini.' });
    } else {
      let ranks = '';
      leaderboard.forEach((user, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `\`#${idx + 1}\``;
        const member = client.users.cache.get(user.userId);
        const name = member ? `**${member.username}**` : `<@${user.userId}>`;
        
        ranks += `${medal} ${name}\n` +
                 `ㅤㅤ💰 Saldo: \`${formatCurrency(user.balance)}\` | Aset Saham: \`${formatCurrency(user.portfolioValue)}\`\n` +
                 `ㅤㅤ💎 **Kekayaan Total: ${formatCurrency(user.totalWealth)}**\n\n`;
      });
      embed.setDescription(ranks);
    }

    return embed.setTimestamp();
  },

  // 8. Embed Error / Kegagalan Sistem
  errorEmbed(title, description) {
    const cleanedTitle = title.replace(/^❌\s*/, '').trim();
    const cleanedDesc = description ? description.replace(/^❌\s*/, '').trim() : '';
    return new EmbedBuilder()
      .setColor(COLORS.ERROR)
      .setTitle(`❌ ${cleanedTitle}`)
      .setDescription(cleanedDesc ? `> ${cleanedDesc}` : null)
      .setFooter({ text: 'Rupiah Server • Terjadi Kesalahan' })
      .setTimestamp();
  },

  // 9. Embed Peringatan / Validasi Input
  warnEmbed(title, description) {
    const cleanedTitle = title.replace(/^[❌⚠️]\s*/, '').trim();
    const cleanedDesc = description ? description.replace(/^[❌⚠️]\s*/, '').trim() : '';
    return new EmbedBuilder()
      .setColor(COLORS.WARN)
      .setTitle(`⚠️ ${cleanedTitle}`)
      .setDescription(cleanedDesc ? `> ${cleanedDesc}` : null)
      .setTimestamp();
  },

  // 10. Embed Sukses Umum
  successEmbed(title, description) {
    const cleanedTitle = title.replace(/^[✅🟢]\s*/, '').trim();
    const cleanedDesc = description ? description.replace(/^[✅🟢]\s*/, '').trim() : '';
    return new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle(`✅ ${cleanedTitle}`)
      .setDescription(cleanedDesc ? `> ${cleanedDesc}` : null)
      .setTimestamp();
  },

  // 11. Embed Akses Ditolak (Owner Only)
  accessDeniedEmbed(ownerId) {
    return new EmbedBuilder()
      .setColor(COLORS.ERROR)
      .setTitle('🚫 Akses Ditolak!')
      .setDescription(
        `Perintah administratif ini hanya dapat digunakan oleh pemilik khusus bot.\n\n` +
        `👑 **Owner ID:** \`${ownerId}\`\n\n` +
        `*Silakan hubungi administrator jika Anda memerlukan akses khusus.*`
      )
      .setFooter({ text: 'Rupiah Server • Proteksi Admin' })
      .setTimestamp();
  },

  // 12. Embed Katalog Toko Role (.shop)
  shopEmbed(items, wallet) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.PURPLE)
      .setTitle('🎮 TOKO ROLE DISCORD — RUPIAH SERVER KOSAN 1A')
      .setDescription(
        `Selamat datang di **Role Market**! Tukarkan koin **${config.CURRENCY_NAME}** Anda dengan role prestige yang bergengsi!\n\n` +
        `💵 **Saldo Anda:** **${formatCurrency(wallet.balance)}**\n` +
        `🎲 **Misteri Gacha:** Ketik \`.gacha-role\` seharga **Rp 1.000** untuk berkesempatan memenangkan role secara acak!`
      );

    const TIER_EMOJIS = {
      COMMON: '🟢',
      RARE: '🔵',
      EPIC: '🟣',
      LEGENDARY: '👑'
    };

    if (items.length === 0) {
      embed.addFields({ name: '🚫 Toko Kosong', value: 'Belum ada role yang dijual saat ini. Silakan hubungi admin!' });
    } else {
      // Kelompokkan item berdasarkan Tier
      const grouped = { LEGENDARY: [], EPIC: [], RARE: [], COMMON: [] };
      items.forEach(item => {
        const t = item.tier ? item.tier.toUpperCase() : 'COMMON';
        if (grouped[t]) grouped[t].push(item);
        else grouped.COMMON.push(item);
      });

      // Tampilkan berdasarkan urutan kelangkaan (Legendary teratas)
      ['LEGENDARY', 'EPIC', 'RARE', 'COMMON'].forEach(tierName => {
        const tierItems = grouped[tierName];
        if (tierItems.length > 0) {
          let content = '';
          tierItems.forEach(item => {
            const emoji = TIER_EMOJIS[tierName] || '🟢';
            
            // Format info stok
            let stockInfo = '`Tanpa Batas`';
            if (item.stock !== -1) {
              if (item.stock <= 0) {
                stockInfo = '🔴 **[ SOLD OUT ]**';
              } else {
                stockInfo = `⚠️ \`Sisa ${item.stock} slot\``;
              }
            }

            const gachaStatus = item.is_gacha ? ' 🎲 *Gacha Available*' : '';
            const desc = item.description ? `\n   *“${item.description}”*` : '';

            content += `🆔 **\`ID: ${item.id}\`** | **${item.role_name}**\n` +
                       `👉 Harga: **${formatCurrency(item.price)}** | Stok: ${stockInfo}${gachaStatus}${desc}\n\n`;
          });

          embed.addFields({
            name: `${TIER_EMOJIS[tierName]} === KLASIFIKASI ${tierName} ===`,
            value: content.trim(),
            inline: false
          });
        }
      });
    }

    embed.setFooter({ text: 'Beli role dengan ketik: .buy-role <ID> atau .shop-buy <ID>' }).setTimestamp();
    return embed;
  },

  // 13. Embed Sukses Pembelian Role (.buy-role)
  rolePurchaseSuccessEmbed(user, roleName, price, newBalance, tier) {
    const TIER_COLORS = {
      COMMON: COLORS.SUCCESS,
      RARE: COLORS.INFO,
      EPIC: COLORS.PURPLE,
      LEGENDARY: COLORS.WARN
    };

    const TIER_EMOJIS = {
      COMMON: '🟢',
      RARE: '🔵',
      EPIC: '🟣',
      LEGENDARY: '👑'
    };

    const tierColor = TIER_COLORS[tier] || COLORS.SUCCESS;
    const tierEmoji = TIER_EMOJIS[tier] || '🟢';

    return new EmbedBuilder()
      .setColor(tierColor)
      .setTitle(`${tierEmoji} PEMBELIAN ROLE BERHASIL!`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setDescription(
        `Selamat **${user.username}**! Transaksi penukaran koin berhasil diproses.\n\n` +
        `🎭 **Role Diperoleh:** **${roleName}**\n` +
        `🏷️ **Tingkat Kelangkaan:** \`${tierEmoji} ${tier}\`\n` +
        `💵 **Harga Penukaran:** **${formatCurrency(price)}**\n\n` +
        `📉 Koin Anda telah didebit secara otomatis. Sisa saldo dompet Anda sekarang adalah **${formatCurrency(newBalance)}**.`
      )
      .setFooter({ text: 'Role telah dipasangkan ke profil Discord Anda!' })
      .setTimestamp();
  },

  // 14. Embed Pengumuman Heboh Sultan (EPIC & LEGENDARY)
  broadcastMegaEmbed(user, roleName, price, tier) {
    const TIER_COLORS = {
      EPIC: COLORS.PURPLE,
      LEGENDARY: COLORS.WARN
    };

    const TIER_EMOJIS = {
      EPIC: '🟣',
      LEGENDARY: '👑'
    };

    const tierColor = TIER_COLORS[tier] || COLORS.PURPLE;
    const tierEmoji = TIER_EMOJIS[tier] || '👑';

    return new EmbedBuilder()
      .setColor(tierColor)
      .setTitle(`🚨 ${tierEmoji} ANGGOTA PRESTIGE BARU TELAH LAHIR! ${tierEmoji} 🚨`)
      .setDescription(
        `👑 **SULTAN SERVER BARU SAJA BERAKSI!**\n\n` +
        `Mari berikan penghormatan tinggi kepada <@${user.id}> yang telah menukarkan total **${formatCurrency(price)}** untuk mengklaim role bergengsi:\n\n` +
        `🌟 **${roleName}** (\`${tierEmoji} ${tier} CLASS\`)\n\n` +
        `*Aura kekayaan dan prestisenya kini terpancar di seluruh server! Hormati dia!* 🎉🚀`
      )
      .setFooter({ text: 'Rupiah Server • Prestige Broadcast' })
      .setTimestamp();
  },

  // 15. Embed Hasil Gacha Role Misteri (.gacha-role)
  gachaResultEmbed(user, item, price, newBalance, isWin) {
    const embed = new EmbedBuilder()
      .setThumbnail(user.displayAvatarURL({ dynamic: true }));

    const TIER_COLORS = {
      COMMON: COLORS.SUCCESS,
      RARE: COLORS.INFO,
      EPIC: COLORS.PURPLE,
      LEGENDARY: COLORS.WARN
    };

    const TIER_EMOJIS = {
      COMMON: '🟢',
      RARE: '🔵',
      EPIC: '🟣',
      LEGENDARY: '👑'
    };

    if (isWin && item) {
      const tierColor = TIER_COLORS[item.tier] || COLORS.SUCCESS;
      const tierEmoji = TIER_EMOJIS[item.tier] || '🟢';

      embed
        .setColor(tierColor)
        .setTitle(`🎰 GACHA BERHASIL! JACKPOT DI TANGAN! 🎰`)
        .setDescription(
          `**${user.username}** baru saja melakukan roll Gacha seharga **${formatCurrency(price)}**!\n\n` +
          `🎰 **HASIL ROLL:**\n` +
          `🌟 **${item.role_name}**\n` +
          `🏷️ **Kelangkaan:** \`${tierEmoji} ${item.tier}\`\n\n` +
          `*Keberuntungan berpihak padamu! Role ini telah ditambahkan secara otomatis ke profilmu!* 😎\n` +
          `📉 Sisa saldo Anda: **${formatCurrency(newBalance)}**`
        );
    } else {
      embed
        .setColor(COLORS.ERROR)
        .setTitle(`🎰 ROLLING GACHA... DAN AMSYONG! 🎰`)
        .setDescription(
          `**${user.username}** baru saja melakukan roll Gacha seharga **${formatCurrency(price)}**!\n\n` +
          `❌ **HASIL ROLL:**\n` +
          `**ZONK / MAAF!** Keberuntungan belum memihak padamu kali ini. Kamu mendapatkan ampas! 😭\n\n` +
          `*Jangan menyerah! Coba lagi dan kumpulkan koin saham lebih banyak untuk memutar gacha berikutnya!* 💪\n` +
          `📉 Sisa saldo Anda: **${formatCurrency(newBalance)}**`
        );
    }

    return embed.setTimestamp();
  }
};

