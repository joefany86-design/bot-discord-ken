require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/economy.db');
const db = new Database(dbPath);

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
  console.log(`🤖 Login berhasil sebagai ${client.user.tag}`);
  
  try {
    // 1. Print all settings from database
    const settings = db.prepare("SELECT * FROM ebyus_settings").all();
    console.log('\n--- SETTINGS DATABASE ---');
    console.log(settings);

    // 2. Print all channels in connected guilds
    console.log('\n--- GUILD CHANNELS ---');
    for (const [guildId, guild] of client.guilds.cache) {
      console.log(`\nGuild: ${guild.name} (${guildId})`);
      const channels = await guild.channels.fetch();
      for (const [channelId, channel] of channels) {
        if (channel) {
          console.log(`- #${channel.name} (${channelId}) [Type: ${channel.type}]`);
        }
      }
    }
  } catch (err) {
    console.error('Error fetching data:', err);
  }
  
  db.close();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN).catch(e => {
  console.error("Login gagal:", e.message);
  process.exit(1);
});
