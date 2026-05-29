/**
 * Truth or Dare (Ultimate Hot Seat - Group Edition)
 * Core Game Engine and Discord Interaction Interface
 */
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  getVoiceConnection
} = require('discord.js');

const config = require('./config');
const database = require('./database');
const audio = require('./audio');

// Sesi game aktif per guild: Map<guildId, gameSession>
const activeGames = new Map();

// Cooldown manual per user: Map<userId, timestamp>
const manualCooldowns = new Map();

// ═══════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════

function getCooldownRemaining(userId) {
  const lastUsed = manualCooldowns.get(userId);
  if (!lastUsed) return 0;

  const elapsed = Date.now() - lastUsed;
  if (elapsed >= config.durations.COOLDOWN_MS) return 0;

  return Math.ceil((config.durations.COOLDOWN_MS - elapsed) / 1000);
}

function cleanSession(guildId) {
  const session = activeGames.get(guildId);
  if (session && session.timer) {
    clearTimeout(session.timer);
  }
  activeGames.delete(guildId);
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// ═══════════════════════════════════════════════════
// UI EMBED & COMPONENT GENERATORS
// ═══════════════════════════════════════════════════

function getLobbyComponents(session) {
  const lobbyRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('tod_lobby_join')
      .setLabel('🙋‍♂️ Gabung')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('tod_lobby_leave')
      .setLabel('🚪 Keluar')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('tod_lobby_settings')
      .setLabel('⚙️ Setelan')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('tod_lobby_start')
      .setLabel('🚀 Mulai Game')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('tod_lobby_cancel')
      .setLabel('❌ Batal')
      .setStyle(ButtonStyle.Danger)
  );

  return [lobbyRow];
}

async function updateLobbyEmbed(interaction, session) {
  const playerListString = session.players.map((p, index) => {
    const isHost = p.id === session.host.id;
    return `${index + 1}. ${p} ${isHost ? '(👑 Host)' : ''}`;
  }).join('\n');

  const modeLabels = config.modes.LABELS;

  const catLabels = {
    chill: 'Family Friendly',
    deep: 'Remaja',
    spicy: 'Extreme (18+ NSFW)'
  };

  const embed = new EmbedBuilder()
    .setColor(0x00D2FF)
    .setTitle('🎤 TRUTH OR DARE: GAME LOBBY')
    .setDescription([
      'Sesi game Truth or Dare baru saja dibuka! Ayo bergabung untuk menguji keberanian dan kejujuran kalian.',
      `\n👑 **Host:** ${session.host}`,
      `🎙️ **Mode:** \`${modeLabels[session.mode] || session.mode}\``,
      `📂 **Kategori:** \`${catLabels[session.category] || session.category.toUpperCase()}\``,
      `💵 **Hadiah:** \`+Rp ${config.economy.SUCCESS_REWARD}\` (Korban) | \`+Rp ${config.economy.ACTIVE_CHALLENGER_BONUS}\` (Penanya Aktif)`,
      `💸 **Denda:** \`-Rp ${config.economy.SKIP_FINE}\` (Menyerah)`,
      `\n👥 **Daftar Pemain (${session.players.length}):**`,
      playerListString || '*Belum ada pemain bergabung*'
    ].join('\n'))
    .setFooter({ text: 'Pastikan Anda berada di Voice Channel sebelum bergabung!' })
    .setTimestamp();

  const components = getLobbyComponents(session);
  await interaction.update({ embeds: [embed], components });
}

// ═══════════════════════════════════════════════════
// GAME INITIALIZATION (LOBBY PHASE)
// ═══════════════════════════════════════════════════

async function startTodGame(message, client) {
  const { guildId, member, channel: textChannel } = message;

  // 1. Cek Cooldown
  const cooldown = getCooldownRemaining(member.id);
  if (cooldown > 0) {
    const embed = new EmbedBuilder()
      .setColor(0xFF3366)
      .setDescription(`⏳ **Cooldown!** Kamu bisa memulai game ToD lagi dalam **${cooldown} detik**.`);
    return message.reply({ embeds: [embed] });
  }

  // 2. Cek apakah ada game berjalan di server ini
  if (activeGames.has(guildId)) {
    const embed = new EmbedBuilder()
      .setColor(0xFF3366)
      .setDescription(`⚠️ **Game Sedang Berjalan!** Ada sesi Truth or Dare yang sedang aktif di server ini.`);
    return message.reply({ embeds: [embed] });
  }

  // 3. Cek Voice Channel pemain
  const voiceChannel = member.voice.channel;
  if (!voiceChannel) {
    const embed = new EmbedBuilder()
      .setColor(0xFF3366)
      .setDescription(`🔇 **Batal!** Kamu harus masuk ke **Voice Channel** terlebih dahulu untuk bermain.`);
    return message.reply({ embeds: [embed] });
  }

  // 4. Cek apakah bot ada di VC yang sama
  const botVoiceChannel = message.guild.members.me?.voice?.channel;
  if (!botVoiceChannel || botVoiceChannel.id !== voiceChannel.id) {
    const embed = new EmbedBuilder()
      .setColor(0xFF3366)
      .setDescription(`🎙️ **Bot Belum Terhubung!** Pastikan bot bergabung di Voice Channel yang sama.\nKetik \`.joinlow\` atau \`/join\` terlebih dahulu.`);
    return message.reply({ embeds: [embed] });
  }

  // Set cooldown awal untuk pembuat sesi
  manualCooldowns.set(member.id, Date.now());

  // 5. Buat Sesi Game Baru dalam status 'lobby'
  const session = {
    guildId,
    voiceChannelId: voiceChannel.id,
    textChannel,
    category: 'chill',
    mode: 'mode_2', // Default: Mode 2: Interogasi (Hot Seat)
    state: 'lobby',
    host: member,
    players: [member], // Pembuat lobby langsung otomatis gabung
    victim: null,
    challenger: null,
    timer: null,
    message: null,
    remainingHotseatVictims: [],
    hotseatVictim: null,
    hotseatChallengersQueue: [],
    // Statistik lokal untuk match summary
    sessionStats: {}
  };
  activeGames.set(guildId, session);

  // Inisialisasi statistik untuk pembuat
  session.sessionStats[member.id] = { completed: 0, skipped: 0, coins: 0, asked: 0 };

  const modeLabels = config.modes.LABELS;

  // 6. Buat Embed Lobby
  const embed = new EmbedBuilder()
    .setColor(0x00D2FF)
    .setTitle('🎤 TRUTH OR DARE: GAME LOBBY')
    .setDescription([
      'Sesi game Truth or Dare baru saja dibuka! Ayo bergabung untuk menguji keberanian dan kejujuran kalian.',
      `\n👑 **Host:** ${member}`,
      `🎙️ **Mode:** \`${modeLabels[session.mode]}\``,
      `📂 **Kategori:** \`Family Friendly\``,
      `💵 **Hadiah:** \`+Rp ${config.economy.SUCCESS_REWARD}\` (Korban) | \`+Rp ${config.economy.ACTIVE_CHALLENGER_BONUS}\` (Penanya Aktif)`,
      `💸 **Denda:** \`-Rp ${config.economy.SKIP_FINE}\` (Menyerah)`,
      `\n👥 **Daftar Pemain (${session.players.length}):**`,
      `1. ${member} (👑 Host)`
    ].join('\n'))
    .setFooter({ text: 'Pastikan Anda berada di Voice Channel sebelum bergabung!' })
    .setTimestamp();

  const lobbyComponents = getLobbyComponents(session);
  const lobbyMessage = await textChannel.send({ embeds: [embed], components: lobbyComponents });
  session.message = lobbyMessage;

  // Umumkan lewat TTS bahwa lobby dibuka
  audio.announceGameStart(client, guildId).catch(() => {});

  // 7. Component Collector untuk penanganan Lobby
  const collector = lobbyMessage.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 15 * 60 * 1000 // 15 Menit batas lobi sebelum auto-batal
  });

  collector.on('collect', async (interaction) => {
    const currentSession = activeGames.get(guildId);
    if (!currentSession || currentSession !== session) {
      return interaction.reply({ content: '❌ Sesi lobby ini sudah tidak aktif.', ephemeral: true });
    }

    const { customId, user } = interaction;

    // 🙋‍♂️ Gabung Bermain
    if (customId === 'tod_lobby_join') {
      const clickerMember = interaction.member;
      const clickerVoiceChannel = clickerMember.voice.channel;
      if (!clickerVoiceChannel || clickerVoiceChannel.id !== session.voiceChannelId) {
        return interaction.reply({ content: '❌ Kamu harus berada di **Voice Channel** yang sama untuk bergabung!', ephemeral: true });
      }

      if (session.players.some(p => p.id === user.id)) {
        return interaction.reply({ content: 'ℹ️ Kamu sudah terdaftar di dalam lobi!', ephemeral: true });
      }

      session.players.push(clickerMember);
      // Inisialisasi statistik pemain
      session.sessionStats[user.id] = { completed: 0, skipped: 0, coins: 0, asked: 0 };

      await updateLobbyEmbed(interaction, session);
    }

    // 🚪 Keluar dari Lobi
    else if (customId === 'tod_lobby_leave') {
      if (!session.players.some(p => p.id === user.id)) {
        return interaction.reply({ content: '❌ Kamu belum bergabung di lobi ini!', ephemeral: true });
      }

      // Host tidak bisa keluar kecuali dia membatalkan lobi
      if (user.id === session.host.id) {
        return interaction.reply({ content: '👑 Kamu adalah Host! Gunakan tombol **Batal** untuk membubarkan lobi.', ephemeral: true });
      }

      session.players = session.players.filter(p => p.id !== user.id);
      delete session.sessionStats[user.id];

      await updateLobbyEmbed(interaction, session);
    }

    // ⚙️ Pengaturan Lobi (Mode & Kategori)
    else if (customId === 'tod_lobby_settings') {
      const isAdmin = interaction.member.permissions.has('Administrator');
      if (user.id !== session.host.id && !isAdmin) {
        return interaction.reply({ content: '❌ Hanya Host (pembuat lobi) atau Admin yang bisa merubah setelan!', ephemeral: true });
      }

      // Buat menu pilihan setelan yang cantik secara ephemeral
      const modeSelect = new StringSelectMenuBuilder()
        .setCustomId('tod_settings_mode')
        .setPlaceholder('🎙️ Pilih Mode Pertanyaan')
        .addOptions([
          { label: 'Mode 1: Saling Tanya (1 vs 1)', value: 'mode_1', description: 'Mengacak sepasang Penanya & Menjawab untuk saling melempar tantangan.' },
          { label: 'Mode 2: Interogasi (Hot Seat)', value: 'mode_2', description: 'Mengacak 1 Korban, lalu semua member lain bergiliran menanyai.' },
          { label: 'Mode 3: Bot TTS (Bot Bertanya)', value: 'mode_3', description: 'Mengacak 1 Korban, lalu Bot membacakan pertanyaan otomatis via TTS.' }
        ]);

      const catSelect = new StringSelectMenuBuilder()
        .setCustomId('tod_settings_cat')
        .setPlaceholder('📂 Pilih Kategori Pertanyaan (Mode 3)')
        .addOptions([
          { label: 'Family Friendly (Chill)', value: 'chill', description: 'Pertanyaan santai, seru-seruan, dan lucu.' },
          { label: 'Remaja (Deep)', value: 'deep', description: 'Pertanyaan tentang perasaan, masa lalu, dan filosofis.' },
          { label: 'Extreme (NSFW 18+)', value: 'spicy', description: 'Pertanyaan dewasa, nakal, dan sensasional.' }
        ]);

      const row1 = new ActionRowBuilder().addComponents(modeSelect);
      const row2 = new ActionRowBuilder().addComponents(catSelect);

      const settingsMsg = await interaction.reply({
        content: '⚙️ **SETELAN GAME LOBI TRUTH OR DARE**\nSilakan sesuaikan mode dan kategori di bawah ini:',
        components: [row1, row2],
        ephemeral: true,
        fetchReply: true
      });

      const settingsCollector = settingsMsg.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 60 * 1000
      });

      settingsCollector.on('collect', async (selInteraction) => {
        const activeSess = activeGames.get(guildId);
        if (!activeSess || activeSess !== session) {
          return selInteraction.reply({ content: '❌ Sesi game sudah tidak aktif.', ephemeral: true });
        }

        if (selInteraction.customId === 'tod_settings_mode') {
          session.mode = selInteraction.values[0];
          await selInteraction.reply({ content: `✅ Mode berhasil diubah ke **${config.modes.LABELS[session.mode]}**!`, ephemeral: true });
        } else if (selInteraction.customId === 'tod_settings_cat') {
          const targetCat = selInteraction.values[0];

          // Validasi NSFW untuk kategori spicy
          if (targetCat === 'spicy' && config.categories.SPICY_NSFW_ONLY && !textChannel.nsfw) {
            return selInteraction.reply({
              content: '🔞 **Batal!** Kategori **Extreme** hanya diizinkan di Channel bertanda NSFW untuk keamanan.',
              ephemeral: true
            });
          }

          session.category = targetCat;
          await selInteraction.reply({ content: `✅ Kategori berhasil diubah ke **${session.category.toUpperCase()}**!`, ephemeral: true });
        }

        // Perbarui embed lobi utama
        const playerListStr = session.players.map((p, idx) => {
          const isHost = p.id === session.host.id;
          return `${idx + 1}. ${p} ${isHost ? '(👑 Host)' : ''}`;
        }).join('\n');

        const modeLabels = config.modes.LABELS;
        const catLabels = {
          chill: 'Family Friendly',
          deep: 'Remaja',
          spicy: 'Extreme (18+ NSFW)'
        };

        const updatedLobbyEmbed = new EmbedBuilder()
          .setColor(0x00D2FF)
          .setTitle('🎤 TRUTH OR DARE: GAME LOBBY')
          .setDescription([
            'Sesi game Truth or Dare baru saja dibuka! Ayo bergabung untuk menguji keberanian dan kejujuran kalian.',
            `\n👑 **Host:** ${session.host}`,
            `🎙️ **Mode:** \`${modeLabels[session.mode] || session.mode}\``,
            `📂 **Kategori:** \`${catLabels[session.category] || session.category.toUpperCase()}\``,
            `💵 **Hadiah:** \`+Rp ${config.economy.SUCCESS_REWARD}\` (Korban) | \`+Rp ${config.economy.ACTIVE_CHALLENGER_BONUS}\` (Penanya Aktif)`,
            `💸 **Denda:** \`-Rp ${config.economy.SKIP_FINE}\` (Menyerah)`,
            `\n👥 **Daftar Pemain (${session.players.length}):**`,
            playerListStr || '*Belum ada pemain bergabung*'
          ].join('\n'))
          .setFooter({ text: 'Pastikan Anda berada di Voice Channel sebelum bergabung!' })
          .setTimestamp();

        await lobbyMessage.edit({ embeds: [updatedLobbyEmbed] }).catch(() => {});
      });
    }

    // 🚀 Mulai Game
    else if (customId === 'tod_lobby_start') {
      const isAdmin = interaction.member.permissions.has('Administrator');
      if (user.id !== session.host.id && !isAdmin) {
        return interaction.reply({ content: '❌ Hanya Host atau Admin yang bisa memulai permainan!', ephemeral: true });
      }

      // Validasi pemain minimal 2 di Voice Channel
      const guildInstance = interaction.guild;
      const voiceChan = guildInstance.channels.cache.get(session.voiceChannelId);
      const playersActiveInVc = session.players.filter(p => voiceChan?.members.has(p.id));

      if (playersActiveInVc.length < 2) {
        return interaction.reply({
          content: '❌ **Gagal memulai!** Harus ada minimal **2 pemain terdaftar yang aktif di Voice Channel** saat ini.',
          ephemeral: true
        });
      }

      // Update daftar pemain dengan yang benar-benar aktif di VC
      session.players = playersActiveInVc;
      collector.stop();

      // Mulai fase transisi acak korban
      await interaction.deferUpdate();
      await startHotseatTransition(client, guildId);
    }

    // ❌ Batalkan Game Lobi
    else if (customId === 'tod_lobby_cancel') {
      const isAdmin = interaction.member.permissions.has('Administrator');
      if (user.id !== session.host.id && !isAdmin) {
        return interaction.reply({ content: '❌ Hanya Host atau Admin yang bisa membatalkan lobi!', ephemeral: true });
      }

      collector.stop();
      cleanSession(guildId);

      const cancelEmbed = EmbedBuilder.from(embed)
        .setColor(0x555555)
        .setDescription(`🛑 Game lobi dibatalkan oleh Host ${interaction.user}.`);

      await interaction.update({ embeds: [cancelEmbed], components: [] });
    }
  });
}

// ═══════════════════════════════════════════════════
// GAME STATE: HOT SEAT TRANSITION
// ═══════════════════════════════════════════════════


async function startHotseatTransition(client, guildId) {
  const session = activeGames.get(guildId);
  if (!session) return;

  if (session.timer) clearTimeout(session.timer);
  session.state = 'hotseat_transition';

  // Saring pemain aktif di VC
  const guild = client.guilds.cache.get(guildId);
  const voiceChannel = guild?.channels.cache.get(session.voiceChannelId);
  const activePlayers = session.players.filter(p => voiceChannel?.members.has(p.id));

  if (activePlayers.length < 2) {
    cleanSession(guildId);
    const endEmbed = new EmbedBuilder()
      .setColor(0xFF3366)
      .setTitle('🏁 Game Truth or Dare Selesai!')
      .setDescription('👥 **Game Berakhir!** Jumlah pemain aktif di Voice Channel kurang dari 2 orang.');
    await session.textChannel.send({ embeds: [endEmbed] });
    return;
  }

  session.players = activePlayers;

  // Cek apakah list calon korban kosong
  let victimCandidates = activePlayers.filter(p => session.remainingHotseatVictims.includes(p.id));
  if (victimCandidates.length === 0) {
    // Reset pool korban (semua berhak terpilih kembali)
    session.remainingHotseatVictims = activePlayers.map(p => p.id);
    victimCandidates = [...activePlayers];

    // Hindari orang yang barusan jadi korban terpilih langsung lagi jika kandidat > 1
    if (session.hotseatVictim && victimCandidates.length > 1) {
      victimCandidates = victimCandidates.filter(p => p.id !== session.hotseatVictim.id);
    }
  }

  // Pilih korban secara acak
  const chosenVictim = victimCandidates[Math.floor(Math.random() * victimCandidates.length)];
  session.remainingHotseatVictims = session.remainingHotseatVictims.filter(id => id !== chosenVictim.id);
  session.hotseatVictim = chosenVictim;
  session.victim = chosenVictim;

  let transEmbed;

  if (session.mode === 'mode_1') {
    // Mode 1: Saling Tanya (1 vs 1)
    // Asker diacak dari pemain selain korban
    const challengerCandidates = activePlayers.filter(p => p.id !== chosenVictim.id);
    const chosenChallenger = challengerCandidates[Math.floor(Math.random() * challengerCandidates.length)];
    session.challenger = chosenChallenger;

    transEmbed = new EmbedBuilder()
      .setColor(0x00FF88)
      .setTitle('⚔️ GILIRAN 1 VS 1 TERPILIH!')
      .setDescription([
        `🗣️ **Penanya:** ${chosenChallenger}`,
        `🎯 **Menjawab:** ${chosenVictim}`,
        `\n⏱️ Game dimulai dalam 5 detik...`
      ].join('\n'))
      .setTimestamp();

    // Umumkan via TTS
    audio.speak(client, guildId, `Giliran satu lawan satu! ${chosenChallenger.displayName} sebagai penanya, dan ${chosenVictim.displayName} sebagai penjawab. Bersiaplah.`).catch(() => {});

  } else if (session.mode === 'mode_3') {
    // Mode 3: Bot TTS Bertanya
    session.challenger = null; // Bot

    transEmbed = new EmbedBuilder()
      .setColor(0xFF00FF)
      .setTitle('🤖 GILIRAN BOT TTS BERTANYA!')
      .setDescription([
        `🎯 **Target Menjawab:** ${chosenVictim}`,
        `Bot akan otomatis memberikan tantangan lewat suara (TTS) langsung di Voice Channel.`,
        `\n⏱️ Bersiaplah dalam 5 detik...`
      ].join('\n'))
      .setTimestamp();

    // Umumkan via TTS
    audio.speak(client, guildId, `Kini giliran bot t s untuk bertanya kepada ${chosenVictim.displayName}. Bersiaplah.`).catch(() => {});

  } else {
    // Mode 2: Interogasi (Hot Seat) - Bawaan
    // Antrean penanya adalah seluruh pemain aktif selain si korban, di-shuffle
    let challengers = activePlayers.filter(p => p.id !== chosenVictim.id);
    challengers = shuffleArray(challengers);
    session.hotseatChallengersQueue = challengers.map(p => p.id);

    transEmbed = new EmbedBuilder()
      .setColor(0xFF3366)
      .setTitle('🔥 KORBAN HOT SEAT BARU TERPILIH!')
      .setDescription([
        `👑 **${chosenVictim}** sekarang berada di **Hot Seat**!`,
        `Semua pemain lain akan bergantian mengajukan pertanyaan/tantangan kepadanya secara bergiliran.`,
        `\n⏱️ Menyusun giliran penanya dalam 5 detik...`
      ].join('\n'))
      .setTimestamp();

    // Umumkan via TTS
    audio.announceNewHotseat(client, guildId, chosenVictim.displayName).catch(() => {});
  }

  const msg = await session.textChannel.send({ embeds: [transEmbed] });
  session.message = msg;

  // Auto-advance ke giliran pertama setelah 5 detik
  session.timer = setTimeout(async () => {
    await startNextTurn(client, guildId);
  }, 5000);
}

// ═══════════════════════════════════════════════════
// GAME STATE: ACTIVE TURN
// ═══════════════════════════════════════════════════

async function startNextTurn(client, guildId) {
  const session = activeGames.get(guildId);
  if (!session) return;

  if (session.timer) clearTimeout(session.timer);

  // Saring pemain aktif di VC
  const guild = client.guilds.cache.get(guildId);
  const voiceChannel = guild?.channels.cache.get(session.voiceChannelId);
  const activePlayers = session.players.filter(p => voiceChannel?.members.has(p.id));

  if (activePlayers.length < 2) {
    await announceMatchSummary(client, guildId, 'Jumlah pemain aktif di VC kurang dari 2.');
    return;
  }

  session.players = activePlayers;

  // Jika korban tidak diset (atau ronde sebelumnya telah selesai), kita acak baru
  if (!session.hotseatVictim) {
    const allVictimsServed = activePlayers.every(p => !session.remainingHotseatVictims.includes(p.id));
    if (allVictimsServed) {
      await announceMatchSummary(client, guildId, 'Semua pemain terdaftar telah mendapatkan giliran.');
      return;
    }

    await startHotseatTransition(client, guildId);
    return;
  }

  const victim = session.hotseatVictim;
  session.victim = victim;

  // ═══════════════════════════════════════════════════
  // MODE 1: SALING TANYA (1 VS 1)
  // ═══════════════════════════════════════════════════
  if (session.mode === 'mode_1') {
    session.state = 'waiting_for_method_selection';

    const turnEmbed = new EmbedBuilder()
      .setColor(0x00FF88)
      .setTitle('⚔️ Giliran 1 vs 1 — Saling Tanya')
      .setDescription([
        `🗣️ **Penanya:** ${session.challenger}`,
        `🎯 **Menjawab (Korban):** ${session.victim}`,
        `\n👉 **${session.challenger}**, silakan ajukan pertanyaan/tantangan kamu kepada **${session.victim}** menggunakan tombol di bawah:`
      ].join('\n'))
      .setTimestamp();

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('tod_method_voice').setLabel('🎙️ Voice Mic').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('tod_method_custom').setLabel('✍️ Tulis Pertanyaan').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('tod_method_stop').setLabel('⏹️ Stop Sesi').setStyle(ButtonStyle.Secondary)
    );

    const turnMessage = await session.textChannel.send({ embeds: [turnEmbed], components: [actionRow] });
    session.message = turnMessage;

    const collector = turnMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120 * 1000
    });

    collector.on('collect', async (interaction) => {
      const curSess = activeGames.get(guildId);
      if (!curSess || curSess !== session) {
        return interaction.reply({ content: '❌ Sesi game sudah tidak aktif.', ephemeral: true });
      }

      const { customId, user } = interaction;

      if (customId === 'tod_method_stop') {
        const isAdm = interaction.member.permissions.has('Administrator');
        if (user.id !== session.host.id && !isAdm) {
          return interaction.reply({ content: '❌ Hanya Host/Admin yang bisa menghentikan game!', ephemeral: true });
        }
        collector.stop();
        await announceMatchSummary(client, guildId, `Game diakhiri paksa oleh ${user.username}.`);
        return;
      }

      if (user.id !== session.challenger.id) {
        return interaction.reply({ content: '❌ Hanya penanya aktif yang boleh merespon!', ephemeral: true });
      }

      if (customId === 'tod_method_voice') {
        collector.stop();
        await interaction.deferUpdate();
        await startAnswerPhase(client, guildId, 'Tanyakan tantangan/pertanyaan kustom kamu lewat mikrofon secara bebas sekarang!', 'voice');
      } else if (customId === 'tod_method_custom') {
        // Tampilkan Discord Modal
        const modal = new ModalBuilder()
          .setCustomId('tod_modal_question')
          .setTitle('✍️ Tulis Pertanyaan ToD');

        const questionInput = new TextInputBuilder()
          .setCustomId('tod_input_text')
          .setLabel('Tanya/Tantangan:')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Contoh: Apa kebiasaan teraneh kamu saat sendirian?')
          .setRequired(true)
          .setMaxLength(250);

        modal.addComponents(new ActionRowBuilder().addComponents(questionInput));

        await interaction.showModal(modal);

        try {
          const submitted = await interaction.awaitModalSubmit({
            time: 60000,
            filter: i => i.user.id === session.challenger.id && i.customId === 'tod_modal_question'
          });

          const text = submitted.fields.getTextInputValue('tod_input_text');
          collector.stop();
          await submitted.deferUpdate();
          await startAnswerPhase(client, guildId, text, 'custom');
        } catch (err) {
          // Modal timeout
        }
      }
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'time') {
        const curSess = activeGames.get(guildId);
        if (curSess && curSess === session && session.state === 'waiting_for_method_selection') {
          await session.textChannel.send(`⏳ **AFK!** Giliran ${session.challenger} dilewati karena terlalu lama merespon.`);
          session.hotseatVictim = null; // Selesai ronde
          await startNextTurn(client, guildId);
        }
      }
    });
  }

  // ═══════════════════════════════════════════════════
  // MODE 3: BOT TTS (BOT BERTANYA)
  // ═══════════════════════════════════════════════════
  else if (session.mode === 'mode_3') {
    session.state = 'waiting_for_mode3_choice';
    session.challenger = null; // Penanya adalah Bot

    // Umumkan ajakan memilih lewat TTS
    audio.askTruthOrDareTTS(client, guildId, victim.displayName).catch(() => {});

    const turnEmbed = new EmbedBuilder()
      .setColor(0xFF00FF)
      .setTitle('🤖 Giliran Bot TTS Bertanya!')
      .setDescription([
        `🎯 **Target Menjawab:** ${victim}`,
        `💬 **Kategori Pertanyaan:** \`${session.category.toUpperCase()}\``,
        `\n👉 **${victim}**, apakah kamu memilih **Truth (Jujur)** atau **Dare (Tantangan)**?`,
        `Silakan pilih tombol di bawah agar Bot membacakannya untukmu!`
      ].join('\n'))
      .setTimestamp();

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('tod_mode3_truth').setLabel('🟢 Truth (Jujur)').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('tod_mode3_dare').setLabel('🔴 Dare (Tantangan)').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('tod_mode3_stop').setLabel('⏹️ Stop Sesi').setStyle(ButtonStyle.Secondary)
    );

    const turnMessage = await session.textChannel.send({ embeds: [turnEmbed], components: [actionRow] });
    session.message = turnMessage;

    const collector = turnMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120 * 1000
    });

    collector.on('collect', async (interaction) => {
      const curSess = activeGames.get(guildId);
      if (!curSess || curSess !== session) {
        return interaction.reply({ content: '❌ Sesi game sudah tidak aktif.', ephemeral: true });
      }

      const { customId, user } = interaction;

      if (customId === 'tod_mode3_stop') {
        const isAdm = interaction.member.permissions.has('Administrator');
        if (user.id !== session.host.id && !isAdm) {
          return interaction.reply({ content: '❌ Hanya Host/Admin yang bisa menghentikan game!', ephemeral: true });
        }
        collector.stop();
        await announceMatchSummary(client, guildId, `Game diakhiri paksa oleh ${user.username}.`);
        return;
      }

      if (user.id !== session.victim.id) {
        return interaction.reply({ content: '❌ Hanya korban yang aktif saat ini yang boleh memilih!', ephemeral: true });
      }

      collector.stop();
      await interaction.deferUpdate();

      const type = customId === 'tod_mode3_truth' ? 'truth' : 'dare';
      const questionObj = database.getRandomQuestion(type, session.category, guildId);

      const questionText = questionObj
        ? questionObj.question_text
        : `Tanyakan satu hal konyol bertema ${session.category.toUpperCase()} kepada korban secara langsung!`;

      // Bacakan pertanyaan menggunakan Google TTS di Voice Channel
      audio.readQuestionTTS(client, guildId, victim.displayName, type, questionText).catch(() => {});

      // Mulai fase jawaban dengan Bot sebagai penanya
      await startAnswerPhase(client, guildId, questionText, type);
    });

    collector.on('end', async (collected, reason) => {
      if (reason === 'time') {
        const curSess = activeGames.get(guildId);
        if (curSess && curSess === session && session.state === 'waiting_for_mode3_choice') {
          await session.textChannel.send(`⏳ **AFK!** Korban ${session.victim} tidak memilih dalam 2 menit.`);
          session.hotseatVictim = null; // Selesai ronde
          await startNextTurn(client, guildId);
        }
      }
    });
  }

  // ═══════════════════════════════════════════════════
  // MODE 2: INTEROGASI (HOT SEAT - BAWAAN)
  // ═══════════════════════════════════════════════════
  else {
    // Saring antrean penanya yang masih aktif di VC
    let nextChallengerId = null;
    while (session.hotseatChallengersQueue.length > 0) {
      const tempId = session.hotseatChallengersQueue.shift();
      if (activePlayers.some(p => p.id === tempId)) {
        nextChallengerId = tempId;
        break;
      }
    }

    // Jika antrean penanya habis untuk korban saat ini, acak korban baru
    if (!nextChallengerId) {
      session.hotseatVictim = null;
      session.hotseatChallengersQueue = [];

      const allVictimsServed = activePlayers.every(p => !session.remainingHotseatVictims.includes(p.id));
      if (allVictimsServed) {
        await announceMatchSummary(client, guildId, 'Semua pemain terdaftar telah giliran berada di Hot Seat.');
        return;
      }

      await startHotseatTransition(client, guildId);
      return;
    }

    const challenger = activePlayers.find(p => p.id === nextChallengerId);
    session.challenger = challenger;
    session.state = 'waiting_for_method_selection';

    // Umumkan giliran lewat TTS
    audio.announceChallengerTurn(client, guildId, challenger.displayName, victim.displayName).catch(() => {});

    // Embed Pemilihan Metode Tantangan
    const turnEmbed = new EmbedBuilder()
      .setColor(0x9933FF)
      .setTitle('🎤 Truth or Dare — Hot Seat')
      .setDescription([
        `🔥 **Korban (Hot Seat):** ${victim}`,
        `🗣️ **Penanya:** ${challenger}`,
        `💬 **Sisa Penanya:** ${session.hotseatChallengersQueue.length} orang lagi`,
        `\n👉 **${challenger}**, silakan pilih metode tantangan di bawah untuk mengajukan pertanyaan kepada **${victim}**:`
      ].join('\n'))
      .setFooter({ text: 'Gunakan tombol di bawah untuk beraksi!' })
      .setTimestamp();

    // Tombol aksi disesuaikan berdasarkan setelan Mode Game
    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('tod_method_truth').setLabel('🟢 Ambil Truth DB').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('tod_method_dare').setLabel('🔴 Ambil Dare DB').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('tod_method_voice').setLabel('🎙️ Voice Mic').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('tod_method_stop').setLabel('⏹️ Stop').setStyle(ButtonStyle.Secondary)
    );

    const turnMessage = await session.textChannel.send({ embeds: [turnEmbed], components: [actionRow] });
    session.message = turnMessage;

    const collector = turnMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120 * 1000 // 2 menit waktu berpikir metode
    });

    collector.on('collect', async (interaction) => {
      const curSess = activeGames.get(guildId);
      if (!curSess || curSess !== session) {
        return interaction.reply({ content: '❌ Sesi game sudah tidak aktif.', ephemeral: true });
      }

      const { customId, user } = interaction;

      // Tombol stop game
      if (customId === 'tod_method_stop') {
        const isAdm = interaction.member.permissions.has('Administrator');
        if (user.id !== session.host.id && !isAdm) {
          return interaction.reply({ content: '❌ Hanya Host/Admin yang bisa menghentikan game!', ephemeral: true });
        }

        collector.stop();
        await announceMatchSummary(client, guildId, `Game diakhiri paksa oleh ${user.username}.`);
        return;
      }

      // Hanya penanya aktif atau admin yang boleh memilih metode
      const isAdmin = interaction.member.permissions.has('Administrator');
      if (user.id !== session.challenger.id && !isAdmin) {
        return interaction.reply({ content: '❌ Hanya penanya aktif saat ini yang boleh merespon!', ephemeral: true });
      }

      collector.stop();
      await interaction.deferUpdate();

      // Jalankan logika pemilihan metode
      if (customId === 'tod_method_truth' || customId === 'tod_method_dare') {
        const type = customId === 'tod_method_truth' ? 'truth' : 'dare';
        const questionObj = database.getRandomQuestion(type, session.category, guildId);

        const questionText = questionObj
          ? questionObj.question_text
          : `Tanyakan satu hal konyol bertema ${session.category.toUpperCase()} kepada korban secara langsung!`;

        await startAnswerPhase(client, guildId, questionText, type);
      } else if (customId === 'tod_method_voice') {
        const promptText = `🎙️ **Tanyakan tantangan/pertanyaan kustom kamu lewat mikrofon secara bebas sekarang!**`;
        await startAnswerPhase(client, guildId, promptText, 'voice');
      }
    });

    // Auto-skip jika penanya AFK memilih metode
    collector.on('end', async (collected, reason) => {
      if (reason === 'time') {
        const curSess = activeGames.get(guildId);
        if (curSess && curSess === session && session.state === 'waiting_for_method_selection') {
          await session.textChannel.send(`⏳ **AFK!** Giliran ${session.challenger} dilewati karena terlalu lama merespon.`);
          await startNextTurn(client, guildId);
        }
      }
    });
  }
}

// ═══════════════════════════════════════════════════

// ═══════════════════════════════════════════════════
// GAME STATE: ANSWER & JUDGMENT
// ═══════════════════════════════════════════════════

async function startAnswerPhase(client, guildId, challengeText, challengeType) {
  const session = activeGames.get(guildId);
  if (!session) return;

  session.state = 'waiting_for_judgment';

  const embed = new EmbedBuilder()
    .setColor(0x00FF88)
    .setTitle('⚖️ JAWAB & PENILAIAN TANTANGAN')
    .setDescription([
      `🔥 **Korban:** ${session.victim}`,
      `🗣️ **Penanya:** ${session.challenger || '🤖 Bot TTS'}`,
      `\n💬 **TANTANGAN (${challengeType.toUpperCase()}):**`,
      `*${challengeText}*`,
      session.mode === 'mode_3'
        ? `\n*(Setelah dijawab/selesai, Host/Admin wajib mengklik tombol di bawah untuk menilai)*`
        : `\n*(Setelah dijawab/selesai, Penanya Aktif wajib mengklik tombol di bawah untuk menilai)*`,
      `\n💵 Hadiah: \`Rp ${config.economy.SUCCESS_REWARD}\` | 💸 Denda: \`Rp ${config.economy.SKIP_FINE}\``
    ].join('\n'))
    .setTimestamp();

  const judgmentRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tod_judge_done').setLabel('✅ Sukses').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('tod_judge_skip').setLabel('❌ Menyerah').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('tod_judge_join').setLabel('🙋‍♂️ Ikut').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('tod_judge_host').setLabel('⚙️ Host Panel').setStyle(ButtonStyle.Secondary)
  );

  const judgmentMessage = await session.textChannel.send({ embeds: [embed], components: [judgmentRow] });
  session.message = judgmentMessage;

  const collector = judgmentMessage.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: config.durations.ANSWER_TIMEOUT_MS // Waktu menjawab (misal 60 detik)
  });

  collector.on('collect', async (interaction) => {
    const curSess = activeGames.get(guildId);
    if (!curSess || curSess !== session) {
      return interaction.reply({ content: '❌ Sesi game sudah tidak aktif.', ephemeral: true });
    }

    const { customId, user } = interaction;

    // 🙋‍♂️ Ikut Bermain tengah jalan
    if (customId === 'tod_judge_join') {
      const clickerMember = interaction.member;
      const vc = clickerMember.voice.channel;
      if (!vc || vc.id !== session.voiceChannelId) {
        return interaction.reply({ content: '❌ Masuk Voice Channel game terlebih dahulu!', ephemeral: true });
      }

      if (session.players.some(p => p.id === user.id)) {
        return interaction.reply({ content: 'ℹ️ Kamu sudah terdaftar sebagai pemain!', ephemeral: true });
      }

      // Tambahkan ke sistem antrean dinamis
      session.players.push(clickerMember);
      session.sessionStats[user.id] = { completed: 0, skipped: 0, coins: 0, asked: 0 };

      if (!session.remainingHotseatVictims.includes(user.id)) {
        session.remainingHotseatVictims.push(user.id);
      }
      if (!session.hotseatChallengersQueue.includes(user.id)) {
        if (!session.hotseatVictim || session.hotseatVictim.id !== user.id) {
          session.hotseatChallengersQueue.push(user.id);
        }
      }

      return interaction.reply({ content: `✅ **${user.username}** berhasil bergabung ke antrean game!` });
    }

    // ⚙️ Host Panel untuk kontrol darurat
    if (customId === 'tod_judge_host') {
      const isAdm = interaction.member.permissions.has('Administrator');
      if (user.id !== session.host.id && !isAdm) {
        return interaction.reply({ content: '❌ Hanya Host/Admin yang bisa mengakses panel kontrol!', ephemeral: true });
      }

      const hostRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('tod_ctrl_skip').setLabel('⏭️ Lompat Putaran').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('tod_ctrl_stop').setLabel('⏹️ Stop Sesi').setStyle(ButtonStyle.Danger)
      );

      const ctrlMsg = await interaction.reply({
        content: '🛠️ **PANEL KONTROL DARURAT HOST**\nSilakan pilih tindakan mitigasi di bawah:',
        components: [hostRow],
        ephemeral: true,
        fetchReply: true
      });

      const ctrlCollector = ctrlMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 15000
      });

      ctrlCollector.on('collect', async (ctrlInteraction) => {
        const activeSess = activeGames.get(guildId);
        if (!activeSess || activeSess !== session) {
          return ctrlInteraction.reply({ content: '❌ Sesi sudah tidak aktif.', ephemeral: true });
        }

        ctrlCollector.stop();
        collector.stop();

        if (ctrlInteraction.customId === 'tod_ctrl_skip') {
          await ctrlInteraction.reply({ content: '✅ Giliran berhasil dilewati oleh Host.', ephemeral: true });
          await startNextTurn(client, guildId);
        } else if (ctrlInteraction.customId === 'tod_ctrl_stop') {
          await ctrlInteraction.reply({ content: '✅ Sesi game berhasil dihentikan.', ephemeral: true });
          await announceMatchSummary(client, guildId, `Game dihentikan paksa oleh Host ${user.username}.`);
        }
      });
      return;
    }

    // Saring untuk tombol ✅ Sukses / ❌ Menyerah
    if (customId === 'tod_judge_done' || customId === 'tod_judge_skip') {
      const isAdm = interaction.member.permissions.has('Administrator');
      const isHost = user.id === session.host.id;
      const isChallenger = session.challenger && user.id === session.challenger.id;

      // Di Mode 3, yang menilai adalah Host. Di mode lain, yang menilai adalah Challenger aktif.
      const isAllowedToJudge = session.mode === 'mode_3' ? (isHost || isAdm) : (isChallenger || isAdm);

      if (!isAllowedToJudge) {
        const expectedRole = session.mode === 'mode_3' ? 'Host/Admin' : 'Penanya aktif';
        return interaction.reply({ content: `❌ Hanya ${expectedRole} yang berhak menilai giliran ini!`, ephemeral: true });
      }

      collector.stop();
      await interaction.deferUpdate();

      const victimId = session.victim.id;
      const challengerId = session.challenger ? session.challenger.id : null;
      let transactionEmbed;

      if (session.mode === 'mode_1' || session.mode === 'mode_3') {
        session.hotseatVictim = null; // Selesai ronde korban ini
      }

      if (customId === 'tod_judge_done') {
        // Berikan hadiah ke Korban & bonus ke Penanya
        database.incrementGameStats(victimId, challengeType !== 'voice' ? challengeType : 'truth');
        database.rewardUser(victimId, guildId, config.economy.SUCCESS_REWARD, false);
        if (challengerId) {
          database.rewardUser(challengerId, guildId, config.economy.ACTIVE_CHALLENGER_BONUS, true);
        }

        // Rekap statistik sesi lokal
        session.sessionStats[victimId].completed += 1;
        session.sessionStats[victimId].coins += config.economy.SUCCESS_REWARD;
        if (challengerId) {
          session.sessionStats[challengerId].asked += 1;
          session.sessionStats[challengerId].coins += config.economy.ACTIVE_CHALLENGER_BONUS;
        }

        transactionEmbed = EmbedBuilder.from(embed)
          .setColor(0x00FF88)
          .setDescription([
            `🎉 **${session.victim} Berhasil!** Dinilai sukses oleh ${session.mode === 'mode_3' ? 'Host' : session.challenger}`,
            `\n💵 **TRANSAKSI ROL EKONOMI:**`,
            `* 🎁 **${session.victim}**: \`+Rp ${config.economy.SUCCESS_REWARD}\` (Hadiah Sukses)`,
            challengerId ? `* 🎁 **${session.challenger}**: \`+Rp ${config.economy.ACTIVE_CHALLENGER_BONUS}\` (Bonus Penanya Aktif)` : ''
          ].filter(Boolean).join('\n'));

        audio.announceSuccess(client, guildId, session.victim.displayName, config.economy.SUCCESS_REWARD).catch(() => {});
      } else {
        // Denda Korban
        database.incrementSkipStats(victimId);
        database.fineUser(victimId, guildId, config.economy.SKIP_FINE);

        // Rekap statistik sesi lokal
        session.sessionStats[victimId].skipped += 1;
        session.sessionStats[victimId].coins -= config.economy.SKIP_FINE;
        if (challengerId) {
          session.sessionStats[challengerId].asked += 1;
        }

        transactionEmbed = EmbedBuilder.from(embed)
          .setColor(0xFF3366)
          .setDescription([
            `❌ **${session.victim} Menyerah!** Tantangan gagal atau dilewati.`,
            `\n💵 **TRANSAKSI ROL EKONOMI:**`,
            `* 💸 **${session.victim}**: \`-Rp ${config.economy.SKIP_FINE}\` (Denda Kegagalan)`
          ].join('\n'));

        audio.announceSkip(client, guildId, session.victim.displayName, config.economy.SKIP_FINE).catch(() => {});
      }

      // Tampilkan tombol transisi putaran berikutnya
      const nextTurnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('tod_next_turn').setLabel('▶️ Lanjut Sekarang').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('tod_next_join').setLabel('🙋‍♂️ Ikut').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('tod_next_stop').setLabel('⏹️ Stop').setStyle(ButtonStyle.Danger)
      );

      await judgmentMessage.edit({ embeds: [transactionEmbed], components: [nextTurnRow] });

      // Pasang auto-lanjut timer 5 detik
      session.timer = setTimeout(async () => {
        const s = activeGames.get(guildId);
        if (s && s === session) {
          await judgmentMessage.edit({ components: [] }).catch(() => {});
          await startNextTurn(client, guildId);
        }
      }, config.durations.TRANSITION_DELAY_MS);

      // Collector untuk tombol transisi
      const transCollector = judgmentMessage.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: config.durations.TRANSITION_DELAY_MS
      });

      transCollector.on('collect', async (btnInteraction) => {
        const s = activeGames.get(guildId);
        if (!s || s !== session) {
          return btnInteraction.reply({ content: '❌ Sesi game sudah tidak aktif.', ephemeral: true });
        }

        const btnUser = btnInteraction.user;

        if (btnInteraction.customId === 'tod_next_join') {
          const m = btnInteraction.member;
          const vc = m.voice.channel;
          if (!vc || vc.id !== session.voiceChannelId) {
            return btnInteraction.reply({ content: '❌ Masuk Voice Channel game terlebih dahulu!', ephemeral: true });
          }
          if (session.players.some(p => p.id === btnUser.id)) {
            return btnInteraction.reply({ content: 'ℹ️ Kamu sudah terdaftar!', ephemeral: true });
          }

          session.players.push(m);
          session.sessionStats[btnUser.id] = { completed: 0, skipped: 0, coins: 0, asked: 0 };

          if (!session.remainingHotseatVictims.includes(btnUser.id)) {
            session.remainingHotseatVictims.push(btnUser.id);
          }
          if (!session.hotseatChallengersQueue.includes(btnUser.id)) {
            if (!session.hotseatVictim || session.hotseatVictim.id !== btnUser.id) {
              session.hotseatChallengersQueue.push(btnUser.id);
            }
          }

          return btnInteraction.reply({ content: `✅ **${btnUser.username}** bergabung ke antrean game!` });
        }

        if (btnInteraction.customId === 'tod_next_stop') {
          const isAdm = btnInteraction.member.permissions.has('Administrator');
          if (btnUser.id !== session.host.id && !isAdm) {
            return btnInteraction.reply({ content: '❌ Hanya Host/Admin yang bisa menghentikan game!', ephemeral: true });
          }

          if (session.timer) clearTimeout(session.timer);
          transCollector.stop();
          await btnInteraction.deferUpdate();
          await announceMatchSummary(client, guildId, `Game dihentikan oleh ${btnUser.username}.`);
        }

        if (btnInteraction.customId === 'tod_next_turn') {
          if (session.timer) clearTimeout(session.timer);
          transCollector.stop();
          await btnInteraction.deferUpdate();
          await startNextTurn(client, guildId);
        }
      });
    }
  });

  // Penanganan Auto-skip dan auto-denda ringan jika korban AFK saat menjawab
  collector.on('end', async (collected, reason) => {
    if (reason === 'time') {
      const curSess = activeGames.get(guildId);
      if (curSess && curSess === session && session.state === 'waiting_for_judgment') {
        const victimId = session.victim.id;
        const afkFine = Math.ceil(config.economy.SKIP_FINE / 2); // Setengah denda jika AFK

        database.incrementSkipStats(victimId);
        database.fineUser(victimId, guildId, afkFine);

        session.sessionStats[victimId].skipped += 1;
        session.sessionStats[victimId].coins -= afkFine;

        if (session.mode === 'mode_1' || session.mode === 'mode_3') {
          session.hotseatVictim = null; // Selesai ronde
        }

        await session.textChannel.send(`⏳ **AFK Timeout!** Korban ${session.victim} tidak menjawab tantangan dalam 60 detik. Dikenakan denda AFK sebesar **Rp ${afkFine}**.`);
        await startNextTurn(client, guildId);
      }
    }
  });
}

// ═══════════════════════════════════════════════════
// GAME STATE: MATCH SUMMARY (END GAME)
// ═══════════════════════════════════════════════════

async function announceMatchSummary(client, guildId, reason) {
  const session = activeGames.get(guildId);
  if (!session) return;

  if (session.timer) clearTimeout(session.timer);

  const stats = session.sessionStats;
  let mvp = { id: null, completed: -1 };
  let chicken = { id: null, skipped: -1 };
  let rich = { id: null, coins: -9999 };
  let chatter = { id: null, asked: -1 };

  for (const [userId, uStat] of Object.entries(stats)) {
    if (uStat.completed > mvp.completed) mvp = { id: userId, completed: uStat.completed };
    if (uStat.skipped > chicken.skipped) chicken = { id: userId, skipped: uStat.skipped };
    if (uStat.coins > rich.coins) rich = { id: userId, coins: uStat.coins };
    if (uStat.asked > chatter.asked) chatter = { id: userId, asked: uStat.asked };
  }

  const formatUser = (userId) => (userId ? `<@${userId}>` : '*Tidak ada*');

  const summaryEmbed = new EmbedBuilder()
    .setColor(0xFF0055)
    .setTitle('🏁 TRUTH OR DARE: MATCH REKAPITULASI')
    .setDescription([
      `Game telah dihentikan secara profesional.`,
      `**Alasan:** \`${reason}\``,
      `\n🏆 **BINTANG LAPANGAN (MVP):**`,
      `👉 ${formatUser(mvp.id)} dengan \`${mvp.completed} tantangan selesai\`!`,
      `\n🐔 **CHICKEN OF THE MATCH (Penakut):**`,
      `👉 ${formatUser(chicken.id)} dengan \`${chicken.skipped} kali menyerah\`.`,
      `\n💰 **RAJA KOIN (Earning Tertinggi):**`,
      `👉 ${formatUser(rich.id)} dengan total \`Rp ${rich.coins.toLocaleString('id-ID')}\`.`,
      `\n🎙️ **PENANYA PALING AKTIF:**`,
      `👉 ${formatUser(chatter.id)} dengan \`${chatter.asked} pertanyaan diajukan\`.`,
      `\nSampai jumpa di permainan berikutnya! Gunakan perintah \`.tod\` untuk bermain kembali.`
    ].join('\n'))
    .setFooter({ text: 'Sentinel Bot — Professional Game Module' })
    .setTimestamp();

  await session.textChannel.send({ embeds: [summaryEmbed] });
  cleanSession(guildId);
}

// ═══════════════════════════════════════════════════
// PUBLIC LEADERBOARD & STATS COMMANDS
// ═══════════════════════════════════════════════════

async function sendTodLeaderboard(message, client) {
  const topDares = database.getTopDares(3);
  const topTruths = database.getTopTruths(3);
  const topSkips = database.getTopSkips(3);

  const formatList = (list, key) => {
    if (list.length === 0) return '*Belum ada record*';
    return list.map((item, idx) => {
      const userString = `<@${item.user_id}>`;
      const score = item[key];
      return `\`#${idx + 1}\` ${userString} • **${score}** kali`;
    }).join('\n');
  };

  const embed = new EmbedBuilder()
    .setColor(0xFFAA00)
    .setTitle('🏆 PAPAN PRESTASI TRUTH OR DARE (ToD) 🏆')
    .setDescription('Berikut adalah daftar rekor pemain ToD terhebat dan ter-penakut di server ini secara kumulatif:')
    .addFields([
      { name: '🟢 Master Truth (Jujur Terbanyak)', value: formatList(topTruths, 'truths_answered'), inline: false },
      { name: '🔴 Master Dare (Pemberani Terbanyak)', value: formatList(topDares, 'dares_completed'), inline: false },
      { name: '🐔 Chicken List (Skip Terbanyak)', value: formatList(topSkips, 'skips_count'), inline: false }
    ])
    .setFooter({ text: 'Sentinel Bot • ToD Hall of Fame' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

async function sendUserStats(message, userId) {
  const stats = database.getUserStats(userId);

  const embed = new EmbedBuilder()
    .setColor(0x00FFBB)
    .setTitle('📊 PROFIL Realtime Truth or Dare')
    .setDescription(`Menampilkan data statistik bermain ToD kumulatif untuk <@${userId}>:`)
    .addFields([
      { name: '🟢 Truth Terjawab', value: `\`${stats.truths_answered}\` kali`, inline: true },
      { name: '🔴 Dare Selesai', value: `\`${stats.dares_completed}\` kali`, inline: true },
      { name: '🐔 Menyerah (Skip)', value: `\`${stats.skips_count}\` kali`, inline: true },
      { name: '💰 Total Earning', value: `\`Rp ${stats.total_coins_earned.toLocaleString('id-ID')}\``, inline: true },
      { name: '💸 Total Denda Paid', value: `\`Rp ${stats.total_fines_paid.toLocaleString('id-ID')}\``, inline: true }
    ])
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

// ═══════════════════════════════════════════════════
// TEXT COMMAND ROUTER / INTERCEPTOR
// ═══════════════════════════════════════════════════

async function handleVoiceTodCommand(message, client) {
  if (message.author.bot) return false;

  const content = message.content.trim().split(/ +/);
  const prefixCmd = content.shift().toLowerCase();
  
  if (prefixCmd !== '.tod' && prefixCmd !== '.truthordare') return false;

  const subCommand = content[0]?.toLowerCase();

  // ── Sub-perintah 1: `.tod top` atau `.tod leaderboard`
  if (subCommand === 'top' || subCommand === 'leaderboard') {
    await sendTodLeaderboard(message, client);
    return true;
  }

  // ── Sub-perintah 2: `.tod status` atau `.tod stats`
  if (subCommand === 'status' || subCommand === 'stats') {
    const targetUser = message.mentions.users.first() || message.author;
    await sendUserStats(message, targetUser.id);
    return true;
  }

  // ── Sub-perintah 3: `.tod stop` atau `.tod force-end` (Admin/Host Only)
  if (subCommand === 'stop' || subCommand === 'force-end') {
    const session = activeGames.get(message.guildId);
    if (!session) {
      return message.reply('❌ Tidak ada sesi game Truth or Dare yang sedang aktif di server ini.');
    }

    const isAdm = message.member.permissions.has('Administrator');
    if (message.author.id !== session.host.id && !isAdm) {
      return message.reply('❌ Hanya Host atau Administrator yang bisa memberhentikan game paksa!');
    }

    await announceMatchSummary(client, message.guildId, `Diberhentikan paksa oleh ${message.author.username}.`);
    return true;
  }

  // ── Sub-perintah 4: `.tod add <truth/dare> <chill/deep/spicy> <teks>`
  if (subCommand === 'add') {
    const isAdm = message.member.permissions.has('Administrator');
    if (!isAdm) {
      return message.reply('❌ Hanya Administrator yang berhak menambahkan pertanyaan kustom ke database!');
    }

    const type = content[1]?.toLowerCase();
    const cat = content[2]?.toLowerCase();
    const questionText = content.slice(3).join(' ');

    if (!type || !cat || !questionText || !['truth', 'dare'].includes(type) || !['chill', 'deep', 'spicy'].includes(cat)) {
      return message.reply('❌ **Format salah!** Gunakan:\n👉 `.tod add <truth/dare> <chill/deep/spicy> <teks pertanyaan>`');
    }

    database.addCustomQuestion(type, cat, questionText, message.author.tag);
    return message.reply(`✅ Sukses menambahkan kustom **${type.toUpperCase()}** bertema **${cat.toUpperCase()}** ke database!`);
  }

  // ── Sub-perintah 5: `.tod announce [#channel]`
  if (subCommand === 'announce') {
    const isAdm = message.member.permissions.has('Administrator');
    if (!isAdm) {
      return message.reply('❌ Hanya Administrator yang dapat menyiarkan pengumuman game ToD!');
    }

    const targetChannel = message.mentions.channels.first() || message.channel;

    const embed = new EmbedBuilder()
      .setColor(0x9933FF)
      .setTitle('🎤 TRUTH OR DARE GAME MULTIPLAYER — LAUNCHED 🎤')
      .setDescription([
        'Kami dengan bangga meluncurkan fitur game interaktif baru di server ini: **Truth or Dare (ToD) Ultimate Hot Seat**!',
        'Kalian kini bisa menguji keberanian, rahasia terdalam, dan kejujuran bersama teman-teman langsung di Voice Channel! 😎',
        '\n🎮 **ATURAN UTAMA GAME:**',
        '1️⃣ Satu orang terpilih secara acak sebagai **Korban Hot Seat**.',
        '2️⃣ Seluruh pemain lain akan bergantian bertanya/menantang korban.',
        '3️⃣ Korban menjawab tantangan/pertanyaan lewat suara mikrofon VC.',
        '4️⃣ Penilaian sukses memberi **+Rp 35** dan **+Rp 10** bonus penanya aktif!',
        '5️⃣ Menyerah/Skip memberi denda **-Rp 20** koin rupiah server.',
        '\n💡 **BAGAIMANA CARA BERMAIN?**',
        '💬 Masuk ke **Voice Channel** bersama bot Sentinel.',
        '👉 Ketik **`.tod`** di text channel untuk membuka game lobi pendaftaran!',
        '👉 Ketik **`.tod status`** untuk mengecek total koin, rekor tantangan, dan statistik bermain kamu.'
      ].join('\n'))
      .setFooter({ text: 'Ayo ramaikan Voice Channel sekarang! 🎙️' })
      .setTimestamp();

    await targetChannel.send({ embeds: [embed] });
    if (targetChannel.id !== message.channel.id) {
      await message.reply(`✅ Berhasil menyiarkan pengumuman game ToD ke channel ${targetChannel}!`);
    }
    return true;
  }

  // ── Jalankan Permainan Utama
  await startTodGame(message, client);
  return true;
}

function forceStopTodGame(guildId) {
  cleanSession(guildId);
  try {
    audio.clearVoiceConnection(guildId);
  } catch (e) {}
}

module.exports = {
  handleVoiceTodCommand,
  forceStopTodGame
};
