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
  REPORT_CHANNEL_ID: process.env.REPORT_CHANNEL_ID || '1478566460124041428',

  // Sistem Earning Poin (Rupiah Server)
  economy: {
    MSG_MIN_WORDS: 2,           // Minimal kata agar dapat koin
    MSG_MIN_LENGTH: 5,          // Minimal karakter agar dapat koin
    COOLDOWN_MS: 30 * 1000,     // Cooldown antar pesan per user (30 detik)
    
    // Poin acak yang didapat per pesan
    MIN_EARN: 5,
    MAX_EARN: 15,

    // Daily Claim
    DAILY_MIN: 100,
    DAILY_MAX: 300,
    DAILY_STREAK_BONUS: 20,     // Bonus per hari streak (e.g., streak 5 hari = +100 Rp)
    DAILY_STREAK_CAP: 7,        // Maksimal hari streak yang dihitung bonusnya

    // Pajak / Biaya (Economy Sinks)
    TRADE_TAX_PERCENT: 5,       // Pajak 5% saat menjual saham (masuk kas server/dihapus)
    TRANSFER_TAX_PERCENT: 2,    // Pajak 2% saat transfer koin antar member

    // Koin Keaktifan Voice Channel (Voice Earnings)
    VOICE_EARN_INTERVAL_MS: 60 * 1000, // Durasi pengecekan keaktifan (setiap 1 menit)
    VOICE_EARN_AMOUNT: 2,              // Koin yang didapatkan per menit
    VOICE_MIN_MEMBERS: 2,              // Minimal orang di dalam voice channel agar dapat koin (anti-farming)
    VOICE_EARN_LIMIT_DAILY: 300,       // Maksimal koin Voice Earn per hari per user (mencegah hyperinflation)
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
  }
};
