const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const testDbPath = path.join(__dirname, 'data/test_watcher_economy.db');
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}
if (fs.existsSync(path.join(__dirname, 'data/economy.db'))) {
  fs.copyFileSync(path.join(__dirname, 'data/economy.db'), testDbPath);
}

console.log(`\n=== MENULIS DB UJI COBA DI: ${testDbPath} ===`);
const db = new Database(testDbPath);

// Hijack config
const config = require('./stockmarket/config');
const originalDbPath = config.DATABASE_PATH;
config.DATABASE_PATH = testDbPath;

// Clear requires cache
delete require.cache[require.resolve('./stockmarket/database')];
delete require.cache[require.resolve('./stockmarket/worldcup')];

const worldcup = require('./stockmarket/worldcup');

// Buat pertandingan uji coba yang sedang live saat ini
const testMatchId = 999;
const now = Date.now();
const testKickoff = now - 5 * 60 * 1000; // Mulai 5 menit lalu

const dateObj = new Date(testKickoff);
const dateStr = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(dateObj);
const hours = String(dateObj.getHours()).padStart(2, '0');
const minutes = String(dateObj.getMinutes()).padStart(2, '0');
const timeStr = `${hours}:${minutes} WIB`;

// Masukkan ke array matches
worldcup.matches.push({
  id: testMatchId,
  stage: 'Babak 32 Besar',
  home: 'Jerman 🇩🇪',
  away: 'Maroko 🇲🇦',
  wibDate: dateStr,
  wibTime: timeStr,
  score: '- - -',
  status: 'Mendatang'
});

console.log(`Uji Coba Match: Jerman vs Maroko (Kickoff: ${timeStr})`);

// Inisialisasi Tabel
db.exec(`
  CREATE TABLE IF NOT EXISTS worldcup_match_scores (
    match_id INTEGER PRIMARY KEY,
    score TEXT,
    status TEXT
  )
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS worldcup_match_events (
    event_id TEXT PRIMARY KEY,
    match_id INTEGER,
    event_type TEXT,
    details TEXT,
    created_at INTEGER
  )
`);
db.exec("INSERT OR REPLACE INTO ebyus_settings (guild_id, worldcup_channel_id) VALUES ('1234567890', 'mock_channel_id')");

// Force goal probability to 100% for this single test tick
const originalRandom = Math.random;
let forceGoal = true;
Math.random = () => {
  if (forceGoal) {
    forceGoal = false;
    return 0.01; // Force goal
  }
  return 0.5;
};

// Mock Discord Client
const mockClient = {
  guilds: {
    cache: {
      forEach: (callback) => {
        const mockGuild = {
          id: '1234567890',
          channels: {
            cache: {
              get: (id) => ({
                send: (msg) => {
                  console.log(`\n📢 [KIRIM DISCORD]:\n${msg.content}\n`);
                  return Promise.resolve();
                }
              })
            }
          }
        };
        callback(mockGuild);
      }
    }
  }
};

console.log("\n--- Memulai watcher.startLiveMatchWatcher() ---");
worldcup.startLiveMatchWatcher(mockClient);

setTimeout(() => {
  const scoreRow = db.prepare("SELECT * FROM worldcup_match_scores WHERE match_id = ?").get(testMatchId);
  const events = db.prepare("SELECT * FROM worldcup_match_events WHERE match_id = ?").all(testMatchId);

  console.log("--- HASIL DATABASE ---");
  console.log("Skor di DB:", scoreRow);
  console.log("Event Gol di DB:", events);

  // Restore
  Math.random = originalRandom;
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  config.DATABASE_PATH = originalDbPath;
  console.log("\n=== Uji coba selesai, database temporer dihapus. ===\n");
  process.exit(0);
}, 1500);
