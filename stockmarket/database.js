const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

// Tentukan path database dan pastikan foldernya ada
let finalDbPath = config.DATABASE_PATH;
let dbDir = path.dirname(finalDbPath);
let db;

try {
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`📁 Folder database dibuat di: ${dbDir}`);
  }
  db = new Database(finalDbPath);
} catch (error) {
  console.warn(`⚠️ Gagal mengakses database di '${finalDbPath}' (${error.message}). Menggunakan fallback database lokal...`);
  // Fallback ke path lokal
  finalDbPath = path.join(__dirname, '../data/economy.db');
  dbDir = path.dirname(finalDbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`📁 Folder database lokal dibuat di: ${dbDir}`);
  }
  db = new Database(finalDbPath);
}

console.log(`✅ Database SQLite terhubung di: ${finalDbPath}`);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

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

  // 1b. Migrasi dinamis: Tambahkan kolom auto_trade jika belum ada
  try {
    db.exec("ALTER TABLE wallets ADD COLUMN auto_trade INTEGER DEFAULT 0");
    console.log("⚡ [Database] Kolom 'auto_trade' berhasil ditambahkan/diverifikasi di tabel wallets.");
  } catch (e) {
    // Kolom sudah ada
  }

  // 1c. Migrasi dinamis: Tambahkan kolom jail_until jika belum ada
  try {
    db.exec("ALTER TABLE wallets ADD COLUMN jail_until INTEGER DEFAULT 0");
    console.log("⚡ [Database] Kolom 'jail_until' berhasil ditambahkan/diverifikasi di tabel wallets.");
  } catch (e) {
    // Kolom sudah ada
  }

  // 1d. Migrasi dinamis: Tambahkan kolom jail_type jika belum ada
  try {
    db.exec("ALTER TABLE wallets ADD COLUMN jail_type TEXT DEFAULT ''");
    console.log("⚡ [Database] Kolom 'jail_type' berhasil ditambahkan/diverifikasi di tabel wallets.");
  } catch (e) {
    // Kolom sudah ada
  }

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

  // 7. Active Events (Untuk menyimpan event berdurasi aktif per guild)
  db.exec(`
    CREATE TABLE IF NOT EXISTS active_events (
      guild_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      ends_at INTEGER NOT NULL,
      PRIMARY KEY (guild_id)
    )
  `);

  // 8. Bank Savings (Untuk sistem tabungan berbunga)
  db.exec(`
    CREATE TABLE IF NOT EXISTS bank_savings (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      balance INTEGER DEFAULT 0,
      last_interest_at INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now')),
      PRIMARY KEY (user_id, guild_id)
    )
  `);

  // 9. Bank Loans (Untuk sistem pinjaman berjangka tempo)
  db.exec(`
    CREATE TABLE IF NOT EXISTS bank_loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      principal_amount INTEGER NOT NULL,
      interest_rate REAL NOT NULL,
      total_due INTEGER NOT NULL,
      penalty_accumulated INTEGER DEFAULT 0,
      tenor_days INTEGER NOT NULL,
      due_at INTEGER NOT NULL,
      status TEXT DEFAULT 'ACTIVE',
      created_at INTEGER DEFAULT (strftime('%s','now'))
    )
  `);

  // 10. Kos Rentals (Untuk melacak durasi sewa kamar berdurasi)
  db.exec(`
    CREATE TABLE IF NOT EXISTS kos_rentals (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      room_tier TEXT NOT NULL,
      ends_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, guild_id)
    )
  `);

  // 11. Kos Upgrades (Untuk melacak upgrade kamar permanen yang dibeli)
  db.exec(`
    CREATE TABLE IF NOT EXISTS kos_upgrades (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      upgrade_id TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s','now')),
      PRIMARY KEY (user_id, guild_id, upgrade_id)
    )
  `);

  // 12. User Pets (Sistem Tamagotchi Pet)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_pets (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      pet_name TEXT NOT NULL,
      pet_type TEXT NOT NULL,
      status TEXT DEFAULT 'EGG',
      level INTEGER DEFAULT 1,
      xp INTEGER DEFAULT 0,
      health INTEGER DEFAULT 100,
      hunger INTEGER DEFAULT 100,
      thirst INTEGER DEFAULT 100,
      happiness INTEGER DEFAULT 100,
      last_interaction_at INTEGER DEFAULT (strftime('%s','now')),
      last_work_at INTEGER DEFAULT 0,
      last_hunt_at INTEGER DEFAULT 0,
      hatch_at INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now')),
      PRIMARY KEY (user_id, guild_id)
    )
  `);

  // 13. Pet Inventory (Stok makanan & obat-obatan pet)
  db.exec(`
    CREATE TABLE IF NOT EXISTS pet_inventory (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      quantity INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, guild_id, item_id)
    )
  `);

  // 14. Heist Cooldown (Untuk sistem perampokan bersama)
  db.exec(`
    CREATE TABLE IF NOT EXISTS heist_cooldown (
      guild_id TEXT NOT NULL PRIMARY KEY,
      last_heist_at INTEGER DEFAULT 0
    )
  `);

  // 15. Ebyus Settings (Admin Abuse / Sabotase)
  db.exec(`
    CREATE TABLE IF NOT EXISTS ebyus_settings (
      guild_id TEXT PRIMARY KEY,
      gacha_mode TEXT DEFAULT 'NORMAL',
      coin_multiplier INTEGER DEFAULT 1,
      updated_at INTEGER DEFAULT 0,
      updated_by TEXT,
      expires_at INTEGER DEFAULT 0
    )
  `);

  // Migrasi dinamis: Tambahkan kolom expires_at ke ebyus_settings jika belum ada
  try {
    db.exec("ALTER TABLE ebyus_settings ADD COLUMN expires_at INTEGER DEFAULT 0");
    console.log("⚡ [Database] Kolom 'expires_at' berhasil diverifikasi/ditambahkan di tabel ebyus_settings.");
  } catch (e) {
    // Kolom sudah ada
  }

  // Migrasi dinamis: Tambahkan kolom last_play_at ke user_pets jika belum ada
  try {
    db.exec("ALTER TABLE user_pets ADD COLUMN last_play_at INTEGER DEFAULT 0");
    console.log("⚡ [Database] Kolom 'last_play_at' berhasil diverifikasi/ditambahkan di tabel user_pets.");
  } catch (e) {
    // Kolom sudah ada
  }

  // Migrasi dinamis: Tambahkan kolom jail_count ke wallets jika belum ada
  try {
    db.exec("ALTER TABLE wallets ADD COLUMN jail_count INTEGER DEFAULT 0");
    console.log("⚡ [Database] Kolom 'jail_count' berhasil diverifikasi/ditambahkan di tabel wallets.");
  } catch (e) {
    // Kolom sudah ada
  }

  console.log('✅ Skema tabel database Stock Market, Toko Role, Perbankan, Kosan, Sistem Pet, Perampokan, & Ebyus Settings berhasil diinisialisasi.');
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
