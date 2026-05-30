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
        `Klik tombol di bawah ini untuk membuka panel secara **Pribadi** (Hanya Anda yang dapat melihatnya):\n\n` +
        `🛍️ **Toko Role** — Beli kasta role prestise & gacha.\n` +
        `📈 **Bursa Saham** — Investasi saham channel server.\n` +
        `🏦 **Bank Sentral** — Simpan uang (tabungan) & pinjam koin.\n` +
        `🐾 **Pusat Pet** — Adopsi, rawat, & main dengan pet Anda.\n` +
        `🕵️‍♂️ **Pasar Gelap** — Beli perlengkapan aksi kriminal (rob).`
      )
      .setImage('attachment://kosan_dashboard_banner.png')
      .setFooter({ text: 'Sentinel Bot • Server Kosan 1A' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('eco_btn_open_shop_private_perm')
        .setLabel('🛍️ Toko')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('eco_btn_open_market_private_perm')
        .setLabel('📈 Saham')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('eco_btn_open_bank_private_perm')
        .setLabel('🏦 Bank')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('pet_btn_open_pet_private_perm')
        .setLabel('🐾 Pet')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('eco_btn_open_bm_private_perm')
        .setLabel('🕵️‍♂️ BM')
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
