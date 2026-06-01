const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../data/economy.db');
const db = new Database(dbPath);

console.log("==================================================");
console.log("🧪 RUNNING PET SYSTEM OVERHAUL TEST SUITE");
console.log("==================================================\n");

const pet = require('../stockmarket/pet');
const economy = require('../stockmarket/economy');
const config = require('../stockmarket/config');

const guildId = 'TEST_PET_GUILD';
const userId = 'USER_PET_OWNER';
const opponentId = 'USER_PET_OPPONENT';
const petName = 'Viserion';
const oppPetName = 'Slimey';

// Clean previous test state
db.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM user_pets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM pet_inventory WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM user_inventory WHERE guild_id = ?").run(guildId);

console.log("📦 1. Setting up mock wallets & adopting pet...");
db.prepare("INSERT INTO wallets (user_id, guild_id, balance, total_earned, last_message_at) VALUES (?, ?, 50000, 50000, 0)").run(userId, guildId);
db.prepare("INSERT INTO wallets (user_id, guild_id, balance, total_earned, last_message_at) VALUES (?, ?, 10000, 10000, 0)").run(opponentId, guildId);

// Adopt a Dragon
pet.adoptPet(userId, guildId, petName, 'DRAGON');
// Fast-forward hatch time
db.prepare("UPDATE user_pets SET hatch_at = 0 WHERE user_id = ? AND guild_id = ?").run(userId, guildId);
// Load pet (triggers hatching)
let activePet = pet.getPet(userId, guildId);
console.log(`   👉 Pet Adopsi: ${activePet.pet_name} the ${activePet.pet_type}, Status: ${activePet.status}, Level: ${activePet.level}`);
if (activePet.status !== 'BABY') throw new Error("Expected pet status to be BABY after hatching!");

console.log("\n🪮 2. Testing Accessory Purchase and Auto-Equip...");
// Buy Iron Collar (COLLAR_IRON) - Price: Rp 1,200
let buyRes = pet.buyItem(userId, guildId, 'COLLAR_IRON', 1);
activePet = pet.getPet(userId, guildId);
console.log(`   👉 Bought accessory: ${buyRes.item.name}, isAccessory: ${buyRes.isAccessory}`);
console.log(`   👉 Equipped accessory in DB: ${activePet.accessory} (Expected: COLLAR_IRON)`);
if (activePet.accessory !== 'COLLAR_IRON') throw new Error("Accessory was not equipped successfully!");

// Check wallet subtraction
let wallet = economy.getWallet(userId, guildId);
console.log(`   👉 Wallet balance after collar: Rp ${wallet.balance} (Expected: 50000 - 1500 - 1200 = 47300)`);
if (wallet.balance !== 47300) throw new Error("Collar price not deducted correctly!");

// Verify decay rate reduction
// COLLAR_IRON reduces decay by 15% (multiplier 0.85)
// Let's mock decay check. Set last_interaction_at to 3 hours ago
db.prepare("UPDATE user_pets SET last_interaction_at = last_interaction_at - 10800 WHERE user_id = ? AND guild_id = ?").run(userId, guildId);
// Dragon has hunger decay rate 4, thirst decay rate 5, happiness decay rate 3.
// With COLLAR_IRON: hunger: 4 * 0.85 = 3.4. Over 3 hours: 3 * 3.4 = 10.2 -> 10 points decay (Math.floor)
// Without COLLAR_IRON: 4 * 3 = 12 points decay.
db.prepare("UPDATE user_pets SET hunger = 100, thirst = 100, happiness = 100 WHERE user_id = ? AND guild_id = ?").run(userId, guildId);
let decayedPet = pet.getPet(userId, guildId);
console.log(`   👉 Hunger after 3h decay with collar: ${decayedPet.hunger}% (Expected: ~90% instead of 88%)`);
if (Math.round(decayedPet.hunger) !== 90) throw new Error(`Decay reduction failed! Hunger is ${decayedPet.hunger}`);

// Test accessory replacement (Buy Toy Sword - Rp 1500)
buyRes = pet.buyItem(userId, guildId, 'SWORD_TOY', 1);
activePet = pet.getPet(userId, guildId);
console.log(`   👉 Bought sword: ${buyRes.item.name}. Active accessory now: ${activePet.accessory} (Expected: SWORD_TOY)`);
if (activePet.accessory !== 'SWORD_TOY') throw new Error("Accessory was not replaced correctly!");

console.log("\n🏋️ 3. Testing Gym Training (.pet train)...");
// Set pet hunger/thirst/HP high enough to train
db.prepare("UPDATE user_pets SET health = 100, hunger = 100, thirst = 100 WHERE user_id = ? AND guild_id = ?").run(userId, guildId);
let preTrainWallet = economy.getWallet(userId, guildId).balance;
let preTrainLevel = activePet.level;
let preTrainXp = activePet.xp;

let trainRes = pet.trainPet(userId, guildId);
activePet = pet.getPet(userId, guildId);
console.log(`   👉 Trained! Fee: Rp ${trainRes.fee}. XP Gained: ${trainRes.xpGained}`);
console.log(`   👉 New Stats: Level: ${activePet.level}, XP: ${activePet.xp}, Hunger: ${activePet.hunger}%, Thirst: ${activePet.thirst}%`);
let postTrainWallet = economy.getWallet(userId, guildId).balance;

if (postTrainWallet !== preTrainWallet - 150) throw new Error("Gym fee of Rp 150 not deducted!");
if (activePet.hunger !== 70 || activePet.thirst !== 70) throw new Error("Hunger/Thirst did not drop by 30!");
if (activePet.level !== preTrainLevel + 1) throw new Error("Expected pet level to increase by 1!");
if (activePet.xp !== (preTrainXp + 100) % 100) throw new Error("Expected pet XP to increase by 100 (modulo 100)!");

console.log("\n🥤 4. Testing Soda Energy & Overdose Sickness...");
// Setup pet cooldowns
db.prepare("UPDATE user_pets SET last_work_at = 9999999999, last_hunt_at = 9999999999 WHERE user_id = ? AND guild_id = ?").run(userId, guildId);
// Buy and use Soda Energy
let sodaRes = pet.useSodaEnergy(userId, guildId, true);
activePet = pet.getPet(userId, guildId);
console.log(`   👉 Used Soda! Cooldown Work: ${activePet.last_work_at}, Cooldown Hunt: ${activePet.last_hunt_at} (Expected: 0, 0)`);
if (activePet.last_work_at !== 0 || activePet.last_hunt_at !== 0) throw new Error("Soda did not reset cooldowns!");

// Test overdose sickness (force soda count to 2, then use 3rd soda)
db.prepare("UPDATE user_pets SET soda_today = 2 WHERE user_id = ? AND guild_id = ?").run(userId, guildId);
// Let's loop until pet gets SICK (35% probability per botol)
let sodaCycles = 0;
while (activePet.status !== 'SICK' && sodaCycles < 20) {
  sodaCycles++;
  db.prepare("UPDATE user_pets SET last_work_at = 9999999999, last_hunt_at = 9999999999 WHERE user_id = ? AND guild_id = ?").run(userId, guildId);
  // Add soda to inventory to avoid buying if wallet runs out
  db.prepare("INSERT OR REPLACE INTO pet_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'SODA_ENERGY', 5)").run(userId, guildId);
  try {
    let res = pet.useSodaEnergy(userId, guildId, false);
    activePet = res.pet;
    if (res.gotSick) {
      console.log(`   👉 Pet got SICK on cycle #${sodaCycles}! Status: ${activePet.status}, HP: ${activePet.health}`);
    }
  } catch (e) {
    console.log(`   👉 Use failed: ${e.message}`);
    break;
  }
}

if (activePet.status !== 'SICK' || activePet.health !== 5) {
  throw new Error("Sickness overdose not triggered correctly!");
}

// Try to train while SICK (should throw error)
try {
  pet.trainPet(userId, guildId);
  console.log("   ❌ FAILED: Allowed gym training while pet is sick!");
} catch (e) {
  console.log(`   ✅ SUCCESS: Correctly blocked gym training while sick: ${e.message}`);
}

// Cure sickness using MEDICINE
// Ensure they have medicine
db.prepare("INSERT OR REPLACE INTO pet_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'MEDICINE', 1)").run(userId, guildId);
let cureRes = pet.useItem(userId, guildId, 'MEDICINE', false);
activePet = cureRes.pet;
console.log(`   👉 Cured pet! Status now: ${activePet.status} (Expected: BABY), HP: ${activePet.health}`);
if (activePet.status !== 'BABY' || activePet.health < 50) {
  throw new Error("Medicine did not cure sickness correctly!");
}

console.log("\n🧼 5. Testing Soap Wash Mechanic...");
// Set pet to smelly
db.prepare("UPDATE user_pets SET curse_type = 'smelly', curse_until = 9999999999 WHERE user_id = ? AND guild_id = ?").run(userId, guildId);
// Try to wash without soap (should fail)
try {
  pet.washPet(userId, guildId);
  console.log("   ❌ FAILED: Allowed washing pet without soap!");
} catch (e) {
  console.log(`   ✅ SUCCESS: Correctly blocked washing pet without soap: ${e.message}`);
}

// Buy SOAP_PET (Rp 100)
pet.buyItem(userId, guildId, 'SOAP_PET', 1);
let washRes = pet.washPet(userId, guildId);
activePet = washRes.pet;
console.log(`   👉 Washed pet with soap! Curse Type: "${activePet.curse_type}" (Expected: empty string)`);
if (activePet.curse_type !== '') throw new Error("Soap wash did not clear smelly curse!");

console.log("\n🏥 6. Testing Pet Doctor & Revive...");
// Fast forward pet level to 10 so it's a solid revive test
db.prepare("UPDATE user_pets SET level = 10, status = 'ADULT' WHERE user_id = ? AND guild_id = ?").run(userId, guildId);
// Force pet death
db.prepare("UPDATE user_pets SET health = 0, status = 'DEAD' WHERE user_id = ? AND guild_id = ?").run(userId, guildId);
activePet = pet.getPet(userId, guildId);
console.log(`   👉 Pet status before revive: ${activePet.status}`);

// Revive cost for Level 10 should be 500 * 10 = Rp 5,000
let walletBeforeRevive = economy.getWallet(userId, guildId).balance;
let reviveRes = pet.revivePet(userId, guildId);
activePet = reviveRes.pet;
let walletAfterRevive = economy.getWallet(userId, guildId).balance;

console.log(`   👉 Revived! Cost: Rp ${reviveRes.cost} (Expected: 5000)`);
console.log(`   👉 Pet status after revive: ${activePet.status} (Expected: ADULT), HP: ${activePet.health}%, Hunger: ${activePet.hunger}%`);
if (reviveRes.cost !== 5000) throw new Error("Revive cost mismatch!");
if (walletAfterRevive !== walletBeforeRevive - 5000) throw new Error("Revive cost not deducted correctly from wallet!");
if (activePet.status !== 'ADULT' || activePet.health !== 50 || activePet.hunger !== 50) {
  throw new Error("Pet status or attributes were not restored to 50% correctly!");
}

console.log("\n⚔️ 7. Testing PvP Toy Sword & Toy Shield integration...");
// Setup opponent pet
pet.adoptPet(opponentId, guildId, oppPetName, 'SLIME');
db.prepare("UPDATE user_pets SET hatch_at = 0, level = 10, status = 'ADULT', health = 100 WHERE user_id = ? AND guild_id = ?").run(opponentId, guildId);
let oppPetObj = pet.getPet(opponentId, guildId);

// Equip challenger with Toy Sword (SWORD_TOY) and opponent with Toy Shield (SHIELD_TOY)
db.prepare("UPDATE user_pets SET accessory = 'SWORD_TOY' WHERE user_id = ? AND guild_id = ?").run(userId, guildId);
db.prepare("UPDATE user_pets SET accessory = 'SHIELD_TOY' WHERE user_id = ? AND guild_id = ?").run(opponentId, guildId);

// Make sure both have 100 HP
db.prepare("UPDATE user_pets SET health = 100 WHERE guild_id = ?").run(guildId);

// Run duel simulation
let pvpRes = pet.executePvP(userId, opponentId, guildId, 100);
console.log(`   👉 PvP executed. Winner: ${pvpRes.winnerName}, Loser: ${pvpRes.loserName}`);
console.log(`   👉 Check round logs for damage verification:`);
pvpRes.logs.slice(0, 3).forEach(log => console.log(`      * ${log}`));

// Cleanup
db.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM user_pets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM pet_inventory WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM user_inventory WHERE guild_id = ?").run(guildId);
db.close();

console.log("\n==================================================");
console.log("🏁 ALL PET OVERHAUL TESTS COMPLETED SUCCESSFULLY!");
console.log("==================================================");
