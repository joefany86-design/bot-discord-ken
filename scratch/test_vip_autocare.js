const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../data/economy.db');
const db = new Database(dbPath);

console.log("🧪 RUNNING VIP AUTO-CARE DECAY TEST");

const pet = require('../stockmarket/pet');
const economy = require('../stockmarket/economy');

const guildId = 'TEST_VIP_GUILD';
const userId = 'USER_VIP_OWNER';
const petName = 'VIP_Pet';

// Clean state
db.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM user_pets WHERE guild_id = ?").run(guildId);

db.prepare("INSERT INTO wallets (user_id, guild_id, balance) VALUES (?, ?, 10000)").run(userId, guildId);

// Adopt pet
pet.adoptPet(userId, guildId, petName, 'DRAGON');
db.prepare("UPDATE wallets SET balance = 10000 WHERE user_id = ? AND guild_id = ?").run(userId, guildId);
db.prepare("UPDATE user_pets SET hatch_at = 0 WHERE user_id = ? AND guild_id = ?").run(userId, guildId);
let activePet = pet.getPet(userId, guildId);

console.log(`Initial status: ${activePet.status}, hunger: ${activePet.hunger}%, thirst: ${activePet.thirst}%`);

// Set pet auto_feed = 2 (VIP Auto Care) and stats low
db.prepare("UPDATE user_pets SET auto_feed = 2, hunger = 40, thirst = 40, last_interaction_at = last_interaction_at - 7200 WHERE user_id = ? AND guild_id = ?").run(userId, guildId);

// Fetch pet, which applies decay.
// Expected behavior:
// Without auto feed, hunger decays by 4 * 2 = 8, thirst by 5 * 2 = 10.
// With auto feed = 2:
// Hour 1:
//   hunger: 40 - 4 = 36. Since 36 <= 50, it goes to 36 + 30 = 66.
//   thirst: 40 - 5 = 35. Since 35 <= 50, it goes to 35 + 35 = 70.
// Hour 2:
//   hunger: 66 - 4 = 62. Since 62 > 50, no change.
//   thirst: 70 - 5 = 65. Since 65 > 50, no change.
// Final expected stats: hunger: ~62%, thirst: ~65%.
// And wallet balance should remain exactly 10,000.
activePet = pet.getPet(userId, guildId);
const wallet = economy.getWallet(userId, guildId);

console.log(`After 2 hours decay (VIP): hunger: ${activePet.hunger}%, thirst: ${activePet.thirst}%`);
console.log(`Wallet Balance: Rp ${wallet.balance}`);

if (activePet.hunger !== 62 || activePet.thirst !== 65) {
  console.error("❌ Test Failed: VIP Auto Care didn't restore stats correctly!");
  process.exit(1);
}
if (wallet.balance !== 10000) {
  console.error("❌ Test Failed: Wallet balance was modified!");
  process.exit(1);
}

// Now test with auto_feed = 1 (standard auto care, which should be ignored)
db.prepare("UPDATE user_pets SET auto_feed = 1, hunger = 40, thirst = 40, last_interaction_at = last_interaction_at - 7200 WHERE user_id = ? AND guild_id = ?").run(userId, guildId);

// Expected:
// Without auto care (since auto_feed = 1 is ignored now):
// Hour 1: hunger: 40 - 4 = 36, thirst: 40 - 5 = 35
// Hour 2: hunger: 36 - 4 = 32, thirst: 35 - 5 = 30
// Final: hunger: 32%, thirst: 30%.
activePet = pet.getPet(userId, guildId);
const walletAfter = economy.getWallet(userId, guildId);

console.log(`After 2 hours decay (auto_feed=1, ignored): hunger: ${activePet.hunger}%, thirst: ${activePet.thirst}%`);
console.log(`Wallet Balance: Rp ${walletAfter.balance}`);

if (activePet.hunger !== 32 || activePet.thirst !== 30) {
  console.error("❌ Test Failed: auto_feed = 1 was not ignored!");
  process.exit(1);
}

console.log("✅ VIP AUTO-CARE DECAY TEST PASSED SUCCESSFULLY!");

// Clean state
db.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM user_pets WHERE guild_id = ?").run(guildId);
db.close();
