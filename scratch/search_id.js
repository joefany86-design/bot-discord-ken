const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../data/economy.db');
const db = new Database(dbPath);

console.log('Searching for ID 1410239829874053296 in all tables:');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();

for (const table of tables) {
  const tableName = table.name;
  try {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    const textCols = columns.filter(c => c.type === 'TEXT' || c.type === 'NUMERIC' || c.type === '');
    
    if (textCols.length === 0) continue;
    
    let whereClause = textCols.map(c => `${c.name} = '1410239829874053296'`).join(' OR ');
    const results = db.prepare(`SELECT * FROM ${tableName} WHERE ${whereClause}`).all();
    if (results.length > 0) {
      console.log(`Found in table [${tableName}]:`, results);
    }
  } catch (err) {
    console.error(`Error searching table ${tableName}:`, err.message);
  }
}

db.close();
