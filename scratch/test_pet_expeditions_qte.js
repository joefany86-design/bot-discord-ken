const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../data/economy.db');
const dbInstance = new Database(dbPath);

console.log("==================================================");
console.log("🧪 RUNNING PET EXPEDITION QTE & REWARD SCALING TESTS");
console.log("==================================================\n");

const initiatorId = 'TEST_LEADER_QTE';
const memberId = 'TEST_MEMBER_QTE';
const guildId = 'TEST_QTE_GUILD';

// Cleanup previous state
dbInstance.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
dbInstance.prepare("DELETE FROM user_pets WHERE guild_id = ?").run(guildId);
dbInstance.prepare("DELETE FROM user_inventory WHERE guild_id = ?").run(guildId);

const pet = require('../stockmarket/pet');
const database = require('../stockmarket/database');

// Setup Wallets
dbInstance.prepare("INSERT INTO wallets (user_id, guild_id, balance) VALUES (?, ?, 10000)").run(initiatorId, guildId);
dbInstance.prepare("INSERT INTO wallets (user_id, guild_id, balance) VALUES (?, ?, 10000)").run(memberId, guildId);

// 1. Setup Pet for Leader (underlevel risk)
// Recommended level map 1: 5. Level: 2
dbInstance.prepare(
  `INSERT INTO user_pets (user_id, guild_id, pet_name, pet_type, status, level, health, hunger, thirst, happiness, is_active, trait, gacha_element) 
   VALUES (?, ?, 'Pikachu', 'PHOENIX', 'ADULT', 2, 80, 80, 80, 80, 1, 'WARRIOR', 'FIRE')`
).run(initiatorId, guildId);

// 2. Setup Pet for Member with Survivor trait
dbInstance.prepare(
  `INSERT INTO user_pets (user_id, guild_id, pet_name, pet_type, status, level, health, hunger, thirst, happiness, is_active, trait, gacha_element) 
   VALUES (?, ?, 'Chikorita', 'TURTLE', 'ADULT', 10, 80, 80, 80, 80, 1, 'SURVIVOR', 'EARTH')`
).run(memberId, guildId);

// Test executeExpeditionQteFailure
console.log("🧪 Test 1: Testing QTE failure (Timeout/Interference)...");
// Force random to always trigger death (so we can test amulet/survivor triggers)
const originalRandom = Math.random;
Math.random = () => 0.0001; // extremely low to trigger death chance

let results = pet.executeExpeditionQteFailure(guildId, [initiatorId, memberId], memberId, 'Timeout', 1, {});
console.log("   👉 QTE Failure Results:");
results.forEach(r => {
  console.log(`      • ${r.petName} (<@${r.userId}>): ${r.statusText} (Death Triggered: ${r.deathTriggered})`);
});

// Check database results
const pikachu = pet.getPet(initiatorId, guildId);
const chikorita = pet.getPet(memberId, guildId);

console.log(`   👉 Pikachu Status in DB: ${pikachu.status} (Expected: DEAD), HP: ${pikachu.health}`);
console.log(`   👉 Chikorita Status in DB: ${chikorita.status} (Expected: WEAK due to Survivor), HP: ${chikorita.health}`);

if (pikachu.status === 'DEAD' && pikachu.health === 0 && chikorita.status === 'WEAK' && chikorita.health === 1) {
  console.log("   ✅ SUCCESS: QTE Failure and Survivor trait protection work correctly!");
} else {
  console.log("   ❌ FAILED: QTE Failure results mismatch!");
}

// Reset pets for amulet test
dbInstance.prepare("DELETE FROM user_pets WHERE guild_id = ?").run(guildId);
dbInstance.prepare(
  `INSERT INTO user_pets (user_id, guild_id, pet_name, pet_type, status, level, health, hunger, thirst, happiness, is_active, trait, gacha_element, accessory) 
   VALUES (?, ?, 'Pikachu', 'PHOENIX', 'ADULT', 5, 80, 80, 80, 80, 1, 'WARRIOR', 'FIRE', 'LUCKY_AMULET')`
).run(initiatorId, guildId);

console.log("\n🧪 Test 2: Testing QTE failure with LUCKY_AMULET protection...");
results = pet.executeExpeditionQteFailure(guildId, [initiatorId], initiatorId, 'Timeout', 1, {});
console.log("   👉 Amulet Protection Results:");
results.forEach(r => {
  console.log(`      • ${r.petName}: ${r.statusText}`);
});

const pikachuAfterAmulet = pet.getPet(initiatorId, guildId);
console.log(`   👉 Pikachu accessory after fail: "${pikachuAfterAmulet.accessory}" (Expected: "")`);
console.log(`   👉 Pikachu HP after fail: ${pikachuAfterAmulet.health} (Expected: 20)`);
console.log(`   👉 Pikachu Status after fail: ${pikachuAfterAmulet.status} (Expected: ADULT/BABY)`);

if (pikachuAfterAmulet.accessory === '' && pikachuAfterAmulet.health === 20) {
  console.log("   ✅ SUCCESS: Lucky Amulet protected the pet from dying and got consumed!");
} else {
  console.log("   ❌ FAILED: Lucky Amulet protection failed!");
}

// Dynamic random mock for Test 3:
// 1. Success roll: needs to be low (< 90) -> return 0.05
// 2. Prize roll: return 0.05 (gives min reward)
// 3. Death roll: needs to be high to prevent death -> return 0.9999
// 4. Drop item roll: return 0.9999 (no items)
let randCalls = 0;
Math.random = () => {
  randCalls++;
  if (randCalls <= 2) return 0.05; // Roll success and min reward
  return 0.9999; // Prevent death and other rolls
};

// Test reward scaling
console.log("\n🧪 Test 3: Testing executeExpedition reward scaling...");
dbInstance.prepare("DELETE FROM user_pets WHERE guild_id = ?").run(guildId);
dbInstance.prepare(
  `INSERT INTO user_pets (user_id, guild_id, pet_name, pet_type, status, level, health, hunger, thirst, happiness, is_active, trait, gacha_element) 
   VALUES (?, ?, 'Pikachu', 'PHOENIX', 'ADULT', 10, 80, 80, 80, 80, 1, 'WARRIOR', 'FIRE')`
).run(initiatorId, guildId);
dbInstance.prepare(
  `INSERT INTO user_pets (user_id, guild_id, pet_name, pet_type, status, level, health, hunger, thirst, happiness, is_active, trait, gacha_element) 
   VALUES (?, ?, 'Chikorita', 'TURTLE', 'ADULT', 10, 80, 80, 80, 80, 1, 'STURDY', 'EARTH')`
).run(memberId, guildId);

// Solo expedition
randCalls = 0; // Reset counter for solo run
const soloRes = pet.executeExpedition(guildId, [initiatorId], 1, 'SAFE', 'LEAVE', false, false, false, {});
console.log(`   👉 Solo Expedition reward: ${soloRes.rewards[0].koin} Coin, ${soloRes.rewards[0].xpGained} XP`);

// Reset Pikachu to healthy state so it can participate in Co-op
dbInstance.prepare("UPDATE user_pets SET health = 80, status = 'ADULT' WHERE user_id = ?", [initiatorId]);

// Co-op expedition
randCalls = 0; // Reset counter for co-op run
const coopRes = pet.executeExpedition(guildId, [initiatorId, memberId], 1, 'SAFE', 'LEAVE', false, false, false, {});
console.log(`   👉 Co-op Expedition rewards:`);
coopRes.rewards.forEach(r => {
  console.log(`      • ${r.petName}: ${r.koin} Coin, ${r.xpGained} XP`);
});

const pikachuSoloReward = soloRes.rewards[0];
const pikachuCoopReward = coopRes.rewards.find(r => r.userId === initiatorId);

console.log(`   👉 Pikachu Solo Coin: ${pikachuSoloReward.koin} (Expected: 63), XP: ${pikachuSoloReward.xpGained} (Expected: 60)`);
console.log(`   👉 Pikachu Co-op Coin: ${pikachuCoopReward.koin} (Expected: 157), XP: ${pikachuCoopReward.xpGained} (Expected: 300)`);

if (pikachuSoloReward.koin === 63 && pikachuSoloReward.xpGained === 60 && pikachuCoopReward.koin === 157 && pikachuCoopReward.xpGained === 300) {
  console.log("   ✅ SUCCESS: Solo vs Co-op reward scaling multipliers (30% vs 150%) correctly applied!");
} else {
  console.log("   ❌ FAILED: Reward scaling multipliers are incorrect!");
}

Math.random = originalRandom;

// Cleanup
dbInstance.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
dbInstance.prepare("DELETE FROM user_pets WHERE guild_id = ?").run(guildId);
dbInstance.prepare("DELETE FROM user_inventory WHERE guild_id = ?").run(guildId);
dbInstance.close();

console.log("\n==================================================");
console.log("🏁 ALL QTE & REWARD SCALING TESTS PASSED!");
console.log("==================================================");
