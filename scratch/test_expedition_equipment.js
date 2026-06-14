const assert = require('assert');
const path = require('path');
const db = require('../stockmarket/database');
const pet = require('../stockmarket/pet');
const eq = require('../stockmarket/equipment');

console.log("==================================================");
console.log("🧪 RUNNING PET EXPEDITION EQUIPMENT AUDIT TEST");
console.log("==================================================\n");

const userId = 'user_exp_audit_test';
const guildId = 'guild_exp_audit_test';

// Cleanup previous state
db.run("DELETE FROM wallets WHERE user_id = ? AND guild_id = ?", [userId, guildId]);
db.run("DELETE FROM user_pets WHERE user_id = ? AND guild_id = ?", [userId, guildId]);
db.run("DELETE FROM pet_equipment WHERE user_id = ? AND guild_id = ?", [userId, guildId]);

// Insert base wallet
db.run("INSERT INTO wallets (user_id, guild_id, balance) VALUES (?, ?, 10000)", [userId, guildId]);

// Insert active pet: Dragon
db.run(
  `INSERT INTO user_pets (user_id, guild_id, pet_name, pet_type, status, level, health, hunger, thirst, happiness, is_active, trait, gacha_element, stat_dex) 
   VALUES (?, ?, 'AuditPet', 'DRAGON', 'ADULT', 25, 100, 100, 100, 100, 1, 'WARRIOR', 'FIRE', 20)`,
  [userId, guildId]
);

// 1. Calculate base success rate without equipment
const calcBefore = pet.calculateSuccessRate(guildId, [userId], 3, 'SAFE');
console.log(`👉 Base success rate without equipment: ${calcBefore.successRate}%`);
const hasEquipLogBefore = calcBefore.logs.some(l => l.includes('Bonus Equipment Power'));
assert.strictEqual(hasEquipLogBefore, false, "Should not have equipment power log before equipping");

// 2. Generate and equip high stats weapon & ring
const weaponId = db.db.prepare(`
  INSERT INTO pet_equipment (user_id, guild_id, equip_name, equip_type, rarity, stat_type, stat_value, level, equipped_pet, durability, max_durability, element)
  VALUES (?, ?, 'Epic Dragon Tooth', 'WEAPON', 'EPIC', 'ATK', 150, 5, 'AuditPet', 100, 100, 'FIRE')
`).run(userId, guildId).lastInsertRowid;

const ringId = db.db.prepare(`
  INSERT INTO pet_equipment (user_id, guild_id, equip_name, equip_type, rarity, stat_type, stat_value, level, equipped_pet, durability, max_durability, element)
  VALUES (?, ?, 'Epic Ouroboros Loop', 'RING', 'EPIC', 'DEX', 30, 5, 'AuditPet', 100, 100, 'FIRE')
`).run(userId, guildId).lastInsertRowid;

// 3. Calculate success rate WITH equipment
const calcAfter = pet.calculateSuccessRate(guildId, [userId], 3, 'SAFE');
console.log(`👉 Success rate with equipment: ${calcAfter.successRate}%`);
console.log("👉 Logs:\n" + calcAfter.logs.join("\n"));

const hasEquipLogAfter = calcAfter.logs.some(l => l.includes('Bonus Equipment Power'));
const hasDexLogAfter = calcAfter.logs.some(l => l.includes('DEX Bonus Kelincahan'));
assert.strictEqual(hasEquipLogAfter, true, "Should display Equipment Power bonus in logs");
assert.strictEqual(hasDexLogAfter, true, "Should display DEX bonus in logs");

// Check stats calculation with element affinity match (+15% to stat value of +5 level items)
// Weapon base: 150, level 5 (+40%), element match (+15%) -> multiplier = 1.55 -> value = 232
// Ring base: 30, level 5 (+40%), element match (+15%) -> multiplier = 1.55 -> value = 46
// Total power: 232 + 46 = 278 -> equipBonus = min(10.0, 278 * 0.02) = 5.56 -> 5.56%
assert.ok(calcAfter.successRate > calcBefore.successRate, "Success rate should increase after equipping items");

// 4. Test durability reduction on successful expedition execution
console.log("\n🧪 Testing durability decay on success...");
const originalRandom = Math.random;
Math.random = () => 0.01; // Force success
const resSuccess = pet.executeExpedition(guildId, [userId], 3, 'SAFE', 'SAFE', false, false, false, {});
Math.random = originalRandom;

const weaponAfterSuccess = db.get("SELECT durability FROM pet_equipment WHERE id = ?", [weaponId]);
const ringAfterSuccess = db.get("SELECT durability FROM pet_equipment WHERE id = ?", [ringId]);
console.log(`👉 Weapon Durability after success: ${weaponAfterSuccess.durability}`);
console.log(`👉 Ring Durability after success: ${ringAfterSuccess.durability}`);
assert.strictEqual(weaponAfterSuccess.durability, 95, "Durability should decrease by 5 points");
assert.strictEqual(ringAfterSuccess.durability, 95, "Durability should decrease by 5 points");

// 5. Test durability reduction on QTE failure execution
console.log("\n🧪 Testing durability decay on QTE failure...");
db.run("UPDATE user_pets SET status = 'ADULT', health = 100 WHERE user_id = ? AND guild_id = ?", [userId, guildId]);
pet.executeExpeditionQteFailure(guildId, [userId], userId, 'Timeout', 3, {});

const weaponAfterFailure = db.get("SELECT durability FROM pet_equipment WHERE id = ?", [weaponId]);
const ringAfterFailure = db.get("SELECT durability FROM pet_equipment WHERE id = ?", [ringId]);
console.log(`👉 Weapon Durability after failure: ${weaponAfterFailure.durability}`);
console.log(`👉 Ring Durability after failure: ${ringAfterFailure.durability}`);
assert.strictEqual(weaponAfterFailure.durability, 90, "Durability should decrease by another 5 points");
assert.strictEqual(ringAfterFailure.durability, 90, "Durability should decrease by another 5 points");

console.log("\n==================================================");
console.log("🏁 ALL EXPEDITION EQUIPMENT AUDIT TESTS PASSED!");
console.log("==================================================");
