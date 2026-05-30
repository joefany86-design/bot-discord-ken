const { Client, GatewayIntentBits } = require('discord.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  const channelId = '1509770711839805641';
  const channel = await client.channels.fetch(channelId).catch(err => {
    console.error("Gagal mengambil channel:", err.message);
    process.exit(1);
  });
  
  if (!channel) {
    console.error("Channel tidak ditemukan.");
    process.exit(1);
  }
  
  console.log(`Channel ditemukan: #${channel.name}`);
  
  console.log("Memulai pembersihan (purging) channel...");
  let fetched;
  let totalDeleted = 0;
  do {
    fetched = await channel.messages.fetch({ limit: 100 });
    if (fetched.size > 0) {
      console.log(`Mengambil ${fetched.size} pesan untuk dihapus...`);
      try {
        await channel.bulkDelete(fetched);
        console.log("Bulk delete sukses.");
        totalDeleted += fetched.size;
      } catch (err) {
        console.log("Bulk delete gagal (mungkin ada pesan >14 hari), menghapus satu-persatu...");
        for (const msg of fetched.values()) {
          await msg.delete().catch(e => console.error("Gagal hapus pesan:", e.message));
          totalDeleted++;
          await new Promise(r => setTimeout(r, 800)); // anti rate limit
        }
      }
    }
  } while (fetched.size > 0);
  
  console.log(`✅ Channel bersih! Total pesan dihapus: ${totalDeleted}`);
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error("Gagal login:", err.message);
  process.exit(1);
});
