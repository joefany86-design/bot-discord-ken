/**
 * Konfigurasi Game Voice Channel — Truth or Dare Ultimate Hot Seat
 * Kosan 1A Economy System Integration
 */
const path = require('path');

module.exports = {
  // Database Path (menggunakan database terpusat)
  DATABASE_PATH: process.env.DATABASE_PATH || path.join(__dirname, '../data/economy.db'),

  // Pengaturan Ekonomi Game (Rupiah Server)
  economy: {
    SKIP_FINE: 20,              // Denda jika korban menyerah (Rp)
    SUCCESS_REWARD: 35,          // Hadiah jika korban sukses menjawab (Rp)
    ACTIVE_CHALLENGER_BONUS: 10, // Hadiah bonus untuk penanya aktif jika korban berhasil (Rp)
  },

  // Batas Waktu & Durasi (Milidetik)
  durations: {
    ANSWER_TIMEOUT_MS: 60 * 1000,   // Batas waktu menjawab (60 detik)
    COOLDOWN_MS: 10 * 1000,         // Cooldown manual antar game per user (10 detik)
    TRANSITION_DELAY_MS: 5 * 1000,  // Waktu transisi auto-advance hasil (5 detik)
  },

  // Konfigurasi Kategori Sensitivitas
  categories: {
    DEFAULT: 'chill',
    ALLOWED: ['chill', 'deep', 'spicy', 'custom'],
    SPICY_NSFW_ONLY: true, // Spicy kategori hanya boleh di NSFW text channel
  },

  // Konfigurasi Mode Game
  modes: {
    DEFAULT: 'mode_2',
    ALLOWED: ['mode_1', 'mode_2', 'mode_3'],
    LABELS: {
      mode_1: '⚔️ Mode 1: Saling Tanya (1 vs 1)',
      mode_2: '🔥 Mode 2: Interogasi (Hot Seat)',
      mode_3: '🤖 Mode 3: Bot TTS (Bot Bertanya)'
    }
  }
};
