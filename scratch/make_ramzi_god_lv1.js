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

const targetUserId = '436554535037698059';
const targetGuildId = '1410239829874053296';
const targetPetName = 'Ramzi';

console.log(`⚡ Meng-upgrade pet '${targetPetName}' menjadi Dewa Level 1 (BABY)...`);

const stmt = db.prepare(`
  UPDATE user_pets 
  SET level = 1, 
      xp = 0, 
      status = 'BABY', 
      trait = 'WARRIOR', 
      xp_multiplier = 8.0, 
      health = 100, 
      hunger = 100, 
      thirst = 100, 
      happiness = 100,
      last_interaction_at = ?
  WHERE user_id = ? AND guild_id = ? AND LOWER(pet_name) = LOWER(?)
`);

const now = Math.floor(Date.now() / 1000);
const result = stmt.run(now, targetUserId, targetGuildId, targetPetName);

if (result.changes > 0) {
  console.log(`\n🎉 SUKSES! Pet '${targetPetName}' milik User: ${targetUserId} kini telah menjadi Dewa Level 1 (BABY) yang tak terkalahkan!`);
} else {
  console.log(`\n❌ GAGAL! Pet '${targetPetName}' tidak ditemukan.`);
}

db.close();
console.log('💾 Koneksi database ditutup.');
process.exit(0);
