const db = require('../stockmarket/database');
const bm = require('../stockmarket/blackmarket');
const robbery = require('../stockmarket/robbery');
const pet = require('../stockmarket/pet');

console.log('🏁 [Verification] Mengetes inisialisasi modul...');

try {
  // 1. Cek tabel user_inventory & kolom trait, last_breed_at
  const columnsUserPets = db.all("PRAGMA table_info(user_pets)");
  const hasTrait = columnsUserPets.some(col => col.name === 'trait');
  const hasLastBreedAt = columnsUserPets.some(col => col.name === 'last_breed_at');
  
  console.log(`✅ Kolom 'trait' di user_pets: ${hasTrait ? 'ADA' : 'TIDAK ADA'}`);
  console.log(`✅ Kolom 'last_breed_at' di user_pets: ${hasLastBreedAt ? 'ADA' : 'TIDAK ADA'}`);

  const tableInventory = db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='user_inventory'");
  console.log(`✅ Tabel 'user_inventory': ${tableInventory ? 'ADA' : 'TIDAK ADA'}`);

  // 2. Cek barang Black Market terdaftar
  console.log('\n🛍️ [Black Market Items]:');
  Object.keys(bm.BM_ITEMS).forEach(k => {
    const item = bm.BM_ITEMS[k];
    console.log(`- ${item.name} (${item.id}): Rp ${item.price} - ${item.desc}`);
  });

  // 3. Test data mockup
  const testUserId = 'test_user_123';
  const testPartnerId = 'test_partner_456';
  const testGuildId = 'test_guild_789';

  // Inisialisasi wallet dummy agar bisa transaksi
  db.run('INSERT OR REPLACE INTO wallets (user_id, guild_id, balance) VALUES (?, ?, 5000)', [testUserId, testGuildId]);
  db.run('INSERT OR REPLACE INTO wallets (user_id, guild_id, balance) VALUES (?, ?, 5000)', [testPartnerId, testGuildId]);

  console.log('\n💰 [Economy] Saldo dummy berhasil di-set: Rp 5000.');

  // Test Beli Black Market Item
  console.log('\n🛒 [Black Market] Mengetes pembelian Linggis (Lockpick)...');
  const buyRes = bm.buyItem(testUserId, testGuildId, 'lockpick', 1);
  console.log(`🎉 Sukses membeli: ${buyRes.item.name}, Total Harga: Rp ${buyRes.totalPrice}, Jumlah persediaan: x${buyRes.newQty}`);

  // Ambil Inventory
  const inv = bm.getInventory(testUserId, testGuildId);
  console.log('🎒 Persediaan kriminal saat ini:');
  inv.forEach(item => {
    console.log(`- ${item.name}: x${item.quantity}`);
  });

  // Test Konsumsi Item
  console.log('\n🧪 [Black Market] Mengetes konsumsi 1x Linggis...');
  const consumed = bm.consumeItem(testUserId, testGuildId, 'lockpick');
  console.log(`🛡️ Sukses konsumsi: ${consumed ? 'YA' : 'TIDAK'}, sisa qty: x${bm.getItemQty(testUserId, testGuildId, 'lockpick')}`);

  console.log('\n✨ SELURUH VERIFIKASI SINTAKS & INSTAN DATASE BERHASIL! ✨');
} catch (e) {
  console.error('❌ Terjadi kesalahan saat verifikasi:', e.message);
  process.exit(1);
}
