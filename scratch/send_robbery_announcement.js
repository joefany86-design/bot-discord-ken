require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

// ID Saluran Pengumuman
const ANNOUNCEMENT_CHANNEL_ID = '1509770711839805641';

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
  "🛡️ **2. BATAS MAKSIMAL PERCOBAAN PERSONAL (Robbery Limit)**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "Untuk menghindari tindakan spam/farming target yang sama oleh pelaku yang sama, sistem menerapkan pembatasan target berikut:\n" +
  "*   🛑 **Batas Target Personal (24 Jam)**: Seorang pelaku perampokan maksimal hanya dapat mencoba merampok **target yang sama sebanyak 10 kali** dalam kurun waktu 24 jam.\n" +
  "*   🔒 **Penolakan Otomatis**: Jika pelaku mencoba merampok korban yang sama untuk ke-11 kalinya, perintah `.rob` akan langsung ditolak.\n" +
  "*   🔓 **Batas Target Global Dihapus**: Batas maksimal target global (maksimal dirampok oleh siapapun) telah **dihapus sepenuhnya** agar target bebas dirampok oleh warga lain secara bergantian.\n\n" +
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
