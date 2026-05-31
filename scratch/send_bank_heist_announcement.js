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
    .setColor(0xC0392B) // High emergency dark red crimson
    .setTitle('🚨 URGENT ANNOUNCEMENT: CENTRAL BANK INSECURITY REPORT 🚨')
    .setThumbnail('https://cdn-icons-png.flaticon.com/512/5974/5974637.png')
    .setDescription(
      `🔔 **PENGUMUMAN DARURAT: BRANKAS BANK SENTRAL DIHACK!** @everyone\n\n` +
      `*Perhatian kepada seluruh nasabah bank virtual server! Pihak otoritas keamanan bank sentral melaporkan adanya celah keamanan besar (major security vulnerability). Seluruh dana simpanan tabungan Anda sekarang berada dalam status rawan pembobolan oleh komplotan perampok!*\n\n` +
      `Sistem keamanan bank baru saja diperbarui ke mekanisme yang lebih dinamis dan realistis:\n\n` +
      `══════════════════════════════════════\n\n` +
      `🏦 **CENTRAL BANK HEIST — CUSTOMER DEPOSIT DRAINAGE SYSTEM**\n\n` +
      `Mulai hari ini, menyimpan koin dalam jumlah besar di bank secara pasif tidak lagi sepenuhnya aman dari jarahan pelaku kriminal! \n\n` +
      `💸 **1. Penyitaan Saldo Tabungan Nasabah (5% - 15%)**\n` +
      `Setiap kali ada kelompok kru perampok yang **berhasil membobol brankas bank sentral (\`.heist\`)**, sistem akan mendebit paksa **$5\%$ hingga $15\%$ dari total saldo tabungan bank (` + "`.dep`" + `)** milik warga server lainnya secara acak!\n\n` +
      `💰 **2. Akumulasi Koin Jarahan Kru Heist**\n` +
      `Semua koin tabungan milik korban nasabah yang berhasil disedot akan langsung dilebur dan ditambahkan ke dalam **Total Hadiah Jarahan Kru Heist**, lalu dibagi rata kepada seluruh kru perampok yang sukses meloloskan diri!\n\n` +
      `📝 **3. Transparansi Mutasi Rekening**\n` +
      `Bagi warga yang menjadi korban pencurian bank, saldo tabungan Anda akan berkurang secara nyata. Anda dapat melacak pemotongan ini pada riwayat mutasi tabungan yang otomatis mencatat log transaksi berkode **\`HEIST_VICTIM_LOSS\`**.\n\n` +
      `📊 **4. Publikasi Daftar Korban**\n` +
      `Sebagai bentuk laporan kepolisian, nama-nama nasabah yang dananya terjarah beserta jumlah koin yang hilang akan terpampang nyata secara publik pada bagian **💸 DANA NASABAH YANG DIKORBANKAN** di akhir embed laporan sukses Heist!\n\n` +
      `══════════════════════════════════════\n\n` +
      `💡 **TIPS BERTAHAN HIDUP BAGI WARGA:**\n` +
      `* **Putar Koin Anda**: Jangan biarkan uang Anda mengendap terlalu banyak di tabungan bank secara pasif. Gunakan koin Anda untuk berinvestasi, membeli aset kosan, atau membelanjakan barang bernilai di black market!\n` +
      `* **Balas Dendam**: Cara terbaik untuk merebut kembali koin Anda yang hilang adalah dengan membentuk kru kriminal Anda sendiri dan merampok balik bank sentral! \n\n` +
      `*Bersiaplah menjaga kekayaan Anda atau rebut kekayaan nasabah lain di arena Central Bank Heist! 💥🏦🏃‍♂️💨*`
    )
    .setFooter({ text: 'Central Bank Server • Security Vulnerability & Heist Update Log', iconURL: channel.guild.iconURL({ dynamic: true }) || null })
    .setTimestamp();

  await channel.send({
    embeds: [embed],
    allowedMentions: { parse: ['everyone'] }
  });

  console.log("✅ Bank heist announcement successfully posted!");
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error("Gagal login:", err.message);
  process.exit(1);
});
