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
const { handleVoiceTodCommand } = require('./voice_events');

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
    GatewayIntentBits.GuildMembers,
  ]
});

global.client = client;

// ═══════════════════════════════════════════════════
// KONFIGURASI PEMUTAR MUSIK LOKAL, TTS & STATE MAPS
// ═══════════════════════════════════════════════════
const https = require('https');
const os = require('os');

// State Maps untuk melacak status bot per server (Guild)
const lockedChannels = new Map();     // ID Voice Channel terkunci per server
const activeTtsPlayers = new Map();   // AudioPlayer TTS aktif per server

// Bagikan state ke client agar bisa diakses oleh sub-modul
client.activeTtsPlayers = activeTtsPlayers;
client.lockedChannels = lockedChannels;
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

    const ttsPlayer = createAudioPlayer();
    activeTtsPlayers.set(guildId, ttsPlayer);
    connection.subscribe(ttsPlayer);

    let index = 0;

    const playNextChunk = () => {
      if (index >= chunks.length) {
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
  const ttsPlayer = activeTtsPlayers.get(guildId);
  if (ttsPlayer) {
    try { ttsPlayer.stop(); } catch (e) { }
    activeTtsPlayers.delete(guildId);
  }

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
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('help_btn_portal')
      .setLabel('🎮 Portal Hub')
      .setStyle(ButtonStyle.Success)
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
      return i.reply({ content: '❌ Tombol ini hanya dapat digunakan oleh pemanggil perintah asli!', flags: 64 });
    }

    try {
      if (i.customId === 'help_btn_portal') {
        const portalEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('🎮 SENTINEL PORTAL HUB — PUSAT KONTROL UTAMA')
          .setThumbnail(client.user.displayAvatarURL())
          .setDescription(
            `Halo **${user.username}**! Selamat datang di Portal Hub Sentinel.\n` +
            `Di sini Anda dapat mengakses semua sistem permainan server secara pribadi dan instan tanpa perlu mengetikkan perintah teks. 🌟\n\n` +
            `👉 **Silakan klik tombol di bawah ini untuk membuka panel kontrol sistem masing-masing:**`
          )
          .setFooter({ text: 'Sentinel Active Gamification • Pusat Kontrol Warga' })
          .setTimestamp();

        const row1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('eco_btn_open_shop_private_perm').setLabel('🛍️ Toko Role').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('eco_btn_open_market_private_perm').setLabel('📈 Bursa Saham').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('eco_btn_open_bank_private_perm').setLabel('🏦 Bank Sentral').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('eco_btn_open_bm_private_perm').setLabel('🕵️‍♂️ Black Market').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('eco_btn_open_inventory_private_perm').setLabel('🎒 Inventory Saya').setStyle(ButtonStyle.Success)
        );

        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('pet_btn_open_pet_private_perm').setLabel('🐾 Kandang Pet').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('pet_btn_open_shop_private_perm').setLabel('🛍️ Toko Pet').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('eco_btn_open_kos_private_perm').setLabel('🛌 Sewa Kosan').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('eco_btn_open_garden_private_perm').setLabel('🌱 Cozy Garden').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('pet_btn_open_quests_private_perm').setLabel('📋 Misi Harian Pet').setStyle(ButtonStyle.Primary)
        );

        await i.reply({ embeds: [portalEmbed], components: [row1, row2], flags: 64 });
      }

      if (i.customId === 'help_btn_member') {
        const memberEmbed = new EmbedBuilder()
          .setColor(0x00FF88)
          .setTitle('👤 PANEL KONTROL MEMBER — SENTINEL')
          .setThumbnail(client.user.displayAvatarURL())
          .setDescription([
            `Berikut adalah daftar seluruh perintah publik yang dapat digunakan oleh seluruh member server:\n`,
            `🎙️ **KONTROL UMUM & SUARA (GENERAL):**`,
            `👉 **\`.join\`** / **\`/join\`** - Bot gabung & mengunci VC Anda (Auto-Rejoin jika dc).`,
            `👉 **\`.leave\`** / **\`/leave\`** - Membuka kunci VC & menyuruh bot keluar secara bersih.`,
            `👉 **\`.speak <teks>\`** - Mengucapkan teks Bahasa Indonesia via Google TTS (Gunakan \`.speak en <teks>\` untuk bahasa Inggris).`,
            `👉 **\`.status\`** - Menampilkan status realtime koneksi, RAM VPS, & uptime bot.`,
            `👉 **\`/help\`** atau **\`.help\`** - Membuka pusat kontrol panel interaktif ini.`,
            `\n🎲 **GAME VOICE CHANNEL (TRUTH OR DARE):**`,
            `👉 **\`.tod\`** / **\`.truthordare\`** - Memulai sesi lobi game Truth or Dare di Voice Channel.`,
            `👉 **\`.tod status\`** - Mengecek profil, statistik koin, dan performa bermain ToD Anda.`,
            `\n💸 **SISTEM EKONOMI PASIF & SAHAM:**`,
            `👉 **\`.bal\`** / **\`.profile\`** - Melihat saldo koin Rupiah, total nilai saham, streak, dan kasta role.`,
            `👉 **\`.daily\`** - Mengklaim hadiah koin gratis harian.`,
            `👉 **\`.transfer @user <jumlah>\`** - Mengirim koin ke member lain (pajak transfer 10%, sewa kosan mengurangi pajak).`,
            `👉 **\`.rich\`** / **\`.leaderboard\`** - Menampilkan papan peringkat 10 member terkaya.`,
            `👉 **\`.market\`** / **\`.saham\`** - Membuka dashboard bursa saham channel dan meluncurkan menu perdagangan interaktif.`,
            `👉 **\`.stock <ticker>\`** / **\`.chart <ticker>\`** - Melihat grafik tren 2D ASCII dengan tombol Beli/Jual/Refresh.`,
            `👉 **\`.buy <ticker> <jumlah>\`** / **\`.sell\`** / **\`.sellall\`** - Transaksi jual beli lembar saham.`,
            `👉 **\`.porto\`** / **\`.portfolio\`** - Melihat rincian aset investasi, rata-rata beli, & profit/loss real-time.`,
            `\n🏛️ **CENTRAL BANK & PERBANKAN:**`,
            `👉 **\`.bank\`** - Membuka panel kontrol bank interaktif untuk menabung (+1.5% bunga harian) atau meminjam koin.`,
            `\n🛌 **SEWA KAMAR & UPGRADE KOSAN:**`,
            `👉 **\`.kos\`** / **\`.kosan\`** - Dashboard hunian, sisa durasi sewa, pasif buffs, & furniture.`,
            `👉 **\`.kos-sewa\`** - Sewa kamar (Kipas/AC/Penthouse) dengan berbagai efek pasif & diskon pajak.`,
            `👉 **\`.kos-upgrade\`** - Belanja furniture kosan permanen (Kasur, WiFi, Dispenser, Gembok).`,
            `\n🐾 **SISTEM PET (TAMAGOTCHI STYLE):**`,
            `👉 **\`.pet\`** - Dashboard status peliharaan Anda & tombol interaktif perawatan.`,
            `👉 **\`.pet buy <nama> <slime/dragon/cat/golem>\`** - Adopsi telur pet seharga **Rp 1.500**.`,
            `👉 **\`.pet shop\`** / **\`.pet buy-item <item_id> [jumlah]\`** - Belanja persediaan barang pet.`,
            `👉 **\`.pet work\`** / **\`.pet hunt\`** - Kirim pet bekerja secara aman atau berburu di hutan liar.`,
            `👉 **\`.pet expedition\`** - Lobi co-op PVE berpetualang kelompok mengalahkan bos zona (Hadiah koin & jackpot drop item).`,
            `👉 **\`.pet play\`** - Bermain bersama pet untuk memulihkan kebahagiaan & XP.`,
            `👉 **\`.pet pvp @user <taruhan>\`** - Duel Arena PvP antar pet memperebutkan koin taruhan.`,
            `👉 **\`.pet reset\`** - Mengosongkan kandang untuk mengadopsi pet baru.`,
            `👉 **\`.pet auto-care\`** - Buka perawatan pet otomatis (makan/minum gratis saat lapar/haus) seharga **Rp 5.000**.`,
            `\n💥 **PERAMPOKAN BERISIKO TINGGI (ROB & HEIST):**`,
            `👉 **\`.rob @user\`** - Mencuri sebagian koin target secara solo (sukses rate 40%). Gagal masuk penjara!`,
            `👉 **\`.heist\`** / **\`.heist start\`** - Mengajak kru merampok Bank Server secara multiplayer.`,
            `👉 **\`.jail\`** / **\`.jail @user\`** - Cek status penjara virtual dan tebus jaminan agar bebas instan.`,
            `👉 **\`.bayar-hutang @user [jumlah]\`** - Melunasi hutang tebusan jaminan penjara kepada teman.`,
            `\n🎭 **TOKO ROLE PRESTISE & SPIN GACHA:**`,
            `👉 **\`.shop\`** / **\`.rolemarket\`** - Membuka etalase pasar role prestise server.`,
            `👉 **\`.buy-role <ID>\`** - Membeli role prestise bergengsi menggunakan saldo koin Anda.`,
            `👉 **\`.gacha-role\`** - Memutar spin gacha role misteri seharga Rp 1.000 (Jackpot/Cashback jika duplikat).`,
            `👉 **\`.indexrole\`** - Menampilkan kartu index seluruh kasta role prestise yang Anda miliki.`
          ].join('\n'))
          .setFooter({ text: 'Sentinel bot • Member Panel' })
          .setTimestamp();

        await i.reply({ embeds: [memberEmbed], flags: 64 });
      } else if (i.customId === 'help_btn_admin') {
        // Pengecekan perizinan admin
        const OWNER_ID = process.env.OWNER_ID || '436554535037698059';
        const isOwner = i.user.id === OWNER_ID;
        const isGuildOwner = guild && i.user.id === guild.ownerId;
        const memberObj = i.member || await guild.members.fetch(i.user.id).catch(() => null);
        const isAdmin = memberObj && memberObj.permissions.has('Administrator');

        if (!isOwner && !isAdmin && !isGuildOwner) {
          return i.reply({ content: '❌ **Akses Ditolak!** Hanya Administrator yang dapat melihat daftar perintah panel admin.', flags: 64 });
        }

        const adminEmbed = new EmbedBuilder()
          .setColor(0xFF3366)
          .setTitle('🛡️ PANEL KONTROL ADMINISTRATOR — SENTINEL')
          .setThumbnail(client.user.displayAvatarURL())
          .setDescription(`Halo **${user.username}**! Berikut adalah daftar seluruh perintah khusus Owner & Administrator server untuk mengelola perekonomian, bursa saham, toko, serta game:`)
          .addFields(
            {
              name: '👑 PANEL KONTROL VISUAL INTERAKTIF [REKOMENDASI!]',
              value: [
                `👉 **\`.admin-panel\`** / **\`.panel-admin\`** - Membuka **Dashboard Sentinel Terpadu** (Portal Hub utama).`,
                `👉 **\`.admin-pet\`** / **\`.panel-pet\`** - Membuka langsung **Panel Pet Kandang & Perawatan** (HP, XP, level, egg hatch, reset).`,
                `👉 **\`.admin-bank\`** / **\`.panel-bank\`** - Membuka langsung **Panel Perbankan & Keuangan** (suntik/tarik koin, reset eco, eco-giveall).`,
                `👉 **\`.admin-rob\`** / **\`.panel-rob\`** - Membuka langsung **Panel Hukum & Lapas Virtual** (bebas lapas target/massal, reset CD robbery).`,
                `👉 **\`.admin-saham\`** / **\`.panel-saham\`** - Membuka langsung **Panel Bursa Saham & Event Pasar** (drop price, remove, trigger events).`,
                `👉 **\`.abyus\`** / **\`.abyus-panel\`** - Membuka langsung **Panel Bypass & Event Abuse** (mode gacha, multiplier koin).`,
                `👉 **\`.admin-shop\`** / **\`.panel-shop\`** - Membuka langsung **Panel Toko Role & Game Truth or Dare**.`
              ].join('\n')
            },
            {
              name: '🎲 KONTROL GAME TRUTH OR DARE (ToD)',
              value: [
                `👉 **\`.tod announce [#channel]\`** - Menyiarkan template pengumuman peluncuran game ToD berbahasa Indonesia yang cantik.`,
                `👉 **\`.tod force-end\`** atau **\`.tod stop\`** - Menghentikan paksa sesi aktif game ToD di Voice Channel secara instan.`,
                `👉 **\`.tod add <truth/dare> <chill/deep/spicy> <teks>\`** - Menambahkan pertanyaan kustom baru ke database ToD.`
              ].join('\n')
            },
            {
              name: '💰 PENGELOLAAN SALDO EKONOMI',
              value: [
                `👉 **\`.eco-give @user <jumlah | "random" [min] [max]>\`** - Memberikan koin (jumlah tetap atau acak) ke dompet user.`,
                `👉 **\`.eco-giveall <jumlah | "random" [min] [max]>\`** - Memberikan koin (jumlah tetap atau acak) kepada seluruh member server.`,
                `👉 **\`.eco-take @user <jumlah>\`** - Menarik/memotong saldo koin dari dompet user.`,
                `👉 **\`.eco-reset @user\`** - Mereset total saldo dompet, portofolio bursa saham, dan riwayat transaksi user kembali ke 0.`,
                `👉 **\`.eco-resetall\`** - **[BAHAYA]** Mereset total seluruh database perekonomian server (dompet semua user, bursa, dll).`,
                `👉 **\`.anoncemen\`** atau **\`.announcement\`** - Menyiarkan embed pengumuman pembaruan sistem ekonomi ke channel target disertai mention @everyone.`
              ].join('\n')
            },
            {
              name: '📈 SUNTIKAN & RESTURASI BURSA SAHAM',
              value: [
                `👉 **\`.market-add #channel <ticker>\`** - Mendaftarkan text channel baru sebagai instrumen saham di bursa (contoh: \`.market-add #lounge $LOUNGE\`).`,
                `👉 **\`.market-remove <ticker>\`** - Menghapus instrumen saham channel dari bursa dan membersihkan portofolio terkait.`,
                `👉 **\`.market-reinit\`** - Menghapus seluruh instrumen bursa lama dan mengembalikannya ke setelan saham default server.`,
                `👉 **\`.market-drop <ticker> <persen>\`** - Menurunkan harga saham secara paksa berdasarkan persentase (contoh: \`.market-drop $LOUNGE 15\`).`,
                `👉 **\`.dividends-trigger\`** - Memicu pembagian dividen mingguan bursa secara dinamis berbasis keaktifan chat warga.`,
                `👉 **\`.event-trigger [crash/bull/double]\`** - Memicu event crash pasar, bull run bursa, atau double earning hour secara instan.`
              ].join('\n')
            },
            {
              name: '🎭 PENGELOLAAN TOKO ROLE & PRESTISE',
              value: [
                `👉 **\`.autoshoprole\`** atau **\`.shop-auto\`** - **[PREMIUM]** Membuat otomatis seluruh 5 tingkatan role khusus (Common s/d Mythic) dengan warna & izin rarity, serta mendaftarkannya langsung ke database toko role.`,
                `👉 **\`.shop-add @role <harga> [tier] [deskripsi]\`** - Menambahkan manual role server Anda ke dalam daftar toko role dengan klasifikasi kustom.`,
                `👉 **\`.shop-remove <@role atau ID>\`** - Menghapus item role terdaftar dari penjualan toko.`,
                `👉 **\`.shop-setstock <@role atau ID> <stok>\`** - Mengubah jumlah ketersediaan slot role terdaftar (-1 untuk tanpa batas/unlimited).`
              ].join('\n')
            },
            {
              name: '⚡ KONTROL BYPASS ADMIN (EBYUS / ABYUS) [NEW!]',
              value: [
                `👉 **\`.ebyus\`** / **\`.abyus\`** - Membuka dashboard kontrol panel visual untuk sabotase gacha, multiplier koin chat, dll.`,
                `👉 **\`.ebyus-gacha <mode> [durasi_menit]\`** - Mengatur manual mode gacha (\`normal\`, \`easy\`, \`super_easy\`, \`abuse\`) beserta durasi auto-reset.`,
                `👉 **\`.ebyus-coin <multiplier> [durasi_menit]\`** - Mengatur manual pengali koin chat (\`off\`, \`3\`, \`4\`, \`5\`, \`6\`, \`7\`, \`8\`) beserta durasi auto-reset.`,
                `👉 **\`.ebyus status\`** - Melihat status bypass ekonomi aktif (mode gacha, multiplier koin chat, sisa durasi event, dll).`,
                `👉 **\`.stop-abyus\`** / **\`.stop-ebyus\`** - **[DARURAT]** Menghentikan paksa seluruh event abuse ekonomi server seketika!`
              ].join('\n')
            },
            {
              name: '🚨 KONTROL LAPAS & HEIST ADMINISTRASI',
              value: [
                `👉 **\`.heist-admin free @user\`** - Membebaskan paksa tahanan dari Penjara Virtual secara instan.`,
                `👉 **\`.heist-admin reset\`** - Mereset cooldown global Bank Heist server secara instan.`
              ].join('\n')
            },
            {
              name: '🐾 KONTROL KANDANG & PERAWATAN PET',
              value: [
                `👉 **\`.pet-admin reset @user\`** - Menghapus data pet kotor/mati milik user kembali ke kondisi awal (adopsi ulang).`,
                `👉 **\`.pet-admin heal @user\`** - Menyembuhkan & memulihkan stats HP/Kenyangan/Hidrasi pet user menjadi 100% instan.`,
                `👉 **\`.pet-admin give-xp @user <jumlah>\`** - Menyuntikkan poin XP tambahan ke pet milik user.`,
                `👉 **\`.pet-admin hatch @user\`** - Mempercepat penetasan telur pet milik user seketika.`
              ].join('\n')
            }
          )
          .setFooter({ text: 'Sentinel bot • Administrator Panel' })
          .setTimestamp();

        await i.reply({ embeds: [adminEmbed], flags: 64 });
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
    await replyMsg.edit({ components: [disabledRow] }).catch(() => { });
  });
}

async function sendPortalHubDirect(replyTarget, isInteraction, user, guild, client) {
  const portalEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🎮 SENTINEL PORTAL HUB — PUSAT KONTROL UTAMA')
    .setThumbnail(client.user.displayAvatarURL())
    .setDescription(
      `Halo **${user.username}**! Selamat datang di Portal Hub Sentinel.\n` +
      `Di sini Anda dapat mengakses semua sistem permainan server secara pribadi dan instan tanpa perlu mengetikkan perintah teks. 🌟\n\n` +
      `👉 **Silakan klik tombol di bawah ini untuk membuka panel kontrol sistem masing-masing:**`
    )
    .setFooter({ text: 'Sentinel Active Gamification • Pusat Kontrol Warga' })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('eco_btn_open_shop_private_perm').setLabel('🛍️ Toko Role').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('eco_btn_open_market_private_perm').setLabel('📈 Bursa Saham').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('eco_btn_open_bank_private_perm').setLabel('🏦 Bank Sentral').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eco_btn_open_bm_private_perm').setLabel('🕵️‍♂️ Black Market').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('eco_btn_open_inventory_private_perm').setLabel('🎒 Inventory Saya').setStyle(ButtonStyle.Success)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('pet_btn_open_pet_private_perm').setLabel('🐾 Kandang Pet').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('pet_btn_open_shop_private_perm').setLabel('🛍️ Toko Pet').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('eco_btn_open_kos_private_perm').setLabel('🛌 Sewa Kosan').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eco_btn_open_garden_private_perm').setLabel('🌱 Cozy Garden').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('pet_btn_open_quests_private_perm').setLabel('📋 Misi Harian Pet').setStyle(ButtonStyle.Primary)
  );

  if (isInteraction) {
    await replyTarget.reply({ embeds: [portalEmbed], components: [row1, row2], flags: 64 });
  } else {
    await replyTarget.reply({ embeds: [portalEmbed], components: [row1, row2] });
  }
}

// ═══════════════════════════════════════════════════
// BOT READY EVENT
// ═══════════════════════════════════════════════════
client.once('clientReady', () => {
  console.log(`══════════════════════════════════════`);
  console.log(`  Bot online sebagai ${client.user.tag}`);
  console.log(`  Servers: ${client.guilds.cache.size}`);
  console.log(`══════════════════════════════════════`);

  client.user.setActivity('🎙️ .join & /join | Sentinel Bot', { type: 2 });

  // Cache seluruh member di guild target agar status bot bisa dideteksi secara akurat
  const targetGuild = client.guilds.cache.get('1410239829874053296');
  if (targetGuild) {
    targetGuild.members.fetch().then(() => {
      console.log('✅ Berhasil mencache seluruh member guild 1410239829874053296');
    }).catch(err => {
      console.error('❌ Gagal mencache member guild:', err.message);
    });
  }

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
    return interaction.reply({ content: '❌ Perintah ini hanya dapat digunakan di dalam server Discord!', flags: 64 });
  }

  // Proteksi Saluran Portal (#🛍️┃shop): Blokir seluruh slash command agar channel tetap bersih
  if (interaction.channelId === '1510121069783023646') {
    return interaction.reply({
      content: '⚠️ Saluran ini hanya untuk **Dashboard Portal**. Silakan gunakan perintah bot di channel obrolan biasa atau <#1508417228624887928>!',
      flags: 64
    });
  }



  // ── JOIN ──
  if (commandName === 'join') {
    const voiceChannel = member.voice.channel;
    if (!voiceChannel) {
      return interaction.reply({ content: '🔇 Kamu harus bergabung ke Voice Channel terlebih dahulu!', flags: 64 });
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
      speakText(connection, "Halo semuanya! Saya sudah bergabung.", guildId, 'id').catch(() => { });

      await interaction.reply({
        content: `✅ **Saluran Terkunci!** Berhasil bergabung ke **${voiceChannel.name}**!\n` +
          `🛡️ *Mekanisme proteksi aktif: Bot terkunci di channel ini.*`,
        flags: 64
      });
    } catch (error) {
      console.error('Kesalahan slash join:', error);
      lockedChannels.delete(guildId);
      await interaction.reply({
        content: `❌ **Gagal bergabung ke Voice Channel!**\n\n` +
          `**Kemungkinan penyebab:**\n` +
          `1️⃣ **Port UDP Terblokir** di VPS Rumahweb (Harap buka port outbound UDP 50000-65535).\n` +
          `2️⃣ **Izin Kurang** (Pastikan role bot memiliki izin \`Connect\` dan \`Speak\` di VC tersebut).\n` +
          `3️⃣ **Timeout Jaringan** (Discord gateway sedang sibuk, silakan coba lagi atau jalankan restart bot di VPS).`,
        flags: 64
      });
    }
  }

  // ── LEAVE ──
  else if (commandName === 'leave') {
    const hasLock = lockedChannels.has(guildId);
    if (!hasLock && !getVoiceConnection(guildId)) {
      return interaction.reply({ content: '❌ Bot tidak sedang berada di Voice Channel!', flags: 64 });
    }

    const memberVoiceChannel = member?.voice?.channel;
    const botVoiceChannel = guild.members.me?.voice?.channel;
    if (botVoiceChannel && (!memberVoiceChannel || memberVoiceChannel.id !== botVoiceChannel.id)) {
      return interaction.reply({ content: `❌ Anda harus bergabung ke Voice Channel **${botVoiceChannel.name}** bersama bot untuk menggunakan perintah ini!`, flags: 64 });
    }

    try {
      lockedChannels.delete(guildId); // Buka kunci terlebih dahulu
      cleanupResources(guildId);
      await interaction.reply({ content: '👋 Berhasil membuka kunci saluran dan keluar dari Voice Channel!', flags: 64 });
    } catch (error) {
      console.error('Kesalahan leave:', error);
      await interaction.reply({ content: '❌ Terjadi kesalahan saat keluar.', flags: 64 });
    }
  }

  // ── HELP ──
  else if (commandName === 'help') {
    await sendInteractiveHelp(interaction, true, interaction.user, guild, client);
  }
  // ── PORTAL HUB DIRECT ──
  else if (commandName === 'portal' || commandName === 'portalhub' || commandName === 'hub') {
    await sendPortalHubDirect(interaction, true, interaction.user, guild, client);
  }
});

// ═══════════════════════════════════════════════════
// PENANGANAN PERINTAH TEKS (PREFIX .)
// ═══════════════════════════════════════════════════
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // Proteksi Saluran Khusus Pet saat Ekspedisi berlangsung (Channel ID: 1509762623917265137)
  if (message.channelId === '1509762623917265137') {
    const activeLobby = client.activeExpeditions;
    const guildHasActiveExpedition = activeLobby && Array.from(activeLobby.values()).some(l => l.guildId === message.guildId);

    if (guildHasActiveExpedition) {
      const content = message.content.trim().toLowerCase();
      if (content.startsWith('.pet')) {
        // Izinkan hanya .pet expedition (termasuk .pet expedition join, dst.)
        const isExpedition = content.startsWith('.pet expedition') || content.startsWith('.pet pet-expedition') || content.startsWith('.pet expidition');
        if (!isExpedition) {
          const isOwner = message.author.id === OWNER_ID;
          const isAdmin = message.member && message.member.permissions.has('Administrator');
          if (!isOwner && !isAdmin) {
            await message.delete().catch(() => {});
            const warnMsg = await message.channel.send({
              content: `⚠️ <@${message.author.id}>, sedang ada **Ekspedisi Pet** yang berjalan! Anda tidak boleh menggunakan perintah pet lain selain \`.pet expedition\` di channel ini sampai ekspedisi selesai.`
            }).catch(() => null);

            if (warnMsg) {
              setTimeout(() => {
                warnMsg.delete().catch(() => {});
              }, 5000);
            }
            return;
          }
        }
      }
    }
  }

  // Proteksi Saluran Papan Peringkat Realtime (Channel ID: 1510230591860113418 / 1510232295448117308 / 1510240252458176662)
  if (message.channelId === '1510230591860113418' || message.channelId === '1510232295448117308' || message.channelId === '1510240252458176662') {
    const isOwner = message.author.id === OWNER_ID;
    const isAdmin = message.member && message.member.permissions.has('Administrator');

    if (!isOwner && !isAdmin) {
      await message.delete().catch(() => {});
      const warnMsg = await message.channel.send({
        content: `⚠️ <@${message.author.id}>, saluran ini hanya diperuntukkan untuk menampilkan papan peringkat realtime!`
      }).catch(() => null);

      if (warnMsg) {
        setTimeout(() => {
          warnMsg.delete().catch(() => {});
        }, 5000);
      }
      return;
    }
  }

  // Proteksi Saluran Laporan Bursa Saham (Channel ID: 1509480324373942272)
  if (message.channelId === '1509480324373942272') {
    const isOwner = message.author.id === OWNER_ID;
    const isAdmin = message.member && message.member.permissions.has('Administrator');

    if (!isOwner && !isAdmin) {
      await message.delete().catch(() => {});
      const warnMsg = await message.channel.send({
        content: `⚠️ <@${message.author.id}>, saluran ini hanya diperuntukkan untuk notifikasi saham, laporan harian, dan event bursa saham!`
      }).catch(() => null);

      if (warnMsg) {
        setTimeout(() => {
          warnMsg.delete().catch(() => {});
        }, 5000);
      }
      return;
    }
  }

  // Intersepsi & perbaiki link video (TikTok, Twitter/X, Instagram) via Webhook Mirroring
  const processed = await handleLinkMirroring(message, client);
  if (processed) return;

  // Proses perolehan koin pasif dari aktivitas chat & kontribusi skor keaktifan bursa
  await handleEconomyChat(message);

  if (!message.content.startsWith('.')) return;

  // Decorator untuk memitigasi error 'Unknown Message' / 'Invalid Form Body' jika pesan teks dihapus sebelum bot sempat membalas
  const originalReply = message.reply.bind(message);
  message.reply = async (options) => {
    try {
      return await originalReply(options);
    } catch (err) {
      // Tangkap semua variasi error referensi pesan yang tidak valid:
      // - err.code 10008: Unknown Message (Discord REST)
      // - err.code 50035: Invalid Form Body (Discord REST) dengan message_reference
      // - err.message mengandung kata kunci referensi
      const isRefError = (
        err.code === 10008 ||
        err.code === 50035 ||
        err.message?.includes('Unknown Message') ||
        err.message?.includes('message_reference') ||
        err.message?.includes('Invalid Form Body') ||
        JSON.stringify(err.rawError || {}).includes('message_reference')
      );
      if (isRefError) {
        const mention = `<@${message.author.id}> `;
        try {
          if (typeof options === 'string') {
            return await message.channel.send({ content: mention + options });
          } else {
            const payload = { ...options };
            payload.content = mention + (payload.content || '').trim();
            // Hapus message_reference agar tidak gagal lagi
            delete payload.reply;
            delete payload.messageReference;
            return await message.channel.send(payload);
          }
        } catch (sendErr) {
          console.error('❌ Gagal fallback channel.send:', sendErr.message);
        }
        return null;
      }
      throw err;
    }
  };

  // Proteksi Saluran: Blokir & bersihkan seluruh perintah teks agar channel tetap rapi
  const BLOCKED_CMD_CHANNELS = [
    '1510121069783023646', // #🛍️┃shop (Portal Dashboard)
    '1422642326798598348',
    '1472428770710261952',
    '1422656689710305381',
    '1509480324373942272' // #📉┃bursa-saham (Notifikasi & Laporan Saham)
  ];
  if (BLOCKED_CMD_CHANNELS.includes(message.channelId)) {
    const warnMsg = await message.channel.send({
      content: `⚠️ <@${message.author.id}>, silakan ketik perintah bot di channel obrolan biasa atau <#1508417228624887928>! Saluran ini tidak mendukung perintah bot.`
    }).catch(() => null);
    if (warnMsg) {
      setTimeout(() => {
        warnMsg.delete().catch(() => { });
      }, 5000);
    }
    return;
  }

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
    const isGuildOwner = message.guild && message.author.id === message.guild.ownerId;
    const isAdmin = message.member && message.member.permissions.has('Administrator');
    if (!isOwner && !isAdmin && !isGuildOwner) {
      return message.reply('❌ **Akses Ditolak!** Hanya Administrator yang dapat melihat daftar perintah admin.');
    }

    const embed = new EmbedBuilder()
      .setColor(0xFF3366)
      .setTitle('🛡️ MENU KONTROL & PERINTAH ADMINISTRATOR — SENTINEL')
      .setThumbnail(client.user.displayAvatarURL())
      .setDescription(`Halo **${message.author.username}**! Berikut adalah daftar seluruh perintah khusus Owner & Administrator server untuk mengelola game, ekonomi, bursa saham, toko, serta sistem bypass di server ini:`)
      .addFields(
        {
          name: '👑 PANEL KONTROL VISUAL INTERAKTIF [REKOMENDASI!]',
          value: [
            `👉 **\`.admin-panel\`** / **\`.panel-admin\`** - Membuka **Dashboard Sentinel Terpadu** (Portal Hub utama).`,
            `👉 **\`.admin-pet\`** / **\`.panel-pet\`** - Membuka langsung **Panel Pet Kandang & Perawatan** (HP, XP, level, egg hatch, reset).`,
            `👉 **\`.admin-bank\`** / **\`.panel-bank\`** - Membuka langsung **Panel Perbankan & Keuangan** (suntik/tarik koin, reset eco, eco-giveall).`,
            `👉 **\`.admin-rob\`** / **\`.panel-rob\`** - Membuka langsung **Panel Hukum & Lapas Virtual** (bebas lapas target/massal, reset CD robbery).`,
            `👉 **\`.admin-saham\`** / **\`.panel-saham\`** - Membuka langsung **Panel Bursa Saham & Event Pasar** (drop price, remove, trigger events).`,
            `👉 **\`.abyus\`** / **\`.abyus-panel\`** - Membuka langsung **Panel Bypass & Event Abuse** (mode gacha, multiplier koin).`,
            `👉 **\`.admin-shop\`** / **\`.panel-shop\`** - Membuka langsung **Panel Toko Role & Game Truth or Dare**.`
          ].join('\n')
        },
        {
          name: '🎲 KONTROL GAME TRUTH OR DARE (ToD)',
          value: [
            `👉 **\`.tod announce [#channel]\`** - Menyiarkan template pengumuman peluncuran game ToD berbahasa Indonesia yang cantik.`,
            `👉 **\`.tod force-end\`** atau **\`.tod stop\`** - Menghentikan paksa sesi aktif game ToD di Voice Channel secara instan.`,
            `👉 **\`.tod add <truth/dare> <chill/deep/spicy> <teks>\`** - Menambahkan pertanyaan kustom baru ke database ToD.`
          ].join('\n')
        },
        {
          name: '💰 PENGELOLAAN SALDO EKONOMI',
          value: [
            `👉 **\`.eco-give @user <jumlah | "random" [min] [max]>\`** - Memberikan koin (jumlah tetap atau acak) ke dompet user.`,
            `👉 **\`.eco-giveall <jumlah | "random" [min] [max]>\`** - Memberikan koin (jumlah tetap atau acak) kepada seluruh member server.`,
            `👉 **\`.eco-take @user <jumlah>\`** - Menarik/memotong saldo koin dari dompet user.`,
            `👉 **\`.eco-reset @user\`** - Mereset total saldo dompet, portofolio bursa saham, dan riwayat transaksi user kembali ke 0.`,
            `👉 **\`.eco-resetall\`** - **[BAHAYA]** Mereset total seluruh database perekonomian server (dompet semua user, bursa, dll).`,
            `👉 **\`.anoncemen\`** atau **\`.announcement\`** - Menyiarkan embed pengumuman pembaruan sistem ekonomi ke channel target disertai mention @everyone.`
          ].join('\n')
        },
        {
          name: '📈 SUNTIKAN & RESTURASI BURSA SAHAM',
          value: [
            `👉 **\`.market-add #channel <ticker>\`** - Mendaftarkan text channel baru sebagai instrumen saham di bursa (contoh: \`.market-add #lounge $LOUNGE\`).`,
            `👉 **\`.market-remove <ticker>\`** - Menghapus instrumen saham channel dari bursa dan membersihkan portofolio terkait.`,
            `👉 **\`.market-reinit\`** - Menghapus seluruh instrumen bursa lama dan mengembalikannya ke setelan saham default server.`,
            `👉 **\`.market-drop <ticker> <persen>\`** - Menurunkan harga saham secara paksa berdasarkan persentase (contoh: \`.market-drop $LOUNGE 15\`).`,
            `👉 **\`.dividends-trigger\`** - Memicu pembagian dividen mingguan bursa secara dinamis berbasis keaktifan chat warga.`,
            `👉 **\`.event-trigger [crash/bull/double]\`** - Memicu event crash pasar, bull run bursa, atau double earning hour secara instan.`
          ].join('\n')
        },
        {
          name: '🎭 PENGELOLAAN TOKO ROLE & PRESTISE',
          value: [
            `👉 **\`.autoshoprole\`** atau **\`.shop-auto\`** - **[PREMIUM]** Membuat otomatis seluruh 5 tingkatan role khusus (Common s/d Mythic) dengan warna & izin rarity, serta mendaftarkannya langsung ke database toko role.`,
            `👉 **\`.shop-add @role <harga> [tier] [deskripsi]\`** - Menambahkan manual role server Anda ke dalam daftar toko role dengan klasifikasi kustom.`,
            `👉 **\`.shop-remove <@role atau ID>\`** - Menghapus item role terdaftar dari penjualan toko.`,
            `👉 **\`.shop-setstock <@role atau ID> <stok>\`** - Mengubah jumlah ketersediaan slot role terdaftar (-1 untuk tanpa batas/unlimited).`
          ].join('\n')
        },
        {
          name: '⚡ KONTROL BYPASS ADMIN (EBYUS / ABYUS) [NEW!]',
          value: [
            `👉 **\`.ebyus\`** / **\`.abyus\`** - Membuka dashboard kontrol panel visual untuk sabotase gacha, multiplier koin chat, dll.`,
            `👉 **\`.ebyus-gacha <mode> [durasi_menit]\`** - Mengatur manual mode gacha (\`normal\`, \`easy\`, \`super_easy\`, \`abuse\`) beserta durasi auto-reset.`,
            `👉 **\`.ebyus-coin <multiplier> [durasi_menit]\`** - Mengatur manual pengali koin chat (\`off\`, \`3\`, \`4\`, \`5\`, \`6\`, \`7\`, \`8\`) beserta durasi auto-reset.`,
            `👉 **\`.ebyus status\`** - Melihat status bypass ekonomi aktif (mode gacha, multiplier koin chat, sisa durasi event, dll).`,
            `👉 **\`.stop-abyus\`** / **\`.stop-ebyus\`** - **[DARURAT]** Menghentikan paksa seluruh event abuse ekonomi server seketika!`
          ].join('\n')
        },
        {
          name: '🚨 KONTROL LAPAS & HEIST ADMINISTRASI',
          value: [
            `👉 **\`.heist-admin free @user\`** - Membebaskan paksa tahanan dari Penjara Virtual secara instan.`,
            `👉 **\`.heist-admin reset\`** - Mereset cooldown global Bank Heist server secara instan.`
          ].join('\n')
        },
        {
          name: '🐾 KONTROL KANDANG & PERAWATAN PET',
          value: [
            `👉 **\`.pet-admin reset @user\`** - Menghapus data pet kotor/mati milik user kembali ke kondisi awal (adopsi ulang).`,
            `👉 **\`.pet-admin heal @user\`** - Menyembuhkan & memulihkan stats HP/Kenyangan/Hidrasi pet user menjadi 100% instan.`,
            `👉 **\`.pet-admin give-xp @user <jumlah>\`** - Menyuntikkan poin XP tambahan ke pet milik user.`,
            `👉 **\`.pet-admin hatch @user\`** - Mempercepat penetasan telur pet milik user seketika.`
          ].join('\n')
        }
      )
      .setFooter({ text: 'Sentinel bot • Administrator Panel' })
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
      speakText(connection, "Halo semuanya! Saya sudah bergabung.", guildId, 'id').catch(() => { });

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
      await replyEmbed(0xFF3366,
        `❌ **Gagal bergabung ke Voice Channel!**\n\n` +
        `**Kemungkinan penyebab:**\n` +
        `1️⃣ **Port UDP Terblokir** di VPS Rumahweb (Harap minta support VPS untuk membuka port outbound UDP 50000-65535).\n` +
        `2️⃣ **Izin Kurang** (Pastikan role bot memiliki izin \`Connect\` dan \`Speak\` di VC tersebut).\n` +
        `3️⃣ **Timeout Jaringan** (Jaringan VPS bermasalah, silakan coba lagi atau jalankan restart bot di VPS).`
      );
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
  // ── .portal / .portalhub / .hub ──
  else if (commandName === 'portal' || commandName === 'portalhub' || commandName === 'hub') {
    await sendPortalHubDirect(message, false, message.author, guild, client);
  }
});

// ═══════════════════════════════════════════════════
// VOICE STATE UPDATE HANDLER (Proteksi Saluran)
// ═══════════════════════════════════════════════════
client.on('voiceStateUpdate', async (oldState, newState) => {
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

  // Tutup database SQLite secara bersih agar file WAL di-flush & di-checkpoint
  try {
    const { db } = require('./stockmarket/database');
    if (db) {
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.close();
      console.log('✅ Database SQLite berhasil ditutup secara bersih (WAL ter-checkpoint & ter-truncate).');
    }
  } catch (err) {
    console.error('❌ Gagal menutup database secara bersih:', err.message);
  }

  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
