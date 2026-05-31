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
  
  const adminChannelId = '1472479761782673621'; // #🫡┃admin-baik
  const channel = await client.channels.fetch(adminChannelId).catch(err => {
    console.error("Gagal mengambil channel admin:", err.message);
    process.exit(1);
  });
  
  if (!channel) {
    console.error("Channel admin tidak ditemukan.");
    process.exit(1);
  }

  console.log(`Menghubungkan ke saluran: ${channel.name}`);

  // Hapus pesan lama di channel agar bersih & estetik (cukup lakukan 1 kali fetch maksimal 50 pesan)
  console.log("Memulai pembersihan (purging) channel admin...");
  try {
    const fetched = await channel.messages.fetch({ limit: 50 });
    if (fetched.size > 0) {
      console.log(`Mengambil ${fetched.size} pesan untuk dihapus...`);
      try {
        await channel.bulkDelete(fetched);
        console.log("Bulk delete sukses.");
      } catch (err) {
        console.log("Bulk delete gagal (mungkin ada pesan >14 hari), menghapus satu-persatu...");
        for (const msg of fetched.values()) {
          await msg.delete().catch(e => console.error("Gagal hapus pesan:", e.message));
          await new Promise(r => setTimeout(r, 200)); // Cepat tapi aman
        }
      }
    }
  } catch (err) {
    console.error("Gagal melakukan pembersihan:", err.message);
  }
  console.log("✅ Pembersihan selesai!");

  // Lampirkan aset gambar retro pixel art yang kita buat secara premium
  const imagePath = '/Users/joefany/.gemini/antigravity-ide/brain/a7441e53-d8a3-4acf-983a-048b5c95c537/pet_heist_art_1780240188059.png';
  const file = new AttachmentBuilder(imagePath, { name: 'pet_heist_art.png' });

  // Bangun embed draf pengumuman premium
  const embed = new EmbedBuilder()
    .setColor(0x00E676) // Premium Emerald Green (Warna Keberuntungan & Kemakmuran)
    .setTitle('🛡️ DRAFT PENGUMUMAN PEMAIN: UPDATE PLAYER HAPPINESS & BURSA OTOMATIS! 🛡️')
    .setThumbnail('https://cdn-icons-png.flaticon.com/512/3037/3037233.png')
    .setImage('attachment://pet_heist_art.png')
    .setDescription(
      `🔔 **PENGUMUMAN RESMI — RELEASE UPDATE PLAYER HAPPINESS & AUTOMATIC STOCK MARKET!** @everyone\n\n` +
      `*Perhatian bagi seluruh warga Kosan 1A dan petualang! Demi menghadirkan iklim bermain yang lebih seru, menyenangkan, dan bersahabat bagi pemain baru maupun veteran, Dewan Kota Sentinel resmi meluncurkan paket pembaruan keseimbangan game!*\n\n` +
      `Berikut adalah rincian lengkap pembaruan sistem yang kini telah resmi aktif di server:\n\n` +
      `══════════════════════════════════════\n\n` +
      `🪙 **1. PENDAPATAN KOIN CHAT & DAILY NAIK (ECONOMY BOOSTER)**\n` +
      `Keran ekonomi server dibuka lebih lebar agar warga cepat makmur:\n` +
      `• **Daily Claim Harian**: Dari hanya Rp 15 - Rp 35 dinaikkan menjadi **` + "`Rp 35 - Rp 75`" + `** per hari!\n` +
      `• **Chat Earning (Koin per Pesan)**: Dinaikkan menjadi **` + "`Rp 2 - Rp 5`" + `** per pesan chat.\n` +
      `• **Cooldown Chat**: Dipangkas menjadi **` + "`40 detik`" + `** saja agar obrolan mengalir kencang!\n` +
      `• **Voice Channel Earning**: Naik menjadi **` + "`Rp 2 per 5 menit`" + `** dengan batas limit harian **` + "`Rp 40`" + `**.\n\n` +
      `🥷 **2. PENYEIMBANGAN HUKUM PERAMPOKAN (ROBBERY & HEIST REBALANCE)**\n` +
      `Aksi kriminalitas tetap menantang, tetapi waktu tahanan lapas virtual dipotong agar pemain tidak bosan:\n` +
      `• **Peluang Sukses Solo Rob**: Dinaikkan dasar menjadi **` + "`45%`" + `** sukses!\n` +
      `• **Denda Tanpa Linggis (Lockpick)**: Penalti sukses ditekan dari -25% menjadi hanya **` + "`-18%`" + `** (sisa 27% sukses tanpa item, sangat bersahabat!). Dengan item linggis, sukses tetap kokoh di **` + "`60%`" + `**.\n` +
      `• **Masa Tahanan Lapas Solo**: Dikurangi setengahnya dari 30 menit menjadi hanya **` + "`15 menit`" + `**!\n` +
      `• **Uang Tebusan Jaminan Bebas (Bail)**: Dipangkas 50% menjadi hanya **` + "`Rp 250`" + `** koin.\n` +
      `• **Masa Tahanan Heist Bank**: Dipangkas menjadi **` + "`30 menit`" + `** dengan uang tebusan **` + "`Rp 500`" + `**.\n\n` +
      `🐾 **3. KELANGKAAN TRAIT PET & PASIF BARU (PET TRAIT & BUFF UPGRADE)**\n` +
      `Menetaskan telur dan kawin pet menjadi momen yang memuaskan:\n` +
      `• **Peluang Trait Telur Toko (Hatch Egg)**: Naik drastis dari 15% menjadi **` + "`35%`" + `** peluang dapat trait!\n` +
      `• **Peluang Trait Hasil Breeding (Kawin)**: Naik drastis dari 30% menjadi **` + "`50%`" + `** peluang dapat trait!\n` +
      `• **Penyempurnaan Buff Trait**:\n` +
      `  * **MUTANT**: Bonus koin kerja/berburu pet naik menjadi **` + "`+15%`" + `**.\n` +
      `  * **GENIUS**: Kebutuhan target XP naik level dipangkas menjadi **` + "`-20%`" + `** (cepat level tinggi!).\n` +
      `  * **WARRIOR**: Bonus serangan duel PvP Arena naik menjadi **` + "`+15%`" + `**.\n` +
      `  * **STURDY**: *Pasif baru!* Mengurangi laju penurunan status lapar/haus pet sebesar **` + "`40%`" + `** (pet jarang sakit), serta memberikan **` + "`+15% PvP Defense`" + `** di arena duel!\n\n` +
      `🔮 **4. GACHA ROLE LEBIH RAMAH & KASTA DEWA TETAP LANGKA (PRESTIGE GACHA)**\n` +
      `Mengurangi kejenuhan gacha zonk dengan menaikkan peluang menang role:\n` +
      `• **Zonk Rate Gacha**: Diturunkan dari 75% menjadi **` + "`60%`" + `** (peluang menang naik menjadi **` + "`40%`" + `**!).\n` +
      `• **Kasta Role Tetap Eksklusif**: Common ` + "`73%`" + `, Rare ` + "`20%`" + `, Epic ` + "`5.6%`" + `, Legendary ` + "`1.1%`" + `, Mythic ` + "`0.3%`" + ` (Sangat prestisius!).\n` +
      `• **Embed Zonk Humoris**: Ditambahkan deskripsi humor rongsokan saat zonk agar player tetap tertawa terhibur.\n\n` +
      `📈 **5. BURSA SAHAM FULL OTOMATIS & MANDIRI (AUTOMATIC MARKET)**\n` +
      `Saham kini bergerak dinamis tanpa bergantung lagi keaktifan obrolan di channel:\n` +
      `• Harga saham bergerak naik/turun otomatis setiap 2 jam sekali mengikuti siklus model bursa saham nyata (45% naik sehat, 45% turun wajar, 10% siklus ekstrem).\n` +
      `• **Insentif Chat**: Obrolan di channel tetap sangat berharga karena keaktifan chat akan melipatgandakan **Dividen Mingguan** hingga maksimal **` + "`9%`" + `** dari harga saham bagi para pemegang saham channel tersebut!\n\n` +
      `══════════════════════════════════════\n\n` +
      `*Ayo klaim daily-mu harian, ajak pet kesayanganmu bekerja/berburu, kumpulkan koin taruhan, beli linggis di Black Market, dan jadilah sultan bursa saham Kosan 1A sekarang juga! 🦖🔥🐾📈🛡️*`
    )
    .setFooter({ text: 'Sentinel Bot 2026 • Player Happiness & Stock Market Release', iconURL: channel.guild.iconURL({ dynamic: true }) || null })
    .setTimestamp();

  await channel.send({
    embeds: [embed],
    files: [file],
    allowedMentions: { parse: ['everyone'] }
  });

  console.log("✅ Admin Draft Announcement successfully posted!");
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error("Gagal login:", err.message);
  process.exit(1);
});
