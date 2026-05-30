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

const targetUserId = '559750271824297984';
const targetPetName = 'cimi';
const now = Math.floor(Date.now() / 1000);

console.log(`🔄 Menghidupkan kembali pet '${targetPetName}' milik User: ${targetUserId}...`);

const stmt = db.prepare(`
  UPDATE user_pets 
  SET level = 1, xp = 0, status = 'BABY', health = 100, hunger = 100, thirst = 100, happiness = 100, last_interaction_at = ? 
  WHERE user_id = ? AND LOWER(pet_name) = LOWER(?)
`);

const result = stmt.run(now, targetUserId, targetPetName);

if (result.changes > 0) {
  console.log(`\n🎉 SUKSES! Pet '${targetPetName}' berhasil dihidupkan kembali ke Level 1 dengan kondisi prima (100%).`);
} else {
  console.log(`\n❌ GAGAL! Pet '${targetPetName}' milik User: ${targetUserId} tidak ditemukan.`);
}

db.close();
console.log('💾 Koneksi database ditutup.');
process.exit(0);
