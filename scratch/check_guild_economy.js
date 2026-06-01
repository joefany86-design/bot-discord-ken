const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/economy.db');
const db = new Database(dbPath);
const guildId = '1410239829874053296';

console.log(`=== AUDIT EKONOMI GUILD ${guildId} ===`);

// 1. Wallets
const walletStats = db.prepare('SELECT COUNT(*) as count, SUM(balance) as total_balance, AVG(balance) as avg_balance FROM wallets WHERE guild_id = ?').get(guildId);

// 2. Bank Savings
let bankStats = { total_savings: 0, count: 0 };
try {
  bankStats = db.prepare('SELECT COUNT(*) as count, SUM(balance) as total_savings, AVG(balance) as avg_savings FROM bank_savings WHERE guild_id = ?').get(guildId) || { total_savings: 0, count: 0 };
} catch(e) {
  console.log('bank_savings table might not exist or error:', e.message);
}

// 3. Top Wealthy Players
let topWealthy = [];
try {
  topWealthy = db.prepare(`
    SELECT 
      w.user_id, 
      w.balance as wallet_balance, 
      COALESCE(b.balance, 0) as bank_balance, 
      (w.balance + COALESCE(b.balance, 0)) as total_wealth,
      w.streak_days,
      w.last_active_date
    FROM wallets w
    LEFT JOIN bank_savings b ON w.user_id = b.user_id AND w.guild_id = b.guild_id
    WHERE w.guild_id = ?
    ORDER BY total_wealth DESC
    LIMIT 100
  `).all(guildId);
} catch(e) {
  console.log('Top wealthy error:', e.message);
}

// 4. Active Stocks
let stocksList = [];
try {
  stocksList = db.prepare('SELECT stock_name, stock_ticker, current_price, previous_price, total_shares - available_shares as owned_shares FROM stocks WHERE guild_id = ?').all(guildId);
} catch(e) {
  console.log('Stocks error:', e.message);
}

// 5. Portfolios (Total invested per user)
let portfoliosCount = 0;
try {
  const row = db.prepare('SELECT COUNT(DISTINCT user_id) as count FROM portfolios WHERE guild_id = ?').get(guildId);
  portfoliosCount = row ? row.count : 0;
} catch(e) {}

// Output results as JSON for clean parsing
console.log(JSON.stringify({
  walletStats,
  bankStats,
  topWealthy,
  stocksList,
  portfoliosCount
}, null, 2));
db.close();
