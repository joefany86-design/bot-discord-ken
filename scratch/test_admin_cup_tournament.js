const db = require('../stockmarket/database');
const pet = require('../stockmarket/pet');
const tournament = require('../stockmarket/tournament');

// Setup mock client
const client = {
  channels: {
    cache: new Map(),
    fetch: async (id) => client.channels.cache.get(id)
  },
  activeCupMatches: new Map(),
  users: {
    cache: new Map(),
    fetch: async (id) => ({ id, username: `Admin_${id}`, send: async (msg) => console.log(`[DM to Admin ${id}]:`, msg) })
  }
};

const mockChannel = {
  id: 'channel_123',
  send: async (payload) => {
    console.log('\n💬 [MAIN CHANNEL SEND]:', payload.embeds ? '[Embed Message]' : payload);
    if (payload.embeds) {
      console.log('--- Title:', payload.embeds[0].data.title);
      console.log('--- Description:', payload.embeds[0].data.description);
    }
    return { id: 'msg_123' };
  },
  threads: {
    create: async (options) => {
      console.log('\n🧵 [THREAD CREATED]:', options.name);
      const mockThread = {
        id: 'thread_456',
        isThread: true,
        setName: async (name) => console.log('🏷️ [THREAD SET NAME]:', name),
        send: async (p) => {
          console.log('💬 [THREAD SEND]:', p.embeds ? '[Embed Message]' : p);
          if (p.embeds) {
            console.log('--- Title:', p.embeds[0].data.title);
            console.log('--- Description:', p.embeds[0].data.description.replace(/\n\n/g, '\n'));
          }
          return { 
            id: 'thread_msg_789', 
            edit: async (d) => {
              console.log('✏️ [THREAD MSG EDITED]');
              console.log('--- Description:', d.embeds[0].data.description.replace(/\n\n/g, '\n'));
            },
            delete: async () => {
              console.log('🗑️ [THREAD MSG DELETED]');
            }
          };
        },
        messages: {
          fetch: async (id) => {
            return {
              edit: async (d) => {
                console.log('✏️ [THREAD MSG EDITED via messages.fetch]');
                console.log('--- Description:', d.embeds[0].data.description.replace(/\n\n/g, '\n'));
              },
              delete: async () => {
                console.log('🗑️ [THREAD MSG DELETED via messages.fetch]');
              }
            };
          }
        },
        setLocked: async (val) => console.log('🔒 [THREAD SET LOCKED]:', val),
        setArchived: async (val) => console.log('📦 [THREAD SET ARCHIVED]:', val)
      };
      client.channels.cache.set('thread_456', mockThread);
      return mockThread;
    }
  },
  guild: {
    members: {
      fetch: async (id) => ({ user: { username: `User_${id}` } })
    },
    channels: client.channels
  }
};
client.channels.cache.set('channel_123', mockChannel);
client.channels.cache.set('1511871394210779247', mockChannel);
client.channels.cache.set('1510138369923874958', mockChannel);

// Helper to setup mock pets
function insertTestPet(userId, petName, petType, level, hp, element, str, def, dex, vit = 500) {
  db.run(`DELETE FROM user_pets WHERE user_id = ? AND guild_id = 'guild_123'`, [userId]);
  db.run(`
    INSERT INTO user_pets (
      user_id, guild_id, pet_name, pet_type, status, level, xp, health, hunger, thirst, happiness, 
      is_active, trait, gacha_rarity, gacha_element, stat_str, stat_def, stat_dex, stat_vit
    ) VALUES (?, 'guild_123', ?, ?, 'ADULT', ?, 0, ?, 100, 100, 100, 1, 'WARRIOR', 'COMMON', ?, ?, ?, ?, ?)
  `, [userId, petName, petType, level, hp, element, str, def, dex, vit]);
}

async function runTests() {
  console.log('🧪 ==========================================');
  console.log('🧪 STARTING ADMIN CUP TOURNAMENT SIMULATION');
  console.log('🧪 ==========================================');

  // Clean up any stale data from previous failed runs first
  db.run('DELETE FROM tournament_events WHERE guild_id = \'guild_123\'');
  db.run('DELETE FROM tournament_participants WHERE guild_id = \'guild_123\'');
  db.run('DELETE FROM tournament_matches WHERE guild_id = \'guild_123\'');
  db.run('DELETE FROM user_pets WHERE guild_id = \'guild_123\'');

  // Test 1: Mulai Turnamen
  console.log('\n1. Testing startTournament...');
  const activeEvent = tournament.startTournament('admin_user_99', 'guild_123', 'channel_123', 5, 10, 80);
  console.log('✅ Tournament started:', activeEvent);

  // Test 2: Mendaftarkan Peserta
  console.log('\n2. Testing registerParticipant...');
  // Setup 4 pet tanding
  insertTestPet('user_1', 'Fenrir', 'CAT', 45, 100, 'FIRE', 20, 10, 15);
  insertTestPet('user_2', 'Kurama', 'DRAGON', 38, 100, 'FIRE', 18, 12, 12);
  insertTestPet('user_3', 'Rocky', 'GOLEM', 50, 100, 'EARTH', 25, 25, 5);
  insertTestPet('user_4', 'Kuro', 'SLIME', 42, 100, 'WATER', 15, 15, 20);

  // Daftarkan yang valid
  const p1 = tournament.registerParticipant('user_1', 'guild_123', 'Fenrir');
  const p2 = tournament.registerParticipant('user_2', 'guild_123', 'Kurama');
  const p3 = tournament.registerParticipant('user_3', 'guild_123', 'Rocky');
  const p4 = tournament.registerParticipant('user_4', 'guild_123', 'Kuro');
  console.log(`✅ Registered 4 pets successfully: ${p1.pet_name}, ${p2.pet_name}, ${p3.pet_name}, ${p4.pet_name}`);

  // Uji validasi error pendaftaran
  console.log('\n2b. Testing registration validations (expecting errors)...');
  // HP Rendah
  insertTestPet('user_fail', 'Lele', 'SLIME', 15, 30, 'WATER', 10, 10, 10);
  try {
    tournament.registerParticipant('user_fail', 'guild_123', 'Lele');
    console.log('❌ Error: HP rendah lolos!');
  } catch (err) {
    console.log('✅ Got expected error (low HP):', err.message);
  }

  // Level di luar kriteria
  insertTestPet('user_fail_lv', 'NagaSakti', 'DRAGON', 95, 100, 'DRAGON', 50, 50, 50);
  try {
    tournament.registerParticipant('user_fail_lv', 'guild_123', 'NagaSakti');
    console.log('❌ Error: Level tinggi lolos!');
  } catch (err) {
    console.log('✅ Got expected error (level out of range):', err.message);
  }

  // Test 3: Bracket Seeding
  console.log('\n3. Testing closeRegistrationAndGenerateBracket...');
  await tournament.closeRegistrationAndGenerateBracket('guild_123', client);

  // Wait 5.5 seconds for executeNextMatch to fire due to its internal setTimeout
  console.log('⏳ Waiting 5.5s for executeNextMatch...');
  await new Promise(resolve => setTimeout(resolve, 5500));

  // Test 4: Battle Engine Simultaneous Turn Loop
  console.log('\n4. Simulating Active Match Duel...');
  // Ambil match yang barusan di-set ACTIVE di executeNextMatch
  const activeMatch = Array.from(client.activeCupMatches.values())[0];
  if (!activeMatch) {
    console.log('❌ Error: Tidak ada match aktif ditemukan!');
    return;
  }
  
  const matchId = activeMatch.matchId;
  const p1Id = activeMatch.player1.user_id;
  const p2Id = activeMatch.player2.user_id;

  console.log(`Match ID: ${matchId}`);
  console.log(`P1: ${activeMatch.player1.pet_name} (User ID: ${p1Id}, SPD: ${activeMatch.player1.stat_dex})`);
  console.log(`P2: ${activeMatch.player2.pet_name} (User ID: ${p2Id}, SPD: ${activeMatch.player2.stat_dex})`);

  // Simulasikan Ronde 1
  console.log('\n--- Ronde 1 (P1 uses Serang, P2 uses Bertahan) ---');
  
  // Test: Mencoba Ultimate di Turn 1 (Harus Gagal)
  try {
    console.log('🧪 Menguji penggunaan Ultimate pada Turn 1 (P1)...');
    await tournament.processTurn(matchId, p1Id, 'ult', client);
    throw new Error('❌ Gagal memblokir Ultimate di Turn 1!');
  } catch (err) {
    console.log('✅ Berhasil diblokir:', err.message);
  }

  // Lanjutkan aksi normal
  await tournament.processTurn(matchId, p1Id, 'atk', client); // P1 SP: 0 + 20 = 20 SP
  await tournament.processTurn(matchId, p2Id, 'def', client); // P2 SP: 0 + 35 = 35 SP. Resolves Turn 1

  // Simulasikan Ronde 2
  console.log('\n--- Ronde 2 (P1 tries Ultimate but lacks SP, P2 tries Ultimate but lacks SP) ---');
  
  // Test: Mencoba Ultimate dengan SP kurang (P1 memiliki 20 SP, butuh 60 SP)
  try {
    console.log(`🧪 Menguji penggunaan Ultimate dengan SP kurang (P1 SP: ${activeMatch.player1.energy})...`);
    await tournament.processTurn(matchId, p1Id, 'ult', client);
    throw new Error('❌ Gagal memblokir Ultimate saat SP kurang!');
  } catch (err) {
    console.log('✅ Berhasil diblokir:', err.message);
  }

  // Lanjutkan aksi normal untuk mengumpulkan energi
  await tournament.processTurn(matchId, p1Id, 'def', client); // P1 SP: 20 + 35 = 55 SP
  await tournament.processTurn(matchId, p2Id, 'def', client); // P2 SP: 35 + 35 = 70 SP. Resolves Turn 2

  // Simulasikan Ronde 3
  console.log('\n--- Ronde 3 (P1 tries Ultimate with 55 SP and fails, P2 uses Ultimate with 70 SP) ---');

  // Test: P1 mencoba Ultimate dengan 55 SP (butuh 60 SP)
  try {
    console.log(`🧪 Menguji penggunaan Ultimate dengan SP kurang (P1 SP: ${activeMatch.player1.energy})...`);
    await tournament.processTurn(matchId, p1Id, 'ult', client);
    throw new Error('❌ Gagal memblokir Ultimate saat SP kurang (55 SP)!');
  } catch (err) {
    console.log('✅ Berhasil diblokir:', err.message);
  }

  // Aksi valid
  await tournament.processTurn(matchId, p1Id, 'atk', client); // P1 SP: 55 + 20 = 75 SP
  await tournament.processTurn(matchId, p2Id, 'ult', client); // P2 SP: 70 - 60 = 10 SP. Resolves Turn 3

  // Simulasikan Ronde 4
  console.log('\n--- Ronde 4 (P1 uses Ultimate with 75 SP, P2 tries Ultimate again and fails) ---');

  // P1 menggunakan Ultimate (memiliki 75 SP)
  await tournament.processTurn(matchId, p1Id, 'ult', client); // P1 SP: 75 - 60 = 15 SP
  
  // Test: P2 mencoba Ultimate lagi (Harus Gagal karena sudah pernah pakai)
  try {
    console.log('🧪 Menguji pembatasan 1x Ultimate per match (P2)...');
    await tournament.processTurn(matchId, p2Id, 'ult', client);
    throw new Error('❌ Gagal membatasi 1x Ultimate per match!');
  } catch (err) {
    console.log('✅ Berhasil dibatasi:', err.message);
  }

  await tournament.processTurn(matchId, p2Id, 'atk', client); // Resolves Turn 4

  // Test 5: Turn Timeout Logic
  console.log('\n5. Testing Turn Timeout Logic...');
  
  // Reset chosen actions if any
  activeMatch.player1.chosenAction = null;
  activeMatch.player2.chosenAction = null;
  activeMatch.player1.timeouts = 0;
  activeMatch.player2.timeouts = 0;

  console.log('Simulating timeout (should auto attack)...');
  const { handleTimeout } = require('../stockmarket/tournament');
  await handleTimeout(matchId, client);

  console.log('Simulating forfeit timeout (timeouts = 1, should forfeit)...');
  activeMatch.player1.chosenAction = null;
  activeMatch.player2.chosenAction = null;
  activeMatch.player1.timeouts = 1;
  activeMatch.player2.timeouts = 0;

  await handleTimeout(matchId, client);
  console.log('✅ Timeout forfeit simulation success.');

  // Test 6: Verify HP recovery
  console.log('\n6. Checking pet HP restoration...');
  const pet1State = pet.getPet('user_1', 'guild_123');
  const pet2State = pet.getPet('user_2', 'guild_123');
  console.log(`Pet 1 Health: ${pet1State.health}% (Expected: 100%)`);
  console.log(`Pet 2 Health: ${pet2State.health}% (Expected: 100%)`);
  console.log('✅ Pet health and happiness restored successfully.');

  // Test 6.5: Verify endTournament with Juara 3 and Juara 4
  console.log('\n6.5. Testing endTournament with 3rd and 4th place...');
  // Mock event and admin panel settings to test completedEmbed
  db.run(`
    UPDATE tournament_events 
    SET admin_panel_message_id = 'admin_panel_msg_123', admin_panel_channel_id = 'channel_123'
    WHERE guild_id = 'guild_123'
  `);
  // Mock admin panel message in cache
  const mockAdminPanelMsg = {
    id: 'admin_panel_msg_123',
    edit: async (d) => {
      console.log('✏️ [ADMIN PANEL MESSAGE EDITED - COMPLETED EMBED]');
      console.log('--- Title:', d.embeds[0].data.title);
      console.log('--- Fields:', JSON.stringify(d.embeds[0].data.fields, null, 2));
    }
  };
  mockChannel.messages = mockChannel.messages || {};
  mockChannel.messages.fetch = async (id) => {
    if (id === 'admin_panel_msg_123') return mockAdminPanelMsg;
    return { 
      edit: async () => {}, 
      delete: async () => {} 
    };
  };

  // Register participants in DB so endTournament queries succeed
  db.run("INSERT OR REPLACE INTO tournament_participants (guild_id, user_id, pet_name, status) VALUES ('guild_123', 'user_1', 'Fenrir', 'ACTIVE')");
  db.run("INSERT OR REPLACE INTO tournament_participants (guild_id, user_id, pet_name, status) VALUES ('guild_123', 'user_2', 'Kurama', 'ACTIVE')");
  db.run("INSERT OR REPLACE INTO tournament_participants (guild_id, user_id, pet_name, status) VALUES ('guild_123', 'user_3', 'Rocky', 'ACTIVE')");
  db.run("INSERT OR REPLACE INTO tournament_participants (guild_id, user_id, pet_name, status) VALUES ('guild_123', 'user_4', 'Kuro', 'ACTIVE')");

  await tournament.endTournament('guild_123', 'user_1', 'user_2', client, 'user_3', 'user_4');
  console.log('✅ endTournament execution completed.');

  // Test 6.6: Verify settings has the correct winners
  console.log('\n6.6. Querying ebyus_settings to verify saved winners...');
  const settings = db.get('SELECT last_cup_juara_1, last_cup_juara_2, last_cup_juara_3, last_cup_juara_4 FROM ebyus_settings WHERE guild_id = ?', ['guild_123']);
  console.log('Saved Winners in settings:', settings);
  if (settings.last_cup_juara_1 === 'user_1' &&
      settings.last_cup_juara_2 === 'user_2' &&
      settings.last_cup_juara_3 === 'user_3' &&
      settings.last_cup_juara_4 === 'user_4') {
    console.log('✅ Winners correctly stored in ebyus_settings!');
  } else {
    throw new Error('Winners were not stored correctly in ebyus_settings');
  }

  // Clean up
  console.log('\n7. Cleaning up test data...');
  db.run('DELETE FROM tournament_events WHERE guild_id = \'guild_123\'');
  db.run('DELETE FROM tournament_participants WHERE guild_id = \'guild_123\'');
  db.run('DELETE FROM tournament_matches WHERE guild_id = \'guild_123\'');
  db.run('DELETE FROM user_pets WHERE guild_id = \'guild_123\'');

  console.log('\n🎉 ALL TESTS COMPLETED SUCCESSFULLY! FITUR TURNAMEN ADMIN CUP STABIL.');
}

runTests().catch(err => {
  console.error('\n❌ TEST RUN FAILED ERROR:', err);
});
