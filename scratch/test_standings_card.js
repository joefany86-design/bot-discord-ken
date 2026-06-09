const fs = require('fs');
const path = require('path');
const petCard = require('../stockmarket/petCard');

async function runTest() {
  console.log('Starting standings card generation test...');
  
  // Mock standings data
  const mockStandings = [
    { userId: '123456', petName: 'Drago Supreme', played: 5, won: 4, lost: 1, points: 12 },
    { userId: '234567', petName: 'Aqua Hydra', played: 5, won: 3, lost: 2, points: 9 },
    { userId: '345678', petName: 'Rocky Golem', played: 5, won: 3, lost: 2, points: 9 },
    { userId: '456789', petName: 'Phoenix Flame', played: 5, won: 2, lost: 3, points: 6 },
    { userId: '567890', petName: 'Slimy Blob', played: 5, won: 1, lost: 4, points: 3 },
  ];

  // Mock guild
  const mockGuild = {
    members: {
      cache: {
        get(id) {
          const names = {
            '123456': { user: { username: 'JoeFany' } },
            '234567': { user: { username: 'Alex' } },
            '345678': { user: { username: 'Bobby' } },
            '456789': { user: { username: 'Cindy' } },
            '567890': { user: { username: 'David' } },
          };
          return names[id];
        }
      }
    }
  };

  try {
    const buffer = await petCard.generateStandingsCard(mockStandings, mockGuild);
    const outputPath = path.join(__dirname, 'test_standings_output.png');
    fs.writeFileSync(outputPath, buffer);
    console.log(`Success! Standings card saved to ${outputPath}`);
  } catch (error) {
    console.error('Error rendering standings card:', error);
  }
}

runTest();
