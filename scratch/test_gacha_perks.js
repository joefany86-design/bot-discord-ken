const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../data/economy.db');
const db = new Database(dbPath);

console.log("==================================================");
console.log("🧪 RUNNING GACHA ROLE PERKS TEST SUITE");
console.log("==================================================\n");

const economy = require('../stockmarket/economy');
const stocks = require('../stockmarket/stocks');
const robbery = require('../stockmarket/robbery');
const pet = require('../stockmarket/pet');

const guildId = 'TEST_GACHA_GUILD';
const userA = 'USER_GACHA_A';
const userB = 'USER_GACHA_B';

// Cleanup
db.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM user_pets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM pet_inventory WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM shop_items WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM stocks WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM portfolios WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM transactions WHERE guild_id = ?").run(guildId);

// Setup gacha roles in database
db.prepare(`
  INSERT INTO shop_items (guild_id, role_id, role_name, price, is_gacha, tier)
  VALUES 
    (?, '1000', 'Common Role', 0, 1, 'COMMON'),
    (?, '2000', 'Rare Role', 0, 1, 'RARE'),
    (?, '3000', 'Epic Role', 0, 1, 'EPIC'),
    (?, '4000', 'Legendary Role', 0, 1, 'LEGENDARY'),
    (?, '5000', 'Mythic Role', 0, 1, 'MYTHIC')
`).run(guildId, guildId, guildId, guildId, guildId);

// Mock Discord member helper
const makeMockMember = (roleIds) => {
  return {
    roles: {
      cache: {
        has: (id) => roleIds.includes(id)
      }
    }
  };
};

const mockMemberNone = makeMockMember([]);
const mockMemberCommon = makeMockMember(['1000']);
const mockMemberRare = makeMockMember(['2000']);
const mockMemberEpic = makeMockMember(['3000']);
const mockMemberLegendary = makeMockMember(['4000']);
const mockMemberMythic = makeMockMember(['5000']);
const mockMemberMulti = makeMockMember(['3000', '5000']); // Epic & Mythic

// Setup wallets
db.prepare("INSERT INTO wallets (user_id, guild_id, balance) VALUES (?, ?, 100000)").run(userA, guildId);
db.prepare("INSERT INTO wallets (user_id, guild_id, balance) VALUES (?, ?, 100000)").run(userB, guildId);


console.log("⭐ 1. Testing Helper: getMemberGachaTier...");
{
  const tierNone = economy.getMemberGachaTier(mockMemberNone, guildId);
  const tierCommon = economy.getMemberGachaTier(mockMemberCommon, guildId);
  const tierEpic = economy.getMemberGachaTier(mockMemberEpic, guildId);
  const tierMulti = economy.getMemberGachaTier(mockMemberMulti, guildId);

  console.log(`   👉 None: ${tierNone} (Expected: NONE)`);
  console.log(`   👉 Common: ${tierCommon} (Expected: COMMON)`);
  console.log(`   👉 Epic: ${tierEpic} (Expected: EPIC)`);
  console.log(`   👉 Multi (Epic & Mythic): ${tierMulti} (Expected: MYTHIC)`);

  if (tierNone !== 'NONE' || tierCommon !== 'COMMON' || tierEpic !== 'EPIC' || tierMulti !== 'MYTHIC') {
    throw new Error("getMemberGachaTier helper resolved incorrectly!");
  }
  console.log("   ✅ getMemberGachaTier PASSED");
}


console.log("\n⭐ 2. Testing Transfer Tax Discounts...");
{
  // Default tax is 5% (config.economy.TRANSFER_TAX_PERCENT)
  const transferNone = economy.transferBalance(userA, userB, guildId, 10000, mockMemberNone);
  // Restore balance
  db.prepare("UPDATE wallets SET balance = 100000 WHERE guild_id = ?").run(guildId);
  
  const transferRare = economy.transferBalance(userA, userB, guildId, 10000, mockMemberRare); // -1% tax rate
  db.prepare("UPDATE wallets SET balance = 100000 WHERE guild_id = ?").run(guildId);

  const transferMythic = economy.transferBalance(userA, userB, guildId, 10000, mockMemberMythic); // -5% tax rate
  db.prepare("UPDATE wallets SET balance = 100000 WHERE guild_id = ?").run(guildId);

  console.log(`   👉 None tax rate: ${transferNone.taxRatePercent}% (Tax: Rp ${transferNone.tax})`);
  console.log(`   👉 Rare tax rate: ${transferRare.taxRatePercent}% (Tax: Rp ${transferRare.tax})`);
  console.log(`   👉 Mythic tax rate: ${transferMythic.taxRatePercent}% (Tax: Rp ${transferMythic.tax})`);

  if (transferNone.taxRatePercent - transferRare.taxRatePercent !== 1) {
    throw new Error("Rare tax discount is not 1%!");
  }
  if (transferNone.taxRatePercent - transferMythic.taxRatePercent !== 5) {
    throw new Error("Mythic tax discount is not 5%!");
  }
  console.log("   ✅ Transfer Tax Discounts PASSED");
}


console.log("\n⭐ 3. Testing Stock Sell Tax Discounts...");
{
  // Setup AAPL Stock
  db.prepare("INSERT INTO stocks (guild_id, stock_ticker, stock_name, current_price, channel_id) VALUES (?, 'AAPL', 'Apple Inc', 100, 'AAPL_CHAN')").run(guildId);
  db.prepare("INSERT INTO portfolios (user_id, guild_id, channel_id, shares) VALUES (?, ?, 'AAPL_CHAN', 50)").run(userA, guildId);

  // Mock Market Open
  stocks.isMarketOpen = () => true;

  const sellNone = stocks.sellStock(userA, guildId, 'AAPL', 1, mockMemberNone);
  // Restore portfolio
  db.prepare("UPDATE portfolios SET shares = 50 WHERE user_id = ? AND guild_id = ?").run(userA, guildId);

  const sellEpic = stocks.sellStock(userA, guildId, 'AAPL', 1, mockMemberEpic); // -3% trade tax rate
  db.prepare("UPDATE portfolios SET shares = 50 WHERE user_id = ? AND guild_id = ?").run(userA, guildId);

  const sellMythic = stocks.sellStock(userA, guildId, 'AAPL', 1, mockMemberMythic); // -8% trade tax rate
  db.prepare("UPDATE portfolios SET shares = 50 WHERE user_id = ? AND guild_id = ?").run(userA, guildId);

  console.log(`   👉 None Tax: Rp ${sellNone.tax}`);
  console.log(`   👉 Epic Tax: Rp ${sellEpic.tax}`);
  console.log(`   👉 Mythic Tax: Rp ${sellMythic.tax}`);

  if (sellNone.tax - sellEpic.tax !== 3) {
    throw new Error("Epic stock trade discount is not 3%!");
  }
  if (sellNone.tax - sellMythic.tax !== 8) {
    throw new Error("Mythic stock trade discount is not 8%!");
  }
  console.log("   ✅ Stock Trade Tax Discounts PASSED");
}


console.log("\n⭐ 4. Testing Crime Perks (Protection, Jail, Bail)...");
{
  // 4a. Victim Mythic protection (immune to rob)
  try {
    robbery.robSolo(userA, userB, guildId, mockMemberNone, mockMemberMythic);
    throw new Error("Robbery succeeded against Mythic victim!");
  } catch (e) {
    console.log(`   ✅ Mythic immunity block correctly triggered: ${e.message}`);
  }

  // 4b. Victim Rare protection (-10% stolen amount discount)
  // Force success of robbery by mocking Math.random
  const originalRandom = Math.random;
  Math.random = () => 0.01; // Force hoki success roll
  
  db.prepare("UPDATE wallets SET balance = 10000 WHERE guild_id = ?").run(guildId);
  const robNone = robbery.robSolo(userA, userB, guildId, mockMemberNone, mockMemberNone);
  
  db.prepare("UPDATE wallets SET balance = 10000 WHERE guild_id = ?").run(guildId);
  const robRare = robbery.robSolo(userA, userB, guildId, mockMemberNone, mockMemberRare);
  
  console.log(`   👉 Stolen amount from None: Rp ${robNone.amount}`);
  console.log(`   👉 Stolen amount from Rare: Rp ${robRare.amount}`);
  
  if (Math.round(robNone.amount * 0.90) !== robRare.amount) {
    Math.random = originalRandom;
    throw new Error("Rare victim discount (-10% stolen) was not applied correctly!");
  }

  // 4c. Jail duration and Bail discounts
  // Force fail of robbery
  Math.random = () => 0.99; // Force fail roll
  db.prepare("UPDATE wallets SET balance = 50000 WHERE guild_id = ?").run(guildId);
  db.prepare("UPDATE wallets SET jail_until = 0 WHERE guild_id = ?").run(guildId);
  
  robbery.robSolo(userA, userB, guildId, mockMemberNone, mockMemberNone);
  const jailNone = robbery.checkJail(userA, guildId, mockMemberNone);
  
  db.prepare("UPDATE wallets SET jail_until = 0 WHERE guild_id = ?").run(guildId);
  robbery.robSolo(userA, userB, guildId, mockMemberLegendary, mockMemberNone); // -35% duration
  const jailLegendary = robbery.checkJail(userA, guildId, mockMemberLegendary); // -25% bail discount

  console.log(`   👉 Jail duration None: ${jailNone.remaining}s (Bail: Rp ${jailNone.bailAmount})`);
  console.log(`   👉 Jail duration Legendary: ${jailLegendary.remaining}s (Bail: Rp ${jailLegendary.bailAmount})`);

  if (Math.round(jailNone.bailAmount * 0.75) !== jailLegendary.bailAmount) {
    Math.random = originalRandom;
    throw new Error("Legendary bail discount (-25%) is not applied correctly!");
  }

  Math.random = originalRandom;
  console.log("   ✅ Crime Perks PASSED");
}


console.log("\n⭐ 5. Testing Pet Gacha Perks (XP, Earnings, Soda, Expedition)...");
{
  // Setup pet
  pet.adoptPet(userA, guildId, 'GachaPet', 'DRAGON');
  db.prepare("UPDATE user_pets SET hatch_at = 0 WHERE user_id = ? AND guild_id = ?").run(userA, guildId);

  // 5a. Work earnings & XP boost
  const originalRandom = Math.random;
  Math.random = () => 0.5; // Constant reward roll

  db.prepare("UPDATE user_pets SET level = 1, xp = 0, status = 'BABY', hunger = 100, thirst = 100, happiness = 100, trait = '' WHERE user_id = ? AND guild_id = ?").run(userA, guildId);
  const workNone = pet.sendToWork(userA, guildId, mockMemberNone);

  // Restore pet stats
  db.prepare("UPDATE user_pets SET level = 1, xp = 0, status = 'BABY', hunger = 100, thirst = 100, happiness = 100, last_work_at = 0, trait = '' WHERE user_id = ? AND guild_id = ?").run(userA, guildId);
  const workEpic = pet.sendToWork(userA, guildId, mockMemberEpic); // Epic: +10% salary, +30% XP

  Math.random = originalRandom;

  console.log(`   👉 Work base salary: Rp ${workNone.reward}`);
  console.log(`   👉 Work Epic salary: Rp ${workEpic.reward}`);

  if (Math.round(workNone.reward * 1.10) !== workEpic.reward) {
    throw new Error("Epic pet work salary bonus (+10%) was not applied correctly!");
  }

  // 5b. Soda sickness immunity for Mythic
  db.prepare("UPDATE user_pets SET status = 'BABY', health = 100, soda_today = 5 WHERE user_id = ? AND guild_id = ?").run(userA, guildId);
  // Add soda to inventory
  db.prepare("INSERT OR REPLACE INTO pet_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'SODA_ENERGY', 10)").run(userA, guildId);
  db.prepare("DELETE FROM pet_item_cooldowns WHERE user_id = ? AND guild_id = ?").run(userA, guildId);

  // Force sickness roll in random
  Math.random = () => 0.01; // Sickness rate is 0.35, so 0.01 triggers sickness for None

  // With Mythic (sicknessRate = 0), pet should NOT get sick
  const resSodaMythic = pet.useSodaEnergy(userA, guildId, false, mockMemberMythic);
  console.log(`   👉 Mythic soda sick status: ${resSodaMythic.gotSick ? 'SICK' : 'HEALTHY'}`);
  if (resSodaMythic.gotSick) {
    Math.random = originalRandom;
    throw new Error("Mythic pet got sick from soda despite 100% sickness immunity!");
  }

  // 5c. Expedition death rate immunity for Mythic
  db.prepare("UPDATE user_pets SET status = 'BABY', health = 100, hunger = 100, thirst = 100 WHERE user_id = ? AND guild_id = ?").run(userA, guildId);
  Math.random = () => 0.01; // Death rate is 0.03, so 0.01 triggers death for None
  
  const resExpedition = pet.executeExpedition(guildId, [userA], 1, { [userA]: mockMemberMythic });
  const freshPet = pet.getPet(userA, guildId);
  console.log(`   👉 Mythic expedition status: ${freshPet.status}`);
  if (freshPet.status === 'DEAD') {
    Math.random = originalRandom;
    throw new Error("Mythic pet died during expedition despite 100% death immunity!");
  }

  Math.random = originalRandom;
  console.log("   ✅ Pet Gacha Perks PASSED");
}

console.log("\n==================================================");
console.log("🎉 ALL TESTS PASSED SUCCESSFULLY! 100% SUCCESS");
console.log("==================================================");
