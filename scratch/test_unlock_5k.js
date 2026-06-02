const pet = require('../stockmarket/pet');
const db = require('../stockmarket/database');
const economy = require('../stockmarket/economy');

async function runTests() {
  console.log('🧪 [Test] Memulai Pengujian Aktivasi Auto Care dengan Saldo 5k...\n');

  const userId = 'TEST_USER_5K';
  const guildId = 'TEST_GUILD_5K';

  // Bersihkan data lama
  db.run('DELETE FROM user_pets WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM wallets WHERE guild_id = ?', [guildId]);

  // 1. Siapkan pet aktif
  console.log('🥚 1. Mengadopsi & menetaskan pet...');
  economy.addBalance(userId, guildId, 10000, 'TEST_GIFT'); // Tambah saldo awal agar bisa adopsi
  pet.adoptPet(userId, guildId, 'Ciko5K', 'DRAGON');
  const now = Math.floor(Date.now() / 1000);
  db.run("UPDATE user_pets SET status = 'ADULT', level = 10, hatch_at = 0, health = 100, hunger = 100, thirst = 100, last_interaction_at = ? WHERE user_id = ? AND guild_id = ?", [now, userId, guildId]);

  // 2. Siapkan saldo wallet tepat Rp 5.000
  console.log('💰 2. Menyiapkan saldo tepat Rp 5.000...');
  db.run('UPDATE wallets SET balance = 5000 WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  
  let wallet = economy.getWallet(userId, guildId);
  console.log(`   👉 Saldo saat ini: Rp ${wallet.balance} (Tipe data: ${typeof wallet.balance})`);

  // 3. Coba aktifkan Auto Care
  console.log('\n🔋 3. Mencoba mengaktifkan Auto Care seharga Rp 5.000...');
  try {
    const res = pet.unlockAutoCare(userId, guildId);
    const afterWallet = economy.getWallet(userId, guildId);
    const afterPet = pet.getPet(userId, guildId);
    console.log(`   ✅ BERHASIL: Sukses membuka Auto Care untuk pet "${res.petName}".`);
    console.log(`   👉 Sisa Saldo: Rp ${afterWallet.balance}`);
    console.log(`   👉 Status auto_feed: ${afterPet.auto_feed}`);
  } catch (err) {
    console.error(`   ❌ GAGAL: Terjadi error saat mengaktifkan Auto Care: "${err.message}"`);
  }

  // Bersihkan data
  db.run('DELETE FROM user_pets WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM wallets WHERE guild_id = ?', [guildId]);
}

runTests();
