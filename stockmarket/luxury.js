const db = require('./database');
const economy = require('./economy');
const config = require('./config');

/**
 * Mendapatkan seluruh daftar barang mewah yang dimiliki user di server.
 */
function getLuxuryInventory(userId, guildId) {
  const inv = db.all('SELECT * FROM user_inventory WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  
  const luxuryConfigItems = config.luxury.ITEMS || {};
  const list = [];

  inv.forEach(row => {
    const itemKey = row.item_id.toUpperCase();
    if (luxuryConfigItems[itemKey]) {
      list.push({
        ...luxuryConfigItems[itemKey],
        quantity: row.quantity
      });
    }
  });

  return list;
}

/**
 * Membeli barang mewah sultan.
 */
function buyLuxury(userId, guildId, itemId, quantity = 1) {
  const qty = parseInt(quantity);
  if (isNaN(qty) || qty <= 0) {
    throw new Error('Jumlah pembelian harus minimal 1!');
  }

  const itemKey = itemId.toUpperCase();
  const luxuryConfigItems = config.luxury.ITEMS || {};
  const item = luxuryConfigItems[itemKey];

  if (!item) {
    throw new Error(`Barang mewah dengan ID \`${itemId}\` tidak ditemukan! Ketik \`.luxury\` untuk katalog.`);
  }

  const wallet = economy.getWallet(userId, guildId);
  const totalPrice = item.price * qty;

  if (wallet.balance < totalPrice) {
    throw new Error(`Saldo Anda tidak mencukupi! Anda butuh Rp ${totalPrice.toLocaleString('id-ID')} untuk membeli ${qty}x ${item.name}, saldo Anda Rp ${wallet.balance.toLocaleString('id-ID')}`);
  }

  db.transaction(() => {
    // Kurangi koin wallet
    economy.subtractBalance(userId, guildId, totalPrice, 'LUXURY_BUY');

    // Masukkan ke inventory umum user_inventory
    const exist = db.get('SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?', [userId, guildId, item.id]);
    if (exist) {
      db.run(
        'UPDATE user_inventory SET quantity = quantity + ? WHERE user_id = ? AND guild_id = ? AND item_id = ?',
        [qty, userId, guildId, item.id]
      );
    } else {
      db.run(
        'INSERT INTO user_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, ?, ?)',
        [userId, guildId, item.id, qty]
      );
    }
  })();

  // Ambil qty terbaru
  const updatedRow = db.get('SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?', [userId, guildId, item.id]);

  return {
    item,
    quantity: qty,
    totalPrice,
    newQty: updatedRow ? updatedRow.quantity : 0,
    newBalance: economy.getWallet(userId, guildId).balance
  };
}

/**
 * Menjual kembali barang mewah dengan harga potong 50%.
 */
function sellLuxury(userId, guildId, itemId, quantity = 1) {
  const qty = parseInt(quantity);
  if (isNaN(qty) || qty <= 0) {
    throw new Error('Jumlah penjualan harus minimal 1!');
  }

  const itemKey = itemId.toUpperCase();
  const luxuryConfigItems = config.luxury.ITEMS || {};
  const item = luxuryConfigItems[itemKey];

  if (!item) {
    throw new Error(`Barang mewah dengan ID \`${itemId}\` tidak ditemukan!`);
  }

  const exist = db.get('SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?', [userId, guildId, item.id]);
  const currentQty = exist ? exist.quantity : 0;

  if (currentQty < qty) {
    throw new Error(`Anda tidak memiliki cukup stok **${item.name}**! Dimiliki: **x${currentQty}**, ingin dijual: **x${qty}**.`);
  }

  // Harga jual balik adalah 50% dari harga asli
  const resalePricePerUnit = Math.floor(item.price * 0.5);
  const totalPayout = resalePricePerUnit * qty;

  db.transaction(() => {
    // Tambah koin wallet
    economy.addBalance(userId, guildId, totalPayout, 'LUXURY_SELL');

    // Kurangi kuantitas di user_inventory
    const newQty = currentQty - qty;
    if (newQty <= 0) {
      db.run(
        'DELETE FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?',
        [userId, guildId, item.id]
      );
    } else {
      db.run(
        'UPDATE user_inventory SET quantity = ? WHERE user_id = ? AND guild_id = ? AND item_id = ?',
        [newQty, userId, guildId, item.id]
      );
    }
  })();

  return {
    item,
    quantity: qty,
    totalPayout,
    newQty: Math.max(0, currentQty - qty),
    newBalance: economy.getWallet(userId, guildId).balance
  };
}

module.exports = {
  getLuxuryInventory,
  buyLuxury,
  sellLuxury
};
