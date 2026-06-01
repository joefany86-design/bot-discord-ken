const path = require('path');
const config = require('../stockmarket/config');
const robbery = require('../stockmarket/robbery');
const pet = require('../stockmarket/pet');
const Database = require('better-sqlite3');
const dbPath = path.join(__dirname, '../data/economy.db');
const db = new Database(dbPath);

console.log("==================================================");
console.log("🧪 RUNNING ECONOMIC BALANCE VERIFICATION TEST SUITE");
console.log("==================================================\n");

// 1. Verify Gacha Config
console.log("🎲 1. Verifying Gacha Parameters...");
console.log(`   👉 Cost per roll: Rp ${config.gacha.COST} (Expected: 500)`);
console.log(`   👉 Zonk rate: ${config.gacha.ZONK_RATE}% (Expected: 75)`);
console.log(`   👉 Common rate: ${config.gacha.RATES.COMMON}% (Expected: 81.5)`);
console.log(`   👉 Legendary rate: ${config.gacha.RATES.LEGENDARY}% (Expected: 0.5)`);

if (config.gacha.COST === 500 && config.gacha.ZONK_RATE === 75 && config.gacha.RATES.COMMON === 81.5 && config.gacha.RATES.LEGENDARY === 0.5) {
  console.log("   ✅ Gacha configuration verified successfully!\n");
} else {
  console.error("   ❌ ERROR: Gacha configuration mismatch!\n");
  process.exit(1);
}

// 2. Verify Heist stats
console.log("🏦 2. Verifying Heist Parameters...");
const stats = robbery.executeHeist ? robbery.executeHeist : null; // we can get stats from helper
// In robbery.js, getHeistStats is internal but executeHeist can be tested or we can inspect robbery.js
// Wait! robbery.js does not export getHeistStats directly, let's check what it exports.
// Let's inspect exports in robbery.js around the end.
// Actually, robbery.js exports functions like startHeistLobby, joinHeistLobby, etc.
// But we can check if we can call or mock, or since we changed the file directly, we can write a test case to check.
// Wait! Let's verify getHeistStats via a local function mock or just double check how getHeistStats is used in executeHeist.
// We can test executing a Heist with 5 mock participants and check the result stats returned!
// In robbery.js, executeHeist(guildId) gets the active lobby, sets the cooldown, rolls, and returns stats.
// Let's test the database states or just load the code and check.
// Wait, is getHeistStats exported? Let's check robbery.js exports.
// Since robbery.js is required, let's see what is exported.
// Let's run a check on the file or robbery exports.
const robberyModule = require('../stockmarket/robbery');
console.log("   👉 Exported methods:", Object.keys(robberyModule));
// Let's inspect getHeistStats if it's there - wait, it is a private function in robbery.js.
// We can verify robbery.js by querying the file or by triggering a mock heist.
// Let's trigger a mock heist to see the result statistics!
const userId = 'TEST_HEIST_USER_1';
const participants = ['TEST_HEIST_USER_1', 'TEST_HEIST_USER_2', 'TEST_HEIST_USER_3', 'TEST_HEIST_USER_4', 'TEST_HEIST_USER_5'];
const guildId = 'TEST_HEIST_GUILD';

// Clean up DB
db.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM heist_cooldown WHERE guild_id = ?").run(guildId);

// Setup wallets
participants.forEach(p => {
  db.prepare("INSERT INTO wallets (user_id, guild_id, balance) VALUES (?, ?, 50000)").run(p, guildId);
});

// Start lobby
robberyModule.startHeistLobby(userId, guildId);
// Join others
participants.slice(1).forEach(p => {
  robberyModule.joinHeistLobby(p, guildId);
});

// Force owner override to false for deterministic testing (or just executeHeist and look at the return payload)
// Let's check return payload of executeHeist:
const heistResult = robberyModule.executeHeist(guildId);
console.log(`   👉 Heist Success: ${heistResult.success}`);
if (heistResult.success) {
  console.log(`   👉 Total Reward: Rp ${heistResult.totalReward}`);
  console.log(`   👉 Reward per person: Rp ${heistResult.rewardPerPerson}`);
  // Average reward per person should be within (10000 to 16000) / 5 = 2000 to 3200
  const expectedMinShare = Math.floor(10000 / 5);
  const expectedMaxShare = Math.floor(16000 / 5);
  console.log(`      (Expected split share: Rp ${expectedMinShare} - Rp ${expectedMaxShare})`);
  if (heistResult.rewardPerPerson >= expectedMinShare && heistResult.rewardPerPerson <= expectedMaxShare + 5000) { // +stolenFromPlayers
    console.log("   ✅ Heist rewards verified successfully!\n");
  } else {
    console.error("   ❌ ERROR: Heist reward mismatch!\n");
    process.exit(1);
  }
} else {
  console.log(`   👉 Fine amount paid: Rp ${heistResult.fineAmount} (Expected: 750)`);
  console.log(`   👉 Jail hours: ${heistResult.jailHours} (Expected: 2)`);
  if (heistResult.fineAmount === 750) {
    console.log("   ✅ Heist fines verified successfully!\n");
  } else {
    console.error("   ❌ ERROR: Heist fine mismatch!\n");
    process.exit(1);
  }
}

// 3. Verify Pet Expedition Maps
console.log("🦖 3. Verifying Pet Expedition Maps & Cooldown...");
console.log(`   👉 Map 1 Beginner Forest Min: Rp ${pet.EXPEDITION_MAPS[0].minPrize}, Max: Rp ${pet.EXPEDITION_MAPS[0].maxPrize} (Expected: 200 - 400)`);
console.log(`   👉 Map 4 Ancient Palace Min: Rp ${pet.EXPEDITION_MAPS[3].minPrize}, Max: Rp ${pet.EXPEDITION_MAPS[3].maxPrize} (Expected: 1500 - 2500)`);

if (pet.EXPEDITION_MAPS[0].minPrize === 200 && pet.EXPEDITION_MAPS[0].maxPrize === 400 && pet.EXPEDITION_MAPS[3].minPrize === 1500 && pet.EXPEDITION_MAPS[3].maxPrize === 2500) {
  console.log("   ✅ Expedition map rewards verified successfully!");
} else {
  console.error("   ❌ ERROR: Expedition map rewards mismatch!");
  process.exit(1);
}

// 4. Verify Expedition Limit & Cooldown (6 plays)
console.log("\n🦖 4. Verifying Daily Expedition Limit (6 plays)...");
const petUserId = 'TEST_PET_USER';
const petGuildId = 'TEST_PET_GUILD';

db.prepare("DELETE FROM wallets WHERE guild_id = ?").run(petGuildId);
db.prepare("INSERT INTO wallets (user_id, guild_id, balance) VALUES (?, ?, 5000)").run(petUserId, petGuildId);

let playedCount = 0;
let cdErrorTriggered = false;

for (let i = 1; i <= 7; i++) {
  try {
    pet.checkExpeditionLimit(petUserId, petGuildId, false); // execute increment
    playedCount++;
    console.log(`   ✅ Played #${i} succeeded.`);
  } catch (err) {
    cdErrorTriggered = true;
    console.log(`   ❌ Played #${i} failed: ${err.message}`);
  }
}

if (playedCount === 6 && cdErrorTriggered) {
  console.log("   ✅ SUCCESS: Daily expedition limit of 6 plays is enforced!");
} else {
  console.error(`   ❌ FAILED: Played count: ${playedCount}, Error triggered: ${cdErrorTriggered}`);
  process.exit(1);
}

// Clean up DB
db.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM heist_cooldown WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM wallets WHERE guild_id = ?").run(petGuildId);
db.close();

console.log("\n==================================================");
console.log("🏁 ALL BALANCING TESTS VERIFIED SUCCESSFUL!");
console.log("==================================================");
