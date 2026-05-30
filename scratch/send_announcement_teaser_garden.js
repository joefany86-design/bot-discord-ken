require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

// ID Saluran Pengumuman Kosan 1A
const ANNOUNCEMENTS_CHANNEL_ID = '1478566460124041428'; // #📢┃announcements

const ANNOUNCEMENT_DESCRIPTION = "Halo @everyone! 👋✨\n\n" +
"Ada kabar angin berembus dari halaman belakang kosan kita... Sesuatu yang indah, damai, dan penuh warna sedang dipersiapkan untuk meluncur di Sentinel Bot minggu depan! 🤫👀\n\n" +
"Berikut adalah beberapa petunjuk tentang apa yang akan hadir:\n\n" +
"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
"🌱 **PETUNJUK FITUR BARU / TEASER CLUE**\n" +
"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
"🚜 **1. Halaman Belakang yang Kosong**\n" +
"Akan ada slot tanah pribadi untuk setiap warga. Kamu bisa menanam benih, merawatnya, dan menumbuhkan tanaman estetik kesukaanmu! 🌱\n\n" +
"💦 **2. Kasih Sayang & Ketelatenan**\n" +
"Tanamanmu butuh disiram secara rutin. Makin rajin kamu merawatnya, makin cepat mereka berkembang dan mekar menjadi bunga-bunga yang sangat indah! 💦🌸\n\n" +
"🧺 **3. Merangkai Kado Spesial**\n" +
"Bunga yang sudah mekar bisa kamu panen untuk dijual demi koin emas, ATAU kamu rangkai menjadi **Buket Bunga Cantik** (seperti Buket Kasih Sayang) untuk dihadiahkan secara khusus kepada orang terdekat di Kosan 1A! 🧸💌\n\n" +
"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
"Apakah kamu bisa menebak fitur apa ini? 🤔\n\n" +
"*Siapkan koin Rupiah kalian dan nantikan rilis resminya minggu depan! Semoga harimu menyenangkan dan penuh warna! 🌸🌾✨*";

client.once('ready', async () => {
  console.log(`🤖 Login berhasil sebagai ${client.user.tag}`);
  
  try {
    const channel = await client.channels.fetch(ANNOUNCEMENTS_CHANNEL_ID);
    if (!channel) {
      console.error('❌ Saluran pengumuman tidak ditemukan.');
      process.exit(1);
    }

    console.log(`📢 Membuat dan mengirim embed pengumuman ke saluran: #${channel.name}...`);
    
    const embed = new EmbedBuilder()
      .setColor('#ffa1c9') // Soft Pastel Pink/Peach
      .setTitle('🤫 CLUE UPDATE SENTINEL: SESUATU YANG INDAH SEDANG TUMBUH... 🌸✨')
      .setDescription(ANNOUNCEMENT_DESCRIPTION)
      .setTimestamp()
      .setFooter({ text: 'Sentinel Bot • Server Kosan 1A' });

    await channel.send({ content: '@everyone', embeds: [embed] });
    
    console.log('✅ Embed pengumuman clue/teaser berhasil terkirim!');
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
