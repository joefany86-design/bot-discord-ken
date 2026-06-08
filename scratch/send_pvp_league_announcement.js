require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

const TARGET_CHANNEL_ID = '1510920596127481988';

const embed = new EmbedBuilder()
  .setColor(0xD97706) // Rich Premium Amber/Gold Color
  .setTitle('🏆 LIGA PvP ADMIN CUP — PANDUAN STRATEGIS MENDALAM 🏆')
  .setDescription(
    `📢 **Halo @everyone!** 👋🐾⚔️\n\n` +
    `Liga PvP Admin Cup kini resmi menggunakan sistem pertempuran **Turn-Based Interaktif** baru! Untuk mempersiapkan pet Anda bertarung di arena, berikut adalah panduan strategi lengkap untuk latihan di Gym dan taktik pertarungan:\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
  )
  .addFields(
    {
      name: '📋 1. REGULASI DASAR LIGA',
      value:
        `> ⚔️ **Sistem Duel:** Turn-based interaktif via thread otomatis di channel turnamen.\n` +
        `> ⏱️ **Turn Timeout:** Batas waktu aksi adalah **45 detik**. AFK 2x berturut-turut = Kalah Otomatis (**Forfeit**).\n` +
        `> 🩹 **Aman & Bebas Resiko:** HP/Kebahagiaan dipulihkan **100% setelah tanding** (tidak ada resiko cedera/mati permanen).\n` +
        `> 🎫 **Syarat:** Pet Dewasa (**ADULT** / Level $\ge$ 10) dengan HP minimal **50%** saat mendaftar.\n` +
        `> 📝 **Command:** Ketik **\`.pet cup register [nama_pet]\`** untuk mendaftarkan pet Anda.`
    },
    {
      name: '🏋️ 2. FORMULA GYM & STAT TEMPUR (.pet gym)',
      value:
        `> 💪 **STR (Strength):** \`+2 Base ATK\` per poin STR. (Meningkatkan damage serangan).\n` +
        `> ❤️ **VIT (Vitality):** \`+3 Max HP\` per poin VIT. (Meningkatkan darah maksimal pet).\n` +
        `> 🛡️ **DEF (Defense):** \`+0.5% Reduksi Damage\` per poin DEF. Capped di **50%** (pada 100 DEF).\n` +
        `> ⚡ **DEX (Dexterity) [Krusial!]:**\n` +
        `> • *Crit Rate:* \`+0.5%\` per poin (Capped di **35%** pada 70 DEX).\n` +
        `> • *Dodge Chance:* \`+0.5%\` per poin (Capped di **35%** pada 70 DEX).\n` +
        `> • *Turn Order:* DEX tertinggi menyerang duluan. Jika serangan Anda membunuh musuh, mereka tidak sempat membalas!`
    },
    {
      name: '⚙️ 3. REKOMENDASI BUILD GYM',
      value:
        `> ⚡ **Speed Blitz (DEX 70 + STR):** Mengamankan giliran pertama, memaksimalkan peluang Crit & Dodge untuk melumpuhkan musuh seketika.\n` +
        `> 🧱 **Iron Wall Tank (DEF 100 + VIT & STR):** Mengandalkan reduksi damage maksimal (50%) + HP tebal untuk menahan gempuran dan membalas saat musuh kelelahan.\n` +
        `> ⚖️ **Balanced Duelist (DEX 50 + STR/VIT):** Menyeimbangkan kecepatan, daya tahan HP, dan daya serang secara merata.`
    },
    {
      name: '🪮 4. STATUS AKSESORIS PET (PENTING)',
      value:
        `> ⚠️ **Catatan:** Engine turn-based liga Admin Cup **tidak membaca data aksesoris** (\`SWORD_TOY\`, \`SHIELD_TOY\`). Aksesoris hanya aktif di PvP Arena biasa (\`.pet pvp\`).\n` +
        `> *Anda tidak perlu membeli aksesoris khusus untuk berpartisipasi dalam turnamen ini.*`
    },
    {
      name: '🎮 5. TAKTIK DUEL (TOMBOL AKSI)',
      value:
        `> 🗡️ **Serang:** Damage dasar, 100% akurasi (bisa Crit/dodge). Pilihan paling aman & stabil.\n` +
        `> 🔥 **Ultimate:** Damage dahsyat (**2x ATK**), tetapi memiliki **30% miss chance bawaan** (peluang meleset sendiri). Bagus untuk serangan penentu.\n` +
        `> 🛡️ **Bertahan:** Memotong damage masuk sebesar **50%** di turn tersebut dan menambah **+20% Dodge Chance** (total hingga 55% jika DEX maks). Sangat ampuh untuk memprediksi serangan Ultimate musuh!`
    }
  )
  .setFooter({ text: 'Latih pet Anda di .pet gym sebelum mendaftar! • Sentinel Bot PvP League' })
  .setTimestamp();

client.once('ready', async () => {
  console.log(`🤖 Login berhasil sebagai ${client.user.tag}`);
  
  try {
    const channel = await client.channels.fetch(TARGET_CHANNEL_ID);
    if (!channel) {
      console.error('❌ Saluran pengumuman game tidak ditemukan.');
      process.exit(1);
    }

    console.log(`📢 Mengirim embed pengumuman ke saluran: #${channel.name}...`);
    
    await channel.send({ content: '@everyone', embeds: [embed] });
    
    console.log('✅ Embed pengumuman berhasil dikirim!');
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
