const { REST, Routes, SlashCommandBuilder, ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');
require('dotenv').config();

// Memastikan variabel lingkungan terisi sebelum mendaftarkan commands
if (!process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN.startsWith('MASUKKAN')) {
  console.warn('Peringatan: DISCORD_TOKEN di file .env belum dikonfigurasi dengan benar.');
}
if (!process.env.CLIENT_ID || process.env.CLIENT_ID.startsWith('MASUKKAN')) {
  console.warn('Peringatan: CLIENT_ID di file .env belum dikonfigurasi dengan benar.');
}

const commands = [
  new SlashCommandBuilder()
    .setName('gacha')
    .setDescription('Lakukan gacha acak untuk mendapatkan Role Senior eksklusif!'),

  new SlashCommandBuilder()
    .setName('join')
    .setDescription('Menyuruh bot untuk bergabung ke Voice Channel dan memutar musik lokal secara otomatis'),
  
  new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Menyuruh bot untuk keluar dari Voice Channel'),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Menampilkan daftar perintah bot yang tersedia'),

  new SlashCommandBuilder()
    .setName('portal')
    .setDescription('Membuka Pusat Kontrol & Portal Hub Sentinel secara instan'),

  new SlashCommandBuilder()
    .setName('arrest')
    .setDescription('Menangkap buronan (wanted) yang memiliki bounty koin')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('Warga buronan yang ingin Anda tangkap')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('setup-onboarding')
    .setDescription('Mengirim pesan panel onboarding kustom di channel saat ini (Hanya Admin)'),

  new SlashCommandBuilder()
    .setName('setup-garden-panel')
    .setDescription('Mengirim panel filter notifikasi kebun di channel saat ini (Hanya Admin)'),

  new SlashCommandBuilder()
    .setName('notif')
    .setDescription('Mengaktifkan atau menonaktifkan peran notifikasi tertentu (Searchable)')
    .addStringOption(option =>
      option.setName('peran')
        .setDescription('Ketik nama peran notifikasi yang ingin diambil/dilepas')
        .setAutocomplete(true)
        .setRequired(true)
    ),


  new SlashCommandBuilder()
    .setName('stiker')
    .setDescription('Kirim stiker lucu kawaii ke chat! 🎨')
    .addStringOption(option =>
      option.setName('nama')
        .setDescription('Pilih stiker yang ingin dikirim')
        .setRequired(true)
        .addChoices(
          { name: '🎲 Random (Acak)', value: 'random' },
          { name: '👋 Halo!', value: 'halo' },
          { name: '😴 Ngantuk...', value: 'ngantuk' },
          { name: '🔥 Semangat!', value: 'semangat' },
          { name: '😢 Sedih...', value: 'sedih' },
          { name: '😤 Kesel!', value: 'kesel' },
          { name: '🍜 Makan!', value: 'makan' },
          { name: '💕 Sayang~', value: 'sayang' },
          { name: '😱 OMG!', value: 'omg' },
          { name: '🎮 GG!', value: 'gg' },
        )
    ),
  new SlashCommandBuilder()
    .setName('worldcup')
    .setDescription('Menampilkan jadwal, skor, dan hasil pertandingan FIFA World Cup 2026 terbaru'),

  new SlashCommandBuilder()
    .setName('pialadunia')
    .setDescription('Alias dari /worldcup — Jadwal & skor FIFA World Cup 2026'),

  new SlashCommandBuilder()
    .setName('setworldcup')
    .setDescription('Mengatur channel khusus notifikasi Piala Dunia 2026 (Hanya Admin)')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel yang akan digunakan untuk notifikasi piala dunia')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('tebakskor')
    .setDescription('Pasang taruhan tebak skor tepat pertandingan Piala Dunia 2026')
    .addIntegerOption(option =>
      option.setName('match_id')
        .setDescription('ID pertandingan (lihat dari /worldcup)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('skor')
        .setDescription('Tebakan skor format home-away (contoh: 2-1)')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('taruhan')
        .setDescription('Jumlah koin yang ingin ditaruhkan')
        .setRequired(true)
        .setMinValue(1)
    ),

  new SlashCommandBuilder()
    .setName('tebakmenang')
    .setDescription('Pasang taruhan tebak pemenang pertandingan Piala Dunia 2026 (1X2)')
    .addIntegerOption(option =>
      option.setName('match_id')
        .setDescription('ID pertandingan (lihat dari /worldcup)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('prediksi')
        .setDescription('Pilih pemenang (home/away/draw atau nama negara)')
        .setRequired(true)
        .addChoices(
          { name: '🏠 Tim Kandang (Home)', value: 'home' },
          { name: '✈️ Tim Tamu (Away)', value: 'away' },
          { name: '🤝 Seri / Draw', value: 'draw' },
        )
    )
    .addIntegerOption(option =>
      option.setName('taruhan')
        .setDescription('Jumlah koin yang ingin ditaruhkan')
        .setRequired(true)
        .setMinValue(1)
    ),

  new SlashCommandBuilder()
    .setName('listtebak')
    .setDescription('Lihat daftar taruhan yang terpasang untuk suatu pertandingan')
    .addIntegerOption(option =>
      option.setName('match_id')
        .setDescription('ID pertandingan (lihat dari /worldcup)')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('speak')
    .setDescription('Menyuruh bot membacakan teks di Voice Channel')
    .addStringOption(option =>
      option.setName('teks')
        .setDescription('Teks yang akan dibacakan oleh bot')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Menampilkan status bot dan koneksi Voice Channel saat ini'),

  // ─── TIKTOK COMMANDS ───
  new SlashCommandBuilder()
    .setName('settiktok')
    .setDescription('Daftarkan username TikTok kamu agar bot memantau live & video barumu')
    .addStringOption(option =>
      option.setName('username')
        .setDescription('Username TikTok kamu (tanpa @)')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('mytiktok')
    .setDescription('Lihat akun TikTok yang sudah kamu daftarkan'),

  new SlashCommandBuilder()
    .setName('deltiktok')
    .setDescription('Hapus akun TikTok kamu dari pemantauan bot'),

  new SlashCommandBuilder()
    .setName('listtiktok')
    .setDescription('Lihat semua akun TikTok yang terdaftar di server ini'),

  new SlashCommandBuilder()
    .setName('settiktok-channel')
    .setDescription('Atur channel khusus notifikasi TikTok (Hanya Admin)')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel tujuan notifikasi TikTok Live & Video Baru')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('momen')
    .setDescription('Kelola dan laporkan momen lucu/seru untuk konten TikTok')
    .addSubcommand(sub =>
      sub.setName('lapor')
        .setDescription('Laporkan momen seru/lucu ke Owner untuk dijadikan konten TikTok')
        .addStringOption(opt =>
          opt.setName('pesan')
            .setDescription('Link pesan atau ID pesan yang ingin dilaporkan')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('catatan')
            .setDescription('Catatan tambahan (kenapa momen ini seru/lucu)')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('Lihat daftar laporan momen TikTok (Hanya Admin/Owner)')
        .addStringOption(opt =>
          opt.setName('status')
            .setDescription('Filter status momen')
            .setRequired(false)
            .addChoices(
              { name: 'Pending (Belum Diolah)', value: 'PENDING' },
              { name: 'Completed (Sudah Jadi Konten)', value: 'COMPLETED' },
              { name: 'Rejected (Ditolak)', value: 'REJECTED' }
            )
        )
    ),

  new ContextMenuCommandBuilder()
    .setName('Simpan Momen TikTok')
    .setType(ApplicationCommandType.Message),

].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    const guildId = '1410239829874053296';
    console.log(`Sedang mendaftarkan ${commands.length} application (/) commands ke Guild ${guildId}...`);

    // Daftarkan secara guild-level agar instan
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
      { body: commands },
    );

    console.log(`Berhasil mendaftarkan ${commands.length} application (/) commands secara instan ke Guild!`);
  } catch (error) {
    console.error('Terjadi kesalahan saat mendaftarkan commands:', error);
    console.log('\nTip: Pastikan DISCORD_TOKEN dan CLIENT_ID di file .env Anda sudah benar!');
  }
})();
