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

const PET_ASSETS = {
  EGG: [
    'https://i.giphy.com/media/mSuzNvPvE2KFrGpywl/giphy.gif',
    'https://i.giphy.com/media/l41lGU07rD3fMQxYQ/giphy.gif',
    'https://i.giphy.com/media/fX8zOAyerYzd3UPtBH/giphy.gif',
    'https://i.giphy.com/media/3oEdv9R4D62GPrVY4g/giphy.gif'
  ],
  DEAD: [
    'https://i.giphy.com/media/ukNqewtLpt81JN7SIS/giphy.gif',
    'https://i.giphy.com/media/xUPJPn8l1m8odg1Bxm/giphy.gif',
    'https://i.giphy.com/media/pVGsAWjzvXcZW4ZBTE/giphy.gif',
    'https://i.giphy.com/media/xThuWhGG79OblPr368/giphy.gif'
  ],
  SLIME: {
    BABY: [
      'https://i.giphy.com/media/2s4Z9TMV0oMFQsNpzn/giphy.gif',
      'https://i.giphy.com/media/YA89yckARWXC6Y6Kx4/giphy.gif',
      'https://i.giphy.com/media/ZLSJQUIWk47IUJft2s/giphy.gif'
    ],
    ADULT: [
      'https://i.giphy.com/media/3o7qE1YN7aBOFPRw8E/giphy.gif',
      'https://i.giphy.com/media/3ARYgT5xzZzUhIIvWY/giphy.gif',
      'https://i.giphy.com/media/Z8ywMJLdE4N2Z6Qlta/giphy.gif'
    ]
  },
  DRAGON: {
    BABY: [
      'https://i.giphy.com/media/Pyp923TIC4Iq4/giphy.gif',
      'https://i.giphy.com/media/Xb2Bw5hUU56XsudVF8/giphy.gif',
      'https://i.giphy.com/media/AHMPR6ASCvZY17KsdB/giphy.gif'
    ],
    ADULT: [
      'https://i.giphy.com/media/JMqM0nNT3AXS8xuiIZ/giphy.gif',
      'https://i.giphy.com/media/TjjLhpZU4roPz4SkW5/giphy.gif',
      'https://i.giphy.com/media/RlfsTNtMxGhb4T7P07/giphy.gif'
    ]
  },
  CAT: {
    BABY: [
      'https://i.giphy.com/media/gx54W1mSpeYMg/giphy.gif',
      'https://i.giphy.com/media/MSemvqMIRY3jMcvpd2/giphy.gif',
      'https://i.giphy.com/media/VCP6Kpf6guFm4nnF04/giphy.gif'
    ],
    ADULT: [
      'https://i.giphy.com/media/U6Xgx1pCLMPFaO0Uw3/giphy.gif',
      'https://i.giphy.com/media/2wicMBKqNZlrW/giphy.gif',
      'https://i.giphy.com/media/1k1ytCiReJMZWVtjXd/giphy.gif'
    ]
  },
  GOLEM: {
    BABY: [
      'https://i.giphy.com/media/3s4pjpA8Vb7lTy73Nn/giphy.gif',
      'https://i.giphy.com/media/BU327u9UNM2Sk/giphy.gif'
    ],
    ADULT: [
      'https://i.giphy.com/media/7ueLs2fU5c8QeeYHKg/giphy.gif',
      'https://i.giphy.com/media/4YHLDTS2yKKZpnZ9WN/giphy.gif',
      'https://i.giphy.com/media/Ss6CM89p5n3yBYfQ0P/giphy.gif'
    ]
  }
};

function getPetImage(pet) {
  if (!pet) return null;
  
  if (pet.status === 'EGG') {
    const eggs = PET_ASSETS.EGG;
    return eggs[Math.floor(Math.random() * eggs.length)];
  }
  if (pet.status === 'DEAD') {
    const deads = PET_ASSETS.DEAD;
    return deads[Math.floor(Math.random() * deads.length)];
  }
  
  const species = pet.pet_type.toUpperCase();
  const stage = pet.status.toUpperCase();
  
  if (PET_ASSETS[species] && PET_ASSETS[species][stage]) {
    const arr = PET_ASSETS[species][stage];
    return arr[Math.floor(Math.random() * arr.length)];
  }
  
  return null;
}

module.exports = {
  COLORS,
  formatCurrency,

  // 1. Embed Saldo / Profile
  profileEmbed(user, wallet, portfolioValue, member = null, shopItems = [], pet = null, activeLoan = null, bailDebts = null) {
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
        },
        { 
          name: '🚨 Masuk Penjara', 
          value: `\`${wallet.jail_count || 0} kali\``, 
          inline: true 
        }
      );

    // Tambahkan info utang bank jika ada
    let debtValue = '*Tidak ada utang*';
    if (activeLoan) {
      const totalDebt = activeLoan.total_due + (activeLoan.penalty_accumulated || 0);
      debtValue = `⚠️ **Rp ${totalDebt.toLocaleString('id-ID')}**\n╰ Jatuh Tempo: <t:${activeLoan.due_at}:d> (<t:${activeLoan.due_at}:R>) ${activeLoan.status === 'OVERDUE' ? '🚨 **[JATUH TEMPO]**' : ''}`;
    }
    embed.addFields({
      name: '💸 Utang Bank Sentral',
      value: debtValue,
      inline: false
    });

    // Tambahkan info hutang tebusan jika ada
    if (bailDebts) {
      const { debts, receivables } = bailDebts;
      let debtLines = [];
      
      if (debts && debts.length > 0) {
        debts.forEach(d => {
          debtLines.push(`🔴 Berhutang ke <@${d.creditor_id}>: **Rp ${d.amount.toLocaleString('id-ID')}**`);
        });
      }
      
      if (receivables && receivables.length > 0) {
        receivables.forEach(r => {
          debtLines.push(`🟢 Dipinjami oleh <@${r.debtor_id}>: **Rp ${r.amount.toLocaleString('id-ID')}**`);
        });
      }

      if (debtLines.length > 0) {
        embed.addFields({
          name: '🤝 Hutang Tebusan Penjara',
          value: debtLines.join('\n'),
          inline: false
        });
      }
    }

    // Tambahkan info Pet yang dimiliki
    if (pet) {
      let petValue = '';
      if (pet.status === 'EGG') {
        petValue = `🥚 **Telur Pet** (Sedang dierami, menetas <t:${pet.hatch_at}:R>)\n*Nama Calon: **${pet.pet_name}***`;
      } else if (pet.status === 'DEAD') {
        petValue = `🪦 **${pet.pet_name}** (${pet.pet_type}) telah meninggal dunia.\n*Gunakan \`.pet reset\` untuk mengadopsi pet baru.*`;
      } else {
        const typeLabel = pet.pet_type === 'SLIME' ? '🟢 Slime' : pet.pet_type === 'DRAGON' ? '🔥 Dragon' : pet.pet_type === 'CAT' ? '🐱 Kucing' : '🧱 Golem';
        petValue = `🐾 **Nama:** **${pet.pet_name}** (${typeLabel})\n` +
                   `⭐ **Level:** \`Lv. ${pet.level}\` (XP: \`${pet.xp}/${pet.level * 100}\`)\n` +
                   `📊 **Stats:** ❤️ \`${pet.health}%\` HP | 🍖 \`${pet.hunger}%\` Kenyang | 💧 \`${pet.thirst}%\` Hidrasi | ⚽ \`${pet.happiness}%\` Mood`;
      }
      embed.addFields({
        name: '🐾 Status Peliharaan (Pet)',
        value: petValue + '\n*💡 Ketik `.pet list` untuk melihat semua peliharaan Anda.*',
        inline: false
      });
    } else {
      embed.addFields({
        name: '🐾 Status Peliharaan (Pet)',
        value: `*Belum memiliki peliharaan. Adopsi telur seharga Rp 1.500 dengan ketik \`.pet buy <nama> <spesies>\`!*`,
        inline: false
      });
    }

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

  // 16. Embed Pengumuman Pembaruan Sistem Ekonomi (.eco-announce) — MULTI-EMBED PREMIUM
  updateAnnouncementEmbeds(guild) {
    const divider = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    const miniDivider = '─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─';
    const timestamp = new Date();

    // ══════════════════════════════════════════════════
    // EMBED 1: HERO HEADER — SELAMAT DATANG
    // ══════════════════════════════════════════════════
    const heroEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📢  ENSIKLOPEDIA LENGKAP PERINTAH & FITUR SENTINEL BOT 2026  📢')
      .setThumbnail(guild.iconURL({ dynamic: true }) || null)
      .setDescription(
        `${divider}\n\n` +
        `Halo Warga **${guild.name}**! 👋✨\n\n` +
        `Selamat datang di **Pusat Informasi Resmi Sentinel Bot 2026** — Bot multifungsi serba bisa yang menguasai keamanan Voice Channel, ekonomi kosan, perdagangan saham interaktif, perbankan modern, simulasi hunian, peliharaan virtual, perampokan berisiko tinggi, hingga permainan sosial!\n\n` +
        `Di bawah ini tersaji **seluruh katalog fitur & daftar perintah** yang aktif penuh dan siap Anda gunakan.\n\n` +
        `> 💡 *Ketik **\`.help\`** kapan saja untuk membuka panel navigasi interaktif di dalam Discord.*\n\n` +
        `${divider}`
      )
      .setTimestamp(timestamp);

    // ══════════════════════════════════════════════════
    // EMBED 2: VOICE & TTS + EKONOMI PASIF
    // ══════════════════════════════════════════════════
    const voiceEcoEmbed = new EmbedBuilder()
      .setColor(0x00D2FF)
      .addFields(
        {
          name: '🎙️  ① KEAMANAN VOICE CHANNEL & GOOGLE TEXT-TO-SPEECH',
          value:
            `> *Keamanan nongkrong Anda di Voice Channel adalah prioritas kami!*\n\n` +
            `🔒 **\`.join\`** atau **\`/join\`**\n` +
            `╰ Bot bergabung ke VC Anda & mengunci saluran. Jika dipindahkan/dikick, bot langsung **rejoin otomatis instan**! Dilengkapi sapaan suara saat bergabung.\n\n` +
            `🔓 **\`.leave\`** atau **\`/leave\`**\n` +
            `╰ Membuka kunci saluran & mengeluarkan bot secara aman dan bersih.\n\n` +
            `🗣️ **\`.speak <teks>\`** · **\`.speak en <teks>\`**\n` +
            `╰ Mengucapkan teks di Voice Channel menggunakan Google TTS (Bahasa Indonesia/Inggris).\n\n` +
            `🔊 **Sapaan Suara Otomatis** — Setiap member yang bergabung ke VC akan disambut *"Halo [Nama], selamat bergabung!"* secara realtime!\n\n` +
            `📊 **\`.status\`** — Statistik realtime koneksi, RAM VPS, uptime bot, & info sistem server.\n\n` +
            `${miniDivider}`,
          inline: false
        },
        {
          name: '💸  ② EKONOMI PASIF "RUPIAH SERVER" & GAJI HARIAN',
          value:
            `> *Ngobrol di server = menghasilkan uang. Semudah itu!*\n\n` +
            `💬 **Chat-to-Earn** — Setiap pesan minimal 3 kata & 10 karakter otomatis menghasilkan **Rp 1 s/d Rp 4** secara acak (cooldown 45 detik, anti-spam).\n\n` +
            `🌅 **Gaji Harian Otomatis** — Tidak perlu ketik \`.daily\` lagi! Gaji harian **Rp 15 – Rp 35** + bonus streak berturut-turut akan **otomatis dicairkan** di chat pertama Anda setiap hari!\n\n` +
            `💼 **\`.bal\`** · **\`.profile\`** — Melihat saldo dompet, portofolio saham, daily streak, & koleksi role prestise.\n\n` +
            `💰 **\`.daily\`** — Klaim manual gaji harian gratis (jika Anda lebih suka mengklaim sendiri).\n\n` +
            `💸 **\`.transfer @user <jumlah>\`** — Kirim koin instan ke warga lain (pajak transfer 10%, **bisa dikurangi** dengan sewa kosan!).\n\n` +
            `🏆 **\`.rich\`** · **\`.leaderboard\`** — Papan peringkat 10 konglomerat terkaya di seluruh server.`,
          inline: false
        }
      )
      .setTimestamp(timestamp);

    // ══════════════════════════════════════════════════
    // EMBED 3: BURSA SAHAM + AUTO-TRADING + TOKO ROLE
    // ══════════════════════════════════════════════════
    const stocksEmbed = new EmbedBuilder()
      .setColor(0x00FF88)
      .addFields(
        {
          name: '📈  ③ BURSA SAHAM KOSAN INTERAKTIF',
          value:
            `> *Investasikan koin Anda ke text channel teraktif! Harga saham berfluktuasi dinamis setiap 2 jam.*\n\n` +
            `📊 **\`.market\`** · **\`.saham\`** — Membuka dashboard bursa saham lengkap & memicu panel transaksi interaktif privat.\n\n` +
            `📉 **\`.stock <ticker>\`** · **\`.chart <ticker>\`** — Melihat detail saham & **Grafik Tren ASCII 2D** (10 pembaruan terakhir) dengan tombol instan Beli, Jual, & Refresh.\n\n` +
            `📥 **\`.buy <ticker> <jumlah>\`** — Membeli lembar saham (Maks 500 lembar per saham).\n` +
            `📤 **\`.sell <ticker> <jumlah>\`** — Menjual saham Anda ke bursa (pajak bursa **15%**).\n` +
            `📤 **\`.sellall <ticker>\`** — Melikuidasi seluruh lembar saham pada ticker tertentu.\n\n` +
            `💼 **\`.porto\`** · **\`.portfolio\`** — Detail aset investasi, harga beli rata-rata, & profit/loss real-time.\n\n` +
            `💵 **Dividen Mingguan** — Setiap **Minggu malam pukul 21:00 WIB**, dividen otomatis dibagikan ke seluruh pemegang saham berdasarkan keaktifan chat mingguan channel terkait *(Maks rate 9%)*!\n\n` +
            `${miniDivider}`,
          inline: false
        },
        {
          name: '🤖  ④ ROBOT INVESTASI PRIBADI (AUTO-TRADING AI)',
          value:
            `> *Biarkan robot bekerja menghasilkan cuan untuk Anda saat rebahan!*\n\n` +
            `⚡ **\`.autotrade\`** · **\`.autoinvest\`** — Membuka panel kontrol asisten robot trading pribadi.\n\n` +
            `📥 **Auto DCA (Buy-the-Dip)** — Jika saldo dompet Anda ≥ Rp 150, robot otomatis mencicil beli saham termurah/sedang turun setiap 2 jam *(maks alokasi 30% saldo)*.\n\n` +
            `📤 **Auto Take-Profit (TP)** — Robot otomatis melikuidasi saham Anda saat keuntungan mencapai **≥ 15%** dari harga beli rata-rata untuk mengamankan koin dompet!\n\n` +
            `${miniDivider}`,
          inline: false
        },
        {
          name: '🎭  ⑤ TOKO ROLE PRESTISE & SPIN GACHA MISTERI',
          value:
            `> *Tukarkan koin Anda dengan kasta role bergengsi — atau putar roda nasib!*\n\n` +
            `🛍️ **\`.shop\`** · **\`.rolemarket\`** — Membuka etalase toko role prestise server.\n\n` +
            `🏷️ **\`.buy-role <ID>\`** — Membeli role bergengsi secara tetap menggunakan saldo koin.\n\n` +
            `🎰 **\`.gacha-role\`** — Memutar spin gacha role seharga **Rp 250** per roll!\n` +
            `╰ 🟢 Common \`70%\` · 🔵 Rare \`22%\` · 🟣 Epic \`6.8%\` · 👑 Legendary \`1.1%\` · 🌟 **Mythic \`0.1%\`**\n` +
            `╰ 🗑️ Zonk? Dapet item sampah lucu *(Sandal Swallow Kiri, Batu Kali, Tulang Ayam…)*\n` +
            `╰ 💰 Duplikat? Cashback **Rp 100** otomatis!\n\n` +
            `📇 **\`.indexrole\`** · **\`.roleindex\`** — Menampilkan kartu indeks koleksi role Anda, progress bar, & status kelas sosial *(dari "Beban Server" s/d "Maharaja Sultan"!)*.`,
          inline: false
        }
      )
      .setTimestamp(timestamp);

    // ══════════════════════════════════════════════════
    // EMBED 4: BANK + KOSAN
    // ══════════════════════════════════════════════════
    const bankKosEmbed = new EmbedBuilder()
      .setColor(0x7C4DFF)
      .addFields(
        {
          name: '🏛️  ⑥ CENTRAL BANK KOSAN 1A (TABUNGAN & PINJAMAN)',
          value:
            `> *Perbankan canggih berbasis formulir pop-up interaktif Discord!*\n\n` +
            `🏦 **\`.bank\`** — Membuka panel kontrol bank interaktif lengkap.\n\n` +
            `📥 **Tabungan** — Simpan koin di brankas bank agar aman dari perampok. Tabungan mendapat **bunga pasif +1.5% setiap hari** yang cair otomatis tengah malam!\n\n` +
            `📜 **Pinjaman** — Pinjam koin darurat dengan limit dinamis berdasarkan keaktifan chat & streak harian Anda:\n` +
            `╰ 📅 **Tenor 1 hari** — Bunga 2%\n` +
            `╰ 📅 **Tenor 3 hari** — Bunga 5%\n` +
            `╰ 📅 **Tenor 7 hari** — Bunga 10%\n\n` +
            `💳 **Bayar Utang** — Melunasi cicilan secara instan via tombol interaktif.\n\n` +
            `⚠️ **Sanksi Jatuh Tempo (Overdue):**\n` +
            `╰ 🔴 Denda akumulasi **+5%** per hari keterlambatan\n` +
            `╰ 🔴 \`.daily\` **DIBEKUKAN** & \`.autotrade\` **DIMATIKAN PAKSA**\n` +
            `╰ 🔴 Tagihan merah publik dikirim ke server agar semua warga tahu! 😱\n\n` +
            `${miniDivider}`,
          inline: false
        },
        {
          name: '🛌  ⑦ SEWA KAMAR KOSAN (3 HARI)',
          value:
            `> *Ubah koin Anda menjadi hunian bergengsi!*\n\n` +
            `🏠 **\`.kos\`** · **\`.kosan\`** — Dashboard hunian pribadi, sisa sewa, & efek buffs.\n\n` +
            `🛎️ **\`.kos-sewa\`** · **\`.sewakos\`** — Persewaan kamar berdurasi 3 hari:\n` +
            `╰ 💨 **Kamar Kipas Angin** *(Rp 150)* → Daily **+Rp 5**\n` +
            `╰ ❄️ **Kamar AC** *(Rp 350)* → Daily **+Rp 15** | Pajak Transfer **8%**\n` +
            `╰ 👑 **Penthouse** *(Rp 800)* → Daily **+Rp 40** | Transfer **5%** | Jual Saham **10%**`,
          inline: false
        },
        {
          name: '🪟  UPGRADE FASILITAS KAMAR (PERMANEN)',
          value:
            `**\`.kos-upgrade\`** · **\`.upgradekos\`** — Belanja fasilitas permanen:\n` +
            `╰ 🛏️ **Kasur Busa** *(Rp 200)* → Streak bonus **+Rp 4/hari**\n` +
            `╰ 📶 **WiFi Kencang** *(Rp 300)* → Voice Earn **Rp 35/hari**\n` +
            `╰ 💧 **Dispenser** *(Rp 150)* → **10%** koin chat 2x lipat 🥤\n` +
            `╰ 🔒 **Gembok** *(Rp 250)* → Limit pinjaman **+Rp 150** & proteksi rob **-50%**\n` +
            `╰ 🚨 **Alarm** *(Rp 500)* → Sukses rampok turun **-15%**\n` +
            `╰ 📹 **CCTV** *(Rp 350)* → Denda perampok gagal **+Rp 100**`,
          inline: false
        }
      )
      .setTimestamp(timestamp);

    // ══════════════════════════════════════════════════
    // EMBED 5: PET + ROB/HEIST
    // ══════════════════════════════════════════════════
    const petRobEmbed = new EmbedBuilder()
      .setColor(0xFFB300)
      .addFields(
        {
          name: '🐾  ⑧ SISTEM PET VIRTUAL — SPESIES & ADOPSI',
          value:
            `> *Adopsi, rawat, latih, dan bertarung bersama peliharaan virtualmu!*\n\n` +
            `🥚 **\`.pet buy <nama> <spesies>\`** — Adopsi telur seharga **Rp 1.500** *(menetas 2 jam)*.\n\n` +
            `**Pilihan Spesies & Keunggulan Unik:**\n` +
            `╰ 🟢 **Slime** → Laju lapar/haus **-25%** lebih lambat\n` +
            `╰ 🔥 **Dragon** → Attack PvP **+15%**\n` +
            `╰ 🐱 **Cat** → Hunt **+15%** & item langka **+5%**\n` +
            `╰ 🧱 **Golem** → Cooldown kerja **-20 menit**`,
          inline: false
        },
        {
          name: '📋  PERINTAH PET & AKSI',
          value:
            `📋 **\`.pet\`** — Dashboard status pet (HP, Kenyangan, Hidrasi, Mood).\n` +
            `🛒 **\`.pet shop\`** — Toko item perawatan (Pakan, Air, Obat, Mainan).\n` +
            `⚒️ **\`.pet work\`** — Kerja: **Rp 150–400** + bonus 5%/level *(CD: 2 jam)*.\n` +
            `🏹 **\`.pet hunt\`** — Berburu *(Min. Lv 10)*: **Rp 300–800** + item *(CD: 4 jam)*.\n` +
            `🎾 **\`.pet play\`** — Bermain gratis: **+25 Happiness, +15 XP**.\n` +
            `⚔️ **\`.pet pvp @user <taruhan>\`** — Duel PvP taruhan koin!\n` +
            `🗑️ **\`.pet reset\`** — Kosongkan kandang untuk adopsi ulang.\n\n` +
            `${miniDivider}`,
          inline: false
        },
        {
          name: '💥  ⑨ PERAMPOKAN BERISIKO TINGGI (ROB & BANK HEIST)',
          value:
            `> *High risk, high reward — atau high regret! Pilih wisely!*\n\n` +
            `🔫 **\`.rob @user\`** — Solo robbery! Merampok **10%–25%** koin dompet target.\n` +
            `╰ ✅ Peluang sukses dasar: **40%** *(dikurangi Alarm korban: -15%)*\n` +
            `╰ ❌ Gagal? Didenda **Rp 200** *(+Rp 100 jika korban punya CCTV)* & dipenjara **30 menit**!\n` +
            `╰ 🛡️ Gembok korban memotong jarahan pelaku hingga **50%**.\n\n` +
            `🏦 **\`.heist\`** — Rampok Bank Sentral secara multiplayer!\n` +
            `╰ 👤 1 kru: 15% sukses → Rp 1.000–2.000\n` +
            `╰ 👥 2 kru: 30% sukses → Rp 2.500–4.500\n` +
            `╰ 👥👥 3 kru: 45% sukses → Rp 5.000–8.000\n` +
            `╰ 👥👥👥 4 kru: 60% sukses → Rp 9.000–14.000\n` +
            `╰ 👥👥👥👥 **5+ kru: 75% sukses → Rp 15.000–25.000** 🔥\n` +
            `╰ ❌ Gagal heist? **Denda + Penjara 1–2 jam** untuk seluruh kru!\n\n` +
            `🏛️ **\`.jail\`** · **\`.jail @user\`** — Cek status/sisa waktu penjara virtual.\n` +
            `╰ 💳 Bayar **bail** (jaminan) untuk bebas seketika: Solo Rp 500 | Heist Rp 1.000.`,
          inline: false
        }
      )
      .setTimestamp(timestamp);

    // ══════════════════════════════════════════════════
    // EMBED 6: GAME ToD + LINK BYPASS + TIPS HOKI + PENUTUP
    // ══════════════════════════════════════════════════
    const closingEmbed = new EmbedBuilder()
      .setColor(0xFF3366)
      .addFields(
        {
          name: '🎲  ⑩ GAME VOICE TRUTH OR DARE',
          value:
            `> *Ramaikan tongkrongan Voice Channel dengan permainan seru!*\n\n` +
            `🃏 **\`.tod\`** · **\`.truthordare\`** — Memulai sesi lobi game Truth or Dare interaktif berbahasa Indonesia di VC.\n\n` +
            `📊 **\`.tod status\`** — Melihat profil, statistik koin, & performa bermain ToD Anda.\n\n` +
            `${miniDivider}`,
          inline: false
        },
        {
          name: '🔗  ⑪ BYPASS VIDEO LINK (AUTO-PREVIEW)',
          value:
            `> *Kirim link video tanpa khawatir preview rusak!*\n\n` +
            `📱 Fitur **otomatis aktif** — Bot mendeteksi link **TikTok**, **Twitter/X**, & **Instagram** yang dikirim di chat, lalu mengirim preview video langsung melalui Webhook Mirroring yang estetik tanpa merusak teks asli Anda!\n\n` +
            `${miniDivider}`,
          inline: false
        },
        {
          name: '💡  TIPS & TRIK AGAR CEPAT KAYA DAN HOKI',
          value:
            `**🚀 Fase Awal — Kumpulkan Modal:**\n` +
            `╰ Konsisten chatting & jaga daily streak tanpa putus!\n` +
            `╰ Adopsi pet **Golem** (kerja lebih sering) atau **Cat** (hunt lebih untung).\n` +
            `╰ Rajin kirim pet bekerja (\`.pet work\`) setiap cooldown selesai.\n\n` +
            `**📈 Fase Menengah — Investasi Cerdas:**\n` +
            `╰ Sewa **Penthouse** untuk potongan pajak & bonus daily terbesar.\n` +
            `╰ Beli **Kasur** (streak multiplier) & **Dispenser** (10% koin chat 2x lipat).\n` +
            `╰ Aktifkan \`.autotrade\` — biarkan robot belikan saham murah & jual saat untung!\n` +
            `╰ Tabung koin di \`.bank\` untuk **bunga +1.5%/hari** & lindungi dari perampok.\n\n` +
            `**💥 Fase Akhir — High Risk High Reward:**\n` +
            `╰ Kumpulkan 5+ kru untuk \`.heist\` (peluang sukses **75%**, rampasan hingga **Rp 25.000**).\n` +
            `╰ Tingkatkan level pet Dragon untuk menang **PvP Arena** dengan taruhan tinggi.\n` +
            `╰ Putar \`.gacha-role\` saat saldo melimpah — siapa tahu dapat **Mythic 0.1%**! 🌟`,
          inline: false
        }
      )
      .setDescription(
        `${divider}\n\n` +
        `✨ *Terima kasih telah menjadi bagian dari keseruan **${guild.name}**!*\n` +
        `*Yuk ketik **\`.kos\`**, **\`.bank\`**, atau **\`.pet\`** sekarang untuk mencoba!*\n` +
        `*Selamat nongkrong, selamat trading, dan selamat rebahan di Kamar AC!* 🛌💸📈\n\n` +
        `${divider}`
      )
      .setFooter({ text: '— Tim Developer & Sentinel Bot Kosan 1A 2026 ❤️', iconURL: guild.iconURL({ dynamic: true }) || null })
      .setTimestamp(timestamp);

    return [heroEmbed, voiceEcoEmbed, stocksEmbed, bankKosEmbed, petRobEmbed, closingEmbed];
  },

  // Backward-compatible single embed wrapper (jika diperlukan)
  updateAnnouncementEmbed(guild) {
    const embeds = this.updateAnnouncementEmbeds(guild);
    return embeds[0]; // Kembalikan embed pertama saja untuk kompatibilitas lama
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

    // Set Random/Animated GIF matching pet species and stage
    const petImg = getPetImage(pet);
    if (petImg) {
      embed.setImage(petImg);
    }

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

    // Cooldown Play
    const nextPlay = (pet.last_play_at || 0) + (15 * 60);
    const canPlay = now >= nextPlay;
    const playStatus = canPlay ? '🟢 **Siap bermain!**' : `⏳ Cooldown s/d <t:${nextPlay}:t> (<t:${nextPlay}:R>)`;

    embed.addFields({
      name: '⏱️ Status Cooldown Aktivitas',
      value: `💼 **Bekerja (.pet work) :** ${workStatus}\n🏹 **Berburu (.pet hunt) :** ${huntStatus}\n⚽ **Bermain (.pet play) :** ${playStatus}`,
      inline: false
    });

    embed.setFooter({ text: 'Klik tombol di bawah ini untuk merawat pet Anda secara instan!' });
    return embed;
  },

  // 27b. List of Pets (.pet list)
  petListEmbed(user, pets) {
    const embed = new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setTitle(`🐾 DAFTAR HEWAN PELIHARAAN — ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setDescription('Berikut adalah daftar seluruh peliharaan yang Anda miliki di server ini (Maksimal 3):');

    if (!pets || pets.length === 0) {
      embed.setDescription('*Anda belum memiliki hewan peliharaan. Adopsi telur seharga Rp 1.500 dengan ketik `.pet buy <nama> <spesies>`!*');
    } else {
      pets.forEach((pet, idx) => {
        const activeLabel = pet.is_active ? '🟢 **AKTIF**' : '⚪ Pasif';
        const typeLabel = pet.pet_type === 'SLIME' ? '🟢 Slime' : pet.pet_type === 'DRAGON' ? '🔥 Dragon' : pet.pet_type === 'CAT' ? '🐱 Kucing' : '🧱 Golem';
        
        let statusText = '';
        if (pet.status === 'EGG') {
          statusText = `🥚 Telur (Menetas <t:${pet.hatch_at}:R>)`;
        } else if (pet.status === 'DEAD') {
          statusText = `🪦 Meninggal Dunia (Reset dengan \`.pet reset\`)`;
        } else {
          statusText = `Lv. ${pet.level} | ❤️ ${pet.health}% HP | 🍖 ${pet.hunger}% Kenyang | 💧 ${pet.thirst}% Hidrasi | ⚽ ${pet.happiness}% Mood`;
        }

        embed.addFields({
          name: `${idx + 1}. ${pet.pet_name} the ${typeLabel} (${activeLabel})`,
          value: `╰ Status: ${statusText}`,
          inline: false
        });
      });
    }

    if (pets.length < 3) {
      embed.setFooter({ text: `Ketik .pet buy <nama> <spesies> untuk mengadopsi peliharaan berikutnya! (${pets.length}/3)` });
    } else {
      embed.setFooter({ text: 'Slot peliharaan Anda sudah penuh (3/3).' });
    }

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
    const { PET_ITEMS } = require('./pet');
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
  },

  // 30. Jail Status Embed (.jail)
  jailStatusEmbed(user, secondsRemaining, bailAmount) {
    const now = Math.floor(Date.now() / 1000);
    const releaseTime = now + secondsRemaining;
    const embed = new EmbedBuilder()
      .setColor(COLORS.ERROR)
      .setTitle('🚨 STATUS TAHANAN VIRTUAL 👮')
      .setDescription(
        `Waduh! **${user.username}**, Anda saat ini sedang ditahan di Penjara Virtual Server.\n\n` +
        `🔒 **Status:** \`JAILED\`\n` +
        `⏳ **Bebas Pada:** <t:${releaseTime}:t> (<t:${releaseTime}:R>)\n` +
        `💰 **Uang Jaminan (Bail):** \`${formatCurrency(bailAmount)}\` untuk bebas instan.\n\n` +
        `*Selama berada di dalam penjara, seluruh aktivitas ekonomi Anda dibekukan (Tidak bisa bekerja, daily, transfer, beli/jual saham, main pet, dll).*`
      )
      .setThumbnail('https://cdn-icons-png.flaticon.com/512/3233/3233481.png')
      .setFooter({ text: 'Klik tombol "🔓 Tebus Jaminan" di bawah atau gunakan .jail untuk bebas!' })
      .setTimestamp();

    return embed;
  },

  // 31. Heist Lobby Embed (.heist)
  heistLobbyEmbed(guild, initiator, participants, timeLeft, successRate, minPrize, maxPrize, prepFee) {
    const listKru = participants.map((p, idx) => {
      const roles = ['🕶️ Otak Kriminal', '🚗 Pembalap Pelarian', '💣 Ahli Peledak', '🔫 Penembak Jitu', '💻 Peretas Keamanan', '🎒 Pembawa Uang'];
      const roleStr = roles[idx] || '👥 Anggota Kru';
      return `${idx + 1}. **<@${p}>** (${roleStr})`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setColor(COLORS.WARN)
      .setTitle('🚨 OPERASI BESAR: SERVER CENTRAL BANK HEIST 🚨')
      .setDescription(
        `**${initiator.username}** sedang menggalang tim kriminal untuk membobol brankas Bank Pusat Server!\n\n` +
        `💵 **Biaya Persiapan:** \`${formatCurrency(prepFee)}\` / orang (potong dompet)\n` +
        `⏳ **Waktu Berkumpul:** \`${timeLeft} detik lagi...\`\n\n` +
        `👥 **DAFTAR ANGGOTA KRU (${participants.length}):**\n${listKru || '*Menunggu kru bergabung...*'}`
      )
      .addFields(
        {
          name: '📈 ESTIMASI STRATEGI OPERASI',
          value: `• **Peluang Keberhasilan:** \`${successRate}%\`\n• **Perkiraan Total Hadiah:** \`${formatCurrency(minPrize)} - ${formatCurrency(maxPrize)}\``,
          inline: false
        }
      )
      .setFooter({ text: 'Klik tombol "🤝 Gabung Heist" di bawah untuk ikut perampokan ini!' })
      .setTimestamp();

    return embed;
  },

  // 32. Heist Result Embed
  heistResultEmbed(guild, success, participants, logs, totalReward, rewardPerPerson, fineAmount, jailHours) {
    const embed = new EmbedBuilder()
      .setTitle(success ? '💥 LAPORAN AKHIR: BANK HEIST SUCCESS! 💰' : '🚓 LAPORAN AKHIR: BANK HEIST GAGAL! 👮')
      .setColor(success ? COLORS.SUCCESS : COLORS.ERROR)
      .setTimestamp();

    const crewList = participants.map(p => `<@${p}>`).join(', ');
    const logText = logs.map(l => `• ${l}`).join('\n');

    if (success) {
      embed.setDescription(
        `🚨 **Lokasi:** Central Bank Server\n` +
        `👥 **Kru Perampok:** ${crewList}\n\n` +
        `📝 **DOKUMENTASI OPERASI:**\n${logText}\n\n` +
        `🏆 **HASIL JARAHAN BRANKAS:**\n` +
        `💰 **Total Dirampok:** \`${formatCurrency(totalReward)}\`\n` +
        `👉 **Setiap Anggota Mendapatkan:** **\`${formatCurrency(rewardPerPerson)}\`** *(Bersih!)*`
      );
    } else {
      embed.setDescription(
        `🚨 **Lokasi:** Central Bank Server\n` +
        `👥 **Kru Perampok:** ${crewList}\n\n` +
        `📝 **DOKUMENTASI OPERASI:**\n${logText}\n\n` +
        `❌ **KONSEKUENSI PENANGKAPAN:**\n` +
        `💸 **Denda per Anggota:** \`${formatCurrency(fineAmount)}\` (potong dompet)\n` +
        `🔒 **Hukuman Penjara:** \`${jailHours} Jam\` di Penjara Virtual!`
      );
    }

    return embed;
  },

  // 33. Rob & Heist System Guide Announcement
  robAnnouncementEmbed(guild) {
    return new EmbedBuilder()
      .setColor(COLORS.PURPLE)
      .setTitle('💥 RESIKO & BENEFIT SISTEM PERAMPOKAN KOSAN 💥')
      .setThumbnail(guild.iconURL({ dynamic: true }) || null)
      .setDescription(
        `Berikut adalah detail lengkap mengenai sistem perampokan Solo Rob (\`.rob @user\`) dan Bank Heist (\`.heist\`) di server:`
      )
      .addFields(
        {
          name: '👤 1. SOLO ROB (.rob @user)',
          value:
            `• **Peluang Sukses:** 40% (Berkurang 15% jika target memiliki **Alarm**).\n` +
            `• **Benefit (Sukses):**\n` +
            `  👉 Mencuri **10% - 25% koin** acak dari dompet korban.\n` +
            `  👉 Jika memiliki Pet aktif, Pet mendapat **+20 XP**.\n` +
            `  👉 Hasil rampokan dipotong **50%** jika target memiliki **Gembok**.\n` +
            `• **Resiko (Gagal):**\n` +
            `  👉 Denda **Rp 200** langsung diberikan ke korban (Denda **Rp 300** jika korban pasang **CCTV**).\n` +
            `  👉 Masuk **Penjara Virtual selama 30 menit** (membekukan aktivitas ekonomi).\n` +
            `  👉 Tebus jaminan bebas instan seharga **Rp 250** (\`.jail\` dashboard).`,
          inline: false
        },
        {
          name: '🚨 2. CENTRAL BANK HEIST MULTIPLAYER (.heist)',
          value:
            `• **Biaya Persiapan:** Rp 100 /orang (Modal awal untuk ikut lobi).\n` +
            `• **Sistem Kru & Peluang (Skala Tim):**\n` +
            `  👥 **1 Orang (Solo):** Sukses **15%** | Hadiah **Rp 1.000 - Rp 2.000** | Denda **Rp 300** & Penjara **1 Jam**.\n` +
            `  👥 **2 Orang:** Sukses **30%** | Hadiah **Rp 2.500 - Rp 4.500** | Denda **Rp 300** & Penjara **1 Jam**.\n` +
            `  👥 **3 Orang:** Sukses **45%** | Hadiah **Rp 5.000 - Rp 8.000** | Denda **Rp 400** & Penjara **1 Jam**.\n` +
            `  👥 **4 Orang:** Sukses **60%** | Hadiah **Rp 9.000 - Rp 14.000** | Denda **Rp 400** & Penjara **1.5 Jam**.\n` +
            `  👥 **5+ Orang:** Sukses **75%** | Hadiah **Rp 15.000 - Rp 25.000** | Denda **Rp 500** & Penjara **2 Jam**.\n` +
            `• **Benefit Tambahan:** Pet aktif seluruh kru mendapatkan **+40 XP** jika berhasil.\n` +
            `• **Resiko Gagal:** Tebus jaminan bebas instan dari penjara Heist seharga **Rp 500** per orang.`,
          inline: false
        }
      )
      .setFooter({ text: 'Gunakan .rob @user untuk merampok solo atau .heist untuk merampok bank!' })
      .setTimestamp();
  },

  // 34. Pet System Guide Announcement
  petAnnouncementEmbed(guild) {
    return new EmbedBuilder()
      .setColor(COLORS.PURPLE)
      .setTitle('🐾 PANDUAN LENGKAP & BENEFIT SISTEM PET TAMAGOTCHI 🐾')
      .setThumbnail(guild.iconURL({ dynamic: true }) || null)
      .setDescription(
        `Selamat datang di sistem peliharaan virtual Tamagotchi Kosan 1A! Rawat pet Anda, tingkatkan levelnya, dan rasakan berbagai pasif buffs menguntungkan:`
      )
      .addFields(
        {
          name: '🧬 1. SPESIES PET & PASIF BUFFS KHUSUS',
          value:
            `🟢 **Slime:** Vitalitas Tinggi.\n` +
            `  👉 *Buff:* Max HP bertambah +20 | Laju kelaparan & kehausan berkurang 25% lebih lambat.\n` +
            `🔥 **Dragon:** Naga Legendaris.\n` +
            `  👉 *Buff:* Sangat tangguh di PvP Arena (Mendapatkan bonus **+15% Attack Power**).\n` +
            `🐱 **Cat:** Kucing Lincah.\n` +
            `  👉 *Buff:* Pendapatan berburu (*Hunt*) meningkat **+15%** | Peluang mendapatkan item langka gratis naik menjadi **10%** (normal 5%).\n` +
            `🧱 **Golem:** Pekerja Keras.\n` +
            `  👉 *Buff:* Cooldown bekerja (*Work*) dikurangi **20 Menit** (dari 2 jam menjadi 1 jam 40 menit).`,
          inline: false
        },
        {
          name: '🐣 2. FASE PERTUMBUHAN PET',
          value:
            `🥚 **Egg (Telur):** Diadopsi seharga **Rp 1.500** (\`.pet buy <nama> <spesies>\`). Menetas otomatis dalam waktu **2 jam**.\n` +
            `🐣 **Baby (Bayi):** Level 1 s/d 9. Belum bisa diajak berburu (*Hunt*) atau bertarung PvP.\n` +
            `🦁 **Adult (Dewasa):** Min. Level 10. Membuka fitur berburu liar (*Hunt*) dan pertarungan taruhan PvP Arena.`,
          inline: false
        },
        {
          name: '💼 3. MEKANIK PENDAPATAN & UPAH KOIN',
          value:
            `• **Bekerja (\`.pet work\`):** Mencari uang secara aman. Menghasilkan **Rp 150 - Rp 400** + bonus 5% per level pet (Cooldown 2 jam, Golem 1j 40m).\n` +
            `• **Berburu (\`.pet hunt\`):** Menjelajah hutan liar (Min. Lvl 10). Menghasilkan **Rp 300 - Rp 800** + peluang mendapatkan jackpot item premium gratis (Daging, Obat, Bola Karet). Cooldown 4 jam.\n` +
            `• **PvP Arena (\`.pet pvp @user <taruhan\`):** Bertarung dengan pet lain memperebutkan uang taruhan (Klaim 95% total taruhan, pajak arena 5%). Kalah mengurangi HP & Kebahagiaan secara signifikan.`,
          inline: false
        },
        {
          name: '🍗 4. KEBUTUHAN PERAWATAN & TOKO PERSSEDIAAN (\`.pet shop\`)',
          value:
            `• 🍗 **Pakan Biasa (Rp 150):** +30 Kenyangan.\n` +
            `• 🥩 **Daging Premium (Rp 350):** +70 Kenyangan, +10 HP, +5 Kebahagiaan.\n` +
            `• 🥤 **Air Bersih (Rp 100):** +35 Hidrasi.\n` +
            `• 💊 **Obat (Rp 500):** +50 HP & Menyembuhkan Sakit/Pingsan.\n` +
            `• ⚽ **Bola Karet (Rp 250):** +50 Kebahagiaan.\n` +
            `• ⚽ **Main Gratis (\`.pet play\`):** +25 Kebahagiaan & +15 XP (Gratis, tanpa item, cooldown 15 menit).\n` +
            `👉 *Tip:* Jika pet kelaparan/kehausan menyentuh 0% terlalu lama, HP akan berkurang perlahan. Jika HP menyentuh 0%, pet akan mati (*Dead*). Kandang yang mati harus dibersihkan dengan \`.pet reset\` sebelum mengadopsi yang baru.`,
          inline: false
        }
      )
      .setFooter({ text: 'Gunakan .pet untuk membuka kandang atau .pet shop untuk belanja persediaan!' })
      .setTimestamp();
  },

  // 35. Kosan & Upgrade Guide Announcement
  kosAnnouncementEmbed(guild) {
    return new EmbedBuilder()
      .setColor(COLORS.PURPLE)
      .setTitle('🛌 PANDUAN LENGKAP & BENEFIT SEWA KOSAN & FURNITURE 🛌')
      .setThumbnail(guild.iconURL({ dynamic: true }) || null)
      .setDescription(
        `Optimalkan pendapatan harian Anda serta tingkatkan pertahanan dari aksi kriminal perampokan dengan menyewa kamar kosan premium dan berbelanja furniture berkualitas!`
      )
      .addFields(
        {
          name: '🛎️ 1. PILIHAN KAMAR KOSAN (Sewa 3 Hari)',
          value:
            `💨 **Kamar Kipas Angin:** Sewa **Rp 150**.\n` +
            `  👉 *Benefit:* Gaji harian otomatis bertambah **+Rp 5**.\n` +
            `❄️ **Kamar AC:** Sewa **Rp 350**.\n` +
            `  👉 *Benefit:* Gaji harian otomatis bertambah **+Rp 15** | Pajak transfer koin berkurang menjadi **8%** (normal 10%).\n` +
            `👑 **Penthouse Kosan:** Sewa **Rp 800**.\n` +
            `  👉 *Benefit:* Gaji harian otomatis bertambah **+Rp 40** | Pajak transfer koin berkurang menjadi **5%** | Pajak penjualan saham berkurang menjadi **10%** (normal 15%).\n` +
            `👉 *Tip:* Gunakan perintah \`.kos-sewa\` untuk memilih kamar secara instan.`,
          inline: false
        },
        {
          name: '🛒 2. UPGRADE FURNITURE KOSAN (Permanen)',
          value:
            `🛌 **Kasur Premium:** Beli **Rp 250**.\n` +
            `  👉 *Efek:* Menambahkan pengali (*multiplier*) streak klaim gaji gratis harian.\n` +
            `📶 **Koneksi WiFi:** Beli **Rp 200**.\n` +
            `  👉 *Efek:* Menghasilkan pendapatan pasif saat mengobrol di saluran suara (*Voice Channel*) hingga batas limit harian **Rp 35**.\n` +
            `🥤 **Dispenser Air:** Beli **Rp 400**.\n` +
            `  👉 *Efek:* Memberikan **peluang 10%** koin obrolan (*chatting*) ganda secara otomatis.\n` +
            `👉 *Tip:* Gunakan perintah \`.kos-upgrade\` untuk berbelanja furniture permanen.`,
          inline: false
        },
        {
          name: '🔒 3. PERTAHANAN & KEAMANAN KOSAN (Permanen)',
          value:
            `🔒 **Gembok Kamar:** Beli **Rp 300**.\n` +
            `  👉 *Efek:* Meningkatkan limit pinjaman di Central Bank **+Rp 150** | Memberikan perlindungan perampokan sebesar **50%** (mengurangi setengah kerugian saat dirampok).\n` +
            `🚨 **Alarm Keamanan:** Beli **Rp 300**.\n` +
            `  👉 *Efek:* Mengurangi peluang keberhasilan perampok yang menargetkan Anda sebesar **15%** (sukses rate rob menjadi 25%).\n` +
            `📷 **CCTV Palsu:** Beli **Rp 300**.\n` +
            `  👉 *Efek:* Menambahkan denda hukuman bagi pencuri yang gagal merampok Anda sebesar **+Rp 100** kompensasi langsung ke dompet Anda.\n` +
            `👉 *Tip:* Gunakan perintah \`.kos-upgrade\` untuk memperkuat pertahanan kamar Anda!`,
          inline: false
        }
      )
      .setFooter({ text: 'Gunakan .kos untuk membuka dashboard kamar Anda!' })
      .setTimestamp();
  },

  // 36. Bank System Guide Announcement
  bankAnnouncementEmbed(guild) {
    return new EmbedBuilder()
      .setColor(COLORS.PURPLE)
      .setTitle('🏛️ PANDUAN LENGKAP & BENEFIT CENTRAL BANK 🏛️')
      .setThumbnail(guild.iconURL({ dynamic: true }) || null)
      .setDescription(
        `Kelola keuangan Anda secara profesional di Central Bank! Simpan koin Anda di brankas yang aman atau ajukan pinjaman modal untuk mempercepat perputaran ekonomi Anda.`
      )
      .addFields(
        {
          name: '📥 1. REKENING TABUNGAN BANK (Savings)',
          value:
            `• **Deposit & Penarikan Bebas:** Simpan atau tarik koin dari dompet Anda kapan saja lewat menu \`.bank\`.\n` +
            `• **🛡️ Proteksi Anti-Rob 100%:** Koin yang disimpan di dalam tabungan bank **sepenuhnya aman** dari segala aksi pencurian (\`.rob @user\`). Korban rob hanya kehilangan uang di dompet aktif.\n` +
            `• **📈 Bunga Pasif Harian:** Dapatkan bagi hasil bunga pasif sebesar **+1.5%** dari total saldo tabungan Anda setiap hari secara otomatis.\n` +
            `👉 *Tip:* Selalu depositkan sisa koin harian Anda agar terhindar dari rampok dan tetap menghasilkan bunga pasif!`,
          inline: false
        },
        {
          name: '📜 2. LAYANAN KREDIT & PINJAMAN MODAL (Loans)',
          value:
            `• **⚖️ Limit Pinjaman Dinamis:** Batas pinjaman maksimal dihitung otomatis berdasarkan keaktifan Anda:\n` +
            `  *Formula:* **Rp 500 (Base) + 30% Total Earned + Rp 100 * Streak Daily**\n` +
            `  👉 *Tambahan Limit:* Mendapatkan **+Rp 150** limit jika Anda memasang upgrade **Gembok Kamar** di Kosan.\n` +
            `• **🗓️ Tenor & Suku Bunga Pinjaman:**\n` +
            `  - **1 Hari:** Suku Bunga **2%**\n` +
            `  - **3 Hari:** Suku Bunga **5%**\n` +
            `  - **7 Hari:** Suku Bunga **10%**\n` +
            `• **💳 Pembayaran Fleksibel:** Anda dapat mengangsur cicilan sebagian semampunya atau melunasinya langsung di dashboard.\n` +
            `• **⚠️ Sanksi Jatuh Tempo:** Keterlambatan pembayaran melebihi batas waktu akan mengubah status pinjaman menjadi \`OVERDUE\` dan dikenakan denda akumulasi harian.\n` +
            `👉 *Tip:* Pastikan melunasi utang tepat waktu untuk menjaga reputasi kredit Anda!`,
          inline: false
        }
      )
  },

  // 37. Ebyus Control Panel Embed
  ebyusControlPanelEmbed(guild, settings) {
    const gachaModeText = 
      settings.gacha_mode === 'ABUSE' ? '🔴 Abuse Mode (0% Zonk - 100% Win!)' :
      settings.gacha_mode === 'SUPER_EASY' ? '🟠 Super Easy Mode (15% Zonk)' :
      settings.gacha_mode === 'EASY' ? '🟡 Easy Mode (40% Zonk)' : '🟢 Normal Mode (75% Zonk)';
      
    const multiplierText = 
      settings.coin_multiplier > 1 ? `💀 **${settings.coin_multiplier}x Multiplier Active**` : '❌ Nonaktif (1x)';

    let durationInfoText = '♾️ **Permanen (Tanpa Batas)**';
    if (settings.expires_at > 0) {
      durationInfoText = `🕒 **Berakhir pada:** <t:${settings.expires_at}:F> (<t:${settings.expires_at}:R>)`;
    }

    return new EmbedBuilder()
      .setColor('#FF0055') // Neon Crimson Red
      .setTitle(`⚡ ABUSE CONTROL DASHBOARD — ${guild.name} ⚡`)
      .setThumbnail(guild.iconURL({ dynamic: true }) || null)
      .setDescription(
        `Selamat datang di panel kontrol sabotase ekonomi server!\n` +
        `Gunakan dropdown menu di bawah ini untuk melanggar hukum probabilitas gacha dan melipatgandakan koin chat warga secara instan!\n\n` +
        `🤖 **STATUS BYPASS EKONOMI SEKARANG:**\n` +
        `🎰 **Gacha Roll Mode:** **${gachaModeText}**\n` +
        `🪙 **Chat Multiplier:** **${multiplierText}**\n` +
        `⏱️ **Durasi Event:** ${durationInfoText}`
      )
      .addFields(
        {
          name: '🎰 1. MANIPULASI GACHA ROLE (gacha-role)',
          value: 
            `• **Normal Mode:** 75% Zonk / ampas.\n` +
            `• **Easy Mode:** 40% Zonk (Peluang menang naik 2x).\n` +
            `• **Super Easy:** 15% Zonk (Sangat mudah menang kasta role).\n` +
            `• **Abuse Mode:** **0% Zonk** (Zonk dimatikan, 100% Pasti Menang!)`,
          inline: false
        },
        {
          name: '🪙 2. PENGALI KOIN CHAT (handleEconomyChat)',
          value:
            `• Mengalikan perolehan koin chat akhir dari warga secara masif.\n` +
            `• Dapat disetel dinamis mulai dari **3x s/d 8x lipat** koin per pesan.`,
          inline: false
        },
        {
          name: '📢 3. SIARAN BROADCAST',
          value:
            `• Klik tombol **Siarkan Pengumuman** untuk mengirim pesan embed bertema neon ke channel publik agar warga segera tahu dan ikut gacha!`,
          inline: false
        }
      )
      .setFooter({ text: 'Sentinel Ebyus Panel • Dilarang disalahgunakan!' })
      .setTimestamp();
  },

  // 38. Ebyus Broadcast Embed
  ebyusBroadcastEmbed(guild, mode, multiplier, expiresAt) {
    const gachaDesc = 
      mode === 'ABUSE' ? '🔥 **0% ZONK! (100% PASTI MENANG ROLE)**' :
      mode === 'SUPER_EASY' ? '✨ **SANGAT MUDAH (Hanya 15% Zonk)**' :
      mode === 'EASY' ? '⚡ **MUDAH (Hanya 40% Zonk)**' : '🟢 Normal (75% Zonk)';

    const coinDesc = 
      multiplier > 1 ? `🎉 **PELIPATGANDAAN MASIF ${multiplier}X LIPAT KOIN CHAT**` : '🟢 Normal';

    let durationText = '';
    if (expiresAt > 0) {
      durationText = `\n\n⏳ **DURASI TERBATAS!** Efek bypass ini akan berakhir otomatis pada: <t:${expiresAt}:F> (<t:${expiresAt}:R>)`;
    }

    return new EmbedBuilder()
      .setColor('#FF007F') // Neon Hot Pink
      .setTitle(`🚨 EVENT SERVER: KEBOCORAN MODIFIKASI ADMIN ACTIVE! 🚨`)
      .setThumbnail(guild.iconURL({ dynamic: true }) || null)
      .setDescription(
        `### ⚠️ PERINGATAN WARGA KOSAN 1A! ⚠️\n` +
        `Sistem keamanan pusat server telah dimanipulasi oleh Administrator Server secara masif! Efek bypass aktif saat ini:\n\n` +
        `🎰 **SABOTASE GACHA ROLE:**\n  👉 ${gachaDesc}\n\n` +
        `🪙 **MULTIPLIER KOIN CHAT:**\n  👉 ${coinDesc}\n` +
        `${durationText}\n\n` +
        `**👉 *Jangan sia-siakan kesempatan emas ini! Segera kirim chat aktif di channel publik dan putar \`.gacha-role\` Anda sebanyak-banyaknya sebelum sistem ditutup kembali oleh sistem pusat!* ** 🎰🪙💸`
      )
      .setFooter({ text: 'Sistem Bypass Rupiah Server • Selamat meraup keuntungan!' })
      .setTimestamp();
  },

  // 39. Ebyus Status Embed
  ebyusStatusEmbed(guild, settings) {
    const gachaModeText = 
      settings.gacha_mode === 'ABUSE' ? '🔴 Abuse Mode (0% Zonk)' :
      settings.gacha_mode === 'SUPER_EASY' ? '🟠 Super Easy Mode (15% Zonk)' :
      settings.gacha_mode === 'EASY' ? '🟡 Easy Mode (40% Zonk)' : '🟢 Normal Mode (75% Zonk)';

    let durationInfoText = '♾️ **Permanen (Tanpa Batas)**';
    if (settings.expires_at > 0) {
      durationInfoText = `<t:${settings.expires_at}:F> (<t:${settings.expires_at}:R>)`;
    }

    return new EmbedBuilder()
      .setColor(COLORS.WARN)
      .setTitle(`📊 STATUS SISTEM BYPASS EBYUS — ${guild.name}`)
      .setThumbnail(guild.iconURL({ dynamic: true }) || null)
      .setDescription(
        `Rincian konfigurasi bypass ekonomi aktif di server saat ini:\n\n` +
        `🎰 **Gacha Roll Mode:** **${gachaModeText}**\n` +
        `🪙 **Chat Coin Multiplier:** **${settings.coin_multiplier}x**\n` +
        `⏱️ **Masa Aktif:** **${durationInfoText}**\n\n` +
        `🕒 **Terakhir Diupdate:** <t:${settings.updated_at}:F> (<t:${settings.updated_at}:R>)\n` +
        `👮 **Oleh Admin:** <@${settings.updated_by}>`
      )
      .setFooter({ text: 'Gunakan .ebyus untuk mengelola bypass ini secara visual!' })
      .setTimestamp();
  },

  // 40. Truth or Dare Announce Embed
  todAnnounceEmbed(guild) {
    return new EmbedBuilder()
      .setColor('#9933FF') // Deep Purple
      .setTitle('🎲 TRUTH OR DARE GAME SESSION ACTIVE! 🎲')
      .setThumbnail(guild.iconURL({ dynamic: true }) || null)
      .setDescription(
        `### 🎙️ Sesi Game Truth or Dare Telah Dibuka! 🎙️\n` +
        `Sebuah sesi permainan **Truth or Dare (Group Edition)** telah resmi diluncurkan di Voice Channel oleh Administrator server!\n\n` +
        `👥 **Ayo bergabung dan rasakan sensasinya!**\n` +
        `• Uji keberanian Anda dalam menjawab kejujuran (**Truth**) atau melakukan tantangan (**Dare**) ekstrim secara interaktif!\n` +
        `• Koin bonus melimpah bagi pemain yang berhasil menyelesaikan tantangan!\n\n` +
        `👉 **Cara Bermain:**\n` +
        `1. Masuk ke **Voice Channel** yang sama dengan Bot.\n` +
        `2. Cari pesan lobby game dan klik tombol **🙋‍♂️ Gabung**.\n` +
        `3. Tunggu Host memulai permainan!`
      )
      .setFooter({ text: 'Sentinel ToD Game System • Selamat bersenang-senang!' })
      .setTimestamp();
  }
};


