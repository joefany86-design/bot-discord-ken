require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

// ID Saluran Pengumuman Game Kosan 1A
const GAME_ANNOUNCEMENTS_CHANNEL_ID = '1509770711839805641';

const ANNOUNCEMENT_DESCRIPTION = 
  "Halo Warga Kosan 1A! @everyone 🦖💼🛡️\n\n" +
  "Kabar gembira bagi seluruh pelatih monster virtual! Sentinel Bot baru saja menerima **UPGRADE BESAR** untuk sistem Pet dan Ekspedisi. Berbagai penyesuaian ini dirancang untuk membuat progress level pet terasa lebih seru, lebih cepat, dan memberikan bonus pasif ekonomi yang melimpah! ✨🚀\n\n" +
  "Berikut rincian lengkap update besar yang **SUDAH AKTIF SEKARANG**:\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "⚔️ **1. EKSPEDISI CO-OP TANPA BATAS SLOT (PVE)**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "*   💥 **Lobi Tanpa Batas:** Batasan maksimal 4 pemain resmi **DIHAPUS**! Sekarang berapapun jumlah pemain di server ini dapat ikut bergabung dalam satu lobi ekspedisi untuk berpetualang bersama!\n" +
  "*   ⏱️ **Kuota Harian:** Untuk menjaga keseimbangan, setiap pemain dibatasi maksimal **10 kali ekspedisi per hari** (Reset otomatis tengah malam WIB).\n" +
  "*   🛡️ **Sistem Proteksi:** Kuota harian Anda hanya akan berkurang jika ekspedisi **benar-benar berhasil dijalankan**. Jika lobi dibatalkan, kuota harian tidak terbuang.\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "📈 **2. KECEPATAN XP EKSPEDISI MENINGKAT 4X LIPAT**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "Progress level pet tim Anda kini melesat jauh lebih cepat di setiap ekspedisi:\n" +
  "*   🎉 **Ekspedisi Sukses:** Naik dari +50 XP menjadi **`+200 XP` dasar** per pet!\n" +
  "*   💔 **Ekspedisi Gagal:** Naik dari +15 XP menjadi **`+60 XP` dasar** per pet!\n" +
  "*   🌟 **Max Level Pet Tanpa Batas:** Level pet kini bertumbuh secara dinamis tanpa ada batasan (Unlimited Level Cap)!\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "⚡ **3. ITEM BARU: PERMANEN XP BOOSTER (TOKO PET)**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "Telah hadir 4 item booster di `.pet shop` untuk mempercepat peningkatan level pet Anda secara **PERMANEN**:\n" +
  "*   ⚡ **XP Booster 2x** — Harga: **Rp 2.500** *(Pengali XP Pet 2x Lipat)*\n" +
  "*   ⚡ **XP Booster 4x** — Harga: **Rp 5.000** *(Pengali XP Pet 4x Lipat)*\n" +
  "*   ⚡ **XP Booster 6x** — Harga: **Rp 7.500** *(Pengali XP Pet 6x Lipat)*\n" +
  "*   ⚡ **XP Booster 8x** — Harga: **Rp 10.000** *(Pengali XP Pet 8x Lipat - Max!)*\n" +
  "*   👉 *Multiplier XP ini berlaku untuk seluruh aktivitas pet (Bermain, Kerja, Hunt, PvP, & Ekspedisi) secara permanen!*\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "⏱️ **4. DURASI MENETAS & COOLDOWN DIPANGKAS 50%**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "Aktivitas harian pet kini jauh lebih efisien dengan durasi cooldown yang dipotong setengahnya:\n" +
  "*   🥚 **Penetasan Telur Standard:** Dipersingkat menjadi **1 Jam saja** (sebelumnya 2 jam)!\n" +
  "*   💕 **Penetasan Telur Breeding (Hybrid):** Dipersingkat menjadi **2 Jam** (sebelumnya 4 jam)!\n" +
  "*   💼 **Bekerja (.pet work):** Cooldown dikurangi menjadi **1 Jam** (Golem mendapatkan diskon khusus menjadi **40 Menit** saja!).\n" +
  "*   🏹 **Berburu (.pet hunt):** Cooldown dikurangi menjadi **2 Jam** (sebelumnya 4 jam).\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "💬 **5. FITUR PERINTAH BARU CHAT: `.pet use`**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "Kini Anda dapat langsung memberikan perawatan atau mengonsumsi booster untuk pet aktif lewat teks perintah cepat di chat:\n" +
  "*   👉 **Perintah:** **`.pet use <nama_item>`** atau **`.pet pakai <nama_item>`**\n" +
  "*   👉 **Contoh:** `.pet use food_basic` atau `.pet use xp_8x`\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
  "*Ayo adopsi telur pertamamu, berbelanja booster XP, dan ajak seluruh warga bergabung dalam ekspedisi massal di `.pet expedition` sekarang juga! Selamat bermain & sukses melatih pet terkuat Anda! 🦖🔥🐾🛡️*";

client.once('ready', async () => {
  console.log(`🤖 Login sukses sebagai ${client.user.tag}`);
  
  try {
    const channel = await client.channels.fetch(GAME_ANNOUNCEMENTS_CHANNEL_ID);
    if (!channel) {
      console.error('❌ Saluran pengumuman game tidak ditemukan.');
      process.exit(1);
    }

    console.log(`📢 Mengirim embed pengumuman ke saluran: #${channel.name}...`);
    
    const embed = new EmbedBuilder()
      .setColor('#9C27B0') // Premium Vibrant Orchid Purple
      .setTitle('📢 MAJOR UPDATE: SYSTEM PET UPGRADE BESAR-BESARAN! 🦖⚡🛡️')
      .setDescription(ANNOUNCEMENT_DESCRIPTION)
      .setThumbnail('https://cdn-icons-png.flaticon.com/512/616/616408.png')
      .setTimestamp()
      .setFooter({ text: 'Sentinel Tamagotchi System • Kosan 1A' });

    await channel.send({ content: '@everyone', embeds: [embed] });
    
    console.log('✅ Embed pengumuman game v2 berhasil dikirim!');
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
