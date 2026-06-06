require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

// ID Saluran Pengumuman Update yang diminta user
const ANNOUNCEMENTS_CHANNEL_ID = '1509770711839805641';

const ANNOUNCEMENT_DESCRIPTION = "Halo @everyone! 👋✨\n\n" +
  "Kami baru saja merilis pembaruan sistem ekonomi baru untuk meningkatkan kenyamanan bertransaksi dan keadilan di server! Pembaruan ini mencakup **Pilihan Metode Pembayaran** dan **Sistem Denda Terpadu**. 💵🏦⚖️\n\n" +
  "Berikut adalah rincian lengkap dari pembaruan yang telah aktif sepenuhnya:\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "🪙 **1. PILIHAN METODE PEMBAYARAN (DOMPET / BANK)**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "Kini bertransaksi menjadi lebih fleksibel! Setiap kali Anda melakukan pembelian, sistem akan menampilkan **konfirmasi interaktif** di mana Anda bisa memilih sumber dana:\n\n" +
  "*   **💵 Dompet (Pocket)** — Bayar menggunakan koin di kantong Anda.\n" +
  "*   **🏦 Bank Savings** — Bayar langsung memotong saldo tabungan bank Anda.\n" +
  "*   **Fitur Terbuka Pada**:\n" +
  "    *   🛒 **Toko Role & Gacha Role** (`.buy-role` / `.gacha-role`)\n" +
  "    *   🕶️ **Black Market** (`.bm buy`)\n" +
  "    *   🍖 **Toko Pet & Adopsi Telur Pet** (`.pet buy` / `.pet adopt`)\n" +
  "    *   🏥 **Dokter Pet (Revive)** (`.pet dokter` / `.pet revive`)\n" +
  "    *   🌱 **Toko Kebun / Cozy Garden** (`.toko-kebun beli`)\n" +
  "    *   🎟️ **Pembelian Tiket Lotre** (`.lotre beli`)\n\n" +
  "*(Catatan: Tombol pilihan pembayaran akan dinonaktifkan secara otomatis jika saldo di salah satu akun Anda tidak mencukupi.)*\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "⚖️ **2. SISTEM DENDA TERPADU (INTEGRATED FINE SYSTEM)**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "Kami telah menutup celah memindahkan koin ke Bank untuk menghindari denda kejahatan! Sekarang, denda denda dari aksi ilegal akan dipotong secara terpadu:\n\n" +
  "*   **Alur Pemotongan**:\n" +
  "    1.  Denda akan dipotong dari **Dompet** Anda terlebih dahulu.\n" +
  "    2.  Jika dompet kosong atau tidak mencukupi, sisa denda akan **otomatis memotong Tabungan Bank** Anda.\n" +
  "    3.  Jika total koin di dompet dan bank Anda tetap tidak mencukupi, denda akan memotong seluruh sisa uang Anda hingga **tersisa Rp 0**.\n" +
  "*   **Berlaku Untuk**:\n" +
  "    *   ❌ Perampokan Solo Gagal (`.rob`)\n" +
  "    *   ❌ Kegagalan QTE Penjara & Buronan\n" +
  "    *   ❌ Kegagalan Aksi Heist Bank (`.heist`)\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
  "💡 *TIPS*: Coba lakukan pembelian benih di `.toko-kebun beli` atau tiket lotre di `.lotre beli` untuk melihat dan mencoba prompt interaktif baru ini!\n\n" +
  "Selamat bermain, kelola keuangan Anda dengan bijak, dan hati-hati saat melakukan aksi kriminal! 🕵️⚖️";

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
      .setColor('#9b59b6') // Beautiful Purple Color
      .setTitle('📢 UPDATE SENTINEL: PILIHAN METODE PEMBAYARAN & SISTEM DENDA TERPADU! 💵🏦⚖️')
      .setDescription(ANNOUNCEMENT_DESCRIPTION)
      .setTimestamp()
      .setFooter({ text: 'Sentinel Bot • System Updates' });

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
