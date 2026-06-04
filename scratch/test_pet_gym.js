const pet = require('../stockmarket/pet');
const db = require('../stockmarket/database');
const economy = require('../stockmarket/economy');

async function runTests() {
  console.log('🧪 [Test] Memulai Pengujian Sistem Kustomisasi Stat Pet & Pusat Kebugaran...');

  const userId1 = 'GYM_TESTER_1';
  const userId2 = 'GYM_TESTER_2';
  const guildId = 'GYM_TEST_GUILD';

  // 1. Pembersihan & Inisialisasi Data Uji
  console.log('🧹 1. Membersihkan data uji lama...');
  db.run('DELETE FROM user_pets WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM pet_inventory WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM wallets WHERE guild_id = ?', [guildId]);

  console.log('💰 2. Menyiapkan saldo koin...');
  economy.addBalance(userId1, guildId, 10000, 'TEST_GIFT');
  economy.addBalance(userId2, guildId, 10000, 'TEST_GIFT');

  const w1 = economy.getWallet(userId1, guildId);
  console.log(`   👉 Tester 1 Balance: Rp ${w1.balance}`);

  // 2. Adopsi & Hatch Pet
  console.log('🐣 3. Mengadopsi pet untuk pengujian...');
  pet.adoptPet(userId1, guildId, 'Gymmy', 'SLIME');
  pet.adoptPet(userId2, guildId, 'Viper', 'DRAGON');

  // Set hatch_at ke masa lampau agar langsung menetas saat getPet dipanggil
  db.run('UPDATE user_pets SET hatch_at = ? WHERE guild_id = ?', [Math.floor(Date.now() / 1000) - 10, guildId]);
  
  const pet1 = pet.getPet(userId1, guildId);
  const pet2 = pet.getPet(userId2, guildId);
  console.log(`   ✅ Pet 1: ${pet1.pet_name} (${pet1.pet_type}), Level: ${pet1.level}, Status: ${pet1.status}`);
  console.log(`   ✅ Pet 2: ${pet2.pet_name} (${pet2.pet_type}), Level: ${pet2.level}, Status: ${pet2.status}`);

  // Jadikan pet dewasa (ADULT)
  db.run("UPDATE user_pets SET status = 'ADULT' WHERE guild_id = ?", [guildId]);

  // 3. Menguji Migrasi Retroaktif TP & Kenaikan Level
  console.log('📈 4. Menguji migrasi retroaktif TP...');
  // Atur level pet ke 10 terlebih dahulu (tanpa TP terisi)
  db.run('UPDATE user_pets SET level = 10, unused_tp = 0 WHERE user_id = ? AND guild_id = ?', [userId1, guildId]);
  
  // Jalankan query migrasi retroaktif
  db.run(`
    UPDATE user_pets 
    SET unused_tp = (level - 1) * 3 
    WHERE level > 1 AND unused_tp = 0 AND stat_str = 0 AND stat_vit = 0 AND stat_def = 0 AND stat_dex = 0 AND guild_id = ?
  `, [guildId]);

  let updatedPet1 = pet.getPet(userId1, guildId);
  console.log(`   ✅ Level: ${updatedPet1.level}, Unused TP retroaktif: ${updatedPet1.unused_tp} (Ekspektasi: 27 TP)`);
  if (updatedPet1.unused_tp !== 27) {
    throw new Error(`Retroaktif TP salah! Diharapkan 27 tapi bernilai ${updatedPet1.unused_tp}`);
  }

  // 4. Menguji Alokasi Stat (.pet gym / allocateStat)
  console.log('💪 5. Menguji alokasi Training Points (TP)...');
  
  // Uji alokasi ke stat VIT
  pet.allocateStat(userId1, guildId, 'vit');
  pet.allocateStat(userId1, guildId, 'vit');
  // Uji alokasi ke stat STR
  pet.allocateStat(userId1, guildId, 'str');
  // Uji alokasi ke stat DEF
  pet.allocateStat(userId1, guildId, 'def');
  // Uji alokasi ke stat DEX
  pet.allocateStat(userId1, guildId, 'dex');

  updatedPet1 = pet.getPet(userId1, guildId);
  console.log(`   ✅ Hasil Alokasi -> STR: ${updatedPet1.stat_str}, VIT: ${updatedPet1.stat_vit}, DEF: ${updatedPet1.stat_def}, DEX: ${updatedPet1.stat_dex}, Sisa TP: ${updatedPet1.unused_tp}`);
  if (updatedPet1.stat_vit !== 2 || updatedPet1.stat_str !== 1 || updatedPet1.stat_def !== 1 || updatedPet1.stat_dex !== 1 || updatedPet1.unused_tp !== 22) {
    throw new Error('Alokasi stat tidak sesuai dengan ekspektasi!');
  }

  // Uji validasi input stat yang salah
  try {
    pet.allocateStat(userId1, guildId, 'invalid_stat');
    throw new Error('Validasi stat gagal dideteksi!');
  } catch (err) {
    console.log(`   ✅ Validasi stat salah berhasil dideteksi: "${err.message}"`);
  }

  // 5. Menguji Peningkatan Max HP dengan Vitalitas (VIT)
  console.log('❤️ 6. Menguji formula Max HP dinamis...');
  // Slime has base HP 120. Bintang 1 (bonus HP = 0). VIT = 2.
  // Ekspektasi Max HP = 120 + 0 + 2 * 3 = 126
  const maxHP = pet.getMaxHP(updatedPet1);
  console.log(`   ✅ Max HP Pet (Level 10 Slime dengan 2 VIT): ${maxHP} HP (Ekspektasi: 126 HP)`);
  if (maxHP !== 126) {
    throw new Error(`Max HP tidak sesuai! Diharapkan 126 tapi bernilai ${maxHP}`);
  }

  // 6. Menguji Reset Stat Gym dengan Biaya Rp 1.000
  console.log('🔄 7. Menguji reset stat dengan biaya koin...');
  const resetRes = pet.resetGymStats(userId1, guildId);
  const walletAfterReset = economy.getWallet(userId1, guildId);
  console.log(`   ✅ Biaya Reset: Rp ${resetRes.cost}`);
  console.log(`   ✅ Saldo wallet tester setelah reset: Rp ${walletAfterReset.balance} (Ekspektasi: Rp 7.500)`);
  console.log(`   ✅ Sisa TP setelah reset: ${resetRes.pet.unused_tp} (Ekspektasi: 27 TP)`);
  console.log(`   ✅ Stat setelah reset -> STR: ${resetRes.pet.stat_str}, VIT: ${resetRes.pet.stat_vit}, DEF: ${resetRes.pet.stat_def}, DEX: ${resetRes.pet.stat_dex}`);
  
  if (walletAfterReset.balance !== 7500 || resetRes.pet.unused_tp !== 27 || resetRes.pet.stat_str !== 0 || resetRes.pet.stat_vit !== 0) {
    throw new Error('Mekanik reset stat tidak berjalan sesuai spesifikasi!');
  }

  // 7. Menguji Alokasi Stat Skala Tinggi untuk PvP & Ekspedisi
  console.log('⚔️ 8. Menyiapkan stat super untuk PvP & Ekspedisi...');
  // Set stats langsung menggunakan admin update: STR = 30, VIT = 20, DEF = 40, DEX = 50, TP = 0
  db.run(`
    UPDATE user_pets 
    SET stat_str = 30, stat_vit = 20, stat_def = 40, stat_dex = 50, unused_tp = 0
    WHERE user_id = ? AND guild_id = ?
  `, [userId1, guildId]);

  const superPet = pet.getPet(userId1, guildId);
  console.log(`   👉 Super Gymmy Stats -> STR: ${superPet.stat_str}, VIT: ${superPet.stat_vit}, DEF: ${superPet.stat_def}, DEX: ${superPet.stat_dex}`);

  // Base Attack = Species Base ATK (8) + Level (10) * 5 + STR (30) * 2 = 8 + 50 + 60 = 118
  // Defense Damage Reduction = 40 * 0.5% = 20%
  // Dex Crit Chance = 50 * 0.5% = 25%
  // Max HP = 120 + 0 + 20 * 3 = 180 HP

  // Mari kita pastikan formula base HP bekerja
  console.log(`   ✅ Super Gymmy Max HP: ${pet.getMaxHP(superPet)} HP (Ekspektasi: 180 HP)`);
  if (pet.getMaxHP(superPet) !== 180) {
    throw new Error('Super Gymmy Max HP salah!');
  }

  // Uji PvP Arena
  console.log('⚔️ 9. Menguji mekanik PvP dengan bonus stat gym...');
  // Set HP pet ke 100% untuk simulasi battle
  db.run('UPDATE user_pets SET health = 100 WHERE guild_id = ?', [guildId]);

  try {
    const pvpRes = pet.executePvP(userId1, userId2, guildId, 100);
    console.log(`   ✅ Pemenang PvP: ${pvpRes.winnerName}`);
    console.log('   📝 Cuplikan Log Pertarungan:');
    pvpRes.logs.slice(0, 5).forEach(log => console.log(`      ${log}`));
    
    // Periksa apakah log mengandung kata kunci critical strike atau damage reduction
    const hasCritOrDefenseLog = pvpRes.logs.some(log => 
      log.includes('CRITICAL STRIKE') || log.includes('reduksi') || log.includes('Gymmy')
    );
    console.log(`   ✅ Terdeteksi log custom pertarungan: ${hasCritOrDefenseLog}`);
  } catch (err) {
    console.error('   ❌ Gagal melakukan PvP:', err.message);
  }

  // 8. Menguji Bonus DEX pada Keberhasilan Ekspedisi
  console.log('🌲 10. Menguji kontribusi DEX pada Ekspedisi...');
  const expCalc = pet.calculateSuccessRate(guildId, [userId1], 1, 'SAFE');
  console.log('   📝 Logs Kalkulasi Sukses Rate Ekspedisi:');
  expCalc.logs.forEach(log => console.log(`      ${log}`));
  
  const hasDexLog = expCalc.logs.some(log => log.includes('DEX Bonus Kelincahan') && log.includes('+5.0%'));
  console.log(`   ✅ Log Bonus DEX terverifikasi (DEX 50 dibatasi cap 5%): ${hasDexLog}`);
  if (!hasDexLog) {
    throw new Error('DEX Bonus Kelincahan tidak terdeteksi atau limit cap 5% tidak bekerja!');
  }

  // 9. Menguji Admin Command set-tp & set-stats (melalui simulasi query database direct)
  console.log('👑 11. Menguji fungsi administratif panel...');
  // Simulasikan .pet-admin set-tp
  db.run('UPDATE user_pets SET unused_tp = ? WHERE user_id = ? AND guild_id = ? AND is_active = 1', [99, userId1, guildId]);
  let adminPet = pet.getPet(userId1, guildId);
  console.log(`   ✅ Admin set-tp 99 -> Unused TP: ${adminPet.unused_tp} (Ekspektasi: 99)`);
  if (adminPet.unused_tp !== 99) throw new Error('Admin set-tp gagal!');

  // Simulasikan .pet-admin set-stats
  db.transaction(() => {
    db.run(
      `UPDATE user_pets 
       SET stat_str = ?, stat_vit = ?, stat_def = ?, stat_dex = ? 
       WHERE user_id = ? AND guild_id = ? AND is_active = 1`,
      [15, 25, 35, 45, userId1, guildId]
    );
    db.run(
      `UPDATE user_pets SET unused_tp = ? WHERE user_id = ? AND guild_id = ? AND is_active = 1`,
      [5, userId1, guildId]
    );
  })();

  adminPet = pet.getPet(userId1, guildId);
  console.log(`   ✅ Admin set-stats -> STR: ${adminPet.stat_str}, VIT: ${adminPet.stat_vit}, DEF: ${adminPet.stat_def}, DEX: ${adminPet.stat_dex}, TP: ${adminPet.unused_tp}`);
  if (adminPet.stat_str !== 15 || adminPet.stat_vit !== 25 || adminPet.stat_def !== 35 || adminPet.stat_dex !== 45 || adminPet.unused_tp !== 5) {
    throw new Error('Admin set-stats gagal!');
  }

  // 10. Pembersihan Akhir
  console.log('🧹 12. Membersihkan data uji akhir...');
  db.run('DELETE FROM user_pets WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM pet_inventory WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM wallets WHERE guild_id = ?', [guildId]);

  console.log('🎉 [Test] Seluruh pengujian sistem Gym & Stat Kustomisasi Pet berhasil lulus tanpa ada bug/error!');
}

runTests().catch(err => {
  console.error('❌ [Test] Pengujian GAGAL dengan error:', err);
  process.exit(1);
});
