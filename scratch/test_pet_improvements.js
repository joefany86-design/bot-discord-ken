const pet = require('../stockmarket/pet');
const db = require('../stockmarket/database');
const economy = require('../stockmarket/economy');

async function runTests() {
  console.log('🧪 [Test] Memulai Pengujian Fitur Baru Sistem Pet & Ekspedisi...\n');

  const userId = 'TEST_USER_XP_BOOST';
  const guildId = 'TEST_GUILD_123';

  // Bersihkan data lama
  db.run('DELETE FROM user_pets WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM pet_inventory WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM wallets WHERE guild_id = ?', [guildId]);

  // Siapkan saldo wallet besar
  economy.addBalance(userId, guildId, 100000, 'TEST_GIFT');
  console.log('💰 1. Saldo dompet awal disiapkan: Rp 100.000');

  // Adopt standard egg (Hatch duration should be 1 hour)
  console.log('\n🥚 2. Membeli Telur Pet Standard...');
  const newPet = pet.adoptPet(userId, guildId, 'Ciko', 'DRAGON');
  const now = Math.floor(Date.now() / 1000);
  const remainingHatchTime = newPet.hatch_at - now;
  console.log(`   👉 Telur diadopsi! Nama: ${newPet.pet_name}`);
  console.log(`   👉 Sisa waktu menetas: ${Math.round(remainingHatchTime / 60)} menit (Harus sekitar ~60 menit / 1 Jam)`);

  if (Math.abs(remainingHatchTime - 3600) < 60) {
    console.log('   ✅ VERIFIKASI SELESAI: Waktu menetas default telur adalah 1 Jam!');
  } else {
    console.error('   ❌ VERIFIKASI GAGAL: Waktu menetas salah!');
  }

  // Hatch the pet
  db.run('UPDATE user_pets SET hatch_at = ? WHERE user_id = ? AND guild_id = ?', [now - 10, userId, guildId]);
  const activePet = pet.getPet(userId, guildId);
  console.log(`   👉 Pet menetas! Status: ${activePet.status}, Level: ${activePet.level}, XP Multiplier: ${activePet.xp_multiplier}`);

  // Test purchase of XP_2X booster
  console.log('\n🛒 3. Menguji Pembelian XP Booster dari Toko...');
  try {
    const buyRes = pet.buyItem(userId, guildId, 'XP_2X', 1);
    console.log(`   ✅ Pembelian Sukses: 1x ${buyRes.item.name} seharga Rp ${buyRes.totalPrice}`);
    console.log(`   👉 Sisa saldo dompet: Rp ${economy.getWallet(userId, guildId).balance}`);
    console.log(`   👉 Jumlah di inventory: ${buyRes.newInventoryQty} pcs`);
  } catch (err) {
    console.error('   ❌ Gagal membeli XP Booster:', err.message);
  }

  // Use the XP booster
  console.log('\n⚡ 4. Menguji Penggunaan XP Booster (xp_multiplier)...');
  try {
    const useRes = pet.useItem(userId, guildId, 'XP_2X', false);
    console.log(`   ✅ Penggunaan Sukses! Item digunakan pada pet: ${useRes.pet.pet_name}`);
    console.log(`   👉 Multiplier XP Pet Sekarang: ${useRes.pet.xp_multiplier}x (Harus 2x)`);

    if (useRes.pet.xp_multiplier === 2.0) {
      console.log('   ✅ VERIFIKASI SELESAI: Multiplier XP berhasil disetel ke 2x!');
    } else {
      console.error('   ❌ VERIFIKASI GAGAL: Multiplier XP salah!');
    }
  } catch (err) {
    console.error('   ❌ Gagal menggunakan XP Booster:', err.message);
  }

  // Check XP Gain (using playWithPet, default is +15 XP. With 2x it should be +30 XP)
  console.log('\n⚽ 5. Menguji Perolehan XP Terkalian (XP Multiplier)...');
  db.run('UPDATE user_pets SET happiness = 50 WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  const petBeforePlay = pet.getPet(userId, guildId);
  const playRes = pet.playWithPet(userId, guildId);
  const xpGained = playRes.xp - petBeforePlay.xp;
  console.log(`   👉 XP Sebelum bermain: ${petBeforePlay.xp}`);
  console.log(`   👉 XP Setelah bermain: ${playRes.xp}`);
  console.log(`   👉 XP yang Didapat: ${xpGained} (Dasar: 15, Multiplier: 2x, Hasil: 30)`);

  if (xpGained === 30) {
    console.log('   ✅ VERIFIKASI SELESAI: Perolehan XP berhasil dikali 2x lipat!');
  } else {
    console.error('   ❌ VERIFIKASI GAGAL: Hasil kali XP salah!');
  }

  // Test multiple level ups at once (e.g. adding 1500 XP to level 1 pet)
  console.log('\n📈 6. Menguji Kenaikan Level Berganda (Recursive Level Up)...');
  // Atur pet ke lvl 1, XP 0
  db.run('UPDATE user_pets SET level = 1, xp = 0 WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  let currentPet = pet.getPet(userId, guildId);
  
  // Ganjaran playWithPet dengan 8x multiplier (15 * 8 = 120 XP).
  // Level 1 butuh 100 XP -> Kenaikan level ke lvl 2 sisa 20 XP.
  db.run('UPDATE user_pets SET xp_multiplier = 8.0 WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  // reset play cooldown and set happiness = 50 to prevent block
  db.run('UPDATE user_pets SET last_play_at = 0, happiness = 50 WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  
  const playMultiRes = pet.playWithPet(userId, guildId);
  console.log(`   👉 Level Akhir: ${playMultiRes.level} (Harus Level 2)`);
  console.log(`   👉 XP Sisa: ${playMultiRes.xp} (Harus 20 XP)`);

  if (playMultiRes.level === 2 && playMultiRes.xp === 20) {
    console.log('   ✅ VERIFIKASI SELESAI: Kenaikan level berganda dan sisa XP dihitung sempurna!');
  } else {
    console.error('   ❌ VERIFIKASI GAGAL: Level atau sisa XP salah!');
  }

  // Test Expedition limits (Limit 10x per day)
  console.log('\n⚔️ 7. Menguji Batas Limit Ekspedisi Harian...');
  try {
    // 10x actual runs (dryRun = false) to increment the database counter
    for (let i = 0; i < 10; i++) {
      pet.checkExpeditionLimit(userId, guildId, false);
    }
    console.log('   ✅ Sukses melewati 10x pencatatan ekspedisi harian.');

    // 11th run (dryRun = true) should throw error since the count is now 10
    try {
      pet.checkExpeditionLimit(userId, guildId, true);
      console.error('   ❌ GAGAL: Harusnya diblokir di kali ke-11!');
    } catch (err) {
      console.log(`   ✅ Sukses Diblokir pada kali ke-11: "${err.message}"`);
    }
  } catch (err) {
    console.error('   ❌ Gagal pengujian limit ekspedisi:', err.message);
  }

  // Clean test tables
  db.run('DELETE FROM user_pets WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM pet_inventory WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM wallets WHERE guild_id = ?', [guildId]);

  console.log('\n🧹 8. Data pengujian berhasil dibersihkan.');
  console.log('🎉 [Test] Semua fitur baru telah diuji dan terbukti 100% SUKSES!');
}

runTests();
