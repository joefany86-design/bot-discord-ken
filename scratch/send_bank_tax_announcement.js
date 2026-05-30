require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

// ID Saluran Pengumuman Kosan 1A
const ANNOUNCEMENTS_CHANNEL_ID = '1478566460124041428'; // #📢┃announcements

const ANNOUNCEMENT_TITLE = '🏛️ BANK SENTRAL KOSAN 1A: PEMBARUAN AKBAR SISTEM PERBANKAN AKTIF & PAJAK HARIAN';

const ANNOUNCEMENT_DESCRIPTION = "Halo @everyone! 👋✨\n\n" +
"Bank Sentral Kosan 1A baru saja merilis **Sistem Perbankan Aktif Dinamis & Regulasi Terbaru** demi menjaga kesehatan ekonomi server dan menekan tingkat inflasi koin!\n\n" +
"Mulai saat ini, tabungan bank tidak lagi pasif. Sistem baru ini menuntut strategi cerdas serta keaktifan warga dalam mengobrol! 🧠🔥\n\n" +
"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
"🏛️ **FITUR PERBANKAN AKTIF & DINAMIS BARU**\n" +
"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
"📥 **1. Pajak Transaksi Deposit & Withdrawal**\n" +
"Setiap transaksi penyimpanan (`.dep`) dan penarikan (`.wd`) kini dikenakan pajak administrasi yang koinnya **langsung dibakar permanen dari server**!\n" +
"• Pajak Deposit: Default **2.0%**\n" +
"• Pajak Penarikan: Default **5.0%**\n\n" +
"📉 **2. Penyusutan Saldo Tabungan Pasif (Daily Security Drain)**\n" +
"Menyimpan uang di bank kini aman dari perampokan (.rob), tetapi bank mengenakan **Biaya Administrasi Keamanan Harian** yang memotong saldo bank pasif secara otomatis setiap tengah malam (**00:00 WIB**):\n" +
"• Default Biaya: **Rp 15 + 0.5%** dari total saldo tabungan Anda.\n\n" +
"📈 **3. Bunga Tabungan Harian Aktif (Active Chat Interest)**\n" +
"Bunga tabungan harian dibagikan setiap pukul **00:00 WIB**, tetapi bunganya **hanya aktif jika Anda mengobrol di chat hari itu**!\n" +
"• **Pasif (0 - 5 pesan harian)**: Bunga **0%** (Saldo tabungan Anda dipastikan berkurang/menyusut dipotong biaya keamanan!).\n" +
"• **Aktif Sedang (6 - 20 pesan harian)**: Mendapatkan **50% bunga**.\n" +
"• **Sultan Aktif (21+ pesan harian)**: Mendapatkan **100% bunga maksimal** sesuai kasta kamar Anda!\n\n" +
"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
"🏢 **MANFAAT TINGKAT SEWA KAMAR KOSAN**\n" +
"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
"Warga yang menyewa kamar kosan premium kini mendapatkan perlindungan finansial dan keuntungan ganda:\n\n" +
"💨 **Kamar Kipas Angin (`KIPAS`)**:\n" +
"• Pajak Deposit: **1.5%** | Pajak Penarikan: **4.0%**\n" +
"• Biaya Keamanan Harian: **Rp 10 + 0.3%**\n" +
"• Bunga Tabungan Maksimal: **1.5% harian**\n\n" +
"❄️ **Kamar AC (`AC`)**:\n" +
"• Pajak Deposit: **1.0%** | Pajak Penarikan: **2.5%**\n" +
"• Biaya Keamanan Harian: **Rp 5 + 0.1%**\n" +
"• Bunga Tabungan Maksimal: **2.0% harian**\n\n" +
"👑 **Penthouse Kosan (`PENTHOUSE`)**:\n" +
"• Pajak Deposit: **0% (Bebas Pajak)** | Pajak Penarikan: **0% (Bebas Pajak)**\n" +
"• Biaya Keamanan Harian: **Rp 0 (Bebas Biaya Admin)**\n" +
"• Bunga Tabungan Maksimal: **3.0% harian (Bunga Sultan!)**\n\n" +
"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
"🎰 **REGULASI CASINO & BARANG MEWAH**\n" +
"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
"• ✖️ Fitur judi **Slot Machine** (`.slot`) dan **Toko Barang Mewah** (`.luxury`) telah **dihapus sepenuhnya** dari bot.\n" +
"• 🪙 Game **Coinflip** (`.coinflip` / `.cf`) dengan potongan pajak 5% tetap dipertahankan sebagai hiburan kasino aktif server!\n\n" +
"*Ayo naikkan kasta sewa kamar kosan Anda, aktiflah mengobrol, dan kelola keuangan Anda dengan cerdas untuk menjadi Warga Sultan Kosan 1A terpandang!* 💎🏆✨";

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
      .setColor('#00A2E8') // Premium Bank Blue
      .setTitle(ANNOUNCEMENT_TITLE)
      .setDescription(ANNOUNCEMENT_DESCRIPTION)
      .setTimestamp()
      .setFooter({ text: 'Bank Sentral Kosan 1A • Sentinel Financial Services' });

    await channel.send({ content: '@everyone', embeds: [embed] });
    
    console.log('✅ Embed pengumuman Bank Tax & Active Interest berhasil terkirim!');
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
