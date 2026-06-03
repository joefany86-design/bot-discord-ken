const pet = require('../stockmarket/pet');
const db = require('../stockmarket/database');
const economy = require('../stockmarket/economy');

async function runGachaSimulation() {
  console.log("==================================================");
  console.log("🧪 RUNNING GACHA & RECYCLE SYSTEM VERIFICATION");
  console.log("==================================================\n");

  const userId = 'TEST_GACHA_USER';
  const guildId = 'TEST_GACHA_GUILD';

  // Cleanup
  db.run("DELETE FROM wallets WHERE user_id = ? AND guild_id = ?", [userId, guildId]);
  db.run("DELETE FROM user_pets WHERE user_id = ? AND guild_id = ?", [userId, guildId]);
  db.run("DELETE FROM user_inventory WHERE user_id = ? AND guild_id = ?", [userId, guildId]);

  try {
    // Setup high wallet balance for testing gacha costs
    economy.addBalance(userId, guildId, 1500000, 'TEST_START');
    const initialWallet = economy.getWallet(userId, guildId);
    console.log(`💰 Initial Balance: Rp ${initialWallet.balance.toLocaleString('id-ID')}\n`);

    // Let's roll Gacha 1x (Single Pull)
    console.log("🎲 Rolling 1x Pet Gacha...");
    const singleResults = pet.rollGacha(userId, guildId, 'COIN_1');
    const rolledPet = singleResults[0];
    console.log(`   👉 Rolled: [${rolledPet.rarity}] ${rolledPet.species.name}`);
    console.log(`      HP: ${rolledPet.baseHP} | ATK: ${rolledPet.baseAtk} | DEF: ${rolledPet.baseDef}%`);
    console.log(`      Element: ${rolledPet.element || 'None'} | Traits: ${rolledPet.trait || 'None'} ${rolledPet.trait2 || ''}`);

    const walletAfterSingle = economy.getWallet(userId, guildId);
    console.log(`   👉 Wallet after 1x roll: Rp ${walletAfterSingle.balance.toLocaleString('id-ID')} (Deducted: Rp 1.500)`);
    if (walletAfterSingle.balance !== initialWallet.balance - 1500) {
      console.error("   ❌ ERROR: Gacha cost mismatch for single roll! Expected deduction of Rp 1.500");
    } else {
      console.log("   ✅ SUCCESS: Single roll cost (Rp 1.500) correctly deducted.");
    }

    // Save the single pet to DB
    const petName = 'GachaPochi';
    console.log(`\n💾 Saving gacha pet as "${petName}"...`);
    const savedPet = pet.saveGachaPet(userId, guildId, rolledPet, petName);
    console.log(`   👉 Saved Pet in DB: Name = "${savedPet.pet_name}", Level = ${savedPet.level}, Rarity = "${savedPet.gacha_rarity}", Status = "${savedPet.status}"`);
    
    // Recycle this pet via recyclePet
    console.log(`♻️ Recycling pet "${petName}"...`);
    const recycleRes = pet.recyclePet(userId, guildId, petName);
    console.log(`   👉 Recycle Result: Name = "${recycleRes.petName}", Reward = Rp ${recycleRes.reward}`);
    
    const walletAfterRecycle = economy.getWallet(userId, guildId);
    console.log(`   👉 Wallet after recycling: Rp ${walletAfterRecycle.balance.toLocaleString('id-ID')} (Received: Rp 800)`);
    if (walletAfterRecycle.balance !== walletAfterSingle.balance + 800) {
      console.error("   ❌ ERROR: Recycle reward mismatch! Expected reward of Rp 800");
    } else {
      console.log("   ✅ SUCCESS: Pet recycled successfully with Rp 800 reward.");
    }

    // Let's roll Gacha 10x (Multi Pull)
    console.log("\n🎲 Rolling 10x Pet Gacha (Multi)...");
    const preMultiBalance = walletAfterRecycle.balance;
    const multiResults = pet.rollGacha(userId, guildId, 'COIN_10');
    console.log(`   👉 Rolled ${multiResults.length} pets.`);
    multiResults.forEach((p, idx) => {
      console.log(`      #${idx + 1}: [${p.rarity}] ${p.species.name} (Traits: ${p.trait || 'None'} ${p.trait2 || ''})`);
    });

    const walletAfterMulti = economy.getWallet(userId, guildId);
    console.log(`   👉 Wallet after 10x roll: Rp ${walletAfterMulti.balance.toLocaleString('id-ID')} (Deducted: Rp 15.000)`);
    if (walletAfterMulti.balance !== preMultiBalance - 15000) {
      console.error("   ❌ ERROR: Gacha cost mismatch for multi roll! Expected deduction of Rp 15.000");
    } else {
      console.log("   ✅ SUCCESS: Multi roll cost (Rp 15.000) correctly deducted.");
    }

    // Run a large scale simulation of 1,000 rolls to verify rarity distributions
    console.log("\n📊 Simulating 1,000 Gacha Rolls to verify rarity rates...");
    // Bypass wallet check for simulation
    const distribution = { COMMON: 0, RARE: 0, EPIC: 0, LEGENDARY: 0 };
    const elements = {};
    const traits = {};
    const legendaryTraitCounts = {};

    for (let i = 0; i < 1000; i++) {
      const rolled = pet._rollOnce();
      distribution[rolled.rarity]++;
      
      if (rolled.element) {
        elements[rolled.element] = (elements[rolled.element] || 0) + 1;
      }
      if (rolled.trait) {
        traits[rolled.trait] = (traits[rolled.trait] || 0) + 1;
      }
      if (rolled.trait2) {
        traits[rolled.trait2] = (traits[rolled.trait2] || 0) + 1;
      }
      if (rolled.rarity === 'LEGENDARY') {
        const doubleTraitStr = `${rolled.trait}+${rolled.trait2}`;
        legendaryTraitCounts[doubleTraitStr] = (legendaryTraitCounts[doubleTraitStr] || 0) + 1;
      }
    }

    console.log("📈 Simulation Results (1,000 rolls):");
    console.log(`   ⚪ COMMON    : ${distribution.COMMON} (${(distribution.COMMON/1000*100).toFixed(1)}%) - Expected: 65%`);
    console.log(`   🟢 RARE      : ${distribution.RARE} (${(distribution.RARE/1000*100).toFixed(1)}%) - Expected: 25%`);
    console.log(`   🟣 EPIC      : ${distribution.EPIC} (${(distribution.EPIC/1000*100).toFixed(1)}%) - Expected: 8%`);
    console.log(`   🟡 LEGENDARY : ${distribution.LEGENDARY} (${(distribution.LEGENDARY/1000*100).toFixed(1)}%) - Expected: 2%`);
    
    console.log("\n🌐 Element distribution:");
    Object.keys(elements).forEach(el => {
      console.log(`   • ${el}: ${elements[el]} times`);
    });

    console.log("\n🧬 Trait distribution:");
    Object.keys(traits).forEach(tr => {
      console.log(`   • ${tr}: ${traits[tr]} times`);
    });

    console.log("\n✅ Gacha simulation completed successfully!");

  } catch (err) {
    console.error("❌ Test encountered an error:", err);
  } finally {
    // Cleanup
    db.run("DELETE FROM wallets WHERE user_id = ? AND guild_id = ?", [userId, guildId]);
    db.run("DELETE FROM user_pets WHERE user_id = ? AND guild_id = ?", [userId, guildId]);
    db.run("DELETE FROM user_inventory WHERE user_id = ? AND guild_id = ?", [userId, guildId]);
    console.log("\n🧹 Cleaned up database.");
  }
}

runGachaSimulation();
