const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../data/economy.db');
const db = new Database(dbPath);

console.log("==================================================");
console.log("🧪 RUNNING STOCK MANIPULATION TEST SUITE");
console.log("==================================================\n");

// Setup mock state
const guildId = 'TEST_STOCK_GUILD';
const channelId = 'TEST_STOCK_CHANNEL';
const ticker = '$TEST';

// Cleanup previous test state
db.prepare("DELETE FROM stocks WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM portfolios WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM price_history WHERE guild_id = ?").run(guildId);

const stocks = require('../stockmarket/stocks');
const config = require('../stockmarket/config');

// 1. Insert a mock stock
console.log("📦 1. Initializing Mock Stock...");
db.prepare(
  `INSERT INTO stocks (channel_id, guild_id, stock_name, stock_ticker, current_price, previous_price, total_shares, available_shares) 
   VALUES (?, ?, 'Test Channel', ?, 100, 100, 1000, 1000)`
).run(channelId, guildId, ticker);

let stock = stocks.getStock(guildId, ticker);
console.log(`   👉 Created stock ${stock.stock_ticker} with price Rp ${stock.current_price}`);
if (stock.current_price === 100) {
  console.log("   ✅ SUCCESS: Mock stock initialized!");
} else {
  console.log("   ❌ FAILED: Mock stock init failed!");
}

// 2. Test Pump specific stock to MAX_PRICE instantly (simulate global_action_pump_all / PUMP_MAX)
console.log("\n📈 2. Testing Instant Price Pumping (PUMP_MAX / MAX_PRICE)...");
db.prepare("UPDATE stocks SET current_price = ?, previous_price = 100 WHERE channel_id = ? AND guild_id = ?").run(config.market.MAX_PRICE, channelId, guildId);

stock = stocks.getStock(guildId, ticker);
console.log(`   👉 Current price after pump: Rp ${stock.current_price} (Expected: Rp ${config.market.MAX_PRICE})`);
if (stock.current_price === config.market.MAX_PRICE) {
  console.log("   ✅ SUCCESS: Stock successfully pumped to MAX_PRICE!");
} else {
  console.log("   ❌ FAILED: Stock pump failed!");
}

// 3. Test Drop specific stock to MIN_PRICE instantly (simulate global_action_drop_all / DUMP_MIN)
console.log("\n📉 3. Testing Instant Price Dropping (DUMP_MIN / MIN_PRICE)...");
db.prepare("UPDATE stocks SET current_price = ?, previous_price = ? WHERE channel_id = ? AND guild_id = ?").run(config.market.MIN_PRICE, config.market.MAX_PRICE, channelId, guildId);

stock = stocks.getStock(guildId, ticker);
console.log(`   👉 Current price after drop: Rp ${stock.current_price} (Expected: Rp ${config.market.MIN_PRICE})`);
if (stock.current_price === config.market.MIN_PRICE) {
  console.log("   ✅ SUCCESS: Stock successfully dropped to MIN_PRICE!");
} else {
  console.log("   ❌ FAILED: Stock drop failed!");
}

// 4. Test Locked PUMP trend (simulate per-hour or daily bull run)
console.log("\n🧬 4. Testing Locked Trend: PUMP...");
// Reset price back to initial Rp 100
db.prepare("UPDATE stocks SET current_price = 100, previous_price = 100 WHERE channel_id = ? AND guild_id = ?").run(channelId, guildId);

// Set trend lock to PUMP for next 24 hours (86400 seconds)
const expiresAt = Math.floor(Date.now() / 1000) + 86400;
db.prepare("UPDATE stocks SET force_trend = 'PUMP', force_until = ? WHERE channel_id = ? AND guild_id = ?").run(expiresAt, channelId, guildId);

console.log("   👉 Running price update...");
const updates1 = stocks.updateStockPrices(guildId);
stock = stocks.getStock(guildId, ticker);
console.log(`   👉 Old price: Rp 100 | New price: Rp ${stock.current_price}`);
const changePercent1 = ((stock.current_price - 100) / 100) * 100;
console.log(`   👉 Change percentage: +${changePercent1.toFixed(1)}% (Expected positive bull run: +15% to +45%)`);

if (stock.current_price > 100 && changePercent1 >= 15 && changePercent1 <= 45) {
  console.log("   ✅ SUCCESS: Locked PUMP trend respects forced bull run boundaries!");
} else {
  console.log("   ❌ FAILED: Locked PUMP trend did not apply correctly!");
}

// 5. Test Locked DUMP trend (simulate per-hour or daily bear run)
console.log("\n🧬 5. Testing Locked Trend: DUMP...");
// Reset price back to initial Rp 100
db.prepare("UPDATE stocks SET current_price = 100, previous_price = 100, force_trend = 'DUMP' WHERE channel_id = ? AND guild_id = ?").run(channelId, guildId);

console.log("   👉 Running price update...");
const updates2 = stocks.updateStockPrices(guildId);
stock = stocks.getStock(guildId, ticker);
console.log(`   👉 Old price: Rp 100 | New price: Rp ${stock.current_price}`);
const changePercent2 = ((stock.current_price - 100) / 100) * 100;
console.log(`   👉 Change percentage: ${changePercent2.toFixed(1)}% (Expected negative bear run: -15% to -40%)`);

if (stock.current_price < 100 && changePercent2 <= -15 && changePercent2 >= -40) {
  console.log("   ✅ SUCCESS: Locked DUMP trend respects forced bear run boundaries!");
} else {
  console.log("   ❌ FAILED: Locked DUMP trend did not apply correctly!");
}

// 6. Test Expiration of Locked Trend (expiresAt passed)
console.log("\n⌛ 6. Testing Trend Lock Expiration...");
// Set expiresAt in the past (e.g. 5 seconds ago)
const expiredTime = Math.floor(Date.now() / 1000) - 5;
db.prepare("UPDATE stocks SET force_trend = 'PUMP', force_until = ?, current_price = 100, previous_price = 100 WHERE channel_id = ? AND guild_id = ?").run(expiredTime, channelId, guildId);

console.log("   👉 Running price update with expired trend lock...");
const updates3 = stocks.updateStockPrices(guildId);
stock = stocks.getStock(guildId, ticker);
console.log(`   👉 Database force_trend after update: "${stock.force_trend}" (Expected: "NONE" due to automatic reset)`);
console.log(`   👉 Database force_until after update: ${stock.force_until} (Expected: 0)`);

if (stock.force_trend === 'NONE' && stock.force_until === 0) {
  console.log("   ✅ SUCCESS: Trend lock correctly expired and reset back to NONE!");
} else {
  console.log("   ❌ FAILED: Trend lock did not expire properly!");
}

// Cleanup
db.prepare("DELETE FROM stocks WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM price_history WHERE guild_id = ?").run(guildId);
db.close();

console.log("\n==================================================");
console.log("🏁 ALL TESTS COMPLETED!");
console.log("==================================================");
