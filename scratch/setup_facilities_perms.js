require('dotenv').config();
const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

// ID Konfigurasi Kosan 1A
const GUILD_ID = '1410239829874053296';
const FACILITIES_CATEGORY_ID = '1410239831023288451'; // #🍷 FACILITIES :

// ID Saluran Sub-Facilities
const ROOFTOP_ID = '1410239831023288453';         // #🗣┃ rooftop
const MUSIC_ID = '1412089409968537681';            // #🎵┃ music
const PLAYLIST_SULTAN_ID = '1412089554848059392';  // #🎵┃playlist-sultan

// ID Peran (Roles)
const EVERYONE_ROLE_ID = '1410239829874053296';
const BADDIES_ROLE_ID = '1472170290175021193';     // the baddies
const BROS_ROLE_ID = '1472170093416022096';         // the bros

// Admin/Staff Roles
const SOVEREIGN_1_ID = '1508835510087581696';     // 👑The Sovereign
const SOVEREIGN_2_ID = '1509229714084987162';     // 👑 The Sovereign
const KOORDINATOR_KOS_ID = '1475356859727614114';   // 📌 Koordinator Kos
const TEKNISI_ID = '1503307301363384320';          // 🪛Teknisi

client.once('ready', async () => {
  console.log(`🤖 Login berhasil sebagai ${client.user.tag}`);
  
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    if (!guild) {
      console.error('❌ Guild tidak ditemukan.');
      process.exit(1);
    }
    console.log(`🏠 Menghubungkan ke server: ${guild.name}`);

    // 1. Dapatkan Kategori Facilities
    const facilitiesCategory = await guild.channels.fetch(FACILITIES_CATEGORY_ID);
    if (!facilitiesCategory || facilitiesCategory.type !== 4) { // 4 = GuildCategory
      console.error('❌ Kategori FACILITIES tidak ditemukan.');
      process.exit(1);
    }

    console.log(`🔒 Mengatur perizinan pada kategori: ${facilitiesCategory.name}`);

    // 2. Set perizinan di Kategori FACILITIES
    // - everyone: tidak bisa melihat/masuk
    // - the baddies & the bros: bisa melihat, mengirim pesan, masuk voice, bicara
    // - Admin/Staff: tetap memiliki akses penuh
    await facilitiesCategory.permissionOverwrites.set([
      {
        id: EVERYONE_ROLE_ID,
        deny: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect
        ]
      },
      {
        id: BADDIES_ROLE_ID,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
          PermissionFlagsBits.SendMessages
        ]
      },
      {
        id: BROS_ROLE_ID,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
          PermissionFlagsBits.SendMessages
        ]
      },
      {
        id: SOVEREIGN_1_ID,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageMessages
        ]
      },
      {
        id: SOVEREIGN_2_ID,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageMessages
        ]
      },
      {
        id: KOORDINATOR_KOS_ID,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
          PermissionFlagsBits.SendMessages
        ]
      },
      {
        id: TEKNISI_ID,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
          PermissionFlagsBits.SendMessages
        ]
      }
    ]);
    console.log('✅ Perizinan Kategori FACILITIES (akses the baddies & the bros) berhasil diperbarui.');

    // 3. Sinkronisasikan saluran anak agar perizinannya sama dengan kategori FACILITIES
    const channelsToSync = [
      { id: ROOFTOP_ID, name: '#🗣┃ rooftop' },
      { id: MUSIC_ID, name: '#🎵┃ music' },
      { id: PLAYLIST_SULTAN_ID, name: '#🎵┃playlist-sultan' }
    ];

    for (const item of channelsToSync) {
      try {
        const chan = await guild.channels.fetch(item.id);
        if (chan) {
          console.log(`⚙️ Mengatur saluran ${item.name}...`);
          
          // Pastikan saluran berada di dalam kategori induk FACILITIES
          if (chan.parentId !== FACILITIES_CATEGORY_ID) {
            await chan.setParent(FACILITIES_CATEGORY_ID);
            console.log(`   - Kategori induk disetel ke #🍷 FACILITIES :`);
          }
          
          // Kunci perizinan agar sinkron dengan kategori induk
          await chan.lockPermissions();
          console.log(`   - Perizinan disinkronkan dengan Kategori induk FACILITIES`);
        }
      } catch (err) {
        console.error(`❌ Gagal mengatur saluran ${item.name}:`, err.message);
      }
    }

    console.log('\n🌟 SETUP FACILITIES SELESAI! Kategori dan saluran sub-Facilities telah di-lock khusus untuk the baddies, the bros, dan admin!');
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
