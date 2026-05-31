const { Client, GatewayIntentBits } = require('discord.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ]
});

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  const channelId = '1509480324373942272';
  const channel = await client.channels.fetch(channelId).catch(err => {
    console.error("Gagal mengambil channel:", err.message);
    process.exit(1);
  });
  
  if (!channel) {
    console.error("Channel tidak ditemukan.");
    process.exit(1);
  }
  
  const guild = channel.guild;
  console.log(`Guild ditemukan: ${guild.name} (ID: ${guild.id})`);
  console.log(`Channel bursa ditemukan: #${channel.name}`);
  
  console.log("Memicu event acak (triggerRandomEvent)...");
  const events = require('../stockmarket/events');
  
  try {
    const result = events.triggerRandomEvent(client, guild);
    console.log("✅ Event berhasil dipicu!");
    console.log("Hasil Event:", result);
    
    // Tunggu 3 detik agar pengiriman pesan selesai sebelum keluar
    setTimeout(() => {
      console.log("Selesai.");
      process.exit(0);
    }, 3000);
  } catch (err) {
    console.error("❌ Gagal memicu event:", err.message);
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error("Gagal login:", err.message);
  process.exit(1);
});
