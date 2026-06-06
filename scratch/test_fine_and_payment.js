const db = require('../stockmarket/database');
const economy = require('../stockmarket/economy');
const bank = require('../stockmarket/bank');
const assert = require('assert');

async function runTests() {
  console.log('🧪 Memulai Pengujian Pilihan Sumber Pembayaran & Sistem Denda Terpadu...\n');

  const userId = 'TEST_USER_FINE_123';
  const guildId = 'TEST_GUILD_FINE_456';

  // 1. Reset data pengujian
  db.run('DELETE FROM wallets WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  db.run('DELETE FROM bank_savings WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  db.run('DELETE FROM transactions WHERE user_id = ? AND guild_id = ?', [userId, guildId]);

  console.log('📝 1. Inisialisasi Saldo...');
  // Set wallet ke Rp 5.000 dan bank ke Rp 10.000
  economy.addBalance(userId, guildId, 5000, 'TEST_DEPOSIT');
  
  // Set tabungan bank secara langsung atau via bank module
  db.run('INSERT INTO bank_savings (user_id, guild_id, balance, last_interest_at) VALUES (?, ?, ?, 0)', [userId, guildId, 10000]);

  let w = economy.getWallet(userId, guildId);
  let s = bank.getSavings(userId, guildId);
  console.log(`   👉 Dompet: Rp ${w.balance}`);
  console.log(`   👉 Bank: Rp ${s.balance}`);
  assert.strictEqual(w.balance, 5000, 'Saldo dompet awal harus Rp 5.000');
  assert.strictEqual(s.balance, 10000, 'Saldo bank awal harus Rp 10.000');
  console.log('   ✅ Inisialisasi Sukses!\n');

  console.log('🛒 2. Uji Pembelian dengan Dompet (pocket)...');
  economy.subtractBalance(userId, guildId, 2000, 'BUY_ITEM_TEST', null, 'pocket');
  w = economy.getWallet(userId, guildId);
  s = bank.getSavings(userId, guildId);
  console.log(`   👉 Dompet: Rp ${w.balance} (sisa)`);
  console.log(`   👉 Bank: Rp ${s.balance}`);
  assert.strictEqual(w.balance, 3000, 'Dompet harus bersisa Rp 3.000');
  assert.strictEqual(s.balance, 10000, 'Bank harus tetap Rp 10.000');
  console.log('   ✅ Uji Pembelian Dompet Sukses!\n');

  console.log('🛒 3. Uji Pembelian dengan Bank (bank)...');
  economy.subtractBalance(userId, guildId, 4000, 'BUY_ITEM_TEST', null, 'bank');
  w = economy.getWallet(userId, guildId);
  s = bank.getSavings(userId, guildId);
  console.log(`   👉 Dompet: Rp ${w.balance}`);
  console.log(`   👉 Bank: Rp ${s.balance} (sisa)`);
  assert.strictEqual(w.balance, 3000, 'Dompet harus tetap Rp 3.000');
  assert.strictEqual(s.balance, 6000, 'Bank harus bersisa Rp 6.000');
  console.log('   ✅ Uji Pembelian Bank Sukses!\n');

  console.log('💸 4. Uji deductFine - Kasus Dompet Cukup...');
  // Denda Rp 2.000, dompet ada Rp 3.000. Harus memotong dompet saja.
  let fineRes = economy.deductFine(userId, guildId, 2000, 'FINE_TEST');
  w = economy.getWallet(userId, guildId);
  s = bank.getSavings(userId, guildId);
  console.log(`   👉 Hasil Denda: Terpotong Dompet=Rp ${fineRes.walletDeducted}, Terpotong Bank=Rp ${fineRes.bankDeducted}`);
  console.log(`   👉 Dompet Baru: Rp ${w.balance}`);
  console.log(`   👉 Bank Baru: Rp ${s.balance}`);
  assert.strictEqual(fineRes.walletDeducted, 2000, 'Denda dompet harus Rp 2.000');
  assert.strictEqual(fineRes.bankDeducted, 0, 'Denda bank harus Rp 0');
  assert.strictEqual(w.balance, 1000, 'Dompet harus sisa Rp 1.000');
  assert.strictEqual(s.balance, 6000, 'Bank harus tetap Rp 6.000');
  console.log('   ✅ Uji deductFine Dompet Cukup Sukses!\n');

  console.log('💸 5. Uji deductFine - Kasus Dompet Kurang, Potong Bank...');
  // Denda Rp 3.000, dompet ada Rp 1.000, sisa Rp 2.000 harus dipotong dari bank.
  fineRes = economy.deductFine(userId, guildId, 3000, 'FINE_TEST');
  w = economy.getWallet(userId, guildId);
  s = bank.getSavings(userId, guildId);
  console.log(`   👉 Hasil Denda: Terpotong Dompet=Rp ${fineRes.walletDeducted}, Terpotong Bank=Rp ${fineRes.bankDeducted}`);
  console.log(`   👉 Dompet Baru: Rp ${w.balance}`);
  console.log(`   👉 Bank Baru: Rp ${s.balance}`);
  assert.strictEqual(fineRes.walletDeducted, 1000, 'Denda dompet harus Rp 1.000');
  assert.strictEqual(fineRes.bankDeducted, 2000, 'Denda bank harus Rp 2.000');
  assert.strictEqual(w.balance, 0, 'Dompet harus sisa Rp 0');
  assert.strictEqual(s.balance, 4000, 'Bank harus sisa Rp 4.000');
  console.log('   ✅ Uji deductFine Potong Bank Sukses!\n');

  console.log('💸 6. Uji deductFine - Kasus Total Saldo Kurang...');
  // Denda Rp 10.000, dompet Rp 0, bank Rp 4.000. Harus memotong habis saldo tersisa Rp 4.000.
  fineRes = economy.deductFine(userId, guildId, 10000, 'FINE_TEST');
  w = economy.getWallet(userId, guildId);
  s = bank.getSavings(userId, guildId);
  console.log(`   👉 Hasil Denda: Terpotong Dompet=Rp ${fineRes.walletDeducted}, Terpotong Bank=Rp ${fineRes.bankDeducted}`);
  console.log(`   👉 Dompet Baru: Rp ${w.balance}`);
  console.log(`   👉 Bank Baru: Rp ${s.balance}`);
  assert.strictEqual(fineRes.walletDeducted, 0, 'Denda dompet harus Rp 0');
  assert.strictEqual(fineRes.bankDeducted, 4000, 'Denda bank harus Rp 4.000');
  assert.strictEqual(w.balance, 0, 'Dompet harus Rp 0');
  assert.strictEqual(s.balance, 0, 'Bank harus Rp 0');
  console.log('   ✅ Uji deductFine Total Saldo Kurang Sukses!\n');

  // Bersihkan data setelah pengujian selesai
  db.run('DELETE FROM wallets WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  db.run('DELETE FROM bank_savings WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  db.run('DELETE FROM transactions WHERE user_id = ? AND guild_id = ?', [userId, guildId]);

  console.log('🎉 SELURUH PENGUJIAN BERHASIL PASSED!');
}

runTests().catch(err => {
  console.error('❌ Pengujian Gagal:', err);
  process.exit(1);
});
