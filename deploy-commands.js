const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

// Memastikan variabel lingkungan terisi sebelum mendaftarkan commands
if (!process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN.startsWith('MASUKKAN')) {
  console.warn('Peringatan: DISCORD_TOKEN di file .env belum dikonfigurasi dengan benar.');
}
if (!process.env.CLIENT_ID || process.env.CLIENT_ID.startsWith('MASUKKAN')) {
  console.warn('Peringatan: CLIENT_ID di file .env belum dikonfigurasi dengan benar.');
}

const commands = [
  // === TTS Commands ===
  new SlashCommandBuilder()
    .setName('speak')
    .setDescription('Mengubah teks menjadi suara dan mengucapkannya')
    .addStringOption(option =>
      option.setName('text')
        .setDescription('Teks yang ingin diucapkan oleh bot')
        .setRequired(true)
        .setMaxLength(200)
    ),
  
  new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Menyuruh bot untuk keluar dari voice channel'),

  // === Music Commands ===
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('🎵 Putar musik dari YouTube (URL atau cari berdasarkan judul)')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('URL YouTube atau judul lagu yang ingin diputar')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('skip')
    .setDescription('⏭️ Skip lagu saat ini ke lagu berikutnya'),

  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('⏹️ Hentikan musik dan kosongkan antrian lagu'),

  new SlashCommandBuilder()
    .setName('queue')
    .setDescription('📋 Tampilkan daftar antrian lagu'),

  new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('🎶 Tampilkan informasi lagu yang sedang diputar'),

  new SlashCommandBuilder()
    .setName('pause')
    .setDescription('⏸️ Pause pemutaran musik'),

  new SlashCommandBuilder()
    .setName('resume')
    .setDescription('▶️ Lanjutkan pemutaran musik yang di-pause'),

  new SlashCommandBuilder()
    .setName('volume')
    .setDescription('🔊 Atur volume pemutaran musik')
    .addIntegerOption(option =>
      option.setName('level')
        .setDescription('Level volume (0-100)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(100)
    ),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`Sedang mendaftarkan ${commands.length} application (/) commands...`);

    // Daftarkan secara global
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log(`Berhasil mendaftarkan ${commands.length} application (/) commands secara global!`);
  } catch (error) {
    console.error('Terjadi kesalahan saat mendaftarkan commands:', error);
    console.log('\nTip: Pastikan DISCORD_TOKEN dan CLIENT_ID di file .env Anda sudah benar!');
  }
})();
