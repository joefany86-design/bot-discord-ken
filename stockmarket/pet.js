const db = require('./database');
const economy = require('./economy');
const config = require('./config');

// Konfigurasi Item Kebutuhan Pet
const PET_ITEMS = {
  FOOD_BASIC: { id: 'FOOD_BASIC', name: '🍗 Pakan Pet Biasa', price: 150, hunger: 30, thirst: 0, hp: 0, happiness: 0, desc: 'Pakan standar untuk mengisi perut pet.' },
  FOOD_PREMIUM: { id: 'FOOD_PREMIUM', name: '🥩 Daging Premium', price: 350, hunger: 70, thirst: 0, hp: 10, happiness: 5, desc: 'Daging lezat kualitas prima. Menambah Kenyangan & HP.' },
  WATER: { id: 'WATER', name: '🥤 Air Bersih', price: 100, hunger: 0, thirst: 35, hp: 0, happiness: 0, desc: 'Air mineral segar untuk hidrasi pet.' },
  MEDICINE: { id: 'MEDICINE', name: '💊 Ramuan Kesehatan', price: 500, hunger: 0, thirst: 0, hp: 50, happiness: 0, cures: true, desc: 'Ramuan penyembuh untuk pet sakit/pingsan.' },
  TOY: { id: 'TOY', name: '⚽ Bola Karet', price: 250, hunger: 0, thirst: 0, hp: 0, happiness: 50, desc: 'Bola karet elastis untuk meningkatkan mood pet.' },
  XP_2X: { id: 'XP_2X', name: '⚡ XP Booster 2x', price: 2500, hunger: 0, thirst: 0, hp: 0, happiness: 0, multiplier: 2.0, desc: 'Booster energi untuk mempercepat peningkatan XP pet sebesar 2x secara permanen.' },
  XP_4X: { id: 'XP_4X', name: '⚡ XP Booster 4x', price: 5000, hunger: 0, thirst: 0, hp: 0, happiness: 0, multiplier: 4.0, desc: 'Booster energi untuk mempercepat peningkatan XP pet sebesar 4x secara permanen.' },
  XP_6X: { id: 'XP_6X', name: '⚡ XP Booster 6x', price: 7500, hunger: 0, thirst: 0, hp: 0, happiness: 0, multiplier: 6.0, desc: 'Booster energi untuk mempercepat peningkatan XP pet sebesar 6x secara permanen.' },
  XP_8X: { id: 'XP_8X', name: '⚡ XP Booster 8x', price: 10000, hunger: 0, thirst: 0, hp: 0, happiness: 0, multiplier: 8.0, desc: 'Booster energi untuk mempercepat peningkatan XP pet sebesar 8x secara permanen.' }
};

// Konfigurasi Spesies Pet
const PET_SPECIES = {
  SLIME: { id: 'SLIME', name: '🟢 Slime', desc: 'Sangat kenyal dan memiliki vitalitas tinggi. (+20 Max HP / Tahan Lapar)' },
  DRAGON: { id: 'DRAGON', name: '🔥 Naga / Dragon', desc: 'Makhluk legendaris bernapas api. Sangat tangguh di PvP Arena (+15% Attack).' },
  CAT: { id: 'CAT', name: '🐱 Kucing / Cat', desc: 'Lincah dan menggemaskan. Peluang mendapat item langka saat Hunt meningkat (+5%).' },
  GOLEM: { id: 'GOLEM', name: '🧱 Golem', desc: 'Terbuat dari batu kokoh. Sangat rajin bekerja (Cooldown Kerja -20 Menit).' }
};

// Konfigurasi Peta Ekspedisi Pet (Co-op PVE)
const EXPEDITION_MAPS = [
  {
    id: 1,
    name: '🌲 Hutan Pemula (Beginner Forest)',
    recommendedLevel: 1,
    baseSuccessRate: 85,
    minPrize: 200,
    maxPrize: 400,
    description: 'Hutan rindang bersahabat dengan kelinci liar & jamur kecil.'
  },
  {
    id: 2,
    name: 'BAT Gua Gelap (Dark Cave)',
    recommendedLevel: 10,
    baseSuccessRate: 65,
    minPrize: 400,
    maxPrize: 800,
    description: 'Lorong gua basah penuh kelelawar penghisap darah & laba-laba raksasa.'
  },
  {
    id: 3,
    name: 'VOL Lembah Api (Fire Valley)',
    recommendedLevel: 25,
    baseSuccessRate: 45,
    minPrize: 800,
    maxPrize: 1500,
    description: 'Ngarai panas berpijar dengan naga api liar dan golem magma raksasa.'
  },
  {
    id: 4,
    name: 'CAS Istana Kuno (Ancient Palace)',
    recommendedLevel: 40,
    baseSuccessRate: 25,
    minPrize: 1500,
    maxPrize: 2500,
    description: 'Reruntuhan istana misterius yang dijaga oleh iblis kuno bermata satu.'
  }
];

function getXpNeeded(level, trait) {
  const base = level * 100;
  if (trait === 'GENIUS') {
    return Math.round(base * 0.80); // -20% XP cap (GENIUS leveling bonus!)
  }
  return base;
}

/**
 * Menambahkan XP ke pet dan memproses kemungkinan naik level berulang kali (recursive/iterative level up)
 */
function addXp(pet, xpGained, maxHP) {
  let newXp = pet.xp + xpGained;
  let newLevel = pet.level;
  let levelUp = false;

  while (true) {
    const xpNeeded = getXpNeeded(newLevel, pet.trait);
    if (newXp >= xpNeeded) {
      newXp -= xpNeeded;
      newLevel += 1;
      levelUp = true;
    } else {
      break;
    }
  }

  return { newXp, newLevel, levelUp };
}

/**
 * Menerapkan lazy decay: menghitung pengurangan status berdasarkan waktu berlalu.
 */
function applyDecay(pet) {
  if (!pet) {
    return pet;
  }

  if (pet.pet_name.toLowerCase() === 'ramzi' && pet.user_id === '436554535037698059') {
    const now = Math.floor(Date.now() / 1000);
    const maxHP = 100;
    db.run(
      `UPDATE user_pets 
       SET hunger = 100, thirst = 100, happiness = 100, health = ?, status = 'ADULT', last_interaction_at = ?
       WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
      [maxHP, now, pet.user_id, pet.guild_id, pet.pet_name]
    );
    return {
      ...pet,
      hunger: 100,
      thirst: 100,
      happiness: 100,
      health: maxHP,
      status: 'ADULT',
      last_interaction_at: now
    };
  }

  if (pet.status === 'EGG' || pet.status === 'DEAD') {
    return pet;
  }

  const now = Math.floor(Date.now() / 1000);
  const elapsedSeconds = now - pet.last_interaction_at;
  const elapsedHours = elapsedSeconds / 3600;

  if (elapsedHours < 0.25) {
    return pet;
  }

  let hungerDecayRate = 4;
  let thirstDecayRate = 5;
  let happinessDecayRate = 3;

  if (pet.pet_type === 'SLIME') {
    hungerDecayRate = 3;
    thirstDecayRate = 4;
  }

  // Trait STURDY: mengurangi laju decay status sebesar 40% (perkalian 0.60)
  if (pet.trait === 'STURDY') {
    hungerDecayRate = Number((hungerDecayRate * 0.60).toFixed(2));
    thirstDecayRate = Number((thirstDecayRate * 0.60).toFixed(2));
    happinessDecayRate = Number((happinessDecayRate * 0.60).toFixed(2));
  }

  let newHunger = pet.hunger;
  let newThirst = pet.thirst;
  let newHappiness = pet.happiness;
  let newHealth = pet.health;

  let hungerOverdueHours = 0;
  let thirstOverdueHours = 0;

  const wallet = db.get('SELECT balance FROM wallets WHERE user_id = ? AND guild_id = ?', [pet.user_id, pet.guild_id]);
  let balance = wallet ? wallet.balance : 0;
  let balanceChanged = false;

  const hoursToSimulate = Math.floor(elapsedHours);
  const fractionalHour = elapsedHours - hoursToSimulate;

  for (let h = 0; h < hoursToSimulate; h++) {
    newHunger = Math.max(0, newHunger - hungerDecayRate);
    newThirst = Math.max(0, newThirst - thirstDecayRate);
    newHappiness = Math.max(0, newHappiness - happinessDecayRate);

    if (pet.auto_feed === 1 || pet.auto_feed === 2) {
      const isVip = pet.auto_feed === 2;
      if (newHunger <= 50 && (isVip || balance >= 150)) {
        if (!isVip) {
          balance -= 150;
          balanceChanged = true;
        }
        newHunger = Math.min(100, newHunger + 30);
      }
      if (newThirst <= 50 && (isVip || balance >= 100)) {
        if (!isVip) {
          balance -= 100;
          balanceChanged = true;
        }
        newThirst = Math.min(100, newThirst + 35);
      }
    }

    if (newHunger === 0) hungerOverdueHours += 1;
    if (newThirst === 0) thirstOverdueHours += 1;
  }

  if (fractionalHour > 0) {
    newHunger = Math.max(0, newHunger - (fractionalHour * hungerDecayRate));
    newThirst = Math.max(0, newThirst - (fractionalHour * thirstDecayRate));
    newHappiness = Math.max(0, newHappiness - (fractionalHour * happinessDecayRate));

    if (pet.auto_feed === 1 || pet.auto_feed === 2) {
      const isVip = pet.auto_feed === 2;
      if (newHunger <= 50 && (isVip || balance >= 150)) {
        if (!isVip) {
          balance -= 150;
          balanceChanged = true;
        }
        newHunger = Math.min(100, newHunger + 30);
      }
      if (newThirst <= 50 && (isVip || balance >= 100)) {
        if (!isVip) {
          balance -= 100;
          balanceChanged = true;
        }
        newThirst = Math.min(100, newThirst + 35);
      }
    }

    if (newHunger === 0) hungerOverdueHours += fractionalHour;
    if (newThirst === 0) thirstOverdueHours += fractionalHour;
  }

  if (balanceChanged && wallet) {
    db.run('UPDATE wallets SET balance = ? WHERE user_id = ? AND guild_id = ?', [balance, pet.user_id, pet.guild_id]);
  }

  let hpReduction = Math.floor((hungerOverdueHours * 5) + (thirstOverdueHours * 5));
  if (pet.trait === 'STURDY') {
    hpReduction = Math.floor(hpReduction / 2);
  }
  newHealth = Math.max(0, newHealth - hpReduction);

  let newStatus = pet.status;
  if (newHealth <= 0) {
    newStatus = 'DEAD';
    newHealth = 0;
  }

  db.run(
    `UPDATE user_pets 
     SET hunger = ?, thirst = ?, happiness = ?, health = ?, status = ?, last_interaction_at = ?
     WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
    [newHunger, newThirst, newHappiness, newHealth, newStatus, now, pet.user_id, pet.guild_id, pet.pet_name]
  );

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
    
    // Jika tidak ada trait (telur toko), ada 35% peluang mendapatkan trait acak
    if (!hatchedTrait && Math.random() < 0.35) {
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
  const hatchDuration = 1 * 3600; // 1 Jam menetaskan telur
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
  if (!item.multiplier && item.cures && pet.health >= maxHP) {
    throw new Error('Pet Anda dalam kondisi sangat sehat, tidak memerlukan obat-obatan!');
  }

  if (item.multiplier) {
    if ((pet.xp_multiplier || 1.0) >= item.multiplier) {
      throw new Error(`Pet Anda sudah memiliki pengali XP **${pet.xp_multiplier || 1.0}x** atau lebih tinggi!`);
    }
  }

  // 3. Eksekusi konsumsi item
  db.transaction(() => {
    // Potong kuantitas inventory
    db.run(
      'UPDATE pet_inventory SET quantity = quantity - 1 WHERE user_id = ? AND guild_id = ? AND item_id = ?',
      [userId, guildId, item.id]
    );

    const now = Math.floor(Date.now() / 1000);

    if (item.multiplier) {
      // Set XP multiplier
      db.run(
        `UPDATE user_pets 
         SET xp_multiplier = ?, last_interaction_at = ?
         WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
        [item.multiplier, now, userId, guildId, pet.pet_name]
      );
    } else {
      // Update stats pet
      let newHunger = Math.min(100, pet.hunger + item.hunger);
      let newThirst = Math.min(100, pet.thirst + item.thirst);
      let newHappiness = Math.min(100, pet.happiness + item.happiness);
      let newHealth = Math.min(maxHP, pet.health + item.hp);

      // Dapatkan XP dari perawatan (+10 XP per aksi perawatan) dikali xp_multiplier
      let xpGained = Math.round(10 * (pet.xp_multiplier || 1.0));
      let { newXp, newLevel, levelUp } = addXp(pet, xpGained, maxHP);
      if (levelUp) {
        newHealth = maxHP; // Full HP saat naik level
      }

      db.run(
        `UPDATE user_pets 
         SET hunger = ?, thirst = ?, happiness = ?, health = ?, xp = ?, level = ?, last_interaction_at = ?
         WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
        [newHunger, newThirst, newHappiness, newHealth, newXp, newLevel, now, userId, guildId, pet.pet_name]
      );

      // Hook quest progress for FEED
      if (item.hunger > 0 || item.thirst > 0) {
        incrementQuestProgress(userId, guildId, 'FEED', 1);
      }
    }
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

  const now = Math.floor(Date.now() / 1000);
  if (pet.curse_type === 'smelly' && pet.curse_until > now) {
    throw new Error(`🦨 **${pet.pet_name}** menutup hidungnya dan berteriak:\n*"Gak mau! Badan aku bau busuk jigong naga! Mandiin aku dulu pake sabun Sultan (\\.pet mandiin)!"*`);
  }

  if (pet.happiness >= 100) {
    throw new Error('Pet Anda sudah sangat bahagia dan tidak ingin bermain lagi saat ini!');
  }

  // Cek cooldown bermain (15 menit)
  const cooldownDuration = 15 * 60; // 15 Menit
  const nextPlayTime = (pet.last_play_at || 0) + cooldownDuration;
  if (now < nextPlayTime) {
    const timeLeft = nextPlayTime - now;
    const minLeft = Math.ceil(timeLeft / 60);
    throw new Error(`Pet Anda masih lelah bermain. Ajak dia bermain lagi dalam **${minLeft} menit**.`);
  }

  // Beri batas bermain: gratis memulihkan +25 Happiness, +15 XP dikali xp_multiplier
  db.transaction(() => {
    let newHappiness = Math.min(100, pet.happiness + 25);
    let xpGained = Math.round(15 * (pet.xp_multiplier || 1.0));
    const maxHP = pet.pet_type === 'SLIME' ? 120 : 100;
    let { newXp, newLevel, levelUp } = addXp(pet, xpGained, maxHP);

    db.run(
      `UPDATE user_pets SET happiness = ?, xp = ?, level = ?, last_interaction_at = ?, last_play_at = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
      [newHappiness, newXp, newLevel, now, now, userId, guildId, pet.pet_name]
    );

    // Hook quest progress for PLAY
    incrementQuestProgress(userId, guildId, 'PLAY', 1);
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

  const now = Math.floor(Date.now() / 1000);
  if (pet.curse_type === 'smelly' && pet.curse_until > now) {
    throw new Error(`🦨 **${pet.pet_name}** menutup hidungnya dan berteriak:\n*"Gak mau! Badan aku bau busuk jigong naga! Mandiin aku dulu pake sabun Sultan (\\.pet mandiin)!"*`);
  }

  // Syarat kerja
  if (pet.health < 30) {
    throw new Error('Pet Anda terlalu lelah atau sakit (HP < 30)! Obati dia terlebih dahulu.');
  }
  if (pet.hunger < 20 || pet.thirst < 20) {
    throw new Error('Pet Anda terlalu lapar atau haus! Beri makan dan minum sebelum bekerja.');
  }

  // Hitung cooldown (Work: 1 Jam)
  let cooldownDuration = 1 * 3600; // 1 Jam
  // Golem Perk: Cooldown kerja dikurangi 20 menit (1200 detik)
  if (pet.pet_type === 'GOLEM') {
    cooldownDuration -= 20 * 60;
  }

  // Integrasi Luxury Shop: Rolex mengurangi cooldown kerja pet sebesar 5 menit (300 detik)
  try {
    const rolexQty = db.get(
      "SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = 'ROLEX'",
      [userId, guildId]
    );
    if (rolexQty && rolexQty.quantity > 0) {
      cooldownDuration -= 5 * 60;
    }
  } catch (e) {
    console.error("Gagal membaca rolex untuk pet work cooldown:", e.message);
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
  
  // Bonus level: +5% pendapatan per level pet (dibatasi di maksimal Level 20 untuk menyeimbangkan ekonomi)
  const levelBonus = Math.floor(reward * (Math.min(20, pet.level) * 0.05));
  let finalReward = reward + levelBonus;
  if (pet.trait === 'MUTANT') {
    finalReward = Math.round(finalReward * 1.15); // Mutant: +15% work earnings
  }

  // Dampak Kerja: Mengurangi Kenyangan -15, Hidrasi -15, Kebahagiaan -10
  db.transaction(() => {
    // Tambahkan saldo uang bot
    economy.addBalance(userId, guildId, finalReward, 'PET_WORK');

    // Beri XP (+30 XP) dikali xp_multiplier
    let xpGained = Math.round(30 * (pet.xp_multiplier || 1.0));
    const maxHP = pet.pet_type === 'SLIME' ? 120 : 100;
    let { newXp, newLevel, levelUp } = addXp(pet, xpGained, maxHP);

    const isGod = pet.pet_name.toLowerCase() === 'ramzi' && pet.user_id === '436554535037698059';
    const newHunger = isGod ? 100 : Math.max(0, pet.hunger - 15);
    const newThirst = isGod ? 100 : Math.max(0, pet.thirst - 15);
    const newHappiness = isGod ? 100 : Math.max(0, pet.happiness - 10);

    db.run(
      `UPDATE user_pets 
       SET last_work_at = ?, hunger = ?, thirst = ?, happiness = ?, xp = ?, level = ?, last_interaction_at = ?
       WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
      [now, newHunger, newThirst, newHappiness, newXp, newLevel, now, userId, guildId, pet.pet_name]
    );

    // Hook quest progress for WORK
    incrementQuestProgress(userId, guildId, 'WORK', 1);
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

  const now = Math.floor(Date.now() / 1000);
  if (pet.curse_type === 'smelly' && pet.curse_until > now) {
    throw new Error(`🦨 **${pet.pet_name}** menutup hidungnya dan berteriak:\n*"Gak mau! Badan aku bau busuk jigong naga! Mandiin aku dulu pake sabun Sultan (\\.pet mandiin)!"*`);
  }
  const isGodPet = pet.pet_name.toLowerCase() === 'ramzi' && pet.user_id === '436554535037698059';
  if (!isGodPet && pet.status === 'BABY') {
    throw new Error('Pet Anda masih bayi! Dia harus bertumbuh menjadi dewasa (Level >= 10) terlebih dahulu sebelum bisa berburu.');
  }

  // Syarat berburu
  if (pet.health < 50) {
    throw new Error('Kondisi pet Anda terlalu lemah untuk berburu (HP < 50)! Berikan obat.');
  }
  if (pet.happiness < 50) {
    throw new Error('Mood pet Anda terlalu buruk untuk berburu (Kebahagiaan < 50)! Ajak bermain.');
  }
  const cooldownDuration = 2 * 3600; // 2 Jam

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

  const levelBonus = Math.floor(reward * (Math.min(20, pet.level) * 0.05));
  let finalReward = reward + levelBonus;
  if (pet.trait === 'MUTANT') {
    finalReward = Math.round(finalReward * 1.15); // Mutant: +15% hunt earnings
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

    // Beri XP (+60 XP) dikali xp_multiplier
    let xpGained = Math.round(60 * (pet.xp_multiplier || 1.0));
    const maxHP = pet.pet_type === 'SLIME' ? 120 : 100;
    let { newXp, newLevel, levelUp } = addXp(pet, xpGained, maxHP);

    const isGod = pet.pet_name.toLowerCase() === 'ramzi' && pet.user_id === '436554535037698059';
    const newHunger = isGod ? 100 : Math.max(0, pet.hunger - 25);
    const newThirst = isGod ? 100 : Math.max(0, pet.thirst - 25);
    const newHappiness = isGod ? 100 : Math.max(0, pet.happiness - 15);
    const newHealth = isGod ? 100 : Math.max(1, pet.health - 10);

    db.run(
      `UPDATE user_pets 
       SET last_hunt_at = ?, hunger = ?, thirst = ?, happiness = ?, health = ?, xp = ?, level = ?, last_interaction_at = ?
       WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
      [now, newHunger, newThirst, newHappiness, newHealth, newXp, newLevel, now, userId, guildId, pet.pet_name]
    );

    // Hook quest progress for HUNT
    incrementQuestProgress(userId, guildId, 'HUNT', 1);
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

  const isGodChallenger = challenger.pet_name.toLowerCase() === 'ramzi' && challenger.user_id === '436554535037698059';
  if (!isGodChallenger && (challenger.status === 'EGG' || challenger.status === 'BABY')) {
    throw new Error('Pet Anda harus berstatus Dewasa (Level >= 10) untuk bertarung di PvP Arena!');
  }

  const isGodOpponent = opponent.pet_name.toLowerCase() === 'ramzi' && opponent.user_id === '436554535037698059';
  if (!isGodOpponent && (opponent.status === 'EGG' || opponent.status === 'BABY')) {
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
  const chalBaseAtk = isGodChallenger ? 99999 : challenger.level * 5;
  const oppBaseAtk = isGodOpponent ? 99999 : opponent.level * 5;

  let chalAtkMultiplier = challenger.pet_type === 'DRAGON' ? 1.15 : 1.0;
  if (challenger.trait === 'WARRIOR') chalAtkMultiplier += 0.15; // Warrior: +15% attack (up from +10%)

  let oppAtkMultiplier = opponent.pet_type === 'DRAGON' ? 1.15 : 1.0;
  if (opponent.trait === 'WARRIOR') oppAtkMultiplier += 0.15; // Warrior: +15% attack (up from +10%)

  let round = 1;
  const maxRounds = 5;

  while (round <= maxRounds && chalHP > 0 && oppHP > 0) {
    // 1. Giliran Challenger menyerang Opponent
    let chalDmg;
    if (isGodChallenger) {
      chalDmg = 999999;
      oppHP = 0;
      logs.push(`⚔️ **Ronde ${round} (Serangan):** 🔥 **${challenger.pet_name}** meluncurkan serangan mematikan *Insta-Kill* dan memberikan **${chalDmg} DMG**! (HP Lawan: 0%)`);
    } else if (isGodOpponent) {
      chalDmg = 0;
      logs.push(`⚔️ **Ronde ${round} (Serangan):** **${challenger.pet_name}** menyerang **${opponent.pet_name}**, namun serangan memantul sia-sia! **0 DMG** diberikan. (HP Lawan: 100%)`);
    } else {
      chalDmg = Math.round((chalBaseAtk * chalAtkMultiplier * (0.8 + Math.random() * 0.4))); // Fluktuasi 80%-120%
      if (opponent.trait === 'STURDY') {
        chalDmg = Math.round(chalDmg * 0.85); // Sturdy: -15% incoming damage (15% defense)
      }
      oppHP = Math.max(0, oppHP - chalDmg);
      logs.push(`⚔️ **Ronde ${round} (Serangan):** **${challenger.pet_name}** menyerang **${opponent.pet_name}** dan memberikan **${chalDmg} DMG**! (HP Lawan: ${oppHP}%)`);
    }

    if (oppHP <= 0) break;

    // 2. Giliran Opponent menyerang Challenger
    let oppDmg;
    if (isGodOpponent) {
      oppDmg = 999999;
      chalHP = 0;
      logs.push(`🛡️ **Ronde ${round} (Balasan):** 🔥 **${opponent.pet_name}** membalas dengan tatapan mematikan *Insta-Kill* sebesar **${oppDmg} DMG**! (HP Anda: 0%)`);
    } else if (isGodChallenger) {
      oppDmg = 0;
      logs.push(`🛡️ **Ronde ${round} (Balasan):** **${opponent.pet_name}** membalas serang **${challenger.pet_name}**, namun serangan tidak terasa! **0 DMG** diberikan. (HP Anda: 100%)`);
    } else {
      oppDmg = Math.round((oppBaseAtk * oppAtkMultiplier * (0.8 + Math.random() * 0.4)));
      if (challenger.trait === 'STURDY') {
        oppDmg = Math.round(oppDmg * 0.85); // Sturdy: -15% incoming damage (15% defense)
      }
      chalHP = Math.max(0, chalHP - oppDmg);
      logs.push(`🛡️ **Ronde ${round} (Balasan):** **${opponent.pet_name}** membalas serang **${challenger.pet_name}** sebesar **${oppDmg} DMG**! (HP Anda: ${chalHP}%)`);
    }

    round++;
  }

  // Tentukan pemenang
  let winnerId = null;
  let loserId = null;
  let winnerName = '';
  let loserName = '';

  if (isGodChallenger) {
    winnerId = challengerId;
    loserId = opponentId;
    winnerName = challenger.pet_name;
    loserName = opponent.pet_name;
  } else if (isGodOpponent) {
    winnerId = opponentId;
    loserId = challengerId;
    winnerName = opponent.pet_name;
    loserName = challenger.pet_name;
  } else if (chalHP > oppHP) {
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
    let wHP = Math.max(10, (winnerId === challengerId ? chalHP : oppHP) - 10);
    let lHP = Math.max(10, (loserId === challengerId ? chalHP : oppHP) - 30);

    let wHappy = Math.max(20, (winnerId === challengerId ? challenger.happiness : opponent.happiness) - 5);
    let lHappy = Math.max(10, (loserId === challengerId ? challenger.happiness : opponent.happiness) - 25);

    // Proteksi God Pet Ramzi agar status tidak berkurang
    if (winnerId === challengerId && isGodChallenger) {
      wHP = 100;
      wHappy = 100;
    } else if (winnerId === opponentId && isGodOpponent) {
      wHP = 100;
      wHappy = 100;
    }

    if (loserId === challengerId && isGodChallenger) {
      lHP = 100;
      lHappy = 100;
    } else if (loserId === opponentId && isGodOpponent) {
      lHP = 100;
      lHappy = 100;
    }

    // Beri XP (+50 XP pemenang, +20 XP kalah) dikali xp_multiplier masing-masing
    const winnerPet = winnerId === challengerId ? challenger : opponent;
    const wMaxHP = winnerPet.pet_type === 'SLIME' ? 120 : 100;
    const wXpGained = Math.round(50 * (winnerPet.xp_multiplier || 1.0));
    let { newXp: wXp, newLevel: wLevel } = addXp(winnerPet, wXpGained, wMaxHP);

    const loserPet = loserId === challengerId ? challenger : opponent;
    const lMaxHP = loserPet.pet_type === 'SLIME' ? 120 : 100;
    const lXpGained = Math.round(20 * (loserPet.xp_multiplier || 1.0));
    let { newXp: lXp, newLevel: lLevel } = addXp(loserPet, lXpGained, lMaxHP);

    let lStatus = loserPet.status;
    if ((winnerId === challengerId && isGodChallenger) || (winnerId === opponentId && isGodOpponent)) {
      lHP = 0;
      lStatus = 'DEAD';
    }

    db.run(
      `UPDATE user_pets SET health = ?, happiness = ?, xp = ?, level = ?, pvp_wins = pvp_wins + 1, last_interaction_at = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
      [wHP, wHappy, wXp, wLevel, Math.floor(Date.now() / 1000), winnerId, guildId, winnerName]
    );

    db.run(
      `UPDATE user_pets SET health = ?, status = ?, happiness = ?, xp = ?, level = ?, pvp_losses = pvp_losses + 1, last_interaction_at = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
      [lHP, lStatus, lHappy, lXp, lLevel, Math.floor(Date.now() / 1000), loserId, guildId, loserName]
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
  
  // Tentukan Trait Spesial (50% peluang)
  let trait = '';
  if (Math.random() < 0.50) {
    const traits = ['MUTANT', 'GENIUS', 'STURDY', 'WARRIOR'];
    trait = traits[Math.floor(Math.random() * traits.length)];
  }

  const hatchDuration = 2 * 3600; // 2 Jam penetasan telur hybrid
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
 * Memeriksa dan menambahkan jumlah partisipasi ekspedisi harian (Maks 10)
 */
function checkExpeditionLimit(userId, guildId, dryRun = false) {
  // Pastikan wallet terdaftar
  economy.getWallet(userId, guildId);

  const wallet = db.get(
    'SELECT daily_expedition_count, expedition_cooldown_until FROM wallets WHERE user_id = ? AND guild_id = ?',
    [userId, guildId]
  );

  const nowUnix = Math.floor(Date.now() / 1000);
  let cooldownUntil = wallet ? (wallet.expedition_cooldown_until || 0) : 0;
  let currentCount = wallet ? (wallet.daily_expedition_count || 0) : 0;

  // 1. Cek jika masih dalam masa cooldown
  if (nowUnix < cooldownUntil) {
    const timeLeft = cooldownUntil - nowUnix;
    const hours = Math.floor(timeLeft / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    const seconds = timeLeft % 60;
    
    let timeStr = '';
    if (hours > 0) timeStr += `${hours} jam `;
    if (minutes > 0 || hours > 0) timeStr += `${minutes} menit `;
    timeStr += `${seconds} detik`;

    throw new Error(`Anda sedang dalam masa cooldown ekspedisi pet (4 jam) setelah bermain 6 kali! Harap tunggu **${timeStr}** lagi.`);
  }

  // 2. Jika cooldown sudah terlewati, dan count = 6, reset count ke 0
  if (currentCount >= 6) {
    currentCount = 0;
    if (!dryRun) {
      db.run(
        'UPDATE wallets SET daily_expedition_count = 0 WHERE user_id = ? AND guild_id = ?',
        [userId, guildId]
      );
    }
  }

  // 3. Jika ini eksekusi nyata, tambahkan jumlah permainan
  if (!dryRun) {
    const nextCount = currentCount + 1;
    let nextCooldown = 0;

    // Jika mencapai 6 kali bermain, set cooldown 4 jam
    if (nextCount >= 6) {
      nextCooldown = nowUnix + (4 * 3600); // 4 jam dari sekarang
    }

    db.run(
      `UPDATE wallets 
       SET daily_expedition_count = ?, expedition_cooldown_until = ? 
       WHERE user_id = ? AND guild_id = ?`,
      [nextCount, nextCooldown, userId, guildId]
    );
    
    return nextCount;
  }

  return currentCount;
}

/**
 * Simulasi Ekspedisi Pet Kelompok (Co-op PVE)
 */
function executeExpedition(guildId, participantIds, mapId = 1) {
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

  // Pilih Peta Ekspedisi Pilihan (Map selection)
  const selectedMap = EXPEDITION_MAPS.find(m => m.id === parseInt(mapId)) || EXPEDITION_MAPS[0];
  const kruCount = activePets.length;
  
  const zoneName = selectedMap.name;
  const recommendedLevel = selectedMap.recommendedLevel;
  const minReward = selectedMap.minPrize;
  const maxReward = selectedMap.maxPrize;

  // Kekuatan Tim (Total level pet)
  const teamPower = activePets.reduce((sum, ap) => sum + ap.pet.level, 0);

  // Cari pet paling jago dan paling cupu
  let bestPet = null;
  let worstPet = null;

  if (activePets.length > 1) {
    const getCP = (p) => {
      let traitBonus = 0;
      if (['GENIUS', 'WARRIOR', 'MUTANT'].includes(p.trait)) {
        traitBonus = 250;
      } else if (p.trait === 'STURDY') {
        traitBonus = 150;
      }
      return (p.level * 120) + p.health + (p.happiness * 1.5) + traitBonus;
    };

    const sorted = [...activePets].sort((a, b) => {
      if (b.pet.level !== a.pet.level) {
        return b.pet.level - a.pet.level;
      }
      return getCP(b.pet) - getCP(a.pet);
    });

    bestPet = {
      userId: sorted[0].userId,
      petName: sorted[0].pet.pet_name,
      level: sorted[0].pet.level
    };
    worstPet = {
      userId: sorted[sorted.length - 1].userId,
      petName: sorted[sorted.length - 1].pet.pet_name,
      level: sorted[sorted.length - 1].pet.level
    };
  }

  // Kalkulasi Peluang Sukses berdasarkan level pet, rekomendasi map & denda level rendah
  let baseSuccessRate = selectedMap.baseSuccessRate;
  let totalModifications = 0;
  const lowLevelCulprits = [];

  activePets.forEach(ap => {
    const levelDiff = ap.pet.level - recommendedLevel;
    if (levelDiff < 0) {
      // Penalti kekurangan level: -3% per level kekurangan
      totalModifications += levelDiff * 3;
      
      // Penalti parah jika selisih >= 10 level (banyak peluang gagal jika pet lv rendah gabung level tinggi >= 10)
      if (-levelDiff >= 10) {
        totalModifications -= 30; // Flat penalti -30% tambahan
        lowLevelCulprits.push(ap);
      }
    } else {
      // Bonus kelebihan level: +1% per level kelebihan (maks +15% per pet)
      totalModifications += Math.min(15, levelDiff * 1);
    }
  });

  let successRate = Math.round(baseSuccessRate + totalModifications);
  
  // Batasi successRate agar menantang (maks 90%, min 5%)
  if (successRate > 90) successRate = 90;
  if (successRate < 5) successRate = 5;

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
        // Increment daily expedition count
        checkExpeditionLimit(ap.userId, guildId, false);

        // Berikan Koin
        economy.addBalance(ap.userId, guildId, prizePerPerson, 'PET_EXPEDITION_REWARD');

        // Berikan XP (+200 XP dasar) dikali xp_multiplier
        let xpGained = Math.round(200 * (ap.pet.xp_multiplier || 1.0));
        const maxHP = ap.pet.pet_type === 'SLIME' ? 120 : 100;
        let { newXp, newLevel, levelUp } = addXp(ap.pet, xpGained, maxHP);

        // Dampak petualangan sukses: lapar -10, haus -10, kebahagiaan +10
        const isGod = ap.pet.pet_name.toLowerCase() === 'ramzi' && ap.userId === '436554535037698059';
        const newHunger = isGod ? 100 : Math.max(0, ap.pet.hunger - 10);
        const newThirst = isGod ? 100 : Math.max(0, ap.pet.thirst - 10);
        const newHappiness = isGod ? 100 : Math.min(100, ap.pet.happiness + 10);

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
          xpGained: xpGained,
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
      logs,
      bestPet,
      worstPet
    };
  } else {
    // Tentukan penyebab kegagalan dan kambing hitam (pet yang membuat kalah)
    const failScenarios = [];

    // 0. Skenario khusus: Pet level kekecilan (selisih >= 10 dari rekomendasi)
    if (lowLevelCulprits.length > 0) {
      const culpritLow = lowLevelCulprits[Math.floor(Math.random() * lowLevelCulprits.length)];
      failScenarios.push({
        culprit: culpritLow,
        reason: `Pet **${culpritLow.pet.pet_name}** milik <@${culpritLow.userId}> masih sangat pemula (Lv. ${culpritLow.pet.level} vs Rekomendasi Lv. ${recommendedLevel}) dan langsung pingsan ketakutan melihat Bos ${zoneName}, menyabotase formasi bertarung tim!`
      });
    }

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

    // Gagal: Pet terluka (-30 HP, -25 Happiness), tapi mendapat +60 XP dasar dikali xp_multiplier
    db.transaction(() => {
      activePets.forEach(ap => {
        // Increment daily expedition count
        checkExpeditionLimit(ap.userId, guildId, false);

        let xpGained = Math.round(60 * (ap.pet.xp_multiplier || 1.0));
        const maxHP = ap.pet.pet_type === 'SLIME' ? 120 : 100;
        let { newXp, newLevel, levelUp } = addXp(ap.pet, xpGained, maxHP);

        const isGod = ap.pet.pet_name.toLowerCase() === 'ramzi' && ap.userId === '436554535037698059';
        const newHealth = isGod ? 100 : Math.max(5, ap.pet.health - 30);
        const newHappiness = isGod ? 100 : Math.max(10, ap.pet.happiness - 25);
        const newHunger = isGod ? 100 : Math.max(0, ap.pet.hunger - 15);
        const newThirst = isGod ? 100 : Math.max(0, ap.pet.thirst - 15);

        db.run(
          `UPDATE user_pets SET xp = ?, level = ?, health = ?, happiness = ?, hunger = ?, thirst = ?, last_interaction_at = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
          [newXp, newLevel, newHealth, newHappiness, newHunger, newThirst, now, ap.userId, guildId, ap.pet.pet_name]
        );

        rewards.push({
          userId: ap.userId,
          petName: ap.pet.pet_name,
          koin: 0,
          xpGained: xpGained,
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
      logs,
      bestPet,
      worstPet
    };
  }
}

/**
 * Mendapatkan daftar pet teratas di guild untuk leaderboard.
 */
function getPetLeaderboard(guildId, category = 'level', limit = 10) {
  let orderByClause = '';
  if (category === 'pvp') {
    orderByClause = 'ORDER BY pvp_wins DESC, (pvp_wins * 1.0 / (pvp_wins + pvp_losses)) DESC, level DESC';
  } else if (category === 'cp') {
    orderByClause = `ORDER BY (
      (level * 120) + health + (happiness * 1.5) + 
      (CASE 
        WHEN trait IN ('GENIUS', 'WARRIOR', 'MUTANT') THEN 250 
        WHEN trait = 'STURDY' THEN 150 
        ELSE 0 
      END)
    ) DESC`;
  } else {
    // Default: level
    orderByClause = 'ORDER BY level DESC, xp DESC, created_at ASC';
  }

  const pets = db.all(
    `SELECT *,
            ((level * 120) + health + (happiness * 1.5) + 
             (CASE 
               WHEN trait IN ('GENIUS', 'WARRIOR', 'MUTANT') THEN 250 
               WHEN trait = 'STURDY' THEN 150 
               ELSE 0 
             END)
            ) as cp
     FROM user_pets
     WHERE guild_id = ? AND status != 'DEAD'
     ${orderByClause}
     LIMIT ?`,
    [guildId, limit]
  );

  return pets.map(p => applyDecay(p));
}

function toggleAutoFeed(userId, guildId) {
  const pet = getPet(userId, guildId);
  if (!pet) {
    throw new Error("Anda belum memiliki pet aktif!");
  }
  if (pet.status === 'DEAD') {
    throw new Error("Pet Anda sudah mati. Silakan adopsi pet baru!");
  }
  if (pet.status === 'EGG') {
    throw new Error("Pet Anda masih berbentuk telur. Tunggu sampai menetas!");
  }

  const newStatus = pet.auto_feed === 1 ? 0 : 1;
  db.run(
    'UPDATE user_pets SET auto_feed = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?',
    [newStatus, userId, guildId, pet.pet_name]
  );

  return {
    petName: pet.pet_name,
    autoFeed: newStatus
  };
}

/**
 * Mengatur URL gambar custom untuk pet aktif.
 */
function setCustomImage(userId, guildId, imageUrl) {
  const pet = getPet(userId, guildId);
  if (!pet) {
    throw new Error("Anda belum memiliki pet aktif!");
  }
  
  let validUrl = null;
  if (imageUrl && typeof imageUrl === 'string') {
    const trimmed = imageUrl.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      validUrl = trimmed;
    } else if (trimmed.toLowerCase() === 'reset' || trimmed.toLowerCase() === 'none' || trimmed.toLowerCase() === 'default') {
      validUrl = null;
    } else {
      throw new Error("Link gambar tidak valid! Harus berawalan `http://` atau `https://`, atau ketik `reset` untuk menghapus gambar custom.");
    }
  }

  db.run(
    'UPDATE user_pets SET custom_image = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?',
    [validUrl, userId, guildId, pet.pet_name]
  );

  return validUrl;
}

/**
 * Memandikan pet untuk membersihkan kutukan bau busuk
 */
function washPet(userId, guildId) {
  const pet = getPet(userId, guildId);
  if (!pet) throw new Error('Anda tidak memiliki peliharaan!');
  if (pet.status === 'EGG') throw new Error('Pet Anda masih berupa telur!');
  if (pet.status === 'DEAD') throw new Error('Pet Anda sudah meninggal 🪦.');

  const now = Math.floor(Date.now() / 1000);
  if (pet.curse_type !== 'smelly' || pet.curse_until <= now) {
    throw new Error(`Pet Anda (**${pet.pet_name}**) sudah wangi dan bersih kok! Tidak perlu dimandikan.`);
  }

  db.run(
    "UPDATE user_pets SET curse_type = '', curse_until = 0 WHERE user_id = ? AND guild_id = ? AND is_active = 1",
    [userId, guildId]
  );

  return {
    pet: getPet(userId, guildId)
  };
}

/**
 * Mendapatkan atau membuat misi harian pet untuk hari ini.
 */
function getOrCreateDailyQuests(userId, guildId) {
  // Pastikan user memiliki pet aktif
  const petObj = getPet(userId, guildId);
  if (!petObj) {
    throw new Error('Anda tidak memiliki hewan peliharaan! Adopsi telur pet terlebih dahulu.');
  }

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

  let row = db.get(
    'SELECT * FROM user_daily_quests WHERE user_id = ? AND guild_id = ? AND quest_date = ?',
    [userId, guildId, todayStr]
  );

  if (row) {
    return row;
  }

  // Pilih 3 misi harian acak dari 6 jenis misi
  const QUEST_POOL = [
    { type: 'WORK', target: 3 },
    { type: 'HUNT', target: 2 },
    { type: 'FEED', target: 2 },
    { type: 'PLAY', target: 2 },
    { type: 'WATER', target: 2 },
    { type: 'EXPEDITION', target: 1 }
  ];

  // Shuffle pool dan ambil 3 item teratas
  const shuffled = [...QUEST_POOL].sort(() => 0.5 - Math.random());
  const q1 = shuffled[0];
  const q2 = shuffled[1];
  const q3 = shuffled[2];

  db.run(
    `INSERT INTO user_daily_quests (
      user_id, guild_id, quest_date,
      quest_1_type, quest_1_progress, quest_1_target,
      quest_2_type, quest_2_progress, quest_2_target,
      quest_3_type, quest_3_progress, quest_3_target,
      reward_claimed
    ) VALUES (?, ?, ?, ?, 0, ?, ?, 0, ?, ?, 0, ?, 0)`,
    [userId, guildId, todayStr, q1.type, q1.target, q2.type, q2.target, q3.type, q3.target]
  );

  return db.get(
    'SELECT * FROM user_daily_quests WHERE user_id = ? AND guild_id = ? AND quest_date = ?',
    [userId, guildId, todayStr]
  );
}

/**
 * Menambah progres misi harian untuk quest_type tertentu.
 */
function incrementQuestProgress(userId, guildId, questType, amount = 1) {
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

  const row = db.get(
    'SELECT * FROM user_daily_quests WHERE user_id = ? AND guild_id = ? AND quest_date = ?',
    [userId, guildId, todayStr]
  );

  if (!row || row.reward_claimed === 1) {
    return; // Misi belum dibuat untuk hari ini, atau hadiah sudah diklaim
  }

  db.transaction(() => {
    if (row.quest_1_type === questType && row.quest_1_progress < row.quest_1_target) {
      const newProgress = Math.min(row.quest_1_target, row.quest_1_progress + amount);
      db.run(
        'UPDATE user_daily_quests SET quest_1_progress = ? WHERE user_id = ? AND guild_id = ? AND quest_date = ?',
        [newProgress, userId, guildId, todayStr]
      );
    }
    if (row.quest_2_type === questType && row.quest_2_progress < row.quest_2_target) {
      const newProgress = Math.min(row.quest_2_target, row.quest_2_progress + amount);
      db.run(
        'UPDATE user_daily_quests SET quest_2_progress = ? WHERE user_id = ? AND guild_id = ? AND quest_date = ?',
        [newProgress, userId, guildId, todayStr]
      );
    }
    if (row.quest_3_type === questType && row.quest_3_progress < row.quest_3_target) {
      const newProgress = Math.min(row.quest_3_target, row.quest_3_progress + amount);
      db.run(
        'UPDATE user_daily_quests SET quest_3_progress = ? WHERE user_id = ? AND guild_id = ? AND quest_date = ?',
        [newProgress, userId, guildId, todayStr]
      );
    }
  })();
}

/**
 * Mengklaim hadiah misi harian pet jika semua misi hari ini selesai.
 */
function claimDailyQuestReward(userId, guildId) {
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

  const row = db.get(
    'SELECT * FROM user_daily_quests WHERE user_id = ? AND guild_id = ? AND quest_date = ?',
    [userId, guildId, todayStr]
  );

  if (!row) {
    throw new Error('Anda belum memulai misi harian untuk hari ini! Jalankan perintah \\`.pet misi\\` terlebih dahulu.');
  }

  if (row.reward_claimed === 1) {
    throw new Error('Anda sudah mengklaim hadiah misi harian hari ini! Silakan kembali lagi besok.');
  }

  const allCompleted =
    row.quest_1_progress >= row.quest_1_target &&
    row.quest_2_progress >= row.quest_2_target &&
    row.quest_3_progress >= row.quest_3_target;

  if (!allCompleted) {
    throw new Error('Anda belum menyelesaikan seluruh misi harian pet hari ini! Periksa status dengan \\`.pet misi\\`.');
  }

  // Cari item drop secara acak
  const roll = Math.random();
  let itemId = '';
  let itemName = '';
  let isPetItem = true;

  if (roll < 0.25) {
    itemId = 'FOOD_PREMIUM';
    itemName = '🥩 Daging Premium';
    isPetItem = true;
  } else if (roll < 0.50) {
    itemId = 'TOY';
    itemName = '⚽ Bola Karet';
    isPetItem = true;
  } else if (roll < 0.75) {
    itemId = 'MEDICINE';
    itemName = '💊 Ramuan Kesehatan';
    isPetItem = true;
  } else if (roll < 0.90) {
    itemId = 'LOCKPICK';
    itemName = '🗝️ Linggis / Lockpick';
    isPetItem = false;
  } else {
    itemId = 'SOAP';
    itemName = '🧼 Sabun Licin';
    isPetItem = false;
  }

  db.transaction(() => {
    // 1. Berikan koin bonus Rp 150
    economy.addBalance(userId, guildId, 150, 'DAILY_QUEST');

    // 2. Set status claimed
    db.run(
      'UPDATE user_daily_quests SET reward_claimed = 1 WHERE user_id = ? AND guild_id = ? AND quest_date = ?',
      [userId, guildId, todayStr]
    );

    // 3. Tambahkan item drop ke inventory
    if (isPetItem) {
      const exist = db.get(
        'SELECT quantity FROM pet_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?',
        [userId, guildId, itemId]
      );
      if (exist) {
        db.run(
          'UPDATE pet_inventory SET quantity = quantity + 1 WHERE user_id = ? AND guild_id = ? AND item_id = ?',
          [userId, guildId, itemId]
        );
      } else {
        db.run(
          'INSERT INTO pet_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, ?, 1)',
          [userId, guildId, itemId]
        );
      }
    } else {
      const exist = db.get(
        'SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?',
        [userId, guildId, itemId]
      );
      if (exist) {
        db.run(
          'UPDATE user_inventory SET quantity = quantity + 1 WHERE user_id = ? AND guild_id = ? AND item_id = ?',
          [userId, guildId, itemId]
        );
      } else {
        db.run(
          'INSERT INTO user_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, ?, 1)',
          [userId, guildId, itemId]
        );
      }
    }
  })();

  return {
    rewardAmount: 150,
    dropItemName: itemName
  };
}

module.exports = {
  PET_ITEMS,
  PET_SPECIES,
  EXPEDITION_MAPS,
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
  getXpNeeded,
  checkExpeditionLimit,
  getPetLeaderboard,
  toggleAutoFeed,
  setCustomImage,
  washPet,
  getOrCreateDailyQuests,
  incrementQuestProgress,
  claimDailyQuestReward
};
