const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Menggunakan process.cwd() agar kompatibel dijalankan dari folder project manapun
const configPath = path.join(process.cwd(), 'stockmarket/config');
const config = require(configPath);
let finalDbPath = config.DATABASE_PATH;

if (!fs.existsSync(finalDbPath)) {
  finalDbPath = path.join(process.cwd(), 'data/economy.db');
}

console.log(`Menghubungkan ke database: ${finalDbPath}`);
const db = new Database(finalDbPath);

const now = new Date();
const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);

console.log(`Tanggal hari ini (Asia/Jakarta): ${todayStr}\n`);

// Query semua wallet yang last_active_date !== todayStr
const query = `
  SELECT user_id, guild_id, balance, last_active_date, streak_days 
  FROM wallets 
  WHERE last_active_date IS NULL OR last_active_date != ?
  ORDER BY balance DESC
`;

const rows = db.prepare(query).all(todayStr);

console.log(`Ditemukan ${rows.length} user yang belum mengambil daily hari ini:\n`);
console.log('------------------------------------------------------------');
console.log('No. | User ID            | Guild ID           | Saldo (Rp)  | Klaim Terakhir | Streak');
console.log('------------------------------------------------------------');

rows.forEach((row, index) => {
  const klaim = row.last_active_date || 'Belum Pernah';
  console.log(`${String(index + 1).padEnd(4)}| ${row.user_id.padEnd(19)}| ${row.guild_id.padEnd(19)}| ${String(row.balance).padEnd(12)}| ${klaim.padEnd(14)} | ${row.streak_days}`);
});

console.log('------------------------------------------------------------');
db.close();
