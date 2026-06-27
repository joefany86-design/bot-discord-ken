const { EmbedBuilder } = require('discord.js');
const { db } = require('./database');

// Data pertandingan Piala Dunia 2026 (WIB Timezone)
// Beberapa skor telah disimulasikan / disesuaikan dengan hasil pertandingan terkini
const matches = [
  // Grup H - 26 Juni 2026
  {
    id: 1,
    stage: 'Grup H',
    home: 'Tanjung Verde 🇨🇻',
    away: 'Arab Saudi 🇸🇦',
    wibDate: 'Sabtu, 27 Juni 2026',
    wibTime: '02:00 WIB',
    etTime: '26 Juni, 15:00 ET',
    score: '0 - 0',
    status: 'Selesai'
  },
  // Grup L - 27 Juni 2026 ET / 28 Juni WIB
  {
    id: 2,
    stage: 'Grup L',
    home: 'Panama 🇵🇦',
    away: 'Inggris 🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    wibDate: 'Minggu, 28 Juni 2026',
    wibTime: '04:00 WIB',
    etTime: '27 Juni, 17:00 ET',
    score: '1 - 3',
    status: 'Selesai'
  },
  {
    id: 3,
    stage: 'Grup L',
    home: 'Kroasia 🇭🇷',
    away: 'Ghana 🇬🇭',
    wibDate: 'Minggu, 28 Juni 2026',
    wibTime: '04:00 WIB',
    etTime: '27 Juni, 17:00 ET',
    score: '2 - 1',
    status: 'Selesai'
  },
  // Grup K - 27 Juni 2026 ET / 28 Juni WIB
  {
    id: 4,
    stage: 'Grup K',
    home: 'Kolombia 🇨🇴',
    away: 'Portugal 🇵🇹',
    wibDate: 'Minggu, 28 Juni 2026',
    wibTime: '06:30 WIB',
    etTime: '27 Juni, 19:30 ET',
    score: '2 - 2',
    status: 'Selesai'
  },
  {
    id: 5,
    stage: 'Grup K',
    home: 'RD Kongo 🇨🇩',
    away: 'Uzbekistan 🇺🇿',
    wibDate: 'Minggu, 28 Juni 2026',
    wibTime: '06:30 WIB',
    etTime: '27 Juni, 19:30 ET',
    score: '0 - 1',
    status: 'Selesai'
  },
  // Grup J - 27 Juni 2026 ET / 28 Juni WIB
  {
    id: 6,
    stage: 'Grup J',
    home: 'Yordania 🇯🇴',
    away: 'Argentina 🇦🇷',
    wibDate: 'Minggu, 28 Juni 2026',
    wibTime: '09:00 WIB',
    etTime: '27 Juni, 22:00 ET',
    score: '0 - 4',
    status: 'Selesai'
  },
  {
    id: 7,
    stage: 'Grup J',
    home: 'Aljazair 🇩🇿',
    away: 'Austria 🇦🇹',
    wibDate: 'Minggu, 28 Juni 2026',
    wibTime: '09:00 WIB',
    etTime: '27 Juni, 22:00 ET',
    score: '1 - 2',
    status: 'Selesai'
  },
  // Babak 32 Besar (Dimulai 28 Juni ET / 29 Juni WIB)
  {
    id: 8,
    stage: 'Babak 32 Besar',
    home: 'Runner-up Grup A',
    away: 'Runner-up Grup B',
    wibDate: 'Senin, 29 Juni 2026',
    wibTime: '04:00 WIB',
    etTime: '28 Juni, 17:00 ET',
    score: '- - -',
    status: 'Mendatang'
  },
  {
    id: 9,
    stage: 'Babak 32 Besar',
    home: 'Jerman 🇩🇪',
    away: 'Paraguay 🇵🇾',
    wibDate: 'Selasa, 30 Juni 2026',
    wibTime: '05:00 WIB',
    etTime: '29 Juni, 18:00 ET',
    score: '- - -',
    status: 'Mendatang'
  },
  {
    id: 10,
    stage: 'Babak 32 Besar',
    home: 'Belanda 🇳🇱',
    away: 'Maroko 🇲🇦',
    wibDate: 'Rabu, 1 Juli 2026',
    wibTime: '07:00 WIB',
    etTime: '30 Juni, 20:00 ET',
    score: '- - -',
    status: 'Mendatang'
  }
];

/**
 * Menyimpan ID Channel Bola khusus ke Database
 */
function setWorldCupChannel(guildId, channelId) {
  let settings = db.prepare('SELECT * FROM ebyus_settings WHERE guild_id = ?').get(guildId);
  if (!settings) {
    db.prepare('INSERT INTO ebyus_settings (guild_id, worldcup_channel_id) VALUES (?, ?)').run(guildId, channelId);
  } else {
    db.prepare('UPDATE ebyus_settings SET worldcup_channel_id = ? WHERE guild_id = ?').run(channelId, guildId);
  }
  return true;
}

/**
 * Mengambil ID Channel Bola khusus dari Database
 */
function getWorldCupChannel(guildId) {
  const settings = db.prepare('SELECT worldcup_channel_id FROM ebyus_settings WHERE guild_id = ?').get(guildId);
  return settings ? settings.worldcup_channel_id : null;
}

/**
 * Membuat Embed Jadwal & Skor Piala Dunia 2026
 */
function generateWorldCupEmbed() {
  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('🏆 JADWAL & SKOR FIFA WORLD CUP 2026')
    .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/4/4b/FIFA_World_Cup_2026_logo.svg')
    .setDescription('Berikut adalah jadwal, jam tanding (WIB), dan skor terbaru Piala Dunia FIFA 2026:')
    .setTimestamp();

  // Kelompokkan pertandingan berdasarkan Tanggal WIB
  const groupedMatches = {};
  matches.forEach(m => {
    if (!groupedMatches[m.wibDate]) {
      groupedMatches[m.wibDate] = [];
    }
    groupedMatches[m.wibDate].push(m);
  });

  for (const date in groupedMatches) {
    const matchLines = groupedMatches[date].map(m => {
      const statusIcon = m.status === 'Selesai' ? '✅' : '⏰';
      const scoreStr = m.status === 'Selesai' ? `**${m.score}**` : `vs`;
      return `${statusIcon} \`[${m.stage}]\` **${m.home}** ${scoreStr} **${m.away}**\n   📅 *${m.wibTime}* | Status: _${m.status}_`;
    }).join('\n\n');

    embed.addFields({ name: `📆 ${date}`, value: matchLines });
  }

  return embed;
}

module.exports = {
  matches,
  setWorldCupChannel,
  getWorldCupChannel,
  generateWorldCupEmbed
};

/**
 * Mencari atau membuat channel piala dunia otomatis pada startup
 */
async function autoCreateWorldCupChannel(guild) {
  try {
    // 1. Cek apakah sudah ada channel di database
    let channelId = getWorldCupChannel(guild.id);
    let channel = channelId ? guild.channels.cache.get(channelId) : null;
    
    // 2. Jika tidak ada di database, cari channel dengan nama '⚽┃piala-dunia-2026' atau 'piala-dunia-2026'
    if (!channel) {
      channel = guild.channels.cache.find(c => c.name === '⚽┃piala-dunia-2026' || c.name === 'piala-dunia-2026');
      if (channel) {
        setWorldCupChannel(guild.id, channel.id);
        console.log(`📌 Menemukan channel piala dunia yang sudah ada di guild ${guild.name}: #${channel.name} (${channel.id})`);
      }
    }

    // 3. Jika tetap tidak ada, buat baru
    if (!channel) {
      channel = await guild.channels.create({
        name: '⚽┃piala-dunia-2026',
        type: 0, // GuildText
        topic: 'Jadwal, Live Score & Hasil Pertandingan FIFA World Cup 2026 Ter-update Realtime',
        reason: 'Auto-created World Cup channel for bot'
      });
      setWorldCupChannel(guild.id, channel.id);
      console.log(`🆕 Berhasil membuat channel baru: #${channel.name} (${channel.id}) di guild ${guild.name}`);

      // Kirim pesan selamat datang dan jadwal awal
      const embed = generateWorldCupEmbed();
      await channel.send({
        content: '👋 **Selamat datang di Saluran Resmi Piala Dunia 2026!** Di sini Anda dapat memantau jadwal pertandingan dan skor terbaru secara otomatis.',
        embeds: [embed]
      });
    }
    return channel;
  } catch (error) {
    console.error(`❌ Gagal membuat channel piala dunia di guild ${guild.name}:`, error.message);
    return null;
  }
}

module.exports.autoCreateWorldCupChannel = autoCreateWorldCupChannel;

