require('dotenv').config();
const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

// ID Konfigurasi Kosan 1A
const GUILD_ID = '1410239829874053296';

// ==========================================
// 1. DAFTAR ID SALURAN & KATEGORI KHUSUS
// ==========================================
const STAFF_CATEGORY_ID = '1472479634971955221'; // #🔒 STAFF ONLY
const ADMIN_BAIK_ID = '1472479761782673621'; // #🫡┃admin-baik
const LOG_CHANNEL_ID = '1473005858853228606'; // #👮┃log-channel
const DONTOL_ID = '1476953592437936291';      // #🔐┃dontol
const TEST_CHANNEL_ID = '1503324994153873458'; // #⚙️┃test
const LOG_UPGRADE_PROFIL_ID = '1498250377953415168'; // #🖼️┃log-upgrade-profil
const LOG_VOICE_OUT_ID = '1498247701136150708';      // #⬇️┃log-voice-out
const LOG_VOICE_IN_ID = '1498247621121146920';       // #⬆️┃log-voice-in

// Kategori & Sub-Saluran Facilities
const FACILITIES_CATEGORY_ID = '1410239831023288451'; // #🍷 FACILITIES :
const ROOFTOP_ID = '1410239831023288453';             // #🗣┃ rooftop
const MUSIC_ID = '1412089409968537681';                // #🎵┃ music
const PLAYLIST_SULTAN_ID = '1412089554848059392';      // #🎵┃playlist-sultan

// Peran (Roles) Khusus Baddies & Bros
const BADDIES_ROLE_ID = '1472170290175021193';         // the baddies
const BROS_ROLE_ID = '1472170093416022096';             // the bros

const EXCLUDED_CHANNELS = [
  '1422642678004187287', // #👋┃welcome
  '1472197966218395751', // #🗝️┃verification-desk
  '1472237912681742366', // #📝┃house-rules
  '1478566460124041428', // #📢┃announcements
  '1502284070925766666', // #👋┃goodbye
  STAFF_CATEGORY_ID,
  ADMIN_BAIK_ID,
  LOG_CHANNEL_ID,
  DONTOL_ID,
  TEST_CHANNEL_ID,
  LOG_UPGRADE_PROFIL_ID,
  LOG_VOICE_OUT_ID,
  LOG_VOICE_IN_ID,
  '1479813891923120161',
  '1459481132423843881',
  '1475676669254565988',
  '1479718196469563423',
  FACILITIES_CATEGORY_ID,
  ROOFTOP_ID,
  MUSIC_ID,
  PLAYLIST_SULTAN_ID,
  '1481645948156379136', // #🍿┃ chill-room
  '1472252356472209418', // #🎮┃ games-room
  '1492457470860197989', // #📱┃ mole
  '1492839911684833380', // #🖥️┃ PC-games
  '1479718193323966635',
  '1475674570567712900',
  '1475674574967410730',
  '1475674579245727855'
];

const READ_ONLY_CHANNELS_LIST = [
  '1479813891923120161',
  '1459481132423843881',
  '1475676669254565988',
  '1479718196469563423'
];

const OPEN_CHANNELS_LIST = [
  '1481645948156379136', // #🍿┃ chill-room
  '1472252356472209418', // #🎮┃ games-room
  '1492457470860197989', // #📱┃ mole
  '1492839911684833380', // #🖥️┃ PC-games
  '1479718193323966635'
];

const RESTRICTED_CHANNELS_LIST = [
  '1475674570567712900',
  '1475674574967410730',
  '1475674579245727855'
];

// ==========================================
// 2. DAFTAR ID PERAN (ROLES)
// ==========================================
const EVERYONE_ROLE_ID = '1410239829874053296';
const SOVEREIGN_1_ID = '1508835510087581696';   // 👑The Sovereign
const SOVEREIGN_2_ID = '1509229714084987162';   // 👑 The Sovereign
const MODERATOR_ROLE_ID = '1422645007084687372'; // ⚔️ Moderator
const KOORDINATOR_KOS_ID = '1475356859727614114'; // 📌 Koordinator Kos
const TEKNISI_ID = '1503307301363384320';        // 🪛Teknisi
const CIO_ROLE_ID = '1477641960381743245';       // 🥢🍜‧₊Cio Sobat Indomie

// Peran Prestige Tingkatan (Rarity Roles)
const RARE_ELITE_ID = '1509202469828165904';    // 🥈 Rare Elite
const EPIC_CHAMPION_ID = '1509202471803813990'; // 🥇 Epic Champion
const PRIMORDIAL_ID = '1508836141019955301';    // 🔮 Primordial
const LEGENDARY_ID = '1509202474416865482';     // 👑 Legendary Overlord
const ZENITH_ID = '1508836447229050980';        // 🌟 Zenith
const MYTHIC_ID = '1509203784230768860';        // 🌟 Mythic Immortal
const AETHELGARD_ID = '1508835994630230106';    // ✨ Aethelgard

client.once('ready', async () => {
  console.log(`🤖 Login berhasil sebagai ${client.user.tag}`);
  
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    if (!guild) {
      console.error('❌ Guild tidak ditemukan.');
      process.exit(1);
    }
    console.log(`🏠 Terkoneksi ke server: ${guild.name}`);

    // Fetch all roles to populate cache
    await guild.roles.fetch();

    // ===================================================
    // FASE 1: KONFIGURASI STAFF ONLY & ADMIN CHANNELS
    // ===================================================
    console.log('\n--- FASE 1: KONFIGURASI SALURAN STAFF & ADMIN ---');
    const staffCategory = await guild.channels.fetch(STAFF_CATEGORY_ID);
    if (staffCategory && staffCategory.type === 4) {
      console.log(`🔒 Mengatur perizinan pada kategori: ${staffCategory.name}`);
      
      const categoryOverwrites = [
        {
          id: EVERYONE_ROLE_ID,
          deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]
        },
        {
          id: KOORDINATOR_KOS_ID,
          deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]
        },
        {
          id: TEKNISI_ID,
          deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]
        },
        {
          id: CIO_ROLE_ID,
          deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]
        },
        {
          id: SOVEREIGN_1_ID,
          allow: [
            PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.ManageMessages
          ]
        },
        {
          id: SOVEREIGN_2_ID,
          allow: [
            PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.ManageMessages
          ]
        },
        {
          id: MODERATOR_ROLE_ID,
          deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]
        }
      ].filter(ow => ow.id === EVERYONE_ROLE_ID || guild.roles.cache.has(ow.id));

      await staffCategory.permissionOverwrites.set(categoryOverwrites);
      console.log('   ✅ Perizinan Kategori STAFF ONLY (Eksklusif Admin) berhasil diperbarui.');

      const staffSubChannels = [
        ADMIN_BAIK_ID,
        LOG_CHANNEL_ID,
        DONTOL_ID,
        TEST_CHANNEL_ID,
        LOG_UPGRADE_PROFIL_ID,
        LOG_VOICE_OUT_ID,
        LOG_VOICE_IN_ID
      ];
      for (const id of staffSubChannels) {
        try {
          const chan = await guild.channels.fetch(id);
          if (chan) {
            if (chan.parentId !== STAFF_CATEGORY_ID) await chan.setParent(STAFF_CATEGORY_ID);
            await chan.lockPermissions();
            console.log(`   ✅ Saluran ${chan.name} disinkronkan ke STAFF ONLY.`);
          }
        } catch (e) {
          console.error(`   ❌ Gagal mensinkronkan ID ${id}: ${e.message}`);
        }
      }
    }

    // ===================================================
    // FASE 2: SINKRONISASI SALURAN LAIN SESUAI KASTA REALITI
    // ===================================================
    console.log('\n--- FASE 2: SINKRONISASI SALURAN UMUM SESUAI KASTA REALITI ---');
    const allChannels = await guild.channels.fetch();
    
    let textSynced = 0;
    let voiceSynced = 0;

    for (const [id, chan] of allChannels) {
      // Lewati saluran yang dikecualikan (onboarding & staff channels)
      if (EXCLUDED_CHANNELS.includes(id)) continue;

      // PENTING: Cek isVoiceBased() terlebih dahulu, karena voice channel modern juga mengembalikan true untuk isTextBased()
      try {
        if (chan.isVoiceBased()) {
          console.log(`🔊 Sinkronisasi Saluran Suara: #${chan.name}`);

          await chan.permissionOverwrites.set([
            // 1. Lock down everyone secara total dari masuk/bicara
            {
              id: EVERYONE_ROLE_ID,
              deny: [
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak,
                PermissionFlagsBits.PrioritySpeaker,
                PermissionFlagsBits.UseSoundboard,
                PermissionFlagsBits.UseExternalSounds,
                PermissionFlagsBits.MoveMembers,
                PermissionFlagsBits.MuteMembers,
                PermissionFlagsBits.DeafenMembers
              ]
            },
            // 2. Primordial mendapatkan izin Connect & Speak dasar
            {
              id: PRIMORDIAL_ID,
              allow: [
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak
              ]
            },
            // 3. Legendary Overlord mendapatkan Priority Speaker & Soundboard
            {
              id: LEGENDARY_ID,
              allow: [
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak,
                PermissionFlagsBits.PrioritySpeaker,
                PermissionFlagsBits.UseSoundboard,
                PermissionFlagsBits.UseExternalSounds
              ]
            },
            // 4. Zenith mendapatkan izin memindahkan anggota (Move Members)
            {
              id: ZENITH_ID,
              allow: [
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak,
                PermissionFlagsBits.PrioritySpeaker,
                PermissionFlagsBits.UseSoundboard,
                PermissionFlagsBits.UseExternalSounds,
                PermissionFlagsBits.MoveMembers
              ]
            },
            // 5. Mythic Immortal mendapatkan izin membisukan anggota (Mute Members)
            {
              id: MYTHIC_ID,
              allow: [
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak,
                PermissionFlagsBits.PrioritySpeaker,
                PermissionFlagsBits.UseSoundboard,
                PermissionFlagsBits.UseExternalSounds,
                PermissionFlagsBits.MoveMembers,
                PermissionFlagsBits.MuteMembers
              ]
            },
            // 6. Aethelgard mendapatkan izin menulikan anggota (Deafen Members)
            {
              id: AETHELGARD_ID,
              allow: [
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak,
                PermissionFlagsBits.PrioritySpeaker,
                PermissionFlagsBits.UseSoundboard,
                PermissionFlagsBits.UseExternalSounds,
                PermissionFlagsBits.MoveMembers,
                PermissionFlagsBits.MuteMembers,
                PermissionFlagsBits.DeafenMembers
              ]
            },
            // 7. Sovereign 1 memiliki hak suara & moderasi suara penuh
            {
              id: SOVEREIGN_1_ID,
              allow: [
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak,
                PermissionFlagsBits.PrioritySpeaker,
                PermissionFlagsBits.UseSoundboard,
                PermissionFlagsBits.UseExternalSounds,
                PermissionFlagsBits.MoveMembers,
                PermissionFlagsBits.MuteMembers,
                PermissionFlagsBits.DeafenMembers
              ]
            },
            // 8. Sovereign 2 memiliki hak suara & moderasi suara penuh
            {
              id: SOVEREIGN_2_ID,
              allow: [
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak,
                PermissionFlagsBits.PrioritySpeaker,
                PermissionFlagsBits.UseSoundboard,
                PermissionFlagsBits.UseExternalSounds,
                PermissionFlagsBits.MoveMembers,
                PermissionFlagsBits.MuteMembers,
                PermissionFlagsBits.DeafenMembers
              ]
            },
            // 9. Moderator memiliki hak suara & moderasi suara penuh
            {
              id: MODERATOR_ROLE_ID,
              allow: [
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak,
                PermissionFlagsBits.PrioritySpeaker,
                PermissionFlagsBits.UseSoundboard,
                PermissionFlagsBits.UseExternalSounds,
                PermissionFlagsBits.MoveMembers,
                PermissionFlagsBits.MuteMembers,
                PermissionFlagsBits.DeafenMembers
              ]
            }
          ]);
          voiceSynced++;
        } 
        else if (chan.isTextBased()) {
          console.log(`📝 Sinkronisasi Saluran Teks: #${chan.name}`);
          
          await chan.permissionOverwrites.set([
            // 1. Lock down everyone dari stiker, emoji eksternal, thread, & link
            {
              id: EVERYONE_ROLE_ID,
              deny: [
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.UseExternalEmojis,
                PermissionFlagsBits.UseExternalStickers,
                PermissionFlagsBits.CreatePublicThreads,
                PermissionFlagsBits.CreatePrivateThreads
              ]
            },
            // 2. Rare Elite ke atas diizinkan menggunakan Link, File, dan Emoji Eksternal
            {
              id: RARE_ELITE_ID,
              allow: [
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.UseExternalEmojis
              ]
            },
            // 3. Epic Champion ke atas diizinkan menggunakan Stiker & Thread
            {
              id: EPIC_CHAMPION_ID,
              allow: [
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.UseExternalEmojis,
                PermissionFlagsBits.UseExternalStickers,
                PermissionFlagsBits.CreatePublicThreads,
                PermissionFlagsBits.CreatePrivateThreads
              ]
            },
            // 4. Sovereign 1 memiliki kontrol moderasi chat
            {
              id: SOVEREIGN_1_ID,
              allow: [
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.UseExternalEmojis,
                PermissionFlagsBits.UseExternalStickers,
                PermissionFlagsBits.CreatePublicThreads,
                PermissionFlagsBits.CreatePrivateThreads,
                PermissionFlagsBits.ManageMessages
              ]
            },
            // 5. Sovereign 2 memiliki kontrol moderasi chat
            {
              id: SOVEREIGN_2_ID,
              allow: [
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.UseExternalEmojis,
                PermissionFlagsBits.UseExternalStickers,
                PermissionFlagsBits.CreatePublicThreads,
                PermissionFlagsBits.CreatePrivateThreads,
                PermissionFlagsBits.ManageMessages
              ]
            },
            // 6. Moderator memiliki kontrol moderasi chat
            {
              id: MODERATOR_ROLE_ID,
              allow: [
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.UseExternalEmojis,
                PermissionFlagsBits.UseExternalStickers,
                PermissionFlagsBits.CreatePublicThreads,
                PermissionFlagsBits.CreatePrivateThreads,
                PermissionFlagsBits.ManageMessages
              ]
            }
          ]);
          textSynced++;
        }
      } catch (e) {
        console.error(`⚠️ Gagal menyinkronkan saluran #${chan.name}: ${e.message}`);
      }
    }

    // ===================================================
    // FASE 3: SINKRONISASI SALURAN BACA SAJA (READ-ONLY CHANNELS)
    // ===================================================
    console.log('\n--- FASE 3: SINKRONISASI SALURAN BACA SAJA (READ-ONLY) ---');
    for (const id of READ_ONLY_CHANNELS_LIST) {
      try {
        const chan = await guild.channels.fetch(id);
        if (chan) {
          console.log(`🔒 Mengatur perizinan baca saja pada saluran: #${chan.name}`);
          
          const readOnlyOverwrites = [
            {
              id: EVERYONE_ROLE_ID,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
              deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.CreatePrivateThreads, PermissionFlagsBits.SendMessagesInThreads]
            },
            {
              id: KOORDINATOR_KOS_ID,
              deny: [PermissionFlagsBits.SendMessages]
            },
            {
              id: TEKNISI_ID,
              deny: [PermissionFlagsBits.SendMessages]
            },
            {
              id: CIO_ROLE_ID,
              deny: [PermissionFlagsBits.SendMessages]
            },
            {
              id: RARE_ELITE_ID,
              deny: [PermissionFlagsBits.SendMessages]
            },
            {
              id: EPIC_CHAMPION_ID,
              deny: [PermissionFlagsBits.SendMessages]
            },
            {
              id: PRIMORDIAL_ID,
              deny: [PermissionFlagsBits.SendMessages]
            },
            {
              id: LEGENDARY_ID,
              deny: [PermissionFlagsBits.SendMessages]
            },
            {
              id: ZENITH_ID,
              deny: [PermissionFlagsBits.SendMessages]
            },
            {
              id: MYTHIC_ID,
              deny: [PermissionFlagsBits.SendMessages]
            },
            {
              id: AETHELGARD_ID,
              deny: [PermissionFlagsBits.SendMessages]
            },
            {
              id: SOVEREIGN_1_ID,
              allow: [
                PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.ReadMessageHistory
              ]
            },
            {
              id: SOVEREIGN_2_ID,
              allow: [
                PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.ReadMessageHistory
              ]
            },
            {
              id: MODERATOR_ROLE_ID,
              deny: [PermissionFlagsBits.SendMessages]
            }
          ].filter(ow => ow.id === EVERYONE_ROLE_ID || guild.roles.cache.has(ow.id));

          await chan.permissionOverwrites.set(readOnlyOverwrites);
          console.log(`   ✅ Saluran #${chan.name} disinkronkan menjadi baca-saja.`);
        }
      } catch (err) {
        console.error(`   ❌ Gagal mengatur saluran baca-saja ID ${id}: ${err.message}`);
      }
    }

    // ===================================================
    // FASE 4: SINKRONISASI KATEGORI & SALURAN FACILITIES (BADDIES & BROS JOIN ACCESS)
    // ===================================================
    console.log('\n--- FASE 4: SINKRONISASI KATEGORI & SALURAN FACILITIES ---');
    try {
      const facilitiesCategory = await guild.channels.fetch(FACILITIES_CATEGORY_ID);
      if (facilitiesCategory && facilitiesCategory.type === 4) {
        console.log(`🔒 Mengatur perizinan pada kategori FACILITIES: ${facilitiesCategory.name}`);
        
        const facilitiesOverwrites = [
          {
            id: EVERYONE_ROLE_ID,
            deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]
          },
          {
            id: BADDIES_ROLE_ID,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.SendMessages]
          },
          {
            id: BROS_ROLE_ID,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.SendMessages]
          },
          {
            id: SOVEREIGN_1_ID,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages]
          },
          {
            id: SOVEREIGN_2_ID,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages]
          },
          {
            id: MODERATOR_ROLE_ID,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages]
          },
          {
            id: KOORDINATOR_KOS_ID,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.SendMessages]
          },
          {
            id: TEKNISI_ID,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.SendMessages]
          }
        ].filter(ow => ow.id === EVERYONE_ROLE_ID || guild.roles.cache.has(ow.id));

        await facilitiesCategory.permissionOverwrites.set(facilitiesOverwrites);
        console.log('   ✅ Perizinan Kategori FACILITIES (akses the baddies & the bros) berhasil diperbarui.');

        const facilitiesChannels = [
          { id: ROOFTOP_ID, name: '#🗣┃ rooftop' },
          { id: MUSIC_ID, name: '#🎵┃ music' },
          { id: PLAYLIST_SULTAN_ID, name: '#🎵┃playlist-sultan' }
        ];

        for (const item of facilitiesChannels) {
          try {
            const chan = await guild.channels.fetch(item.id);
            if (chan) {
              if (chan.parentId !== FACILITIES_CATEGORY_ID) await chan.setParent(FACILITIES_CATEGORY_ID);
              await chan.lockPermissions();
              console.log(`   ✅ Saluran ${item.name} disinkronkan ke Kategori FACILITIES.`);
            }
          } catch (e) {
            console.error(`   ❌ Gagal mensinkronkan saluran ${item.name}: ${e.message}`);
          }
        }
      }
    } catch (err) {
      console.error('❌ Gagal mengonfigurasi kategori FACILITIES:', err.message);
    }

    // ===================================================
    // FASE 5: SINKRONISASI SALURAN SUARA TERBUKA (OPEN CHANNELS FOR BADDIES & BROS)
    // ===================================================
    for (const id of OPEN_CHANNELS_LIST) {
      try {
        const chan = await guild.channels.fetch(id);
        if (chan) {
          console.log(`🔓 Mengatur saluran terbuka: #${chan.name} (${chan.isVoiceBased() ? 'Voice' : 'Text'})`);
          
          let openOverwrites = [];
          if (chan.isVoiceBased()) {
            openOverwrites = [
              {
                id: EVERYONE_ROLE_ID,
                deny: [
                  PermissionFlagsBits.Connect,
                  PermissionFlagsBits.Speak,
                  PermissionFlagsBits.PrioritySpeaker,
                  PermissionFlagsBits.UseSoundboard,
                  PermissionFlagsBits.UseExternalSounds,
                  PermissionFlagsBits.MoveMembers,
                  PermissionFlagsBits.MuteMembers,
                  PermissionFlagsBits.DeafenMembers
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
                id: PRIMORDIAL_ID,
                allow: [
                  PermissionFlagsBits.Connect,
                  PermissionFlagsBits.Speak
                ]
              },
              {
                id: LEGENDARY_ID,
                allow: [
                  PermissionFlagsBits.Connect,
                  PermissionFlagsBits.Speak,
                  PermissionFlagsBits.PrioritySpeaker,
                  PermissionFlagsBits.UseSoundboard,
                  PermissionFlagsBits.UseExternalSounds
                ]
              },
              {
                id: ZENITH_ID,
                allow: [
                  PermissionFlagsBits.Connect,
                  PermissionFlagsBits.Speak,
                  PermissionFlagsBits.PrioritySpeaker,
                  PermissionFlagsBits.UseSoundboard,
                  PermissionFlagsBits.UseExternalSounds,
                  PermissionFlagsBits.MoveMembers
                ]
              },
              {
                id: MYTHIC_ID,
                allow: [
                  PermissionFlagsBits.Connect,
                  PermissionFlagsBits.Speak,
                  PermissionFlagsBits.PrioritySpeaker,
                  PermissionFlagsBits.UseSoundboard,
                  PermissionFlagsBits.UseExternalSounds,
                  PermissionFlagsBits.MoveMembers,
                  PermissionFlagsBits.MuteMembers
                ]
              },
              {
                id: AETHELGARD_ID,
                allow: [
                  PermissionFlagsBits.Connect,
                  PermissionFlagsBits.Speak,
                  PermissionFlagsBits.PrioritySpeaker,
                  PermissionFlagsBits.UseSoundboard,
                  PermissionFlagsBits.UseExternalSounds,
                  PermissionFlagsBits.MoveMembers,
                  PermissionFlagsBits.MuteMembers,
                  PermissionFlagsBits.DeafenMembers
                ]
              },
              {
                id: SOVEREIGN_1_ID,
                allow: [
                  PermissionFlagsBits.Connect,
                  PermissionFlagsBits.Speak,
                  PermissionFlagsBits.PrioritySpeaker,
                  PermissionFlagsBits.UseSoundboard,
                  PermissionFlagsBits.UseExternalSounds,
                  PermissionFlagsBits.MoveMembers,
                  PermissionFlagsBits.MuteMembers,
                  PermissionFlagsBits.DeafenMembers
                ]
              },
              {
                id: SOVEREIGN_2_ID,
                allow: [
                  PermissionFlagsBits.Connect,
                  PermissionFlagsBits.Speak,
                  PermissionFlagsBits.PrioritySpeaker,
                  PermissionFlagsBits.UseSoundboard,
                  PermissionFlagsBits.UseExternalSounds,
                  PermissionFlagsBits.MoveMembers,
                  PermissionFlagsBits.MuteMembers,
                  PermissionFlagsBits.DeafenMembers
                ]
              },
              {
                id: MODERATOR_ROLE_ID,
                allow: [
                  PermissionFlagsBits.Connect,
                  PermissionFlagsBits.Speak,
                  PermissionFlagsBits.PrioritySpeaker,
                  PermissionFlagsBits.UseSoundboard,
                  PermissionFlagsBits.UseExternalSounds,
                  PermissionFlagsBits.MoveMembers,
                  PermissionFlagsBits.MuteMembers,
                  PermissionFlagsBits.DeafenMembers
                ]
              }
            ];
          } else {
            // Text Channel
            openOverwrites = [
              {
                id: EVERYONE_ROLE_ID,
                deny: [
                  PermissionFlagsBits.EmbedLinks,
                  PermissionFlagsBits.AttachFiles,
                  PermissionFlagsBits.UseExternalEmojis,
                  PermissionFlagsBits.UseExternalStickers,
                  PermissionFlagsBits.CreatePublicThreads,
                  PermissionFlagsBits.CreatePrivateThreads
                ]
              },
              {
                id: BADDIES_ROLE_ID,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.EmbedLinks,
                  PermissionFlagsBits.AttachFiles,
                  PermissionFlagsBits.UseExternalEmojis
                ]
              },
              {
                id: BROS_ROLE_ID,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.EmbedLinks,
                  PermissionFlagsBits.AttachFiles,
                  PermissionFlagsBits.UseExternalEmojis
                ]
              },
              {
                id: RARE_ELITE_ID,
                allow: [
                  PermissionFlagsBits.EmbedLinks,
                  PermissionFlagsBits.AttachFiles,
                  PermissionFlagsBits.UseExternalEmojis
                ]
              },
              {
                id: EPIC_CHAMPION_ID,
                allow: [
                  PermissionFlagsBits.EmbedLinks,
                  PermissionFlagsBits.AttachFiles,
                  PermissionFlagsBits.UseExternalEmojis,
                  PermissionFlagsBits.UseExternalStickers,
                  PermissionFlagsBits.CreatePublicThreads,
                  PermissionFlagsBits.CreatePrivateThreads
                ]
              },
              {
                id: SOVEREIGN_1_ID,
                allow: [
                  PermissionFlagsBits.EmbedLinks,
                  PermissionFlagsBits.AttachFiles,
                  PermissionFlagsBits.UseExternalEmojis,
                  PermissionFlagsBits.UseExternalStickers,
                  PermissionFlagsBits.CreatePublicThreads,
                  PermissionFlagsBits.CreatePrivateThreads,
                  PermissionFlagsBits.ManageMessages
                ]
              },
              {
                id: SOVEREIGN_2_ID,
                allow: [
                  PermissionFlagsBits.EmbedLinks,
                  PermissionFlagsBits.AttachFiles,
                  PermissionFlagsBits.UseExternalEmojis,
                  PermissionFlagsBits.UseExternalStickers,
                  PermissionFlagsBits.CreatePublicThreads,
                  PermissionFlagsBits.CreatePrivateThreads,
                  PermissionFlagsBits.ManageMessages
                ]
              },
              {
                id: MODERATOR_ROLE_ID,
                allow: [
                  PermissionFlagsBits.EmbedLinks,
                  PermissionFlagsBits.AttachFiles,
                  PermissionFlagsBits.UseExternalEmojis,
                  PermissionFlagsBits.UseExternalStickers,
                  PermissionFlagsBits.CreatePublicThreads,
                  PermissionFlagsBits.CreatePrivateThreads,
                  PermissionFlagsBits.ManageMessages
                ]
              }
            ];
          }

          const filteredOverwrites = openOverwrites.filter(ow => ow.id === EVERYONE_ROLE_ID || guild.roles.cache.has(ow.id));
          await chan.permissionOverwrites.set(filteredOverwrites);
          console.log(`   ✅ Saluran #${chan.name} disinkronkan dan dibuka untuk the baddies & the bros.`);
        }
      } catch (err) {
        console.error(`   ❌ Gagal menyinkronkan saluran terbuka ID ${id}: ${err.message}`);
      }
    }

    // ===================================================
    // FASE 6: SINKRONISASI SALURAN SUARA TERBATAS (RESTRICTED VOICE CHANNELS)
    // ===================================================
    console.log('\n--- FASE 6: SINKRONISASI SALURAN SUARA TERBATAS ---');
    for (const id of RESTRICTED_CHANNELS_LIST) {
      try {
        const chan = await guild.channels.fetch(id);
        if (chan && chan.isVoiceBased()) {
          console.log(`🔒 Mengatur saluran suara terbatas (Admin Only): #${chan.name}`);
          
          const restrictedOverwrites = [
            {
              id: EVERYONE_ROLE_ID,
              deny: [
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak,
                PermissionFlagsBits.PrioritySpeaker,
                PermissionFlagsBits.UseSoundboard,
                PermissionFlagsBits.UseExternalSounds,
                PermissionFlagsBits.MoveMembers,
                PermissionFlagsBits.MuteMembers,
                PermissionFlagsBits.DeafenMembers
              ]
            },
            {
              id: KOORDINATOR_KOS_ID,
              deny: [PermissionFlagsBits.Connect]
            },
            {
              id: TEKNISI_ID,
              deny: [PermissionFlagsBits.Connect]
            },
            {
              id: CIO_ROLE_ID,
              deny: [PermissionFlagsBits.Connect]
            },
            {
              id: BADDIES_ROLE_ID,
              deny: [PermissionFlagsBits.Connect]
            },
            {
              id: BROS_ROLE_ID,
              deny: [PermissionFlagsBits.Connect]
            },
            {
              id: RARE_ELITE_ID,
              deny: [PermissionFlagsBits.Connect]
            },
            {
              id: EPIC_CHAMPION_ID,
              deny: [PermissionFlagsBits.Connect]
            },
            {
              id: PRIMORDIAL_ID,
              deny: [PermissionFlagsBits.Connect]
            },
            {
              id: LEGENDARY_ID,
              deny: [PermissionFlagsBits.Connect]
            },
            {
              id: ZENITH_ID,
              deny: [PermissionFlagsBits.Connect]
            },
            {
              id: MYTHIC_ID,
              deny: [PermissionFlagsBits.Connect]
            },
            {
              id: AETHELGARD_ID,
              deny: [PermissionFlagsBits.Connect]
            },
            {
              id: MODERATOR_ROLE_ID,
              deny: [PermissionFlagsBits.Connect]
            },
            {
              id: SOVEREIGN_1_ID,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak,
                PermissionFlagsBits.PrioritySpeaker,
                PermissionFlagsBits.UseSoundboard,
                PermissionFlagsBits.UseExternalSounds,
                PermissionFlagsBits.MoveMembers,
                PermissionFlagsBits.MuteMembers,
                PermissionFlagsBits.DeafenMembers
              ]
            },
            {
              id: SOVEREIGN_2_ID,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak,
                PermissionFlagsBits.PrioritySpeaker,
                PermissionFlagsBits.UseSoundboard,
                PermissionFlagsBits.UseExternalSounds,
                PermissionFlagsBits.MoveMembers,
                PermissionFlagsBits.MuteMembers,
                PermissionFlagsBits.DeafenMembers
              ]
            }
          ].filter(ow => ow.id === EVERYONE_ROLE_ID || guild.roles.cache.has(ow.id));

          await chan.permissionOverwrites.set(restrictedOverwrites);
          console.log(`   ✅ Saluran #${chan.name} disinkronkan menjadi terbatas (Hanya Sovereign/Admin yang bisa join).`);
        }
      } catch (err) {
        console.error(`   ❌ Gagal menyinkronkan saluran suara terbatas ID ${id}: ${err.message}`);
      }
    }

    console.log(`\n🎉 SINKRONISASI REALITI SELESAI SECARA MENYELURUH!`);
    console.log(`• Saluran Teks Berhasil Disinkronkan: ${textSynced}`);
    console.log(`• Saluran Suara Berhasil Disinkronkan: ${voiceSynced}`);
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
