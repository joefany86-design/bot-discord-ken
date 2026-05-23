/**
 * Konfigurasi untuk Fitur Sapaan Otomatis (Auto-Greet)
 */
module.exports = {
  // Daftar target server (guild) dan channel tempat bot akan mengirimkan sapaan otomatis
  targets: [
    {
      guildId: process.env.GREETING_GUILD_ID || '1410239829874053296',
      channelId: process.env.GREETING_CHANNEL_ID || '1422642326798598348'
    },
    {
      guildId: '1468990737847681065',
      channelId: '1468990739378737367'
    }
  ],

  // Zona waktu untuk penjadwalan cron
  TIMEZONE: 'Asia/Jakarta',

  // Daftar jadwal sapaan otomatis
  greetings: [
    {
      cron: '0 6 * * *',
      title: '🌅 Selamat Pagi!',
      message: 'Selamat pagi semuanya! Semoga hari ini penuh berkah dan semangat! 💪✨',
      color: 0xFFD700,
      image: '🌄'
    },
    {
      cron: '0 12 * * *',
      title: '☀️ Selamat Siang!',
      message: 'Selamat siang semuanya! Jangan lupa makan siang dan istirahat ya! 🍚😊',
      color: 0xFF8C00,
      image: '🌞'
    },
    {
      cron: '0 15 * * *',
      title: '🌇 Selamat Sore!',
      message: 'Selamat sore semuanya! Tetap semangat menjalani sisa hari ini! 🌆💫',
      color: 0xE67E22,
      image: '🌅'
    },
    {
      cron: '0 21 * * *',
      title: '🌙 Selamat Malam!',
      message: 'Selamat malam semuanya! Semoga istirahat kalian nyenyak. Mimpi indah! 🌟😴',
      color: 0x2C3E50,
      image: '🌃'
    },
    {
      cron: '0 0 * * *',
      title: '🌌 Selamat Ganti Hari!',
      message: 'Selamat berganti hari semuanya! Lembaran baru telah dimulai, semoga hari ini berjalan menyenangkan dan lebih baik dari kemarin! 💫🌟',
      color: 0x1F1F2E,
      image: '✨'
    }
  ]
};
