const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../data/economy.db');
const db = new Database(dbPath);

console.log("==================================================");
console.log("🧪 RUNNING PROGRESSIVE BANK TAX TEST SUITE");
console.log("==================================================\n");

const config = require('../stockmarket/config');

const guildId = 'TEST_TAX_GUILD';
const userA = 'USER_TAX_A'; // 10k (0% tax)
const userB = 'USER_TAX_B'; // 30k (2.5% tax)
const userC = 'USER_TAX_C'; // 80k (5.0% tax)
const userD = 'USER_TAX_D'; // 250k (10.0% tax)

// Ensure bank_savings table exists (normally handled by database.js initialization)
db.exec(`
  CREATE TABLE IF NOT EXISTS bank_savings (
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    balance INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, guild_id)
  )
`);

// Cleanup previous test state
db.prepare("DELETE FROM bank_savings WHERE guild_id = ?").run(guildId);

console.log("📦 1. Setting up mock bank savings accounts...");
db.prepare("INSERT INTO bank_savings (user_id, guild_id, balance) VALUES (?, ?, 10000)").run(userA, guildId);
db.prepare("INSERT INTO bank_savings (user_id, guild_id, balance) VALUES (?, ?, 30000)").run(userB, guildId);
db.prepare("INSERT INTO bank_savings (user_id, guild_id, balance) VALUES (?, ?, 80000)").run(userC, guildId);
db.prepare("INSERT INTO bank_savings (user_id, guild_id, balance) VALUES (?, ?, 250000)").run(userD, guildId);
console.log("   ✅ Bank savings accounts initialized.");

console.log("\n⚖️ 2. Executing Progressive Tax Logic...");

const brackets = config.bank.PROGRESSIVE_TAX_BRACKETS || [
  { min: 0, max: 19999, rate: 0 },
  { min: 20000, max: 49999, rate: 2.5 },
  { min: 50000, max: 99999, rate: 5.0 },
  { min: 100000, max: Number.MAX_SAFE_INTEGER, rate: 10.0 },
];

const minTaxableBalance = brackets.find(b => b.rate > 0)?.min || 20000;
const taxableAccounts = db.prepare(
  'SELECT * FROM bank_savings WHERE balance >= ? AND guild_id = ?'
).all(minTaxableBalance, guildId);

let totalTaxCollected = 0;
let accountsTaxed = 0;

taxableAccounts.forEach(account => {
  const bracket = brackets.find(b => account.balance >= b.min && account.balance <= b.max);
  if (!bracket || bracket.rate <= 0) return;

  const taxAmount = Math.floor(account.balance * (bracket.rate / 100));
  if (taxAmount <= 0) return;

  db.prepare(
    'UPDATE bank_savings SET balance = CASE WHEN balance - ? < 0 THEN 0 ELSE balance - ? END WHERE user_id = ? AND guild_id = ?'
  ).run(taxAmount, taxAmount, account.user_id, guildId);

  totalTaxCollected += taxAmount;
  accountsTaxed++;
  console.log(`   👉 Taxed ${account.user_id}: Balance was Rp ${account.balance}, Tax: Rp ${taxAmount} (${bracket.rate}%)`);
});

console.log(`\n📊 3. Verifying Post-Tax Balances...`);
console.log(`   👉 Total Tax Collected: Rp ${totalTaxCollected} (Expected: 750 + 4000 + 25000 = Rp 29,750)`);
console.log(`   👉 Accounts Taxed: ${accountsTaxed} (Expected: 3)`);

if (totalTaxCollected !== 29750 || accountsTaxed !== 3) {
  console.log("❌ FAILED: Overall tax collection statistics mismatch.");
} else {
  console.log("✅ SUCCESS: Tax statistics are correct.");
}

const balanceA = db.prepare("SELECT balance FROM bank_savings WHERE user_id = ? AND guild_id = ?").get(userA, guildId).balance;
const balanceB = db.prepare("SELECT balance FROM bank_savings WHERE user_id = ? AND guild_id = ?").get(userB, guildId).balance;
const balanceC = db.prepare("SELECT balance FROM bank_savings WHERE user_id = ? AND guild_id = ?").get(userC, guildId).balance;
const balanceD = db.prepare("SELECT balance FROM bank_savings WHERE user_id = ? AND guild_id = ?").get(userD, guildId).balance;

console.log(`   👉 User A (10k -> 0%): Rp ${balanceA} (Expected: 10000)`);
console.log(`   👉 User B (30k -> 2.5%): Rp ${balanceB} (Expected: 29250)`);
console.log(`   👉 User C (80k -> 5.0%): Rp ${balanceC} (Expected: 76000)`);
console.log(`   👉 User D (250k -> 10.0%): Rp ${balanceD} (Expected: 225000)`);

let verificationFailed = false;
if (balanceA !== 10000) { console.log("❌ FAILED: User A balance mismatch."); verificationFailed = true; }
if (balanceB !== 29250) { console.log("❌ FAILED: User B balance mismatch."); verificationFailed = true; }
if (balanceC !== 76000) { console.log("❌ FAILED: User C balance mismatch."); verificationFailed = true; }
if (balanceD !== 225000) { console.log("❌ FAILED: User D balance mismatch."); verificationFailed = true; }

if (!verificationFailed) {
  console.log("\n✅ SUCCESS: All account balances match expectations after progressive tax!");
}

// Cleanup
db.prepare("DELETE FROM bank_savings WHERE guild_id = ?").run(guildId);
db.close();

console.log("\n==================================================");
console.log("🏁 PROGRESSIVE TAX TESTS COMPLETED!");
console.log("==================================================");
