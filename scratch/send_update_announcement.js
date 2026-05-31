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

  // 1. Purge/Hapus semua chat di channel pengumuman ini terlebih dahulu agar rapi
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
    .setColor(0xE67E22) // Vibrant orange-bronze for update announcement
    .setTitle('🚀 OFFICIAL UPDATE LOG: NEW FEATURES ACTIVATED! 🚀')
    .setThumbnail('https://cdn-icons-png.flaticon.com/512/3037/3037233.png')
    .setDescription(
      `🔔 **PENGUMUMAN RESMI — RILIS FITUR UPDATE SENTINEL BOT 2026!** @everyone\n\n` +
      `*Kabar gembira untuk seluruh warga server! Tim developer telah berhasil merilis beberapa update fitur krusial yang ditargetkan untuk menambah ketegangan aktivitas perbankan serta pengelolaan peliharaan virtual Anda agar semakin menantang!*\n\n` +
      `Berikut adalah rincian lengkap fitur baru yang sudah resmi diaktifkan dan dapat digunakan mulai hari ini:\n\n` +
      `══════════════════════════════════════\n\n` +
      `🐾 **1. FITUR BARU: REVIVE PET (HIDUPKAN KEMBALI PET)**\n` +
      `Lalai merawat pet kesayangan hingga berstatus **DEAD** 🪦? Jangan khawatir! Sekarang Admin & Owner dapat memberikan kesempatan hidup kedua bagi pet Anda.\n` +
      `* **Cara Menggunakan**: Owner/Admin membuka Panel Admin Pet via perintah \`.admin-pet\` lalu memilih menu drop-down **💖 Hidupkan Kembali Pet (Revive)**.\n` +
      `* **Spesifikasi**: Mengubah status pet kembali aktif (` + "`ADULT` / `BABY`" + ` tergantung level) serta memulihkan HP & kebutuhan (Kenyangan, Hidrasi, Ceria) penuh kembali menjadi **100%**!\n\n` +
      `🏦 **2. UPGRADE BANK HEIST: CUSTOMER DEPOSIT DRAINAGE SYSTEM**\n` +
      `Menyimpan seluruh harta Anda di tabungan bank sekarang tidak lagi sepenuhnya bebas dari resiko! Bersiaplah menjaga dan membelanjakan uang Anda secara produktif.\n` +
      `* **Mekanisme Baru**: Mulai saat ini, jika operasi **Central Bank Heist (\`.heist\`) berhasil**, sistem akan secara paksa **menyita 5% hingga 15% saldo tabungan bank (` + "`bank_savings`" + `) milik pemain lain** secara acak di server!\n` +
      `* **Loot Bonus**: Seluruh koin nasabah yang berhasil dicuri tersebut akan ditambahkan langsung ke dalam total hadiah rampokan kru heist untuk dibagi rata.\n` +
      `* **Transparansi Mutasi**: Korban pencurian bank akan mendapati catatan transaksi resmi berkode \`HEIST_VICTIM_LOSS\` dengan nominal minus di riwayat tabungannya.\n` +
      `* **Visual Report**: Laporan sukses Heist di Discord sekarang menyertakan daftar **💸 DANA NASABAH YANG DIKORBANKAN** lengkap dengan nama korban dan jumlah koin nasabah yang tersita!\n\n` +
      `🛡️ **3. PENGETATAN KEAMANAN PANEL ADMIN PET**\n` +
      `Untuk menghindari penyalahgunaan, sistem Panel Admin Pet kini telah dikunci secara penuh.\n` +
      `* **Hak Akses Baru**: Hanya **Owner Utama (ID: 436554535037698059)** dan **Pengguna yang memiliki Role/Permission Administrator** server yang berhak memanggil perintah \`.admin-pet\` atau mengeklik interaksi tombol di dalam panel.\n\n` +
      `══════════════════════════════════════\n\n` +
      `*Ayo amankan tabungan Anda dan tunjukkan kerja sama tim terbaik Anda untuk membobol brankas bank nasabah server! 💥🏦🐾*`
    )
    .setFooter({ text: 'Sentinel Bot 2026 • Official Update Release Log', iconURL: channel.guild.iconURL({ dynamic: true }) || null })
    .setTimestamp();

  await channel.send({
    embeds: [embed],
    allowedMentions: { parse: ['everyone'] }
  });

  console.log("✅ Announcement successfully posted!");
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error("Gagal login:", err.message);
  process.exit(1);
});
