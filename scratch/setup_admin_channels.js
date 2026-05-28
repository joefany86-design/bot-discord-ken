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
const LOG_UPGRADE_PROFIL_ID = '1498250377953415168'; // #🖼️┃log-upgrade-profil
const LOG_VOICE_OUT_ID = '1498247701136150708';      // #⬇️┃log-voice-out
const LOG_VOICE_IN_ID = '1498247621121146920';       // #⬆️┃log-voice-in

// ID Peran (Roles)
const EVERYONE_ROLE_ID = '1410239829874053296';
const SOVEREIGN_1_ID = '1508835510087581696';   // 👑The Sovereign
const SOVEREIGN_2_ID = '1509229714084987162';   // 👑 The Sovereign
const MODERATOR_ROLE_ID = '1422645007084687372'; // ⚔️ Moderator
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

    // Fetch all roles to populate cache
    await guild.roles.fetch();

    // 1. Dapatkan Kategori Staff Only
    const staffCategory = await guild.channels.fetch(STAFF_CATEGORY_ID);
    if (!staffCategory || staffCategory.type !== 4) { // 4 = GuildCategory
      console.error('❌ Kategori STAFF ONLY tidak ditemukan.');
      process.exit(1);
    }

    console.log(`🔒 Mengatur perizinan pada kategori: ${staffCategory.name}`);

    // 2. Set perizinan di Kategori STAFF ONLY - EKSKLUSIF ADMIN & MODERATOR
    // - everyone & staff (Koordinator/Teknisi/Cio): tidak bisa melihat/masuk
    // - Sovereign & Moderator: bisa melihat, mengirim pesan, terhubung, bicara, kelola pesan
    const categoryOverwrites = [
      {
        id: EVERYONE_ROLE_ID,
        deny: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect
        ]
      },
      {
        id: KOORDINATOR_KOS_ID,
        deny: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect
        ]
      },
      {
        id: TEKNISI_ID,
        deny: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect
        ]
      },
      {
        id: CIO_ROLE_ID,
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
        id: MODERATOR_ROLE_ID,
        deny: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect
        ]
      }
    ].filter(ow => ow.id === EVERYONE_ROLE_ID || guild.roles.cache.has(ow.id));

    await staffCategory.permissionOverwrites.set(categoryOverwrites);
    console.log('✅ Perizinan Kategori STAFF ONLY berhasil diperbarui.');

    // 3. Cari dan atur saluran agar masuk ke kategori dan disinkronisasikan perizinannya
    const channelsToSync = [
      { id: ADMIN_BAIK_ID, name: '#🫡┃admin-baik' },
      { id: LOG_CHANNEL_ID, name: '#👮┃log-channel' },
      { id: DONTOL_ID, name: '#🔐┃dontol' },
      { id: TEST_CHANNEL_ID, name: '#⚙️┃test' },
      { id: LOG_UPGRADE_PROFIL_ID, name: '#🖼️┃log-upgrade-profil' },
      { id: LOG_VOICE_OUT_ID, name: '#⬇️┃log-voice-out' },
      { id: LOG_VOICE_IN_ID, name: '#⬆️┃log-voice-in' }
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
