const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const configPath = path.join(__dirname, '../stockmarket/config.js');
let dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../data/economy.db');

console.log('Connecting to database at:', dbPath);

if (!fs.existsSync(dbPath)) {
  console.error('Database file not found!');
  process.exit(1);
}

const db = new Database(dbPath);

const targetGuildId = '1410239829874053296';

// Fetch current stocks for the target guild
const stocks = db.prepare('SELECT channel_id, guild_id, stock_name, stock_ticker, current_price, previous_price FROM stocks WHERE guild_id = ?').all(targetGuildId);
console.log('Current stocks for guild ' + targetGuildId + ' before update:');
console.log(stocks);

// Update stock prices to 10,000 for the target guild
const stmt = db.prepare('UPDATE stocks SET previous_price = current_price, current_price = 10000 WHERE guild_id = ?');
const result = stmt.run(targetGuildId);
console.log(`Updated ${result.changes} stocks to 10,000 in guild ${targetGuildId}!`);

// Fetch updated stocks for the target guild
const updatedStocks = db.prepare('SELECT channel_id, guild_id, stock_name, stock_ticker, current_price, previous_price FROM stocks WHERE guild_id = ?').all(targetGuildId);
console.log('Updated stocks for guild ' + targetGuildId + ':');
console.log(updatedStocks);

db.close();

