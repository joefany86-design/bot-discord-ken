const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../data/economy.db');
const db = new Database(dbPath);

console.log("==================================================");
console.log("🧪 RUNNING WEEKLY LOTTERY TEST SUITE");
console.log("==================================================\n");

const lottery = require('../stockmarket/lottery');
const economy = require('../stockmarket/economy');
const config = require('../stockmarket/config');

const guildId = 'TEST_LOTTERY_GUILD';
const user1 = 'USER_1';
const user2 = 'USER_2';
const user3 = 'USER_3';

// Cleanup previous test state
db.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM transactions WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM lottery_pool WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM lottery_tickets WHERE guild_id = ?").run(guildId);

console.log("📦 1. Setting up mock wallets...");
// user1 has 10,000 Rp
db.prepare("INSERT INTO wallets (user_id, guild_id, balance, total_earned, last_message_at) VALUES (?, ?, 10000, 10000, 0)").run(user1, guildId);
// user2 has 500 Rp
db.prepare("INSERT INTO wallets (user_id, guild_id, balance, total_earned, last_message_at) VALUES (?, ?, 500, 500, 0)").run(user2, guildId);
// user3 has 50 Rp (cannot afford even 1 ticket)
db.prepare("INSERT INTO wallets (user_id, guild_id, balance, total_earned, last_message_at) VALUES (?, ?, 50, 50, 0)").run(user3, guildId);

console.log("✅ Wallets initialized.");

console.log("\n🎟️ 2. Testing Ticket Purchases...");

// Case A: Buy with insufficient balance (user3)
try {
  lottery.buyTickets(user3, guildId, 1);
  console.log("❌ FAILED: Allowed user with Rp 50 to buy Rp 100 ticket.");
} catch (err) {
  console.log(`✅ SUCCESS: Blocked user3 from buying: ${err.message}`);
}

// Case B: Buy with invalid quantity (user1)
try {
  lottery.buyTickets(user1, guildId, 0);
  console.log("❌ FAILED: Allowed buying 0 tickets.");
} catch (err) {
  console.log(`✅ SUCCESS: Blocked buying 0 tickets: ${err.message}`);
}
try {
  lottery.buyTickets(user1, guildId, -3);
  console.log("❌ FAILED: Allowed buying negative tickets.");
} catch (err) {
  console.log(`✅ SUCCESS: Blocked buying negative tickets: ${err.message}`);
}

// Case C: Success purchase #1 (user1 buys 5 tickets = Rp 500)
try {
  const res = lottery.buyTickets(user1, guildId, 5);
  console.log(`✅ SUCCESS: User1 bought 5 tickets. Total cost: Rp ${res.totalCost}. User tickets: ${res.userTotalTickets}`);
  const wallet = economy.getWallet(user1, guildId);
  console.log(`   👉 User1 remaining balance: Rp ${wallet.balance} (Expected: 9500)`);
  if (wallet.balance !== 9500) throw new Error("Balance mismatch!");
} catch (err) {
  console.log(`❌ FAILED: User1 failed to buy tickets: ${err.message}`);
}

// Case D: Success purchase #2 (user2 buys 3 tickets = Rp 300)
try {
  const res = lottery.buyTickets(user2, guildId, 3);
  console.log(`✅ SUCCESS: User2 bought 3 tickets. Total cost: Rp ${res.totalCost}. User tickets: ${res.userTotalTickets}`);
  const wallet = economy.getWallet(user2, guildId);
  console.log(`   👉 User2 remaining balance: Rp ${wallet.balance} (Expected: 200)`);
  if (wallet.balance !== 200) throw new Error("Balance mismatch!");
} catch (err) {
  console.log(`❌ FAILED: User2 failed to buy tickets: ${err.message}`);
}

// Case E: Accumulate additional purchase (user1 buys 2 more tickets = Rp 200)
try {
  const res = lottery.buyTickets(user1, guildId, 2);
  console.log(`✅ SUCCESS: User1 bought 2 more tickets. User tickets now: ${res.userTotalTickets} (Expected: 7)`);
  const wallet = economy.getWallet(user1, guildId);
  console.log(`   👉 User1 remaining balance: Rp ${wallet.balance} (Expected: 9300)`);
  if (res.userTotalTickets !== 7 || wallet.balance !== 9300) throw new Error("Accumulation mismatch!");
} catch (err) {
  console.log(`❌ FAILED: User1 failed to accumulate tickets: ${err.message}`);
}

console.log("\n📊 3. Verifying Pool State...");
const pool = lottery.getPool(guildId);
console.log(`   👉 Pool Total Pool: Rp ${pool.total_pool} (Expected: Rp 1000)`);
console.log(`   👉 Pool Total Tickets: ${pool.total_tickets} (Expected: 10)`);
if (pool.total_pool !== 1000 || pool.total_tickets !== 10) {
  console.log("❌ FAILED: Pool values are incorrect!");
} else {
  console.log("✅ SUCCESS: Pool state is correct!");
}

console.log("\n🏆 4. Testing Lottery Drawing & Distribution...");
const draw = lottery.drawWinner(guildId);
if (draw) {
  console.log(`   🎉 Draw successful!`);
  console.log(`   👉 Winner: ${draw.winnerId} (had ${draw.winnerTickets} tickets)`);
  console.log(`   👉 Total Pool: Rp ${draw.totalPool}`);
  console.log(`   👉 Burn Amount (${draw.burnPercent}%): Rp ${draw.burnAmount}`);
  console.log(`   👉 Prize Amount: Rp ${draw.prizeAmount}`);
  console.log(`   👉 Participant Count: ${draw.participantCount}`);

  // Verify burn math
  const expectedBurn = Math.floor(draw.totalPool * (draw.burnPercent / 100));
  const expectedPrize = draw.totalPool - expectedBurn;
  if (draw.burnAmount !== expectedBurn || draw.prizeAmount !== expectedPrize) {
    console.log("❌ FAILED: Draw math mismatch!");
  } else {
    console.log("✅ SUCCESS: Draw math is correct!");
  }

  // Verify winner balance
  const winnerWallet = economy.getWallet(draw.winnerId, guildId);
  const baseBalance = draw.winnerId === user1 ? 9300 : 200;
  const expectedBalance = baseBalance + draw.prizeAmount;
  console.log(`   👉 Winner wallet balance: Rp ${winnerWallet.balance} (Expected: ${expectedBalance})`);
  if (winnerWallet.balance !== expectedBalance) {
    console.log("❌ FAILED: Winner was not credited correctly!");
  } else {
    console.log("✅ SUCCESS: Winner credited successfully!");
  }

  // Verify pool and ticket reset
  const postPool = lottery.getPool(guildId);
  const user1Tickets = lottery.getUserTickets(user1, guildId);
  const user2Tickets = lottery.getUserTickets(user2, guildId);
  console.log(`   👉 Post-draw pool size: Rp ${postPool.total_pool} (Expected: 0)`);
  console.log(`   👉 Post-draw User1 tickets: ${user1Tickets} (Expected: 0)`);
  console.log(`   👉 Post-draw User2 tickets: ${user2Tickets} (Expected: 0)`);
  if (postPool.total_pool !== 0 || user1Tickets !== 0 || user2Tickets !== 0) {
    console.log("❌ FAILED: Pool or tickets did not reset!");
  } else {
    console.log("✅ SUCCESS: Pool and tickets reset successfully!");
  }
} else {
  console.log("❌ FAILED: No winner drawn.");
}

// Cleanup
db.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM transactions WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM lottery_pool WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM lottery_tickets WHERE guild_id = ?").run(guildId);
db.close();

console.log("\n==================================================");
console.log("🏁 LOTTERY TESTS COMPLETED!");
console.log("==================================================");
