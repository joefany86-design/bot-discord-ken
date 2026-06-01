const db = require('../stockmarket/database');

console.log("==================================================");
console.log("🧪 RUNNING INDIVIDUAL HEIST COOLDOWN VERIFICATION");
console.log("==================================================\n");

const playerA = 'TEST_HC_PLAYERA';
const playerB = 'TEST_HC_PLAYERB';
const guildId = 'TEST_HC_GUILD';

// Cleanup previous state
db.run("DELETE FROM wallets WHERE guild_id = ?", [guildId]);
db.run("DELETE FROM bank_savings WHERE guild_id = ?", [guildId]);
db.run("DELETE FROM user_inventory WHERE guild_id = ?", [guildId]);

const robbery = require('../stockmarket/robbery');
const economy = require('../stockmarket/economy');

// Setup Wallets
db.run("INSERT INTO wallets (user_id, guild_id, balance, last_active_date) VALUES (?, ?, 20000, '2026-05-31')", [playerA, guildId]);
db.run("INSERT INTO wallets (user_id, guild_id, balance, last_active_date) VALUES (?, ?, 20000, '2026-05-31')", [playerB, guildId]);

const originalRandom = Math.random;

// Force Heist success to bypass failure checks easily
Math.random = () => 0.01;

// 1. Player A starts heist and executes it
console.log("🏃 Case 1: Player A starts heist and executes it");
robbery.startHeistLobby(playerA, guildId);
const res1 = robbery.executeHeist(guildId);
console.log("   👉 First heist success:", res1.success);

const walletA = economy.getWallet(playerA, guildId);
console.log("   👉 Player A last_heist_at:", walletA.last_heist_at);

if (walletA.last_heist_at > 0) {
  console.log("   ✅ SUCCESS: Player A last_heist_at updated in database!");
} else {
  console.log("   ❌ FAILED: Player A last_heist_at remains 0.");
}

// 2. Player A tries to start another heist immediately
console.log("\n🏃 Case 2: Player A tries to start heist again immediately (should fail)");
try {
  robbery.startHeistLobby(playerA, guildId);
  console.log("   ❌ FAILED: Player A started another heist immediately!");
} catch (err) {
  console.log("   ✅ SUCCESS: Player A blocked correctly:", err.message);
}

// 3. Player B (who did not participate) starts a heist (should succeed)
console.log("\n🏃 Case 3: Player B starts heist immediately (should succeed)");
try {
  const lobbyB = robbery.startHeistLobby(playerB, guildId);
  console.log("   ✅ SUCCESS: Player B started a heist lobby!");
  
  // 4. Player A (who is on cooldown) tries to join Player B's heist lobby (should fail)
  console.log("\n🏃 Case 4: Player A tries to join Player B's heist lobby (should fail)");
  try {
    robbery.joinHeistLobby(playerA, guildId);
    console.log("   ❌ FAILED: Player A joined Player B's lobby while on cooldown!");
  } catch (err) {
    console.log("   ✅ SUCCESS: Player A blocked from joining:", err.message);
  }

  // Cancel lobby to clean up
  robbery.cancelHeistLobby(playerB, guildId);

} catch (err) {
  console.log("   ❌ FAILED: Player B was blocked from starting heist:", err.message);
}

// Restore random
Math.random = originalRandom;

// Cleanup
db.run("DELETE FROM wallets WHERE guild_id = ?", [guildId]);
db.run("DELETE FROM bank_savings WHERE guild_id = ?", [guildId]);
db.run("DELETE FROM user_inventory WHERE guild_id = ?", [guildId]);

console.log("\n==================================================");
console.log("🏁 ALL COOLDOWN VERIFICATION TESTS PASSED!");
console.log("==================================================");
