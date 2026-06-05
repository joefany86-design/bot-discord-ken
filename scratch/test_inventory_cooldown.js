const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../data/economy.db');
const db = new Database(dbPath);

console.log("==================================================");
console.log("🧪 RUNNING PET ITEM COOLDOWN & INVENTORY TEST SUITE");
console.log("==================================================\n");

const pet = require('../stockmarket/pet');
const economy = require('../stockmarket/economy');

const guildId = 'TEST_COOLDOWN_GUILD';
const userId = 'USER_COOLDOWN_OWNER';
const petName = 'Spyro';

// Clean previous test state
db.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM user_pets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM pet_inventory WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM user_inventory WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM pet_item_cooldowns WHERE guild_id = ?").run(guildId);

console.log("📦 1. Setting up mock wallet & adopting pet...");
db.prepare("INSERT INTO wallets (user_id, guild_id, balance, total_earned, last_message_at) VALUES (?, ?, 50000, 50000, 0)").run(userId, guildId);

pet.adoptPet(userId, guildId, petName, 'DRAGON');
db.prepare("UPDATE user_pets SET hatch_at = 0 WHERE user_id = ? AND guild_id = ?").run(userId, guildId);

let activePet = pet.getPet(userId, guildId);
console.log(`   👉 Pet Adopsi: ${activePet.pet_name} (Lv. ${activePet.level}), Status: ${activePet.status}`);

console.log("\n🎒 2. Adding items to pet inventory...");
db.prepare("INSERT INTO pet_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'FOOD_BASIC', 5)").run(userId, guildId);
db.prepare("INSERT INTO pet_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'FOOD_PREMIUM', 5)").run(userId, guildId);
db.prepare("INSERT INTO pet_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'SOAP_PET', 5)").run(userId, guildId);
db.prepare("INSERT INTO pet_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'SODA_ENERGY', 5)").run(userId, guildId);

console.log("\n🍗 3. Testing FOOD_BASIC (0 cooldown, 100% hunger limit)...");
// Set hunger to 50
db.prepare("UPDATE user_pets SET hunger = 50 WHERE user_id = ? AND guild_id = ?").run(userId, guildId);

// First use - should succeed
let use1 = pet.useItem(userId, guildId, 'FOOD_BASIC', false);
console.log(`   ✅ Penggunaan pertama sukses! Hunger pet sekarang: ${use1.pet.hunger}%`);

// Check cooldown remaining
let cdBasic = pet.getItemCooldown(userId, guildId, 'FOOD_BASIC');
console.log(`   👉 Sisa Cooldown FOOD_BASIC: ${cdBasic} detik (Expected: 0)`);
if (cdBasic !== 0) throw new Error("Incorrect cooldown set for FOOD_BASIC! Expected 0.");

// Second use - should succeed because hunger (80) is < 100
let use2 = pet.useItem(userId, guildId, 'FOOD_BASIC', false);
console.log(`   ✅ Penggunaan kedua sukses! Hunger pet sekarang: ${use2.pet.hunger}%`);

// Third use immediately - should fail because hunger is 100
try {
  pet.useItem(userId, guildId, 'FOOD_BASIC', false);
  throw new Error("Should have thrown hunger capacity error for FOOD_BASIC!");
} catch (err) {
  console.log(`   ✅ Sukses memblokir makan karena kenyang: "${err.message}"`);
  if (!err.message.includes("sudah kenyang")) throw err;
}

console.log("\n🥩 4. Testing FOOD_PREMIUM (0 cooldown, 100% hunger limit)...");
// Set hunger to 20
db.prepare("UPDATE user_pets SET hunger = 20 WHERE user_id = ? AND guild_id = ?").run(userId, guildId);

// First use - should succeed
let usePremium = pet.useItem(userId, guildId, 'FOOD_PREMIUM', false);
console.log(`   ✅ Penggunaan pertama sukses! Hunger pet sekarang: ${usePremium.pet.hunger}%`);

// Check cooldown remaining
let cdPremium = pet.getItemCooldown(userId, guildId, 'FOOD_PREMIUM');
console.log(`   👉 Sisa Cooldown FOOD_PREMIUM: ${cdPremium} detik (Expected: 0)`);
if (cdPremium !== 0) throw new Error("Incorrect cooldown set for FOOD_PREMIUM! Expected 0.");

// Second use - should succeed because hunger (90) is < 100
let usePremium2 = pet.useItem(userId, guildId, 'FOOD_PREMIUM', false);
console.log(`   ✅ Penggunaan kedua sukses! Hunger pet sekarang: ${usePremium2.pet.hunger}%`);

// Third use immediately - should fail because hunger is 100
try {
  pet.useItem(userId, guildId, 'FOOD_PREMIUM', false);
  throw new Error("Should have thrown hunger capacity error for FOOD_PREMIUM!");
} catch (err) {
  console.log(`   ✅ Sukses memblokir makan premium karena kenyang: "${err.message}"`);
  if (!err.message.includes("sudah kenyang")) throw err;
}

console.log("\n🧼 5. Testing SOAP_PET (0 cooldown, smelly curse limits)...");
// Apply smelly curse first
const timeNow = Math.floor(Date.now() / 1000);
db.prepare("UPDATE user_pets SET curse_type = 'smelly', curse_until = ? WHERE user_id = ? AND guild_id = ?").run(timeNow + 3600, userId, guildId);

// First wash - should succeed
let wash1 = pet.washPet(userId, guildId);
console.log(`   ✅ Mandi pertama sukses! Kutukan bau pet sekarang: "${wash1.pet.curse_type}"`);

// Second wash immediately without curse - should fail because already clean
try {
  pet.washPet(userId, guildId);
  throw new Error("Should have thrown error because pet is already clean!");
} catch (err) {
  console.log(`   ✅ Sukses memblokir mandi pet bersih: "${err.message}"`);
  if (!err.message.includes("sudah wangi dan bersih")) throw err;
}

// Reapply curse and try to wash again immediately - should succeed because SOAP_PET cooldown is 0
db.prepare("UPDATE user_pets SET curse_type = 'smelly', curse_until = ? WHERE user_id = ? AND guild_id = ?").run(timeNow + 3600, userId, guildId);
let wash2 = pet.washPet(userId, guildId);
console.log(`   ✅ Mandi kedua sukses setelah kutukan diaplikasikan kembali! Kutukan bau pet sekarang: "${wash2.pet.curse_type}"`);

console.log("\n🥤 6. Testing SODA_ENERGY (30 min cooldown)...");
// First soda - should succeed
let soda1 = pet.useSodaEnergy(userId, guildId, false);
console.log(`   ✅ Penggunaan pertama soda sukses! Cooldown kerja/hunt di-reset.`);

// Check cooldown remaining
let cdSoda = pet.getItemCooldown(userId, guildId, 'SODA_ENERGY');
console.log(`   👉 Sisa Cooldown SODA_ENERGY: ${cdSoda} detik (Expected: ~1800)`);
if (cdSoda <= 1790 || cdSoda > 1800) throw new Error("Incorrect cooldown set for SODA_ENERGY!");

// Second soda immediately - should fail
try {
  pet.useSodaEnergy(userId, guildId, false);
  throw new Error("Should have thrown cooldown error for SODA_ENERGY!");
} catch (err) {
  console.log(`   ✅ Sukses memblokir spam soda: "${err.message}"`);
}

console.log("\n⚡ 7. Testing cooldown removal bypass...");
// Reset/delete cooldown in database
db.prepare("DELETE FROM pet_item_cooldowns WHERE user_id = ? AND guild_id = ?").run(userId, guildId);
let cdAfterDelete = pet.getItemCooldown(userId, guildId, 'FOOD_BASIC');
console.log(`   👉 Cooldown setelah dihapus di DB: ${cdAfterDelete} detik (Expected: 0)`);
if (cdAfterDelete !== 0) throw new Error("Cooldown did not reset to 0 after deleting from DB!");

// Try using FOOD_BASIC again - should succeed now
db.prepare("UPDATE user_pets SET hunger = 50 WHERE user_id = ? AND guild_id = ?").run(userId, guildId);
let useBypass = pet.useItem(userId, guildId, 'FOOD_BASIC', false);
console.log(`   ✅ Penggunaan berhasil setelah cooldown di-reset! Hunger: ${useBypass.pet.hunger}%`);

console.log("\n==================================================");
console.log("🏁 ALL INVENTORY & COOLDOWN TESTS COMPLETED SUCCESSFULLY!");
console.log("==================================================");
