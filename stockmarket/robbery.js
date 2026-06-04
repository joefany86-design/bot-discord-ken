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
function checkJail(userId, guildId, member = null) {
  const remaining = getJailTimeRemaining(userId, guildId);
  if (remaining > 0) {
    const jailType = getJailType(userId, guildId);
    let bailAmount = jailType === 'heist' ? config.robbery.BAIL_HEIST : config.robbery.BAIL_SOLO;
    if (member) {
      const economy = require('./economy');
      const gachaTier = economy.getMemberGachaTier(member, guildId);
      if (gachaTier === 'EPIC') bailAmount = Math.round(bailAmount * 0.85); // -15%
      else if (gachaTier === 'LEGENDARY') bailAmount = Math.round(bailAmount * 0.75); // -25%
      else if (gachaTier === 'MYTHIC') bailAmount = Math.round(bailAmount * 0.50); // -50%
    }
    return {
      jailed: true,
      remaining,
      bailAmount,
      jailType
    };
  }
  return { jailed: false };
}

/**
 * Menghitung berapa kali seorang perampok menargetkan target tertentu dalam 24 jam terakhir.
 */
function getRobberToTargetCount(robberId, targetId, guildId) {
  const nowSec = Math.floor(Date.now() / 1000);
  const time24HoursAgo = nowSec - 24 * 3600;

  const result = db.get(
    `SELECT COUNT(*) as cnt 
     FROM robbery_attempts 
     WHERE robber_id = ? AND target_id = ? AND guild_id = ? 
       AND created_at >= ?`,
    [robberId, targetId, guildId, time24HoursAgo]
  );
  return result ? (result.cnt || 0) : 0;
}

/**
 * Solo Robbery: Merampok koin warga secara individu
 */
function robSolo(userId, targetId, guildId, robberMember = null, victimMember = null) {
  // 1. Validasi Pelaku
  const thiefWallet = economy.getWallet(userId, guildId);
  const thiefJail = checkJail(userId, guildId, robberMember);
  if (thiefJail.jailed) {
    throw new Error(`Anda tidak bisa merampok karena sedang dipenjara! Sisa waktu: ${Math.ceil(thiefJail.remaining / 60)} menit lagi.`);
  }

  // Cooldown sukses rob: 10 menit (600 detik)
  const nowSec = Math.floor(Date.now() / 1000);
  const lastRob = thiefWallet.last_rob_at || 0;
  const elapsedRob = nowSec - lastRob;
  const robCooldownSeconds = 300; // 5 menit
  if (elapsedRob < robCooldownSeconds) {
    const remainingMin = Math.ceil((robCooldownSeconds - elapsedRob) / 60);
    throw new Error(`Kaki Anda lelah setelah aksi sebelumnya! Mohon tunggu **${remainingMin} menit** lagi sebelum merampok kembali.`);
  }

  if (thiefWallet.balance < config.robbery.MIN_ROB_BALANCE_ROBBER) {
    throw new Error(`Anda membutuhkan saldo minimal Rp ${config.robbery.MIN_ROB_BALANCE_ROBBER} untuk membayar denda jika gagal.`);
  }

  // 2. Validasi Korban
  if (userId === targetId) {
    throw new Error('Anda tidak bisa merampok diri sendiri, carilah target lain!');
  }

  // Cek batas target rob personal (pelaku maksimal 10 kali menargetkan target yang sama dalam 24 jam)
  const personalCount = getRobberToTargetCount(userId, targetId, guildId);
  if (personalCount >= 10) {
    throw new Error('Anda sudah merampok target ini 10 kali dalam 24 jam terakhir! Silakan cari target lain.');
  }

  // Cek apakah target adalah bot di guild target
  const isTargetGuild = guildId === '1410239829874053296';
  let isBot = false;
  if (isTargetGuild && global.client) {
    const guild = global.client.guilds.cache.get(guildId);
    const member = guild?.members.cache.get(targetId);
    if (member?.user.bot) isBot = true;
  } else if (victimMember?.user?.bot) {
    isBot = true;
  }
  if (isBot) {
    throw new Error('Target adalah bot! Anda tidak bisa merampok bot.');
  }

  // 2a. Cek Perlindungan Owner (Anti-Rob) dengan Hukuman Langsung
  const { isOwnerProtectionActive } = require('./adminPanel');
  const isTargetOwner = targetId === OWNER_ID || targetId === '436554535037698059';
  if (isTargetOwner && isOwnerProtectionActive(guildId)) {
    const jailDuration = 36000; // 10 jam (36000 detik)
    const fine = Math.min(thiefWallet.balance, 10000);
    
    db.transaction(() => {
      if (fine > 0) {
        economy.subtractBalance(userId, guildId, fine, 'ROB_SULTAN_FINE');
      }
      const jailUntil = Math.floor(Date.now() / 1000) + jailDuration;
      db.run(
        "UPDATE wallets SET jail_until = ?, jail_type = 'solo', jail_count = jail_count + 1 WHERE user_id = ? AND guild_id = ?",
        [jailUntil, userId, guildId]
      );
      // Log attempt
      db.run(
        'INSERT INTO robbery_attempts (robber_id, target_id, guild_id, success, created_at) VALUES (?, ?, ?, ?, ?)',
        [userId, targetId, guildId, 0, Math.floor(Date.now() / 1000)]
      );
    })();

    return {
      success: false,
      fine,
      compensation: 0,
      hasCctv: false,
      caughtBySecurity: false,
      jailDurationMinutes: Math.floor(jailDuration / 60),
      meatUsed: false,
      lockpickUsed: false,
      lockpickBroken: false,
      soapUsed: false,
      lamboUsed: false,
      victimClaimedDaily: false,
      isVictimWanted: false,
      isSultanPunishment: true
    };
  }

  const victimWallet = economy.getWallet(targetId, guildId);
  const victimJail = checkJail(targetId, guildId, victimMember);
  if (victimJail.jailed) {
    throw new Error('Target sedang berada di dalam penjara, tidak bisa dirampok.');
  }
  if (victimWallet.balance < config.robbery.MIN_ROB_BALANCE_VICTIM) {
    throw new Error(`Target terlalu miskin! Saldo minimal korban untuk dirampok adalah Rp ${config.robbery.MIN_ROB_BALANCE_VICTIM}.`);
  }

  // 2b. Cek Kekebalan Gacha Mythic Korban
  if (victimMember) {
    const economy = require('./economy');
    const victimGachaTier = economy.getMemberGachaTier(victimMember, guildId);
    if (victimGachaTier === 'MYTHIC') {
      throw new Error(`❌ Target memiliki perlindungan Gacha Role **MYTHIC**! Mereka kebal total dari perampokan!`);
    }
  }

  // 3. Cek Upgrade Kosan Korban (Defensive Buffs)
  const hasGembok = kos.hasUpgrade(targetId, guildId, 'GEMBOK');
  const hasAlarm = kos.hasUpgrade(targetId, guildId, 'ALARM');
  const hasCctv = kos.hasUpgrade(targetId, guildId, 'CCTV');
  const activeRental = kos.getActiveRental(targetId, guildId);
  const hasSecurity = kos.hasUpgrade(targetId, guildId, 'SECURITY') && activeRental && activeRental.room_tier === 'PENTHOUSE';

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
  let successRate = config.robbery.SUCCESS_RATE; // Default 45%
  if (!victimClaimedDaily) {
    successRate = 50; // Peluang sukses menjadi 50% jika korban belum ambil daily
  }

  // Wanted Status check: jika korban adalah Wanted, pelaku mendapat bonus +15% sukses rate
  const isVictimWanted = victimWallet.wanted_until && victimWallet.wanted_until > nowSec;
  if (isVictimWanted) {
    successRate += 15;
  }

  // Gacha Role Bonus Sukses Rob Pelaku
  if (robberMember) {
    const economy = require('./economy');
    const gachaTier = economy.getMemberGachaTier(robberMember, guildId);
    if (gachaTier === 'COMMON') successRate += 2;
    else if (gachaTier === 'RARE') successRate += 5;
    else if (gachaTier === 'EPIC') successRate += 8;
    else if (gachaTier === 'LEGENDARY') successRate += 15;
    else if (gachaTier === 'MYTHIC') successRate += 25;
  }

  // Khusus OWNER: Cek God Mode dari panel .ow
  const { isOwnerGodModeActive } = require('./adminPanel');
  const ownerGodMode = (userId === OWNER_ID || userId === '436554535037698059') && isOwnerGodModeActive(guildId);
  if (ownerGodMode) {
    successRate = 100;
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
  } else {
    // PENALTY KESULITAN: Jika tidak menggunakan LOCKPICK, peluang dikurangi drastis -18%!
    successRate -= 18;
  }

  if (activeAlarm) {
    successRate -= 15; // Mengurangi peluang keberhasilan sebesar 15%
  }

  if (hasSecurity) {
    successRate -= 35; // Security Penthouse: Mengurangi peluang sukses sebesar 35%
  }

  // Peluang sukses minimal 5% (agar tidak bernilai negatif/0% murni)
  successRate = Math.max(5, successRate);

  const roll = Math.random() * 100;
  let isSuccess = ownerGodMode ? true : (roll < successRate);

  if (isSuccess) {
    // Berhasil merampok: Ambil acak 10% - 25% dari dompet korban
    const percent = 10 + Math.floor(Math.random() * 16);
    let amountStolen = Math.floor(victimWallet.balance * (percent / 100));

    // Jika korban memiliki Gembok, potong 50% jarahan pelaku
    if (hasGembok) {
      amountStolen = Math.floor(amountStolen * 0.5);
    }

    // Gacha Role Proteksi Korban (Diskon Kehilangan Koin)
    if (victimMember) {
      const economy = require('./economy');
      const victimGachaTier = economy.getMemberGachaTier(victimMember, guildId);
      if (victimGachaTier === 'RARE') {
        amountStolen = Math.floor(amountStolen * 0.90); // -10%
      } else if (victimGachaTier === 'EPIC') {
        amountStolen = Math.floor(amountStolen * 0.80); // -20%
      } else if (victimGachaTier === 'LEGENDARY') {
        amountStolen = Math.floor(amountStolen * 0.65); // -35%
      } else if (victimGachaTier === 'MYTHIC') {
        amountStolen = 0; // Kebal total
      }
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

      // Set last_rob_at pelaku untuk cooldown sukses
      db.run(
        'UPDATE wallets SET last_rob_at = ? WHERE user_id = ? AND guild_id = ?',
        [nowSec, userId, guildId]
      );

      // Cek Wanted Status pelaku (jika jarahan >= Rp 1.500)
      if (amountStolen >= 1500) {
        const wantedUntil = nowSec + 7200; // 2 jam status buronan
        db.run(
          'UPDATE wallets SET wanted_until = ? WHERE user_id = ? AND guild_id = ?',
          [wantedUntil, userId, guildId]
        );
      }

      // Log attempt
      db.run(
        'INSERT INTO robbery_attempts (robber_id, target_id, guild_id, success, created_at) VALUES (?, ?, ?, ?, ?)',
        [userId, targetId, guildId, 1, nowSec]
      );
    })();

    // Increment daily quest progress for ROB
    const petMod = require('./pet');
    petMod.incrementQuestProgress(userId, guildId, 'ROB', 1);

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
      victimClaimedDaily,
      isVictimWanted,
      gotWanted: amountStolen >= 1500
    };
  } else {
    // Gagal merampok: Pelaku didenda Rp 200 (atau lebih)
    let fine = 200;
    if (activeCctv) {
      fine += 100; // CCTV palsu menambah denda pelaku +100 kompensasi ke korban
    }

    // PENALTY TANPA LOCKPICK: Denda meningkat +Rp 150 jika merampok tanpa Lockpick!
    if (!lockpickUsed) {
      fine += 150;
    }

    const finalFine = Math.min(thiefWallet.balance, fine);

    // Integrasi Black Market: Sabun Licin (SOAP) memotong penjara 50%
    let soapUsed = false;
    let jailDuration = config.robbery.JAIL_SOLO_SECONDS;

    // PENALTY TANPA LOCKPICK: Durasi penjara bertambah +50% karena tertangkap basah tanpa peralatan profesional
    if (!lockpickUsed) {
      jailDuration = Math.floor(jailDuration * 1.5);
    }

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

    // Diskon durasi penjara gacha role
    if (robberMember) {
      const gachaTier = economy.getMemberGachaTier(robberMember, guildId);
      if (gachaTier === 'RARE') jailDuration = Math.floor(jailDuration * 0.90);
      else if (gachaTier === 'EPIC') jailDuration = Math.floor(jailDuration * 0.80);
      else if (gachaTier === 'LEGENDARY') jailDuration = Math.floor(jailDuration * 0.65);
      else if (gachaTier === 'MYTHIC') jailDuration = Math.floor(jailDuration * 0.50);
    }

    const compensation = Math.round(finalFine * 0.75);

    db.transaction(() => {
      if (finalFine > 0) {
        economy.subtractBalance(userId, guildId, finalFine, 'ROB_FAILED_FINE');
        if (compensation > 0) {
          economy.addBalance(targetId, guildId, compensation, 'ROB_VICTIM_COMPENSATION');
        }
      }

      // Penjara pelaku
      const jailUntil = Math.floor(Date.now() / 1000) + jailDuration;
      db.run(
        "UPDATE wallets SET jail_until = ?, jail_type = 'solo', jail_count = jail_count + 1 WHERE user_id = ? AND guild_id = ?",
        [jailUntil, userId, guildId]
      );

      // Log attempt
      db.run(
        'INSERT INTO robbery_attempts (robber_id, target_id, guild_id, success, created_at) VALUES (?, ?, ?, ?, ?)',
        [userId, targetId, guildId, 0, nowSec]
      );
    })();

    return {
      success: false,
      fine: finalFine,
      compensation,
      hasCctv: activeCctv,
      caughtBySecurity: hasSecurity,
      jailDurationMinutes: Math.floor(jailDuration / 60),
      meatUsed,
      lockpickUsed,
      lockpickBroken,
      soapUsed,
      lamboUsed,
      victimClaimedDaily,
      isVictimWanted
    };
  }
}

/**
 * Mendapatkan sisa cooldown Heist per user
 */
function getUserHeistCooldown(userId, guildId) {
  const wallet = economy.getWallet(userId, guildId);
  const lastHeist = wallet.last_heist_at || 0;
  const now = Math.floor(Date.now() / 1000);
  const elapsed = now - lastHeist;
  const cd = config.robbery.COOLDOWN_HEIST_SECONDS;
  return elapsed < cd ? cd - elapsed : 0;
}

/**
 * Menghitung estimasi data heist berdasarkan jumlah anggota
 */
function getHeistStats(kruCount) {
  if (kruCount <= 1) {
    return {
      successRate: 5,
      minPrize: 1000,
      maxPrize: 2000,
      fine: 1000,                // Denda kru 1 dinaikkan dari Rp 500 ke Rp 1.000
      jailDurationSeconds: 7200 // 2 Jam
    };
  } else if (kruCount === 2) {
    return {
      successRate: 10,
      minPrize: 2500,
      maxPrize: 4500,
      fine: 1500,                // Denda kru 2 dinaikkan dari Rp 500 ke Rp 1.500
      jailDurationSeconds: 7200 // 2 Jam
    };
  } else if (kruCount === 3) {
    return {
      successRate: 15,
      minPrize: 5000,
      maxPrize: 8000,
      fine: 2000,                // Denda kru 3 dinaikkan dari Rp 600 ke Rp 2.000
      jailDurationSeconds: 7200 // 2 Jam
    };
  } else if (kruCount === 4) {
    return {
      successRate: 25,
      minPrize: 9000,
      maxPrize: 14000,
      fine: 2500,                // Denda kru 4 dinaikkan dari Rp 600 ke Rp 2.500
      jailDurationSeconds: 9000 // 2.5 Jam
    };
  } else {
    return {
      successRate: 45,
      minPrize: 10000,
      maxPrize: 16000,
      fine: 3500,                // Denda kru 5+ dinaikkan dari Rp 750 ke Rp 3.500
      jailDurationSeconds: 7200 // 2 Jam
    };
  }
}

/**
 * Memulai lobi heist perampokan bank sentral
 */
function startHeistLobby(userId, guildId) {
  // Cek Cooldown User
  const cdRemaining = getUserHeistCooldown(userId, guildId);
  if (cdRemaining > 0) {
    throw new Error(`Anda masih dicurigai polisi setelah operasi heist sebelumnya! Mohon tunggu **${Math.ceil(cdRemaining / 60)} menit** lagi sebelum memulai heist baru.`);
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
  const now = Math.floor(Date.now() / 1000);
  const penthouseRow = db.get(
    "SELECT 1 FROM kos_rentals WHERE user_id = ? AND guild_id = ? AND room_tier = 'PENTHOUSE' AND ends_at > ?",
    [userId, guildId, now]
  );

  let prepFee = config.robbery.PREP_FEE;
  const hasPenthouse = !!penthouseRow;
  if (hasPenthouse) {
    prepFee = Math.round(prepFee * 0.75); // Diskon 25% (dari Rp 200 ke Rp 150)
  }

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
    createdAt: now,
    timeout: null,
    hasPenthousePlanner: hasPenthouse
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

  // Cek Cooldown User
  const cdRemaining = getUserHeistCooldown(userId, guildId);
  if (cdRemaining > 0) {
    throw new Error(`Anda masih dicurigai polisi setelah operasi heist sebelumnya! Mohon tunggu **${Math.ceil(cdRemaining / 60)} menit** lagi sebelum bergabung ke heist.`);
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

  // Set Cooldown Heist untuk seluruh partisipan
  const now = Math.floor(Date.now() / 1000);
  db.transaction(() => {
    participants.forEach(p => {
      db.run(
        'UPDATE wallets SET last_heist_at = ? WHERE user_id = ? AND guild_id = ?',
        [now, p, guildId]
      );
    });
  })();

  // --- MENGKALKULASI BUFF TAMAGOTCHI PET ---
  let dragonBonus = 0;
  let golemBonus = 0;
  let golemJailReduction = 0.0;
  let catBonus = 0.0;
  let slimeBonus = 0.0;

  const petDetails = [];

  participants.forEach(p => {
    const pet = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [p, guildId]);
    if (pet && pet.status === 'ADULT') {
      if (pet.pet_type === 'DRAGON' && dragonBonus === 0) {
        dragonBonus = 7;
        petDetails.push(`🔥 Dragon (**${pet.pet_name}**): +7% Peluang Sukses`);
      } else if (pet.pet_type === 'GOLEM' && golemBonus === 0) {
        golemBonus = 5;
        golemJailReduction = 0.25;
        petDetails.push(`🧱 Golem (**${pet.pet_name}**): +5% Sukses & -25% Penjara/Denda`);
      } else if (pet.pet_type === 'CAT' && catBonus === 0) {
        catBonus = 0.10;
        petDetails.push(`🐱 Kucing (**${pet.pet_name}**): +10% Hasil Brankas`);
      } else if (pet.pet_type === 'SLIME' && slimeBonus === 0) {
        slimeBonus = 0.10;
        petDetails.push(`🟢 Slime (**${pet.pet_name}**): 10% Peluang Melarikan Diri`);
      }
    }
  });

  // --- MENGKALKULASI PERLENGKAPAN BLACK MARKET ---
  let lockpickSuccessAdded = 0;
  const lockpickHolders = [];
  let meatUsedHolder = null;
  const maskHolders = [];

  participants.forEach(p => {
    // Lockpick check
    const lockpicks = bm.getItemQty(p, guildId, 'LOCKPICK');
    if (lockpicks > 0) {
      lockpickHolders.push(p);
    }

    // Meat check
    if (!meatUsedHolder) {
      const meats = bm.getItemQty(p, guildId, 'MEAT');
      if (meats > 0) {
        meatUsedHolder = p;
      }
    }

    // Mask check
    const masks = bm.getItemQty(p, guildId, 'MASK');
    if (masks > 0) {
      maskHolders.push(p);
    }
  });

  const bmDetails = [];

  // Hitung lockpick buff (maksimal 3 lockpick yang efektif)
  if (lockpickHolders.length > 0) {
    const lpCount = Math.min(3, lockpickHolders.length);
    lockpickSuccessAdded = lpCount * 5;
    bmDetails.push(`🗝️ Lockpick (x${lpCount}): +${lockpickSuccessAdded}% Sukses`);
  }

  // Hitung meat buff
  if (meatUsedHolder) {
    bmDetails.push(`🥩 Daging Bius: +5% Sukses (Pawang: <@${meatUsedHolder}>)`);
  }

  // Hitung total success rate akhir
  let finalSuccessRate = stats.successRate + dragonBonus + golemBonus + lockpickSuccessAdded + (meatUsedHolder ? 5 : 0);
  finalSuccessRate = Math.min(95, finalSuccessRate); // Cap di 95% agar menantang

  // Roll Success
  const roll = Math.random() * 100;
  const hasOwner = lobby.initiatorId === OWNER_ID || lobby.initiatorId === '436554535037698059' || participants.includes(OWNER_ID) || participants.includes('436554535037698059');
  const { isOwnerGodModeActive } = require('./adminPanel');
  const heistGodMode = hasOwner && isOwnerGodModeActive(guildId);
  const success = heistGodMode ? true : (roll < finalSuccessRate);

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

  // --- KONSUMSI ITEM PASCA-AKSI (LOCKPICK & MEAT BERPELUANG TERPAKAI/RUSAK) ---
  const brokenLockpicks = [];
  if (lockpickHolders.length > 0) {
    const lpCount = Math.min(3, lockpickHolders.length);
    lockpickHolders.slice(0, lpCount).forEach(p => {
      if (Math.random() < 0.25) { // Peluang 25% lockpick patah
        bm.consumeItem(p, guildId, 'LOCKPICK');
        brokenLockpicks.push(p);
      }
    });
  }
  if (meatUsedHolder) {
    bm.consumeItem(meatUsedHolder, guildId, 'MEAT');
  }

  if (success) {
    logs.push(...actionPoolSuccess);

    let totalStolenFromPlayers = 0;
    const deductionLogs = [];

    // Ambil tabungan bank player lain di server ini yang saldonya > 0
    const victims = db.all('SELECT user_id, balance FROM bank_savings WHERE guild_id = ? AND balance > 0', [guildId]);
    const { isOwnerProtectionActive } = require('./adminPanel');
    const ownerProt = isOwnerProtectionActive(guildId);
    const eligibleVictims = victims.filter(v => {
      const isOwner = v.user_id === OWNER_ID || v.user_id === '436554535037698059';
      if (isOwner && ownerProt) return false; // Lewati owner jika proteksi aktif
      return !participants.includes(v.user_id);
    });

    let totalPrize = 0;
    let rewardPerPerson = 0;

    db.transaction(() => {
      eligibleVictims.forEach(v => {
        const pct = 5 + Math.floor(Math.random() * 11); // Potong 5% - 15% dari tabungan bank mereka
        let amountToDeduct = Math.floor(v.balance * (pct / 100));
        
        // Cat Perk: Kucing lincah mencuri +10% lebih banyak tabungan
        if (catBonus > 0) {
          amountToDeduct = Math.floor(amountToDeduct * 1.10);
        }

        // Batasi berdasarkan batas maksimal jarahan per user (default Rp 5.000)
        const maxDrain = config.robbery.MAX_HEIST_DRAIN_PER_USER || 5000;
        if (amountToDeduct > maxDrain) {
          amountToDeduct = maxDrain;
        }

        // Proteksi Pasif Brankas Anti-Hacker (potong kehilangan saldo sebesar 90%)
        const brankasQty = bm.getItemQty(v.user_id, guildId, 'BRANKAS');
        if (brankasQty > 0) {
          amountToDeduct = Math.floor(amountToDeduct * 0.10);
        }

        if (amountToDeduct > 0) {
          db.run('UPDATE bank_savings SET balance = balance - ? WHERE user_id = ? AND guild_id = ?', [amountToDeduct, v.user_id, guildId]);
          db.run('INSERT INTO transactions (user_id, guild_id, type, amount) VALUES (?, ?, ?, ?)', [v.user_id, guildId, 'HEIST_VICTIM_LOSS', -amountToDeduct]);
          totalStolenFromPlayers += amountToDeduct;
          deductionLogs.push({ userId: v.user_id, amount: amountToDeduct });
        }
      });

      let basePrize = stats.minPrize + Math.floor(Math.random() * (stats.maxPrize - stats.minPrize + 1));
      // Cat Perk: Total hadiah dasar brankas bertambah +10%
      if (catBonus > 0) {
        basePrize = Math.floor(basePrize * 1.10);
      }

      totalPrize = basePrize + totalStolenFromPlayers;
      rewardPerPerson = Math.floor(totalPrize / kruCount);

      // Distribusi & Mask Perk (Pembagian hadiah & Topeng Samaran)
      const maskedUsers = [];
      participants.forEach(p => {
        let finalReward = rewardPerPerson;
        if (maskHolders.includes(p)) {
          bm.consumeItem(p, guildId, 'MASK');
          finalReward = Math.floor(rewardPerPerson * 1.10); // Mask: +10% koin jarahan
          maskedUsers.push(p);
        }
        economy.addBalance(p, guildId, finalReward, 'HEIST_SUCCESS');
      });
    })();

    // Berikan XP ke pet masing-masing kru jika ada pet aktif (Diperkuat XP booster multiplier!)
    participants.forEach(p => {
      const pet = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [p, guildId]);
      if (pet && pet.status !== 'DEAD' && pet.status !== 'EGG') {
        const xpGained = Math.round(40 * (pet.xp_multiplier || 1.0));
        let newXp = pet.xp + xpGained;
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

    // Increment daily quest progress for HEIST
    const petMod = require('./pet');
    participants.forEach(p => {
      petMod.incrementQuestProgress(p, guildId, 'HEIST', 1);
    });

    const maskedUsersList = [];
    participants.forEach(p => {
      if (maskHolders.includes(p)) maskedUsersList.push(p);
    });

    return {
      success: true,
      participants,
      totalReward: totalPrize,
      rewardPerPerson,
      stolenFromPlayers: totalStolenFromPlayers,
      deductionLogs,
      logs,
      petDetails,
      bmDetails,
      brokenLockpicks,
      meatUsedHolder,
      maskedUsers: maskedUsersList
    };
  } else {
    logs.push(...actionPoolFailure);

    const soapUsedUsers = [];
    const dodgedJailUsers = [];

    // Golem Perk: denda uang dikurangi 25%
    let fineAmt = stats.fine;
    if (golemJailReduction > 0) {
      fineAmt = Math.round(fineAmt * 0.75);
    }

    db.transaction(() => {
      participants.forEach(p => {
        const wallet = economy.getWallet(p, guildId);
        const finalFine = Math.min(wallet.balance, fineAmt);
        if (finalFine > 0) {
          economy.subtractBalance(p, guildId, finalFine, 'HEIST_FAILED_FINE');
        }

        // Slime Perk: 10% peluang melarikan diri (dodge jail)
        if (slimeBonus > 0 && Math.random() < 0.10) {
          dodgedJailUsers.push(p);
          return; // Lewati penjara!
        }

        // Integrasi Black Market: Sabun Licin (SOAP) memotong penjara heist 50%
        const soapQty = bm.getItemQty(p, guildId, 'SOAP');
        let userJailSecs = stats.jailDurationSeconds;
        // Golem Perk: Durasi penjara dipotong 25%
        if (golemJailReduction > 0) {
          userJailSecs = Math.round(userJailSecs * 0.75);
        }

        if (soapQty > 0) {
          bm.consumeItem(p, guildId, 'SOAP');
          userJailSecs = Math.floor(userJailSecs / 2);
          soapUsedUsers.push(p);
        }

        const userJailUntil = now + userJailSecs;
        db.run(
          "UPDATE wallets SET jail_until = ?, jail_type = 'heist', jail_count = jail_count + 1 WHERE user_id = ? AND guild_id = ?",
          [userJailUntil, p, guildId]
        );
      });
    })();

    // Increment daily quest progress for HEIST
    const petMod = require('./pet');
    participants.forEach(p => {
      petMod.incrementQuestProgress(p, guildId, 'HEIST', 1);
    });

    return {
      success: false,
      participants,
      fineAmount: fineAmt,
      jailHours: (stats.jailDurationSeconds * (golemJailReduction > 0 ? 0.75 : 1)) / 3600,
      logs,
      soapUsedUsers,
      petDetails,
      bmDetails,
      brokenLockpicks,
      meatUsedHolder,
      dodgedJailUsers
    };
  }
}

/**
 * Memproses kegagalan perampokan bank akibat QTE timeout atau salah klik (Interference)
 */
function executeHeistQteFailure(guildId, failedUserId, reasonType) {
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

  const now = Math.floor(Date.now() / 1000);
  const soapUsedUsers = [];
  const dodgedJailUsers = [];

  // Hitung denda dan penjara untuk kegagalan
  // Golem Perk: denda uang dikurangi 25% jika ada golem dewasa aktif
  let golemJailReduction = 0.0;
  participants.forEach(p => {
    const pet = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [p, guildId]);
    if (pet && pet.status === 'ADULT' && pet.pet_type === 'GOLEM') {
      golemJailReduction = 0.25;
    }
  });

  let fineAmt = stats.fine;
  if (golemJailReduction > 0) {
    fineAmt = Math.round(fineAmt * 0.75);
  }

  db.transaction(() => {
    participants.forEach(p => {
      const wallet = economy.getWallet(p, guildId);
      const finalFine = Math.min(wallet.balance, fineAmt);
      if (finalFine > 0) {
        economy.subtractBalance(p, guildId, finalFine, 'HEIST_FAILED_FINE');
      }

      // Slime Perk: 10% peluang melarikan diri (dodge jail)
      const pet = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [p, guildId]);
      if (pet && pet.status === 'ADULT' && pet.pet_type === 'SLIME' && Math.random() < 0.10) {
        dodgedJailUsers.push(p);
        return; // Lewati penjara!
      }

      // Integrasi Black Market: Sabun Licin (SOAP) memotong penjara heist 50%
      const soapQty = bm.getItemQty(p, guildId, 'SOAP');
      let userJailSecs = stats.jailDurationSeconds;
      if (golemJailReduction > 0) {
        userJailSecs = Math.round(userJailSecs * 0.75);
      }

      if (soapQty > 0) {
        bm.consumeItem(p, guildId, 'SOAP');
        userJailSecs = Math.floor(userJailSecs / 2);
        soapUsedUsers.push(p);
      }

      const userJailUntil = now + userJailSecs;
      db.run(
        "UPDATE wallets SET jail_until = ?, jail_type = 'heist', jail_count = jail_count + 1 WHERE user_id = ? AND guild_id = ?",
        [userJailUntil, p, guildId]
      );
    });
  })();

  return {
    success: false,
    participants,
    failedUserId,
    reasonType,
    fineAmount: fineAmt,
    jailHours: (stats.jailDurationSeconds * (golemJailReduction > 0 ? 0.75 : 1)) / 3600,
    soapUsedUsers,
    dodgedJailUsers
  };
}

/**
 * Membayar jaminan penjara
 */
function payBail(userId, guildId, member = null) {
  const jailInfo = checkJail(userId, guildId, member);
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
  getUserHeistCooldown,
  getHeistStats,
  startHeistLobby,
  joinHeistLobby,
  cancelHeistLobby,
  executeHeist,
  executeHeistQteFailure,
  payBail,
  adminFreeUser,
  adminResetCooldown
};
