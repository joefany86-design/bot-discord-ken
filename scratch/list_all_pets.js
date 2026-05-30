const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const pathsToTry = [
  process.env.DATABASE_PATH,
  '/data/db/economy.db', // Jalur produksi VPS
  path.join(__dirname, '../data/economy.db') // Jalur lokal fallback
];

let dbPath = null;
for (const p of pathsToTry) {
  if (p && fs.existsSync(p)) {
    dbPath = p;
    break;
  }
}

if (!dbPath) {
  try {
    const config = require('../stockmarket/config.js');
    if (config.DATABASE_PATH && fs.existsSync(config.DATABASE_PATH)) {
      dbPath = config.DATABASE_PATH;
    }
  } catch (e) {}
}

if (!dbPath) {
  dbPath = path.join(__dirname, '../data/economy.db');
}

console.log(`🔍 Menghubungkan ke database di: ${dbPath}`);

let db;
try {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
} catch (error) {
  console.error(`❌ Gagal membuka database: ${error.message}`);
  process.exit(1);
}

console.log('📊 Mengambil seluruh daftar pet milik player...');
const allPets = db.prepare('SELECT * FROM user_pets ORDER BY guild_id, user_id, is_active DESC').all();

if (allPets.length === 0) {
  console.log('ℹ️ Tidak ada pet yang terdaftar di database.');
} else {
  console.log(JSON.stringify(allPets, null, 2));
}

db.close();
process.exit(0);
