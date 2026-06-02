require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const TARGET_CHANNEL_ID = '1510920596127481988';

const ANNOUNCEMENT_DESCRIPTION = 
  "Halo para majikan tersayang di Kosan 1A! 🐾👋 @everyone\n\n" +
  "Kabar gembira untuk kita semua! Sekarang kamu tidak perlu lagi cemas atau nangis bombay karena peliharaan kesayanganmu mati kelaparan/kehausan ditinggal tidur, sekolah, atau kerja! 😭💔\n\n" +
  "Sentinel Bot kini menghadirkan fitur baru yang super praktis: **🤖 Pet Auto Care (.pet auto-care)**! Teknologi kalung sensor otomatis terbaru yang membuat anabul-mu bisa jajan mandiri saat lapar dan haus! 🍼✨\n\n" +
  "Berikut cara kerja & ketentuannya yang wajib disimak:\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "💸 **1. Cara Mengaktifkan (Unlock Permanen)**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "*   **Menu Dashboard:** Ketik **`.pet`** untuk membuka dashboard utama, lalu klik tombol **`🤖 Auto Care (Rp 5.000)`**.\n" +
  "*   **Perintah Teks:** Ketik langsung **`.pet auto-care`** atau **`.pet autocare`** di channel bot.\n" +
  "*   Cukup bayar **Rp 5.000 koin** dompet sekali saja, dan sensor pintar ini akan terpasang **permanen** pada pet aktif pilihanmu! 🎟️ locked & loaded!\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "🍖💧 **2. Mekanisme Jajan Mandiri (Auto Feed & Drink)**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "Setiap jam decay berlangsung, sensor pintar pada kalung pet akan mendeteksi kebutuhan pet:\n" +
  "*   🍖 **Kelaparan $\\le$ 50%:** Pet otomatis membeli **Pakan Pet Biasa** (**Rp 150** dari dompet majikan) $\rightarrow$ Kenyangan $+30$.\n" +
  "*   💧 **Kehausan $\\le$ 50%:** Pet otomatis membeli **Air Bersih** (**Rp 100** dari dompet majikan) $\rightarrow$ Hidrasi $+35$.\n" +
  "*   👑 *Khusus Pet VIP (`auto_feed = 2`), pemulihan lapar & haus ini tetap **GRATIS 100%** tanpa memotong koin dompet majikan!*\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "⚠️ **DOKTRIN PENTING DARI DOKTER PET!**\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
  "Sensor kalung pintar ini hanya bisa bertransaksi jika **saldo dompet majikan mencukupi**. Jika dompet Anda kering kerontang (Rp 0), pet tidak akan bisa jajan otomatis, statusnya drop ke 0%, dan HP pet akan berkurang hingga pingsan/mati! \n\n" +
  "Jadi, jangan malas menyuruh pet Anda bekerja (**`.pet work`**) atau berburu (**`.pet hunt`**) biar tabungan majikan tetap tebal! 💼💰\n\n" +
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n" +
  "*Yuk, pasang kalung pintar `.pet auto-care` sekarang juga biar anabul kesayanganmu aman sentosa meskipun kamu sedang offline! Selamat bersenang-senang! 🟢🔥🐱🧱*";

client.once('ready', async () => {
  console.log(`🤖 Login sukses sebagai ${client.user.tag}`);
  
  try {
    const channel = await client.channels.fetch(TARGET_CHANNEL_ID);
    if (!channel) {
      console.error('❌ Saluran pengumuman tidak ditemukan.');
      process.exit(1);
    }

    console.log(`📢 Mengirim embed pengumuman ke saluran: #${channel.name}...`);
    
    const embed = new EmbedBuilder()
      .setColor('#2ECC71') // Emerald Green
      .setTitle('🔋 NEW UPDATE: FITUR SENSOR PET AUTO CARE TELAH DIAKTIFKAN! 🤖🐾🍼')
      .setDescription(ANNOUNCEMENT_DESCRIPTION)
      .setThumbnail('https://cdn-icons-png.flaticon.com/512/3047/3047928.png') // Tamagotchi pet icon
      .setTimestamp()
      .setFooter({ text: 'Sentinel Tamagotchi System • Kosan 1A' });

    await channel.send({ content: '@everyone', embeds: [embed] });
    
    console.log('✅ Pengumuman Auto Care berhasil dikirim!');
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
