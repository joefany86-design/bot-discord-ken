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
    .setColor(0x8E44AD) // Luxury violet for Heist & Synergy update
    .setTitle('🚨 MAJOR UPDATE: CENTRAL BANK HEIST SYNERGY SYSTEM 🚨')
    .setThumbnail('https://cdn-icons-png.flaticon.com/512/5974/5974637.png')
    .setDescription(
      `🔔 **PENGUMUMAN RESMI — RILIS UPDATE UTAMA SENTINEL BOT!** @everyone\n\n` +
      `*Perhatian seluruh komplotan warga server! Hubungan kriminal di server kini mencapai tingkat ketegangan baru! Tim developer telah resmi mengaktifkan integrasi penuh antara **Tamagotchi Pet**, **Black Market (Pasar Gelap)**, dan **Sewa Properti Kosan** langsung ke dalam sistem Multiplayer Bank Heist (` + "`.heist`" + `)!*\n\n` +
      `Rencanakan heist Anda secara taktis dengan memanfaatkan seluruh sistem pendukung yang telah Anda miliki. Berikut rincian mekanik baru yang sudah live:\n\n` +
      `══════════════════════════════════════\n\n` +
      `🧬 **1. SINERGI TAMAGOTCHI PET (ADULT PERKS)**\n` +
      `Hewan peliharaan dewasa Anda kini bukan sekadar pajangan! Bawa pet berstatus **ADULT** (aktif) milik kru Heist Anda untuk memicu efek taktis:\n` +
      `*   **🔥 Naga / Dragon**: Menambahkan **+7% peluang sukses** perampokan (membantu melumpuhkan penjaga dengan semburan api).\n` +
      `*   **🧱 Golem**: Menambahkan **+5% peluang sukses**. Jika heist GAGAL, Golem bertindak sebagai tameng berat yang mengurangi **25% denda uang** & **25% durasi penjara** bagi seluruh kru!\n` +
      `*   **🐱 Kucing / Cat**: Keahlian menyelinap kucing meningkatkan **+10% hasil jarahan koin** dari brankas dasar maupun tabungan korban!\n` +
      `*   **🟢 Slime**: Tubuh licin Slime memberikan **10% peluang acak** bagi tiap kru untuk menyelinap melarikan diri (*dodge jail*) tanpa dipenjara jika heist gagal.\n` +
      `*   **⚡ XP Booster**: Seluruh perolehan XP pet saat perampokan berhasil kini dikalikan dengan **XP Booster Multiplier** pet aktif Anda secara akurat!\n\n` +
      `⚙️ **2. SINERGI PERLENGKAPAN BLACK MARKET (BM GEAR TRIGGER)**\n` +
      `Bongkar tas kriminal Anda! Item-item Black Market kini memiliki utilitas krusial saat Bank Heist dijalankan:\n` +
      `*   **🗝️ Linggis / Lockpick**: Setiap Lockpick yang dibawa kru memberikan **+5% sukses** (maksimal **+15%** total). Namun berhati-hatilah, Lockpick memiliki **25% peluang patah/rusak** setelah aksi.\n` +
      `*   **🥩 Daging Bius / Meat**: Jika minimal ada 1 kru membawa Meat, anjing penjaga bank dibius dan menambah **+5% sukses** (item langsung dikonsumsi/habis terpakai).\n` +
      `*   **🎭 Topeng Samaran / Mask**: Kru yang mengenakan Mask akan menyamarkan sidik jari mereka dan mendapatkan bonus koin jarahan pribadi sebesar **+10%** tambahan saat heist sukses (item dikonsumsi).\n\n` +
      `🏢 **3. PENTHOUSE PLANNING CENTER (VIP DISCOUNT)**\n` +
      `Kos-kosan elit Anda kini menjadi markas komplotan perampok handal!\n` +
      `*   **Diskon VIP**: Jika otak kriminal (inisiator heist) menyewa kamar **Penthouse Kosan** aktif, biaya persiapan Heist didiskon **25%** (menjadi **Rp 150** dari Rp 200). Diskon ini otomatis dinikmati oleh **seluruh anggota kru** yang ikut bergabung!\n\n` +
      `══════════════════════════════════════\n\n` +
      `*Beli perlengkapan di Black Market, latih Pet Dewasa Anda, dan sewa properti terbaik untuk merencanakan perampokan Bank Sentral terbesar musim ini! Semoga beruntung, Komplotan! 🕵️‍♂️🔥🏦🔒*`
    )
    .setFooter({ text: 'Sentinel Bot • Central Bank Heist Integration Release Log', iconURL: channel.guild.iconURL({ dynamic: true }) || null })
    .setTimestamp();

  await channel.send({
    embeds: [embed],
    allowedMentions: { parse: ['everyone'] }
  });

  console.log("✅ Heist announcement successfully posted!");
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error("Gagal login:", err.message);
  process.exit(1);
});
