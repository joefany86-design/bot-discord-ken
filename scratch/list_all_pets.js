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

let db;
try {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
} catch (error) {
  console.error(`❌ Gagal membuka database: ${error.message}`);
  process.exit(1);
}

const allPets = db.prepare('SELECT * FROM user_pets ORDER BY guild_id, user_id, is_active DESC').all();

if (allPets.length === 0) {
  console.log('ℹ️ Tidak ada pet yang terdaftar di database.');
} else {
  console.log('| No | Owner (User ID) | Pet Name | Species | Level | Status | HP | Hunger | Thirst | Happiness | Trait | Active | Multiplier |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  allPets.forEach((pet, i) => {
    const activeLabel = pet.is_active === 1 ? '✅ Aktif' : '❌ Pasif';
    const traitLabel = pet.trait ? `**${pet.trait}**` : '-';
    console.log(`| ${i + 1} | \`${pet.user_id}\` | **${pet.pet_name}** | ${pet.pet_type} | ${pet.level} | ${pet.status} | ${pet.health}% | ${pet.hunger}% | ${pet.thirst}% | ${pet.happiness}% | ${traitLabel} | ${activeLabel} | ${pet.xp_multiplier || 1}x |`);
  });
}

db.close();
process.exit(0);
