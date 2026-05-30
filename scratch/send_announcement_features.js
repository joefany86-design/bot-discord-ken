require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

// ID Saluran Pengumuman Kosan 1A
const ANNOUNCEMENTS_CHANNEL_ID = '1478566460124041428'; // #📢┃announcements

const ANNOUNCEMENT_DESCRIPTION = "Halo @everyone! Kami kembali menghadirkan pembaruan fitur besar-besaran untuk Sentinel Bot demi menambah keseruan interaksi dan ekonomi warga di server **Kosan 1A**! 🥂✨\n\n" +
"Dua modul baru berskala besar kini telah aktif sepenuhnya:\n\n" +
"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
"🕵️‍♂️ **1. SISTEM BLACK MARKET & PERALATAN KRIMINAL**\n" +
"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
"Kini hadir **Pasar Gelap Kosan (Black Market)**! Warga dapat membeli barang-barang khusus untuk melancarkan aksi kejahatan atau menghindari jerat hukum.\n\n" +
"📌 **Gunakan perintah:** `.bm` atau `.blackmarket` (dilengkapi tombol instan)\n" +
"🎒 **Cek Tas Kriminal:** `.bm inv` atau `.bm inventory`\n\n" +
"**🛒 Peralatan Gelap yang Tersedia:**\n" +
"*   🗝️ **Linggis / Lockpick [Rp 450]:** Mencungkil pintu target! Menambah peluang sukses perampokan solo `.rob` sebesar **+15%** (Peluang patah 20% setiap digunakan).\n" +
"*   🎭 **Topeng Samaran (Mask) [Rp 600]:** Menyembunyikan identitas Anda saat berhasil merampok! Korban hanya akan mendapat notifikasi *\"Pencurian Bertopeng Misterius\"* dan pesan pemicu asli perampokan akan dihapus otomatis agar identitas Anda tetap aman! (Sekali pakai).\n" +
"*   🥩 **Daging Bius (Doped Meat) [Rp 350]:** Lempar daging untuk menidurkan anjing/Alarm/CCTV korban! Menonaktifkan otomatis seluruh sistem alarm/CCTV defensif target saat dirampok (Sekali pakai).\n" +
"*   🧼 **Sabun Licin (Slippery Soap) [Rp 500]:** Menyogok sipir penjara! Mengurangi durasi penjara virtual (solo rob maupun bank heist) sebesar **50%** secara instan saat Anda tertangkap (Sekali pakai).\n\n" +
"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
"🦖 **2. EKSPANSI PET: BREEDING (KAWIN SILANG) & TRAIT SPESIAL**\n" +
"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
"Ingin memiliki peliharaan terkuat? Sekarang pet Anda dapat melakukan kawin silang!\n\n" +
"📌 **Gunakan perintah:** `.pet breed @user <nama_telur_baru>`\n\n" +
"**🧬 Aturan & Manfaat Perjodohan:**\n" +
"*   Pet Challenger & Partner harus berstatus **ADULT** (Level >= 10) dan dalam kondisi sehat (HP/Mood >= 50).\n" +
"*   Biaya perkawinan adalah **Rp 800** per orang.\n" +
"*   Lahir telur hybrid baru yang memiliki **30% peluang** mewarisi **Trait Dewa / Sifat Spesial**:\n" +
"    *   🌟 **MUTANT:** Meningkatkan upah hasil `.pet work` & `.pet hunt` sebesar **+10%**!\n" +
"    *   🌟 **GENIUS:** Sangat pintar! Batas XP yang dibutuhkan untuk naik level dipotong sebesar **-15%**!\n" +
"    *   🌟 **STURDY:** Tubuh tangguh! Laju kelaparan/kehausan yang memotong HP dikurangi sebesar **50%**!\n" +
"    *   🌟 **WARRIOR:** Sangat agresif! Menambah kekuatan serang PvP Arena sebesar **+10% DMG**!\n" +
"*   *Cooldown kawin per pet adalah 24 jam.*\n\n" +
"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
"⚔️ **3. MULTIPLAYER PVE: TIM EKSPEDISI PET**\n" +
"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
"Kumpulkan kru pet terbaik Anda untuk berburu monster penjaga di daerah angker!\n\n" +
"📌 **Gunakan perintah:** `.pet expedition` atau `.pet pet-expedition`\n\n" +
"**🛡️ Jalannya Ekspedisi:**\n" +
"*   Membuka lobi pendaftaran selama **90 detik** (maksimal 4 pet dari user berbeda).\n" +
"*   Biaya ransum: **Rp 150** per pet.\n" +
"*   Tim akan memasuki zona dinamis berdasarkan level tim dan jumlah kru (Hutan Kabut, Goa Naga, Labirin Purba).\n" +
"*   **Sukses:** Menghasilkan koin jarahan besar dibagikan merata + **20% peluang mendapatkan item premium atau peralatan Black Market gratis**!\n" +
"*   **Gagal:** Pet menderita luka (kehilangan HP/Mood), namun tetap membawa pulang sedikit XP.\n\n" +
"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
"💡 *Tips: Belilah Sabun Licin di Black Market (.bm) sebelum melancarkan aksi kejahatan untuk mengurangi waktu kurungan jika tertangkap polisi!*\n\n" +
"Selamat menjelajah pasar gelap dan melatih pet kesayangan Anda! 🍻🐾";

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
      .setColor('#e91e63') // Pink Crimson Premium Color
      .setTitle('📢 UPDATE SENTINEL: FITUR BLACK MARKET & EKSPANSI PET SYSTEM')
      .setDescription(ANNOUNCEMENT_DESCRIPTION)
      .setTimestamp()
      .setFooter({ text: 'Sentinel Bot • Server Kosan 1A' });

    await channel.send({ content: '@everyone', embeds: [embed] });
    
    console.log('✅ Embed pengumuman pembaruan berhasil terkirim!');
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
