/**
 * Konfigurasi Ekonomi & Stock Market
 * "Rupiah Server" Economy System
 */
const path = require('path');

module.exports = {
  // Nama & Simbol Mata Uang
  CURRENCY_NAME: 'Rupiah Server Kosan 1A',
  CURRENCY_SYMBOL: 'Rp',

  // Database Path
  // Jika di Railway, user bisa memetakan volume persisten ke /data dan menyetel DATABASE_PATH=/data/economy.db
  DATABASE_PATH: process.env.DATABASE_PATH || path.join(__dirname, '../data/economy.db'),

  // ID Channel khusus untuk Laporan Harian & Pengumuman Bursa Saham
  REPORT_CHANNEL_ID: process.env.REPORT_CHANNEL_ID || '1509480324373942272',

  // Sistem Earning Poin (Rupiah Server)
  economy: {
    MSG_MIN_WORDS: 3,           // Minimal kata agar dapat koin (ditingkatkan untuk mencegah spam koin pendek)
    MSG_MIN_LENGTH: 10,         // Minimal karakter agar dapat koin
    COOLDOWN_MS: 45 * 1000,     // Cooldown antar pesan diperketat dari 30s -> 45s
    
    // Poin acak yang didapat per pesan (koin sangat berharga, dikurangi agar susah didapat)
    MIN_EARN: 1,
    MAX_EARN: 4,

    // Daily Claim (dikurangi secara signifikan)
    DAILY_MIN: 15,
    DAILY_MAX: 35,
    DAILY_STREAK_BONUS: 3,      // Bonus per hari streak
    DAILY_STREAK_CAP: 7,        // Maksimal hari streak yang dihitung bonusnya

    // Pajak / Biaya (Economy Sinks Kuat)
    TRADE_TAX_PERCENT: 15,      // Pajak 15% saat menjual saham (mengurangi inflasi)
    TRANSFER_TAX_PERCENT: 10,   // Pajak transfer 10% untuk mencegah eksploitasi multi-akun (alts)

    // Koin Keaktifan Voice Channel (Voice Earnings Diperketat)
    VOICE_EARN_INTERVAL_MS: 5 * 60 * 1000, // Durasi pengecekan keaktifan diperlambat menjadi setiap 5 menit
    VOICE_EARN_AMOUNT: 1,              // Hanya 1 Rp per 5 menit
    VOICE_MIN_MEMBERS: 2,              // Minimal orang di dalam voice channel agar dapat koin
    VOICE_EARN_LIMIT_DAILY: 25,        // Maksimal koin Voice Earn per hari per user diperketat ke Rp 25
  },

  // Logika & Aturan Stock Market
  market: {
    UPDATE_INTERVAL_MS: 2 * 60 * 60 * 1000, // Update harga setiap 2 jam
    
    // Jam Operasional (WIB)
    OPEN_HOUR: 8,               // Buka jam 08:00 WIB
    CLOSE_HOUR: 23,             // Tutup jam 23:00 WIB (perdagangan mati setelah jam 23:00)

    // Batasan Harga Saham (Rp)
    MIN_PRICE: 10,              // Harga terendah
    MAX_PRICE: 10000,           // Harga tertinggi (mencegah hyperinflation)
    INITIAL_PRICE: 100,         // Harga awal saham baru

    // Batasan Transaksi
    MIN_SHARES_TRADE: 1,
    MAX_SHARES_PER_TRADE: 100,
    MAX_SHARES_HOLD_PER_USER: 500,     // Batas maksimal lembar saham per channel yang boleh dimiliki satu user

    // Multiplier Dividen Mingguan
    WEEKLY_DIVIDEND_BASE_RATE: 0.02, // 2% dari harga saham saat ini
  },

  // Konfigurasi Anti-Spam
  antiSpam: {
    DUPLICATE_LIMIT: 3,         // Maksimal pesan yang sama berturut-turut sebelum diblokir poinnya
    MAX_POINTS_PER_HOUR: 300,   // Maksimal koin yang bisa didapat dalam 1 jam per user
    EXCLUDED_CHANNELS: [
      'bot-commands',
      'spam',
      'test'
    ]
  },

  // Konfigurasi Event Ekonomi Random
  events: {
    CRON_SCHEDULE: '0 9,12,15,18,21 * * *', // Setiap 3 jam dari jam 09:00 s/d 21:00 WIB (Asia/Jakarta)
    TRIGGER_PROBABILITY: 0.30,            // Peluang 30% memicu event di setiap jadwal check
    DOUBLE_EARNING_DURATION: 3600,        // Durasi Double Earning Hour (dalam detik = 1 jam)
  },

  // Konfigurasi Sistem Gacha Role Premium (Hard Mode)
  gacha: {
    COST: 250,                  // Biaya memutar Gacha (sangat menantang mengingat saldo susah didapat)
    CASHBACK: 100,              // Cashback jika memenangkan role yang sudah dimiliki
    ZONK_RATE: 75,              // 75% kemungkinan zonk (sangat sulit!)
    
    // Proporsi pemenang di 25% sisa kesempatan (Total = 100% dari pool kemenangan)
    RATES: {
      COMMON: 70.0,             // 70% dari pemenang
      RARE: 22.0,               // 22% dari pemenang
      EPIC: 6.8,                // 6.8% dari pemenang
      LEGENDARY: 1.1,           // 1.1% dari pemenang
      MYTHIC: 0.1               // 0.1% dari pemenang (Jackpot Dewa!)
    },

    // Kumpulan item sampah lucu untuk rasa humor ketika Zonk
    TRASH_ITEMS: [
      { name: '🍂 Daun Kering Hanyut', desc: 'Tidak ada gunanya sama sekali, hanya mengotori dompet Anda.' },
      { name: '🪨 Batu Kali Licin', desc: 'Bisa dilempar ke sungai untuk melatih lemparan batu, tapi tidak bisa dibelanjakan.' },
      { name: '🥫 Kaleng Sarden Berkarat', desc: 'Berbau amis, tajam, dan tidak berharga.' },
      { name: '👞 Sandal Swallow Sebelah Kiri', desc: 'Mana pasangan sebelah kanannya? Entahlah, Anda hanya dapat kirinya.' },
      { name: '🦴 Tulang Ayam Sisa Kemarin', desc: 'Bahkan kucing liar di dekat kosan pun menolaknya.' },
      { name: '🔌 Kabel Charger Putus', desc: 'Hati-hati tersetrum, ini hanya tembaga rongsokan.' },
      { name: '🍼 Tutup Botol Galon Bekas', desc: 'Mungkin bisa digunakan untuk kerajinan tangan kelas SD.' },
      { name: '🧾 Struk Belanjaan Tahun Lalu', desc: 'Struk pembelian mie instan yang tinta tulisannya sudah pudar.' }
    ]
  },

  // Konfigurasi Sistem Sewa & Upgrade Kos-kosan (Rupiah Server Kosan 1A)
  kos: {
    // Durasi sewa: 3 hari (dalam detik)
    RENT_DURATION_SECONDS: 3 * 24 * 60 * 60,

    ROOMS: {
      KIPAS: {
        id: 'KIPAS',
        name: '💨 Kamar Kipas Angin',
        price: 150,
        dailyBonus: 5,
        desc: 'Kamar sederhana ber-kipas dinding, cukup dingin untuk tidur malam tanpa berkeringat.'
      },
      AC: {
        id: 'AC',
        name: '❄️ Kamar AC',
        price: 350,
        dailyBonus: 15,
        transferTax: 8, // 8% pajak transfer koin (default 10%)
        desc: 'Kamar nyaman dengan AC hembus dingin, membuat konsentrasi bekerja di kosan semakin mantap.'
      },
      PENTHOUSE: {
        id: 'PENTHOUSE',
        name: '👑 Penthouse Kosan',
        price: 800,
        dailyBonus: 40,
        transferTax: 5, // 5% pajak transfer koin
        tradeTax: 10,  // 10% pajak bursa jual saham (default 15%)
        desc: 'Kamar kasta tertinggi kosan dengan TV 4K, kulkas mini, kasur king-size, dan privasi premium.'
      }
    },

    UPGRADES: {
      KASUR: {
        id: 'KASUR',
        name: '🛏️ Kasur Busa Super',
        price: 200,
        desc: 'Menggantikan tikar tipis. Memberikan bonus +Rp 1 per hari streak pada Daily Claim harian Anda.'
      },
      WIFI: {
        id: 'WIFI',
        name: '📶 WiFi Kosan Kencang',
        price: 300,
        desc: 'Meningkatkan limit harian perolehan koin keaktifan Voice Channel sebesar +Rp 10 (dari 25 -> 35).'
      },
      DISPENSER: {
        id: 'DISPENSER',
        name: '💧 Dispenser Air Galon',
        price: 150,
        desc: 'Dispenser air dingin menyegarkan di dalam kamar. Peluang 10% melipatgandakan koin chat earn Anda.'
      },
      GEMBOK: {
        id: 'GEMBOK',
        name: '🔒 Gembok Pintu Solid',
        price: 250,
        desc: 'Gembok besi tebal untuk pintu kamar. Meningkatkan batas limit pinjaman bank Anda sebesar +Rp 150.'
      }
    }
  }
};
