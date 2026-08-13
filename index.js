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

client.once('ready', () => {
  console.log(`🤖 Bot berhasil login sebagai ${client.user.tag}!`);
  console.log('⚡ Siap untuk pengembangan sistem baru.');
});

client.login(process.env.DISCORD_TOKEN);
