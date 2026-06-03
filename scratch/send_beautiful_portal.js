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
      .setTitle('🎮 SENTINEL PORTAL HUB — PUSAT KONTROL UTAMA')
      .setDescription(
        `Klik tombol di bawah ini untuk membuka panel secara **Pribadi/Private** (Hanya Anda yang dapat melihatnya):\n\n` +
        `🛍️ **Toko Role** — Beli kasta role prestise & gacha.\n` +
        `📈 **Bursa Saham** — Investasi saham channel server.\n` +
        `🏦 **Bank Sentral** — Simpan uang (tabungan) & pinjam koin.\n` +
        `🕵️‍♂️ **Black Market** — Beli perlengkapan aksi kriminal (rob).\n` +
        `🎒 **Inventory Saya** — Lihat peralatan & barang mewah.\n\n` +
        `🐾 **Kandang Pet** — Adopsi, rawat, & main dengan pet Anda.\n` +
        `🛍️ **Toko Pet** — Beli pakan, obat, soda, sabun, & jimat pet.\n` +
        `🛌 **Sewa Kosan** — Sewa kamar kos & upgrade fasilitas.\n` +
        `🌱 **Cozy Garden** — Menanam bunga & berkebun cozy.\n` +
        `📋 **Misi Harian Kosan 1A** — Selesaikan misi harian untuk koin & barang.\n\n` +
        `🎰 **Gacha Pet** — Dapatkan pet acak (Common s/d Mythic).\n` +
        `✨ **Upgrade Bintang** — Gabungkan pet duplikat untuk memperkuat status.\n` +
        `🎟️ **Lotre Mingguan** — Beli tiket lotre mingguan berhadiah pool besar.`
      )
      .setImage('attachment://kosan_dashboard_banner.png')
      .setFooter({ text: 'Sentinel Bot • Server Kosan 1A' })
      .setTimestamp();

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('eco_btn_open_shop_private_perm').setLabel('🛍️ Toko Role').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('eco_btn_open_market_private_perm').setLabel('📈 Bursa Saham').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('eco_btn_open_bank_private_perm').setLabel('🏦 Bank Sentral').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('eco_btn_open_bm_private_perm').setLabel('🕵️‍♂️ Black Market').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('eco_btn_open_inventory_private_perm').setLabel('🎒 Inventory Saya').setStyle(ButtonStyle.Success)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('pet_btn_open_pet_private_perm').setLabel('🐾 Kandang Pet').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('pet_btn_open_shop_private_perm').setLabel('🛍️ Toko Pet').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('eco_btn_open_kos_private_perm').setLabel('🛌 Sewa Kosan').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('eco_btn_open_garden_private_perm').setLabel('🌱 Cozy Garden').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('pet_btn_open_quests_private_perm').setLabel('📋 Misi Harian Kosan 1A').setStyle(ButtonStyle.Primary)
    );

    const row3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('pet_btn_gacha_hub').setLabel('🎰 Gacha Pet').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('pet_btn_upgrade_hub').setLabel('✨ Upgrade Bintang Pet').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('eco_btn_lottery_hub').setLabel('🎟️ Lotre Mingguan').setStyle(ButtonStyle.Success)
    );

    await channel.send({ embeds: [embed], components: [row1, row2, row3], files: [attachment] });
    
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
