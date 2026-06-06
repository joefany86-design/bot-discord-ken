const db = require('./database');
const economy = require('./economy');
const config = require('./config');

/**
 * Menghitung awal minggu saat ini (Senin 00:00 WIB) dalam format YYYY-MM-DD.
 */
function getCurrentWeekStart() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const wibTime = new Date(utc + (3600000 * 7));
  const dayOfWeek = wibTime.getDay(); // 0 = Minggu, 1 = Senin, ...
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Hitung jarak ke Senin
  wibTime.setDate(wibTime.getDate() - diff);
  const year = wibTime.getFullYear();
  const month = String(wibTime.getMonth() + 1).padStart(2, '0');
  const day = String(wibTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Mendapatkan data pool lotre untuk guild & minggu ini.
 */
function getPool(guildId) {
  const weekStart = getCurrentWeekStart();
  let pool = db.get(
    'SELECT * FROM lottery_pool WHERE guild_id = ? AND week_start = ?',
    [guildId, weekStart]
  );

  if (!pool) {
    pool = { guild_id: guildId, total_pool: 0, total_tickets: 0, week_start: weekStart };
  }

  return pool;
}

/**
 * Mendapatkan jumlah tiket user untuk minggu ini.
 */
function getUserTickets(userId, guildId) {
  const weekStart = getCurrentWeekStart();
  const row = db.get(
    'SELECT ticket_count FROM lottery_tickets WHERE user_id = ? AND guild_id = ? AND week_start = ?',
    [userId, guildId, weekStart]
  );
  return row ? row.ticket_count : 0;
}

/**
 * Membeli tiket lotre.
 */
function buyTickets(userId, guildId, quantity, paymentSource = 'pocket') {
  const qty = parseInt(quantity);
  if (isNaN(qty) || qty <= 0) {
    throw new Error('Jumlah tiket harus minimal 1!');
  }

  const ticketPrice = config.lottery.TICKET_PRICE || 100;
  const totalCost = ticketPrice * qty;

  let balance = 0;
  if (paymentSource === 'bank') {
    const bank = require('./bank');
    const savings = bank.getSavings(userId, guildId);
    balance = savings.balance;
  } else {
    const wallet = economy.getWallet(userId, guildId);
    balance = wallet.balance;
  }

  if (balance < totalCost) {
    throw new Error(`❌ Saldo tidak mencukupi! Anda butuh Rp ${totalCost.toLocaleString('id-ID')} untuk membeli ${qty} tiket (@ Rp ${ticketPrice.toLocaleString('id-ID')}/tiket). Saldo Anda saat ini Rp ${balance.toLocaleString('id-ID')}.`);
  }

  const weekStart = getCurrentWeekStart();

  db.transaction(() => {
    // Kurangi saldo dompet
    economy.subtractBalance(userId, guildId, totalCost, 'LOTTERY_BUY', null, paymentSource);

    // Update pool
    const existPool = db.get(
      'SELECT * FROM lottery_pool WHERE guild_id = ? AND week_start = ?',
      [guildId, weekStart]
    );
    if (existPool) {
      db.run(
        'UPDATE lottery_pool SET total_pool = total_pool + ?, total_tickets = total_tickets + ? WHERE guild_id = ? AND week_start = ?',
        [totalCost, qty, guildId, weekStart]
      );
    } else {
      db.run(
        'INSERT INTO lottery_pool (guild_id, total_pool, total_tickets, week_start) VALUES (?, ?, ?, ?)',
        [guildId, totalCost, qty, weekStart]
      );
    }

    // Update tiket user
    const existTicket = db.get(
      'SELECT * FROM lottery_tickets WHERE user_id = ? AND guild_id = ? AND week_start = ?',
      [userId, guildId, weekStart]
    );
    if (existTicket) {
      db.run(
        'UPDATE lottery_tickets SET ticket_count = ticket_count + ? WHERE user_id = ? AND guild_id = ? AND week_start = ?',
        [qty, userId, guildId, weekStart]
      );
    } else {
      db.run(
        'INSERT INTO lottery_tickets (user_id, guild_id, ticket_count, week_start) VALUES (?, ?, ?, ?)',
        [userId, guildId, qty, weekStart]
      );
    }
  })();

  return {
    quantity: qty,
    totalCost,
    ticketPrice,
    userTotalTickets: getUserTickets(userId, guildId),
    pool: getPool(guildId)
  };
}

/**
 * Mendapatkan daftar semua peserta lotre minggu ini beserta jumlah tiket.
 */
function getParticipants(guildId) {
  const weekStart = getCurrentWeekStart();
  return db.all(
    'SELECT user_id, ticket_count FROM lottery_tickets WHERE guild_id = ? AND week_start = ? AND ticket_count > 0',
    [guildId, weekStart]
  );
}

/**
 * Melakukan undian lotre. Mengembalikan null jika tidak ada peserta.
 */
function drawWinner(guildId) {
  const weekStart = getCurrentWeekStart();
  const pool = getPool(guildId);

  if (pool.total_tickets === 0 || pool.total_pool === 0) {
    return null; // Tidak ada peserta
  }

  const participants = getParticipants(guildId);
  if (participants.length === 0) return null;

  // Weighted random selection berdasarkan jumlah tiket
  const totalTickets = participants.reduce((sum, p) => sum + p.ticket_count, 0);
  let random = Math.floor(Math.random() * totalTickets);
  let winner = null;

  for (const participant of participants) {
    random -= participant.ticket_count;
    if (random < 0) {
      winner = participant;
      break;
    }
  }

  if (!winner) winner = participants[participants.length - 1];

  // Hitung distribusi
  const burnPercent = config.lottery.BURN_PERCENT || 15;
  const burnAmount = Math.floor(pool.total_pool * (burnPercent / 100));
  const prizeAmount = pool.total_pool - burnAmount;

  // Distribusikan hadiah ke pemenang
  db.transaction(() => {
    economy.addBalance(winner.user_id, guildId, prizeAmount, 'LOTTERY_WIN');

    // Reset pool minggu ini (set ke 0 agar tidak double draw)
    db.run(
      'UPDATE lottery_pool SET total_pool = 0, total_tickets = 0 WHERE guild_id = ? AND week_start = ?',
      [guildId, weekStart]
    );

    // Reset semua tiket minggu ini
    db.run(
      'DELETE FROM lottery_tickets WHERE guild_id = ? AND week_start = ?',
      [guildId, weekStart]
    );
  })();

  return {
    winnerId: winner.user_id,
    winnerTickets: winner.ticket_count,
    totalPool: pool.total_pool,
    totalTickets: pool.total_tickets,
    prizeAmount,
    burnAmount,
    burnPercent,
    participantCount: participants.length
  };
}

module.exports = {
  getCurrentWeekStart,
  getPool,
  getUserTickets,
  buyTickets,
  getParticipants,
  drawWinner
};
