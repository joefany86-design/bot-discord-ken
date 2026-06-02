const economy = require('../stockmarket/economy');
const embeds = require('../stockmarket/embeds');

console.log('🧪 MEMULAI PENGETESAN KODE LEADERBOARD PENCURI...');

const guildId = '1410239829874053296';
const guildName = 'Rupiah Server Test';

// Mock Client
const mockClient = {
  guilds: {
    cache: {
      find: (callback) => {
        return {
          name: guildName,
          iconURL: () => 'https://example.com/icon.png'
        };
      }
    }
  },
  users: {
    cache: {
      get: (id) => ({ id, username: `User_${id.substring(0, 4)}` })
    }
  }
};

try {
  // Test 1: Fetching Leaderboard Data
  console.log('\nTesting: economy.getThiefLeaderboard...');
  const thiefData = economy.getThiefLeaderboard(guildId, 10);
  console.log('Result Data:', thiefData);
  if (!Array.isArray(thiefData)) {
    throw new Error('Hasil getThiefLeaderboard harus berupa Array');
  }
  console.log('✅ Test 1: Fetching data sukses!');

  // Test 2: Embed Creation
  console.log('\nTesting: embeds.thiefLeaderboardEmbed...');
  const embed = embeds.thiefLeaderboardEmbed(guildName, thiefData, mockClient);
  console.log('Created Embed title:', embed.data.title);
  console.log('Created Embed description starts with:', embed.data.description.substring(0, 100));
  if (!embed.data.title.includes('PAPAN PERINGKAT: TOP PENCURI')) {
    throw new Error('Judul embed tidak sesuai');
  }
  console.log('✅ Test 2: Embed creation sukses!');

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
} catch (err) {
  console.error('\n❌ TEST FAILED:', err.message);
  process.exit(1);
}
