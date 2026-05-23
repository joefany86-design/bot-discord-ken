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
// KONFIGURASI PEMUTAR MUSIK LOKAL, TTS & STATE MAPS
// ═══════════════════════════════════════════════════
const https = require('https');
const os = require('os');
const MUSIC_DIR = path.join(__dirname, 'music');

// Pastikan folder music ada
if (!fs.existsSync(MUSIC_DIR)) {
  fs.mkdirSync(MUSIC_DIR, { recursive: true });
}

// State Maps untuk melacak status bot per server (Guild)
const lockedChannels = new Map();     // ID Voice Channel terkunci per server
const musicPlayers = new Map();       // AudioPlayer musik lokal per server
const musicQueues = new Map();        // Antrean musik lokal per server
const musicHistories = new Map();     // Riwayat lagu terputar per server
const currentTracks = new Map();      // Lagu yang sedang diputar per server
const musicVolumes = new Map();       // Desimal volume (0.0 - 1.0) per server (default 0.4)
const musicLoops = new Map();         // Status loop folder per server (default true)
const activeResources = new Map();    // AudioResource aktif per server (untuk update volume instan)
const activeTtsPlayers = new Map();   // AudioPlayer TTS aktif per server

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
function playLocalMusic(guildId, connection, forcePlay = false) {
  const files = getMusicFiles();
  if (files.length === 0) {
    console.log(`⚠️ Folder music kosong. Menunggu file lagu di: ${MUSIC_DIR}`);
    return;
  }

  if (forcePlay) {
    musicQueues.set(guildId, []);
  }

  let player = musicPlayers.get(guildId);
  if (!player) {
    player = createAudioPlayer();
    musicPlayers.set(guildId, player);

    player.on('error', error => {
      console.error(`🎵 [Music Player Error - Guild ${guildId}]:`, error.message);
      if (error.stack) console.error(error.stack);
    });

    player.on(AudioPlayerStatus.Idle, () => {
      console.log(`🎵 [Guild ${guildId}]: Lagu selesai, memutar lagu berikutnya...`);
      playNextLocalTrack(guildId, connection);
    });
  }

  connection.subscribe(player);
  
  if (forcePlay) {
    player.stop();
    playNextLocalTrack(guildId, connection);
  } else if (player.state.status === AudioPlayerStatus.Idle) {
    playNextLocalTrack(guildId, connection);
  } else if (player.state.status === AudioPlayerStatus.Paused) {
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
    const isLoopEnabled = musicLoops.get(guildId) !== false; // default true
    if (!isLoopEnabled) {
      console.log(`🎵 [Guild ${guildId}]: Antrean selesai dan loop dinonaktifkan. Pemutar musik dihentikan.`);
      currentTracks.delete(guildId);
      activeResources.delete(guildId);
      return;
    }

    queue = [...files];
    // Prioritaskan lagu 'berjuta-kebaikan' atau 'berjuta kebaikan' agar selalu diputar pertama
    queue.sort((a, b) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      const aHas = aLower.includes('berjuta-kebaikan') || aLower.includes('berjuta kebaikan');
      const bHas = bLower.includes('berjuta-kebaikan') || bLower.includes('berjuta kebaikan');
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      return 0;
    });
    musicQueues.set(guildId, queue);
  }

  const nextTrackName = queue.shift();
  musicQueues.set(guildId, queue);

  // Simpan lagu sebelumnya ke history (riwayat) sebelum mengubah currentTrack
  const current = currentTracks.get(guildId);
  if (current && current !== nextTrackName) {
    const history = musicHistories.get(guildId) || [];
    if (history[history.length - 1] !== current) {
      history.push(current);
      if (history.length > 50) history.shift();
      musicHistories.set(guildId, history);
    }
  }

  currentTracks.set(guildId, nextTrackName);

  const filePath = path.join(MUSIC_DIR, nextTrackName);
  console.log(`▶️ [Guild ${guildId}] Memutar lagu lokal: ${nextTrackName}`);

  try {
    const resource = createAudioResource(fs.createReadStream(filePath), {
      inputType: StreamType.Arbitrary,
      inlineVolume: true
    });
    
    // Gunakan volume yang diset atau default 0.4
    const volume = musicVolumes.get(guildId) !== undefined ? musicVolumes.get(guildId) : 0.4;
    resource.volume?.setVolume(volume);
    
    activeResources.set(guildId, resource);

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
// HELPER INTEGRASI GOOGLE TTS & KONEKSI SUARA
// ═══════════════════════════════════════════════════

// Membagi teks menjadi potongan maksimal 200 karakter
function splitText(text, maxLength = 200) {
  const words = text.split(' ');
  const chunks = [];
  let currentChunk = '';
  
  for (const word of words) {
    if ((currentChunk + ' ' + word).trim().length <= maxLength) {
      currentChunk = (currentChunk + ' ' + word).trim();
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = word;
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

// Mengucapkan teks bahasa Indonesia via Google TTS (Smart Pause & Resume)
function speakText(connection, text, guildId) {
  return new Promise((resolve) => {
    const chunks = splitText(text);
    if (chunks.length === 0 || !chunks[0]) {
      return resolve();
    }

    // Berhentikan TTS aktif jika ada
    const existingTts = activeTtsPlayers.get(guildId);
    if (existingTts) {
      try { existingTts.stop(); } catch (e) {}
    }

    // Pause musik lokal jika sedang berbunyi
    const musicPlayer = musicPlayers.get(guildId);
    let wasMusicPlaying = false;
    if (musicPlayer && musicPlayer.state.status === AudioPlayerStatus.Playing) {
      wasMusicPlaying = true;
      musicPlayer.pause();
    }

    const ttsPlayer = createAudioPlayer();
    activeTtsPlayers.set(guildId, ttsPlayer);
    connection.subscribe(ttsPlayer);

    let index = 0;

    const playNextChunk = () => {
      if (index >= chunks.length) {
        // TTS selesai, kembalikan ke music player & unpause jika sebelumnya jalan
        if (musicPlayer) {
          connection.subscribe(musicPlayer);
          if (wasMusicPlaying) {
            musicPlayer.unpause();
          }
        }
        ttsPlayer.stop();
        activeTtsPlayers.delete(guildId);
        resolve();
        return;
      }

      const chunk = chunks[index++];
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=id&client=tw-ob`;
      
      https.get(ttsUrl, (res) => {
        if (res.statusCode !== 200) {
          console.error(`❌ Google TTS mengembalikan status: ${res.statusCode}`);
          playNextChunk();
          return;
        }

        const resource = createAudioResource(res, {
          inputType: StreamType.Arbitrary,
          inlineVolume: true
        });
        resource.volume?.setVolume(0.8);
        ttsPlayer.play(resource);
      }).on('error', (err) => {
        console.error('❌ HTTP Error TTS:', err.message);
        playNextChunk();
      });
    };

    ttsPlayer.on(AudioPlayerStatus.Idle, () => {
      playNextChunk();
    });

    ttsPlayer.on('error', (error) => {
      console.error('❌ TTS Player Error:', error.message);
      playNextChunk();
    });

    playNextChunk();
  });
}

// Setup Event Listeners untuk Koneksi Suara (Rejoin Otomatis saat Disconnected)
function setupConnectionListeners(connection, guildId, guild) {
  connection.on('error', error => {
    console.error(`❌ [Voice Connection Error - Guild ${guildId}]:`, error);
  });

  connection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
    const lockedChannelId = lockedChannels.get(guildId);
    if (lockedChannelId) {
      console.log(`[Voice Lock] Koneksi terputus secara tidak terduga. Melakukan rejoin otomatis...`);
      try {
        try { connection.destroy(); } catch (e) {}
        const newConnection = joinVoiceChannel({
          channelId: lockedChannelId,
          guildId: guildId,
          adapterCreator: guild.voiceAdapterCreator,
          selfDeaf: false,
        });
        setupConnectionListeners(newConnection, guildId, guild);
        await entersState(newConnection, VoiceConnectionStatus.Ready, 15_000);
        
        const player = musicPlayers.get(guildId);
        if (player) {
          newConnection.subscribe(player);
        }
      } catch (err) {
        console.error('❌ Gagal melakukan pemulihan rejoin otomatis:', err.message);
      }
    }
  });
}

// Helper untuk format durasi Uptime
function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  const parts = [];
  if (d > 0) parts.push(`${d} hari`);
  if (h > 0) parts.push(`${h} jam`);
  if (m > 0) parts.push(`${m} menit`);
  parts.push(`${s} detik`);
  
  return parts.join(' ');
}

// Helper pembersihan resource secara total
function cleanupResources(guildId) {
  const musicPlayer = musicPlayers.get(guildId);
  if (musicPlayer) {
    try { musicPlayer.stop(); } catch (e) {}
    musicPlayers.delete(guildId);
  }
  
  const ttsPlayer = activeTtsPlayers.get(guildId);
  if (ttsPlayer) {
    try { ttsPlayer.stop(); } catch (e) {}
    activeTtsPlayers.delete(guildId);
  }

  musicQueues.delete(guildId);
  musicHistories.delete(guildId);
  currentTracks.delete(guildId);
  activeResources.delete(guildId);

  const connection = getVoiceConnection(guildId);
  if (connection) {
    try { connection.destroy(); } catch (err) {}
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

    try {
      // Set lock channel
      lockedChannels.set(guildId, voiceChannel.id);

      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
      });

      setupConnectionListeners(connection, guildId, guild);

      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

      // Mulai putar musik lokal otomatis
      playLocalMusic(guildId, connection, true);

      await interaction.reply({ 
        content: `✅ **Saluran Terkunci!** Berhasil bergabung ke **${voiceChannel.name}** dan mulai memutar musik lokal secara loop! 🎵\n` + 
                 `🛡️ *Mekanisme proteksi aktif: Bot terkunci di channel ini.*`, 
        ephemeral: true 
      });
    } catch (error) {
      console.error('Kesalahan slash join:', error);
      lockedChannels.delete(guildId);
      await interaction.reply({ content: '❌ Gagal bergabung ke Voice Channel.', ephemeral: true });
    }
  }

  // ── LEAVE ──
  else if (commandName === 'leave') {
    const hasLock = lockedChannels.has(guildId);
    if (!hasLock && !getVoiceConnection(guildId)) {
      return interaction.reply({ content: '❌ Bot tidak sedang berada di Voice Channel!', ephemeral: true });
    }

    try {
      lockedChannels.delete(guildId); // Buka kunci terlebih dahulu
      cleanupResources(guildId);
      await interaction.reply({ content: '👋 Berhasil membuka kunci saluran dan keluar dari Voice Channel!', ephemeral: true });
    } catch (error) {
      console.error('Kesalahan leave:', error);
      await interaction.reply({ content: '❌ Terjadi kesalahan saat keluar.', ephemeral: true });
    }
  }

  // ── HELP ──
  else if (commandName === 'help') {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📖 Panduan Menu & Kontrol Bot')
      .setThumbnail(client.user.displayAvatarURL())
      .setDescription([
        `👉 **/join** atau **.join** - Masuk ke Voice Channel Anda dan mengunci saluran.`,
        `👉 **.speak <teks>** - Mengucapkan teks Bahasa Indonesia via Google TTS.`,
        `👉 **/leave** atau **.leave** - Membuka kunci channel dan keluar dari Voice Channel.`,
        `👉 **.status** - Menampilkan status realtime dan statistik sistem bot.`,
        `👉 **/help** atau **.help** - Menampilkan panduan menu ini.`,
        `\n🎵 **Kontrol Pemutar Musik Lokal (Folder music/)**`,
        `👉 **.list** - Menampilkan daftar lagu lokal yang tersedia.`,
        `👉 **.play <nomor/nama>** - Memutar lagu berdasarkan nomor/nama, atau resume.`,
        `👉 **.pause** - Menjeda lagu yang sedang diputar.`,
        `👉 **.resume** - Melanjutkan lagu yang sedang dijeda.`,
        `👉 **.skip / .next** - Melewatkan lagu ke lagu berikutnya.`,
        `👉 **.prev / .back** - Memutar kembali lagu sebelumnya.`,
        `👉 **.volume <0-100>** - Mengatur tingkat volume musik.`,
        `👉 **.loop** - Mengaktifkan/menonaktifkan loop folder lagu.`,
        `👉 **.stop** - Menghentikan musik dan mereset antrean.`,
        `\n🔒 **Mekanisme Proteksi Saluran**`,
        `Begitu bot join, ia akan terus terkunci di channel tersebut. Jika dipindahkan paksa (drag) atau dikeluarkan (kick), bot akan rejoin instan secara otomatis. Hanya perintah **.leave** yang dapat membuka kuncinya.`
      ].join('\n'))
      .setFooter({ text: 'Gunakan awalan titik (.) atau slash (/) untuk commands.' })
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

  const { guildId, member, guild } = message;
  if (!guildId) return;

  // ── .join ──
  if (commandName === 'join') {
    const voiceChannel = member?.voice?.channel;
    if (!voiceChannel) {
      return message.reply('🔇 Anda harus bergabung ke Voice Channel terlebih dahulu!');
    }

    try {
      lockedChannels.set(guildId, voiceChannel.id);

      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
      });

      setupConnectionListeners(connection, guildId, guild);

      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

      // Mulai putar musik lokal otomatis
      playLocalMusic(guildId, connection, true);

      const embed = new EmbedBuilder()
        .setColor(0x00FF88)
        .setTitle('🔒 Saluran Terkunci & Bergabung!')
        .setDescription(`Berhasil bergabung ke **${voiceChannel.name}**.\n\n` + 
                       `🛡️ **Mekanisme Proteksi Aktif**: Bot terkunci di channel ini. Jika bot dipindahkan paksa atau dikick, bot akan rejoin secara instan.\n` + 
                       `🎵 Mulai memutar musik lokal secara loop dari folder \`music/\`.`)
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Kesalahan join prefix:', error);
      lockedChannels.delete(guildId);
      await message.reply('❌ Gagal bergabung ke Voice Channel.');
    }
  }

  // ── .speak <teks> ──
  else if (commandName === 'speak') {
    const connection = getVoiceConnection(guildId);
    if (!connection) {
      return message.reply('❌ Bot tidak berada di Voice Channel! Hubungkan bot dengan `.join` terlebih dahulu.');
    }

    const text = args.join(' ');
    if (!text) {
      return message.reply('❌ Harap masukkan teks yang ingin diucapkan!\nContoh: `.speak Selamat pagi semuanya`');
    }

    try {
      await message.react('🗣️').catch(() => {});
      await speakText(connection, text, guildId);
    } catch (error) {
      console.error('Kesalahan speak prefix:', error);
      await message.reply('❌ Terjadi kesalahan saat mengucapkan teks.');
    }
  }

  // ── .leave ──
  else if (commandName === 'leave') {
    const hasLock = lockedChannels.has(guildId);
    if (!hasLock && !getVoiceConnection(guildId)) {
      return message.reply('❌ Bot tidak sedang berada di Voice Channel!');
    }

    try {
      lockedChannels.delete(guildId); // Buka kunci terlebih dahulu
      cleanupResources(guildId);
      await message.reply('👋 Berhasil membuka kunci saluran dan keluar dari Voice Channel!');
    } catch (error) {
      console.error('Kesalahan leave prefix:', error);
      await message.reply('❌ Terjadi kesalahan saat keluar.');
    }
  }

  // ── .status ──
  else if (commandName === 'status') {
    const systemUptime = formatUptime(os.uptime());
    const botUptime = formatUptime(process.uptime());
    const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
    
    // Voice stats
    const connection = getVoiceConnection(guildId);
    const channelId = lockedChannels.get(guildId);
    const isLocked = !!channelId;
    const voiceChanName = channelId ? (guild.channels.cache.get(channelId)?.name || `ID: ${channelId}`) : 'Tidak Terhubung';
    const connectionState = connection ? 'Tersambung (Ready)' : 'Terputus';
    
    // Music stats
    const files = getMusicFiles();
    const currentSong = currentTracks.get(guildId) || 'Tidak ada lagu';
    const queue = musicQueues.get(guildId) || [];
    const history = musicHistories.get(guildId) || [];
    const isLoop = musicLoops.get(guildId) !== false;
    const currentVol = Math.round((musicVolumes.get(guildId) !== undefined ? musicVolumes.get(guildId) : 0.4) * 100);
    
    const embed = new EmbedBuilder()
      .setColor(0x00D2FF)
      .setTitle('📊 Status Realtime & Statistik Bot')
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        { 
          name: '🔒 Status Koneksi & Saluran', 
          value: [
            `👉 **Status Koneksi**: \`${connectionState}\``,
            `👉 **Saluran Terkunci**: \`${voiceChanName}\` ${isLocked ? '🔒' : '🔓'}`,
            `👉 **Status Proteksi**: \`${isLocked ? 'AKTIF (Terkunci)' : 'NON-AKTIF'}\``
          ].join('\n'),
          inline: false
        },
        {
          name: '🎵 Informasi Pemutar Musik',
          value: [
            `👉 **Lagu Saat Ini**: \`${currentSong}\``,
            `👉 **Volume Suara**: \`${currentVol}%\``,
            `👉 **Status Loop Folder**: \`${isLoop ? 'AKTIF (Looping)' : 'NON-AKTIF'}\``,
            `👉 **Jumlah Lagu Tersedia**: \`${files.length} lagu\``,
            `👉 **Lagu Tersisa di Antrean**: \`${queue.length} lagu\``,
            `👉 **Riwayat Putar (History)**: \`${history.length} lagu\``
          ].join('\n'),
          inline: false
        },
        {
          name: '💻 Statistik Sistem & Bot',
          value: [
            `👉 **Uptime Bot**: \`${botUptime}\``,
            `👉 **Uptime OS**: \`${systemUptime}\``,
            `👉 **Penggunaan RAM Bot**: \`${memoryUsage} MB\``,
            `👉 **RAM Server**: \`${freeMem} GB Bebas / ${totalMem} GB Total\``,
            `👉 **Platform OS**: \`${os.platform()} (${os.arch()})\``,
            `👉 **Node.js**: \`${process.version}\``,
            `👉 **Discord.js**: \`v${require('discord.js').version}\``
          ].join('\n'),
          inline: false
        }
      )
      .setFooter({ text: 'Bot Radio Proteksi 2026' })
      .setTimestamp();
    
    await message.reply({ embeds: [embed] });
  }

  // ── .help ──
  else if (commandName === 'help') {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📖 Panduan Menu & Kontrol Bot')
      .setThumbnail(client.user.displayAvatarURL())
      .setDescription([
        `👉 **.join** - Masuk ke Voice Channel Anda dan mengunci saluran.`,
        `👉 **.speak <teks>** - Mengucapkan teks Bahasa Indonesia via Google TTS.`,
        `👉 **.leave** - Membuka kunci channel dan keluar dari Voice Channel.`,
        `👉 **.status** - Menampilkan status realtime dan statistik sistem bot.`,
        `👉 **.help** - Menampilkan panduan menu ini.`,
        `\n🎵 **Kontrol Pemutar Musik Lokal (Folder music/)**`,
        `👉 **.list** - Menampilkan daftar lagu lokal yang tersedia.`,
        `👉 **.play <nomor/nama>** - Memutar lagu berdasarkan nomor/nama, atau resume.`,
        `👉 **.pause** - Menjeda lagu yang sedang diputar.`,
        `👉 **.resume** - Melanjutkan lagu yang sedang dijeda.`,
        `👉 **.skip / .next** - Melewatkan lagu ke lagu berikutnya.`,
        `👉 **.prev / .back** - Memutar kembali lagu sebelumnya.`,
        `👉 **.volume <0-100>** - Mengatur tingkat volume musik.`,
        `👉 **.loop** - Mengaktifkan/menonaktifkan loop folder lagu.`,
        `👉 **.stop** - Menghentikan musik dan mereset antrean.`,
        `\n🔒 **Mekanisme Proteksi Saluran**`,
        `Begitu bot join, ia akan terus terkunci di channel tersebut. Jika dipindahkan paksa (drag) atau dikeluarkan (kick), bot akan rejoin instan secara otomatis. Hanya perintah **.leave** yang dapat membuka kuncinya.`
      ].join('\n'))
      .setFooter({ text: 'Gunakan awalan titik (.) sebelum mengetik perintah.' })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }

  // ── .list ──
  else if (commandName === 'list') {
    const files = getMusicFiles();
    if (files.length === 0) {
      return message.reply(`⚠️ Folder music kosong! Silakan tambahkan file audio ke folder \`${MUSIC_DIR}\`.`);
    }
    
    const songsList = files.map((file, idx) => `**${idx + 1}**. \`${file}\``).join('\n');
    const embed = new EmbedBuilder()
      .setColor(0x00FFBB)
      .setTitle('🎵 Daftar Lagu Lokal (Folder music/)')
      .setDescription(songsList.length > 2000 ? songsList.substring(0, 1950) + '\n...dan lagu lainnya (terlalu banyak)' : songsList)
      .setFooter({ text: `Total: ${files.length} lagu | Mainkan dengan perintah: .play <nomor/nama>` })
      .setTimestamp();
    
    await message.reply({ embeds: [embed] });
  }

  // ── .play <nomor/nama> ──
  else if (commandName === 'play') {
    const connection = getVoiceConnection(guildId);
    if (!connection) {
      return message.reply('❌ Bot tidak berada di Voice Channel! Ketik `.join` terlebih dahulu.');
    }

    const arg = args.join(' ').trim();
    const player = musicPlayers.get(guildId);
    
    if (!arg) {
      if (player && player.state.status === AudioPlayerStatus.Paused) {
        player.unpause();
        return message.reply('▶️ Melanjutkan pemutaran lagu yang sedang dijeda.');
      } else {
        playLocalMusic(guildId, connection, false);
        return message.reply('▶️ Memulai pemutaran lagu dari folder musik.');
      }
    }

    const files = getMusicFiles();
    if (files.length === 0) {
      return message.reply('❌ Folder musik kosong!');
    }
    
    let targetFile = null;
    const index = parseInt(arg);
    
    if (!isNaN(index)) {
      if (index < 1 || index > files.length) {
        return message.reply(`❌ Nomor lagu tidak valid! Silakan pilih nomor 1 hingga ${files.length}. Ketik \`.list\` untuk melihat daftar.`);
      }
      targetFile = files[index - 1];
    } else {
      targetFile = files.find(file => file.toLowerCase().includes(arg.toLowerCase()));
    }
    
    if (!targetFile) {
      return message.reply(`❌ Lagu dengan kata kunci \`${arg}\` tidak ditemukan! Ketik \`.list\` untuk melihat semua daftar lagu.`);
    }

    let queue = musicQueues.get(guildId) || [];
    queue.unshift(targetFile);
    musicQueues.set(guildId, queue);

    if (player) {
      player.stop();
      message.reply(`▶️ Memutar lagu pilihan: \`${targetFile}\``);
    } else {
      playLocalMusic(guildId, connection, false);
      message.reply(`▶️ Memutar lagu pilihan: \`${targetFile}\``);
    }
  }

  // ── .pause ──
  else if (commandName === 'pause') {
    const player = musicPlayers.get(guildId);
    if (player && player.state.status === AudioPlayerStatus.Playing) {
      player.pause();
      message.reply('⏸️ Musik berhasil dijeda!');
    } else {
      message.reply('❌ Musik tidak sedang diputar saat ini!');
    }
  }

  // ── .resume ──
  else if (commandName === 'resume') {
    const player = musicPlayers.get(guildId);
    if (player && player.state.status === AudioPlayerStatus.Paused) {
      player.unpause();
      message.reply('▶️ Musik dilanjutkan kembali!');
    } else {
      message.reply('❌ Musik tidak sedang dijeda saat ini!');
    }
  }

  // ── .skip / .next ──
  else if (commandName === 'skip' || commandName === 'next') {
    const player = musicPlayers.get(guildId);
    const connection = getVoiceConnection(guildId);
    if (!connection) {
      return message.reply('❌ Bot tidak berada di Voice Channel!');
    }
    if (player) {
      player.stop();
      message.reply('⏭️ Lagu dilewati, memutar lagu berikutnya...');
    } else {
      message.reply('❌ Pemutar musik tidak aktif!');
    }
  }

  // ── .prev / .back ──
  else if (commandName === 'prev' || commandName === 'back') {
    const history = musicHistories.get(guildId) || [];
    if (history.length === 0) {
      return message.reply('❌ Tidak ada riwayat lagu sebelumnya yang diputar!');
    }
    
    const current = currentTracks.get(guildId);
    const queue = musicQueues.get(guildId) || [];
    const player = musicPlayers.get(guildId);
    const connection = getVoiceConnection(guildId);
    
    if (!connection) {
      return message.reply('❌ Bot tidak berada di Voice Channel!');
    }
    
    const prevTrack = history.pop();
    musicHistories.set(guildId, history);
    
    if (current) {
      queue.unshift(current);
    }
    queue.unshift(prevTrack);
    musicQueues.set(guildId, queue);
    
    if (player) {
      player.stop();
      message.reply(`⏮️ Memutar kembali lagu sebelumnya: \`${prevTrack}\``);
    } else {
      playLocalMusic(guildId, connection, false);
      message.reply(`⏮️ Memutar kembali lagu sebelumnya: \`${prevTrack}\``);
    }
  }

  // ── .volume <0-100> ──
  else if (commandName === 'volume') {
    const volArg = args[0];
    if (!volArg) {
      const currentVol = Math.round((musicVolumes.get(guildId) !== undefined ? musicVolumes.get(guildId) : 0.4) * 100);
      return message.reply(`🔊 Volume saat ini adalah **${currentVol}%**.`);
    }
    
    const volume = parseInt(volArg);
    if (isNaN(volume) || volume < 0 || volume > 100) {
      return message.reply('❌ Tingkat volume harus berupa angka antara 0 hingga 100!');
    }
    
    const volDecimal = volume / 100;
    musicVolumes.set(guildId, volDecimal);
    
    const resource = activeResources.get(guildId);
    if (resource && resource.volume) {
      resource.volume.setVolume(volDecimal);
    }
    message.reply(`🔊 Volume berhasil diatur ke **${volume}%**!`);
  }

  // ── .loop ──
  else if (commandName === 'loop') {
    const currentLoop = musicLoops.get(guildId) !== false;
    const newLoop = !currentLoop;
    musicLoops.set(guildId, newLoop);
    
    message.reply(`🔄 Loop folder lagu telah **${newLoop ? 'DIAKTIFKAN' : 'DINONAKTIFKAN'}**!`);
  }

  // ── .stop ──
  else if (commandName === 'stop') {
    const player = musicPlayers.get(guildId);
    if (player) {
      player.stop();
    }
    musicQueues.delete(guildId);
    musicHistories.delete(guildId);
    currentTracks.delete(guildId);
    activeResources.delete(guildId);
    
    message.reply('⏹️ Musik dihentikan, antrean dan riwayat lagu berhasil direset!');
  }
});

// ═══════════════════════════════════════════════════
// VOICE STATE UPDATE HANDLER (Proteksi Saluran)
// ═══════════════════════════════════════════════════
client.on('voiceStateUpdate', async (oldState, newState) => {
  const botId = client.user?.id;
  if (!botId) return;

  if (oldState.member.id === botId) {
    const guildId = oldState.guild.id;
    const lockedChannelId = lockedChannels.get(guildId);

    if (lockedChannelId) {
      if (newState.channelId !== lockedChannelId) {
        console.log(`[Voice Lock] Bot dipindahkan/dikeluarkan ke channel ${newState.channelId || 'NULL'}. Rejoin otomatis ke channel terkunci: ${lockedChannelId}`);
        
        try {
          const connection = joinVoiceChannel({
            channelId: lockedChannelId,
            guildId: guildId,
            adapterCreator: oldState.guild.voiceAdapterCreator,
            selfDeaf: false,
          });

          setupConnectionListeners(connection, guildId, oldState.guild);

          await entersState(connection, VoiceConnectionStatus.Ready, 15_000);

          const player = musicPlayers.get(guildId);
          if (player) {
            connection.subscribe(player);
            if (player.state.status === AudioPlayerStatus.Idle) {
              playLocalMusic(guildId, connection, false);
            }
          }
        } catch (error) {
          console.error(`❌ [Voice Lock Rejoin Error]:`, error.message);
        }
      }
    } else {
      if (!newState.channelId) {
        console.log(`👋 Bot resmi keluar dari voice channel di server ${oldState.guild.name}.`);
        cleanupResources(guildId);
      }
    }
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
