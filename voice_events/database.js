/**
 * Database Handler for Truth or Dare Game
 * Integrasi Penuh dengan Perekonomian "Rupiah Server"
 */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('./config');

let finalDbPath = config.DATABASE_PATH;
let dbDir = path.dirname(finalDbPath);
let db;

try {
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`📁 [VoiceDb] Folder database dibuat di: ${dbDir}`);
  }
  db = new Database(finalDbPath);
} catch (error) {
  console.warn(`⚠️ [VoiceDb] Gagal mengakses database di '${finalDbPath}' (${error.message}). Fallback ke database lokal...`);
  finalDbPath = path.join(__dirname, '../data/economy.db');
  dbDir = path.dirname(finalDbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  db = new Database(finalDbPath);
}

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
console.log(`✅ [VoiceDb] Terkoneksi ke database SQLite di: ${finalDbPath}`);

// Inisialisasi Skema Tabel Game ToD
function initSchema() {
  // 1. Tabel tod_questions untuk menyimpan kumpulan pertanyaan Truth & Dare
  db.exec(`
    CREATE TABLE IF NOT EXISTS tod_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT CHECK(type IN ('truth', 'dare')),
      category TEXT CHECK(category IN ('chill', 'deep', 'spicy')),
      question_text TEXT NOT NULL,
      created_by TEXT DEFAULT 'SYSTEM'
    );
    CREATE INDEX IF NOT EXISTS idx_tod_type_cat ON tod_questions(type, category);
  `);

  // 2. Tabel tod_stats untuk menyimpan pencapaian & track record user bermain ToD
  db.exec(`
    CREATE TABLE IF NOT EXISTS tod_stats (
      user_id TEXT PRIMARY KEY,
      truths_answered INTEGER DEFAULT 0,
      dares_completed INTEGER DEFAULT 0,
      skips_count INTEGER DEFAULT 0,
      total_coins_earned INTEGER DEFAULT 0,
      total_fines_paid INTEGER DEFAULT 0
    );
  `);

  // 3. Pastikan tabel wallets & transactions yang di-share dengan bursa saham terbuat dengan benar
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
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      type TEXT NOT NULL,
      channel_id TEXT,
      amount INTEGER NOT NULL,
      shares INTEGER DEFAULT 0,
      price_per_share INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );
  `);

  console.log('✅ [VoiceDb] Skema tabel Truth or Dare berhasil diinisialisasi.');
}

initSchema();

// State Memory untuk melacak pertanyaan yang sudah keluar agar tidak duplikat
// Map<guildId, Map<type_category, Set<questionId>>>
const activeQueues = new Map();

/**
 * Mengambil pertanyaan acak dengan jaminan anti-duplikasi per server.
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

  // Ambil semua ID pertanyaan yang sesuai kriteria
  const allIds = db.prepare(
    'SELECT id FROM tod_questions WHERE type = ? AND category = ?'
  ).all(type, category).map(row => row.id);

  if (allIds.length === 0) return null;

  // Cari ID yang belum pernah keluar
  let availableIds = allIds.filter(id => !excludeSet.has(id));

  // Reset antrean jika semua pertanyaan sudah pernah keluar
  if (availableIds.length === 0) {
    excludeSet.clear();
    availableIds = allIds;
  }

  // Pilih satu secara acak
  const chosenId = availableIds[Math.floor(Math.random() * availableIds.length)];
  excludeSet.add(chosenId);

  return db.prepare('SELECT * FROM tod_questions WHERE id = ?').get(chosenId);
}

/**
 * Menambahkan pertanyaan kustom ke database
 */
function addCustomQuestion(type, category, questionText, createdBy = 'SYSTEM') {
  const stmt = db.prepare(`
    INSERT INTO tod_questions (type, category, question_text, created_by)
    VALUES (?, ?, ?, ?)
  `);
  return stmt.run(type, category, questionText, createdBy);
}

/**
 * Memberikan koin hadiah keberhasilan ToD & mencatat transaksi ekonomi
 */
function rewardUser(userId, guildId, coinsAmount, isChallenger = false) {
  db.transaction(() => {
    // 1. Pastikan wallet ada
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

    // 2. Catat ke transaksi ekonomi bursa
    db.prepare(`
      INSERT INTO transactions (user_id, guild_id, type, amount)
      VALUES (?, ?, ?, ?)
    `).run(userId, guildId, isChallenger ? 'TOD_CHALLENGER_BONUS' : 'EARN', coinsAmount);

    // 3. Catat di statistik tod
    if (!isChallenger) {
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
    }
  })();
}

/**
 * Memotong koin (denda) jika korban menyerah dalam tantangan
 */
function fineUser(userId, guildId, coinsAmount) {
  let success = false;
  db.transaction(() => {
    const wallet = db.prepare('SELECT balance FROM wallets WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
    const balance = wallet ? wallet.balance : 0;
    const newBalance = balance - coinsAmount;

    if (!wallet) {
      db.prepare(`
        INSERT INTO wallets (user_id, guild_id, balance, total_earned)
        VALUES (?, ?, ?, 0)
      `).run(userId, guildId, newBalance);
    } else {
      db.prepare(`
        UPDATE wallets SET balance = ? WHERE user_id = ? AND guild_id = ?
      `).run(newBalance, userId, guildId);
    }

    // Catat denda ToD di database transaksi
    db.prepare(`
      INSERT INTO transactions (user_id, guild_id, type, amount)
      VALUES (?, ?, 'TOD_FINE', ?)
    `).run(userId, guildId, -coinsAmount);

    // Catat statistik denda
    const statsExists = db.prepare('SELECT 1 FROM tod_stats WHERE user_id = ?').get(userId);
    if (!statsExists) {
      db.prepare(`
        INSERT INTO tod_stats (user_id, total_fines_paid) VALUES (?, ?)
      `).run(userId, coinsAmount);
    } else {
      db.prepare(`
        UPDATE tod_stats SET total_fines_paid = total_fines_paid + ? WHERE user_id = ?
      `).run(coinsAmount, userId);
    }
    success = true;
  })();
  return success;
}

/**
 * Mencatat hasil keberhasilan giliran ToD
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
 * Mencatat hasil skip/menyerah
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
 * Mendapatkan profil & data realtime ToD milik user
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

/**
 * Mengambil peringkat 5 pemain dengan penyelesaian Dare terbanyak
 */
function getTopDares(limit = 5) {
  return db.prepare('SELECT user_id, dares_completed FROM tod_stats WHERE dares_completed > 0 ORDER BY dares_completed DESC LIMIT ?').all(limit);
}

/**
 * Mengambil peringkat 5 pemain dengan penyelesaian Truth terbanyak
 */
function getTopTruths(limit = 5) {
  return db.prepare('SELECT user_id, truths_answered FROM tod_stats WHERE truths_answered > 0 ORDER BY truths_answered DESC LIMIT ?').all(limit);
}

/**
 * Mengambil peringkat 5 pemain paling penakut (skip terbanyak)
 */
function getTopSkips(limit = 5) {
  return db.prepare('SELECT user_id, skips_count FROM tod_stats WHERE skips_count > 0 ORDER BY skips_count DESC LIMIT ?').all(limit);
}

module.exports = {
  db,
  getRandomQuestion,
  addCustomQuestion,
  rewardUser,
  fineUser,
  incrementGameStats,
  incrementSkipStats,
  getUserStats,
  getTopDares,
  getTopTruths,
  getTopSkips
};

// Hubungkan otomatis ke seeder untuk populasi data jika tod_questions kosong
try {
  const row = db.prepare('SELECT COUNT(*) as count FROM tod_questions').get();
  if (!row || row.count < 30) {
    console.log('⚠️ [VoiceDb] Database tod_questions kosong / tidak lengkap. Menjalankan auto-seeding...');
    const { runSeeding } = require('./questions_seed');
    runSeeding();
  }
} catch (err) {
  console.warn('⚠️ [VoiceDb] Gagal memeriksa auto-seeding:', err.message);
}
