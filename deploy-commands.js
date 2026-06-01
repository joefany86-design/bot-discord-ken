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
    .setDescription('Menyuruh bot untuk bergabung ke Voice Channel dan memutar musik lokal secara otomatis'),
  
  new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Menyuruh bot untuk keluar dari Voice Channel'),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Menampilkan daftar perintah bot yang tersedia'),

  new SlashCommandBuilder()
    .setName('portal')
    .setDescription('Membuka Pusat Kontrol & Portal Hub Sentinel secara instan'),
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
