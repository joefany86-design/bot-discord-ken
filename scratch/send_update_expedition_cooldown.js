require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

const CHANNEL_ID = '1510920596127481988';

const DESCRIPTION =
  "Halo @everyone! 🎉✨\n\n" +
  "Bot kembali hadir dengan sejumlah pembaruan penting! Yuk simak apa saja yang baru: 🐾⚔️\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "💀 **RISIKO KEMATIAN 3% DI EKSPEDISI PET**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
  "Mulai sekarang, setiap pet yang ikut ekspedisi `.pet expedition` punya **3% peluang** untuk mengalami kecelakaan fatal dan **meninggal dunia**! 🪦\n\n" +
  "*   Jika petmu mati, statusnya berubah menjadi `DEAD` dan harus dihidupkan kembali melalui **🏥 Dokter Pet** (`.pet dokter` / `.pet revive`).\n" +
  "*   **Jaring Pengaman yang Bisa Kamu Pakai:**\n" +
  "    *   🛡️ `LUCKY_AMULET` (Jimat Keberuntungan) → Jimat hancur, pet selamat dengan 20 HP! Beli di `.pet aksesoris`.\n" +
  "    *   ❤️ Trait `SURVIVOR` → Pet bertahan hidup di 1 HP (status Lemas/WEAK), tidak langsung mati!\n" +
  "*   🐲 Pet dewa **\"Ramzi\"** kebal dan tidak bisa mati dari ekspedisi.\n\n" +
  "Mulai persiapkan petmu dengan lebih matang sebelum berangkat ekspedisi! ⚔️🐾\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "⏱️ **COOLDOWN EKSPEDISI DIPERPENDEK: 30 MENIT**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
  "Cooldown setelah 6x bermain ekspedisi kini diperpendek dari **4 jam → 30 menit** saja! 🎮\n\n" +
  "Petualangan bisa lebih sering dan seru! 🔥\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "🏠 **PERBAIKAN PANEL KOSAN**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
  "*   Panel `.kos` kini menampilkan daftar fasilitas kamar dengan benar meski kamu punya banyak upgrade sekaligus.\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
  "💡 *Semua pembaruan sudah aktif sekarang!* Selamat bertualang bersama petmu! 🐾🚀";

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
      .setColor('#7C3AED')
      .setTitle('📢 SENTINEL UPDATE: EKSPEDISI MEMATIKAN, COOLDOWN LEBIH SINGKAT & PERBAIKAN KOSAN! ⚔️🐾')
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
