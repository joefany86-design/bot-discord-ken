const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Load .env manual
const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const token = env.DISCORD_TOKEN;
const guildId = '1410239829874053296';
const dbPath = path.join(__dirname, '../data/economy.db');
const db = new Database(dbPath);

// Fetch all user IDs in this guild
const users = db.prepare(`
  SELECT w.user_id, w.balance, COALESCE(b.balance, 0) as bank_balance
  FROM wallets w
  LEFT JOIN bank_savings b ON w.user_id = b.user_id AND w.guild_id = b.guild_id
  WHERE w.guild_id = ?
  ORDER BY (w.balance + COALESCE(b.balance, 0)) DESC
`).all(guildId);

console.log(`Loaded ${users.length} users from DB. Fetching usernames from Discord API...`);

async function fetchUsername(userId) {
  try {
    const res = await fetch(`https://discord.com/api/v10/users/${userId}`, {
      headers: {
        Authorization: `Bot ${token}`
      }
    });
    if (!res.ok) {
      // Fallback: try fetching member in guild
      const memberRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
        headers: {
          Authorization: `Bot ${token}`
        }
      });
      if (memberRes.ok) {
        const memberData = await memberRes.json();
        return memberData.user.global_name || memberData.user.username || memberData.nick;
      }
      return 'Unknown Warga';
    }
    const data = await res.json();
    return data.global_name || data.username || `${data.username}#${data.discriminator}`;
  } catch (err) {
    return 'Error Fetching';
  }
}

async function run() {
  const results = [];
  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    console.log(`[${i+1}/${users.length}] Fetching ${u.user_id}...`);
    const name = await fetchUsername(u.user_id);
    results.push({
      userId: u.user_id,
      name: name,
      balance: u.balance,
      bank: u.bank_balance,
      total: u.balance + u.bank_balance
    });
    // Sleep 150ms to prevent aggressive rate limiting
    await new Promise(r => setTimeout(r, 150));
  }

  console.log('=== FINAL_RESULTS ===');
  console.log(JSON.stringify(results, null, 2));
}

run();
