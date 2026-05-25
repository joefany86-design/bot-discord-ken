/**
 * Konfigurasi untuk Fitur Ice Breaker Otomatis
 * (Truth or Dare & Would You Rather)
 */
module.exports = {
  // Daftar target server (guild) dan channel untuk ice breaker
  // Menggunakan target yang sama dengan greetings
  targets: [
    {
      guildId: process.env.GREETING_GUILD_ID || '1410239829874053296',
      channelId: process.env.ICEBREAKER_CHANNEL_ID || process.env.GREETING_CHANNEL_ID || '1422642326798598348'
    },
    {
      guildId: '1468990737847681065',
      channelId: '1468990739378737367'
    }
  ],

  // Zona waktu untuk penjadwalan cron
  TIMEZONE: 'Asia/Jakarta',

  // Durasi voting dalam milidetik (2 menit)
  VOTE_DURATION_MS: 2 * 60 * 1000,

  // Cooldown perintah manual per user dalam milidetik (5 menit)
  MANUAL_COOLDOWN_MS: 5 * 60 * 1000,

  // Cooldown otomatis per guild dalam milidetik (30 menit)
  AUTO_COOLDOWN_MS: 30 * 60 * 1000,

  // Jadwal cron untuk ice breaker otomatis
  schedules: [
    {
      cron: '30 12 * * *',
      label: '🍽️ Siang Santai',
      description: 'Ice breaker setelah makan siang'
    },
    {
      cron: '0 16 * * *',
      label: '🌇 Sore Chill',
      description: 'Ice breaker sore hari'
    },
    {
      cron: '0 20 * * *',
      label: '🌙 Malam Seru',
      description: 'Ice breaker prime time malam'
    },
    {
      cron: '0 14 * * 0,6',
      label: '🎉 Weekend Bonus',
      description: 'Ice breaker bonus akhir pekan'
    }
  ],

  // Konfigurasi tampilan per mode
  modes: {
    truth: {
      color: 0x00D4AA,
      title: '🤔 TRUTH TIME!',
      emoji: '🤔💬',
      reactAccept: '✅',
      reactSkip: '😱',
      labelAccept: 'Aku mau jawab!',
      labelSkip: 'Nggak berani!'
    },
    dare: {
      color: 0xFF6B6B,
      title: '🔥 DARE TIME!',
      emoji: '🔥🎯',
      reactAccept: '✅',
      reactSkip: '😱',
      labelAccept: 'Aku berani!',
      labelSkip: 'Nggak berani!'
    },
    wyr: {
      color: 0x7C4DFF,
      title: '⚡ WOULD YOU RATHER?',
      emoji: '⚡🤷',
      reactA: '🅰️',
      reactB: '🅱️'
    }
  }
};
