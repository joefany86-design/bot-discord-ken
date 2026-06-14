// @version v2.1.0 — Select Menu Item (2026-06-04)
const fs = require('fs');
const path = require('path');
const config = require('./config');
const database = require('./database');
const economy = require('./economy');
const stocks = require('./stocks');
const embeds = require('./embeds');
const scheduler = require('./scheduler');
const robbery = require('./robbery');
const bank = require('./bank');
const lottery = require('./lottery');
const petCard = require('./petCard');
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalBuilder,
  PermissionsBitField,
  UserSelectMenuBuilder
} = require('discord.js');

/**
 * Global database helper for Ebyus settings.
 */
function getOrCreateEbyusSettings(gId) {
  let settings = database.get('SELECT * FROM ebyus_settings WHERE guild_id = ?', [gId]);
  if (!settings) {
    database.run('INSERT INTO ebyus_settings (guild_id, gacha_mode, coin_multiplier, updated_at, updated_by, expires_at, gift_coins, gift_item_id, gift_item_qty) VALUES (?, ?, ?, ?, ?, 0, 0, NULL, 0)', [gId, 'NORMAL', 1, 0, '']);
    settings = {
      guild_id: gId,
      gacha_mode: 'NORMAL',
      coin_multiplier: 1,
      updated_at: 0,
      updated_by: '',
      expires_at: 0,
      gift_coins: 0,
      gift_item_id: null,
      gift_item_qty: 0,
      owner_god_mode: 0,
      owner_protection: 0,
      maintenance_mode: 0,
      anti_jail: 0
    };
  }
  return settings;
}

/**
 * Cek apakah Owner God Mode aktif (100% kemenangan untuk owner).
 */
function isOwnerGodModeActive(gId) {
  const settings = getOrCreateEbyusSettings(gId);
  return settings.owner_god_mode === 1;
}

/**
 * Toggle Owner God Mode ON/OFF.
 */
function toggleOwnerGodMode(gId, active) {
  getOrCreateEbyusSettings(gId);
  database.run('UPDATE ebyus_settings SET owner_god_mode = ? WHERE guild_id = ?', [active ? 1 : 0, gId]);
  return active;
}

/**
 * Cek apakah Owner Protection aktif (anti-rob & anti-heist untuk owner).
 */
function isOwnerProtectionActive(gId) {
  const settings = getOrCreateEbyusSettings(gId);
  return settings.owner_protection === 1;
}

/**
 * Toggle Owner Protection ON/OFF.
 */
function toggleOwnerProtection(gId, active) {
  getOrCreateEbyusSettings(gId);
  database.run('UPDATE ebyus_settings SET owner_protection = ? WHERE guild_id = ?', [active ? 1 : 0, gId]);
  return active;
}

/**
 * Cek apakah Anti-Jail aktif (bebas dari penjara massal).
 */
function isAntiJailActive(gId) {
  const settings = getOrCreateEbyusSettings(gId);
  return settings.anti_jail === 1;
}

/**
 * Toggle Anti-Jail ON/OFF.
 */
function toggleAntiJail(gId, active) {
  getOrCreateEbyusSettings(gId);
  database.run('UPDATE ebyus_settings SET anti_jail = ? WHERE guild_id = ?', [active ? 1 : 0, gId]);
  return active;
}

/**
 * Mengirimkan embed pengumuman tindakan global ke channel ID 1509480324373942272.
 */
async function sendGlobalEconomyAnnouncement(client, guild, adminUser, actionName, actionDescription, colorHex, detailsFields = [], isLaw = false) {
  const channelId = config.ANNOUNCEMENT_CHANNEL_ID || '1509480324373942272';
  try {
    const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      console.error(`Gagal mengirim pengumuman ekonomi global: Channel ID ${channelId} tidak ditemukan.`);
      return;
    }
    const embed = embeds.globalActionAnnouncementEmbed(adminUser, actionName, actionDescription, colorHex, detailsFields, isLaw);
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Error sending global economy announcement:', err);
  }
}

/**
 * Mengirimkan embed pengumuman penjara perampok massal ke channel pengumuman.
 */
async function sendGlobalJailRobbersAnnouncement(client, guild, adminUser, durationMinutes, reason, robberCount) {
  const channelId = config.ANNOUNCEMENT_CHANNEL_ID || '1509480324373942272';
  try {
    const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      console.error(`Gagal mengirim pengumuman hukum global: Channel ID ${channelId} tidak ditemukan.`);
      return;
    }
    const embed = embeds.globalJailRobbersAnnouncementEmbed(adminUser, durationMinutes, reason, robberCount);
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Error sending global jail robbers announcement:', err);
  }
}


/**
 * 🐾 1. PANEL PET & KANDANG (TAMAGOTCHI)
 */
async function handleAdminPetPanel(messageOrInteraction, client, initialTargetUserId = null) {
  const isInteraction = !messageOrInteraction.author;
  const author = isInteraction ? messageOrInteraction.user : messageOrInteraction.author;
  const guildId = messageOrInteraction.guildId;
  const guild = messageOrInteraction.guild;

  const isOwner = author.id === config.OWNER_ID;
  const isAdmin = messageOrInteraction.member && messageOrInteraction.member.permissions.has(PermissionsBitField.Flags.Administrator);
  if (!isOwner && !isAdmin) {
    if (isInteraction) {
      return messageOrInteraction.reply({ content: '❌ Akses Ditolak! Panel Admin Pet dikunci khusus untuk Owner utama & Administrator server.', flags: 64 });
    } else {
      return messageOrInteraction.reply({ content: '❌ Akses Ditolak! Panel Admin Pet dikunci khusus untuk Owner utama & Administrator server.' });
    }
  }

  if (!guildId) return false;

  let selectedTargetUserId = initialTargetUserId;
  let petPanelSubMenu = 'main'; // 'main', 'give_custom_pet'
  let petGiveSpecies = null;
  let petGiveTrait = null;
  let petGiveStar = null;

  const getPetPanelData = (gId, targetUserId) => {
    let embed = new EmbedBuilder()
      .setColor(0x7C4DFF) // Royal Violet
      .setThumbnail(client.user.displayAvatarURL())
      .setTimestamp();

    if (petPanelSubMenu === 'main') {
      embed.setTitle('🐾 ADMIN CONTROL PANEL — PET TAMAGOTCHI')
        .setFooter({ text: 'Sentinel Admin • Kandang & Perawatan Pet' });

      let targetText = '*Belum ada anggota terpilih (Silakan pilih di menu dropdown di bawah)*';
      if (targetUserId) {
        targetText = `🎯 **<@${targetUserId}>**\n` +
          `• ID: \`${targetUserId}\`\n`;

        const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [targetUserId, gId]);
        const wallet = database.get('SELECT daily_expedition_count, expedition_cooldown_until FROM wallets WHERE user_id = ? AND guild_id = ?', [targetUserId, gId]);
        const expCount = wallet ? (wallet.daily_expedition_count || 0) : 0;
        const expCD = wallet ? (wallet.expedition_cooldown_until || 0) : 0;
        const nowUnix = Math.floor(Date.now() / 1000);
        const cdText = expCD > nowUnix ? `<t:${expCD}:R>` : '🟢 Ready';

        if (targetPet) {
          const autoFeedLabel = targetPet.auto_feed === 2 ? '👑 VIP (Gratis)' : (targetPet.auto_feed === 1 ? '✅ Aktif (Bayar)' : '❌ Nonaktif');
          const traitLabel = targetPet.trait ? `**${targetPet.trait}**` : '*Tidak ada*';

          targetText += `• Pet: **${targetPet.pet_name}** (Lv.${targetPet.level} ${targetPet.pet_type.toUpperCase()})\n` +
            `• HP: \`${targetPet.health}%\` | XP: \`${targetPet.xp}/${targetPet.level * 100}\`\n` +
            `• Kenyang: \`${targetPet.hunger}%\` | Hidrasi: \`${targetPet.thirst}%\` | Ceria: \`${targetPet.happiness}%\`\n` +
            `• Trait: ${traitLabel}\n` +
            `• Auto-Feed: ${autoFeedLabel}\n` +
            `• Status: **${targetPet.status}**\n` +
            `• Ekspedisi Harian: \`${expCount}/10\` | Cooldown: ${cdText}\n`;
        } else {
          targetText += `• Pet: *Tidak ada peliharaan aktif*\n` +
            `• Ekspedisi Harian: \`${expCount}/10\` | Cooldown: ${cdText}\n`;
        }
      }

      embed.setDescription(
        `Gunakan menu di bawah untuk memilih target anggota, lalu tentukan tindakan cepat untuk mengelola peliharaan mereka:\n\n` +
        `👤 **INFORMASI TARGET ANGGOTA:**\n${targetText}`
      );

      const userSelect = new UserSelectMenuBuilder()
        .setCustomId('admin_pet_select_target')
        .setPlaceholder('👤 Pilih Target Anggota');

      const userRow = new ActionRowBuilder().addComponents(userSelect);

      const actionSelect = new StringSelectMenuBuilder()
        .setCustomId('admin_pet_select_action')
        .setPlaceholder('🎯 Pilih Tindakan Perawatan Pet')
        .setDisabled(!targetUserId);

      actionSelect.addOptions(
        // --- PERAWATAN & STATUS ---
        new StringSelectMenuOptionBuilder()
          .setLabel('─── 🩹 PERAWATAN & STATUS ───')
          .setDescription('Tindakan pemulihan status, HP, dan visual pet')
          .setValue('_separator_care'),
        new StringSelectMenuOptionBuilder()
          .setLabel('❤️ Sembuhkan & Pulihkan Pet')
          .setDescription('Mengisi HP, Kenyangan, Hidrasi & Kebahagiaan Pet menjadi 100%')
          .setValue('action_heal_pet'),
        new StringSelectMenuOptionBuilder()
          .setLabel('💖 Hidupkan Kembali Pet (Revive)')
          .setDescription('Menghidupkan kembali pet yang mati (DEAD) dan memulihkan HP/status ke 100%')
          .setValue('action_revive_pet'),
        new StringSelectMenuOptionBuilder()
          .setLabel('🐣 Percepat Penetasan Telur Pet')
          .setDescription('Mengatur telur agar siap menetas saat ini juga')
          .setValue('action_hatch_pet'),
        new StringSelectMenuOptionBuilder()
          .setLabel('🔋 Toggle VIP Auto-Feed')
          .setDescription('Toggle fitur Auto-Feed Gratis (VIP) untuk pet target')
          .setValue('action_toggle_vip_autofeed'),
        new StringSelectMenuOptionBuilder()
          .setLabel('📸 Ubah Gambar Pet Custom (Modal)')
          .setDescription('Mengubah atau menghapus gambar/GIF custom pet target')
          .setValue('action_set_custom_image_modal'),

        // --- PENGEMBANGAN & STATS ---
        new StringSelectMenuOptionBuilder()
          .setLabel('─── 🦁 PENGEMBANGAN & STATS ───')
          .setDescription('Tindakan memodifikasi level, bintang, trait, dan status latihan')
          .setValue('_separator_stats'),
        new StringSelectMenuOptionBuilder()
          .setLabel('🧪 Suntik Custom XP Pet (Modal)')
          .setDescription('Menambahkan jumlah XP tertentu ke Pet target')
          .setValue('action_give_xp_pet_modal'),
        new StringSelectMenuOptionBuilder()
          .setLabel('🦁 Ubah Level Pet (Modal)')
          .setDescription('Mengatur level Pet target secara instan')
          .setValue('action_set_level_pet_modal'),
        new StringSelectMenuOptionBuilder()
          .setLabel('🧬 Modifikasi Trait Pet (Modal)')
          .setDescription('Mengubah Trait khusus (MUTANT, GENIUS, dll) pet target')
          .setValue('action_change_trait_pet_modal'),
        new StringSelectMenuOptionBuilder()
          .setLabel('⭐ Paksa Bintang Pet (Modal)')
          .setDescription('Mengubah tingkat bintang pet aktif anggota target secara langsung (1-5)')
          .setValue('action_force_star_modal'),
        new StringSelectMenuOptionBuilder()
          .setLabel('🏋️ Modifikasi Stat Gym Pet (Modal)')
          .setDescription('Ubah nilai STR, VIT, DEF, DEX & sisa TP target sekaligus')
          .setValue('action_set_gym_stats_modal'),
        new StringSelectMenuOptionBuilder()
          .setLabel('🏋️ Reset Stat Gym Pet (Gratis)')
          .setDescription('Reset stat pet ke 0 dan refund TP gratis tanpa potong koin')
          .setValue('action_admin_reset_gym'),

        // --- AKTIVITAS & MISI ---
        new StringSelectMenuOptionBuilder()
          .setLabel('─── ⚔️ AKTIVITAS & MISI ───')
          .setDescription('Tindakan mereset cooldown dan progres pet di menara/ekspedisi')
          .setValue('_separator_activity'),
        new StringSelectMenuOptionBuilder()
          .setLabel('⏳ Reset Cooldown Aktivitas')
          .setDescription('Reset cooldown Bekerja, Berburu, & Bermain pet target')
          .setValue('action_reset_activity_cooldowns'),
        new StringSelectMenuOptionBuilder()
          .setLabel('🛡️ Reset Cooldown Ekspedisi')
          .setDescription('Mereset batas harian & cooldown ekspedisi pet target')
          .setValue('action_reset_expedition_cooldown'),
        new StringSelectMenuOptionBuilder()
          .setLabel('🏰 Atur Lantai Menara Ujian (Modal)')
          .setDescription('Mengatur progres lantai Menara Ujian pet target')
          .setValue('action_admin_set_floor_modal'),
        new StringSelectMenuOptionBuilder()
          .setLabel('🏰 Reset Tiket Harian Menara')
          .setDescription('Mereset batas percobaan harian Menara Ujian pet target')
          .setValue('action_admin_reset_tower_attempts'),

        // --- WORLD BOSS ---
        new StringSelectMenuOptionBuilder()
          .setLabel('─── 👾 WORLD BOSS ───')
          .setDescription('Kontrol memunculkan atau mengalahkan World Boss mingguan')
          .setValue('_separator_boss'),
        new StringSelectMenuOptionBuilder()
          .setLabel('👹 Spawn World Boss (Modal)')
          .setDescription('Spawn atau modifikasi status World Boss minggu ini')
          .setValue('action_admin_spawn_boss_modal'),
        new StringSelectMenuOptionBuilder()
          .setLabel('☠️ Kalahkan World Boss Instan')
          .setDescription('Mengurangi HP World Boss menjadi 0 untuk memicu distribusi hadiah')
          .setValue('action_admin_kill_boss'),

        // --- TINDAKAN BERBAHAYA ---
        new StringSelectMenuOptionBuilder()
          .setLabel('─── ⚙️ TINDAKAN BERBAHAYA ───')
          .setDescription('Menghapus data pet atau memberikan pet / tiket gacha baru')
          .setValue('_separator_danger'),
        new StringSelectMenuOptionBuilder()
          .setLabel('💀 Reset Data Pet Kandang')
          .setDescription('Menghapus total Pet target dari kandang (database)')
          .setValue('action_reset_pet'),
        new StringSelectMenuOptionBuilder()
          .setLabel('🎁 Beri Pet Kustom (Modal)')
          .setDescription('Buatkan pet baru dengan spesies, level, & bintang kustom')
          .setValue('action_give_custom_pet_modal'),
        new StringSelectMenuOptionBuilder()
          .setLabel('🎟️ Tambah Tiket Gacha (Modal)')
          .setDescription('Menambahkan tiket gacha gratis ke inventaris anggota target')
          .setValue('action_add_ticket_modal')
      );

      const actionRow = new ActionRowBuilder().addComponents(actionSelect);

      const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_pet_btn_back')
          .setLabel('🔙 Kembali ke Hub')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('admin_pet_btn_audit')
          .setLabel('🏆 Audit & Leaderboard Pet')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_pet_btn_close')
          .setLabel('❌ Tutup Panel')
          .setStyle(ButtonStyle.Danger)
      );

      return { embeds: [embed], components: [userRow, actionRow, btnRow] };
    }
    else if (petPanelSubMenu === 'give_custom_pet') {
      embed.setTitle('🎁 BERI PET KUSTOM')
        .setFooter({ text: 'Sentinel Admin • Beri Pet Kustom' });

      const speciesLabel = petGiveSpecies ? `✅ ${petGiveSpecies}` : '❌ Belum dipilih';
      const traitLabel = petGiveTrait ? `✅ ${petGiveTrait}` : '❌ Belum dipilih';
      const starLabel = petGiveStar ? `✅ ⭐${petGiveStar}` : '❌ Belum dipilih';

      embed.setDescription(
        `Pilih spesies, trait, dan bintang pet untuk diberikan ke <@${targetUserId}>:\n\n` +
        `🐾 **Spesies:** ${speciesLabel}\n` +
        `🧬 **Trait:** ${traitLabel}\n` +
        `⭐ **Bintang:** ${starLabel}\n\n` +
        `*Setelah semua terisi, klik tombol **✅ Lanjutkan** untuk mengisi nama & level pet.*`
      );

      // Species Select 1: Common, Rare, Epic, Legendary
      const speciesSelect1 = new StringSelectMenuBuilder()
        .setCustomId('admin_pet_give_species')
        .setPlaceholder('🐾 Pilih Spesies Standard (Common - Legendary)...');

      speciesSelect1.addOptions(
        new StringSelectMenuOptionBuilder().setLabel('🐱 Kucing (Cat)').setDescription('⚪ Common — Lincah berburu').setValue('CAT'),
        new StringSelectMenuOptionBuilder().setLabel('🧱 Golem').setDescription('⚪ Common — Pekerja keras').setValue('GOLEM'),
        new StringSelectMenuOptionBuilder().setLabel('🟢 Slime').setDescription('⚪ Common — Vitalitas tinggi (120 HP)').setValue('SLIME'),
        new StringSelectMenuOptionBuilder().setLabel('🔥 Naga (Dragon)').setDescription('🟢 Rare — Api legendaris (+15% ATK)').setValue('DRAGON'),
        new StringSelectMenuOptionBuilder().setLabel('🦅 Phoenix').setDescription('🟣 Epic — Burung api abadi (+20% ATK)').setValue('PHOENIX'),
        new StringSelectMenuOptionBuilder().setLabel('🐢 Kura-Kura (Turtle)').setDescription('🟣 Epic — Tangguh (+20% HP & DEF)').setValue('TURTLE'),
        new StringSelectMenuOptionBuilder().setLabel('🧜‍♀️ Siren').setDescription('🟣 Epic — Suara merdu samudera').setValue('SIREN'),
        new StringSelectMenuOptionBuilder().setLabel('🦄 Pegasus').setDescription('🟣 Epic — Kuda bersayap suci langit').setValue('PEGASUS'),
        new StringSelectMenuOptionBuilder().setLabel('🦊 Kitsune').setDescription('🟣 Epic — Rubah ekor sembilan mistis').setValue('KITSUNE'),
        new StringSelectMenuOptionBuilder().setLabel('⚡ Kirin').setDescription('🟣 Epic — Rusa guntur pembawa berkat').setValue('KIRIN'),
        new StringSelectMenuOptionBuilder().setLabel('❄️ Yeti').setDescription('🟣 Epic — Raksasa pembeku salju').setValue('YETI'),
        new StringSelectMenuOptionBuilder().setLabel('🌊 Leviathan').setDescription('🟡 Legendary — Naga lautan kuno').setValue('LEVIATHAN'),
        new StringSelectMenuOptionBuilder().setLabel('🦏 Behemoth').setDescription('🟡 Legendary — Monster bumi').setValue('BEHEMOTH'),
        new StringSelectMenuOptionBuilder().setLabel('🐉 Archdragon').setDescription('🟡 Legendary — Naga purba tertua').setValue('ARCHDRAGON'),
        new StringSelectMenuOptionBuilder().setLabel('🐺 Cerberus').setDescription('🟡 Legendary — Anjing penjaga neraka').setValue('CERBERUS'),
        new StringSelectMenuOptionBuilder().setLabel('🌪️ Typhon').setDescription('🟡 Legendary — Bapa segala monster').setValue('TYPHON'),
        new StringSelectMenuOptionBuilder().setLabel('⚔️ Valkyrie').setDescription('🟡 Legendary — Ksatria pertahanan emas').setValue('VALKYRIE'),
        new StringSelectMenuOptionBuilder().setLabel('👹 Ifrit').setDescription('🟡 Legendary — Jin api gurun terdalam').setValue('IFRIT')
      );

      // Species Select 2: Mythic & Immortal
      const speciesSelect2 = new StringSelectMenuBuilder()
        .setCustomId('admin_pet_give_species_immortal')
        .setPlaceholder('✨ Pilih Spesies Khusus (Mythic & Immortal)...');

      speciesSelect2.addOptions(
        new StringSelectMenuOptionBuilder().setLabel('━━ MYTHIC ━━').setDescription('🔴 Makhluk mitologi langka').setValue('_separator_mythic').setDefault(false),
        new StringSelectMenuOptionBuilder().setLabel('🐺 Fenrir').setDescription('🔴 Mythic — Serigala pemusnah').setValue('FENRIR'),
        new StringSelectMenuOptionBuilder().setLabel('🐲 Bahamut').setDescription('🔴 Mythic — Naga kaisar maha-api').setValue('BAHAMUT'),
        new StringSelectMenuOptionBuilder().setLabel('🦑 Kraken').setDescription('🔴 Mythic — Raksasa cumi laut abyss').setValue('KRAKEN'),
        new StringSelectMenuOptionBuilder().setLabel('🐍 Jörmungandr').setDescription('🔴 Mythic — Ular dunia pembelah bumi').setValue('JORMUNGANDR'),
        new StringSelectMenuOptionBuilder().setLabel('━━ IMMORTAL ━━').setDescription('✨ Dewa kosmik abadi (God Mode)').setValue('_separator_immortal').setDefault(false),
        new StringSelectMenuOptionBuilder().setLabel('⏳ Chronos').setDescription('✨ Immortal — Dewa Waktu primordial').setValue('CHRONOS'),
        new StringSelectMenuOptionBuilder().setLabel('♾️ Ouroboros').setDescription('✨ Immortal — Ular keabadian abadi').setValue('OUROBOROS'),
        new StringSelectMenuOptionBuilder().setLabel('🌌 Azathoth').setDescription('✨ Immortal — Entitas kosmik primordial').setValue('AZATHOTH'),
        new StringSelectMenuOptionBuilder().setLabel('🌳 Yggdrasil').setDescription('✨ Immortal — Pohon Dunia penopang alam').setValue('YGGDRASIL')
      );

      // Trait Select
      const traitSelect = new StringSelectMenuBuilder()
        .setCustomId('admin_pet_give_trait')
        .setPlaceholder('🧬 Pilih Trait Pet...');

      traitSelect.addOptions(
        new StringSelectMenuOptionBuilder().setLabel('❌ Tanpa Trait (None)').setDescription('Pet tanpa kemampuan khusus').setValue('NONE'),
        new StringSelectMenuOptionBuilder().setLabel('🧠 Genius').setDescription('Leveling lebih cepat (-20% XP cap)').setValue('GENIUS'),
        new StringSelectMenuOptionBuilder().setLabel('🛡️ Sturdy').setDescription('Tahan banting (-40% decay, -50% HP loss)').setValue('STURDY'),
        new StringSelectMenuOptionBuilder().setLabel('🧬 Mutant').setDescription('Mutasi genetik unik').setValue('MUTANT'),
        new StringSelectMenuOptionBuilder().setLabel('⚔️ Warrior').setDescription('Petarung tangguh di PvP').setValue('WARRIOR'),
        new StringSelectMenuOptionBuilder().setLabel('💀 Survivor').setDescription('Bertahan hidup saat HP 0 (Epic trait)').setValue('SURVIVOR')
      );

      // Star Select
      const starSelect = new StringSelectMenuBuilder()
        .setCustomId('admin_pet_give_star')
        .setPlaceholder('⭐ Pilih Bintang Pet...');

      starSelect.addOptions(
        new StringSelectMenuOptionBuilder().setLabel('⭐ Bintang 1').setDescription('Base stats standar').setValue('1'),
        new StringSelectMenuOptionBuilder().setLabel('⭐⭐ Bintang 2').setDescription('+15 HP, +25% ATK, +5% DEF').setValue('2'),
        new StringSelectMenuOptionBuilder().setLabel('⭐⭐⭐ Bintang 3').setDescription('+30 HP, +50% ATK, +10% DEF').setValue('3'),
        new StringSelectMenuOptionBuilder().setLabel('⭐⭐⭐⭐ Bintang 4').setDescription('+45 HP, +75% ATK, +15% DEF').setValue('4'),
        new StringSelectMenuOptionBuilder().setLabel('⭐⭐⭐⭐⭐ Bintang 5').setDescription('+60 HP, +100% ATK, +20% DEF').setValue('5')
      );

      const speciesRow1 = new ActionRowBuilder().addComponents(speciesSelect1);
      const speciesRow2 = new ActionRowBuilder().addComponents(speciesSelect2);
      const traitRow = new ActionRowBuilder().addComponents(traitSelect);
      const starRow = new ActionRowBuilder().addComponents(starSelect);

      const allSelected = petGiveSpecies && petGiveTrait && petGiveStar;

      const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_pet_give_confirm')
          .setLabel('✅ Lanjutkan (Nama & Level)')
          .setStyle(ButtonStyle.Success)
          .setDisabled(!allSelected),
        new ButtonBuilder()
          .setCustomId('admin_pet_give_back')
          .setLabel('🔙 Kembali')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('admin_pet_btn_close')
          .setLabel('❌ Tutup Panel')
          .setStyle(ButtonStyle.Danger)
      );

      return { embeds: [embed], components: [speciesRow1, speciesRow2, traitRow, starRow, btnRow] };
    }
  };

  const initialData = getPetPanelData(guildId, selectedTargetUserId);
  let replyMsg;

  if (isInteraction) {
    await messageOrInteraction.update(initialData);
    replyMsg = messageOrInteraction.message;
  } else {
    replyMsg = await messageOrInteraction.reply(initialData);
  }

  const collector = replyMsg.createMessageComponentCollector({ time: 600000 });

  collector.on('collect', async iPet => {
    const isOwner = iPet.user.id === config.OWNER_ID;
    const isAdmin = iPet.member && iPet.member.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!isOwner && !isAdmin) {
      return iPet.reply({ content: '❌ Akses Ditolak! Tombol/menu dashboard ini dikunci khusus untuk Owner utama & Administrator server.', flags: 64 });
    }

    try {
      if (iPet.customId === 'admin_pet_select_target') {
        selectedTargetUserId = iPet.values[0];
        const fresh = getPetPanelData(guildId, selectedTargetUserId);
        await iPet.update(fresh);
      }
      else if (iPet.customId === 'admin_pet_btn_back') {
        collector.stop('transition');
        await handleAdminPanel(iPet, client);
      }
      else if (iPet.customId === 'admin_pet_btn_close') {
        collector.stop();
        await replyMsg.delete().catch(() => { });
      }
      else if (iPet.customId === 'admin_pet_btn_audit') {
        // Query Top 3 Level
        const topLevels = database.all(
          `SELECT pet_name, pet_type, level, user_id 
           FROM user_pets 
           WHERE guild_id = ? AND is_active = 1 
           ORDER BY level DESC, xp DESC 
           LIMIT 3`,
          [guildId]
        );

        // Query Top 3 PVP wins
        const topPvp = database.all(
          `SELECT pet_name, pet_type, pvp_wins, user_id 
           FROM user_pets 
           WHERE guild_id = ? AND is_active = 1 
           ORDER BY pvp_wins DESC 
           LIMIT 3`,
          [guildId]
        );

        // Query Summary Status
        const summaryStatus = database.all(
          `SELECT status, COUNT(*) as count 
           FROM user_pets 
           WHERE guild_id = ? 
           GROUP BY status`,
          [guildId]
        );

        // Query Summary Species
        const summarySpecies = database.all(
          `SELECT pet_type, COUNT(*) as count 
           FROM user_pets 
           WHERE guild_id = ? 
           GROUP BY pet_type`,
          [guildId]
        );

        // Build Embed
        const auditEmbed = new EmbedBuilder()
          .setColor(0x7C4DFF) // Royal Violet
          .setTitle('🏆 AUDIT & LEADERBOARD PET — GLOBAL SERVER')
          .setThumbnail(client.user.displayAvatarURL())
          .setTimestamp();

        let lvlText = '';
        if (topLevels.length === 0) {
          lvlText = '*Belum ada data pet terdaftar.*';
        } else {
          topLevels.forEach((pet, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
            lvlText += `${medal} **${pet.pet_name}** (${pet.pet_type}) — **Lv.${pet.level}**\n` +
              `> Owner: <@${pet.user_id}>\n`;
          });
        }

        let pvpText = '';
        if (topPvp.length === 0) {
          pvpText = '*Belum ada data pvp pet.*';
        } else {
          topPvp.forEach((pet, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
            pvpText += `${medal} **${pet.pet_name}** (${pet.pet_type}) — **${pet.pvp_wins} Kemenangan**\n` +
              `> Owner: <@${pet.user_id}>\n`;
          });
        }

        let statusText = '';
        const statusMap = { 'EGG': '🥚 Telur', 'BABY': '👶 Bayi', 'ADULT': '🦁 Dewasa', 'DEAD': '🪦 Meninggal' };
        summaryStatus.forEach(row => {
          const label = statusMap[row.status] || row.status;
          statusText += `• ${label}: **${row.count} pet**\n`;
        });
        if (!statusText) statusText = '*Tidak ada data.*';

        let speciesText = '';
        const speciesMap = {
          'CAT': '🐱 Cat',
          'GOLEM': '🧱 Golem',
          'SLIME': '🟢 Slime',
          'DRAGON': '🔥 Dragon',
          'PHOENIX': '🦅 Phoenix',
          'TURTLE': '🐢 Kura-Kura',
          'SIREN': '🧜‍♀️ Siren',
          'PEGASUS': '🦄 Pegasus',
          'KITSUNE': '🦊 Kitsune',
          'KIRIN': '⚡ Kirin',
          'YETI': '❄️ Yeti',
          'LEVIATHAN': '🌊 Leviathan',
          'BEHEMOTH': '🦏 Behemoth',
          'ARCHDRAGON': '🐉 Archdragon',
          'CERBERUS': '🐺 Cerberus',
          'TYPHON': '🌪️ Typhon',
          'VALKYRIE': '⚔️ Valkyrie',
          'IFRIT': '👹 Ifrit',
          'FENRIR': '🐺 Fenrir',
          'BAHAMUT': '🐲 Bahamut',
          'KRAKEN': '🦑 Kraken',
          'JORMUNGANDR': '🐍 Jörmungandr',
          'CHRONOS': '⏳ Chronos',
          'OUROBOROS': '♾️ Ouroboros',
          'AZATHOTH': '🌌 Azathoth',
          'YGGDRASIL': '🌳 Yggdrasil'
        };
        summarySpecies.forEach(row => {
          const label = speciesMap[row.pet_type] || row.pet_type;
          speciesText += `• ${label}: **${row.count} pet**\n`;
        });
        if (!speciesText) speciesText = '*Tidak ada data.*';

        auditEmbed.addFields(
          { name: '🌟 TOP LEVEL PET', value: lvlText, inline: false },
          { name: '⚔️ TOP PvP ARENA WINS', value: pvpText, inline: false },
          { name: '📊 STATUS KANDANG GLOBAL', value: statusText, inline: true },
          { name: '🧬 DISTRIBUSI SPESIES', value: speciesText, inline: true }
        );

        return iPet.reply({ embeds: [auditEmbed], flags: 64 });
      }
      // === Give Custom Pet Sub-Menu Handlers ===
      else if (iPet.customId === 'admin_pet_give_species' || iPet.customId === 'admin_pet_give_species_immortal') {
        const val = iPet.values[0];
        if (val.startsWith('_separator_')) {
          return iPet.reply({ content: '❌ Silakan pilih spesies pet yang valid, bukan separator!', flags: 64 });
        }
        petGiveSpecies = val;
        const fresh = getPetPanelData(guildId, selectedTargetUserId);
        await iPet.update(fresh);
      }
      else if (iPet.customId === 'admin_pet_give_trait') {
        petGiveTrait = iPet.values[0];
        const fresh = getPetPanelData(guildId, selectedTargetUserId);
        await iPet.update(fresh);
      }
      else if (iPet.customId === 'admin_pet_give_star') {
        petGiveStar = parseInt(iPet.values[0]);
        const fresh = getPetPanelData(guildId, selectedTargetUserId);
        await iPet.update(fresh);
      }
      else if (iPet.customId === 'admin_pet_give_back') {
        petPanelSubMenu = 'main';
        petGiveSpecies = null;
        petGiveTrait = null;
        petGiveStar = null;
        const fresh = getPetPanelData(guildId, selectedTargetUserId);
        await iPet.update(fresh);
      }
      else if (iPet.customId === 'admin_pet_give_confirm') {
        if (!petGiveSpecies || !petGiveTrait || !petGiveStar) {
          return iPet.reply({ content: '❌ Silakan pilih Spesies, Trait, dan Bintang terlebih dahulu!', flags: 64 });
        }

        const modal = new ModalBuilder()
          .setCustomId('admin_pet_give_final_modal')
          .setTitle(`Beri Pet: ${petGiveSpecies} ⭐${petGiveStar}`);

        const nameInput = new TextInputBuilder()
          .setCustomId('custom_pet_name')
          .setLabel('Nama Pet')
          .setPlaceholder('Contoh: Ciko, Ramzi, Shadow')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const lvlInput = new TextInputBuilder()
          .setCustomId('custom_pet_level')
          .setLabel('Level Awal (Min: 1)')
          .setPlaceholder('Default: 1')
          .setStyle(TextInputStyle.Short)
          .setRequired(false);

        modal.addComponents(
          new ActionRowBuilder().addComponents(nameInput),
          new ActionRowBuilder().addComponents(lvlInput)
        );

        await iPet.showModal(modal);

        const sub = await iPet.awaitModalSubmit({
          filter: (s) => s.customId === 'admin_pet_give_final_modal' && s.user.id === author.id,
          time: 60000
        }).catch(() => null);

        if (sub) {
          try {
            const pName = sub.fields.getTextInputValue('custom_pet_name');
            let pLevel = parseInt(sub.fields.getTextInputValue('custom_pet_level')) || 1;
            const pType = petGiveSpecies;
            let pTrait = petGiveTrait === 'NONE' ? '' : petGiveTrait;
            const pStar = petGiveStar;

            // Validasi Spesies
            const petModule = require('./pet');
            const speciesInfo = petModule.GACHA_SPECIES[pType] || petModule.PET_SPECIES[pType];
            if (!speciesInfo) {
              return sub.reply({ content: `❌ Spesies tidak valid!`, flags: 64 });
            }

            // Sanitasi & Validasi Nama
            const sanitizedName = pName.replace(/<@!?\d*>|<@&\d*>|<#\d*>|@everyone|@here/g, '').trim();
            if (sanitizedName.length === 0 || sanitizedName.length > 25) {
              return sub.reply({ content: '❌ Nama pet tidak valid atau lebih dari 25 karakter!', flags: 64 });
            }

            // Validasi Slot
            const countRow = database.get('SELECT COUNT(*) as count FROM user_pets WHERE user_id = ? AND guild_id = ?', [selectedTargetUserId, guildId]);
            const count = countRow ? countRow.count : 0;

            // Cek Duplikat Nama
            const nameExists = database.get('SELECT 1 FROM user_pets WHERE user_id = ? AND guild_id = ? AND LOWER(pet_name) = LOWER(?)', [selectedTargetUserId, guildId, sanitizedName.toLowerCase()]);
            if (nameExists) {
              return sub.reply({ content: `❌ Anggota terpilih sudah memiliki pet bernama **"${sanitizedName}"**!`, flags: 64 });
            }

            const gSource = 'ADMIN';
            const gRarity = speciesInfo.rarity || 'COMMON';
            const gElement = speciesInfo.element || '';

            // Batas Maksimum Pet
            // Check if target is admin
            const targetMember = await guild.members.fetch(selectedTargetUserId).catch(() => null);
            const isTargetAdmin = (selectedTargetUserId === config.OWNER_ID) || 
                                  (config.OWNER_ID && selectedTargetUserId === config.OWNER_ID) ||
                                  (targetMember && targetMember.permissions.has(PermissionsBitField.Flags.Administrator));

            if (gRarity === 'MYTHIC') {
              const mythicCountRow = database.get(
                'SELECT COUNT(*) as count FROM user_pets WHERE user_id = ? AND guild_id = ? AND gacha_rarity = ?',
                [selectedTargetUserId, guildId, 'MYTHIC']
              );
              const mythicCount = mythicCountRow ? mythicCountRow.count : 0;
              const maxMythic = isTargetAdmin ? 999 : 2;
              if (mythicCount >= maxMythic) {
                return sub.reply({ content: `❌ Target user <@${selectedTargetUserId}> sudah memiliki batas maksimum pet MYTHIC (maksimal ${maxMythic} per user)!`, flags: 64 });
              }
            } else if (gRarity === 'IMMORTAL') {
              const immortalCountRow = database.get(
                'SELECT COUNT(*) as count FROM user_pets WHERE user_id = ? AND guild_id = ? AND gacha_rarity = ?',
                [selectedTargetUserId, guildId, 'IMMORTAL']
              );
              const immortalCount = immortalCountRow ? immortalCountRow.count : 0;
              const maxImmortal = isTargetAdmin ? 999 : 5;
              if (immortalCount >= maxImmortal) {
                return sub.reply({ content: `❌ Target user <@${selectedTargetUserId}> sudah memiliki batas maksimum pet IMMORTAL (maksimal ${maxImmortal} per user)!`, flags: 64 });
              }
            }

            // Clamping Level & Star
            pLevel = Math.max(1, pLevel);

            const pStatus = pLevel >= 10 ? 'ADULT' : 'BABY';
            const now = Math.floor(Date.now() / 1000);
            const isActive = count === 0 ? 1 : 0;
            const hatchAt = 0;

            // Calculate HP & Combat bonuses based on stars
            const baseHP = speciesInfo.baseHP || 100;
            const starMultiplier = 1 + (pStar - 1) * 0.15;
            const bonusHp = Math.round(baseHP * (starMultiplier - 1));
            const bonusAtkPct = (pStar - 1) * 0.15;
            const bonusDefPct = (pStar - 1) * 0.15;
            const maxHP = baseHP + bonusHp;

            // Auto-assign traits & XP Multiplier
            let finalTrait = pTrait;
            let finalTrait2 = '';
            let xpMultiplier = 1.0;

            if (gRarity === 'MYTHIC') {
              xpMultiplier = 1.5;
              const allTraits = ['GENIUS', 'STURDY', 'MUTANT', 'WARRIOR', 'SURVIVOR'];
              const shuffled = [...allTraits].sort(() => 0.5 - Math.random());
              finalTrait = shuffled[0];
              finalTrait2 = shuffled.slice(1, 3).join(',');
            } else if (gRarity === 'IMMORTAL') {
              xpMultiplier = 3.0;
              finalTrait = 'GENIUS';
              finalTrait2 = 'STURDY,MUTANT,WARRIOR,SURVIVOR';
            } else if (!finalTrait || finalTrait === 'NONE') {
              const traitsPool = ['GENIUS', 'STURDY', 'MUTANT', 'WARRIOR'];
              if (gRarity === 'LEGENDARY') {
                finalTrait = traitsPool[Math.floor(Math.random() * traitsPool.length)];
                const pool2 = traitsPool.filter(t => t !== finalTrait);
                finalTrait2 = pool2[Math.floor(Math.random() * pool2.length)];
              } else if (gRarity === 'EPIC') {
                finalTrait = 'SURVIVOR';
              } else if (gRarity === 'RARE') {
                finalTrait = traitsPool[Math.floor(Math.random() * traitsPool.length)];
              } else {
                finalTrait = '';
              }
            }

            const initialTp = pLevel > 1 ? (pLevel - 1) * 3 : 0;

            database.run(
              `INSERT INTO user_pets (
                user_id, guild_id, pet_name, pet_type, status, level, xp, health, hunger, thirst, happiness, 
                last_interaction_at, hatch_at, created_at, is_active, trait, 
                star_level, base_hp_bonus, base_atk_bonus_pct, base_def_bonus_pct,
                gacha_source, gacha_rarity, gacha_element, gacha_trait2, xp_multiplier, unused_tp
              ) VALUES (
                ?, ?, ?, ?, ?, ?, 0, ?, 100, 100, 100, 
                ?, ?, ?, ?, ?, 
                ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?
              )`,
              [
                selectedTargetUserId, guildId, sanitizedName, pType, pStatus, pLevel, maxHP,
                now, hatchAt, now, isActive, finalTrait,
                pStar, bonusHp, bonusAtkPct, bonusDefPct,
                gSource, gRarity, gElement, finalTrait2, xpMultiplier, initialTp
              ]
            );

            const traitText = finalTrait ? ` dengan Trait **${finalTrait}**` : '';
            const starText = petModule.renderStars(pStar);
            await sub.reply({ content: `🎁 Sukses memberikan pet baru **${sanitizedName}** (${pType}) ${starText}${traitText} level **${pLevel}** ke <@${selectedTargetUserId}>!`, flags: 64 });

            // Send global economic announcement for MYTHIC/IMMORTAL
            if (gRarity === 'MYTHIC' || gRarity === 'IMMORTAL') {
              const rarityEmoji = gRarity === 'MYTHIC' ? '🔴' : '✨';
              const rarityColor = gRarity === 'MYTHIC' ? '#FF1744' : '#FFD700';
              const allTraitsStr = [finalTrait, ...finalTrait2.split(',').filter(Boolean)].join(', ');
              await sendGlobalEconomyAnnouncement(
                client,
                guild,
                author,
                `${rarityEmoji} Pemberian Pet Legendaris ${gRarity}`,
                `🎉 Admin baru saja menciptakan dan menganugerahkan pet kasta teratas **${sanitizedName}** (${pType}) ${rarityEmoji} **${gRarity}** kepada warga kita <@${selectedTargetUserId}>! Pet ini memiliki kemampuan luar biasa dan kekuatan yang sangat dahsyat.`,
                rarityColor,
                [
                  { name: 'Penerima', value: `<@${selectedTargetUserId}>`, inline: true },
                  { name: 'Spesies', value: `${speciesInfo.name} (${pType})`, inline: true },
                  { name: 'Bintang', value: petModule.renderStars(pStar), inline: true },
                  { name: 'Trait Aktif', value: allTraitsStr || 'Tidak ada', inline: false }
                ]
              );
            }

            // Reset state and go back to main
            petPanelSubMenu = 'main';
            petGiveSpecies = null;
            petGiveTrait = null;
            petGiveStar = null;
            const fresh = getPetPanelData(guildId, selectedTargetUserId);
            await replyMsg.edit(fresh).catch(() => { });
          } catch (err) {
            await sub.reply({ content: `❌ Gagal memproses pemberian pet: ${err.message}`, flags: 64 }).catch(() => { });
          }
        }
      }
      else if (iPet.customId === 'admin_pet_select_action') {
        const action = iPet.values[0];
        if (action.startsWith('_separator_')) {
          return iPet.reply({ content: '❌ Pilihan tersebut adalah judul kategori, silakan pilih tindakan di bawahnya!', flags: 64 });
        }
        if (!selectedTargetUserId) {
          return iPet.reply({ content: '❌ Silakan pilih target anggota terlebih dahulu!', flags: 64 });
        }

        if (action === 'action_hatch_pet') {
          const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          if (!targetPet) {
            return iPet.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan!', flags: 64 });
          }
          if (targetPet.status !== 'EGG') {
            return iPet.reply({ content: '❌ Pet milik anggota terpilih sudah menetas!', flags: 64 });
          }
          const now = Math.floor(Date.now() / 1000);
          database.run('UPDATE user_pets SET hatch_at = ? WHERE user_id = ? AND guild_id = ? AND is_active = 1', [now - 10, selectedTargetUserId, guildId]);
          await iPet.reply({ content: `🐣 Sukses mempercepat penetasan telur pet **${targetPet.pet_name}** milik <@${selectedTargetUserId}>. Telur sekarang siap menetas!`, flags: 64 });
          const fresh = getPetPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => { });
        }
        else if (action === 'action_heal_pet') {
          const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          if (!targetPet) {
            return iPet.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan!', flags: 64 });
          }
          const petModule = require('./pet');
          const maxHP = petModule.getMaxHP(targetPet);
          database.run('UPDATE user_pets SET health = ?, hunger = 100, thirst = 100, happiness = 100 WHERE user_id = ? AND guild_id = ? AND is_active = 1', [maxHP, selectedTargetUserId, guildId]);
          await iPet.reply({ content: `❤️ Sukses memulihkan stats HP (${maxHP} HP), Kenyangan, & Hidrasi pet milik <@${selectedTargetUserId}> menjadi 100%.`, flags: 64 });
          const fresh = getPetPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => { });
        }
        else if (action === 'action_revive_pet') {
          const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          if (!targetPet) {
            return iPet.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan!', flags: 64 });
          }
          if (targetPet.status !== 'DEAD') {
            return iPet.reply({ content: `❌ Pet milik <@${selectedTargetUserId}> (**${targetPet.pet_name}**) masih hidup (Status: **${targetPet.status}**)!`, flags: 64 });
          }
          const petModule = require('./pet');
          const maxHP = petModule.getMaxHP(targetPet);
          const newStatus = targetPet.level >= 10 ? 'ADULT' : 'BABY';
          const now = Math.floor(Date.now() / 1000);

          database.run(
            `UPDATE user_pets 
             SET status = ?, health = ?, hunger = 100, thirst = 100, happiness = 100, last_interaction_at = ? 
             WHERE user_id = ? AND guild_id = ? AND is_active = 1`,
            [newStatus, maxHP, now, selectedTargetUserId, guildId]
          );

          await iPet.reply({ content: `💖 Sukses menghidupkan kembali pet **${targetPet.pet_name}** milik <@${selectedTargetUserId}>! Status diubah menjadi **${newStatus}** dengan HP & Kebutuhan penuh 100%.`, flags: 64 });
          const fresh = getPetPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => { });
        }
        else if (action === 'action_reset_expedition_cooldown') {
          database.run('UPDATE wallets SET daily_expedition_count = 0, expedition_cooldown_until = 0 WHERE user_id = ? AND guild_id = ?', [selectedTargetUserId, guildId]);
          await iPet.reply({ content: `🛡️ Sukses mereset batas harian & cooldown ekspedisi pet milik <@${selectedTargetUserId}>!`, flags: 64 });
          const fresh = getPetPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => { });
        }
        else if (action === 'action_give_xp_pet_modal') {
          const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          if (!targetPet) {
            return iPet.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan!', flags: 64 });
          }

          const modal = new ModalBuilder()
            .setCustomId('admin_pet_give_xp_modal')
            .setTitle('Suntik XP Pet Member');

          const xpInput = new TextInputBuilder()
            .setCustomId('xp_amount')
            .setLabel('Jumlah XP Pet')
            .setPlaceholder('Contoh: 500')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(xpInput));
          await iPet.showModal(modal);

          const sub = await iPet.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_pet_give_xp_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const amount = parseInt(sub.fields.getTextInputValue('xp_amount'));
            if (isNaN(amount) || amount <= 0) {
              return sub.reply({ content: '❌ Jumlah harus berupa angka bulat di atas 0!', flags: 64 });
            }
            const petData = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
            if (!petData) {
              return sub.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan!', flags: 64 });
            }
            let newXp = petData.xp + amount;
            let level = petData.level;
            const xpNeeded = level * 100;
            let leveledUp = false;
            if (newXp >= xpNeeded) {
              newXp -= xpNeeded;
              level += 1;
              leveledUp = true;
            }
            database.run('UPDATE user_pets SET xp = ?, level = ? WHERE user_id = ? AND guild_id = ? AND is_active = 1', [newXp, level, selectedTargetUserId, guildId]);

            await sub.reply({ content: `🧪 Sukses memberikan **+${amount} XP** ke pet milik <@${selectedTargetUserId}>!${leveledUp ? ` Pet naik ke Level **${level}**! 🎉` : ''}`, flags: 64 });
            const fresh = getPetPanelData(guildId, selectedTargetUserId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'action_set_level_pet_modal') {
          const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          if (!targetPet) {
            return iPet.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan!', flags: 64 });
          }

          const modal = new ModalBuilder()
            .setCustomId('admin_pet_set_level_modal')
            .setTitle('Atur Level Pet Member');

          const lvlInput = new TextInputBuilder()
            .setCustomId('lvl_amount')
            .setLabel('Level Pet (Min: 1)')
            .setPlaceholder('Contoh: 10')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(lvlInput));
          await iPet.showModal(modal);

          const sub = await iPet.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_pet_set_level_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const level = parseInt(sub.fields.getTextInputValue('lvl_amount'));
            if (isNaN(level) || level <= 0) {
              return sub.reply({ content: '❌ Level harus berupa angka bulat minimal 1!', flags: 64 });
            }
            const petData = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
            if (!petData) {
              return sub.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan!', flags: 64 });
            }

            let newStatus = petData.status;
            if (newStatus !== 'DEAD') {
              newStatus = level >= 10 ? 'ADULT' : (newStatus === 'EGG' ? 'EGG' : 'BABY');
            }

            const tpToAdd = Math.max(0, (level - petData.level) * 3);
            database.run('UPDATE user_pets SET level = ?, status = ?, unused_tp = unused_tp + ? WHERE user_id = ? AND guild_id = ? AND is_active = 1', [level, newStatus, tpToAdd, selectedTargetUserId, guildId]);

            await sub.reply({ content: `🦁 Sukses mengatur level pet milik <@${selectedTargetUserId}> menjadi Level **${level}**! (Status: **${newStatus}**, Sisa TP bertambah: **+${tpToAdd}**)`, flags: 64 });
            const fresh = getPetPanelData(guildId, selectedTargetUserId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'action_change_trait_pet_modal') {
          const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          if (!targetPet) {
            return iPet.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan aktif!', flags: 64 });
          }

          const modal = new ModalBuilder()
            .setCustomId('admin_pet_change_trait_modal')
            .setTitle('Modifikasi Trait Pet');

          const traitInput = new TextInputBuilder()
            .setCustomId('trait_name')
            .setLabel('Trait (MUTANT, GENIUS, STURDY, WARRIOR, NONE)')
            .setPlaceholder('Ketik nama trait atau NONE untuk menghapus')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(traitInput));
          await iPet.showModal(modal);

          const sub = await iPet.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_pet_change_trait_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const rawTrait = sub.fields.getTextInputValue('trait_name').trim().toUpperCase();
            const validTraits = ['MUTANT', 'GENIUS', 'STURDY', 'WARRIOR'];

            let finalTrait = '';
            if (rawTrait !== 'NONE' && validTraits.includes(rawTrait)) {
              finalTrait = rawTrait;
            }

            database.run('UPDATE user_pets SET trait = ? WHERE user_id = ? AND guild_id = ? AND is_active = 1', [finalTrait, selectedTargetUserId, guildId]);

            const traitMsg = finalTrait ? `menjadi Trait **${finalTrait}**` : 'menjadi **Tanpa Trait** (NONE)';
            await sub.reply({ content: `🧬 Sukses mengubah trait pet aktif milik <@${selectedTargetUserId}> ${traitMsg}!`, flags: 64 });
            const fresh = getPetPanelData(guildId, selectedTargetUserId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'action_set_gym_stats_modal') {
          const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          if (!targetPet) {
            return iPet.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan aktif!', flags: 64 });
          }

          const modal = new ModalBuilder()
            .setCustomId('admin_pet_set_gym_stats_modal')
            .setTitle('Modifikasi Stat Gym Pet');

          const strInput = new TextInputBuilder()
            .setCustomId('stat_str')
            .setLabel('Strength (STR) - Kekuatan')
            .setValue(String(targetPet.stat_str || 0))
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const vitInput = new TextInputBuilder()
            .setCustomId('stat_vit')
            .setLabel('Vitality (VIT) - HP')
            .setValue(String(targetPet.stat_vit || 0))
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const defInput = new TextInputBuilder()
            .setCustomId('stat_def')
            .setLabel('Defense (DEF) - Pertahanan')
            .setValue(String(targetPet.stat_def || 0))
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const dexInput = new TextInputBuilder()
            .setCustomId('stat_dex')
            .setLabel('Dexterity (DEX) - Kelincahan')
            .setValue(String(targetPet.stat_dex || 0))
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const tpInput = new TextInputBuilder()
            .setCustomId('unused_tp')
            .setLabel('Sisa Poin Latihan (TP)')
            .setValue(String(targetPet.unused_tp || 0))
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(strInput),
            new ActionRowBuilder().addComponents(vitInput),
            new ActionRowBuilder().addComponents(defInput),
            new ActionRowBuilder().addComponents(dexInput),
            new ActionRowBuilder().addComponents(tpInput)
          );

          await iPet.showModal(modal);

          const sub = await iPet.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_pet_set_gym_stats_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const strVal = parseInt(sub.fields.getTextInputValue('stat_str'));
            const vitVal = parseInt(sub.fields.getTextInputValue('stat_vit'));
            const defVal = parseInt(sub.fields.getTextInputValue('stat_def'));
            const dexVal = parseInt(sub.fields.getTextInputValue('stat_dex'));
            const tpVal = parseInt(sub.fields.getTextInputValue('unused_tp'));

            if (isNaN(strVal) || strVal < 0 || isNaN(vitVal) || vitVal < 0 || isNaN(defVal) || defVal < 0 || isNaN(dexVal) || dexVal < 0 || isNaN(tpVal) || tpVal < 0) {
              return sub.reply({ content: '❌ Seluruh input stat dan TP harus berupa angka bulat minimal 0!', flags: 64 });
            }

            const totalSum = strVal + vitVal + defVal + dexVal + tpVal;
            const maxAllowed = targetPet.status === 'EGG' ? 0 : (targetPet.level - 1) * 3;
            if (totalSum > maxAllowed) {
              return sub.reply({ content: `❌ Gagal! Total stat gym dan sisa TP yang dimasukkan (${totalSum}) melebihi batas level pet yaitu ${maxAllowed} TP (Pet Lv. ${targetPet.level})!`, flags: 64 });
            }

            database.run(
              `UPDATE user_pets 
               SET stat_str = ?, stat_vit = ?, stat_def = ?, stat_dex = ?, unused_tp = ? 
               WHERE user_id = ? AND guild_id = ? AND is_active = 1`,
              [strVal, vitVal, defVal, dexVal, tpVal, selectedTargetUserId, guildId]
            );

            await sub.reply({ content: `🏋️ Sukses memperbarui stat gym pet **${targetPet.pet_name}** milik <@${selectedTargetUserId}>:\n💪 STR: \`${strVal}\` | ❤️ VIT: \`${vitVal}\` | 🛡️ DEF: \`${defVal}\` | ⚡ DEX: \`${dexVal}\` | 🔴 Sisa TP: \`${tpVal}\``, flags: 64 });
            const fresh = getPetPanelData(guildId, selectedTargetUserId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'action_admin_reset_gym') {
          const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          if (!targetPet) {
            return iPet.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan aktif!', flags: 64 });
          }

          const str = targetPet.stat_str || 0;
          const vit = targetPet.stat_vit || 0;
          const def = targetPet.stat_def || 0;
          const dex = targetPet.stat_dex || 0;
          const totalAllocated = str + vit + def + dex;

          if (totalAllocated === 0) {
            return iPet.reply({ content: '❌ Pet tersebut belum memiliki alokasi stat apapun!', flags: 64 });
          }

          database.run(
            `UPDATE user_pets 
             SET stat_str = 0, stat_vit = 0, stat_def = 0, stat_dex = 0, unused_tp = unused_tp + ? 
             WHERE user_id = ? AND guild_id = ? AND is_active = 1`,
            [totalAllocated, selectedTargetUserId, guildId]
          );

          await iPet.reply({ content: `🏋️ Sukses me-reset stat gym pet **${targetPet.pet_name}** milik <@${selectedTargetUserId}> secara gratis! **${totalAllocated} TP** dikembalikan ke pool sisa TP.`, flags: 64 });
          const fresh = getPetPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => { });
        }
        else if (action === 'action_reset_activity_cooldowns') {
          const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          if (!targetPet) {
            return iPet.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan aktif!', flags: 64 });
          }

          database.run(
            `UPDATE user_pets 
             SET last_work_at = 0, last_hunt_at = 0, last_play_at = 0 
             WHERE user_id = ? AND guild_id = ? AND is_active = 1`,
            [selectedTargetUserId, guildId]
          );

          await iPet.reply({ content: `⏳ Sukses mereset cooldown Bekerja, Berburu, & Bermain pet aktif milik <@${selectedTargetUserId}> secara instan!`, flags: 64 });
          const fresh = getPetPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => { });
        }
        else if (action === 'action_toggle_vip_autofeed') {
          const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          if (!targetPet) {
            return iPet.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan aktif!', flags: 64 });
          }

          const newStatus = targetPet.auto_feed === 2 ? 0 : 2;
          database.run(
            'UPDATE user_pets SET auto_feed = ? WHERE user_id = ? AND guild_id = ? AND is_active = 1',
            [newStatus, selectedTargetUserId, guildId]
          );

          const statusMsg = newStatus === 2 ? '👑 **VIP Gratis (Auto-Feed tanpa biaya)**' : '❌ **Nonaktif**';
          await iPet.reply({ content: `🔋 Sukses mengubah mode Auto-Feed pet aktif milik <@${selectedTargetUserId}> menjadi ${statusMsg}!`, flags: 64 });
          const fresh = getPetPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => { });
        }
        else if (action === 'action_add_ticket_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_pet_add_ticket_modal')
            .setTitle('Tambah Tiket Gacha');

          const ticketInput = new TextInputBuilder()
            .setCustomId('ticket_qty')
            .setLabel('Jumlah Tiket Gacha')
            .setPlaceholder('Contoh: 5')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(ticketInput));
          await iPet.showModal(modal);

          const sub = await iPet.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_pet_add_ticket_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const qty = parseInt(sub.fields.getTextInputValue('ticket_qty'));
            if (isNaN(qty) || qty <= 0) {
              return sub.reply({ content: '❌ Jumlah harus berupa angka bulat di atas 0!', flags: 64 });
            }
            const petModule = require('./pet');
            petModule.addGachaTickets(selectedTargetUserId, guildId, qty);
            await sub.reply({ content: `🎟️ Sukses menambahkan **+${qty} Tiket Gacha** ke inventaris <@${selectedTargetUserId}>!`, flags: 64 });
            const fresh = getPetPanelData(guildId, selectedTargetUserId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'action_force_star_modal') {
          const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          if (!targetPet) {
            return iPet.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan aktif!', flags: 64 });
          }

          const modal = new ModalBuilder()
            .setCustomId('admin_pet_force_star_modal')
            .setTitle('Paksa Bintang Pet');

          const starInput = new TextInputBuilder()
            .setCustomId('star_level')
            .setLabel('Tingkat Bintang (1 - 5)')
            .setPlaceholder('Contoh: 3')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(starInput));
          await iPet.showModal(modal);

          const sub = await iPet.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_pet_force_star_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const star = parseInt(sub.fields.getTextInputValue('star_level'));
            if (isNaN(star) || star < 1 || star > 5) {
              return sub.reply({ content: '❌ Bintang harus berupa angka bulat antara 1 hingga 5!', flags: 64 });
            }
            const petModule = require('./pet');
            petModule.forceSetStar(selectedTargetUserId, guildId, targetPet.pet_name, star);
            await sub.reply({ content: `⭐ Sukses memaksa bintang pet **${targetPet.pet_name}** milik <@${selectedTargetUserId}> menjadi Bintang **${star}**!`, flags: 64 });
            const fresh = getPetPanelData(guildId, selectedTargetUserId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'action_give_custom_pet_modal') {
          // Transition to give_custom_pet sub-menu
          petPanelSubMenu = 'give_custom_pet';
          petGiveSpecies = null;
          petGiveTrait = null;
          petGiveStar = null;
          const fresh = getPetPanelData(guildId, selectedTargetUserId);
          await iPet.update(fresh);
        }
        else if (action === 'action_reset_pet') {
          const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          if (!targetPet) {
            return iPet.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan aktif untuk direset!', flags: 64 });
          }

          const confirmed = await askConfirmation(iPet, author.id, `RESET / HAPUS data pet aktif **${targetPet.pet_name}** milik <@${selectedTargetUserId}>`);
          if (!confirmed) return;

          database.transaction(() => {
            database.run('DELETE FROM user_pets WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [selectedTargetUserId, guildId, targetPet.pet_name]);
            const remainingRow = database.get('SELECT COUNT(*) as count FROM user_pets WHERE user_id = ? AND guild_id = ?', [selectedTargetUserId, guildId]);
            const remaining = remainingRow ? remainingRow.count : 0;
            if (remaining === 0) {
              database.run('DELETE FROM pet_inventory WHERE user_id = ? AND guild_id = ?', [selectedTargetUserId, guildId]);
            } else {
              const nextPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? LIMIT 1', [selectedTargetUserId, guildId]);
              if (nextPet) {
                database.run('UPDATE user_pets SET is_active = 1 WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [selectedTargetUserId, guildId, nextPet.pet_name]);
              }
            }
          })();

          await iPet.followUp({ content: `💀 Sukses menghapus data pet aktif **${targetPet.pet_name}** milik <@${selectedTargetUserId}> dari database kandang.`, flags: 64 });
          const fresh = getPetPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => { });
        }
        else if (action === 'action_set_custom_image_modal') {
          const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          if (!targetPet) {
            return iPet.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan aktif!', flags: 64 });
          }

          const modal = new ModalBuilder()
            .setCustomId('admin_pet_set_custom_image_modal')
            .setTitle('Ubah Gambar Pet Custom');

          const urlInput = new TextInputBuilder()
            .setCustomId('image_url')
            .setLabel('URL Gambar / GIF')
            .setPlaceholder('https://... (Ketik "reset" untuk hapus)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(urlInput));
          await iPet.showModal(modal);

          const sub = await iPet.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_pet_set_custom_image_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            try {
              const url = sub.fields.getTextInputValue('image_url');
              const petModule = require('./pet');
              const savedUrl = petModule.setCustomImage(selectedTargetUserId, guildId, url);

              if (savedUrl) {
                await sub.reply({ content: `📸 Sukses! Gambar pet aktif milik <@${selectedTargetUserId}> berhasil diubah secara kustom.`, flags: 64 });
              } else {
                await sub.reply({ content: `📸 Sukses mereset gambar pet aktif milik <@${selectedTargetUserId}> ke tampilan bawaan.`, flags: 64 });
              }
              const fresh = getPetPanelData(guildId, selectedTargetUserId);
              await replyMsg.edit(fresh).catch(() => { });
            } catch (err) {
              await sub.reply({ content: `❌ Gagal mengubah gambar: ${err.message}`, flags: 64 }).catch(() => { });
            }
          }
        }
        else if (action === 'action_admin_set_floor_modal') {
          const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          if (!targetPet) {
            return iPet.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan aktif!', flags: 64 });
          }

          const petModule = require('./pet');
          const towerState = petModule.getTowerState(selectedTargetUserId, guildId);

          const modal = new ModalBuilder()
            .setCustomId('admin_pet_set_floor_modal')
            .setTitle('Atur Lantai Menara Ujian');

          const floorInput = new TextInputBuilder()
            .setCustomId('floor_level')
            .setLabel('Lantai Menara (1 - 50)')
            .setValue(String(towerState.current_floor || 1))
            .setPlaceholder('Contoh: 15')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(floorInput));
          await iPet.showModal(modal);

          const sub = await iPet.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_pet_set_floor_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const floorVal = parseInt(sub.fields.getTextInputValue('floor_level'));
            if (isNaN(floorVal) || floorVal < 1 || floorVal > 50) {
              return sub.reply({ content: '❌ Lantai Menara harus berupa angka bulat antara 1 hingga 50!', flags: 64 });
            }

            database.run(
              'UPDATE user_pet_tower SET current_floor = ? WHERE user_id = ? AND guild_id = ?',
              [floorVal, selectedTargetUserId, guildId]
            );

            await sub.reply({ content: `🏰 Sukses mengatur lantai Menara Ujian pet milik <@${selectedTargetUserId}> menjadi Lantai **${floorVal}**!`, flags: 64 });
            const fresh = getPetPanelData(guildId, selectedTargetUserId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'action_admin_reset_tower_attempts') {
          const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          if (!targetPet) {
            return iPet.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan aktif!', flags: 64 });
          }

          const petModule = require('./pet');
          petModule.getTowerState(selectedTargetUserId, guildId);

          database.run(
            'UPDATE user_pet_tower SET daily_attempts = 0 WHERE user_id = ? AND guild_id = ?',
            [selectedTargetUserId, guildId]
          );

          await iPet.reply({ content: `🏰 Sukses mereset tiket percobaan harian Menara Ujian untuk <@${selectedTargetUserId}> menjadi **0/5**!`, flags: 64 });
          const fresh = getPetPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => { });
        }
        else if (action === 'action_admin_spawn_boss_modal') {
          const petModule = require('./pet');
          const weekStart = petModule.getWeekStartString();
          let currentBoss = database.get('SELECT * FROM world_boss WHERE guild_id = ? AND week_start = ?', [guildId, weekStart]);

          const modal = new ModalBuilder()
            .setCustomId('admin_pet_spawn_boss_modal')
            .setTitle('Spawn/Edit World Boss Mingguan');

          const nameInput = new TextInputBuilder()
            .setCustomId('boss_name')
            .setLabel('Nama World Boss')
            .setValue(currentBoss ? currentBoss.boss_name : '🌋 Volcanus Custom')
            .setPlaceholder('Contoh: 🌋 Volcanus, ⛰️ Terrasaur')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const elementInput = new TextInputBuilder()
            .setCustomId('boss_element')
            .setLabel('Elemen Boss (FIRE/WATER/EARTH/DRAGON)')
            .setValue(currentBoss ? currentBoss.boss_type : 'FIRE')
            .setPlaceholder('Pilih salah satu: FIRE, WATER, EARTH, DRAGON')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const maxHpInput = new TextInputBuilder()
            .setCustomId('boss_max_hp')
            .setLabel('Max HP Boss')
            .setValue(currentBoss ? String(currentBoss.max_hp) : '5000000')
            .setPlaceholder('Jumlah HP maksimum')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const curHpInput = new TextInputBuilder()
            .setCustomId('boss_cur_hp')
            .setLabel('Current HP Boss (Kosongkan = Max HP)')
            .setValue(currentBoss ? String(currentBoss.current_hp) : '')
            .setPlaceholder('HP saat ini')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(nameInput),
            new ActionRowBuilder().addComponents(elementInput),
            new ActionRowBuilder().addComponents(maxHpInput),
            new ActionRowBuilder().addComponents(curHpInput)
          );

          await iPet.showModal(modal);

          const sub = await iPet.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_pet_spawn_boss_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const bName = sub.fields.getTextInputValue('boss_name').trim();
            const bEl = sub.fields.getTextInputValue('boss_element').trim().toUpperCase();
            const bMaxHp = parseInt(sub.fields.getTextInputValue('boss_max_hp'));
            let bCurHp = parseInt(sub.fields.getTextInputValue('boss_cur_hp'));

            if (!['FIRE', 'WATER', 'EARTH', 'DRAGON'].includes(bEl)) {
              return sub.reply({ content: '❌ Elemen Boss tidak valid! Harus salah satu dari: FIRE, WATER, EARTH, DRAGON.', flags: 64 });
            }
            if (isNaN(bMaxHp) || bMaxHp <= 0) {
              return sub.reply({ content: '❌ Max HP Boss harus berupa angka bulat positif!', flags: 64 });
            }
            if (isNaN(bCurHp)) {
              bCurHp = bMaxHp;
            } else if (bCurHp < 0 || bCurHp > bMaxHp) {
              return sub.reply({ content: '❌ Current HP Boss harus di antara 0 dan Max HP!', flags: 64 });
            }

            const now = Math.floor(Date.now() / 1000);

            // Check if boss already exists
            const exists = database.get('SELECT 1 FROM world_boss WHERE guild_id = ? AND week_start = ?', [guildId, weekStart]);
            if (exists) {
              database.run(
                'UPDATE world_boss SET boss_name = ?, boss_type = ?, max_hp = ?, current_hp = ?, status = ? WHERE guild_id = ? AND week_start = ?',
                [bName, bEl, bMaxHp, bCurHp, bCurHp === 0 ? 'DEFEATED' : 'ACTIVE', guildId, weekStart]
              );
            } else {
              database.run(
                'INSERT INTO world_boss (guild_id, week_start, boss_name, boss_type, max_hp, current_hp, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [guildId, weekStart, bName, bEl, bMaxHp, bCurHp, bCurHp === 0 ? 'DEFEATED' : 'ACTIVE', now]
              );
            }

            if (bCurHp === 0) {
              petModule.distributeWorldBossRewards(guildId, null, weekStart);
            }

            await sub.reply({ content: `👹 Sukses men-spawn/mengedit World Boss minggu ini (**${weekStart}**):\n• Nama: **${bName}**\n• Elemen: **${bEl}**\n• HP: \`${bCurHp}/${bMaxHp}\` (${bCurHp === 0 ? 'Kalah' : 'Aktif'})`, flags: 64 });
            const fresh = getPetPanelData(guildId, selectedTargetUserId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'action_admin_kill_boss') {
          const petModule = require('./pet');
          const weekStart = petModule.getWeekStartString();

          const boss = database.get('SELECT * FROM world_boss WHERE guild_id = ? AND week_start = ?', [guildId, weekStart]);
          if (!boss) {
            return iPet.reply({ content: '❌ Tidak ada World Boss aktif minggu ini untuk dikalahkan!', flags: 64 });
          }

          if (boss.status === 'DISTRIBUTED' || boss.current_hp === 0) {
            return iPet.reply({ content: '❌ World Boss minggu ini sudah dikalahkan atau hadiahnya sudah dibagikan!', flags: 64 });
          }

          // Force kill: Set HP to 0 and status to DEFEATED
          database.run(
            "UPDATE world_boss SET current_hp = 0, status = 'DEFEATED' WHERE guild_id = ? AND week_start = ?",
            [guildId, weekStart]
          );

          // Distribute rewards
          const res = petModule.distributeWorldBossRewards(guildId, null, weekStart);

          let rewardMsg = `☠️ Sukses mengalahkan World Boss **${boss.boss_name}** secara paksa!\n`;
          if (res && res.totalRewarded > 0) {
            rewardMsg += `🎁 Hadiah telah didistribusikan ke **${res.totalRewarded}** partisipan.`;
          } else {
            rewardMsg += `⚠️ Tidak ada partisipan yang terdaftar untuk menerima hadiah minggu ini.`;
          }

          await iPet.reply({ content: rewardMsg, flags: 64 });
          const fresh = getPetPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => { });
        }
      }
    } catch (err) {
      console.error('Error in Pet Panel Interaction:', err);
      await iPet.reply({ content: `❌ Terjadi kesalahan: ${err.message}`, flags: 64 }).catch(() => { });
    }
  });

  collector.on('end', async (collected, reason) => {
    if (reason === 'transition') return;
    try {
      const fresh = getPetPanelData(guildId, selectedTargetUserId);
      fresh.components = [];
      await replyMsg.edit(fresh).catch(() => { });
    } catch (e) { }
  });

  return true;
}

/**
 * 🏆 12. SUB-PANEL TURNAMEN PET (ADMIN CUP)
 */
function getTournamentPanelDataShared(gId, state, client, isPermanentChannel) {
  const tournament = require('./tournament');
  const event = database.get('SELECT * FROM tournament_events WHERE guild_id = ?', [gId]);

  let embed = new EmbedBuilder()
    .setColor(0x4F46E5) // Premium Indigo
    .setThumbnail(client.user.displayAvatarURL())
    .setTimestamp()
    .setFooter({ text: 'Sentinel Admin • Pengelolaan Turnamen PvP Pet' });

  if (state.currentSubMenu === 'main') {
    if (!event) {
      // Dapatkan data pemenang terakhir dari ebyus_settings
      const settings = database.get('SELECT last_cup_juara_1, last_cup_juara_2, last_cup_juara_3, last_cup_juara_4 FROM ebyus_settings WHERE guild_id = ?', [gId]);
      
      let winnersText = '*Belum ada riwayat pemenang turnamen terakhir.*';
      if (settings && (settings.last_cup_juara_1 || settings.last_cup_juara_2 || settings.last_cup_juara_3 || settings.last_cup_juara_4)) {
        winnersText = 
          `🥇 Juara 1: ${settings.last_cup_juara_1 ? `<@${settings.last_cup_juara_1}>` : '-'}\n` +
          `🥈 Juara 2: ${settings.last_cup_juara_2 ? `<@${settings.last_cup_juara_2}>` : '-'}\n` +
          `🥉 Juara 3: ${settings.last_cup_juara_3 ? `<@${settings.last_cup_juara_3}>` : '-'}\n` +
          `🏅 Juara 4: ${settings.last_cup_juara_4 ? `<@${settings.last_cup_juara_4}>` : '-'}`;
      }

      embed.setTitle('🏆 ADMIN CONTROL PANEL — TURNAMEN LIGA PET')
        .setDescription(
          `Tidak ada turnamen PvP Pet yang aktif di server saat ini.\n\n` +
          `🏆 **RIWAYAT PEMENANG TERAKHIR:**\n${winnersText}\n\n` +
          `Silakan klik tombol di bawah untuk memulai turnamen baru atau membagikan hadiah ke para pemenang.`
        );

      const btnComponents = [
        new ButtonBuilder()
          .setCustomId('admin_tournament_btn_start')
          .setLabel('🏆 Mulai Turnamen')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('admin_tournament_btn_rewards')
          .setLabel('🎁 Bagikan Hadiah')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(false),
        new ButtonBuilder()
          .setCustomId('admin_tournament_btn_auto_rewards')
          .setLabel('⚙️ Hadiah Otomatis')
          .setStyle(ButtonStyle.Secondary)
      ];

      if (!isPermanentChannel) {
        btnComponents.push(
          new ButtonBuilder()
            .setCustomId('admin_tournament_btn_back')
            .setLabel('🔙 Kembali ke Hub')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('admin_tournament_btn_close')
            .setLabel('❌ Tutup Panel')
            .setStyle(ButtonStyle.Danger)
        );
      }

      const btnRow = new ActionRowBuilder().addComponents(btnComponents);
      return { embeds: [embed], components: [btnRow] };
    }

    const isPaused = event.is_paused === 1;
    const statusLabel = event.status;

    const activeMatch = database.get(
      'SELECT * FROM tournament_matches WHERE guild_id = ? AND match_status = \'ACTIVE\' LIMIT 1',
      [gId]
    );

    let activeMatchText = '*Tidak ada pertandingan aktif saat ini.*';
    if (activeMatch) {
      const p1 = database.get('SELECT pet_name FROM tournament_participants WHERE guild_id = ? AND user_id = ?', [gId, activeMatch.player_1_id]);
      const p2 = database.get('SELECT pet_name FROM tournament_participants WHERE guild_id = ? AND user_id = ?', [gId, activeMatch.player_2_id]);
      activeMatchText = `⚔️ **Match #${activeMatch.match_id}:** **${p1?.pet_name || 'Pet 1'}** vs **${p2?.pet_name || 'Pet 2'}**\nStadium: <#${activeMatch.thread_id}>`;

      if (client && client.activeCupMatches) {
        const combat = client.activeCupMatches.get(activeMatch.match_id);
        if (combat) {
          activeMatchText += `\n⏳ **Status Duel (Turn ${combat.turnCount}):**\n` +
            `• 🔴 Challenger HP: \`${combat.player1.hp}/${combat.player1.maxHP}\`\n` +
            `• 🔵 Opponent HP: \`${combat.player2.hp}/${combat.player2.maxHP}\``;
        }
      }
    }

    embed.setTitle('🏆 ADMIN CONTROL PANEL — TURNAMEN LIGA PET')
      .setColor(isPaused ? 0xF59E0B : 0x10B981)
      .setDescription(
        `Kelola jalannya turnamen/liga PvP Pet server secara real-time:\n\n` +
        `📶 **STATUS LIGA:**\n` +
        `• Status: \`${statusLabel}\` ${isPaused ? '⏸️ **(JEDA)**' : '▶️ **(BERJALAN)**'}\n` +
        `• Ronde Aktif: Ronde **${event.current_round}**\n\n` +
        `⚔️ **PERTANDINGAN AKTIF:**\n${activeMatchText}`
      );

    const btnRow1 = new ActionRowBuilder();
    if (isPaused) {
      btnRow1.addComponents(
        new ButtonBuilder()
          .setCustomId('admin_tournament_btn_resume')
          .setLabel('▶️ Resume')
          .setStyle(ButtonStyle.Success)
      );
    } else {
      btnRow1.addComponents(
        new ButtonBuilder()
          .setCustomId('admin_tournament_btn_pause')
          .setLabel('⏸️ Pause')
          .setStyle(ButtonStyle.Secondary)
      );
    }

    // Cek apakah turnamen sedang berlangsung (status PLAYING)
    const isTournamentPlaying = event.status === 'PLAYING';
    
    // Cek apakah ada pertandingan yang tersedia (aktif atau akan dimulai)
    const anyMatchAvailable = database.get(
      'SELECT match_id FROM tournament_matches WHERE guild_id = ? AND match_status IN (\'PENDING\', \'ACTIVE\') LIMIT 1',
      [gId]
    );
    
    const canControlMatch = isTournamentPlaying && (activeMatch || anyMatchAvailable);

    btnRow1.addComponents(
      new ButtonBuilder()
        .setCustomId('admin_tournament_btn_reroll')
        .setLabel('🔄 Re-roll Match')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!activeMatch),
      new ButtonBuilder()
        .setCustomId('admin_tournament_btn_dq')
        .setLabel('⚠️ DQ Player')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!canControlMatch),
      new ButtonBuilder()
        .setCustomId('admin_tournament_btn_forcewin')
        .setLabel('👑 Force Win')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!canControlMatch)
    );

    const btnComponents2 = [
      new ButtonBuilder()
        .setCustomId('admin_tournament_btn_extend')
        .setLabel('⏱️ Perpanjang Registrasi')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(statusLabel !== 'REGISTERING'),
      new ButtonBuilder()
        .setCustomId('admin_tournament_btn_auto_rewards')
        .setLabel('⚙️ Hadiah Otomatis')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('admin_tournament_btn_stop')
        .setLabel('❌ Batalkan Turnamen')
        .setStyle(ButtonStyle.Danger)
    ];

    if (!isPermanentChannel) {
      btnComponents2.push(
        new ButtonBuilder()
          .setCustomId('admin_tournament_btn_back')
          .setLabel('🔙 Kembali ke Hub')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('admin_tournament_btn_close')
          .setLabel('❌ Tutup Panel')
          .setStyle(ButtonStyle.Danger)
      );
    }

    const btnRow2 = new ActionRowBuilder().addComponents(btnComponents2);
    return { embeds: [embed], components: [btnRow1, btnRow2] };
  }

  if (state.currentSubMenu === 'rewards') {
    const settings = database.get('SELECT last_cup_juara_1, last_cup_juara_2, last_cup_juara_3, last_cup_juara_4 FROM ebyus_settings WHERE guild_id = ?', [gId]);

    embed.setTitle('🎁 BAGIKAN HADIAH TURNAMEN LIGA PET')
      .setDescription(
        `Silakan pilih pemenang turnamen yang ingin diberikan hadiah di bawah ini.\n` +
        `Anda juga dapat memilih member lain secara manual jika dibutuhkan.\n\n` +
        `🏆 **RIWAYAT PEMENANG TERAKHIR:**\n` +
        `• 🥇 Juara 1: ${settings?.last_cup_juara_1 ? `<@${settings.last_cup_juara_1}>` : '-'}\n` +
        `• 🥈 Juara 2: ${settings?.last_cup_juara_2 ? `<@${settings.last_cup_juara_2}>` : '-'}\n` +
        `• 🥉 Juara 3: ${settings?.last_cup_juara_3 ? `<@${settings.last_cup_juara_3}>` : '-'}\n` +
        `• 🏅 Juara 4: ${settings?.last_cup_juara_4 ? `<@${settings.last_cup_juara_4}>` : '-'}\n\n` +
        `🎯 **TARGET PENERIMA:** ${state.selectedRewardUserId ? `<@${state.selectedRewardUserId}> (${state.selectedRewardUserLabel})` : '*Belum dipilih*'}`
      );

    const selectWinnerMenu = new StringSelectMenuBuilder()
      .setCustomId('admin_tournament_rewards_select_winner')
      .setPlaceholder('🏆 Pilih Juara Pemenang...');

    if (settings?.last_cup_juara_1) selectWinnerMenu.addOptions({ label: '🥇 Juara 1', value: `winner_1_${settings.last_cup_juara_1}` });
    if (settings?.last_cup_juara_2) selectWinnerMenu.addOptions({ label: '🥈 Juara 2', value: `winner_2_${settings.last_cup_juara_2}` });
    if (settings?.last_cup_juara_3) selectWinnerMenu.addOptions({ label: '🥉 Juara 3', value: `winner_3_${settings.last_cup_juara_3}` });
    if (settings?.last_cup_juara_4) selectWinnerMenu.addOptions({ label: '🏅 Juara 4', value: `winner_4_${settings.last_cup_juara_4}` });
    selectWinnerMenu.addOptions({ label: '👤 Pilih User Lain Manual', value: 'winner_manual' });

    const row1 = new ActionRowBuilder().addComponents(selectWinnerMenu);

    const selectCategoryMenu = new StringSelectMenuBuilder()
      .setCustomId('admin_tournament_rewards_select_category')
      .setPlaceholder('🎁 Pilih Kategori Hadiah...')
      .setDisabled(!state.selectedRewardUserId);

    selectCategoryMenu.addOptions(
      { label: '💰 Uang (Saldo Bank)', value: 'cat_money', description: 'Tambahkan saldo bank koin ke pemenang' },
      { label: '🎒 Item', value: 'cat_item', description: 'Tambahkan item ke inventaris pemenang' },
      { label: '🐾 Pet (Peliharaan)', value: 'cat_pet', description: 'Berikan pet kustom baru ke pemenang' }
    );

    const row2 = new ActionRowBuilder().addComponents(selectCategoryMenu);

    // User Select Menu fallback jika manual
    let rowUserSelect = null;
    if (state.selectedRewardUserLabel === 'Manual Select') {
      const userSelect = new UserSelectMenuBuilder()
        .setCustomId('admin_tournament_rewards_user_select')
        .setPlaceholder('👤 Cari dan Pilih User...');
      rowUserSelect = new ActionRowBuilder().addComponents(userSelect);
    }

    const btnComponents = [
      new ButtonBuilder()
        .setCustomId('admin_tournament_rewards_btn_back_main')
        .setLabel('🔙 Kembali')
        .setStyle(ButtonStyle.Secondary)
    ];
    if (!isPermanentChannel) {
      btnComponents.push(
        new ButtonBuilder()
          .setCustomId('admin_tournament_btn_close')
          .setLabel('❌ Tutup Panel')
          .setStyle(ButtonStyle.Danger)
      );
    }

    const btnRow = new ActionRowBuilder().addComponents(btnComponents);

    const components = [];
    components.push(row1);
    if (rowUserSelect) components.push(rowUserSelect);
    components.push(row2);
    components.push(btnRow);

    return { embeds: [embed], components };
  }

  if (state.currentSubMenu === 'reward_money') {
    embed.setTitle('💰 BERIKAN HADIAH UANG (SALDO BANK)')
      .setDescription(
        `Pilih nominal uang (saldo bank) yang ingin diberikan kepada target:\n` +
        `🎯 **Target:** <@${state.selectedRewardUserId}> (${state.selectedRewardUserLabel})`
      );

    const moneySelect = new StringSelectMenuBuilder()
      .setCustomId('admin_tournament_rewards_select_money')
      .setPlaceholder('💰 Pilih Nominal Saldo...');

    moneySelect.addOptions(
      { label: '💰 Rp 1.000', value: '1000' },
      { label: '💰 Rp 2.000', value: '2000' },
      { label: '💰 Rp 4.000 (Hadiah Juara 3)', value: '4000' },
      { label: '💰 Rp 5.000', value: '5000' },
      { label: '💰 Rp 8.000 (Hadiah Juara 2)', value: '8000' },
      { label: '💰 Rp 10.000 (Hadiah Juara 1)', value: '10000' },
      { label: '💰 Rp 15.000', value: '15000' },
      { label: '💰 Rp 20.000', value: '20000' },
      { label: '💰 Rp 50.000', value: '50000' },
      { label: '💰 Rp 100.000', value: '100000' },
      { label: '💰 Rp 250.000', value: '250000' },
      { label: '💰 Rp 500.000', value: '500000' }
    );

    const row1 = new ActionRowBuilder().addComponents(moneySelect);
    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_tournament_rewards_btn_back_rewards')
        .setLabel('🔙 Kembali')
        .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row1, btnRow] };
  }

  if (state.currentSubMenu === 'reward_item') {
    embed.setTitle('🎒 BERIKAN HADIAH ITEM')
      .setDescription(
        `Pilih item yang ingin diberikan kepada target:\n` +
        `🎯 **Target:** <@${state.selectedRewardUserId}> (${state.selectedRewardUserLabel})`
      );

    const itemSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_tournament_rewards_select_item')
      .setPlaceholder('🎒 Pilih Item...');

    const items = [
      { label: 'XP Booster 8x', value: 'XP_8X' },
      { label: 'XP Booster 4x', value: 'XP_4X' },
      { label: 'Premium Food', value: 'FOOD_PREMIUM' },
      { label: 'Pet Medicine', value: 'MEDICINE' },
      { label: 'Lucky Amulet', value: 'LUCKY_AMULET' },
      { label: 'Pet Soap', value: 'SOAP_PET' },
      { label: 'Basic Food', value: 'FOOD_BASIC' },
      { label: 'Lockpick', value: 'LOCKPICK' },
      { label: 'Soap (User)', value: 'SOAP' }
    ];

    items.forEach(it => {
      itemSelect.addOptions({ label: it.label, value: it.value });
    });

    const row1 = new ActionRowBuilder().addComponents(itemSelect);
    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_tournament_rewards_btn_back_rewards')
        .setLabel('🔙 Kembali')
        .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row1, btnRow] };
  }

  if (state.currentSubMenu === 'reward_qty') {
    embed.setTitle('🔢 PILIH JUMLAH/KUANTITAS ITEM')
      .setDescription(
        `Pilih kuantitas untuk item **${state.selectedRewardItemId}** yang akan diberikan:\n` +
        `🎯 **Target:** <@${state.selectedRewardUserId}> (${state.selectedRewardUserLabel})`
      );

    const qtySelect = new StringSelectMenuBuilder()
      .setCustomId('admin_tournament_rewards_select_qty')
      .setPlaceholder('🔢 Pilih Kuantitas...');

    qtySelect.addOptions(
      { label: '1 Pcs', value: '1' },
      { label: '2 Pcs', value: '2' },
      { label: '3 Pcs', value: '3' },
      { label: '5 Pcs', value: '5' },
      { label: '10 Pcs', value: '10' },
      { label: '25 Pcs', value: '25' },
      { label: '50 Pcs', value: '50' }
    );

    const row1 = new ActionRowBuilder().addComponents(qtySelect);
    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_tournament_rewards_btn_back_item')
        .setLabel('🔙 Kembali')
        .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row1, btnRow] };
  }

  if (state.currentSubMenu === 'reward_pet_species') {
    embed.setTitle('🐾 BERIKAN HADIAH PET — PILIH SPESIES')
      .setDescription(
        `Pilih spesies pet yang ingin diberikan kepada target:\n` +
        `🎯 **Target:** <@${state.selectedRewardUserId}> (${state.selectedRewardUserLabel})`
      );

    const speciesSelect1 = new StringSelectMenuBuilder()
      .setCustomId('admin_tournament_rewards_pet_species')
      .setPlaceholder('🐾 Pilih Spesies Standard (Common - Legendary)...');

    const speciesSelect2 = new StringSelectMenuBuilder()
      .setCustomId('admin_tournament_rewards_pet_species_immortal')
      .setPlaceholder('✨ Pilih Spesies Khusus (Mythic & Immortal)...');

    const petModule = require('./pet');
    const speciesList = Object.keys(petModule.GACHA_SPECIES);
    speciesList.forEach(sp => {
      const spec = petModule.GACHA_SPECIES[sp];
      const rarity = spec.rarity || 'COMMON';
      const option = {
        label: `${spec.emoji || '🐾'} ${spec.name} (${sp})`,
        value: sp
      };
      if (rarity === 'MYTHIC' || rarity === 'IMMORTAL') {
        speciesSelect2.addOptions(option);
      } else {
        speciesSelect1.addOptions(option);
      }
    });

    const row1 = new ActionRowBuilder().addComponents(speciesSelect1);
    const row2 = new ActionRowBuilder().addComponents(speciesSelect2);
    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_tournament_rewards_btn_back_rewards')
        .setLabel('🔙 Kembali')
        .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row1, row2, btnRow] };
  }

  if (state.currentSubMenu === 'reward_pet_trait') {
    embed.setTitle('🐾 BERIKAN HADIAH PET — PILIH TRAIT')
      .setDescription(
        `Pilih Trait utama untuk pet **${state.petGiveSpecies}**:\n` +
        `🎯 **Target:** <@${state.selectedRewardUserId}> (${state.selectedRewardUserLabel})`
      );

    const traitSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_tournament_rewards_pet_trait')
      .setPlaceholder('🧬 Pilih Trait...');

    const traits = [
      { label: 'GENIUS (+XP)', value: 'GENIUS' },
      { label: 'STURDY (-Damage)', value: 'STURDY' },
      { label: 'MUTANT (+SPD)', value: 'MUTANT' },
      { label: 'WARRIOR (+ATK)', value: 'WARRIOR' },
      { label: 'SURVIVOR (+HP)', value: 'SURVIVOR' },
      { label: 'Tanpa Trait', value: 'NONE' }
    ];

    traits.forEach(tr => {
      traitSelect.addOptions({ label: tr.label, value: tr.value });
    });

    const row1 = new ActionRowBuilder().addComponents(traitSelect);
    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_tournament_rewards_btn_back_pet_species')
        .setLabel('🔙 Kembali')
        .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row1, btnRow] };
  }

  if (state.currentSubMenu === 'reward_pet_star') {
    const petModule = require('./pet');
    const traitLabel = state.petGiveTrait || 'NONE';

    embed.setTitle('🐾 BERIKAN HADIAH PET — PILIH BINTANG')
      .setDescription(
        `Pilih tingkatan Bintang (Star Level) pet:\n` +
        `• Target: <@${state.selectedRewardUserId}> (${state.selectedRewardUserLabel})\n` +
        `• Pet: **${state.petGiveSpecies}** (Trait: **${traitLabel}**)`
      );

    const starSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_tournament_rewards_pet_star')
      .setPlaceholder('⭐ Pilih Tingkat Bintang...');

    for (let s = 1; s <= 5; s++) {
      starSelect.addOptions({
        label: `${'⭐'.repeat(s)} (${s} Bintang)`,
        value: String(s)
      });
    }

    const row1 = new ActionRowBuilder().addComponents(starSelect);

    const allSelected = state.petGiveSpecies && state.petGiveTrait && state.petGiveStar;
    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_tournament_rewards_pet_confirm')
        .setLabel('🎁 Konfirmasi & Masukkan Nama')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!allSelected),
      new ButtonBuilder()
        .setCustomId('admin_tournament_rewards_btn_back_pet_trait')
        .setLabel('🔙 Kembali')
        .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row1, btnRow] };
  }

  if (state.currentSubMenu === 'auto_rewards_config') {
    const rewards = database.get(
      `SELECT tour_reward_coin_1, tour_reward_item_1, tour_reward_qty_1,
              tour_reward_coin_2, tour_reward_item_2, tour_reward_qty_2,
              tour_reward_coin_3, tour_reward_item_3, tour_reward_qty_3,
              tour_reward_coin_part, tour_reward_item_part, tour_reward_qty_part
       FROM ebyus_settings WHERE guild_id = ?`,
      [gId]
    );

    const r1Coin = rewards?.tour_reward_coin_1 ?? 10000;
    const r1Item = rewards?.tour_reward_item_1 ?? 'XP_8X';
    const r1Qty = rewards?.tour_reward_qty_1 ?? 1;

    const r2Coin = rewards?.tour_reward_coin_2 ?? 8000;
    const r2Item = rewards?.tour_reward_item_2 ?? 'XP_4X';
    const r2Qty = rewards?.tour_reward_qty_2 ?? 1;

    const r3Coin = rewards?.tour_reward_coin_3 ?? 4000;
    const r3Item = rewards?.tour_reward_item_3 ?? 'FOOD_PREMIUM';
    const r3Qty = rewards?.tour_reward_qty_3 ?? 1;

    const rpCoin = rewards?.tour_reward_coin_part ?? 1000;
    const rpItem = rewards?.tour_reward_item_part ?? 'FOOD_BASIC';
    const rpQty = rewards?.tour_reward_qty_part ?? 1;

    embed.setTitle('⚙️ PENGATURAN HADIAH OTOMATIS')
      .setDescription(
        `Atur koin dan item yang akan dikirim secara otomatis kepada pemenang & peserta saat turnamen selesai.\n` +
        `Koin dikirim ke tabungan bank. Item dikirim ke inventaris.\n\n` +
        `🥇 **JUARA 1:**\n` +
        `• Koin: **Rp ${r1Coin.toLocaleString('id-ID')}**\n` +
        `• Item: \`${r1Item}\` (Qty: ${r1Qty})\n\n` +
        `🥈 **JUARA 2:**\n` +
        `• Koin: **Rp ${r2Coin.toLocaleString('id-ID')}**\n` +
        `• Item: \`${r2Item}\` (Qty: ${r2Qty})\n\n` +
        `🥉 **JUARA 3:**\n` +
        `• Koin: **Rp ${r3Coin.toLocaleString('id-ID')}**\n` +
        `• Item: \`${r3Item}\` (Qty: ${r3Qty})\n\n` +
        `👥 **PARTISIPAN/PESERTA:**\n` +
        `• Koin: **Rp ${rpCoin.toLocaleString('id-ID')}**\n` +
        `• Item: \`${rpItem}\` (Qty: ${rpQty})\n\n` +
        `*Ketik NONE pada nama item jika tidak ingin memberikan hadiah item pada tier tersebut.*`
      );

    const btnRow1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_tournament_auto_reward_btn_1')
        .setLabel('🥇 Juara 1')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('admin_tournament_auto_reward_btn_2')
        .setLabel('🥈 Juara 2')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('admin_tournament_auto_reward_btn_3')
        .setLabel('🥉 Juara 3')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('admin_tournament_auto_reward_btn_part')
        .setLabel('👥 Peserta')
        .setStyle(ButtonStyle.Primary)
    );

    const btnRow2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_tournament_rewards_btn_back_main')
        .setLabel('🔙 Kembali')
        .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [btnRow1, btnRow2] };
  }

  if (state.currentSubMenu === 'select_auto_reward_item') {
    const tier = state.editingRewardTier || '1';
    const labelMap = {
      '1': 'Juara 1',
      '2': 'Juara 2',
      '3': 'Juara 3',
      'part': 'Partisipan/Peserta'
    };
    const label = labelMap[tier] || 'Hadiah';

    embed.setTitle(`⚙️ PILIH ITEM HADIAH - ${label.toUpperCase()}`)
      .setDescription(
        `Pilih item yang ingin diberikan sebagai hadiah otomatis untuk **${label}** dari menu di bawah ini.\n` +
        `Setelah memilih item, Anda akan diminta mengisi jumlah koin dan kuantitas item melalui modal.`
      );

    const itemOptions = [
      new StringSelectMenuOptionBuilder().setLabel('Tidak Ada Hadiah Item').setValue('NONE').setDescription('Hanya memberikan hadiah koin'),
      new StringSelectMenuOptionBuilder().setLabel('🎟️ Tiket Gacha Pet').setValue('TICKET_GACHA').setDescription('Tiket gacha pet di Toko'),
      new StringSelectMenuOptionBuilder().setLabel('⚡ XP Booster 8x').setValue('XP_8X').setDescription('Booster XP Pet 8x'),
      new StringSelectMenuOptionBuilder().setLabel('⚡ XP Booster 6x').setValue('XP_6X').setDescription('Booster XP Pet 6x'),
      new StringSelectMenuOptionBuilder().setLabel('⚡ XP Booster 4x').setValue('XP_4X').setDescription('Booster XP Pet 4x'),
      new StringSelectMenuOptionBuilder().setLabel('⚡ XP Booster 2x').setValue('XP_2X').setDescription('Booster XP Pet 2x'),
      new StringSelectMenuOptionBuilder().setLabel('🔮 Jimat Keberuntungan').setValue('LUCKY_AMULET').setDescription('Penyelamat Pet dari kematian'),
      new StringSelectMenuOptionBuilder().setLabel('⚔️ Pedang Mainan').setValue('SWORD_TOY').setDescription('Aksesoris Pet: +15% PvP DMG'),
      new StringSelectMenuOptionBuilder().setLabel('🛡️ Tameng Mainan').setValue('SHIELD_TOY').setDescription('Aksesoris Pet: -15% PvP DMG Taken'),
      new StringSelectMenuOptionBuilder().setLabel('🪮 Kalung Besi').setValue('COLLAR_IRON').setDescription('Aksesoris Pet: -15% Status Decay'),
      new StringSelectMenuOptionBuilder().setLabel('🥩 Daging Premium').setValue('FOOD_PREMIUM').setDescription('Pakan Pet: +70 Kenyangan, +10 HP'),
      new StringSelectMenuOptionBuilder().setLabel('🍗 Pakan Pet Biasa').setValue('FOOD_BASIC').setDescription('Pakan Pet: +30 Kenyangan'),
      new StringSelectMenuOptionBuilder().setLabel('💊 Ramuan Kesehatan').setValue('MEDICINE').setDescription('Obat Pet: +50 HP, Sembuh Sakit'),
      new StringSelectMenuOptionBuilder().setLabel('⚽ Bola Karet').setValue('TOY').setDescription('Mainan Pet: +50 Kebahagiaan'),
      new StringSelectMenuOptionBuilder().setLabel('🥤 Soda Energi Pet').setValue('SODA_ENERGY').setDescription('Minuman Pet: Hapus CD Kerja/Hunt'),
      new StringSelectMenuOptionBuilder().setLabel('🧼 Sabun Mandi Pet').setValue('SOAP_PET').setDescription('Kebersihan Pet: +5 Kebahagiaan'),
      new StringSelectMenuOptionBuilder().setLabel('🗝️ Linggis / Lockpick').setValue('LOCKPICK').setDescription('Item Heist / Robbery'),
      new StringSelectMenuOptionBuilder().setLabel('🎭 Topeng Samaran').setValue('MASK').setDescription('Item Heist / Robbery'),
      new StringSelectMenuOptionBuilder().setLabel('🥩 Daging Bius').setValue('MEAT').setDescription('Item Heist / Robbery'),
      new StringSelectMenuOptionBuilder().setLabel('🧼 Sabun Licin').setValue('SOAP').setDescription('Item Heist / Robbery'),
      new StringSelectMenuOptionBuilder().setLabel('🛡️ Brankas Anti-Hacker').setValue('BRANKAS').setDescription('Item Heist / Robbery')
    ];

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('admin_tournament_rewards_select_item')
      .setPlaceholder('👉 Pilih item hadiah...')
      .addOptions(itemOptions);

    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_tournament_rewards_btn_back_rewards')
        .setLabel('🔙 Batal')
        .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [selectRow, btnRow] };
  }
}

/**
 * Memperbarui panel turnamen persisten di channel khusus (jika dikonfigurasi).
 */
async function updatePersistentTournamentPanel(guildId, client) {
  const settings = database.get('SELECT tournament_admin_channel_id FROM ebyus_settings WHERE guild_id = ?', [guildId]);
  if (!settings || !settings.tournament_admin_channel_id) return;

  const channel = client.channels.cache.get(settings.tournament_admin_channel_id) || await client.channels.fetch(settings.tournament_admin_channel_id).catch(() => null);
  if (!channel) return;

  const msgs = await channel.messages.fetch({ limit: 5 }).catch(() => null);
  if (!msgs) return;

  const botMsg = msgs.find(m => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title && m.embeds[0].title.includes('ADMIN CONTROL PANEL'));

  const defaultState = {
    currentSubMenu: 'main',
    selectedRewardUserId: null,
    selectedRewardUserLabel: '',
    selectedRewardItemId: null,
    selectedRewardItemQty: null,
    petGiveSpecies: null,
    petGiveTrait: null,
    petGiveStar: null,
    editingRewardTier: null,
    selectedAutoRewardItem: null
  };

  if (!botMsg) {
    const data = getTournamentPanelDataShared(guildId, defaultState, client, true);
    await channel.send(data).catch(() => {});
    return;
  }

  let state = defaultState;
  if (client.adminTournamentStates) {
    for (const [key, val] of client.adminTournamentStates.entries()) {
      if (key.endsWith(`_${botMsg.id}`)) {
        state = val;
        break;
      }
    }
  }

  if (state.currentSubMenu === 'main') {
    const data = getTournamentPanelDataShared(guildId, state, client, true);
    await botMsg.edit(data).catch(() => {});
  }
}

/**
 * 🏆 12. SUB-PANEL TURNAMEN PET (ADMIN CUP)
 */
async function handleAdminTournamentPanel(messageOrInteraction, client) {
  const isInteraction = !messageOrInteraction.author && !!messageOrInteraction.user;
  const isChannel = typeof messageOrInteraction.send === 'function';
  const author = isInteraction ? messageOrInteraction.user : (isChannel ? null : messageOrInteraction.author);
  const guildId = messageOrInteraction.guildId || (isChannel ? messageOrInteraction.guild?.id : null);

  if (author) {
    const isOwner = author.id === config.OWNER_ID;
    const isAdmin = messageOrInteraction.member && messageOrInteraction.member.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!isOwner && !isAdmin) {
      if (isInteraction) {
        return messageOrInteraction.reply({ content: '❌ Akses Ditolak! Panel Admin Turnamen dikunci khusus untuk Owner utama & Administrator server.', flags: 64 });
      } else {
        return messageOrInteraction.reply({ content: '❌ Akses Ditolak! Panel Admin Turnamen dikunci khusus untuk Owner utama & Administrator server.' });
      }
    }
  }

  if (!guildId) return false;

  const settings = database.get('SELECT tournament_admin_channel_id FROM ebyus_settings WHERE guild_id = ?', [guildId]);
  const isPermanentChannel = settings && settings.tournament_admin_channel_id === (messageOrInteraction.channelId || messageOrInteraction.id);

  const defaultState = {
    currentSubMenu: 'main',
    selectedRewardUserId: null,
    selectedRewardUserLabel: '',
    selectedRewardItemId: null,
    selectedRewardItemQty: null,
    petGiveSpecies: null,
    petGiveTrait: null,
    petGiveStar: null,
    editingRewardTier: null,
    selectedAutoRewardItem: null
  };

  const initialData = getTournamentPanelDataShared(guildId, defaultState, client, isPermanentChannel);

  if (isInteraction) {
    await messageOrInteraction.update(initialData);
  } else if (isChannel) {
    await messageOrInteraction.send(initialData);
  } else {
    await messageOrInteraction.reply(initialData);
  }

  return true;
}

/**
 * Global interaction router for persistent or static tournament admin panels
 */
async function handleAdminTournamentGlobalInteraction(interaction, client) {
  const customId = interaction.customId;
  const guildId = interaction.guildId;
  if (!guildId) return;

  const isOwner = interaction.user.id === config.OWNER_ID;
  const isAdmin = interaction.member && interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
  if (!isOwner && !isAdmin) {
    return interaction.reply({ content: '❌ Akses Ditolak! Tombol/menu dashboard ini dikunci khusus untuk Owner utama & Administrator server.', flags: 64 });
  }

  client.adminTournamentStates = client.adminTournamentStates || new Map();
  const stateKey = `${interaction.user.id}_${interaction.message.id}`;
  let state = client.adminTournamentStates.get(stateKey);
  if (!state) {
    state = {
      currentSubMenu: 'main',
      selectedRewardUserId: null,
      selectedRewardUserLabel: '',
      selectedRewardItemId: null,
      selectedRewardItemQty: null,
      petGiveSpecies: null,
      petGiveTrait: null,
      petGiveStar: null,
      editingRewardTier: null,
      selectedAutoRewardItem: null
    };
    client.adminTournamentStates.set(stateKey, state);
  }

  const settings = database.get('SELECT tournament_admin_channel_id FROM ebyus_settings WHERE guild_id = ?', [guildId]);
  const isPermanentChannel = settings && settings.tournament_admin_channel_id === interaction.message.channelId;
  const author = interaction.user;
  const guild = interaction.guild;

  try {
    const tournament = require('./tournament');

    if (customId === 'admin_tournament_select_dq_other') {
      const targetUserId = interaction.values[0].replace('cup_admin_select_dq_', '');
      await tournament.disqualifyParticipant(guildId, targetUserId, client);
      await interaction.update({ content: `✅ Pemain <@${targetUserId}> berhasil didiskualifikasi!`, components: [] }).catch(() => {});

      // Perbarui panel admin turnamen utama jika ada
      if (interaction.message && typeof interaction.message.edit === 'function') {
        const fresh = getTournamentPanelDataShared(guildId, state, client, isPermanentChannel);
        await interaction.message.edit(fresh).catch(() => {});
      }
      return;
    }
    else if (customId === 'admin_tournament_btn_back') {
      client.adminTournamentStates.delete(stateKey);
      await handleAdminPanel(interaction, client);
    }
    else if (customId === 'admin_tournament_btn_close') {
      client.adminTournamentStates.delete(stateKey);
      await interaction.message.delete().catch(() => {});
    }
    else if (customId === 'admin_tournament_btn_rewards') {
      state.currentSubMenu = 'rewards';
      state.selectedRewardUserId = null;
      state.selectedRewardUserLabel = '';
      state.selectedRewardItemId = null;
      state.selectedRewardItemQty = null;
      const fresh = getTournamentPanelDataShared(guildId, state, client, isPermanentChannel);
      await interaction.update(fresh).catch(() => {});
    }
    else if (customId === 'admin_tournament_btn_auto_rewards') {
      state.currentSubMenu = 'auto_rewards_config';
      const fresh = getTournamentPanelDataShared(guildId, state, client, isPermanentChannel);
      await interaction.update(fresh).catch(() => {});
    }
    else if (customId.startsWith('admin_tournament_auto_reward_btn_')) {
      const tier = customId.replace('admin_tournament_auto_reward_btn_', ''); // '1', '2', '3', 'part'
      state.currentSubMenu = 'select_auto_reward_item';
      state.editingRewardTier = tier;
      const fresh = getTournamentPanelDataShared(guildId, state, client, isPermanentChannel);
      await interaction.update(fresh).catch(() => {});
    }
    else if (customId === 'admin_tournament_rewards_select_item') {
      const selectedItem = interaction.values[0];
      state.selectedAutoRewardItem = selectedItem;
      const tier = state.editingRewardTier || '1';

      const labelMap = {
        '1': 'Juara 1',
        '2': 'Juara 2',
        '3': 'Juara 3',
        'part': 'Partisipan/Peserta'
      };
      const label = labelMap[tier] || 'Hadiah';

      // Query current values for fields default
      const rewards = database.get(
        `SELECT tour_reward_coin_${tier} as c, tour_reward_qty_${tier} as q
         FROM ebyus_settings WHERE guild_id = ?`,
        [guildId]
      );
      // fallback defaults
      const defaultCoins = rewards?.c ?? (tier === '1' ? 10000 : tier === '2' ? 8000 : tier === '3' ? 4000 : 1000);
      const defaultQty = rewards?.q ?? 1;

      const modal = new ModalBuilder()
        .setCustomId(`admin_tournament_auto_reward_modal_${tier}`)
        .setTitle(`Atur Hadiah: ${label}`);

      const coinInput = new TextInputBuilder()
        .setCustomId('reward_coins')
        .setLabel('Hadiah Koin (Rupiah)')
        .setValue(String(defaultCoins))
        .setPlaceholder('Contoh: 10000')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const qtyInput = new TextInputBuilder()
        .setCustomId('reward_qty')
        .setLabel(`Jumlah Item (${selectedItem})`)
        .setValue(String(defaultQty))
        .setPlaceholder('Contoh: 1')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(coinInput),
        new ActionRowBuilder().addComponents(qtyInput)
      );

      await interaction.showModal(modal);

      const sub = await interaction.awaitModalSubmit({
        filter: (s) => s.customId === `admin_tournament_auto_reward_modal_${tier}` && s.user.id === author.id,
        time: 60000
      }).catch(() => null);

      if (sub) {
        try {
          const coinVal = parseInt(sub.fields.getTextInputValue('reward_coins').trim()) || 0;
          const qtyVal = parseInt(sub.fields.getTextInputValue('reward_qty').trim()) || 0;

          if (isNaN(coinVal) || coinVal < 0) {
            return sub.reply({ content: '❌ Koin harus berupa angka positif!', flags: 64 });
          }
          if (isNaN(qtyVal) || qtyVal < 0) {
            return sub.reply({ content: '❌ Kuantitas item harus berupa angka positif!', flags: 64 });
          }

          // Update database
          const settingsExist = database.get('SELECT 1 FROM ebyus_settings WHERE guild_id = ?', [guildId]);
          if (!settingsExist) {
            database.run('INSERT INTO ebyus_settings (guild_id) VALUES (?)', [guildId]);
          }

          database.run(
            `UPDATE ebyus_settings
             SET tour_reward_coin_${tier} = ?, tour_reward_item_${tier} = ?, tour_reward_qty_${tier} = ?
             WHERE guild_id = ?`,
            [coinVal, selectedItem, qtyVal, guildId]
          );

          await sub.reply({ content: `✅ Sukses mengatur hadiah otomatis untuk **${label}**: Rp ${coinVal.toLocaleString('id-ID')} dan ${qtyVal}x ${selectedItem}!`, flags: 64 });

          state.currentSubMenu = 'auto_rewards_config';
          state.editingRewardTier = null;
          state.selectedAutoRewardItem = null;
          const fresh = getTournamentPanelDataShared(guildId, state, client, isPermanentChannel);
          await interaction.message.edit(fresh).catch(() => {});
        } catch (err) {
          await sub.reply({ content: `❌ Gagal menyimpan pengaturan: ${err.message}`, flags: 64 }).catch(() => {});
        }
      }
    }
    else if (customId === 'admin_tournament_rewards_btn_back_rewards') {
      state.currentSubMenu = 'auto_rewards_config';
      state.editingRewardTier = null;
      state.selectedAutoRewardItem = null;
      const fresh = getTournamentPanelDataShared(guildId, state, client, isPermanentChannel);
      await interaction.update(fresh).catch(() => {});
    }
    else if (customId === 'admin_tournament_rewards_select_winner') {
      const val = interaction.values[0];
      if (val === 'winner_manual') {
        state.selectedRewardUserId = null;
        state.selectedRewardUserLabel = 'Manual Select';
      } else if (val.startsWith('winner_')) {
        const parts = val.split('_'); // [winner, index, userId]
        const rankIndex = parts[1];
        const userId = parts[2];
        state.selectedRewardUserId = userId;
        state.selectedRewardUserLabel = `Juara ${rankIndex}`;
      }
      const fresh = getTournamentPanelDataShared(guildId, state, client, isPermanentChannel);
      await interaction.update(fresh).catch(() => {});
    }
    else if (customId === 'admin_tournament_rewards_user_select') {
      const userId = interaction.values[0];
      state.selectedRewardUserId = userId;
      state.selectedRewardUserLabel = 'Manual';
      const fresh = getTournamentPanelDataShared(guildId, state, client, isPermanentChannel);
      await interaction.update(fresh).catch(() => {});
    }
    else if (customId === 'admin_tournament_rewards_select_category') {
      const cat = interaction.values[0];
      if (cat === 'cat_money') {
        state.currentSubMenu = 'reward_money';
      } else if (cat === 'cat_item') {
        state.currentSubMenu = 'reward_item';
      } else if (cat === 'cat_pet') {
        state.currentSubMenu = 'reward_pet_species';
        state.petGiveSpecies = null;
        state.petGiveTrait = null;
        state.petGiveStar = null;
      }
      const fresh = getTournamentPanelDataShared(guildId, state, client, isPermanentChannel);
      await interaction.update(fresh).catch(() => {});
    }
    else if (customId === 'admin_tournament_rewards_select_money') {
      const amount = parseInt(interaction.values[0]);
      if (!isNaN(amount) && amount > 0) {
        bank.getSavings(state.selectedRewardUserId, guildId);
        database.run(
          'UPDATE bank_savings SET balance = balance + ? WHERE user_id = ? AND guild_id = ?',
          [amount, state.selectedRewardUserId, guildId]
        );
        database.run(
          'INSERT INTO transactions (user_id, guild_id, type, amount) VALUES (?, ?, ?, ?)',
          [state.selectedRewardUserId, guildId, 'ADMIN_BANK_GIVE', amount]
        );
        database.logPetAction(guildId, author.id, author.username, '', 'ADMIN_TOURNAMENT_REWARD_MONEY', `Memberikan hadiah uang Rp ${amount.toLocaleString('id-ID')} kepada ${state.selectedRewardUserLabel} (<@${state.selectedRewardUserId}>)`);
        await interaction.reply({ content: `💰 Sukses menyuntikkan hadiah koin **Rp ${amount.toLocaleString('id-ID')}** langsung ke tabungan bank <@${state.selectedRewardUserId}>!`, flags: 64 });
      }
      state.currentSubMenu = 'rewards';
      const fresh = getTournamentPanelDataShared(guildId, state, client, isPermanentChannel);
      await interaction.message.edit(fresh).catch(() => {});
    }
    else if (customId === 'admin_tournament_rewards_select_item') {
      state.selectedRewardItemId = interaction.values[0];
      state.currentSubMenu = 'reward_qty';
      const fresh = getTournamentPanelDataShared(guildId, state, client, isPermanentChannel);
      await interaction.update(fresh).catch(() => {});
    }
    else if (customId === 'admin_tournament_rewards_select_qty') {
      const qty = parseInt(interaction.values[0]);
      if (!isNaN(qty) && qty > 0) {
        updateAdminInventory(state.selectedRewardUserId, guildId, state.selectedRewardItemId, qty);
        database.logPetAction(guildId, author.id, author.username, '', 'ADMIN_TOURNAMENT_REWARD_ITEM', `Memberikan hadiah item ${qty}x ${state.selectedRewardItemId} kepada ${state.selectedRewardUserLabel} (<@${state.selectedRewardUserId}>)`);
        await interaction.reply({ content: `🎒 Sukses memberikan hadiah item **${qty}x ${state.selectedRewardItemId}** ke inventaris <@${state.selectedRewardUserId}>!`, flags: 64 });
      }
      state.currentSubMenu = 'rewards';
      const fresh = getTournamentPanelDataShared(guildId, state, client, isPermanentChannel);
      await interaction.message.edit(fresh).catch(() => {});
    }
    else if (customId === 'admin_tournament_rewards_pet_species' || customId === 'admin_tournament_rewards_pet_species_immortal') {
      state.petGiveSpecies = interaction.values[0];
      state.currentSubMenu = 'reward_pet_trait';
      const fresh = getTournamentPanelDataShared(guildId, state, client, isPermanentChannel);
      await interaction.update(fresh).catch(() => {});
    }
    else if (customId === 'admin_tournament_rewards_pet_trait') {
      state.petGiveTrait = interaction.values[0];
      state.currentSubMenu = 'reward_pet_star';
      const fresh = getTournamentPanelDataShared(guildId, state, client, isPermanentChannel);
      await interaction.update(fresh).catch(() => {});
    }
    else if (customId === 'admin_tournament_rewards_pet_star') {
      state.petGiveStar = parseInt(interaction.values[0]);
      const fresh = getTournamentPanelDataShared(guildId, state, client, isPermanentChannel);
      await interaction.update(fresh).catch(() => {});
    }
    else if (customId === 'admin_tournament_rewards_pet_confirm') {
      if (!state.petGiveSpecies || !state.petGiveTrait || !state.petGiveStar) {
        return interaction.reply({ content: '❌ Anda harus memilih spesies, trait, dan bintang pet terlebih dahulu!', flags: 64 });
      }

      const modal = new ModalBuilder()
        .setCustomId('admin_tournament_rewards_pet_final_modal')
        .setTitle(`Beri Pet: ${state.petGiveSpecies} ⭐${state.petGiveStar}`);

      const nameInput = new TextInputBuilder()
        .setCustomId('custom_pet_name')
        .setLabel('Nama Pet Peliharaan')
        .setPlaceholder('Masukkan nama peliharaan kustom...')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const levelInput = new TextInputBuilder()
        .setCustomId('custom_pet_level')
        .setLabel('Level Pet (Mulai dari 1)')
        .setValue('10')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(levelInput)
      );
      await interaction.showModal(modal);

      const sub = await interaction.awaitModalSubmit({
        filter: (s) => s.customId === 'admin_tournament_rewards_pet_final_modal' && s.user.id === author.id,
        time: 60000
      }).catch(() => null);

      if (sub) {
        try {
          const pName = sub.fields.getTextInputValue('custom_pet_name');
          let pLevel = parseInt(sub.fields.getTextInputValue('custom_pet_level')) || 1;
          const pType = state.petGiveSpecies;
          let pTrait = state.petGiveTrait === 'NONE' ? '' : state.petGiveTrait;
          const pStar = state.petGiveStar;

          // Validasi Spesies
          const petModule = require('./pet');
          const speciesInfo = petModule.GACHA_SPECIES[pType] || petModule.PET_SPECIES[pType];
          if (!speciesInfo) {
            return sub.reply({ content: `❌ Spesies tidak valid!`, flags: 64 });
          }

          // Sanitasi & Validasi Nama
          const sanitizedName = pName.replace(/<@!?\d*>|<@&\d*>|<#\d*>|@everyone|@here/g, '').trim();
          if (sanitizedName.length === 0 || sanitizedName.length > 25) {
            return sub.reply({ content: '❌ Nama pet tidak valid atau lebih dari 25 karakter!', flags: 64 });
          }

          // Validasi Slot
          const countRow = database.get('SELECT COUNT(*) as count FROM user_pets WHERE user_id = ? AND guild_id = ?', [state.selectedRewardUserId, guildId]);
          const count = countRow ? countRow.count : 0;

          // Cek Duplikat Nama
          const nameExists = database.get('SELECT 1 FROM user_pets WHERE user_id = ? AND guild_id = ? AND LOWER(pet_name) = LOWER(?)', [state.selectedRewardUserId, guildId, sanitizedName.toLowerCase()]);
          if (nameExists) {
            return sub.reply({ content: `❌ Anggota terpilih sudah memiliki pet bernama **"${sanitizedName}"**!`, flags: 64 });
          }

          const gSource = 'ADMIN';
          const gRarity = speciesInfo.rarity || 'COMMON';
          const gElement = speciesInfo.element || '';

          // Batas Maksimum Pet
          const targetMember = await guild.members.fetch(state.selectedRewardUserId).catch(() => null);
          const isTargetAdmin = (state.selectedRewardUserId === config.OWNER_ID) || 
                                (config.OWNER_ID && state.selectedRewardUserId === config.OWNER_ID) ||
                                (targetMember && targetMember.permissions.has(PermissionsBitField.Flags.Administrator));

          if (gRarity === 'MYTHIC') {
            const mythicCountRow = database.get(
              'SELECT COUNT(*) as count FROM user_pets WHERE user_id = ? AND guild_id = ? AND gacha_rarity = ?',
              [state.selectedRewardUserId, guildId, 'MYTHIC']
            );
            const mythicCount = mythicCountRow ? mythicCountRow.count : 0;
            const maxMythic = isTargetAdmin ? 999 : 2;
            if (mythicCount >= maxMythic) {
              return sub.reply({ content: `❌ Target user <@${state.selectedRewardUserId}> sudah memiliki batas maksimum pet MYTHIC (maksimal ${maxMythic} per user)!`, flags: 64 });
            }
          } else if (gRarity === 'IMMORTAL') {
            const immortalCountRow = database.get(
              'SELECT COUNT(*) as count FROM user_pets WHERE user_id = ? AND guild_id = ? AND gacha_rarity = ?',
              [state.selectedRewardUserId, guildId, 'IMMORTAL']
            );
            const immortalCount = immortalCountRow ? immortalCountRow.count : 0;
            const maxImmortal = isTargetAdmin ? 999 : 5;
            if (immortalCount >= maxImmortal) {
              return sub.reply({ content: `❌ Target user <@${state.selectedRewardUserId}> sudah memiliki batas maksimum pet IMMORTAL (maksimal ${maxImmortal} per user)!`, flags: 64 });
            }
          }

          // Clamping Level & Star
          pLevel = Math.max(1, pLevel);

          const pStatus = pLevel >= 10 ? 'ADULT' : 'BABY';
          const now = Math.floor(Date.now() / 1000);
          const isActive = count === 0 ? 1 : 0;
          const hatchAt = 0;

          // Calculate HP & Combat bonuses based on stars
          const baseHP = speciesInfo.baseHP || 100;
          const starMultiplier = 1 + (pStar - 1) * 0.15;
          const bonusHp = Math.round(baseHP * (starMultiplier - 1));
          const bonusAtkPct = (pStar - 1) * 0.15;
          const bonusDefPct = (pStar - 1) * 0.15;
          const maxHP = baseHP + bonusHp;

          // Auto-assign traits & XP Multiplier
          let finalTrait = pTrait;
          let finalTrait2 = '';
          let xpMultiplier = 1.0;

          if (gRarity === 'MYTHIC') {
            xpMultiplier = 1.5;
            const allTraits = ['GENIUS', 'STURDY', 'MUTANT', 'WARRIOR', 'SURVIVOR'];
            const shuffled = [...allTraits].sort(() => 0.5 - Math.random());
            finalTrait = shuffled[0];
            finalTrait2 = shuffled.slice(1, 3).join(',');
          } else if (gRarity === 'IMMORTAL') {
            xpMultiplier = 3.0;
            finalTrait = 'GENIUS';
            finalTrait2 = 'STURDY,MUTANT,WARRIOR,SURVIVOR';
          } else if (!finalTrait || finalTrait === 'NONE') {
            const traitsPool = ['GENIUS', 'STURDY', 'MUTANT', 'WARRIOR'];
            if (gRarity === 'LEGENDARY') {
              finalTrait = traitsPool[Math.floor(Math.random() * traitsPool.length)];
              const pool2 = traitsPool.filter(t => t !== finalTrait);
              finalTrait2 = pool2[Math.floor(Math.random() * pool2.length)];
            } else if (gRarity === 'EPIC') {
              finalTrait = 'SURVIVOR';
            } else if (gRarity === 'RARE') {
              finalTrait = traitsPool[Math.floor(Math.random() * traitsPool.length)];
            } else {
              finalTrait = '';
            }
          }

          database.run(
            `INSERT INTO user_pets (
              user_id, guild_id, pet_name, pet_type, status, level, xp, health, hunger, thirst, happiness, 
              last_interaction_at, hatch_at, created_at, is_active, trait, 
              star_level, base_hp_bonus, base_atk_bonus_pct, base_def_bonus_pct,
              gacha_source, gacha_rarity, gacha_element, gacha_trait2, xp_multiplier
            ) VALUES (
              ?, ?, ?, ?, ?, ?, 0, ?, 100, 100, 100, 
              ?, ?, ?, ?, ?, 
              ?, ?, ?, ?,
              ?, ?, ?, ?, ?
            )`,
            [
              state.selectedRewardUserId, guildId, sanitizedName, pType, pStatus, pLevel, maxHP,
              now, hatchAt, now, isActive, finalTrait,
              pStar, bonusHp, bonusAtkPct, bonusDefPct,
              gSource, gRarity, gElement, finalTrait2, xpMultiplier
            ]
          );

          const traitText = finalTrait ? ` dengan Trait **${finalTrait}**` : '';
          const starText = petModule.renderStars(pStar);
          await sub.reply({ content: `🎁 Sukses memberikan hadiah pet baru **${sanitizedName}** (${pType}) ${starText}${traitText} level **${pLevel}** ke <@${state.selectedRewardUserId}>!`, flags: 64 });
          database.logPetAction(guildId, author.id, author.username, '', 'ADMIN_TOURNAMENT_REWARD_PET', `Memberikan hadiah pet kustom ${sanitizedName} (${pType}) kepada ${state.selectedRewardUserLabel} (<@${state.selectedRewardUserId}>)`);

          // Send global economic announcement for MYTHIC/IMMORTAL
          if (gRarity === 'MYTHIC' || gRarity === 'IMMORTAL') {
            const rarityEmoji = gRarity === 'MYTHIC' ? '🔴' : '✨';
            const rarityColor = gRarity === 'MYTHIC' ? '#FF1744' : '#FFD700';
            const allTraitsStr = [finalTrait, ...finalTrait2.split(',').filter(Boolean)].join(', ');
            await sendGlobalEconomyAnnouncement(
              client,
              guild,
              author,
              `${rarityEmoji} Pemberian Pet Legendaris Turnamen ${gRarity}`,
              `🎉 Admin baru saja menganugerahkan hadiah pet turnamen kasta teratas **${sanitizedName}** (${pType}) ${rarityEmoji} **${gRarity}** kepada sang juara <@${state.selectedRewardUserId}>!`,
              rarityColor,
              [
                { name: 'Penerima', value: `<@${state.selectedRewardUserId}>`, inline: true },
                { name: 'Spesies', value: `${speciesInfo.name} (${pType})`, inline: true },
                { name: 'Bintang', value: petModule.renderStars(pStar), inline: true },
                { name: 'Trait Aktif', value: allTraitsStr || 'Tidak ada', inline: false }
              ]
            );
          }

          state.currentSubMenu = 'rewards';
          const fresh = getTournamentPanelDataShared(guildId, state, client, isPermanentChannel);
          await interaction.message.edit(fresh).catch(() => { });
        } catch (err) {
          await sub.reply({ content: `❌ Gagal memberikan pet: ${err.message}`, flags: 64 }).catch(() => {});
        }
      }
    }
    else if (customId === 'admin_tournament_rewards_btn_back_main') {
      state.currentSubMenu = 'main';
      state.selectedRewardUserId = null;
      state.selectedRewardUserLabel = '';
      const fresh = getTournamentPanelDataShared(guildId, state, client, isPermanentChannel);
      await interaction.update(fresh).catch(() => {});
    }
    else if (customId === 'admin_tournament_rewards_btn_back_rewards') {
      state.currentSubMenu = 'rewards';
      const fresh = getTournamentPanelDataShared(guildId, state, client, isPermanentChannel);
      await interaction.update(fresh).catch(() => {});
    }
    else if (customId === 'admin_tournament_rewards_btn_back_item') {
      state.currentSubMenu = 'reward_item';
      const fresh = getTournamentPanelDataShared(guildId, state, client, isPermanentChannel);
      await interaction.update(fresh).catch(() => {});
    }
    else if (customId === 'admin_tournament_rewards_btn_back_pet_species') {
      state.currentSubMenu = 'reward_pet_species';
      const fresh = getTournamentPanelDataShared(guildId, state, client, isPermanentChannel);
      await interaction.update(fresh).catch(() => {});
    }
    else if (customId === 'admin_tournament_rewards_btn_back_pet_trait') {
      state.currentSubMenu = 'reward_pet_trait';
      const fresh = getTournamentPanelDataShared(guildId, state, client, isPermanentChannel);
      await interaction.update(fresh).catch(() => {});
    }
    else if (customId === 'admin_tournament_btn_pause') {
      await tournament.pauseTournament(guildId, client);
      await interaction.reply({ content: '⏸️ Turnamen berhasil dijeda sementara!', flags: 64 });
      const fresh = getTournamentPanelDataShared(guildId, state, client, isPermanentChannel);
      await interaction.message.edit(fresh).catch(() => { });
    }
    else if (customId === 'admin_tournament_btn_resume') {
      await tournament.resumeTournament(guildId, client);
      await interaction.reply({ content: '▶️ Turnamen berhasil dilanjutkan kembali!', flags: 64 });
      const fresh = getTournamentPanelDataShared(guildId, state, client, isPermanentChannel);
      await interaction.message.edit(fresh).catch(() => { });
    }
    else if (customId === 'admin_tournament_btn_reroll') {
      await tournament.rerollMatch(guildId, client);
      await interaction.reply({ content: '🔄 Duel aktif berhasil di-reroll!', flags: 64 });
      const fresh = getTournamentPanelDataShared(guildId, state, client, isPermanentChannel);
      await interaction.message.edit(fresh).catch(() => { });
    }
    else if (customId === 'admin_tournament_btn_dq') {
      let match = database.get(
        'SELECT * FROM tournament_matches WHERE guild_id = ? AND match_status = \'ACTIVE\' LIMIT 1',
        [guildId]
      );
      
      // Jika tidak ada match aktif, cari match pending (untuk force start dan DQ)
      if (!match) {
        match = database.get(
          'SELECT * FROM tournament_matches WHERE guild_id = ? AND match_status = \'PENDING\' LIMIT 1',
          [guildId]
        );
        
        if (match) {
          // Force start match terlebih dahulu, lalu lanjutkan DQ
          const tournament = require('./tournament');
          await tournament.executeNextMatch(guildId, client);
          
          // Update match reference setelah force start
          match = database.get(
            'SELECT * FROM tournament_matches WHERE guild_id = ? AND match_status = \'ACTIVE\' LIMIT 1',
            [guildId]
          );
        }
      }
      
      if (!match) {
        return interaction.reply({ content: '❌ Tidak ada pertandingan aktif atau pending saat ini!', flags: 64 });
      }

      const p1Pet = database.get('SELECT pet_name FROM tournament_participants WHERE guild_id = ? AND user_id = ?', [guildId, match.player_1_id]);
      const p2Pet = database.get('SELECT pet_name FROM tournament_participants WHERE guild_id = ? AND user_id = ?', [guildId, match.player_2_id]);

      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`cup_admin_act_dq_${match.match_id}_${match.player_1_id}`)
          .setLabel(`DQ ${p1Pet?.pet_name || 'Player 1'}`)
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`cup_admin_act_dq_${match.match_id}_${match.player_2_id}`)
          .setLabel(`DQ ${p2Pet?.pet_name || 'Player 2'}`)
          .setStyle(ButtonStyle.Danger)
      );

      const allParticipants = database.all('SELECT * FROM tournament_participants WHERE guild_id = ?', [guildId]);
      const selectOptions = allParticipants
        .filter(p => p.user_id !== match.player_1_id && p.user_id !== match.player_2_id)
        .slice(0, 25)
        .map(p => ({
          label: `${p.pet_name}`,
          value: `cup_admin_select_dq_${p.user_id}`,
          description: `Pawang: (ID: ${p.user_id.slice(0, 8)}...)`
        }));

      const components = [actionRow];
      if (selectOptions.length > 0) {
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('admin_tournament_select_dq_other')
          .setPlaceholder('🚨 Pilih Peserta Lain untuk Didiskualifikasi...')
          .addOptions(selectOptions);
        components.push(new ActionRowBuilder().addComponents(selectMenu));
      }

      await interaction.reply({ content: '⚠️ **Pilih pemain yang ingin DIDISKUALIFIKASI:**', components, flags: 64 });
    }
    else if (customId === 'admin_tournament_btn_forcewin') {
      let match = database.get(
        'SELECT * FROM tournament_matches WHERE guild_id = ? AND match_status = \'ACTIVE\' LIMIT 1',
        [guildId]
      );
      
      // Jika tidak ada match aktif, cari match pending (untuk force start dan Force Win)
      if (!match) {
        match = database.get(
          'SELECT * FROM tournament_matches WHERE guild_id = ? AND match_status = \'PENDING\' LIMIT 1',
          [guildId]
        );
        
        if (match) {
          // Force start match terlebih dahulu, lalu lanjutkan Force Win
          const tournament = require('./tournament');
          await tournament.executeNextMatch(guildId, client);
          
          // Update match reference setelah force start
          match = database.get(
            'SELECT * FROM tournament_matches WHERE guild_id = ? AND match_status = \'ACTIVE\' LIMIT 1',
            [guildId]
          );
        }
      }
      
      if (!match) {
        return interaction.reply({ content: '❌ Tidak ada pertandingan aktif atau pending saat ini!', flags: 64 });
      }

      const p1Pet = database.get('SELECT pet_name FROM tournament_participants WHERE guild_id = ? AND user_id = ?', [guildId, match.player_1_id]);
      const p2Pet = database.get('SELECT pet_name FROM tournament_participants WHERE guild_id = ? AND user_id = ?', [guildId, match.player_2_id]);

      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`cup_admin_act_fw_${match.match_id}_${match.player_1_id}`)
          .setLabel(`Menangkan ${p1Pet?.pet_name || 'Player 1'}`)
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`cup_admin_act_fw_${match.match_id}_${match.player_2_id}`)
          .setLabel(`Menangkan ${p2Pet?.pet_name || 'Player 2'}`)
          .setStyle(ButtonStyle.Success)
      );

      await interaction.reply({ content: '👑 **Pilih pemain yang ingin DIMENANGKAN PAKSA:**', components: [actionRow], flags: 64 });
    }
    else if (customId === 'admin_tournament_btn_extend') {
      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`cup_admin_act_ext_${guildId}_5`)
          .setLabel('+5 Menit')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`cup_admin_act_ext_${guildId}_10`)
          .setLabel('+10 Menit')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`cup_admin_act_ext_${guildId}_15`)
          .setLabel('+15 Menit')
          .setStyle(ButtonStyle.Secondary)
      );
      await interaction.reply({ content: '⏱️ **Pilih durasi perpanjangan waktu pendaftaran:**', components: [actionRow], flags: 64 });
    }
    else if (customId === 'admin_tournament_btn_stop') {
      if (client.tournamentTimers && client.tournamentTimers.has(guildId)) {
        clearTimeout(client.tournamentTimers.get(guildId));
        client.tournamentTimers.delete(guildId);
      }
      const active = tournament.stopTournament(guildId);
      if (active && active.channel_id) {
        await tournament.createTournamentChannel(interaction.guild).catch(() => null);

        const channel = interaction.guild.channels.cache.get(active.channel_id) || await client.channels.fetch(active.channel_id).catch(() => null);
        if (channel && typeof channel.send === 'function') {
          await channel.send({ embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('❌ TURNAMEN DIBATALKAN').setDescription('Turnamen/Liga Admin Cup telah dibatalkan oleh Administrator.\nSeluruh chat pendaftaran telah dibersihkan.').setTimestamp()] }).catch(() => {});
        }
      }
      await interaction.reply({ content: '🏆 Turnamen Admin Cup yang aktif berhasil dibatalkan dan semua data pendaftaran dibersihkan.', flags: 64 });
      const fresh = getTournamentPanelDataShared(guildId, state, client, isPermanentChannel);
      await interaction.message.edit(fresh).catch(() => { });
    }
    else if (customId === 'admin_tournament_btn_start') {
      const modal = new ModalBuilder()
        .setCustomId('admin_tournament_start_modal')
        .setTitle('Mulai Turnamen Admin Cup');

      const durationInput = new TextInputBuilder()
        .setCustomId('cup_duration')
        .setLabel('Durasi Registrasi (Menit)')
        .setValue('30')
        .setPlaceholder('Contoh: 30')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const maxHpInput = new TextInputBuilder()
        .setCustomId('cup_max_hp')
        .setLabel('Batasan Max HP (0 jika tanpa batas)')
        .setValue('0')
        .setPlaceholder('Contoh: 1000')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const rewardInput = new TextInputBuilder()
        .setCustomId('cup_reward')
        .setLabel('Hadiah Turnamen (Opsional)')
        .setPlaceholder('Contoh: 5,000,000 Koin + Role Champion')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(durationInput),
        new ActionRowBuilder().addComponents(maxHpInput),
        new ActionRowBuilder().addComponents(rewardInput)
      );

      await interaction.showModal(modal);

      const sub = await interaction.awaitModalSubmit({
        filter: (s) => s.customId === 'admin_tournament_start_modal' && s.user.id === author.id,
        time: 60000
      }).catch(() => null);

      if (sub) {
        const durationMins = parseInt(sub.fields.getTextInputValue('cup_duration').trim()) || 30;
        const maxHpInputVal = parseInt(sub.fields.getTextInputValue('cup_max_hp').trim()) || 0;
        const finalMaxHp = maxHpInputVal > 0 ? maxHpInputVal : 999999;
        const minLevel = 1;
        const maxLevel = 9999;
        const rewardDesc = sub.fields.getTextInputValue('cup_reward') ? sub.fields.getTextInputValue('cup_reward').trim() : '';
        const finalReward = rewardDesc !== '' ? rewardDesc : null;

        if (isNaN(durationMins) || durationMins <= 0) {
          return sub.reply({ content: '❌ Durasi registrasi harus berupa angka positif!', flags: 64 });
        }
        if (isNaN(maxHpInputVal) || maxHpInputVal < 0) {
          return sub.reply({ content: '❌ Batasan Max HP tidak valid!', flags: 64 });
        }

        try {
          await sub.deferReply({ flags: 64 });

          const TOURNAMENT_CHANNEL_ID = '1512903573720273096';
          let targetChannelObj = interaction.guild.channels.cache.get(TOURNAMENT_CHANNEL_ID) || await interaction.guild.channels.fetch(TOURNAMENT_CHANNEL_ID).catch(() => null);
          if (!targetChannelObj) {
            targetChannelObj = interaction.guild.channels.cache.find(c => c.name === '🏆┃pvp-cup' || c.name === 'pvp-cup');
          }
          if (!targetChannelObj) {
            targetChannelObj = await tournament.createTournamentChannel(interaction.guild).catch(() => null);
          }
          if (!targetChannelObj) {
            throw new Error('Gagal menemukan atau membuat channel turnamen. Silakan periksa izin bot.');
          }
          const targetChannelId = targetChannelObj.id;

          const res = tournament.startTournament(author.id, guildId, targetChannelId, durationMins, minLevel, maxLevel, finalReward, finalMaxHp);
          const endRegAt = res.registrationEndAt;

          const hpLimitText = finalMaxHp < 999999 ? `Maksimal **${finalMaxHp.toLocaleString('id-ID')} HP**` : 'Bebas / Tanpa Batas';

          const announceEmbed = new EmbedBuilder()
            .setColor(0x4F46E5) // Premium Indigo
            .setTitle('🏆 LIGA PET — ADMIN CUP 🏆')
            .setDescription(
              `📢 **Pendaftaran Liga PvP Pet telah dibuka oleh Administrator!**\n` +
              `Siapkan pet terkuat Anda untuk bertarung di liga dan merebut takhta juara server!\n\n` +
              `▬`.repeat(15)
            )
            .addFields(
              { name: '⏱️ Batas Waktu Pendaftaran', value: `<t:${endRegAt}:R> (<t:${endRegAt}:T>)`, inline: true },
              { name: '📈 Batasan HP Pet', value: hpLimitText, inline: true },
              { name: '🎁 Hadiah Liga', value: finalReward ? `**${finalReward}**` : `*Akan diberikan secara otomatis setelah liga selesai.*`, inline: false },
              { name: '👥 Peserta Terdaftar (0)', value: '*Belum ada peserta yang mendaftar.*', inline: false }
            )
            .setFooter({ text: 'Pet PvP League • Registration Phase' })
            .setTimestamp();

          const joinRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('cup_btn_join_public')
              .setLabel('🏆 Gabung / Ganti Pet')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('cup_btn_leave_public')
              .setLabel('❌ Keluar Turnamen')
              .setStyle(ButtonStyle.Danger)
          );

          const announceMsg = await targetChannelObj.send({ content: '@everyone', embeds: [announceEmbed], components: [joinRow], allowedMentions: { parse: ['everyone'] } });
          tournament.saveAnnounceMessageId(guildId, announceMsg.id);
          await tournament.updateRegistrationEmbed(guildId, client);

          client.tournamentTimers = client.tournamentTimers || new Map();
          if (client.tournamentTimers.has(guildId)) {
            clearTimeout(client.tournamentTimers.get(guildId));
          }
          const regTimer = setTimeout(() => {
            tournament.closeRegistrationAndGenerateBracket(guildId, client);
          }, durationMins * 60 * 1000);
          client.tournamentTimers.set(guildId, regTimer);

          const adminPanelData = tournament.getAdminPanelData(guildId, client);
          const adminPanelMsg = await sub.channel.send(adminPanelData).catch(() => null);
          if (adminPanelMsg) {
            database.run(
              'UPDATE tournament_events SET admin_panel_message_id = ?, admin_panel_channel_id = ? WHERE guild_id = ?',
              [adminPanelMsg.id, sub.channel.id, guildId]
            );
          }

          await sub.followUp({ content: `🏆 Sukses memulai pendaftaran Liga Pet di channel <#${targetChannelId}> dan akan ditutup <t:${endRegAt}:R>!`, flags: 64 });
          const fresh = getTournamentPanelDataShared(guildId, state, client, isPermanentChannel);
          await interaction.message.edit(fresh).catch(() => { });
        } catch (err) {
          await sub.followUp({ content: `❌ Gagal memulai turnamen: ${err.message}`, flags: 64 }).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error('Error in Tournament Panel Interaction:', err);
    await interaction.reply({ content: `❌ Terjadi kesalahan: ${err.message}`, flags: 64 }).catch(() => { });
  }
}

/**
 * 🏦 2. PANEL FINANSIAL & BANK SERVER
 */
async function handleAdminBankPanel(messageOrInteraction, client, initialTargetUserId = null) {
  const isInteraction = !messageOrInteraction.author;
  const author = isInteraction ? messageOrInteraction.user : messageOrInteraction.author;
  const guildId = messageOrInteraction.guildId;
  const guild = messageOrInteraction.guild;

  if (!guildId) return false;

  let selectedTargetUserId = initialTargetUserId;

  const getBankPanelData = (gId, targetUserId) => {
    let embed = new EmbedBuilder()
      .setColor(0xD4AF37) // Imperial Gold
      .setTitle('🏦 ADMIN CONTROL PANEL — BANK & FINANSIAL')
      .setThumbnail(client.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({ text: 'Sentinel Admin • Sistem Bank & Keuangan' });

    let targetText = '*Belum ada anggota terpilih (Silakan pilih di menu dropdown di bawah)*';
    if (targetUserId) {
      const walletRow = database.get('SELECT balance FROM wallets WHERE user_id = ? AND guild_id = ?', [targetUserId, gId]);
      const savingsRow = database.get('SELECT balance FROM bank_savings WHERE user_id = ? AND guild_id = ?', [targetUserId, gId]);
      const walletVal = walletRow ? walletRow.balance : 0;
      const bankVal = savingsRow ? savingsRow.balance : 0;

      targetText = `🎯 **<@${targetUserId}>**\n` +
        `• ID: \`${targetUserId}\`\n` +
        `• Dompet: \`Rp ${(walletVal || 0).toLocaleString('id-ID')}\`\n` +
        `• Tabungan Bank: \`Rp ${(bankVal || 0).toLocaleString('id-ID')}\`\n`;

      const activeLoan = database.get('SELECT * FROM bank_loans WHERE user_id = ? AND guild_id = ? AND status IN (\'ACTIVE\', \'OVERDUE\')', [targetUserId, gId]);
      if (activeLoan) {
        targetText += `• Pinjaman Bank: ⚠️ **ADA PINJAMAN** (\`Rp ${(activeLoan.total_due || 0).toLocaleString('id-ID')}\` - Status: **${activeLoan.status}**)\n`;
      } else {
        targetText += `• Pinjaman Bank: 🟢 Bersih\n`;
      }
    }

    embed.setDescription(
      `Gunakan menu di bawah untuk menyuntikkan dana, memotong saldo, mereset ekonomi anggota secara spesifik, atau membagikan bantuan koin massal:\n\n` +
      `👤 **INFORMASI KEUANGAN TARGET:**\n${targetText}`
    );

    const userSelect = new UserSelectMenuBuilder()
      .setCustomId('admin_bank_select_target')
      .setPlaceholder('👤 Pilih Target Anggota');

    const userRow = new ActionRowBuilder().addComponents(userSelect);

    const actionSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_bank_select_action')
      .setPlaceholder('🎯 Pilih Tindakan Kustom Target')
      .setDisabled(!targetUserId);

    actionSelect.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('💸 Suntik Koin Kustom (Modal)')
        .setDescription('Menambahkan saldo dompet kustom ke anggota target')
        .setValue('action_give_coins_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('📉 Tarik/Potong Koin Kustom (Modal)')
        .setDescription('Memotong paksa koin dompet anggota target')
        .setValue('action_take_coins_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🏦 Suntik Saldo Bank (Modal)')
        .setDescription('Menambahkan koin langsung ke tabungan bank anggota target')
        .setValue('action_give_bank_savings_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🏦 Tarik Saldo Bank (Modal)')
        .setDescription('Menarik/memotong paksa koin dari tabungan bank anggota target')
        .setValue('action_take_bank_savings_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🚨 RESET EKONOMI TARGET')
        .setDescription('Mengembalikan saldo dompet, bank, & portfolio target ke 0')
        .setValue('action_reset_economy'),
      new StringSelectMenuOptionBuilder()
        .setLabel('💼 Hapus Pinjaman Bank')
        .setDescription('Menghapus / melunasi semua pinjaman bank milik target')
        .setValue('action_settle_loan')
    );

    const actionRow = new ActionRowBuilder().addComponents(actionSelect);

    const globalSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_bank_select_global')
      .setPlaceholder('🌐 Tindakan Ekonomi Global');

    globalSelect.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('💰 Suntik Koin ke Seluruh Member (Massal)')
        .setDescription('Membuka modal input untuk membagikan koin ke semua warga terdaftar')
        .setValue('global_give_all_coins_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('💸 Bansos Massal (Kekayaan Terbatas)')
        .setDescription('Bagi koin kepada seluruh member dengan total kekayaan di bawah limit tertentu')
        .setValue('global_bansos_wealth_limit'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🔴 Sita Aset Warga Inaktif (Never Daily)')
        .setDescription('Menyita koin dompet, saldo bank, dan seluruh item warga yang tidak pernah klaim daily')
        .setValue('global_reclaim_inactive_assets'),
      new StringSelectMenuOptionBuilder()
        .setLabel('📈 Statistik Sirkulasi & Inflasi')
        .setDescription('Tampilkan rincian sirkulasi koin, kekayaan rata-rata, dan rasio pasif/aktif')
        .setValue('global_inflation_stats'),
      new StringSelectMenuOptionBuilder()
        .setLabel('⚙️ Sesuaikan Tarif Pajak (Moneter)')
        .setDescription('Atur persentase pajak transfer koin dan pajak penjualan saham secara instan')
        .setValue('global_adjust_taxes')
    );

    const globalRow = new ActionRowBuilder().addComponents(globalSelect);

    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_bank_btn_back')
        .setLabel('🔙 Kembali ke Hub')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('admin_bank_btn_close')
        .setLabel('❌ Tutup Panel')
        .setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [userRow, actionRow, globalRow, btnRow] };
  };

  const initialData = getBankPanelData(guildId, selectedTargetUserId);
  let replyMsg;

  if (isInteraction) {
    await messageOrInteraction.update(initialData);
    replyMsg = messageOrInteraction.message;
  } else {
    replyMsg = await messageOrInteraction.reply(initialData);
  }

  const collector = replyMsg.createMessageComponentCollector({ time: 600000 });

  collector.on('collect', async iBank => {
    const isOwner = iBank.user.id === config.OWNER_ID;
    const isAdmin = iBank.member && iBank.member.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!isOwner && !isAdmin) {
      return iBank.reply({ content: '❌ Akses Ditolak! Tombol/menu dashboard ini dikunci khusus untuk Owner utama & Administrator server.', flags: 64 });
    }

    try {
      if (iBank.customId === 'admin_bank_select_target') {
        selectedTargetUserId = iBank.values[0];
        const fresh = getBankPanelData(guildId, selectedTargetUserId);
        await iBank.update(fresh);
      }
      else if (iBank.customId === 'admin_bank_btn_back') {
        collector.stop('transition');
        await handleAdminPanel(iBank, client);
      }
      else if (iBank.customId === 'admin_bank_btn_close') {
        collector.stop();
        await replyMsg.delete().catch(() => { });
      }
      else if (iBank.customId === 'admin_bank_select_action') {
        const action = iBank.values[0];
        if (!selectedTargetUserId) {
          return iBank.reply({ content: '❌ Silakan pilih target anggota terlebih dahulu!', flags: 64 });
        }

        if (action === 'action_give_coins_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_bank_give_coins_modal')
            .setTitle('Suntik Koin Member');

          const amountInput = new TextInputBuilder()
            .setCustomId('coin_amount')
            .setLabel('Jumlah Koin (Rupiah)')
            .setPlaceholder('Contoh: 15000')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
          await iBank.showModal(modal);

          const sub = await iBank.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_bank_give_coins_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const amount = bank.parseAmount(sub.fields.getTextInputValue('coin_amount'));
            if (isNaN(amount) || amount <= 0) {
              return sub.reply({ content: '❌ Jumlah harus berupa angka bulat di atas 0!', flags: 64 });
            }
            economy.addBalance(selectedTargetUserId, guildId, amount, 'ADMIN_GIVE');
            await sub.reply({ content: `💸 Sukses menyuntikkan koin **Rp ${amount.toLocaleString('id-ID')}** langsung ke dompet <@${selectedTargetUserId}>!`, flags: 64 });
            const fresh = getBankPanelData(guildId, selectedTargetUserId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'action_take_coins_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_bank_take_coins_modal')
            .setTitle('Tarik Koin Member');

          const amountInput = new TextInputBuilder()
            .setCustomId('coin_amount')
            .setLabel('Jumlah Koin (Rupiah)')
            .setPlaceholder('Contoh: 5000')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
          await iBank.showModal(modal);

          const sub = await iBank.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_bank_take_coins_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const amount = bank.parseAmount(sub.fields.getTextInputValue('coin_amount'));
            if (isNaN(amount) || amount <= 0) {
              return sub.reply({ content: '❌ Jumlah harus berupa angka bulat di atas 0!', flags: 64 });
            }
            const wallet = economy.getWallet(selectedTargetUserId, guildId);
            const amountToTake = Math.min(wallet.balance, amount);
            if (amountToTake > 0) {
              economy.subtractBalance(selectedTargetUserId, guildId, amountToTake, 'ADMIN_TAKE');
            }
            await sub.reply({ content: `📉 Sukses menarik/memotong koin **Rp ${amountToTake.toLocaleString('id-ID')}** dari dompet <@${selectedTargetUserId}>!`, flags: 64 });
            const fresh = getBankPanelData(guildId, selectedTargetUserId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'action_give_bank_savings_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_bank_give_savings_modal')
            .setTitle('Suntik Saldo Bank Member');

          const amountInput = new TextInputBuilder()
            .setCustomId('savings_amount')
            .setLabel('Jumlah Saldo Bank (Rupiah)')
            .setPlaceholder('Contoh: 25000')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
          await iBank.showModal(modal);

          const sub = await iBank.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_bank_give_savings_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const amount = bank.parseAmount(sub.fields.getTextInputValue('savings_amount'));
            if (isNaN(amount) || amount <= 0) {
              return sub.reply({ content: '❌ Jumlah harus berupa angka bulat di atas 0!', flags: 64 });
            }

            bank.getSavings(selectedTargetUserId, guildId);

            database.run(
              'UPDATE bank_savings SET balance = balance + ? WHERE user_id = ? AND guild_id = ?',
              [amount, selectedTargetUserId, guildId]
            );
            database.run(
              'INSERT INTO transactions (user_id, guild_id, type, amount) VALUES (?, ?, ?, ?)',
              [selectedTargetUserId, guildId, 'ADMIN_BANK_GIVE', amount]
            );

            await sub.reply({ content: `🏦 Sukses menyuntikkan koin **Rp ${amount.toLocaleString('id-ID')}** langsung ke tabungan bank <@${selectedTargetUserId}>!`, flags: 64 });
            const fresh = getBankPanelData(guildId, selectedTargetUserId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'action_take_bank_savings_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_bank_take_savings_modal')
            .setTitle('Tarik Saldo Bank Member');

          const amountInput = new TextInputBuilder()
            .setCustomId('savings_amount')
            .setLabel('Jumlah Saldo Bank (Rupiah)')
            .setPlaceholder('Contoh: 15000')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
          await iBank.showModal(modal);

          const sub = await iBank.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_bank_take_savings_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const amount = bank.parseAmount(sub.fields.getTextInputValue('savings_amount'));
            if (isNaN(amount) || amount <= 0) {
              return sub.reply({ content: '❌ Jumlah harus berupa angka bulat di atas 0!', flags: 64 });
            }

            const savings = bank.getSavings(selectedTargetUserId, guildId);
            const amountToTake = Math.min(savings.balance, amount);

            if (amountToTake > 0) {
              database.run(
                'UPDATE bank_savings SET balance = balance - ? WHERE user_id = ? AND guild_id = ?',
                [amountToTake, selectedTargetUserId, guildId]
              );
              database.run(
                'INSERT INTO transactions (user_id, guild_id, type, amount) VALUES (?, ?, ?, ?)',
                [selectedTargetUserId, guildId, 'ADMIN_BANK_TAKE', -amountToTake]
              );
            }

            await sub.reply({ content: `🏦 Sukses menarik/memotong koin **Rp ${amountToTake.toLocaleString('id-ID')}** dari tabungan bank <@${selectedTargetUserId}>!`, flags: 64 });
            const fresh = getBankPanelData(guildId, selectedTargetUserId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'action_reset_economy') {
          const confirmed = await askConfirmation(iBank, author.id, `RESET TOTAL EKONOMI (dompet, bank, saham, pinjaman, utang) milik <@${selectedTargetUserId}>`);
          if (!confirmed) return;

          database.run('UPDATE wallets SET balance = 0, total_earned = 0, total_invested = 0, streak_days = 0 WHERE user_id = ? AND guild_id = ?', [selectedTargetUserId, guildId]);
          database.run('UPDATE bank_savings SET balance = 0 WHERE user_id = ? AND guild_id = ?', [selectedTargetUserId, guildId]);
          database.run('DELETE FROM portfolios WHERE user_id = ? AND guild_id = ?', [selectedTargetUserId, guildId]);
          database.run('DELETE FROM bank_loans WHERE user_id = ? AND guild_id = ?', [selectedTargetUserId, guildId]);
          database.run('DELETE FROM bail_debts WHERE debtor_id = ? AND guild_id = ?', [selectedTargetUserId, guildId]);
          database.run('DELETE FROM bail_debts WHERE creditor_id = ? AND guild_id = ?', [selectedTargetUserId, guildId]);
          await iBank.followUp({ content: `🚨 **RESET TOTAL SUKSES!** Dompet, tabungan bank, seluruh lembar saham, serta pinjaman/utang jaminan milik <@${selectedTargetUserId}> telah dikembalikan ke 0 atau dibersihkan.`, flags: 64 });
          const fresh = getBankPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => { });
        }
        else if (action === 'action_settle_loan') {
          database.run("UPDATE bank_loans SET status = 'PAID', total_due = 0, penalty_accumulated = 0 WHERE user_id = ? AND guild_id = ? AND status IN ('ACTIVE', 'OVERDUE')", [selectedTargetUserId, guildId]);
          await iBank.reply({ content: `💼 Sukses melunasi/menghapus seluruh pinjaman bank aktif milik <@${selectedTargetUserId}>!`, flags: 64 });
          const fresh = getBankPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => { });
        }
      }
      else if (iBank.customId === 'admin_bank_select_global') {
        const action = iBank.values[0];

        if (action === 'global_give_all_coins_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_bank_give_all_coins_modal')
            .setTitle('Bagi Koin ke Seluruh Member');

          const amountInput = new TextInputBuilder()
            .setCustomId('coin_amount')
            .setLabel('Jumlah Koin (Rupiah)')
            .setPlaceholder('Contoh: 2000')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
          await iBank.showModal(modal);

          const sub = await iBank.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_bank_give_all_coins_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const amount = bank.parseAmount(sub.fields.getTextInputValue('coin_amount'));
            if (isNaN(amount) || amount <= 0) {
              return sub.reply({ content: '❌ Jumlah harus berupa angka bulat di atas 0!', flags: 64 });
            }
            database.run('UPDATE wallets SET balance = balance + ?, total_earned = total_earned + ? WHERE guild_id = ?', [amount, amount, guildId]);
            await sub.reply({ content: `💸 Sukses membagikan koin **Rp ${amount.toLocaleString('id-ID')}** kepada seluruh member terdaftar di server ini!`, flags: 64 });
            await sendGlobalEconomyAnnouncement(
              client,
              guild,
              author,
              '💰 Bagi-Bagi Koin Massal',
              '💸 Hujan koin dadakan! Admin sedang membagikan koin cuma-cuma ke seluruh warga. Dompet kalian baru saja disuntik dana gratis. Jangan lupa sungkem dan bilang "terima kasih admin ganteng/cantik" ya!',
              '#00FF88',
              [
                { name: 'Nominal Dibagikan', value: `Rp ${amount.toLocaleString('id-ID')}`, inline: true }
              ]
            );
            const fresh = getBankPanelData(guildId, selectedTargetUserId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'global_bansos_wealth_limit') {
          const modal = new ModalBuilder()
            .setCustomId('admin_bank_bansos_modal')
            .setTitle('Bansos Massal Total Kekayaan');

          const limitInput = new TextInputBuilder()
            .setCustomId('wealth_limit')
            .setLabel('Batas Maksimum Kekayaan Warga (Rp)')
            .setPlaceholder('Contoh: 2000')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const amountInput = new TextInputBuilder()
            .setCustomId('bansos_amount')
            .setLabel('Nominal Koin Bantuan (Rp)')
            .setPlaceholder('Contoh: 2000')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(limitInput),
            new ActionRowBuilder().addComponents(amountInput)
          );
          await iBank.showModal(modal);

          const sub = await iBank.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_bank_bansos_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const wealthLimit = bank.parseAmount(sub.fields.getTextInputValue('wealth_limit'));
            const bansosAmount = bank.parseAmount(sub.fields.getTextInputValue('bansos_amount'));

            if (isNaN(wealthLimit) || wealthLimit <= 0) {
              return sub.reply({ content: '❌ Batas maksimum kekayaan harus berupa angka bulat di atas 0!', flags: 64 });
            }
            if (isNaN(bansosAmount) || bansosAmount <= 0) {
              return sub.reply({ content: '❌ Nominal koin bantuan harus berupa angka bulat di atas 0!', flags: 64 });
            }

            let receiverCount = 0;
            let totalDistributed = 0;

            database.transaction(() => {
              const members = database.all(
                `SELECT w.user_id, 
                        (w.balance + COALESCE(bs.balance, 0) + COALESCE(pv.portfolio_value, 0)) as total_wealth
                 FROM wallets w
                 LEFT JOIN bank_savings bs ON w.user_id = bs.user_id AND w.guild_id = bs.guild_id
                 LEFT JOIN (
                   SELECT p.user_id, p.guild_id, SUM(p.shares * s.current_price) as portfolio_value
                   FROM portfolios p
                   JOIN stocks s ON p.channel_id = s.channel_id AND p.guild_id = s.guild_id
                   GROUP BY p.user_id, p.guild_id
                 ) pv ON w.user_id = pv.user_id AND w.guild_id = pv.guild_id
                 WHERE w.guild_id = ?`,
                [guildId]
              );

              for (const m of members) {
                if (m.total_wealth < wealthLimit) {
                  database.run(
                    'UPDATE wallets SET balance = balance + ?, total_earned = total_earned + ? WHERE user_id = ? AND guild_id = ?',
                    [bansosAmount, bansosAmount, m.user_id, guildId]
                  );

                  database.run(
                    'INSERT INTO transactions (user_id, guild_id, type, amount) VALUES (?, ?, ?, ?)',
                    [m.user_id, guildId, 'ADMIN_GIVE', bansosAmount]
                  );

                  receiverCount++;
                  totalDistributed += bansosAmount;
                }
              }
            })();

            await sub.reply({
              content: `💸 **DISTRIBUSI BANSOS SELESAI!**\n\n` +
                `• Target Penerima : Total Kekayaan < **Rp ${wealthLimit.toLocaleString('id-ID')}**\n` +
                `• Nominal Bansos  : **Rp ${bansosAmount.toLocaleString('id-ID')}** per orang\n` +
                `• Total Penerima  : **${receiverCount} member**\n` +
                `• Total Dana Keluar: **Rp ${totalDistributed.toLocaleString('id-ID')}**`,
              flags: 64
            });

            await sendGlobalEconomyAnnouncement(
              client,
              guild,
              author,
              '💸 Bansos Massal (Kekayaan Terbatas)',
              '🍚 Beras bansos turun! Bantuan sosial dibagikan khusus untuk warga yang total kekayaannya di bawah garis kemiskinan server. Yang dompetnya tebal minggir dulu ya, jangan ikut antre!',
              '#00FF88',
              [
                { name: 'Batas Kekayaan Maksimal', value: `Rp ${wealthLimit.toLocaleString('id-ID')}`, inline: true },
                { name: 'Nominal Bansos per Orang', value: `Rp ${bansosAmount.toLocaleString('id-ID')}`, inline: true },
                { name: 'Jumlah Penerima', value: `${receiverCount} member`, inline: true },
                { name: 'Total Dana Terdistribusi', value: `Rp ${totalDistributed.toLocaleString('id-ID')}`, inline: true }
              ]
            );

            const fresh = getBankPanelData(guildId, selectedTargetUserId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'global_reclaim_inactive_assets') {
          const preview = database.get(`
            SELECT 
                COUNT(w.user_id) as total_users,
                SUM(w.balance) as total_wallet_coins,
                SUM(COALESCE(bs.balance, 0)) as total_bank_coins,
                (
                    SELECT COALESCE(SUM(ui.quantity), 0) 
                    FROM user_inventory ui 
                    WHERE ui.guild_id = w.guild_id AND ui.user_id IN (
                        SELECT user_id FROM wallets WHERE guild_id = w.guild_id AND (last_active_date IS NULL OR last_active_date = '')
                    )
                ) as total_user_items,
                (
                    SELECT COALESCE(SUM(pi.quantity), 0) 
                    FROM pet_inventory pi 
                    WHERE pi.guild_id = w.guild_id AND pi.user_id IN (
                        SELECT user_id FROM wallets WHERE guild_id = w.guild_id AND (last_active_date IS NULL OR last_active_date = '')
                    )
                ) as total_pet_items
            FROM wallets w
            LEFT JOIN bank_savings bs ON w.user_id = bs.user_id AND w.guild_id = bs.guild_id
            WHERE w.guild_id = ? AND (w.last_active_date IS NULL OR w.last_active_date = '')
          `, [guildId]);

          const totalUsers = preview ? (preview.total_users || 0) : 0;
          const totalWallet = preview ? (preview.total_wallet_coins || 0) : 0;
          const totalBank = preview ? (preview.total_bank_coins || 0) : 0;
          const totalUserItems = preview ? (preview.total_user_items || 0) : 0;
          const totalPetItems = preview ? (preview.total_pet_items || 0) : 0;

          if (totalUsers === 0) {
            return iBank.reply({ content: 'ℹ️ Tidak ditemukan warga inaktif (yang belum pernah daily) di server ini.', flags: 64 });
          }

          const description = `**Penyitaan Aset Warga Inaktif (Never Daily)** secara massal.\n\n` +
            `• Warga Terdampak: **${totalUsers.toLocaleString('id-ID')} akun**\n` +
            `• Sita Koin Dompet: **Rp ${totalWallet.toLocaleString('id-ID')}**\n` +
            `• Sita Koin Tabungan Bank: **Rp ${totalBank.toLocaleString('id-ID')}**\n` +
            `• Hapus Item Inventaris Warga: **${totalUserItems.toLocaleString('id-ID')} item**\n` +
            `• Hapus Item Inventaris Pet: **${totalPetItems.toLocaleString('id-ID')} item**\n\n` +
            `⚠️ *Tindakan ini bersifat permanen dan tidak dapat dibatalkan!*`;

          const confirmed = await askConfirmation(iBank, author.id, description);
          if (!confirmed) return;

          let success = false;
          try {
            database.transaction(() => {
              // 1. Hapus user_inventory
              database.run(`
                DELETE FROM user_inventory 
                WHERE guild_id = ? AND user_id IN (
                  SELECT user_id FROM wallets WHERE guild_id = ? AND (last_active_date IS NULL OR last_active_date = '')
                )
              `, [guildId, guildId]);

              // 2. Hapus pet_inventory
              database.run(`
                DELETE FROM pet_inventory 
                WHERE guild_id = ? AND user_id IN (
                  SELECT user_id FROM wallets WHERE guild_id = ? AND (last_active_date IS NULL OR last_active_date = '')
                )
              `, [guildId, guildId]);

              // 3. Reset bank_savings
              database.run(`
                UPDATE bank_savings 
                SET balance = 0 
                WHERE guild_id = ? AND user_id IN (
                  SELECT user_id FROM wallets WHERE guild_id = ? AND (last_active_date IS NULL OR last_active_date = '')
                )
              `, [guildId, guildId]);

              // 4. Reset wallets balance & total_earned
              database.run(`
                UPDATE wallets 
                SET balance = 0, total_earned = 0 
                WHERE guild_id = ? AND (last_active_date IS NULL OR last_active_date = '')
              `, [guildId]);
            })();
            success = true;
          } catch (txErr) {
            console.error('Failed to execute reclaim transaction:', txErr);
            await iBank.followUp({ content: `❌ Gagal mengeksekusi penyitaan aset di database: ${txErr.message}`, flags: 64 }).catch(() => { });
          }

          if (success) {
            await iBank.followUp({
              content: `🔴 **PENYITAAN ASET WARGA INAKTIF SELESAI!**\n\n` +
                `• Total Akun Diproses  : **${totalUsers} warga**\n` +
                `• Saldo Dompet Disita : **Rp ${totalWallet.toLocaleString('id-ID')}**\n` +
                `• Saldo Bank Disita   : **Rp ${totalBank.toLocaleString('id-ID')}**\n` +
                `• Item Warga Dihapus  : **${totalUserItems.toLocaleString('id-ID')} pcs**\n` +
                `• Item Pet Dihapus    : **${totalPetItems.toLocaleString('id-ID')} pcs**`,
              flags: 64
            });

            await sendGlobalEconomyAnnouncement(
              client,
              guild,
              author,
              '🔴 Penyitaan Aset Warga Inaktif',
              '🚨 Kas Negara dipulihkan! Admin telah menyita seluruh koin (dompet & bank) serta menghapus inventaris item dari warga yang terbukti tidak pernah aktif berpartisipasi dalam klaim daily.',
              '#FF3366',
              [
                { name: 'Total Warga Terdampak', value: `${totalUsers} akun`, inline: true },
                { name: 'Total Koin Disita', value: `Rp ${(totalWallet + totalBank).toLocaleString('id-ID')}`, inline: true },
                { name: 'Total Item Dihapus', value: `${(totalUserItems + totalPetItems).toLocaleString('id-ID')} unit`, inline: true }
              ]
            );

            const fresh = getBankPanelData(guildId, selectedTargetUserId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'global_inflation_stats') {
          await iBank.deferReply({ flags: 64 });
          
          const totalWalletsRow = database.get('SELECT COUNT(*) as count, SUM(balance) as sum FROM wallets WHERE guild_id = ?', [guildId]);
          const totalSavingsRow = database.get('SELECT COUNT(*) as count, SUM(balance) as sum FROM bank_savings WHERE guild_id = ?', [guildId]);
          const activeWalletsRow = database.get("SELECT COUNT(*) as count, SUM(balance) as sum FROM wallets WHERE guild_id = ? AND (last_active_date IS NOT NULL AND last_active_date != '')", [guildId]);
          const inactiveWalletsRow = database.get("SELECT COUNT(*) as count, SUM(balance) as sum FROM wallets WHERE guild_id = ? AND (last_active_date IS NULL OR last_active_date = '')", [guildId]);

          const totalUsers = totalWalletsRow?.count || 0;
          const walletCoins = totalWalletsRow?.sum || 0;
          const bankCoins = totalSavingsRow?.sum || 0;
          const totalCoins = walletCoins + bankCoins;
          
          const activeUsers = activeWalletsRow?.count || 0;
          const activeCoins = (activeWalletsRow?.sum || 0) + bankCoins;
          
          const inactiveUsers = inactiveWalletsRow?.count || 0;
          const inactiveCoins = inactiveWalletsRow?.sum || 0;

          const activeCoinsPercent = totalCoins > 0 ? Math.round((activeCoins / totalCoins) * 100) : 0;
          const inactiveCoinsPercent = totalCoins > 0 ? Math.round((inactiveCoins / totalCoins) * 100) : 0;

          const activeLoansRow = database.get("SELECT COUNT(*) as count, SUM(total_due) as sum FROM bank_loans WHERE guild_id = ? AND status = 'ACTIVE'", [guildId]);
          const overdueLoansRow = database.get("SELECT COUNT(*) as count, SUM(total_due + penalty_accumulated) as sum FROM bank_loans WHERE guild_id = ? AND status = 'OVERDUE'", [guildId]);
          const totalDebt = (activeLoansRow?.sum || 0) + (overdueLoansRow?.sum || 0);

          const inflationEmbed = new EmbedBuilder()
            .setColor(0xF39C12)
            .setTitle('📈 LAPORAN STATISTIK INFLASI & SIRKULASI MONETER')
            .setDescription(
              `Berikut adalah rangkuman keadaan finansial global server Kosan 1A:\n\n` +
              `💰 **JUMLAH UANG BEREDAR (MONEY SUPPLY):**\n` +
              `• Total Sirkulasi Koin: **Rp ${totalCoins.toLocaleString('id-ID')}**\n` +
              `  ├ Saldo Dompet Warga: \`Rp ${walletCoins.toLocaleString('id-ID')}\`\n` +
              `  └ Saldo Tabungan Bank: \`Rp ${bankCoins.toLocaleString('id-ID')}\`\n\n` +
              `👥 **SEGMENTASI WARGA AKTIF VS INAKTIF:**\n` +
              `• Warga Aktif: **${activeUsers} jiwa** (Koin: **Rp ${activeCoins.toLocaleString('id-ID')}** — \`${activeCoinsPercent}%\` dari supply)\n` +
              `• Warga Inaktif: **${inactiveUsers} jiwa** (Koin: **Rp ${inactiveCoins.toLocaleString('id-ID')}** — \`${inactiveCoinsPercent}%\` dari supply)\n\n` +
              `🏛️ **UTANG PIUTANG PERBANKAN:**\n` +
              `• Total Piutang Bank: **Rp ${totalDebt.toLocaleString('id-ID')}**\n` +
              `  ├ Pinjaman Lancar: \`Rp ${(activeLoansRow?.sum || 0).toLocaleString('id-ID')}\` (${activeLoansRow?.count || 0} orang)\n` +
              `  └ Pinjaman Overdue: \`Rp ${(overdueLoansRow?.sum || 0).toLocaleString('id-ID')}\` (${overdueLoansRow?.count || 0} orang)\n\n` +
              `⚙️ **TARIF PAJAK AKTIF SAAT INI:**\n` +
              `• Pajak Jual Saham: **${config.market?.TRADE_TAX_PERCENT || 15}%** (Sinks)\n` +
              `• Pajak Transfer Uang: **${config.economy?.TRANSFER_TAX_PERCENT || 10}%** (Sinks)`
            )
            .setTimestamp()
            .setFooter({ text: 'Sentinel Moneter • Kebijakan Ekonomi Server' });

          await iBank.editReply({ embeds: [inflationEmbed] });
        }
        else if (action === 'global_adjust_taxes') {
          const modal = new ModalBuilder()
            .setCustomId('admin_bank_adjust_taxes_modal')
            .setTitle('Sesuaikan Tarif Pajak Moneter');

          const transferTaxInput = new TextInputBuilder()
            .setCustomId('transfer_tax')
            .setLabel('Pajak Transfer Koin (dalam %)')
            .setPlaceholder('Bawaan: 10. Masukkan angka 0 s/d 50')
            .setValue(String(config.economy?.TRANSFER_TAX_PERCENT || 10))
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const tradeTaxInput = new TextInputBuilder()
            .setCustomId('trade_tax')
            .setLabel('Pajak Penjualan Saham (dalam %)')
            .setPlaceholder('Bawaan: 15. Masukkan angka 0 s/d 50')
            .setValue(String(config.market?.TRADE_TAX_PERCENT || 15))
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(transferTaxInput),
            new ActionRowBuilder().addComponents(tradeTaxInput)
          );
          await iBank.showModal(modal);

          const sub = await iBank.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_bank_adjust_taxes_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const transferTax = parseInt(sub.fields.getTextInputValue('transfer_tax'));
            const tradeTax = parseInt(sub.fields.getTextInputValue('trade_tax'));

            if (isNaN(transferTax) || transferTax < 0 || transferTax > 50) {
              return sub.reply({ content: '❌ Pajak transfer harus berupa angka di antara 0% s/d 50%!', flags: 64 });
            }
            if (isNaN(tradeTax) || tradeTax < 0 || tradeTax > 50) {
              return sub.reply({ content: '❌ Pajak penjualan saham harus berupa angka di antara 0% s/d 50%!', flags: 64 });
            }

            const prevTransferTax = config.economy?.TRANSFER_TAX_PERCENT || 10;
            const prevTradeTax = config.market?.TRADE_TAX_PERCENT || 15;

            config.economy = config.economy || {};
            config.market = config.market || {};
            config.economy.TRANSFER_TAX_PERCENT = transferTax;
            config.market.TRADE_TAX_PERCENT = tradeTax;

            await sub.reply({
              content: `⚙️ **TARIF PAJAK BERHASIL DISELARASKAN!**\n\n` +
                `• Pajak Transfer Koin: **${transferTax}%** (sebelumnya: ${prevTransferTax}%)\n` +
                `• Pajak Jual Saham: **${tradeTax}%** (sebelumnya: ${prevTradeTax}%)\n\n` +
                `*Pengaturan pajak baru ini langsung berlaku untuk seluruh transaksi warga saat ini juga!*`,
              flags: 64
            });

            const fresh = getBankPanelData(guildId, selectedTargetUserId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
      }
    } catch (err) {
      console.error('Error in Bank Panel Interaction:', err);
      await iBank.reply({ content: `❌ Terjadi kesalahan: ${err.message}`, flags: 64 }).catch(() => { });
    }
  });

  collector.on('end', async (collected, reason) => {
    if (reason === 'transition') return;
    try {
      const fresh = getBankPanelData(guildId, selectedTargetUserId);
      fresh.components = [];
      await replyMsg.edit(fresh).catch(() => { });
    } catch (e) { }
  });

  return true;
}

/**
 * 🚓 3. PANEL ROBBERY, LAW & JAIL (LAPAS VIRTUAL)
 */
async function handleAdminRobberyPanel(messageOrInteraction, client, initialTargetUserId = null) {
  const isInteraction = !messageOrInteraction.author;
  const author = isInteraction ? messageOrInteraction.user : messageOrInteraction.author;
  const guildId = messageOrInteraction.guildId;
  const guild = messageOrInteraction.guild;

  if (!guildId) return false;

  let selectedTargetUserId = initialTargetUserId;

  const getRobberyPanelData = (gId, targetUserId) => {
    let embed = new EmbedBuilder()
      .setColor(0xFF3366) // Crimson Rose
      .setTitle('🚓 ADMIN CONTROL PANEL — HUKUM & LAPAS VIRTUAL')
      .setThumbnail(client.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({ text: 'Sentinel Admin • Lapas & Keamanan' });

    let targetText = '*Belum ada anggota terpilih (Silakan pilih di menu dropdown di bawah)*';
    if (targetUserId) {
      targetText = `🎯 **<@${targetUserId}>**\n` +
        `• ID: \`${targetUserId}\`\n`;

      const nowUnix = Math.floor(Date.now() / 1000);
      const jail = database.get('SELECT jail_until, jail_type FROM wallets WHERE user_id = ? AND guild_id = ? AND jail_until > ?', [targetUserId, gId, nowUnix]);
      if (jail) {
        targetText += `• Status Lapas: 🚨 **DITAHAN** (Sisa <t:${jail.jail_until}:R>)\n` +
          `• Alasan Sel: \`${jail.jail_type || 'Kegagalan Robbery/Tindakan Kriminal'}\`\n`;
      } else {
        targetText += `• Status Lapas: 🟢 Bebas Aktif\n`;
      }
    }

    embed.setDescription(
      `Kelola sanksi lapas virtual server, bebaskan tahanan paksa, reset global cooldown bank robbery, atau atur kedamaian server dari kejahatan:\n\n` +
      `👤 **STATUS PENJARA TARGET:**\n${targetText}`
    );

    const userSelect = new UserSelectMenuBuilder()
      .setCustomId('admin_rob_select_target')
      .setPlaceholder('👤 Pilih Anggota Target');

    const userRow = new ActionRowBuilder().addComponents(userSelect);

    const actionSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_rob_select_action')
      .setPlaceholder('🎯 Tindakan Hukum Target')
      .setDisabled(!targetUserId);

    actionSelect.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('🔓 Bebaskan Paksa dari Lapas')
        .setDescription('Mengeluarkan paksa anggota terpilih dari tahanan virtual saat ini')
        .setValue('action_free_jail'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🚨 Kurung Target ke Lapas (Modal)')
        .setDescription('Memasukkan paksa target ke penjara virtual dengan durasi menit')
        .setValue('action_jail_target_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('⏱️ Reset Cooldown Kriminal Target')
        .setDescription('Mereset cooldown mencuri (rob) & merampok bank (heist) target')
        .setValue('action_reset_cooldown_target')
    );

    const actionRow = new ActionRowBuilder().addComponents(actionSelect);

    const globalSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_rob_select_global')
      .setPlaceholder('🌐 Tindakan Hukum Global / Heist');

    globalSelect.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('🚨 Reset Cooldown Global Bank Heist')
        .setDescription('Mengizinkan seluruh warga kembali merampok Bank Server tanpa batas waktu tunggu')
        .setValue('global_reset_heist_cd'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🔓 Bebaskan Seluruh Tahanan Lapas')
        .setDescription('Mengeluarkan massal seluruh warga server dari penjara virtual seketika')
        .setValue('global_free_all_jail'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🚨 Tahan Massal Perampok >10x (Modal)')
        .setDescription('Memasukkan seluruh warga yang merampok >10 kali ke penjara virtual dengan denda kustom')
        .setValue('global_jail_all_modal')
    );

    const globalRow = new ActionRowBuilder().addComponents(globalSelect);

    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_rob_btn_back')
        .setLabel('🔙 Kembali ke Hub')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('admin_rob_btn_close')
        .setLabel('❌ Tutup Panel')
        .setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [userRow, actionRow, globalRow, btnRow] };
  };

  const initialData = getRobberyPanelData(guildId, selectedTargetUserId);
  let replyMsg;

  if (isInteraction) {
    await messageOrInteraction.update(initialData);
    replyMsg = messageOrInteraction.message;
  } else {
    replyMsg = await messageOrInteraction.reply(initialData);
  }

  const collector = replyMsg.createMessageComponentCollector({ time: 600000 });

  collector.on('collect', async iRob => {
    const isOwner = iRob.user.id === config.OWNER_ID;
    const isAdmin = iRob.member && iRob.member.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!isOwner && !isAdmin) {
      return iRob.reply({ content: '❌ Akses Ditolak! Tombol/menu dashboard ini dikunci khusus untuk Owner utama & Administrator server.', flags: 64 });
    }

    try {
      if (iRob.customId === 'admin_rob_select_target') {
        selectedTargetUserId = iRob.values[0];
        const fresh = getRobberyPanelData(guildId, selectedTargetUserId);
        await iRob.update(fresh);
      }
      else if (iRob.customId === 'admin_rob_btn_back') {
        collector.stop('transition');
        await handleAdminPanel(iRob, client);
      }
      else if (iRob.customId === 'admin_rob_btn_close') {
        collector.stop();
        await replyMsg.delete().catch(() => { });
      }
      else if (iRob.customId === 'admin_rob_select_action') {
        const action = iRob.values[0];
        if (!selectedTargetUserId) {
          return iRob.reply({ content: '❌ Silakan pilih target anggota terlebih dahulu!', flags: 64 });
        }

        if (action === 'action_free_jail') {
          const nowUnix = Math.floor(Date.now() / 1000);
          const wallet = database.get('SELECT jail_until FROM wallets WHERE user_id = ? AND guild_id = ?', [selectedTargetUserId, guildId]);
          const isJailed = wallet && wallet.jail_until > nowUnix;
          if (!isJailed) {
            return iRob.reply({ content: '❌ Anggota terpilih tidak sedang berada di dalam penjara virtual!', flags: 64 });
          }
          database.run("UPDATE wallets SET jail_until = 0, jail_type = '' WHERE user_id = ? AND guild_id = ?", [selectedTargetUserId, guildId]);
          await iRob.reply({ content: `🔓 Sukses membebaskan paksa <@${selectedTargetUserId}> dari penjara virtual.`, flags: 64 });
          const fresh = getRobberyPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => { });
        }
        else if (action === 'action_jail_target_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_rob_jail_modal')
            .setTitle('Kurung Target ke Lapas Virtual');

          const durationInput = new TextInputBuilder()
            .setCustomId('jail_duration')
            .setLabel('Durasi Penjara (Menit)')
            .setPlaceholder('Contoh: 15')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const reasonInput = new TextInputBuilder()
            .setCustomId('jail_reason')
            .setLabel('Alasan Penjara (Opsional)')
            .setPlaceholder('Contoh: Mengganggu ketertiban umum / Abuse')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(durationInput),
            new ActionRowBuilder().addComponents(reasonInput)
          );
          await iRob.showModal(modal);

          const sub = await iRob.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_rob_jail_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const minutes = parseInt(sub.fields.getTextInputValue('jail_duration'), 10);
            if (isNaN(minutes) || minutes <= 0) {
              return sub.reply({ content: '❌ Durasi harus berupa angka bulat positif di atas 0!', flags: 64 });
            }
            const reason = sub.fields.getTextInputValue('jail_reason') || 'Tindakan Disiplin Administrator';
            const jailUntil = Math.floor(Date.now() / 1000) + (minutes * 60);

            // Update database wallets
            database.run(
              'UPDATE wallets SET jail_until = ?, jail_type = ? WHERE user_id = ? AND guild_id = ?',
              [jailUntil, reason, selectedTargetUserId, guildId]
            );

            await sub.reply({ content: `🚨 Sukses menjebloskan <@${selectedTargetUserId}> ke Lapas Virtual selama **${minutes} menit** dengan alasan: \`${reason}\`!`, flags: 64 });
            const fresh = getRobberyPanelData(guildId, selectedTargetUserId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'action_reset_cooldown_target') {
          database.run(
            'UPDATE wallets SET last_rob_at = 0, last_heist_at = 0 WHERE user_id = ? AND guild_id = ?',
            [selectedTargetUserId, guildId]
          );
          await iRob.reply({ content: `⏱️ Sukses mereset cooldown kriminal (rob & heist) untuk <@${selectedTargetUserId}>!`, flags: 64 });
          const fresh = getRobberyPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => { });
        }
      }
      else if (iRob.customId === 'admin_rob_select_global') {
        const action = iRob.values[0];

        if (action === 'global_reset_heist_cd') {
          database.run(
            'INSERT INTO heist_cooldown (guild_id, last_heist_at) VALUES (?, 0) ON CONFLICT(guild_id) DO UPDATE SET last_heist_at = 0',
            [guildId]
          );
          database.run(
            'UPDATE wallets SET last_heist_at = 0 WHERE guild_id = ?',
            [guildId]
          );
          await iRob.reply({ content: '🚨 Sukses mereset global cooldown Bank Heist server. Warga dapat melakukan perampokan kembali!', flags: 64 });
          await sendGlobalEconomyAnnouncement(
            client,
            guild,
            author,
            '🚨 Reset Cooldown Global Bank Heist',
            '🚓 Sirene polisi mati total! Cooldown perampokan bank server telah direset. Para perampok profesional dan amatir dipersilakan merapatkan barisan, mari rampok bank secara tertib dan kondusif!',
            '#3498db',
            [],
            true
          );
        }
        else if (action === 'global_free_all_jail') {
          database.run("UPDATE wallets SET jail_until = 0, jail_type = '' WHERE guild_id = ?", [guildId]);
          await iRob.reply({ content: '🔓 Sukses membebaskan seluruh tahanan dari penjara virtual secara massal!', flags: 64 });
          await sendGlobalEconomyAnnouncement(
            client,
            guild,
            author,
            '🔓 Pembebasan Tahanan Massal',
            '🔓 Hari Raya Grasi! Pintu penjara virtual dibobol massal oleh admin. Seluruh warga yang sedang mendekam di sel tahanan kini bebas menghirup udara segar. Ingat, tobat ya dan kurangi kriminalitas!',
            '#3498db',
            [],
            true
          );
          const fresh = getRobberyPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => { });
        }
        else if (action === 'global_jail_all_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_rob_global_jail_modal')
            .setTitle('Tahan Massal Perampok >10x');

          const durationInput = new TextInputBuilder()
            .setCustomId('global_jail_duration')
            .setLabel('Durasi Penjara (Menit)')
            .setPlaceholder('Contoh: 15')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const reasonInput = new TextInputBuilder()
            .setCustomId('global_jail_reason')
            .setLabel('Alasan / Dekret (Opsional)')
            .setPlaceholder('Contoh: Darurat Keamanan / Malam Kudus')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(durationInput),
            new ActionRowBuilder().addComponents(reasonInput)
          );
          await iRob.showModal(modal);

          const sub = await iRob.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_rob_global_jail_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const minutes = parseInt(sub.fields.getTextInputValue('global_jail_duration'), 10);
            const reason = sub.fields.getTextInputValue('global_jail_reason') || 'Tindakan Darurat Global oleh Administrator';

            if (isNaN(minutes) || minutes <= 0) {
              return sub.reply({ content: '❌ Durasi harus berupa angka bulat positif di atas 0!', flags: 64 });
            }

            const wallets = database.all(
              `SELECT user_id, balance FROM wallets 
               WHERE guild_id = ? 
                 AND user_id IN (
                   SELECT robber_id FROM robbery_attempts 
                   WHERE guild_id = ? 
                   GROUP BY robber_id 
                   HAVING COUNT(*) > 10
                 )`,
              [guildId, guildId]
            );
            const now = Math.floor(Date.now() / 1000);
            const jailUntil = now + (minutes * 60);

            database.transaction(() => {
              wallets.forEach(w => {
                database.run(
                  'UPDATE wallets SET jail_until = ?, jail_type = ?, jail_count = jail_count + 1 WHERE user_id = ? AND guild_id = ?',
                  [jailUntil, reason, w.user_id, guildId]
                );
              });
            })();

            await sub.reply({ content: `🚨 Sukses menjebloskan **${wallets.length} perampok aktif (merampok >10x)** ke Lapas Virtual selama **${minutes} menit**!`, flags: 64 });

            await sendGlobalEconomyAnnouncement(
              client,
              guild,
              author,
              '🚨 TINDAKAN DARURAT: PENJARA PERAMPOK MASSAL',
              `Seluruh warga yang terdeteksi telah melakukan aksi perampokan lebih dari 10 kali dijebloskan ke tahanan virtual selama **${minutes} menit** tanpa denda.\n\n⚠️ **Alasan/Dekret:** *"${reason}"*`,
              '#e74c3c',
              [
                { name: '⏳ Durasi Penjara', value: `${minutes} Menit`, inline: true },
                { name: '👥 Jumlah Terhukum', value: `${wallets.length} Perampok`, inline: true }
              ],
              true
            );

            const fresh = getRobberyPanelData(guildId, selectedTargetUserId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
      }
    } catch (err) {
      console.error('Error in Robbery Panel Interaction:', err);
      await iRob.reply({ content: `❌ Terjadi kesalahan: ${err.message}`, flags: 64 }).catch(() => { });
    }
  });

  collector.on('end', async (collected, reason) => {
    if (reason === 'transition') return;
    try {
      const fresh = getRobberyPanelData(guildId, selectedTargetUserId);
      fresh.components = [];
      await replyMsg.edit(fresh).catch(() => { });
    } catch (e) { }
  });

  return true;
}

/**
 * 📈 4. PANEL BURSA SAHAM & EVENT PASAR
 */
async function handleAdminSahamPanel(messageOrInteraction, client, initialTicker = null) {
  const isInteraction = !messageOrInteraction.author;
  const author = isInteraction ? messageOrInteraction.user : messageOrInteraction.author;
  const guildId = messageOrInteraction.guildId;
  const guild = messageOrInteraction.guild;

  if (!guildId) return false;

  let selectedTicker = initialTicker;

  const getSahamPanelData = (gId, ticker) => {
    let embed = new EmbedBuilder()
      .setColor(0x10B981) // Velvet Emerald Green
      .setTitle('📈 ADMIN CONTROL PANEL — BURSA SAHAM & EVENT PASAR')
      .setThumbnail(client.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({ text: 'Sentinel Admin • Bursa Saham & Analitik' });

    const activeStocks = database.all('SELECT * FROM stocks WHERE guild_id = ?', [gId]);

    let bursaList = '*Tidak ada instrumen saham terdaftar di bursa*';
    if (activeStocks.length > 0) {
      const nowUnix = Math.floor(Date.now() / 1000);
      bursaList = activeStocks.map(s => {
        let trendSuffix = '';
        if (s.force_trend && s.force_trend !== 'NONE' && s.force_until > nowUnix) {
          const remainingMinutes = Math.ceil((s.force_until - nowUnix) / 60);
          const trendEmoji = s.force_trend.includes('PUMP') ? '🔥' : '💥';
          trendSuffix = ` [${trendEmoji} **${s.force_trend}** sisa ${remainingMinutes}m]`;
        }
        const bursaSupplyText = s.total_shares === 99999999 ? 'Tanpa Batas (♾️)' : `${s.available_shares.toLocaleString('id-ID')} lbr`;
        return `👉 **${s.stock_ticker}** (#${s.stock_name}) — Harga: \`Rp ${s.current_price.toLocaleString('id-ID')}\` | Sisa Bursa: \`${bursaSupplyText}\`${trendSuffix}`;
      }).join('\n');
    }

    let tickerText = ticker && ticker !== 'KOSONG' ? `🎯 **Ticker Terpilih:** \`${ticker}\` (Silakan tentukan tindakan di bawah)` : '*Belum ada ticker terpilih (Silakan pilih di dropdown bursa)*';

    embed.setDescription(
      `Kelola instrumen pasar server: daftarkan channel baru ke lantai bursa, manipulasi harga saham tertentu, bagikan dividen mingguan, atau picu event ekonomi makro:\n\n` +
      `📈 **DAFTAR SAHAM BURSA AKTIF:**\n${bursaList}\n\n` +
      `${tickerText}`
    );

    const tickerSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_saham_select_ticker')
      .setPlaceholder('📈 Pilih Ticker Saham');

    if (activeStocks.length > 0) {
      activeStocks.forEach(s => {
        tickerSelect.addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel(`${s.stock_ticker} - Rp ${s.current_price.toLocaleString('id-ID')}`)
            .setDescription(`Saham channel #${s.stock_name}`)
            .setValue(s.stock_ticker)
            .setDefault(ticker === s.stock_ticker)
        );
      });
    } else {
      tickerSelect.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Kosong')
          .setValue('KOSONG')
      ).setDisabled(true);
    }

    const tickerRow = new ActionRowBuilder().addComponents(tickerSelect);

    const actionSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_saham_select_action')
      .setPlaceholder('📉 Tindakan untuk Saham Terpilih')
      .setDisabled(!ticker || ticker === 'KOSONG');

    actionSelect.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('📈 Paksa Naikkan Harga (Pump Modal)')
        .setDescription('Meningkatkan paksa harga saham terpilih sebesar persentase tertentu (1 - 500%)')
        .setValue('bursa_action_pump_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('📉 Paksa Turunkan Harga (Drop Modal)')
        .setDescription('Menurunkan paksa harga saham terpilih sebesar persentase tertentu (1 - 99%)')
        .setValue('bursa_action_drop_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🧬 Manipulasi Tren Saham (Seharian/Per Jam)')
        .setDescription('Mengunci tren pergerakan harga saham terpilih (PUMP/DUMP/MAX/MIN) untuk durasi tertentu')
        .setValue('bursa_action_manipulate_trend_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('❌ Hapus Saham dari Bursa')
        .setDescription('Menghapus permanen instrumen saham ini dan membersihkan portofolio warga')
        .setValue('bursa_action_remove')
    );

    const actionRow = new ActionRowBuilder().addComponents(actionSelect);

    const globalSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_saham_select_global')
      .setPlaceholder('🌐 Picu Event Global & Kelola Bursa');

    globalSelect.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('📈 Picu Bursa: Event Bull Run')
        .setDescription('Memicu kenaikan harga saham bursa secara masif dan instan')
        .setValue('global_trigger_bull'),
      new StringSelectMenuOptionBuilder()
        .setLabel('📉 Picu Bursa: Event Market Crash')
        .setDescription('Memicu penurunan drastis harga saham bursa secara masif')
        .setValue('global_trigger_crash'),
      new StringSelectMenuOptionBuilder()
        .setLabel('📈 Pompa Semua Harga Saham (Max Out)')
        .setDescription('Membuat semua saham bernilai maksimal (Rp 10.000) secara instan')
        .setValue('global_action_pump_all'),
      new StringSelectMenuOptionBuilder()
        .setLabel('📉 Banting Semua Harga Saham (Crash Out)')
        .setDescription('Membuat semua saham runtuh ke harga minimal (Rp 10) secara instan')
        .setValue('global_action_drop_all'),
      new StringSelectMenuOptionBuilder()
        .setLabel('💰 Picu Bursa: Double Earning Hour')
        .setDescription('Memicu event pendapatan ganda bursa instan selama 1 jam')
        .setValue('global_trigger_double'),
      new StringSelectMenuOptionBuilder()
        .setLabel('💸 Bagikan Dividen Saham Mingguan')
        .setDescription('Memicu kalkulasi & pembagian dividen mingguan berbasis keaktifan chat warga')
        .setValue('global_trigger_dividends'),
      new StringSelectMenuOptionBuilder()
        .setLabel('➕ Daftarkan Channel Baru ke Bursa (Modal)')
        .setDescription('Mendaftarkan text channel baru server menjadi saham bursa')
        .setValue('bursa_global_add_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🔄 Re-Inisialisasi Bursa (Reset Default)')
        .setDescription('Mereset total bursa kembali ke setelan standard bot ($GENERAL, $LOUNGE, $SPAM)')
        .setValue('bursa_global_reinit')
    );

    const globalRow = new ActionRowBuilder().addComponents(globalSelect);

    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_saham_btn_back')
        .setLabel('🔙 Kembali ke Hub')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('admin_saham_btn_close')
        .setLabel('❌ Tutup Panel')
        .setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [tickerRow, actionRow, globalRow, btnRow] };
  };

  const initialData = getSahamPanelData(guildId, selectedTicker);
  let replyMsg;

  if (isInteraction) {
    await messageOrInteraction.update(initialData);
    replyMsg = messageOrInteraction.message;
  } else {
    replyMsg = await messageOrInteraction.reply(initialData);
  }

  const collector = replyMsg.createMessageComponentCollector({ time: 600000 });

  collector.on('collect', async iSaham => {
    const isOwner = iSaham.user.id === config.OWNER_ID;
    const isAdmin = iSaham.member && iSaham.member.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!isOwner && !isAdmin) {
      return iSaham.reply({ content: '❌ Akses Ditolak! Tombol/menu dashboard ini dikunci khusus untuk Owner utama & Administrator server.', flags: 64 });
    }

    try {
      if (iSaham.customId === 'admin_saham_select_ticker') {
        selectedTicker = iSaham.values[0];
        const fresh = getSahamPanelData(guildId, selectedTicker);
        await iSaham.update(fresh);
      }
      else if (iSaham.customId === 'admin_saham_btn_back') {
        collector.stop('transition');
        await handleAdminPanel(iSaham, client);
      }
      else if (iSaham.customId === 'admin_saham_btn_close') {
        collector.stop();
        await replyMsg.delete().catch(() => { });
      }
      else if (iSaham.customId === 'admin_saham_select_action') {
        const action = iSaham.values[0];
        if (!selectedTicker || selectedTicker === 'KOSONG') {
          return iSaham.reply({ content: '❌ Silakan pilih ticker saham terlebih dahulu!', flags: 64 });
        }

        if (action === 'bursa_action_pump_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_saham_pump_modal')
            .setTitle(`Pump Harga Saham ${selectedTicker}`);

          const pctInput = new TextInputBuilder()
            .setCustomId('pump_percent')
            .setLabel('Persentase Kenaikan (1 - 500)')
            .setPlaceholder('Contoh: 50 untuk naik +50%')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(pctInput));
          await iSaham.showModal(modal);

          const sub = await iSaham.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_saham_pump_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const percent = parseInt(sub.fields.getTextInputValue('pump_percent'));
            if (isNaN(percent) || percent < 1 || percent > 500) {
              return sub.reply({ content: '❌ Nilai harus berupa angka bulat antara 1 hingga 500!', flags: 64 });
            }
            const stock = stocks.getStock(guildId, selectedTicker);
            if (!stock) {
              return sub.reply({ content: '❌ Saham tidak ditemukan!', flags: 64 });
            }
            const oldPrice = stock.current_price;
            const newPrice = Math.min(config.market.MAX_PRICE, Math.round(oldPrice * (1 + percent / 100)));

            database.transaction(() => {
              database.run(
                'UPDATE stocks SET previous_price = ?, current_price = ? WHERE channel_id = ? AND guild_id = ?',
                [oldPrice, newPrice, stock.channel_id, guildId]
              );
              database.run(
                'INSERT INTO price_history (channel_id, guild_id, price, activity_score) VALUES (?, ?, ?, 0.0)',
                [stock.channel_id, guildId, newPrice]
              );
            })();

            await sub.reply({ content: `📈 Sukses menaikkan harga saham **${selectedTicker}** sebesar **+${percent}%** (Lama: Rp ${oldPrice.toLocaleString('id-ID')} -> Baru: Rp ${newPrice.toLocaleString('id-ID')})!`, flags: 64 });
            const fresh = getSahamPanelData(guildId, selectedTicker);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'bursa_action_drop_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_saham_drop_modal')
            .setTitle(`Drop Harga Saham ${selectedTicker}`);

          const pctInput = new TextInputBuilder()
            .setCustomId('drop_percent')
            .setLabel('Persentase Penurunan (1 - 99)')
            .setPlaceholder('Contoh: 15')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(pctInput));
          await iSaham.showModal(modal);

          const sub = await iSaham.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_saham_drop_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const percent = parseInt(sub.fields.getTextInputValue('drop_percent'));
            if (isNaN(percent) || percent < 1 || percent > 99) {
              return sub.reply({ content: '❌ Nilai harus berupa angka bulat antara 1 hingga 99!', flags: 64 });
            }
            const stock = stocks.getStock(guildId, selectedTicker);
            if (!stock) {
              return sub.reply({ content: '❌ Saham tidak ditemukan!', flags: 64 });
            }
            const oldPrice = stock.current_price;
            const newPrice = Math.max(config.market.MIN_PRICE, Math.round(oldPrice * (1 - percent / 100)));

            database.transaction(() => {
              database.run(
                'UPDATE stocks SET previous_price = ?, current_price = ? WHERE channel_id = ? AND guild_id = ?',
                [oldPrice, newPrice, stock.channel_id, guildId]
              );
              database.run(
                'INSERT INTO price_history (channel_id, guild_id, price, activity_score) VALUES (?, ?, ?, 0.0)',
                [stock.channel_id, guildId, newPrice]
              );
            })();

            await sub.reply({ content: `📉 Sukses menurunkan harga saham **${selectedTicker}** sebesar **${percent}%** (Lama: Rp ${oldPrice.toLocaleString('id-ID')} -> Baru: Rp ${newPrice.toLocaleString('id-ID')})!`, flags: 64 });
            const fresh = getSahamPanelData(guildId, selectedTicker);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'bursa_action_manipulate_trend_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_saham_trend_modal')
            .setTitle(`Kunci Tren ${selectedTicker}`);

          const trendInput = new TextInputBuilder()
            .setCustomId('trend_type')
            .setLabel('Tren (PUMP / DUMP / PUMP_MAX / DUMP_MIN / NONE)')
            .setPlaceholder('Ketik jenis tren (contoh: PUMP)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const durationInput = new TextInputBuilder()
            .setCustomId('trend_duration')
            .setLabel('Durasi Jam (Contoh: 24 untuk seharian, 1 per jam)')
            .setPlaceholder('Ketik angka jam (contoh: 24)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(trendInput),
            new ActionRowBuilder().addComponents(durationInput)
          );
          await iSaham.showModal(modal);

          const sub = await iSaham.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_saham_trend_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const trendVal = sub.fields.getTextInputValue('trend_type').trim().toUpperCase();
            const durationVal = parseFloat(sub.fields.getTextInputValue('trend_duration'));

            const validTrends = ['PUMP', 'DUMP', 'PUMP_MAX', 'DUMP_MIN', 'NONE'];
            if (!validTrends.includes(trendVal)) {
              return sub.reply({ content: '❌ Jenis tren tidak valid! Pilih: PUMP, DUMP, PUMP_MAX, DUMP_MIN, atau NONE.', flags: 64 });
            }

            if (isNaN(durationVal) || durationVal <= 0) {
              return sub.reply({ content: '❌ Durasi jam tidak valid! Masukkan angka positif (contoh: 24 untuk seharian, 1 untuk 1 jam).', flags: 64 });
            }

            const stock = stocks.getStock(guildId, selectedTicker);
            if (!stock) {
              return sub.reply({ content: '❌ Saham tidak ditemukan!', flags: 64 });
            }

            const durationSecs = durationVal * 3600;
            const expiresAt = trendVal === 'NONE' ? 0 : Math.floor(Date.now() / 1000) + durationSecs;

            database.transaction(() => {
              database.run(
                "UPDATE stocks SET force_trend = ?, force_until = ? WHERE channel_id = ? AND guild_id = ?",
                [trendVal, expiresAt, stock.channel_id, guildId]
              );
              // Jika MAX/MIN dipicu, perbarui harga langsung demi kepuasan admin instan!
              if (trendVal === 'PUMP_MAX') {
                const oldP = stock.current_price;
                const newP = config.market.MAX_PRICE;
                database.run('UPDATE stocks SET previous_price = ?, current_price = ? WHERE channel_id = ? AND guild_id = ?', [oldP, newP, stock.channel_id, guildId]);
                database.run('INSERT INTO price_history (channel_id, guild_id, price, activity_score) VALUES (?, ?, ?, 0.0)', [stock.channel_id, guildId, newP]);
              } else if (trendVal === 'DUMP_MIN') {
                const oldP = stock.current_price;
                const newP = config.market.MIN_PRICE;
                database.run('UPDATE stocks SET previous_price = ?, current_price = ? WHERE channel_id = ? AND guild_id = ?', [oldP, newP, stock.channel_id, guildId]);
                database.run('INSERT INTO price_history (channel_id, guild_id, price, activity_score) VALUES (?, ?, ?, 0.0)', [stock.channel_id, guildId, newP]);
              }
            })();

            let durationMsg = trendVal === 'NONE' ? 'tren dibersihkan' : `dikunci ke **${trendVal}** selama **${durationVal} jam**`;
            await sub.reply({ content: `🧬 Saham **${selectedTicker}** berhasil ${durationMsg}!`, flags: 64 });
            const fresh = getSahamPanelData(guildId, selectedTicker);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'bursa_action_remove') {
          const stock = stocks.getStock(guildId, selectedTicker);
          if (!stock) {
            return iSaham.reply({ content: '❌ Saham tidak ditemukan!', flags: 64 });
          }
          database.transaction(() => {
            database.run('DELETE FROM stocks WHERE stock_ticker = ? AND guild_id = ?', [selectedTicker, guildId]);
            database.run('DELETE FROM portfolios WHERE channel_id = ? AND guild_id = ?', [stock.channel_id, guildId]);
          })();
          selectedTicker = null;
          await iSaham.reply({ content: `❌ Sukses menghapus instrumen saham **${stock.stock_ticker}** dari bursa server.`, flags: 64 });
          const fresh = getSahamPanelData(guildId, selectedTicker);
          await replyMsg.edit(fresh).catch(() => { });
        }
      }
      else if (iSaham.customId === 'admin_saham_select_global') {
        const action = iSaham.values[0];

        if (action === 'global_trigger_bull') {
          const events = require('./events');
          events.triggerEvent(client, guild, events.EVENT_TYPES.BULL_RUN);
          await iSaham.reply({ content: '📈 Event bursa saham **BULL RUN** berhasil dipicu secara instan!', flags: 64 });
          await sendGlobalEconomyAnnouncement(
            client,
            guild,
            author,
            '📈 Event Bursa: Bull Run!',
            '🐂 BANTENG BURSA MENGAMUK! Pasar saham sedang Bullish parah! Harga semua saham naik meroket tinggi. Buruan borong atau jual aset portofolio kalian sebelum trennya berbalik arah!',
            '#2ECC71',
            []
          );
        }
        else if (action === 'global_trigger_crash') {
          const events = require('./events');
          events.triggerEvent(client, guild, events.EVENT_TYPES.MARKET_CRASH);
          await iSaham.reply({ content: '📉 Event bursa saham **MARKET CRASH** berhasil dipicu secara instan!', flags: 64 });
          await sendGlobalEconomyAnnouncement(
            client,
            guild,
            author,
            '📉 Event Bursa: Market Crash!',
            'Bearish Crash mendadak! Harga saham terjun bebas ke dasar jurang. Mohon tetap tenang, jangan panik dan tetap pegangan erat-erat!',
            '#FF3366',
            []
          );
        }
        else if (action === 'global_action_pump_all') {
          const activeStocks = database.all('SELECT * FROM stocks WHERE guild_id = ?', [guildId]);
          if (activeStocks.length === 0) {
            return iSaham.reply({ content: '❌ Tidak ada saham bursa terdaftar!', flags: 64 });
          }

          const confirmed = await askConfirmation(iSaham, author.id, "POMPA SEMUA HARGA SAHAM bursa ke Rp 10.000 (Maksimal)");
          if (!confirmed) return;

          database.transaction(() => {
            activeStocks.forEach(s => {
              const oldPrice = s.current_price;
              const newPrice = config.market.MAX_PRICE;
              database.run(
                'UPDATE stocks SET previous_price = ?, current_price = ? WHERE channel_id = ? AND guild_id = ?',
                [oldPrice, newPrice, s.channel_id, guildId]
              );
              database.run(
                'INSERT INTO price_history (channel_id, guild_id, price, activity_score) VALUES (?, ?, ?, 0.0)',
                [s.channel_id, guildId, newPrice]
              );
            });
          })();

          await iSaham.followUp({ content: '📈 Pompa Pasar Sukses! Seluruh saham server telah dinaikkan ke **Rp 10.000 (Maksimal)** secara instan! 🚀', flags: 64 });
          await sendGlobalEconomyAnnouncement(
            client,
            guild,
            author,
            '📈 Pompa Bursa Global (Max Out)',
            '🚀 MANIPULASI PASAR TINGKAT TINGGI! Seluruh saham server langsung dipompa paksa ke harga maksimal Rp 10.000! Investor kelas kakap tersenyum lebar melihat portofolio mereka mendadak hijau royo-royo.',
            '#2ECC71',
            []
          );
          const fresh = getSahamPanelData(guildId, selectedTicker);
          await replyMsg.edit(fresh).catch(() => { });
        }
        else if (action === 'global_action_drop_all') {
          const activeStocks = database.all('SELECT * FROM stocks WHERE guild_id = ?', [guildId]);
          if (activeStocks.length === 0) {
            return iSaham.reply({ content: '❌ Tidak ada saham bursa terdaftar!', flags: 64 });
          }

          const confirmed = await askConfirmation(iSaham, author.id, "BANTING/HANCURKAN SEMUA HARGA SAHAM bursa ke Rp 10 (Minimal)");
          if (!confirmed) return;

          database.transaction(() => {
            activeStocks.forEach(s => {
              const oldPrice = s.current_price;
              const newPrice = config.market.MIN_PRICE;
              database.run(
                'UPDATE stocks SET previous_price = ?, current_price = ? WHERE channel_id = ? AND guild_id = ?',
                [oldPrice, newPrice, s.channel_id, guildId]
              );
              database.run(
                'INSERT INTO price_history (channel_id, guild_id, price, activity_score) VALUES (?, ?, ?, 0.0)',
                [s.channel_id, guildId, newPrice]
              );
            });
          })();

          await iSaham.followUp({ content: '📉 Banting Pasar Sukses! Seluruh saham server telah diturunkan runtuh ke **Rp 10 (Minimal)** secara instan! 💥', flags: 64 });
          await sendGlobalEconomyAnnouncement(
            client,
            guild,
            author,
            '📉 Crash Bursa Global (Crash Out)',
            '💥 BENCANA BURSA SAHAM! Bandar ngambek, harga semua saham dibanting jatuh ke Rp 10! Yang beli di harga pucuk dipersilakan mengheningkan cipta sejenak.',
            '#FF3366',
            []
          );
          const fresh = getSahamPanelData(guildId, selectedTicker);
          await replyMsg.edit(fresh).catch(() => { });
        }
        else if (action === 'global_trigger_double') {
          const events = require('./events');
          events.triggerEvent(client, guild, events.EVENT_TYPES.DOUBLE_EARNINGS);
          await iSaham.reply({ content: '💰 Event bursa saham **DOUBLE EARNING HOUR** berhasil dipicu secara instan!', flags: 64 });
          await sendGlobalEconomyAnnouncement(
            client,
            guild,
            author,
            '💰 Event Bursa: Double Earning Hour!',
            '🪙 JAM PENUH BERKAH! Event pendapatan ganda untuk bursa saham diaktifkan selama 1 jam ke depan! Dapatkan koin 2x lipat lebih banyak dari setiap fluktuasi harga saham.',
            '#FFD700',
            []
          );
        }
        else if (action === 'global_trigger_dividends') {
          const triggerSuccess = scheduler.triggerDividendsWeekly ? scheduler.triggerDividendsWeekly(client, guildId) : false;
          await iSaham.reply({ content: `💸 Pembagian Dividen Saham Mingguan berhasil dipicu secara manual!`, flags: 64 });
          await sendGlobalEconomyAnnouncement(
            client,
            guild,
            author,
            '💸 Pembagian Dividen Saham Mingguan',
            '💰 GAJIAN DIVIDEN TIBA! Koin hasil bagi hasil investasi dibagikan secara manual ke dompet para pemegang saham beruntung. Terima kasih sudah mempercayakan modal Anda pada bursa Kosan 1A!',
            '#9B59B6',
            []
          );
        }
        else if (action === 'bursa_global_add_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_saham_add_modal')
            .setTitle('Daftarkan Saham Baru');

          const channelInput = new TextInputBuilder()
            .setCustomId('channel_id')
            .setLabel('ID Text Channel')
            .setPlaceholder('Masukkan ID channel (Contoh: 1503324994153873458)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const tickerInput = new TextInputBuilder()
            .setCustomId('ticker_name')
            .setLabel('Ticker Saham (Mulai dengan $)')
            .setPlaceholder('Contoh: $LOUNGE')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(channelInput),
            new ActionRowBuilder().addComponents(tickerInput)
          );
          await iSaham.showModal(modal);

          const sub = await iSaham.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_saham_add_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const chId = sub.fields.getTextInputValue('channel_id').trim();
            let tickName = sub.fields.getTextInputValue('ticker_name').trim().toUpperCase();
            if (!tickName.startsWith('$')) {
              tickName = '$' + tickName;
            }

            const channelObj = guild.channels.cache.get(chId);
            if (!channelObj) {
              return sub.reply({ content: '❌ Text channel dengan ID tersebut tidak ditemukan di server ini!', flags: 64 });
            }

            const existing = database.get('SELECT * FROM stocks WHERE (stock_ticker = ? OR channel_id = ?) AND guild_id = ?', [tickName, chId, guildId]);
            if (existing) {
              return sub.reply({ content: '❌ Ticker saham atau ID channel tersebut sudah terdaftar di bursa!', flags: 64 });
            }

            database.run(
              'INSERT INTO stocks (guild_id, channel_id, stock_name, stock_ticker, current_price, previous_price, available_shares) VALUES (?, ?, ?, ?, 100, 100, 500)',
              [guildId, chId, channelObj.name, tickName]
            );

            await sub.reply({ content: `✅ Sukses mendaftarkan channel <#${chId}> sebagai saham **${tickName}** di bursa!`, flags: 64 });
            await sendGlobalEconomyAnnouncement(
              client,
              guild,
              author,
              '➕ Pendaftaran Saham Bursa Baru',
              '➕ Barang dagangan baru nih bos! Ticker saham baru telah resmi terdaftar di bursa server. Ayo analisa pasarnya dan jadilah orang pertama yang menguasai lembar sahamnya sebelum harganya naik!',
              '#7C4DFF',
              [
                { name: 'Channel Saham', value: `<#${chId}>`, inline: true },
                { name: 'Ticker Saham', value: `**${tickName}**`, inline: true }
              ]
            );
            const fresh = getSahamPanelData(guildId, selectedTicker);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'bursa_global_reinit') {
          database.transaction(() => {
            database.run('DELETE FROM stocks WHERE guild_id = ?', [guildId]);
            database.run('DELETE FROM portfolios WHERE guild_id = ?', [guildId]);

            const defaults = [
              { name: 'general', ticker: '$GENERAL', price: 100 },
              { name: 'lounge', ticker: '$LOUNGE', price: 100 },
              { name: 'bot-spam', ticker: '$SPAM', price: 100 }
            ];

            defaults.forEach(d => {
              const ch = guild.channels.cache.find(c => c.name === d.name && c.isTextBased());
              if (ch) {
                database.run(
                  'INSERT INTO stocks (guild_id, channel_id, stock_name, stock_ticker, current_price, previous_price, available_shares) VALUES (?, ?, ?, ?, ?, ?, 500)',
                  [guildId, ch.id, d.name, d.ticker, d.price, d.price]
                );
              }
            });
          })();
          await iSaham.reply({ content: '🔄 Sukses mereset total seluruh instrumen bursa saham server kembali ke setelan default.', flags: 64 });
          await sendGlobalEconomyAnnouncement(
            client,
            guild,
            author,
            '🔄 Re-Inisialisasi Bursa Saham',
            '🔄 KEMBALI KE SETELAN PABRIK! Bursa saham di-reset total. Seluruh portofolio saham lama hangus dan instrumen default ($GENERAL, $LOUNGE, $SPAM) kembali dihadirkan. Mulai dari nol lagi ya kawan-kawan!',
            '#7C4DFF',
            []
          );
          const fresh = getSahamPanelData(guildId, selectedTicker);
          await replyMsg.edit(fresh).catch(() => { });
        }
      }
    } catch (err) {
      console.error('Error in Saham Panel Interaction:', err);
      await iSaham.reply({ content: `❌ Terjadi kesalahan: ${err.message}`, flags: 64 }).catch(() => { });
    }
  });

  collector.on('end', async (collected, reason) => {
    if (reason === 'transition') return;
    try {
      const fresh = getSahamPanelData(guildId, selectedTicker);
      fresh.components = [];
      await replyMsg.edit(fresh).catch(() => { });
    } catch (e) { }
  });

  return true;
}

/**
 * Mengambil seluruh ID member server yang terdaftar di database wallets, cache bot, atau Discord API
 */
async function getAllGuildMembers(guild, guildId) {
  const memberIds = new Set();
  try {
    const activeWallets = database.all('SELECT user_id FROM wallets WHERE guild_id = ?', [guildId]);
    if (activeWallets) {
      activeWallets.forEach(w => {
        if (w.user_id) memberIds.add(w.user_id);
      });
    }
  } catch (e) {
    console.error('Gagal mengambil wallets dari db:', e.message);
  }

  if (guild && guild.members) {
    guild.members.cache.forEach(member => {
      if (member && member.user && !member.user.bot) {
        memberIds.add(member.id);
      }
    });

    try {
      const fetchedMembers = await guild.members.fetch({ force: true });
      for (const [id, member] of fetchedMembers) {
        if (member && member.user && !member.user.bot) {
          memberIds.add(id);
        }
      }
    } catch (err) {
      console.warn('Gagal fetch all members via Discord API:', err.message);
    }
  }
  return Array.from(memberIds);
}

/**
 * ⚡ 5. PANEL BYPASS & ABYUS (SABOTASE EKONOMI)
 */
/**
 * ⚡ 5. PANEL BYPASS & ABYUS (SABOTASE EKONOMI)
 */
async function handleAdminAbyusPanel(messageOrInteraction, client) {
  const isInteraction = !messageOrInteraction.author;
  const author = isInteraction ? messageOrInteraction.user : messageOrInteraction.author;
  const guildId = messageOrInteraction.guildId;
  const guild = messageOrInteraction.guild;

  if (!guildId) return false;

  let includeFreeAll = false;
  let includeResetCds = false;

  const getAbyusPanelData = (gId) => {
    const settings = getOrCreateEbyusSettings(gId);

    let embed = new EmbedBuilder()
      .setColor(0x00E5FF) // Celestial Ice Blue
      .setTitle('⚡ ADMIN CONTROL PANEL — BYPASS & EVENT ABYUS')
      .setThumbnail(client.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({ text: 'Sentinel Admin • Keamanan & Bypass Server' });

    let giftCoinsText = (settings.gift_coins || 0) > 0 ? `🟢 **Rp ${(settings.gift_coins || 0).toLocaleString('id-ID')}**` : '⚪ **Nonaktif (0)**';
    let giftItemText = (settings.gift_item_qty || 0) > 0 && settings.gift_item_id ? `🟢 **${settings.gift_item_qty}x ${settings.gift_item_id}**` : '⚪ **Nonaktif**';

    embed.setDescription(
      `Sabotase persentase kemenangan gacha role, atur multiplier obrolan chat warga, set batas waktu auto-reset event, atau lakukan penghentian darurat:\n\n` +
      `📊 **STATUS BYPASS & EKONOMI SERVER:**\n` +
      `• 📢 **Status Event**: ${settings.is_active === 1 ? '🔴 **AKTIF (SEDANG BERJALAN)**' : '⚪ **TERTUNDA (Klik Broadcast untuk mengaktifkannya)**'}\n` +
      `• 🎰 **Mode Gacha Role**: \`${settings.gacha_mode}\`\n` +
      `• 🪙 **Pengali Koin Chat**: \`${settings.coin_multiplier === 1 ? 'Nonaktif (1x)' : settings.coin_multiplier + 'x'}\`\n` +
      `• ⏱️ **Masa Berlaku Bypass**: ${settings.expires_at > 0 ? `<t:${settings.expires_at}:R>` : '`Permanen (Manual)`'}\n` +
      `• 🔓 **Anti-Jail Mode**: ${settings.anti_jail === 1 ? '🟢 **AKTIF (Anti Penjara)**' : '⚪ **Nonaktif**'}\n\n` +
      `🎁 **HADIAH MASSAL (DIBAGIKAN SAAT BROADCAST):**\n` +
      `• Koin Massal per Warga: ${giftCoinsText}\n` +
      `• Item Massal per Warga: ${giftItemText}\n\n` +
      `⚙️ **OPSI PENGAKTIFAN TAMBAHAN (DIKIRIM SAAT BROADCAST):**\n` +
      `• Bebaskan Semua Tahanan: ${includeFreeAll ? '🟢 **Ya (Aktif)**' : '⚪ **Tidak (Nonaktif)**'}\n` +
      `• Reset Semua Cooldown: ${includeResetCds ? '🟢 **Ya (Aktif)**' : '⚪ **Tidak (Nonaktif)**'}`
    );

    const gachaSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_abyus_select_gacha')
      .setPlaceholder('🎰 Mode Gacha Role');

    const gachaOptions = [
      { label: '🟢 Normal Mode (75% Zonk)', value: 'NORMAL', desc: 'Sesuai dengan probabilitas standar mesin gacha' },
      { label: '🟡 Easy Mode (40% Zonk)', value: 'EASY', desc: 'Tingkat kemenangan ditingkatkan hampir 2x lipat' },
      { label: '🟠 Super Easy Mode (15% Zonk)', value: 'SUPER_EASY', desc: 'Tingkat kemenangan ditingkatkan sangat tinggi' },
      { label: '🔴 Abuse Mode (0% Zonk - 100% Win!)', value: 'ABUSE', desc: 'Menang terus! Tingkat kegagalan disetel ke nol persen' }
    ];

    gachaOptions.forEach(opt => {
      gachaSelect.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(opt.label)
          .setDescription(opt.desc)
          .setValue(opt.value)
          .setDefault(settings.gacha_mode === opt.value)
      );
    });

    const gachaRow = new ActionRowBuilder().addComponents(gachaSelect);

    const coinSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_abyus_select_multiplier')
      .setPlaceholder('🪙 Pengali Koin Chat');

    const coinOptions = [
      { label: '❌ Nonaktifkan Multiplier (1x)', value: '1', desc: 'Pendapatan koin chat normal (5 - 15 Rp per chat)' },
      { label: '⚡ 3x Coin Multiplier', value: '3', desc: 'Koin yang didapat dilipatgandakan 3 kali lipat!' },
      { label: '⚡ 4x Coin Multiplier', value: '4', desc: 'Koin yang didapat dilipatgandakan 4 kali lipat!' },
      { label: '⚡ 5x Coin Multiplier', value: '5', desc: 'Koin yang didapat dilipatgandakan 5 kali lipat!' },
      { label: '⚡ 6x Coin Multiplier', value: '6', desc: 'Koin yang didapat dilipatgandakan 6 kali lipat!' },
      { label: '⚡ 7x Coin Multiplier', value: '7', desc: 'Koin yang didapat dilipatgandakan 7 kali lipat!' },
      { label: '💀 8x ABUSE Multiplier!', value: '8', desc: 'SABOTASE MAKSIMAL! Koin chat dilipatgandakan 8x lipat!' }
    ];

    coinOptions.forEach(opt => {
      coinSelect.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(opt.label)
          .setDescription(opt.desc)
          .setValue(opt.value)
          .setDefault(settings.coin_multiplier === parseInt(opt.value))
      );
    });

    const coinRow = new ActionRowBuilder().addComponents(coinSelect);

    // Redesigned action selection dropdown
    const actionSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_abyus_select_config_action')
      .setPlaceholder('⚙️ Aksi & Konfigurasi Tambahan...');

    actionSelect.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('⏱️ Set Durasi Event')
        .setDescription('Mengatur batas waktu aktifnya event bypass')
        .setValue('action_set_duration'),
      new StringSelectMenuOptionBuilder()
        .setLabel('💸 Set Hadiah Koin Massal')
        .setDescription('Mengatur koin massal gratis untuk seluruh member')
        .setValue('action_set_gift_coins'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🎒 Set Hadiah Item Massal')
        .setDescription('Mengatur item massal gratis untuk seluruh member')
        .setValue('action_set_gift_item'),
      new StringSelectMenuOptionBuilder()
        .setLabel(`🔓 Toggle Anti-Jail: ${settings.anti_jail === 1 ? 'YA (Aktif)' : 'TIDAK (Nonaktif)'}`)
        .setDescription('Bebaskan warga dari penjara sistem selama event Abyus aktif')
        .setValue('action_toggle_anti_jail'),
      new StringSelectMenuOptionBuilder()
        .setLabel(`🔓 Toggle Bebaskan Tahanan: ${includeFreeAll ? 'YA (Aktif)' : 'TIDAK (Nonaktif)'}`)
        .setDescription('Mengosongkan sel tahanan Lapas saat event di-broadcast')
        .setValue('action_toggle_free'),
      new StringSelectMenuOptionBuilder()
        .setLabel(`⏱️ Toggle Reset Cooldowns: ${includeResetCds ? 'YA (Aktif)' : 'TIDAK (Nonaktif)'}`)
        .setDescription('Reset cooldown perampokan, heist & ekspedisi pet saat event di-broadcast')
        .setValue('action_toggle_reset'),
      new StringSelectMenuOptionBuilder()
        .setLabel('📊 Lihat Status Real-time')
        .setDescription('Menampilkan ringkasan status bypass saat ini')
        .setValue('action_show_status'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🎟️ Buat Kode Promo Baru')
        .setDescription('Membuat kode voucher promo/redeem baru untuk warga')
        .setValue('action_create_promo')
    );

    const configActionRow = new ActionRowBuilder().addComponents(actionSelect);

    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_abyus_btn_broadcast')
        .setLabel('📢 Broadcast Event')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('admin_abyus_btn_stop_abyus')
        .setLabel('🛑 Hentikan Event')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('admin_abyus_btn_back')
        .setLabel('🔙 Kembali')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('admin_abyus_btn_close')
        .setLabel('❌ Tutup')
        .setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [gachaRow, coinRow, configActionRow, btnRow] };
  };

  const initialData = getAbyusPanelData(guildId);
  let replyMsg;

  if (isInteraction) {
    await messageOrInteraction.update(initialData);
    replyMsg = messageOrInteraction.message;
  } else {
    replyMsg = await messageOrInteraction.reply(initialData);
  }

  const collector = replyMsg.createMessageComponentCollector({ time: 600000 });

  collector.on('collect', async iAbyus => {
    const isOwner = iAbyus.user.id === config.OWNER_ID;
    const isAdmin = iAbyus.member && iAbyus.member.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!isOwner && !isAdmin) {
      return iAbyus.reply({ content: '❌ Akses Ditolak! Tombol/menu dashboard ini dikunci khusus untuk Owner utama & Administrator server.', flags: 64 });
    }

    const nowUnix = Math.floor(Date.now() / 1000);

    try {
      if (iAbyus.customId === 'admin_abyus_select_gacha') {
        const mode = iAbyus.values[0];
        database.run('UPDATE ebyus_settings SET gacha_mode = ?, is_active = 0, updated_at = ?, updated_by = ? WHERE guild_id = ?', [mode, nowUnix, iAbyus.user.id, guildId]);
        await iAbyus.reply({ content: `🎰 Sukses menyetel mode gacha ke **${mode}** (belum aktif, silakan klik **Broadcast Event** untuk mengaktifkannya secara massal!).`, flags: 64 });
        const fresh = getAbyusPanelData(guildId);
        await replyMsg.edit(fresh).catch(() => { });
      }
      else if (iAbyus.customId === 'admin_abyus_select_multiplier') {
        const mult = parseInt(iAbyus.values[0]);
        database.run('UPDATE ebyus_settings SET coin_multiplier = ?, is_active = 0, updated_at = ?, updated_by = ? WHERE guild_id = ?', [mult, nowUnix, iAbyus.user.id, guildId]);
        await iAbyus.reply({ content: `🪙 Sukses menyetel multiplier koin chat ke **${mult}x** (belum aktif, silakan klik **Broadcast Event** untuk mengaktifkannya secara massal!).`, flags: 64 });
        const fresh = getAbyusPanelData(guildId);
        await replyMsg.edit(fresh).catch(() => { });
      }
      else if (iAbyus.customId === 'admin_abyus_select_config_action') {
        const val = iAbyus.values[0];
        if (val === 'action_toggle_anti_jail') {
          const settings = getOrCreateEbyusSettings(guildId);
          const nextState = settings.anti_jail === 1 ? 0 : 1;
          database.run('UPDATE ebyus_settings SET anti_jail = ? WHERE guild_id = ?', [nextState, guildId]);
          await iAbyus.reply({ content: `🔓 Mode Anti-Jail sekarang: **${nextState === 1 ? 'AKTIF (ON)' : 'NONAKTIF (OFF)'}**`, flags: 64 });
          const fresh = getAbyusPanelData(guildId);
          await replyMsg.edit(fresh).catch(() => { });
        }
        else if (val === 'action_set_duration') {
          const modal = new ModalBuilder()
            .setCustomId('admin_ebyus_duration_modal')
            .setTitle('Atur Durasi Event Bypass');

          const durInput = new TextInputBuilder()
            .setCustomId('dur_minutes')
            .setLabel('Durasi Event (dalam Menit)')
            .setPlaceholder('Masukkan angka menit (Contoh: 20)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(durInput));
          await iAbyus.showModal(modal);

          const sub = await iAbyus.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_ebyus_duration_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const minutes = parseInt(sub.fields.getTextInputValue('dur_minutes'));
            if (isNaN(minutes) || minutes < 0) {
              return sub.reply({ content: '❌ Durasi harus berupa angka di atas 0!', flags: 64 });
            }
            const expiresAt = minutes > 0 ? nowUnix + minutes * 60 : 0;
            database.run('UPDATE ebyus_settings SET expires_at = ?, is_active = 0, updated_at = ?, updated_by = ? WHERE guild_id = ?', [expiresAt, nowUnix, iAbyus.user.id, guildId]);

            await sub.reply({ content: `⏱️ Sukses menyetel durasi event bypass menjadi **${minutes} menit** (belum aktif, silakan klik **Broadcast Event** untuk mengaktifkannya secara massal!).`, flags: 64 });
            const fresh = getAbyusPanelData(guildId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (val === 'action_set_gift_coins') {
          const modal = new ModalBuilder()
            .setCustomId('admin_abyus_give_coins_modal')
            .setTitle('Bagi Koin Massal (Abyus)');

          const amountInput = new TextInputBuilder()
            .setCustomId('coin_amount')
            .setLabel('Jumlah Koin per Member (Bisa minus)')
            .setPlaceholder('Contoh: 100000 atau -50000')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
          await iAbyus.showModal(modal);

          const sub = await iAbyus.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_abyus_give_coins_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const amount = parseInt(sub.fields.getTextInputValue('coin_amount'));
            if (isNaN(amount) || amount === 0) {
              return sub.reply({ content: '❌ Jumlah harus berupa angka bulat bukan nol!', flags: 64 });
            }

            database.run('UPDATE ebyus_settings SET gift_coins = ? WHERE guild_id = ?', [amount, guildId]);

            await sub.reply({ content: `💸 Sukses menyetel hadiah koin massal ke **Rp ${amount.toLocaleString('id-ID')}** per member (hadiah akan otomatis dibagikan dan diumumkan saat Anda mengklik **Broadcast Event**!).`, flags: 64 });
            const fresh = getAbyusPanelData(guildId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (val === 'action_set_gift_item') {
          const itemSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_abyus_select_item_to_give')
            .setPlaceholder('🎒 Pilih item yang ingin dibagikan...');

          const items = [
            { id: 'LOCKPICK', name: '🕵️‍♂️ Lockpick', description: 'Alat membobol rumah/kosan warga' },
            { id: 'SOAP', name: '🧼 Soap (Sabun)', description: 'Sabun licin untuk melarikan diri' },
            { id: 'LAMBO', name: '🏎️ Lamborgini Kosan', description: 'Mobil sports prestise sultan kos' },
            { id: 'GOLD', name: '👑 Emas Batangan 24K', description: 'Pajangan laci kos penahan inflasi' },
            { id: 'IPHONE', name: '📱 iPhone 16 Pro Max', description: 'Hp sultan meskipun layar retak' },
            { id: 'TICKET_GACHA', name: '🎫 Tiket Gacha Pet', description: 'Tiket memutar gacha peliharaan' },
            { id: 'FOOD_PREMIUM', name: '🥩 Pakan Premium Pet', description: 'Makanan bernutrisi tinggi untuk pet' },
            { id: 'MEDICINE', name: '💊 Obat Pet Sakit', description: 'Sembuhkan HP pet yang terluka parah' },
            { id: 'LUCKY_AMULET', name: '🔮 Jimat Keberuntungan (Amulet)', description: 'Jimat pelindung kematian pet sekali pakai' }
          ];

          items.forEach(it => {
            itemSelect.addOptions(
              new StringSelectMenuOptionBuilder()
                .setLabel(it.name)
                .setDescription(it.description)
                .setValue(it.id)
            );
          });

          const selectRow = new ActionRowBuilder().addComponents(itemSelect);
          const backBtnRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('admin_abyus_btn_item_give_cancel')
              .setLabel('🔙 Kembali')
              .setStyle(ButtonStyle.Secondary)
          );

          await iAbyus.update({
            content: '🎒 **PILIH ITEM YANG INGIN DIBAGIKAN MASSAL:**',
            components: [selectRow, backBtnRow]
          });
        }
        else if (val === 'action_toggle_free') {
          includeFreeAll = !includeFreeAll;
          await iAbyus.reply({ content: `🔓 Opsi Bebaskan Semua Tahanan saat broadcast sekarang: **${includeFreeAll ? 'AKTIF (ON)' : 'NONAKTIF (OFF)'}**`, flags: 64 });
          const fresh = getAbyusPanelData(guildId);
          await replyMsg.edit(fresh).catch(() => { });
        }
        else if (val === 'action_toggle_reset') {
          includeResetCds = !includeResetCds;
          await iAbyus.reply({ content: `⏱️ Opsi Reset Semua Cooldown saat broadcast sekarang: **${includeResetCds ? 'AKTIF (ON)' : 'NONAKTIF (OFF)'}**`, flags: 64 });
          const fresh = getAbyusPanelData(guildId);
          await replyMsg.edit(fresh).catch(() => { });
        }
        else if (val === 'action_show_status') {
          const settings = getOrCreateEbyusSettings(guildId);
          const statusEmb = embeds.ebyusStatusEmbed(guild, settings);
          await iAbyus.reply({ embeds: [statusEmb], flags: 64 });
        }
        else if (val === 'action_create_promo') {
          const modal = new ModalBuilder()
            .setCustomId('admin_abyus_create_promo_modal')
            .setTitle('Buat Kode Promo Baru');

          const codeInput = new TextInputBuilder()
            .setCustomId('promo_code')
            .setLabel('Kode Promo (Alfanumerik)')
            .setPlaceholder('Contoh: ABUSEMANIA')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const coinsInput = new TextInputBuilder()
            .setCustomId('promo_coins')
            .setLabel('Hadiah Koin (0 jika tidak ada)')
            .setPlaceholder('Contoh: 100000')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const itemInput = new TextInputBuilder()
            .setCustomId('promo_item_id')
            .setLabel('ID Item Hadiah (Kosongkan jika tidak ada)')
            .setPlaceholder('Contoh: FOOD_PREMIUM atau TICKET_GACHA')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

          const qtyInput = new TextInputBuilder()
            .setCustomId('promo_item_qty')
            .setLabel('Jumlah Item Hadiah (0 jika tidak ada)')
            .setPlaceholder('Contoh: 3')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

          const quotaInput = new TextInputBuilder()
            .setCustomId('promo_quota')
            .setLabel('Kuota Klaim (-1 untuk tanpa batas)')
            .setPlaceholder('Contoh: 20')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(codeInput),
            new ActionRowBuilder().addComponents(coinsInput),
            new ActionRowBuilder().addComponents(itemInput),
            new ActionRowBuilder().addComponents(qtyInput),
            new ActionRowBuilder().addComponents(quotaInput)
          );
          await iAbyus.showModal(modal);

          const sub = await iAbyus.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_abyus_create_promo_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const pCode = sub.fields.getTextInputValue('promo_code').toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
            const pCoins = parseInt(sub.fields.getTextInputValue('promo_coins')) || 0;
            const pItemId = sub.fields.getTextInputValue('promo_item_id').toUpperCase().trim() || null;
            const pItemQty = parseInt(sub.fields.getTextInputValue('promo_item_qty')) || 0;
            const pQuota = parseInt(sub.fields.getTextInputValue('promo_quota'));

            if (!pCode) {
              return sub.reply({ content: '❌ Kode promo tidak boleh kosong dan harus alfanumerik!', flags: 64 });
            }
            if (isNaN(pQuota)) {
              return sub.reply({ content: '❌ Kuota klaim harus berupa angka bulat (-1 untuk tanpa batas)!', flags: 64 });
            }

            const expiresAt = Math.floor(Date.now() / 1000) + 86400 * 7; // Aktif 7 hari

            // Simpan ke database
            const exist = database.get('SELECT 1 FROM promo_codes WHERE code = ?', [pCode]);
            if (exist) {
              database.run(
                'UPDATE promo_codes SET reward_coins = ?, reward_item_id = ?, reward_item_qty = ?, max_claims = ?, current_claims = 0, expires_at = ? WHERE code = ?',
                [pCoins, pItemId, pItemQty, pQuota, expiresAt, pCode]
              );
            } else {
              database.run(
                'INSERT INTO promo_codes (code, reward_coins, reward_item_id, reward_item_qty, max_claims, current_claims, expires_at) VALUES (?, ?, ?, ?, ?, 0, ?)',
                [pCode, pCoins, pItemId, pItemQty, pQuota, expiresAt]
              );
            }

            let rewardStr = '';
            if (pCoins > 0) rewardStr += `• 🪙 Koin: **Rp ${pCoins.toLocaleString('id-ID')}**\n`;
            if (pItemId && pItemQty > 0) rewardStr += `• 📦 Item: **${pItemQty}x \`${pItemId}\`**\n`;

            await sub.reply({
              content: `🎟️ **SUKSES MEMBUAT KODE PROMO!**\n\n` +
                `• Kode: **${pCode}**\n` +
                `• Kuota: **${pQuota === -1 ? 'Unlimited' : pQuota + ' orang'}**\n` +
                `• Berlaku s/d: <t:${expiresAt}:F> (<t:${expiresAt}:R>)\n` +
                `• Hadiah:\n${rewardStr || '• (Tidak ada hadiah)'}`,
              flags: 64
            });
            const fresh = getAbyusPanelData(guildId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
      }
      else if (iAbyus.customId === 'admin_abyus_select_item_to_give') {
        const itemId = iAbyus.values[0];

        const modal = new ModalBuilder()
          .setCustomId(`admin_abyus_give_item_qty_modal_${itemId}`)
          .setTitle(`Jumlah Hadiah Massal (${itemId})`);

        const qtyInput = new TextInputBuilder()
          .setCustomId('item_qty')
          .setLabel(`Jumlah ${itemId} per Member (Bisa minus)`)
          .setPlaceholder('Contoh: 5 atau -2')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(qtyInput));
        await iAbyus.showModal(modal);

        const sub = await iAbyus.awaitModalSubmit({
          filter: (s) => s.customId === `admin_abyus_give_item_qty_modal_${itemId}` && s.user.id === author.id,
          time: 60000
        }).catch(() => null);

        if (sub) {
          const qty = parseInt(sub.fields.getTextInputValue('item_qty'));
          if (isNaN(qty) || qty === 0) {
            return sub.reply({ content: '❌ Jumlah harus berupa angka bulat bukan nol!', flags: 64 });
          }

          database.run('UPDATE ebyus_settings SET gift_item_id = ?, gift_item_qty = ? WHERE guild_id = ?', [itemId, qty, guildId]);

          await sub.reply({ content: `🎒 Sukses menyetel hadiah item massal ke **${qty}x ${itemId}** per member (hadiah akan otomatis dibagikan dan diumumkan saat Anda mengklik **Broadcast Event**!).`, flags: 64 });
          const fresh = getAbyusPanelData(guildId);
          await replyMsg.edit(fresh).catch(() => { });
        }
      }
      else if (iAbyus.customId === 'admin_abyus_btn_item_give_cancel') {
        const fresh = getAbyusPanelData(guildId);
        await iAbyus.update(fresh).catch(() => { });
      }
      else if (iAbyus.customId === 'admin_abyus_btn_broadcast') {
        const settings = getOrCreateEbyusSettings(guildId);
        const distributedCoins = settings.gift_coins || 0;
        const distributedItemName = settings.gift_item_id || '';
        const distributedItemQty = settings.gift_item_qty || 0;

        // Distribusikan hadiah secara massal jika dikonfigurasi
        if (distributedCoins > 0 || distributedItemQty !== 0) {
          const memberIds = await getAllGuildMembers(guild, guildId);
          if (memberIds.length > 0) {
            database.transaction(() => {
              for (const memberId of memberIds) {
                // 1. Bagikan koin
                if (distributedCoins > 0) {
                  let wallet = database.get('SELECT balance FROM wallets WHERE user_id = ? AND guild_id = ?', [memberId, guildId]);
                  if (!wallet) {
                    database.run(
                      `INSERT INTO wallets (user_id, guild_id, balance, total_earned, last_message_at) 
                       VALUES (?, ?, ?, ?, ?)`,
                      [memberId, guildId, 0, 0, 0]
                    );
                    wallet = { balance: 0 };
                  }

                  const newBal = Math.max(0, wallet.balance + distributedCoins);
                  database.run(
                    `UPDATE wallets 
                     SET balance = ?, total_earned = total_earned + ? 
                     WHERE user_id = ? AND guild_id = ?`,
                    [newBal, distributedCoins > 0 ? distributedCoins : 0, memberId, guildId]
                  );

                  database.run(
                    `INSERT INTO transactions (user_id, guild_id, type, amount) 
                     VALUES (?, ?, ?, ?)`,
                    [memberId, guildId, distributedCoins > 0 ? 'ADMIN_GIVEALL' : 'ADMIN_TAKEALL', distributedCoins]
                  );
                }

                // 2. Bagikan item
                if (distributedItemQty !== 0 && distributedItemName) {
                  updateAdminInventory(memberId, guildId, distributedItemName, distributedItemQty);
                }
              }
            })();
          }
        }

        // Execute supplementary actions if toggled
        if (includeFreeAll) {
          database.run("UPDATE wallets SET jail_until = 0, jail_type = '' WHERE guild_id = ?", [guildId]);
        }
        if (includeResetCds) {
          database.run(
            'INSERT INTO heist_cooldown (guild_id, last_heist_at) VALUES (?, 0) ON CONFLICT(guild_id) DO UPDATE SET last_heist_at = 0',
            [guildId]
          );
          database.run(
            'UPDATE wallets SET last_heist_at = 0, last_rob_at = 0, expedition_cooldown_until = 0, daily_expedition_count = 0 WHERE guild_id = ?',
            [guildId]
          );
        }

        // Aktifkan event dan reset konfigurasi hadiah agar bersih
        database.run(
          'UPDATE ebyus_settings SET is_active = 1, gift_coins = 0, gift_item_id = NULL, gift_item_qty = 0 WHERE guild_id = ?',
          [guildId]
        );

        // Ambil daftar kode promo aktif untuk dilampirkan di embed broadcast
        const activePromos = database.all(
          `SELECT * FROM promo_codes 
           WHERE (max_claims = -1 OR current_claims < max_claims) 
             AND (expires_at = 0 OR expires_at > ?)`,
          [nowUnix]
        );

        let activePromosText = '';
        if (activePromos.length > 0) {
          activePromosText += `\n\n🎟️ **KODE VOUCHER / PROMO AKTIF:**`;
          for (const p of activePromos) {
            let rewards = [];
            if (p.reward_coins > 0) {
              rewards.push(`Rp ${p.reward_coins.toLocaleString('id-ID')}`);
            }
            if (p.reward_item_qty !== 0 && p.reward_item_id) {
              if (p.reward_item_qty > 0) {
                rewards.push(`${p.reward_item_qty}x \`${p.reward_item_id}\``);
              } else {
                rewards.push(`Penarikan: ${Math.abs(p.reward_item_qty)}x \`${p.reward_item_id}\``);
              }
            }
            const rewardStr = rewards.length > 0 ? rewards.join(' + ') : 'Tanpa Hadiah';
            const quotaStr = p.max_claims === -1 ? 'Tanpa Batas' : `${p.max_claims - p.current_claims} Klaim Tersisa`;
            const expiryStr = p.expires_at > 0 ? `(Berakhir <t:${p.expires_at}:R>)` : '';
            activePromosText += `\n  👉 **\`${p.code}\`** (Hadiah: ${rewardStr} | Kuota: ${quotaStr}) ${expiryStr}`;
          }
          activePromosText += `\n\n*👉 Klaim voucher Anda dengan mengetik:* **\`.claim <KODE>\`** *di channel obrolan bot!*`;
        }

        const broadcastEmb = embeds.ebyusBroadcastEmbed(
          guild,
          settings.gacha_mode,
          settings.coin_multiplier,
          settings.expires_at,
          includeFreeAll,
          includeResetCds,
          distributedCoins,
          distributedItemName,
          distributedItemQty,
          activePromosText
        );

        const targetChannelId = config.ANNOUNCEMENT_CHANNEL_ID || '1422642326798598348';
        let targetChannel = guild.channels.cache.get(targetChannelId);
        if (!targetChannel) {
          try {
            targetChannel = await guild.channels.fetch(targetChannelId);
          } catch (e) {
            // Fallback to living room if announcement channel fails
            targetChannel = guild.channels.cache.get('1422642326798598348') || await guild.channels.fetch('1422642326798598348').catch(() => messageOrInteraction.channel);
          }
        }

        if (targetChannel) {
          await targetChannel.send({ content: '@everyone 🚨 **EVENT ABUSE AKTIF!** 🚨', embeds: [broadcastEmb] });
          await iAbyus.reply({ content: `✅ Sukses menyiarkan pengumuman Ebyus ke channel <#${targetChannel.id}> dan mengaktifkan event!`, flags: 64 });
        } else {
          await iAbyus.reply({ content: '❌ Gagal menemukan channel untuk menyiarkan pengumuman!', flags: 64 });
        }

        // Reset toggles after broadcasting
        includeFreeAll = false;
        includeResetCds = false;

        const fresh = getAbyusPanelData(guildId);
        await replyMsg.edit(fresh).catch(() => { });
      }
      else if (iAbyus.customId === 'admin_abyus_btn_stop_abyus') {
        database.run(
          'UPDATE ebyus_settings SET gacha_mode = ?, coin_multiplier = ?, expires_at = 0, is_active = 0, updated_at = ?, updated_by = ? WHERE guild_id = ?',
          ['NORMAL', 1, nowUnix, iAbyus.user.id, guildId]
        );
        await iAbyus.reply({ content: '🛑 **Sukses menghentikan seluruh Event Abuse!** Mode gacha direset ke `NORMAL`, multiplier koin chat kembali ke `1x` (nonaktif), dan status event dimatikan.', flags: 64 });
        const fresh = getAbyusPanelData(guildId);
        await replyMsg.edit(fresh).catch(() => { });
      }
      else if (iAbyus.customId === 'admin_abyus_btn_back') {
        collector.stop('transition');
        await handleAdminPanel(iAbyus, client);
      }
      else if (iAbyus.customId === 'admin_abyus_btn_close') {
        collector.stop();
        await replyMsg.delete().catch(() => { });
      }
    } catch (err) {
      console.error('Error in Abyus Panel Interaction:', err);
      await iAbyus.reply({ content: `❌ Terjadi kesalahan: ${err.message}`, flags: 64 }).catch(() => { });
    }
  });

  collector.on('end', async (collected, reason) => {
    if (reason === 'transition') return;
    try {
      const fresh = getAbyusPanelData(guildId);
      fresh.components = [];
      await replyMsg.edit(fresh).catch(() => { });
    } catch (e) { }
  });

  return true;
}

/**
 * 🎭 6. PANEL TOKO ROLE & GAME ToD
 */
async function handleAdminShopPanel(messageOrInteraction, client) {
  const isInteraction = !messageOrInteraction.author;
  const author = isInteraction ? messageOrInteraction.user : messageOrInteraction.author;
  const guildId = messageOrInteraction.guildId;
  const guild = messageOrInteraction.guild;

  if (!guildId) return false;

  const getShopPanelData = (gId) => {
    let embed = new EmbedBuilder()
      .setColor(0x7C4DFF) // Royal Violet
      .setTitle('🎭 ADMIN CONTROL PANEL — TOKO ROLE & GAME ToD')
      .setThumbnail(client.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({ text: 'Sentinel Admin • Toko Role & ToD Sesi' });

    const shopItems = database.all('SELECT * FROM shop_items WHERE guild_id = ?', [gId]);
    let shopList = '*Tidak ada item role terdaftar di toko*';
    if (shopItems.length > 0) {
      shopList = shopItems.map((item, idx) => {
        return `${idx + 1}. <@&${item.role_id}> (${item.tier}) — Harga: \`Rp ${item.price.toLocaleString('id-ID')}\` | Stok: \`${item.stock === -1 ? 'Unlimited' : item.stock + ' slot'}\``;
      }).join('\n');
    }

    embed.setDescription(
      `Tambahkan/hapus role dari toko, kelola ketersediaan stok role, atau kontrol sesi game Truth or Dare di Voice Channel:\n\n` +
      `🎭 **DAFTAR ITEM TOKO ROLE AKTIF:**\n${shopList}`
    );

    const shopActionSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_shop_select_action')
      .setPlaceholder('🎭 Kelola Penjualan Toko Role');

    shopActionSelect.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('➕ Tambahkan Jual Role Baru (Modal)')
        .setDescription('Menjual role server ke etalase toko beserta tier & deskripsi')
        .setValue('shop_action_add_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('❌ Hapus Item Role dari Toko (Modal)')
        .setDescription('Menghapus item role terdaftar dari toko bursa')
        .setValue('shop_action_remove_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('⚙️ Ubah Jumlah Stok Role (Modal)')
        .setDescription('Mengubah ketersediaan slot role terdaftar')
        .setValue('shop_action_stock_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('👑 Auto-Setup 5 Toko Role Prestise')
        .setDescription('Membuat & menyetel otomatis role Common s/d Mythic')
        .setValue('shop_action_auto')
    );

    const shopActionRow = new ActionRowBuilder().addComponents(shopActionSelect);

    const todActionSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_shop_select_tod')
      .setPlaceholder('🎲 Kelola Game Truth or Dare (ToD)');

    todActionSelect.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('📢 Siarkan Pengumuman Sesi ToD Baru')
        .setDescription('Menyiarkan template embed peluncuran game ToD cantik')
        .setValue('tod_action_announce'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🛑 Hentikan Paksa Sesi Game ToD Aktif')
        .setDescription('Menghentikan paksa sesi ToD yang berjalan di Voice Channel')
        .setValue('tod_action_stop'),
      new StringSelectMenuOptionBuilder()
        .setLabel('➕ Tambahkan Pertanyaan ToD Baru (Modal)')
        .setDescription('Menambahkan pertanyaan kustom baru ke database ToD')
        .setValue('tod_action_add_question_modal')
    );

    const todActionRow = new ActionRowBuilder().addComponents(todActionSelect);

    const auctionActionSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_shop_select_auction')
      .setPlaceholder('🔨 Kelola Lelang Global (Auction House)');

    auctionActionSelect.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('🔨 Mulai Lelang Admin Baru (Modal)')
        .setDescription('Buka lelang koin/item/pet baru ke seluruh warga')
        .setValue('auction_host_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🔨 Kelola Lelang Aktif & Tutup Lelang')
        .setDescription('Tinjau bid lelang berjalan dan tutup lelang saat ini')
        .setValue('auction_list_active')
    );

    const auctionActionRow = new ActionRowBuilder().addComponents(auctionActionSelect);

    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_shop_btn_back')
        .setLabel('🔙 Kembali ke Hub')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('admin_shop_btn_close')
        .setLabel('❌ Tutup Panel')
        .setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [shopActionRow, todActionRow, auctionActionRow, btnRow] };
  };

  const initialData = getShopPanelData(guildId);
  let replyMsg;

  if (isInteraction) {
    await messageOrInteraction.update(initialData);
    replyMsg = messageOrInteraction.message;
  } else {
    replyMsg = await messageOrInteraction.reply(initialData);
  }

  const collector = replyMsg.createMessageComponentCollector({ time: 600000 });

  collector.on('collect', async iShop => {
    const isOwner = iShop.user.id === config.OWNER_ID;
    const isAdmin = iShop.member && iShop.member.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!isOwner && !isAdmin) {
      return iShop.reply({ content: '❌ Akses Ditolak! Tombol/menu dashboard ini dikunci khusus untuk Owner utama & Administrator server.', flags: 64 });
    }

    try {
      if (iShop.customId === 'admin_shop_btn_back') {
        collector.stop('transition');
        await handleAdminPanel(iShop, client);
      }
      else if (iShop.customId === 'admin_shop_btn_close') {
        collector.stop();
        await replyMsg.delete().catch(() => { });
      }
      else if (iShop.customId === 'admin_shop_select_action') {
        const action = iShop.values[0];

        if (action === 'shop_action_add_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_shop_add_modal')
            .setTitle('Jual Role Baru di Toko');

          const roleInput = new TextInputBuilder()
            .setCustomId('role_id')
            .setLabel('ID Role Discord')
            .setPlaceholder('Masukkan ID role (Contoh: 1503324994153873458)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const priceInput = new TextInputBuilder()
            .setCustomId('role_price')
            .setLabel('Harga Jual (Koin Rupiah)')
            .setPlaceholder('Contoh: 150000')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const tierInput = new TextInputBuilder()
            .setCustomId('role_tier')
            .setLabel('Tier Rarity (COMMON/RARE/EPIC/LEGENDARY)')
            .setPlaceholder('Masukkan tier (Contoh: EPIC)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(roleInput),
            new ActionRowBuilder().addComponents(priceInput),
            new ActionRowBuilder().addComponents(tierInput)
          );
          await iShop.showModal(modal);

          const sub = await iShop.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_shop_add_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const rId = sub.fields.getTextInputValue('role_id').trim();
            const price = parseInt(sub.fields.getTextInputValue('role_price'));
            const tier = sub.fields.getTextInputValue('role_tier').trim().toUpperCase();

            if (isNaN(price) || price <= 0) {
              return sub.reply({ content: '❌ Harga harus berupa angka di atas 0!', flags: 64 });
            }

            const roleObj = guild.roles.cache.get(rId);
            if (!roleObj) {
              return sub.reply({ content: '❌ Role dengan ID tersebut tidak ditemukan di server!', flags: 64 });
            }

            database.run(
              'INSERT INTO shop_items (guild_id, role_id, role_name, price, tier, stock, description) VALUES (?, ?, ?, ?, ?, -1, ?)',
              [guildId, rId, roleObj.name, price, tier, `Koleksi kasta role ${tier} eksklusif.`]
            );

            await sub.reply({ content: `✅ Sukses menjual role <@&${rId}> seharga **Rp ${price.toLocaleString('id-ID')}** di etalase Toko!`, flags: 64 });
            const fresh = getShopPanelData(guildId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'shop_action_remove_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_shop_remove_modal')
            .setTitle('Hapus Role dari Toko');

          const roleInput = new TextInputBuilder()
            .setCustomId('role_id')
            .setLabel('ID Role Discord')
            .setPlaceholder('Masukkan ID role terdaftar')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(roleInput));
          await iShop.showModal(modal);

          const sub = await iShop.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_shop_remove_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const rId = sub.fields.getTextInputValue('role_id').trim();
            database.run('DELETE FROM shop_items WHERE role_id = ? AND guild_id = ?', [rId, guildId]);

            await sub.reply({ content: `❌ Sukses menghapus role ID \`${rId}\` dari etalase toko.`, flags: 64 });
            const fresh = getShopPanelData(guildId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'shop_action_stock_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_shop_stock_modal')
            .setTitle('Ubah Stok Role Toko');

          const roleInput = new TextInputBuilder()
            .setCustomId('role_id')
            .setLabel('ID Role Discord')
            .setPlaceholder('Masukkan ID role')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const stockInput = new TextInputBuilder()
            .setCustomId('role_stock')
            .setLabel('Jumlah Slot Stok (-1 untuk Unlimited)')
            .setPlaceholder('Contoh: 10')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(roleInput),
            new ActionRowBuilder().addComponents(stockInput)
          );
          await iShop.showModal(modal);

          const sub = await iShop.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_shop_stock_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const rId = sub.fields.getTextInputValue('role_id').trim();
            const stock = parseInt(sub.fields.getTextInputValue('role_stock'));

            if (isNaN(stock) || stock < -1) {
              return sub.reply({ content: '❌ Stok tidak valid!', flags: 64 });
            }

            database.run('UPDATE shop_items SET stock = ? WHERE role_id = ? AND guild_id = ?', [stock, rId, guildId]);

            await sub.reply({ content: `✅ Sukses memperbarui stok role ID \`${rId}\` menjadi **${stock === -1 ? 'Unlimited' : stock + ' slot'}**!`, flags: 64 });
            const fresh = getShopPanelData(guildId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'shop_action_auto') {
          const defaultRoles = [
            { name: 'Mythic Resident', color: '#FF007F', price: 1500000, tier: 'MYTHIC', desc: 'Kasta legendaris tertinggi di server.' },
            { name: 'Legendary Resident', color: '#FFD700', price: 500000, tier: 'LEGENDARY', desc: 'Pemukim legendaris berwibawa tinggi.' },
            { name: 'Epic Resident', color: '#9D00FF', price: 150000, tier: 'EPIC', desc: 'Warga elit yang disegani oleh publik.' },
            { name: 'Rare Resident', color: '#00BFFF', price: 50000, tier: 'RARE', desc: 'Warga kelas menengah yang aktif.' },
            { name: 'Common Resident', color: '#00FF88', price: 15000, tier: 'COMMON', desc: 'Anggota pemukiman resmi pemegang KTP.' }
          ];

          let createdCount = 0;
          for (const rData of defaultRoles) {
            const existing = database.get('SELECT * FROM shop_items WHERE role_name = ? AND guild_id = ?', [rData.name, guildId]);
            if (!existing) {
              const newRole = await guild.roles.create({
                name: rData.name,
                color: rData.color,
                reason: 'Sentinel Auto Shop Role Initialization'
              }).catch(() => null);

              if (newRole) {
                database.run(
                  'INSERT INTO shop_items (guild_id, role_id, role_name, price, tier, stock, description) VALUES (?, ?, ?, ?, ?, -1, ?)',
                  [guildId, newRole.id, rData.name, rData.price, rData.tier, rData.desc]
                );
                createdCount++;
              }
            }
          }
          await iShop.reply({ content: `🎭 Sukses menginisialisasi Toko Role. Berhasil mendaftarkan & membuat **${createdCount}/5** kasta role prestise server!`, flags: 64 });
          const fresh = getShopPanelData(guildId);
          await replyMsg.edit(fresh).catch(() => { });
        }
      }
      else if (iShop.customId === 'admin_shop_select_tod') {
        const action = iShop.values[0];

        if (action === 'tod_action_announce') {
          const todAnnounceEmb = embeds.todAnnounceEmbed ? embeds.todAnnounceEmbed(guild) : new EmbedBuilder().setTitle('🎲 TRUTH OR DARE GAME').setDescription('Game Truth or Dare telah diluncurkan di Voice Channel!');
          await messageOrInteraction.channel.send({ content: '@everyone 🎲 **GAME TRUTH OR DARE AKTIF!** 🎲', embeds: [todAnnounceEmb] });
          await iShop.reply({ content: '📢 Sukses menyiarkan template pengumuman ToD ke channel ini!', flags: 64 });
        }
        else if (action === 'tod_action_stop') {
          try {
            const voiceEvents = require('../voice_events');
            if (voiceEvents.forceStopTodGame) {
              voiceEvents.forceStopTodGame(guildId);
            } else {
              const audio = require('../voice_events/audio');
              if (audio.clearVoiceConnection) {
                audio.clearVoiceConnection(guildId);
              }
            }
          } catch (e) { }
          await iShop.reply({ content: '🛑 Sukses menghentikan paksa sesi aktif game ToD di Voice Channel.', flags: 64 });
        }
        else if (action === 'tod_action_add_question_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_shop_tod_add_modal')
            .setTitle('Tambah Pertanyaan ToD');

          const typeInput = new TextInputBuilder()
            .setCustomId('question_type')
            .setLabel('Tipe (TRUTH / DARE)')
            .setPlaceholder('Contoh: truth')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const categoryInput = new TextInputBuilder()
            .setCustomId('question_cat')
            .setLabel('Kategori (CHILL / DEEP / SPICY)')
            .setPlaceholder('Contoh: chill')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const textInput = new TextInputBuilder()
            .setCustomId('question_text')
            .setLabel('Pertanyaan / Tantangan')
            .setPlaceholder('Masukkan pertanyaan/tantangan...')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(typeInput),
            new ActionRowBuilder().addComponents(categoryInput),
            new ActionRowBuilder().addComponents(textInput)
          );
          await iShop.showModal(modal);

          const sub = await iShop.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_shop_tod_add_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const qType = sub.fields.getTextInputValue('question_type').trim().toLowerCase();
            const qCat = sub.fields.getTextInputValue('question_cat').trim().toLowerCase();
            const qText = sub.fields.getTextInputValue('question_text').trim();

            if (!['truth', 'dare'].includes(qType) || !['chill', 'deep', 'spicy'].includes(qCat)) {
              return sub.reply({ content: '❌ Tipe atau Kategori tidak valid! Pilihan tipe: truth/dare. Pilihan kategori: chill/deep/spicy.', flags: 64 });
            }

            database.run(
              'INSERT INTO tod_questions (type, category, question_text, created_by) VALUES (?, ?, ?, ?)',
              [qType, qCat, qText, author.id]
            );

            await sub.reply({ content: `✅ Sukses menambahkan pertanyaan **${qType}** (${qCat}) ke database!`, flags: 64 });
          }
        }
      }
      else if (iShop.customId === 'admin_shop_select_auction') {
        const action = iShop.values[0];

        if (action === 'auction_host_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_shop_auction_host_modal')
            .setTitle('Mulai Lelang Admin Baru');

          const typeInput = new TextInputBuilder()
            .setCustomId('item_type')
            .setLabel('Tipe Aset (GENERAL / PET)')
            .setPlaceholder('GENERAL atau PET')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const idInput = new TextInputBuilder()
            .setCustomId('item_id')
            .setLabel('ID Item / Nama Pet')
            .setPlaceholder('Contoh: TICKET_GACHA atau LAMBO')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const qtyInput = new TextInputBuilder()
            .setCustomId('item_qty')
            .setLabel('Jumlah')
            .setPlaceholder('Contoh: 1')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const minBidInput = new TextInputBuilder()
            .setCustomId('min_bid')
            .setLabel('Harga Minimum Bid (Koin)')
            .setPlaceholder('Contoh: 1000')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const durationInput = new TextInputBuilder()
            .setCustomId('duration_hours')
            .setLabel('Durasi Lelang (dalam Jam)')
            .setPlaceholder('Contoh: 24')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(typeInput),
            new ActionRowBuilder().addComponents(idInput),
            new ActionRowBuilder().addComponents(qtyInput),
            new ActionRowBuilder().addComponents(minBidInput),
            new ActionRowBuilder().addComponents(durationInput)
          );
          await iShop.showModal(modal);

          const sub = await iShop.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_shop_auction_host_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const iType = sub.fields.getTextInputValue('item_type').toUpperCase().trim();
            const iId = sub.fields.getTextInputValue('item_id').toUpperCase().trim();
            const iQty = parseInt(sub.fields.getTextInputValue('item_qty'));
            const iMinBid = parseInt(sub.fields.getTextInputValue('min_bid'));
            const iDur = parseInt(sub.fields.getTextInputValue('duration_hours'));

            if (!['GENERAL', 'PET'].includes(iType)) {
              return sub.reply({ content: '❌ Tipe Aset tidak valid! Harus GENERAL atau PET.', flags: 64 });
            }
            if (!iId) {
              return sub.reply({ content: '❌ ID Item tidak boleh kosong!', flags: 64 });
            }
            if (isNaN(iQty) || iQty <= 0) {
              return sub.reply({ content: '❌ Jumlah harus berupa angka bulat positif!', flags: 64 });
            }
            if (isNaN(iMinBid) || iMinBid < 0) {
              return sub.reply({ content: '❌ Minimal bid tidak boleh kurang dari 0!', flags: 64 });
            }
            if (isNaN(iDur) || iDur <= 0) {
              return sub.reply({ content: '❌ Durasi lelang harus berupa angka jam positif!', flags: 64 });
            }

            const endsAt = Math.floor(Date.now() / 1000) + iDur * 3600;

            const auctionRes = database.run(
              'INSERT INTO auction_items (guild_id, item_type, item_id, quantity, min_bid, current_bid, ends_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [guildId, iType, iId, iQty, iMinBid, iMinBid, endsAt, 'ACTIVE']
            );

            const auctionEmbed = new EmbedBuilder()
              .setColor(0xE74C3C)
              .setTitle('🔨 EVENT LELANG GLOBAL RESMI — KAS NEGARA 🔨')
              .setDescription(
                `Kas Negara menyelenggarakan pelelangan umum untuk aset langka berikut:\n\n` +
                `📦 **Aset Dilelang:** **${iQty}x \`${iId}\`** (Tipe: \`${iType}\`)\n` +
                `💵 **Minimal Penawaran (Starting Bid):** **Rp ${iMinBid.toLocaleString('id-ID')}**\n` +
                `⏳ **Masa Penawaran Berakhir:** <t:${endsAt}:F> (<t:${endsAt}:R>)\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `👉 *Ketik perintah \`.bid <id_lelang> <jumlah_koin>\` di channel bot biasa untuk mengajukan penawaran harga secara sah!* (ID Lelang: \`${auctionRes.lastInsertRowid}\`)`
              )
              .setTimestamp()
              .setFooter({ text: 'Sentinel Auction House • Penawaran Tertinggi Menang!' });

            const targetChannelId = config.REPORT_CHANNEL_ID || messageOrInteraction.channelId;
            const targetChannel = guild.channels.cache.get(targetChannelId) || messageOrInteraction.channel;
            if (targetChannel) {
              await targetChannel.send({ content: '@everyone 🔨 **LELANG BARU TELAH DIBUKA!**', embeds: [auctionEmbed] }).catch(() => {});
            }

            await sub.reply({
              content: `✅ **SUKSES MEMBUAT LELANG BARU!**\n\n` +
                `• ID Lelang: \`${auctionRes.lastInsertRowid}\`\n` +
                `• Item: **${iQty}x ${iId}**\n` +
                `• Bid Awal: **Rp ${iMinBid.toLocaleString('id-ID')}**\n` +
                `• Broadcast dikirim ke <#${targetChannel?.id}>.`,
              flags: 64
            });

            const fresh = getShopPanelData(guildId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'auction_list_active') {
          await iShop.deferReply({ flags: 64 });
          const auctions = database.all("SELECT * FROM auction_items WHERE guild_id = ? AND status = 'ACTIVE' ORDER BY id DESC LIMIT 5", [guildId]);
          if (auctions.length === 0) {
            return iShop.editReply({ content: 'ℹ️ Tidak ada lelang aktif saat ini.' });
          }

          let listText = '🔨 **DAFTAR LELANG AKTIF SAAT INI:**\n\n';
          auctions.forEach((a, idx) => {
            const bidderText = a.highest_bidder_id ? `<@${a.highest_bidder_id}>` : '*Belum ada*';
            listText += `${idx + 1}. **ID: ${a.id}** — **${a.quantity}x ${a.item_id}**\n` +
              `   └ 💰 Bid Tertinggi: **Rp ${a.current_bid.toLocaleString('id-ID')}** (${bidderText}) | ⏳ Selesai: <t:${a.ends_at}:R>\n`;
          });

          const closeSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_shop_auction_close_select')
            .setPlaceholder('🔨 Tutup Lelang Instan (Tentukan Pemenang)');

          auctions.forEach(a => {
            closeSelect.addOptions(
              new StringSelectMenuOptionBuilder()
                .setLabel(`Tutup & Menangkan ID: ${a.id}`)
                .setDescription(`Tutup lelang item ${a.item_id} secara live`)
                .setValue(String(a.id))
            );
          });

          const row = new ActionRowBuilder().addComponents(closeSelect);
          const listMsg = await iShop.editReply({ content: listText, components: [row] });

          const closeCollector = listMsg.createMessageComponentCollector({ time: 30000 });
          closeCollector.on('collect', async iClose => {
            if (iClose.user.id !== author.id) return;
            const aId = parseInt(iClose.values[0]);

            const freshA = database.get('SELECT * FROM auction_items WHERE id = ?', [aId]);
            if (!freshA || freshA.status !== 'ACTIVE') {
              return iClose.reply({ content: '❌ Lelang tersebut tidak aktif atau tidak ditemukan!', flags: 64 });
            }

            const confirmed = await askConfirmation(iClose, author.id, `TUTUP LELANG ID ${aId} SECARA INSTAN DAN DISTRIBUSIKAN ITEM`);
            if (!confirmed) {
              closeCollector.stop();
              return;
            }

            let endSuccess = false;
            try {
              database.run("UPDATE auction_items SET ends_at = strftime('%s','now') WHERE id = ?", [aId]);
              const auctionModule = require('./auction');
              await auctionModule.checkAndCloseExpiredAuctions(client);
              endSuccess = true;
            } catch (txErr) {
              console.error('Failed to close auction:', txErr);
              await iClose.followUp({ content: `❌ Gagal menutup lelang: ${txErr.message}`, flags: 64 });
            }

            if (endSuccess) {
              const targetChannelId = config.ANNOUNCEMENT_CHANNEL_ID || config.REPORT_CHANNEL_ID || messageOrInteraction.channelId;
              await iClose.followUp({ content: `✅ Lelang ID ${aId} ditutup sukses! Laporan hasil akhir dikirim ke <#${targetChannelId}>.`, flags: 64 });
            }

            closeCollector.stop();
            await listMsg.delete().catch(() => {});
          });
        }
      }
    } catch (err) {
      console.error('Error in Shop Panel Interaction:', err);
      await iShop.reply({ content: `❌ Terjadi kesalahan: ${err.message}`, flags: 64 }).catch(() => { });
    }
  });

  collector.on('end', async (collected, reason) => {
    if (reason === 'transition') return;
    try {
      const fresh = getShopPanelData(guildId);
      fresh.components = [];
      await replyMsg.edit(fresh).catch(() => { });
    } catch (e) { }
  });

  return true;
}

/**
 * 😜 6. PANEL TROLL & PRANK WARGA SERVER
 */
async function handleAdminTrollPanel(messageOrInteraction, client, initialTargetUserId = null) {
  const isInteraction = !messageOrInteraction.author;
  const author = isInteraction ? messageOrInteraction.user : messageOrInteraction.author;
  const guildId = messageOrInteraction.guildId;
  const guild = messageOrInteraction.guild;

  if (!guildId) return false;

  let selectedTargetUserId = initialTargetUserId;

  const getTrollPanelData = (gId, targetUserId) => {
    let embed = new EmbedBuilder()
      .setColor(0x8A95A5) // Platinum Slate Gray
      .setTitle('😜 ADMIN CONTROL PANEL — TROLL & PRANK WARGA')
      .setThumbnail(client.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({ text: 'Sentinel Admin • Pusat Kejailan & Hiburan' });

    let targetText = '*Belum ada anggota terpilih (Silakan pilih di menu dropdown di bawah)*';
    if (targetUserId) {
      const wallet = economy.getWallet(targetUserId, gId);
      const activePet = database.get('SELECT pet_name, pet_type, curse_type, curse_until FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [targetUserId, gId]);

      const now = Math.floor(Date.now() / 1000);
      const isFakeJailed = wallet.jail_type === 'troll' && wallet.jail_until > now;
      const isFakeCrashed = wallet.curse_type === 'fake_crash' && wallet.curse_until > now;
      const isPetCursed = activePet && activePet.curse_type === 'smelly' && activePet.curse_until > now;

      targetText = `🎯 **<@${targetUserId}>**\n` +
        `• ID: \`${targetUserId}\`\n` +
        `• Status Sel VIP: ${isFakeJailed ? `🚨 **AKTIF** (<t:${wallet.jail_until}:R>)` : '🟢 Bebas'}\n` +
        `• Status Fake Crash: ${isFakeCrashed ? `🚨 **AKTIF**` : '🟢 Normal'}\n` +
        `• Active Pet: ${activePet ? `**${activePet.pet_name}** (${activePet.pet_type})` : '*Tidak ada pet aktif*'}\n` +
        `• Status Kutukan Pet: ${isPetCursed ? `🦨 **BAU BUSUK** (<t:${activePet.curse_until}:R>)` : '🟢 Wangi/Bersih'}\n`;
    }

    embed.setDescription(
      `Gunakan menu di bawah untuk mengerjai atau mengerjai anggota secara aman! Semua kejailan ini bersifat **visual/sementara** dan tidak akan menghapus koin/saham nyata milik korban:\n\n` +
      `👤 **INFORMASI TARGET KORBAN:**\n${targetText}`
    );

    const userSelect = new UserSelectMenuBuilder()
      .setCustomId('admin_troll_select_target')
      .setPlaceholder('👤 Pilih Warga (Target Korban)');

    const userRow = new ActionRowBuilder().addComponents(userSelect);

    const actionSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_troll_select_action')
      .setPlaceholder('🎯 Pilih Jenis Kejailan / Prank')
      .setDisabled(!targetUserId);

    actionSelect.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('🦨 Kutukan Peliharaan Bau (5 Menit)')
        .setDescription('Membuat pet target bau busuk sehingga menolak bermain/bekerja')
        .setValue('troll_smelly_pet'),
      new StringSelectMenuOptionBuilder()
        .setLabel('📉 Ilusi Bursa Saham Hancur (Fake Crash)')
        .setDescription('Ketika mengecek porto, aset saham target diklaim Rp 0 / disita')
        .setValue('troll_fake_crash'),
      new StringSelectMenuOptionBuilder()
        .setLabel('⛓️ Sel VIP Kertas (Fake Jail 5 Menit)')
        .setDescription('Memenjarakan paksa target di dalam Sel VIP Kertas yang reot')
        .setValue('troll_fake_jail'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🚨 Alarm Palsu Perampokan (7s Cooldown)')
        .setDescription('Kirim notifikasi panik dompet dirampok dengan 7 detik penyelematan')
        .setValue('troll_fake_rob'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🤡 Ubah Nama Pet Paksa (Modal)')
        .setDescription('Mengubah nama peliharaan target menjadi nama kocak secara instan')
        .setValue('troll_rename_pet_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🧹 Bersihkan Semua Prank Target')
        .setDescription('Menghapus seluruh efek kutukan & membebaskan target seketika')
        .setValue('troll_clear_all')
    );

    const actionRow = new ActionRowBuilder().addComponents(actionSelect);

    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_troll_btn_back')
        .setLabel('🔙 Kembali ke Hub')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('admin_troll_btn_close')
        .setLabel('❌ Tutup Panel')
        .setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [userRow, actionRow, btnRow] };
  };

  const initialData = getTrollPanelData(guildId, selectedTargetUserId);
  let replyMsg;

  if (isInteraction) {
    await messageOrInteraction.update(initialData);
    replyMsg = messageOrInteraction.message;
  } else {
    replyMsg = await messageOrInteraction.reply(initialData);
  }

  const collector = replyMsg.createMessageComponentCollector({ time: 600000 });

  collector.on('collect', async iTroll => {
    const isOwner = iTroll.user.id === config.OWNER_ID;
    const isAdmin = iTroll.member && iTroll.member.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!isOwner && !isAdmin) {
      return iTroll.reply({ content: '❌ Akses Ditolak! Tombol/menu dashboard ini dikunci khusus untuk Owner utama & Administrator server.', flags: 64 });
    }

    try {
      if (iTroll.customId === 'admin_troll_select_target') {
        selectedTargetUserId = iTroll.values[0];
        const fresh = getTrollPanelData(guildId, selectedTargetUserId);
        await iTroll.update(fresh);
      }
      else if (iTroll.customId === 'admin_troll_btn_back') {
        collector.stop('transition');
        await handleAdminPanel(iTroll, client);
      }
      else if (iTroll.customId === 'admin_troll_btn_close') {
        collector.stop();
        await replyMsg.delete().catch(() => { });
      }
      else if (iTroll.customId === 'admin_troll_select_action') {
        const action = iTroll.values[0];
        if (!selectedTargetUserId) {
          return iTroll.reply({ content: '❌ Silakan pilih target korban terlebih dahulu!', flags: 64 });
        }

        const now = Math.floor(Date.now() / 1000);

        if (action === 'troll_smelly_pet') {
          const activePet = database.get('SELECT pet_name FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          if (!activePet) {
            return iTroll.reply({ content: '❌ Target tidak memiliki hewan peliharaan aktif yang bisa dikutuk!', flags: 64 });
          }

          const curseUntil = now + 300; // 5 Menit
          database.run("UPDATE user_pets SET curse_type = 'smelly', curse_until = ? WHERE user_id = ? AND guild_id = ? AND is_active = 1", [curseUntil, selectedTargetUserId, guildId]);

          await iTroll.reply({ content: `🦨 Sukses memberikan **Kutukan Pet Bau** ke pet milik <@${selectedTargetUserId}> selama 5 menit!`, flags: 64 });
          const fresh = getTrollPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => { });
        }
        else if (action === 'troll_fake_crash') {
          const curseUntil = now + 1200; // 20 Menit
          database.run("UPDATE wallets SET curse_type = 'fake_crash', curse_until = ? WHERE user_id = ? AND guild_id = ?", [curseUntil, selectedTargetUserId, guildId]);

          await iTroll.reply({ content: `📉 Sukses memasang jebakan **Fake Portfolio Crash** pada <@${selectedTargetUserId}>! Saat membuka \`.portfolio\`, asetnya akan terlihat dilikuidasi total!`, flags: 64 });
          const fresh = getTrollPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => { });
        }
        else if (action === 'troll_fake_jail') {
          const jailUntil = now + 300; // 5 Menit
          database.run("UPDATE wallets SET jail_until = ?, jail_type = 'troll' WHERE user_id = ? AND guild_id = ?", [jailUntil, selectedTargetUserId, guildId]);

          await iTroll.reply({ content: `⛓️ Sukses memenjarakan <@${selectedTargetUserId}> di dalam **Sel VIP Kertas** selama 5 menit!`, flags: 64 });
          const fresh = getTrollPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => { });
        }
        else if (action === 'troll_fake_rob') {
          const channel = iTroll.channel;
          await iTroll.reply({ content: `🚨 Memulai operasi **Alarm Palsu Perampokan** untuk <@${selectedTargetUserId}> di saluran ini!`, flags: 64 });

          const alertMsg = await channel.send(
            `🚨 🛑 **ALARM DARURAT PERAMPOKAN!!** 🛑 🚨\n` +
            `👉 <@${selectedTargetUserId}>, **DOMPET ANDA SEDANG DIRAMPOK OLEH MALING BURONAN SERVER!**\n` +
            `⚡ Cepat ketik **\`.aman\`** di saluran ini dalam waktu **7 detik** untuk menepis perampok!`
          );

          const msgCollector = channel.createMessageCollector({
            filter: (m) => m.author.id === selectedTargetUserId && m.content.trim().toLowerCase() === '.aman',
            time: 7000,
            max: 1
          });

          let responded = false;

          msgCollector.on('collect', async () => {
            responded = true;
            await channel.send(`🎈 **HAHAHA!** Tarik napas yang dalam <@${selectedTargetUserId}>... tidak ada perampokan kok. Anda sukses dikerjain oleh Admin! 🤣✨`);
          });

          msgCollector.on('end', async () => {
            if (!responded) {
              await channel.send(`💨 **WAKTU HABIS!** Maling palsunya keburu kabur... tapi koin <@${selectedTargetUserId}> tetap aman kok! Cuman dikerjain Admin! 😜🎈`);
            }
            alertMsg.delete().catch(() => { });
          });
        }
        else if (action === 'troll_rename_pet_modal') {
          const activePet = database.get('SELECT pet_name FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          if (!activePet) {
            return iTroll.reply({ content: '❌ Target tidak memiliki hewan peliharaan aktif untuk diganti namanya!', flags: 64 });
          }

          const modal = new ModalBuilder()
            .setCustomId('admin_troll_rename_modal')
            .setTitle('Ubah Nama Pet Kocak');

          const nameInput = new TextInputBuilder()
            .setCustomId('funny_name')
            .setLabel('Nama Kocak Pet Baru')
            .setPlaceholder('Contoh: Beban Keluarga')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
          await iTroll.showModal(modal);

          const sub = await iTroll.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_troll_rename_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const funnyName = sub.fields.getTextInputValue('funny_name').trim();
            if (funnyName.length === 0 || funnyName.length > 25) {
              return sub.reply({ content: '❌ Nama pet tidak boleh kosong atau lebih dari 25 karakter!', flags: 64 });
            }

            database.run("UPDATE user_pets SET pet_name = ? WHERE user_id = ? AND guild_id = ? AND is_active = 1", [funnyName, selectedTargetUserId, guildId]);
            await sub.reply({ content: `🤡 Sukses merubah nama pet aktif milik <@${selectedTargetUserId}> menjadi **"${funnyName}"** secara paksa!`, flags: 64 });
            const fresh = getTrollPanelData(guildId, selectedTargetUserId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'troll_clear_all') {
          database.run("UPDATE wallets SET jail_until = 0, jail_type = '', curse_type = '', curse_until = 0 WHERE user_id = ? AND guild_id = ?", [selectedTargetUserId, guildId]);
          database.run("UPDATE user_pets SET curse_type = '', curse_until = 0 WHERE user_id = ? AND guild_id = ? AND is_active = 1", [selectedTargetUserId, guildId]);

          await iTroll.reply({ content: `🧹 Sukses membersihkan seluruh efek kutukan & membebaskan <@${selectedTargetUserId}> dari kejailan!`, flags: 64 });
          const fresh = getTrollPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => { });
        }
      }
    } catch (err) {
      console.error('Error in Troll Panel Interaction:', err);
      await iTroll.reply({ content: `❌ Terjadi kesalahan: ${err.message}`, flags: 64 }).catch(() => { });
    }
  });

  collector.on('end', async (collected, reason) => {
    if (reason === 'transition') return;
    try {
      const fresh = getTrollPanelData(guildId, selectedTargetUserId);
      fresh.components = [];
      await replyMsg.edit(fresh).catch(() => { });
    } catch (e) { }
  });

  return true;
}

/**
 * 📊 8. SUB-PANEL FINANCIAL AUDIT & LEDGER (ARUS KAS)
 */
async function handleAdminLedgerPanel(messageOrInteraction, client) {
  const isInteraction = !messageOrInteraction.author;
  const author = isInteraction ? messageOrInteraction.user : messageOrInteraction.author;
  const guildId = messageOrInteraction.guildId;
  const guild = messageOrInteraction.guild;

  if (!guildId) return false;

  let selectedTargetUserId = null;
  let selectedTypeFilter = 'ALL';
  let currentPage = 1;

  const getLedgerPanelData = (gId, targetUserId, typeFilter, page) => {
    // 1. Hitung total sirkulasi koin global
    const walletsSum = database.get('SELECT SUM(balance) as total FROM wallets WHERE guild_id = ?', [gId]);
    const savingsSum = database.get('SELECT SUM(balance) as total FROM bank_savings WHERE guild_id = ?', [gId]);
    const totalWallets = walletsSum ? (walletsSum.total || 0) : 0;
    const totalSavings = savingsSum ? (savingsSum.total || 0) : 0;
    const totalCirculation = totalWallets + totalSavings;

    // 2. Hitung sirkulasi harian (24 jam terakhir)
    const nowUnix = Math.floor(Date.now() / 1000);
    const dayAgoUnix = nowUnix - 86400;

    const inflowSum = database.get(
      'SELECT SUM(amount) as total FROM transactions WHERE guild_id = ? AND amount > 0 AND created_at > ?',
      [gId, dayAgoUnix]
    );
    const outflowSum = database.get(
      'SELECT SUM(amount) as total FROM transactions WHERE guild_id = ? AND amount < 0 AND created_at > ?',
      [gId, dayAgoUnix]
    );
    const totalInflow = inflowSum ? (inflowSum.total || 0) : 0;
    const totalOutflow = Math.abs(outflowSum ? (outflowSum.total || 0) : 0);
    const netGrowth = totalInflow - totalOutflow;

    // 3. Bangun query filter untuk log detail
    let filterSql = ' WHERE guild_id = ?';
    let params = [gId];

    if (targetUserId) {
      filterSql += ' AND user_id = ?';
      params.push(targetUserId);
    }

    if (typeFilter && typeFilter !== 'ALL') {
      if (typeFilter === 'ADMIN_ACTIONS') {
        filterSql += " AND type LIKE 'ADMIN_%'";
      } else if (typeFilter === 'CASINO_JUDI') {
        filterSql += " AND type IN ('CASINO_BET', 'CASINO_LOST', 'CASINO_WON', 'SLOT_BET', 'SLOT_WON', 'LOTTERY_BUY', 'LOTTERY_WON')";
      } else if (typeFilter === 'ROB_HEIST') {
        filterSql += " AND type IN ('ROB_SUCCESS', 'ROB_LOST', 'HEIST_REWARD', 'HEIST_VICTIM_LOSS')";
      } else if (typeFilter === 'CLAIMS_REWARDS') {
        filterSql += " AND type IN ('DAILY_CLAIM', 'WEEKLY_CLAIM', 'VC_ACTIVE_REWARD', 'CHAT_EARN', 'WORK_EARN')";
      } else if (typeFilter === 'PET_PVE') {
        filterSql += " AND type LIKE 'PET_%'";
      } else if (typeFilter === 'MARKET_SAHAM') {
        filterSql += " AND type LIKE 'STOCK_%'";
      } else if (typeFilter === 'BANK_TRANSACTIONS') {
        filterSql += " AND type IN ('BANK_DEPOSIT', 'BANK_WITHDRAW', 'BANK_TRANSFER_IN', 'BANK_TRANSFER_OUT', 'LOAN_TAKE', 'LOAN_REPAY', 'LOAN_AUTO_DEBIT', 'ADMIN_BANK_GIVE', 'ADMIN_BANK_TAKE')";
      }
    }

    // 4. Hitung total halaman log
    const countRow = database.get(`SELECT COUNT(*) as count FROM transactions ${filterSql}`, params);
    const totalCount = countRow ? countRow.count : 0;
    const maxPage = Math.max(1, Math.ceil(totalCount / 15));
    const currentPageIndex = Math.min(page, maxPage);

    // 5. Ambil data transaksi paginated
    const limit = 15;
    const offset = (currentPageIndex - 1) * limit;

    let queryParams = [...params, limit, offset];
    const txs = database.all(
      `SELECT * FROM transactions ${filterSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      queryParams
    );

    // Build description embed
    let logText = '';
    if (txs.length === 0) {
      logText = '*Tidak ada data transaksi yang ditemukan sesuai filter.*';
    } else {
      txs.forEach((tx, idx) => {
        const sign = tx.amount > 0 ? '+' : '';
        const dateStr = `<t:${tx.created_at}:R>`;

        let txDetails = `<@${tx.user_id}>`;
        if (tx.channel_id && /^\d{17,20}$/.test(tx.channel_id)) {
          if (tx.type === 'TRANSFER_OUT' || tx.type === 'BANK_TRANSFER_OUT') {
            txDetails = `<@${tx.user_id}> ➡️ <@${tx.channel_id}>`;
          } else if (tx.type === 'TRANSFER_IN' || tx.type === 'BANK_TRANSFER_IN') {
            txDetails = `<@${tx.channel_id}> ➡️ <@${tx.user_id}>`;
          }
        }

        logText += `${idx + 1 + offset}. ${dateStr} | ${txDetails} | \`${tx.type}\` | **${sign}Rp ${tx.amount.toLocaleString('id-ID')}**\n`;
      });
    }

    let filterDesc = '';
    if (targetUserId) filterDesc += `• Target: <@${targetUserId}>\n`;
    if (typeFilter !== 'ALL') filterDesc += `• Filter Kategori: \`${typeFilter}\`\n`;

    let userAuditText = '';
    if (targetUserId) {
      const userWalletRow = database.get('SELECT balance FROM wallets WHERE user_id = ? AND guild_id = ?', [targetUserId, gId]);
      const userSavingsRow = database.get('SELECT balance FROM bank_savings WHERE user_id = ? AND guild_id = ?', [targetUserId, gId]);
      const userWallet = userWalletRow ? userWalletRow.balance : 0;
      const userSavings = userSavingsRow ? userSavingsRow.balance : 0;

      const userInflowRow = database.get(
        'SELECT SUM(amount) as total FROM transactions WHERE guild_id = ? AND user_id = ? AND amount > 0 AND created_at > ?',
        [gId, targetUserId, dayAgoUnix]
      );
      const userOutflowRow = database.get(
        'SELECT SUM(amount) as total FROM transactions WHERE guild_id = ? AND user_id = ? AND amount < 0 AND created_at > ?',
        [gId, targetUserId, dayAgoUnix]
      );
      const userInflow = userInflowRow ? (userInflowRow.total || 0) : 0;
      const userOutflow = Math.abs(userOutflowRow ? (userOutflowRow.total || 0) : 0);
      const userNet = userInflow - userOutflow;
      const userNetSign = userNet >= 0 ? '+' : '';

      userAuditText = `👤 **HASIL AUDIT ANGGOTA (<@${targetUserId}>):**\n` +
        `• Saldo Dompet: \`Rp ${userWallet.toLocaleString('id-ID')}\`\n` +
        `• Tabungan Bank: \`Rp ${userSavings.toLocaleString('id-ID')}\`\n` +
        `• Total Kekayaan Cair: **Rp ${(userWallet + userSavings).toLocaleString('id-ID')}**\n` +
        `• 📥 Pendapatan (24j terakhir): \`+Rp ${userInflow.toLocaleString('id-ID')}\`\n` +
        `• 📤 Pengeluaran (24j terakhir): \`-Rp ${userOutflow.toLocaleString('id-ID')}\`\n` +
        `• ⚖️ Aliran Bersih (Net Change): **${userNetSign}Rp ${userNet.toLocaleString('id-ID')}**\n\n`;
    }

    let embed = new EmbedBuilder()
      .setColor(0x10B981) // Emerald Green
      .setTitle('📊 AUDIT LEDGER & ALIRAN DANA SERVER')
      .setThumbnail(client.user.displayAvatarURL())
      .setDescription(
        `Selamat datang di **Dashboard Audit Finansial Sentinel**! 🛡️💼\n` +
        `Gunakan panel ini untuk melacak perputaran koin, inflasi harian, dan mutasi dana warga:\n\n` +
        userAuditText +
        `💰 **ESTIMASI SIRKULASI UANG GLOBAL:**\n` +
        `• Total Saldo Dompet Warga: \`Rp ${totalWallets.toLocaleString('id-ID')}\`\n` +
        `• Total Tabungan Bank Warga: \`Rp ${totalSavings.toLocaleString('id-ID')}\`\n` +
        `• **Total Sirkulasi Koin (M2)**: 🪙 **Rp ${totalCirculation.toLocaleString('id-ID')}**\n\n` +
        `📈 **ARUS KAS HARIAN (24 JAM TERAKHIR):**\n` +
        `• 📥 Total Uang Masuk (Inflow): \`+Rp ${totalInflow.toLocaleString('id-ID')}\`\n` +
        `• 📤 Total Uang Keluar (Outflow): \`-Rp ${totalOutflow.toLocaleString('id-ID')}\`\n` +
        `• ⚖️ **Pertumbuhan Bersih (Net Growth)**: **Rp ${netGrowth.toLocaleString('id-ID')}**\n\n` +
        (filterDesc ? `🔍 **FILTER AKTIF:**\n${filterDesc}\n` : '') +
        `📑 **LOG MUTASI TRANSAKSI TERBARU (Hlm. ${currentPageIndex}/${maxPage}):**\n${logText}`
      )
      .setTimestamp()
      .setFooter({ text: `Sentinel Audit • Total ${totalCount} Transaksi` });

    // Dropdown User Select
    const userSelect = new UserSelectMenuBuilder()
      .setCustomId('admin_ledger_select_target')
      .setPlaceholder('👤 Filter Berdasarkan Anggota');

    const userRow = new ActionRowBuilder().addComponents(userSelect);

    // Dropdown Category Select
    const categorySelect = new StringSelectMenuBuilder()
      .setCustomId('admin_ledger_select_type')
      .setPlaceholder('🎯 Filter Berdasarkan Kategori');

    categorySelect.addOptions(
      new StringSelectMenuOptionBuilder().setLabel('🔍 Semua Kategori').setValue('ALL').setDefault(typeFilter === 'ALL'),
      new StringSelectMenuOptionBuilder().setLabel('🏦 Transaksi Perbankan (Dep/Wd/Pinjam)').setValue('BANK_TRANSACTIONS').setDefault(typeFilter === 'BANK_TRANSACTIONS'),
      new StringSelectMenuOptionBuilder().setLabel('🛠️ Tindakan Admin (Suntik/Tarik)').setValue('ADMIN_ACTIONS').setDefault(typeFilter === 'ADMIN_ACTIONS'),
      new StringSelectMenuOptionBuilder().setLabel('🎲 Judi & Kasino').setValue('CASINO_JUDI').setDefault(typeFilter === 'CASINO_JUDI'),
      new StringSelectMenuOptionBuilder().setLabel('🚓 Kriminalitas (Rob/Heist)').setValue('ROB_HEIST').setDefault(typeFilter === 'ROB_HEIST'),
      new StringSelectMenuOptionBuilder().setLabel('🎁 Klaim & Hadiah Harian').setValue('CLAIMS_REWARDS').setDefault(typeFilter === 'CLAIMS_REWARDS'),
      new StringSelectMenuOptionBuilder().setLabel('🐾 Ekspedisi & Perawatan Pet').setValue('PET_PVE').setDefault(typeFilter === 'PET_PVE'),
      new StringSelectMenuOptionBuilder().setLabel('📈 Bursa Saham & Trading').setValue('MARKET_SAHAM').setDefault(typeFilter === 'MARKET_SAHAM')
    );

    const categoryRow = new ActionRowBuilder().addComponents(categorySelect);

    // Buttons
    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_ledger_btn_prev')
        .setLabel('◀️ Prev')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPageIndex <= 1),
      new ButtonBuilder()
        .setCustomId('admin_ledger_btn_refresh')
        .setLabel('🔄 Refresh')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('admin_ledger_btn_next')
        .setLabel('Next ▶️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPageIndex >= maxPage)
    );

    const navRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_ledger_btn_back')
        .setLabel('🔙 Kembali ke Hub')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('admin_ledger_btn_close')
        .setLabel('❌ Tutup Audit')
        .setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [userRow, categoryRow, btnRow, navRow] };
  };

  const initialData = getLedgerPanelData(guildId, selectedTargetUserId, selectedTypeFilter, currentPage);
  let replyMsg;

  if (isInteraction) {
    await messageOrInteraction.update(initialData);
    replyMsg = messageOrInteraction.message;
  } else {
    replyMsg = await messageOrInteraction.reply(initialData);
  }

  const collector = replyMsg.createMessageComponentCollector({ time: 600000 });

  collector.on('collect', async iLedger => {
    const isOwner = iLedger.user.id === config.OWNER_ID;
    const isAdmin = iLedger.member && iLedger.member.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!isOwner && !isAdmin) {
      return iLedger.reply({ content: '❌ Akses Ditolak! Tombol/menu dashboard ini dikunci khusus untuk Owner utama & Administrator server.', flags: 64 });
    }

    try {
      if (iLedger.customId === 'admin_ledger_select_target') {
        selectedTargetUserId = iLedger.values[0];
        currentPage = 1; // Reset to page 1 on filter change
        const fresh = getLedgerPanelData(guildId, selectedTargetUserId, selectedTypeFilter, currentPage);
        await iLedger.update(fresh);
      }
      else if (iLedger.customId === 'admin_ledger_select_type') {
        selectedTypeFilter = iLedger.values[0];
        currentPage = 1; // Reset to page 1 on filter change
        const fresh = getLedgerPanelData(guildId, selectedTargetUserId, selectedTypeFilter, currentPage);
        await iLedger.update(fresh);
      }
      else if (iLedger.customId === 'admin_ledger_btn_prev') {
        if (currentPage > 1) currentPage--;
        const fresh = getLedgerPanelData(guildId, selectedTargetUserId, selectedTypeFilter, currentPage);
        await iLedger.update(fresh);
      }
      else if (iLedger.customId === 'admin_ledger_btn_next') {
        currentPage++;
        const fresh = getLedgerPanelData(guildId, selectedTargetUserId, selectedTypeFilter, currentPage);
        await iLedger.update(fresh);
      }
      else if (iLedger.customId === 'admin_ledger_btn_refresh') {
        const fresh = getLedgerPanelData(guildId, selectedTargetUserId, selectedTypeFilter, currentPage);
        await iLedger.update(fresh);
      }
      else if (iLedger.customId === 'admin_ledger_btn_back') {
        collector.stop('transition');
        await handleAdminPanel(iLedger, client);
      }
      else if (iLedger.customId === 'admin_ledger_btn_close') {
        collector.stop();
        await replyMsg.delete().catch(() => { });
      }
    } catch (err) {
      console.error('Error in Ledger Panel Interaction:', err);
      await iLedger.reply({ content: `❌ Terjadi kesalahan: ${err.message}`, flags: 64 }).catch(() => { });
    }
  });

  collector.on('end', async (collected, reason) => {
    if (reason === 'transition') return;
    try {
      const fresh = getLedgerPanelData(guildId, selectedTargetUserId, selectedTypeFilter, currentPage);
      fresh.components = [];
      await replyMsg.edit(fresh).catch(() => { });
    } catch (e) { }
  });

  return true;
}

/**
 * 🎮 7. MAIN HUB PORTAL (ADMIN DASHBOARD CONTROL HUB)
 */
async function handleAdminPanel(messageOrInteraction, client) {
  const isInteraction = !messageOrInteraction.author && !!messageOrInteraction.user;
  const isChannel = typeof messageOrInteraction.send === 'function';
  const guildId = messageOrInteraction.guildId || (isChannel ? messageOrInteraction.guild?.id : null);

  if (!guildId) return false;

  const settings = database.get('SELECT admin_panel_channel_id FROM ebyus_settings WHERE guild_id = ?', [guildId]);
  const isPermanentChannel = settings && settings.admin_panel_channel_id === (messageOrInteraction.channelId || messageOrInteraction.id);

  const getHubPanelData = async () => {
    // Live Stats calculation
    let walletsCount = 0;
    let activePetsCount = 0;
    let totalCoins = 0;
    let multiplier = 1;
    let gachaMode = 'NORMAL';
    let isActiveEvent = false;

    try {
      const walletsCountRow = database.get('SELECT COUNT(*) as count FROM wallets WHERE guild_id = ?', [guildId]);
      walletsCount = walletsCountRow ? walletsCountRow.count : 0;

      const activePetsRow = database.get('SELECT COUNT(*) as count FROM user_pets WHERE guild_id = ? AND is_active = 1', [guildId]);
      activePetsCount = activePetsRow ? activePetsRow.count : 0;

      const totalCoinsRow = database.get('SELECT SUM(balance) as total FROM wallets WHERE guild_id = ?', [guildId]);
      const totalSavingsRow = database.get('SELECT SUM(balance) as total FROM bank_savings WHERE guild_id = ?', [guildId]);
      totalCoins = (totalCoinsRow ? (totalCoinsRow.total || 0) : 0) + (totalSavingsRow ? (totalSavingsRow.total || 0) : 0);

      const settingsRow = getOrCreateEbyusSettings(guildId);
      multiplier = settingsRow.coin_multiplier || 1;
      gachaMode = settingsRow.gacha_mode || 'NORMAL';
      isActiveEvent = settingsRow.is_active === 1;
    } catch (e) {
      console.error('Error calculating hub stats:', e);
    }

    const attachment = await petCard.getAdminDashboardAttachment(client, {
      walletsCount,
      activePetsCount,
      totalCoins,
      multiplier,
      gachaMode,
      isActiveEvent
    });

    const eventStatusText = isActiveEvent ? '🔴 **Abuse Event Aktif**' : '🟢 Normal';

    let embed = new EmbedBuilder()
      .setColor(0x7C4DFF) // Royal Violet
      .setTitle('🛡️ PUSAT KONTROL TERPADU ADMINISTRATOR')
      .setDescription(
        `Selamat datang di **Pusat Kontrol Terpadu Sentinel Bot 2026**. Gunakan menu dropdown di bawah untuk mengakses sub-panel kontrol. Setiap sub-panel menyediakan tombol kontrol visual yang terfokus untuk membantu Anda mengelola server secara praktis.\n\n` +
        `📊 **Warga Terdaftar:** \`${walletsCount} jiwa\`\n` +
        `🐾 **Pet Aktif:** \`${activePetsCount} peliharaan\`\n` +
        `💰 **Koin Beredar:** \`Rp ${(totalCoins || 0).toLocaleString('id-ID')}\`\n\n` +
        `🪙 **Chat Multiplier:** \`${multiplier}x\`\n` +
        `🎰 **Gacha Mode:** \`${gachaMode}\`\n` +
        `📢 **Status Event:** ${eventStatusText}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📁 **KATEGORI MENU:**\n` +
        `🦁 **Pet & Turnamen:** Pet Tamagotchi, Turnamen Pet, Quest & Misi\n` +
        `🏦 **Ekonomi & Bursa:** Bank & Finansial, Bursa Saham, Shop & VC, Ledger\n` +
        `🌱 **Gameplay & Aktivitas:** Robbery & Lapas, Cozy Garden, Troll & Prank\n` +
        `⚙️ **Sistem & Manajemen:** Pemeliharaan & Sistem, Abyus & Event, Warga, Gift & Event Rewards`
      )
      .setImage('attachment://admin_dashboard.png')
      .setTimestamp()
      .setFooter({ text: 'Sentinel Bot • Dashboard Utama Portal' });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('admin_hub_select_panel')
      .setPlaceholder('⚙️ Pilih Sub-Panel Kontrol...');

    selectMenu.addOptions(
      // --- PET & TURNAMEN ---
      new StringSelectMenuOptionBuilder()
        .setLabel('─── 🦁 PET & TURNAMEN ───')
        .setDescription('Sub-menu pengelolaan peliharaan, turnamen, dan quest')
        .setValue('_separator_pet'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🐾 Pet Tamagotchi')
        .setDescription('Sembuhkan HP, tetas telur, atur level, atau reset pet')
        .setValue('panel_pet')
        .setEmoji('🐾'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🏆 Turnamen Pet')
        .setDescription('Mulai turnamen Admin Cup, batalkan turnamen aktif, atau atur jalannya laga')
        .setValue('panel_tournament')
        .setEmoji('🏆'),
      new StringSelectMenuOptionBuilder()
        .setLabel('📋 Quest & Misi Pet')
        .setDescription('Selesaikan quests, reset quests, kirim lootbox')
        .setValue('panel_quests')
        .setEmoji('📋'),

      // --- EKONOMI & BURSA ---
      new StringSelectMenuOptionBuilder()
        .setLabel('─── 🏦 EKONOMI & BURSA ───')
        .setDescription('Sub-menu pengelolaan uang, saham, toko, dan ledger audit')
        .setValue('_separator_economy'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🏦 Bank & Finansial')
        .setDescription('Suntik/potong koin, reset ekonomi, hapus pinjaman, bansos')
        .setValue('panel_bank')
        .setEmoji('🏦'),
      new StringSelectMenuOptionBuilder()
        .setLabel('📈 Bursa Saham')
        .setDescription('Tambah/hapus saham, drop harga, bull/crash event, dividen')
        .setValue('panel_saham')
        .setEmoji('📈'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🎭 Shop & VC ToD')
        .setDescription('Manajemen penjualan role server, set stok role, control ToD VC')
        .setValue('panel_shop')
        .setEmoji('🎭'),
      new StringSelectMenuOptionBuilder()
        .setLabel('📊 Audit Ledger')
        .setDescription('Log keluar masuk koin global/target, statistik sirkulasi total')
        .setValue('panel_ledger')
        .setEmoji('📊'),

      // --- GAMEPLAY & AKTIVITAS ---
      new StringSelectMenuOptionBuilder()
        .setLabel('─── 🌱 GAMEPLAY & AKTIVITAS ───')
        .setDescription('Sub-menu pengelolaan kriminalitas, kebun, dan keusilan')
        .setValue('_separator_gameplay'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🚓 Robbery & Lapas')
        .setDescription('Bebaskan tahanan Lapas, reset global cooldown bank robbery')
        .setValue('panel_rob')
        .setEmoji('🚓'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🌱 Cozy Garden')
        .setDescription('Siram instan, percepat mekar bunga, reset garden, gift benih')
        .setValue('panel_garden')
        .setEmoji('🌱'),
      new StringSelectMenuOptionBuilder()
        .setLabel('😜 Troll & Prank')
        .setDescription('Kutuk pet bau, alarm copet palsu, ilusi bursa hancur, sel VIP reot')
        .setValue('panel_troll')
        .setEmoji('😜'),

      // --- SISTEM & MANAJEMEN ---
      new StringSelectMenuOptionBuilder()
        .setLabel('─── ⚙️ SISTEM & MANAJEMEN ───')
        .setDescription('Sub-menu pengaturan bot, warga, dan event hadiah')
        .setValue('_separator_system'),
      new StringSelectMenuOptionBuilder()
        .setLabel('⚙️ Pemeliharaan & Sistem')
        .setDescription('Toggle maintenance, db health, backup/restore db, broadcast kustom')
        .setValue('panel_system')
        .setEmoji('⚙️'),
      new StringSelectMenuOptionBuilder()
        .setLabel('⚡ Abyus & Event')
        .setDescription('Atur gacha mode, multiplier chat, broadcast event, stop event')
        .setValue('panel_abyus')
        .setEmoji('⚡'),
      new StringSelectMenuOptionBuilder()
        .setLabel('👥 Citizen (Warga)')
        .setDescription('Lihat status warga, atur status penjara, blacklist warga')
        .setValue('panel_warga')
        .setEmoji('👥'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🎁 Gift & Event Rewards')
        .setDescription('Bagi-bagi hadiah massal, event reward, set bonus')
        .setValue('panel_gift')
        .setEmoji('🎁')
    );

    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

    const btnComponents = [
      new ButtonBuilder()
        .setCustomId('hub_btn_refresh')
        .setLabel('🔄 Segarkan Hub')
        .setStyle(ButtonStyle.Secondary)
    ];
    if (!isPermanentChannel) {
      btnComponents.push(
        new ButtonBuilder()
          .setCustomId('hub_btn_close')
          .setLabel('❌ Tutup Hub')
          .setStyle(ButtonStyle.Danger)
      );
    }
    const btnRow = new ActionRowBuilder().addComponents(btnComponents);

    return { embeds: [embed], components: [selectRow, btnRow], files: attachment ? [attachment] : [], attachments: [] };
  };

  // ── Helper: Generate Owner-Exclusive Panel Data ──
  const getOwnerPanelData = (guildId) => {
    const godModeActive = isOwnerGodModeActive(guildId);
    const statusIcon = godModeActive ? '🟢' : '🔴';
    const statusText = godModeActive ? 'AKTIF' : 'NONAKTIF';

    const protectionActive = isOwnerProtectionActive(guildId);
    const protIcon = protectionActive ? '🛡️' : '🔓';
    const protText = protectionActive ? 'AKTIF (KEBAL ROB & HACK)' : 'NONAKTIF (BISA DIROB/HACK)';

    const ownerEmbed = new EmbedBuilder()
      .setColor(godModeActive ? 0x00E676 : 0x7C4DFF)
      .setTitle('👑 OWNER CONTROL CENTER — SENTINEL')
      .setDescription(
        `Selamat datang di **Panel Kontrol Rahasia Owner**.\n` +
        `Fitur ini hanya tersedia untuk Owner utama.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⚡ **GOD MODE (100% KEMENANGAN)**\n` +
        `Status: ${statusIcon} **${statusText}**\n\n` +
        `Jika diaktifkan, Owner mendapatkan:\n` +
        `• 🎰 Gacha — Zonk Rate **0%** (selalu menang)\n` +
        `• 🔪 Robbery — Sukses rate **100%**\n` +
        `• 🏦 Heist — Selalu berhasil jika Owner ikut\n` +
        `• ⚔️ Ekspedisi Pet — Sukses rate **+50%** bonus\n` +
        `• 🐾 Pet — Kebal kematian & efek negatif\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🛡️ **OWNER PROTECTION (KEBAL TOTAL)**\n` +
        `Status: ${protIcon} **${protText}**\n\n` +
        `Jika diaktifkan, Akun Owner:\n` +
        `• Kebal dari perampokan individu (\`.rob\` / \`.steal\`)\n` +
        `• Kebal dari pembobolan/draining tabungan bank saat Heist (\`.heist\`)\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━`
      )
      .setFooter({ text: 'Owner Control Center • Sentinel 2026' })
      .setTimestamp();

    const toggleRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ow_godmode_on')
        .setLabel('⚡ Aktifkan God Mode')
        .setStyle(ButtonStyle.Success)
        .setDisabled(godModeActive),
      new ButtonBuilder()
        .setCustomId('ow_godmode_off')
        .setLabel('🔒 Nonaktifkan God Mode')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!godModeActive),
      new ButtonBuilder()
        .setCustomId('ow_godmode_normal')
        .setLabel('🔄 Mode Normal')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!godModeActive)
    );

    const protectionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ow_protection_on')
        .setLabel('🛡️ Aktifkan Proteksi')
        .setStyle(ButtonStyle.Success)
        .setDisabled(protectionActive),
      new ButtonBuilder()
        .setCustomId('ow_protection_off')
        .setLabel('🔓 Nonaktifkan Proteksi')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!protectionActive)
    );

    const navRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ow_open_hub')
        .setLabel('🛡️ Buka Admin Hub')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('ow_refresh')
        .setLabel('🔄 Segarkan')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('ow_close')
        .setLabel('❌ Tutup')
        .setStyle(ButtonStyle.Danger)
    );

    return { embeds: [ownerEmbed], components: [toggleRow, protectionRow, navRow] };
  };

  // Jika dibuka via .ow (tombol privat owner), tampilkan Owner Panel khusus
  const isOwnerPrivate = isInteraction && messageOrInteraction.customId === 'eco_btn_open_admin_panel_private';

  const initialData = isOwnerPrivate ? null : await getHubPanelData();
  let replyMsg;

  if (isOwnerPrivate) {
    const ownerData = getOwnerPanelData(messageOrInteraction.guildId);
    await messageOrInteraction.reply({ ...ownerData, flags: 64 });
    replyMsg = await messageOrInteraction.fetchReply();

    // Buat collector khusus untuk Owner Panel
    const ownerCollector = replyMsg.createMessageComponentCollector({ time: 600000 });

    ownerCollector.on('collect', async iOw => {
      if (iOw.user.id !== config.OWNER_ID) {
        return iOw.reply({ content: '❌ Akses Ditolak! Panel ini hanya untuk Owner utama.', flags: 64 });
      }

      try {
        const guildId = iOw.guildId;

        if (iOw.customId === 'ow_godmode_on') {
          toggleOwnerGodMode(guildId, true);
          const fresh = getOwnerPanelData(guildId);
          await iOw.update(fresh);
        } else if (iOw.customId === 'ow_godmode_off' || iOw.customId === 'ow_godmode_normal') {
          toggleOwnerGodMode(guildId, false);
          const fresh = getOwnerPanelData(guildId);
          await iOw.update(fresh);
        } else if (iOw.customId === 'ow_protection_on') {
          toggleOwnerProtection(guildId, true);
          const fresh = getOwnerPanelData(guildId);
          await iOw.update(fresh);
        } else if (iOw.customId === 'ow_protection_off') {
          toggleOwnerProtection(guildId, false);
          const fresh = getOwnerPanelData(guildId);
          await iOw.update(fresh);
        } else if (iOw.customId === 'ow_open_hub') {
          // Transisi ke Hub Panel biasa
          ownerCollector.stop('transition_hub');
          const hubData = await getHubPanelData();
          await iOw.update(hubData);
          replyMsg = iOw.message;
          setupHubCollector();
        } else if (iOw.customId === 'ow_refresh') {
          const fresh = getOwnerPanelData(guildId);
          await iOw.update(fresh);
        } else if (iOw.customId === 'ow_close') {
          ownerCollector.stop();
          await replyMsg.delete().catch(() => { });
        }
      } catch (err) {
        console.error('Error in Owner Panel Interaction:', err);
        await iOw.reply({ content: `❌ Terjadi kesalahan: ${err.message}`, flags: 64 }).catch(() => { });
      }
    });

    ownerCollector.on('end', async (collected, reason) => {
      if (reason === 'transition_hub') return;
      try {
        const fresh = getOwnerPanelData(messageOrInteraction.guildId);
        fresh.components = [];
        await replyMsg.edit(fresh).catch(() => { });
      } catch (e) { }
    });

    return true;
  } else if (isInteraction) {
    await messageOrInteraction.update(initialData);
    replyMsg = messageOrInteraction.message;
  } else if (isChannel) {
    replyMsg = await messageOrInteraction.send(initialData);
  } else {
    replyMsg = await messageOrInteraction.reply(initialData);
  }

  // ── Fungsi untuk setup Hub Collector (dipanggil dari flow normal atau transisi dari Owner Panel) ──
  function setupHubCollector() {
    const collector = replyMsg.createMessageComponentCollector({ time: 600000 });

    collector.on('collect', async iHub => {
      const isOwner = iHub.user.id === config.OWNER_ID;
      const isAdmin = iHub.member && iHub.member.permissions.has(PermissionsBitField.Flags.Administrator);
      if (!isOwner && !isAdmin) {
        return iHub.reply({ content: '❌ Akses Ditolak! Tombol/menu ini dikunci khusus untuk Owner utama & Administrator server.', flags: 64 });
      }

      try {
        if (iHub.customId === 'admin_hub_select_panel') {
          const val = iHub.values[0];
          if (val.startsWith('_separator_')) {
            return iHub.reply({ content: '❌ Pilihan tersebut adalah judul kategori, silakan pilih sub-panel di bawahnya!', flags: 64 });
          }
          collector.stop('transition');

          if (val === 'panel_pet') await handleAdminPetPanel(iHub, client);
          else if (val === 'panel_tournament') await handleAdminTournamentPanel(iHub, client);
          else if (val === 'panel_bank') await handleAdminBankPanel(iHub, client);
          else if (val === 'panel_rob') await handleAdminRobberyPanel(iHub, client);
          else if (val === 'panel_saham') await handleAdminSahamPanel(iHub, client);
          else if (val === 'panel_abyus') await handleAdminAbyusPanel(iHub, client);
          else if (val === 'panel_system') await handleAdminSystemPanel(iHub, client);
          else if (val === 'panel_shop') await handleAdminShopPanel(iHub, client);
          else if (val === 'panel_garden') await handleAdminGardenPanel(iHub, client);
          else if (val === 'panel_quests') await handleAdminQuestPanel(iHub, client);
          else if (val === 'panel_troll') await handleAdminTrollPanel(iHub, client);
          else if (val === 'panel_warga') await handleAdminWargaPanel(iHub, client);
          else if (val === 'panel_gift') await handleAdminGiftPanel(iHub, client);
          else if (val === 'panel_ledger') await handleAdminLedgerPanel(iHub, client);
        }
        else if (iHub.customId === 'hub_btn_refresh') {
          await iHub.deferUpdate();
          const fresh = await getHubPanelData();
          await replyMsg.edit(fresh).catch(() => { });
        }
        else if (iHub.customId === 'hub_btn_close') {
          collector.stop();
          await replyMsg.delete().catch(() => { });
        }
      } catch (err) {
        console.error('Error in Hub Panel Interaction:', err);
        await iHub.reply({ content: `❌ Terjadi kesalahan: ${err.message}`, flags: 64 }).catch(() => { });
      }
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'transition') return;
      try {
        const fresh = await getHubPanelData();
        fresh.components = [];
        await replyMsg.edit(fresh).catch(() => { });
      } catch (e) { }
    });
  }

  // Setup hub collector untuk flow non-owner-private
  setupHubCollector();

  return true;
}

/**
 * 🌱 8. SUB-PANEL COZY FLOWER GARDEN
 */
async function handleAdminGardenPanel(messageOrInteraction, client, initialTargetUserId = null) {
  const isInteraction = !messageOrInteraction.author;
  const author = isInteraction ? messageOrInteraction.user : messageOrInteraction.author;
  const guildId = messageOrInteraction.guildId;

  if (!guildId) return false;

  let selectedTargetUserId = initialTargetUserId;

  const getGardenPanelData = (gId, targetUserId) => {
    let embed = new EmbedBuilder()
      .setColor(0x10B981) // Velvet Emerald Green
      .setTitle('🌱 ADMIN CONTROL PANEL — COZY FLOWER GARDEN')
      .setThumbnail(client.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({ text: 'Sentinel Admin • Pengelolaan Kebun & Tanaman' });

    let targetText = '*Belum ada anggota terpilih (Silakan pilih di menu dropdown di bawah)*';
    if (targetUserId) {
      targetText = `🎯 **<@${targetUserId}>**\n` +
        `• ID: \`${targetUserId}\`\n\n`;

      try {
        const garden = require('./garden');
        const slots = garden.getGardenSlots(targetUserId, gId);

        let slotsText = '';
        slots.forEach(s => {
          if (s.seed_id) {
            const progressEmoji = s.growthProgress >= 100 ? '🟢 Siap Panen' : '⏳ Tumbuh';
            slotsText += `🔹 **Slot ${s.slot_index}:** **${s.flowerName}** [${s.growthStatus}]\n` +
              `  • Progress: \`${s.growthProgress}%\` | Siram: \`${s.water_count}x\`\n` +
              `  • Status: ${progressEmoji} (Sisa: \`${s.secondsLeft}s\`)\n`;
          } else {
            slotsText += `🔹 **Slot ${s.slot_index}:** *Tanah Kosong*\n`;
          }
        });
        targetText += `🌱 **STATUS KEBUN AKTIF:**\n${slotsText}`;
      } catch (err) {
        targetText += `❌ Gagal memuat data kebun: ${err.message}`;
      }
    }

    embed.setDescription(
      `Gunakan menu di bawah untuk memilih target anggota, lalu tentukan tindakan cepat untuk mengelola Cozy Garden mereka:\n\n` +
      `👤 **INFORMASI TARGET ANGGOTA:**\n${targetText}`
    );

    const userSelect = new UserSelectMenuBuilder()
      .setCustomId('admin_garden_select_target')
      .setPlaceholder('👤 Pilih Target Anggota');

    const userRow = new ActionRowBuilder().addComponents(userSelect);

    const actionSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_garden_select_action')
      .setPlaceholder('🎯 Pilih Tindakan Pengelolaan Garden')
      .setDisabled(!targetUserId);

    actionSelect.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('💦 Siram Semua Tanaman & Reset Cooldown')
        .setDescription('Menambah jumlah siraman tanaman aktif dan mereset cooldown siram wallets target')
        .setValue('action_instant_water'),
      new StringSelectMenuOptionBuilder()
        .setLabel('⚡ Instan Tumbuhkan Bunga (100%)')
        .setDescription('Memaksa seluruh tanaman aktif target tumbuh mekar 100% siap panen')
        .setValue('action_instant_grow'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🪓 Bongkar & Bersihkan Kebun')
        .setDescription('Menghapus seluruh tanaman aktif dan mereset slot kebun menjadi kosong')
        .setValue('action_reset_garden'),
      new StringSelectMenuOptionBuilder()
        .setLabel('📦 Beri Paket Benih Lengkap (+5)')
        .setDescription('Mengirimkan masing-masing 5x benih Mawar, Tulip, Lavender, Sakura, Anggrek & Kado')
        .setValue('action_gift_seeds')
    );

    const actionRow = new ActionRowBuilder().addComponents(actionSelect);

    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_garden_btn_back')
        .setLabel('🔙 Kembali ke Hub')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('admin_garden_btn_close')
        .setLabel('❌ Tutup Panel')
        .setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [userRow, actionRow, btnRow] };
  };

  const initialData = getGardenPanelData(guildId, selectedTargetUserId);
  let replyMsg;

  if (isInteraction) {
    await messageOrInteraction.update(initialData);
    replyMsg = messageOrInteraction.message;
  } else {
    replyMsg = await messageOrInteraction.reply(initialData);
  }

  const collector = replyMsg.createMessageComponentCollector({ time: 600000 });

  collector.on('collect', async iGarden => {
    const isOwner = iGarden.user.id === config.OWNER_ID;
    const isAdmin = iGarden.member && iGarden.member.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!isOwner && !isAdmin) {
      return iGarden.reply({ content: '❌ Akses Ditolak! Tombol/menu dashboard ini dikunci khusus untuk Owner utama & Administrator server.', flags: 64 });
    }

    try {
      if (iGarden.customId === 'admin_garden_select_target') {
        selectedTargetUserId = iGarden.values[0];
        const fresh = getGardenPanelData(guildId, selectedTargetUserId);
        await iGarden.update(fresh);
      }
      else if (iGarden.customId === 'admin_garden_btn_back') {
        collector.stop('transition');
        await handleAdminPanel(iGarden, client);
      }
      else if (iGarden.customId === 'admin_garden_btn_close') {
        collector.stop();
        await replyMsg.delete().catch(() => { });
      }
      else if (iGarden.customId === 'admin_garden_select_action') {
        const action = iGarden.values[0];

        if (action === 'action_instant_water') {
          database.run(
            'UPDATE garden_slots SET water_count = water_count + 1, last_watered_at = ? WHERE user_id = ? AND guild_id = ? AND seed_id IS NOT NULL',
            [Math.floor(Date.now() / 1000), selectedTargetUserId, guildId]
          );
          database.run(
            'UPDATE wallets SET last_water_at = 0 WHERE user_id = ? AND guild_id = ?',
            [selectedTargetUserId, guildId]
          );
          try {
            const petMod = require('./pet');
            const activeSlots = database.all('SELECT slot_index FROM garden_slots WHERE user_id = ? AND guild_id = ? AND seed_id IS NOT NULL', [selectedTargetUserId, guildId]);
            if (activeSlots.length > 0) {
              petMod.incrementQuestProgress(selectedTargetUserId, guildId, 'WATER', activeSlots.length);
            }
          } catch (e) { }

          await iGarden.reply({ content: `✅ Sukses menyiram seluruh tanaman aktif milik <@${selectedTargetUserId}> dan mereset cooldown ember siramnya!`, flags: 64 });
          const fresh = getGardenPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => { });
        }
        else if (action === 'action_instant_grow') {
          database.run(
            'UPDATE garden_slots SET planted_at = 1 WHERE user_id = ? AND guild_id = ? AND seed_id IS NOT NULL',
            [selectedTargetUserId, guildId]
          );
          await iGarden.reply({ content: `✅ Seluruh tanaman aktif milik <@${selectedTargetUserId}> telah dipaksa tumbuh mekar 100%!`, flags: 64 });
          const fresh = getGardenPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => { });
        }
        else if (action === 'action_reset_garden') {
          database.run(
            'UPDATE garden_slots SET seed_id = NULL, planted_at = 0, last_watered_at = 0, water_count = 0 WHERE user_id = ? AND guild_id = ?',
            [selectedTargetUserId, guildId]
          );
          await iGarden.reply({ content: `✅ Kebun milik <@${selectedTargetUserId}> berhasil direset menjadi tanah kosong!`, flags: 64 });
          const fresh = getGardenPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => { });
        }
        else if (action === 'action_gift_seeds') {
          const giftItems = ['SEED_ROSE', 'SEED_TULIP', 'SEED_LAVENDER', 'SEED_SAKURA', 'SEED_ORCHID', 'GIFT_WRAPPING'];
          database.transaction(() => {
            giftItems.forEach(itemId => {
              updateAdminInventory(selectedTargetUserId, guildId, itemId, 5);
            });
          })();
          await iGarden.reply({ content: `✅ Paket Benih Lengkap (+5 dari masing-masing benih & kertas kado) sukses dikirim ke inventory <@${selectedTargetUserId}>!`, flags: 64 });
          const fresh = getGardenPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => { });
        }
      }
    } catch (err) {
      console.error('Error in Garden Panel Interaction:', err);
      await iGarden.reply({ content: `❌ Terjadi kesalahan: ${err.message}`, flags: 64 }).catch(() => { });
    }
  });

  collector.on('end', async (collected, reason) => {
    if (reason === 'transition') return;
    try {
      const fresh = getGardenPanelData(guildId, selectedTargetUserId);
      fresh.components = [];
      await replyMsg.edit(fresh).catch(() => { });
    } catch (e) { }
  });

  return true;
}

/**
 * 📋 9. SUB-PANEL DAILY QUESTS PET
 */
async function handleAdminQuestPanel(messageOrInteraction, client, initialTargetUserId = null) {
  const isInteraction = !messageOrInteraction.author;
  const author = isInteraction ? messageOrInteraction.user : messageOrInteraction.author;
  const guildId = messageOrInteraction.guildId;

  if (!guildId) return false;

  let selectedTargetUserId = initialTargetUserId;

  const getQuestPanelData = (gId, targetUserId) => {
    let embed = new EmbedBuilder()
      .setColor(0x00E5FF) // Celestial Ice Blue
      .setTitle('📋 ADMIN CONTROL PANEL — DAILY QUESTS PET')
      .setThumbnail(client.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({ text: 'Sentinel Admin • Pengelolaan Misi Harian Kosan 1A' });

    let targetText = '*Belum ada anggota terpilih (Silakan pilih di menu dropdown di bawah)*';
    if (targetUserId) {
      targetText = `🎯 **<@${targetUserId}>**\n` +
        `• ID: \`${targetUserId}\`\n\n`;

      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
      const questRow = database.get(
        'SELECT * FROM user_daily_quests WHERE user_id = ? AND guild_id = ? AND quest_date = ?',
        [targetUserId, gId, todayStr]
      );

      if (questRow) {
        const q1Status = questRow.quest_1_progress >= questRow.quest_1_target ? '🟢 Selesai' : `⏳ \`${questRow.quest_1_progress}/${questRow.quest_1_target}\``;
        const q2Status = questRow.quest_2_progress >= questRow.quest_2_target ? '🟢 Selesai' : `⏳ \`${questRow.quest_2_progress}/${questRow.quest_2_target}\``;
        const q3Status = questRow.quest_3_progress >= questRow.quest_3_target ? '🟢 Selesai' : `⏳ \`${questRow.quest_3_progress}/${questRow.quest_3_target}\``;
        const claimStatus = questRow.reward_claimed === 1 ? '✅ Sudah Klaim Hadiah' : '❌ Belum Klaim Hadiah';

        targetText += `📋 **MISI HARIAN HARI INI (${questRow.quest_date}):**\n` +
          `🔹 Misi 1: **${questRow.quest_1_type}** (${q1Status})\n` +
          `🔹 Misi 2: **${questRow.quest_2_type}** (${q2Status})\n` +
          `🔹 Misi 3: **${questRow.quest_3_type}** (${q3Status})\n\n` +
          `🎁 Status Klaim Hadiah Utama: **${claimStatus}**\n`;
      } else {
        targetText += `⚠️ **Status:** *Misi harian hari ini belum diinisialisasi oleh user (Akan dibuat otomatis saat user mengetik \`.pet misi\`)*\n`;
      }
    }

    embed.setDescription(
      `Gunakan menu di bawah untuk memilih target anggota, lalu tentukan tindakan cepat untuk mengelola Daily Quests mereka:\n\n` +
      `👤 **INFORMASI TARGET ANGGOTA:**\n${targetText}`
    );

    const userSelect = new UserSelectMenuBuilder()
      .setCustomId('admin_quest_select_target')
      .setPlaceholder('👤 Pilih Target Anggota');

    const userRow = new ActionRowBuilder().addComponents(userSelect);

    const actionSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_quest_select_action')
      .setPlaceholder('🎯 Pilih Tindakan Misi Harian')
      .setDisabled(!targetUserId);

    actionSelect.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('🎯 Selesaikan Instan Semua Misi')
        .setDescription('Mengisi progress 3 misi hari ini menjadi selesai secara instan')
        .setValue('action_instant_complete'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🔄 Reset / Acak Ulang Misi Hari Ini')
        .setDescription('Menghapus misi hari ini agar warga dapat mengacak ulang misi baru')
        .setValue('action_reset_quests'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🎁 Beri Paket Perawatan Pet Premium')
        .setDescription('Mengirimkan +5 Daging Premium, Mainan, Obat (Pet Inv) & +5 Linggis, Sabun (User Inv)')
        .setValue('action_gift_care_package')
    );

    const actionRow = new ActionRowBuilder().addComponents(actionSelect);

    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_quest_btn_back')
        .setLabel('🔙 Kembali ke Hub')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('admin_quest_btn_close')
        .setLabel('❌ Tutup Panel')
        .setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [userRow, actionRow, btnRow] };
  };

  const initialData = getQuestPanelData(guildId, selectedTargetUserId);
  let replyMsg;

  if (isInteraction) {
    await messageOrInteraction.update(initialData);
    replyMsg = messageOrInteraction.message;
  } else {
    replyMsg = await messageOrInteraction.reply(initialData);
  }

  const collector = replyMsg.createMessageComponentCollector({ time: 600000 });

  collector.on('collect', async iQuest => {
    const isOwner = iQuest.user.id === config.OWNER_ID;
    const isAdmin = iQuest.member && iQuest.member.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!isOwner && !isAdmin) {
      return iQuest.reply({ content: '❌ Akses Ditolak! Tombol/menu dashboard ini dikunci khusus untuk Owner utama & Administrator server.', flags: 64 });
    }

    try {
      if (iQuest.customId === 'admin_quest_select_target') {
        selectedTargetUserId = iQuest.values[0];
        const fresh = getQuestPanelData(guildId, selectedTargetUserId);
        await iQuest.update(fresh);
      }
      else if (iQuest.customId === 'admin_quest_btn_back') {
        collector.stop('transition');
        await handleAdminPanel(iQuest, client);
      }
      else if (iQuest.customId === 'admin_quest_btn_close') {
        collector.stop();
        await replyMsg.delete().catch(() => { });
      }
      else if (iQuest.customId === 'admin_quest_select_action') {
        const action = iQuest.values[0];
        const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

        if (action === 'action_instant_complete') {
          const row = database.get(
            'SELECT * FROM user_daily_quests WHERE user_id = ? AND guild_id = ? AND quest_date = ?',
            [selectedTargetUserId, guildId, todayStr]
          );
          if (!row) {
            return iQuest.reply({ content: `❌ Anggota <@${selectedTargetUserId}> belum menginisialisasi misi hari ini! Minta mereka menjalankan \`.pet misi\` terlebih dahulu.`, flags: 64 });
          }

          database.run(
            `UPDATE user_daily_quests 
             SET quest_1_progress = quest_1_target,
                 quest_2_progress = quest_2_target,
                 quest_3_progress = quest_3_target
             WHERE user_id = ? AND guild_id = ? AND quest_date = ?`,
            [selectedTargetUserId, guildId, todayStr]
          );

          await iQuest.reply({ content: `✅ Sukses menyelesaikan instan 3 misi harian milik <@${selectedTargetUserId}> untuk hari ini!`, flags: 64 });
          const fresh = getQuestPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => { });
        }
        else if (action === 'action_reset_quests') {
          database.run(
            'DELETE FROM user_daily_quests WHERE user_id = ? AND guild_id = ? AND quest_date = ?',
            [selectedTargetUserId, guildId, todayStr]
          );
          await iQuest.reply({ content: `✅ Sukses menghapus/reset misi harian milik <@${selectedTargetUserId}> hari ini! Mereka dapat mengacak ulang misi baru sekarang.`, flags: 64 });
          const fresh = getQuestPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => { });
        }
        else if (action === 'action_gift_care_package') {
          database.transaction(() => {
            // Pet Inventory Items (+5)
            updateAdminPetInventory(selectedTargetUserId, guildId, 'FOOD_PREMIUM', 5);
            updateAdminPetInventory(selectedTargetUserId, guildId, 'TOY', 5);
            updateAdminPetInventory(selectedTargetUserId, guildId, 'MEDICINE', 5);

            // User Inventory Items (+5)
            updateAdminInventory(selectedTargetUserId, guildId, 'LOCKPICK', 5);
            updateAdminInventory(selectedTargetUserId, guildId, 'SOAP', 5);
          })();

          await iQuest.reply({ content: `✅ Sukses mengirimkan Paket Perawatan Pet Premium (+5 Daging Premium, Mainan, Obat di Pet Inventory & +5 Linggis, Sabun di User Inventory) ke <@${selectedTargetUserId}>!`, flags: 64 });
          const fresh = getQuestPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => { });
        }
      }
    } catch (err) {
      console.error('Error in Quest Panel Interaction:', err);
      await iQuest.reply({ content: `❌ Terjadi kesalahan: ${err.message}`, flags: 64 }).catch(() => { });
    }
  });

  collector.on('end', async (collected, reason) => {
    if (reason === 'transition') return;
    try {
      const fresh = getQuestPanelData(guildId, selectedTargetUserId);
      fresh.components = [];
      await replyMsg.edit(fresh).catch(() => { });
    } catch (e) { }
  });

  return true;
}

const PET_ITEM_IDS = [
  'FOOD_BASIC', 'FOOD_PREMIUM', 'WATER', 'MEDICINE', 'TOY', 'SODA_ENERGY', 'SOAP_PET',
  'COLLAR_IRON', 'SWORD_TOY', 'SHIELD_TOY', 'LUCKY_AMULET',
  'XP_2X', 'XP_4X', 'XP_6X', 'XP_8X', 'PET_RENAME'
];

function updateAdminInventory(userId, guildId, itemId, quantityChange) {
  const upperId = itemId.toUpperCase().trim();
  if (PET_ITEM_IDS.includes(upperId)) {
    return updateAdminPetInventory(userId, guildId, upperId, quantityChange);
  }

  const row = database.get(
    'SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?',
    [userId, guildId, upperId]
  );

  if (!row) {
    if (quantityChange > 0) {
      database.run(
        'INSERT INTO user_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, ?, ?)',
        [userId, guildId, upperId, quantityChange]
      );
    }
  } else {
    const newQty = Math.max(0, row.quantity + quantityChange);
    if (newQty === 0) {
      database.run(
        'DELETE FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?',
        [userId, guildId, upperId]
      );
    } else {
      database.run(
        'UPDATE user_inventory SET quantity = ? WHERE user_id = ? AND guild_id = ? AND item_id = ?',
        [newQty, userId, guildId, upperId]
      );
    }
  }
}

function updateAdminPetInventory(userId, guildId, itemId, quantityChange) {
  const upperId = itemId.toUpperCase().trim();
  if (!PET_ITEM_IDS.includes(upperId)) {
    return updateAdminInventory(userId, guildId, upperId, quantityChange);
  }

  const exist = database.get(
    'SELECT quantity FROM pet_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?',
    [userId, guildId, upperId]
  );
  if (exist) {
    const newQty = Math.max(0, exist.quantity + quantityChange);
    if (newQty === 0) {
      database.run(
        'DELETE FROM pet_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?',
        [userId, guildId, upperId]
      );
    } else {
      database.run(
        'UPDATE pet_inventory SET quantity = ? WHERE user_id = ? AND guild_id = ? AND item_id = ?',
        [newQty, userId, guildId, upperId]
      );
    }
  } else {
    if (quantityChange > 0) {
      database.run(
        'INSERT INTO pet_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, ?, ?)',
        [userId, guildId, upperId, quantityChange]
      );
    }
  }
}

async function handleAdminWargaPanel(messageOrInteraction, client, initialTargetUserId = null) {
  const isInteraction = !messageOrInteraction.author;
  const author = isInteraction ? messageOrInteraction.user : messageOrInteraction.author;
  const guildId = messageOrInteraction.guildId;

  if (!guildId) return false;

  let selectedTargetUserId = initialTargetUserId;
  let activeSubMenu = 'main'; // 'main', 'select_item_warga', 'select_item_pet'

  const getWargaPanelData = (gId, targetUserId) => {
    let embed = new EmbedBuilder()
      .setColor(0x7C4DFF) // Royal Violet
      .setThumbnail(client.user.displayAvatarURL())
      .setTimestamp();

    if (activeSubMenu === 'main') {
      embed.setTitle('👥 ADMIN CONTROL PANEL — CITIZEN (WARGA)')
        .setFooter({ text: 'Sentinel Admin • Pengelolaan Data Warga' });

      let targetText = '*Belum ada warga terpilih (Silakan pilih di menu dropdown di bawah)*';
      if (targetUserId) {
        // Pastikan wallet terbuat agar data tidak kosong
        economy.getWallet(targetUserId, gId);

        const wallet = database.get('SELECT balance, jail_until, jail_type, wanted_until FROM wallets WHERE user_id = ? AND guild_id = ?', [targetUserId, gId]) || { balance: 0, jail_until: 0, jail_type: '', wanted_until: 0 };
        const savings = database.get('SELECT balance FROM bank_savings WHERE user_id = ? AND guild_id = ?', [targetUserId, gId]) || { balance: 0 };
        const isBlacklisted = database.get('SELECT 1 FROM bot_blacklist WHERE user_id = ? AND guild_id = ?', [targetUserId, gId]);

        // Get inventory items
        const items = database.all('SELECT item_id, quantity FROM user_inventory WHERE user_id = ? AND guild_id = ?', [targetUserId, gId]);
        const petItems = database.all('SELECT item_id, quantity FROM pet_inventory WHERE user_id = ? AND guild_id = ?', [targetUserId, gId]);

        let itemText = items.map(it => `• \`${it.item_id}\` x${it.quantity}`).join('\n') || '*Kosong*';
        let petItemText = petItems.map(it => `• \`${it.item_id}\` x${it.quantity}`).join('\n') || '*Kosong*';

        const nowUnix = Math.floor(Date.now() / 1000);
        let jailStatus = '🟢 Bebas';
        if (wallet.jail_until > nowUnix) {
          jailStatus = `🔴 Ditahan (${wallet.jail_type || 'solo'}) - Bebas: <t:${wallet.jail_until}:R>`;
        }
        let wantedStatus = '🟢 Bersih';
        if (wallet.wanted_until > nowUnix) {
          wantedStatus = `🔴 Buronan (Wanted) - Sisa CD: <t:${wallet.wanted_until}:R>`;
        }

        targetText = `🎯 **<@${targetUserId}>**\n` +
          `• ID Warga: \`${targetUserId}\`\n` +
          `• Dompet: **Rp ${(wallet.balance || 0).toLocaleString('id-ID')}**\n` +
          `• Tabungan Bank: **Rp ${(savings.balance || 0).toLocaleString('id-ID')}**\n` +
          `• Status Tahanan: ${jailStatus}\n` +
          `• Status Wanted: ${wantedStatus}\n` +
          `• Blacklist Bot: ${isBlacklisted ? '🔴 **YA (Banned dari Bot)**' : '🟢 Tidak (Aktif)'}\n\n` +
          `🎒 **INVENTARIS WARGA:**\n${itemText}\n\n` +
          `🐾 **INVENTARIS PET WARGA:**\n${petItemText}`;
      }

      embed.setDescription(
        `Gunakan menu dropdown di bawah untuk memilih warga, kemudian pilih tindakan kustom untuk memodifikasi profil warga secara langsung:\n\n` +
        `👤 **INFORMASI DATA WARGA:**\n${targetText}`
      );

      const userSelect = new UserSelectMenuBuilder()
        .setCustomId('admin_warga_select_target')
        .setPlaceholder('👤 Pilih Target Warga');

      const userRow = new ActionRowBuilder().addComponents(userSelect);

      const actionSelect = new StringSelectMenuBuilder()
        .setCustomId('admin_warga_select_action')
        .setPlaceholder('🎯 Pilih Tindakan Pengelolaan Warga')
        .setDisabled(!targetUserId);

      actionSelect.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('💸 Suntik/Tarik Koin Warga (Modal)')
          .setDescription('Menambahkan/mengurangi koin langsung di dompet target')
          .setValue('warga_edit_coins_modal'),
        new StringSelectMenuOptionBuilder()
          .setLabel('🏦 Suntik/Tarik Tabungan Bank (Modal)')
          .setDescription('Menambahkan/mengurangi koin langsung di tabungan bank target')
          .setValue('warga_edit_bank_modal'),
        new StringSelectMenuOptionBuilder()
          .setLabel('🎒 Kelola Item Warga (Pilih)')
          .setDescription('Pilih & beri/tarik item inventaris general (LOCKPICK, SOAP, TICKET_GACHA, dll)')
          .setValue('warga_edit_item_select'),
        new StringSelectMenuOptionBuilder()
          .setLabel('🐾 Kelola Item Pet (Pilih)')
          .setDescription('Pilih & beri/tarik item inventaris pet (FOOD_BASIC, MEDICINE, dll)')
          .setValue('warga_edit_pet_item_select'),
        new StringSelectMenuOptionBuilder()
          .setLabel('🚫 Toggle Blacklist Bot (Banned)')
          .setDescription('Memblokir/memulihkan akses warga dari penggunaan bot')
          .setValue('warga_toggle_blacklist'),
        new StringSelectMenuOptionBuilder()
          .setLabel('🚓 Bebaskan dari Lapas Penjara')
          .setDescription('Bebaskan seketika warga target dari hukuman penjara')
          .setValue('warga_release_jail')
      );

      const actionRow = new ActionRowBuilder().addComponents(actionSelect);

      const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_warga_btn_back')
          .setLabel('🔙 Kembali ke Hub')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('admin_warga_btn_close')
          .setLabel('❌ Tutup Panel')
          .setStyle(ButtonStyle.Danger)
      );

      return { embeds: [embed], components: [userRow, actionRow, btnRow] };
    }
    else if (activeSubMenu === 'select_item_warga') {
      embed.setTitle('🎒 KELOLA ITEM WARGA')
        .setDescription(`Silakan pilih item yang ingin ditambahkan atau ditarik dari warga <@${targetUserId}>:\n\n*Pilih item di bawah, kemudian pop-up modal jumlah akan otomatis terbuka.*`)
        .setFooter({ text: 'Sentinel Admin • Pengelolaan Item Warga' });

      const itemSelect = new StringSelectMenuBuilder()
        .setCustomId('admin_warga_select_item_warga_id')
        .setPlaceholder('🎒 Pilih Item General / Warga...');

      itemSelect.addOptions(
        new StringSelectMenuOptionBuilder().setLabel('🎟️ Tiket Gacha Pet (TICKET_GACHA)').setValue('TICKET_GACHA'),
        new StringSelectMenuOptionBuilder().setLabel('🗝️ Linggis / Lockpick (LOCKPICK)').setValue('LOCKPICK'),
        new StringSelectMenuOptionBuilder().setLabel('🎭 Topeng Samaran (MASK)').setValue('MASK'),
        new StringSelectMenuOptionBuilder().setLabel('🥩 Daging Bius (MEAT)').setValue('MEAT'),
        new StringSelectMenuOptionBuilder().setLabel('🧼 Sabun Licin (SOAP)').setValue('SOAP'),
        new StringSelectMenuOptionBuilder().setLabel('🛡️ Brankas Anti-Hacker (BRANKAS)').setValue('BRANKAS'),
        new StringSelectMenuOptionBuilder().setLabel('🏎️ Lamborghini (LAMBO)').setValue('LAMBO'),
        new StringSelectMenuOptionBuilder().setLabel('👑 Emas Batangan (GOLD)').setValue('GOLD'),
        new StringSelectMenuOptionBuilder().setLabel('🔑 Kunci Penthouse (KEY)').setValue('KEY'),
        new StringSelectMenuOptionBuilder().setLabel('⌚ Jam Rolex (ROLEX)').setValue('ROLEX'),
        new StringSelectMenuOptionBuilder().setLabel('📱 iPhone 16 Pro Max (IPHONE)').setValue('IPHONE'),
        new StringSelectMenuOptionBuilder().setLabel('🌱 Benih Rose (SEED_ROSE)').setValue('SEED_ROSE'),
        new StringSelectMenuOptionBuilder().setLabel('🌱 Benih Tulip (SEED_TULIP)').setValue('SEED_TULIP'),
        new StringSelectMenuOptionBuilder().setLabel('🌱 Benih Lavender (SEED_LAVENDER)').setValue('SEED_LAVENDER'),
        new StringSelectMenuOptionBuilder().setLabel('🌱 Benih Sakura (SEED_SAKURA)').setValue('SEED_SAKURA'),
        new StringSelectMenuOptionBuilder().setLabel('🌱 Benih Orchid (SEED_ORCHID)').setValue('SEED_ORCHID'),
        new StringSelectMenuOptionBuilder().setLabel('🌹 Bunga Rose (FLOWER_ROSE)').setValue('FLOWER_ROSE'),
        new StringSelectMenuOptionBuilder().setLabel('🌷 Bunga Tulip (FLOWER_TULIP)').setValue('FLOWER_TULIP'),
        new StringSelectMenuOptionBuilder().setLabel('🪻 Bunga Lavender (FLOWER_LAVENDER)').setValue('FLOWER_LAVENDER'),
        new StringSelectMenuOptionBuilder().setLabel('🌸 Bunga Sakura (FLOWER_SAKURA)').setValue('FLOWER_SAKURA'),
        new StringSelectMenuOptionBuilder().setLabel('🪻 Bunga Orchid (FLOWER_ORCHID)').setValue('FLOWER_ORCHID'),
        new StringSelectMenuOptionBuilder().setLabel('💐 Bouquet Love (BOUQUET_LOVE)').setValue('BOUQUET_LOVE'),
        new StringSelectMenuOptionBuilder().setLabel('💐 Bouquet Peace (BOUQUET_PEACE)').setValue('BOUQUET_PEACE')
      );

      const selectRow = new ActionRowBuilder().addComponents(itemSelect);

      const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_warga_btn_back_to_main')
          .setLabel('🔙 Kembali')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('admin_warga_btn_close')
          .setLabel('❌ Tutup Panel')
          .setStyle(ButtonStyle.Danger)
      );

      return { embeds: [embed], components: [selectRow, btnRow] };
    }
    else if (activeSubMenu === 'select_item_pet') {
      embed.setTitle('🐾 KELOLA ITEM PET WARGA')
        .setDescription(`Silakan pilih item pet yang ingin ditambahkan atau ditarik dari pet milik <@${targetUserId}>:\n\n*Pilih item di bawah, kemudian pop-up modal jumlah akan otomatis terbuka.*`)
        .setFooter({ text: 'Sentinel Admin • Pengelolaan Item Pet Warga' });

      const itemSelect = new StringSelectMenuBuilder()
        .setCustomId('admin_warga_select_item_pet_id')
        .setPlaceholder('🐾 Pilih Item Pet...');

      itemSelect.addOptions(
        new StringSelectMenuOptionBuilder().setLabel('🥩 Makanan Biasa (FOOD_BASIC)').setValue('FOOD_BASIC'),
        new StringSelectMenuOptionBuilder().setLabel('🍖 Makanan Premium (FOOD_PREMIUM)').setValue('FOOD_PREMIUM'),
        new StringSelectMenuOptionBuilder().setLabel('💧 Air Minum (WATER)').setValue('WATER'),
        new StringSelectMenuOptionBuilder().setLabel('💊 Obat-obatan (MEDICINE)').setValue('MEDICINE'),
        new StringSelectMenuOptionBuilder().setLabel('🧸 Mainan Pet (TOY)').setValue('TOY'),
        new StringSelectMenuOptionBuilder().setLabel('🥤 Soda Energi (SODA_ENERGY)').setValue('SODA_ENERGY'),
        new StringSelectMenuOptionBuilder().setLabel('🧼 Sabun Pet (SOAP_PET)').setValue('SOAP_PET'),
        new StringSelectMenuOptionBuilder().setLabel('⛓️ Kalung Besi (COLLAR_IRON)').setValue('COLLAR_IRON'),
        new StringSelectMenuOptionBuilder().setLabel('⚔️ Pedang Mainan (SWORD_TOY)').setValue('SWORD_TOY'),
        new StringSelectMenuOptionBuilder().setLabel('🛡️ Tameng Mainan (SHIELD_TOY)').setValue('SHIELD_TOY'),
        new StringSelectMenuOptionBuilder().setLabel('🔮 Jimat Keberuntungan (LUCKY_AMULET)').setValue('LUCKY_AMULET'),
        new StringSelectMenuOptionBuilder().setLabel('⚡ Booster XP 2X (XP_2X)').setValue('XP_2X'),
        new StringSelectMenuOptionBuilder().setLabel('⚡ Booster XP 4X (XP_4X)').setValue('XP_4X'),
        new StringSelectMenuOptionBuilder().setLabel('⚡ Booster XP 6X (XP_6X)').setValue('XP_6X'),
        new StringSelectMenuOptionBuilder().setLabel('⚡ Booster XP 8X (XP_8X)').setValue('XP_8X'),
        new StringSelectMenuOptionBuilder().setLabel('🏷️ Kartu Ganti Nama Pet (PET_RENAME)').setValue('PET_RENAME')
      );

      const selectRow = new ActionRowBuilder().addComponents(itemSelect);

      const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_warga_btn_back_to_main')
          .setLabel('🔙 Kembali')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('admin_warga_btn_close')
          .setLabel('❌ Tutup Panel')
          .setStyle(ButtonStyle.Danger)
      );

      return { embeds: [embed], components: [selectRow, btnRow] };
    }
  };

  const initialData = getWargaPanelData(guildId, selectedTargetUserId);
  let replyMsg;

  if (isInteraction) {
    await messageOrInteraction.update(initialData);
    replyMsg = messageOrInteraction.message;
  } else {
    replyMsg = await messageOrInteraction.reply(initialData);
  }

  const collector = replyMsg.createMessageComponentCollector({ time: 600000 });

  collector.on('collect', async iWarga => {
    const isOwner = iWarga.user.id === config.OWNER_ID;
    const isAdmin = iWarga.member && iWarga.member.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!isOwner && !isAdmin) {
      return iWarga.reply({ content: '❌ Akses Ditolak! Tombol/menu dashboard ini dikunci khusus untuk Owner utama & Administrator server.', flags: 64 });
    }

    try {
      if (iWarga.customId === 'admin_warga_select_target') {
        selectedTargetUserId = iWarga.values[0];
        const fresh = getWargaPanelData(guildId, selectedTargetUserId);
        await iWarga.update(fresh);
      }
      else if (iWarga.customId === 'admin_warga_btn_back') {
        collector.stop('transition');
        await handleAdminPanel(iWarga, client);
      }
      else if (iWarga.customId === 'admin_warga_btn_close') {
        collector.stop();
        await replyMsg.delete().catch(() => { });
      }
      else if (iWarga.customId === 'admin_warga_btn_back_to_main') {
        activeSubMenu = 'main';
        const fresh = getWargaPanelData(guildId, selectedTargetUserId);
        await iWarga.update(fresh);
      }
      else if (iWarga.customId === 'admin_warga_select_item_warga_id') {
        const itemId = iWarga.values[0];
        const modal = new ModalBuilder()
          .setCustomId('admin_warga_qty_modal')
          .setTitle(`Jumlah: ${itemId}`);

        const qtyInput = new TextInputBuilder()
          .setCustomId('item_qty')
          .setLabel('Jumlah (Gunakan minus untuk mengurangi)')
          .setPlaceholder('Contoh: 5 atau -3')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(qtyInput));
        await iWarga.showModal(modal);

        const sub = await iWarga.awaitModalSubmit({
          filter: (s) => s.customId === 'admin_warga_qty_modal' && s.user.id === author.id,
          time: 60000
        }).catch(() => null);

        if (sub) {
          const qty = parseInt(sub.fields.getTextInputValue('item_qty'));
          if (isNaN(qty) || qty === 0) {
            return sub.reply({ content: '❌ Jumlah harus berupa angka bulat bukan nol!', flags: 64 });
          }

          updateAdminInventory(selectedTargetUserId, guildId, itemId, qty);

          await sub.reply({ content: `🎒 Sukses mengubah item \`${itemId}\` untuk <@${selectedTargetUserId}> sebesar **${qty > 0 ? '+' : ''}${qty}**!`, flags: 64 });
          activeSubMenu = 'main';
          const fresh = getWargaPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => { });
        }
      }
      else if (iWarga.customId === 'admin_warga_select_item_pet_id') {
        const itemId = iWarga.values[0];
        const modal = new ModalBuilder()
          .setCustomId('admin_warga_pet_qty_modal')
          .setTitle(`Jumlah Pet Item: ${itemId}`);

        const qtyInput = new TextInputBuilder()
          .setCustomId('item_qty')
          .setLabel('Jumlah (Gunakan minus untuk mengurangi)')
          .setPlaceholder('Contoh: 10 atau -5')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(qtyInput));
        await iWarga.showModal(modal);

        const sub = await iWarga.awaitModalSubmit({
          filter: (s) => s.customId === 'admin_warga_pet_qty_modal' && s.user.id === author.id,
          time: 60000
        }).catch(() => null);

        if (sub) {
          const qty = parseInt(sub.fields.getTextInputValue('item_qty'));
          if (isNaN(qty) || qty === 0) {
            return sub.reply({ content: '❌ Jumlah harus berupa angka bulat bukan nol!', flags: 64 });
          }

          updateAdminPetInventory(selectedTargetUserId, guildId, itemId, qty);

          await sub.reply({ content: `🐾 Sukses mengubah item pet \`${itemId}\` untuk <@${selectedTargetUserId}> sebesar **${qty > 0 ? '+' : ''}${qty}**!`, flags: 64 });
          activeSubMenu = 'main';
          const fresh = getWargaPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => { });
        }
      }
      else if (iWarga.customId === 'admin_warga_select_action') {
        const action = iWarga.values[0];
        if (!selectedTargetUserId) {
          return iWarga.reply({ content: '❌ Silakan pilih target warga terlebih dahulu!', flags: 64 });
        }

        if (action === 'warga_edit_coins_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_warga_edit_coins_modal')
            .setTitle('Edit Koin Dompet Warga');

          const amountInput = new TextInputBuilder()
            .setCustomId('coin_amount')
            .setLabel('Jumlah Koin (Gunakan minus untuk tarik)')
            .setPlaceholder('Contoh: 100000 atau -50000')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
          await iWarga.showModal(modal);

          const sub = await iWarga.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_warga_edit_coins_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const amount = parseInt(sub.fields.getTextInputValue('coin_amount'));
            if (isNaN(amount) || amount === 0) {
              return sub.reply({ content: '❌ Jumlah harus berupa angka bulat bukan nol!', flags: 64 });
            }

            const current = database.get('SELECT balance FROM wallets WHERE user_id = ? AND guild_id = ?', [selectedTargetUserId, guildId]);
            const currentBal = current ? current.balance : 0;
            const newBal = Math.max(0, currentBal + amount);
            database.run('UPDATE wallets SET balance = ? WHERE user_id = ? AND guild_id = ?', [newBal, selectedTargetUserId, guildId]);

            // Record transaction
            database.run(
              'INSERT INTO transactions (user_id, guild_id, type, amount) VALUES (?, ?, ?, ?)',
              [selectedTargetUserId, guildId, amount > 0 ? 'ADMIN_GIVE' : 'ADMIN_TAKE', amount]
            );

            await sub.reply({ content: `💸 Sukses mengubah koin dompet <@${selectedTargetUserId}> sebesar **Rp ${amount.toLocaleString('id-ID')}** (Saldo sekarang: **Rp ${newBal.toLocaleString('id-ID')}**)!`, flags: 64 });
            const fresh = getWargaPanelData(guildId, selectedTargetUserId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'warga_edit_bank_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_warga_edit_bank_modal')
            .setTitle('Edit Tabungan Bank Warga');

          const amountInput = new TextInputBuilder()
            .setCustomId('bank_amount')
            .setLabel('Jumlah Tabungan (Gunakan minus untuk tarik)')
            .setPlaceholder('Contoh: 250000 atau -100000')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
          await iWarga.showModal(modal);

          const sub = await iWarga.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_warga_edit_bank_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const amount = parseInt(sub.fields.getTextInputValue('bank_amount'));
            if (isNaN(amount) || amount === 0) {
              return sub.reply({ content: '❌ Jumlah harus berupa angka bulat bukan nol!', flags: 64 });
            }

            const current = database.get('SELECT balance FROM bank_savings WHERE user_id = ? AND guild_id = ?', [selectedTargetUserId, guildId]);
            const currentBal = current ? current.balance : 0;
            const newBal = Math.max(0, currentBal + amount);

            if (!current) {
              database.run('INSERT INTO bank_savings (user_id, guild_id, balance) VALUES (?, ?, ?)', [selectedTargetUserId, guildId, newBal]);
            } else {
              database.run('UPDATE bank_savings SET balance = ? WHERE user_id = ? AND guild_id = ?', [newBal, selectedTargetUserId, guildId]);
            }

            await sub.reply({ content: `🏦 Sukses mengubah tabungan bank <@${selectedTargetUserId}> sebesar **Rp ${amount.toLocaleString('id-ID')}** (Tabungan sekarang: **Rp ${newBal.toLocaleString('id-ID')}**)!`, flags: 64 });
            const fresh = getWargaPanelData(guildId, selectedTargetUserId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'warga_edit_item_select') {
          activeSubMenu = 'select_item_warga';
          const fresh = getWargaPanelData(guildId, selectedTargetUserId);
          await iWarga.update(fresh);
        }
        else if (action === 'warga_edit_pet_item_select') {
          activeSubMenu = 'select_item_pet';
          const fresh = getWargaPanelData(guildId, selectedTargetUserId);
          await iWarga.update(fresh);
        }
        else if (action === 'warga_toggle_blacklist') {
          const exist = database.get('SELECT 1 FROM bot_blacklist WHERE user_id = ? AND guild_id = ?', [selectedTargetUserId, guildId]);
          const modeStr = exist ? 'Hapus dari Blacklist (Unban)' : 'Masukkan ke Blacklist (Banned dari Bot)';
          const confirmed = await askConfirmation(iWarga, author.id, `${modeStr} untuk warga <@${selectedTargetUserId}>`);
          if (!confirmed) return;

          const freshExist = database.get('SELECT 1 FROM bot_blacklist WHERE user_id = ? AND guild_id = ?', [selectedTargetUserId, guildId]);
          if (freshExist) {
            database.run('DELETE FROM bot_blacklist WHERE user_id = ? AND guild_id = ?', [selectedTargetUserId, guildId]);
            await iWarga.followUp({ content: `🟢 Sukses memulihkan akses warga <@${selectedTargetUserId}> dari blacklist bot!`, flags: 64 });
          } else {
            database.run('INSERT INTO bot_blacklist (user_id, guild_id) VALUES (?, ?)', [selectedTargetUserId, guildId]);
            await iWarga.followUp({ content: `🔴 Sukses memasukkan warga <@${selectedTargetUserId}> ke dalam blacklist bot (Banned dari Bot)!`, flags: 64 });
          }
          const fresh = getWargaPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => { });
        }
        else if (action === 'warga_release_jail') {
          await iWarga.deferReply({ flags: 64 });
          database.run("UPDATE wallets SET jail_until = 0, jail_type = '' WHERE user_id = ? AND guild_id = ?", [selectedTargetUserId, guildId]);
          await iWarga.editReply({ content: `🚓 Sukses membebaskan warga <@${selectedTargetUserId}> seketika dari sel Lapas Penjara!` });
          const fresh = getWargaPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => { });
        }
      }
    } catch (err) {
      console.error('Error in Warga Panel Interaction:', err);
      await iWarga.reply({ content: `❌ Terjadi kesalahan: ${err.message}`, flags: 64 }).catch(() => { });
    }
  });

  collector.on('end', async (collected, reason) => {
    if (reason === 'transition') return;
    try {
      const fresh = getWargaPanelData(guildId, selectedTargetUserId);
      fresh.components = [];
      await replyMsg.edit(fresh).catch(() => { });
    } catch (e) { }
  });

  return true;
}

async function askConfirmation(interaction, authorId, actionDescription) {
  const confirmEmbed = new EmbedBuilder()
    .setColor(0xFF3366) // Crimson Rose
    .setTitle('⚠️ KONFIRMASI TINDAKAN KRITIS')
    .setDescription(`Apakah Anda yakin ingin melakukan tindakan ini?\n\n**Tindakan:** ${actionDescription}`);

  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('admin_confirm_yes')
      .setLabel('Ya, Lakukan!')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('admin_confirm_no')
      .setLabel('Batal')
      .setStyle(ButtonStyle.Secondary)
  );

  const confirmMsg = await interaction.reply({ embeds: [confirmEmbed], components: [confirmRow], flags: 64, fetchReply: true });

  const confirmSub = await confirmMsg.awaitMessageComponent({
    filter: (btn) => ['admin_confirm_yes', 'admin_confirm_no'].includes(btn.customId) && btn.user.id === authorId,
    time: 30000
  }).catch(() => null);

  if (confirmSub) {
    if (confirmSub.customId === 'admin_confirm_yes') {
      await confirmSub.deferUpdate().catch(() => { });
      await confirmMsg.delete().catch(() => { });
      return true;
    } else {
      await confirmSub.deferUpdate().catch(() => { });
      await confirmMsg.delete().catch(() => { });
      await confirmSub.followUp({ content: '❌ Tindakan dibatalkan.', flags: 64 }).catch(() => { });
      return false;
    }
  } else {
    await confirmMsg.delete().catch(() => { });
    await interaction.followUp({ content: '❌ Waktu konfirmasi habis. Tindakan dibatalkan.', flags: 64 }).catch(() => { });
    return false;
  }
}

async function handleAdminGiftPanel(messageOrInteraction, client) {
  const isInteraction = !messageOrInteraction.author;
  const author = isInteraction ? messageOrInteraction.user : messageOrInteraction.author;
  const guildId = messageOrInteraction.guildId;
  const guild = messageOrInteraction.guild;

  if (!guildId) return false;

  const getGiftPanelData = (gId) => {
    let embed = new EmbedBuilder()
      .setColor(0x7C4DFF) // Royal Violet
      .setTitle('🎁 ADMIN CONTROL PANEL — HADIAH MASSAL & LOTRE')
      .setThumbnail(client.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({ text: 'Sentinel Admin • Pembagian Hadiah & Event Lotre' });

    // 1. Ambil status event aktif
    const activeEvent = database.get('SELECT event_type, ends_at FROM active_events WHERE guild_id = ?', [gId]);
    const nowUnix = Math.floor(Date.now() / 1000);
    let eventText = '⚪ Tidak ada event aktif';
    if (activeEvent && activeEvent.ends_at > nowUnix) {
      eventText = `🔴 **${activeEvent.event_type}** (Sisa: <t:${activeEvent.ends_at}:R>)`;
    }

    // 2. Ambil status event ebyus (sabotase)
    const ebyusSettings = getOrCreateEbyusSettings(gId);
    let ebyusText = '⚪ Tidak ada';
    if (ebyusSettings.is_active === 1) {
      const expiresText = ebyusSettings.expires_at > 0 ? `<t:${ebyusSettings.expires_at}:R>` : '`Permanen (Manual)`';
      ebyusText = `🔴 **ABUSE MODE (Gacha ${ebyusSettings.gacha_mode} & Multiplier ${ebyusSettings.coin_multiplier}x)** (Sisa: ${expiresText})`;
    }

    // 3. Ambil statistik lotre mingguan
    const pool = lottery.getPool(gId);
    const participants = lottery.getParticipants(gId);
    const ticketPrice = config.lottery?.TICKET_PRICE || 100;
    const lotteryText = `• Total Jackpot Pool: **Rp ${(pool.total_pool || 0).toLocaleString('id-ID')}**\n` +
      `• Total Tiket Terjual: **${pool.total_tickets || 0} tiket** (@ Rp ${ticketPrice.toLocaleString('id-ID')}/tiket)\n` +
      `• Jumlah Peserta: **${participants.length} orang**\n` +
      `• Periode Minggu Ini: \`${pool.week_start || lottery.getCurrentWeekStart()}\``;

    embed.setDescription(
      `Gunakan panel ini untuk membagikan item massal ke seluruh warga server, menyuntik koin jackpot lotre, atau memicu undian pemenang lotre secara instan:\n\n` +
      `📢 **STATUS EVENT SAAT INI:**\n` +
      `• Event Makro: ${eventText}\n` +
      `• Event Sabotase: ${ebyusText}\n\n` +
      `📦 **DAFTAR ITEM YANG BISA DIBAGIKAN:**\n` +
      `• **General Items** (Bagi-bagi Item Massal):\n` +
      `  └ *Kriminal/BM:* \`LOCKPICK\`, \`MASK\`, \`MEAT\`, \`SOAP\`, \`BRANKAS\`\n` +
      `  └ *Barang Mewah:* \`LAMBO\`, \`GOLD\`, \`KEY\`, \`ROLEX\`, \`IPHONE\`\n` +
      `  └ *Kebun/Seed:* \`SEED_ROSE\`, \`SEED_TULIP\`, \`SEED_LAVENDER\`, \`SEED_SAKURA\`, \`SEED_ORCHID\`\n` +
      `  └ *Hasil Panen:* \`FLOWER_ROSE\`, \`FLOWER_TULIP\`, \`FLOWER_LAVENDER\`, \`FLOWER_SAKURA\`, \`FLOWER_ORCHID\`, \`BOUQUET_LOVE\`, \`BOUQUET_PEACE\`\n` +
      `  └ *Tiket:* \`TICKET_GACHA\`\n` +
      `• **Pet Items** (Bagi-bagi Item Pet Massal):\n` +
      `  └ *Pakan/Perawatan:* \`FOOD_BASIC\`, \`FOOD_PREMIUM\`, \`WATER\`, \`TOY\`, \`SODA_ENERGY\`, \`SOAP_PET\`, \`MEDICINE\`, \`LUCKY_AMULET\`\n\n` +
      `🎟️ **STATISTIK LOTRE MINGGUAN:**\n${lotteryText}`
    );

    const actionSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_gift_select_action')
      .setPlaceholder('🎯 Pilih Tindakan Event & Hadiah');

    actionSelect.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('🎁 Bagi-bagi Item Massal (Modal)')
        .setDescription('Membagikan item inventaris general (seperti LOCKPICK/SOAP) ke semua warga')
        .setValue('gift_all_items_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🐾 Bagi-bagi Item Pet Massal (Modal)')
        .setDescription('Membagikan item pet (seperti FOOD_PREMIUM/MEDICINE) ke semua pemilik pet aktif')
        .setValue('gift_all_pet_items_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🎫 Bagi-bagi Tiket Gacha Pet Massal (Modal)')
        .setDescription('Membagikan Tiket Gacha Pet (TICKET_GACHA) gratis ke semua warga')
        .setValue('gift_all_gacha_tickets_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('💰 Suntik Jackpot Lotre (Modal)')
        .setDescription('Menambahkan koin sponsor langsung ke total jackpot pool lotre minggu ini')
        .setValue('lottery_inject_pool_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🎫 Undi Pemenang Lotre Instan')
        .setDescription('Memicu penarikan pemenang lotre saat ini juga secara live')
        .setValue('lottery_instant_draw'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🚨 Reset Pool Tiket Lotre')
        .setDescription('Mereset total jackpot pool dan menghapus seluruh tiket lotre terjual minggu ini')
        .setValue('lottery_reset_pool'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🎟️ Buat Kode Promo Baru (Modal)')
        .setDescription('Membuat kode voucher promo/redeem baru untuk warga')
        .setValue('gift_create_promo_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🎟️ Kelola Kode Promo Aktif')
        .setDescription('Lihat daftar voucher aktif dan hapus voucher')
        .setValue('gift_promo_list')
    );

    const actionRow = new ActionRowBuilder().addComponents(actionSelect);

    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_gift_btn_back')
        .setLabel('🔙 Kembali ke Hub')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('admin_gift_btn_close')
        .setLabel('❌ Tutup Panel')
        .setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [actionRow, btnRow] };
  };

  const initialData = getGiftPanelData(guildId);
  let replyMsg;

  if (isInteraction) {
    await messageOrInteraction.update(initialData);
    replyMsg = messageOrInteraction.message;
  } else {
    replyMsg = await messageOrInteraction.reply(initialData);
  }

  const collector = replyMsg.createMessageComponentCollector({ time: 600000 });

  collector.on('collect', async iGift => {
    const isOwner = iGift.user.id === config.OWNER_ID;
    const isAdmin = iGift.member && iGift.member.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!isOwner && !isAdmin) {
      return iGift.reply({ content: '❌ Akses Ditolak! Tombol/menu dashboard ini dikunci khusus untuk Owner utama & Administrator server.', flags: 64 });
    }

    try {
      if (iGift.customId === 'admin_gift_btn_back') {
        collector.stop('transition');
        await handleAdminPanel(iGift, client);
      }
      else if (iGift.customId === 'admin_gift_btn_close') {
        collector.stop();
        await replyMsg.delete().catch(() => { });
      }
      else if (iGift.customId === 'admin_gift_select_action') {
        const action = iGift.values[0];

        if (action === 'gift_all_items_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_gift_all_items_modal')
            .setTitle('Bagi-bagi Item Massal');

          const itemIdInput = new TextInputBuilder()
            .setCustomId('item_id')
            .setLabel('ID Item (LOCKPICK, SOAP, LAMBO, dll)')
            .setPlaceholder('Contoh: LOCKPICK')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const qtyInput = new TextInputBuilder()
            .setCustomId('item_qty')
            .setLabel('Jumlah per Warga')
            .setPlaceholder('Contoh: 5')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(itemIdInput),
            new ActionRowBuilder().addComponents(qtyInput)
          );
          await iGift.showModal(modal);

          const sub = await iGift.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_gift_all_items_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const itemId = sub.fields.getTextInputValue('item_id').toUpperCase().trim();
            const qty = parseInt(sub.fields.getTextInputValue('item_qty'));
            if (!itemId) {
              return sub.reply({ content: '❌ ID Item tidak boleh kosong!', flags: 64 });
            }
            if (isNaN(qty) || qty <= 0) {
              return sub.reply({ content: '❌ Jumlah harus berupa angka bulat positif!', flags: 64 });
            }

            await sub.deferReply({ flags: 64 });

            // Ambil semua user terdaftar di guild & dari Discord API/cache
            const memberIds = new Set();

            // 1. Ambil dari wallets
            try {
              const activeWallets = database.all('SELECT user_id FROM wallets WHERE guild_id = ?', [guildId]);
              activeWallets.forEach(w => memberIds.add(w.user_id));
            } catch (dbErr) {
              console.error('Gagal mengambil wallets dari db:', dbErr.message);
            }

            // 2. Ambil dari user_inventory
            try {
              const activeInv = database.all('SELECT DISTINCT user_id FROM user_inventory WHERE guild_id = ?', [guildId]);
              activeInv.forEach(w => memberIds.add(w.user_id));
            } catch (dbErr) {
              console.error('Gagal mengambil user_inventory dari db:', dbErr.message);
            }

            // 3. Ambil dari cache memori bot (member online/aktif saat ini)
            if (guild) {
              guild.members.cache.forEach(member => {
                if (!member.user.bot) {
                  memberIds.add(member.id);
                }
              });

              // 4. Tarik paksa seluruh member terbaru dari Discord API
              try {
                const fetchedMembers = await guild.members.fetch({ force: true });
                for (const [id, member] of fetchedMembers) {
                  if (!member.user.bot) {
                    memberIds.add(id);
                  }
                }
              } catch (err) {
                console.warn('Gagal fetch all members via Discord API:', err.message);
              }
            }

            if (memberIds.size === 0) {
              return sub.editReply({ content: '❌ Tidak ada warga terdaftar di database atau Discord server ini!' });
            }

            database.transaction(() => {
              memberIds.forEach(mId => {
                updateAdminInventory(mId, guildId, itemId, qty);
              });
            })();

            await sub.editReply({ content: `🎁 Sukses membagikan item \`${itemId}\` sebanyak **${qty} pcs** ke seluruh warga terdaftar & member server (**${memberIds.size} orang**)! 🎉` });

            // Post announcement
            await sendGlobalEconomyAnnouncement(
              client,
              guild,
              author,
              '🎁 Sinterklas Admin Hadir!',
              `🎉 **BAGI-BAGI ITEM MASSAL!**\nAdmin <@${author.id}> telah membagikan item **${itemId}** sebanyak **${qty} pcs** secara gratis ke kantong inventaris seluruh warga server! Periksa tas Anda dengan perintah \`.tas\` sekarang!`,
              '#8E44AD',
              []
            );

            const fresh = getGiftPanelData(guildId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'gift_all_pet_items_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_gift_all_pet_items_modal')
            .setTitle('Bagi-bagi Item Pet Massal');

          const itemIdInput = new TextInputBuilder()
            .setCustomId('item_id')
            .setLabel('ID Item Pet (FOOD_BASIC, MEDICINE, dll)')
            .setPlaceholder('Contoh: FOOD_PREMIUM')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const qtyInput = new TextInputBuilder()
            .setCustomId('item_qty')
            .setLabel('Jumlah per Pemilik Pet')
            .setPlaceholder('Contoh: 10')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(itemIdInput),
            new ActionRowBuilder().addComponents(qtyInput)
          );
          await iGift.showModal(modal);

          const sub = await iGift.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_gift_all_pet_items_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const itemId = sub.fields.getTextInputValue('item_id').toUpperCase().trim();
            const qty = parseInt(sub.fields.getTextInputValue('item_qty'));
            if (!itemId) {
              return sub.reply({ content: '❌ ID Item tidak boleh kosong!', flags: 64 });
            }
            if (isNaN(qty) || qty <= 0) {
              return sub.reply({ content: '❌ Jumlah harus berupa angka bulat positif!', flags: 64 });
            }

            await sub.deferReply({ flags: 64 });

            // Ambil semua pemilik pet aktif di guild
            const petOwners = database.all('SELECT DISTINCT user_id FROM user_pets WHERE guild_id = ? AND is_active = 1', [guildId]);
            if (petOwners.length === 0) {
              return sub.editReply({ content: '❌ Tidak ada warga yang memiliki peliharaan aktif saat ini!' });
            }

            database.transaction(() => {
              petOwners.forEach(po => {
                updateAdminPetInventory(po.user_id, guildId, itemId, qty);
              });
            })();

            await sub.editReply({ content: `🐾 Sukses membagikan item pet \`${itemId}\` sebanyak **${qty} pcs** ke seluruh pemilik pet aktif (**${petOwners.length} orang**)! 🎉` });

            // Post announcement
            await sendGlobalEconomyAnnouncement(
              client,
              guild,
              author,
              '🐾 Hadiah untuk Peliharaan Warga!',
              `🎉 **BAGI-BAGI MAKANAN/OBAT PET MASSAL!**\nAdmin <@${author.id}> telah membagikan item pet **${itemId}** sebanyak **${qty} pcs** secara gratis ke seluruh warga yang memiliki peliharaan aktif! Periksa kandang Anda dengan perintah \`.pet\`!`,
              '#2980B9',
              []
            );

            const fresh = getGiftPanelData(guildId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'gift_all_gacha_tickets_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_gift_all_gacha_tickets_modal')
            .setTitle('Bagi-bagi Tiket Gacha Pet');

          const qtyInput = new TextInputBuilder()
            .setCustomId('ticket_qty')
            .setLabel('Jumlah Tiket Gacha per Warga')
            .setPlaceholder('Contoh: 5')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(qtyInput));
          await iGift.showModal(modal);

          const sub = await iGift.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_gift_gacha_tickets_modal' || s.customId === 'admin_gift_all_gacha_tickets_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const qty = parseInt(sub.fields.getTextInputValue('ticket_qty'));
            if (isNaN(qty) || qty <= 0) {
              return sub.reply({ content: '❌ Jumlah harus berupa angka bulat positif!', flags: 64 });
            }

            await sub.deferReply({ flags: 64 });

            // Ambil semua user terdaftar & dari Discord API/cache
            const memberIds = new Set();
            try {
              const activeWallets = database.all('SELECT user_id FROM wallets WHERE guild_id = ?', [guildId]);
              activeWallets.forEach(w => memberIds.add(w.user_id));
            } catch (dbErr) {
              console.error('Gagal mengambil wallets dari db:', dbErr.message);
            }
            try {
              const activeInv = database.all('SELECT DISTINCT user_id FROM user_inventory WHERE guild_id = ?', [guildId]);
              activeInv.forEach(w => memberIds.add(w.user_id));
            } catch (dbErr) {
              console.error('Gagal mengambil user_inventory dari db:', dbErr.message);
            }
            if (guild) {
              guild.members.cache.forEach(member => {
                if (!member.user.bot) {
                  memberIds.add(member.id);
                }
              });
              try {
                const fetchedMembers = await guild.members.fetch({ force: true });
                for (const [id, member] of fetchedMembers) {
                  if (!member.user.bot) {
                    memberIds.add(id);
                  }
                }
              } catch (err) {
                console.warn('Gagal fetch all members via Discord API:', err.message);
              }
            }

            if (memberIds.size === 0) {
              return sub.editReply({ content: '❌ Tidak ada warga terdaftar di database atau Discord server ini!' });
            }

            const petModule = require('./pet');
            database.transaction(() => {
              memberIds.forEach(mId => {
                petModule.addGachaTickets(mId, guildId, qty);
              });
            })();

            await sub.editReply({ content: `🎫 Sukses membagikan **${qty} Tiket Gacha Pet** ke seluruh warga terdaftar & member server (**${memberIds.size} orang**)! 🎉` });

            // Post announcement
            await sendGlobalEconomyAnnouncement(
              client,
              guild,
              author,
              '🎫 Hadiah Tiket Gacha Pet Massal!',
              `🎉 **BAGI-BAGI TIKET GACHA PET GRATIS!**\nAdmin <@${author.id}> telah membagikan **${qty} Tiket Gacha Pet** secara gratis ke seluruh warga server! Periksa tiket gacha Anda dengan mengetik \`.pet\`!`,
              '#E67E22',
              []
            );

            const fresh = getGiftPanelData(guildId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'lottery_inject_pool_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_lottery_inject_pool_modal')
            .setTitle('Suntik Jackpot Lotre');

          const amountInput = new TextInputBuilder()
            .setCustomId('inject_amount')
            .setLabel('Jumlah Koin Sponsor (Rupiah)')
            .setPlaceholder('Contoh: 100000')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
          await iGift.showModal(modal);

          const sub = await iGift.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_lottery_inject_pool_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const amount = parseInt(sub.fields.getTextInputValue('inject_amount'));
            if (isNaN(amount) || amount <= 0) {
              return sub.reply({ content: '❌ Jumlah harus berupa angka bulat positif!', flags: 64 });
            }

            const weekStart = lottery.getCurrentWeekStart();
            database.run(
              'INSERT INTO lottery_pool (guild_id, total_pool, total_tickets, week_start) VALUES (?, ?, 0, ?) ' +
              'ON CONFLICT(guild_id, week_start) DO UPDATE SET total_pool = total_pool + ?',
              [guildId, amount, weekStart, amount]
            );

            await sub.reply({ content: `💰 Sukses menyuntikkan dana sponsor sebesar **Rp ${amount.toLocaleString('id-ID')}** langsung ke pool lotre minggu ini!`, flags: 64 });

            // Post announcement
            await sendGlobalEconomyAnnouncement(
              client,
              guild,
              author,
              '🎫 Jackpot Lotre Disponsori!',
              `📢 **JACKPOT LOTRE BERTAMBAH!**\nAdmin <@${author.id}> telah mensponsori koin tambahan sebesar **Rp ${amount.toLocaleString('id-ID')}** ke dalam pool jackpot lotre minggu ini!\n*Ayo beli tiket Anda sekarang dengan mengetik \`.lotre beli\` untuk kesempatan menang koin Sultan!*`,
              '#F1C40F',
              []
            );

            const fresh = getGiftPanelData(guildId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'lottery_instant_draw') {
          // Double Confirmation
          const confirmed = await askConfirmation(iGift, author.id, "MENGUNDI PEMENANG LOTRE MINGGU INI secara instan (live draw premature)");
          if (!confirmed) return;

          const drawRes = lottery.drawWinner(guildId);
          if (!drawRes) {
            return iGift.followUp({ content: '❌ Gagal mengundi! Tidak ada peserta yang membeli tiket lotre minggu ini.', flags: 64 });
          }

          // Broadcast announcement
          const drawEmbed = new EmbedBuilder()
            .setColor(0xD4AF37) // Imperial Gold
            .setTitle('🎟️ 🏆 UNDIAN LOTRE MINGGUAN — PEMENANG INSTAN / LIVE DRAW!')
            .setDescription(
              `🎉 **Selamat kepada pemenang lotre minggu ini!**\n\n` +
              `👑 **Pemenang:** <@${drawRes.winnerId}>\n` +
              `🎫 Tiket Pemenang: **${drawRes.winnerTickets} tiket**\n\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `📊 **Statistik Undian Minggu Ini:**\n` +
              `┊ 💰 Total Pool: **Rp ${drawRes.totalPool.toLocaleString('id-ID')}**\n` +
              `┊ 🎫 Total Tiket Terjual: **${drawRes.totalTickets} tiket**\n` +
              `┊ 👥 Jumlah Peserta: **${drawRes.participantCount} orang**\n` +
              `┊ 🏆 Hadiah Pemenang (${100 - drawRes.burnPercent}%): **+Rp ${drawRes.prizeAmount.toLocaleString('id-ID')}**\n` +
              `┊ 🔥 Koin Dibakar (${drawRes.burnPercent}%): **-Rp ${drawRes.burnAmount.toLocaleString('id-ID')}**\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `💡 *Beli tiket lotre periode baru dengan perintah \`.lotre beli <jumlah>\`!*`
            )
            .setTimestamp()
            .setFooter({ text: 'Live Lottery Sentinel • Keberuntungan Anda Menanti!' });

          let targetChannel = null;
          if (config.REPORT_CHANNEL_ID) {
            targetChannel = guild.channels.cache.get(config.REPORT_CHANNEL_ID);
          }
          if (!targetChannel) {
            targetChannel = guild.systemChannel || Array.from(guild.channels.cache.values()).find(
              c => c.name.includes('general') || c.name.includes('chat') || c.name.includes('bot')
            );
          }

          if (targetChannel) {
            await targetChannel.send({ content: `@everyone 🎉 <@${drawRes.winnerId}> telah memenangkan lotre minggu ini!`, embeds: [drawEmbed] }).catch(() => { });
          }

          await iGift.followUp({ content: `🏆 Sukses mengundi lotre secara instan! Pemenang: <@${drawRes.winnerId}> (Hadiah: Rp ${drawRes.prizeAmount.toLocaleString('id-ID')}). Pengumuman dikirim ke <#${targetChannel?.id}>.`, flags: 64 });

          const fresh = getGiftPanelData(guildId);
          await replyMsg.edit(fresh).catch(() => { });
        }
        else if (action === 'lottery_reset_pool') {
          // Double Confirmation
          const confirmed = await askConfirmation(iGift, author.id, "RESET TOTAL POOL & HAPUS SEMUA TIKET LOTRE terjual minggu ini");
          if (!confirmed) return;

          const weekStart = lottery.getCurrentWeekStart();
          database.run('DELETE FROM lottery_pool WHERE guild_id = ? AND week_start = ?', [guildId, weekStart]);
          database.run('DELETE FROM lottery_tickets WHERE guild_id = ? AND week_start = ?', [guildId, weekStart]);

          await iGift.followUp({ content: '🚨 **RESET LOTRE SUKSES!** Total pool dikembalikan ke 0 dan seluruh tiket lotre warga minggu ini telah dihapus permanen.', flags: 64 });

          const fresh = getGiftPanelData(guildId);
          await replyMsg.edit(fresh).catch(() => { });
        }
        else if (action === 'gift_create_promo_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_gift_create_promo_modal')
            .setTitle('Buat Kode Promo Baru');

          const codeInput = new TextInputBuilder()
            .setCustomId('promo_code')
            .setLabel('Kode Promo (Alfanumerik)')
            .setPlaceholder('Contoh: KOSANMANTAP2026')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const coinsInput = new TextInputBuilder()
            .setCustomId('promo_coins')
            .setLabel('Hadiah Koin (0 jika tidak ada)')
            .setPlaceholder('Contoh: 5000')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const itemInput = new TextInputBuilder()
            .setCustomId('promo_item_id')
            .setLabel('ID Item Hadiah (Kosongkan jika tidak ada)')
            .setPlaceholder('Contoh: FOOD_PREMIUM atau LOCKPICK')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

          const qtyInput = new TextInputBuilder()
            .setCustomId('promo_item_qty')
            .setLabel('Jumlah Item Hadiah (0 jika tidak ada)')
            .setPlaceholder('Contoh: 3')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

          const quotaInput = new TextInputBuilder()
            .setCustomId('promo_quota')
            .setLabel('Kuota Klaim (-1 untuk tanpa batas)')
            .setPlaceholder('Contoh: 50')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(codeInput),
            new ActionRowBuilder().addComponents(coinsInput),
            new ActionRowBuilder().addComponents(itemInput),
            new ActionRowBuilder().addComponents(qtyInput),
            new ActionRowBuilder().addComponents(quotaInput)
          );
          await iGift.showModal(modal);

          const sub = await iGift.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_gift_create_promo_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const pCode = sub.fields.getTextInputValue('promo_code').toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
            const pCoins = parseInt(sub.fields.getTextInputValue('promo_coins')) || 0;
            const pItemId = sub.fields.getTextInputValue('promo_item_id').toUpperCase().trim() || null;
            const pItemQty = parseInt(sub.fields.getTextInputValue('promo_item_qty')) || 0;
            const pQuota = parseInt(sub.fields.getTextInputValue('promo_quota'));

            if (!pCode) {
              return sub.reply({ content: '❌ Kode promo tidak boleh kosong dan harus alfanumerik!', flags: 64 });
            }
            if (isNaN(pQuota)) {
              return sub.reply({ content: '❌ Kuota klaim harus berupa angka bulat (-1 untuk tanpa batas)!', flags: 64 });
            }

            const expiresAt = Math.floor(Date.now() / 1000) + 86400 * 7; // Aktif 7 hari

            // Simpan ke database
            const exist = database.get('SELECT 1 FROM promo_codes WHERE code = ?', [pCode]);
            if (exist) {
              database.run(
                'UPDATE promo_codes SET reward_coins = ?, reward_item_id = ?, reward_item_qty = ?, max_claims = ?, current_claims = 0, expires_at = ? WHERE code = ?',
                [pCoins, pItemId, pItemQty, pQuota, expiresAt, pCode]
              );
            } else {
              database.run(
                'INSERT INTO promo_codes (code, reward_coins, reward_item_id, reward_item_qty, max_claims, current_claims, expires_at) VALUES (?, ?, ?, ?, ?, 0, ?)',
                [pCode, pCoins, pItemId, pItemQty, pQuota, expiresAt]
              );
            }

            let rewardStr = '';
            if (pCoins > 0) rewardStr += `• 🪙 Koin: **Rp ${pCoins.toLocaleString('id-ID')}**\n`;
            if (pItemId && pItemQty > 0) rewardStr += `• 📦 Item: **${pItemQty}x \`${pItemId}\`**\n`;

            await sub.reply({
              content: `🎟️ **SUKSES MEMBUAT KODE PROMO!**\n\n` +
                `• Kode: **${pCode}**\n` +
                `• Kuota: **${pQuota === -1 ? 'Unlimited' : pQuota + ' orang'}**\n` +
                `• Berlaku s/d: <t:${expiresAt}:F> (<t:${expiresAt}:R>)\n` +
                `• Hadiah:\n${rewardStr || '• (Tidak ada hadiah)'}`,
              flags: 64
            });

            const fresh = getGiftPanelData(guildId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'gift_promo_list') {
          await iGift.deferReply({ flags: 64 });
          const promos = database.all('SELECT * FROM promo_codes ORDER BY created_at DESC LIMIT 10');
          if (promos.length === 0) {
            return iGift.editReply({ content: 'ℹ️ Belum ada kode promo terdaftar di database.' });
          }

          let listText = '🎟️ **DAFTAR KODE PROMO AKTIF (10 TERBARU):**\n\n';
          promos.forEach((p, idx) => {
            const limitText = p.max_claims === -1 ? 'Unlimited' : `${p.current_claims}/${p.max_claims}`;
            const timeText = p.expires_at > 0 ? `<t:${p.expires_at}:R>` : '`Abadi`';
            listText += `${idx + 1}. **${p.code}** — 👥 Klaim: \`${limitText}\` | ⏳ Exp: ${timeText}\n` +
              `   └ 🎁 Hadiah: Rp ${p.reward_coins.toLocaleString('id-ID')} koin ${p.reward_item_id ? `+ ${p.reward_item_qty}x \`${p.reward_item_id}\`` : ''}\n`;
          });

          const delSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_gift_promo_delete_select')
            .setPlaceholder('🗑️ Pilih Kode Promo yang Ingin Dihapus');

          promos.forEach(p => {
            delSelect.addOptions(
              new StringSelectMenuOptionBuilder()
                .setLabel(`Hapus: ${p.code}`)
                .setDescription(`Sita kode promo ${p.code}`)
                .setValue(p.code)
            );
          });

          const row = new ActionRowBuilder().addComponents(delSelect);
          const listMsg = await iGift.editReply({ content: listText, components: [row] });

          const delCollector = listMsg.createMessageComponentCollector({ time: 30000 });
          delCollector.on('collect', async iDel => {
            if (iDel.user.id !== author.id) return;
            const codeToDel = iDel.values[0];
            database.run('DELETE FROM promo_codes WHERE code = ?', [codeToDel]);
            database.run('DELETE FROM promo_claims WHERE code = ?', [codeToDel]);
            await iDel.reply({ content: `🗑️ Kode promo **${codeToDel}** beserta log klaimnya berhasil dihapus permanen!`, flags: 64 });
            delCollector.stop();
            await listMsg.delete().catch(() => {});
          });
        }
      }
    } catch (err) {
      console.error('Error in Gift Panel Interaction:', err);
      await iGift.reply({ content: `❌ Terjadi kesalahan: ${err.message}`, flags: 64 }).catch(() => { });
    }
  });

  collector.on('end', async (collected, reason) => {
    if (reason === 'transition') return;
    try {
      const fresh = getGiftPanelData(guildId);
      fresh.components = [];
      await replyMsg.edit(fresh).catch(() => { });
    } catch (e) { }
  });

  return true;
}

async function handleAdminSystemPanel(messageOrInteraction, client) {
  const isInteraction = !messageOrInteraction.author;
  const author = isInteraction ? messageOrInteraction.user : messageOrInteraction.author;
  const guildId = messageOrInteraction.guildId;

  if (!guildId) return false;

  const getSystemPanelData = (gId) => {
    const settings = getOrCreateEbyusSettings(gId);
    const maintStatusText = settings.maintenance_mode === 1 ? '🔴 **AKTIF (Bot Terkunci untuk Warga)**' : '🟢 **Nonaktif (Normal)**';

    let embed = new EmbedBuilder()
      .setColor(0x7C4DFF) // Royal Violet
      .setTitle('⚙️ ADMIN CONTROL PANEL — SISTEM & PEMELIHARAAN')
      .setThumbnail(client.user.displayAvatarURL())
      .setDescription(
        `Kelola performa sistem bot, backup/restore database, toggle mode pemeliharaan, atau kirim pengumuman resmi warga:\n\n` +
        `🔒 **Mode Pemeliharaan (Maintenance)**: ${maintStatusText}\n` +
        `🟢 **Status SQLite Engine**: \`SEHAT (Operational)\``
      )
      .setTimestamp()
      .setFooter({ text: 'Sentinel Admin • Sistem & Pemeliharaan' });

    const systemSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_system_select_action')
      .setPlaceholder('⚙️ Pilih Tindakan Pemeliharaan...');

    systemSelect.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('🔒 Toggle Mode Pemeliharaan (Maintenance)')
        .setDescription('Aktifkan/nonaktifkan mode pemeliharaan bot secara instan')
        .setValue('system_toggle_maintenance'),
      new StringSelectMenuOptionBuilder()
        .setLabel('📢 Broadcast Pengumuman Kustom (Modal)')
        .setDescription('Kirim pesan/embed pengumuman kustom ke channel berita')
        .setValue('system_custom_broadcast'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🎟️ Buat Kode Promo Baru (Modal)')
        .setDescription('Membuat kode voucher promo/redeem baru untuk warga')
        .setValue('system_create_promo'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🎟️ Kelola Kode Promo Aktif')
        .setDescription('Lihat daftar voucher aktif dan hapus voucher')
        .setValue('system_promo_list'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🪵 Lihat Log Konsol & Error PM2')
        .setDescription('Tampilkan 20 baris terakhir log konsol/error PM2 dari VPS')
        .setValue('system_view_logs'),
      new StringSelectMenuOptionBuilder()
        .setLabel('📊 Monitor Kesehatan Database')
        .setDescription('Tinjau ukuran berkas database, baris log, dan status tabel SQLite')
        .setValue('system_db_health'),
      new StringSelectMenuOptionBuilder()
        .setLabel('💾 Backup Database SQLite')
        .setDescription('Buat cadangan database ekonomi saat ini')
        .setValue('system_db_backup'),
      new StringSelectMenuOptionBuilder()
        .setLabel('💾 Restore Database SQLite')
        .setDescription('Pulihkan database dari cadangan yang tersedia')
        .setValue('system_db_restore'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🧹 Prune Log Transaksi Lama (>30 hari)')
        .setDescription('Hapus log transaksi lama untuk menghemat ruang')
        .setValue('system_db_prune')
    );

    const actionRow = new ActionRowBuilder().addComponents(systemSelect);

    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_system_btn_back')
        .setLabel('🔙 Kembali ke Hub')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('admin_system_btn_close')
        .setLabel('❌ Tutup Panel')
        .setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [actionRow, btnRow] };
  };

  const initialData = getSystemPanelData(guildId);
  let replyMsg;

  if (isInteraction) {
    await messageOrInteraction.update(initialData);
    replyMsg = messageOrInteraction.message;
  } else {
    replyMsg = await messageOrInteraction.reply(initialData);
  }

  const collector = replyMsg.createMessageComponentCollector({ time: 600000 });

  collector.on('collect', async iSystem => {
    const isOwner = iSystem.user.id === config.OWNER_ID;
    const isAdmin = iSystem.member && iSystem.member.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!isOwner && !isAdmin) {
      return iSystem.reply({ content: '❌ Akses Ditolak! Tombol/menu dashboard ini dikunci khusus untuk Owner utama & Administrator server.', flags: 64 });
    }

    try {
      if (iSystem.customId === 'admin_system_btn_back') {
        collector.stop('transition');
        await handleAdminPanel(iSystem, client);
      }
      else if (iSystem.customId === 'admin_system_btn_close') {
        collector.stop();
        await replyMsg.delete().catch(() => { });
      }
      else if (iSystem.customId === 'admin_system_select_action') {
        const action = iSystem.values[0];

        if (action === 'system_toggle_maintenance') {
          const settings = getOrCreateEbyusSettings(guildId);
          const newMaint = settings.maintenance_mode === 1 ? 0 : 1;
          database.run('UPDATE ebyus_settings SET maintenance_mode = ? WHERE guild_id = ?', [newMaint, guildId]);
          
          await iSystem.reply({
            content: `🔒 **MODE PEMELIHARAAN (MAINTENANCE) DIPERBARUI!**\n\nStatus saat ini: ${newMaint === 1 ? '🔴 **AKTIF (Bot terkunci untuk warga)**' : '🟢 **NONAKTIF (Normal)**'}\n\n*Admin dan Owner tetap dapat menggunakan bot.*`,
            flags: 64
          });
          const fresh = getSystemPanelData(guildId);
          await replyMsg.edit(fresh).catch(() => { });
        }
        else if (action === 'system_custom_broadcast') {
          const modal = new ModalBuilder()
            .setCustomId('admin_system_custom_broadcast_modal')
            .setTitle('Kirim Pengumuman Kustom');

          const chanInput = new TextInputBuilder()
            .setCustomId('bc_channel_id')
            .setLabel('ID Channel Berita / Announcement')
            .setPlaceholder('Masukkan ID Channel (Contoh: 1514736636628439151)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const titleInput = new TextInputBuilder()
            .setCustomId('bc_title')
            .setLabel('Judul Pengumuman')
            .setPlaceholder('Contoh: 🚀 PEMBARUAN FITUR BOT KOSAN')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const descInput = new TextInputBuilder()
            .setCustomId('bc_desc')
            .setLabel('Isi Pesan Pengumuman')
            .setPlaceholder('Tulis pesan pengumuman di sini...')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

          const mentionInput = new TextInputBuilder()
            .setCustomId('bc_mention')
            .setLabel('Mention (everyone / here / none)')
            .setPlaceholder('Ketik everyone, here, atau none')
            .setValue('none')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(chanInput),
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(descInput),
            new ActionRowBuilder().addComponents(mentionInput)
          );
          await iSystem.showModal(modal);

          const sub = await iSystem.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_system_custom_broadcast_modal' && s.user.id === author.id,
            time: 120000
          }).catch(() => null);

          if (sub) {
            const targetChanId = sub.fields.getTextInputValue('bc_channel_id').trim();
            const bcTitle = sub.fields.getTextInputValue('bc_title').trim();
            const bcDesc = sub.fields.getTextInputValue('bc_desc').trim();
            const bcMention = sub.fields.getTextInputValue('bc_mention').trim().toLowerCase();

            const targetChan = client.channels.cache.get(targetChanId) 
              || await client.channels.fetch(targetChanId).catch(() => null);

            if (!targetChan) {
              return sub.reply({ content: `❌ Channel dengan ID \`${targetChanId}\` tidak ditemukan atau bot tidak memiliki akses ke sana!`, flags: 64 });
            }

            const bcEmbed = new EmbedBuilder()
              .setColor(0x00FF88)
              .setTitle(bcTitle)
              .setDescription(bcDesc)
              .setTimestamp()
              .setFooter({ text: `Sentinel Broadcast • Administrator ${author.username}` });

            let mentionContent = '';
            if (bcMention === 'everyone') mentionContent = '@everyone';
            else if (bcMention === 'here') mentionContent = '@here';

            await targetChan.send({ content: mentionContent || undefined, embeds: [bcEmbed] });

            await sub.reply({ content: `📢 **PENGUMUMAN BERHASIL DISIARKAN!**\n\nDikirim ke channel: <#${targetChanId}>`, flags: 64 });
          }
        }
        else if (action === 'system_create_promo') {
          const modal = new ModalBuilder()
            .setCustomId('admin_system_create_promo_modal')
            .setTitle('Buat Kode Promo Baru');

          const codeInput = new TextInputBuilder()
            .setCustomId('promo_code')
            .setLabel('Kode Promo (Alfanumerik)')
            .setPlaceholder('Contoh: KOSANMANTAP2026')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const coinsInput = new TextInputBuilder()
            .setCustomId('promo_coins')
            .setLabel('Hadiah Koin (0 jika tidak ada)')
            .setPlaceholder('Contoh: 5000')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const itemInput = new TextInputBuilder()
            .setCustomId('promo_item_id')
            .setLabel('ID Item Hadiah (Kosongkan jika tidak ada)')
            .setPlaceholder('Contoh: FOOD_PREMIUM atau LOCKPICK')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

          const qtyInput = new TextInputBuilder()
            .setCustomId('promo_item_qty')
            .setLabel('Jumlah Item Hadiah (0 jika tidak ada)')
            .setPlaceholder('Contoh: 3')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

          const quotaInput = new TextInputBuilder()
            .setCustomId('promo_quota')
            .setLabel('Kuota Klaim (-1 untuk tanpa batas)')
            .setPlaceholder('Contoh: 50')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(codeInput),
            new ActionRowBuilder().addComponents(coinsInput),
            new ActionRowBuilder().addComponents(itemInput),
            new ActionRowBuilder().addComponents(qtyInput),
            new ActionRowBuilder().addComponents(quotaInput)
          );
          await iSystem.showModal(modal);

          const sub = await iSystem.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_system_create_promo_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const pCode = sub.fields.getTextInputValue('promo_code').toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
            const pCoins = parseInt(sub.fields.getTextInputValue('promo_coins')) || 0;
            const pItemId = sub.fields.getTextInputValue('promo_item_id').toUpperCase().trim() || null;
            const pItemQty = parseInt(sub.fields.getTextInputValue('promo_item_qty')) || 0;
            const pQuota = parseInt(sub.fields.getTextInputValue('promo_quota'));

            if (!pCode) {
              return sub.reply({ content: '❌ Kode promo tidak boleh kosong dan harus alfanumerik!', flags: 64 });
            }
            if (isNaN(pQuota)) {
              return sub.reply({ content: '❌ Kuota klaim harus berupa angka bulat (-1 untuk tanpa batas)!', flags: 64 });
            }

            const expiresAt = Math.floor(Date.now() / 1000) + 86400 * 7; // Aktif 7 hari

            // Simpan ke database
            const exist = database.get('SELECT 1 FROM promo_codes WHERE code = ?', [pCode]);
            if (exist) {
              database.run(
                'UPDATE promo_codes SET reward_coins = ?, reward_item_id = ?, reward_item_qty = ?, max_claims = ?, current_claims = 0, expires_at = ? WHERE code = ?',
                [pCoins, pItemId, pItemQty, pQuota, expiresAt, pCode]
              );
            } else {
              database.run(
                'INSERT INTO promo_codes (code, reward_coins, reward_item_id, reward_item_qty, max_claims, current_claims, expires_at) VALUES (?, ?, ?, ?, ?, 0, ?)',
                [pCode, pCoins, pItemId, pItemQty, pQuota, expiresAt]
              );
            }

            let rewardStr = '';
            if (pCoins > 0) rewardStr += `• 🪙 Koin: **Rp ${pCoins.toLocaleString('id-ID')}**\n`;
            if (pItemId && pItemQty > 0) rewardStr += `• 📦 Item: **${pItemQty}x \`${pItemId}\`**\n`;

            await sub.reply({
              content: `🎟️ **SUKSES MEMBUAT KODE PROMO!**\n\n` +
                `• Kode: **${pCode}**\n` +
                `• Kuota: **${pQuota === -1 ? 'Unlimited' : pQuota + ' orang'}**\n` +
                `• Berlaku s/d: <t:${expiresAt}:F> (<t:${expiresAt}:R>)\n` +
                `• Hadiah:\n${rewardStr || '• (Tidak ada hadiah)'}`,
              flags: 64
            });

            const fresh = getSystemPanelData(guildId);
            await replyMsg.edit(fresh).catch(() => { });
          }
        }
        else if (action === 'system_promo_list') {
          await iSystem.deferReply({ flags: 64 });
          const promos = database.all('SELECT * FROM promo_codes ORDER BY created_at DESC LIMIT 10');
          if (promos.length === 0) {
            return iSystem.editReply({ content: 'ℹ️ Belum ada kode promo terdaftar di database.' });
          }

          let listText = '🎟️ **DAFTAR KODE PROMO AKTIF (10 TERBARU):**\n\n';
          promos.forEach((p, idx) => {
            const limitText = p.max_claims === -1 ? 'Unlimited' : `${p.current_claims}/${p.max_claims}`;
            const timeText = p.expires_at > 0 ? `<t:${p.expires_at}:R>` : '`Abadi`';
            listText += `${idx + 1}. **${p.code}** — 👥 Klaim: \`${limitText}\` | ⏳ Exp: ${timeText}\n` +
              `   └ 🎁 Hadiah: Rp ${p.reward_coins.toLocaleString('id-ID')} koin ${p.reward_item_id ? `+ ${p.reward_item_qty}x \`${p.reward_item_id}\`` : ''}\n`;
          });

          const delSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_system_promo_delete_select')
            .setPlaceholder('🗑️ Pilih Kode Promo yang Ingin Dihapus');

          promos.forEach(p => {
            delSelect.addOptions(
              new StringSelectMenuOptionBuilder()
                .setLabel(`Hapus: ${p.code}`)
                .setDescription(`Sita kode promo ${p.code}`)
                .setValue(p.code)
            );
          });

          const selectRow = new ActionRowBuilder().addComponents(delSelect);
          const listMsg = await iSystem.editReply({ content: listText, components: [selectRow] });

          const delCollector = listMsg.createMessageComponentCollector({
            filter: (d) => d.customId === 'admin_system_promo_delete_select' && d.user.id === author.id,
            time: 30000,
            max: 1
          });

          delCollector.on('collect', async (iDel) => {
            const codeToDel = iDel.values[0];
            database.run('DELETE FROM promo_codes WHERE code = ?', [codeToDel]);
            database.run('DELETE FROM promo_claims WHERE code = ?', [codeToDel]);
            await iDel.reply({ content: `🗑️ Kode promo **${codeToDel}** beserta log klaimnya berhasil dihapus!`, flags: 64 });
            await listMsg.delete().catch(() => { });
          });
        }
        else if (action === 'system_view_logs') {
          await iSystem.deferReply({ flags: 64 });
          
          const logSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_system_log_process_select')
            .setPlaceholder('🪵 Pilih Proses PM2 untuk Dilihat Log-nya');

          logSelect.addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel('🤖 Bot Discord (bot-2026)')
              .setDescription('Log aktivitas chat, perintah, dan error game')
              .setValue('bot-2026'),
            new StringSelectMenuOptionBuilder()
              .setLabel('⚙️ Admin Panel (admin-panel-2026)')
              .setDescription('Log aktivitas panel admin dan dashboard')
              .setValue('admin-panel-2026')
          );

          const row = new ActionRowBuilder().addComponents(logSelect);
          const logMsg = await iSystem.editReply({
            content: '🪵 **LOGGER LOG KONSOL & ERROR PM2** 🪵\n\nSilakan pilih proses bot yang ingin Anda lihat log konsolnya di bawah ini:',
            components: [row]
          });

          const logCollector = logMsg.createMessageComponentCollector({ time: 60000 });
          logCollector.on('collect', async iLogProc => {
            if (iLogProc.user.id !== author.id) return;
            const processName = iLogProc.values[0];
            await iLogProc.deferUpdate();

            const { exec } = require('child_process');
            exec(`tail -n 15 ~/.pm2/logs/${processName}-out.log ~/.pm2/logs/${processName}-error.log`, (error, stdout, stderr) => {
              let logOutput = '';
              if (error) {
                logOutput += `❌ Gagal mengambil log PM2 untuk ${processName}: ${error.message}\n`;
              }
              if (stderr) {
                logOutput += `stderr:\n${stderr}\n`;
              }
              if (stdout) {
                logOutput += stdout;
              }

              // Sanitasi
              const sanitizedLogs = logOutput
                .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '') // Strip escape colors
                .substring(0, 1900);

              const logsEmbed = new EmbedBuilder()
                .setColor(0xFFA000)
                .setTitle(`🪵 LOG KONSOL PM2 (${processName})`)
                .setDescription(`\`\`\`log\n${sanitizedLogs || 'Tidak ada log yang terekam.'}\n\`\`\``)
                .setTimestamp()
                .setFooter({ text: `Sentinel Log System • ${processName}` });

              iLogProc.editReply({
                content: `✅ Berikut adalah log terbaru dari **${processName}**:`,
                embeds: [logsEmbed],
                components: []
              }).catch(() => {});
            });

            logCollector.stop();
          });
        }
        else if (action === 'system_db_health') {
          await iSystem.deferReply({ flags: 64 });
          try {
            const fs = require('fs');
            const path = require('path');
            
            // Check Database Size
            const dbPath = config.DATABASE_PATH;
            const stats = fs.statSync(dbPath);
            const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
            
            // Row counts
            const walletsCount = (database.get('SELECT COUNT(*) as count FROM wallets') || { count: 0 }).count;
            const petsCount = (database.get('SELECT COUNT(*) as count FROM user_pets') || { count: 0 }).count;
            const transCount = (database.get('SELECT COUNT(*) as count FROM transactions') || { count: 0 }).count;
            const logsCount = (database.get('SELECT COUNT(*) as count FROM user_pet_logs') || { count: 0 }).count;
            
            // Backups count
            const backupsDir = path.join(__dirname, '../backups');
            const backupsCount = fs.existsSync(backupsDir) ? fs.readdirSync(backupsDir).filter(f => f.endsWith('.db')).length : 0;
            
            const healthEmbed = new EmbedBuilder()
              .setColor(0x00E5FF)
              .setTitle('📊 DASHBOARD MONITOR KESEHATAN DATABASE')
              .setDescription(
                `Berikut adalah status kesehatan dan statistik database SQLite Sentinel Bot:\n\n` +
                `📁 **Info Berkas Database:**\n` +
                `• File Path: \`${dbPath}\`\n` +
                `• Ukuran Berkas: \`${sizeMb} MB\`\n` +
                `• Total File Cadangan (Backups): \`${backupsCount} file cadangan\`\n\n` +
                `📊 **Statistik Baris Data:**\n` +
                `• Warga Terdaftar (wallets): \`${walletsCount} baris\`\n` +
                `• Total Pet Terdaftar (user_pets): \`${petsCount} baris\`\n` +
                `• Total Log Transaksi (transactions): \`${transCount} baris\`\n` +
                `• Total Log Aktivitas Pet (user_pet_logs): \`${logsCount} baris\`\n\n` +
                `🟢 **Status SQLite Engine**: \`SEHAT (Operational)\``
              )
              .setTimestamp()
              .setFooter({ text: 'Sentinel Database Health Monitor' });
              
            await iSystem.editReply({ embeds: [healthEmbed] });
          } catch (healthErr) {
            console.error('Database health check failed:', healthErr);
            await iSystem.editReply({ content: `❌ Gagal memuat data kesehatan database: ${healthErr.message}` });
          }
        }
        else if (action === 'system_db_backup') {
          await iSystem.deferReply({ flags: 64 });
          try {
            const fs = require('fs');
            const path = require('path');
            const backupsDir = path.join(__dirname, '../backups');
            if (!fs.existsSync(backupsDir)) {
              fs.mkdirSync(backupsDir, { recursive: true });
            }
            const timestamp = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').substring(0, 19);
            const backupFile = path.join(backupsDir, `economy_backup_${timestamp}.db`);
            
            fs.copyFileSync(config.DATABASE_PATH, backupFile);

            await iSystem.editReply({ content: `💾 **BACKUP DATABASE SUKSES!**\n\nDatabase saat ini telah dicadangkan secara aman ke:\n\`${backupFile}\`` });
          } catch (err) {
            console.error('Backup database failed:', err);
            await iSystem.editReply({ content: `❌ Gagal mem-backup database: ${err.message}` });
          }
        }
        else if (action === 'system_db_restore') {
          await iSystem.deferReply({ flags: 64 });
          const fs = require('fs');
          const path = require('path');
          const backupsDir = path.join(__dirname, '../backups');
          if (!fs.existsSync(backupsDir) || fs.readdirSync(backupsDir).length === 0) {
            return iSystem.editReply({ content: 'ℹ️ Tidak ditemukan berkas cadangan database di folder backups.' });
          }

          const files = fs.readdirSync(backupsDir)
            .filter(f => f.endsWith('.db'))
            .sort((a, b) => fs.statSync(path.join(backupsDir, b)).mtimeMs - fs.statSync(path.join(backupsDir, a)).mtimeMs)
            .slice(0, 5);

          if (files.length === 0) {
            return iSystem.editReply({ content: 'ℹ️ Tidak ditemukan berkas cadangan (.db) di folder backups.' });
          }

          const restoreSelect = new StringSelectMenuBuilder()
            .setCustomId('admin_system_restore_file_select')
            .setPlaceholder('💾 Pilih Berkas Cadangan untuk Di-restore');

          files.forEach(f => {
            const size = fs.statSync(path.join(backupsDir, f)).size;
            const sizeKb = Math.round(size / 1024);
            restoreSelect.addOptions(
              new StringSelectMenuOptionBuilder()
                .setLabel(f.substring(0, 80))
                .setDescription(`Ukuran: ${sizeKb} KB`)
                .setValue(f)
            );
          });

          const row = new ActionRowBuilder().addComponents(restoreSelect);
          const restoreMsg = await iSystem.editReply({
            content: '⚠️ **RESTORE DATABASE (KRITIS)** ⚠️\n\nPilih berkas cadangan di bawah ini untuk dipulihkan. Tindakan ini akan menutup koneksi database aktif saat ini dan menimpa database utama!',
            components: [row]
          });

          const restoreCollector = restoreMsg.createMessageComponentCollector({ time: 30000 });
          restoreCollector.on('collect', async iRestore => {
            if (iRestore.user.id !== author.id) return;
            const fileToRestore = iRestore.values[0];
            const backupPath = path.join(backupsDir, fileToRestore);

            const confirmed = await askConfirmation(iRestore, author.id, `RESTORE DATABASE UTAMA MENGGUNAKAN CADANGAN \`${fileToRestore}\``);
            if (!confirmed) {
              restoreCollector.stop();
              return;
            }

            try {
              database.restoreBackup(backupPath);
              await iRestore.followUp({ content: `✅ **RESTORE DATABASE BERHASIL!** Database utama telah dipulihkan menggunakan cadangan \`${fileToRestore}\`.`, flags: 64 });
            } catch (restoreErr) {
              console.error('Failed to restore backup:', restoreErr);
              await iRestore.followUp({ content: `❌ Gagal merestore backup: ${restoreErr.message}`, flags: 64 });
            }

            restoreCollector.stop();
            await restoreMsg.delete().catch(() => {});
          });
        }
        else if (action === 'system_db_prune') {
          const confirmed = await askConfirmation(iSystem, author.id, "MEMBERSIHKAN LOG TRANSAKSI lama (>30 hari terakhir) untuk optimasi ukuran DB");
          if (!confirmed) return;

          try {
            const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 86400;
            database.run('DELETE FROM transactions WHERE created_at < ?', [thirtyDaysAgo]);
            await iSystem.followUp({ content: `🧹 **PRUNING SUKSES!** Berhasil menghapus baris log transaksi lama yang berumur lebih dari 30 hari.`, flags: 64 });
          } catch (pruneErr) {
            console.error('Pruning failed:', pruneErr);
            await iSystem.followUp({ content: `❌ Gagal melakukan pruning: ${pruneErr.message}`, flags: 64 });
          }
        }
      }
    } catch (err) {
      console.error('Error in System Panel Interaction:', err);
      await iSystem.reply({ content: `❌ Terjadi kesalahan: ${err.message}`, flags: 64 }).catch(() => { });
    }
  });

  collector.on('end', async (collected, reason) => {
    if (reason === 'transition') return;
    try {
      const fresh = getSystemPanelData(guildId);
      fresh.components = [];
      await replyMsg.edit(fresh).catch(() => { });
    } catch (e) { }
  });

  return true;
}

module.exports = {
  handleAdminPanel,
  handleAdminTournamentPanel,
  handleAdminTournamentGlobalInteraction,
  updatePersistentTournamentPanel,
  handleAdminPetPanel,
  handleAdminBankPanel,
  handleAdminRobberyPanel,
  handleAdminSahamPanel,
  handleAdminAbyusPanel,
  handleAdminShopPanel,
  handleAdminTrollPanel,
  handleAdminGardenPanel,
  handleAdminQuestPanel,
  handleAdminWargaPanel,
  handleAdminGiftPanel,
  handleAdminSystemPanel,
  isOwnerGodModeActive,
  isOwnerProtectionActive,
  toggleOwnerProtection,
  toggleOwnerGodMode,
  isAntiJailActive,
  toggleAntiJail
};
