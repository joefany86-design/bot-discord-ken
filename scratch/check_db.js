const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../data/economy.db');
const db = new Database(dbPath);

console.log("=== TABLES ===");
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log(tables);

console.log("\n=== SHOP ITEMS ===");
try {
  const shopItems = db.prepare("SELECT * FROM shop_items").all();
  console.log(shopItems);
} catch (e) {
  console.log("Error reading shop_items:", e.message);
}

console.log("\n=== STOCKS ===");
try {
  const stocks = db.prepare("SELECT * FROM stocks").all();
  console.log(stocks);
} catch (e) {
  console.log("Error reading stocks:", e.message);
}
