const { EmbedBuilder } = require('discord.js');
const config = require('./config');
const { PET_ITEMS } = require('./pet');

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
 * Membuat grafik 2D ASCII (grid teks) dari array harga saham histori.
 */
function generate2DChart(prices) {
  if (!prices || prices.length < 2) return '`[ ── ]` Belum cukup riwayat harga untuk membuat grafik.';
  
  const height = 5; // Baris grid Y (0 s/d 4)
  const width = prices.length;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min;

  // grid: 5 baris, width kolom, diisi dengan spasi kosong
  const grid = Array(height).fill(null).map(() => Array(width).fill('   '));

  prices.forEach((price, x) => {
    // Normalisasi harga ke rentang baris (0 s/d height - 1)
    let y = range === 0 ? 2 : Math.round(((price - min) / range) * (height - 1));
    // Balik koordinat Y karena baris index 0 adalah bagian atas grafik
    y = (height - 1) - y;

    // Tentukan simbol penanda tren berdasarkan perbandingan dengan harga sebelumnya
    let symbol = ' ■ '; // default stabil / awal
    if (x > 0) {
      if (prices[x] > prices[x - 1]) {
        symbol = ' ▲ ';
      } else if (prices[x] < prices[x - 1]) {
        symbol = ' ▼ ';
      }
    } else {
      symbol = ' • '; // Titik awal pertama
    }

    grid[y][x] = symbol;
  });

  // Gabungkan grid menjadi string dengan label sumbu Y di sebelah kiri
  let chartStr = '';
  for (let y = 0; y < height; y++) {
    // Hitung estimasi harga pada baris Y ini untuk label sumbu Y
    const rowVal = range === 0 ? min : max - (y * (range / (height - 1)));
    const formattedPrice = `Rp ${Math.round(rowVal).toLocaleString('id-ID')}`;
    const paddedLabel = formattedPrice.padEnd(8, ' ');

    chartStr += `${paddedLabel} | ${grid[y].join('')}\n`;
  }

  // Tambahkan garis sumbu X di bagian bawah
  chartStr += '         └' + '───'.repeat(width) + '\n';
  chartStr += '          ';
  for (let x = 0; x < width; x++) {
    chartStr += `T-${width - 1 - x}`.padEnd(3, ' ');
  }

  return `\`\`\`text\n${chartStr}\n\`\`\``;
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
  profileEmbed(user, wallet, portfolioValue, member = null, shopItems = []) {
    const totalWealth = wallet.balance + portfolioValue;
    const embed = new EmbedBuilder()
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
      );

    // Tambahkan info kasta role prestise yang dimiliki
    if (member && shopItems && shopItems.length > 0) {
      const TIER_EMOJIS = {
        COMMON: '🟢',
        RARE: '🔵',
        EPIC: '🟣',
        LEGENDARY: '👑',
        MYTHIC: '🌟'
      };

      const ownedPrestigeRoles = [];
      shopItems.forEach(item => {
        if (member.roles.cache.has(item.role_id)) {
          const emoji = TIER_EMOJIS[item.tier?.toUpperCase()] || '🟢';
          ownedPrestigeRoles.push(`${emoji} **${item.role_name}**`);
        }
      });

      if (ownedPrestigeRoles.length > 0) {
        embed.addFields({
          name: `🎭 Koleksi Role Prestise (${ownedPrestigeRoles.length} / ${shopItems.length})`,
          value: ownedPrestigeRoles.join('\n'),
          inline: false
        });
      } else {
        embed.addFields({
          name: '🎭 Koleksi Role Prestise (0)',
          value: '*Belum memiliki kasta role prestise. Beli di `.shop` atau coba peruntungan di `.gacha-role`!*',
          inline: false
        });
      }
    } else if (member) {
      embed.addFields({
        name: '🎭 Koleksi Role Prestise (0)',
        value: '*Tidak ada kasta role prestise terdaftar di server ini.*',
        inline: false
      });
    }

    embed.setFooter({ text: 'Ketik .daily untuk klaim koin harian!' })
      .setTimestamp();

    return embed;
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
    
    // Bikin representasi visual chart 2D dari history harga (maksimal 10)
    let chartVisual = '`[ ── ]` Belum ada riwayat harga.';
    if (priceHistory && priceHistory.length > 0) {
      const prices = priceHistory.map(h => h.price);
      chartVisual = generate2DChart(prices);
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
        { name: '📈 Tren Pergerakan Harga (10 Pembaruan Terakhir)', value: chartVisual, inline: false }
      )
      .setFooter({ text: 'Gunakan tombol di bawah ini untuk bertransaksi atau menyegarkan!' })
      .setTimestamp();
  },

  // 4a. Embed Grafik Saham Premium 2D ASCII (.chart $TICKER)
  stockChartEmbed(stock, priceHistory, client) {
    const diff = stock.current_price - stock.previous_price;
    
    // Ambil harga dari histori (maksimal 10)
    let prices = [];
    if (priceHistory && priceHistory.length > 0) {
      prices = priceHistory.map(h => h.price);
    } else {
      prices = [stock.current_price];
    }
    
    // Hitung performa chart (dari titik terlama ke terbaru)
    let chartPerformanceText = '`0.0%` (Stabil)';
    let chartColor = COLORS.WARN;
    if (prices.length >= 2) {
      const firstPrice = prices[0];
      const lastPrice = prices[prices.length - 1];
      const chartDiff = lastPrice - firstPrice;
      const chartPct = firstPrice > 0 ? ((chartDiff / firstPrice) * 100).toFixed(1) : '0.0';
      const pctSign = chartDiff >= 0 ? '+' : '';
      const trendEmoji = chartDiff > 0 ? '🟢' : chartDiff < 0 ? '🔴' : '🟡';
      chartPerformanceText = `\`${pctSign}${chartPct}%\` (${trendEmoji})`;
      
      chartColor = chartDiff > 0 ? COLORS.SUCCESS : chartDiff < 0 ? COLORS.ERROR : COLORS.WARN;
    } else {
      chartColor = diff > 0 ? COLORS.SUCCESS : diff < 0 ? COLORS.ERROR : COLORS.WARN;
    }
    
    const chartVisual = generate2DChart(prices);
    
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const highPrice = Math.max(...prices);
    const lowPrice = Math.min(...prices);

    return new EmbedBuilder()
      .setColor(chartColor)
      .setTitle(`📈 GRAFIK BURSA: ${stock.stock_ticker} — #${stock.stock_name}`)
      .setDescription(
        `Investasikan koin **${config.CURRENCY_NAME}** Anda ke channel server teraktif!\n` +
        `Berikut adalah grafik tren fluktuasi harga **${stock.stock_ticker}**:`
      )
      .addFields(
        { name: '📊 Sumbu Grafik 2D ASCII', value: chartVisual, inline: false },
        { name: '💰 Harga Saat Ini', value: `**${formatCurrency(stock.current_price)}**`, inline: true },
        { name: '📈 Performa Grafik', value: chartPerformanceText, inline: true },
        { name: '🏛️ Sisa Bursa', value: `\`${stock.available_shares} / ${stock.total_shares} lembar\``, inline: true },
        { name: '📈 Statistik Grafik (Range)', value: 
          `• Tertinggi (High): \`${formatCurrency(highPrice)}\`\n` +
          `• Terendah (Low): \`${formatCurrency(lowPrice)}\`\n` +
          `• Rata-rata (Avg): \`${formatCurrency(Math.round(avgPrice))}\``, 
          inline: false 
        }
      )
      .setFooter({ text: 'Gunakan tombol di bawah ini untuk bertransaksi atau menyegarkan grafik!' })
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
  // 16. Embed Pengumuman Pembaruan Sistem Ekonomi (.eco-announce)
  updateAnnouncementEmbed(guild) {
    return new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle('📢 PUSAT KONTROL & BUKU PANDUAN LENGKAP SENTINEL BOT 2026 🏠🚀')
      .setThumbnail(guild.iconURL({ dynamic: true }) || null)
      .setDescription(
        `Halo Warga Kosan 1A! 👋✨\n` +
        `Dalam rangka rilisnya fitur **Simulasi Sewa Kamar & Upgrade Kosan**, berikut adalah buku panduan lengkap serta seluruh daftar perintah (*commands*) yang aktif penuh pada bot kita hari ini:`
      )
      .addFields(
        {
          name: '🎙️ 1. KEAMANAN VOICE & GOOGLE TTS',
          value:
            `👉 **\`.join\`** / **\`/join\`** - Bot gabung & mengunci VC Anda (Auto-Rejoin jika dc) + menyapa otomatis.\n` +
            `👉 **\`.leave\`** / **\`/leave\`** - Membuka kunci VC & menyuruh bot keluar secara bersih.\n` +
            `👉 **\`.speak <teks>\`** / **\`.speak en <teks>\`** - Mengucapkan teks suara di VC.\n` +
            `👉 **\`.status\`** - Status realtime koneksi, RAM VPS, & uptime bot.`
        },
        {
          name: '💸 2. EKONOMI PASIF "RUPIAH SERVER"',
          value:
            `• **Chatting** : Dapat **Rp 1-4** secara pasif per pesan di text channel (cooldown 45s).\n` +
            `• **Gaji Otomatis** : Hadiah harian **Rp 15-35** + streak dicairkan otomatis di chat pertama Anda!\n` +
            `👉 **\`.bal\`** / **\`.profile\`** - Cek saldo dompet, portofolio bursa, & kasta role prestise.\n` +
            `👉 **\`.transfer @user <jumlah>\`** - Kirim koin instan ke warga lain (pajak transfer 10%).\n` +
            `👉 **\`.rich\`** / **\`.leaderboard\`** - Papan peringkat 10 warga terkaya.`
        },
        {
          name: '📈 3. BURSA SAHAM KOSAN INTERAKTIF',
          value:
            `• **Saham Dinamis** : Channel teks terdaftar sebagai saham. Harga fluktuatif tiap 2 jam berbasis chat!\n` +
            `👉 **\`.market\`** / **\`.saham\`** - Membuka dashboard bursa saham & panel transaksi privat.\n` +
            `👉 **\`.stock <ticker>\`** / **\`.chart <ticker>\`** - Grafik 2D ASCII & tombol instan Beli/Jual/Refresh.\n` +
            `👉 **\`.buy\`** / **\`.sell\`** / **\`.sellall\`** - Jual beli saham bursa (kepemilikan maks 500 lembar).\n` +
            `👉 **\`.porto\`** / **\`.portfolio\`** - Detail aset investasi, harga rata-rata beli, & profit/loss real-time.\n` +
            `• **Weekly Dividen** : Dividen cair otomatis ke dompet tiap Minggu malam pukul 21:00 WIB.`
        },
        {
          name: '🤖 4. AUTO-TRADING AI & TOKO ROLE',
          value:
            `👉 **\`.autotrade\`** - Nyalakan asisten Robot Trading AI (Auto DCA & Auto Take-Profit untung >= 15%).\n` +
            `👉 **\`.shop\`** / **\`.rolemarket\`** - Etalase belanja kasta role prestise dengan koin Rp.\n` +
            `👉 **\`.gacha-role\`** - Spin gacha role seharga **Rp 250** (Cashback Rp 100 jika duplikat, dapet sampah lucu jika zonk).\n` +
            `👉 **\`.indexrole\`** - Indeks koleksi role, progress bar, & status level sosial kosan.`
        },
        {
          name: '🏛️ 5. CENTRAL BANK & PERBANKAN POP-UP',
          value:
            `👉 **\`.bank\`** - Membuka panel kontrol bank interaktif berbasis tombol & formulir pop-up.\n` +
            `• **Tabungan** : Simpan koin di brankas dengan **Bunga Pasif +1.5% Setiap Hari**!\n` +
            `• **Pinjaman** : Pinjam koin tenor 1/3/7 hari dengan limit dinamis. Auto-debet saat jatuh tempo atau sanksi denda 5% + beku gaji + notice merah publik.`
        },
        {
          name: '🛌 6. SIMULASI SEWA KAMAR & UPGRADE KOSAN [NEW!]',
          value:
            `👉 **\`.kos\`** / **\`.kosan\`** - Dashboard hunian, sisa durasi sewa, pasif buffs, & furniture.\n` +
            `👉 **\`.kos-sewa\`** - Sewa kamar 3 hari (Kipas: daily +5 Rp | AC: daily +15 Rp & pajak transfer 8% | Penthouse: daily +40 Rp, pajak transfer 5% & pajak jual saham 10%).\n` +
            `👉 **\`.kos-upgrade\`** - Belanja furniture permanen (Kasur: streak daily multiplier | WiFi: limit voice harian Rp 35 | Dispenser: 10% peluang koin chat ganda + reaksi \`🥤\` | Gembok: limit pinjaman bank +150 Rp).`
        },
        {
          name: '🎲 7. GAME VOICE TRUTH OR DARE',
          value:
            `👉 **\`.tod\`** / **\`.truthordare\`** - Sesi lobi game Truth or Dare bahasa Indonesia di Voice Channel.\n` +
            `👉 **\`.tod status\`** - Statistik koin & pencapaian bermain ToD Anda.`
        }
      )
      .setFooter({ text: '— Tim Developer & Sentinel Bot Kosan 1A 2026', iconURL: guild.iconURL({ dynamic: true }) || null })
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
      .setTitle(`🎖️ KARTU INDEKS ROLE PRESTISE — ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setDescription(
        `Halo **${user.username}**! 👋✨\n` +
        `Berikut adalah daftar kasta/prestige role eksklusif di server ini dan status perolehan Anda.\n\n` +
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
            
            // Funny Indonesian customized ownership tags
            const statusEmoji = hasRole 
              ? '✅ **[DIMILIKI]** (Sultan Mode: **ON** 😎)' 
              : '🔒 *Belum dimiliki* (Menanti Hoki Gacha / Rp ' + item.price.toLocaleString('id-ID') + ')';
            
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

      // Funny status classification depending on percentage owned
      let statusRemark = '';
      if (percent === 0) {
        statusRemark = '😭 **AMPAS TOTAL / BEBAN SERVER**\n*Belum punya kasta role sama sekali. Ayo ngobrol atau gacha biar gak dikira pajangan server!*';
      } else if (percent <= 25) {
        statusRemark = '🐣 **ANAK BAWANG**\n*Baru punya secuil kasta role. Masih jauh dari kasta sultan, tapi bolehlah buat gaya dikit!*';
      } else if (percent <= 50) {
        statusRemark = '😎 **SULTAN TANGGUNG**\n*Koleksi lumayan, dompet mulai bergetar. Dikit lagi bisa sombong di Voice Channel!*';
      } else if (percent <= 80) {
        statusRemark = '🔥 **SETENGAH DEWA / PEJUANG HOKI**\n*Aura prestisenya sudah mulai menyilaukan mata warga server Kosan 1A!*';
      } else if (percent < 100) {
        statusRemark = '🌟 **DEWA DEKAT DI MATA**\n*Kurang secuil lagi untuk mencapai kesempurnaan tahta absolut!*';
      } else {
        statusRemark = '👑 **MAHARAJA SULTAN PRESTISE (HURRY UP AND BOW! 🙇‍♂️)**\n*GILA SIH! Semua kasta role disapu bersih! Anda resmi menjadi makhluk terkaya Kosan 1A!*';
      }

      embed.addFields({
        name: '📊 RINGKASAN KOLEKSI ROLE PRESTISE',
        value: 
          `🏆 **Progres Koleksi:** \`${ownedCount} / ${totalRoles} Role\` (${percent}%)\n` +
          `✨ **Progress Bar:** [ ${progressBar} ]\n` +
          `🎭 **Kasta Kelayakan:** ${statusRemark}`
      });

      // Tambahkan fields dari tiers
      embed.addFields(fieldsData);
    }

    // Funny random tip/quotes in footer
    const funnyTips = [
      'Tips Hoki: Mandi dulu sebelum ketik .gacha-role biar gak dapat Batu Kali!',
      'Fakta: 99% penjudi gacha berhenti tepat sebelum mereka dapet Jackpot Mythic!',
      'Jangan lupa sungkem dulu ke Owner jika melihat seseorang membawa kasta Mythic!',
      'Uang bisa dicari, tapi role prestige Kosan 1A hanya milik mereka yang terpilih!',
      'Apakah dompet Anda sudah menangis? Tenang, koin chatting gratis mengalir deras!',
      'Peringatan: Pamer kasta role berlebihan dapat menyebabkan kecemburuan sosial tingkat tinggi!'
    ];
    const randomTip = funnyTips[Math.floor(Math.random() * funnyTips.length)];

    embed.setFooter({ text: `💡 ${randomTip}` }).setTimestamp();
    return embed;
  },

  // 19. Embed Dashboard Utama Bank
  bankDashboardEmbed(user, wallet, savings, activeLoan, maxLimit) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.PURPLE)
      .setTitle(`🏛️ RUPIAH SERVER CENTRAL BANK — [Kosan 1A]`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setDescription(
        `Halo **${user.username}**! 👋\n` +
        `Kelola tabungan berbunga dan pinjaman darurat Anda dengan aman dan mudah!`
      )
      .addFields(
        { 
          name: '💵 Dompet Utama', 
          value: `**${formatCurrency(wallet.balance)}**`, 
          inline: true 
        },
        { 
          name: '🏦 Saldo Tabungan', 
          value: `**${formatCurrency(savings.balance)}**\n*📈 Bunga: +1.5% / hari*`, 
          inline: true 
        }
      );

    if (activeLoan) {
      const isOverdue = activeLoan.status === 'OVERDUE';
      const statusEmoji = isOverdue ? '🔴 OVERDUE (Jatuh Tempo)' : '⏳ ACTIVE (Berjalan)';
      const dueText = `<t:${activeLoan.due_at}:F> (<t:${activeLoan.due_at}:R>)`;
      
      let debtDetails = 
        `• Pokok Pinjaman: \`${formatCurrency(activeLoan.principal_amount)}\`\n` +
        `• Tenor Pilihan : \`${activeLoan.tenor_days} Hari\`\n` +
        `• Batas Waktu   : ${dueText}\n` +
        `• Bunga Kontrak : \`${(activeLoan.interest_rate * 100).toFixed(0)}%\`\n` +
        `• Total Tagihan : **${formatCurrency(activeLoan.total_due)}**`;

      if (activeLoan.penalty_accumulated > 0) {
        debtDetails += `\n• ⚠️ Denda Akumulasi: **${formatCurrency(activeLoan.penalty_accumulated)}** (+5% / hari)`;
      }

      embed.addFields({
        name: `🚨 Status Pinjaman: ${statusEmoji}`,
        value: debtDetails,
        inline: false
      });

      if (isOverdue) {
        embed.setColor(COLORS.ERROR);
      } else {
        embed.setColor(COLORS.WARN);
      }
    } else {
      embed.addFields({
        name: '📜 Status Pinjaman: 🟢 BERSIH',
        value: '*Anda tidak memiliki pinjaman aktif. Butuh modal darurat? Ajukan pinjaman di bawah!*',
        inline: false
      });
    }

    embed.addFields({
      name: '📈 Limit Pinjaman Maksimalmu',
      value: `**${formatCurrency(maxLimit)}**\n*(Limit naik seiring tingginya keaktifan chat & streak harian)*`,
      inline: false
    });

    embed.setFooter({ text: 'Rupiah Server Bank • Klik tombol di bawah ini!' })
      .setTimestamp();

    return embed;
  },

  // 20. Embed Sukses Bank Umum
  bankSuccessEmbed(title, description) {
    const cleanedTitle = title.replace(/^[✅🟢]\s*/, '').trim();
    const cleanedDesc = description ? description.replace(/^[✅🟢]\s*/, '').trim() : '';
    return new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle(`✅ ${cleanedTitle}`)
      .setDescription(cleanedDesc ? `> ${cleanedDesc}` : null)
      .setTimestamp();
  },

  // 21. Embed Gagal/Error Bank Umum
  bankErrorEmbed(title, description) {
    const cleanedTitle = title.replace(/^❌\s*/, '').trim();
    const cleanedDesc = description ? description.replace(/^❌\s*/, '').trim() : '';
    return new EmbedBuilder()
      .setColor(COLORS.ERROR)
      .setTitle(`❌ ${cleanedTitle}`)
      .setDescription(cleanedDesc ? `> ${cleanedDesc}` : null)
      .setTimestamp();
  },

  // 22. Embed Tagihan Publik Jatuh Tempo (Overdue Notice)
  bankOverdueNoticeEmbed(user, loan) {
    const dueTime = `<t:${loan.due_at}:F> (<t:${loan.due_at}:R>)`;
    const totalTunggakan = loan.total_due + (loan.penalty_accumulated || 0);

    return new EmbedBuilder()
      .setColor(COLORS.ERROR)
      .setTitle(`🚨 PEMBERITAHUAN JATUH TEMPO: SEGERA BAYAR UTANGMU!`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setDescription(
        `⚠️ **PERHATIAN WARGA SERVER KOSAN 1A!**\n` +
        `Pinjaman milik <@${user.id}> telah melewati batas pelunasan dan gagal dilakukan Auto-Debet karena saldo dompet tidak mencukupi!\n\n` +
        `💸 **Pokok Pinjaman:** \`${formatCurrency(loan.principal_amount)}\`\n` +
        `🕒 **Batas Jatuh Tempo:** ${dueTime}\n` +
        `⚠️ **Denda Keterlambatan:** \`${formatCurrency(loan.penalty_accumulated)}\` *(+5% per hari berjalan)*\n` +
        `💳 **Total Tunggakan:** **${formatCurrency(totalTunggakan)}**\n\n` +
        `🚫 **SANKSI SOSIAL & EKONOMI AKTIF:**\n` +
        `• Hadiah harian \`.daily\` Anda **DIBEKUKAN**!\n` +
        `• Robot trading \`.autotrade\` Anda **DINONAKTIFKAN**!\n\n` +
        `*Segera kumpulkan koin chat, ketik \`.bank\` dan klik tombol [Bayar Utang] untuk melepas sanksi!*`
      )
      .setFooter({ text: 'Kosan 1A Perbankan • Teguran Resmi' })
      .setTimestamp();
  },

  // 23. Embed Dashboard Kosan Pribadi (.kos)
  kosDashboardEmbed(user, wallet, activeRental, upgrades) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.PURPLE)
      .setTitle(`🏠 PANEL KONTROL KAMAR KOSAN — ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setDescription(
        `Selamat datang di kamarmu! Di sini kamu bisa mengatur hunian kosan dan memantau aset fasilitas yang dimiliki.\n\n` +
        `💵 **Saldo Dompet:** **${formatCurrency(wallet.balance)}**`
      );

    // Rincian Kamar Aktif
    if (activeRental) {
      const dueText = `<t:${activeRental.ends_at}:F> (<t:${activeRental.ends_at}:R>)`;
      let buffs = `• 🌅 Gaji Harian: **+${formatCurrency(activeRental.config.dailyBonus)}** /hari\n`;
      if (activeRental.config.transferTax !== undefined) {
        buffs += `• 💸 Pajak Transfer: **${activeRental.config.transferTax}%** (normal 10%)\n`;
      }
      if (activeRental.config.tradeTax !== undefined) {
        buffs += `• 📉 Pajak Jual Saham: **${activeRental.config.tradeTax}%** (normal 15%)\n`;
      }

      embed.addFields({
        name: `🛌 Hunian Aktif: ${activeRental.name}`,
        value: 
          `> *“${activeRental.config.desc}”*\n\n` +
          `🕒 **Habis Sewa:** ${dueText}\n` +
          `📈 **Efek Passive Buffs:**\n${buffs}`,
        inline: false
      });
    } else {
      embed.addFields({
        name: '🛌 Hunian Aktif: 🧹 Tidur di Teras Kosan',
        value: 
          `*“Gelar tikar tipis di emperan kosan, ditemani nyamuk komplek dan angin malam yang menusuk tulang.”*\n\n` +
          `⚠️ **Sanksi Sosial:** Kamu tidak mendapatkan bonus daily tambahan apa pun.\n` +
          `👉 *Sewa kamarmu sekarang dengan mengetik \`.kos-sewa\`!*`,
        inline: false
      });
    }

    // Rincian Fasilitas Kamar
    if (upgrades && upgrades.length > 0) {
      let upgradesText = '';
      upgrades.forEach(u => {
        upgradesText += `• **${u.name}**\n  *Efek: ${u.config.desc}*\n\n`;
      });

      embed.addFields({
        name: `🪟 Fasilitas Kamar Terpasang (${upgrades.length})`,
        value: upgradesText.trim(),
        inline: false
      });
    } else {
      embed.addFields({
        name: '🪟 Fasilitas Kamar Terpasang (0)',
        value: `*Kosong melompong. Hanya ada jemuran basah sisa kemarin gantung di pojokan.*\n\n👉 *Belanja perlengkapan kamarmu sekarang dengan mengetik \`.kos-upgrade\`!*`,
        inline: false
      });
    }

    embed.setFooter({ text: 'Sentinel Kosan System 1A • Kelola kosanmu!' })
      .setTimestamp();

    return embed;
  },

  // 24. Embed Daftar Kamar Persewaan (.kos-sewa)
  kosRoomListEmbed(currentRental) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle('🛎️ REKAPITULASI SEWA KAMAR KOSAN 1A')
      .setDescription(
        `Silakan sewa kamar di bawah ini untuk memperoleh bonus harian & potongan pajak!\n` +
        `*Durasi sewa per transaksi adalah 3 hari.*`
      );

    const rooms = config.kos.ROOMS;
    Object.keys(rooms).forEach(key => {
      const room = rooms[key];
      let details = 
        `• Biaya Sewa: **${formatCurrency(room.price)}** / 3 hari\n` +
        `• Bonus Gaji Harian: **+${formatCurrency(room.dailyBonus)}** /hari\n`;
      
      if (room.transferTax !== undefined) {
        details += `• Potongan Pajak Transfer: menjadi **${room.transferTax}%** *(normal 10%)*\n`;
      }
      if (room.tradeTax !== undefined) {
        details += `• Potongan Pajak Jual Saham: menjadi **${room.tradeTax}%** *(normal 15%)*\n`;
      }

      embed.addFields({
        name: `${room.name}`,
        value: `*“${room.desc}”*\n${details}`,
        inline: false
      });
    });

    if (currentRental) {
      embed.addFields({
        name: '🛌 Status Sewa Aktif Anda',
        value: `Anda saat ini sedang menyewa **${currentRental.name}** s/d <t:${currentRental.ends_at}:F> (<t:${currentRental.ends_at}:R>).`,
        inline: false
      });
    } else {
      embed.addFields({
        name: '🛌 Status Sewa Aktif Anda',
        value: 'Belum menyewa kamar (Tidur di teras kosan 🧹).',
        inline: false
      });
    }

    embed.setFooter({ text: 'Pilih kamar melalui tombol menu di bawah untuk transaksi!' })
      .setTimestamp();

    return embed;
  },

  // 25. Embed Katalog Upgrade Fasilitas Kosan (.kos-upgrade)
  kosUpgradeListEmbed(ownedUpgrades) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle('🛒 BELANJA FURNITURE & FASILITAS KAMAR KOSAN')
      .setDescription(
        `Beli perlengkapan kamar permanen untuk memperkuat perolehan ekonomi Rupiah Anda!\n` +
        `*Semua upgrade bersifat PERMANEN dan tidak perlu disewa ulang.*`
      );

    const upgrades = config.kos.UPGRADES;
    Object.keys(upgrades).forEach(key => {
      const up = upgrades[key];
      const isOwned = ownedUpgrades.some(o => o.id === up.id);
      const statusText = isOwned ? '🟢 **[ SUDAH DIMILIKI ]**' : `🛒 Harga Beli: **${formatCurrency(up.price)}**`;

      embed.addFields({
        name: `${up.name}`,
        value: `*“${up.desc}”*\n👉 ${statusText}`,
        inline: false
      });
    });

    embed.setFooter({ text: 'Pilih fasilitas melalui tombol menu di bawah untuk bertransaksi!' })
      .setTimestamp();

    return embed;
  },

  // 26. Embed Struk Pembayaran Sukses
  kosSuccessReceiptEmbed(title, description) {
    return new EmbedBuilder()
      .setColor(COLORS.SUCCESS)
      .setTitle(`✅ ${title}`)
      .setDescription(description ? `> ${description}` : null)
      .setFooter({ text: 'Rupiah Server Kosan 1A • Struk Pembayaran Resmi' })
      .setTimestamp();
  },

  // 27. Dashboard Pet Tamagotchi (.pet)
  petDashboardEmbed(user, pet, inventory) {
    if (!pet) {
      return new EmbedBuilder()
        .setColor(COLORS.WARN)
        .setTitle('🐾 ADOPSI PET TAMAGOTCHI PERTAMA ANDA!')
        .setDescription(
          `Halo **${user.username}**! Anda belum memiliki hewan peliharaan di server ini.\n\n` +
          `Pilihlah monster tangguh Anda dan mulailah merawatnya untuk menghasilkan uang pasif & bertarung!\n\n` +
          `💰 **Biaya Adopsi:** **Rp 1.500**\n` +
          `👉 **Daftar Pilihan Spesies Pet:**\n` +
          `• 🟢 **SLIME**: Vitalitas super (+20 Max HP / Tahan Lapar)\n` +
          `• 🔥 **DRAGON**: Kekuatan tempur garang (+15% Attack di PvP)\n` +
          `• 🐱 **CAT**: Lincah & hoki (Bonus +5% item langka dari Hunt)\n` +
          `• 🧱 **GOLEM**: Rajin & ulet (Cooldown Kerja -20 Menit)\n\n` +
          `*Adopsi pet sekarang dengan menekan tombol **🛎️ Adopsi Telur Pet** di bawah!*`
        )
        .setTimestamp();
    }

    const typeName = pet.pet_type.charAt(0) + pet.pet_type.slice(1).toLowerCase();
    const embed = new EmbedBuilder()
      .setTitle(`🐾 PUSAT PERAWATAN PET: ${pet.pet_name} 🐾`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    if (pet.status === 'EGG') {
      const now = Math.floor(Date.now() / 1000);
      const isHatched = pet.hatch_at <= now;
      
      embed
        .setColor(COLORS.WARN)
        .setDescription(
          `🥚 **STATUS PET: TELUR MONSTER**\n\n` +
          `• **Jenis:** \`🥚 Telur ${typeName}\`\n` +
          `• **Nama Calon Pet:** **${pet.pet_name}**\n` +
          `• **Status Penetasan:** ${isHatched ? '🟢 **Telur siap menetas!**' : `⏳ Sedang dierami... Menetas <t:${pet.hatch_at}:R>`}\n\n` +
          `*Hewan peliharaan Anda membutuhkan kehangatan inkubator. ${isHatched ? 'Klik tombol **🐣 Tetaskan Telur** di bawah!' : 'Tunggulah sampai hitung mundur selesai.'}*`
        );
      return embed;
    }

    if (pet.status === 'DEAD') {
      embed
        .setColor(COLORS.ERROR)
        .setDescription(
          `🪦 **STATUS PET: MENINGGAL DUNIA**\n\n` +
          `Kami sangat berduka atas wafatnya **${pet.pet_name}** the **${typeName}** 😭.\n\n` +
          `Hewan peliharaan Anda meninggal karena kelalaian perawatan (sakit/starving). Seluruh persediaan barang miliknya dibersihkan.\n\n` +
          `👉 *Gunakan tombol **🧹 Reset Pet** di bawah jika ingin membersihkan kandang dan mengadopsi pet baru seharga Rp 1.500.*`
        );
      return embed;
    }

    // Status Sehat / Sakit
    const isSick = pet.health <= 30;
    const statusEmoji = pet.status === 'ADULT' ? '🧑 Dewasa' : '👶 Bayi';
    const statusColor = isSick ? COLORS.ERROR : pet.health >= 80 ? COLORS.SUCCESS : COLORS.WARN;

    embed.setColor(statusColor)
      .setDescription(
        `👤 **Pemilik:** <@${pet.user_id}>\n` +
        `🏷️ **Nama Pet:** **${pet.pet_name}** the **${typeName}**\n` +
        `🧬 **Fase:** \`${statusEmoji} (Level ${pet.level})\`\n` +
        `✨ **XP:** \`${pet.xp} / ${pet.level * 100} XP\`\n\n` +
        `**📊 STATISTIK UTAMA PET:**\n` +
        `❤️ HP (Kesehatan) : ${this.renderProgressBar(pet.health)} ${isSick ? '⚠️ **[ SAKIT/LEMAH ]**' : ''}\n` +
        `🍖 Kenyangan     : ${this.renderProgressBar(pet.hunger)}\n` +
        `💧 Hidrasi       : ${this.renderProgressBar(pet.thirst)}\n` +
        `⚽ Kebahagiaan   : ${this.renderProgressBar(pet.happiness)}`
      );

    // Ketersediaan Supplies Inventory Singkat
    const suppliesText = inventory.map(item => `• ${item.name}: \`${item.quantity} pcs\``).join('\n');
    embed.addFields({
      name: '🎒 Persediaan Barang Pet (Supplies)',
      value: suppliesText || '*Kosong*',
      inline: false
    });

    // Info Cooldown Pekerjaan & Berburu
    const now = Math.floor(Date.now() / 1000);
    
    // Cooldown Work
    let workCd = 2 * 3600;
    if (pet.pet_type === 'GOLEM') workCd -= 20 * 60; // Golem perk
    const nextWork = pet.last_work_at + workCd;
    const canWork = now >= nextWork;
    const workStatus = canWork ? '🟢 **Siap bekerja!**' : `⏳ Cooldown s/d <t:${nextWork}:t> (<t:${nextWork}:R>)`;

    // Cooldown Hunt (Fase adult saja)
    let huntStatus = '🔒 Terkunci (Hanya untuk pet dewasa level 10+)';
    if (pet.level >= 10 || pet.status === 'ADULT') {
      const nextHunt = pet.last_hunt_at + (4 * 3600);
      const canHunt = now >= nextHunt;
      huntStatus = canHunt ? '🟢 **Siap berburu!**' : `⏳ Cooldown s/d <t:${nextHunt}:t> (<t:${nextHunt}:R>)`;
    }

    embed.addFields({
      name: '⏱️ Status Cooldown Aktivitas',
      value: `💼 **Bekerja (.pet work) :** ${workStatus}\n🏹 **Berburu (.pet hunt) :** ${huntStatus}`,
      inline: false
    });

    embed.setFooter({ text: 'Klik tombol di bawah ini untuk merawat pet Anda secara instan!' });
    return embed;
  },

  // Helper ProgressBar Visual
  renderProgressBar(value, max = 100) {
    const totalBars = 10;
    const filled = Math.min(totalBars, Math.round((value / max) * totalBars));
    const empty = totalBars - filled;
    const barStr = '🟩'.repeat(filled) + '🟥'.repeat(empty);
    return `\`[${barStr}]\` **${value}%**`;
  },

  // 28. Toko Item Pet (.pet shop)
  petShopEmbed(wallet, inventory) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.PURPLE)
      .setTitle('🎒 TOKO PERSEDIAAN PET TAMAGOTCHI')
      .setDescription(
        `Jaga kelangsungan hidup pet Anda dengan berbelanja supplies berkualitas!\n\n` +
        `💵 **Saldo Rupiah Anda:** **${formatCurrency(wallet.balance)}**\n` +
        `📦 **Persediaan Anda Saat Ini:**\n` +
        inventory.map(item => `• ${item.name}: \`${item.quantity} pcs\``).join('\n')
      );

    Object.keys(PET_ITEMS).forEach(key => {
      const item = PET_ITEMS[key];
      embed.addFields({
        name: `${item.name} — ${formatCurrency(item.price)}`,
        value: `*“${item.desc}”*\n👉 Efek: ` +
          (item.hunger > 0 ? `\`+${item.hunger} Kenyangan\` ` : '') +
          (item.thirst > 0 ? `\`+${item.thirst} Hidrasi\` ` : '') +
          (item.hp > 0 ? `\`+${item.hp} HP\` ` : '') +
          (item.happiness > 0 ? `\`+${item.happiness} Kebahagiaan\` ` : '') +
          (item.cures ? `\`Mengobati Sakit/Pingsan\` ` : '') +
          `\n👉 Kode Beli: \`.pet buy-item ${item.id.toLowerCase()}\``,
        inline: false
      });
    });

    embed.setFooter({ text: 'Gunakan tombol menu di bawah untuk bertransaksi instan!' }).setTimestamp();
    return embed;
  },

  // 29. Embed Battle Arena PvP
  petBattleEmbed(challengerUser, opponentUser, result) {
    const embed = new EmbedBuilder()
      .setTitle('⚔️ PVP PET ARENA: BATTLE REPORT ⚔️')
      .setTimestamp();

    if (result.draw) {
      embed
        .setColor(COLORS.WARN)
        .setDescription(
          `🤝 **HASIL PERTANDINGAN: SERI (DRAW) !**\n\n` +
          `Pertempuran sengit antara pet milik **${challengerUser.username}** (**${result.challengerName}**) melawan pet milik **${opponentUser.username}** (**${result.opponentName}**) berakhir imbang!\n\n` +
          `• Sisa HP Challenger: \`${result.challengerHP}%\`\n` +
          `• Sisa HP Opponent: \`${result.opponentHP}%\`\n\n` +
          `💰 Seluruh taruhan dikembalikan tanpa potongan pajak arena.`
        );
    } else {
      const isChalWinner = result.winnerId === challengerUser.id;
      const winnerUser = isChalWinner ? challengerUser : opponentUser;
      const loserUser = isChalWinner ? opponentUser : challengerUser;
      
      embed
        .setColor(COLORS.SUCCESS)
        .setDescription(
          `🏆 **PEMENANG ARENA: ${result.winnerName.toUpperCase()} !**\n\n` +
          `Selamat kepada **${winnerUser.username}**! Pet kesayangan Anda (**${result.winnerName}**) sukses menumbangkan (**${result.loserName}**) milik **${loserUser.username}**!\n\n` +
          `💰 **Total Jackpot Hadiah:** **${formatCurrency(result.prizePool)}** *(sudah potong pajak arena 5% - Rp ${result.tax.toLocaleString('id-ID')})*\n` +
          `📈 XP & Level pet pemenang telah ditambahkan secara otomatis.`
        );
    }

    // Log pertempuran ronde-demi-ronde
    const battleLog = result.logs.join('\n');
    embed.addFields({
      name: '📝 Transkrip Jalannya Pertempuran',
      value: `\`\`\`markdown\n${battleLog}\n\`\`\``,
      inline: false
    });

    return embed;
  }
};


