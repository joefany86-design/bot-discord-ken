const pet = require('../stockmarket/pet');
const db = require('../stockmarket/database');
const embeds = require('../stockmarket/embeds');

async function testImprovements() {
  console.log('🧪 [Test] Memulai Verifikasi Peningkatan Sistem Pet...');

  const userId = 'TEST_USER_999';
  const guildId = 'TEST_GUILD_123';

  // Bersihkan DB
  db.run('DELETE FROM user_pets WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM pet_inventory WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM wallets WHERE guild_id = ?', [guildId]);

  // Set saldo awal
  const economy = require('../stockmarket/economy');
  economy.addBalance(userId, guildId, 10000, 'TEST_GIFT');

  console.log('🛡️ 1. Menguji Sanitasi Nama Pet...');
  // Adopsi dengan nama berbahaya (mengandung mentions)
  const adoptedDanger = pet.adoptPet(userId, guildId, 'Ciko <@!123456> @everyone', 'SLIME');
  console.log(`   👉 Nama asal: "Ciko <@!123456> @everyone"`);
  console.log(`   👉 Nama bersih: "${adoptedDanger.pet_name}"`);
  if (adoptedDanger.pet_name !== 'Ciko') {
    console.error('   ❌ Gagal sanitasi nama pet!');
    process.exit(1);
  }
  console.log('   ✅ Sukses sanitasi nama!');

  // Hatch telur slime agar bisa kita tes
  db.run('UPDATE user_pets SET hatch_at = ? WHERE user_id = ? AND guild_id = ?', [Math.floor(Date.now() / 1000) - 10, userId, guildId]);
  let slime = pet.getPet(userId, guildId);
  console.log(`   👉 Spesies: ${slime.pet_type}, Health Awal: ${slime.health} (Status: ${slime.status})`);

  console.log('\n❤️ 2. Menguji Batas Max HP Slime & Obat-Obatan...');
  // Set HP ke 100
  db.run('UPDATE user_pets SET health = 100 WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  slime = pet.getPet(userId, guildId);
  console.log(`   👉 HP saat ini: ${slime.health}`);

  // Coba beri obat (sebelum perbaikan ini akan error karena HP >= 100)
  // Tambah item medicine ke inventory
  db.run("INSERT INTO pet_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'MEDICINE', 1) ON CONFLICT(user_id, guild_id, item_id) DO UPDATE SET quantity = quantity + 1", [userId, guildId]);
  
  try {
    const res = pet.useItem(userId, guildId, 'MEDICINE', false);
    console.log(`   ✅ Sukses menggunakan Obat pada HP >= 100! HP baru: ${res.pet.health}`);
    if (res.pet.health !== 120) {
      console.error(`   ❌ HP Slime harusnya 120, tapi terdeteksi ${res.pet.health}!`);
      process.exit(1);
    }
  } catch (err) {
    console.error('   ❌ Gagal menggunakan obat pada HP >= 100:', err.message);
    process.exit(1);
  }

  // Coba beri obat lagi saat HP sudah 120 (harus error karena sudah max HP)
  db.run("INSERT INTO pet_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'MEDICINE', 1) ON CONFLICT(user_id, guild_id, item_id) DO UPDATE SET quantity = quantity + 1", [userId, guildId]);
  try {
    pet.useItem(userId, guildId, 'MEDICINE', false);
    console.error('   ❌ Harusnya gagal menggunakan obat karena HP sudah maksimal (120)!');
    process.exit(1);
  } catch (err) {
    console.log(`   ✅ Sukses memblokir obat saat HP maksimal (120): ${err.message}`);
  }

  console.log('\n🧠 3. Menguji Trait GENIUS & XP Cap...');
  // Edit trait pet ke GENIUS
  db.run("UPDATE user_pets SET trait = 'GENIUS' WHERE user_id = ? AND guild_id = ?", [userId, guildId]);
  slime = pet.getPet(userId, guildId);
  const xpNeededNormal = slime.level * 100;
  const xpNeededGenius = pet.getXpNeeded(slime.level, slime.trait);
  console.log(`   👉 Trait: ${slime.trait}`);
  console.log(`   👉 XP Dibutuhkan (Normal): ${xpNeededNormal}`);
  console.log(`   👉 XP Dibutuhkan (Genius): ${xpNeededGenius}`);
  if (xpNeededGenius !== Math.round(xpNeededNormal * 0.85)) {
    console.error('   ❌ Kalkulasi XP Genius salah!');
    process.exit(1);
  }
  console.log('   ✅ Sukses kalkulasi XP Genius!');

  console.log('\n📊 4. Menguji Render Embed dengan Trait & HP Baru...');
  const mockUser = {
    username: 'Joe',
    displayAvatarURL: () => 'https://example.com/avatar.png'
  };
  const dashboard = embeds.petDashboardEmbed(mockUser, slime, []);
  const desc = dashboard.data.description;
  console.log('   👉 Embed Description snippet:');
  console.log(`      ${desc.split('\n\n')[0]}`);
  if (!desc.includes('🧠 Genius') || !desc.includes('120') || !desc.includes('85 XP')) {
    console.error('   ❌ Embed tidak merender trait, max HP, atau XP Genius dengan tepat!');
    process.exit(1);
  }
  console.log('   ✅ Embed merender seluruh data dengan benar!');

  console.log('\n🎉 SELURUH PENGUJIAN PENINGKATAN PET BERHASIL! 🎉');
}

testImprovements();
