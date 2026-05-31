const db = require('../stockmarket/database');

const guildId = 'TEST_GUILD';
const userA = 'TEST_USER_A'; // Kaya: Rp 2.500 total
const userB = 'TEST_USER_B'; // Miskin: Rp 700 total
const userC = 'TEST_USER_C'; // Menengah: Rp 1.900 total

function assert(condition, message) {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
  console.log(`✅ OK: ${message}`);
}

async function runTests() {
  console.log('🏁 Memulai Pengujian Fitur Bansos Massal Berdasarkan Total Kekayaan...\n');

  // Bersihkan data lama
  db.run('DELETE FROM wallets WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM bank_savings WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM portfolios WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM transactions WHERE guild_id = ?', [guildId]);

  // Setup saldo awal
  // User A (Dompet = 1500, Bank = 1000, Total = 2500)
  db.run('INSERT INTO wallets (user_id, guild_id, balance) VALUES (?, ?, ?)', [userA, guildId, 1500]);
  db.run('INSERT INTO bank_savings (user_id, guild_id, balance, last_interest_at) VALUES (?, ?, ?, 0)', [userA, guildId, 1000]);

  // User B (Dompet = 500, Bank = 200, Total = 700)
  db.run('INSERT INTO wallets (user_id, guild_id, balance) VALUES (?, ?, ?)', [userB, guildId, 500]);
  db.run('INSERT INTO bank_savings (user_id, guild_id, balance, last_interest_at) VALUES (?, ?, ?, 0)', [userB, guildId, 200]);

  // User C (Dompet = 1800, Bank = 100, Total = 1900)
  db.run('INSERT INTO wallets (user_id, guild_id, balance) VALUES (?, ?, ?)', [userC, guildId, 1800]);
  db.run('INSERT INTO bank_savings (user_id, guild_id, balance, last_interest_at) VALUES (?, ?, ?, 0)', [userC, guildId, 100]);

  // Simulasi variabel input Bansos
  const wealthLimit = 2000;
  const bansosAmount = 2000;

  console.log(`Menjalankan Bansos: Kekayaan < Rp ${wealthLimit}, nominal bansos Rp ${bansosAmount}...\n`);

  let receiverCount = 0;
  let totalDistributed = 0;

  db.transaction(() => {
    // Jalankan query agregat kekayaan total
    const members = db.all(
      `SELECT w.user_id, 
              (w.balance + COALESCE(bs.balance, 0) + COALESCE(pv.portfolio_value, 0)) as total_wealth
       FROM wallets w
       LEFT JOIN bank_savings bs ON w.user_id = bs.user_id AND w.guild_id = bs.guild_id
       LEFT JOIN (
         SELECT p.user_id, p.guild_id, SUM(p.shares * s.current_price) as portfolio_value
         FROM portfolios p
         JOIN stocks s ON p.channel_id = s.channel_id AND p.guild_id = s.guild_id
         GROUP BY p.user_id, p.guild_id
       ) pv ON w.user_id = pv.user_id AND w.guild_id = pv.guild_id
       WHERE w.guild_id = ?`,
      [guildId]
    );

    for (const m of members) {
      if (m.total_wealth < wealthLimit) {
        db.run(
          'UPDATE wallets SET balance = balance + ?, total_earned = total_earned + ? WHERE user_id = ? AND guild_id = ?',
          [bansosAmount, bansosAmount, m.user_id, guildId]
        );

        db.run(
          'INSERT INTO transactions (user_id, guild_id, type, amount) VALUES (?, ?, ?, ?)',
          [m.user_id, guildId, 'ADMIN_GIVE', bansosAmount]
        );

        receiverCount++;
        totalDistributed += bansosAmount;
      }
    }
  })();

  // Verifikasi hasil
  assert(receiverCount === 2, 'Jumlah warga penerima bansos adalah 2 (User B & C)');
  assert(totalDistributed === 4000, 'Total dana bansos terdistribusi adalah Rp 4.000');

  // User A (Kaya) saldo harus tetap sama
  const walletA = db.get('SELECT balance FROM wallets WHERE user_id = ? AND guild_id = ?', [userA, guildId]);
  assert(walletA.balance === 1500, 'Saldo User A tetap Rp 1.500 (Tidak menerima bansos)');

  // User B (Miskin) saldo bertambah Rp 2000 menjadi Rp 2500
  const walletB = db.get('SELECT balance FROM wallets WHERE user_id = ? AND guild_id = ?', [userB, guildId]);
  assert(walletB.balance === 2500, 'Saldo User B bertambah menjadi Rp 2.500');

  // User C (Menengah) saldo bertambah Rp 2000 menjadi Rp 3800
  const walletC = db.get('SELECT balance FROM wallets WHERE user_id = ? AND guild_id = ?', [userC, guildId]);
  assert(walletC.balance === 3800, 'Saldo User C bertambah menjadi Rp 3.800');

  // Cek pencatatan log transaksi
  const transLogs = db.all('SELECT * FROM transactions WHERE guild_id = ? AND type = ?', [guildId, 'ADMIN_GIVE']);
  assert(transLogs.length === 2, 'Terdapat 2 log transaksi bansos terdaftar');

  console.log('\n🎉 Pengujian Bansos Massal BERHASIL!');
}

runTests().catch(err => {
  console.error('\n❌ Pengujian gagal dengan error:');
  console.error(err);
  process.exit(1);
});
