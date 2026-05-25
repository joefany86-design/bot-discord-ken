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

  // Cari 4 channel teks pertama
  const textChannels = Array.from(guild.channels.cache.values())
    .filter(c => c.type === ChannelType.GuildText)
    .slice(0, 4);

  if (textChannels.length === 0) return;

  db.transaction(() => {
    textChannels.forEach((chan, idx) => {
      // Buat ticker: Ambil 3-4 huruf pertama nama channel, jadikan uppercase
      let cleanName = chan.name.replace(/[^a-zA-Z0-9]/g, '');
      let ticker = '$' + (cleanName.substring(0, 4) || `CHAN${idx}`).toUpperCase();
      
      // Pastikan ticker unik di server
      let isDuplicate = true;
      let suffix = 1;
      while (isDuplicate) {
        const dup = db.get('SELECT 1 FROM stocks WHERE guild_id = ? AND stock_ticker = ?', [guildId, ticker]);
        if (!dup) {
          isDuplicate = false;
        } else {
          ticker = '$' + (cleanName.substring(0, 3) || `CH`).toUpperCase() + suffix;
          suffix++;
        }
      }

      db.run(
        `INSERT INTO stocks (channel_id, guild_id, stock_name, stock_ticker, current_price, previous_price, total_shares, available_shares) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [chan.id, guildId, chan.name, ticker, config.market.INITIAL_PRICE, config.market.INITIAL_PRICE, 1000, 1000]
      );
      
      // Catat harga awal di history
      db.run(
        `INSERT INTO price_history (channel_id, guild_id, price, activity_score) 
         VALUES (?, ?, ?, 0.0)`,
        [chan.id, guildId, config.market.INITIAL_PRICE]
      );

      console.log(`📈 Terdaftar saham default: ${ticker} untuk channel #${chan.name} di guild ${guild.name}`);
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
  if (!isMarketOpen()) {
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
  const wallet = economy.getWallet(userId, guildId);
  if (wallet.balance < totalPrice) {
    throw new Error(`❌ Saldo Anda tidak mencukupi! Anda butuh Rp ${totalPrice}, saldo Anda saat ini Rp ${wallet.balance}.`);
  }

  db.transaction(() => {
    // 1. Kurangi saldo koin user
    economy.subtractBalance(userId, guildId, totalPrice, 'BUY', stock.channel_id);

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
  if (!isMarketOpen()) {
    throw new Error('❌ Bursa Saham sedang TUTUP! Jam operasional perdagangan: 08:00 - 23:00 WIB.');
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

  const rawRevenue = stock.current_price * shares;
  // Hitung pajak penjualan 5%
  const tax = Math.floor(rawRevenue * (config.economy.TRADE_TAX_PERCENT / 100));
  const finalRevenue = rawRevenue - tax;

  db.transaction(() => {
    // 1. Tambahkan saldo koin user
    economy.addBalance(userId, guildId, finalRevenue, 'SELL', stock.channel_id);

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

  db.transaction(() => {
    stocks.forEach(stock => {
      const score = stock.activity_score;
      let deltaPercent = 0;

      // Logika perubahan harga berdasarkan activity score
      // Baseline activity dianggap 5.0 per 2 jam
      const baseline = 5.0;
      if (score === 0) {
        // Sepi total
        deltaPercent = -0.05 - (Math.random() * 0.05); // Turun 5% s/d 10%
      } else {
        // Perbandingan dengan baseline
        const ratio = (score - baseline) / baseline;
        deltaPercent = ratio * 0.1; // Skala faktor 10%
        
        // Clamp perubahan agar wajar (-15% s/d +20% per update)
        deltaPercent = Math.max(-0.15, Math.min(0.20, deltaPercent));
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
        activity: score
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
      // Nilai dividen dasar (2% dari harga pasar saat ini)
      const baseDividend = p.current_price * config.market.WEEKLY_DIVIDEND_BASE_RATE;
      const totalDividend = Math.floor(baseDividend * p.shares);

      if (totalDividend > 0) {
        economy.addBalance(p.user_id, guildId, totalDividend, 'DIVIDEND', p.channel_id);
        distributions.push({
          userId: p.user_id,
          ticker: p.stock_ticker,
          shares: p.shares,
          amount: totalDividend
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
