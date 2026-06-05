const db = require('./database');
const pet = require('./pet');
const embeds = require('./embeds');
const { 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder, 
  ChannelType, 
  PermissionFlagsBits 
} = require('discord.js');

// Helper to resolve element-based skill names
function getElementalSkillName(element) {
  const el = element ? element.toUpperCase() : 'EARTH';
  const skills = {
    FIRE: '🔥 Cakar Bara Bara',
    WATER: '🌊 Tebasan Ombak Biru',
    EARTH: '🧱 Hantaman Batu Raksasa',
    DRAGON: '🐉 Cakar Naga Kembar'
  };
  return skills[el] || '⚡ Serangan Elemen';
}

function getUltimateName(element) {
  const el = element ? element.toUpperCase() : 'EARTH';
  const ults = {
    FIRE: '🔥 Ledakan Supernova Neraka',
    WATER: '🌊 Pusaran Air Abyss Pemulih',
    EARTH: '🧱 Zirah Pelindung Gunung Purba',
    DRAGON: '🐉 Hembusan Naga Kosmik'
  };
  return ults[el] || '💥 Ultimate Strike';
}

/**
 * Memulai event turnamen baru di database (Admin-only).
 */
function startTournament(adminId, guildId, channelId, durationMins = 30, minLevel = 10, maxLevel = 9999) {
  const active = db.get('SELECT * FROM tournament_events WHERE guild_id = ? AND status != \'COMPLETED\'', [guildId]);
  if (active) {
    throw new Error('Ada turnamen yang sedang berjalan di server ini! Harap batalkan terlebih dahulu sebelum memulai baru.');
  }

  const now = Math.floor(Date.now() / 1000);
  const endRegAt = now + (durationMins * 60);

  db.transaction(() => {
    // Bersihkan data lama
    db.run('DELETE FROM tournament_events WHERE guild_id = ?', [guildId]);
    db.run('DELETE FROM tournament_participants WHERE guild_id = ?', [guildId]);
    db.run('DELETE FROM tournament_matches WHERE guild_id = ?', [guildId]);

    // Insert event baru
    db.run(
      `INSERT INTO tournament_events (guild_id, status, admin_id, channel_id, registration_end_at, current_round, min_level, max_level, created_at)
       VALUES (?, 'REGISTERING', ?, ?, ?, 1, ?, ?, ?)`,
      [guildId, adminId, channelId, endRegAt, minLevel, maxLevel, now]
    );
  })();

  return {
    guildId,
    adminId,
    channelId,
    registrationEndAt: endRegAt,
    minLevel,
    maxLevel
  };
}

/**
 * Membatalkan turnamen aktif.
 */
function stopTournament(guildId) {
  const active = db.get('SELECT * FROM tournament_events WHERE guild_id = ?', [guildId]);
  if (!active) {
    throw new Error('Tidak ada turnamen aktif di server ini.');
  }

  db.transaction(() => {
    db.run('DELETE FROM tournament_events WHERE guild_id = ?', [guildId]);
    db.run('DELETE FROM tournament_participants WHERE guild_id = ?', [guildId]);
    db.run('DELETE FROM tournament_matches WHERE guild_id = ?', [guildId]);
  })();

  return active;
}

/**
 * Mendaftarkan pet user ke dalam turnamen.
 */
function registerParticipant(userId, guildId, petName) {
  const event = db.get('SELECT * FROM tournament_events WHERE guild_id = ? AND status = \'REGISTERING\'', [guildId]);
  if (!event) {
    throw new Error('Pendaftaran turnamen Admin Cup sedang tutup atau tidak aktif.');
  }

  const alreadyReg = db.get('SELECT * FROM tournament_participants WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
  if (alreadyReg) {
    throw new Error(`Anda sudah terdaftar di turnamen ini dengan pet **"${alreadyReg.pet_name}"**!`);
  }

  // Get active pet
  const userPet = pet.getPet(userId, guildId);
  if (!userPet) {
    throw new Error('Anda tidak memiliki hewan peliharaan aktif di server ini!');
  }

  // Validasi nama jika dispesifikasi, jika tidak gunakan pet aktif
  if (petName && userPet.pet_name.toLowerCase() !== petName.toLowerCase()) {
    throw new Error(`Pendaftaran gagal! Pet aktif Anda saat ini bernama **"${userPet.pet_name}"**, bukan "${petName}". Aktifkan terlebih dahulu pet tersebut jika ingin menggunakannya.`);
  }

  // Validasi Status & Kelayakan
  if (userPet.status === 'DEAD') {
    throw new Error('Hewan peliharaan Anda sudah meninggal 🪦! Sembuhkan/hidupkan kembali terlebih dahulu.');
  }
  if (userPet.status === 'EGG') {
    throw new Error('Pet Anda masih berupa telur 🥚! Tunggu menetas untuk mendaftar.');
  }
  if (userPet.level < 10) {
    throw new Error('Pet Anda masih bayi! Tingkat level minimal untuk bertanding adalah **Level 10**.');
  }

  // Level range validation
  if (userPet.level < event.min_level || userPet.level > event.max_level) {
    throw new Error(`Level pet Anda (Lv.${userPet.level}) tidak memenuhi kriteria level turnamen ini (${event.min_level} s/d ${event.max_level})!`);
  }

  // HP validation
  if (userPet.health < 50) {
    throw new Error(`Kondisi HP pet Anda terlalu lelah (HP ${userPet.health}%). Pulihkan HP pet minimal hingga **50%** sebelum mendaftar.`);
  }

  db.run(
    'INSERT INTO tournament_participants (guild_id, user_id, pet_name, status) VALUES (?, ?, ?, \'ACTIVE\')',
    [guildId, userId, userPet.pet_name]
  );

  return userPet;
}

/**
 * Menutup pendaftaran dan mengacak bagan tanding.
 */
async function closeRegistrationAndGenerateBracket(guildId, client) {
  const event = db.get('SELECT * FROM tournament_events WHERE guild_id = ? AND status = \'REGISTERING\'', [guildId]);
  if (!event) return;

  const channel = client.channels.cache.get(event.channel_id) || await client.channels.fetch(event.channel_id).catch(() => null);

  const participants = db.all('SELECT * FROM tournament_participants WHERE guild_id = ? AND status = \'ACTIVE\'', [guildId]);
  if (participants.length < 2) {
    db.run('DELETE FROM tournament_events WHERE guild_id = ?', [guildId]);
    db.run('DELETE FROM tournament_participants WHERE guild_id = ?', [guildId]);
    if (channel) {
      await channel.send('❌ **Turnamen Admin Cup dibatalkan** karena jumlah pendaftar kurang dari 2 orang.');
    }
    return;
  }

  // Update status ke PLAYING
  db.run('UPDATE tournament_events SET status = \'PLAYING\' WHERE guild_id = ?', [guildId]);

  // Acak pendaftar
  participants.sort(() => Math.random() - 0.5);

  const N = participants.length;
  // Cari pangkat 2 terkecil yang >= N (misal N=3, P=4; N=5, P=8)
  let P = 2;
  while (P < N) {
    P *= 2;
  }

  // Jumlah pertandingan di Ronde 1 = N - (P / 2) ?
  // Sebenarnya jika P = N, semua tanding. Jika P > N, ada BYE.
  // Jumlah pertandingan nyata = N - (P / 2)
  // Sisa pemain yang lolos otomatis (BYE) = P - N
  const numMatches = N - (P / 2);
  const numByes = P - N;

  db.transaction(() => {
    // 1. Buat match nyata untuk pemain pertama
    let playerIdx = 0;
    for (let i = 0; i < numMatches; i++) {
      const p1 = participants[playerIdx++];
      const p2 = participants[playerIdx++];
      db.run(
        `INSERT INTO tournament_matches (guild_id, round_number, player_1_id, player_2_id, match_status)
         VALUES (?, 1, ?, ?, 'PENDING')`,
        [guildId, p1.user_id, p2.user_id]
      );
    }

    // 2. Buat match BYE untuk sisa pemain agar lolos ke Ronde 2
    for (let i = 0; i < numByes; i++) {
      const p = participants[playerIdx++];
      db.run(
        `INSERT INTO tournament_matches (guild_id, round_number, player_1_id, player_2_id, winner_id, match_status)
         VALUES (?, 1, ?, NULL, ?, 'COMPLETED')`,
        [guildId, p.user_id, p.user_id]
      );
    }
  })();

  if (channel) {
    const bracketEmbed = new EmbedBuilder()
      .setColor(0x7C4DFF)
      .setTitle('📊 BAGAN PERTANDINGAN — ADMIN CUP 📊')
      .setDescription(
        `Pendaftaran telah ditutup otomatis! Sebanyak **${N} pet** telah diacak masuk ke dalam bagan turnamen.\n\n` +
        `**Pertandingan Babak Pertama (Round 1):**\n` +
        db.all('SELECT * FROM tournament_matches WHERE guild_id = ? AND round_number = 1', [guildId])
          .map((m, idx) => {
            if (m.player_2_id) {
              const p1Pet = db.get('SELECT pet_name FROM tournament_participants WHERE guild_id = ? AND user_id = ?', [guildId, m.player_1_id]);
              const p2Pet = db.get('SELECT pet_name FROM tournament_participants WHERE guild_id = ? AND user_id = ?', [guildId, m.player_2_id]);
              return `• **Match ${idx + 1}:** ${p1Pet.pet_name} (<@${m.player_1_id}>) vs ${p2Pet.pet_name} (<@${m.player_2_id}>)`;
            } else {
              const p1Pet = db.get('SELECT pet_name FROM tournament_participants WHERE guild_id = ? AND user_id = ?', [guildId, m.player_1_id]);
              return `• **Match ${idx + 1}:** ${p1Pet.pet_name} (<@${m.player_1_id}>) mendapatkan **[ BYE ]** (Lolos otomatis)`;
            }
          }).join('\n') +
        `\n\n📢 *Semua pertandingan akan dijalankan berurutan satu per satu. Bersiaplah!*`
      )
      .setFooter({ text: 'Admin Cup • Tournament Bracket' })
      .setTimestamp();

    await channel.send({ embeds: [bracketEmbed] });
  }

  // Mulai pertandingan pertama
  setTimeout(() => {
    executeNextMatch(guildId, client);
  }, 5000);
}

/**
 * Menjalankan pertandingan berikutnya yang PENDING.
 */
async function executeNextMatch(guildId, client) {
  const event = db.get('SELECT * FROM tournament_events WHERE guild_id = ? AND status = \'PLAYING\'', [guildId]);
  if (!event) return;

  const channel = client.channels.cache.get(event.channel_id) || await client.channels.fetch(event.channel_id).catch(() => null);
  if (!channel) return;

  // Cari match pending pada ronde aktif
  const match = db.get(
    'SELECT * FROM tournament_matches WHERE guild_id = ? AND round_number = ? AND match_status = \'PENDING\' LIMIT 1',
    [guildId, event.current_round]
  );

  if (match) {
    // Set match aktif
    db.run('UPDATE tournament_matches SET match_status = \'ACTIVE\' WHERE match_id = ?', [match.match_id]);

    // Fetch data pet
    const p1Pet = pet.getPet(match.player_1_id, guildId);
    const p2Pet = pet.getPet(match.player_2_id, guildId);

    // Ambil data user Discord untuk display name
    const member1 = await channel.guild.members.fetch(match.player_1_id).catch(() => null);
    const member2 = await channel.guild.members.fetch(match.player_2_id).catch(() => null);

    const p1Name = member1 ? member1.user.username : 'Pemain 1';
    const p2Name = member2 ? member2.user.username : 'Pemain 2';

    // Buat public thread
    const thread = await channel.threads.create({
      name: `🏆 Admin Cup: ${p1Pet.pet_name} vs ${p2Pet.pet_name}`,
      autoArchiveDuration: 60,
      type: ChannelType.PublicThread,
      reason: 'Admin Cup Match Arena'
    }).catch(async (err) => {
      console.error('Gagal membuat thread turnamen:', err);
      // Fallback: kirim ke channel utama jika gagal membuat thread
      return channel;
    });

    await thread.send(`⚔️ **Pertandingan Dimulai!** <@${match.player_1_id}> vs <@${match.player_2_id}>\nSilakan bertarung di sini!`).catch(() => {});

    // Inisialisasi status tempur di memori
    client.activeCupMatches = client.activeCupMatches || new Map();

    const maxHp1 = pet.getMaxHP(p1Pet);
    const maxHp2 = pet.getMaxHP(p2Pet);

    // Siapkan object tempur
    const combatData = {
      matchId: match.match_id,
      guildId,
      roundNumber: event.current_round,
      threadId: thread.id,
      turnCount: 1,
      logs: [`⚔️ Pertandingan babak ke-${event.current_round} antara **${p1Pet.pet_name}** dan **${p2Pet.pet_name}** dimulai!`],
      player1: {
        user_id: match.player_1_id,
        username: p1Name,
        pet_name: p1Pet.pet_name,
        pet_type: p1Pet.pet_type,
        level: p1Pet.level,
        trait: p1Pet.trait,
        gacha_trait2: p1Pet.gacha_trait2,
        gacha_element: p1Pet.gacha_element || 'EARTH',
        stat_str: p1Pet.stat_str || 0,
        stat_def: p1Pet.stat_def || 0,
        stat_dex: p1Pet.stat_dex || 0,
        maxHP: maxHp1,
        hp: maxHp1,
        energy: 30,
        timeouts: 0,
        elemCooldown: 0,
        hasUsedUltimate: false,
        isDefending: false,
        burnTurns: 0,
        shieldTurns: 0
      },
      player2: {
        user_id: match.player_2_id,
        username: p2Name,
        pet_name: p2Pet.pet_name,
        pet_type: p2Pet.pet_type,
        level: p2Pet.level,
        trait: p2Pet.trait,
        gacha_trait2: p2Pet.gacha_trait2,
        gacha_element: p2Pet.gacha_element || 'EARTH',
        stat_str: p2Pet.stat_str || 0,
        stat_def: p2Pet.stat_def || 0,
        stat_dex: p2Pet.stat_dex || 0,
        maxHP: maxHp2,
        hp: maxHp2,
        energy: 30,
        timeouts: 0,
        elemCooldown: 0,
        hasUsedUltimate: false,
        isDefending: false,
        burnTurns: 0,
        shieldTurns: 0
      }
    };

    // Giliran pertama berdasarkan DEX
    const dex1 = combatData.player1.stat_dex;
    const dex2 = combatData.player2.stat_dex;
    combatData.activePlayer = dex1 >= dex2 ? combatData.player1 : combatData.player2;

    client.activeCupMatches.set(match.match_id, combatData);

    // Kirim embed tempur pertama
    const combatMsg = await thread.send(getBattleEmbedData(combatData)).catch(() => null);
    if (combatMsg) {
      combatData.messageId = combatMsg.id;
    }

    // Set timer timeout 45 detik
    startTurnTimer(match.match_id, client);

  } else {
    // Seluruh match di ronde ini sudah selesai!
    // Ambil pemenang babak ini
    const activeParticipants = db.all('SELECT * FROM tournament_participants WHERE guild_id = ? AND status = \'ACTIVE\'', [guildId]);
    
    // Check match winners yang selesai di ronde aktif
    const roundMatches = db.all('SELECT * FROM tournament_matches WHERE guild_id = ? AND round_number = ?', [guildId, event.current_round]);
    const allCompleted = roundMatches.every(m => m.match_status === 'COMPLETED' || m.match_status === 'FORFEITED');

    if (!allCompleted) {
      // Tunggu match aktif lain jika ada (harusnya sequential tidak kena ini, tapi aman untuk safety check)
      return;
    }

    // Ambil pemenang ronde ini dari database
    const winners = roundMatches.map(m => m.winner_id).filter(id => id !== null);

    if (winners.length === 1) {
      // HANYA 1 PEMENANG TERSISA = JUARA UTAMA!
      const championId = winners[0];
      const runnerUpMatch = db.get(
        'SELECT player_1_id, player_2_id, winner_id FROM tournament_matches WHERE guild_id = ? AND round_number = ? AND (player_1_id = ? OR player_2_id = ?)',
        [guildId, event.current_round, championId, championId]
      );
      
      let runnerUpId = null;
      if (runnerUpMatch) {
        runnerUpId = runnerUpMatch.player_1_id === championId ? runnerUpMatch.player_2_id : runnerUpMatch.player_1_id;
      }

      await endTournament(guildId, championId, runnerUpId, client);
    } else if (winners.length === 0) {
      // Keadaan aneh di mana tidak ada pemenang
      db.run('DELETE FROM tournament_events WHERE guild_id = ?', [guildId]);
      await channel.send('❌ **Turnamen dibatalkan** karena terjadi error status (tidak ditemukan pemenang).');
    } else {
      // Ada beberapa pemenang, susun babak berikutnya
      const nextRound = event.current_round + 1;

      db.transaction(() => {
        // Pairing winners
        let idx = 0;
        const totalW = winners.length;
        // Check power of 2
        let P = 2;
        while (P < totalW) {
          P *= 2;
        }

        const numMatches = totalW - (P / 2);
        const numByes = P - totalW;

        for (let i = 0; i < numMatches; i++) {
          const p1 = winners[idx++];
          const p2 = winners[idx++];
          db.run(
            `INSERT INTO tournament_matches (guild_id, round_number, player_1_id, player_2_id, match_status)
             VALUES (?, ?, ?, ?, 'PENDING')`,
            [guildId, nextRound, p1, p2]
          );
        }

        for (let i = 0; i < numByes; i++) {
          const p = winners[idx++];
          db.run(
            `INSERT INTO tournament_matches (guild_id, round_number, player_1_id, player_2_id, winner_id, match_status)
             VALUES (?, ?, ?, NULL, ?, 'COMPLETED')`,
            [guildId, nextRound, p, p]
          );
        }

        // Naikkan ronde turnamen
        db.run('UPDATE tournament_events SET current_round = ? WHERE guild_id = ?', [nextRound, guildId]);
      })();

      // Beritahu bagan baru
      const roundNames = ['QUARTER-FINALS', 'SEMI-FINALS', 'FINALS'];
      const roundLabel = nextRound === event.current_round + 1 && winners.length === 2 ? '🏆 GRAND FINALS 🏆' : `ROUND ${nextRound}`;
      
      const newBracketEmbed = new EmbedBuilder()
        .setColor(0x7C4DFF)
        .setTitle(`📊 BAGAN PERTANDINGAN — ${roundLabel} 📊`)
        .setDescription(
          `Babak **Ronde ${event.current_round}** selesai!\n` +
          `Berikut adalah daftar pertandingan untuk babak selanjutnya:\n\n` +
          db.all('SELECT * FROM tournament_matches WHERE guild_id = ? AND round_number = ?', [guildId, nextRound])
            .map((m, idx) => {
              if (m.player_2_id) {
                const p1Pet = db.get('SELECT pet_name FROM tournament_participants WHERE guild_id = ? AND user_id = ?', [guildId, m.player_1_id]);
                const p2Pet = db.get('SELECT pet_name FROM tournament_participants WHERE guild_id = ? AND user_id = ?', [guildId, m.player_2_id]);
                return `• **Match ${idx + 1}:** ${p1Pet.pet_name} (<@${m.player_1_id}>) vs ${p2Pet.pet_name} (<@${m.player_2_id}>)`;
              } else {
                const p1Pet = db.get('SELECT pet_name FROM tournament_participants WHERE guild_id = ? AND user_id = ?', [guildId, m.player_1_id]);
                return `• **Match ${idx + 1}:** ${p1Pet.pet_name} (<@${m.player_1_id}>) mendapatkan **[ BYE ]** (Lolos otomatis)`;
              }
            }).join('\n') +
          `\n\n⏱️ *Pertandingan pertama ronde baru dimulai dalam 1 menit (Jeda Istirahat).*`
        )
        .setFooter({ text: 'Admin Cup • Tournament Seeding' })
        .setTimestamp();

      await channel.send({ embeds: [newBracketEmbed] });

      // Jalankan pertandingan setelah 60 detik jeda
      setTimeout(() => {
        executeNextMatch(guildId, client);
      }, 60000);
    }
  }
}

/**
 * Membuat timer untuk turn timeout 45 detik.
 */
function startTurnTimer(matchId, client) {
  const match = client.activeCupMatches.get(matchId);
  if (!match) return;

  match.timer = setTimeout(() => {
    handleTimeout(matchId, match.activePlayer.user_id, client);
  }, 45000);
}

/**
 * Menangani timeout ketika player tidak klik tombol dalam 45 detik.
 */
async function handleTimeout(matchId, activePlayerId, client) {
  const match = client.activeCupMatches.get(matchId);
  if (!match) return;

  match.activePlayer.timeouts++;

  if (match.activePlayer.timeouts === 1) {
    // Timeout pertama: Auto Attack
    match.logs.push(`⚠️ **Batas Waktu Habis!** **${match.activePlayer.pet_name}** lambat bertindak! Bot mengambil keputusan otomatis untuk meluncurkan serangan biasa.`);
    try {
      processTurn(matchId, activePlayerId, 'atk', client);
    } catch (e) {
      console.error('Error auto-turn timeout:', e.message);
    }
  } else if (match.activePlayer.timeouts >= 2) {
    // Timeout kedua: Forfeit!
    const defender = match.activePlayer === match.player1 ? match.player2 : match.player1;
    match.logs.push(`🚨 **Batas Waktu Habis Lagi!** **${match.activePlayer.pet_name}** tidak aktif (AFK) sebanyak 2 kali berturut-turut. Pertandingan dibatalkan dengan status **FORFEIT**.`);
    
    await endMatch(matchId, defender.user_id, 'forfeit', client);
  }
}

/**
 * Memproses aksi tempur interaktif dari pemain.
 */
function processTurn(matchId, playerId, actionType, client) {
  const match = client.activeCupMatches.get(matchId);
  if (!match) return;

  // Proteksi turn
  if (match.activePlayer.user_id !== playerId) {
    throw new Error('Bukan giliran Anda!');
  }

  // Clear timeout active
  if (match.timer) {
    clearTimeout(match.timer);
    match.timer = null;
  }

  // Reset timeout counter untuk pemain aktif
  match.activePlayer.timeouts = 0;

  const attacker = match.activePlayer;
  const defender = match.activePlayer === match.player1 ? match.player2 : match.player1;

  // Bersihkan defending stance penyerang saat gilirannya menyerang
  attacker.isDefending = false;

  let damage = 0;
  let logMsg = '';
  let isCrit = false;
  let isDodged = false;

  // ── ATK & DEF VALUES ──
  const attackerSpecies = pet.GACHA_SPECIES[attacker.pet_type];
  const attackerSpecBaseAtk = attackerSpecies ? (attackerSpecies.baseAtk || 10) : 10;
  let attackerATK = attackerSpecBaseAtk + attacker.level * 5 + (attacker.stat_str || 0) * 2;
  if (pet.isGodPet(attacker)) attackerATK *= 3; // Immortal: 3x ATK

  const defenderSpecies = pet.GACHA_SPECIES[defender.pet_type];
  const defenderSpecBaseDef = defenderSpecies ? (defenderSpecies.baseDef || 0) : 0;
  let defenderDEF = defenderSpecBaseDef + (defender.stat_def || 0) * 0.5;
  if (pet.isGodPet(defender)) defenderDEF += 50;

  // Attacker buffs (accessories/traits)
  let atkMultiplier = attacker.pet_type === 'DRAGON' ? 1.15 : 1.0;
  if (pet.petHasTrait(attacker, 'WARRIOR')) atkMultiplier += 0.15;
  atkMultiplier += (attacker.base_atk_bonus_pct || 0.0);

  // Defender buffs
  let defMultiplier = 1.0;
  if (pet.petHasTrait(defender, 'STURDY')) defMultiplier *= 0.85; // Sturdy: -15% damage
  
  // Dodge & Crit
  const baseDodgeChance = Math.min(0.35, (defender.stat_dex || 0) * 0.005);
  const dodgeChance = defender.isDefending ? baseDodgeChance + 0.20 : baseDodgeChance;
  const critChance = Math.min(0.35, (attacker.stat_dex || 0) * 0.005);

  // Cooldown decrement
  if (attacker.elemCooldown > 0) {
    attacker.elemCooldown--;
  }

  // ── PROSES AKSI ──
  if (actionType === 'atk') {
    isDodged = Math.random() < dodgeChance;
    if (isDodged) {
      logMsg = `💨 **${attacker.pet_name}** melancarkan cakar serangan, tetapi **${defender.pet_name}** berhasil menghindar dengan lincah!`;
    } else {
      isCrit = Math.random() < critChance;
      let rawDmg = Math.round(attackerATK * atkMultiplier * (0.8 + Math.random() * 0.4));
      if (isCrit) rawDmg = Math.round(rawDmg * 1.5);

      let defFactor = defenderDEF / 150;
      if (defFactor > 0.8) defFactor = 0.8;
      damage = Math.round(rawDmg * (1 - defFactor) * defMultiplier);
      if (defender.isDefending) damage = Math.round(damage * 0.5);
      if (damage < 1) damage = 1;

      if (defender.shieldTurns > 0) {
        damage = 0;
        logMsg = `🛡️ **${defender.pet_name}** dilindungi oleh **Perisai Kokoh**! Serangan diblokir sepenuhnya!`;
      } else {
        defender.hp = Math.max(0, defender.hp - damage);
        const critText = isCrit ? ' 💥 **CRITICAL STRIKE!**' : '';
        logMsg = `⚔️ **${attacker.pet_name}** menyerang **${defender.pet_name}** dan memberikan **${damage} DMG**!${critText}`;
      }
    }
    attacker.energy = Math.min(100, attacker.energy + 10);

  } else if (actionType === 'def') {
    attacker.isDefending = true;
    attacker.energy = Math.min(100, attacker.energy + 20);
    logMsg = `🛡️ **${attacker.pet_name}** memasang kuda-kuda bertahan! Damage yang diterima turn depan berkurang 50% & Dodge Chance +20%.`;

  } else if (actionType === 'elem') {
    if (attacker.energy < 20) throw new Error('Energi (SP) tidak cukup! Butuh 20 SP.');
    if (attacker.elemCooldown > 0) throw new Error(`Skill Elemen sedang cooldown! Tersisa ${attacker.elemCooldown} turn lagi.`);

    isDodged = Math.random() < (dodgeChance * 0.8);
    if (isDodged) {
      logMsg = `💨 **${attacker.pet_name}** meluncurkan skill elemennya, tetapi **${defender.pet_name}** berhasil menghindar!`;
    } else {
      isCrit = Math.random() < critChance;
      let rawDmg = Math.round(attackerATK * 1.5 * atkMultiplier * (0.8 + Math.random() * 0.4));
      if (isCrit) rawDmg = Math.round(rawDmg * 1.5);

      // Elem ignores 30% of defender's DEF
      const effDef = defenderDEF * 0.7;
      let defFactor = effDef / 150;
      if (defFactor > 0.8) defFactor = 0.8;
      damage = Math.round(rawDmg * (1 - defFactor) * defMultiplier);
      if (defender.isDefending) damage = Math.round(damage * 0.5);
      if (damage < 1) damage = 1;

      if (defender.shieldTurns > 0) {
        damage = 0;
        logMsg = `🛡️ **${defender.pet_name}** dilindungi oleh **Perisai Kokoh**! Skill Elemen diblokir!`;
      } else {
        defender.hp = Math.max(0, defender.hp - damage);
        const critText = isCrit ? ' 💥 **CRITICAL STRIKE!**' : '';
        const elemName = getElementalSkillName(attacker.gacha_element);
        logMsg = `⚡ **${attacker.pet_name}** melancarkan skill elemen **[${elemName}]** kepada **${defender.pet_name}** sebesar **${damage} DMG**!${critText}`;
      }
    }
    attacker.energy -= 20;
    attacker.elemCooldown = 3; // 1 giliran aktif + 2 cooldown

  } else if (actionType === 'ult') {
    if (attacker.energy < 50) throw new Error('Energi (SP) tidak cukup! Butuh 50 SP.');
    if (attacker.hasUsedUltimate) throw new Error('Ultimate Skill hanya dapat digunakan 1 kali per pertandingan!');

    isDodged = Math.random() < (dodgeChance * 0.5);
    if (isDodged) {
      logMsg = `💨 **${attacker.pet_name}** meluncurkan Jurus Pamungkas, tetapi meleset menghindari zirah **${defender.pet_name}**!`;
    } else {
      isCrit = Math.random() < (critChance * 1.2);
      let rawDmg = Math.round(attackerATK * 2.2 * atkMultiplier * (0.9 + Math.random() * 0.2));
      if (isCrit) rawDmg = Math.round(rawDmg * 1.5);

      let defFactor = defenderDEF / 150;
      if (defFactor > 0.8) defFactor = 0.8;
      damage = Math.round(rawDmg * (1 - defFactor) * defMultiplier);
      if (defender.isDefending) damage = Math.round(damage * 0.5);
      if (damage < 1) damage = 1;

      if (defender.shieldTurns > 0) {
        damage = 0;
        logMsg = `🛡️ **${defender.pet_name}** dilindungi oleh **Perisai Kokoh**! Jurus Ultimate diblokir!`;
      } else {
        defender.hp = Math.max(0, defender.hp - damage);
        const critText = isCrit ? ' 💥 **CRITICAL STRIKE!**' : '';
        const ultName = getUltimateName(attacker.gacha_element);
        
        let effectText = '';
        const elem = attacker.gacha_element ? attacker.gacha_element.toUpperCase() : 'EARTH';
        
        if (elem === 'FIRE') {
          defender.burnTurns = 3;
          effectText = `\n🔥 **${defender.pet_name}** terkena kutukan **TERBAKAR**! (-8 HP/turn untuk 3 turn).`;
        } else if (elem === 'WATER') {
          const heal = Math.round(attacker.maxHP * 0.35);
          attacker.hp = Math.min(attacker.maxHP, attacker.hp + heal);
          effectText = `\n🌀 **${attacker.pet_name}** memulihkan tubuhnya sebesar **+${heal} HP**!`;
        } else if (elem === 'EARTH') {
          attacker.shieldTurns = 2; // Kebal turn lawan depan
          effectText = `\n🛡️ **${attacker.pet_name}** melingkari dirinya dengan zirah **Perisai Kokoh** kebal kerusakan!`;
        } else if (elem === 'DRAGON') {
          defenderDEF = Math.round(defenderDEF * 0.5);
          effectText = `\n💥 Zirah pertahanan **${defender.pet_name}** pecah! DEF berkurang 50% untuk sisa laga turnamen!`;
        }

        logMsg = `💥 **${attacker.pet_name}** membangkitkan amarah **[${ultName}]** kepada **${defender.pet_name}** memberikan **${damage} DMG**!${critText}${effectText}`;
      }
    }
    attacker.energy -= 50;
    attacker.hasUsedUltimate = true;
  }

  match.logs.push(logMsg);

  if (defender.hp <= 0) {
    endMatch(matchId, attacker.user_id, 'defeat', client);
    return;
  }

  // Ganti giliran ke defender
  match.activePlayer = defender;
  match.turnCount++;

  // Dot Terbakar di awal turn
  if (match.activePlayer.burnTurns > 0) {
    const burnDmg = 8;
    match.activePlayer.hp = Math.max(1, match.activePlayer.hp - burnDmg); // Sisakan HP minimal 1
    match.logs.push(`🔥 **${match.activePlayer.pet_name}** menderita kerusakan terbakar bara **-${burnDmg} HP**!`);
    match.activePlayer.burnTurns--;
  }

  // Kurangi durasi perisai pelindung
  if (match.activePlayer.shieldTurns > 0) {
    match.activePlayer.shieldTurns--;
  }

  if (match.activePlayer.hp <= 0) {
    // Mati akibat burn dot
    endMatch(matchId, attacker.user_id, 'defeat', client);
    return;
  }

  // Update Tampilan & Restart Timer 45s
  updateBattleEmbed(matchId, client);
  startTurnTimer(matchId, client);
}

/**
 * Menutup pertandingan saat selesai.
 */
async function endMatch(matchId, winnerId, reason, client) {
  const match = client.activeCupMatches.get(matchId);
  if (!match) return;

  // Bersihkan timer
  if (match.timer) {
    clearTimeout(match.timer);
    match.timer = null;
  }

  const winner = match.player1.user_id === winnerId ? match.player1 : match.player2;
  const loser = match.player1.user_id === winnerId ? match.player2 : match.player1;

  db.transaction(() => {
    // Tandai pemenang dan selesaikan match
    db.run(
      'UPDATE tournament_matches SET winner_id = ?, match_status = \'COMPLETED\' WHERE match_id = ?',
      [winnerId, matchId]
    );

    // Eliminasi pecundang dari pendaftar aktif
    db.run(
      'UPDATE tournament_participants SET status = \'ELIMINATED\' WHERE guild_id = ? AND user_id = ?',
      [match.guildId, loser.user_id]
    );
  })();

  const threadChannel = client.channels.cache.get(match.threadId) || await client.channels.fetch(match.threadId).catch(() => null);
  if (threadChannel) {
    const victoryEmbed = new EmbedBuilder()
      .setColor(0x10B981)
      .setTitle('🏆 PERTANDINGAN SELESAI! 🏆')
      .setDescription(
        `🎉 Selamat kepada **${winner.pet_name}** (<@${winner.user_id}>) yang berhasil memenangkan pertandingan!\n\n` +
        `💀 **Status Pecundang:** Pet **${loser.pet_name}** (<@${loser.user_id}>) tereliminasi dari turnamen.\n` +
        `💡 *Status HP dan kebahagiaan pet kedua pemain telah dipulihkan 100% seperti semula.*`
      )
      .setTimestamp();

    await threadChannel.send({ embeds: [victoryEmbed] });

    // Lock thread agar bersih
    if (threadChannel.isThread && threadChannel.setLocked) {
      await threadChannel.setLocked(true).catch(() => {});
      await threadChannel.setArchived(true).catch(() => {});
    }
  }

  // Hapus dari map memori
  client.activeCupMatches.delete(matchId);

  // Jadwalkan pertandingan berikutnya
  setTimeout(() => {
    executeNextMatch(match.guildId, client);
  }, 10000);
}

/**
 * Mengakhiri turnamen dan mengumumkan sang juara.
 */
async function endTournament(guildId, championId, runnerUpId, client) {
  const event = db.get('SELECT * FROM tournament_events WHERE guild_id = ?', [guildId]);
  if (!event) return;

  const channel = client.channels.cache.get(event.channel_id) || await client.channels.fetch(event.channel_id).catch(() => null);
  const champPet = db.get('SELECT pet_name FROM tournament_participants WHERE guild_id = ? AND user_id = ?', [guildId, championId]);
  const runnerPet = runnerUpId ? db.get('SELECT pet_name FROM tournament_participants WHERE guild_id = ? AND user_id = ?', [guildId, runnerUpId]) : null;

  if (channel) {
    const celebrationEmbed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('👑 CHAMPION OF ADMIN CUP 👑')
      .setDescription(
        `🏆 **Turnamen Admin Cup Resmi Berakhir!** 🏆\n\n` +
        `🥇 **JUARA 1:** **${champPet.pet_name}** (<@${championId}>)\n` +
        (runnerPet ? `🥈 **JUARA 2:** **${runnerPet.pet_name}** (<@${runnerUpId}>)\n\n` : '\n') +
        `🎉 Selamat kepada sang juara! Terima kasih kepada seluruh pet dan pawang yang telah berpartisipasi dengan luar biasa!\n\n` +
        `📢 <@${event.admin_id}> (Administrator) dipersilakan untuk memberikan hadiah turnamen secara manual kepada para pemenang!`
      )
      .setFooter({ text: 'Admin Cup • Tournament Completed' })
      .setTimestamp();

    await channel.send({ embeds: [celebrationEmbed] });

    // Alert admin via DM jika memungkinkan
    const adminUser = client.users.cache.get(event.admin_id) || await client.users.fetch(event.admin_id).catch(() => null);
    if (adminUser) {
      await adminUser.send(
        `🏆 **Turnamen Admin Cup di server Anda telah selesai!**\n\n` +
        `• Pemenang Juara 1: <@${championId}> (Pet: **${champPet.pet_name}**)\n` +
        (runnerUpId ? `• Juara 2: <@${runnerUpId}> (Pet: **${runnerPet.pet_name}**)\n` : '') +
        `Silakan berikan koin, item, role, atau pet kustom kepada mereka sebagai hadiah!`
      ).catch(() => {});
    }
  }

  // Bersihkan data event di database
  db.transaction(() => {
    db.run('DELETE FROM tournament_events WHERE guild_id = ?', [guildId]);
    db.run('DELETE FROM tournament_participants WHERE guild_id = ?', [guildId]);
    db.run('DELETE FROM tournament_matches WHERE guild_id = ?', [guildId]);
  })();
}

/**
 * Helper untuk membuat struktur Embed dan Komponen Tombol Pertempuran.
 */
function getBattleEmbedData(match) {
  const p1 = match.player1;
  const p2 = match.player2;
  const active = match.activePlayer;

  const barSize = 10;
  const renderHPBar = (hp, max) => {
    const ratio = Math.max(0, Math.min(1, hp / max));
    const filled = Math.round(ratio * barSize);
    return '🟩'.repeat(filled) + '🟥'.repeat(barSize - filled);
  };

  const renderSPBar = (energy) => {
    const ratio = Math.max(0, Math.min(1, energy / 100));
    const filled = Math.round(ratio * 5);
    return '⚡'.repeat(filled) + '░'.repeat(5 - filled);
  };

  // Embed premium layout
  const embed = new EmbedBuilder()
    .setColor(active.user_id === p1.user_id ? 0xFF5722 : 0x00E5FF)
    .setTitle(`⚔️ ARENA ADMIN CUP — MATCH #${match.matchId} ⚔️`)
    .setDescription(
      `🔴 **[Challenger] ${p1.pet_name}** (Lv.${p1.level})\n` +
      `HP: \`[${renderHPBar(p1.hp, p1.maxHP)}]\` \`${p1.hp}/${p1.maxHP} (${Math.round((p1.hp / p1.maxHP) * 100)}%)\`\n` +
      `SP: \`[${renderSPBar(p1.energy)}]\` \`${p1.energy}/100 Energy\`\n` +
      `Status: ${p1.burnTurns > 0 ? '🔥 TERBAKAR' : p1.shieldTurns > 0 ? '🛡️ PERISAI KOKOH' : p1.isDefending ? '🛡️ BERTAHAN' : 'Normal'}\n\n` +
      
      `🔵 **[Opponent] ${p2.pet_name}** (Lv.${p2.level})\n` +
      `HP: \`[${renderHPBar(p2.hp, p2.maxHP)}]\` \`${p2.hp}/${p2.maxHP} (${Math.round((p2.hp / p2.maxHP) * 100)}%)\`\n` +
      `SP: \`[${renderSPBar(p2.energy)}]\` \`${p2.energy}/100 Energy\`\n` +
      `Status: ${p2.burnTurns > 0 ? '🔥 TERBAKAR' : p2.shieldTurns > 0 ? '🛡️ PERISAI KOKOH' : p2.isDefending ? '🛡️ BERTAHAN' : 'Normal'}\n\n` +
      
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📜 **Log Jalannya Duel:**\n` +
      match.logs.slice(-3).map(l => `• ${l}`).join('\n') + `\n\n` +
      `👉 Giliran sekarang: **${active.pet_name}** (<@${active.user_id}>)\n` +
      `⏱️ *Batas waktu memilih aksi: 45 detik!*`
    )
    .setFooter({ text: `Turn ${match.turnCount} • Admin Cup` })
    .setTimestamp();

  // Aksi Button
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`cup_btn_atk_${match.matchId}`)
      .setLabel('⚔️ Serang')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`cup_btn_def_${match.matchId}`)
      .setLabel('🛡️ Bertahan')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`cup_btn_elem_${match.matchId}`)
      .setLabel('⚡ Elemen')
      .setStyle(ButtonStyle.Success)
      .setDisabled(active.energy < 20 || active.elemCooldown > 0),
    new ButtonBuilder()
      .setCustomId(`cup_btn_ult_${match.matchId}`)
      .setLabel('💥 Ultimate')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(active.energy < 50 || active.hasUsedUltimate)
  );

  return { embeds: [embed], components: [row] };
}

/**
 * Memperbarui embed pertempuran di Discord thread.
 */
async function updateBattleEmbed(matchId, client) {
  const match = client.activeCupMatches.get(matchId);
  if (!match) return;

  const threadChannel = client.channels.cache.get(match.threadId) || await client.channels.fetch(match.threadId).catch(() => null);
  if (threadChannel && match.messageId) {
    const msg = await threadChannel.messages.fetch(match.messageId).catch(() => null);
    if (msg) {
      const data = getBattleEmbedData(match);
      await msg.edit(data).catch(() => {});
    }
  }
}

module.exports = {
  startTournament,
  stopTournament,
  registerParticipant,
  closeRegistrationAndGenerateBracket,
  executeNextMatch,
  processTurn,
  endMatch,
  endTournament
};
