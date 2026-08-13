require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction]
});

client.once('ready', async () => {
  console.log(`🤖 Bot berhasil login sebagai ${client.user.tag}!`);

  // Daftar channel terkait bot yang akan dihapus
  const targetChannelIds = [
    '1511871380243746826', // Laporan Bank
    '1511871386900103260', // Gaji Harian
    '1511871394210779247', // Pengumuman Server
    '1509480324373942272', // Report Bursa Saham
    '1510230591860113418', // Leaderboard Rich
    '1510232295448117308', // Leaderboard Pet
    '1510240252458176662', // Leaderboard Daily
    '1510474950698602627', // Leaderboard Jail
    '1511017876407058463'  // Leaderboard Thief
  ];

  console.log('🗑️ Memulai pembersihan channel yang terkait dengan bot...');

  for (const chanId of targetChannelIds) {
    try {
      const channel = await client.channels.fetch(chanId).catch(() => null);
      if (channel) {
        await channel.delete('Pembersihan channel terkait sistem bot lama');
        console.log(`✅ Berhasil menghapus channel: #${channel.name} (${chanId})`);
      } else {
        console.log(`⚠️ Channel ${chanId} tidak ditemukan / sudah dihapus.`);
      }
    } catch (err) {
      console.error(`❌ Gagal menghapus channel ${chanId}:`, err.message);
    }
  }

  console.log('✨ Pembersihan channel selesai.');
});

client.login(process.env.DISCORD_TOKEN);
