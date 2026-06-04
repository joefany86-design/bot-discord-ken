const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../data/economy.db');
const db = new Database(dbPath);

const robbery = require('../stockmarket/robbery');

console.log("==================================================");
console.log("🧪 TESTING ROBBERY DUAL LIMITS (15 ATTEMPTS / 10 SUCCESSES)");
console.log("==================================================\n");

const thiefId = 'LIMIT_TEST_THIEF';
const victimId = 'LIMIT_TEST_VICTIM';
const guildId = 'LIMIT_TEST_GUILD';

// Clean up previous transactions/wallets
db.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM transactions WHERE guild_id = ?").run(guildId);

// Initialize wallets
db.prepare("INSERT INTO wallets (user_id, guild_id, balance, last_active_date) VALUES (?, ?, 50000, '2026-06-04')").run(thiefId, guildId);
db.prepare("INSERT INTO wallets (user_id, guild_id, balance, last_active_date) VALUES (?, ?, 50000, '2026-06-04')").run(victimId, guildId);

const nowSec = Math.floor(Date.now() / 1000);

// Helper function to insert transactions
function insertTransaction(userId, type, timeAgoSeconds) {
  db.prepare(`
    INSERT INTO transactions (user_id, guild_id, type, amount, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, guildId, type, 100, nowSec - timeAgoSeconds);
}

function resetThiefState() {
  db.prepare("UPDATE wallets SET jail_until = 0, jail_type = '', last_rob_at = 0 WHERE user_id = ? AND guild_id = ?").run(thiefId, guildId);
}

// 1. Test total attempts limit (15 total attempts)
console.log("👉 Scenario 1: Test 15 total attempts limit (all failed attempts)");
// Insert 14 failed attempts (ROB_VICTIM_COMPENSATION) in the last 23 hours
for (let i = 0; i < 14; i++) {
  insertTransaction(victimId, 'ROB_VICTIM_COMPENSATION', 3600); // 1 hour ago
}

// Verify stats before 15th
resetThiefState();
let stats = robbery.robSolo(thiefId, victimId, guildId);
console.log("   👉 15th attempt allowed because only 14 attempts existed.");

// Insert 1 more failed attempt to make it 15 attempts total
insertTransaction(victimId, 'ROB_VICTIM_COMPENSATION', 3600);

// The 16th attempt should fail
resetThiefState();
try {
  robbery.robSolo(thiefId, victimId, guildId);
  console.log("   ❌ FAILED: 16th attempt was allowed but should have been blocked!");
} catch (e) {
  if (e.message.includes("15 kali")) {
    console.log("   ✅ SUCCESS: 16th attempt blocked correctly with error:", e.message);
  } else {
    console.log("   ❌ FAILED: Blocked but with wrong error message:", e.message);
  }
}

// Clean up transactions for Scenario 2
db.prepare("DELETE FROM transactions WHERE guild_id = ?").run(guildId);

// 2. Test successful attempts limit (10 successful attempts)
console.log("\n👉 Scenario 2: Test 10 successful attempts limit");
// Insert 9 successful attempts (ROBBED_BY)
for (let i = 0; i < 9; i++) {
  insertTransaction(victimId, 'ROBBED_BY', 3600);
}

// Verify stats before 10th
resetThiefState();
stats = robbery.robSolo(thiefId, victimId, guildId);
console.log("   👉 10th attempt allowed because only 9 successful attempts existed.");

// Insert 1 more successful attempt to make it 10 successful attempts total
insertTransaction(victimId, 'ROBBED_BY', 3600);

// The 11th attempt should fail
resetThiefState();
try {
  robbery.robSolo(thiefId, victimId, guildId);
  console.log("   ❌ FAILED: 11th attempt was allowed but should have been blocked!");
} catch (e) {
  if (e.message.includes("10 kali")) {
    console.log("   ✅ SUCCESS: 11th attempt blocked correctly with error:", e.message);
  } else {
    console.log("   ❌ FAILED: Blocked but with wrong error message:", e.message);
  }
}

// Clean up
db.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM transactions WHERE guild_id = ?").run(guildId);
db.close();

console.log("\n==================================================");
console.log("🏁 TESTING COMPLETE");
console.log("==================================================");
