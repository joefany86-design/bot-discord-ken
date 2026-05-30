const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  const channelId = '1509770711839805641';
  const channel = await client.channels.fetch(channelId).catch(err => {
    console.error("Gagal mengambil channel:", err.message);
    process.exit(1);
  });
  
  if (!channel) {
    console.error("Channel tidak ditemukan.");
    process.exit(1);
  }
  
  const imagePath = '/Users/joefany/.gemini/antigravity-ide/brain/ad8d2f46-2059-4ac8-880b-04db675c7d72/flower_garden_teaser_1780174296106.png';
  const attachment = new AttachmentBuilder(imagePath, { name: 'flower_garden_teaser.png' });
  
  const embed = new EmbedBuilder()
    .setColor(0xFFB7B2) // Cozy pastel rose pink
    .setTitle('🌸 COMING SOON: COZY FLOWER GARDEN MINI-GAME 🌸')
    .setThumbnail('https://cdn-icons-png.flaticon.com/512/826/826165.png')
    .setDescription(
      `🔔 **PENGUMUMAN RESMI — SUDUT DAMAI BARU DI KOSAN 1A!** @everyone\n\n` +
      `*Lelah dengan dinginnya sel penjara .rob? Capek dengan naik-turunnya grafik bursa saham? Tarik napas dalam-dalam... Segera hadir sebuah fitur mini-game paling hangat, santai, dan penuh warna di server kita!*\n\n` +
      `🌱 **SELAMAT DATANG DI COZY FLOWER GARDEN!**\n` +
      `Sebuah mini-game simulasi berkebun estetik yang didedikasikan untuk Anda yang menyukai aktivitas santai, estetika manis, dan interaksi sosial yang hangat. Di sini, Anda bisa membangun taman impian pribadi dan berbagi kasih dengan warga server lainnya!\n\n` +
      `🏡 **FITUR UTAMA YANG AKAN SEGERA DAPAT ANDA MAINKAN:**\n\n` +
      `🧱 **1. Kebun Virtual Pribadi (\`.kebun\` / \`.garden\`)**\n` +
      `Miliki **3 slot tanah kebun** eksklusif. Anda bisa menanam berbagai jenis benih, menyiramnya secara berkala, dan melihat pertumbuhan tanaman secara visual dari tunas kecil hingga mekar indah dengan progress bar yang cantik!\n\n` +
      `💦 **2. Perawatan Tanaman Real-Time (\`.siram\` / \`.water\`)**\n` +
      `Siram kebun Anda secara rutin untuk mempercepat waktu mekarnya bunga. Tanaman Anda aman 100% di dalam kebun dan **TIDAK BISA DIMALING** oleh perampok jalanan!\n\n` +
      `💐 **3. Rangkai Buket Bunga Cantik (\`.buket\`)**\n` +
      `Panen bunga-bunga indah Anda (Mawar, Tulip, Lavender, Sakura, Anggrek) dan rangkai menjadi buket bunga yang menawan dengan berbagai resep kerajinan yang seru!\n\n` +
      `🎁 **4. Sistem Berbagi Kado Manis (\`.gift-buket\`)**\n` +
      `Kirimkan buket hasil rangkain Anda kepada teman dekat atau member kesayangan Anda di server lengkap dengan pesan kustom romantis! Penerima buket akan mendapatkan *affection points* dan efek pasif tambahan koin Rupiah harian!\n\n` +
      `🛍️ **5. Pasar Kebun (\`.toko-kebun\` & \`.jual-bunga\`)**\n` +
      `Beli persediaan benih Anda atau jual hasil panen bunga segar Anda kembali ke pasar untuk meraup keuntungan koin Rupiah yang melimpah!\n\n` +
      `⏳ **KAPAN GERBANG KEBUN DIBUKA?**\n` +
      `Proses pengerjaan tanah dan instalasi irigasi virtual sedang diselesaikan oleh tim developer kami. Gerbang kebun virtual akan segera dibuka dalam beberapa hari ke depan! Siapkan koin Rupiah Anda untuk memborong benih pertama!\n\n` +
      `*Ayo persiapkan diri Anda untuk menjadi petani bunga tersukses di Kosan 1A! 🌻🌷*`
    )
    .setImage('attachment://flower_garden_teaser.png')
    .setFooter({ text: 'Cozy Flower Garden • Coming Soon Teaser Kosan 1A', iconURL: channel.guild.iconURL({ dynamic: true }) || null })
    .setTimestamp();
    
  await channel.send({
    embeds: [embed],
    files: [attachment]
  });
  
  console.log("✅ Flower garden teaser successfully posted!");
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error("Gagal login:", err.message);
  process.exit(1);
});
