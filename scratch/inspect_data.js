const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '../data/economy.db'));

const id = '1410239829874053296';
console.log('--- STOCKS ---');
console.log(db.prepare('SELECT * FROM stocks WHERE guild_id = ?').all(id));

console.log('--- PORTFOLIOS ---');
console.log(db.prepare('SELECT * FROM portfolios WHERE guild_id = ?').all(id));

console.log('--- WALLETS ---');
console.log(db.prepare('SELECT user_id, guild_id, balance, total_invested FROM wallets WHERE guild_id = ?').all(id));

db.close();
