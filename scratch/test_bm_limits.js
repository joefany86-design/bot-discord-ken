const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../data/economy.db');
const db = new Database(dbPath);

console.log("==================================================");
console.log("🧪 RUNNING BLACK MARKET ITEM LIMITS TEST SUITE");
console.log("==================================================\n");

const bm = require('../stockmarket/blackmarket');
const economy = require('../stockmarket/economy');

const userId = 'TEST_BM_LIMITS_USER';
const guildId = 'TEST_BM_LIMITS_GUILD';

// Cleanup previous test state
db.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM user_inventory WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM transactions WHERE guild_id = ?").run(guildId);

// 1. Setup Mock User Wallet with plenty of cash
console.log("📦 1. Initializing Mock Wallet...");
db.prepare(
  `INSERT INTO wallets (user_id, guild_id, balance, total_earned, last_message_at) 
   VALUES (?, ?, 100000, 100000, 0)`
).run(userId, guildId);

let wallet = economy.getWallet(userId, guildId);
console.log(`   👉 Wallet Balance: Rp ${wallet.balance}`);

// 2. Buy Lockpicks (max limit 10)
console.log("\n🕵️‍♂️ 2. Testing BM Item Purchase Limit (Max 10 per item)...");
let buySuccessCount = 0;
let lastError = null;

// Purchase #1: Buy 5 Lockpicks (should succeed)
try {
  bm.buyItem(userId, guildId, 'LOCKPICK', 5);
  buySuccessCount += 5;
  console.log(`   ✅ Purchase #1 (5 Lockpicks) succeeded. Current Qty: ${bm.getItemQty(userId, guildId, 'LOCKPICK')}`);
} catch (err) {
  console.log(`   ❌ Purchase #1 failed: ${err.message}`);
}

// Purchase #2: Buy 5 Lockpicks (should succeed, reaching 10)
try {
  bm.buyItem(userId, guildId, 'LOCKPICK', 5);
  buySuccessCount += 5;
  console.log(`   ✅ Purchase #2 (5 Lockpicks) succeeded. Current Qty: ${bm.getItemQty(userId, guildId, 'LOCKPICK')}`);
} catch (err) {
  console.log(`   ❌ Purchase #2 failed: ${err.message}`);
}

// Purchase #3: Buy 1 Lockpick (should fail since limit of 10 is reached)
try {
  bm.buyItem(userId, guildId, 'LOCKPICK', 1);
  buySuccessCount += 1;
  console.log(`   ❌ Purchase #3 (1 Lockpick) succeeded unexpectedly!`);
} catch (err) {
  lastError = err.message;
  console.log(`   ✅ Purchase #3 failed correctly: ${err.message}`);
}

if (buySuccessCount === 10 && lastError && lastError.includes("Batas Penyimpanan")) {
  console.log("\n   ✅ SUCCESS: Daily BM item purchase limit of 10 is enforced successfully!");
} else {
  console.log(`\n   ❌ FAILED: Enforced purchases: ${buySuccessCount}, Error: ${lastError}`);
}

// Cleanup
db.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM user_inventory WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM transactions WHERE guild_id = ?").run(guildId);
db.close();

console.log("\n==================================================");
console.log("🏁 ALL TESTS COMPLETED!");
console.log("==================================================");
