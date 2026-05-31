const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  const channelId = '1509770711839805641';
  const channel = await client.channels.fetch(channelId).catch(err => {
    console.error("Gagal mengambil channel:", err.message);
    process.exit(1);
  });
  
  if (!channel) {
    console.error("Channel tidak ditemukan.");
    process.exit(1);
  }

  // Purge/Hapus semua chat di channel pengumuman ini terlebih dahulu agar rapi
  console.log("Memulai pembersihan (purging) channel...");
  let fetched;
  let totalDeleted = 0;
  do {
    fetched = await channel.messages.fetch({ limit: 100 });
    if (fetched.size > 0) {
      console.log(`Mengambil ${fetched.size} pesan untuk dihapus...`);
      try {
        await channel.bulkDelete(fetched);
        console.log("Bulk delete sukses.");
        totalDeleted += fetched.size;
      } catch (err) {
        console.log("Bulk delete gagal, menghapus satu-persatu...");
        for (const msg of fetched.values()) {
          await msg.delete().catch(e => console.error("Gagal hapus pesan:", e.message));
          totalDeleted++;
          await new Promise(r => setTimeout(r, 800)); // anti rate limit
        }
      }
    }
  } while (fetched.size > 0);
  
  console.log(`✅ Channel bersih! Total pesan dihapus: ${totalDeleted}`);

  const embed = new EmbedBuilder()
    .setColor(0x3F51B5) // Premium Royal Indigo Blue
    .setTitle('🛡️ PVE PET EXPEDITION V2: ZONA PETUALANGAN & SISTEM PENALTI! 🛡️')
    .setThumbnail('https://cdn-icons-png.flaticon.com/512/3037/3037233.png')
    .setDescription(
      `🔔 **PENGUMUMAN RESMI — RILIS PVE PET EXPEDITION V2!** @everyone\n\n` +
      `*Perhatian bagi seluruh Pelatih Pet dan petualang! Sistem ekspedisi kelompok (\`.pet expedition\`) telah ditingkatkan secara besar-besaran untuk menghadirkan zona bertualang terstruktur, perhitungan keberhasilan dinamis, dan penantang ekstrem bagi pet kesayangan Anda!*\n\n` +
      `Berikut adalah rincian fitur Pet Expedition V2 yang resmi diaktifkan di server:\n\n` +
      `══════════════════════════════════════\n\n` +
      `🗺️ **1. PETA PETUALANGAN PVE TERSTRUKTUR (EXPEDITION_MAPS)**\n` +
      `Kini lobi ekspedisi tidak lagi acak! Anda dapat memilih **4 Zona Peta** menantang dengan mengetik \`.pet expedition <ID Peta>\`:\n\n` +
      `🌲 **ID Peta: 1 — Hutan Pemula (Beginner Forest)**\n` +
      `• *Rekomendasi Level*: \`Lv. 1+\` | *Sukses Dasar*: \`85%\`\n` +
      `• *Hadiah*: \`Rp 300 - Rp 600\` koin\n` +
      `• *Deskripsi*: Hutan bersahabat penuh kelinci liar dan jamur kecil.\n\n` +
      `🦇 **ID Peta: 2 — Gua Gelap (Dark Cave)**\n` +
      `• *Rekomendasi Level*: \`Lv. 10+\` | *Sukses Dasar*: \`65%\`\n` +
      `• *Hadiah*: \`Rp 600 - Rp 1.200\` koin\n` +
      `• *Deskripsi*: Lorong gua basah penuh laba-laba raksasa.\n\n` +
      `🌋 **ID Peta: 3 — Lembah Api (Fire Valley)**\n` +
      `• *Rekomendasi Level*: \`Lv. 25+\` | *Sukses Dasar*: \`45%\`\n` +
      `• *Hadiah*: \`Rp 1.200 - Rp 2.200\` koin\n` +
      `• *Deskripsi*: Ngarai panas berpijar dijaga naga api liar.\n\n` +
      `🏰 **ID Peta: 4 — Istana Kuno (Ancient Palace)**\n` +
      `• *Rekomendasi Level*: \`Lv. 40+\` | *Sukses Dasar*: \`25%\`\n` +
      `• *Hadiah*: \`Rp 2.000 - Rp 4.000\` koin\n` +
      `• *Deskripsi*: Reruntuhan kuno dijaga iblis bermata satu.\n\n` +
      `*Tips: Ketik \`.pet expedition\` (tanpa angka) untuk menampilkan list peta ini di Discord!*\n\n` +
      `⚙️ **2. DYNAMIC LEVEL SCALING & DENDA LEVEL RENDAH (Lv Lacking >= 10)**\n` +
      `Peluang sukses bertualang sekarang dihitung secara adil berdasarkan kecocokan level pet vs level peta:\n` +
      `* **Penalti Kekurangan Level**: Jika pet di bawah rekomendasi level peta, peluang sukses tim dikurangi **-3% per level kekurangan**.\n` +
      `* **⚠️ PENALTI FLAT EKSTRIM PEMULA**: Jika pet berlevel rendah nekat ikut lobi zona tinggi dengan selisih **10 level atau lebih** (misal pet Lv. 5 gabung ke Lembah Api Lv. 25), seluruh kru akan terkena **penalti flat sebesar -30% success chance** (peluang sukses anjlok!).\n` +
      `* **Bonus Level Tinggi**: Pet yang memiliki level di atas rekomendasi peta memberikan bonus **+1% per level kelebihan** (maks +15% per pet).\n` +
      `* **🐌 Log Kambing Hitam (Culprit)**: Jika tim gagal karena membawa pet level rendah (selisih >= 10), log kronologi pertarungan di Discord akan secara khusus menunjuk pet tersebut sebagai beban tim yang pingsan ketakutan!\n\n` +
      `👥 **3. DUA LOBI SIMULTAN AKTIF BERSAMAAN (DUAL LOBBIES)**\n` +
      `* Tidak perlu lagi mengantre panjang! Server sekarang memperbolehkan **maksimal 2 lobi ekspedisi pet aktif** berjalan secara bersamaan di server.\n` +
      `* Pembuatan lobi diisolasi per inisiator (` + "`activeLobby`" + ` dikunci per user), dan jika pembuat membatalkan lobi berkumpul, **Rp 150 koin biaya ransum peserta dijamin di-refund 100%**!\n\n` +
      `══════════════════════════════════════\n\n` +
      `*Ayo latih pet kesayangan Anda, pilih zona peta petualangan yang cocok, dan kumpulkan tim terkuat Anda untuk menaklukan bos zona sekarang juga! 🦖🔥🐾🛡️*`
    )
    .setFooter({ text: 'Sentinel Bot 2026 • PVE Pet Expedition V2 Log Release', iconURL: channel.guild.iconURL({ dynamic: true }) || null })
    .setTimestamp();

  await channel.send({
    embeds: [embed],
    allowedMentions: { parse: ['everyone'] }
  });

  console.log("✅ Update Announcement successfully posted!");
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error("Gagal login:", err.message);
  process.exit(1);
});
