/**
 * Konfigurasi Game Voice Channel & Auto Events
 * Sprint 5 — Truth or Dare klasik
 */
const path = require('path');

module.exports = {
  // Database Path (menggunakan database terpusat)
  DATABASE_PATH: process.env.DATABASE_PATH || path.join(__dirname, '../data/economy.db'),

  // Pengaturan Game Ekonomi (Rupiah Server)
  economy: {
    SKIP_FINE: 5000,      // Denda jika melewati tantangan (Rp)
    SUCCESS_REWARD: 150,  // Hadiah jika berhasil melakukan tantangan (Rp)
  },

  // Durasi Pengecekan & Timeout
  durations: {
    CHOICE_TIMEOUT_MS: 30 * 1000, // Waktu bagi korban untuk memilih Truth/Dare (30 detik)
    GAME_TIMEOUT_MS: 60 * 1000,   // Waktu bagi korban untuk menyelesaikan tantangan (60 detik)
    COOLDOWN_MS: 15 * 1000,       // Cooldown antar game manual per user (15 detik)
  },

  // Pengaturan Otomatisasi (Auto Voice Events)
  autoEvents: {
    MIN_MEMBERS: 3,                 // Minimal anggota aktif di VC untuk memicu event
    MIN_ACTIVE_TIME_MS: 10 * 60 * 1000, // Durasi aktif sebelum memicu event (10 menit)
    COOLDOWN_MS: 2 * 60 * 60 * 1000,   // Cooldown antar undangan otomatis (2 jam)
    TARGET_TEXT_CHANNEL_ID: null,   // ID Channel khusus pengumuman (null = channel default sistem)
  },

  // Konfigurasi Kategori Sensitivitas
  categories: {
    DEFAULT: 'chill',
    ALLOWED: ['chill', 'deep', 'spicy'],
    SPICY_NSFW_ONLY: true, // Spicy kategori hanya boleh di NSFW text channel
  }
};
