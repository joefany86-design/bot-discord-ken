require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

// ID Saluran Pengumuman
const ANNOUNCEMENT_CHANNEL_ID = '1509770711839805641';

const ANNOUNCEMENT_DESCRIPTION = "Halo @everyone! 👋✨\n\n" +
  "Hari ini kami merilis pembaruan besar pada **Sistem Perampokan Bank Bersama (.heist)**! Kami mengubahnya menjadi sistem **Hardcore Co-op RPG** yang membutuhkan kedisiplinan dan fokus 100% dari seluruh kru! 🏛️💥\n\n" +
  "Berikut adalah mekanisme gameplay baru yang wajib dipelajari sebelum memulai aksi kriminal Anda:\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "🎮 **1. MEKANISME SEQUENTIAL ACTION CHAIN (QTE)**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "Perampokan bank tidak lagi instan! Setiap kru akan dibagi peran secara otomatis setelah lobi 90 detik selesai:\n" +
  "*   💻 **Langkah 1 (Hacker)**: Harus mengklik `💻 Jalankan Hack` tepat waktu.\n" +
  "*   🧨 **Langkah 2 (Peledak)**: Harus mengklik `🧨 Ledakkan Pintu` tepat waktu.\n" +
  "*   🔫 **Langkah 3 (Eksekutor)**: Harus mengklik `🔫 Lumpuhkan Penjaga` (hanya jika kru >= 3).\n" +
  "*   🚗 **Langkah Akhir (Supir)**: Harus mengklik `🚗 Tancap Gas` untuk kabur dari kejaran SWAT!\n\n" +
  "⏰ **SISA WAKTU REAKSI**: Setiap target peran hanya memiliki batas waktu **6 DETIK** untuk menekan tombol aksi gilirannya!\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "🚨 **2. INTERFERENCE INSTAFAIL (Hukuman Salah Klik)**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "Untuk melatih kedisiplinan koordinasi tim, kami menerapkan aturan penalti yang brutal:\n" +
  "*   🔴 **Salah Klik / Salah Giliran**: Jika ada kru heist yang menekan tombol aksi aktif **saat bukan gilirannya**, sistem keamanan bank langsung berbunyi!\n" +
  "*   🚓 **Gagal Instan**: Aksi perampokan langsung dihentikan detik itu juga. Seluruh kru tertangkap polisi, didenda koin, dan masuk penjara virtual selama **2 jam**!\n" +
  "*   📢 **Pengumuman Pelaku**: Nama anggota kru yang melakukan salah klik akan diumumkan secara publik sebagai penyebab kegagalan operasi.\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "🧼 **3. INTELLIGENCE & GEAR PASIF**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "*   🧼 **Sabun Licin (SOAP)**: Tetap berfungsi otomatis dikonsumsi untuk memotong masa hukuman penjara heist sebesar **50%**.\n" +
  "*   🐉 **Sinergi Pet Golem & Slime**: Pasif pet dewasa tetap terintegrasi penuh untuk memotong denda atau memberikan peluang kabur (dodge jail).\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
  "⚠️ *Peringatan*: Perhatikan giliran Anda baik-baik, jangan terburu-buru, dan jaga fokus kru Anda agar tidak berakhir bersama di balik jeruji besi! 🚓👮\n\n" +
  "Selamat menyusun rencana dan mari taklukkan brankas utama! 🏦 Kosan 1A Finance ✨";

client.once('ready', async () => {
  console.log(`🤖 Login berhasil sebagai ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(ANNOUNCEMENT_CHANNEL_ID);
    if (!channel) {
      console.error('❌ Saluran pengumuman tidak ditemukan.');
      process.exit(1);
    }

    console.log(`📢 Membuat dan mengirim embed pengumuman ke saluran: #${channel.name}...`);

    const embed = new EmbedBuilder()
      .setColor('#FF5722') // Deep Orange / Red Action Color
      .setTitle('📢 UPDATE SENTINEL: REVAMP SISTEM CO-OP BANK HEIST (.heist) - HARDCORE EDITION 🏛️🚨')
      .setDescription(ANNOUNCEMENT_DESCRIPTION)
      .setTimestamp()
      .setFooter({ text: 'Sentinel Bot • Pembaruan Sistem Co-op RPG & Kedisiplinan Kru' });

    await channel.send({ content: '@everyone', embeds: [embed] });

    console.log('✅ Embed pengumuman berhasil terkirim!');
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
