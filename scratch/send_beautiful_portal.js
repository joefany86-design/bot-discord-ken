require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ]
});

const PORTAL_CHANNEL_ID = '1510121069783023646';

client.once('ready', async () => {
  console.log(`🤖 Login berhasil sebagai ${client.user.tag}`);
  
  try {
    const channel = await client.channels.fetch(PORTAL_CHANNEL_ID);
    if (!channel) {
      console.error('❌ Saluran portal tidak ditemukan.');
      process.exit(1);
    }

    console.log(`🧹 Membersihkan pesan lama di saluran #${channel.name}...`);
    // Ambil dan hapus pesan-pesan lama di channel tersebut agar bersih
    const fetched = await channel.messages.fetch({ limit: 100 });
    for (const msg of fetched.values()) {
      await msg.delete().catch(() => {});
    }
    console.log('✅ Channel berhasil dibersihkan.');

    console.log('📦 Menyiapkan berkas gambar banner...');
    const bannerPath = path.join(__dirname, '../assets/kosan_dashboard_banner.png');
    const attachment = new AttachmentBuilder(bannerPath, { name: 'kosan_dashboard_banner.png' });

    console.log('🎨 Membuat embed portal premium...');
    const embed = new EmbedBuilder()
      .setColor('#7C4DFF') // Vibrant Royal Purple
      .setTitle('🎭 KOSAN 1A ECONOMY & PET DASHBOARD 📈')
      .setDescription(
        `Selamat datang di **Pusat Kontrol Ekonomi & Peliharaan Server Kosan 1A**!\n\n` +
        `Gunakan panel interaktif ini untuk melakukan transaksi ekonomi, investasi, dan merawat hewan peliharaan Anda secara pribadi.\n\n` +
        `🌌 **FITUR UTAMA DASHBOARD:**\n` +
        `▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
        `🛍️ **[ TOKO ROLE PRESTISE ]**\n` +
        `╰ *Tukarkan koin Rupiah Server Anda dengan kasta role prestise server atau uji keberuntungan Anda di Gacha Role.* \n\n` +
        `📈 **[ BURSA SAHAM KOSAN ]**\n` +
        `╰ *Investasikan koin Anda ke saham channel teraktif, pantau portofolio, dan raih keuntungan pasif.* \n\n` +
        `🐾 **[ PUSAT PERAWATAN PET ]**\n` +
        `╰ *Adopsi telur Tamagotchi monster, beri makan, obati saat sakit, ajak bermain, dan suruh bekerja atau PvP Ekspedisi.* \n` +
        `▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n\n` +
        `👉 **Cara Menggunakan:**\n` +
        `Silakan klik salah satu tombol di bawah ini. Menu interaktif akan langsung terbuka secara **privat (ephemeral)** khusus untuk Anda (tidak terlihat oleh orang lain & tidak mengotori chat channel ini).`
      )
      .setImage('attachment://kosan_dashboard_banner.png')
      .setFooter({ text: 'Sentinel Bot • Server Kosan 1A' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('eco_btn_open_shop_private_perm')
        .setLabel('🛍️ Toko Role')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('eco_btn_open_market_private_perm')
        .setLabel('📈 Bursa Saham')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('pet_btn_open_pet_private_perm')
        .setLabel('🐾 Pusat Pet')
        .setStyle(ButtonStyle.Secondary)
    );

    await channel.send({ embeds: [embed], components: [row], files: [attachment] });
    
    console.log('✅ Portal baru yang super premium berhasil dikirim!');
    process.exit(0);

  } catch (err) {
    console.error('❌ Gagal mengirim portal:', err);
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN).catch(e => {
  console.error("Login failed:", e.message);
  process.exit(1);
});
