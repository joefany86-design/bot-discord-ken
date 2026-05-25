const config = require('./config');
const database = require('./database');
const economy = require('./economy');
const stocks = require('./stocks');
const antiSpam = require('./antiSpam');
const embeds = require('./embeds');
const scheduler = require('./scheduler');
const { EmbedBuilder } = require('discord.js');

/**
 * Inisialisasi Modul Stock Market.
 * Mengaktifkan scheduler otomatis saat bot siap.
 */
function initStockMarket(client) {
  console.log('⚡ Menginisialisasi Modul Stock Market "Rupiah Server"...');
  
  // Daftarkan saham default untuk seluruh server yang terhubung
  client.guilds.cache.forEach(guild => {
    stocks.initDefaultStocks(guild);
  });

  // Jalankan scheduler cron-jobs
  scheduler.initScheduler(client);
}

/**
 * Menangani event messageCreate untuk kalkulasi perolehan koin (ekonomi pasif)
 * dan memberikan skor keaktifan channel saham.
 */
async function handleEconomyChat(message) {
  const { author, guildId, channelId } = message;

  // 1. Validasi filter kelayakan pesan (anti-spam, channel terlarang, dll)
  if (!antiSpam.validateMessage(message)) return;

  // 2. Acak jumlah koin Rupiah Server yang didapat (5 - 15 Rp)
  const earnedCoins = Math.floor(
    Math.random() * (config.economy.MAX_EARN - config.economy.MIN_EARN + 1)
  ) + config.economy.MIN_EARN;

  // 3. Cek bonus kepemilikan saham channel ini (Investor Bonus)
  // Jika member mengirim pesan di channel yang sahamnya ia miliki, dapat bonus +3 Rp
  let investorBonus = 0;
  const portfolio = database.get(
    'SELECT shares FROM portfolios WHERE user_id = ? AND guild_id = ? AND channel_id = ?',
    [author.id, guildId, channelId]
  );
  if (portfolio && portfolio.shares > 0) {
    investorBonus = 3;
  }

  const totalEarned = earnedCoins + investorBonus;

  // 4. Tambahkan saldo koin & catat log message timestamp
  const nowUnix = Math.floor(Date.now() / 1000);
  database.transaction(() => {
    economy.addBalance(author.id, guildId, totalEarned, 'EARN', channelId);
    
    // Simpan timestamp pesan terakhir untuk cooldown anti-spam
    database.run(
      'UPDATE wallets SET last_message_at = ? WHERE user_id = ? AND guild_id = ?',
      [nowUnix, author.id, guildId]
    );
  })();

  // Catat koin di anti-spam tracker untuk limitasi per jam
  antiSpam.recordPoints(author.id, guildId, totalEarned);

  // 5. Tambahkan skor keaktifan channel di bursa saham
  // Memberikan kontribusi 1.0 poin ke skor aktivitas channel
  stocks.recordChannelActivity(channelId, guildId, 1.0);

  // Debug log keaktifan (opsional)
  // console.log(`💰 [Economy] ${author.tag} dapat Rp ${totalEarned} (${earnedCoins} base + ${investorBonus} bonus investor) di #${message.channel.name}`);
}

/**
 * Routing & Handler Perintah Teks dengan awalan titik (.)
 * Mengembalikan true jika perintah dikenali & diproses, false jika bukan perintah modul.
 */
async function handleEconomyCommands(message, client) {
  if (!message.content.startsWith('.')) return false;

  const args = message.content.slice(1).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  const { guildId, author, guild } = message;

  if (!guildId) return false;

  // Pastikan instrumen saham default sudah terdaftar saat perintah dijalankan
  stocks.initDefaultStocks(guild);

  try {
    // ═══════════════════════════════════════════════════
    // Perintah: .balance / .bal / .profile
    // ═══════════════════════════════════════════════════
    if (commandName === 'balance' || commandName === 'bal' || commandName === 'profile') {
      const targetUser = message.mentions.users.first() || author;
      const wallet = economy.getWallet(targetUser.id, guildId);
      const porto = stocks.getPortfolio(targetUser.id, guildId);

      const embed = embeds.profileEmbed(targetUser, wallet, porto.totalPortfolioValue);
      await message.reply({ embeds: [embed] });
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah: .daily
    // ═══════════════════════════════════════════════════
    if (commandName === 'daily') {
      const result = economy.claimDaily(author.id, guildId);
      const embed = embeds.dailyClaimEmbed(author, result);
      await message.reply({ embeds: [embed] });
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah: .transfer @user <jumlah>
    // ═══════════════════════════════════════════════════
    if (commandName === 'transfer') {
      const targetUser = message.mentions.users.first();
      const amountStr = args[1] || args[0]; // support .transfer 100 @user atau .transfer @user 100
      const amount = parseInt(amountStr);

      if (!targetUser) {
        return message.reply('❌ **Format Salah!** Harap sebutkan user penerima transfer.\nContoh: `.transfer @John 500`');
      }
      if (isNaN(amount) || amount <= 0) {
        return message.reply('❌ **Jumlah Tidak Valid!** Nominal transfer harus berupa angka di atas 0.');
      }

      const res = economy.transferBalance(author.id, targetUser.id, guildId, amount);
      
      const embed = new EmbedBuilder()
        .setColor(embeds.COLORS.SUCCESS)
        .setTitle('💸 Transfer Berhasil!')
        .setDescription(
          `Pengiriman koin **${config.CURRENCY_NAME}** sukses diproses!\n\n` +
          `👉 Pengirim: <@${author.id}>\n` +
          `👉 Penerima: <@${targetUser.id}>\n` +
          `💰 Nominal Dikirim: **Rp ${amount.toLocaleString('id-ID')}**\n` +
          `💸 Pajak Transfer (2%): \`Rp ${res.tax.toLocaleString('id-ID')}\`\n` +
          `📥 Bersih Diterima: **Rp ${res.amountReceived.toLocaleString('id-ID')}**`
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah: .market / .saham
    // ═══════════════════════════════════════════════════
    if (commandName === 'market' || commandName === 'saham') {
      const activeStocks = stocks.getStocks(guildId);
      const isOpen = stocks.isMarketOpen();
      const embed = embeds.marketEmbed(activeStocks, isOpen);
      await message.reply({ embeds: [embed] });
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah: .stock <ticker>
    // ═══════════════════════════════════════════════════
    if (commandName === 'stock') {
      const ticker = args[0];
      if (!ticker) {
        return message.reply('❌ **Ticker Harus Diisi!** Contoh: `.stock $GAME` atau `.stock $GENERAL`');
      }

      const stock = stocks.getStock(guildId, ticker);
      if (!stock) {
        return message.reply(`❌ **Saham Tidak Ditemukan!** Ticker \`${ticker}\` tidak ada di server ini.`);
      }

      // Ambal 5 histori harga terakhir
      const history = database.all(
        'SELECT * FROM price_history WHERE channel_id = ? AND guild_id = ? ORDER BY recorded_at DESC LIMIT 5',
        [stock.channel_id, guildId]
      );
      // Reverse agar urutan dari terlama ke terbaru
      history.reverse();

      const embed = embeds.stockDetailEmbed(stock, history);
      await message.reply({ embeds: [embed] });
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah: .buy <ticker> <jumlah>
    // ═══════════════════════════════════════════════════
    if (commandName === 'buy') {
      const ticker = args[0];
      const shares = parseInt(args[1]);

      if (!ticker) {
        return message.reply('❌ **Ticker Harus Diisi!** Contoh: `.buy $GAME 10`');
      }
      if (isNaN(shares) || shares <= 0) {
        return message.reply('❌ **Jumlah Harus Valid!** Berapa lembar saham yang ingin dibeli? Contoh: `.buy $GAME 5`');
      }

      const res = stocks.buyStock(author.id, guildId, ticker, shares);
      const embed = embeds.transactionSuccessEmbed(author, true, res);
      await message.reply({ embeds: [embed] });
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah: .sell <ticker> <jumlah>
    // ═══════════════════════════════════════════════════
    if (commandName === 'sell') {
      const ticker = args[0];
      const shares = parseInt(args[1]);

      if (!ticker) {
        return message.reply('❌ **Ticker Harus Diisi!** Contoh: `.sell $GAME 10`');
      }
      if (isNaN(shares) || shares <= 0) {
        return message.reply('❌ **Jumlah Harus Valid!** Berapa lembar saham yang ingin dijual? Contoh: `.sell $GAME 5`');
      }

      const res = stocks.sellStock(author.id, guildId, ticker, shares);
      const embed = embeds.transactionSuccessEmbed(author, false, res);
      await message.reply({ embeds: [embed] });
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah: .sellall <ticker>
    // ═══════════════════════════════════════════════════
    if (commandName === 'sellall') {
      const ticker = args[0];
      if (!ticker) {
        return message.reply('❌ **Ticker Harus Diisi!** Contoh: `.sellall $GAME`');
      }

      const stock = stocks.getStock(guildId, ticker);
      if (!stock) {
        return message.reply(`❌ **Saham tidak terdaftar!**`);
      }

      const portfolio = database.get(
        'SELECT shares FROM portfolios WHERE user_id = ? AND guild_id = ? AND channel_id = ?',
        [author.id, guildId, stock.channel_id]
      );

      if (!portfolio || portfolio.shares <= 0) {
        return message.reply(`❌ **Portofolio Kosong!** Anda tidak memiliki lembar saham pada ${ticker}.`);
      }

      const res = stocks.sellStock(author.id, guildId, ticker, portfolio.shares);
      const embed = embeds.transactionSuccessEmbed(author, false, res);
      await message.reply({ embeds: [embed] });
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah: .portfolio / .porto
    // ═══════════════════════════════════════════════════
    if (commandName === 'portfolio' || commandName === 'porto') {
      const targetUser = message.mentions.users.first() || author;
      const porto = stocks.getPortfolio(targetUser.id, guildId);
      const wallet = economy.getWallet(targetUser.id, guildId);

      const embed = embeds.portfolioEmbed(targetUser, porto, wallet);
      await message.reply({ embeds: [embed] });
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah: .rich / .leaderboard
    // ═══════════════════════════════════════════════════
    if (commandName === 'rich' || commandName === 'leaderboard') {
      const limit = 10;
      const leaderboard = economy.getLeaderboard(guildId, limit);
      
      // Pastikan cache user terisi
      await Promise.all(leaderboard.map(async u => {
        try { await client.users.fetch(u.userId); } catch (e) {}
      }));

      const embed = embeds.leaderboardEmbed(guild.name, leaderboard, client);
      await message.reply({ embeds: [embed] });
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: .eco-give @user <jumlah>
    // ═══════════════════════════════════════════════════
    if (commandName === 'eco-give') {
      // Validasi izin ADMIN/MANAGE_GUILD
      if (!message.member.permissions.has('ManageGuild') && !message.member.permissions.has('Administrator')) {
        return message.reply('❌ Anda tidak memiliki izin Admin (`ManageGuild`) untuk menggunakan perintah ini!');
      }

      const targetUser = message.mentions.users.first();
      const amount = parseInt(args[1] || args[0]);

      if (!targetUser || isNaN(amount) || amount <= 0) {
        return message.reply('❌ **Format Salah!** Contoh: `.eco-give @user 5000`');
      }

      economy.addBalance(targetUser.id, guildId, amount, 'ADMIN_GIVE');
      await message.reply(`✅ Berhasil memberikan **Rp ${amount.toLocaleString('id-ID')}** koin kepada <@${targetUser.id}>!`);
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: .eco-take @user <jumlah>
    // ═══════════════════════════════════════════════════
    if (commandName === 'eco-take') {
      if (!message.member.permissions.has('ManageGuild') && !message.member.permissions.has('Administrator')) {
        return message.reply('❌ Anda tidak memiliki izin Admin (`ManageGuild`) untuk menggunakan perintah ini!');
      }

      const targetUser = message.mentions.users.first();
      const amount = parseInt(args[1] || args[0]);

      if (!targetUser || isNaN(amount) || amount <= 0) {
        return message.reply('❌ **Format Salah!** Contoh: `.eco-take @user 5000`');
      }

      try {
        economy.subtractBalance(targetUser.id, guildId, amount, 'ADMIN_TAKE');
        await message.reply(`✅ Berhasil menarik **Rp ${amount.toLocaleString('id-ID')}** koin dari <@${targetUser.id}>!`);
      } catch (err) {
        await message.reply(`❌ **Gagal!** ${err.message}`);
      }
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: .market-add #channel <ticker>
    // ═══════════════════════════════════════════════════
    if (commandName === 'market-add') {
      if (!message.member.permissions.has('ManageGuild') && !message.member.permissions.has('Administrator')) {
        return message.reply('❌ Anda tidak memiliki izin Admin untuk menggunakan perintah ini!');
      }

      const channel = message.mentions.channels.first();
      let ticker = args[1];

      if (!channel || !ticker) {
        return message.reply('❌ **Format Salah!** Contoh: `.market-add #game-channel $GAME`');
      }

      ticker = ticker.toUpperCase();
      if (!ticker.startsWith('$')) ticker = '$' + ticker;

      // Cek apakah channel/ticker sudah ada
      const existChan = database.get('SELECT 1 FROM stocks WHERE guild_id = ? AND channel_id = ?', [guildId, channel.id]);
      const existTicker = database.get('SELECT 1 FROM stocks WHERE guild_id = ? AND stock_ticker = ?', [guildId, ticker]);

      if (existChan) return message.reply('❌ Channel ini sudah terdaftar sebagai saham!');
      if (existTicker) return message.reply('❌ Ticker ini sudah digunakan oleh saham lain!');

      database.run(
        `INSERT INTO stocks (channel_id, guild_id, stock_name, stock_ticker, current_price, previous_price, total_shares, available_shares) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [channel.id, guildId, channel.name, ticker, config.market.INITIAL_PRICE, config.market.INITIAL_PRICE, 1000, 1000]
      );

      await message.reply(`✅ Sukses menambahkan saham **${ticker}** untuk channel <#${channel.id}>!`);
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: .market-remove <ticker>
    // ═══════════════════════════════════════════════════
    if (commandName === 'market-remove') {
      if (!message.member.permissions.has('ManageGuild') && !message.member.permissions.has('Administrator')) {
        return message.reply('❌ Anda tidak memiliki izin Admin untuk menggunakan perintah ini!');
      }

      const ticker = args[0];
      if (!ticker) return message.reply('❌ **Format Salah!** Contoh: `.market-remove $GAME`');

      const stock = stocks.getStock(guildId, ticker);
      if (!stock) return message.reply('❌ Saham tidak ditemukan!');

      database.transaction(() => {
        // Hapus dari bursa
        database.run('DELETE FROM stocks WHERE channel_id = ? AND guild_id = ?', [stock.channel_id, guildId]);
        // Hapus seluruh portofolio terkait
        database.run('DELETE FROM portfolios WHERE channel_id = ? AND guild_id = ?', [stock.channel_id, guildId]);
      })();

      await message.reply(`✅ Sukses menghapus instrumen saham **${ticker}** dari bursa.`);
      return true;
    }

  } catch (error) {
    console.error(`❌ [Command Error - .${commandName}]:`, error.message);
    await message.reply(`❌ **Gagal memproses perintah!** ${error.message}`).catch(() => {});
    return true;
  }

  return false;
}

module.exports = {
  initStockMarket,
  handleEconomyChat,
  handleEconomyCommands
};
