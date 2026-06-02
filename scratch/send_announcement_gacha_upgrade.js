require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

// ID Saluran Pengumuman game
const GAME_ANNOUNCEMENTS_CHANNEL_ID = '1510920596127481988';

const ANNOUNCEMENT_DESCRIPTION = "Halo @everyone! 👋✨\n\n" +
  "Kabar gembira bagi para pelatih monster! Hari ini kami resmi merilis pembaruan besar **Sistem Gacha Pet & Evolusi Bintang** yang paling ditunggu-tunggu! Sekarang Anda bisa berburu monster langka legendaris, menaikkan tingkat bintang mereka, dan mendominasi PvP Arena! 🦖⚔️💎\n\n" +
  "Berikut adalah detail lengkap dari pembaruan pet saat ini:\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "🎰 **1. SISTEM GACHA PET (`.pet gacha` atau via `.hub`)**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "Dapatkan monster impian Anda secara instan dalam wujud Dewasa (**ADULT**) tanpa perlu mengerami telur!\n" +
  "*   💵 **Harga Gacha**: **Rp 1.000** (1x Pull) | **Rp 10.000** (10x Pull sekaligus!)\n" +
  "*   🎫 **Tiket Gacha (`TICKET_GACHA`)**: Gunakan 1 tiket untuk 1 pull gratis.\n" +
  "*   💾 **Sistem Konfirmasi**: Anda bisa memilih untuk menyimpan pet hasil gacha ke kandang Anda atau langsung mendaur ulang (**Recycle**) pet tersebut untuk mendapatkan ganti rugi **Rp 1.000 / pet**!\n" +
  "*   ❌ **Bebas Batasan**: Tidak ada lagi batasan maksimal 3 pet! Rawat dan koleksi peliharaan sebanyak yang Anda inginkan.\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "🌟 **2. TINGKAT RARITAS (TIER) & SPESIES BARU**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "Buka gacha dan temukan monster dengan kasta serta kekuatan unik:\n" +
  "*   ⚪ **COMMON (Rate 65%)**:\n" +
  "    *   *Cat, Golem, Slime* — Spesies standar yang bersahabat.\n" +
  "*   🟢 **RARE (Rate 25%)**:\n" +
  "    *   *Cat, Golem, Slime, Dragon* — Dragon memiliki bonus serangan bawaan **+15% ATK**!\n" +
  "*   🟣 **EPIC (Rate 8%)** (Memiliki Base HP & DMG lebih tinggi + Tipe Elemen):\n" +
  "    *   *Phoenix* (Elemen Api, **+20% ATK**)\n" +
  "    *   *Turtle* (Elemen Bumi, **120 Base HP & +20% DEF**)\n" +
  "*   🟡 **LEGENDARY (Rate 2%)** (Monster Terkuat: **150 Base HP, 25 Base ATK, 10 Base DEF, +25% bonus pendapatan kerja/hunt, & 2 Trait Acak**):\n" +
  "    *   *Leviathan* (Elemen Air)\n" +
  "    *   *Behemoth* (Elemen Bumi)\n" +
  "    *   *Archdragon* (Elemen Naga Purba)\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "✨ **3. EVOLUSI BINTANG PET (`.pet upgrade`)**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "Tingkatkan pet utama Anda dari **Bintang 1 hingga Bintang 5** untuk memperkuat status tempur mereka secara permanen!\n" +
  "*   🧬 **Mekanik**: Korbankan pet duplikat berspesies sama sebagai tumbal + biaya koin:\n" +
  "    *   ⭐1 ➔ ⭐2: 1x tumbal (min ⭐1) + Rp 2.500\n" +
  "    *   ⭐2 ➔ ⭐3: 1x tumbal (min ⭐2) + Rp 5.000\n" +
  "    *   ⭐3 ➔ ⭐4: 2x tumbal (min ⭐2) + Rp 10.000\n" +
  "    *   ⭐4 ➔ ⭐5: 2x tumbal (min ⭐3) + Rp 20.000\n" +
  "*   💪 **Bonus Status Permanen per Bintang**:\n" +
  "    *   ❤️ **Max HP**: **+15 HP** per tingkat bintang.\n" +
  "    *   ⚔️ **ATK**: **+25% ATK** per tingkat bintang.\n" +
  "    *   🛡️ **DEF**: **+5% reduksi damage** per tingkat bintang.\n" +
  "    *   ⏱️ **Cooldown**: **-10% Cooldown** (kerja, hunt, play) per tingkat bintang.\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "⚔️ **4. STATISTIK TEMPUR PVP ARENA BERFUNGSI SEPENUHNYA!**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "*   Kini statistik ATK dan DEF dari spesies pet (seperti def tebal kura-kura) dan pengali bintang evolusi (ATK +25% / DEF +5% per bintang) **berfungsi sepenuhnya** di dalam PvP Arena! Upgrade dan kasta pet Anda sekarang sangat memengaruhi peluang menang Anda!\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
  "🚪 *AKSES INSTAN*: Cukup ketik `.hub` dan tekan tombol **🎰 Gacha Pet** atau **✨ Upgrade Bintang Pet**, atau ketik `.pet` untuk melihat detail kandang pet Anda!\n\n" +
  "Semoga beruntung dalam tarikan gacha pertamamu dan ciptakan monster Bintang 5 terkuat! 🍀🦖✨";

client.once('ready', async () => {
  console.log(`🤖 Login berhasil sebagai ${client.user.tag}`);
  
  try {
    const channel = await client.channels.fetch(GAME_ANNOUNCEMENTS_CHANNEL_ID);
    if (!channel) {
      console.error('❌ Saluran pengumuman game tidak ditemukan.');
      process.exit(1);
    }

    console.log(`📢 Membuat dan mengirim embed pengumuman ke saluran: #${channel.name}...`);
    
    const embed = new EmbedBuilder()
      .setColor('#ff9800') // Harmonious Orange Gold Color
      .setTitle('📢 UPDATE SENTINEL: SYSTEM GACHA PET & EVOLUSI BINTANG TELAH HADIR! 🎰✨⚔️')
      .setDescription(ANNOUNCEMENT_DESCRIPTION)
      .setTimestamp()
      .setFooter({ text: 'Sentinel Bot • Pet Gacha & Upgrade Evolution' });

    await channel.send({ content: '@everyone', embeds: [embed] });
    
    console.log('✅ Embed pengumuman game berhasil terkirim!');
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
