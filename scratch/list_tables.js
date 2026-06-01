const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../data/economy.db');
const db = new Database(dbPath);

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables);

tables.forEach(t => {
  const schema = db.prepare(`PRAGMA table_info(${t.name})`).all();
  console.log(`\nTable ${t.name} columns:`);
  console.log(schema.map(c => `${c.name} (${c.type})`).join(', '));
});

db.close();
