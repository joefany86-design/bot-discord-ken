const pet = require('../stockmarket/pet');
const db = require('../stockmarket/database');
const economy = require('../stockmarket/economy');

async function test() {
  console.log('🧪 [Test] Memulai Pengujian Fungsionalitas Sistem Pet...');

  const userId = 'TEST_USER_999';
  const opponentId = 'TEST_OPPONENT_888';
  const guildId = 'TEST_GUILD_123';

  // Bersihkan data lama jika ada
  db.run('DELETE FROM user_pets WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM pet_inventory WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM wallets WHERE guild_id = ?', [guildId]);

  // Set saldo awal
  console.log('💰 1. Menyiapkan Saldo Uang Kedua Pemain...');
  economy.addBalance(userId, guildId, 10000, 'TEST_GIFT');
  economy.addBalance(opponentId, guildId, 10000, 'TEST_GIFT');

  const uW = economy.getWallet(userId, guildId);
  const oW = economy.getWallet(opponentId, guildId);
  console.log(`   👉 Challenger Balance: Rp ${uW.balance}`);
  console.log(`   👉 Opponent Balance: Rp ${oW.balance}`);

  // 1. Uji Adopsi
  console.log('\n🐣 2. Menguji Adopsi Pet Telur Baru...');
  try {
    const res = pet.adoptPet(userId, guildId, 'Ciko', 'DRAGON');
    console.log(`   ✅ Sukses Adopsi: ${res.pet_name} the ${res.pet_type} (Status: ${res.status}, Menetas s/d: ${new Date(res.hatch_at * 1000).toLocaleString()})`);
  } catch (err) {
    console.error('   ❌ Gagal Adopsi:', err.message);
  }

  // 2. Uji Penetasan (Hatch)
  console.log('\n🐣 3. Menguji Mekanik Penetasan Telur...');
  // Manipulasi hatch_at di database ke masa lampau
  db.run('UPDATE user_pets SET hatch_at = ? WHERE user_id = ? AND guild_id = ?', [Math.floor(Date.now() / 1000) - 10, userId, guildId]);
  
  const hatchedPet = pet.getPet(userId, guildId);
  console.log(`   ✅ Status Setelah Hatch: ${hatchedPet.pet_name} (Fase: ${hatchedPet.status}, Level: ${hatchedPet.level})`);

  // 3. Uji Lazy Decay
  console.log('\n📉 4. Menguji Mekanik Lazy Decay Status Pet...');
  // Manipulasi last_interaction_at ke 5 jam yang lalu
  const fiveHoursAgo = Math.floor(Date.now() / 1000) - (5 * 3600);
  db.run('UPDATE user_pets SET last_interaction_at = ? WHERE user_id = ? AND guild_id = ?', [fiveHoursAgo, userId, guildId]);
  
  const decayedPet = pet.getPet(userId, guildId);
  console.log(`   ✅ Status Setelah Decay (5 jam berlalu):`);
  console.log(`      HP          : ${decayedPet.health}%`);
  console.log(`      Kenyangan   : ${decayedPet.hunger}%`);
  console.log(`      Hidrasi     : ${decayedPet.thirst}%`);
  console.log(`      Kebahagiaan : ${decayedPet.happiness}%`);

  // 4. Uji Pet Shop & Care Item Supplies
  console.log('\n💊 5. Menguji Pembelian Item & Perawatan (Feed / Cure)...');
  try {
    // Beri makan & minum instan (auto buy)
    const feedRes = pet.useItem(userId, guildId, 'FOOD_BASIC', true);
    console.log(`   ✅ Sukses Beri Makan (Auto-Buy): Kenyangan Pet menjadi ${feedRes.pet.hunger}%`);

    const drinkRes = pet.useItem(userId, guildId, 'WATER', true);
    console.log(`   ✅ Sukses Beri Minum (Auto-Buy): Hidrasi Pet menjadi ${drinkRes.pet.thirst}%`);

    const playRes = pet.playWithPet(userId, guildId);
    console.log(`   ✅ Sukses Ajak Bermain: Kebahagiaan Pet menjadi ${playRes.happiness}%`);
  } catch (err) {
    console.error('   ❌ Gagal Perawatan:', err.message);
  }

  // 5. Uji Bekerja (Work)
  console.log('\n💼 6. Menguji Mekanik Bekerja (Work)...');
  try {
    const workRes = pet.sendToWork(userId, guildId);
    console.log(`   ✅ Sukses Kerja: Dapat upah Rp ${workRes.reward} (Bonus Level: Rp ${workRes.levelBonus})`);
    console.log(`      Kenyangan Pet Baru: ${workRes.pet.hunger}%`);
  } catch (err) {
    console.error('   ❌ Gagal Kerja:', err.message);
  }

  // 6. Uji Berburu (Hunt) - Harus di-upgrade level ke 10+ agar bisa berburu
  console.log('\n🏹 7. Menguji Mekanik Berburu (Hunt)...');
  db.run("UPDATE user_pets SET level = 10, status = 'ADULT' WHERE user_id = ? AND guild_id = ?", [userId, guildId]);
  try {
    const huntRes = pet.sendToHunt(userId, guildId);
    let dropInfo = huntRes.dropItem ? `(Jackpot Drop: ${huntRes.dropItem.name})` : '(No drop)';
    console.log(`   ✅ Sukses Berburu (Fase Dewasa): Dapat koin Rp ${huntRes.reward} ${dropInfo}`);
    console.log(`      HP Pet Baru: ${huntRes.pet.health}%`);
  } catch (err) {
    console.error('   ❌ Gagal Berburu:', err.message);
  }

  // 7. Uji PvP Arena
  console.log('\n⚔️ 8. Menguji Mekanik PvP Arena Taruhan...');
  // Buat pet lawan yang valid
  pet.adoptPet(opponentId, guildId, 'Viper', 'DRAGON');
  db.run("UPDATE user_pets SET hatch_at = ?, status = 'BABY' WHERE user_id = ? AND guild_id = ?", [Math.floor(Date.now() / 1000) - 10, opponentId, guildId]);
  pet.getPet(opponentId, guildId); // Hatch opponent pet
  db.run("UPDATE user_pets SET level = 10, status = 'ADULT' WHERE user_id = ? AND guild_id = ?", [opponentId, guildId]);

  try {
    const pvpRes = pet.executePvP(userId, opponentId, guildId, 1000);
    if (pvpRes.draw) {
      console.log(`   ✅ Hasil PvP: SERI / DRAW!`);
    } else {
      console.log(`   ✅ Hasil PvP: PEMENANG ADALAH ${pvpRes.winnerName}!`);
      console.log(`      Total Hadiah Dibawa Pulang: Rp ${pvpRes.prizePool} (Pajak: Rp ${pvpRes.tax})`);
    }
    console.log(`   📝 Battle Logs:`);
    pvpRes.logs.forEach(log => console.log(`      ${log}`));
  } catch (err) {
    console.error('   ❌ Gagal PvP Arena:', err.message);
  }

  // Bersihkan data setelah pengujian
  db.run('DELETE FROM user_pets WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM pet_inventory WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM wallets WHERE guild_id = ?', [guildId]);
  console.log('\n🧹 9. Data Pengujian Dibersihkan dari Database.');
  console.log('🎉 [Test] Pengujian Selesai Sukses Flawless!');
}

test();
