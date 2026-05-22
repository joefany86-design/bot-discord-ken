const { Client, GatewayIntentBits, InteractionType } = require('discord.js');
const { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus, 
  VoiceConnectionStatus,
  getVoiceConnection,
  entersState
} = require('@discordjs/voice');
const googleTTS = require('google-tts-api');
require('dotenv').config();

// Inisialisasi client Discord dengan intents yang tepat
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Dibutuhkan untuk membaca pesan teks seperti !join
  ]
});

// Menyimpan AudioPlayer untuk setiap Guild secara dinamis
const players = new Map();

client.once('ready', () => {
  console.log(`Bot berhasil online sebagai ${client.user.tag}!`);
  client.user.setActivity('suara Anda | !join & /speak', { type: 2 }); // Listening to
});

// Penanganan Slash Commands
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, guildId, member, guild } = interaction;

  // Pastikan perintah dijalankan di dalam server (guild)
  if (!guildId) {
    return interaction.reply({ content: 'Perintah ini hanya dapat digunakan di dalam server Discord!', ephemeral: true });
  }

  // 1. COMMAND: SPEAK
  if (commandName === 'speak') {
    const text = interaction.options.getString('text');
    let connection = getVoiceConnection(guildId);

    // Jika bot belum berada di voice channel, coba buat join otomatis ke voice channel user
    if (!connection) {
      const voiceChannel = member.voice.channel;
      if (!voiceChannel) {
        return interaction.reply({ content: 'Saya belum berada di Voice Channel. Silakan ketik `!join` atau bergabung ke voice channel terlebih dahulu!', ephemeral: true });
      }

      try {
        connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: guildId,
          adapterCreator: guild.voiceAdapterCreator,
          selfDeaf: false,
        });
        await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
      } catch (error) {
        console.error('Kesalahan auto-join saat /speak:', error);
        return interaction.reply({ content: 'Gagal bergabung ke Voice Channel secara otomatis.', ephemeral: true });
      }
    }

    try {
      await interaction.deferReply();

      // Dapatkan URL audio TTS (bahasa Indonesia sebagai default)
      const ttsUrl = googleTTS.getAudioUrl(text, {
        lang: 'id',
        slow: false,
        host: 'https://translate.google.com',
        timeout: 10000,
      });

      // Dapatkan atau buat player baru
      let player = players.get(guildId);
      if (!player) {
        player = createAudioPlayer();
        player.on('error', error => {
          console.error(`Audio Player Error pada server ${guild.name}:`, error.message);
        });
        players.set(guildId, player);
      }
      
      connection.subscribe(player);

      // Buat resource audio dan putar
      const resource = createAudioResource(ttsUrl);
      player.play(resource);

      await interaction.editReply(`Mengucapkan: "${text}" 🗣️`);
    } catch (error) {
      console.error('Kesalahan saat memproses ucapan TTS:', error);
      await interaction.editReply('Gagal memproses teks ke ucapan suara. Silakan coba lagi beberapa saat lagi.');
    }
  }

  // 3. COMMAND: LEAVE
  else if (commandName === 'leave') {
    const connection = getVoiceConnection(guildId);

    if (!connection) {
      return interaction.reply({ content: 'Saya tidak sedang berada di Voice Channel mana pun di server ini!', ephemeral: true });
    }

    try {
      // Hentikan pemutaran audio jika ada
      const player = players.get(guildId);
      if (player) {
        player.stop();
        players.delete(guildId);
      }

      // Hancurkan koneksi suara
      connection.destroy();
      await interaction.reply('Berhasil keluar dari Voice Channel. Sampai jumpa! 👋');
    } catch (error) {
      console.error('Kesalahan saat keluar dari voice channel:', error);
      await interaction.reply({ content: 'Terjadi kesalahan saat mencoba keluar dari voice channel.', ephemeral: true });
    }
  }
});

// Penanganan Perintah Pesan Teks (Prefix !)
client.on('messageCreate', async message => {
  // Abaikan pesan dari bot atau jika tidak dimulai dengan !
  if (message.author.bot || !message.content.startsWith('!')) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  if (commandName === 'join') {
    const { guildId, member, guild } = message;

    if (!guildId) {
      return message.reply('Perintah ini hanya dapat digunakan di dalam server Discord!');
    }

    const voiceChannel = member?.voice?.channel;

    if (!voiceChannel) {
      return message.reply('Anda harus bergabung ke Voice Channel terlebih dahulu sebelum memanggil saya!');
    }

    try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
      });

      // Tunggu hingga koneksi siap
      await entersState(connection, VoiceConnectionStatus.Ready, 20_000);

      // Inisialisasi audio player untuk guild ini jika belum ada
      if (!players.has(guildId)) {
        const player = createAudioPlayer();
        
        player.on('error', error => {
          console.error(`Audio Player Error pada server ${guild.name}:`, error.message);
        });

        players.set(guildId, player);
        connection.subscribe(player);
      } else {
        const player = players.get(guildId);
        connection.subscribe(player);
      }

      await message.reply(`Berhasil bergabung ke Voice Channel **${voiceChannel.name}**! 👋`);
    } catch (error) {
      console.error('Kesalahan saat mencoba bergabung ke voice channel:', error);
      await message.reply('Gagal bergabung ke voice channel. Pastikan saya memiliki izin yang cukup!');
    }
  }
});

// Penanganan pemutusan koneksi yang tidak terduga oleh pihak luar (misal ditendang dari channel)
client.on('voiceStateUpdate', (oldState, newState) => {
  // Jika bot sendiri yang keluar atau dipindahkan
  if (oldState.member.id === client.user?.id && !newState.channelId) {
    const guildId = oldState.guild.id;
    const player = players.get(guildId);
    if (player) {
      player.stop();
      players.delete(guildId);
    }
    const connection = getVoiceConnection(guildId);
    if (connection) {
      try {
        connection.destroy();
      } catch (err) {
        // Abaikan jika sudah hancur
      }
    }
    console.log(`Bot terputus dari voice channel di server ${oldState.guild.name}.`);
  }
});

// Login bot ke Discord
client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error('Gagal login ke Discord. Pastikan DISCORD_TOKEN di berkas .env Anda valid!');
  console.error(error);
});
