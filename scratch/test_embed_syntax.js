const { getPetExpeditionEmbed } = require('../stockmarket/rpgEmbeds.js');

const mockPet = {
  pet_name: 'Falkor',
  pet_type: 'DRAGON',
  gacha_rarity: 'MYTHIC',
  star_level: 4
};

const mockMap = {
  name: '🔥 Lembah Api (Fire Valley)',
  recommendedLevel: 25,
  difficulty: 6, // 60%
  minPrize: 800,
  maxPrize: 1500,
  boss: 'Golem Magma'
};

try {
  const result = getPetExpeditionEmbed(mockPet, mockMap, 7200, false);
  console.log("Embed generated successfully without errors!");
  console.log("Embed Color:", result.embeds[0].data.color);
  console.log("Embed Fields:", result.embeds[0].data.fields);
  console.log("Successfully validated!");
} catch (e) {
  console.error("Failed to generate embed:", e);
  process.exit(1);
}
