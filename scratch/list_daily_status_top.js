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

// Limit to top 30 richest users who haven't claimed daily
const query = `
  SELECT user_id, guild_id, balance, last_active_date, streak_days 
  FROM wallets 
  WHERE last_active_date IS NULL OR last_active_date != ?
  ORDER BY balance DESC
  LIMIT 30
`;
const rows = db.prepare(query).all(todayStr);
db.close();

client.once('ready', async () => {
  // Resolve usernames in parallel (only 30 users, so it's super fast and safe)
  const resolvedRows = await Promise.all(rows.map(async (row) => {
    let username = 'Unknown User';
    try {
      const user = await client.users.fetch(row.user_id);
      username = user.tag;
    } catch (e) {
      username = `Tidak dapat dimuat`;
    }
    return { ...row, username };
  }));

  console.log(`TOTAL_USERS:${rows.length}`);
  resolvedRows.forEach((row, idx) => {
    const klaim = row.last_active_date || 'Belum Pernah';
    console.log(`ROW|${idx + 1}|${row.user_id}|${row.username}|${row.balance}|${klaim}`);
  });
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN).catch(e => {
  console.error("Login failed:", e.message);
  process.exit(1);
});
