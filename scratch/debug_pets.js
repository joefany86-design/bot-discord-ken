const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../data/economy.db');
const db = new Database(dbPath);

console.log("=== ALL PETS IN DB ===");
const pets = db.prepare("SELECT * FROM user_pets").all();
console.log(JSON.stringify(pets, null, 2));

const wallets = db.prepare("SELECT * FROM wallets LIMIT 10").all();
console.log("\n=== SOME WALLETS ===");
console.log(wallets);

db.close();
