require('dotenv').config();
const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

// ID Konfigurasi Kosan 1A
const GUILD_ID = '1410239829874053296';

// ID Saluran Suara yang Ingin Dibuka
const CHANNELS_TO_OPEN = [
  { id: '1481645948156379136', name: '#🍿┃ chill-room' },
  { id: '1472252356472209418', name: '#🎮┃ games-room' },
  { id: '1492457470860197989', name: '#📱┃ mole' },
  { id: '1492839911684833380', name: '#🖥️┃ PC-games' }
];

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

    for (const item of CHANNELS_TO_OPEN) {
      try {
        const chan = await guild.channels.fetch(item.id);
        if (chan) {
          console.log(`🔓 Membuka saluran suara ${item.name} untuk the baddies & the bros...`);
          
          // Edit overwrites: tambahkan the baddies dan the bros dengan izin Connect, Speak, ViewChannel, & SendMessages
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

          console.log(`   ✅ Saluran ${item.name} berhasil dibuka.`);
        }
      } catch (err) {
        console.error(`❌ Gagal membuka saluran ${item.name}:`, err.message);
      }
    }

    console.log('\n🌟 SETUP BERHASIL! Saluran chill-room, games-room, mole, dan PC-games telah dibuka untuk the baddies & the bros!');
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
