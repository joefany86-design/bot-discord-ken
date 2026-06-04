require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

// ID Saluran Pengumuman
const ANNOUNCEMENT_CHANNEL_ID = process.env.ANNOUNCEMENT_CHANNEL_ID || '1511871394210779247';

const ANNOUNCEMENT_DESCRIPTION = "Halo @everyone! 👋✨\n\n" +
  "Hari ini kami merilis pembaruan regulasi pada **Sistem Perampokan Solo (.rob)** demi menciptakan keseimbangan ekonomi server yang lebih sehat, kompetitif, dan adil! ⚖️💰\n\n" +
  "Berikut adalah poin-poin penting perubahan yang telah aktif saat ini:\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "👑 **1. KEKEBALAN DIPLOMATIS KERAJAAN (Sultan/Owner Bypass)**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "Warga dilarang keras mencoba merampok **Sultan** (Owner Utama) yang dilindungi oleh **Kekebalan Diplomatis Kerajaan**.\n" +
  "*   💸 **Denda Penyitaan**: Setiap percobaan tindakan lancang akan dikenakan denda sebesar **Rp 10.000** (disita langsung oleh Kas Negara).\n" +
  "*   🔒 **Hukuman Sel Khusus**: Pelaku perampokan akan langsung dijebloskan ke **Sel Khusus Kerajaan selama 10 Jam** tanpa ampun!\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "🛡️ **2. BATAS MAKSIMAL TARGET PERAMPOKAN (Anti-Griefing Protection)**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "Untuk menghindari eksploitasi perampokan beruntun pada satu korban pasif, sistem menerapkan pembatasan target:\n" +
  "*   🛑 **Batas 24 Jam**: Seorang warga hanya dapat dijadikan target perampokan (baik sukses maupun gagal) maksimal **10 kali dalam kurun waktu 24 jam**.\n" +
  "*   🔒 **Perlindungan Otomatis**: Jika seorang warga sudah diserang 10 kali, upaya perampokan berikutnya dari siapapun akan **otomatis diblokir oleh sistem** dengan pemberitahuan penolakan.\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "🎨 **3. DESAIN VISUAL NOTIFIKASI PREMIUM**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "*   Seluruh embed kegagalan perampokan Sultan, laporan regulasi ekonomi global, dan penalti bank telah didesain ulang menggunakan warna premium (*Imperial Gold*) dan struktur emoji yang rapi agar lebih eksklusif.\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
  "💡 *Saran Finansial*: Tetap waspada, tingkatkan keamanan kamar kosan Anda (seperti membeli upgrade Gembok, Alarm, dan CCTV), dan simpan kelebihan koin Anda di Bank agar aman dari incaran perampok!\n\n" +
  "Selamat bermain dan mari ciptakan simulasi ekonomi yang sportif! 🎲 Kosan 1A Finance ✨";

client.once('ready', async () => {
  console.log(`🤖 Login berhasil sebagai ${client.user.tag}`);
  
  try {
    const channel = await client.channels.fetch(ANNOUNCEMENT_CHANNEL_ID);
    if (!channel) {
      console.error('❌ Saluran pengumuman tidak ditemukan.');
      process.exit(1);
    }

    console.log(`📢 Membuat dan mengirim embed pengumuman ke saluran: #${channel.name}...`);
    
    const embed = new EmbedBuilder()
      .setColor('#D4AF37') // Imperial Gold Color
      .setTitle('📢 UPDATE SENTINEL: REGULASI BARU & KEKEBALAN DIPLOMATIS PERAMPOKAN (.rob) 🚨🗡️')
      .setDescription(ANNOUNCEMENT_DESCRIPTION)
      .setTimestamp()
      .setFooter({ text: 'Sentinel Bot • Pembaruan Sistem Keamanan & Keadilan Ekonomi' });

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
