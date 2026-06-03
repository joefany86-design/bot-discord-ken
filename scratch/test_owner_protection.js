const db = require('../stockmarket/database');
const robbery = require('../stockmarket/robbery');
const economy = require('../stockmarket/economy');
const adminPanel = require('../stockmarket/adminPanel');

const guildId = '1410239829874053296'; // Mock Guild
const ownerId = '436554535037698059'; // Owner User
const robberId = '999999999999999999'; // Mock Robber User
const victimId = '888888888888888888'; // Other Mock Victim User (not in lobby)

console.log("🧪 STARTING OWNER PROTECTION TEST 🧪\n");

function setupTestData() {
  db.transaction(() => {
    // Clean up
    db.run("DELETE FROM wallets WHERE guild_id = ?", [guildId]);
    db.run("DELETE FROM bank_savings WHERE guild_id = ?", [guildId]);
    db.run("DELETE FROM ebyus_settings WHERE guild_id = ?", [guildId]);

    // Setup wallets
    db.run("INSERT INTO wallets (user_id, guild_id, balance) VALUES (?, ?, 5000)", [ownerId, guildId]);
    db.run("INSERT INTO wallets (user_id, guild_id, balance) VALUES (?, ?, 5000)", [robberId, guildId]);
    db.run("INSERT INTO wallets (user_id, guild_id, balance) VALUES (?, ?, 5000)", [victimId, guildId]);

    // Setup bank savings
    db.run("INSERT INTO bank_savings (user_id, guild_id, balance) VALUES (?, ?, 10000)", [ownerId, guildId]);
    db.run("INSERT INTO bank_savings (user_id, guild_id, balance) VALUES (?, ?, 10000)", [victimId, guildId]);
  })();
  console.log("✅ Test database set up successfully.");
}

async function runTests() {
  setupTestData();

  // Save original Math.random
  const originalRandom = Math.random;

  // Test Case 1: Owner Protection is OFF
  console.log("\n-------------------------------------------");
  console.log("📡 TEST CASE 1: OWNER PROTECTION IS OFF");
  console.log("-------------------------------------------");
  adminPanel.toggleOwnerProtection(guildId, false);
  console.log(`- Owner Protection Status: ${adminPanel.isOwnerProtectionActive(guildId) ? "ACTIVE 🛡️" : "INACTIVE 🔓"}`);

  // Test Solo Rob to Owner (Should NOT throw Owner Protection block error)
  console.log("\n⚔️ Testing solo robbery from robber to owner (should not be blocked by owner protection)...");
  try {
    // Reset robber cooldown and jail for testing
    db.run("UPDATE wallets SET last_rob_at = 0, jail_until = 0 WHERE user_id = ? AND guild_id = ?", [robberId, guildId]);
    const robRes = robbery.robSolo(robberId, ownerId, guildId);
    console.log(`  👉 Rob result: Success = ${robRes.success}, Amount = ${robRes.amount || 0}, Fine = ${robRes.fine || 0}`);
    console.log("  ✅ PASS: Robbery went through (was not blocked by owner protection error).");
  } catch (err) {
    if (err.message.includes("OWNER PROTECTION")) {
      console.error("  ❌ FAIL: Robbery was blocked by owner protection even though it was disabled!");
      process.exit(1);
    } else {
      console.log(`  👉 Got expected core block/outcome: "${err.message}" (not owner protection)`);
      console.log("  ✅ PASS: Robbery wasn't blocked by owner protection.");
    }
  }

  // Test Heist (Should drain Owner's bank savings)
  console.log("\n⚔️ Testing heist victims selection (owner should be included)...");
  db.run("UPDATE wallets SET last_heist_at = 0, jail_until = 0 WHERE user_id = ? AND guild_id = ?", [robberId, guildId]);
  db.run("UPDATE bank_savings SET balance = 10000 WHERE user_id = ? AND guild_id = ?", [ownerId, guildId]);
  db.run("UPDATE bank_savings SET balance = 10000 WHERE user_id = ? AND guild_id = ?", [victimId, guildId]);

  robbery.startHeistLobby(robberId, guildId);
  
  const ownerPreBank = db.get("SELECT balance FROM bank_savings WHERE user_id = ? AND guild_id = ?", [ownerId, guildId]).balance;
  const victimPreBank = db.get("SELECT balance FROM bank_savings WHERE user_id = ? AND guild_id = ?", [victimId, guildId]).balance;
  console.log(`  👉 Owner Bank Savings (Pre Heist): Rp ${ownerPreBank}`);
  console.log(`  👉 Victim Bank Savings (Pre Heist): Rp ${victimPreBank}`);

  // Force heist success by mocking Math.random to return 0.0
  Math.random = () => 0.0;
  
  const heistRes = robbery.executeHeist(guildId);
  console.log(`  👉 Heist success: ${heistRes.success}`);

  // Restore Math.random
  Math.random = originalRandom;

  const ownerPostBank = db.get("SELECT balance FROM bank_savings WHERE user_id = ? AND guild_id = ?", [ownerId, guildId]).balance;
  const victimPostBank = db.get("SELECT balance FROM bank_savings WHERE user_id = ? AND guild_id = ?", [victimId, guildId]).balance;
  console.log(`  👉 Owner Bank Savings (Post Heist): Rp ${ownerPostBank}`);
  console.log(`  👉 Victim Bank Savings (Post Heist): Rp ${victimPostBank}`);

  if (ownerPostBank < ownerPreBank) {
    console.log("  ✅ PASS: Owner bank savings were drained as expected.");
  } else {
    console.error("  ❌ FAIL: Owner bank savings did not change but protection is OFF!");
    process.exit(1);
  }


  // Test Case 2: Owner Protection is ON
  console.log("\n-------------------------------------------");
  console.log("📡 TEST CASE 2: OWNER PROTECTION IS ON");
  console.log("-------------------------------------------");
  adminPanel.toggleOwnerProtection(guildId, true);
  console.log(`- Owner Protection Status: ${adminPanel.isOwnerProtectionActive(guildId) ? "ACTIVE 🛡️" : "INACTIVE 🔓"}`);

  // Test Solo Rob to Owner (Should trigger Sultan's Punishment)
  console.log("\n⚔️ Testing solo robbery from robber to owner (should trigger Sultan's Punishment)...");
  try {
    // Reset robber cooldown and jail for testing
    db.run("UPDATE wallets SET last_rob_at = 0, jail_until = 0, balance = 5000 WHERE user_id = ? AND guild_id = ?", [robberId, guildId]);
    db.run("UPDATE wallets SET balance = 5000 WHERE user_id = ? AND guild_id = ?", [ownerId, guildId]);
    
    const robRes = robbery.robSolo(robberId, ownerId, guildId);
    
    console.log(`  👉 Rob result: success = ${robRes.success}, isSultanPunishment = ${robRes.isSultanPunishment}, fine = ${robRes.fine}, jail = ${robRes.jailDurationMinutes} mins`);
    
    const updatedRobberWallet = db.get("SELECT balance, jail_until FROM wallets WHERE user_id = ? AND guild_id = ?", [robberId, guildId]);
    console.log(`  👉 Robber Wallet Balance: Rp ${updatedRobberWallet.balance}`);
    console.log(`  👉 Robber Jail Until: ${updatedRobberWallet.jail_until}`);
    
    if (robRes.success === false && robRes.isSultanPunishment === true) {
      if (updatedRobberWallet.balance === 3000 && updatedRobberWallet.jail_until > 0) {
        console.log("  ✅ PASS: Robber was successfully punished for attempting to rob the protected Owner!");
      } else {
        console.error(`  ❌ FAIL: Punishment values are incorrect. Balance: ${updatedRobberWallet.balance}, Jail: ${updatedRobberWallet.jail_until}`);
        process.exit(1);
      }
    } else {
      console.error(`  ❌ FAIL: Response parameters are incorrect. success: ${robRes.success}, isSultanPunishment: ${robRes.isSultanPunishment}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`  ❌ FAIL: Robbery crashed with error: "${err.message}"`);
    process.exit(1);
  }

  // Test Heist (Should skip Owner's bank savings)
  console.log("\n⚔️ Testing heist bank hack/drain (owner should be immune)...");
  // Set Owner and Victim bank savings balance back to 10000
  db.run("UPDATE bank_savings SET balance = 10000 WHERE user_id = ? AND guild_id = ?", [ownerId, guildId]);
  db.run("UPDATE bank_savings SET balance = 10000 WHERE user_id = ? AND guild_id = ?", [victimId, guildId]);
  db.run("UPDATE wallets SET last_heist_at = 0, jail_until = 0 WHERE user_id = ? AND guild_id = ?", [robberId, guildId]);

  robbery.startHeistLobby(robberId, guildId);

  const ownerPreHeistBank = db.get("SELECT balance FROM bank_savings WHERE user_id = ? AND guild_id = ?", [ownerId, guildId]).balance;
  const victimPreHeistBank = db.get("SELECT balance FROM bank_savings WHERE user_id = ? AND guild_id = ?", [victimId, guildId]).balance;

  console.log(`  👉 Owner Bank Balance before heist: Rp ${ownerPreHeistBank}`);
  console.log(`  👉 Victim Bank Balance before heist: Rp ${victimPreHeistBank}`);

  // Force heist success
  Math.random = () => 0.0;
  const heistRes2 = robbery.executeHeist(guildId);
  console.log(`  👉 Heist success: ${heistRes2.success}`);
  
  // Restore Math.random
  Math.random = originalRandom;

  const ownerPostHeistBank = db.get("SELECT balance FROM bank_savings WHERE user_id = ? AND guild_id = ?", [ownerId, guildId]).balance;
  const victimPostHeistBank = db.get("SELECT balance FROM bank_savings WHERE user_id = ? AND guild_id = ?", [victimId, guildId]).balance;

  console.log(`  👉 Owner Bank Balance after heist: Rp ${ownerPostHeistBank}`);
  console.log(`  👉 Victim Bank Balance after heist: Rp ${victimPostHeistBank}`);

  if (ownerPostHeistBank === ownerPreHeistBank) {
    console.log("  ✅ PASS: Owner bank savings remained untouched (immune to heist drain)!");
  } else {
    console.error("  ❌ FAIL: Owner bank savings were drained during heist!");
    process.exit(1);
  }

  if (victimPostHeistBank < victimPreHeistBank) {
    console.log("  ✅ PASS: Victim bank savings were successfully drained.");
  } else {
    console.error("  ❌ FAIL: Victim bank savings did not change!");
    process.exit(1);
  }

  // Cleanup Settings
  adminPanel.toggleOwnerProtection(guildId, false);
  console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉\n");
}

runTests().catch(err => {
  console.error("❌ Test crashed with error:", err);
  process.exit(1);
});
