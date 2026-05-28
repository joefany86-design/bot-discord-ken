require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ]
});

client.once('ready', async () => {
  console.log(`LoggedIn as ${client.user.tag}`);
  
  for (const [guildId, guild] of client.guilds.cache) {
    console.log(`\n=== GUILD: ${guild.name} (${guildId}) ===`);
    
    console.log("--- ROLES ---");
    const roles = await guild.roles.fetch();
    roles.forEach(role => {
      console.log(`- ${role.name} (${role.id})`);
    });
    
    console.log("--- CHANNELS ---");
    const channels = await guild.channels.fetch();
    channels.forEach(chan => {
      console.log(`- #${chan.name} (${chan.id}) [Type: ${chan.type}]`);
    });
  }
  
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN).catch(e => {
  console.error("Login failed:", e.message);
  process.exit(1);
});
