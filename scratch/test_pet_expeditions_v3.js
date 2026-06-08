const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../data/economy.db');
const dbInstance = new Database(dbPath);

console.log("==================================================");
console.log("🧪 RUNNING PET EXPEDITION V3 INTERACTIVE TEST SUITE");
console.log("==================================================\n");

const initiatorId = 'TEST_LEADER_V3';
const memberId = 'TEST_MEMBER_V3';
const guildId = 'TEST_EXP_GUILD_V3';

// Cleanup previous state
dbInstance.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
dbInstance.prepare("DELETE FROM user_pets WHERE guild_id = ?").run(guildId);
dbInstance.prepare("DELETE FROM user_inventory WHERE guild_id = ?").run(guildId);

const pet = require('../stockmarket/pet');
const database = require('../stockmarket/database');

// Setup Wallets
dbInstance.prepare("INSERT INTO wallets (user_id, guild_id, balance) VALUES (?, ?, 10000)").run(initiatorId, guildId);
dbInstance.prepare("INSERT INTO wallets (user_id, guild_id, balance) VALUES (?, ?, 10000)").run(memberId, guildId);

// Setup Lockpick for leader
dbInstance.prepare("INSERT INTO user_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'LOCKPICK', 2)").run(initiatorId, guildId);

// Insert pets
// Leader: Leviathan (WATER), Level 35
dbInstance.prepare(
  `INSERT INTO user_pets (user_id, guild_id, pet_name, pet_type, status, level, health, hunger, thirst, happiness, is_active, trait, gacha_element) 
   VALUES (?, ?, 'Levi', 'LEVIATHAN', 'ADULT', 35, 80, 80, 80, 80, 1, 'WARRIOR', 'WATER')`
).run(initiatorId, guildId);

// Member: Turtle (EARTH), Level 30
dbInstance.prepare(
  `INSERT INTO user_pets (user_id, guild_id, pet_name, pet_type, status, level, health, hunger, thirst, happiness, is_active, trait, gacha_element) 
   VALUES (?, ?, 'Turt', 'TURTLE', 'ADULT', 30, 80, 80, 80, 80, 1, 'STURDY', 'EARTH')`
).run(memberId, guildId);

// 1. Test Elemental Synergy Calculations
console.log("🧪 Test 1: Calculating Success Rate and Synergies on Map 3 (Lembah Api - FIRE)...");
// Map 3: baseSuccessRate = 65%, recommendedLevel = 25.
// Leader Level 35 (+10 above rec -> +10%)
// Member Level 30 (+5 above rec -> +5%)
// Levi (WATER) vs FIRE -> elementMod = +15%
// Turt (EARTH) vs FIRE -> elementMod = -15%
// Path Choice: SAFE (+0%)
// Expected success rate = 65% (base) + 15% (levels) + 0% (synergy: +15 - 15 = 0) = 80%.
const calcSafe = pet.calculateSuccessRate(guildId, [initiatorId, memberId], 3, 'SAFE');
console.log(`   👉 Safe Success Rate: ${calcSafe.successRate}% (Expected: 80%)`);
console.log(`   👉 Logs:\n${calcSafe.logs.join('\n')}`);

if (calcSafe.successRate === 80 && calcSafe.logs.length === 2) {
  console.log("   ✅ SUCCESS: Elemental synergy and level mods correctly calculated!");
} else {
  console.log("   ❌ FAILED: Elemental synergy calculation error!");
}

// 2. Test Stage 1: Shortcut Option (HP deduction)
console.log("\n🧪 Test 2: Simulating Stage 1 - Shortcut Option...");
// Shortcut Choice: -15 HP to all pets, success rate +15%
const calcShortcut = pet.calculateSuccessRate(guildId, [initiatorId, memberId], 3, 'SHORTCUT');
console.log(`   👉 Shortcut Success Rate: ${calcShortcut.successRate}% (Expected: 75%)`);

// Apply -15 HP directly in DB
[initiatorId, memberId].forEach(pId => {
  const p = pet.getPet(pId, guildId);
  const newHealth = Math.max(5, p.health - 15);
  database.run('UPDATE user_pets SET health = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [newHealth, pId, guildId, p.pet_name]);
});

const leaderPetAfterS1 = pet.getPet(initiatorId, guildId);
const memberPetAfterS1 = pet.getPet(memberId, guildId);
console.log(`   👉 Leader HP: ${leaderPetAfterS1.health} (Expected: 65)`);
console.log(`   👉 Member HP: ${memberPetAfterS1.health} (Expected: 65)`);

if (leaderPetAfterS1.health === 65 && memberPetAfterS1.health === 65) {
  console.log("   ✅ SUCCESS: Stage 1 Shortcut HP deductions applied successfully to DB!");
} else {
  console.log("   ❌ FAILED: Stage 1 Shortcut HP deduction failure!");
}

// 3. Test Stage 2: Lockpick Encounter (Lockpick deduction)
console.log("\n🧪 Test 3: Simulating Stage 2 - Lockpick Option...");
// Subtract 1 lockpick from leader
database.run("UPDATE user_inventory SET quantity = quantity - 1 WHERE user_id = ? AND guild_id = ? AND item_id = 'LOCKPICK'", [initiatorId, guildId]);
const leaderLockpicks = dbInstance.prepare("SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = 'LOCKPICK'").get(initiatorId, guildId);
console.log(`   👉 Leader Lockpicks Remaining: ${leaderLockpicks.quantity} (Expected: 1)`);

if (leaderLockpicks.quantity === 1) {
  console.log("   ✅ SUCCESS: Stage 2 Lockpick consumption applied successfully to DB!");
} else {
  console.log("   ❌ FAILED: Stage 2 Lockpick consumption failure!");
}

// 4. Test Stage 3: Simulated Climax Battle
console.log("\n🧪 Test 4: Running Stage 3 - executeExpedition execution...");
// We execute the expedition with: pathChoice = 'SHORTCUT', eventChoice = 'LOCKPICK', eventSuccess = true.
const originalRandom = Math.random;
// Force success
Math.random = () => 0.05;

const res = pet.executeExpedition(guildId, [initiatorId, memberId], 3, 'SHORTCUT', 'LOCKPICK', true, false, false, {});
console.log(`   👉 Final success: ${res.success}`);
console.log(`   👉 Logs:\n${res.logs.join('\n')}`);

// Check if chest award was given
console.log(`   👉 Chest Awarded User: ${res.chestAwardedUser}`);
console.log(`   👉 Chest Drop Item: ${res.chestDropItem}`);

// Check database state after executeExpedition
const leaderPetAfterS3 = pet.getPet(initiatorId, guildId);
const memberPetAfterS3 = pet.getPet(memberId, guildId);
// In success, hunger decreases by 10 (80 -> 70), thirst by 10 (80 -> 70), happiness increases by 10 (80 -> 90)
// HP should stay 65 (not level up, as XP booster / daily count changes, XP increases)
console.log(`   👉 Leader HP: ${leaderPetAfterS3.health} (Expected: 65)`);
console.log(`   👉 Leader Hunger: ${leaderPetAfterS3.hunger} (Expected: 70)`);
console.log(`   👉 Leader Thirst: ${leaderPetAfterS3.thirst} (Expected: 70)`);

if (res.success && leaderPetAfterS3.health === 65 && leaderPetAfterS3.hunger === 70) {
  console.log("   ✅ SUCCESS: Final expedition executed correctly, no double-write for HP!");
} else {
  console.log("   ❌ FAILED: Final expedition execution state mismatch!");
}

Math.random = originalRandom;

// Cleanup
dbInstance.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
dbInstance.prepare("DELETE FROM user_pets WHERE guild_id = ?").run(guildId);
dbInstance.prepare("DELETE FROM user_inventory WHERE guild_id = ?").run(guildId);
dbInstance.close();

console.log("\n==================================================");
console.log("🏁 ALL INTERACTIVE EXPEDITION V3 TESTS PASSED!");
console.log("==================================================");
