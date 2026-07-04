const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { db } = require('./database');

// Array ini diisi sepenuhnya dari database worldcup_matches yang di-sync dari API worldcup26.ir
// Tidak ada data hardcoded agar skor selalu akurat dan tidak duplikat
const matches = [];

const countryTranslations = {
  'Spain': 'Spanyol 🇪🇸',
  'Austria': 'Austria 🇦🇹',
  'Portugal': 'Portugal 🇵🇹',
  'Croatia': 'Kroasia 🇭🇷',
  'Switzerland': 'Swiss 🇨🇭',
  'Algeria': 'Aljazair 🇩🇿',
  'Australia': 'Australia 🇦🇺',
  'Egypt': 'Mesir 🇪🇬',
  'Argentina': 'Argentina 🇦🇷',
  'Cape Verde': 'Tanjung Verde 🇨🇻',
  'Colombia': 'Kolombia 🇨🇴',
  'Ghana': 'Ghana 🇬🇭',
  'Germany': 'Jerman 🇩🇪',
  'Paraguay': 'Paraguay 🇵🇾',
  'Netherlands': 'Belanda 🇳🇱',
  'Morocco': 'Maroko 🇲🇦',
  'Panama': 'Panama 🇵🇦',
  'England': 'Inggris 🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Jordan': 'Yordania 🇯🇴',
  'DR Congo': 'RD Kongo 🇨🇩',
  'Uzbekistan': 'Uzbekistan 🇺🇿',
  'France': 'Prancis 🇫🇷',
  'Canada': 'Kanada 🇨🇦',
  'Brazil': 'Brasil 🇧🇷',
  'Norway': 'Norwegia 🇳🇴',
  'Mexico': 'Meksiko 🇲🇽',
  'Belgium': 'Belgia 🇧🇪',
  'United States': 'Amerika Serikat 🇺🇸',
  'Turkey': 'Turki 🇹🇷',
  'South Africa': 'Afrika Selatan 🇿🇦'
};

function translateTeamName(name) {
  if (!name) return '';
  if (countryTranslations[name]) return countryTranslations[name];
  return name
    .replace(/Winner Match (\d+)/g, 'Pemenang Laga $1')
    .replace(/Loser Match (\d+)/g, 'Kalah Laga $1');
}

async function fetchRealtimeMatches() {
  try {
    const url = 'https://worldcup26.ir/get/games';
    const res = await fetch(url);
    if (!res.ok) return;
    const responseData = await res.json();
    const data = responseData.games || [];

    db.exec(`
      CREATE TABLE IF NOT EXISTS worldcup_matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stage TEXT,
        home TEXT,
        away TEXT,
        wib_date TEXT,
        wib_time TEXT,
        unique_key TEXT UNIQUE
      )
    `);

    // Ensure auto-increment starts at 11
    const seq = db.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'worldcup_matches'").get();
    if (!seq) {
      db.prepare("INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES ('worldcup_matches', 10)").run();
    }

    // Auto-clean any legacy Formula 1 / non-World Cup entries
    db.exec(`
      DELETE FROM worldcup_match_scores WHERE match_id IN (
        SELECT id FROM worldcup_matches WHERE home = 'Formula 1' OR away = 'Formula 1'
      )
    `);
    db.exec(`DELETE FROM worldcup_matches WHERE home = 'Formula 1' OR away = 'Formula 1'`);

    const stadiumOffsets = {
      '13': 14, '14': 14, '15': 14, '16': 14, // Western
      '1': 12, '2': 12, '3': 12, '4': 12, '5': 12, '6': 12, // Central
      '7': 11, '8': 11, '9': 11, '10': 11, '11': 11, '12': 11 // Eastern
    };

    for (const fixture of data) {
      const homeName = translateTeamName(fixture.home_team_name_en || fixture.home_team_label);
      const awayName = translateTeamName(fixture.away_team_name_en || fixture.away_team_label);
      if (!homeName || !awayName) continue;

      // Parse local_date "MM/DD/YYYY HH:mm"
      const matchDateParts = fixture.local_date.split(' ');
      const dateParts = matchDateParts[0].split('/');
      const timeParts = matchDateParts[1].split(':');
      const year = parseInt(dateParts[2]);
      const month = parseInt(dateParts[0]) - 1;
      const day = parseInt(dateParts[1]);
      const hour = parseInt(timeParts[0]);
      const minute = parseInt(timeParts[1]);

      const offsetHours = stadiumOffsets[fixture.stadium_id] || 12;
      const localDateUTC = Date.UTC(year, month, day, hour, minute, 0);
      const wibTimeMs = localDateUTC + (offsetHours * 60 * 60 * 1000);
      const wibDateObj = new Date(wibTimeMs);

      const dateStr = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(wibDateObj);
      const hours = String(wibDateObj.getUTCHours()).padStart(2, '0');
      const minutes = String(wibDateObj.getUTCMinutes()).padStart(2, '0');
      const timeStr = `${hours}:${minutes} WIB`;

      const uniqueKey = `worldcup26-${fixture.id}`;

      let stageName = 'Grup';
      if (fixture.group) {
        if (fixture.group === 'R32') stageName = 'Babak 32 Besar';
        else if (fixture.group === 'R16') stageName = 'Babak 16 Besar';
        else if (fixture.group === 'QF') stageName = 'Perempat Final';
        else if (fixture.group === 'SF') stageName = 'Semifinal';
        else if (fixture.group === '3RD') stageName = 'Perebutan Tempat Ketiga';
        else if (fixture.group === 'FI') stageName = 'Final';
        else stageName = `Grup ${fixture.group}`;
      }

      // Insert or ignore matches into database
      db.prepare(`
        INSERT OR IGNORE INTO worldcup_matches (stage, home, away, wib_date, wib_time, unique_key)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(stageName, homeName, awayName, dateStr, timeStr, uniqueKey);

      // Handle scores if live or finished
      let scoreStr = '- - -';
      let status = 'Mendatang';

      if (fixture.finished === 'TRUE') {
        status = 'Selesai';
        if (fixture.home_penalty_score !== 'null' && fixture.home_penalty_score !== null && fixture.away_penalty_score !== 'null' && fixture.away_penalty_score !== null) {
          scoreStr = `${fixture.home_score} - ${fixture.away_score} (Pen: ${fixture.home_penalty_score} - ${fixture.away_penalty_score})`;
        } else {
          scoreStr = `${fixture.home_score} - ${fixture.away_score}`;
        }
      } else if (fixture.time_elapsed === 'live') {
        status = 'Live';
        scoreStr = `${fixture.home_score} - ${fixture.away_score}`;
      }

      const matchRow = db.prepare('SELECT id FROM worldcup_matches WHERE unique_key = ?').get(uniqueKey);
      if (matchRow) {
        db.prepare('INSERT OR REPLACE INTO worldcup_match_scores (match_id, score, status) VALUES (?, ?, ?)')
          .run(matchRow.id, scoreStr, status);
      }
    }
  } catch (err) {
    console.error("❌ Gagal mengambil jadwal realtime worldcup26.ir:", err.message);
  }
}

function loadMatchesFromDb() {
  matches.length = 0;

  db.exec(`
    CREATE TABLE IF NOT EXISTS worldcup_matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stage TEXT,
      home TEXT,
      away TEXT,
      wib_date TEXT,
      wib_time TEXT,
      unique_key TEXT UNIQUE
    )
  `);

  // Hanya gunakan data dari database (API worldcup26.ir) — tidak ada hardcoded
  const dbMatches = db.prepare("SELECT * FROM worldcup_matches").all();
  dbMatches.forEach(row => {
    matches.push({
      id: row.id,
      stage: row.stage,
      home: row.home,
      away: row.away,
      wibDate: row.wib_date,
      wibTime: row.wib_time,
      score: 'vs',
      status: 'Mendatang'
    });
  });

  // Terapkan skor dan status yang disimpan dari API
  matches.forEach(m => {
    const saved = db.prepare('SELECT score, status FROM worldcup_match_scores WHERE match_id = ?').get(m.id);
    if (saved) {
      m.score = saved.score;
      m.status = saved.status;
    }
  });
}

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
  loadMatchesFromDb();
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

  // Skor & status sudah diterapkan dari loadMatchesFromDb() via worldcup_match_scores
  // Tidak ada lagi skor acak — semua data murni dari API worldcup26.ir
  // (Tidak ada aksi tambahan di sini)
}

/**
 * Menyelesaikan taruhan untuk match tertentu dan membagi pool hadiah
 */
function resolveMatchBets(client, matchId, actualScore) {
  const pendingBets = db.prepare("SELECT * FROM worldcup_bets WHERE match_id = ? AND status = 'pending'").all(matchId);
  if (pendingBets.length === 0) return;

  const match = matches.find(m => m.id === matchId);
  if (!match) return;

  // Parse main score (ignore penalty parts for exact score checking)
  const mainScoreOnly = actualScore.split('(')[0].trim();
  const actualScoreParts = mainScoreOnly.split('-').map(s => parseInt(s.trim()));
  const actualHome = actualScoreParts[0];
  const actualAway = actualScoreParts[1];
  if (isNaN(actualHome) || isNaN(actualAway)) return;

  // Determine outcome, considering penalty shootouts if present
  let actualOutcome;
  const penMatch = actualScore.match(/\(Pen:\s*(\d+)\s*-\s*(\d+)\)/i);
  if (penMatch) {
    const penHome = parseInt(penMatch[1]);
    const penAway = parseInt(penMatch[2]);
    actualOutcome = penHome > penAway ? 'home' : 'away';
  } else {
    actualOutcome = actualHome > actualAway ? 'home' : (actualHome < actualAway ? 'away' : 'draw');
  }

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
    .setColor(0xF59E0B) // Amber Gold
    .setTitle('🏆 JADWAL & SKOR FIFA WORLD CUP 2026')
    .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/4/4b/FIFA_World_Cup_2026_logo.svg')
    .setDescription('Berikut adalah jadwal, jam tanding (WIB), dan skor terbaru Piala Dunia FIFA 2026:')
    .setTimestamp();

  // Filter matches to only show Live, Mendatang, or Selesai within the last 12 hours
  const filteredMatches = matches.filter(m => {
    if (m.status !== 'Selesai') return true;
    const kickoff = getMatchTimestamp(m.wibDate, m.wibTime);
    const twelveHours = 12 * 60 * 60 * 1000;
    return Date.now() < kickoff + twelveHours;
  });

  // Kelompokkan pertandingan berdasarkan Tanggal WIB
  const groupedMatches = {};
  filteredMatches.forEach(m => {
    if (!groupedMatches[m.wibDate]) {
      groupedMatches[m.wibDate] = [];
    }
    groupedMatches[m.wibDate].push(m);
  });

  for (const date in groupedMatches) {
    const matchLines = groupedMatches[date].map(m => {
      const statusIcon = m.status === 'Selesai' ? '🟢' : (m.status === 'Live' ? '🔴' : '⏰');
      const statusLabel = m.status === 'Selesai' ? 'SELESAI (FT)' : (m.status === 'Live' ? 'LIVE' : 'MENDATANG');
      const scoreStr = (m.status === 'Selesai' || m.status === 'Live') ? `**${m.score}**` : `vs`;
      const homeName = translateTeamName(m.home);
      const awayName = translateTeamName(m.away);

      return `> 🏆 **\` ${m.stage.toUpperCase()} \`**\n` +
             `> ${statusIcon} **${homeName}** ${scoreStr} **${awayName}**\n` +
             `> 🕒 \`${m.wibTime}\` • *${statusLabel}*\n`;
    }).join('\n');

    embed.addFields({ name: `📆 ${date}`, value: matchLines });
  }

  return embed;
}
// module.exports will be handled at the bottom of the file
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

// Map of players for scorer names
const teamPlayers = {
  'Belanda 🇳🇱': ['Memphis Depay', 'Cody Gakpo', 'Xavi Simons', 'Frenkie de Jong', 'Virgil van Dijk'],
  'Maroko 🇲🇦': ['Hakim Ziyech', 'Youssef En-Nesyri', 'Achraf Hakimi', 'Sofyan Amrabat', 'Brahim Díaz'],
  'Jerman 🇩🇪': ['Florian Wirtz', 'Jamal Musiala', 'Kai Havertz', 'Niclas Füllkrug', 'Thomas Müller'],
  'Paraguay 🇵🇾': ['Miguel Almirón', 'Antonio Sanabria', 'Julio Enciso', 'Ramón Sosa'],
  'Inggris 🏴󠁧󠁢󠁥󠁮󠁧󠁿': ['Harry Kane', 'Jude Bellingham', 'Bukayo Saka', 'Phil Foden', 'Cole Palmer'],
  'Panama 🇵🇦': ['Cecilio Waterman', 'José Fajardo', 'Yoel Bárcenas'],
  'Kroasia 🇭🇷': ['Andrej Kramarić', 'Luka Modrić', 'Ivan Perišić', 'Mario Pašalić'],
  'Ghana 🇬🇭': ['Inaki Williams', 'Mohammed Kudus', 'Jordan Ayew', 'Antoine Semenyo'],
  'Kolombia 🇨🇴': ['Luis Díaz', 'James Rodríguez', 'Jhon Durán', 'Rafael Borré'],
  'Portugal 🇵🇹': ['Cristiano Ronaldo', 'Bruno Fernandes', 'Rafael Leão', 'João Félix', 'Gonçalo Ramos'],
  'RD Kongo 🇨🇩': ['Yoane Wissa', 'Cédric Bakambu', 'Meschak Elia'],
  'Uzbekistan 🇺🇿': ['Eldor Shomurodov', 'Abbosbek Fayzullaev', 'Igor Sergeev'],
  'Yordania 🇯🇴': ['Musa Al-Taamari', 'Yazan Al-Naimat', 'Ali Olwan'],
  'Argentina 🇦🇷': ['Lionel Messi', 'Lautaro Martínez', 'Julián Álvarez', 'Alexis Mac Allister', 'Rodrigo De Paul'],
  'Aljazair 🇩🇿': ['Riyad Mahrez', 'Baghdad Bounedjah', 'Amine Gouiri', 'Saïd Benrahma'],
  'Austria 🇦🇹': ['Marcel Sabitzer', 'Christoph Baumgartner', 'Michael Gregoritsch', 'Marko Arnautović'],
  'Spanyol 🇪🇸': ['Álvaro Morata', 'Lamine Yamal', 'Nico Williams', 'Dani Olmo', 'Pedri'],
  'Swiss 🇨🇭': ['Breel Embolo', 'Granit Xhaka', 'Xherdan Shaqiri', 'Zeki Amdouni'],
  'Australia 🇦🇺': ['Mitchell Duke', 'Craig Goodwin', 'Jackson Irvine'],
  'Mesir 🇪🇬': ['Mohamed Salah', 'Mostafa Mohamed', 'Omar Marmoush'],
  'Tanjung Verde 🇨🇻': ['Bebé', 'Ryan Mendes', 'Garry Rodrigues']
};

/**
 * Start background live match monitoring and mock simulation loop
 */
function startLiveMatchWatcher(client) {
  // Ensure events table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS worldcup_match_events (
      event_id TEXT PRIMARY KEY,
      match_id INTEGER,
      event_type TEXT,
      details TEXT,
      created_at INTEGER
    )
  `);

  console.log("⚽ [WorldCup] Live match watcher started (interval: 60s).");
  
  const parseScorers = (scorersStr) => {
    if (!scorersStr || scorersStr === 'null') return [];
    try {
      let cleaned = scorersStr;
      if (cleaned.startsWith('{')) {
        cleaned = '[' + cleaned.substring(1, cleaned.length - 1) + ']';
      }
      cleaned = cleaned.replace(/“/g, '"').replace(/”/g, '"');
      const parsed = JSON.parse(cleaned);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  };

  const tick = async () => {
    try {
      const url = 'https://worldcup26.ir/get/games';
      const res = await fetch(url);
      if (!res.ok) return;
      const responseData = await res.json();
      const data = responseData.games || [];

      // Store previous scores & statuses before database update
      const prevStates = new Map();
      try {
        const allScores = db.prepare('SELECT match_id, score, status FROM worldcup_match_scores').all();
        allScores.forEach(row => {
          prevStates.set(row.match_id, { score: row.score, status: row.status });
        });
      } catch (dbErr) {
        // Table might not exist yet on first startup
      }

      // Update database schema / schedule first
      await fetchRealtimeMatches();
      loadMatchesFromDb();

      for (const fixture of data) {
        const uniqueKey = `worldcup26-${fixture.id}`;
        const matchRow = db.prepare('SELECT id, home, away, stage FROM worldcup_matches WHERE unique_key = ?').get(uniqueKey);
        if (!matchRow) continue;

        const matchDbId = matchRow.id;
        const homeName = matchRow.home;
        const awayName = matchRow.away;
        const stageName = matchRow.stage;

        // Check previous status and score from stored map
        const prevState = prevStates.get(matchDbId) || { score: '- - -', status: 'Mendatang' };
        const prevStatus = prevState.status;
        const prevScore = prevState.score;

        let currentStatus = 'Mendatang';
        let currentScore = '- - -';

        if (fixture.finished === 'TRUE') {
          currentStatus = 'Selesai';
          if (fixture.home_penalty_score !== 'null' && fixture.home_penalty_score !== null && fixture.away_penalty_score !== 'null' && fixture.away_penalty_score !== null) {
            currentScore = `${fixture.home_score} - ${fixture.away_score} (Pen: ${fixture.home_penalty_score} - ${fixture.away_penalty_score})`;
          } else {
            currentScore = `${fixture.home_score} - ${fixture.away_score}`;
          }
        } else if (fixture.time_elapsed === 'live') {
          currentStatus = 'Live';
          currentScore = `${fixture.home_score} - ${fixture.away_score}`;
        }

        // 1. Kick-off Notification
        if (prevStatus === 'Mendatang' && currentStatus === 'Live') {
          sendWorldCupNotification(client, `⏰ **KICK-OFF!** Pertandingan **${homeName}** vs **${awayName}** di **${stageName}** telah dimulai!`);
        }

        // 2. Goal Notifications
        if (currentStatus === 'Live' || currentStatus === 'Selesai') {
          const homeScorers = parseScorers(fixture.home_scorers);
          const awayScorers = parseScorers(fixture.away_scorers);

          const processGoal = (scorer, teamName) => {
            const eventId = `match_${matchDbId}_goal_${encodeURIComponent(scorer.trim())}`;
            const exists = db.prepare('SELECT 1 FROM worldcup_match_events WHERE event_id = ?').get(eventId);
            if (!exists) {
              db.prepare('INSERT INTO worldcup_match_events (event_id, match_id, event_type, details, created_at) VALUES (?, ?, ?, ?, ?)')
                .run(eventId, matchDbId, 'goal', scorer, Math.floor(Date.now() / 1000));

              // Only notify if it was live when it happened (to avoid spamming notifications for old matches)
              if (prevStatus === 'Live' || prevStatus === 'Mendatang') {
                sendWorldCupNotification(client, `⚽ **GOOOL!** [${teamName}] mencetak gol!\n\n**Skor Sementara:** **${homeName}** **${currentScore}** **${awayName}**\n🎯 **Pencetak Gol:** ${scorer}`);
              }
            }
          };

          homeScorers.forEach(scorer => processGoal(scorer, homeName));
          awayScorers.forEach(scorer => processGoal(scorer, awayName));
        }

        // 3. Match Finished / Bet Resolving
        if (prevStatus !== 'Selesai' && currentStatus === 'Selesai') {
          db.prepare('INSERT OR REPLACE INTO worldcup_match_scores (match_id, score, status) VALUES (?, ?, ?)')
            .run(matchDbId, currentScore, 'Selesai');

          sendWorldCupNotification(client, `🏁 **PERTANDINGAN SELESAI!**\n⚽ **${homeName}** vs **${awayName}**\n**Skor Akhir:** **${currentScore}**`);

          try {
            resolveMatchBets(client, matchDbId, currentScore);
          } catch (e) {
            console.error(`❌ Gagal menyelesaikan taruhan untuk match ID ${matchDbId}:`, e.message);
          }
        }
      }
    } catch (err) {
      console.error("❌ Error in live match watcher loop:", err.message);
    }
  };

  // Run once immediately
  tick();

  // Schedule interval
  setInterval(tick, 60000);
}

/**
 * Sends a message to the World Cup channel across all guilds
 */
function sendWorldCupNotification(client, content) {
  if (!client) return;
  client.guilds.cache.forEach(guild => {
    const channelId = getWorldCupChannel(guild.id);
    if (channelId) {
      const channel = guild.channels.cache.get(channelId);
      if (channel) {
        channel.send({ content }).catch(err => console.error(`Error sending WorldCup event notification:`, err.message));
      }
    }
  });
}

module.exports = {
  matches,
  setWorldCupChannel,
  getWorldCupChannel,
  generateWorldCupEmbed,
  placeExactScoreBet,
  placeOutcomeBet,
  resolveMatchBets,
  autoCreateWorldCupChannel,
  handleWorldCupInteractions,
  startLiveMatchWatcher
};

