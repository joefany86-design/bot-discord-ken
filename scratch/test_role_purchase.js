const database = require('../stockmarket/database');
const economy = require('../stockmarket/economy');

const dummyUserId = 'test_user_123';
const dummyGuildId = 'test_guild_456';
const mockPrice = 1500;

console.log('🏁 Memulai Tes Transaksi Pembelian Role...');

try {
  // 1. Bersihkan data dummy lama jika ada
  database.run('DELETE FROM shop_items WHERE role_id = ?', ['test_role_abc']);
  database.run('DELETE FROM wallets WHERE user_id = ? AND guild_id = ?', [dummyUserId, dummyGuildId]);

  // 2. Buat item role baru di shop_items dengan stok terbatas
  database.run(`
    INSERT INTO shop_items (guild_id, role_id, role_name, price, tier, stock, is_gacha, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [dummyGuildId, 'test_role_abc', 'Test Prestige Role', mockPrice, 'EPIC', 5, 0, 'Role untuk uji coba otomatis']);

  const item = database.get('SELECT * FROM shop_items WHERE role_id = ? AND guild_id = ?', ['test_role_abc', dummyGuildId]);
  console.log('✅ Mock role berhasil dibuat:', item);

  // 3. Buat wallet dummy dengan saldo koin yang cukup
  database.run(`
    INSERT INTO wallets (user_id, guild_id, balance)
    VALUES (?, ?, ?)
  `, [dummyUserId, dummyGuildId, 5000]);

  const walletBefore = economy.getWallet(dummyUserId, dummyGuildId);
  console.log(`💵 Saldo awal dompet: Rp ${walletBefore.balance}`);

  // 4. Jalankan logika transaksi pembelian role
  console.log('🔄 Menjalankan transaksi pembelian role...');
  database.transaction(() => {
    economy.subtractBalance(dummyUserId, dummyGuildId, item.price, 'SHOP_BUY', null);
    if (item.stock !== -1) {
      database.run('UPDATE shop_items SET stock = stock - 1 WHERE id = ? AND guild_id = ?', [item.id, dummyGuildId]);
    }
  })();

  // 5. Verifikasi saldo dompet setelah transaksi
  const walletAfter = economy.getWallet(dummyUserId, dummyGuildId);
  console.log(`💵 Saldo akhir dompet: Rp ${walletAfter.balance}`);
  const expectedBalance = 5000 - mockPrice;
  if (walletAfter.balance !== expectedBalance) {
    throw new Error(`Gagal: Saldo tidak sesuai! Diharapkan Rp ${expectedBalance}, tetapi didapat Rp ${walletAfter.balance}`);
  }
  console.log('✅ Saldo berhasil dikurangi dengan benar!');

  // 6. Verifikasi sisa stok role setelah transaksi
  const itemAfter = database.get('SELECT * FROM shop_items WHERE id = ?', [item.id]);
  console.log(`📦 Sisa stok role: ${itemAfter.stock}`);
  if (itemAfter.stock !== 4) {
    throw new Error(`Gagal: Stok tidak berkurang! Diharapkan 4, tetapi didapat ${itemAfter.stock}`);
  }
  console.log('✅ Stok role berhasil berkurang dengan benar!');

  // 7. Bersihkan data dummy
  database.run('DELETE FROM shop_items WHERE id = ?', [item.id]);
  database.run('DELETE FROM wallets WHERE user_id = ? AND guild_id = ?', [dummyUserId, dummyGuildId]);
  console.log('🧹 Data uji coba dibersihkan.');

  console.log('🎉 SELURUH PENGUJIAN DATABASE TRANSAKSI PEMBELIAN ROLE BERHASIL!');
} catch (error) {
  console.error('❌ Terjadi kesalahan saat pengujian:', error.message);
  process.exit(1);
}
