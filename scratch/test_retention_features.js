const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../data/economy.db');
const db = new Database(dbPath);

console.log("==================================================");
console.log("🧪 RUNNING RETENTION FEATURES TEST SUITE");
console.log("==================================================\n");

const pet = require('../stockmarket/pet');
const garden = require('../stockmarket/garden');
const economy = require('../stockmarket/economy');

const userId = 'TEST_RETENTION_USER';
const guildId = 'TEST_RETENTION_GUILD';
const petName = 'Jojo';

// Clean up previous test state
db.prepare("DELETE FROM user_pets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM user_daily_quests WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM pet_inventory WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM user_inventory WHERE guild_id = ?").run(guildId);

// 1. Setup Mock User Wallet & Pet
console.log("📦 1. Initializing Mock Wallet and Pet...");
db.prepare(
  `INSERT INTO wallets (user_id, guild_id, balance, total_earned, last_message_at) 
   VALUES (?, ?, 1000, 1000, 0)`
).run(userId, guildId);

db.prepare(
  `INSERT INTO user_pets (user_id, guild_id, pet_name, pet_type, status, level, xp, health, hunger, thirst, happiness, is_active) 
   VALUES (?, ?, ?, 'DRAGON', 'ADULT', 10, 0, 100, 100, 100, 100, 1)`
).run(userId, guildId, petName);

let wallet = economy.getWallet(userId, guildId);
let userPet = pet.getPet(userId, guildId);
console.log(`   👉 Wallet Balance: Rp ${wallet.balance}`);
console.log(`   👉 Pet Name: ${userPet.pet_name}, Level: ${userPet.level}`);

// 2. Test Daily Quest Generation
console.log("\n📋 2. Testing Daily Quest Generation...");
try {
  const quests = pet.getOrCreateDailyQuests(userId, guildId);
  console.log(`   ✅ Success! Created quests for date: ${quests.quest_date}`);
  console.log(`   👉 Quest 1: ${quests.quest_1_type} (Progress: ${quests.quest_1_progress}/${quests.quest_1_target})`);
  console.log(`   👉 Quest 2: ${quests.quest_2_type} (Progress: ${quests.quest_2_progress}/${quests.quest_2_target})`);
  console.log(`   👉 Quest 3: ${quests.quest_3_type} (Progress: ${quests.quest_3_progress}/${quests.quest_3_target})`);
  
  // Verify it doesn't overwrite
  const questsAgain = pet.getOrCreateDailyQuests(userId, guildId);
  if (quests.quest_1_type === questsAgain.quest_1_type && quests.quest_2_type === questsAgain.quest_2_type) {
    console.log("   ✅ SUCCESS: Quests are persistent and not recreated within the same day.");
  } else {
    console.log("   ❌ FAILED: Quests were recreated/modified!");
  }
} catch (err) {
  console.log(`   ❌ FAILED: Quest generation error: ${err.message}`);
}

// 3. Test Quest Progression Hook
console.log("\n📈 3. Testing Quest Progression...");
try {
  // Let's get the active quests list to see what type we should trigger
  const quests = pet.getOrCreateDailyQuests(userId, guildId);
  const qType = quests.quest_1_type;
  console.log(`   👉 Simulating action for Quest 1 Type: ${qType}`);

  if (qType === 'WORK') {
    pet.sendToWork(userId, guildId);
  } else if (qType === 'HUNT') {
    pet.sendToHunt(userId, guildId);
  } else if (qType === 'FEED') {
    // Buy a basic food first
    db.prepare("INSERT INTO pet_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'FOOD_BASIC', 2)").run(userId, guildId);
    pet.useItem(userId, guildId, 'FOOD_BASIC', false);
  } else if (qType === 'PLAY') {
    pet.playWithPet(userId, guildId);
  } else if (qType === 'WATER') {
    // Setup a flower and water it
    db.prepare("INSERT INTO garden_slots (user_id, guild_id, slot_index, seed_id, planted_at, last_watered_at, water_count) VALUES (?, ?, 1, 'ROSE', 0, 0, 0)").run(userId, guildId);
    garden.waterPlant(userId, guildId, 1);
  } else if (qType === 'EXPEDITION') {
    pet.incrementQuestProgress(userId, guildId, 'EXPEDITION', 1);
  }

  // Reload quest status
  const updatedQuests = pet.getOrCreateDailyQuests(userId, guildId);
  console.log(`   👉 New progress: ${updatedQuests.quest_1_progress}/${updatedQuests.quest_1_target}`);
  if (updatedQuests.quest_1_progress > 0) {
    console.log("   ✅ SUCCESS: Quest progress correctly incremented!");
  } else {
    console.log("   ❌ FAILED: Quest progress did not increment.");
  }
} catch (err) {
  console.log(`   ❌ FAILED: Quest progression test error: ${err.message}`);
}

// 4. Test Reward Claiming
console.log("\n🎁 4. Testing Quest Reward Claiming...");
try {
  // Try claiming before completion
  try {
    pet.claimDailyQuestReward(userId, guildId);
    console.log("   ❌ FAILED: Allowed claiming before completion!");
  } catch (e) {
    console.log(`   ✅ SUCCESS: Prevented claiming incomplete quests: ${e.message}`);
  }

  // Force complete all quests in DB
  const quests = pet.getOrCreateDailyQuests(userId, guildId);
  db.prepare(
    `UPDATE user_daily_quests 
     SET quest_1_progress = quest_1_target, quest_2_progress = quest_2_target, quest_3_progress = quest_3_target 
     WHERE user_id = ? AND guild_id = ?`
  ).run(userId, guildId);
  console.log("   👉 Set all quest progresses to 100%.");

  // Claim
  const balanceBefore = economy.getWallet(userId, guildId).balance;
  const claimResult = pet.claimDailyQuestReward(userId, guildId);
  const balanceAfter = economy.getWallet(userId, guildId).balance;

  console.log(`   👉 Claimed! Bonus: Rp ${claimResult.rewardAmount}, Drop Item: ${claimResult.dropItemName}`);
  if (balanceAfter - balanceBefore === 150) {
    console.log("   ✅ SUCCESS: Awarded Rp 150 to user wallet.");
  } else {
    console.log(`   ❌ FAILED: Balance did not increase by 150! Before: ${balanceBefore}, After: ${balanceAfter}`);
  }

  // Try claiming again
  try {
    pet.claimDailyQuestReward(userId, guildId);
    console.log("   ❌ FAILED: Allowed claiming twice!");
  } catch (e) {
    console.log(`   ✅ SUCCESS: Prevented double claiming: ${e.message}`);
  }
} catch (err) {
  console.log(`   ❌ FAILED: Reward claiming test error: ${err.message}`);
}

// 5. Test Chat Chest Mechanics
console.log("\n📦 5. Testing Chat Chest Spawn & Claim...");
const mockClient = {
  activeChests: new Map(),
  messageCounter: new Map(),
  targetChestMessages: new Map()
};

// Directly test logic
const testChannelId = '1234567890';
const testGuildId = guildId;

// Choose reward
const rewardAmt = 150;
mockClient.activeChests.set(testChannelId, rewardAmt);
console.log(`   👉 Mocked chest spawn in channel ${testChannelId} with reward: Rp ${rewardAmt}`);

// Claim peti simulator
const walletBefore = economy.getWallet(userId, guildId).balance;
const activeChests = mockClient.activeChests;
const reward = activeChests.get(testChannelId);
if (reward) {
  activeChests.delete(testChannelId);
  economy.addBalance(userId, guildId, reward, 'CLAIM_PETI');
}
const walletAfter = economy.getWallet(userId, guildId).balance;

if (walletAfter - walletBefore === rewardAmt && !activeChests.has(testChannelId)) {
  console.log("   ✅ SUCCESS: Chat chest claimed successfully, balance added, chest removed.");
} else {
  console.log("   ❌ FAILED: Chat chest claim issue.");
}

// Clean up
db.prepare("DELETE FROM user_pets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM user_daily_quests WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM pet_inventory WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM user_inventory WHERE guild_id = ?").run(guildId);
db.close();

console.log("\n==================================================");
console.log("🏁 ALL TESTS COMPLETED!");
console.log("==================================================");
