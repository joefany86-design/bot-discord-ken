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

const pathsToTry = [
  process.env.DATABASE_PATH,
  '/data/db/economy.db',
  path.join(__dirname, '../data/economy.db')
];

let dbPath = null;
for (const p of pathsToTry) {
  if (p && fs.existsSync(p)) {
    dbPath = p;
    break;
  }
}

if (!dbPath) {
  dbPath = path.join(__dirname, '../data/economy.db');
}

let db = new Database(dbPath);
const uniqueOwners = db.prepare('SELECT DISTINCT user_id FROM user_pets').all();
db.close();

client.once('ready', async () => {
  console.log(`🤖 Login sukses sebagai ${client.user.tag}`);
  console.log('🔍 Mengambil username Discord untuk para pemilik pet...\n');
  
  console.log('| No | User ID | Username Discord |');
  console.log('|---|---|---|');
  
  for (let i = 0; i < uniqueOwners.length; i++) {
    const userId = uniqueOwners[i].user_id;
    let username = 'Unknown User';
    try {
      const user = await client.users.fetch(userId);
      username = user.tag;
    } catch (e) {
      username = `Tidak dapat dimuat (${e.message})`;
    }
    console.log(`| ${i + 1} | \`${userId}\` | **@${username}** |`);
  }
  
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN).catch(e => {
  console.error("Login failed:", e.message);
  process.exit(1);
});
