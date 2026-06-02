require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

const CHANNEL_ID = '1509770711839805641';

const DESCRIPTION =
  "Halo @everyone! 🎉\n\n" +
  "Kabar gembira bagi kalian pemegang Role Gacha! Mulai sekarang, memenangkan role gacha bukan hanya sekadar pajangan profil Discord kalian. Kami telah meluncurkan **Paket Benefit Pasif Terpadu (Gacha Perks)** berdasarkan tier role gacha tertinggi yang kalian miliki! 🐾🏦🚨\n\n" +
  "Berikut adalah rincian benefit pasif yang bisa kalian nikmati:\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "🐾 **MANFAAT GAMEPLAY PET (TAMAGOTCHI)**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "*   **Bonus XP Pet:** Pet kalian tumbuh lebih cepat! (+10% s/d +100% XP untuk kerja & berburu).\n" +
  "*   **Bonus Gaji Pet:** Hasil kerja & berburu pet bertambah (+10% Epic, +20% Legendary, +35% Mythic).\n" +
  "*   **Resistensi Sakit Soda:** Peluang sakit minum soda ke-3+ berkurang drastis (Rare 25%, Epic 15%, Legendary 5%, **Mythic 0% Kebal Sakit**).\n" +
  "*   **Kekebalan Mati Ekspedisi:** Risiko kematian pet di ekspedisi terpangkas (Legendary 1%, **Mythic 0% Kebal Mati**).\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "🏦 **MANFAAT EKONOMI & PERPAJAKAN**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "*   **Bonus Chat Earn:** Tambahan koin per pesan di chat server (+Rp 1 s/d +Rp 8 per pesan).\n" +
  "*   **Diskon Pajak Transfer:** Mengurangi potongan pajak transfer koin (Rare -1%, Epic -2%, Legendary -3%, **Mythic -5%**).\n" +
  "*   **Diskon Pajak Saham:** Mengurangi pajak penjualan saham (Rare -1%, Epic -3%, Legendary -5%, **Mythic -8%**).\n" +
  "*   **Bunga Bank Tambahan:** Menambah batas bunga (Interest Cap) bank harian (+Rp 5.000 s/d +Rp 30.000) dan menambah rate bunga (+0.50% khusus Mythic).\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "🚨 **MANFAAT KRIMINALITAS & KEAMANAN**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "*   **Bonus Sukses Rob:** Peluang sukses merampok meningkat (+2% s/d +25%).\n" +
  "*   **Proteksi Uang Dicuri:** Korban gacha role kehilangan koin lebih sedikit saat dirampok (Rare -10%, Epic -20%, Legendary -35%, **Mythic Kebal Total 100% dari Perampokan!**).\n" +
  "*   **Diskon Masa Penjara & Denda (Bail):** Durasi dipenjara terpangkas (s/d -50% durasi) dan denda tebus jaminan lebih murah (s/d -50% denda).\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
  "💡 *Catatan Sistem:*\n" +
  "*   Jika memiliki beberapa role gacha sekaligus, sistem otomatis menggunakan **tier tertinggi** (Mythic > Legendary > Epic > Rare > Common).\n" +
  "*   Benefit ini menumpuk (*stack*) dengan upgrade sewa kamar kos dan fasilitas kosan Anda saat ini.\n\n" +
  "Selamat melakukan gacha dan nikmati hak istimewa baru Anda! 🎲🔥";

client.once('ready', async () => {
  console.log(`🤖 Login berhasil sebagai ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) {
      console.error('❌ Channel tidak ditemukan.');
      process.exit(1);
    }

    console.log(`📢 Mengirim pengumuman ke #${channel.name}...`);

    const embed = new EmbedBuilder()
      .setColor('#7C3AED')
      .setTitle('📢 SENTINEL UPDATE: BENEFIT PASIF GAMING GACHA ROLE (COMMON - MYTHIC)! 🎲✨')
      .setDescription(DESCRIPTION)
      .setTimestamp()
      .setFooter({ text: 'Sentinel Bot • System Updates' });

    await channel.send({ content: '@everyone', embeds: [embed] });

    console.log('✅ Pengumuman berhasil terkirim!');
    process.exit(0);

  } catch (err) {
    console.error('❌ Gagal mengirim pengumuman:', err);
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN).catch(e => {
  console.error("Login gagal:", e.message);
  process.exit(1);
});
