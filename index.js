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
const ffmpegStatic = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');
const { initGreetings } = require('./greetings');

// Konfigurasi path FFmpeg - prioritaskan system ffmpeg, fallback ke ffmpeg-static
const { execSync } = require('child_process');
let ffmpegPath = ffmpegStatic;
try {
  ffmpegPath = execSync('which ffmpeg').toString().trim() || ffmpegStatic;
  console.log(`✅ FFmpeg ditemukan: ${ffmpegPath}`);
} catch {
  console.log(`ℹ️ Menggunakan ffmpeg-static: ${ffmpegStatic}`);
}
process.env.FFMPEG_BIN = ffmpegPath;
process.env.FFMPEG_PATH = ffmpegPath;

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

// ═══════════════════════════════════════════════════
// KONFIGURASI PEMUTAR MUSIK LOKAL (AUTO-PLAY & LOOP)
// ═══════════════════════════════════════════════════
const MUSIC_DIR = path.join(__dirname, 'music');

// Pastikan folder music ada
if (!fs.existsSync(MUSIC_DIR)) {
  fs.mkdirSync(MUSIC_DIR, { recursive: true });
}

// Map untuk melacak AudioPlayer musik lokal per guild
const musicPlayers = new Map();
// Map untuk melacak antrian file musik lokal per guild
const musicQueues = new Map();

// Helper untuk memindai file musik dari folder music/
function getMusicFiles() {
  if (!fs.existsSync(MUSIC_DIR)) return [];
  return fs.readdirSync(MUSIC_DIR)
    .filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ext === '.mp3' || ext === '.wav' || ext === '.ogg' || ext === '.m4a';
    });
}

// Fungsi utama untuk memutar musik lokal
function playLocalMusic(guildId, connection) {
  const files = getMusicFiles();
  if (files.length === 0) {
    console.log(`⚠️ Folder music kosong. Menunggu file lagu di: ${MUSIC_DIR}`);
    return;
  }

  let player = musicPlayers.get(guildId);
  if (!player) {
    player = createAudioPlayer();
    musicPlayers.set(guildId, player);

    player.on('error', error => {
      console.error(`🎵 [Music Player Error - Guild ${guildId}]:`, error.message);
    });

    player.on(AudioPlayerStatus.Idle, () => {
      console.log(`🎵 [Guild ${guildId}]: Lagu selesai, memutar lagu berikutnya...`);
      playNextLocalTrack(guildId, connection);
    });
  }

  connection.subscribe(player);
  
  // Ambil lagu pertama jika player saat ini idle/tidak memutar apa-apa
  if (player.state.status === AudioPlayerStatus.Idle) {
    playNextLocalTrack(guildId, connection);
  } else {
    player.unpause();
  }
}

// Fungsi untuk memutar lagu berikutnya
function playNextLocalTrack(guildId, connection) {
  const files = getMusicFiles();
  if (files.length === 0) {
    console.log(`⚠️ Folder music tidak memiliki lagu untuk diputar.`);
    return;
  }

  let queue = musicQueues.get(guildId) || [];
  if (queue.length === 0) {
    queue = [...files];
    musicQueues.set(guildId, queue);
  }

  const nextTrackName = queue.shift();
  musicQueues.set(guildId, queue);

  const filePath = path.join(MUSIC_DIR, nextTrackName);
  console.log(`▶️ [Guild ${guildId}] Memutar lagu lokal secara loop: ${nextTrackName}`);

  try {
    const resource = createAudioResource(filePath, {
      inputType: StreamType.Arbitrary,
      inlineVolume: true
    });
    // Volume default 40% (0.4)
    resource.volume?.setVolume(0.4);

    const player = musicPlayers.get(guildId);
    if (player) {
      player.play(resource);
    }
  } catch (error) {
    console.error(`❌ Gagal memutar lagu ${nextTrackName}:`, error.message);
    // Coba putar lagu berikutnya jika yang saat ini gagal
    setTimeout(() => playNextLocalTrack(guildId, connection), 1000);
  }
}

// ═══════════════════════════════════════════════════
// BOT READY EVENT
// ═══════════════════════════════════════════════════
client.once('ready', () => {
  console.log(`══════════════════════════════════════`);
  console.log(`  Bot online sebagai ${client.user.tag}`);
  console.log(`  Servers: ${client.guilds.cache.size}`);
  console.log(`══════════════════════════════════════`);
  
  client.user.setActivity('🎵 .join & /join | Loop Radio', { type: 2 });

  // SAPAAN TERJADWAL (CRON JOBS) - WIB TIMEZONE
  initGreetings(client);
});


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

  // ── JOIN ──
  if (commandName === 'join') {
    const voiceChannel = member.voice.channel;
    if (!voiceChannel) {
      return interaction.reply({ content: '🔇 Kamu harus bergabung ke Voice Channel terlebih dahulu!', ephemeral: true });
    }

    const botVoiceChannel = guild.members.me?.voice?.channel;
    if (botVoiceChannel) {
      if (botVoiceChannel.id === voiceChannel.id) {
        return interaction.reply({ content: 'ℹ️ Aku sudah bergabung di Voice Channel ini!', ephemeral: true });
      } else {
        return interaction.reply({ content: `❌ Aku sudah berada di Voice Channel **${botVoiceChannel.name}**! Aku tidak bisa berpindah ke channel lain. Silakan gunakan \`/leave\` terlebih dahulu.`, ephemeral: true });
      }
    }

    try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
      });

      await entersState(connection, VoiceConnectionStatus.Ready, 60_000);

      // Mulai putar musik lokal otomatis
      playLocalMusic(guildId, connection);

      await interaction.reply({ content: `✅ Berhasil bergabung ke **${voiceChannel.name}** dan mulai memutar musik lokal secara loop! 🎵`, ephemeral: true });
    } catch (error) {
      console.error('Kesalahan slash join:', error);
      await interaction.reply({ content: '❌ Gagal bergabung ke Voice Channel.', ephemeral: true });
    }
  }

  // ── LEAVE ──
  else if (commandName === 'leave') {
    const connection = getVoiceConnection(guildId);

    if (!connection) {
      return interaction.reply({ content: '❌ Bot tidak sedang berada di Voice Channel!', ephemeral: true });
    }

    try {
      const musicPlayer = musicPlayers.get(guildId);
      if (musicPlayer) {
        musicPlayer.stop();
        musicPlayers.delete(guildId);
      }
      musicQueues.delete(guildId);

      connection.destroy();
      await interaction.reply({ content: '👋 Berhasil keluar dari Voice Channel!', ephemeral: true });
    } catch (error) {
      console.error('Kesalahan leave:', error);
      await interaction.reply({ content: '❌ Terjadi kesalahan saat keluar.', ephemeral: true });
    }
  }

  // ── HELP ──
  else if (commandName === 'help') {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📖 Daftar Perintah Bot')
      .setDescription('Berikut perintah yang tersedia pada bot radio musik lokal ini:')
      .addFields(
        { 
          name: '📻 Kontrol Suara', 
          value: [
            '`/join` — Menyuruh bot bergabung ke Voice Channel & langsung putar musik lokal',
            '`/leave` — Menyuruh bot keluar dari Voice Channel & menghentikan musik',
            '`/help` — Menampilkan menu bantuan ini',
          ].join('\n')
        },
        {
          name: '⏰ Sapaan Otomatis',
          value: 'Bot otomatis menyapa setiap:\n🌌 00:00 WIB • 🌅 06:00 WIB • ☀️ 12:00 WIB • 🌇 15:00 WIB • 🌙 21:00 WIB'
        }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
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

    if (!guildId) return;

    const voiceChannel = member?.voice?.channel;
    if (!voiceChannel) return;

    const botVoiceChannel = guild.members.me?.voice?.channel;
    if (botVoiceChannel) {
      if (botVoiceChannel.id === voiceChannel.id) {
        // Jika bot sudah di voice channel yang sama, pastikan player aktif/unpaused
        const connection = getVoiceConnection(guildId);
        if (connection) {
          playLocalMusic(guildId, connection);
        }
        return;
      } else {
        return;
      }
    }

    try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
      });

      await entersState(connection, VoiceConnectionStatus.Ready, 60_000);

      // Mulai putar musik lokal otomatis
      playLocalMusic(guildId, connection);
    } catch (error) {
      console.error('Kesalahan join:', error);
    }
  }

  // ── !LEAVE ──
  else if (commandName === 'leave') {
    const { guildId } = message;
    if (!guildId) return;

    const connection = getVoiceConnection(guildId);
    if (!connection) return;

    try {
      const musicPlayer = musicPlayers.get(guildId);
      if (musicPlayer) {
        musicPlayer.stop();
        musicPlayers.delete(guildId);
      }
      musicQueues.delete(guildId);

      connection.destroy();
    } catch (error) {
      console.error('Kesalahan leave:', error);
    }
  }

  // ── !HELP ──
  else if (commandName === 'help') {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📖 Daftar Perintah Bot')
      .setDescription('Berikut semua perintah teks yang tersedia:')
      .addFields(
        { 
          name: '📻 Kontrol Suara', 
          value: [
            '`.join` — Masuk ke voice channel & langsung putar musik lokal loop',
            '`.leave` — Keluar dari voice channel & hentikan musik',
            '`.help` — Menampilkan menu bantuan ini',
          ].join('\n')
        },
        {
          name: '⏰ Sapaan Otomatis',
          value: 'Bot otomatis menyapa setiap:\n🌌 00:00 WIB • 🌅 06:00 WIB • ☀️ 12:00 WIB • 🌇 15:00 WIB • 🌙 21:00 WIB'
        }
      )
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
    const musicPlayer = musicPlayers.get(guildId);
    if (musicPlayer) {
      musicPlayer.stop();
      musicPlayers.delete(guildId);
    }
    musicQueues.delete(guildId);

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
