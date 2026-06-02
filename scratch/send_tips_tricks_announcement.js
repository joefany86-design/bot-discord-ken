require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

const CHANNEL_ID = '1478566460124041428';

const DESCRIPTION =
  "Halo Warga Kosan 1A! 👋🚀\n" +
  "Ingin cepat kaya, punya pet legendaris, atau menguasai bursa saham di server ini? Yuk, pelajari panduan strategi taktis berikut agar permainanmu berjalan maksimal dan dompetmu melimpah! 💸✨\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "🌱 **FASE PEMULA: MEMBANGUN MODAL AWAL**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "*   **Jaga Daily Streak:** Mengetik chat pertama kali setiap hari otomatis mencairkan gaji harian gratis (`.daily`) ditambah bonus streak berturut-turut! Jangan sampai bolong agar multiplier-nya terus naik.\n" +
  "*   **Aktif Mengobrol (Chat-to-Earn):** Cukup aktif berkirim pesan di chat server (minimal 3 kata & 10 karakter), kamu otomatis mendapatkan **Rp 1 s/d Rp 4** acak per pesan *(cooldown 45 detik untuk mencegah spam)*.\n" +
  "*   **Adopsi Pet Slime:** Adopsi pet pertamamu seharga Rp 1.500 (`.pet buy <nama> slime`). Spesies **Slime** sangat disarankan bagi pemula karena laju lapar & haus berkurang 25% lebih lambat (sangat hemat pakan!).\n" +
  "*   **Kerja Pet Rutin:** Ketik `.pet work` setiap 1 jam sekali untuk koin stabil gratis.\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "📈 **FASE MENENGAH: INVESTASI & FASILITAS KAMAR**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "*   **Sewa Kamar AC (Rp 350 / 3 hari):** Ketik `.sewakos` untuk memilih Kamar AC. Ini memberi bonus daily +Rp 15/hari dan memotong pajak transfer koin antarmember menjadi **8%** (normal 10%).\n" +
  "*   **Beli Fasilitas Kamar Permanen (`.upgradekos`):**\n" +
  "    *   🛏️ **Kasur Busa (Rp 200):** Menaikkan bonus streak harian menjadi **+Rp 4** per hari streak.\n" +
  "    *   💧 **Dispenser Air (Rp 150):** Memberikan peluang **10%** koin chat digandakan 2x lipat secara pasif dengan reaksi emoji `🥤`!\n" +
  "*   **Mulai Trading Saham:** Ketik `.market` atau `.saham`. Beli saham channel teraktif saat harga sedang merah/turun, lalu jual kembali ketika hijau/untung. Ingat, saham harus di-hold minimal 24 jam sebelum bisa dijual!\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "👑 **FASE SULTAN: AMORTISASI PASIF & ROBOT AI**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "*   **Sewa Kamar Penthouse (Rp 800 / 3 hari):** Memberikan gaji harian tertinggi (+Rp 40/hari), memotong pajak jual saham menjadi 10%, memotong pajak transfer menjadi 5%, bebas biaya admin bank harian, dan bunga bank harian maksimal 1.5%!\n" +
  "*   **Aktifkan Robot Auto-Trade (`.autotrade`):** Biarkan robot trading AI membelikan saham otomatis saat harga murah (DCA) dan otomatis menjualnya (Take Profit) saat keuntungan mencapai **>= 15%**.\n" +
  "*   **Tabung di Bank (`.bank`):** Simpan uangmu di bank untuk bunga pasif harian. *Penting:* Kamu wajib mengirim minimal 5 pesan di chat hari itu agar bunga bank cair di tengah malam!\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "💥 **GAMEPLAY RISIKO TINGGI: EXPEDITION & GACHA**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "*   **Proteksi Nyawa Pet (`.pet expedition`):** Ekspedisi co-op bersama warga lain memberikan hadiah koin masif (hingga Rp 2.500), namun ada **risiko pet mati sebesar 3%**. Selalu pasang **Jimat Keberuntungan** (`LUCKY_AMULET` seharga Rp 2.000 di toko pet) agar petmu selamat dari kematian fatal!\n" +
  "*   **Rampok Kelompok (`.heist`):** Kumpulkan 5+ warga untuk merampok bank server. Peluang sukses naik menjadi 45% dengan hasil jarahan masif Rp 10.000 s/d Rp 16.000!\n" +
  "*   **Roda Nasib Gacha (`.gacha-role`):** Putar gacha role seharga Rp 250 untuk memperebutkan kasta role Common s/d Mythic. Role Mythic (0.1%) memberikan **Gacha Perks** luar biasa: Kebal total dirampok, kebal mati ekspedisi, kebal sakit soda, bonus chat earn +Rp 8, dan limit bank bertambah +Rp 30.000!\n\n" +
  "💡 *Pahami strateginya, sewa kamar terbaikmu, rawat petmu, dan mari mendominasi ekonomi Kosan 1A! Selamat bermain!* 🛌🎰🚀📈";

client.once('ready', async () => {
  console.log(`🤖 Login berhasil sebagai ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) {
      console.error('❌ Channel tidak ditemukan.');
      process.exit(1);
    }

    console.log(`📢 Mengirim panduan tips & tricks ke #${channel.name}...`);

    const embed = new EmbedBuilder()
      .setColor('#4CAF50') // Green success color
      .setTitle('💡 TIPS & TRIK BERMAIN: PANDUAN MEMULAI DAN MENJADI SULTAN KOSAN 1A! 🛌💸🚀')
      .setDescription(DESCRIPTION)
      .setTimestamp()
      .setFooter({ text: 'Sentinel Bot • Guide Updates' });

    await channel.send({ embeds: [embed] });

    console.log('✅ Panduan tips & tricks berhasil terkirim!');
    process.exit(0);

  } catch (err) {
    console.error('❌ Gagal mengirim panduan:', err);
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN).catch(e => {
  console.error("Login gagal:", e.message);
  process.exit(1);
});
