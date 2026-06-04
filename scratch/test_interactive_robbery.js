const db = require('../stockmarket/database');
const robbery = require('../stockmarket/robbery');
const economy = require('../stockmarket/economy');
const bm = require('../stockmarket/blackmarket');

console.log("==================================================");
console.log("🧪 RUNNING INTERACTIVE ROBBERY & ARREST VERIFICATION");
console.log("==================================================\n");

const thiefId = 'TEST_ROB_THIEF';
const victimId = 'TEST_ROB_VICTIM';
const hunterId = 'TEST_ROB_HUNTER';
const guildId = 'TEST_ROB_GUILD';

// Cleanup previous state
const cleanup = () => {
  db.run("DELETE FROM wallets WHERE guild_id = ?", [guildId]);
  db.run("DELETE FROM user_pets WHERE guild_id = ?", [guildId]);
  db.run("DELETE FROM user_inventory WHERE guild_id = ?", [guildId]);
};

cleanup();

// Setup Wallets
db.run("INSERT INTO wallets (user_id, guild_id, balance, last_active_date, last_rob_at, wanted_until, wanted_bounty) VALUES (?, ?, 5000, '2026-06-05', 0, 0, 0)", [thiefId, guildId]);
db.run("INSERT INTO wallets (user_id, guild_id, balance, last_active_date, last_rob_at, wanted_until, wanted_bounty) VALUES (?, ?, 20000, '2026-06-05', 0, 0, 0)", [victimId, guildId]);
db.run("INSERT INTO wallets (user_id, guild_id, balance, last_active_date, last_rob_at, wanted_until, wanted_bounty) VALUES (?, ?, 2000, '2026-06-05', 0, 0, 0)", [hunterId, guildId]);

const originalRandom = Math.random;

// 1. TEST CASE: Success rob >= Rp 1.500 sets wanted_bounty to 50%
console.log("🎯 Test 1: Sukses Rob >= Rp 1.500 mengatur wanted_bounty");
Math.random = () => 0.01; // Force success
db.run("INSERT INTO user_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'LOCKPICK', 1)", [thiefId, guildId]);

const resSuccess = robbery.robSolo(thiefId, victimId, guildId);
console.log("   👉 Rob Success:", resSuccess.success);
console.log("   👉 Stolen Amount:", resSuccess.amount);
console.log("   👉 gotWanted flag:", resSuccess.gotWanted);

const thiefWallet = economy.getWallet(thiefId, guildId);
console.log("   👉 Thief wanted_bounty in DB:", thiefWallet.wanted_bounty);
const expectedBounty = Math.floor(resSuccess.amount * 0.5);

if (thiefWallet.wanted_bounty === expectedBounty && thiefWallet.wanted_bounty > 0) {
  console.log("   ✅ SUCCESS: wanted_bounty matches 50% of stolen amount!");
} else {
  console.log("   ❌ FAILED: wanted_bounty mismatch or zero!");
}

// 2. TEST CASE: Failed rob is a dry-run (no DB edits)
console.log("\n🎯 Test 2: Gagal Rob merupakan dry-run (tidak ada edit DB)");
// Reset last_rob_at and remove wanted status on thief
db.run("UPDATE wallets SET last_rob_at = 0, wanted_until = 0, wanted_bounty = 0 WHERE user_id = ?", [thiefId]);
Math.random = () => 0.99; // Force failure

const thiefWalletBefore = economy.getWallet(thiefId, guildId);
const resFail = robbery.robSolo(thiefId, victimId, guildId);
const thiefWalletAfter = economy.getWallet(thiefId, guildId);

console.log("   👉 Fail Rob Success:", resFail.success);
console.log("   👉 Estimated Fine:", resFail.fine);
console.log("   👉 Jail Duration Seconds:", resFail.jailDurationSeconds);
console.log("   👉 Thief balance before fail:", thiefWalletBefore.balance);
console.log("   👉 Thief balance after fail:", thiefWalletAfter.balance);
console.log("   👉 Thief jail_until after fail:", thiefWalletAfter.jail_until);

if (thiefWalletBefore.balance === thiefWalletAfter.balance && (thiefWalletAfter.jail_until || 0) === 0) {
  console.log("   ✅ SUCCESS: Failed robbery returned stats without writing to DB!");
} else {
  console.log("   ❌ FAILED: Database was modified on failed robbery!");
}

// 3. TEST CASE: Arrest Buronan (Sukses & Gagal)
console.log("\n🎯 Test 3: Arrest Buronan");

// Manually set thief wanted status & bounty for testing arrest
const nowSec = Math.floor(Date.now() / 1000);
db.run("UPDATE wallets SET wanted_until = ?, wanted_bounty = 1000 WHERE user_id = ?", [nowSec + 7200, thiefId]);

// 3a. Self arrest check
try {
  robbery.arrestBuronan(thiefId, thiefId, guildId);
  console.log("   ❌ FAILED: Self arrest did not throw error!");
} catch (err) {
  console.log("   ✅ SUCCESS: Self arrest error caught:", err.message);
}

// 3b. Arrest target who is not wanted
try {
  robbery.arrestBuronan(hunterId, victimId, guildId);
  console.log("   ❌ FAILED: Arresting non-wanted target did not throw error!");
} catch (err) {
  console.log("   ✅ SUCCESS: Arresting non-wanted error caught:", err.message);
}

// 3c. Success arrest (with handcuffs)
console.log("   👉 3c: Menangkap Sukses (dengan Borgol)");
db.run("INSERT INTO user_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'HANDCUFFS', 1)", [hunterId, guildId]);
Math.random = () => 0.01; // Force arrest success (rate 65% with handcuffs)

const hunterWalletBefore = economy.getWallet(hunterId, guildId);
const arrestResSuccess = robbery.arrestBuronan(hunterId, thiefId, guildId);
const hunterWalletAfter = economy.getWallet(hunterId, guildId);
const targetWalletAfter = economy.getWallet(thiefId, guildId);

console.log("   👉 Arrest Success:", arrestResSuccess.success);
console.log("   👉 Bounty claimed:", arrestResSuccess.bounty);
console.log("   👉 Hunter balance diff:", hunterWalletAfter.balance - hunterWalletBefore.balance);
console.log("   👉 Target wanted_until after arrest:", targetWalletAfter.wanted_until);
console.log("   👉 Target wanted_bounty after arrest:", targetWalletAfter.wanted_bounty);
console.log("   👉 Target jail_until after arrest in future:", targetWalletAfter.jail_until > nowSec);

if (arrestResSuccess.success &&
    hunterWalletAfter.balance - hunterWalletBefore.balance === 1000 &&
    targetWalletAfter.wanted_bounty === 0 &&
    targetWalletAfter.jail_until > nowSec) {
  console.log("   ✅ SUCCESS: Arrest success flow works perfectly!");
} else {
  console.log("   ❌ FAILED: Arrest success logic issues!");
}

// 3d. Fail arrest (without active pet -> fine hunter Rp 200)
console.log("   👉 3d: Menangkap Gagal (tanpa pet aktif)");
// Reset target wanted and bounty
db.run("UPDATE wallets SET wanted_until = ?, wanted_bounty = 1000, jail_until = 0 WHERE user_id = ?", [nowSec + 7200, thiefId]);
// Remove handcuffs to verify normal failure flow
db.run("DELETE FROM user_inventory WHERE user_id = ? AND item_id = 'HANDCUFFS'", [hunterId]);
Math.random = () => 0.99; // Force failure

const hunterWBefore = economy.getWallet(hunterId, guildId);
const thiefWBefore = economy.getWallet(thiefId, guildId);
const arrestResFailNoPet = robbery.arrestBuronan(hunterId, thiefId, guildId);
const hunterWAfter = economy.getWallet(hunterId, guildId);
const thiefWAfter = economy.getWallet(thiefId, guildId);

console.log("   👉 Arrest Success:", arrestResFailNoPet.success);
console.log("   👉 Fined Target flag:", arrestResFailNoPet.finedTarget);
console.log("   👉 Fine Amount paid by hunter:", arrestResFailNoPet.fineAmount);
console.log("   👉 Hunter balance diff:", hunterWBefore.balance - hunterWAfter.balance);
console.log("   👉 Target balance diff:", thiefWAfter.balance - thiefWBefore.balance);

if (!arrestResFailNoPet.success &&
    arrestResFailNoPet.finedTarget &&
    arrestResFailNoPet.fineAmount === 200 &&
    hunterWBefore.balance - hunterWAfter.balance === 200 &&
    thiefWAfter.balance - thiefWBefore.balance === 200) {
  console.log("   ✅ SUCCESS: Arrest failure without pet correctly fined hunter Rp 200 and paid target!");
} else {
  console.log("   ❌ FAILED: Arrest failure without pet logic issues!");
}

// 3e. Fail arrest (with active pet -> damage pet HP -20)
console.log("   👉 3e: Menangkap Gagal (dengan pet aktif)");
// Reset target wanted/bounty and target balances
db.run("UPDATE wallets SET wanted_until = ?, wanted_bounty = 1000, jail_until = 0 WHERE user_id = ?", [nowSec + 7200, thiefId]);
// Create active pet for hunter
const petName = 'TEST_HUNTER_DOG';
db.run("INSERT INTO user_pets (user_id, guild_id, pet_name, pet_type, is_active, health, status) VALUES (?, ?, ?, 'DOG', 1, 100, 'HAPPY')", [hunterId, guildId, petName]);

const hunterWBeforePet = economy.getWallet(hunterId, guildId);
const arrestResFailWithPet = robbery.arrestBuronan(hunterId, thiefId, guildId);
const hunterWAfterPet = economy.getWallet(hunterId, guildId);

const petRow = db.get("SELECT health, status FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1", [hunterId, guildId]);

console.log("   👉 Arrest Success:", arrestResFailWithPet.success);
console.log("   👉 Pet Damaged flag:", arrestResFailWithPet.petDamaged);
console.log("   👉 Damaged Pet Name:", arrestResFailWithPet.petName);
console.log("   👉 Damaged Pet HP Left:", arrestResFailWithPet.petHpLeft);
console.log("   👉 Pet HP in DB:", petRow.health);
console.log("   👉 Hunter balance diff (should be 0):", hunterWBeforePet.balance - hunterWAfterPet.balance);

if (!arrestResFailWithPet.success &&
    arrestResFailWithPet.petDamaged &&
    arrestResFailWithPet.petHpLeft === 80 &&
    petRow.health === 80 &&
    hunterWBeforePet.balance === hunterWAfterPet.balance) {
  console.log("   ✅ SUCCESS: Arrest failure with pet correctly deducted pet HP and did not fine hunter!");
} else {
  console.log("   ❌ FAILED: Arrest failure with pet logic issues!");
}

Math.random = originalRandom;
cleanup();

console.log("\n==================================================");
console.log("🏁 ALL INTERACTIVE ROBBERY TESTS COMPLETE!");
console.log("==================================================");
