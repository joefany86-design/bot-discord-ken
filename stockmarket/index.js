const config = require('./config');
const database = require('./database');
const economy = require('./economy');
const stocks = require('./stocks');
const antiSpam = require('./antiSpam');
const embeds = require('./embeds');
const scheduler = require('./scheduler');
const bank = require('./bank');
const pet = require('./pet');
const robbery = require('./robbery');
const bm = require('./blackmarket');
const garden = require('./garden');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle, ModalBuilder, PermissionsBitField, UserSelectMenuBuilder } = require('discord.js');
// Owner ID dari environment variable (fallback ke default)
const OWNER_ID = process.env.OWNER_ID || '436554535037698059';
// ID Channel Portal Shop (#🛍️┃shop) — panel hanya privat di channel ini
const SHOP_CHANNEL_ID = '1510121069783023646';


/**
 * Meluncurkan panel perdagangan interaktif mandiri untuk saham tertentu.
 */
async function sendInteractiveTradePanel(messageOrInteraction, ticker, author, guildId, client) {
  const stock = stocks.getStock(guildId, ticker);
  if (!stock) {
    const errorMsg = '❌ Saham tidak ditemukan!';
    if (messageOrInteraction.replied || messageOrInteraction.deferred) {
      return messageOrInteraction.followUp({ content: errorMsg, flags: 64 });
    }
    return messageOrInteraction.reply({ content: errorMsg, flags: 64 });
  }

  const isInteraction = !!messageOrInteraction.isButton || !!messageOrInteraction.isStringSelectMenu || !!messageOrInteraction.isCommand;

  let tradeMsg;
  let selectedTicker = ticker;

  const getEmbedAndComponents = (currentTicker) => {
    const activeStock = stocks.getStock(guildId, currentTicker);
    if (!activeStock) return null;

    const wallet = economy.getWallet(author.id, guildId);
    const portfolio = database.get(
      'SELECT shares, avg_buy_price, total_invested FROM portfolios WHERE user_id = ? AND guild_id = ? AND channel_id = ?',
      [author.id, guildId, activeStock.channel_id]
    );
    const userShares = portfolio ? portfolio.shares : 0;
    const avgBuyPrice = portfolio ? portfolio.avg_buy_price : 0;
    const totalInvested = portfolio ? portfolio.total_invested : 0;

    const currentValue = userShares * activeStock.current_price;
    const profitRp = currentValue - totalInvested;
    const profitPercent = totalInvested > 0 ? ((profitRp / totalInvested) * 100).toFixed(1) : '0.0';
    const profitIndicator = profitRp >= 0 ? '🟢' : '🔴';
    const profitSign = profitRp >= 0 ? '+' : '';

    const activeStocks = stocks.getStocks(guildId);
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('eco_trade_select_stock')
      .setPlaceholder('👉 Pilih Saham untuk Diperdagangkan...');

    activeStocks.forEach(s => {
      selectMenu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(`${s.stock_ticker} - #${s.stock_name}`)
          .setDescription(`Harga: Rp ${s.current_price.toLocaleString('id-ID')} | Sisa Bursa: ${s.available_shares} lembar`)
          .setValue(s.stock_ticker)
          .setDefault(s.stock_ticker === currentTicker)
      );
    });

    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

    const detailEmbed = new EmbedBuilder()
      .setColor(profitRp >= 0 ? embeds.COLORS.SUCCESS : embeds.COLORS.ERROR)
      .setTitle(`📊 Transaksi Saham: ${activeStock.stock_ticker} — #${activeStock.stock_name}`)
      .setDescription(
        `🏛️ **Harga Saham:** **Rp ${activeStock.current_price.toLocaleString('id-ID')}** per lembar\n` +
        `📉 **Sisa Bursa:** \`${activeStock.available_shares} / ${activeStock.total_shares} lembar\`\n` +
        `💵 **Saldo Anda:** **Rp ${wallet.balance.toLocaleString('id-ID')}**\n\n` +
        `💼 **Kepemilikan Portofolio:**\n` +
        `👉 Jumlah Aset: \`${userShares} / 500 lembar\` ${userShares >= 500 ? '⚠️ (Maks)' : ''}\n` +
        `👉 Rata-rata Beli: \`Rp ${avgBuyPrice.toLocaleString('id-ID')}\`\n` +
        `👉 Nilai Valuasi: \`Rp ${currentValue.toLocaleString('id-ID')}\`\n` +
        `👉 P/L Real-time: ${profitIndicator} **${profitSign}Rp ${profitRp.toLocaleString('id-ID')}** (\`${profitSign}${profitPercent}%\`)`
      )
      .setFooter({ text: 'Pilih aksi Beli (Success) atau Jual (Danger) di bawah ini!' })
      .setTimestamp();

    // BUY row
    const buyRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('trade_buy_1').setLabel('📥 Beli 1').setStyle(ButtonStyle.Success).setDisabled(wallet.balance < activeStock.current_price || activeStock.available_shares < 1 || userShares >= 500),
      new ButtonBuilder().setCustomId('trade_buy_10').setLabel('📥 Beli 10').setStyle(ButtonStyle.Success).setDisabled(wallet.balance < activeStock.current_price * 10 || activeStock.available_shares < 10 || userShares + 10 > 500),
      new ButtonBuilder().setCustomId('trade_buy_50').setLabel('📥 Beli 50').setStyle(ButtonStyle.Success).setDisabled(wallet.balance < activeStock.current_price * 50 || activeStock.available_shares < 50 || userShares + 50 > 500),
      new ButtonBuilder().setCustomId('trade_buy_max').setLabel('📥 Beli Max').setStyle(ButtonStyle.Success).setDisabled(wallet.balance < activeStock.current_price || activeStock.available_shares < 1 || userShares >= 500),
      new ButtonBuilder().setCustomId('trade_buy_custom').setLabel('📥 Custom').setStyle(ButtonStyle.Success).setDisabled(wallet.balance < activeStock.current_price || activeStock.available_shares < 1 || userShares >= 500)
    );

    // SELL row
    const sellRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('trade_sell_1').setLabel('📤 Jual 1').setStyle(ButtonStyle.Danger).setDisabled(userShares < 1),
      new ButtonBuilder().setCustomId('trade_sell_10').setLabel('📤 Jual 10').setStyle(ButtonStyle.Danger).setDisabled(userShares < 10),
      new ButtonBuilder().setCustomId('trade_sell_50').setLabel('📤 Jual 50').setStyle(ButtonStyle.Danger).setDisabled(userShares < 50),
      new ButtonBuilder().setCustomId('trade_sell_all').setLabel('📤 Jual Semua').setStyle(ButtonStyle.Danger).setDisabled(userShares < 1),
      new ButtonBuilder().setCustomId('trade_sell_custom').setLabel('📤 Custom').setStyle(ButtonStyle.Danger).setDisabled(userShares < 1)
    );

    // Exit row
    const exitRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('trade_btn_exit').setLabel('✖️ Keluar Panel').setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [detailEmbed], components: [selectRow, buyRow, sellRow, exitRow] };
  };

  const initialData = getEmbedAndComponents(selectedTicker);
  if (!initialData) return;

  if (isInteraction) {
    await messageOrInteraction.reply({ ...initialData, ephemeral: messageOrInteraction.channelId === SHOP_CHANNEL_ID });
    tradeMsg = await messageOrInteraction.fetchReply();
  } else {
    tradeMsg = await messageOrInteraction.reply(initialData);
  }

  const tradeCollector = tradeMsg.createMessageComponentCollector({
    time: 120000 // 2 menit transaksi
  });

  tradeCollector.on('collect', async iTrade => {
    if (iTrade.user.id !== author.id) {
      return iTrade.reply({ content: '❌ Tombol ini bukan untuk Anda!', flags: 64 });
    }

    try {
      if (iTrade.customId === 'eco_trade_select_stock') {
        selectedTicker = iTrade.values[0];
        const updateData = getEmbedAndComponents(selectedTicker);
        await iTrade.update(updateData);
      } else if (iTrade.customId === 'trade_btn_exit') {
        tradeCollector.stop();
        await iTrade.update({ content: '👋 Selesai bertransaksi!', embeds: [], components: [] }).catch(() => { });
      } else if (iTrade.customId.startsWith('trade_buy_') || iTrade.customId.startsWith('trade_sell_')) {
        const action = iTrade.customId.startsWith('trade_buy_') ? 'BUY' : 'SELL';
        const amountType = iTrade.customId.split('_').pop();

        const stock = stocks.getStock(guildId, selectedTicker);
        if (!stock) {
          return iTrade.reply({ content: '❌ Saham tidak ditemukan!', ephemeral: iTrade.channelId === SHOP_CHANNEL_ID });
        }

        let shares = 0;
        const wallet = economy.getWallet(author.id, guildId);
        const portfolio = database.get(
          'SELECT shares FROM portfolios WHERE user_id = ? AND guild_id = ? AND channel_id = ?',
          [author.id, guildId, stock.channel_id]
        );
        const userShares = portfolio ? portfolio.shares : 0;

        if (action === 'BUY') {
          if (amountType === '1') shares = 1;
          else if (amountType === '10') shares = 10;
          else if (amountType === '50') shares = 50;
          else if (amountType === 'max') {
            const maxAfford = Math.floor(wallet.balance / stock.current_price);
            const maxHoldAllowed = (config.market.MAX_SHARES_HOLD_PER_USER || 500) - userShares;
            shares = Math.min(maxAfford, stock.available_shares, maxHoldAllowed);
            if (shares <= 0) {
              return iTrade.reply({ content: '❌ Anda tidak dapat membeli lembar saham lagi (saldo tidak cukup, stok bursa habis, atau sudah mencapai batas kepemilikan 500 lembar)!', ephemeral: iTrade.channelId === SHOP_CHANNEL_ID });
            }
          } else if (amountType === 'custom') {
            const modal = new ModalBuilder()
              .setCustomId('trade_buy_modal')
              .setTitle(`Beli Saham ${selectedTicker}`);

            const amountInput = new TextInputBuilder()
              .setCustomId('buy_amount')
              .setLabel('Jumlah Lembar Saham')
              .setPlaceholder('Masukkan angka (Contoh: 25)')
              .setStyle(TextInputStyle.Short)
              .setRequired(true);

            const rowModal = new ActionRowBuilder().addComponents(amountInput);
            modal.addComponents(rowModal);

            await iTrade.showModal(modal);

            const submitted = await iTrade.awaitModalSubmit({
              filter: (sub) => sub.customId === 'trade_buy_modal' && sub.user.id === author.id,
              time: 60000
            }).catch(() => null);

            if (submitted) {
              const inputVal = parseInt(submitted.fields.getTextInputValue('buy_amount'));
              if (isNaN(inputVal) || inputVal <= 0) {
                return submitted.reply({ content: '❌ Jumlah lembar harus berupa angka di atas 0!', ephemeral: submitted.channelId === SHOP_CHANNEL_ID });
              }

              try {
                const res = stocks.buyStock(author.id, guildId, selectedTicker, inputVal);
                const successEmb = embeds.transactionSuccessEmbed(author, true, res);
                await submitted.reply({ embeds: [successEmb], ephemeral: submitted.channelId === SHOP_CHANNEL_ID });

                if (inputVal >= 50) {
                  client.emit('playTtsEvent', {
                    guildId,
                    text: `Wow gila sih! Sultan ${author.username} baru saja memborong ${inputVal} lembar saham ${res.ticker} senilai total ${res.totalPrice} Rupiah! Hype banget bursa hari ini!`,
                    lang: 'id'
                  });
                }

                // Update the original trade panel message
                const freshData = getEmbedAndComponents(selectedTicker);
                await tradeMsg.edit(freshData).catch(console.error);
              } catch (err) {
                const cleaned = err.message.replace(/^❌\s*/, '');
                await submitted.reply({ content: `❌ Transaksi gagal: ${cleaned}`, ephemeral: submitted.channelId === SHOP_CHANNEL_ID });
              }
            }
            return;
          }
        } else {
          // SELL
          if (amountType === '1') shares = 1;
          else if (amountType === '10') shares = 10;
          else if (amountType === '50') shares = 50;
          else if (amountType === 'all') {
            shares = userShares;
            if (shares <= 0) {
              return iTrade.reply({ content: '❌ Anda tidak memiliki saham ini untuk dijual!', ephemeral: iTrade.channelId === SHOP_CHANNEL_ID });
            }
          } else if (amountType === 'custom') {
            const modal = new ModalBuilder()
              .setCustomId('trade_sell_modal')
              .setTitle(`Jual Saham ${selectedTicker}`);

            const amountInput = new TextInputBuilder()
              .setCustomId('sell_amount')
              .setLabel('Jumlah Lembar Saham')
              .setPlaceholder(`Masukkan angka (Maks: ${userShares})`)
              .setStyle(TextInputStyle.Short)
              .setRequired(true);

            const rowModal = new ActionRowBuilder().addComponents(amountInput);
            modal.addComponents(rowModal);

            await iTrade.showModal(modal);

            const submitted = await iTrade.awaitModalSubmit({
              filter: (sub) => sub.customId === 'trade_sell_modal' && sub.user.id === author.id,
              time: 60000
            }).catch(() => null);

            if (submitted) {
              const inputVal = parseInt(submitted.fields.getTextInputValue('sell_amount'));
              if (isNaN(inputVal) || inputVal <= 0) {
                return submitted.reply({ content: '❌ Jumlah lembar harus berupa angka di atas 0!', ephemeral: submitted.channelId === SHOP_CHANNEL_ID });
              }

              try {
                const res = stocks.sellStock(author.id, guildId, selectedTicker, inputVal);
                const successEmb = embeds.transactionSuccessEmbed(author, false, res);
                await submitted.reply({ embeds: [successEmb], ephemeral: submitted.channelId === SHOP_CHANNEL_ID });

                if (inputVal >= 50) {
                  client.emit('playTtsEvent', {
                    guildId,
                    text: `Perhatian warga server! Sultan ${author.username} baru saja menjual ${inputVal} lembar saham ${res.ticker} senilai total ${res.finalRevenue} Rupiah! Pergerakan modal yang sangat besar!`,
                    lang: 'id'
                  });
                }

                // Update original trade panel message
                const freshData = getEmbedAndComponents(selectedTicker);
                await tradeMsg.edit(freshData).catch(console.error);
              } catch (err) {
                const cleaned = err.message.replace(/^❌\s*/, '');
                await submitted.reply({ content: `❌ Transaksi gagal: ${cleaned}`, ephemeral: submitted.channelId === SHOP_CHANNEL_ID });
              }
            }
            return;
          }
        }

        // Non-custom button trade
        if (shares > 0) {
          try {
            if (action === 'BUY') {
              const res = stocks.buyStock(author.id, guildId, selectedTicker, shares);
              const successEmb = embeds.transactionSuccessEmbed(author, true, res);
              await iTrade.reply({ embeds: [successEmb], ephemeral: iTrade.channelId === SHOP_CHANNEL_ID });

              if (shares >= 50) {
                client.emit('playTtsEvent', {
                  guildId,
                  text: `Wow gila sih! Sultan ${author.username} baru saja memborong ${shares} lembar saham ${res.ticker} senilai total ${res.totalPrice} Rupiah! Hype banget bursa hari ini!`,
                  lang: 'id'
                });
              }
            } else {
              const res = stocks.sellStock(author.id, guildId, selectedTicker, shares);
              const successEmb = embeds.transactionSuccessEmbed(author, false, res);
              await iTrade.reply({ embeds: [successEmb], ephemeral: iTrade.channelId === SHOP_CHANNEL_ID });

              if (shares >= 50) {
                client.emit('playTtsEvent', {
                  guildId,
                  text: `Perhatian warga server! Sultan ${author.username} baru saja menjual ${shares} lembar saham ${res.ticker} senilai total ${res.finalRevenue} Rupiah! Pergerakan modal yang sangat besar!`,
                  lang: 'id'
                });
              }
            }
            const freshData = getEmbedAndComponents(selectedTicker);
            await iTrade.message.edit(freshData).catch(err => {
              if (err.code !== 10008) console.error('Error edit trade message:', err.message);
            });
          } catch (err) {
            const cleaned = err.message.replace(/^❌\s*/, '');
            await iTrade.reply({ content: `❌ Transaksi gagal: ${cleaned}`, ephemeral: iTrade.channelId === SHOP_CHANNEL_ID });
          }
        }
      }
    } catch (err) {
      console.error('Error in interactive trade panel:', err);
    }
  });

  tradeCollector.on('end', async () => {
    const disabledData = getEmbedAndComponents(selectedTicker);
    if (disabledData) {
      disabledData.components = disabledData.components.map(row => {
        const freshRow = new ActionRowBuilder();
        row.components.forEach(comp => {
          if (comp.data.type === 3) {
            const freshSelect = StringSelectMenuBuilder.from(comp).setDisabled(true);
            freshRow.addComponents(freshSelect);
          } else {
            const freshBtn = ButtonBuilder.from(comp).setDisabled(true);
            freshRow.addComponents(freshBtn);
          }
        });
        return freshRow;
      });
      await tradeMsg.edit(disabledData).catch(() => { });
    }
  });
}

/**
 * Mengirim embed grafik (2D chart atau detail saham) disertai tombol aksi interaktif (Beli, Jual, Segarkan).
 */
async function sendStockChartOrDetail(message, ticker, isChartCommand = true, client) {
  const guildId = message.guild.id;
  const author = message.author;

  if (!ticker) {
    return message.reply({ embeds: [embeds.warnEmbed('Ticker Harus Diisi!', `Contoh: \`.stock $GAME\` atau \`.chart $GENERAL\``)] });
  }

  const stock = stocks.getStock(guildId, ticker);
  if (!stock) {
    return message.reply({ embeds: [embeds.warnEmbed('Saham Tidak Ditemukan!', `Ticker \`${ticker}\` tidak ada di server ini.`)] });
  }

  const fetchEmbedAndButtons = (currentStock) => {
    // Ambil 10 histori harga terakhir
    const history = database.all(
      'SELECT * FROM price_history WHERE channel_id = ? AND guild_id = ? ORDER BY recorded_at DESC LIMIT 10',
      [currentStock.channel_id, guildId]
    );
    history.reverse();

    const embed = isChartCommand
      ? embeds.stockChartEmbed(currentStock, history, client)
      : embeds.stockDetailEmbed(currentStock, history);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`eco_btn_chart_buy_${currentStock.stock_ticker}`)
        .setLabel('📥 Beli Saham')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`eco_btn_chart_sell_${currentStock.stock_ticker}`)
        .setLabel('📤 Jual Saham')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`eco_btn_chart_refresh_${currentStock.stock_ticker}`)
        .setLabel('🔄 Segarkan')
        .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row] };
  };

  const initialData = fetchEmbedAndButtons(stock);
  const replyMsg = await message.reply(initialData);

  const collector = replyMsg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120000 // 2 menit navigasi
  });

  collector.on('collect', async i => {
    if (i.user.id !== author.id) {
      return i.reply({ content: '❌ Tombol ini hanya bisa digunakan oleh orang yang memanggil perintah ini!', flags: 64 });
    }

    try {
      if (i.customId.startsWith('eco_btn_chart_buy_')) {
        collector.stop();
        // Sembunyikan tombol di chart asli agar rapi sebelum masuk panel trading
        const disabledData = fetchEmbedAndButtons(stock);
        disabledData.components = [];
        await replyMsg.edit(disabledData).catch(() => { });

        await sendInteractiveTradePanel(i, stock.stock_ticker, author, guildId, client);
      } else if (i.customId.startsWith('eco_btn_chart_sell_')) {
        collector.stop();
        // Sembunyikan tombol di chart asli agar rapi sebelum masuk panel trading
        const disabledData = fetchEmbedAndButtons(stock);
        disabledData.components = [];
        await replyMsg.edit(disabledData).catch(() => { });

        await sendInteractiveTradePanel(i, stock.stock_ticker, author, guildId, client);
      } else if (i.customId.startsWith('eco_btn_chart_refresh_')) {
        const freshStock = stocks.getStock(guildId, stock.stock_ticker);
        const freshData = fetchEmbedAndButtons(freshStock);
        await i.update(freshData);
      }
    } catch (err) {
      console.error('Error in chart/stock collector:', err);
    }
  });

  collector.on('end', async () => {
    // Nonaktifkan tombol ketika waktu habis (jika collector tidak dihentikan paksa)
    if (collector.destroyed) return;
    const freshStock = stocks.getStock(guildId, stock.stock_ticker);
    const disabledData = fetchEmbedAndButtons(freshStock);
    disabledData.components = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`eco_btn_chart_buy_${stock.stock_ticker}`).setLabel('📥 Beli Saham').setStyle(ButtonStyle.Success).setDisabled(true),
        new ButtonBuilder().setCustomId(`eco_btn_chart_sell_${stock.stock_ticker}`).setLabel('📤 Jual Saham').setStyle(ButtonStyle.Danger).setDisabled(true),
        new ButtonBuilder().setCustomId(`eco_btn_chart_refresh_${stock.stock_ticker}`).setLabel('🔄 Segarkan').setStyle(ButtonStyle.Secondary).setDisabled(true)
      )
    ];
    await replyMsg.edit(disabledData).catch(() => { });
  });
}

/**
 * Memulai pengkinian Papan Peringkat Realtime (Rich Leaderboard & Pet Leaderboard)
 * secara berkala setiap 5 detik di channel masing-masing.
 */
let leaderboardInterval = null; // Guard: mencegah interval bertumpuk
function startRealtimeLeaderboard(client) {
  console.log('🏆 Memulai Papan Peringkat Realtime (5s)...');

  // Guard: bersihkan interval sebelumnya jika ada (mencegah duplikasi saat reconnect)
  if (leaderboardInterval) {
    clearInterval(leaderboardInterval);
    leaderboardInterval = null;
    console.log('⚠️ [Leaderboard] Interval sebelumnya dibersihkan (mencegah duplikasi).');
  }

  leaderboardInterval = setInterval(async () => {
    // ── 1. KANGLOMERAT LEADERBOARD (Channel: 1510230591860113418) ──
    try {
      const richChannel = await client.channels.fetch('1510230591860113418').catch(() => null);
      if (richChannel) {
        const guildId = richChannel.guild.id;
        const guildName = richChannel.guild.name;

        const richData = economy.getLeaderboard(guildId, 10);
        await Promise.all(richData.map(async u => {
          try { await client.users.fetch(u.userId); } catch (e) {}
        }));
        const richEmbed = embeds.leaderboardEmbed(guildName, richData, client);

        const messages = await richChannel.messages.fetch({ limit: 50 }).catch(() => null);
        let leaderboardMsg = messages ? messages.find(m => m.author.id === client.user.id) : null;
        const payload = { embeds: [richEmbed], components: [] };

        if (leaderboardMsg) {
          await leaderboardMsg.edit(payload).catch(() => {});
        } else {
          await richChannel.send(payload).catch(() => {});
        }
      }
    } catch (err) {
      console.error('❌ Error updating realtime rich leaderboard:', err);
    }

    // ── 2. TOP PET LEADERBOARD (Channel: 1510232295448117308) ──
    try {
      const petChannel = await client.channels.fetch('1510232295448117308').catch(() => null);
      if (petChannel) {
        const guildId = petChannel.guild.id;
        const guildName = petChannel.guild.name;

        const topPets = pet.getPetLeaderboard(guildId, 'level', 10);
        await Promise.all(topPets.map(async p => {
          try { await client.users.fetch(p.user_id); } catch (e) {}
        }));
        const petEmbed = embeds.petLeaderboardEmbed(guildName, topPets, 'level', client);

        const messages = await petChannel.messages.fetch({ limit: 50 }).catch(() => null);
        let leaderboardMsg = messages ? messages.find(m => m.author.id === client.user.id) : null;
        const payload = { embeds: [petEmbed], components: [] };

        if (leaderboardMsg) {
          await leaderboardMsg.edit(payload).catch(() => {});
        } else {
          await petChannel.send(payload).catch(() => {});
        }
      }
    } catch (err) {
      console.error('❌ Error updating realtime pet leaderboard:', err);
    }

    // ── 3. DAILY LEADERBOARD (Channel: 1510240252458176662) ──
    try {
      const dailyChannel = await client.channels.fetch('1510240252458176662').catch(() => null);
      if (dailyChannel) {
        const guildId = dailyChannel.guild.id;
        const guildName = dailyChannel.guild.name;

        const now = new Date();
        const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);
        const query = `
          SELECT user_id, balance, last_active_date, streak_days 
          FROM wallets 
          WHERE guild_id = ? AND (last_active_date IS NULL OR last_active_date != ?)
          ORDER BY balance DESC
          LIMIT 10
        `;
        const list = database.all(query, [guildId, todayStr]);

        await Promise.all(list.map(async u => {
          try { await client.users.fetch(u.user_id); } catch (e) {}
        }));
        const dailyEmbed = embeds.dailyLeaderboardEmbed(guildName, list, client);

        const messages = await dailyChannel.messages.fetch({ limit: 50 }).catch(() => null);
        let leaderboardMsg = messages ? messages.find(m => m.author.id === client.user.id) : null;
        const payload = { embeds: [dailyEmbed], components: [] };

        if (leaderboardMsg) {
          await leaderboardMsg.edit(payload).catch(() => {});
        } else {
          await dailyChannel.send(payload).catch(() => {});
        }
      }
    } catch (err) {
      console.error('❌ Error updating realtime daily leaderboard:', err);
    }
  }, 5000);
}

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

  // Jalankan realtime leaderboard untuk channel 1510230591860113418
  startRealtimeLeaderboard(client);

  // Listener untuk button click global (dashboard/panel permanen)
  client.on('interactionCreate', async interaction => {
    if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;
    const { customId, guildId, user } = interaction;
    if (!guildId) return;

    try {
      // ── PORTAL PERMANEN: TOKO ROLE ──
      if (customId === 'eco_btn_open_shop_private_perm') {
        await interaction.deferReply({ flags: 64 });
        const wallet = economy.getWallet(user.id, guildId);
        const items = database.all('SELECT * FROM shop_items WHERE guild_id = ?', [guildId]);
        const embed = embeds.shopEmbed(items, wallet);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('eco_btn_profile').setLabel('💰 Profil & Saldo').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('eco_btn_gacha').setLabel('🎲 Gacha Role').setStyle(ButtonStyle.Danger)
        );

        const privateMsg = await interaction.editReply({ embeds: [embed], components: [row] });
        const collector = privateMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 });

        collector.on('collect', async i => {
          if (i.user.id !== user.id) return i.reply({ content: '❌ Tombol ini bukan milik Anda!', flags: 64 });

          if (i.customId === 'eco_btn_profile') {
            await i.deferReply({ flags: 64 });
            const wallet2 = economy.getWallet(user.id, guildId);
            const porto = stocks.getPortfolio(user.id, guildId);
            const shopItems = database.all('SELECT * FROM shop_items WHERE guild_id = ?', [guildId]);
            const userPet = pet.getPet(user.id, guildId);
            const activeLoan = bank.getActiveLoan(user.id, guildId);
            const debts = database.all('SELECT creditor_id, amount FROM bail_debts WHERE debtor_id = ? AND guild_id = ?', [user.id, guildId]);
            const receivables = database.all('SELECT debtor_id, amount FROM bail_debts WHERE creditor_id = ? AND guild_id = ?', [user.id, guildId]);
            const profileEmbed = embeds.profileEmbed(user, wallet2, porto.totalPortfolioValue, i.member, shopItems, userPet, activeLoan, { debts, receivables }, porto.items);
            await i.editReply({ embeds: [profileEmbed] });
          } else if (i.customId === 'eco_btn_gacha') {
            await executeGachaRoll({
              replyTarget: i,
              user,
              guild: i.guild,
              guildId,
              client,
              isInteraction: true,
              member: i.member
            });
          }
        });

        collector.on('end', async () => {
          const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('eco_btn_profile').setLabel('💰 Profil & Saldo').setStyle(ButtonStyle.Success).setDisabled(true),
            new ButtonBuilder().setCustomId('eco_btn_gacha').setLabel('🎲 Gacha Role').setStyle(ButtonStyle.Danger).setDisabled(true)
          );
          await privateMsg.edit({ components: [disabledRow] }).catch(() => { });
        });
      }

      // ── PORTAL PERMANEN: BURSA SAHAM ──
      else if (customId === 'eco_btn_open_market_private_perm') {
        await interaction.deferReply({ flags: 64 });
        const activeStocks = stocks.getStocks(guildId);
        const isOpen = stocks.isMarketOpen();
        const embed = embeds.marketEmbed(activeStocks, isOpen);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('eco_btn_porto').setLabel('💼 Portofolio').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('eco_btn_profile').setLabel('💰 Profil & Saldo').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('eco_btn_shop').setLabel('🛍️ Toko Role').setStyle(ButtonStyle.Secondary)
        );
        if (activeStocks.length > 0 && isOpen) {
          row.addComponents(new ButtonBuilder().setCustomId('eco_btn_trade').setLabel('📈 Beli/Jual Saham').setStyle(ButtonStyle.Success));
        }

        const privateMsg = await interaction.editReply({ embeds: [embed], components: [row] });
        const collector = privateMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 });

        collector.on('collect', async i => {
          if (i.user.id !== user.id) return i.reply({ content: '❌ Tombol ini bukan milik Anda!', flags: 64 });

          if (i.customId === 'eco_btn_porto') {
            await i.deferReply({ flags: 64 });
            const wallet2 = economy.getWallet(user.id, guildId);
            const porto = stocks.getPortfolio(user.id, guildId);
            await i.editReply({ embeds: [embeds.portfolioEmbed(user, porto, wallet2)] });
          } else if (i.customId === 'eco_btn_profile') {
            await i.deferReply({ flags: 64 });
            const wallet2 = economy.getWallet(user.id, guildId);
            const porto = stocks.getPortfolio(user.id, guildId);
            const shopItems = database.all('SELECT * FROM shop_items WHERE guild_id = ?', [guildId]);
            const userPet = pet.getPet(user.id, guildId);
            const activeLoan = bank.getActiveLoan(user.id, guildId);
            const debts = database.all('SELECT creditor_id, amount FROM bail_debts WHERE debtor_id = ? AND guild_id = ?', [user.id, guildId]);
            const receivables = database.all('SELECT debtor_id, amount FROM bail_debts WHERE creditor_id = ? AND guild_id = ?', [user.id, guildId]);
            await i.editReply({ embeds: [embeds.profileEmbed(user, wallet2, porto.totalPortfolioValue, i.member, shopItems, userPet, activeLoan, { debts, receivables }, porto.items)] });
          } else if (i.customId === 'eco_btn_shop') {
            await i.deferReply({ flags: 64 });
            const wallet2 = economy.getWallet(user.id, guildId);
            const items = database.all('SELECT * FROM shop_items WHERE guild_id = ?', [guildId]);
            await i.editReply({ embeds: [embeds.shopEmbed(items, wallet2)] });
          } else if (i.customId === 'eco_btn_trade') {
            await sendInteractiveTradePanel(i, activeStocks[0].stock_ticker, user, guildId, client);
          }
        });

        collector.on('end', async () => {
          const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('eco_btn_porto').setLabel('💼 Portofolio').setStyle(ButtonStyle.Primary).setDisabled(true),
            new ButtonBuilder().setCustomId('eco_btn_profile').setLabel('💰 Profil & Saldo').setStyle(ButtonStyle.Success).setDisabled(true),
            new ButtonBuilder().setCustomId('eco_btn_shop').setLabel('🛍️ Toko Role').setStyle(ButtonStyle.Secondary).setDisabled(true)
          );
          if (activeStocks.length > 0 && isOpen) {
            disabledRow.addComponents(new ButtonBuilder().setCustomId('eco_btn_trade').setLabel('📈 Beli/Jual Saham').setStyle(ButtonStyle.Success).setDisabled(true));
          }
          await privateMsg.edit({ components: [disabledRow] }).catch(() => { });
        });
      }

      // ── PORTAL PERMANEN: BANK SENTRAL ──
      else if (customId === 'eco_btn_open_bank_private_perm') {
        await interaction.deferReply({ flags: 64 });
        const getBankDashboardDataPrivate = (targetUserId) => {
          const wallet = economy.getWallet(targetUserId, guildId);
          const savings = bank.getSavings(targetUserId, guildId);
          const activeLoan = bank.getActiveLoan(targetUserId, guildId);
          const maxLimit = bank.calculateMaxLoanLimit(targetUserId, guildId);

          const embed = embeds.bankDashboardEmbed(user, wallet, savings, activeLoan, maxLimit);

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bank_btn_deposit').setLabel('📥 Deposit').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('bank_btn_withdraw').setLabel('📤 Tarik').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('bank_btn_loan').setLabel('📜 Pinjam').setStyle(ButtonStyle.Success).setDisabled(!!activeLoan),
            new ButtonBuilder().setCustomId('bank_btn_repay').setLabel('💳 Bayar').setStyle(ButtonStyle.Danger).setDisabled(!activeLoan)
          );

          return { embeds: [embed], components: [row] };
        };

        const initialData = getBankDashboardDataPrivate(user.id);
        const privateMsg = await interaction.editReply({ ...initialData });
        const collector = privateMsg.createMessageComponentCollector({ time: 120000 });

        collector.on('collect', async iBank => {
          if (iBank.user.id !== user.id) return iBank.reply({ content: '❌ Tombol ini bukan milik Anda!', flags: 64 });

          try {
            if (iBank.customId === 'bank_btn_deposit') {
              const modal = new ModalBuilder()
                .setCustomId('bank_modal_deposit_perm')
                .setTitle('🏛️ Deposit Tabungan Bank');

              const amountInput = new TextInputBuilder()
                .setCustomId('deposit_amount')
                .setLabel('Jumlah koin (angka atau "all")')
                .setPlaceholder('Contoh: 5000')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

              modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
              await iBank.showModal(modal);

              const submitted = await iBank.awaitModalSubmit({
                filter: (sub) => sub.customId === 'bank_modal_deposit_perm' && sub.user.id === user.id,
                time: 60000
              }).catch(() => null);

              if (submitted) {
                try {
                  const res = bank.depositSavings(user.id, guildId, submitted.fields.getTextInputValue('deposit_amount'));
                  const roomTierName = res.roomTier === 'DEFAULT' ? 'Biasa / Tanpa Sewa' : 
                                       res.roomTier === 'KIPAS' ? '💨 Kamar Kipas Angin' :
                                       res.roomTier === 'AC' ? '❄️ Kamar AC' : '👑 Penthouse Kosan';
                  const taxSavedMsg = res.roomTier === 'DEFAULT' ? '💡 *Naikkan sewa kamar kosan untuk menikmati potongan pajak deposit bank harian!*' :
                                      res.roomTier === 'PENTHOUSE' ? '👑 *Keanggotaan Penthouse: Pajak deposit dibebaskan 100%!*' :
                                      `✨ *Diskon Kamar kosan aktif: Pajak hanya ${res.taxRate}%!*`;

                  const successEmb = embeds.bankSuccessEmbed(
                    'Deposit Tabungan Berhasil!',
                    `Koin disetor: **Rp ${res.amount.toLocaleString('id-ID')}**\n` +
                    `✂️ Pajak Administrasi (${res.taxRate}%): **-Rp ${res.tax.toLocaleString('id-ID')}** (Dibakar)\n` +
                    `📥 Bersih masuk Bank: **Rp ${res.netAmount.toLocaleString('id-ID')}**\n` +
                    `🏢 Kasta Sewa Kamar: **${roomTierName}**\n\n` +
                    `🏦 **Saldo Bank Baru:** **Rp ${res.savingsBalance.toLocaleString('id-ID')}**\n` +
                    `💵 **Sisa Dompet:** **Rp ${res.walletBalance.toLocaleString('id-ID')}**\n───────────────────\n` +
                    taxSavedMsg
                  );
                  await submitted.reply({ embeds: [successEmb], flags: 64 });
                  await privateMsg.edit(getBankDashboardDataPrivate(user.id)).catch(() => { });
                } catch (err) {
                  await submitted.reply({ embeds: [embeds.bankErrorEmbed('Deposit Gagal!', err.message)], flags: 64 });
                }
              }
            }

            else if (iBank.customId === 'bank_btn_withdraw') {
              const modal = new ModalBuilder()
                .setCustomId('bank_modal_withdraw_perm')
                .setTitle('🏛️ Penarikan Saldo Bank');

              const amountInput = new TextInputBuilder()
                .setCustomId('withdraw_amount')
                .setLabel('Jumlah koin (angka atau "all")')
                .setPlaceholder('Contoh: 10000')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

              modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
              await iBank.showModal(modal);

              const submitted = await iBank.awaitModalSubmit({
                filter: (sub) => sub.customId === 'bank_modal_withdraw_perm' && sub.user.id === user.id,
                time: 60000
              }).catch(() => null);

              if (submitted) {
                try {
                  const res = bank.withdrawSavings(user.id, guildId, submitted.fields.getTextInputValue('withdraw_amount'));
                  const roomTierName = res.roomTier === 'DEFAULT' ? 'Biasa / Tanpa Sewa' : 
                                       res.roomTier === 'KIPAS' ? '💨 Kamar Kipas Angin' :
                                       res.roomTier === 'AC' ? '❄️ Kamar AC' : '👑 Penthouse Kosan';
                  const taxSavedMsg = res.roomTier === 'DEFAULT' ? '💡 *Naikkan sewa kamar kosan untuk menikmati potongan pajak penarikan bank harian!*' :
                                      res.roomTier === 'PENTHOUSE' ? '👑 *Keanggotaan Penthouse: Pajak penarikan dibebaskan 100%!*' :
                                      `✨ *Diskon Kamar kosan aktif: Pajak hanya ${res.taxRate}%!*`;

                  const successEmb = embeds.bankSuccessEmbed(
                    'Penarikan Saldo Berhasil!',
                    `Koin ditarik: **Rp ${res.amount.toLocaleString('id-ID')}**\n` +
                    `✂️ Pajak Penarikan (${res.taxRate}%): **-Rp ${res.tax.toLocaleString('id-ID')}** (Dibakar)\n` +
                    `💰 Bersih diterima Dompet: **Rp ${res.netAmount.toLocaleString('id-ID')}**\n` +
                    `🏢 Kasta Sewa Kamar: **${roomTierName}**\n\n` +
                    `🏦 **Sisa Saldo Bank:** **Rp ${res.savingsBalance.toLocaleString('id-ID')}**\n` +
                    `💵 **Saldo Dompet Baru:** **Rp ${res.walletBalance.toLocaleString('id-ID')}**\n───────────────────\n` +
                    taxSavedMsg
                  );
                  await submitted.reply({ embeds: [successEmb], flags: 64 });
                  await privateMsg.edit(getBankDashboardDataPrivate(user.id)).catch(() => { });
                } catch (err) {
                  await submitted.reply({ embeds: [embeds.bankErrorEmbed('Penarikan Gagal!', err.message)], flags: 64 });
                }
              }
            }

            else if (iBank.customId === 'bank_btn_loan') {
              const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('bank_select_tenor_perm')
                .setPlaceholder('👉 Pilih jangka tempo (Tenor)...')
                .addOptions(
                  new StringSelectMenuOptionBuilder().setLabel('1 Hari (Bunga 2%)').setValue('1'),
                  new StringSelectMenuOptionBuilder().setLabel('3 Hari (Bunga 5%)').setValue('3'),
                  new StringSelectMenuOptionBuilder().setLabel('7 Hari (Bunga 10%)').setValue('7')
                );

              const tenorRow = new ActionRowBuilder().addComponents(selectMenu);
              const cancelBtn = new ButtonBuilder().setCustomId('bank_loan_cancel_perm').setLabel('✖️ Batalkan').setStyle(ButtonStyle.Secondary);
              const cancelRow = new ActionRowBuilder().addComponents(cancelBtn);

              const askTenorMsg = await iBank.reply({
                content: '💡 **PILIH JANGKA TEMPO PINJAMAN (TENOR)**\nSilakan pilih jangka waktu pengembalian utang:',
                components: [tenorRow, cancelRow],
                flags: 64
              });
              await iBank.fetchReply().then(m => { Object.assign(askTenorMsg, m); }).catch(() => {});

              const tenorCollector = askTenorMsg.createMessageComponentCollector({ time: 60000 });

              tenorCollector.on('collect', async iTenor => {
                if (iTenor.user.id !== user.id) return;

                if (iTenor.customId === 'bank_loan_cancel_perm') {
                  tenorCollector.stop();
                  await iTenor.update({ content: '❌ Pengajuan pinjaman dibatalkan.', components: [] });
                } else if (iTenor.customId === 'bank_select_tenor_perm') {
                  tenorCollector.stop();
                  const selectedTenor = parseInt(iTenor.values[0]);
                  const maxLimit = bank.calculateMaxLoanLimit(user.id, guildId);

                  const modal = new ModalBuilder()
                    .setCustomId(`bank_modal_loan_${selectedTenor}_perm`)
                    .setTitle(`📜 Pinjam Tenor ${selectedTenor} Hari`);

                  const loanInput = new TextInputBuilder()
                    .setCustomId('loan_amount')
                    .setLabel(`Jumlah pinjaman (Maks Rp ${maxLimit.toLocaleString('id-ID')})`)
                    .setPlaceholder('Contoh: 10000')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                  modal.addComponents(new ActionRowBuilder().addComponents(loanInput));
                  await iTenor.showModal(modal);

                  await askTenorMsg.delete().catch(() => { });

                  const submitted = await iTenor.awaitModalSubmit({
                    filter: (sub) => sub.customId === `bank_modal_loan_${selectedTenor}_perm` && sub.user.id === user.id,
                    time: 60000
                  }).catch(() => null);

                  if (submitted) {
                    try {
                      const amountStr = submitted.fields.getTextInputValue('loan_amount');
                      const res = bank.createLoan(user.id, guildId, amountStr, selectedTenor);
                      const dueText = `<t:${res.dueAt}:F> (<t:${res.dueAt}:R>)`;

                      const successEmb = embeds.bankSuccessEmbed(
                        'Pinjaman Disetujui!',
                        `Pinjaman Anda berhasil dicairkan!\n\n` +
                        `💵 **Pokok:** **Rp ${res.principal.toLocaleString('id-ID')}**\n` +
                        `📈 **Bunga:** \`${(res.interestRate * 100).toFixed(0)}%\` (Tenor \`${res.tenorDays} Hari\`)\n` +
                        `💳 **Total Tagihan:** **Rp ${res.totalDue.toLocaleString('id-ID')}**\n` +
                        `📅 **Jatuh Tempo:** ${dueText}`
                      );

                      await submitted.reply({ embeds: [successEmb], flags: 64 });
                      await privateMsg.edit(getBankDashboardDataPrivate(user.id)).catch(() => { });
                    } catch (err) {
                      await submitted.reply({ embeds: [embeds.bankErrorEmbed('Pinjaman Ditolak!', err.message)], flags: 64 });
                    }
                  }
                }
              });
            }

            else if (iBank.customId === 'bank_btn_repay') {
              try {
                const res = bank.repayLoan(user.id, guildId);
                let desc = '';
                if (res.isFullyPaid) {
                  desc = `Selamat! Utang pinjaman Anda telah **LUNAS SEPENUHNYA**.\n\n` +
                    `💳 **Dibayarkan:** **Rp ${res.amountPaid.toLocaleString('id-ID')}**\n` +
                    `💵 **Sisa Saldo Dompet:** **Rp ${res.walletBalance.toLocaleString('id-ID')}**`;
                } else {
                  desc = `Pembayaran utang berhasil diproses sebagian.\n\n` +
                    `💳 **Dibayarkan:** **Rp ${res.amountPaid.toLocaleString('id-ID')}**\n` +
                    `⚠️ **Sisa Hutang:** **Rp ${res.remainingPrincipal.toLocaleString('id-ID')}**\n` +
                    `💵 **Sisa Saldo Dompet:** **Rp ${res.walletBalance.toLocaleString('id-ID')}**`;
                }
                await iBank.reply({ embeds: [embeds.bankSuccessEmbed('Pembayaran Berhasil!', desc)], flags: 64 });
                await privateMsg.edit(getBankDashboardDataPrivate(user.id)).catch(() => { });
              } catch (err) {
                await iBank.reply({ embeds: [embeds.bankErrorEmbed('Pembayaran Gagal!', err.message)], flags: 64 });
              }
            }
          } catch (err) {
            console.error('Error in bank private collector:', err);
          }
        });

        collector.on('end', async () => {
          await privateMsg.edit({ components: [] }).catch(() => { });
        });
      }

      // ── PORTAL PERMANEN: PASAR GELAP (BM) ──
      else if (customId === 'eco_btn_open_bm_private_perm') {
        await interaction.deferReply({ flags: 64 });
        const bmEmbed = new EmbedBuilder()
          .setColor(0x1A1A1A)
          .setTitle('🕵️‍♂️ PASAR GELAP KOSAN (BLACK MARKET)')
          .setDescription(
            `Selamat datang di pasar gelap kosan, kawan. Butuh barang-barang untuk memuluskan aksi kriminalmu? Kami punya persediaannya...\n\n` +
            `**Daftar Peralatan Tersedia:**\n\n` +
            `🗝️ **Linggis / Lockpick** (\`lockpick\`) - **Rp 450**\n` +
            `*Meningkatkan sukses rate rob +15% (peluang patah 20%).*\n\n` +
            `🎭 **Topeng Samaran** (\`mask\`) - **Rp 600**\n` +
            `*Menyembunyikan namamu saat rob berhasil (sekali pakai).*\n\n` +
            `🥩 **Daging Bius** (\`meat\`) - **Rp 350**\n` +
            `*Menonaktifkan Alarm & CCTV korban saat rob (sekali pakai).*\n\n` +
            `🧼 **Sabun Licin** (\`soap\`) - **Rp 500**\n` +
            `*Memotong waktu tahanan penjara 50% jika ketangkap (sekali pakai).*\n\n` +
            `*Klik tombol di bawah untuk membeli barang secara privat.*`
          )
          .setFooter({ text: 'Sentinel Black Market • Kerahasiaan Terjamin' })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('bm_btn_buy_lockpick_perm').setLabel('🗝️ Linggis').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('bm_btn_buy_mask_perm').setLabel('🎭 Topeng').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('bm_btn_buy_meat_perm').setLabel('🥩 Daging').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('bm_btn_buy_soap_perm').setLabel('🧼 Sabun').setStyle(ButtonStyle.Secondary)
        );

        const privateMsg = await interaction.editReply({ embeds: [bmEmbed], components: [row] });
        const collector = privateMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

        collector.on('collect', async i => {
          if (i.user.id !== user.id) return i.reply({ content: '❌ Hanya orang yang memanggil menu ini yang bisa menggunakan tombol!', flags: 64 });

          let itemId = '';
          if (i.customId === 'bm_btn_buy_lockpick_perm') itemId = 'lockpick';
          if (i.customId === 'bm_btn_buy_mask_perm') itemId = 'mask';
          if (i.customId === 'bm_btn_buy_meat_perm') itemId = 'meat';
          if (i.customId === 'bm_btn_buy_soap_perm') itemId = 'soap';

          try {
            const res = bm.buyItem(user.id, guildId, itemId, 1);
            const successEmb = embeds.successEmbed(
              'Transaksi Pasar Gelap Sukses! 🛒🕵️‍♂️',
              `Berhasil membeli **1x ${res.item.name}** seharga **Rp ${res.totalPrice.toLocaleString('id-ID')}**!\n` +
              `🎒 Jumlah di kantongmu sekarang: **x${res.newQty}**.\n\n` +
              `📉 Sisa dompetmu: **Rp ${economy.getWallet(user.id, guildId).balance.toLocaleString('id-ID')}**.`
            );
            await i.update({ embeds: [successEmb], components: [] });
            collector.stop();
          } catch (err) {
            await i.reply({ content: `❌ Transaksi Gagal: ${err.message}`, flags: 64 });
          }
        });

        collector.on('end', async () => {
          if (collector.destroyed) return;
          const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bm_btn_buy_lockpick_perm').setLabel('🗝️ Linggis').setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('bm_btn_buy_mask_perm').setLabel('🎭 Topeng').setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('bm_btn_buy_meat_perm').setLabel('🥩 Daging').setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('bm_btn_buy_soap_perm').setLabel('🧼 Sabun').setStyle(ButtonStyle.Secondary).setDisabled(true)
          );
          await privateMsg.edit({ components: [disabledRow] }).catch(() => { });
        });
      }

      // ── PORTAL PERMANEN: PUSAT PERAWATAN PET ──
      else if (customId === 'pet_btn_open_pet_private_perm') {
        await interaction.deferReply({ flags: 64 });
        const getDashboardPanelPrivate = (targetUserId) => {
          const userPet = pet.getPet(targetUserId, guildId);
          const inventory = pet.getInventory(targetUserId, guildId);
          const allPets = pet.getPetsList(targetUserId, guildId);
          const embed = embeds.petDashboardEmbed(user, userPet, inventory);
          const rows = [];
          const canAdoptMore = allPets.length < 3;

          if (!userPet) {
            rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('pet_btn_nav_adopt').setLabel('🛎️ Adopsi Telur Pet').setStyle(ButtonStyle.Success)));
          } else if (userPet.status === 'EGG') {
            const now = Math.floor(Date.now() / 1000);
            const isHatched = userPet.hatch_at <= now;
            const eggComponents = [new ButtonBuilder().setCustomId('pet_btn_hatch').setLabel('🐣 Tetaskan').setStyle(ButtonStyle.Success).setDisabled(!isHatched)];
            if (canAdoptMore) eggComponents.push(new ButtonBuilder().setCustomId('pet_btn_nav_adopt').setLabel('🛎️ Adopsi (+)').setStyle(ButtonStyle.Success));
            eggComponents.push(new ButtonBuilder().setCustomId('pet_btn_refresh').setLabel('🔄 Segarkan').setStyle(ButtonStyle.Secondary));
            rows.push(new ActionRowBuilder().addComponents(eggComponents));
          } else if (userPet.status === 'DEAD') {
            const deadComponents = [new ButtonBuilder().setCustomId('pet_btn_reset').setLabel('🧹 Reset Kandang').setStyle(ButtonStyle.Danger)];
            if (canAdoptMore) deadComponents.push(new ButtonBuilder().setCustomId('pet_btn_nav_adopt').setLabel('🛎️ Adopsi (+)').setStyle(ButtonStyle.Success));
            rows.push(new ActionRowBuilder().addComponents(deadComponents));
          } else {
            rows.push(new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('pet_btn_feed').setLabel('🍗 Makan').setStyle(ButtonStyle.Success),
              new ButtonBuilder().setCustomId('pet_btn_drink').setLabel('🥤 Minum').setStyle(ButtonStyle.Primary),
              new ButtonBuilder().setCustomId('pet_btn_play').setLabel('⚽ Main').setStyle(ButtonStyle.Success),
              new ButtonBuilder().setCustomId('pet_btn_cure').setLabel('💊 Obat').setStyle(ButtonStyle.Danger)
            ));
            const row2Components = [
              new ButtonBuilder().setCustomId('pet_btn_work').setLabel('💼 Kerja').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId('pet_btn_hunt').setLabel('🏹 Berburu').setStyle(ButtonStyle.Secondary).setDisabled(
                !(userPet.pet_name.toLowerCase() === 'ramzi' && userPet.user_id === '436554535037698059') &&
                userPet.level < 10 &&
                userPet.status !== 'ADULT'
              ),
              new ButtonBuilder().setCustomId('pet_btn_nav_shop').setLabel('🎒 Toko Pet').setStyle(ButtonStyle.Primary)
            ];
            if (canAdoptMore) row2Components.push(new ButtonBuilder().setCustomId('pet_btn_nav_adopt').setLabel('🛎️ Adopsi (+)').setStyle(ButtonStyle.Success));
            rows.push(new ActionRowBuilder().addComponents(row2Components));

            const row3Components = [
              new ButtonBuilder()
                .setCustomId('pet_btn_toggle_auto_feed')
                .setLabel(userPet.auto_feed === 1 ? '🤖 Auto Care: AKTIF' : '🤖 Auto Care: NONAKTIF')
                .setStyle(userPet.auto_feed === 1 ? ButtonStyle.Success : ButtonStyle.Danger),
              new ButtonBuilder().setCustomId('pet_btn_use_booster').setLabel('⚡ Pakai Booster').setStyle(ButtonStyle.Primary),
              new ButtonBuilder().setCustomId('pet_btn_refresh').setLabel('🔄 Refresh').setStyle(ButtonStyle.Secondary)
            ];
            rows.push(new ActionRowBuilder().addComponents(row3Components));
          }
          if (allPets.length > 1) {
            const selectMenu = new StringSelectMenuBuilder().setCustomId('pet_select_active').setPlaceholder('🐾 Ganti Peliharaan Aktif...');
            allPets.forEach(p => {
              const isCurrent = p.is_active === 1;
              selectMenu.addOptions({
                label: `${p.pet_name} the ${p.pet_type} (Lv. ${p.level})`,
                description: isCurrent ? 'Aktif' : 'Klik untuk mengaktifkan',
                value: p.pet_name,
                default: isCurrent
              });
            });
            rows.push(new ActionRowBuilder().addComponents(selectMenu));
          }
          return { embeds: [embed], components: rows };
        };

        const getShopPanelDataPrivate = (targetUserId) => {
          const wallet2 = economy.getWallet(targetUserId, guildId);
          const inv = pet.getInventory(targetUserId, guildId);
          const embed = embeds.petShopEmbed(wallet2, inv);

          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('pet_select_shop_item')
            .setPlaceholder('👉 Pilih persediaan untuk dibeli...')
            .addOptions(
              new StringSelectMenuOptionBuilder().setLabel('🍗 Pakan Pet Biasa (Rp 150)').setDescription('+30 Kenyangan').setValue('FOOD_BASIC'),
              new StringSelectMenuOptionBuilder().setLabel('🥩 Daging Premium (Rp 350)').setDescription('+70 Kenyangan & +10 HP').setValue('FOOD_PREMIUM'),
              new StringSelectMenuOptionBuilder().setLabel('🥤 Air Bersih (Rp 100)').setDescription('+35 Hidrasi').setValue('WATER'),
              new StringSelectMenuOptionBuilder().setLabel('💊 Ramuan Kesehatan (Rp 500)').setDescription('+50 HP & Menyembuhkan Sakit').setValue('MEDICINE'),
              new StringSelectMenuOptionBuilder().setLabel('⚽ Bola Karet (Rp 250)').setDescription('+50 Kebahagiaan').setValue('TOY'),
              new StringSelectMenuOptionBuilder().setLabel('⚡ XP Booster 2x (Rp 2.500)').setDescription('XP Pet 2x Permanen').setValue('XP_2X'),
              new StringSelectMenuOptionBuilder().setLabel('⚡ XP Booster 4x (Rp 5.000)').setDescription('XP Pet 4x Permanen').setValue('XP_4X'),
              new StringSelectMenuOptionBuilder().setLabel('⚡ XP Booster 6x (Rp 7.500)').setDescription('XP Pet 6x Permanen').setValue('XP_6X'),
              new StringSelectMenuOptionBuilder().setLabel('⚡ XP Booster 8x (Rp 10.000)').setDescription('XP Pet 8x Permanen').setValue('XP_8X')
            );

          const selectRow = new ActionRowBuilder().addComponents(selectMenu);
          const cancelBtn = new ButtonBuilder().setCustomId('pet_btn_cancel_shop').setLabel('✖️ Kembali ke Dashboard').setStyle(ButtonStyle.Secondary);
          const cancelRow = new ActionRowBuilder().addComponents(cancelBtn);

          return { embeds: [embed], components: [selectRow, cancelRow] };
        };

        const initialData = getDashboardPanelPrivate(user.id);
        const privateMsg = await interaction.editReply({ ...initialData });
        const collector = privateMsg.createMessageComponentCollector({ time: 180000 });

        collector.on('collect', async iPet => {
          if (iPet.user.id !== user.id) return iPet.reply({ content: '❌ Tombol ini bukan milik Anda!', flags: 64 });

          try {
            if (iPet.customId === 'pet_btn_refresh') {
              await iPet.update(getDashboardPanelPrivate(user.id));
            } else if (iPet.customId === 'pet_btn_toggle_auto_feed') {
              const result = pet.toggleAutoFeed(user.id, guildId);
              const statusStr = result.autoFeed === 1 ? 'AKTIF 🟢 (langsung potong saldo)' : 'NONAKTIF 🔴';
              await iPet.reply({ embeds: [embeds.successEmbed('Auto Care! 🤖', `Fitur Auto Makan & Minum pet **${result.petName}** sekarang **${statusStr}**.`)] , flags: 64 });
              await privateMsg.edit(getDashboardPanelPrivate(user.id)).catch(() => { });
            } else if (iPet.customId === 'pet_btn_use_booster') {
              try {
                const freshPet = pet.getPet(user.id, guildId);
                if (!freshPet) {
                  return iPet.reply({ content: '❌ Anda tidak memiliki pet aktif!', flags: 64 });
                }
                const inv = pet.getInventory(user.id, guildId);
                const boosters = inv.filter(item => item.multiplier && item.quantity > 0);

                if (boosters.length === 0) {
                  return iPet.reply({
                    embeds: [embeds.warnEmbed(
                      'Tidak Ada Booster! ❌',
                      'Anda tidak memiliki item XP Booster di persediaan pet Anda!\n\n' +
                      '🛒 *Beli di **🎒 Toko Pet** terlebih dahulu untuk mempercepat kenaikan level pet Anda secara permanen!*'
                    )],
                    flags: 64
                  });
                }

                const selectMenu = new StringSelectMenuBuilder()
                  .setCustomId('pet_select_booster_use')
                  .setPlaceholder('⚡ Pilih XP Booster yang ingin digunakan...');

                boosters.forEach(item => {
                  selectMenu.addOptions(
                    new StringSelectMenuOptionBuilder()
                      .setLabel(`${item.name} (${item.quantity} pcs)`)
                      .setDescription(`Aktifkan pengali XP ${item.multiplier}x secara permanen`)
                      .setValue(item.id)
                  );
                });

                const row = new ActionRowBuilder().addComponents(selectMenu);
                const boosterEmbed = new EmbedBuilder()
                  .setColor(0x7C4DFF)
                  .setTitle('⚡ PAKAI XP BOOSTER PET ⚡')
                  .setDescription(
                    `Silakan pilih item XP Booster yang ingin Anda gunakan untuk pet aktif Anda (**${freshPet.pet_name}**):\n\n` +
                    `📊 **Pengali XP Saat Ini:** **${freshPet.xp_multiplier || 1.0}x**\n\n` +
                    `*Penggunaan booster akan mengganti pengali XP pet Anda secara permanen dengan nilai yang lebih tinggi.*`
                  )
                  .setTimestamp();

                const subPrivateMsg = await iPet.reply({ embeds: [boosterEmbed], components: [row], flags: 64 });
                const boosterCollector = subPrivateMsg.createMessageComponentCollector({
                  componentType: ComponentType.StringSelect,
                  time: 60000
                });

                boosterCollector.on('collect', async iBooster => {
                  if (iBooster.user.id !== user.id) return;
                  const selectedBoosterId = iBooster.values[0];

                  try {
                    const res = pet.useItem(user.id, guildId, selectedBoosterId, false);
                    const successEmb = embeds.successEmbed(
                      'Penggunaan Booster Sukses! ⚡',
                      `Berhasil mengaktifkan **${res.item.name}** pada pet **${res.pet.pet_name}**!\n\n` +
                      `📈 Pengali XP Pet Anda sekarang menjadi **${res.item.multiplier}x** secara permanen!`
                    );
                    await iBooster.update({ embeds: [successEmb], components: [] });
                    await privateMsg.edit(getDashboardPanelPrivate(user.id)).catch(() => {});
                  } catch (err) {
                    await iBooster.update({ embeds: [embeds.errorEmbed('Gagal Menggunakan Booster!', err.message)], components: [] });
                  }
                });
              } catch (err) {
                await iPet.reply({ embeds: [embeds.errorEmbed('Gagal Membuka Menu Booster!', err.message)], flags: 64 });
              }
            } else if (iPet.customId === 'pet_btn_reset') {
              pet.resetPet(user.id, guildId);
              await iPet.update({ content: '🧹 Kandang dibersihkan!', embeds: [], components: [] });
              collector.stop();
            } else if (iPet.customId === 'pet_select_active') {
              pet.switchActivePet(user.id, guildId, iPet.values[0]);
              await iPet.update(getDashboardPanelPrivate(user.id));
            } else if (iPet.customId === 'pet_btn_hatch') {
              const res = pet.getPet(user.id, guildId);
              if (res && res.status === 'BABY') {
                await iPet.reply({ embeds: [embeds.successEmbed('Telur Menetas! 🎉🐣', `Pet **${res.pet_name}** telah menetas menjadi bayi monster!`)], flags: 64 });
                await privateMsg.edit(getDashboardPanelPrivate(user.id)).catch(() => { });
              }
            } else if (iPet.customId === 'pet_btn_feed') {
              const res = pet.useItem(user.id, guildId, 'FOOD_BASIC', true);
              await iPet.reply({ embeds: [embeds.successEmbed('Beri Makan! 🍗', `Kenyangan pet sekarang **${res.pet.hunger}%**.`)], flags: 64 });
              await privateMsg.edit(getDashboardPanelPrivate(user.id)).catch(() => { });
            } else if (iPet.customId === 'pet_btn_drink') {
              const res = pet.useItem(user.id, guildId, 'WATER', true);
              await iPet.reply({ embeds: [embeds.successEmbed('Beri Minum! 🥤', `Hidrasi pet sekarang **${res.pet.thirst}%**.`)], flags: 64 });
              await privateMsg.edit(getDashboardPanelPrivate(user.id)).catch(() => { });
            } else if (iPet.customId === 'pet_btn_play') {
              const res = pet.playWithPet(user.id, guildId);
              await iPet.reply({ embeds: [embeds.successEmbed('Bermain! ⚽', `Kebahagiaan pet sekarang **${res.happiness}%**.`)], flags: 64 });
              await privateMsg.edit(getDashboardPanelPrivate(user.id)).catch(() => { });
            } else if (iPet.customId === 'pet_btn_cure') {
              const res = pet.useItem(user.id, guildId, 'MEDICINE', true);
              await iPet.reply({ embeds: [embeds.successEmbed('Obat! 💊', `Kesehatan HP pet sekarang **${res.pet.health}%**.`)], flags: 64 });
              await privateMsg.edit(getDashboardPanelPrivate(user.id)).catch(() => { });
            } else if (iPet.customId === 'pet_btn_work') {
              const res = pet.sendToWork(user.id, guildId);
              await iPet.reply({ embeds: [embeds.successEmbed('Kerja! 💼', `Gaji didapat **Rp ${res.reward}**.`)], flags: 64 });
              await privateMsg.edit(getDashboardPanelPrivate(user.id)).catch(() => { });
            } else if (iPet.customId === 'pet_btn_hunt') {
              const res = pet.sendToHunt(user.id, guildId);
              await iPet.reply({ embeds: [embeds.successEmbed('Berburu! 🏹', `Koin didapat **Rp ${res.reward}**.`)], flags: 64 });
              await privateMsg.edit(getDashboardPanelPrivate(user.id)).catch(() => { });
            } else if (iPet.customId === 'pet_btn_nav_shop') {
              await iPet.update(getShopPanelDataPrivate(user.id));
            } else if (iPet.customId === 'pet_btn_cancel_shop') {
              await iPet.update(getDashboardPanelPrivate(user.id));
            } else if (iPet.customId === 'pet_select_shop_item') {
              const selectedItem = iPet.values[0];
              try {
                const res = pet.buyItem(user.id, guildId, selectedItem, 1);
                const successEmb = embeds.successEmbed(
                  'Transaksi Belanja Sukses! 🛒',
                  `Berhasil membeli **1x ${res.item.name}** seharga **Rp ${res.totalPrice.toLocaleString('id-ID')}**!\n📦 Barang dimasukkan ke kandang.\n\nSisa dompet Anda: **Rp ${economy.getWallet(user.id, guildId).balance.toLocaleString('id-ID')}**.`
                );
                await iPet.reply({ embeds: [successEmb], flags: 64 });
                await privateMsg.edit(getDashboardPanelPrivate(user.id)).catch(() => { });
              } catch (err) {
                await iPet.reply({ embeds: [embeds.errorEmbed('Belanja Gagal!', err.message)], flags: 64 });
              }
            } else if (iPet.customId === 'pet_btn_nav_adopt') {
              const modal = new ModalBuilder()
                .setCustomId('pet_modal_adopt_perm')
                .setTitle('🛎️ Adopsi Telur Pet Tamagotchi');

              const nameInput = new TextInputBuilder()
                .setCustomId('pet_name')
                .setLabel('Nama Pet Anda')
                .setPlaceholder('Contoh: Ciko')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

              const typeInput = new TextInputBuilder()
                .setCustomId('pet_type')
                .setLabel('Jenis Pet (Slime / Dragon / Cat / Golem)')
                .setPlaceholder('Ketik jenis pet pilihan Anda')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

              modal.addComponents(
                new ActionRowBuilder().addComponents(nameInput),
                new ActionRowBuilder().addComponents(typeInput)
              );

              await iPet.showModal(modal);

              const submitted = await iPet.awaitModalSubmit({
                filter: (sub) => sub.customId === 'pet_modal_adopt_perm' && sub.user.id === user.id,
                time: 60000
              }).catch(() => null);

              if (submitted) {
                try {
                  const pName = submitted.fields.getTextInputValue('pet_name');
                  const pType = submitted.fields.getTextInputValue('pet_type');
                  const res = pet.adoptPet(user.id, guildId, pName, pType);
                  await submitted.reply({ embeds: [embeds.successEmbed('Adopsi Sukses! 🥚', `Selamat! Telur pet **${res.pet_name}** the **${res.pet_type}** diadopsi seharga **Rp 1.500**!`)], flags: 64 });
                  await privateMsg.edit(getDashboardPanelPrivate(user.id)).catch(() => { });
                } catch (err) {
                  await submitted.reply({ embeds: [embeds.errorEmbed('Adopsi Gagal!', err.message)], flags: 64 });
                }
              }
            }
          } catch (err) {
            await iPet.reply({ content: `❌ Gagal: ${err.message}`, flags: 64 }).catch(() => { });
          }
        });

        collector.on('end', async () => {
          await privateMsg.edit({ components: [] }).catch(() => { });
        });
      }

      // ── PORTAL PERMANEN: KOSAN (.kos) ──
      else if (customId === 'eco_btn_open_kos_private_perm') {
        await interaction.deferReply({ flags: 64 });
        const kos = require('./kos');

        const getKosDashboardDataPrivate = (targetUserId) => {
          const wallet = economy.getWallet(targetUserId, guildId);
          const activeRental = kos.getActiveRental(targetUserId, guildId);
          const upgrades = kos.getUpgrades(targetUserId, guildId);
          const embed = embeds.kosDashboardEmbed(interaction.user, wallet, activeRental, upgrades);

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('kos_btn_nav_sewa_perm').setLabel('🛎️ Sewa Kamar').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('kos_btn_nav_upgrade_perm').setLabel('🛒 Belanja Fasilitas').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('kos_btn_refresh_perm').setLabel('🔄 Segarkan').setStyle(ButtonStyle.Secondary)
          );

          return { embeds: [embed], components: [row] };
        };

        const getSewaPanelDataPrivate = (targetUserId) => {
          const currentRental = kos.getActiveRental(targetUserId, guildId);
          const embed = embeds.kosRoomListEmbed(currentRental);

          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('kos_select_room_perm')
            .setPlaceholder('👉 Pilih kasta kamar untuk disewa...')
            .addOptions(
              new StringSelectMenuOptionBuilder()
                .setLabel('💨 Kamar Kipas Angin (Rp 150)')
                .setDescription('Bonus Daily +Rp 5 | Durasi 3 Hari')
                .setValue('KIPAS'),
              new StringSelectMenuOptionBuilder()
                .setLabel('❄️ Kamar AC (Rp 350)')
                .setDescription('Bonus Daily +Rp 15 | Pajak Transfer 8% | 3 Hari')
                .setValue('AC'),
              new StringSelectMenuOptionBuilder()
                .setLabel('👑 Penthouse Kosan (Rp 800)')
                .setDescription('Daily +Rp 40 | Pajak Transfer 5% | Pajak Jual Saham 10%')
                .setValue('PENTHOUSE')
            );

          const selectRow = new ActionRowBuilder().addComponents(selectMenu);
          const backBtn = new ButtonBuilder()
            .setCustomId('kos_btn_back_dashboard_perm')
            .setLabel('✖️ Kembali ke Dashboard')
            .setStyle(ButtonStyle.Secondary);
          const backRow = new ActionRowBuilder().addComponents(backBtn);

          return { embeds: [embed], components: [selectRow, backRow] };
        };

        const getUpgradePanelDataPrivate = (targetUserId) => {
          const ownedUpgrades = kos.getUpgrades(targetUserId, guildId);
          const embed = embeds.kosUpgradeListEmbed(ownedUpgrades);

          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('kos_select_upgrade_perm')
            .setPlaceholder('👉 Pilih furniture/fasilitas untuk dibeli...');

          const upgradesConfig = config.kos.UPGRADES;
          Object.keys(upgradesConfig).forEach(key => {
            const up = upgradesConfig[key];
            const isOwned = ownedUpgrades.some(o => o.id === up.id);

            selectMenu.addOptions(
              new StringSelectMenuOptionBuilder()
                .setLabel(`${up.name} (${isOwned ? 'Miliki' : `Rp ${up.price}`})`)
                .setDescription(up.desc.substring(0, 100))
                .setValue(up.id)
            );
          });

          const selectRow = new ActionRowBuilder().addComponents(selectMenu);
          const backBtn = new ButtonBuilder()
            .setCustomId('kos_btn_back_dashboard_perm')
            .setLabel('✖️ Kembali ke Dashboard')
            .setStyle(ButtonStyle.Secondary);
          const backRow = new ActionRowBuilder().addComponents(backBtn);

          return { embeds: [embed], components: [selectRow, backRow] };
        };

        const initialData = getKosDashboardDataPrivate(user.id);
        const privateMsg = await interaction.editReply({ ...initialData });
        const collector = privateMsg.createMessageComponentCollector({ time: 180000 });

        collector.on('collect', async iKos => {
          if (iKos.user.id !== user.id) return iKos.reply({ content: '❌ Tombol ini bukan milik Anda!', flags: 64 });

          try {
            if (iKos.customId === 'kos_btn_refresh_perm') {
              await iKos.update(getKosDashboardDataPrivate(user.id));
            } else if (iKos.customId === 'kos_btn_nav_sewa_perm') {
              await iKos.update(getSewaPanelDataPrivate(user.id));
            } else if (iKos.customId === 'kos_btn_nav_upgrade_perm') {
              await iKos.update(getUpgradePanelDataPrivate(user.id));
            } else if (iKos.customId === 'kos_btn_back_dashboard_perm') {
              await iKos.update(getKosDashboardDataPrivate(user.id));
            } else if (iKos.customId === 'kos_select_room_perm') {
              const selectedRoom = iKos.values[0];
              try {
                const res = kos.rentRoom(user.id, guildId, selectedRoom);
                const dueText = `<t:${res.endsAt}:F> (<t:${res.endsAt}:R>)`;

                const successEmb = embeds.kosSuccessReceiptEmbed(
                  'Transaksi Persewaan Kamar Berhasil! 🛌',
                  `Selamat! Kamu resmi menyewa **${res.name}**!\n\n` +
                  `💰 **Harga Sewa:** **Rp ${res.price.toLocaleString('id-ID')}**\n` +
                  `📅 **Masa Aktif s/d:** ${dueText}\n\n` +
                  `📉 Sisa saldo dompetmu sekarang adalah **Rp ${res.walletBalance.toLocaleString('id-ID')}**.`
                );

                await iKos.reply({ embeds: [successEmb], flags: 64 });
                await privateMsg.edit(getKosDashboardDataPrivate(user.id)).catch(() => { });
              } catch (err) {
                const errorEmb = embeds.errorEmbed('Penyewaan Kamar Gagal!', err.message);
                await iKos.reply({ embeds: [errorEmb], flags: 64 });
              }
            } else if (iKos.customId === 'kos_select_upgrade_perm') {
              const selectedUpgrade = iKos.values[0];
              try {
                const res = kos.buyUpgrade(user.id, guildId, selectedUpgrade);

                const successEmb = embeds.kosSuccessReceiptEmbed(
                  'Transaksi Belanja Fasilitas Berhasil! 🛒',
                  `Selamat! Kamu berhasil membeli fasilitas **${res.name}**!\n\n` +
                  `💰 **Harga Beli:** **Rp ${res.price.toLocaleString('id-ID')}**\n` +
                  `✨ **Status:** Terpasang secara permanen di kamarmu.\n\n` +
                  `📉 Sisa saldo dompetmu sekarang adalah **Rp ${res.walletBalance.toLocaleString('id-ID')}**.`
                );

                await iKos.reply({ embeds: [successEmb], flags: 64 });
                await privateMsg.edit(getKosDashboardDataPrivate(user.id)).catch(() => { });
              } catch (err) {
                const errorEmb = embeds.errorEmbed('Belanja Fasilitas Gagal!', err.message);
                await iKos.reply({ embeds: [errorEmb], flags: 64 });
              }
            }
          } catch (err) {
            console.error('Error in Kos permanent collector:', err);
          }
        });

        collector.on('end', async () => {
          await privateMsg.edit({ components: [] }).catch(() => { });
        });
      }
    } catch (err) {
      console.error('Error handling permanent portal click:', err);
    }
  });
}

/**
 * Menangani event messageCreate untuk kalkulasi perolehan koin (ekonomi pasif)
 * dan memberikan skor keaktifan channel saham.
 */
async function handleEconomyChat(message) {
  const { author, guildId, channelId } = message;

  // 1. Validasi filter kelayakan pesan (anti-spam, channel terlarang, dll)
  if (!antiSpam.validateMessage(message)) return;

  // 1b. Auto-Daily Claim: Klaim otomatis gaji harian jika belum diklaim hari ini!
  try {
    const wallet = economy.getWallet(author.id, guildId);
    const now = new Date();
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);

    const activeLoan = bank.getActiveLoan(author.id, guildId);
    const isOverdue = activeLoan && activeLoan.status === 'OVERDUE';

    if (wallet.last_active_date !== todayStr && !isOverdue) {
      const dailyResult = economy.claimDaily(author.id, guildId);
      if (dailyResult && dailyResult.success) {
        let dailyDesc = `Selamat! Karena keaktifan Anda mengobrol di server hari ini, Gaji Harian Otomatis Anda berhasil dicairkan! 💸✨\n\n` +
          `💰 Hadiah: Rp ${dailyResult.reward.toLocaleString('id-ID')}\n` +
          `👉 Detail: Hadiah Dasar: Rp ${dailyResult.baseReward} | Streak Bonus: Rp ${dailyResult.streakBonus}\n` +
          `🔥 Streak Saat Ini: ${dailyResult.streak} hari berturut-turut!`;

        if (dailyResult.debtPaidDetails) {
          const { creditorId, paidAmount, remainingDebt } = dailyResult.debtPaidDetails;
          dailyDesc += `\n\n⚠️ **POTONGAN HUTANG OTOMATIS!**\n` +
            `Sebesar **Rp ${paidAmount.toLocaleString('id-ID')}** dipotong otomatis untuk mencicil hutang tebusan Anda kepada <@${creditorId}>.\n` +
            `╰ 💰 Bersih Diterima: **Rp ${dailyResult.finalReward.toLocaleString('id-ID')}**\n` +
            `╰ 🧾 Sisa Hutang Anda: **${remainingDebt > 0 ? `Rp ${remainingDebt.toLocaleString('id-ID')}` : '✨ LUNAS!'}**`;
        }

        dailyDesc += `\n\nPeriksa saldo Anda kapan saja dengan mengetik .bal atau .porto!`;

        // Kirim notifikasi embed gaji harian otomatis yang premium
        const autoDailyEmbed = new EmbedBuilder()
          .setColor(embeds.COLORS.SUCCESS)
          .setTitle(`🌅 Gaji Harian Otomatis — ${author.username}`)
          .setThumbnail(author.displayAvatarURL({ dynamic: true }))
          .setDescription(dailyDesc)
          .setTimestamp();

        let targetChannel = null;
        if (config.REPORT_CHANNEL_ID) {
          targetChannel = message.guild.channels.cache.get(config.REPORT_CHANNEL_ID);
          if (!targetChannel) {
            try {
              targetChannel = await message.guild.channels.fetch(config.REPORT_CHANNEL_ID);
            } catch (e) {
              // Silent fail for fetch, proceed to fallback
            }
          }
        }
        if (!targetChannel) {
          targetChannel = message.guild.channels.cache.get('1508417228624887928');
          if (!targetChannel) {
            try {
              targetChannel = await message.guild.channels.fetch('1508417228624887928');
            } catch (e) {
              targetChannel = message.channel;
            }
          }
        }

        if (targetChannel) {
          await targetChannel.send({ content: `<@${author.id}>`, embeds: [autoDailyEmbed] }).catch(() => { });
        }
      }
    }
  } catch (err) {
    console.error('❌ Gagal memproses klaim gaji harian otomatis:', err.message);
  }

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

  let totalEarned = earnedCoins + investorBonus;

  // 3a. Cek Upgrade Dispenser Air (Peluang 10% double chat earn)
  let dispenserTriggered = false;
  try {
    const kos = require('./kos');
    if (kos.hasUpgrade(author.id, guildId, 'DISPENSER')) {
      if (Math.random() < 0.10) {
        totalEarned *= 2;
        dispenserTriggered = true;
      }
    }
  } catch (err) {
    console.error('Error checking dispenser upgrade:', err.message);
  }

  // 3b. Cek Event Ekonomi: Double Earning Hour
  const events = require('./events');
  const activeEvent = events.getActiveEvent(guildId);
  if (activeEvent && activeEvent.type === 'DOUBLE_EARNING') {
    totalEarned *= 2;
  }

  // 3c. Cek Admin Abuse (Ebyus) Coin Multiplier (3x s/d 8x)
  const ebyus = database.get('SELECT coin_multiplier, expires_at FROM ebyus_settings WHERE guild_id = ?', [guildId]);
  if (ebyus && ebyus.coin_multiplier > 1) {
    const nowUnix = Math.floor(Date.now() / 1000);
    if (ebyus.expires_at > 0 && nowUnix > ebyus.expires_at) {
      // Expired! Reset to 1 in DB
      database.run('UPDATE ebyus_settings SET coin_multiplier = 1, expires_at = 0 WHERE guild_id = ?', [guildId]);
    } else {
      totalEarned *= ebyus.coin_multiplier;
    }
  }

  if (dispenserTriggered) {
    message.react('🥤').catch(() => { });
  }

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
  // console.log(`💰 [Economy] ${author.tag} dapat Rp ${totalEarned} (${earnedCoins} base + ${investorBonus} bonus investor + double earning) di #${message.channel.name}`);
}

/**
 * Helper untuk menangani perintah sewa kamar kosan.
 */
async function handleKosSewaCommand(message, client) {
  const { guildId, author } = message;
  const kos = require('./kos');

  const getSewaPanelData = (userId, guildId) => {
    const currentRental = kos.getActiveRental(userId, guildId);
    const embed = embeds.kosRoomListEmbed(currentRental);

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('kos_select_room')
      .setPlaceholder('👉 Pilih kasta kamar untuk disewa...')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('💨 Kamar Kipas Angin (Rp 150)')
          .setDescription('Bonus Daily +Rp 5 | Durasi 3 Hari')
          .setValue('KIPAS'),
        new StringSelectMenuOptionBuilder()
          .setLabel('❄️ Kamar AC (Rp 350)')
          .setDescription('Bonus Daily +Rp 15 | Pajak Transfer 8% | 3 Hari')
          .setValue('AC'),
        new StringSelectMenuOptionBuilder()
          .setLabel('👑 Penthouse Kosan (Rp 800)')
          .setDescription('Daily +Rp 40 | Pajak Transfer 5% | Pajak Jual Saham 10%')
          .setValue('PENTHOUSE')
      );

    const selectRow = new ActionRowBuilder().addComponents(selectMenu);
    const cancelBtn = new ButtonBuilder()
      .setCustomId('kos_btn_cancel_sewa')
      .setLabel('✖️ Batalkan')
      .setStyle(ButtonStyle.Secondary);
    const cancelRow = new ActionRowBuilder().addComponents(cancelBtn);

    return { embeds: [embed], components: [selectRow, cancelRow] };
  };

  const initialData = getSewaPanelData(author.id, guildId);
  const replyMsg = await message.reply(initialData);

  const collector = replyMsg.createMessageComponentCollector({
    time: 120000
  });

  collector.on('collect', async iSewa => {
    if (iSewa.user.id !== author.id) {
      return iSewa.reply({ content: '❌ Tombol ini bukan untuk Anda!', flags: 64 });
    }

    try {
      if (iSewa.customId === 'kos_btn_cancel_sewa') {
        collector.stop();
        await iSewa.update({ content: '❌ Transaksi persewaan kamar dibatalkan.', embeds: [], components: [] });
      } else if (iSewa.customId === 'kos_select_room') {
        collector.stop();
        const selectedRoom = iSewa.values[0];

        try {
          const res = kos.rentRoom(author.id, guildId, selectedRoom);
          const dueText = `<t:${res.endsAt}:F> (<t:${res.endsAt}:R>)`;

          const successEmb = embeds.kosSuccessReceiptEmbed(
            'Transaksi Persewaan Kamar Berhasil! 🛌',
            `Selamat! Kamu resmi menyewa **${res.name}**!\n\n` +
            `💰 **Harga Sewa:** **Rp ${res.price.toLocaleString('id-ID')}**\n` +
            `📅 **Masa Aktif s/d:** ${dueText}\n\n` +
            `📉 Sisa saldo dompetmu sekarang adalah **Rp ${res.walletBalance.toLocaleString('id-ID')}**.\n` +
            `👉 *Ketik \`.kos\` untuk melihat status kamar barumu!*`
          );

          await iSewa.update({ embeds: [successEmb], components: [] });
        } catch (err) {
          const errorEmb = embeds.errorEmbed('Penyewaan Kamar Gagal!', err.message);
          await iSewa.update({ embeds: [errorEmb], components: [] });
        }
      }
    } catch (err) {
      console.error('Error in room sewa collector:', err);
    }
  });

  collector.on('end', async () => {
    if (collector.destroyed) return;
    const freshData = getSewaPanelData(author.id, guildId);
    freshData.components = [];
    await replyMsg.edit(freshData).catch(() => { });
  });
}

/**
 * Helper untuk menangani perintah upgrade fasilitas kosan.
 */
async function handleKosUpgradeCommand(message, client) {
  const { guildId, author } = message;
  const kos = require('./kos');

  const getUpgradePanelData = (userId, guildId) => {
    const ownedUpgrades = kos.getUpgrades(userId, guildId);
    const embed = embeds.kosUpgradeListEmbed(ownedUpgrades);

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('kos_select_upgrade')
      .setPlaceholder('👉 Pilih furniture/fasilitas untuk dibeli...');

    const upgradesConfig = config.kos.UPGRADES;
    Object.keys(upgradesConfig).forEach(key => {
      const up = upgradesConfig[key];
      const isOwned = ownedUpgrades.some(o => o.id === up.id);

      selectMenu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(`${up.name} (${isOwned ? 'Miliki' : `Rp ${up.price}`})`)
          .setDescription(up.desc.substring(0, 100))
          .setValue(up.id)
      );
    });

    const selectRow = new ActionRowBuilder().addComponents(selectMenu);
    const cancelBtn = new ButtonBuilder()
      .setCustomId('kos_btn_cancel_upgrade')
      .setLabel('✖️ Batalkan')
      .setStyle(ButtonStyle.Secondary);
    const cancelRow = new ActionRowBuilder().addComponents(cancelBtn);

    return { embeds: [embed], components: [selectRow, cancelRow] };
  };

  const initialData = getUpgradePanelData(author.id, guildId);
  const replyMsg = await message.reply(initialData);

  const collector = replyMsg.createMessageComponentCollector({
    time: 120000
  });

  collector.on('collect', async iUpgrade => {
    if (iUpgrade.user.id !== author.id) {
      return iUpgrade.reply({ content: '❌ Tombol ini bukan untuk Anda!', flags: 64 });
    }

    try {
      if (iUpgrade.customId === 'kos_btn_cancel_upgrade') {
        collector.stop();
        await iUpgrade.update({ content: '❌ Transaksi belanja fasilitas dibatalkan.', embeds: [], components: [] });
      } else if (iUpgrade.customId === 'kos_select_upgrade') {
        collector.stop();
        const selectedUpgrade = iUpgrade.values[0];

        try {
          const res = kos.buyUpgrade(author.id, guildId, selectedUpgrade);

          const successEmb = embeds.kosSuccessReceiptEmbed(
            'Transaksi Belanja Fasilitas Berhasil! 🛒',
            `Selamat! Kamu berhasil membeli fasilitas **${res.name}**!\n\n` +
            `💰 **Harga Beli:** **Rp ${res.price.toLocaleString('id-ID')}**\n` +
            `✨ **Status:** Terpasang secara permanen di kamarmu.\n\n` +
            `📉 Sisa saldo dompetmu sekarang adalah **Rp ${res.walletBalance.toLocaleString('id-ID')}**.\n` +
            `👉 *Ketik \`.kos\` untuk melihat status kamarmu saat ini!*`
          );

          await iUpgrade.update({ embeds: [successEmb], components: [] });
        } catch (err) {
          const errorEmb = embeds.errorEmbed('Belanja Fasilitas Gagal!', err.message);
          await iUpgrade.update({ embeds: [errorEmb], components: [] });
        }
      }
    } catch (err) {
      console.error('Error in upgrade collector:', err);
    }
  });

  collector.on('end', async () => {
    if (collector.destroyed) return;
    const freshData = getUpgradePanelData(author.id, guildId);
    freshData.components = [];
    await replyMsg.edit(freshData).catch(() => { });
  });
}

/**
 * Helper untuk menampilkan dan memproses Dashboard Pet Tamagotchi
 */
async function handlePetCommand(message, client, args) {
  const { guildId, author, guild } = message;
  const subCommand = args[0] ? args[0].toLowerCase() : null;

  // ── SUB-PERINTAH: ANNOUNCEMENT / INFO ──
  if (subCommand === 'announcement' || subCommand === 'anoncemen' || subCommand === 'info') {
    const petInfoEmbed = embeds.petAnnouncementEmbed(message.guild);
    return message.reply({ embeds: [petInfoEmbed] });
  }

  // ── SUB-PERINTAH: LIST / DAFTAR ──
  if (subCommand === 'list' || subCommand === 'daftar') {
    const pets = pet.getPetsList(author.id, guildId);
    const listEmbed = embeds.petListEmbed(author, pets);
    return message.reply({ embeds: [listEmbed] });
  }

  // ── SUB-PERINTAH: TOP / LEADERBOARD ──
  if (subCommand === 'top' || subCommand === 'leaderboard') {
    const embed = embeds.warnEmbed(
      'Papan Peringkat Pet Dinonaktifkan! ❌',
      'Perintah `.pet top` manual sudah tidak digunakan lagi.\n\n👉 Silakan lihat papan peringkat realtime terbaru di channel: <#1510232295448117308>!'
    );
    return message.reply({ embeds: [embed] });
  }

  // ── SUB-PERINTAH: SWITCH / AKTIF ──
  if (subCommand === 'switch' || subCommand === 'aktif') {
    const targetName = args[1];
    if (!targetName) {
      return message.reply({ embeds: [embeds.warnEmbed('Format Salah!', 'Format: `.pet switch <nama>`\nContoh: `.pet switch Ciko`')] });
    }
    try {
      const res = pet.switchActivePet(author.id, guildId, targetName);
      const successEmb = embeds.successEmbed('Peliharaan Aktif Diubah! 🐾', `Berhasil mengaktifkan pet **${res.pet_name}** the **${res.pet_type}** sebagai peliharaan utama Anda.`);
      return message.reply({ embeds: [successEmb] });
    } catch (err) {
      return message.reply({ embeds: [embeds.errorEmbed('Gagal Mengubah Pet Aktif!', err.message)] });
    }
  }

  // ── SUB-PERINTAH: BUY / ADOPT ──
  if (subCommand === 'buy' || subCommand === 'adopt') {
    const petName = args[1];
    const petType = args[2];
    if (!petName || !petType) {
      return message.reply({ embeds: [embeds.warnEmbed('Format Salah!', 'Format: `.pet buy <nama> <slime/dragon/cat/golem>`\nContoh: `.pet buy Ciko Dragon`')] });
    }
    try {
      const res = pet.adoptPet(author.id, guildId, petName, petType);
      const successEmb = embeds.successEmbed('Adopsi Sukses! 🥚', `Selamat! Telur pet **${res.pet_name}** the **${res.pet_type}** berhasil dibeli seharga **Rp 1.500**!\n⏳ Telur akan menetas <t:${res.hatch_at}:R>. Ketik \`.pet\` untuk merawat.`);
      return message.reply({ embeds: [successEmb] });
    } catch (err) {
      return message.reply({ embeds: [embeds.errorEmbed('Adopsi Gagal!', err.message)] });
    }
  }

  // ── SUB-PERINTAH: SHOP ──
  if (subCommand === 'shop') {
    return handlePetShopCommand(message, client);
  }

  // ── SUB-PERINTAH: IMAGE / SETIMAGE ──
  if (subCommand === 'image' || subCommand === 'setimage') {
    const { PermissionsBitField } = require('discord.js');
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply({ embeds: [embeds.errorEmbed('Akses Ditolak!', 'Perintah ini hanya dapat digunakan oleh Administrator server.')] });
    }

    const url = args[1];
    if (!url) {
      return message.reply({ embeds: [embeds.warnEmbed('Format Salah!', 'Format: `.pet image <link_gambar_atau_gif>`\nContoh: `.pet image https://i.imgur.com/xxx.gif`\nAtau ketik `.pet image reset` untuk mengembalikan ke gambar bawaan.')] });
    }
    try {
      const savedUrl = pet.setCustomImage(author.id, guildId, url);
      let desc = '';
      if (savedUrl) {
        desc = `Berhasil mengubah gambar pet aktif Anda!\n\n**Preview URL:**\n${savedUrl}`;
      } else {
        desc = `Berhasil menghapus gambar kustom. Pet Anda sekarang kembali menggunakan aset gambar bawaan sistem.`;
      }
      const successEmb = embeds.successEmbed('Update Gambar Pet Sukses! 📸', desc);
      if (savedUrl) successEmb.setImage(savedUrl);
      return message.reply({ embeds: [successEmb] });
    } catch (err) {
      return message.reply({ embeds: [embeds.errorEmbed('Update Gambar Gagal!', err.message)] });
    }
  }

  // ── SUB-PERINTAH: BUY-ITEM ──
  if (subCommand === 'buy-item') {
    const itemId = args[1];
    const qty = parseInt(args[2] || 1);
    if (!itemId) {
      return message.reply({ embeds: [embeds.warnEmbed('Format Salah!', 'Format: `.pet buy-item <item_id> [jumlah]`\nContoh: `.pet buy-item water 3`')] });
    }
    try {
      const res = pet.buyItem(author.id, guildId, itemId, qty);
      const successEmb = embeds.successEmbed('Pembelian Sukses! 🛒', `Berhasil membeli **${qty} pcs ${res.item.name}** seharga **Rp ${res.totalPrice.toLocaleString('id-ID')}**!\n📦 Persediaan Anda saat ini: \`${res.newInventoryQty} pcs\`.`);
      return message.reply({ embeds: [successEmb] });
    } catch (err) {
      return message.reply({ embeds: [embeds.errorEmbed('Pembelian Gagal!', err.message)] });
    }
  }

  // ── SUB-PERINTAH: WORK ──
  if (subCommand === 'work') {
    try {
      const res = pet.sendToWork(author.id, guildId);
      const successEmb = embeds.successEmbed('Pet Selesai Bekerja! 💼', `**${res.pet.pet_name}** berhasil mengumpulkan upah kerja sebesar **Rp ${res.reward.toLocaleString('id-ID')}**!\n📈 Bonus Level: \`+Rp ${res.levelBonus}\`\n📊 Status Baru: Kenyangan \`${res.pet.hunger}%\`, Hidrasi \`${res.pet.thirst}%\`, Kebahagiaan \`${res.pet.happiness}%\`.`);
      return message.reply({ embeds: [successEmb] });
    } catch (err) {
      return message.reply({ embeds: [embeds.errorEmbed('Kerja Gagal!', err.message)] });
    }
  }

  // ── SUB-PERINTAH: HUNT ──
  if (subCommand === 'hunt') {
    try {
      const res = pet.sendToHunt(author.id, guildId);
      let dropText = '';
      if (res.dropItem) {
        dropText = `\n🎁 **JACKPOT DROP LANGKA:** Menemukan **1x ${res.dropItem.name}** gratis!`;
      }
      const successEmb = embeds.successEmbed('Pet Selesai Berburu! 🏹', `**${res.pet.pet_name}** berhasil menyelesaikan perburuan di hutan liar dan membawa pulang uang sebesar **Rp ${res.reward.toLocaleString('id-ID')}**!${dropText}\n📊 Status Baru: Kenyangan \`${res.pet.hunger}%\`, Hidrasi \`${res.pet.thirst}%\`, HP \`${res.pet.health}%\`.`);
      return message.reply({ embeds: [successEmb] });
    } catch (err) {
      return message.reply({ embeds: [embeds.errorEmbed('Berburu Gagal!', err.message)] });
    }
  }

  // ── SUB-PERINTAH: PLAY ──
  if (subCommand === 'play') {
    try {
      const res = pet.playWithPet(author.id, guildId);
      const successEmb = embeds.successEmbed('Ajak Main Berhasil! ⚽', `Anda bermain lempar bola bersama **${res.pet_name}**!\n📊 Kebahagiaan meningkat: **${res.happiness}%** (+15 XP).`);
      return message.reply({ embeds: [successEmb] });
    } catch (err) {
      return message.reply({ embeds: [embeds.errorEmbed('Gagal Bermain!', err.message)] });
    }
  }

  // ── SUB-PERINTAH: USE / PAKAI ──
  if (subCommand === 'use' || subCommand === 'pakai' || subCommand === 'use-item') {
    const itemId = args[1];
    if (!itemId) {
      return message.reply({ embeds: [embeds.warnEmbed('Format Salah!', 'Format: `.pet use <item_id>`\nContoh: `.pet use XP_2X`')] });
    }
    try {
      const res = pet.useItem(author.id, guildId, itemId, false);
      const successEmb = embeds.successEmbed(
        'Penggunaan Item Sukses! ✨',
        `Berhasil menggunakan **${res.item.name}** pada pet **${res.pet.pet_name}**!\n` +
        (res.item.multiplier ? `📈 Pengali XP Pet Anda sekarang menjadi **${res.item.multiplier}x** secara permanen!` : `📊 Status baru: Kenyangan \`${res.pet.hunger}%\`, Hidrasi \`${res.pet.thirst}%\`, HP \`${res.pet.health}%\`, Kebahagiaan \`${res.pet.happiness}%\`.`)
      );
      return message.reply({ embeds: [successEmb] });
    } catch (err) {
      return message.reply({ embeds: [embeds.errorEmbed('Gagal Menggunakan Item!', err.message)] });
    }
  }

  // ── SUB-PERINTAH: RESET ──
  if (subCommand === 'reset') {
    try {
      pet.resetPet(author.id, guildId);
      const successEmb = embeds.successEmbed('Reset Pet Sukses! 🧹', 'Peliharaan aktif Anda telah di-reset/dihapus. Jika ada pet lain, salah satunya telah diaktifkan otomatis.');
      return message.reply({ embeds: [successEmb] });
    } catch (err) {
      return message.reply({ embeds: [embeds.errorEmbed('Reset Gagal!', err.message)] });
    }
  }

  // ── SUB-PERINTAH: BREED (KAWIN SILANG) ──
  if (subCommand === 'breed') {
    const partnerUser = message.mentions.users.first();
    const newName = args.slice(2).join(' ');

    if (!partnerUser || !newName) {
      return message.reply({ embeds: [embeds.warnEmbed('Format Salah!', 'Format: `.pet breed @user <nama_anak_baru>`\nContoh: `.pet breed @Joe Ciko`')] });
    }

    if (partnerUser.id === author.id) {
      return message.reply({ embeds: [embeds.warnEmbed('Tidak Bisa Breeding!', 'Anda tidak bisa mengawinkan pet dengan diri Anda sendiri!')] });
    }

    const chalPet = pet.getPet(author.id, guildId);
    const partPet = pet.getPet(partnerUser.id, guildId);

    if (!chalPet) return message.reply({ embeds: [embeds.errorEmbed('Breeding Gagal!', 'Anda tidak memiliki pet aktif!')] });
    if (!partPet) return message.reply({ embeds: [embeds.errorEmbed('Breeding Gagal!', 'Partner Anda tidak memiliki pet aktif!')] });

    if (chalPet.status !== 'ADULT') return message.reply({ embeds: [embeds.errorEmbed('Pet Belum Dewasa!', `Pet Anda **${chalPet.pet_name}** belum Dewasa (Lv < 10)!`)] });
    if (partPet.status !== 'ADULT') return message.reply({ embeds: [embeds.errorEmbed('Pet Partner Belum Dewasa!', `Pet partner **${partPet.pet_name}** belum Dewasa (Lv < 10)!`)] });

    const chalWallet = economy.getWallet(author.id, guildId);
    const partWallet = economy.getWallet(partnerUser.id, guildId);

    if (chalWallet.balance < 800) return message.reply({ embeds: [embeds.errorEmbed('Saldo Kurang!', `Saldo Anda tidak mencukupi biaya perkawinan Rp 800!`)] });
    if (partWallet.balance < 800) return message.reply({ embeds: [embeds.errorEmbed('Saldo Partner Kurang!', `Saldo partner Anda tidak mencukupi biaya perkawinan Rp 800!`)] });

    const embed = new EmbedBuilder()
      .setColor(0xFF80AB)
      .setTitle('💕 PENAWARAN PERKAWINAN PET 💕')
      .setDescription(
        `🔔 <@${partnerUser.id}>! Anda mendapatkan tawaran kawin silang dari <@${author.id}>!\n\n` +
        `🦖 **Pet Anda:** **${partPet.pet_name}** (Lv. ${partPet.level} ${partPet.pet_type})\n` +
        `⚔️ **Pet Pengirim:** **${chalPet.pet_name}** (Lv. ${chalPet.level} ${chalPet.pet_type})\n` +
        `💰 **Biaya Masing-masing:** **Rp 800**\n` +
        `🥚 **Nama Telur Anak:** **${newName}**\n\n` +
        `*Klik tombol **🟢 Terima Perjodohan** di bawah untuk memulai breeding. Berlaku selama 60 detik!*`
      )
      .setFooter({ text: 'Rupiah Server Pet Breeding' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('pet_breed_accept').setLabel('🟢 Terima Perjodohan').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('pet_breed_decline').setLabel('🔴 Tolak').setStyle(ButtonStyle.Danger)
    );

    const replyMsg = await message.reply({ content: `<@${partnerUser.id}>`, embeds: [embed], components: [row] });

    const collector = replyMsg.createMessageComponentCollector({ time: 60000 });

    collector.on('collect', async iBreed => {
      if (iBreed.user.id !== partnerUser.id) {
        return iBreed.reply({ content: '❌ Hanya penerima tawaran yang bisa merespon tombol ini!', flags: 64 });
      }

      try {
        if (iBreed.customId === 'pet_breed_decline') {
          collector.stop();
          await replyMsg.delete().catch(() => { });
          return iBreed.reply({ content: `🔴 <@${author.id}>, tawaran perkawinan pet Anda ditolak oleh <@${partnerUser.id}>.` });
        }

        if (iBreed.customId === 'pet_breed_accept') {
          collector.stop();
          await replyMsg.delete().catch(() => { });

          try {
            const res = pet.breedPets(author.id, partnerUser.id, guildId, newName);
            const successEmb = new EmbedBuilder()
              .setColor(0xFF80AB)
              .setTitle('🎉 PERKAWINAN PET BERHASIL! 🎉')
              .setDescription(
                `💕 Perkawinan antara **${chalPet.pet_name}** and **${partPet.pet_name}** sukses!\n\n` +
                `🥚 **Lahir Telur Baru:** **${res.childName}** (Tipe: \`${res.childType}\`)\n` +
                `✨ **Trait Warisan:** ${res.trait ? `**${res.trait}**` : '*Tidak ada trait khusus*'}\n` +
                `⏳ **Penetasan Telur:** Telur akan menetas <t:${res.hatchAt}:R>.\n\n` +
                `💸 Saldo masing-masing terpotong **Rp 800** untuk biaya perkawinan.`
              )
              .setFooter({ text: 'Gunakan .pet untuk melihat kandang Anda!' })
              .setTimestamp();

            return iBreed.reply({ content: `<@${author.id}> <@${partnerUser.id}>`, embeds: [successEmb] });
          } catch (err) {
            return iBreed.reply({ embeds: [embeds.errorEmbed('Breeding Gagal!', err.message)] });
          }
        }
      } catch (err) {
        console.error('Error in breed collector:', err);
      }
    });

    collector.on('end', async () => {
      if (collector.destroyed) return;
      await replyMsg.delete().catch(() => { });
    });

    return;
  }

  // ── SUB-PERINTAH: EXPEDITION (EKSPEDISI PVE) ──
  if (subCommand === 'expedition' || subCommand === 'pet-expedition' || subCommand === 'expidition') {
    const activeLobby = client.activeExpeditions = client.activeExpeditions || new Map();
    if (activeLobby.has(guildId)) {
      return message.reply({ embeds: [embeds.warnEmbed('Lobi Aktif!', 'Lobi ekspedisi pet sudah berjalan di server ini!')] });
    }

    const initiatorPet = pet.getPet(author.id, guildId);
    if (!initiatorPet || initiatorPet.status === 'DEAD' || initiatorPet.status === 'EGG') {
      return message.reply({ embeds: [embeds.errorEmbed('Gagal Memulai!', 'Peliharaan aktif Anda sedang mati, berupa telur, atau Anda tidak memilikinya!')] });
    }
    if (initiatorPet.health < 40) {
      return message.reply({ embeds: [embeds.errorEmbed('HP Kurang!', `Pet Anda **${initiatorPet.pet_name}** terlalu lelah/sakit (HP ${initiatorPet.health}% < 40) untuk ekspedisi!`)] });
    }

    try {
      pet.checkExpeditionLimit(author.id, guildId, true); // dryRun = true
    } catch (err) {
      return message.reply({ embeds: [embeds.errorEmbed('Batas Ekspedisi Tercapai!', err.message)] });
    }

    const wallet = economy.getWallet(author.id, guildId);
    if (wallet.balance < 150) {
      return message.reply({ embeds: [embeds.errorEmbed('Saldo Kurang!', `Anda memerlukan minimal Rp 150 untuk biaya ransum ekspedisi!`)] });
    }

    economy.subtractBalance(author.id, guildId, 150, 'PET_EXPEDITION_FEE');

    const lobby = {
      guildId,
      initiatorId: author.id,
      participants: [author.id],
      timeout: null
    };
    activeLobby.set(guildId, lobby);

    const lobbyEmbed = new EmbedBuilder()
      .setColor(0x3F51B5)
      .setTitle('🛡️ EKSPEDISI BERSAMA TIM PET 🛡️')
      .setDescription(
        `🚨 **LOBI EKSPEDISI PET TELAH DIBUKA!** 🚨\n\n` +
        `Persiapkan pet terkuat Anda untuk menghadapi ancaman bos penjaga zona!\n\n` +
        `👤 **Otak Ekspedisi:** <@${author.id}>\n` +
        `🦖 **Kru Pet Saat Ini:**\n` +
        `1️⃣ **${initiatorPet.pet_name}** (Lv. ${initiatorPet.level} ${initiatorPet.pet_type}) - <@${author.id}>\n\n` +
        `💰 **Biaya Ransum:** Rp 150 koin per orang\n` +
        `⏳ **Waktu Berkumpul:** **90 detik**\n\n` +
        `*Klik tombol **🛡️ Ikut Ekspedisi** untuk bergabung!*`
      )
      .setFooter({ text: 'Rupiah Server Pet Expedition PVE' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('pet_exp_join').setLabel('🛡️ Ikut Ekspedisi').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('pet_exp_cancel').setLabel('✖️ Batalkan').setStyle(ButtonStyle.Danger)
    );

    const replyMsg = await message.reply({ content: `📣 **Ekspedisi Tim Pet dibuka!** Bersiaplah!`, embeds: [lobbyEmbed], components: [row] });

    let timeLeft = 90;
    const interval = setInterval(async () => {
      timeLeft -= 10;
      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      const currentLobby = activeLobby.get(guildId);
      if (!currentLobby) {
        clearInterval(interval);
        return;
      }

      let petListText = '';
      currentLobby.participants.forEach((pId, idx) => {
        const pObj = pet.getPet(pId, guildId);
        petListText += `${idx + 1}️⃣ **${pObj.pet_name}** (Lv. ${pObj.level} ${pObj.pet_type}) - <@${pId}>\n`;
      });

      const updatedEmbed = new EmbedBuilder()
        .setColor(0x3F51B5)
        .setTitle('🛡️ EKSPEDISI BERSAMA TIM PET 🛡️')
        .setDescription(
          `🚨 **LOBI EKSPEDISI PET TELAH DIBUKA!** 🚨\n\n` +
          `👤 **Otak Ekspedisi:** <@${author.id}>\n` +
          `🦖 **Kru Pet Saat Ini:**\n${petListText}\n` +
          `💰 **Biaya Ransum:** Rp 150 koin\n` +
          `⏳ **Waktu Tersisa:** **${timeLeft} detik**\n\n` +
          `*Klik tombol **🛡️ Ikut Ekspedisi** untuk bergabung!*`
        )
        .setFooter({ text: 'Rupiah Server Pet Expedition PVE' })
        .setTimestamp();

      await replyMsg.edit({ embeds: [updatedEmbed] }).catch(() => { });
    }, 10000);

    lobby.timeout = setTimeout(async () => {
      clearInterval(interval);
      activeLobby.delete(guildId);

      const currentLobby = lobby;
      try {
        const res = pet.executeExpedition(guildId, currentLobby.participants);

        let reportDesc = '';
        res.logs.forEach(log => {
          reportDesc += `${log}\n`;
        });
        reportDesc += '\n📊 **Hasil Petualangan:**\n';
        res.rewards.forEach(r => {
          reportDesc += `🦖 **${r.petName}** (<@${r.userId}>):\n` +
            `  • Koin Didapat: **+Rp ${r.koin}**\n` +
            `  • XP Didapat: **+${r.xpGained} XP**${r.levelUp ? ` (Naik ke Lv. ${r.newLevel}! 🎉)` : ''}\n` +
            `  • Item Ditemukan: ${r.dropItem ? `✨ **${r.dropItem}**` : '*Tidak ada*'}\n\n`;
        });

        const resultEmbed = new EmbedBuilder()
          .setColor(res.success ? 0x4CAF50 : 0xF44336)
          .setTitle(`⚔️ EXPEDITION REPORT: ${res.zoneName} ⚔️`)
          .setDescription(reportDesc)
          .addFields(
            { name: 'Kombinasi Level Tim', value: `Lv. ${res.teamPower}`, inline: true },
            { name: 'Peluang Sukses', value: `${res.successRate}%`, inline: true }
          )
          .setFooter({ text: 'Rupiah Server Pet Expedition' })
          .setTimestamp();

        await replyMsg.edit({
          content: `⚔️ **EKSPEDISI PET SELESAI!**`,
          embeds: [resultEmbed],
          components: []
        }).catch(async () => {
          await message.channel.send({
            content: `⚔️ **EKSPEDISI PET SELESAI!**`,
            embeds: [resultEmbed]
          });
        });
      } catch (err) {
        console.error(err);
        await message.channel.send({ content: `❌ Ekspedisi gagal diselesaikan: ${err.message}` });
      }
    }, 90000);

    const collector = replyMsg.createMessageComponentCollector({ time: 90000 });

    collector.on('collect', async iExp => {
      try {
        if (iExp.customId === 'pet_exp_join') {
          const currentLobby = activeLobby.get(guildId);
          if (!currentLobby) return iExp.reply({ content: '❌ Lobi ekspedisi sudah berakhir!', flags: 64 });

          if (currentLobby.participants.includes(iExp.user.id)) {
            return iExp.reply({ content: '❌ Anda sudah bergabung dalam lobi ini!', flags: 64 });
          }

          const userPet = pet.getPet(iExp.user.id, guildId);
          if (!userPet || userPet.status === 'DEAD' || userPet.status === 'EGG') {
            return iExp.reply({ content: '❌ Peliharaan aktif Anda sedang mati, berupa telur, atau Anda tidak memilikinya!', flags: 64 });
          }
          if (userPet.health < 40) {
            return iExp.reply({ content: `❌ Pet Anda **${userPet.pet_name}** terlalu lelah/sakit (HP ${userPet.health}% < 40) untuk ekspedisi!`, flags: 64 });
          }

          try {
            pet.checkExpeditionLimit(iExp.user.id, guildId, true); // dryRun = true
          } catch (err) {
            return iExp.reply({ content: `❌ ${err.message}`, flags: 64 });
          }

          const userWallet = economy.getWallet(iExp.user.id, guildId);
          if (userWallet.balance < 150) {
            return iExp.reply({ content: '❌ Saldo Anda kurang untuk membayar biaya ransum Rp 150!', flags: 64 });
          }

          economy.subtractBalance(iExp.user.id, guildId, 150, 'PET_EXPEDITION_FEE');
          currentLobby.participants.push(iExp.user.id);

          await iExp.reply({ content: '🛡️ Berhasil bergabung dengan tim ekspedisi pet!', flags: 64 });

          let petListText = '';
          currentLobby.participants.forEach((pId, idx) => {
            const pObj = pet.getPet(pId, guildId);
            petListText += `${idx + 1}️⃣ **${pObj.pet_name}** (Lv. ${pObj.level} ${pObj.pet_type}) - <@${pId}>\n`;
          });

          const updatedEmbed = new EmbedBuilder()
            .setColor(0x3F51B5)
            .setTitle('🛡️ EKSPEDISI BERSAMA TIM PET 🛡️')
            .setDescription(
              `🚨 **LOBI EKSPEDISI PET TELAH DIBUKA!** 🚨\n\n` +
              `👤 **Otak Ekspedisi:** <@${author.id}>\n` +
              `🦖 **Kru Pet Saat Ini:**\n${petListText}\n` +
              `💰 **Biaya Ransum:** Rp 150 koin\n` +
              `⏳ **Waktu Tersisa:** **${timeLeft} detik**\n\n` +
              `*Klik tombol **🛡️ Ikut Ekspedisi** untuk bergabung!*`
            )
            .setFooter({ text: 'Rupiah Server Pet Expedition PVE' })
            .setTimestamp();

          await replyMsg.edit({ embeds: [updatedEmbed] }).catch(() => { });
        }

        else if (iExp.customId === 'pet_exp_cancel') {
          if (iExp.user.id !== author.id) {
            return iExp.reply({ content: '❌ Hanya pembuat lobi ekspedisi yang bisa membatalkan!', flags: 64 });
          }

          clearInterval(interval);
          clearTimeout(lobby.timeout);
          activeLobby.delete(guildId);

          currentLobby.participants.forEach(pId => {
            economy.addBalance(pId, guildId, 150, 'PET_EXPEDITION_REFUND');
          });

          await iExp.reply({ content: '❌ Ekspedisi dibatalkan dan biaya ransum telah dikembalikan ke seluruh kru pet.', ephemeral: false });
          await replyMsg.edit({
            content: '❌ **Ekspedisi tim pet dibatalkan oleh pembuat lobi.**',
            embeds: [],
            components: []
          }).catch(() => { });
          collector.stop();
        }
      } catch (err) {
        await iExp.reply({ content: `❌ Terjadi kesalahan: ${err.message}`, flags: 64 });
      }
    });

    collector.on('end', () => {
      clearInterval(interval);
    });

    return;
  }

  // ── SUB-PERINTAH: PVP ──
  if (subCommand === 'pvp') {
    const opponent = message.mentions.users.first();
    const bet = parseInt(args[2]);
    if (!opponent || isNaN(bet) || bet <= 0) {
      return message.reply({ embeds: [embeds.warnEmbed('Format Salah!', 'Format: `.pet pvp @user <taruhan_koin>`\nContoh: `.pet pvp @Joefany 1000`')] });
    }
    return handlePetPvPCommand(message, opponent, bet, client);
  }

  // ── DEFAULT: DASHBOARD UTAMA DENGAN TOMBOL INTERAKTIF ──
  const getDashboardPanel = (userId, guildId) => {
    const userPet = pet.getPet(userId, guildId);
    const inventory = pet.getInventory(userId, guildId);
    const allPets = pet.getPetsList(userId, guildId);

    const embed = embeds.petDashboardEmbed(author, userPet, inventory);

    const rows = [];
    const canAdoptMore = allPets.length < 3;

    if (!userPet) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('pet_btn_nav_adopt').setLabel('🛎️ Adopsi Telur Pet').setStyle(ButtonStyle.Success)
      );
      rows.push(row);
    } else if (userPet.status === 'EGG') {
      const now = Math.floor(Date.now() / 1000);
      const isHatched = userPet.hatch_at <= now;
      const eggComponents = [
        new ButtonBuilder().setCustomId('pet_btn_hatch').setLabel('🐣 Tetaskan Telur').setStyle(ButtonStyle.Success).setDisabled(!isHatched)
      ];
      if (canAdoptMore) {
        eggComponents.push(new ButtonBuilder().setCustomId('pet_btn_nav_adopt').setLabel('🛎️ Adopsi (+)').setStyle(ButtonStyle.Success));
      }
      eggComponents.push(new ButtonBuilder().setCustomId('pet_btn_refresh').setLabel('🔄 Segarkan').setStyle(ButtonStyle.Secondary));

      const row = new ActionRowBuilder().addComponents(eggComponents);
      rows.push(row);
    } else if (userPet.status === 'DEAD') {
      const deadComponents = [
        new ButtonBuilder().setCustomId('pet_btn_reset').setLabel('🧹 Sapu/Reset Kandang').setStyle(ButtonStyle.Danger)
      ];
      if (canAdoptMore) {
        deadComponents.push(new ButtonBuilder().setCustomId('pet_btn_nav_adopt').setLabel('🛎️ Adopsi (+)').setStyle(ButtonStyle.Success));
      }
      const row = new ActionRowBuilder().addComponents(deadComponents);
      rows.push(row);
    } else {
      // Pet Hidup (Baby / Adult)
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('pet_btn_feed').setLabel('🍗 Makan').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('pet_btn_drink').setLabel('🥤 Minum').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('pet_btn_play').setLabel('⚽ Main').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('pet_btn_cure').setLabel('💊 Obat').setStyle(ButtonStyle.Danger)
      );

      const row2Components = [
        new ButtonBuilder().setCustomId('pet_btn_work').setLabel('💼 Kerja').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('pet_btn_hunt').setLabel('🏹 Berburu').setStyle(ButtonStyle.Secondary).setDisabled(userPet.level < 10 && userPet.status !== 'ADULT'),
        new ButtonBuilder().setCustomId('pet_btn_nav_shop').setLabel('🎒 Toko Pet').setStyle(ButtonStyle.Primary)
      ];

      if (canAdoptMore) {
        row2Components.push(new ButtonBuilder().setCustomId('pet_btn_nav_adopt').setLabel('🛎️ Adopsi (+)').setStyle(ButtonStyle.Success));
      }

      const row2 = new ActionRowBuilder().addComponents(row2Components);

      const row3Components = [
        new ButtonBuilder()
          .setCustomId('pet_btn_toggle_auto_feed')
          .setLabel(userPet.auto_feed === 1 ? '🤖 Auto Care: AKTIF' : '🤖 Auto Care: NONAKTIF')
          .setStyle(userPet.auto_feed === 1 ? ButtonStyle.Success : ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('pet_btn_use_booster').setLabel('⚡ Pakai Booster').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('pet_btn_refresh').setLabel('🔄 Refresh').setStyle(ButtonStyle.Secondary)
      ];
      const row3 = new ActionRowBuilder().addComponents(row3Components);

      rows.push(row1, row2, row3);
    }

    // Tambahkan Select Menu jika memiliki lebih dari 1 pet
    if (allPets.length > 1) {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('pet_select_active')
        .setPlaceholder('🐾 Ganti Peliharaan Aktif...');

      allPets.forEach(p => {
        const isCurrent = p.is_active === 1;
        const emoji = p.pet_type === 'SLIME' ? '🟢' : p.pet_type === 'DRAGON' ? '🔥' : p.pet_type === 'CAT' ? '🐱' : '🧱';
        selectMenu.addOptions({
          label: `${p.pet_name} the ${p.pet_type.charAt(0) + p.pet_type.slice(1).toLowerCase()} (Lv. ${p.level})`,
          description: isCurrent ? 'Peliharaan aktif saat ini' : 'Klik untuk mengaktifkan peliharaan ini',
          value: p.pet_name,
          emoji: emoji,
          default: isCurrent
        });
      });

      rows.push(new ActionRowBuilder().addComponents(selectMenu));
    }

    return { embeds: [embed], components: rows };
  };

  const initialData = getDashboardPanel(author.id, guildId);
  const replyMsg = await message.reply(initialData);

  const collector = replyMsg.createMessageComponentCollector({
    time: 180000 // 3 menit interaktif
  });

  collector.on('collect', async iPet => {
    if (iPet.user.id !== author.id) {
      return iPet.reply({ content: '❌ Tombol ini bukan untuk Anda!', flags: 64 });
    }

    try {
      if (iPet.customId === 'pet_btn_refresh') {
        const freshData = getDashboardPanel(author.id, guildId);
        await iPet.update(freshData);
      }

      else if (iPet.customId === 'pet_btn_toggle_auto_feed') {
        const result = pet.toggleAutoFeed(author.id, guildId);
        const statusStr = result.autoFeed === 1 ? 'AKTIF 🟢 (langsung potong saldo)' : 'NONAKTIF 🔴';
        await iPet.reply({ embeds: [embeds.successEmbed('Auto Care! 🤖', `Fitur Auto Makan & Minum pet **${result.petName}** sekarang **${statusStr}**.`)] , flags: 64 });
        await replyMsg.edit(getDashboardPanel(author.id, guildId)).catch(() => { });
      }

      else if (iPet.customId === 'pet_btn_use_booster') {
        try {
          const freshPet = pet.getPet(author.id, guildId);
          if (!freshPet) {
            return iPet.reply({ content: '❌ Anda tidak memiliki pet aktif!', flags: 64 });
          }
          const inv = pet.getInventory(author.id, guildId);
          const boosters = inv.filter(item => item.multiplier && item.quantity > 0);

          if (boosters.length === 0) {
            return iPet.reply({
              embeds: [embeds.warnEmbed(
                'Tidak Ada Booster! ❌',
                'Anda tidak memiliki item XP Booster di persediaan pet Anda!\n\n' +
                '🛒 *Beli di **🎒 Toko Pet** terlebih dahulu untuk mempercepat kenaikan level pet Anda secara permanen!*'
              )],
              flags: 64
            });
          }

          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('pet_select_booster_use')
            .setPlaceholder('⚡ Pilih XP Booster yang ingin digunakan...');

          boosters.forEach(item => {
            selectMenu.addOptions(
              new StringSelectMenuOptionBuilder()
                .setLabel(`${item.name} (${item.quantity} pcs)`)
                .setDescription(`Aktifkan pengali XP ${item.multiplier}x secara permanen`)
                .setValue(item.id)
            );
          });

          const row = new ActionRowBuilder().addComponents(selectMenu);
          const boosterEmbed = new EmbedBuilder()
            .setColor(0x7C4DFF)
            .setTitle('⚡ PAKAI XP BOOSTER PET ⚡')
            .setDescription(
              `Silakan pilih item XP Booster yang ingin Anda gunakan untuk pet aktif Anda (**${freshPet.pet_name}**):\n\n` +
              `📊 **Pengali XP Saat Ini:** **${freshPet.xp_multiplier || 1.0}x**\n\n` +
              `*Penggunaan booster akan mengganti pengali XP pet Anda secara permanen dengan nilai yang lebih tinggi.*`
            )
            .setTimestamp();

          const subPrivateMsg = await iPet.reply({ embeds: [boosterEmbed], components: [row], flags: 64 });
          const boosterCollector = subPrivateMsg.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 60000
          });

          boosterCollector.on('collect', async iBooster => {
            if (iBooster.user.id !== author.id) return;
            const selectedBoosterId = iBooster.values[0];

            try {
              const res = pet.useItem(author.id, guildId, selectedBoosterId, false);
              const successEmb = embeds.successEmbed(
                'Penggunaan Booster Sukses! ⚡',
                `Berhasil mengaktifkan **${res.item.name}** pada pet **${res.pet.pet_name}**!\n\n` +
                `📈 Pengali XP Pet Anda sekarang menjadi **${res.item.multiplier}x** secara permanen!`
              );
              await iBooster.update({ embeds: [successEmb], components: [] });
              await replyMsg.edit(getDashboardPanel(author.id, guildId)).catch(() => {});
            } catch (err) {
              await iBooster.update({ embeds: [embeds.errorEmbed('Gagal Menggunakan Booster!', err.message)], components: [] });
            }
          });
        } catch (err) {
          await iPet.reply({ embeds: [embeds.errorEmbed('Gagal Membuka Menu Booster!', err.message)], flags: 64 });
        }
      }

      else if (iPet.customId === 'pet_btn_reset') {
        collector.stop();
        pet.resetPet(author.id, guildId);
        await iPet.update({ content: '🧹 Kandang dibersihkan!', embeds: [], components: [] });
      }

      else if (iPet.customId === 'pet_select_active') {
        const selectedName = iPet.values[0];
        try {
          pet.switchActivePet(author.id, guildId, selectedName);
          const freshData = getDashboardPanel(author.id, guildId);
          await iPet.update(freshData);
        } catch (err) {
          await iPet.reply({ embeds: [embeds.errorEmbed('Gagal Ganti Pet!', err.message)], flags: 64 });
        }
      }

      else if (iPet.customId === 'pet_btn_nav_adopt') {
        // Tampilkan Modal Adopsi
        const modal = new ModalBuilder()
          .setCustomId('pet_modal_adopt')
          .setTitle('🛎️ Adopsi Telur Pet Tamagotchi');

        const nameInput = new TextInputBuilder()
          .setCustomId('pet_name')
          .setLabel('Nama Pet Anda')
          .setPlaceholder('Contoh: Ciko')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        const typeInput = new TextInputBuilder()
          .setCustomId('pet_type')
          .setLabel('Jenis Pet (Slime / Dragon / Cat / Golem)')
          .setPlaceholder('Ketik jenis pet pilihan Anda')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(nameInput),
          new ActionRowBuilder().addComponents(typeInput)
        );

        await iPet.showModal(modal);

        const submitted = await iPet.awaitModalSubmit({
          filter: (sub) => sub.customId === 'pet_modal_adopt' && sub.user.id === author.id,
          time: 60000
        }).catch(() => null);

        if (submitted) {
          try {
            const pName = submitted.fields.getTextInputValue('pet_name');
            const pType = submitted.fields.getTextInputValue('pet_type');

            const res = pet.adoptPet(author.id, guildId, pName, pType);
            const successEmb = embeds.successEmbed('Adopsi Sukses! 🥚', `Selamat! Telur pet **${res.pet_name}** the **${res.pet_type}** berhasil diadopsi seharga **Rp 1.500**!\n⏳ Telur akan menetas <t:${res.hatch_at}:R>.`);

            await submitted.reply({ embeds: [successEmb], flags: 64 });
            collector.stop();
            await replyMsg.delete().catch(() => { });
          } catch (err) {
            await submitted.reply({ embeds: [embeds.errorEmbed('Adopsi Gagal!', err.message)], flags: 64 });
          }
        }
      }

      else if (iPet.customId === 'pet_btn_hatch') {
        const freshPet = pet.getPet(author.id, guildId);
        if (freshPet && freshPet.status === 'BABY') {
          let traitText = '';
          if (freshPet.trait) {
            let traitDesc = '';
            const t = freshPet.trait.toUpperCase();
            if (t === 'GENIUS') traitDesc = '🧠 Genius (-15% XP cap)';
            else if (t === 'STURDY') traitDesc = '🛡️ Sturdy (HP decay rate halved)';
            else if (t === 'MUTANT') traitDesc = '🧬 Mutant (+10% work/hunt earnings)';
            else if (t === 'WARRIOR') traitDesc = '⚔️ Warrior (+10% attack)';

            traitText = `\n\n✨ **HOKI BANGET! Pet Anda menetas dengan Trait Rare:** \`${traitDesc}\`!`;
          }
          const successEmb = embeds.successEmbed('Telur Menetas! 🎉🐣', `Selamat! Telur pet **${freshPet.pet_name}** Anda telah resmi menetas menjadi bayi monster yang lucu!${traitText}\n\n*Ketik \`.pet\` untuk menyegarkan.*`);
          await iPet.reply({ embeds: [successEmb], flags: 64 });
          collector.stop();
          await replyMsg.delete().catch(() => { });
        } else {
          await iPet.reply({ content: '⏳ Telur Anda belum siap menetas!', flags: 64 });
        }
      }

      else if (iPet.customId === 'pet_btn_feed') {
        try {
          const res = pet.useItem(author.id, guildId, 'FOOD_BASIC', true);
          const successEmb = embeds.successEmbed('Beri Makan Berhasil! 🍗', `Anda memberi pakan **${res.item.name}** ke pet Anda!${res.didAutoBuy ? ' *(Auto-beli Rp 150 potong dari dompet)*' : ''}\n📊 Status Baru: Kenyangan **${res.pet.hunger}%** (+10 XP).`);
          await iPet.reply({ embeds: [successEmb], flags: 64 });
          const freshData = getDashboardPanel(author.id, guildId);
          await replyMsg.edit(freshData).catch(console.error);
        } catch (err) {
          await iPet.reply({ embeds: [embeds.errorEmbed('Gagal Beri Makan!', err.message)], flags: 64 });
        }
      }

      else if (iPet.customId === 'pet_btn_drink') {
        try {
          const res = pet.useItem(author.id, guildId, 'WATER', true);
          const successEmb = embeds.successEmbed('Beri Minum Berhasil! 🥤', `Anda memberi air minum **${res.item.name}** ke pet Anda!${res.didAutoBuy ? ' *(Auto-beli Rp 100 potong dari dompet)*' : ''}\n📊 Status Baru: Hidrasi **${res.pet.thirst}%** (+10 XP).`);
          await iPet.reply({ embeds: [successEmb], flags: 64 });
          const freshData = getDashboardPanel(author.id, guildId);
          await replyMsg.edit(freshData).catch(console.error);
        } catch (err) {
          await iPet.reply({ embeds: [embeds.errorEmbed('Gagal Beri Minum!', err.message)], flags: 64 });
        }
      }

      else if (iPet.customId === 'pet_btn_play') {
        try {
          const res = pet.playWithPet(author.id, guildId);
          const successEmb = embeds.successEmbed('Bermain Berhasil! ⚽', `Anda mengajak pet bermain bola! \n📊 Status Baru: Kebahagiaan **${res.happiness}%** (+15 XP).`);
          await iPet.reply({ embeds: [successEmb], flags: 64 });
          const freshData = getDashboardPanel(author.id, guildId);
          await replyMsg.edit(freshData).catch(console.error);
        } catch (err) {
          await iPet.reply({ embeds: [embeds.errorEmbed('Gagal Bermain!', err.message)], flags: 64 });
        }
      }

      else if (iPet.customId === 'pet_btn_cure') {
        try {
          const res = pet.useItem(author.id, guildId, 'MEDICINE', true);
          const successEmb = embeds.successEmbed('Pengobatan Berhasil! 💊', `Anda menyembuhkan pet dengan **${res.item.name}**!${res.didAutoBuy ? ' *(Auto-beli Rp 500 potong dari dompet)*' : ''}\n📊 Status Baru: HP Kesehatan **${res.pet.health}%** (+10 XP).`);
          await iPet.reply({ embeds: [successEmb], flags: 64 });
          const freshData = getDashboardPanel(author.id, guildId);
          await replyMsg.edit(freshData).catch(console.error);
        } catch (err) {
          await iPet.reply({ embeds: [embeds.errorEmbed('Gagal Pengobatan!', err.message)], flags: 64 });
        }
      }

      else if (iPet.customId === 'pet_btn_work') {
        try {
          const res = pet.sendToWork(author.id, guildId);
          const successEmb = embeds.successEmbed('Selesai Bekerja! 💼', `**${res.pet.pet_name}** sukses membawa pulang uang gaji sebesar **Rp ${res.reward.toLocaleString('id-ID')}**!\n📈 Bonus Level: \`+Rp ${res.levelBonus}\`\n📊 Status Baru: Kenyangan \`${res.pet.hunger}%\`, Hidrasi \`${res.pet.thirst}%\`, Kebahagiaan \`${res.pet.happiness}%\` (+30 XP).`);
          await iPet.reply({ embeds: [successEmb], flags: 64 });
          const freshData = getDashboardPanel(author.id, guildId);
          await replyMsg.edit(freshData).catch(console.error);
        } catch (err) {
          await iPet.reply({ embeds: [embeds.errorEmbed('Gagal Bekerja!', err.message)], flags: 64 });
        }
      }

      else if (iPet.customId === 'pet_btn_hunt') {
        try {
          const res = pet.sendToHunt(author.id, guildId);
          let dropText = '';
          if (res.dropItem) {
            dropText = `\n🎁 **DROP LANGKA HOKI:** Menemukan **1x ${res.dropItem.name}** gratis!`;
          }
          const successEmb = embeds.successEmbed('Selesai Berburu! 🏹', `**${res.pet.pet_name}** berhasil kembali dari berburu dengan koin **Rp ${res.reward.toLocaleString('id-ID')}**!${dropText}\n📊 Status Baru: Kenyangan \`${res.pet.hunger}%\`, Hidrasi \`${res.pet.thirst}%\`, HP \`${res.pet.health}%\` (+60 XP).`);
          await iPet.reply({ embeds: [successEmb], flags: 64 });
          const freshData = getDashboardPanel(author.id, guildId);
          await replyMsg.edit(freshData).catch(console.error);
        } catch (err) {
          await iPet.reply({ embeds: [embeds.errorEmbed('Gagal Berburu!', err.message)], flags: 64 });
        }
      }

      else if (iPet.customId === 'pet_btn_nav_shop') {
        await handlePetShopCommand(iPet, client, true);
      }
    } catch (err) {
      console.error('Error in pet dashboard collector:', err);
    }
  });

  collector.on('end', async () => {
    if (collector.destroyed) return;
    const freshData = getDashboardPanel(author.id, guildId);
    freshData.components = [];
    await replyMsg.edit(freshData).catch(() => { });
  });
}

/**
 * Helper untuk memproses perintah Cozy Flower Garden
 */
async function handleGardenCommand(message, client, args, commandName) {
  const { guildId, author } = message;

  // 1. .kebun / .garden (Dashboard Utama Interaktif)
  if (commandName === 'kebun' || commandName === 'garden') {
    const slots = garden.getGardenSlots(author.id, guildId);
    const wallet = economy.getWallet(author.id, guildId);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('garden_btn_water_all').setLabel('💦 Siram Semua').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('garden_btn_harvest_all').setLabel('🧺 Panen Semua').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('garden_btn_shop').setLabel('🛒 Toko Benih').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('garden_btn_craft').setLabel('💐 Rangkai Buket').setStyle(ButtonStyle.Secondary)
    );

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('garden_select_plant')
      .setPlaceholder('🌱 Pilih benih & slot untuk menanam...')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('🌹 Tanam Mawar - Slot #1').setDescription('Mawar Merah (Common • Tumbuh: 2 Jam)').setValue('plant_rose_1'),
        new StringSelectMenuOptionBuilder().setLabel('🌹 Tanam Mawar - Slot #2').setDescription('Mawar Merah (Common • Tumbuh: 2 Jam)').setValue('plant_rose_2'),
        new StringSelectMenuOptionBuilder().setLabel('🌹 Tanam Mawar - Slot #3').setDescription('Mawar Merah (Common • Tumbuh: 2 Jam)').setValue('plant_rose_3'),
        new StringSelectMenuOptionBuilder().setLabel('🌷 Tanam Tulip - Slot #1').setDescription('Bunga Tulip (Common • Tumbuh: 4 Jam)').setValue('plant_tulip_1'),
        new StringSelectMenuOptionBuilder().setLabel('🌷 Tanam Tulip - Slot #2').setDescription('Bunga Tulip (Common • Tumbuh: 4 Jam)').setValue('plant_tulip_2'),
        new StringSelectMenuOptionBuilder().setLabel('🌷 Tanam Tulip - Slot #3').setDescription('Bunga Tulip (Common • Tumbuh: 4 Jam)').setValue('plant_tulip_3'),
        new StringSelectMenuOptionBuilder().setLabel('🪻 Tanam Lavender - Slot #1').setDescription('Lavender (Rare • Tumbuh: 6 Jam)').setValue('plant_lavender_1'),
        new StringSelectMenuOptionBuilder().setLabel('🪻 Tanam Lavender - Slot #2').setDescription('Lavender (Rare • Tumbuh: 6 Jam)').setValue('plant_lavender_2'),
        new StringSelectMenuOptionBuilder().setLabel('🪻 Tanam Lavender - Slot #3').setDescription('Lavender (Rare • Tumbuh: 6 Jam)').setValue('plant_lavender_3'),
        new StringSelectMenuOptionBuilder().setLabel('🌸 Tanam Sakura - Slot #1').setDescription('Sakura (Rare • Tumbuh: 12 Jam)').setValue('plant_sakura_1'),
        new StringSelectMenuOptionBuilder().setLabel('🌸 Tanam Sakura - Slot #2').setDescription('Sakura (Rare • Tumbuh: 12 Jam)').setValue('plant_sakura_2'),
        new StringSelectMenuOptionBuilder().setLabel('🌸 Tanam Sakura - Slot #3').setDescription('Sakura (Rare • Tumbuh: 12 Jam)').setValue('plant_sakura_3'),
        new StringSelectMenuOptionBuilder().setLabel('👑 Tanam Anggrek - Slot #1').setDescription('Anggrek Langka (Epic • Tumbuh: 24 Jam)').setValue('plant_orchid_1'),
        new StringSelectMenuOptionBuilder().setLabel('👑 Tanam Anggrek - Slot #2').setDescription('Anggrek Langka (Epic • Tumbuh: 24 Jam)').setValue('plant_orchid_2'),
        new StringSelectMenuOptionBuilder().setLabel('👑 Tanam Anggrek - Slot #3').setDescription('Anggrek Langka (Epic • Tumbuh: 24 Jam)').setValue('plant_orchid_3')
      );

    const row2 = new ActionRowBuilder().addComponents(selectMenu);

    const replyMsg = await message.reply({
      embeds: [embeds.gardenEmbed(author, slots, wallet.last_water_at)],
      components: [row, row2]
    });

    const collector = replyMsg.createMessageComponentCollector({ time: 120000 });

    const shopRow1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('garden_buy_rose').setLabel('🌹 Beli Mawar (Rp 150)').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('garden_buy_tulip').setLabel('🌷 Beli Tulip (Rp 300)').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('garden_buy_lavender').setLabel('🪻 Beli Lavender (Rp 500)').setStyle(ButtonStyle.Success)
    );
    const shopRow2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('garden_buy_sakura').setLabel('🌸 Beli Sakura (Rp 1k)').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('garden_buy_orchid').setLabel('👑 Beli Anggrek (Rp 2.5k)').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('garden_buy_wrapping').setLabel('🎗️ Kertas Kado (Rp 100)').setStyle(ButtonStyle.Primary)
    );
    const shopRow3 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('garden_btn_back').setLabel('🏡 Kembali ke Kebun').setStyle(ButtonStyle.Secondary)
    );

    collector.on('collect', async i => {
      if (i.user.id !== author.id) {
        return await i.reply({ content: '❌ Tombol ini hanya dapat ditekan oleh pemilik kebun!', flags: 64 }).catch(() => {});
      }

      try {
        if (i.isStringSelectMenu() && i.customId === 'garden_select_plant') {
          const val = i.values[0];
          const parts = val.split('_');
          const flowerKey = parts[1];
          const slotIdx = parseInt(parts[2]);

          await i.deferReply({ flags: 64 }).catch(() => {});

          try {
            const res = garden.plantSeed(author.id, guildId, slotIdx, flowerKey);
            
            await i.editReply({
              embeds: [embeds.successEmbed(
                '🌱 Penanaman Berhasil!',
                `Benih **${res.flowerName}** berhasil ditanam di **Slot #${res.slotIndex}**!\n\n` +
                `💦 Jangan lupa menyiram tanaman Anda agar tumbuh lebih cepat.`
              )]
            }).catch(() => {});

            const updatedSlots = garden.getGardenSlots(author.id, guildId);
            const updatedWallet = economy.getWallet(author.id, guildId);
            
            await replyMsg.edit({
              embeds: [embeds.gardenEmbed(author, updatedSlots, updatedWallet.last_water_at)],
              components: [row, row2]
            }).catch(() => {});
          } catch (err) {
            await i.editReply({ content: `❌ Gagal menanam: ${err.message}` }).catch(() => {});
          }
        } 
        
        else if (i.customId === 'garden_btn_water_all') {
          await i.deferReply({ flags: 64 }).catch(() => {});
          try {
            const res = garden.waterPlant(author.id, guildId, 'all');
            const updatedSlots = garden.getGardenSlots(author.id, guildId);
            const updatedWallet = economy.getWallet(author.id, guildId);

            const successEmb = embeds.successEmbed(
              '💦 Penyiraman Berhasil!',
              `Berhasil menyiram **${res.wateredCount}** tanaman (Slot: **${res.slotsWatered.join(', ')}**).\n` +
              `Tanaman tumbuh 30 menit lebih cepat! Cooldown ember air disetel kembali.`
            );

            await i.editReply({ embeds: [successEmb] }).catch(() => {});

            await replyMsg.edit({
              embeds: [embeds.gardenEmbed(author, updatedSlots, updatedWallet.last_water_at)],
              components: [row, row2]
            }).catch(() => {});
          } catch (err) {
            await i.editReply({ content: `❌ Gagal menyiram: ${err.message}` }).catch(() => {});
          }
        } 
        
        else if (i.customId === 'garden_btn_harvest_all') {
          await i.deferReply({ flags: 64 }).catch(() => {});
          try {
            const slots = garden.getGardenSlots(author.id, guildId);
            const harvestable = slots.filter(s => s.seed_id && s.growthProgress >= 100);

            if (harvestable.length === 0) {
              await i.editReply({ content: '❌ Tidak ada tanaman yang siap dipanen di kebun Anda!' }).catch(() => {});
              return;
            }

            const harvestedNames = [];
            harvestable.forEach(s => {
              const res = garden.harvestPlant(author.id, guildId, s.slot_index);
              harvestedNames.push(`Slot #${res.slotIndex}: **${res.flowerName}**`);
            });

            const updatedSlots = garden.getGardenSlots(author.id, guildId);
            const updatedWallet = economy.getWallet(author.id, guildId);

            const successEmb = embeds.successEmbed(
              '🧺 Panen Bunga Sukses!',
              `Berhasil memanen **${harvestedNames.length}** kuntum bunga segar:\n` +
              harvestedNames.map(name => `• ${name}`).join('\n') + `\n\n` +
              `Bunga kini tersimpan aman di inventory Anda! Rangkai buket bunga indah di menu \`.buket\`.`
            );

            await i.editReply({ embeds: [successEmb] }).catch(() => {});

            await replyMsg.edit({
              embeds: [embeds.gardenEmbed(author, updatedSlots, updatedWallet.last_water_at)],
              components: [row, row2]
            }).catch(() => {});
          } catch (err) {
            await i.editReply({ content: `❌ Gagal memanen: ${err.message}` }).catch(() => {});
          }
        } 
        
        else if (i.customId === 'garden_btn_shop') {
          const walletShop = economy.getWallet(author.id, guildId);
          await i.deferUpdate().catch(() => {});
          await replyMsg.edit({
            embeds: [embeds.gardenShopEmbed(author, walletShop)],
            components: [shopRow1, shopRow2, shopRow3]
          }).catch(() => {});
        } 
        
        else if (i.customId.startsWith('garden_buy_')) {
          const itemKey = i.customId.replace('garden_buy_', '');
          await i.deferReply({ flags: 64 }).catch(() => {});
          try {
            const res = garden.buySeed(author.id, guildId, itemKey, 1);
            
            await i.editReply({
              embeds: [embeds.successEmbed(
                '🛒 Pembelian Berhasil!',
                `Anda berhasil membeli **1x ${res.itemName}** seharga **Rp ${res.cost.toLocaleString('id-ID')}**!\n\n` +
                `💰 Saldo tersisa: **Rp ${res.walletBalance.toLocaleString('id-ID')}**`
              )]
            }).catch(() => {});

            const walletShop = economy.getWallet(author.id, guildId);
            await replyMsg.edit({
              embeds: [embeds.gardenShopEmbed(author, walletShop)],
              components: [shopRow1, shopRow2, shopRow3]
            }).catch(() => {});
          } catch (err) {
            await i.editReply({ content: `❌ Gagal membeli: ${err.message}` }).catch(() => {});
          }
        }

        else if (i.customId === 'garden_btn_craft') {
          const craftRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('garden_craft_love').setLabel('💖 Resep Love').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('garden_craft_peace').setLabel('🪻 Resep Peace').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('garden_craft_imperial').setLabel('👑 Resep Imperial').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('garden_btn_back').setLabel('🏡 Kembali').setStyle(ButtonStyle.Success)
          );

          await i.deferUpdate().catch(() => {});
          await replyMsg.edit({
            embeds: [embeds.bouquetCraftEmbed(author, guildId)],
            components: [craftRow]
          }).catch(() => {});
        } 
        
        else if (i.customId === 'garden_btn_back') {
          const updatedSlots = garden.getGardenSlots(author.id, guildId);
          const updatedWallet = economy.getWallet(author.id, guildId);

          await i.deferUpdate().catch(() => {});
          await replyMsg.edit({
            embeds: [embeds.gardenEmbed(author, updatedSlots, updatedWallet.last_water_at)],
            components: [row, row2]
          }).catch(() => {});
        } 
        
        else if (i.customId.startsWith('garden_craft_')) {
          const recipe = i.customId.replace('garden_craft_', '');
          await i.deferReply({ flags: 64 }).catch(() => {});
          try {
            const res = garden.craftBouquet(author.id, guildId, recipe);
            const successEmb = embeds.successEmbed(
              '💐 Buket Berhasil Dirangkai!',
              `Selamat! Anda berhasil merangkai **${res.bouquetName}**.\n\n` +
              `*${res.desc}*\n\n` +
              `Buket bunga kini berada di inventory Anda. Gunakan perintah \`.gift-buket\` untuk mengirimkannya ke warga lain.`
            );

            await i.editReply({ embeds: [successEmb] }).catch(() => {});

            await replyMsg.edit({
              embeds: [embeds.bouquetCraftEmbed(author, guildId)]
            }).catch(() => {});
          } catch (err) {
            await i.editReply({ content: `❌ Gagal merangkai: ${err.message}` }).catch(() => {});
          }
        }
      } catch (err) {
        console.error("Error in garden interaction collector:", err);
      }
    });

    collector.on('end', async () => {
      const slotsEnd = garden.getGardenSlots(author.id, guildId);
      const walletEnd = economy.getWallet(author.id, guildId);
      await replyMsg.edit({
        embeds: [embeds.gardenEmbed(author, slotsEnd, walletEnd.last_water_at)],
        components: []
      }).catch(() => {});
    });
  }

  // 2. .toko-kebun / .gardenshop
  else if (commandName === 'toko-kebun' || commandName === 'gardenshop') {
    if (args[0]?.toLowerCase() === 'beli') {
      const seedName = args[1]?.toLowerCase();
      const qty = parseInt(args[2]) || 1;

      if (!seedName) {
        return message.reply({
          embeds: [
            embeds.errorEmbed(
              'Format Salah!',
              'Harap sebutkan benih yang ingin dibeli.\nContoh: `.toko-kebun beli mawar 3`'
            )
          ]
        });
      }

      try {
        const res = garden.buySeed(author.id, guildId, seedName, qty);
        return message.reply({
          embeds: [
            embeds.successEmbed(
              '🛒 Pembelian Berhasil!',
              `Anda berhasil membeli **${res.quantityBought}x ${res.itemName}** seharga **Rp ${res.cost.toLocaleString('id-ID')}**!\n\n` +
              `💰 Saldo tersisa: **Rp ${res.walletBalance.toLocaleString('id-ID')}**`
            )
          ]
        });
      } catch (err) {
        return message.reply({ embeds: [embeds.errorEmbed('Pembelian Gagal!', err.message)] });
      }
    } else {
      const wallet = economy.getWallet(author.id, guildId);
      return message.reply({ embeds: [embeds.gardenShopEmbed(author, wallet)] });
    }
  }

  // 3. .tanam <slot> <bunga>
  else if (commandName === 'tanam') {
    const slotIdx = parseInt(args[0]);
    const flowerName = args[1]?.toLowerCase();

    if (isNaN(slotIdx) || !flowerName) {
      return message.reply({
        embeds: [
          embeds.errorEmbed(
            'Format Salah!',
            'Harap sebutkan nomor slot tanah dan jenis benih bunga.\n' +
            'Contoh: `.tanam 1 mawar`\n\n' +
            '*Pilihan bunga: mawar, tulip, lavender, sakura, anggrek.*'
          )
        ]
      });
    }

    try {
      const res = garden.plantSeed(author.id, guildId, slotIdx, flowerName);
      return message.reply({
        embeds: [
          embeds.successEmbed(
            '🌱 Penanaman Berhasil!',
            `Benih **${res.flowerName}** berhasil ditanam di **Slot #${res.slotIndex}**!\n\n` +
            `💦 Jangan lupa menyiram tanaman Anda agar tumbuh lebih cepat.`
          )
        ]
      });
    } catch (err) {
      return message.reply({ embeds: [embeds.errorEmbed('Gagal Menanam!', err.message)] });
    }
  }

  // 4. .siram [slot]
  else if (commandName === 'siram') {
    const slotInput = args[0] ? args[0].toLowerCase() : 'all';

    try {
      const res = garden.waterPlant(author.id, guildId, slotInput);
      return message.reply({
        embeds: [
          embeds.successEmbed(
            '💦 Penyiraman Berhasil!',
            slotInput === 'all'
              ? `Berhasil menyiram **${res.wateredCount}** tanaman (Slot: **${res.slotsWatered.join(', ')}**).\nTanaman tumbuh 30 menit lebih cepat!`
              : `Berhasil menyiram tanaman di **Slot #${res.slotsWatered[0]}**.\nTanaman tumbuh 30 menit lebih cepat!`
          )
        ]
      });
    } catch (err) {
      return message.reply({ embeds: [embeds.errorEmbed('Gagal Menyiram!', err.message)] });
    }
  }

  // 5. .panen <slot>
  else if (commandName === 'panen') {
    const slotIdx = parseInt(args[0]);

    if (isNaN(slotIdx)) {
      return message.reply({
        embeds: [
          embeds.errorEmbed(
            'Format Salah!',
            'Harap sebutkan nomor slot tanah yang ingin dipanen.\nContoh: `.panen 1`'
          )
        ]
      });
    }

    try {
      const res = garden.harvestPlant(author.id, guildId, slotIdx);
      let rarityEmoji = '🌹';
      if (res.rarity === 'RARE') rarityEmoji = '🪻';
      if (res.rarity === 'EPIC') rarityEmoji = '👑';

      return message.reply({
        embeds: [
          embeds.successEmbed(
            '🧺 Panen Bunga Sukses!',
            `Anda berhasil memanen **${rarityEmoji} ${res.flowerName}** matang dari **Slot #${res.slotIndex}**!\n\n` +
            `Bunga kini disimpan aman di inventory Anda. Kumpulkan bahan untuk merangkai buket bunga sultan!`
          )
        ]
      });
    } catch (err) {
      return message.reply({ embeds: [embeds.errorEmbed('Gagal Memanen!', err.message)] });
    }
  }

  // 6. .jual-bunga <bunga> <jumlah|all>
  else if (commandName === 'jual-bunga') {
    const flowerName = args[0]?.toLowerCase();
    const qtyInput = args[1] || 'all';

    if (!flowerName) {
      return message.reply({
        embeds: [
          embeds.errorEmbed(
            'Format Salah!',
            'Gunakan: `.jual-bunga <nama_bunga> <jumlah|all>`\n' +
            'Contoh: `.jual-bunga mawar all` atau `.jual-bunga mawar 2`'
          )
        ]
      });
    }

    try {
      const res = garden.sellFlowers(author.id, guildId, flowerName, qtyInput);
      return message.reply({
        embeds: [
          embeds.successEmbed(
            '💰 Penjualan Sukses!',
            `Anda berhasil menjual **${res.quantitySold}x ${res.flowerName}** ke pasar seharga **Rp ${res.earnings.toLocaleString('id-ID')}**!\n\n` +
            `💸 Saldo dompet Anda sekarang: **Rp ${res.walletBalance.toLocaleString('id-ID')}**`
          )
        ]
      });
    } catch (err) {
      return message.reply({ embeds: [embeds.errorEmbed('Gagal Menjual!', err.message)] });
    }
  }

  // 7. .buket [jenis]
  else if (commandName === 'buket') {
    const bouquetType = args[0]?.toLowerCase();

    if (!bouquetType) {
      return message.reply({ embeds: [embeds.bouquetCraftEmbed(author, guildId)] });
    }

    try {
      const res = garden.craftBouquet(author.id, guildId, bouquetType);
      return message.reply({
        embeds: [
          embeds.successEmbed(
            '💐 Buket Berhasil Dirangkai!',
            `Selamat! Anda berhasil merangkai **${res.bouquetName}**.\n\n` +
            `*${res.desc}*\n\n` +
            `Buket bunga kini berada di inventory Anda. Gunakan perintah \`.gift-buket\` untuk mengirimkannya ke warga lain!`
          )
        ]
      });
    } catch (err) {
      return message.reply({ embeds: [embeds.errorEmbed('Gagal Merangkai!', err.message)] });
    }
  }

  // 8. .gift-buket @user <jenis> [pesan]
  else if (commandName === 'gift-buket') {
    const targetUser = message.mentions.users.first();
    const bType = args[1]?.toLowerCase();

    let messageText = '';
    if (args.length > 2) {
      messageText = args.slice(2).join(' ');
      if (messageText.startsWith('"') && messageText.endsWith('"')) {
        messageText = messageText.slice(1, -1);
      }
    }

    if (!targetUser || !bType) {
      return message.reply({
        embeds: [
          embeds.errorEmbed(
            'Format Salah!',
            'Gunakan: `.gift-buket @user <jenis_buket> [pesan_ucapan]`\n' +
            'Contoh: `.gift-buket @John love "selamat pagi"'
          )
        ]
      });
    }

    try {
      const res = garden.giftBouquet(author.id, targetUser.id, guildId, bType, messageText);
      const giftEmbed = embeds.giftBouquetEmbed(author, targetUser, res.bouquetName, res.messageText);
      return message.reply({ embeds: [giftEmbed] });
    } catch (err) {
      return message.reply({ embeds: [embeds.errorEmbed('Pengiriman Gagal!', err.message)] });
    }
  }
}

/**
 * Helper untuk memproses perintah Black Market (Pasar Gelap)
 */
async function handleBlackMarketCommand(message, client, args) {
  const { guildId, author } = message;
  const subCommand = args[0] ? args[0].toLowerCase() : null;

  if (subCommand === 'buy') {
    const itemId = args[1];
    const qtyInput = args[2] ? parseInt(args[2]) : 1;

    if (!itemId) {
      return message.reply({ embeds: [embeds.errorEmbed('Format Salah!', 'Gunakan: `.bm buy <lockpick/mask/meat/soap> [jumlah]`')] });
    }

    try {
      const res = bm.buyItem(author.id, guildId, itemId, qtyInput);
      const successEmb = embeds.successEmbed(
        'Transaksi Pasar Gelap Sukses! 🛒🕵️‍♂️',
        `Berhasil membeli **${res.quantity}x ${res.item.name}** seharga **Rp ${res.totalPrice.toLocaleString('id-ID')}**!\n` +
        `🎒 Jumlah di kantongmu sekarang: **x${res.newQty}**.\n\n` +
        `📉 Sisa dompetmu: **Rp ${economy.getWallet(author.id, guildId).balance.toLocaleString('id-ID')}**.`
      );
      return message.reply({ embeds: [successEmb] });
    } catch (err) {
      return message.reply({ embeds: [embeds.errorEmbed('Transaksi Gagal!', err.message)] });
    }
  }

  if (subCommand === 'inv' || subCommand === 'inventory') {
    const invList = bm.getInventory(author.id, guildId);
    let descText = 'Berikut adalah peralatan kriminal yang kamu miliki di kantongmu:\n\n';
    invList.forEach(item => {
      descText += `${item.name} - **x${item.quantity}**\n*${item.desc}*\n\n`;
    });

    const invEmbed = new EmbedBuilder()
      .setColor(0x2F3136)
      .setTitle('🎒 KANTONG PERALATAN KRIMINAL')
      .setThumbnail(author.displayAvatarURL())
      .setDescription(descText)
      .setTimestamp();

    return message.reply({ embeds: [invEmbed] });
  }

  // Dashboard Utama Pasar Gelap
  const bmEmbed = new EmbedBuilder()
    .setColor(0x1A1A1A)
    .setTitle('🕵️‍♂️ PASAR GELAP KOSAN (BLACK MARKET)')
    .setDescription(
      `Selamat datang di pasar gelap kosan, kawan. Butuh barang-barang untuk memuluskan aksi kriminalmu? Kami punya persediaannya...\n\n` +
      `**Daftar Peralatan Tersedia:**\n\n` +
      `🗝️ **Linggis / Lockpick** (\`lockpick\`) - **Rp 450**\n` +
      `*Meningkatkan sukses rate rob +15% (peluang patah 20%).*\n\n` +
      `🎭 **Topeng Samaran** (\`mask\`) - **Rp 600**\n` +
      `*Menyembunyikan namamu saat rob berhasil (sekali pakai).*\n\n` +
      `🥩 **Daging Bius** (\`meat\`) - **Rp 350**\n` +
      `*Menonaktifkan Alarm & CCTV korban saat rob (sekali pakai).*\n\n` +
      `🧼 **Sabun Licin** (\`soap\`) - **Rp 500**\n` +
      `*Memotong waktu tahanan penjara 50% jika ketangkap (sekali pakai).*\n\n` +
      `*Gunakan tombol di bawah untuk membeli barang secara instan, atau gunakan perintah \`.bm buy <item_id> [jumlah]\`.*`
    )
    .setFooter({ text: 'Sentinel Black Market • Kerahasiaan Terjamin' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bm_btn_buy_lockpick').setLabel('🗝️ Linggis').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('bm_btn_buy_mask').setLabel('🎭 Topeng').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('bm_btn_buy_meat').setLabel('🥩 Daging').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('bm_btn_buy_soap').setLabel('🧼 Sabun').setStyle(ButtonStyle.Secondary)
  );

  const replyMsg = await message.reply({ embeds: [bmEmbed], components: [row] });

  const collector = replyMsg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 60000
  });

  collector.on('collect', async i => {
    if (i.user.id !== author.id) {
      return i.reply({ content: '❌ Hanya orang yang memanggil menu ini yang bisa menggunakan tombol!', flags: 64 });
    }

    let itemId = '';
    if (i.customId === 'bm_btn_buy_lockpick') itemId = 'lockpick';
    if (i.customId === 'bm_btn_buy_mask') itemId = 'mask';
    if (i.customId === 'bm_btn_buy_meat') itemId = 'meat';
    if (i.customId === 'bm_btn_buy_soap') itemId = 'soap';

    try {
      const res = bm.buyItem(author.id, guildId, itemId, 1);
      const successEmb = embeds.successEmbed(
        'Transaksi Pasar Gelap Sukses! 🛒🕵️‍♂️',
        `Berhasil membeli **1x ${res.item.name}** seharga **Rp ${res.totalPrice.toLocaleString('id-ID')}**!\n` +
        `🎒 Jumlah di kantongmu sekarang: **x${res.newQty}**.\n\n` +
        `📉 Sisa dompetmu: **Rp ${economy.getWallet(author.id, guildId).balance.toLocaleString('id-ID')}**.`
      );
      await i.update({ embeds: [successEmb], components: [] });
      collector.stop();
    } catch (err) {
      await i.reply({ content: `❌ Transaksi Gagal: ${err.message}`, flags: 64 });
    }
  });

  collector.on('end', async () => {
    if (collector.destroyed) return;
    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('bm_btn_buy_lockpick').setLabel('🗝️ Linggis').setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId('bm_btn_buy_mask').setLabel('🎭 Topeng').setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId('bm_btn_buy_meat').setLabel('🥩 Daging').setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId('bm_btn_buy_soap').setLabel('🧼 Sabun').setStyle(ButtonStyle.Secondary).setDisabled(true)
    );
    await replyMsg.edit({ components: [disabledRow] }).catch(() => { });
  });
}

/**
 * Handler untuk perintah Coinflip Kasino (.coinflip)
 */
async function handleCoinflipCommand(message, client, args) {
  const { guildId, author } = message;
  const betInput = args[0];
  const guessInput = args[1];

  if (!betInput || !guessInput) {
    const errorEmb = embeds.errorEmbed('Format Salah! 🪙', 'Gunakan: `.coinflip <jumlah/all> <head/tail>`\nContoh: `.coinflip 100 head`');
    return message.reply({ embeds: [errorEmb] });
  }

  try {
    const casino = require('./casino');
    const res = casino.coinflip(author.id, guildId, betInput, guessInput);

    if (res.won) {
      const winEmb = embeds.successEmbed(
        'Kemenangan Coinflip! 🪙🎉',
        `Koin Anda berputar di udara dan mendarat pada **${res.coinSide.toUpperCase()}**!\n\n` +
        `🎯 Tebakan Anda **${res.guess.toUpperCase()}** tepat sasaran!\n` +
        `💰 **Kemenangan Bersih:** **Rp ${res.winnings.toLocaleString('id-ID')}** (Dipotong pajak 5% sebesar Rp ${res.tax})\n` +
        `📉 **Saldo Dompet Baru:** **Rp ${res.newBalance.toLocaleString('id-ID')}**`
      );
      return message.reply({ embeds: [winEmb] });
    } else {
      const loseEmb = embeds.errorEmbed(
        'Coinflip Kalah! 👮🚓',
        `Koin Anda berputar dan mendarat pada **${res.coinSide.toUpperCase()}**.\n\n` +
        `❌ Tebakan Anda **${res.guess.toUpperCase()}** salah!\n` +
        `💸 **Kerugian:** **Rp ${res.bet.toLocaleString('id-ID')}**\n` +
        `📉 **Sisa Saldo Dompet:** **Rp ${res.newBalance.toLocaleString('id-ID')}**`
      );
      return message.reply({ embeds: [loseEmb] });
    }
  } catch (err) {
    const errEmb = embeds.errorEmbed('Coinflip Gagal!', err.message);
    return message.reply({ embeds: [errEmb] });
  }
}

/**
 * Helper untuk memproses Toko Persediaan Pet
 */
async function handlePetShopCommand(context, client, isInteraction = false) {
  const guildId = context.guildId;
  const author = isInteraction ? context.user : context.author;

  const getShopPanelData = (userId, guildId) => {
    const wallet = economy.getWallet(userId, guildId);
    const inventory = pet.getInventory(userId, guildId);
    const embed = embeds.petShopEmbed(wallet, inventory);

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('pet_select_shop_item')
      .setPlaceholder('👉 Pilih persediaan untuk dibeli...')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('🍗 Pakan Pet Biasa (Rp 150)').setDescription('+30 Kenyangan').setValue('FOOD_BASIC'),
        new StringSelectMenuOptionBuilder().setLabel('🥩 Daging Premium (Rp 350)').setDescription('+70 Kenyangan & +10 HP').setValue('FOOD_PREMIUM'),
        new StringSelectMenuOptionBuilder().setLabel('🥤 Air Bersih (Rp 100)').setDescription('+35 Hidrasi').setValue('WATER'),
        new StringSelectMenuOptionBuilder().setLabel('💊 Ramuan Kesehatan (Rp 500)').setDescription('+50 HP & Menyembuhkan Sakit').setValue('MEDICINE'),
        new StringSelectMenuOptionBuilder().setLabel('⚽ Bola Karet (Rp 250)').setDescription('+50 Kebahagiaan').setValue('TOY'),
        new StringSelectMenuOptionBuilder().setLabel('⚡ XP Booster 2x (Rp 2.500)').setDescription('XP Pet 2x Permanen').setValue('XP_2X'),
        new StringSelectMenuOptionBuilder().setLabel('⚡ XP Booster 4x (Rp 5.000)').setDescription('XP Pet 4x Permanen').setValue('XP_4X'),
        new StringSelectMenuOptionBuilder().setLabel('⚡ XP Booster 6x (Rp 7.500)').setDescription('XP Pet 6x Permanen').setValue('XP_6X'),
        new StringSelectMenuOptionBuilder().setLabel('⚡ XP Booster 8x (Rp 10.000)').setDescription('XP Pet 8x Permanen').setValue('XP_8X')
      );

    const selectRow = new ActionRowBuilder().addComponents(selectMenu);
    const cancelBtn = new ButtonBuilder().setCustomId('pet_btn_cancel_shop').setLabel('✖️ Kembali ke Dashboard').setStyle(ButtonStyle.Secondary);
    const cancelRow = new ActionRowBuilder().addComponents(cancelBtn);

    return { embeds: [embed], components: [selectRow, cancelRow] };
  };

  const initialData = getShopPanelData(author.id, guildId);
  let replyMsg;
  if (isInteraction) {
    initialData.flags = 64;
    const resp = await context.reply({ ...initialData, withResponse: true });
    replyMsg = resp.resource?.message ?? await context.fetchReply();
  } else {
    replyMsg = await context.reply(initialData);
  }

  const collector = replyMsg.createMessageComponentCollector({
    time: 120000
  });

  collector.on('collect', async iShop => {
    if (iShop.user.id !== author.id) {
      return iShop.reply({ content: '❌ Tombol ini bukan untuk Anda!', flags: 64 });
    }

    try {
      if (iShop.customId === 'pet_btn_cancel_shop') {
        collector.stop();
        if (isInteraction) {
          await context.deleteReply().catch(() => { });
        } else {
          await replyMsg.delete().catch(() => { });
          await handlePetCommand(context, client, []);
        }
      } else if (iShop.customId === 'pet_select_shop_item') {
        collector.stop();
        const selectedItem = iShop.values[0];

        try {
          const res = pet.buyItem(author.id, guildId, selectedItem, 1);
          const successEmb = embeds.successEmbed(
            'Transaksi Belanja Sukses! 🛒',
            `Berhasil membeli **1x ${res.item.name}** seharga **Rp ${res.totalPrice.toLocaleString('id-ID')}**!\n📦 Barang telah dimasukkan ke persediaan pet Anda.\n\n` +
            `📉 Sisa dompetmu sekarang adalah **Rp ${economy.getWallet(author.id, guildId).balance.toLocaleString('id-ID')}**.`
          );
          await iShop.update({ embeds: [successEmb], components: [] });
        } catch (err) {
          const errorEmb = embeds.errorEmbed('Belanja Gagal!', err.message);
          await iShop.update({ embeds: [errorEmb], components: [] });
        }
      }
    } catch (err) {
      console.error('Error in pet shop collector:', err);
    }
  });

  collector.on('end', async () => {
    if (collector.destroyed) return;
    const freshData = getShopPanelData(author.id, guildId);
    freshData.components = [];
    await replyMsg.edit(freshData).catch(() => { });
  });
}

/**
 * Helper untuk memproses Duel PvP Arena Pet
 */
async function handlePetPvPCommand(message, opponent, bet, client) {
  const { guildId, author } = message;

  if (opponent.id === author.id) {
    return message.reply({ embeds: [embeds.warnEmbed('Pertandingan Tidak Sah!', 'Anda tidak bisa menantang hewan peliharaan Anda sendiri!')] });
  }

  // Validasi pet kedua belah pihak
  const chalPet = pet.getPet(author.id, guildId);
  const oppPet = pet.getPet(opponent.id, guildId);

  if (!chalPet) return message.reply({ embeds: [embeds.errorEmbed('PvP Gagal!', 'Anda tidak memiliki hewan peliharaan! Gunakan `.pet` untuk adopsi.')] });
  if (!oppPet) return message.reply({ embeds: [embeds.errorEmbed('PvP Gagal!', 'Lawan yang Anda tantang tidak memiliki hewan peliharaan!')] });

  if (chalPet.status === 'EGG' || chalPet.status === 'BABY') {
    return message.reply({ embeds: [embeds.errorEmbed('Pet Belum Cukup Umur!', 'Pet Anda masih bayi/telur. Dia harus dewasa (Level >= 10) untuk bertarung di arena!')] });
  }
  if (oppPet.status === 'EGG' || oppPet.status === 'BABY') {
    return message.reply({ embeds: [embeds.errorEmbed('Lawan Belum Cukup Umur!', 'Pet lawan masih bayi/telur. Pertarungan dibatalkan.')] });
  }

  const chalWallet = economy.getWallet(author.id, guildId);
  const oppWallet = economy.getWallet(opponent.id, guildId);

  if (chalWallet.balance < bet) return message.reply({ embeds: [embeds.errorEmbed('Saldo Kurang!', `Saldo Anda tidak mencukupi taruhan Rp ${bet.toLocaleString('id-ID')}!`)] });
  if (oppWallet.balance < bet) return message.reply({ embeds: [embeds.errorEmbed('Saldo Lawan Kurang!', `Saldo lawan tidak mencukupi taruhan Rp ${bet.toLocaleString('id-ID')}!`)] });

  const pvpEmbed = new EmbedBuilder()
    .setColor(0x7C4DFF)
    .setTitle('⚔️ TANTANGAN ARENA BATTLE PET ⚔️')
    .setDescription(
      `🔔 <@${opponent.id}>! Anda telah ditantang oleh <@${author.id}> untuk duel adu kekuatan pet!\n\n` +
      `📦 **Taruhan Tarung:** **Rp ${bet.toLocaleString('id-ID')}** koin\n` +
      `🦖 **Pet Anda:** **${oppPet.pet_name}** the \`${oppPet.pet_type}\` (Lv. ${oppPet.level})\n` +
      `⚔️ **Pet Penantang:** **${chalPet.pet_name}** the \`${chalPet.pet_type}\` (Lv. ${chalPet.level})\n\n` +
      `*Penerima tantangan memiliki waktu **60 detik** untuk menekan tombol **🟢 Terima Duel** di bawah!*`
    )
    .setFooter({ text: 'Rupiah Server PvP Arena' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('pet_pvp_accept').setLabel('🟢 Terima Duel').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('pet_pvp_decline').setLabel('🔴 Tolak').setStyle(ButtonStyle.Danger)
  );

  const replyMsg = await message.reply({ content: `<@${opponent.id}>`, embeds: [pvpEmbed], components: [row] });

  const collector = replyMsg.createMessageComponentCollector({
    time: 60000
  });

  collector.on('collect', async iMatch => {
    if (iMatch.user.id !== opponent.id) {
      return iMatch.reply({ content: '❌ Hanya penerima tantangan asli yang bisa merespon tombol ini!', flags: 64 });
    }

    try {
      if (iMatch.customId === 'pet_pvp_decline') {
        collector.stop();
        await replyMsg.delete().catch(() => { });
        await iMatch.reply({ content: `🔴 <@${author.id}>, tantangan duel PvP ditolak oleh <@${opponent.id}>.` });
      }

      else if (iMatch.customId === 'pet_pvp_accept') {
        collector.stop();
        await replyMsg.delete().catch(() => { });

        try {
          // Eksekusi PvP
          const result = pet.executePvP(author.id, opponent.id, guildId, bet);
          const battleReport = embeds.petBattleEmbed(author, opponent, result);

          await iMatch.reply({ content: `⚔️ **PERTANDINGAN SELESAI!** Berikut adalah battle report arena:`, embeds: [battleReport] });
        } catch (err) {
          await iMatch.reply({ embeds: [embeds.errorEmbed('Pertempuran Gagal Dihentikan!', err.message)] });
        }
      }
    } catch (err) {
      console.error('Error in pvp collector:', err);
    }
  });

  collector.on('end', async () => {
    if (collector.destroyed) return;
    await replyMsg.delete().catch(() => { });
  });
}

/**
 * Perintah Administratif Khusus Pet
 */
async function handlePetAdminCommand(message, client, args) {
  const subCommand = args[0] ? args[0].toLowerCase() : null;
  const target = message.mentions.users.first();
  const { guildId } = message;

  if (subCommand === 'give-xp') {
    const amount = parseInt(args[2]);
    if (!target || isNaN(amount) || amount <= 0) {
      return message.reply('❌ Format salah! Gunakan: `.pet-admin give-xp @user <jumlah_xp>`');
    }
    const petData = pet.getPet(target.id, guildId);
    if (!petData) return message.reply('❌ User tersebut tidak memiliki pet!');

    database.transaction(() => {
      let newXp = petData.xp + amount;
      let newLevel = petData.level;

      let xpNeeded = pet.getXpNeeded(newLevel, petData.trait);
      while (newXp >= xpNeeded) {
        newXp -= xpNeeded;
        newLevel++;
        xpNeeded = pet.getXpNeeded(newLevel, petData.trait);
      }

      database.run('UPDATE user_pets SET xp = ?, level = ? WHERE user_id = ? AND guild_id = ? AND is_active = 1', [newXp, newLevel, target.id, guildId]);
    })();

    const freshPet = pet.getPet(target.id, guildId);
    return message.reply(`✅ Berhasil memberikan **${amount} XP** ke pet **${freshPet.pet_name}** milik <@${target.id}>! (Sekarang Level: ${freshPet.level})`);
  }

  if (subCommand === 'heal') {
    if (!target) {
      return message.reply('❌ Format salah! Gunakan: `.pet-admin heal @user`');
    }
    const petData = pet.getPet(target.id, guildId);
    if (!petData) return message.reply('❌ User tersebut tidak memiliki pet!');

    database.run(
      'UPDATE user_pets SET health = CASE WHEN pet_type = "SLIME" THEN 120 ELSE 100 END, hunger = 100, thirst = 100, happiness = 100, status = CASE WHEN status = "DEAD" THEN "BABY" ELSE status END WHERE user_id = ? AND guild_id = ? AND is_active = 1',
      [target.id, guildId]
    );

    return message.reply(`✅ Seluruh stats pet **${petData.pet_name}** milik <@${target.id}> berhasil dipulihkan secara instan ke 100%!`);
  }

  if (subCommand === 'reset') {
    if (!target) {
      return message.reply('❌ Format salah! Gunakan: `.pet-admin reset @user`');
    }
    try {
      pet.resetPet(target.id, guildId);
      return message.reply(`✅ Sukses mereset dan menghapus data pet milik <@${target.id}>.`);
    } catch (err) {
      return message.reply(`❌ Gagal mereset: ${err.message}`);
    }
  }

  if (subCommand === 'hatch') {
    if (!target) {
      return message.reply('❌ Format salah! Gunakan: `.pet-admin hatch @user`');
    }
    const petData = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [target.id, guildId]);
    if (!petData) return message.reply('❌ User tersebut tidak memiliki pet!');
    if (petData.status !== 'EGG') return message.reply('❌ Pet milik user tersebut sudah menetas!');

    const now = Math.floor(Date.now() / 1000);
    database.run(
      'UPDATE user_pets SET hatch_at = ? WHERE user_id = ? AND guild_id = ? AND is_active = 1',
      [now - 10, target.id, guildId]
    );

    return message.reply(`🐣 **Sukses mempercepat penetasan telur!** Telur pet **${petData.pet_name}** milik <@${target.id}> sekarang siap menetas. Minta user untuk mengetik \`.pet\` dan mengklik tombol **Tetaskan Telur**!`);
  }

  if (subCommand === 'reset-expedition' || subCommand === 'clear-expedition') {
    const activeLobby = client.activeExpeditions;
    if (activeLobby && activeLobby.has(guildId)) {
      const lobby = activeLobby.get(guildId);
      if (lobby.timeout) clearTimeout(lobby.timeout);
      activeLobby.delete(guildId);
      return message.reply('✅ Sukses mereset secara paksa lobi ekspedisi pet yang aktif di server ini.');
    } else {
      return message.reply('❌ Tidak ada lobi ekspedisi pet yang aktif di server ini saat ini.');
    }
  }

  return message.reply('❓ Perintah admin pet tidak dikenal! Pilihan: `give-xp`, `heal`, `reset`, `hatch`, `reset-expedition`');
}

/**
 * Eksekusi Gacha Role secara universal.
 * Bisa dipanggil dari prefix command (.gacha-role) maupun tombol interaksi.
 * @param {Object} params
 * @param {Object} params.replyTarget - Message atau Interaction untuk reply awal
 * @param {Object} params.user - User Discord yang memutar gacha
 * @param {Object} params.guild - Guild Discord
 * @param {string} params.guildId - Guild ID
 * @param {Object} params.client - Discord Client
 * @param {boolean} params.isInteraction - Apakah ini dari interaksi tombol
 * @param {Object} [params.member] - Member Discord (opsional, akan di-fetch jika tidak ada)
 */
async function executeGachaRoll({ replyTarget, user, guild, guildId, client, isInteraction, member }) {
  const gachaCost = config.gacha.COST || 250;
  const wallet = economy.getWallet(user.id, guildId);

  if (wallet.balance < gachaCost) {
    const warnEmb = embeds.warnEmbed('Saldo Koin Tidak Cukup!', `Biaya putar gacha adalah **Rp ${gachaCost.toLocaleString('id-ID')}**, sedangkan saldo Anda saat ini hanya **Rp ${wallet.balance.toLocaleString('id-ID')}**.`);
    if (isInteraction) {
      return replyTarget.reply({ embeds: [warnEmb], ephemeral: replyTarget.channelId === SHOP_CHANNEL_ID });
    }
    return replyTarget.reply({ embeds: [warnEmb] });
  }

  const gachaItems = database.all('SELECT * FROM shop_items WHERE guild_id = ? AND is_gacha = 1', [guildId]);
  if (gachaItems.length === 0) {
    const warnEmb = embeds.warnEmbed('Gacha Tidak Tersedia!', 'Belum ada role gacha yang dikonfigurasi di server ini. Silakan admin menambahkan role gacha terlebih dahulu!');
    if (isInteraction) {
      return replyTarget.reply({ embeds: [warnEmb], ephemeral: replyTarget.channelId === SHOP_CHANNEL_ID });
    }
    return replyTarget.reply({ embeds: [warnEmb] });
  }

  // Animasi rolling menegangkan multi-tahap
  let rollingMsg = null;
  if (isInteraction) {
    await replyTarget.reply({ content: '🎰 **[ GACHA START ]** Memasukkan koin ke mesin gacha... 🪙', ephemeral: replyTarget.channelId === SHOP_CHANNEL_ID });
  } else {
    rollingMsg = await replyTarget.reply('🎰 **[ GACHA START ]** Memasukkan koin ke mesin gacha... 🪙');
  }

  // Helper: edit pesan rolling — untuk interaksi pakai editReply, untuk message pakai rollingMsg.edit
  const editRolling = (data) => {
    if (isInteraction) return replyTarget.editReply(typeof data === 'string' ? { content: data } : data);
    return rollingMsg.edit(data);
  };

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  await delay(1000);
  await editRolling('🎰 `[ SPINNING... ] ────────── [ 🔄 ]` Menyeimbangkan tuas mesin gacha...');
  await delay(1200);
  await editRolling('🎰 `[ FILTERING TIER... ] 💎✨ [ 🔮 ]` Menyaring tingkat kelangkaan...');
  await delay(1200);
  await editRolling('🎰 `[ DECRYPTING JACKPOT... ] ⚡📦` Membuka peti misteri...');
  await delay(1000);

  // Probabilitas Gacha ZONK
  const roll = Math.random() * 100;
  let zonkRate = config.gacha.ZONK_RATE !== undefined ? config.gacha.ZONK_RATE : 75;

  const ebyus = database.get('SELECT gacha_mode, expires_at FROM ebyus_settings WHERE guild_id = ?', [guildId]);
  if (ebyus) {
    const nowUnix = Math.floor(Date.now() / 1000);
    if (ebyus.expires_at > 0 && nowUnix > ebyus.expires_at) {
      database.run('UPDATE ebyus_settings SET gacha_mode = "NORMAL", expires_at = 0 WHERE guild_id = ?', [guildId]);
    } else {
      if (ebyus.gacha_mode === 'EASY') zonkRate = 40;
      else if (ebyus.gacha_mode === 'SUPER_EASY') zonkRate = 15;
      else if (ebyus.gacha_mode === 'ABUSE') zonkRate = 0;
    }
  }

  // Khusus ID 436554535037698059 mendapatkan hoki 80% (Zonk Rate hanya 20%)
  if (user.id === '436554535037698059') {
    zonkRate = 20;
  }

  if (roll < zonkRate) {
    // ZONK!
    database.transaction(() => {
      economy.subtractBalance(user.id, guildId, gachaCost, 'GACHA_SPEND', null);
    })();
    const finalWallet = economy.getWallet(user.id, guildId);

    const trashItems = config.gacha.TRASH_ITEMS || [{ name: 'Batu Kali', desc: 'Hanya batu biasa.' }];
    const selectedTrash = trashItems[Math.floor(Math.random() * trashItems.length)];

    const zonkEmbed = embeds.gachaResultEmbed(user, selectedTrash, gachaCost, finalWallet.balance, false);
    await editRolling({ content: '🎰 **[ GACHA SELESAI! ]**', embeds: [zonkEmbed] });

    client.emit('playTtsEvent', {
      guildId,
      text: `Amsyong! ${user.username} baru saja gacha seharga ${gachaCost} Rupiah, dan malah mendapatkan ${selectedTrash.name}! Sangat ampas!`,
      lang: 'id'
    });
    return;
  }

  // MENANG! Kelompokkan berdasarkan Tier
  const mythic = gachaItems.filter(i => i.tier === 'MYTHIC' && (i.stock === -1 || i.stock > 0));
  const legendary = gachaItems.filter(i => i.tier === 'LEGENDARY' && (i.stock === -1 || i.stock > 0));
  const epic = gachaItems.filter(i => i.tier === 'EPIC' && (i.stock === -1 || i.stock > 0));
  const rare = gachaItems.filter(i => i.tier === 'RARE' && (i.stock === -1 || i.stock > 0));
  const common = gachaItems.filter(i => i.tier === 'COMMON' && (i.stock === -1 || i.stock > 0));

  const rates = config.gacha.RATES || { COMMON: 70, RARE: 22, EPIC: 6.8, LEGENDARY: 1.1, MYTHIC: 0.1 };
  const tierRoll = Math.random() * 100;
  let selectedItem = null;

  if (tierRoll < rates.MYTHIC && mythic.length > 0) {
    selectedItem = mythic[Math.floor(Math.random() * mythic.length)];
  } else if (tierRoll < (rates.MYTHIC + rates.LEGENDARY) && legendary.length > 0) {
    selectedItem = legendary[Math.floor(Math.random() * legendary.length)];
  } else if (tierRoll < (rates.MYTHIC + rates.LEGENDARY + rates.EPIC) && epic.length > 0) {
    selectedItem = epic[Math.floor(Math.random() * epic.length)];
  } else if (tierRoll < (rates.MYTHIC + rates.LEGENDARY + rates.EPIC + rates.RARE) && rare.length > 0) {
    selectedItem = rare[Math.floor(Math.random() * rare.length)];
  } else if (common.length > 0) {
    selectedItem = common[Math.floor(Math.random() * common.length)];
  } else {
    const available = gachaItems.filter(i => i.stock === -1 || i.stock > 0);
    if (available.length > 0) {
      selectedItem = available[Math.floor(Math.random() * available.length)];
    }
  }

  if (!selectedItem) {
    await editRolling('❌ Gagal memutar gacha karena seluruh stok role gacha habis terjual!');
    return;
  }

  const discordRole = guild.roles.cache.get(selectedItem.role_id) || await guild.roles.fetch(selectedItem.role_id).catch(() => null);
  if (!discordRole) {
    await editRolling('❌ Role hadiah gacha sudah tidak ditemukan lagi di Discord server ini. Hubungi admin!');
    return;
  }

  const memberObj = member || await guild.members.fetch(user.id).catch(() => null);
  if (!memberObj) {
    await editRolling('❌ Gagal mengambil data profil anggota Discord Anda.');
    return;
  }

  const alreadyHas = memberObj.roles.cache.has(selectedItem.role_id);
  const cashbackAmount = config.gacha.CASHBACK || 100;
  let finalWallet;

  if (alreadyHas) {
    database.transaction(() => {
      const netCost = gachaCost - cashbackAmount;
      economy.subtractBalance(user.id, guildId, netCost, 'GACHA_SPEND_CASHBACK', null);
    })();
    finalWallet = economy.getWallet(user.id, guildId);

    const winEmbed = embeds.gachaResultEmbed(user, selectedItem, gachaCost, finalWallet.balance, true);
    winEmbed.setDescription(
      `**${user.username}** baru saja melakukan roll Gacha seharga **Rp ${gachaCost.toLocaleString('id-ID')}**!\n\n` +
      `🎰 **HASIL ROLL:**\n` +
      `🌟 **${selectedItem.role_name}** (\`${selectedItem.tier}\`)\n\n` +
      `💸 **DUPLIKAT CASHBACK!** Karena Anda sudah memiliki role ini, Anda mendapatkan **cashback Rp ${cashbackAmount}**! Saldo Anda dikembalikan sebagian.\n` +
      `📉 Sisa saldo Anda: **Rp ${finalWallet.balance.toLocaleString('id-ID')}**`
    );

    await editRolling({ content: '🎰 **[ GACHA SELESAI! ]**', embeds: [winEmbed] });
  } else {
    try {
      await memberObj.roles.add(discordRole);
    } catch (roleErr) {
      console.error('❌ Gagal menambahkan role gacha:', roleErr.message);
      await editRolling('❌ Gagal menyematkan role gacha. Pastikan posisi integrasi role bot berada di atas role hadiah!');
      return;
    }

    try {
      database.transaction(() => {
        economy.subtractBalance(user.id, guildId, gachaCost, 'GACHA_WIN', null);
        if (selectedItem.stock !== -1) {
          database.run('UPDATE shop_items SET stock = stock - 1 WHERE id = ? AND guild_id = ?', [selectedItem.id, guildId]);
        }
      })();
      finalWallet = economy.getWallet(user.id, guildId);
    } catch (dbErr) {
      await memberObj.roles.remove(discordRole).catch(() => { });
      throw dbErr;
    }

    const winEmbed = embeds.gachaResultEmbed(user, selectedItem, gachaCost, finalWallet.balance, true);
    await editRolling({ content: '🎰 **[ GACHA SELESAI! ]**', embeds: [winEmbed] });

    // Broadcast Heboh jika Legendary / Epic / Mythic
    if (selectedItem.tier === 'EPIC' || selectedItem.tier === 'LEGENDARY' || selectedItem.tier === 'MYTHIC') {
      const broadcastEmbed = embeds.broadcastMegaEmbed(user, selectedItem.role_name, gachaCost, selectedItem.tier);
      broadcastEmbed.setTitle(`🎰 SULTAN HOKI: DAHSYAT JACKPOT GACHA! 🎰`);
      broadcastEmbed.setDescription(
        `👑 **DEWA HOKI TELAH TURUN KE SERVER!**\n\n` +
        `<@${user.id}> baru saja melakukan spin gacha seharga **Rp ${gachaCost.toLocaleString('id-ID')}** dan mendapatkan jackpot role luar biasa:\n\n` +
        `🌟 **${selectedItem.role_name}** (\`${selectedItem.tier} CLASS\`)\n\n` +
        `*Semua bersorak merayakan keberuntungan spektakuler sultan gacha kita!* 🎰🚀`
      );

      const reportChannel = guild.channels.cache.get(config.REPORT_CHANNEL_ID);
      if (reportChannel) {
        await reportChannel.send({ embeds: [broadcastEmbed] }).catch(() => { });
      }

      client.emit('playTtsEvent', {
        guildId,
        text: `Wah gila sih! Sultan ${user.username} baru saja hoki besar mendapatkan jackpot role gacha ${selectedItem.role_name}! Luar biasa keberuntungannya!`,
        lang: 'id'
      });
    }
  }
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

  // ── FILTER SALURAN KHUSUS ADMIN PANEL ──
  const adminCommands = [
    'admin-panel', 'adminpanel', 'panel-admin', 'paneladmin',
    'admin-pet', 'panel-pet', 'pet-panel',
    'admin-bank', 'panel-bank', 'bank-panel',
    'admin-rob', 'panel-rob', 'rob-panel', 'admin-robbery', 'panel-robbery', 'robbery-panel',
    'admin-saham', 'panel-saham', 'saham-panel', 'admin-bursa', 'panel-bursa', 'bursa-panel', 'admin-market', 'panel-market', 'market-panel',
    'admin-shop', 'panel-shop', 'shop-panel',
    'ebyus', 'ebyus-panel', 'abyus', 'abyus-panel', 'admin-abyus', 'panel-abyus', 'abyus-admin', 'admin-event', 'panel-event', 'event-panel', 'admin-ebyus', 'panel-ebyus'
  ];

  if (adminCommands.includes(commandName)) {
    // 1. Check if user is administrator
    if (!message.member || !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      await message.delete().catch(() => {});
      await author.send('❌ Akses Ditolak! Menu ini dikunci khusus untuk Administrator server.').catch(() => {});
      return true;
    }

    // 2. Resolve admin channel
    const settings = database.get('SELECT admin_panel_channel_id FROM ebyus_settings WHERE guild_id = ?', [guildId]);
    const targetChannelId = settings?.admin_panel_channel_id;

    if (targetChannelId) {
      if (message.channelId !== targetChannelId) {
        await message.delete().catch(() => {});
        const warnMsg = await message.reply(`❌ Perintah admin panel ini hanya dapat dijalankan di channel khusus admin: <#${targetChannelId}>`);
        setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
        return true;
      }
    } else {
      // Fallback: check channel name
      const isDefaultAdminChannel = ['panel-admin', 'admin-panel'].includes(message.channel.name?.toLowerCase());
      if (!isDefaultAdminChannel) {
        await message.delete().catch(() => {});
        const warnMsg = await message.reply(`❌ Perintah admin panel ini hanya dapat dijalankan di channel khusus admin! Silakan buat channel bernama \`#panel-admin\` atau jalankan \`.setup-panel-admin\` terlebih dahulu.`);
        setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
        return true;
      }
    }
  }

  // Helper: kirim balasan langsung tanpa auto-delete
  const autoReply = async (options) => {
    return message.reply(options);
  };

  // ── FILTER SALURAN KHUSUS PET (Channel ID: 1509762623917265137) ──
  // 1. Jika mengetik perintah non-pet di channel khusus pet, blokir
  if (message.channelId === '1509762623917265137') {
    if (!['pet', 'pet-admin', 'admin-pet', 'panel-pet'].includes(commandName)) {
      const warnEmb = embeds.warnEmbed('Saluran Khusus Pet! 🐾', 'Saluran ini hanya dapat digunakan untuk bermain pet (`.pet`)! Silakan gunakan channel obrolan/bot untuk perintah lainnya.');
      await autoReply({ embeds: [warnEmb] });
      return true; // Berhenti memproses perintah lain
    }
  }

  // 2. Jika mengetik perintah pet di channel lain, blokir (kecuali admin/owner)
  if (['pet', 'pet-admin'].includes(commandName) && message.channelId !== '1509762623917265137') {
    const isOwner = author.id === OWNER_ID;
    const isAdmin = message.member && message.member.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!isOwner && !isAdmin) {
      const warnEmb = embeds.warnEmbed('Saluran Khusus! 🐾', 'Perintah bermain pet (`.pet`) hanya dapat digunakan di saluran khusus pet: <#1509762623917265137>!');
      await autoReply({ embeds: [warnEmb] });
      return true; // Berhenti memproses perintah
    }
  }

  // 👮 GUARD PENJARA VIRTUAL (Jail Lock Guard)
  // Menghalangi seluruh perintah ekonomi jika user sedang berada di dalam penjara virtual,
  // kecuali perintah .jail, .heist-admin, .pet-admin, dan .pet jika BUKAN work/hunt/battle.
  const jailCheck = robbery.checkJail(author.id, guildId);
  if (jailCheck.jailed) {
    let shouldBlock = false;
    if (commandName === 'pet') {
      const sub = args[0]?.toLowerCase();
      if (['work', 'hunt', 'battle'].includes(sub)) {
        shouldBlock = true;
      }
    } else if (!['jail', 'heist-admin', 'pet-admin', 'admin-panel', 'adminpanel', 'panel-admin', 'paneladmin'].includes(commandName)) {
      shouldBlock = true;
    }

    if (shouldBlock) {
      const jailEmbed = embeds.jailStatusEmbed(author, jailCheck.remaining, jailCheck.bailAmount);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('jail_btn_tebus')
          .setLabel('🔓 Tebus Sendiri')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('jail_btn_tebus_teman')
          .setLabel('🤝 Tebus Teman (Hutang)')
          .setStyle(ButtonStyle.Primary)
      );

      const replyMsg = await message.reply({
        content: `❌ **Akses Ditangguhkan!** Anda sedang ditahan di penjara virtual.`,
        embeds: [jailEmbed],
        components: [row]
      });

      const collector = replyMsg.createMessageComponentCollector({ time: 60000 });
      collector.on('collect', async iJail => {
        if (iJail.customId === 'jail_btn_tebus_teman') {
          if (iJail.user.id === author.id) {
            return iJail.reply({ content: '❌ Anda tidak bisa menebus diri sendiri melalui tombol ini! Gunakan tombol Tebus Sendiri.', flags: 64 });
          }

          try {
            const clickerId = iJail.user.id;
            const walletClicker = economy.getWallet(clickerId, guildId);
            if (walletClicker.balance < jailCheck.bailAmount) {
              return iJail.reply({ content: `❌ Saldo Anda tidak mencukupi untuk menebus teman! Anda butuh Rp ${jailCheck.bailAmount.toLocaleString('id-ID')}, saldo Anda Rp ${walletClicker.balance.toLocaleString('id-ID')}`, flags: 64 });
            }

            // Potong dompet penebus
            economy.subtractBalance(clickerId, guildId, jailCheck.bailAmount, 'BAIL_FRIEND');
            // Bebaskan tahanan
            database.run("UPDATE wallets SET jail_until = 0, jail_type = '' WHERE user_id = ? AND guild_id = ?", [author.id, guildId]);
            // Catat hutang
            database.run(
              `INSERT INTO bail_debts (guild_id, debtor_id, creditor_id, amount) 
               VALUES (?, ?, ?, ?) 
               ON CONFLICT(guild_id, debtor_id, creditor_id) 
               DO UPDATE SET amount = amount + EXCLUDED.amount`,
              [guildId, author.id, clickerId, jailCheck.bailAmount]
            );

            const successEmb = embeds.successEmbed(
              'Teman Ditebus! 🤝🔓',
              `**<@${clickerId}>** telah menebus **<@${author.id}>** dari penjara virtual seharga **Rp ${jailCheck.bailAmount.toLocaleString('id-ID')}**!\n\n` +
              `👤 **<@${author.id}>** sekarang bebas berkeliaran dan berhutang **Rp ${jailCheck.bailAmount.toLocaleString('id-ID')}** kepada **<@${clickerId}>**!\n` +
              `💡 *<@${author.id}> dapat membayar hutang ini dengan mengetik \`.bayar-hutang @${iJail.user.username} [jumlah]\`.*`
            );
            await iJail.reply({ embeds: [successEmb] });
            await replyMsg.edit({ components: [] }).catch(() => { });
            collector.stop();
          } catch (err) {
            await iJail.reply({ content: `❌ Gagal menebus jaminan: ${err.message}`, flags: 64 });
          }
          return;
        }

        if (iJail.user.id !== author.id) {
          return iJail.reply({ content: '❌ Tombol ini hanya untuk tahanan yang bersangkutan!', flags: 64 });
        }

        try {
          if (iJail.customId === 'jail_btn_tebus') {
            const res = robbery.payBail(author.id, guildId);
            const successEmb = embeds.successEmbed(
              'Jaminan Ditebus! 🔓',
              `Anda telah membayar uang jaminan sebesar **Rp ${res.bailAmount.toLocaleString('id-ID')}** dan bebas dari penjara virtual!\n` +
              `💵 **Saldo Dompet Baru:** **Rp ${res.newBalance.toLocaleString('id-ID')}**`
            );
            await iJail.reply({ embeds: [successEmb] });
            await replyMsg.edit({ components: [] }).catch(() => { });
            collector.stop();
          }
        } catch (err) {
          await iJail.reply({ content: `❌ Gagal menebus jaminan: ${err.message}`, flags: 64 });
        }
      });

      return true;
    }
  }

  // ── COZY FLOWER GARDEN FEATURE GUARD & ROUTING ──
  const gardenCommands = ['kebun', 'garden', 'toko-kebun', 'gardenshop', 'tanam', 'siram', 'panen', 'jual-bunga', 'buket', 'gift-buket'];
  if (gardenCommands.includes(commandName)) {
    const isOwner = author.id === OWNER_ID;
    const isAdmin = message.member && message.member.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!config.garden.SYSTEM_ACTIVE && !isOwner && !isAdmin) {
      const warnEmb = embeds.warnEmbed(
        '🌸 Fitur Sedang Tahap Uji Coba! 🌸',
        `⚠️ **Mini-game Cozy Flower Garden saat ini sedang dikunci oleh Owner untuk keperluan pengujian.**\n\n` +
        `Tunggu pengumuman rilis resminya ya! ✨`
      );
      await autoReply({ embeds: [warnEmb] });
      return true; // Hentikan pemrosesan
    }

    await handleGardenCommand(message, client, args, commandName);
    return true; // Berhasil ditangani
  }

  // ═══════════════════════════════════════════════════
  // Perintah: .pet (Sistem Pet Tamagotchi Style)
  // ═══════════════════════════════════════════════════
  if (commandName === 'pet') {
    await handlePetCommand(message, client, args);
    return true;
  }

  // ═══════════════════════════════════════════════════
  // Perintah: .bm / .blackmarket (Pasar Gelap)
  // ═══════════════════════════════════════════════════
  if (commandName === 'bm' || commandName === 'blackmarket') {
    await handleBlackMarketCommand(message, client, args);
    return true;
  }

  // ═══════════════════════════════════════════════════
  // Perintah: .coinflip / .cf (Game Coinflip)
  // ═══════════════════════════════════════════════════
  if (commandName === 'coinflip' || commandName === 'cf') {
    await handleCoinflipCommand(message, client, args);
    return true;
  }
  // ═══════════════════════════════════════════════════
  // Perintah Admin: .pet-admin (Owner & Admin Only)
  // ═══════════════════════════════════════════════════
  if (commandName === 'pet-admin') {
    const isOwner = author.id === OWNER_ID;
    const isGuildOwner = message.guild && author.id === message.guild.ownerId;
    const isAdmin = message.member && message.member.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!isOwner && !isAdmin && !isGuildOwner) {
      return message.reply({ embeds: [embeds.errorEmbed('Akses Ditolak!', 'Hanya Administrator yang dapat menggunakan perintah pet-admin.')] });
    }
    await handlePetAdminCommand(message, client, args);
    return true;
  }

  // Pastikan instrumen saham default sudah terdaftar saat perintah dijalankan
  stocks.initDefaultStocks(guild);

  try {
    // ═══════════════════════════════════════════════════
    // Perintah: .rob @user
    // ═══════════════════════════════════════════════════
    if (commandName === 'rob') {
      const firstArg = args[0]?.toLowerCase();
      if (firstArg === 'announcement' || firstArg === 'anoncemen' || firstArg === 'info') {
        const robInfoEmbed = embeds.robAnnouncementEmbed(message.guild);
        return message.reply({ embeds: [robInfoEmbed] });
      }

      const targetUser = message.mentions.users.first();
      if (!targetUser) {
        return message.reply({ embeds: [embeds.errorEmbed('Format Salah!', 'Gunakan: \`.rob @user\` untuk merampok seseorang, atau \`.rob anoncemen\` untuk melihat info resiko & benefit.')] });
      }

      try {
        const res = robbery.robSolo(author.id, targetUser.id, guildId);

        let toolText = '';
        if (res.meatUsed) {
          toolText += '🥩 *Kamu melempar Daging Bius untuk menidurkan Alarm/CCTV korban!*\n';
        }
        if (res.lockpickUsed) {
          toolText += `🗝️ *Kamu menggunakan Linggis untuk mencungkil pintu (+15% peluang sukses)!*${res.lockpickBroken ? ' *(Brak! Linggis kamu patah setelah digunakan)*' : ''}\n`;
        }
        if (!res.victimClaimedDaily) {
          toolText += '🔓 *Korban lalai belum mengambil gaji harian (.daily) hari ini (peluang sukses naik menjadi 50%)!*\n';
        }

        if (res.success) {
          if (res.maskUsed) {
            // Hapus pesan pemicu agar nama tidak ketahuan
            message.delete().catch(() => { });

            const maskEmb = embeds.successEmbed(
              '🎭 Perampokan Bertopeng Misterius! 💰',
              toolText +
              `Seorang pencuri bertopeng misterius menyelinap masuk dan merampok **${targetUser.username}**!\n\n` +
              `💸 **Uang Dibawa Kabur:** **Rp ${res.amount.toLocaleString('id-ID')}** (Mencuri ${res.percent}% dari dompet target)${res.hasGembok ? ' *(Potong 50% karena target memiliki Gembok)*' : ''}.\n\n` +
              `*Identitas perampok tersembunyi berkat Topeng Samaran!*`
            );
            await message.channel.send({ embeds: [maskEmb] });
          } else {
            const successEmb = embeds.successEmbed(
              '💥 Perampokan Berhasil! 💰',
              toolText +
              `Anda berhasil merampok **${targetUser.username}**!\n\n` +
              `💸 **Uang Didapat:** **Rp ${res.amount.toLocaleString('id-ID')}** (Mencuri ${res.percent}% dari dompet target)${res.hasGembok ? ' *(Potong 50% karena target memiliki Gembok)*' : ''}.${res.petMsg}`
            );
            await message.reply({ embeds: [successEmb] });
          }
        } else {
          let failText = toolText;
          if (res.soapUsed) {
            failText += '🧼 *Kamu terpeleset dengan Sabun Licin saat dikejar polisi, memotong hukuman penjara 50%!*\n';
          }
          if (res.lamboUsed) {
            failText += '🏎️ *Kamu kabur mengendarai Lamborgini Kosan, memotong hukuman penjara sebesar 25%!*\n';
          }
          const failEmb = embeds.errorEmbed(
            '🚓 Perampokan Gagal! 👮',
            failText +
            `Anda gagal merampok **${targetUser.username}**!\n\n` +
            `💸 **Denda Kompensasi:** **Rp ${res.fine.toLocaleString('id-ID')}** (diberikan ke korban)${res.hasCctv ? ' *(Tambahan denda karena target memiliki CCTV)*' : ''}.\n` +
            `🔒 **Hukuman:** Dijebloskan ke **Penjara Virtual selama ${res.jailDurationMinutes} menit**!`
          );
          await message.reply({ embeds: [failEmb] });
        }
      } catch (err) {
        await message.reply({ embeds: [embeds.errorEmbed('Operasi Gagal!', err.message)] });
      }
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah: .heist
    // ═══════════════════════════════════════════════════
    if (commandName === 'heist') {
      const sub = args[0]?.toLowerCase();

      if (!sub || sub === 'start') {
        try {
          const lobby = robbery.startHeistLobby(author.id, guildId);
          const stats = robbery.getHeistStats(1);

          const lobbyEmbed = embeds.heistLobbyEmbed(
            guild,
            author,
            lobby.participants,
            90,
            stats.successRate,
            stats.minPrize,
            stats.maxPrize,
            lobby.prepFee
          );

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('heist_btn_join')
              .setLabel('🤝 Ikut Heist')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId('heist_btn_cancel')
              .setLabel('✖️ Batalkan Operasi')
              .setStyle(ButtonStyle.Danger)
          );

          const replyMsg = await message.reply({
            content: `🚨 **OPERASI PERAMPOKAN BANK DIMULAI!** 🚨`,
            embeds: [lobbyEmbed],
            components: [row]
          });

          // Waktu hitung mundur 90 detik
          let timeLeft = 90;
          const interval = setInterval(async () => {
            timeLeft -= 10;
            if (timeLeft <= 0) {
              clearInterval(interval);
              return;
            }

            const currentLobby = robbery.activeHeists.get(guildId);
            if (!currentLobby) {
              clearInterval(interval);
              return;
            }

            const currentStats = robbery.getHeistStats(currentLobby.participants.length);
            const updatedEmbed = embeds.heistLobbyEmbed(
              guild,
              author,
              currentLobby.participants,
              timeLeft,
              currentStats.successRate,
              currentStats.minPrize,
              currentStats.maxPrize,
              currentLobby.prepFee
            );

            await replyMsg.edit({ embeds: [updatedEmbed] }).catch(() => { });
          }, 10000);

          // Pemicu timeout eksekusi otomatis setelah 90 detik
          lobby.timeout = setTimeout(async () => {
            clearInterval(interval);
            try {
              const currentLobby = robbery.activeHeists.get(guildId);
              if (!currentLobby) return;

              const res = robbery.executeHeist(guildId);
              const resultEmbed = embeds.heistResultEmbed(
                guild,
                res.success,
                res.participants,
                res.logs,
                res.totalReward,
                res.rewardPerPerson,
                res.fineAmount,
                res.jailHours
              );

              let contentMsg = `💥 **OPERASI BANK HEIST SELESAI!**`;
              if (!res.success && res.soapUsedUsers && res.soapUsedUsers.length > 0) {
                const mentions = res.soapUsedUsers.map(u => `<@${u}>`).join(', ');
                contentMsg += `\n🧼 **Sabun Licin Terpakai!** ${mentions} menggunakan Sabun Licin untuk memotong waktu penjara heist sebesar 50%!`;
              }

              await replyMsg.edit({
                content: contentMsg,
                embeds: [resultEmbed],
                components: []
              }).catch(async () => {
                await message.channel.send({
                  content: contentMsg,
                  embeds: [resultEmbed]
                });
              });
            } catch (err) {
              console.error(err);
              await message.channel.send({ content: `❌ Gagal mengeksekusi heist: ${err.message}` });
            }
          }, 90000);

          // Collector untuk tombol interaksi
          const collector = replyMsg.createMessageComponentCollector({
            time: 90000
          });

          collector.on('collect', async iHeist => {
            try {
              if (iHeist.customId === 'heist_btn_join') {
                const updatedLobby = robbery.joinHeistLobby(iHeist.user.id, guildId);
                const currentStats = robbery.getHeistStats(updatedLobby.participants.length);

                const updatedEmbed = embeds.heistLobbyEmbed(
                  guild,
                  author,
                  updatedLobby.participants,
                  timeLeft,
                  currentStats.successRate,
                  currentStats.minPrize,
                  currentStats.maxPrize,
                  updatedLobby.prepFee
                );

                await iHeist.reply({ content: `🤝 Anda berhasil bergabung dengan tim heist! Biaya persiapan Rp ${updatedLobby.prepFee} terpotong.`, flags: 64 });
                await replyMsg.edit({ embeds: [updatedEmbed] }).catch(() => { });
              }

              else if (iHeist.customId === 'heist_btn_cancel') {
                if (iHeist.user.id !== author.id) {
                  return iHeist.reply({ content: '❌ Hanya inisiator (otak kriminal) yang bisa membatalkan operasi!', flags: 64 });
                }

                clearInterval(interval);
                robbery.cancelHeistLobby(author.id, guildId);

                await iHeist.reply({ content: '✖️ Operasi bank heist dibatalkan dan biaya persiapan telah dikembalikan ke seluruh kru.', ephemeral: false });
                await replyMsg.edit({
                  content: '❌ **Operasi bank heist dibatalkan oleh inisiator.**',
                  embeds: [],
                  components: []
                }).catch(() => { });
                collector.stop();
              }
            } catch (err) {
              await iHeist.reply({ content: `❌ Error: ${err.message}`, flags: 64 });
            }
          });

          collector.on('end', () => {
            clearInterval(interval);
          });

        } catch (err) {
          await message.reply({ embeds: [embeds.errorEmbed('Gagal Memulai Heist!', err.message)] });
        }
      }
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah: .jail
    // ═══════════════════════════════════════════════════
    if (commandName === 'jail') {
      const targetUser = message.mentions.users.first() || author;
      const jailInfo = robbery.checkJail(targetUser.id, guildId);

      if (!jailInfo.jailed) {
        return message.reply({ embeds: [embeds.successEmbed('Status Penjara', `🟢 **${targetUser.username}** bebas berkeliaran dan tidak sedang di penjara!`)] });
      }

      const jailEmbed = embeds.jailStatusEmbed(targetUser, jailInfo.remaining, jailInfo.bailAmount);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('jail_btn_tebus_status')
          .setLabel('🔓 Tebus Sendiri')
          .setStyle(ButtonStyle.Success)
          .setDisabled(targetUser.id !== author.id),
        new ButtonBuilder()
          .setCustomId('jail_btn_tebus_teman_status')
          .setLabel('🤝 Tebus Teman (Hutang)')
          .setStyle(ButtonStyle.Primary)
      );
      let components = [row];

      const replyMsg = await message.reply({
        content: `👮 **Status Tahanan Virtual**`,
        embeds: [jailEmbed],
        components
      });

      const collector = replyMsg.createMessageComponentCollector({ time: 60000 });
      collector.on('collect', async iJail => {
        if (iJail.customId === 'jail_btn_tebus_teman_status') {
          if (iJail.user.id === targetUser.id) {
            return iJail.reply({ content: '❌ Anda tidak bisa menebus diri sendiri melalui tombol ini! Gunakan tombol Tebus Sendiri.', flags: 64 });
          }

          try {
            const clickerId = iJail.user.id;
            const walletClicker = economy.getWallet(clickerId, guildId);
            if (walletClicker.balance < jailInfo.bailAmount) {
              return iJail.reply({ content: `❌ Saldo Anda tidak mencukupi untuk menebus teman! Anda butuh Rp ${jailInfo.bailAmount.toLocaleString('id-ID')}, saldo Anda Rp ${walletClicker.balance.toLocaleString('id-ID')}`, flags: 64 });
            }

            // Potong dompet penebus
            economy.subtractBalance(clickerId, guildId, jailInfo.bailAmount, 'BAIL_FRIEND');
            // Bebaskan tahanan
            database.run("UPDATE wallets SET jail_until = 0, jail_type = '' WHERE user_id = ? AND guild_id = ?", [targetUser.id, guildId]);
            // Catat hutang
            database.run(
              `INSERT INTO bail_debts (guild_id, debtor_id, creditor_id, amount) 
               VALUES (?, ?, ?, ?) 
               ON CONFLICT(guild_id, debtor_id, creditor_id) 
               DO UPDATE SET amount = amount + EXCLUDED.amount`,
              [guildId, targetUser.id, clickerId, jailInfo.bailAmount]
            );

            const successEmb = embeds.successEmbed(
              'Teman Ditebus! 🤝🔓',
              `**<@${clickerId}>** telah menebus **<@${targetUser.id}>** dari penjara virtual seharga **Rp ${jailInfo.bailAmount.toLocaleString('id-ID')}**!\n\n` +
              `👤 **<@${targetUser.id}>** sekarang bebas berkeliaran dan berhutang **Rp ${jailInfo.bailAmount.toLocaleString('id-ID')}** kepada **<@${clickerId}>**!\n` +
              `💡 *<@${targetUser.id}> dapat membayar hutang ini dengan mengetik \`.bayar-hutang @${iJail.user.username} [jumlah]\`.*`
            );
            await iJail.reply({ embeds: [successEmb] });
            await replyMsg.edit({ components: [] }).catch(() => { });
            collector.stop();
          } catch (err) {
            await iJail.reply({ content: `❌ Gagal menebus jaminan: ${err.message}`, flags: 64 });
          }
          return;
        }

        if (iJail.customId === 'jail_btn_tebus_status') {
          if (iJail.user.id !== targetUser.id) {
            return iJail.reply({ content: '❌ Tombol ini hanya untuk tahanan yang bersangkutan!', flags: 64 });
          }

          try {
            const res = robbery.payBail(targetUser.id, guildId);
            const successEmb = embeds.successEmbed(
              'Jaminan Ditebus! 🔓',
              `Anda telah membayar uang jaminan sebesar **Rp ${res.bailAmount.toLocaleString('id-ID')}** dan bebas dari penjara virtual!\n` +
              `💵 **Saldo Dompet Baru:** **Rp ${res.newBalance.toLocaleString('id-ID')}**`
            );
            await iJail.reply({ embeds: [successEmb] });
            await replyMsg.edit({ components: [] }).catch(() => { });
            collector.stop();
          } catch (err) {
            await iJail.reply({ content: `❌ Gagal menebus jaminan: ${err.message}`, flags: 64 });
          }
        }
      });
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah: .bayar-hutang / .bayarhutang / .paydebt
    // ═══════════════════════════════════════════════════
    if (commandName === 'bayar-hutang' || commandName === 'bayarhutang' || commandName === 'paydebt') {
      const targetUser = message.mentions.users.first();
      if (!targetUser) {
        return message.reply({ embeds: [embeds.warnEmbed('Target Diperlukan!', 'Format: `.bayar-hutang @user [jumlah]`\nContoh: `.bayar-hutang @Joe 500`')] });
      }

      if (targetUser.id === author.id) {
        return message.reply({ embeds: [embeds.warnEmbed('Target Tidak Valid!', 'Anda tidak bisa membayar hutang ke diri sendiri!')] });
      }

      const debt = database.get(
        'SELECT amount FROM bail_debts WHERE guild_id = ? AND debtor_id = ? AND creditor_id = ?',
        [guildId, author.id, targetUser.id]
      );

      if (!debt || debt.amount <= 0) {
        return message.reply({ embeds: [embeds.warnEmbed('Tidak Ada Hutang!', `Anda tidak memiliki hutang tebusan ke **${targetUser.username}**!`)] });
      }

      const wallet = economy.getWallet(author.id, guildId);
      if (wallet.balance <= 0) {
        return message.reply({ embeds: [embeds.warnEmbed('Saldo Habis!', 'Saldo dompet Anda kosong (Rp 0). Anda tidak bisa membayar hutang.')] });
      }

      let amountToPay = args[1] ? parseInt(args[1]) : debt.amount;
      if (isNaN(amountToPay) || amountToPay <= 0) {
        amountToPay = debt.amount; // fallback ke lunas
      }

      amountToPay = Math.min(amountToPay, wallet.balance, debt.amount);

      database.transaction(() => {
        // Potong dompet pembayar
        economy.subtractBalance(author.id, guildId, amountToPay, 'PAY_DEBT');
        // Tambah dompet penerima
        economy.addBalance(targetUser.id, guildId, amountToPay, 'RECEIVE_DEBT_PAYMENT');

        // Kurangi hutang
        const newDebtAmount = debt.amount - amountToPay;
        if (newDebtAmount <= 0) {
          database.run(
            'DELETE FROM bail_debts WHERE guild_id = ? AND debtor_id = ? AND creditor_id = ?',
            [guildId, author.id, targetUser.id]
          );
        } else {
          database.run(
            'UPDATE bail_debts SET amount = ? WHERE guild_id = ? AND debtor_id = ? AND creditor_id = ?',
            [newDebtAmount, guildId, author.id, targetUser.id]
          );
        }
      })();

      const remains = debt.amount - amountToPay;
      const remainsText = remains > 0 ? `Sisa hutang Anda: **Rp ${remains.toLocaleString('id-ID')}**` : '✨ **Hutang Anda ke dia sekarang LUNAS!**';

      const successEmb = embeds.successEmbed(
        'Pembayaran Hutang Sukses! 💸',
        `Anda telah membayar **Rp ${amountToPay.toLocaleString('id-ID')}** kepada **${targetUser.username}** untuk melunasi hutang tebusan Anda.\n\n` +
        `${remainsText}`
      );
      return message.reply({ embeds: [successEmb] });
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: .heist-admin
    // ═══════════════════════════════════════════════════
    if (commandName === 'heist-admin') {
      const isOwner = author.id === OWNER_ID;
      const isGuildOwner = message.guild && author.id === message.guild.ownerId;
      const isAdmin = message.member && message.member.permissions.has(PermissionsBitField.Flags.Administrator);
      if (!isOwner && !isAdmin && !isGuildOwner) {
        return message.reply({ embeds: [embeds.errorEmbed('Akses Ditolak!', 'Hanya Administrator yang dapat menggunakan perintah heist-admin.')] });
      }

      const sub = args[0]?.toLowerCase();
      if (sub === 'free' || sub === 'release') {
        const target = message.mentions.users.first();
        if (!target) {
          return message.reply({ embeds: [embeds.errorEmbed('Format Salah!', 'Gunakan: `.heist-admin free @user` untuk membebaskan paksa seseorang.')] });
        }

        try {
          robbery.adminFreeUser(target.id, guildId);
          await message.reply({ embeds: [embeds.successEmbed('Bebas Paksa!', `👮 **${target.username}** telah dibebaskan dari penjara virtual oleh administrator.`)] });
        } catch (err) {
          await message.reply({ embeds: [embeds.errorEmbed('Gagal Membebaskan!', err.message)] });
        }
      }

      else if (sub === 'reset-cooldown' || sub === 'reset') {
        try {
          robbery.adminResetCooldown(guildId);
          await message.reply({ embeds: [embeds.successEmbed('Reset Cooldown!', '🚨 Cooldown global bank heist untuk server ini telah disetel ulang.')] });
        } catch (err) {
          await message.reply({ embeds: [embeds.errorEmbed('Gagal Reset Cooldown!', err.message)] });
        }
      }

      else {
        return message.reply({
          embeds: [
            embeds.errorEmbed('Subcommand Tidak Dikenal!', 'Pilihan: `.heist-admin free @user` atau `.heist-admin reset`')
          ]
        });
      }
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah: .event / .events
    // ═══════════════════════════════════════════════════
    if (commandName === 'event' || commandName === 'events') {
      const events = require('./events');
      const activeEvent = events.getActiveEvent(guildId);
      const embed = embeds.eventStatusEmbed(activeEvent);
      await message.reply({ embeds: [embed] });
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah: .kos / .kosan
    // ═══════════════════════════════════════════════════
    if (commandName === 'kos' || commandName === 'kosan') {
      const firstArg = args[0]?.toLowerCase();
      if (firstArg === 'announcement' || firstArg === 'anoncemen' || firstArg === 'info') {
        const kosInfoEmbed = embeds.kosAnnouncementEmbed(message.guild);
        return message.reply({ embeds: [kosInfoEmbed] });
      }

      const kos = require('./kos');
      const getDashboardData = (userId, guildId) => {
        const wallet = economy.getWallet(userId, guildId);
        const activeRental = kos.getActiveRental(userId, guildId);
        const upgrades = kos.getUpgrades(userId, guildId);

        const embed = embeds.kosDashboardEmbed(author, wallet, activeRental, upgrades);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('kos_btn_nav_sewa')
            .setLabel('🛎️ Sewa Kamar')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('kos_btn_nav_upgrade')
            .setLabel('🛒 Belanja Fasilitas')
            .setStyle(ButtonStyle.Success)
        );

        return { embeds: [embed], components: [row] };
      };

      const initialData = getDashboardData(author.id, guildId);
      const replyMsg = await message.reply(initialData);

      const collector = replyMsg.createMessageComponentCollector({
        time: 120000
      });

      collector.on('collect', async iKos => {
        if (iKos.user.id !== author.id) {
          return iKos.reply({ content: '❌ Tombol ini bukan untuk Anda!', flags: 64 });
        }

        try {
          if (iKos.customId === 'kos_btn_nav_sewa') {
            collector.stop();
            await replyMsg.delete().catch(() => { });
            await handleKosSewaCommand(message, client);
          } else if (iKos.customId === 'kos_btn_nav_upgrade') {
            collector.stop();
            await replyMsg.delete().catch(() => { });
            await handleKosUpgradeCommand(message, client);
          }
        } catch (err) {
          console.error('Error in kos dashboard interaction:', err);
        }
      });

      collector.on('end', async () => {
        if (collector.destroyed) return;
        const freshData = getDashboardData(author.id, guildId);
        freshData.components = [];
        await replyMsg.edit(freshData).catch(() => { });
      });

      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah: .kos-sewa / .sewakos
    // ═══════════════════════════════════════════════════
    if (commandName === 'kos-sewa' || commandName === 'sewakos') {
      await handleKosSewaCommand(message, client);
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah: .kos-upgrade / .upgradekos
    // ═══════════════════════════════════════════════════
    if (commandName === 'kos-upgrade' || commandName === 'upgradekos') {
      await handleKosUpgradeCommand(message, client);
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah: .bank (Sistem Perbankan Premium)
    // ═══════════════════════════════════════════════════
    if (commandName === 'bank') {
      const firstArg = args[0]?.toLowerCase();
      if (firstArg === 'announcement' || firstArg === 'anoncemen' || firstArg === 'info') {
        const bankInfoEmbed = embeds.bankAnnouncementEmbed(message.guild);
        return message.reply({ embeds: [bankInfoEmbed] });
      }

      const getBankDashboardData = (userId, guildId) => {
        const wallet = economy.getWallet(userId, guildId);
        const savings = bank.getSavings(userId, guildId);
        const activeLoan = bank.getActiveLoan(userId, guildId);
        const maxLimit = bank.calculateMaxLoanLimit(userId, guildId);

        const embed = embeds.bankDashboardEmbed(author, wallet, savings, activeLoan, maxLimit);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('bank_btn_deposit')
            .setLabel('📥 Deposit')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('bank_btn_withdraw')
            .setLabel('📤 Tarik Uang')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('bank_btn_loan')
            .setLabel('📜 Pinjam Uang')
            .setStyle(ButtonStyle.Success)
            .setDisabled(!!activeLoan),
          new ButtonBuilder()
            .setCustomId('bank_btn_repay')
            .setLabel('💳 Bayar Utang')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(!activeLoan)
        );

        return { embeds: [embed], components: [row] };
      };

      const initialData = getBankDashboardData(author.id, guildId);
      const replyMsg = await message.reply(initialData);

      const collector = replyMsg.createMessageComponentCollector({
        time: 120000
      });

      collector.on('collect', async iBank => {
        if (iBank.user.id !== author.id) {
          return iBank.reply({ content: '❌ Tombol ini bukan untuk Anda!', flags: 64 });
        }

        try {
          if (iBank.customId === 'bank_btn_deposit') {
            const modal = new ModalBuilder()
              .setCustomId('bank_modal_deposit')
              .setTitle('🏛️ Deposit Tabungan Bank');

            const amountInput = new TextInputBuilder()
              .setCustomId('deposit_amount')
              .setLabel('Jumlah koin (angka atau "all")')
              .setPlaceholder('Contoh: 5000')
              .setStyle(TextInputStyle.Short)
              .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
            await iBank.showModal(modal);

            const submitted = await iBank.awaitModalSubmit({
              filter: (sub) => sub.customId === 'bank_modal_deposit' && sub.user.id === author.id,
              time: 60000
            }).catch(() => null);

            if (submitted) {
              try {
                const res = bank.depositSavings(author.id, guildId, submitted.fields.getTextInputValue('deposit_amount'));
                const roomTierName = res.roomTier === 'DEFAULT' ? 'Biasa / Tanpa Sewa' : 
                                     res.roomTier === 'KIPAS' ? '💨 Kamar Kipas Angin' :
                                     res.roomTier === 'AC' ? '❄️ Kamar AC' : '👑 Penthouse Kosan';
                const taxSavedMsg = res.roomTier === 'DEFAULT' ? '💡 *Naikkan sewa kamar kosan untuk menikmati potongan pajak deposit bank harian!*' :
                                    res.roomTier === 'PENTHOUSE' ? '👑 *Keanggotaan Penthouse: Pajak deposit dibebaskan 100%!*' :
                                    `✨ *Diskon Kamar kosan aktif: Pajak hanya ${res.taxRate}%!*`;

                const successEmb = embeds.bankSuccessEmbed(
                  'Deposit Tabungan Berhasil!',
                  `Koin disetor: **Rp ${res.amount.toLocaleString('id-ID')}**\n` +
                  `✂️ Pajak Administrasi (${res.taxRate}%): **-Rp ${res.tax.toLocaleString('id-ID')}** (Dibakar)\n` +
                  `📥 Bersih masuk Bank: **Rp ${res.netAmount.toLocaleString('id-ID')}**\n` +
                  `🏢 Kasta Sewa Kamar: **${roomTierName}**\n\n` +
                  `🏦 **Saldo Bank Baru:** **Rp ${res.savingsBalance.toLocaleString('id-ID')}**\n` +
                  `💵 **Sisa Dompet:** **Rp ${res.walletBalance.toLocaleString('id-ID')}**\n───────────────────\n` +
                  taxSavedMsg
                );
                await submitted.reply({ embeds: [successEmb] });

                const freshData = getBankDashboardData(author.id, guildId);
                await replyMsg.edit(freshData).catch(console.error);
              } catch (err) {
                await submitted.reply({ embeds: [embeds.bankErrorEmbed('Deposit Gagal!', err.message)] });
              }
            }
          }

          else if (iBank.customId === 'bank_btn_withdraw') {
            const modal = new ModalBuilder()
              .setCustomId('bank_modal_withdraw')
              .setTitle('🏛️ Penarikan Saldo Bank');

            const amountInput = new TextInputBuilder()
              .setCustomId('withdraw_amount')
              .setLabel('Jumlah koin (angka atau "all")')
              .setPlaceholder('Contoh: 10000')
              .setStyle(TextInputStyle.Short)
              .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
            await iBank.showModal(modal);

            const submitted = await iBank.awaitModalSubmit({
              filter: (sub) => sub.customId === 'bank_modal_withdraw' && sub.user.id === author.id,
              time: 60000
            }).catch(() => null);

            if (submitted) {
              try {
                const res = bank.withdrawSavings(author.id, guildId, submitted.fields.getTextInputValue('withdraw_amount'));
                const roomTierName = res.roomTier === 'DEFAULT' ? 'Biasa / Tanpa Sewa' : 
                                     res.roomTier === 'KIPAS' ? '💨 Kamar Kipas Angin' :
                                     res.roomTier === 'AC' ? '❄️ Kamar AC' : '👑 Penthouse Kosan';
                const taxSavedMsg = res.roomTier === 'DEFAULT' ? '💡 *Naikkan sewa kamar kosan untuk menikmati potongan pajak penarikan bank harian!*' :
                                    res.roomTier === 'PENTHOUSE' ? '👑 *Keanggotaan Penthouse: Pajak penarikan dibebaskan 100%!*' :
                                    `✨ *Diskon Kamar kosan aktif: Pajak hanya ${res.taxRate}%!*`;

                const successEmb = embeds.bankSuccessEmbed(
                  'Penarikan Saldo Berhasil!',
                  `Koin ditarik: **Rp ${res.amount.toLocaleString('id-ID')}**\n` +
                  `✂️ Pajak Penarikan (${res.taxRate}%): **-Rp ${res.tax.toLocaleString('id-ID')}** (Dibakar)\n` +
                  `💰 Bersih diterima Dompet: **Rp ${res.netAmount.toLocaleString('id-ID')}**\n` +
                  `🏢 Kasta Sewa Kamar: **${roomTierName}**\n\n` +
                  `🏦 **Sisa Saldo Bank:** **Rp ${res.savingsBalance.toLocaleString('id-ID')}**\n` +
                  `💵 **Saldo Dompet Baru:** **Rp ${res.walletBalance.toLocaleString('id-ID')}**\n───────────────────\n` +
                  taxSavedMsg
                );
                await submitted.reply({ embeds: [successEmb] });

                const freshData = getBankDashboardData(author.id, guildId);
                await replyMsg.edit(freshData).catch(console.error);
              } catch (err) {
                await submitted.reply({ embeds: [embeds.bankErrorEmbed('Penarikan Gagal!', err.message)] });
              }
            }
          }

          else if (iBank.customId === 'bank_btn_loan') {
            // Tampilkan dropdown pilihan tenor
            const selectMenu = new StringSelectMenuBuilder()
              .setCustomId('bank_select_tenor')
              .setPlaceholder('👉 Pilih jangka tempo (Tenor)...')
              .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('🟢 1 Hari (Bunga 2%)').setDescription('Cocok untuk bursa saham jangka pendek.').setValue('1'),
                new StringSelectMenuOptionBuilder().setLabel('🟡 3 Hari (Bunga 5%)').setDescription('Pilihan seimbang untuk alokasi modal sedang.').setValue('3'),
                new StringSelectMenuOptionBuilder().setLabel('🔴 7 Hari (Bunga 10%)').setDescription('Pinjaman jangka panjang untuk mengejar kasta role.').setValue('7')
              );

            const tenorRow = new ActionRowBuilder().addComponents(selectMenu);
            const cancelBtn = new ButtonBuilder().setCustomId('bank_loan_cancel').setLabel('✖️ Batalkan').setStyle(ButtonStyle.Secondary);
            const cancelRow = new ActionRowBuilder().addComponents(cancelBtn);

            const askTenorMsg = await iBank.reply({
              content: '💡 **PILIH JANGKA TEMPO PINJAMAN (TENOR)**\nSilakan pilih jangka waktu pengembalian utang di bawah ini:',
              components: [tenorRow, cancelRow]
            });
            await iBank.fetchReply().then(m => { Object.assign(askTenorMsg, m); }).catch(() => {});

            const tenorCollector = askTenorMsg.createMessageComponentCollector({
              time: 60000
            });

            tenorCollector.on('collect', async iTenor => {
              if (iTenor.user.id !== author.id) {
                return iTenor.reply({ content: '❌ Pilihan ini bukan untuk Anda!', flags: 64 });
              }

              if (iTenor.customId === 'bank_loan_cancel') {
                tenorCollector.stop();
                await iTenor.update({ content: '❌ Pengajuan pinjaman dibatalkan.', components: [] });
              } else if (iTenor.customId === 'bank_select_tenor') {
                tenorCollector.stop();
                const selectedTenor = parseInt(iTenor.values[0]);
                const maxLimit = bank.calculateMaxLoanLimit(author.id, guildId);

                const modal = new ModalBuilder()
                  .setCustomId(`bank_modal_loan_${selectedTenor}`)
                  .setTitle(`📜 Pinjam Tenor ${selectedTenor} Hari`);

                const loanInput = new TextInputBuilder()
                  .setCustomId('loan_amount')
                  .setLabel(`Jumlah pinjaman (Maks Rp ${maxLimit.toLocaleString('id-ID')})`)
                  .setPlaceholder('Contoh: 10000')
                  .setStyle(TextInputStyle.Short)
                  .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(loanInput));
                await iTenor.showModal(modal);

                // Bersihkan pesan pemilihan tenor agar rapi
                await askTenorMsg.delete().catch(() => { });

                const submitted = await iTenor.awaitModalSubmit({
                  filter: (sub) => sub.customId === `bank_modal_loan_${selectedTenor}` && sub.user.id === author.id,
                  time: 60000
                }).catch(() => null);

                if (submitted) {
                  try {
                    const amountStr = submitted.fields.getTextInputValue('loan_amount');
                    const res = bank.createLoan(author.id, guildId, amountStr, selectedTenor);
                    const dueText = `<t:${res.dueAt}:F> (<t:${res.dueAt}:R>)`;

                    const successEmb = embeds.bankSuccessEmbed(
                      'Pengajuan Pinjaman Disetujui!',
                      `Pinjaman Anda berhasil dicairkan!\n\n` +
                      `💵 **Nominal Pokok:** **Rp ${res.principal.toLocaleString('id-ID')}**\n` +
                      `📈 **Suku Bunga:** \`${(res.interestRate * 100).toFixed(0)}%\` (Tenor \`${res.tenorDays} Hari\`)\n` +
                      `💳 **Total Tagihan:** **Rp ${res.totalDue.toLocaleString('id-ID')}**\n` +
                      `📅 **Batas Pelunasan:** ${dueText}\n\n` +
                      `*Koin telah ditambahkan ke dompet Anda. Saldo dompet Anda sekarang: Rp ${res.walletBalance.toLocaleString('id-ID')}*`
                    );

                    await submitted.reply({ embeds: [successEmb] });

                    const freshData = getBankDashboardData(author.id, guildId);
                    await replyMsg.edit(freshData).catch(console.error);
                  } catch (err) {
                    await submitted.reply({ embeds: [embeds.bankErrorEmbed('Pinjaman Ditolak!', err.message)] });
                  }
                }
              }
            });

            tenorCollector.on('end', async () => {
              await askTenorMsg.delete().catch(() => { });
            });
          }

          else if (iBank.customId === 'bank_btn_repay') {
            try {
              const res = bank.repayLoan(author.id, guildId);
              let desc = '';

              if (res.isFullyPaid) {
                desc = `Selamat! Utang pinjaman Anda telah **LUNAS SEPENUHNYA**.\n\n` +
                  `💳 **Koin Dibayarkan:** **Rp ${res.amountPaid.toLocaleString('id-ID')}**\n` +
                  `💵 **Sisa Saldo Dompet:** **Rp ${res.walletBalance.toLocaleString('id-ID')}**`;
              } else {
                desc = `Pembayaran cicilan berhasil diproses!\n\n` +
                  `💳 **Koin Dibayarkan:** **Rp ${res.amountPaid.toLocaleString('id-ID')}**\n` +
                  `⚠️ **Sisa Utang:** **Rp ${res.remainingDebt.toLocaleString('id-ID')}**\n` +
                  `💵 **Saldo Dompet Sekarang:** **Rp 0** (Koin lunas cicilan)`;
              }

              const successEmb = embeds.bankSuccessEmbed(
                res.isFullyPaid ? 'Pelunasan Pinjaman Sukses!' : 'Pembayaran Cicilan Diproses!',
                desc
              );

              await iBank.reply({ embeds: [successEmb] });

              const freshData = getBankDashboardData(author.id, guildId);
              await replyMsg.edit(freshData).catch(console.error);
            } catch (err) {
              await iBank.reply({ embeds: [embeds.bankErrorEmbed('Gagal Membayar Utang!', err.message)] });
            }
          }
        } catch (err) {
          console.error('Error in bank interactive collector:', err);
        }
      });

      collector.on('end', async () => {
        if (collector.destroyed) return;
        const freshData = getBankDashboardData(author.id, guildId);
        freshData.components = freshData.components.map(row => {
          const freshRow = new ActionRowBuilder();
          row.components.forEach(comp => {
            const freshBtn = ButtonBuilder.from(comp).setDisabled(true);
            freshRow.addComponents(freshBtn);
          });
          return freshRow;
        });
        await replyMsg.edit(freshData).catch(() => { });
      });

      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah: .balance / .bal / .profile
    // ═══════════════════════════════════════════════════
    if (commandName === 'balance' || commandName === 'bal' || commandName === 'profile') {
      const targetUser = message.mentions.users.first() || author;
      const targetMember = message.mentions.members.first() || message.member || await guild.members.fetch(targetUser.id).catch(() => null);
      const wallet = economy.getWallet(targetUser.id, guildId);
      const porto = stocks.getPortfolio(targetUser.id, guildId);
      const shopItems = database.all('SELECT * FROM shop_items WHERE guild_id = ?', [guildId]);
      const userPet = pet.getPet(targetUser.id, guildId);
      const activeLoan = bank.getActiveLoan(targetUser.id, guildId);

      const debts = database.all('SELECT creditor_id, amount FROM bail_debts WHERE debtor_id = ? AND guild_id = ?', [targetUser.id, guildId]);
      const receivables = database.all('SELECT debtor_id, amount FROM bail_debts WHERE creditor_id = ? AND guild_id = ?', [targetUser.id, guildId]);
      const bailDebts = { debts, receivables };

      const embed = embeds.profileEmbed(targetUser, wallet, porto.totalPortfolioValue, targetMember, shopItems, userPet, activeLoan, bailDebts, porto.items);
      await message.reply({ embeds: [embed] });
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah: .autotrade / .autoinvest
    // ═══════════════════════════════════════════════════
    if (commandName === 'autotrade' || commandName === 'autoinvest') {
      const wallet = economy.getWallet(author.id, guildId);
      const isAutoActive = wallet.auto_trade === 1;

      const embed = new EmbedBuilder()
        .setColor(isAutoActive ? embeds.COLORS.SUCCESS : embeds.COLORS.WARN)
        .setTitle(`🤖 ROBOT AUTO-INVEST & AUTO-TRADING — ${author.username}`)
        .setThumbnail(author.displayAvatarURL({ dynamic: true }))
        .setDescription(
          `Kelola robot investasi otomatis untuk portofolio saham server Anda!\n\n` +
          `🤖 **Status Robot:** ${isAutoActive ? '🟢 **AKTIF (Running)**' : '🔴 **NON-AKTIF (Stopped)**'}\n\n` +
          `📈 **Cara Kerja & Aturan Bot:**\n` +
          `1️⃣ **Auto DCA (Buy-the-Dip)**: Setiap 2 jam sekali, jika Anda memiliki saldo menganggur $\\ge$ **Rp 150**, robot akan otomatis menggunakan maksimal **30%** dari saldo Anda untuk membeli saham termurah yang terdaftar di bursa.\n` +
          `2️⃣ **Auto Take-Profit (TP)**: Jika saham yang Anda miliki mengalami kenaikan keuntungan **$\\ge$ 15%** dari harga beli rata-rata Anda, robot akan otomatis melikuidasi saham tersebut untuk mengamankan keuntungan koin Anda!\n` +
          `3️⃣ **Laporan Otomatis**: Setiap aksi transaksi otomatis robot akan dilaporkan ke channel bursa server secara real-time!\n\n` +
          `*Gunakan tombol di bawah untuk mengaktifkan atau menonaktifkan robot trading Anda secara instan!*`
        )
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('eco_btn_autotrade_toggle')
          .setLabel(isAutoActive ? '🔴 Nonaktifkan Robot' : '🟢 Aktifkan Robot')
          .setStyle(isAutoActive ? ButtonStyle.Danger : ButtonStyle.Success)
      );

      const replyMsg = await message.reply({ embeds: [embed], components: [row] });

      const collector = replyMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000
      });

      collector.on('collect', async i => {
        if (i.user.id !== author.id) {
          return i.reply({ content: '❌ Tombol ini hanya bisa digunakan oleh pemanggil perintah asli!', flags: 64 });
        }

        try {
          const freshWallet = economy.getWallet(author.id, guildId);
          const newStatus = freshWallet.auto_trade === 1 ? 0 : 1;

          database.run(
            'UPDATE wallets SET auto_trade = ? WHERE user_id = ? AND guild_id = ?',
            [newStatus, author.id, guildId]
          );

          const updatedWallet = economy.getWallet(author.id, guildId);
          const isNowActive = updatedWallet.auto_trade === 1;

          const updatedEmbed = new EmbedBuilder()
            .setColor(isNowActive ? embeds.COLORS.SUCCESS : embeds.COLORS.WARN)
            .setTitle(`🤖 ROBOT AUTO-INVEST & AUTO-TRADING — ${author.username}`)
            .setThumbnail(author.displayAvatarURL({ dynamic: true }))
            .setDescription(
              `Kelola robot investasi otomatis untuk portofolio saham server Anda!\n\n` +
              `🤖 **Status Robot:** ${isNowActive ? '🟢 **AKTIF (Running)**' : '🔴 **NON-AKTIF (Stopped)**'}\n\n` +
              `Status robot trading Anda berhasil diperbarui!\n` +
              `${isNowActive ? '🎉 Robot sekarang aktif bekerja mencari profit bagi Anda!' : '⚠️ Robot telah dihentikan. Portofolio Anda kini kembali dikelola manual.'}`
            )
            .setTimestamp();

          const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('eco_btn_autotrade_toggle')
              .setLabel(isNowActive ? '🤖 Robot Aktif' : '🤖 Robot Nonaktif')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true)
          );

          await i.update({ embeds: [updatedEmbed], components: [disabledRow] });
          collector.stop();
        } catch (err) {
          console.error('Error toggling auto-trade:', err);
          await i.reply({ content: '❌ Terjadi kesalahan saat memproses status robot.', flags: 64 }).catch(() => { });
        }
      });

      collector.on('end', async () => {
        await replyMsg.edit({ components: [] }).catch(() => { });
      });

      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah: .daily
    // ═══════════════════════════════════════════════════
    if (commandName === 'daily') {
      const activeLoan = bank.getActiveLoan(author.id, guildId);
      if (activeLoan && activeLoan.status === 'OVERDUE') {
        const totalDebt = activeLoan.total_due + (activeLoan.penalty_accumulated || 0);
        return message.reply({
          embeds: [
            embeds.bankErrorEmbed(
              'Gaji Harian Dibekukan!',
              `Klaim harian Anda ditangguhkan karena Anda memiliki tunggakan pinjaman yang **OVERDUE** senilai **Rp ${totalDebt.toLocaleString('id-ID')}**!\n\n` +
              `*Segera ketik \`.bank\` dan klik tombol [Bayar Utang] untuk melunasi tunggakan Anda!*`
            )
          ]
        });
      }
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
          `💸 Pajak Transfer (${res.taxRatePercent}%): \`Rp ${res.tax.toLocaleString('id-ID')}\`\n` +
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

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('eco_btn_porto')
          .setLabel('💼 Portofolio')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('eco_btn_profile')
          .setLabel('💰 Profil & Saldo')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('eco_btn_shop')
          .setLabel('🛍️ Toko Role')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('eco_btn_gacha')
          .setLabel('🎲 Gacha Role')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('eco_btn_trade')
          .setLabel('📈 Beli/Jual Saham')
          .setStyle(ButtonStyle.Success)
      );

      const marketMsg = await message.reply({ embeds: [embed], components: [row] });

      const collector = marketMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120000 // 2 menit transaksi
      });

      collector.on('collect', async i => {
        if (i.user.id !== author.id) {
          return i.reply({ content: '❌ Tombol ini hanya bisa digunakan oleh orang yang memanggil perintah ini!', flags: 64 });
        }

        try {
          if (i.customId === 'eco_btn_porto') {
            const porto = stocks.getPortfolio(author.id, guildId);
            const wallet = economy.getWallet(author.id, guildId);
            const portoEmbed = embeds.portfolioEmbed(author, porto, wallet);
            await i.reply({ embeds: [portoEmbed] });
          } else if (i.customId === 'eco_btn_profile') {
            const wallet = economy.getWallet(author.id, guildId);
            const porto = stocks.getPortfolio(author.id, guildId);
            const shopItems = database.all('SELECT * FROM shop_items WHERE guild_id = ?', [guildId]);
            const debts = database.all('SELECT creditor_id, amount FROM bail_debts WHERE debtor_id = ? AND guild_id = ?', [author.id, guildId]);
            const receivables = database.all('SELECT debtor_id, amount FROM bail_debts WHERE creditor_id = ? AND guild_id = ?', [author.id, guildId]);
            const bailDebts = { debts, receivables };
            const profileEmbed = embeds.profileEmbed(author, wallet, porto.totalPortfolioValue, i.member, shopItems, null, null, bailDebts, porto.items);
            await i.reply({ embeds: [profileEmbed] });
          } else if (i.customId === 'eco_btn_shop') {
            const wallet = economy.getWallet(author.id, guildId);
            const items = database.all('SELECT * FROM shop_items WHERE guild_id = ?', [guildId]);
            const shopEmbed = embeds.shopEmbed(items, wallet);
            await i.reply({ embeds: [shopEmbed] });
          } else if (i.customId === 'eco_btn_gacha') {
            await executeGachaRoll({
              replyTarget: i,
              user: author,
              guild,
              guildId,
              client,
              isInteraction: true,
              member: i.member
            });
          } else if (i.customId === 'eco_btn_trade') {
            const latestStocks = stocks.getStocks(guildId);
            if (latestStocks.length === 0) {
              return i.reply({ content: '❌ Tidak ada instrumen saham aktif di server ini!', flags: 64 });
            }
            await sendInteractiveTradePanel(i, latestStocks[0].stock_ticker, author, guildId, client);
          }
        } catch (err) {
          console.error('Error handling button click in market panel:', err);
          await i.reply({ content: '❌ Terjadi kesalahan saat memproses permintaan Anda.', flags: 64 }).catch(() => { });
        }
      });

      collector.on('end', async () => {
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('eco_btn_porto').setLabel('💼 Portofolio').setStyle(ButtonStyle.Primary).setDisabled(true),
          new ButtonBuilder().setCustomId('eco_btn_profile').setLabel('💰 Profil & Saldo').setStyle(ButtonStyle.Success).setDisabled(true),
          new ButtonBuilder().setCustomId('eco_btn_shop').setLabel('🛍️ Toko Role').setStyle(ButtonStyle.Secondary).setDisabled(true),
          new ButtonBuilder().setCustomId('eco_btn_gacha').setLabel('🎲 Gacha Role').setStyle(ButtonStyle.Danger).setDisabled(true),
          new ButtonBuilder().setCustomId('eco_btn_trade').setLabel('📈 Beli/Jual Saham').setStyle(ButtonStyle.Success).setDisabled(true)
        );
        await marketMsg.edit({ components: [disabledRow] }).catch(() => { });
      });

      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah: .stock <ticker> & .chart <ticker>
    // ═══════════════════════════════════════════════════
    if (commandName === 'stock') {
      const ticker = args[0];
      await sendStockChartOrDetail(message, ticker, false, client);
      return true;
    }

    if (commandName === 'chart' || commandName === 'saham-chart') {
      const ticker = args[0];
      await sendStockChartOrDetail(message, ticker, true, client);
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

      // TTS Komentator jika volume >= 50 lembar
      if (shares >= 50) {
        client.emit('playTtsEvent', {
          guildId,
          text: `Wow gila sih! Sultan ${author.username} baru saja memborong ${shares} lembar saham ${res.ticker} senilai total ${res.totalPrice} Rupiah! Hype banget bursa hari ini!`,
          lang: 'id'
        });
      }
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

      // TTS Komentator jika volume >= 50 lembar
      if (shares >= 50) {
        client.emit('playTtsEvent', {
          guildId,
          text: `Perhatian warga server! Sultan ${author.username} baru saja menjual ${shares} lembar saham ${res.ticker} senilai total ${res.finalRevenue} Rupiah! Likuiditas pasar meningkat tajam!`,
          lang: 'id'
        });
      }
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

      // TTS Komentator jika volume >= 50 lembar
      if (portfolio.shares >= 50) {
        client.emit('playTtsEvent', {
          guildId,
          text: `Perhatian warga server! Sultan ${author.username} baru saja melikuidasi seluruh ${portfolio.shares} lembar saham ${res.ticker} senilai total ${res.finalRevenue} Rupiah! Pergerakan modal yang sangat besar!`,
          lang: 'id'
        });
      }
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
    // Perintah: .rich / .leaderboard / .liderbot
    // ═══════════════════════════════════════════════════
    if (commandName === 'rich' || commandName === 'leaderboard' || commandName === 'liderbot') {
      const embed = embeds.warnEmbed(
        'Papan Peringkat Dinonaktifkan! ❌',
        'Perintah `.rich` manual sudah tidak digunakan lagi.\n\n👉 Silakan lihat papan peringkat realtime terbaru di channel: <#1510230591860113418>!'
      );
      await message.reply({ embeds: [embed] });
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah: .indexrole / .roleindex / .myroles
    // ═══════════════════════════════════════════════════
    if (commandName === 'indexrole' || commandName === 'roleindex' || commandName === 'myroles') {
      const items = database.all('SELECT * FROM shop_items WHERE guild_id = ?', [guildId]);
      const memberObj = message.member || await guild.members.fetch(author.id).catch(() => null);
      if (!memberObj) {
        return message.reply({ embeds: [embeds.errorEmbed('Gagal Memproses!', 'Gagal mengambil data profil anggota Discord Anda.')] });
      }

      const embed = embeds.indexRoleEmbed(author, memberObj, items);
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

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('eco_btn_profile')
          .setLabel('💰 Profil & Saldo')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('eco_btn_gacha')
          .setLabel('🎲 Gacha Role')
          .setStyle(ButtonStyle.Danger)
      );

      const shopMsg = await message.reply({ embeds: [embed], components: [row] });

      const collector = shopMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120000 // 2 menit navigasi
      });

      collector.on('collect', async i => {
        if (i.user.id !== author.id) {
          return i.reply({ content: '❌ Tombol ini hanya bisa digunakan oleh orang yang memanggil perintah ini!', flags: 64 });
        }

        try {
          if (i.customId === 'eco_btn_profile') {
            const wallet = economy.getWallet(author.id, guildId);
            const porto = stocks.getPortfolio(author.id, guildId);
            const shopItems = database.all('SELECT * FROM shop_items WHERE guild_id = ?', [guildId]);
            const userPet = pet.getPet(author.id, guildId);
            const activeLoan = bank.getActiveLoan(author.id, guildId);
            const debts = database.all('SELECT creditor_id, amount FROM bail_debts WHERE debtor_id = ? AND guild_id = ?', [author.id, guildId]);
            const receivables = database.all('SELECT debtor_id, amount FROM bail_debts WHERE creditor_id = ? AND guild_id = ?', [author.id, guildId]);
            const bailDebts = { debts, receivables };
            const profileEmbed = embeds.profileEmbed(author, wallet, porto.totalPortfolioValue, i.member, shopItems, userPet, activeLoan, bailDebts, porto.items);
            await i.reply({ embeds: [profileEmbed] });
          } else if (i.customId === 'eco_btn_gacha') {
            await executeGachaRoll({
              replyTarget: i,
              user: author,
              guild,
              guildId,
              client,
              isInteraction: true,
              member: i.member
            });
          }
        } catch (err) {
          console.error('Error handling button click in shop:', err);
          await i.reply({ content: '❌ Terjadi kesalahan saat memproses permintaan Anda.', flags: 64 }).catch(() => { });
        }
      });

      collector.on('end', async () => {
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('eco_btn_profile').setLabel('💰 Profil & Saldo').setStyle(ButtonStyle.Success).setDisabled(true),
          new ButtonBuilder().setCustomId('eco_btn_gacha').setLabel('🎲 Gacha Role').setStyle(ButtonStyle.Danger).setDisabled(true)
        );
        await shopMsg.edit({ components: [disabledRow] }).catch(() => { });
      });

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
        await memberObj.roles.remove(discordRole).catch(() => { });
        throw dbErr;
      }

      const successEmbed = embeds.rolePurchaseSuccessEmbed(author, item.role_name, item.price, finalWallet.balance, item.tier);
      await message.reply({ embeds: [successEmbed] });

      // Broadcast Heboh jika tingkat EPIC / LEGENDARY / MYTHIC
      if (item.tier === 'EPIC' || item.tier === 'LEGENDARY' || item.tier === 'MYTHIC') {
        const broadcastEmbed = embeds.broadcastMegaEmbed(author, item.role_name, item.price, item.tier);
        const reportChannel = guild.channels.cache.get(config.REPORT_CHANNEL_ID);
        if (reportChannel) {
          await reportChannel.send({ embeds: [broadcastEmbed] }).catch(() => { });
        } else {
          await message.channel.send({ embeds: [broadcastEmbed] }).catch(() => { });
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
      await executeGachaRoll({
        replyTarget: message,
        user: author,
        guild,
        guildId,
        client,
        isInteraction: false,
        member: message.member
      });
      return true;
    }

    // ═══════════════════════════════════════════════════
    // PROTEKSI ADMIN: Hanya bisa digunakan oleh Owner atau Administrator Guild
    // ═══════════════════════════════════════════════════
    const adminCommands = ['eco-give', 'eco-giveall', 'eco-take', 'market-add', 'market-remove', 'market-drop', 'eco-reset', 'eco-resetall', 'market-reinit', 'shop-add', 'shop-remove', 'shop-setstock', 'eco-announce', 'event-trigger', 'autoshoprole', 'shop-auto', 'anoncemen', 'announcement', 'dividends-trigger'];
    if (adminCommands.includes(commandName)) {
      const isOwner = author.id === OWNER_ID;
      const isGuildOwner = message.guild && author.id === message.guild.ownerId;
      const isAdmin = message.member && message.member.permissions.has('Administrator');
      if (!isOwner && !isAdmin && !isGuildOwner) {
        return message.reply({ embeds: [embeds.accessDeniedEmbed(OWNER_ID)] });
      }
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: .event-trigger [tipe]
    // ═══════════════════════════════════════════════════
    if (commandName === 'event-trigger') {
      const targetType = args[0]?.toUpperCase();
      const events = require('./events');

      let selectedType = null;
      if (targetType) {
        if (events.EVENT_TYPES[targetType]) {
          selectedType = events.EVENT_TYPES[targetType];
        } else {
          // Cari substring match jika diketik tidak lengkap (e.g. crash -> MARKET_CRASH)
          const matched = Object.values(events.EVENT_TYPES).find(t => t.includes(targetType));
          if (matched) selectedType = matched;
        }
      }

      try {
        if (selectedType) {
          events.triggerEvent(client, guild, selectedType);
          const embed = embeds.successEmbed(
            'Event Berhasil Dipicu!',
            `Event **${selectedType}** berhasil dipicu untuk server ini.`
          );
          await message.reply({ embeds: [embed] });
        } else {
          events.triggerRandomEvent(client, guild);
          const embed = embeds.successEmbed(
            'Event Acak Dipicu!',
            `Satu event ekonomi acak berhasil dipicu untuk server ini.`
          );
          await message.reply({ embeds: [embed] });
        }
      } catch (err) {
        const errorEmbed = embeds.errorEmbed('Gagal Memicu Event!', err.message);
        await message.reply({ embeds: [errorEmbed] });
      }
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: .dividends-trigger
    // ═══════════════════════════════════════════════════
    if (commandName === 'dividends-trigger') {
      const distributions = stocks.distributeWeeklyDividends(guildId);
      if (distributions.length === 0) {
        return message.reply({
          embeds: [embeds.warnEmbed('Tidak Ada Distribusi!', 'Tidak ada investor yang memiliki saham aktif saat ini untuk menerima dividen.')]
        });
      }

      let listText = '';
      distributions.slice(0, 10).forEach((d, idx) => {
        const user = client.users.cache.get(d.userId);
        const username = user ? user.username : `<@${d.userId}>`;
        listText += `💰 **${username}** — Dapat **Rp ${d.amount.toLocaleString('id-ID')}** dari **${d.ticker}** (Rate: \`${d.rate}%\`, Aktif: \`${d.activity}\`)\n`;
      });
      if (distributions.length > 10) {
        listText += `*...dan ${distributions.length - 10} transaksi dividen lainnya!*`;
      }

      // Cari channel utama untuk posting notifikasi dividen (prioritaskan REPORT_CHANNEL_ID jika diset)
      let targetChannel = null;
      if (config.REPORT_CHANNEL_ID) {
        targetChannel = guild.channels.cache.get(config.REPORT_CHANNEL_ID);
      }
      if (!targetChannel) {
        targetChannel = guild.systemChannel || Array.from(guild.channels.cache.values()).find(
          c => c.name.includes('general') || c.name.includes('chat') || c.name.includes('bot')
        );
      }

      if (targetChannel) {
        const embed = new EmbedBuilder()
          .setColor(0x00FF88)
          .setTitle('💸 DISTRIBUSI DIVIDEN BURSA (MANUAL TRIGGER) 📈')
          .setDescription(
            `📢 **Pengumuman Bursa:** Pembayaran dividen mingguan dinamis berbasis keaktifan chat warga telah dipicu secara manual oleh Administrator!\n\n` +
            `Member yang memegang saham channel aktif menerima tingkat keuntungan (rate) dividen yang jauh lebih tinggi! 🔥\n\n` +
            `👉 **Total Distribusi:** **${distributions.length} transaksi**\n` +
            `👉 **Rincian Penerima Dividen:**\n${listText || '*Tidak ada transaksi*'}\n\n` +
            `*Periksa portofolio & saldo terbaru Anda sekarang dengan mengetik \`.porto\` atau \`.bal\`!*`
          )
          .setTimestamp();

        await targetChannel.send({ embeds: [embed] }).catch(() => { });
      }

      const successEmbed = embeds.successEmbed(
        'Dividen Berhasil Didistribusikan!',
        `Sukses mendistribusikan dividen dinamis ke **${distributions.length} investor** server.`
      );
      await message.reply({ embeds: [successEmbed] });
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: .saham-update / .saham-update-harga
    // ═══════════════════════════════════════════════════
    if (commandName === 'saham-update' || commandName === 'saham-update-harga') {
      const updates = stocks.updateStockPrices(guildId);
      if (updates.length === 0) {
        return message.reply({ embeds: [embeds.warnEmbed('Tidak Ada Saham!', 'Tidak ada instrumen saham aktif untuk di-update di server ini.')] });
      }

      let updateText = '';
      // Helper: buat activity bar visual
      const getActivityBar = (score, maxScore = 100) => {
        const barLen = 8;
        const filled = Math.min(barLen, Math.max(0, Math.round((score / maxScore) * barLen)));
        return '█'.repeat(filled) + '░'.repeat(barLen - filled);
      };

      // Hitung statistik ringkasan
      const gainers = updates.filter(u => u.changePct > 0 && !u.isPumped);
      const losers = updates.filter(u => u.changePct < 0 && !u.isCrashed);
      const pumped = updates.filter(u => u.isPumped);
      const crashed = updates.filter(u => u.isCrashed);

      updates.forEach((u, idx) => {
        let trendBadge = '';
        let trendArrow = '';
        let priceColor = '';
        const sign = u.changePct >= 0 ? '+' : '';

        if (u.isCrashed) {
          trendBadge = '\n> ⚠️ `「  BUBBLE BURST / CRASH  」` 💀';
          trendArrow = '💥';
          priceColor = '🔴';
        } else if (u.isPumped) {
          trendBadge = '\n> 🎯 `「  BULL RUN / PUMPED  」` 🔥';
          trendArrow = '🚀';
          priceColor = '🟢';
        } else if (u.changePct > 0) {
          trendArrow = '📈';
          priceColor = '🟢';
        } else if (u.changePct < 0) {
          trendArrow = '📉';
          priceColor = '🔴';
        } else {
          trendArrow = '↔️';
          priceColor = '⚪';
        }

        const activityBar = getActivityBar(u.activity);

        updateText += `> ${priceColor} **${u.ticker}** · \`#${u.name}\`\n`;
        updateText += `> ┊ 💵 Harga   ─  **Rp ${u.newPrice.toLocaleString('id-ID')}**  ·  ${trendArrow} \`${sign}${u.changePct}%\`\n`;
        updateText += `> ┊ ⚡ Aktivitas ─  \`${activityBar}\` \`${u.activity.toFixed(1)} poin\``;
        updateText += trendBadge;
        updateText += '\n\n';
      });

      // Summary bar
      let summaryLine = '```\n';
      summaryLine += `  📊 Ringkasan:  `;
      const summaryParts = [];
      if (pumped.length > 0)  summaryParts.push(`🚀 ${pumped.length} Pumped`);
      if (gainers.length > 0) summaryParts.push(`🟢 ${gainers.length} Naik`);
      if (losers.length > 0)  summaryParts.push(`🔴 ${losers.length} Turun`);
      if (crashed.length > 0) summaryParts.push(`💀 ${crashed.length} Crash`);
      summaryLine += summaryParts.join('  │  ') || '⚪ Stabil';
      summaryLine += '\n```';

      const reportEmbed = new EmbedBuilder()
        .setColor(0x00FF88)
        .setTitle(`📈  LAPORAN PERGERAKAN SAHAM (MANUAL)  ─  ${guild.name}`)
        .setDescription(
          `${summaryLine}\n` +
          `${updateText}` +
          `─────────────────────────────────────`
        )
        .setFooter({ text: `Sentinel Bot  •  Manual Update by Admin  •  ${updates.length} saham diperbarui` })
        .setTimestamp();

      await message.reply({ embeds: [reportEmbed] });
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: .eco-give @user <jumlah> / random [min] [max]
    // ═══════════════════════════════════════════════════
    if (commandName === 'eco-give') {
      const targetUser = message.mentions.users.first();
      if (!targetUser) {
        return message.reply({ embeds: [embeds.warnEmbed('Format Salah!', 'Harap sebutkan user yang ingin diberikan koin.\nContoh: `.eco-give @user 5000` atau `.eco-give @user random 1000 5000`')] });
      }

      const isRandom = args.some(arg => arg.toLowerCase() === 'random');
      let amount = 0;
      let minRange = 1000;
      let maxRange = 10000;

      if (isRandom) {
        const numbers = args.filter(arg => {
          if (arg.toLowerCase() === 'random') return false;
          if (arg.startsWith('<@') && arg.endsWith('>')) return false;
          return !isNaN(parseInt(arg));
        }).map(arg => parseInt(arg));

        if (numbers.length >= 2) {
          minRange = Math.min(numbers[0], numbers[1]);
          maxRange = Math.max(numbers[0], numbers[1]);
        } else if (numbers.length === 1) {
          minRange = numbers[0];
          maxRange = numbers[0] * 5;
        }

        if (minRange <= 0) minRange = 1;
        if (maxRange < minRange) maxRange = minRange;

        amount = Math.floor(Math.random() * (maxRange - minRange + 1)) + minRange;
      } else {
        const numbers = args.filter(arg => !arg.startsWith('<@') || !arg.endsWith('>'))
          .map(arg => parseInt(arg))
          .filter(num => !isNaN(num) && num > 0);
        if (numbers.length > 0) {
          amount = numbers[0];
        }
      }

      if (amount <= 0) {
        return message.reply({ embeds: [embeds.warnEmbed('Format Salah!', 'Tentukan jumlah koin berupa angka di atas 0.\nContoh: `.eco-give @user 5000` atau `.eco-give @user random 1000 5000`')] });
      }

      economy.addBalance(targetUser.id, guildId, amount, 'ADMIN_GIVE');

      let desc = `Berhasil memberikan **Rp ${amount.toLocaleString('id-ID')}** koin kepada <@${targetUser.id}>!`;
      if (isRandom) {
        desc = `🎰 **HOKI ACAK!** Berhasil memberikan koin acak sejumlah **Rp ${amount.toLocaleString('id-ID')}** *(Rentang: Rp ${minRange.toLocaleString('id-ID')} - Rp ${maxRange.toLocaleString('id-ID')})* kepada <@${targetUser.id}>!`;
      }

      const embed = embeds.successEmbed(
        isRandom ? 'Koin Acak Berhasil Diberikan!' : 'Koin Berhasil Diberikan!',
        desc
      );
      await message.reply({ embeds: [embed] });
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: .eco-giveall <jumlah> / random [min] [max]
    // ═══════════════════════════════════════════════════
    if (commandName === 'eco-giveall') {
      const isRandom = args.some(arg => arg.toLowerCase() === 'random');
      let amount = 0;
      let minRange = 1000;
      let maxRange = 10000;

      if (isRandom) {
        const numbers = args.filter(arg => {
          if (arg.toLowerCase() === 'random') return false;
          return !isNaN(parseInt(arg));
        }).map(arg => parseInt(arg));

        if (numbers.length >= 2) {
          minRange = Math.min(numbers[0], numbers[1]);
          maxRange = Math.max(numbers[0], numbers[1]);
        } else if (numbers.length === 1) {
          minRange = numbers[0];
          maxRange = numbers[0] * 5;
        }

        if (minRange <= 0) minRange = 1;
        if (maxRange < minRange) maxRange = minRange;
      } else {
        const numbers = args.map(arg => parseInt(arg)).filter(num => !isNaN(num) && num > 0);
        if (numbers.length > 0) {
          amount = numbers[0];
        }
      }

      if (!isRandom && amount <= 0) {
        return message.reply({ embeds: [embeds.warnEmbed('Format Salah!', 'Tentukan jumlah koin berupa angka di atas 0.\nContoh: `.eco-giveall 5000` atau `.eco-giveall random 1000 5000`')] });
      }

      const statusEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('⚙️ MEMPROSES BAGI-BAGI KOIN...')
        .setDescription('Sedang mendistribusikan koin ke seluruh member server secara instan. Mohon tunggu...');
      const statusMsg = await message.reply({ embeds: [statusEmbed] });

      const memberIds = new Set();

      // 1. Ambil dari database wallets terlebih dahulu (seluruh member historis online & offline yang punya saldo/data)
      try {
        const activeWallets = database.all('SELECT user_id FROM wallets WHERE guild_id = ?', [guildId]);
        activeWallets.forEach(w => {
          memberIds.add(w.user_id);
        });
      } catch (dbErr) {
        console.error('Gagal mengambil wallets dari db:', dbErr.message);
      }

      // 2. Ambil dari cache memori bot (member online/aktif saat ini)
      guild.members.cache.forEach(member => {
        if (!member.user.bot) {
          memberIds.add(member.id);
        }
      });

      // 3. Tarik paksa seluruh member terbaru dari Discord API (tanpa timeout singkat yang membatalkan seluruh proses)
      try {
        const fetchedMembers = await guild.members.fetch({ force: true });
        for (const [id, member] of fetchedMembers) {
          if (!member.user.bot) {
            memberIds.add(id);
          }
        }
      } catch (err) {
        console.warn('Gagal fetch all members via Discord API:', err.message);
      }

      if (memberIds.size === 0) {
        const errEmbed = embeds.errorEmbed('Gagal!', 'Tidak dapat menemukan member untuk dibagikan koin.');
        return statusMsg.edit({ embeds: [errEmbed] });
      }

      let totalAmountGiven = 0;
      let memberCount = 0;

      try {
        // Optimasi: Gunakan satu database transaction tunggal agar proses batch sangat cepat (hanya milidetik) dan aman dari locked database!
        database.transaction(() => {
          for (const memberId of memberIds) {
            let giveAmount = amount;
            if (isRandom) {
              giveAmount = Math.floor(Math.random() * (maxRange - minRange + 1)) + minRange;
            }

            // Pastikan wallet terdaftar (getWallet logic inline)
            let wallet = database.get('SELECT user_id FROM wallets WHERE user_id = ? AND guild_id = ?', [memberId, guildId]);
            if (!wallet) {
              database.run(
                `INSERT INTO wallets (user_id, guild_id, balance, total_earned, last_message_at) 
                 VALUES (?, ?, ?, ?, ?)`,
                [memberId, guildId, 0, 0, 0]
              );
            }

            // Update saldo
            database.run(
              `UPDATE wallets 
               SET balance = balance + ?, total_earned = total_earned + ? 
               WHERE user_id = ? AND guild_id = ?`,
              [giveAmount, giveAmount, memberId, guildId]
            );

            // Catat transaksi
            database.run(
              `INSERT INTO transactions (user_id, guild_id, type, channel_id, amount) 
               VALUES (?, ?, ?, ?, ?)`,
              [memberId, guildId, 'ADMIN_GIVEALL', null, giveAmount]
            );

            totalAmountGiven += giveAmount;
            memberCount++;
          }
        })();
      } catch (dbErr) {
        console.error('Database error in eco-giveall:', dbErr);
        const errEmbed = embeds.errorEmbed('Database Error!', 'Terjadi kesalahan internal saat memperbarui saldo database.');
        return statusMsg.edit({ embeds: [errEmbed] });
      }

      const successTitle = isRandom ? '🎰 RAIN / AIRDROP KOIN ACAK SUKSES! 💸' : '📢 BAGI-BAGI KOIN MASSAL SUKSES! 💸';

      let successDesc = '';
      if (isRandom) {
        successDesc = `👑 **KEMAKMURAN UNTUK SEMUA!**\n\n` +
          `Owner / Administrator telah menyebarkan koin keberuntungan acak kepada **${memberCount} member** server (baik yang sedang **online** maupun **offline**)! 👥✨\n\n` +
          `📊 **Metode Distribusi:** \`🎰 Acak (Random Roll)\`\n` +
          `📈 **Rentang Hadiah:** \`Rp ${minRange.toLocaleString('id-ID')} - Rp ${maxRange.toLocaleString('id-ID')}\` per member\n` +
          `💰 **Total Koin Tersebar:** **Rp ${totalAmountGiven.toLocaleString('id-ID')}** koin\n\n` +
          `*Setiap warga menerima jumlah koin acak masing-masing yang unik. Cek saldo Anda dengan perintah \`.bal\`!* 🚀`;
      } else {
        successDesc = `👑 **DISTRIBUSI KESEJAHTERAAN SELESAI!**\n\n` +
          `Owner / Administrator telah membagikan koin secara merata kepada **${memberCount} member** server (baik yang sedang **online** maupun **offline**)! 👥✨\n\n` +
          `📊 **Metode Distribusi:** \`💵 Tetap (Fixed Amount)\`\n` +
          `📈 **Nominal per Member:** **Rp ${amount.toLocaleString('id-ID')}** koin\n` +
          `💰 **Total Koin Terdistribusi:** **Rp ${totalAmountGiven.toLocaleString('id-ID')}** koin\n\n` +
          `*Kesejahteraan Anda telah dijamin! Silakan cek dompet masing-masing menggunakan perintah \`.bal\`!* 🚀`;
      }

      const successEmbed = new EmbedBuilder()
        .setColor(0x00FF88)
        .setTitle(successTitle)
        .setDescription(successDesc)
        .setThumbnail(guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL())
        .setFooter({ text: 'Rupiah Server • Kesejahteraan Rakyat' })
        .setTimestamp();

      await statusMsg.edit({ embeds: [successEmbed] });
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
    if (commandName === 'eco-announce' || commandName === 'anoncemen' || commandName === 'announcement') {
      const targetChannel = message.mentions.channels.first() || message.channel;

      if (!targetChannel.isTextBased()) {
        return message.reply('❌ Channel target harus berupa text channel!');
      }

      const botPermissions = targetChannel.permissionsFor(message.guild.members.me);
      if (!botPermissions.has('SendMessages') || !botPermissions.has('EmbedLinks')) {
        return message.reply(`❌ Bot tidak memiliki izin \`Send Messages\` atau \`Embed Links\` di channel ${targetChannel}!`);
      }

      try {
        // Kirim Multi-Embed Pengumuman Premium & Rapi dengan tag @everyone
        const announcementEmbeds = embeds.updateAnnouncementEmbeds(message.guild);

        // Bagi embed menjadi 3 pesan terpisah untuk menghindari batas 6000 karakter Discord
        // Pesan 1: Hero Header & Voice/Economy
        await targetChannel.send({
          content: '📢 **PENGUMUMAN RESMI — ENSIKLOPEDIA LENGKAP FITUR & PERINTAH SENTINEL BOT 2026!** @everyone\n\n🏠 *Baca seluruh panduan di bawah ini agar kamu tidak ketinggalan fitur apapun!*',
          embeds: [announcementEmbeds[0], announcementEmbeds[1]],
          allowedMentions: { parse: ['everyone'] }
        });

        // Pesan 2: Bursa Saham & Bank/Kosan
        await targetChannel.send({
          embeds: [announcementEmbeds[2], announcementEmbeds[3]]
        });

        // Pesan 3: Pet/Rob & Game/Tips/Penutup
        await targetChannel.send({
          embeds: [announcementEmbeds[4], announcementEmbeds[5]]
        });

        if (targetChannel.id !== message.channel.id) {
          await message.reply(`✅ **Berhasil!** Pengumuman ensiklopedia premium lengkap (**${announcementEmbeds.length} embed** terbagi dalam 3 pesan) telah diposting di channel ${targetChannel}.`);
        }
      } catch (err) {
        console.error('Error sending announcement:', err);
        await message.reply({ embeds: [embeds.errorEmbed('Gagal Mengirim Pengumuman!', err.message)] });
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
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: .market-drop <ticker> <persen>
    // ═══════════════════════════════════════════════════
    if (commandName === 'market-drop') {
      const ticker = args[0];
      const percentArg = args[1];

      if (!ticker || !percentArg) {
        return message.reply({ embeds: [embeds.warnEmbed('Format Salah!', 'Contoh: `.market-drop $LOUNGE 15` (Menurunkan harga saham $LOUNGE sebesar 15%)')] });
      }

      const stock = stocks.getStock(guildId, ticker);
      if (!stock) {
        return message.reply({ embeds: [embeds.warnEmbed('Saham Tidak Ditemukan!', `Ticker \`${ticker}\` tidak ditemukan di bursa.`)] });
      }

      const percent = parseInt(percentArg);
      if (isNaN(percent) || percent < 1 || percent > 99) {
        return message.reply({ embeds: [embeds.warnEmbed('Nilai Tidak Valid!', 'Tingkat penurunan harus berupa angka bulat antara 1 hingga 99 persen!')] });
      }

      const oldPrice = stock.current_price;
      const newPrice = Math.max(config.market.MIN_PRICE, Math.round(oldPrice * (1 - percent / 100)));

      database.transaction(() => {
        database.run(
          'UPDATE stocks SET previous_price = ?, current_price = ? WHERE channel_id = ? AND guild_id = ?',
          [oldPrice, newPrice, stock.channel_id, guildId]
        );
        database.run(
          'INSERT INTO price_history (channel_id, guild_id, price, activity_score) VALUES (?, ?, ?, 0.0)',
          [stock.channel_id, guildId, newPrice]
        );
      })();

      const successEmbed = embeds.successEmbed(
        '📉 Harga Saham Diturunkan!',
        `Berhasil menurunkan harga saham **${stock.stock_ticker}** (#${stock.stock_name}) sebesar **${percent}%** secara manual!\n\n` +
        `💵 **Harga Lama:** Rp ${oldPrice.toLocaleString('id-ID')} ➔ **Harga Baru:** Rp ${newPrice.toLocaleString('id-ID')}`
      );
      await message.reply({ embeds: [successEmbed] });

      // Kirim notifikasi ke channel info bursa saham
      const reportChannel = guild.channels.cache.get(config.REPORT_CHANNEL_ID);
      if (reportChannel) {
        const notifyEmbed = new EmbedBuilder()
          .setColor(embeds.COLORS.ERROR)
          .setTitle('🚨 BREAKING NEWS: BENCANA FINANSIAL & INTERVENSI PASAR SAHAM! 🚨')
          .setDescription(
            `📢 **PENGUMUMAN MUSIBAH BURSA SAHAM:** Otoritas Jasa Keuangan Server mendadak mengintervensi lantai bursa dan melakukan pemangkasan harga saham secara paksa! Kepanikan luar biasa dilaporkan melanda para investor!\n\n` +
            `🎯 **Saham Terdampak:** **${stock.stock_ticker}** (#${stock.stock_name})\n` +
            `👉 **Kebijakan Ekstrim:** Penurunan Harga Instan Sebesar **-${percent}%** 💀\n` +
            `💵 **Harga Lama:** Rp ${oldPrice.toLocaleString('id-ID')} ➔ **Harga Baru:** Rp ${newPrice.toLocaleString('id-ID')}\n\n` +
            `*Bagi warga server yang mengalami kerugian portofolio parah, harap tetap tenang dan dilarang merusak fasilitas umum kosan!*`
          )
          .setTimestamp();
        await reportChannel.send({ content: '@everyone', embeds: [notifyEmbed] }).catch(() => { });
      }
      return true;
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
    // Perintah Admin: .autoshoprole / .shop-auto
    // ═══════════════════════════════════════════════════
    if (commandName === 'autoshoprole' || commandName === 'shop-auto') {
      const rolesToCreate = [
        {
          tier: 'COMMON',
          name: '🥉 Common Prestige',
          color: '#979c9f',
          price: 15000,
          isGacha: 1,
          permissions: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AddReactions'],
          description: 'Role tingkat dasar. Menunjukkan kontribusi awal Anda di server.'
        },
        {
          tier: 'RARE',
          name: '🥈 Rare Elite',
          color: '#3498db',
          price: 75000,
          isGacha: 1,
          permissions: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AddReactions', 'EmbedLinks', 'AttachFiles', 'UseExternalEmojis'],
          description: 'Role tingkat RARE. Memberikan akses menyematkan tautan dan melampirkan berkas media!'
        },
        {
          tier: 'EPIC',
          name: '🔮 Primordial',
          color: '#70a1ff',
          price: 180000,
          isGacha: 1,
          permissions: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AddReactions', 'EmbedLinks', 'AttachFiles', 'UseExternalEmojis', 'Connect', 'Speak'],
          description: 'Role tingkat EPIC (Primordial). Membuka izin penuh terhubung dan berbicara di Voice Channel!'
        },
        {
          tier: 'EPIC',
          name: '🥇 Epic Champion',
          color: '#5f27cd',
          price: 350000,
          isGacha: 1,
          permissions: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AddReactions', 'EmbedLinks', 'AttachFiles', 'UseExternalEmojis', 'UseExternalStickers', 'CreatePublicThreads', 'CreatePrivateThreads'],
          description: 'Role tingkat EPIC. Membuka izin membuat thread obrolan serta menggunakan stiker eksternal!'
        },
        {
          tier: 'LEGENDARY',
          name: '👑 Legendary Overlord',
          color: '#9b59b6',
          price: 1500000,
          isGacha: 1,
          permissions: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AddReactions', 'EmbedLinks', 'AttachFiles', 'UseExternalEmojis', 'UseExternalStickers', 'CreatePublicThreads', 'CreatePrivateThreads', 'PrioritySpeaker', 'Connect', 'Speak', 'UseSoundboard', 'UseExternalSounds'],
          description: 'Role tingkat LEGENDARY! Memberikan status VIP legendaris beserta Priority Speaker dan Soundboard!'
        },
        {
          tier: 'LEGENDARY',
          name: '🌟 Zenith',
          color: '#e84393',
          price: 3000000,
          isGacha: 1,
          permissions: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AddReactions', 'EmbedLinks', 'AttachFiles', 'UseExternalEmojis', 'UseExternalStickers', 'CreatePublicThreads', 'CreatePrivateThreads', 'PrioritySpeaker', 'Connect', 'Speak', 'UseSoundboard', 'UseExternalSounds', 'MoveMembers'],
          description: 'Role tingkat LEGENDARY (Zenith). Memberikan hak memindahkan anggota (Move Members) di Voice Channel!'
        },
        {
          tier: 'MYTHIC',
          name: '🌟 Mythic Immortal',
          color: '#ff4757',
          price: 5000000,
          isGacha: 0,
          permissions: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AddReactions', 'EmbedLinks', 'AttachFiles', 'UseExternalEmojis', 'UseExternalStickers', 'CreatePublicThreads', 'CreatePrivateThreads', 'PrioritySpeaker', 'Connect', 'Speak', 'UseSoundboard', 'UseExternalSounds', 'MuteMembers', 'MoveMembers'],
          description: 'Role kasta tertinggi MYTHIC! Hanya dapat dibeli langsung tanpa gacha. Memberikan hak moderasi suara VIP (Mute & Move members)!'
        },
        {
          tier: 'MYTHIC',
          name: '✨ Aethelgard',
          color: '#e67e22',
          price: 10000000,
          isGacha: 0,
          permissions: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AddReactions', 'EmbedLinks', 'AttachFiles', 'UseExternalEmojis', 'UseExternalStickers', 'CreatePublicThreads', 'CreatePrivateThreads', 'PrioritySpeaker', 'Connect', 'Speak', 'UseSoundboard', 'UseExternalSounds', 'MuteMembers', 'MoveMembers', 'DeafenMembers'],
          description: 'Role kasta tertinggi MYTHIC (Aethelgard). Memberikan hak moderasi suara penuh termasuk Deafen Members!'
        },
        {
          tier: 'MYTHIC',
          name: '👑 The Sovereign',
          color: '#f1c40f',
          price: 25000000,
          isGacha: 0,
          permissions: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AddReactions', 'EmbedLinks', 'AttachFiles', 'UseExternalEmojis', 'UseExternalStickers', 'CreatePublicThreads', 'CreatePrivateThreads', 'PrioritySpeaker', 'Connect', 'Speak', 'UseSoundboard', 'UseExternalSounds', 'MuteMembers', 'MoveMembers', 'DeafenMembers', 'ManageMessages'],
          description: 'Role kasta tertinggi MYTHIC (The Sovereign). Memberikan hak moderasi teks (Manage Messages) dan moderasi suara penuh!'
        }
      ];

      const loadingMsg = await message.reply('⚙️ **[ SETUP TOKO ROLE ]** Memulai proses pembuatan/pembaruan role prestise di server Discord...');

      const results = [];
      const botMember = guild.members.me;

      // Periksa apakah bot memiliki izin dasar Manage Roles
      if (!botMember.permissions.has('ManageRoles')) {
        return loadingMsg.edit('❌ **Gagal Setup!** Bot tidak memiliki izin `Manage Roles` (Mengelola Peran) di server ini. Silakan aktifkan izin tersebut untuk bot terlebih dahulu!');
      }

      for (const roleDef of rolesToCreate) {
        try {
          // 1. Cari role yang sudah ada berdasarkan nama
          let discordRole = guild.roles.cache.find(r => r.name === roleDef.name);
          let actionType = 'CREATED';

          if (discordRole) {
            actionType = 'UPDATED';
            // Cek apakah posisi role bot di atas role yang ingin di-edit
            if (botMember.roles.highest.position <= discordRole.position) {
              results.push({
                ...roleDef,
                status: 'WARNING',
                message: `Role sudah ada, tetapi tidak dapat diperbarui karena posisi role bot berada di bawah role ini.`
              });
              continue;
            }

            // Edit role yang sudah ada agar perizinan & warna sesuai rarity terbaru
            await discordRole.edit({
              color: roleDef.color,
              permissions: PermissionsBitField.resolve(roleDef.permissions),
              reason: 'Sinkronisasi Auto Shop Role'
            });
          } else {
            // Buat role baru
            discordRole = await guild.roles.create({
              name: roleDef.name,
              color: roleDef.color,
              permissions: PermissionsBitField.resolve(roleDef.permissions),
              reason: 'Setup Auto Shop Role'
            });
          }

          // 2. Hubungkan ke database SQLite `shop_items`
          const existInDb = database.get('SELECT id FROM shop_items WHERE guild_id = ? AND role_name = ?', [guildId, roleDef.name]);

          if (existInDb) {
            database.run(
              `UPDATE shop_items 
               SET role_id = ?, price = ?, tier = ?, stock = -1, is_gacha = ?, description = ? 
               WHERE id = ? AND guild_id = ?`,
              [discordRole.id, roleDef.price, roleDef.tier, roleDef.isGacha, roleDef.description, existInDb.id, guildId]
            );
          } else {
            database.run(
              `INSERT INTO shop_items (guild_id, role_id, role_name, price, tier, stock, is_gacha, description) 
               VALUES (?, ?, ?, ?, ?, -1, ?, ?)`,
              [guildId, discordRole.id, roleDef.name, roleDef.price, roleDef.tier, roleDef.isGacha, roleDef.description]
            );
          }

          results.push({
            ...roleDef,
            roleId: discordRole.id,
            status: 'SUCCESS',
            action: actionType
          });
        } catch (roleErr) {
          console.error(`Error setup role ${roleDef.name}:`, roleErr);
          results.push({
            ...roleDef,
            status: 'ERROR',
            message: roleErr.message
          });
        }
      }

      // 3. Bangun embed laporan premium
      const setupEmbed = new EmbedBuilder()
        .setColor(embeds.COLORS.PURPLE)
        .setTitle('🎮 STATUS SETUP TOKO ROLE PRESTISE')
        .setDescription(
          `Proses sinkronisasi otomatis role khusus per kelangkaan (*rarity*) telah selesai dijalankan!\n\n` +
          `⚠️ **PENTING:** Pastikan posisi role bot Anda di **Server Settings > Roles** berada di atas role-role di bawah ini agar bot dapat membagikannya kepada pembeli.`
        )
        .setTimestamp();

      results.forEach(res => {
        const statusEmoji = res.status === 'SUCCESS' ? '✅' : res.status === 'WARNING' ? '⚠️' : '❌';
        const actionLabel = res.status === 'SUCCESS' ? (res.action === 'CREATED' ? '*(Baru Dibuat)*' : '*(Diperbarui)*') : '';
        const priceFormatted = embeds.formatCurrency(res.price);

        let valueText = '';
        if (res.status === 'SUCCESS') {
          valueText = `• **ID:** <@&${res.roleId}>\n` +
            `• **Harga:** ${priceFormatted}\n` +
            `• **Gacha:** \`${res.isGacha ? 'Aktif' : 'Non-Aktif'}\`\n` +
            `• **Izin Utama:** \`${res.permissions.slice(4).join(', ') || 'Standar'}\``;
        } else {
          valueText = `• **Status:** Gagal\n` +
            `• **Error:** \`${res.message}\``;
        }

        setupEmbed.addFields({
          name: `${statusEmoji} ${res.name} (\`${res.tier}\`) ${actionLabel}`,
          value: valueText,
          inline: false
        });
      });

      setupEmbed.setFooter({ text: 'Rupiah Server • Auto Role Setup' });

      await loadingMsg.edit({ content: '✅ **Setup Toko Role Selesai!**', embeds: [setupEmbed] });
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
      if (inputTier && ['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'].includes(inputTier)) {
        tier = inputTier;
        descStartIndex = 3;
      } else {
        // Otomatis berdasarkan harga jika tier manual tidak didefinisikan
        if (price > 1000000) {
          tier = 'MYTHIC';
        } else if (price > 150000) {
          tier = 'LEGENDARY';
        } else if (price > 50000) {
          tier = 'EPIC';
        } else if (price > 15000) {
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
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: .ebyus-gacha <normal|easy|super_easy|abuse> [durasi_menit]
    // ═══════════════════════════════════════════════════
    if (commandName === 'ebyus-gacha') {
      if (!message.member || !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply({ content: '❌ Perintah ini hanya dapat dijalankan oleh Administrator!', flags: 64 });
      }

      const mode = args[0]?.toUpperCase();
      if (!mode || !['NORMAL', 'EASY', 'SUPER_EASY', 'ABUSE'].includes(mode)) {
        return message.reply({ embeds: [embeds.warnEmbed('Format Salah!', 'Tentukan mode gacha.\nFormat: `.ebyus-gacha <normal | easy | super_easy | abuse> [durasi_menit]`')] });
      }

      const durArg = args[1];
      let minutes = 0;
      if (durArg) {
        minutes = parseInt(durArg);
      }

      const getOrCreateEbyusSettings = (guildId) => {
        let settings = database.get('SELECT * FROM ebyus_settings WHERE guild_id = ?', [guildId]);
        if (!settings) {
          database.run('INSERT INTO ebyus_settings (guild_id, gacha_mode, coin_multiplier, updated_at, updated_by, expires_at) VALUES (?, ?, ?, ?, ?, 0)', [guildId, 'NORMAL', 1, 0, '']);
          settings = {
            guild_id: guildId,
            gacha_mode: 'NORMAL',
            coin_multiplier: 1,
            updated_at: 0,
            updated_by: '',
            expires_at: 0
          };
        }
        return settings;
      };

      getOrCreateEbyusSettings(guildId);
      const nowUnix = Math.floor(Date.now() / 1000);
      const expiresAt = minutes > 0 ? nowUnix + minutes * 60 : 0;
      database.run(
        'UPDATE ebyus_settings SET gacha_mode = ?, expires_at = ?, updated_at = ?, updated_by = ? WHERE guild_id = ?',
        [mode, expiresAt, nowUnix, author.id, guildId]
      );

      const statusMap = {
        NORMAL: '🟢 Normal Mode (75% Zonk)',
        EASY: '🟡 Easy Mode (40% Zonk - Peluang menang naik 2x)',
        SUPER_EASY: '🟠 Super Easy Mode (15% Zonk - Sangat mudah)',
        ABUSE: '🔴 Abuse Mode (0% Zonk - 100% PASTI MENANG ROLE!)'
      };

      let timeText = minutes > 0 ? ` selama **${minutes} menit** (auto-reset)` : ' secara **Permanen**';
      await message.reply(`✅ Sukses mengubah mode gacha server ini menjadi **${statusMap[mode]}**${timeText}.`);
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: .ebyus-coin <off|3|4|5|6|7|8> [durasi_menit]
    // ═══════════════════════════════════════════════════
    if (commandName === 'ebyus-coin') {
      if (!message.member || !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply({ content: '❌ Perintah ini hanya dapat dijalankan oleh Administrator!', flags: 64 });
      }

      const mulArg = args[0]?.toLowerCase();
      let multiplier = 1;
      if (mulArg && mulArg !== 'off') {
        multiplier = parseInt(mulArg);
      }

      if (isNaN(multiplier) || multiplier < 1 || multiplier > 8 || (multiplier > 1 && multiplier < 3)) {
        return message.reply({ embeds: [embeds.warnEmbed('Format Salah!', 'Tentukan pengali koin chat.\nFormat: `.ebyus-coin <off | 3 | 4 | 5 | 6 | 7 | 8> [durasi_menit]`')] });
      }

      const durArg = args[1];
      let minutes = 0;
      if (durArg) {
        minutes = parseInt(durArg);
      }

      const getOrCreateEbyusSettings = (guildId) => {
        let settings = database.get('SELECT * FROM ebyus_settings WHERE guild_id = ?', [guildId]);
        if (!settings) {
          database.run('INSERT INTO ebyus_settings (guild_id, gacha_mode, coin_multiplier, updated_at, updated_by, expires_at) VALUES (?, ?, ?, ?, ?, 0)', [guildId, 'NORMAL', 1, 0, '']);
          settings = {
            guild_id: guildId,
            gacha_mode: 'NORMAL',
            coin_multiplier: 1,
            updated_at: 0,
            updated_by: '',
            expires_at: 0
          };
        }
        return settings;
      };

      getOrCreateEbyusSettings(guildId);
      const nowUnix = Math.floor(Date.now() / 1000);
      const expiresAt = minutes > 0 ? nowUnix + minutes * 60 : 0;
      database.run(
        'UPDATE ebyus_settings SET coin_multiplier = ?, expires_at = ?, updated_at = ?, updated_by = ? WHERE guild_id = ?',
        [multiplier, expiresAt, nowUnix, author.id, guildId]
      );

      let timeText = minutes > 0 ? ` selama **${minutes} menit** (auto-reset)` : ' secara **Permanen**';
      await message.reply(`✅ Sukses memperbarui pengali koin chat server ini menjadi **${multiplier === 1 ? 'Nonaktif (1x)' : multiplier + 'x'}**${timeText}.`);
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: .ebyus / .ebyus-panel / .abyus / .abyus-panel / .admin-event / .panel-event / .event-panel
    // ═══════════════════════════════════════════════════
    // Perintah Admin: Panel Abyus (.abyus, .admin-abyus, .ebyus, .admin-event, dll)
    // ═══════════════════════════════════════════════════
    if (['ebyus', 'ebyus-panel', 'abyus', 'abyus-panel', 'admin-abyus', 'panel-abyus', 'abyus-admin', 'admin-event', 'panel-event', 'event-panel', 'admin-ebyus', 'panel-ebyus'].includes(commandName)) {
      if (!message.member || !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply({ content: '❌ Akses Ditolak! Menu dashboard ini dikunci khusus untuk Administrator server.', flags: 64 });
      }

      const subArg = args[0]?.toLowerCase();
      if (subArg === 'status') {
        const getOrCreateEbyusSettings = (gId) => {
          let settings = database.get('SELECT * FROM ebyus_settings WHERE guild_id = ?', [gId]);
          if (!settings) {
            database.run('INSERT INTO ebyus_settings (guild_id, gacha_mode, coin_multiplier, updated_at, updated_by, expires_at) VALUES (?, ?, ?, ?, ?, 0)', [gId, 'NORMAL', 1, 0, '', 0]);
            settings = {
              guild_id: gId,
              gacha_mode: 'NORMAL',
              coin_multiplier: 1,
              updated_at: 0,
              updated_by: '',
              expires_at: 0
            };
          }
          return settings;
        };
        const settings = getOrCreateEbyusSettings(guildId);
        const embed = embeds.ebyusStatusEmbed(guild, settings);
        await message.reply({ embeds: [embed] });
        return true;
      }

      const adminPanel = require('./adminPanel');
      await adminPanel.handleAdminAbyusPanel(message, client);
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: Panel Pet (.admin-pet / .panel-pet)
    // ═══════════════════════════════════════════════════
    if (['admin-pet', 'panel-pet', 'pet-panel'].includes(commandName)) {
      if (!message.member || !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply({ content: '❌ Akses Ditolak! Menu dashboard ini dikunci khusus untuk Administrator server.', flags: 64 });
      }

      const adminPanel = require('./adminPanel');
      const targetUser = message.mentions.users.first() || (args[0] ? { id: args[0] } : null);
      await adminPanel.handleAdminPetPanel(message, client, targetUser?.id);
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: Panel Bank (.admin-bank / .panel-bank)
    // ═══════════════════════════════════════════════════
    if (['admin-bank', 'panel-bank', 'bank-panel'].includes(commandName)) {
      if (!message.member || !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply({ content: '❌ Akses Ditolak! Menu dashboard ini dikunci khusus untuk Administrator server.', flags: 64 });
      }

      const adminPanel = require('./adminPanel');
      const targetUser = message.mentions.users.first() || (args[0] ? { id: args[0] } : null);
      await adminPanel.handleAdminBankPanel(message, client, targetUser?.id);
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: Panel Robbery (.admin-rob / .panel-rob / .admin-robbery)
    // ═══════════════════════════════════════════════════
    if (['admin-rob', 'panel-rob', 'rob-panel', 'admin-robbery', 'panel-robbery', 'robbery-panel'].includes(commandName)) {
      if (!message.member || !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply({ content: '❌ Akses Ditolak! Menu dashboard ini dikunci khusus untuk Administrator server.', flags: 64 });
      }

      const adminPanel = require('./adminPanel');
      const targetUser = message.mentions.users.first() || (args[0] ? { id: args[0] } : null);
      await adminPanel.handleAdminRobberyPanel(message, client, targetUser?.id);
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: Panel Saham (.admin-saham / .panel-saham / .admin-bursa)
    // ═══════════════════════════════════════════════════
    if (['admin-saham', 'panel-saham', 'saham-panel', 'admin-bursa', 'panel-bursa', 'bursa-panel', 'admin-market', 'panel-market', 'market-panel'].includes(commandName)) {
      if (!message.member || !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply({ content: '❌ Akses Ditolak! Menu dashboard ini dikunci khusus untuk Administrator server.', flags: 64 });
      }

      const adminPanel = require('./adminPanel');
      const tickerArg = args[0]?.toUpperCase();
      await adminPanel.handleAdminSahamPanel(message, client, tickerArg);
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: Panel Shop & ToD (.admin-shop / .panel-shop / .shop-panel)
    // ═══════════════════════════════════════════════════
    if (['admin-shop', 'panel-shop', 'shop-panel'].includes(commandName)) {
      if (!message.member || !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply({ content: '❌ Akses Ditolak! Menu dashboard ini dikunci khusus untuk Administrator server.', flags: 64 });
      }

      const adminPanel = require('./adminPanel');
      await adminPanel.handleAdminShopPanel(message, client);
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: .stop-abyus / .stop-ebyus (Penghentian Darurat Event Abuse)
    // ═══════════════════════════════════════════════════
    if (['stop-abyus', 'stop-ebyus'].includes(commandName)) {
      if (!message.member || !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply({ content: '❌ Akses Ditolak! Perintah ini dikunci khusus untuk Administrator server.', flags: 64 });
      }

      const nowUnix = Math.floor(Date.now() / 1000);
      database.run(
        'UPDATE ebyus_settings SET gacha_mode = ?, coin_multiplier = ?, expires_at = 0, updated_at = ?, updated_by = ? WHERE guild_id = ?',
        ['NORMAL', 1, nowUnix, message.author.id, guildId]
      );

      const embed = embeds.successEmbed(
        '🛑 Event Abuse Berhasil Dihentikan!',
        `Seluruh bypass ekonomi server (mode gacha & multiplier koin chat) telah dinonaktifkan sepenuhnya dan kembali ke setelan standard.`
      );
      await message.reply({ embeds: [embed] });
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: .admin-panel / .adminpanel / .panel-admin / .paneladmin (Dashboard Kontrol Utama)
    // ═══════════════════════════════════════════════════
    if (['admin-panel', 'adminpanel', 'panel-admin', 'paneladmin'].includes(commandName)) {
      if (!message.member || !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return message.reply({ content: '❌ Akses Ditolak! Menu dashboard ini dikunci khusus untuk Administrator server.', flags: 64 });
      }

      const adminPanel = require('./adminPanel');
      await adminPanel.handleAdminPanel(message, client);
      return true;
    }

    // ═══════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════
    // Perintah Admin: .setup-portal
    // ═══════════════════════════════════════════════════
    if (commandName === 'setup-portal') {
      const isOwner = author.id === OWNER_ID;
      const isGuildOwner = message.guild && author.id === message.guild.ownerId;
      const isAdmin = message.member && message.member.permissions.has(PermissionsBitField.Flags.Administrator);
      if (!isOwner && !isAdmin && !isGuildOwner) {
        return message.reply({ embeds: [embeds.errorEmbed('Akses Ditolak!', 'Hanya Administrator yang dapat menggunakan perintah .setup-portal.')] });
      }

      await message.delete().catch(() => { });

      const embed = new EmbedBuilder()
        .setColor(embeds.COLORS.PURPLE)
        .setTitle('🎭 KOSAN 1A ECONOMY & PET DASHBOARD 📈')
        .setDescription(
          `Klik tombol di bawah ini untuk membuka panel secara **Pribadi** (Hanya Anda yang dapat melihatnya):\n\n` +
          `🛍️ **Toko Role** — Beli kasta role prestise & gacha.\n` +
          `📈 **Bursa Saham** — Investasi saham channel server.\n` +
          `🏦 **Bank Sentral** — Simpan uang (tabungan) & pinjam koin.\n` +
          `🐾 **Pusat Pet** — Adopsi, rawat, & main dengan pet Anda.\n` +
          `🕵️‍♂️ **Pasar Gelap** — Beli perlengkapan aksi kriminal (rob).\n` +
          `🏠 **Sewa Kosan** — Sewa kamar kos & upgrade fasilitas.`
        )
        .setFooter({ text: 'Rupiah Server • Panel Utama Interaktif' })
        .setTimestamp();

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('eco_btn_open_shop_private_perm')
          .setLabel('🛍️ Toko')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('eco_btn_open_market_private_perm')
          .setLabel('📈 Saham')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('eco_btn_open_bank_private_perm')
          .setLabel('🏦 Bank')
          .setStyle(ButtonStyle.Secondary)
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('pet_btn_open_pet_private_perm')
          .setLabel('🐾 Pet')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('eco_btn_open_bm_private_perm')
          .setLabel('🕵️‍♂️ BM')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('eco_btn_open_kos_private_perm')
          .setLabel('🏠 Kosan')
          .setStyle(ButtonStyle.Secondary)
      );

      await message.channel.send({ embeds: [embed], components: [row1, row2] });
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: .setup-panel-admin / .setup-admin-panel
    // ═══════════════════════════════════════════════════
    if (['setup-admin-panel', 'setup-adminpanel', 'setup-panel-admin', 'setup-paneladmin'].includes(commandName)) {
      if (!message.member || !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        await message.delete().catch(() => {});
        await author.send('❌ Akses Ditolak! Hanya Administrator yang dapat menggunakan perintah setup ini.').catch(() => {});
        return true;
      }

      const { ChannelType, PermissionFlagsBits } = require('discord.js');
      const guild = message.guild;
      
      // Look up parent category
      const STAFF_CATEGORY_ID = '1472479634971955221';
      const parentId = guild.channels.cache.has(STAFF_CATEGORY_ID) ? STAFF_CATEGORY_ID : null;

      try {
        // Create the channel
        const adminChannel = await guild.channels.create({
          name: '🛡️┃panel-admin',
          type: ChannelType.GuildText,
          parent: parentId,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionFlagsBits.ViewChannel]
            },
            {
              id: client.user.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageMessages]
            }
          ]
        });

        if (parentId) {
          await adminChannel.lockPermissions().catch(() => {});
        } else {
          // If no staff category, allow Administrator role/permission explicitly
          const adminRoles = guild.roles.cache.filter(r => r.permissions.has(PermissionFlagsBits.Administrator));
          for (const [rId, role] of adminRoles) {
            await adminChannel.permissionOverwrites.edit(role.id, {
              ViewChannel: true,
              SendMessages: true,
              EmbedLinks: true
            }).catch(() => {});
          }
        }

        // Check if row exists, if not insert it
        let settings = database.get('SELECT * FROM ebyus_settings WHERE guild_id = ?', [guild.id]);
        if (!settings) {
          database.run(
            'INSERT INTO ebyus_settings (guild_id, admin_panel_channel_id) VALUES (?, ?)',
            [guild.id, adminChannel.id]
          );
        } else {
          database.run(
            'UPDATE ebyus_settings SET admin_panel_channel_id = ? WHERE guild_id = ?',
            [adminChannel.id, guild.id]
          );
        }

        return message.reply({ content: `✅ Berhasil membuat channel khusus admin panel: <#${adminChannel.id}>! Channel ini dikunci agar hanya bisa dilihat oleh Administrator.` });
      } catch (err) {
        console.error('Error creating admin panel channel:', err);
        return message.reply({ content: `❌ Gagal membuat channel: ${err.message}` });
      }
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

    await message.reply({ embeds: [embed] }).catch(() => { });
    return true;
  }

  return false;
}

module.exports = {
  initStockMarket,
  handleEconomyChat,
  handleEconomyCommands
};
