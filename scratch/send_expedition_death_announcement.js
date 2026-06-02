require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

const CHANNEL_ID = '1510920596127481988';

const DESCRIPTION =
  "Halo @everyone! 🎉\n\n" +
  "Berikut adalah informasi penting mengenai sistem risiko keselamatan hewan peliharaan (pet) Anda saat dikirim untuk melakukan ekspedisi (Co-op PVE):\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "💀 **RISIKO KEMATIAN PET (3% BASE CHANCE)**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "Setiap kali pet dikirim dalam ekspedisi (baik hasilnya **SUKSES** maupun **GAGAL**), ada peluang dasar sebesar **3%** bagi pet Anda untuk mengalami kecelakaan fatal dan **MENINGGAL DUNIA** (Status: `DEAD`).\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "🎰 **PENGARUH TIER GACHA ROLE ANDA**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "Keberuntungan dan kelangsungan hidup pet Anda sangat dipengaruhi oleh Tier Gacha Role tertinggi yang Anda miliki saat ini:\n" +
  "*   **Tier Standar / Bawah:** Peluang kematian tetap **3%**.\n" +
  "*   **Tier LEGENDARY:** Peluang kematian terpangkas menjadi hanya **1%**.\n" +
  "*   **Tier MYTHIC:** Peluang kematian adalah **0%** (Pet Anda kebal sepenuhnya dari kematian saat ekspedisi!).\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "🛡️ **CARA MENCEGAH KEMATIAN PET**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "Bagi Anda yang belum memiliki role gacha Mythic, ada dua cara efektif untuk menjaga pet Anda tetap aman:\n\n" +
  "1.  🛡️ **Jimat Keberuntungan (LUCKY_AMULET):**\n" +
  "    Jika pet Anda menggunakan aksesori Lucky Amulet, ketika pet tertimpa nasib buruk (mati), jimat tersebut akan hancur/hilang, tetapi pet Anda selamat dan sisa HP disetel ke **20**.\n" +
  "2.  🩹 **Trait SURVIVOR:**\n" +
  "    Pet yang memiliki sifat Survivor akan kebal dari kematian instan saat ekspedisi dan bertahan hidup dengan sisa **1 HP** (mengalami status lemas/`WEAK`).\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
  "🏥 Jika pet Anda mengalami nasib buruk dan meninggal dunia, Anda bisa menghidupkannya kembali dengan berkunjung ke dokter hewan menggunakan perintah:\n" +
  "👉 **`.pet dokter`** (memerlukan biaya koin pengobatan).\n\n" +
  "Jagalah keselamatan pet Anda dan selamat berpetualang! 🌲🎒";

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
      .setColor('#EF4444')
      .setTitle('📢 SENTINEL UPDATE: SISTEM RISIKO KEMATIAN PET SAAT EKSPEDISI 🐾💀')
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
