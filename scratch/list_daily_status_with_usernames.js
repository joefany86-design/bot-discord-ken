require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

// Menggunakan process.cwd() agar kompatibel dijalankan dari folder project manapun
const configPath = path.join(process.cwd(), 'stockmarket/config');
const config = require(configPath);
let finalDbPath = config.DATABASE_PATH;

if (!fs.existsSync(finalDbPath)) {
  finalDbPath = path.join(process.cwd(), 'data/economy.db');
}

const db = new Database(finalDbPath);

const now = new Date();
const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);

const query = `
  SELECT user_id, guild_id, balance, last_active_date, streak_days 
  FROM wallets 
  WHERE last_active_date IS NULL OR last_active_date != ?
  ORDER BY balance DESC
`;
const rows = db.prepare(query).all(todayStr);
db.close();

client.once('ready', async () => {
  console.log(`🤖 Login sukses sebagai ${client.user.tag}`);
  console.log(`Tanggal hari ini (Asia/Jakarta): ${todayStr}`);
  console.log(`Mengambil username Discord untuk ${rows.length} user...\n`);
  
  console.log('-----------------------------------------------------------------------------');
  console.log('No.  | User ID            | Username Discord          | Saldo (Rp)  | Klaim Terakhir');
  console.log('-----------------------------------------------------------------------------');

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let username = 'Unknown User';
    try {
      const user = await client.users.fetch(row.user_id);
      username = user.tag;
    } catch (e) {
      username = `Tidak dapat dimuat`;
    }
    const klaim = row.last_active_date || 'Belum Pernah';
    console.log(`${String(i + 1).padEnd(5)}| ${row.user_id.padEnd(19)}| ${username.padEnd(26)}| ${String(row.balance).padEnd(12)}| ${klaim}`);
  }
  
  console.log('-----------------------------------------------------------------------------');
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN).catch(e => {
  console.error("Login failed:", e.message);
  process.exit(1);
});
