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
  "Sentinel Bot kembali membawa **UPDATE & OPTIMALISASI** terbaru untuk sistem Pet kesayangan Anda! Penyesuaian ini dirancang untuk membuat petualangan ekspedisi terasa lebih fleksibel dan menghadirkan ajang kompetisi antar pelatih pet terbaik di server! ✨🚀\n\n" +
  "Berikut rincian update terbaru yang **TELAH AKTIF SEKARANG**:\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "🛡️ **1. EKSPEDISI CO-OP: TANPA BATAS KRU & COOLDOWN DIPOTONG!**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "*   👥 **Tanpa Batas Kru:** Batasan jumlah kru dalam satu tim lobi ekspedisi resmi dihapus! Sekarang seluruh warga bisa mengirim pet mereka bersama-sama untuk menyerbu bos zona tanpa batas slot!\n" +
  "*   ⏱️ **Pangkas Cooldown (3 Jam):** Batasan bermain ekspedisi disetel maksimal **10 kali**. Setelah 10 kali bermain, cooldown yang sebelumnya 5 jam kini **dipangkas menjadi 3 jam saja!** Setelah 3 jam terlewati, kuota bermain otomatis ter-reset kembali ke 0.\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "🏆 **2. SISTEM LEADERBOARD PET BARU (`.pet top`)**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "Tunjukkan pet terkuat Anda di papan peringkat termewah dengan 3 kategori kompetisi:\n" +
  "*   🐾 **Kategori Level:** Peringkat pet dengan level tertinggi di server.\n" +
  "*   ⚔️ **Kategori PvP Wins:** Gladiator pet tersohor yang memiliki jumlah kemenangan duel terbanyak.\n" +
  "*   💪 **Kategori CP (Combat Power):** Nilai akumulasi kekuatan tempur berdasarkan level dan total seluruh indikator kebutuhan pet (HP + Kebahagiaan + Kenyangan + Hidrasi).\n" +
  "*   👉 *Gunakan perintah `/pet top` atau `.pet top` untuk melihat peringkat saat ini!*\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
  "*Ayo bersatu dalam `.pet expedition` tanpa batas kru, tingkatkan level pet Anda, dan jadilah Pelatih Pet nomor satu di server! Selamat melatih dan bermain! 🦖🔥🐾🛡️*";

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
      .setColor('#E91E63') // Pinkish Vibrant Color
      .setTitle('📢 NEW UPDATE: EKSPEDISI CO-OP & LEADERBOARD PET AKTIF! 🦖🏆🛡️')
      .setDescription(ANNOUNCEMENT_DESCRIPTION)
      .setThumbnail('https://cdn-icons-png.flaticon.com/512/616/616408.png')
      .setTimestamp()
      .setFooter({ text: 'Sentinel Tamagotchi System • Kosan 1A' });

    await channel.send({ content: '@everyone', embeds: [embed] });
    
    console.log('✅ Embed pengumuman game v3 berhasil dikirim!');
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
