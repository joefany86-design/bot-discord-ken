const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } = require('discord.js');
const db = require('./database');
const { logPetAction } = db;
const economy = require('./economy');
const embeds = require('./embeds');
const pet = require('./pet');
const petCard = require('./petCard');

// Mock Map untuk menjaga kompatibilitas ekspor (tidak lagi dipakai untuk state utama)
const activeSafaris = new Map();

// Helper to release channel lock for Safari
function releaseLock(client, channelId) {
  if (client && client.safariLocks) {
    client.safariLocks.delete(channelId);
  }
}

// Helper untuk mengakhiri sesi safari, mengirim notifikasi hasil akhir, dan menghapus thread sementara
async function endSafariSession(interaction, state, author, client, result) {
  try {
    deleteSafariState(author.id, state.guildId);
    releaseLock(client, state.channelId);

    const thread = client.channels.cache.get(state.channelId) || await client.channels.fetch(state.channelId).catch(() => null);
    if (thread && thread.isThread()) {
      const parentChannel = thread.parent || await client.channels.fetch(thread.parentId).catch(() => null);
      if (parentChannel) {
        if (typeof result === 'string') {
          await parentChannel.send({ content: result }).catch(() => {});
        } else if (result && result.embeds) {
          await parentChannel.send({ content: `<@${author.id}>`, ...result }).catch(() => {});
        } else if (result) {
          await parentChannel.send({ content: `<@${author.id}>`, embeds: [result] }).catch(() => {});
        }
      }
      setTimeout(async () => {
        await thread.delete().catch(() => {});
      }, 3000);
    } else {
      const payload = typeof result === 'string'
        ? { content: result, embeds: [], components: [] }
        : (result && result.embeds ? { embeds: result.embeds, components: [] } : { embeds: [result], components: [] });

      if (interaction) {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(payload).catch(() => {});
        } else {
          await interaction.update(payload).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error('Error in endSafariSession:', err);
  }
}

// Helper untuk merespon interaksi yang mungkin sudah di-defer atau dikirim
async function safeReply(interaction, payload) {
  try {
    if (interaction.deferred || interaction.replied) {
      return await interaction.followUp(payload);
    } else {
      return await interaction.reply(payload);
    }
  } catch (err) {
    console.error('safeReply error:', err);
  }
}

// Konfigurasi Biome Safari
const BIOMES = {
  forest: {
    id: 'forest',
    name: '🌳 Hutan Hijau (Green Forest)',
    cost: 0,
    catchMultiplier: 1.0,
    escapeMultiplier: 1.0,
    species: ['SLIME', 'CAT', 'GOLEM'],
    color: 0x2ECC71,
    description: 'Wilayah hutan rindang yang tenang. Sangat ramah pemula. **Gratis masuk!**\n🐾 *Spesies liar: Slime, Kucing, Golem*'
  },
  volcano: {
    id: 'volcano',
    name: '🌋 Lembah Volcanic (Volcanic Valley)',
    cost: 150,
    catchMultiplier: 0.85,
    escapeMultiplier: 1.1,
    species: ['DRAGON', 'PHOENIX', 'KITSUNE', 'BEHEMOTH', 'CERBERUS', 'IFRIT'],
    color: 0xE74C3C,
    description: 'Lembah lava membara dengan suhu ekstrem. Dihuni makhluk berelemen api.\n🪙 **Biaya Masuk:** **Rp 150**\n🐾 *Spesies liar: Naga, Phoenix, Kitsune, Behemoth, Cerberus, Ifrit*'
  },
  abyss: {
    id: 'abyss',
    name: '🌊 Danau Abyss (Abyss Lake)',
    cost: 150,
    catchMultiplier: 0.85,
    escapeMultiplier: 1.1,
    species: ['TURTLE', 'SIREN', 'YETI', 'LEVIATHAN', 'VALKYRIE'],
    color: 0x3498DB,
    description: 'Danau purba dalam dengan pusaran air berbahaya. Dihuni makhluk air dan bumi.\n🪙 **Biaya Masuk:** **Rp 150**\n🐾 *Spesies liar: Kura-Kura, Siren, Yeti, Leviathan, Valkyrie*'
  },
  mountain: {
    id: 'mountain',
    name: '⛰️ Pegunungan Kuno (Ancient Peak)',
    cost: 250,
    catchMultiplier: 0.70,
    escapeMultiplier: 1.25,
    species: ['PEGASUS', 'KIRIN', 'BEHEMOTH', 'ARCHDRAGON', 'TYPHON'],
    color: 0x9B59B6,
    description: 'Puncak tertinggi bersalju abadi. Tempat persemayaman naga purba kosmik.\n🪙 **Biaya Masuk:** **Rp 250**\n🐾 *Spesies liar: Pegasus, Kirin, Behemoth, Archdragon, Typhon*'
  },
  desert: {
    id: 'desert',
    name: '🏜️ Gurun Sunyi (Silent Desert)',
    cost: 200,
    catchMultiplier: 0.80,
    escapeMultiplier: 1.20,
    species: ['KIRIN', 'KITSUNE', 'CERBERUS', 'GOLEM', 'IFRIT'],
    color: 0xF1C40F,
    description: 'Gurun pasir tandus yang menyimpan sisa-sisa peradaban kuno. Hati-hati badai pasir!\n🪙 **Biaya Masuk:** **Rp 200**\n🐾 *Spesies liar: Kirin, Kitsune, Cerberus, Golem, Ifrit*'
  }
};

// SQLite Helpers untuk State Sesi Aktif
function loadSafariState(userId, guildId) {
  try {
    const row = db.get('SELECT * FROM active_safaris WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
    if (!row) return null;
    return {
      userId: row.user_id,
      guildId: row.guild_id,
      channelId: row.channel_id,
      biome: row.biome,
      pet: JSON.parse(row.pet_data),
      balls: row.balls,
      baits: row.baits,
      toys: row.toys,
      baitFed: row.bait_fed,
      turns: row.turns,
      sneakCount: row.sneak_count,
      sleepTurns: row.sleep_turns,
      catchBonus: row.catch_bonus,
      escapeBonus: row.escape_bonus,
      sneakPenalty: row.sneak_penalty,
      toyBonus: row.toy_bonus,
      specialTraitApplied: row.special_trait_applied === 1,
      weather: row.weather || 'CERAH',
      logs: JSON.parse(row.logs)
    };
  } catch (err) {
    console.error('Error loading Safari state:', err);
    return null;
  }
}

function saveSafariState(userId, guildId, state) {
  try {
    const petData = JSON.stringify(state.pet);
    const logsData = JSON.stringify(state.logs);
    const exists = db.get('SELECT 1 FROM active_safaris WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
    if (exists) {
      db.run(`
        UPDATE active_safaris 
        SET channel_id = ?, biome = ?, pet_data = ?, balls = ?, baits = ?, toys = ?, bait_fed = ?, 
            turns = ?, sneak_count = ?, sleep_turns = ?, catch_bonus = ?, escape_bonus = ?, 
            sneak_penalty = ?, toy_bonus = ?, special_trait_applied = ?, weather = ?, logs = ?
        WHERE user_id = ? AND guild_id = ?
      `, [
        state.channelId, state.biome, petData, state.balls, state.baits, state.toys, state.baitFed,
        state.turns, state.sneakCount, state.sleepTurns, state.catchBonus, state.escapeBonus,
        state.sneakPenalty, state.toyBonus, state.specialTraitApplied ? 1 : 0, state.weather, logsData,
        userId, guildId
      ]);
    } else {
      db.run(`
        INSERT INTO active_safaris (user_id, guild_id, channel_id, biome, pet_data, balls, baits, toys, bait_fed,
                                   turns, sneak_count, sleep_turns, catch_bonus, escape_bonus, sneak_penalty,
                                   toy_bonus, special_trait_applied, weather, logs)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userId, guildId, state.channelId, state.biome, petData, state.balls, state.baits, state.toys, state.baitFed,
        state.turns, state.sneakCount, state.sleepTurns, state.catchBonus, state.escapeBonus, state.sneakPenalty,
        state.toyBonus, state.specialTraitApplied ? 1 : 0, state.weather, logsData
      ]);
    }
  } catch (err) {
    console.error('Error saving Safari state:', err);
  }
}

function deleteSafariState(userId, guildId) {
  try {
    db.run('DELETE FROM active_safaris WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  } catch (err) {
    console.error('Error deleting Safari state:', err);
  }
}

// SQLite Helpers untuk Cooldown
function getSafariCooldown(userId, guildId) {
  try {
    const row = db.get('SELECT cooldown_until FROM safari_cooldowns WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
    return row ? row.cooldown_until : 0;
  } catch (err) {
    console.error('Error loading Safari cooldown:', err);
    return 0;
  }
}

function setSafariCooldown(userId, guildId, cooldownUntil) {
  try {
    const exists = db.get('SELECT 1 FROM safari_cooldowns WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
    if (exists) {
      db.run('UPDATE safari_cooldowns SET cooldown_until = ? WHERE user_id = ? AND guild_id = ?', [cooldownUntil, userId, guildId]);
    } else {
      db.run('INSERT INTO safari_cooldowns (user_id, guild_id, cooldown_until) VALUES (?, ?, ?)', [userId, guildId, cooldownUntil]);
    }
  } catch (err) {
    console.error('Error setting Safari cooldown:', err);
  }
}

/**
 * Memberikan Safari XP dan memproses level up untuk Master Berburu
 */
function addSafariXp(userId, guildId, xpAmount) {
  let levelUpMsg = '';
  let currentLvl = 1;
  let currentXp = 0;
  db.transaction(() => {
    const row = db.get('SELECT safari_level, safari_xp FROM wallets WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
    if (row) {
      currentLvl = row.safari_level || 1;
      currentXp = row.safari_xp || 0;
    }
    
    currentXp += xpAmount;
    
    while (currentXp >= currentLvl * 100) {
      currentXp -= currentLvl * 100;
      currentLvl += 1;
      levelUpMsg = `\n🎉 **LEVEL UP MASTER BERBURU!** Tingkat Safari Anda sekarang adalah **Level ${currentLvl}**!`;
    }
    
    db.run(
      'UPDATE wallets SET safari_level = ?, safari_xp = ? WHERE user_id = ? AND guild_id = ?',
      [currentLvl, currentXp, userId, guildId]
    );
  })();
  return { newLevel: currentLvl, newXp: currentXp, levelUpMsg };
}

/**
 * Membuat data pet liar secara acak berdasarkan biome
 */
function generateWildPet(biomeId) {
  const biome = BIOMES[biomeId];
  
  // Hitung bobot untuk masing-masing spesies berdasarkan GACHA_RATES
  let totalWeight = 0;
  const weights = biome.species.map(specId => {
    const specInfo = pet.GACHA_SPECIES[specId];
    if (!specInfo) return 0;
    const weight = pet.GACHA_RATES[specInfo.rarity] || 0.65;
    totalWeight += weight;
    return weight;
  });

  // Pilih spesies berdasarkan acakan berbobot
  let roll = Math.random() * totalWeight;
  let speciesId = biome.species[0]; // Fallback ke elemen pertama jika gagal
  for (let i = 0; i < biome.species.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      speciesId = biome.species[i];
      break;
    }
  }

  const speciesInfo = pet.GACHA_SPECIES[speciesId];
  
  let rarity = speciesInfo.rarity;
  let trait = '';
  
  // Modifikasi raritas & trait untuk spesies dasar (Slime, Cat, Golem)
  if (['CAT', 'GOLEM', 'SLIME'].includes(speciesId)) {
    if (Math.random() < 0.30) {
      rarity = 'RARE';
      const traits = ['GENIUS', 'STURDY', 'MUTANT', 'WARRIOR'];
      trait = traits[Math.floor(Math.random() * traits.length)];
    } else {
      rarity = 'COMMON';
    }
  } else if (rarity === 'RARE') {
    const traits = ['GENIUS', 'STURDY', 'MUTANT', 'WARRIOR'];
    trait = traits[Math.floor(Math.random() * traits.length)];
  } else if (rarity === 'EPIC') {
    trait = 'SURVIVOR';
  } else if (rarity === 'LEGENDARY') {
    const traits = ['GENIUS', 'STURDY', 'MUTANT', 'WARRIOR', 'SURVIVOR'];
    trait = traits[Math.floor(Math.random() * traits.length)];
  }

  const level = Math.floor(Math.random() * 15) + 1;
  const element = speciesInfo.element || 'EARTH';

  let baseCatch = 0.40;
  let baseEscape = 0.10;
  let emoji = '⚪';
  
  if (rarity === 'RARE') {
    baseCatch = 0.25;
    baseEscape = 0.15;
    emoji = '🟢';
  } else if (rarity === 'EPIC') {
    baseCatch = 0.15;
    baseEscape = 0.20;
    emoji = '🟣';
  } else if (rarity === 'LEGENDARY') {
    baseCatch = 0.05;
    baseEscape = 0.50;
    emoji = '🟡';
  }

  let ivMin = 1;
  if (rarity === 'RARE') ivMin = 5;
  else if (rarity === 'EPIC') ivMin = 8;
  else if (rarity === 'LEGENDARY') ivMin = 10;
  
  const iv_str = Math.floor(Math.random() * (16 - ivMin)) + ivMin;
  const iv_vit = Math.floor(Math.random() * (16 - ivMin)) + ivMin;
  const iv_dex = Math.floor(Math.random() * (16 - ivMin)) + ivMin;

  return {
    speciesId,
    name: speciesInfo.name.replace(/^\S+\s+/, ''), // Hapus emoji untuk nama
    typeName: speciesInfo.name,
    rarity,
    trait,
    element,
    level,
    baseCatch,
    baseEscape,
    emoji,
    description: speciesInfo.desc,
    gacha_element: element,
    pet_type: speciesId,
    status: 'ADULT', // Untuk rendering GIF dari embeds.js
    iv_str,
    iv_vit,
    iv_dex
  };
}

/**
 * Handle komando .pet safari / .safari
 */
async function handlePetSafariCommand(message, client, args) {
  const { author, guildId } = message;

  // Hanya izinkan di channel ID 1513927968379109436 atau channel test 1503324994153873458
  if (message.channelId !== '1513927968379109436' && message.channelId !== '1503324994153873458') {
    return message.reply({ embeds: [embeds.safariChannelRestrictionEmbed()] });
  }

  // Cek apakah ada sesi safari aktif di database
  const existingState = loadSafariState(author.id, guildId);
  if (existingState) {
    const thread = client.channels.cache.get(existingState.channelId) || await client.channels.fetch(existingState.channelId).catch(() => null);
    if (!thread) {
      deleteSafariState(author.id, guildId);
    } else {
      const replyMsg = await thread.send({ content: `🔄 **Melanjutkan Sesi Safari Sebelumnya yang Belum Selesai, <@${author.id}>...**` }).catch(() => null);
      if (replyMsg) {
        await message.reply({ content: `🔄 **Safari dilanjutkan!** Silakan masuk ke area berburu Anda di <#${thread.id}>.` }).catch(() => {});
        return renderSafariScreen(message, replyMsg, existingState, author, client);
      } else {
        deleteSafariState(author.id, guildId);
      }
    }
  }

  // Cek Cooldown (3 Menit) dari database SQLite
  const now = Date.now();
  const cooldownEnd = getSafariCooldown(author.id, guildId);
  if (now < cooldownEnd) {
    const epochSec = Math.floor(cooldownEnd / 1000);
    return message.reply({ content: `⏳ **Safari dalam Cooldown!** Anda terlalu lelah untuk menjelajah. Harap tunggu <t:${epochSec}:R> lagi.` });
  }

  // Get hunting mastery stats from db
  let mastery = { level: 1, xp: 0 };
  try {
    const walletRow = db.get('SELECT safari_level, safari_xp FROM wallets WHERE user_id = ? AND guild_id = ?', [author.id, guildId]);
    if (walletRow) {
      mastery.level = walletRow.safari_level || 1;
      mastery.xp = walletRow.safari_xp || 0;
    }
  } catch (err) {
    console.error('Error fetching safari mastery:', err);
  }

  // Biome Selection Panel
  const biomeEmbed = new EmbedBuilder()
    .setColor(0x2ECC71) // Nature green
    .setTitle('🌳 PET SAFARI ADVENTURE 🦁')
    .setDescription(
      `Halo Warga **${message.guild.name}**! Selamat datang di **Safari Pet Liar**.\n` +
      `Di sini Anda bisa menjelajahi berbagai wilayah untuk melacak dan menangkap pet liar yang legendaris secara interaktif!\n\n` +
      `🎯 **Safari Mastery Anda:**\n` +
      `• Level Berburu: \`Lv.${mastery.level}\`\n` +
      `• XP Berburu: \`${mastery.xp} XP\`\n\n` +
      `Silakan pilih biome wilayah yang ingin Anda jelajahi di bawah ini:`
    )
    .setFooter({ text: 'Gunakan tombol di bawah untuk masuk ke biome | Cooldown 3 menit' })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('safari_biome_forest').setLabel('🌳 Forest').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('safari_biome_volcano').setLabel('🌋 Volcano').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('safari_biome_abyss').setLabel('🌊 Abyss').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('safari_biome_mountain').setLabel('⛰️ Peak').setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('safari_biome_desert').setLabel('🏜️ Desert').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('safari_biome_cancel').setLabel('✖️ Batalkan').setStyle(ButtonStyle.Secondary)
  );

  const replyMsg = await message.reply({
    embeds: [biomeEmbed],
    components: [row1, row2]
  });
  const collector = replyMsg.createMessageComponentCollector({ time: 60000 });

  collector.on('collect', async i => {
    try {
      if (i.user.id !== author.id) {
        return await safeReply(i, { content: '❌ Pilihan ini bukan milik Anda!', flags: 64 });
      }

      if (i.customId === 'safari_biome_cancel') {
        collector.stop();
        releaseLock(client, message.channelId);
        return i.update({ content: '❌ Petualangan Safari dibatalkan.', embeds: [], components: [], files: [] });
      }

      // Defer update immediately to prevent "Interaction failed" (3-second timeout) during processing
      await i.deferUpdate().catch(() => {});

      const selectedBiomeKey = i.customId.replace('safari_biome_', '');
      const biome = BIOMES[selectedBiomeKey];

      if (!biome) return;

      // Cek Koin untuk Biaya Masuk & Potong Koin menggunakan transaksi SQLite yang aman
      let errorMsg = null;
      db.transaction(() => {
        if (biome.cost > 0) {
          const wallet = economy.getWallet(author.id, guildId);
          if (wallet.balance < biome.cost) {
            errorMsg = `❌ Saldo koin Anda tidak mencukupi untuk masuk ke biome ini! Dibutuhkan **Rp ${biome.cost.toLocaleString('id-ID')}**.`;
            return;
          }
          economy.subtractBalance(author.id, guildId, biome.cost, 'PET_SAFARI_ENTRY');
        }
      })();

      if (errorMsg) {
        releaseLock(client, message.channelId);
        return await safeReply(i, { content: errorMsg, flags: 64 });
      }

      // Set Cooldown di SQLite
      setSafariCooldown(author.id, guildId, Date.now() + 180 * 1000);

      // Hentikan collector pemilihan biome
      collector.stop();

      // Mulai Game Sesi Safari
      await startSafariEncounter(i, replyMsg, selectedBiomeKey, author, guildId, client);
    } catch (err) {
      console.error('Error in biome collector:', err);
      deleteSafariState(author.id, guildId);
      releaseLock(client, message.channelId);
      await safeReply(i, { content: '⚠️ **Gagal memulai sesi Safari:** Terjadi kesalahan interaksi atau koneksi.', flags: 64 });
    }
  });

  collector.on('end', async (collected, reason) => {
    if (reason === 'time') {
      releaseLock(client, message.channelId);
      await replyMsg.edit({ content: '⏳ Pemilihan wilayah safari kedaluwarsa karena tidak ada respon.', embeds: [], components: [], files: [] }).catch(() => {});
    }
  });
}

/**
 * Jalankan Encounter / Pertemuan dengan Pet Liar
 */
async function startSafariEncounter(interaction, replyMsg, biomeKey, author, guildId, client) {
  const wildPet = generateWildPet(biomeKey);
  const biome = BIOMES[biomeKey];

  // Acak cuaca biome (CERAH, HUJAN, BADAI, KABUT)
  const weathers = ['CERAH', 'HUJAN', 'BADAI', 'KABUT'];
  const weather = weathers[Math.floor(Math.random() * weathers.length)];

  // Buat thread publik baru untuk sesi safari player
  let thread;
  try {
    thread = await replyMsg.channel.threads.create({
      name: `🌳 Safari - ${author.username}`,
      autoArchiveDuration: 60,
      type: ChannelType.GuildPublicThread,
      reason: 'Sesi Game Pet Safari'
    });
    // Kirim pesan sambutan di dalam thread untuk mengundang user
    await thread.send({ content: `👋 Selamat datang di arena berburu Anda, <@${author.id}>! Bersiaplah menemui pet liar.` }).catch(() => {});
  } catch (err) {
    console.error('Gagal membuat thread safari, fallback ke channel biasa:', err);
    thread = replyMsg.channel;
  }

  // Edit pesan biome di channel utama untuk menautkan thread jika berhasil dibuat
  if (thread.id !== replyMsg.channel.id) {
    await replyMsg.edit({
      content: `🌳 **Safari Dimulai!** Wilayah **${biome.name}** sedang dijelajahi oleh <@${author.id}>. Silakan masuk ke area berburu Anda di <#${thread.id}>.`,
      embeds: [],
      components: []
    }).catch(() => {});
  }

  // Inisialisasi State Safari
  const state = {
    userId: author.id,
    guildId,
    biome: biomeKey,
    channelId: thread.id,
    pet: wildPet,
    balls: 5,
    baits: 3,
    toys: 3,
    baitFed: 0,
    turns: 0,
    sneakCount: 0,
    sleepTurns: 0,
    catchBonus: 0,
    escapeBonus: 0,
    sneakPenalty: 0,
    toyBonus: 0,
    specialTraitApplied: false,
    weather: weather,
    logs: [`🔍 Menjelajahi **${biome.name}**... Cuaca: **${weather}**! Menemukan **${wildPet.emoji} ${wildPet.typeName} Liar**!`]
  };

  saveSafariState(author.id, guildId, state);

  // Jalankan render update screen di dalam thread
  let gameMsg;
  if (thread.id !== replyMsg.channel.id) {
    gameMsg = await thread.send({ content: '🔄 Menyiapkan arena perburuan...' });
  } else {
    gameMsg = replyMsg;
  }

  await renderSafariScreen(null, gameMsg, state, author, client);
}

/**
 * Merender Tampilan Layar Safari secara Dinamis
 */
async function renderSafariScreen(interaction, replyMsg, state, author, client) {
  const biome = BIOMES[state.biome];

  // Hitung persentase peluang dengan pengaruh cuaca dinamis
  let weatherCatchBonus = 0;
  let weatherEscapeBonus = 0;

  if (state.weather === 'HUJAN') {
    if (state.biome === 'abyss') {
      weatherCatchBonus = 0.10; // Rain bonus for water/abyss
    } else {
      weatherEscapeBonus = 0.05; // harder to catch other species in rain
    }
  } else if (state.weather === 'BADAI') {
    weatherEscapeBonus = 0.10; // storm makes pets jumpy
    weatherCatchBonus = 0.05;  // but also harder to flee quickly
  } else if (state.weather === 'KABUT') {
    weatherCatchBonus = -0.05; // Fog reduces catch chance
  }

  const currentCatchChance = Math.min(0.95, state.pet.baseCatch * biome.catchMultiplier + state.catchBonus + state.toyBonus + weatherCatchBonus);
  const currentEscapeChance = Math.max(0.01, state.pet.baseEscape * biome.escapeMultiplier + state.escapeBonus + state.sneakPenalty + weatherEscapeBonus - (state.baitFed * 0.05));

  // Info cuaca untuk dipajang di deskripsi embed
  let weatherDesc = '';
  if (state.weather === 'CERAH') {
    weatherDesc = '☀️ **Cuaca Cerah:** Suasana damai, tidak ada perubahan status.';
  } else if (state.weather === 'HUJAN') {
    weatherDesc = '🌧️ **Cuaca Hujan:** Pet Danau Abyss lebih tenang (+10% peluang tangkap), tetapi pet wilayah lainnya lebih waspada (+5% risiko kabur).';
  } else if (state.weather === 'BADAI') {
    weatherDesc = '⛈️ **Cuaca Badai:** Pet liar sangat liar dan stres (+10% risiko kabur), namun sedikit lebih mudah dijerat (+5% peluang tangkap).';
  } else if (state.weather === 'KABUT') {
    weatherDesc = '🌫️ **Cuaca Kabut:** Mengendap-endap lebih efektif (+15% sukses mendekat), tetapi mengurangi peluang tangkap (-5% peluang tangkap).';
  }

  const logText = state.logs && state.logs.length > 0
    ? state.logs.slice(-4).join('\n')
    : '*Mencari pet liar...*';

  const displayEscape = state.sleepTurns > 0 ? 0 : currentEscapeChance;
  const statusBadge = state.sleepTurns > 0 ? '💤 TERTIDUR' : '⚠️ WASPADA';
  const petImgUrl = embeds.getPetImage(state.pet);

  // Bikin bar visual untuk parameter
  const drawProgressBar = (val, max = 1.0, iconFilled = '🟩', iconEmpty = '⬛') => {
    const filled = Math.max(0, Math.min(10, Math.round((val / max) * 10)));
    return iconFilled.repeat(filled) + iconEmpty.repeat(10 - filled);
  };

  const catchBar = drawProgressBar(currentCatchChance, 1.0, '🟩', '⬛');
  const escapeBar = drawProgressBar(displayEscape, 1.0, '🟥', '⬛');

  const cleanWeatherDesc = weatherDesc.includes(':') 
    ? weatherDesc.substring(weatherDesc.indexOf(':') + 1).trim() 
    : weatherDesc;

  const mainEmbed = new EmbedBuilder()
    .setColor(biome.color)
    .setTitle(`🐾 Safari Encounter — ${state.pet.emoji} ${state.pet.typeName}`)
    .setDescription(
      `*“${state.pet.description || 'Spesies liar tangguh dan sangat waspada.'}”*\n\n` +
      `🏞️ **${biome.name}** (${state.weather})\n` +
      `*${cleanWeatherDesc}*`
    )
    .addFields(
      {
        name: '📊 Status Pet',
        value: `🧬 **Rarity:** \`${state.pet.rarity}\` (\`Lv. ${state.pet.level}\`)\n` +
               `💧 **Element:** \`${state.pet.gacha_element || state.pet.element}\`\n` +
               `${state.pet.trait ? `✨ **Trait:** \`${state.pet.trait}\`\n` : ''}` +
               `❤️ **Kondisi:** \`${statusBadge}\``,
        inline: true
      },
      {
        name: '🎯 Peluang & Risiko',
        value: `🟢 **Tangkap:** \`${Math.round(currentCatchChance * 100)}%\`\n` +
               `\`[ ${catchBar} ]\`\n\n` +
               `🔴 **Kabur:** \`${Math.round(displayEscape * 100)}%\`\n` +
               `\`[ ${escapeBar} ]\``,
        inline: true
      },
      {
        name: '🎒 Perlengkapan',
        value: `🥎 **Safari Ball:** \`${state.balls}/5\`   •   🍖 **Bait:** \`${state.baits}/3\`   •   💫 **Toy:** \`${state.toys}/3\``,
        inline: false
      },
      {
        name: '📝 Log Aktivitas',
        value: `> ${logText.replace(/\n/g, '\n> ')}`,
        inline: false
      }
    )
    .setFooter({ text: `Turn: ${state.turns} | Selesaikan sesi sebelum cooldown hang` });

  if (petImgUrl) {
    mainEmbed.setImage(petImgUrl);
  }

  // Custom UI Row: if throwingBall is active, show the sub-menu balls selector!
  let actionRow;
  if (state.throwingBall) {
    actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('safari_ball_standard').setLabel('🥎 Standard (Free)').setStyle(ButtonStyle.Success).setDisabled(state.balls <= 0),
      new ButtonBuilder().setCustomId('safari_ball_great').setLabel('🎴 Great Ball (Rp 50)').setStyle(ButtonStyle.Primary).setDisabled(state.balls <= 0),
      new ButtonBuilder().setCustomId('safari_ball_ultra').setLabel('🏆 Ultra Ball (Rp 100)').setStyle(ButtonStyle.Danger).setDisabled(state.balls <= 0),
      new ButtonBuilder().setCustomId('safari_ball_back').setLabel('🔙 Kembali').setStyle(ButtonStyle.Secondary)
    );
  } else {
    actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('safari_act_throw_ball').setLabel('🥎 Lempar Bola').setStyle(ButtonStyle.Success).setDisabled(state.balls <= 0),
      new ButtonBuilder().setCustomId('safari_act_feed_bait').setLabel('🍖 Beri Umpan').setStyle(ButtonStyle.Primary).setDisabled(state.baits <= 0),
      new ButtonBuilder().setCustomId('safari_act_sneak').setLabel('🔎 Dekati Perlahan').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('safari_act_play_toy').setLabel('💫 Goyang Mainan').setStyle(ButtonStyle.Primary).setDisabled(state.toys <= 0),
      new ButtonBuilder().setCustomId('safari_act_flee').setLabel('🏃‍♂️ Kabur').setStyle(ButtonStyle.Danger)
    );
  }

  let updatedMsg;
  try {
    const payload = { embeds: [mainEmbed], components: [actionRow], files: [] };
    if (interaction && typeof interaction.isButton === 'function' && interaction.isButton()) {
      if (interaction.deferred || interaction.replied) {
        updatedMsg = await interaction.editReply({ ...payload, fetchReply: true });
      } else {
        updatedMsg = await interaction.update({ ...payload, fetchReply: true });
      }
    } else {
      updatedMsg = await replyMsg.edit(payload);
    }
  } catch (updateErr) {
    console.error('Failed to update Safari screen via interaction, trying replyMsg.edit:', updateErr.message);
    const payload = { embeds: [mainEmbed], components: [actionRow], files: [] };
    try {
      updatedMsg = await replyMsg.edit(payload);
    } catch (editErr) {
      console.error('Failed to edit replyMsg, sending new message:', editErr.message);
      try {
        updatedMsg = await replyMsg.channel.send({ content: `<@${author.id}>`, ...payload });
      } catch (sendErr) {
        console.error('Fatal: Failed to send new Safari message:', sendErr.message);
        deleteSafariState(author.id, state.guildId);
        throw new Error('Tidak dapat mengirim atau memperbarui pesan Safari.');
      }
    }
  }

  // Buat collector baru untuk giliran ini
  const turnCollector = updatedMsg.createMessageComponentCollector({
    filter: (btnInteraction) => btnInteraction.user.id === author.id,
    time: 120000,
    max: 1
  });

  turnCollector.on('collect', async iTurn => {
    try {
      // Defer update immediately to prevent "Interaction failed" during slow Canvas rendering
      await iTurn.deferUpdate().catch(() => {});
      await handleSafariTurn(iTurn, updatedMsg, state, author, client);
    } catch (err) {
      console.error('Error in Safari turn handling:', err);
      await safeReply(iTurn, { content: `❌ Terjadi kesalahan: ${err.message}`, flags: 64 });
    }
  });

  turnCollector.on('end', async (collected, reason) => {
    if (reason === 'time') {
      await endSafariSession(null, state, author, client, `⏳ Sesi Safari <@${author.id}> berakhir karena terlalu lama mendiamkan pet liar. Pet melarikan diri ke dalam semak-semak!`);
    }
  });
}

/**
 * Logika Eksekusi Aksi per Giliran
 */
async function handleSafariTurn(interaction, replyMsg, state, author, client) {
  const action = interaction.customId;

  // --- SUBMENU LEMPAR BOLA: PILIH BOLA ---
  if (action === 'safari_act_throw_ball') {
    state.throwingBall = true;
    saveSafariState(author.id, state.guildId, state);
    return renderSafariScreen(interaction, replyMsg, state, author, client);
  }

  if (action === 'safari_ball_back') {
    state.throwingBall = false;
    saveSafariState(author.id, state.guildId, state);
    return renderSafariScreen(interaction, replyMsg, state, author, client);
  }

  // Pastikan flag throwingBall dinonaktifkan jika memilih aksi lain di luar melempar
  if (state.throwingBall && !action.startsWith('safari_ball_')) {
    state.throwingBall = false;
  }

  state.turns++;

  // Kurangi durasi tidur
  if (state.sleepTurns > 0) {
    state.sleepTurns--;
    if (state.sleepTurns === 0) {
      state.logs.push('💤 *Pet liar terbangun dari tidur pulasnya!*');
    }
  }

  if (action === 'safari_act_flee') {
    return endSafariSession(interaction, state, author, client, `🏃‍♂️ <@${author.id}> melarikan diri dari wilayah safari secara aman.`);
  }

  // --- AKSI: DEKATI PERLAHAN ---
  if (action === 'safari_act_sneak') {
    // Pengaruh cuaca kabut: mengurangi risiko kaget ketika mendekat
    const escapeFrightChance = state.weather === 'KABUT' ? 0.05 : 0.20;

    if (Math.random() < escapeFrightChance) {
      return endSafariSession(interaction, state, author, client, `💨 **Pet Terkejut!** Langkah kaki <@${author.id}> terlalu berisik. **${state.pet.typeName}** terkejut dan langsung kabur terbirit-birit ke dalam semak-semak!`);
    }

    state.sneakCount++;
    state.catchBonus += 0.15;
    state.sneakPenalty += 0.08;
    state.logs.push(`🔎 Anda mengendap-endap mendekatinya... Jarak semakin dekat! (+15% Peluang Tangkap, +8% Risiko Kabur)`);
    saveSafariState(author.id, state.guildId, state);
    return renderSafariScreen(interaction, replyMsg, state, author, client);
  }

  // --- AKSI: BERI UMPAN ---
  if (action === 'safari_act_feed_bait') {
    state.baits--;
    state.baitFed++;
    state.catchBonus += 0.06;
    
    let feedLog = `🍖 Anda melempar umpan pakan lezat. Pet melahapnya dengan senang! (+6% Peluang Tangkap)`;
    
    // Status tertidur jika diberi makan 3 kali
    if (state.baitFed >= 3 && state.sleepTurns === 0) {
      state.sleepTurns = 2; // Tidur selama 2 turn
      state.baitFed = 0; // Reset counter
      state.catchBonus += 0.20;
      feedLog += `\n💤 **WOW!** Pet kekenyangan dan tertidur pulas! (+20% Peluang Tangkap tambahan, 0% Risiko Kabur untuk 2 giliran)`;
    }

    state.logs.push(feedLog);

    // Cek Pelarian Pet Pasif (hanya jika tidak tidur)
    if (state.sleepTurns === 0) {
      const biome = BIOMES[state.biome];
      const finalEscapeChance = Math.max(0.01, state.pet.baseEscape * biome.escapeMultiplier + state.escapeBonus + state.sneakPenalty - (state.baitFed * 0.05));
      const passiveEscapeChance = finalEscapeChance * 0.25; // 25% dari peluang kabur penuh
      if (Math.random() < passiveEscapeChance) {
        return endSafariSession(interaction, state, author, client, `💨 **Pet Melarikan Diri!** Saat <@${author.id}> menyuapkan umpan, gerakan yang mendadak mengejutkannya. **${state.pet.typeName}** liar lari menghindar dan kabur!`);
      }
    }

    saveSafariState(author.id, state.guildId, state);
    return renderSafariScreen(interaction, replyMsg, state, author, client);
  }

  // --- AKSI: GOYANG MAINAN ---
  if (action === 'safari_act_play_toy') {
    state.toys--;
    state.toyBonus += 0.08;
    
    let playLog = `💫 Anda menggoyangkan mainan gemerlap. Pet terlihat teralihkan perhatiannya dan bahagia! (+8% Peluang Tangkap)`;
    
    // Peluang 10% menerapkan trait khusus
    if (Math.random() < 0.10) {
      state.specialTraitApplied = true;
      playLog += `\n✨ Pet liar mulai menyukai Anda! (Trait khusus akan melekat jika tertangkap)`;
    }

    state.logs.push(playLog);

    // Cek Pelarian Pet Pasif (hanya jika tidak tidur)
    if (state.sleepTurns === 0) {
      const biome = BIOMES[state.biome];
      const finalEscapeChance = Math.max(0.01, state.pet.baseEscape * biome.escapeMultiplier + state.escapeBonus + state.sneakPenalty - (state.baitFed * 0.05));
      const passiveEscapeChance = finalEscapeChance * 0.25; // 25% dari peluang kabur penuh
      if (Math.random() < passiveEscapeChance) {
        return endSafariSession(interaction, state, author, client, `💨 **Pet Melarikan Diri!** Bunyi mainan yang gemerincing membuat pet takut. **${state.pet.typeName}** terkejut dan langsung kabur!`);
      }
    }

    saveSafariState(author.id, state.guildId, state);
    return renderSafariScreen(interaction, replyMsg, state, author, client);
  }

  // --- PROSES LEMPAR BOLA (Standard, Great, Ultra) ---
  if (action.startsWith('safari_ball_')) {
    const ballType = action.replace('safari_ball_', '');
    let cost = 0;
    let ballCatchBonus = 0;
    let ballName = '';

    if (ballType === 'standard') {
      cost = 0;
      ballCatchBonus = 0.0;
      ballName = 'Standard Ball';
    } else if (ballType === 'great') {
      cost = 50;
      ballCatchBonus = 0.15;
      ballName = 'Great Ball';
    } else if (ballType === 'ultra') {
      cost = 100;
      ballCatchBonus = 0.35;
      ballName = 'Ultra Ball';
    }

    // Validasi saldo koin & kurangi saldo dalam transaksi SQLite
    let errorMsg = null;
    db.transaction(() => {
      if (cost > 0) {
        const wallet = economy.getWallet(author.id, state.guildId);
        if (wallet.balance < cost) {
          errorMsg = `❌ Saldo koin Anda tidak mencukupi untuk membeli **${ballName}**! Dibutuhkan **Rp ${cost}**.`;
          return;
        }
        economy.subtractBalance(author.id, state.guildId, cost, 'PET_SAFARI_BALL_PURCHASE');
      }
    })();

    if (errorMsg) {
      return await safeReply(interaction, { content: errorMsg, flags: 64 });
    }

    state.balls--;
    state.throwingBall = false;

    const biome = BIOMES[state.biome];
    
    // Hitung pengaruh cuaca dinamis kembali
    let weatherCatchBonus = 0;
    let weatherEscapeBonus = 0;
    if (state.weather === 'HUJAN') {
      if (state.biome === 'abyss') weatherCatchBonus = 0.10;
      else weatherEscapeBonus = 0.05;
    } else if (state.weather === 'BADAI') {
      weatherEscapeBonus = 0.10;
      weatherCatchBonus = 0.05;
    } else if (state.weather === 'KABUT') {
      weatherCatchBonus = -0.05;
    }

    const finalCatchChance = Math.min(0.95, state.pet.baseCatch * biome.catchMultiplier + state.catchBonus + state.toyBonus + ballCatchBonus + weatherCatchBonus);
    
    state.logs.push(`🥎 Anda melempar ${ballName}...`);

    // Cek Keberhasilan Tangkapan
    const roll = Math.random();
    if (roll < finalCatchChance) {
      // BERHASIL TANGKAP!
      return handleCaptureSuccess(interaction, replyMsg, state, author, client);
    }

    // GAGAL TANGKAP
    state.logs.push(`❌ Ah! Pet berhasil keluar dari ${ballName}.`);

    // Cek apakah terbangun dari tidur (50% peluang)
    if (state.sleepTurns > 0) {
      if (Math.random() < 0.50) {
        state.sleepTurns = 0;
        state.logs.push(`⚠️ **Terbangun!** Benturan ${ballName} membuatnya terkejut dan terbangun dari tidurnya!`);
      }
    }

    // Habis Bola = Kalah
    if (state.balls <= 0) {
      return endSafariSession(interaction, state, author, client, `😢 **Safari Ball Habis!** <@${author.id}> kehabisan bola safari. **${state.pet.typeName}** liar berjalan santai menjauh ke dalam hutan gelap.`);
    }

    // Cek Pelarian Pet (Jika tidak sedang tidur)
    if (state.sleepTurns === 0) {
      const finalEscapeChance = Math.max(0.01, state.pet.baseEscape * biome.escapeMultiplier + state.escapeBonus + state.sneakPenalty + weatherEscapeBonus - (state.baitFed * 0.05));
      if (Math.random() < finalEscapeChance) {
        return endSafariSession(interaction, state, author, client, `💨 **Pet Melarikan Diri!** Guncangan bola membuat pet ketakutan. **${state.pet.typeName}** melompat cepat dan menghilang di antara semak-semak!`);
      }
    }

    // Naikkan sedikit kecemasan/kabur pet per turn gagal tangkap
    state.escapeBonus += 0.03;
    saveSafariState(author.id, state.guildId, state);
    return renderSafariScreen(interaction, replyMsg, state, author, client);
  }
}

/**
 * Handle ketika Pet Berhasil Ditangkap
 */
async function handleCaptureSuccess(interaction, replyMsg, state, author, client) {
  const successEmbed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('🎉 TANGKAPAN SUKSES! PET BERHASIL DIJERAT! 🎉')
    .setDescription(
      `💥 **Kerja Bagus, Pelatih!**\n` +
      `Anda berhasil meringkus **${state.pet.emoji} ${state.pet.typeName} Liar** (Lv.${state.pet.level}) menggunakan Safari Ball!\n\n` +
      `Silakan tentukan nasib pet tangkapan Anda:`
    )
    .setThumbnail(embeds.getPetImage(state.pet))
    .addFields(
      {
        name: '📥 Adopsi (Masukkan ke Kandang)',
        value: `Simpan pet ini di kandang Anda (langsung berstatus **BABY** yang aktif tanpa perlu waktu tetas!). *Maksimal 5 pet terdaftar.*`,
        inline: false
      },
      {
        name: '💰 Rilis & Jual (Dapatkan Imbalan)',
        value: `Lepaskan pet kembali ke alam bebas untuk menerima bundel hadiah koin dan XP pet utama! Pet Legendary juga memberikan bonus Soda Energi.`,
        inline: false
      }
    )
    .setTimestamp();

  const choiceRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('safari_choice_adopt').setLabel('📥 Adopsi').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('safari_choice_release').setLabel('💰 Rilis & Jual').setStyle(ButtonStyle.Primary)
  );

  const updatedMsg = await interaction.editReply({ embeds: [successEmbed], components: [choiceRow], fetchReply: true });

  const choiceCollector = updatedMsg.createMessageComponentCollector({
    filter: (btnI) => btnI.user.id === author.id,
    time: 60000
  });

  let choiceProcessed = false;

  choiceCollector.on('collect', async iChoice => {
    try {
      if (choiceProcessed) return;

      if (iChoice.customId === 'safari_choice_release') {
        choiceProcessed = true;
        choiceCollector.stop();

        // Defer update immediately to prevent interaction timeout
        await iChoice.deferUpdate().catch(() => {});

        // Mengamankan proses rilis pet dengan transaksi SQLite agar koin/item tidak terduplikasi
        let rewards = null;
        db.transaction(() => {
          rewards = executeReleaseRewards(author.id, state.guildId, state.pet);
        })();

        let rewardText = `💰 **Koin Diterima:** **Rp ${rewards.coins.toLocaleString('id-ID')}**\n` +
          `🌟 **XP Pet Utama:** **+${rewards.xp} XP**\n`;

        if (rewards.tickets > 0) rewardText += `🎟️ **Tiket Gacha Pet:** **+${rewards.tickets}x**\n`;
        if (rewards.soda > 0) rewardText += `🥤 **Soda Energi Pet:** **+${rewards.soda}x**\n`;
        if (rewards.food > 0) rewardText += `🥩 **Daging Premium:** **+${rewards.food}x**\n`;
        rewardText += `🏹 **Safari Mastery:** **+${rewards.safariXp} XP Berburu**\n`;
        if (rewards.levelUpMsg) rewardText += `${rewards.levelUpMsg}\n`;

        const releaseEmbed = new EmbedBuilder()
          .setColor(0x3498DB)
          .setTitle('🕊️ PET SAFARI BERHASIL DIRILIS KEMBALI 🕊️')
          .setDescription(
            `Anda melepaskan **${state.pet.typeName}** kembali ke alam liar dengan damai.\n` +
            `Sebagai tanda terima kasih, Dinas Lingkungan Hidup Safari memberikan Anda hadiah insentif:\n\n` +
            `${rewardText}\n` +
            `*Semua koin, tiket, XP, dan suplai telah langsung ditambahkan ke inventaris dompet Anda!*`
          )
          .setTimestamp();

        await endSafariSession(iChoice, state, author, client, releaseEmbed);
        return;
      }

      if (iChoice.customId === 'safari_choice_adopt') {
        // Cek batasan slot kandang (maksimal 5 pet) dengan aman
        const petsCountRow = db.get('SELECT COUNT(*) as count FROM user_pets WHERE user_id = ? AND guild_id = ?', [author.id, state.guildId]);
        const petsCount = petsCountRow ? petsCountRow.count : 0;

        if (petsCount >= 5) {
          return await safeReply(iChoice, { content: '❌ **Kandang Penuh!** Anda sudah memiliki batas maksimal **5 hewan peliharaan** di kandang. Silakan lepas/reset salah satu pet Anda terlebih dahulu sebelum mengadopsi pet baru!', flags: 64 });
        }

        // Simpan ID interaksi terakhir untuk mencegah race condition timeout modal
        state.lastAdoptInteractionId = iChoice.id;

        // Tampilkan Modal Penamaan Pet
        const modal = new ModalBuilder()
          .setCustomId('safari_adopt_modal')
          .setTitle('Adopsi Pet Safari');

        const nameInput = new TextInputBuilder()
          .setCustomId('safari_pet_name_input')
          .setLabel('Beri Nama Peliharaan Baru Anda')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Contoh: Rocky')
          .setMinLength(2)
          .setMaxLength(15)
          .setRequired(true);

        const row = new ActionRowBuilder().addComponents(nameInput);
        modal.addComponents(row);

        await iChoice.showModal(modal);

        // Tunggu submit modal
        try {
          const modalInteraction = await iChoice.awaitModalSubmit({
            filter: (mI) => mI.customId === 'safari_adopt_modal' && mI.user.id === author.id,
            time: 60000
          });

          let chosenName = modalInteraction.fields.getTextInputValue('safari_pet_name_input').trim();
          
          // Sanitasi & validasi nama
          chosenName = chosenName.replace(/[^a-zA-Z0-9 ]/g, '').substring(0, 15).trim();
          if (chosenName.length < 2) {
            chosenName = `Liar ${state.pet.name}`;
          }

          // Pengecekan nama duplikat & penyimpanan pet dijamin atomic dengan transaksi DB
          let adoptError = null;
          db.transaction(() => {
            const nameExists = db.get('SELECT 1 FROM user_pets WHERE user_id = ? AND guild_id = ? AND LOWER(pet_name) = LOWER(?)', [author.id, state.guildId, chosenName]);
            if (nameExists) {
              adoptError = `❌ Anda sudah memiliki peliharaan dengan nama **"${chosenName}"**! Silakan coba adopsi lagi dan tentukan nama yang berbeda.`;
              return;
            }

            if (choiceProcessed) return;
            choiceProcessed = true;
            choiceCollector.stop();

            const nowUnix = Math.floor(Date.now() / 1000);
            const isActive = petsCount === 0 ? 1 : 0;

            // Trait yang diterapkan
            let finalTrait = state.pet.trait || '';
            if (state.specialTraitApplied && !finalTrait) {
              const traits = ['GENIUS', 'STURDY', 'MUTANT', 'WARRIOR'];
              finalTrait = traits[Math.floor(Math.random() * traits.length)];
            }

            db.run(
              `INSERT INTO user_pets (user_id, guild_id, pet_name, pet_type, status, level, xp, health, hunger, thirst, happiness, last_interaction_at, hatch_at, created_at, is_active, trait, gacha_source, gacha_rarity, gacha_element, iv_str, iv_vit, iv_dex) 
               VALUES (?, ?, ?, ?, 'BABY', ?, 0, 100, 100, 100, 100, ?, 0, ?, ?, ?, 'SAFARI', ?, ?, ?, ?, ?)`,
              [author.id, state.guildId, chosenName, state.pet.pet_type, state.pet.level, nowUnix, nowUnix, isActive, finalTrait, state.pet.rarity, state.pet.gacha_element, state.pet.iv_str || 0, state.pet.iv_vit || 0, state.pet.iv_dex || 0]
            );

            let xpReward = 15;
            if (state.pet.rarity === 'RARE') xpReward = 30;
            else if (state.pet.rarity === 'EPIC') xpReward = 60;
            else if (state.pet.rarity === 'LEGENDARY') xpReward = 120;
            
            const xpRes = addSafariXp(author.id, state.guildId, xpReward);
            state.levelUpMsg = xpRes.levelUpMsg;
            state.xpReward = xpReward;

            logPetAction(state.guildId, author.id, null, chosenName, 'ADOPT_SAFARI', `Mengadopsi pet liar hasil safari spesies ${state.pet.pet_type} (Lv.${state.pet.level})`);
          })();

          if (adoptError) {
            return await safeReply(modalInteraction, { content: adoptError, flags: 64 });
          }

          // Trait display text
          let finalTrait = state.pet.trait || '';
          if (state.specialTraitApplied && !finalTrait) {
            finalTrait = 'DITENTUKAN';
          }

          const adoptEmbed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('💖 ADOPSI PET SAFARI BERHASIL! 💖')
            .setDescription(
              `Selamat! **${chosenName}** the **${state.pet.name}** resmi menjadi peliharaan baru Anda!\n\n` +
              `• 🏷️ **Panggilan:** \`${chosenName}\`\n` +
              `• 🧬 **Tingkat Kelangkaan:** \`${state.pet.emoji} ${state.pet.rarity}\`\n` +
              `• ⚡ **Level Awal:** \`${state.pet.level}\`\n` +
              `• Elemen Bawaan: **${state.pet.element}**\n` +
              `${finalTrait ? `• Trait Spesial: **${finalTrait}**\n` : ''}` +
              `• 🧬 **Nilai Bakat (IVs):** ⚔️ STR: \`${state.pet.iv_str}\` | 🩺 VIT: \`${state.pet.iv_vit}\` | ⚡ DEX: \`${state.pet.iv_dex}\`\n\n` +
              `🏹 **Safari Mastery:** +${state.xpReward} XP Berburu!${state.levelUpMsg || ''}\n\n` +
              `*Pet langsung masuk kandang dalam keadaan sehat bugar dan siap diajak bekerja (\`.pet work\`) atau bermain (\`.pet play\`) tanpa menunggu penetasan!*`
            )
            .setThumbnail(embeds.getPetImage(state.pet))
            .setTimestamp();

          await endSafariSession(modalInteraction, state, author, client, adoptEmbed);
          await updatedMsg.delete().catch(() => {});
        } catch (errModal) {
          // Abaikan timeout modal, berikan pet default name jika ditutup
          if (errModal.code === 'InteractionCollectorError') {
            if (state.lastAdoptInteractionId !== iChoice.id) {
              return; // Abaikan timeout dari klik lama yang dibatalkan/ditutup
            }
            if (choiceProcessed) return;
            choiceProcessed = true;
            choiceCollector.stop();

            // Sediakan default name
            const defaultName = `Liar ${state.pet.name} ${Math.floor(100 + Math.random() * 900)}`;
            const nowUnix = Math.floor(Date.now() / 1000);
            const isActive = petsCount === 0 ? 1 : 0;

            let xpReward = 15;
            if (state.pet.rarity === 'RARE') xpReward = 30;
            else if (state.pet.rarity === 'EPIC') xpReward = 60;
            else if (state.pet.rarity === 'LEGENDARY') xpReward = 120;
            
            let levelUpMsg = '';
            db.transaction(() => {
              db.run(
                `INSERT INTO user_pets (user_id, guild_id, pet_name, pet_type, status, level, xp, health, hunger, thirst, happiness, last_interaction_at, hatch_at, created_at, is_active, trait, gacha_source, gacha_rarity, gacha_element, iv_str, iv_vit, iv_dex) 
                 VALUES (?, ?, ?, ?, 'BABY', ?, 0, 100, 100, 100, 100, ?, 0, ?, ?, ?, 'SAFARI', ?, ?, ?, ?, ?)`,
                [author.id, state.guildId, defaultName, state.pet.pet_type, state.pet.level, nowUnix, nowUnix, isActive, state.pet.trait || '', state.pet.rarity, state.pet.gacha_element, state.pet.iv_str || 0, state.pet.iv_vit || 0, state.pet.iv_dex || 0]
              );
              
              const xpRes = addSafariXp(author.id, state.guildId, xpReward);
              levelUpMsg = xpRes.levelUpMsg;
            })();

            const adoptEmbed = new EmbedBuilder()
              .setColor(0x2ECC71)
              .setTitle('💖 ADOPSI PET SAFARI BERHASIL (AUTO-NAME) 💖')
              .setDescription(
                `Karena waktu habis, pet diadopsi secara otomatis dengan nama default:\n\n` +
                `• 🏷️ **Nama Pet:** \`${defaultName}\`\n` +
                `• 🧬 **Kelangkaan:** \`${state.pet.emoji} ${state.pet.rarity}\` (Lv.${state.pet.level})\n` +
                `• 🧬 **Nilai Bakat (IVs):** ⚔️ STR: \`${state.pet.iv_str}\` | 🩺 VIT: \`${state.pet.iv_vit}\` | ⚡ DEX: \`${state.pet.iv_dex}\`\n\n` +
                `🏹 **Safari Mastery:** +${xpReward} XP Berburu!${levelUpMsg || ''}`
              )
              .setTimestamp();

            await endSafariSession(null, state, author, client, adoptEmbed);
            await updatedMsg.delete().catch(() => {});
          } else {
            console.error('Error modal submit:', errModal);
          }
        }
      }
    } catch (err) {
      console.error('Error choice handling:', err);
    }
  });

  choiceCollector.on('end', async (collected, reason) => {
    if (!choiceProcessed) {
      // Disable buttons on updatedMsg
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('safari_choice_adopt').setLabel('📥 Adopsi').setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId('safari_choice_release').setLabel('💰 Rilis & Jual').setStyle(ButtonStyle.Primary).setDisabled(true)
      );
      const timeoutEmbed = new EmbedBuilder()
        .setColor(0xCCCCCC)
        .setTitle('⏳ WAKTU HABIS')
        .setDescription(`Keputusan adopsi/rilis <@${author.id}> kedaluwarsa karena tidak ada respon. Pet liar melarikan diri kembali ke hutan!`);
      
      await endSafariSession(null, state, author, client, { embeds: [timeoutEmbed], components: [disabledRow] });
    }
  });
}

/**
 * Memberikan Hadiah Rilis Pet Liar & Mengupdate Stat Pet Utama
 */
function executeReleaseRewards(userId, guildId, wildPet) {
  const r = wildPet.rarity;
  let coins = 0;
  let xp = 0;
  let soda = 0;
  let food = 0;

  if (r === 'COMMON') {
    coins = Math.floor(Math.random() * 200) + 250;
    xp = 50;
  } else if (r === 'RARE') {
    coins = Math.floor(Math.random() * 300) + 500;
    xp = 120;
  } else if (r === 'EPIC') {
    coins = Math.floor(Math.random() * 600) + 900;
    xp = 250;
  } else if (r === 'LEGENDARY') {
    coins = Math.floor(Math.random() * 1500) + 2000;
    xp = 500;
    soda = 1;
  } else if (r === 'MYTHIC' || r === 'IMMORTAL') {
    coins = Math.floor(Math.random() * 3000) + 4000;
    xp = 1000;
    soda = 2;
    food = 1;
  }

  // 1. Tambah Balance Koin
  economy.addBalance(userId, guildId, coins, 'PET_SAFARI_RELEASE');

  // 3. Tambah Soda / Food ke pet_inventory
  if (soda > 0) {
    const exist = db.get("SELECT quantity FROM pet_inventory WHERE user_id = ? AND guild_id = ? AND item_id = 'SODA_ENERGY'", [userId, guildId]);
    if (exist) {
      db.run("UPDATE pet_inventory SET quantity = quantity + ? WHERE user_id = ? AND guild_id = ? AND item_id = 'SODA_ENERGY'", [soda, userId, guildId]);
    } else {
      db.run("INSERT INTO pet_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'SODA_ENERGY', ?)", [userId, guildId, soda]);
    }
  }

  if (food > 0) {
    const exist = db.get("SELECT quantity FROM pet_inventory WHERE user_id = ? AND guild_id = ? AND item_id = 'FOOD_PREMIUM'", [userId, guildId]);
    if (exist) {
      db.run("UPDATE pet_inventory SET quantity = quantity + ? WHERE user_id = ? AND guild_id = ? AND item_id = 'FOOD_PREMIUM'", [food, userId, guildId]);
    } else {
      db.run("INSERT INTO pet_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'FOOD_PREMIUM', ?)", [userId, guildId, food]);
    }
  }

  // 4. Tambah XP ke Pet Utama Aktif (jika ada)
  const activePet = pet.getPet(userId, guildId);
  if (activePet) {
    const xpResult = pet.addXp(activePet, xp, pet.getMaxHP(activePet));
    db.run(
      'UPDATE user_pets SET xp = ?, level = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?',
      [xpResult.newXp, xpResult.newLevel, userId, guildId, activePet.pet_name]
    );
  }

  // 5. Tambah Safari XP
  let safariXpAmount = 10;
  if (r === 'RARE') safariXpAmount = 20;
  else if (r === 'EPIC') safariXpAmount = 40;
  else if (r === 'LEGENDARY') safariXpAmount = 80;

  const xpRes = addSafariXp(userId, guildId, safariXpAmount);

  logPetAction(guildId, userId, null, wildPet.name, 'RELEASE_SAFARI', `Merilis pet liar ${wildPet.pet_type} (Rarity: ${r}). Koin: Rp ${coins}, Soda: ${soda}`);

  return { coins, xp, tickets: 0, soda, food, safariXp: safariXpAmount, levelUpMsg: xpRes.levelUpMsg };
}

module.exports = {
  handlePetSafariCommand,
  activeSafaris,
  BIOMES
};
