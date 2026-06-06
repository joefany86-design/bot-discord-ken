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
function startTournament(adminId, guildId, channelId, durationMins = 30, minLevel = 10, maxLevel = 9999, rewardDesc = null) {
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
      `INSERT INTO tournament_events (guild_id, status, admin_id, channel_id, registration_end_at, current_round, min_level, max_level, created_at, reward_desc)
       VALUES (?, 'REGISTERING', ?, ?, ?, 1, ?, ?, ?, ?)`,
      [guildId, adminId, channelId, endRegAt, minLevel, maxLevel, now, rewardDesc]
    );
  })();

  return {
    guildId,
    adminId,
    channelId,
    registrationEndAt: endRegAt,
    minLevel,
    maxLevel,
    rewardDesc
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
 * Mendapatkan pet yang didaftarkan user dalam turnamen ini.
 * Mengembalikan data pet (dengan decay ter-update) berdasarkan namanya.
 */
function getRegisteredPet(userId, guildId) {
  const participant = db.get('SELECT pet_name FROM tournament_participants WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
  const pets = pet.getPetsList(userId, guildId);
  if (participant) {
    const found = pets.find(p => p.pet_name.toLowerCase() === participant.pet_name.toLowerCase());
    if (found) return found;
  }
  // Fallback ke pet aktif jika tidak ditemukan
  return pet.getPet(userId, guildId);
}

/**
 * Mendaftarkan pet user ke dalam turnamen.
 * Kompatibel dengan versi lama.
 */
function registerParticipant(userId, guildId, petName) {
  if (!petName || petName.trim() === '') {
    const userPet = pet.getPet(userId, guildId);
    if (!userPet) {
      throw new Error('Anda tidak memiliki hewan peliharaan aktif di server ini!');
    }
    petName = userPet.pet_name;
  }
  return registerOrUpdateParticipant(userId, guildId, petName);
}

/**
 * Mendaftarkan atau memperbarui pet yang didaftarkan user ke turnamen.
 */
function registerOrUpdateParticipant(userId, guildId, petName) {
  const event = db.get('SELECT * FROM tournament_events WHERE guild_id = ? AND status = \'REGISTERING\'', [guildId]);
  if (!event) {
    throw new Error('Pendaftaran turnamen Admin Cup sedang tutup atau tidak aktif.');
  }

  if (!petName || typeof petName !== 'string' || petName.trim() === '') {
    throw new Error('Harap tentukan nama pet yang ingin didaftarkan.');
  }

  // Dapatkan semua pet milik user dengan decay
  const userPets = pet.getPetsList(userId, guildId);
  const targetPet = userPets.find(p => p.pet_name.toLowerCase() === petName.trim().toLowerCase());
  if (!targetPet) {
    throw new Error(`Pet dengan nama "${petName}" tidak ditemukan di kandang Anda!`);
  }

  // Validasi Status & Kelayakan
  if (targetPet.status === 'DEAD') {
    throw new Error('Hewan peliharaan Anda sudah meninggal 🪦! Sembuhkan/hidupkan kembali terlebih dahulu.');
  }
  if (targetPet.status === 'EGG') {
    throw new Error('Pet Anda masih berupa telur 🥚! Tunggu menetas untuk mendaftar.');
  }
  if (targetPet.level < 10) {
    throw new Error('Pet Anda masih bayi! Tingkat level minimal untuk bertanding adalah **Level 10**.');
  }

  // Level range validation
  if (targetPet.level < event.min_level || targetPet.level > event.max_level) {
    throw new Error(`Level pet Anda (Lv.${targetPet.level}) tidak memenuhi kriteria level turnamen ini (${event.min_level} s/d ${event.max_level})!`);
  }

  // HP validation
  if (targetPet.health < 50) {
    throw new Error(`Kondisi HP pet Anda terlalu lelah (HP ${targetPet.health}%). Pulihkan HP pet minimal hingga **50%** sebelum mendaftar.`);
  }

  db.transaction(() => {
    // Hapus pendaftaran lama jika ada
    db.run('DELETE FROM tournament_participants WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
    // Masukkan pendaftaran baru
    db.run(
      'INSERT INTO tournament_participants (guild_id, user_id, pet_name, status) VALUES (?, ?, ?, \'ACTIVE\')',
      [guildId, userId, targetPet.pet_name]
    );
  })();

  return targetPet;
}

/**
 * Mengeluarkan pendaftaran user dari turnamen.
 */
function unregisterParticipant(userId, guildId) {
  const event = db.get('SELECT * FROM tournament_events WHERE guild_id = ? AND status = \'REGISTERING\'', [guildId]);
  if (!event) {
    throw new Error('Pendaftaran turnamen Admin Cup sedang tutup atau tidak aktif.');
  }

  const alreadyReg = db.get('SELECT * FROM tournament_participants WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
  if (!alreadyReg) {
    throw new Error('Anda belum terdaftar dalam turnamen ini!');
  }

  db.run('DELETE FROM tournament_participants WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
  return alreadyReg;
}

/**
 * Menyimpan ID pesan pengumuman turnamen ke database.
 */
function saveAnnounceMessageId(guildId, messageId) {
  db.run('UPDATE tournament_events SET announce_message_id = ? WHERE guild_id = ?', [messageId, guildId]);
}

/**
 * Memperbarui embed pengumuman registrasi dengan daftar peserta terbaru (live update).
 */
async function updateRegistrationEmbed(guildId, client) {
  const event = db.get('SELECT * FROM tournament_events WHERE guild_id = ? AND status = \'REGISTERING\'', [guildId]);
  if (!event || !event.announce_message_id) return;

  const channel = client.channels.cache.get(event.channel_id) || await client.channels.fetch(event.channel_id).catch(() => null);
  if (!channel) return;

  const participants = db.all('SELECT * FROM tournament_participants WHERE guild_id = ? AND status = \'ACTIVE\'', [guildId]);

  let participantList = '';
  if (participants.length === 0) {
    participantList = '*Belum ada peserta yang mendaftar.*';
  } else {
    participantList = participants.map((p, idx) => {
      const userPet = getRegisteredPet(p.user_id, guildId);
      const level = userPet ? userPet.level : '?';
      const petEmoji = userPet ? (pet.GACHA_SPECIES[userPet.pet_type]?.emoji || '\uD83D\uDC3E') : '\uD83D\uDC3E';
      return `**${idx + 1}.** ${petEmoji} ${p.pet_name} (Lv.${level}) \u2014 <@${p.user_id}>`;
    }).join('\n');
  }

  const endRegAt = event.registration_end_at;

  const announceEmbed = new EmbedBuilder()
    .setColor(0x4F46E5) // Premium Indigo
    .setTitle('🏆 LIGA PET — ADMIN CUP 🏆')
    .setDescription(
      `📢 **Pendaftaran Liga PvP Pet telah dibuka oleh Administrator!**\n` +
      `Siapkan pet terkuat Anda untuk bertarung di liga dan merebut takhta juara server!\n\n` +
      `▬`.repeat(15)
    )
    .addFields(
      { name: '⏱️ Batas Waktu Pendaftaran', value: `<t:${endRegAt}:R> (<t:${endRegAt}:T>)`, inline: true },
      { name: '📈 Kriteria Level Pet', value: `Level **${event.min_level}** s/d **${event.max_level}**`, inline: true },
      { name: '🎁 Hadiah Liga', value: event.reward_desc ? `**${event.reward_desc}**` : `*Akan diberikan secara manual oleh Admin setelah liga selesai.*`, inline: false },
      { name: `👥 Peserta Terdaftar (${participants.length})`, value: participantList, inline: false }
    )
    .setFooter({ text: 'Pet PvP League • Registration Phase' })
    .setTimestamp();

  try {
    const msg = await channel.messages.fetch(event.announce_message_id).catch(() => null);
    if (msg) {
      await msg.edit({ embeds: [announceEmbed] }).catch(() => {});
    }
  } catch (e) {}
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
      await channel.send('❌ **Liga Pet dibatalkan** karena jumlah pendaftar kurang dari 2 orang.');
    }
    return;
  }

  // Update status ke PLAYING
  db.run('UPDATE tournament_events SET status = \'PLAYING\' WHERE guild_id = ?', [guildId]);

  // Acak pendaftar
  participants.sort(() => Math.random() - 0.5);

  const N = participants.length;
  const userIds = participants.map(p => p.user_id);

  db.transaction(() => {
    const matches = generateRoundRobinMatches(userIds);
    for (const m of matches) {
      if (m.winner) {
        db.run(
          `INSERT INTO tournament_matches (guild_id, round_number, player_1_id, player_2_id, winner_id, match_status)
           VALUES (?, ?, ?, NULL, ?, 'COMPLETED')`,
          [guildId, m.round, m.p1 || m.p2, m.winner]
        );
      } else {
        db.run(
          `INSERT INTO tournament_matches (guild_id, round_number, player_1_id, player_2_id, match_status)
           VALUES (?, ?, ?, ?, 'PENDING')`,
          [guildId, m.round, m.p1, m.p2]
        );
      }
    }
  })();

  if (channel) {
    const standingsText = getLeagueStandingsString(guildId);
    const queueText = getMatchQueueString(guildId);

    const bracketEmbed = new EmbedBuilder()
      .setColor(0x6366F1)
      .setTitle('📊 LIGA PET — JADWAL & KLASEMEN AWAL 📊')
      .setDescription(
        `Pendaftaran telah ditutup! Sebanyak **${N} pet** siap bersaing di liga dan saling berhadapan.\n` +
        `▬`.repeat(15)
      )
      .addFields(
        { name: '🏆 Klasemen Awal (Standings)', value: `\`\`\`text\n${standingsText}\n\`\`\``, inline: false },
        { name: '📋 Jadwal & Antrean Match (Queue)', value: queueText || '*Tidak ada antrean.*', inline: false }
      )
      .setFooter({ text: 'Pet PvP League • Round Robin Seeding' })
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

  if (event.is_paused === 1) {
    console.log(`[Tournament] Tournament in guild ${guildId} is paused. Skipping execution.`);
    return;
  }

  const channel = client.channels.cache.get(event.channel_id) || await client.channels.fetch(event.channel_id).catch(() => null);
  if (!channel) return;

  // Cari match pending pada ronde aktif
  const match = db.get(
    'SELECT * FROM tournament_matches WHERE guild_id = ? AND round_number = ? AND match_status = \'PENDING\' LIMIT 1',
    [guildId, event.current_round]
  );

  if (match) {
    // Fetch data pet
    const p1Pet = getRegisteredPet(match.player_1_id, guildId);
    const p2Pet = getRegisteredPet(match.player_2_id, guildId);

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

    // Set match aktif dan simpan thread_id
    db.run(
      'UPDATE tournament_matches SET match_status = \'ACTIVE\', thread_id = ? WHERE match_id = ?',
      [thread.id, match.match_id]
    );

    await thread.send(`⚔️ **Pertandingan Dimulai!** <@${match.player_1_id}> vs <@${match.player_2_id}>\nSilakan bertarung di sini!`).catch(() => {});

    // Kirim pengumuman di channel utama turnamen tanpa ping spam
    if (thread.id !== channel.id) {
      const matchAnnounce = new EmbedBuilder()
        .setColor(0xEF4444) // Premium Red
        .setTitle('⚔️ PERTANDINGAN DIMULAI! ⚔️')
        .setDescription(
          `Pertandingan liga baru saja dimulai! Ayo saksikan keseruannya di arena khusus!\n` +
          `▬`.repeat(15)
        )
        .addFields(
          { name: '🔴 Challenger', value: `🐾 **${p1Pet.pet_name}** (<@${match.player_1_id}>)`, inline: true },
          { name: '🔵 Opponent', value: `🐾 **${p2Pet.pet_name}** (<@${match.player_2_id}>)`, inline: true },
          { name: '🏟️ Arena Laga (Thread)', value: `👉 Masuk ke arena: <#${thread.id}>`, inline: false }
        )
        .setFooter({ text: `Match #${match.match_id} • Ronde ${event.current_round}` })
        .setTimestamp();
      await channel.send({ embeds: [matchAnnounce] }).catch(() => {});
    }

    // Update panel admin
    updateAdminPanel(guildId, client).catch(() => {});

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
        shieldTurns: 0,
        chosenAction: null
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
        shieldTurns: 0,
        chosenAction: null
      }
    };

    // Set timestamp batas waktu turn pertama
    combatData.turnEndUnix = Math.floor(Date.now() / 1000) + 45;

    client.activeCupMatches.set(match.match_id, combatData);

    // Kirim embed tempur pertama
    const combatMsg = await thread.send(getBattleEmbedData(combatData)).catch(() => null);
    if (combatMsg) {
      combatData.messageId = combatMsg.id;
    }

    // Kirim ping turn pertama untuk giliran kedua pemain
    const pingMsg = await thread.send(`👉 Giliranmu untuk bertindak, <@${combatData.player1.user_id}> & <@${combatData.player2.user_id}>!`).catch(() => null);
    if (pingMsg) {
      combatData.lastPingMessageId = pingMsg.id;
    }

    // Set timer timeout 45 detik
    startTurnTimer(match.match_id, client);

  } else {
    // Seluruh match di ronde ini sudah selesai!
    const roundMatches = db.all('SELECT * FROM tournament_matches WHERE guild_id = ? AND round_number = ?', [guildId, event.current_round]);
    const allCompleted = roundMatches.every(m => m.match_status === 'COMPLETED' || m.match_status === 'FORFEITED');

    if (!allCompleted) {
      return;
    }

    // Periksa apakah masih ada match PENDING lainnya di ronde selanjutnya
    const pendingMatches = db.get('SELECT match_id FROM tournament_matches WHERE guild_id = ? AND match_status = \'PENDING\' LIMIT 1', [guildId]);

    if (!pendingMatches) {
      // LIGA SELESAI! Hitung klasemen akhir
      const participants = db.all('SELECT * FROM tournament_participants WHERE guild_id = ?', [guildId]);
      const matches = db.all('SELECT * FROM tournament_matches WHERE guild_id = ? AND match_status = \'COMPLETED\'', [guildId]);

      const standings = participants.map(p => {
        let played = 0;
        let won = 0;
        matches.forEach(m => {
          if (m.player_1_id === p.user_id || m.player_2_id === p.user_id) {
            played++;
            if (m.winner_id === p.user_id) {
              won++;
            }
          }
        });
        const lost = played - won;
        const points = won * 3;
        return {
          userId: p.user_id,
          petName: p.pet_name,
          played,
          won,
          lost,
          points
        };
      });

      // Urutkan klasemen
      standings.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.won !== a.won) return b.won - a.won;
        return a.petName.localeCompare(b.petName);
      });

      const championId = standings[0]?.userId || null;
      const runnerUpId = standings[1]?.userId || null;

      if (championId) {
        await endTournament(guildId, championId, runnerUpId, client);
      } else {
        db.run('DELETE FROM tournament_events WHERE guild_id = ?', [guildId]);
        await channel.send('❌ **Liga dibatalkan** karena terjadi error status (tidak ditemukan peserta).');
      }
    } else {
      // Maju ke ronde selanjutnya
      const nextRound = event.current_round + 1;
      db.run('UPDATE tournament_events SET current_round = ? WHERE guild_id = ?', [nextRound, guildId]);

      // Ambil max round
      const maxRoundObj = db.get('SELECT MAX(round_number) as max_r FROM tournament_matches WHERE guild_id = ?', [guildId]);
      const maxRound = maxRoundObj ? maxRoundObj.max_r : nextRound;

      const roundLabel = nextRound === maxRound ? '🏆 ROUND AKHIR (FINAL ROUND) 🏆' : `ROUND ${nextRound}`;

      const standingsText = getLeagueStandingsString(guildId);
      const queueText = getMatchQueueString(guildId);

      const newBracketEmbed = new EmbedBuilder()
        .setColor(0x6366F1)
        .setTitle(`📊 LIGA PET — ${roundLabel} 📊`)
        .setDescription(
          `Babak **Ronde ${event.current_round}** selesai!\n` +
          `Berikut adalah klasemen sementara dan jadwal pertandingan untuk babak selanjutnya:\n\n` +
          `▬`.repeat(15)
        )
        .addFields(
          { name: '🏆 Klasemen Sementara (Standings)', value: `\`\`\`text\n${standingsText}\n\`\`\``, inline: false },
          { name: '📋 Antrean Pertandingan (Queue)', value: queueText || '*Tidak ada antrean.*', inline: false }
        )
        .setFooter({ text: 'Pet PvP League • Standings Transition' })
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
    handleTimeout(matchId, client);
  }, 45000);
}

/**
 * Menangani timeout ketika player tidak klik tombol dalam 45 detik.
 */
async function handleTimeout(matchId, client) {
  const match = client.activeCupMatches.get(matchId);
  if (!match) return;

  const p1 = match.player1;
  const p2 = match.player2;

  const p1TimedOut = !p1.chosenAction;
  const p2TimedOut = !p2.chosenAction;

  if (p1TimedOut) p1.timeouts++;
  if (p2TimedOut) p2.timeouts++;

  const forfeitP1 = p1.timeouts >= 2;
  const forfeitP2 = p2.timeouts >= 2;

  if (forfeitP1 && forfeitP2) {
    match.logs.push(`🚨 **Batas Waktu Habis!** Kedua pemain tidak aktif (AFK) sebanyak 2 kali berturut-turut. Pertandingan diselesaikan berdasarkan sisa HP.`);
    if (p1.hp === p2.hp) {
      await endMatch(matchId, p2.user_id, 'defeat', client);
    } else if (p1.hp > p2.hp) {
      await endMatch(matchId, p1.user_id, 'defeat', client);
    } else {
      await endMatch(matchId, p2.user_id, 'defeat', client);
    }
    return;
  }

  if (forfeitP1) {
    match.logs.push(`🚨 **Batas Waktu Habis!** **${p1.pet_name}** tidak aktif (AFK) sebanyak 2 kali berturut-turut. Pertandingan selesai dengan status **FORFEIT**.`);
    await endMatch(matchId, p2.user_id, 'forfeit', client);
    return;
  }

  if (forfeitP2) {
    match.logs.push(`🚨 **Batas Waktu Habis!** **${p2.pet_name}** tidak aktif (AFK) sebanyak 2 kali berturut-turut. Pertandingan selesai dengan status **FORFEIT**.`);
    await endMatch(matchId, p1.user_id, 'forfeit', client);
    return;
  }

  if (p1TimedOut) {
    p1.chosenAction = 'atk';
    match.logs.push(`⚠️ **Batas Waktu Habis!** **${p1.pet_name}** lambat bertindak! Bot memilih tindakan serang otomatis.`);
  }

  if (p2TimedOut) {
    p2.chosenAction = 'atk';
    match.logs.push(`⚠️ **Batas Waktu Habis!** **${p2.pet_name}** lambat bertindak! Bot memilih tindakan serang otomatis.`);
  }

  // Clear timer
  if (match.timer) {
    clearTimeout(match.timer);
    match.timer = null;
  }

  await resolveSimultaneousTurn(matchId, client);
}

function getActionName(actionType) {
  switch (actionType) {
    case 'atk': return '⚔️ Serang';
    case 'def': return '🛡️ Bertahan';
    case 'elem': return '⚡ Elemen';
    case 'ult': return '💥 Ultimate';
    default: return 'Tindakan';
  }
}

/**
 * Memproses aksi tempur interaktif dari pemain.
 */
async function processTurn(matchId, playerId, actionType, client, interaction) {
  const match = client.activeCupMatches.get(matchId);
  if (!match) {
    throw new Error('Pertandingan tidak ditemukan atau telah berakhir!');
  }

  let actor, opponent;
  if (match.player1.user_id === playerId) {
    actor = match.player1;
    opponent = match.player2;
  } else if (match.player2.user_id === playerId) {
    actor = match.player2;
    opponent = match.player1;
  } else {
    throw new Error('Anda bukan peserta pertandingan ini!');
  }

  if (actor.chosenAction) {
    throw new Error('Anda sudah menentukan pilihan untuk giliran ini! Menunggu lawan...');
  }

  // Validasi Aksi
  if (actionType === 'elem') {
    if (actor.energy < 20) throw new Error('Energi (SP) tidak cukup! Butuh 20 SP.');
    if (actor.elemCooldown > 0) throw new Error(`Skill Elemen sedang cooldown! Tersisa ${actor.elemCooldown} turn lagi.`);
  } else if (actionType === 'ult') {
    if (actor.energy < 50) throw new Error('Energi (SP) tidak cukup! Butuh 50 SP.');
    if (actor.hasUsedUltimate) throw new Error('Ultimate Skill hanya dapat digunakan 1 kali per pertandingan!');
  }

  actor.chosenAction = actionType;

  if (opponent.chosenAction) {
    // Clear timeout active
    if (match.timer) {
      clearTimeout(match.timer);
      match.timer = null;
    }

    // Inform the user ephemerally
    if (interaction) {
      await interaction.reply({ content: `✔️ Pilihan Anda untuk menggunakan **${getActionName(actionType)}** telah disimpan! Memproses giliran...`, flags: 64 }).catch(() => {});
    }

    // Resolve turn
    await resolveSimultaneousTurn(matchId, client);
  } else {
    // Inform the user ephemerally
    if (interaction) {
      await interaction.reply({ content: `✔️ Pilihan Anda untuk menggunakan **${getActionName(actionType)}** telah disimpan! Menunggu lawan menentukan tindakan...`, flags: 64 }).catch(() => {});
    }

    // Update battle embed status to SIAP
    await updateBattleEmbed(matchId, client);
  }
}

/**
 * Menyelesaikan turn pertarungan secara simultan.
 */
async function resolveSimultaneousTurn(matchId, client) {
  const match = client.activeCupMatches.get(matchId);
  if (!match) return;

  const p1 = match.player1;
  const p2 = match.player2;

  // 1. Reset status bertahan untuk giliran baru
  p1.isDefending = false;
  p2.isDefending = false;

  // Kurangi cooldown elemen sebelum aksi diproses
  if (p1.elemCooldown > 0) p1.elemCooldown--;
  if (p2.elemCooldown > 0) p2.elemCooldown--;

  // 2. Terapkan pertahanan terlebih dahulu agar berlaku untuk turn ini
  if (p1.chosenAction === 'def') {
    p1.isDefending = true;
    p1.energy = Math.min(100, p1.energy + 20);
    match.logs.push(`🛡️ **${p1.pet_name}** memasang kuda-kuda bertahan!`);
  }
  if (p2.chosenAction === 'def') {
    p2.isDefending = true;
    p2.energy = Math.min(100, p2.energy + 20);
    match.logs.push(`🛡️ **${p2.pet_name}** memasang kuda-kuda bertahan!`);
  }

  // 3. Tentukan urutan aksi menyerang berdasarkan DEX
  let first = p1;
  let second = p2;
  if (p2.stat_dex > p1.stat_dex) {
    first = p2;
    second = p1;
  } else if (p1.stat_dex === p2.stat_dex) {
    if (Math.random() < 0.5) {
      first = p2;
      second = p1;
    }
  }

  // Aksi First Player
  if (first.hp > 0 && ['atk', 'elem', 'ult'].includes(first.chosenAction)) {
    executeSingleAction(first, second, first.chosenAction, match);
  }

  // Aksi Second Player (hanya jika masih hidup)
  if (second.hp > 0 && ['atk', 'elem', 'ult'].includes(second.chosenAction)) {
    executeSingleAction(second, first, second.chosenAction, match);
  }

  // 4. Cek kekalahan instan setelah aksi bertarung
  if (p1.hp <= 0 && p2.hp <= 0) {
    // Keduanya mati bersamaan: pemenang ditentukan dari DEX tertinggi
    const winner = p1.stat_dex >= p2.stat_dex ? p1 : p2;
    await endMatch(matchId, winner.user_id, 'defeat', client);
    return;
  } else if (p1.hp <= 0) {
    await endMatch(matchId, p2.user_id, 'defeat', client);
    return;
  } else if (p2.hp <= 0) {
    await endMatch(matchId, p1.user_id, 'defeat', client);
    return;
  }

  // 5. Terapkan DoT Terbakar & update perisai di akhir giliran
  for (const player of [p1, p2]) {
    if (player.burnTurns > 0) {
      const burnDmg = 8;
      player.hp = Math.max(1, player.hp - burnDmg); // Sisakan HP minimal 1
      match.logs.push(`🔥 **${player.pet_name}** menderita kerusakan terbakar bara **-${burnDmg} HP**!`);
      player.burnTurns--;
    }
    if (player.shieldTurns > 0) {
      player.shieldTurns--;
    }
  }

  // Cek kekalahan lagi setelah DoT terbakar
  if (p1.hp <= 0 && p2.hp <= 0) {
    const winner = p1.stat_dex >= p2.stat_dex ? p1 : p2;
    await endMatch(matchId, winner.user_id, 'defeat', client);
    return;
  } else if (p1.hp <= 0) {
    await endMatch(matchId, p2.user_id, 'defeat', client);
    return;
  } else if (p2.hp <= 0) {
    await endMatch(matchId, p1.user_id, 'defeat', client);
    return;
  }

  // 6. Reset pilihan aksi & naikkan turnCount
  p1.chosenAction = null;
  p2.chosenAction = null;
  match.turnCount++;

  // Set timestamp turn berikutnya
  match.turnEndUnix = Math.floor(Date.now() / 1000) + 45;

  // Update Tampilan & Restart Timer 45s
  updateBattleEmbed(matchId, client);
  startTurnTimer(matchId, client);
}

/**
 * Mengeksekusi aksi tunggal dari satu pet ke pet lain.
 */
function executeSingleAction(attacker, defender, actionType, match) {
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

  } else if (actionType === 'elem') {
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
          defender.stat_def = Math.round(defender.stat_def * 0.5);
          effectText = `\n💥 Zirah pertahanan **${defender.pet_name}** pecah! DEF berkurang 50% untuk sisa laga turnamen!`;
        }

        logMsg = `💥 **${attacker.pet_name}** membangkitkan amarah **[${ultName}]** kepada **${defender.pet_name}** memberikan **${damage} DMG**!${critText}${effectText}`;
      }
    }
    attacker.energy -= 50;
    attacker.hasUsedUltimate = true;
  }

  if (logMsg) {
    match.logs.push(logMsg);
  }
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

  // Hapus ping terakhir agar tidak berantakan
  if (match.lastPingMessageId) {
    const threadChannel = client.channels.cache.get(match.threadId) || await client.channels.fetch(match.threadId).catch(() => null);
    if (threadChannel) {
      const prevPing = await threadChannel.messages.fetch(match.lastPingMessageId).catch(() => null);
      if (prevPing) {
        await prevPing.delete().catch(() => {});
      }
    }
  }

  const winner = match.player1.user_id === winnerId ? match.player1 : match.player2;
  const loser = match.player1.user_id === winnerId ? match.player2 : match.player1;

  db.transaction(() => {
    // Tandai pemenang dan selesaikan match
    db.run(
      'UPDATE tournament_matches SET winner_id = ?, match_status = \'COMPLETED\' WHERE match_id = ?',
      [winnerId, matchId]
    );
  })();

  const threadChannel = client.channels.cache.get(match.thread_id || match.threadId) || await client.channels.fetch(match.thread_id || match.threadId).catch(() => null);
  if (threadChannel) {
    const victoryEmbed = new EmbedBuilder()
      .setColor(0x10B981) // Emerald Green
      .setTitle('🏆 PERTANDINGAN SELESAI! 🏆')
      .setDescription(
        `Pertempuran di arena telah usai dan pemenang telah ditentukan!\n` +
        `▬`.repeat(15)
      )
      .addFields(
        { name: '👑 Pemenang (Winner)', value: `🥇 **${winner.pet_name}** (<@${winner.user_id}>) — memperoleh **+3 Poin**`, inline: false },
        { name: '💀 Lawan (Opponent)', value: `🐾 **${loser.pet_name}** (<@${loser.user_id}>) — memperoleh **0 Poin**`, inline: false },
        { name: '💡 Pemulihan HP & Kebahagiaan', value: `*Status HP dan kebahagiaan pet kedua pemain telah dipulihkan 100% seperti semula.*`, inline: false }
      )
      .setFooter({ text: `Match #${match.matchId} Completed` })
      .setTimestamp();

    await threadChannel.send({ embeds: [victoryEmbed] });

    // Rename thread, lock dan archive agar bersih
    if (threadChannel.isThread) {
      await threadChannel.setName(`[SELESAI] Match ${match.matchId} - Winner: ${winner.pet_name}`).catch(() => {});
      if (threadChannel.setLocked) {
        await threadChannel.setLocked(true).catch(() => {});
        await threadChannel.setArchived(true).catch(() => {});
      }
    }
  }

  // Kirim update klasemen & antrean ke channel utama
  const eventChan = db.get('SELECT channel_id FROM tournament_events WHERE guild_id = ?', [match.guildId]);
  if (eventChan) {
    const channel = client.channels.cache.get(eventChan.channel_id) || await client.channels.fetch(eventChan.channel_id).catch(() => null);
    if (channel) {
      const standingsText = getLeagueStandingsString(match.guildId);
      const queueText = getMatchQueueString(match.guildId);

      const updateEmbed = new EmbedBuilder()
        .setColor(0x6366F1)
        .setTitle('📊 UPDATE KLASEMEN LIGA PET 📊')
        .setDescription(
          `Pertandingan Match #${match.matchId} telah selesai!\n` +
          `▬`.repeat(15)
        )
        .addFields(
          { name: '🏆 Klasemen Sementara (Standings)', value: `\`\`\`text\n${standingsText}\n\`\`\``, inline: false },
          { name: '📋 Jadwal & Antrean Match (Queue)', value: queueText || '*Tidak ada antrean.*', inline: false }
        )
        .setTimestamp();
      await channel.send({ embeds: [updateEmbed] }).catch(() => {});
    }
  }

  // Update panel admin
  updateAdminPanel(match.guildId, client).catch(() => {});

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

  const config = require('./config');
  const guild = channel ? channel.guild : (client.guilds.cache.get(guildId));

  // 1. Kirim pengumuman juara ke channel announcement_event dengan @everyone, dan salinan ke catalog
  const announceChanId = config.ANNOUNCEMENT_CHANNEL_ID || '1511871394210779247';
  const catalogChanId = '1510138369923874958';

  const finalStandings = getLeagueStandingsString(guildId);

  const celebrationEmbed = new EmbedBuilder()
    .setColor(0xF59E0B) // Amber/Gold
    .setTitle('🏆 CHAMPION OF PET LEAGUE 🏆')
    .setDescription(
      `🎉 **Liga PvP Pet Resmi Berakhir!** 🎉\n` +
      `Pertarungan sengit telah usai dan sang legenda baru server telah dinobatkan!\n` +
      `▬`.repeat(15)
    )
    .addFields(
      { name: '🥇 JUARA 1 (CHAMPION)', value: `🏆 **${champPet?.pet_name || 'Pet 1'}** (<@${championId}>)`, inline: false },
      { name: '🥈 JUARA 2 (RUNNER-UP)', value: runnerPet ? `🥈 **${runnerPet.pet_name}** (<@${runnerUpId}>)` : '*Tidak ada.*', inline: false },
      { name: '🎁 Hadiah Liga (Reward)', value: event.reward_desc ? `**${event.reward_desc}**` : `*Akan diberikan secara manual oleh Admin.*`, inline: false },
      { name: '📊 Klasemen Akhir Liga (Final Standings)', value: `\`\`\`text\n${finalStandings}\n\`\`\``, inline: false },
      { name: '📢 Pemberitahuan Admin', value: `<@${event.admin_id}> dipersilakan memberikan hadiah turnamen secara manual kepada para pemenang.`, inline: false }
    )
    .setFooter({ text: 'Pet PvP League • Completed' })
    .setTimestamp();

  if (guild) {
    if (announceChanId) {
      const announceChan = guild.channels.cache.get(announceChanId) || await guild.channels.fetch(announceChanId).catch(() => null);
      if (announceChan) {
        await announceChan.send({ content: '@everyone', embeds: [celebrationEmbed], allowedMentions: { parse: ['everyone'] } }).catch(() => {});
      }
    }
    if (catalogChanId) {
      const catalogChan = guild.channels.cache.get(catalogChanId) || await guild.channels.fetch(catalogChanId).catch(() => null);
      if (catalogChan) {
        await catalogChan.send({ embeds: [celebrationEmbed] }).catch(() => {});
      }
    }
  }

  // 2. Alert admin via DM jika memungkinkan
  const adminUser = client.users.cache.get(event.admin_id) || await client.users.fetch(event.admin_id).catch(() => null);
  if (adminUser) {
    await adminUser.send(
      `🏆 **Turnamen Admin Cup di server Anda telah selesai!**\n\n` +
      `• Pemenang Juara 1: <@${championId}> (Pet: **${champPet.pet_name}**)\n` +
      (runnerUpId ? `• Juara 2: <@${runnerUpId}> (Pet: **${runnerPet.pet_name}**)\n` : '') +
      (event.reward_desc ? `• Hadiah Terkonfigurasi: **${event.reward_desc}**\n` : '') +
      `Silakan berikan koin, item, role, atau pet kustom kepada mereka sebagai hadiah!`
    ).catch(() => {});
  }

  // 3. Perbarui panel admin dengan status selesai
  if (event.admin_panel_message_id && event.admin_panel_channel_id) {
    const adminChan = client.channels.cache.get(event.admin_panel_channel_id) || await client.channels.fetch(event.admin_panel_channel_id).catch(() => null);
    if (adminChan) {
      const adminMsg = await adminChan.messages.fetch(event.admin_panel_message_id).catch(() => null);
      if (adminMsg) {
        const completedEmbed = new EmbedBuilder()
          .setColor(0xF59E0B) // Amber
          .setTitle('🏆 LIGA SELESAI!')
          .setDescription(
            `Liga Pet telah selesai dengan sukses!\n` +
            `▬`.repeat(15)
          )
          .addFields(
            { name: '🥇 Juara 1', value: `<@${championId}>`, inline: true },
            { name: '🥈 Juara 2', value: runnerUpId ? `<@${runnerUpId}>` : '-', inline: true }
          )
          .setFooter({ text: 'League Status: Completed' })
          .setTimestamp();
        await adminMsg.edit({ embeds: [completedEmbed], components: [] }).catch(() => {});
      }
    }
  }

  // 4. Riset/buat ulang channel pvp-cup agar bersih
  if (guild) {
    await createTournamentChannel(guild).catch((err) => {
      console.error(`Gagal mereset channel turnamen: ${err.message}`);
    });
  }

  // Bersihkan data event di database
  db.transaction(() => {
    db.run('DELETE FROM tournament_events WHERE guild_id = ?', [guildId]);
    db.run('DELETE FROM tournament_participants WHERE guild_id = ?', [guildId]);
    db.run('DELETE FROM tournament_matches WHERE guild_id = ?', [guildId]);
  })();
}

/**
 * Helper untuk memformat log pertempuran dengan escape code ANSI berwarna untuk Discord code block.
 */
function formatLogToAnsi(log) {
  // Bersihkan penanda bold markdown asterisks
  let cleanLog = log.replace(/\*\*/g, '');
  
  let ansiColor = '\u001b[0m'; // Reset (White/Gray)
  
  if (cleanLog.includes('CRITICAL STRIKE') || cleanLog.includes('🚨') || cleanLog.includes('FORFEIT') || cleanLog.includes('AFK')) {
    ansiColor = '\u001b[1;31m'; // Bold Red
  } else if (cleanLog.includes('⚔️') || cleanLog.includes('DMG') || cleanLog.includes('🔥') || cleanLog.includes('TERBAKAR') || cleanLog.includes('meleset') || cleanLog.includes('lambat bertindak')) {
    ansiColor = '\u001b[0;31m'; // Red
  } else if (cleanLog.includes('🌀') || cleanLog.includes('memulihkan') || (cleanLog.includes('HP') && cleanLog.includes('+'))) {
    ansiColor = '\u001b[1;32m'; // Bold Green
  } else if (cleanLog.includes('🛡️') || cleanLog.includes('BERTAHAN') || cleanLog.includes('Perisai') || cleanLog.includes('zirah') || cleanLog.includes('menghindar') || cleanLog.includes('💨')) {
    ansiColor = '\u001b[1;36m'; // Bold Cyan
  } else if (cleanLog.includes('⚡') || cleanLog.includes('💥') || cleanLog.includes('Ultimate') || cleanLog.includes('Jurus Pamungkas') || cleanLog.includes('elemen') || cleanLog.includes('kebal')) {
    ansiColor = '\u001b[1;35m'; // Bold Magenta
  } else if (cleanLog.includes('⚠️') || cleanLog.includes('Batas Waktu Habis')) {
    ansiColor = '\u001b[1;33m'; // Bold Yellow
  } else if (cleanLog.includes('dimulai')) {
    ansiColor = '\u001b[1;34m'; // Bold Blue
  }
  
  return `${ansiColor}${cleanLog}\u001b[0m`;
}

/**
 * Helper untuk membuat struktur Embed dan Komponen Tombol Pertempuran.
 */
function getBattleEmbedData(match) {
  const p1 = match.player1;
  const p2 = match.player2;

  const barSize = 10;
  const renderHPBar = (hp, max) => {
    const ratio = Math.max(0, Math.min(1, hp / max));
    const filled = Math.round(ratio * barSize);
    let emoji = '🟩';
    if (ratio <= 0.2) emoji = '🟥';
    else if (ratio <= 0.5) emoji = '🟨';
    return emoji.repeat(filled) + '⬛'.repeat(barSize - filled);
  };

  const renderSPBar = (energy) => {
    const ratio = Math.max(0, Math.min(1, energy / 100));
    const filled = Math.round(ratio * barSize);
    return '🔵'.repeat(filled) + '⬛'.repeat(barSize - filled);
  };

  // Format battle logs to ANSI
  const ansiLogs = match.logs.slice(-3).map(formatLogToAnsi).join('\n');

  const p1Status = p1.chosenAction ? '✔️ **SIAP**' : '⏳ **MEMILIH...**';
  const p2Status = p2.chosenAction ? '✔️ **SIAP**' : '⏳ **MEMILIH...**';

  // Embed premium layout
  const embed = new EmbedBuilder()
    .setColor(0xEF4444) // Red for active fight
    .setTitle(`⚔️ ARENA LIGA PET — MATCH #${match.matchId} ⚔️`)
    .setDescription(
      `Kedua pet bertarung sengit di bawah kendali pawang masing-masing!\n` +
      `▬`.repeat(15)
    )
    .addFields(
      {
        name: `🔴 Challenger: ${p1.pet_name} (Lv.${p1.level})`,
        value: 
          `👤 Pawang: <@${p1.user_id}>\n` +
          `❤️ HP: \`[${renderHPBar(p1.hp, p1.maxHP)}]\` \`${p1.hp}/${p1.maxHP}\`\n` +
          `⚡ SP: \`[${renderSPBar(p1.energy)}]\` \`${p1.energy}/100\`\n` +
          `🔰 Status: ${p1.burnTurns > 0 ? '🔥 Terbakar' : p1.shieldTurns > 0 ? '🛡️ Perisai' : p1.isDefending ? '🛡️ Bertahan' : 'Normal'}\n` +
          `⌛ Aksi: ${p1Status}`,
        inline: true
      },
      {
        name: `🔵 Opponent: ${p2.pet_name} (Lv.${p2.level})`,
        value: 
          `👤 Pawang: <@${p2.user_id}>\n` +
          `❤️ HP: \`[${renderHPBar(p2.hp, p2.maxHP)}]\` \`${p2.hp}/${p2.maxHP}\`\n` +
          `⚡ SP: \`[${renderSPBar(p2.energy)}]\` \`${p2.energy}/100\`\n` +
          `🔰 Status: ${p2.burnTurns > 0 ? '🔥 Terbakar' : p2.shieldTurns > 0 ? '🛡️ Perisai' : p2.isDefending ? '🛡️ Bertahan' : 'Normal'}\n` +
          `⌛ Aksi: ${p2Status}`,
        inline: true
      },
      {
        name: '📜 Log Jalannya Duel',
        value: `\`\`\`ansi\n${ansiLogs || 'Belum ada log.'}\n\`\`\``,
        inline: false
      },
      {
        name: '⏳ Batas Waktu Tindakan',
        value: `👉 Pilih langkah Anda menggunakan tombol di bawah!\n⏳ Tersisa: <t:${match.turnEndUnix || Math.floor(Date.now() / 1000 + 45)}:R>`,
        inline: false
      }
    )
    .setFooter({ text: `Turn ${match.turnCount} • Pet PvP League` })
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
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`cup_btn_ult_${match.matchId}`)
      .setLabel('💥 Ultimate')
      .setStyle(ButtonStyle.Danger)
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
  if (threadChannel) {
    if (match.messageId) {
      const msg = await threadChannel.messages.fetch(match.messageId).catch(() => null);
      if (msg) {
        const data = getBattleEmbedData(match);
        await msg.edit(data).catch(() => {});
      }
    }

    // Hapus ping sebelumnya jika ada
    if (match.lastPingMessageId) {
      const prevPing = await threadChannel.messages.fetch(match.lastPingMessageId).catch(() => null);
      if (prevPing) {
        await prevPing.delete().catch(() => {});
      }
      match.lastPingMessageId = null;
    }

    // Kirim ping baru untuk giliran pemain yang belum memilih
    const pendingUsers = [];
    if (!match.player1.chosenAction) pendingUsers.push(`<@${match.player1.user_id}>`);
    if (!match.player2.chosenAction) pendingUsers.push(`<@${match.player2.user_id}>`);

    if (pendingUsers.length > 0) {
      const pingMsg = await threadChannel.send(`👉 Giliranmu untuk bertindak, ${pendingUsers.join(' & ')}!`).catch(() => null);
      if (pingMsg) {
        match.lastPingMessageId = pingMsg.id;
      }
    }
  }
}

/**
 * Otomatis membuat channel baru 🏆┃pvp-cup untuk turnamen.
 * Menghapus channel dengan nama yang sama terlebih dahulu jika sudah ada.
 */
async function createTournamentChannel(guild) {
  const { ChannelType, PermissionFlagsBits } = require('discord.js');
  
  // Cari dan hapus channel turnamen pvp cup lama jika ada
  const oldChannel = guild.channels.cache.find(c => c.name === '🏆┃pvp-cup' || c.name === 'pvp-cup');
  if (oldChannel) {
    await oldChannel.delete().catch((err) => {
      console.error(`Gagal menghapus channel turnamen lama: ${err.message}`);
    });
  }

  const FACILITIES_CATEGORY_ID = '1410239831023288451'; // #🍷 FACILITIES :
  const parentId = guild.channels.cache.has(FACILITIES_CATEGORY_ID) ? FACILITIES_CATEGORY_ID : null;

  // Buat channel baru
  const channel = await guild.channels.create({
    name: '🏆┃pvp-cup',
    type: ChannelType.GuildText,
    parent: parentId,
    topic: '🏆 Saluran Resmi Turnamen PvP Cup! Bersiaplah dan ikuti keseruannya!',
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.EmbedLinks
        ]
      }
    ]
  });
  return channel;
}

/**
 * Membuat visual bracket tree berbasis ASCII text.
 */
function getVisualBracketString(guildId) {
  const matches = db.all(
    'SELECT * FROM tournament_matches WHERE guild_id = ? ORDER BY round_number, match_id',
    [guildId]
  );
  if (matches.length === 0) return 'Belum ada bagan pertandingan.';

  const participants = db.all(
    'SELECT * FROM tournament_participants WHERE guild_id = ?',
    [guildId]
  );
  const participantMap = new Map();
  participants.forEach(p => {
    const petInfo = db.get(
      'SELECT level, pet_type FROM user_pets WHERE user_id = ? AND guild_id = ? AND pet_name = ?',
      [p.user_id, guildId, p.pet_name]
    ) || { level: 10, pet_type: 'CAT' };
    participantMap.set(p.user_id, {
      pet_name: p.pet_name,
      level: petInfo.level,
      pet_type: petInfo.pet_type
    });
  });

  const getPlayerLabel = (userId) => {
    if (!userId) return '[ BYE ]';
    const info = participantMap.get(userId);
    if (!info) return `User:${userId.slice(0, 6)}`;
    return `${info.pet_name} (Lv.${info.level})`;
  };

  const rounds = {};
  let maxRound = 1;
  matches.forEach(m => {
    if (!rounds[m.round_number]) rounds[m.round_number] = [];
    rounds[m.round_number].push(m);
    if (m.round_number > maxRound) maxRound = m.round_number;
  });

  const r1Matches = rounds[1] || [];
  const numR1Matches = r1Matches.length;
  if (numR1Matches === 0) return 'Belum ada bagan ronde 1.';

  const gridHeight = numR1Matches * 4;
  const colWidth = 26;
  const gridWidth = maxRound * colWidth + 30;
  const grid = Array.from({ length: gridHeight }, () => Array(gridWidth).fill(' '));

  const writeAt = (x, y, str) => {
    if (y < 0 || y >= gridHeight) return;
    for (let i = 0; i < str.length; i++) {
      if (x + i < gridWidth) {
        grid[y][x + i] = str[i];
      }
    }
  };

  for (let r = 1; r <= maxRound; r++) {
    const roundMatches = rounds[r] || [];
    const colX = (r - 1) * colWidth;
    const d = Math.pow(2, r - 1);

    roundMatches.forEach((m, j) => {
      const y1 = j * d * 4 + (d - 1);
      const y2 = j * d * 4 + (d - 1) + d * 2;
      const yc = j * d * 4 + (d - 1) + d;

      let p1Label = '';
      let p2Label = '';

      if (r === 1) {
        p1Label = getPlayerLabel(m.player_1_id);
        p2Label = getPlayerLabel(m.player_2_id);
      } else {
        p1Label = m.player_1_id ? getPlayerLabel(m.player_1_id) : 'TBD';
        p2Label = m.player_2_id ? getPlayerLabel(m.player_2_id) : 'TBD';
      }

      if (m.winner_id) {
        if (m.winner_id === m.player_1_id) p1Label += ' ✅';
        else if (m.winner_id === m.player_2_id) p2Label += ' ✅';
      } else if (m.match_status === 'ACTIVE') {
        p1Label += ' 🔴';
        p2Label += ' 🔴';
      }

      writeAt(colX + 3, y1, p1Label);
      writeAt(colX + 3, y2, p2Label);

      writeAt(colX, y1, '┌─');
      for (let y = y1 + 1; y < y2; y++) {
        writeAt(colX, y, '│');
      }
      writeAt(colX, yc, '├─');
      writeAt(colX, y2, '└─');

      for (let x = colX + 2; x < colX + colWidth - 1; x++) {
        writeAt(x, yc, '─');
      }
    });
  }

  const dLast = Math.pow(2, maxRound - 1);
  const ycFinal = dLast - 1 + dLast;
  const colXFinal = (maxRound - 1) * colWidth;
  const finalMatch = (rounds[maxRound] || [])[0];
  let champLabel = '🏆 CHAMPION: TBD';
  if (finalMatch && finalMatch.winner_id && finalMatch.match_status === 'COMPLETED') {
    champLabel = `🏆 JUARA: ${getPlayerLabel(finalMatch.winner_id)}`;
  }
  writeAt(colXFinal + colWidth, ycFinal, `──> ${champLabel}`);

  const lines = grid.map(row => row.join('').trimEnd());
  let firstNonEmpty = 0;
  while (firstNonEmpty < lines.length && lines[firstNonEmpty] === '') firstNonEmpty++;
  let lastNonEmpty = lines.length - 1;
  while (lastNonEmpty >= 0 && lines[lastNonEmpty] === '') lastNonEmpty--;

  if (firstNonEmpty > lastNonEmpty) return 'Bagan kosong.';
  return lines.slice(firstNonEmpty, lastNonEmpty + 1).join('\n');
}

/**
 * Menyusun daftar antrean match dengan tautan thread-nya.
 */
function getMatchQueueString(guildId) {
  const event = db.get('SELECT current_round FROM tournament_events WHERE guild_id = ?', [guildId]);
  if (!event) return '';

  const activeMatches = db.all(
    'SELECT * FROM tournament_matches WHERE guild_id = ? AND match_status = \'ACTIVE\'',
    [guildId]
  );
  
  const pendingMatches = db.all(
    'SELECT * FROM tournament_matches WHERE guild_id = ? AND match_status = \'PENDING\' ORDER BY round_number, match_id',
    [guildId]
  );

  const getPetName = (userId) => {
    if (!userId) return '[ BYE ]';
    const participant = db.get('SELECT pet_name FROM tournament_participants WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
    return participant ? participant.pet_name : `<@${userId}>`;
  };

  let queueText = '📋 **ANTREAN PERTANDINGAN:**\n';
  let hasActive = false;
  activeMatches.forEach(m => {
    hasActive = true;
    const p1 = getPetName(m.player_1_id);
    const p2 = getPetName(m.player_2_id);
    queueText += `🔴 **Match #${m.match_id} (LIVE):** **${p1}** vs **${p2}** ──> Saksikan di: <#${m.thread_id || ''}>\n`;
  });

  if (!hasActive && pendingMatches.length > 0) {
    queueText += `🟢 **Match Berikutnya (Segera Mulai):** Bersiap-siap...\n`;
  }

  if (pendingMatches.length === 0 && !hasActive) {
    queueText += `*Tidak ada pertandingan dalam antrean.*`;
  } else {
    pendingMatches.slice(0, 3).forEach((m, idx) => {
      const p1 = getPetName(m.player_1_id);
      const p2 = getPetName(m.player_2_id);
      queueText += `⏳ **Match #${m.match_id} (Ronde ${m.round_number}):** **${p1}** vs **${p2}**\n`;
    });
    if (pendingMatches.length > 3) {
      queueText += `> *...dan ${pendingMatches.length - 3} pertandingan lainnya.*`;
    }
  }
  return queueText;
}

/**
 * Menyusun data panel kontrol admin.
 */
function getAdminPanelData(guildId, client) {
  const event = db.get('SELECT * FROM tournament_events WHERE guild_id = ?', [guildId]);
  if (!event) {
    return {
      embeds: [
        new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('❌ TURNAMEN TIDAK AKTIF')
          .setDescription('Tidak ada turnamen aktif di server ini saat ini.')
      ],
      components: []
    };
  }

  const isPaused = event.is_paused === 1;
  const statusLabel = event.status;

  const activeMatch = db.get(
    'SELECT * FROM tournament_matches WHERE guild_id = ? AND match_status = \'ACTIVE\' LIMIT 1',
    [guildId]
  );

  let activeMatchText = '*Tidak ada pertandingan aktif saat ini.*';
  if (activeMatch) {
    const p1 = db.get('SELECT pet_name FROM tournament_participants WHERE guild_id = ? AND user_id = ?', [guildId, activeMatch.player_1_id]);
    const p2 = db.get('SELECT pet_name FROM tournament_participants WHERE guild_id = ? AND user_id = ?', [guildId, activeMatch.player_2_id]);
    activeMatchText = `⚔️ **Match #${activeMatch.match_id}:** **${p1?.pet_name || 'Pet 1'}** vs **${p2?.pet_name || 'Pet 2'}**\n🏟️ Thread: <#${activeMatch.thread_id}>`;

    if (client && client.activeCupMatches) {
      const combat = client.activeCupMatches.get(activeMatch.match_id);
      if (combat) {
        activeMatchText += `\n⏳ **Status Duel (Turn ${combat.turnCount}):**\n` +
          `• 🔴 **Challenger:** HP \`${combat.player1.hp}/${combat.player1.maxHP}\` | SP \`${combat.player1.energy}/100\`\n` +
          `• 🔵 **Opponent:** HP \`${combat.player2.hp}/${combat.player2.maxHP}\` | SP \`${combat.player2.energy}/100\``;
      }
    }
  }

  const embed = new EmbedBuilder()
    .setColor(isPaused ? 0xF59E0B : 0x10B981) // Orange if paused, Green if running
    .setTitle('🛠️ LIGA PET TOURNAMENT DASHBOARD')
    .setDescription(
      `Panel kendali Administrator untuk mengatur jalannya Liga Pet secara real-time.\n` +
      `▬`.repeat(15)
    )
    .addFields(
      { name: '📶 Status Liga', value: `\`${statusLabel}\` ${isPaused ? '⏸️ **(JEDA)**' : '▶️ **(BERJALAN)**'}`, inline: true },
      { name: '📅 Ronde Aktif', value: `Ronde **${event.current_round}**`, inline: true },
      { name: '⚔️ Pertandingan Aktif', value: activeMatchText, inline: false },
      { name: '🎮 Panduan Kontrol', value: `• **Pause/Resume:** Menjeda/melanjutkan antrean laga.\n• **Re-roll:** Mengulang duel aktif dari awal.\n• **DQ/Force Win:** Diskualifikasi atau memenangkan paksa pet aktif.\n• **Perpanjang:** Memberi tambahan waktu pendaftaran.`, inline: false }
    )
    .setFooter({ text: 'Admin Cup Panel • Staff Control' })
    .setTimestamp();

  const row1 = new ActionRowBuilder();
  if (isPaused) {
    row1.addComponents(
      new ButtonBuilder()
        .setCustomId(`cup_admin_resume`)
        .setLabel('▶️ Lanjutkan (Resume)')
        .setStyle(ButtonStyle.Success)
    );
  } else {
    row1.addComponents(
      new ButtonBuilder()
        .setCustomId(`cup_admin_pause`)
        .setLabel('⏸️ Jeda (Pause)')
        .setStyle(ButtonStyle.Secondary)
    );
  }

  row1.addComponents(
    new ButtonBuilder()
      .setCustomId(`cup_admin_reroll`)
      .setLabel('🔄 Re-roll')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!activeMatch),
    new ButtonBuilder()
      .setCustomId(`cup_admin_dq`)
      .setLabel('⚠️ DQ Player')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!activeMatch),
    new ButtonBuilder()
      .setCustomId(`cup_admin_forcewin`)
      .setLabel('👑 Force Win')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!activeMatch)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`cup_admin_extend`)
      .setLabel('⏱️ Perpanjang Registrasi')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(statusLabel !== 'REGISTERING'),
    new ButtonBuilder()
      .setCustomId(`cup_admin_stop`)
      .setLabel('❌ Batalkan Turnamen')
      .setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [row1, row2] };
}

/**
 * Memperbarui tampilan panel admin.
 */
async function updateAdminPanel(guildId, client) {
  const event = db.get('SELECT * FROM tournament_events WHERE guild_id = ?', [guildId]);
  if (!event || !event.admin_panel_message_id || !event.admin_panel_channel_id) return;

  const channel = client.channels.cache.get(event.admin_panel_channel_id) || await client.channels.fetch(event.admin_panel_channel_id).catch(() => null);
  if (!channel) return;

  const msg = await channel.messages.fetch(event.admin_panel_message_id).catch(() => null);
  if (!msg) return;

  const data = getAdminPanelData(guildId, client);
  await msg.edit(data).catch(() => {});
}

/**
 * Menjeda turnamen.
 */
async function pauseTournament(guildId, client) {
  const event = db.get('SELECT * FROM tournament_events WHERE guild_id = ?', [guildId]);
  if (!event) throw new Error('Tidak ada turnamen aktif.');
  db.run('UPDATE tournament_events SET is_paused = 1 WHERE guild_id = ?', [guildId]);
  await updateAdminPanel(guildId, client).catch(() => {});
}

/**
 * Melanjutkan turnamen.
 */
async function resumeTournament(guildId, client) {
  const event = db.get('SELECT * FROM tournament_events WHERE guild_id = ?', [guildId]);
  if (!event) throw new Error('Tidak ada turnamen aktif.');
  db.run('UPDATE tournament_events SET is_paused = 0 WHERE guild_id = ?', [guildId]);
  await updateAdminPanel(guildId, client).catch(() => {});

  if (event.status === 'PLAYING') {
    const activeMatch = db.get('SELECT * FROM tournament_matches WHERE guild_id = ? AND match_status = \'ACTIVE\'', [guildId]);
    if (!activeMatch) {
      executeNextMatch(guildId, client);
    }
  }
}

/**
 * Diskualifikasi pemain.
 */
async function dqPlayer(guildId, playerId, client) {
  const match = db.get(
    'SELECT * FROM tournament_matches WHERE guild_id = ? AND match_status = \'ACTIVE\' LIMIT 1',
    [guildId]
  );
  if (!match) throw new Error('Tidak ada pertandingan aktif untuk diskualifikasi.');

  const winnerId = match.player_1_id === playerId ? match.player_2_id : match.player_1_id;
  if (!winnerId) throw new Error('Lawan tidak ditemukan.');

  const threadChannel = client.channels.cache.get(match.thread_id || match.threadId) || await client.channels.fetch(match.thread_id || match.threadId).catch(() => null);
  if (threadChannel) {
    await threadChannel.send(`⚠️ <@${playerId}> **telah didiskualifikasi oleh Admin!**`).catch(() => {});
  }

  await endMatch(match.match_id, winnerId, 'defeat', client);
  await updateAdminPanel(guildId, client).catch(() => {});
}

/**
 * Menangkan paksa pemain.
 */
async function forceWinPlayer(guildId, playerId, client) {
  const match = db.get(
    'SELECT * FROM tournament_matches WHERE guild_id = ? AND match_status = \'ACTIVE\' LIMIT 1',
    [guildId]
  );
  if (!match) throw new Error('Tidak ada pertandingan aktif untuk dimenangkan paksa.');

  if (match.player_1_id !== playerId && match.player_2_id !== playerId) {
    throw new Error('Pemain terpilih bukan bagian dari pertandingan aktif.');
  }

  const threadChannel = client.channels.cache.get(match.thread_id || match.threadId) || await client.channels.fetch(match.thread_id || match.threadId).catch(() => null);
  if (threadChannel) {
    await threadChannel.send(`⚠️ Admin memberikan **kemenangan paksa** kepada <@${playerId}>!`).catch(() => {});
  }

  await endMatch(match.match_id, playerId, 'defeat', client);
  await updateAdminPanel(guildId, client).catch(() => {});
}

/**
 * Reset ulang pertandingan aktif.
 */
async function rerollMatch(guildId, client) {
  const matchRow = db.get(
    'SELECT * FROM tournament_matches WHERE guild_id = ? AND match_status = \'ACTIVE\' LIMIT 1',
    [guildId]
  );
  if (!matchRow) throw new Error('Tidak ada pertandingan aktif untuk di-reset.');

  const matchId = matchRow.match_id;
  const match = client.activeCupMatches.get(matchId);
  if (!match) throw new Error('Data pertarungan aktif tidak ditemukan di memori.');

  if (match.timer) {
    clearTimeout(match.timer);
    match.timer = null;
  }

  const p1Pet = getRegisteredPet(matchRow.player_1_id, guildId);
  const p2Pet = getRegisteredPet(matchRow.player_2_id, guildId);

  const maxHp1 = pet.getMaxHP(p1Pet);
  const maxHp2 = pet.getMaxHP(p2Pet);

  match.turnCount = 1;
  match.logs = [`🔄 Pertandingan di-reset oleh Admin! Memulai ulang duel antara **${p1Pet.pet_name}** dan **${p2Pet.pet_name}**.`];
  
  match.player1.hp = maxHp1;
  match.player1.maxHP = maxHp1;
  match.player1.energy = 30;
  match.player1.timeouts = 0;
  match.player1.elemCooldown = 0;
  match.player1.hasUsedUltimate = false;
  match.player1.isDefending = false;
  match.player1.burnTurns = 0;
  match.player1.shieldTurns = 0;
  match.player1.chosenAction = null;

  match.player2.hp = maxHp2;
  match.player2.maxHP = maxHp2;
  match.player2.energy = 30;
  match.player2.timeouts = 0;
  match.player2.elemCooldown = 0;
  match.player2.hasUsedUltimate = false;
  match.player2.isDefending = false;
  match.player2.burnTurns = 0;
  match.player2.shieldTurns = 0;
  match.player2.chosenAction = null;

  match.turnEndUnix = Math.floor(Date.now() / 1000) + 45;

  const threadChannel = client.channels.cache.get(match.threadId) || await client.channels.fetch(match.threadId).catch(() => null);
  if (threadChannel) {
    await threadChannel.send(`🔄 **Pertandingan di-reset oleh Admin!** Memulai ulang dari awal...`).catch(() => {});
  }

  await updateBattleEmbed(matchId, client);
  startTurnTimer(matchId, client);
  await updateAdminPanel(guildId, client).catch(() => {});
}

/**
 * Perpanjang waktu pendaftaran.
 */
async function extendRegistration(guildId, mins, client) {
  const event = db.get('SELECT * FROM tournament_events WHERE guild_id = ? AND status = \'REGISTERING\'', [guildId]);
  if (!event) throw new Error('Pendaftaran turnamen tidak sedang aktif.');

  const newEndRegAt = event.registration_end_at + (mins * 60);
  db.run('UPDATE tournament_events SET registration_end_at = ? WHERE guild_id = ?', [newEndRegAt, guildId]);

  await updateRegistrationEmbed(guildId, client);

  if (client.tournamentTimers && client.tournamentTimers.has(guildId)) {
    clearTimeout(client.tournamentTimers.get(guildId));
  }

  client.tournamentTimers = client.tournamentTimers || new Map();
  const remainingTimeMs = (newEndRegAt - Math.floor(Date.now() / 1000)) * 1000;
  const newTimer = setTimeout(() => {
    closeRegistrationAndGenerateBracket(guildId, client);
  }, Math.max(0, remainingTimeMs));
  
  client.tournamentTimers.set(guildId, newTimer);
  await updateAdminPanel(guildId, client).catch(() => {});
}

/**
 * Menyusun papan klasemen liga saat ini dalam format tabel ASCII yang rapi.
 */
function getLeagueStandingsString(guildId) {
  const participants = db.all('SELECT * FROM tournament_participants WHERE guild_id = ?', [guildId]);
  const matches = db.all('SELECT * FROM tournament_matches WHERE guild_id = ? AND match_status = \'COMPLETED\'', [guildId]);

  const standings = participants.map(p => {
    let played = 0;
    let won = 0;
    matches.forEach(m => {
      if (m.player_1_id === p.user_id || m.player_2_id === p.user_id) {
        played++;
        if (m.winner_id === p.user_id) {
          won++;
        }
      }
    });
    const lost = played - won;
    const points = won * 3;
    return {
      userId: p.user_id,
      petName: p.pet_name,
      played,
      won,
      lost,
      points
    };
  });

  // Urutkan berdasarkan poin desc, lalu jumlah menang desc, lalu nama pet
  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.won !== a.won) return b.won - a.won;
    return a.petName.localeCompare(b.petName);
  });

  // Buat tabel klasemen
  let table = '🏆 KLASEMEN LIGA PET 🏆\n';
  table += '┌────┬──────────────────────┬────┬────┬────┬─────┐\n';
  table += '│ Pos│ Pet (Pawang)         │ M  │ S  │ K  │ Pts │\n';
  table += '├────┼──────────────────────┼────┼────┼────┼─────┤\n';
  
  standings.forEach((s, idx) => {
    const pos = String(idx + 1).padStart(2, ' ');
    let name = s.petName;
    if (name.length > 20) name = name.slice(0, 17) + '...';
    const nameCol = name.padEnd(20, ' ');
    const m = String(s.played).padStart(2, ' ');
    const w = String(s.won).padStart(2, ' ');
    const l = String(s.lost).padStart(2, ' ');
    const pts = String(s.points).padStart(3, ' ');
    table += `│ ${pos} │ ${nameCol} │ ${m} │ ${w} │ ${l} │ ${pts} │\n`;
  });
  
  table += '└────┴──────────────────────┴────┴────┴────┴─────┘';
  return table;
}

/**
 * Membuat penjadwalan liga Round Robin (Circle Method).
 */
function generateRoundRobinMatches(players) {
  const list = [...players];
  if (list.length % 2 !== 0) {
    list.push(null); // merepresentasikan BYE jika ganjil
  }
  
  const numPlayers = list.length;
  const numRounds = numPlayers - 1;
  const matches = [];
  
  for (let round = 1; round <= numRounds; round++) {
    for (let i = 0; i < numPlayers / 2; i++) {
      const p1 = list[i];
      const p2 = list[numPlayers - 1 - i];
      if (p1 !== null && p2 !== null) {
        matches.push({ round, p1, p2 });
      } else if (p1 !== null) {
        matches.push({ round, p1, p2: null, winner: p1 });
      } else if (p2 !== null) {
        matches.push({ round, p1: null, p2, winner: p2 });
      }
    }
    // Rotasi pemain (indeks 0 tetap)
    const last = list[numPlayers - 1];
    for (let k = numPlayers - 1; k > 1; k--) {
      list[k] = list[k - 1];
    }
    list[1] = last;
  }
  return matches;
}

module.exports = {
  startTournament,
  stopTournament,
  registerParticipant,
  getRegisteredPet,
  registerOrUpdateParticipant,
  unregisterParticipant,
  saveAnnounceMessageId,
  updateRegistrationEmbed,
  closeRegistrationAndGenerateBracket,
  executeNextMatch,
  processTurn,
  endMatch,
  endTournament,
  createTournamentChannel,
  getLeagueStandingsString,
  getMatchQueueString,
  getAdminPanelData,
  updateAdminPanel,
  pauseTournament,
  resumeTournament,
  dqPlayer,
  forceWinPlayer,
  rerollMatch,
  extendRegistration
};
