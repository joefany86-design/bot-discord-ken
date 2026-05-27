const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  getVoiceConnection
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

  const activeCategory = session.category;
  const categoryRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('tod_cat_chill')
      .setLabel('🟢 Chill')
      .setStyle(activeCategory === 'chill' ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('tod_cat_deep')
      .setLabel('🟡 Deep')
      .setStyle(activeCategory === 'deep' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('tod_cat_spicy')
      .setLabel('🔴 Spicy (18+)')
      .setStyle(activeCategory === 'spicy' ? ButtonStyle.Danger : ButtonStyle.Secondary)
  );

  return [lobbyRow, categoryRow];
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
    category,
    state: 'lobby',
    host: member,
    players: [member], // Pembuat lobby langsung otomatis gabung
    currentTurnIndex: -1,
    victim: null,
    challenger: null,
    timer: null,
    message: null
  };
  activeGames.set(guildId, session);

  // 6. Buat Embed Lobby
  const embed = new EmbedBuilder()
    .setColor(0x00D2FF)
    .setTitle('🎤 TRUTH OR DARE: GAME LOBBY')
    .setDescription([
      ` Sesi game Truth or Dare baru telah dibuka!`,
      `Silakan bergabung untuk ikut menguji keberanian dan rahasia kalian.`,
      `\n👑 **Host:** ${member}`,
      `📂 **Kategori:** \`${category.toUpperCase()}\``,
      `⏱️ **Waktu Persiapan:** 60 detik (Lobby batal jika tidak dimulai)`,
      `\n👥 **Daftar Pemain (${session.players.length}):**`,
      `1. ${member} (👑 Host)`
    ].join('\n'))
    .setFooter({ text: 'Pastikan Anda berada di Voice Channel sebelum bergabung!' })
    .setTimestamp();

  const lobbyComponents = getLobbyComponents(session);

  const lobbyMessage = await textChannel.send({ embeds: [embed], components: lobbyComponents });
  session.message = lobbyMessage;

  // Umumkan lewat TTS bahwa lobby dibuka
  audio.announceGameStart(client, guildId).catch(() => { });

  // 7. Pasang Timer Lobby Timeout (60 detik)
  session.timer = setTimeout(async () => {
    if (activeGames.get(guildId) !== session) return;
    cleanSession(guildId);

    const disabledComponents = lobbyComponents.map(row => {
      const disabledRow = ActionRowBuilder.from(row);
      disabledRow.components.forEach(comp => comp.setDisabled(true));
      return disabledRow;
    });

    const timeoutEmbed = EmbedBuilder.from(embed)
      .setColor(0x555555)
      .setDescription(`⌛ **Lobby Ditutup!** Game dibatalkan karena tidak dimulai dalam 60 detik.`);

    await lobbyMessage.edit({ embeds: [timeoutEmbed], components: disabledComponents }).catch(() => { });
  }, 60 * 1000);

  // 8. Component Collector untuk penanganan Lobby
  const collector = lobbyMessage.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 60 * 1000
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
    
    else if (customId.startsWith('tod_cat_')) {
      // Hanya Host atau Admin yang bisa mengubah kategori
      const isAdmin = interaction.member.permissions.has('Administrator');
      if (user.id !== session.host.id && !isAdmin) {
        return interaction.reply({ content: '❌ Hanya Host (pembuat lobby) atau Admin yang bisa mengubah kategori!', ephemeral: true });
      }

      const targetCategory = customId.replace('tod_cat_', '');
      
      // Khusus kategori spicy, pastikan teks channel bertanda NSFW
      if (targetCategory === 'spicy' && config.categories.SPICY_NSFW_ONLY && !interaction.channel.nsfw) {
        return interaction.reply({
          content: '🔞 **Kategori Spicy Hanya Diizinkan di Channel NSFW!**\nSilakan ubah channel ini menjadi NSFW atau gunakan kategori Chill/Deep.',
          ephemeral: true
        });
      }

      // Update kategori di sesi game
      session.category = targetCategory;
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
    .setColor(0x00D2FF)
    .setTitle('🎤 TRUTH OR DARE: GAME LOBBY')
    .setDescription([
      ` Sesi game Truth or Dare baru telah dibuka!`,
      `Silakan bergabung untuk ikut menguji keberanian dan rahasia kalian.`,
      `\n👑 **Host:** ${session.host}`,
      `📂 **Kategori:** \`${session.category.toUpperCase()}\``,
      `⏱️ **Waktu Persiapan:** 60 detik (Lobby batal jika tidak dimulai)`,
      `\n👥 **Daftar Pemain (${session.players.length}):**`,
      playerListString || '*Belum ada pemain bergabung*'
    ].join('\n'))
    .setFooter({ text: 'Pastikan Anda berada di Voice Channel sebelum bergabung!' })
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

  // 4. Hitung indeks giliran berikutnya
  let attempts = 0;
  do {
    session.currentTurnIndex = (session.currentTurnIndex + 1) % session.players.length;
    attempts++;
  } while (!voiceChannel.members.has(session.players[session.currentTurnIndex].id) && attempts < session.players.length);

  const victim = session.players[session.currentTurnIndex];

  // 5. Pilih Challenger (Penanya) secara ROTASI (pemain berikutnya yang aktif di VC setelah Victim)
  let challenger = null;
  for (let i = 1; i < session.players.length; i++) {
    const candidateIndex = (session.currentTurnIndex + i) % session.players.length;
    const candidate = session.players[candidateIndex];
    if (voiceChannel.members.has(candidate.id)) {
      challenger = candidate;
      break;
    }
  }

  // Fallback jika tidak ditemukan pemain rotasi aktif (misal hanya ada 2 pemain aktif)
  if (!challenger) {
    const remainingInVc = session.players.filter(p => p.id !== victim.id);
    challenger = remainingInVc[0];
  }

  // Update properti sesi
  session.victim = victim;
  session.challenger = challenger;
  session.state = 'waiting_for_choice';

  // 6. Buat Embed Giliran Baru
  const embed = new EmbedBuilder()
    .setColor(0x00D2FF)
    .setTitle('🎤 Putaran Truth or Dare Baru!')
    .setDescription([
      `🎲 **Giliran Pemain Ditentukan!**`,
      `🎯 **Korban (Victim):** ${victim} (menjawab/melakukan)`,
      `🗣️ **Penanya (Challenger):** ${challenger} (menilai)`,
      `📂 **Kategori:** \`${session.category.toUpperCase()}\``,
      `\n⏱️ **Hei ${victim}, silakan pilih TRUTH atau DARE dengan menekan tombol di bawah!**`
    ].join('\n'))
    .setFooter({ text: 'Waktu memilih: 30 detik' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('tod_select_truth')
      .setLabel('🤔 TRUTH')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('tod_select_dare')
      .setLabel('⚡ DARE')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('tod_cancel')
      .setLabel('❌ Akhiri Game')
      .setStyle(ButtonStyle.Danger)
  );

  const turnMessage = await session.textChannel.send({ embeds: [embed], components: [row] });
  session.message = turnMessage;

  // Umumkan via TTS
  audio.announcePlayerSelection(client, guildId, victim.displayName, challenger.displayName).catch(() => { });

  // 7. Pasang Timer Choice Timeout (30 detik)
  session.timer = setTimeout(async () => {
    const currentSession = activeGames.get(guildId);
    if (!currentSession || currentSession !== session) return;

    // Timeout saat memilih = dinilai menyerah/skip, didenda, lalu lanjut putaran berikutnya!
    const victimId = victim.id;
    database.incrementSkipStats(victimId);
    database.fineUser(victimId, guildId, config.economy.SKIP_FINE);

    const disabledRow = ActionRowBuilder.from(row);
    disabledRow.components.forEach(comp => comp.setDisabled(true));

    const timeoutEmbed = EmbedBuilder.from(embed)
      .setColor(0x555555)
      .setDescription([
        `⌛ **Waktu Memilih Habis!**`,
        `User ${victim} tidak memilih dalam 30 detik dan dianggap menyerah.`,
        `💸 **Denda Terpotong:** \`Rp ${config.economy.SKIP_FINE.toLocaleString('id-ID')}\``
      ].join('\n'))
      .setFooter({ text: 'Melanjutkan ke giliran berikutnya...' });

    await turnMessage.edit({ embeds: [timeoutEmbed], components: [disabledRow] }).catch(() => { });
    audio.announceSkip(client, guildId, victim.displayName, config.economy.SKIP_FINE).catch(() => { });

    // Transisi ke putaran berikutnya
    triggerNextTurnTransition(client, guildId);
  }, config.durations.CHOICE_TIMEOUT_MS);

  // 8. Component Collector untuk menangani Button Click pada giliran ini
  const collector = turnMessage.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: config.durations.CHOICE_TIMEOUT_MS
  });

  collector.on('collect', async (interaction) => {
    const currentSession = activeGames.get(guildId);
    if (!currentSession || currentSession !== session) {
      return interaction.reply({ content: '❌ Sesi game ini sudah tidak aktif.', ephemeral: true });
    }

    if (interaction.customId === 'tod_cancel') {
      const isAdmin = interaction.member.permissions.has('Administrator');
      if (interaction.user.id !== session.host.id && interaction.user.id !== victim.id && interaction.user.id !== challenger.id && !isAdmin) {
        return interaction.reply({ content: '❌ Hanya Host, Victim, Challenger, atau Admin yang bisa mengakhiri game ini!', ephemeral: true });
      }

      if (session.timer) clearTimeout(session.timer);
      collector.stop();
      cleanSession(guildId);

      const disabledRow = ActionRowBuilder.from(row);
      disabledRow.components.forEach(comp => comp.setDisabled(true));

      const cancelledEmbed = EmbedBuilder.from(embed)
        .setColor(0xFF3366)
        .setDescription(`🛑 **Permainan diakhiri** oleh ${interaction.user}. Sesi game selesai!`)
        .setFooter({ text: 'Game Selesai' });

      return interaction.update({ embeds: [cancelledEmbed], components: [disabledRow] });
    }

    // Hanya Victim yang bisa memilih Truth / Dare
    if (interaction.user.id !== victim.id) {
      return interaction.reply({ content: '❌ Hanya Victim terpilih yang dapat menekan tombol Truth atau Dare!', ephemeral: true });
    }

    // Hentikan timer pilihan
    if (session.timer) clearTimeout(session.timer);
    collector.stop();

    const selectedType = interaction.customId === 'tod_select_truth' ? 'truth' : 'dare';
    await handlePlayerChoice(interaction, client, selectedType);
  });
}

/**
 * Menangani pemilihan Truth / Dare oleh Victim.
 */
async function handlePlayerChoice(interaction, client, type) {
  const { guildId, guild } = interaction;
  const session = activeGames.get(guildId);
  if (!session) return;

  session.state = 'waiting_for_completion';
  session.type = type;

  // 1. Ambil pertanyaan acak
  const questionObj = database.getRandomQuestion(type, session.category, guildId);
  if (!questionObj) {
    cleanSession(guildId);
    return interaction.update({
      content: `❌ Gagal mengambil pertanyaan! Database untuk tipe \`${type.toUpperCase()}\` & kategori \`${session.category.toUpperCase()}\` kosong.`,
      embeds: [],
      components: []
    });
  }
  session.question = questionObj;

  // 2. Siapkan Embed Pertanyaan
  const embedColor = type === 'truth' ? 0x3399FF : 0x00FF88;
  const embedTitle = type === 'truth' ? '🤔 TRUTH QUESTION' : '⚡ DARE CHALLENGE';

  const questionEmbed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle(`🎤 VC Event — ${embedTitle}`)
    .setDescription([
      `👤 **Pemain:** ${session.victim}`,
      `🗣️ **Juri Penilai:** ${session.challenger}`,
      `\n🚨 **PERTANYAAN / TANTANGAN:**`,
      `>>> **${questionObj.question_text}**`,
      `\n💵 **Denda Skip:** \`Rp ${config.economy.SKIP_FINE.toLocaleString('id-ID')}\` | 🎁 **Hadiah Sukses:** \`Rp ${config.economy.SUCCESS_REWARD.toLocaleString('id-ID')}\``
    ].join('\n'))
    .setFooter({ text: `Menunggu juri memvalidasi... Waktu batas: 60 detik` })
    .setTimestamp();

  // Tombol aksi untuk Challenger (Juri) menilai
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('tod_action_done')
      .setLabel('✅ Selesai (Sukses)')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('tod_action_skip')
      .setLabel('❌ Menyerah (Denda Koin)')
      .setStyle(ButtonStyle.Danger)
  );

  await interaction.update({ embeds: [questionEmbed], components: [row] });

  // 3. Umumkan pertanyaan via TTS
  audio.announceQuestion(client, guildId, type, questionObj.question_text).catch(() => { });

  // 4. Set batas waktu penyelesaian tantangan (60 detik)
  session.timer = setTimeout(async () => {
    const currentSession = activeGames.get(guildId);
    if (!currentSession || currentSession !== session) return;

    // Juri AFK / Timeout tanpa keputusan = Bebas Denda demi Keadilan
    const disabledRow = ActionRowBuilder.from(row);
    disabledRow.components.forEach(comp => comp.setDisabled(true));

    const timeoutEmbed = EmbedBuilder.from(questionEmbed)
      .setColor(0xFFAA00)
      .setDescription([
        `⌛ **Waktu Juri Terbatas Habis!**`,
        `Juri ${session.challenger} tidak memberikan keputusan/penilaian dalam 60 detik.`,
        `🛡️ **Anti-AFK Protection:** ${session.victim} dibebaskan dari denda karena Juri tidak merespons.`
      ].join('\n'))
      .setFooter({ text: 'Melanjutkan ke giliran berikutnya...' });

    await session.message.edit({ embeds: [timeoutEmbed], components: [disabledRow] }).catch(() => { });
    
    // Umumkan via TTS bahwa Juri AFK
    audio.speak(
      client, 
      guildId, 
      `Waktu habis! Juri tidak memberikan keputusan, sehingga korban ${session.victim.displayName} bebas dari denda.`
    ).catch(() => { });

    // Transisi ke putaran berikutnya
    triggerNextTurnTransition(client, guildId);
  }, config.durations.GAME_TIMEOUT_MS);

  // 5. Component Collector untuk memproses keputusan Challenger (Juri)
  const actionCollector = session.message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: config.durations.GAME_TIMEOUT_MS
  });

  actionCollector.on('collect', async (actInteraction) => {
    const currentSession = activeGames.get(guildId);
    if (!currentSession || currentSession !== session) {
      return actInteraction.reply({ content: '❌ Sesi game ini sudah tidak aktif.', ephemeral: true });
    }

    // Hanya Challenger (Juri) atau Admin yang bisa menekan tombol verifikasi
    const isAdmin = actInteraction.member.permissions.has('Administrator');
    if (actInteraction.user.id !== session.challenger.id && !isAdmin) {
      return actInteraction.reply({ content: '❌ Hanya Challenger (Juri) terpilih atau Admin yang dapat memvalidasi game ini!', ephemeral: true });
    }

    if (session.timer) clearTimeout(session.timer);
    actionCollector.stop();

    const disabledRow = ActionRowBuilder.from(row);
    disabledRow.components.forEach(comp => comp.setDisabled(true));

    const victimId = session.victim.id;

    if (actInteraction.customId === 'tod_action_done') {
      // 🟢 SUKSES
      database.incrementGameStats(victimId, type);
      database.rewardUser(victimId, guildId, config.economy.SUCCESS_REWARD);

      const resultEmbed = EmbedBuilder.from(questionEmbed)
        .setColor(0x00FF88)
        .setDescription([
          `🎉 **Tantangan Berhasil Diselesaikan!**`,
          `Juri ${session.challenger} memverifikasi bahwa ${session.victim} telah sukses!`,
          `🎁 **Hadiah Masuk:** \`+Rp ${config.economy.SUCCESS_REWARD.toLocaleString('id-ID')}\``
        ].join('\n'))
        .setFooter({ text: 'Melanjutkan ke giliran berikutnya...' });

      await actInteraction.update({ embeds: [resultEmbed], components: [disabledRow] });
      audio.announceSuccess(client, guildId, session.victim.displayName, config.economy.SUCCESS_REWARD).catch(() => { });

      // Transisi ke putaran berikutnya
      triggerNextTurnTransition(client, guildId);

    } else if (actInteraction.customId === 'tod_action_skip') {
      // 🔴 SKIP / DENDA
      database.incrementSkipStats(victimId);
      database.fineUser(victimId, guildId, config.economy.SKIP_FINE);

      const resultEmbed = EmbedBuilder.from(questionEmbed)
        .setColor(0xFF3366)
        .setDescription([
          `❌ **Pemain Menyerah / Memilih Skip!**`,
          `User ${session.victim} memutuskan untuk skip tantangan.`,
          `💸 **Denda Koin Terpotong:** \`Rp ${config.economy.SKIP_FINE.toLocaleString('id-ID')}\``
        ].join('\n'))
        .setFooter({ text: 'Melanjutkan ke giliran berikutnya...' });

      await actInteraction.update({ embeds: [resultEmbed], components: [disabledRow] });
      audio.announceSkip(client, guildId, session.victim.displayName, config.economy.SKIP_FINE).catch(() => { });

      // Transisi ke putaran berikutnya
      triggerNextTurnTransition(client, guildId);
    }
  });
}

/**
 * Mengatur jeda transisi sebelum melaju ke putaran berikutnya, 
 * menyediakan tombol untuk mempercepat transisi, atau tombol untuk mengakhiri permainan secara manual.
 */
function triggerNextTurnTransition(client, guildId) {
  const session = activeGames.get(guildId);
  if (!session) return;

  session.state = 'waiting_for_next';

  // Sediakan tombol transisi + Tombol Gabung Tengah Game
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('tod_transition_join')
      .setLabel('🙋‍♂️ Ikut Bermain')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('tod_transition_next')
      .setLabel('👉 Putaran Berikutnya (15s)')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('tod_transition_stop')
      .setLabel('❌ Akhiri Game')
      .setStyle(ButtonStyle.Danger)
  );

  // Edit pesan saat ini untuk menambahkan tombol transisi
  session.message.edit({ components: [row] }).catch(() => {});

  // Set timeout 15 detik untuk otomatis memanggil startNextTurn
  session.timer = setTimeout(async () => {
    const currentSession = activeGames.get(guildId);
    if (!currentSession || currentSession !== session) return;

    // Hapus tombol transisi dari pesan lama
    await session.message.edit({ components: [] }).catch(() => {});

    // Jalankan giliran berikutnya
    await startNextTurn(client, guildId);
  }, 15 * 1000);

  // Buat collector pendek untuk tombol transisi
  const collector = session.message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 15 * 1000
  });

  collector.on('collect', async (interaction) => {
    const currentSession = activeGames.get(guildId);
    if (!currentSession || currentSession !== session) {
      return interaction.reply({ content: '❌ Sesi game ini sudah tidak aktif.', ephemeral: true });
    }

    if (interaction.customId === 'tod_transition_join') {
      const clickerMember = interaction.member;
      const clickerVoiceChannel = clickerMember.voice.channel;
      if (!clickerVoiceChannel || clickerVoiceChannel.id !== session.voiceChannelId) {
        return interaction.reply({ content: '❌ Kamu harus berada di **Voice Channel** yang sama untuk bergabung!', ephemeral: true });
      }

      if (session.players.some(p => p.id === interaction.user.id)) {
        return interaction.reply({ content: 'ℹ️ Kamu sudah terdaftar di dalam game!', ephemeral: true });
      }

      session.players.push(clickerMember);
      return interaction.reply({ content: `✅ **${interaction.user.username}** berhasil bergabung ke dalam game! Giliranmu akan datang di putaran berikutnya.`, ephemeral: false });
    }

    else if (interaction.customId === 'tod_transition_next') {
      // Siapa pun pemain terdaftar yang masih di VC dapat menekan tombol ini untuk melaju lebih cepat
      const isRegistered = session.players.some(p => p.id === interaction.user.id);
      if (!isRegistered) {
        return interaction.reply({ content: '❌ Hanya pemain terdaftar yang bisa mempercepat giliran!', ephemeral: true });
      }

      if (session.timer) clearTimeout(session.timer);
      collector.stop();

      // Hapus tombol
      await interaction.update({ components: [] }).catch(() => {});

      // Jalankan giliran berikutnya
      await startNextTurn(client, guildId);
    } 
    
    else if (interaction.customId === 'tod_transition_stop') {
      const isAdmin = interaction.member.permissions.has('Administrator');
      if (interaction.user.id !== session.host.id && !isAdmin) {
        return interaction.reply({ content: '❌ Hanya Host atau Admin yang bisa mengakhiri game!', ephemeral: true });
      }

      if (session.timer) clearTimeout(session.timer);
      collector.stop();
      cleanSession(guildId);

      const endEmbed = new EmbedBuilder()
        .setColor(0xFF3366)
        .setTitle('🏁 Game Truth or Dare Selesai!')
        .setDescription(`🛑 Permainan diakhiri secara manual oleh ${interaction.user}. Sesi ditutup!`)
        .setTimestamp();

      await interaction.update({ embeds: [endEmbed], components: [] });
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
 * Entrypoint untuk mengarahkan pesan teks ber-prefix .truthordare atau .tod
 */
async function handleVoiceTodCommand(message, client) {
  const content = message.content.slice(1).trim().split(/ +/);
  const command = content.shift().toLowerCase();

  if (command !== 'truthordare' && command !== 'tod') return false;

  const subCommand = content[0]?.toLowerCase();

  // ── Penanganan Subcommand: status ──
  if (subCommand === 'status') {
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
        `👉 **3 Kategori Tingkat Keseruan**:`,
        `  🟢 \`CHILL\` - Santai, seru, cocok untuk sekadar mengobrol santai.`,
        `  🟡 \`DEEP\` - Mendalam, emosional, untuk mengenal satu sama lain lebih dekat.`,
        `  🔴 \`SPICY (18+)\` - Menantang dan berani! *(Hanya bisa dimainkan di channel NSFW!)*`,
        `👉 **Integrasi Google TTS (Pembacaan Suara)**: Setiap pertanyaan/tantangan akan dibacakan langsung oleh bot dengan suara jernih di Voice Channel kalian!`,
        `👉 **Turn-Based Multiplayer Lobby**: Dilengkapi tombol interaktif untuk Gabung, Keluar, Mulai, dan memilih Truth/Dare secara bergantian.`,
        `\n💰 **SISTEM EKONOMI (RUPIAH SERVER):**`,
        `🎁 **Hadiah Sukses**: Menyelesaikan tantangan/pertanyaan juri memberikan **+Rp ${config.economy.SUCCESS_REWARD.toLocaleString('id-ID')}**!`,
        `💸 **Denda Menyerah**: Hati-hati! Jika memilih skip atau waktu habis, saldo dompetmu dipotong **Rp ${config.economy.SKIP_FINE.toLocaleString('id-ID')}**!`,
        `\n🛠️ **CARA BERMAIN:**`,
        `1️⃣ Masuk ke **Voice Channel** bersama minimal 2 orang teman.`,
        `2️⃣ Ketik **\`.join\`** atau **\`.joinlow\`** untuk memanggil dan mengunci bot di VC kalian.`,
        `3️⃣ Ketik **\`.tod\`** di text channel untuk membuka game lobby.`,
        `4️⃣ Teman-teman tinggal klik tombol **🙋‍♂️ Gabung**, lalu Host klik **🚀 Mulai Game**!`,
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
