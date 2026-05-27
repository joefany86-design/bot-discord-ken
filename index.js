// Muat environment variables SEBELUM semua require agar .env tersedia di seluruh modul
require('dotenv').config();

const sodium = require('libsodium-wrappers');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
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
const { handleLinkMirroring } = require('./bypass');
const { initStockMarket, handleEconomyChat, handleEconomyCommands } = require('./stockmarket');
const { handleVoiceTodCommand, handleVoiceStateUpdate } = require('./voice_events');

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

// Owner ID dari environment variable (fallback ke default)
const OWNER_ID = process.env.OWNER_ID || '436554535037698059';



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

// Bagikan state ke client agar bisa diakses oleh sub-modul
client.musicPlayers = musicPlayers;
client.activeTtsPlayers = activeTtsPlayers;
client.lockedChannels = lockedChannels;

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

// Mengucapkan teks bahasa Indonesia / Inggris via Google TTS (Smart Pause & Resume)
function speakText(connection, text, guildId, lang = 'id') {
  return new Promise((resolve) => {
    // Batasi panjang teks TTS untuk mencegah abuse (maks 500 karakter)
    const safeText = text.length > 500 ? text.substring(0, 497) + '...' : text;
    const chunks = splitText(safeText);
    if (chunks.length === 0 || !chunks[0]) {
      return resolve();
    }

    // Berhentikan TTS aktif jika ada
    const existingTts = activeTtsPlayers.get(guildId);
    if (existingTts) {
      try { existingTts.stop(); } catch (e) { }
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
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${lang}&client=tw-ob`;

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
client.speakText = speakText;

// Event handler kustom untuk memicu pemutaran TTS dari modul lain (seperti toko role)
client.on('playTtsEvent', async ({ guildId, text, lang }) => {
  const connection = getVoiceConnection(guildId);
  if (connection) {
    try {
      await speakText(connection, text, guildId, lang || 'id');
    } catch (err) {
      console.error('❌ Gagal memutar TTS event:', err.message);
    }
  }
});

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
        try { connection.destroy(); } catch (e) { }
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
    try { musicPlayer.stop(); } catch (e) { }
    musicPlayers.delete(guildId);
  }

  const ttsPlayer = activeTtsPlayers.get(guildId);
  if (ttsPlayer) {
    try { ttsPlayer.stop(); } catch (e) { }
    activeTtsPlayers.delete(guildId);
  }

  musicQueues.delete(guildId);
  musicHistories.delete(guildId);
  currentTracks.delete(guildId);
  activeResources.delete(guildId);

  const connection = getVoiceConnection(guildId);
  if (connection) {
    try { connection.destroy(); } catch (err) { }
  }
}

async function sendInteractiveHelp(replyTarget, isInteraction, user, guild, client) {
  // 1. Bangun embed kontrol panel utama
  const mainEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🎮 PUSAT KONTROL SENTINEL BOT')
    .setThumbnail(client.user.displayAvatarURL())
    .setDescription(
      `Halo Warga **${guild.name}**! 👋✨\n\n` +
      `Selamat datang di **Pusat Kontrol & Navigasi Sentinel Bot 2026**.\n` +
      `Di sini Anda dapat mengakses semua daftar perintah bot secara terperinci, rapi, dan dinamis.\n\n` +
      `👉 Silakan klik tombol di bawah ini untuk membuka menu kontrol yang sesuai:`
    )
    .addFields(
      {
        name: '👤 Panel Kontrol Member',
        value: `Berisi semua perintah publik untuk memutar musik lokal, game Voice Channel (ToD), serta sistem ekonomi & bursa saham server.`,
        inline: false
      },
      {
        name: '🛡️ Panel Kontrol Administrator',
        value: `Berisi semua perintah khusus Owner & Administrator untuk mengonfigurasi ekonomi, bursa saham, toko role, serta game ToD.`,
        inline: false
      }
    )
    .setFooter({ text: 'Gunakan tombol interaktif di bawah untuk bernavigasi!' })
    .setTimestamp();

  // 2. Buat barisan tombol interaktif
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('help_btn_member')
      .setLabel('👤 Member Panel')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('help_btn_admin')
      .setLabel('🛡️ Admin Panel')
      .setStyle(ButtonStyle.Danger)
  );

  // 3. Kirim pesan utama
  let replyMsg;
  if (isInteraction) {
    replyMsg = await replyTarget.reply({ embeds: [mainEmbed], components: [row], fetchReply: true });
  } else {
    replyMsg = await replyTarget.reply({ embeds: [mainEmbed], components: [row] });
  }

  // 4. Inisialisasi Collector Komponen
  const collector = replyMsg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120000 // 2 menit navigasi
  });

  collector.on('collect', async i => {
    // Tombol hanya bisa di-klik oleh si pemanggil perintah
    if (i.user.id !== user.id) {
      return i.reply({ content: '❌ Tombol ini hanya dapat digunakan oleh pemanggil perintah asli!', ephemeral: true });
    }

    try {
      if (i.customId === 'help_btn_member') {
        const memberEmbed = new EmbedBuilder()
          .setColor(0x00FF88)
          .setTitle('👤 PANEL KONTROL MEMBER — SENTINEL')
          .setThumbnail(client.user.displayAvatarURL())
          .setDescription([
            `Berikut adalah daftar seluruh perintah publik yang dapat digunakan oleh seluruh member server:\n`,
            `🎙️ **KONTROL UMUM & SUARA (GENERAL):**`,
            `👉 **\`.join\`** atau **\`/join\`** - Bot masuk ke Voice Channel Anda dan mengunci saluran.`,
            `👉 **\`.leave\`** atau **\`/leave\`** - Membuka kunci saluran dan mengeluarkan bot dari Voice Channel.`,
            `👉 **\`.speak <teks>\`** - Mengucapkan teks Bahasa Indonesia via Google TTS (Gunakan \`.speak en <teks>\` untuk bahasa Inggris).`,
            `👉 **\`.status\`** - Menampilkan status realtime koneksi, pemutar musik, dan statistik sistem bot.`,
            `👉 **\`/help\`** atau **\`.help\`** - Membuka pusat kontrol panel interaktif ini.`,
            `\n🎵 **PEMUTAR MUSIK LOKAL (FOLDER music/):**`,
            `👉 **\`.list\`** - Menampilkan daftar lagu lokal yang tersedia di folder musik.`,
            `👉 **\`.play <nomor/nama>\`** - Memutar lagu pilihan, atau melanjutkan (*resume*) musik yang dijeda.`,
            `👉 **\`.pause\`** - Menjeda pemutaran musik saat ini.`,
            `👉 **\`.resume\`** - Melanjutkan kembali musik yang sedang dijeda.`,
            `👉 **\`.skip\`** atau **\`.next\`** - Melewatkan lagu ke antrean berikutnya.`,
            `👉 **\`.prev\`** atau **\`.back\`** - Memutar kembali lagu sebelumnya di riwayat.`,
            `👉 **\`.volume <0-100>\`** - Mengatur volume pemutar musik bot.`,
            `👉 **\`.loop\`** - Mengaktifkan/menonaktifkan mode loop folder musik.`,
            `👉 **\`.stop\`** - Menghentikan musik dan mereset antrean serta riwayat putar.`,
            `\n🎲 **GAME VOICE CHANNEL (TRUTH OR DARE):**`,
            `👉 **\`.tod\`** atau **\`.truthordare\`** - Memulai sesi lobi game Truth or Dare di Voice Channel.`,
            `👉 **\`.tod status\`** - Mengecek profil, statistik koin, dan performa bermain ToD Anda.`,
            `\n💸 **SISTEM EKONOMI & BURSA SAHAM:**`,
            `👉 **\`.bal\`** atau **\`.profile\`** - Melihat saldo koin Rupiah, total nilai saham, streak, dan total earning.`,
            `👉 **\`.daily\`** - Mengklaim hadiah koin gratis harian (Di-reset tepat pukul 12.00 malam WIB).`,
            `👉 **\`.transfer @user <jumlah>\`** - Mengirim koin secara instan ke member lain (dikenakan pajak transfer 2%).`,
            `👉 **\`.rich\`** atau **\`.leaderboard\`** - Menampilkan papan peringkat 10 member terkaya di server.`,
            `👉 **\`.market\`** atau **\`.saham\`** - Membuka dashboard bursa saham channel dan meluncurkan menu perdagangan interaktif privat.`,
            `👉 **\`.stock <ticker>\`** - Melihat tren visual histori pergerakan harga saham per 5 pembaruan.`,
            `👉 **\`.buy <ticker> <jumlah>\`** - Membeli lembar saham channel (Batas kepemilikan: maks 500 lembar per saham).`,
            `👉 **\`.sell <ticker> <jumlah>\`** - Menjual lembar saham Anda ke bursa (dikenakan pajak transaksi 5%).`,
            `👉 **\`.sellall <ticker>\`** - Melikuidasi/menjual seluruh kepemilikan lembar saham Anda pada ticker terpilih.`,
            `👉 **\`.porto\`** atau **\`.portfolio\`** - Melihat rincian aset investasi, harga beli rata-rata, dan P/L real-time Anda.`,
            `\n🎭 **TOKO ROLE PRESTISE & SPIN GACHA:**`,
            `👉 **\`.shop\`** atau **\`.rolemarket\`** - Membuka etalase pasar role prestise server.`,
            `👉 **\`.buy-role <ID>\`** - Membeli role prestise bergengsi menggunakan saldo koin Anda.`,
            `👉 **\`.gacha-role\`** - Memutar spin gacha role misteri seharga Rp 1.000 (Dua kali lipat jackpot cashback Rp 500 jika duplikat).`
          ].join('\n'))
          .setFooter({ text: 'Sentinel bot • Member Panel' })
          .setTimestamp();

        await i.reply({ embeds: [memberEmbed], ephemeral: true });
      } else if (i.customId === 'help_btn_admin') {
        // Pengecekan perizinan admin
        const OWNER_ID = process.env.OWNER_ID || '436554535037698059';
        const isOwner = i.user.id === OWNER_ID;
        const memberObj = i.member || await guild.members.fetch(i.user.id).catch(() => null);
        const isAdmin = memberObj && memberObj.permissions.has('Administrator');

        if (!isOwner && !isAdmin) {
          return i.reply({ content: '❌ **Akses Ditolak!** Hanya Administrator yang dapat melihat daftar perintah panel admin.', ephemeral: true });
        }

        const adminEmbed = new EmbedBuilder()
          .setColor(0xFF3366)
          .setTitle('🛡️ PANEL KONTROL ADMINISTRATOR — SENTINEL')
          .setThumbnail(client.user.displayAvatarURL())
          .setDescription([
            `Berikut adalah daftar seluruh perintah eksklusif khusus Owner & Administrator server untuk mengelola perekonomian, bursa saham, toko, serta game:\n`,
            `🎲 **KONTROL GAME TRUTH OR DARE (ToD):**`,
            `👉 **\`.tod announce [#channel]\`** - Menyiarkan template pengumuman peluncuran game ToD berbahasa Indonesia yang cantik.`,
            `👉 **\`.tod force-end\`** atau **\`.tod stop\`** - Menghentikan paksa sesi aktif game ToD di Voice Channel secara instan.`,
            `👉 **\`.tod add <truth/dare> <chill/deep/spicy> <teks>\`** - Menambahkan pertanyaan kustom baru ke database ToD.`,
            `\n💰 **PENGELOLAAN SALDO EKONOMI:**`,
            `👉 **\`.eco-give @user <jumlah>\`** - Menambahkan koin kustom secara manual ke dompet user.`,
            `👉 **\`.eco-take @user <jumlah>\`** - Menarik/memotong saldo koin dari dompet user.`,
            `👉 **\`.eco-reset @user\`** - Mereset total saldo dompet, portofolio bursa saham, dan riwayat transaksi user kembali ke 0.`,
            `👉 **\`.eco-resetall\`** - **[BAHAYA]** Mereset total seluruh database perekonomian server (dompet semua user, bursa, dll).`,
            `👉 **\`.anoncemen\`** atau **\`.announcement\`** - Menyiarkan embed pengumuman pembaruan sistem ekonomi ke channel target disertai mention @everyone.`,
            `\n📈 **SUNTIKAN & RESTURASI BURSA SAHAM:**`,
            `👉 **\`.market-add #channel <ticker>\`** - Mendaftarkan text channel baru sebagai instrumen saham di bursa (contoh: \`.market-add #lounge $LOUNGE\`).`,
            `👉 **\`.market-remove <ticker>\`** - Menghapus instrumen saham channel dari bursa dan membersihkan portofolio terkait.`,
            `👉 **\`.market-reinit\`** - Menghapus seluruh instrumen bursa lama dan mengembalikannya ke setelan saham default server.`,
            `👉 **\`.event-trigger [crash/bull/double]\`** - Memicu event crash pasar, bull run bursa, atau double earning hour secara instan.`,
            `\n🎭 **PENGELOLAAN TOKO ROLE & PRESTISE:**`,
            `👉 **\`.autoshoprole\`** atau **\`.shop-auto\`** - **[PREMIUM]** Membuat otomatis seluruh 5 tingkatan role khusus (Common s/d Mythic) dengan warna & izin rarity, serta mendaftarkannya langsung ke database toko role.`,
            `👉 **\`.shop-add @role <harga> [tier] [deskripsi]\`** - Menambahkan manual role server Anda ke dalam daftar toko role dengan klasifikasi kustom.`,
            `👉 **\`.shop-remove <@role atau ID>\`** - Menghapus item role terdaftar dari penjualan toko.`,
            `👉 **\`.shop-setstock <@role atau ID> <stok>\`** - Mengubah jumlah ketersediaan slot role terdaftar (-1 untuk tanpa batas/unlimited).`
          ].join('\n'))
          .setFooter({ text: 'Sentinel bot • Administrator Panel' })
          .setTimestamp();

        await i.reply({ embeds: [adminEmbed], ephemeral: true });
      }
    } catch (err) {
      console.error('Error in interactive help button interaction:', err);
    }
  });

  collector.on('end', async () => {
    // Matikan tombol saat collector berakhir agar bersih
    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('help_btn_member').setLabel('👤 Member Panel').setStyle(ButtonStyle.Primary).setDisabled(true),
      new ButtonBuilder().setCustomId('help_btn_admin').setLabel('🛡️ Admin Panel').setStyle(ButtonStyle.Danger).setDisabled(true)
    );
    await replyMsg.edit({ components: [disabledRow] }).catch(() => {});
  });
}

// ═══════════════════════════════════════════════════
// BOT READY EVENT
// ═══════════════════════════════════════════════════
client.once('clientReady', () => {
  console.log(`══════════════════════════════════════`);
  console.log(`  Bot online sebagai ${client.user.tag}`);
  console.log(`  Servers: ${client.guilds.cache.size}`);
  console.log(`══════════════════════════════════════`);

  client.user.setActivity('🎵 .join & /join | Loop Radio', { type: 2 });

  // SAPAAN TERJADWAL (CRON JOBS) - WIB TIMEZONE
  initGreetings(client);

  // STOCK MARKET & EKONOMI SERVER ("RUPIAH SERVER")
  initStockMarket(client);
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

      // Mengucapkan halo saat bergabung (TTS) menggantikan musik otomatis
      speakText(connection, "Halo semuanya! Saya sudah bergabung.", guildId, 'id').catch(() => {});

      await interaction.reply({
        content: `✅ **Saluran Terkunci!** Berhasil bergabung ke **${voiceChannel.name}**!\n` +
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

    const memberVoiceChannel = member?.voice?.channel;
    const botVoiceChannel = guild.members.me?.voice?.channel;
    if (botVoiceChannel && (!memberVoiceChannel || memberVoiceChannel.id !== botVoiceChannel.id)) {
      return interaction.reply({ content: `❌ Anda harus bergabung ke Voice Channel **${botVoiceChannel.name}** bersama bot untuk menggunakan perintah ini!`, ephemeral: true });
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
    await sendInteractiveHelp(interaction, true, interaction.user, guild, client);
  }
});

// ═══════════════════════════════════════════════════
// PENANGANAN PERINTAH TEKS (PREFIX .)
// ═══════════════════════════════════════════════════
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // Intersepsi & perbaiki link video (TikTok, Twitter/X, Instagram) via Webhook Mirroring
  const processed = await handleLinkMirroring(message, client);
  if (processed) return;

  // Proses perolehan koin pasif dari aktivitas chat & kontribusi skor keaktifan bursa
  await handleEconomyChat(message);

  if (!message.content.startsWith('.')) return;

  // Cek perintah Voice Truth or Dare (Sprint 5)
  const voiceTodHandled = await handleVoiceTodCommand(message, client);
  if (voiceTodHandled) return;

  // Cek perintah Ekonomi / Stock Market
  const economyHandled = await handleEconomyCommands(message, client);
  if (economyHandled) return;



  const args = message.content.slice(1).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const { guildId, member, guild } = message;
  if (!guildId) return;

  // Helper local untuk membalas dengan Embed Cantik & Rapi
  const replyEmbed = async (color, description, title = null) => {
    const embed = new EmbedBuilder()
      .setColor(color)
      .setDescription(description);
    if (title) embed.setTitle(title);
    return message.reply({ embeds: [embed] });
  };

  // ── .admin (Owner & Administrator Only) ──
  if (commandName === 'admin') {
    const isOwner = message.author.id === OWNER_ID;
    const isAdmin = message.member && message.member.permissions.has('Administrator');
    if (!isOwner && !isAdmin) {
      return message.reply('❌ **Akses Ditolak!** Hanya Administrator yang dapat melihat daftar perintah admin.');
    }

    const embed = new EmbedBuilder()
      .setColor(0xFF3366)
      .setTitle('🛡️ MENU KONTROL & PERINTAH ADMINISTRATOR 🛡️')
      .setThumbnail(client.user.displayAvatarURL())
      .setDescription([
        `Halo **${message.author.username}**! Berikut adalah daftar seluruh perintah khusus Owner & Administrator untuk mengelola game Truth or Dare, sistem ekonomi, serta bursa saham di server ini.`,
        `\n🎲 **KONTROL GAME TRUTH OR DARE (ToD):**`,
        `👉 **\`.tod announce [#channel]\`** - Menyiarkan pengumuman peluncuran game ToD ke channel target.`,
        `👉 **\`.tod force-end\`** atau **\`.tod stop\`** - Menghentikan paksa sesi game ToD yang sedang aktif.`,
        `👉 **\`.tod add <truth/dare> <chill/deep/spicy> <teks>\`** - Menambahkan pertanyaan kustom ke database game ToD.`,
        `\n💰 **KONTROL SISTEM EKONOMI (RUPIAH SERVER):**`,
        `👉 **\`.eco-give @user <jumlah>\`** - Memberikan saldo koin kustom ke dompet user.`,
        `👉 **\`.eco-take @user <jumlah>\`** - Menarik/memotong koin dari dompet user.`,
        `👉 **\`.eco-reset @user\`** - Mereset total saldo koin, portofolio saham, dan transaksi user ke 0.`,
        `👉 **\`.eco-announce [#channel]\`** - Menyiarkan laporan/pengumuman keuangan ke channel target.`,
        `👉 **\`.eco-resetall\`** - **[PERINGATAN!]** Mereset total seluruh database keuangan server ini (semua user).`,
        `\n📈 **KONTROL BURSA SAHAM (STOCK MARKET):**`,
        `👉 **\`.market-add #channel <ticker>\`** - Mendaftarkan text channel ke bursa saham (contoh: \`.market-add #general $GENERAL\`).`,
        `👉 **\`.market-remove <ticker>\`** - Menghapus instrumen saham dari bursa server.`,
        `👉 **\`.market-reinit\`** - Menghapus seluruh saham lama dan mengembalikan ke saham bawaan server.`,
        `👉 **\`.event-trigger [crash/bull/double]\`** - Memicu event ekonomi acak/spesifik secara instan untuk kebutuhan uji coba.`,
        `\n🎭 **KONTROL TOKO ROLE (SHOP CONTROLS):**`,
        `👉 **\`.shop-add @role <harga> [tier] [deskripsi]\`** - Menjual role baru di toko (tier pilihan: \`COMMON\`, \`RARE\`, \`EPIC\`, \`LEGENDARY\`).`,
        `👉 **\`.shop-remove <@role atau ID>\`** - Menghapus role dari toko penjualan.`,
        `👉 **\`.shop-setstock <@role atau ID> <stok>\`** - Mengatur jumlah stok role yang tersedia (-1 untuk tanpa batas/unlimited).`,
        `\n*Gunakan perintah di atas dengan bijak untuk menjaga keseimbangan ekonomi dan kenyamanan server.* 💡`
      ].join('\n'))
      .setFooter({ text: 'Bot Administrator Panel 2026' })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  // ── .joinlow ──
  if (commandName === 'joinlow') {
    const voiceChannel = member?.voice?.channel;
    if (!voiceChannel) {
      return replyEmbed(0xFF3366, '🔇 **Anda harus bergabung ke Voice Channel terlebih dahulu!**');
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

      // Mengucapkan halo saat bergabung (TTS) menggantikan musik otomatis
      speakText(connection, "Halo semuanya! Saya sudah bergabung.", guildId, 'id').catch(() => {});

      const embed = new EmbedBuilder()
        .setColor(0x00FF88)
        .setTitle('🔒 Saluran Terkunci & Bergabung!')
        .setDescription(`Berhasil bergabung ke Voice Channel **${voiceChannel.name}**.\n\n` +
          `🛡️ **Mekanisme Proteksi Aktif**: Bot terkunci di channel ini. Jika bot dipindahkan paksa atau dikick, bot akan rejoin secara instan.`)
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Kesalahan join prefix:', error);
      lockedChannels.delete(guildId);
      await replyEmbed(0xFF3366, '❌ **Gagal bergabung ke Voice Channel.**');
    }
  }

  // ── .speaklow <teks> ──
  else if (commandName === 'speaklow') {
    const connection = getVoiceConnection(guildId);
    if (!connection) {
      return replyEmbed(0xFF3366, '❌ **Bot tidak berada di Voice Channel!** Hubungkan bot dengan `.joinlow` terlebih dahulu.');
    }

    let lang = 'id';
    let text = args.join(' ');

    // Cek apakah argumen pertama adalah kode bahasa yang didukung (id atau en)
    if (args[0] && (args[0].toLowerCase() === 'en' || args[0].toLowerCase() === 'id')) {
      lang = args[0].toLowerCase();
      text = args.slice(1).join(' ');
    }

    if (!text) {
      return replyEmbed(0xFF3366, '❌ **Harap masukkan teks yang ingin diucapkan!**\nContoh:\n👉 `.speaklow Halo semuanya` (Bahasa Indonesia)\n👉 `.speaklow en Hello everyone` (Bahasa Inggris)');
    }

    try {
      await message.react('🗣️').catch(() => { });
      await speakText(connection, text, guildId, lang);
    } catch (error) {
      console.error('Kesalahan speak prefix:', error);
    }
  }

  // ── .leavelow ──
  else if (commandName === 'leavelow') {
    const hasLock = lockedChannels.has(guildId);
    if (!hasLock && !getVoiceConnection(guildId)) {
      return replyEmbed(0xFF3366, '❌ **Bot tidak sedang berada di Voice Channel!**');
    }

    const memberVoiceChannel = member?.voice?.channel;
    const botVoiceChannel = guild.members.me?.voice?.channel;
    if (botVoiceChannel && (!memberVoiceChannel || memberVoiceChannel.id !== botVoiceChannel.id)) {
      return replyEmbed(0xFF3366, `❌ **Anda harus bergabung ke Voice Channel** **${botVoiceChannel.name}** bersama bot untuk menggunakan perintah ini!`);
    }

    try {
      lockedChannels.delete(guildId); // Buka kunci terlebih dahulu
      cleanupResources(guildId);

      const embed = new EmbedBuilder()
        .setColor(0xFF3366)
        .setTitle('👋 Keluar dari Voice Channel')
        .setDescription(`Kunci saluran pada **${botVoiceChannel?.name || 'Voice Channel'}** telah dilepas dan bot berhasil keluar secara bersih.`)
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Kesalahan leave prefix:', error);
      await replyEmbed(0xFF3366, '❌ **Terjadi kesalahan saat keluar.**');
    }
  }

  // ── .statuslow ──
  else if (commandName === 'statuslow') {
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

  // ── .help / .helplow / .menu / .control ──
  else if (commandName === 'help' || commandName === 'helplow' || commandName === 'menu' || commandName === 'control') {
    await sendInteractiveHelp(message, false, message.author, guild, client);
  }

  // ── .listlow ──
  else if (commandName === 'listlow') {
    const files = getMusicFiles();
    if (files.length === 0) {
      return replyEmbed(0xFF3366, `⚠️ **Folder music kosong!** Silakan tambahkan file audio ke folder \`${MUSIC_DIR}\`.`);
    }

    const songsList = files.map((file, idx) => `**${idx + 1}**. \`${file}\``).join('\n');
    const embed = new EmbedBuilder()
      .setColor(0x00D2FF)
      .setTitle('🎵 Daftar Lagu Lokal (Folder music/)')
      .setDescription(songsList.length > 2000 ? songsList.substring(0, 1950) + '\n...dan lagu lainnya (terlalu banyak)' : songsList)
      .setFooter({ text: `Total: ${files.length} lagu | Mainkan dengan perintah: .playlow <nomor/nama>` })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }

  // ── .playlow <nomor/nama> ──
  else if (commandName === 'playlow') {
    const connection = getVoiceConnection(guildId);
    if (!connection) {
      return replyEmbed(0xFF3366, '❌ **Bot tidak berada di Voice Channel!** Ketik `.joinlow` terlebih dahulu.');
    }

    const arg = args.join(' ').trim();
    const player = musicPlayers.get(guildId);

    if (!arg) {
      if (player && player.state.status === AudioPlayerStatus.Paused) {
        player.unpause();
        return replyEmbed(0x00FF88, '▶️ **Melanjutkan pemutaran musik** yang sedang dijeda.');
      } else {
        playLocalMusic(guildId, connection, false);
        return replyEmbed(0x00FF88, '▶️ **Memulai pemutaran musik** dari folder musik.');
      }
    }

    const files = getMusicFiles();
    if (files.length === 0) {
      return replyEmbed(0xFF3366, '❌ **Folder musik kosong!**');
    }

    let targetFile = null;
    const index = parseInt(arg);

    if (!isNaN(index)) {
      if (index < 1 || index > files.length) {
        return replyEmbed(0xFF3366, `❌ **Nomor lagu tidak valid!** Silakan pilih nomor 1 hingga ${files.length}. Ketik \`.listlow\` untuk melihat daftar.`);
      }
      targetFile = files[index - 1];
    } else {
      targetFile = files.find(file => file.toLowerCase().includes(arg.toLowerCase()));
    }

    if (!targetFile) {
      return replyEmbed(0xFF3366, `❌ **Lagu tidak ditemukan!** Kata kunci \`${arg}\` tidak cocok dengan lagu apa pun. Ketik \`.listlow\` untuk melihat daftar.`);
    }

    let queue = musicQueues.get(guildId) || [];
    queue.unshift(targetFile);
    musicQueues.set(guildId, queue);

    const volume = Math.round((musicVolumes.get(guildId) !== undefined ? musicVolumes.get(guildId) : 0.4) * 100);

    if (player) {
      player.stop();
    } else {
      playLocalMusic(guildId, connection, false);
    }

    const embed = new EmbedBuilder()
      .setColor(0x00FF88)
      .setTitle('▶️ Memutar Lagu Pilihan')
      .setDescription(`Lagu: \`${targetFile}\`\n\n🔊 Volume: \`${volume}%\``)
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }

  // ── .pauselow ──
  else if (commandName === 'pauselow') {
    const player = musicPlayers.get(guildId);
    if (player && player.state.status === AudioPlayerStatus.Playing) {
      player.pause();
      await replyEmbed(0xFFB300, '⏸️ **Musik berhasil dijeda!** Gunakan `.resumelow` untuk melanjutkan kembali.');
    } else {
      await replyEmbed(0xFF3366, '❌ **Musik tidak sedang diputar saat ini!**');
    }
  }

  // ── .resumelow ──
  else if (commandName === 'resumelow') {
    const player = musicPlayers.get(guildId);
    if (player && player.state.status === AudioPlayerStatus.Paused) {
      player.unpause();
      await replyEmbed(0x00FF88, '▶️ **Musik berhasil dilanjutkan kembali!**');
    } else {
      await replyEmbed(0xFF3366, '❌ **Musik tidak sedang dijeda saat ini!**');
    }
  }

  // ── .skiplow / .nextlow ──
  else if (commandName === 'skiplow' || commandName === 'nextlow') {
    const player = musicPlayers.get(guildId);
    const connection = getVoiceConnection(guildId);
    if (!connection) {
      return replyEmbed(0xFF3366, '❌ **Bot tidak berada di Voice Channel!**');
    }
    if (player) {
      player.stop();
      await replyEmbed(0x00D2FF, '⏭️ **Lagu dilewati!** Memutar lagu berikutnya...');
    } else {
      await replyEmbed(0xFF3366, '❌ **Pemutar musik tidak aktif!**');
    }
  }

  // ── .prevlow / .backlow ──
  else if (commandName === 'prevlow' || commandName === 'backlow') {
    const history = musicHistories.get(guildId) || [];
    if (history.length === 0) {
      return replyEmbed(0xFF3366, '❌ **Tidak ada riwayat lagu sebelumnya yang diputar!**');
    }

    const current = currentTracks.get(guildId);
    const queue = musicQueues.get(guildId) || [];
    const player = musicPlayers.get(guildId);
    const connection = getVoiceConnection(guildId);

    if (!connection) {
      return replyEmbed(0xFF3366, '❌ **Bot tidak berada di Voice Channel!**');
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
    } else {
      playLocalMusic(guildId, connection, false);
    }

    const embed = new EmbedBuilder()
      .setColor(0x00D2FF)
      .setTitle('⏮️ Memutar Lagu Sebelumnya')
      .setDescription(`Kembali memutar: \`${prevTrack}\``)
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  }

  // ── .volumelow <0-100> ──
  else if (commandName === 'volumelow') {
    const volArg = args[0];
    if (!volArg) {
      const currentVol = Math.round((musicVolumes.get(guildId) !== undefined ? musicVolumes.get(guildId) : 0.4) * 100);
      return replyEmbed(0x00D2FF, `🔊 **Volume musik saat ini adalah:** \`${currentVol}%\``);
    }

    const volume = parseInt(volArg);
    if (isNaN(volume) || volume < 0 || volume > 100) {
      return replyEmbed(0xFF3366, '❌ **Tingkat volume harus berupa angka antara 0 hingga 100!**');
    }

    const volDecimal = volume / 100;
    musicVolumes.set(guildId, volDecimal);

    const resource = activeResources.get(guildId);
    if (resource && resource.volume) {
      resource.volume.setVolume(volDecimal);
    }
    await replyEmbed(0x00FF88, `🔊 **Volume berhasil diatur ke:** \`${volume}%\``);
  }

  // ── .looplow ──
  else if (commandName === 'looplow') {
    const currentLoop = musicLoops.get(guildId) !== false;
    const newLoop = !currentLoop;
    musicLoops.set(guildId, newLoop);

    await replyEmbed(0x00FF88, `🔄 **Loop folder lagu telah:** \`${newLoop ? 'DIAKTIFKAN' : 'DINONAKTIFKAN'}\``);
  }

  // ── .stoplow ──
  else if (commandName === 'stoplow') {
    const player = musicPlayers.get(guildId);
    if (player) {
      player.stop();
    }
    musicQueues.delete(guildId);
    musicHistories.delete(guildId);
    currentTracks.delete(guildId);
    activeResources.delete(guildId);

    await replyEmbed(0xFF3366, '⏹️ **Musik dihentikan!** Antrean dan riwayat lagu berhasil direset.');
  }
});

// ═══════════════════════════════════════════════════
// VOICE STATE UPDATE HANDLER (Proteksi Saluran)
// ═══════════════════════════════════════════════════
client.on('voiceStateUpdate', async (oldState, newState) => {
  // Pemicu Auto Event Voice Channel (Sprint 5)
  handleVoiceStateUpdate(oldState, newState, client);

  const botId = client.user?.id;
  if (!botId) return;

  // --- FITUR GREETING / MENYAPA PENGGUNA YANG GABUNG VC ---
  const botMember = newState.guild.members.me;
  const botVoiceChannelId = botMember?.voice?.channelId;

  // Cek jika pengguna lain (bukan bot) berpindah atau masuk ke Voice Channel
  if (newState.member.id !== botId && !newState.member.user.bot) {
    // Pengguna harus masuk ke VC bot dan berbeda dari channel sebelumnya
    if (newState.channelId && newState.channelId === botVoiceChannelId) {
      if (oldState.channelId !== newState.channelId) {
        console.log(`🔊 [Voice Join] ${newState.member.displayName} bergabung ke VC bot.`);
        const connection = getVoiceConnection(newState.guild.id);
        if (connection) {
          const displayName = newState.member.displayName;
          const greetingText = `Halo ${displayName}, selamat bergabung!`;
          speakText(connection, greetingText, newState.guild.id, 'id').catch(err => {
            console.error('❌ Gagal memutar suara sapaan join:', err.message);
          });
        }
      }
    }
  }
  // --------------------------------------------------------

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
            // Jangan putar musik otomatis saat rejoin jika player idle agar sesuai keinginan user
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

// ═══════════════════════════════════════════════════
// GRACEFUL SHUTDOWN (PM2 / VPS / Docker)
// ═══════════════════════════════════════════════════
function gracefulShutdown(signal) {
  console.log(`⚠️ ${signal} diterima. Melakukan shutdown bersih...`);

  // Bersihkan semua koneksi voice
  client.guilds.cache.forEach(guild => {
    cleanupResources(guild.id);
  });

  // Tutup koneksi Discord
  client.destroy();
  console.log('✅ Bot berhasil dimatikan secara bersih.');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
