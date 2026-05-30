const db = require('./database');
const economy = require('./economy');
const config = require('./config');

// Inisialisasi tabel garden_buffs secara mandiri saat modul dimuat
try {
  db.db.exec(`
    CREATE TABLE IF NOT EXISTS garden_buffs (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      buff_type TEXT NOT NULL, -- 'daily_bonus'
      amount INTEGER NOT NULL,
      ends_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, guild_id, buff_type)
    )
  `);
  console.log("⚡ [Database] Tabel 'garden_buffs' berhasil diverifikasi/dibuat di garden.js.");
} catch (e) {
  console.error("❌ [Database] Gagal membuat tabel garden_buffs:", e.message);
}

/**
 * Helper untuk memanipulasi jumlah item di inventory warga.
 */
function updateInventory(userId, guildId, itemId, quantityChange) {
  const row = db.get(
    'SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?',
    [userId, guildId, itemId]
  );
  
  if (!row) {
    if (quantityChange > 0) {
      db.run(
        'INSERT INTO user_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, ?, ?)',
        [userId, guildId, itemId, quantityChange]
      );
    }
  } else {
    const newQty = Math.max(0, row.quantity + quantityChange);
    if (newQty === 0) {
      db.run(
        'DELETE FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?',
        [userId, guildId, itemId]
      );
    } else {
      db.run(
        'UPDATE user_inventory SET quantity = ? WHERE user_id = ? AND guild_id = ? AND item_id = ?',
        [newQty, userId, guildId, itemId]
      );
    }
  }
}

/**
 * Mendapatkan daftar 3 slot kebun milik user.
 * Menginisialisasi slot kosong jika belum ada di database.
 */
function getGardenSlots(userId, guildId) {
  const now = Math.floor(Date.now() / 1000);
  const slots = [];

  for (let idx = 1; idx <= 3; idx++) {
    let slot = db.get(
      'SELECT * FROM garden_slots WHERE user_id = ? AND guild_id = ? AND slot_index = ?',
      [userId, guildId, idx]
    );

    if (!slot) {
      db.run(
        'INSERT INTO garden_slots (user_id, guild_id, slot_index, seed_id, planted_at, last_watered_at, water_count) VALUES (?, ?, ?, NULL, 0, 0, 0)',
        [userId, guildId, idx]
      );
      slot = {
        user_id: userId,
        guild_id: guildId,
        slot_index: idx,
        seed_id: null,
        planted_at: 0,
        last_watered_at: 0,
        water_count: 0
      };
    }

    // Hitung status pertumbuhan real-time
    if (slot.seed_id) {
      const flowerConf = config.garden.FLOWERS[slot.seed_id.toUpperCase()];
      if (flowerConf) {
        const growSeconds = flowerConf.growSeconds;
        // Penyaluran air mempercepat sisa waktu sebesar 30 menit per siraman
        const elapsed = now - slot.planted_at + (slot.water_count * config.garden.WATER_TIME_REDUCTION_SECONDS);
        const progress = Math.min(100, Math.floor((elapsed / growSeconds) * 100));
        const secondsLeft = Math.max(0, growSeconds - elapsed);
        
        let status = 'TUNAS'; // 0-33%
        if (progress > 66) status = 'MEKAR'; // 67-100%
        else if (progress > 33) status = 'KUNCUP'; // 34-66%

        slot.flowerName = flowerConf.name;
        slot.growthProgress = progress;
        slot.secondsLeft = secondsLeft;
        slot.growthStatus = status;
        slot.rarity = flowerConf.rarity;
      }
    } else {
      slot.growthProgress = 0;
      slot.secondsLeft = 0;
      slot.growthStatus = 'KOSONG';
    }

    slots.push(slot);
  }

  return slots;
}

/**
 * Menanam benih bunga ke dalam slot tanah tertentu.
 */
function plantSeed(userId, guildId, slotIndex, flowerKeyInput) {
  const slotIdx = parseInt(slotIndex);
  if (isNaN(slotIdx) || slotIdx < 1 || slotIdx > 3) {
    throw new Error('Pilih nomor slot tanah antara 1, 2, atau 3!');
  }

  const flowerKey = flowerKeyInput.toUpperCase();
  const flowerConf = config.garden.FLOWERS[flowerKey];
  if (!flowerConf) {
    throw new Error(`Spesies bunga '${flowerKeyInput}' tidak valid! Pilihan: mawar, tulip, lavender, sakura, anggrek.`);
  }

  const slots = getGardenSlots(userId, guildId);
  const targetSlot = slots[slotIdx - 1];

  if (targetSlot.seed_id) {
    throw new Error(`Slot tanah ${slotIdx} sedang terisi oleh tanaman ${targetSlot.flowerName}! Harap panen terlebih dahulu.`);
  }

  // Cek ketersediaan benih di inventory
  const seedItemRow = db.get(
    'SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?',
    [userId, guildId, flowerConf.seedId]
  );

  if (!seedItemRow || seedItemRow.quantity <= 0) {
    throw new Error(`Anda tidak memiliki **${flowerConf.name} Seed** di inventory! Beli benih terlebih dahulu di \`.toko-kebun\`.`);
  }

  const now = Math.floor(Date.now() / 1000);

  db.transaction(() => {
    // Kurangi 1 benih dari inventory
    updateInventory(userId, guildId, flowerConf.seedId, -1);
    
    // Tanam di database
    db.run(
      'UPDATE garden_slots SET seed_id = ?, planted_at = ?, last_watered_at = 0, water_count = 0 WHERE user_id = ? AND guild_id = ? AND slot_index = ?',
      [flowerConf.id, now, userId, guildId, slotIdx]
    );
  })();

  return {
    slotIndex: slotIdx,
    flowerName: flowerConf.name,
    rarity: flowerConf.rarity
  };
}

/**
 * Menyiram tanaman untuk mempercepat waktu mekarnya bunga.
 * Cooldown siram: 1 jam sekali per user.
 */
function waterPlant(userId, guildId, slotIndexInput = null) {
  const now = Math.floor(Date.now() / 1000);
  const wallet = economy.getWallet(userId, guildId);

  // Periksa Cooldown Penyiraman (1 jam sekali)
  const timeSinceLastWater = now - (wallet.last_water_at || 0);
  const cooldownSeconds = config.garden.WATER_COOLDOWN_MS / 1000;

  if (timeSinceLastWater < cooldownSeconds) {
    const secondsLeft = Math.ceil(cooldownSeconds - timeSinceLastWater);
    const minsLeft = Math.floor(secondsLeft / 60);
    const secsLeft = secondsLeft % 60;
    throw new Error(`Ember air Anda masih kosong! Harap tunggu **${minsLeft} menit ${secsLeft} detik** untuk mengisi ulang air penyiraman.`);
  }

  const slots = getGardenSlots(userId, guildId);
  const targetSlots = [];

  if (slotIndexInput && slotIndexInput !== 'all') {
    const slotIdx = parseInt(slotIndexInput);
    if (isNaN(slotIdx) || slotIdx < 1 || slotIdx > 3) {
      throw new Error('Nomor slot tidak valid! Pilih slot antara 1, 2, atau 3.');
    }
    const targetSlot = slots[slotIdx - 1];
    if (!targetSlot.seed_id) {
      throw new Error(`Slot tanah ${slotIdx} masih kosong, tidak ada tanaman yang perlu disiram!`);
    }
    if (targetSlot.growthProgress >= 100) {
      throw new Error(`Tanaman ${targetSlot.flowerName} di slot ${slotIdx} sudah mekar penuh! Segera panen.`);
    }
    targetSlots.push(targetSlot);
  } else {
    // Siram semua slot yang terisi dan belum mekar penuh
    slots.forEach(s => {
      if (s.seed_id && s.growthProgress < 100) {
        targetSlots.push(s);
      }
    });

    if (targetSlots.length === 0) {
      throw new Error('Anda tidak memiliki tanaman aktif yang perlu disiram di seluruh slot!');
    }
  }

  db.transaction(() => {
    targetSlots.forEach(s => {
      db.run(
        'UPDATE garden_slots SET water_count = water_count + 1, last_watered_at = ? WHERE user_id = ? AND guild_id = ? AND slot_index = ?',
        [now, userId, guildId, s.slot_index]
      );
    });

    // Update cooldown siram warga
    db.run(
      'UPDATE wallets SET last_water_at = ? WHERE user_id = ? AND guild_id = ?',
      [now, userId, guildId]
    );
  })();

  return {
    wateredCount: targetSlots.length,
    slotsWatered: targetSlots.map(s => s.slot_index)
  };
}

/**
 * Memanen bunga yang sudah matang (growthProgress >= 100%).
 */
function harvestPlant(userId, guildId, slotIndexInput) {
  const slotIdx = parseInt(slotIndexInput);
  if (isNaN(slotIdx) || slotIdx < 1 || slotIdx > 3) {
    throw new Error('Pilih nomor slot tanah antara 1, 2, atau 3!');
  }

  const slots = getGardenSlots(userId, guildId);
  const targetSlot = slots[slotIdx - 1];

  if (!targetSlot.seed_id) {
    throw new Error(`Slot tanah ${slotIdx} kosong! Tidak ada tanaman yang bisa dipanen.`);
  }

  if (targetSlot.growthProgress < 100) {
    throw new Error(`Tanaman **${targetSlot.flowerName}** di slot ${slotIdx} masih berkuncup (${targetSlot.growthProgress}%). Siram atau tunggu sampai mekar penuh (100%)!`);
  }

  const flowerConf = config.garden.FLOWERS[targetSlot.seed_id.toUpperCase()];

  db.transaction(() => {
    // Reset slot tanah menjadi kosong
    db.run(
      'UPDATE garden_slots SET seed_id = NULL, planted_at = 0, last_watered_at = 0, water_count = 0 WHERE user_id = ? AND guild_id = ? AND slot_index = ?',
      [userId, guildId, slotIdx]
    );

    // Tambah 1 bunga matang ke inventory
    updateInventory(userId, guildId, flowerConf.flowerId, 1);
  })();

  return {
    slotIndex: slotIdx,
    flowerName: flowerConf.name,
    flowerId: flowerConf.flowerId,
    rarity: flowerConf.rarity
  };
}

/**
 * Menjual bunga hasil panen ke pasar kebun untuk mendapatkan koin.
 */
function sellFlowers(userId, guildId, flowerKeyInput, quantityInput) {
  const flowerKey = flowerKeyInput.toUpperCase();
  const flowerConf = config.garden.FLOWERS[flowerKey];
  if (!flowerConf) {
    throw new Error(`Spesies bunga '${flowerKeyInput}' tidak valid! Pilihan: mawar, tulip, lavender, sakura, anggrek.`);
  }

  const row = db.get(
    'SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?',
    [userId, guildId, flowerConf.flowerId]
  );

  if (!row || row.quantity <= 0) {
    throw new Error(`Anda tidak memiliki **${flowerConf.name}** matang di inventory untuk dijual!`);
  }

  let sellQty = 0;
  if (typeof quantityInput === 'string' && quantityInput.toLowerCase() === 'all') {
    sellQty = row.quantity;
  } else {
    sellQty = parseInt(quantityInput);
  }

  if (isNaN(sellQty) || sellQty <= 0) {
    throw new Error('Jumlah penjualan harus berupa angka di atas 0 atau ketik "all"!');
  }

  if (sellQty > row.quantity) {
    throw new Error(`Anda hanya memiliki **${row.quantity}** kuntum **${flowerConf.name}** di inventory!`);
  }

  const totalEarnings = sellQty * flowerConf.sellPrice;

  db.transaction(() => {
    // Kurangi bunga dari inventory
    updateInventory(userId, guildId, flowerConf.flowerId, -sellQty);
    
    // Tambah koin Rupiah ke dompet
    economy.addBalance(userId, guildId, totalEarnings, 'FLOWER_SELL');
  })();

  return {
    flowerName: flowerConf.name,
    quantitySold: sellQty,
    earnings: totalEarnings,
    walletBalance: economy.getWallet(userId, guildId).balance
  };
}

/**
 * Membeli benih bunga dari toko kebun.
 */
function buySeed(userId, guildId, seedKeyInput, quantityInput) {
  const seedKey = seedKeyInput.toUpperCase();
  
  let targetItem = null;
  let pricePerItem = 0;
  let itemName = '';
  
  if (seedKey === 'WRAPPING') {
    targetItem = 'GIFT_WRAPPING';
    pricePerItem = config.garden.GIFT_WRAPPING_PRICE;
    itemName = '🎗️ Kertas Kado Premium';
  } else {
    const flowerConf = config.garden.FLOWERS[seedKey];
    if (!flowerConf) {
      throw new Error(`Benih '${seedKeyInput}' tidak valid! Pilihan benih: mawar, tulip, lavender, sakura, anggrek, atau wrapping (kertas kado).`);
    }
    targetItem = flowerConf.seedId;
    pricePerItem = flowerConf.seedPrice;
    itemName = `🌱 Benih ${flowerConf.name}`;
  }

  const qty = parseInt(quantityInput);
  if (isNaN(qty) || qty <= 0) {
    throw new Error('Jumlah pembelian harus berupa angka di atas 0!');
  }

  const totalCost = qty * pricePerItem;
  const wallet = economy.getWallet(userId, guildId);

  if (wallet.balance < totalCost) {
    throw new Error(`Saldo dompet tidak mencukupi! Total biaya: Rp ${totalCost.toLocaleString('id-ID')}. Saldo Anda: Rp ${wallet.balance.toLocaleString('id-ID')}`);
  }

  db.transaction(() => {
    // Potong koin
    economy.subtractBalance(userId, guildId, totalCost, 'GARDEN_BUY');
    // Tambah benih ke inventory
    updateInventory(userId, guildId, targetItem, qty);
  })();

  return {
    itemName,
    quantityBought: qty,
    cost: totalCost,
    walletBalance: economy.getWallet(userId, guildId).balance
  };
}

/**
 * Merangkai buket bunga dari hasil panen.
 */
function craftBouquet(userId, guildId, bouquetKeyInput) {
  const bKey = bouquetKeyInput.toUpperCase();
  const bouquetConf = config.garden.BOUQUETS[bKey];
  if (!bouquetConf) {
    throw new Error(`Jenis buket '${bouquetKeyInput}' tidak valid! Pilihan: love, peace, imperial.`);
  }

  const reqs = bouquetConf.req;
  
  // Periksa persyaratan bahan di inventory
  Object.keys(reqs).forEach(itemId => {
    const qtyNeeded = reqs[itemId];
    const row = db.get(
      'SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?',
      [userId, guildId, itemId]
    );
    const qtyOwned = row ? row.quantity : 0;
    
    if (qtyOwned < qtyNeeded) {
      let displayName = itemId;
      if (itemId === 'GIFT_WRAPPING') displayName = 'Kertas Kado Premium';
      else {
        const flowKey = itemId.replace('FLOWER_', '');
        displayName = config.garden.FLOWERS[flowKey] ? config.garden.FLOWERS[flowKey].name : itemId;
      }
      throw new Error(`Bahan tidak mencukupi untuk merangkai buket! Dibutuhkan **${qtyNeeded}x ${displayName}** (Anda memiliki ${qtyOwned}x).`);
    }
  });

  const bouquetItemId = `BOUQUET_${bKey}`;

  db.transaction(() => {
    // Potong seluruh bahan dari inventory
    Object.keys(reqs).forEach(itemId => {
      updateInventory(userId, guildId, itemId, -reqs[itemId]);
    });

    // Tambahkan 1 buket bunga matang ke inventory
    updateInventory(userId, guildId, bouquetItemId, 1);
  })();

  return {
    bouquetName: bouquetConf.name,
    desc: bouquetConf.desc
  };
}

/**
 * Mengirimkan hadiah buket bunga ke warga lain dengan pesan kustom manis.
 * Memberikan passive buff tambahan Daily koin Rupiah ke penerima.
 */
function giftBouquet(fromUserId, toUserId, guildId, bouquetKeyInput, messageTextInput = '') {
  if (fromUserId === toUserId) {
    throw new Error('Anda tidak bisa mengirimkan buket kado kepada diri sendiri! Salurkan rasa kasih sayang ke orang lain.');
  }

  const bKey = bouquetKeyInput.toUpperCase();
  const bouquetConf = config.garden.BOUQUETS[bKey];
  if (!bouquetConf) {
    throw new Error(`Jenis buket '${bouquetKeyInput}' tidak valid! Pilihan: love, peace, imperial.`);
  }

  const bouquetItemId = `BOUQUET_${bKey}`;

  // Periksa kepemilikan buket di inventory pengirim
  const row = db.get(
    'SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?',
    [fromUserId, guildId, bouquetItemId]
  );

  if (!row || row.quantity <= 0) {
    throw new Error(`Anda tidak memiliki **${bouquetConf.name}** di inventory untuk dihadiahkan! Rangkai buket terlebih dahulu di \`.buket\`.`);
  }

  const now = Math.floor(Date.now() / 1000);
  const buffEndsAt = now + bouquetConf.buff.durationSeconds;

  db.transaction(() => {
    // Kurangi 1 buket dari inventory pengirim
    updateInventory(fromUserId, guildId, bouquetItemId, -1);

    // Hapus buff daily yang serupa jika sebelumnya ada, lalu tambahkan buff baru ke penerima
    db.run(
      'DELETE FROM garden_buffs WHERE user_id = ? AND guild_id = ? AND buff_type = ?',
      [toUserId, guildId, 'daily_bonus']
    );

    db.run(
      'INSERT INTO garden_buffs (user_id, guild_id, buff_type, amount, ends_at) VALUES (?, ?, ?, ?, ?)',
      [toUserId, guildId, 'daily_bonus', bouquetConf.buff.amount, buffEndsAt]
    );
  })();

  return {
    bouquetName: bouquetConf.name,
    buffAmount: bouquetConf.buff.amount,
    durationHours: Math.round(bouquetConf.buff.durationSeconds / 3600),
    messageText: messageTextInput || 'Semoga hari-harimu selalu indah dan dipenuhi kebahagiaan!'
  };
}

/**
 * Mendapatkan buff harian berkebun yang sedang aktif milik user.
 */
function getActiveBuff(userId, guildId) {
  const now = Math.floor(Date.now() / 1000);
  const buff = db.get(
    'SELECT * FROM garden_buffs WHERE user_id = ? AND guild_id = ? AND buff_type = ? AND ends_at > ?',
    [userId, guildId, 'daily_bonus', now]
  );
  return buff || null;
}

module.exports = {
  getGardenSlots,
  plantSeed,
  waterPlant,
  harvestPlant,
  sellFlowers,
  buySeed,
  craftBouquet,
  giftBouquet,
  getActiveBuff
};
