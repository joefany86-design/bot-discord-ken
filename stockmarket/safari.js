const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('./database');
const { logPetAction } = db;
const economy = require('./economy');
const embeds = require('./embeds');
const pet = require('./pet');
const petCard = require('./petCard');

// Cooldown dan Sesi Aktif
const activeSafaris = new Map();
const safariCooldowns = new Map();

// Helper to release channel lock for Safari
function releaseLock(client, channelId) {
  if (client && client.safariLocks) {
    client.safariLocks.delete(channelId);
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
  }
};

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
    status: 'ADULT' // Untuk rendering GIF dari embeds.js
  };
}

/**
 * Handle komando .pet safari / .safari
 */
async function handlePetSafariCommand(message, client, args) {
  const { author, guildId } = message;

  if (activeSafaris.has(author.id)) {
    return message.reply({ content: '⚠️ **Sesi Safari Sedang Aktif!** Selesaikan petualangan safari Anda yang sekarang terlebih dahulu!' });
  }

  // Cek Cooldown (3 Menit)
  const now = Date.now();
  const cooldownEnd = safariCooldowns.get(author.id) || 0;
  if (now < cooldownEnd) {
    const secondsLeft = Math.ceil((cooldownEnd - now) / 1000);
    return message.reply({ content: `⏳ **Safari dalam Cooldown!** Anda terlalu lelah untuk menjelajah. Harap tunggu **${secondsLeft} detik** lagi.` });
  }

  // Check and set channel lock for Safari
  const safariLocks = client.safariLocks = client.safariLocks || new Map();
  if (safariLocks.has(message.channelId)) {
    return message.reply({ content: '⚠️ **Safari** sedang berlangsung di channel ini! Harap tunggu sampai safari selesai.' });
  }
  safariLocks.set(message.channelId, author.id);

  // Generate the visual attachment using napi-rs/canvas
  const attachment = await petCard.getSafariLobbyAttachment(message.guild.name);

  // Biome Selection Panel
  const biomeEmbed = new EmbedBuilder()
    .setColor(0x2ECC71) // Nature green
    .setTitle('🌳 PET SAFARI ADVENTURE 🦁')
    .setDescription(
      `Halo Warga **${message.guild.name}**! Selamat datang di **Safari Pet Liar**.\n` +
      `Di sini Anda bisa menjelajahi berbagai wilayah untuk melacak dan menangkap pet liar yang legendaris secara interaktif!\n\n` +
      `Silakan pilih biome wilayah yang ingin Anda jelajahi di bawah ini:`
    )
    .setImage('attachment://safari_lobby.png')
    .setFooter({ text: 'Gunakan tombol di bawah untuk masuk ke biome | Cooldown 3 menit' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('safari_biome_forest').setLabel('🌳 Forest').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('safari_biome_volcano').setLabel('🌋 Volcano').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('safari_biome_abyss').setLabel('🌊 Abyss').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('safari_biome_mountain').setLabel('⛰️ Peak').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('safari_biome_cancel').setLabel('✖️ Batalkan').setStyle(ButtonStyle.Secondary)
  );

  const replyMsg = await message.reply({
    embeds: [biomeEmbed],
    components: [row],
    files: attachment ? [attachment] : []
  });
  const collector = replyMsg.createMessageComponentCollector({ time: 60000 });

  collector.on('collect', async i => {
    try {
      if (i.user.id !== author.id) {
        return i.reply({ content: '❌ Pilihan ini bukan milik Anda!', flags: 64 });
      }

      if (i.customId === 'safari_biome_cancel') {
        collector.stop();
        releaseLock(client, message.channelId);
        return i.update({ content: '❌ Petualangan Safari dibatalkan.', embeds: [], components: [], files: [] });
      }

      const selectedBiomeKey = i.customId.replace('safari_biome_', '');
      const biome = BIOMES[selectedBiomeKey];

      if (!biome) return;

      // Cek Koin untuk Biaya Masuk
      if (biome.cost > 0) {
        const wallet = economy.getWallet(author.id, guildId);
        if (wallet.balance < biome.cost) {
          releaseLock(client, message.channelId);
          return i.reply({ content: `❌ Saldo koin Anda tidak mencukupi untuk masuk ke biome ini! Dibutuhkan **Rp ${biome.cost.toLocaleString('id-ID')}**.`, flags: 64 });
        }
        economy.subtractBalance(author.id, guildId, biome.cost, 'PET_SAFARI_ENTRY');
      }

      // Set Cooldown
      safariCooldowns.set(author.id, Date.now() + 180 * 1000);

      // Hentikan collector pemilihan biome
      collector.stop();

      // Mulai Game Sesi Safari
      await startSafariEncounter(i, replyMsg, selectedBiomeKey, author, guildId, client);
    } catch (err) {
      console.error('Error in biome collector:', err);
      activeSafaris.delete(author.id);
      releaseLock(client, message.channelId);
      await i.reply({ content: '⚠️ **Gagal memulai sesi Safari:** Terjadi kesalahan interaksi atau koneksi.', flags: 64 }).catch(() => {});
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

  // Inisialisasi State Safari
  const state = {
    userId: author.id,
    guildId,
    biome: biomeKey,
    channelId: replyMsg.channelId,
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
    logs: [`🔍 Menjelajahi **${biome.name}**... Menemukan **${wildPet.emoji} ${wildPet.typeName} Liar**!`]
  };

  activeSafaris.set(author.id, state);

  // Jalankan render update screen
  await renderSafariScreen(interaction, replyMsg, state, author, client);
}

/**
 * Merender Tampilan Layar Safari secara Dinamis
 */
async function renderSafariScreen(interaction, replyMsg, state, author, client) {
  const petImg = embeds.getPetImage(state.pet);
  const biome = BIOMES[state.biome];

  // Hitung persentase peluang
  const currentCatchChance = Math.min(0.95, state.pet.baseCatch * biome.catchMultiplier + state.catchBonus + state.toyBonus);
  const currentEscapeChance = Math.max(0.01, state.pet.baseEscape * biome.escapeMultiplier + state.escapeBonus + state.sneakPenalty - (state.baitFed * 0.05));

  // Tampilan Status Pet
  let petStatusDetail = `Level **${state.pet.level}** | Elemen: **${state.pet.element}**\n`;
  if (state.pet.trait) {
    petStatusDetail += `🧬 Trait Bawaan: **${state.pet.trait}**\n`;
  }
  if (state.sleepTurns > 0) {
    petStatusDetail += `💤 **Status:** Tertidur pulas! (Peluang kabur 0%)\n`;
  } else {
    petStatusDetail += `🏃‍♂️ **Status:** Waspada\n`;
  }

  // Bikin bar visual untuk parameter
  const drawProgressBar = (val, max = 1.0, iconFilled = '🟩', iconEmpty = '⬛') => {
    const filled = Math.max(0, Math.min(10, Math.round((val / max) * 10)));
    return iconFilled.repeat(filled) + iconEmpty.repeat(10 - filled);
  };

  const catchBar = drawProgressBar(currentCatchChance, 1.0, '🎯', '⬛');
  const escapeBar = drawProgressBar(state.sleepTurns > 0 ? 0 : currentEscapeChance, 1.0, '🏃‍♂️', '⬛');

  const mainEmbed = new EmbedBuilder()
    .setColor(biome.color)
    .setTitle(`🐾 SAFARI ENCOUNTER — ${state.pet.emoji} ${state.pet.typeName.toUpperCase()} 🐾`)
    .setDescription(
      `🏞️ **Biome:** ${biome.name}\n` +
      `💬 *“${state.pet.description}”*\n\n` +
      `${petStatusDetail}\n` +
      `🎯 **Peluang Tangkap:** \`${Math.round(currentCatchChance * 100)}%\`\n` +
      `[ ${catchBar} ]\n\n` +
      `🏃‍♂️ **Risiko Kabur:** \`${state.sleepTurns > 0 ? 0 : Math.round(currentEscapeChance * 100)}%\`\n` +
      `[ ${escapeBar} ]`
    )
    .addFields(
      {
        name: '🎒 Kantong Perlengkapan Safari',
        value: `🥎 **Safari Ball:** \`${state.balls} / 5\` | 🍖 **Safari Bait:** \`${state.baits} / 3\` | 💫 **Mainan Pet:** \`${state.toys} / 3\``,
        inline: false
      },
      {
        name: '📝 Log Aktivitas Safari',
        value: state.logs.slice(-3).join('\n'),
        inline: false
      }
    )
    .setFooter({ text: `Giliran: ${state.turns} | Selesaikan sesi agar cooldown tidak menggantung` });

  if (petImg) {
    mainEmbed.setImage(petImg);
  }

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('safari_act_throw_ball').setLabel('🥎 Lempar Bola').setStyle(ButtonStyle.Success).setDisabled(state.balls <= 0),
    new ButtonBuilder().setCustomId('safari_act_feed_bait').setLabel('🍖 Beri Umpan').setStyle(ButtonStyle.Primary).setDisabled(state.baits <= 0),
    new ButtonBuilder().setCustomId('safari_act_sneak').setLabel('🔎 Dekati Perlahan').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('safari_act_play_toy').setLabel('💫 Goyang Mainan').setStyle(ButtonStyle.Primary).setDisabled(state.toys <= 0),
    new ButtonBuilder().setCustomId('safari_act_flee').setLabel('🏃‍♂️ Kabur').setStyle(ButtonStyle.Danger)
  );

  let updatedMsg;
  try {
    if (interaction.isButton() && !interaction.replied && !interaction.deferred) {
      updatedMsg = await interaction.update({ embeds: [mainEmbed], components: [actionRow], fetchReply: true });
    } else {
      updatedMsg = await replyMsg.edit({ embeds: [mainEmbed], components: [actionRow] });
    }
  } catch (updateErr) {
    console.error('Failed to update Safari screen via interaction, trying replyMsg.edit:', updateErr.message);
    try {
      updatedMsg = await replyMsg.edit({ embeds: [mainEmbed], components: [actionRow] });
    } catch (editErr) {
      console.error('Failed to edit replyMsg, sending new message:', editErr.message);
      try {
        updatedMsg = await replyMsg.channel.send({ content: `<@${author.id}>`, embeds: [mainEmbed], components: [actionRow] });
      } catch (sendErr) {
        console.error('Fatal: Failed to send new Safari message:', sendErr.message);
        activeSafaris.delete(author.id);
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
      await handleSafariTurn(iTurn, updatedMsg, state, author, client);
    } catch (err) {
      console.error('Error in Safari turn handling:', err);
      await iTurn.reply({ content: `❌ Terjadi kesalahan: ${err.message}`, flags: 64 }).catch(() => {});
    }
  });

  turnCollector.on('end', async (collected, reason) => {
    if (reason === 'time') {
      activeSafaris.delete(author.id);
      releaseLock(client, state.channelId);
      await updatedMsg.edit({ content: `⏳ Sesi Safari berakhir karena terlalu lama mendiamkan pet liar. Pet melarikan diri ke dalam semak-semak!`, embeds: [], components: [] }).catch(() => {});
    }
  });
}

/**
 * Logika Eksekusi Aksi per Giliran
 */
async function handleSafariTurn(interaction, replyMsg, state, author, client) {
  const action = interaction.customId;
  state.turns++;

  // Kurangi durasi tidur
  if (state.sleepTurns > 0) {
    state.sleepTurns--;
    if (state.sleepTurns === 0) {
      state.logs.push('💤 *Pet liar terbangun dari tidur pulasnya!*');
    }
  }

  if (action === 'safari_act_flee') {
    activeSafaris.delete(author.id);
    releaseLock(client, state.channelId);
    return interaction.update({ content: '🏃‍♂️ Anda melarikan diri dari wilayah safari secara aman.', embeds: [], components: [] });
  }

  // --- AKSI: DEKATI PERLAHAN ---
  if (action === 'safari_act_sneak') {
    // 20% Peluang Kaget & Kabur
    if (Math.random() < 0.20) {
      activeSafaris.delete(author.id);
      releaseLock(client, state.channelId);
      return interaction.update({
        content: `💨 **Pet Terkejut!** Langkah kaki Anda terlalu berisik. **${state.pet.typeName}** terkejut dan langsung kabur terbirit-birit ke dalam semak-semak!`,
        embeds: [],
        components: []
      });
    }

    state.sneakCount++;
    state.catchBonus += 0.15;
    state.sneakPenalty += 0.08;
    state.logs.push(`🔎 Anda mengendap-endap mendekatinya... Jarak semakin dekat! (+15% Peluang Tangkap, +8% Risiko Kabur)`);
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
        activeSafaris.delete(author.id);
        releaseLock(client, state.channelId);
        return interaction.update({
          content: `💨 **Pet Melarikan Diri!** Saat Anda menyuapkan umpan, gerakan Anda mengejutkannya. **${state.pet.typeName}** liar lari menghindar dan kabur!`,
          embeds: [],
          components: []
        });
      }
    }

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
        activeSafaris.delete(author.id);
        releaseLock(client, state.channelId);
        return interaction.update({
          content: `💨 **Pet Melarikan Diri!** Bunyi mainan yang gemerincing membuatnya takut. **${state.pet.typeName}** terkejut dan langsung kabur!`,
          embeds: [],
          components: []
        });
      }
    }

    return renderSafariScreen(interaction, replyMsg, state, author, client);
  }

  // --- AKSI: LEMPAR BOLA ---
  if (action === 'safari_act_throw_ball') {
    state.balls--;

    const biome = BIOMES[state.biome];
    const finalCatchChance = Math.min(0.95, state.pet.baseCatch * biome.catchMultiplier + state.catchBonus + state.toyBonus);
    
    state.logs.push(`🥎 Anda melempar Safari Ball dengan presisi...`);

    // Cek Keberhasilan Tangkapan
    const roll = Math.random();
    if (roll < finalCatchChance) {
      // BERHASIL TANGKAP!
      activeSafaris.delete(author.id);
      return handleCaptureSuccess(interaction, replyMsg, state, author, client);
    }

    // GAGAL TANGKAP
    state.logs.push(`❌ Ah! Pet berhasil keluar dari Safari Ball.`);

    // Cek apakah terbangun dari tidur (50% peluang)
    if (state.sleepTurns > 0) {
      if (Math.random() < 0.50) {
        state.sleepTurns = 0;
        state.logs.push(`⚠️ **Terbangun!** Benturan Safari Ball membuatnya terkejut dan terbangun dari tidurnya!`);
      }
    }

    // Habis Bola = Kalah
    if (state.balls <= 0) {
      activeSafaris.delete(author.id);
      releaseLock(client, state.channelId);
      return interaction.update({
        content: `😢 **Safari Ball Habis!** Anda kehabisan bola safari. **${state.pet.typeName}** liar berjalan santai menjauh ke dalam hutan gelap.`,
        embeds: [],
        components: []
      });
    }

    // Cek Pelarian Pet (Jika tidak sedang tidur)
    if (state.sleepTurns === 0) {
      const finalEscapeChance = Math.max(0.01, state.pet.baseEscape * biome.escapeMultiplier + state.escapeBonus + state.sneakPenalty - (state.baitFed * 0.05));
      if (Math.random() < finalEscapeChance) {
        activeSafaris.delete(author.id);
        releaseLock(client, state.channelId);
        return interaction.update({
          content: `💨 **Pet Melarikan Diri!** Guncangan bola membuatnya ketakutan. **${state.pet.typeName}** melompat cepat dan menghilang di antara semak-semak!`,
          embeds: [],
          components: []
        });
      }
    }

    // Naikkan sedikit kecemasan/kabur pet per turn gagal tangkap
    state.escapeBonus += 0.03;
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

  const updatedMsg = await interaction.update({ embeds: [successEmbed], components: [choiceRow], fetchReply: true });

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
        // --- PROSES RILIS / JUAL HADIAH ---
        const rewards = executeReleaseRewards(author.id, state.guildId, state.pet);

        let rewardText = `💰 **Koin Diterima:** **Rp ${rewards.coins.toLocaleString('id-ID')}**\n` +
          `🌟 **XP Pet Utama:** **+${rewards.xp} XP**\n`;

        if (rewards.tickets > 0) rewardText += `🎟️ **Tiket Gacha Pet:** **+${rewards.tickets}x**\n`;
        if (rewards.soda > 0) rewardText += `🥤 **Soda Energi Pet:** **+${rewards.soda}x**\n`;
        if (rewards.food > 0) rewardText += `🥩 **Daging Premium:** **+${rewards.food}x**\n`;

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

        releaseLock(client, state.channelId);
        return iChoice.update({ embeds: [releaseEmbed], components: [] });
      }

      if (iChoice.customId === 'safari_choice_adopt') {
        // Cek batasan slot kandang (maksimal 5 pet)
        const petsCountRow = db.get('SELECT COUNT(*) as count FROM user_pets WHERE user_id = ? AND guild_id = ?', [author.id, state.guildId]);
        const petsCount = petsCountRow ? petsCountRow.count : 0;

        if (petsCount >= 5) {
          return iChoice.reply({ content: '❌ **Kandang Penuh!** Anda sudah memiliki batas maksimal **5 hewan peliharaan** di kandang. Silakan lepas/reset salah satu pet Anda terlebih dahulu sebelum mengadopsi pet baru!', flags: 64 });
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

          // Cek nama duplikat
          const nameExists = db.get('SELECT 1 FROM user_pets WHERE user_id = ? AND guild_id = ? AND LOWER(pet_name) = LOWER(?)', [author.id, state.guildId, chosenName]);
          if (nameExists) {
            return modalInteraction.reply({ content: `❌ Anda sudah memiliki peliharaan dengan nama **"${chosenName}"**! Silakan coba adopsi lagi dan tentukan nama yang berbeda.`, flags: 64 });
          }

          if (choiceProcessed) return;
          choiceProcessed = true;
          choiceCollector.stop();

          // Simpan Pet ke Database!
          const nowUnix = Math.floor(Date.now() / 1000);
          const isActive = petsCount === 0 ? 1 : 0;

          // Trait yang diterapkan
          let finalTrait = state.pet.trait || '';
          if (state.specialTraitApplied && !finalTrait) {
            const traits = ['GENIUS', 'STURDY', 'MUTANT', 'WARRIOR'];
            finalTrait = traits[Math.floor(Math.random() * traits.length)];
          }

          db.run(
            `INSERT INTO user_pets (user_id, guild_id, pet_name, pet_type, status, level, xp, health, hunger, thirst, happiness, last_interaction_at, hatch_at, created_at, is_active, trait, gacha_source, gacha_rarity, gacha_element) 
             VALUES (?, ?, ?, ?, 'BABY', ?, 0, 100, 100, 100, 100, ?, 0, ?, ?, ?, 'SAFARI', ?, ?)`,
            [author.id, state.guildId, chosenName, state.pet.pet_type, state.pet.level, nowUnix, nowUnix, isActive, finalTrait, state.pet.rarity, state.pet.gacha_element]
          );

          logPetAction(state.guildId, author.id, null, chosenName, 'ADOPT_SAFARI', `Mengadopsi pet liar hasil safari spesies ${state.pet.pet_type} (Lv.${state.pet.level})`);

          const adoptEmbed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('💖 ADOPSI PET SAFARI BERHASIL! 💖')
            .setDescription(
              `Selamat! **${chosenName}** the **${state.pet.name}** resmi menjadi peliharaan baru Anda!\n\n` +
              `• 🏷️ **Panggilan:** \`${chosenName}\`\n` +
              `• 🧬 **Tingkat Kelangkaan:** \`${state.pet.emoji} ${state.pet.rarity}\`\n` +
              `• ⚡ **Level Awal:** \`${state.pet.level}\`\n` +
              `• Elemen Bawaan: **${state.pet.element}**\n` +
              `${finalTrait ? `• Trait Spesial: **${finalTrait}**\n` : ''}\n` +
              `*Pet langsung masuk kandang dalam keadaan sehat bugar dan siap diajak bekerja (\`.pet work\`) atau bermain (\`.pet play\`) tanpa menunggu penetasan!*`
            )
            .setThumbnail(embeds.getPetImage(state.pet))
            .setTimestamp();

          releaseLock(client, state.channelId);
          await modalInteraction.reply({ embeds: [adoptEmbed] });
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

            db.run(
              `INSERT INTO user_pets (user_id, guild_id, pet_name, pet_type, status, level, xp, health, hunger, thirst, happiness, last_interaction_at, hatch_at, created_at, is_active, trait, gacha_source, gacha_rarity, gacha_element) 
               VALUES (?, ?, ?, ?, 'BABY', ?, 0, 100, 100, 100, 100, ?, 0, ?, ?, ?, 'SAFARI', ?, ?)`,
              [author.id, state.guildId, defaultName, state.pet.pet_type, state.pet.level, nowUnix, nowUnix, isActive, state.pet.trait || '', state.pet.rarity, state.pet.gacha_element]
            );

            const adoptEmbed = new EmbedBuilder()
              .setColor(0x2ECC71)
              .setTitle('💖 ADOPSI PET SAFARI BERHASIL (AUTO-NAME) 💖')
              .setDescription(
                `Karena waktu habis, pet diadopsi secara otomatis dengan nama default:\n\n` +
                `• 🏷️ **Nama Pet:** \`${defaultName}\`\n` +
                `• 🧬 **Kelangkaan:** \`${state.pet.emoji} ${state.pet.rarity}\` (Lv.${state.pet.level})`
              )
              .setTimestamp();

            releaseLock(client, state.channelId);
            await replyMsg.reply({ embeds: [adoptEmbed] }).catch(() => {});
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
      activeSafaris.delete(author.id);
      releaseLock(client, state.channelId);
      // Disable buttons on updatedMsg
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('safari_choice_adopt').setLabel('📥 Adopsi').setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId('safari_choice_release').setLabel('💰 Rilis & Jual').setStyle(ButtonStyle.Primary).setDisabled(true)
      );
      await updatedMsg.edit({ content: '⏳ Keputusan adopsi/rilis kedaluwarsa karena tidak ada respon. Pet liar melarikan diri kembali ke hutan!', components: [disabledRow] }).catch(() => {});
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

  logPetAction(guildId, userId, null, wildPet.name, 'RELEASE_SAFARI', `Merilis pet liar ${wildPet.pet_type} (Rarity: ${r}). Koin: Rp ${coins}, Soda: ${soda}`);

  return { coins, xp, tickets: 0, soda, food };
}

module.exports = {
  handlePetSafariCommand,
  activeSafaris,
  BIOMES
};
