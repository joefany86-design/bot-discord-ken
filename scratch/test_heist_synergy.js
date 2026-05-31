const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../data/economy.db');
const db = new Database(dbPath);

console.log("==================================================");
console.log("🧪 RUNNING BANK HEIST SYNERGY TEST SUITE");
console.log("==================================================\n");

// Setup Test Users
const initiatorId = 'TEST_INITIATOR';
const memberId = 'TEST_MEMBER';
const guildId = 'TEST_HEIST_GUILD';
const victimId = 'TEST_VICTIM';

// Cleanup previous test state
db.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM bank_savings WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM user_pets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM user_inventory WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM kos_rentals WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM heist_cooldown WHERE guild_id = ?").run(guildId);

// Setup Wallet Balances
db.prepare("INSERT INTO wallets (user_id, guild_id, balance) VALUES (?, ?, 1000)").run(initiatorId, guildId);
db.prepare("INSERT INTO wallets (user_id, guild_id, balance) VALUES (?, ?, 1000)").run(memberId, guildId);
db.prepare("INSERT INTO bank_savings (user_id, guild_id, balance) VALUES (?, ?, 10000)").run(victimId, guildId);

const robbery = require('../stockmarket/robbery');
const petModule = require('../stockmarket/pet');
const bm = require('../stockmarket/blackmarket');

// 1. Test Penthouse Prep Fee Discount
console.log("🏢 1. Testing Penthouse Prep Fee Discount...");
const now = Math.floor(Date.now() / 1000);
// Insert active Penthouse rental for initiator
db.prepare("INSERT INTO kos_rentals (user_id, guild_id, room_tier, ends_at) VALUES (?, ?, 'PENTHOUSE', ?)").run(initiatorId, guildId, now + 3600);

// Clear active lobby state
if (robbery.activeHeists) {
  robbery.activeHeists.delete(guildId);
}

// Start Lobby
const lobby = robbery.startHeistLobby(initiatorId, guildId);
console.log(`   👉 Initiator prepFee: Rp ${lobby.prepFee} (Expected: Rp 150 due to Penthouse discount)`);
const walletAfter = db.prepare("SELECT balance FROM wallets WHERE user_id = ? AND guild_id = ?").get(initiatorId, guildId);
console.log(`   👉 Initiator wallet balance: Rp ${walletAfter.balance} (Expected: Rp 850)`);

if (lobby.prepFee === 150 && walletAfter.balance === 850) {
  console.log("   ✅ SUCCESS: Penthouse Prep Fee Discount applied correctly!");
} else {
  console.log("   ❌ FAILED: Penthouse Prep Fee Discount failed!");
}

// 2. Test Join Lobby & Item Prep
console.log("\n👥 2. Preparing Crew with Pets and criminal gears...");
// Add active adult Dragon pet to Initiator
db.prepare(
  `INSERT INTO user_pets (user_id, guild_id, pet_name, pet_type, status, level, health, hunger, thirst, happiness, is_active, trait) 
   VALUES (?, ?, 'Drago', 'DRAGON', 'ADULT', 10, 100, 100, 100, 100, 1, '')`
).run(initiatorId, guildId);

// Add active adult Golem pet to Member
db.prepare(
  `INSERT INTO user_pets (user_id, guild_id, pet_name, pet_type, status, level, health, hunger, thirst, happiness, is_active, trait) 
   VALUES (?, ?, 'Goleman', 'GOLEM', 'ADULT', 12, 100, 100, 100, 100, 1, '')`
).run(memberId, guildId);

console.log("TEST_SUITE_DB_PETS:", db.prepare("SELECT * FROM user_pets WHERE guild_id = ?").all(guildId));

// Add Black Market gears to players
db.prepare("INSERT INTO user_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'LOCKPICK', 1)").run(initiatorId, guildId);
db.prepare("INSERT INTO user_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'MEAT', 1)").run(memberId, guildId);
db.prepare("INSERT INTO user_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'MASK', 1)").run(initiatorId, guildId);

// Member joins lobby
robbery.joinHeistLobby(memberId, guildId);
const currentLobby = robbery.activeHeists.get(guildId);
console.log(`   👉 Crew count: ${currentLobby.participants.length} (Expected: 2)`);

// 3. Test Heist Execution with all Buffs & Synergies
console.log("\n💥 3. Executing Bank Heist Simulation...");
// Execute Heist
const res = robbery.executeHeist(guildId);

console.log("   👉 Heist Result Status:", res.success ? "💰 SUCCESS" : "👮 FAILED");
console.log("   👉 Pet Buffs active:", res.petDetails);
console.log("   👉 Black Market Gears active:", res.bmDetails);
console.log("   👉 Meat Pawang:", res.meatUsedHolder ? `<@${res.meatUsedHolder}>` : "None");
console.log("   👉 Broken Lockpicks:", res.brokenLockpicks);

// Verify meat consumption
const meatQty = bm.getItemQty(memberId, guildId, 'MEAT');
console.log(`   👉 Meat quantity after heist: ${meatQty} (Expected: 0 - consumed)`);

if (res.petDetails.length >= 2 && res.bmDetails.length >= 2 && meatQty === 0) {
  console.log("   ✅ SUCCESS: Heist Pet and BM synergies processed successfully!");
} else {
  console.log("   ❌ FAILED: Synergies not matched!");
}

if (res.success) {
  console.log(`   👉 Payout Per Person: Rp ${res.rewardPerPerson}`);
  console.log(`   👉 Stolen from victims: Rp ${res.stolenFromPlayers}`);
  console.log(`   👉 Masked Users (Received +10% bonus payout):`, res.maskedUsers);
  // Verify mask consumption
  const maskQty = bm.getItemQty(initiatorId, guildId, 'MASK');
  console.log(`   👉 Mask quantity after heist: ${maskQty} (Expected: 0 - consumed)`);
  if (maskQty === 0) {
    console.log("   ✅ SUCCESS: Success heist payout bonuses applied correctly!");
  } else {
    console.log("   ❌ FAILED: Mask item not consumed!");
  }
} else {
  console.log(`   👉 Fine per member: Rp ${res.fineAmount} (Expected: Rp 375 - Golem mitigated -25% from stats.fine = 500)`);
  console.log(`   👉 Jail Hours: ${res.jailHours} jam (Expected: 1.5 jam - Golem mitigated -25% from 2.0 jam)`);
  console.log(`   👉 Dodged jail users:`, res.dodgedJailUsers);
  if (res.fineAmount === 375) {
    console.log("   ✅ SUCCESS: Failure jail/fine mitigation applied correctly!");
  } else {
    console.log("   ❌ FAILED: Fine mitigation did not work!");
  }
}

// Cleanup
db.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM bank_savings WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM user_pets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM user_inventory WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM kos_rentals WHERE guild_id = ?").run(guildId);
db.close();

console.log("\n==================================================");
console.log("🏁 ALL TESTS COMPLETED!");
console.log("==================================================");
