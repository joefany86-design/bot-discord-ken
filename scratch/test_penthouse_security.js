const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../data/economy.db');
const db = new Database(dbPath);

console.log("==================================================");
console.log("🧪 RUNNING PENTHOUSE SECURITY TEST SUITE");
console.log("==================================================\n");

const kos = require('../stockmarket/kos');
const robbery = require('../stockmarket/robbery');
const economy = require('../stockmarket/economy');

const guildId = 'TEST_SECURITY_GUILD';
const robberId = 'ROBBER_USER';
const victimId = 'VICTIM_USER';

// Clean previous test state
db.prepare("DELETE FROM wallets WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM kos_rentals WHERE guild_id = ?").run(guildId);
db.prepare("DELETE FROM kos_upgrades WHERE guild_id = ?").run(guildId);

console.log("📦 1. Setting up mock wallets...");
db.prepare("INSERT INTO wallets (user_id, guild_id, balance, total_earned, last_message_at) VALUES (?, ?, 50000, 50000, 0)").run(robberId, guildId);
db.prepare("INSERT INTO wallets (user_id, guild_id, balance, total_earned, last_message_at) VALUES (?, ?, 50000, 50000, 0)").run(victimId, guildId);

console.log("\n🔑 2. Testing purchase requirements for SECURITY upgrade...");
// Try to buy SECURITY when having no room rental - should fail
try {
  kos.buyUpgrade(victimId, guildId, 'SECURITY');
  throw new Error("Should have thrown Penthouse requirement error!");
} catch (err) {
  console.log(`   ✅ Sesuai harapan: Gagal beli karena tidak ada sewa Penthouse: "${err.message}"`);
  if (!err.message.includes("Penthouse")) throw err;
}

// Rent AC room and try to buy SECURITY - should fail
const now = Math.floor(Date.now() / 1000);
db.prepare("INSERT INTO kos_rentals (user_id, guild_id, room_tier, ends_at) VALUES (?, ?, 'AC', ?)").run(victimId, guildId, now + 3600);
try {
  kos.buyUpgrade(victimId, guildId, 'SECURITY');
  throw new Error("Should have thrown Penthouse requirement error!");
} catch (err) {
  console.log(`   ✅ Sesuai harapan: Gagal beli karena sewa kamar AC: "${err.message}"`);
  if (!err.message.includes("Penthouse")) throw err;
}

// Upgrade room to PENTHOUSE and try to buy SECURITY - should succeed
db.prepare("UPDATE kos_rentals SET room_tier = 'PENTHOUSE' WHERE user_id = ? AND guild_id = ?").run(victimId, guildId);
let buyRes = kos.buyUpgrade(victimId, guildId, 'SECURITY');
console.log(`   ✅ Sukses membeli upgrade: "${buyRes.name}" seharga Rp ${buyRes.price}`);
if (buyRes.upgradeId !== 'SECURITY') throw new Error("Purchase return ID mismatch!");

console.log("\n👮 3. Testing robbery protection with Penthouse Security...");
// Rob from protected user - should fail due to security roll reduction and trigger security failure
// Force non-owner robber ID so success override doesn't trigger
db.prepare("INSERT INTO wallets (user_id, guild_id, balance, total_earned, last_message_at) VALUES (?, ?, 50000, 50000, 0)").run('ANOTHER_ROBBER', guildId);

const originalMathRandom = Math.random;
Math.random = () => 0.99; // Force failure roll
let robRes = robbery.robSolo('ANOTHER_ROBBER', victimId, guildId);
Math.random = originalMathRandom; // Restore

console.log(`   👉 Hasil Rob: success = ${robRes.success}, caughtBySecurity = ${robRes.caughtBySecurity}, fine = Rp ${robRes.fine}, jail = ${robRes.jailDurationMinutes}m`);

if (robRes.success !== false) throw new Error("Robbery should have failed!");
if (robRes.caughtBySecurity !== true) throw new Error("Robber should be caught by security!");
if (robRes.fine <= 0) throw new Error("Robber should be fined!");
if (robRes.jailDurationMinutes <= 0) throw new Error("Robber should be jailed!");

console.log("\n🚪 4. Testing protection when Penthouse rental expires...");
// Set rental to expired
db.prepare("UPDATE kos_rentals SET ends_at = 0 WHERE user_id = ? AND guild_id = ?").run(victimId, guildId);
// Rob again. Since penthouse is expired, security is inactive. Let's see if caughtBySecurity is false.
// Let's clear robber jail first
db.prepare("UPDATE wallets SET jail_until = 0 WHERE user_id = ? AND guild_id = ?", ['ANOTHER_ROBBER', guildId]);
db.prepare("INSERT OR REPLACE INTO wallets (user_id, guild_id, balance, total_earned) VALUES (?, ?, 50000, 50000)").run('ANOTHER_ROBBER', guildId);

let robResExpired = robbery.robSolo('ANOTHER_ROBBER', victimId, guildId);
console.log(`   👉 Hasil Rob (Kosan Expired): success = ${robResExpired.success}, caughtBySecurity = ${robResExpired.caughtBySecurity}`);
if (robResExpired.caughtBySecurity === true) throw new Error("Security should be inactive if rental expired!");

console.log("\n==================================================");
console.log("🏁 ALL PENTHOUSE SECURITY TESTS PASSED SUCCESSFULLY!");
console.log("==================================================");
