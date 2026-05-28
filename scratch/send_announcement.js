require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

// ID Konfigurasi Kosan 1A
const ANNOUNCEMENTS_CHANNEL_ID = '1478566460124041428'; // #📢┃announcements

const ANNOUNCEMENT_DESCRIPTION = "Halo @everyone! Kami baru saja melakukan pembaruan dan penataan ulang sistem perizinan peran (*roles permission*) serta akses saluran (*channels*) secara otomatis demi kenyamanan, ketertiban, dan keaktifan bersama di server **Kosan 1A**!\n\n" +
"Berikut adalah rincian hak akses saluran berdasarkan Kasta Prestige (Rarity Role) & Peran Khusus Anda:\n\n" +
"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
"🎭 **SISTEM HAK AKSES TINGKATAN KASTA (PRESTIGE SYSTEM)**\n" +
"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
"📝 **[ HAK AKSES SALURAN TEKS ]**\n" +
"*   **Warga Biasa (@everyone):** Hak akses chat dasar (tidak dapat mengirim link, mengunggah file/media, menggunakan emoji/stiker eksternal, atau membuat thread demi menjaga kebersihan chat dari spam).\n" +
"*   **🥈 Rare Elite (ke atas):** Diizinkan membagikan tautan/link, mengunggah gambar/file media, dan menggunakan emoji eksternal.\n" +
"*   **🥇 Epic Champion (ke atas):** Diizinkan menggunakan stiker eksternal dan membuat thread obrolan baru.\n" +
"*   **👑 The Sovereign:** Pemegang kasta tertinggi teks (diizinkan membantu moderasi dengan menghapus pesan yang melanggar aturan).\n\n" +
"🔊 **[ HAK AKSES SALURAN SUARA / VOICE ]**\n" +
"*   **Warga Biasa (@everyone):** Saluran suara umum dikunci demi kenyamanan obrolan aktif.\n" +
"*   **🔮 Primordial (ke atas):** Hak dasar untuk masuk (*Connect*) & berbicara (*Speak*) di seluruh voice channel umum.\n" +
"*   **👑 Legendary Overlord (ke atas):** Terbuka hak suara premium seperti *Priority Speaker* (suara lebih diutamakan) & penggunaan *Soundboard* / suara eksternal.\n" +
"*   **🌟 Zenith:** Diizinkan memindahkan anggota (*Move Members*).\n" +
"*   **🌟 Mythic Immortal:** Diizinkan membisukan anggota (*Mute Members*).\n" +
"*   **✨ Aethelgard:** Diizinkan menulikan anggota (*Deafen Members*).\n" +
"*   **👑 The Sovereign:** Kontrol moderasi suara penuh di seluruh saluran suara.\n\n" +
"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
"🍷 **SALURAN PRESTISE KHUSUS (SPECIAL ZONE)**\n" +
"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
"Kami juga membagi beberapa zona saluran eksklusif untuk peran-peran tertentu:\n\n" +
"1.  **🍷 Kategori [ #🍷 FACILITIES ] (Rooftop, Music, Playlist Sultan)**\n" +
"    *   *Hanya dapat diakses oleh:* **`the baddies`**, **`the bros`**, serta jajaran Staff & Admin.\n" +
"    \n" +
"2.  **🎮 Saluran Nongkrong & Gaming**\n" +
"    *   Saluran **`#🍿┃ chill-room`**, **`#🎮┃ games-room`**, **`#📱┃ mole`**, **`#🖥️┃ PC-games`**, dan **`#➕ Creator Channel`** (untuk membuat TempVoice Anda sendiri) telah **DIBUKA** untuk bisa diakses langsung oleh kasta **`the baddies`** dan **`the bros`**!\n\n" +
"3.  **🔒 Kategori [ #🔒 STAFF ONLY ] (Admin Baik, Log Channel, Dontol, Test)**\n" +
"    *   Sangat privat dan **hanya bisa diakses** oleh jajaran Admin/Staff (*Sovereign*, *Koordinator Kos*, *Teknisi*) serta peran khusus **`🥢🍜‧₊Cio Sobat Indomie`**.\n\n" +
"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
"💡 *Catatan: Bagi Anda yang belum mendapatkan tingkatan kasta di atas, silakan tingkatkan keaktifan Anda atau lakukan verifikasi untuk mendapatkan peran yang sesuai!*\n\n" +
"Selamat berkumpul dan selamat menikmati fitur-fitur baru server Kosan 1A! 🥂✨";

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
      .setColor('#f1c40f') // Gold/Yellow Premium Color
      .setTitle('📢 PEMBARUAN SISTEM HAK AKSES & PERAN SERVER KOSAN 1A')
      .setDescription(ANNOUNCEMENT_DESCRIPTION)
      .setTimestamp()
      .setFooter({ text: 'Sentinel Bot • Server Kosan 1A' });

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
