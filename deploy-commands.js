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
  new SlashCommandBuilder()
    .setName('join')
    .setDescription('Menyuruh bot untuk bergabung ke voice channel Anda'),
  
  new SlashCommandBuilder()
    .setName('speak')
    .setDescription('Mengubah teks menjadi suara dan mengucapkannya')
    .addStringOption(option =>
      option.setName('text')
        .setDescription('Teks yang ingin diucapkan oleh bot')
        .setRequired(true)
        .setMaxLength(200) // Batas teks Google TTS gratis biasanya 200 karakter per request
    ),
  
  new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Menyuruh bot untuk keluar dari voice channel'),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Sedang mendaftarkan application (/) commands...');

    // Daftarkan secara global
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log('Berhasil mendaftarkan application (/) commands secara global!');
  } catch (error) {
    console.error('Terjadi kesalahan saat mendaftarkan commands:', error);
    console.log('\nTip: Pastikan DISCORD_TOKEN dan CLIENT_ID di file .env Anda sudah benar!');
  }
})();
