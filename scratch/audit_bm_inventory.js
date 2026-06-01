const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env
require('dotenv').config({ path: path.join(__dirname, '../.env') });

let dbPath = path.join(__dirname, '../data/economy.db');
if (!fs.existsSync(dbPath)) {
  dbPath = process.env.DATABASE_PATH || '/data/db/economy.db';
}
const db = new Database(dbPath);
const targetGuildId = '1410239829874053296';
const token = process.env.DISCORD_TOKEN;

// 1. Fetch user inventories with quantity > 0 for BM items
const rows = db.prepare(`
  SELECT user_id, item_id, quantity 
  FROM user_inventory 
  WHERE guild_id = ? AND quantity > 0 AND item_id IN ('LOCKPICK', 'MASK', 'MEAT', 'SOAP')
`).all(targetGuildId);

// Group by user
const usersMap = {};
rows.forEach(r => {
  if (!usersMap[r.user_id]) {
    usersMap[r.user_id] = {};
  }
  usersMap[r.user_id][r.item_id] = r.quantity;
});

const userIds = Object.keys(usersMap);

async function fetchUsername(userId) {
  try {
    const res = await fetch(`https://discord.com/api/v10/users/${userId}`, {
      headers: {
        Authorization: `Bot ${token}`
      }
    });
    if (!res.ok) {
      return 'Unknown Warga';
    }
    const data = await res.json();
    return data.global_name || data.username;
  } catch (err) {
    return 'Error Fetching';
  }
}

async function run() {
  const results = [];
  for (let i = 0; i < userIds.length; i++) {
    const uId = userIds[i];
    const name = await fetchUsername(uId);
    results.push({
      userId: uId,
      name: name,
      items: usersMap[uId]
    });
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('=== AUDIT_BM_RESULTS ===');
  console.log(JSON.stringify(results, null, 2));
  db.close();
}

run();
