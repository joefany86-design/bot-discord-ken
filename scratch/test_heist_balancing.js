const db = require('../stockmarket/database');

console.log("==================================================");
console.log("🧪 RUNNING HEIST BALANCING & BRANKAS VERIFICATION");
console.log("==================================================\n");

const initiatorId = 'TEST_H_INIT';
const participantId = 'TEST_H_PART';
const victimRichId = 'TEST_H_RICH';
const victimBrankasId = 'TEST_H_SAFE';
const guildId = 'TEST_HEIST_GUILD';

// Cleanup previous state
db.run("DELETE FROM wallets WHERE guild_id = ?", [guildId]);
db.run("DELETE FROM bank_savings WHERE guild_id = ?", [guildId]);
db.run("DELETE FROM user_inventory WHERE guild_id = ?", [guildId]);

const robbery = require('../stockmarket/robbery');
const economy = require('../stockmarket/economy');
const bm = require('../stockmarket/blackmarket');

// Setup Wallets (for checkJail/bail & prep fees)
db.run("INSERT INTO wallets (user_id, guild_id, balance, last_active_date) VALUES (?, ?, 20000, '2026-05-31')", [initiatorId, guildId]);
db.run("INSERT INTO wallets (user_id, guild_id, balance, last_active_date) VALUES (?, ?, 20000, '2026-05-31')", [participantId, guildId]);
db.run("INSERT INTO wallets (user_id, guild_id, balance, last_active_date) VALUES (?, ?, 20000, '2026-05-31')", [victimRichId, guildId]);
db.run("INSERT INTO wallets (user_id, guild_id, balance, last_active_date) VALUES (?, ?, 20000, '2026-05-31')", [victimBrankasId, guildId]);

// Setup bank savings
// 1. Rich victim has Rp 100,000. Without cap, 5-15% would be Rp 5,000 - Rp 15,000. With cap, it should be capped at exactly Rp 5,000.
db.run("INSERT INTO bank_savings (user_id, guild_id, balance) VALUES (?, ?, 100000)", [victimRichId, guildId]);
// 2. Safe victim has Rp 100,000 AND owns BRANKAS. Their loss should be capped at 5,000, then reduced by 90% (to Rp 500).
db.run("INSERT INTO bank_savings (user_id, guild_id, balance) VALUES (?, ?, 100000)", [victimBrankasId, guildId]);
db.run("INSERT INTO user_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'BRANKAS', 1)", [victimBrankasId, guildId]);

const originalRandom = Math.random;

// 1. TEST CASE: getHeistStats and Increased Fines
console.log("🎯 Test 1: Increased Heist Fines");
const stats1 = robbery.getHeistStats(1);
const stats3 = robbery.getHeistStats(3);
const stats5 = robbery.getHeistStats(5);
console.log("   👉 Kru 1 Fine:", stats1.fine);
console.log("   👉 Kru 3 Fine:", stats3.fine);
console.log("   👉 Kru 5+ Fine:", stats5.fine);

if (stats1.fine === 1000 && stats3.fine === 2000 && stats5.fine === 3500) {
  console.log("   ✅ SUCCESS: Fines increased correctly!");
} else {
  console.log("   ❌ FAILED: Fines did not match expectations.");
}

// 2. TEST CASE: executeHeist Drainage Cap and Brankas Protection
console.log("\n🎯 Test 2: Heist Drainage Cap and Brankas Protection");
// Force success
Math.random = () => 0.01;

// Start and join heist lobby
robbery.startHeistLobby(initiatorId, guildId);
robbery.joinHeistLobby(participantId, guildId);

const heistResult = robbery.executeHeist(guildId);
console.log("   👉 Heist Result Success:", heistResult.success);

// Check victims' final balances
const richSavings = db.get("SELECT balance FROM bank_savings WHERE user_id = ? AND guild_id = ?", [victimRichId, guildId]);
const safeSavings = db.get("SELECT balance FROM bank_savings WHERE user_id = ? AND guild_id = ?", [victimBrankasId, guildId]);

const richLost = 100000 - richSavings.balance;
const safeLost = 100000 - safeSavings.balance;

console.log("   👉 Rich victim lost:", richLost);
console.log("   👉 Safe victim (with Brankas) lost:", safeLost);

if (richLost === 5000) {
  console.log("   ✅ SUCCESS: Rich victim's loss capped at exactly Rp 5.000!");
} else {
  console.log(`   ❌ FAILED: Rich victim lost ${richLost} (expected capped at 5000)`);
}

if (safeLost === 500) {
  console.log("   ✅ SUCCESS: Brankas holder's loss reduced by 90% to Rp 500!");
} else {
  console.log(`   ❌ FAILED: Brankas holder lost ${safeLost} (expected 500)`);
}

// 3. TEST CASE: Failed Heist Fine & Increased Bail early release
console.log("\n🎯 Test 3: Failed Heist Fine & Bail Amount");
// Clear cooldown for test guild heist
db.run("DELETE FROM heist_cooldown WHERE guild_id = ?", [guildId]);
// Force failure
Math.random = () => 0.99;

// Start lobby
robbery.startHeistLobby(initiatorId, guildId);
const failResult = robbery.executeHeist(guildId);

console.log("   👉 Heist Success:", failResult.success);
console.log("   👉 Failure Fine:", failResult.fineAmount);

// Check if initiator is jailed and check their bail amount
const initiatorJail = robbery.checkJail(initiatorId, guildId);
console.log("   👉 Initiator Jailed:", initiatorJail.jailed);
console.log("   👉 Initiator Jail Type:", getJailType(initiatorId, guildId));
console.log("   👉 Initiator Bail Amount:", initiatorJail.bailAmount);

if (initiatorJail.jailed && initiatorJail.bailAmount === 2500) {
  console.log("   ✅ SUCCESS: Bail amount for Heist is correctly set to Rp 2.500!");
} else {
  console.log(`   ❌ FAILED: Jail status: ${initiatorJail.jailed}, Bail amount: ${initiatorJail.bailAmount} (expected 2500)`);
}

// Restore Math.random
Math.random = originalRandom;

// Cleanup
db.run("DELETE FROM wallets WHERE guild_id = ?", [guildId]);
db.run("DELETE FROM bank_savings WHERE guild_id = ?", [guildId]);
db.run("DELETE FROM user_inventory WHERE guild_id = ?", [guildId]);

console.log("\n==================================================");
console.log("🏁 ALL HEIST BALANCING VERIFICATION COMPLETE!");
console.log("==================================================");

// Helper for jail type in test script
function getJailType(userId, guildId) {
  const wallet = db.get('SELECT jail_type FROM wallets WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  return wallet ? wallet.jail_type : '';
}
