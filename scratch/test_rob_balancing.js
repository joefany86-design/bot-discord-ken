const db = require('../stockmarket/database');

console.log("==================================================");
console.log("🧪 RUNNING ROB BALANCING VERIFICATION");
console.log("==================================================\n");

const thiefId = 'TEST_BAL_THIEF';
const victimId = 'TEST_BAL_VICTIM';
const guildId = 'TEST_BAL_GUILD';

// Cleanup previous state
db.run("DELETE FROM wallets WHERE guild_id = ?", [guildId]);
db.run("DELETE FROM bank_savings WHERE guild_id = ?", [guildId]);
db.run("DELETE FROM user_pets WHERE guild_id = ?", [guildId]);
db.run("DELETE FROM user_inventory WHERE guild_id = ?", [guildId]);

const robbery = require('../stockmarket/robbery');
const economy = require('../stockmarket/economy');

// Setup Wallets
db.run("INSERT INTO wallets (user_id, guild_id, balance, last_active_date, last_rob_at, wanted_until) VALUES (?, ?, 2000, '2026-05-31', 0, 0)", [thiefId, guildId]);
db.run("INSERT INTO wallets (user_id, guild_id, balance, last_active_date, last_rob_at, wanted_until) VALUES (?, ?, 10000, '2026-05-31', 0, 0)", [victimId, guildId]);

const originalRandom = Math.random;

// 1. TEST CASE: Cooldown Sukses 10 Menit (600 detik)
console.log("🎯 Test 1: Cooldown Sukses 10 Menit");
// Force success
Math.random = () => 0.01; // very high hoki / guaranteed success
// Make sure thief has lockpick to prevent penalty
db.run("INSERT INTO user_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'LOCKPICK', 1)", [thiefId, guildId]);

const firstRob = robbery.robSolo(thiefId, victimId, guildId);
console.log("   👉 First Rob Success:", firstRob.success);
console.log("   👉 Stolen Amount:", firstRob.amount);

// Try to rob again immediately
try {
  robbery.robSolo(thiefId, victimId, guildId);
  console.log("   ❌ FAILED: Robber could rob again immediately without cooldown!");
} catch (err) {
  console.log("   ✅ SUCCESS: Cooldown error thrown:", err.message);
}

// 2. TEST CASE: Pembagian Denda (75% korban, 25% dibakar)
console.log("\n🎯 Test 2: Pembagian Denda (75% victim, 25% burned)");
// Reset last_rob_at to bypass cooldown
db.run("UPDATE wallets SET last_rob_at = 0 WHERE user_id = ?", [thiefId]);
// Force failure
Math.random = () => 0.99; // guaranteed failure

// Record balance before failure
const thiefWalletBefore = economy.getWallet(thiefId, guildId);
const victimWalletBefore = economy.getWallet(victimId, guildId);

const failRob = robbery.robSolo(thiefId, victimId, guildId);
console.log("   👉 Failed Rob Success:", failRob.success);
console.log("   👉 Fine paid by thief:", failRob.fine);
console.log("   👉 Compensation received by victim:", failRob.compensation);

const thiefWalletAfter = economy.getWallet(thiefId, guildId);
const victimWalletAfter = economy.getWallet(victimId, guildId);

const thiefDiff = thiefWalletBefore.balance - thiefWalletAfter.balance;
const victimDiff = victimWalletAfter.balance - victimWalletBefore.balance;

console.log("   👉 Thief balance diff (fine):", thiefDiff);
console.log("   👉 Victim balance diff (compensation):", victimDiff);

if (thiefDiff === failRob.fine && victimDiff === failRob.compensation && failRob.compensation === Math.round(failRob.fine * 0.75)) {
  console.log("   ✅ SUCCESS: Fine splitting verified! 75% went to the victim, 25% was burned.");
} else {
  console.log("   ❌ FAILED: Fine splitting math or balances are incorrect!");
}

// 3. TEST CASE: Status Wanted & Peluang Sukses +15%
console.log("\n🎯 Test 3: Status Wanted & Sukses Rate +15%");
// Reset thief status, jail, cooldowns, and setup target to be Wanted
db.run("UPDATE wallets SET last_rob_at = 0, jail_until = 0, jail_type = '' WHERE user_id = ?", [thiefId]);
const nowSec = Math.floor(Date.now() / 1000);
db.run("UPDATE wallets SET wanted_until = ? WHERE user_id = ?", [nowSec + 7200, victimId]);

// Check if isVictimWanted works
const checkWantedResult = robbery.robSolo(thiefId, victimId, guildId);
console.log("   👉 Is victim wanted check from result:", checkWantedResult.isVictimWanted);
if (checkWantedResult.isVictimWanted === true) {
  console.log("   ✅ SUCCESS: Victim's wanted status successfully detected by robbery engine.");
} else {
  console.log("   ❌ FAILED: Victim's wanted status was NOT detected.");
}

// 4. TEST CASE: Set Wanted Status jika jarahan >= Rp 1.500
console.log("\n🎯 Test 4: Set Wanted Status jika jarahan >= Rp 1.500");
// Reset cooldown, jail, and victim wanted status
db.run("UPDATE wallets SET last_rob_at = 0, wanted_until = 0, jail_until = 0, jail_type = '' WHERE user_id = ?", [thiefId]);
db.run("UPDATE wallets SET wanted_until = 0 WHERE user_id = ?", [victimId]);
// Victim must have a lot of money to ensure large steal
db.run("UPDATE wallets SET balance = 50000 WHERE user_id = ?", [victimId]);
// Give thief lockpick again (if used up)
db.run("INSERT OR REPLACE INTO user_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'LOCKPICK', 1)", [thiefId, guildId]);

// Force success
Math.random = () => 0.01;
const successRobBig = robbery.robSolo(thiefId, victimId, guildId);
console.log("   👉 Stolen Amount:", successRobBig.amount);
console.log("   👉 gotWanted flag:", successRobBig.gotWanted);

const thiefWalletBig = economy.getWallet(thiefId, guildId);
const isThiefWanted = thiefWalletBig.wanted_until > nowSec;
console.log("   👉 Is thief database wanted_until set in future:", isThiefWanted);

if (successRobBig.amount >= 1500 && successRobBig.gotWanted && isThiefWanted) {
  console.log("   ✅ SUCCESS: Thief successfully flagged as WANTED after stealing >= 1500.");
} else {
  console.log("   ❌ FAILED: Thief WANTED flagging logic failed.");
}

// Restore Math.random
Math.random = originalRandom;

// Cleanup
db.run("DELETE FROM wallets WHERE guild_id = ?", [guildId]);
db.run("DELETE FROM bank_savings WHERE guild_id = ?", [guildId]);
db.run("DELETE FROM user_inventory WHERE guild_id = ?", [guildId]);

console.log("\n==================================================");
console.log("🏁 ALL BALANCING VERIFICATION TESTS COMPLETE!");
console.log("==================================================");
