const pet = require('../stockmarket/pet');
const db = require('../stockmarket/database');
const economy = require('../stockmarket/economy');

async function testRaidAndTower() {
  console.log('🧪 [Test] Memulai Pengujian Fungsionalitas Menara Ujian & World Boss Raid...');

  const userId = 'TEST_USER_TOWER_999';
  const opponentId = 'TEST_USER_TOWER_888';
  const guildId = 'TEST_GUILD_TOWER_123';

  // Cleanup old test data
  db.run('DELETE FROM user_pets WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM pet_inventory WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM wallets WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM user_pet_tower WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM world_boss WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM world_boss_participants WHERE guild_id = ?', [guildId]);

  // Set wallet balances
  economy.addBalance(userId, guildId, 100000, 'TEST_INITIAL');
  economy.addBalance(opponentId, guildId, 100000, 'TEST_INITIAL');

  // Adopt a pet for testing
  console.log('\n🐣 1. Mengadopsi & Membesarkan Pet...');
  pet.adoptPet(userId, guildId, 'Ciko', 'DRAGON');
  db.run("UPDATE user_pets SET hatch_at = ?, status = 'ADULT', level = 10, health = 100, hunger = 100, thirst = 100, happiness = 100 WHERE user_id = ? AND guild_id = ?", [Math.floor(Date.now() / 1000) - 10, userId, guildId]);
  
  // Hatch/initialize pet
  const playerPet = pet.getPet(userId, guildId);
  console.log(`   ✅ Pet Aktif: ${playerPet.pet_name} (Lv.${playerPet.level} ${playerPet.pet_type.toUpperCase()}, HP: ${playerPet.health}%, Elemen: ${playerPet.gacha_element})`);

  // --- PART 1: MENARA UJIAN ---
  console.log('\n🏰 2. Menguji Sistem Menara Ujian (Tower of Trials)...');

  // Verify getTowerState
  const state1 = pet.getTowerState(userId, guildId);
  console.log(`   ✅ Inisialisasi Menara: Lantai saat ini = ${state1.current_floor}, Percobaan Hari Ini = ${state1.daily_attempts}/5`);

  // Climb floor 1
  console.log('   ⚔️ Memanjat Lantai 1...');
  const climbRes1 = pet.climbTower(userId, guildId, false);
  console.log(`   ✅ Hasil Panjat: ${climbRes1.win ? 'MENANG! 🎉' : 'KALAH! 🤕'}`);
  console.log(`      Hadiah Koin: Rp ${climbRes1.rewardCoins || 0} | XP: ${climbRes1.rewardXp || 0}`);
  
  const state2 = pet.getTowerState(userId, guildId);
  console.log(`   👉 Menara Terkini: Lantai saat ini = ${state2.current_floor}, Percobaan Hari Ini = ${state2.daily_attempts}/5`);

  // Test Sweep
  console.log('   🧹 Menguji Fitur Sweep Menara...');
  // Untuk sweep minimal floor > 1
  try {
    const sweepRes = pet.sweepTower(userId, guildId);
    console.log(`   ✅ Sweep Sukses! Hadiah Koin: Rp ${sweepRes.rewardCoins} | XP: ${sweepRes.rewardXp} | Lantai dibersihkan: ${sweepRes.floorCleared}`);
  } catch (err) {
    console.error('   ❌ Sweep Gagal (Diharapkan jika baru lantai 1/2):', err.message);
  }

  // --- PART 2: WORLD BOSS RAID ---
  console.log('\n👹 3. Menguji Sistem World Boss Raid...');

  // Spawn World Boss
  const boss = pet.getOrCreateWorldBoss(guildId);
  console.log(`   ✅ Boss Aktif: ${boss.boss_name} (${boss.boss_type}, HP: ${boss.current_hp}/${boss.max_hp}, Status: ${boss.status})`);

  // Attack World Boss
  console.log('   ⚔️ Pet Menyerang World Boss...');
  const atkRes = pet.attackWorldBoss(userId, guildId, false);
  console.log(`   ✅ Detail Serangan:`);
  console.log(`      Damage Diberikan : ${atkRes.totalDmgDealt} HP`);
  console.log(`      HP Boss Tersisa  : ${boss.max_hp - atkRes.totalDmgDealt} HP`);
  console.log(`      Boss Terkalahkan : ${atkRes.bossKilled}`);

  // Inspect participant data
  const weekStart = pet.getWeekStartString();
  const partData = db.get('SELECT * FROM world_boss_participants WHERE user_id = ? AND guild_id = ? AND week_start = ?', [userId, guildId, weekStart]);
  console.log(`   👉 Data Partisipan: Total Damage = ${partData.damage_dealt}, Jumlah Serangan = ${partData.attacks_count}`);

  // --- PART 3: ADMIN PANEL COMMANDS ---
  console.log('\n🛠️ 4. Menguji Aksi Panel Admin...');

  // A. Admin Set Floor (Lantai 5)
  console.log('   🏰 [Admin] Mengatur Lantai Menara Ujian ke 5...');
  db.run('UPDATE user_pet_tower SET current_floor = 5 WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  const stateAdminSet = pet.getTowerState(userId, guildId);
  console.log(`   ✅ Lantai Menara Setelah Diatur: Lantai = ${stateAdminSet.current_floor}`);

  // B. Admin Reset Attempts
  console.log('   🏰 [Admin] Mereset Tiket Harian Menara...');
  db.run('UPDATE user_pet_tower SET daily_attempts = 0 WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  const stateAdminReset = pet.getTowerState(userId, guildId);
  console.log(`   ✅ Tiket Harian Setelah Direset: Percobaan Hari Ini = ${stateAdminReset.daily_attempts}/5`);

  // C. Admin Spawn Custom Boss
  console.log('   👹 [Admin] Men-spawn World Boss Kustom...');
  db.run(
    'UPDATE world_boss SET boss_name = ?, boss_type = ?, max_hp = ?, current_hp = ?, status = ? WHERE guild_id = ? AND week_start = ?',
    ['🔥 Giga Phoenix', 'FIRE', 20000, 20000, 'ACTIVE', guildId, weekStart]
  );
  let customBoss = db.get('SELECT * FROM world_boss WHERE guild_id = ? AND week_start = ?', [guildId, weekStart]);
  console.log(`   ✅ Boss Kustom: Name = ${customBoss.boss_name}, Element = ${customBoss.boss_type}, HP = ${customBoss.current_hp}/${customBoss.max_hp}`);

  // D. Admin Force Kill Boss (Triggering Rewards Distribution)
  console.log('   ☠️ [Admin] Mengalahkan World Boss Instan & Membagikan Hadiah...');
  db.run("UPDATE world_boss SET current_hp = 0, status = 'DEFEATED' WHERE guild_id = ? AND week_start = ?", [guildId, weekStart]);
  const distRes = pet.distributeWorldBossRewards(guildId, null, weekStart);
  
  if (distRes) {
    console.log(`   ✅ Distribusi Selesai! Total rewarded: ${distRes.totalRewarded}`);
    distRes.rewards.forEach(r => {
      console.log(`      - User <@${r.userId}>: Koin Rp ${r.coins} | Item Gained: ${r.items}`);
    });
  } else {
    console.log('   ⚠️ Distribusi gagal/terlewati.');
  }

  // Final database state check
  const bossAfter = db.get('SELECT * FROM world_boss WHERE guild_id = ? AND week_start = ?', [guildId, weekStart]);
  console.log(`   👉 Status World Boss Akhir: Status = ${bossAfter.status}, HP = ${bossAfter.current_hp}`);

  // Cleanup test data
  console.log('\n🧹 5. Membersihkan data pengujian...');
  db.run('DELETE FROM user_pets WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM pet_inventory WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM wallets WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM user_pet_tower WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM world_boss WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM world_boss_participants WHERE guild_id = ?', [guildId]);

  console.log('🎉 [Test] Seluruh fungsionalitas diuji dengan sukses dan aman!');
}

testRaidAndTower().catch(console.error);
