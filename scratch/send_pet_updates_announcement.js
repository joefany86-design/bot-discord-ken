require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

// ID Saluran Pengumuman Game yang diminta user
const GAME_ANNOUNCEMENTS_CHANNEL_ID = '1509770711839805641';

const ANNOUNCEMENT_DESCRIPTION = "Halo @everyone! 👋✨\n\n" +
  "Sistem Peliharaan (Pet System) di Kosan 1A kini telah disesuaikan secara penuh agar semakin seimbang, seru, dan memberikan keuntungan optimal bagi para pelatih pet! 🥂🐾\n\n" +
  "Berikut adalah rincian lengkap dari penyesuaian yang telah **AKTIF SEPENUHNYA** di dalam game:\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "📈 **1. PENYESUAIAN XP & LEVEL UP PET**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
  "Batas XP untuk naik level kini disesuaikan secara dinamis agar progress bermain terasa lebih adil dan menantang!\n" +
  "*   **XP Target per Level:** `Level * 100` (Level 1 butuh 100 XP, Level 2 butuh 200 XP, dst).\n" +
  "*   🧠 **Keunggulan Trait GENIUS:** Pet dengan trait Genius mendapatkan pemotongan XP target sebesar **-15%** (hanya butuh `Level * 85`).\n" +
  "*   🍼 **Beri Makan/Minum/Obat:** `+10 XP` per perawatan.\n" +
  "*   ⚽ **Ajak Bermain (.pet play):** `+15 XP` (Bisa dilakukan gratis setiap 15 menit).\n" +
  "*   💼 **Bekerja (.pet work):** `+30 XP` per sesi kerja.\n" +
  "*   🏹 **Berburu (.pet hunt):** `+60 XP` per sesi berburu (Pet dewasa Level >= 10).\n" +
  "*   ⚔️ **PvP Arena:** `+50 XP` jika menang, `+20 XP` jika kalah.\n" +
  "*   🛡️ **Ekspedisi Tim:** `+50 XP` jika berhasil, `+15 XP` jika gagal.\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "💸 **2. PENYESUAIAN PENDAPATAN PET (INCOME)**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
  "Gaji dan hasil jarahan berburu pet kini ditingkatkan berdasarkan level dan sifat pet mereka!\n" +
  "*   💼 **Upah Bekerja (.pet work):**\n" +
  "    *   **Gaji Pokok:** **Rp 150 s/d Rp 400** acak.\n" +
  "    *   **Bonus Level:** `+5%` dari gaji pokok per level pet (Makin tinggi level, makin kaya!).\n" +
  "    *   🧬 **Bonus Trait MUTANT:** Tambahan hasil kerja sebesar **+10%**!\n" +
  "*   🏹 **Hasil Berburu (.pet hunt):**\n" +
  "    *   **Gaji Pokok:** **Rp 300 s/d Rp 800** acak.\n" +
  "    *   🐱 **Bonus Tipe KUCING (CAT):** Mendapat tambahan **+15%** dari hasil berburu pokok.\n" +
  "    *   **Bonus Level:** `+5%` dari hasil pokok per level pet.\n" +
  "    *   🧬 **Bonus Trait MUTANT:** Tambahan hasil berburu sebesar **+10%**!\n" +
  "    *   🎁 **Hadiah Drop Langka:** Peluang 5% (10% untuk Kucing) mendapatkan item rawat gratis (`🥩 Daging Premium`, `💊 Ramuan Kesehatan`, atau `⚽ Bola Karet`).\n" +
  "*   ⚔️ **PvP Arena (.pet pvp):**\n" +
  "    *   **Taruhan:** Sesuai kesepakatan penantang (diambil dari dompet kedua pemain).\n" +
  "    *   **Hadiah Pemenang:** Mendapatkan total taruhan (2x taruhan) dikurangi **pajak arena 5%** (selisih bersih ditambahkan ke pemenang).\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "🛡️ **3. CENTRAL PVE: EKSPEDISI TIM PET (CO-OP)**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
  "Kumpulkan hingga 4 pet dari warga yang berbeda untuk menaklukkan bos wilayah angker dan rebut tumpukan koin!\n" +
  "*   **Biaya Masuk:** **Rp 150 koin** (sebagai modal ransum, dikembalikan penuh jika lobi batal).\n" +
  "*   **Tiga Zona Ekspedisi Dinamis** (menyesuaikan jumlah kru):\n" +
  "    1.  **1 Pet:** `🌫️ Hutan Kabut (Foggy Woods)` (Kesulitan: 15 | Hadiah: **Rp 300 - Rp 600**)\n" +
  "    2.  **2 Pet:** `🌋 Goa Naga Api (Volcano Dragon Nest)` (Kesulitan: 40 | Hadiah: **Rp 800 - Rp 1.400**)\n" +
  "    3.  **3-4 Pet:** `🏰 Labirin Kuno Purba (Ancient Labyrinth)` (Kesulitan: 70 | Hadiah: **Rp 1.800 - Rp 3.000**)\n" +
  "*   📈 **Formula Peluang Sukses:** `(Total Level Tim / Kesulitan) * 100%` (Peluang berkisar antara 25% s/d 90%).\n" +
  "*   🏆 **Hadiah Sukses:** Koin jarahan dibagi rata + `+50 XP` + **20% peluang dapat item premium/kriminal Black Market gratis** (`🍗 Pakan Biasa`, `⚽ Bola Karet`, `💊 Ramuan Kesehatan`, `🗝️ Linggis BM`, atau `🧼 Sabun BM`).\n" +
  "*   🩸 **Dampak Gagal:** Uang Rp 0, pet cedera (HP -30, Kebahagiaan -25, Kenyangan -15, Hidrasi -15), namun tetap membawa pulang `+15 XP` pengalaman tempur.\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
  "*Ayo rawat pet kesayanganmu, ajak bermain, dan kumpulkan tim untuk berpetualang di `.pet expedition` sekarang juga! Selamat melatih dan berburu! 🦖🔥✨*";

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
      .setColor('#4db6ac') // Beautiful Mint/Teal Color
      .setTitle('📢 UPDATE SENTINEL: PENYESUAIAN XP, PENDAPATAN, & EKSPEDISI PET! 🦖💼🛡️')
      .setDescription(ANNOUNCEMENT_DESCRIPTION)
      .setTimestamp()
      .setFooter({ text: 'Sentinel Bot • Server Kosan 1A' });

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
