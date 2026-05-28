const db = require('./database');
const economy = require('./economy');
const config = require('./config');

// Konfigurasi Item Kebutuhan Pet
const PET_ITEMS = {
  FOOD_BASIC: { id: 'FOOD_BASIC', name: '🍗 Pakan Pet Biasa', price: 150, hunger: 30, thirst: 0, hp: 0, happiness: 0, desc: 'Pakan standar untuk mengisi perut pet.' },
  FOOD_PREMIUM: { id: 'FOOD_PREMIUM', name: '🥩 Daging Premium', price: 350, hunger: 70, thirst: 0, hp: 10, happiness: 5, desc: 'Daging lezat kualitas prima. Menambah Kenyangan & HP.' },
  WATER: { id: 'WATER', name: '🥤 Air Bersih', price: 100, hunger: 0, thirst: 35, hp: 0, happiness: 0, desc: 'Air mineral segar untuk hidrasi pet.' },
  MEDICINE: { id: 'MEDICINE', name: '💊 Ramuan Kesehatan', price: 500, hunger: 0, thirst: 0, hp: 50, happiness: 0, cures: true, desc: 'Ramuan penyembuh untuk pet sakit/pingsan.' },
  TOY: { id: 'TOY', name: '⚽ Bola Karet', price: 250, hunger: 0, thirst: 0, hp: 0, happiness: 50, desc: 'Bola karet elastis untuk meningkatkan mood pet.' }
};

// Konfigurasi Spesies Pet
const PET_SPECIES = {
  SLIME: { id: 'SLIME', name: '🟢 Slime', desc: 'Sangat kenyal dan memiliki vitalitas tinggi. (+20 Max HP / Tahan Lapar)' },
  DRAGON: { id: 'DRAGON', name: '🔥 Naga / Dragon', desc: 'Makhluk legendaris bernapas api. Sangat tangguh di PvP Arena (+15% Attack).' },
  CAT: { id: 'CAT', name: '🐱 Kucing / Cat', desc: 'Lincah dan menggemaskan. Peluang mendapat item langka saat Hunt meningkat (+5%).' },
  GOLEM: { id: 'GOLEM', name: '🧱 Golem', desc: 'Terbuat dari batu kokoh. Sangat rajin bekerja (Cooldown Kerja -20 Menit).' }
};

/**
 * Menerapkan lazy decay: menghitung pengurangan status berdasarkan waktu berlalu.
 */
function applyDecay(pet) {
  if (!pet || pet.status === 'EGG' || pet.status === 'DEAD') {
    return pet;
  }

  const now = Math.floor(Date.now() / 1000);
  const elapsedSeconds = now - pet.last_interaction_at;
  const elapsedHours = elapsedSeconds / 3600;

  if (elapsedHours < 0.25) {
    // Kurang dari 15 menit, lewati decay agar hemat query
    return pet;
  }

  // Pengurangan per jam
  let hungerDecayRate = 4;
  let thirstDecayRate = 5;
  let happinessDecayRate = 3;

  // Kelebihan Slime: Mengurangi laju kelaparan & kehausan sebesar 25%
  if (pet.pet_type === 'SLIME') {
    hungerDecayRate = 3;
    thirstDecayRate = 4;
  }

  // Hitung jumlah pengurangan
  const hungerReduction = Math.floor(elapsedHours * hungerDecayRate);
  const thirstReduction = Math.floor(elapsedHours * thirstDecayRate);
  const happinessReduction = Math.floor(elapsedHours * happinessDecayRate);

  let newHunger = Math.max(0, pet.hunger - hungerReduction);
  let newThirst = Math.max(0, pet.thirst - thirstReduction);
  let newHappiness = Math.max(0, pet.happiness - happinessReduction);
  let newHealth = pet.health;

  // Hitung sisa waktu ketika hunger/thirst berada di 0 untuk mengurangi HP
  // Sederhananya, jika status saat ini 0, kurangi HP berdasarkan jam berlebih
  let hungerOverdueHours = 0;
  if (pet.hunger - hungerReduction < 0) {
    const hungerUsedUpHours = pet.hunger / hungerDecayRate;
    hungerOverdueHours = Math.max(0, elapsedHours - hungerUsedUpHours);
  }

  let thirstOverdueHours = 0;
  if (pet.thirst - thirstReduction < 0) {
    const thirstUsedUpHours = pet.thirst / thirstDecayRate;
    thirstOverdueHours = Math.max(0, elapsedHours - thirstUsedUpHours);
  }

  // HP berkurang -5 per jam jika lapar/haus di 0
  const hpReduction = Math.floor((hungerOverdueHours * 5) + (thirstOverdueHours * 5));
  newHealth = Math.max(0, pet.health - hpReduction);

  let newStatus = pet.status;
  if (newHealth <= 0) {
    newStatus = 'DEAD';
    newHealth = 0;
  }

  // Update ke database
  db.run(
    `UPDATE user_pets 
     SET hunger = ?, thirst = ?, happiness = ?, health = ?, status = ?, last_interaction_at = ?
     WHERE user_id = ? AND guild_id = ?`,
    [newHunger, newThirst, newHappiness, newHealth, newStatus, now, pet.user_id, pet.guild_id]
  );

  // Kembalikan objek pet ter-update
  return {
    ...pet,
    hunger: newHunger,
    thirst: newThirst,
    happiness: newHappiness,
    health: newHealth,
    status: newStatus,
    last_interaction_at: now
  };
}

/**
 * Mengambil data pet user di server.
 * Sekaligus mendeteksi penetasan telur dan menerapkan decay.
 */
function getPet(userId, guildId) {
  let pet = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  
  if (!pet) return null;

  const now = Math.floor(Date.now() / 1000);

  // 1. Deteksi penetasan telur
  if (pet.status === 'EGG' && pet.hatch_at <= now) {
    db.run(
      "UPDATE user_pets SET status = 'BABY', last_interaction_at = ? WHERE user_id = ? AND guild_id = ?",
      [now, userId, guildId]
    );
    pet = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  }

  // 2. Terapkan decay status
  return applyDecay(pet);
}

/**
 * Mengadopsi / membeli telur pet baru seharga Rp 1.500.
 */
function adoptPet(userId, guildId, petName, petType) {
  // Validasi input
  const typeUpper = petType.toUpperCase();
  if (!PET_SPECIES[typeUpper]) {
    throw new Error(`Spesies pet tidak valid! Pilihan: ${Object.keys(PET_SPECIES).join(', ')}`);
  }
  if (!petName || petName.trim().length === 0) {
    throw new Error('Harap berikan nama untuk peliharaan Anda!');
  }
  if (petName.length > 25) {
    throw new Error('Nama pet maksimal 25 karakter!');
  }

  // Cek apakah sudah punya pet
  const existingPet = db.get('SELECT status FROM user_pets WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  if (existingPet) {
    if (existingPet.status === 'DEAD') {
      throw new Error('Anda memiliki pet yang sudah mati. Harap reset pet Anda terlebih dahulu sebelum mengadopsi yang baru!');
    }
    throw new Error('Anda sudah memiliki hewan peliharaan di server ini!');
  }

  // Kurangi saldo koin Rp 1.500
  const eggPrice = 1500;
  economy.subtractBalance(userId, guildId, eggPrice, 'PET_ADOPT');

  const now = Math.floor(Date.now() / 1000);
  const hatchDuration = 2 * 3600; // 2 Jam menetaskan telur
  const hatchAt = now + hatchDuration;

  db.run(
    `INSERT INTO user_pets (user_id, guild_id, pet_name, pet_type, status, level, xp, health, hunger, thirst, happiness, last_interaction_at, hatch_at, created_at)
     VALUES (?, ?, ?, ?, 'EGG', 1, 0, 100, 100, 100, 100, ?, ?, ?)`,
    [userId, guildId, petName.trim(), typeUpper, now, hatchAt, now]
  );

  return getPet(userId, guildId);
}

/**
 * Meriset data pet (untuk menghapus pet yang mati / membuang pet).
 */
function resetPet(userId, guildId) {
  const pet = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  if (!pet) {
    throw new Error('Anda tidak memiliki hewan peliharaan untuk diriset.');
  }

  db.transaction(() => {
    db.run('DELETE FROM user_pets WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
    db.run('DELETE FROM pet_inventory WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  })();

  return true;
}

/**
 * Mendapatkan daftar inventory barang pet.
 */
function getInventory(userId, guildId) {
  const inv = db.all('SELECT * FROM pet_inventory WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  
  // Pastikan seluruh item default tercatat minimal 0
  const mapped = {};
  Object.keys(PET_ITEMS).forEach(key => {
    mapped[key] = {
      ...PET_ITEMS[key],
      quantity: 0
    };
  });

  inv.forEach(item => {
    if (mapped[item.item_id]) {
      mapped[item.item_id].quantity = item.quantity;
    }
  });

  return Object.values(mapped);
}

/**
 * Mendapatkan stok kuantitas spesifik item di inventory.
 */
function getItemQuantity(userId, guildId, itemId) {
  const row = db.get('SELECT quantity FROM pet_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?', [userId, guildId, itemId]);
  return row ? row.quantity : 0;
}

/**
 * Membeli item supplies pet dari pet shop.
 */
function buyItem(userId, guildId, itemId, quantity = 1) {
  const qty = parseInt(quantity);
  if (isNaN(qty) || qty <= 0) {
    throw new Error('Jumlah pembelian harus minimal 1!');
  }

  const item = PET_ITEMS[itemId.toUpperCase()];
  if (!item) {
    throw new Error('Item tidak ditemukan di toko pet!');
  }

  const totalPrice = item.price * qty;

  db.transaction(() => {
    // Kurangi koin
    economy.subtractBalance(userId, guildId, totalPrice, 'PET_SHOP_BUY');

    // Tambah kuantitas ke inventory pet
    const exist = db.get('SELECT quantity FROM pet_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?', [userId, guildId, item.id]);
    if (exist) {
      db.run(
        'UPDATE pet_inventory SET quantity = quantity + ? WHERE user_id = ? AND guild_id = ? AND item_id = ?',
        [qty, userId, guildId, item.id]
      );
    } else {
      db.run(
        'INSERT INTO pet_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, ?, ?)',
        [userId, guildId, item.id, qty]
      );
    }
  })();

  return {
    item,
    quantity: qty,
    totalPrice,
    newInventoryQty: getItemQuantity(userId, guildId, item.id)
  };
}

/**
 * Memberikan item perawatan ke pet (Feed, Drink, Play, Cure).
 */
function useItem(userId, guildId, itemId, autoBuy = true) {
  let pet = getPet(userId, guildId);
  if (!pet) {
    throw new Error('Anda tidak memiliki hewan peliharaan!');
  }
  if (pet.status === 'EGG') {
    throw new Error('Pet Anda masih berupa telur! Mengerami telur dengan ketik `.pet` / `.pet hatch`!');
  }
  if (pet.status === 'DEAD') {
    throw new Error('Pet Anda telah meninggal dunia 🪦. Ketik `.pet reset` untuk mengadopsi yang baru.');
  }

  const itemKey = itemId.toUpperCase();
  const item = PET_ITEMS[itemKey];
  if (!item) {
    throw new Error('Item perawatan tidak valid!');
  }

  // 1. Cek stok, jika habis gunakan auto-buy jika diizinkan
  let qty = getItemQuantity(userId, guildId, item.id);
  let didAutoBuy = false;

  if (qty <= 0) {
    if (autoBuy) {
      buyItem(userId, guildId, item.id, 1);
      didAutoBuy = true;
    } else {
      throw new Error(`Anda tidak memiliki **${item.name}**! Beli dulu di toko pet.`);
    }
  }

  // 2. Validasi status spesifik
  if (item.cures && pet.health >= 100) {
    throw new Error('Pet Anda dalam kondisi sangat sehat, tidak memerlukan obat-obatan!');
  }

  // 3. Eksekusi konsumsi item
  db.transaction(() => {
    // Potong kuantitas inventory
    db.run(
      'UPDATE pet_inventory SET quantity = quantity - 1 WHERE user_id = ? AND guild_id = ? AND item_id = ?',
      [userId, guildId, item.id]
    );

    // Update stats pet
    let newHunger = Math.min(100, pet.hunger + item.hunger);
    let newThirst = Math.min(100, pet.thirst + item.thirst);
    let newHappiness = Math.min(100, pet.happiness + item.happiness);
    let newHealth = Math.min(100, pet.health + item.hp);
    const now = Math.floor(Date.now() / 1000);

    // Dapatkan XP dari perawatan (+10 XP per aksi perawatan)
    let newXp = pet.xp + 10;
    let newLevel = pet.level;
    const xpNeeded = pet.level * 100;
    
    let levelUp = false;
    if (newXp >= xpNeeded) {
      newXp = newXp - xpNeeded;
      newLevel += 1;
      newHealth = 100; // Full HP saat naik level
      levelUp = true;
    }

    db.run(
      `UPDATE user_pets 
       SET hunger = ?, thirst = ?, happiness = ?, health = ?, xp = ?, level = ?, last_interaction_at = ?
       WHERE user_id = ? AND guild_id = ?`,
      [newHunger, newThirst, newHappiness, newHealth, newXp, newLevel, now, userId, guildId]
    );
  })();

  const updatedPet = getPet(userId, guildId);
  return {
    pet: updatedPet,
    item,
    didAutoBuy
  };
}

/**
 * Bermain dengan pet (tanpa item, memulihkan +20 happiness, cooldown 15 menit).
 */
function playWithPet(userId, guildId) {
  const pet = getPet(userId, guildId);
  if (!pet) throw new Error('Anda tidak memiliki hewan peliharaan!');
  if (pet.status === 'EGG') throw new Error('Pet Anda masih berupa telur!');
  if (pet.status === 'DEAD') throw new Error('Pet Anda sudah meninggal 🪦.');

  if (pet.happiness >= 100) {
    throw new Error('Pet Anda sudah sangat bahagia dan tidak ingin bermain lagi saat ini!');
  }

  // Beri batas bermain: gratis memulihkan +25 Happiness, +15 XP
  db.transaction(() => {
    let newHappiness = Math.min(100, pet.happiness + 25);
    let newXp = pet.xp + 15;
    let newLevel = pet.level;
    const xpNeeded = pet.level * 100;
    const now = Math.floor(Date.now() / 1000);

    if (newXp >= xpNeeded) {
      newXp = newXp - xpNeeded;
      newLevel += 1;
    }

    db.run(
      `UPDATE user_pets SET happiness = ?, xp = ?, level = ?, last_interaction_at = ? WHERE user_id = ? AND guild_id = ?`,
      [newHappiness, newXp, newLevel, now, userId, guildId]
    );
  })();

  return getPet(userId, guildId);
}

/**
 * Mengirim pet untuk Bekerja (Work) mencari uang aman (cooldown 2 jam).
 */
function sendToWork(userId, guildId) {
  const pet = getPet(userId, guildId);
  if (!pet) throw new Error('Anda tidak memiliki hewan peliharaan!');
  if (pet.status === 'EGG') throw new Error('Pet Anda masih berupa telur!');
  if (pet.status === 'DEAD') throw new Error('Pet Anda sudah meninggal 🪦.');

  // Syarat kerja
  if (pet.health < 30) {
    throw new Error('Pet Anda terlalu lelah atau sakit (HP < 30)! Obati dia terlebih dahulu.');
  }
  if (pet.hunger < 20 || pet.thirst < 20) {
    throw new Error('Pet Anda terlalu lapar atau haus! Beri makan dan minum sebelum bekerja.');
  }

  const now = Math.floor(Date.now() / 1000);

  // Hitung cooldown
  let cooldownDuration = 2 * 3600; // 2 Jam
  // Golem Perk: Cooldown kerja dikurangi 20 menit (1200 detik)
  if (pet.pet_type === 'GOLEM') {
    cooldownDuration -= 20 * 60;
  }

  const nextWorkTime = pet.last_work_at + cooldownDuration;
  if (now < nextWorkTime) {
    const timeLeft = nextWorkTime - now;
    const minLeft = Math.ceil(timeLeft / 60);
    throw new Error(`Pet Anda sedang istirahat. Dia bisa bekerja kembali dalam **${minLeft} menit**.`);
  }

  // Kalkulasi Pendapatan Kerja
  // Level memberikan bonus multiplier
  const baseRewardMin = 150;
  const baseRewardMax = 400;
  let reward = Math.floor(Math.random() * (baseRewardMax - baseRewardMin + 1)) + baseRewardMin;
  
  // Bonus level: +5% pendapatan per level pet
  const levelBonus = Math.floor(reward * (pet.level * 0.05));
  const finalReward = reward + levelBonus;

  // Dampak Kerja: Mengurangi Kenyangan -15, Hidrasi -15, Kebahagiaan -10
  db.transaction(() => {
    // Tambahkan saldo uang bot
    economy.addBalance(userId, guildId, finalReward, 'PET_WORK');

    // Beri XP (+30 XP)
    let newXp = pet.xp + 30;
    let newLevel = pet.level;
    const xpNeeded = pet.level * 100;
    if (newXp >= xpNeeded) {
      newXp = newXp - xpNeeded;
      newLevel += 1;
    }

    const newHunger = Math.max(0, pet.hunger - 15);
    const newThirst = Math.max(0, pet.thirst - 15);
    const newHappiness = Math.max(0, pet.happiness - 10);

    db.run(
      `UPDATE user_pets 
       SET last_work_at = ?, hunger = ?, thirst = ?, happiness = ?, xp = ?, level = ?, last_interaction_at = ?
       WHERE user_id = ? AND guild_id = ?`,
      [now, newHunger, newThirst, newHappiness, newXp, newLevel, now, userId, guildId]
    );
  })();

  return {
    pet: getPet(userId, guildId),
    reward: finalReward,
    baseReward: reward,
    levelBonus
  };
}

/**
 * Mengirim pet untuk Berburu (Hunt) ke dalam hutan liar (cooldown 4 jam).
 */
function sendToHunt(userId, guildId) {
  const pet = getPet(userId, guildId);
  if (!pet) throw new Error('Anda tidak memiliki hewan peliharaan!');
  if (pet.status === 'EGG') throw new Error('Pet Anda masih berupa telur!');
  if (pet.status === 'DEAD') throw new Error('Pet Anda sudah meninggal 🪦.');
  if (pet.status === 'BABY') {
    throw new Error('Pet Anda masih bayi! Dia harus bertumbuh menjadi dewasa (Level >= 10) terlebih dahulu sebelum bisa berburu.');
  }

  // Syarat berburu
  if (pet.health < 50) {
    throw new Error('Kondisi pet Anda terlalu lemah untuk berburu (HP < 50)! Berikan obat.');
  }
  if (pet.happiness < 50) {
    throw new Error('Mood pet Anda terlalu buruk untuk berburu (Kebahagiaan < 50)! Ajak bermain.');
  }

  const now = Math.floor(Date.now() / 1000);
  const cooldownDuration = 4 * 3600; // 4 Jam

  const nextHuntTime = pet.last_hunt_at + cooldownDuration;
  if (now < nextHuntTime) {
    const timeLeft = nextHuntTime - now;
    const minLeft = Math.ceil(timeLeft / 60);
    throw new Error(`Pet Anda masih lelah berburu. Dia bisa pergi berburu lagi dalam **${minLeft} menit**.`);
  }

  // Pendapatan Berburu (Lebih besar namun menguras status)
  const baseRewardMin = 300;
  const baseRewardMax = 800;
  let reward = Math.floor(Math.random() * (baseRewardMax - baseRewardMin + 1)) + baseRewardMin;

  // Cat Perk: Kucing lincah mendapat bonus +15% hunt earnings
  if (pet.pet_type === 'CAT') {
    reward = Math.round(reward * 1.15);
  }

  const levelBonus = Math.floor(reward * (pet.level * 0.05));
  const finalReward = reward + levelBonus;

  // Peluang dapat item langka
  let dropItem = null;
  let dropProb = 0.05; // 5% default
  if (pet.pet_type === 'CAT') {
    dropProb = 0.10; // Kucing perk: +5% (total 10%)
  }

  if (Math.random() < dropProb) {
    // Acak item langka
    const items = ['FOOD_PREMIUM', 'MEDICINE', 'TOY'];
    const selectedItemKey = items[Math.floor(Math.random() * items.length)];
    dropItem = PET_ITEMS[selectedItemKey];

    // Tambahkan item ke inventory
    const exist = db.get('SELECT quantity FROM pet_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?', [userId, guildId, dropItem.id]);
    if (exist) {
      db.run(
        'UPDATE pet_inventory SET quantity = quantity + 1 WHERE user_id = ? AND guild_id = ? AND item_id = ?',
        [userId, guildId, dropItem.id]
      );
    } else {
      db.run(
        'INSERT INTO pet_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, ?, 1)',
        [userId, guildId, dropItem.id]
      );
    }
  }

  // Dampak Berburu: Kenyangan -25, Hidrasi -25, Kebahagiaan -15, HP -10
  db.transaction(() => {
    // Berikan koin
    economy.addBalance(userId, guildId, finalReward, 'PET_HUNT');

    // Beri XP (+60 XP)
    let newXp = pet.xp + 60;
    let newLevel = pet.level;
    const xpNeeded = pet.level * 100;
    if (newXp >= xpNeeded) {
      newXp = newXp - xpNeeded;
      newLevel += 1;
    }

    const newHunger = Math.max(0, pet.hunger - 25);
    const newThirst = Math.max(0, pet.thirst - 25);
    const newHappiness = Math.max(0, pet.happiness - 15);
    const newHealth = Math.max(1, pet.health - 10); // Minimal tersisa 1 HP agar tidak mati seketika saat berburu

    db.run(
      `UPDATE user_pets 
       SET last_hunt_at = ?, hunger = ?, thirst = ?, happiness = ?, health = ?, xp = ?, level = ?, last_interaction_at = ?
       WHERE user_id = ? AND guild_id = ?`,
      [now, newHunger, newThirst, newHappiness, newHealth, newXp, newLevel, now, userId, guildId]
    );
  })();

  return {
    pet: getPet(userId, guildId),
    reward: finalReward,
    levelBonus,
    dropItem
  };
}

/**
 * Menyelesaikan Duel PvP Arena secara Ronde-demi-Ronde (Battle Simulation Engine).
 */
function executePvP(challengerId, opponentId, guildId, betAmount) {
  const challenger = getPet(challengerId, guildId);
  const opponent = getPet(opponentId, guildId);

  if (!challenger) throw new Error('Anda tidak memiliki hewan peliharaan!');
  if (!opponent) throw new Error('Lawan tidak memiliki hewan peliharaan!');

  if (challenger.status === 'EGG' || challenger.status === 'BABY') {
    throw new Error('Pet Anda harus berstatus Dewasa (Level >= 10) untuk bertarung di PvP Arena!');
  }
  if (opponent.status === 'EGG' || opponent.status === 'BABY') {
    throw new Error('Pet lawan masih bayi atau berupa telur! Pertarungan dibatalkan.');
  }

  if (challenger.health < 40) throw new Error('Pet Anda terlalu lemah (HP < 40) untuk bertarung! Obati dia.');
  if (opponent.health < 40) throw new Error('Pet lawan dalam kondisi terlalu lelah (HP < 40) untuk bertarung!');

  // Cek koin kedua pemain
  const chalWallet = economy.getWallet(challengerId, guildId);
  const oppWallet = economy.getWallet(opponentId, guildId);

  if (chalWallet.balance < betAmount) throw new Error(`Saldo koin Anda tidak mencukupi taruhan Rp ${betAmount.toLocaleString('id-ID')}!`);
  if (oppWallet.balance < betAmount) throw new Error(`Saldo koin lawan tidak mencukupi taruhan Rp ${betAmount.toLocaleString('id-ID')}!`);

  // --- BATTLE SIMULATION ---
  const logs = [];
  let chalHP = challenger.health;
  let oppHP = opponent.health;

  // Hitung stats tempur awal
  // Base Attack = Level * 5
  // Dragon Perk: +15% Attack
  const chalBaseAtk = challenger.level * 5;
  const oppBaseAtk = opponent.level * 5;

  const chalAtkMultiplier = challenger.pet_type === 'DRAGON' ? 1.15 : 1.0;
  const oppAtkMultiplier = opponent.pet_type === 'DRAGON' ? 1.15 : 1.0;

  let round = 1;
  const maxRounds = 5;

  while (round <= maxRounds && chalHP > 0 && oppHP > 0) {
    // 1. Giliran Challenger menyerang Opponent
    const chalDmg = Math.round((chalBaseAtk * chalAtkMultiplier * (0.8 + Math.random() * 0.4))); // Fluktuasi 80%-120%
    oppHP = Math.max(0, oppHP - chalDmg);
    logs.push(`⚔️ **Ronde ${round} (Serangan):** **${challenger.pet_name}** menyerang **${opponent.pet_name}** dan memberikan **${chalDmg} DMG**! (HP Lawan: ${oppHP}%)`);

    if (oppHP <= 0) break;

    // 2. Giliran Opponent menyerang Challenger
    const oppDmg = Math.round((oppBaseAtk * oppAtkMultiplier * (0.8 + Math.random() * 0.4)));
    chalHP = Math.max(0, chalHP - oppDmg);
    logs.push(`🛡️ **Ronde ${round} (Balasan):** **${opponent.pet_name}** membalas serang **${challenger.pet_name}** sebesar **${oppDmg} DMG**! (HP Anda: ${chalHP}%)`);

    round++;
  }

  // Tentukan pemenang
  let winnerId = null;
  let loserId = null;
  let winnerName = '';
  let loserName = '';

  if (chalHP > oppHP) {
    winnerId = challengerId;
    loserId = opponentId;
    winnerName = challenger.pet_name;
    loserName = opponent.pet_name;
  } else if (oppHP > chalHP) {
    winnerId = opponentId;
    loserId = challengerId;
    winnerName = opponent.pet_name;
    loserName = challenger.pet_name;
  } else {
    // Seri, potong taruhan dikembalikan utuh (tanpa pemenang)
    return {
      draw: true,
      logs,
      challengerHP: chalHP,
      opponentHP: oppHP,
      challengerName: challenger.pet_name,
      opponentName: opponent.pet_name
    };
  }

  // Distribusi Hadiah (Pajak 5%)
  const tax = Math.floor(betAmount * 2 * 0.05);
  const prizePool = (betAmount * 2) - tax;

  db.transaction(() => {
    // Potong taruhan pecundang
    economy.subtractBalance(loserId, guildId, betAmount, 'PET_PVP_BET_LOST');
    // Tambah taruhan ke pemenang (dikurangi pajak)
    economy.addBalance(winnerId, guildId, prizePool - betAmount, 'PET_PVP_BET_WON'); // Menambah selisih bersih

    // Update HP & Kebahagiaan kedua pet
    // Pemenang kehilangan -10 HP, -5 Kebahagiaan
    // Pecundang kehilangan -30 HP, -20 Kebahagiaan
    const wHP = Math.max(10, (winnerId === challengerId ? chalHP : oppHP) - 10);
    const lHP = Math.max(10, (loserId === challengerId ? chalHP : oppHP) - 30);

    const wHappy = Math.max(20, (winnerId === challengerId ? challenger.happiness : opponent.happiness) - 5);
    const lHappy = Math.max(10, (loserId === challengerId ? challenger.happiness : opponent.happiness) - 25);

    // Beri XP (+50 XP pemenang, +20 XP kalah)
    const updateWinnerXp = (winnerId === challengerId ? challenger.xp : opponent.xp) + 50;
    let wXp = updateWinnerXp;
    let wLevel = (winnerId === challengerId ? challenger.level : opponent.level);
    if (wXp >= wLevel * 100) {
      wXp -= wLevel * 100;
      wLevel++;
    }

    const updateLoserXp = (loserId === challengerId ? challenger.xp : opponent.xp) + 20;
    let lXp = updateLoserXp;
    let lLevel = (loserId === challengerId ? challenger.level : opponent.level);
    if (lXp >= lLevel * 100) {
      lXp -= lLevel * 100;
      lLevel++;
    }

    db.run(
      `UPDATE user_pets SET health = ?, happiness = ?, xp = ?, level = ?, last_interaction_at = ? WHERE user_id = ? AND guild_id = ?`,
      [wHP, wHappy, wXp, wLevel, Math.floor(Date.now() / 1000), winnerId, guildId]
    );

    db.run(
      `UPDATE user_pets SET health = ?, happiness = ?, xp = ?, level = ?, last_interaction_at = ? WHERE user_id = ? AND guild_id = ?`,
      [lHP, lHappy, lXp, lLevel, Math.floor(Date.now() / 1000), loserId, guildId]
    );
  })();

  return {
    draw: false,
    winnerId,
    loserId,
    winnerName,
    loserName,
    prizePool,
    tax,
    logs,
    challengerHP: chalHP,
    opponentHP: oppHP
  };
}

module.exports = {
  PET_ITEMS,
  PET_SPECIES,
  getPet,
  adoptPet,
  resetPet,
  getInventory,
  buyItem,
  useItem,
  playWithPet,
  sendToWork,
  sendToHunt,
  executePvP
};
