/**
 * Konfigurasi untuk Fitur Sapaan Otomatis (Auto-Greet)
 */
module.exports = {
  // Daftar target server (guild) dan channel tempat bot akan mengirimkan sapaan otomatis
  targets: [
    {
      guildId: process.env.GREETING_GUILD_ID || '1410239829874053296',
      channelId: process.env.GREETING_CHANNEL_ID || '1422642326798598348'
    }
  ],

  // Zona waktu untuk penjadwalan cron
  TIMEZONE: 'Asia/Jakarta',

  // Penjadwalan Berita Harian (Cron: Setiap hari jam 08:00 WIB)
  newsCron: '0 8 * * *',

  // Daftar jadwal sapaan otomatis
  greetings: [
    {
      cron: '0 6 * * *',
      title: '🌅 Selamat Pagi!',
      message: 'Selamat pagi! Semoga hari ini berjalan lancar dan penuh dengan produktivitas. Mari awali hari dengan semangat baru dan pikiran positif! 🌅✨',
      color: 0xFFD700,
      image: '🌄'
    },
    {
      cron: '0 12 * * *',
      title: '☀️ Selamat Siang!',
      message: 'Selamat siang! Selamat beristirahat sejenak dari kesibukan hari ini. Jangan lupa untuk mengisi kembali energi Anda dan menjaga kesehatan. Selamat melanjutkan aktivitas! ☀️🍽️',
      color: 0xFF8C00,
      image: '🌞'
    },
    {
      cron: '0 15 * * *',
      title: '🌇 Selamat Sore!',
      message: 'Selamat sore! Semoga seluruh urusan dan pekerjaan Anda hari ini berjalan dengan lancar. Tetap jaga fokus dan semangat untuk menuntaskan aktivitas hari ini! 🌇✨',
      color: 0xE67E22,
      image: '🌅'
    },
    {
      cron: '0 21 * * *',
      title: '🌙 Selamat Malam!',
      message: 'Selamat malam! Waktunya mengistirahatkan tubuh dan pikiran setelah seharian beraktivitas. Terima kasih atas dedikasi dan kerja keras Anda hari ini. Selamat beristirahat! 🌙✨',
      color: 0x2C3E50,
      image: '🌃'
    },
    {
      cron: '0 0 * * *',
      title: '🌌 Selamat Ganti Hari!',
      message: 'Selamat berganti hari! Lembaran baru telah dimulai dengan peluang baru. Mari sambut esok dengan optimisme dan rencana terbaik. Selamat beristirahat! 🌌✨',
      color: 0x1F1F2E,
      image: '✨'
    }
  ]
};
