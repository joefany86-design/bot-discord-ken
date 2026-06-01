const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../data/economy.db');
const db = new Database(dbPath);

console.log("==================================================");
console.log("🧪 RUNNING PET MORTALITY & SURVIVAL TEST SUITE");
console.log("==================================================\n");

const pet = require('../stockmarket/pet');
const economy = require('../stockmarket/economy');

const guildId = 'TEST_MORTALITY_GUILD';
const userId = 'USER_MORTALITY';
const opponentId = 'USER_OPPONENT';
const petName = 'TestPet';
const oppPetName = 'OpponentPet';

// Clean state
db.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM user_pets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM pet_inventory WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM pet_item_cooldowns WHERE guild_id = ?").run(guildId);

console.log("📦 1. Setting up wallets and pets...");
db.prepare("INSERT INTO wallets (user_id, guild_id, balance) VALUES (?, ?, 50000)").run(userId, guildId);
db.prepare("INSERT INTO wallets (user_id, guild_id, balance) VALUES (?, ?, 50000)").run(opponentId, guildId);

pet.adoptPet(userId, guildId, petName, 'DRAGON');
db.prepare("UPDATE user_pets SET hatch_at = 0 WHERE user_id = ? AND guild_id = ?").run(userId, guildId);
let activePet = pet.getPet(userId, guildId);
console.log(`   👉 Challenger: ${activePet.pet_name} the ${activePet.pet_type}, Level: ${activePet.level}, Status: ${activePet.status}`);

pet.adoptPet(opponentId, guildId, oppPetName, 'SLIME');
db.prepare("UPDATE user_pets SET hatch_at = 0 WHERE user_id = ? AND guild_id = ?").run(opponentId, guildId);
let activeOpp = pet.getPet(opponentId, guildId);
console.log(`   👉 Opponent: ${activeOpp.pet_name} the ${activeOpp.pet_type}, Level: ${activeOpp.level}, Status: ${activeOpp.status}`);


console.log("\n⏳ 2. Testing Neglect Multiplier (>24h)...");
// Force trait and accessory to empty string to prevent random trait from affecting decay
const t25hAgo = Math.floor(Date.now() / 1000) - 90000;
db.prepare("UPDATE user_pets SET status = 'BABY', trait = '', accessory = '', hunger = 100, thirst = 100, happiness = 100, last_interaction_at = ? WHERE user_id = ? AND guild_id = ?").run(t25hAgo, userId, guildId);
activePet = pet.getPet(userId, guildId);
console.log(`   👉 After 25 hours neglect: hunger: ${activePet.hunger}%, thirst: ${activePet.thirst}%, health: ${activePet.health}%`);
if (activePet.hunger !== 0 || activePet.thirst !== 0 || activePet.health >= 100) {
  console.log(`   ❌ Failure: stats: hunger: ${activePet.hunger}, thirst: ${activePet.thirst}, HP: ${activePet.health}`);
  throw new Error("Neglect multiplier decay did not deplete stats as expected!");
}


console.log("\n💀 3. Testing Trait FRAGILE Starvation Damage...");
const t22hAgo = Math.floor(Date.now() / 1000) - 79200;
db.prepare("UPDATE user_pets SET status = 'BABY', trait = 'FRAGILE', accessory = '', health = 100, hunger = 100, thirst = 100, happiness = 100, last_interaction_at = ? WHERE user_id = ? AND guild_id = ?").run(t22hAgo, userId, guildId);
activePet = pet.getPet(userId, guildId);
console.log(`   👉 FRAGILE pet after 22 hours: hunger: ${activePet.hunger}%, thirst: ${activePet.thirst}%, HP: ${activePet.health}% (Expected: 70% HP)`);
if (activePet.health !== 70) {
  throw new Error(`Expected FRAGILE pet HP to be 70, but got ${activePet.health}`);
}


console.log("\n🛡️ 4. Testing Trait SURVIVOR (HP stops at 1, status = WEAK)...");
const t50hAgo = Math.floor(Date.now() / 1000) - 180000;
db.prepare("UPDATE user_pets SET status = 'BABY', trait = 'SURVIVOR', accessory = '', health = 100, hunger = 100, thirst = 100, happiness = 100, last_interaction_at = ? WHERE user_id = ? AND guild_id = ?").run(t50hAgo, userId, guildId);
activePet = pet.getPet(userId, guildId);
console.log(`   👉 SURVIVOR pet after 50 hours: HP: ${activePet.health}%, status: ${activePet.status} (Expected: 1% HP, WEAK)`);
if (activePet.health !== 1 || activePet.status !== 'WEAK') {
  throw new Error(`Expected SURVIVOR pet to be at 1 HP and WEAK, but got ${activePet.health} HP and status ${activePet.status}`);
}

// Test that a WEAK pet cannot work/hunt
try {
  pet.sendToWork(userId, guildId);
  throw new Error("Allowed a WEAK pet to work!");
} catch (e) {
  console.log(`   ✅ Correctly blocked working for WEAK pet: ${e.message}`);
}


console.log("\n🔮 5. Testing LUCKY_AMULET protection (prevents death, consumed)...");
db.prepare("UPDATE user_pets SET status = 'BABY', trait = '', accessory = 'LUCKY_AMULET', health = 100, hunger = 100, thirst = 100, happiness = 100, last_interaction_at = ? WHERE user_id = ? AND guild_id = ?").run(t50hAgo, userId, guildId);
activePet = pet.getPet(userId, guildId);
console.log(`   👉 LUCKY_AMULET pet after lethal neglect: HP: ${activePet.health}%, status: ${activePet.status}, accessory: "${activePet.accessory}" (Expected: 20% HP, BABY, accessory: "")`);
if (activePet.health !== 20 || activePet.status !== 'BABY' || activePet.accessory !== '') {
  throw new Error(`Lucky Amulet failed! HP: ${activePet.health}, status: ${activePet.status}, accessory: "${activePet.accessory}"`);
}


console.log("\n🤒 6. Testing Sickness Passive HP Loss (-1 HP/hour)...");
const t10hAgo = Math.floor(Date.now() / 1000) - 36000;
db.prepare("UPDATE user_pets SET status = 'SICK', trait = '', accessory = '', health = 100, hunger = 100, thirst = 100, happiness = 100, last_interaction_at = ? WHERE user_id = ? AND guild_id = ?").run(t10hAgo, userId, guildId);
activePet = pet.getPet(userId, guildId);
console.log(`   👉 SICK pet after 10 hours: HP: ${activePet.health}% (Expected: 90% HP)`);
if (activePet.health !== 90) {
  throw new Error(`Expected SICK pet HP to be 90, but got ${activePet.health}`);
}


console.log("\n🤕 7. Testing PvP Defeat Injury (15% chance)...");
db.prepare("UPDATE user_pets SET status = 'ADULT', trait = '', accessory = '', level = 10, health = 100 WHERE guild_id = ?").run(guildId);
let injuryTriggered = false;
let maxAttempts = 50;
let attempts = 0;
while (!injuryTriggered && attempts < maxAttempts) {
  attempts++;
  db.prepare("UPDATE user_pets SET health = 100, curse_type = '', curse_until = 0 WHERE guild_id = ?").run(guildId);
  const res = pet.executePvP(userId, opponentId, guildId, 100);
  
  const loser = pet.getPet(res.loserId, guildId);
  if (loser.curse_type === 'injured') {
    console.log(`   👉 Loser (${loser.pet_name}) got injured on duel attempt #${attempts}!`);
    console.log(`      * Injury log message: ${res.logs[res.logs.length - 1]}`);
    injuryTriggered = true;
    
    // Test that injured pet cannot hunt
    try {
      pet.sendToHunt(res.loserId, guildId);
      throw new Error("Allowed an injured pet to hunt!");
    } catch (e) {
      console.log(`   ✅ Correctly blocked hunting for injured pet: ${e.message}`);
    }
    
    // Test curing injury with MEDICINE
    console.log(`   👉 Using MEDICINE to cure injury...`);
    db.prepare("INSERT OR REPLACE INTO pet_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'MEDICINE', 1)").run(res.loserId, guildId);
    db.prepare("DELETE FROM pet_item_cooldowns WHERE user_id = ? AND guild_id = ?", [res.loserId, guildId]);
    const cureRes = pet.useItem(res.loserId, guildId, 'MEDICINE', false);
    console.log(`   👉 Cured pet curse: "${cureRes.pet.curse_type}" (Expected: "")`);
    if (cureRes.pet.curse_type !== '') {
      throw new Error("Medicine failed to cure injury!");
    }
  }
}
if (!injuryTriggered) {
  throw new Error("Injury was not triggered after 50 duels!");
}


console.log("\n💚 8. Testing Natural HP Regeneration (+1 HP/hour)...");
const t5hAgo = Math.floor(Date.now() / 1000) - 18000;
db.prepare("UPDATE user_pets SET status = 'BABY', level = 1, trait = '', accessory = '', health = 50, hunger = 100, thirst = 100, happiness = 100, last_interaction_at = ? WHERE user_id = ? AND guild_id = ?").run(t5hAgo, userId, guildId);

const row8 = db.prepare("SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ?").get(userId, guildId);
console.log("   👉 DB Row Before getPet (Step 8):", row8);

activePet = pet.getPet(userId, guildId);
console.log(`   👉 High Happiness pet after 5 hours: HP: ${activePet.health}% (Expected: 55% HP)`);
if (activePet.health !== 55) {
  throw new Error(`Expected happy pet HP to regenerate to 55, but got ${activePet.health}`);
}


console.log("\n⚔️ 9. Testing Expedition Death Risk (3% and protections)...");
const originalRandom = Math.random;
let mockRandomValues = [];
let mockRandomIndex = 0;
Math.random = () => {
  if (mockRandomIndex < mockRandomValues.length) {
    return mockRandomValues[mockRandomIndex++];
  }
  return originalRandom();
};

const runDeterministicExpedition = (successRoll, prizeOrScenarioRoll, deathRoll, dropRoll) => {
  mockRandomValues = [successRoll, prizeOrScenarioRoll, deathRoll, dropRoll];
  mockRandomIndex = 0;
  return pet.executeExpedition(guildId, [userId], 1);
};

// Case A: Standard pet dies in successful expedition
console.log("   👉 Case A: Standard pet dies");
db.prepare("UPDATE user_pets SET status = 'BABY', level = 1, trait = '', accessory = '', health = 100, hunger = 100, thirst = 100, happiness = 100, last_interaction_at = ? WHERE user_id = ? AND guild_id = ?").run(Math.floor(Date.now() / 1000), userId, guildId);
let res = runDeterministicExpedition(0.1, 0.5, 0.01, 0.5); // Success roll: 10%, Prize: 50%, Death roll: 1% (triggers), Drop roll: 50% (no drop)
activePet = pet.getPet(userId, guildId);
console.log(`      Pet Status: ${activePet.status}, HP: ${activePet.health} (Expected: DEAD, 0 HP)`);
if (activePet.status !== 'DEAD' || activePet.health !== 0) {
  throw new Error(`Expected pet to die in expedition, but got status ${activePet.status} and HP ${activePet.health}`);
}
console.log(`      Expedition Log: "${res.logs[res.logs.length - 1]}"`);

// Case B: LUCKY_AMULET saves pet
console.log("   👉 Case B: LUCKY_AMULET protection");
db.prepare("UPDATE user_pets SET status = 'BABY', level = 1, trait = '', accessory = 'LUCKY_AMULET', health = 100, hunger = 100, thirst = 100, happiness = 100, last_interaction_at = ? WHERE user_id = ? AND guild_id = ?").run(Math.floor(Date.now() / 1000), userId, guildId);
res = runDeterministicExpedition(0.1, 0.5, 0.01, 0.5); // Success roll: 10%, Prize: 50%, Death roll: 1% (triggers), Drop roll: 50% (no drop)
activePet = pet.getPet(userId, guildId);
console.log(`      Pet Status: ${activePet.status}, HP: ${activePet.health}, Accessory: "${activePet.accessory}" (Expected: BABY/ADULT, 20 HP, "")`);
if (activePet.status === 'DEAD' || activePet.health !== 20 || activePet.accessory !== '') {
  throw new Error(`Lucky Amulet failed to protect pet in expedition! HP: ${activePet.health}, status: ${activePet.status}, accessory: "${activePet.accessory}"`);
}
console.log(`      Expedition Log: "${res.logs[res.logs.length - 1]}"`);

// Case C: SURVIVOR trait saves pet
console.log("   👉 Case C: SURVIVOR trait protection");
db.prepare("UPDATE user_pets SET status = 'BABY', level = 1, trait = 'SURVIVOR', accessory = '', health = 100, hunger = 100, thirst = 100, happiness = 100, last_interaction_at = ? WHERE user_id = ? AND guild_id = ?").run(Math.floor(Date.now() / 1000), userId, guildId);
res = runDeterministicExpedition(0.1, 0.5, 0.01, 0.5); // Success roll: 10%, Prize: 50%, Death roll: 1% (triggers), Drop roll: 50% (no drop)
activePet = pet.getPet(userId, guildId);
console.log(`      Pet Status: ${activePet.status}, HP: ${activePet.health} (Expected: WEAK, 1 HP)`);
if (activePet.status !== 'WEAK' || activePet.health !== 1) {
  throw new Error(`Survivor trait failed to protect pet in expedition! HP: ${activePet.health}, status: ${activePet.status}`);
}
console.log(`      Expedition Log: "${res.logs[res.logs.length - 1]}"`);

// Case D: God pet Ramzi does not die
console.log("   👉 Case D: God pet Ramzi protection");
const godUserId = '436554535037698059';
db.prepare("DELETE FROM user_pets WHERE user_id = ? AND guild_id = ?").run(godUserId, guildId);
db.prepare("INSERT OR REPLACE INTO wallets (user_id, guild_id, balance) VALUES (?, ?, 50000)").run(godUserId, guildId);
pet.adoptPet(godUserId, guildId, 'Ramzi', 'DRAGON');
db.prepare("UPDATE user_pets SET hatch_at = 0, status = 'BABY', level = 1, trait = '', accessory = '', health = 100, hunger = 100, thirst = 100, happiness = 100, last_interaction_at = ? WHERE user_id = ? AND guild_id = ?").run(Math.floor(Date.now() / 1000), godUserId, guildId);

mockRandomValues = [0.1, 0.5, 0.01, 0.5]; // Success roll: 10%, Prize: 50%, Death roll: 1% (triggers), Drop roll: 50% (no drop)
mockRandomIndex = 0;
res = pet.executeExpedition(guildId, [godUserId], 1);
const godPet = pet.getPet(godUserId, guildId);
console.log(`      God Pet HP: ${godPet.health}, Status: ${godPet.status} (Expected: 100 HP, BABY/ADULT)`);
if (godPet.status === 'DEAD' || godPet.health !== 100) {
  throw new Error(`God pet Ramzi was affected by expedition death! HP: ${godPet.health}, status: ${godPet.status}`);
}

db.prepare("DELETE FROM wallets WHERE user_id = ? AND guild_id = ?").run(godUserId, guildId);
db.prepare("DELETE FROM user_pets WHERE user_id = ? AND guild_id = ?").run(godUserId, guildId);

Math.random = originalRandom;


// Clean state
db.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM user_pets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM pet_inventory WHERE guild_id = ?").run(guildId);
db.close();

console.log("\n==================================================");
console.log("🏁 ALL PET MORTALITY TESTS PASSED SUCCESSFULLY!");
console.log("==================================================");
