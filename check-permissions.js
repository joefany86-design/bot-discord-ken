const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
  ] 
});

const GUILD_ID = '1410239829874053296'; // From deploy-commands.js

client.once('ready', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}!`);
  console.log('Fetching channels and permissions...');

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const channels = await guild.channels.fetch();
    const roles = await guild.roles.fetch();
    
    let report = `=== PERMISSION REPORT FOR ${guild.name} ===\n\n`;

    channels.forEach(channel => {
      if (!channel) return;
      
      report += `[${channel.type === 0 ? 'TEXT' : channel.type === 2 ? 'VOICE' : channel.type === 4 ? 'CATEGORY' : 'OTHER'}] ${channel.name} (${channel.id})\n`;
      
      if (channel.permissionOverwrites && channel.permissionOverwrites.cache.size > 0) {
        channel.permissionOverwrites.cache.forEach(overwrite => {
          const isRole = overwrite.type === 0;
          let targetName = 'Unknown';
          
          if (isRole) {
            const role = roles.get(overwrite.id);
            targetName = role ? `@${role.name}` : `Role ID: ${overwrite.id}`;
          } else {
            targetName = `User ID: ${overwrite.id}`;
          }

          const allowed = overwrite.allow.toArray().join(', ') || 'None';
          const denied = overwrite.deny.toArray().join(', ') || 'None';
          
          report += `  -> ${targetName}:\n`;
          report += `       Allowed: ${allowed}\n`;
          report += `       Denied:  ${denied}\n`;
        });
      } else {
        report += `  -> No specific permission overwrites (Syncs with Category/Guild Default)\n`;
      }
      report += '\n';
    });

    const fs = require('fs');
    fs.writeFileSync('permissions_report.txt', report);
    console.log('✅ Report saved to permissions_report.txt');
    
  } catch (error) {
    console.error('Error fetching data:', error);
  } finally {
    client.destroy();
  }
});

client.login(process.env.DISCORD_TOKEN);
