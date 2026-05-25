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
  
  // Format YYYY-MM-DD
  const todayStr = now.toISOString().split('T')[0];
  
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
  
  // Bonus streak
  const streakBonus = (newStreak - 1) * config.economy.DAILY_STREAK_BONUS;
  const totalReward = baseReward + streakBonus;

  db.transaction(() => {
    // Tambah saldo
    addBalance(userId, guildId, totalReward, 'DAILY');
    
    // Update streak dan tanggal aktif terakhir
    db.run(
      `UPDATE wallets 
       SET streak_days = ?, last_active_date = ? 
       WHERE user_id = ? AND guild_id = ?`,
      [newStreak, todayStr, userId, guildId]
    );
  })();

  return {
    success: true,
    reward: totalReward,
    baseReward,
    streakBonus,
    streak: newStreak
  };
}

/**
 * Mentransfer saldo koin ke user lain dengan pengenaan pajak transfer 2%.
 */
function transferBalance(fromUserId, toUserId, guildId, amount) {
  if (amount <= 0) throw new Error('Jumlah transfer harus lebih dari 0!');
  if (fromUserId === toUserId) throw new Error('Anda tidak bisa mentransfer ke diri sendiri!');
  
  const senderWallet = getWallet(fromUserId, guildId);
  if (senderWallet.balance < amount) {
    throw new Error('Saldo Anda tidak mencukupi untuk melakukan transfer ini!');
  }

  // Hitung pajak
  const taxRate = config.economy.TRANSFER_TAX_PERCENT / 100;
  const tax = Math.floor(amount * taxRate);
  const amountToReceive = amount - tax;

  db.transaction(() => {
    // Kurangi dari pengirim (total nominal yang ditransfer)
    subtractBalance(fromUserId, guildId, amount, 'TRANSFER_OUT');
    
    // Tambahkan ke penerima (dikurangi pajak)
    addBalance(toUserId, guildId, amountToReceive, 'TRANSFER_IN');
    
    console.log(`💸 Transfer: ${fromUserId} -> ${toUserId} senilai Rp ${amount} (Penerima dapat Rp ${amountToReceive}, Pajak Rp ${tax})`);
  })();

  return {
    amountSent: amount,
    amountReceived: amountToReceive,
    tax
  };
}

/**
 * Menghitung kekayaan total user (Saldo koin + Nilai seluruh portofolio saham).
 * Mengembalikan daftar Top Terkaya di server (leaderboard).
 */
function getLeaderboard(guildId, limit = 10) {
  // Query untuk mendapatkan total nilai portofolio per user
  const wallets = db.all(
    `SELECT w.*, 
            COALESCE(SUM(p.shares * s.current_price), 0) as portfolio_value
     FROM wallets w
     LEFT JOIN portfolios p ON w.user_id = p.user_id AND w.guild_id = p.guild_id
     LEFT JOIN stocks s ON p.channel_id = s.channel_id AND p.guild_id = s.guild_id
     WHERE w.guild_id = ?
     GROUP BY w.user_id
     ORDER BY (w.balance + COALESCE(SUM(p.shares * s.current_price), 0)) DESC
     LIMIT ?`,
    [guildId, limit]
  );

  return wallets.map(w => ({
    userId: w.user_id,
    balance: w.balance,
    portfolioValue: w.portfolio_value,
    totalWealth: w.balance + w.portfolio_value,
    streak: w.streak_days
  }));
}

module.exports = {
  getWallet,
  addBalance,
  subtractBalance,
  claimDaily,
  transferBalance,
  getLeaderboard
};
