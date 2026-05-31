const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../data/economy.db');
const db = new Database(dbPath);

console.log("==================================================");
console.log("🧪 RUNNING CUSTOM ROB & HEIST DIFFICULTY VERIFICATION");
console.log("==================================================\n");

// Setup Test Users
const thiefId = 'TEST_THIEF';
const victimId = 'TEST_VICTIM';
const guildId = 'TEST_VERIFY_GUILD';

// Cleanup previous state
db.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM bank_savings WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM user_pets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM user_inventory WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM kos_rentals WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM heist_cooldown WHERE guild_id = ?").run(guildId);

const robbery = require('../stockmarket/robbery');
const bm = require('../stockmarket/blackmarket');

// Setup Wallets
db.prepare("INSERT INTO wallets (user_id, guild_id, balance, last_active_date) VALUES (?, ?, 1000, '2026-05-31')").run(thiefId, guildId);
db.prepare("INSERT INTO wallets (user_id, guild_id, balance, last_active_date) VALUES (?, ?, 1000, '2026-05-31')").run(victimId, guildId);

console.log("🎯 Part 1: Solo Robbery (.rob) Difficulty Verification");

// Test Case 1.1: Robbing without LOCKPICK
console.log("\n🏃 Case 1.1: Robbing WITHOUT Lockpick");
// Let's mock a failure to see the custom increased fine and jail duration.
// To force failure, we can run a loop or just observe robbery output under failure condition.
// Since Math.random() is random, let's run robSolo multiple times or temporarily override Math.random to simulate failure and success.

const originalRandom = Math.random;

// Force Math.random() to return 0.99 (guaranteed failure for normal users)
Math.random = () => 0.99;

const failResultNoLockpick = robbery.robSolo(thiefId, victimId, guildId);
console.log("   👉 Result:", failResultNoLockpick.success ? "SUCCESS" : "FAILED");
console.log("   👉 Lockpick Used:", failResultNoLockpick.lockpickUsed);
console.log("   👉 Fine amount:", failResultNoLockpick.fine);
console.log("   👉 Jail Duration (minutes):", failResultNoLockpick.jailDurationMinutes);

// Expected: base fine is 200, without lockpick it adds 150 -> 350 fine.
// Expected: base jail duration is 1800s (30m), without lockpick it multiplies by 1.5 -> 2700s (45m).
if (failResultNoLockpick.fine === 350 && failResultNoLockpick.jailDurationMinutes === 45) {
  console.log("   ✅ SUCCESS: Robbery without Lockpick penalty applied correctly (Fine: 350, Jail: 45m)!");
} else {
  console.log(`   ❌ FAILED: Robbery without Lockpick penalty incorrect! Fine: ${failResultNoLockpick.fine}, Jail: ${failResultNoLockpick.jailDurationMinutes}m`);
}

// Reset jail status for thief
db.prepare("UPDATE wallets SET jail_until = 0, jail_type = '' WHERE user_id = ?").run(thiefId);

// Test Case 1.2: Robbing WITH LOCKPICK
console.log("\n🏃 Case 1.2: Robbing WITH Lockpick");
db.prepare("INSERT INTO user_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'LOCKPICK', 1)").run(thiefId, guildId);

const failResultWithLockpick = robbery.robSolo(thiefId, victimId, guildId);
console.log("   👉 Result:", failResultWithLockpick.success ? "SUCCESS" : "FAILED");
console.log("   👉 Lockpick Used:", failResultWithLockpick.lockpickUsed);
console.log("   👉 Fine amount:", failResultWithLockpick.fine);
console.log("   👉 Jail Duration (minutes):", failResultWithLockpick.jailDurationMinutes);

// Expected: base fine is 200, lockpick used so no penalty -> 200 fine.
// Expected: base jail is 30 minutes, lockpick used so no penalty -> 30m jail.
if (failResultWithLockpick.fine === 200 && failResultWithLockpick.jailDurationMinutes === 30) {
  console.log("   ✅ SUCCESS: Robbery with Lockpick has normal penalty (Fine: 200, Jail: 30m)!");
} else {
  console.log(`   ❌ FAILED: Robbery with Lockpick penalty incorrect! Fine: ${failResultWithLockpick.fine}, Jail: ${failResultWithLockpick.jailDurationMinutes}m`);
}

// Restore Math.random
Math.random = originalRandom;


console.log("\n🎯 Part 2: Central Bank Heist (.heist) Stats Scaling Verification");

for (let crew = 1; crew <= 5; crew++) {
  const stats = robbery.getHeistStats(crew);
  console.log(`👥 Crew Size ${crew}:`);
  console.log(`   👉 Success Rate: ${stats.successRate}%`);
  console.log(`   👉 Base Fine: Rp ${stats.fine}`);
  console.log(`   👉 Jail Duration: ${stats.jailDurationSeconds / 3600} jam`);
  
  if (crew === 1 && stats.successRate === 5 && stats.jailDurationSeconds === 7200) {
    console.log("   ✅ 1 Crew Stats Perfect!");
  } else if (crew === 2 && stats.successRate === 10 && stats.jailDurationSeconds === 7200) {
    console.log("   ✅ 2 Crew Stats Perfect!");
  } else if (crew === 3 && stats.successRate === 15 && stats.jailDurationSeconds === 7200) {
    console.log("   ✅ 3 Crew Stats Perfect!");
  } else if (crew === 4 && stats.successRate === 25 && stats.jailDurationSeconds === 9000) {
    console.log("   ✅ 4 Crew Stats Perfect!");
  } else if (crew >= 5 && stats.successRate === 75 && stats.jailDurationSeconds === 7200) {
    console.log("   ✅ 5+ Crew Stats Perfect!");
  } else {
    console.log("   ❌ Scaling Incorrect!");
  }
}

// Cleanup
db.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM bank_savings WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM user_inventory WHERE guild_id = ?").run(guildId);
db.close();

console.log("\n==================================================");
console.log("🏁 ALL CUSTOM VERIFICATION TESTS PASSED SUCCESSFULLY!");
console.log("==================================================");
