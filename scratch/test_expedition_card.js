const fs = require('fs');
const path = require('path');
const petCard = require('../stockmarket/petCard');

async function runTest() {
  console.log('Starting expedition card generation test...');
  
  // Mock success expedition result
  const mockSuccessRes = {
    success: true,
    zoneName: '🔥 Lembah Api (Fire Valley)',
    teamPower: 45,
    successRate: 72,
    bestPet: { userId: '123456', petName: 'Drago Supreme', level: 15 },
    worstPet: { userId: '234567', petName: 'Slimy Blob', level: 12 },
    chestAwardedUser: '123456',
    chestDropItem: 'EXP_8X'
  };

  // Mock failed expedition result
  const mockFailedRes = {
    success: false,
    zoneName: ' Tundra Beku (Frozen Tundra)',
    teamPower: 28,
    successRate: 40,
    bestPet: { userId: '123456', petName: 'Aqua Hydra', level: 18 },
    worstPet: { userId: '345678', petName: 'Rocky Golem', level: 8 }
  };

  // Mock guild
  const mockGuild = {
    members: {
      cache: {
        get(id) {
          const names = {
            '123456': { user: { username: 'JoeFany' } },
            '234567': { user: { username: 'David' } },
            '345678': { user: { username: 'Bobby' } }
          };
          return names[id];
        }
      }
    }
  };

  try {
    // Test Success (Map 3 - Fire)
    const successBuffer = await petCard.generateExpeditionCard(mockSuccessRes, 3, mockGuild);
    const successPath = path.join(__dirname, 'test_expedition_success.png');
    fs.writeFileSync(successPath, successBuffer);
    console.log(`Success! Visual card saved to ${successPath}`);

    // Test Failure (Map 5 - Water)
    const failureBuffer = await petCard.generateExpeditionCard(mockFailedRes, 5, mockGuild);
    const failurePath = path.join(__dirname, 'test_expedition_failure.png');
    fs.writeFileSync(failurePath, failureBuffer);
    console.log(`Failure! Visual card saved to ${failurePath}`);
  } catch (error) {
    console.error('Error rendering expedition card:', error);
  }
}

runTest();
