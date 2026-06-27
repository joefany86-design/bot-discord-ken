const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
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
    score: '- - -',
    status: 'Mendatang'
  },
  {
    id: 3,
    stage: 'Grup L',
    home: 'Kroasia 🇭🇷',
    away: 'Ghana 🇬🇭',
    wibDate: 'Minggu, 28 Juni 2026',
    wibTime: '04:00 WIB',
    etTime: '27 Juni, 17:00 ET',
    score: '- - -',
    status: 'Mendatang'
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
    score: '- - -',
    status: 'Mendatang'
  },
  {
    id: 5,
    stage: 'Grup K',
    home: 'RD Kongo 🇨🇩',
    away: 'Uzbekistan 🇺🇿',
    wibDate: 'Minggu, 28 Juni 2026',
    wibTime: '06:30 WIB',
    etTime: '27 Juni, 19:30 ET',
    score: '- - -',
    status: 'Mendatang'
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
    score: '- - -',
    status: 'Mendatang'
  },
  {
    id: 7,
    stage: 'Grup J',
    home: 'Aljazair 🇩🇿',
    away: 'Austria 🇦🇹',
    wibDate: 'Minggu, 28 Juni 2026',
    wibTime: '09:00 WIB',
    etTime: '27 Juni, 22:00 ET',
    score: '- - -',
    status: 'Mendatang'
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
 * Mengonversi String Tanggal & Waktu WIB ke Timestamp UTC
 */
function getMatchTimestamp(wibDateStr, wibTimeStr) {
  const months = {
    'Januari': 0, 'Februari': 1, 'Maret': 2, 'April': 3, 'Mei': 4, 'Juni': 5,
    'Juli': 6, 'Agustus': 7, 'September': 8, 'Oktober': 9, 'November': 10, 'Desember': 11
  };
  
  const dateParts = wibDateStr.split(' '); // ['Minggu,', '28', 'Juni', '2026']
  const day = parseInt(dateParts[1]);
  const monthName = dateParts[2];
  const year = parseInt(dateParts[3]);
  const month = months[monthName] !== undefined ? months[monthName] : 5;
  
  const timeParts = wibTimeStr.replace(' WIB', '').split(':'); // ['04', '00']
  const hours = parseInt(timeParts[0]);
  const minutes = parseInt(timeParts[1]);
  
  // Buat objek tanggal WIB (UTC+7)
  const utcDate = Date.UTC(year, month, day, hours - 7, minutes, 0);
  return utcDate;
}

/**
 * Mengupdate status pertandingan dan men-generate skor acak realistis yang persisten di database
 */
function updateMatchScores(client) {
  const now = Date.now();
  
  // Pastikan tabel di database ada
  db.exec(`
    CREATE TABLE IF NOT EXISTS worldcup_match_scores (
      match_id INTEGER PRIMARY KEY,
      score TEXT,
      status TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS worldcup_bets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT,
      user_id TEXT,
      match_id INTEGER,
      bet_type TEXT,
      home_score INTEGER,
      away_score INTEGER,
      predicted_outcome TEXT,
      bet_amount INTEGER,
      status TEXT DEFAULT 'pending',
      created_at INTEGER
    )
  `);

  matches.forEach(m => {
    if (m.id === 1) return; // Tanjung Verde vs Arab Saudi sudah selesai secara default
    
    const kickoff = getMatchTimestamp(m.wibDate, m.wibTime);
    const duration = 2 * 60 * 60 * 1000; // 2 jam durasi pertandingan
    
    // Cek status di database
    const saved = db.prepare('SELECT score, status FROM worldcup_match_scores WHERE match_id = ?').get(m.id);
    
    if (saved) {
      m.score = saved.score;
      m.status = saved.status;
    } else {
      if (now > kickoff + duration) {
        // Pertandingan selesai -> generate skor acak realistis
        let scoreStr = '';
        if (m.home.includes('Argentina') || m.away.includes('Argentina') || m.home.includes('Jerman') || m.away.includes('Jerman') || m.home.includes('Inggris') || m.away.includes('Inggris')) {
          // Tim kuat cenderung menang
          const strongScore = Math.floor(Math.random() * 3) + 2; // 2 - 4 gol
          const weakScore = Math.floor(Math.random() * 2); // 0 - 1 gol
          if (m.home.includes('Argentina') || m.home.includes('Jerman') || m.home.includes('Inggris')) {
            scoreStr = `${strongScore} - ${weakScore}`;
          } else {
            scoreStr = `${weakScore} - ${strongScore}`;
          }
        } else {
          // Tim seimbang
          scoreStr = `${Math.floor(Math.random() * 3)} - ${Math.floor(Math.random() * 3)}`;
        }
        
        db.prepare('INSERT OR REPLACE INTO worldcup_match_scores (match_id, score, status) VALUES (?, ?, ?)')
          .run(m.id, scoreStr, 'Selesai');
          
        m.score = scoreStr;
        m.status = 'Selesai';
        console.log(`⚽ [WorldCup] Pertandingan ID ${m.id} (${m.home} vs ${m.away}) selesai otomatis. Skor: ${scoreStr}`);
        
        // Selesaikan taruhan
        try {
          resolveMatchBets(client, m.id, scoreStr);
        } catch (e) {
          console.error(`❌ Gagal menyelesaikan taruhan untuk match ID ${m.id}:`, e.message);
        }
      } else if (now > kickoff) {
        // Sedang berlangsung
        m.score = '0 - 0';
        m.status = 'Live';
      }
    }
  });
}

/**
 * Menyelesaikan taruhan untuk match tertentu dan membagi pool hadiah
 */
function resolveMatchBets(client, matchId, actualScore) {
  const pendingBets = db.prepare("SELECT * FROM worldcup_bets WHERE match_id = ? AND status = 'pending'").all(matchId);
  if (pendingBets.length === 0) return;

  const match = matches.find(m => m.id === matchId);
  if (!match) return;

  const actualScoreParts = actualScore.split('-').map(s => parseInt(s.trim()));
  const actualHome = actualScoreParts[0];
  const actualAway = actualScoreParts[1];
  if (isNaN(actualHome) || isNaN(actualAway)) return;

  const actualOutcome = actualHome > actualAway ? 'home' : (actualHome < actualAway ? 'away' : 'draw');

  // Group by guild_id
  const betsByGuild = {};
  pendingBets.forEach(bet => {
    if (!betsByGuild[bet.guild_id]) {
      betsByGuild[bet.guild_id] = [];
    }
    betsByGuild[bet.guild_id].push(bet);
  });

  const economy = require('./economy');
  const config = require('./config');

  for (const guildId in betsByGuild) {
    const guildBets = betsByGuild[guildId];
    
    // Taruhan tebak skor
    const exactBets = guildBets.filter(b => b.bet_type === 'exact_score');
    // Taruhan pemenang/hasil
    const outcomeBets = guildBets.filter(b => b.bet_type === 'outcome');

    // 1. Proses Tebak Skor Tepat
    let exactWinners = [];
    let exactPool = 0;
    if (exactBets.length > 0) {
      exactPool = exactBets.reduce((sum, b) => sum + b.bet_amount, 0);
      exactWinners = exactBets.filter(b => b.home_score === actualHome && b.away_score === actualAway);

      if (exactWinners.length > 0) {
        const totalWinningBets = exactWinners.reduce((sum, w) => sum + w.bet_amount, 0);
        exactWinners.forEach(w => {
          const share = w.bet_amount / totalWinningBets;
          const payout = Math.floor(share * exactPool);
          economy.addBalance(w.user_id, guildId, payout, 'WORLDCUP_BET_WIN');
          db.prepare("UPDATE worldcup_bets SET status = 'won' WHERE id = ?").run(w.id);
        });
        exactBets.forEach(b => {
          if (!exactWinners.some(w => w.id === b.id)) {
            db.prepare("UPDATE worldcup_bets SET status = 'lost' WHERE id = ?").run(b.id);
          }
        });
      } else {
        // Uang hangus, berikan ke owner
        if (config.OWNER_ID) {
          economy.addBalance(config.OWNER_ID, guildId, exactPool, 'WORLDCUP_BET_FORFEIT');
        }
        exactBets.forEach(b => {
          db.prepare("UPDATE worldcup_bets SET status = 'forfeited' WHERE id = ?").run(b.id);
        });
      }
    }

    // 2. Proses Tebak Pemenang/Hasil
    let outcomeWinners = [];
    let outcomePool = 0;
    if (outcomeBets.length > 0) {
      outcomePool = outcomeBets.reduce((sum, b) => sum + b.bet_amount, 0);
      outcomeWinners = outcomeBets.filter(b => b.predicted_outcome === actualOutcome);

      if (outcomeWinners.length > 0) {
        const totalWinningBets = outcomeWinners.reduce((sum, w) => sum + w.bet_amount, 0);
        outcomeWinners.forEach(w => {
          const share = w.bet_amount / totalWinningBets;
          const payout = Math.floor(share * outcomePool);
          economy.addBalance(w.user_id, guildId, payout, 'WORLDCUP_BET_WIN');
          db.prepare("UPDATE worldcup_bets SET status = 'won' WHERE id = ?").run(w.id);
        });
        outcomeBets.forEach(b => {
          if (!outcomeWinners.some(w => w.id === b.id)) {
            db.prepare("UPDATE worldcup_bets SET status = 'lost' WHERE id = ?").run(b.id);
          }
        });
      } else {
        // Uang hangus, berikan ke owner
        if (config.OWNER_ID) {
          economy.addBalance(config.OWNER_ID, guildId, outcomePool, 'WORLDCUP_BET_FORFEIT');
        }
        outcomeBets.forEach(b => {
          db.prepare("UPDATE worldcup_bets SET status = 'forfeited' WHERE id = ?").run(b.id);
        });
      }
    }

    // 3. Kirim pengumuman ke channel Piala Dunia di guild bersangkutan
    if (client) {
      const guild = client.guilds.cache.get(guildId);
      const channelId = getWorldCupChannel(guildId);
      if (guild && channelId) {
        const channel = guild.channels.cache.get(channelId);
        if (channel) {
          const embed = new EmbedBuilder()
            .setColor(0xF59E0B)
            .setTitle('⚽ HASIL TARUHAN PIALA DUNIA 2026')
            .setDescription(`Pertandingan **${match.home}** vs **${match.away}** telah selesai!\n**Skor Akhir:** **${actualScore}**`)
            .setTimestamp();

          let exactText = '';
          if (exactWinners.length > 0) {
            const totalWinningBets = exactWinners.reduce((sum, w) => sum + w.bet_amount, 0);
            exactText = exactWinners.map(w => {
              const payout = Math.floor((w.bet_amount / totalWinningBets) * exactPool);
              return `• <@${w.user_id}> menang **Rp ${payout.toLocaleString('id-ID')}** (Taruhan: Rp ${w.bet_amount.toLocaleString('id-ID')})`;
            }).join('\n');
          } else if (exactBets.length > 0) {
            exactText = `*Tidak ada tebakan skor yang tepat. Koin taruhan sebesar Rp ${exactPool.toLocaleString('id-ID')} hangus dan diserahkan ke Owner.*`;
          }

          let outcomeText = '';
          if (outcomeWinners.length > 0) {
            const totalWinningBets = outcomeWinners.reduce((sum, w) => sum + w.bet_amount, 0);
            outcomeText = outcomeWinners.map(w => {
              const payout = Math.floor((w.bet_amount / totalWinningBets) * outcomePool);
              return `• <@${w.user_id}> menang **Rp ${payout.toLocaleString('id-ID')}** (Taruhan: Rp ${w.bet_amount.toLocaleString('id-ID')})`;
            }).join('\n');
          } else if (outcomeBets.length > 0) {
            outcomeText = `*Tidak ada tebakan pemenang yang tepat. Koin taruhan sebesar Rp ${outcomePool.toLocaleString('id-ID')} hangus dan diserahkan ke Owner.*`;
          }

          if (exactBets.length > 0) embed.addFields({ name: '⚽ Pemenang Tebak Skor Tepat', value: exactText });
          if (outcomeBets.length > 0) embed.addFields({ name: '🎟️ Pemenang Tebak Pemenang/Hasil', value: outcomeText });

          channel.send({ embeds: [embed] }).catch(err => console.error('Error sending worldcup bet resolve embed:', err));
        }
      }
    }
  }
}

function placeExactScoreBet(userId, guildId, matchId, homeScore, awayScore, betAmount) {
  const match = matches.find(m => m.id === matchId);
  if (!match) throw new Error(`Pertandingan dengan ID ${matchId} tidak ditemukan.`);
  if (match.status !== 'Mendatang') throw new Error('Pertandingan sudah berlangsung atau telah selesai.');

  const kickoff = getMatchTimestamp(match.wibDate, match.wibTime);
  if (Date.now() > kickoff) throw new Error('Pertandingan sudah berlangsung.');

  const economy = require('./economy');
  const existing = db.prepare("SELECT * FROM worldcup_bets WHERE guild_id = ? AND user_id = ? AND match_id = ? AND bet_type = 'exact_score' AND status = 'pending'").get(guildId, userId, matchId);

  const now = Math.floor(Date.now() / 1000);

  if (existing) {
    const diff = betAmount - existing.bet_amount;
    if (diff > 0) {
      const wallet = economy.getWallet(userId, guildId);
      if (wallet.balance < diff) throw new Error(`Saldo Anda kurang Rp ${diff.toLocaleString('id-ID')} untuk memperbarui taruhan.`);
      economy.subtractBalance(userId, guildId, diff, 'WORLDCUP_BET_UPDATE');
    } else if (diff < 0) {
      economy.addBalance(userId, guildId, -diff, 'WORLDCUP_BET_UPDATE');
    }
    db.prepare('UPDATE worldcup_bets SET home_score = ?, away_score = ?, bet_amount = ?, created_at = ? WHERE id = ?')
      .run(homeScore, awayScore, betAmount, now, existing.id);
  } else {
    const wallet = economy.getWallet(userId, guildId);
    if (wallet.balance < betAmount) throw new Error(`Saldo Anda tidak mencukupi untuk memasang taruhan sebesar Rp ${betAmount.toLocaleString('id-ID')}.`);
    economy.subtractBalance(userId, guildId, betAmount, 'WORLDCUP_BET_PLACE');
    db.prepare('INSERT INTO worldcup_bets (guild_id, user_id, match_id, bet_type, home_score, away_score, bet_amount, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(guildId, userId, matchId, 'exact_score', homeScore, awayScore, betAmount, now);
  }
  return true;
}

function placeOutcomeBet(userId, guildId, matchId, predictedOutcome, betAmount) {
  const match = matches.find(m => m.id === matchId);
  if (!match) throw new Error(`Pertandingan dengan ID ${matchId} tidak ditemukan.`);
  if (match.status !== 'Mendatang') throw new Error('Pertandingan sudah berlangsung atau telah selesai.');

  const kickoff = getMatchTimestamp(match.wibDate, match.wibTime);
  if (Date.now() > kickoff) throw new Error('Pertandingan sudah berlangsung.');

  if (!['home', 'away', 'draw'].includes(predictedOutcome)) throw new Error('Prediksi hasil tidak valid. Pilih home/away/draw.');

  const economy = require('./economy');
  const existing = db.prepare("SELECT * FROM worldcup_bets WHERE guild_id = ? AND user_id = ? AND match_id = ? AND bet_type = 'outcome' AND status = 'pending'").get(guildId, userId, matchId);

  const now = Math.floor(Date.now() / 1000);

  if (existing) {
    const diff = betAmount - existing.bet_amount;
    if (diff > 0) {
      const wallet = economy.getWallet(userId, guildId);
      if (wallet.balance < diff) throw new Error(`Saldo Anda kurang Rp ${diff.toLocaleString('id-ID')} untuk memperbarui taruhan.`);
      economy.subtractBalance(userId, guildId, diff, 'WORLDCUP_BET_UPDATE');
    } else if (diff < 0) {
      economy.addBalance(userId, guildId, -diff, 'WORLDCUP_BET_UPDATE');
    }
    db.prepare('UPDATE worldcup_bets SET predicted_outcome = ?, bet_amount = ?, created_at = ? WHERE id = ?')
      .run(predictedOutcome, betAmount, now, existing.id);
  } else {
    const wallet = economy.getWallet(userId, guildId);
    if (wallet.balance < betAmount) throw new Error(`Saldo Anda tidak mencukupi untuk memasang taruhan sebesar Rp ${betAmount.toLocaleString('id-ID')}.`);
    economy.subtractBalance(userId, guildId, betAmount, 'WORLDCUP_BET_PLACE');
    db.prepare('INSERT INTO worldcup_bets (guild_id, user_id, match_id, bet_type, predicted_outcome, bet_amount, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(guildId, userId, matchId, 'outcome', predictedOutcome, betAmount, now);
  }
  return true;
}

/**
 * Membuat Embed Jadwal & Skor Piala Dunia 2026
 */
function generateWorldCupEmbed(client) {
  // Update status & skor terbaru sebelum membuat embed
  updateMatchScores(client);

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
      const statusIcon = m.status === 'Selesai' ? '✅' : (m.status === 'Live' ? '🔴' : '⏰');
      const scoreStr = (m.status === 'Selesai' || m.status === 'Live') ? `**${m.score}**` : `vs`;
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
  generateWorldCupEmbed,
  placeExactScoreBet,
  placeOutcomeBet,
  resolveMatchBets
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
      
      const btnOutcome = new ButtonBuilder()
        .setCustomId('wcb_btn_outcome')
        .setLabel('🎟️ Tebak Hasil (1X2)')
        .setStyle(ButtonStyle.Primary);
      const btnExact = new ButtonBuilder()
        .setCustomId('wcb_btn_exact')
        .setLabel('⚽ Tebak Skor Tepat')
        .setStyle(ButtonStyle.Success);
        
      const row = new ActionRowBuilder().addComponents(btnOutcome, btnExact);

      await channel.send({
        content: '👋 **Selamat datang di Saluran Resmi Piala Dunia 2026!** Di sini Anda dapat memantau jadwal pertandingan dan skor terbaru secara otomatis.',
        embeds: [embed],
        components: [row]
      });
    }
    return channel;
  } catch (error) {
    console.error(`❌ Gagal membuat channel piala dunia di guild ${guild.name}:`, error.message);
    return null;
  }
}

async function handleWorldCupInteractions(interaction, client) {
  const customId = interaction.customId;

  // 1. Tombol Utama (Tebak Hasil / Tebak Skor Tepat)
  if (interaction.isButton() && customId === 'wcb_btn_outcome') {
    const upcoming = matches.filter(m => {
      const kickoff = getMatchTimestamp(m.wibDate, m.wibTime);
      return m.status === 'Mendatang' && Date.now() < kickoff;
    });
    if (upcoming.length === 0) {
      return interaction.reply({ content: '❌ Tidak ada pertandingan mendatang yang dapat ditaruhkan saat ini.', flags: 64 });
    }
    const selectOptions = upcoming.map(m => ({
      label: `${m.home} vs ${m.away}`,
      description: `${m.wibDate} - ${m.wibTime}`,
      value: `${m.id}`
    }));
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('wcb_select_match_outcome')
      .setPlaceholder('Pilih pertandingan...')
      .addOptions(selectOptions);
    const row = new ActionRowBuilder().addComponents(selectMenu);
    await interaction.reply({ content: '💡 **Pilih pertandingan untuk menebak Pemenang / Seri:**', components: [row], flags: 64 });
  }

  else if (interaction.isButton() && customId === 'wcb_btn_exact') {
    const upcoming = matches.filter(m => {
      const kickoff = getMatchTimestamp(m.wibDate, m.wibTime);
      return m.status === 'Mendatang' && Date.now() < kickoff;
    });
    if (upcoming.length === 0) {
      return interaction.reply({ content: '❌ Tidak ada pertandingan mendatang yang dapat ditaruhkan saat ini.', flags: 64 });
    }
    const selectOptions = upcoming.map(m => ({
      label: `${m.home} vs ${m.away}`,
      description: `${m.wibDate} - ${m.wibTime}`,
      value: `${m.id}`
    }));
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('wcb_select_match_exact')
      .setPlaceholder('Pilih pertandingan...')
      .addOptions(selectOptions);
    const row = new ActionRowBuilder().addComponents(selectMenu);
    await interaction.reply({ content: '💡 **Pilih pertandingan untuk menebak Skor Tepat:**', components: [row], flags: 64 });
  }

  // 2. Tombol Pemilihan Outcome (Home / Draw / Away) setelah memilih match
  else if (interaction.isButton() && customId.startsWith('wcb_btn_choose_outcome_')) {
    const parts = customId.split('_');
    const matchId = parseInt(parts[4]);
    const outcome = parts[5]; // 'home', 'away', 'draw'
    const match = matches.find(m => m.id === matchId);
    if (!match) return interaction.reply({ content: '❌ Pertandingan tidak ditemukan.', flags: 64 });

    const outcomeLabel = outcome === 'home' ? match.home : (outcome === 'away' ? match.away : 'Seri');

    const modal = new ModalBuilder()
      .setCustomId(`wcb_modal_outcome_${matchId}_${outcome}`)
      .setTitle('🎟️ Tebak Hasil');

    const amountInput = new TextInputBuilder()
      .setCustomId('bet_amount')
      .setLabel(`Jumlah Taruhan (Koin) untuk ${outcomeLabel}`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Contoh: 500')
      .setRequired(true);

    const row = new ActionRowBuilder().addComponents(amountInput);
    modal.addComponents(row);
    await interaction.showModal(modal);
  }

  // 3. Dropdown Selection Match
  else if (interaction.isStringSelectMenu() && customId === 'wcb_select_match_outcome') {
    const matchId = parseInt(interaction.values[0]);
    const match = matches.find(m => m.id === matchId);
    if (!match) return interaction.reply({ content: '❌ Pertandingan tidak ditemukan.', flags: 64 });

    const btnHome = new ButtonBuilder()
      .setCustomId(`wcb_btn_choose_outcome_${matchId}_home`)
      .setLabel(`${match.home.split(' 🇨🇻')[0].split(' 🇸🇦')[0].split(' 🇵🇦')[0].split(' 🏴󠁧󠁢󠁥󠁮󠁧󠁿')[0].split(' 🇭🇷')[0].split(' 🇬🇭')[0].split(' 🇨🇴')[0].split(' 🇵🇹')[0].split(' 🇨🇩')[0].split(' 🇺🇿')[0].split(' 🇯🇴')[0].split(' 🇦🇷')[0].split(' 🇩🇿')[0].split(' 🇦🇹')[0].split(' 🇩🇪')[0].split(' 🇵🇾')[0].split(' 🇳🇱')[0].split(' 🇲🇦')[0]} Menang`)
      .setStyle(ButtonStyle.Primary);
    const btnDraw = new ButtonBuilder()
      .setCustomId(`wcb_btn_choose_outcome_${matchId}_draw`)
      .setLabel('Seri (Draw)')
      .setStyle(ButtonStyle.Secondary);
    const btnAway = new ButtonBuilder()
      .setCustomId(`wcb_btn_choose_outcome_${matchId}_away`)
      .setLabel(`${match.away.split(' 🇨🇻')[0].split(' 🇸🇦')[0].split(' 🇵🇦')[0].split(' 🏴󠁧󠁢󠁥󠁮󠁧󠁿')[0].split(' 🇭🇷')[0].split(' 🇬🇭')[0].split(' 🇨🇴')[0].split(' 🇵🇹')[0].split(' 🇨🇩')[0].split(' 🇺🇿')[0].split(' 🇯🇴')[0].split(' 🇦🇷')[0].split(' 🇩🇿')[0].split(' 🇦🇹')[0].split(' 🇩🇪')[0].split(' 🇵🇾')[0].split(' 🇳🇱')[0].split(' 🇲🇦')[0]} Menang`)
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(btnHome, btnDraw, btnAway);
    await interaction.update({ content: `Pilih hasil akhir untuk **${match.home}** vs **${match.away}**:`, components: [row] });
  }

  else if (interaction.isStringSelectMenu() && customId === 'wcb_select_match_exact') {
    const matchId = parseInt(interaction.values[0]);
    const match = matches.find(m => m.id === matchId);
    if (!match) return interaction.reply({ content: '❌ Pertandingan tidak ditemukan.', flags: 64 });

    const modal = new ModalBuilder()
      .setCustomId(`wcb_modal_exact_${matchId}`)
      .setTitle('⚽ Tebak Skor Tepat');

    const scoreInput = new TextInputBuilder()
      .setCustomId('score_guess')
      .setLabel('Prediksi Skor (Format: Home-Away)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Contoh: 2-1')
      .setRequired(true);

    const amountInput = new TextInputBuilder()
      .setCustomId('bet_amount')
      .setLabel('Jumlah Taruhan (Koin)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Contoh: 500')
      .setRequired(true);

    const row1 = new ActionRowBuilder().addComponents(scoreInput);
    const row2 = new ActionRowBuilder().addComponents(amountInput);
    modal.addComponents(row1, row2);
    await interaction.showModal(modal);
  }

  // 4. Modal Submit
  else if (interaction.isModalSubmit() && customId.startsWith('wcb_modal_outcome_')) {
    await interaction.deferReply({ flags: 64 });
    const parts = customId.split('_');
    const matchId = parseInt(parts[3]);
    const outcome = parts[4];
    const betAmount = parseInt(interaction.fields.getTextInputValue('bet_amount').trim());

    if (isNaN(betAmount) || betAmount <= 0) {
      return interaction.editReply({ content: '❌ Jumlah taruhan harus berupa angka di atas 0!' });
    }

    try {
      placeOutcomeBet(interaction.user.id, interaction.guildId, matchId, outcome, betAmount);
      const match = matches.find(m => m.id === matchId);
      const outcomeLabel = outcome === 'home' ? match.home : (outcome === 'away' ? match.away : 'Seri');
      await interaction.editReply({ content: `✅ **Berhasil memasang taruhan tebak hasil!**\n⚽ **Pertandingan:** ${match.home} vs ${match.away}\n🎯 **Pilihan:** ${outcomeLabel}\n💰 **Jumlah Taruhan:** Rp ${betAmount.toLocaleString('id-ID')}` });
    } catch (err) {
      await interaction.editReply({ content: `❌ ${err.message}` });
    }
  }

  else if (interaction.isModalSubmit() && customId.startsWith('wcb_modal_exact_')) {
    await interaction.deferReply({ flags: 64 });
    const parts = customId.split('_');
    const matchId = parseInt(parts[3]);
    const scoreGuess = interaction.fields.getTextInputValue('score_guess').trim();
    const betAmount = parseInt(interaction.fields.getTextInputValue('bet_amount').trim());

    if (!/^\d+\s*-\s*\d+$/.test(scoreGuess)) {
      return interaction.editReply({ content: '❌ Format skor salah! Gunakan format Angka-Angka (contoh: `2-1` atau `0-0`).' });
    }
    if (isNaN(betAmount) || betAmount <= 0) {
      return interaction.editReply({ content: '❌ Jumlah taruhan harus berupa angka di atas 0!' });
    }

    const scoreParts = scoreGuess.split('-').map(s => parseInt(s.trim()));
    const homeScore = scoreParts[0];
    const awayScore = scoreParts[1];

    try {
      placeExactScoreBet(interaction.user.id, interaction.guildId, matchId, homeScore, awayScore, betAmount);
      const match = matches.find(m => m.id === matchId);
      await interaction.editReply({ content: `✅ **Berhasil memasang taruhan tebak skor!**\n⚽ **Pertandingan:** ${match.home} vs ${match.away}\n🎯 **Tebakan Skor:** ${homeScore} - ${awayScore}\n💰 **Jumlah Taruhan:** Rp ${betAmount.toLocaleString('id-ID')}` });
    } catch (err) {
      await interaction.editReply({ content: `❌ ${err.message}` });
    }
  }
}

module.exports.autoCreateWorldCupChannel = autoCreateWorldCupChannel;
module.exports.handleWorldCupInteractions = handleWorldCupInteractions;

