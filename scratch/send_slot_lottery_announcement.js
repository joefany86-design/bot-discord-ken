require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

const CHANNEL_ID = '1509770711839805641';

const DESCRIPTION =
  "Halo @everyone! 🎉\n\n" +
  "Apakah dompet kalian sedang tipis, atau kalian punya koin berlebih yang ingin digandakan secara instan? Kami telah mengaktifkan kembali dua fitur hiburan dengan hadiah fantastis di server! 💸🔥\n\n" +
  "Berikut adalah informasi lengkap cara bermain dan keuntungannya:\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "🎰 **MESIN SLOT KOSAN (`.slot [jumlah_taruhan]`)**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "Sekarang kamu bisa menguji keberuntunganmu langsung di Mesin Slot interaktif! 🎰\n" +
  "*   **Cara Bermain:** Ketik `.slot <jumlah>` (Contoh: `.slot 500`).\n" +
  "*   **Batas Taruhan:** Minimal **Rp 20** s/d Maksimal **Rp 10.000** per putaran.\n" +
  "*   **Jackpot Fantastis:** Dapatkan simbol kembar 3 seperti 💎💎💎, 👑👑👑, atau 🍒🍒🍒 untuk memenangkan perkalian koin luar biasa!\n" +
  "*   *Hati-hati, mainkan dengan bijak agar tidak bangkrut! 😉*\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "🎟️ **UNDIAN LOTRE MINGGUAN (`.lotre`)**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "Mimpi menjadi jutawan mendadak dengan modal receh? Ikuti lotre mingguan server! 🎟\n" +
  "*   **Harga Tiket:** Hanya **Rp 100** per tiket.\n" +
  "*   **Cara Membeli:** Ketik `.lotre beli <jumlah>` (Contoh: `.lotre beli 5` untuk membeli 5 tiket sekaligus).\n" +
  "*   **Cek Status Pool:** Ketik `.lotre` untuk melihat total tiket terjual dan total hadiah utama saat ini.\n" +
  "*   **Waktu Pengundian:** Diundi otomatis setiap **Hari Minggu pukul 21:00 WIB**!\n" +
  "*   **Hadiah Utama:** 1 Pemenang tunggal yang beruntung akan membawa pulang **85% dari total seluruh koin pool tiket** yang terkumpul!\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
  "💡 *Tips Server:*\n" +
  "Membeli lebih banyak tiket lotre akan memperbesar peluang menangmu! Yuk, pasang taruhan slotmu sekarang dan borong tiket lotrenya sebelum hari Minggu tiba! 🚀🎲";

client.once('ready', async () => {
  console.log(`🤖 Login berhasil sebagai ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) {
      console.error('❌ Channel tidak ditemukan.');
      process.exit(1);
    }

    console.log(`📢 Mengirim pengumuman ke #${channel.name}...`);

    const embed = new EmbedBuilder()
      .setColor('#FF9800') // Orange color for casino/gambling vibe
      .setTitle('🎰 BANJIR JACKPOT: FITUR SLOT MACHINE & LOTRE MINGGUAN KOSAN 1A TELAH AKTIF! 🎟️✨')
      .setDescription(DESCRIPTION)
      .setTimestamp()
      .setFooter({ text: 'Sentinel Bot • System Updates' });

    await channel.send({ content: '@everyone', embeds: [embed] });

    console.log('✅ Pengumuman berhasil terkirim!');
    process.exit(0);

  } catch (err) {
    console.error('❌ Gagal mengirim pengumuman:', err);
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN).catch(e => {
  console.error("Login gagal:", e.message);
  process.exit(1);
});
