const db = require('./database');
const economy = require('./economy');
const config = require('./config');

/**
 * Utility untuk memparsing nominal koin yang mendukung format shorthand (seperti 15k, 1.5k, 1m, dll)
 */
function parseAmount(input) {
  if (input === undefined || input === null) return 0;
  if (typeof input === 'number') return Math.floor(input);
  
  const cleanInput = String(input).trim().toLowerCase().replace(/,/g, '');
  if (cleanInput === 'all') return 'all';
  
  const match = cleanInput.match(/^([\d.]+)\s*([kmb])?$/);
  if (!match) {
    const val = parseInt(cleanInput);
    return isNaN(val) ? 0 : val;
  }
  
  const value = parseFloat(match[1]);
  const suffix = match[2];
  
  if (!suffix) {
    return isNaN(value) ? 0 : Math.floor(value);
  }
  
  let multiplier = 1;
  if (suffix === 'k') multiplier = 1000;
  else if (suffix === 'm') multiplier = 1000000;
  else if (suffix === 'b') multiplier = 1000000000;
  
  return Math.floor(value * multiplier);
}

/**
 * Mendapatkan data rekening tabungan (savings) user.
 * Jika belum ada, otomatis mendaftarkan user baru.
 */
function getSavings(userId, guildId) {
  // Cek apakah target adalah bot di guild target
  const isTargetGuild = guildId === '1410239829874053296';
  let isBot = false;
  if (isTargetGuild && global.client) {
    const guild = global.client.guilds.cache.get(guildId);
    const member = guild?.members.cache.get(userId);
    if (member?.user.bot) isBot = true;
  }

  let savings = db.get(
    'SELECT * FROM bank_savings WHERE user_id = ? AND guild_id = ?',
    [userId, guildId]
  );

  if (isBot) {
    if (savings && savings.balance !== 0) {
      db.run('UPDATE bank_savings SET balance = 0 WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
      savings.balance = 0;
    }
  }

  if (!savings) {
    const now = Math.floor(Date.now() / 1000);
    db.run(
      `INSERT INTO bank_savings (user_id, guild_id, balance, last_interest_at) 
       VALUES (?, ?, 0, ?)`,
      [userId, guildId, now]
    );

    savings = {
      user_id: userId,
      guild_id: guildId,
      balance: 0,
      last_interest_at: now,
      created_at: now
    };
  }

  return savings;
}

/**
 * Menyimpan uang ke tabungan bank.
 */
function depositSavings(userId, guildId, amountInput) {
  const wallet = economy.getWallet(userId, guildId);
  let amount = 0;

  const parsed = parseAmount(amountInput);
  if (parsed === 'all') {
    amount = wallet.balance;
  } else {
    amount = parsed;
  }

  if (isNaN(amount) || amount <= 0) {
    throw new Error('Jumlah deposit harus berupa angka di atas 0 atau ketik "all"!');
  }

  if (wallet.balance < amount) {
    throw new Error(`Saldo dompet tidak mencukupi! Saldo Anda saat ini Rp ${wallet.balance.toLocaleString('id-ID')}`);
  }

  const kos = require('./kos');
  const activeRental = kos.getActiveRental(userId, guildId);
  const roomTier = activeRental ? activeRental.room_tier : 'DEFAULT';

  // Get deposit tax rate
  const taxRate = config.bank.DEPOSIT_TAX_ROOMS[roomTier] !== undefined
    ? config.bank.DEPOSIT_TAX_ROOMS[roomTier]
    : config.bank.DEPOSIT_TAX_ROOMS.DEFAULT;

  const tax = Math.floor(amount * (taxRate / 100));
  const netDeposit = amount - tax;

  db.transaction(() => {
    // Kurangi saldo wallet sebesar amount penuh
    db.run(
      'UPDATE wallets SET balance = balance - ? WHERE user_id = ? AND guild_id = ?',
      [amount, userId, guildId]
    );

    // Tambah saldo bank sebesar netDeposit setelah dipotong pajak
    getSavings(userId, guildId); // Pastikan row tabungan dibuat
    db.run(
      'UPDATE bank_savings SET balance = balance + ? WHERE user_id = ? AND guild_id = ?',
      [netDeposit, userId, guildId]
    );

    // Catat transaksi
    db.run(
      'INSERT INTO transactions (user_id, guild_id, type, amount) VALUES (?, ?, ?, ?)',
      [userId, guildId, 'BANK_DEPOSIT', -amount]
    );
  })();

  return {
    amount,
    tax,
    netAmount: netDeposit,
    roomTier,
    taxRate,
    walletBalance: economy.getWallet(userId, guildId).balance,
    savingsBalance: getSavings(userId, guildId).balance
  };
}

/**
 * Menarik koin dari bank savings ke wallet.
 */
function withdrawSavings(userId, guildId, amountInput) {
  const savings = getSavings(userId, guildId);
  let amount = 0;

  const parsed = parseAmount(amountInput);
  if (parsed === 'all') {
    amount = savings.balance;
  } else {
    amount = parsed;
  }

  if (isNaN(amount) || amount <= 0) {
    throw new Error('Jumlah penarikan harus berupa angka di atas 0 atau ketik "all"!');
  }

  if (savings.balance < amount) {
    throw new Error(`Saldo tabungan bank Anda tidak mencukupi! Saldo tabungan Anda Rp ${savings.balance.toLocaleString('id-ID')}`);
  }

  const kos = require('./kos');
  const activeRental = kos.getActiveRental(userId, guildId);
  const roomTier = activeRental ? activeRental.room_tier : 'DEFAULT';

  // Get withdraw tax rate
  const taxRate = config.bank.WITHDRAW_TAX_ROOMS[roomTier] !== undefined
    ? config.bank.WITHDRAW_TAX_ROOMS[roomTier]
    : config.bank.WITHDRAW_TAX_ROOMS.DEFAULT;

  const tax = Math.floor(amount * (taxRate / 100));
  const netReceive = amount - tax;

  db.transaction(() => {
    // Kurangi saldo bank sebesar amount penuh
    db.run(
      'UPDATE bank_savings SET balance = balance - ? WHERE user_id = ? AND guild_id = ?',
      [amount, userId, guildId]
    );

    // Tambah saldo wallet sebesar netReceive setelah dipotong pajak
    db.run(
      'UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND guild_id = ?',
      [netReceive, userId, guildId]
    );

    // Catat transaksi
    db.run(
      'INSERT INTO transactions (user_id, guild_id, type, amount) VALUES (?, ?, ?, ?)',
      [userId, guildId, 'BANK_WITHDRAW', amount]
    );
  })();

  return {
    amount,
    tax,
    netAmount: netReceive,
    roomTier,
    taxRate,
    walletBalance: economy.getWallet(userId, guildId).balance,
    savingsBalance: getSavings(userId, guildId).balance
  };
}

/**
 * Mendapatkan pinjaman aktif (ACTIVE / OVERDUE) milik user.
 */
function getActiveLoan(userId, guildId) {
  return db.get(
    `SELECT * FROM bank_loans 
     WHERE user_id = ? AND guild_id = ? AND status IN ('ACTIVE', 'OVERDUE') 
     ORDER BY id DESC LIMIT 1`,
    [userId, guildId]
  );
}

/**
 * Menghitung limit pinjaman dinamis user berdasarkan streak dan earning.
 */
function calculateMaxLoanLimit(userId, guildId) {
  const wallet = economy.getWallet(userId, guildId);
  
  // Ambil data upgrade gembok pintu
  const kos = require('./kos');
  const hasGembok = kos.hasUpgrade(userId, guildId, 'GEMBOK');

  // Formula limit: 500 + 30% dari wallets.total_earned + 100 * wallets.streak_days + bonus gembok Rp 150
  const baseLimit = 500 + (hasGembok ? 150 : 0);
  const earnedBonus = Math.floor((wallet.total_earned || 0) * 0.3);
  const streakBonus = (wallet.streak_days || 0) * 100;

  // Integrasi Luxury Shop: Batangan Emas menambah limit pinjaman +Rp 500 (kolateral emas)
  let goldBonus = 0;
  try {
    const goldQty = db.get(
      "SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = 'GOLD'",
      [userId, guildId]
    );
    if (goldQty && goldQty.quantity > 0) {
      goldBonus = 500;
    }
  } catch (e) {
    console.error("Gagal membaca emas batangan untuk limit bank:", e.message);
  }

  return baseLimit + earnedBonus + streakBonus + goldBonus;
}

/**
 * Mengajukan pinjaman bank baru.
 */
function createLoan(userId, guildId, principalAmount, tenorDays) {
  const activeLoan = getActiveLoan(userId, guildId);
  if (activeLoan) {
    throw new Error('Anda masih memiliki pinjaman aktif yang belum lunas!');
  }

  const principal = parseInt(principalAmount);
  if (isNaN(principal) || principal <= 0) {
    throw new Error('Nominal pinjaman harus berupa angka di atas 0!');
  }

  const maxLimit = calculateMaxLoanLimit(userId, guildId);
  if (principal > maxLimit) {
    throw new Error(`Nominal melebihi batas limit pinjaman Anda! Limit Anda saat ini adalah Rp ${maxLimit.toLocaleString('id-ID')}`);
  }

  // Tentukan suku bunga berdasarkan tenor
  let interestRate = 0.02; // Default 1 hari = 2%
  if (tenorDays === 3) interestRate = 0.05; // 3 hari = 5%
  else if (tenorDays === 7) interestRate = 0.10; // 7 hari = 10%

  const totalDue = Math.round(principal * (1 + interestRate));
  const now = Math.floor(Date.now() / 1000);
  const dueAt = now + (tenorDays * 24 * 3600); // Batas jatuh tempo (Unix timestamp)

  db.transaction(() => {
    // Simpan data pinjaman
    db.run(
      `INSERT INTO bank_loans (user_id, guild_id, principal_amount, interest_rate, total_due, tenor_days, due_at, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [userId, guildId, principal, interestRate, totalDue, tenorDays, dueAt]
    );

    // Tambah koin ke wallet aktif
    db.run(
      'UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND guild_id = ?',
      [principal, userId, guildId]
    );

    // Catat log transaksi
    db.run(
      'INSERT INTO transactions (user_id, guild_id, type, amount) VALUES (?, ?, ?, ?)',
      [userId, guildId, 'LOAN_TAKE', principal]
    );
  })();

  return {
    principal,
    interestRate,
    totalDue,
    tenorDays,
    dueAt,
    walletBalance: economy.getWallet(userId, guildId).balance
  };
}

/**
 * Melunasi utang (Repay / Pay Loan).
 * Membayar cicilan maksimal dari dompet jika saldo tidak cukup melunasi penuh.
 */
function repayLoan(userId, guildId) {
  const activeLoan = getActiveLoan(userId, guildId);
  if (!activeLoan) {
    throw new Error('Anda tidak memiliki utang pinjaman aktif untuk dibayar saat ini!');
  }

  const wallet = economy.getWallet(userId, guildId);
  if (wallet.balance <= 0) {
    throw new Error('Dompet Anda kosong! Silakan kumpulkan chat koin terlebih dahulu.');
  }

  const totalDebt = activeLoan.total_due + (activeLoan.penalty_accumulated || 0);
  let amountPaid = 0;
  let isFullyPaid = false;

  db.transaction(() => {
    if (wallet.balance >= totalDebt) {
      // Saldo cukup, bayar lunas!
      amountPaid = totalDebt;
      isFullyPaid = true;

      // Kurangi wallet
      db.run(
        'UPDATE wallets SET balance = balance - ? WHERE user_id = ? AND guild_id = ?',
        [amountPaid, userId, guildId]
      );

      // Tandai lunas
      db.run(
        "UPDATE bank_loans SET status = 'PAID', total_due = 0, penalty_accumulated = 0 WHERE id = ?",
        [activeLoan.id]
      );
    } else {
      // Saldo kurang, cicil semampunya (seluruh koin dompet disedot)
      amountPaid = wallet.balance;
      isFullyPaid = false;

      // Kurangi wallet menjadi 0
      db.run(
        'UPDATE wallets SET balance = 0 WHERE user_id = ? AND guild_id = ?',
        [userId, guildId]
      );

      // Potong denda dulu, baru sisa potong pokok tagihan
      let remainingPayment = amountPaid;
      let newPenalty = activeLoan.penalty_accumulated || 0;
      let newTotalDue = activeLoan.total_due;

      if (newPenalty > 0) {
        if (remainingPayment >= newPenalty) {
          remainingPayment -= newPenalty;
          newPenalty = 0;
        } else {
          newPenalty -= remainingPayment;
          remainingPayment = 0;
        }
      }

      if (remainingPayment > 0) {
        newTotalDue = Math.max(0, newTotalDue - remainingPayment);
      }

      // Update pinjaman yang masih ada sisa utang
      db.run(
        'UPDATE bank_loans SET total_due = ?, penalty_accumulated = ? WHERE id = ?',
        [newTotalDue, newPenalty, activeLoan.id]
      );
    }

    // Catat log transaksi
    db.run(
      'INSERT INTO transactions (user_id, guild_id, type, amount) VALUES (?, ?, ?, ?)',
      [userId, guildId, 'LOAN_REPAY', -amountPaid]
    );
  })();

  return {
    amountPaid,
    totalDebt,
    remainingDebt: isFullyPaid ? 0 : (totalDebt - amountPaid),
    isFullyPaid,
    walletBalance: economy.getWallet(userId, guildId).balance
  };
}

/**
 * Mentransfer koin antar tabungan bank (savings) dengan pengenaan pajak transfer sesuai level sewa kosan pengirim.
 */
function transferSavings(fromUserId, toUserId, guildId, amountInput) {
  if (fromUserId === toUserId) {
    throw new Error('Anda tidak bisa mentransfer ke diri sendiri!');
  }

  // Cek apakah target penerima adalah bot di guild target
  const isTargetGuild = guildId === '1410239829874053296';
  let isBot = false;
  if (isTargetGuild && global.client) {
    const guild = global.client.guilds.cache.get(guildId);
    const member = guild?.members.cache.get(toUserId);
    if (member?.user.bot) isBot = true;
  }
  if (isBot) {
    throw new Error('Anda tidak dapat mentransfer koin ke bot!');
  }

  const senderSavings = getSavings(fromUserId, guildId);
  let amount = 0;

  const parsed = parseAmount(amountInput);
  if (parsed === 'all') {
    amount = senderSavings.balance;
  } else {
    amount = parsed;
  }

  if (isNaN(amount) || amount <= 0) {
    throw new Error('Jumlah transfer harus berupa angka di atas 0 atau ketik "all"!');
  }

  if (senderSavings.balance < amount) {
    throw new Error(`Saldo tabungan Anda tidak mencukupi! Saldo tabungan Anda saat ini Rp ${senderSavings.balance.toLocaleString('id-ID')}`);
  }

  // Ambil data kos pengirim untuk pajak transfer
  const kos = require('./kos');
  const activeRental = kos.getActiveRental(fromUserId, guildId);
  const roomTier = activeRental ? activeRental.room_tier : 'DEFAULT';

  let taxRatePercent = config.economy.TRANSFER_TAX_PERCENT; // default 10
  if (activeRental && activeRental.config && activeRental.config.transferTax !== undefined) {
    taxRatePercent = activeRental.config.transferTax;
  }

  const tax = Math.floor(amount * (taxRatePercent / 100));
  const netAmount = amount - tax;

  // Pastikan rekening penerima terdaftar
  getSavings(toUserId, guildId);

  db.transaction(() => {
    // Kurangi tabungan pengirim sebesar amount penuh
    db.run(
      'UPDATE bank_savings SET balance = balance - ? WHERE user_id = ? AND guild_id = ?',
      [amount, fromUserId, guildId]
    );

    // Tambah tabungan penerima sebesar netAmount
    db.run(
      'UPDATE bank_savings SET balance = balance + ? WHERE user_id = ? AND guild_id = ?',
      [netAmount, toUserId, guildId]
    );

    // Catat transaksi pengirim (TRANSFER_OUT)
    db.run(
      'INSERT INTO transactions (user_id, guild_id, type, channel_id, amount) VALUES (?, ?, ?, ?, ?)',
      [fromUserId, guildId, 'BANK_TRANSFER_OUT', toUserId, -amount]
    );

    // Catat transaksi penerima (TRANSFER_IN)
    db.run(
      'INSERT INTO transactions (user_id, guild_id, type, channel_id, amount) VALUES (?, ?, ?, ?, ?)',
      [toUserId, guildId, 'BANK_TRANSFER_IN', fromUserId, netAmount]
    );
  })();

  return {
    amount,
    tax,
    netAmount,
    taxRatePercent,
    roomTier,
    senderSavingsBalance: getSavings(fromUserId, guildId).balance,
    receiverSavingsBalance: getSavings(toUserId, guildId).balance
  };
}

/**
 * Melunasi atau mencicil hutang tebusan (bail debt) ke teman dari dompet (wallet).
 */
function repayFriendDebt(debtorId, creditorId, guildId, amountInput) {
  const debt = db.get(
    'SELECT amount FROM bail_debts WHERE guild_id = ? AND debtor_id = ? AND creditor_id = ?',
    [guildId, debtorId, creditorId]
  );

  if (!debt || debt.amount <= 0) {
    throw new Error('Anda tidak memiliki hutang jaminan penjara ke pengguna tersebut!');
  }

  const wallet = economy.getWallet(debtorId, guildId);
  if (wallet.balance <= 0) {
    throw new Error('Dompet Anda kosong! Silakan kumpulkan koin terlebih dahulu.');
  }

  let amount = 0;
  const parsed = parseAmount(amountInput);
  if (parsed === 'all') {
    amount = Math.min(wallet.balance, debt.amount);
  } else {
    amount = parsed;
  }

  if (isNaN(amount) || amount <= 0) {
    throw new Error('Jumlah pembayaran harus berupa angka di atas 0 atau ketik "all"!');
  }

  if (wallet.balance < amount) {
    throw new Error(`Saldo dompet tidak mencukupi! Saldo dompet Anda saat ini Rp ${wallet.balance.toLocaleString('id-ID')}`);
  }

  if (amount > debt.amount) {
    throw new Error(`Jumlah pembayaran melebihi sisa hutang Anda (Rp ${debt.amount.toLocaleString('id-ID')})!`);
  }

  const remainingDebt = debt.amount - amount;

  db.transaction(() => {
    // Kurangi koin dompet pengirim
    economy.subtractBalance(debtorId, guildId, amount, 'PAY_DEBT');

    // Tambah koin dompet penerima (creditor)
    economy.addBalance(creditorId, guildId, amount, 'RECEIVE_DEBT_PAYMENT');

    // Update / Hapus debt
    if (remainingDebt <= 0) {
      db.run(
        'DELETE FROM bail_debts WHERE guild_id = ? AND debtor_id = ? AND creditor_id = ?',
        [guildId, debtorId, creditorId]
      );
    } else {
      db.run(
        'UPDATE bail_debts SET amount = ? WHERE guild_id = ? AND debtor_id = ? AND creditor_id = ?',
        [remainingDebt, guildId, debtorId, creditorId]
      );
    }
  })();

  return {
    amountPaid: amount,
    remainingDebt,
    isFullyPaid: remainingDebt <= 0,
    walletBalance: economy.getWallet(debtorId, guildId).balance
  };
}

module.exports = {
  getSavings,
  depositSavings,
  withdrawSavings,
  getActiveLoan,
  calculateMaxLoanLimit,
  createLoan,
  repayLoan,
  parseAmount,
  transferSavings,
  repayFriendDebt
};
