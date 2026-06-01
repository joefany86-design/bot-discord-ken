const db = require('./database');
const config = require('./config');

/**
 * Mendapatkan data dompet (wallet) user.
 * Jika belum ada, otomatis mendaftarkan user baru ke database.
 */
function getWallet(userId, guildId) {
  let wallet = db.get(
    'SELECT * FROM wallets WHERE user_id = ? AND guild_id = ?',
    [userId, guildId]
  );

  if (!wallet) {
    const now = Math.floor(Date.now() / 1000);
    db.run(
      `INSERT INTO wallets (user_id, guild_id, balance, total_earned, last_message_at) 
       VALUES (?, ?, ?, ?, ?)`,
      [userId, guildId, 0, 0, 0]
    );

    wallet = {
      user_id: userId,
      guild_id: guildId,
      balance: 0,
      total_earned: 0,
      total_invested: 0,
      last_message_at: 0,
      streak_days: 0,
      last_active_date: '',
      auto_trade: 0,
      created_at: now
    };
  }

  return wallet;
}

/**
 * Menambahkan saldo ke dompet user beserta pencatatan riwayat transaksi.
 */
function addBalance(userId, guildId, amount, type = 'EARN', channelId = null) {
  if (amount <= 0) return;

  db.transaction(() => {
    // Pastikan wallet terdaftar
    getWallet(userId, guildId);

    // Update saldo
    db.run(
      `UPDATE wallets 
       SET balance = balance + ?, total_earned = total_earned + ? 
       WHERE user_id = ? AND guild_id = ?`,
      [amount, amount, userId, guildId]
    );

    // Catat transaksi
    db.run(
      `INSERT INTO transactions (user_id, guild_id, type, channel_id, amount) 
       VALUES (?, ?, ?, ?, ?)`,
      [userId, guildId, type, channelId, amount]
    );
  })();

  return getWallet(userId, guildId);
}

/**
 * Mengurangi saldo dari dompet user beserta pencatatan riwayat transaksi.
 * Melempar error jika saldo tidak cukup.
 */
function subtractBalance(userId, guildId, amount, type = 'SPEND', channelId = null) {
  if (amount <= 0) return;

  const wallet = getWallet(userId, guildId);
  if (wallet.balance < amount) {
    throw new Error('Saldo tidak mencukupi!');
  }

  db.transaction(() => {
    db.run(
      `UPDATE wallets 
       SET balance = balance - ? 
       WHERE user_id = ? AND guild_id = ?`,
      [amount, userId, guildId]
    );

    db.run(
      `INSERT INTO transactions (user_id, guild_id, type, channel_id, amount) 
       VALUES (?, ?, ?, ?, ?)`,
      [userId, guildId, type, channelId, -amount]
    );
  })();

  return getWallet(userId, guildId);
}

/**
 * Mengklaim hadiah koin harian (Daily Claim).
 * Menghitung streak jika diklaim dalam kurun waktu < 48 jam dari klaim terakhir.
 */
function claimDaily(userId, guildId) {
  const wallet = getWallet(userId, guildId);
  const now = new Date();

  // Format YYYY-MM-DD berdasarkan Zona Waktu WIB (Asia/Jakarta) untuk reset tepat tengah malam WIB
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);

  if (wallet.last_active_date === todayStr) {
    // Sudah mengklaim hari ini
    // Hitung waktu tersisa sampai tengah malam berikutnya
    const tomorrow = new Date();
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msLeft = tomorrow - now;

    return {
      success: false,
      timeLeftMs: msLeft
    };
  }

  // Hitung streak
  let newStreak = 1;
  if (wallet.last_active_date) {
    const lastClaimDate = new Date(wallet.last_active_date);
    const diffTime = Math.abs(now - lastClaimDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Diklaim keesokan harinya berturut-turut
      newStreak = Math.min(wallet.streak_days + 1, config.economy.DAILY_STREAK_CAP);
    } else if (diffDays > 1) {
      // Streak putus
      newStreak = 1;
    }
  }

  // Kalkulasi hadiah acak
  const baseReward = Math.floor(
    Math.random() * (config.economy.DAILY_MAX - config.economy.DAILY_MIN + 1)
  ) + config.economy.DAILY_MIN;

  // Ambil bonus kamar kos & upgrade kasur
  const kos = require('./kos');
  const activeRental = kos.getActiveRental(userId, guildId);
  const hasKasur = kos.hasUpgrade(userId, guildId, 'KASUR');

  // Bonus streak (jika punya kasur busa super, bonus streak bertambah +Rp 1 per hari streak)
  const streakMultiplier = hasKasur ? (config.economy.DAILY_STREAK_BONUS + 1) : config.economy.DAILY_STREAK_BONUS;
  const streakBonus = (newStreak - 1) * streakMultiplier;

  let roomBonus = 0;
  let roomName = '';
  if (activeRental && activeRental.config) {
    roomBonus = activeRental.config.dailyBonus || 0;
    roomName = activeRental.name;
  }

  // Bonus Garden Buff dari pemberian buket bunga
  const garden = require('./garden');
  const activeBuff = garden.getActiveBuff(userId, guildId);
  let gardenBuffBonus = 0;
  if (activeBuff) {
    gardenBuffBonus = activeBuff.amount;
  }

  const totalReward = baseReward + streakBonus + roomBonus + gardenBuffBonus;

  let finalPlayerReward = totalReward;
  let debtPaidDetails = null;

  // Cek apakah ada hutang tebusan (bail debt) ke teman
  const activeDebt = db.get(
    'SELECT creditor_id, amount FROM bail_debts WHERE debtor_id = ? AND guild_id = ? ORDER BY created_at ASC LIMIT 1',
    [userId, guildId]
  );

  if (activeDebt && activeDebt.amount > 0) {
    const creditorId = activeDebt.creditor_id;
    // Potong 50% dari total daily reward untuk mencicil hutang teman secara paksa
    const paidAmount = Math.min(Math.floor(totalReward * 0.5), activeDebt.amount);

    if (paidAmount > 0) {
      finalPlayerReward = totalReward - paidAmount;
      const remainingDebt = activeDebt.amount - paidAmount;

      db.transaction(() => {
        // Tambah koin ke dompet teman (creditor)
        addBalance(creditorId, guildId, paidAmount, 'RECEIVE_DEBT_PAYMENT');

        // Kurangi hutang tebusan
        if (remainingDebt <= 0) {
          db.run(
            'DELETE FROM bail_debts WHERE guild_id = ? AND debtor_id = ? AND creditor_id = ?',
            [guildId, userId, creditorId]
          );
        } else {
          db.run(
            'UPDATE bail_debts SET amount = ? WHERE guild_id = ? AND debtor_id = ? AND creditor_id = ?',
            [remainingDebt, guildId, userId, creditorId]
          );
        }

        // Catat transaksi pemotongan hutang pada debtor
        db.run(
          'INSERT INTO transactions (user_id, guild_id, type, amount) VALUES (?, ?, ?, ?)',
          [userId, guildId, 'PAY_DEBT', -paidAmount]
        );

        // Tambah saldo bersih ke dompet pelaku setelah dipotong hutang
        addBalance(userId, guildId, finalPlayerReward, 'DAILY');

        // Update streak dan tanggal aktif terakhir
        db.run(
          `UPDATE wallets 
           SET streak_days = ?, last_active_date = ? 
           WHERE user_id = ? AND guild_id = ?`,
          [newStreak, todayStr, userId, guildId]
        );
      })();

      debtPaidDetails = {
        creditorId,
        paidAmount,
        remainingDebt
      };
    }
  }

  if (!debtPaidDetails) {
    db.transaction(() => {
      // Tambah saldo penuh jika tidak ada hutang
      addBalance(userId, guildId, totalReward, 'DAILY');

      // Update streak dan tanggal aktif terakhir
      db.run(
        `UPDATE wallets 
         SET streak_days = ?, last_active_date = ? 
         WHERE user_id = ? AND guild_id = ?`,
        [newStreak, todayStr, userId, guildId]
      );
    })();
  }

  return {
    success: true,
    reward: totalReward,
    finalReward: finalPlayerReward,
    baseReward,
    streakBonus,
    streak: newStreak,
    roomBonus,
    roomName,
    gardenBuffBonus,
    debtPaidDetails
  };
}

/**
 * Mentransfer saldo koin ke user lain dengan pengenaan pajak transfer 2%.
 */
function transferBalance(fromUserId, toUserId, guildId, amount, member = null) {
  if (amount <= 0) throw new Error('Jumlah transfer harus lebih dari 0!');
  if (fromUserId === toUserId) throw new Error('Anda tidak bisa mentransfer ke diri sendiri!');

  const senderWallet = getWallet(fromUserId, guildId);
  if (senderWallet.balance < amount) {
    throw new Error('Saldo Anda tidak mencukupi untuk melakukan transfer ini!');
  }

  // Hitung pajak
  const kos = require('./kos');
  const activeRental = kos.getActiveRental(fromUserId, guildId);

  let taxRatePercent = config.economy.TRANSFER_TAX_PERCENT;
  if (activeRental && activeRental.config && activeRental.config.transferTax !== undefined) {
    taxRatePercent = activeRental.config.transferTax;
  }

  // Diskon Pajak Transfer dari Gacha Role
  if (member) {
    const gachaTier = getMemberGachaTier(member, guildId);
    if (gachaTier === 'RARE') taxRatePercent = Math.max(0, taxRatePercent - 1);
    else if (gachaTier === 'EPIC') taxRatePercent = Math.max(0, taxRatePercent - 2);
    else if (gachaTier === 'LEGENDARY') taxRatePercent = Math.max(0, taxRatePercent - 3);
    else if (gachaTier === 'MYTHIC') taxRatePercent = Math.max(0, taxRatePercent - 5);
  }

  const taxRate = taxRatePercent / 100;
  const tax = Math.floor(amount * taxRate);
  const amountToReceive = amount - tax;

  db.transaction(() => {
    // Kurangi dari pengirim (total nominal yang ditransfer)
    subtractBalance(fromUserId, guildId, amount, 'TRANSFER_OUT');

    // Tambahkan ke penerima (dikurangi pajak)
    addBalance(toUserId, guildId, amountToReceive, 'TRANSFER_IN');

    console.log(`💸 Transfer: ${fromUserId} -> ${toUserId} senilai Rp ${amount} (Penerima dapat Rp ${amountToReceive}, Pajak Rp ${tax} - Rate ${taxRatePercent}%)`);
  })();

  return {
    amountSent: amount,
    amountReceived: amountToReceive,
    tax,
    taxRatePercent
  };
}

/**
 * Menghitung kekayaan total user (Saldo koin + Nilai seluruh portofolio saham).
 * Mengembalikan daftar Top Terkaya di server (leaderboard).
 */
function getLeaderboard(guildId, limit = 10) {
  // Query untuk mendapatkan total nilai portofolio dan saldo bank per user
  const wallets = db.all(
    `SELECT w.*, 
            COALESCE(pv.portfolio_value, 0) as portfolio_value,
            COALESCE(bs.balance, 0) as bank_balance
     FROM wallets w
     LEFT JOIN bank_savings bs ON w.user_id = bs.user_id AND w.guild_id = bs.guild_id
     LEFT JOIN (
       SELECT p.user_id, p.guild_id, SUM(p.shares * s.current_price) as portfolio_value
       FROM portfolios p
       JOIN stocks s ON p.channel_id = s.channel_id AND p.guild_id = s.guild_id
       GROUP BY p.user_id, p.guild_id
     ) pv ON w.user_id = pv.user_id AND w.guild_id = pv.guild_id
     WHERE w.guild_id = ?
     ORDER BY (w.balance + COALESCE(pv.portfolio_value, 0) + COALESCE(bs.balance, 0)) DESC
     LIMIT ?`,
    [guildId, limit]
  );

  return wallets.map(w => ({
    userId: w.user_id,
    balance: w.balance,
    portfolioValue: w.portfolio_value,
    bankBalance: w.bank_balance,
    totalWealth: w.balance + w.portfolio_value + w.bank_balance,
    streak: w.streak_days
  }));
}

/**
 * Mendapatkan total pendapatan dari Voice Channel hari ini berdasarkan riwayat transaksi.
 */
function getDailyVoiceEarnings(userId, guildId) {
  const now = new Date();
  // Hitung start hari ini pukul 00:00 WIB
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);
  const startOfDay = new Date(`${todayStr}T00:00:00+07:00`);
  const startOfDaySeconds = Math.floor(startOfDay.getTime() / 1000);

  const result = db.get(
    `SELECT SUM(amount) as total FROM transactions 
     WHERE user_id = ? AND guild_id = ? AND type = 'VOICE' AND created_at >= ?`,
    [userId, guildId, startOfDaySeconds]
  );

  return result ? (result.total || 0) : 0;
}

/**
 * Mendapatkan tier gacha tertinggi yang dimiliki oleh member Discord.
 */
function getMemberGachaTier(member, guildId) {
  if (!member) return 'NONE';

  try {
    // Ambil semua role gacha aktif dari database
    const gachaRoles = db.all(
      'SELECT role_id, tier FROM shop_items WHERE guild_id = ? AND is_gacha = 1',
      [guildId]
    );

    if (gachaRoles.length === 0) return 'NONE';

    // Buat map kecocokan role id yang dimiliki member
    const ownedTiers = [];
    gachaRoles.forEach(r => {
      if (member.roles && member.roles.cache && member.roles.cache.has(r.role_id)) {
        ownedTiers.push(r.tier.toUpperCase());
      }
    });

    if (ownedTiers.length === 0) return 'NONE';

    // Urutan prioritas tier
    const tierPriority = ['MYTHIC', 'LEGENDARY', 'EPIC', 'RARE', 'COMMON'];
    for (const tier of tierPriority) {
      if (ownedTiers.includes(tier)) {
        return tier;
      }
    }
  } catch (err) {
    console.error('❌ Gagal memeriksa tier gacha member:', err.message);
  }

  return 'NONE';
}

/**
 * Mendapatkan daftar Top Pencuri di server berdasarkan koin yang berhasil dicuri.
 */
function getThiefLeaderboard(guildId, limit = 10) {
  const query = `
    SELECT t.user_id, 
           SUM(CASE WHEN t.type = 'ROB_SUCCESS' THEN t.amount ELSE 0 END) AS solo_stolen,
           SUM(CASE WHEN t.type = 'HEIST_SUCCESS' THEN t.amount ELSE 0 END) AS heist_stolen,
           SUM(t.amount) AS total_stolen,
           COUNT(*) AS success_count,
           COALESCE(w.jail_count, 0) AS jail_count
    FROM transactions t
    LEFT JOIN wallets w ON t.user_id = w.user_id AND t.guild_id = w.guild_id
    WHERE t.guild_id = ? AND t.type IN ('ROB_SUCCESS', 'HEIST_SUCCESS')
    GROUP BY t.user_id
    ORDER BY total_stolen DESC
    LIMIT ?
  `;
  try {
    return db.all(query, [guildId, limit]);
  } catch (err) {
    console.error('❌ Gagal mengambil leaderboard pencuri:', err.message);
    return [];
  }
}

module.exports = {
  getWallet,
  addBalance,
  subtractBalance,
  claimDaily,
  transferBalance,
  getLeaderboard,
  getDailyVoiceEarnings,
  getMemberGachaTier,
  getThiefLeaderboard
};
