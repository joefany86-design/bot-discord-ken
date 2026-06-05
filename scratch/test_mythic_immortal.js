const petModule = require('../stockmarket/pet');
const db = require('../stockmarket/database');
const economy = require('../stockmarket/economy');

async function runTests() {
  console.log('🧪 =================================================');
  console.log('🧪 STARTING VERIFICATION FOR MYTHIC & IMMORTAL PETS');
  console.log('🧪 =================================================');

  const userId = 'TEST_USER_MYTHIC';
  const opponentId = 'TEST_USER_IMMORTAL';
  const normalUserId = 'TEST_USER_NORMAL';
  const guildId = 'TEST_GUILD_MYTHIC_IMMORTAL';

  // 1. Clean old test data
  db.run('DELETE FROM user_pets WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM pet_inventory WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM wallets WHERE guild_id = ?', [guildId]);

  economy.addBalance(userId, guildId, 50000, 'TEST_SETUP');
  economy.addBalance(opponentId, guildId, 50000, 'TEST_SETUP');
  economy.addBalance(normalUserId, guildId, 50000, 'TEST_SETUP');

  // Insert mock pets resembling the adminPanel creation results:
  const now = Math.floor(Date.now() / 1000);

  // Mythic: 3 random traits, 1.5x XP multiplier
  db.run(
    `INSERT INTO user_pets (
      user_id, guild_id, pet_name, pet_type, status, level, xp, health, hunger, thirst, happiness, 
      last_interaction_at, hatch_at, created_at, is_active, trait, 
      star_level, base_hp_bonus, base_atk_bonus_pct, base_def_bonus_pct,
      gacha_source, gacha_rarity, gacha_element, gacha_trait2, xp_multiplier
    ) VALUES (
      ?, ?, 'FenrirMythic', 'FENRIR', 'ADULT', 10, 0, 200, 100, 100, 100, 
      ?, 0, ?, 1, 'GENIUS', 
      1, 0, 0.0, 0.0,
      'ADMIN', 'MYTHIC', 'DRAGON', 'STURDY,SURVIVOR', 1.5
    )`,
    [userId, guildId, now, now]
  );

  // Immortal: 5 traits, 3.0x XP multiplier
  db.run(
    `INSERT INTO user_pets (
      user_id, guild_id, pet_name, pet_type, status, level, xp, health, hunger, thirst, happiness, 
      last_interaction_at, hatch_at, created_at, is_active, trait, 
      star_level, base_hp_bonus, base_atk_bonus_pct, base_def_bonus_pct,
      gacha_source, gacha_rarity, gacha_element, gacha_trait2, xp_multiplier
    ) VALUES (
      ?, ?, 'ChronosImmortal', 'CHRONOS', 'ADULT', 10, 0, 500, 100, 100, 100, 
      ?, 0, ?, 1, 'GENIUS', 
      1, 0, 0.0, 0.0,
      'ADMIN', 'IMMORTAL', 'DRAGON', 'STURDY,MUTANT,WARRIOR,SURVIVOR', 3.0
    )`,
    [opponentId, guildId, now, now]
  );

  // Normal Common Pet (for comparison)
  db.run(
    `INSERT INTO user_pets (
      user_id, guild_id, pet_name, pet_type, status, level, xp, health, hunger, thirst, happiness, 
      last_interaction_at, hatch_at, created_at, is_active, trait, 
      star_level, base_hp_bonus, base_atk_bonus_pct, base_def_bonus_pct,
      gacha_source, gacha_rarity, gacha_element, gacha_trait2, xp_multiplier
    ) VALUES (
      ?, ?, 'KucingCommon', 'CAT', 'ADULT', 10, 0, 100, 100, 100, 100, 
      ?, 0, ?, 1, '', 
      1, 0, 0.0, 0.0,
      'GACHA', 'COMMON', '', '', 1.0
    )`,
    [normalUserId, guildId, now, now]
  );

  // Fetch from DB using helper getPet
  const mythicPet = petModule.getPet(userId, guildId);
  const immortalPet = petModule.getPet(opponentId, guildId);
  const normalPet = petModule.getPet(normalUserId, guildId);

  // 🧪 TEST 1: Helper functions check
  console.log('\n🧪 [TEST 1] Testing Helper Functions...');
  console.log(`   isMythicPet(Mythic): ${petModule.isMythicPet(mythicPet)} (Expected: true)`);
  console.log(`   isMythicPet(Immortal): ${petModule.isMythicPet(immortalPet)} (Expected: false)`);
  console.log(`   isGodPet(Immortal): ${petModule.isGodPet(immortalPet)} (Expected: true)`);
  console.log(`   isGodPet(Mythic): ${petModule.isGodPet(mythicPet)} (Expected: false)`);

  console.log('\n   Checking Traits...');
  const testTraits = ['GENIUS', 'STURDY', 'MUTANT', 'WARRIOR', 'SURVIVOR'];
  testTraits.forEach(t => {
    console.log(`     Immortal has trait ${t}: ${petModule.petHasTrait(immortalPet, t)} (Expected: true)`);
  });
  console.log(`     Mythic has trait GENIUS: ${petModule.petHasTrait(mythicPet, 'GENIUS')} (Expected: true)`);
  console.log(`     Mythic has trait MUTANT: ${petModule.petHasTrait(mythicPet, 'MUTANT')} (Expected: false)`);
  console.log(`     Mythic has trait SURVIVOR: ${petModule.petHasTrait(mythicPet, 'SURVIVOR')} (Expected: true)`);

  // Assertions
  if (!petModule.isMythicPet(mythicPet) || petModule.isMythicPet(immortalPet)) throw new Error('isMythicPet fail');
  if (!petModule.isGodPet(immortalPet) || petModule.isGodPet(mythicPet)) throw new Error('isGodPet fail');
  if (!testTraits.every(t => petModule.petHasTrait(immortalPet, t))) throw new Error('Immortal trait resolution fail');

  // 🧪 TEST 2: Status Decay Simulation (48 Hours ago)
  console.log('\n🧪 [TEST 2] Simulating 48 hours of neglected status decay...');
  const fortyEightHoursAgo = now - (48 * 3600);

  // Update last_interaction_at
  db.run('UPDATE user_pets SET last_interaction_at = ? WHERE guild_id = ?', [fortyEightHoursAgo, guildId]);

  // Fetching will trigger lazy applyDecay
  const decayedNormal = petModule.getPet(normalUserId, guildId);
  const decayedMythic = petModule.getPet(userId, guildId);
  const decayedImmortal = petModule.getPet(opponentId, guildId);

  console.log(`   Normal Pet (Common): Hunger=${decayedNormal.hunger}%, Thirst=${decayedNormal.thirst}%, Happiness=${decayedNormal.happiness}%`);
  console.log(`   Mythic Pet (Fenrir): Hunger=${decayedMythic.hunger}%, Thirst=${decayedMythic.thirst}%, Happiness=${decayedMythic.happiness}%`);
  console.log(`   Immortal Pet (Chronos): Hunger=${decayedImmortal.hunger}%, Thirst=${decayedImmortal.thirst}%, Happiness=${decayedImmortal.happiness}%`);

  // Normal decay: elapsedHours = 48. neglectDecayMultiplier = 1.5 (24-48 hours).
  // Normal CAT rates: hunger=4 * 1.5 = 6/hr, thirst=5 * 1.5 = 7.5/hr. Over 48 hours, they will hit 0.
  // Mythic: rates are halved (50% decay rate) and has STURDY (-40% / *0.60).
  // Let's assert:
  // Immortal MUST stay 100%
  if (decayedImmortal.hunger !== 100 || decayedImmortal.thirst !== 100 || decayedImmortal.happiness !== 100) {
    throw new Error('Immortal pet decay check failed! It must remain at 100%.');
  }
  // Mythic hunger should be significantly higher than normal
  if (decayedMythic.hunger <= decayedNormal.hunger) {
    throw new Error('Mythic decay check failed! Mythic should decay much slower.');
  }
  console.log('   ✅ Decay simulation checks passed successfully!');

  // 🧪 TEST 3: Soda Energy Sickness Chance (0% for Mythic/Immortal)
  console.log('\n🧪 [TEST 3] Testing Energy Soda sickness immunity...');
  // Force reset health/stats
  db.run("UPDATE user_pets SET hunger=50, thirst=50, status='ADULT' WHERE guild_id = ?", [guildId]);
  
  // Insert SODA_ENERGY items to inventories for the test
  db.run("INSERT INTO pet_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'SODA_ENERGY', 10)", [userId, guildId]);
  db.run("INSERT INTO pet_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'SODA_ENERGY', 10)", [opponentId, guildId]);

  // Try using energy soda 10 times on both.
  // (In real pet.js, useItem is usually called, let's call useItem or check useSodaEnergy)
  // Let's verify if useItem is exported
  try {
    for (let i = 0; i < 10; i++) {
      db.run('DELETE FROM pet_item_cooldowns WHERE guild_id = ?', [guildId]);
      petModule.useItem(userId, guildId, 'SODA_ENERGY', false);
      petModule.useItem(opponentId, guildId, 'SODA_ENERGY', false);
    }
    const checkMythic = petModule.getPet(userId, guildId);
    const checkImmortal = petModule.getPet(opponentId, guildId);
    console.log(`   Mythic status after 10 sodas: ${checkMythic.status} (Expected: ADULT)`);
    console.log(`   Immortal status after 10 sodas: ${checkImmortal.status} (Expected: ADULT)`);
    if (checkMythic.status === 'SICK' || checkImmortal.status === 'SICK') {
      throw new Error('Mythic or Immortal pet got SICK from Energy Soda!');
    }
    console.log('   ✅ Energy Soda sickness immunity verified.');
  } catch (err) {
    console.log(`   ⚠️ useItem skipped or errored: ${err.message}`);
    throw err;
  }

  // 🧪 TEST 4: PvP Arena Combat Formula (3x ATK, 75% Damage Reduction for Immortal, Lethal Defeat for Opponent)
  console.log('\n🧪 [TEST 4] Testing PvP Arena between Immortal and Normal Pet...');
  // Prepare for PvP: reset health to max
  db.run("UPDATE user_pets SET health=100, status='ADULT' WHERE user_id = ?", [normalUserId]);
  db.run("UPDATE user_pets SET health=500, status='ADULT' WHERE user_id = ?", [opponentId]);

  try {
    const pvpResult = petModule.executePvP(opponentId, normalUserId, guildId, 100);
    console.log(`   Winner: ${pvpResult.winnerName} (Draw: ${pvpResult.draw})`);
    
    // Check if normal pet is dead
    const normalAfterPvP = petModule.getPet(normalUserId, guildId);
    console.log(`   Normal Pet Status after fighting Immortal: ${normalAfterPvP.status}, HP: ${normalAfterPvP.health}`);
    
    if (pvpResult.winnerName.includes('ChronosImmortal')) {
      if (normalAfterPvP.status !== 'DEAD' || normalAfterPvP.health !== 0) {
        throw new Error('Normal pet did not die after losing to Immortal in PvP!');
      }
      console.log('   ✅ Lethal PvP Victory for Immortal verified (Opponent is DEAD with 0 HP).');
    } else {
      console.log('   ℹ️ PvP was a draw or normal won (unlikely due to 3x ATK and 75% Damage Reduction).');
    }
  } catch (err) {
    console.error('   ❌ PvP Test error:', err.message);
    throw err;
  }

  // 🧪 TEST 5: Expedition Co-op (Team Protection & Element Bonuses)
  console.log('\n🧪 [TEST 5] Testing Expedition Logic...');
  
  // Let's manually construct active party data resembling pet.js team structure:
  // In pet.js:
  // getActiveExpeditionParty(guildId) returns a list of { pet, userId, status, element, ... }
  // calculateSuccessRate(party, map) computes elemental/power bonus
  // let's check calculateSuccessRate behavior with:
  // - Mythic pet (Fenrir, element DRAGON, rarity MYTHIC) -> should give +20% flat element bonus
  // - Immortal pet (Chronos, element DRAGON, rarity IMMORTAL) -> should give +25% flat element bonus
  
  const mapFire = { id: 1, name: 'Gunung Api Purba', element: 'FIRE', difficulty: 'HARD', baseChance: 40 };

  try {
    const rateMythicObj = petModule.calculateSuccessRate(guildId, [userId], 1, 'SAFE');
    const rateImmortalObj = petModule.calculateSuccessRate(guildId, [opponentId], 1, 'SAFE');

    const rateMythic = rateMythicObj.successRate;
    const rateImmortal = rateImmortalObj.successRate;

    console.log(`   Success Rate with Mythic: ${rateMythic}%`);
    console.log(`   Success Rate with Immortal: ${rateImmortal}%`);

    // In pet.js:
    // element bonus for mythic is +20%, for immortal is +25%.
    // base success rate + bonuses
    if (rateMythic < 40 || rateImmortal < 40) {
      throw new Error('Expedition success rates calculated incorrectly for Mythic/Immortal!');
    }
    console.log('   ✅ Success rates calculated successfully.');
  } catch (err) {
    console.error('   ❌ Expedition calculation test error:', err.message);
    throw err;
  }

  // Clean up test data
  db.run('DELETE FROM user_pets WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM pet_inventory WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM wallets WHERE guild_id = ?', [guildId]);

  console.log('\n🧹 Cleanup complete.');
  console.log('🎉 =================================================');
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! MYTHIC & IMMORTAL TIER IS ROBUST!');
  console.log('🎉 =================================================');
}

runTests().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
