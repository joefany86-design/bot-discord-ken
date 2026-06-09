const fs = require('fs');
const path = require('path');
const db = require('../stockmarket/database');
const petCard = require('../stockmarket/petCard');

// Mock getLeagueStandingsData since it queries DB
function getLeagueStandingsData(guildId) {
  // Let's check if the tables are empty or if we can get mock data
  try {
    const participants = db.all('SELECT * FROM tournament_participants WHERE guild_id = ?', [guildId]);
    const matches = db.all('SELECT * FROM tournament_matches WHERE guild_id = ? AND match_status = \'COMPLETED\'', [guildId]);
    
    // If no participants, return some mock entries for testing
    if (participants.length === 0) {
      return [
        { userId: '123456', petName: 'Dino Fire', played: 3, won: 3, lost: 0, points: 9 },
        { userId: '234567', petName: 'Water Whale', played: 3, won: 2, lost: 1, points: 6 },
        { userId: '345678', petName: 'Wind Eagle', played: 3, won: 1, lost: 2, points: 3 },
      ];
    }

    const standings = participants.map(p => {
      let played = 0;
      let won = 0;
      matches.forEach(m => {
        if (m.player_1_id === p.user_id || m.player_2_id === p.user_id) {
          played++;
          if (m.winner_id === p.user_id) {
            won++;
          }
        }
      });
      const lost = played - won;
      const points = won * 3;
      return {
        userId: p.user_id,
        petName: p.pet_name,
        played,
        won,
        lost,
        points
      };
    });

    standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.won !== a.won) return b.won - a.won;
      return a.petName.localeCompare(b.petName);
    });
    return standings;
  } catch (err) {
    console.error('Error fetching real standings, falling back to mock:', err.message);
    return [
      { userId: '123456', petName: 'Mock Dragon', played: 2, won: 2, lost: 0, points: 6 },
      { userId: '234567', petName: 'Mock Slime', played: 2, won: 0, lost: 2, points: 0 }
    ];
  }
}

async function runTest() {
  console.log('Testing tournament standings rendering integration...');
  const guildId = '1410239829874053296'; // Real guild ID or mock
  
  const standings = getLeagueStandingsData(guildId);
  console.log('Fetched standings:', standings);

  // Mock guild
  const mockGuild = {
    members: {
      cache: {
        get(id) {
          return { user: { username: `User_${id.slice(-4)}` } };
        }
      }
    }
  };

  try {
    const attachment = await petCard.getStandingsCardAttachment(standings, mockGuild);
    if (attachment) {
      console.log('✅ Attachment successfully generated!');
      const outputPath = path.join(__dirname, 'test_tournament_standings.png');
      fs.writeFileSync(outputPath, attachment.attachment);
      console.log(`Saved output to ${outputPath}`);
    } else {
      console.error('❌ Attachment was null');
    }
  } catch (err) {
    console.error('❌ Error rendering:', err);
  }
}

runTest();
