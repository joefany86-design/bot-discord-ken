const db = require('./database');
const config = require('./config');
const economy = require('./economy');
const { ChannelType } = require('discord.js');

/**
 * Mendaftarkan 4 channel teks paling aktif di server sebagai instrumen saham default jika belum terdaftar.
 */
function initDefaultStocks(guild) {
  const guildId = guild.id;
  const existingCount = db.get(
    'SELECT COUNT(*) as count FROM stocks WHERE guild_id = ?',
    [guildId]
  ).count;

  if (existingCount > 0) return; // Sudah terinisialisasi

  const allTextChannels = Array.from(guild.channels.cache.values())
    .filter(c => c.type === ChannelType.GuildText);

  if (allTextChannels.length === 0) return;

  // Pemetaan channel khusus yang diminta user
  const predefined = [
    { key: 'channel-bot', ticker: '$CHAN' },
    { key: 'living-room', ticker: '$LIVG' },
    { key: 'spill-the-tea', ticker: '$STE' },
    { key: 'luxury-gallery', ticker: '$LUX' }
  ];

  const selectedChannels = [];
  const registeredTickers = new Set();

  // 1. Coba cari channel yang cocok dengan kata kunci khusus
  predefined.forEach(p => {
    const found = allTextChannels.find(c => c.name.toLowerCase().includes(p.key));
    if (found) {
      selectedChannels.push({ channel: found, ticker: p.ticker });
      registeredTickers.add(p.ticker);
    }
  });

  // 2. Jika kurang dari 4 channel, ambil channel teks lain sebagai cadangan (fallback)
  if (selectedChannels.length < 4) {
    allTextChannels.forEach(chan => {
      // Cek apakah channel ini sudah dimasukkan
      if (selectedChannels.some(s => s.channel.id === chan.id)) return;
      if (selectedChannels.length >= 4) return;

      // Buat ticker otomatis
      let cleanName = chan.name.replace(/[^a-zA-Z0-9]/g, '');
      let ticker = '$' + (cleanName.substring(0, 4) || 'CHAN').toUpperCase();

      // Pastikan ticker unik
      let isDuplicate = true;
      let suffix = 1;
      while (isDuplicate) {
        if (!registeredTickers.has(ticker)) {
          isDuplicate = false;
        } else {
          ticker = '$' + (cleanName.substring(0, 3) || 'CH').toUpperCase() + suffix;
          suffix++;
        }
      }

      selectedChannels.push({ channel: chan, ticker });
      registeredTickers.add(ticker);
    });
  }

  // 3. Masukkan ke database
  db.transaction(() => {
    selectedChannels.forEach(({ channel, ticker }) => {
      db.run(
        `INSERT INTO stocks (channel_id, guild_id, stock_name, stock_ticker, current_price, previous_price, total_shares, available_shares) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [channel.id, guildId, channel.name, ticker, config.market.INITIAL_PRICE, config.market.INITIAL_PRICE, 99999999, 99999999]
      );
      
      // Catat harga awal di history
      db.run(
        `INSERT INTO price_history (channel_id, guild_id, price, activity_score) 
         VALUES (?, ?, ?, 0.0)`,
        [channel.id, guildId, config.market.INITIAL_PRICE]
      );

      console.log(`📈 Terdaftar saham default: ${ticker} untuk channel #${channel.name} di guild ${guild.name}`);
    });
  })();
}

/**
 * Cek apakah bursa saham saat ini sedang buka (08:00 - 23:00 WIB).
 */
function isMarketOpen() {
  const now = new Date();
  
  // Konversi UTC ke WIB (UTC+7)
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const wibTime = new Date(utc + (3600000 * 7));
  const currentHour = wibTime.getHours();

  return currentHour >= config.market.OPEN_HOUR && currentHour < config.market.CLOSE_HOUR;
}

/**
 * Mendapatkan detail informasi saham tertentu di guild (berdasarkan ticker e.g. '$GAME' atau channel ID).
 */
function getStock(guildId, tickerOrChannelId) {
  const queryArg = tickerOrChannelId.toUpperCase();
  return db.get(
    `SELECT * FROM stocks 
     WHERE guild_id = ? AND (UPPER(stock_ticker) = ? OR channel_id = ? OR stock_ticker = ?)`,
    [guildId, queryArg, tickerOrChannelId, queryArg]
  );
}

/**
 * Mendapatkan seluruh instrumen saham di guild.
 */
function getStocks(guildId) {
  return db.all('SELECT * FROM stocks WHERE guild_id = ? AND is_active = 1', [guildId]);
}

/**
 * Member melakukan pembelian (BUY) saham menggunakan koin Rupiah Server.
 */
function buyStock(userId, guildId, ticker, shares) {
  if (!module.exports.isMarketOpen()) {
    throw new Error('❌ Bursa Saham sedang TUTUP! Jam operasional perdagangan: 08:00 - 23:00 WIB.');
  }

  if (shares < config.market.MIN_SHARES_TRADE || shares > config.market.MAX_SHARES_PER_TRADE) {
    throw new Error(`❌ Jumlah lembar pembelian harus antara ${config.market.MIN_SHARES_TRADE} hingga ${config.market.MAX_SHARES_PER_TRADE} lembar!`);
  }

  const stock = getStock(guildId, ticker);
  if (!stock) throw new Error('❌ Saham tidak ditemukan di server ini!');
  if (stock.available_shares < shares) {
    throw new Error(`❌ Stok saham ini di pasar tidak cukup! Tersisa ${stock.available_shares} lembar.`);
  }

  const totalPrice = stock.current_price * shares;

  // 0. Cek batas kepemilikan saham per user
  let portfolio = db.get(
    'SELECT * FROM portfolios WHERE user_id = ? AND guild_id = ? AND channel_id = ?',
    [userId, guildId, stock.channel_id]
  );
  const currentShares = portfolio ? portfolio.shares : 0;
  const maxSharesHold = config.market.MAX_SHARES_HOLD_PER_USER || 500;
  if (currentShares + shares > maxSharesHold) {
    throw new Error(`❌ Kepemilikan terlampaui! Maksimal saham yang boleh Anda miliki untuk satu channel adalah ${maxSharesHold} lembar. Saat ini Anda memiliki ${currentShares} lembar.`);
  }

  // 0b. Cek batas harian transaksi pembelian (maksimal 10 kali per hari per user)
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const wibTime = new Date(utc + (3600000 * 7));
  const year = wibTime.getFullYear();
  const month = String(wibTime.getMonth() + 1).padStart(2, '0');
  const day = String(wibTime.getDate()).padStart(2, '0');
  const wibDateStr = `${year}-${month}-${day}`;
  const todayStartUnix = Math.floor(new Date(`${wibDateStr}T00:00:00+07:00`).getTime() / 1000);

  const buyTxCountRow = db.get(
    `SELECT COUNT(*) as count FROM transactions 
     WHERE user_id = ? AND guild_id = ? AND type = 'BUY' AND created_at >= ?`,
    [userId, guildId, todayStartUnix]
  );
  const buyTxCount = buyTxCountRow ? buyTxCountRow.count : 0;
  const maxBuyLimit = config.market.DAILY_BUY_TRANSACTION_LIMIT || 10;
  if (buyTxCount >= maxBuyLimit) {
    throw new Error(`❌ Batas Harian Tercapai! Anda sudah melakukan ${buyTxCount} kali transaksi pembelian hari ini. Batas maksimal adalah ${maxBuyLimit} kali transaksi per hari.`);
  }

  const wallet = economy.getWallet(userId, guildId);
  if (wallet.balance < totalPrice) {
    throw new Error(`❌ Saldo Anda tidak mencukupi! Anda butuh Rp ${totalPrice}, saldo Anda saat ini Rp ${wallet.balance}.`);
  }

  db.transaction(() => {
    // 1. Kurangi saldo koin user
    economy.subtractBalance(userId, guildId, totalPrice, 'BUY', stock.channel_id);

    // Update record transaksi terbaru untuk mengisi field shares dan price_per_share
    db.run(
      `UPDATE transactions 
       SET shares = ?, price_per_share = ? 
       WHERE user_id = ? AND guild_id = ? AND type = 'BUY' AND channel_id = ? 
       AND id = (SELECT MAX(id) FROM transactions WHERE user_id = ? AND guild_id = ? AND type = 'BUY')`,
      [shares, stock.current_price, userId, guildId, stock.channel_id, userId, guildId]
    );

    // 2. Update status lembar saham di pasar
    db.run(
      `UPDATE stocks 
       SET available_shares = available_shares - ? 
       WHERE channel_id = ? AND guild_id = ?`,
      [shares, stock.channel_id, guildId]
    );

    // 3. Tambahkan ke portofolio user
    let portfolio = db.get(
      'SELECT * FROM portfolios WHERE user_id = ? AND guild_id = ? AND channel_id = ?',
      [userId, guildId, stock.channel_id]
    );

    if (!portfolio) {
      db.run(
        `INSERT INTO portfolios (user_id, guild_id, channel_id, shares, avg_buy_price, total_invested) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, guildId, stock.channel_id, shares, stock.current_price, totalPrice]
      );
    } else {
      const newShares = portfolio.shares + shares;
      const newTotalInvested = portfolio.total_invested + totalPrice;
      const newAvgPrice = Math.floor(newTotalInvested / newShares);
      
      db.run(
        `UPDATE portfolios 
         SET shares = ?, avg_buy_price = ?, total_invested = ? 
         WHERE user_id = ? AND guild_id = ? AND channel_id = ?`,
        [newShares, newAvgPrice, newTotalInvested, userId, guildId, stock.channel_id]
      );
    }

    // 4. Update total investasi di wallet
    db.run(
      `UPDATE wallets SET total_invested = total_invested + ? WHERE user_id = ? AND guild_id = ?`,
      [totalPrice, userId, guildId]
    );
  })();

  return {
    shares,
    stockName: stock.stock_name,
    ticker: stock.stock_ticker,
    pricePerShare: stock.current_price,
    totalPrice
  };
}

/**
 * Member melakukan penjualan (SELL) saham dengan pajak transaksi 5%.
 */
function sellStock(userId, guildId, ticker, shares) {
  if (!module.exports.isMarketOpen()) {
    throw new Error('❌ Bursa Saham sedang TUTUP! Jam operasional perdagangan: 08:00 - 23:00 WIB.');
  }

  const maxSellLimit = config.market.MAX_SHARES_SELL_PER_TRADE || 500;
  if (shares > maxSellLimit) {
    throw new Error(`❌ Batas Transaksi Tercapai! Maksimal lembar saham yang dapat dijual dalam satu transaksi adalah ${maxSellLimit} lembar.`);
  }

  const stock = getStock(guildId, ticker);
  if (!stock) throw new Error('❌ Saham tidak ditemukan di server ini!');

  let portfolio = db.get(
    'SELECT * FROM portfolios WHERE user_id = ? AND guild_id = ? AND channel_id = ?',
    [userId, guildId, stock.channel_id]
  );

  if (!portfolio || portfolio.shares < shares) {
    throw new Error(`❌ Portofolio Anda tidak memiliki saham ini sebanyak ${shares} lembar! Anda hanya memiliki ${portfolio ? portfolio.shares : 0} lembar.`);
  }

  // --- VALIDASI DURASI HOLD MINIMAL 1 HARI (24 JAM) ---
  const nowUnix = Math.floor(Date.now() / 1000);
  const lockTimeLimit = nowUnix - (config.market.MIN_HOLD_DURATION_SECONDS || 86400);

  // Ambil total shares yang dibeli dalam 24 jam terakhir
  const recentBoughtRow = db.get(
    `SELECT SUM(shares) as total FROM transactions 
     WHERE user_id = ? AND guild_id = ? AND channel_id = ? AND type = 'BUY' AND created_at > ?`,
    [userId, guildId, stock.channel_id, lockTimeLimit]
  );
  
  const recentBought = recentBoughtRow ? (recentBoughtRow.total || 0) : 0;
  const lockedShares = Math.min(portfolio.shares, recentBought);
  const sellableShares = portfolio.shares - lockedShares;

  if (shares > sellableShares) {
    const oldestLockedTx = db.get(
      `SELECT created_at FROM transactions 
       WHERE user_id = ? AND guild_id = ? AND channel_id = ? AND type = 'BUY' AND created_at > ?
       ORDER BY created_at ASC LIMIT 1`,
      [userId, guildId, stock.channel_id, lockTimeLimit]
    );
    let timeMsg = '';
    if (oldestLockedTx) {
      const remainingTime = (oldestLockedTx.created_at + (config.market.MIN_HOLD_DURATION_SECONDS || 86400)) - nowUnix;
      const hours = Math.floor(remainingTime / 3600);
      const minutes = Math.floor((remainingTime % 3600) / 60);
      timeMsg = ` Sisa waktu hold untuk pembelian terbaru Anda sekitar ${hours} jam ${minutes} menit.`;
    }
    throw new Error(`❌ Saham Terkunci! Anda hanya memiliki ${sellableShares} lembar saham yang dapat dijual saat ini (ada ${lockedShares} lembar saham yang baru Anda beli dalam 24 jam terakhir dan masih dikunci).${timeMsg}`);
  }

  const rawRevenue = stock.current_price * shares;
  
  // Ambil sewa kamar aktif
  const kos = require('./kos');
  const activeRental = kos.getActiveRental(userId, guildId);

  let taxRatePercent = config.economy.TRADE_TAX_PERCENT;
  if (activeRental && activeRental.config && activeRental.config.tradeTax !== undefined) {
    taxRatePercent = activeRental.config.tradeTax;
  }

  const tax = Math.floor(rawRevenue * (taxRatePercent / 100));
  const finalRevenue = rawRevenue - tax;

  db.transaction(() => {
    // 1. Tambahkan saldo koin user
    economy.addBalance(userId, guildId, finalRevenue, 'SELL', stock.channel_id);

    // Update record transaksi terbaru untuk mengisi field shares dan price_per_share
    db.run(
      `UPDATE transactions 
       SET shares = ?, price_per_share = ? 
       WHERE user_id = ? AND guild_id = ? AND type = 'SELL' AND channel_id = ? 
       AND id = (SELECT MAX(id) FROM transactions WHERE user_id = ? AND guild_id = ? AND type = 'SELL')`,
      [shares, stock.current_price, userId, guildId, stock.channel_id, userId, guildId]
    );

    // 2. Kembalikan ketersediaan lembar saham di pasar
    db.run(
      `UPDATE stocks 
       SET available_shares = available_shares + ? 
       WHERE channel_id = ? AND guild_id = ?`,
      [shares, stock.channel_id, guildId]
    );

    // 3. Update portofolio user
    const remainingShares = portfolio.shares - shares;
    if (remainingShares === 0) {
      db.run(
        'DELETE FROM portfolios WHERE user_id = ? AND guild_id = ? AND channel_id = ?',
        [userId, guildId, stock.channel_id]
      );
    } else {
      // Hitung sisa total investasi secara proporsional
      const remainingInvested = Math.max(0, portfolio.total_invested - (portfolio.avg_buy_price * shares));
      db.run(
        `UPDATE portfolios 
         SET shares = ?, total_invested = ? 
         WHERE user_id = ? AND guild_id = ? AND channel_id = ?`,
        [remainingShares, remainingInvested, userId, guildId, stock.channel_id]
      );
    }
  })();

  return {
    shares,
    stockName: stock.stock_name,
    ticker: stock.stock_ticker,
    pricePerShare: stock.current_price,
    rawRevenue,
    tax,
    finalRevenue
  };
}

/**
 * Mengakumulasikan aktivitas chat channel untuk update harga.
 */
function recordChannelActivity(channelId, guildId, scorePoints = 1.0) {
  db.run(
    `UPDATE stocks 
     SET activity_score = activity_score + ? 
     WHERE channel_id = ? AND guild_id = ?`,
    [scorePoints, channelId, guildId]
  );
}

/**
 * Mendapatkan portofolio investasi user lengkap beserta nilai valuasi real-time.
 */
function getPortfolio(userId, guildId) {
  const items = db.all(
    `SELECT p.*, s.stock_ticker, s.stock_name, s.current_price 
     FROM portfolios p
     INNER JOIN stocks s ON p.channel_id = s.channel_id AND p.guild_id = s.guild_id
     WHERE p.user_id = ? AND p.guild_id = ?`,
    [userId, guildId]
  );

  let totalWealth = 0;
  const details = items.map(item => {
    const currentValue = item.shares * item.current_price;
    totalWealth += currentValue;
    const profitRp = currentValue - item.total_invested;
    const profitPercent = item.total_invested > 0 
      ? ((profitRp / item.total_invested) * 100).toFixed(1) 
      : '0.0';

    return {
      ticker: item.stock_ticker,
      name: item.stock_name,
      shares: item.shares,
      avgPrice: item.avg_buy_price,
      currentPrice: item.current_price,
      totalInvested: item.total_invested,
      currentValue,
      profitRp,
      profitPercent: parseFloat(profitPercent)
    };
  });

  return {
    items: details,
    totalPortfolioValue: totalWealth
  };
}

/**
 * Re-kalkulasi harga saham per server berdasarkan activity_score
 * Dipanggil secara terjadwal (Scheduler 2 jam sekali).
 */
function updateStockPrices(guildId) {
  const stocks = db.all('SELECT * FROM stocks WHERE guild_id = ? AND is_active = 1', [guildId]);
  const updates = [];

  if (stocks.length === 0) return updates;

  // Cari saham termahal (highest price) dan saham termurah (lowest price)
  let highestPrice = -Infinity;
  let lowestPrice = Infinity;
  let highestStock = null;
  let lowestStock = null;

  stocks.forEach(s => {
    if (s.current_price > highestPrice) {
      highestPrice = s.current_price;
      highestStock = s;
    }
    if (s.current_price < lowestPrice) {
      lowestPrice = s.current_price;
      lowestStock = s;
    }
  });

  // Tentukan apakah crash / pump terpicu
  // Saham termahal mengalami crash jika harganya melebihi harga awal (INITIAL_PRICE = Rp 100)
  const isCrashEligible = highestStock && highestPrice > config.market.INITIAL_PRICE;
  // Saham termurah mengalami pump jika harganya di bawah Rp 2.000 dan bukan saham yang sama dengan saham termahal
  const isPumpEligible = lowestStock && lowestPrice < 2000 && (stocks.length > 1 ? lowestStock.channel_id !== highestStock.channel_id : false);

  db.transaction(() => {
    stocks.forEach(stock => {
      const score = stock.activity_score;
      let deltaPercent = 0;
      let isCrashed = false;
      let isPumped = false;

      const nowSecs = Math.floor(Date.now() / 1000);
      let activeTrend = stock.force_trend || 'NONE';
      let activeUntil = stock.force_until || 0;

      // Cek apakah durasi manipulasi tren sudah berakhir
      if (activeTrend !== 'NONE' && nowSecs >= activeUntil) {
        db.run(
          "UPDATE stocks SET force_trend = 'NONE', force_until = 0 WHERE channel_id = ? AND guild_id = ?",
          [stock.channel_id, guildId]
        );
        activeTrend = 'NONE';
      }

      if (activeTrend !== 'NONE') {
        if (activeTrend === 'PUMP_MAX') {
          // Pompa langsung ke harga maksimal
          deltaPercent = 100.0;
          isPumped = true;
        } else if (activeTrend === 'DUMP_MIN') {
          // Banting langsung ke harga minimal
          deltaPercent = -1.0;
          isCrashed = true;
        } else if (activeTrend === 'PUMP') {
          // Pompa dinamis terus naik: +15% s/d +45%
          deltaPercent = 0.15 + (Math.random() * 0.30);
          isPumped = true;
        } else if (activeTrend === 'DUMP') {
          // Banting dinamis terus turun: -15% s/d -40%
          deltaPercent = -0.15 - (Math.random() * 0.25);
          isCrashed = true;
        }
      } else if (isCrashEligible && stock.channel_id === highestStock.channel_id) {
        // Crash / Bubble Burst drastis (-50% s/d -85%)
        deltaPercent = -0.50 - (Math.random() * 0.35);
        isCrashed = true;
      } else if (isPumpEligible && stock.channel_id === lowestStock.channel_id) {
        // Pump / Bull Run mendadak (+50% s/d +150%)
        deltaPercent = 0.50 + (Math.random() * 1.00);
        isPumped = true;
      } else {
        // Logika FULL OTOMATIS (Tidak bergantung pada chat)
        // Fluktuasi acak yang dinamis layaknya pasar saham nyata
        const rand = Math.random();
        if (rand < 0.45) {
          // 45% peluang turun: -2% s/d -12%
          deltaPercent = -0.02 - (Math.random() * 0.10);
        } else if (rand < 0.90) {
          // 45% peluang naik: +2% s/d +15%
          deltaPercent = 0.02 + (Math.random() * 0.13);
        } else {
          // 10% peluang pergerakan ekstrim (micro-pump / micro-dump harian)
          const isExtremePump = Math.random() < 0.5;
          deltaPercent = isExtremePump ? (0.15 + Math.random() * 0.15) : (-0.12 - Math.random() * 0.10);
        }
      }

      // Hitung harga baru
      const oldPrice = stock.current_price;
      let newPrice = Math.floor(oldPrice * (1 + deltaPercent));
      
      // Terapkan batasan harga minimum dan maksimum
      newPrice = Math.max(config.market.MIN_PRICE, Math.min(config.market.MAX_PRICE, newPrice));

      // Update di database
      db.run(
        `UPDATE stocks 
         SET previous_price = current_price, current_price = ?, activity_score = 0.0 
         WHERE channel_id = ? AND guild_id = ?`,
        [newPrice, stock.channel_id, guildId]
      );

      // Catat ke riwayat harga
      db.run(
        `INSERT INTO price_history (channel_id, guild_id, price, activity_score) 
         VALUES (?, ?, ?, ?)`,
        [stock.channel_id, guildId, newPrice, score]
      );

      const changePct = (((newPrice - oldPrice) / oldPrice) * 100).toFixed(1);
      updates.push({
        ticker: stock.stock_ticker,
        name: stock.stock_name,
        oldPrice,
        newPrice,
        changePct: parseFloat(changePct),
        activity: score,
        isCrashed,
        isPumped
      });
    });
  })();

  return updates;
}

/**
 * Mendistribusikan Dividen mingguan kepada seluruh investor yang menahan (hold) saham.
 * Memberikan dividen ekstra jika performa channel sangat tinggi.
 */
function distributeWeeklyDividends(guildId) {
  // Ambil data portofolio investor yang memiliki shares > 0
  const portfolios = db.all(
    `SELECT p.*, s.current_price, s.stock_ticker, s.stock_name 
     FROM portfolios p
     INNER JOIN stocks s ON p.channel_id = s.channel_id AND p.guild_id = s.guild_id
     WHERE p.guild_id = ? AND p.shares > 0`,
    [guildId]
  );

  const distributions = [];

  db.transaction(() => {
    portfolios.forEach(p => {
      // Ambil total keaktifan chat selama 7 hari terakhir dari price_history
      const sevenDaysAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
      const activityRow = db.get(
        `SELECT SUM(activity_score) as total_activity 
         FROM price_history 
         WHERE channel_id = ? AND guild_id = ? AND recorded_at >= ?`,
        [p.channel_id, guildId, sevenDaysAgo]
      );
      const weeklyActivity = (activityRow && activityRow.total_activity) ? activityRow.total_activity : 0.0;

      // Kalkulasi rasio dividen dinamis (Dasar 1% + Bonus keaktifan, maks 9%)
      const dividendRate = 0.01 + Math.min(0.08, (weeklyActivity / 1000));
      const totalDividend = Math.floor(p.current_price * dividendRate * p.shares);

      if (totalDividend > 0) {
        economy.addBalance(p.user_id, guildId, totalDividend, 'DIVIDEND', p.channel_id);
        distributions.push({
          userId: p.user_id,
          ticker: p.stock_ticker,
          name: p.stock_name,
          shares: p.shares,
          amount: totalDividend,
          rate: (dividendRate * 100).toFixed(2),
          activity: weeklyActivity.toFixed(1)
        });
      }
    });
  })();

  return distributions;
}

module.exports = {
  initDefaultStocks,
  getStock,
  getStocks,
  buyStock,
  sellStock,
  recordChannelActivity,
  getPortfolio,
  updateStockPrices,
  distributeWeeklyDividends,
  isMarketOpen
};
