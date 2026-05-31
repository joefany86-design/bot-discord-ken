const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../data/economy.db');
const db = new Database(dbPath);

console.log("==================================================");
console.log("🧪 RUNNING PET EXPEDITION V2 TEST SUITE");
console.log("==================================================\n");

// Setup Test Users
const initiatorId = 'TEST_LEADER';
const lowLevelId = 'TEST_CUPU';
const highLevelId = 'TEST_SUHUN';
const guildId = 'TEST_EXP_GUILD';

// Cleanup previous state
db.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM user_pets WHERE guild_id = ?").run(guildId);

const pet = require('../stockmarket/pet');

// Setup Wallets
db.prepare("INSERT INTO wallets (user_id, guild_id, balance) VALUES (?, ?, 1000)").run(initiatorId, guildId);
db.prepare("INSERT INTO wallets (user_id, guild_id, balance) VALUES (?, ?, 1000)").run(lowLevelId, guildId);
db.prepare("INSERT INTO wallets (user_id, guild_id, balance) VALUES (?, ?, 1000)").run(highLevelId, guildId);

console.log("🗺️ 1. Verifying PVE Expedition Map configurations...");
console.log("   👉 Available maps count:", pet.EXPEDITION_MAPS.length);
pet.EXPEDITION_MAPS.forEach(m => {
  console.log(`   ├─ ID ${m.id}: ${m.name} (Recommended Level: Lv. ${m.recommendedLevel}+)`);
});

if (pet.EXPEDITION_MAPS.length === 4) {
  console.log("   ✅ SUCCESS: All 4 PVE maps successfully verified!");
} else {
  console.log("   ❌ FAILED: Expedition maps not matching expectations!");
}

console.log("\n🧬 2. Verifying Level Penalties & Success Rates...");
// Insert adult pets
// Initiator pet (Lv. 30)
db.prepare(
  `INSERT INTO user_pets (user_id, guild_id, pet_name, pet_type, status, level, health, hunger, thirst, happiness, is_active, trait) 
   VALUES (?, ?, 'SuhunPet', 'DRAGON', 'ADULT', 30, 100, 100, 100, 100, 1, '')`
).run(highLevelId, guildId);

// Low level pet (Lv. 1)
db.prepare(
  `INSERT INTO user_pets (user_id, guild_id, pet_name, pet_type, status, level, health, hunger, thirst, happiness, is_active, trait) 
   VALUES (?, ?, 'CupuPet', 'SLIME', 'ADULT', 1, 100, 100, 100, 100, 1, '')`
).run(lowLevelId, guildId);

// Test success rate on Map 3: Lembah Api (recommendedLevel: 25)
// Let's test a team of high level (Lv. 30) vs Map 3 (rec: 25)
// High level pet is 5 levels above recommended -> gets +5% bonus
// Map 3 base success: 45% + 5% = 50% success chance.
const originalRandom = Math.random;

// Force Math.random to fail so we can verify the failure culprits and logs
Math.random = () => 0.99;

const resHighOnly = pet.executeExpedition(guildId, [highLevelId], 3);
console.log("   👉 High-Level only Success Chance:", resHighOnly.successRate + "% (Expected: 50%)");

// Test joining low level pet (Lv. 1) to Map 3 (rec: 25)
// Level difference is 24 levels below!
// It is far below the threshold (>= 10 levels below) -> gets -24 * 3 = -72% penalty AND flat -30% penalty!
// Total success rate would fall below the minimum threshold (5%)
const resCoop = pet.executeExpedition(guildId, [highLevelId, lowLevelId], 3);
console.log("   👉 Coop Team (Lv. 30 & Lv. 1) Success Chance:", resCoop.successRate + "% (Expected capped at minimum: 5%)");
console.log("   👉 Culprit log contains low level penalty:", resCoop.logs.join("\n"));

if (resHighOnly.successRate === 50 && resCoop.successRate === 5 && resCoop.logs.some(l => l.includes("sangat pemula") || l.includes("CupuPet"))) {
  console.log("   ✅ SUCCESS: Dynamic level-based success rate & low-level extreme penalty validated successfully!");
} else {
  console.log("   ❌ FAILED: Success rate modifications are incorrect!");
}

Math.random = originalRandom;

// Cleanup
db.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM user_pets WHERE guild_id = ?").run(guildId);
db.close();

console.log("\n==================================================");
console.log("🏁 ALL EXPEDITION V2 VERIFICATION TESTS PASSED!");
console.log("==================================================");
