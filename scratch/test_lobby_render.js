const { generateExpeditionLobbyCard } = require('../stockmarket/petCard');
const fs = require('fs');
const path = require('path');

// Mock data
const initiatorId = '1234567890';
const selectedMap = {
  id: 1,
  name: '🌋 Lava Chamber',
  recommendedLevel: 25,
  difficulty: 8,
  element: 'FIRE'
};

const participants = [
  {
    userId: '1234567890',
    username: 'JoeFany',
    pet_name: 'Fuego',
    pet_type: 'DRAGON',
    level: 30,
    gacha_element: 'FIRE',
    gacha_rarity: 'MYTHIC',
    status: 'ADULT',
    health: 90
  },
  {
    userId: '9876543210',
    username: 'Antigravity',
    pet_name: 'Blobby',
    pet_type: 'SLIME',
    level: 15,
    gacha_element: 'WATER',
    gacha_rarity: 'RARE',
    status: 'BABY',
    health: 100
  },
  {
    userId: '1111222233',
    username: 'PawangLiar',
    pet_name: 'Rocky',
    pet_type: 'GOLEM',
    level: 28,
    gacha_element: 'EARTH',
    gacha_rarity: 'EPIC',
    status: 'WEAK', // Lemas
    health: 1 // Weak status test / low hp
  }
];

const successRate = 75;
const elementalLogs = '• Sinergi Air + Api memberikan keuntungan!\n• Penalti level rendah pada Slime.';
const endTimeUnix = Math.floor(Date.now() / 1000) + 30;
const mapChoice = 1;

// Mock guild
const guild = {
  members: {
    cache: {
      get: (id) => {
        if (id === initiatorId) return { user: { username: 'JoeFany' } };
        return null;
      }
    }
  }
};

(async () => {
  console.log("🎨 Testing Expedition Lobby Card rendering...");
  try {
    const buffer = await generateExpeditionLobbyCard(initiatorId, selectedMap, participants, successRate, elementalLogs, endTimeUnix, mapChoice, guild);
    const outputPath = path.join(__dirname, 'test_lobby_output.png');
    fs.writeFileSync(outputPath, buffer);
    console.log(`✅ Success! Rendered image saved to ${outputPath}`);
  } catch (err) {
    console.error("❌ Failed to render:", err);
  }
})();
