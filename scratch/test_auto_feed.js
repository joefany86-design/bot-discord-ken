const pet = require('../stockmarket/pet');
const db = require('../stockmarket/database');
const economy = require('../stockmarket/economy');

async function runTests() {
  console.log('🧪 [Test] Memulai Pengujian Fitur Auto Feed & Water Pet...\n');

  const userId = 'TEST_USER_AUTO_FEED';
  const guildId = 'TEST_GUILD_123';

  // Bersihkan data lama
  db.run('DELETE FROM user_pets WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM wallets WHERE guild_id = ?', [guildId]);

  // Siapkan saldo wallet besar
  economy.addBalance(userId, guildId, 5000, 'TEST_GIFT');
  console.log('💰 1. Saldo dompet awal disiapkan: Rp 5.000');

  // Adopsi pet & tetaskan
  console.log('\n🥚 2. Mengadopsi & menetaskan pet...');
  const newPet = pet.adoptPet(userId, guildId, 'AutoCiko', 'DRAGON');
  const now = Math.floor(Date.now() / 1000);
  db.run("UPDATE user_pets SET status = 'ADULT', level = 10, hatch_at = 0, health = 100, hunger = 100, thirst = 100, last_interaction_at = ? WHERE user_id = ? AND guild_id = ?", [now - 7200, userId, guildId]);
  
  let activePet = pet.getPet(userId, guildId);
  console.log(`   👉 Pet: ${activePet.pet_name}, Status: ${activePet.status}, Level: ${activePet.level}`);
  console.log(`   👉 Status Awal - Hunger: ${activePet.hunger}%, Thirst: ${activePet.thirst}%, HP: ${activePet.health}%`);
  console.log(`   👉 Auto Feed Awal: ${activePet.auto_feed === 1 ? 'AKTIF' : 'NONAKTIF'}`);

  // Menguji toggleAutoFeed
  console.log('\n🤖 3. Menguji Aktivasi/Deaktivasi Fitur Auto Care...');
  let toggleRes = pet.toggleAutoFeed(userId, guildId);
  console.log(`   👉 Toggle 1: Auto Feed sekarang = ${toggleRes.autoFeed} (Harus 1)`);
  
  toggleRes = pet.toggleAutoFeed(userId, guildId);
  console.log(`   👉 Toggle 2: Auto Feed sekarang = ${toggleRes.autoFeed} (Harus 0)`);
  
  // Nyalakan kembali untuk testing decay
  toggleRes = pet.toggleAutoFeed(userId, guildId);
  console.log(`   👉 Toggle 3 (Nyalakan Kembali): Auto Feed sekarang = ${toggleRes.autoFeed} (Harus 1)`);

  // Simulasikan kelaparan & kehausan di bawah 50%
  // Tanpa auto-feed, jika lewat 12 jam:
  // Dragon decay: hunger = -4/jam, thirst = -5/jam
  // 12 jam -> hunger reduction = 48, thirst reduction = 60
  // HP decay: hungerOverdue = 0, thirstOverdue = 0 (karena belum menyentuh 0)
  // Dengan auto-feed AKTIF:
  // Auto Care memulihkan status pet secara otomatis dengan memotong saldo koin dompet per jam.
  console.log('\n⏳ 4. Mensimulasikan berlalunya waktu (12 Jam) dengan Auto Care AKTIF...');
  db.run("UPDATE user_pets SET last_interaction_at = ?, hunger = 60, thirst = 60 WHERE user_id = ? AND guild_id = ?", [now - (12 * 3600), userId, guildId]);
  
  // Panggil getPet untuk memicu applyDecay
  activePet = pet.getPet(userId, guildId);
  const currentWallet = economy.getWallet(userId, guildId);
  console.log(`   👉 Status Setelah 12 Jam - Hunger: ${activePet.hunger}%, Thirst: ${activePet.thirst}%, HP: ${activePet.health}%`);
  console.log(`   👉 Sisa Saldo Dompet: Rp ${currentWallet.balance} (Harus berkurang Rp 500 menjadi 3000)`);
  
  if (currentWallet.balance === 3000 && activePet.health === 100 && activePet.hunger > 50 && activePet.thirst > 50) {
    console.log('   ✅ VERIFIKASI SELESAI: Auto-feed memulihkan status pet secara otomatis dan memotong Rp 500 koin!');
  } else {
    console.error('   ❌ VERIFIKASI GAGAL: Auto-feed tidak berjalan atau HP berkurang atau pemotongan koin salah!');
  }

  // Menguji Fitur unlockAutoCare (Rp 5.000)
  console.log('\n💎 5. Menguji fungsi unlockAutoCare()...');
  
  // 5a. Nonaktifkan kembali untuk pengetesan pembelian
  db.run("UPDATE user_pets SET auto_feed = 0 WHERE user_id = ? AND guild_id = ?", [userId, guildId]);
  
  // 5b. Kurangi saldo ke Rp 2.000 (tidak cukup)
  db.run("UPDATE wallets SET balance = 2000 WHERE user_id = ? AND guild_id = ?", [userId, guildId]);
  try {
    pet.unlockAutoCare(userId, guildId);
    console.error('   ❌ GAGAL: Berhasil membeli Auto Care meskipun koin kurang!');
  } catch (err) {
    console.log(`   ✅ BERHASIL: Gagal membeli Auto Care saat saldo kurang. Pesan error: "${err.message}"`);
  }

  // 5c. Set saldo ke Rp 6.000 (cukup)
  db.run("UPDATE wallets SET balance = 6000 WHERE user_id = ? AND guild_id = ?", [userId, guildId]);
  try {
    const res = pet.unlockAutoCare(userId, guildId);
    const afterWallet = economy.getWallet(userId, guildId);
    const afterPet = pet.getPet(userId, guildId);
    
    if (afterWallet.balance === 1000 && afterPet.auto_feed === 1) {
      console.log(`   ✅ BERHASIL: Sukses membuka Auto Care untuk pet "${res.petName}". Saldo berkurang Rp 5.000 (Sisa: Rp ${afterWallet.balance}), status auto_feed = 1.`);
    } else {
      console.error(`   ❌ GAGAL: Saldo salah atau status auto_feed tidak berubah! Saldo: ${afterWallet.balance}, auto_feed: ${afterPet.auto_feed}`);
    }
  } catch (err) {
    console.error('   ❌ GAGAL: Terjadi error saat mencoba membeli Auto Care dengan koin cukup:', err.message);
  }

  // 5d. Pembelian ganda (harus gagal karena sudah aktif)
  try {
    pet.unlockAutoCare(userId, guildId);
    console.error('   ❌ GAGAL: Pembelian ganda berhasil!');
  } catch (err) {
    console.log(`   ✅ BERHASIL: Pembelian ganda ditolak. Pesan error: "${err.message}"`);
  }

  // 6. Uji Kasus: Saldo Habis saat Auto Care aktif
  console.log('\n💸 6. Menguji ketika saldo habis...');
  db.run("UPDATE wallets SET balance = 0 WHERE user_id = ? AND guild_id = ?", [userId, guildId]);
  db.run("UPDATE user_pets SET last_interaction_at = ?, hunger = 20, thirst = 20, health = 100 WHERE user_id = ? AND guild_id = ?", [now - (20 * 3600), userId, guildId]);
  
  activePet = pet.getPet(userId, guildId);
  console.log(`   👉 Status Setelah 20 Jam tanpa saldo - Hunger: ${activePet.hunger}%, Thirst: ${activePet.thirst}%, HP: ${activePet.health}%`);
  
  if (activePet.health < 100) {
    console.log('   ✅ VERIFIKASI SELESAI: HP berkurang ketika saldo Rp 0 karena auto-feed tidak bisa membeli persediaan!');
  } else {
    console.error('   ❌ VERIFIKASI GAGAL: HP tidak berkurang meskipun kelaparan/kehausan!');
  }

  // Bersihkan tabel test
  db.run('DELETE FROM user_pets WHERE guild_id = ?', [guildId]);
  db.run('DELETE FROM wallets WHERE guild_id = ?', [guildId]);
  console.log('\n🧹 7. Data pengujian berhasil dibersihkan.');
}

runTests();
