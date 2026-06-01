const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../data/economy.db');
const db = new Database(dbPath);

console.log("==================================================");
console.log("🧪 RUNNING STOCK LIMITS & HOLD DURATION TEST SUITE");
console.log("==================================================\n");

// Override isMarketOpen to bypass closed hour during test
const stocks = require('../stockmarket/stocks');
const config = require('../stockmarket/config');
const economy = require('../stockmarket/economy');

stocks.isMarketOpen = () => true;

const userId = 'TEST_LIMITS_USER';
const guildId = 'TEST_LIMITS_GUILD';
const channelId = 'TEST_LIMITS_CHANNEL';
const ticker = '$TEST';

// Cleanup previous test state
db.prepare("DELETE FROM stocks WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM portfolios WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM price_history WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM transactions WHERE guild_id = ?").run(guildId);

// 1. Setup Mock User Wallet & Stock
console.log("📦 1. Initializing Mock Wallet and Stock...");
db.prepare(
  `INSERT INTO wallets (user_id, guild_id, balance, total_earned, last_message_at) 
   VALUES (?, ?, 50000, 50000, 0)`
).run(userId, guildId);

db.prepare(
  `INSERT INTO stocks (channel_id, guild_id, stock_name, stock_ticker, current_price, previous_price, total_shares, available_shares) 
   VALUES (?, ?, 'Test Channel', ?, 100, 100, ?, ?)`
).run(channelId, guildId, ticker, config.market.TOTAL_BURSA_SHARES || 500, config.market.TOTAL_BURSA_SHARES || 500);

let stock = stocks.getStock(guildId, ticker);
let wallet = economy.getWallet(userId, guildId);
console.log(`   👉 Wallet Balance: Rp ${wallet.balance}`);
console.log(`   👉 Stock Ticker: ${stock.stock_ticker}, Price: Rp ${stock.current_price}, Total Bursa Shares: ${stock.total_shares}`);

// 2. Buy stocks to test daily shares limit (Max 10 shares total)
console.log("\n📥 2. Testing Daily Buy Shares Limit (Max 10)...");
let buySuccessCount = 0;
let lastError = null;

// Purchase #1: Buy 5 shares (should succeed)
try {
  stocks.buyStock(userId, guildId, ticker, 5);
  buySuccessCount++;
  console.log(`   ✅ Purchase #1 (5 shares) succeeded.`);
} catch (err) {
  console.log(`   ❌ Purchase #1 (5 shares) failed: ${err.message}`);
}

// Purchase #2: Buy 5 shares (should succeed)
try {
  stocks.buyStock(userId, guildId, ticker, 5);
  buySuccessCount++;
  console.log(`   ✅ Purchase #2 (5 shares) succeeded.`);
} catch (err) {
  console.log(`   ❌ Purchase #2 (5 shares) failed: ${err.message}`);
}

// Purchase #3: Buy 1 share (should fail since total is already 10)
try {
  stocks.buyStock(userId, guildId, ticker, 1);
  buySuccessCount++;
  console.log(`   ✅ Purchase #3 (1 share) succeeded.`);
} catch (err) {
  lastError = err.message;
  console.log(`   ❌ Purchase #3 (1 share) failed correctly: ${err.message}`);
}

if (buySuccessCount === 2 && lastError && lastError.includes("Batas Harian")) {
  console.log("   ✅ SUCCESS: Daily buy limit of 10 shares is enforced!");
} else {
  console.log(`   ❌ FAILED: Enforced purchases: ${buySuccessCount}, Error: ${lastError}`);
}

// 3. Test hold duration validation (bought recently, cannot sell)
console.log("\n⏳ 3. Testing Hold Duration (bought < 24h ago)...");
try {
  stocks.sellStock(userId, guildId, ticker, 10);
  console.log("   ❌ FAILED: Allowed selling recently bought stocks!");
} catch (err) {
  console.log(`   ✅ SUCCESS: Correctly blocked selling recently bought stocks: ${err.message}`);
}

// 4. Test selling older stocks (bought > 24h ago)
console.log("\n⏳ 4. Testing Hold Expiration (bought > 24h ago)...");
// Let's modify the transactions timestamps in the database to be 25 hours ago
db.prepare("UPDATE transactions SET created_at = created_at - 90000 WHERE user_id = ? AND guild_id = ?").run(userId, guildId);

try {
  const result = stocks.sellStock(userId, guildId, ticker, 10);
  console.log(`   ✅ SUCCESS: Allowed selling stocks after 24h hold! Net proceeds: Rp ${result.finalRevenue}`);
} catch (err) {
  console.log(`   ❌ FAILED: Blocked selling old stocks: ${err.message}`);
}

// 5. Test sell limit of 100 shares per transaction
console.log("\n📤 5. Testing Sell Limit (Max 100 shares)...");
// Setup user with 200 old shares in portfolio to test the cap
db.prepare(`
  INSERT OR REPLACE INTO portfolios (user_id, guild_id, channel_id, shares, avg_buy_price, total_invested)
  VALUES (?, ?, ?, 200, 100, 20000)
`).run(userId, guildId, channelId);

try {
  stocks.sellStock(userId, guildId, ticker, 120);
  console.log("   ❌ FAILED: Allowed selling 120 shares (exceeding 100 limit)!");
} catch (err) {
  console.log(`   ✅ SUCCESS: Correctly blocked selling more than 100 shares: ${err.message}`);
}

// 6. Test holding limit of 100 shares
console.log("\n📥 6. Testing Max Holding Limit (Max 100 shares)...");
// Setup user with 95 shares
db.prepare(`
  INSERT OR REPLACE INTO portfolios (user_id, guild_id, channel_id, shares, avg_buy_price, total_invested)
  VALUES (?, ?, ?, 95, 100, 9500)
`).run(userId, guildId, channelId);
// Try to buy 10 shares (total will be 105, which exceeds 100)
try {
  stocks.buyStock(userId, guildId, ticker, 10);
  console.log("   ❌ FAILED: Allowed buying shares that exceed 100 shares holding limit!");
} catch (err) {
  console.log(`   ✅ SUCCESS: Correctly blocked exceeding holding limit: ${err.message}`);
}

// Cleanup
db.prepare("DELETE FROM stocks WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM portfolios WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM transactions WHERE guild_id = ?").run(guildId);
db.close();

console.log("\n==================================================");
console.log("🏁 ALL TESTS COMPLETED!");
console.log("==================================================");
