require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

// ID Saluran Pengumuman yang diminta user
const GAME_ANNOUNCEMENTS_CHANNEL_ID = '1510920596127481988';

const ANNOUNCEMENT_DESCRIPTION = "Halo @everyone! 👋✨\n\n" +
  "Pembaruan besar untuk **Sistem Pet** dan **Mekanisme Sinks Ekonomi** telah aktif sepenuhnya! Sekarang pet kalian memiliki lebih banyak aktivitas, peralatan tempur (aksesoris), dan interaksi yang lebih seru serta menantang. 🎉🦖\n\n" +
  "Berikut adalah rincian lengkap dari pembaruan yang telah dirilis:\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "🥤 **1. SODA ENERGI PET (ENERGY DRINK)**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "*Punya banyak energi tapi kehabisan waktu?*\n" +
  "*   **Fungsi**: Memulihkan cooldown aktivitas `.pet kerja` (work) dan `.pet berburu` (hunt) secara **instan**!\n" +
  "*   **Harga**: Rp 200 per botol (bisa auto-buy langsung saat minum jika koin cukup).\n" +
  "*   **⚠️ Bahaya Overdosis (Sakit)**:\n" +
  "    *   Batas aman konsumsi adalah **2 botol per hari** (mengikuti zona waktu WIB).\n" +
  "    *   Mengonsumsi botol ke-3 dan seterusnya dalam hari yang sama memiliki peluang **35%** membuat pet Anda jatuh **SAKIT** (`SICK`) dan HP-nya drop menjadi **5 HP**.\n" +
  "    *   Pet yang sakit **tidak bisa beraktivitas** (kerja, berburu, gym, dll.) sampai disembuhkan dengan **Obat Pet** (`MEDICINE`) seharga Rp 500 di toko pet.\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "🏋️ **2. PUSAT LATIHAN PET / GYM (.pet latih)**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "*Ingin pet Anda naik level lebih cepat? Bawa mereka ke Gym!*\n" +
  "*   **Perintah**: `.pet latih` / `.pet train`\n" +
  "*   **Biaya**: Rp 150 koin.\n" +
  "*   **Efek**: Memberikan **+100 base XP** (dikalikan pengali XP pet), tetapi mengurangi kenyangan (`hunger`) & hidrasi (`thirst`) sebesar **-30**.\n" +
  "*   **Syarat**: Pet harus sehat (HP ≥ 40) serta kenyangan & hidrasi tidak kurang dari 30.\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "🏥 **3. DOKTER PET & KEBANGKITAN (.pet dokter)**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "*Jangan biarkan pet kesayangan Anda terkubur selamanya!*\n" +
  "*   **Fungsi**: Menghidupkan kembali pet yang telah **MATI** (`DEAD`).\n" +
  "*   **Biaya**: Dinamis berdasarkan tingkat level pet, yaitu **Rp 500 × Level Pet**.\n" +
  "*   **Efek**: Mengembalikan status pet menjadi hidup (`BABY`/`ADULT`), memulihkan HP ke 50%, serta tingkat kenyangan, hidrasi, dan kebahagiaan ke 50%.\n" +
  "*   **Akses**: Cukup ketik `.pet dokter` / `.pet revive`, atau klik tombol **🏥 Dokter Pet** yang ada di dashboard pet Anda yang mati!\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "🪮 **4. TOKO AKSESORIS PET (EQUIPMENT)**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "Kini Anda bisa mendandani pet dengan aksesoris khusus yang memberikan status tambahan! Beli langsung di toko pet dan pet akan otomatis memakainya (membeli aksesoris baru akan menimpa aksesoris lama):\n" +
  "1.  **🪮 Kalung Besi (`COLLAR_IRON`)** — **Rp 1.500**\n" +
  "    *   *Efek*: Mengurangi tingkat penurunan statistik pet (decay rate) sebesar **15%**. Pet tidak cepat lapar dan haus!\n" +
  "2.  **⚔️ Pedang Mainan (`SWORD_TOY`)** — **Rp 1.200**\n" +
  "    *   *Efek*: Memberikan tambahan damage sebesar **+15%** saat melakukan PvP Pet (`.pet pvp`).\n" +
  "3.  **🛡️ Perisai Mainan (`SHIELD_TOY`)** — **Rp 1.200**\n" +
  "    *   *Efek*: Mengurangi damage yang diterima sebesar **15%** saat diserang musuh di PvP Pet.\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "🧼 **5. SABUN MANDI PET BERBAYAR (SOAP)**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "*Mulai hari ini, memandikan pet tidak lagi gratis!*\n" +
  "*   **Harga Sabun**: Rp 100 per buah.\n" +
  "*   **Mekanisme**: Perintah `.pet mandiin` kini memerlukan **1x Sabun Mandi Pet** (`SOAP_PET`). Jika habis, bot akan mencoba menggunakan item **Sabun** (`SOAP`) dari Black Market di tas Anda. Jika tidak punya keduanya, pet Anda tidak bisa dimandikan!\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
  "💡 *TIPS*: Ketik `.pet toko` atau `.pet shop` untuk melihat daftar barang baru, dan ketik `.pet` untuk melihat status serta aksesoris yang sedang digunakan oleh pet Anda saat ini!\n\n" +
  "Selamat melatih pet kesayanganmu dan jadilah juara di PvP Arena! 🏆🐾";

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
      .setColor('#00b0ff') // Beautiful Light Blue Color
      .setTitle('📢 UPDATE SENTINEL: OVERHAUL SISTEM PET & SINKS EKONOMI BARU! 🦖🥤🏥')
      .setDescription(ANNOUNCEMENT_DESCRIPTION)
      .setTimestamp()
      .setFooter({ text: 'Sentinel Bot • System Updates' });

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
