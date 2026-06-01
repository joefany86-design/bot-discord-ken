const db = require('./database');
const economy = require('./economy');
const config = require('./config');


// Konfigurasi Item Black Market
const BM_ITEMS = {
  LOCKPICK: { id: 'LOCKPICK', name: '🗝️ Linggis / Lockpick', price: 450, desc: 'Meningkatkan peluang sukses Solo Rob sebesar +15%. Berpeluang 20% patah/hilang setiap kali digunakan.' },
  MASK: { id: 'MASK', name: '🎭 Topeng Samaran', price: 600, desc: 'Menyembunyikan identitas pelaku saat Solo Rob sukses (korban tidak tahu siapa perampoknya). Habis saat sukses.' },
  MEAT: { id: 'MEAT', name: '🥩 Daging Bius', price: 350, desc: 'Menonaktifkan alarm & CCTV korban saat Anda merampok. Habis terpakai.' },
  SOAP: { id: 'SOAP', name: '🧼 Sabun Licin', price: 500, desc: 'Mengurangi durasi penjara virtual sebesar 50% jika tertangkap basah. Habis terpakai.' },
  BRANKAS: { id: 'BRANKAS', name: '🛡️ Brankas Anti-Hacker', price: 1200, desc: 'Melindungi saldo tabungan bank Anda dari jarahan Heist. Memotong kehilangan saldo sebesar 90% (efek pasif permanen selama disimpan).' }
};

/**
 * Mendapatkan daftar inventory barang kriminal user.
 */
function getInventory(userId, guildId) {
  const inv = db.all('SELECT * FROM user_inventory WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  
  // Petakan ke seluruh item BM terdaftar agar tampil meskipun jumlahnya 0
  const mapped = {};
  Object.keys(BM_ITEMS).forEach(key => {
    mapped[key] = {
      ...BM_ITEMS[key],
      quantity: 0
    };
  });

  inv.forEach(item => {
    const itemKey = item.item_id.toUpperCase();
    if (mapped[itemKey]) {
      mapped[itemKey].quantity = item.quantity;
    }
  });

  return Object.values(mapped);
}

/**
 * Mendapatkan jumlah spesifik suatu item di inventory.
 */
function getItemQty(userId, guildId, itemId) {
  const row = db.get('SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?', [userId, guildId, itemId.toUpperCase()]);
  return row ? row.quantity : 0;
}

/**
 * Membeli barang Black Market.
 */
function buyItem(userId, guildId, itemId, quantity = 1) {
  const qty = parseInt(quantity);
  if (isNaN(qty) || qty <= 0) {
    throw new Error('Jumlah pembelian harus minimal 1!');
  }

  const itemKey = itemId.toUpperCase();
  const item = BM_ITEMS[itemKey];
  if (!item) {
    throw new Error('Item tidak ditemukan di pasar gelap!');
  }

  const currentQty = getItemQty(userId, guildId, item.id);
  const maxLimit = config.blackmarket.MAX_ITEM_HOLD_LIMIT || 10;
  if (currentQty + qty > maxLimit) {
    const remaining = Math.max(0, maxLimit - currentQty);
    if (remaining === 0) {
      throw new Error(`❌ Batas Penyimpanan Tercapai! Anda sudah memiliki ${currentQty}x ${item.name}. Anda tidak dapat membeli item ini lagi (Maksimal ${maxLimit} per item).`);
    } else {
      throw new Error(`❌ Batas Penyimpanan Tercapai! Anda sudah memiliki ${currentQty}x ${item.name}. Anda hanya dapat membeli maksimal ${remaining}x item ini lagi (Maksimal ${maxLimit} per item).`);
    }
  }

  const wallet = economy.getWallet(userId, guildId);
  const totalPrice = item.price * qty;

  if (wallet.balance < totalPrice) {
    throw new Error(`Saldo koin Anda tidak mencukupi untuk membeli ${qty}x ${item.name} seharga Rp ${totalPrice.toLocaleString('id-ID')}!`);
  }

  db.transaction(() => {
    // Kurangi Koin
    economy.subtractBalance(userId, guildId, totalPrice, 'BM_BUY');

    // Masukkan ke Inventory
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

  return {
    item,
    quantity: qty,
    totalPrice,
    newQty: getItemQty(userId, guildId, item.id)
  };
}

/**
 * Mengonsumsi/menggunakan satu unit item dari inventory.
 */
function consumeItem(userId, guildId, itemId) {
  const itemKey = itemId.toUpperCase();
  const existQty = getItemQty(userId, guildId, itemKey);
  if (existQty <= 0) return false;

  db.transaction(() => {
    const newQty = existQty - 1;
    if (newQty <= 0) {
      db.run(
        'DELETE FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?',
        [userId, guildId, itemKey]
      );
    } else {
      db.run(
        'UPDATE user_inventory SET quantity = ? WHERE user_id = ? AND guild_id = ? AND item_id = ?',
        [newQty, userId, guildId, itemKey]
      );
    }
  })();

  return true;
}

module.exports = {
  BM_ITEMS,
  getInventory,
  getItemQty,
  buyItem,
  consumeItem
};
