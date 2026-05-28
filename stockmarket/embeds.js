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

/**
 * Membuat grafik mini ASCII (sparkline) dari array harga saham histori.
 */
function generateSparkline(prices) {
  if (!prices || prices.length < 2) return '`[ ── ]` Belum ada riwayat';
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min;
  const chars = [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  
  const spark = prices.map(p => {
    if (range === 0) return chars[4]; // Garis datar jika stabil
    const idx = Math.floor(((p - min) / range) * (chars.length - 1));
    return chars[idx];
  }).join('');
  
  return `\`${spark}\` ( ${prices.map(p => `Rp ${p.toLocaleString('id-ID')}`).join(' ➔ ')} )`;
}

/**
 * Mengambil warna spesifik untuk role prestise agar warna embed (.shop-buy / .gacha-role)
 * selaras secara sempurna dengan gradasi role yang diperoleh.
 */
function getRoleColor(roleName, tier) {
  const ROLE_COLORS = {
    '🥉 Common Prestige': '#979c9f',
    '🥈 Rare Elite': '#3498db',
    '🔮 Primordial': '#70a1ff',
    '🥇 Epic Champion': '#5f27cd',
    '👑 Legendary Overlord': '#9b59b6',
    '🌟 Zenith': '#e84393',
    '🌟 Mythic Immortal': '#ff4757',
    '✨ Aethelgard': '#e67e22',
    '👑 The Sovereign': '#f1c40f'
  };

  const cleanName = roleName ? roleName.trim() : '';
  if (ROLE_COLORS[cleanName] !== undefined) {
    return ROLE_COLORS[cleanName];
  }

  // Fallback berdasarkan Tier jika kustom role di luar default
  const TIER_COLORS = {
    COMMON: '#979c9f',
    RARE: '#3498db',
    EPIC: '#5f27cd',
    LEGENDARY: '#9b59b6',
    MYTHIC: '#ff4757'
  };
  return TIER_COLORS[tier?.toUpperCase()] || '#00FF88';
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
      .setTitle(`📈 BURSA SAHAM SERVER — ${isMarketOpen ? '🟢 BUKA' : '🔴 TUTUP'}`)
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
        const trendIndicator = diff > 0 ? '🟢' : diff < 0 ? '🔴' : '⚪';
        const trendColor = diff > 0 ? '+' : '';
        
        embed.addFields({
          name: `🔹 **${stock.stock_ticker}** ( #${stock.stock_name} )`,
          value: 
            `\` Harga \` **${formatCurrency(stock.current_price)}** per lembar\n` +
            `\` Tren  \` ${trendIndicator} **${trendColor}${pct}%** (${trendEmoji}) | sisa \`${stock.available_shares}/${stock.total_shares}\` lembar`,
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
    let chartVisual = '`[ ── ]` Belum ada riwayat harga.';
    if (priceHistory && priceHistory.length > 0) {
      const prices = priceHistory.slice(-5).map(h => h.price);
      chartVisual = generateSparkline(prices);
    }

    return new EmbedBuilder()
      .setColor(diff >= 0 ? COLORS.SUCCESS : COLORS.ERROR)
      .setTitle(`📊 DETAIL SAHAM: ${stock.stock_ticker} — #${stock.stock_name}`)
      .addFields(
        { name: '💰 Harga Saat Ini', value: `**${formatCurrency(stock.current_price)}** /lembar`, inline: true },
        { name: '💵 Harga Sebelumnya', value: `\`${formatCurrency(stock.previous_price)}\``, inline: true },
        { name: '📉 Performa Hari Ini', value: `\`${trendEmoji} (${diff >= 0 ? '+' : ''}${pct}%)\``, inline: true },
        { name: '🏛️ Stok Pasar', value: `\`${stock.available_shares} / ${stock.total_shares} lembar\``, inline: true },
        { name: '🔥 Keaktifan Channel', value: `\`${stock.activity_score.toFixed(1)} poin\``, inline: true },
        { name: '📈 Tren Pergerakan Harga (5 Update Terakhir)', value: chartVisual, inline: false }
      )
      .setFooter({ text: 'Gunakan perintah .buy atau .sell untuk bertransaksi!' })
      .setTimestamp();
  },

  // 5. Embed Portofolio (.portfolio / .porto)
  portfolioEmbed(user, portfolio, wallet) {
    const totalWealth = wallet.balance + portfolio.totalPortfolioValue;
    const embed = new EmbedBuilder()
      .setColor(COLORS.PURPLE)
      .setTitle(`💼 PORTOFOLIO INVESTASI — ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setDescription(
        `💰 **Saldo Dompet**: **${formatCurrency(wallet.balance)}**\n` +
        `📊 **Valuasi Saham**: **${formatCurrency(portfolio.totalPortfolioValue)}**\n` +
        `💎 **Total Kekayaan**: **${formatCurrency(totalWealth)}**`
      );

    if (portfolio.items.length === 0) {
      embed.addFields({ name: '🚫 Portofolio Kosong', value: 'Anda belum memiliki aset saham channel apa pun.' });
    } else {
      portfolio.items.forEach(item => {
        const profitSign = item.profitRp >= 0 ? '+' : '';
        const profitPercentSign = item.profitRp >= 0 ? '📈' : '📉';
        const profitIndicator = item.profitRp >= 0 ? '🟢' : '🔴';
        
        embed.addFields({
          name: `💼 **${item.ticker}** ( #${item.name} )`,
          value:
            `\` Aset \` **${item.shares}** lembar (Rata-rata: ${formatCurrency(item.avgPrice)})\n` +
            `\` P L  \` ${profitIndicator} **${profitSign}${formatCurrency(item.profitRp)}** (${profitSign}${item.profitPercent}% ${profitPercentSign}) | Valuasi: \`${formatCurrency(item.currentValue)}\``,
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
      .setTitle(`🏆 PAPAN PERINGKAT ORANG TERKAYA — ${guildName}`)
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
                 `   💵 Dompet: \`${formatCurrency(user.balance)}\` | 📊 Saham: \`${formatCurrency(user.portfolioValue)}\`\n` +
                 `   💎 **Kekayaan Bersih: ${formatCurrency(user.totalWealth)}**\n\n`;
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
        `🎲 **Misteri Gacha (Hard Mode):** Ketik \`.gacha-role\` seharga **${formatCurrency(config.gacha.COST || 250)}** per roll!\n` +
        `⚠️ *Peluang menang penuh misteri dan kejutan. Jadilah Dewa Hoki berikutnya!*\n\n` +
        `📊 **Tingkat Peluang Jackpot (Rarity Rates):**\n` +
        `• 🟢 COMMON: \`70.0%\` | 🔵 RARE: \`22.0%\` | 🟣 EPIC: \`6.8%\`\n` +
        `• 👑 LEGENDARY: \`1.1%\` | 🌟 MYTHIC: \`0.1%\` *(Jackpot Dewa!)*\n` +
        `• 🗑️ ZONK: \`???\` *(Dapatkan item sampah kocak)*`
      );

    const TIER_EMOJIS = {
      COMMON: '🟢',
      RARE: '🔵',
      EPIC: '🟣',
      LEGENDARY: '👑',
      MYTHIC: '🌟'
    };

    if (items.length === 0) {
      embed.addFields({ name: '🚫 Toko Kosong', value: 'Belum ada role yang dijual saat ini. Silakan hubungi admin!' });
    } else {
      // Kelompokkan item berdasarkan Tier
      const grouped = { MYTHIC: [], LEGENDARY: [], EPIC: [], RARE: [], COMMON: [] };
      items.forEach(item => {
        const t = item.tier ? item.tier.toUpperCase() : 'COMMON';
        if (grouped[t]) grouped[t].push(item);
        else grouped.COMMON.push(item);
      });

      // Tampilkan berdasarkan urutan kelangkaan (Mythic teratas)
      ['MYTHIC', 'LEGENDARY', 'EPIC', 'RARE', 'COMMON'].forEach(tierName => {
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
    const TIER_EMOJIS = {
      COMMON: '🟢',
      RARE: '🔵',
      EPIC: '🟣',
      LEGENDARY: '👑',
      MYTHIC: '🌟'
    };

    const tierColor = getRoleColor(roleName, tier);
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
    const TIER_EMOJIS = {
      EPIC: '🟣',
      LEGENDARY: '👑',
      MYTHIC: '🌟'
    };

    const tierColor = getRoleColor(roleName, tier);
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

    const TIER_EMOJIS = {
      COMMON: '🟢',
      RARE: '🔵',
      EPIC: '🟣',
      LEGENDARY: '👑',
      MYTHIC: '🌟'
    };

    if (isWin && item) {
      const tierColor = getRoleColor(item.role_name, item.tier);
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
        .setTitle(`🎰 GACHA SELESAI... DAN AMSYONG! 🎰`)
        .setDescription(
          `**${user.username}** baru saja memutar Gacha seharga **${formatCurrency(price)}**!\n\n` +
          `❌ **HASIL ROLL (ZONK):**\n` +
          `**ZONK / AMPAS TOTAL!** Keberuntungan sama sekali belum memihak padamu. 😭\n\n` +
          `🗑️ **Item Diperoleh:** **${item ? item.name : 'Angin Kosong'}**\n` +
          `📝 **Lore / Deskripsi:** *“${item ? item.desc : 'Tidak ada apa-apa.'}”*\n\n` +
          `*Jangan berkecil hati! Kumpulkan koin chat dan coba hoki gacha Anda di putaran berikutnya!* 💪\n` +
          `📉 Sisa saldo Anda: **${formatCurrency(newBalance)}**`
        );
    }

    return embed.setTimestamp();
  },

  // 16. Embed Pengumuman Pembaruan Sistem Ekonomi (.eco-announce)
  updateAnnouncementEmbed(guild) {
    return new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle('📢 PEMBARUAN & PENYEIMBANGAN EKONOMI SERVER KOSAN 1A 🚀')
      .setThumbnail(guild.iconURL({ dynamic: true }) || null)
      .setDescription(
        `Halo Warga Kosan 1A! 🏠✨\n` +
        `Dalam upaya menciptakan ekosistem permainan yang lebih seru, adil, aman, dan seimbang bagi seluruh member, kami secara resmi merilis **Pembaruan Sistem Ekonomi & Keamanan Bot 2026**!\n\n` +
        `Berikut adalah rangkuman fitur baru dan pengamanan sistem yang telah aktif per hari ini:`
      )
      .addFields(
        {
          name: '🎲 1. REVOLUSI ADIL: GAME TRUTH OR DARE (ToD)',
          value: 
            `* **🛡️ Anti-AFK Juri (Judge Protection)**: Jika Juri yang terpilih pergi AFK atau telat memilih keputusan (60 detik), **Victim BEBAS DENDA Rp 10.000!**\n` +
            `* **⚖️ Juri Berputar (Rotational Challenger)**: Juri kini bergantian secara melingkar dan teratur dari pemain berikutnya yang aktif di VC. Semua mendapat giliran bertanya dan menilai secara adil!\n` +
            `* **🙋‍♂️ Gabung Tengah Game (Join Mid-game)**: Anggota baru yang masuk VC bisa langsung klik tombol **\`🙋‍♂️ Ikut Bermain\`** saat transisi putaran untuk ikut bermain.\n` +
            `* **💰 Penyeimbangan Koin ToD**:\n` +
            `  - Denda Skip/Menyerah: Diturunkan drastis dari Rp 10.000 menjadi **Rp 300**!\n` +
            `  - Hadiah Sukses: Dinaikkan dari Rp 35 menjadi **Rp 100**!`
        },
        {
          name: '🎙️ 2. PERLINDUNGAN ANTI-AFK FARMING (VOICE CHANNEL)',
          value:
            `* **🎚️ Proteksi Mute/Deafen**: Member yang melakukan **Mute** (selfMute/serverMute) atau **Deafen** di Voice Channel **tidak akan mendapatkan koin keaktifan**.\n` +
            `* **⏱️ Interval Diperlambat**: Pengecekan keaktifan kini dilakukan setiap **5 menit** (hanya **Rp 1 per 5 menit**).\n` +
            `* **📈 Batas Kuota Harian**: Maksimal koin Voice Earn dibatasi sangat ketat **Rp 25 per hari** per user untuk mencegah hiperinflasi saldo server.`
        },
        {
          name: '📈 3. BURSA SAHAM & TOKO ROLE (ANTI-MONOPOLI)',
          value:
            `* **🛑 Batas Saham (Share Cap)**: Mencegah investor kaya memonopoli bursa saham. Setiap user kini dibatasi maksimal memiliki **500 lembar saham per instrumen channel**.\n` +
            `* **🎰 Misteri Gacha Hard Mode**:\n` +
            `  - Putar gacha seharga **Rp 250** dengan **Zonk Rate 75%**! Sisa 25% kesempatan menang dibagi rata ke pool kelangkaan.\n` +
            `  - **Cashback Duplikat**: Jika memenangkan role yang sudah dimiliki, otomatis mendapatkan **cashback Rp 100**!`
        },
        {
          name: '📅 4. RESET HARIAN TEPAT WAKTU (WIB/UTC+7)',
          value:
            `* **⏰ Klaim Harian Seimbang**: Saldo koin harian diturunkan menjadi **Rp 15 - Rp 35** per hari dengan bonus streak **Rp 3** per hari untuk menjaga nilai koin tetap berharga.`
        },
        {
          name: '🎛️ 5. DASHBOARD TOMBOL INTERAKTIF & KOMENTATOR TTS',
          value:
            `* **💼 Tombol Navigasi Terbuka**: Di bawah bursa saham \`.market\` dan \`.shop\`, kini ada tombol-tombol interaktif publik untuk mengecek Portofolio, Profil, dan bertransaksi secara transparan di hadapan seluruh warga server!\n` +
            `* **🎙️ Komentator Suara TTS Heboh**: Bot akan bergabung ke Voice Channel Anda secara otomatis untuk memberikan komentar TTS heboh jika Anda membeli/menjual saham besar (>= 50 lembar) atau mendapatkan Zonk saat gacha role!`
        },
        {
          name: '👑 6. KASTA ROLE DEWA & PRESTIGE TOKO PREMIUM',
          value:
            `* **💎 5 Kasta Rarity Eksklusif**: Kami merilis role prestise khusus dengan perizinan premium & warna unik: Common (Rp 15.000), Rare (Rp 75.000), Epic (Rp 350.000), Legendary (Rp 1.500.000), dan kasta tertinggi **Mythic (Rp 5.000.000)**!\n` +
            `* **🔒 Peluang Jackpot Gacha Mythic**: Role Mythic kini dapat diperoleh lewat Gacha dengan peluang super langka (**0.1%** dari pool kemenangan), atau dibeli langsung secara terhormat!`
        },
        {
          name: '💬 7. DUKUNGAN ANTI-SPAM CHAT & PAJAK PENGAMAN EKSPLOIT',
          value:
            `* **🛡️ Pengetatan Koin Chatting**: Cooldown pesan dinaikkan menjadi **45 detik**, minimal pesan diperpanjang menjadi **3 kata & 10 karakter**, dan reward bernilai **Rp 1 - Rp 4 per pesan**.\n` +
            `* **🏦 Pajak Pengaman**: Pajak transfer koin antar member disesuaikan menjadi **10%** (anti-alt accounts) dan pajak penjualan saham channel disesuaikan menjadi **15%**.`
        }
      )
      .setFooter({ text: '— Tim Administrator & Developer Bot Kosan 1A 2026', iconURL: guild.iconURL({ dynamic: true }) || null })
      .setTimestamp();
  },

  // 17. Status Event Aktif (.event)
  eventStatusEmbed(activeEvent) {
    const embed = new EmbedBuilder();
    
    if (!activeEvent) {
      embed
        .setColor(COLORS.DARK)
        .setTitle('📅 Status Event Ekonomi')
        .setDescription('💤 **Tidak ada event ekonomi yang sedang aktif saat ini.**\n\nSeluruh roda perekonomian server berjalan normal. Pantau terus bursa saham secara berkala agar tidak ketinggalan event acak berikutnya!')
        .setFooter({ text: 'Tip: Event acak seperti Market Crash, Bull Run, dan Double Earning Hour muncul otomatis!' });
    } else {
      let title = '';
      let desc = '';
      let color = COLORS.INFO;
      let fields = [];

      if (activeEvent.type === 'DOUBLE_EARNING') {
        title = '💰 EVENT AKTIF: DOUBLE EARNING HOUR!';
        desc = '⚡ **Waktunya panen koin!** Keaktifan mengobrol di seluruh channel text server sedang mendapatkan booster spesial.';
        color = COLORS.PURPLE;
        fields.push({
          name: '✨ Efek Event',
          value: `🔥 Setiap koin **${config.CURRENCY_NAME}** yang kamu dapatkan dari mengirim pesan (chatting) bernilai **2 KALI LIPAT**!`
        });
      } else {
        title = `📅 EVENT AKTIF: ${activeEvent.type}`;
        desc = 'Sedang berlangsung event ekonomi di server.';
        color = COLORS.INFO;
      }

      fields.push({
        name: '🕒 Sisa Durasi',
        value: `Event berakhir pada: <t:${activeEvent.endsAt}:F> (<t:${activeEvent.endsAt}:R>)`
      });

      embed
        .setColor(color)
        .setTitle(title)
        .setDescription(desc)
        .addFields(fields)
        .setFooter({ text: 'Gunakan .event untuk memantau status terbaru.' })
        .setTimestamp();
    }
    
    return embed;
  },

  // 18. Embed Status Kepemilikan Role / Index Role (.indexrole)
  indexRoleEmbed(user, member, items) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.PURPLE)
      .setTitle(`🎖️ KARTU INDEX ROLE PRESTISE — ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setDescription(
        `Halo **${user.username}**! 👋✨\n` +
        `Berikut adalah daftar kasta/prestige role eksklusif di server ini dan status kepemilikan Anda.\n\n` +
        `💡 *Miliki role prestise dengan membelinya di \`.shop\` atau memutar spin hoki \`.gacha-role\`!*`
      );

    const TIER_EMOJIS = {
      COMMON: '🟢',
      RARE: '🔵',
      EPIC: '🟣',
      LEGENDARY: '👑',
      MYTHIC: '🌟'
    };

    if (items.length === 0) {
      embed.addFields({ name: '🚫 Tidak Ada Item Role', value: 'Belum ada role prestise yang dikonfigurasi di server ini.' });
    } else {
      // Kelompokkan item berdasarkan Tier
      const grouped = { MYTHIC: [], LEGENDARY: [], EPIC: [], RARE: [], COMMON: [] };
      items.forEach(item => {
        const t = item.tier ? item.tier.toUpperCase() : 'COMMON';
        if (grouped[t]) grouped[t].push(item);
        else grouped.COMMON.push(item);
      });

      let totalRoles = items.length;
      let ownedCount = 0;

      // Hitung dan kumpulkan data tier
      const fieldsData = [];
      ['MYTHIC', 'LEGENDARY', 'EPIC', 'RARE', 'COMMON'].forEach(tierName => {
        const tierItems = grouped[tierName];
        if (tierItems.length > 0) {
          let content = '';
          tierItems.forEach(item => {
            const hasRole = member.roles.cache.has(item.role_id);
            const statusEmoji = hasRole ? '✅ **[DIMILIKI]**' : '🔒 *Belum dimiliki*';
            if (hasRole) ownedCount++;

            const desc = item.description ? `\n   *“${item.description}”*` : '';
            content += `• **${item.role_name}** ${statusEmoji}${desc}\n`;
          });

          fieldsData.push({
            name: `${TIER_EMOJIS[tierName]} === KLASIFIKASI ${tierName} ===`,
            value: content.trim(),
            inline: false
          });
        }
      });

      // Progress bar / Ringkasan
      const percent = Math.round((ownedCount / totalRoles) * 100);
      const filledBlocks = Math.round(percent / 10);
      const emptyBlocks = 10 - filledBlocks;
      const progressBar = '🟩'.repeat(filledBlocks) + '⬛'.repeat(emptyBlocks);

      embed.addFields({
        name: '📊 RINGKASAN KOLEKSI ROLE PRESTISE',
        value: 
          `🏆 **Progres Koleksi:** \`${ownedCount} / ${totalRoles} Role\` (${percent}%)\n` +
          `✨ **Progress Bar:** [ ${progressBar} ]`
      });

      // Tambahkan fields dari tiers
      embed.addFields(fieldsData);
    }

    embed.setFooter({ text: 'Cek saldo Anda dengan .bal | Belanja role dengan .shop' }).setTimestamp();
    return embed;
  }
};

