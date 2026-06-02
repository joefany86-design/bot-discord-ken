const { EmbedBuilder } = require('discord.js');
const config = require('./config');
const db = require('./database');

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
 * Membuat grafik mini ASCII (sparkline) dari array harga saham histori secara horizontal ringkas.
 */
function getInlineSparkline(prices) {
  if (!prices || prices.length < 2) return '`[───]`';
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min;
  const chars = [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

  const spark = prices.map(p => {
    if (range === 0) return chars[3];
    const idx = Math.floor(((p - min) / range) * (chars.length - 1));
    return chars[idx];
  }).join('');

  return `\`[${spark}]\``;
}

/**
 * Membuat progress bar ketersediaan saham di bursa.
 */
function getMarketProgressBar(available, total, size = 10) {
  const sold = total - available;
  const filledCount = Math.min(size, Math.max(0, Math.round((sold / total) * size)));
  const emptyCount = size - filledCount;
  return '▰'.repeat(filledCount) + '▱'.repeat(emptyCount);
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

// Warna Dinamis per Spesies Pet (untuk embed yang lebih hidup)
const PET_COLORS = {
  SLIME: 0x00FF88, // Neon Green
  DRAGON: 0xFF6B35, // Blazing Orange
  CAT: 0xFF69B4, // Hot Pink
  GOLEM: 0x8B7355, // Earthen Brown
  EGG: 0xFFD700, // Golden
  DEAD: 0x2C2F33  // Dark Grey
};

// GIF Assets per Species/Stage dari sumber reliable (media.tenor.com & media.giphy.com)
const PET_ASSETS = {
  // 🥚 Telur menetas — animasi telur bergetar / menetas
  EGG: [
    'https://media.tenor.com/Ns7iP4fWsUQAAAAC/egg-easter-egg.gif',
    'https://media1.tenor.com/m/rI6KDaQGE48AAAAC/potz-content-potz.gif',
    'https://i.giphy.com/media/mSuzNvPvE2KFrGpywl/giphy.gif',
    'https://i.giphy.com/media/fX8zOAyerYzd3UPtBH/giphy.gif',
    'https://i.giphy.com/media/3oEdv9R4D62GPrVY4g/giphy.gif'
  ],
  // 🪦 Pet mati — animasi sedih / RIP
  DEAD: [
    'https://i.giphy.com/media/ukNqewtLpt81JN7SIS/giphy.gif',
    'https://i.giphy.com/media/pVGsAWjzvXcZW4ZBTE/giphy.gif',
    'https://i.giphy.com/media/xThuWhGG79OblPr368/giphy.gif',
    'https://i.giphy.com/media/xUPJPn8l1m8odg1Bxm/giphy.gif'
  ],
  // 🟢 Slime — animasi slime lucu bergerak-gerak
  SLIME: {
    BABY: [
      'https://media.tenor.com/y596ptM1394AAAAC/slime-pixel-art.gif',
      'https://media.tenor.com/TVdvv_3wKY8AAAAC/glorp-bouncing-slime.gif',
      'https://media.tenor.com/bIs7ms2JdRIAAAAC/slime-bouncing.gif',
      'https://media.tenor.com/OUSsQCqKT-EAAAAC/slime.gif',
      'https://media.tenor.com/Hw9CvBd8mx4AAAAC/slime-pixel.gif'
    ],
    ADULT: [
      'https://media.tenor.com/mgZBc6GhNlUAAAAC/game-pixel-art.gif',
      'https://media.tenor.com/GvwoI9f1lyQAAAAC/dragon-dragon-quest.gif',
      'https://media.tenor.com/1AdjvXKcJjIAAAAC/slime-slime-chamber.gif',
      'https://media.tenor.com/NGUJV2lqUx0AAAAC/slime-morphing.gif',
      'https://media.tenor.com/Bfc_sJd7yuEAAAAC/terraria-terraria-mod.gif'
    ]
  },
  // 🔥 Dragon — animasi naga keren bernapas api
  DRAGON: {
    BABY: [
      'https://i.giphy.com/media/Pyp923TIC4Iq4/giphy.gif',
      'https://i.giphy.com/media/Xb2Bw5hUU56XsudVF8/giphy.gif',
      'https://i.giphy.com/media/AHMPR6ASCvZY17KsdB/giphy.gif',
      'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExcTJ5dDN6OGVqeXNkY2tlbnRwb2V6MXVnM2N1N2doczRwd2phZTZ6YiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/l3vRfcPYG4f9eTi5W/giphy.gif',
      'https://i.giphy.com/media/3o7qE1YN7aBOFPRw8E/giphy.gif'
    ],
    ADULT: [
      'https://i.giphy.com/media/JMqM0nNT3AXS8xuiIZ/giphy.gif',
      'https://i.giphy.com/media/TjjLhpZU4roPz4SkW5/giphy.gif',
      'https://i.giphy.com/media/RlfsTNtMxGhb4T7P07/giphy.gif',
      'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExZnVwNm1keHV1MTY1aGNjdzYxNnFqNmRlaXA1MW1oOGF0c2dwcGw3bSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/IgnSR1lnLxMxq/giphy.gif',
      'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExYjR3Z21oMzF0Y3I0b3RqcjF5NGRteWk5bDR5OTJ3emk3OXg3ZjY2byZlcD12MV9naWZzX3NlYXJjaCZjdD1n/12PA1eI8FBqEBa/giphy.gif'
    ]
  },
  // 🐱 Cat — animasi kucing menggemaskan
  CAT: {
    BABY: [
      'https://i.giphy.com/media/gx54W1mSpeYMg/giphy.gif',
      'https://i.giphy.com/media/MSemvqMIRY3jMcvpd2/giphy.gif',
      'https://i.giphy.com/media/VCP6Kpf6guFm4nnF04/giphy.gif',
      'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExc2w2OGRqcWM3NG95d3IxcTl2eWljcWthazg3a3V5Y3pkaThvbzlodSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/ND6xkVPaj8tHO/giphy.gif',
      'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExd2xjMmIwMWYwdWluaHhxcXRkaWtvdWcxMXJ3YmlmaWJ6NjlnODhyMiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/VbnUQpnihPSQgIXuZv/giphy.gif'
    ],
    ADULT: [
      'https://i.giphy.com/media/U6Xgx1pCLMPFaO0Uw3/giphy.gif',
      'https://i.giphy.com/media/2wicMBKqNZlrW/giphy.gif',
      'https://i.giphy.com/media/1k1ytCiReJMZWVtjXd/giphy.gif',
      'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExdXg4aGQ5ZWc0NjBhaGZqcjYxZjVzZG92cW5xMDhxbXlxbnNoMHRwNCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/mlvseq9yvZhba/giphy.gif',
      'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExcGw0aWViZnpyNGlkNndtMGN1cXRvenR3MGo2c2E5Y2h3NDZoMjc1MSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/nR4L10XlJcSeQ/giphy.gif'
    ]
  },
  // 🧱 Golem — animasi golem batu bergerak
  GOLEM: {
    BABY: [
      'https://i.giphy.com/media/3s4pjpA8Vb7lTy73Nn/giphy.gif',
      'https://i.giphy.com/media/BU327u9UNM2Sk/giphy.gif',
      'https://media.tenor.com/R4QclJPFD1gAAAAC/16bit-80s.gif',
      'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExaHl0Y3E1OGlwbTdndm1jcDNkYzI4cDhtNWtsN2s2bHdjMG5vMnR3MSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/Bm6jG0kRO0f4I/giphy.gif'
    ],
    ADULT: [
      'https://i.giphy.com/media/7ueLs2fU5c8QeeYHKg/giphy.gif',
      'https://i.giphy.com/media/4YHLDTS2yKKZpnZ9WN/giphy.gif',
      'https://i.giphy.com/media/Ss6CM89p5n3yBYfQ0P/giphy.gif',
      'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExaWJkdnVjbHlydWVwMTN6YXdpMnVjMWRzeW1lYnU0ZnQ2N3IzcTBkYyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3oKIPftHL9gnnaoiR2/giphy.gif',
      'https://media.tenor.com/ykpEHGFKYDoAAAAC/elements-solana.gif'
    ]
  },
  // GIF khusus untuk aksi/interaksi tertentu
  ACTION: {
    WORK: [
      'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExemV3NmRjNHo2dHR0Z3RyY2p5YW92YnhxMzJnbmU0YjNpMjhnN2FkaCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/SACoDGYTvVNhZYNb5R/giphy.gif',
      'https://media.tenor.com/eKcQ9MT2dR8AAAAC/uwu-cute.gif'
    ],
    HUNT: [
      'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExcGRhajU1ZnJweGIxYnE4YTlxbng4c2V3eThjcXlyOTd3MDE0eXlubCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3ohs7QSgtSfCXs3hcc/giphy.gif'
    ],
    PVP: [
      'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExdDZtM3lhNGd2ZGQxeG53bXQ2dnRxODFhbHFtMjBjOHJiMGI0cW1hMCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/2zoCbKY7jYAfm/giphy.gif'
    ],
    EXPEDITION: [
      'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHA2ZjExbWE2NTNjNGpuNHVsam1mZGJicHlhbHRhbTIyZmFxZzI3eCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/l3vR4aFafvy4xRn6E/giphy.gif'
    ],
    PLAY: [
      'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExb3h0YXR6Z2hhMThkeTUycjIwcnRnYmV6YmhtOHY2ZW0yMmk1MHhmeCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/5i7umUqAOYYEw/giphy.gif'
    ]
  }
};

function getPetImage(pet) {
  if (!pet) return null;

  if (pet.custom_image) {
    return pet.custom_image;
  }

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

  // 1. Embed Saldo / Profile (Portrait UI — Full Description)
  profileEmbed(user, wallet, portfolioValue, member = null, shopItems = [], pet = null, activeLoan = null, bailDebts = null, portfolioItems = []) {
    // Ambil saldo bank savings secara langsung dari database
    let bankBalance = 0;
    try {
      const savingsRow = db.get(
        'SELECT balance FROM bank_savings WHERE user_id = ? AND guild_id = ?',
        [user.id, wallet.guild_id]
      );
      if (savingsRow) {
        bankBalance = savingsRow.balance;
      }
    } catch (e) {
      console.error("Gagal memuat saldo bank untuk profile:", e.message);
    }

    const totalWealth = wallet.balance + portfolioValue + bankBalance;

    // Dynamic accent color
    let accentColor = COLORS.INFO;
    if (portfolioItems.length > 0) {
      const totalProfit = portfolioItems.reduce((sum, i) => sum + i.profitRp, 0);
      if (totalProfit > 0) accentColor = 0x00D166;
      else if (totalProfit < 0) accentColor = 0xED4245;
    }

    // Helper to center pure ASCII text in a 23-character box
    const centerText = (text, width = 23) => {
      const padTotal = width - text.length;
      if (padTotal <= 0) return text;
      const padLeft = Math.floor(padTotal / 2);
      const padRight = padTotal - padLeft;
      return ' '.repeat(padLeft) + text + ' '.repeat(padRight);
    };

    // Wealth tier badge details
    const getTierInfo = (t) => {
      if (t >= 50000) return { name: 'DIAMOND', emoji: '💎' };
      if (t >= 20000) return { name: 'GOLD', emoji: '👑' };
      if (t >= 10000) return { name: 'SILVER', emoji: '🥈' };
      if (t >= 5000) return { name: 'BRONZE', emoji: '🥉' };
      return { name: 'STARTER', emoji: '🪵' };
    };

    const tier = getTierInfo(totalWealth);

    const streakEmoji = wallet.streak_days >= 7 ? '🔥' : wallet.streak_days >= 3 ? '⚡' : '💤';

    // ═══ BUILD DESCRIPTION ═══
    let desc = '';

    // ── HEADER ──
    desc += `💼 **FINANCIAL DASHBOARD** · ${tier.emoji} **${tier.name} MEMBER**\n`;
    desc += `\`\`\`\n`;
    desc += `┌───────────────────────┐\n`;
    desc += `│${centerText('FINANCIAL DASHBOARD', 23)}│\n`;
    desc += `│${centerText(`${tier.name} TIER`, 23)}│\n`;
    desc += `└───────────────────────┘\n`;
    desc += `\`\`\`\n`;

    // ── RINGKASAN KEUANGAN ──
    desc += `> 💵 **Saldo Dompet**\n`;
    desc += `> \`Rp ${wallet.balance.toLocaleString('id-ID').padStart(12)}\`\n`;
    desc += `> \n`;
    desc += `> 🏦 **Saldo Bank**\n`;
    desc += `> \`Rp ${bankBalance.toLocaleString('id-ID').padStart(12)}\`\n`;
    desc += `> \n`;
    desc += `> 📊 **Nilai Investasi**\n`;
    desc += `> \`Rp ${portfolioValue.toLocaleString('id-ID').padStart(12)}\`\n`;
    desc += `> \n`;
    desc += `> 💎 **Total Kekayaan**\n`;
    desc += `> \`Rp ${totalWealth.toLocaleString('id-ID').padStart(12)}\`\n\n`;

    // ── STATISTIK ──
    desc += `${streakEmoji} **Statistik**\n`;
    desc += `┊ 🔥 Streak: **${wallet.streak_days}** hari\n`;
    desc += `┊ 📈 Earning: **${formatCurrency(wallet.total_earned)}**\n`;
    desc += `┊ 🤖 Auto-Trade: ${wallet.auto_trade ? '🟢 Aktif' : '🔴 Nonaktif'}\n`;
    desc += `┊ 🚨 Penjara: **${wallet.jail_count || 0}** kali\n\n`;

    // ── KOLEKSI MEWAH / BADGES ──
    try {
      const luxuryItems = db.all(
        "SELECT item_id, quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id IN ('LAMBO', 'GOLD', 'ROLEX') AND quantity > 0",
        [user.id, wallet.guild_id]
      );
      if (luxuryItems && luxuryItems.length > 0) {
        let badgesText = '';
        luxuryItems.forEach(item => {
          if (item.item_id === 'LAMBO') badgesText += '🏎️ `[ SULTAN LAMBO ]` ';
          if (item.item_id === 'GOLD') badgesText += '👑 `[ EMAS BATANGAN ]` ';
          if (item.item_id === 'ROLEX') badgesText += '⌚ `[ ROLEX OWNER ]` ';
        });
        if (badgesText.length > 0) {
          desc += `🏆 **Lencana Status Mewah**\n┊ ${badgesText}\n\n`;
        }
      }
    } catch (e) {
      console.error("Gagal memuat lencana mewah:", e.message);
    }

    // ── PORTOFOLIO SAHAM ──
    if (portfolioItems.length > 0) {
      let totalInvested = 0;
      let totalCurrent = 0;

      desc += `📈 **Portofolio Saham** (${portfolioItems.length} aset)\n`;

      portfolioItems.forEach(item => {
        totalInvested += item.totalInvested;
        totalCurrent += item.currentValue;

        const emoji = item.profitRp > 0 ? '🟢' : item.profitRp < 0 ? '🔴' : '⚪';
        const arrow = item.profitRp > 0 ? '▲' : item.profitRp < 0 ? '▼' : '─';
        const sign = item.profitRp > 0 ? '+' : '';
        const plPercent = `${sign}${item.profitPercent}%`;
        const profitVal = `${sign}Rp ${Math.abs(item.profitRp).toLocaleString('id-ID')}`;
        const plDetail = item.profitRp !== 0 ? `${plPercent} (${profitVal})` : '0%';

        desc += `┊ ${emoji} **${item.ticker}** · \`${item.shares} lbr\`\n`;
        desc += `┊    Harga: \`Rp ${item.currentPrice.toLocaleString('id-ID')}\` · PnL: \`${arrow} ${plDetail}\`\n`;
      });

      const totalPL = totalCurrent - totalInvested;
      const totalPLPct = totalInvested > 0 ? ((totalPL / totalInvested) * 100).toFixed(1) : '0.0';
      const totalPLArrow = totalPL > 0 ? '▲' : totalPL < 0 ? '▼' : '─';
      const totalPLEmoji = totalPL > 0 ? '🟢' : totalPL < 0 ? '🔴' : '⚪';

      desc += `┊ ──\n`;
      desc += `┊ ${totalPLEmoji} **Total Valuasi**: \`Rp ${totalCurrent.toLocaleString('id-ID')}\`\n`;
      const totalPLSign = totalPL > 0 ? '+' : '';
      const totalPLDetail = totalPL !== 0 ? `${totalPLSign}${totalPLPct}% (${totalPLSign}Rp ${Math.abs(totalPL).toLocaleString('id-ID')})` : '0%';
      desc += `┊    Estimasi PnL: \`${totalPLArrow} ${totalPLDetail}\`\n\n`;
    } else {
      desc += `📈 **Portofolio Saham** (0 aset)\n`;
      desc += `┊ *Belum punya saham.*\n`;
      desc += `┊ *Beli di \`.market\` atau \`.trade\`*\n\n`;
    }

    // ── UTANG BANK ──
    if (activeLoan) {
      const totalDebt = activeLoan.total_due + (activeLoan.penalty_accumulated || 0);
      const status = activeLoan.status === 'OVERDUE' ? '🚨 JATUH TEMPO' : '⏳ Aktif';
      desc += `🏛️ **Utang Bank** — ${status}\n`;
      desc += `┊ 💸 **Rp ${totalDebt.toLocaleString('id-ID')}**\n`;
      desc += `┊ 📅 Tempo: <t:${activeLoan.due_at}:d> (<t:${activeLoan.due_at}:R>)\n\n`;
    }

    // ── HUTANG TEBUSAN ──
    if (bailDebts) {
      const { debts, receivables } = bailDebts;
      const hasDebts = (debts && debts.length > 0) || (receivables && receivables.length > 0);
      if (hasDebts) {
        desc += `🤝 **Hutang & Piutang**\n`;
        if (debts && debts.length > 0) {
          debts.forEach(d => {
            desc += `┊ 🔴 → <@${d.creditor_id}>: **Rp ${d.amount.toLocaleString('id-ID')}**\n`;
          });
        }
        if (receivables && receivables.length > 0) {
          receivables.forEach(r => {
            desc += `┊ 🟢 ← <@${r.debtor_id}>: **Rp ${r.amount.toLocaleString('id-ID')}**\n`;
          });
        }
        desc += `\n`;
      }
    }

    // ── PET ──
    desc += `🐾 **Peliharaan**\n`;
    if (pet) {
      if (pet.status === 'EGG') {
        desc += `┊ 🥚 Telur — Menetas <t:${pet.hatch_at}:R>\n`;
        desc += `┊ Nama: **${pet.pet_name}**\n`;
      } else if (pet.status === 'DEAD') {
        desc += `┊ 🪦 **${pet.pet_name}** telah meninggal\n`;
        desc += `┊ *Ketik \`.pet reset\` untuk adopsi baru*\n`;
      } else {
        const typeEmoji = pet.pet_type === 'SLIME' ? '🟢' : pet.pet_type === 'DRAGON' ? '🔥' : pet.pet_type === 'CAT' ? '🐱' : '🧱';
        const { getXpNeeded } = require('./pet');
        const xpNeeded = getXpNeeded(pet.level, pet.trait);
        const xpRatio = Math.min(1, pet.xp / (xpNeeded || 1));
        const barLen = 8;
        const filled = Math.round(xpRatio * barLen);
        const xpBar = '▓'.repeat(filled) + '░'.repeat(barLen - filled);

        let traitLabel = '';
        if (pet.trait) {
          const t = pet.trait.toUpperCase();
          if (t === 'GENIUS') traitLabel = ' · 🧠';
          else if (t === 'STURDY') traitLabel = ' · 🛡️';
          else if (t === 'MUTANT') traitLabel = ' · 🧬';
          else if (t === 'WARRIOR') traitLabel = ' · ⚔️';
        }

        desc += `┊ ${typeEmoji} **${pet.pet_name}** Lv.**${pet.level}**${traitLabel}\n`;
        desc += `┊ XP \`${xpBar}\` \`${pet.xp}/${xpNeeded}\`\n`;
        desc += `┊ ❤️\`${pet.health}%\` 🍖\`${pet.hunger}%\` 💧\`${pet.thirst}%\` ⚽\`${pet.happiness}%\`\n`;
      }
    } else {
      desc += `┊ *Belum punya — \`.pet buy <nama> <spesies>\`*\n`;
    }
    desc += `\n`;

    // ── ROLE PRESTISE ──
    if (member && shopItems && shopItems.length > 0) {
      const TIER_EMOJIS = { COMMON: '🟢', RARE: '🔵', EPIC: '🟣', LEGENDARY: '👑', MYTHIC: '🌟' };
      const owned = [];
      shopItems.forEach(item => {
        if (member.roles.cache.has(item.role_id)) {
          const emoji = TIER_EMOJIS[item.tier?.toUpperCase()] || '🟢';
          owned.push(`${emoji} ${item.role_name}`);
        }
      });

      if (owned.length > 0) {
        desc += `🎭 **Role Prestise** (${owned.length}/${shopItems.length})\n`;
        owned.forEach(r => { desc += `┊ ${r}\n`; });
      } else {
        desc += `🎭 **Role Prestise** — *Belum punya*\n`;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(accentColor)
      .setAuthor({ name: `${user.username}`, iconURL: user.displayAvatarURL({ dynamic: true }) })
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setDescription(desc)
      .setFooter({ text: '💡 .daily · .market · .porto · .shop · .pet · .kos' })
      .setTimestamp();

    return embed;
  },

  // 2. Embed Klaim Harian (.daily)
  dailyClaimEmbed(user, result) {
    const embed = new EmbedBuilder()
      .setThumbnail(user.displayAvatarURL({ dynamic: true }));

    if (result.success) {
      let desc = `Selamat **${user.username}**! Kamu mendapatkan **${formatCurrency(result.reward)}** hari ini.\n\n` +
        `💰 Hadiah Dasar: \`${formatCurrency(result.baseReward)}\`\n` +
        `🔥 Bonus Streak: \`${formatCurrency(result.streakBonus)}\` (${result.streak} hari)`;

      if (result.roomBonus > 0) {
        desc += `\n🛌 Bonus Kamar (${result.roomName}): \`${formatCurrency(result.roomBonus)}\``;
      }

      if (result.debtPaidDetails) {
        const { creditorId, paidAmount, remainingDebt } = result.debtPaidDetails;
        desc += `\n\n⚠️ **POTONGAN HUTANG OTOMATIS!**\n` +
          `Sebesar **${formatCurrency(paidAmount)}** (50% dari hadiah) dipotong secara otomatis untuk mencicil hutang tebusan Anda kepada <@${creditorId}>.\n` +
          `╰ 💰 Bersih Diterima: **${formatCurrency(result.finalReward)}**\n` +
          `╰ 🧾 Sisa Hutang Anda: **${remainingDebt > 0 ? formatCurrency(remainingDebt) : '✨ LUNAS!'}**`;
      }

      embed
        .setColor(COLORS.SUCCESS)
        .setTitle('🎉 Hadiah Harian Berhasil Diklaim!')
        .setDescription(desc)
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
        `*Harga saham ter-update otomatis setiap 2 jam berdasarkan keaktifan chat.*\n\n` +
        `🔒 **Regulasi Perdagangan (Anti-Hoarding):**\n` +
        `• ⏳ **Hold 24 Jam:** Saham wajib disimpan minimal **24 jam** setelah dibeli sebelum bisa dijual.\n` +
        `• 📥 **Limit Harian:** Maksimal **10 kali transaksi** beli per hari per user.\n` +
        `• 👤 **Limit Milik:** Maksimal hanya bisa memiliki **100 lembar** per saham per user.\n` +
        `• 📤 **Limit Sekali Jual:** Maksimal **100 lembar** dalam satu transaksi penjualan.\n` +
        `────────────────────────────────────────`
      );

    if (stocks.length === 0) {
      embed.addFields({ name: '🚫 Bursa Kosong', value: 'Belum ada saham channel terdaftar.' });
    } else {
      let desc = embed.data.description || '';
      desc += '\n\n';

      stocks.forEach((stock, idx) => {
        const diff = stock.current_price - stock.previous_price;
        const pct = stock.previous_price > 0 ? ((diff / stock.previous_price) * 100).toFixed(1) : '0.0';
        const trendEmoji = diff > 0 ? '📈' : diff < 0 ? '📉' : '↔️';
        const trendColor = diff > 0 ? '🟢 +' : diff < 0 ? '🔴 ' : '⚪ ';

        // Ambil riwayat harga 5 pembaruan terakhir dari price_history untuk sparkline
        let prices = [];
        try {
          const history = db.all(
            'SELECT price FROM price_history WHERE channel_id = ? AND guild_id = ? ORDER BY id DESC LIMIT 5',
            [stock.channel_id, stock.guild_id]
          );
          prices = history.reverse().map(h => h.price);
        } catch (err) {
          console.error(`Gagal mengambil histori harga untuk ${stock.stock_ticker}:`, err);
        }

        // Pastikan harga saat ini ada di akhir list histori jika belum tercatat
        if (prices.length === 0 || prices[prices.length - 1] !== stock.current_price) {
          prices.push(stock.current_price);
          if (prices.length > 5) prices.shift();
        }

        const sparkline = getInlineSparkline(prices);
        const barSize = 10;
        const soldCount = stock.total_shares - stock.available_shares;
        const soldPct = ((soldCount / stock.total_shares) * 100).toFixed(0);
        const stockText = stock.total_shares === 99999999 
          ? '`Tanpa Batas (♾️)`' 
          : `\`${stock.available_shares.toLocaleString('id-ID')} / ${stock.total_shares.toLocaleString('id-ID')}\` lembar`;
        const progressBarText = stock.total_shares === 99999999
          ? '`Tersedia Melimpah ⚡`'
          : `\`${getMarketProgressBar(stock.available_shares, stock.total_shares, barSize)}\` *(${soldPct}% Terbeli)*`;

        desc += `🔹 **${stock.stock_ticker}** — <#${stock.channel_id}>\n` +
          `   ├─ 💵 **Harga** : **${formatCurrency(stock.current_price)}** / lembar\n` +
          `   ├─ 📊 **Tren**  : ${trendColor}**${pct}%** (${trendEmoji}) ${sparkline}\n` +
          `   ├─ 📦 **Stok**  : ${stockText}\n` +
          `   └─ 🛡️ **Pasar** : ${progressBarText}\n\n`;
      });

      desc += `────────────────────────────────────────`;
      embed.setDescription(desc);
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
        { name: '🏛️ Stok Pasar', value: stock.total_shares === 99999999 ? '`Tanpa Batas (♾️)`' : `\`${stock.available_shares.toLocaleString('id-ID')} / ${stock.total_shares.toLocaleString('id-ID')} lembar\``, inline: true },
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
        { name: '🏛️ Sisa Bursa', value: stock.total_shares === 99999999 ? '`Tanpa Batas (♾️)`' : `\`${stock.available_shares.toLocaleString('id-ID')} / ${stock.total_shares.toLocaleString('id-ID')} lembar\``, inline: true },
        {
          name: '📈 Statistik Grafik (Range)', value:
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
    const guild = client.guilds.cache.find(g => g.name === guildName);
    const iconUrl = guild ? guild.iconURL({ dynamic: true, size: 256 }) : null;

    const embed = new EmbedBuilder()
      .setColor(0xFFD700) // Premium Gold Color!
      .setTitle(`🏆 PAPAN PERINGKAT ORANG TERKAYA — ${guildName.toUpperCase()}`)
      .setDescription(
        `👑 **KONGLEMERAT RUPIAH SERVER KOSAN 1A** 👑\n` +
        `*10 warga terhormat dengan akumulasi aset (Dompet + Saham + Bank) tertinggi.*\n` +
        `────────────────────────────────────────`
      );

    if (iconUrl) {
      embed.setThumbnail(iconUrl);
    }

    if (leaderboard.length === 0) {
      embed.addFields({ name: '🚫 Kosong', value: 'Belum ada data ekonomi untuk server ini.' });
    } else {
      let ranks = '';
      leaderboard.forEach((user, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `\`#${idx + 1}\``;
        const member = client.users.cache.get(user.userId);
        const name = member ? `**${member.username}**` : `<@${user.userId}>`;

        ranks += `${medal} ${name}\n` +
          `   ├─ 💵 Dompet : \`${formatCurrency(user.balance)}\`\n` +
          `   ├─ 📊 Saham  : \`${formatCurrency(user.portfolioValue)}\`\n` +
          `   ├─ 🏦 Bank   : \`${formatCurrency(user.bankBalance)}\`\n` +
          `   └─ 💎 **Total : \`${formatCurrency(user.totalWealth)}\`**\n\n`;
      });
      embed.setDescription(embed.data.description + '\n\n' + ranks + '────────────────────────────────────────');
    }

    return embed.setTimestamp();
  },

  // 7b. Embed Papan Peringkat Belum Ambil Daily
  dailyLeaderboardEmbed(guildName, list, client) {
    const guild = client.guilds.cache.find(g => g.name === guildName);
    const iconUrl = guild ? guild.iconURL({ dynamic: true, size: 256 }) : null;

    const embed = new EmbedBuilder()
      .setColor(0xFF3366) // Neon Hot Pink (COLORS.ERROR)
      .setTitle(`🚨 TARGET ROB: BELUM AMBIL DAILY — ${guildName.toUpperCase()}`)
      .setDescription(
        `💰 **DAFTAR WARGA YANG BELUM KLAIM GAJI HARI INI** 💰\n` +
        `*10 warga terkaya yang belum mengetik \`.daily\` atau mengklaim gaji hari ini.*\n` +
        `*Peluang mencuri uang mereka meningkat menjadi **50%** menggunakan perintah \`.rob\`!*\n` +
        `────────────────────────────────────────`
      );

    if (iconUrl) {
      embed.setThumbnail(iconUrl);
    }

    if (list.length === 0) {
      embed.addFields({ name: '🎉 Aman!', value: 'Semua warga sudah mengklaim gaji harian mereka hari ini.' });
    } else {
      let ranks = '';
      list.forEach((user, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `\`#${idx + 1}\``;
        const member = client.users.cache.get(user.user_id);
        const name = member ? `**${member.username}**` : `<@${user.user_id}>`;
        const klaim = user.last_active_date || 'Belum Pernah';

        ranks += `${medal} ${name}\n` +
          `   ├─ 💵 Saldo Dompet : \`${formatCurrency(user.balance)}\`\n` +
          `   ├─ 📅 Klaim Terakhir: \`${klaim}\`\n` +
          `   └─ 🔥 Streak Harian: \`${user.streak_days} hari\`\n\n`;
      });
      embed.setDescription(embed.data.description + '\n\n' + ranks + '────────────────────────────────────────');
    }

    return embed.setTimestamp();
  },

  // 7c. Embed Papan Peringkat Top Pencuri (Thief Leaderboard)
  thiefLeaderboardEmbed(guildName, list, client) {
    const guild = client.guilds.cache.find(g => g.name === guildName);
    const iconUrl = guild ? guild.iconURL({ dynamic: true, size: 256 }) : null;

    const embed = new EmbedBuilder()
      .setColor(0x2C3E50) // Midnight Dark Blue
      .setTitle(`🕵️‍♂️ PAPAN PERINGKAT: TOP PENCURI KOSAN 1A — ${guildName.toUpperCase()}`)
      .setDescription(
        `🚨 **BURONAN KELAS KAKAP & KOMPLOTAN KRIMINAL** 🕵️‍♂️\n` +
        `*10 pencuri paling sukses berdasarkan akumulasi hasil curian (Solo + Heist).*\n` +
        `────────────────────────────────────────`
      );

    if (iconUrl) {
      embed.setThumbnail(iconUrl);
    } else {
      embed.setThumbnail('https://cdn-icons-png.flaticon.com/512/1864/1864509.png');
    }

    if (list.length === 0) {
      embed.addFields({ name: '🕊️ Kota Damai', value: 'Belum ada warga yang berhasil mencuri koin warga lain.' });
    } else {
      let ranks = '';
      list.forEach((user, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `\`#${idx + 1}\``;
        const member = client.users.cache.get(user.user_id);
        const name = member ? `**${member.username}**` : `<@${user.user_id}>`;

        ranks += `${medal} ${name}\n` +
          `   ├─ 💸 **Total Jarahan: \`${formatCurrency(user.total_stolen)}\`**\n` +
          `   ├─ 👤 Solo Rob   : \`${formatCurrency(user.solo_stolen)}\`\n` +
          `   ├─ 👥 Group Heist: \`${formatCurrency(user.heist_stolen)}\`\n` +
          `   ├─ 📈 Sukses     : \`${user.success_count} kali\`\n` +
          `   └─ 👮 Dipenjara   : \`${user.jail_count} kali\`\n\n`;
      });
      embed.setDescription(embed.data.description + '\n\n' + ranks + '────────────────────────────────────────');
    }

    return embed.setTimestamp();
  },

  // 7a. Embed Papan Peringkat Pet (Pet Leaderboard)
  petLeaderboardEmbed(guildName, topPets, category, client) {
    const guild = client.guilds.cache.find(g => g.name === guildName);
    const iconUrl = guild ? guild.iconURL({ dynamic: true, size: 256 }) : null;

    let catName = 'LEVEL & XP';
    let catFooter = 'Ketik `.pet top pvp` untuk melihat pet petarung terkuat!';
    if (category === 'pvp') {
      catName = 'KEMENANGAN PVP ARENA';
      catFooter = 'Ketik `.pet top cp` untuk melihat pet dengan kekuatan tempur tertinggi!';
    } else if (category === 'cp') {
      catName = 'COMBAT POWER (CP)';
      catFooter = 'Ketik `.pet top level` untuk melihat pet dengan level tertinggi!';
    }

    const embed = new EmbedBuilder()
      .setColor(0x00FF88) // Neon Emerald Green
      .setTitle(`🏆 PAPAN PERINGKAT PET TERHEBAT — ${guildName.toUpperCase()}`)
      .setDescription(
        `🦁 **TAMAGOTCHI PET HALL OF FAME** 🦁\n` +
        `*10 peliharaan terkuat di server berdasarkan kategori **${catName}**.*\n` +
        `────────────────────────────────────────`
      );

    if (iconUrl) {
      embed.setThumbnail(iconUrl);
    }

    const getTierLabel = (lvl) => {
      if (lvl >= 90) return '👑 GODLIKE CLASS';
      if (lvl >= 70) return '🌟 MYTHIC CLASS';
      if (lvl >= 50) return '🏆 LEGENDARY CLASS';
      if (lvl >= 25) return '🛡️ ELITE CLASS';
      return '🪵 STARTER CLASS';
    };

    const getSpeciesName = (type) => {
      const sp = {
        SLIME: 'Slime 🟢',
        DRAGON: 'Dragon 🔥',
        CAT: 'Cat 🐱',
        GOLEM: 'Golem 🧱'
      };
      return sp[type] || type;
    };

    if (topPets.length === 0) {
      embed.addFields({ name: '🚫 Kosong', value: 'Belum ada data peliharaan aktif di server ini.' });
    } else {
      let ranks = '';
      topPets.forEach((p, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `\`#${idx + 1}\``;
        const owner = client.users.cache.get(p.user_id);
        const ownerName = owner ? owner.username : p.user_id;

        // Custom stats detail based on category
        let categoryDetail = '';
        if (category === 'pvp') {
          const totalGames = (p.pvp_wins || 0) + (p.pvp_losses || 0);
          const wr = totalGames > 0 ? (((p.pvp_wins || 0) / totalGames) * 100).toFixed(0) : '0';
          categoryDetail = `🏆 **${p.pvp_wins || 0} Wins** (Lose: \`${p.pvp_losses || 0}\` | WR: \`${wr}%\`)`;
        } else if (category === 'cp') {
          categoryDetail = `⚡ **${p.cp || 0} CP**`;
        } else {
          categoryDetail = `📈 **Lv.${p.level}** (XP: \`${p.xp}\`)`;
        }

        const traitLabel = p.trait ? ` (${p.trait.toUpperCase()})` : '';
        const hpVal = Math.round(p.health || 0);
        const hungerVal = Math.round(p.hunger || 0);
        const thirstVal = Math.round(p.thirst || 0);
        const happyVal = Math.round(p.happiness || 0);

        ranks += `${medal} **${p.pet_name}** — *Milik ${ownerName}*\n` +
          `┗ 🐾 *${getSpeciesName(p.pet_type.toUpperCase())}${traitLabel}* • ${categoryDetail}\n` +
          `┗ 🧬 ❤️\`${hpVal}%\` 🍖\`${hungerVal}%\` 💧\`${thirstVal}%\` ⚽\`${happyVal}%\` • \`${getTierLabel(p.level)}\` • \`🟢 ${p.status.toUpperCase()}\`\n\n`;
      });
      embed.setDescription(embed.data.description + '\n\n' + ranks + '────────────────────────────────────────');
    }

    embed.setFooter({ text: catFooter });
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
        `├─ 🟢 COMMON    : \`70.0%\`\n` +
        `├─ 🔵 RARE      : \`22.0%\`\n` +
        `├─ 🟣 EPIC      : \`6.8%\`\n` +
        `├─ 👑 LEGENDARY : \`1.1%\`\n` +
        `├─ 🌟 MYTHIC    : \`0.1%\` *(Jackpot Dewa!)*\n` +
        `└─ 🗑️ ZONK      : \`???\` *(Dapatkan item sampah kocak)*\n` +
        `────────────────────────────────────────`
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
          const emoji = TIER_EMOJIS[tierName] || '🟢';
          let content = '';
          tierItems.forEach(item => {
            // Format info stok
            let stockInfo = '`♾️ Tanpa Batas`';
            if (item.stock !== -1) {
              if (item.stock <= 0) {
                stockInfo = '🔴 **[ SOLD OUT ]**';
              } else {
                stockInfo = `⚠️ \`Sisa ${item.stock} slot\``;
              }
            }

            const gachaStatus = item.is_gacha ? '🎲 `Tersedia di Gacha`' : '🔒 `Pembelian Langsung Only`';
            const desc = item.description ? `\n   └─ 💬 *“${item.description}”*` : '';

            content += `🆔 **\`ID: ${item.id}\`**  |  ${emoji} **${item.role_name}**\n` +
              `   ├─ 💵 **Harga** : **${formatCurrency(item.price)}**\n` +
              `   ├─ 📦 **Stok**  : ${stockInfo}\n` +
              `   ├─ 🎲 **Gacha** : ${gachaStatus}` +
              `${desc}\n\n`;
          });

          embed.addFields({
            name: `${emoji} ═══[ ${tierName} CLASS ]═══ ${emoji}`,
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
        .setColor(0x7F8C8D) // Premium Slate Grey (Ampas Silver/Grey)
        .setTitle(`🎰 GACHA ZONK: AMSYONG DEK! 😭 🎰`)
        .setDescription(
          `**${user.username}** baru saja memutar mesin Gacha seharga **${formatCurrency(price)}**!\n\n` +
          `🔮 **HASIL PENYARINGAN:**\n` +
          `> ❌ **ZONK / AMPAS TOTAL!** Dewi Fortuna sedang tidur siang. 💤\n\n` +
          `🗑️ **Item Rongsokan:** **${item ? item.name : 'Angin Kosong'}**\n` +
          `📝 **Lore Barang:** *“${item ? item.desc : 'Tidak ada apa-apa.'}”*\n\n` +
          `*“Tabahkan hatimu, mungkin jodohmu di gacha berikutnya!”* 🐔🔥\n` +
          `📉 Sisa Saldo Anda: **${formatCurrency(newBalance)}**`
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
            `> *Investasikan koin ke text channel teraktif! Harga berfluktuasi setiap 2 jam.*\n\n` +
            `📊 **\`.market\`** · **\`.saham\`** — Dashboard bursa saham & panel transaksi privat.\n\n` +
            `📉 **\`.stock <ticker>\`** · **\`.chart <ticker>\`** — Detail saham & **Grafik ASCII 2D** dengan tombol instan Beli & Jual.\n\n` +
            `📥 **\`.buy <ticker> <jumlah>\`** — Beli saham (Maks 100 lembar per saham, limit 10x/hari).\n` +
            `📤 **\`.sell <ticker> <jumlah>\`** — Jual saham ke bursa (pajak **15%**, hold min 24 jam).\n` +
            `📤 **\`.sellall <ticker>\`** — Jual seluruh lembar saham pada ticker tertentu.\n\n` +
            `💼 **\`.porto\`** · **\`.portfolio\`** — Detail portofolio, harga beli rata-rata, & profit/loss.\n\n` +
            `💵 **Dividen Mingguan** — Setiap **Minggu pukul 21:00 WIB**, dividen dibagikan otomatis ke pemegang saham berdasarkan keaktifan channel *(Maks 9%)*!\n\n` +
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
            `╰ 💰 Duplikat? Cashback **Rp 100** otomatis!\n` +
            `╰ 💎 **NEW: GACHA ROLE PERKS!** Pemegang role gacha mendapat **benefit pasif permanen** terpadu (XP & Gaji Pet, Pajak Transfer & Saham, Bunga & Limit Bank, Sukses & Proteksi Rob, Potongan Penjara & Bail!)\n\n` +
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
            `📥 **Tabungan** — Simpan koin di brankas bank agar aman dari perampok. Tabungan mendapat **bunga pasif harian** (+0.50% bunga khusus Mythic, batas bunga default Rp 20.000, **diperluas hingga Rp 50.000** bagi pemegang Gacha Role!) yang cair otomatis tengah malam!\n\n` +
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
            `⚒️ **\`.pet work\`** — Kerja: **Rp 150–400** + bonus 5%/level *(CD: 1 jam)*. *(Epic s/d Mythic mendapat bonus gaji s/d +35% & XP s/d +100%)*\n` +
            `🏹 **\`.pet hunt\`** — Berburu *(Min. Lv 10)*: **Rp 300–800** + item *(CD: 2 jam)*.\n` +
            `🥤 **\`.pet use SODA\`** — Reset CD kerja/berburu *(CD: 30 menit)*. Minum ke-3+ berisiko 35% sakit (SICK), **bisa dikurangi s/d 0% kebal sakit** dengan Gacha Role!\n` +
            `🛡️ **\`.pet expedition\`** — Ekspedisi Co-op *(CD: 30 menit)*: Dapatkan hasil hingga **Rp 2.500**. Berisiko **3% pet meninggal dunia (DEAD)**! Bawalah jimat \`LUCKY_AMULET\` (Rp 2.000) atau miliki Gacha Role Legendary/Mythic untuk proteksi!\n` +
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
            `╰ ✅ Peluang sukses dasar: **40%** *(pelaku Gacha Role dapat bonus s/d +25% sukses)*\n` +
            `╰ ❌ Gagal? Didenda **Rp 200** *(+Rp 100 jika korban punya CCTV)* & dipenjara *(CD dipotong gacha s/d -50%)*!\n` +
            `╰ 🛡️ Gembok korban memotong jarahan pelaku 50%. Korban Gacha Role dapat proteksi kehilangan koin (s/d **kebal dirampok 100%** untuk Mythic!)\n\n` +
            `╰ 👤 1 kru: 5% sukses → Rp 1.000–2.000\n` +
            `╰ 👥 2 kru: 10% sukses → Rp 2.500–4.500\n` +
            `╰ 👥👥 3 kru: 15% sukses → Rp 5.000–8.000\n` +
            `╰ 👥👥👥 4 kru: 25% sukses → Rp 9.000–14.000\n` +
            `╰ 👥👥👥👥 **5+ kru: 45% sukses → Rp 10.000–16.000** 🔥\n` +
            `╰ ❌ Gagal heist? **Denda Rp 750 + Penjara 2 jam** untuk seluruh kru!\n\n` +
            `🏛️ **\`.jail\`** · **\`.jail @user\`** — Cek status/sisa waktu penjara virtual.\n` +
            `╰ 💳 Bayar **bail** (jaminan) untuk bebas seketika: Solo Rp 250 | Heist Rp 500 *(Epic s/d Mythic mendapat denda tebus jaminan s/d -50%)*!`,
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
          name: '🎰  ⑪ GAME CASINO (SLOT & LOTRE MINGGUAN)',
          value:
            `🎰 **\`.slot [jumlah]\`** — Taruhan Rp 20 - Rp 10.000 untuk memenangkan Jackpot instan! *(75.3% koin taruhan dibakar sistem)*\n\n` +
            `🎟️ **\`.lotre\`** · **\`.lotre beli [jumlah]\`** — Beli tiket lotre Rp 100/tiket. Diundi setiap Hari Minggu pukul 21:00 WIB. Pemenang membawa pulang 85% koin pool, dan **15% pool koin dibakar selamanya**!\n\n` +
            `${miniDivider}`,
          inline: false
        },
        {
          name: '🔗  ⑫ BYPASS VIDEO LINK (AUTO-PREVIEW)',
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
            `╰ Tabung koin di \`.bank\` untuk **bunga pasif harian** & lindungi dari perampok.\n\n` +
            `**💥 Fase Akhir — High Risk High Reward:**\n` +
            `╰ Kumpulkan 5+ kru untuk \`.heist\` (peluang sukses **45%**, rampasan hingga **Rp 16.000**).\n` +
            `╰ Tingkatkan level pet Dragon untuk menang **PvP Arena** dengan taruhan tinggi.\n` +
            `╰ Putar \`.gacha-role\` saat saldo melimpah — siapa tahu dapat **Legendary 0.5%**! 🌟`,
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
    const kos = require('./kos');
    const activeRental = kos.getActiveRental(wallet.user_id, wallet.guild_id);
    const roomTier = activeRental ? activeRental.room_tier : 'DEFAULT';

    const depositTax = config.bank.DEPOSIT_TAX_ROOMS[roomTier] !== undefined
      ? config.bank.DEPOSIT_TAX_ROOMS[roomTier]
      : config.bank.DEPOSIT_TAX_ROOMS.DEFAULT;

    const withdrawTax = config.bank.WITHDRAW_TAX_ROOMS[roomTier] !== undefined
      ? config.bank.WITHDRAW_TAX_ROOMS[roomTier]
      : config.bank.WITHDRAW_TAX_ROOMS.DEFAULT;

    const feeConfig = config.bank.DAILY_SECURITY_FEE[roomTier] !== undefined
      ? config.bank.DAILY_SECURITY_FEE[roomTier]
      : config.bank.DAILY_SECURITY_FEE.DEFAULT;

    const maxInterest = config.bank.INTEREST_RATE_ROOMS[roomTier] !== undefined
      ? config.bank.INTEREST_RATE_ROOMS[roomTier]
      : config.bank.INTEREST_RATE_ROOMS.DEFAULT;

    // Hitung keaktifan pesan dalam 24 jam terakhir
    const nowUnix = Math.floor(Date.now() / 1000);
    const activeThresholdTime = nowUnix - 24 * 3600;
    const chatRow = db.get(
      "SELECT COUNT(*) as cnt FROM transactions WHERE user_id = ? AND guild_id = ? AND type = 'EARN' AND created_at >= ?",
      [wallet.user_id, wallet.guild_id, activeThresholdTime]
    );
    const activeMsgs = chatRow ? chatRow.cnt : 0;

    let mult = 0;
    let statusKeaktifan = '❌ Pasif (Bunga 0%)';
    if (activeMsgs > 5 && activeMsgs <= 20) {
      mult = 0.5;
      statusKeaktifan = '🟡 Aktif Sedang (Bunga 50%)';
    } else if (activeMsgs > 20) {
      mult = 1.0;
      statusKeaktifan = '🟢 Sultan Aktif (Bunga 100%)';
    }

    const currentInterest = maxInterest * mult;
    const interestProjection = Math.floor(savings.balance * (currentInterest / 100));
    const securityFeeAmount = Math.floor(savings.balance * (feeConfig.percent / 100)) + feeConfig.flat;
    const netProjection = interestProjection - securityFeeAmount;
    const roomName = activeRental ? activeRental.name : 'Teras Kosan 🧹';

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
          value: `**${formatCurrency(savings.balance)}**\n*Bunga Hari Ini: +${currentInterest.toFixed(1)}%*`,
          inline: true
        }
      );

    embed.addFields({
      name: `🏢 Status Kamar & Regulasi Bank (${roomName})`,
      value:
        `📥 Pajak Deposit: \`${depositTax}%\` | 📤 Pajak Penarikan: \`${withdrawTax}%\`\n` +
        `🛡️ Biaya Keamanan Harian: \`${feeConfig.flat > 0 || feeConfig.percent > 0 ? `Rp ${feeConfig.flat} + ${feeConfig.percent}%` : 'Bebas Biaya (Rp 0)'}\` (\`${formatCurrency(securityFeeAmount)}\` malam ini)\n` +
        `📈 Bunga Maksimal Kasta: \`+${maxInterest.toFixed(1)}%\` harian\n` +
        `💬 Chat 24 Jam Terakhir: **${activeMsgs} pesan** (\`${statusKeaktifan}\`)\n` +
        `📊 Proyeksi Net Tengah Malam: **${netProjection >= 0 ? `+${formatCurrency(netProjection)}` : `-${formatCurrency(Math.abs(netProjection))}`}**`,
      inline: false
    });

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

    // ── HUTANG TEBUSAN (BAIL DEBTS) KEPADA TEMAN ──
    let friendDebtsText = '';
    try {
      const debts = db.all(
        'SELECT creditor_id, amount FROM bail_debts WHERE debtor_id = ? AND guild_id = ?',
        [wallet.user_id, wallet.guild_id]
      );
      if (debts && debts.length > 0) {
        friendDebtsText = debts.map(d => `• Mengutang ke <@${d.creditor_id}>: **${formatCurrency(d.amount)}**`).join('\n');
      }
    } catch (e) {
      console.error("Gagal memuat hutang teman di dashboard bank:", e.message);
    }

    if (friendDebtsText) {
      embed.addFields({
        name: '👥 Hutang Teman (Jaminan Penjara)',
        value: friendDebtsText,
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
      // Split into chunks of 3 upgrades to avoid Discord 1024 char embed field limit
      const chunkSize = 3;
      for (let i = 0; i < upgrades.length; i += chunkSize) {
        const chunk = upgrades.slice(i, i + chunkSize);
        let upgradesText = '';
        chunk.forEach(u => {
          upgradesText += `• **${u.name}**\n  *Efek: ${u.config?.desc || '-'}*\n\n`;
        });
        const isFirst = i === 0;
        embed.addFields({
          name: isFirst ? `🪟 Fasilitas Kamar Terpasang (${upgrades.length})` : `🪟 Fasilitas Kamar (lanjutan)`,
          value: upgradesText.trim(),
          inline: false
        });
      }
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

    // Warna aksen per spesies pet
    const SPECIES_COLORS = {
      SLIME: 0x00E676, // Hijau neon
      DRAGON: 0xFF5722, // Oranye api
      CAT: 0xFFB300, // Kuning emas
      GOLEM: 0x78909C  // Abu-abu batu
    };
    const SPECIES_EMOJI = {
      SLIME: '🟢', DRAGON: '🔥', CAT: '🐱', GOLEM: '🧱'
    };

    const typeName = pet.pet_type.charAt(0) + pet.pet_type.slice(1).toLowerCase();
    const speciesColor = SPECIES_COLORS[pet.pet_type] || COLORS.INFO;
    const speciesEmoji = SPECIES_EMOJI[pet.pet_type] || '🐾';

    // Ambil GIF animasi sesuai spesies & fase
    const petImg = getPetImage(pet);

    const embed = new EmbedBuilder()
      .setAuthor({
        name: `🐾 Kandang Pet — ${user.username}`,
        iconURL: user.displayAvatarURL({ dynamic: true })
      })
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setTimestamp();

    // Pasang GIF animasi sebagai gambar utama embed (banner bawah)
    if (petImg) {
      embed.setImage(petImg);
    }

    if (pet.status === 'EGG') {
      const nowEgg = Math.floor(Date.now() / 1000);
      const isHatched = pet.hatch_at <= nowEgg;

      embed
        .setColor(0xFFD700) // Emas — telur istimewa
        .setTitle(`🥚 TELUR MONSTER: ${pet.pet_name}`)
        .setDescription(
          `> ${isHatched ? '✅ **Telur sudah siap menetas!**' : `⏳ Menetas <t:${pet.hatch_at}:R>`}\n\n` +
          `**Spesies:** \`${speciesEmoji} ${typeName}\`\n` +
          `**Nama Calon Pet:** **${pet.pet_name}**\n\n` +
          `*${isHatched ? '🐣 Klik tombol **Tetaskan** di bawah untuk memulai petualangan!' : 'Telur sedang dierami dengan penuh kasih sayang... Sabar ya!'}*`
        )
        .setFooter({ text: '🥚 Telur Monster • Kosan 1A Pet System' });
      return embed;
    }

    if (pet.status === 'DEAD') {
      embed
        .setColor(0x424242) // Abu gelap — suasana duka
        .setTitle(`🪦 IN MEMORIAM: ${pet.pet_name}`)
        .setDescription(
          `> 😭 **Pet Anda telah meninggal dunia.**\n\n` +
          `**${pet.pet_name}** the **${typeName}** telah berpulang karena kekurangan perawatan.\n\n` +
          `Semoga arwahnya tenang di alam monster sana... 🕯️\n\n` +
          `👉 Klik **🧹 Reset Kandang** di bawah untuk mengadopsi pet baru seharga **Rp 1.500**.`
        )
        .setFooter({ text: '🪦 Rest in Peace • Kosan 1A Pet System' });
      return embed;
    }

    // ── STATUS SEHAT / SAKIT / INJURED / WEAK ──
    const now = Math.floor(Date.now() / 1000);
    const isInjured = pet.curse_type === 'injured' && pet.curse_until > now;
    const isSick = pet.status === 'SICK' || pet.health <= 30 || isInjured;
    const isWeak = pet.health <= 60 && pet.health > 30 && pet.status !== 'SICK' && pet.status !== 'WEAK';
    
    let statusEmoji = pet.status === 'SICK' ? '🤢 Sakit' : (pet.status === 'WEAK' ? '🤕 Lemas' : (pet.status === 'ADULT' ? '🦁 Dewasa' : '🐣 Bayi'));
    if (isInjured) statusEmoji = '🤕 Terluka';

    const statusColor = isSick ? COLORS.ERROR : isWeak ? COLORS.WARN : speciesColor;
    const maxHP = pet.pet_type === 'SLIME' ? 120 : 100;

    const { getXpNeeded } = require('./pet');
    const xpNeeded = getXpNeeded(pet.level, pet.trait);

    // XP Progress bar teks
    const xpRatio = Math.min(1, pet.xp / (xpNeeded || 1));
    const xpBarLen = 12;
    const xpFilled = Math.round(xpRatio * xpBarLen);
    const xpBar = '█'.repeat(xpFilled) + '░'.repeat(xpBarLen - xpFilled);
    const xpPct = Math.round(xpRatio * 100);

    // Rarity & Trait
    let rarityBadge = '⚪ COMMON';
    let traitLine = '';
    if (pet.trait) {
      const traitName = pet.trait.toUpperCase();
      if (traitName === 'GENIUS') { rarityBadge = '🧠 RARE · GENIUS'; traitLine = '`-15% XP cap`'; }
      else if (traitName === 'STURDY') { rarityBadge = '🛡️ RARE · STURDY'; traitLine = '`HP decay ÷2`'; }
      else if (traitName === 'MUTANT') { rarityBadge = '🧬 RARE · MUTANT'; traitLine = '`+10% work/hunt`'; }
      else if (traitName === 'WARRIOR') { rarityBadge = '⚔️ RARE · WARRIOR'; traitLine = '`+10% ATK`'; }
      else if (traitName === 'FRAGILE') { rarityBadge = '💀 MUTASI · FRAGILE'; traitLine = '`Lapar/haus dmg 2.0x`'; }
      else if (traitName === 'SURVIVOR') { rarityBadge = '🛡️ RARE · SURVIVOR'; traitLine = '`Kebal kematian lapar (Min 1 HP)`'; }
    }

    const multText = (pet.xp_multiplier || 1.0) > 1.0 ? `⚡ **${pet.xp_multiplier}x XP**` : '1x';
    const healthStatus = pet.status === 'SICK' ? '🤢 Sakit (Overdose)' : (isInjured ? '🤕 Terluka (Luka PvP)' : (pet.status === 'WEAK' ? '⚠️ Lemas (Kelaparan)' : (isSick ? '🚨 **KRITIS!**' : (isWeak ? '⚠️ Lemah' : '💚 Sehat'))));

    let accText = '❌ Tidak Ada';
    if (pet.accessory === 'COLLAR_IRON') accText = '🪮 Kalung Besi (Laju Decay -15%)';
    else if (pet.accessory === 'SWORD_TOY') accText = '⚔️ Pedang Mainan (PvP DMG +15%)';
    else if (pet.accessory === 'SHIELD_TOY') accText = '🛡️ Tameng Mainan (PvP DEF +15%)';
    else if (pet.accessory === 'LUCKY_AMULET') accText = '🔮 Jimat Keberuntungan (Mencegah Kematian 1x)';

    embed
      .setColor(statusColor)
      .setTitle(`${speciesEmoji} ${pet.pet_name} — Lv.${pet.level} ${typeName}`)
      .setDescription(
        `> 👤 <@${pet.user_id}> · ${statusEmoji} · ${healthStatus}\n` +
        `> 🛡️ **Aksesoris:** ${accText}\n` +
        `> 🌟 **${rarityBadge}** ${traitLine ? `· ${traitLine}` : ''}\n` +
        `> ⚡ **XP Booster:** ${multText}\n\n` +
        `**✨ XP Progress** \`[${xpBar}]\` **${xpPct}%** *(${pet.xp}/${xpNeeded})*`
      )
      .setFooter({ text: `${speciesEmoji} ${typeName} · Kosan 1A Pet System · Klik tombol di bawah untuk merawat!` });

    // Statistik Utama Pet (Inline Fields memanjang ke kanan)
    embed.addFields(
      { name: '❤️ HP (Kesehatan)', value: `${this.renderProgressBar(pet.health, maxHP)} ${isSick ? '\n⚠️ **[ SAKIT/LEMAH ]**' : ''}`, inline: true },
      { name: '🍖 Kenyangan', value: `${this.renderProgressBar(pet.hunger, 100)}`, inline: true },
      { name: '💧 Hidrasi', value: `${this.renderProgressBar(pet.thirst, 100)}`, inline: true },
      { name: '⚽ Kebahagiaan', value: `${this.renderProgressBar(pet.happiness, 100)}`, inline: true }
    );

    // Ketersediaan Supplies Inventory Singkat
    const suppliesText = inventory.map(item => `• ${item.name}: \`${item.quantity} pcs\``).join('\n');
    embed.addFields({
      name: '🎒 Persediaan Barang Pet (Supplies)',
      value: suppliesText || '*Kosong*',
      inline: false
    });

    // Info Cooldown Pekerjaan & Berburu
    // Cooldown Work (Work: 1 Jam)
    let workCd = 1 * 3600;
    if (pet.pet_type === 'GOLEM') workCd -= 20 * 60; // Golem perk
    const nextWork = pet.last_work_at + workCd;
    const canWork = now >= nextWork;
    const workStatus = canWork ? '🟢 **Siap bekerja!**' : `⏳ Cooldown s/d <t:${nextWork}:t> (<t:${nextWork}:R>)`;

    // Cooldown Hunt (Hunt: 2 Jam, Fase adult saja)
    let huntStatus = '🔒 Terkunci (Hanya untuk pet dewasa level 10+)';
    if (pet.level >= 10 || pet.status === 'ADULT') {
      const nextHunt = pet.last_hunt_at + (2 * 3600);
      const canHunt = now >= nextHunt;
      huntStatus = canHunt ? '🟢 **Siap berburu!**' : `⏳ Cooldown s/d <t:${nextHunt}:t> (<t:${nextHunt}:R>)`;
    }

    // Cooldown Play
    const nextPlay = (pet.last_play_at || 0) + (15 * 60);
    const canPlay = now >= nextPlay;
    const playStatus = canPlay ? '🟢 **Siap bermain!**' : `⏳ Cooldown s/d <t:${nextPlay}:t> (<t:${nextPlay}:R>)`;

    embed.addFields({
      name: '⏱️ Status Cooldown & Aktivitas',
      value: `💼 **Bekerja (.pet work) :** ${workStatus}\n🏹 **Berburu (.pet hunt) :** ${huntStatus}\n⚽ **Bermain (.pet play) :** ${playStatus}\n🛡️ **Ekspedisi (.pet expedition) :** Aktif (Maks 10 main, CD 3 jam setelahnya)`,
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
          let rarityText = '⚪ COMMON';
          let traitDesc = '';
          if (pet.trait) {
            rarityText = '✨ RARE';
            const traitName = pet.trait.toUpperCase();
            if (traitName === 'GENIUS') traitDesc = ' | 🧠 Genius';
            else if (traitName === 'STURDY') traitDesc = ' | 🛡️ Sturdy';
            else if (traitName === 'MUTANT') traitDesc = ' | 🧬 Mutant';
            else if (traitName === 'WARRIOR') traitDesc = ' | ⚔️ Warrior';
          }
          statusText = `Raritas: **${rarityText}** | Lv. ${pet.level} | ❤️ ${pet.health}% HP | 🍖 ${pet.hunger}% Kenyang | 💧 ${pet.thirst}% Hidrasi | ⚽ ${pet.happiness}% Mood${traitDesc}`;
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
    const percent = Math.min(100, Math.round((value / max) * 100));
    const filled = Math.min(totalBars, Math.round((value / max) * totalBars));
    const empty = totalBars - filled;
    const barStr = '🟩'.repeat(filled) + '🟥'.repeat(empty);
    if (max === 100) {
      return `\`[${barStr}]\` **${value}%**`;
    }
    return `\`[${barStr}]\` **${value}/${max}** (${percent}%)`;
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
          (item.multiplier ? `\`Meningkatkan Multiplier XP Pet menjadi ${item.multiplier}x secara permanen\` ` : '') +
          (item.type === 'ACCESSORY' ? (item.id === 'LUCKY_AMULET' ? `\`Aksesoris Sekali Pakai (Jimat Pelindung Mati)\` ` : `\`Aksesoris Permanen Pet (Bisa Dipasang)\` `) : '') +
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
        .setColor(0xFFB300) // Vibrant Gold/Amber
        .setDescription(
          `🤝 **HASIL AKHIR ARENA: SEIMBANG (DRAW) !** 🤝\n\n` +
          `Pertarungan sengit antara pet milik **${challengerUser.username}** (**${result.challengerName}**) melawan pet milik **${opponentUser.username}** (**${result.opponentName}**) berjalan sangat alot dan berakhir imbang!\n\n` +
          `📊 **STATUS HP TERAKHIR:**\n` +
          `├─ ⚔️ **${result.challengerName}** (Challenger): \`${result.challengerHP}%\` HP\n` +
          `└─ 🛡️ **${result.opponentName}** (Opponent): \`${result.opponentHP}%\` HP\n\n` +
          `🪙 **Hasil Taruhan:**\n` +
          `Seluruh koin taruhan dikembalikan ke masing-masing pihak tanpa potongan pajak arena!`
        );
    } else {
      const isChalWinner = result.winnerId === challengerUser.id;
      const winnerUser = isChalWinner ? challengerUser : opponentUser;
      const loserUser = isChalWinner ? opponentUser : challengerUser;

      embed
        .setColor(0x7C4DFF) // Premium Royal Violet
        .setDescription(
          `👑 **PEMENANG MUTLAK BATTLE ARENA** 👑\n\n` +
          `🏆 **${result.winnerName.toUpperCase()}** (milik **${winnerUser.username}**)\n` +
          `💥 Sukses menumbangkan **${result.loserName}** (milik **${loserUser.username}**)!` +
          `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `💰 **HADIAH JACKPOT PERTEMPURAN:**\n` +
          `├─ 🎁 Total Bersih: **${formatCurrency(result.prizePool)}**\n` +
          `└─ 🏛️ Pajak Arena (5%): **Rp ${result.tax.toLocaleString('id-ID')}** *(Disetorkan ke Kas Server)*\n\n` +
          `📈 *XP & Level pet pemenang telah ditambahkan secara otomatis.*`
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
  jailStatusEmbed(user, secondsRemaining, bailAmount, jailType = '') {
    const now = Math.floor(Date.now() / 1000);
    const releaseTime = now + secondsRemaining;
    
    let description = '';
    let color = COLORS.ERROR;
    let title = '🚨 STATUS TAHANAN VIRTUAL 👮';
    let thumbnail = 'https://cdn-icons-png.flaticon.com/512/3233/3233481.png';
    let footerText = 'Klik tombol "🔓 Tebus Jaminan" di bawah atau gunakan .jail untuk bebas!';

    if (jailType === 'troll') {
      title = '⛓️ SEL VIP KERTAS KENA TROLL ADMIN ⛓️';
      color = 0x95A5A6; // Greyish
      thumbnail = 'https://cdn-icons-png.flaticon.com/512/2996/2996172.png';
      footerText = '😜 Hahaha! Nikmati masa tenang Anda di sel VIP!';
      description = 
        `Waduh! **${user.username}**, Anda baru saja dimasukkan ke **Sel VIP Kertas** oleh Admin!\n\n` +
        `🔒 **Status:** \`KENA PRANK\`\n` +
        `🛋️ **Fasilitas Sel:** \`Kipas Angin Karatan, Nyamuk Raksasa, Kasur Kardus\`\n` +
        `⏳ **Bebas Dalam:** <t:${releaseTime}:R>\n` +
        `💰 **Uang Tebusan Palsu:** \`Gratis\` (Tapi harus nunggu selesai atau dibebaskan Admin!)\n\n` +
        `*Catatan: Selama dikurung di sel ini, seluruh aktivitas ekonomi Anda dibekukan demi kenyamanan perenungan Anda.*`;
    } else {
      description = 
        `Waduh! **${user.username}**, Anda saat ini sedang ditahan di Penjara Virtual Server.\n\n` +
        `🔒 **Status:** \`JAILED\`\n` +
        `⏳ **Bebas Pada:** <t:${releaseTime}:t> (<t:${releaseTime}:R>)\n` +
        `💰 **Uang Jaminan (Bail):** \`${formatCurrency(bailAmount)}\` untuk bebas instan.\n\n` +
        `*Selama berada di dalam penjara, seluruh aktivitas ekonomi Anda dibekukan (Tidak bisa bekerja, daily, transfer, beli/jual saham, main pet, dll).*`;
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(description)
      .setThumbnail(thumbnail)
      .setFooter({ text: footerText })
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
  heistResultEmbed(guild, success, participants, logs, totalReward, rewardPerPerson, fineAmount, jailHours, stolenFromPlayers = 0, deductionLogs = [], extraData = {}) {
    const embed = new EmbedBuilder()
      .setTitle(success ? '💥 LAPORAN AKHIR: BANK HEIST SUCCESS! 💰' : '🚓 LAPORAN AKHIR: BANK HEIST GAGAL! 👮')
      .setColor(success ? COLORS.SUCCESS : COLORS.ERROR)
      .setTimestamp();

    const crewList = participants.map(p => `<@${p}>`).join(', ');
    const logText = logs.map(l => `• ${l}`).join('\n');

    let desc = `🚨 **Lokasi:** Central Bank Server\n` +
      `👥 **Kru Perampok:** ${crewList}\n\n`;

    // 1. Tambahkan Detail Pet Synergy jika ada
    if (extraData.petDetails && extraData.petDetails.length > 0) {
      desc += `🧬 **SINERGI TAMAGOTCHI PET:**\n` + extraData.petDetails.map(d => `• ${d}`).join('\n') + `\n\n`;
    }

    // 2. Tambahkan Detail Black Market Gear jika ada
    if (extraData.bmDetails && extraData.bmDetails.length > 0) {
      desc += `🗝️ **PERLENGKAPAN KRIMINAL:**\n` + extraData.bmDetails.map(d => `• ${d}`).join('\n') + `\n\n`;
    }

    desc += `📝 **DOKUMENTASI OPERASI:**\n${logText}\n\n`;

    if (success) {
      desc += `🏆 **HASIL JARAHAN BRANKAS:**\n` +
        `💰 **Total Dirampok:** \`${formatCurrency(totalReward)}\`\n` +
        `👉 **Setiap Anggota Mendapatkan:** **\`${formatCurrency(rewardPerPerson)}\`** *(Bersih!)*`;

      // Masked users bonus
      if (extraData.maskedUsers && extraData.maskedUsers.length > 0) {
        const maskList = extraData.maskedUsers.map(u => `<@${u}>`).join(', ');
        desc += `\n\n🎭 ${maskList} menggunakan **Topeng Samaran** dan mendapatkan bonus **+10% koin jarahan**!`;
      }

      if (stolenFromPlayers > 0 && deductionLogs.length > 0) {
        const victimList = deductionLogs.map(dl => `• <@${dl.userId}>: -\`${formatCurrency(dl.amount)}\``).join('\n');
        desc += `\n\n💸 **DANA NASABAH YANG DIKORBANKAN:**\n${victimList}\n` +
          `🏦 **Total Disita dari Rekening Nasabah:** \`${formatCurrency(stolenFromPlayers)}\``;
      }

      embed.setDescription(desc);
    } else {
      desc += `❌ **KONSEKUENSI PENANGKAPAN:**\n` +
        `💸 **Denda per Anggota:** \`${formatCurrency(fineAmount)}\` (potong dompet)\n` +
        `🔒 **Hukuman Penjara:** \`${jailHours.toFixed(1)} Jam\` di Penjara Virtual!`;

      // Slime dodge jail users
      if (extraData.dodgedJailUsers && extraData.dodgedJailUsers.length > 0) {
        const dodgeList = extraData.dodgedJailUsers.map(u => `<@${u}>`).join(', ');
        desc += `\n\n🟢 **Dodge Jail!** ${dodgeList} berhasil melarikan diri menggunakan tubuh licin pet **Slime** dan terhindar dari penjara!`;
      }

      embed.setDescription(desc);
    }

    // Tampilkan barang kriminal yang hancur jika ada
    if (extraData.brokenLockpicks && extraData.brokenLockpicks.length > 0) {
      const brokenList = extraData.brokenLockpicks.map(u => `<@${u}>`).join(', ');
      embed.addFields({
        name: '🛠️ LAPORAN KERUSAKAN ALAT',
        value: `⚠️ Lockpick milik ${brokenList} patah/rusak saat aksi perampokan!`
      });
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
            `• **Biaya Persiapan:** Rp 200 /orang (Modal awal untuk ikut lobi).\n` +
            `• **Sistem Kru & Peluang (Skala Tim):**\n` +
            `  👥 **1 Orang (Solo):** Sukses **5%** | Hadiah **Rp 1.000 - Rp 2.000** | Denda **Rp 500** & Penjara **2 Jam**.\n` +
            `  👥 **2 Orang:** Sukses **10%** | Hadiah **Rp 2.500 - Rp 4.500** | Denda **Rp 500** & Penjara **2 Jam**.\n` +
            `  👥 **3 Orang:** Sukses **15%** | Hadiah **Rp 5.000 - Rp 8.000** | Denda **Rp 600** & Penjara **2 Jam**.\n` +
            `  👥 **4 Orang:** Sukses **25%** | Hadiah **Rp 9.000 - Rp 14.000** | Denda **Rp 600** & Penjara **2.5 Jam**.\n` +
            `  👥 **5+ Orang:** Sukses **45%** | Hadiah **Rp 10.000 - Rp 16.000** | Denda **Rp 750** & Penjara **2 Jam**.\n` +
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
            `  👉 *Buff:* Cooldown bekerja (*Work*) dikurangi **20 Menit** (dari 1 jam menjadi 40 menit).`,
          inline: false
        },
        {
          name: '🐣 2. FASE PERTUMBUHAN PET',
          value:
            `🥚 **Egg (Telur):** Diadopsi seharga **Rp 1.500** (\`.pet buy <nama> <spesies>\`). Menetas otomatis dalam waktu **1 jam**.\n` +
            `🐣 **Baby (Bayi):** Level 1 s/d 9. Belum bisa diajak berburu (*Hunt*) atau bertarung PvP.\n` +
            `🦁 **Adult (Dewasa):** Min. Level 10. Membuka fitur berburu liar (*Hunt*) dan pertarungan taruhan PvP Arena.`,
          inline: false
        },
        {
          name: '💼 3. MEKANIK PENDAPATAN & UPAH KOIN',
          value:
            `• **Bekerja (\`.pet work\`):** Mencari uang secara aman. Menghasilkan **Rp 150 - Rp 400** + bonus 5% per level pet (Cooldown 1 jam, Golem 40m).\n` +
            `• **Berburu (\`.pet hunt\`):** Menjelajah hutan liar (Min. Lvl 10). Menghasilkan **Rp 300 - Rp 800** + peluang mendapatkan jackpot item premium gratis (Daging, Obat, Bola Karet). Cooldown 2 jam.\n` +
            `• **PvP Arena (\`.pet pvp @user <taruhan>\`):** Bertarung dengan pet lain memperebutkan uang taruhan (Klaim 95% total taruhan, pajak arena 5%). Kalah mengurangi HP & Kebahagiaan secara signifikan.\n` +
            `• **Ekspedisi (\`.pet expedition\`):** Berpetualang bersama tim (Tanpa Batas Kru) melawan bos penjaga zona untuk koin melimpah & jackpot item Black Market! (Maks 6 main, CD 4 jam setelahnya, biaya Rp 250).`,
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
          name: '📥 1. REKENING TABUNGAN BANK (Savings) & REGULASI DINAMIS',
          value:
            `• **Deposit & Penarikan Bebas:** Simpan atau tarik koin dari dompet Anda kapan saja lewat menu \`.bank\`.\n` +
            `• **🛡️ Proteksi Anti-Rob 100%:** Koin di dalam tabungan bank **sepenuhnya aman** dari segala aksi pencurian (\`.rob @user\`). Korban rob hanya kehilangan uang di dompet aktif.\n` +
            `• **📥 Pajak Deposit & 📤 Penarikan:** Setiap deposit dikenakan pajak **1.0% - 2.0%**, dan penarikan dikenakan **2.5% - 5.0%** depending on your Room Tier. (Penthouse BEBAS PAJAK!).\n` +
            `• **📉 Biaya Keamanan Harian (Passive Drain):** Dikenakan biaya admin keamanan otomatis setiap tengah malam (**00:00 WIB**):\n` +
            `  - *Default:* **Rp 15 + 0.5%** dari total saldo\n` +
            `  - *Kipas:* **Rp 10 + 0.3%** | *AC:* **Rp 5 + 0.1%** | *Penthouse:* **Rp 0 (Bebas Biaya)**\n` +
            `• **📈 Bunga Harian Aktif (Active Chat Interest):** Cair tengah malam **hanya jika Anda aktif mengobrol** hari itu:\n` +
            `  - 💬 *Pasif (0 - 5 pesan harian):* Bunga **0%** (Saldo tabungan Anda dipastikan menyusut dipotong biaya keamanan!)\n` +
            `  - 💬 *Aktif Sedang (6 - 20 pesan):* Mendapatkan **50% dari bunga kasta**\n` +
            `  - 👑 *Sultan Aktif (21+ pesan):* Mendapatkan **100% bunga maksimal** sesuai kasta kamar Anda!\n` +
            `  - *Maksimal Bunga Kasta:* Default **0.5%** | Kipas **0.75%** | AC **1.0%** | Penthouse **1.5% harian**\n` +
            `  - *Batas Bunga:* Bunga harian hanya dihitung maksimal dari **Rp 20.000** saldo tabungan Anda (mencegah hiperinflasi).\n` +
            `👉 *Tip:* Tingkatkan kasta kamar sewa kosan Anda dan aktiflah mengobrol untuk meminimalkan pajak perbankan dan memaksimalkan bunga tabungan Sultan!`,
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
  },

  // 41. Cozy Flower Garden Embed
  gardenEmbed(user, slots, lastWaterAt) {
    const makeProgressBar = (percent) => {
      const size = 8;
      const pct = Math.max(0, Math.min(100, parseInt(percent) || 0));
      const progress = Math.max(0, Math.min(size, Math.floor((pct / 100) * size)));
      const emptyProgress = Math.max(0, size - progress);
      const filledChar = '🟩';
      const emptyChar = '⬛';
      return `\`[${filledChar.repeat(progress)}${emptyChar.repeat(emptyProgress)}]\` **${pct}%**`;
    };

    const formatDuration = (seconds) => {
      if (seconds <= 0) return 'Matang';
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      if (hrs > 0) return `${hrs}j ${mins}m`;
      if (mins > 0) return `${mins}m ${secs}d`;
      return `${secs}d`;
    };

    const now = Math.floor(Date.now() / 1000);
    const timeSinceLastWater = now - (lastWaterAt || 0);
    const cooldownSeconds = config.garden.WATER_COOLDOWN_MS / 1000;
    const waterReady = timeSinceLastWater >= cooldownSeconds;

    let waterStatusText = '';
    if (waterReady) {
      waterStatusText = '💦 **Ember Air:** 🟢 **Penuh & Siap Menyiram!**';
    } else {
      const secondsLeft = Math.ceil(cooldownSeconds - timeSinceLastWater);
      const minsLeft = Math.floor(secondsLeft / 60);
      const secsLeft = secondsLeft % 60;
      waterStatusText = `💦 **Ember Air:** ⏳ Mengisi Ulang (**${minsLeft}m ${secsLeft}s**)`;
    }

    let desc = `Selamat datang di kebun bunga virtualmu, **${user.username}**! 🌸\n` +
      `Rawatlah benih tanamanmu hingga mekar penuh, panen bunga segarnya, dan rangkai menjadi buket indah berpita untuk dihadiahkan kepada warga lain!\n\n` +
      `${waterStatusText}\n\n` +
      `🏡 **DAFTAR TANAH AKTIF (3 SLOT):**\n` +
      `──────────────────────────────\n`;

    slots.forEach(slot => {
      desc += `\n`;
      if (slot.seed_id) {
        const pbar = makeProgressBar(slot.growthProgress);
        const timeText = formatDuration(slot.secondsLeft);

        let rarityEmoji = '🪵';
        if (slot.rarity === 'RARE') rarityEmoji = '✨';
        if (slot.rarity === 'EPIC') rarityEmoji = '👑';

        if (slot.growthProgress >= 100) {
          desc += `🌺 **SLOT #${slot.slot_index}: ${slot.flowerName}** (Matang!)\n` +
            `┊ ${pbar}\n` +
            `┊ Status: ${rarityEmoji} **MEKAR SEMPURNA**\n` +
            `┊ 👉 *Bunga siap dipanen! klik tombol **Panen** di bawah.*\n`;
        } else {
          desc += `🌱 **SLOT #${slot.slot_index}: ${slot.flowerName}**\n` +
            `┊ ${pbar} (Sisa: \`${timeText}\`)\n` +
            `┊ Status: ${rarityEmoji} **${slot.growthStatus}**\n` +
            `┊ Penyiraman: 💦 Sudah disiram **${slot.water_count}x**\n`;
        }
      } else {
        desc += `🟫 **SLOT #${slot.slot_index}: KOSONG**\n` +
          `┊ *Tanah gembur siap ditanami benih bunga baru!*\n` +
          `┊ 👉 *Ketik* \`.tanam ${slot.slot_index} <nama_bunga>\` *atau klik tombol Toko Benih.*\n`;
      }
      desc += `──────────────────────────────\n`;
    });

    return new EmbedBuilder()
      .setColor('#F7C8E0') // Cozy Pastel Pink
      .setTitle(`🌸 KEBUN BUNGA COZY — ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }) || null)
      .setDescription(desc)
      .setFooter({ text: 'Sentinel Cozy Garden System • Rawat dengan kasih sayang!' })
      .setTimestamp();
  },

  // 42. Cozy Flower Garden Shop Embed
  gardenShopEmbed(user, wallet) {
    let desc = `Halo **${user.username}**, silakan beli benih bunga segar dan perlengkapan merangkai buket di sini!\n\n` +
      `💰 **Saldo Dompet Anda:** \`Rp ${wallet.balance.toLocaleString('id-ID')}\`\n` +
      `──────────────────────────────\n\n` +
      `🌱 **BENIH BUNGA YANG TERSEDIA:**\n\n` +
      `1. **🌹 Benih Mawar Merah** (\`mawar\`)\n` +
      `   • Harga: \`Rp 150\` | Waktu: \`2 Jam\` | Jual: \`Rp 250\` (Common)\n` +
      `2. **🌷 Benih Bunga Tulip** (\`tulip\`)\n` +
      `   • Harga: \`Rp 300\` | Waktu: \`4 Jam\` | Jual: \`Rp 550\` (Common)\n` +
      `3. **🪻 Benih Bunga Lavender** (\`lavender\`)\n` +
      `   • Harga: \`Rp 500\` | Waktu: \`6 Jam\` | Jual: \`Rp 950\` (Rare)\n` +
      `4. **🌸 Benih Bunga Sakura** (\`sakura\`)\n` +
      `   • Harga: \`Rp 1.000\` | Waktu: \`12 Jam\` | Jual: \`Rp 2.200\` (Rare)\n` +
      `5. **🪻 Benih Anggrek Langka** (\`anggrek\`)\n` +
      `   • Harga: \`Rp 2.500\` | Waktu: \`24 Jam\` | Jual: \`Rp 6.000\` (Epic)\n\n` +
      `🎗️ **PERLENGKAPAN BUKET:**\n\n` +
      `• **🎗️ Kertas Kado Premium** (\`wrapping\`)\n` +
      `  • Harga: \`Rp 100\` (Bahan wajib untuk merangkai buket bunga)\n\n` +
      `──────────────────────────────\n` +
      `👉 **Cara Membeli:** Ketik \`.toko-kebun beli <nama_benih> <jumlah>\`\n` +
      `*Contoh:* \`.toko-kebun beli mawar 3\` atau \`.toko-kebun beli wrapping 1\``;

    return new EmbedBuilder()
      .setColor('#C4D7B2') // Sage Green
      .setTitle(`🛒 TOKO BENIH KEBUN KOSAN 1A`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }) || null)
      .setDescription(desc)
      .setFooter({ text: 'Sentinel Garden Shop System • Ketik .kebun untuk kembali ke kebun' })
      .setTimestamp();
  },

  // 43. Cozy Flower Garden Bouquet Craft Embed
  bouquetCraftEmbed(user, guildId) {
    const getQty = (itemId) => {
      try {
        const row = db.get(
          'SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?',
          [user.id, guildId, itemId]
        );
        return row ? row.quantity : 0;
      } catch (e) {
        return 0;
      }
    };

    const qtyRose = getQty('FLOWER_ROSE');
    const qtyTulip = getQty('FLOWER_TULIP');
    const qtyLavender = getQty('FLOWER_LAVENDER');
    const qtySakura = getQty('FLOWER_SAKURA');
    const qtyOrchid = getQty('FLOWER_ORCHID');
    const qtyWrapping = getQty('GIFT_WRAPPING');

    let desc = `Halo **${user.username}**, di sini Anda dapat merangkai bunga segar hasil panen menjadi buket bunga indah berpita yang memiliki efek pasif **Daily Claim Buff** melimpah saat dihadiahkan ke warga lain!\n\n` +
      `🎒 **INVENTORY BAHAN ANDA:**\n` +
      `• 🌹 Mawar Merah: \`${qtyRose} kuntum\`\n` +
      `• 🌷 Bunga Tulip: \`${qtyTulip} kuntum\`\n` +
      `• 🪻 Lavender: \`${qtyLavender} kuntum\`\n` +
      `• 🌸 Sakura: \`${qtySakura} kuntum\`\n` +
      `• 🪻 Anggrek Langka: \`${qtyOrchid} kuntum\`\n` +
      `• 🎗️ Kertas Kado Premium: \`${qtyWrapping} buah\`\n\n` +
      `📜 **RESEP BUKET BUNGA YANG TERSEDIA:**\n\n` +
      `1. **💐 Buket Kasih Sayang** (\`love\`)\n` +
      `   • **Bahan:** \`3x Mawar Merah\` + \`1x Kertas Kado\`\n` +
      `   • **Efek Hadiah:** Penerima mendapat **+Rp 15** pada Daily Claim harian (Aktif 24 Jam)\n\n` +
      `2. **💐 Buket Ketenangan** (\`peace\`)\n` +
      `   • **Bahan:** \`2x Lavender\` + \`2x Tulip\` + \`1x Kertas Kado\`\n` +
      `   • **Efek Hadiah:** Penerima mendapat **+Rp 35** pada Daily Claim harian (Aktif 24 Jam)\n\n` +
      `3. **👑 Buket Legendaris (Imperial)** (\`imperial\`)\n` +
      `   • **Bahan:** \`1x Anggrek Langka\` + \`2x Sakura\` + \`1x Kertas Kado\`\n` +
      `   • **Efek Hadiah:** Penerima mendapat **+Rp 80** pada Daily Claim harian (Aktif 24 Jam)\n\n` +
      `──────────────────────────────\n` +
      `👉 **Cara Merangkai:** Ketik \`.buket <jenis>\`\n` +
      `*Contoh:* \`.buket love\``;

    return new EmbedBuilder()
      .setColor('#D8B4F8') // Lilac Pastel
      .setTitle(`💐 MEJA MERANGKAI BUKET BUNGA 💐`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }) || null)
      .setDescription(desc)
      .setFooter({ text: 'Sentinel Bouquet Crafting System • Gunakan .gift-buket untuk mengirim' })
      .setTimestamp();
  },

  // 44. Cozy Flower Garden Gift Bouquet Embed
  giftBouquetEmbed(sender, receiver, bouquetName, messageText) {
    return new EmbedBuilder()
      .setColor('#F6C6EA') // Sweet Pastel Pink
      .setTitle(`💝 KADO BUKET BUNGA PENUH KASIH SAYANG 💝`)
      .setThumbnail(receiver.displayAvatarURL({ dynamic: true }) || null)
      .setDescription(
        `### 💐 Ada Kiriman Hadiah Manis Untukmu! 💐\n\n` +
        `**<@${sender.id}>** baru saja mengirimkan buket bunga yang sangat indah untuk **<@${receiver.id}>**!\n\n` +
        `📦 **Buket Hadiah:** **${bouquetName}**\n` +
        `💌 **Pesan Manis:**\n*“ ${messageText} ”*\n\n` +
        `✨ **Efek Pasif Aktif:**\n` +
        `**<@${receiver.id}>** mendapatkan tambahan pasif harian koin kado saat mengklaim daily selama **24 jam** ke depan! 🎉`
      )
      .setFooter({ text: 'Sebarkan kedamaian dan kasih sayang di Kosan 1A! 🌸' })
      .setTimestamp();
  },

  // 45. Global Action Announcement Embed
  globalActionAnnouncementEmbed(adminUser, actionName, actionDescription, colorHex, detailsFields = [], isLaw = false) {
    const embed = new EmbedBuilder()
      .setColor(colorHex || '#7C4DFF')
      .setTitle(isLaw ? '🚨 PENGUMUMAN REGULASI HUKUM GLOBAL' : '📢 PENGUMUMAN TINDAKAN EKONOMI GLOBAL')
      .setDescription(
        `🚨 **Tindakan Regulasi ${isLaw ? 'Hukum/Hukuman' : 'Ekonomi'} Global baru saja dipicu oleh Administrator!**\n\n` +
        `**Tindakan:** ${actionName}\n` +
        `**Deskripsi:** ${actionDescription}`
      )
      .setAuthor({
        name: adminUser.username,
        iconURL: adminUser.displayAvatarURL({ dynamic: true })
      })
      .setTimestamp()
      .setFooter({ text: isLaw ? 'Sistem Hukum & Lapas Kosan 1A • Sentinel Law' : 'Sistem Regulasi Ekonomi Kosan 1A • Sentinel Finance' });

    if (detailsFields && detailsFields.length > 0) {
      embed.addFields(detailsFields);
    }
    return embed;
  },

  // 46. Embed Notifikasi Transfer Bank
  bankTransferNotificationEmbed(senderUser, targetUserId, amount, isPayDebt) {
    const senderMention = `<@${senderUser.id}>`;
    const targetMention = `<@${targetUserId}>`;
    const transactionType = isPayDebt ? 'Pembayaran Hutang' : 'Transfer Tabungan';
    const transactionEmoji = isPayDebt ? '🤝' : '💸';
    const amountStr = `Rp ${amount.toLocaleString('id-ID')}`;

    return new EmbedBuilder()
      .setColor(COLORS.INFO)
      .setAuthor({
        name: 'CENTRAL BANK KOSAN 1A',
        iconURL: 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png'
      })
      .setTitle(`🔔 Notifikasi Transaksi Bank`)
      .setThumbnail(senderUser.displayAvatarURL({ dynamic: true, size: 256 }))
      .setDescription(
        `Halo ${targetMention}, Anda telah menerima kiriman dana ke rekening tabungan bank Anda!\n\n` +
        `\`\`\`\n` +
        `┌──────────────────────────────────────┐\n` +
        `│        DETAIL TRANSAKSI MASUK        │\n` +
        `└──────────────────────────────────────┘\n` +
        `\`\`\`\n` +
        `👤 **Pengirim:** ${senderMention}\n` +
        `📥 **Jumlah Bersih:** **${amountStr}**\n` +
        `📂 **Kategori:** \`${transactionType}\` ${transactionEmoji}\n\n` +
        `*Catatan: Koin sudah bersih dipotong pajak transfer/sistem dan telah ditambahkan secara otomatis ke saldo tabungan bank Anda.*`
      )
      .setTimestamp()
      .setFooter({ text: 'Sentinel Banking System • Keamanan & Kepercayaan' });
  }
};


