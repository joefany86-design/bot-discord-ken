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

console.log('🔄 Memulai pembaruan seluruh pet player ke Level 10 ADULT...');
console.log('ℹ️ Mengabaikan pet khusus "Ramzi" (User: 436554535037698059) agar tetap Level 1 Dewa.');

const now = Math.floor(Date.now() / 1000);
const stmt = db.prepare(`
  UPDATE user_pets 
  SET level = 10,
      status = 'ADULT',
      health = 100,
      hunger = 100,
      thirst = 100,
      happiness = 100,
      last_interaction_at = ?
  WHERE NOT (user_id = '436554535037698059' AND LOWER(pet_name) = 'ramzi')
`);

const result = stmt.run(now);

console.log(`\n🎉 SUKSES! Berhasil memperbarui ${result.changes} pet di server menjadi Level 10 (ADULT) & Kondisi 100%.`);

db.close();
console.log('💾 Koneksi database ditutup.');
process.exit(0);
