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

// ═══════════════════════════════════════════════════
// GAME LOOP IMPLEMENTATION
// ═══════════════════════════════════════════════════

/**
 * Memulai sesi game ToD baru.
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

  // 5. Kumpulkan member aktif di VC
  const activeMembers = Array.from(voiceChannel.members.filter(m => !m.user.bot).values());
  if (activeMembers.length < 2) {
    const embed = new EmbedBuilder()
      .setColor(0xFF3366)
      .setDescription(`👥 **Butuh Minimal 2 Pemain!** Harus ada minimal 2 orang non-bot di dalam Voice Channel untuk bermain.`);
    return message.reply({ embeds: [embed] });
  }

  // Set cooldown awal untuk pembuat sesi
  manualCooldowns.set(member.id, Date.now());

  // 6. Pilih Victim (Korban) & Challenger (Penanya)
  const victimIndex = Math.floor(Math.random() * activeMembers.length);
  const victim = activeMembers[victimIndex];

  const remainingMembers = activeMembers.filter(m => m.id !== victim.id);
  const challenger = remainingMembers[Math.floor(Math.random() * remainingMembers.length)];

  // 7. Buat Sesi Game
  const session = {
    guildId,
    voiceChannelId: voiceChannel.id,
    textChannel,
    victim,
    challenger,
    category,
    state: 'waiting_for_choice',
    timer: null
  };
  activeGames.set(guildId, session);

  // 8. Umumkan via Suara/TTS
  audio.announceGameStart(client, guildId).catch(() => { });

  // 9. Kirim Embed Interaktif dengan Buttons
  const embed = new EmbedBuilder()
    .setColor(0x00D2FF)
    .setTitle('🎤 Voice Channel Event: TRUTH OR DARE!')
    .setDescription([
      `🎲 **Game Dimulai!** Botol ajaib berputar dan menunjuk kepada...`,
      `🎯 **Korban (Victim):** ${victim} (menjawab/melakukan)`,
      `🗣️ **Penanya (Challenger):** ${challenger} (menilai)`,
      `📂 **Kategori:** \`${category.toUpperCase()}\``,
      `\n⏱️ **Hei ${victim}, silakan klik tombol di bawah untuk memilih Truth atau Dare!**`
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
      .setLabel('❌ Batalkan Sesi')
      .setStyle(ButtonStyle.Danger)
  );

  const gameMessage = await textChannel.send({ embeds: [embed], components: [row] });
  session.message = gameMessage;

  // Umumkan giliran lewat TTS
  audio.announcePlayerSelection(client, guildId, victim.displayName, challenger.displayName).catch(() => { });

  // 10. Pasang Timer Choice Timeout
  session.timer = setTimeout(async () => {
    cleanSession(guildId);

    // Ganti komponen menjadi nonaktif
    const disabledRow = ActionRowBuilder.from(row);
    disabledRow.components.forEach(comp => comp.setDisabled(true));

    const timeoutEmbed = EmbedBuilder.from(embed)
      .setColor(0x555555)
      .setDescription(`⌛ **Waktu Habis!** ${victim} tidak memilih Truth/Dare dalam 30 detik. Sesi game dibatalkan.`);

    await gameMessage.edit({ embeds: [timeoutEmbed], components: [disabledRow] }).catch(() => { });
  }, config.durations.CHOICE_TIMEOUT_MS);

  // 11. Component Collector untuk menangani Button Click
  const collector = gameMessage.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: config.durations.CHOICE_TIMEOUT_MS
  });

  collector.on('collect', async (interaction) => {
    // Tombol Batalkan hanya bisa ditekan oleh Victim atau Challenger atau Admin
    if (interaction.customId === 'tod_cancel') {
      const isAdmin = interaction.member.permissions.has('Administrator');
      if (interaction.user.id !== victim.id && interaction.user.id !== challenger.id && !isAdmin) {
        return interaction.reply({ content: '❌ Hanya Victim, Challenger, atau Admin yang bisa membatalkan sesi ini!', ephemeral: true });
      }

      cleanSession(guildId);
      collector.stop();

      const disabledRow = ActionRowBuilder.from(row);
      disabledRow.components.forEach(comp => comp.setDisabled(true));

      const cancelledEmbed = EmbedBuilder.from(embed)
        .setColor(0xFF3366)
        .setDescription(`❌ Sesi game Truth or Dare dibatalkan oleh ${interaction.user}.`);

      return interaction.update({ embeds: [cancelledEmbed], components: [disabledRow] });
    }

    // Hanya Victim yang bisa memilih Truth / Dare
    if (interaction.user.id !== victim.id) {
      return interaction.reply({ content: '❌ Hanya Victim terpilih yang dapat menekan tombol Truth atau Dare!', ephemeral: true });
    }

    // Hentikan timer timeout pilihan
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
    // Timeout otomatis = skip (denda koin)
    const victimId = session.victim.id;
    database.incrementSkipStats(victimId);
    database.fineUser(victimId, guildId, config.economy.SKIP_FINE);

    cleanSession(guildId);

    const disabledRow = ActionRowBuilder.from(row);
    disabledRow.components.forEach(comp => comp.setDisabled(true));

    const timeoutEmbed = EmbedBuilder.from(questionEmbed)
      .setColor(0x555555)
      .setDescription([
        `⌛ **Waktu Penyelesaian Habis!**`,
        `User ${session.victim} gagal menyelesaikan tantangan tepat waktu.`,
        `💸 **Denda Terpotong:** \`Rp ${config.economy.SKIP_FINE.toLocaleString('id-ID')}\``
      ].join('\n'))
      .setFooter({ text: 'Sesi game berakhir secara otomatis' });

    await session.message.edit({ embeds: [timeoutEmbed], components: [disabledRow] }).catch(() => { });
    audio.announceSkip(client, guildId, session.victim.displayName, config.economy.SKIP_FINE).catch(() => { });
  }, config.durations.GAME_TIMEOUT_MS);

  // 5. Component Collector untuk memproses keputusan Challenger (Juri)
  const actionCollector = session.message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: config.durations.GAME_TIMEOUT_MS
  });

  actionCollector.on('collect', async (actInteraction) => {
    // Hanya Challenger (Juri) atau Admin yang bisa menekan tombol verifikasi
    const isAdmin = actInteraction.member.permissions.has('Administrator');
    if (actInteraction.user.id !== session.challenger.id && !isAdmin) {
      return actInteraction.reply({ content: '❌ Hanya Challenger (Juri) terpilih atau Admin yang dapat memvalidasi game ini!', ephemeral: true });
    }

    if (session.timer) clearTimeout(session.timer);
    actionCollector.stop();
    cleanSession(guildId);

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
        .setFooter({ text: 'Permainan Selesai' });

      await actInteraction.update({ embeds: [resultEmbed], components: [disabledRow] });
      audio.announceSuccess(client, guildId, session.victim.displayName, config.economy.SUCCESS_REWARD).catch(() => { });

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
        .setFooter({ text: 'Permainan Selesai' });

      await actInteraction.update({ embeds: [resultEmbed], components: [disabledRow] });
      audio.announceSkip(client, guildId, session.victim.displayName, config.economy.SKIP_FINE).catch(() => { });
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
