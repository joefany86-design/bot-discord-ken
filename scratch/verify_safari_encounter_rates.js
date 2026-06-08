const pet = require('../stockmarket/pet');
const safari = require('../stockmarket/safari');

console.log('🧪 [Test] Memulai verifikasi statistik tingkat kemunculan (encounter rates) Pet Safari...\n');

// Mock BIOMES to match safari.js configuration
const BIOMES = {
  forest: ['SLIME', 'CAT', 'GOLEM'],
  volcano: ['DRAGON', 'PHOENIX', 'BEHEMOTH'],
  abyss: ['TURTLE', 'LEVIATHAN'],
  mountain: ['BEHEMOTH', 'ARCHDRAGON']
};

const SIMULATION_RUNS = 100000;

for (const [biomeId, speciesList] of Object.entries(BIOMES)) {
  console.log(`\n=== Biome: ${biomeId.toUpperCase()} (Total Simulasi: ${SIMULATION_RUNS.toLocaleString('id-ID')} Kali) ===`);
  const counts = {};
  
  // Calculate expected weights
  let totalWeight = 0;
  const weights = {};
  speciesList.forEach(specId => {
    const specInfo = pet.GACHA_SPECIES[specId];
    const weight = pet.GACHA_RATES[specInfo.rarity] || 0.65;
    weights[specId] = weight;
    totalWeight += weight;
    counts[specId] = 0;
  });
  
  // Run simulation
  for (let s = 0; s < SIMULATION_RUNS; s++) {
    let roll = Math.random() * totalWeight;
    let selectedId = speciesList[0];
    for (let i = 0; i < speciesList.length; i++) {
      const specId = speciesList[i];
      roll -= weights[specId];
      if (roll <= 0) {
        selectedId = specId;
        break;
      }
    }
    counts[selectedId]++;
  }

  // Print results
  for (const specId of speciesList) {
    const count = counts[specId];
    const pct = (count / SIMULATION_RUNS * 100).toFixed(2);
    const expectedPct = (weights[specId] / totalWeight * 100).toFixed(2);
    const specInfo = pet.GACHA_SPECIES[specId];
    console.log(`🐾 ${specInfo.emoji} ${specId.padEnd(12)} | Rarity: ${specInfo.rarity.padEnd(10)} | Hasil: ${pct}% (Ekspektasi: ${expectedPct}%)`);
  }
}

console.log('\n✅ Verifikasi selesai!');
