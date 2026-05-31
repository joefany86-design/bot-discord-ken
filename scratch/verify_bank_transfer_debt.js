const db = require('../stockmarket/database');
const bank = require('../stockmarket/bank');
const economy = require('../stockmarket/economy');

const guildId = 'TEST_GUILD';
const userA = 'TEST_USER_A';
const userB = 'TEST_USER_B';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
  console.log(`✅ OK: ${message}`);
}

async function runTests() {
  console.log('🏁 Memulai Pengujian Fitur Transfer & Repay Friend Debt...\n');

  // Clean up existing test data
  db.run('DELETE FROM wallets WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM bank_savings WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM bail_debts WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM transactions WHERE guild_id = ?', [guildId]);

  // Setup initial balance
  // User A: wallet = Rp 1000, bank = Rp 5000
  // User B: wallet = Rp 0, bank = Rp 0
  db.run('INSERT INTO wallets (user_id, guild_id, balance) VALUES (?, ?, ?)', [userA, guildId, 1000]);
  db.run('INSERT INTO wallets (user_id, guild_id, balance) VALUES (?, ?, ?)', [userB, guildId, 0]);
  
  db.run('INSERT INTO bank_savings (user_id, guild_id, balance, last_interest_at) VALUES (?, ?, ?, 0)', [userA, guildId, 5000]);
  db.run('INSERT INTO bank_savings (user_id, guild_id, balance, last_interest_at) VALUES (?, ?, ?, 0)', [userB, guildId, 0]);

  console.log('=== TEST 1: Transfer Tabungan (Savings Transfer) ===');
  // User A transfer Rp 2000 to User B
  // Default tax rate is 10%, so tax = Rp 200, net = Rp 1800
  const transRes = bank.transferSavings(userA, userB, guildId, '2000');
  
  assert(transRes.amount === 2000, 'Nominal kotor transfer adalah Rp 2.000');
  assert(transRes.tax === 200, 'Pajak transfer 10% adalah Rp 200');
  assert(transRes.netAmount === 1800, 'Nominal bersih diterima adalah Rp 1.800');
  assert(transRes.senderSavingsBalance === 3000, 'Tabungan Pengirim (A) sisa Rp 3.000');
  assert(transRes.receiverSavingsBalance === 1800, 'Tabungan Penerima (B) bertambah Rp 1.800');

  // Cek database langsung
  const dbA = db.get('SELECT balance FROM bank_savings WHERE user_id = ? AND guild_id = ?', [userA, guildId]);
  const dbB = db.get('SELECT balance FROM bank_savings WHERE user_id = ? AND guild_id = ?', [userB, guildId]);
  assert(dbA.balance === 3000, 'Database A tabungan sinkron');
  assert(dbB.balance === 1800, 'Database B tabungan sinkron');

  console.log('\n=== TEST 2: Bayar Hutang Teman (Bail Debt Repay) ===');
  // Buat hutang teman: A punya hutang ke B sebesar Rp 500
  db.run('INSERT INTO bail_debts (guild_id, debtor_id, creditor_id, amount) VALUES (?, ?, ?, ?)', [guildId, userA, userB, 500]);
  
  // Cicil Rp 300 dari dompet A (dompet A saat ini Rp 1000)
  const repayRes1 = bank.repayFriendDebt(userA, userB, guildId, '300');
  assert(repayRes1.amountPaid === 300, 'Koin dibayarkan Rp 300');
  assert(repayRes1.remainingDebt === 200, 'Sisa hutang Rp 200');
  assert(repayRes1.isFullyPaid === false, 'Hutang belum lunas sepenuhnya');
  assert(repayRes1.walletBalance === 700, 'Dompet A sisa Rp 700');

  const walletB1 = economy.getWallet(userB, guildId);
  assert(walletB1.balance === 300, 'Dompet B bertambah Rp 300');

  const dbDebt1 = db.get('SELECT amount FROM bail_debts WHERE guild_id = ? AND debtor_id = ? AND creditor_id = ?', [guildId, userA, userB]);
  assert(dbDebt1.amount === 200, 'Sisa hutang di database Rp 200');

  // Lunasi sisa hutang menggunakan kata kunci 'all'
  const repayRes2 = bank.repayFriendDebt(userA, userB, guildId, 'all');
  assert(repayRes2.amountPaid === 200, 'Koin dibayarkan Rp 200');
  assert(repayRes2.remainingDebt === 0, 'Sisa hutang Rp 0');
  assert(repayRes2.isFullyPaid === true, 'Hutang lunas sepenuhnya');
  assert(repayRes2.walletBalance === 500, 'Dompet A sisa Rp 500');

  const walletB2 = economy.getWallet(userB, guildId);
  assert(walletB2.balance === 500, 'Dompet B bertambah Rp 500');

  const dbDebt2 = db.get('SELECT * FROM bail_debts WHERE guild_id = ? AND debtor_id = ? AND creditor_id = ?', [guildId, userA, userB]);
  assert(!dbDebt2, 'Data hutang telah dihapus dari database karena lunas');

  console.log('\n🎉 Semua pengujian backend BERHASIL!');
}

runTests().catch(err => {
  console.error('\n❌ Pengujian gagal dengan error:');
  console.error(err);
  process.exit(1);
});
