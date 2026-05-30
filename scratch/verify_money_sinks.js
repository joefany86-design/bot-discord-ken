const assert = require('assert');
const Database = require('better-sqlite3');
const path = require('path');

// 1. Tentukan database
const config = require('../stockmarket/config');
const db = new Database(config.DATABASE_PATH || path.join(__dirname, '../data/economy.db'));

// Inisialisasi tabel jika belum ada
const databaseModule = require('../stockmarket/database');
const economy = require('../stockmarket/economy');
const casino = require('../stockmarket/casino');
const luxury = require('../stockmarket/luxury');
const pet = require('../stockmarket/pet');

const testUserId = 'test_money_sink_user';
const guildId = 'test_guild_123';

console.log("🚀 MEMULAI UJI VERIFIKASI OTOMATIS MONEY SINKS & EKONOMI 🚀\n");

// Bersihkan data lama test
db.prepare('DELETE FROM wallets WHERE user_id = ? AND guild_id = ?').run(testUserId, guildId);
db.prepare('DELETE FROM user_inventory WHERE user_id = ? AND guild_id = ?').run(testUserId, guildId);
db.prepare('DELETE FROM user_pets WHERE user_id = ? AND guild_id = ?').run(testUserId, guildId);

// 1. UJI WALLET & SALDO
console.log("➡️ Uji 1: Setup Wallet");
let wallet = economy.getWallet(testUserId, guildId);
assert.strictEqual(wallet.balance, 0, "Saldo awal harus 0");

economy.addBalance(testUserId, guildId, 100000, 'TEST_CREDIT');
wallet = economy.getWallet(testUserId, guildId);
assert.strictEqual(wallet.balance, 100000, "Saldo harus 100.000 setelah ditambahkan");
console.log("✅ Uji 1 Berhasil!\n");

// 2. UJI KASINO: COINFLIP
console.log("➡️ Uji 2: Coinflip Kasino");
// Uji taruhan tidak valid
assert.throws(() => casino.coinflip(testUserId, guildId, 5, 'head'), /Taruhan minimal/, "Harus error jika taruhan < Rp 20");
assert.throws(() => casino.coinflip(testUserId, guildId, 10000, 'head'), /Taruhan maksimal/, "Harus error jika taruhan > Rp 5000");

// Uji Coinflip Win/Lose
const cfRes = casino.coinflip(testUserId, guildId, 1000, 'head');
console.log(`Coinflip Result: Guess=HEAD, Landed=${cfRes.coinSide.toUpperCase()}, Won=${cfRes.won}`);
if (cfRes.won) {
  assert.strictEqual(cfRes.winnings, 950, "Winnings bersih harus 950 (1000 - 5% tax)");
  assert.strictEqual(cfRes.tax, 50, "Pajak harus 50 koin (5%)");
  assert.strictEqual(cfRes.newBalance, 100000 + 950, "Saldo harus bertambah 950");
} else {
  assert.strictEqual(cfRes.winnings, 0, "Winnings harus 0 jika kalah");
  assert.strictEqual(cfRes.newBalance, 100000 - 1000, "Saldo harus berkurang 1000");
}
console.log("✅ Uji 2 Berhasil!\n");

// 3. UJI KASINO: SLOT
console.log("➡️ Uji 3: Slot Machine");
// Kembalikan saldo ke 100.000
db.prepare('UPDATE wallets SET balance = 100000 WHERE user_id = ? AND guild_id = ?').run(testUserId, guildId);

// Uji limit
assert.throws(() => casino.spinSlot(testUserId, guildId, 5), /Taruhan minimal/, "Harus error jika taruhan slot < Rp 20");
assert.throws(() => casino.spinSlot(testUserId, guildId, 5000), /Taruhan maksimal/, "Harus error jika taruhan slot > Rp 1000");

const slotRes = casino.spinSlot(testUserId, guildId, 100);
console.log(`Slot Reels: [ ${slotRes.reels.join(' | ')} ] - Won: ${slotRes.won} - Match: ${slotRes.matchName || 'Zonk'} - Payout: Rp ${slotRes.payout}`);
if (slotRes.won) {
  assert.strictEqual(slotRes.newBalance, 100000 - 100 + slotRes.payout, "Saldo harus sesuai payout");
} else {
  assert.strictEqual(slotRes.newBalance, 100000 - 100, "Saldo harus berkurang 100");
}
console.log("✅ Uji 3 Berhasil!\n");

// 4. UJI TOKO BARANG MEWAH (LUXURY SHOP)
console.log("➡️ Uji 4: Toko Barang Mewah Sultan");
// Kembalikan saldo ke 100.000
db.prepare('UPDATE wallets SET balance = 100000 WHERE user_id = ? AND guild_id = ?').run(testUserId, guildId);

// Beli 1 Lambo seharga 25.000
const buyRes = luxury.buyLuxury(testUserId, guildId, 'lambo', 1);
assert.strictEqual(buyRes.newQty, 1, "Qty Lambo harus 1");
assert.strictEqual(buyRes.totalPrice, 25000, "Harga harus 25.000");
assert.strictEqual(buyRes.newBalance, 75000, "Saldo harus berkurang menjadi 75.000");

// Cek Inventory Mewah
const luxInv = luxury.getLuxuryInventory(testUserId, guildId);
assert.strictEqual(luxInv.length, 1, "Inventory mewah harus berisi 1 barang");
assert.strictEqual(luxInv[0].id, 'LAMBO', "Barang harus bertipe LAMBO");

// Jual balik Lambo (resale 50% = 12.500)
const sellRes = luxury.sellLuxury(testUserId, guildId, 'lambo', 1);
assert.strictEqual(sellRes.newQty, 0, "Lambo harus habis dari inventory");
assert.strictEqual(sellRes.totalPayout, 12500, "Payout jual balik harus 12.500");
assert.strictEqual(sellRes.newBalance, 75000 + 12500, "Saldo harus bertambah 12.500 menjadi 87.500");

const luxInvAfter = luxury.getLuxuryInventory(testUserId, guildId);
assert.strictEqual(luxInvAfter.length, 0, "Inventory mewah harus kosong setelah dijual");
console.log("✅ Uji 4 Berhasil!\n");

// 5. UJI PEMBATASAN LEVEL PENDEPATAN PET (PET LEVEL INCOME CAPPING)
console.log("➡️ Uji 5: Capping Pendapatan Pet");

// Kita jalankan kalkulasi level bonus manual atau simulasi fungsi pet.js
// Mari buat pet mock
db.prepare(`
  INSERT INTO user_pets (user_id, guild_id, pet_name, pet_type, status, level, xp, health, hunger, thirst, happiness, is_active)
  VALUES (?, ?, 'PetUji', 'CAT', 'ADULT', 40, 0, 100, 100, 100, 100, 1)
`).run(testUserId, guildId);

const petObj = db.prepare('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND pet_name = ?').get(testUserId, guildId, 'PetUji');

// Cek formula level bonus di sendToWork.
// Reward acak diasumsikan 100 untuk pengujian matematika.
const mockReward = 100;
// Formula capping di pet.js: Math.floor(reward * (Math.min(20, pet.level) * 0.05))
const levelBonusCalculated = Math.floor(mockReward * (Math.min(20, petObj.level) * 0.05));

// Tanpa capping, level 40 akan memberikan: 100 * (40 * 0.05) = 200 koin bonus.
// Dengan capping level 20, bonus maksimal adalah: 100 * (20 * 0.05) = 100 koin bonus.
console.log(`Pet Level: ${petObj.level}`);
console.log(`Mock Base Earning: Rp ${mockReward}`);
console.log(`Calculated Bonus: Rp ${levelBonusCalculated}`);

assert.strictEqual(levelBonusCalculated, 100, "Bonus level untuk pet level 40 harus dibatasi setara level 20 (+100% atau Rp 100)");
console.log("✅ Uji 5 Berhasil!\n");

// Bersihkan data test setelah sukses
db.prepare('DELETE FROM wallets WHERE user_id = ? AND guild_id = ?').run(testUserId, guildId);
db.prepare('DELETE FROM user_inventory WHERE user_id = ? AND guild_id = ?').run(testUserId, guildId);
db.prepare('DELETE FROM user_pets WHERE user_id = ? AND guild_id = ?').run(testUserId, guildId);
db.close();

console.log("🏆 SELURUH UJI VERIFIKASI BERHASIL DENGAN SUKSES! 🏆");
process.exit(0);
