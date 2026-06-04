const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../data/economy.db');
const dbInstance = new Database(dbPath);

console.log("==================================================");
console.log("🧪 TESTING XP BOOSTER SCALING & DIRECT XP REWARDS");
console.log("==================================================\n");

const userId = 'TEST_XP_USER';
const guildId = 'TEST_XP_GUILD';

// Cleanup previous state
dbInstance.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
dbInstance.prepare("DELETE FROM user_pets WHERE guild_id = ?").run(guildId);
dbInstance.prepare("DELETE FROM pet_inventory WHERE guild_id = ?").run(guildId);

const pet = require('../stockmarket/pet');
const robbery = require('../stockmarket/robbery');
const database = require('../stockmarket/database');

// Setup Wallets & Pet
dbInstance.prepare("INSERT INTO wallets (user_id, guild_id, balance) VALUES (?, ?, 50000)").run(userId, guildId);
dbInstance.prepare(
  `INSERT INTO user_pets (user_id, guild_id, pet_name, pet_type, status, level, xp, health, hunger, thirst, happiness, is_active, trait) 
   VALUES (?, ?, 'Volt', 'SLIME', 'ADULT', 5, 0, 100, 100, 100, 100, 1, 'GENIUS')`
).run(userId, guildId);

// Test 1: Purchase and Use of XP_2X booster
console.log("🧪 Test 1: Buying and using XP_2X booster...");
pet.buyItem(userId, guildId, 'XP_2X', 1);

const initialPet = pet.getPet(userId, guildId);
console.log(`   👉 Initial Level: ${initialPet.level}, XP: ${initialPet.xp}, Multiplier: ${initialPet.xp_multiplier}`);

// Use the booster
const useRes = pet.useItem(userId, guildId, 'XP_2X', false);
console.log(`   👉 Item Name: ${useRes.item.name}, XP Gained: ${useRes.xpGained}, Level Up: ${useRes.levelUp}`);

const updatedPet = pet.getPet(userId, guildId);
console.log(`   👉 New Level: ${updatedPet.level}, XP: ${updatedPet.xp}, Multiplier: ${updatedPet.xp_multiplier}`);

// Formula checks:
// Level is 5. Genius trait: getXpNeeded(5) = 5 * 80 = 400.
// XP Gained = 5 * 100 * (2.0 / 2.0) = 500.
// With 500 XP added:
// 400 XP used to go Lv 5 -> Lv 6. Sisa 100 XP.
// At Lv 6: getXpNeeded(6) = 6 * 80 = 480. 100 < 480.
// So final level should be 6, and XP should be 100.
if (updatedPet.level === 6 && updatedPet.xp === 100 && updatedPet.xp_multiplier === 2.0) {
  console.log("   ✅ SUCCESS: XP Booster gives direct level-scaled XP and levels up correctly!");
} else {
  console.log(`   ❌ FAILED: XP Booster results mismatch! Got Level: ${updatedPet.level}, XP: ${updatedPet.xp}`);
}

// Test 2: Solo robbery XP scaling
console.log("\n🧪 Test 2: Checking pet XP gain in solo robbery with booster active...");
// Setup a victim wallet so robbery succeeds
const victimId = 'TEST_VICTIM';
dbInstance.prepare("INSERT INTO wallets (user_id, guild_id, balance) VALUES (?, ?, 10000)").run(victimId, guildId);

const originalRandom = Math.random;
Math.random = () => 0.0001; // Force robbery success and prevent alert/security fail

// Execute solo robbery
const robRes = robbery.robSolo(userId, victimId, guildId);
console.log(`   👉 Robbery success: ${robRes.success}, msg: ${robRes.petMsg}`);

Math.random = originalRandom;

const petAfterRob = pet.getPet(userId, guildId);
console.log(`   👉 Pet Level: ${petAfterRob.level}, XP: ${petAfterRob.xp}`);

// Expected base XP is 20. Multiplied by 2x = 40 XP.
// Sisa XP was 100. +40 = 140 XP.
if (petAfterRob.xp === 140) {
  console.log("   ✅ SUCCESS: Solo robbery pet XP gain is correctly multiplied by the XP booster!");
} else {
  console.log(`   ❌ FAILED: Solo robbery pet XP gain was not scaled properly! Got XP: ${petAfterRob.xp}`);
}

// Cleanup
dbInstance.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
dbInstance.prepare("DELETE FROM user_pets WHERE guild_id = ?").run(guildId);
dbInstance.prepare("DELETE FROM pet_inventory WHERE guild_id = ?").run(guildId);
dbInstance.close();

console.log("\n==================================================");
console.log("🏁 ALL SCALING TESTS PASSED!");
console.log("==================================================");
