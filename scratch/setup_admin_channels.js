require('dotenv').config();
const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

// ID Konfigurasi Kosan 1A
const GUILD_ID = '1410239829874053296';
const STAFF_CATEGORY_ID = '1472479634971955221'; // #🔒 STAFF ONLY

// ID Saluran
const ADMIN_BAIK_ID = '1472479761782673621'; // #🫡┃admin-baik
const LOG_CHANNEL_ID = '1473005858853228606'; // #👮┃log-channel
const DONTOL_ID = '1476953592437936291';      // #🔐┃dontol
const TEST_CHANNEL_ID = '1503324994153873458'; // #⚙️┃test

// ID Peran (Roles)
const EVERYONE_ROLE_ID = '1410239829874053296';
const SOVEREIGN_1_ID = '1508835510087581696';   // 👑The Sovereign
const SOVEREIGN_2_ID = '1509229714084987162';   // 👑 The Sovereign
const KOORDINATOR_KOS_ID = '1475356859727614114'; // 📌 Koordinator Kos
const TEKNISI_ID = '1503307301363384320';        // 🪛Teknisi
const CIO_ROLE_ID = '1477641960381743245';       // 🥢🍜‧₊Cio Sobat Indomie

client.once('ready', async () => {
  console.log(`🤖 Login berhasil sebagai ${client.user.tag}`);
  
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    if (!guild) {
      console.error('❌ Guild tidak ditemukan.');
      process.exit(1);
    }
    console.log(`🏠 Menghubungkan ke server: ${guild.name}`);

    // 1. Dapatkan Kategori Staff Only
    const staffCategory = await guild.channels.fetch(STAFF_CATEGORY_ID);
    if (!staffCategory || staffCategory.type !== 4) { // 4 = GuildCategory
      console.error('❌ Kategori STAFF ONLY tidak ditemukan.');
      process.exit(1);
    }

    console.log(`🔒 Mengatur perizinan pada kategori: ${staffCategory.name}`);

    // 2. Set perizinan di Kategori STAFF ONLY
    // - everyone: tidak bisa melihat/masuk
    // - Sovereign/Koordinator/Teknisi/Cio: bisa melihat, mengirim pesan, terhubung, bicara
    await staffCategory.permissionOverwrites.set([
      {
        id: EVERYONE_ROLE_ID,
        deny: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect
        ]
      },
      {
        id: SOVEREIGN_1_ID,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
          PermissionFlagsBits.ManageMessages
        ]
      },
      {
        id: SOVEREIGN_2_ID,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
          PermissionFlagsBits.ManageMessages
        ]
      },
      {
        id: KOORDINATOR_KOS_ID,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak
        ]
      },
      {
        id: TEKNISI_ID,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak
        ]
      },
      {
        id: CIO_ROLE_ID,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak
        ]
      }
    ]);
    console.log('✅ Perizinan Kategori STAFF ONLY (termasuk akses Peran Cio Sobat Indomie) berhasil diperbarui.');

    // 3. Cari dan atur saluran agar masuk ke kategori dan disinkronisasikan perizinannya
    const channelsToSync = [
      { id: ADMIN_BAIK_ID, name: '#🫡┃admin-baik' },
      { id: LOG_CHANNEL_ID, name: '#👮┃log-channel' },
      { id: DONTOL_ID, name: '#🔐┃dontol' },
      { id: TEST_CHANNEL_ID, name: '#⚙️┃test' }
    ];

    for (const item of channelsToSync) {
      try {
        const chan = await guild.channels.fetch(item.id);
        if (chan) {
          console.log(`⚙️ Mengatur saluran ${item.name}...`);
          
          // Pastikan saluran berada di dalam kategori STAFF ONLY
          if (chan.parentId !== STAFF_CATEGORY_ID) {
            await chan.setParent(STAFF_CATEGORY_ID);
            console.log(`   - Kategori induk disetel ke #🔒 STAFF ONLY`);
          }
          
          // Kunci perizinan agar sinkron dengan kategori
          await chan.lockPermissions();
          console.log(`   - Perizinan disinkronkan dengan Kategori induk (STAFF ONLY)`);
        }
      } catch (err) {
        console.error(`❌ Gagal mengatur saluran ${item.name}:`, err.message);
      }
    }

    console.log('\n🌟 SETUP SELESAI! Saluran Staff & Admin serta Cio Sobat Indomie telah rapi dan aman!');
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
