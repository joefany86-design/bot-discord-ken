const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../data/economy.db');
const db = new Database(dbPath);

const robbery = require('../stockmarket/robbery');

console.log("==================================================");
console.log("🧪 TESTING ROBBERY PERSONAL LIMIT ONLY");
console.log("==================================================\n");

const thiefId = 'LIMIT_TEST_THIEF';
const victimId = 'LIMIT_TEST_VICTIM';
const guildId = 'LIMIT_TEST_GUILD';

// Clean up previous transactions/wallets/robbery attempts
db.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM transactions WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM robbery_attempts WHERE guild_id = ?").run(guildId);

// Initialize wallets
db.prepare("INSERT INTO wallets (user_id, guild_id, balance, last_active_date) VALUES (?, ?, 50000, '2026-06-04')").run(thiefId, guildId);
db.prepare("INSERT INTO wallets (user_id, guild_id, balance, last_active_date) VALUES (?, ?, 50000, '2026-06-04')").run(victimId, guildId);

const nowSec = Math.floor(Date.now() / 1000);

// Helper function to insert robbery attempts
function insertRobberyAttempt(robberId, targetId, success, timeAgoSeconds) {
  db.prepare(`
    INSERT INTO robbery_attempts (robber_id, target_id, guild_id, success, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(robberId, targetId, guildId, success, nowSec - timeAgoSeconds);
}

function resetThiefState() {
  db.prepare("UPDATE wallets SET jail_until = 0, jail_type = '', last_rob_at = 0 WHERE user_id = ? AND guild_id = ?").run(thiefId, guildId);
}

// 1. Test personal limit: Robber A can target Victim B at most 10 times in 24 hours
console.log("👉 Scenario 1: Test personal limit (robber can target same victim max 10 times)");
// Insert 9 attempts by thiefId on victimId (failures)
for (let i = 0; i < 9; i++) {
  insertRobberyAttempt(thiefId, victimId, 0, 3600);
}

// Verify 10th attempt is allowed
resetThiefState();
let stats = robbery.robSolo(thiefId, victimId, guildId);
console.log("   👉 10th attempt allowed because robber only targeted victim 9 times.");

// Insert 1 more attempt to make it 10 attempts total
insertRobberyAttempt(thiefId, victimId, 0, 3600);

// The 11th attempt should fail
resetThiefState();
try {
  robbery.robSolo(thiefId, victimId, guildId);
  console.log("   ❌ FAILED: 11th attempt was allowed but robber should have been blocked!");
} catch (e) {
  if (e.message.includes("Anda sudah merampok target ini 10 kali")) {
    console.log("   ✅ SUCCESS: 11th attempt blocked correctly with error:", e.message);
  } else {
    console.log("   ❌ FAILED: Blocked but with wrong error message:", e.message);
  }
}

// Clean up
db.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM transactions WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM robbery_attempts WHERE guild_id = ?").run(guildId);
db.close();

console.log("\n==================================================");
console.log("🏁 TESTING COMPLETE");
console.log("==================================================");
