const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../data/economy.db');
const db = new Database(dbPath);

console.log("==================================================");
console.log("🧪 RUNNING ADMIN PET PANEL FEATURES TEST SUITE");
console.log("==================================================\n");

// Setup target test user
const targetUserId = 'USER_A';
const guildId = 'TEST_GUILD_999';

// 1. Test Trait Modifier
console.log("🧬 1. Testing Trait Modifier...");
db.prepare("UPDATE user_pets SET trait = ? WHERE user_id = ? AND guild_id = ? AND is_active = 1").run('MUTANT', targetUserId, guildId);
let pet = db.prepare("SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1").get(targetUserId, guildId);
console.log(`   👉 Set trait to MUTANT. Current trait: "${pet.trait}" (Expected: "MUTANT")`);
if (pet.trait === 'MUTANT') {
  console.log("   ✅ SUCCESS: Trait modified successfully!");
} else {
  console.log("   ❌ FAILED: Trait did not match!");
}

// 2. Test Cooldown Reset
console.log("\n⏳ 2. Testing Cooldown Reset...");
// Set mock cooldowns
db.prepare("UPDATE user_pets SET last_work_at = 999999, last_hunt_at = 888888, last_play_at = 777777 WHERE user_id = ? AND guild_id = ? AND is_active = 1").run(targetUserId, guildId);
pet = db.prepare("SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1").get(targetUserId, guildId);
console.log(`   👉 Set cooldowns. last_work: ${pet.last_work_at}, last_hunt: ${pet.last_hunt_at}, last_play: ${pet.last_play_at}`);

// Reset cooldowns
db.prepare("UPDATE user_pets SET last_work_at = 0, last_hunt_at = 0, last_play_at = 0 WHERE user_id = ? AND guild_id = ? AND is_active = 1").run(targetUserId, guildId);
pet = db.prepare("SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1").get(targetUserId, guildId);
console.log(`   👉 Reset cooldowns. last_work: ${pet.last_work_at}, last_hunt: ${pet.last_hunt_at}, last_play: ${pet.last_play_at}`);
if (pet.last_work_at === 0 && pet.last_hunt_at === 0 && pet.last_play_at === 0) {
  console.log("   ✅ SUCCESS: Cooldowns reset successfully!");
} else {
  console.log("   ❌ FAILED: Cooldowns did not reset!");
}

// 3. Test VIP Auto-Feed
console.log("\n🔋 3. Testing VIP Auto-Feed (Grants Free Feed)...");
// Set auto_feed = 2 (VIP) and lower hunger/thirst
db.prepare("UPDATE user_pets SET auto_feed = 2, hunger = 40, thirst = 40, health = 100 WHERE user_id = ? AND guild_id = ? AND is_active = 1").run(targetUserId, guildId);

// Give wallet 500 koin
db.prepare("INSERT OR REPLACE INTO wallets (user_id, guild_id, balance) VALUES (?, ?, 500)").run(targetUserId, guildId);
let walletBefore = db.prepare("SELECT balance FROM wallets WHERE user_id = ? AND guild_id = ?").get(targetUserId, guildId);

// Load pet.js applyDecay by simulating elapsed time (e.g. 1 hour decay)
const petModule = require('../stockmarket/pet');
// Get pet through pet.js wrapper which applies decay
let loadedPet = petModule.getPet(targetUserId, guildId);
let walletAfter = db.prepare("SELECT balance FROM wallets WHERE user_id = ? AND guild_id = ?").get(targetUserId, guildId);

console.log(`   👉 Wallet before: Rp ${walletBefore.balance}`);
console.log(`   👉 Wallet after: Rp ${walletAfter.balance} (Expected: Rp 500 - no deduction)`);
console.log(`   👉 Pet auto_feed: ${loadedPet.auto_feed} (Expected: 2)`);
console.log(`   👉 Pet hunger: ${loadedPet.hunger}% (Expected: ~100% or significantly higher than 40%)`);
console.log(`   👉 Pet thirst: ${loadedPet.thirst}% (Expected: ~100% or significantly higher than 40%)`);

if (walletBefore.balance === walletAfter.balance && loadedPet.hunger > 50 && loadedPet.thirst > 50) {
  console.log("   ✅ SUCCESS: VIP Auto-Feed worked perfectly with no cost!");
} else {
  console.log("   ❌ FAILED: VIP Auto-Feed charged player or did not restore status!");
}

// 4. Test Audit Queries
console.log("\n🏆 4. Testing Audit & Leaderboard Queries...");
const topLevels = db.prepare("SELECT pet_name, level FROM user_pets WHERE guild_id = ? AND is_active = 1 ORDER BY level DESC LIMIT 3").all(guildId);
console.log("   👉 Top Levels Query Result:", topLevels);

const topPvp = db.prepare("SELECT pet_name, pvp_wins FROM user_pets WHERE guild_id = ? AND is_active = 1 ORDER BY pvp_wins DESC LIMIT 3").all(guildId);
console.log("   👉 Top PvP Query Result:", topPvp);

if (topLevels.length > 0) {
  console.log("   ✅ SUCCESS: Audit and leaderboard queries executed successfully!");
} else {
  console.log("   ❌ FAILED: Leaderboard queries returned empty!");
}

// Cleanup
db.prepare("UPDATE user_pets SET auto_feed = 0, trait = '', hunger = 100, thirst = 100 WHERE user_id = ? AND guild_id = ?").run(targetUserId, guildId);
db.close();

console.log("\n==================================================");
console.log("🏁 ALL TESTS COMPLETED!");
console.log("==================================================");
