const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('./config');

// Pastikan folder database ada
const dbDir = path.dirname(config.DATABASE_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db;
try {
  db = new Database(config.DATABASE_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
} catch (error) {
  console.error('[VoiceDb] Gagal menghubungkan SQLite:', error);
  throw error;
}

// Inisialisasi Skema Tabel
function initSchema() {
  // 1. tod_questions: Menyimpan 2000+ pertanyaan Truth/Dare
  db.exec(`
    CREATE TABLE IF NOT EXISTS tod_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT CHECK(type IN ('truth', 'dare')),
      category TEXT CHECK(category IN ('chill', 'deep', 'spicy')),
      question_text TEXT NOT NULL,
      created_by TEXT DEFAULT 'SYSTEM'
    );
    CREATE INDEX IF NOT EXISTS idx_tod_type_category ON tod_questions(type, category);
  `);

  // 2. tod_stats: Melacak pencapaian permainan user & denda/hadiah koin
  db.exec(`
    CREATE TABLE IF NOT EXISTS tod_stats (
      user_id TEXT PRIMARY KEY,
      truths_answered INTEGER DEFAULT 0,
      dares_completed INTEGER DEFAULT 0,
      skips_count INTEGER DEFAULT 0,
      total_coins_earned INTEGER DEFAULT 0,
      total_fines_paid INTEGER DEFAULT 0
    )
  `);

  // 3. Pastikan kolom balance ada di tabel wallets (tabel ekonomi utama)
  // Tabel wallets dibuat di modul stockmarket, tapi kita buat placeholder/cek di sini jika diperlukan
  db.exec(`
    CREATE TABLE IF NOT EXISTS wallets (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      balance INTEGER DEFAULT 0,
      total_earned INTEGER DEFAULT 0,
      total_invested INTEGER DEFAULT 0,
      last_message_at INTEGER DEFAULT 0,
      streak_days INTEGER DEFAULT 0,
      last_active_date TEXT DEFAULT '',
      created_at INTEGER DEFAULT (strftime('%s','now')),
      PRIMARY KEY (user_id, guild_id)
    )
  `);

  console.log('✅ [VoiceDb] Skema tabel Truth or Dare berhasil diinisialisasi.');
}

initSchema();

// State Maps untuk melacak pertanyaan yang sudah keluar agar tidak duplikat (Anti-Duplikasi)
// Format: Map<guildId, Map<type_category, Set<questionId>>>
const activeQueues = new Map();

/**
 * Mengambil pertanyaan acak dengan filter kategori & tipe secara anti-duplikat.
 * @param {string} type - 'truth' atau 'dare'
 * @param {string} category - 'chill', 'deep', atau 'spicy'
 * @param {string} guildId - Server ID untuk antrean anti-duplikasi
 * @returns {object|null}
 */
function getRandomQuestion(type, category, guildId) {
  const queueKey = `${type}_${category}`;
  
  if (!activeQueues.has(guildId)) {
    activeQueues.set(guildId, new Map());
  }
  const guildMap = activeQueues.get(guildId);
  if (!guildMap.has(queueKey)) {
    guildMap.set(queueKey, new Set());
  }
  const excludeSet = guildMap.get(queueKey);

  // Cari ID pertanyaan yang cocok dengan tipe & kategori
  const allIds = db.prepare(
    'SELECT id FROM tod_questions WHERE type = ? AND category = ?'
  ).all(type, category).map(row => row.id);

  if (allIds.length === 0) return null;

  // Saring ID yang sudah terpakai
  let availableIds = allIds.filter(id => !excludeSet.has(id));

  // Jika semua sudah terpakai, reset antrean
  if (availableIds.length === 0) {
    excludeSet.clear();
    availableIds = allIds;
  }

  // Pilih satu ID secara acak
  const randomId = availableIds[Math.floor(Math.random() * availableIds.length)];
  excludeSet.add(randomId);

  // Ambil data detail pertanyaan
  return db.prepare('SELECT * FROM tod_questions WHERE id = ?').get(randomId);
}

/**
 * Menambahkan pertanyaan kustom.
 */
function addCustomQuestion(type, category, questionText, createdBy = 'SYSTEM') {
  const stmt = db.prepare(`
    INSERT INTO tod_questions (type, category, question_text, created_by)
    VALUES (?, ?, ?, ?)
  `);
  return stmt.run(type, category, questionText, createdBy);
}

/**
 * Memberikan hadiah koin ekonomi jika sukses menyelesaikan tantangan.
 */
function rewardUser(userId, guildId, coinsAmount) {
  db.transaction(() => {
    // Pastikan wallet ada
    const walletExists = db.prepare('SELECT 1 FROM wallets WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
    if (!walletExists) {
      db.prepare(`
        INSERT INTO wallets (user_id, guild_id, balance, total_earned)
        VALUES (?, ?, ?, ?)
      `).run(userId, guildId, coinsAmount, coinsAmount);
    } else {
      db.prepare(`
        UPDATE wallets 
        SET balance = balance + ?, total_earned = total_earned + ?
        WHERE user_id = ? AND guild_id = ?
      `).run(coinsAmount, coinsAmount, userId, guildId);
    }

    // Tambah di transaksi ekonomi
    db.prepare(`
      INSERT INTO transactions (user_id, guild_id, type, amount, created_at)
      VALUES (?, ?, 'EARN', ?, strftime('%s','now'))
    `).run(userId, guildId, coinsAmount);

    // Update stats tod
    const statsExists = db.prepare('SELECT 1 FROM tod_stats WHERE user_id = ?').get(userId);
    if (!statsExists) {
      db.prepare(`
        INSERT INTO tod_stats (user_id, total_coins_earned) VALUES (?, ?)
      `).run(userId, coinsAmount);
    } else {
      db.prepare(`
        UPDATE tod_stats SET total_coins_earned = total_coins_earned + ? WHERE user_id = ?
      `).run(coinsAmount, userId);
    }
  })();
}

/**
 * Memotong koin ekonomi (denda) jika skip tantangan.
 */
function fineUser(userId, guildId, coinsAmount) {
  let success = false;
  db.transaction(() => {
    // Ambil saldo saat ini
    const wallet = db.prepare('SELECT balance FROM wallets WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
    const balance = wallet ? wallet.balance : 0;

    // Tetap potong saldo (bisa minus atau mentok di 0 tergantung kebijakan, di sini kita biarkan bisa memotong saldo)
    const newBalance = Math.max(0, balance - coinsAmount);
    const finePaid = balance - newBalance; // Jumlah koin nyata yang terpotong

    if (!wallet) {
      db.prepare(`
        INSERT INTO wallets (user_id, guild_id, balance, total_earned)
        VALUES (?, ?, 0, 0)
      `).run(userId, guildId);
    } else {
      db.prepare(`
        UPDATE wallets SET balance = ? WHERE user_id = ? AND guild_id = ?
      `).run(newBalance, userId, guildId);
    }

    // Tambah di transaksi ekonomi (transaksi minus/pengeluaran)
    db.prepare(`
      INSERT INTO transactions (user_id, guild_id, type, amount, created_at)
      VALUES (?, ?, 'TOD_FINE', ?, strftime('%s','now'))
    `).run(userId, guildId, -finePaid);

    // Update stats tod
    const statsExists = db.prepare('SELECT 1 FROM tod_stats WHERE user_id = ?').get(userId);
    if (!statsExists) {
      db.prepare(`
        INSERT INTO tod_stats (user_id, total_fines_paid) VALUES (?, ?)
      `).run(userId, finePaid);
    } else {
      db.prepare(`
        UPDATE tod_stats SET total_fines_paid = total_fines_paid + ? WHERE user_id = ?
      `).run(finePaid, userId);
    }
    success = true;
  })();
  return success;
}

/**
 * Menambahkan statistik keberhasilan Truth/Dare.
 */
function incrementGameStats(userId, type) {
  const isTruth = type === 'truth';
  const column = isTruth ? 'truths_answered' : 'dares_completed';

  const statsExists = db.prepare('SELECT 1 FROM tod_stats WHERE user_id = ?').get(userId);
  if (!statsExists) {
    db.prepare(`
      INSERT INTO tod_stats (user_id, ${column}) VALUES (?, 1)
    `).run(userId);
  } else {
    db.prepare(`
      UPDATE tod_stats SET ${column} = ${column} + 1 WHERE user_id = ?
    `).run(userId);
  }
}

/**
 * Menambahkan statistik skip.
 */
function incrementSkipStats(userId) {
  const statsExists = db.prepare('SELECT 1 FROM tod_stats WHERE user_id = ?').get(userId);
  if (!statsExists) {
    db.prepare(`
      INSERT INTO tod_stats (user_id, skips_count) VALUES (?, 1)
    `).run(userId);
  } else {
    db.prepare(`
      UPDATE tod_stats SET skips_count = skips_count + 1 WHERE user_id = ?
    `).run(userId);
  }
}

/**
 * Mendapatkan statistik ToD user.
 */
function getUserStats(userId) {
  return db.prepare('SELECT * FROM tod_stats WHERE user_id = ?').get(userId) || {
    user_id: userId,
    truths_answered: 0,
    dares_completed: 0,
    skips_count: 0,
    total_coins_earned: 0,
    total_fines_paid: 0
  };
}

module.exports = {
  db,
  getRandomQuestion,
  addCustomQuestion,
  rewardUser,
  fineUser,
  incrementGameStats,
  incrementSkipStats,
  getUserStats
};
