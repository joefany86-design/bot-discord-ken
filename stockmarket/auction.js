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

const COLORS = {
  GOLD: 0xD4AF37,
  SUCCESS: 0x10B981,
  ERROR: 0xEF4444,
  WARN: 0xF59E0B,
  DARK: 0x1A1C1E,
  PURPLE: 0x7C4DFF,
  BLUE: 0x3498DB
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
 * Create an auction listing in auction_items
 */
function createAuction(guildId, sellerId, itemType, itemId, quantity, minBid, durationHours) {
  const qty = parseInt(quantity);
  const bid = parseInt(minBid);
  const dur = parseInt(durationHours);

  if (isNaN(qty) || qty <= 0) throw new Error('Kuantitas harus berupa angka di atas 0!');
  if (isNaN(bid) || bid < 10) throw new Error('Harga bid awal minimal adalah Rp 10!');
  if (bid > 5000000) throw new Error('Harga bid awal maksimal adalah Rp 5.000.000!');
  if (isNaN(dur) || dur < 1 || dur > 72) throw new Error('Durasi lelang minimal 1 jam dan maksimal 72 jam!');

  db.transaction(() => {
    const endsAt = Math.floor(Date.now() / 1000) + dur * 3600;

    if (itemType === 'PET') {
      if (qty !== 1) throw new Error('Kuantitas lelang Pet harus tepat 1!');
      
      const petRow = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [sellerId, guildId, itemId]);
      if (!petRow) throw new Error(`Pet dengan nama **"${itemId}"** tidak ditemukan di kandang Anda!`);
      if (petRow.status === 'DEAD') throw new Error('Pet Anda sudah mati! Anda tidak bisa melelang pet yang mati.');

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

      insertRow('auction_items', {
        guild_id: guildId,
        seller_id: sellerId,
        item_type: 'PET',
        item_id: itemId,
        quantity: 1,
        min_bid: bid,
        current_bid: bid,
        ends_at: endsAt,
        status: 'ACTIVE',
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

      insertRow('auction_items', {
        guild_id: guildId,
        seller_id: sellerId,
        item_type: itemType,
        item_id: itemId,
        quantity: qty,
        min_bid: bid,
        current_bid: bid,
        ends_at: endsAt,
        status: 'ACTIVE'
      });
    }
  })();
}

/**
 * Cancel an auction listing (only allowed if there are no bids)
 */
function cancelAuction(auctionId, sellerId) {
  const auction = db.get('SELECT * FROM auction_items WHERE id = ? AND seller_id = ? AND status = \'ACTIVE\'', [auctionId, sellerId]);
  if (!auction) throw new Error('Lelang tidak ditemukan atau Anda bukan pemilik lelang ini!');

  // Check if someone has already bid
  if (auction.highest_bidder_id) {
    throw new Error('Lelang tidak bisa ditarik kembali karena sudah ada warga yang mengajukan penawaran (bid)!');
  }

  db.transaction(() => {
    if (auction.item_type === 'PET') {
      const petData = JSON.parse(auction.pet_details);
      petData.user_id = sellerId;
      
      // Set active jika seller tidak punya pet active saat ini
      const petsCount = db.get('SELECT COUNT(*) as count FROM user_pets WHERE user_id = ? AND guild_id = ?', [sellerId, auction.guild_id]).count;
      petData.is_active = petsCount === 0 ? 1 : 0;

      insertRow('user_pets', petData);
    } else {
      const isPetItem = auction.item_type === 'PET_ITEM';
      if (isPetItem) {
        updatePlayerPetInventory(sellerId, auction.guild_id, auction.item_id, auction.quantity);
      } else {
        updatePlayerInventory(sellerId, auction.guild_id, auction.item_id, auction.quantity);
      }
    }

    db.run('DELETE FROM auction_items WHERE id = ?', [auctionId]);
  })();
}

/**
 * Place a bid on an auction (escrow method with outbid refund)
 */
function placeBid(auctionId, bidderId, bidAmount, guildId) {
  const auction = db.get("SELECT * FROM auction_items WHERE id = ? AND status = 'ACTIVE'", [auctionId]);
  if (!auction) throw new Error('Lelang tidak ditemukan atau sudah berakhir!');

  const now = Math.floor(Date.now() / 1000);
  if (now > auction.ends_at) throw new Error('Lelang sudah ditutup (waktu habis)!');

  if (auction.seller_id === bidderId) throw new Error('Anda tidak boleh menawar barang lelang Anda sendiri!');
  if (auction.highest_bidder_id === bidderId) throw new Error('Anda sudah memegang penawaran tertinggi saat ini!');

  const minRequiredBid = auction.highest_bidder_id 
    ? auction.current_bid + Math.max(10, Math.round(auction.min_bid * 0.05)) 
    : auction.min_bid;

  if (bidAmount < minRequiredBid) {
    throw new Error(`Penawaran minimal berikutnya adalah Rp ${minRequiredBid.toLocaleString('id-ID')}!`);
  }

  const wallet = economy.getWallet(bidderId, guildId);
  if (wallet.balance < bidAmount) {
    throw new Error(`Saldo koin Anda tidak mencukupi untuk menawar Rp ${bidAmount.toLocaleString('id-ID')}! (Saldo: Rp ${wallet.balance.toLocaleString('id-ID')})`);
  }

  const previousBidderId = auction.highest_bidder_id;
  const previousBidAmount = auction.current_bid;

  db.transaction(() => {
    // 1. Debit koin penawar baru
    economy.subtractBalance(bidderId, guildId, bidAmount, 'AUCTION_BID');

    // 2. Refund koin penawar sebelumnya
    if (previousBidderId) {
      economy.addBalance(previousBidderId, guildId, previousBidAmount, 'AUCTION_OUTBID');
    }

    // 3. Update database lelang
    db.run(
      'UPDATE auction_items SET current_bid = ?, highest_bidder_id = ? WHERE id = ?',
      [bidAmount, bidderId, auctionId]
    );

    db.run(
      'INSERT INTO auction_bids (auction_id, user_id, bid_amount) VALUES (?, ?, ?)',
      [auctionId, bidderId, bidAmount]
    );
  })();

  return { previousBidderId, previousBidAmount, auction };
}

/**
 * Render the main auction house panel
 */
function renderAuctionEmbed(guildId, userId, client) {
  const wallet = economy.getWallet(userId, guildId);
  const auctions = db.all("SELECT * FROM auction_items WHERE guild_id = ? AND status = 'ACTIVE' ORDER BY ends_at ASC", [guildId]);

  const embed = new EmbedBuilder()
    .setColor(COLORS.GOLD)
    .setTitle('🔨 BURSA PASAR LELANG WARGA — KOSAN 1A')
    .setThumbnail('https://cdn-icons-png.flaticon.com/512/3429/3429765.png')
    .setDescription(
      `\`\`\`\n` +
      `┌──────────────────────────────────────────┐\n` +
      `│    ⚖️ BURSA PASAR LELANG WARGA KOSAN ⚖️  │\n` +
      `│   Tawar & Menangkan Aset Antar Warga     │\n` +
      `└──────────────────────────────────────────┘\n` +
      `\`\`\`\n` +
      `Selamat datang di **Pasar Lelang Warga**! Cari barang kebun, item pet, atau pet langka dan ajukan penawaran (*bid*).\n\n` +
      `💵 **Saldo Anda:** **Rp ${wallet.balance.toLocaleString('id-ID')}**\n` +
      `📌 *Koin Anda didebit langsung saat menawar (escrow) dan di-refund otomatis jika kalah bid. Pemenang lelang dipotong pajak bursa 10% (dibakar).*`
    )
    .setFooter({ text: 'Gunakan tombol di bawah untuk Lelang atau Tarik Lelang Anda.' })
    .setTimestamp();

  if (auctions.length === 0) {
    embed.addFields({ 
      name: '📭 Bursa Lelang Kosong', 
      value: '> *Belum ada warga yang melelang barang saat ini. Klik tombol **🔨 Lelang Barang** di bawah untuk memulai lelang pertama!*' 
    });
  } else {
    let listContent = '';
    for (let idx = 0; idx < auctions.length; idx++) {
      const item = auctions[idx];
      const sellerName = item.seller_id 
        ? (client.users.cache.get(item.seller_id)?.username || `Warga (${item.seller_id.slice(-4)})`)
        : '🏛️ Kas Negara';
      const bidderName = item.highest_bidder_id 
        ? `<@${item.highest_bidder_id}>` 
        : '*Belum ada*';
      
      let itemLabel = '';
      if (item.item_type === 'PET') {
        const petDetails = JSON.parse(item.pet_details);
        const emoji = petDetails.star_level ? '⭐'.repeat(petDetails.star_level) : '🐾';
        itemLabel = `${emoji} **Pet: ${item.item_id}** *(Lv.${petDetails.level} ${petDetails.pet_type})*`;
      } else {
        const itemInfo = ITEM_MAP[item.item_id] || { name: item.item_id };
        itemLabel = `📦 **${itemInfo.name}** x${item.quantity}`;
      }

      const nextMinBid = item.highest_bidder_id 
        ? item.current_bid + Math.max(10, Math.round(item.min_bid * 0.05)) 
        : item.min_bid;

      const entry = `\`[#${idx + 1}]\` 🆔 **\`ID: ${item.id}\`**\n` +
                    ` ┗ 🛍️ ${itemLabel}\n` +
                    ` ┗ 💰 Bid Saat Ini: **Rp ${item.current_bid.toLocaleString('id-ID')}** (oleh ${bidderName})\n` +
                    ` ┗ 🔨 Min. Bid Lanjutan: **Rp ${nextMinBid.toLocaleString('id-ID')}**\n` +
                    ` ┗ 👤 Penjual: ${item.seller_id ? `<@${item.seller_id}>` : sellerName}\n` +
                    ` ┗ ⏳ Sisa Waktu: <t:${item.ends_at}:R> (<t:${item.ends_at}:f>)\n\n`;

      if ((listContent + entry).length > 950) {
        listContent += `*...dan ${auctions.length - idx} lelang lainnya.*`;
        break;
      }
      listContent += entry;
    }

    embed.addFields({
      name: `⚖️ DAFTAR BARANG YANG SEDANG DILELANG (${auctions.length}):`,
      value: listContent.trim() || '> *Tidak ada data*'
    });
  }

  const components = [];
  if (auctions.length > 0) {
    const bidMenu = new StringSelectMenuBuilder()
      .setCustomId('eco_auction_select_bid')
      .setPlaceholder('🔨 Pilih salah satu lelang di bawah untuk menawar (Bid)...');

    auctions.slice(0, 25).forEach(item => {
      let label = '';
      if (item.item_type === 'PET') {
        label = `Pet: ${item.item_id} (Current: Rp ${item.current_bid.toLocaleString('id-ID')})`;
      } else {
        const itemInfo = ITEM_MAP[item.item_id] || { name: item.item_id };
        label = `${itemInfo.name} x${item.quantity} (Current: Rp ${item.current_bid.toLocaleString('id-ID')})`;
      }
      bidMenu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(`ID: ${item.id} - ${label.slice(0, 80)}`)
          .setValue(item.id.toString())
      );
    });
    components.push(new ActionRowBuilder().addComponents(bidMenu));
  }

  const btnRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('eco_auction_btn_sell').setLabel('🔨 Lelang Barang').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('eco_auction_btn_cancel').setLabel('❌ Tarik Lelang').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('eco_auction_btn_refresh').setLabel('🔄 Segarkan').setStyle(ButtonStyle.Secondary)
  );
  components.push(btnRow);

  return { embeds: [embed], components };
}

/**
 * Render selling selection screen
 */
function renderAuctionSellPanel(guildId, userId) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.SUCCESS)
    .setTitle('⚖️ BURSA PASAR LELANG: PANEL PENJUALAN')
    .setDescription(
      `Silakan pilih barang dari inventory Anda atau Pet aktif Anda pada menu dropdown di bawah untuk didaftarkan ke Rumah Lelang.\n\n` +
      `⚠️ *Catatan: Setelah barang/pet dipilih, Anda akan diminta memasukkan jumlah (qty), harga bid awal minimum, dan durasi jam lelang melalui formulir modal popup.*`
    )
    .setFooter({ text: 'Pilih item di bawah atau klik Kembali untuk membatalkan.' });

  const userInv = db.all('SELECT item_id, quantity FROM user_inventory WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  const petInv = db.all('SELECT item_id, quantity FROM pet_inventory WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  const userPets = db.all("SELECT pet_name, pet_type, level, star_level FROM user_pets WHERE user_id = ? AND guild_id = ? AND status != 'DEAD'", [userId, guildId]);

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('eco_auction_select_sell_item')
    .setPlaceholder('👉 Pilih barang atau pet Anda untuk dijual/dilelang...');

  let hasItems = false;
  const options = [];

  userInv.forEach(row => {
    const itemInfo = ITEM_MAP[row.item_id.toUpperCase()];
    if (itemInfo && row.quantity > 0) {
      options.push(
        new StringSelectMenuOptionBuilder()
          .setLabel(`${itemInfo.name} (Stok: ${row.quantity})`)
          .setValue(`${itemInfo.type}:${row.item_id}`)
      );
      hasItems = true;
    }
  });

  petInv.forEach(row => {
    const itemInfo = ITEM_MAP[row.item_id.toUpperCase()];
    if (itemInfo && row.quantity > 0) {
      options.push(
        new StringSelectMenuOptionBuilder()
          .setLabel(`${itemInfo.name} (Stok: ${row.quantity})`)
          .setValue(`PET_ITEM:${row.item_id}`)
      );
      hasItems = true;
    }
  });

  userPets.forEach(row => {
    const stars = '⭐'.repeat(row.star_level || 1);
    options.push(
      new StringSelectMenuOptionBuilder()
        .setLabel(`🐾 Pet: ${row.pet_name} (${stars} Lv.${row.level} ${row.pet_type})`)
        .setValue(`PET:${row.pet_name}`)
    );
    hasItems = true;
  });

  const components = [];
  if (hasItems) {
    selectMenu.addOptions(options.slice(0, 25));
    components.push(new ActionRowBuilder().addComponents(selectMenu));
  } else {
    embed.setDescription('❌ **Inventory Anda Kosong!**\n\nAnda tidak memiliki barang kebun, item pet, ataupun hewan peliharaan hidup yang bisa dilelang saat ini.');
  }

  components.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('eco_auction_btn_back_to_main').setLabel('🏡 Kembali ke Bursa').setStyle(ButtonStyle.Secondary)
    )
  );

  return { embeds: [embed], components };
}

/**
 * Render cancel/withdraw listings screen
 */
function renderAuctionCancelPanel(guildId, userId) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.WARN)
    .setTitle('❌ BURSA PASAR LELANG: PENARIKAN BARANG')
    .setDescription(
      `Pilih salah satu barang atau pet yang sedang Anda lelang di bawah ini untuk ditarik kembali ke inventory/kandang Anda secara gratis.\n\n` +
      `⚠️ *Catatan: Anda hanya dapat menarik kembali lelang yang **belum ditawar** oleh warga lain.*`
    )
    .setFooter({ text: 'Lelang dibatalkan tanpa biaya penarikan.' });

  const myListings = db.all('SELECT * FROM auction_items WHERE guild_id = ? AND seller_id = ? AND status = \'ACTIVE\' AND highest_bidder_id IS NULL', [guildId, userId]);

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('eco_auction_select_cancel_item')
    .setPlaceholder('👉 Pilih lelang Anda yang ingin ditarik...');

  const components = [];
  if (myListings.length > 0) {
    const options = [];
    myListings.forEach(item => {
      let label = '';
      if (item.item_type === 'PET') {
        label = `Tarik Pet: ${item.item_id} (Starting: Rp ${item.min_bid.toLocaleString('id-ID')})`;
      } else {
        const itemInfo = ITEM_MAP[item.item_id] || { name: item.item_id };
        label = `Tarik ${itemInfo.name} x${item.quantity} (Starting: Rp ${item.min_bid.toLocaleString('id-ID')})`;
      }
      options.push(
        new StringSelectMenuOptionBuilder()
          .setLabel(`ID: ${item.id} - ${label.slice(0, 80)}`)
          .setValue(item.id.toString())
      );
    });
    selectMenu.addOptions(options.slice(0, 25));
    components.push(new ActionRowBuilder().addComponents(selectMenu));
  } else {
    embed.setDescription('❌ **Tidak ada lelang yang bisa ditarik!**\n\nAnda tidak memiliki lelang terdaftar aktif yang belum ditawar oleh warga saat ini.');
  }

  components.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('eco_auction_btn_back_to_main').setLabel('🏡 Kembali ke Bursa').setStyle(ButtonStyle.Secondary)
    )
  );

  return { embeds: [embed], components };
}

/**
 * Interaction router & controller for Auction House
 */
async function handleAuctionInteraction(interaction, client) {
  const { customId, guildId, user } = interaction;
  if (!guildId) return;

  try {
    // 1. Main Page / Refresh / Back
    if (customId === 'eco_btn_open_marketplace_private_perm' || customId === 'eco_btn_open_auction_private_perm' || customId === 'eco_auction_btn_refresh' || customId === 'eco_auction_btn_back_to_main') {
      const data = renderAuctionEmbed(guildId, user.id, client);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(data).catch(() => {});
      } else {
        await interaction.reply({ ...data, flags: 64 }).catch(() => {});
      }
    }

    // 2. Open Sell Panel
    else if (customId === 'eco_auction_btn_sell') {
      const data = renderAuctionSellPanel(guildId, user.id);
      await interaction.reply({ ...data, flags: 64 }).catch(() => {});
    }

    // 3. Open Withdraw Panel
    else if (customId === 'eco_auction_btn_cancel') {
      const data = renderAuctionCancelPanel(guildId, user.id);
      await interaction.reply({ ...data, flags: 64 }).catch(() => {});
    }

    // 4. Dropdown Choose Item to Auction (Triggers Sell Modal)
    else if (interaction.isStringSelectMenu() && customId === 'eco_auction_select_sell_item') {
      const value = interaction.values[0]; // Format: "ITEM_TYPE:ITEM_ID"
      const [itemType, itemId] = value.split(':');
      
      const itemInfo = itemType === 'PET' ? { name: `Pet ${itemId}` } : (ITEM_MAP[itemId.toUpperCase()] || { name: itemId });

      const modal = new ModalBuilder()
        .setCustomId(`eco_auction_modal_sell:${itemType}:${itemId}`)
        .setTitle(`🔨 Lelang ${itemInfo.name.replace(/[^a-zA-Z0-9 ]/g, '').trim().slice(0, 40)}`);

      const qtyInput = new TextInputBuilder()
        .setCustomId('eco_auction_input_qty')
        .setLabel('Kuantitas lelang (1 untuk Pet)')
        .setValue(itemType === 'PET' ? '1' : '1')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const priceInput = new TextInputBuilder()
        .setCustomId('eco_auction_input_price')
        .setLabel('Bid awal minimum lelang (koin Rp)')
        .setPlaceholder('Contoh: 1000')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const durationInput = new TextInputBuilder()
        .setCustomId('eco_auction_input_dur')
        .setLabel('Durasi lelang (dalam jam, max 72)')
        .setValue('4')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(qtyInput),
        new ActionRowBuilder().addComponents(priceInput),
        new ActionRowBuilder().addComponents(durationInput)
      );

      await interaction.showModal(modal);

      const submitted = await interaction.awaitModalSubmit({
        filter: (sub) => sub.customId.startsWith('eco_auction_modal_sell:') && sub.user.id === user.id,
        time: 60000
      }).catch(() => null);

      if (submitted) {
        try {
          const qty = parseInt(submitted.fields.getTextInputValue('eco_auction_input_qty'));
          const price = parseInt(submitted.fields.getTextInputValue('eco_auction_input_price'));
          const dur = parseInt(submitted.fields.getTextInputValue('eco_auction_input_dur'));

          createAuction(guildId, user.id, itemType, itemId, qty, price, dur);

          const successEmbed = new EmbedBuilder()
            .setColor(COLORS.SUCCESS)
            .setTitle('✅ Lelang Berhasil Terpasang!')
            .setDescription(
              `Barang/Pet Anda telah resmi dipajang di pasar lelang warga.\n\n` +
              `📦 **Aset:** ${itemType === 'PET' ? `🐾 Pet: **${itemId}**` : `**${itemInfo.name}** x${qty}`}\n` +
              `💵 **Starting Bid:** **Rp ${price.toLocaleString('id-ID')}**\n` +
              `⏳ **Durasi:** **${dur} Jam** (Berakhir <t:${Math.floor(Date.now() / 1000) + dur * 3600}:R>)\n\n` +
              `*Barang ditarik sementara dari inventory/kandang Anda selama lelang berlangsung.*`
            );

          await submitted.reply({ embeds: [successEmbed], flags: 64 });
        } catch (err) {
          const errEmbed = new EmbedBuilder()
            .setColor(COLORS.ERROR)
            .setTitle('❌ Gagal Memasang Lelang')
            .setDescription(err.message);
          await submitted.reply({ embeds: [errEmbed], flags: 64 }).catch(() => {});
        }
      }
    }

    // 5. Dropdown Cancel/Withdraw Auction
    else if (interaction.isStringSelectMenu() && customId === 'eco_auction_select_cancel_item') {
      const auctionId = parseInt(interaction.values[0]);

      try {
        cancelAuction(auctionId, user.id);
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

    // 6. Dropdown Select Auction to Bid (Triggers Bidding Modal)
    else if (interaction.isStringSelectMenu() && customId === 'eco_auction_select_bid') {
      const auctionId = parseInt(interaction.values[0]);
      
      const item = db.get("SELECT * FROM auction_items WHERE id = ? AND status = 'ACTIVE'", [auctionId]);
      if (!item) {
        return interaction.reply({ content: '❌ Lelang tersebut tidak aktif atau tidak ditemukan!', flags: 64 });
      }

      const itemInfo = item.item_type === 'PET' ? { name: `Pet ${item.item_id}` } : (ITEM_MAP[item.item_id.toUpperCase()] || { name: item.item_id });
      const nextMin = item.highest_bidder_id ? item.current_bid + Math.max(10, Math.round(item.min_bid * 0.05)) : item.min_bid;

      const modal = new ModalBuilder()
        .setCustomId(`eco_auction_modal_bid:${auctionId}`)
        .setTitle(`🔨 Tawar ${itemInfo.name.replace(/[^a-zA-Z0-9 ]/g, '').trim().slice(0, 30)}`);

      const bidInput = new TextInputBuilder()
        .setCustomId('eco_auction_input_bid_amount')
        .setLabel(`Koin Bid (Min. Rp ${nextMin.toLocaleString('id-ID')})`)
        .setPlaceholder(`Contoh: ${nextMin}`)
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(bidInput));
      await interaction.showModal(modal);

      const submitted = await interaction.awaitModalSubmit({
        filter: (sub) => sub.customId.startsWith('eco_auction_modal_bid:') && sub.user.id === user.id,
        time: 60000
      }).catch(() => null);

      if (submitted) {
        try {
          const bidAmount = parseInt(submitted.fields.getTextInputValue('eco_auction_input_bid_amount'));
          if (isNaN(bidAmount) || bidAmount <= 0) throw new Error('Koin bid harus berupa angka bulat positif!');

          const res = placeBid(auctionId, user.id, bidAmount, guildId);

          const successEmbed = new EmbedBuilder()
            .setColor(COLORS.BLUE)
            .setTitle('🔨 PENAWARAN HARGA DITERIMA!')
            .setDescription(
              `Penawaran Anda telah dicatat oleh bursa lelang!\n\n` +
              `• ID Lelang: \`${auctionId}\`\n` +
              `• Aset: **${item.item_type === 'PET' ? `🐾 Pet: ${item.item_id}` : `${itemInfo.name} x${item.quantity}`}**\n` +
              `• Bid Anda: **Rp ${bidAmount.toLocaleString('id-ID')}**\n\n` +
              `*Koin Anda didebit langsung sebagai jaminan lelang (escrow) dan akan di-refund otomatis jika warga lain menawar lebih tinggi.*`
            )
            .setTimestamp();

          await submitted.reply({ embeds: [successEmbed], flags: 64 });
        } catch (err) {
          const errEmbed = new EmbedBuilder()
            .setColor(COLORS.ERROR)
            .setTitle('❌ Gagal Mengajukan Bid')
            .setDescription(err.message);
          await submitted.reply({ embeds: [errEmbed], flags: 64 }).catch(() => {});
        }
      }
    }

  } catch (err) {
    console.error('Error in auction interaction handler:', err);
    await interaction.reply({ content: '❌ Terjadi kesalahan sistem saat memproses transaksi lelang.', flags: 64 }).catch(() => {});
  }
}

/**
 * Background scheduler job to check and close expired active auctions
 */
async function checkAndCloseExpiredAuctions(client) {
  const nowUnix = Math.floor(Date.now() / 1000);
  // Get all active auctions that have expired
  const expired = db.all("SELECT * FROM auction_items WHERE status = 'ACTIVE' AND ends_at <= ?", [nowUnix]);

  for (const item of expired) {
    const guildId = item.guild_id;
    const aId = item.id;
    const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) continue;

    let endSuccess = false;
    let endMsgStr = '';

    try {
      db.transaction(() => {
        // Mark completed
        db.run("UPDATE auction_items SET status = 'COMPLETED' WHERE id = ?", [aId]);

        if (item.highest_bidder_id) {
          const itemId = item.item_id;
          const qty = item.quantity;
          const winnerId = item.highest_bidder_id;
          const bidAmount = item.current_bid;

          // 1. Distribute item/pet to winner
          if (item.item_type === 'PET') {
            const petData = JSON.parse(item.pet_details);
            petData.user_id = winnerId;
            
            const petsCount = db.get('SELECT COUNT(*) as count FROM user_pets WHERE user_id = ? AND guild_id = ?', [winnerId, guildId]).count;
            petData.is_active = petsCount === 0 ? 1 : 0;

            insertRow('user_pets', petData);
          } else {
            const isPetItem = item.item_type === 'PET_ITEM';
            if (isPetItem) {
              updatePlayerPetInventory(winnerId, guildId, itemId, qty);
            } else {
              updatePlayerInventory(winnerId, guildId, itemId, qty);
            }
          }

          // 2. Log winner transaction
          db.run('INSERT INTO transactions (user_id, guild_id, type, amount) VALUES (?, ?, ?, ?)', [winnerId, guildId, 'AUCTION_WIN', -bidAmount]);

          // 3. Pay seller if player-owned
          if (item.seller_id) {
            const tax = Math.floor(bidAmount * 0.10);
            const sellerShare = bidAmount - tax;
            economy.addBalance(item.seller_id, guildId, sellerShare, 'AUCTION_SELL');
            
            endMsgStr = `🏆 **LELANG ID ${aId} RESMI SELESAI!**\n\n` +
              `📦 **Barang:** ${item.item_type === 'PET' ? `🐾 Pet: **${itemId}**` : `**${ITEM_MAP[itemId]?.name || itemId}** x${qty}`}\n` +
              `👤 **Pemenang:** <@${winnerId}>\n` +
              `💵 **Harga Akhir:** **Rp ${bidAmount.toLocaleString('id-ID')}**\n` +
              `👤 **Penjual:** <@${item.seller_id}>\n` +
              `💸 **Hasil Bersih Penjual:** **Rp ${sellerShare.toLocaleString('id-ID')}** (setelah dipotong pajak bursa 10%)\n\n` +
              `*Selamat kepada pemenang! Barang/Pet telah dikirim ke inventory/kandang Anda.*`;
          } else {
            // Admin auction
            endMsgStr = `🏆 **LELANG GLOBAL ID ${aId} RESMI SELESAI!**\n\n` +
              `📦 **Barang:** ${item.item_type === 'PET' ? `🐾 Pet: **${itemId}**` : `**${ITEM_MAP[itemId]?.name || itemId}** x${qty}`}\n` +
              `👤 **Pemenang:** <@${winnerId}>\n` +
              `💵 **Harga Akhir:** **Rp ${bidAmount.toLocaleString('id-ID')}** (Koin masuk Kas Negara)\n\n` +
              `*Selamat kepada pemenang! Barang/Pet telah didistribusikan.*`;
          }
        } else {
          // Expired without bids
          if (item.seller_id) {
            // Return item/pet to seller
            if (item.item_type === 'PET') {
              const petData = JSON.parse(item.pet_details);
              petData.user_id = item.seller_id;
              
              const petsCount = db.get('SELECT COUNT(*) as count FROM user_pets WHERE user_id = ? AND guild_id = ?', [item.seller_id, guildId]).count;
              petData.is_active = petsCount === 0 ? 1 : 0;

              insertRow('user_pets', petData);
            } else {
              const isPetItem = item.item_type === 'PET_ITEM';
              if (isPetItem) {
                updatePlayerPetInventory(item.seller_id, guildId, item.item_id, item.quantity);
              } else {
                updatePlayerInventory(item.seller_id, guildId, item.item_id, item.quantity);
              }
            }
            endMsgStr = `ℹ️ **LELANG ID ${aId} SELESAI TANPA PENAWAR!**\n\n` +
              `📦 **Barang:** ${item.item_type === 'PET' ? `🐾 Pet: **${item.item_id}**` : `**${ITEM_MAP[item.item_id]?.name || item.item_id}** x${item.quantity}`}\n` +
              `👤 **Penjual:** <@${item.seller_id}>\n\n` +
              `*Lelang berakhir tanpa ada warga yang menawar. Barang/Pet Anda telah dikembalikan secara gratis ke inventory/kandang.*`;
          } else {
            endMsgStr = `ℹ️ **LELANG GLOBAL ID ${aId} SELESAI TANPA PENAWAR!**\n\nBarang dikembalikan ke Kas Negara.`;
          }
        }
      })();
      endSuccess = true;
    } catch (err) {
      console.error(`Error resolving expired auction ID ${aId}:`, err);
    }

    if (endSuccess) {
      try {
        const announceChannelId = config.ANNOUNCEMENT_CHANNEL_ID || config.REPORT_CHANNEL_ID;
        const chan = guild.channels.cache.get(announceChannelId) || await guild.channels.fetch(announceChannelId).catch(() => null);
        if (chan) {
          const embed = new EmbedBuilder()
            .setColor(item.highest_bidder_id ? COLORS.GOLD : COLORS.WARN)
            .setTitle(item.highest_bidder_id ? '⚖️ BURSA PASAR LELANG: TRANSAKSI BERHASIL! 🏆' : '⚖️ BURSA PASAR LELANG: TIDAK ADA PEMENANG 💨')
            .setDescription(endMsgStr)
            .setTimestamp();
          await chan.send({ embeds: [embed] }).catch(() => {});
        }
      } catch (err) {
        console.error('Error sending auction end announcement:', err.message);
      }
    }
  }
}

module.exports = {
  createAuction,
  cancelAuction,
  placeBid,
  renderAuctionEmbed,
  handleAuctionInteraction,
  checkAndCloseExpiredAuctions,
  ITEM_MAP
};
