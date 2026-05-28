require('dotenv').config();
const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

// ID Konfigurasi Kosan 1A
const GUILD_ID = '1410239829874053296';
const CREATOR_CHANNEL_ID = '1479718193323966635'; // #➕ Creator Channel

// ID Peran (Roles) yang Diberikan Akses
const BADDIES_ROLE_ID = '1472170290175021193'; // the baddies
const BROS_ROLE_ID = '1472170093416022096';     // the bros

client.once('ready', async () => {
  console.log(`🤖 Login berhasil sebagai ${client.user.tag}`);
  
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    if (!guild) {
      console.error('❌ Guild tidak ditemukan.');
      process.exit(1);
    }
    console.log(`🏠 Menghubungkan ke server: ${guild.name}`);

    const chan = await guild.channels.fetch(CREATOR_CHANNEL_ID);
    if (chan) {
      console.log(`🔓 Membuka saluran suara #➕ Creator Channel untuk the baddies & the bros...`);
      
      await chan.permissionOverwrites.edit(BADDIES_ROLE_ID, {
        ViewChannel: true,
        Connect: true,
        Speak: true,
        SendMessages: true
      });

      await chan.permissionOverwrites.edit(BROS_ROLE_ID, {
        ViewChannel: true,
        Connect: true,
        Speak: true,
        SendMessages: true
      });

      console.log(`   ✅ Saluran #➕ Creator Channel berhasil dibuka.`);
    }

    console.log('\n🌟 SETUP BERHASIL! Saluran Creator Channel telah dibuka untuk the baddies & the bros!');
    process.exit(0);

  } catch (err) {
    console.error('❌ Terjadi kesalahan fatal:', err);
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN).catch(e => {
  console.error("Login failed:", e.message);
  process.exit(1);
});
