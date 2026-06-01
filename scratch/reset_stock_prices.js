const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env
require('dotenv').config({ path: path.join(__dirname, '../.env') });

let dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../data/economy.db');
if (process.env.DATABASE_PATH && !fs.existsSync(dbPath)) {
  console.log(`⚠️ DATABASE_PATH '${process.env.DATABASE_PATH}' tidak ditemukan secara fisik. Melakukan fallback ke database lokal...`);
  dbPath = path.join(__dirname, '../data/economy.db');
}
console.log('Connecting to database at:', dbPath);

if (!fs.existsSync(dbPath)) {
  console.error('Database file not found at ' + dbPath);
  process.exit(1);
}

const db = new Database(dbPath);
const targetGuildId = '1410239829874053296';

console.log(`\n=== MENJALANKAN RESET BURSA SAHAM GUILD ${targetGuildId} ===`);

db.transaction(() => {
  // 1. Update stock prices to 100
  const updateStocks = db.prepare(`
    UPDATE stocks 
    SET current_price = 100, previous_price = 100 
    WHERE guild_id = ?
  `);
  const stockResult = updateStocks.run(targetGuildId);
  console.log(`✅ Berhasil mereset ${stockResult.changes} saham di bursa ke harga Rp 100.`);

  // 2. Adjust portfolios to match the new opening price (avg_buy_price = 100, total_invested = shares * 100)
  const updatePortfolios = db.prepare(`
    UPDATE portfolios 
    SET avg_buy_price = 100, total_invested = shares * 100 
    WHERE guild_id = ?
  `);
  const portfolioResult = updatePortfolios.run(targetGuildId);
  console.log(`✅ Berhasil menyesuaikan ${portfolioResult.changes} portofolio member (avg buy price diset ke Rp 100).`);
})();

// Fetch and display updated stocks
console.log('\n--- Hasil Reset Saham Terbaru ---');
const updatedStocks = db.prepare('SELECT stock_name, stock_ticker, current_price, previous_price FROM stocks WHERE guild_id = ?').all(targetGuildId);
console.log(updatedStocks);

db.close();
console.log('\nReset bursa saham selesai dengan sukses!');
