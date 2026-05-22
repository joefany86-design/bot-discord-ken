const sodium = require('libsodium-wrappers');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus, 
  VoiceConnectionStatus,
  getVoiceConnection,
  entersState,
  StreamType
} = require('@discordjs/voice');
const { DisTube } = require('distube');
const googleTTS = require('google-tts-api');
const cron = require('node-cron');
const ffmpegStatic = require('ffmpeg-static');
const https = require('https');
const http = require('http');

// Konfigurasi path FFmpeg agar terdeteksi secara otomatis di server (seperti Railway)
process.env.FFMPEG_BIN = ffmpegStatic;
process.env.FFMPEG_PATH = ffmpegStatic;

require('dotenv').config();

// ═══════════════════════════════════════════════════
// OWNER ID - Hanya user ini yang bisa memerintah bot
// ═══════════════════════════════════════════════════
const OWNER_ID = '436554535037698059';

// ═══════════════════════════════════════════════════
// GLOBAL ERROR HANDLERS (mencegah bot crash)
// ═══════════════════════════════════════════════════
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection:', reason?.message || reason);
});

process.on('uncaughtException', (error) => {
  console.error('⚠️ Uncaught Exception:', error.message);
  // Jangan exit agar bot tetap jalan
});

// ═══════════════════════════════════════════════════
// INISIALISASI CLIENT DISCORD
// ═══════════════════════════════════════════════════
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

// Menyimpan AudioPlayer TTS untuk setiap Guild
const ttsPlayers = new Map();

// Helper: Fetch audio stream dari URL (Google TTS)
function fetchAudioStream(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (response) => {
      // Handle redirect
      if (response.statusCode === 301 || response.statusCode === 302) {
        return fetchAudioStream(response.headers.location).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        return reject(new Error(`HTTP ${response.statusCode}`));
      }
      resolve(response);
    }).on('error', reject);
  });
}

// ═══════════════════════════════════════════════════
// INISIALISASI DISTUBE (MUSIK YOUTUBE)
// ═══════════════════════════════════════════════════
const distube = new DisTube(client, {
  emitNewSongOnly: true,
  emitAddSongWhenCreatingQueue: false,
});

// ═══════════════════════════════════════════════════
// DISTUBE EVENT HANDLERS
// ═══════════════════════════════════════════════════
distube.on('playSong', (queue, song) => {
  const embed = new EmbedBuilder()
    .setColor(0x00FF7F)
    .setTitle('🎵 Sedang Memutar')
    .setDescription(`**[${song.name}](${song.url})**`)
    .addFields(
      { name: '⏱️ Durasi', value: song.formattedDuration, inline: true },
      { name: '👤 Diminta oleh', value: `${song.user}`, inline: true },
      { name: '🔊 Volume', value: `${queue.volume}%`, inline: true }
    )
    .setThumbnail(song.thumbnail)
    .setFooter({ text: '🎶 Bot Musik Discord' })
    .setTimestamp();

  queue.textChannel?.send({ embeds: [embed] });
});

distube.on('addSong', (queue, song) => {
  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle('➕ Ditambahkan ke Antrian')
    .setDescription(`**[${song.name}](${song.url})**`)
    .addFields(
      { name: '⏱️ Durasi', value: song.formattedDuration, inline: true },
      { name: '👤 Diminta oleh', value: `${song.user}`, inline: true },
      { name: '📋 Posisi', value: `#${queue.songs.length}`, inline: true }
    )
    .setThumbnail(song.thumbnail)
    .setTimestamp();

  queue.textChannel?.send({ embeds: [embed] });
});

distube.on('finish', (queue) => {
  const embed = new EmbedBuilder()
    .setColor(0x95A5A6)
    .setTitle('✅ Antrian Selesai')
    .setDescription('Semua lagu telah selesai diputar! Gunakan `/play` untuk menambah lagu baru.')
    .setTimestamp();

  queue.textChannel?.send({ embeds: [embed] });
});

distube.on('empty', (queue) => {
  const embed = new EmbedBuilder()
    .setColor(0xE74C3C)
    .setTitle('👋 Channel Kosong')
    .setDescription('Tidak ada orang di voice channel. Bot keluar otomatis.')
    .setTimestamp();

  queue.textChannel?.send({ embeds: [embed] });
});

distube.on('error', (channel, error) => {
  console.error('DisTube Error:', error);
  if (channel) {
    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle('❌ Error')
      .setDescription(`Terjadi kesalahan: ${error.message?.slice(0, 200) || 'Unknown error'}`)
      .setTimestamp();

    channel.send({ embeds: [embed] }).catch(() => {});
  }
});

// ═══════════════════════════════════════════════════
// BOT READY EVENT
// ═══════════════════════════════════════════════════
client.once('ready', () => {
  console.log(`══════════════════════════════════════`);
  console.log(`  Bot online sebagai ${client.user.tag}`);
  console.log(`  Servers: ${client.guilds.cache.size}`);
  console.log(`══════════════════════════════════════`);
  
  client.user.setActivity('🎵 .play & /play | .speak', { type: 2 });

  // ═══════════════════════════════════════════════════
  // SAPAAN TERJADWAL (CRON JOBS) - WIB TIMEZONE
  // ═══════════════════════════════════════════════════
  setupGreetingSchedules();
});

// ═══════════════════════════════════════════════════
// FUNGSI SAPAAN TERJADWAL
// ═══════════════════════════════════════════════════
function setupGreetingSchedules() {
  const greetings = [
    {
      cron: '0 6 * * *',
      title: '🌅 Selamat Pagi!',
      message: 'Selamat pagi semuanya! Semoga hari ini penuh berkah dan semangat! 💪✨',
      color: 0xFFD700,
      image: '🌄'
    },
    {
      cron: '0 12 * * *',
      title: '☀️ Selamat Siang!',
      message: 'Selamat siang semuanya! Jangan lupa makan siang dan istirahat ya! 🍚😊',
      color: 0xFF8C00,
      image: '🌞'
    },
    {
      cron: '0 15 * * *',
      title: '🌇 Selamat Sore!',
      message: 'Selamat sore semuanya! Tetap semangat menjalani sisa hari ini! 🌆💫',
      color: 0xE67E22,
      image: '🌅'
    },
    {
      cron: '0 21 * * *',
      title: '🌙 Selamat Malam!',
      message: 'Selamat malam semuanya! Semoga istirahat kalian nyenyak. Mimpi indah! 🌟😴',
      color: 0x2C3E50,
      image: '🌃'
    }
  ];

  greetings.forEach(greeting => {
    cron.schedule(greeting.cron, () => {
      sendGreetingToAllGuilds(greeting);
    }, {
      scheduled: true,
      timezone: 'Asia/Jakarta'
    });

    console.log(`  ✅ Jadwal sapaan "${greeting.title}" terdaftar (${greeting.cron} WIB)`);
  });
}

function sendGreetingToAllGuilds(greeting) {
  client.guilds.cache.forEach(async (guild) => {
    try {
      let channel = null;

      // 1. Cek GREETING_CHANNEL_ID dari .env
      if (process.env.GREETING_CHANNEL_ID) {
        channel = guild.channels.cache.get(process.env.GREETING_CHANNEL_ID);
      }

      // 2. Cari channel bernama 'general' atau 'umum'
      if (!channel) {
        channel = guild.channels.cache.find(
          ch => ch.isTextBased() && !ch.isVoiceBased() && 
          (ch.name === 'general' || ch.name === 'umum' || ch.name === 'chat')
        );
      }

      // 3. Fallback: channel text pertama yang bisa ditulis
      if (!channel) {
        channel = guild.channels.cache.find(
          ch => ch.isTextBased() && !ch.isVoiceBased() && 
          ch.permissionsFor(guild.members.me)?.has('SendMessages')
        );
      }

      if (!channel) {
        console.log(`Tidak bisa menemukan channel untuk sapaan di server ${guild.name}`);
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(greeting.color)
        .setTitle(greeting.title)
        .setDescription(greeting.message)
        .setFooter({ text: `${greeting.image} Sapaan otomatis dari Bot` })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      console.log(`Sapaan "${greeting.title}" dikirim ke #${channel.name} di ${guild.name}`);
    } catch (error) {
      console.error(`Gagal mengirim sapaan ke server ${guild.name}:`, error.message);
    }
  });
}

// ═══════════════════════════════════════════════════
// PENANGANAN SLASH COMMANDS
// ═══════════════════════════════════════════════════
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, guildId, member, guild } = interaction;

  if (!guildId) {
    return interaction.reply({ content: '❌ Perintah ini hanya dapat digunakan di dalam server Discord!', ephemeral: true });
  }

  // Cek apakah user adalah owner (abaikan jika bukan)
  if (interaction.user.id !== OWNER_ID) return;

  // ── SPEAK (TTS) ──
  if (commandName === 'speak') {
    const text = interaction.options.getString('text');
    let connection = getVoiceConnection(guildId);

    if (!connection) {
      const voiceChannel = member.voice.channel;
      if (!voiceChannel) {
        return interaction.reply({ content: '🔇 Kamu harus bergabung ke Voice Channel terlebih dahulu!', ephemeral: true });
      }

      try {
        connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: guildId,
          adapterCreator: guild.voiceAdapterCreator,
          selfDeaf: false,
        });
        await entersState(connection, VoiceConnectionStatus.Ready, 60_000);
      } catch (error) {
        console.error('Kesalahan auto-join saat /speak:', error);
        return interaction.reply({ content: '❌ Gagal bergabung ke Voice Channel.', ephemeral: true });
      }
    }

    try {
      await interaction.deferReply();

      const ttsUrl = googleTTS.getAudioUrl(text, {
        lang: 'id',
        slow: false,
        host: 'https://translate.google.com',
        timeout: 10000,
      });

      let player = ttsPlayers.get(guildId);
      if (!player) {
        player = createAudioPlayer();
        player.on('error', error => {
          console.error(`TTS Player Error:`, error.message);
        });
        ttsPlayers.set(guildId, player);
      }
      
      connection.subscribe(player);
      const stream = await fetchAudioStream(ttsUrl);
      const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });
      player.play(resource);

      await interaction.editReply(`🗣️ Mengucapkan: "${text}"`);
    } catch (error) {
      console.error('Kesalahan TTS:', error);
      await interaction.editReply('❌ Gagal memproses teks ke suara.');
    }
  }

  // ── LEAVE ──
  else if (commandName === 'leave') {
    const connection = getVoiceConnection(guildId);
    const queue = distube.getQueue(guildId);

    if (!connection && !queue) {
      return interaction.reply({ content: '❌ Bot tidak sedang berada di Voice Channel!', ephemeral: true });
    }

    try {
      if (queue) {
        await distube.stop(guildId);
      }
      const player = ttsPlayers.get(guildId);
      if (player) {
        player.stop();
        ttsPlayers.delete(guildId);
      }
      if (connection) {
        connection.destroy();
      }
      await interaction.reply('👋 Berhasil keluar dari Voice Channel!');
    } catch (error) {
      console.error('Kesalahan leave:', error);
      await interaction.reply({ content: '❌ Terjadi kesalahan saat keluar.', ephemeral: true });
    }
  }

  // ── PLAY ──
  else if (commandName === 'play') {
    const query = interaction.options.getString('query');
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({ content: '🔇 Kamu harus bergabung ke Voice Channel terlebih dahulu!', ephemeral: true });
    }

    try {
      await interaction.deferReply();
      await distube.play(voiceChannel, query, {
        member: member,
        textChannel: interaction.channel,
        message: undefined,
      });
      await interaction.editReply(`🔍 Mencari dan memutar: **${query}**`);
    } catch (error) {
      console.error('Kesalahan play:', error);
      await interaction.editReply(`❌ Gagal memutar: ${error.message?.slice(0, 200) || 'Unknown error'}`);
    }
  }

  // ── SKIP ──
  else if (commandName === 'skip') {
    const queue = distube.getQueue(guildId);
    if (!queue) {
      return interaction.reply({ content: '❌ Tidak ada lagu yang sedang diputar!', ephemeral: true });
    }

    try {
      if (queue.songs.length <= 1) {
        await distube.stop(guildId);
        await interaction.reply('⏹️ Tidak ada lagu berikutnya. Pemutaran dihentikan.');
      } else {
        await distube.skip(guildId);
        await interaction.reply('⏭️ Lagu di-skip!');
      }
    } catch (error) {
      console.error('Kesalahan skip:', error);
      await interaction.reply({ content: '❌ Gagal skip lagu.', ephemeral: true });
    }
  }

  // ── STOP ──
  else if (commandName === 'stop') {
    const queue = distube.getQueue(guildId);
    if (!queue) {
      return interaction.reply({ content: '❌ Tidak ada lagu yang sedang diputar!', ephemeral: true });
    }

    try {
      await distube.stop(guildId);
      await interaction.reply('⏹️ Musik dihentikan dan antrian dikosongkan!');
    } catch (error) {
      console.error('Kesalahan stop:', error);
      await interaction.reply({ content: '❌ Gagal menghentikan musik.', ephemeral: true });
    }
  }

  // ── QUEUE ──
  else if (commandName === 'queue') {
    const queue = distube.getQueue(guildId);
    if (!queue) {
      return interaction.reply({ content: '📋 Antrian kosong! Gunakan `/play` untuk menambah lagu.', ephemeral: true });
    }

    const songList = queue.songs
      .map((song, i) => {
        const prefix = i === 0 ? '▶️' : `${i}.`;
        return `${prefix} **${song.name}** - \`${song.formattedDuration}\` (${song.user})`;
      })
      .slice(0, 15)
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('📋 Antrian Lagu')
      .setDescription(songList)
      .setFooter({ text: `Total: ${queue.songs.length} lagu | Volume: ${queue.volume}%` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // ── NOWPLAYING ──
  else if (commandName === 'nowplaying') {
    const queue = distube.getQueue(guildId);
    if (!queue || !queue.songs[0]) {
      return interaction.reply({ content: '❌ Tidak ada lagu yang sedang diputar!', ephemeral: true });
    }

    const song = queue.songs[0];
    const embed = new EmbedBuilder()
      .setColor(0x1DB954)
      .setTitle('🎶 Sedang Diputar')
      .setDescription(`**[${song.name}](${song.url})**`)
      .addFields(
        { name: '⏱️ Durasi', value: song.formattedDuration, inline: true },
        { name: '👤 Diminta oleh', value: `${song.user}`, inline: true },
        { name: '🔊 Volume', value: `${queue.volume}%`, inline: true }
      )
      .setThumbnail(song.thumbnail)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // ── PAUSE ──
  else if (commandName === 'pause') {
    const queue = distube.getQueue(guildId);
    if (!queue) {
      return interaction.reply({ content: '❌ Tidak ada lagu yang sedang diputar!', ephemeral: true });
    }

    if (queue.paused) {
      return interaction.reply({ content: '⏸️ Musik sudah dalam keadaan pause!', ephemeral: true });
    }

    distube.pause(guildId);
    await interaction.reply('⏸️ Musik di-pause! Gunakan `/resume` untuk melanjutkan.');
  }

  // ── RESUME ──
  else if (commandName === 'resume') {
    const queue = distube.getQueue(guildId);
    if (!queue) {
      return interaction.reply({ content: '❌ Tidak ada lagu yang sedang diputar!', ephemeral: true });
    }

    if (!queue.paused) {
      return interaction.reply({ content: '▶️ Musik tidak sedang di-pause!', ephemeral: true });
    }

    distube.resume(guildId);
    await interaction.reply('▶️ Musik dilanjutkan!');
  }

  // ── VOLUME ──
  else if (commandName === 'volume') {
    const queue = distube.getQueue(guildId);
    if (!queue) {
      return interaction.reply({ content: '❌ Tidak ada lagu yang sedang diputar!', ephemeral: true });
    }

    const level = interaction.options.getInteger('level');
    distube.setVolume(guildId, level);
    await interaction.reply(`🔊 Volume diatur ke **${level}%**`);
  }
});

// ═══════════════════════════════════════════════════
// PENANGANAN PERINTAH TEKS (PREFIX .)
// ═══════════════════════════════════════════════════
client.on('messageCreate', async message => {
  if (message.author.bot || !message.content.startsWith('.')) return;

  // Cek apakah user adalah owner (abaikan jika bukan)
  if (message.author.id !== OWNER_ID) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  // ── !JOIN ──
  if (commandName === 'join') {
    const { guildId, member, guild } = message;

    if (!guildId) return message.reply('❌ Perintah ini hanya bisa digunakan di server!');

    const voiceChannel = member?.voice?.channel;
    if (!voiceChannel) return message.reply('🔇 Kamu harus bergabung ke Voice Channel terlebih dahulu!');

    try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
      });

      await entersState(connection, VoiceConnectionStatus.Ready, 60_000);

      if (!ttsPlayers.has(guildId)) {
        const player = createAudioPlayer();
        player.on('error', error => console.error(`TTS Player Error:`, error.message));
        ttsPlayers.set(guildId, player);
        connection.subscribe(player);
      } else {
        connection.subscribe(ttsPlayers.get(guildId));
      }

      await message.reply(`✅ Berhasil bergabung ke **${voiceChannel.name}**! 👋`);
    } catch (error) {
      console.error('Kesalahan join:', error);
      await message.reply('❌ Gagal bergabung ke voice channel.');
    }
  }

  // ── !SPEAK ──
  else if (commandName === 'speak') {
    let text = args.join(' ');
    if (!text) return message.reply('❗ Masukkan teks! Contoh: `.speak Halo semuanya`');

    if (text.toLowerCase().startsWith('text:')) text = text.slice(5).trim();

    const { guildId, member, guild } = message;
    if (!guildId) return message.reply('❌ Perintah ini hanya bisa digunakan di server!');

    let connection = getVoiceConnection(guildId);

    if (!connection) {
      const voiceChannel = member?.voice?.channel;
      if (!voiceChannel) return message.reply('🔇 Kamu harus join Voice Channel dulu! Ketik `.join`');

      try {
        connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: guildId,
          adapterCreator: guild.voiceAdapterCreator,
          selfDeaf: false,
        });
        await entersState(connection, VoiceConnectionStatus.Ready, 60_000);
      } catch (error) {
        console.error('Auto-join error:', error);
        return message.reply('❌ Gagal bergabung ke Voice Channel.');
      }
    }

    try {
      const ttsUrl = googleTTS.getAudioUrl(text, {
        lang: 'id',
        slow: false,
        host: 'https://translate.google.com',
        timeout: 10000,
      });

      let player = ttsPlayers.get(guildId);
      if (!player) {
        player = createAudioPlayer();
        player.on('error', error => console.error(`TTS Player Error:`, error.message));
        ttsPlayers.set(guildId, player);
      }
      
      connection.subscribe(player);
      const stream = await fetchAudioStream(ttsUrl);
      const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });
      player.play(resource);

      await message.reply(`🗣️ Mengucapkan: "${text}"`);
    } catch (error) {
      console.error('Kesalahan TTS:', error);
      await message.reply('❌ Gagal memproses teks ke suara.');
    }
  }

  // ── !PLAY ──
  else if (commandName === 'play') {
    const query = args.join(' ');
    if (!query) return message.reply('❗ Masukkan judul lagu atau URL! Contoh: `.play despacito`');

    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) return message.reply('🔇 Kamu harus bergabung ke Voice Channel terlebih dahulu!');

    try {
      await distube.play(voiceChannel, query, {
        member: message.member,
        textChannel: message.channel,
        message: message,
      });
    } catch (error) {
      console.error('Kesalahan play:', error);
      await message.reply(`❌ Gagal memutar: ${error.message?.slice(0, 200) || 'Unknown error'}`);
    }
  }

  // ── !SKIP ──
  else if (commandName === 'skip') {
    const queue = distube.getQueue(message.guildId);
    if (!queue) return message.reply('❌ Tidak ada lagu yang sedang diputar!');

    try {
      if (queue.songs.length <= 1) {
        await distube.stop(message.guildId);
        await message.reply('⏹️ Tidak ada lagu berikutnya. Pemutaran dihentikan.');
      } else {
        await distube.skip(message.guildId);
        await message.reply('⏭️ Lagu di-skip!');
      }
    } catch (error) {
      console.error('Kesalahan skip:', error);
      await message.reply('❌ Gagal skip lagu.');
    }
  }

  // ── !STOP ──
  else if (commandName === 'stop') {
    const queue = distube.getQueue(message.guildId);
    if (!queue) return message.reply('❌ Tidak ada lagu yang sedang diputar!');

    try {
      await distube.stop(message.guildId);
      await message.reply('⏹️ Musik dihentikan dan antrian dikosongkan!');
    } catch (error) {
      console.error('Kesalahan stop:', error);
      await message.reply('❌ Gagal menghentikan musik.');
    }
  }

  // ── !QUEUE / !Q ──
  else if (commandName === 'queue' || commandName === 'q') {
    const queue = distube.getQueue(message.guildId);
    if (!queue) return message.reply('📋 Antrian kosong! Gunakan `.play` untuk menambah lagu.');

    const songList = queue.songs
      .map((song, i) => {
        const prefix = i === 0 ? '▶️' : `${i}.`;
        return `${prefix} **${song.name}** - \`${song.formattedDuration}\` (${song.user})`;
      })
      .slice(0, 15)
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('📋 Antrian Lagu')
      .setDescription(songList)
      .setFooter({ text: `Total: ${queue.songs.length} lagu | Volume: ${queue.volume}%` })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }

  // ── !NOWPLAYING / !NP ──
  else if (commandName === 'nowplaying' || commandName === 'np') {
    const queue = distube.getQueue(message.guildId);
    if (!queue || !queue.songs[0]) return message.reply('❌ Tidak ada lagu yang sedang diputar!');

    const song = queue.songs[0];
    const embed = new EmbedBuilder()
      .setColor(0x1DB954)
      .setTitle('🎶 Sedang Diputar')
      .setDescription(`**[${song.name}](${song.url})**`)
      .addFields(
        { name: '⏱️ Durasi', value: song.formattedDuration, inline: true },
        { name: '👤 Diminta oleh', value: `${song.user}`, inline: true },
        { name: '🔊 Volume', value: `${queue.volume}%`, inline: true }
      )
      .setThumbnail(song.thumbnail)
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }

  // ── !PAUSE ──
  else if (commandName === 'pause') {
    const queue = distube.getQueue(message.guildId);
    if (!queue) return message.reply('❌ Tidak ada lagu yang sedang diputar!');
    if (queue.paused) return message.reply('⏸️ Musik sudah di-pause!');

    distube.pause(message.guildId);
    await message.reply('⏸️ Musik di-pause! Ketik `.resume` untuk lanjutkan.');
  }

  // ── !RESUME ──
  else if (commandName === 'resume') {
    const queue = distube.getQueue(message.guildId);
    if (!queue) return message.reply('❌ Tidak ada lagu yang sedang diputar!');
    if (!queue.paused) return message.reply('▶️ Musik tidak sedang di-pause!');

    distube.resume(message.guildId);
    await message.reply('▶️ Musik dilanjutkan!');
  }

  // ── !VOLUME ──
  else if (commandName === 'volume' || commandName === 'vol') {
    const queue = distube.getQueue(message.guildId);
    if (!queue) return message.reply('❌ Tidak ada lagu yang sedang diputar!');

    const level = parseInt(args[0]);
    if (isNaN(level) || level < 0 || level > 100) {
      return message.reply('❗ Masukkan angka volume 0-100! Contoh: `.volume 50`');
    }

    distube.setVolume(message.guildId, level);
    await message.reply(`🔊 Volume diatur ke **${level}%**`);
  }

  // ── !LEAVE ──
  else if (commandName === 'leave') {
    const { guildId } = message;
    if (!guildId) return message.reply('❌ Perintah ini hanya bisa digunakan di server!');

    const connection = getVoiceConnection(guildId);
    const queue = distube.getQueue(guildId);

    if (!connection && !queue) return message.reply('❌ Bot tidak sedang di Voice Channel!');

    try {
      if (queue) await distube.stop(guildId);
      const player = ttsPlayers.get(guildId);
      if (player) {
        player.stop();
        ttsPlayers.delete(guildId);
      }
      if (connection) connection.destroy();
      await message.reply('👋 Berhasil keluar dari Voice Channel!');
    } catch (error) {
      console.error('Kesalahan leave:', error);
      await message.reply('❌ Terjadi kesalahan saat keluar.');
    }
  }

  // ── !HELP ──
  else if (commandName === 'help') {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📖 Daftar Perintah Bot')
      .setDescription('Berikut semua perintah yang tersedia:')
      .addFields(
        { 
          name: '🎵 Musik', 
          value: [
            '`.play <judul/url>` — Putar musik dari YouTube',
            '`.skip` — Skip lagu saat ini',
            '`.stop` — Hentikan musik & kosongkan antrian',
            '`.queue` — Tampilkan antrian lagu',
            '`.np` — Lagu yang sedang diputar',
            '`.pause` — Pause musik',
            '`.resume` — Lanjutkan musik',
            '`.volume <0-100>` — Atur volume',
          ].join('\n')
        },
        {
          name: '🗣️ TTS (Text-to-Speech)',
          value: [
            '`.join` — Masuk ke voice channel',
            '`.speak <teks>` — Ucapkan teks',
            '`.leave` — Keluar dari voice channel',
          ].join('\n')
        },
        {
          name: '⏰ Sapaan Otomatis',
          value: 'Bot otomatis menyapa setiap:\n🌅 06:00 WIB • ☀️ 12:00 WIB • 🌇 15:00 WIB • 🌙 21:00 WIB'
        }
      )
      .setFooter({ text: 'Semua perintah juga tersedia sebagai slash command (/)' })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }
});

// ═══════════════════════════════════════════════════
// VOICE STATE UPDATE HANDLER
// ═══════════════════════════════════════════════════
client.on('voiceStateUpdate', (oldState, newState) => {
  if (oldState.member.id === client.user?.id && !newState.channelId) {
    const guildId = oldState.guild.id;
    const player = ttsPlayers.get(guildId);
    if (player) {
      player.stop();
      ttsPlayers.delete(guildId);
    }
    const connection = getVoiceConnection(guildId);
    if (connection) {
      try { connection.destroy(); } catch (err) { /* already destroyed */ }
    }
    console.log(`Bot terputus dari voice di server ${oldState.guild.name}.`);
  }
});

// ═══════════════════════════════════════════════════
// ERROR HANDLER CLIENT DISCORD
// ═══════════════════════════════════════════════════
client.on('error', (error) => {
  console.error('⚠️ Client Error:', error.message);
});

client.on('warn', (warning) => {
  console.warn('⚠️ Client Warning:', warning);
});

// ═══════════════════════════════════════════════════
// LOGIN BOT (tunggu sodium siap dulu)
// ═══════════════════════════════════════════════════
(async () => {
  await sodium.ready;
  console.log('✅ Sodium (encryption) siap!');
  client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.error('Gagal login! Pastikan DISCORD_TOKEN valid.');
    console.error(error);
  });
})();
