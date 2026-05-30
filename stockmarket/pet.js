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

function getXpNeeded(level, trait) {
  const base = level * 100;
  if (trait === 'GENIUS') {
    return Math.round(base * 0.85); // -15% XP cap
  }
  return base;
}

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
  let hpReduction = Math.floor((hungerOverdueHours * 5) + (thirstOverdueHours * 5));
  if (pet.trait === 'STURDY') {
    hpReduction = Math.floor(hpReduction / 2); // Sturdy: HP decay rate halved
  }
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
     WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
    [newHunger, newThirst, newHappiness, newHealth, newStatus, now, pet.user_id, pet.guild_id, pet.pet_name]
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
  let pet = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [userId, guildId]);
  
  if (!pet) {
    // Fallback: jika tidak ada pet aktif tapi ada pet lain, aktifkan pet pertama secara otomatis
    const anyPet = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? LIMIT 1', [userId, guildId]);
    if (anyPet) {
      db.run('UPDATE user_pets SET is_active = 1 WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [userId, guildId, anyPet.pet_name]);
      pet = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [userId, guildId]);
    } else {
      return null;
    }
  }

  const now = Math.floor(Date.now() / 1000);

  // 1. Deteksi penetasan telur
  if (pet.status === 'EGG' && pet.hatch_at <= now) {
    let hatchedTrait = pet.trait || '';
    
    // Jika tidak ada trait (telur toko), ada 15% peluang mendapatkan trait acak
    if (!hatchedTrait && Math.random() < 0.15) {
      const traits = ['MUTANT', 'GENIUS', 'STURDY', 'WARRIOR'];
      hatchedTrait = traits[Math.floor(Math.random() * traits.length)];
    }

    db.run(
      "UPDATE user_pets SET status = 'BABY', last_interaction_at = ?, trait = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?",
      [now, hatchedTrait, userId, guildId, pet.pet_name]
    );
    pet = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [userId, guildId, pet.pet_name]);
  }

  // 1b. Deteksi pertumbuhan dari BABY ke ADULT jika level >= 10
  if (pet.status === 'BABY' && pet.level >= 10) {
    db.run(
      "UPDATE user_pets SET status = 'ADULT', last_interaction_at = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?",
      [now, userId, guildId, pet.pet_name]
    );
    pet = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [userId, guildId, pet.pet_name]);
  }

  // 2. Terapkan decay status
  return applyDecay(pet);
}

/**
 * Mengadopsi / membeli telur pet baru seharga Rp 1.500.
 */
function adoptPet(userId, guildId, petName, petType) {
  // Validasi input
  if (!petType || typeof petType !== 'string') {
    throw new Error('Jenis pet harus berupa teks yang valid!');
  }
  const typeUpper = petType.trim().toUpperCase();
  if (!PET_SPECIES[typeUpper]) {
    throw new Error(`Spesies pet tidak valid! Pilihan: ${Object.keys(PET_SPECIES).join(', ')}`);
  }
  if (!petName || petName.trim().length === 0) {
    throw new Error('Harap berikan nama untuk peliharaan Anda!');
  }
  
  // Sanitasi Nama Pet dari sebutan Discord
  const sanitizedName = petName.replace(/<@!?\d*>|<@&\d*>|<#\d*>|@everyone|@here/g, '').trim();
  if (sanitizedName.length === 0) {
    throw new Error('Nama pet tidak valid setelah dibersihkan dari sebutan!');
  }
  if (sanitizedName.length > 25) {
    throw new Error('Nama pet maksimal 25 karakter!');
  }

  // Hitung jumlah pet yang sudah dimiliki
  const petsCountRow = db.get('SELECT COUNT(*) as count FROM user_pets WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  const petsCount = petsCountRow ? petsCountRow.count : 0;
  if (petsCount >= 3) {
    throw new Error('Anda sudah mencapai batas maksimal **3 peliharaan**! Hapus salah satu pet terlebih dahulu.');
  }

  // Cek apakah ada pet dengan nama yang sama (case-insensitive)
  const nameExists = db.get('SELECT 1 FROM user_pets WHERE user_id = ? AND guild_id = ? AND LOWER(pet_name) = LOWER(?)', [userId, guildId, sanitizedName.toLowerCase()]);
  if (nameExists) {
    throw new Error(`Anda sudah memiliki peliharaan dengan nama **"${sanitizedName}"**! Harap gunakan nama lain.`);
  }

  // Kurangi saldo koin Rp 1.500
  const eggPrice = 1500;
  economy.subtractBalance(userId, guildId, eggPrice, 'PET_ADOPT');

  const now = Math.floor(Date.now() / 1000);
  const hatchDuration = 2 * 3600; // 2 Jam menetaskan telur
  const hatchAt = now + hatchDuration;

  // Jika ini pet pertama, set is_active = 1, jika tidak set 0
  const isActive = petsCount === 0 ? 1 : 0;

  db.run(
    `INSERT INTO user_pets (user_id, guild_id, pet_name, pet_type, status, level, xp, health, hunger, thirst, happiness, last_interaction_at, hatch_at, created_at, is_active)
     VALUES (?, ?, ?, ?, 'EGG', 1, 0, 100, 100, 100, 100, ?, ?, ?, ?)`,
    [userId, guildId, sanitizedName, typeUpper, now, hatchAt, now, isActive]
  );

  return db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [userId, guildId, sanitizedName]);
}

/**
 * Meriset data pet (untuk menghapus pet yang mati / membuang pet).
 */
function resetPet(userId, guildId) {
  const pet = getPet(userId, guildId);
  if (!pet) {
    throw new Error('Anda tidak memiliki peliharaan aktif untuk di-reset.');
  }

  db.transaction(() => {
    db.run('DELETE FROM user_pets WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [userId, guildId, pet.pet_name]);
    
    // Cek sisa pet
    const remainingRow = db.get('SELECT COUNT(*) as count FROM user_pets WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
    const remaining = remainingRow ? remainingRow.count : 0;
    
    if (remaining === 0) {
      db.run('DELETE FROM pet_inventory WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
    } else {
      // Aktifkan pet tersisa lainnya secara otomatis
      const nextPet = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? LIMIT 1', [userId, guildId]);
      if (nextPet) {
        db.run('UPDATE user_pets SET is_active = 1 WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [userId, guildId, nextPet.pet_name]);
      }
    }
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

  // 2. Validasi status spesifik dengan batas HP dinamis (Slime memiliki max HP 120)
  const maxHP = pet.pet_type === 'SLIME' ? 120 : 100;
  if (item.cures && pet.health >= maxHP) {
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
    let newHealth = Math.min(maxHP, pet.health + item.hp);
    const now = Math.floor(Date.now() / 1000);

    // Dapatkan XP dari perawatan (+10 XP per aksi perawatan)
    let newXp = pet.xp + 10;
    let newLevel = pet.level;
    const xpNeeded = getXpNeeded(pet.level, pet.trait);
    
    let levelUp = false;
    if (newXp >= xpNeeded) {
      newXp = newXp - xpNeeded;
      newLevel += 1;
      newHealth = maxHP; // Full HP saat naik level
      levelUp = true;
    }

    db.run(
      `UPDATE user_pets 
       SET hunger = ?, thirst = ?, happiness = ?, health = ?, xp = ?, level = ?, last_interaction_at = ?
       WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
      [newHunger, newThirst, newHappiness, newHealth, newXp, newLevel, now, userId, guildId, pet.pet_name]
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

  // Cek cooldown bermain (15 menit)
  const now = Math.floor(Date.now() / 1000);
  const cooldownDuration = 15 * 60; // 15 Menit
  const nextPlayTime = (pet.last_play_at || 0) + cooldownDuration;
  if (now < nextPlayTime) {
    const timeLeft = nextPlayTime - now;
    const minLeft = Math.ceil(timeLeft / 60);
    throw new Error(`Pet Anda masih lelah bermain. Ajak dia bermain lagi dalam **${minLeft} menit**.`);
  }

  // Beri batas bermain: gratis memulihkan +25 Happiness, +15 XP
  db.transaction(() => {
    let newHappiness = Math.min(100, pet.happiness + 25);
    let newXp = pet.xp + 15;
    let newLevel = pet.level;
    const xpNeeded = getXpNeeded(pet.level, pet.trait);

    if (newXp >= xpNeeded) {
      newXp = newXp - xpNeeded;
      newLevel += 1;
    }

    db.run(
      `UPDATE user_pets SET happiness = ?, xp = ?, level = ?, last_interaction_at = ?, last_play_at = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
      [newHappiness, newXp, newLevel, now, now, userId, guildId, pet.pet_name]
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

  const nextWorkTime = (pet.last_work_at || 0) + cooldownDuration;
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
  let finalReward = reward + levelBonus;
  if (pet.trait === 'MUTANT') {
    finalReward = Math.round(finalReward * 1.10); // Mutant: +10% work earnings
  }

  // Dampak Kerja: Mengurangi Kenyangan -15, Hidrasi -15, Kebahagiaan -10
  db.transaction(() => {
    // Tambahkan saldo uang bot
    economy.addBalance(userId, guildId, finalReward, 'PET_WORK');

    // Beri XP (+30 XP)
    let newXp = pet.xp + 30;
    let newLevel = pet.level;
    const xpNeeded = getXpNeeded(pet.level, pet.trait);
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
       WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
      [now, newHunger, newThirst, newHappiness, newXp, newLevel, now, userId, guildId, pet.pet_name]
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

  const nextHuntTime = (pet.last_hunt_at || 0) + cooldownDuration;
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
  let finalReward = reward + levelBonus;
  if (pet.trait === 'MUTANT') {
    finalReward = Math.round(finalReward * 1.10); // Mutant: +10% hunt earnings
  }

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
    const xpNeeded = getXpNeeded(pet.level, pet.trait);
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
       WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
      [now, newHunger, newThirst, newHappiness, newHealth, newXp, newLevel, now, userId, guildId, pet.pet_name]
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

  let chalAtkMultiplier = challenger.pet_type === 'DRAGON' ? 1.15 : 1.0;
  if (challenger.trait === 'WARRIOR') chalAtkMultiplier += 0.10; // Warrior: +10% attack

  let oppAtkMultiplier = opponent.pet_type === 'DRAGON' ? 1.15 : 1.0;
  if (opponent.trait === 'WARRIOR') oppAtkMultiplier += 0.10; // Warrior: +10% attack

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
    const winnerPet = winnerId === challengerId ? challenger : opponent;
    const updateWinnerXp = winnerPet.xp + 50;
    let wXp = updateWinnerXp;
    let wLevel = winnerPet.level;
    const wXpNeeded = getXpNeeded(wLevel, winnerPet.trait);
    if (wXp >= wXpNeeded) {
      wXp -= wXpNeeded;
      wLevel++;
    }

    const loserPet = loserId === challengerId ? challenger : opponent;
    const updateLoserXp = loserPet.xp + 20;
    let lXp = updateLoserXp;
    let lLevel = loserPet.level;
    const lXpNeeded = getXpNeeded(lLevel, loserPet.trait);
    if (lXp >= lXpNeeded) {
      lXp -= lXpNeeded;
      lLevel++;
    }

    db.run(
      `UPDATE user_pets SET health = ?, happiness = ?, xp = ?, level = ?, last_interaction_at = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
      [wHP, wHappy, wXp, wLevel, Math.floor(Date.now() / 1000), winnerId, guildId, winnerName]
    );

    db.run(
      `UPDATE user_pets SET health = ?, happiness = ?, xp = ?, level = ?, last_interaction_at = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
      [lHP, lHappy, lXp, lLevel, Math.floor(Date.now() / 1000), loserId, guildId, loserName]
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

function getPetsList(userId, guildId) {
  const pets = db.all('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  return pets.map(pet => applyDecay(pet));
}

function switchActivePet(userId, guildId, petName) {
  const pet = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND LOWER(pet_name) = LOWER(?)', [userId, guildId, petName.trim()]);
  if (!pet) {
    throw new Error(`Pet dengan nama "${petName}" tidak ditemukan!`);
  }
  
  db.transaction(() => {
    db.run('UPDATE user_pets SET is_active = 0 WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
    db.run('UPDATE user_pets SET is_active = 1 WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [userId, guildId, pet.pet_name]);
  })();
  
  return pet;
}

/**
 * Breeding Pet (Kawin Silang): Mengawinkan dua pet aktif dewasa.
 */
function breedPets(challengerId, partnerId, guildId, newPetName) {
  const challenger = getPet(challengerId, guildId);
  const partner = getPet(partnerId, guildId);

  if (!challenger) throw new Error('Anda tidak memiliki hewan peliharaan aktif!');
  if (!partner) throw new Error('Partner tidak memiliki hewan peliharaan aktif!');

  if (challenger.status !== 'ADULT') {
    throw new Error(`Pet Anda **${challenger.pet_name}** belum dewasa! Dia harus bertumbuh hingga Level >= 10.`);
  }
  if (partner.status !== 'ADULT') {
    throw new Error(`Pet partner **${partner.pet_name}** belum dewasa! Harus bertumbuh hingga Level >= 10.`);
  }

  if (challenger.health < 50 || challenger.happiness < 50) {
    throw new Error(`Pet Anda **${challenger.pet_name}** terlalu lelah atau stress untuk kawin (HP/Mood harus >= 50)!`);
  }
  if (partner.health < 50 || partner.happiness < 50) {
    throw new Error(`Pet partner **${partner.pet_name}** terlalu lelah atau stress untuk kawin (HP/Mood harus >= 50)!`);
  }

  // Cek Cooldown (24 jam = 86400 detik)
  const now = Math.floor(Date.now() / 1000);
  const cooldownSecs = 24 * 3600;
  if (now - (challenger.last_breed_at || 0) < cooldownSecs) {
    const remaining = cooldownSecs - (now - (challenger.last_breed_at || 0));
    const hours = Math.ceil(remaining / 3600);
    throw new Error(`Pet Anda sedang lelah. Bisa kawin lagi dalam **${hours} jam**.`);
  }
  if (now - (partner.last_breed_at || 0) < cooldownSecs) {
    const remaining = cooldownSecs - (now - (partner.last_breed_at || 0));
    const hours = Math.ceil(remaining / 3600);
    throw new Error(`Pet partner sedang lelah. Bisa kawin lagi dalam **${hours} jam**.`);
  }

  // Cek Kandang / Slot Pet Pemohon (Maksimal 3 pet)
  const chalCountRow = db.get('SELECT COUNT(*) as count FROM user_pets WHERE user_id = ? AND guild_id = ?', [challengerId, guildId]);
  const chalCount = chalCountRow ? chalCountRow.count : 0;
  if (chalCount >= 3) {
    throw new Error('Kandang Anda sudah penuh (maksimal 3 peliharaan)! Hapus atau reset pet terlebih dahulu.');
  }

  if (!newPetName || newPetName.trim().length === 0) {
    throw new Error('Harap tentukan nama untuk bayi pet baru Anda!');
  }
  const sanitizedName = newPetName.replace(/<@!?\d*>|<@&\d*>|<#\d*>|@everyone|@here/g, '').trim();
  if (sanitizedName.length === 0) {
    throw new Error('Nama pet tidak valid setelah dibersihkan dari sebutan!');
  }
  if (sanitizedName.length > 25) {
    throw new Error('Nama pet maksimal 25 karakter!');
  }

  // Cek Nama Duplikat
  const nameExists = db.get('SELECT 1 FROM user_pets WHERE user_id = ? AND guild_id = ? AND LOWER(pet_name) = LOWER(?)', [challengerId, guildId, sanitizedName.toLowerCase()]);
  if (nameExists) {
    throw new Error(`Anda sudah memiliki peliharaan dengan nama **"${sanitizedName}"**! Harap gunakan nama lain.`);
  }

  // Cek Saldo (Rp 800 per orang)
  const breedFee = 800;
  const chalWallet = economy.getWallet(challengerId, guildId);
  const partWallet = economy.getWallet(partnerId, guildId);

  if (chalWallet.balance < breedFee) {
    throw new Error(`Saldo Anda kurang untuk biaya perkawinan sebesar Rp ${breedFee}!`);
  }
  if (partWallet.balance < breedFee) {
    throw new Error(`Saldo partner Anda kurang untuk biaya perkawinan sebesar Rp ${breedFee}!`);
  }

  // Eksekusi Breeding
  let childType = Math.random() < 0.5 ? challenger.pet_type : partner.pet_type;
  
  // Tentukan Trait Spesial (30% peluang)
  let trait = '';
  if (Math.random() < 0.30) {
    const traits = ['MUTANT', 'GENIUS', 'STURDY', 'WARRIOR'];
    trait = traits[Math.floor(Math.random() * traits.length)];
  }

  const hatchDuration = 4 * 3600; // 4 Jam penetasan telur hybrid
  const hatchAt = now + hatchDuration;

  db.transaction(() => {
    // Potong koin
    economy.subtractBalance(challengerId, guildId, breedFee, 'PET_BREED_FEE');
    economy.subtractBalance(partnerId, guildId, breedFee, 'PET_BREED_FEE');

    // Update cooldown kedua orang tua
    db.run('UPDATE user_pets SET last_breed_at = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [now, challengerId, guildId, challenger.pet_name]);
    db.run('UPDATE user_pets SET last_breed_at = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [now, partnerId, guildId, partner.pet_name]);

    // Masukkan anak sebagai telur tidak aktif
    db.run(
      `INSERT INTO user_pets (user_id, guild_id, pet_name, pet_type, status, level, xp, health, hunger, thirst, happiness, last_interaction_at, hatch_at, created_at, is_active, trait)
       VALUES (?, ?, ?, ?, 'EGG', 1, 0, 100, 100, 100, 100, ?, ?, ?, 0, ?)`,
      [challengerId, guildId, sanitizedName, childType, now, hatchAt, now, trait]
    );
  })();

  return {
    childName: sanitizedName,
    childType,
    trait,
    hatchAt
  };
}

/**
 * Simulasi Ekspedisi Pet Kelompok (Co-op PVE)
 */
function executeExpedition(guildId, participantIds) {
  const activePets = [];
  
  // Ambil pet aktif masing-masing pemain
  participantIds.forEach(pId => {
    const p = getPet(pId, guildId);
    if (p && p.status !== 'DEAD' && p.status !== 'EGG') {
      activePets.push({ userId: pId, pet: p });
    }
  });

  if (activePets.length === 0) {
    throw new Error('Tidak ada pet aktif yang memenuhi syarat ekspedisi!');
  }

  // Pastikan HP pet mencukupi (>= 40)
  const weakPets = activePets.filter(ap => ap.pet.health < 40);
  if (weakPets.length > 0) {
    const names = weakPets.map(wp => `**${wp.pet.pet_name}** (<@${wp.userId}>)`).join(', ');
    throw new Error(`Pet berikut terlalu lelah/HP kurang dari 40: ${names}.`);
  }

  // Pilih Zona Ekspedisi Dinamis berdasarkan jumlah kru
  const kruCount = activePets.length;
  let zoneName = '';
  let difficulty = 20;
  let minReward = 800;
  let maxReward = 1600;

  if (kruCount === 1) {
    zoneName = '🌫️ Hutan Kabut (Foggy Woods)';
    difficulty = 15;
    minReward = 300;
    maxReward = 600;
  } else if (kruCount === 2) {
    zoneName = '🌋 Goa Naga Api (Volcano Dragon Nest)';
    difficulty = 40;
    minReward = 800;
    maxReward = 1400;
  } else {
    zoneName = '🏰 Labirin Kuno Purba (Ancient Labyrinth)';
    difficulty = 70;
    minReward = 1800;
    maxReward = 3000;
  }

  // Kekuatan Tim (Total level pet)
  const teamPower = activePets.reduce((sum, ap) => sum + ap.pet.level, 0);

  // Success Rate = (timPower / difficulty) * 100
  let successRate = Math.round((teamPower / difficulty) * 100);
  if (successRate > 90) successRate = 90;
  if (successRate < 25) successRate = 25;

  const roll = Math.random() * 100;
  const isSuccess = roll < successRate;

  const logs = [];
  const rewards = [];
  const now = Math.floor(Date.now() / 1000);

  if (isSuccess) {
    // Sukses: Koin acak dibagi merata
    const totalPrize = minReward + Math.floor(Math.random() * (maxReward - minReward + 1));
    const prizePerPerson = Math.floor(totalPrize / kruCount);

    db.transaction(() => {
      activePets.forEach(ap => {
        // Berikan Koin
        economy.addBalance(ap.userId, guildId, prizePerPerson, 'PET_EXPEDITION_REWARD');

        // Berikan XP (+50 XP)
        let newXp = ap.pet.xp + 50;
        let newLevel = ap.pet.level;
        const xpNeeded = getXpNeeded(newLevel, ap.pet.trait);
        let levelUp = false;
        if (newXp >= xpNeeded) {
          newXp -= xpNeeded;
          newLevel++;
          levelUp = true;
        }

        // Dampak petualangan sukses: lapar -10, haus -10, kebahagiaan +10
        const newHunger = Math.max(0, ap.pet.hunger - 10);
        const newThirst = Math.max(0, ap.pet.thirst - 10);
        const newHappiness = Math.min(100, ap.pet.happiness + 10);

        db.run(
          `UPDATE user_pets SET xp = ?, level = ?, hunger = ?, thirst = ?, happiness = ?, last_interaction_at = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
          [newXp, newLevel, newHunger, newThirst, newHappiness, now, ap.userId, guildId, ap.pet.pet_name]
        );

        // Peluang 20% mendapat drop item
        let dropText = '';
        if (Math.random() < 0.20) {
          const rand = Math.random();
          if (rand < 0.40) {
            // Pakan Biasa
            db.run("INSERT INTO pet_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'FOOD_BASIC', 1) ON CONFLICT(user_id, guild_id, item_id) DO UPDATE SET quantity = quantity + 1", [ap.userId, guildId]);
            dropText = '🍗 Pakan Pet Biasa';
          } else if (rand < 0.65) {
            // Bola Karet
            db.run("INSERT INTO pet_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'TOY', 1) ON CONFLICT(user_id, guild_id, item_id) DO UPDATE SET quantity = quantity + 1", [ap.userId, guildId]);
            dropText = '⚽ Bola Karet';
          } else if (rand < 0.80) {
            // Ramuan Kesehatan
            db.run("INSERT INTO pet_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'MEDICINE', 1) ON CONFLICT(user_id, guild_id, item_id) DO UPDATE SET quantity = quantity + 1", [ap.userId, guildId]);
            dropText = '💊 Ramuan Kesehatan';
          } else if (rand < 0.90) {
            // Linggis Black Market
            db.run("INSERT INTO user_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'LOCKPICK', 1) ON CONFLICT(user_id, guild_id, item_id) DO UPDATE SET quantity = quantity + 1", [ap.userId, guildId]);
            dropText = '🗝️ Linggis Black Market';
          } else {
            // Sabun Black Market
            db.run("INSERT INTO user_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'SOAP', 1) ON CONFLICT(user_id, guild_id, item_id) DO UPDATE SET quantity = quantity + 1", [ap.userId, guildId]);
            dropText = '🧼 Sabun Licin Black Market';
          }
        }

        rewards.push({
          userId: ap.userId,
          petName: ap.pet.pet_name,
          koin: prizePerPerson,
          xpGained: 50,
          levelUp,
          newLevel,
          dropItem: dropText
        });
      });
    })();

    logs.push(
      `⚔️ Tim pet berhasil menerobos pertahanan bos di **${zoneName}**!`,
      `💥 Dengan koordinasi yang apik, bos zona berhasil ditaklukan dan tumpukan koin jarahan disita!`
    );

    return {
      success: true,
      zoneName,
      teamPower,
      successRate,
      rewards,
      logs
    };
  } else {
    // Tentukan penyebab kegagalan dan kambing hitam (pet yang membuat kalah)
    const failScenarios = [];

    // 1. Skenario: Level paling rendah
    const minLevel = Math.min(...activePets.map(ap => ap.pet.level));
    const lowestLevelPets = activePets.filter(ap => ap.pet.level === minLevel);
    const culpritLevel = lowestLevelPets[Math.floor(Math.random() * lowestLevelPets.length)];
    failScenarios.push({
      culprit: culpritLevel,
      reason: `Pet **${culpritLevel.pet.pet_name}** milik <@${culpritLevel.userId}> yang berlevel paling rendah (Lv. ${culpritLevel.pet.level}) gemetar ketakutan melihat Bos Zona dan bersembunyi di balik semak-semak, membuat barisan tempur hancur!`
    });

    // 2. Skenario: HP paling rendah (< 60)
    const lowHpPets = activePets.filter(ap => ap.pet.health < 60);
    if (lowHpPets.length > 0) {
      const culpritHp = lowHpPets[Math.floor(Math.random() * lowHpPets.length)];
      failScenarios.push({
        culprit: culpritHp,
        reason: `Pet **${culpritHp.pet.pet_name}** milik <@${culpritHp.userId}> kehabisan nafas dan kelelahan di tengah jalan (HP hanya ${culpritHp.pet.health}%), memperlambat pergerakan seluruh tim!`
      });
    }

    // 3. Skenario: Kebahagiaan paling rendah (< 60)
    const lowHappyPets = activePets.filter(ap => ap.pet.happiness < 60);
    if (lowHappyPets.length > 0) {
      const culpritHappy = lowHappyPets[Math.floor(Math.random() * lowHappyPets.length)];
      failScenarios.push({
        culprit: culpritHappy,
        reason: `Pet **${culpritHappy.pet.pet_name}** milik <@${culpritHappy.userId}> sedang bad mood / malas-malasan (Kebahagiaan ${culpritHappy.pet.happiness}%) sehingga tidak fokus menyerang bos!`
      });
    }

    // 4. Skenario: Kejadian konyol acak
    const randomCulprit = activePets[Math.floor(Math.random() * activePets.length)];
    const funnyAccidents = [
      `Pet **${randomCulprit.pet.pet_name}** milik <@${randomCulprit.userId}> tidak sengaja terpeleset kulit pisang saat ingin menerjang bos, membuat formasi tim kacau balau!`,
      `Pet **${randomCulprit.pet.pet_name}** milik <@${randomCulprit.userId}> mendadak kebelet pipis di tengah pertarungan sengit, memaksa seluruh tim mundur untuk mencari toilet!`,
      `Pet **${randomCulprit.pet.pet_name}** milik <@${randomCulprit.userId}> terdistraksi oleh kupu-kupu warna-warni yang terbang lewat dan malah mengejarnya sambil mengabaikan bos!`,
      `Pet **${randomCulprit.pet.pet_name}** milik <@${randomCulprit.userId}> malah asyik memakan ransum perbekalan tim sendirian di belakang hingga kekenyangan dan tertidur pulas!`,
      `Pet **${randomCulprit.pet.pet_name}** milik <@${randomCulprit.userId}> salah membaca peta jalan sehingga menuntun tim masuk ke dalam jebakan rawa berlumpur!`
    ];
    funnyAccidents.forEach(accident => {
      failScenarios.push({
        culprit: randomCulprit,
        reason: accident
      });
    });

    // Pilih salah satu skenario secara acak
    const selectedScenario = failScenarios[Math.floor(Math.random() * failScenarios.length)];

    // Gagal: Pet terluka (-30 HP, -25 Happiness), tapi mendapat +15 XP
    db.transaction(() => {
      activePets.forEach(ap => {
        let newXp = ap.pet.xp + 15;
        let newLevel = ap.pet.level;
        const xpNeeded = getXpNeeded(newLevel, ap.pet.trait);
        let levelUp = false;
        if (newXp >= xpNeeded) {
          newXp -= xpNeeded;
          newLevel++;
          levelUp = true;
        }

        const newHealth = Math.max(5, ap.pet.health - 30);
        const newHappiness = Math.max(10, ap.pet.happiness - 25);
        const newHunger = Math.max(0, ap.pet.hunger - 15);
        const newThirst = Math.max(0, ap.pet.thirst - 15);

        db.run(
          `UPDATE user_pets SET xp = ?, level = ?, health = ?, happiness = ?, hunger = ?, thirst = ?, last_interaction_at = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
          [newXp, newLevel, newHealth, newHappiness, newHunger, newThirst, now, ap.userId, guildId, ap.pet.pet_name]
        );

        rewards.push({
          userId: ap.userId,
          petName: ap.pet.pet_name,
          koin: 0,
          xpGained: 15,
          levelUp,
          newLevel
        });
      });
    })();

    logs.push(
      `😢 Tim pet dipaksa mundur dari **${zoneName}** oleh bos penjaga yang terlampau kuat!`,
      `💥 **Penyebab Kegagalan:**\n${selectedScenario.reason}`,
      `🩸 Seluruh pet menderita luka-luka ringan dan stress, tapi membawa pulang sedikit pengalaman tempur.`
    );

    return {
      success: false,
      zoneName,
      teamPower,
      successRate,
      rewards,
      logs
    };
  }
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
  executePvP,
  getPetsList,
  switchActivePet,
  breedPets,
  executeExpedition,
  getXpNeeded
};
