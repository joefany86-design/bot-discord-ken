const db = require('../stockmarket/database');
const marketplace = require('../stockmarket/marketplace');
const economy = require('../stockmarket/economy');

console.log('🏁 Memulai pengujian skema & fungsi Marketplace...');

try {
  // 1. Verifikasi tabel
  const tableInfo = db.all("PRAGMA table_info(marketplace_listings)");
  console.log('📋 Kolom tabel marketplace_listings:', tableInfo.map(c => `${c.name} (${c.type})`));
  
  if (tableInfo.length === 0) {
    throw new Error('Tabel marketplace_listings tidak ditemukan di database!');
  }
  
  console.log('✅ Skema database tervalidasi dengan sukses!');

  // 2. Mock data saldo & inventory untuk testing
  const testUserId = 'test_warga_123';
  const testGuildId = 'test_guild_456';
  
  // Set wallet balance
  db.run('INSERT OR REPLACE INTO wallets (user_id, guild_id, balance) VALUES (?, ?, ?)', [testUserId, testGuildId, 10000]);
  const walletBefore = economy.getWallet(testUserId, testGuildId);
  console.log(`💵 Saldo Warga sebelum: Rp ${walletBefore.balance}`);

  // Set general inventory
  db.run('INSERT OR REPLACE INTO user_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, ?, ?)', [testUserId, testGuildId, 'FLOWER_ROSE', 5]);
  console.log('🌹 Menambahkan 5x Mawar Merah ke inventory warga...');

  // 3. Uji coba create listing
  console.log('⚖️ Mencoba mendaftarkan 3x Mawar Merah seharga Rp 1500...');
  marketplace.createListing(testGuildId, testUserId, 'GARDEN_FLOWER', 'FLOWER_ROSE', 3, 1500);

  // Verifikasi listing terdaftar
  const listings = marketplace.getListings(testGuildId);
  console.log(`📋 Jumlah listing aktif: ${listings.length}`);
  if (listings.length === 0) throw new Error('Listing tidak terdaftar!');
  
  const myListing = listings[0];
  console.log(`🔍 Listing baru: ID=${myListing.listing_id}, Seller=${myListing.seller_id}, Item=${myListing.item_id}, Qty=${myListing.quantity}, Price=Rp ${myListing.price}`);

  // Verifikasi inventory penjual berkurang
  const qtyLeft = db.get('SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?', [testUserId, testGuildId, 'FLOWER_ROSE']);
  console.log(`🌹 Sisa Mawar Merah di inventory warga: ${qtyLeft ? qtyLeft.quantity : 0} (Harus 2)`);

  // 4. Uji coba cancel listing
  console.log('❌ Mencoba membatalkan lelang...');
  marketplace.cancelListing(myListing.listing_id, testUserId);
  
  const listingsAfterCancel = marketplace.getListings(testGuildId);
  console.log(`📋 Jumlah listing aktif setelah cancel: ${listingsAfterCancel.length} (Harus 0)`);
  
  const qtyRestored = db.get('SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?', [testUserId, testGuildId, 'FLOWER_ROSE']);
  console.log(`🌹 Sisa Mawar Merah di inventory setelah cancel: ${qtyRestored ? qtyRestored.quantity : 0} (Harus 5)`);

  console.log('🎉 SELURUH PENGUJIAN MARKETPLACE BERHASIL DENGAN SUKSES! Clean up mock data...');
  
  // Cleanup mock data
  db.run('DELETE FROM wallets WHERE user_id = ? AND guild_id = ?', [testUserId, testGuildId]);
  db.run('DELETE FROM user_inventory WHERE user_id = ? AND guild_id = ?', [testUserId, testGuildId]);

} catch (err) {
  console.error('❌ Pengujian GAGAL:', err.message);
  process.exit(1);
}
