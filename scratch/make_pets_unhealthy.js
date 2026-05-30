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

console.log('🔄 Memperbarui kondisi fisik pet (lapar, haus, sakit)...');

let updatedCount = 0;
const stmt = db.prepare('UPDATE user_pets SET health = 20, hunger = 15, thirst = 15, happiness = 20 WHERE user_id = ? AND guild_id = ? AND pet_name = ?');

petsToReset.forEach(p => {
  const result = stmt.run(p.userId, p.guildId, p.petName);
  if (result.changes > 0) {
    console.log(`✅ Pet '${p.petName}' (User: ${p.userId}) sekarang Lapar (15%), Haus (15%), Sedih (20%), dan Sakit (20% HP)`);
    updatedCount++;
  } else {
    console.log(`⚠️ Gagal memperbarui pet '${p.petName}' milik User ID: ${p.userId}`);
  }
});

console.log(`\n🎉 Selesai! Berhasil menyesuaikan kondisi fisik ${updatedCount} pet.`);

db.close();
console.log('💾 Koneksi database ditutup.');
process.exit(0);
