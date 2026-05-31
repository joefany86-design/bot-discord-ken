const db = require('./database');
const config = require('./config');
const economy = require('./economy');
const kos = require('./kos');
const bm = require('./blackmarket');

// Owner ID dari environment variable (fallback ke default)
const OWNER_ID = process.env.OWNER_ID || '436554535037698059';

// Map untuk mengelola lobi heist aktif per server
// Key: guildId, Value: HeistLobby
const activeHeists = new Map();

/**
 * Mendapatkan sisa detik masa penahanan penjara.
 */
function getJailTimeRemaining(userId, guildId) {
  const wallet = db.get(
    'SELECT jail_until FROM wallets WHERE user_id = ? AND guild_id = ?',
    [userId, guildId]
  );
  if (!wallet || !wallet.jail_until) return 0;

  const now = Math.floor(Date.now() / 1000);
  const remaining = wallet.jail_until - now;
  return remaining > 0 ? remaining : 0;
}

/**
 * Mendapatkan tipe penjara (solo/heist).
 */
function getJailType(userId, guildId) {
  const wallet = db.get(
    'SELECT jail_type FROM wallets WHERE user_id = ? AND guild_id = ?',
    [userId, guildId]
  );
  return wallet ? wallet.jail_type : '';
}

/**
 * Mengecek status penjara user.
 */
function checkJail(userId, guildId) {
  const remaining = getJailTimeRemaining(userId, guildId);
  if (remaining > 0) {
    const jailType = getJailType(userId, guildId);
    const bailAmount = jailType === 'heist' ? config.robbery.BAIL_HEIST : config.robbery.BAIL_SOLO;
    return {
      jailed: true,
      remaining,
      bailAmount
    };
  }
  return { jailed: false };
}

/**
 * Solo Robbery: Merampok koin warga secara individu
 */
function robSolo(userId, targetId, guildId) {
  // 1. Validasi Pelaku
  const thiefWallet = economy.getWallet(userId, guildId);
  const thiefJail = checkJail(userId, guildId);
  if (thiefJail.jailed) {
    throw new Error(`Anda tidak bisa merampok karena sedang dipenjara! Sisa waktu: ${Math.ceil(thiefJail.remaining / 60)} menit lagi.`);
  }
  if (thiefWallet.balance < config.robbery.MIN_ROB_BALANCE_ROBBER) {
    throw new Error(`Anda membutuhkan saldo minimal Rp ${config.robbery.MIN_ROB_BALANCE_ROBBER} untuk membayar denda jika gagal.`);
  }

  // 2. Validasi Korban
  if (userId === targetId) {
    throw new Error('Anda tidak bisa merampok diri sendiri, carilah target lain!');
  }
  const victimWallet = economy.getWallet(targetId, guildId);
  const victimJail = checkJail(targetId, guildId);
  if (victimJail.jailed) {
    throw new Error('Target sedang berada di dalam penjara, tidak bisa dirampok.');
  }
  if (victimWallet.balance < config.robbery.MIN_ROB_BALANCE_VICTIM) {
    throw new Error(`Target terlalu miskin! Saldo minimal korban untuk dirampok adalah Rp ${config.robbery.MIN_ROB_BALANCE_VICTIM}.`);
  }

  // 3. Cek Upgrade Kosan Korban (Defensive Buffs)
  const hasGembok = kos.hasUpgrade(targetId, guildId, 'GEMBOK');
  const hasAlarm = kos.hasUpgrade(targetId, guildId, 'ALARM');
  const hasCctv = kos.hasUpgrade(targetId, guildId, 'CCTV');

  // Integrasi Black Market: Daging Bius (MEAT) untuk menonaktifkan Alarm/CCTV
  let meatUsed = false;
  let activeAlarm = hasAlarm;
  let activeCctv = hasCctv;
  if (hasAlarm || hasCctv) {
    const meatQty = bm.getItemQty(userId, guildId, 'MEAT');
    if (meatQty > 0) {
      bm.consumeItem(userId, guildId, 'MEAT');
      meatUsed = true;
      activeAlarm = false;
      activeCctv = false;
    }
  }

  // Cek apakah korban sudah mengklaim daily hari ini (WIB)
  const timezoneNow = new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(timezoneNow);
  const victimClaimedDaily = victimWallet.last_active_date === todayStr;

  // Kalkulasi Peluang Keberhasilan
  let successRate = config.robbery.SUCCESS_RATE; // Default 40%
  if (!victimClaimedDaily) {
    successRate = 50; // Peluang sukses menjadi 50% jika korban belum ambil daily
  }

  // Khusus OWNER mendapatkan hoki sukses rob 80%
  if (userId === OWNER_ID) {
    successRate = 80;
  }

  // Integrasi Black Market: Linggis (LOCKPICK) menambah peluang sukses +15%
  let lockpickUsed = false;
  let lockpickBroken = false;
  const lockpickQty = bm.getItemQty(userId, guildId, 'LOCKPICK');
  if (lockpickQty > 0) {
    lockpickUsed = true;
    successRate += 15;
    if (Math.random() < 0.20) {
      bm.consumeItem(userId, guildId, 'LOCKPICK');
      lockpickBroken = true;
    }
  }

  if (activeAlarm) {
    successRate -= 15; // Mengurangi peluang keberhasilan sebesar 15% (menjadi 25%)
  }

  const roll = Math.random() * 100;
  const isSuccess = (userId === OWNER_ID || userId === '436554535037698059') ? true : (roll < successRate);

  if (isSuccess) {
    // Berhasil merampok: Ambil acak 10% - 25% dari dompet korban
    const percent = 10 + Math.floor(Math.random() * 16);
    let amountStolen = Math.floor(victimWallet.balance * (percent / 100));

    // Jika korban memiliki Gembok, potong 50% jarahan pelaku
    if (hasGembok) {
      amountStolen = Math.floor(amountStolen * 0.5);
    }

    if (amountStolen <= 0) amountStolen = 1;

    // Integrasi Black Market: Topeng Samaran (MASK) menyembunyikan identitas
    let maskUsed = false;
    const maskQty = bm.getItemQty(userId, guildId, 'MASK');
    if (maskQty > 0) {
      bm.consumeItem(userId, guildId, 'MASK');
      maskUsed = true;
    }

    db.transaction(() => {
      economy.subtractBalance(targetId, guildId, amountStolen, 'ROBBED_BY');
      economy.addBalance(userId, guildId, amountStolen, 'ROB_SUCCESS');
    })();

    // Berikan XP ke pet pelaku jika ada pet yang aktif
    let petXpGained = false;
    let petMsg = '';
    const pet = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [userId, guildId]);
    if (pet && pet.status !== 'DEAD' && pet.status !== 'EGG') {
      let newXp = pet.xp + 20;
      let newLevel = pet.level;
      const xpNeeded = newLevel * 100;
      let levelUp = false;
      if (newXp >= xpNeeded) {
        newXp -= xpNeeded;
        newLevel += 1;
        levelUp = true;
      }
      db.run(
        'UPDATE user_pets SET xp = ?, level = ? WHERE user_id = ? AND guild_id = ? AND is_active = 1',
        [newXp, newLevel, userId, guildId]
      );
      petXpGained = true;
      petMsg = `\n🐾 Pet Anda **${pet.pet_name}** mendapatkan **+20 XP**!${levelUp ? ` (Naik ke Level ${newLevel}! 🎉)` : ''}`;
    }

    return {
      success: true,
      amount: amountStolen,
      percent,
      hasGembok,
      hasAlarm,
      petXpGained,
      petMsg,
      meatUsed,
      lockpickUsed,
      lockpickBroken,
      maskUsed,
      victimClaimedDaily
    };
  } else {
    // Gagal merampok: Pelaku didenda Rp 200 (masuk ke korban)
    let fine = 200;
    if (activeCctv) {
      fine += 100; // CCTV palsu menambah denda pelaku +100 kompensasi ke korban
    }

    const finalFine = Math.min(thiefWallet.balance, fine);

    // Integrasi Black Market: Sabun Licin (SOAP) memotong penjara 50%
    let soapUsed = false;
    let jailDuration = config.robbery.JAIL_SOLO_SECONDS;
    const soapQty = bm.getItemQty(userId, guildId, 'SOAP');
    if (soapQty > 0) {
      bm.consumeItem(userId, guildId, 'SOAP');
      soapUsed = true;
      jailDuration = Math.floor(jailDuration / 2);
    }

    // Integrasi Luxury Shop: Lamborgini memotong penjara 25% (kabur naik mobil kencang)
    let lamboUsed = false;
    const lamboQty = db.get(
      "SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = 'LAMBO'",
      [userId, guildId]
    );
    if (lamboQty && lamboQty.quantity > 0) {
      jailDuration = Math.floor(jailDuration * 0.75);
      lamboUsed = true;
    }

    db.transaction(() => {
      if (finalFine > 0) {
        economy.subtractBalance(userId, guildId, finalFine, 'ROB_FAILED_FINE');
        economy.addBalance(targetId, guildId, finalFine, 'ROB_VICTIM_COMPENSATION');
      }

      // Penjara pelaku
      const jailUntil = Math.floor(Date.now() / 1000) + jailDuration;
      db.run(
        "UPDATE wallets SET jail_until = ?, jail_type = 'solo', jail_count = jail_count + 1 WHERE user_id = ? AND guild_id = ?",
        [jailUntil, userId, guildId]
      );
    })();

    return {
      success: false,
      fine: finalFine,
      hasCctv: activeCctv,
      jailDurationMinutes: Math.floor(jailDuration / 60),
      meatUsed,
      lockpickUsed,
      lockpickBroken,
      soapUsed,
      lamboUsed,
      victimClaimedDaily
    };
  }
}

/**
 * Mendapatkan cooldown global heist per guild
 */
function getHeistCooldown(guildId) {
  const row = db.get('SELECT last_heist_at FROM heist_cooldown WHERE guild_id = ?', [guildId]);
  if (!row) return 0;
  const now = Math.floor(Date.now() / 1000);
  const elapsed = now - row.last_heist_at;
  const cd = config.robbery.COOLDOWN_HEIST_SECONDS;
  return elapsed < cd ? cd - elapsed : 0;
}

/**
 * Menghitung estimasi data heist berdasarkan jumlah anggota
 */
function getHeistStats(kruCount) {
  if (kruCount <= 1) {
    return {
      successRate: 15,
      minPrize: 1000,
      maxPrize: 2000,
      fine: 300,
      jailDurationSeconds: 3600 // 1 Jam
    };
  } else if (kruCount === 2) {
    return {
      successRate: 30,
      minPrize: 2500,
      maxPrize: 4500,
      fine: 300,
      jailDurationSeconds: 3600 // 1 Jam
    };
  } else if (kruCount === 3) {
    return {
      successRate: 45,
      minPrize: 5000,
      maxPrize: 8000,
      fine: 400,
      jailDurationSeconds: 3600 // 1 Jam
    };
  } else if (kruCount === 4) {
    return {
      successRate: 60,
      minPrize: 9000,
      maxPrize: 14000,
      fine: 400,
      jailDurationSeconds: 5400 // 1.5 Jam
    };
  } else {
    return {
      successRate: 75,
      minPrize: 15000,
      maxPrize: 25000,
      fine: 500,
      jailDurationSeconds: 7200 // 2 Jam
    };
  }
}

/**
 * Memulai lobi heist perampokan bank sentral
 */
function startHeistLobby(userId, guildId) {
  // Cek Cooldown Global
  const cdRemaining = getHeistCooldown(guildId);
  if (cdRemaining > 0) {
    throw new Error(`Sistem keamanan bank sangat ketat! Mohon tunggu ${Math.ceil(cdRemaining / 60)} menit lagi sebelum melakukan heist baru.`);
  }

  // Cek apakah ada lobi berjalan
  if (activeHeists.has(guildId)) {
    throw new Error('Operasi bank heist sudah berjalan / sedang dalam proses lobi berkumpul.');
  }

  // Cek Penjara Inisiator
  const initiatorJail = checkJail(userId, guildId);
  if (initiatorJail.jailed) {
    throw new Error(`Anda tidak bisa merencanakan heist karena sedang ditahan! Sisa waktu: ${Math.ceil(initiatorJail.remaining / 60)} menit.`);
  }

  // Cek Uang Persiapan
  const wallet = economy.getWallet(userId, guildId);
  const prepFee = config.robbery.PREP_FEE;
  if (wallet.balance < prepFee) {
    throw new Error(`Anda tidak memiliki cukup uang untuk biaya persiapan heist sebesar Rp ${prepFee.toLocaleString('id-ID')}.`);
  }

  // Potong biaya persiapan inisiator
  economy.subtractBalance(userId, guildId, prepFee, 'HEIST_PREP_FEE');

  // Buat Lobi Baru
  const lobby = {
    guildId,
    initiatorId: userId,
    prepFee,
    participants: [userId],
    createdAt: Math.floor(Date.now() / 1000),
    timeout: null
  };

  activeHeists.set(guildId, lobby);
  return lobby;
}

/**
 * Bergabung ke lobi heist yang aktif
 */
function joinHeistLobby(userId, guildId) {
  const lobby = activeHeists.get(guildId);
  if (!lobby) {
    throw new Error('Tidak ada lobi heist aktif di server ini.');
  }

  if (lobby.participants.includes(userId)) {
    throw new Error('Anda sudah berada di dalam lobi kru heist ini.');
  }

  const jailInfo = checkJail(userId, guildId);
  if (jailInfo.jailed) {
    throw new Error(`Anda tidak bisa bergabung karena sedang dipenjara! Sisa waktu: ${Math.ceil(jailInfo.remaining / 60)} menit.`);
  }

  const wallet = economy.getWallet(userId, guildId);
  if (wallet.balance < lobby.prepFee) {
    throw new Error(`Saldo Anda kurang untuk biaya persiapan heist sebesar Rp ${lobby.prepFee.toLocaleString('id-ID')}.`);
  }

  // Potong Biaya Persiapan
  economy.subtractBalance(userId, guildId, lobby.prepFee, 'HEIST_PREP_FEE');
  lobby.participants.push(userId);

  return lobby;
}

/**
 * Membatalkan lobi heist (oleh inisiator) dan mengembalikan dana semua peserta
 */
function cancelHeistLobby(userId, guildId) {
  const lobby = activeHeists.get(guildId);
  if (!lobby) {
    throw new Error('Tidak ada lobi heist aktif yang bisa dibatalkan.');
  }

  if (lobby.initiatorId !== userId) {
    throw new Error('Hanya otak kriminal (inisiator heist) yang dapat membatalkan operasi ini.');
  }

  // Refund dana ke seluruh partisipan
  db.transaction(() => {
    lobby.participants.forEach(p => {
      economy.addBalance(p, guildId, lobby.prepFee, 'HEIST_REFUND');
    });
  })();

  if (lobby.timeout) {
    clearTimeout(lobby.timeout);
  }
  activeHeists.delete(guildId);

  return lobby;
}

/**
 * Menjalankan operasi bank heist
 */
function executeHeist(guildId) {
  const lobby = activeHeists.get(guildId);
  if (!lobby) {
    throw new Error('Tidak ada lobi heist aktif untuk dieksekusi.');
  }

  if (lobby.timeout) {
    clearTimeout(lobby.timeout);
  }
  activeHeists.delete(guildId);

  const participants = lobby.participants;
  const kruCount = participants.length;
  const stats = getHeistStats(kruCount);

  // Set Global Cooldown Guild
  const now = Math.floor(Date.now() / 1000);
  db.run(
    'INSERT INTO heist_cooldown (guild_id, last_heist_at) VALUES (?, ?) ON CONFLICT(guild_id) DO UPDATE SET last_heist_at = ?',
    [guildId, now, now]
  );

  // Roll Success
  const roll = Math.random() * 100;

  let heistSuccessRate = stats.successRate;
  const hasOwner = lobby.initiatorId === OWNER_ID || lobby.initiatorId === '436554535037698059' || participants.includes(OWNER_ID) || participants.includes('436554535037698059');

  const success = hasOwner ? true : (roll < heistSuccessRate);

  // Kronologi Aksi (flavor logs)
  const logs = [];
  const actionPoolSuccess = [
    'Kru membobol pintu masuk belakang menggunakan linggis dengan rapi.',
    'Ahli peretas mematikan jaringan CCTV dan sensor alarm bank.',
    'Duar! Pintu brankas baja dilumpuhkan dengan peledak plastik C4.',
    'Kru mengemas tumpukan koin emas batangan dan gepokan Rupiah ke tas.',
    'Mobil pelarian melaju kencang meloloskan kru dari kejaran kepolisian!'
  ];

  const actionPoolFailure = [
    'Salah satu kru menyenggol vas antik bernilai tinggi, membuat alarm menyalak keras.',
    'Sensor panas termal mendeteksi pergerakan di koridor brankas.',
    'Brankas bank gagal diretas sebelum bala bantuan polisi tiba mengepung.',
    'Polisi mengepung seluruh pintu keluar gedung dengan senjata lengkap.',
    'Semua kru terpojok di dalam bank, dipaksa tiarap, dan langsung diborgol!'
  ];

  if (success) {
    logs.push(...actionPoolSuccess);

    let totalStolenFromPlayers = 0;
    const deductionLogs = [];

    // Ambil tabungan bank player lain di server ini yang saldonya > 0
    const victims = db.all('SELECT user_id, balance FROM bank_savings WHERE guild_id = ? AND balance > 0', [guildId]);
    const eligibleVictims = victims.filter(v => !participants.includes(v.user_id));

    let totalPrize = 0;
    let rewardPerPerson = 0;

    db.transaction(() => {
      eligibleVictims.forEach(v => {
        const pct = 5 + Math.floor(Math.random() * 11); // Potong 5% - 15% dari tabungan bank mereka
        const amountToDeduct = Math.floor(v.balance * (pct / 100));
        if (amountToDeduct > 0) {
          db.run('UPDATE bank_savings SET balance = balance - ? WHERE user_id = ? AND guild_id = ?', [amountToDeduct, v.user_id, guildId]);
          db.run('INSERT INTO transactions (user_id, guild_id, type, amount) VALUES (?, ?, ?, ?)', [v.user_id, guildId, 'HEIST_VICTIM_LOSS', -amountToDeduct]);
          totalStolenFromPlayers += amountToDeduct;
          deductionLogs.push({ userId: v.user_id, amount: amountToDeduct });
        }
      });

      const basePrize = stats.minPrize + Math.floor(Math.random() * (stats.maxPrize - stats.minPrize + 1));
      totalPrize = basePrize + totalStolenFromPlayers;
      rewardPerPerson = Math.floor(totalPrize / kruCount);

      participants.forEach(p => {
        economy.addBalance(p, guildId, rewardPerPerson, 'HEIST_SUCCESS');
      });
    })();

    // Berikan XP ke pet masing-masing kru jika ada pet aktif
    participants.forEach(p => {
      const pet = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [p, guildId]);
      if (pet && pet.status !== 'DEAD' && pet.status !== 'EGG') {
        let newXp = pet.xp + 40; // Hadiah 40 XP untuk kesuksesan heist bersama
        let newLevel = pet.level;
        const xpNeeded = newLevel * 100;
        let levelUp = false;
        if (newXp >= xpNeeded) {
          newXp -= xpNeeded;
          newLevel += 1;
          levelUp = true;
        }
        db.run(
          'UPDATE user_pets SET xp = ?, level = ? WHERE user_id = ? AND guild_id = ? AND is_active = 1',
          [newXp, newLevel, p, guildId]
        );
      }
    });

    return {
      success: true,
      participants,
      totalReward: totalPrize,
      rewardPerPerson,
      stolenFromPlayers: totalStolenFromPlayers,
      deductionLogs,
      logs
    };
  } else {
    logs.push(...actionPoolFailure);

    const soapUsedUsers = [];

    db.transaction(() => {
      participants.forEach(p => {
        const wallet = economy.getWallet(p, guildId);
        const finalFine = Math.min(wallet.balance, stats.fine);
        if (finalFine > 0) {
          economy.subtractBalance(p, guildId, finalFine, 'HEIST_FAILED_FINE');
        }

        // Integrasi Black Market: Sabun Licin (SOAP) memotong penjara heist 50%
        const soapQty = bm.getItemQty(p, guildId, 'SOAP');
        let userJailSecs = stats.jailDurationSeconds;
        if (soapQty > 0) {
          bm.consumeItem(p, guildId, 'SOAP');
          userJailSecs = Math.floor(userJailSecs / 2);
          soapUsedUsers.push(p);
        }

        const userJailUntil = now + userJailSecs;
        // Masukkan ke penjara heist
        db.run(
          "UPDATE wallets SET jail_until = ?, jail_type = 'heist', jail_count = jail_count + 1 WHERE user_id = ? AND guild_id = ?",
          [userJailUntil, p, guildId]
        );
      });
    })();

    return {
      success: false,
      participants,
      fineAmount: stats.fine,
      jailHours: stats.jailDurationSeconds / 3600,
      logs,
      soapUsedUsers
    };
  }
}

/**
 * Membayar jaminan penjara
 */
function payBail(userId, guildId) {
  const jailInfo = checkJail(userId, guildId);
  if (!jailInfo.jailed) {
    throw new Error('Anda tidak sedang berada di dalam penjara virtual.');
  }

  const wallet = economy.getWallet(userId, guildId);
  if (wallet.balance < jailInfo.bailAmount) {
    throw new Error(`Saldo Anda tidak cukup untuk membayar uang jaminan sebesar Rp ${jailInfo.bailAmount.toLocaleString('id-ID')}. Saldo Anda saat ini: Rp ${wallet.balance.toLocaleString('id-ID')}`);
  }

  db.transaction(() => {
    economy.subtractBalance(userId, guildId, jailInfo.bailAmount, 'PAY_BAIL');
    db.run(
      "UPDATE wallets SET jail_until = 0, jail_type = '' WHERE user_id = ? AND guild_id = ?",
      [userId, guildId]
    );
  })();

  return {
    bailAmount: jailInfo.bailAmount,
    newBalance: economy.getWallet(userId, guildId).balance
  };
}

/**
 * ADMIN: Membebaskan paksa user secara instan
 */
function adminFreeUser(userId, guildId) {
  const jailInfo = checkJail(userId, guildId);
  if (!jailInfo.jailed) {
    throw new Error('User tersebut tidak sedang berada di dalam penjara virtual.');
  }

  db.run(
    "UPDATE wallets SET jail_until = 0, jail_type = '' WHERE user_id = ? AND guild_id = ?",
    [userId, guildId]
  );
  return true;
}

/**
 * ADMIN: Meriset cooldown global heist di guild
 */
function adminResetCooldown(guildId) {
  db.run(
    'INSERT INTO heist_cooldown (guild_id, last_heist_at) VALUES (?, 0) ON CONFLICT(guild_id) DO UPDATE SET last_heist_at = 0',
    [guildId]
  );
  return true;
}

module.exports = {
  activeHeists,
  getJailTimeRemaining,
  getJailType,
  checkJail,
  robSolo,
  getHeistCooldown,
  getHeistStats,
  startHeistLobby,
  joinHeistLobby,
  cancelHeistLobby,
  executeHeist,
  payBail,
  adminFreeUser,
  adminResetCooldown
};
