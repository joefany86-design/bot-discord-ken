const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
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
  
  const imagePath = '/Users/joefany/.gemini/antigravity-ide/brain/ad8d2f46-2059-4ac8-880b-04db675c7d72/stock_market_announcement_1780173967141.png';
  const attachment = new AttachmentBuilder(imagePath, { name: 'stock_market.png' });
  
  const embed = new EmbedBuilder()
    .setColor(0x00FF88)
    .setTitle('📈 BURSA SAHAM KOSAN INTERAKTIF & PANDUAN TRADING SULTAN 📈')
    .setThumbnail('https://cdn-icons-png.flaticon.com/512/4222/4222025.png')
    .setDescription(
      `🔔 **PENGUMUMAN RESMI — INVESTASI CERDAS DI BURSA SAHAM KOSAN 1A!** @everyone\n\n` +
      `*Ingin melipatgandakan koin dompet secara cepat dan otomatis? Bursa Saham Kosan 1A adalah instrumen keuangan tercanggih tempat Anda membeli kepemilikan atas channel teraktif di server ini!*\n\n` +
      `👑 **APAKAH ITU BURSA SAHAM KOSAN?**\n` +
      `Setiap text channel di server (seperti lounge, general-chat, pet, dll) terdaftar sebagai instrumen saham di bursa. **Harga saham dihitung secara dinamis dan diperbarui setiap 2 jam sekali berdasarkan keaktifan chat warga di channel tersebut!** Semakin ramai warga mengobrol di suatu channel, semakin tinggi harga sahamnya melesat!\n\n` +
      `⚙️ **DAFTAR PERINTAH & INSTRUMEN TRADING:**\n` +
      `📊 **\`.market\`** · **\`.saham\`** — Membuka dashboard bursa saham utama dan meluncurkan panel transaksi interaktif pribadi.\n` +
      `📉 **\`.stock <ticker>\`** · **\`.chart <ticker>\`** — Menampilkan grafik tren harga ASCII 2D (10 update terakhir) lengkap dengan tombol instan Beli, Jual, & Refresh!\n` +
      `📥 **\`.buy <ticker> <jumlah>\`** — Membeli lembar saham (Maksimal kepemilikan 500 lembar per saham per user).\n` +
      `📤 **\`.sell <ticker> <jumlah>\`** — Menjual saham Anda kembali ke bursa (dikenakan pajak bursa standar **15%**).\n` +
      `📤 **\`.sellall <ticker>\`** — Melikuidasi penuh seluruh lembar saham yang Anda miliki pada ticker tertentu.\n` +
      `💼 **\`.porto\`** · **\`.portfolio\`** — Dashboard portofolio Anda: cek harga rata-rata beli, jumlah lembar, dan profit/loss real-time.\n\n` +
      `💵 **SISTEM DIVIDEN MINGGUAN KOSAN:**\n` +
      `Setiap **Minggu malam pukul 21:00 WIB**, sistem bursa membagikan deviden tunai secara otomatis kepada semua investor saham berdasarkan keaktifan chat mingguan channel terkait *(Maksimum dividen 9% dari harga saham)*. Semakin aktif warga chat di channel tersebut, semakin berlimpah dividen yang Anda terima!\n\n` +
      `🤖 **ROBOT AUTO-TRADING AI (ASISTEN INVESTASI PRIBADI):**\n` +
      `*Biarkan robot bekerja mengalirkan cuan ke dompet Anda saat Anda sedang tidur!*\n` +
      `🤖 **\`.autotrade\`** — Mengaktifkan/menonaktifkan asisten robot trading otomatis Anda:\n` +
      `╰ 📥 **Auto DCA (Buy-the-Dip)**: Jika saldo dompet Anda $\\ge$ Rp 150, robot otomatis mencicil beli saham termurah/sedang turun setiap 2 jam *(maksimal alokasi 30% saldo)*.\n` +
      `╰ 📤 **Auto Take-Profit (TP)**: Robot otomatis menjual saham Anda saat keuntungan mencapai **$\\ge$ 15%** dari harga beli rata-rata untuk mengunci keuntungan koin dompet!\n\n` +
      `💡 **5 TIPS & STRATEGI SUKSES TRADING SULTAN:**\n` +
      `1️⃣ **Ikuti Tren Chat (Ride the Wave)** — Belilah saham channel obrolan utama ketika mendeteksi obrolan sedang ramai di server untuk menumpang gelombang kenaikan harga (Bull Run).\n` +
      `2️⃣ **Sewa Penthouse Kosan** — Dapatkan diskon eksklusif pajak penjualan saham dari 15% menjadi **10%** saja dengan menyewa Penthouse! Ini meningkatkan profit bersih Anda secara signifikan!\n` +
      `3️⃣ **Aktifkan Robot Auto-Trading** — Biarkan robot mengamankan profit instan saat Anda sedang offline atau tertidur lewat fitur Auto Take-Profit.\n` +
      `4️⃣ **Amankan Cuan di Bank** — Setelah melakukan penjualan untung, segera tabung koin Anda ke \`.bank\` agar aman dari perampok (.rob) dan dapatkan bunga harian tambahan.\n` +
      `5️⃣ **Manfaatkan Dividen** — Tahan saham berdividen tinggi sepanjang minggu untuk menikmati aliran koin tunai pasif setiap hari Minggu malam.`
    )
    .setImage('attachment://stock_market.png')
    .setFooter({ text: 'Bursa Saham Kosan 1A Terpadu • Berinvestasilah Secara Bijak!', iconURL: channel.guild.iconURL({ dynamic: true }) || null })
    .setTimestamp();
    
  await channel.send({
    embeds: [embed],
    files: [attachment]
  });
  
  console.log("✅ Custom stock market guide successfully posted!");
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error("Gagal login:", err.message);
  process.exit(1);
});
