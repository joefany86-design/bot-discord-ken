const db = require('./database');
const config = require('./config');
const economy = require('./economy');

/**
 * Mendapatkan sewa kamar aktif milik user (jika ends_at > waktu sekarang).
 */
function getActiveRental(userId, guildId) {
  const now = Math.floor(Date.now() / 1000);
  const rental = db.get(
    'SELECT * FROM kos_rentals WHERE user_id = ? AND guild_id = ?',
    [userId, guildId]
  );

  if (rental && rental.ends_at > now) {
    // Ambil data konfigurasi lengkap kamar tersebut
    const roomConfig = config.kos.ROOMS[rental.room_tier];
    return {
      ...rental,
      name: roomConfig?.name || rental.room_tier,
      config: roomConfig
    };
  }

  return null;
}

/**
 * Mendapatkan seluruh upgrade kamar permanen yang telah dibeli oleh user.
 */
function getUpgrades(userId, guildId) {
  const ownedList = db.all(
    'SELECT upgrade_id FROM kos_upgrades WHERE user_id = ? AND guild_id = ?',
    [userId, guildId]
  );

  return ownedList.map(u => {
    const upgradeConfig = config.kos.UPGRADES[u.upgrade_id];
    return {
      id: u.upgrade_id,
      name: upgradeConfig?.name || u.upgrade_id,
      config: upgradeConfig
    };
  });
}

/**
 * Memeriksa apakah user memiliki upgrade fasilitas tertentu.
 */
function hasUpgrade(userId, guildId, upgradeId) {
  const upgrade = db.get(
    'SELECT 1 FROM kos_upgrades WHERE user_id = ? AND guild_id = ? AND upgrade_id = ?',
    [userId, guildId, upgradeId]
  );
  return !!upgrade;
}

/**
 * Menyewa kamar kosan (durasi 3 hari).
 * - Jika menyewa kamar dengan kasta yang sama, durasinya akan diperpanjang/diakumulasi.
 * - Jika menyewa kamar yang berbeda, sewa lama akan digantikan oleh kamar baru dengan durasi penuh 3 hari.
 */
function rentRoom(userId, guildId, roomTier) {
  const roomConfig = config.kos.ROOMS[roomTier];
  if (!roomConfig) {
    throw new Error('Kasta kamar kosan tidak valid!');
  }

  const wallet = economy.getWallet(userId, guildId);
  const price = roomConfig.price;

  if (wallet.balance < price) {
    throw new Error(`Saldo Rupiah Anda tidak mencukupi! Biaya sewa kamar ini adalah Rp ${price.toLocaleString('id-ID')}, saldo Anda saat ini Rp ${wallet.balance.toLocaleString('id-ID')}`);
  }

  const now = Math.floor(Date.now() / 1000);
  const duration = config.kos.RENT_DURATION_SECONDS || (3 * 24 * 3600);
  
  const currentRental = getActiveRental(userId, guildId);
  let newEndsAt = now + duration;

  // Jika kamar tipenya sama, akumulasikan durasinya!
  if (currentRental && currentRental.room_tier === roomTier) {
    newEndsAt = currentRental.ends_at + duration;
  }

  db.transaction(() => {
    // 1. Kurangi saldo wallet user
    economy.subtractBalance(userId, guildId, price, 'KOS_RENT');

    // 2. Simpan atau update status sewa kamar di database
    db.run(
      `INSERT INTO kos_rentals (user_id, guild_id, room_tier, ends_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, guild_id) DO UPDATE SET room_tier = ?, ends_at = ?`,
      [userId, guildId, roomTier, newEndsAt, roomTier, newEndsAt]
    );

    // Catat log detail transaksi
    db.run(
      'INSERT INTO transactions (user_id, guild_id, type, amount) VALUES (?, ?, ?, ?)',
      [userId, guildId, `KOS_RENT_${roomTier}`, -price]
    );
  })();

  return {
    roomTier,
    name: roomConfig.name,
    price,
    endsAt: newEndsAt,
    walletBalance: economy.getWallet(userId, guildId).balance
  };
}

/**
 * Membeli upgrade fasilitas kamar permanen.
 */
function buyUpgrade(userId, guildId, upgradeId) {
  const upgradeConfig = config.kos.UPGRADES[upgradeId];
  if (!upgradeConfig) {
    throw new Error('Fasilitas upgrade kosan tidak valid!');
  }

  // Cek apakah sudah pernah membeli upgrade ini sebelumnya
  if (hasUpgrade(userId, guildId, upgradeId)) {
    throw new Error(`Anda sudah memiliki fasilitas **${upgradeConfig.name}** di dalam kamar Anda!`);
  }

  // Khusus upgrade Security, harus punya Penthouse aktif
  if (upgradeId === 'SECURITY') {
    const activeRental = getActiveRental(userId, guildId);
    if (!activeRental || activeRental.room_tier !== 'PENTHOUSE') {
      throw new Error('Upgrade **Security Jaga Penthouse** hanya dapat dibeli jika Anda sedang menyewa kamar **👑 Penthouse Kosan**!');
    }
  }

  const wallet = economy.getWallet(userId, guildId);
  const price = upgradeConfig.price;

  if (wallet.balance < price) {
    throw new Error(`Saldo Rupiah Anda tidak mencukupi! Biaya pembelian **${upgradeConfig.name}** adalah Rp ${price.toLocaleString('id-ID')}, saldo Anda saat ini Rp ${wallet.balance.toLocaleString('id-ID')}`);
  }

  db.transaction(() => {
    // 1. Kurangi saldo wallet user
    economy.subtractBalance(userId, guildId, price, 'KOS_UPGRADE');

    // 2. Simpan data upgrade permanen di database
    db.run(
      'INSERT INTO kos_upgrades (user_id, guild_id, upgrade_id) VALUES (?, ?, ?)',
      [userId, guildId, upgradeId]
    );

    // Catat log detail transaksi
    db.run(
      'INSERT INTO transactions (user_id, guild_id, type, amount) VALUES (?, ?, ?, ?)',
      [userId, guildId, `KOS_UPG_${upgradeId}`, -price]
    );
  })();

  return {
    upgradeId,
    name: upgradeConfig.name,
    price,
    walletBalance: economy.getWallet(userId, guildId).balance
  };
}

module.exports = {
  getActiveRental,
  getUpgrades,
  hasUpgrade,
  rentRoom,
  buyUpgrade
};
