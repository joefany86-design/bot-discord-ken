const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  getVoiceConnection,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const config = require('./config');
const database = require('./database');
const audio = require('./audio');

// ═══════════════════════════════════════════════════
// STATE TRACKING
// ═══════════════════════════════════════════════════

// Sesi game aktif per guild: Map<guildId, gameSession>
const activeGames = new Map();

// Cooldown manual per user: Map<userId, timestamp>
const manualCooldowns = new Map();

// Track untuk undangan otomatis (Auto Events): Map<guildId, { lastInvitedAt: number }>
const autoEventStates = new Map();

// Pemantauan waktu aktif VC: Map<channelId, { since: number, activeUsers: Set<string> }>
const vcActiveTrackers = new Map();

// ═══════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════

/**
 * Mengecek apakah user berada di cooldown manual.
 */
function getCooldownRemaining(userId) {
  const lastUsed = manualCooldowns.get(userId);
  if (!lastUsed) return 0;

  const elapsed = Date.now() - lastUsed;
  if (elapsed >= config.durations.COOLDOWN_MS) return 0;

  return Math.ceil((config.durations.COOLDOWN_MS - elapsed) / 1000);
}

/**
 * Menghentikan game dan merapikan resources.
 */
function cleanSession(guildId) {
  const session = activeGames.get(guildId);
  if (session && session.timer) {
    clearTimeout(session.timer);
  }
  activeGames.delete(guildId);
}

/**
 * Mengacak urutan elemen dalam array secara in-place.
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// ═══════════════════════════════════════════════════
/**
 * Membuat komponen tombol lobby pendaftaran dengan kategori aktif yang tersorot.
 */
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
      .setCustomId('tod_lobby_start')
      .setLabel('🚀 Mulai Game')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('tod_lobby_cancel')
      .setLabel('❌ Batalkan')
      .setStyle(ButtonStyle.Danger)
  );

  return [lobbyRow];
}

/**
 * Memulai sesi game ToD baru (fase Lobby pendaftaran).
 */
async function startTodGame(message, client, category = 'chill') {
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
    category: 'custom', // Selalu mode kustom (ucap apa aja)
    mode: 'voice_hotseat', // Mode tetap: Hot Seat Voice
    state: 'lobby',
    host: member,
    players: [member],
    currentTurnIndex: -1,
    victim: null,
    challenger: null,
    timer: null,
    message: null,
    remainingHotseatVictims: [],
    hotseatVictim: null,
    hotseatChallengersQueue: []
  };
  activeGames.set(guildId, session);

  // 6. Buat Embed Lobby
  const embed = new EmbedBuilder()
    .setColor(0x9933FF)
    .setTitle('🎤 TRUTH OR DARE — HOT SEAT VOICE')
    .setDescription([
      `🎙️ Sesi Truth or Dare dibuka! Tanya apa aja lewat mikrofon!`,
      `\n👑 **Host:** ${member}`,
      `⏱️ **Waktu:** Tanpa Batas ♾️`,
      `\n👥 **Pemain (${session.players.length}):**`,
      `1. ${member} (👑 Host)`
    ].join('\n'))
    .setFooter({ text: 'Masuk Voice Channel lalu klik Gabung!' })
    .setTimestamp();

  const lobbyComponents = getLobbyComponents(session);
  const lobbyMessage = await textChannel.send({ embeds: [embed], components: lobbyComponents });
  session.message = lobbyMessage;

  // Umumkan lewat TTS bahwa lobby dibuka
  audio.announceGameStart(client, guildId).catch(() => { });

  const collector = lobbyMessage.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 3600 * 1000 // Tanpa batas waktu
  });

  collector.on('collect', async (interaction) => {
    // Ambil ulang sesi terbaru
    const currentSession = activeGames.get(guildId);
    if (!currentSession || currentSession !== session) {
      return interaction.reply({ content: '❌ Sesi lobby ini sudah tidak aktif.', ephemeral: true });
    }

    const { customId, user } = interaction;

    if (customId === 'tod_lobby_join') {
      // Pastikan pemain berada di VC yang sama
      const clickerMember = interaction.member;
      const clickerVoiceChannel = clickerMember.voice.channel;
      if (!clickerVoiceChannel || clickerVoiceChannel.id !== session.voiceChannelId) {
        return interaction.reply({ content: '❌ Kamu harus berada di **Voice Channel** yang sama untuk bergabung!', ephemeral: true });
      }

      // Cek apakah sudah gabung
      if (session.players.some(p => p.id === user.id)) {
        return interaction.reply({ content: 'ℹ️ Kamu sudah terdaftar di dalam lobby!', ephemeral: true });
      }

      session.players.push(clickerMember);
      await updateLobbyEmbed(interaction, session);
    } 
    
    else if (customId === 'tod_lobby_leave') {
      // Cek apakah terdaftar
      if (!session.players.some(p => p.id === user.id)) {
        return interaction.reply({ content: '❌ Kamu belum bergabung di lobby ini!', ephemeral: true });
      }

      // Hapus dari daftar pemain
      session.players = session.players.filter(p => p.id !== user.id);
      await updateLobbyEmbed(interaction, session);
    }

    else if (customId === 'tod_lobby_start') {
      // Hanya Host atau Admin yang bisa memulai
      const isAdmin = interaction.member.permissions.has('Administrator');
      if (user.id !== session.host.id && !isAdmin) {
        return interaction.reply({ content: '❌ Hanya Host (pembuat lobby) atau Admin yang bisa memulai game!', ephemeral: true });
      }

      // Validasi minimal 2 pemain
      const guildInstance = interaction.guild;
      const voiceChan = guildInstance.channels.cache.get(session.voiceChannelId);
      const playersInVc = session.players.filter(p => voiceChan?.members.has(p.id));

      if (playersInVc.length < 2) {
        return interaction.reply({ content: '❌ **Gagal memulai!** Harus ada minimal 2 pemain terdaftar yang aktif di Voice Channel saat ini.', ephemeral: true });
      }

      // Update daftar pemain dengan yang benar-benar ada di VC
      session.players = playersInVc;

      // Hentikan timer & collector lobby
      if (session.timer) clearTimeout(session.timer);
      collector.stop();

      // Acak urutan giliran pemain (Shuffle)
      session.players = shuffleArray(session.players);
      session.currentTurnIndex = -1; // Akan dinaikkan menjadi 0 di startNextTurn

      // Masuk ke putaran pertama
      await interaction.deferUpdate();
      await startNextTurn(client, guildId);
    } 
    
    else if (customId === 'tod_lobby_cancel') {
      // Hanya Host atau Admin yang bisa membatalkan
      const isAdmin = interaction.member.permissions.has('Administrator');
      if (user.id !== session.host.id && !isAdmin) {
        return interaction.reply({ content: '❌ Hanya Host atau Admin yang bisa membatalkan lobby ini!', ephemeral: true });
      }

      if (session.timer) clearTimeout(session.timer);
      collector.stop();
      cleanSession(guildId);

      const currentComponents = getLobbyComponents(session);
      const disabledComponents = currentComponents.map(row => {
        const disabledRow = ActionRowBuilder.from(row);
        disabledRow.components.forEach(comp => comp.setDisabled(true));
        return disabledRow;
      });

      const cancelledEmbed = EmbedBuilder.from(embed)
        .setColor(0xFF3366)
        .setDescription(`❌ Lobby Truth or Dare dibatalkan oleh ${user}.`);

      await interaction.update({ embeds: [cancelledEmbed], components: disabledComponents });
    }
  });
}

/**
 * Memperbarui embed lobby pendaftaran secara real-time.
 */
async function updateLobbyEmbed(interaction, session) {
  const playerListString = session.players.map((p, index) => {
    const isHost = p.id === session.host.id;
    return `${index + 1}. ${p} ${isHost ? '(👑 Host)' : ''}`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setColor(0x9933FF)
    .setTitle('🎤 TRUTH OR DARE — HOT SEAT VOICE')
    .setDescription([
      `🎙️ Sesi Truth or Dare dibuka! Tanya apa aja lewat mikrofon!`,
      `\n👑 **Host:** ${session.host}`,
      `⏱️ **Waktu:** Tanpa Batas ♾️`,
      `\n👥 **Pemain (${session.players.length}):**`,
      playerListString || '*Belum ada pemain*'
    ].join('\n'))
    .setFooter({ text: 'Masuk Voice Channel lalu klik Gabung!' })
    .setTimestamp();

  const components = getLobbyComponents(session);
  await interaction.update({ embeds: [embed], components });
}

/**
 * Memulai putaran/giliran baru dalam game.
 */
async function startNextTurn(client, guildId) {
  const session = activeGames.get(guildId);
  if (!session) return;

  // 1. Bersihkan timer lama jika ada
  if (session.timer) clearTimeout(session.timer);

  // 2. Ambil referensi Guild dan Voice Channel
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    cleanSession(guildId);
    return;
  }

  const voiceChannel = guild.channels.cache.get(session.voiceChannelId);
  if (!voiceChannel) {
    cleanSession(guildId);
    await session.textChannel.send('❌ **Game Berakhir!** Voice Channel permainan tidak ditemukan.');
    return;
  }

  // 3. Saring pemain terdaftar yang MASIH berada di Voice Channel
  const activePlayers = session.players.filter(p => voiceChannel.members.has(p.id));
  if (activePlayers.length < 2) {
    cleanSession(guildId);
    const embed = new EmbedBuilder()
      .setColor(0xFF3366)
      .setTitle('🏁 Game Truth or Dare Selesai!')
      .setDescription('👥 **Game Berakhir!** Jumlah pemain aktif di Voice Channel kurang dari 2 orang.');
    await session.textChannel.send({ embeds: [embed] });
    return;
  }

  // Simpan list aktif terbaru ke session.players agar sinkron
  session.players = activePlayers;

  let victim = null;
  let challenger = null;

  // LOGIK HOT SEAT VOICE (Semua Tanya Satu via Mikrofon)
  if (!session.remainingHotseatVictims) {
    session.remainingHotseatVictims = [];
  }
  if (!session.hotseatChallengersQueue) {
    session.hotseatChallengersQueue = [];
  }

  // Saring korban yang masih aktif di VC
  let victimCandidates = activePlayers.filter(p => session.remainingHotseatVictims.includes(p.id));
  const currentVictimInVc = session.hotseatVictim && activePlayers.some(p => p.id === session.hotseatVictim.id);

  // Jika belum ada korban hotseat, atau korban keluar dari VC, atau antrean penanya habis
  if (!session.hotseatVictim || !currentVictimInVc || session.hotseatChallengersQueue.length === 0) {
    if (victimCandidates.length === 0) {
      session.remainingHotseatVictims = activePlayers.map(p => p.id);
      victimCandidates = [...activePlayers];

      if (session.hotseatVictim && victimCandidates.length > 1) {
        victimCandidates = victimCandidates.filter(p => p.id !== session.hotseatVictim.id);
      }
    }

    // Ambil korban hotseat secara acak
    const chosenVictim = victimCandidates[Math.floor(Math.random() * victimCandidates.length)];
    session.remainingHotseatVictims = session.remainingHotseatVictims.filter(id => id !== chosenVictim.id);
    session.hotseatVictim = chosenVictim;

    // Antrean penanya adalah semua pemain aktif selain korban
    let challengers = activePlayers.filter(p => p.id !== chosenVictim.id);
    challengers = shuffleArray(challengers);
    session.hotseatChallengersQueue = challengers.map(p => p.id);

    // Umumkan pergantian target Hot Seat
    const newHotseatEmbed = new EmbedBuilder()
      .setColor(0xFF3366)
      .setTitle('🔥 HOT SEAT BARU!')
      .setDescription(`👑 **${chosenVictim}** sekarang berada di **Hot Seat**!\nSemua pemain lain akan bergantian mengajukan pertanyaan kepada ${chosenVictim}!`)
      .setTimestamp();
    await session.textChannel.send({ embeds: [newHotseatEmbed] });

    await audio.speak(client, guildId, `${chosenVictim.displayName} sekarang berada di Hot Seat! Persiapkan diri Anda.`).catch(() => {});
  }

  // Ambil penanya berikutnya yang masih aktif di VC
  let nextChallengerId = null;
  while (session.hotseatChallengersQueue.length > 0) {
    const tempId = session.hotseatChallengersQueue.shift();
    if (activePlayers.some(p => p.id === tempId)) {
      nextChallengerId = tempId;
      break;
    }
  }

  // Jika antrean kosong (tidak ada penanya aktif tersisa), pilih korban baru secara rekursif
  if (!nextChallengerId) {
    session.hotseatVictim = null;
    session.hotseatChallengersQueue = [];
    return startNextTurn(client, guildId);
  }

  victim = session.hotseatVictim;
  challenger = activePlayers.find(p => p.id === nextChallengerId);

  // Update properti sesi
  session.victim = victim;
  session.challenger = challenger;
  session.state = 'waiting_for_completion';

  // === EMBED LANGSUNG — Challenger bicara lewat mic ===
  const embed = new EmbedBuilder()
    .setColor(0x9933FF)
    .setTitle('🎤 Truth or Dare — Hot Seat Voice')
    .setDescription([
      `🔥 **Korban:** ${victim}`,
      `🗣️ **Penanya:** ${challenger}`,
      `💬 **Sisa Penanya:** ${session.hotseatChallengersQueue.length} orang`,
      `\n🎙️ **${challenger}, tanya/tantang ${victim} lewat mikrofon!**`,
      `*(Setelah dijawab, klik tombol di bawah)*`,
      `\n💵 Denda: \`Rp ${config.economy.SKIP_FINE.toLocaleString('id-ID')}\` | 🎁 Hadiah: \`Rp ${config.economy.SUCCESS_REWARD.toLocaleString('id-ID')}\``
    ].join('\n'))
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('tod_done')
      .setLabel('✅ Sukses')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('tod_skip')
      .setLabel('❌ Menyerah')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('tod_join')
      .setLabel('🙋‍♂️ Ikut')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('tod_end')
      .setLabel('⏹️ Stop')
      .setStyle(ButtonStyle.Secondary)
  );

  const turnMessage = await session.textChannel.send({ embeds: [embed], components: [row] });
  session.message = turnMessage;

  // TTS singkat
  audio.speak(client, guildId, `${challenger.displayName} bertanya ke ${victim.displayName}!`).catch(() => {});

  // Collector — semua tombol dalam satu tempat
  const collector = turnMessage.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 3600 * 1000
  });

  collector.on('collect', async (interaction) => {
    const currentSession = activeGames.get(guildId);
    if (!currentSession || currentSession !== session) {
      return interaction.reply({ content: '❌ Sesi sudah tidak aktif.', ephemeral: true });
    }

    const { customId } = interaction;

    // 🙋‍♂️ Ikut Bermain
    if (customId === 'tod_join') {
      const member = interaction.member;
      const vc = member.voice.channel;
      if (!vc || vc.id !== session.voiceChannelId) {
        return interaction.reply({ content: '❌ Masuk Voice Channel dulu!', ephemeral: true });
      }
      if (session.players.some(p => p.id === interaction.user.id)) {
        return interaction.reply({ content: 'ℹ️ Kamu sudah terdaftar!', ephemeral: true });
      }
      session.players.push(member);
      return interaction.reply({ content: `✅ **${interaction.user.username}** bergabung!` });
    }

    // ⏹️ Stop Game
    if (customId === 'tod_end') {
      const isAdmin = interaction.member.permissions.has('Administrator');
      if (interaction.user.id !== session.host.id && !isAdmin) {
        return interaction.reply({ content: '❌ Hanya Host/Admin!', ephemeral: true });
      }
      if (session.timer) clearTimeout(session.timer);
      collector.stop();
      cleanSession(guildId);
      const endEmbed = EmbedBuilder.from(embed)
        .setColor(0xFF3366)
        .setDescription(`🛑 Game diakhiri oleh ${interaction.user}.`);
      return interaction.update({ embeds: [endEmbed], components: [] });
    }

    // ✅ Sukses / ❌ Menyerah — hanya Penanya (Challenger) atau Admin
    if (customId === 'tod_done' || customId === 'tod_skip') {
      const isAdmin = interaction.member.permissions.has('Administrator');
      if (interaction.user.id !== session.challenger.id && !isAdmin) {
        return interaction.reply({ content: '❌ Hanya Penanya/Admin yang bisa menilai!', ephemeral: true });
      }

      collector.stop();
      const victimId = session.victim.id;
      let resultEmbed;

      if (customId === 'tod_done') {
        database.incrementGameStats(victimId, 'truth');
        database.rewardUser(victimId, guildId, config.economy.SUCCESS_REWARD);
        resultEmbed = EmbedBuilder.from(embed)
          .setColor(0x00FF88)
          .setDescription(`🎉 **${session.victim} Berhasil!** Dinilai oleh ${session.challenger}\n🎁 **+Rp ${config.economy.SUCCESS_REWARD.toLocaleString('id-ID')}**`);
        audio.announceSuccess(client, guildId, session.victim.displayName, config.economy.SUCCESS_REWARD).catch(() => {});
      } else {
        database.incrementSkipStats(victimId);
        database.fineUser(victimId, guildId, config.economy.SKIP_FINE);
        resultEmbed = EmbedBuilder.from(embed)
          .setColor(0xFF3366)
          .setDescription(`❌ **${session.victim} Menyerah!**\n💸 **Denda: Rp ${config.economy.SKIP_FINE.toLocaleString('id-ID')}**`);
        audio.announceSkip(client, guildId, session.victim.displayName, config.economy.SKIP_FINE).catch(() => {});
      }

      // Tombol lanjut setelah penilaian
      const nextRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('tod_next')
          .setLabel('▶️ Lanjut')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('tod_join_next')
          .setLabel('🙋‍♂️ Ikut')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('tod_stop')
          .setLabel('⏹️ Stop')
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.update({ embeds: [resultEmbed], components: [nextRow] });

      // Auto-lanjut 5 detik
      session.timer = setTimeout(async () => {
        const s = activeGames.get(guildId);
        if (s && s === session) {
          await turnMessage.edit({ components: [] }).catch(() => {});
          startNextTurn(client, guildId);
        }
      }, 5000);

      // Collector untuk tombol lanjut
      const nextCollector = turnMessage.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 5000
      });

      nextCollector.on('collect', async (btnInteraction) => {
        const s = activeGames.get(guildId);
        if (!s || s !== session) {
          return btnInteraction.reply({ content: '❌ Sesi sudah tidak aktif.', ephemeral: true });
        }

        if (btnInteraction.customId === 'tod_join_next') {
          const m = btnInteraction.member;
          const vc = m.voice.channel;
          if (!vc || vc.id !== session.voiceChannelId) {
            return btnInteraction.reply({ content: '❌ Masuk Voice Channel dulu!', ephemeral: true });
          }
          if (session.players.some(p => p.id === btnInteraction.user.id)) {
            return btnInteraction.reply({ content: 'ℹ️ Kamu sudah terdaftar!', ephemeral: true });
          }
          session.players.push(m);
          return btnInteraction.reply({ content: `✅ **${btnInteraction.user.username}** bergabung!` });
        }

        if (btnInteraction.customId === 'tod_stop') {
          const isAdm = btnInteraction.member.permissions.has('Administrator');
          if (btnInteraction.user.id !== session.host.id && !isAdm) {
            return btnInteraction.reply({ content: '❌ Hanya Host/Admin!', ephemeral: true });
          }
          if (session.timer) clearTimeout(session.timer);
          nextCollector.stop();
          cleanSession(guildId);
          const stopEmbed = EmbedBuilder.from(resultEmbed)
            .setColor(0xFF3366)
            .setDescription(`🛑 Game diakhiri oleh ${btnInteraction.user}.`);
          return btnInteraction.update({ embeds: [stopEmbed], components: [] });
        }

        if (btnInteraction.customId === 'tod_next') {
          if (session.timer) clearTimeout(session.timer);
          nextCollector.stop();
          await btnInteraction.update({ components: [] }).catch(() => {});
          startNextTurn(client, guildId);
        }
      });
    }
  });
}

// ═══════════════════════════════════════════════════
// VOICE STATE AUTO-EVENT TRIGGER
// ═══════════════════════════════════════════════════

/**
 * Memantau aktivitas Voice Channel untuk memicu undangan otomatis (Auto Event).
 */
function handleVoiceStateUpdate(oldState, newState, client) {
  const guild = newState.guild;
  const guildId = guild.id;

  const oldChannelId = oldState.channelId;
  const newChannelId = newState.channelId;

  // 1. Tangani keluar dari VC
  if (oldChannelId && oldChannelId !== newChannelId) {
    const channel = oldState.channel;
    if (channel) {
      const activeMembers = channel.members.filter(m => !m.user.bot);

      if (activeMembers.size < config.autoEvents.MIN_MEMBERS) {
        // Anggota aktif kurang dari batas, bersihkan pelacak
        if (vcActiveTrackers.has(oldChannelId)) {
          const tracker = vcActiveTrackers.get(oldChannelId);
          if (tracker.timer) clearTimeout(tracker.timer);
          vcActiveTrackers.delete(oldChannelId);
        }
      } else if (vcActiveTrackers.has(oldChannelId)) {
        // Hapus user yang keluar dari set aktif
        const tracker = vcActiveTrackers.get(oldChannelId);
        tracker.activeUsers.delete(oldState.member.id);
      }
    }
  }

  // 2. Tangani masuk / ganti VC
  if (newChannelId) {
    const channel = newState.channel;
    if (channel) {
      const activeMembers = channel.members.filter(m => !m.user.bot);

      // Jika jumlah member aktif memenuhi syarat
      if (activeMembers.size >= config.autoEvents.MIN_MEMBERS) {
        if (!vcActiveTrackers.has(newChannelId)) {
          const activeUsersSet = new Set(activeMembers.map(m => m.id));

          // Mulai pelacak baru
          const tracker = {
            since: Date.now(),
            activeUsers: activeUsersSet,
            timer: null
          };

          // Pasang timer timeout untuk mengirim invitation
          tracker.timer = setTimeout(async () => {
            vcActiveTrackers.delete(newChannelId); // Bersihkan pelacak setelah memicu
            await triggerAutoEventInvitation(guild, channel);
          }, config.autoEvents.MIN_ACTIVE_TIME_MS);

          vcActiveTrackers.set(newChannelId, tracker);
        } else {
          // Tambahkan user yang masuk ke set
          const tracker = vcActiveTrackers.get(newChannelId);
          tracker.activeUsers.add(newState.member.id);
        }
      }
    }
  }
}

/**
 * Mengirimkan undangan otomatis jika Voice Channel ramai.
 */
async function triggerAutoEventInvitation(guild, voiceChannel) {
  const guildId = guild.id;

  // 1. Cek Cooldown Undangan Otomatis per Guild
  const state = autoEventStates.get(guildId) || { lastInvitedAt: 0 };
  if (Date.now() - state.lastInvitedAt < config.autoEvents.COOLDOWN_MS) {
    console.log(`[AutoEvent] Skip undangan otomatis di server ${guildId}: Masih dalam cooldown.`);
    return;
  }

  // 2. Cari Text Channel untuk mengirim undangan
  let targetChannel = null;

  if (config.autoEvents.TARGET_TEXT_CHANNEL_ID) {
    targetChannel = guild.channels.cache.get(config.autoEvents.TARGET_TEXT_CHANNEL_ID);
  }

  if (!targetChannel) {
    // Cari system channel atau text channel pertama yang bisa dikirimi pesan
    targetChannel = guild.systemChannel || guild.channels.cache.find(
      ch => ch.isTextBased() && ch.permissionsFor(guild.members.me).has('SendMessages')
    );
  }

  if (!targetChannel) {
    console.log(`[AutoEvent] Gagal menemukan text channel yang valid untuk kirim undangan di server ${guildId}`);
    return;
  }

  // Perbaharui waktu pengiriman terakhir
  autoEventStates.set(guildId, { lastInvitedAt: Date.now() });

  console.log(`[AutoEvent] Memicu undangan otomatis di server ${guild.name} (#${targetChannel.name})`);

  // 3. Kirim Embed Undangan Cantik
  const embed = new EmbedBuilder()
    .setColor(0x00FF88)
    .setTitle('🎤 EVENT VOICE CHANNEL TERDETEKSI!')
    .setThumbnail(guild.iconURL())
    .setDescription([
      `📢 **Wah, kumpul-kumpul seru nih!**`,
      `Melihat ada **${voiceChannel.members.filter(m => !m.user.bot).size} orang** yang sedang berkumpul aktif di Voice Channel **${voiceChannel.name}**, mari hidupkan suasana dengan permainan klasik!`,
      `\n🎲 **TRUTH OR DARE DI VOICE CHANNEL**`,
      `Kalian bisa saling menguji keberanian dan rahasia lewat 2000+ pertanyaan klasik dengan pembacaan TTS audio instan.`,
      `\n👉 Ketik **\`.truthordare\`** di server ini sekarang untuk memulai keseruan!`
    ].join('\n'))
    .setFooter({ text: 'Bot Voice & Auto Events 2026' })
    .setTimestamp();

  await targetChannel.send({ embeds: [embed] }).catch(err => {
    console.error(`[AutoEvent] Gagal mengirim pesan undangan:`, err.message);
  });
}

// ═══════════════════════════════════════════════════
// TEXT COMMAND HANDLER ENTRY POINT
// ═══════════════════════════════════════════════════

/**
 * Menampilkan Embed Papan Prestasi ToD Server (Leaderboard)
 */
async function sendTodLeaderboard(message, client) {
  const topDares = database.getTopDares(5);
  const topTruths = database.getTopTruths(5);
  const topSkips = database.getTopSkips(5);

  const fetchUsernames = async (list) => {
    const lines = [];
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      let username = 'Warga Misterius';
      try {
        const user = client.users.cache.get(item.user_id) || await client.users.fetch(item.user_id);
        username = user.username;
      } catch (err) {
        username = `<@${item.user_id}>`;
      }
      
      let scoreVal = '';
      if (item.dares_completed !== undefined) scoreVal = `\`${item.dares_completed} Dare\``;
      else if (item.truths_answered !== undefined) scoreVal = `\`${item.truths_answered} Truth\``;
      else if (item.skips_count !== undefined) scoreVal = `\`${item.skips_count} Skip\``;

      lines.push(`${i + 1}. **${username}** — ${scoreVal}`);
    }
    return lines.join('\n') || '*Belum ada prestasi tercatat*';
  };

  const daresList = await fetchUsernames(topDares);
  const truthsList = await fetchUsernames(topTruths);
  const skipsList = await fetchUsernames(topSkips);

  const embed = new EmbedBuilder()
    .setColor(0x00FF88)
    .setTitle('🏆 PAPAN PRESTASI TRUTH OR DARE (ToD) 🏆')
    .setDescription('Berikut adalah rekapitulasi keaktifan dan nyali para warga server Kosan 1A dalam game Truth or Dare!')
    .addFields(
      {
        name: '👑 Warga Paling Pemberani (Dares Completed)',
        value: daresList,
        inline: false
      },
      {
        name: '🤔 Warga Paling Jujur (Truths Answered)',
        value: truthsList,
        inline: false
      },
      {
        name: '💀 Warga Paling Penakut (Skips Count)',
        value: skipsList,
        inline: false
      }
    )
    .setFooter({ text: 'Sentinel Bot • ToD Leaderboard' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

/**
 * Entrypoint untuk mengarahkan pesan teks ber-prefix .truthordare atau .tod
 */
async function handleVoiceTodCommand(message, client) {
  const content = message.content.slice(1).trim().split(/ +/);
  const command = content.shift().toLowerCase();

  if (command !== 'truthordare' && command !== 'tod' && command !== 'tod-top' && command !== 'tod-leaderboard') return false;

  const subCommand = (command === 'tod-top' || command === 'tod-leaderboard') ? 'top' : content[0]?.toLowerCase();

  // ── Penanganan Subcommand: status / stats ──
  if (subCommand === 'status' || subCommand === 'stats') {
    const stats = database.getUserStats(message.author.id);
    const embed = new EmbedBuilder()
      .setColor(0x00D2FF)
      .setTitle(`📊 Statistik Truth or Dare — ${message.author.username}`)
      .setThumbnail(message.author.displayAvatarURL())
      .addFields(
        { name: '🤔 Truth Terjawab', value: `\`${stats.truths_answered}\` kali`, inline: true },
        { name: '⚡ Dare Terselesaikan', value: `\`${stats.dares_completed}\` kali`, inline: true },
        { name: '⌛ Skip Tantangan', value: `\`${stats.skips_count}\` kali`, inline: true },
        { name: '🎁 Hadiah Koin Didapat', value: `\`Rp ${stats.total_coins_earned.toLocaleString('id-ID')}\``, inline: true },
        { name: '💸 Denda Koin Dibayar', value: `\`Rp ${stats.total_fines_paid.toLocaleString('id-ID')}\``, inline: true }
      )
      .setFooter({ text: 'Kumpulkan koin sukses dan hindari skip denda!' })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
    return true;
  }

  // ── Penanganan Subcommand: top / leaderboard ──
  if (subCommand === 'top' || subCommand === 'leaderboard') {
    await sendTodLeaderboard(message, client);
    return true;
  }

  // ── Penanganan Subcommand: announce (Admin) ──
  if (subCommand === 'announce') {
    const isAdmin = message.member.permissions.has('Administrator');
    if (!isAdmin) {
      return message.reply('❌ Hanya Administrator yang dapat menyiarkan pengumuman game ToD!');
    }

    const targetChannel = message.mentions.channels.first() || message.channel;

    if (!targetChannel.isTextBased()) {
      return message.reply('❌ Channel target harus berupa text channel!');
    }

    const botPermissions = targetChannel.permissionsFor(message.guild.members.me);
    if (!botPermissions.has('SendMessages') || !botPermissions.has('EmbedLinks')) {
      return message.reply(`❌ Bot tidak memiliki izin \`Send Messages\` atau \`Embed Links\` di channel ${targetChannel}!`);
    }

    const embed = new EmbedBuilder()
      .setColor(0x00FF88)
      .setTitle('🎤 EVENT BARU: TRUTH OR DARE DI VOICE CHANNEL! 🎲')
      .setDescription([
        `📢 **Halo semuanya!**`,
        `Kami dengan bangga meluncurkan fitur game interaktif baru di server ini: **Truth or Dare (ToD) Multiplayer**! Sekarang kalian bisa menguji keberanian, kejujuran, dan keseruan bersama teman-teman langsung di Voice Channel! 😎`,
        `\n✨ **FITUR UTAMA GAME TOD:**`,
        `👉 **4000+ Pertanyaan Klasik & Seru**: Database raksasa dengan pertanyaan-pertanyaan terbaik Bahasa Indonesia!`,
        `👉 **2 Mode Game Seru**:`,
        `  🎲 \`NORMAL\` - Bergantian acak di mana korban dan penanya diundi setiap putaran.`,
        `  🔥 \`HOT SEAT\` - Satu korban di-interogasi oleh seluruh pemain lain secara bergiliran!`,
        `👉 **3 Kategori Tingkat Keseruan**:`,
        `  🟢 \`CHILL\` - Santai, seru, cocok untuk sekadar mengobrol santai.`,
        `  🟡 \`DEEP\` - Mendalam, emosional, untuk mengenal satu sama lain lebih dekat.`,
        `  🔴 \`SPICY (18+)\` - Menantang dan berani! *(Hanya bisa dimainkan di channel NSFW!)*`,
        `👉 **Integrasi Google TTS (Pembacaan Suara)**: Setiap pertanyaan/tantangan akan dibacakan langsung oleh bot dengan suara jernih di Voice Channel kalian!`,
        `👉 **Turn-Based Multiplayer Lobby**: Dilengkapi tombol interaktif untuk Gabung, Keluar, Mulai, memilih Mode, Kategori, dan menentukan giliran.`,
        `\n💰 **SISTEM EKONOMI (RUPIAH SERVER):**`,
        `🎁 **Hadiah Sukses**: Menyelesaikan tantangan/pertanyaan juri memberikan **+Rp ${config.economy.SUCCESS_REWARD.toLocaleString('id-ID')}**!`,
        `💸 **Denda Menyerah**: Hati-hati! Jika memilih skip atau waktu habis, saldo dompetmu dipotong **Rp ${config.economy.SKIP_FINE.toLocaleString('id-ID')}**!`,
        `\n🛠️ **CARA BERMAIN:**`,
        `1️⃣ Masuk ke **Voice Channel** bersama minimal 2 orang teman.`,
        `2️⃣ Ketik **\`.join\`** atau **\`.joinlow\`** untuk memanggil dan mengunci bot di VC kalian.`,
        `3️⃣ Ketik **\`.tod\`** di text channel untuk membuka game lobby.`,
        `4️⃣ Teman-teman tinggal klik tombol **🙋‍♂️ Gabung**, pilih Mode & Kategori, lalu Host klik **🚀 Mulai Game**!`,
        `5️⃣ Ketik **\`.tod status\`** untuk memantau pencapaian, denda, dan koin yang sudah kamu kumpulkan!`,
        `\n*Ayo ramaikan Voice Channel kita dan tunjukkan keberanianmu sekarang!* 🔥`
      ].join('\n'))
      .setThumbnail(message.guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL())
      .setFooter({ text: 'Bot Voice & Auto Events 2026 • Ketik .help untuk bantuan' })
      .setTimestamp();

    await targetChannel.send({ embeds: [embed] });
    
    if (targetChannel.id !== message.channel.id) {
      await message.reply(`✅ Berhasil menyiarkan pengumuman game ToD ke channel ${targetChannel}!`);
    }
    return true;
  }

  // ── Penanganan Subcommand: force-end (Admin / Staff) ──
  if (subCommand === 'force-end' || subCommand === 'stop') {
    const isAdmin = message.member.permissions.has('Administrator');
    if (!isAdmin) {
      return message.reply('❌ Hanya Administrator yang dapat memberhentikan paksa game ToD!');
    }

    if (!activeGames.has(message.guildId)) {
      return message.reply('❌ Tidak ada sesi game ToD aktif yang sedang berjalan di server ini.');
    }

    cleanSession(message.guildId);
    return message.reply('🛑 **Sesi game Truth or Dare berhasil dihentikan secara paksa!**');
  }

  // ── Penanganan Subcommand: add (Custom Questions) ──
  if (subCommand === 'add') {
    const isAdmin = message.member.permissions.has('Administrator');
    if (!isAdmin) {
      return message.reply('❌ Hanya Administrator yang dapat menambahkan pertanyaan kustom!');
    }

    const typeInput = content[1]?.toLowerCase();
    const categoryInput = content[2]?.toLowerCase();
    const questionText = content.slice(3).join(' ');

    if (!typeInput || !categoryInput || !questionText) {
      return message.reply('❌ **Format salah!** Gunakan:\n👉 `.tod add <truth/dare> <chill/deep/spicy> <Teks pertanyaan/tantangan kustom>`');
    }

    if (typeInput !== 'truth' && typeInput !== 'dare') {
      return message.reply('❌ Tipe harus berupa `truth` atau `dare`!');
    }

    if (!config.categories.ALLOWED.includes(categoryInput)) {
      return message.reply(`❌ Kategori harus berupa salah satu dari: \`${config.categories.ALLOWED.join(', ')}\`!`);
    }

    database.addCustomQuestion(typeInput, categoryInput, questionText, message.author.tag);

    const embed = new EmbedBuilder()
      .setColor(0x00FF88)
      .setTitle('✅ Sukses Menambah Pertanyaan Kustom!')
      .setDescription([
        `👉 **Tipe:** \`${typeInput.toUpperCase()}\``,
        `👉 **Kategori:** \`${categoryInput.toUpperCase()}\``,
        `👉 **Teks:** *"${questionText}"*`
      ].join('\n'))
      .setTimestamp();

    await message.reply({ embeds: [embed] });
    return true;
  }

  // ── Jalankan Game ToD Utama ──
  let category = config.categories.DEFAULT;
  if (content[0] && config.categories.ALLOWED.includes(content[0].toLowerCase())) {
    category = content[0].toLowerCase();
  }

  // Khusus kategori spicy, pastikan teks channel bertanda NSFW jika dikonfigurasi
  if (category === 'spicy' && config.categories.SPICY_NSFW_ONLY && !message.channel.nsfw) {
    const embed = new EmbedBuilder()
      .setColor(0xFF3366)
      .setDescription('🔞 **Kategori Spicy Hanya Diizinkan di Channel NSFW!**\nSilakan mulai game dengan kategori Spicy di text channel yang memiliki tanda NSFW.');
    await message.reply({ embeds: [embed] });
    return true;
  }

  await startTodGame(message, client, category);
  return true;
}

module.exports = {
  handleVoiceTodCommand,
  handleVoiceStateUpdate
};
