const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

// Pastikan folder untuk database ada
const dbDir = path.dirname(config.DATABASE_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log(`📁 Folder database dibuat di: ${dbDir}`);
}

// Inisialisasi Database SQLite
let db;
try {
  db = new Database(config.DATABASE_PATH);
  console.log(`✅ Database SQLite terhubung di: ${config.DATABASE_PATH}`);
  
  // Set beberapa pragma untuk performa lebih baik
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
} catch (error) {
  console.error('❌ Gagal menginisialisasi database SQLite:', error);
  throw error;
}

// Inisialisasi Tabel
function initSchema() {
  // 1. Wallets (Saldo & Profil Ekonomi per Guild)
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

  // 2. Stocks (Data Saham Channel per Guild)
  db.exec(`
    CREATE TABLE IF NOT EXISTS stocks (
      channel_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      stock_name TEXT NOT NULL,
      stock_ticker TEXT NOT NULL,
      current_price INTEGER DEFAULT 100,
      previous_price INTEGER DEFAULT 100,
      total_shares INTEGER DEFAULT 1000,
      available_shares INTEGER DEFAULT 1000,
      activity_score REAL DEFAULT 0.0,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (strftime('%s','now')),
      PRIMARY KEY (channel_id, guild_id)
    )
  `);

  // 3. Portfolios (Portofolio Investor per Guild)
  db.exec(`
    CREATE TABLE IF NOT EXISTS portfolios (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      shares INTEGER DEFAULT 0,
      avg_buy_price INTEGER DEFAULT 0,
      total_invested INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, guild_id, channel_id)
    )
  `);

  // 4. Transactions (Riwayat Transaksi)
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      type TEXT NOT NULL, -- 'BUY', 'SELL', 'EARN', 'DAILY', 'TRANSFER_IN', 'TRANSFER_OUT', 'DIVIDEND'
      channel_id TEXT,
      amount INTEGER NOT NULL,
      shares INTEGER DEFAULT 0,
      price_per_share INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    )
  `);

  // 5. Price History (Untuk chart pergerakan harga saham)
  db.exec(`
    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      price INTEGER NOT NULL,
      activity_score REAL NOT NULL,
      recorded_at INTEGER DEFAULT (strftime('%s','now'))
    )
  `);

  // 6. Shop Items (Toko Role Discord Gamified)
  db.exec(`
    CREATE TABLE IF NOT EXISTS shop_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      role_name TEXT NOT NULL,
      price INTEGER NOT NULL,
      tier TEXT DEFAULT 'COMMON',
      stock INTEGER DEFAULT -1,
      is_gacha INTEGER DEFAULT 0,
      description TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    )
  `);

  console.log('✅ Skema tabel database Stock Market & Toko Role berhasil diinisialisasi.');
}

// Panggil fungsi inisialisasi skema saat startup
initSchema();

module.exports = {
  db,
  
  // Helper Query Dasar
  run: (sql, params = []) => db.prepare(sql).run(...params),
  get: (sql, params = []) => db.prepare(sql).get(...params),
  all: (sql, params = []) => db.prepare(sql).all(...params),
  transaction: (fn) => db.transaction(fn)
};
