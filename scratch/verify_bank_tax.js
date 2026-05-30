const assert = require('assert');
const Database = require('better-sqlite3');
const path = require('path');

const config = require('../stockmarket/config');
const db = new Database(config.DATABASE_PATH || path.join(__dirname, '../data/economy.db'));

const economy = require('../stockmarket/economy');
const bank = require('../stockmarket/bank');
const kos = require('../stockmarket/kos');

const testUserId = 'test_bank_tax_user';
const guildId = 'test_guild_123';

console.log("🚀 MEMULAI UJI VERIFIKASI DYNAMIC BANK TAX & INTEREST SYSTEM 🚀\n");

// Bersihkan data lama
db.prepare('DELETE FROM wallets WHERE user_id = ? AND guild_id = ?').run(testUserId, guildId);
db.prepare('DELETE FROM bank_savings WHERE user_id = ? AND guild_id = ?').run(testUserId, guildId);
db.prepare('DELETE FROM kos_rentals WHERE user_id = ? AND guild_id = ?').run(testUserId, guildId);
db.prepare('DELETE FROM transactions WHERE user_id = ? AND guild_id = ?').run(testUserId, guildId);

// 1. SETUP WALLET
console.log("➡️ Uji 1: Setup Dompet & Akun Bank");
economy.addBalance(testUserId, guildId, 100000, 'TEST_CREDIT');
const wallet = economy.getWallet(testUserId, guildId);
assert.strictEqual(wallet.balance, 100000, "Saldo awal wallet harus Rp 100.000");

const savings = bank.getSavings(testUserId, guildId);
assert.strictEqual(savings.balance, 0, "Saldo bank awal harus Rp 0");
console.log("✅ Uji 1 Berhasil!\n");

// 2. DEPOSIT & WITHDRAW PAJAK (DEFAULT / TANPA KAMAR KOS)
console.log("➡️ Uji 2: Pajak Transaksi Perbankan Biasa (Tanpa Kamar Kos)");
// Deposit Rp 10.000 (Pajak Default 2%)
// Pajak = 10000 * 2% = 200. Net Deposit = 9.800.
const depRes = bank.depositSavings(testUserId, guildId, 10000);
assert.strictEqual(depRes.amount, 10000, "Deposit gross Rp 10.000");
assert.strictEqual(depRes.tax, 200, "Pajak deposit harus Rp 200 (2%)");
assert.strictEqual(depRes.netAmount, 9800, "Net deposit masuk bank harus Rp 9.800");
assert.strictEqual(depRes.savingsBalance, 9800, "Saldo bank saat ini Rp 9.800");
assert.strictEqual(depRes.walletBalance, 90000, "Saldo dompet harus tersisa Rp 90.000");

// Withdraw Rp 5.000 (Pajak Default 5%)
// Pajak = 5000 * 5% = 250. Net withdraw = 4.750.
const wdRes = bank.withdrawSavings(testUserId, guildId, 5000);
assert.strictEqual(wdRes.amount, 5000, "Penarikan gross Rp 5.000");
assert.strictEqual(wdRes.tax, 250, "Pajak withdraw harus Rp 250 (5%)");
assert.strictEqual(wdRes.netAmount, 4750, "Net received harus Rp 4.750");
assert.strictEqual(wdRes.savingsBalance, 4800, "Sisa saldo bank harus Rp 4.800 (9800 - 5000)");
assert.strictEqual(wdRes.walletBalance, 94750, "Saldo dompet bertambah menjadi Rp 94.750 (90000 + 4750)");
console.log("✅ Uji 2 Berhasil!\n");

// 3. DISKON PAJAK PERBANKAN KELAS KOSAN (AC & PENTHOUSE)
console.log("➡️ Uji 3: Diskon Pajak Transaksi Kos Premium");
const nowUnix = Math.floor(Date.now() / 1000);

// A. Sewa Kamar AC
db.prepare(
  "INSERT INTO kos_rentals (user_id, guild_id, room_tier, ends_at) VALUES (?, ?, 'AC', ?)"
).run(testUserId, guildId, nowUnix + 3600);

// Deposit Rp 10.000 (Pajak AC 1.0%)
// Pajak = 10000 * 1.0% = 100. Net Deposit = 9.900.
const depAc = bank.depositSavings(testUserId, guildId, 10000);
assert.strictEqual(depAc.tax, 100, "Pajak AC deposit harus Rp 100 (1%)");
assert.strictEqual(depAc.netAmount, 9900, "Net masuk bank Rp 9.900");
assert.strictEqual(depAc.savingsBalance, 4800 + 9900, "Saldo bank menjadi Rp 14.700");

// B. Sewa Kamar Penthouse
db.prepare("UPDATE kos_rentals SET room_tier = 'PENTHOUSE' WHERE user_id = ? AND guild_id = ?").run(testUserId, guildId);

// Deposit Rp 10.000 (Pajak Penthouse 0.0%)
// Pajak = 0. Net deposit = 10.000.
const depPenthouse = bank.depositSavings(testUserId, guildId, 10000);
assert.strictEqual(depPenthouse.tax, 0, "Penthouse bebas pajak deposit (0%)");
assert.strictEqual(depPenthouse.netAmount, 10000, "Net masuk bank Rp 10.000");
assert.strictEqual(depPenthouse.savingsBalance, 24700, "Saldo bank menjadi Rp 24.700");
console.log("✅ Uji 3 Berhasil!\n");

// 4. PENYUSUTAN BANK HARIAN & BUNGA DINAMIS (MIDNIGHT SCHEDULE SIMULATION)
console.log("➡️ Uji 4: Simulasi Pemrosesan Tabungan Tengah Malam (00:00 WIB)");

// Kasus A: Warga Pasif (0 chat harian, Kamar Kipas Angin)
db.prepare("UPDATE kos_rentals SET room_tier = 'KIPAS' WHERE user_id = ? AND guild_id = ?").run(testUserId, guildId);

// Lakukan kalkulasi manual menggunakan rumus scheduler harian:
// - Saldo Bank: 24.700
// - Kamar: KIPAS (Bunga Maks: 1.5%, Biaya Admin: flat Rp 10 + 0.3% saldo)
// - Chat: 0 (Multiplier Bunga: 0x -> Bunga didapat: Rp 0)
// - Biaya Admin: Math.floor(24700 * 0.003) + 10 = 74 + 10 = Rp 84.
// - Net change: -Rp 84.
// - Saldo Baru: 24.700 - 84 = 24.616.

let activeMsgs = 0; // Pasif
let roomTier = 'KIPAS';
let balance = 24700;

let mult = 0;
if (activeMsgs > 5 && activeMsgs <= 20) mult = 0.5;
else if (activeMsgs > 20) mult = 1.0;

const maxRate = config.bank.INTEREST_RATE_ROOMS[roomTier];
const interestPercent = maxRate * mult;
const interestAmount = Math.floor(balance * (interestPercent / 100));

const feeConfig = config.bank.DAILY_SECURITY_FEE[roomTier];
const securityFeeAmount = Math.floor(balance * (feeConfig.percent / 100)) + feeConfig.flat;
const netChange = interestAmount - securityFeeAmount;

assert.strictEqual(interestAmount, 0, "Bunga harus Rp 0 karena tidak mengobrol");
assert.strictEqual(securityFeeAmount, 84, "Biaya Keamanan Kipas harus Rp 84 (Rp 10 + 74)");
assert.strictEqual(netChange, -84, "Net change harus berkurang Rp 84");

db.prepare(
  'UPDATE bank_savings SET balance = CASE WHEN balance + ? < 0 THEN 0 ELSE balance + ? END WHERE user_id = ? AND guild_id = ?'
).run(netChange, netChange, testUserId, guildId);

const savingsAfterPassive = bank.getSavings(testUserId, guildId);
assert.strictEqual(savingsAfterPassive.balance, 24616, "Saldo harus menyusut menjadi Rp 24.616");
console.log("👉 Sub-uji A (Drain Pasif) Berhasil! Saldo bank menyusut Rp 84.");

// Kasus B: Warga Aktif Sultan (25 chat harian, Kamar AC)
db.prepare("UPDATE kos_rentals SET room_tier = 'AC' WHERE user_id = ? AND guild_id = ?").run(testUserId, guildId);

// Lakukan kalkulasi manual menggunakan rumus scheduler harian:
// - Saldo Bank: 24.616
// - Kamar: AC (Bunga Maks: 2.0%, Biaya Admin: flat Rp 5 + 0.1% saldo)
// - Chat: 25 (Multiplier Bunga: 1x -> Bunga didapat: Math.floor(24616 * 2.0%) = Rp 492)
// - Biaya Admin: Math.floor(24616 * 0.001) + 5 = 24 + 5 = Rp 29.
// - Net change: 492 - 29 = +Rp 463.
// - Saldo Baru: 24.616 + 463 = 25.079.

activeMsgs = 25; // Aktif
roomTier = 'AC';
balance = 24616;

mult = 0;
if (activeMsgs > 5 && activeMsgs <= 20) mult = 0.5;
else if (activeMsgs > 20) mult = 1.0;

const maxRateActive = config.bank.INTEREST_RATE_ROOMS[roomTier];
const interestPercentActive = maxRateActive * mult;
const interestAmountActive = Math.floor(balance * (interestPercentActive / 100));

const feeConfigActive = config.bank.DAILY_SECURITY_FEE[roomTier];
const securityFeeAmountActive = Math.floor(balance * (feeConfigActive.percent / 100)) + feeConfigActive.flat;
const netChangeActive = interestAmountActive - securityFeeAmountActive;

assert.strictEqual(interestAmountActive, 492, "Bunga didapat harus Rp 492 (2.0%)");
assert.strictEqual(securityFeeAmountActive, 29, "Biaya Keamanan AC harus Rp 29 (Rp 5 + 24)");
assert.strictEqual(netChangeActive, 463, "Net change harus bertambah +Rp 463");

db.prepare(
  'UPDATE bank_savings SET balance = CASE WHEN balance + ? < 0 THEN 0 ELSE balance + ? END WHERE user_id = ? AND guild_id = ?'
).run(netChangeActive, netChangeActive, testUserId, guildId);

const savingsAfterActive = bank.getSavings(testUserId, guildId);
assert.strictEqual(savingsAfterActive.balance, 25079, "Saldo harus bertambah menjadi Rp 25.079");
console.log("👉 Sub-uji B (Growth Aktif) Berhasil! Saldo bank bertambah Rp 463.");
console.log("✅ Uji 4 Berhasil!\n");

// Bersihkan data setelah sukses
db.prepare('DELETE FROM wallets WHERE user_id = ? AND guild_id = ?').run(testUserId, guildId);
db.prepare('DELETE FROM bank_savings WHERE user_id = ? AND guild_id = ?').run(testUserId, guildId);
db.prepare('DELETE FROM kos_rentals WHERE user_id = ? AND guild_id = ?').run(testUserId, guildId);
db.prepare('DELETE FROM transactions WHERE user_id = ? AND guild_id = ?').run(testUserId, guildId);
db.close();

console.log("🏆 SELURUH UJI VERIFIKASI BANK TAX & INTEREST SYSTEM BERHASIL DENGAN SUKSES! 🏆");
process.exit(0);
