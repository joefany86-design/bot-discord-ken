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

// Saluran Publik / Onboarding yang Dikecualikan dari Lock (Jangan di-lock agar member baru bisa melihat)
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
  TEST_CHANNEL_ID
];

// ==========================================
// 2. DAFTAR ID PERAN (ROLES)
// ==========================================
const EVERYONE_ROLE_ID = '1410239829874053296';
const SOVEREIGN_1_ID = '1508835510087581696';   // 👑The Sovereign
const SOVEREIGN_2_ID = '1509229714084987162';   // 👑 The Sovereign
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

    // ===================================================
    // FASE 1: KONFIGURASI STAFF ONLY & ADMIN CHANNELS
    // ===================================================
    console.log('\n--- FASE 1: KONFIGURASI SALURAN STAFF & ADMIN ---');
    const staffCategory = await guild.channels.fetch(STAFF_CATEGORY_ID);
    if (staffCategory && staffCategory.type === 4) {
      console.log(`🔒 Mengatur perizinan pada kategori: ${staffCategory.name}`);
      await staffCategory.permissionOverwrites.set([
        {
          id: EVERYONE_ROLE_ID,
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
          id: KOORDINATOR_KOS_ID,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]
        },
        {
          id: TEKNISI_ID,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]
        },
        {
          id: CIO_ROLE_ID,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]
        }
      ]);
      console.log('   ✅ Perizinan Kategori STAFF ONLY berhasil diperbarui.');

      const staffSubChannels = [ADMIN_BAIK_ID, LOG_CHANNEL_ID, DONTOL_ID, TEST_CHANNEL_ID];
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
            }
          ]);
          textSynced++;
        }
      } catch (e) {
        console.error(`⚠️ Gagal menyinkronkan saluran #${chan.name}: ${e.message}`);
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
