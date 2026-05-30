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
  // Saat mensimulasikan per jam, ketika hunger/thirst <= 50, saldo terpotong dan hunger/thirst ditambah.
  console.log('\n⏳ 4. Mensimulasikan berlalunya waktu (12 Jam) dengan Auto Care AKTIF...');
  db.run("UPDATE user_pets SET last_interaction_at = ?, hunger = 60, thirst = 60 WHERE user_id = ? AND guild_id = ?", [now - (12 * 3600), userId, guildId]);
  
  // Panggil getPet untuk memicu applyDecay
  activePet = pet.getPet(userId, guildId);
  const currentWallet = economy.getWallet(userId, guildId);
  console.log(`   👉 Status Setelah 12 Jam - Hunger: ${activePet.hunger}%, Thirst: ${activePet.thirst}%, HP: ${activePet.health}%`);
  console.log(`   👉 Sisa Saldo Dompet: Rp ${currentWallet.balance} (Mulai dari 3500)`);
  
  // Mari kita verifikasi pembelian makanan & air otomatis
  // Hunger mulai dari 60.
  // Jam 1: hunger 56, thirst 55
  // Jam 2: hunger 52, thirst 50 -> thirst <= 50 -> beli AIR (-100, thirst +35 = 85)
  // Jam 3: hunger 48 -> hunger <= 50 -> beli PAKAN (-150, hunger +30 = 78), thirst 80
  // ...
  // Selama saldo mencukupi, HP tidak boleh berkurang.
  if (currentWallet.balance < 3500 && activePet.health === 100) {
    console.log('   ✅ VERIFIKASI SELESAI: Saldo berkurang otomatis untuk pakan/minum, dan HP pet tetap terjaga 100%!');
  } else {
    console.error('   ❌ VERIFIKASI GAGAL: Auto-feed tidak berjalan atau HP berkurang!');
  }

  // Uji Kasus: Saldo Habis
  console.log('\n💸 5. Menguji ketika saldo habis...');
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
  console.log('\n🧹 6. Data pengujian berhasil dibersihkan.');
}

runTests();
