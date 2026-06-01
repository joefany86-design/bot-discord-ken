require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

// ID Saluran Pengumuman Game yang diminta user
const GAME_ANNOUNCEMENTS_CHANNEL_ID = '1509770711839805641';

const ANNOUNCEMENT_DESCRIPTION = "Halo @everyone! 👋✨\n\n" +
  "Kami baru saja merilis fitur pertahanan baru yang eksklusif untuk meningkatkan kenyamanan dan keamanan hunian termewah kalian di Kosan! 🏛️🔒\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "👮 **FITUR BARU: SECURITY JAGA PENTHOUSE**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
  "Kini para sultan penghuni **Penthouse Kosan** memiliki opsi untuk memperketat keamanan kamar dari ancaman perampok nakal (`.rob`)!\n\n" +
  "*   **Fasilitas**: `👮 Security Jaga Penthouse` (Dapat dibeli di `.kos` -> **Belanja Fasilitas** / `.kos-upgrade`).\n" +
  "*   **Harga**: **Rp 750 koin** (pembelian permanen).\n" +
  "*   **Syarat**: Hanya dapat dibeli dan aktif jika Anda sedang menyewa kamar **👑 Penthouse Kosan** secara aktif!\n" +
  "*   **Dampak Pertahanan**:\n" +
  "    *   Mengurangi peluang keberhasilan perampok yang menargetkan Anda sebesar **-35%** (Menjadikan Penthouse Anda sangat sulit ditembus, menyisakan peluang sukses minimal hanya 5% bagi perampok).\n" +
  "    *   Jika perampokan gagal, pelaku akan langsung **ditangkap basah oleh Security Jaga Penthouse**, dijebloskan ke **Penjara Virtual**, dan diwajibkan membayar denda kompensasi kepada pemilik Penthouse!\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
  "💡 *TIPS*: Ketik `.kos` untuk melihat status hunian Anda, klik **Belanja Fasilitas** untuk menyewa jasa Security, dan pastikan koin Anda tetap aman di dalam Penthouse elit! 👑👮🥂";

client.once('ready', async () => {
  console.log(`🤖 Login berhasil sebagai ${client.user.tag}`);
  
  try {
    const channel = await client.channels.fetch(GAME_ANNOUNCEMENTS_CHANNEL_ID);
    if (!channel) {
      console.error('❌ Saluran pengumuman game tidak ditemukan.');
      process.exit(1);
    }

    console.log(`📢 Membuat dan mengirim embed pengumuman ke saluran: #${channel.name}...`);
    
    const embed = new EmbedBuilder()
      .setColor('#ffc107') // Beautiful Gold/Amber Color
      .setTitle('📢 UPDATE KOSAN: SISTEM PERTAHANAN SECURITY PENTHOUSE AKTIF! 👮👑🔒')
      .setDescription(ANNOUNCEMENT_DESCRIPTION)
      .setTimestamp()
      .setFooter({ text: 'Sentinel Bot • Boarding House Updates' });

    await channel.send({ content: '@everyone', embeds: [embed] });
    
    console.log('✅ Embed pengumuman game berhasil terkirim!');
    process.exit(0);

  } catch (err) {
    console.error('❌ Gagal mengirim pengumuman:', err);
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN).catch(e => {
  console.error("Login failed:", e.message);
  process.exit(1);
});
