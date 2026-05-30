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

// Daftar pet yang sebelumnya di-reset dari lv > 40
const petsToReset = [
  { userId: '436554535037698059', guildId: '1410239829874053296', petName: 'Luneo' },
  { userId: '559750271824297984', guildId: '1410239829874053296', petName: 'cimi' },
  { userId: '436554535037698059', guildId: '1410239829874053296', petName: 'Ramzi' },
  { userId: '750831950062944338', guildId: '1410239829874053296', petName: 'Lunaa' },
  { userId: '1391031873865646188', guildId: '1410239829874053296', petName: 'Keyed' },
  { userId: '1391031873865646188', guildId: '1410239829874053296', petName: 'Rimuru' },
  { userId: '750831950062944338', guildId: '1410239829874053296', petName: 'mr. blob' }
];

console.log('🔄 Memperbarui level pet ke 50 dengan status MATI (DEAD)...');

let updatedCount = 0;
const stmt = db.prepare(`
  UPDATE user_pets 
  SET level = 50, xp = 0, status = 'DEAD', health = 0, hunger = 0, thirst = 0, happiness = 0 
  WHERE user_id = ? AND guild_id = ? AND pet_name = ?
`);

petsToReset.forEach(p => {
  const result = stmt.run(p.userId, p.guildId, p.petName);
  if (result.changes > 0) {
    console.log(`✅ Pet '${p.petName}' (User: ${p.userId}) berhasil disetel ke Level 50 dan Berstatus MATI (DEAD)`);
    updatedCount++;
  } else {
    console.log(`⚠️ Gagal memperbarui pet '${p.petName}' milik User ID: ${p.userId}`);
  }
});

console.log(`\n🎉 Selesai! Berhasil menyesuaikan ${updatedCount} pet ke Level 50 dengan status DEAD.`);

db.close();
console.log('💾 Koneksi database ditutup.');
process.exit(0);
