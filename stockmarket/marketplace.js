const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder, 
  StringSelectMenuOptionBuilder, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ComponentType 
} = require('discord.js');
const db = require('./database');
const economy = require('./economy');
const config = require('./config');
const pet = require('./pet');

// Emojis and Names Mapping for Premium Display
const ITEM_MAP = {
  // Garden Flowers
  'FLOWER_ROSE': { name: '🌹 Mawar Merah', type: 'GARDEN_FLOWER' },
  'FLOWER_TULIP': { name: '🌷 Bunga Tulip', type: 'GARDEN_FLOWER' },
  'FLOWER_LAVENDER': { name: '🪻 Bunga Lavender', type: 'GARDEN_FLOWER' },
  'FLOWER_SAKURA': { name: '🌸 Bunga Sakura', type: 'GARDEN_FLOWER' },
  'FLOWER_ORCHID': { name: '🪻 Anggrek Langka', type: 'GARDEN_FLOWER' },

  // Garden Seeds
  'SEED_ROSE': { name: '🌱 Benih Mawar Merah', type: 'GARDEN_SEED' },
  'SEED_TULIP': { name: '🌱 Benih Bunga Tulip', type: 'GARDEN_SEED' },
  'SEED_LAVENDER': { name: '🌱 Benih Bunga Lavender', type: 'GARDEN_SEED' },
  'SEED_SAKURA': { name: '🌱 Benih Bunga Sakura', type: 'GARDEN_SEED' },
  'SEED_ORCHID': { name: '🌱 Benih Anggrek Langka', type: 'GARDEN_SEED' },

  // Bouquets
  'BOUQUET_LOVE': { name: '💐 Buket Kasih Sayang', type: 'GARDEN_FLOWER' },
  'BOUQUET_PEACE': { name: '💐 Buket Ketenangan', type: 'GARDEN_FLOWER' },
  'BOUQUET_IMPERIAL': { name: '👑 Buket Legendaris', type: 'GARDEN_FLOWER' },

  // Pet Items
  'FOOD_BASIC': { name: '🍗 Pakan Pet Biasa', type: 'PET_ITEM' },
  'FOOD_PREMIUM': { name: '🥩 Daging Premium', type: 'PET_ITEM' },
  'WATER': { name: '🥤 Air Bersih', type: 'PET_ITEM' },
  'MEDICINE': { name: '💊 Ramuan Kesehatan', type: 'PET_ITEM' },
  'TOY': { name: '⚽ Bola Karet', type: 'PET_ITEM' },
  'SODA_ENERGY': { name: '🥤 Soda Energi Pet', type: 'PET_ITEM' },
  'SOAP_PET': { name: '🧼 Sabun Mandi Pet', type: 'PET_ITEM' },
  'COLLAR_IRON': { name: '🪮 Kalung Besi', type: 'PET_ITEM' },
  'SWORD_TOY': { name: '⚔️ Pedang Mainan', type: 'PET_ITEM' },
  'SHIELD_TOY': { name: '🛡️ Tameng Mainan', type: 'PET_ITEM' },
  'LUCKY_AMULET': { name: '🔮 Jimat Keberuntungan', type: 'PET_ITEM' },
  'XP_2X': { name: '⚡ XP Booster 2x', type: 'PET_ITEM' },
  'XP_4X': { name: '⚡ XP Booster 4x', type: 'PET_ITEM' },
  'XP_6X': { name: '⚡ XP Booster 6x', type: 'PET_ITEM' },
  'XP_8X': { name: '⚡ XP Booster 8x', type: 'PET_ITEM' },

  // BM Items
  'LOCKPICK': { name: '🗝️ Linggis / Lockpick', type: 'BM_ITEM' },
  'MASK': { name: '🎭 Topeng Samaran', type: 'BM_ITEM' },
  'MEAT': { name: '🥩 Daging Bius', type: 'BM_ITEM' },
  'SOAP': { name: '🧼 Sabun Licin', type: 'BM_ITEM' },
  'BRANKAS': { name: '🛡️ Brankas Anti-Hacker', type: 'BM_ITEM' },
  'HANDCUFFS': { name: '👮 Borgol / Handcuffs', type: 'BM_ITEM' },

  // Misc
  'GIFT_WRAPPING': { name: '🎗️ Kertas Kado Premium', type: 'GARDEN_FLOWER' },
  'TICKET_GACHA': { name: '🎟️ Tiket Gacha Pet', type: 'MISC_ITEM' }
};

// Colors matching embeds.js style
const COLORS = {
  PURPLE: 0x7C4DFF,
  SUCCESS: 0x10B981,
  ERROR: 0xEF4444,
  WARN: 0xF59E0B,
  DARK: 0x1A1C1E,
  GOLD: 0xD4AF37
};

/**
 * Helper to dynamically insert a row from a JS object
 */
function insertRow(tableName, rowData) {
  const keys = Object.keys(rowData);
  const placeholders = keys.map(() => '?').join(', ');
  const sql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
  const values = keys.map(k => rowData[k]);
  db.run(sql, values);
}

/**
 * Helper to update general user inventory
 */
function updatePlayerInventory(userId, guildId, itemId, quantityChange) {
  const row = db.get('SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?', [userId, guildId, itemId]);
  if (!row) {
    if (quantityChange > 0) {
      db.run('INSERT INTO user_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, ?, ?)', [userId, guildId, itemId, quantityChange]);
    }
  } else {
    const newQty = Math.max(0, row.quantity + quantityChange);
    if (newQty === 0) {
      db.run('DELETE FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?', [userId, guildId, itemId]);
    } else {
      db.run('UPDATE user_inventory SET quantity = ? WHERE user_id = ? AND guild_id = ? AND item_id = ?', [newQty, userId, guildId, itemId]);
    }
  }
}

/**
 * Helper to update pet supplies inventory
 */
function updatePlayerPetInventory(userId, guildId, itemId, quantityChange) {
  const row = db.get('SELECT quantity FROM pet_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?', [userId, guildId, itemId]);
  if (!row) {
    if (quantityChange > 0) {
      db.run('INSERT INTO pet_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, ?, ?)', [userId, guildId, itemId, quantityChange]);
    }
  } else {
    const newQty = Math.max(0, row.quantity + quantityChange);
    if (newQty === 0) {
      db.run('DELETE FROM pet_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?', [userId, guildId, itemId]);
    } else {
      db.run('UPDATE pet_inventory SET quantity = ? WHERE user_id = ? AND guild_id = ? AND item_id = ?', [newQty, userId, guildId, itemId]);
    }
  }
}

/**
 * Fetch all active listings for a guild
 */
function getListings(guildId) {
  return db.all('SELECT * FROM marketplace_listings WHERE guild_id = ? ORDER BY created_at DESC', [guildId]);
}

/**
 * Create a listing in the marketplace
 */
function createListing(guildId, sellerId, itemType, itemId, quantity, price) {
  const qty = parseInt(quantity);
  const prc = parseInt(price);

  if (isNaN(qty) || qty <= 0) throw new Error('Kuantitas harus berupa angka di atas 0!');
  if (isNaN(prc) || prc < 10) throw new Error('Harga minimal penjualan adalah Rp 10!');
  if (prc > 1000000) throw new Error('Harga maksimal penjualan adalah Rp 1.000.000!');

  db.transaction(() => {
    if (itemType === 'PET') {
      if (qty !== 1) throw new Error('Kuantitas penjualan Pet harus tepat 1!');
      
      const petRow = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [sellerId, guildId, itemId]);
      if (!petRow) throw new Error(`Pet dengan nama **"${itemId}"** tidak ditemukan di kandang Anda!`);
      if (petRow.status === 'DEAD') throw new Error('Pet Anda sudah mati! Anda tidak bisa menjual pet yang mati.');

      // Simpan pet dan hapus dari user_pets
      db.run('DELETE FROM user_pets WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [sellerId, guildId, itemId]);

      // Set active pet lain jika pet yang dijual adalah pet yang sedang aktif
      if (petRow.is_active === 1) {
        const remaining = db.get('SELECT COUNT(*) as count FROM user_pets WHERE user_id = ? AND guild_id = ?', [sellerId, guildId]).count;
        if (remaining > 0) {
          const nextPet = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? LIMIT 1', [sellerId, guildId]);
          if (nextPet) {
            db.run('UPDATE user_pets SET is_active = 1 WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [sellerId, guildId, nextPet.pet_name]);
          }
        }
      }

      insertRow('marketplace_listings', {
        guild_id: guildId,
        seller_id: sellerId,
        item_type: 'PET',
        item_id: itemId,
        quantity: 1,
        price: prc,
        pet_details: JSON.stringify(petRow)
      });
    } else {
      // General/Pet Item
      const isPetItem = itemType === 'PET_ITEM';
      const tbl = isPetItem ? 'pet_inventory' : 'user_inventory';
      
      const row = db.get(`SELECT quantity FROM ${tbl} WHERE user_id = ? AND guild_id = ? AND item_id = ?`, [sellerId, guildId, itemId]);
      const currentQty = row ? row.quantity : 0;

      if (currentQty < qty) {
        const itemInfo = ITEM_MAP[itemId] || { name: itemId };
        throw new Error(`Stok barang tidak mencukupi! Anda hanya memiliki ${currentQty}x ${itemInfo.name}.`);
      }

      // Deduct item dari penjual
      if (isPetItem) {
        updatePlayerPetInventory(sellerId, guildId, itemId, -qty);
      } else {
        updatePlayerInventory(sellerId, guildId, itemId, -qty);
      }

      insertRow('marketplace_listings', {
        guild_id: guildId,
        seller_id: sellerId,
        item_type: itemType,
        item_id: itemId,
        quantity: qty,
        price: prc
      });
    }
  })();
}

/**
 * Buy a listing from the marketplace
 */
function buyListing(listingId, buyerId, client) {
  const listing = db.get('SELECT * FROM marketplace_listings WHERE listing_id = ?', [listingId]);
  if (!listing) throw new Error('Listing lelang tidak ditemukan atau sudah dibeli warga lain!');
  if (listing.seller_id === buyerId) throw new Error('Ini adalah barang Anda sendiri! Jika ingin menariknya, gunakan tombol "Tarik Barang".');

  const buyerWallet = economy.getWallet(buyerId, listing.guild_id);
  if (buyerWallet.balance < listing.price) {
    throw new Error(`Koin Anda tidak mencukupi! Diperlukan Rp ${listing.price.toLocaleString('id-ID')}, saldo Anda Rp ${buyerWallet.balance.toLocaleString('id-ID')}.`);
  }

  const tax = Math.floor(listing.price * 0.10); // Pajak 10%
  const sellerShare = listing.price - tax;

  db.transaction(() => {
    // 1. Debet saldo pembeli
    economy.subtractBalance(buyerId, listing.guild_id, listing.price, 'MARKETPLACE_BUY');

    // 2. Kredit saldo penjual (potong pajak)
    economy.addBalance(listing.seller_id, listing.guild_id, sellerShare, 'MARKETPLACE_SELL');

    // 3. Kirim barang/pet ke pembeli
    if (listing.item_type === 'PET') {
      const nameExists = db.get('SELECT 1 FROM user_pets WHERE user_id = ? AND guild_id = ? AND LOWER(pet_name) = LOWER(?)', [buyerId, listing.guild_id, listing.item_id.toLowerCase()]);
      if (nameExists) {
        throw new Error(`Gagal memproses pembelian! Anda sudah memiliki hewan peliharaan aktif dengan nama **"${listing.item_id}"**. Silakan ubah nama pet Anda terlebih dahulu sebelum membeli pet ini.`);
      }

      const petData = JSON.parse(listing.pet_details);
      petData.user_id = buyerId;
      
      // Hitung sisa pet buyer untuk set active
      const petsCount = db.get('SELECT COUNT(*) as count FROM user_pets WHERE user_id = ? AND guild_id = ?', [buyerId, listing.guild_id]).count;
      petData.is_active = petsCount === 0 ? 1 : 0;

      insertRow('user_pets', petData);
    } else {
      const isPetItem = listing.item_type === 'PET_ITEM';
      if (isPetItem) {
        updatePlayerPetInventory(buyerId, listing.guild_id, listing.item_id, listing.quantity);
      } else {
        updatePlayerInventory(buyerId, listing.guild_id, listing.item_id, listing.quantity);
      }
    }

    // 4. Hapus listing
    db.run('DELETE FROM marketplace_listings WHERE listing_id = ?', [listingId]);
  })();

  // Kirim laporan bursa ke saluran pengumuman
  try {
    const announceChannelId = config.ANNOUNCEMENT_CHANNEL_ID || config.REPORT_CHANNEL_ID;
    if (announceChannelId) {
      client.channels.fetch(announceChannelId).then(chan => {
        if (chan) {
          const itemLabel = listing.item_type === 'PET' 
            ? `🐾 Pet: **${listing.item_id}**` 
            : `**${ITEM_MAP[listing.item_id]?.name || listing.item_id}** x${listing.quantity}`;
          
          const embed = new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle('⚖️ BURSA PASAR LELANG: TRANSAKSI DISETUJUI! 🛒')
            .setDescription(
              `🎉 Transaksi bursa warga berhasil diproses!\n\n` +
              `📦 **Barang:** ${itemLabel}\n` +
              `💵 **Harga Transaksi:** **Rp ${listing.price.toLocaleString('id-ID')}**\n` +
              `👤 **Pembeli:** <@${buyerId}>\n` +
              `👤 **Penjual:** <@${listing.seller_id}>\n\n` +
              `*✂️ Pajak sistem 10% (**Rp ${tax.toLocaleString('id-ID')}**) telah dipotong dan dibakar selamanya untuk menekan inflasi server.*`
            )
            .setTimestamp();
          chan.send({ embeds: [embed] }).catch(() => {});
        }
      }).catch(() => {});
    }
  } catch (e) {
    console.error('Error sending listing announcement:', e.message);
  }

  return { tax, sellerShare, listing };
}

/**
 * Cancel a listing and return item/pet to seller
 */
function cancelListing(listingId, sellerId) {
  const listing = db.get('SELECT * FROM marketplace_listings WHERE listing_id = ? AND seller_id = ?', [listingId, sellerId]);
  if (!listing) throw new Error('Listing tidak ditemukan atau Anda bukan pemilik lelang ini!');

  db.transaction(() => {
    if (listing.item_type === 'PET') {
      const petData = JSON.parse(listing.pet_details);
      petData.user_id = sellerId;
      
      // Set active jika seller tidak punya pet active saat ini
      const petsCount = db.get('SELECT COUNT(*) as count FROM user_pets WHERE user_id = ? AND guild_id = ?', [sellerId, listing.guild_id]).count;
      petData.is_active = petsCount === 0 ? 1 : 0;

      insertRow('user_pets', petData);
    } else {
      const isPetItem = listing.item_type === 'PET_ITEM';
      if (isPetItem) {
        updatePlayerPetInventory(sellerId, listing.guild_id, listing.item_id, listing.quantity);
      } else {
        updatePlayerInventory(sellerId, listing.guild_id, listing.item_id, listing.quantity);
      }
    }

    db.run('DELETE FROM marketplace_listings WHERE listing_id = ?', [listingId]);
  })();
}

/**
 * Render the premium main marketplace embed
 */
function renderMarketplaceEmbed(guildId, userId, client) {
  const wallet = economy.getWallet(userId, guildId);
  const listings = getListings(guildId);

  const embed = new EmbedBuilder()
    .setColor(COLORS.PURPLE)
    .setTitle('⚖️ BURSA PASAR LELANG WARGA — KOSAN 1A')
    .setThumbnail('https://cdn-icons-png.flaticon.com/512/3429/3429765.png')
    .setDescription(
      `\`\`\`\n` +
      `┌──────────────────────────────────────────┐\n` +
      `│  ⚖️ MARKETPLACE & PASAR LELANG WARGA ⚖️ │\n` +
      `│      Beli dari Warga · Potong Inflasi   │\n` +
      `└──────────────────────────────────────────┘\n` +
      `\`\`\`\n` +
      `Selamat datang di **Pasar Lelang Warga**! Tempat transaksi jual-beli barang RPG, benih, dan pet antar warga kosan secara aman.\n\n` +
      `💵 **Saldo Anda:** **Rp ${wallet.balance.toLocaleString('id-ID')}**\n` +
      `📌 *Setiap transaksi dipotong pajak bursa 10% (dibakar sistem).*`
    )
    .setFooter({ text: 'Gunakan tombol di bawah untuk Berdagang atau Menarik Lelang Anda.' })
    .setTimestamp();

  if (listings.length === 0) {
    embed.addFields({ 
      name: '📭 Bursa Lelang Kosong', 
      value: '> *Belum ada warga yang menjual barang saat ini. Klik tombol **⚖️ Jual Barang** di bawah untuk menjadi penjual pertama!*' 
    });
  } else {
    let listContent = '';
    listings.slice(0, 15).forEach((item, idx) => {
      const seller = client.users.cache.get(item.seller_id);
      const sellerName = seller ? seller.username : `Warga (${item.seller_id.slice(-4)})`;
      
      let itemLabel = '';
      if (item.item_type === 'PET') {
        const petDetails = JSON.parse(item.pet_details);
        const emoji = petDetails.star_level ? '⭐'.repeat(petDetails.star_level) : '🐾';
        itemLabel = `${emoji} **Pet: ${item.item_id}** *(Lv.${petDetails.level} ${petDetails.pet_type})*`;
      } else {
        const itemInfo = ITEM_MAP[item.item_id] || { name: item.item_id };
        itemLabel = `📦 **${itemInfo.name}** x${item.quantity}`;
      }

      listContent += `\`[#${idx + 1}]\` 🆔 **\`ID: ${item.listing_id}\`**\n` +
                     ` ┗ 🛍️ ${itemLabel}\n` +
                     ` ┗ 💵 Harga: **Rp ${item.price.toLocaleString('id-ID')}**\n` +
                     ` ┗ 👤 Penjual: <@${item.seller_id}> (${sellerName})\n\n`;
    });

    embed.addFields({
      name: `⚖️ DAFTAR BARANG YANG SEDANG DILELANG (${listings.length}):`,
      value: listContent.trim()
    });
  }

  // Row 1: Dropdown Beli (jika ada listing)
  const components = [];
  if (listings.length > 0) {
    const buyMenu = new StringSelectMenuBuilder()
      .setCustomId('eco_market_select_buy')
      .setPlaceholder('🛒 Pilih barang di sini untuk membeli secara instan...');

    listings.slice(0, 25).forEach(item => {
      let label = '';
      if (item.item_type === 'PET') {
        label = `Pet: ${item.item_id} (Rp ${item.price.toLocaleString('id-ID')})`;
      } else {
        const itemInfo = ITEM_MAP[item.item_id] || { name: item.item_id };
        label = `${itemInfo.name} x${item.quantity} (Rp ${item.price.toLocaleString('id-ID')})`;
      }
      buyMenu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(label.slice(0, 100))
          .setValue(item.listing_id.toString())
      );
    });
    components.push(new ActionRowBuilder().addComponents(buyMenu));
  }

  // Row 2: Tombol Aksi
  const btnRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('eco_market_btn_sell').setLabel('⚖️ Jual Barang').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('eco_market_btn_cancel').setLabel('❌ Tarik Barang').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('eco_market_btn_refresh').setLabel('🔄 Segarkan').setStyle(ButtonStyle.Secondary)
  );
  components.push(btnRow);

  return { embeds: [embed], components };
}

/**
 * Render selling selection screen
 */
function renderSellPanel(guildId, userId) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
    .setTitle('⚖️ BURSA PASAR LELANG: PANEL PENJUALAN')
    .setDescription(
      `Silakan pilih barang dari inventory Anda atau Pet aktif Anda pada menu dropdown di bawah untuk didaftarkan ke Pasar Lelang.\n\n` +
      `⚠️ *Catatan: Setelah barang/pet dipilih, Anda akan diminta memasukkan jumlah dan harga total penjualan melalui formulir modal popup.*`
    )
    .setFooter({ text: 'Pilih item di bawah atau klik Kembali untuk membatalkan.' });

  // Ambil inventory umum
  const userInv = db.all('SELECT item_id, quantity FROM user_inventory WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  // Ambil inventory pet
  const petInv = db.all('SELECT item_id, quantity FROM pet_inventory WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  // Ambil daftar pet hidup
  const userPets = db.all("SELECT pet_name, pet_type, level, star_level FROM user_pets WHERE user_id = ? AND guild_id = ? AND status != 'DEAD'", [userId, guildId]);

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('eco_market_select_sell_item')
    .setPlaceholder('👉 Pilih barang atau pet Anda untuk dijual...');

  let hasItems = false;

  // 1. Tambah Bunga/Benih ke dropdown
  userInv.forEach(row => {
    const itemInfo = ITEM_MAP[row.item_id.toUpperCase()];
    if (itemInfo && row.quantity > 0) {
      selectMenu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(`${itemInfo.name} (Stok: ${row.quantity})`)
          .setValue(`${itemInfo.type}:${row.item_id}`)
      );
      hasItems = true;
    }
  });

  // 2. Tambah Pet Items ke dropdown
  petInv.forEach(row => {
    const itemInfo = ITEM_MAP[row.item_id.toUpperCase()];
    if (itemInfo && row.quantity > 0) {
      selectMenu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(`${itemInfo.name} (Stok: ${row.quantity})`)
          .setValue(`PET_ITEM:${row.item_id}`)
      );
      hasItems = true;
    }
  });

  // 3. Tambah Pet ke dropdown
  userPets.forEach(row => {
    const stars = '⭐'.repeat(row.star_level || 1);
    selectMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(`🐾 Pet: ${row.pet_name} (${stars} Lv.${row.level} ${row.pet_type})`)
        .setValue(`PET:${row.pet_name}`)
    );
    hasItems = true;
  });

  const components = [];
  if (hasItems) {
    components.push(new ActionRowBuilder().addComponents(selectMenu));
  } else {
    embed.setDescription('❌ **Inventory Anda Kosong!**\n\nAnda tidak memiliki barang kebun, item pet, peralatan pasar gelap, ataupun hewan peliharaan hidup yang bisa dijual saat ini.');
  }

  // Tombol Kembali
  components.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('eco_market_btn_back_to_main').setLabel('🏡 Kembali ke Bursa').setStyle(ButtonStyle.Secondary)
    )
  );

  return { embeds: [embed], components };
}

/**
 * Render cancel/withdraw listings screen
 */
function renderCancelPanel(guildId, userId) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.WARN)
    .setTitle('❌ BURSA PASAR LELANG: PENARIKAN BARANG')
    .setDescription(
      `Pilih salah satu barang atau pet yang sedang Anda lelang di bawah ini untuk ditarik kembali ke inventory/kandang Anda secara gratis.`
    )
    .setFooter({ text: 'Lelang dibatalkan tanpa biaya penarikan.' });

  const myListings = db.all('SELECT * FROM marketplace_listings WHERE guild_id = ? AND seller_id = ?', [guildId, userId]);

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('eco_market_select_cancel_item')
    .setPlaceholder('👉 Pilih lelang Anda yang ingin ditarik...');

  const components = [];
  if (myListings.length > 0) {
    myListings.forEach(item => {
      let label = '';
      if (item.item_type === 'PET') {
        label = `Tarik Pet: ${item.item_id} (Harga: Rp ${item.price.toLocaleString('id-ID')})`;
      } else {
        const itemInfo = ITEM_MAP[item.item_id] || { name: item.item_id };
        label = `Tarik ${itemInfo.name} x${item.quantity} (Harga: Rp ${item.price.toLocaleString('id-ID')})`;
      }
      selectMenu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(label.slice(0, 100))
          .setValue(item.listing_id.toString())
      );
    });
    components.push(new ActionRowBuilder().addComponents(selectMenu));
  } else {
    embed.setDescription('❌ **Anda tidak sedang melelang barang apapun!**\n\nAnda tidak memiliki barang terdaftar aktif di bursa pasar lelang saat ini.');
  }

  components.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('eco_market_btn_back_to_main').setLabel('🏡 Kembali ke Bursa').setStyle(ButtonStyle.Secondary)
    )
  );

  return { embeds: [embed], components };
}

/**
 * Interaction router & controller for Marketplace
 */
async function handleInteraction(interaction, client) {
  const { customId, guildId, user } = interaction;
  if (!guildId) return;

  try {
    // 1. Tombol Buka/Refresh Utama
    if (customId === 'eco_btn_open_marketplace_private_perm' || customId === 'eco_market_btn_refresh' || customId === 'eco_market_btn_back_to_main') {
      const data = renderMarketplaceEmbed(guildId, user.id, client);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(data).catch(() => {});
      } else {
        await interaction.reply({ ...data, flags: 64 }).catch(() => {});
      }
    }

    // 2. Tombol Navigasi ke Panel Jual
    else if (customId === 'eco_market_btn_sell') {
      const data = renderSellPanel(guildId, user.id);
      await interaction.reply({ ...data, flags: 64 }).catch(() => {});
    }

    // 3. Tombol Navigasi ke Panel Tarik
    else if (customId === 'eco_market_btn_cancel') {
      const data = renderCancelPanel(guildId, user.id);
      await interaction.reply({ ...data, flags: 64 }).catch(() => {});
    }

    // 4. Dropdown Pilih Barang Untuk Dijual (Pemicu Modal Popup)
    else if (interaction.isStringSelectMenu() && customId === 'eco_market_select_sell_item') {
      const value = interaction.values[0]; // Format: "ITEM_TYPE:ITEM_ID"
      const [itemType, itemId] = value.split(':');
      
      const itemInfo = itemType === 'PET' ? { name: `Pet ${itemId}` } : (ITEM_MAP[itemId.toUpperCase()] || { name: itemId });

      const modal = new ModalBuilder()
        .setCustomId(`eco_market_modal_sell:${itemType}:${itemId}`)
        .setTitle(`⚖️ Lelang ${itemInfo.name.replace(/[^a-zA-Z0-9 ]/g, '').trim().slice(0, 40)}`);

      const qtyInput = new TextInputBuilder()
        .setCustomId('eco_market_input_qty')
        .setLabel('Jumlah barang yang ingin dijual')
        .setValue(itemType === 'PET' ? '1' : '1')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const priceInput = new TextInputBuilder()
        .setCustomId('eco_market_input_price')
        .setLabel('Harga TOTAL penjualan (koin Rp)')
        .setPlaceholder('Contoh: 1500')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(qtyInput),
        new ActionRowBuilder().addComponents(priceInput)
      );

      await interaction.showModal(modal);

      const submitted = await interaction.awaitModalSubmit({
        filter: (sub) => sub.customId.startsWith('eco_market_modal_sell:') && sub.user.id === user.id,
        time: 60000
      }).catch(() => null);

      if (submitted) {
        try {
          const qty = parseInt(submitted.fields.getTextInputValue('eco_market_input_qty'));
          const price = parseInt(submitted.fields.getTextInputValue('eco_market_input_price'));

          createListing(guildId, user.id, itemType, itemId, qty, price);

          const successEmbed = new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle('✅ Lelang Berhasil Didaftarkan!')
            .setDescription(
              `Barang Anda telah resmi didaftarkan di pasar lelang warga.\n\n` +
              `📦 **Barang:** ${itemType === 'PET' ? `🐾 Pet: **${itemId}**` : `**${itemInfo.name}** x${qty}`}\n` +
              `💵 **Harga Lelang:** **Rp ${price.toLocaleString('id-ID')}**\n\n` +
              `*Barang ditarik sementara dari inventory/kandang Anda selama dipasang di bursa lelang.*`
            );

          await submitted.reply({ embeds: [successEmbed], flags: 64 });
        } catch (err) {
          const errEmbed = new EmbedBuilder()
            .setColor(COLORS.ERROR)
            .setTitle('❌ Gagal Mendaftarkan Lelang')
            .setDescription(err.message);
          await submitted.reply({ embeds: [errEmbed], flags: 64 }).catch(() => {});
        }
      }
    }

    // 5. Dropdown Memilih Lelang Untuk Ditarik Kembali
    else if (interaction.isStringSelectMenu() && customId === 'eco_market_select_cancel_item') {
      const listingId = parseInt(interaction.values[0]);

      try {
        cancelListing(listingId, user.id);
        const successEmbed = new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle('✅ Lelang Berhasil Ditarik!')
          .setDescription(`Barang/Pet Anda telah dikembalikan secara utuh ke dalam kandang atau inventory Anda.`);
        
        await interaction.reply({ embeds: [successEmbed], flags: 64 });
      } catch (err) {
        const errEmbed = new EmbedBuilder()
          .setColor(COLORS.ERROR)
          .setTitle('❌ Gagal Menarik Lelang')
          .setDescription(err.message);
        await interaction.reply({ embeds: [errEmbed], flags: 64 });
      }
    }

    // 6. Dropdown Membeli Barang Lelang Warga
    else if (interaction.isStringSelectMenu() && customId === 'eco_market_select_buy') {
      const listingId = parseInt(interaction.values[0]);

      try {
        const res = buyListing(listingId, user.id, client);
        const itemLabel = res.listing.item_type === 'PET' 
          ? `🐾 Pet: **${res.listing.item_id}**` 
          : `**${ITEM_MAP[res.listing.item_id]?.name || res.listing.item_id}** x${res.listing.quantity}`;

        const successEmbed = new EmbedBuilder()
          .setColor(COLORS.SUCCESS)
          .setTitle('🛍️ PEMBELIAN BERHASIL!')
          .setDescription(
            `Selamat! Anda berhasil membeli barang lelang milik warga.\n\n` +
            `📦 **Barang diperoleh:** ${itemLabel}\n` +
            `💵 **Koin didebit:** **Rp ${res.listing.price.toLocaleString('id-ID')}**\n\n` +
            `*Koin telah ditransfer secara otomatis ke penjual (setelah dikurangi pajak bursa 10%). Silakan cek profil & kandang pet Anda!*`
          )
          .setTimestamp();

        await interaction.reply({ embeds: [successEmbed], flags: 64 });
      } catch (err) {
        const errEmbed = new EmbedBuilder()
          .setColor(COLORS.ERROR)
          .setTitle('❌ Pembelian Gagal')
          .setDescription(err.message);
        await interaction.reply({ embeds: [errEmbed], flags: 64 }).catch(() => {});
      }
    }

  } catch (err) {
    console.error('Error in marketplace interaction handler:', err);
    await interaction.reply({ content: '❌ Terjadi kesalahan sistem saat memproses transaksi.', flags: 64 }).catch(() => {});
  }
}

module.exports = {
  getListings,
  createListing,
  buyListing,
  cancelListing,
  renderMarketplaceEmbed,
  handleInteraction,
  ITEM_MAP
};
