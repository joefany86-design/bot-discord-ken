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
        return message.reply({ embeds: [embeds.warnEmbed('Format Salah!', 'Harap sebutkan user penerima transfer.\nContoh: `.transfer @John 500`')] });
      }
      if (isNaN(amount) || amount <= 0) {
        return message.reply({ embeds: [embeds.warnEmbed('Jumlah Tidak Valid!', 'Nominal transfer harus berupa angka di atas 0.')] });
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
        return message.reply({ embeds: [embeds.warnEmbed('Ticker Harus Diisi!', 'Contoh: `.stock $GAME` atau `.stock $GENERAL`')] });
      }

      const stock = stocks.getStock(guildId, ticker);
      if (!stock) {
        return message.reply({ embeds: [embeds.warnEmbed('Saham Tidak Ditemukan!', `Ticker \`${ticker}\` tidak ada di server ini.`)] });
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
        return message.reply({ embeds: [embeds.warnEmbed('Ticker Harus Diisi!', 'Contoh: `.buy $GAME 10`')] });
      }
      if (isNaN(shares) || shares <= 0) {
        return message.reply({ embeds: [embeds.warnEmbed('Jumlah Harus Valid!', 'Berapa lembar saham yang ingin dibeli? Contoh: `.buy $GAME 5`')] });
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
        return message.reply({ embeds: [embeds.warnEmbed('Ticker Harus Diisi!', 'Contoh: `.sell $GAME 10`')] });
      }
      if (isNaN(shares) || shares <= 0) {
        return message.reply({ embeds: [embeds.warnEmbed('Jumlah Harus Valid!', 'Berapa lembar saham yang ingin dijual? Contoh: `.sell $GAME 5`')] });
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
        return message.reply({ embeds: [embeds.warnEmbed('Ticker Harus Diisi!', 'Contoh: `.sellall $GAME`')] });
      }

      const stock = stocks.getStock(guildId, ticker);
      if (!stock) {
        return message.reply({ embeds: [embeds.warnEmbed('Saham Tidak Terdaftar!', `Ticker \`${ticker}\` tidak terdaftar di server ini.`)] });
      }

      const portfolio = database.get(
        'SELECT shares FROM portfolios WHERE user_id = ? AND guild_id = ? AND channel_id = ?',
        [author.id, guildId, stock.channel_id]
      );

      if (!portfolio || portfolio.shares <= 0) {
        return message.reply({ embeds: [embeds.warnEmbed('Portofolio Kosong!', `Anda tidak memiliki lembar saham pada ${ticker}.`)] });
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
    // Perintah: .shop / .rolemarket
    // ═══════════════════════════════════════════════════
    if (commandName === 'shop' || commandName === 'rolemarket') {
      const wallet = economy.getWallet(author.id, guildId);
      const items = database.all('SELECT * FROM shop_items WHERE guild_id = ?', [guildId]);
      const embed = embeds.shopEmbed(items, wallet);
      await message.reply({ embeds: [embed] });
      return true;
    }

    // ═══════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════
    // Perintah: .buy-role / .shop-buy <@role atau ID>
    // ═══════════════════════════════════════════════════
    if (commandName === 'buy-role' || commandName === 'shop-buy') {
      const input = args[0];
      if (!input) {
        return message.reply({ embeds: [embeds.warnEmbed('Format Salah!', 'Harap sebutkan role atau ID item toko yang ingin dibeli.\nContoh: `.buy-role @role` atau `.buy-role <ID>`')] });
      }

      let item = null;
      const id = parseInt(input);

      if (!isNaN(id)) {
        item = database.get('SELECT * FROM shop_items WHERE id = ? AND guild_id = ?', [id, guildId]);
      } else {
        const role = message.mentions.roles.first() || guild.roles.cache.get(input) || guild.roles.cache.find(r => r.name.toLowerCase() === input.toLowerCase());
        if (role) {
          item = database.get('SELECT * FROM shop_items WHERE role_id = ? AND guild_id = ?', [role.id, guildId]);
        }
      }

      if (!item) {
        return message.reply({ embeds: [embeds.warnEmbed('Item Tidak Ditemukan!', `Item role atau ID tersebut tidak terdaftar di toko server ini.`)] });
      }

      if (item.stock !== -1 && item.stock <= 0) {
        return message.reply({ embeds: [embeds.warnEmbed('Stok Habis!', `Role **${item.role_name}** telah habis terjual (Sold Out)!`)] });
      }

      const discordRole = guild.roles.cache.get(item.role_id) || await guild.roles.fetch(item.role_id).catch(() => null);
      if (!discordRole) {
        return message.reply({ embeds: [embeds.errorEmbed('Role Tidak Ditemukan!', 'Role ini tidak lagi eksis di server Discord Anda. Silakan hubungi admin!')] });
      }

      const memberObj = message.member || await guild.members.fetch(author.id).catch(() => null);
      if (!memberObj) {
        return message.reply({ embeds: [embeds.errorEmbed('Gagal Memproses!', 'Gagal mengambil data profil anggota Discord Anda.')] });
      }

      if (memberObj.roles.cache.has(item.role_id)) {
        return message.reply({ embeds: [embeds.warnEmbed('Sudah Memiliki Role!', `Anda sudah memiliki role **${item.role_name}** di server ini!`)] });
      }

      const wallet = economy.getWallet(author.id, guildId);
      if (wallet.balance < item.price) {
        return message.reply({ embeds: [embeds.warnEmbed('Saldo Koin Tidak Cukup!', `Anda memerlukan **Rp ${item.price.toLocaleString('id-ID')}** tetapi saldo Anda hanya **Rp ${wallet.balance.toLocaleString('id-ID')}**.`)] });
      }

      // Mulai penukaran: Tambahkan role dulu ke user
      try {
        await memberObj.roles.add(discordRole);
      } catch (roleErr) {
        console.error('❌ Gagal menambahkan role ke member:', roleErr.message);
        return message.reply({ embeds: [embeds.errorEmbed('Hak Akses Bot Tidak Cukup!', 'Bot gagal menyematkan role ke akun Anda. Pastikan posisi role bot berada di atas role yang ingin dibeli di pengaturan integrasi server Discord!')] });
      }

      // Kurangi koin & stok di database
      let finalWallet;
      try {
        database.transaction(() => {
          economy.subtractBalance(author.id, guildId, item.price, 'SHOP_BUY', null);
          if (item.stock !== -1) {
            database.run('UPDATE shop_items SET stock = stock - 1 WHERE id = ? AND guild_id = ?', [item.id, guildId]);
          }
        })();
        finalWallet = economy.getWallet(author.id, guildId);
      } catch (dbErr) {
        // Rollback role jika database gagal
        await memberObj.roles.remove(discordRole).catch(() => {});
        throw dbErr;
      }

      const successEmbed = embeds.rolePurchaseSuccessEmbed(author, item.role_name, item.price, finalWallet.balance, item.tier);
      await message.reply({ embeds: [successEmbed] });

      // Broadcast Heboh jika tingkat EPIC / LEGENDARY
      if (item.tier === 'EPIC' || item.tier === 'LEGENDARY') {
        const broadcastEmbed = embeds.broadcastMegaEmbed(author, item.role_name, item.price, item.tier);
        const reportChannel = guild.channels.cache.get(config.REPORT_CHANNEL_ID);
        if (reportChannel) {
          await reportChannel.send({ embeds: [broadcastEmbed] }).catch(() => {});
        } else {
          await message.channel.send({ embeds: [broadcastEmbed] }).catch(() => {});
        }

        // Picu suara TTS jika bot tersambung di voice channel
        client.emit('playTtsEvent', {
          guildId,
          text: `Perhatian semuanya! Sultan ${author.username} baru saja membeli role ${item.tier} ${item.role_name}! Mari berikan penghormatan tinggi!`,
          lang: 'id'
        });
      }
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah: .gacha-role
    // ═══════════════════════════════════════════════════
    if (commandName === 'gacha-role') {
      const gachaCost = 1000;
      const wallet = economy.getWallet(author.id, guildId);

      if (wallet.balance < gachaCost) {
        return message.reply({ embeds: [embeds.warnEmbed('Saldo Koin Tidak Cukup!', `Biaya putar gacha adalah **Rp ${gachaCost.toLocaleString('id-ID')}**, sedangkan saldo Anda saat ini hanya **Rp ${wallet.balance.toLocaleString('id-ID')}**.`)] });
      }

      const gachaItems = database.all('SELECT * FROM shop_items WHERE guild_id = ? AND is_gacha = 1', [guildId]);
      if (gachaItems.length === 0) {
        return message.reply({ embeds: [embeds.warnEmbed('Gacha Tidak Tersedia!', 'Belum ada role gacha yang dikonfigurasi di server ini. Silakan admin menambahkan role gacha terlebih dahulu!')] });
      }

      // Animasi rolling menegangkan
      const rollingMsg = await message.reply('🎰 **[ GACHA START ]** Memulai putaran mesin gacha... ⏳');

      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      await delay(1500);
      await rollingMsg.edit('🎰 **[ 🎰 ROLLING... ]** Menghitung probabilitas keberuntungan... 🎲');
      await delay(1500);

      // Probabilitas Gacha
      // 40% ZONK, 60% MENANG
      const roll = Math.random() * 100;
      if (roll < 40) {
        // ZONK! Kurangi koin
        let finalWallet;
        database.transaction(() => {
          economy.subtractBalance(author.id, guildId, gachaCost, 'GACHA_SPEND', null);
        })();
        finalWallet = economy.getWallet(author.id, guildId);

        const zonkEmbed = embeds.gachaResultEmbed(author, null, gachaCost, finalWallet.balance, false);
        await rollingMsg.edit({ content: '🎰 **[ GACHA SELESAI! ]**', embeds: [zonkEmbed] });
        return true;
      }

      // MENANG! Kelompokkan berdasarkan Tier kelayakan
      const legendary = gachaItems.filter(i => i.tier === 'LEGENDARY' && (i.stock === -1 || i.stock > 0));
      const epic = gachaItems.filter(i => i.tier === 'EPIC' && (i.stock === -1 || i.stock > 0));
      const rare = gachaItems.filter(i => i.tier === 'RARE' && (i.stock === -1 || i.stock > 0));
      const common = gachaItems.filter(i => i.tier === 'COMMON' && (i.stock === -1 || i.stock > 0));

      const tierRoll = Math.random() * 100;
      let selectedItem = null;

      if (tierRoll < 3 && legendary.length > 0) {
        selectedItem = legendary[Math.floor(Math.random() * legendary.length)];
      } else if (tierRoll < 15 && epic.length > 0) {
        selectedItem = epic[Math.floor(Math.random() * epic.length)];
      } else if (tierRoll < 40 && rare.length > 0) {
        selectedItem = rare[Math.floor(Math.random() * rare.length)];
      } else if (common.length > 0) {
        selectedItem = common[Math.floor(Math.random() * common.length)];
      } else {
        // Fallback jika tier pilihan kosong, ambil acak yang tersedia
        const available = gachaItems.filter(i => i.stock === -1 || i.stock > 0);
        if (available.length > 0) {
          selectedItem = available[Math.floor(Math.random() * available.length)];
        }
      }

      if (!selectedItem) {
        // Jika tidak ada item yang stoknya memadai
        await rollingMsg.edit('❌ Gagal memutar gacha karena seluruh stok role gacha habis terjual!');
        return true;
      }

      const discordRole = guild.roles.cache.get(selectedItem.role_id) || await guild.roles.fetch(selectedItem.role_id).catch(() => null);
      if (!discordRole) {
        await rollingMsg.edit('❌ Role hadiah gacha sudah tidak ditemukan lagi di Discord server ini. Hubungi admin!');
        return true;
      }

      const memberObj = message.member || await guild.members.fetch(author.id).catch(() => null);
      if (!memberObj) {
        await rollingMsg.edit('❌ Gagal mengambil data profil anggota Discord Anda.');
        return true;
      }

      // Cek jika user sudah punya role tersebut -> beri cashback koin Rp 500
      const alreadyHas = memberObj.roles.cache.has(selectedItem.role_id);
      let finalWallet;

      if (alreadyHas) {
        database.transaction(() => {
          // Hanya kurangi koin bersih (gachaCost - cashback)
          const netCost = gachaCost - 500;
          economy.subtractBalance(author.id, guildId, netCost, 'GACHA_SPEND_CASHBACK', null);
        })();
        finalWallet = economy.getWallet(author.id, guildId);

        const winEmbed = embeds.gachaResultEmbed(author, selectedItem, gachaCost, finalWallet.balance, true);
        winEmbed.setDescription(
          `**${author.username}** baru saja melakukan roll Gacha seharga **Rp ${gachaCost.toLocaleString('id-ID')}**!\n\n` +
          `🎰 **HASIL ROLL:**\n` +
          `🌟 **${selectedItem.role_name}** (\`${selectedItem.tier}\`)\n\n` +
          `💸 **DUPLIKAT CASHBACK!** Karena Anda sudah memiliki role ini, Anda mendapatkan **cashback Rp 500**! Saldo Anda dikembalikan sebagian.\n` +
          `📉 Sisa saldo Anda: **Rp ${finalWallet.balance.toLocaleString('id-ID')}**`
        );

        await rollingMsg.edit({ content: '🎰 **[ GACHA SELESAI! ]**', embeds: [winEmbed] });
      } else {
        // Berikan role ke user
        try {
          await memberObj.roles.add(discordRole);
        } catch (roleErr) {
          console.error('❌ Gagal menambahkan role gacha:', roleErr.message);
          await rollingMsg.edit('❌ Gagal menyematkan role gacha. Pastikan posisi integrasi role bot berada di atas role hadiah!');
          return true;
        }

        // Kurangi saldo & stok
        try {
          database.transaction(() => {
            economy.subtractBalance(author.id, guildId, gachaCost, 'GACHA_WIN', null);
            if (selectedItem.stock !== -1) {
              database.run('UPDATE shop_items SET stock = stock - 1 WHERE id = ? AND guild_id = ?', [selectedItem.id, guildId]);
            }
          })();
          finalWallet = economy.getWallet(author.id, guildId);
        } catch (dbErr) {
          await memberObj.roles.remove(discordRole).catch(() => {});
          throw dbErr;
        }

        const winEmbed = embeds.gachaResultEmbed(author, selectedItem, gachaCost, finalWallet.balance, true);
        await rollingMsg.edit({ content: '🎰 **[ GACHA SELESAI! ]**', embeds: [winEmbed] });

        // Broadcast Heboh jika Legendary / Epic
        if (selectedItem.tier === 'EPIC' || selectedItem.tier === 'LEGENDARY') {
          const broadcastEmbed = embeds.broadcastMegaEmbed(author, selectedItem.role_name, gachaCost, selectedItem.tier);
          broadcastEmbed.setTitle(`🎰 SULTAN HOKI: DAHSYAT JACKPOT GACHA! 🎰`);
          broadcastEmbed.setDescription(
            `👑 **DEWA HOKI TELAH TURUN KE SERVER!**\n\n` +
            `<@${author.id}> baru saja melakukan spin gacha seharga **Rp ${gachaCost.toLocaleString('id-ID')}** dan mendapatkan jackpot role luar biasa:\n\n` +
            `🌟 **${selectedItem.role_name}** (\`${selectedItem.tier} CLASS\`)\n\n` +
            `*Semua bersorak merayakan keberuntungan spektakuler sultan gacha kita!* 🎰🚀`
          );

          const reportChannel = guild.channels.cache.get(config.REPORT_CHANNEL_ID);
          if (reportChannel) {
            await reportChannel.send({ embeds: [broadcastEmbed] }).catch(() => {});
          } else {
            await message.channel.send({ embeds: [broadcastEmbed] }).catch(() => {});
          }

          client.emit('playTtsEvent', {
            guildId,
            text: `Wah gila sih! Sultan ${author.username} baru saja hoki besar mendapatkan jackpot role gacha ${selectedItem.role_name}! Luar biasa keberuntungannya!`,
            lang: 'id'
          });
        }
      }
      return true;
    }

    // ═══════════════════════════════════════════════════
    // PROTEKSI ADMIN: Hanya bisa digunakan oleh ID 436554535037698059 atau Administrator Guild
    // ═══════════════════════════════════════════════════
    const adminCommands = ['eco-give', 'eco-take', 'market-add', 'market-remove', 'eco-reset', 'eco-resetall', 'market-reinit', 'shop-add', 'shop-remove', 'shop-setstock', 'eco-announce'];
    if (adminCommands.includes(commandName)) {
      const isOwner = author.id === '436554535037698059';
      const isAdmin = message.member && message.member.permissions.has('Administrator');
      if (!isOwner && !isAdmin) {
        return message.reply({ embeds: [embeds.accessDeniedEmbed('436554535037698059')] });
      }
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: .eco-give @user <jumlah>
    // ═══════════════════════════════════════════════════
    if (commandName === 'eco-give') {
      const targetUser = message.mentions.users.first();
      const amount = parseInt(args[1] || args[0]);

      if (!targetUser || isNaN(amount) || amount <= 0) {
        return message.reply({ embeds: [embeds.warnEmbed('Format Salah!', 'Contoh: `.eco-give @user 5000`')] });
      }

      economy.addBalance(targetUser.id, guildId, amount, 'ADMIN_GIVE');
      const embed = embeds.successEmbed(
        'Koin Berhasil Diberikan!',
        `Berhasil memberikan **Rp ${amount.toLocaleString('id-ID')}** koin kepada <@${targetUser.id}>!`
      );
      await message.reply({ embeds: [embed] });
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: .eco-take @user <jumlah>
    // ═══════════════════════════════════════════════════
    if (commandName === 'eco-take') {
      const targetUser = message.mentions.users.first();
      const amount = parseInt(args[1] || args[0]);

      if (!targetUser || isNaN(amount) || amount <= 0) {
        return message.reply({ embeds: [embeds.warnEmbed('Format Salah!', 'Contoh: `.eco-take @user 5000`')] });
      }

      try {
        economy.subtractBalance(targetUser.id, guildId, amount, 'ADMIN_TAKE');
        const embed = embeds.successEmbed(
          'Koin Berhasil Ditarik!',
          `Berhasil menarik **Rp ${amount.toLocaleString('id-ID')}** koin dari <@${targetUser.id}>!`
        );
        await message.reply({ embeds: [embed] });
      } catch (err) {
        const errorMsg = err.message.replace(/^❌\s*/, '');
        await message.reply({ embeds: [embeds.errorEmbed('Gagal Menarik Koin!', errorMsg)] });
      }
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: .eco-announce [#channel]
    // ═══════════════════════════════════════════════════
    if (commandName === 'eco-announce') {
      const fs = require('fs');
      const path = require('path');
      const targetChannel = message.mentions.channels.first() || message.channel;

      if (!targetChannel.isTextBased()) {
        return message.reply('❌ Channel target harus berupa text channel!');
      }

      const filePath = path.join(__dirname, '../announcement_update.txt');
      if (!fs.existsSync(filePath)) {
        return message.reply('❌ File pengumuman `announcement_update.txt` tidak ditemukan di root bot!');
      }

      const content = fs.readFileSync(filePath, 'utf8');

      const botPermissions = targetChannel.permissionsFor(message.guild.members.me);
      if (!botPermissions.has('SendMessages')) {
        return message.reply(`❌ Bot tidak memiliki izin \`Send Messages\` di channel ${targetChannel}!`);
      }

      await targetChannel.send(content);

      if (targetChannel.id !== message.channel.id) {
        await message.reply(`✅ **Berhasil!** Pengumuman pembaruan ekonomi telah diposting di channel ${targetChannel}.`);
      }
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: .market-add #channel <ticker>
    // ═══════════════════════════════════════════════════
    if (commandName === 'market-add') {
      const channel = message.mentions.channels.first();
      let ticker = args[1];

      if (!channel || !ticker) {
        return message.reply({ embeds: [embeds.warnEmbed('Format Salah!', 'Contoh: `.market-add #game-channel $GAME`')] });
      }

      ticker = ticker.toUpperCase();
      if (!ticker.startsWith('$')) ticker = '$' + ticker;

      // Cek apakah channel/ticker sudah ada
      const existChan = database.get('SELECT 1 FROM stocks WHERE guild_id = ? AND channel_id = ?', [guildId, channel.id]);
      const existTicker = database.get('SELECT 1 FROM stocks WHERE guild_id = ? AND stock_ticker = ?', [guildId, ticker]);

      if (existChan) return message.reply({ embeds: [embeds.warnEmbed('Channel Sudah Terdaftar!', 'Channel ini sudah terdaftar sebagai instrumen saham!')] });
      if (existTicker) return message.reply({ embeds: [embeds.warnEmbed('Ticker Sudah Digunakan!', 'Ticker ini sudah digunakan oleh saham lain!')] });

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
      const ticker = args[0];
      if (!ticker) return message.reply({ embeds: [embeds.warnEmbed('Format Salah!', 'Contoh: `.market-remove $GAME`')] });

      const stock = stocks.getStock(guildId, ticker);
      if (!stock) return message.reply({ embeds: [embeds.warnEmbed('Saham Tidak Ditemukan!', `Ticker \`${ticker}\` tidak ditemukan di bursa.`)] });

      database.transaction(() => {
        // Hapus dari bursa
        database.run('DELETE FROM stocks WHERE channel_id = ? AND guild_id = ?', [stock.channel_id, guildId]);
        // Hapus seluruh portofolio terkait
        database.run('DELETE FROM portfolios WHERE channel_id = ? AND guild_id = ?', [stock.channel_id, guildId]);
      })();

      await message.reply(`✅ Sukses menghapus instrumen saham **${ticker}** dari bursa.`);
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: .market-reinit
    // ═══════════════════════════════════════════════════
    if (commandName === 'market-reinit') {
      database.transaction(() => {
        // Hapus seluruh saham dan history/portfolio terkait di server ini
        database.run('DELETE FROM stocks WHERE guild_id = ?', [guildId]);
        database.run('DELETE FROM price_history WHERE guild_id = ?', [guildId]);
        database.run('DELETE FROM portfolios WHERE guild_id = ?', [guildId]);
      })();

      // Jalankan ulang registrasi default stocks kustom
      stocks.initDefaultStocks(guild);

      await message.reply('✅ **Sukses Re-inisialisasi Saham!** Seluruh saham lama telah dihapus dan bursa saham baru telah berhasil dikonfigurasi dengan channel & ticker default kustom Anda.');
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: .eco-reset @user
    // ═══════════════════════════════════════════════════
    if (commandName === 'eco-reset') {
      const targetUser = message.mentions.users.first();
      if (!targetUser) {
        return message.reply({ embeds: [embeds.warnEmbed('Format Salah!', 'Harap sebutkan user yang ingin direset.\nContoh: `.eco-reset @John`')] });
      }

      database.transaction(() => {
        // Hapus wallet user tersebut di guild ini
        database.run('DELETE FROM wallets WHERE user_id = ? AND guild_id = ?', [targetUser.id, guildId]);
        // Hapus portfolio saham user tersebut di guild ini
        database.run('DELETE FROM portfolios WHERE user_id = ? AND guild_id = ?', [targetUser.id, guildId]);
        // Hapus riwayat transaksi user tersebut di guild ini
        database.run('DELETE FROM transactions WHERE user_id = ? AND guild_id = ?', [targetUser.id, guildId]);
      })();

      await message.reply(`⚠️ **Data Keuangan <@${targetUser.id}> Berhasil Direset!** Saldo kembali ke 0, streak harian direset, dan seluruh kepemilikan saham telah dihapus dari server ini.`);
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: .eco-resetall
    // ═══════════════════════════════════════════════════
    if (commandName === 'eco-resetall') {
      database.transaction(() => {
        // Hapus wallets di guild ini
        database.run('DELETE FROM wallets WHERE guild_id = ?', [guildId]);
        // Hapus portfolios di guild ini
        database.run('DELETE FROM portfolios WHERE guild_id = ?', [guildId]);
        // Hapus transactions di guild ini
        database.run('DELETE FROM transactions WHERE guild_id = ?', [guildId]);
        // Hapus price history di guild ini
        database.run('DELETE FROM price_history WHERE guild_id = ?', [guildId]);
        
        // Reset harga saham & jumlah lembar saham di guild ini ke awal
        database.run(
          `UPDATE stocks 
           SET current_price = ?, previous_price = ?, available_shares = total_shares, activity_score = 0.0 
           WHERE guild_id = ?`,
          [config.market.INITIAL_PRICE, config.market.INITIAL_PRICE, guildId]
        );
      })();

      await message.reply('⚠️ **Seluruh sistem keuangan server ini telah berhasil DIRESET!** Saldo semua user, portofolio, riwayat transaksi telah dihapus, dan harga saham dikembalikan ke harga awal.');
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: .shop-add @role <harga> [tier] [stok] [is_gacha] [deskripsi]
    // ═══════════════════════════════════════════════════
    // Perintah Admin: .shop-add @role <harga> [deskripsi...]
    // ═══════════════════════════════════════════════════
    if (commandName === 'shop-add') {
      const role = message.mentions.roles.first() || guild.roles.cache.get(args[0]) || guild.roles.cache.find(r => r.name.toLowerCase() === args[0]?.toLowerCase());
      const price = parseInt(args[1]);

      if (!role) {
        return message.reply({ embeds: [embeds.warnEmbed('Format Salah!', 'Harap sebutkan role yang ingin dijual.\nFormat: `.shop-add @role <harga> [tier] [deskripsi...]`\nContoh: `.shop-add @VIP 10000 EPIC Member VIP Server`')] });
      }

      if (isNaN(price) || price <= 0) {
        return message.reply({ embeds: [embeds.warnEmbed('Harga Tidak Valid!', 'Tentukan harga role berupa angka di atas 0.\nContoh: `.shop-add @VIP 5000`')] });
      }

      // Menentukan tier secara manual jika diberikan, atau otomatis berdasarkan harga (gamified auto-tier)
      let tier = 'COMMON';
      let descStartIndex = 2;

      const inputTier = args[2]?.toUpperCase();
      if (inputTier && ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'].includes(inputTier)) {
        tier = inputTier;
        descStartIndex = 3;
      } else {
        // Otomatis berdasarkan harga jika tier manual tidak didefinisikan
        if (price > 50000) {
          tier = 'LEGENDARY';
        } else if (price > 15000) {
          tier = 'EPIC';
        } else if (price > 5000) {
          tier = 'RARE';
        }
      }

      const stock = -1; // Bawaan: tanpa batas
      const isGacha = 1; // Bawaan: dimasukkan ke pool gacha
      const description = args.slice(descStartIndex).join(' ') || null;

      // Cek apakah role sudah ada di toko
      const exist = database.get('SELECT 1 FROM shop_items WHERE guild_id = ? AND role_id = ?', [guildId, role.id]);
      if (exist) {
        return message.reply({ embeds: [embeds.warnEmbed('Role Sudah Ada!', `Role **${role.name}** sudah terdaftar di toko server ini. Gunakan \`.shop-remove\` terlebih dahulu jika ingin memperbarui.`)] });
      }

      database.run(
        `INSERT INTO shop_items (guild_id, role_id, role_name, price, tier, stock, is_gacha, description) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [guildId, role.id, role.name, price, tier, stock, isGacha, description]
      );

      const embed = embeds.successEmbed(
        'Role Ditambahkan ke Toko!',
        `Sukses mendaftarkan **${role.name}** ke toko role server Kosan 1A!\n\n` +
        `🎭 **Role:** <@&${role.id}>\n` +
        `💵 **Harga:** **Rp ${price.toLocaleString('id-ID')}**\n` +
        `🏷️ **Tier / Rarity:** \`${tier}\` ${descStartIndex === 3 ? '(Manual)' : '(Auto-Price)'}\n` +
        `📦 **Stok:** \`Tanpa Batas (Unlimited)\`\n` +
        `🎲 **Masuk Pool Gacha:** \`YA (Aktif)\`\n` +
        `📝 **Deskripsi:** *${description || 'Tidak ada'}*`
      );

      await message.reply({ embeds: [embed] });
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: .shop-remove <@role atau ID>
    // ═══════════════════════════════════════════════════
    if (commandName === 'shop-remove') {
      const input = args[0];
      if (!input) {
        return message.reply({ embeds: [embeds.warnEmbed('Format Salah!', 'Tentukan role atau ID item toko yang ingin dihapus.\nContoh: `.shop-remove @role` atau `.shop-remove <ID>`')] });
      }

      let item = null;
      const id = parseInt(input);

      if (!isNaN(id)) {
        item = database.get('SELECT * FROM shop_items WHERE id = ? AND guild_id = ?', [id, guildId]);
      } else {
        const role = message.mentions.roles.first() || guild.roles.cache.get(input) || guild.roles.cache.find(r => r.name.toLowerCase() === input.toLowerCase());
        if (role) {
          item = database.get('SELECT * FROM shop_items WHERE role_id = ? AND guild_id = ?', [role.id, guildId]);
        }
      }

      if (!item) {
        return message.reply({ embeds: [embeds.warnEmbed('Item Tidak Ditemukan!', `Role atau ID tersebut tidak terdaftar di toko.`)] });
      }

      database.run('DELETE FROM shop_items WHERE id = ? AND guild_id = ?', [item.id, guildId]);

      await message.reply(`✅ Sukses menghapus role **${item.role_name}** dari daftar toko role server.`);
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: .shop-setstock <@role atau ID> <stok>
    // ═══════════════════════════════════════════════════
    if (commandName === 'shop-setstock') {
      const input = args[0];
      const stockInput = args[1];
      const stock = parseInt(stockInput);

      if (!input || isNaN(stock)) {
        return message.reply({ embeds: [embeds.warnEmbed('Format Salah!', 'Format: `.shop-setstock <@role atau ID> <stok>`\nContoh: `.shop-setstock @VIP 10` (-1 untuk unlimited)')] });
      }

      let item = null;
      const id = parseInt(input);

      if (!isNaN(id)) {
        item = database.get('SELECT * FROM shop_items WHERE id = ? AND guild_id = ?', [id, guildId]);
      } else {
        const role = message.mentions.roles.first() || guild.roles.cache.get(input) || guild.roles.cache.find(r => r.name.toLowerCase() === input.toLowerCase());
        if (role) {
          item = database.get('SELECT * FROM shop_items WHERE role_id = ? AND guild_id = ?', [role.id, guildId]);
        }
      }

      if (!item) {
        return message.reply({ embeds: [embeds.warnEmbed('Item Tidak Ditemukan!', `Role atau ID tersebut tidak ditemukan di toko.`)] });
      }

      database.run('UPDATE shop_items SET stock = ? WHERE id = ? AND guild_id = ?', [stock, item.id, guildId]);

      await message.reply(`✅ Sukses memperbarui stok role **${item.role_name}** menjadi \`${stock === -1 ? 'Tanpa Batas (Unlimited)' : stock + ' slot'}\`.`);
      return true;
    }

  } catch (error) {
    console.error(`❌ [Command Error - .${commandName}]:`, error.message);
    const cleanedMessage = error.message.replace(/^❌\s*/, '');
    
    // Identifikasi apakah error karena bursa tutup atau lainnya
    const isMarketClosed = error.message.includes('TUTUP') || error.message.includes('operasional');
    const title = isMarketClosed ? 'Bursa Saham Sedang Tutup!' : 'Gagal Memproses Perintah!';
    
    const embed = isMarketClosed 
      ? embeds.warnEmbed(title, cleanedMessage).setFooter({ text: 'Silakan bertransaksi kembali pada jam operasional (08:00 - 23:00 WIB).' })
      : embeds.errorEmbed(title, cleanedMessage);
      
    await message.reply({ embeds: [embed] }).catch(() => {});
    return true;
  }

  return false;
}

module.exports = {
  initStockMarket,
  handleEconomyChat,
  handleEconomyCommands
};
