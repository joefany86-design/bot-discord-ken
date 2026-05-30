const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// 1. Dapatkan path database dari config
const configPath = path.join(__dirname, '../stockmarket/config.js');
let dbPath;

if (fs.existsSync(configPath)) {
  const config = require(configPath);
  dbPath = config.DATABASE_PATH;
}

// Fallback jika tidak ada config atau path
if (!dbPath || !fs.existsSync(path.dirname(dbPath))) {
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

// 2. Query pets dengan level > 40
console.log('📊 Mencari pet dengan level di atas 40...');
const highLevelPets = db.prepare('SELECT * FROM user_pets WHERE level > 40').all();

if (highLevelPets.length === 0) {
  console.log('✅ Tidak ditemukan pet dengan level di atas 40.');
} else {
  console.log(`⚠️ Menemukan ${highLevelPets.length} pet dengan level > 40:`);
  highLevelPets.forEach(pet => {
    console.log(`   👤 User ID: ${pet.user_id} | Guild ID: ${pet.guild_id} | Nama: ${pet.pet_name} | Tipe: ${pet.pet_type} | Level: ${pet.level} (XP: ${pet.xp})`);
  });

  console.log('\n🔄 Memulai proses reset level ke 3...');
  try {
    const stmt = db.prepare('UPDATE user_pets SET level = 3, xp = 0 WHERE level > 40');
    const info = stmt.run();
    console.log(`✅ Sukses mereset ${info.changes} pet ke Level 3 & XP 0!`);
  } catch (err) {
    console.error(`❌ Gagal memperbarui database: ${err.message}`);
  }
}

db.close();
console.log('💾 Koneksi database ditutup.');
process.exit(0);
