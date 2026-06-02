require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

const CHANNEL_ID = '1510920596127481988';

const DESCRIPTION =
  "Halo Pecinta Pet Kosan 1A! 🐾✨\n" +
  "Peliharaanmu sering pingsan, sakit, atau kamu bingung cara tercepat menaikkan levelnya agar bisa breeding? Yuk pelajari panduan merawat & melatih pet berikut ini! 🦖🍗\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "🥚 **1. ADOPSI & MENETASKAN TELUR**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "*   **Adopsi Pertama:** Ketik `.pet buy <nama> <slime/dragon/cat/golem>` seharga **Rp 1.500**.\n" +
  "*   **Spesies Pilihan:**\n" +
  "    *   🟢 **Slime:** Laju penurunan stats lapar & haus **25% lebih lambat** (sangat irit pakan) & Max HP 120 (Normal 100).\n" +
  "    *   🔥 **Dragon:** Bonus serangan **+15% DMG** di PvP Arena.\n" +
  "    *   🐱 **Cat:** Peluang mendapatkan item langka saat berburu (`.pet hunt`) meningkat **+5%**.\n" +
  "    *   🧱 **Golem:** Cooldown kerja pet (`.pet work`) berkurang **-20 Menit**.\n" +
  "*   **Masa Menetas:** Telur membutuhkan waktu sebelum menetas. Pantau sisa waktu menetas menggunakan perintah `.pet`.\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "📊 **2. MANAJEMEN STATUS & KEBUTUHAN**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "*   **Status Utama:** Cek tingkat Kenyangan (Hunger), Hidrasi (Thirst), HP, dan Kebahagiaan (Happiness) secara berkala.\n" +
  "*   **Kelaparan & Dehidrasi:** Jika Hunger/Thirst menyentuh 0%, HP pet akan berkurang secara bertahap (Starvation) hingga mati.\n" +
  "*   **Regenerasi HP Pasif:** Jika Kebahagiaan dipertahankan **> 80%**, pet akan memulihkan **+1 HP/jam** secara pasif (selama stats lapar/haus tidak 0).\n" +
  "*   **Kematian & Dokter:** Jika HP mencapai 0, pet akan mati (`DEAD`). Hidupkan kembali dengan `.pet dokter` (atau `.pet revive`/`.pet sembuh`) dengan membayar biaya medis.\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "🛒 **3. TOKO PERLENGKAPAN & PERTAHANAN (`.pet shop`)**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "*   🍗 **Pakan Biasa (Rp 150) / Daging Premium (Rp 350):** Mengisi kenyangan pet.\n" +
  "*   🥤 **Air Bersih (Rp 100) / Bola Karet (Rp 250):** Mengisi hidrasi dan kebahagiaan.\n" +
  "*   💊 **Ramuan Kesehatan (Rp 500):** Memulihkan 50 HP & menyembuhkan status Sakit/Terluka.\n" +
  "*   🥤 **Soda Energi Pet (Rp 200):** Mereset cooldown kerja/berburu secara instan. *(Hati-hati risiko overdosis/sakit).* Pixels/Gacha perks tertentu bisa membuat pet kebal efek sakit soda!\n" +
  "*   🪮 **Kalung Besi (Rp 1.200):** Aksesoris permanen, mengurangi laju penurunan stats sebesar 15%.\n" +
  "*   🔮 **Jimat Keberuntungan (Rp 2.000):** Jimat sekali pakai. Menyelamatkan pet dari kematian fatal 1x (setelah aktif, jimat hancur).\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "⚔️ **4. AKTIVITAS, EXPEDITION & PVP ARENA**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "*   💼 **Kerja & Berburu:** Gunakan `.pet work` (tiap 1 jam) dan `.pet hunt` untuk menghasilkan koin harian stabil dan peluang item gratis.\n" +
  "*   🌲 **Ekspedisi Kelompok (`.pet expedition`):** Peta petualangan PVE bersama warga server. Menghasilkan koin melimpah (hingga Rp 2.500), namun ada **risiko kematian 3%**. *Selalu pasang LUCKY_AMULET!*\n" +
  "*   ⚔️ **Arena PvP (`.pet pvp @user <taruhan>`):** Duel pet berhadiah koin taruhan. Pet yang HP-nya habis memiliki **15% peluang terluka (`INJURED`)** pasif.\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "💕 **5. PERKAWINAN SILANG (BREEDING) & GENETIKA**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "*   **Syarat:** Dua pet dewasa (Level >= 10) aktif, biaya Rp 800 per orang dengan mengetik `.pet breed @user <nama_anak>`.\n" +
  "*   **Trait Spesial Genetik (50% Peluang Muncul):**\n" +
  "    *   🧬 **`GENIUS`:** Pengurangan kebutuhan XP naik level sebesar **20%**.\n" +
  "    *   🛡️ **`STURDY`:** Laju decay stats berkurang **40%** & damage kelaparan dipotong setengahnya.\n" +
  "    *   ⚔️ **`WARRIOR`:** Bonus serangan **+15% DMG** di PvP Arena.\n" +
  "    *   🧬 **`MUTANT`:** Menambah harga jual/taksir pet sebesar **+Rp 250 koin**.\n" +
  "    *   ❤️ **`SURVIVOR`:** Pet kebal mati kelaparan (HP tertahan di 1 HP, status menjadi Lemas/WEAK).\n\n" +
  "💡 *Rawat peliharaanmu dengan baik, lengkapi aksesoris pertahanan, dan jadilah pawang monster terkuat di Kosan 1A! Selamat bermain!* 🐾🦖🛡️";

client.once('ready', async () => {
  console.log(`🤖 Login berhasil sebagai ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) {
      console.error('❌ Channel tidak ditemukan.');
      process.exit(1);
    }

    console.log(`📢 Mengirim panduan pet ke #${channel.name}...`);

    const embed = new EmbedBuilder()
      .setColor('#FF9800') // Orange / Amber color for Pet Guide
      .setTitle('🐾 PANDUAN LENGKAP & STRATEGI TAKTIS BERMAIN PET KOSAN 1A! 🦖🍗⚔️')
      .setDescription(DESCRIPTION)
      .setTimestamp()
      .setFooter({ text: 'Sentinel Bot • Pet Guide Updates' });

    await channel.send({ embeds: [embed] });

    console.log('✅ Panduan pet berhasil terkirim!');
    process.exit(0);

  } catch (err) {
    console.error('❌ Gagal mengirim panduan pet:', err);
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN).catch(e => {
  console.error("Login gagal:", e.message);
  process.exit(1);
});
