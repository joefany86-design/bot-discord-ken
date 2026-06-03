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

  // ID Channel khusus Perbankan Server (Midnight Processing, Bunga, Pajak Progresif)
  BANK_REPORT_CHANNEL_ID: process.env.BANK_REPORT_CHANNEL_ID || process.env.REPORT_CHANNEL_ID || '1509480324373942272',

  // ID Channel khusus Pencairan Gaji Harian Otomatis
  DAILY_CLAIM_CHANNEL_ID: process.env.DAILY_CLAIM_CHANNEL_ID || process.env.REPORT_CHANNEL_ID || '1509480324373942272',

  // ID Channel khusus Pengumuman Server & Event Penting (Lotre, Dividen, Event Bursa)
  ANNOUNCEMENT_CHANNEL_ID: process.env.ANNOUNCEMENT_CHANNEL_ID || process.env.REPORT_CHANNEL_ID || '1509480324373942272',

  // ID Channel untuk Realtime Leaderboards (Kanglomerat, Top Pet, Daily Active)
  LEADERBOARD_RICH_CHANNEL_ID: process.env.LEADERBOARD_RICH_CHANNEL_ID || '1510230591860113418',
  LEADERBOARD_PET_CHANNEL_ID: process.env.LEADERBOARD_PET_CHANNEL_ID || '1510232295448117308',
  LEADERBOARD_DAILY_CHANNEL_ID: process.env.LEADERBOARD_DAILY_CHANNEL_ID || '1510240252458176662',

  // Sistem Earning Poin (Rupiah Server)
  economy: {
    MSG_MIN_WORDS: 3,           // Minimal kata agar dapat koin (ditingkatkan untuk mencegah spam koin pendek)
    MSG_MIN_LENGTH: 10,         // Minimal karakter agar dapat koin
    COOLDOWN_MS: 40 * 1000,     // Cooldown antar pesan diperketat dari 45s -> 40s

    // Poin acak yang didapat per pesan
    MIN_EARN: 2,
    MAX_EARN: 5,

    // Daily Claim (Peningkatan terkendali)
    DAILY_MIN: 35,
    DAILY_MAX: 75,
    DAILY_STREAK_BONUS: 3,      // Bonus per hari streak
    DAILY_STREAK_CAP: 7,        // Maksimal hari streak yang dihitung bonusnya

    // Pajak / Biaya (Economy Sinks Kuat)
    TRADE_TAX_PERCENT: 15,      // Pajak 15% saat menjual saham (mengurangi inflasi)
    TRANSFER_TAX_PERCENT: 10,   // Pajak transfer 10% untuk mencegah eksploitasi multi-akun (alts)

    // Koin Keaktifan Voice Channel (Peningkatan moderat)
    VOICE_EARN_INTERVAL_MS: 5 * 60 * 1000, // Durasi pengecekan keaktifan diperlambat menjadi setiap 5 menit
    VOICE_EARN_AMOUNT: 2,              // Hanya 2 Rp per 5 menit
    VOICE_MIN_MEMBERS: 2,              // Minimal orang di dalam voice channel agar dapat koin
  },

  // Konfigurasi Black Market (Pasar Gelap)
  blackmarket: {
    MAX_ITEM_HOLD_LIMIT: 10,           // Batas maksimal kepemilikan item BM per jenis per user
  },

  // Konfigurasi Lotre Mingguan Server
  lottery: {
    TICKET_PRICE: 100,              // Harga per tiket lotre (Rp)
    BURN_PERCENT: 15,               // % pool yang dibakar saat undian
    DRAW_CRON: '0 21 * * 0',        // Undian setiap Minggu 21:00 WIB
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
    MAX_SHARES_HOLD_PER_USER: 100,     // Batas maksimal lembar saham per channel yang boleh dimiliki satu user
    
    // Regulasi & Batasan Baru (Anti-Penimbunan)
    MIN_HOLD_DURATION_SECONDS: 86400,  // Minimal 1 hari (24 jam) hold sebelum boleh dijual
    DAILY_BUY_SHARES_LIMIT: 10,        // Maksimal 10 lembar saham yang boleh dibeli per hari per user
    MAX_SHARES_SELL_PER_TRADE: 100,    // Maksimal 100 lembar per transaksi penjualan
    TOTAL_BURSA_SHARES: 500,           // Maksimal total lembar saham beredar per channel di server

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
    COST: 800,                  // Biaya memutar Gacha
    CASHBACK: 150,              // Cashback jika memenangkan role yang sudah dimiliki
    ZONK_RATE: 75,              // 75% kemungkinan zonk (seimbang & menantang!)

    // Proporsi pemenang di 25% sisa kesempatan (Total = 100% dari pool kemenangan)
    RATES: {
      COMMON: 81.5,             // 81.5% dari pemenang
      RARE: 15.0,               // 15% dari pemenang
      EPIC: 3.0,                // 3% dari pemenang
      LEGENDARY: 0.5,           // 0.5% dari pemenang
      MYTHIC: 0.0               // 0% dari pemenang (Jackpot Dewa!)
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
        desc: 'Gembok besi tebal. Meningkatkan batas limit pinjaman bank Anda sebesar +Rp 150, serta mengurangi koin yang dicuri pelaku sebesar 50% saat Anda dirampok (.rob).'
      },
      ALARM: {
        id: 'ALARM',
        name: '🚨 Alarm Security Kamar',
        price: 500,
        desc: 'Mendeteksi gerakan mencurigakan. Mengurangi peluang keberhasilan pelaku yang merampok Anda sebesar 15% (menjadi 25% sukses).'
      },
      CCTV: {
        id: 'CCTV',
        name: '📹 Kamera CCTV Pengawas',
        price: 350,
        desc: 'Merekam tindakan kriminal. Memberikan denda denda tambahan +Rp 100 kompensasi jika pelaku gagal merampok Anda.'
      },
      SECURITY: {
        id: 'SECURITY',
        name: '👮 Security Jaga Penthouse',
        price: 750,
        desc: 'Khusus Penthouse. Aksi perampokan (.rob) ke arah Anda otomatis gagal 100% (pelaku tertangkap basah & langsung masuk penjara)!'
      }
    }
  },

  // Konfigurasi Sistem Perampokan (Robbery & Heist)
  robbery: {
    SUCCESS_RATE: 45,             // Peluang dasar sukses Solo Rob (45%)
    JAIL_SOLO_SECONDS: 300,       // Masa hukuman Solo Rob: 5 menit (300s)
    JAIL_HEIST_BASE: 1800,        // Masa hukuman Heist: 30 menit (1800s)
    BAIL_SOLO: 250,               // Uang jaminan Solo Rob: Rp 250
    BAIL_HEIST: 2500,             // Uang jaminan Heist dinaikkan ke Rp 2.500
    PREP_FEE: 400,                // Biaya persiapan Heist per orang
    COOLDOWN_HEIST_SECONDS: 2 * 3600, // Cooldown Heist: 2 jam (7200 detik)
    MIN_ROB_BALANCE_ROBBER: 300,  // Saldo minimal pelaku agar bisa merampok
    MIN_ROB_BALANCE_VICTIM: 500,  // Saldo minimal korban agar bisa dirampok
    MAX_HEIST_DRAIN_PER_USER: 5000, // Batas maksimal koin terpotong per nasabah per heist
  },

  // Konfigurasi Game Kasino (Slot & Coinflip)
  casino: {
    COINFLIP_TAX_PERCENT: 5,     // Pajak kemenangan coinflip 5%
    COINFLIP_MIN_BET: 20,
    COINFLIP_MAX_BET: 5000,
    
    SLOT_MIN_BET: 20,
    SLOT_MAX_BET: 10000,
    
    // Emojis yang digunakan di reel slot
    SLOT_EMOJIS: ['💎', '👑', '🍒', '🍇', '🍋', '❌'],
    
    // Multipliers hasil slot
    MULTIPLIERS: {
      THREE_DIAMONDS: 10.0, // 💎💎💎
      THREE_KINGS: 8.0,     // 👑👑👑
      THREE_CHERRIES: 5.0,  // 🍒🍒🍒
      THREE_GRAPES: 3.5,    // 🍇🍇🍇
      THREE_LEMONS: 2.5,    // 🍋🍋🍋
      TWO_DIAMONDS: 1.5,
      TWO_KINGS: 1.2,
      TWO_CHERRIES: 1.0,
      JACKPOT_ANY_THREE: 2.0 // Tiga apapun yang cocok selain di atas
    }
  },

  // Konfigurasi Barang Mewah (Luxury & Collectibles Shop)
  luxury: {
    ITEMS: {
      LAMBO: { id: 'LAMBO', name: '🏎️ Mobil Sports Lamborgini Kosan', price: 25000, desc: 'Mobil super kencang untuk nongkrong di depan kosan. Simbol kekayaan mutlak!' },
      GOLD: { id: 'GOLD', name: '👑 Batangan Emas Murni 24 Karat', price: 12000, desc: 'Emas murni seberat 100 gram untuk investasi masa tua dan pajangan laci kosan.' },
      KEY: { id: 'KEY', name: '🔑 Kunci Emas Penthouse Kosan', price: 10000, desc: 'Kunci duplikat berlapis emas sebagai bukti Anda adalah penghuni Penthouse sejati.' },
      ROLEX: { id: 'ROLEX', name: '⌚ Jam Tangan Mewah Rolek Master', price: 6000, desc: 'Jam tangan mekanis elegan yang menunjukkan waktu sultan sangatlah berharga.' },
      IPHONE: { id: 'IPHONE', name: '📱 iPhone 16 Pro Max Layar Retak', price: 3500, desc: 'Biar layar retak, yang penting logo apel kroak di belakang tetap terlihat!' }
    }
  },

  // Konfigurasi Sistem Perbankan Dinamis (Pajak, Bunga & Penyusutan)
  bank: {
    DEPOSIT_TAX_ROOMS: {
      DEFAULT: 2,
      KIPAS: 1.5,
      AC: 1.0,
      PENTHOUSE: 0.0
    },
    WITHDRAW_TAX_ROOMS: {
      DEFAULT: 5,
      KIPAS: 4.0,
      AC: 2.5,
      PENTHOUSE: 0.0
    },
    DAILY_SECURITY_FEE: {
      DEFAULT: { flat: 15, percent: 0.5 },
      KIPAS: { flat: 10, percent: 0.3 },
      AC: { flat: 5, percent: 0.1 },
      PENTHOUSE: { flat: 0, percent: 0.0 }
    },
    INTEREST_RATE_ROOMS: {
      DEFAULT: 0.5,  // 0.5% harian (sebelumnya 1.0%)
      KIPAS: 0.75,   // 0.75% harian (sebelumnya 1.5%)
      AC: 1.0,      // 1.0% harian (sebelumnya 2.0%)
      PENTHOUSE: 1.5 // 1.5% harian (sebelumnya 3.0%)
    },
    INTEREST_CAP: 20000, // Batas maksimal saldo tabungan yang mendapatkan bunga harian

    // Pajak Progresif Mingguan (Setiap Senin 00:00 WIB)
    PROGRESSIVE_TAX_BRACKETS: [
      { min: 0,      max: 19999,           rate: 0 },     // Bebas pajak
      { min: 20000,  max: 49999,           rate: 2.5 },   // 2.5% dari total saldo
      { min: 50000,  max: 99999,           rate: 5.0 },   // 5.0% dari total saldo
      { min: 100000, max: Number.MAX_SAFE_INTEGER, rate: 10.0 },  // 10.0% dari total saldo (Sultan)
    ],
  },

  // Konfigurasi Cozy Flower Garden
  garden: {
    SYSTEM_ACTIVE: true, // Set to true to release to public. If false, only Owner/Admins can test it!
    WATER_COOLDOWN_MS: 15 * 60 * 1000, // Cooldown siram: 15 menit
    WATER_TIME_REDUCTION_SECONDS: 10 * 60, // Siraman memotong 10 menit
    GIFT_WRAPPING_PRICE: 100, // Kertas kado seharga Rp 100
    
    // Spesifikasi Bunga
    FLOWERS: {
      ROSE: { id: 'ROSE', name: '🌹 Mawar Merah', seedId: 'SEED_ROSE', flowerId: 'FLOWER_ROSE', seedPrice: 80, sellPrice: 105, growSeconds: 30 * 60, rarity: 'COMMON' },
      TULIP: { id: 'TULIP', name: '🌷 Bunga Tulip', seedId: 'SEED_TULIP', flowerId: 'FLOWER_TULIP', seedPrice: 150, sellPrice: 200, growSeconds: 1 * 3600, rarity: 'COMMON' },
      LAVENDER: { id: 'LAVENDER', name: '🪻 Bunga Lavender', seedId: 'SEED_LAVENDER', flowerId: 'FLOWER_LAVENDER', seedPrice: 250, sellPrice: 350, growSeconds: 2 * 3600, rarity: 'RARE' },
      SAKURA: { id: 'SAKURA', name: '🌸 Bunga Sakura', seedId: 'SEED_SAKURA', flowerId: 'FLOWER_SAKURA', seedPrice: 500, sellPrice: 750, growSeconds: 4 * 3600, rarity: 'RARE' },
      ORCHID: { id: 'ORCHID', name: '🪻 Anggrek Langka', seedId: 'SEED_ORCHID', flowerId: 'FLOWER_ORCHID', seedPrice: 1200, sellPrice: 2000, growSeconds: 8 * 3600, rarity: 'EPIC' }
    },
    
    // Resep Buket Bunga
    BOUQUETS: {
      LOVE: { 
        id: 'LOVE', 
        name: '💐 Buket Kasih Sayang (Love Bouquet)', 
        desc: 'Dibuat dari 3x Mawar Merah + 1x Kertas Kado.', 
        req: { FLOWER_ROSE: 3, GIFT_WRAPPING: 1 }, 
        buff: { type: 'daily_bonus', amount: 15, durationSeconds: 24 * 3600 } 
      },
      PEACE: { 
        id: 'PEACE', 
        name: '💐 Buket Ketenangan (Peace Bouquet)', 
        desc: 'Dibuat dari 2x Lavender + 2x Tulip + 1x Kertas Kado.', 
        req: { FLOWER_LAVENDER: 2, FLOWER_TULIP: 2, GIFT_WRAPPING: 1 }, 
        buff: { type: 'daily_bonus', amount: 35, durationSeconds: 24 * 3600 } 
      },
      IMPERIAL: { 
        id: 'IMPERIAL', 
        name: '👑 Buket Legendaris (Imperial Bouquet)', 
        desc: 'Dibuat dari 1x Anggrek Langka + 2x Sakura + 1x Kertas Kado.', 
        req: { FLOWER_ORCHID: 1, FLOWER_SAKURA: 2, GIFT_WRAPPING: 1 }, 
        buff: { type: 'daily_bonus', amount: 80, durationSeconds: 24 * 3600 } 
      }
    }
  }
};
