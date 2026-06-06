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
const lottery = require('./lottery');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle, ModalBuilder, PermissionsBitField, UserSelectMenuBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');
// Owner ID dari config terpusat
const OWNER_ID = config.OWNER_ID;
// ID Channel Portal Shop (#🛍️┃shop) — panel hanya privat di channel ini
const SHOP_CHANNEL_ID = config.channels.SHOP_PORTAL;

// Helper: Ambil gambar map ekspedisi berdasarkan mapId (1-10)
function getMapAttachment(mapId) {
  const mapPath = path.join(__dirname, '..', 'assets', 'maps', `map${mapId}.png`);
  if (fs.existsSync(mapPath)) {
    return new AttachmentBuilder(mapPath, { name: `map${mapId}.png` });
  }
  return null;
}

// Map untuk mengelola cooldown perintah .bal per user
const balCooldowns = new Map();
// Helper to build pet shop options dynamically from pet.PET_ITEMS
function getPetShopSelectOptions() {
  return Object.keys(pet.PET_ITEMS).map(key => {
    const item = pet.PET_ITEMS[key];
    const label = `${item.name} (Rp ${item.price.toLocaleString('id-ID')})`;
    const rawDesc = item.desc || '';
    const desc = rawDesc.length > 95 ? rawDesc.substring(0, 92) + '...' : rawDesc;
    return new StringSelectMenuOptionBuilder()
      .setLabel(label)
      .setDescription(desc)
      .setValue(item.id);
  });
}

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
      const sisaBursa = s.total_shares === 99999999 ? 'Tanpa Batas (♾️)' : `${s.available_shares.toLocaleString('id-ID')} lembar`;
      selectMenu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(`${s.stock_ticker} - #${s.stock_name}`)
          .setDescription(`Harga: Rp ${s.current_price.toLocaleString('id-ID')} | Sisa: ${sisaBursa}`)
          .setValue(s.stock_ticker)
          .setDefault(s.stock_ticker === currentTicker)
      );
    });

    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

    const isOpen = stocks.isMarketOpen();

    const detailEmbed = new EmbedBuilder()
      .setColor(isOpen ? (profitRp >= 0 ? embeds.COLORS.SUCCESS : embeds.COLORS.ERROR) : embeds.COLORS.GREY || 0x7F8C8D)
      .setTitle(`📊 Transaksi Saham: ${activeStock.stock_ticker} — #${activeStock.stock_name}`)
      .setDescription(
        `🏛️ **Harga Saham:** **Rp ${activeStock.current_price.toLocaleString('id-ID')}** per lembar\n` +
        `📉 **Sisa Bursa:** ${activeStock.total_shares === 99999999 ? '`Tanpa Batas (♾️)`' : `\`${activeStock.available_shares.toLocaleString('id-ID')} / ${activeStock.total_shares.toLocaleString('id-ID')} lembar\``}\n` +
        `💵 **Saldo Anda:** **Rp ${wallet.balance.toLocaleString('id-ID')}**\n\n` +
        `💼 **Kepemilikan Portofolio:**\n` +
        `👉 Jumlah Aset: \`${userShares} / ${config.market.MAX_SHARES_HOLD_PER_USER || 100} lembar\` ${userShares >= (config.market.MAX_SHARES_HOLD_PER_USER || 100) ? '⚠️ (Maks)' : ''}\n` +
        `👉 Rata-rata Beli: \`Rp ${avgBuyPrice.toLocaleString('id-ID')}\`\n` +
        `👉 Nilai Valuasi: \`Rp ${currentValue.toLocaleString('id-ID')}\`\n` +
        `👉 P/L Real-time: ${profitIndicator} **${profitSign}Rp ${profitRp.toLocaleString('id-ID')}** (\`${profitSign}${profitPercent}%\`)\n\n` +
        (isOpen ? '' : `⚠️ **Bursa Saham sedang TUTUP.** Jam perdagangan: 08:00 - 23:00 WIB. Anda tidak dapat melakukan transaksi beli/jual saat ini.`)
      )
      .setFooter({ text: isOpen ? 'Pilih aksi Beli (Success) atau Jual (Danger) di bawah ini!' : 'Bursa Tutup • Jam Operasional: 08:00 - 23:00 WIB' })
      .setTimestamp();

    const maxHold = config.market.MAX_SHARES_HOLD_PER_USER || 100;

    // BUY row
    const buySelect = new StringSelectMenuBuilder()
      .setCustomId('eco_trade_select_buy')
      .setPlaceholder(isOpen ? '📥 Aksi Beli (Pilih Jumlah)...' : '🔒 Pembelian Ditutup (Bursa Tutup)')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Beli 1').setDescription(`Harga: Rp ${activeStock.current_price.toLocaleString('id-ID')}`).setValue('1'),
        new StringSelectMenuOptionBuilder().setLabel('Beli 10').setDescription(`Harga: Rp ${(activeStock.current_price * 10).toLocaleString('id-ID')}`).setValue('10'),
        new StringSelectMenuOptionBuilder().setLabel('Beli 50').setDescription(`Harga: Rp ${(activeStock.current_price * 50).toLocaleString('id-ID')}`).setValue('50'),
        new StringSelectMenuOptionBuilder().setLabel('Beli Max').setDescription('Beli sebanyak mungkin yang bisa dijangkau').setValue('max'),
        new StringSelectMenuOptionBuilder().setLabel('Beli Custom').setDescription('Tentukan jumlah lembar secara kustom').setValue('custom')
      )
      .setDisabled(!isOpen || wallet.balance < activeStock.current_price || activeStock.available_shares < 1 || userShares >= maxHold);

    const buyRow = new ActionRowBuilder().addComponents(buySelect);

    // SELL row
    const sellSelect = new StringSelectMenuBuilder()
      .setCustomId('eco_trade_select_sell')
      .setPlaceholder(isOpen ? '📤 Aksi Jual (Pilih Jumlah)...' : '🔒 Penjualan Ditutup (Bursa Tutup)')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Jual 1').setDescription(`Harga: Rp ${activeStock.current_price.toLocaleString('id-ID')}`).setValue('1'),
        new StringSelectMenuOptionBuilder().setLabel('Jual 10').setDescription(`Harga: Rp ${(activeStock.current_price * 10).toLocaleString('id-ID')}`).setValue('10'),
        new StringSelectMenuOptionBuilder().setLabel('Jual 50').setDescription(`Harga: Rp ${(activeStock.current_price * 50).toLocaleString('id-ID')}`).setValue('50'),
        new StringSelectMenuOptionBuilder().setLabel('Jual Semua').setDescription(`Jual seluruh kepemilikan (${userShares} lembar)`).setValue('all'),
        new StringSelectMenuOptionBuilder().setLabel('Jual Custom').setDescription('Tentukan jumlah lembar secara kustom').setValue('custom')
      )
      .setDisabled(!isOpen || userShares < 1);

    const sellRow = new ActionRowBuilder().addComponents(sellSelect);

    // Exit row
    const exitRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('trade_btn_exit').setLabel('✖️ Keluar Panel').setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [detailEmbed], components: [selectRow, buyRow, sellRow, exitRow] };
  };

  const initialData = getEmbedAndComponents(selectedTicker);
  if (!initialData) return;

  if (isInteraction) {
    if (messageOrInteraction.deferred || messageOrInteraction.replied) {
      await messageOrInteraction.editReply(initialData);
    } else {
      await messageOrInteraction.reply({ ...initialData, flags: messageOrInteraction.channelId === SHOP_CHANNEL_ID ? 64 : undefined });
    }
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
      } else if (iTrade.customId === 'eco_trade_select_buy' || iTrade.customId === 'eco_trade_select_sell') {
        const action = iTrade.customId === 'eco_trade_select_buy' ? 'BUY' : 'SELL';
        const amountType = iTrade.values[0];

        const stock = stocks.getStock(guildId, selectedTicker);
        if (!stock) {
          return iTrade.reply({ content: '❌ Saham tidak ditemukan!', flags: iTrade.channelId === SHOP_CHANNEL_ID ? 64 : undefined });
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
            const maxHoldAllowed = (config.market.MAX_SHARES_HOLD_PER_USER || 100) - userShares;
            shares = Math.min(maxAfford, stock.available_shares, maxHoldAllowed);
            if (shares <= 0) {
              return iTrade.reply({ content: `❌ Anda tidak dapat membeli lembar saham lagi (saldo tidak cukup, stok bursa habis, atau sudah mencapai batas kepemilikan ${config.market.MAX_SHARES_HOLD_PER_USER || 100} lembar)!`, flags: iTrade.channelId === SHOP_CHANNEL_ID ? 64 : undefined });
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
                return submitted.reply({ content: '❌ Jumlah lembar harus berupa angka di atas 0!', flags: submitted.channelId === SHOP_CHANNEL_ID ? 64 : undefined });
              }

              try {
                const res = stocks.buyStock(author.id, guildId, selectedTicker, inputVal);
                const successEmb = embeds.transactionSuccessEmbed(author, true, res);
                await submitted.reply({ embeds: [successEmb], flags: submitted.channelId === SHOP_CHANNEL_ID ? 64 : undefined });

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
                await submitted.reply({ content: `❌ Transaksi gagal: ${cleaned}`, flags: submitted.channelId === SHOP_CHANNEL_ID ? 64 : undefined });
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
              return iTrade.reply({ content: '❌ Anda tidak memiliki saham ini untuk dijual!', flags: iTrade.channelId === SHOP_CHANNEL_ID ? 64 : undefined });
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
                return submitted.reply({ content: '❌ Jumlah lembar harus berupa angka di atas 0!', flags: submitted.channelId === SHOP_CHANNEL_ID ? 64 : undefined });
              }

              try {
                const res = stocks.sellStock(author.id, guildId, selectedTicker, inputVal, submitted.member);
                const successEmb = embeds.transactionSuccessEmbed(author, false, res);
                await submitted.reply({ embeds: [successEmb], flags: submitted.channelId === SHOP_CHANNEL_ID ? 64 : undefined });

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
                await submitted.reply({ content: `❌ Transaksi gagal: ${cleaned}`, flags: submitted.channelId === SHOP_CHANNEL_ID ? 64 : undefined });
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
              await iTrade.reply({ embeds: [successEmb], flags: iTrade.channelId === SHOP_CHANNEL_ID ? 64 : undefined });

              if (shares >= 50) {
                client.emit('playTtsEvent', {
                  guildId,
                  text: `Wow gila sih! Sultan ${author.username} baru saja memborong ${shares} lembar saham ${res.ticker} senilai total ${res.totalPrice} Rupiah! Hype banget bursa hari ini!`,
                  lang: 'id'
                });
              }
            } else {
              const res = stocks.sellStock(author.id, guildId, selectedTicker, shares, iTrade.member);
              const successEmb = embeds.transactionSuccessEmbed(author, false, res);
              await iTrade.reply({ embeds: [successEmb], flags: iTrade.channelId === SHOP_CHANNEL_ID ? 64 : undefined });

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
            await iTrade.reply({ content: `❌ Transaksi gagal: ${cleaned}`, flags: iTrade.channelId === SHOP_CHANNEL_ID ? 64 : undefined });
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
 * Mengembalikan alasan lucu/unik kenapa seorang user bisa dijebloskan ke penjara.
 * Menggunakan hash berdasarkan ID pengguna agar alasannya konsisten per player (tidak berubah-ubah setiap 5 detik).
 */
function getFunnyArrestReason(userId) {
  const reasons = [
    'Maling cilok Mang Oleh pakai sumpit emas',
    'Nyoba nge-hack NASA pakai kalkulator beras',
    'Korupsi uang kas RT buat beli gacha pet bintang 5',
    'Ngerob bank pakai pistol air isi sirup Marjan rasa melon',
    'Ngepet online tapi lupa matiin lilinnya',
    'Nyolong sendal jepit masjid premium bermerek Gucci',
    'Mencoba menyuap polisi pakai struk belanja Indomaret',
    'Ngerampok bank tapi ketiduran di brankas karena AC-nya dingin',
    'Kepleset kulit pisang pas kabur dari kejaran anjing pelacak',
    'Bohong bilang "otw" di Discord padahal baru bangun tidur',
    'Terciduk pacaran sama NPC kasir Toko Role',
    'Mencoba menghipnotis pak polisi pakai goyangan TikTok',
    'Lupa bayar utang bail tapi malah pamer beli Ferrari baru',
    'Nge-prank pak RT malam-malam pakai kostum hantu botak',
    'Tertangkap basah nyolong jemuran celana gemes milik tetangga',
    'Mencuri hati kasir tapi ditolak, akhirnya ditangkap warga sekitar',
    'Narik rem darurat KRL cuma buat numpang kentut',
    'Nge-chat admin "P" 100 kali berturut-turut dikira spam teroris',
    'Nyolong mangkok bakso keliling buat dijadiin helm pet',
    'Terciduk nilep uang iuran kas kasino buat bayar kost bulanan'
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % reasons.length;
  return reasons[index];
}

/**
 * Memulai pengkinian Papan Peringkat Realtime (Rich Leaderboard, Pet Leaderboard, & Jail Leaderboard)
 * secara berkala setiap 60 detik di channel masing-masing.
 */
let leaderboardInterval = null; // Guard: mencegah interval bertumpuk
const leaderboardMsgCache = new Map(); // Cache ID pesan leaderboard agar tidak fetch 50 pesan berulang-ulang

function startRealtimeLeaderboard(client) {
  console.log('🏆 Memulai Papan Peringkat Realtime (60s)...');

  // Guard: bersihkan interval sebelumnya jika ada (mencegah duplikasi saat reconnect)
  if (leaderboardInterval) {
    clearInterval(leaderboardInterval);
    leaderboardInterval = null;
    console.log('⚠️ [Leaderboard] Interval sebelumnya dibersihkan (mencegah duplikasi).');
  }

  async function updateLeaderboardMsg(channel, embed, keyword) {
    const cacheKey = `${channel.id}_${keyword}`;
    const cachedMsgId = leaderboardMsgCache.get(cacheKey);
    const payload = { embeds: [embed], components: [] };

    if (cachedMsgId) {
      try {
        const msg = channel.messages.cache.get(cachedMsgId) || await channel.messages.fetch(cachedMsgId).catch(() => null);
        if (msg) {
          await msg.edit(payload);
          return msg;
        } else {
          leaderboardMsgCache.delete(cacheKey);
        }
      } catch (e) {
        leaderboardMsgCache.delete(cacheKey);
      }
    }

    try {
      const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
      const botMessages = messages ? [...messages.filter(m => m.author.id === client.user.id).values()] : [];
      let matchMsg = botMessages.find(m => m.embeds[0] && m.embeds[0].title && m.embeds[0].title.toLowerCase().includes(keyword.toLowerCase()));
      if (matchMsg) {
        leaderboardMsgCache.set(cacheKey, matchMsg.id);
        await matchMsg.edit(payload).catch(() => {});
        return matchMsg;
      } else {
        const newMsg = await channel.send(payload).catch(() => null);
        if (newMsg) {
          leaderboardMsgCache.set(cacheKey, newMsg.id);
        }
        return newMsg;
      }
    } catch (e) {
      console.error(`Error updating leaderboard message for keyword ${keyword}:`, e.message);
    }
  }

  leaderboardInterval = setInterval(async () => {
    // ── 1. KANGLOMERAT LEADERBOARD ──
    try {
      const richChanId = config.LEADERBOARD_RICH_CHANNEL_ID || '1510230591860113418';
      const richChannel = await client.channels.fetch(richChanId).catch(() => null);
      if (richChannel) {
        const guildId = richChannel.guild.id;
        const guildName = richChannel.guild.name;

        const richData = economy.getLeaderboard(guildId, 10);
        await Promise.all(richData.map(async u => {
          if (client.users.cache.has(u.userId)) return;
          try { await client.users.fetch(u.userId); } catch (e) { }
        }));
        const richEmbed = embeds.leaderboardEmbed(guildName, richData, client);
        await updateLeaderboardMsg(richChannel, richEmbed, 'WEALTH');
      }
    } catch (err) {
      console.error('❌ Error updating realtime rich leaderboard:', err);
    }

    // Stagger/delay 5 detik
    await new Promise(resolve => setTimeout(resolve, 5000));

    // ── 2. TOP PET EKSPEDISI LEADERBOARD ──
    try {
      const petChanId = config.LEADERBOARD_PET_CHANNEL_ID || '1510232295448117308';
      const petChannel = await client.channels.fetch(petChanId).catch(() => null);
      if (petChannel) {
        const guildId = petChannel.guild.id;
        const guildName = petChannel.guild.name;

        // ── TOP EXPEDITION EARNERS ──
        const topExpedition = database.all(
          `SELECT t.user_id, SUM(t.amount) as total_earned, COUNT(t.id) as total_runs,
                  p.pet_name, p.pet_type, p.level, p.trait, p.status
           FROM transactions t
           LEFT JOIN user_pets p ON t.user_id = p.user_id AND t.guild_id = p.guild_id AND p.is_active = 1
           WHERE t.guild_id = ? AND t.type = 'PET_EXPEDITION_REWARD'
           GROUP BY t.user_id
           ORDER BY total_earned DESC
           LIMIT 10`,
          [guildId]
        );

        await Promise.all(topExpedition.map(async u => {
          if (client.users.cache.has(u.user_id)) return;
          try { await client.users.fetch(u.user_id); } catch (e) { }
        }));

        // Build Expedition Embed
        const expEmbed = embeds.petExpeditionLeaderboardEmbed(guildName, topExpedition, client);
        await updateLeaderboardMsg(petChannel, expEmbed, 'EXPEDITION');
      }
    } catch (err) {
      console.error('❌ Error updating realtime pet expedition leaderboard:', err);
    }

    // Stagger/delay 5 detik
    await new Promise(resolve => setTimeout(resolve, 5000));

    // ── 3. DAILY LEADERBOARD ──
    try {
      const dailyChanId = config.LEADERBOARD_DAILY_CHANNEL_ID || '1510240252458176662';
      const dailyChannel = await client.channels.fetch(dailyChanId).catch(() => null);
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
          if (client.users.cache.has(u.user_id)) return;
          try { await client.users.fetch(u.user_id); } catch (e) { }
        }));
        const dailyEmbed = embeds.dailyLeaderboardEmbed(guildName, list, client);
        await updateLeaderboardMsg(dailyChannel, dailyEmbed, 'TARGET ROB');
      }
    } catch (err) {
      console.error('❌ Error updating realtime daily leaderboard:', err);
    }

    // Stagger/delay 5 detik
    await new Promise(resolve => setTimeout(resolve, 5000));

    // ── 4. TOP JAIL LEADERBOARD (Channel dari config) ──
    try {
      const jailChanId = config.channels.JAIL_LEADERBOARD || '1510474950698602627';
      const jailChannel = await client.channels.fetch(jailChanId).catch(() => null);
      if (jailChannel) {
        const guildId = jailChannel.guild.id;
        const guildName = jailChannel.guild.name;

        const topJail = database.all(
          `SELECT user_id, jail_count FROM wallets 
           WHERE guild_id = ? AND jail_count > 0 
           ORDER BY jail_count DESC LIMIT 10`,
          [guildId]
        );

        let topJailEmbed;
        if (topJail.length === 0) {
          topJailEmbed = embeds.successEmbed(
            '🕵️‍♂️ PAPAN PERINGKAT: NARAPIDANA PALING SERING DIPENJARA! 🔒',
            '🟢 **Keamanan Terjamin!** Belum ada warga server yang pernah dijebloskan ke dalam penjara virtual.'
          );
        } else {
          await Promise.all(topJail.map(async row => {
            if (client.users.cache.has(row.user_id)) return;
            try { await client.users.fetch(row.user_id); } catch (e) { }
          }));

          let desc = '🚨 **BURONAN KELAS KAKAP & REKOR SEL TAHANAN** 🔒\n';
          desc += '`==========================================`\n\n';
          for (let i = 0; i < topJail.length; i++) {
            const row = topJail[i];
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `\`#${i + 1}\``;
            const reason = getFunnyArrestReason(row.user_id);
            desc += `${medal} ┃ <@${row.user_id}>\n`;
            desc += `┗ 👮 **${row.jail_count}x Masuk Tahanan**\n`;
            desc += `┗ 💬 *"${reason}"*\n\n`;
          }
          desc += '`==========================================`\n';
          desc += '👉 *Selalu patuhi hukum server atau Anda berakhir di daftar ini!*';

          topJailEmbed = new EmbedBuilder()
            .setColor(0xC0392B) // Crimson warning red
            .setTitle('🕵️‍♂️ PAPAN BURONAN: NARAPIDANA PALING SERING DIPENJARA! 🔒')
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/3037/3037233.png')
            .setDescription(desc)
            .setFooter({ text: `Klasemen Buronan Server ${guildName} • Total Narapidana: ${topJail.length}`, iconURL: jailChannel.guild.iconURL({ dynamic: true }) || null })
            .setTimestamp();
        }

        await updateLeaderboardMsg(jailChannel, topJailEmbed, 'NARAPIDANA');
      }
    } catch (err) {
      console.error('❌ Error updating realtime jail leaderboard:', err);
    }

    // Stagger/delay 5 detik
    await new Promise(resolve => setTimeout(resolve, 5000));

    // ── 5. TOP THIEF LEADERBOARD (Channel dari config) ──
    try {
      const thiefChanId = config.channels.THIEF_LEADERBOARD || '1511017876407058463';
      let thiefChannel = await client.channels.fetch(thiefChanId).catch(() => null);
      if (!thiefChannel) {
        for (const [_, guild] of client.guilds.cache) {
          const channels = guild.channels.cache;
          const found = channels.find(c =>
            c.type === 0 && ( // GuildText channel type is 0 in discord.js v14
              c.name.includes('thief-leaderboard') ||
              c.name.includes('pencuri-leaderboard') ||
              c.name.includes('top-pencuri') ||
              c.name.includes('pencuri-terbanyak')
            )
          );
          if (found) {
            thiefChannel = found;
            break;
          }
        }
      }

      if (thiefChannel) {
        const guildId = thiefChannel.guild.id;
        const guildName = thiefChannel.guild.name;

        const thiefData = economy.getThiefLeaderboard(guildId, 10);
        await Promise.all(thiefData.map(async u => {
          if (client.users.cache.has(u.user_id)) return;
          try { await client.users.fetch(u.user_id); } catch (e) { }
        }));
        const thiefEmbed = embeds.thiefLeaderboardEmbed(guildName, thiefData, client);
        await updateLeaderboardMsg(thiefChannel, thiefEmbed, 'PENCURI');
      }
    } catch (err) {
      console.error('❌ Error updating realtime thief leaderboard:', err);
    }
  }, 60000);
}

/**
 * Helper untuk membuat tampilan data Portal Hub (Embed dan Dropdown Menu).
 */
function getPortalHubData(client) {
  const embed = new EmbedBuilder()
    .setColor(embeds.COLORS.PURPLE)
    .setTitle('🎮 PORTAL HUB BOT KOSAN 1A — PUSAT KONTROL UTAMA')
    .setThumbnail(client.user.displayAvatarURL())
    .setDescription(
      `Selamat datang di **Portal Hub Bot Kosan 1A**! 🎮\n` +
      `Pusat layanan warga terpadu. Klik tombol di bawah ini untuk mengakses fitur secara **Pribadi & Rahasia (Private)**:\n\n` +
      `💼 **EKONOMI & FINANSIAL**\n` +
      `• Toko Role • Bursa Saham • Bank Sentral • Black Market • Pasar Lelang • Profil & Aset\n\n` +
      `🐾 **DUNIA PET & GAYA HIDUP**\n` +
      `• Kandang Pet (Pusat Pet) • Sewa Kosan • Cozy Garden • Misi Harian • Lotre Mingguan`
    )
    .setFooter({ text: 'Bot Kosan 1A Active Gamification • Pusat Kontrol Warga' })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('eco_btn_open_shop_private_perm').setLabel('🛍️ Toko Role').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('eco_btn_open_market_private_perm').setLabel('📈 Bursa Saham').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('eco_btn_open_bank_private_perm').setLabel('🏦 Bank Sentral').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eco_btn_open_bm_private_perm').setLabel('🕵️‍♂️ Black Market').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('eco_btn_open_inventory_private_perm').setLabel('🎒 Profil & Aset').setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('pet_btn_open_pet_private_perm').setLabel('🐾 Kandang Pet').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('eco_btn_open_kos_private_perm').setLabel('🛌 Sewa Kosan').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('eco_btn_open_garden_private_perm').setLabel('🌱 Cozy Garden').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('pet_btn_open_quests_private_perm').setLabel('📋 Misi Harian').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('eco_btn_lottery_hub').setLabel('🎟️ Lotre Mingguan').setStyle(ButtonStyle.Success)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('eco_btn_open_marketplace_private_perm').setLabel('⚖️ Pasar Lelang').setStyle(ButtonStyle.Success)
  );

  const components = [row1, row2, row3];
  return { embed, components };
}

/**
 * Auto-refresh permanent admin panels on bot startup.
 * Ini membersihkan channel panel admin dan mengirim ulang panel agar tombolnya selalu aktif setelah restart/deploy.
 */
async function refreshAdminPanels(client) {
  try {
    const dbModule = require('./database');
    const guildsSettings = dbModule.db.prepare('SELECT guild_id, admin_panel_channel_id FROM ebyus_settings WHERE admin_panel_channel_id IS NOT NULL').all();
    
    for (const settings of guildsSettings) {
      const guild = client.guilds.cache.get(settings.guild_id);
      if (!guild) continue;
      
      const adminChannel = guild.channels.cache.get(settings.admin_panel_channel_id) || await guild.channels.fetch(settings.admin_panel_channel_id).catch(() => null);
      if (!adminChannel) continue;
      
      console.log(`[AdminPanel] Membersihkan dan mengirim ulang panel di channel ${adminChannel.name} (${adminChannel.id}) untuk guild ${guild.name}...`);
      
      // Purge all messages in the channel to clean it up
      let fetched;
      do {
        fetched = await adminChannel.messages.fetch({ limit: 100 }).catch(() => null);
        if (fetched && fetched.size > 0) {
          try {
            await adminChannel.bulkDelete(fetched);
          } catch (err) {
            for (const msg of fetched.values()) {
              await msg.delete().catch(() => {});
            }
          }
        }
      } while (fetched && fetched.size > 0);

      // Send one persistent admin panel there
      const adminPanel = require('./adminPanel');
      await adminPanel.handleAdminPanel(adminChannel, client).catch((err) => {
        console.error(`[AdminPanel] Gagal mengirim ulang panel di channel ${adminChannel.id}:`, err);
      });
    }
  } catch (err) {
    console.error('[AdminPanel] Gagal melakukan auto-refresh admin panels pada startup:', err);
  }
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

  // Polling table bot_broadcasts for PENDING broadcasts
  setInterval(async () => {
    try {
      const dbModule = require('./database');
      const pendingBroadcasts = dbModule.db.prepare("SELECT * FROM bot_broadcasts WHERE status = 'PENDING'").all();
      for (const bc of pendingBroadcasts) {
        try {
          const channel = await client.channels.fetch(bc.channel_id).catch(() => null);
          if (channel) {
            await channel.send(bc.message);
            dbModule.db.prepare("UPDATE bot_broadcasts SET status = 'SENT' WHERE id = ?").run(bc.id);
          } else {
            dbModule.db.prepare("UPDATE bot_broadcasts SET status = 'FAILED', error_message = 'Channel not found or bot lacks access' WHERE id = ?").run(bc.id);
          }
        } catch (err) {
          dbModule.db.prepare("UPDATE bot_broadcasts SET status = 'FAILED', error_message = ? WHERE id = ?").run(err.message, bc.id);
        }
      }
    } catch (err) {
      console.error('❌ Error polling bot_broadcasts:', err);
    }
  }, 5000);

  // Auto-refresh permanent admin panels on startup
  refreshAdminPanels(client);

  // Listener untuk button click global (dashboard/panel permanen)
  client.on('interactionCreate', async interaction => {
    if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isUserSelectMenu() && !interaction.isModalSubmit()) return;
    let customId = interaction.customId;

    // Handler interaksi turnamen Admin Cup - Tombol Join/Gabung Publik
    if (interaction.isButton() && customId === 'cup_btn_join_public') {
      try {
        const tournament = require('./tournament');
        const userPet = tournament.registerParticipant(interaction.user.id, interaction.guildId);
        await interaction.reply({ content: `✅ Sukses! Pet **${userPet.pet_name}** (Lv.${userPet.level}) Anda telah berhasil didaftarkan ke turnamen Admin Cup.`, flags: 64 });
      } catch (err) {
        await interaction.reply({ content: `❌ ${err.message}`, flags: 64 });
      }
      return;
    }

    // Handler interaksi turnamen Admin Cup
    if (interaction.isButton() && customId.startsWith('cup_btn_')) {
      const parts = customId.split('_');
      const actionType = parts[2]; // 'atk', 'def', 'elem', 'ult'
      const matchId = parseInt(parts[3]);

      try {
        const tournament = require('./tournament');
        tournament.processTurn(matchId, interaction.user.id, actionType, client);
        await interaction.deferUpdate().catch(() => {});
      } catch (err) {
        await interaction.reply({ content: `❌ ${err.message}`, flags: 64 }).catch(() => {});
      }
      return;
    }
    if (interaction.isStringSelectMenu() && customId === 'eco_select_portal_hub_navigation') {
      customId = interaction.values[0];
    }
    const { guildId, user } = interaction;
    if (!guildId) return;

    // Router interaksi Pasar Lelang Warga (Marketplace P2P)
    if (customId.startsWith('eco_market_') || customId.startsWith('eco_btn_open_marketplace_')) {
      const marketplace = require('./marketplace');
      await marketplace.handleInteraction(interaction, client);
      return;
    }

    try {
      // Handler untuk tombol prompt membuka portal hub privat
      if (customId === 'eco_btn_open_portal_hub_private') {
        const { embed, components } = getPortalHubData(client);
        await interaction.reply({ embeds: [embed], components, flags: 64 });
        return;
      }

      // Handler untuk tombol prompt membuka admin panel privat khusus owner
      if (customId === 'eco_btn_open_admin_panel_private') {
        if (user.id !== OWNER_ID) {
          return interaction.reply({ content: '❌ Akses Ditolak! Tombol ini hanya dapat digunakan oleh Owner utama.', flags: 64 });
        }
        const adminPanel = require('./adminPanel');
        await adminPanel.handleAdminPanel(interaction, client);
        return;
      }

      // ── PORTAL PERMANEN: TOKO ROLE ──
      if (customId === 'eco_btn_open_shop_private_perm' || customId === 'eco_btn_open_shop_direct') {
        await interaction.deferReply({ flags: 64 });
        const wallet = economy.getWallet(user.id, guildId);
        const items = database.all('SELECT * FROM shop_items WHERE guild_id = ?', [guildId]);
        const embed = embeds.shopEmbed(items, wallet);

        const components = [];
        const btnRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('eco_btn_profile').setLabel('💰 Profil & Saldo').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('eco_btn_gacha').setLabel('🎲 Gacha Role').setStyle(ButtonStyle.Danger)
        );
        components.push(btnRow);

        if (items.length > 0) {
          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('eco_select_buy_role')
            .setPlaceholder('👉 Pilih role untuk dibeli secara langsung...');

          const TIER_EMOJIS = {
            COMMON: '🟢',
            RARE: '🔵',
            EPIC: '🟣',
            LEGENDARY: '👑',
            MYTHIC: '🌟'
          };

          const options = items.slice(0, 25).map(item => {
            const emoji = TIER_EMOJIS[item.tier?.toUpperCase()] || '🟢';
            const stockText = item.stock === -1 ? '♾️ Tanpa Batas' : (item.stock <= 0 ? 'SOLD OUT' : `Sisa ${item.stock}`);
            return new StringSelectMenuOptionBuilder()
              .setLabel(`${emoji} ${item.role_name}`)
              .setValue(item.id.toString())
              .setDescription(`Harga: Rp ${item.price.toLocaleString('id-ID')} | Stok: ${stockText}`);
          });

          selectMenu.addOptions(options);
          components.push(new ActionRowBuilder().addComponents(selectMenu));
        }

        const privateMsg = await interaction.editReply({ embeds: [embed], components });
        const collector = privateMsg.createMessageComponentCollector({ time: 120000 });

        collector.on('collect', async i => {
          if (i.user.id !== user.id) return i.reply({ content: '❌ Tombol/Menu ini bukan milik Anda!', flags: 64 });

          try {
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
              // Perbarui embed utama setelah gacha
              const wallet2 = economy.getWallet(user.id, guildId);
              const items2 = database.all('SELECT * FROM shop_items WHERE guild_id = ?', [guildId]);
              const updatedEmbed = embeds.shopEmbed(items2, wallet2);
              await privateMsg.edit({ embeds: [updatedEmbed] }).catch(() => {});
            } else if (i.isStringSelectMenu() && i.customId === 'eco_select_buy_role') {
              const itemId = parseInt(i.values[0]);
              await executeRolePurchase({
                replyTarget: i,
                user,
                guild: i.guild,
                guildId,
                itemId,
                isInteraction: true,
                member: i.member
              });
              // Perbarui embed utama setelah pembelian role
              const wallet2 = economy.getWallet(user.id, guildId);
              const items2 = database.all('SELECT * FROM shop_items WHERE guild_id = ?', [guildId]);
              const updatedEmbed = embeds.shopEmbed(items2, wallet2);
              
              // Perbarui juga opsi select menu karena sisa stok kemungkinan berubah
              const updatedComponents = [];
              const freshBtnRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('eco_btn_profile').setLabel('💰 Profil & Saldo').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('eco_btn_gacha').setLabel('🎲 Gacha Role').setStyle(ButtonStyle.Danger)
              );
              updatedComponents.push(freshBtnRow);

              if (items2.length > 0) {
                const selectMenu = new StringSelectMenuBuilder()
                  .setCustomId('eco_select_buy_role')
                  .setPlaceholder('👉 Pilih role untuk dibeli secara langsung...');

                const TIER_EMOJIS = {
                  COMMON: '🟢',
                  RARE: '🔵',
                  EPIC: '🟣',
                  LEGENDARY: '👑',
                  MYTHIC: '🌟'
                };

                const options = items2.slice(0, 25).map(item => {
                  const emoji = TIER_EMOJIS[item.tier?.toUpperCase()] || '🟢';
                  const stockText = item.stock === -1 ? '♾️ Tanpa Batas' : (item.stock <= 0 ? 'SOLD OUT' : `Sisa ${item.stock}`);
                  return new StringSelectMenuOptionBuilder()
                    .setLabel(`${emoji} ${item.role_name}`)
                    .setValue(item.id.toString())
                    .setDescription(`Harga: Rp ${item.price.toLocaleString('id-ID')} | Stok: ${stockText}`);
                });

                selectMenu.addOptions(options);
                updatedComponents.push(new ActionRowBuilder().addComponents(selectMenu));
              }

              await privateMsg.edit({ embeds: [updatedEmbed], components: updatedComponents }).catch(() => {});
            }
          } catch (err) {
            console.error('Error handling interaction in shop portal:', err);
            await i.reply({ content: '❌ Terjadi kesalahan saat memproses permintaan Anda.', flags: 64 }).catch(() => { });
          }
        });

        collector.on('end', async () => {
          await interaction.deleteReply().catch(() => { });
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
        if (activeStocks.length > 0) {
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
          await interaction.deleteReply().catch(() => { });
        });
      }

      // ── DIRECT TRADING PANEL: BURSA SAHAM ──
      else if (customId === 'eco_btn_open_market_direct') {
        await interaction.deferReply({ flags: 64 });
        const activeStocks = stocks.getStocks(guildId);
        if (activeStocks.length === 0) {
          return interaction.editReply({ content: '❌ Tidak ada instrumen saham aktif di server ini!' });
        }
        await sendInteractiveTradePanel(interaction, activeStocks[0].stock_ticker, user, guildId, client);
      }

      // ── PORTAL PERMANEN: BANK SENTRAL ──
      else if (customId === 'eco_btn_open_bank_private_perm' || customId === 'eco_btn_open_bank_direct') {
        await interaction.deferReply({ flags: 64 });
        const getBankDashboardDataPrivate = (targetUserId) => {
          const wallet = economy.getWallet(targetUserId, guildId);
          const savings = bank.getSavings(targetUserId, guildId);
          const activeLoan = bank.getActiveLoan(targetUserId, guildId);
          const maxLimit = bank.calculateMaxLoanLimit(targetUserId, guildId);
          const debts = database.all('SELECT creditor_id, amount FROM bail_debts WHERE debtor_id = ? AND guild_id = ?', [targetUserId, guildId]);
          const hasFriendDebts = debts && debts.length > 0;

          const embed = embeds.bankDashboardEmbed(user, wallet, savings, activeLoan, maxLimit);

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bank_btn_deposit').setLabel('📥 Deposit').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('bank_btn_withdraw').setLabel('📤 Tarik').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('bank_btn_loan').setLabel('📜 Pinjam').setStyle(ButtonStyle.Success).setDisabled(!!activeLoan),
            new ButtonBuilder().setCustomId('bank_btn_repay').setLabel('💳 Bayar').setStyle(ButtonStyle.Danger).setDisabled(!activeLoan && !hasFriendDebts),
            new ButtonBuilder().setCustomId('bank_btn_transfer').setLabel('💸 Transfer').setStyle(ButtonStyle.Primary)
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
              if (robbery.activeHeists.has(guildId)) {
                return iBank.reply({ embeds: [embeds.bankLockdownEmbed(iBank.guild)], flags: 64 });
              }
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
              if (robbery.activeHeists.has(guildId)) {
                return iBank.reply({ embeds: [embeds.bankLockdownEmbed(iBank.guild)], flags: 64 });
              }
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

              await iBank.reply({
                content: '💡 **PILIH JANGKA TEMPO PINJAMAN (TENOR)**\nSilakan pilih jangka waktu pengembalian utang:',
                components: [tenorRow, cancelRow],
                flags: 64
              });
              const askTenorMsg = await iBank.fetchReply();

              const tenorCollector = askTenorMsg.createMessageComponentCollector({ time: 60000 });

              tenorCollector.on('collect', async iTenor => {
                if (iTenor.user.id !== user.id) return;

                if (iTenor.customId === 'bank_loan_cancel_perm') {
                  tenorCollector.stop('cancel');
                  await iTenor.update({ content: '❌ Pengajuan pinjaman dibatalkan.', components: [] });
                } else if (iTenor.customId === 'bank_select_tenor_perm') {
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

                  const submitted = await iTenor.awaitModalSubmit({
                    filter: (sub) => sub.customId === `bank_modal_loan_${selectedTenor}_perm` && sub.user.id === user.id,
                    time: 60000
                  }).catch(() => null);

                  if (submitted) {
                    tenorCollector.stop('submitted');
                    await askTenorMsg.delete().catch(() => { });
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
                  } else {
                    tenorCollector.stop('timeout');
                  }
                }
              });

              tenorCollector.on('end', async (collected, reason) => {
                if (reason !== 'submitted' && reason !== 'cancel') {
                  await askTenorMsg.delete().catch(() => { });
                }
              });
            }

            else if (iBank.customId === 'bank_btn_repay') {
              try {
                const activeLoan = bank.getActiveLoan(user.id, guildId);
                const debts = database.all('SELECT creditor_id, amount FROM bail_debts WHERE debtor_id = ? AND guild_id = ?', [user.id, guildId]);
                const hasFriendDebts = debts && debts.length > 0;

                const handleFriendRepayFlowPrivate = async (iSelectRepay) => {
                  const friendDebts = database.all('SELECT creditor_id, amount FROM bail_debts WHERE debtor_id = ? AND guild_id = ?', [user.id, guildId]);
                  if (!friendDebts || friendDebts.length === 0) {
                    return iSelectRepay.reply({ content: '❌ Anda tidak memiliki hutang tebusan ke teman.', flags: 64 });
                  }

                  const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('bank_repay_friend_menu_perm')
                    .setPlaceholder('👉 Pilih teman yang ingin Anda bayar...');

                  for (const d of friendDebts) {
                    let displayName = d.creditor_id;
                    try {
                      const member = await iSelectRepay.guild.members.fetch(d.creditor_id).catch(() => null);
                      if (member) displayName = member.displayName;
                    } catch (err) {}

                    selectMenu.addOptions(
                      new StringSelectMenuOptionBuilder()
                        .setLabel(`👥 ${displayName}`)
                        .setDescription(`Sisa Hutang: Rp ${d.amount.toLocaleString('id-ID')}`)
                        .setValue(d.creditor_id)
                    );
                  }

                  const cancelBtn = new ButtonBuilder().setCustomId('bank_repay_friend_cancel_perm').setLabel('✖️ Batalkan').setStyle(ButtonStyle.Secondary);
                  
                  const rowMenu = new ActionRowBuilder().addComponents(selectMenu);
                  const rowBtn = new ActionRowBuilder().addComponents(cancelBtn);

                  const askFriendMsg = iSelectRepay.replied || iSelectRepay.deferred
                    ? await iSelectRepay.followUp({ content: '👥 **PILIH TEMAN TARGET PEMBAYARAN**\nSilakan pilih teman yang dihutangi dari menu di bawah:', components: [rowMenu, rowBtn], flags: 64 })
                    : await iSelectRepay.reply({ content: '👥 **PILIH TEMAN TARGET PEMBAYARAN**\nSilakan pilih teman yang dihutangi dari menu di bawah:', components: [rowMenu, rowBtn], flags: 64, fetchReply: true });


                  const friendCollector = iSelectRepay.channel.createMessageComponentCollector({
                    filter: i => i.message.id === askFriendMsg.id,
                    time: 60000
                  });

                  friendCollector.on('collect', async iFriend => {
                    if (iFriend.user.id !== user.id) return;
                    friendCollector.stop();

                    if (iFriend.customId === 'bank_repay_friend_cancel_perm') {
                      await iFriend.update({ content: '❌ Pembayaran dibatalkan.', components: [] });
                    } else if (iFriend.customId === 'bank_repay_friend_menu_perm') {
                      const creditorId = iFriend.values[0];
                      const specificDebt = database.get('SELECT amount FROM bail_debts WHERE guild_id = ? AND debtor_id = ? AND creditor_id = ?', [guildId, user.id, creditorId]);
                      if (!specificDebt) {
                        return iFriend.reply({ content: '❌ Hutang ke user tersebut tidak ditemukan.', flags: 64 });
                      }

                      const modal = new ModalBuilder()
                        .setCustomId(`bank_modal_repay_friend_${creditorId}_perm`)
                        .setTitle('💳 Bayar Hutang Teman');

                      const amountInput = new TextInputBuilder()
                        .setCustomId('repay_amount')
                        .setLabel(`Jumlah bayar (Hutang: Rp ${specificDebt.amount.toLocaleString('id-ID')})`)
                        .setPlaceholder('Contoh: 1000 atau all')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true);

                      modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
                      await iFriend.showModal(modal);
                      await askFriendMsg.delete().catch(() => {});

                      const submitted = await iFriend.awaitModalSubmit({
                        filter: (sub) => sub.customId === `bank_modal_repay_friend_${creditorId}_perm` && sub.user.id === user.id,
                        time: 60000
                      }).catch(() => null);

                      if (submitted) {
                        try {
                          const amountStr = submitted.fields.getTextInputValue('repay_amount');
                          const res = bank.repayFriendDebt(user.id, creditorId, guildId, amountStr);

                          let creditorName = creditorId;
                          try {
                            const credMember = await submitted.guild.members.fetch(creditorId).catch(() => null);
                            if (credMember) creditorName = credMember.displayName;
                          } catch (err) {}

                          let desc = '';
                          if (res.isFullyPaid) {
                            desc = `Selamat! Hutang tebusan Anda kepada **${creditorName}** telah **LUNAS SEPENUHNYA**.\n\n` +
                              `💳 **Koin Dibayarkan:** **Rp ${res.amountPaid.toLocaleString('id-ID')}**\n` +
                              `💵 **Sisa Saldo Dompet:** **Rp ${res.walletBalance.toLocaleString('id-ID')}**`;
                          } else {
                            desc = `Pembayaran cicilan hutang teman berhasil diproses.\n\n` +
                              `💳 **Koin Dibayarkan:** **Rp ${res.amountPaid.toLocaleString('id-ID')}**\n` +
                              `⚠️ **Sisa Hutang Ke ${creditorName}:** **Rp ${res.remainingDebt.toLocaleString('id-ID')}**\n` +
                              `💵 **Sisa Saldo Dompet:** **Rp ${res.walletBalance.toLocaleString('id-ID')}**`;
                          }

                          await submitted.reply({ embeds: [embeds.bankSuccessEmbed('Pembayaran Hutang Berhasil!', desc)], flags: 64 });
                          await privateMsg.edit(getBankDashboardDataPrivate(user.id)).catch(() => {});
                        } catch (err) {
                          await submitted.reply({ embeds: [embeds.bankErrorEmbed('Pembayaran Gagal!', err.message)], flags: 64 });
                        }
                      }
                    }
                  });
                };

                if (activeLoan && hasFriendDebts) {
                  // Tampilkan pilihan jenis hutang
                  const choiceBank = new ButtonBuilder().setCustomId('bank_repay_choice_bank_perm').setLabel('🏛️ Pinjaman Bank').setStyle(ButtonStyle.Primary);
                  const choiceFriend = new ButtonBuilder().setCustomId('bank_repay_choice_friend_perm').setLabel('👥 Hutang Teman').setStyle(ButtonStyle.Success);
                  const choiceCancel = new ButtonBuilder().setCustomId('bank_repay_choice_cancel_perm').setLabel('✖️ Batalkan').setStyle(ButtonStyle.Secondary);
                  
                  const askChoiceMsg = await iBank.reply({
                    content: '❓ **PILIH UTANG YANG AKAN DIBAYAR**\nAnda memiliki pinjaman bank aktif dan hutang tebusan ke teman. Mana yang ingin Anda bayar?',
                    components: [new ActionRowBuilder().addComponents(choiceBank, choiceFriend, choiceCancel)],
                    flags: 64,
                    fetchReply: true
                  });


                  const choiceCollector = iBank.channel.createMessageComponentCollector({
                    filter: i => i.message.id === askChoiceMsg.id,
                    time: 60000
                  });

                  choiceCollector.on('collect', async iChoice => {
                    if (iChoice.user.id !== user.id) return;
                    choiceCollector.stop();

                    if (iChoice.customId === 'bank_repay_choice_cancel_perm') {
                      await iChoice.update({ content: '❌ Pembayaran dibatalkan.', components: [] });
                    } else if (iChoice.customId === 'bank_repay_choice_bank_perm') {
                      // Jalankan pelunasan bank
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
                            `⚠️ **Sisa Hutang:** **Rp ${res.remainingDebt.toLocaleString('id-ID')}**\n` +
                            `💵 **Sisa Saldo Dompet:** **Rp ${res.walletBalance.toLocaleString('id-ID')}**`;
                        }
                        await iChoice.update({ embeds: [embeds.bankSuccessEmbed('Pembayaran Berhasil!', desc)], content: null, components: [] });
                        await privateMsg.edit(getBankDashboardDataPrivate(user.id)).catch(() => {});
                      } catch (err) {
                        await iChoice.update({ embeds: [embeds.bankErrorEmbed('Pembayaran Gagal!', err.message)], content: null, components: [] });
                      }
                    } else if (iChoice.customId === 'bank_repay_choice_friend_perm') {
                      // Lanjut ke pemilihan teman
                      await handleFriendRepayFlowPrivate(iChoice);
                    }
                  });
                } else if (activeLoan) {
                  // Langsung bayar pinjaman bank
                  const res = bank.repayLoan(user.id, guildId);
                  let desc = '';
                  if (res.isFullyPaid) {
                    desc = `Selamat! Utang pinjaman Anda telah **LUNAS SEPENUHNYA**.\n\n` +
                      `💳 **Dibayarkan:** **Rp ${res.amountPaid.toLocaleString('id-ID')}**\n` +
                      `💵 **Sisa Saldo Dompet:** **Rp ${res.walletBalance.toLocaleString('id-ID')}**`;
                  } else {
                    desc = `Pembayaran utang berhasil diproses sebagian.\n\n` +
                      `💳 **Dibayarkan:** **Rp ${res.amountPaid.toLocaleString('id-ID')}**\n` +
                      `⚠️ **Sisa Hutang:** **Rp ${res.remainingDebt.toLocaleString('id-ID')}**\n` +
                      `💵 **Sisa Saldo Dompet:** **Rp ${res.walletBalance.toLocaleString('id-ID')}**`;
                  }
                  await iBank.reply({ embeds: [embeds.bankSuccessEmbed('Pembayaran Berhasil!', desc)], flags: 64 });
                  await privateMsg.edit(getBankDashboardDataPrivate(user.id)).catch(() => {});
                } else if (hasFriendDebts) {
                  // Langsung bayar hutang teman
                  await handleFriendRepayFlowPrivate(iBank);
                }
              } catch (err) {
                await iBank.reply({ embeds: [embeds.bankErrorEmbed('Pembayaran Gagal!', err.message)], flags: 64 });
              }
            }

            else if (iBank.customId === 'bank_btn_transfer') {
              const userSelect = new UserSelectMenuBuilder()
                .setCustomId('bank_transfer_select_target_perm')
                .setPlaceholder('👤 Pilih Target Penerima Transfer');

              const rowMenu = new ActionRowBuilder().addComponents(userSelect);
              const cancelBtn = new ButtonBuilder().setCustomId('bank_transfer_cancel_perm').setLabel('✖️ Batalkan').setStyle(ButtonStyle.Secondary);
              const rowBtn = new ActionRowBuilder().addComponents(cancelBtn);

              const askTransferMsg = await iBank.reply({
                content: '💸 **TRANSFER TABUNGAN BANK**\nSilakan pilih anggota target penerima transfer tabungan bank di bawah ini:',
                components: [rowMenu, rowBtn],
                flags: 64,
                fetchReply: true
              });


              const transferCollector = iBank.channel.createMessageComponentCollector({
                filter: i => i.message.id === askTransferMsg.id,
                time: 60000
              });

              transferCollector.on('collect', async iSelect => {
                if (iSelect.user.id !== user.id) return;
                transferCollector.stop();

                if (iSelect.customId === 'bank_transfer_cancel_perm') {
                  await iSelect.update({ content: '❌ Transfer dibatalkan.', components: [] });
                } else if (iSelect.customId === 'bank_transfer_select_target_perm') {
                  const targetUserId = iSelect.values[0];
                  if (targetUserId === user.id) {
                    return iSelect.reply({ content: '❌ Anda tidak bisa mentransfer ke diri sendiri!', flags: 64 });
                  }

                  const typeButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`bank_tf_biasa_perm_${targetUserId}`).setLabel('💸 Transfer Biasa').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`bank_tf_bayar_perm_${targetUserId}`).setLabel('📉 Bayar Hutang').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`bank_tf_beri_perm_${targetUserId}`).setLabel('📈 Beri Hutang (Pinjamkan)').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('bank_tf_cancel_perm').setLabel('✖️ Batal').setStyle(ButtonStyle.Danger)
                  );

                  await iSelect.update({
                    content: `👉 **Pilih tipe transfer tabungan ke <@${targetUserId}>:**`,
                    components: [typeButtons]
                  });

                  const typeCollector = iBank.channel.createMessageComponentCollector({
                    filter: i => i.message.id === askTransferMsg.id,
                    componentType: ComponentType.Button,
                    time: 60000
                  });

                  typeCollector.on('collect', async iType => {
                    if (iType.user.id !== user.id) return;
                    typeCollector.stop();

                    if (iType.customId === 'bank_tf_cancel_perm') {
                      await iType.update({ content: '❌ Transfer dibatalkan.', components: [] });
                      return;
                    }

                    const selectedType = iType.customId.split('_')[2]; // biasa, bayar, beri

                    const modal = new ModalBuilder()
                      .setCustomId(`bank_modal_tf_${selectedType}_perm_${targetUserId}`)
                      .setTitle('💸 Transfer Tabungan Bank');

                    const amountInput = new TextInputBuilder()
                      .setCustomId('transfer_amount')
                      .setLabel('Jumlah koin (angka atau "all")')
                      .setPlaceholder('Contoh: 10000')
                      .setStyle(TextInputStyle.Short)
                      .setRequired(true);

                    modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
                    await iType.showModal(modal);
                    await askTransferMsg.delete().catch(() => {});

                    const submitted = await iType.awaitModalSubmit({
                      filter: (sub) => sub.customId === `bank_modal_tf_${selectedType}_perm_${targetUserId}` && sub.user.id === user.id,
                      time: 60000
                    }).catch(() => null);

                    if (submitted) {
                      try {
                        const amountStr = submitted.fields.getTextInputValue('transfer_amount');

                        if (selectedType === 'bayar') {
                          const debt = database.get(
                            'SELECT amount FROM bail_debts WHERE guild_id = ? AND debtor_id = ? AND creditor_id = ?',
                            [guildId, user.id, targetUserId]
                          );
                          if (!debt || debt.amount <= 0) {
                            return submitted.reply({ embeds: [embeds.errorEmbed('Transfer Gagal!', `Anda tidak memiliki hutang jaminan ke <@${targetUserId}>!`)], flags: 64 });
                          }
                        }

                        // JIKA TIPE = BERI HUTANG (PINJAMKAN) -> TAWARKAN PINJAMAN INTERAKTIF
                        if (selectedType === 'beri') {
                          let amount = bank.parseAmount(amountStr);
                          if (amount === 'all') {
                            const senderSavings = bank.getSavings(user.id, guildId);
                            amount = senderSavings.balance;
                          }

                          if (isNaN(amount) || amount <= 0) {
                            return submitted.reply({ embeds: [embeds.errorEmbed('Transfer Gagal!', 'Nominal transfer harus berupa angka di atas 0.')], flags: 64 });
                          }

                          const senderSavings = bank.getSavings(user.id, guildId);
                          if (senderSavings.balance < amount) {
                            return submitted.reply({ embeds: [embeds.errorEmbed('Transfer Gagal!', `Saldo tabungan Anda tidak mencukupi! Saldo Anda Rp ${senderSavings.balance.toLocaleString('id-ID')}`)], flags: 64 });
                          }

                          const promptEmbed = new EmbedBuilder()
                            .setColor(embeds.COLORS.SUCCESS)
                            .setTitle('🤝 Tawaran Pinjaman Bank (Beri Hutang)')
                            .setDescription(
                              `👤 **Pengirim (Kreditur):** <@${user.id}>\n` +
                              `👤 **Penerima (Debitur):** <@${targetUserId}>\n` +
                              `💰 **Jumlah Pinjaman:** **Rp ${amount.toLocaleString('id-ID')}**\n\n` +
                              `📢 <@${targetUserId}>, **<@${user.id}>** ingin meminjamkan koin sebesar **Rp ${amount.toLocaleString('id-ID')}** dari tabungan banknya kepada Anda.\n` +
                              `Jika Anda **Menerima**, koin akan masuk ke tabungan bank Anda, dan Anda akan **tercatat memiliki hutang** sebesar koin bersih yang diterima ke <@${user.id}>.\n\n` +
                              `Apakah Anda bersedia menerima pinjaman ini?`
                            )
                            .setTimestamp();

                          const promptButtons = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`loan_accept_${user.id}_${targetUserId}_${amount}_perm`).setLabel('✅ Terima Pinjaman').setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId(`loan_reject_${user.id}_${targetUserId}_${amount}_perm`).setLabel('❌ Tolak Pinjaman').setStyle(ButtonStyle.Danger)
                          );

                          await submitted.reply({ content: `📨 Tawaran pinjaman Anda sebesar **Rp ${amount.toLocaleString('id-ID')}** telah dikirim ke channel <#${submitted.channelId}> untuk dikonfirmasi oleh <@${targetUserId}>.`, flags: 64 });

                          const promptMessage = await submitted.channel.send({
                            content: `<@${targetUserId}>`,
                            embeds: [promptEmbed],
                            components: [promptButtons]
                          });

                          const promptCollector = submitted.channel.createMessageComponentCollector({
                            filter: i => i.message.id === promptMessage.id,
                            componentType: ComponentType.Button,
                            time: 120000
                          });

                          promptCollector.on('collect', async iPrompt => {
                            if (iPrompt.user.id !== targetUserId) {
                              return iPrompt.reply({ content: '❌ Hanya penerima pinjaman yang dapat mengklik tombol ini!', flags: 64 });
                            }
                            promptCollector.stop();

                            if (iPrompt.customId.startsWith('loan_reject_')) {
                              const rejectEmbed = new EmbedBuilder()
                                .setColor(0xC0392B)
                                .setTitle('❌ Pinjaman Ditolak!')
                                .setDescription(`Tawaran pinjaman sebesar **Rp ${amount.toLocaleString('id-ID')}** dari <@${user.id}> telah ditolak oleh <@${targetUserId}>.`)
                                .setTimestamp();
                              await iPrompt.update({ embeds: [rejectEmbed], components: [] });
                            } else if (iPrompt.customId.startsWith('loan_accept_')) {
                              try {
                                const currentSenderSavings = bank.getSavings(user.id, guildId);
                                if (currentSenderSavings.balance < amount) {
                                  throw new Error(`Saldo tabungan pengirim (<@${user.id}>) sudah tidak mencukupi untuk melakukan transfer ini!`);
                                }

                                const res = bank.transferSavings(user.id, targetUserId, guildId, amount.toString());

                                database.run(
                                  `INSERT INTO bail_debts (guild_id, debtor_id, creditor_id, amount) 
                                   VALUES (?, ?, ?, ?) 
                                   ON CONFLICT(guild_id, debtor_id, creditor_id) 
                                   DO UPDATE SET amount = amount + EXCLUDED.amount`,
                                  [guildId, targetUserId, user.id, res.netAmount]
                                );

                                const newDebt = database.get(
                                  'SELECT amount FROM bail_debts WHERE guild_id = ? AND debtor_id = ? AND creditor_id = ?',
                                  [guildId, targetUserId, user.id]
                                );

                                const roomTierName = res.roomTier === 'DEFAULT' ? 'Biasa / Tanpa Sewa' :
                                  res.roomTier === 'KIPAS' ? '💨 Kamar Kipas Angin' :
                                    res.roomTier === 'AC' ? '❄️ Kamar AC' : '👑 Penthouse Kosan';

                                const successEmb = embeds.bankSuccessEmbed(
                                  'Pinjaman Berhasil Diterima! 🤝',
                                  `Koin dipinjamkan: **Rp ${res.amount.toLocaleString('id-ID')}**\n` +
                                  `✂️ Pajak Transfer (${res.taxRatePercent}%): **-Rp ${res.tax.toLocaleString('id-ID')}** (Dibakar)\n` +
                                  `📥 Bersih masuk tabungan Anda: **Rp ${res.netAmount.toLocaleString('id-ID')}**\n` +
                                  `🏢 Kasta Sewa Kamar Pengirim: **${roomTierName}**\n\n` +
                                  `📈 **STATUS HUTANG BARU:**\n` +
                                  `• Jumlah Pinjaman Baru: **Rp ${res.netAmount.toLocaleString('id-ID')}**\n` +
                                  `• Total Hutang Anda ke <@${user.id}>: **Rp ${newDebt.amount.toLocaleString('id-ID')}**\n\n` +
                                  `🏦 **Sisa Tabungan Pengirim:** **Rp ${res.senderSavingsBalance.toLocaleString('id-ID')}**`
                                );

                                await iPrompt.update({ embeds: [successEmb], components: [] });
                              } catch (err) {
                                await iPrompt.update({ content: `❌ Gagal memproses pinjaman: ${err.message}`, embeds: [], components: [] });
                              }
                            }
                          });

                          promptCollector.on('end', async (collected, reason) => {
                            if (reason === 'time') {
                              const timeoutEmbed = new EmbedBuilder()
                                .setColor(0x7F8C8D)
                                .setTitle('⏰ Waktu Konfirmasi Habis!')
                                .setDescription(`Tawaran pinjaman sebesar **Rp ${amount.toLocaleString('id-ID')}** dari <@${user.id}> kepada <@${targetUserId}> telah kedaluwarsa karena tidak direspons.`)
                                .setTimestamp();
                              await promptMessage.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
                            }
                          });

                          return;
                        }

                        // JIKA TIPE = BIASA ATAU BAYAR -> TRANSFER LANGSUNG
                        const res = bank.transferSavings(user.id, targetUserId, guildId, amountStr);

                        let targetName = targetUserId;
                        try {
                          const targetMember = await submitted.guild.members.fetch(targetUserId).catch(() => null);
                          if (targetMember) targetName = targetMember.displayName;
                        } catch (err) {}

                        const roomTierName = res.roomTier === 'DEFAULT' ? 'Biasa / Tanpa Sewa' :
                          res.roomTier === 'KIPAS' ? '💨 Kamar Kipas Angin' :
                            res.roomTier === 'AC' ? '❄️ Kamar AC' : '👑 Penthouse Kosan';

                        let extraDesc = '';
                        if (selectedType === 'bayar') {
                          const debt = database.get(
                            'SELECT amount FROM bail_debts WHERE guild_id = ? AND debtor_id = ? AND creditor_id = ?',
                            [guildId, user.id, targetUserId]
                          );
                          const paidAmount = Math.min(res.netAmount, debt.amount);
                          const remains = debt.amount - paidAmount;

                          database.transaction(() => {
                            if (remains <= 0) {
                              database.run(
                                'DELETE FROM bail_debts WHERE guild_id = ? AND debtor_id = ? AND creditor_id = ?',
                                [guildId, user.id, targetUserId]
                              );
                            } else {
                              database.run(
                                'UPDATE bail_debts SET amount = ? WHERE guild_id = ? AND debtor_id = ? AND creditor_id = ?',
                                [remains, guildId, user.id, targetUserId]
                              );
                            }
                          })();

                          extraDesc = `\n\n📉 **PEMBAYARAN HUTANG:**\n` +
                            `• Hutang Awal: **Rp ${debt.amount.toLocaleString('id-ID')}**\n` +
                            `• Dibayar (dari Net Transfer): **Rp ${paidAmount.toLocaleString('id-ID')}**\n` +
                            `• Sisa Hutang: ` + (remains > 0 ? `**Rp ${remains.toLocaleString('id-ID')}**` : `✨ **LUNAS!**`);
                        }

                        const successEmb = embeds.bankSuccessEmbed(
                          'Transfer Tabungan Berhasil!',
                          `Koin ditransfer: **Rp ${res.amount.toLocaleString('id-ID')}**\n` +
                          `✂️ Pajak Transfer (${res.taxRatePercent}%): **-Rp ${res.tax.toLocaleString('id-ID')}** (Dibakar)\n` +
                          `📥 Bersih masuk tabungan target: **Rp ${res.netAmount.toLocaleString('id-ID')}**\n` +
                          `🏢 Kasta Sewa Kamar Pengirim: **${roomTierName}**\n\n` +
                          `👉 Penerima: **${targetName}** (<@${targetUserId}>)` +
                          `${extraDesc}\n\n` +
                          `🏦 **Sisa Tabungan Anda:** **Rp ${res.senderSavingsBalance.toLocaleString('id-ID')}**`
                        );

                        await submitted.reply({ embeds: [successEmb], flags: 64 });
                        await privateMsg.edit(getBankDashboardDataPrivate(user.id)).catch(() => {});

                        // KIRIM NOTIFIKASI CHANNEL UNTUK PENERIMA
                        try {
                          if (submitted.channelId !== '1510121069783023646') {
                            const embed = embeds.bankTransferNotificationEmbed(user, targetUserId, res.netAmount, selectedType === 'bayar');
                            await submitted.channel.send({ content: `<@${targetUserId}>`, embeds: [embed] });
                          }
                        } catch (err) {
                          console.error('Gagal mengirim notifikasi transfer ke channel:', err);
                        }
                      } catch (err) {
                        await submitted.reply({ embeds: [embeds.bankErrorEmbed('Transfer Gagal!', err.message)], flags: 64 });
                      }
                    }
                  });
                }
              });
            }
          } catch (err) {
            console.error('Error in bank private collector:', err);
          }
        });

        collector.on('end', async () => {
          await interaction.deleteReply().catch(() => { });
        });
      }

      // ── PORTAL PERMANEN: INVENTORY SAYA ──
      else if (customId === 'eco_btn_open_inventory_private_perm' || customId === 'eco_btn_open_inventory_direct') {
        await interaction.deferReply({ flags: 64 });
        
        // Fetch all inventory items (quantity > 0)
        const inv = database.all(
          'SELECT item_id, quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND quantity > 0',
          [user.id, guildId]
        );

        // Fetch all pet inventory items (quantity > 0)
        const petInv = database.all(
          'SELECT item_id, quantity FROM pet_inventory WHERE user_id = ? AND guild_id = ? AND quantity > 0',
          [user.id, guildId]
        );

        // ─── MASTER ITEM MAP (dengan kategori & sub-kategori) ───
        const allItems = {
          // ── Black Market: Alat Kriminal ──
          LOCKPICK:  { name: '🗝️ Linggis / Lockpick',       cat: 'BM', sub: 'tool' },
          MASK:      { name: '🎭 Topeng Samaran',             cat: 'BM', sub: 'tool' },
          MEAT:      { name: '🥩 Daging Bius',                cat: 'BM', sub: 'tool' },
          SOAP:      { name: '🧼 Sabun Licin',                cat: 'BM', sub: 'tool' },
          // ── Black Market: Pertahanan ──
          BRANKAS:   { name: '🛡️ Brankas Anti-Hacker',       cat: 'BM', sub: 'defense' },
          // ── Barang Mewah / Luxury ──
          LAMBO:     { name: '🏎️ Lamborgini Kosan',          cat: 'LUXURY' },
          GOLD:      { name: '👑 Batangan Emas Murni 24K',    cat: 'LUXURY' },
          KEY:       { name: '🔑 Kunci Emas Penthouse',       cat: 'LUXURY' },
          ROLEX:     { name: '⌚ Jam Tangan Rolek Master',    cat: 'LUXURY' },
          IPHONE:    { name: '📱 iPhone 16 Pro Max',          cat: 'LUXURY' },
          // ── Kebun: Benih ──
          SEED_ROSE:       { name: '🌱 Benih Mawar Merah',    cat: 'GARDEN', sub: 'seed' },
          SEED_TULIP:      { name: '🌱 Benih Bunga Tulip',    cat: 'GARDEN', sub: 'seed' },
          SEED_LAVENDER:   { name: '🌱 Benih Bunga Lavender', cat: 'GARDEN', sub: 'seed' },
          SEED_SAKURA:     { name: '🌱 Benih Bunga Sakura',   cat: 'GARDEN', sub: 'seed' },
          SEED_ORCHID:     { name: '🌱 Benih Anggrek Langka', cat: 'GARDEN', sub: 'seed' },
          // ── Kebun: Bunga Panen ──
          FLOWER_ROSE:     { name: '🌹 Mawar Merah',          cat: 'GARDEN', sub: 'flower' },
          FLOWER_TULIP:    { name: '🌷 Bunga Tulip',          cat: 'GARDEN', sub: 'flower' },
          FLOWER_LAVENDER: { name: '🪻 Bunga Lavender',       cat: 'GARDEN', sub: 'flower' },
          FLOWER_SAKURA:   { name: '🌸 Bunga Sakura',         cat: 'GARDEN', sub: 'flower' },
          FLOWER_ORCHID:   { name: '🪻 Anggrek Langka',       cat: 'GARDEN', sub: 'flower' },
          // ── Kebun: Buket ──
          BOUQUET_LOVE:     { name: '💐 Buket Kasih Sayang',  cat: 'GARDEN', sub: 'bouquet' },
          BOUQUET_PEACE:    { name: '💐 Buket Ketenangan',    cat: 'GARDEN', sub: 'bouquet' },
          BOUQUET_IMPERIAL: { name: '👑 Buket Legendaris',    cat: 'GARDEN', sub: 'bouquet' },
          // ── Kebun: Perlengkapan ──
          GIFT_WRAPPING:    { name: '🎗️ Kertas Kado Premium', cat: 'GARDEN', sub: 'supply' },
          // ── Pet: Makanan & Perawatan ──
          FOOD_BASIC:    { name: '🍗 Pakan Pet Biasa',     cat: 'PET', sub: 'care' },
          FOOD_PREMIUM:  { name: '🥩 Daging Premium',      cat: 'PET', sub: 'care' },
          WATER:         { name: '🥤 Air Bersih',          cat: 'PET', sub: 'care' },
          MEDICINE:      { name: '💊 Ramuan Kesehatan',    cat: 'PET', sub: 'care' },
          TOY:           { name: '⚽ Bola Karet',          cat: 'PET', sub: 'care' },
          SODA_ENERGY:   { name: '🥤 Soda Energi Pet',    cat: 'PET', sub: 'care' },
          SOAP_PET:      { name: '🧼 Sabun Mandi Pet',    cat: 'PET', sub: 'care' },
          // ── Pet: Aksesoris ──
          COLLAR_IRON:   { name: '🪮 Kalung Besi',        cat: 'PET', sub: 'accessory' },
          SWORD_TOY:     { name: '⚔️ Pedang Mainan',      cat: 'PET', sub: 'accessory' },
          SHIELD_TOY:    { name: '🛡️ Tameng Mainan',      cat: 'PET', sub: 'accessory' },
          LUCKY_AMULET:  { name: '🔮 Jimat Keberuntungan', cat: 'PET', sub: 'accessory' },
          // ── Pet: XP Booster ──
          XP_2X: { name: '⚡ XP Booster 2x', cat: 'PET', sub: 'booster' },
          XP_4X: { name: '⚡ XP Booster 4x', cat: 'PET', sub: 'booster' },
          XP_6X: { name: '⚡ XP Booster 6x', cat: 'PET', sub: 'booster' },
          XP_8X: { name: '⚡ XP Booster 8x', cat: 'PET', sub: 'booster' },
        };

        // ─── Klasifikasi item menurut kategori & sub-kategori ───
        const categorized = {
          BM:      { tool: [], defense: [] },
          LUXURY:  [],
          GARDEN:  { seed: [], flower: [], bouquet: [], supply: [] },
          PET:     { care: [], accessory: [], booster: [] },
          OTHER:   []
        };

        let totalUniqueItems = 0;
        let totalQuantity = 0;

        // Proses user_inventory (BM, Luxury, Garden)
        inv.forEach(item => {
          const itemKey = item.item_id.toUpperCase();
          const info = allItems[itemKey];
          const line = `  ┊ ${info ? info.name : item.item_id} — **x${item.quantity}**`;
          totalUniqueItems++;
          totalQuantity += item.quantity;

          if (!info) {
            categorized.OTHER.push(line);
          } else if (info.cat === 'BM') {
            categorized.BM[info.sub || 'tool'].push(line);
          } else if (info.cat === 'LUXURY') {
            categorized.LUXURY.push(line);
          } else if (info.cat === 'GARDEN') {
            categorized.GARDEN[info.sub || 'supply'].push(line);
          } else if (info.cat === 'PET') {
            categorized.PET[info.sub || 'care'].push(line);
          } else {
            categorized.OTHER.push(line);
          }
        });

        // Proses pet_inventory (Pet items)
        petInv.forEach(item => {
          const itemKey = item.item_id.toUpperCase();
          const info = allItems[itemKey];
          const line = `  ┊ ${info ? info.name : item.item_id} — **x${item.quantity}**`;
          totalUniqueItems++;
          totalQuantity += item.quantity;

          if (info && info.cat === 'PET') {
            categorized.PET[info.sub || 'care'].push(line);
          } else {
            categorized.PET.care.push(line);
          }
        });

        // ─── Bangun deskripsi embed ───
        const hasBM      = categorized.BM.tool.length > 0 || categorized.BM.defense.length > 0;
        const hasLuxury   = categorized.LUXURY.length > 0;
        const hasGarden   = categorized.GARDEN.seed.length > 0 || categorized.GARDEN.flower.length > 0 || categorized.GARDEN.bouquet.length > 0 || categorized.GARDEN.supply.length > 0;
        const hasPet      = categorized.PET.care.length > 0 || categorized.PET.accessory.length > 0 || categorized.PET.booster.length > 0;
        const hasOther    = categorized.OTHER.length > 0;
        const isEmpty     = !hasBM && !hasLuxury && !hasGarden && !hasPet && !hasOther;

        let desc = `\`\`\`\n` +
          `┌──────────────────────────────┐\n` +
          `│  🎒 INVENTORY PEMAIN         │\n` +
          `│  Kantong Peralatan & Aset    │\n` +
          `└──────────────────────────────┘\n` +
          `\`\`\`\n` +
          `Halo **${user.username}**! Berikut seluruh barang & aset yang kamu miliki:\n`;

        if (isEmpty) {
          desc += `\n*Kantongmu benar-benar kosong! 📭*\n` +
            `*Kunjungi **Pasar Gelap**, **Toko Kebun**, **Toko Mewah**, atau **Toko Pet** untuk mulai berbelanja.*`;
        } else {
          desc += `┊ 📦 **Total Jenis Barang:** \`${totalUniqueItems}\` jenis\n` +
            `┊ 📊 **Total Kuantitas:** \`${totalQuantity}\` unit\n`;

          // ══ KATEGORI 1: BLACK MARKET ══
          if (hasBM) {
            desc += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            desc += `🖤 **PASAR GELAP (BLACK MARKET)**\n`;
            if (categorized.BM.tool.length > 0) {
              desc += `\n  🔧 *Alat Kriminal:*\n${categorized.BM.tool.join('\n')}\n`;
            }
            if (categorized.BM.defense.length > 0) {
              desc += `\n  🛡️ *Pertahanan:*\n${categorized.BM.defense.join('\n')}\n`;
            }
          }

          // ══ KATEGORI 2: BARANG MEWAH ══
          if (hasLuxury) {
            desc += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            desc += `💎 **BARANG & ASET MEWAH (LUXURY)**\n\n`;
            desc += categorized.LUXURY.join('\n') + '\n';
          }

          // ══ KATEGORI 3: PERKEBUNAN / KEBUN ══
          if (hasGarden) {
            desc += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            desc += `🌸 **PERKEBUNAN (COZY GARDEN)**\n`;
            if (categorized.GARDEN.seed.length > 0) {
              desc += `\n  🌱 *Stok Benih:*\n${categorized.GARDEN.seed.join('\n')}\n`;
            }
            if (categorized.GARDEN.flower.length > 0) {
              desc += `\n  🌺 *Bunga Hasil Panen:*\n${categorized.GARDEN.flower.join('\n')}\n`;
            }
            if (categorized.GARDEN.bouquet.length > 0) {
              desc += `\n  💐 *Buket Bunga Jadi:*\n${categorized.GARDEN.bouquet.join('\n')}\n`;
            }
            if (categorized.GARDEN.supply.length > 0) {
              desc += `\n  🎗️ *Perlengkapan Kebun:*\n${categorized.GARDEN.supply.join('\n')}\n`;
            }
          }

          // ══ KATEGORI 4: PELIHARAAN (PET) ══
          if (hasPet) {
            desc += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            desc += `🐾 **PELIHARAAN (PET SHOP)**\n`;
            if (categorized.PET.care.length > 0) {
              desc += `\n  🍗 *Makanan, Minuman & Obat:*\n${categorized.PET.care.join('\n')}\n`;
            }
            if (categorized.PET.accessory.length > 0) {
              desc += `\n  🪮 *Aksesoris Pet:*\n${categorized.PET.accessory.join('\n')}\n`;
            }
            if (categorized.PET.booster.length > 0) {
              desc += `\n  ⚡ *XP Booster:*\n${categorized.PET.booster.join('\n')}\n`;
            }
          }

          // ══ KATEGORI 5: LAINNYA ══
          if (hasOther) {
            desc += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            desc += `📦 **LAINNYA**\n\n`;
            desc += categorized.OTHER.join('\n') + '\n';
          }

          desc += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        }

        const embed = new EmbedBuilder()
          .setColor(0x00FFCC)
          .setTitle('🎒 INVENTORY PEMAIN — KANTONG PERALATAN & ASET')
          .setThumbnail(user.displayAvatarURL())
          .setDescription(desc)
          .setFooter({ text: 'Sistem Inventaris Bot Kosan 1A • Klik Portal Hub untuk belanja!' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      }

      // ── PORTAL PERMANEN: PASAR GELAP (BM) ──
      else if (customId === 'eco_btn_open_bm_private_perm' || customId === 'eco_btn_open_bm_direct') {
        await interaction.deferReply({ flags: 64 });
        try {
          const getBmPanelData = (targetUserId, statusMsg = '') => {
            const wallet = economy.getWallet(targetUserId, guildId);
            const embed = new EmbedBuilder()
              .setColor(0x1A1A1A)
              .setTitle('🕵️‍♂️ PASAR GELAP KOSAN (BLACK MARKET)')
              .setDescription(
                `Selamat datang di pasar gelap kosan, kawan. Butuh barang-barang untuk memuluskan aksi kriminalmu? Kami punya persediaannya...\n\n` +
                (statusMsg ? `🔔 **Notifikasi:** ${statusMsg}\n\n` : '') +
                `💵 **Saldo Rupiah Anda:** **Rp ${wallet.balance.toLocaleString('id-ID')}**\n\n` +
                `**Daftar Peralatan Tersedia:**\n\n` +
                `🗝️ **Linggis / Lockpick** (\`lockpick\`) - **Rp 450**\n` +
                `*Meningkatkan sukses rate rob +15% (peluang patah 20%).*\n\n` +
                `🎭 **Topeng Samaran** (\`mask\`) - **Rp 600**\n` +
                `*Menyembunyikan namamu saat rob berhasil (sekali pakai).*\n\n` +
                `🥩 **Daging Bius** (\`meat\`) - **Rp 350**\n` +
                `*Menonaktifkan Alarm & CCTV korban saat rob (sekali pakai).*\n\n` +
                `🧼 **Sabun Licin** (\`soap\`) - **Rp 500**\n` +
                `*Memotong waktu tahanan penjara 50% jika ketangkap (sekali pakai).*\n\n` +
                `👮 **Borgol / Handcuffs** (\`handcuffs\`) - **Rp 500**\n` +
                `*Meningkatkan peluang menangkap buronan sebesar +20% saat .arrest.*\n\n` +
                `🛡️ **Brankas Anti-Hacker** (\`brankas\`) - **Rp 2.500**\n` +
                `*Melindungi saldo bank Anda dari Heist (memotong kehilangan 90% secara pasif).*\n\n` +
                `*Pilih barang di menu dropdown di bawah untuk membeli secara privat.*`
              )
              .setFooter({ text: 'Pasar Gelap Bot Kosan 1A • Kerahasiaan Terjamin' })
              .setTimestamp();
            return { embeds: [embed] };
          };

          const bmSelect = new StringSelectMenuBuilder()
            .setCustomId('bm_select_buy_items')
            .setPlaceholder('🕵️‍♂️ Pilih item Black Market untuk dibeli...')
            .addOptions(
              new StringSelectMenuOptionBuilder().setLabel('🗝️ Linggis / Lockpick').setDescription('Harga: Rp 450').setValue('lockpick'),
              new StringSelectMenuOptionBuilder().setLabel('🎭 Topeng Samaran').setDescription('Harga: Rp 600').setValue('mask'),
              new StringSelectMenuOptionBuilder().setLabel('🥩 Daging Bius').setDescription('Harga: Rp 350').setValue('meat'),
              new StringSelectMenuOptionBuilder().setLabel('🧼 Sabun Licin').setDescription('Harga: Rp 500').setValue('soap'),
              new StringSelectMenuOptionBuilder().setLabel('👮 Borgol / Handcuffs').setDescription('Harga: Rp 500').setValue('handcuffs'),
              new StringSelectMenuOptionBuilder().setLabel('🛡️ Brankas Anti-Hacker').setDescription('Harga: Rp 2.500').setValue('brankas')
            );

          const selectRow = new ActionRowBuilder().addComponents(bmSelect);
          const exitRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bm_btn_exit_perm').setLabel('✖️ Tutup Pasar Gelap').setStyle(ButtonStyle.Danger)
          );

          const initialData = getBmPanelData(user.id);
          const privateMsg = await interaction.editReply({ embeds: initialData.embeds, components: [selectRow, exitRow] });
          const collector = privateMsg.createMessageComponentCollector({ time: 180000 });

          collector.on('collect', async i => {
            if (i.user.id !== user.id) return i.reply({ content: '❌ Hanya orang yang memanggil menu ini yang bisa menggunakan menu/tombol!', flags: 64 });

            if (i.customId === 'bm_btn_exit_perm') {
              collector.stop();
              await i.update({ content: '👋 Meninggalkan pasar gelap...', embeds: [], components: [] }).catch(() => {});
              return;
            }

            if (i.isStringSelectMenu() && i.customId === 'bm_select_buy_items') {
              const itemId = i.values[0];
              const itemNames = {
                lockpick: '🗝️ Linggis / Lockpick',
                mask: '🎭 Topeng Samaran',
                meat: '🥩 Daging Bius',
                soap: '🧼 Sabun Licin',
                handcuffs: '👮 Borgol / Handcuffs',
                brankas: '🛡️ Brankas Anti-Hacker'
              };
              const itemName = itemNames[itemId] || itemId;

              const modal = new ModalBuilder()
                .setCustomId(`bm_modal_buy_${itemId}`)
                .setTitle(`Beli ${itemName}`);

              const qtyInput = new TextInputBuilder()
                .setCustomId('buy_qty')
                .setLabel('Jumlah yang ingin dibeli')
                .setPlaceholder('Contoh: 5')
                .setValue('1')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(4);

              modal.addComponents(new ActionRowBuilder().addComponents(qtyInput));
              await i.showModal(modal);

              const submitted = await i.awaitModalSubmit({
                filter: (sub) => sub.customId === `bm_modal_buy_${itemId}` && sub.user.id === user.id,
                time: 60000
              }).catch(() => null);

              if (submitted) {
                try {
                  const qtyStr = submitted.fields.getTextInputValue('buy_qty');
                  const qty = Math.max(1, parseInt(qtyStr) || 1);

                  const res = bm.buyItem(user.id, guildId, itemId, qty);
                  const statusMsg = `✅ Berhasil membeli **${qty}x ${res.item.name}** seharga **Rp ${res.totalPrice.toLocaleString('id-ID')}**!`;
                  
                  const updatedData = getBmPanelData(user.id, statusMsg);
                  await submitted.update({
                    embeds: updatedData.embeds,
                    components: [selectRow, exitRow]
                  }).catch(() => {});
                } catch (err) {
                  await submitted.reply({ embeds: [embeds.errorEmbed('Transaksi Gagal!', err.message)], flags: 64 });
                }
              }
            }
          });

          collector.on('end', async () => {
            await interaction.deleteReply().catch(() => { });
          });
        } catch (err) {
          await interaction.editReply({ embeds: [embeds.errorEmbed('Gagal Memuat Black Market!', err.message)] }).catch(() => {});
        }
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
          } else {
            // Build the manage options dropdown
            const manageOptions = [];
            
            manageOptions.push(
              new StringSelectMenuOptionBuilder()
                .setLabel('🎰 Gacha Pet')
                .setDescription('Beli & putar gacha pet acak (Rp 1.000)')
                .setValue('pet_manage_gacha')
            );

            if (userPet.status !== 'DEAD' && userPet.status !== 'EGG') {
              manageOptions.push(
                new StringSelectMenuOptionBuilder()
                  .setLabel('✨ Upgrade Bintang')
                  .setDescription('Tingkatkan bintang pet aktif Anda')
                  .setValue('pet_manage_upgrade')
              );
              manageOptions.push(
                new StringSelectMenuOptionBuilder()
                  .setLabel('🏋️ Gym & Latih Stat')
                  .setDescription('Kembangkan STR, VIT, DEF, & DEX pet Anda')
                  .setValue('pet_manage_gym')
              );
            }

            manageOptions.push(
              new StringSelectMenuOptionBuilder()
                .setLabel('🛒 Toko Pet')
                .setDescription('Beli pakan, obat-obatan, dan item pet')
                .setValue('pet_manage_shop')
            );

            if (userPet.status !== 'DEAD' && userPet.status !== 'EGG') {
              manageOptions.push(
                new StringSelectMenuOptionBuilder()
                  .setLabel('♻️ Daur Ulang Pet')
                  .setDescription('Daur ulang pet aktif untuk mendapatkan koin/item')
                  .setValue('pet_manage_recycle')
              );
            }

            manageOptions.push(
              new StringSelectMenuOptionBuilder()
                .setLabel('🧹 Reset Kandang')
                .setDescription('Hapus pet aktif saat ini secara permanen')
                .setValue('pet_manage_reset')
            );

            if (canAdoptMore) {
              manageOptions.push(
                new StringSelectMenuOptionBuilder()
                  .setLabel('🛎️ Adopsi Telur Pet')
                  .setDescription('Adopsi/beli telur pet baru (Rp 1.500)')
                  .setValue('pet_manage_adopt')
              );
            }

            if (userPet.status === 'DEAD') {
              manageOptions.push(
                new StringSelectMenuOptionBuilder()
                  .setLabel('🏥 Dokter Pet')
                  .setDescription(`Hidupkan kembali pet (Rp ${(500 * userPet.level).toLocaleString('id-ID')})`)
                  .setValue('pet_manage_revive')
              );
            }

            const manageDropdown = new StringSelectMenuBuilder()
              .setCustomId('pet_select_manage_actions')
              .setPlaceholder('⚙️ Kelola Pet (Gacha, Toko, Upgrade, dll)...')
              .addOptions(manageOptions);

            if (userPet.status === 'EGG') {
              const now = Math.floor(Date.now() / 1000);
              const isHatched = userPet.hatch_at <= now;
              const eggComponents = [
                new ButtonBuilder().setCustomId('pet_btn_hatch').setLabel('🐣 Tetaskan').setStyle(ButtonStyle.Success).setDisabled(!isHatched),
                new ButtonBuilder().setCustomId('pet_btn_refresh').setLabel('🔄 Segarkan').setStyle(ButtonStyle.Secondary)
              ];
              rows.push(new ActionRowBuilder().addComponents(eggComponents));
              rows.push(new ActionRowBuilder().addComponents(manageDropdown));
            } else if (userPet.status === 'DEAD') {
              const deadComponents = [
                new ButtonBuilder().setCustomId('pet_btn_revive').setLabel(`🏥 Dokter Pet (Rp ${(500 * userPet.level).toLocaleString('id-ID')})`).setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('pet_btn_refresh').setLabel('🔄 Segarkan').setStyle(ButtonStyle.Secondary)
              ];
              rows.push(new ActionRowBuilder().addComponents(deadComponents));
              rows.push(new ActionRowBuilder().addComponents(manageDropdown));
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
                new ButtonBuilder().setCustomId('pet_btn_breed').setLabel('💍 Kawin Silang').setStyle(ButtonStyle.Primary).setDisabled(
                  !(userPet.pet_name.toLowerCase() === 'ramzi' && userPet.user_id === '436554535037698059') &&
                  userPet.level < 10 &&
                  userPet.status !== 'ADULT'
                ),
                new ButtonBuilder().setCustomId('pet_btn_use_booster').setLabel('🎒 Tas Pet').setStyle(ButtonStyle.Primary)
              ];
              rows.push(new ActionRowBuilder().addComponents(row2Components));

              const isAutoFeedActive = userPet.auto_feed === 1 || userPet.auto_feed === 2;
              const autoFeedLabel = isAutoFeedActive ? '🤖 Auto Care: AKTIF' : '🤖 Auto Care (Rp 5.000)';
              const autoFeedStyle = isAutoFeedActive ? ButtonStyle.Success : ButtonStyle.Secondary;

              const row3Components = [
                new ButtonBuilder().setCustomId('pet_btn_autocare').setLabel(autoFeedLabel).setStyle(autoFeedStyle).setDisabled(isAutoFeedActive),
                new ButtonBuilder().setCustomId('pet_btn_refresh').setLabel('🔄 Segarkan').setStyle(ButtonStyle.Secondary)
              ];
              rows.push(new ActionRowBuilder().addComponents(row3Components));
              rows.push(new ActionRowBuilder().addComponents(manageDropdown));
            }
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

        const getShopPanelDataPrivate = (targetUserId, statusMsg = '') => {
          const wallet2 = economy.getWallet(targetUserId, guildId);
          const inv = pet.getInventory(targetUserId, guildId);
          const embed = embeds.petShopEmbed(wallet2, inv, statusMsg);

          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('pet_select_shop_item')
            .setPlaceholder('👉 Pilih persediaan untuk dibeli...')
            .addOptions(getPetShopSelectOptions());

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
            if (iPet.isStringSelectMenu() && iPet.customId === 'pet_select_manage_actions') {
              const selectedValue = iPet.values[0];
              if (selectedValue === 'pet_manage_gacha') {
                await iPet.deferReply({ flags: 64 });
                await handlePetGachaPanel(iPet, client, true);
              } else if (selectedValue === 'pet_manage_upgrade') {
                await iPet.deferReply({ flags: 64 });
                await handlePetUpgradePanel(iPet, client, true);
              } else if (selectedValue === 'pet_manage_shop') {
                await iPet.update(getShopPanelDataPrivate(user.id));
              } else if (selectedValue === 'pet_manage_recycle') {
                const allPetsFresh = pet.getPetsList(user.id, guildId);
                if (allPetsFresh.length === 0) {
                  return iPet.reply({ content: '❌ Anda tidak memiliki pet!', flags: 64 });
                }
                const selectMenu = new StringSelectMenuBuilder()
                  .setCustomId('pet_select_recycle_private')
                  .setPlaceholder('♻️ Pilih pet yang ingin didaur ulang...');
                allPetsFresh.forEach(p => {
                  const star = pet.renderStars(p.star_level || 1);
                  selectMenu.addOptions(new StringSelectMenuOptionBuilder()
                    .setLabel(`${p.pet_name} the ${p.pet_type} (${star}, Lv.${p.level})`)
                    .setDescription(`Recycle → +Rp ${pet.RECYCLE_REWARD.toLocaleString('id-ID')}`)
                    .setValue(p.pet_name)
                  );
                });
                const recycleEmbed = new EmbedBuilder()
                  .setColor(0xFF5252)
                  .setTitle('♻️ DAUR ULANG PET ♻️')
                  .setDescription(`Pilih pet yang ingin didaur ulang. Pet akan dihapus permanen dan Anda menerima **Rp ${pet.RECYCLE_REWARD.toLocaleString('id-ID')}** sebagai kompensasi.\n\n⚠️ **Aksi ini tidak bisa dibatalkan!**`)
                  .setTimestamp();
                const subPrivateMsg = await iPet.reply({
                  embeds: [recycleEmbed],
                  components: [new ActionRowBuilder().addComponents(selectMenu)],
                  flags: 64,
                  fetchReply: true
                });

                const recycleCollector = subPrivateMsg.createMessageComponentCollector({
                  componentType: ComponentType.StringSelect,
                  time: 60000
                });

                recycleCollector.on('collect', async iRecycle => {
                  if (iRecycle.user.id !== user.id) return;
                  const targetPetName = iRecycle.values[0];
                  try {
                    const res = pet.recyclePet(user.id, guildId, targetPetName);
                    await iRecycle.update({
                      embeds: [embeds.successEmbed('Recycle Berhasil! ♻️', `Pet **${res.petName}** telah didaur ulang.\n💰 **+Rp ${res.reward.toLocaleString('id-ID')}** ditambahkan ke dompet.`)],
                      components: []
                    });
                    await privateMsg.edit(getDashboardPanelPrivate(user.id)).catch(() => {});
                  } catch (err) {
                    await iRecycle.update({ embeds: [embeds.errorEmbed('Recycle Gagal!', err.message)], components: [] });
                  }
                });
              } else if (selectedValue === 'pet_manage_reset') {
                pet.resetPet(user.id, guildId);
                await iPet.update({ content: '🧹 Kandang dibersihkan!', embeds: [], components: [] });
                collector.stop();
              } else if (selectedValue === 'pet_manage_adopt') {
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
              } else if (selectedValue === 'pet_manage_revive') {
                try {
                  const res = pet.revivePet(user.id, guildId);
                  const successEmb = embeds.successEmbed(
                    'Pet Berhasil Dihidupkan! 🏥✨',
                    `Dokter Pet berhasil menyelamatkan **${res.pet.pet_name}** dari kematian!\n` +
                    `💰 Biaya Dokter: **Rp ${res.cost.toLocaleString('id-ID')}**\n` +
                    `❤️ HP: **${res.pet.health}%** | 🍖 Kenyangan: **${res.pet.hunger}%** | 💧 Hidrasi: **${res.pet.thirst}%**\n\n` +
                    `📉 Sisa dompetmu: **Rp ${economy.getWallet(user.id, guildId).balance.toLocaleString('id-ID')}**.`
                  );
                  await iPet.reply({ embeds: [successEmb], flags: 64 });
                  await privateMsg.edit(getDashboardPanelPrivate(user.id)).catch(() => { });
                } catch (err) {
                  await iPet.reply({ embeds: [embeds.errorEmbed('Gagal Menghidupkan Pet!', err.message)], flags: 64 });
                }
              } else if (selectedValue === 'pet_manage_gym') {
                await iPet.deferReply({ flags: 64 });
                await handlePetGymPanel(iPet, client, true);
              }
            } else if (iPet.customId === 'pet_btn_refresh') {
              await iPet.update(getDashboardPanelPrivate(user.id));
            } else if (iPet.customId === 'pet_btn_use_booster') {
              try {
                const freshPet = pet.getPet(user.id, guildId);
                if (!freshPet) {
                  return iPet.reply({ content: '❌ Anda tidak memiliki pet aktif!', flags: 64 });
                }
                const inv = pet.getInventory(user.id, guildId);
                const usableItems = inv.filter(item => item.quantity > 0);

                if (usableItems.length === 0) {
                  return iPet.reply({
                    embeds: [embeds.warnEmbed(
                      'Tas Pet Kosong! 🎒',
                      'Anda tidak memiliki item perawatan di persediaan pet Anda!\n\n' +
                      '🛒 *Silakan gunakan tombol **🛍️ Toko Pet** di Portal Hub (.hub) untuk membeli pakan, obat, soda, sabun, atau booster.*'
                    )],
                    flags: 64
                  });
                }

                const selectMenu = new StringSelectMenuBuilder()
                  .setCustomId('pet_select_item_use')
                  .setPlaceholder('🎒 Pilih item yang ingin digunakan...');

                usableItems.forEach(item => {
                  let effectDesc = '';
                  let cooldownDesc = '';

                  if (item.id === 'FOOD_BASIC') {
                    effectDesc = '+30 Kenyangan';
                    cooldownDesc = ' · Bebas Cooldown';
                  } else if (item.id === 'FOOD_PREMIUM') {
                    effectDesc = '+70 Kenyangan, +10 HP, +5 Kebahagiaan';
                    cooldownDesc = ' · Bebas Cooldown';
                  } else if (item.id === 'WATER') {
                    effectDesc = '+35 Hidrasi';
                    cooldownDesc = ' · Bebas Cooldown';
                  } else if (item.id === 'MEDICINE') {
                    effectDesc = '+50 HP, Sembuhkan Sakit';
                    cooldownDesc = ' · Bebas Cooldown';
                  } else if (item.id === 'TOY') {
                    effectDesc = '+50 Kebahagiaan';
                    cooldownDesc = ' · Bebas Cooldown';
                  } else if (item.id === 'SODA_ENERGY') {
                    effectDesc = 'Reset Cooldown Kerja/Berburu';
                    cooldownDesc = ' · Cooldown: 30m';
                  } else if (item.id === 'SOAP_PET') {
                    effectDesc = 'Mandi Bersih (Hilangkan Bau)';
                    cooldownDesc = ' · Bebas Cooldown';
                  } else if (item.multiplier) {
                    effectDesc = `Aktifkan pengali XP ${item.multiplier}x permanen`;
                    cooldownDesc = ' · Bebas Cooldown';
                  }

                  selectMenu.addOptions(
                    new StringSelectMenuOptionBuilder()
                      .setLabel(`${item.name} (x${item.quantity})`)
                      .setDescription(`${effectDesc}${cooldownDesc}`)
                      .setValue(item.id)
                  );
                });

                const row = new ActionRowBuilder().addComponents(selectMenu);
                const invEmbed = new EmbedBuilder()
                  .setColor(0x00b0ff)
                  .setTitle('🎒 INVENTARIS / TAS PET AKTIF 🎒')
                  .setDescription(
                    `Silakan pilih item di bawah untuk digunakan pada pet aktif Anda (**${freshPet.pet_name}**):\n\n` +
                    `*Menggunakan item dari tas langsung memotong kuantitas tanpa perlu auto-buy.*`
                  )
                  .setTimestamp();

                const subPrivateMsg = await iPet.reply({ embeds: [invEmbed], components: [row], flags: 64, fetchReply: true });
                const itemCollector = subPrivateMsg.createMessageComponentCollector({
                  componentType: ComponentType.StringSelect,
                  time: 60000
                });

                itemCollector.on('collect', async iItemUse => {
                  if (iItemUse.user.id !== user.id) return;
                  const selectedItemId = iItemUse.values[0];

                  try {
                    let result;
                    let detailDesc = '';

                    if (selectedItemId === 'SOAP_PET') {
                      result = pet.washPet(user.id, guildId);
                      detailDesc = `🚿 Anda memandikan **${result.pet.pet_name}** menggunakan **Sabun Mandi Pet**!\n🌸 **Hasil:** Kutukan bau busuk hilang total. Pet wangi melati dan siap beraktivitas kembali.`;
                    } else if (selectedItemId === 'SODA_ENERGY') {
                      result = pet.useSodaEnergy(user.id, guildId, false, iItemUse.member);
                      detailDesc = `🥤 Berhasil meminumkan **Soda Energi Pet** pada pet **${result.pet.pet_name}**!\n⚡ Cooldown Kerja & Berburu di-reset!\n` +
                        (result.gotSick ? `🤢 **ADUH!** Pet overdosis dan **Sakit/Pingsan!** HP anjlok ke 5.` : `📊 Kenyangan: \`${result.pet.hunger}%\` | Hidrasi: \`${result.pet.thirst}%\` | HP: \`${result.pet.health}%\`.`) +
                        `\n⏱️ *Cooldown: 30 Menit.*`;
                    } else {
                      result = pet.useItem(user.id, guildId, selectedItemId, false);
                      if (result.item.multiplier) {
                        detailDesc = `📈 Pengali XP Pet Anda sekarang menjadi **${result.item.multiplier}x** secara permanen!\n🌟 XP Didapat: **+${result.xpGained} XP**${result.levelUp ? ` (Naik ke Level **${result.pet.level}**! 🎉)` : ''}`;
                      } else {
                        const mins = Math.floor(result.item.cooldown / 60);
                        const cooldownText = result.item.cooldown > 0 ? `\n⏱️ *Cooldown: ${mins} Menit.*` : '';
                        detailDesc = `📊 Status Baru: Kenyangan **${result.pet.hunger}%**, Hidrasi **${result.pet.thirst}%**, HP **${result.pet.health}%**, Kebahagiaan **${result.pet.happiness}%** (+10 XP).${cooldownText}`;
                      }
                    }

                    const successEmb = embeds.successEmbed(
                      'Penggunaan Item Sukses! ✨',
                      `Berhasil menggunakan **${pet.PET_ITEMS[selectedItemId].name}** pada pet **${result.pet.pet_name}**!\n\n${detailDesc}`
                    );

                    await iItemUse.update({ embeds: [successEmb], components: [] });
                    await privateMsg.edit(getDashboardPanelPrivate(user.id)).catch(() => { });
                  } catch (err) {
                    await iItemUse.update({ embeds: [embeds.errorEmbed('Gagal Menggunakan Item!', err.message)], components: [] });
                  }
                });
              } catch (err) {
                await iPet.reply({ embeds: [embeds.errorEmbed('Gagal Membuka Inventaris!', err.message)], flags: 64 });
              }
            } else if (iPet.customId === 'pet_btn_reset') {
              pet.resetPet(user.id, guildId);
              await iPet.update({ content: '🧹 Kandang dibersihkan!', embeds: [], components: [] });
              collector.stop();
            } else if (iPet.customId === 'pet_btn_revive') {
              try {
                const res = pet.revivePet(user.id, guildId);
                const successEmb = embeds.successEmbed(
                  'Pet Berhasil Dihidupkan! 🏥✨',
                  `Dokter Pet berhasil menyelamatkan **${res.pet.pet_name}** dari kematian!\n` +
                  `💰 Biaya Dokter: **Rp ${res.cost.toLocaleString('id-ID')}**\n` +
                  `❤️ HP: **${res.pet.health}%** | 🍖 Kenyangan: **${res.pet.hunger}%** | 💧 Hidrasi: **${res.pet.thirst}%**\n\n` +
                  `📉 Sisa dompetmu: **Rp ${economy.getWallet(user.id, guildId).balance.toLocaleString('id-ID')}**.`
                );
                await iPet.reply({ embeds: [successEmb], flags: 64 });
                await privateMsg.edit(getDashboardPanelPrivate(user.id)).catch(() => { });
              } catch (err) {
                await iPet.reply({ embeds: [embeds.errorEmbed('Gagal Menghidupkan Pet!', err.message)], flags: 64 });
              }
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
              const res = pet.sendToWork(user.id, guildId, iPet.member);
              await iPet.reply({ embeds: [embeds.successEmbed('Kerja! 💼', `Gaji didapat **Rp ${res.reward}**.`)], flags: 64 });
              await privateMsg.edit(getDashboardPanelPrivate(user.id)).catch(() => { });
            } else if (iPet.customId === 'pet_btn_hunt') {
              const res = pet.sendToHunt(user.id, guildId, iPet.member);
              await iPet.reply({ embeds: [embeds.successEmbed('Berburu! 🏹', `Koin didapat **Rp ${res.reward}**.`)], flags: 64 });
              await privateMsg.edit(getDashboardPanelPrivate(user.id)).catch(() => { });
            } else if (iPet.customId === 'pet_btn_breed') {
              try {
                const freshPet = pet.getPet(user.id, guildId);
                if (!freshPet) {
                  return iPet.reply({ content: '❌ Anda tidak memiliki pet aktif!', flags: 64 });
                }
                if (freshPet.status !== 'ADULT') {
                  return iPet.reply({ content: `❌ Pet Anda **${freshPet.pet_name}** belum dewasa (Lv < 10)!`, flags: 64 });
                }

                const selectPartnerMenu = new UserSelectMenuBuilder()
                  .setCustomId('pet_breed_select_partner')
                  .setPlaceholder('💞 Pilih warga/partner kawin silang...');

                const partnerRow = new ActionRowBuilder().addComponents(selectPartnerMenu);
                const cancelBtn = new ButtonBuilder()
                  .setCustomId('pet_btn_cancel_breed')
                  .setLabel('✖️ Batalkan')
                  .setStyle(ButtonStyle.Secondary);
                const cancelRow = new ActionRowBuilder().addComponents(cancelBtn);

                await iPet.update({
                  embeds: [
                    new EmbedBuilder()
                      .setColor(0xFF80AB)
                      .setTitle('🔀 PERKAWINAN PET: PILIH PARTNER')
                      .setDescription(
                        `Silakan pilih warga server yang ingin Anda ajak kawin silang pet.\n\n` +
                        `📌 **Syarat Perkawinan:**\n` +
                        `• Kedua belah pihak harus memiliki **Pet Dewasa (Level >= 10)**\n` +
                        `• Biaya perkawinan masing-masing adalah **Rp 800**\n` +
                        `• Pet tidak boleh sedang bau busuk (smelly) atau sakit/terluka`
                      )
                  ],
                  components: [partnerRow, cancelRow]
                });
              } catch (err) {
                await iPet.reply({ embeds: [embeds.errorEmbed('Breeding Gagal!', err.message)], flags: 64 });
              }
            } else if (iPet.customId === 'pet_btn_cancel_breed') {
              await iPet.update(getDashboardPanelPrivate(user.id));
            } else if (iPet.customId === 'pet_breed_select_partner') {
              const partnerId = iPet.values[0];
              if (partnerId === user.id) {
                return iPet.reply({ content: '❌ Anda tidak bisa mengawinkan pet dengan diri Anda sendiri!', flags: 64 });
              }

              const modal = new ModalBuilder()
                .setCustomId(`pet_breed_modal_${partnerId}`)
                .setTitle('Nama Bayi Pet Baru');

              const nameInput = new TextInputBuilder()
                .setCustomId('child_name')
                .setLabel('Nama Bayi Pet Anda')
                .setPlaceholder('Contoh: Ciko Jr')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(25);

              modal.addComponents(new ActionRowBuilder().addComponents(nameInput));

              await iPet.showModal(modal);

              const submitted = await iPet.awaitModalSubmit({
                filter: (sub) => sub.customId === `pet_breed_modal_${partnerId}` && sub.user.id === user.id,
                time: 60000
              }).catch(() => null);

              if (submitted) {
                try {
                  const newName = submitted.fields.getTextInputValue('child_name');
                  const chalPet = pet.getPet(user.id, guildId);
                  const partPet = pet.getPet(partnerId, guildId);

                  if (!chalPet) return submitted.reply({ embeds: [embeds.errorEmbed('Breeding Gagal!', 'Anda tidak memiliki pet aktif!')], flags: 64 });
                  if (!partPet) return submitted.reply({ embeds: [embeds.errorEmbed('Breeding Gagal!', 'Partner Anda tidak memiliki pet aktif!')], flags: 64 });

                  if (chalPet.status !== 'ADULT') return submitted.reply({ embeds: [embeds.errorEmbed('Pet Belum Dewasa!', `Pet Anda **${chalPet.pet_name}** belum Dewasa (Lv < 10)!`)], flags: 64 });
                  if (partPet.status !== 'ADULT') return submitted.reply({ embeds: [embeds.errorEmbed('Pet Partner Belum Dewasa!', `Pet partner **${partPet.pet_name}** belum Dewasa (Lv < 10)!`)], flags: 64 });

                  const chalWallet = economy.getWallet(user.id, guildId);
                  const partWallet = economy.getWallet(partnerId, guildId);

                  if (chalWallet.balance < 800) return submitted.reply({ embeds: [embeds.errorEmbed('Saldo Kurang!', `Saldo Anda tidak mencukupi biaya perkawinan Rp 800!`)], flags: 64 });
                  if (partWallet.balance < 800) return submitted.reply({ embeds: [embeds.errorEmbed('Saldo Partner Kurang!', `Saldo partner Anda tidak mencukupi biaya perkawinan Rp 800!`)], flags: 64 });

                  // Kirim proposal perkawinan secara publik di channel
                  const proposalEmbed = new EmbedBuilder()
                    .setColor(0xFF80AB)
                    .setTitle('💕 PENAWARAN PERKAWINAN PET 💕')
                    .setDescription(
                      `🔔 <@${partnerId}>! Anda mendapatkan tawaran kawin silang dari <@${user.id}>!\n\n` +
                      `🦖 **Pet Anda:** **${partPet.pet_name}** (Lv. ${partPet.level} ${partPet.pet_type})\n` +
                      `⚔️ **Pet Pengirim:** **${chalPet.pet_name}** (Lv. ${chalPet.level} ${chalPet.pet_type})\n` +
                      `💰 **Biaya Masing-masing:** **Rp 800**\n` +
                      `🥚 **Nama Telur Anak:** **${newName}**\n\n` +
                      `*Klik tombol **🟢 Terima Perjodohan** di bawah untuk memulai breeding. Berlaku selama 60 detik!*`
                    )
                    .setFooter({ text: 'Rupiah Server Pet Breeding' })
                    .setTimestamp();

                  const breedRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('pet_breed_accept').setLabel('🟢 Terima Perjodohan').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('pet_breed_decline').setLabel('🔴 Tolak').setStyle(ButtonStyle.Danger)
                  );

                  const publicMsg = await interaction.channel.send({ content: `<@${partnerId}>`, embeds: [proposalEmbed], components: [breedRow] });

                  // Beri notifikasi sukses privat ke pemohon & update dashboard
                  await submitted.reply({ content: `✅ Penawaran perkawinan pet berhasil dikirim ke <#${interaction.channel.id}>!`, flags: 64 });
                  await privateMsg.edit(getDashboardPanelPrivate(user.id)).catch(() => { });

                  // Buat collector untuk tombol accept/decline di pesan publik
                  const breedCollector = publicMsg.createMessageComponentCollector({ time: 60000 });

                  breedCollector.on('collect', async iBreed => {
                    if (iBreed.user.id !== partnerId) {
                      return iBreed.reply({ content: '❌ Hanya penerima tawaran yang bisa merespon tombol ini!', flags: 64 });
                    }

                    try {
                      if (iBreed.customId === 'pet_breed_decline') {
                        breedCollector.stop();
                        await publicMsg.delete().catch(() => { });
                        return iBreed.reply({ content: `🔴 <@${user.id}>, tawaran perkawinan pet Anda ditolak oleh <@${partnerId}>.` });
                      }

                      if (iBreed.customId === 'pet_breed_accept') {
                        breedCollector.stop();
                        await publicMsg.delete().catch(() => { });

                        try {
                          const res = pet.breedPets(user.id, partnerId, guildId, newName);
                          const successEmb = new EmbedBuilder()
                            .setColor(0xFF80AB)
                            .setTitle('🎉 PERKAWINAN PET BERHASIL! 🎉')
                            .setDescription(
                              `💕 Perkawinan antara **${chalPet.pet_name}** dan **${partPet.pet_name}** sukses!\n\n` +
                              `🥚 **Lahir Telur Baru:** **${res.childName}** (Tipe: \`${res.childType}\`)\n` +
                              `✨ **Trait Warisan:** ${res.trait ? `**${res.trait}**` : '*Tidak ada trait khusus*'}\n` +
                              `⏳ **Penetasan Telur:** Telur akan menetas <t:${res.hatchAt}:R>.\n\n` +
                              `💸 Saldo masing-masing terpotong **Rp 800** untuk biaya perkawinan.`
                            )
                            .setFooter({ text: 'Gunakan .pet untuk melihat kandang Anda!' })
                            .setTimestamp();

                          return iBreed.reply({ content: `<@${user.id}> <@${partnerId}>`, embeds: [successEmb] });
                        } catch (err) {
                          return iBreed.reply({ embeds: [embeds.errorEmbed('Breeding Gagal!', err.message)] });
                        }
                      }
                    } catch (err) {
                      console.error('Error in breed collector:', err);
                    }
                  });

                  breedCollector.on('end', async () => {
                    if (breedCollector.destroyed) return;
                    await publicMsg.delete().catch(() => { });
                  });

                } catch (err) {
                  await submitted.reply({ embeds: [embeds.errorEmbed('Breeding Gagal!', err.message)], flags: 64 });
                }
              }
            } else if (iPet.customId === 'pet_btn_autocare') {
              try {
                const res = pet.unlockAutoCare(user.id, guildId);
                const successEmb = embeds.successEmbed(
                  '🔋 AUTO CARE DIAKTIFKAN! 🔋',
                  `Sinyal sensor otomatis pada kalung pet **${res.petName}** telah dinyalakan!\n\n` +
                  `**Ketentuan Perawatan Otomatis:**\n` +
                  `• 🍖 Kelaparan $\le$ 50% $\rightarrow$ Kenyangan $+30$ (Potong Rp 150)\n` +
                  `• 💧 Kehausan $\le$ 50% $\rightarrow$ Hidrasi $+35$ (Potong Rp 100)\n\n` +
                  `*Fitur ini menjaga pet Anda secara otomatis dengan memotong saldo koin dompet saat terpicu. Pastikan saldo Anda selalu terisi agar perawatan tidak terhenti!*`
                );
                await iPet.reply({ embeds: [successEmb], flags: 64 });
                await privateMsg.edit(getDashboardPanelPrivate(user.id)).catch(() => { });
              } catch (err) {
                await iPet.reply({ embeds: [embeds.errorEmbed('Gagal Mengaktifkan Auto Care!', err.message)], flags: 64 });
              }
            } else if (iPet.customId === 'pet_btn_gacha') {
              // Redirect ke panel gacha (ephemeral reply)
              await iPet.deferReply({ flags: 64 });
              await handlePetGachaPanel(iPet, client, true);
            } else if (iPet.customId === 'pet_btn_upgrade') {
              // Redirect ke panel upgrade (ephemeral reply)
              await iPet.deferReply({ flags: 64 });
              await handlePetUpgradePanel(iPet, client, true);
            } else if (iPet.customId === 'pet_btn_recycle') {
              const allPetsFresh = pet.getPetsList(user.id, guildId);
              if (allPetsFresh.length === 0) {
                return iPet.reply({ content: '❌ Anda tidak memiliki pet!', flags: 64 });
              }
              const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('pet_select_recycle_private')
                .setPlaceholder('♻️ Pilih pet yang ingin didaur ulang...');
              allPetsFresh.forEach(p => {
                const star = pet.renderStars(p.star_level || 1);
                selectMenu.addOptions(new StringSelectMenuOptionBuilder()
                  .setLabel(`${p.pet_name} the ${p.pet_type} (${star}, Lv.${p.level})`)
                  .setDescription(`Recycle → +Rp ${pet.RECYCLE_REWARD.toLocaleString('id-ID')}`)
                  .setValue(p.pet_name)
                );
              });
              const recycleEmbed = new EmbedBuilder()
                .setColor(0xFF5252)
                .setTitle('♻️ DAUR ULANG PET ♻️')
                .setDescription(`Pilih pet yang ingin didaur ulang. Pet akan dihapus permanen dan Anda menerima **Rp ${pet.RECYCLE_REWARD.toLocaleString('id-ID')}** sebagai kompensasi.\n\n⚠️ **Aksi ini tidak bisa dibatalkan!**`)
                .setTimestamp();
              const subPrivateMsg = await iPet.reply({
                embeds: [recycleEmbed],
                components: [new ActionRowBuilder().addComponents(selectMenu)],
                flags: 64,
                fetchReply: true
              });

              const recycleCollector = subPrivateMsg.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                time: 60000
              });

              recycleCollector.on('collect', async iRecycle => {
                if (iRecycle.user.id !== user.id) return;
                const targetPetName = iRecycle.values[0];
                try {
                  const res = pet.recyclePet(user.id, guildId, targetPetName);
                  await iRecycle.update({
                    embeds: [embeds.successEmbed('Recycle Berhasil! ♻️', `Pet **${res.petName}** telah didaur ulang.\n💰 **+Rp ${res.reward.toLocaleString('id-ID')}** ditambahkan ke dompet.`)],
                    components: []
                  });
                  // Refresh private dashboard
                  await privateMsg.edit(getDashboardPanelPrivate(user.id)).catch(() => {});
                } catch (err) {
                  await iRecycle.update({ embeds: [embeds.errorEmbed('Recycle Gagal!', err.message)], components: [] });
                }
              });
            } else if (iPet.customId === 'pet_btn_nav_shop') {
              await iPet.update(getShopPanelDataPrivate(user.id));
            } else if (iPet.customId === 'pet_btn_cancel_shop') {
              await iPet.update(getDashboardPanelPrivate(user.id));
            } else if (iPet.customId === 'pet_select_shop_item') {
              const selectedItemId = iPet.values[0];
              const item = pet.PET_ITEMS[selectedItemId.toUpperCase()];
              if (!item) return;

              const modal = new ModalBuilder()
                .setCustomId(`pet_modal_buy_${selectedItemId}`)
                .setTitle(`Beli ${item.name}`);

              const qtyInput = new TextInputBuilder()
                .setCustomId('buy_qty')
                .setLabel('Jumlah yang ingin dibeli')
                .setPlaceholder('Contoh: 5')
                .setValue('1')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(4);

              modal.addComponents(new ActionRowBuilder().addComponents(qtyInput));
              await iPet.showModal(modal);

              const submitted = await iPet.awaitModalSubmit({
                filter: (sub) => sub.customId === `pet_modal_buy_${selectedItemId}` && sub.user.id === user.id,
                time: 60000
              }).catch(() => null);

              if (submitted) {
                try {
                  const qtyStr = submitted.fields.getTextInputValue('buy_qty');
                  const qty = Math.max(1, parseInt(qtyStr) || 1);
                  
                  const res = pet.buyItem(user.id, guildId, selectedItemId, qty);
                  const statusMsg = `✅ Berhasil membeli **${qty}x ${res.item.name}** seharga **Rp ${res.totalPrice.toLocaleString('id-ID')}**!`;
                  await submitted.update(getShopPanelDataPrivate(user.id, statusMsg)).catch(() => {});
                } catch (err) {
                  await submitted.reply({ embeds: [embeds.errorEmbed('Belanja Gagal!', err.message)], flags: 64 });
                }
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
          await interaction.deleteReply().catch(() => { });
        });
      }

      // ── PORTAL PERMANEN: TOKO PET ──
      else if (customId === 'pet_btn_open_shop_private_perm') {
        await interaction.deferReply({ flags: 64 });

        const getShopPanelDataPrivate = (targetUserId, statusMsg = '') => {
          const wallet2 = economy.getWallet(targetUserId, guildId);
          const inv = pet.getInventory(targetUserId, guildId);
          const embed = embeds.petShopEmbed(wallet2, inv, statusMsg);

          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('pet_select_shop_item_perm')
            .setPlaceholder('👉 Pilih persediaan untuk dibeli...')
            .addOptions(getPetShopSelectOptions());

          const selectRow = new ActionRowBuilder().addComponents(selectMenu);
          const closeBtn = new ButtonBuilder().setCustomId('pet_btn_close_shop_perm').setLabel('✖️ Tutup Toko').setStyle(ButtonStyle.Danger);
          const closeRow = new ActionRowBuilder().addComponents(closeBtn);

          return { embeds: [embed], components: [selectRow, closeRow] };
        };

        const initialData = getShopPanelDataPrivate(user.id);
        const privateMsg = await interaction.editReply({ ...initialData });
        const collector = privateMsg.createMessageComponentCollector({ time: 180000 });

        collector.on('collect', async iShop => {
          if (iShop.user.id !== user.id) return iShop.reply({ content: '❌ Tombol ini bukan milik Anda!', flags: 64 });

          try {
            if (iShop.customId === 'pet_btn_close_shop_perm') {
              await privateMsg.delete().catch(() => {});
              collector.stop();
            } else if (iShop.customId === 'pet_select_shop_item_perm') {
              const selectedItemId = iShop.values[0];
              const item = pet.PET_ITEMS[selectedItemId.toUpperCase()];
              if (!item) return;

              const modal = new ModalBuilder()
                .setCustomId(`pet_modal_buy_perm_${selectedItemId}`)
                .setTitle(`Beli ${item.name}`);

              const qtyInput = new TextInputBuilder()
                .setCustomId('buy_qty')
                .setLabel('Jumlah yang ingin dibeli')
                .setPlaceholder('Contoh: 5')
                .setValue('1')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(4);

              modal.addComponents(new ActionRowBuilder().addComponents(qtyInput));
              await iShop.showModal(modal);

              const submitted = await iShop.awaitModalSubmit({
                filter: (sub) => sub.customId === `pet_modal_buy_perm_${selectedItemId}` && sub.user.id === user.id,
                time: 60000
              }).catch(() => null);

              if (submitted) {
                try {
                  const qtyStr = submitted.fields.getTextInputValue('buy_qty');
                  const qty = Math.max(1, parseInt(qtyStr) || 1);
                  
                  const res = pet.buyItem(user.id, guildId, selectedItemId, qty);
                  const statusMsg = `✅ Berhasil membeli **${qty}x ${res.item.name}** seharga **Rp ${res.totalPrice.toLocaleString('id-ID')}**!`;
                  await submitted.update(getShopPanelDataPrivate(user.id, statusMsg)).catch(() => {});
                } catch (err) {
                  await submitted.reply({ embeds: [embeds.errorEmbed('Belanja Gagal!', err.message)], flags: 64 });
                }
              }
            }
          } catch (err) {
            await iShop.reply({ content: `❌ Gagal: ${err.message}`, flags: 64 }).catch(() => { });
          }
        });

        collector.on('end', async () => {
          await interaction.deleteReply().catch(() => { });
        });
      }

      // ── PORTAL PERMANEN: KOSAN (.kos) ──
      else if (customId === 'eco_btn_open_kos_private_perm' || customId === 'eco_btn_open_kos_direct') {
        await interaction.deferReply({ flags: 64 });
        try {
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
            await interaction.deleteReply().catch(() => { });
          });
        } catch (err) {
          await interaction.editReply({ embeds: [embeds.errorEmbed('Gagal Memuat Menu Kosan!', err.message)] }).catch(() => {});
        }
      }

      // ── PORTAL PERMANEN: COZY FLOWER GARDEN ──
      else if (customId === 'eco_btn_open_garden_private_perm') {
        await interaction.deferReply({ flags: 64 });
        
        let selectedRecipientId = null;

        const getGardenDashboardDataPrivate = (targetUserId) => {
          const slots = garden.getGardenSlots(targetUserId, guildId);
          const wallet = economy.getWallet(targetUserId, guildId);
          const embed = embeds.gardenEmbed(user, slots, wallet.last_water_at);

          const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('garden_btn_water_all_perm').setLabel('💦 Siram Semua').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('garden_btn_harvest_all_perm').setLabel('🧺 Panen Semua').setStyle(ButtonStyle.Success)
          );

          const manageDropdown = new StringSelectMenuBuilder()
            .setCustomId('garden_select_manage_actions')
            .setPlaceholder('⚙️ Kelola Kebun (Toko, Crafting, Jual, Gift)...')
            .addOptions(
              new StringSelectMenuOptionBuilder().setLabel('🛒 Toko Benih').setDescription('Beli benih bunga baru dan kertas kado').setValue('go_shop'),
              new StringSelectMenuOptionBuilder().setLabel('💐 Rangkai Buket (Crafting)').setDescription('Rangkai bunga segar menjadi buket bunga indah').setValue('go_craft'),
              new StringSelectMenuOptionBuilder().setLabel('💰 Jual Bunga').setDescription('Jual hasil panen bunga langsung untuk koin').setValue('go_sell_menu'),
              new StringSelectMenuOptionBuilder().setLabel('🎁 Kirim Kado').setDescription('Kirim kado buket bunga kepada warga lain').setValue('go_gift_menu')
            );

          const row_manage = new ActionRowBuilder().addComponents(manageDropdown);

          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('garden_select_plant_perm')
            .setPlaceholder('🌱 Pilih benih & slot untuk menanam...')
            .addOptions(
              new StringSelectMenuOptionBuilder().setLabel('🌹 Tanam Mawar - Slot #1').setDescription('Mawar Merah (Common • Tumbuh: 30 Menit)').setValue('plant_rose_1'),
              new StringSelectMenuOptionBuilder().setLabel('🌹 Tanam Mawar - Slot #2').setDescription('Mawar Merah (Common • Tumbuh: 30 Menit)').setValue('plant_rose_2'),
              new StringSelectMenuOptionBuilder().setLabel('🌹 Tanam Mawar - Slot #3').setDescription('Mawar Merah (Common • Tumbuh: 30 Menit)').setValue('plant_rose_3'),
              new StringSelectMenuOptionBuilder().setLabel('🌷 Tanam Tulip - Slot #1').setDescription('Bunga Tulip (Common • Tumbuh: 1 Jam)').setValue('plant_tulip_1'),
              new StringSelectMenuOptionBuilder().setLabel('🌷 Tanam Tulip - Slot #2').setDescription('Bunga Tulip (Common • Tumbuh: 1 Jam)').setValue('plant_tulip_2'),
              new StringSelectMenuOptionBuilder().setLabel('🌷 Tanam Tulip - Slot #3').setDescription('Bunga Tulip (Common • Tumbuh: 1 Jam)').setValue('plant_tulip_3'),
              new StringSelectMenuOptionBuilder().setLabel('🪻 Tanam Lavender - Slot #1').setDescription('Lavender (Rare • Tumbuh: 2 Jam)').setValue('plant_lavender_1'),
              new StringSelectMenuOptionBuilder().setLabel('🪻 Tanam Lavender - Slot #2').setDescription('Lavender (Rare • Tumbuh: 2 Jam)').setValue('plant_lavender_2'),
              new StringSelectMenuOptionBuilder().setLabel('🪻 Tanam Lavender - Slot #3').setDescription('Lavender (Rare • Tumbuh: 2 Jam)').setValue('plant_lavender_3'),
              new StringSelectMenuOptionBuilder().setLabel('🌸 Tanam Sakura - Slot #1').setDescription('Sakura (Rare • Tumbuh: 4 Jam)').setValue('plant_sakura_1'),
              new StringSelectMenuOptionBuilder().setLabel('🌸 Tanam Sakura - Slot #2').setDescription('Sakura (Rare • Tumbuh: 4 Jam)').setValue('plant_sakura_2'),
              new StringSelectMenuOptionBuilder().setLabel('🌸 Tanam Sakura - Slot #3').setDescription('Sakura (Rare • Tumbuh: 4 Jam)').setValue('plant_sakura_3'),
              new StringSelectMenuOptionBuilder().setLabel('👑 Tanam Anggrek - Slot #1').setDescription('Anggrek Langka (Epic • Tumbuh: 8 Jam)').setValue('plant_orchid_1'),
              new StringSelectMenuOptionBuilder().setLabel('👑 Tanam Anggrek - Slot #2').setDescription('Anggrek Langka (Epic • Tumbuh: 8 Jam)').setValue('plant_orchid_2'),
              new StringSelectMenuOptionBuilder().setLabel('👑 Tanam Anggrek - Slot #3').setDescription('Anggrek Langka (Epic • Tumbuh: 8 Jam)').setValue('plant_orchid_3')
            );

          const row2 = new ActionRowBuilder().addComponents(selectMenu);

          return { embeds: [embed], components: [row1, row_manage, row2] };
        };

        const getGardenShopDataPrivate = (targetUserId, statusMsg = '') => {
          const walletShop = economy.getWallet(targetUserId, guildId);
          const embed = embeds.gardenShopEmbed(user, walletShop, statusMsg);

          const shopSelect = new StringSelectMenuBuilder()
            .setCustomId('garden_select_buy_seeds')
            .setPlaceholder('🛒 Pilih Benih / Item untuk Dibeli...')
            .addOptions(
              new StringSelectMenuOptionBuilder().setLabel('🌹 Benih Mawar').setDescription('Harga: Rp 80').setValue('buy_rose'),
              new StringSelectMenuOptionBuilder().setLabel('🌷 Benih Tulip').setDescription('Harga: Rp 150').setValue('buy_tulip'),
              new StringSelectMenuOptionBuilder().setLabel('🪻 Benih Lavender').setDescription('Harga: Rp 250').setValue('buy_lavender'),
              new StringSelectMenuOptionBuilder().setLabel('🌸 Benih Sakura').setDescription('Harga: Rp 500').setValue('buy_sakura'),
              new StringSelectMenuOptionBuilder().setLabel('👑 Benih Anggrek').setDescription('Harga: Rp 1.200').setValue('buy_orchid'),
              new StringSelectMenuOptionBuilder().setLabel('🎗️ Kertas Kado').setDescription('Harga: Rp 100').setValue('buy_wrapping')
            );

          const shopRow1 = new ActionRowBuilder().addComponents(shopSelect);
          const shopRow2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('garden_btn_back_perm').setLabel('🏡 Kembali ke Kebun').setStyle(ButtonStyle.Secondary)
          );

          return { embeds: [embed], components: [shopRow1, shopRow2] };
        };

        const getGardenCraftDataPrivate = (targetUserId) => {
          const craftRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('garden_craft_love_perm').setLabel('💖 Resep Love').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('garden_craft_peace_perm').setLabel('🪻 Resep Peace').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('garden_craft_imperial_perm').setLabel('👑 Resep Imperial').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('garden_btn_back_perm').setLabel('🏡 Kembali').setStyle(ButtonStyle.Success)
          );

          return { embeds: [embeds.bouquetCraftEmbed(user, guildId)], components: [craftRow] };
        };

        const getGardenSellDataPrivate = (targetUserId) => {
          const inv = database.all(
            `SELECT item_id, quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id LIKE 'FLOWER_%' AND quantity > 0`,
            [targetUserId, guildId]
          );

          const stock = { ROSE: 0, TULIP: 0, LAVENDER: 0, SAKURA: 0, ORCHID: 0 };
          inv.forEach(item => {
            const key = item.item_id.replace('FLOWER_', '').toUpperCase();
            if (stock[key] !== undefined) {
              stock[key] = item.quantity;
            }
          });

          const embed = new EmbedBuilder()
            .setColor(0x10B981)
            .setTitle('💰 PASAR JUAL BUNGA KEBUN')
            .setThumbnail(user.displayAvatarURL())
            .setDescription(
              `Di sini Anda dapat menjual bunga hasil panen Anda secara instan untuk mendapatkan koin:\n\n` +
              `🌹 **Mawar Merah**: Punya: \`${stock.ROSE} kuntum\` · Harga: **Rp 105** / kuntum\n` +
              `🌷 **Bunga Tulip**: Punya: \`${stock.TULIP} kuntum\` · Harga: **Rp 200** / kuntum\n` +
              `🪻 **Bunga Lavender**: Punya: \`${stock.LAVENDER} kuntum\` · Harga: **Rp 350** / kuntum\n` +
              `🌸 **Bunga Sakura**: Punya: \`${stock.SAKURA} kuntum\` · Harga: **Rp 750** / kuntum\n` +
              `🪻 **Anggrek Langka**: Punya: \`${stock.ORCHID} kuntum\` · Harga: **Rp 2.000** / kuntum\n\n` +
              `*Klik tombol di bawah ini untuk menjual seluruh stok bunga yang Anda miliki.*`
            )
            .setTimestamp();

          const sellRow1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('garden_sell_rose_all_perm').setLabel('🌹 Jual Mawar (All)').setStyle(ButtonStyle.Success).setDisabled(stock.ROSE <= 0),
            new ButtonBuilder().setCustomId('garden_sell_tulip_all_perm').setLabel('🌷 Jual Tulip (All)').setStyle(ButtonStyle.Success).setDisabled(stock.TULIP <= 0),
            new ButtonBuilder().setCustomId('garden_sell_lavender_all_perm').setLabel('🪻 Jual Lavender (All)').setStyle(ButtonStyle.Success).setDisabled(stock.LAVENDER <= 0)
          );

          const sellRow2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('garden_sell_sakura_all_perm').setLabel('🌸 Jual Sakura (All)').setStyle(ButtonStyle.Success).setDisabled(stock.SAKURA <= 0),
            new ButtonBuilder().setCustomId('garden_sell_orchid_all_perm').setLabel('👑 Jual Anggrek (All)').setStyle(ButtonStyle.Success).setDisabled(stock.ORCHID <= 0),
            new ButtonBuilder().setCustomId('garden_btn_back_perm').setLabel('🏡 Kembali').setStyle(ButtonStyle.Secondary)
          );

          return { embeds: [embed], components: [sellRow1, sellRow2] };
        };

        const getGardenGiftDataPrivate = (targetUserId, recId = null) => {
          const inv = database.all(
            `SELECT item_id, quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id LIKE 'BOUQUET_%' AND quantity > 0`,
            [targetUserId, guildId]
          );

          const stock = { LOVE: 0, PEACE: 0, IMPERIAL: 0 };
          inv.forEach(item => {
            const key = item.item_id.replace('BOUQUET_', '').toUpperCase();
            if (stock[key] !== undefined) {
              stock[key] = item.quantity;
            }
          });

          const recipientText = recId ? `🎯 **Penerima Terpilih**: <@${recId}>\n*Silakan pilih jenis buket di bawah untuk mengirim kado.*` : '❌ **Belum ada penerima terpilih**.\n*Silakan pilih penerima menggunakan menu dropdown anggota di bawah.*';

          const embed = new EmbedBuilder()
            .setColor(0xD4AF37)
            .setTitle('🎁 KIRIM KADO BUKET BUNGA')
            .setThumbnail(user.displayAvatarURL())
            .setDescription(
              `Kirimkan buket kado bunga indah kepada warga lain untuk memberikan mereka **Daily Passive Buff** (+koin klaim harian):\n\n` +
              `💖 **Buket Kasih Sayang**: Punya: \`${stock.LOVE} buket\` (Buff: +Rp 15 / daily)\n` +
              `🪻 **Buket Ketenangan**: Punya: \`${stock.PEACE} buket\` (Buff: +Rp 35 / daily)\n` +
              `👑 **Buket Legendaris**: Punya: \`${stock.IMPERIAL} buket\` (Buff: +Rp 80 / daily)\n\n` +
              `${recipientText}`
            )
            .setTimestamp();

          const userSelect = new UserSelectMenuBuilder()
            .setCustomId('garden_gift_select_user_perm')
            .setPlaceholder('👥 1. Pilih Warga Penerima Kado');

          const userRow = new ActionRowBuilder().addComponents(userSelect);

          const bouquetSelect = new StringSelectMenuBuilder()
            .setCustomId('garden_gift_select_bouquet_perm')
            .setPlaceholder('💐 2. Pilih Buket yang Ingin Dikirim')
            .addOptions(
              new StringSelectMenuOptionBuilder().setLabel('💐 Buket Kasih Sayang (Love)').setValue('LOVE'),
              new StringSelectMenuOptionBuilder().setLabel('💐 Buket Ketenangan (Peace)').setValue('PEACE'),
              new StringSelectMenuOptionBuilder().setLabel('👑 Buket Legendaris (Imperial)').setValue('IMPERIAL')
            );

          const bouquetRow = new ActionRowBuilder().addComponents(bouquetSelect);

          const btnRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('garden_btn_back_perm').setLabel('🏡 Kembali').setStyle(ButtonStyle.Secondary)
          );

          return { embeds: [embed], components: [userRow, bouquetRow, btnRow] };
        };

        const initialData = getGardenDashboardDataPrivate(user.id);
        const privateMsg = await interaction.editReply({ ...initialData });
        const collector = privateMsg.createMessageComponentCollector({ time: 300000 });

        collector.on('collect', async i => {
          if (i.user.id !== user.id) return i.reply({ content: '❌ Tombol ini bukan milik Anda!', flags: 64 });

          try {
            if (i.isStringSelectMenu() && i.customId === 'garden_select_plant_perm') {
              const val = i.values[0];
              const parts = val.split('_');
              const flowerKey = parts[1];
              const slotIdx = parseInt(parts[2]);

              await i.deferReply({ flags: 64 }).catch(() => { });

              try {
                const res = garden.plantSeed(user.id, guildId, slotIdx, flowerKey);
                await i.editReply({
                  embeds: [embeds.successEmbed(
                    '🌱 Penanaman Berhasil!',
                    `Benih **${res.flowerName}** berhasil ditanam di **Slot #${res.slotIndex}**!\n\n` +
                    `💦 Jangan lupa menyiram tanaman Anda agar tumbuh lebih cepat.`
                  )]
                }).catch(() => { });

                await interaction.editReply(getGardenDashboardDataPrivate(user.id)).catch(() => { });
              } catch (err) {
                await i.editReply({ content: `❌ Gagal menanam: ${err.message}` }).catch(() => { });
              }
            }

            else if (i.isUserSelectMenu() && i.customId === 'garden_gift_select_user_perm') {
              selectedRecipientId = i.values[0];
              await i.update(getGardenGiftDataPrivate(user.id, selectedRecipientId)).catch(() => { });
            }

            else if (i.isStringSelectMenu() && i.customId === 'garden_gift_select_bouquet_perm') {
              const bouquetKey = i.values[0];
              await i.deferReply({ flags: 64 }).catch(() => { });
              try {
                if (!selectedRecipientId) {
                  throw new Error('Silakan tentukan warga penerima kado terlebih dahulu!');
                }
                const res = garden.giftBouquet(user.id, selectedRecipientId, guildId, bouquetKey);
                const successEmb = embeds.successEmbed(
                  '🎁 Kirim Kado Buket Sukses!',
                  `Anda berhasil mengirimkan **${res.bouquetName}** kepada <@${selectedRecipientId}>!\n\n` +
                  `✉️ *Pesan Kado: "${res.messageText}"*\n\n` +
                  `✨ Penerima mendapatkan **Daily Passive Buff** (+Rp ${res.buffAmount} koin) untuk klaim harian (.daily) mereka selama ${res.durationHours} jam!`
                );
                
                selectedRecipientId = null; // reset
                await i.editReply({ embeds: [successEmb] }).catch(() => { });
                await interaction.editReply(getGardenDashboardDataPrivate(user.id)).catch(() => { });
              } catch (err) {
                await i.editReply({ content: `❌ Gagal mengirim kado: ${err.message}` }).catch(() => { });
              }
            }

            else if (i.customId === 'garden_btn_water_all_perm') {
              await i.deferReply({ flags: 64 }).catch(() => { });
              try {
                const res = garden.waterPlant(user.id, guildId, 'all');
                const successEmb = embeds.successEmbed(
                  '💦 Penyiraman Berhasil!',
                  `Berhasil menyiram **${res.wateredCount}** tanaman (Slot: **${res.slotsWatered.join(', ')}**).\n` +
                  `Tanaman tumbuh 30 menit lebih cepat! Cooldown ember air disetel kembali.`
                );

                await i.editReply({ embeds: [successEmb] }).catch(() => { });
                await interaction.editReply(getGardenDashboardDataPrivate(user.id)).catch(() => { });
              } catch (err) {
                await i.editReply({ content: `❌ Gagal menyiram: ${err.message}` }).catch(() => { });
              }
            }

            else if (i.customId === 'garden_btn_harvest_all_perm') {
              await i.deferReply({ flags: 64 }).catch(() => { });
              try {
                const slots = garden.getGardenSlots(user.id, guildId);
                const harvestable = slots.filter(s => s.seed_id && s.growthProgress >= 100);

                if (harvestable.length === 0) {
                  await i.editReply({ content: '❌ Tidak ada tanaman yang siap dipanen di kebun Anda!' }).catch(() => { });
                  return;
                }

                const harvestedNames = [];
                harvestable.forEach(s => {
                  const res = garden.harvestPlant(user.id, guildId, s.slot_index);
                  harvestedNames.push(`Slot #${res.slotIndex}: **${res.flowerName}**`);
                });

                const successEmb = embeds.successEmbed(
                  '🧺 Panen Bunga Sukses!',
                  `Berhasil memanen **${harvestedNames.length}** kuntum bunga segar:\n` +
                  harvestedNames.map(name => `• ${name}`).join('\n') + `\n\n` +
                  `Bunga kini tersimpan aman di inventory Anda! Rangkai buket bunga indah di menu \`.buket\`.`
                );

                await i.editReply({ embeds: [successEmb] }).catch(() => { });
                await interaction.editReply(getGardenDashboardDataPrivate(user.id)).catch(() => { });
              } catch (err) {
                await i.editReply({ content: `❌ Gagal memanen: ${err.message}` }).catch(() => { });
              }
            }

            else if (i.isStringSelectMenu() && i.customId === 'garden_select_manage_actions') {
              const action = i.values[0];
              if (action === 'go_shop') {
                await i.update(getGardenShopDataPrivate(user.id)).catch(() => { });
              } else if (action === 'go_craft') {
                await i.update(getGardenCraftDataPrivate(user.id)).catch(() => { });
              } else if (action === 'go_sell_menu') {
                await i.update(getGardenSellDataPrivate(user.id)).catch(() => { });
              } else if (action === 'go_gift_menu') {
                selectedRecipientId = null;
                await i.update(getGardenGiftDataPrivate(user.id)).catch(() => { });
              }
            }

            else if (i.isStringSelectMenu() && i.customId === 'garden_select_buy_seeds') {
              const itemKey = i.values[0].replace('buy_', '');
              const itemNames = {
                rose: 'Benih Mawar',
                tulip: 'Benih Bunga Tulip',
                lavender: 'Benih Bunga Lavender',
                sakura: 'Benih Bunga Sakura',
                orchid: 'Benih Anggrek Langka',
                wrapping: 'Kertas Kado'
              };
              const itemName = itemNames[itemKey] || itemKey;

              const modal = new ModalBuilder()
                .setCustomId(`garden_modal_buy_${itemKey}`)
                .setTitle(`Beli ${itemName}`);

              const qtyInput = new TextInputBuilder()
                .setCustomId('buy_qty')
                .setLabel('Jumlah yang ingin dibeli')
                .setPlaceholder('Contoh: 5')
                .setValue('1')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(4);

              modal.addComponents(new ActionRowBuilder().addComponents(qtyInput));
              await i.showModal(modal);

              const submitted = await i.awaitModalSubmit({
                filter: (sub) => sub.customId === `garden_modal_buy_${itemKey}` && sub.user.id === user.id,
                time: 60000
              }).catch(() => null);

              if (submitted) {
                try {
                  const qtyStr = submitted.fields.getTextInputValue('buy_qty');
                  const qty = Math.max(1, parseInt(qtyStr) || 1);

                  const res = garden.buySeed(user.id, guildId, itemKey, qty);
                  const statusMsg = `✅ Berhasil membeli **${qty}x ${res.itemName}** seharga **Rp ${res.cost.toLocaleString('id-ID')}**!`;
                  
                  await submitted.update(getGardenShopDataPrivate(user.id, statusMsg)).catch(() => {});
                } catch (err) {
                  await submitted.reply({ embeds: [embeds.errorEmbed('Belanja Gagal!', err.message)], flags: 64 });
                }
              }
            }

            else if (i.customId.startsWith('garden_sell_') && i.customId.endsWith('_all_perm')) {
              const flowerKey = i.customId.replace('garden_sell_', '').replace('_all_perm', '');
              await i.deferReply({ flags: 64 }).catch(() => { });
              try {
                const res = garden.sellFlowers(user.id, guildId, flowerKey, 'all');
                const successEmb = embeds.successEmbed(
                  '💰 Penjualan Bunga Sukses!',
                  `Anda berhasil menjual seluruh (**${res.quantitySold} kuntum**) bunga **${res.flowerName}** Anda!\n\n` +
                  `🪙 Uang didapat: **+Rp ${res.earnings.toLocaleString('id-ID')}**\n` +
                  `💸 Sisa dompet Anda: **Rp ${res.walletBalance.toLocaleString('id-ID')}**`
                );
                await i.editReply({ embeds: [successEmb] }).catch(() => { });
                await interaction.editReply(getGardenSellDataPrivate(user.id)).catch(() => { });
              } catch (err) {
                await i.editReply({ content: `❌ Gagal menjual bunga: ${err.message}` }).catch(() => { });
              }
            }

            else if (i.customId === 'garden_btn_back_perm') {
              await i.update(getGardenDashboardDataPrivate(user.id)).catch(() => { });
            }

            else if (i.customId.startsWith('garden_craft_') && i.customId.endsWith('_perm')) {
              const recipe = i.customId.replace('garden_craft_', '').replace('_perm', '');
              await i.deferReply({ flags: 64 }).catch(() => { });
              try {
                const res = garden.craftBouquet(user.id, guildId, recipe);
                const successEmb = embeds.successEmbed(
                  '💐 Buket Berhasil Dirangkai!',
                  `Selamat! Anda berhasil merangkai **${res.bouquetName}**.\n\n` +
                  `*${res.desc}*\n\n` +
                  `Buket bunga kini berada di inventory Anda. Gunakan perintah \`.gift-buket\` untuk mengirimkannya ke warga lain.`
                );

                await i.editReply({ embeds: [successEmb] }).catch(() => { });
                await interaction.editReply(getGardenCraftDataPrivate(user.id)).catch(() => { });
              } catch (err) {
                await i.editReply({ content: `❌ Gagal merangkai: ${err.message}` }).catch(() => { });
              }
            }
          } catch (err) {
            console.error("Error in garden private interaction collector:", err);
          }
        });

        collector.on('end', async () => {
          await interaction.deleteReply().catch(() => { });
        });
      }

      // ── PORTAL PERMANEN: GACHA PET ──
      else if (customId === 'pet_btn_gacha_hub') {
        await interaction.deferReply({ flags: 64 });
        await handlePetGachaPanel(interaction, client, true);
      }

      // ── PORTAL PERMANEN: UPGRADE BINTANG PET ──
      else if (customId === 'pet_btn_upgrade_hub') {
        await interaction.deferReply({ flags: 64 });
        await handlePetUpgradePanel(interaction, client, true);
      }

      // ── PORTAL PERMANEN: UNDIAN LOTRE ──
      else if (customId === 'eco_btn_lottery_hub') {
        await interaction.deferReply({ flags: 64 });

        const getLotteryPanelPrivate = (targetUserId) => {
          const pool = lottery.getPool(guildId);
          const userTickets = lottery.getUserTickets(targetUserId, guildId);
          const participants = lottery.getParticipants(guildId);
          const participantCount = participants.length;
          const ticketPrice = config.lottery?.TICKET_PRICE || 100;
          const burnPercent = config.lottery?.BURN_PERCENT || 15;

          const winChance = pool.total_tickets > 0 
            ? ((userTickets / pool.total_tickets) * 100).toFixed(2)
            : '0.00';

          const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('🎟️ 🏆 LOTRE MINGGUAN BOT KOSAN 1A')
            .setDescription(
              `🍀 **Selamat datang di Lotre Mingguan Server!**\n` +
              `Beli tiket sekarang dan menangkan total pool koin terkumpul! Setiap tiket yang Anda beli akan menambah total hadiah pool.\n\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `📈 **Status Pool Saat Ini:**\n` +
              `┊ 💰 Total Pool Hadiah: **Rp ${pool.total_pool.toLocaleString('id-ID')}**\n` +
              `┊ 🎫 Total Tiket Terjual: **${pool.total_tickets} tiket**\n` +
              `┊ 👥 Jumlah Peserta: **${participantCount} orang**\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `👤 **Status Anda (<@${targetUserId}>):**\n` +
              `┊ 🎫 Jumlah Tiket: **${userTickets} tiket**\n` +
              `┊ 🎯 Peluang Menang: **${winChance}%**\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `📋 **Informasi Lotre:**\n` +
              `┊ 🪙 Harga Tiket: **Rp ${ticketPrice.toLocaleString('id-ID')}** per tiket\n` +
              `┊ 🔥 Koin Dibakar: **${burnPercent}%** dari total pool akan dibakar (dihapus) saat undian untuk stabilitas ekonomi.\n` +
              `┊ ⏱️ Jadwal Undian: Setiap **Minggu pukul 21:00 WIB**`
            )
            .setTimestamp()
            .setFooter({ text: 'Lotre Mingguan • Semoga Beruntung!' });

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('lottery_btn_buy_1').setLabel('🎫 Beli 1 Tiket').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('lottery_btn_buy_10').setLabel('🎫 Beli 10 Tiket').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('lottery_btn_buy_50').setLabel('🎫 Beli 50 Tiket').setStyle(ButtonStyle.Danger)
          );

          return { embeds: [embed], components: [row] };
        };

        const initialData = getLotteryPanelPrivate(user.id);
        const privateMsg = await interaction.editReply({ ...initialData });
        const lotCollector = privateMsg.createMessageComponentCollector({ time: 60000 });

        lotCollector.on('collect', async iLot => {
          if (iLot.user.id !== user.id) return iLot.reply({ content: '❌ Tombol ini bukan milik Anda!', flags: 64 });

          let qty = 1;
          if (iLot.customId === 'lottery_btn_buy_10') qty = 10;
          else if (iLot.customId === 'lottery_btn_buy_50') qty = 50;

          try {
            const res = lottery.buyTickets(user.id, guildId, qty);
            const successEmb = embeds.successEmbed(
              'Tiket Lotre Berhasil Dibeli! 🎟️✨',
              `Anda telah membeli **${res.quantity} tiket** seharga **Rp ${res.totalCost.toLocaleString('id-ID')}**!\n` +
              `📦 Tiket terdaftar atas nama Anda.\n\n` +
              `💵 Sisa dompet Anda: **Rp ${economy.getWallet(user.id, guildId).balance.toLocaleString('id-ID')}**.`
            );
            await iLot.reply({ embeds: [successEmb], flags: 64 });
            await interaction.editReply(getLotteryPanelPrivate(user.id)).catch(() => { });
          } catch (err) {
            await iLot.reply({ embeds: [embeds.errorEmbed('Pembelian Tiket Gagal!', err.message)], flags: 64 });
          }
        });

        lotCollector.on('end', async () => {
          await interaction.deleteReply().catch(() => { });
        });
      }

      // ── PORTAL PERMANEN: MISI HARIAN KOSAN 1A ──
      else if (customId === 'pet_btn_open_quests_private_perm') {
        await interaction.deferReply({ flags: 64 });

        try {
          const getQuestPanelPrivate = (targetUserId) => {
            const quests = pet.getOrCreateDailyQuests(targetUserId, guildId);
            
            const getQuestEmoji = (progress, target) => {
              return progress >= target ? '✅' : '⏳';
            };

            const getQuestText = (qType, progress, target) => {
              let descText = '';
              switch (qType) {
                case 'WORK': descText = `Bekerja bersama pet (\`.pet work\`) sebanyak 3 kali`; break;
                case 'HUNT': descText = `Kirim pet berburu (\`.pet hunt\`) sebanyak 2 kali`; break;
                case 'FEED': descText = `Beri pet makan atau minum sebanyak 2 kali`; break;
                case 'PLAY': descText = `Ajak pet bermain (\`.pet play\`) sebanyak 2 kali`; break;
                case 'WATER': descText = `Siram tanaman di kebun (\`.garden water\`) sebanyak 2 kali`; break;
                case 'EXPEDITION': descText = `Ikut ekspedisi pet (\`.pet expedition\`) sebanyak 1 kali`; break;
                case 'SELL_FLOWER': descText = `Jual bunga hasil panen (💰 Jual Bunga) sebanyak 2 kali`; break;
                case 'GIFT_BOUQUET': descText = `Kirim kado buket bunga (🎁 Kirim Kado) sebanyak 1 kali`; break;
                case 'ROB': descText = `Sukses merampok warga (\`.rob\`) sebanyak 1 kali`; break;
                case 'HEIST': descText = `Ikut serta dalam operasi bank heist (\`.heist\`) sebanyak 1 kali`; break;
                case 'CASINO': descText = `Bermain Casino Coinflip/Slots (\`.cf\` / \`.slot\`) sebanyak 2 kali`; break;
                case 'STOCK_BUY': descText = `Membeli saham di bursa (\`.saham beli\`) sebanyak 2 kali`; break;
                case 'BANK_DEPOSIT': descText = `Menabung koin di Bank (\`.bank nabung\`) sebanyak 1 kali`; break;
                case 'GARDEN_PLANT': descText = `Menanam benih bunga (\`.tanam\`) sebanyak 2 kali`; break;
                case 'GARDEN_HARVEST': descText = `Memanen bunga matang (\`.panen\`) sebanyak 2 kali`; break;
                default: descText = `Misi Harian`;
              }
              return `${descText} (${progress}/${target})`;
            };

            let descText = `Selesaikan seluruh misi harian Kosan 1A hari ini untuk mendapatkan bonus **Rp 300**, **1x Tiket Gacha Pet Gratis** (TICKET_GACHA), dan **1x Kotak Hadiah Pet** (Pet Lootbox) berisi item acak!\n\n`;
            
            descText += `${getQuestEmoji(quests.quest_1_progress, quests.quest_1_target)} **Misi 1:** ${getQuestText(quests.quest_1_type, quests.quest_1_progress, quests.quest_1_target)}\n`;
            descText += `${getQuestEmoji(quests.quest_2_progress, quests.quest_2_target)} **Misi 2:** ${getQuestText(quests.quest_2_type, quests.quest_2_progress, quests.quest_2_target)}\n`;
            descText += `${getQuestEmoji(quests.quest_3_progress, quests.quest_3_target)} **Misi 3:** ${getQuestText(quests.quest_3_type, quests.quest_3_progress, quests.quest_3_target)}\n\n`;

            const allCompleted = 
              quests.quest_1_progress >= quests.quest_1_target &&
              quests.quest_2_progress >= quests.quest_2_target &&
              quests.quest_3_progress >= quests.quest_3_target;

            const row = new ActionRowBuilder();

            if (quests.reward_claimed === 1) {
              descText += `✅ **Status:** Hadiah harian hari ini sudah diambil! Kembali lagi besok untuk misi baru. 🌅`;
              row.addComponents(new ButtonBuilder().setCustomId('pet_quests_btn_claim_perm').setLabel('🎁 Klaim Hadiah').setStyle(ButtonStyle.Success).setDisabled(true));
            } else {
              if (allCompleted) {
                descText += `✨ **Status:** Semua misi selesai! Klik tombol **Klaim Hadiah** di bawah ini untuk mengambil hadiah harian! 🎁`;
                row.addComponents(new ButtonBuilder().setCustomId('pet_quests_btn_claim_perm').setLabel('🎁 Klaim Hadiah').setStyle(ButtonStyle.Success));
              } else {
                descText += `⏳ **Status:** Masih ada misi yang belum diselesaikan. Teruslah bermain!`;
                row.addComponents(new ButtonBuilder().setCustomId('pet_quests_btn_claim_perm').setLabel('🎁 Klaim Hadiah').setStyle(ButtonStyle.Success).setDisabled(true));
              }
            }

            row.addComponents(new ButtonBuilder().setCustomId('pet_quests_btn_refresh_perm').setLabel('🔄 Segarkan').setStyle(ButtonStyle.Secondary));

            const questEmbed = new EmbedBuilder()
              .setColor(0x3498DB)
              .setTitle(`📋 MISI HARIAN KOSAN 1A — ${user.username}`)
              .setDescription(descText)
              .setThumbnail(user.displayAvatarURL({ dynamic: true }))
              .setTimestamp();

            return { embeds: [questEmbed], components: [row] };
          };

          const privateMsg = await interaction.editReply(getQuestPanelPrivate(user.id));
          const collector = privateMsg.createMessageComponentCollector({ time: 120000 });

          collector.on('collect', async i => {
            if (i.user.id !== user.id) return i.reply({ content: '❌ Tombol ini bukan milik Anda!', flags: 64 });

            try {
              if (i.customId === 'pet_quests_btn_refresh_perm') {
                await i.update(getQuestPanelPrivate(user.id));
              } else if (i.customId === 'pet_quests_btn_claim_perm') {
                try {
                  const res = pet.claimDailyQuestReward(user.id, guildId);
                  const successEmb = embeds.successEmbed(
                    'Misi Harian Kosan 1A Selesai! 🎉🎁',
                    `Selamat! Anda berhasil menyelesaikan seluruh misi harian Kosan 1A hari ini!\n\n` +
                    `💰 **Bonus Uang:** **Rp ${res.rewardAmount.toLocaleString('id-ID')}**\n` +
                    `🎫 **Bonus Tiket Gacha:** **1x Tiket Gacha Pet Gratis** (TICKET_GACHA)\n` +
                    `🎒 **Hadiah Kotak Hadiah Pet:** Anda mendapatkan **1x ${res.dropItemName}** yang telah ditambahkan ke inventory Anda!`
                  );
                  await i.reply({ embeds: [successEmb], flags: 64 });
                  await privateMsg.edit(getQuestPanelPrivate(user.id)).catch(() => { });
                } catch (err) {
                  await i.reply({ embeds: [embeds.errorEmbed('Gagal Klaim Hadiah!', err.message)], flags: 64 });
                }
              }
            } catch (err) {
              console.error("Error in quests private interaction collector:", err);
            }
          });

          collector.on('end', async () => {
            await interaction.deleteReply().catch(() => { });
          });
        } catch (err) {
          await interaction.editReply({ embeds: [embeds.errorEmbed('Gagal Memuat Misi Harian!', err.message)] }).catch(() => {});
        }
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
        const dailyClaimChanId = config.DAILY_CLAIM_CHANNEL_ID || config.REPORT_CHANNEL_ID;
        if (dailyClaimChanId) {
          targetChannel = message.guild.channels.cache.get(dailyClaimChanId);
          if (!targetChannel) {
            try {
              targetChannel = await message.guild.channels.fetch(dailyClaimChanId);
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

  // 3. Cek Gacha Role Chat Earn Bonus
  let gachaBonus = 0;
  try {
    const tier = economy.getMemberGachaTier(message.member, guildId);
    if (tier === 'COMMON') gachaBonus = 1;
    else if (tier === 'RARE') gachaBonus = 2;
    else if (tier === 'EPIC') gachaBonus = 3;
    else if (tier === 'LEGENDARY') gachaBonus = 5;
    else if (tier === 'MYTHIC') gachaBonus = 8;
  } catch (err) {
    console.error('Error checking gacha role bonus for chat earn:', err.message);
  }

  let totalEarned = earnedCoins + investorBonus + gachaBonus;

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
  const ebyus = database.get('SELECT coin_multiplier, expires_at, is_active FROM ebyus_settings WHERE guild_id = ?', [guildId]);
  if (ebyus && ebyus.is_active === 1 && ebyus.coin_multiplier > 1) {
    const nowUnix = Math.floor(Date.now() / 1000);
    if (ebyus.expires_at > 0 && nowUnix > ebyus.expires_at) {
      // Expired! Reset to 1 in DB
      database.run('UPDATE ebyus_settings SET coin_multiplier = 1, expires_at = 0, is_active = 0 WHERE guild_id = ?', [guildId]);
    } else {
      totalEarned *= ebyus.coin_multiplier;
    }
  }

  if (dispenserTriggered) {
    message.react('🥤').catch(() => { });
  }

  const displayName = message.member?.displayName || author.displayName || author.username;
  const username = author.username;

  // 4. Tambahkan saldo koin & catat log message timestamp
  const nowUnix = Math.floor(Date.now() / 1000);
  database.transaction(() => {
    economy.addBalance(author.id, guildId, totalEarned, 'EARN', channelId);

    // Simpan timestamp pesan terakhir untuk cooldown anti-spam beserta update nama
    database.run(
      'UPDATE wallets SET last_message_at = ?, username = ?, display_name = ? WHERE user_id = ? AND guild_id = ?',
      [nowUnix, username, displayName, author.id, guildId]
    );
  })();

  // Catat koin di anti-spam tracker untuk limitasi per jam
  antiSpam.recordPoints(author.id, guildId, totalEarned);

  // 5. Tambahkan skor keaktifan channel di bursa saham
  // Memberikan kontribusi 1.0 poin ke skor aktivitas channel
  stocks.recordChannelActivity(channelId, guildId, 1.0);

  // --- SPATIAL RETENTION: CHAT TREASURE CHEST SPAWNING ---
  if (guildId) {
    const channelName = message.channel?.name?.toLowerCase() || '';
    const isSpecialChannel = 
      channelName.includes('bot') || 
      channelName.includes('spam') || 
      channelName.includes('command') || 
      channelName.includes('test') || 
      channelName.includes('staff') || 
      channelName.includes('log') || 
      channelName.includes('mod') || 
      channelName.includes('admin') ||
      channelName.includes('saham') ||
      channelName.includes('bursa') ||
      channelName.includes('leaderboard') ||
      channelName.includes('expedition') ||
      channelName.includes('heist') ||
      channelName.includes('shop') ||
      ['1510121069783023646', '1422642326798598348', '1472428770710261952', '1422656689710305381', '1509480324373942272', '1510230591860113418', '1510232295448117308', '1510240252458176662', '1509762623917265137'].includes(channelId);

    if (!isSpecialChannel) {
      const clientObj = message.client;
      clientObj.messageCounter = clientObj.messageCounter || new Map();
      clientObj.targetChestMessages = clientObj.targetChestMessages || new Map();
      clientObj.activeChests = clientObj.activeChests || new Map();

      if (!clientObj.messageCounter.has(guildId)) {
        clientObj.messageCounter.set(guildId, 0);
      }
      if (!clientObj.targetChestMessages.has(guildId)) {
        const randomTarget = Math.floor(Math.random() * (200 - 100 + 1)) + 100;
        clientObj.targetChestMessages.set(guildId, randomTarget);
      }

      const currentCount = clientObj.messageCounter.get(guildId) + 1;
      clientObj.messageCounter.set(guildId, currentCount);
      const targetCount = clientObj.targetChestMessages.get(guildId);

      if (currentCount >= targetCount) {
        // Reset counter & target
        clientObj.messageCounter.set(guildId, 0);
        const randomTarget = Math.floor(Math.random() * (200 - 100 + 1)) + 100;
        clientObj.targetChestMessages.set(guildId, randomTarget);

        const rewardAmount = Math.floor(Math.random() * (250 - 50 + 1)) + 50;
        clientObj.activeChests.set(channelId, rewardAmount);

        const chestEmbed = new EmbedBuilder()
          .setColor(0xFFD700)
          .setTitle('📦 PETI HARTA KARUN CHAT SPAWNED! 📦')
          .setDescription(
            `Sebuah peti harta karun misterius terjatuh dari langit obrolan di saluran ini! 🌟\n\n` +
            `👉 **Pemain pertama yang mengetik \`.claim-peti\` akan membukanya dan membawa pulang koin di dalamnya!**\n\n` +
            `*Siapa cepat dia dapat! 🏃‍♂️💨*`
          )
          .setFooter({ text: 'Bot Kosan 1A Active Gamification • Harta Karun Obrolan' })
          .setTimestamp();

        message.channel.send({ embeds: [chestEmbed] }).catch(() => {});
      }
    }
  }

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

  // ── SUB-PERINTAH: MISI / QUEST ──
  if (subCommand === 'misi' || subCommand === 'quest') {
    const action = args[1] ? args[1].toLowerCase() : null;

    if (action === 'claim' || action === 'klaim') {
      try {
        const res = pet.claimDailyQuestReward(author.id, guildId);
        const successEmb = embeds.successEmbed(
          'Misi Harian Kosan 1A Selesai! 🎉🎁',
          `Selamat! Anda berhasil menyelesaikan seluruh misi harian Kosan 1A hari ini!\n\n` +
          `💰 **Bonus Uang:** **Rp ${res.rewardAmount.toLocaleString('id-ID')}**\n` +
          `🎫 **Bonus Tiket Gacha:** **1x Tiket Gacha Pet Gratis** (TICKET_GACHA)\n` +
          `🎒 **Hadiah Kotak Hadiah Pet:** Anda mendapatkan **1x ${res.dropItemName}** yang telah ditambahkan ke inventory Anda!`
        );
        return message.reply({ embeds: [successEmb] });
      } catch (err) {
        return message.reply({ embeds: [embeds.errorEmbed('Gagal Klaim Hadiah!', err.message)] });
      }
    }

    try {
      const quests = pet.getOrCreateDailyQuests(author.id, guildId);
      
      const getQuestEmoji = (progress, target) => {
        return progress >= target ? '✅' : '⏳';
      };

      const getQuestText = (qType, progress, target) => {
        let descText = '';
        switch (qType) {
          case 'WORK': descText = `Bekerja bersama pet (\`.pet work\`) sebanyak 3 kali`; break;
          case 'HUNT': descText = `Kirim pet berburu (\`.pet hunt\`) sebanyak 2 kali`; break;
          case 'FEED': descText = `Beri pet makan atau minum sebanyak 2 kali`; break;
          case 'PLAY': descText = `Ajak pet bermain (\`.pet play\`) sebanyak 2 kali`; break;
          case 'WATER': descText = `Siram tanaman di kebun (\`.garden water\`) sebanyak 2 kali`; break;
          case 'EXPEDITION': descText = `Ikut ekspedisi pet (\`.pet expedition\`) sebanyak 1 kali`; break;
          case 'SELL_FLOWER': descText = `Jual bunga hasil panen (💰 Jual Bunga) sebanyak 2 kali`; break;
          case 'GIFT_BOUQUET': descText = `Kirim kado buket bunga (🎁 Kirim Kado) sebanyak 1 kali`; break;
          case 'ROB': descText = `Sukses merampok warga (\`.rob\`) sebanyak 1 kali`; break;
          case 'HEIST': descText = `Ikut serta dalam operasi bank heist (\`.heist\`) sebanyak 1 kali`; break;
          case 'CASINO': descText = `Bermain Casino Coinflip/Slots (\`.cf\` / \`.slot\`) sebanyak 2 kali`; break;
          case 'STOCK_BUY': descText = `Membeli saham di bursa (\`.saham beli\`) sebanyak 2 kali`; break;
          case 'BANK_DEPOSIT': descText = `Menabung koin di Bank (\`.bank nabung\`) sebanyak 1 kali`; break;
          case 'GARDEN_PLANT': descText = `Menanam benih bunga (\`.tanam\`) sebanyak 2 kali`; break;
          case 'GARDEN_HARVEST': descText = `Memanen bunga matang (\`.panen\`) sebanyak 2 kali`; break;
          default: descText = `Misi Harian`;
        }
        return `${descText} (${progress}/${target})`;
      };

      let descText = `Selesaikan seluruh misi harian Kosan 1A hari ini untuk mendapatkan bonus **Rp 300**, **1x Tiket Gacha Pet Gratis** (TICKET_GACHA), dan **1x Kotak Hadiah Pet** (Pet Lootbox) berisi item acak!\n\n`;
      
      descText += `${getQuestEmoji(quests.quest_1_progress, quests.quest_1_target)} **Misi 1:** ${getQuestText(quests.quest_1_type, quests.quest_1_progress, quests.quest_1_target)}\n`;
      descText += `${getQuestEmoji(quests.quest_2_progress, quests.quest_2_target)} **Misi 2:** ${getQuestText(quests.quest_2_type, quests.quest_2_progress, quests.quest_2_target)}\n`;
      descText += `${getQuestEmoji(quests.quest_3_progress, quests.quest_3_target)} **Misi 3:** ${getQuestText(quests.quest_3_type, quests.quest_3_progress, quests.quest_3_target)}\n\n`;

      if (quests.reward_claimed === 1) {
        descText += `✅ **Status:** Hadiah harian hari ini sudah diambil! Kembali lagi besok untuk misi baru. 🌅`;
      } else {
        const allCompleted = 
          quests.quest_1_progress >= quests.quest_1_target &&
          quests.quest_2_progress >= quests.quest_2_target &&
          quests.quest_3_progress >= quests.quest_3_target;
        
        if (allCompleted) {
          descText += `✨ **Status:** Semua misi selesai! Ketik **\`.pet misi claim\`** sekarang untuk mengambil hadiah harian! 🎁`;
        } else {
          descText += `⏳ **Status:** Masih ada misi yang belum diselesaikan. Teruslah bermain!`;
        }
      }

      const questEmbed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle(`📋 MISI HARIAN KOSAN 1A — ${author.username}`)
        .setDescription(descText)
        .setThumbnail(author.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      return message.reply({ embeds: [questEmbed] });
    } catch (err) {
      return message.reply({ embeds: [embeds.errorEmbed('Gagal Memuat Misi Harian Kosan 1A!', err.message)] });
    }
  }

  // ── SUB-PERINTAH: ANNOUNCEMENT / INFO ──
  if (subCommand === 'announcement' || subCommand === 'anoncemen' || subCommand === 'info') {
    const petInfoEmbed = embeds.petAnnouncementEmbed(message.guild);
    return message.reply({ embeds: [petInfoEmbed] });
  }

  // ── SUB-PERINTAH: CUP (ADMIN CUP REGISTER) ──
  if (subCommand === 'cup') {
    const action = args[1] ? args[1].toLowerCase() : null;
    if (action === 'register' || action === 'daftar') {
      const petName = args.slice(2).join(' ');
      try {
        const tournament = require('./tournament');
        const userPet = tournament.registerParticipant(author.id, guildId, petName);
        const successEmb = embeds.successEmbed(
          'Pendaftaran Admin Cup Sukses! 🏆🐾',
          `Pet aktif Anda **${userPet.pet_name}** (Lv.${userPet.level}) berhasil didaftarkan ke Turnamen Admin Cup!\n\n` +
          `ℹ️ *Tunggu hingga pendaftaran selesai untuk pengacakan bagan tanding.*`
        );
        return message.reply({ embeds: [successEmb] });
      } catch (err) {
        return message.reply({ embeds: [embeds.errorEmbed('Pendaftaran Gagal!', err.message)] });
      }
    } else {
      return message.reply({ embeds: [embeds.warnEmbed('Format Salah!', 'Gunakan: `.pet cup register [nama_pet]` untuk mendaftarkan pet aktif Anda.')] });
    }
  }

  // ── SUB-PERINTAH: TOWER ──
  if (subCommand === 'tower' || subCommand === 'menara' || subCommand === 'dungeon') {
    const activePet = pet.getPet(author.id, guildId);
    if (!activePet) {
      return message.reply({ embeds: [embeds.petDashboardEmbed(author, null, [])] });
    }
    if (activePet.status === 'EGG') {
      return message.reply({ embeds: [embeds.errorEmbed('Pet Masih Telur!', 'Pet Anda masih berbentuk telur! Tetaskan terlebih dahulu.')] });
    }
    if (activePet.status === 'DEAD') {
      return message.reply({ embeds: [embeds.errorEmbed('Pet Meninggal!', 'Pet Anda telah meninggal! Hidupkan kembali di Dokter Pet terlebih dahulu.')] });
    }

    try {
      const getTowerPanelData = (userId, gId, freshPet) => {
        const towerState = pet.getTowerState(userId, gId);
        const boss = pet.getTowerBoss(towerState.current_floor);
        const embed = embeds.petTowerEmbed(author, freshPet, towerState, boss);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('pet_btn_tower_climb').setLabel('⚔️ Tantang Lantai').setStyle(ButtonStyle.Success).setDisabled(towerState.current_floor > 50),
          new ButtonBuilder().setCustomId('pet_btn_tower_sweep').setLabel('🧹 Sapu Bersih (Sweep)').setStyle(ButtonStyle.Primary).setDisabled(towerState.current_floor <= 1),
          new ButtonBuilder().setCustomId('pet_btn_close_panel').setLabel('❌ Tutup').setStyle(ButtonStyle.Secondary)
        );
        return { embeds: [embed], components: [row] };
      };

      const panelData = getTowerPanelData(author.id, guildId, activePet);
      const replyMsg = await message.reply(panelData);
      const collector = replyMsg.createMessageComponentCollector({ time: 120000 });

      collector.on('collect', async i => {
        if (i.user.id !== author.id) return i.reply({ content: '❌ Tombol ini bukan milik Anda!', flags: 64 });

        try {
          if (i.customId === 'pet_btn_close_panel') {
            collector.stop();
            await replyMsg.delete().catch(() => {});
          } else if (i.customId === 'pet_btn_tower_sweep') {
            await i.deferReply({ flags: 64 });
            try {
              const res = pet.sweepTower(author.id, guildId);
              const successEmb = embeds.successEmbed(
                '🧹 Sapu Bersih Menara Sukses!',
                `Anda menyapu bersih lantai 1 s/d ${res.floorCleared}!\n\n` +
                `💰 **Koin didapat:** **Rp ${res.rewardCoins.toLocaleString('id-ID')}**\n` +
                `🌟 **XP didapat:** **+${res.rewardXp} XP**\n\n` +
                `📊 Status Baru Pet: Kelaparan \`${pet.getPet(author.id, guildId).hunger}%\`, Kehausan \`${pet.getPet(author.id, guildId).thirst}%\`.`
              );
              await i.editReply({ embeds: [successEmb] });
              
              const freshPet = pet.getPet(author.id, guildId);
              await replyMsg.edit(getTowerPanelData(author.id, guildId, freshPet)).catch(() => {});
            } catch (err) {
              await i.editReply({ embeds: [embeds.errorEmbed('Sweep Gagal! 🧹', err.message)] });
            }
          } else if (i.customId === 'pet_btn_tower_climb') {
            const tState = pet.getTowerState(author.id, guildId);
            if (tState.daily_attempts >= 5) {
              await i.deferReply({ flags: 64 });
              const confirmEmb = embeds.warnEmbed(
                'Konfirmasi Tiket Masuk! 🎫',
                `Kuota harian (5/5) Anda sudah habis!\n` +
                `Apakah Anda ingin menggunakan **1x 🥤 Soda Energi Pet** atau membayar **Rp 500 koin** untuk masuk kembali?`
              );
              const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('pet_btn_tower_climb_confirm').setLabel('🟢 Gunakan Soda/Rp 500').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('pet_btn_tower_climb_cancel').setLabel('🔴 Batal').setStyle(ButtonStyle.Secondary)
              );
              
              const confMsg = await i.editReply({ embeds: [confirmEmb], components: [confirmRow] });
              const confCollector = confMsg.createMessageComponentCollector({ time: 30000, max: 1 });
              
              confCollector.on('collect', async iConf => {
                if (iConf.user.id !== author.id) return iConf.reply({ content: '❌ Tombol ini bukan milik Anda!', flags: 64 });
                await iConf.deferUpdate();
                
                if (iConf.customId === 'pet_btn_tower_climb_confirm') {
                  try {
                    const fightRes = pet.climbTower(author.id, guildId, true);
                    const fightEmbed = embeds.petBattleLogEmbed(
                      fightRes.isWin 
                        ? `🎉 KEMENANGAN LANTAI ${fightRes.floor}! 🎉` 
                        : `💀 KEKALAHAN LANTAI ${fightRes.floor}! 💀`,
                      fightRes.logs,
                      fightRes.isWin
                    );
                    
                    if (fightRes.isWin) {
                      let rewardText = `💰 **Koin:** **Rp ${fightRes.rewardCoins.toLocaleString('id-ID')}** | 🌟 **XP:** **+${fightRes.rewardXp} XP**`;
                      if (fightRes.gotCheckpointReward) {
                        rewardText += `\n🎁 **Bonus Lantai Boss:** Mendapatkan **1x ${fightRes.checkpointRewardName}**!`;
                      }
                      fightEmbed.addFields({ name: '🎁 Hadiah Kemenangan', value: rewardText });
                    } else {
                      fightEmbed.addFields({ name: '🩹 Status Pet', value: 'Pet Anda pingsan dan statusnya menjadi **LEMAS/WEAK** dengan 1 HP. Segera obati dia!' });
                    }
                    
                    await i.editReply({ embeds: [fightEmbed], components: [] });
                    
                    const freshPet = pet.getPet(author.id, guildId);
                    await replyMsg.edit(getTowerPanelData(author.id, guildId, freshPet)).catch(() => {});
                  } catch (err) {
                    await i.editReply({ embeds: [embeds.errorEmbed('Pertempuran Gagal! ⚔️', err.message)], components: [] });
                  }
                } else {
                  await i.editReply({ embeds: [embeds.warnEmbed('Tantangan Dibatalkan! 🎫', 'Anda telah membatalkan tantangan Menara Ujian.')], components: [] });
                }
              });
            } else {
              await i.deferReply({ flags: 64 });
              try {
                const fightRes = pet.climbTower(author.id, guildId, false);
                const fightEmbed = embeds.petBattleLogEmbed(
                  fightRes.isWin 
                    ? `🎉 KEMENANGAN LANTAI ${fightRes.floor}! 🎉` 
                    : `💀 KEKALAHAN LANTAI ${fightRes.floor}! 💀`,
                  fightRes.logs,
                  fightRes.isWin
                );
                
                if (fightRes.isWin) {
                  let rewardText = `💰 **Koin:** **Rp ${fightRes.rewardCoins.toLocaleString('id-ID')}** | 🌟 **XP:** **+${fightRes.rewardXp} XP**`;
                  if (fightRes.gotCheckpointReward) {
                    rewardText += `\n🎁 **Bonus Lantai Boss:** Mendapatkan **1x ${fightRes.checkpointRewardName}**!`;
                  }
                  fightEmbed.addFields({ name: '🎁 Hadiah Kemenangan', value: rewardText });
                } else {
                  fightEmbed.addFields({ name: '🩹 Status Pet', value: 'Pet Anda pingsan dan statusnya menjadi **LEMAS/WEAK** dengan 1 HP. Segera obati dia!' });
                }
                
                await i.editReply({ embeds: [fightEmbed] });
                
                const freshPet = pet.getPet(author.id, guildId);
                await replyMsg.edit(getTowerPanelData(author.id, guildId, freshPet)).catch(() => {});
              } catch (err) {
                await i.editReply({ embeds: [embeds.errorEmbed('Pertempuran Gagal! ⚔️', err.message)] });
              }
            }
          }
        } catch (err) {
          console.error("Error in tower interaction:", err);
        }
      });

      collector.on('end', async () => {
        const freshData = getTowerPanelData(author.id, guildId, activePet);
        freshData.components = [];
        await replyMsg.edit(freshData).catch(() => {});
      });

    } catch (err) {
      return message.reply({ embeds: [embeds.errorEmbed('Gagal Memuat Menara Ujian!', err.message)] });
    }
    return;
  }

  // ── SUB-PERINTAH: RAID / BOSS ──
  if (subCommand === 'raid' || subCommand === 'worldboss' || subCommand === 'boss') {
    const activePet = pet.getPet(author.id, guildId);
    if (!activePet) {
      return message.reply({ embeds: [embeds.petDashboardEmbed(author, null, [])] });
    }
    if (activePet.status === 'EGG') {
      return message.reply({ embeds: [embeds.errorEmbed('Pet Masih Telur!', 'Pet Anda masih berbentuk telur! Tetaskan terlebih dahulu.')] });
    }
    if (activePet.status === 'DEAD') {
      return message.reply({ embeds: [embeds.errorEmbed('Pet Meninggal!', 'Pet Anda telah meninggal! Hidupkan kembali di Dokter Pet terlebih dahulu.')] });
    }

    try {
      const getRaidPanelData = (userId, gId, freshPet) => {
        const boss = pet.getOrCreateWorldBoss(gId);
        const weekStart = pet.getWeekStartString();
        const participant = database.get('SELECT * FROM world_boss_participants WHERE user_id = ? AND guild_id = ? AND pet_name = ? AND week_start = ?', [userId, gId, freshPet.pet_name, weekStart]);
        
        const embed = embeds.petRaidEmbed(author, freshPet, boss, participant);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('pet_btn_raid_attack').setLabel('⚔️ Serang Boss').setStyle(ButtonStyle.Danger).setDisabled(boss.status !== 'ACTIVE'),
          new ButtonBuilder().setCustomId('pet_btn_raid_soda').setLabel('🥤 Gunakan Soda (+1 Serang)').setStyle(ButtonStyle.Primary).setDisabled(boss.status !== 'ACTIVE'),
          new ButtonBuilder().setCustomId('pet_btn_close_panel').setLabel('❌ Tutup').setStyle(ButtonStyle.Secondary)
        );
        return { embeds: [embed], components: [row] };
      };

      const panelData = getRaidPanelData(author.id, guildId, activePet);
      const replyMsg = await message.reply(panelData);
      const collector = replyMsg.createMessageComponentCollector({ time: 120000 });

      collector.on('collect', async i => {
        if (i.user.id !== author.id) return i.reply({ content: '❌ Tombol ini bukan milik Anda!', flags: 64 });

        try {
          if (i.customId === 'pet_btn_close_panel') {
            collector.stop();
            await replyMsg.delete().catch(() => {});
          } else if (i.customId === 'pet_btn_raid_soda') {
            await i.deferReply({ flags: 64 });
            try {
              const freshPet = pet.getPet(author.id, guildId);
              const fightRes = pet.attackWorldBoss(author.id, guildId, true);
              
              const fightEmbed = embeds.petBattleLogEmbed(
                fightRes.bossKilled 
                  ? `🎉 WORLD BOSS ${fightRes.bossName} BERHASIL DIKALAHKAN! 🎉`
                  : `⚔️ LAPORAN SERANGAN WORLD BOSS ⚔️`,
                fightRes.logs,
                fightRes.bossKilled
              );

              fightEmbed.addFields({ name: '📊 Dampak Serangan', value: `Pet Anda berhasil meluncurkan **${fightRes.totalDmgDealt.toLocaleString('id-ID')} DMG** ke Boss!` });

              if (fightRes.bossKilled && fightRes.distributeResult) {
                const rewards = fightRes.distributeResult.rewards;
                const winnerLog = rewards.map(r => `• <@${r.userId}>: **${r.damage.toLocaleString('id-ID')} DMG** ➔ Rp ${r.coins.toLocaleString('id-ID')} + ${r.items}`).join('\n');
                fightEmbed.addFields({ name: '🎁 Distribusi Hadiah Server', value: winnerLog.substring(0, 1024) });
              }

              await i.editReply({ embeds: [fightEmbed] });
              
              const pFresh = pet.getPet(author.id, guildId);
              await replyMsg.edit(getRaidPanelData(author.id, guildId, pFresh)).catch(() => {});
            } catch (err) {
              await i.editReply({ embeds: [embeds.errorEmbed('Serangan Gagal! 🥤', err.message)] });
            }
          } else if (i.customId === 'pet_btn_raid_attack') {
            await i.deferReply({ flags: 64 });
            try {
              const freshPet = pet.getPet(author.id, guildId);
              const fightRes = pet.attackWorldBoss(author.id, guildId, false);
              
              const fightEmbed = embeds.petBattleLogEmbed(
                fightRes.bossKilled 
                  ? `🎉 WORLD BOSS ${fightRes.bossName} BERHASIL DIKALAHKAN! 🎉`
                  : `⚔️ LAPORAN SERANGAN WORLD BOSS ⚔️`,
                fightRes.logs,
                fightRes.bossKilled
              );

              fightEmbed.addFields({ name: '📊 Dampak Serangan', value: `Pet Anda berhasil meluncurkan **${fightRes.totalDmgDealt.toLocaleString('id-ID')} DMG** ke Boss!` });

              if (fightRes.bossKilled && fightRes.distributeResult) {
                const rewards = fightRes.distributeResult.rewards;
                const winnerLog = rewards.map(r => `• <@${r.userId}>: **${r.damage.toLocaleString('id-ID')} DMG** ➔ Rp ${r.coins.toLocaleString('id-ID')} + ${r.items}`).join('\n');
                fightEmbed.addFields({ name: '🎁 Distribusi Hadiah Server', value: winnerLog.substring(0, 1024) });
              }

              await i.editReply({ embeds: [fightEmbed] });
              
              const pFresh = pet.getPet(author.id, guildId);
              await replyMsg.edit(getRaidPanelData(author.id, guildId, pFresh)).catch(() => {});
            } catch (err) {
              await i.editReply({ embeds: [embeds.errorEmbed('Serangan Gagal! ⚔️', err.message)] });
            }
          }
        } catch (err) {
          console.error("Error in raid interaction:", err);
        }
      });

      collector.on('end', async () => {
        const freshData = getRaidPanelData(author.id, guildId, activePet);
        freshData.components = [];
        await replyMsg.edit(freshData).catch(() => {});
      });

    } catch (err) {
      return message.reply({ embeds: [embeds.errorEmbed('Gagal Memuat Raid World Boss!', err.message)] });
    }
    return;
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
      'Perintah `.pet top` manual sudah tidak digunakan lagi.\n\n👉 Silakan lihat papan peringkat **PVP Arena & Ekspedisi Pet** realtime terbaru di channel: <#1510232295448117308>!'
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

  // ── SUB-PERINTAH: AUTO CARE ──
  if (subCommand === 'auto-care' || subCommand === 'autocare') {
    try {
      const res = pet.unlockAutoCare(author.id, guildId);
      const successEmb = embeds.successEmbed(
        '🔋 AUTO CARE DIAKTIFKAN! 🔋',
        `Sinyal sensor otomatis pada kalung pet **${res.petName}** telah dinyalakan!\n\n` +
        `**Ketentuan Perawatan Otomatis:**\n` +
        `• 🍖 Kelaparan $\le$ 50% $\rightarrow$ Kenyangan $+30$ (Potong Rp 150)\n` +
        `• 💧 Kehausan $\le$ 50% $\rightarrow$ Hidrasi $+35$ (Potong Rp 100)\n\n` +
        `*Fitur ini menjaga pet Anda secara otomatis dengan memotong saldo koin dompet saat terpicu. Pastikan saldo Anda selalu terisi agar perawatan tidak terhenti!*`
      );
      return message.reply({ embeds: [successEmb] });
    } catch (err) {
      return message.reply({ embeds: [embeds.errorEmbed('Gagal Mengaktifkan Auto Care!', err.message)] });
    }
  }

  // ── SUB-PERINTAH: GYM / LATIH STAT ──
  if (subCommand === 'gym' || subCommand === 'latih-stat' || subCommand === 'latih') {
    return handlePetGymPanel(message, client);
  }

  // ── SUB-PERINTAH: SHOP ──
  if (subCommand === 'shop') {
    return handlePetShopCommand(message, client);
  }

  // ── SUB-PERINTAH: GACHA ──
  if (subCommand === 'gacha') {
    return handlePetGachaPanel(message, client);
  }

  // ── SUB-PERINTAH: UPGRADE / EVOLUSI ──
  if (subCommand === 'upgrade' || subCommand === 'evolve' || subCommand === 'evolusi') {
    return handlePetUpgradePanel(message, client);
  }

  // ── SUB-PERINTAH: RECYCLE ──
  if (subCommand === 'recycle' || subCommand === 'daur-ulang' || subCommand === 'daurulang' || subCommand === 'ricekel' || subCommand === 'rycycle' || subCommand === 'rycekel' || subCommand === 'recekel') {
    const targetName = args.slice(1).join(' ');
    if (!targetName) {
      return message.reply({ embeds: [embeds.warnEmbed('Format Salah!', 'Format: `.pet recycle <nama_pet>`\nContoh: `.pet recycle Ciko` atau `.pet ricekel Ciko`')] });
    }
    try {
      const res = pet.recyclePet(author.id, guildId, targetName);
      const successEmb = embeds.successEmbed(
        'Daur Ulang Pet Berhasil! ♻️',
        `Pet **${res.petName}** telah didaur ulang.\n` +
        `💰 **Kompensasi Diterima:** **Rp ${res.reward.toLocaleString('id-ID')}**\n\n` +
        `📉 Sisa dompet Anda: **Rp ${economy.getWallet(author.id, guildId).balance.toLocaleString('id-ID')}**.`
      );
      return message.reply({ embeds: [successEmb] });
    } catch (err) {
      return message.reply({ embeds: [embeds.errorEmbed('Daur Ulang Gagal!', err.message)] });
    }
  }


  // ── SUB-PERINTAH: IMAGE / SETIMAGE ──
  if (subCommand === 'image' || subCommand === 'setimage') {
    const { PermissionsBitField } = require('discord.js');
    const isOwner = message.author.id === '436554535037698059';
    const isAdmin = message.member && message.member.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!isOwner && !isAdmin) {
      return message.reply({ embeds: [embeds.errorEmbed('Akses Ditolak!', 'Perintah ini hanya dapat digunakan oleh Owner utama & Administrator server.')] });
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
      const res = pet.sendToWork(author.id, guildId, message.member);
      const successEmb = embeds.successEmbed('Pet Selesai Bekerja! 💼', `**${res.pet.pet_name}** berhasil mengumpulkan upah kerja sebesar **Rp ${res.reward.toLocaleString('id-ID')}**!\n📈 Bonus Level: \`+Rp ${res.levelBonus}\`\n📊 Status Baru: Kenyangan \`${res.pet.hunger}%\`, Hidrasi \`${res.pet.thirst}%\`, Kebahagiaan \`${res.pet.happiness}%\`.`);
      return message.reply({ embeds: [successEmb] });
    } catch (err) {
      return message.reply({ embeds: [embeds.errorEmbed('Kerja Gagal!', err.message)] });
    }
  }

  // ── SUB-PERINTAH: HUNT ──
  if (subCommand === 'hunt') {
    try {
      const res = pet.sendToHunt(author.id, guildId, message.member);
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

  // ── SUB-PERINTAH: WASH / MANDIIN ──
  if (subCommand === 'mandiin' || subCommand === 'wash' || subCommand === 'mandi') {
    try {
      const res = pet.washPet(author.id, guildId);
      const successEmb = embeds.successEmbed(
        'Mandi Parfum Sultan! 🧼✨',
        `🚿 Anda menggosok tubuh **${res.pet.pet_name}** dengan sabun busa melimpah dan membilasnya sampai wangi semerbak!\n\n` +
        `🌸 **Hasil:** Kutukan bau busuk hilang total! **${res.pet.pet_name}** sekarang wangi bunga melati dan siap beraktivitas kembali.`
      );
      return message.reply({ embeds: [successEmb] });
    } catch (err) {
      return message.reply({ embeds: [embeds.errorEmbed('Gagal Memandikan Pet!', err.message)] });
    }
  }

  // ── SUB-PERINTAH: USE / PAKAI ──
  if (subCommand === 'use' || subCommand === 'pakai' || subCommand === 'use-item') {
    const itemId = args[1] ? args[1].toUpperCase() : null;
    if (!itemId) {
      return message.reply({ embeds: [embeds.warnEmbed('Format Salah!', 'Format: `.pet use <item_id>`\nContoh: `.pet use XP_2X`')] });
    }
    try {
      if (itemId === 'SODA_ENERGY' || itemId === 'SODA') {
        const res = pet.useSodaEnergy(author.id, guildId, false, message.member);
        const descText = `Berhasil meminumkan **Soda Energi Pet** pada pet **${res.pet.pet_name}**!\n⚡ Cooldown Kerja & Berburu di-reset!\n` +
          (res.gotSick ? `🤢 **ADUH!** Pet Anda overdosis dan **Sakit/Pingsan!** HP anjlok ke 5.` : `📊 Kenyangan: \`${res.pet.hunger}%\` | Hidrasi: \`${res.pet.thirst}%\` | Kebahagiaan: \`${res.pet.happiness}%\`.`);
        return message.reply({ embeds: [embeds.successEmbed('Penggunaan Soda Energi Sukses! 🥤', descText)] });
      }

      const res = pet.useItem(author.id, guildId, itemId, false);
      const successEmb = embeds.successEmbed(
        'Penggunaan Item Sukses! ✨',
        `Berhasil menggunakan **${res.item.name}** pada pet **${res.pet.pet_name}**!\n` +
        (res.item.multiplier ? `📈 Pengali XP Pet Anda sekarang menjadi **${res.item.multiplier}x** secara permanen!\n🌟 XP Didapat: **+${res.xpGained} XP**${res.levelUp ? ` (Naik ke Level **${res.pet.level}**! 🎉)` : ''}` : `📊 Status baru: Kenyangan \`${res.pet.hunger}%\`, Hidrasi \`${res.pet.thirst}%\`, HP \`${res.pet.health}%\`, Kebahagiaan \`${res.pet.happiness}%\`.`)
      );
      return message.reply({ embeds: [successEmb] });
    } catch (err) {
      return message.reply({ embeds: [embeds.errorEmbed('Gagal Menggunakan Item!', err.message)] });
    }
  }

  // ── SUB-PERINTAH: DOKTER / REVIVE ──
  if (subCommand === 'dokter' || subCommand === 'revive' || subCommand === 'sembuh') {
    try {
      const res = pet.revivePet(author.id, guildId);
      const successEmb = embeds.successEmbed(
        'Pet Berhasil Dihidupkan! 🏥✨',
        `Dokter Pet berhasil menyelamatkan **${res.pet.pet_name}** dari kematian!\n` +
        `💰 Biaya Dokter: **Rp ${res.cost.toLocaleString('id-ID')}**\n` +
        `❤️ HP: **${res.pet.health}%** | 🍖 Kenyangan: **${res.pet.hunger}%** | 💧 Hidrasi: **${res.pet.thirst}%**\n\n` +
        `📉 Sisa dompetmu: **Rp ${economy.getWallet(author.id, guildId).balance.toLocaleString('id-ID')}**.`
      );
      return message.reply({ embeds: [successEmb] });
    } catch (err) {
      return message.reply({ embeds: [embeds.errorEmbed('Gagal Menghidupkan Pet!', err.message)] });
    }
  }

  // ── SUB-PERINTAH: LATIH / TRAIN ──
  if (subCommand === 'latih' || subCommand === 'train') {
    try {
      const res = pet.trainPet(author.id, guildId);
      const successEmb = embeds.successEmbed(
        'Pusat Pelatihan Pet! 🏋️✨',
        `Pet **${res.pet.pet_name}** telah menyelesaikan sesi latihan keras!\n` +
        `💰 Biaya Latihan: **Rp ${res.fee}**\n` +
        `🌟 XP Didapat: **+${res.xpGained} XP**\n` +
        `📊 Status Baru: Kenyangan \`${res.pet.hunger}%\` | Hidrasi \`${res.pet.thirst}%\` | Level: **${res.pet.level}**.`
      );
      return message.reply({ embeds: [successEmb] });
    } catch (err) {
      return message.reply({ embeds: [embeds.errorEmbed('Latihan Gagal!', err.message)] });
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

    // 1. Tampilkan peta yang tersedia jika peta tidak ditentukan
    const mapChoice = parseInt(args[1]);
    const selectedMap = pet.EXPEDITION_MAPS.find(m => m.id === mapChoice);
    if (!selectedMap) {
      const mapList = pet.EXPEDITION_MAPS.map(m => `🎮 **ID Peta: \`${m.id}\`** — **${m.name}**\n• Level Rekomendasi: \`Lv. ${m.recommendedLevel}+\` | Sukses Dasar: \`${m.baseSuccessRate}%\`\n• Hadiah: \`Rp ${m.minPrize.toLocaleString('id-ID')} - Rp ${m.maxPrize.toLocaleString('id-ID')}\`\n• Deskripsi: *${m.description}*`).join('\n\n');
      return message.reply({ embeds: [embeds.errorEmbed('Pilih Peta Ekspedisi! 🗺️', `Silakan tentukan Peta Ekspedisi yang ingin dijelajahi.\nFormat: \`.pet expedition <ID Peta (1-10)>\`\n\n📌 **DAFTAR ZONA PETUALANGAN PET:**\n${mapList}`)] });
    }

    // 2. Maksimal 2 lobi ekspedisi aktif per server secara bersamaan
    const guildLobbies = Array.from(activeLobby.values()).filter(l => l.guildId === guildId);
    if (guildLobbies.length >= 2) {
      return message.reply({ embeds: [embeds.warnEmbed('Lobi Penuh! ⚠️', 'Maksimal **2 lobi ekspedisi pet aktif** telah tercapai secara bersamaan di server ini! Silakan tunggu salah satu selesai.')] });
    }

    // Kunci lobi per inisiator
    const lobbyKey = `${guildId}-${author.id}`;
    if (activeLobby.has(lobbyKey)) {
      return message.reply({ embeds: [embeds.warnEmbed('Lobi Aktif! ⚠️', 'Anda sudah memiliki lobi ekspedisi pet yang sedang berjalan!')] });
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
    if (wallet.balance < 250) {
      return message.reply({ embeds: [embeds.errorEmbed('Saldo Kurang!', `Anda memerlukan minimal Rp 250 untuk biaya ransum ekspedisi!`)] });
    }

    economy.subtractBalance(author.id, guildId, 250, 'PET_EXPEDITION_FEE');

    const endTimeUnix = Math.floor((Date.now() + 30000) / 1000); // 30 detik

    const lobby = {
      guildId,
      initiatorId: author.id,
      participants: [author.id],
      endTimeUnix,
      timeout: null
    };
    activeLobby.set(lobbyKey, lobby);

    // Set expedition lock untuk channel ini
    const expeditionLocks = client.expeditionLocks = client.expeditionLocks || new Map();
    expeditionLocks.set(message.channelId, lobbyKey);
    lobby.channelId = message.channelId;

    // Siapkan gambar map
    const mapAttachment = getMapAttachment(mapChoice);
    const lobbyFiles = [];
    if (mapAttachment) lobbyFiles.push(mapAttachment);
    try {
      const petExplorer = new AttachmentBuilder('./assets/pet_explorer.png', { name: 'pet_explorer.png' });
      lobbyFiles.push(petExplorer);
    } catch (err) {
      console.warn("Gagal memuat pet_explorer.png:", err.message);
    }

    const calcInit = pet.calculateSuccessRate(guildId, lobby.participants, mapChoice);
    const elementalLogsText = calcInit.logs.length > 0 ? calcInit.logs.join('\n') : '*Belum ada keuntungan/kelemahan elemen*';

    const lobbyEmbed = embeds.petExpeditionLobbyEmbed(
      author.id,
      selectedMap,
      `1️⃣ **${initiatorPet.pet_name}** (Lv. ${initiatorPet.level} ${initiatorPet.pet_type}) · <@${author.id}>`,
      calcInit.successRate,
      elementalLogsText,
      endTimeUnix,
      mapChoice
    );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('pet_exp_join').setLabel('🛡️ Ikut Ekspedisi').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('pet_exp_cancel').setLabel('✖️ Batalkan').setStyle(ButtonStyle.Danger)
    );

    const replyMsgOpts = { content: `📣 **Ekspedisi Tim Pet dibuka di ${selectedMap.name}!** Bersiaplah!`, embeds: [lobbyEmbed], components: [row] };
    if (lobbyFiles.length > 0) replyMsgOpts.files = lobbyFiles;
    const replyMsg = await message.reply(replyMsgOpts);

    lobby.timeout = setTimeout(async () => {
      activeLobby.delete(lobbyKey);

      const currentLobby = lobby;
      try {
        const membersMap = {};
        for (const pId of currentLobby.participants) {
          try {
            const member = await message.guild.members.fetch(pId).catch(() => null);
            if (member) membersMap[pId] = member;
          } catch (err) {
            console.error(`Error fetching member ${pId} for expedition:`, err.message);
          }
        }

        // Hapus tombol dari pesan lobi saat ini
        await replyMsg.edit({ components: [] }).catch(() => {});

        // ⭐ LOADING SCREEN: Animasi transisi premium sebelum pertandingan dimulai
        const loadingEmbed = embeds.petExpeditionLoadingEmbed(selectedMap, author.id, currentLobby.participants);
        const loadingFiles = [];
        try {
          const loadingImg = new AttachmentBuilder('./assets/expedition_loading.png', { name: 'expedition_loading.png' });
          loadingFiles.push(loadingImg);
        } catch (err) {}
        const loadingOpts = { embeds: [loadingEmbed], components: [], attachments: [] };
        if (loadingFiles.length > 0) loadingOpts.files = loadingFiles;
        await replyMsg.edit(loadingOpts).catch(() => {});
        await new Promise(r => setTimeout(r, 3000)); // Loading screen 3 detik

        // ⭐ STAGE 1 TRANSITION: Animasi transisi ke Stage 1
        const s1TransEmbed = embeds.petExpeditionStageTransitionEmbed(1, 'Pemilihan Jalur Tim', selectedMap, mapChoice);
        const s1TransAtt = getMapAttachment(mapChoice);
        const s1TransOpts = { embeds: [s1TransEmbed], components: [], attachments: [] };
        if (s1TransAtt) s1TransOpts.files = [s1TransAtt];
        await replyMsg.edit(s1TransOpts).catch(() => {});
        await new Promise(r => setTimeout(r, 2000)); // Transition 2 detik

        // 🧭 STAGE 1: PEMILIHAN JALUR TIM (Voting / Otak Ekspedisi)
        const stage1Embed = new EmbedBuilder()
          .setColor('#FF9100')
          .setTitle('🧭 STAGE 1 ━━ PEMILIHAN JALUR TIM')
          .setDescription(
            `\`\`\`ansi\n` +
            `\u001b[1;33m╔══════════════════════════════════╗\u001b[0m\n` +
            `\u001b[1;33m║\u001b[0m  \u001b[1;37m🧭 CHOOSE YOUR PATH  🧭\u001b[0m       \u001b[1;33m║\u001b[0m\n` +
            `\u001b[1;33m║\u001b[0m    \u001b[0;36mDecide wisely, Commander\u001b[0m    \u001b[1;33m║\u001b[0m\n` +
            `\u001b[1;33m╚══════════════════════════════════╝\u001b[0m\n` +
            `\`\`\`\n\n` +
            `> <@${author.id}> selaku **Komandan Perjalanan**, pilih jalur ekspedisi:\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━`
          )
          .addFields(
            {
              name: '🗺️ Info Wilayah',
              value: `> **Peta:** **${selectedMap.name}**\n> **Komandan:** <@${author.id}>`,
              inline: false
            },
            {
              name: '🛣️ ═══ PILIHAN JALUR ═══',
              value: 
                `> 🛣️ **[Jalur Aman]**\n` +
                `> └─ Perjalanan lancar tanpa risiko ekstra. (**+0%** Sukses)\n\n` +
                `> 🧗 **[Jalur Pintas Terjal]**\n` +
                `> └─ Mendaki tebing terjal. Sukses **+15%**, pet kelelahan (**-15 HP**)\n\n` +
                `> 🌲 **[Rawa Beracun]**\n` +
                `> └─ Rawa berlumpur. Sukses **+25%**, risiko **30%** terkena efek negatif`,
              inline: false
            }
          )
          .setImage(mapAttachment ? `attachment://map${mapChoice}.png` : null)
          .setFooter({ text: '⚔️ Batas keputusan: 15 detik • Kosan 1A RPG' })
          .setTimestamp();

        const stage1Row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('exp_path_safe').setLabel('🛣️ Jalur Aman').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('exp_path_shortcut').setLabel('🧗 Jalur Pintas').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('exp_path_swamp').setLabel('🌲 Rawa Beracun').setStyle(ButtonStyle.Danger)
        );

        const s1EditOpts = { embeds: [stage1Embed], components: [stage1Row], attachments: [] };
        const s1Att = getMapAttachment(mapChoice);
        if (s1Att) s1EditOpts.files = [s1Att];
        await replyMsg.edit(s1EditOpts).catch(() => {});

        const pathCollector = replyMsg.createMessageComponentCollector({
          filter: i => i.user.id === author.id && ['exp_path_safe', 'exp_path_shortcut', 'exp_path_swamp'].includes(i.customId),
          time: 15000,
          max: 1
        });

        let pathChoice = 'SAFE';
        let pathText = '🛣️ Jalur Aman';

        await new Promise((resolve) => {
          pathCollector.on('collect', async i => {
            if (i.customId === 'exp_path_shortcut') {
              pathChoice = 'SHORTCUT';
              pathText = '🧗 Jalur Pintas Terjal';
              // DB update immediately: -15 HP to all participant pets
              currentLobby.participants.forEach(pId => {
                const p = pet.getPet(pId, guildId);
                if (p) {
                  const newHealth = Math.max(5, p.health - 15);
                  database.run('UPDATE user_pets SET health = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [newHealth, pId, guildId, p.pet_name]);
                }
              });
              pathText += '\n└─ Seluruh pet kru kelelahan setelah memanjat tebing terjal (**-15 HP**).';
            } else if (i.customId === 'exp_path_swamp') {
              pathChoice = 'SWAMP';
              pathText = '🌲 Rawa Beracun';
              // DB update immediately: 30% chance of getting smelly or injured
              const cursedPets = [];
              const now = Math.floor(Date.now() / 1000);
              currentLobby.participants.forEach(pId => {
                const p = pet.getPet(pId, guildId);
                if (p && Math.random() < 0.30) {
                  const isSmelly = Math.random() < 0.50;
                  const curseType = isSmelly ? 'smelly' : 'injured';
                  const curseUntil = now + 3600;
                  database.run('UPDATE user_pets SET curse_type = ?, curse_until = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [curseType, curseUntil, pId, guildId, p.pet_name]);
                  cursedPets.push(`**${p.pet_name}** (${isSmelly ? '🤢 Bau Busuk' : '🩹 Terluka'})`);
                }
              });
              pathText += `\n└─ Menyusup melewati rawa berlumpur. ${cursedPets.length > 0 ? `Pet berikut terkena efek negatif: ${cursedPets.join(', ')}.` : 'Beruntung tidak ada pet yang terkena efek buruk rawa.'}`;
            } else {
              pathChoice = 'SAFE';
              pathText = '🛣️ Jalur Aman\n└─ Perjalanan aman lancar tanpa risiko ekstra.';
            }
            await i.deferUpdate().catch(() => {});
            resolve();
          });

          pathCollector.on('end', (collected) => {
            if (collected.size === 0) {
              pathChoice = 'SAFE';
              pathText = '🛣️ Jalur Aman (Batas waktu habis, otomatis mengambil Jalur Aman)';
            }
            resolve();
          });
        });

        const pathSelectedEmbed = new EmbedBuilder()
          .setColor('#FF9100')
          .setTitle('🧭 STAGE 1 SELESAI ━━ JALUR DIPILIH ✅')
          .setDescription(
            `> 📢 **Keputusan Jalur:** Tim mengambil **${pathText}**\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `> 🗺️ **Peta:** **${selectedMap.name}**\n` +
            `> 👤 **Komandan:** <@${author.id}>\n\n` +
            `*⏳ Menghubungkan ke Stage 2...*`
          )
          .setImage(mapAttachment ? `attachment://map${mapChoice}.png` : null)
          .setFooter({ text: '⚔️ Kosan 1A Pet Expedition' })
          .setTimestamp();

        const s1dAtt = getMapAttachment(mapChoice);
        const s1dOpts = { embeds: [pathSelectedEmbed], components: [], attachments: [] };
        if (s1dAtt) s1dOpts.files = [s1dAtt];
        await replyMsg.edit(s1dOpts).catch(() => {});
        await new Promise(r => setTimeout(r, 2000));

        // ⭐ STAGE 2 TRANSITION: Animasi transisi ke Stage 2
        const s2TransEmbed = embeds.petExpeditionStageTransitionEmbed(2, 'Kejadian Acak', selectedMap, mapChoice);
        const s2TransAtt = getMapAttachment(mapChoice);
        const s2TransOpts = { embeds: [s2TransEmbed], components: [], attachments: [] };
        if (s2TransAtt) s2TransOpts.files = [s2TransAtt];
        await replyMsg.edit(s2TransOpts).catch(() => {});
        await new Promise(r => setTimeout(r, 2000)); // Transition 2 detik

        // 📦 STAGE 2: KEJADIAN ACAK (Random Encounter Event)
        const isChest = Math.random() < 0.5;
        let eventChoice = 'LEAVE';
        let eventText = '🏃 Lewati';
        let eventSuccess = false;
        let forceChestExploded = false;
        let waterRefreshed = false;

        if (isChest) {
          const lockpickRow = database.get("SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = 'LOCKPICK'", [author.id, guildId]);
          const hasLockpick = lockpickRow && lockpickRow.quantity > 0;

          const chestEmbed = new EmbedBuilder()
            .setColor('#E040FB')
            .setTitle('📦 STAGE 2 ━━ PETI KUNO TERKUNCI')
            .setDescription(
              `\`\`\`ansi\n` +
              `\u001b[1;35m╔══════════════════════════════════╗\u001b[0m\n` +
              `\u001b[1;35m║\u001b[0m  \u001b[1;33m📦  ANCIENT CHEST FOUND!  📦\u001b[0m  \u001b[1;35m║\u001b[0m\n` +
              `\u001b[1;35m║\u001b[0m    \u001b[0;36mWhat will you do?\u001b[0m          \u001b[1;35m║\u001b[0m\n` +
              `\u001b[1;35m╚══════════════════════════════════╝\u001b[0m\n` +
              `\`\`\`\n\n` +
              `> *Di tengah petualangan, tim menemukan peti kuno berdebu dengan gembok besi besar yang kokoh...*\n\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━`
            )
            .addFields(
              {
                name: '🗝️ ═══ OPSI TINDAKAN ═══',
                value: 
                  `> 🗝️ **[Gunakan Lockpick]**\n` +
                  `> └─ Membuka peti aman. Dijamin 1 item langka acak!\n\n` +
                  `> 💥 **[Dobrak Paksa]**\n` +
                  `> └─ **40%** sukses, **60%** ledakan (**-15 HP** semua pet)\n\n` +
                  `> 🏃 **[Lewati]**\n` +
                  `> └─ Tinggalkan peti dan lanjut aman`,
                inline: false
              },
              {
                name: '🎒 Inventaris Komandan',
                value: `> **Lockpick:** ${hasLockpick ? '🟢 **Tersedia** *(1x)*' : '🔴 **Tidak Ada**'}`,
                inline: false
              }
            )
            .setImage(mapAttachment ? `attachment://map${mapChoice}.png` : null)
            .setFooter({ text: '⚔️ Batas keputusan: 15 detik • Kosan 1A RPG' })
            .setTimestamp();

          const chestRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('exp_event_lockpick').setLabel('Gunakan Lockpick').setStyle(ButtonStyle.Primary).setDisabled(!hasLockpick),
            new ButtonBuilder().setCustomId('exp_event_force').setLabel('Dobrak Paksa').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('exp_event_leave').setLabel('Lewati').setStyle(ButtonStyle.Secondary)
          );

          const s2cAtt = getMapAttachment(mapChoice);
          const s2cOpts = { embeds: [chestEmbed], components: [chestRow], attachments: [] };
          if (s2cAtt) s2cOpts.files = [s2cAtt];
          await replyMsg.edit(s2cOpts).catch(() => {});

          const eventCollector = replyMsg.createMessageComponentCollector({
            filter: i => i.user.id === author.id && ['exp_event_lockpick', 'exp_event_force', 'exp_event_leave'].includes(i.customId),
            time: 15000,
            max: 1
          });

          await new Promise((resolve) => {
            eventCollector.on('collect', async i => {
              if (i.customId === 'exp_event_lockpick') {
                eventChoice = 'LOCKPICK';
                eventText = '🗝️ Menggunakan Lockpick';
                eventSuccess = true;
                // Subtract 1 lockpick immediately
                database.run("UPDATE user_inventory SET quantity = quantity - 1 WHERE user_id = ? AND guild_id = ? AND item_id = 'LOCKPICK'", [author.id, guildId]);
                eventText += '\n└─ Peti terbuka dengan mudah! Satu kawan beruntung mendapat drop item langka.';
              } else if (i.customId === 'exp_event_force') {
                eventChoice = 'FORCE';
                if (Math.random() < 0.40) {
                  eventSuccess = true;
                  eventText = '💥 Mendobrak Paksa (Berhasil!)';
                  eventText += '\n└─ Peti terbuka! Menemukan barang jarahan tambahan.';
                } else {
                  eventSuccess = false;
                  forceChestExploded = true;
                  eventText = '💥 Mendobrak Paksa (Gagal & Meledak!)';
                  // Subtract 15 HP from all pets immediately
                  currentLobby.participants.forEach(pId => {
                    const p = pet.getPet(pId, guildId);
                    if (p) {
                      const newHealth = Math.max(5, p.health - 15);
                      database.run('UPDATE user_pets SET health = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [newHealth, pId, guildId, p.pet_name]);
                    }
                  });
                  eventText += '\n└─ DUAR! Ranjau ledakan meledak! Semua pet kehilangan **-15 HP**.';
                }
              } else {
                eventChoice = 'LEAVE';
                eventText = '🏃 Lewati\n└─ Melewati peti kuno dengan aman.';
              }
              await i.deferUpdate().catch(() => {});
              resolve();
            });

            eventCollector.on('end', (collected) => {
              if (collected.size === 0) {
                eventChoice = 'LEAVE';
                eventText = '🏃 Lewati (Batas waktu habis, otomatis melewati peti)';
              }
              resolve();
            });
          });
        } else {
          // Air Terjun Suci
          const waterfallEmbed = new EmbedBuilder()
            .setColor('#00E5FF')
            .setTitle('💧 STAGE 2 ━━ AIR TERJUN SUCI')
            .setDescription(
              `\`\`\`ansi\n` +
              `\u001b[1;36m╔══════════════════════════════════╗\u001b[0m\n` +
              `\u001b[1;36m║\u001b[0m  \u001b[1;37m💧 SACRED WATERFALL FOUND! 💧\u001b[0m \u001b[1;36m║\u001b[0m\n` +
              `\u001b[1;36m║\u001b[0m   \u001b[0;33mA blessing in disguise...\u001b[0m   \u001b[1;36m║\u001b[0m\n` +
              `\u001b[1;36m╚══════════════════════════════════╝\u001b[0m\n` +
              `\`\`\`\n\n` +
              `> *Tim menemukan mata air suci tersembunyi yang jernih, sejuk, dan memancarkan aura magis...*\n\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━`
            )
            .addFields(
              {
                name: '⛲ ═══ OPSI TINDAKAN ═══',
                value: 
                  `> 💧 **[Minum Bersama]**\n` +
                  `> └─ Seluruh pet memulihkan **+20 HP & +20 Hidrasi**\n\n` +
                  `> 🏃 **[Lewati]**\n` +
                  `> └─ Lanjut perjalanan tanpa istirahat`,
                inline: false
              }
            )
            .setImage(mapAttachment ? `attachment://map${mapChoice}.png` : null)
            .setFooter({ text: '⚔️ Batas keputusan: 15 detik • Kosan 1A RPG' })
            .setTimestamp();

          const waterfallRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('exp_event_drink').setLabel('Minum Bersama').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('exp_event_leave').setLabel('Lewati').setStyle(ButtonStyle.Secondary)
          );

          const s2wAtt = getMapAttachment(mapChoice);
          const s2wOpts = { embeds: [waterfallEmbed], components: [waterfallRow], attachments: [] };
          if (s2wAtt) s2wOpts.files = [s2wAtt];
          await replyMsg.edit(s2wOpts).catch(() => {});

          const eventCollector = replyMsg.createMessageComponentCollector({
            filter: i => i.user.id === author.id && ['exp_event_drink', 'exp_event_leave'].includes(i.customId),
            time: 15000,
            max: 1
          });

          await new Promise((resolve) => {
            eventCollector.on('collect', async i => {
              if (i.customId === 'exp_event_drink') {
                eventChoice = 'DRINK';
                eventText = '💧 Minum Bersama';
                waterRefreshed = true;
                // Add +20 HP & +20 Hydration immediately
                currentLobby.participants.forEach(pId => {
                  const p = pet.getPet(pId, guildId);
                  if (p) {
                    const maxHP = pet.getMaxHP(p);
                    const newHealth = Math.min(maxHP, p.health + 20);
                    const newThirst = Math.min(100, p.thirst + 20);
                    database.run('UPDATE user_pets SET health = ?, thirst = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [newHealth, newThirst, pId, guildId, p.pet_name]);
                  }
                });
                eventText += '\n└─ Segar! Seluruh pet memulihkan **+20 HP & +20 Hidrasi**.';
              } else {
                eventChoice = 'LEAVE';
                eventText = '🏃 Lewati\n└─ Melewati air terjun suci.';
              }
              await i.deferUpdate().catch(() => {});
              resolve();
            });

            eventCollector.on('end', (collected) => {
              if (collected.size === 0) {
                eventChoice = 'LEAVE';
                eventText = '🏃 Lewati (Batas waktu habis, otomatis melewati)';
              }
              resolve();
            });
          });
        }

        const eventSelectedEmbed = new EmbedBuilder()
          .setColor(isChest ? '#E040FB' : '#00E5FF')
          .setTitle('📦 STAGE 2 SELESAI ━━ KEJADIAN SELESAI ✅')
          .setDescription(
            `> 📢 **Keputusan:** Tim memilih **${eventText}**\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `> 👤 **Komandan:** <@${author.id}>\n\n` +
            `*⏳ Gerbang Bos Akhir terbuka...*`
          )
          .setImage(mapAttachment ? `attachment://map${mapChoice}.png` : null)
          .setFooter({ text: '⚔️ Kosan 1A Pet Expedition' })
          .setTimestamp();

        const s2dAtt = getMapAttachment(mapChoice);
        const s2dOpts = { embeds: [eventSelectedEmbed], components: [], attachments: [] };
        if (s2dAtt) s2dOpts.files = [s2dAtt];
        await replyMsg.edit(s2dOpts).catch(() => {});
        await new Promise(r => setTimeout(r, 2000));

        // ⭐ STAGE 3 TRANSITION: Animasi transisi ke Boss Battle
        const s3TransEmbed = embeds.petExpeditionStageTransitionEmbed(3, 'Pertempuran Bos Akhir', selectedMap, mapChoice);
        const s3TransAtt = getMapAttachment(mapChoice);
        const s3TransOpts = { embeds: [s3TransEmbed], components: [], attachments: [] };
        if (s3TransAtt) s3TransOpts.files = [s3TransAtt];
        await replyMsg.edit(s3TransOpts).catch(() => {});
        await new Promise(r => setTimeout(r, 2000)); // Transition 2 detik

        // ⚔️ STAGE 3: PERTEMPURAN BOS AKHIR (QTE Turn-Based & Hasil)
        const bossName = selectedMap.boss || 'Giga Guardian';
        const totalSteps = currentLobby.participants.length;
        let qteFailed = false;
        let failedUserId = null;
        let reasonType = null; // 'Timeout' or 'Interference'

        // Loop sequential QTE untuk setiap peserta secara berurutan
        for (let idx = 0; idx < totalSteps; idx++) {
          if (qteFailed) break;

          const targetUserId = currentLobby.participants[idx];
          const petObj = pet.getPet(targetUserId, guildId);
          const stepNumber = idx + 1;
          const durationSeconds = 6;
          const endTimeUnix = Math.floor((Date.now() + durationSeconds * 1000) / 1000);

          // Buat embeds dan action row tombol QTE
          const qteEmbed = embeds.petExpeditionStepEmbed(guildId, stepNumber, totalSteps, bossName, targetUserId, petObj, endTimeUnix, mapChoice);
          const qteRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('pet_exp_qte_skill')
              .setLabel('⚡ Lepaskan Skill Pet')
              .setStyle(ButtonStyle.Danger)
          );

          const qteAtt = getMapAttachment(mapChoice);
          const qteOpts = { embeds: [qteEmbed], components: [qteRow], attachments: [] };
          if (qteAtt) qteOpts.files = [qteAtt];
          await replyMsg.edit(qteOpts).catch(() => {});

          // Setup collector interaksi tombol
          const qteCollector = replyMsg.createMessageComponentCollector({
            time: durationSeconds * 1000
          });

          let turnCompleted = false;

          await new Promise((resolveTurn) => {
            qteCollector.on('collect', async iQte => {
              if (iQte.customId === 'pet_exp_qte_skill') {
                // Cek apakah pengklik adalah target yang benar
                if (iQte.user.id === targetUserId) {
                  turnCompleted = true;
                  qteCollector.stop('success');
                  await iQte.deferUpdate().catch(() => {});
                  resolveTurn();
                } else if (currentLobby.participants.includes(iQte.user.id)) {
                  // Pengklik adalah kru lain (Interference)
                  qteFailed = true;
                  failedUserId = iQte.user.id;
                  reasonType = 'Interference';
                  qteCollector.stop('interference');
                  await iQte.deferUpdate().catch(() => {});
                  resolveTurn();
                } else {
                  // Pengklik bukan peserta lobi ekspedisi
                  await iQte.reply({ content: '❌ Anda tidak ikut dalam ekspedisi ini!', flags: 64 }).catch(() => {});
                }
              }
            });

            qteCollector.on('end', (collected, reason) => {
              if (!turnCompleted && reason !== 'interference' && reason !== 'success') {
                // Batas waktu habis (Timeout)
                qteFailed = true;
                failedUserId = targetUserId;
                reasonType = 'Timeout';
              }
              resolveTurn();
            });
          });

          // Jeda singkat antar giliran
          if (!qteFailed) {
            await new Promise(r => setTimeout(r, 1500));
          }
        }

        if (qteFailed) {
          // Proses kegagalan QTE di database
          const failResults = pet.executeExpeditionQteFailure(guildId, currentLobby.participants, failedUserId, reasonType, mapChoice, membersMap);
          const failEmbed = embeds.petExpeditionQteFailureEmbed(guildId, selectedMap.name, failedUserId, reasonType, currentLobby.participants, failResults, mapChoice);
          
          const failAtt = getMapAttachment(mapChoice);
          const failFiles = [];
          if (failAtt) failFiles.push(failAtt);
          try {
            const petExplorer = new AttachmentBuilder('./assets/pet_explorer.png', { name: 'pet_explorer.png' });
            failFiles.push(petExplorer);
          } catch (err) {}

          const failOpts = {
            content: `🚨 **EKSPEDISI KACAU! PERTEMPURAN BOS GAGAL!**`,
            embeds: [failEmbed],
            components: [],
            files: failFiles,
            attachments: []
          };
          await replyMsg.edit(failOpts).catch(async () => {
            await message.channel.send({
              content: `🚨 **EKSPEDISI KACAU! PERTEMPURAN BOS GAGAL!**`,
              embeds: [failEmbed],
              files: failFiles
            });
          });
          // Release expedition lock
          const expLocksQte = client.expeditionLocks || new Map();
          expLocksQte.delete(message.channelId);
          return;
        }

        // Jika berhasil melewati semua QTE, jalankan executeExpedition untuk keberhasilan
        const res = pet.executeExpedition(guildId, currentLobby.participants, mapChoice, pathChoice, eventChoice, eventSuccess, forceChestExploded, waterRefreshed, membersMap);

        // Hook quest progress for EXPEDITION
        currentLobby.participants.forEach(pId => {
          try {
            pet.incrementQuestProgress(pId, guildId, 'EXPEDITION', 1);
          } catch (err) {
            console.error('Error incrementing quest progress for EXPEDITION:', err.message);
          }
        });

        let reportDesc = '';
        res.logs.forEach(log => {
          reportDesc += `> ${log}\n`;
        });

        let rewardText = '';
        if (res.success) {
          res.rewards.forEach(r => {
            rewardText += `🦖 **${r.petName}** (<@${r.userId}>)\n` +
              `  ├─ 💰 Koin: **+Rp ${r.koin.toLocaleString('id-ID')}**\n` +
              `  ├─ 🧪 XP: **+${r.xpGained} XP**${r.levelUp ? ` (Naik ke Lv. ${r.newLevel}! 🎉)` : ''}\n` +
              `  ├─ 🎒 Item: ${r.dropItem ? `✨ **${r.dropItem}**` : '*Tidak ada*'}\n` +
              `  └─ 📊 Status: ${r.statusText || '☀️ Sehat & Bahagia'}\n\n`;
          });
        } else {
          res.rewards.forEach(r => {
            rewardText += `🦖 **${r.petName}** (<@${r.userId}>)\n` +
              `  ├─ 💰 Koin: **+Rp 0**\n` +
              `  ├─ 🧪 XP: **+${r.xpGained} XP**${r.levelUp ? ` (Naik ke Lv. ${r.newLevel}! 🎉)` : ''}\n` +
              `  └─ 📊 Status: ${r.statusText || '🩸 Menderita luka & stress'}\n\n`;
          });
        }

        const fields = [
          {
            name: res.success ? '🎉 JARAHAN & PENGALAMAN TIM' : '💔 REKAP PENGALAMAN (MESKI GAGAL)',
            value: rewardText || '*Tidak ada kru*',
            inline: false
          },
          { name: '🔥 Kombinasi Level Tim', value: `\`Lv. ${res.teamPower}\``, inline: true },
          { name: '🎯 Peluang Sukses', value: `\`${res.successRate}%\``, inline: true }
        ];

        if (res.bestPet && res.worstPet) {
          fields.push(
            {
              name: '🏆 BINTANG UTAMA EXPEDITION (MVP) 👑',
              value: `🦖 **${res.bestPet.petName}** (Lv. ${res.bestPet.level}) · <@${res.bestPet.userId}>\n└─ *Gagah berani memimpin barisan tempur paling depan! 🔥💪*`,
              inline: false
            },
            {
              name: '🐌 BEBAN TIM TERBERAT (CUPU) 🛌',
              value: `🦖 **${res.worstPet.petName}** (Lv. ${res.worstPet.level}) · <@${res.worstPet.userId}>\n└─ *Kebanyakan ngemil ransum & sembunyi di balik semak-semak! 😭💤*`,
              inline: false
            }
          );
        }

        const resultEmbed = embeds.petExpeditionResultEmbed(res, reportDesc, rewardText, mapChoice);

        const resAtt = getMapAttachment(mapChoice);
        const resFiles = [];
        if (resAtt) resFiles.push(resAtt);
        try {
          const petExplorer = new AttachmentBuilder('./assets/pet_explorer.png', { name: 'pet_explorer.png' });
          resFiles.push(petExplorer);
        } catch (err) {}

        const resOpts = {
          content: `⚔️ **EKSPEDISI PET SELESAI!**`,
          embeds: [resultEmbed],
          components: [],
          files: resFiles,
          attachments: []
        };
        await replyMsg.edit(resOpts).catch(async () => {
          await message.channel.send({
            content: `⚔️ **EKSPEDISI PET SELESAI!**`,
            embeds: [resultEmbed],
            files: resFiles
          });
        });
        // Release expedition lock setelah selesai
        const expLocksRes = client.expeditionLocks || new Map();
        expLocksRes.delete(message.channelId);
      } catch (err) {
        console.error(err);
        await message.channel.send({ content: `❌ Ekspedisi gagal diselesaikan: ${err.message}` });
        // Release expedition lock on error
        const expLocksErr = client.expeditionLocks || new Map();
        expLocksErr.delete(message.channelId);
      }
    }, 30000);

    const collector = replyMsg.createMessageComponentCollector({ time: 30000 });

    collector.on('collect', async iExp => {
      try {
        if (iExp.customId === 'pet_exp_join') {
          const currentLobby = activeLobby.get(lobbyKey);
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
          if (userWallet.balance < 250) {
            return iExp.reply({ content: '❌ Saldo Anda kurang untuk membayar biaya ransum Rp 250!', flags: 64 });
          }

          economy.subtractBalance(iExp.user.id, guildId, 250, 'PET_EXPEDITION_FEE');
          currentLobby.participants.push(iExp.user.id);

          await iExp.reply({ content: '🛡️ Berhasil bergabung dengan tim ekspedisi pet!', flags: 64 });

          let petListText = '';
          currentLobby.participants.forEach((pId, idx) => {
            const pObj = pet.getPet(pId, guildId);
            const pName = pObj ? pObj.pet_name : 'Unknown Pet';
            const pLvl = pObj ? pObj.level : 1;
            const pType = pObj ? pObj.pet_type : 'Normal';
            petListText += `• ${idx + 1}️⃣ **${pName}** (Lv. ${pLvl} ${pType}) · <@${pId}>\n`;
          });

          const calc = pet.calculateSuccessRate(guildId, currentLobby.participants, mapChoice);
          const elementalLogsTextVal = calc.logs.length > 0 ? calc.logs.join('\n') : '*Belum ada keuntungan/kelemahan elemen*';

          const endTimeUnix = currentLobby.endTimeUnix || Math.floor((Date.now() + 30000) / 1000);
          const updatedEmbed = embeds.petExpeditionLobbyEmbed(
            author.id,
            selectedMap,
            petListText,
            calc.successRate,
            elementalLogsTextVal,
            endTimeUnix,
            mapChoice
          );

          const joinAtt = getMapAttachment(mapChoice);
          const joinFiles = [];
          if (joinAtt) joinFiles.push(joinAtt);
          try {
            const petExplorer = new AttachmentBuilder('./assets/pet_explorer.png', { name: 'pet_explorer.png' });
            joinFiles.push(petExplorer);
          } catch (err) {}

          const joinOpts = { embeds: [updatedEmbed], attachments: [] };
          if (joinFiles.length > 0) joinOpts.files = joinFiles;
          await replyMsg.edit(joinOpts).catch(() => { });
        }

        else if (iExp.customId === 'pet_exp_cancel') {
          if (iExp.user.id !== author.id) {
            return iExp.reply({ content: '❌ Hanya pembuat lobi ekspedisi yang bisa membatalkan!', flags: 64 });
          }

          clearTimeout(lobby.timeout);
          activeLobby.delete(lobbyKey);

          // Release expedition lock on cancel
          const expLocksCancel = client.expeditionLocks || new Map();
          expLocksCancel.delete(message.channelId);

          currentLobby.participants.forEach(pId => {
            economy.addBalance(pId, guildId, 250, 'PET_EXPEDITION_REFUND');
          });

          await iExp.reply({ content: '❌ Ekspedisi dibatalkan dan biaya ransum telah dikembalikan ke seluruh kru pet.' });
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
      // Lobby ended
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
        new ButtonBuilder().setCustomId('pet_btn_reset').setLabel('🧹 Sapu/Reset Kandang').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('pet_btn_revive').setLabel(`🏥 Dokter Pet (Rp ${(500 * userPet.level).toLocaleString('id-ID')})`).setStyle(ButtonStyle.Primary)
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
        new ButtonBuilder().setCustomId('pet_btn_hunt').setLabel('🏹 Berburu').setStyle(ButtonStyle.Secondary).setDisabled(userPet.level < 10 && userPet.status !== 'ADULT')
      ];

      if (canAdoptMore) {
        row2Components.push(new ButtonBuilder().setCustomId('pet_btn_nav_adopt').setLabel('🛎️ Adopsi (+)').setStyle(ButtonStyle.Success));
      }

      const row2 = new ActionRowBuilder().addComponents(row2Components);

      const row3Components = [
        new ButtonBuilder().setCustomId('pet_btn_use_booster').setLabel('🎒 Inventaris Pet').setStyle(ButtonStyle.Primary),
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

      else if (iPet.customId === 'pet_btn_use_booster') {
        try {
          const freshPet = pet.getPet(author.id, guildId);
          if (!freshPet) {
            return iPet.reply({ content: '❌ Anda tidak memiliki pet aktif!', flags: 64 });
          }
          const inv = pet.getInventory(author.id, guildId);
          const usableItems = inv.filter(item => item.quantity > 0);

          if (usableItems.length === 0) {
            return iPet.reply({
              embeds: [embeds.warnEmbed(
                'Tas Pet Kosong! 🎒',
                'Anda tidak memiliki item perawatan di persediaan pet Anda!\n\n' +
                '🛒 *Silakan gunakan tombol **🛍️ Toko Pet** di Portal Hub (.hub) untuk membeli pakan, obat, soda, sabun, atau booster.*'
              )],
              flags: 64
            });
          }

          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('pet_select_item_use')
            .setPlaceholder('🎒 Pilih item yang ingin digunakan...');

          usableItems.forEach(item => {
            let effectDesc = '';
            let cooldownDesc = '';

            if (item.id === 'FOOD_BASIC') {
              effectDesc = '+30 Kenyangan';
              cooldownDesc = ' · Bebas Cooldown';
            } else if (item.id === 'FOOD_PREMIUM') {
              effectDesc = '+70 Kenyangan, +10 HP, +5 Kebahagiaan';
              cooldownDesc = ' · Bebas Cooldown';
            } else if (item.id === 'WATER') {
              effectDesc = '+35 Hidrasi';
              cooldownDesc = ' · Bebas Cooldown';
            } else if (item.id === 'MEDICINE') {
              effectDesc = '+50 HP, Sembuhkan Sakit';
              cooldownDesc = ' · Bebas Cooldown';
            } else if (item.id === 'TOY') {
              effectDesc = '+50 Kebahagiaan';
              cooldownDesc = ' · Bebas Cooldown';
            } else if (item.id === 'SODA_ENERGY') {
              effectDesc = 'Reset Cooldown Kerja/Berburu';
              cooldownDesc = ' · Cooldown: 30m';
            } else if (item.id === 'SOAP_PET') {
              effectDesc = 'Mandi Bersih (Hilangkan Bau)';
              cooldownDesc = ' · Bebas Cooldown';
            } else if (item.multiplier) {
              effectDesc = `Aktifkan pengali XP ${item.multiplier}x permanen`;
              cooldownDesc = ' · Bebas Cooldown';
            }

            selectMenu.addOptions(
              new StringSelectMenuOptionBuilder()
                .setLabel(`${item.name} (x${item.quantity})`)
                .setDescription(`${effectDesc}${cooldownDesc}`)
                .setValue(item.id)
            );
          });

          const row = new ActionRowBuilder().addComponents(selectMenu);
          const invEmbed = new EmbedBuilder()
            .setColor(0x00b0ff)
            .setTitle('🎒 INVENTARIS / TAS PET AKTIF 🎒')
            .setDescription(
              `Silakan pilih item di bawah untuk digunakan pada pet aktif Anda (**${freshPet.pet_name}**):\n\n` +
              `*Menggunakan item dari tas langsung memotong kuantitas tanpa perlu auto-buy.*`
            )
            .setTimestamp();

          const subPrivateMsg = await iPet.reply({ embeds: [invEmbed], components: [row], flags: 64, fetchReply: true });
          const itemCollector = subPrivateMsg.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 60000
          });

          itemCollector.on('collect', async iItemUse => {
            if (iItemUse.user.id !== author.id) return;
            const selectedItemId = iItemUse.values[0];

            try {
              let result;
              let detailDesc = '';

              if (selectedItemId === 'SOAP_PET') {
                result = pet.washPet(author.id, guildId);
                detailDesc = `🚿 Anda memandikan **${result.pet.pet_name}** menggunakan **Sabun Mandi Pet**!\n🌸 **Hasil:** Kutukan bau busuk hilang total. Pet wangi melati dan siap beraktivitas kembali.`;
              } else if (selectedItemId === 'SODA_ENERGY') {
                result = pet.useSodaEnergy(author.id, guildId, false, iItemUse.member);
                detailDesc = `🥤 Berhasil meminumkan **Soda Energi Pet** pada pet **${result.pet.pet_name}**!\n⚡ Cooldown Kerja & Berburu di-reset!\n` +
                  (result.gotSick ? `🤢 **ADUH!** Pet overdosis dan **Sakit/Pingsan!** HP anjlok ke 5.` : `📊 Kenyangan: \`${result.pet.hunger}%\` | Hidrasi: \`${result.pet.thirst}%\` | HP: \`${result.pet.health}%\`.`) +
                  `\n⏱️ *Cooldown: 30 Menit.*`;
              } else {
                result = pet.useItem(author.id, guildId, selectedItemId, false);
                if (result.item.multiplier) {
                  detailDesc = `📈 Pengali XP Pet Anda sekarang menjadi **${result.item.multiplier}x** secara permanen!`;
                } else {
                  const mins = Math.floor(result.item.cooldown / 60);
                  const cooldownText = result.item.cooldown > 0 ? `\n⏱️ *Cooldown: ${mins} Menit.*` : '';
                  detailDesc = `📊 Status Baru: Kenyangan **${result.pet.hunger}%**, Hidrasi **${result.pet.thirst}%**, HP **${result.pet.health}%**, Kebahagiaan **${result.pet.happiness}%** (+10 XP).${cooldownText}`;
                }
              }

              const successEmb = embeds.successEmbed(
                'Penggunaan Item Sukses! ✨',
                `Berhasil menggunakan **${pet.PET_ITEMS[selectedItemId].name}** pada pet **${result.pet.pet_name}**!\n\n${detailDesc}`
              );

              await iItemUse.update({ embeds: [successEmb], components: [] });
              await replyMsg.edit(getDashboardPanel(author.id, guildId)).catch(() => { });
            } catch (err) {
              await iItemUse.update({ embeds: [embeds.errorEmbed('Gagal Menggunakan Item!', err.message)], components: [] });
            }
          });
        } catch (err) {
          await iPet.reply({ embeds: [embeds.errorEmbed('Gagal Membuka Inventaris!', err.message)], flags: 64 });
        }
      }

      else if (iPet.customId === 'pet_btn_reset') {
        collector.stop();
        pet.resetPet(author.id, guildId);
        await iPet.update({ content: '🧹 Kandang dibersihkan!', embeds: [], components: [] });
      }

      else if (iPet.customId === 'pet_btn_revive') {
        collector.stop();
        try {
          const res = pet.revivePet(author.id, guildId);
          const successEmb = embeds.successEmbed(
            'Pet Berhasil Dihidupkan! 🏥✨',
            `Dokter Pet berhasil menyelamatkan **${res.pet.pet_name}** dari kematian!\n` +
            `💰 Biaya Dokter: **Rp ${res.cost.toLocaleString('id-ID')}**\n` +
            `❤️ HP: **${res.pet.health}%** | 🍖 Kenyangan: **${res.pet.hunger}%** | 💧 Hidrasi: **${res.pet.thirst}%**\n\n` +
            `📉 Sisa dompetmu: **Rp ${economy.getWallet(author.id, guildId).balance.toLocaleString('id-ID')}**.`
          );
          await iPet.update({ embeds: [successEmb], components: [] });
        } catch (err) {
          await iPet.reply({ embeds: [embeds.errorEmbed('Gagal Menghidupkan Pet!', err.message)], flags: 64 });
        }
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

      // ── TOMBOL GACHA PET ──
      else if (iPet.customId === 'pet_btn_gacha') {
        collector.stop();
        await replyMsg.delete().catch(() => {});
        return handlePetGachaPanel(message, client, false);
      }

      // ── TOMBOL UPGRADE BINTANG ──
      else if (iPet.customId === 'pet_btn_upgrade') {
        collector.stop();
        await replyMsg.delete().catch(() => {});
        return handlePetUpgradePanel(message, client, false);
      }

      // ── TOMBOL RECYCLE PET ──
      else if (iPet.customId === 'pet_btn_recycle') {
        // Tampilkan select menu untuk pilih pet yang mau di-recycle
        const allPetsFresh = pet.getPetsList(author.id, guildId);
        if (allPetsFresh.length === 0) {
          return iPet.reply({ content: '❌ Anda tidak memiliki pet!', flags: 64 });
        }
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('pet_select_recycle')
          .setPlaceholder('♻️ Pilih pet yang ingin didaur ulang...');
        allPetsFresh.forEach(p => {
          const star = pet.renderStars(p.star_level || 1);
          selectMenu.addOptions(new StringSelectMenuOptionBuilder()
            .setLabel(`${p.pet_name} the ${p.pet_type} (${star}, Lv.${p.level})`)
            .setDescription(`Recycle → +Rp 1.000`)
            .setValue(p.pet_name)
          );
        });
        const recycleEmbed = new EmbedBuilder()
          .setColor(0xFF5252)
          .setTitle('♻️ DAUR ULANG PET ♻️')
          .setDescription('Pilih pet yang ingin didaur ulang. Pet akan dihapus permanen dan Anda menerima **Rp 1.000** sebagai kompensasi.\n\n⚠️ **Aksi ini tidak bisa dibatalkan!**')
          .setTimestamp();
        const subPrivateMsg = await iPet.reply({
          embeds: [recycleEmbed],
          components: [new ActionRowBuilder().addComponents(selectMenu)],
          flags: 64,
          fetchReply: true
        });

        const recycleCollector = subPrivateMsg.createMessageComponentCollector({
          componentType: ComponentType.StringSelect,
          time: 60000
        });

        recycleCollector.on('collect', async iRecycle => {
          if (iRecycle.user.id !== author.id) return;
          const targetPetName = iRecycle.values[0];
          try {
            const res = pet.recyclePet(author.id, guildId, targetPetName);
            await iRecycle.update({
              embeds: [embeds.successEmbed('Recycle Berhasil! ♻️', `Pet **${res.petName}** telah didaur ulang.\n💰 **+Rp ${res.reward.toLocaleString('id-ID')}** ditambahkan ke dompet.`)],
              components: []
            });
            // Refresh dashboard
            await replyMsg.edit(getDashboardPanel(author.id, guildId)).catch(() => {});
          } catch (err) {
            await iRecycle.update({ embeds: [embeds.errorEmbed('Recycle Gagal!', err.message)], components: [] });
          }
        });
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
          const res = pet.sendToWork(author.id, guildId, iPet.member);
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
          const res = pet.sendToHunt(author.id, guildId, iPet.member);
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

      else if (iPet.customId === 'pet_btn_autocare') {
        try {
          const res = pet.unlockAutoCare(author.id, guildId);
          const successEmb = embeds.successEmbed(
            '🔋 AUTO CARE DIAKTIFKAN! 🔋',
            `Sinyal sensor otomatis pada kalung pet **${res.petName}** telah dinyalakan!\n\n` +
            `**Ketentuan Perawatan Otomatis:**\n` +
            `• 🍖 Kelaparan $\\le$ 50% $\\rightarrow$ Kenyangan $+30$\n` +
            `• 💧 Kehausan $\\le$ 50% $\\rightarrow$ Hidrasi $+35$\n\n` +
            `*Fitur ini menjaga pet Anda secara otomatis tanpa memotong saldo koin atau menggunakan item setelah diaktifkan!*`
          );
          await iPet.reply({ embeds: [successEmb], flags: 64 });
          const freshData = getDashboardPanel(author.id, guildId);
          await replyMsg.edit(freshData).catch(console.error);
        } catch (err) {
          await iPet.reply({ embeds: [embeds.errorEmbed('Gagal Mengaktifkan Auto Care!', err.message)], flags: 64 });
        }
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
        return await i.reply({ content: '❌ Tombol ini hanya dapat ditekan oleh pemilik kebun!', flags: 64 }).catch(() => { });
      }

      try {
        if (i.isStringSelectMenu() && i.customId === 'garden_select_plant') {
          const val = i.values[0];
          const parts = val.split('_');
          const flowerKey = parts[1];
          const slotIdx = parseInt(parts[2]);

          await i.deferReply({ flags: 64 }).catch(() => { });

          try {
            const res = garden.plantSeed(author.id, guildId, slotIdx, flowerKey);

            await i.editReply({
              embeds: [embeds.successEmbed(
                '🌱 Penanaman Berhasil!',
                `Benih **${res.flowerName}** berhasil ditanam di **Slot #${res.slotIndex}**!\n\n` +
                `💦 Jangan lupa menyiram tanaman Anda agar tumbuh lebih cepat.`
              )]
            }).catch(() => { });

            const updatedSlots = garden.getGardenSlots(author.id, guildId);
            const updatedWallet = economy.getWallet(author.id, guildId);

            await replyMsg.edit({
              embeds: [embeds.gardenEmbed(author, updatedSlots, updatedWallet.last_water_at)],
              components: [row, row2]
            }).catch(() => { });
          } catch (err) {
            await i.editReply({ content: `❌ Gagal menanam: ${err.message}` }).catch(() => { });
          }
        }

        else if (i.customId === 'garden_btn_water_all') {
          await i.deferReply({ flags: 64 }).catch(() => { });
          try {
            const res = garden.waterPlant(author.id, guildId, 'all');
            const updatedSlots = garden.getGardenSlots(author.id, guildId);
            const updatedWallet = economy.getWallet(author.id, guildId);

            const successEmb = embeds.successEmbed(
              '💦 Penyiraman Berhasil!',
              `Berhasil menyiram **${res.wateredCount}** tanaman (Slot: **${res.slotsWatered.join(', ')}**).\n` +
              `Tanaman tumbuh 30 menit lebih cepat! Cooldown ember air disetel kembali.`
            );

            await i.editReply({ embeds: [successEmb] }).catch(() => { });

            await replyMsg.edit({
              embeds: [embeds.gardenEmbed(author, updatedSlots, updatedWallet.last_water_at)],
              components: [row, row2]
            }).catch(() => { });
          } catch (err) {
            await i.editReply({ content: `❌ Gagal menyiram: ${err.message}` }).catch(() => { });
          }
        }

        else if (i.customId === 'garden_btn_harvest_all') {
          await i.deferReply({ flags: 64 }).catch(() => { });
          try {
            const slots = garden.getGardenSlots(author.id, guildId);
            const harvestable = slots.filter(s => s.seed_id && s.growthProgress >= 100);

            if (harvestable.length === 0) {
              await i.editReply({ content: '❌ Tidak ada tanaman yang siap dipanen di kebun Anda!' }).catch(() => { });
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

            await i.editReply({ embeds: [successEmb] }).catch(() => { });

            await replyMsg.edit({
              embeds: [embeds.gardenEmbed(author, updatedSlots, updatedWallet.last_water_at)],
              components: [row, row2]
            }).catch(() => { });
          } catch (err) {
            await i.editReply({ content: `❌ Gagal memanen: ${err.message}` }).catch(() => { });
          }
        }

        else if (i.customId === 'garden_btn_shop') {
          const walletShop = economy.getWallet(author.id, guildId);
          await i.deferUpdate().catch(() => { });
          await replyMsg.edit({
            embeds: [embeds.gardenShopEmbed(author, walletShop)],
            components: [shopRow1, shopRow2, shopRow3]
          }).catch(() => { });
        }

        else if (i.customId.startsWith('garden_buy_')) {
          const itemKey = i.customId.replace('garden_buy_', '');
          const itemNames = {
            rose: 'Benih Mawar',
            tulip: 'Benih Bunga Tulip',
            lavender: 'Benih Bunga Lavender',
            sakura: 'Benih Bunga Sakura',
            orchid: 'Benih Anggrek Langka',
            wrapping: 'Kertas Kado'
          };
          const itemName = itemNames[itemKey] || itemKey;

          const modal = new ModalBuilder()
            .setCustomId(`garden_modal_buy_cmd_${itemKey}`)
            .setTitle(`Beli ${itemName}`);

          const qtyInput = new TextInputBuilder()
            .setCustomId('buy_qty')
            .setLabel('Jumlah yang ingin dibeli')
            .setPlaceholder('Contoh: 5')
            .setValue('1')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(4);

          modal.addComponents(new ActionRowBuilder().addComponents(qtyInput));
          await i.showModal(modal);

          const submitted = await i.awaitModalSubmit({
            filter: (sub) => sub.customId === `garden_modal_buy_cmd_${itemKey}` && sub.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (submitted) {
            try {
              const qtyStr = submitted.fields.getTextInputValue('buy_qty');
              const qty = Math.max(1, parseInt(qtyStr) || 1);

              const res = garden.buySeed(author.id, guildId, itemKey, qty);
              const statusMsg = `✅ Berhasil membeli **${qty}x ${res.itemName}** seharga **Rp ${res.cost.toLocaleString('id-ID')}**!`;
              
              const walletShop = economy.getWallet(author.id, guildId);
              await submitted.update({
                embeds: [embeds.gardenShopEmbed(author, walletShop, statusMsg)],
                components: [shopRow1, shopRow2, shopRow3]
              }).catch(() => {});
            } catch (err) {
              await submitted.reply({ embeds: [embeds.errorEmbed('Belanja Gagal!', err.message)], flags: 64 });
            }
          }
        }

        else if (i.customId === 'garden_btn_craft') {
          const craftRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('garden_craft_love').setLabel('💖 Resep Love').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('garden_craft_peace').setLabel('🪻 Resep Peace').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('garden_craft_imperial').setLabel('👑 Resep Imperial').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('garden_btn_back').setLabel('🏡 Kembali').setStyle(ButtonStyle.Success)
          );

          await i.deferUpdate().catch(() => { });
          await replyMsg.edit({
            embeds: [embeds.bouquetCraftEmbed(author, guildId)],
            components: [craftRow]
          }).catch(() => { });
        }

        else if (i.customId === 'garden_btn_back') {
          const updatedSlots = garden.getGardenSlots(author.id, guildId);
          const updatedWallet = economy.getWallet(author.id, guildId);

          await i.deferUpdate().catch(() => { });
          await replyMsg.edit({
            embeds: [embeds.gardenEmbed(author, updatedSlots, updatedWallet.last_water_at)],
            components: [row, row2]
          }).catch(() => { });
        }

        else if (i.customId.startsWith('garden_craft_')) {
          const recipe = i.customId.replace('garden_craft_', '');
          await i.deferReply({ flags: 64 }).catch(() => { });
          try {
            const res = garden.craftBouquet(author.id, guildId, recipe);
            const successEmb = embeds.successEmbed(
              '💐 Buket Berhasil Dirangkai!',
              `Selamat! Anda berhasil merangkai **${res.bouquetName}**.\n\n` +
              `*${res.desc}*\n\n` +
              `Buket bunga kini berada di inventory Anda. Gunakan perintah \`.gift-buket\` untuk mengirimkannya ke warga lain.`
            );

            await i.editReply({ embeds: [successEmb] }).catch(() => { });

            await replyMsg.edit({
              embeds: [embeds.bouquetCraftEmbed(author, guildId)]
            }).catch(() => { });
          } catch (err) {
            await i.editReply({ content: `❌ Gagal merangkai: ${err.message}` }).catch(() => { });
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
      }).catch(() => { });
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
      return message.reply({ embeds: [embeds.errorEmbed('Format Salah!', 'Gunakan: `.bm buy <lockpick/mask/meat/soap/brankas> [jumlah]`')] });
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
      `🛡️ **Brankas Anti-Hacker** (\`brankas\`) - **Rp 1.200**\n` +
      `*Melindungi saldo bank Anda dari Heist. Memotong kehilangan saldo sebesar 90% (efek pasif permanen).*\n\n` +
      `*Gunakan tombol di bawah untuk membeli barang secara instan, atau gunakan perintah \`.bm buy <item_id> [jumlah]\`.*`
    )
    .setFooter({ text: 'Pasar Gelap Bot Kosan 1A • Kerahasiaan Terjamin' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('bm_btn_buy_lockpick').setLabel('🗝️ Linggis').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('bm_btn_buy_mask').setLabel('🎭 Topeng').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('bm_btn_buy_meat').setLabel('🥩 Daging').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('bm_btn_buy_soap').setLabel('🧼 Sabun').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('bm_btn_buy_brankas').setLabel('🛡️ Brankas').setStyle(ButtonStyle.Secondary)
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
    if (i.customId === 'bm_btn_buy_brankas') itemId = 'brankas';

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
      new ButtonBuilder().setCustomId('bm_btn_buy_soap').setLabel('🧼 Sabun').setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId('bm_btn_buy_brankas').setLabel('🛡️ Brankas').setStyle(ButtonStyle.Secondary).setDisabled(true)
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
 * Handler untuk perintah Slot Machine (.slot / .slots)
 */
async function handleSlotCommand(message, client, args) {
  const { guildId, author } = message;
  const betInput = args[0];

  if (!betInput) {
    const errorEmb = embeds.errorEmbed('Format Salah! 🎰', 'Gunakan: `.slot <jumlah/all>`\nContoh: `.slot 100`');
    return message.reply({ embeds: [errorEmb] });
  }

  try {
    const casino = require('./casino');
    
    // Cek saldo awal sebelum memulai animasi agar tidak bisa exploit spin gratis
    const wallet = economy.getWallet(author.id, guildId);
    let bet = 0;
    if (typeof betInput === 'string' && betInput.toLowerCase() === 'all') {
      bet = wallet.balance;
    } else {
      bet = parseInt(betInput);
    }
    if (isNaN(bet) || bet <= 0) {
      throw new Error('Jumlah taruhan harus berupa angka di atas 0 atau ketik "all"!');
    }
    const minBet = config.casino.SLOT_MIN_BET || 20;
    const maxBet = config.casino.SLOT_MAX_BET || 1000;
    if (bet < minBet || bet > maxBet) {
      throw new Error(`Taruhan harus berada di antara Rp ${minBet.toLocaleString('id-ID')} dan Rp ${maxBet.toLocaleString('id-ID')}!`);
    }
    if (wallet.balance < bet) {
      throw new Error(`Saldo dompet Anda tidak mencukupi! Saldo Anda saat ini Rp ${wallet.balance.toLocaleString('id-ID')}`);
    }

    // Tampilkan animasi rolling
    const spinMsg = await message.reply('🎰 **[ GACHA SLOT... ]** Mesin dihidupkan, tuas ditarik... 🪙');
    
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    await delay(1000);
    await spinMsg.edit('🎰 `[ SPINNING REELS ] ─── [ 🔄 🔄 🔄 ]` Menyusun simbol...').catch(() => {});
    await delay(1200);
    await spinMsg.edit('🎰 `[ STOPPING REEL 1 ] ── [ ⏳ 🔄 🔄 ]` Mengunci kolom pertama...').catch(() => {});
    await delay(1000);
    
    const res = casino.spinSlot(author.id, guildId, betInput);

    if (res.won) {
      const winEmb = embeds.successEmbed(
        'Kemenangan Slot! 🎰🎉',
        `🎰 **REELS:** \`[  ${res.reels[0]}  |  ${res.reels[1]}  |  ${res.reels[2]}  ]\`\n\n` +
        `🏆 **Hasil:** **${res.matchName}**\n` +
        `📈 **Multiplier:** \`${res.multiplier}x\`\n` +
        `💰 **Payout Diterima:** **Rp ${res.payout.toLocaleString('id-ID')}** (Untung bersih: Rp ${(res.payout - res.bet).toLocaleString('id-ID')})\n` +
        `📉 **Saldo Dompet Baru:** **Rp ${res.newBalance.toLocaleString('id-ID')}**`
      );
      await spinMsg.edit({ content: '🎰 **[ SLOT SELESAI! ]**', embeds: [winEmb] }).catch(async () => {
        await message.reply({ embeds: [winEmb] });
      });
    } else {
      const loseEmb = embeds.errorEmbed(
        'Slot Kalah! ❌',
        `🎰 **REELS:** \`[  ${res.reels[0]}  |  ${res.reels[1]}  |  ${res.reels[2]}  ]\`\n\n` +
        `😭 **Hasil:** **ZONK / AMPAS**\n` +
        `💸 **Taruhan Hilang:** **-Rp ${res.bet.toLocaleString('id-ID')}**\n` +
        `📉 **Sisa Saldo Dompet:** **Rp ${res.newBalance.toLocaleString('id-ID')}**`
      );
      await spinMsg.edit({ content: '🎰 **[ SLOT SELESAI! ]**', embeds: [loseEmb] }).catch(async () => {
        await message.reply({ embeds: [loseEmb] });
      });
    }
  } catch (err) {
    const errEmb = embeds.errorEmbed('Slot Machine Gagal!', err.message);
    return message.reply({ embeds: [errEmb] });
  }
}

// ═══════════════════════════════════════════════════════════════
// HANDLER: PANEL GACHA PET (.pet gacha)
// ═══════════════════════════════════════════════════════════════

async function handlePetGachaPanel(context, client, isInteraction = false) {
  const guildId = context.guildId;
  const author = isInteraction ? context.user : context.author;

  const editGachaMessage = async (payload) => {
    if (isInteraction) {
      return await context.editReply(payload);
    } else {
      return await replyMsg.edit(payload);
    }
  };

  const buildGachaMainEmbed = () => {
    const wallet = economy.getWallet(author.id, guildId);
    const tickets = pet.getGachaTickets(author.id, guildId);
    const allPets = pet.getPetsList(author.id, guildId);
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🎰 GACHA PET — MESIN NASIB PELIHARAAN 🎰')
      .setDescription(
        `Putar mesin gacha untuk mendapatkan pet langka & legendaris!\n\n` +
        `💰 **Saldo Koin:** **Rp ${wallet.balance.toLocaleString('id-ID')}**\n` +
        `🎫 **Tiket Gacha:** **${tickets} tiket**\n` +
        `🏠 **Jumlah Peliharaan:** **${allPets.length} pet**\n\n` +
        `📊 **Rate Kelangkaan:**\n` +
        `> ⚪ **COMMON** — 65% *(Cat, Golem, Slime)*\n` +
        `> 🟢 **RARE** — 25% *(Cat, Golem, Slime, Dragon)*\n` +
        `> 🟣 **EPIC** — 8% *(Phoenix, Turtle)*\n` +
        `> 🟡 **LEGENDARY** — 2% *(Leviathan, Behemoth, Archdragon)*\n\n` +
        `💎 **Harga:** Rp ${pet.GACHA_PRICES.SINGLE.toLocaleString('id-ID')} / pull | Rp ${pet.GACHA_PRICES.MULTI10.toLocaleString('id-ID')} / 10x pull\n` +
        `🎫 **Tiket Gacha:** 1 tiket = 1 pull gratis`
      )
      .setFooter({ text: 'Pet gacha langsung dewasa (ADULT) tanpa telur!' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('gacha_btn_1x').setLabel(`🎰 Gacha 1x (Rp ${pet.GACHA_PRICES.SINGLE.toLocaleString('id-ID')})`).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('gacha_btn_10x').setLabel(`🎰 Gacha 10x (Rp ${pet.GACHA_PRICES.MULTI10.toLocaleString('id-ID')})`).setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('gacha_btn_ticket').setLabel(`🎫 Gunakan Tiket (${tickets})`).setStyle(ButtonStyle.Secondary).setDisabled(tickets < 1)
    );

    return { embeds: [embed], components: [row] };
  };

  const buildResultEmbed = (pull, index = null) => {
    const rarityColors = { COMMON: 0x95A5A6, RARE: 0x2ECC71, EPIC: 0x9B59B6, LEGENDARY: 0xF1C40F };
    const rarityEmojis = { COMMON: '⚪', RARE: '🟢', EPIC: '🟣', LEGENDARY: '🟡' };

    let traitText = pull.trait ? `**${pull.trait}**` : '*Tidak ada*';
    if (pull.trait2) traitText += ` + **${pull.trait2}**`;
    let elementText = pull.element ? `**${pull.element}**` : '*Tidak ada*';

    const prefix = index !== null ? `**#${index + 1}** ` : '';

    return new EmbedBuilder()
      .setColor(rarityColors[pull.rarity] || 0xFFFFFF)
      .setTitle(`${prefix}${rarityEmojis[pull.rarity]} ${pull.species.name} — ${pull.rarity}`)
      .setDescription(
        `*${pull.species.desc}*\n\n` +
        `❤️ **Base HP:** ${pull.baseHP}\n` +
        `⚔️ **Base ATK:** ${pull.baseAtk}\n` +
        `🛡️ **Base DEF:** ${pull.baseDef}%\n` +
        `🌀 **Elemen:** ${elementText}\n` +
        `🧠 **Trait:** ${traitText}` +
        (pull.workBuff > 0 ? `\n🔑 **Buff Kerja/Berburu:** +${Math.round(pull.workBuff * 100)}%` : '')
      );
  };

  const handleSingleResult = async (replyMsg, collector, pull, author, guildId) => {
    const resultEmbed = buildResultEmbed(pull);
    const allPets = pet.getPetsList(author.id, guildId);
    const canSave = true;

    const resultRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('gacha_btn_save').setLabel('💾 Simpan ke Kandang').setStyle(ButtonStyle.Success).setDisabled(!canSave),
      new ButtonBuilder().setCustomId('gacha_btn_recycle_result').setLabel(`♻️ Recycle (+Rp ${pet.RECYCLE_REWARD.toLocaleString('id-ID')})`).setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('gacha_btn_back').setLabel('🔙 Kembali').setStyle(ButtonStyle.Secondary)
    );

    await editGachaMessage({ embeds: [resultEmbed], components: [resultRow] });
    return pull;
  };

  let replyMsg;
  if (isInteraction) {
    replyMsg = await context.editReply(buildGachaMainEmbed());
  } else {
    replyMsg = await context.reply(buildGachaMainEmbed());
  }

  let pendingPull = null; // Menyimpan satu hasil pull yang belum disimpan
  let pendingPulls = null; // Menyimpan 10 hasil pull yang belum disimpan

  const collector = replyMsg.createMessageComponentCollector({ time: 180000 });

  collector.on('collect', async iGacha => {
    if (iGacha.user.id !== author.id) {
      return iGacha.reply({ content: '❌ Tombol ini bukan milik Anda!', flags: 64 });
    }

    try {
      // ── TOMBOL GACHA 1X ──
      if (iGacha.customId === 'gacha_btn_1x') {
        await iGacha.deferUpdate();

        // Animasi loading
        const loadingEmbed = new EmbedBuilder()
          .setColor(0xFFD700)
          .setTitle('🎰 MEMUTAR MESIN GACHA... 🌟')
          .setDescription('✨ Kristal nasib berputar mencari peliharaan baru...\n\n> 🔮 *Menentukan kelangkaan...*\n> 🐾 *Memilih spesies...*\n> 🧬 *Mengacak trait...*')
          .setTimestamp();
        await editGachaMessage({ embeds: [loadingEmbed], components: [] });

        // Roll setelah 2 detik animasi
        await new Promise(r => setTimeout(r, 2000));

        const results = pet.rollGacha(author.id, guildId, 'COIN_1');
        pendingPull = results[0];
        pendingPulls = null;
        await handleSingleResult(replyMsg, collector, pendingPull, author, guildId);
      }

      // ── TOMBOL GACHA 10X ──
      else if (iGacha.customId === 'gacha_btn_10x') {
        await iGacha.deferUpdate();

        const loadingEmbed = new EmbedBuilder()
          .setColor(0xFFD700)
          .setTitle('🎰 GACHA 10X MEGA PULL! 🌟🌟🌟')
          .setDescription('✨ Kristal nasib meledak! 10 peliharaan sedang ditarik sekaligus...\n\n> 🔮 *10 roda berputar bersamaan...*')
          .setTimestamp();
        await editGachaMessage({ embeds: [loadingEmbed], components: [] });

        await new Promise(r => setTimeout(r, 3000));

        const results = pet.rollGacha(author.id, guildId, 'COIN_10');
        pendingPulls = results;
        pendingPull = null;

        // Ringkasan semua 10 pull
        const rarityOrder = { LEGENDARY: 0, EPIC: 1, RARE: 2, COMMON: 3 };
        const sorted = [...results].sort((a, b) => (rarityOrder[a.rarity] ?? 99) - (rarityOrder[b.rarity] ?? 99));
        const best = sorted[0];

        let listText = results.map((r, i) => {
          const emoji = { COMMON: '⚪', RARE: '🟢', EPIC: '🟣', LEGENDARY: '🟡' }[r.rarity];
          return `\`#${i + 1}\` ${emoji} **${r.species.name.replace(/^[^\s]+\s/, '')}** — ${r.rarity}${r.trait ? ` (${r.trait})` : ''}`;
        }).join('\n');

        const summaryEmbed = new EmbedBuilder()
          .setColor(0xFFD700)
          .setTitle('🎰 HASIL GACHA 10X MEGA PULL! 🎰')
          .setDescription(
            `${listText}\n\n` +
            `⭐ **Pet Terbaik:** ${best.species.name} — **${best.rarity}**\n\n` +
            `*Pilih pet yang ingin disimpan ke kandang di bawah (maks 5 pet sekali input). Pet yang tidak dipilih akan otomatis di-recycle (+Rp ${pet.RECYCLE_REWARD.toLocaleString('id-ID')} / pet).*`
          )
          .setTimestamp();

        // Buat select menu untuk pilih pet yang mau disimpan
        const selectOptions = results.map((r, i) => {
          const emoji = { COMMON: '⚪', RARE: '🟢', EPIC: '🟣', LEGENDARY: '🟡' }[r.rarity];
          return new StringSelectMenuOptionBuilder()
            .setLabel(`#${i + 1} ${r.species.name.replace(/^[^\s]+\s/, '')} (${r.rarity})`)
            .setDescription(`HP:${r.baseHP} ATK:${r.baseAtk} DEF:${r.baseDef}% ${r.trait ? 'Trait: ' + r.trait : ''}`)
            .setValue(`gacha10_save_${i}`)
            .setEmoji(emoji);
        });

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('gacha10_select_save')
          .setPlaceholder('💾 Pilih pet untuk disimpan (maks 5)...')
          .setMinValues(0)
          .setMaxValues(Math.min(5, results.length))
          .addOptions(selectOptions);

        const selectRow = new ActionRowBuilder().addComponents(selectMenu);
        const btnRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('gacha10_recycle_all').setLabel(`♻️ Recycle Semua (+Rp ${(10 * pet.RECYCLE_REWARD).toLocaleString('id-ID')})`).setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('gacha_btn_back').setLabel('🔙 Kembali').setStyle(ButtonStyle.Secondary)
        );

        await editGachaMessage({ embeds: [summaryEmbed], components: [selectRow, btnRow] });
      }

      // ── TOMBOL GACHA TIKET ──
      else if (iGacha.customId === 'gacha_btn_ticket') {
        await iGacha.deferUpdate();

        const loadingEmbed = new EmbedBuilder()
          .setColor(0x00BCD4)
          .setTitle('🎫 MENGGUNAKAN TIKET GACHA... 🌟')
          .setDescription('✨ Tiket gacha menyala dan mesin mulai berputar...')
          .setTimestamp();
        await editGachaMessage({ embeds: [loadingEmbed], components: [] });

        await new Promise(r => setTimeout(r, 2000));

        const results = pet.rollGacha(author.id, guildId, 'TICKET');
        pendingPull = results[0];
        pendingPulls = null;
        await handleSingleResult(replyMsg, collector, pendingPull, author, guildId);
      }

      // ── TOMBOL SIMPAN 1 PULL ──
      else if (iGacha.customId === 'gacha_btn_save') {
        if (!pendingPull) {
          return iGacha.reply({ content: '❌ Tidak ada pet gacha yang menunggu untuk disimpan!', flags: 64 });
        }

        // Tampilkan modal untuk input nama
        const modal = new ModalBuilder()
          .setCustomId('gacha_modal_name')
          .setTitle('💾 Beri Nama Pet Gacha');

        const nameInput = new TextInputBuilder()
          .setCustomId('gacha_pet_name')
          .setLabel('Nama Pet Anda')
          .setPlaceholder('Contoh: Phoenix-chan')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(25);

        modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
        await iGacha.showModal(modal);

        const submitted = await iGacha.awaitModalSubmit({
          filter: (sub) => sub.customId === 'gacha_modal_name' && sub.user.id === author.id,
          time: 60000
        }).catch(() => null);

        if (submitted) {
          try {
            if (!pendingPull) {
              return submitted.reply({ content: '❌ Pet gacha sudah disimpan atau didaur ulang!', flags: 64 });
            }
            const petName = submitted.fields.getTextInputValue('gacha_pet_name');
            const saved = pet.saveGachaPet(author.id, guildId, pendingPull, petName);
            pendingPull = null;
            await submitted.reply({
              embeds: [embeds.successEmbed(
                'Pet Gacha Disimpan! 💾🐾',
                `Pet **${saved.pet_name}** the **${saved.pet_type}** berhasil disimpan ke kandang!\n` +
                `🌟 Rarity: **${saved.gacha_rarity}**\n` +
                `🧠 Trait: **${saved.trait || 'Tidak ada'}**${saved.gacha_trait2 ? ` + **${saved.gacha_trait2}**` : ''}\n\n` +
                `Ketik \`.pet\` untuk melihat kandang.`
              )],
              flags: 64
            });
            await editGachaMessage(buildGachaMainEmbed());
          } catch (err) {
            await submitted.reply({ embeds: [embeds.errorEmbed('Gagal Menyimpan!', err.message)], flags: 64 });
          }
        }
      }

      // ── TOMBOL RECYCLE 1 PULL ──
      else if (iGacha.customId === 'gacha_btn_recycle_result') {
        if (!pendingPull) {
          return iGacha.reply({ content: '❌ Tidak ada pet gacha yang bisa di-recycle!', flags: 64 });
        }
        economy.addBalance(author.id, guildId, pet.RECYCLE_REWARD, 'PET_GACHA_RECYCLE');
        const recycledSpecies = pendingPull.species.name;
        pendingPull = null;
        await iGacha.reply({
          embeds: [embeds.successEmbed('Recycle Berhasil! ♻️', `Pet ${recycledSpecies} telah didaur ulang.\n💰 **+Rp ${pet.RECYCLE_REWARD.toLocaleString('id-ID')}** telah ditambahkan ke dompet Anda.`)],
          flags: 64
        });
        await editGachaMessage(buildGachaMainEmbed());
      }

      // ── TOMBOL SELECT 10X SAVE ──
      else if (iGacha.customId === 'gacha10_select_save') {
        if (!pendingPulls || pendingPulls.length === 0) {
          return iGacha.reply({ content: '❌ Tidak ada data pull 10x yang tersimpan!', flags: 64 });
        }

        const selectedIndices = iGacha.values.map(v => parseInt(v.replace('gacha10_save_', '')));

        // Tampilkan modal input nama untuk semua pet yang dipilih
        const modal = new ModalBuilder()
          .setCustomId(`gacha10_modal_names_${selectedIndices.join(',')}`)
          .setTitle(`💾 Beri Nama ${selectedIndices.length} Pet Gacha`);

        selectedIndices.forEach((idx, i) => {
          const p = pendingPulls[idx];
          const specName = p.species.name.replace(/^[^\s]+\s/, '');
          const input = new TextInputBuilder()
            .setCustomId(`gacha10_name_${idx}`)
            .setLabel(`Nama untuk #${idx + 1} ${specName} (${p.rarity})`)
            .setPlaceholder(`Contoh: ${specName}-${idx + 1}`)
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(25);
          modal.addComponents(new ActionRowBuilder().addComponents(input));
        });

        await iGacha.showModal(modal);

        const submitted = await iGacha.awaitModalSubmit({
          filter: (sub) => sub.customId.startsWith('gacha10_modal_names_') && sub.user.id === author.id,
          time: 120000
        }).catch(() => null);

        if (submitted) {
          try {
            if (!pendingPulls || pendingPulls.length === 0) {
              return submitted.reply({ content: '❌ Data gacha 10x sudah diproses atau kedaluwarsa!', flags: 64 });
            }

            const indicesStr = submitted.customId.replace('gacha10_modal_names_', '');
            const selectedIndicesParsed = indicesStr ? indicesStr.split(',').map(Number) : [];

            const savedNames = [];
            for (const idx of selectedIndicesParsed) {
              const petName = submitted.fields.getTextInputValue(`gacha10_name_${idx}`);
              const p = pendingPulls[idx];
              pet.saveGachaPet(author.id, guildId, p, petName);
              savedNames.push(`**${petName}** (${p.rarity})`);
            }

            // Recycle sisanya
            const recycledCount = pendingPulls.length - selectedIndicesParsed.length;
            if (recycledCount > 0) {
              economy.addBalance(author.id, guildId, recycledCount * pet.RECYCLE_REWARD, 'PET_GACHA_RECYCLE_MULTI');
            }

            pendingPulls = null;
            await submitted.reply({
              embeds: [embeds.successEmbed(
                'Pet Gacha 10x Diproses! 🎰✨',
                `💾 **Pet Disimpan:**\n${savedNames.join('\n')}\n\n` +
                (recycledCount > 0 ? `♻️ **Pet Di-recycle:** ${recycledCount} pet → **+Rp ${(recycledCount * pet.RECYCLE_REWARD).toLocaleString('id-ID')}**` : '')
              )],
              flags: 64
            });
            await editGachaMessage(buildGachaMainEmbed());
          } catch (err) {
            await submitted.reply({ embeds: [embeds.errorEmbed('Gagal Memproses!', err.message)], flags: 64 });
          }
        }
      }

      // ── TOMBOL RECYCLE ALL 10X ──
      else if (iGacha.customId === 'gacha10_recycle_all') {
        if (!pendingPulls || pendingPulls.length === 0) {
          return iGacha.reply({ content: '❌ Tidak ada data pull 10x!', flags: 64 });
        }
        const totalRecycle = pendingPulls.length * pet.RECYCLE_REWARD;
        economy.addBalance(author.id, guildId, totalRecycle, 'PET_GACHA_RECYCLE_ALL');
        pendingPulls = null;
        await iGacha.reply({
          embeds: [embeds.successEmbed('Recycle 10x Berhasil! ♻️', `Semua 10 pet telah didaur ulang.\n💰 **+Rp ${totalRecycle.toLocaleString('id-ID')}** telah ditambahkan ke dompet Anda.`)],
          flags: 64
        });
        await editGachaMessage(buildGachaMainEmbed());
      }

      // ── TOMBOL KEMBALI ──
      else if (iGacha.customId === 'gacha_btn_back') {
        pendingPull = null;
        pendingPulls = null;
        await iGacha.update(buildGachaMainEmbed());
      }

    } catch (err) {
      if (!iGacha.replied && !iGacha.deferred) {
        await iGacha.reply({ content: `❌ Error: ${err.message}`, flags: 64 }).catch(() => {});
      } else {
        await iGacha.followUp({ content: `❌ Error: ${err.message}`, flags: 64 }).catch(() => {});
      }
    }
  });

  collector.on('end', async () => {
    await editGachaMessage({ components: [] }).catch(() => {});
  });
}

// ═══════════════════════════════════════════════════════════════
// HANDLER: PANEL GYM / PUSAT KEBUGARAN & STATS PET (.pet gym)
// ═══════════════════════════════════════════════════════════════

async function handlePetGymPanel(context, client, isInteraction = false) {
  const guildId = context.guildId;
  const author = isInteraction ? context.user : context.author;

  const userPet = pet.getPet(author.id, guildId);
  if (!userPet) {
    const errorEmb = embeds.errorEmbed('Gym Gagal!', 'Anda tidak memiliki hewan peliharaan aktif! Ketik `.pet` untuk adopsi.');
    if (isInteraction) return context.reply({ embeds: [errorEmb], flags: 64 });
    return context.reply({ embeds: [errorEmb] });
  }
  if (userPet.status === 'DEAD') {
    const errorEmb = embeds.errorEmbed('Gym Gagal!', 'Pet Anda telah mati! Harap hidupkan kembali lewat Dokter terlebih dahulu.');
    if (isInteraction) return context.reply({ embeds: [errorEmb], flags: 64 });
    return context.reply({ embeds: [errorEmb] });
  }
  if (userPet.status === 'EGG') {
    const errorEmb = embeds.errorEmbed('Gym Gagal!', 'Pet Anda masih berupa telur! Mengerami telur dengan ketik `.pet` / `.pet hatch`!');
    if (isInteraction) return context.reply({ embeds: [errorEmb], flags: 64 });
    return context.reply({ embeds: [errorEmb] });
  }

  const getGymPanelData = (userId, gId) => {
    const pData = pet.getPet(userId, gId);
    if (!pData) return { embeds: [embeds.errorEmbed('Error', 'Pet tidak ditemukan!')] };

    const star = pet.renderStars(pData.star_level || 1);
    const unusedTp = pData.unused_tp || 0;
    const starBonus = pet.getStarBonuses(pData.star_level || 1);
    const maxHP = pet.getMaxHP(pData);
    
    // ATK Damage
    const speciesBaseAtk = pet.GACHA_SPECIES[pData.pet_type]?.baseAtk || 10;
    const totalAtk = speciesBaseAtk + pData.level * 5 + (pData.stat_str || 0) * 2;
    
    // DEF (Damage Reduction)
    const speciesBaseDef = pet.GACHA_SPECIES[pData.pet_type]?.baseDef || 0;
    const defGym = Math.min(50, (pData.stat_def || 0) * 0.5);
    const totalDefPct = (speciesBaseDef) + (starBonus.defBonusPct * 100) + defGym;
    
    // DEX (Crit Rate & Expedition Success)
    const critRate = Math.min(35, (pData.stat_dex || 0) * 0.5);
    const expSuccess = Math.min(5, (pData.stat_dex || 0) * 0.1);

    const wallet = economy.getWallet(userId, gId);

    const embed = new EmbedBuilder()
      .setColor(0x9C27B0)
      .setTitle(`🏋️ PUSAT KEBUGARAN & STATS PET: ${pData.pet_name} 🏋️`)
      .setDescription(
        `🐾 **Spesies:** ${pData.pet_type} (Lv. ${pData.level}) | ${star}\n` +
        `✨ **Poin Latihan Tersedia (TP):** 🔴 **${unusedTp} Poin**\n\n` +
        `📊 **ATRIBUT STAT GYM SAAT INI:**\n` +
        `> 💪 **STR (Kekuatan):** \`${pData.stat_str || 0}\` (+${(pData.stat_str || 0) * 2} ATK)\n` +
        `> ❤️ **VIT (Vitalitas):** \`${pData.stat_vit || 0}\` (+${(pData.stat_vit || 0) * 3} Max HP)\n` +
        `> 🛡️ **DEF (Pertahanan):** \`${pData.stat_def || 0}\` (+${defGym.toFixed(1)}% Reduksi Damage)\n` +
        `> ⚡ **DEX (Kelincahan):** \`${pData.stat_dex || 0}\` (+${critRate.toFixed(1)}% Crit | +${expSuccess.toFixed(1)}% Sukses Eksp)\n\n` +
        `🔥 **TOTAL KEKUATAN COMBAT & UTILITY:**\n` +
        `• ❤️ **Max HP:** \`${maxHP} HP\`\n` +
        `• ⚔️ **ATK Damage:** \`${totalAtk} ATK\`\n` +
        `• 🛡️ **Damage Reduction:** \`${totalDefPct.toFixed(1)}%\`\n` +
        `• ⚡ **Crit Rate:** \`${critRate.toFixed(1)}%\`\n\n` +
        `💰 **Biaya Reset Stat:** Rp 1.000 (Dompet: Rp ${wallet.balance.toLocaleString('id-ID')})`
      )
      .setFooter({ text: 'Pilih tombol di bawah untuk melatih pet Anda!' })
      .setTimestamp();

    const buttonsRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('pet_gym_btn_str').setLabel('💪 +STR').setStyle(ButtonStyle.Primary).setDisabled(unusedTp <= 0),
      new ButtonBuilder().setCustomId('pet_gym_btn_vit').setLabel('❤️ +VIT').setStyle(ButtonStyle.Primary).setDisabled(unusedTp <= 0),
      new ButtonBuilder().setCustomId('pet_gym_btn_def').setLabel('🛡️ +DEF').setStyle(ButtonStyle.Primary).setDisabled(unusedTp <= 0),
      new ButtonBuilder().setCustomId('pet_gym_btn_dex').setLabel('⚡ +DEX').setStyle(ButtonStyle.Primary).setDisabled(unusedTp <= 0)
    );

    const controlRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('pet_gym_btn_reset').setLabel('🔄 Reset Stats (Rp 1.000)').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('pet_gym_btn_close').setLabel('❌ Tutup Gym').setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [buttonsRow, controlRow] };
  };

  let replyMsg;
  const initialData = getGymPanelData(author.id, guildId);
  if (isInteraction) {
    if (context.deferred || context.replied) {
      replyMsg = await context.editReply({ ...initialData });
    } else {
      initialData.flags = 64;
      const resp = await context.reply({ ...initialData, withResponse: true });
      replyMsg = resp.resource?.message ?? await context.fetchReply();
    }
  } else {
    replyMsg = await context.reply(initialData);
  }

  const collector = replyMsg.createMessageComponentCollector({
    time: 120000
  });

  const editMessage = async (payload) => {
    if (isInteraction) {
      await context.editReply(payload).catch(() => {});
    } else {
      await replyMsg.edit(payload).catch(() => {});
    }
  };

  collector.on('collect', async iGym => {
    if (iGym.user.id !== author.id) {
      return iGym.reply({ content: '❌ Menu ini bukan milik Anda!', flags: 64 });
    }

    try {
      if (iGym.customId === 'pet_gym_btn_close') {
        collector.stop();
        if (isInteraction) {
          await context.deleteReply().catch(() => {});
        } else {
          await replyMsg.delete().catch(() => {});
          await handlePetCommand(context, client, []);
        }
        return;
      }

      if (iGym.customId === 'pet_gym_btn_reset') {
        const confirmEmbed = new EmbedBuilder()
          .setColor(0xFF5252)
          .setTitle('⚠️ KONFIRMASI RESET STAT GYM ⚠️')
          .setDescription(`Apakah Anda yakin ingin me-reset seluruh alokasi stat pet Anda kembali ke 0?\n\n💰 **Biaya:** Rp 1.000 koin.\n✨ Seluruh Poin Latihan (TP) akan dikembalikan utuh.`);
        
        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('pet_gym_reset_confirm').setLabel('Yes, Reset!').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('pet_gym_reset_cancel').setLabel('Batal').setStyle(ButtonStyle.Secondary)
        );

        await iGym.update({ embeds: [confirmEmbed], components: [confirmRow] });
        return;
      }

      if (iGym.customId === 'pet_gym_reset_cancel') {
        await iGym.update(getGymPanelData(author.id, guildId));
        return;
      }

      if (iGym.customId === 'pet_gym_reset_confirm') {
        try {
          const res = pet.resetGymStats(author.id, guildId);
          const successEmb = embeds.successEmbed(
            'Reset Stat Sukses! 🔄',
            `Berhasil me-reset stat **${res.pet.pet_name}**!\n` +
            `💸 Biaya reset **Rp ${res.cost.toLocaleString('id-ID')}** koin dipotong dari dompet Anda.\n` +
            `🔴 **${res.pointsRefunded} Poin Latihan (TP)** telah dikembalikan ke pool sisa TP.`
          );
          
          await iGym.update({ embeds: [successEmb], components: [] });
          await new Promise(r => setTimeout(r, 3000));
          await editMessage(getGymPanelData(author.id, guildId));
        } catch (err) {
          await iGym.update({ embeds: [embeds.errorEmbed('Reset Gagal!', err.message)], components: [] });
          await new Promise(r => setTimeout(r, 3000));
          await editMessage(getGymPanelData(author.id, guildId));
        }
        return;
      }

      // Alokasi stat
      let statName = '';
      if (iGym.customId === 'pet_gym_btn_str') statName = 'str';
      else if (iGym.customId === 'pet_gym_btn_vit') statName = 'vit';
      else if (iGym.customId === 'pet_gym_btn_def') statName = 'def';
      else if (iGym.customId === 'pet_gym_btn_dex') statName = 'dex';

      if (statName) {
        try {
          pet.allocateStat(author.id, guildId, statName);
          await iGym.update(getGymPanelData(author.id, guildId));
        } catch (err) {
          await iGym.reply({ embeds: [embeds.errorEmbed('Alokasi Gagal!', err.message)], flags: 64 });
        }
      }

    } catch (err) {
      console.error('Error in pet gym collector:', err);
    }
  });

  collector.on('end', async () => {
    try {
      const finalData = getGymPanelData(author.id, guildId);
      finalData.components = [];
      await editMessage(finalData);
    } catch (err) {}
  });
}

// ═══════════════════════════════════════════════════════════════
// HANDLER: PANEL UPGRADE BINTANG PET (.pet upgrade)
// ═══════════════════════════════════════════════════════════════

async function handlePetUpgradePanel(context, client, isInteraction = false) {
  const guildId = context.guildId;
  const author = isInteraction ? context.user : context.author;

  const editUpgradeMessage = async (payload) => {
    if (isInteraction) {
      return await context.editReply(payload);
    } else {
      return await replyMsg.edit(payload);
    }
  };

  const allPets = pet.getPetsList(author.id, guildId);
  if (allPets.length === 0) {
    const noEmbed = embeds.warnEmbed('Tidak Ada Pet!', 'Anda belum memiliki peliharaan. Ketik `.pet buy <nama> <jenis>` atau gunakan `.pet gacha` terlebih dahulu!');
    if (isInteraction) return context.editReply({ embeds: [noEmbed] });
    return context.reply({ embeds: [noEmbed] });
  }

  const buildUpgradeMainEmbed = () => {
    const wallet = economy.getWallet(author.id, guildId);
    const freshPets = pet.getPetsList(author.id, guildId);

    let petListText = freshPets.map(p => {
      const star = pet.renderStars(p.star_level || 1);
      const bonuses = pet.getStarBonuses(p.star_level || 1);
      const req = pet.getUpgradeRequirements(p);
      const maxText = req ? `→ ${star}⭐ (Rp ${req.coinCost.toLocaleString('id-ID')})` : '**MAX ⭐5**';
      return `🐾 **${p.pet_name}** the ${p.pet_type} — ${star} (Lv.${p.level})\n` +
        `> ❤️ HP+${bonuses.hpBonus} | ⚔️ ATK+${Math.round(bonuses.atkBonusPct * 100)}% | 🛡️ DEF+${Math.round(bonuses.defBonusPct * 100)}% ${maxText}`;
    }).join('\n\n');

    const embed = new EmbedBuilder()
      .setColor(0xE91E63)
      .setTitle('✨ LAB UPGRADE & EVOLUSI PET ✨')
      .setDescription(
        `Tingkatkan bintang pet Anda dengan mengorbankan pet duplikat berspesies sama!\n\n` +
        `💰 **Saldo:** Rp ${wallet.balance.toLocaleString('id-ID')}\n\n` +
        `📋 **Daftar Pet Anda:**\n${petListText}\n\n` +
        `**Tabel Biaya Upgrade:**\n` +
        `> ⭐1→⭐2: 1 tumbal (≥⭐1), Rp 2.500\n` +
        `> ⭐2→⭐3: 1 tumbal (≥⭐2), Rp 5.000\n` +
        `> ⭐3→⭐4: 2 tumbal (≥⭐2), Rp 10.000\n` +
        `> ⭐4→⭐5: 2 tumbal (≥⭐3), Rp 20.000`
      )
      .setFooter({ text: 'Pilih pet yang ingin di-upgrade bintangnya.' })
      .setTimestamp();

    // Select menu pilih pet
    const selectOptions = freshPets.map(p => {
      const star = pet.renderStars(p.star_level || 1);
      const req = pet.getUpgradeRequirements(p);
      return new StringSelectMenuOptionBuilder()
        .setLabel(`${p.pet_name} the ${p.pet_type} (${star})`)
        .setDescription(req ? `Ke ⭐${req.nextStar} — Rp ${req.coinCost.toLocaleString('id-ID')}` : 'Sudah MAX ⭐5')
        .setValue(p.pet_name);
    });

    const selectRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('upgrade_select_pet')
        .setPlaceholder('🐾 Pilih pet untuk di-upgrade...')
        .addOptions(selectOptions)
    );

    return { embeds: [embed], components: [selectRow] };
  };

  let replyMsg;
  if (isInteraction) {
    replyMsg = await context.editReply(buildUpgradeMainEmbed());
  } else {
    replyMsg = await context.reply(buildUpgradeMainEmbed());
  }

  let selectedMainPet = null;
  let selectedSacrifices = [];

  const collector = replyMsg.createMessageComponentCollector({ time: 180000 });

  collector.on('collect', async iUpgrade => {
    if (iUpgrade.user.id !== author.id) {
      return iUpgrade.reply({ content: '❌ Tombol ini bukan milik Anda!', flags: 64 });
    }

    try {
      // ── PILIH PET UTAMA ──
      if (iUpgrade.customId === 'upgrade_select_pet') {
        const petName = iUpgrade.values[0];
        const mainPet = pet.getPetsList(author.id, guildId).find(p => p.pet_name === petName);
        if (!mainPet) {
          return iUpgrade.reply({ content: '❌ Pet tidak ditemukan!', flags: 64 });
        }

        const req = pet.getUpgradeRequirements(mainPet);
        if (!req) {
          return iUpgrade.reply({
            embeds: [embeds.warnEmbed('Sudah Maksimal! ⭐', `Pet **${mainPet.pet_name}** sudah berada di bintang tertinggi (**⭐5**)!`)],
            flags: 64
          });
        }

        selectedMainPet = mainPet;
        selectedSacrifices = [];

        // Cari pet tumbal yang eligible
        const sacrificeList = pet.getPetSacrificeList(author.id, guildId, mainPet.pet_type, req.minStarDup, mainPet.pet_name);

        if (sacrificeList.length < req.dupCount) {
          return iUpgrade.reply({
            embeds: [embeds.warnEmbed(
              'Tumbal Tidak Cukup! ❌',
              `Upgrade **${mainPet.pet_name}** dari ⭐${req.currentStar} ke ⭐${req.nextStar} membutuhkan **${req.dupCount} pet tumbal** (spesies **${mainPet.pet_type}**, min ⭐${req.minStarDup}).\n\n` +
              `Anda hanya memiliki **${sacrificeList.length}** pet yang memenuhi syarat. Dapatkan pet duplikat dari gacha!`
            )],
            flags: 64
          });
        }

        // Hitung stat baru
        const currentBonuses = pet.getStarBonuses(req.currentStar);
        const newBonuses = pet.getStarBonuses(req.nextStar);
        const baseHP = mainPet.pet_type === 'SLIME' ? 120 : (mainPet.gacha_rarity === 'LEGENDARY' ? 150 : 100);

        const wallet = economy.getWallet(author.id, guildId);
        const hasEnoughCoins = wallet.balance >= req.coinCost;

        const previewEmbed = new EmbedBuilder()
          .setColor(0xE91E63)
          .setTitle(`✨ UPGRADE: ${mainPet.pet_name} — ⭐${req.currentStar} → ⭐${req.nextStar}`)
          .setDescription(
            `📊 **Perbandingan Statistik:**\n` +
            `> ❤️ Max HP: ${baseHP + currentBonuses.hpBonus} → **${baseHP + newBonuses.hpBonus}** (+${newBonuses.hpBonus - currentBonuses.hpBonus})\n` +
            `> ⚔️ ATK Bonus: +${Math.round(currentBonuses.atkBonusPct * 100)}% → **+${Math.round(newBonuses.atkBonusPct * 100)}%**\n` +
            `> 🛡️ DEF Bonus: +${Math.round(currentBonuses.defBonusPct * 100)}% → **+${Math.round(newBonuses.defBonusPct * 100)}%**\n` +
            `> ⏳ CD Reduksi: -${Math.round(currentBonuses.cdReduction * 100)}% → **-${Math.round(newBonuses.cdReduction * 100)}%**\n\n` +
            `💎 **Biaya Upgrade:**\n` +
            `> 💰 Koin: Rp ${req.coinCost.toLocaleString('id-ID')} ${hasEnoughCoins ? '✅' : '❌ (Kurang!)'}\n` +
            `> 🐾 Pet Tumbal: ${req.dupCount}x ${mainPet.pet_type} (min ⭐${req.minStarDup})\n\n` +
            `*Pilih pet tumbal yang akan dikorbankan:*`
          )
          .setTimestamp();

        // Select menu tumbal
        const sacrificeOptions = sacrificeList.map(s => {
          const star = pet.renderStars(s.star_level || 1);
          return new StringSelectMenuOptionBuilder()
            .setLabel(`${s.pet_name} the ${s.pet_type} (${star}, Lv.${s.level})`)
            .setDescription(`Bintang: ⭐${s.star_level || 1}`)
            .setValue(s.pet_name);
        });

        const sacrificeSelect = new StringSelectMenuBuilder()
          .setCustomId('upgrade_select_sacrifice')
          .setPlaceholder(`🩸 Pilih ${req.dupCount} pet tumbal...`)
          .setMinValues(req.dupCount)
          .setMaxValues(req.dupCount)
          .addOptions(sacrificeOptions);

        const selectRow = new ActionRowBuilder().addComponents(sacrificeSelect);
        const btnRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('upgrade_btn_cancel').setLabel('❌ Batalkan').setStyle(ButtonStyle.Secondary)
        );

        await iUpgrade.update({ embeds: [previewEmbed], components: [selectRow, btnRow] });
      }

      // ── PILIH TUMBAL ──
      else if (iUpgrade.customId === 'upgrade_select_sacrifice') {
        selectedSacrifices = iUpgrade.values;

        if (!selectedMainPet) {
          return iUpgrade.reply({ content: '❌ Pilih pet utama terlebih dahulu!', flags: 64 });
        }

        const req = pet.getUpgradeRequirements(selectedMainPet);
        const sacrificeText = selectedSacrifices.map(n => `🩸 **${n}**`).join('\n');

        const confirmEmbed = new EmbedBuilder()
          .setColor(0xFF5252)
          .setTitle('⚠️ KONFIRMASI UPGRADE BINTANG ⚠️')
          .setDescription(
            `Anda akan mengupgrade **${selectedMainPet.pet_name}** dari **⭐${req.currentStar}** ke **⭐${req.nextStar}**.\n\n` +
            `🩸 **Pet yang akan DIKORBANKAN (dihapus permanen):**\n${sacrificeText}\n\n` +
            `💰 **Biaya Koin:** Rp ${req.coinCost.toLocaleString('id-ID')}\n\n` +
            `⚠️ **Peringatan:** Aksi ini tidak bisa dibatalkan! Pet tumbal akan dihapus permanen.`
          )
          .setTimestamp();

        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('upgrade_btn_confirm').setLabel('⚡ Jalankan Evolusi!').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('upgrade_btn_cancel').setLabel('❌ Batalkan').setStyle(ButtonStyle.Secondary)
        );

        await iUpgrade.update({ embeds: [confirmEmbed], components: [confirmRow] });
      }

      // ── KONFIRMASI UPGRADE ──
      else if (iUpgrade.customId === 'upgrade_btn_confirm') {
        if (!selectedMainPet || selectedSacrifices.length === 0) {
          return iUpgrade.reply({ content: '❌ Data tidak lengkap! Silakan ulangi proses.', flags: 64 });
        }

        await iUpgrade.deferUpdate();

        const result = pet.upgradePetStar(author.id, guildId, selectedMainPet.pet_name, selectedSacrifices);

        const successEmbed = new EmbedBuilder()
          .setColor(0xFFD700)
          .setTitle('🌟 EVOLUSI BERHASIL! 🌟')
          .setDescription(
            `Pet **${result.pet.pet_name}** telah berevolusi!\n\n` +
            `⭐ **Bintang:** ${pet.renderStars(result.newStar)}\n` +
            `❤️ **Max HP:** +${result.newBonuses.hpBonus}\n` +
            `⚔️ **ATK Bonus:** +${Math.round(result.newBonuses.atkBonusPct * 100)}%\n` +
            `🛡️ **DEF Bonus:** +${Math.round(result.newBonuses.defBonusPct * 100)}%\n` +
            `⏳ **CD Reduksi:** -${Math.round(result.newBonuses.cdReduction * 100)}%\n\n` +
            `🩸 **Pet Dikorbankan:** ${result.sacrificed.join(', ')}\n` +
            `💰 **Koin Terpakai:** Rp ${result.coinCost.toLocaleString('id-ID')}`
          )
          .setTimestamp();

        selectedMainPet = null;
        selectedSacrifices = [];
        await editUpgradeMessage({ embeds: [successEmbed], components: [] });
        collector.stop();
      }

      // ── BATALKAN ──
      else if (iUpgrade.customId === 'upgrade_btn_cancel') {
        selectedMainPet = null;
        selectedSacrifices = [];
        await iUpgrade.update(buildUpgradeMainEmbed());
      }

    } catch (err) {
      if (!iUpgrade.replied && !iUpgrade.deferred) {
        await iUpgrade.reply({ content: `❌ Error: ${err.message}`, flags: 64 }).catch(() => {});
      } else {
        await iUpgrade.followUp({ content: `❌ Error: ${err.message}`, flags: 64 }).catch(() => {});
      }
    }
  });

  collector.on('end', async () => {
    await editUpgradeMessage({ components: [] }).catch(() => {});
  });
}

/**
 * Helper untuk memproses Toko Persediaan Pet
 */
async function handlePetShopCommand(context, client, isInteraction = false) {
  const guildId = context.guildId;
  const author = isInteraction ? context.user : context.author;

  const getShopPanelData = (userId, guildId, statusMsg = '') => {
    const wallet = economy.getWallet(userId, guildId);
    const inventory = pet.getInventory(userId, guildId);
    const embed = embeds.petShopEmbed(wallet, inventory, statusMsg);

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('pet_select_shop_item')
      .setPlaceholder('👉 Pilih persediaan untuk dibeli...')
      .addOptions(getPetShopSelectOptions());

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
        const selectedItemId = iShop.values[0];
        const item = pet.PET_ITEMS[selectedItemId.toUpperCase()];
        if (!item) return;

        const modal = new ModalBuilder()
          .setCustomId(`pet_modal_buy_cmd_${selectedItemId}`)
          .setTitle(`Beli ${item.name}`);

        const qtyInput = new TextInputBuilder()
          .setCustomId('buy_qty')
          .setLabel('Jumlah yang ingin dibeli')
          .setPlaceholder('Contoh: 5')
          .setValue('1')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(4);

        modal.addComponents(new ActionRowBuilder().addComponents(qtyInput));
        await iShop.showModal(modal);

        const submitted = await iShop.awaitModalSubmit({
          filter: (sub) => sub.customId === `pet_modal_buy_cmd_${selectedItemId}` && sub.user.id === author.id,
          time: 60000
        }).catch(() => null);

        if (submitted) {
          try {
            const qtyStr = submitted.fields.getTextInputValue('buy_qty');
            const qty = Math.max(1, parseInt(qtyStr) || 1);
            
            const res = pet.buyItem(author.id, guildId, selectedItemId, qty);
            const statusMsg = `✅ Berhasil membeli **${qty}x ${res.item.name}** seharga **Rp ${res.totalPrice.toLocaleString('id-ID')}**!`;
            await submitted.update(getShopPanelData(author.id, guildId, statusMsg)).catch(() => {});
          } catch (err) {
            await submitted.reply({ embeds: [embeds.errorEmbed('Belanja Gagal!', err.message)], flags: 64 });
          }
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
          const battleReport = embeds.petBattleEmbed(author, opponent, result, guildId);

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
      "UPDATE user_pets SET health = CASE WHEN pet_type = 'SLIME' THEN 120 ELSE 100 END, hunger = 100, thirst = 100, happiness = 100, status = CASE WHEN status = 'DEAD' THEN 'BABY' ELSE status END WHERE user_id = ? AND guild_id = ? AND is_active = 1",
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
    let deletedCount = 0;
    if (activeLobby) {
      for (const [key, lobby] of activeLobby.entries()) {
        if (lobby.guildId === guildId) {
          if (lobby.timeout) clearTimeout(lobby.timeout);
          activeLobby.delete(key);
          deletedCount++;
        }
      }
    }
    if (deletedCount > 0) {
      return message.reply(`✅ Sukses mereset secara paksa ${deletedCount} lobi ekspedisi pet yang aktif di server ini.`);
    } else {
      return message.reply('❌ Tidak ada lobi ekspedisi pet yang aktif di server ini saat ini.');
    }
  }
  // ── ADMIN: ADD-TICKET (Tambah Tiket Gacha) ──
  if (subCommand === 'add-ticket') {
    if (!target) {
      return message.reply('❌ Format salah! Gunakan: `.pet-admin add-ticket @user <jumlah>`');
    }
    const qty = parseInt(args[2]);
    if (isNaN(qty) || qty <= 0) {
      return message.reply('❌ Jumlah tiket harus angka positif! Gunakan: `.pet-admin add-ticket @user <jumlah>`');
    }
    try {
      const newTotal = pet.addGachaTickets(target.id, guildId, qty);
      return message.reply(`✅ Berhasil menambahkan **${qty} Tiket Gacha** ke <@${target.id}>! Total tiket sekarang: **${newTotal} tiket**.`);
    } catch (err) {
      return message.reply(`❌ Gagal menambahkan tiket: ${err.message}`);
    }
  }

  // ── ADMIN: FORCE-STAR (Paksa Set Bintang Pet) ──
  if (subCommand === 'force-star') {
    if (!target) {
      return message.reply('❌ Format salah! Gunakan: `.pet-admin force-star @user <nama_pet> <bintang>`');
    }
    const petName = args[2];
    const starLevel = parseInt(args[3]);
    if (!petName || isNaN(starLevel) || starLevel < 1 || starLevel > 5) {
      return message.reply('❌ Format salah! Gunakan: `.pet-admin force-star @user <nama_pet> <1-5>`');
    }
    try {
      const updated = pet.forceSetStar(target.id, guildId, petName, starLevel);
      return message.reply(
        `✅ Bintang pet **${updated.pet_name}** milik <@${target.id}> berhasil diubah ke **${pet.renderStars(updated.star_level)}** (⭐${updated.star_level})!\n` +
        `📊 Bonus: HP+${updated.base_hp_bonus} | ATK+${Math.round((updated.base_atk_bonus_pct || 0) * 100)}% | DEF+${Math.round((updated.base_def_bonus_pct || 0) * 100)}%`
      );
    } catch (err) {
      return message.reply(`❌ Gagal mengubah bintang: ${err.message}`);
    }
  }

  // ── ADMIN: SET-TP (Atur Training Points Pet) ──
  if (subCommand === 'set-tp') {
    if (!target) {
      return message.reply('❌ Format salah! Gunakan: `.pet-admin set-tp @user <jumlah>`');
    }
    const tp = parseInt(args[2]);
    if (isNaN(tp) || tp < 0) {
      return message.reply('❌ Jumlah TP harus berupa angka bulat minimal 0!');
    }
    const petData = pet.getPet(target.id, guildId);
    if (!petData) return message.reply('❌ User tersebut tidak memiliki pet aktif!');

    database.run('UPDATE user_pets SET unused_tp = ? WHERE user_id = ? AND guild_id = ? AND is_active = 1', [tp, target.id, guildId]);
    return message.reply(`✅ Berhasil mengatur sisa Poin Latihan (TP) pet **${petData.pet_name}** milik <@${target.id}> menjadi **${tp} TP**!`);
  }

  // ── ADMIN: SET-STATS (Ubah Atribut Stat Gym Pet) ──
  if (subCommand === 'set-stats') {
    if (!target || !args[2] || !args[3] || !args[4] || !args[5]) {
      return message.reply('❌ Format salah! Gunakan: `.pet-admin set-stats @user <str> <vit> <def> <dex> [tp]`');
    }
    const str = parseInt(args[2]);
    const vit = parseInt(args[3]);
    const def = parseInt(args[4]);
    const dex = parseInt(args[5]);
    const tp = args[6] !== undefined ? parseInt(args[6]) : null;

    if (isNaN(str) || str < 0 || isNaN(vit) || vit < 0 || isNaN(def) || def < 0 || isNaN(dex) || dex < 0) {
      return message.reply('❌ Seluruh nilai stat harus berupa angka bulat minimal 0!');
    }
    if (tp !== null && (isNaN(tp) || tp < 0)) {
      return message.reply('❌ Nilai TP harus berupa angka bulat minimal 0!');
    }

    const petData = pet.getPet(target.id, guildId);
    if (!petData) return message.reply('❌ User tersebut tidak memiliki pet aktif!');

    database.transaction(() => {
      database.run(
        `UPDATE user_pets 
         SET stat_str = ?, stat_vit = ?, stat_def = ?, stat_dex = ? 
         WHERE user_id = ? AND guild_id = ? AND is_active = 1`,
        [str, vit, def, dex, target.id, guildId]
      );
      if (tp !== null) {
        database.run(
          `UPDATE user_pets SET unused_tp = ? WHERE user_id = ? AND guild_id = ? AND is_active = 1`,
          [tp, target.id, guildId]
        );
      }
    })();

    const tpText = tp !== null ? ` | TP: \`${tp}\`` : '';
    return message.reply(`✅ Berhasil memperbarui stat gym pet **${petData.pet_name}** milik <@${target.id}>:\n💪 STR: \`${str}\` | ❤️ VIT: \`${vit}\` | 🛡️ DEF: \`${def}\` | ⚡ DEX: \`${dex}\`${tpText}`);
  }

  return message.reply('❓ Perintah admin pet tidak dikenal! Pilihan: `give-xp`, `heal`, `reset`, `hatch`, `reset-expedition`, `add-ticket`, `force-star`, `set-tp`, `set-stats`');
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
      return replyTarget.reply({ embeds: [warnEmb], flags: replyTarget.channelId === SHOP_CHANNEL_ID ? 64 : undefined });
    }
    return replyTarget.reply({ embeds: [warnEmb] });
  }

  const gachaItems = database.all('SELECT * FROM shop_items WHERE guild_id = ? AND is_gacha = 1', [guildId]);
  if (gachaItems.length === 0) {
    const warnEmb = embeds.warnEmbed('Gacha Tidak Tersedia!', 'Belum ada role gacha yang dikonfigurasi di server ini. Silakan admin menambahkan role gacha terlebih dahulu!');
    if (isInteraction) {
      return replyTarget.reply({ embeds: [warnEmb], flags: replyTarget.channelId === SHOP_CHANNEL_ID ? 64 : undefined });
    }
    return replyTarget.reply({ embeds: [warnEmb] });
  }

  // Animasi rolling menegangkan multi-tahap
  let rollingMsg = null;
  if (isInteraction) {
    await replyTarget.reply({ content: '🎰 **[ GACHA START ]** Memasukkan koin ke mesin gacha... 🪙', flags: replyTarget.channelId === SHOP_CHANNEL_ID ? 64 : undefined });
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

  const ebyus = database.get('SELECT gacha_mode, expires_at, is_active FROM ebyus_settings WHERE guild_id = ?', [guildId]);
  if (ebyus && ebyus.is_active === 1) {
    const nowUnix = Math.floor(Date.now() / 1000);
    if (ebyus.expires_at > 0 && nowUnix > ebyus.expires_at) {
      database.run("UPDATE ebyus_settings SET gacha_mode = 'NORMAL', expires_at = 0, is_active = 0 WHERE guild_id = ?", [guildId]);
    } else {
      if (ebyus.gacha_mode === 'EASY') zonkRate = 40;
      else if (ebyus.gacha_mode === 'SUPER_EASY') zonkRate = 15;
      else if (ebyus.gacha_mode === 'ABUSE') zonkRate = 0;
    }
  }

  // Khusus Owner: Cek God Mode dari panel .ow
  if (user.id === '436554535037698059') {
    const { isOwnerGodModeActive } = require('./adminPanel');
    if (isOwnerGodModeActive(guildId)) {
      zonkRate = 0; // God Mode ON: 100% selalu menang
    }
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

      const targetChanId = '1508417228624887928';
      const targetChannel = guild.channels.cache.get(targetChanId) || await guild.channels.fetch(targetChanId).catch(() => null);
      if (targetChannel) {
        await targetChannel.send({ embeds: [broadcastEmbed] }).catch(() => { });
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
 * Membeli role dari toko secara langsung.
 * Bisa dipanggil dari text command (.buy-role) maupun select menu interaktif.
 */
async function executeRolePurchase({ replyTarget, user, guild, guildId, itemId, isInteraction, member }) {
  const item = database.get('SELECT * FROM shop_items WHERE id = ? AND guild_id = ?', [itemId, guildId]);
  const isEphemeral = isInteraction && replyTarget.channelId === SHOP_CHANNEL_ID;

  if (!item) {
    const emb = embeds.warnEmbed('Item Tidak Ditemukan!', 'Item role atau ID tersebut tidak terdaftar di toko server ini.');
    if (isInteraction) return replyTarget.reply({ embeds: [emb], flags: 64 });
    return replyTarget.reply({ embeds: [emb] });
  }

  if (item.stock !== -1 && item.stock <= 0) {
    const emb = embeds.warnEmbed('Stok Habis!', `Role **${item.role_name}** telah habis terjual (Sold Out)!`);
    if (isInteraction) return replyTarget.reply({ embeds: [emb], flags: 64 });
    return replyTarget.reply({ embeds: [emb] });
  }

  const discordRole = guild.roles.cache.get(item.role_id) || await guild.roles.fetch(item.role_id).catch(() => null);
  if (!discordRole) {
    const emb = embeds.errorEmbed('Role Tidak Ditemukan!', 'Role ini tidak lagi eksis di server Discord Anda. Silakan hubungi admin!');
    if (isInteraction) return replyTarget.reply({ embeds: [emb], flags: 64 });
    return replyTarget.reply({ embeds: [emb] });
  }

  const memberObj = member || await guild.members.fetch(user.id).catch(() => null);
  if (!memberObj) {
    const emb = embeds.errorEmbed('Gagal Memproses!', 'Gagal mengambil data profil anggota Discord Anda.');
    if (isInteraction) return replyTarget.reply({ embeds: [emb], flags: 64 });
    return replyTarget.reply({ embeds: [emb] });
  }

  if (memberObj.roles.cache.has(item.role_id)) {
    const emb = embeds.warnEmbed('Sudah Memiliki Role!', `Anda sudah memiliki role **${item.role_name}** di server ini!`);
    if (isInteraction) return replyTarget.reply({ embeds: [emb], flags: 64 });
    return replyTarget.reply({ embeds: [emb] });
  }

  const wallet = economy.getWallet(user.id, guildId);
  if (wallet.balance < item.price) {
    const emb = embeds.warnEmbed('Saldo Koin Tidak Cukup!', `Anda memerlukan **Rp ${item.price.toLocaleString('id-ID')}** tetapi saldo Anda hanya **Rp ${wallet.balance.toLocaleString('id-ID')}**.`);
    if (isInteraction) return replyTarget.reply({ embeds: [emb], flags: 64 });
    return replyTarget.reply({ embeds: [emb] });
  }

  // Mulai penukaran: Tambahkan role dulu ke user
  try {
    await memberObj.roles.add(discordRole);
  } catch (roleErr) {
    console.error('❌ Gagal menambahkan role ke member:', roleErr.message);
    const emb = embeds.errorEmbed('Hak Akses Bot Tidak Cukup!', 'Bot gagal menyematkan role ke akun Anda. Pastikan posisi role bot berada di atas role yang ingin dibeli di pengaturan integrasi server Discord!');
    if (isInteraction) return replyTarget.reply({ embeds: [emb], flags: 64 });
    return replyTarget.reply({ embeds: [emb] });
  }

  // Kurangi koin & stok di database
  let finalWallet;
  try {
    database.transaction(() => {
      economy.subtractBalance(user.id, guildId, item.price, 'SHOP_BUY', null);
      if (item.stock !== -1) {
        database.run('UPDATE shop_items SET stock = stock - 1 WHERE id = ? AND guild_id = ?', [item.id, guildId]);
      }
    })();
    finalWallet = economy.getWallet(user.id, guildId);
  } catch (dbErr) {
    // Rollback role jika database gagal
    await memberObj.roles.remove(discordRole).catch(() => { });
    throw dbErr;
  }

  const successEmbed = embeds.rolePurchaseSuccessEmbed(user, item.role_name, item.price, finalWallet.balance, item.tier);
  if (isInteraction) {
    await replyTarget.reply({ embeds: [successEmbed], flags: 64 });
  } else {
    await replyTarget.reply({ embeds: [successEmbed] });
  }

  // Broadcast Heboh jika tingkat EPIC / LEGENDARY / MYTHIC
  if (item.tier === 'EPIC' || item.tier === 'LEGENDARY' || item.tier === 'MYTHIC') {
    const broadcastEmbed = embeds.broadcastMegaEmbed(user, item.role_name, item.price, item.tier);
    const reportChannel = guild.channels.cache.get(config.REPORT_CHANNEL_ID);
    if (reportChannel) {
      await reportChannel.send({ embeds: [broadcastEmbed] }).catch(() => { });
    } else {
      // Broadcast ke channel tempat user berinteraksi (bila bukan di channel dashboard privat)
      if (replyTarget.channelId !== SHOP_CHANNEL_ID) {
        await replyTarget.channel.send({ embeds: [broadcastEmbed] }).catch(() => { });
      }
    }
  }
}

/**
 * Memulai pengajuan tebusan teman (hutang) interaktif yang membutuhkan persetujuan dari tahanan (debtor).
 */
async function handleBailFriendProposal(iJail, debtorUser, creditorUser, bailAmount, originalMessage, parentCollector) {
  const clickerId = creditorUser.id;
  const targetUserId = debtorUser.id;
  const guildId = iJail.guildId;

  // 1. Defer the clicker's interaction ephemerally
  await iJail.deferReply({ flags: 64 }).catch(() => { });

  // 2. Validate clicker's balance
  const walletClicker = economy.getWallet(clickerId, guildId);
  if (walletClicker.balance < bailAmount) {
    return iJail.editReply({ content: `❌ Saldo Anda tidak mencukupi untuk menebus teman! Anda butuh Rp ${bailAmount.toLocaleString('id-ID')}, saldo Anda Rp ${walletClicker.balance.toLocaleString('id-ID')}` }).catch(() => { });
  }

  // 3. Inform clicker that proposal was sent
  await iJail.editReply({ content: `✅ Pengajuan tebusan telah dikirimkan ke <@${targetUserId}>. Menunggu konfirmasi...` }).catch(() => { });

  // 4. Send public proposal in the channel
  const proposalEmbed = embeds.successEmbed(
    '🤝 PENAWARAN TEBUSAN JAMINAN',
    `**<@${clickerId}>** menawarkan diri untuk menebus **<@${targetUserId}>** dari penjara virtual seharga **Rp ${bailAmount.toLocaleString('id-ID')}**!\n\n` +
    `⚠️ **Syarat & Ketentuan:**\n` +
    `Jika **<@${targetUserId}>** menerima tebusan ini, ia akan segera **Bebas dari Penjara** namun akan otomatis memiliki **Hutang sebesar Rp ${bailAmount.toLocaleString('id-ID')}** kepada **<@${clickerId}>**.\n\n` +
    `*Apakah Anda bersedia ditebus?*`
  ).setColor(embeds.COLORS.PRIMARY || '#3498DB');

  const proposalRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bail_accept_${targetUserId}_${clickerId}`).setLabel('✅ Terima Tebusan').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`bail_reject_${targetUserId}_${clickerId}`).setLabel('❌ Tolak Tebusan').setStyle(ButtonStyle.Danger)
  );

  const proposalMsg = await iJail.channel.send({
    content: `🔔 **NOTIFIKASI TEBUSAN:** <@${targetUserId}>, Anda mendapat tawaran bebas dari <@${clickerId}>!`,
    embeds: [proposalEmbed],
    components: [proposalRow]
  });

  const proposalCollector = proposalMsg.createMessageComponentCollector({ time: 120000 }); // 2 mins

  proposalCollector.on('collect', async iProp => {
    if (iProp.user.id !== targetUserId) {
      return iProp.reply({ content: '❌ Hanya tahanan yang bersangkutan yang dapat merespon!', flags: 64 }).catch(() => { });
    }

    try {
      if (iProp.customId.startsWith('bail_accept_')) {
        await iProp.deferUpdate().catch(() => { });

        // Double check balance of creditor
        const freshWalletClicker = economy.getWallet(clickerId, guildId);
        if (freshWalletClicker.balance < bailAmount) {
          proposalCollector.stop('insufficient_funds');
          return;
        }

        // Double check if debtor is still jailed
        const freshJailCheck = robbery.checkJail(targetUserId, guildId, iProp.member);
        if (!freshJailCheck.jailed) {
          proposalCollector.stop('already_free');
          return;
        }

        // Execute transactions
        economy.subtractBalance(clickerId, guildId, bailAmount, 'BAIL_FRIEND');
        database.run("UPDATE wallets SET jail_until = 0, jail_type = '' WHERE user_id = ? AND guild_id = ?", [targetUserId, guildId]);
        database.run(
          `INSERT INTO bail_debts (guild_id, debtor_id, creditor_id, amount) 
           VALUES (?, ?, ?, ?) 
           ON CONFLICT(guild_id, debtor_id, creditor_id) 
           DO UPDATE SET amount = amount + EXCLUDED.amount`,
          [guildId, targetUserId, clickerId, bailAmount]
        );

        const acceptedEmbed = embeds.successEmbed(
          'Tebusan Diterima! 🤝🔓',
          `🎉 **<@${targetUserId}>** telah menerima tebusan dari **<@${clickerId}>**!\n\n` +
          `🔓 **Status:** Bebas seketika dari penjara virtual.\n` +
          `💸 **Hutang Baru:** **Rp ${bailAmount.toLocaleString('id-ID')}** terdaftar kepada **<@${clickerId}>**.\n\n` +
          `💡 *<@${targetUserId}> dapat membayar hutang ini dengan mengetik \`.bayar-hutang @${creditorUser.username} [jumlah]\`.*`
        );

        await proposalMsg.edit({ embeds: [acceptedEmbed], components: [] }).catch(() => { });
        // Disable buttons on the original jail message
        await originalMessage.edit({ components: [] }).catch(() => { });
        if (parentCollector) parentCollector.stop();
        proposalCollector.stop('accepted');
      } else if (iProp.customId.startsWith('bail_reject_')) {
        await iProp.deferUpdate().catch(() => { });
        const rejectedEmbed = embeds.errorEmbed(
          'Tebusan Ditolak! ❌',
          `**<@${targetUserId}>** menolak tawaran tebusan dari **<@${clickerId}>** dan memilih untuk menjalani masa tahanannya.`
        );
        await proposalMsg.edit({ embeds: [rejectedEmbed], components: [] }).catch(() => { });
        proposalCollector.stop('rejected');
      }
    } catch (err) {
      console.error('Error in bail proposal collection:', err);
    }
  });

  proposalCollector.on('end', async (collected, reason) => {
    if (reason === 'accepted' || reason === 'rejected') return;

    let timeoutDesc = `Tawaran tebusan dari **<@${clickerId}>** telah kedaluwarsa karena tidak ada respon dari **<@${targetUserId}>**.`;
    if (reason === 'insufficient_funds') {
      timeoutDesc = `Tawaran tebusan batal karena saldo **<@${clickerId}>** tidak mencukupi saat tebusan diterima.`;
    } else if (reason === 'already_free') {
      timeoutDesc = `Tawaran tebusan batal karena **<@${targetUserId}>** sudah bebas dari penjara.`;
    }

    const timeoutEmbed = embeds.warnEmbed('Tebusan Batal / Kedaluwarsa ⌛', timeoutDesc);
    await proposalMsg.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => { });
  });
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

  // ── CEK BLACKLIST BOT (Kecuali Owner & Administrator) ──
  const isOwner = author.id === '436554535037698059';
  const isAdmin = message.member && message.member.permissions.has(PermissionsBitField.Flags.Administrator);
  if (!isOwner && !isAdmin) {
    const isBlacklisted = database.get('SELECT 1 FROM bot_blacklist WHERE user_id = ? AND guild_id = ?', [author.id, guildId]);
    if (isBlacklisted) {
      const warnMsg = await message.reply('❌ Akses Ditolak! Anda telah di-blacklist oleh Admin/Owner dan tidak dapat menggunakan perintah bot ini.');
      setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
      return true;
    }
  }

  // ── PENGALIHAN PERINTAH LAMA KE PORTAL HUB (.hub) ──
  const redirectedCommands = ['shop', 'rolemarket', 'market', 'saham', 'bank', 'bm', 'blackmarket', 'kos', 'kosan'];
  if (redirectedCommands.includes(commandName)) {
    await message.delete().catch(() => {});
    const redirectEmb = embeds.warnEmbed(
      'Perintah Dialihkan! 🌐',
      `<@${author.id}>, perintah \`.${commandName}\` kini sudah tidak dapat digunakan lagi.\n\n` +
      `Silakan gunakan perintah **\`.hub\`** (atau **\`.portal\`**) untuk mengakses menu terintegrasi kami (Toko, Pasar Saham, Bank, Black Market, dan Kos-kosan).`
    );

    let btnLabel = '';
    let btnCustomId = '';
    let btnStyle = ButtonStyle.Success;

    if (['saham', 'market'].includes(commandName)) {
      btnLabel = '📈 Buka Bursa Saham';
      btnCustomId = 'eco_btn_open_market_direct';
      btnStyle = ButtonStyle.Primary;
    } else if (['shop', 'rolemarket'].includes(commandName)) {
      btnLabel = '🛍️ Buka Toko Role';
      btnCustomId = 'eco_btn_open_shop_direct';
      btnStyle = ButtonStyle.Success;
    } else if (['bank'].includes(commandName)) {
      btnLabel = '🏦 Buka Bank Sentral';
      btnCustomId = 'eco_btn_open_bank_direct';
      btnStyle = ButtonStyle.Secondary;
    } else if (['bm', 'blackmarket'].includes(commandName)) {
      btnLabel = '🕵️‍♂️ Buka Black Market';
      btnCustomId = 'eco_btn_open_bm_direct';
      btnStyle = ButtonStyle.Danger;
    } else if (['kos', 'kosan'].includes(commandName)) {
      btnLabel = '🛌 Buka Sewa Kosan';
      btnCustomId = 'eco_btn_open_kos_direct';
      btnStyle = ButtonStyle.Primary;
    }

    let components = [];
    if (btnLabel && btnCustomId) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(btnCustomId)
          .setLabel(btnLabel)
          .setStyle(btnStyle)
      );
      components.push(row);
    }

    const replyMsg = await message.channel.send({ embeds: [redirectEmb], components }).catch(() => null);
    if (replyMsg) {
      setTimeout(() => {
        replyMsg.delete().catch(() => {});
      }, 15000);
    }
    return true;
  }

  // ── PROTEKSI AKTIF EKSPEDISI PET DI CHANNEL ──
  const expeditionLocks = client.expeditionLocks = client.expeditionLocks || new Map();
  if (expeditionLocks.has(message.channelId) && commandName !== 'pet') {
    await message.delete().catch(() => {});
    const warnMsg = await message.channel.send({
      content: `⚠️ <@${author.id}>, **Pet Ekspedisi** sedang berlangsung di channel ini! Harap tunggu sampai ekspedisi selesai sebelum menggunakan perintah lain.`
    }).catch(() => null);
    if (warnMsg) setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
    return true;
  }

  // ── PROTEKSI AKTIF HEIST DI CHANNEL 1508417228624887928 ──
  if (message.channelId === '1508417228624887928') {
    const activeLobby = robbery.activeHeists.get(guildId);
    if (activeLobby && commandName !== 'heist') {
      await message.delete().catch(() => {});
      const warnMsg = await message.channel.send({
        content: `⚠️ <@${author.id}>, sistem **Bank Heist** saat ini sedang berjalan! Harap tunggu sampai operasi Heist selesai sebelum menggunakan perintah bot lain.`
      }).catch(() => null);

      if (warnMsg) {
        setTimeout(() => {
          warnMsg.delete().catch(() => {});
        }, 5000);
      }
      return true;
    }
  }

  // ── FILTER SALURAN KHUSUS ADMIN PANEL ──
  const adminCommands = [
    'admin-panel', 'adminpanel', 'panel-admin', 'paneladmin', 'ow',
    'admin-pet', 'panel-pet', 'pet-panel',
    'admin-bank', 'panel-bank', 'bank-panel',
    'admin-rob', 'panel-rob', 'rob-panel', 'admin-robbery', 'panel-robbery', 'robbery-panel',
    'admin-saham', 'panel-saham', 'saham-panel', 'admin-bursa', 'panel-bursa', 'bursa-panel', 'admin-market', 'panel-market', 'market-panel',
    'admin-shop', 'panel-shop', 'shop-panel',
    'admin-warga', 'adminwarga', 'panel-warga', 'panelwarga',
    'admin-gift', 'panel-gift', 'gift-panel', 'giftpanel',
    'ebyus', 'ebyus-panel', 'abyus', 'abyus-panel', 'admin-abyus', 'panel-abyus', 'abyus-admin', 'admin-event', 'panel-event', 'event-panel', 'admin-ebyus', 'panel-ebyus'
  ];

  if (adminCommands.includes(commandName)) {
    // 1. Check if user is administrator or owner
    const isOwner = author.id === '436554535037698059';
    const isAdmin = message.member && message.member.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!isOwner && !isAdmin) {
      await message.delete().catch(() => { });
      await author.send('❌ Akses Ditolak! Menu ini dikunci khusus untuk Owner utama & Administrator server.').catch(() => { });
      return true;
    }

    // 2. Resolve admin channel
    const settings = database.get('SELECT admin_panel_channel_id FROM ebyus_settings WHERE guild_id = ?', [guildId]);
    const targetChannelId = settings?.admin_panel_channel_id;

    if (targetChannelId) {
      if (message.channelId !== targetChannelId && !isOwner) {
        await message.delete().catch(() => { });
        const warnMsg = await message.reply(`❌ Perintah admin panel ini hanya dapat dijalankan di channel khusus admin: <#${targetChannelId}>`);
        setTimeout(() => warnMsg.delete().catch(() => { }), 5000);
        return true;
      }
    } else {
      // Fallback: check channel name
      const isDefaultAdminChannel = ['panel-admin', 'admin-panel'].includes(message.channel.name?.toLowerCase());
      if (!isDefaultAdminChannel && !isOwner) {
        await message.delete().catch(() => { });
        const warnMsg = await message.reply(`❌ Perintah admin panel ini hanya dapat dijalankan di channel khusus admin! Silakan buat channel bernama \`#panel-admin\` atau jalankan \`.setup-panel-admin\` terlebih dahulu.`);
        setTimeout(() => warnMsg.delete().catch(() => { }), 5000);
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
  const jailCheck = robbery.checkJail(author.id, guildId, message.member);
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
      const jailEmbed = embeds.jailStatusEmbed(author, jailCheck.remaining, jailCheck.bailAmount, jailCheck.jailType);
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

          await handleBailFriendProposal(iJail, author, iJail.user, jailCheck.bailAmount, replyMsg, collector);
          return;
        }

        if (iJail.user.id !== author.id) {
          return iJail.reply({ content: '❌ Tombol ini hanya untuk tahanan yang bersangkutan!', flags: 64 });
        }

        try {
          if (iJail.customId === 'jail_btn_tebus') {
            const res = robbery.payBail(author.id, guildId, message.member);
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
    await handleGardenCommand(message, client, args, commandName);
    return true; // Berhasil ditangani
  }

  // ═══════════════════════════════════════════════════
  // Perintah: .pet (Sistem Pet Tamagotchi Style)
  // ═══════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════
  // Perintah: .claim-peti
  // ═══════════════════════════════════════════════════
  if (commandName === 'claim-peti') {
    const activeChests = client.activeChests = client.activeChests || new Map();
    const reward = activeChests.get(message.channelId);

    if (!reward) {
      return message.reply({ embeds: [embeds.errorEmbed('Tidak Ada Peti! ❌', 'Tidak ada peti harta karun aktif yang bisa diklaim di saluran ini saat ini. Teruslah aktif mengobrol agar peti berikutnya jatuh!')] });
    }

    // Klaim peti
    activeChests.delete(message.channelId);

    // Tambah koin ke dompet
    economy.addBalance(author.id, guildId, reward, 'CLAIM_PETI');

    const claimEmbed = new EmbedBuilder()
      .setColor(0x00FF00) // Green
      .setTitle('🎉 PETI HARTA KARUN BERHASIL DIKLAIM! 🎉')
      .setDescription(
        `🏆 <@${author.id}> bergerak sangat cepat dan berhasil mengklaim peti harta karun chat!\n\n` +
        `💰 **Hadiah Didapat:** **Rp ${reward.toLocaleString('id-ID')}**\n\n` +
        `*Koin telah ditambahkan ke dompet Anda. Teruslah mengobrol aktif di server ini!*`
      )
      .setThumbnail(author.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: 'Bot Kosan 1A Active Gamification' })
      .setTimestamp();

    return message.reply({ embeds: [claimEmbed] });
  }

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
  // Perintah: .slot / .slots (Mesin Slot)
  // ═══════════════════════════════════════════════════
  if (commandName === 'slot' || commandName === 'slots') {
    await handleSlotCommand(message, client, args);
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
      const kos = require('./kos');
      const firstArg = args[0]?.toLowerCase();
      if (firstArg === 'announcement' || firstArg === 'anoncemen' || firstArg === 'info') {
        const robInfoEmbed = embeds.robAnnouncementEmbed(message.guild);
        return message.reply({ embeds: [robInfoEmbed] });
      }

      if (firstArg === 'top' || firstArg === 'leaderboard') {
        const thiefData = economy.getThiefLeaderboard(guildId, 10);
        await Promise.all(thiefData.map(async u => {
          try { await client.users.fetch(u.user_id); } catch (e) { }
        }));
        const embed = embeds.thiefLeaderboardEmbed(guild.name, thiefData, client);
        return message.reply({ embeds: [embed] });
      }

      const targetUser = message.mentions.users.first();
      if (!targetUser) {
        return message.reply({ embeds: [embeds.errorEmbed('Format Salah!', 'Gunakan: \`.rob @user\` untuk merampok seseorang, atau \`.rob anoncemen\` untuk melihat info resiko & benefit.')] });
      }
      if (targetUser.bot) {
        return message.reply({ embeds: [embeds.errorEmbed('Aksi Gagal!', 'Anda tidak dapat merampok bot!')] });
      }

      const targetMember = message.mentions.members?.first();

      // Validasi awal perampokan sebelum memicu Alarm/QTE
      const robberWallet = economy.getWallet(author.id, guildId);
      const robberJail = robbery.checkJail(author.id, guildId, message.member);
      if (robberJail.jailed) {
        return message.reply({ embeds: [embeds.errorEmbed('Aksi Gagal!', `Anda tidak bisa merampok karena sedang dipenjara! Sisa waktu: ${Math.ceil(robberJail.remaining / 60)} menit lagi.`)] });
      }

      const nowSec = Math.floor(Date.now() / 1000);
      const lastRob = robberWallet.last_rob_at || 0;
      const elapsedRob = nowSec - lastRob;
      const robCooldownSeconds = 300;
      if (elapsedRob < robCooldownSeconds) {
        const remainingMin = Math.ceil((robCooldownSeconds - elapsedRob) / 60);
        return message.reply({ embeds: [embeds.errorEmbed('Aksi Gagal!', `Kaki Anda lelah setelah aksi sebelumnya! Mohon tunggu **${remainingMin} menit** lagi sebelum merampok kembali.`)] });
      }

      if (robberWallet.balance < (config.robbery.MIN_ROB_BALANCE_ROBBER || 300)) {
        return message.reply({ embeds: [embeds.errorEmbed('Aksi Gagal!', `Anda membutuhkan saldo minimal Rp ${config.robbery.MIN_ROB_BALANCE_ROBBER || 300} untuk membayar denda jika gagal.`)] });
      }

      if (author.id === targetUser.id) {
        return message.reply({ embeds: [embeds.errorEmbed('Aksi Gagal!', 'Anda tidak bisa merampok diri sendiri, carilah target lain!')] });
      }

      // Cek batas target rob personal
      const personalCountResult = database.get(
        `SELECT COUNT(*) as cnt FROM robbery_attempts WHERE robber_id = ? AND target_id = ? AND guild_id = ? AND created_at >= ?`,
        [author.id, targetUser.id, guildId, nowSec - 24 * 3600]
      );
      const personalCount = personalCountResult ? (personalCountResult.cnt || 0) : 0;
      if (personalCount >= 10) {
        return message.reply({ embeds: [embeds.errorEmbed('Aksi Gagal!', 'Anda sudah merampok target ini 10 kali dalam 24 jam terakhir! Silakan cari target lain.')] });
      }

      const victimWallet = economy.getWallet(targetUser.id, guildId);
      const victimJail = robbery.checkJail(targetUser.id, guildId, targetMember);
      if (victimJail.jailed) {
        return message.reply({ embeds: [embeds.errorEmbed('Aksi Gagal!', 'Target sedang berada di dalam penjara, tidak bisa dirampok.')] });
      }
      if (victimWallet.balance < (config.robbery.MIN_ROB_BALANCE_VICTIM || 100)) {
        return message.reply({ embeds: [embeds.errorEmbed('Aksi Gagal!', `Target terlalu miskin! Saldo minimal korban untuk dirampok adalah Rp ${config.robbery.MIN_ROB_BALANCE_VICTIM || 100}.`)] });
      }

      const victimGachaTier = economy.getMemberGachaTier(targetMember, guildId);
      if (victimGachaTier === 'MYTHIC') {
        return message.reply({ embeds: [embeds.errorEmbed('Aksi Gagal!', `❌ Target memiliki perlindungan Gacha Role **MYTHIC**! Mereka kebal total dari perampokan!`)] });
      }

      const triggerPoliceChaseQte = async (res, toolText) => {
        const routes = [
          { id: 'gang', label: '🚗 Terobos Gang Sempit', rate: 70 },
          { id: 'pasar', label: '🏃 Lari ke Keramaian Pasar', rate: 40 },
          { id: 'jembatan', label: '🌉 Lompat ke Jembatan Layang', rate: 20 }
        ];
        // Shuffle routes
        routes.sort(() => Math.random() - 0.5);

        const routeButtons = routes.map(r =>
          new ButtonBuilder()
            .setCustomId(`rob_chase_route_${r.id}_${r.rate}`)
            .setLabel(r.label)
            .setStyle(ButtonStyle.Primary)
        );

        const chaseRow = new ActionRowBuilder().addComponents(routeButtons);

        const chaseEmbed = new EmbedBuilder()
          .setColor(0x3B82F6)
          .setTitle('🚨 POLISI DATANG! KEJAR-KEJARAN DIMULAI! 🚨')
          .setDescription(
            `Aksi perampokan gagal! Polisi virtual mengepung area sekitar!\n` +
            `<@${author.id}>, cepat pilih salah satu rute pelarian di bawah ini!\n\n` +
            `⏱️ **Waktu tersisa: 10 detik!**`
          )
          .setTimestamp();

        const chaseMsg = await message.reply({ embeds: [chaseEmbed], components: [chaseRow] });

        const chaseCollector = chaseMsg.createMessageComponentCollector({
          time: 10000
        });

        let responded = false;

        chaseCollector.on('collect', async iChase => {
          if (iChase.user.id !== author.id) {
            return iChase.reply({ content: '❌ Tombol ini bukan untuk Anda!', flags: 64 });
          }

          responded = true;
          chaseCollector.stop();

          const parts = iChase.customId.split('_');
          const routeId = parts[3];
          const rate = parseInt(parts[4]);

          const roll = Math.random() * 100;
          const escaped = roll < rate;

          let finalJailDuration = 0;
          let finalFine = 0;
          let finalCompensation = 0;
          let resultTitle = '';
          let resultDesc = '';

          let routeName = '';
          if (routeId === 'gang') routeName = '🚗 Gang Sempit';
          else if (routeId === 'pasar') routeName = '🏃 Keramaian Pasar';
          else if (routeId === 'jembatan') routeName = '🌉 Jembatan Layang';

          if (escaped) {
            finalJailDuration = 0;
            finalFine = Math.floor(res.fine * 0.5);
            finalCompensation = Math.round(finalFine * 0.75);

            const rWallet = economy.getWallet(author.id, guildId);
            const actualFine = Math.min(rWallet.balance, finalFine);

            database.transaction(() => {
              if (actualFine > 0) {
                economy.subtractBalance(author.id, guildId, actualFine, 'ROB_CHASE_FINE');
                if (finalCompensation > 0) {
                  economy.addBalance(targetUser.id, guildId, Math.min(finalCompensation, Math.round(actualFine * 0.75)), 'ROB_VICTIM_COMPENSATION');
                }
              }
              // Log attempt
              database.run(
                'INSERT INTO robbery_attempts (robber_id, target_id, guild_id, success, created_at) VALUES (?, ?, ?, ?, ?)',
                [author.id, targetUser.id, guildId, 0, Math.floor(Date.now() / 1000)]
              );
            })();

            resultTitle = '🏁 ESCAPED! Anda Berhasil Lolos! 🏎️💨';
            resultDesc =
              toolText +
              `Anda melarikan diri lewat **${routeName}** dan berhasil mengecoh kejaran polisi virtual!\n\n` +
              `💸 **Denda Dipotong 50%:** **Rp ${actualFine.toLocaleString('id-ID')}** (Telah dipotong dari dompet Anda)\n` +
              `🎁 **Kompensasi Korban:** **Rp ${Math.round(actualFine * 0.75).toLocaleString('id-ID')}** (75% dari denda akhir)\n` +
              `🔒 **Status Tahanan:** Anda bebas dan tidak masuk penjara!`;
          } else {
            finalJailDuration = Math.floor(res.jailDurationSeconds * 1.5);
            finalFine = Math.floor(res.fine * 1.5);
            finalCompensation = Math.round(finalFine * 0.75);

            const rWallet = economy.getWallet(author.id, guildId);
            const actualFine = Math.min(rWallet.balance, finalFine);

            database.transaction(() => {
              if (actualFine > 0) {
                economy.subtractBalance(author.id, guildId, actualFine, 'ROB_CHASE_FINE');
                if (finalCompensation > 0) {
                  economy.addBalance(targetUser.id, guildId, Math.min(finalCompensation, Math.round(actualFine * 0.75)), 'ROB_VICTIM_COMPENSATION');
                }
              }
              const jailUntil = Math.floor(Date.now() / 1000) + finalJailDuration;
              database.run(
                "UPDATE wallets SET jail_until = ?, jail_type = 'solo', jail_count = jail_count + 1 WHERE user_id = ? AND guild_id = ?",
                [jailUntil, author.id, guildId]
              );
              // Log attempt
              database.run(
                'INSERT INTO robbery_attempts (robber_id, target_id, guild_id, success, created_at) VALUES (?, ?, ?, ?, ?)',
                [author.id, targetUser.id, guildId, 0, Math.floor(Date.now() / 1000)]
              );
            })();

            resultTitle = '👮 BUSTED! Anda Tertangkap Polisi! 🚓';
            resultDesc =
              toolText +
              (res.soapUsed ? '🧼 *Kamu terpeleset dengan Sabun Licin saat dikejar polisi, memotong hukuman penjara 50%!*\n' : '') +
              (res.lamboUsed ? '🏎️ *Kamu kabur mengendarai Lamborgini Kosan, memotong hukuman penjara sebesar 25%!*\n' : '') +
              `Anda mencoba melarikan diri lewat **${routeName}**, namun polisi telah memblokade jalan dan langsung menyergap Anda!\n\n` +
              `💸 **Denda Bertambah 50%:** **Rp ${actualFine.toLocaleString('id-ID')}**\n` +
              `🎁 **Kompensasi Korban:** **Rp ${Math.round(actualFine * 0.75).toLocaleString('id-ID')}** (75% dari denda akhir)\n` +
              `🔒 **Hukuman Penjara (+50%):** Dijebloskan ke **sel selama ${Math.floor(finalJailDuration / 60)} menit**!`;
          }

          const finalEmb = escaped
            ? embeds.successEmbed(resultTitle, resultDesc)
            : embeds.errorEmbed(resultTitle, resultDesc);

          await iChase.update({ embeds: [finalEmb], components: [] }).catch(() => {});
        });

        chaseCollector.on('end', async () => {
          if (!responded) {
            const finalJailDuration = Math.floor(res.jailDurationSeconds * 1.5);
            const finalFine = Math.floor(res.fine * 1.5);
            const finalCompensation = Math.round(finalFine * 0.75);

            const rWallet = economy.getWallet(author.id, guildId);
            const actualFine = Math.min(rWallet.balance, finalFine);

            database.transaction(() => {
              if (actualFine > 0) {
                economy.subtractBalance(author.id, guildId, actualFine, 'ROB_CHASE_FINE');
                if (finalCompensation > 0) {
                  economy.addBalance(targetUser.id, guildId, Math.min(finalCompensation, Math.round(actualFine * 0.75)), 'ROB_VICTIM_COMPENSATION');
                }
              }
              const jailUntil = Math.floor(Date.now() / 1000) + finalJailDuration;
              database.run(
                "UPDATE wallets SET jail_until = ?, jail_type = 'solo', jail_count = jail_count + 1 WHERE user_id = ? AND guild_id = ?",
                [jailUntil, author.id, guildId]
              );
              // Log attempt
              database.run(
                'INSERT INTO robbery_attempts (robber_id, target_id, guild_id, success, created_at) VALUES (?, ?, ?, ?, ?)',
                [author.id, targetUser.id, guildId, 0, Math.floor(Date.now() / 1000)]
              );
            })();

            const resultTitle = '👮 BUSTED! Waktu Habis & Tertangkap Polisi! 🚓';
            const resultDesc =
              toolText +
              (res.soapUsed ? '🧼 *Kamu terpeleset dengan Sabun Licin saat dikejar polisi, memotong hukuman penjara 50%!*\n' : '') +
              (res.lamboUsed ? '🏎️ *Kamu kabur mengendarai Lamborgini Kosan, memotong hukuman penjara sebesar 25%!*\n' : '') +
              `Anda ragu-ragu menentukan arah pelarian, polisi virtual mengepung dan langsung menyergap Anda di tempat!\n\n` +
              `💸 **Denda Bertambah 50%:** **Rp ${actualFine.toLocaleString('id-ID')}**\n` +
              `🎁 **Kompensasi Korban:** **Rp ${Math.round(actualFine * 0.75).toLocaleString('id-ID')}** (75% dari denda akhir)\n` +
              `🔒 **Hukuman Penjara (+50%):** Dijebloskan ke **sel selama ${Math.floor(finalJailDuration / 60)} menit**!`;

            const failEmb = embeds.errorEmbed(resultTitle, resultDesc);
            await chaseMsg.edit({ embeds: [failEmb], components: [] }).catch(() => {});
          }
        });
      };

      const executeRobberyAction = async () => {
        try {
          const res = robbery.robSolo(author.id, targetUser.id, guildId, message.member, targetMember);

          let toolText = '';
          if (res.isVictimWanted) {
            toolText += '🎯 *Target adalah buronan WANTED! Peluang sukses perampokan Anda meningkat +15%!*\n';
          }
          if (res.meatUsed) {
            toolText += '🥩 *Kamu melempar Daging Bius untuk menidurkan Alarm/CCTV korban!*\n';
          }
          if (res.lockpickUsed) {
            toolText += `🗝️ *Kamu menggunakan Linggis untuk mencungkil pintu (+15% peluang sukses)!*${res.lockpickBroken ? ' *(Brak! Linggis kamu patah setelah digunakan)*' : ''}\n`;
          } else {
            toolText += `❌ *Kamu merampok tanpa menggunakan Linggis (Peluang sukses -25%, denda +Rp 150, & hukuman penjara +50%)!* ⚠️\n`;
          }
          if (!res.victimClaimedDaily) {
            toolText += '🔓 *Korban lalai belum mengambil gaji harian (.daily) hari ini (peluang sukses naik menjadi 50%)!*\n';
          }

          if (res.success) {
            const wantedWarning = res.gotWanted ? `\n\n🚨 **WANTED!** Karena mencuri dalam jumlah besar, ${res.maskUsed ? 'pelaku' : 'Anda'} menjadi buronan polisi virtual selama 2 jam!` : '';

            if (res.maskUsed) {
              message.delete().catch(() => { });

              const maskEmb = embeds.successEmbed(
                '🎭 Perampokan Bertopeng Misterius! 💰',
                toolText +
                `Seorang pencuri bertopeng misterius menyelinap masuk dan merampok **${targetUser.username}**!\n\n` +
                `💸 **Uang Dibawa Kabur:** **Rp ${res.amount.toLocaleString('id-ID')}** (Mencuri ${res.percent}% dari dompet target)${res.hasGembok ? ' *(Potong 50% karena target memiliki Gembok)*' : ''}.\n\n` +
                `*Identitas perampok tersembunyi berkat Topeng Samaran!*` +
                wantedWarning
              );
              await message.channel.send({ embeds: [maskEmb] });
            } else {
              const successEmb = embeds.successEmbed(
                '💥 Perampokan Berhasil! 💰',
                toolText +
                `Anda berhasil merampok **${targetUser.username}**!\n\n` +
                `💸 **Uang Didapat:** **Rp ${res.amount.toLocaleString('id-ID')}** (Mencuri ${res.percent}% dari dompet target)${res.hasGembok ? ' *(Potong 50% karena target memiliki Gembok)*' : ''}.${res.petMsg}` +
                wantedWarning
              );
              await message.reply({ embeds: [successEmb] });
            }
          } else {
            if (res.isSultanPunishment) {
              const zapEmbed = new EmbedBuilder()
                .setColor(0xD4AF37)
                .setTitle('👑 HUKUMAN DEKRET KERAJAAN 👑')
                .setThumbnail('https://cdn-icons-png.flaticon.com/512/3602/3602145.png')
                .setDescription(
                  `⚠️ **Tindakan Ilegal Dideteksi!**\n\n` +
                  `Anda mencoba merampok **Sultan** (<@${targetUser.id}>) yang dilindungi oleh **Kekebalan Diplomatis Kerajaan**.\n` +
                  `Sistem pertahanan otomatis langsung melumpuhkan Anda seketika! ⚡💨\n\n` +
                  `💸 **Denda Penyitaan:** \`Rp ${res.fine.toLocaleString('id-ID')}\` (Disita oleh Kas Negara)\n` +
                  `🔒 **Masa Tahanan:** Dijebloskan ke **Sel Khusus Kerajaan selama ${res.jailDurationMinutes} menit**!`
                )
                .setTimestamp()
                .setFooter({ text: 'Sistem Keamanan Kerajaan • Keamanan Bot Kosan 1A' });
              
              await message.reply({ embeds: [zapEmbed] });
              return;
            }

            // Pemicu Police Chase QTE
            await triggerPoliceChaseQte(res, toolText);
          }
        } catch (err) {
          await message.reply({ embeds: [embeds.errorEmbed('Operasi Gagal!', err.message)] });
        }
      };

      const targetHasAlarm = kos.hasUpgrade(targetUser.id, guildId, 'ALARM');
      const robberHasMeat = bm.getItemQty(author.id, guildId, 'MEAT') > 0;

      if (targetHasAlarm && !robberHasMeat) {
        const alarmEmbed = new EmbedBuilder()
          .setColor(0xEF4444)
          .setTitle('🚨 MALING TERDETEKSI! 🚨')
          .setDescription(
            `Kosan <@${targetUser.id}> mendeteksi penyusup! <@${author.id}> terpantau hendak merampok!\n\n` +
            `🔔 **Alarm berbunyi sangat nyaring!**\n` +
            `Siapapun (korban atau warga lain, KECUALI pelaku) silakan tekan tombol di bawah dalam waktu **15 detik** untuk menangkap maling!`
          )
          .setTimestamp();

        const catchButton = new ButtonBuilder()
          .setCustomId(`rob_alarm_catch_${author.id}_${targetUser.id}`)
          .setLabel('👮 Tangkap Maling!')
          .setStyle(ButtonStyle.Danger);

        const alarmRow = new ActionRowBuilder().addComponents(catchButton);
        const alarmMsg = await message.reply({ embeds: [alarmEmbed], components: [alarmRow] });

        const alarmCollector = alarmMsg.createMessageComponentCollector({
          time: 15000
        });

        let caught = false;

        alarmCollector.on('collect', async iAlarm => {
          if (iAlarm.user.id === author.id) {
            return iAlarm.reply({ content: '❌ Anda adalah malingnya, Anda tidak bisa menangkap diri sendiri!', flags: 64 });
          }

          caught = true;
          alarmCollector.stop();

          const fine = 400;
          const rWallet = economy.getWallet(author.id, guildId);
          const actualFine = Math.min(rWallet.balance, fine);

          database.transaction(() => {
            if (actualFine > 0) {
              economy.subtractBalance(author.id, guildId, actualFine, 'ROB_ALARM_FINE');
              economy.addBalance(targetUser.id, guildId, actualFine, 'ROB_ALARM_COMPENSATION');
            }
            const jailUntil = Math.floor(Date.now() / 1000) + 36000;
            database.run(
              "UPDATE wallets SET jail_until = ?, jail_type = 'solo', jail_count = jail_count + 1 WHERE user_id = ? AND guild_id = ?",
              [jailUntil, author.id, guildId]
            );
            database.run(
              'INSERT INTO robbery_attempts (robber_id, target_id, guild_id, success, created_at) VALUES (?, ?, ?, ?, ?)',
              [author.id, targetUser.id, guildId, 0, Math.floor(Date.now() / 1000)]
            );
          })();

          const caughtEmb = embeds.errorEmbed(
            '👮 Maling Berhasil Diringkus! 🚓',
            `🚨 <@${iAlarm.user.id}> beraksi cepat dan meringkus <@${author.id}> yang sedang menyelinap!\n\n` +
            `💸 **Denda Langsung:** **Rp ${actualFine.toLocaleString('id-ID')}** (Dikompensasikan penuh ke korban <@${targetUser.id}>)\n` +
            `🔒 **Hukuman Penjara:** Dijebloskan ke **sel selama 10 jam**!`
          );

          await iAlarm.update({ embeds: [caughtEmb], components: [] }).catch(() => {});
        });

        alarmCollector.on('end', async () => {
          if (!caught) {
            const disabledRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`rob_alarm_catch_${author.id}_${targetUser.id}`)
                .setLabel('Waktu Habis!')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true)
            );
            await alarmMsg.edit({ components: [disabledRow] }).catch(() => {});

            // Lanjutkan perampokan
            await executeRobberyAction();
          }
        });
      } else {
        await executeRobberyAction();
      }

      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah: .arrest @user
    // ═══════════════════════════════════════════════════
    if (commandName === 'arrest') {
      const targetUser = message.mentions.users.first();
      if (!targetUser) {
        return message.reply({ embeds: [embeds.errorEmbed('Format Salah!', 'Gunakan: \`.arrest @user\` untuk menangkap buronan.')] });
      }
      const targetMember = message.mentions.members?.first();
      try {
        const res = robbery.arrestBuronan(author.id, targetUser.id, guildId, message.member);
        if (res.success) {
          const successEmb = embeds.successEmbed(
            '👮 Buronan Berhasil Ditangkap! 🚨',
            `Luar biasa, Pemburu! <@${author.id}> berhasil meringkus buronan <@${targetUser.id}>!\n\n` +
            `🪙 **Bounty Didapat:** **Rp ${res.bounty.toLocaleString('id-ID')}** (Koin hadiah bounty masuk dompet Anda)\n` +
            `🔒 **Masa Tahanan:** Pelaku langsung dimasukkan ke **sel tahanan selama 3 jam**!${res.hasHandcuffs ? '\n👮 *Anda menggunakan Borgol / Handcuffs (+20% success rate)!*' : ''}`
          );
          await message.reply({ embeds: [successEmb] });
        } else {
          let failMsg = '';
          if (res.petDamaged) {
            failMsg = `Buronan melawan dengan sengit dan kabur! Pet aktif Anda **${res.petName}** terluka dan HP-nya berkurang **-20** (HP Tersisa: \`${res.petHpLeft}\`).`;
          } else {
            failMsg = `Buronan melawan dengan sengit dan kabur! Karena Anda tidak memiliki pet aktif yang sehat untuk bertarung, Anda didenda **Rp ${res.fineAmount}** yang langsung ditransfer ke buronan sebagai ganti rugi!`;
          }
          const failEmb = embeds.errorEmbed(
            '👮 Gagal Menangkap Buronan! 💨',
            failMsg + (res.hasHandcuffs ? '\n👮 *Meskipun menggunakan Borgol, buronan tetap berhasil lolos!*' : '')
          );
          await message.reply({ embeds: [failEmb] });
        }
      } catch (err) {
        await message.reply({ embeds: [embeds.errorEmbed('Penangkapan Gagal!', err.message)] });
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
          const durationSeconds = 90;
          const endTimeUnix = Math.floor((Date.now() + durationSeconds * 1000) / 1000);

          const lobby = robbery.startHeistLobby(author.id, guildId);
          const stats = robbery.getHeistStats(1);

          const lobbyEmbed = embeds.heistLobbyEmbed(
            guild,
            author,
            lobby.participants,
            endTimeUnix,
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

          const heistLoadingImg = new AttachmentBuilder('./assets/heist_loading.png', { name: 'heist_loading.png' });
          const replyMsg = await message.reply({
            content: `🚨 **OPERASI PERAMPOKAN BANK DIMULAI!** 🚨`,
            embeds: [lobbyEmbed],
            components: [row],
            files: [heistLoadingImg]
          });

          // Helper function to shuffle array elements
          function shuffleArray(array) {
            const shuffled = [...array];
            for (let i = shuffled.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            return shuffled;
          }

          // Pemicu timeout eksekusi otomatis setelah 90 detik
          lobby.timeout = setTimeout(async () => {
            try {
              const currentLobby = robbery.activeHeists.get(guildId);
              if (!currentLobby) return;

              // ⭐ LOADING SCREEN: Animasi transisi peretasan bank sebelum aksi dimulai
              const lobbyLoadingImg = new AttachmentBuilder('./assets/heist_loading.png', { name: 'heist_loading.png' });
              const loadingEmbed = embeds.heistLoadingEmbed(author, currentLobby.participants);
              await replyMsg.edit({
                embeds: [loadingEmbed],
                components: [],
                files: [lobbyLoadingImg]
              }).catch(() => {});
              await new Promise(r => setTimeout(r, 3000)); // Loading screen selama 3 detik

              const participants = currentLobby.participants;
              const kruCount = participants.length;

              // Rantai aksi berurutan berdasarkan jumlah kru
              const steps = [];

              if (kruCount <= 4) {
                // If 4 or fewer players, every participant gets exactly 3 turns, randomized order
                const turnUsers = [];
                participants.forEach(p => {
                  turnUsers.push(p, p, p);
                });
                const shuffledTurns = shuffleArray(turnUsers);

                // Step 1: Hacker (shuffledTurns[0])
                steps.push({
                  roleName: 'Hacker',
                  title: '💻 Peretas Keamanan (Hacker)',
                  desc: '💻 **Tugas:** Bobol firewall bank! Tekan tombol di bawah untuk melumpuhkan sistem alarm digital.',
                  buttonLabel: '💻 Jalankan Hack',
                  buttonId: 'heist_qte_hacker',
                  targetUserId: shuffledTurns[0]
                });

                // Middle Steps: shuffledTurns[1] to shuffledTurns[shuffledTurns.length - 2]
                const middleRoles = [
                  {
                    roleName: 'Peledak',
                    title: '🧨 Ahli Peledak (Demolition)',
                    desc: '🧨 **Tugas:** Pasang dan ledakkan thermite di pintu brankas utama! Tekan tombol di bawah untuk meledakkan pintu.',
                    buttonLabel: '🧨 Ledakkan Pintu',
                    buttonId: 'heist_qte_peledak'
                  },
                  {
                    roleName: 'Eksekutor',
                    title: '🔫 Jaga Sandera (Enforcer)',
                    desc: '🔫 **Tugas:** Jaga sandera dan lumpuhkan petugas keamanan yang mencoba melawan! Tekan tombol di bawah untuk menembak.',
                    buttonLabel: '🔫 Lumpuhkan Penjaga',
                    buttonId: 'heist_qte_enforcer'
                  },
                  {
                    roleName: 'Lockpicker',
                    title: '🗝️ Ahli Cungkil Brankas (Lockpicker)',
                    desc: '🗝️ **Tugas:** Cungkil laci emas tambahan dan isi tas jarahan! Tekan tombol di bawah untuk membobol kunci.',
                    buttonLabel: '🗝️ Bobol Laci Emas',
                    buttonId: 'heist_qte_lockpicker'
                  },
                  {
                    roleName: 'Spotter',
                    title: '🚁 Pemantau Lapangan (Spotter)',
                    desc: '🚁 **Tugas:** Pantau pergerakan patroli polisi dari atas helikopter! Tekan tombol di bawah untuk memberikan rute aman.',
                    buttonLabel: '🚁 Berikan Rute Aman',
                    buttonId: 'heist_qte_spotter'
                  },
                  {
                    roleName: 'Cleaner',
                    title: '🧼 Pembersih TKP (Cleaner)',
                    desc: '🧼 **Tugas:** Bersihkan sidik jari dan barang bukti di TKP! Tekan tombol di bawah untuk menyeka jejak.',
                    buttonLabel: '🧼 Bersihkan Jejak',
                    buttonId: 'heist_qte_cleaner'
                  },
                  {
                    roleName: 'Decoy',
                    title: '💨 Pengalih Perhatian (Decoy)',
                    desc: '💨 **Tugas:** Ledakkan bom asap di lobi depan untuk mengalihkan perhatian polisi! Tekan tombol di bawah untuk melempar asap.',
                    buttonLabel: '💨 Lempar Bom Asap',
                    buttonId: 'heist_qte_decoy'
                  },
                  {
                    roleName: 'Bagman',
                    title: '👜 Pengangkut Jarahan (Bagman)',
                    desc: '👜 **Tugas:** Angkut kantong koin jarahan ke bagasi mobil dengan cepat! Tekan tombol di bawah untuk melempar tas.',
                    buttonLabel: '👜 Lempar Tas Jarahan',
                    buttonId: 'heist_qte_bagman'
                  },
                  {
                    roleName: 'Negotiator',
                    title: '📞 Negosiator Sandera (Negotiator)',
                    desc: '📞 **Tugas:** Berbicara di telepon dengan kepolisian untuk mengulur waktu pelarian! Tekan tombol di bawah untuk bernegosiasi.',
                    buttonLabel: '📞 Ulur Waktu',
                    buttonId: 'heist_qte_negotiator'
                  }
                ];

                const shuffledMiddleRoles = shuffleArray(middleRoles);

                for (let i = 1; i < shuffledTurns.length - 1; i++) {
                  const roleTemplate = shuffledMiddleRoles[(i - 1) % shuffledMiddleRoles.length];
                  steps.push({
                    ...roleTemplate,
                    targetUserId: shuffledTurns[i]
                  });
                }

                // Step N: Supir (shuffledTurns[shuffledTurns.length - 1])
                steps.push({
                  roleName: 'Supir',
                  title: '🚗 Pembalap Pelarian (Driver)',
                  desc: '🚗 **Tugas:** Polisi datang mengepung! Tancap gas dan bawa kabur uang jarahannya! Tekan tombol di bawah untuk tancap gas.',
                  buttonLabel: '🚗 Tancap Gas',
                  buttonId: 'heist_qte_driver',
                  targetUserId: shuffledTurns[shuffledTurns.length - 1]
                });
              } else {
                // Multiplayer heist (kruCount > 4): 1 step per participant, randomized sequence
                const shuffledParticipants = shuffleArray(participants);

                // Step 1: Hacker (shuffledParticipants[0])
                steps.push({
                  roleName: 'Hacker',
                  title: '💻 Peretas Keamanan (Hacker)',
                  desc: '💻 **Tugas:** Bobol firewall bank! Tekan tombol di bawah untuk melumpuhkan sistem alarm digital.',
                  buttonLabel: '💻 Jalankan Hack',
                  buttonId: 'heist_qte_hacker',
                  targetUserId: shuffledParticipants[0]
                });

                // Middle Steps: shuffledParticipants[1] to shuffledParticipants[kruCount - 2]
                const middleRoles = [
                  {
                    roleName: 'Peledak',
                    title: '🧨 Ahli Peledak (Demolition)',
                    desc: '🧨 **Tugas:** Pasang dan ledakkan thermite di pintu brankas utama! Tekan tombol di bawah untuk meledakkan pintu.',
                    buttonLabel: '🧨 Ledakkan Pintu',
                    buttonId: 'heist_qte_peledak'
                  },
                  {
                    roleName: 'Eksekutor',
                    title: '🔫 Jaga Sandera (Enforcer)',
                    desc: '🔫 **Tugas:** Jaga sandera dan lumpuhkan petugas keamanan yang mencoba melawan! Tekan tombol di bawah untuk menembak.',
                    buttonLabel: '🔫 Lumpuhkan Penjaga',
                    buttonId: 'heist_qte_enforcer'
                  },
                  {
                    roleName: 'Lockpicker',
                    title: '🗝️ Ahli Cungkil Brankas (Lockpicker)',
                    desc: '🗝️ **Tugas:** Cungkil laci emas tambahan dan isi tas jarahan! Tekan tombol di bawah untuk membobol kunci.',
                    buttonLabel: '🗝️ Bobol Laci Emas',
                    buttonId: 'heist_qte_lockpicker'
                  },
                  {
                    roleName: 'Spotter',
                    title: '🚁 Pemantau Lapangan (Spotter)',
                    desc: '🚁 **Tugas:** Pantau pergerakan patroli polisi dari atas helikopter! Tekan tombol di bawah untuk memberikan rute aman.',
                    buttonLabel: '🚁 Berikan Rute Aman',
                    buttonId: 'heist_qte_spotter'
                  },
                  {
                    roleName: 'Cleaner',
                    title: '🧼 Pembersih TKP (Cleaner)',
                    desc: '🧼 **Tugas:** Bersihkan sidik jari dan barang bukti di TKP! Tekan tombol di bawah untuk menyeka jejak.',
                    buttonLabel: '🧼 Bersihkan Jejak',
                    buttonId: 'heist_qte_cleaner'
                  },
                  {
                    roleName: 'Decoy',
                    title: '💨 Pengalih Perhatian (Decoy)',
                    desc: '💨 **Tugas:** Ledakkan bom asap di lobi depan untuk mengalihkan perhatian polisi! Tekan tombol di bawah untuk melempar asap.',
                    buttonLabel: '💨 Lempar Bom Asap',
                    buttonId: 'heist_qte_decoy'
                  },
                  {
                    roleName: 'Bagman',
                    title: '👜 Pengangkut Jarahan (Bagman)',
                    desc: '👜 **Tugas:** Angkut kantong koin jarahan ke bagasi mobil dengan cepat! Tekan tombol di bawah untuk melempar tas.',
                    buttonLabel: '👜 Lempar Tas Jarahan',
                    buttonId: 'heist_qte_bagman'
                  },
                  {
                    roleName: 'Negotiator',
                    title: '📞 Negosiator Sandera (Negotiator)',
                    desc: '📞 **Tugas:** Berbicara di telepon dengan kepolisian untuk mengulur waktu pelarian! Tekan tombol di bawah untuk bernegosiasi.',
                    buttonLabel: '📞 Ulur Waktu',
                    buttonId: 'heist_qte_negotiator'
                  }
                ];

                const shuffledMiddleRoles = shuffleArray(middleRoles);

                for (let i = 1; i < kruCount - 1; i++) {
                  const roleTemplate = shuffledMiddleRoles[(i - 1) % shuffledMiddleRoles.length];
                  steps.push({
                    ...roleTemplate,
                    targetUserId: shuffledParticipants[i]
                  });
                }

                // Step N: Supir (shuffledParticipants[kruCount - 1])
                steps.push({
                  roleName: 'Supir',
                  title: '🚗 Pembalap Pelarian (Driver)',
                  desc: '🚗 **Tugas:** Polisi datang mengepung! Tancap gas dan bawa kabur uang jarahannya! Tekan tombol di bawah untuk tancap gas.',
                  buttonLabel: '🚗 Tancap Gas',
                  buttonId: 'heist_qte_driver',
                  targetUserId: shuffledParticipants[kruCount - 1]
                });
              }

              let isHeistFailed = false;

              for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
                const step = steps[stepIdx];
                const stepNumber = stepIdx + 1;
                const qteDuration = 6;
                const endTimeQteUnix = Math.floor((Date.now() + qteDuration * 1000) / 1000);

                const stepEmbed = embeds.heistStepEmbed(
                  guild,
                  stepNumber,
                  steps.length,
                  step.title,
                  step.desc,
                  step.targetUserId,
                  endTimeQteUnix
                );

                const stepRow = new ActionRowBuilder().addComponents(
                  new ButtonBuilder()
                    .setCustomId(step.buttonId)
                    .setLabel(step.buttonLabel)
                    .setStyle(ButtonStyle.Danger)
                );

                  const stepLoadingImg = new AttachmentBuilder('./assets/heist_loading.png', { name: 'heist_loading.png' });
                  await replyMsg.edit({
                    content: `🚨 **TAHAPAN ${stepNumber}/${steps.length} SEDANG BERJALAN!**`,
                    embeds: [stepEmbed],
                    components: [stepRow],
                    files: [stepLoadingImg]
                  }).catch(() => {});

                // Buat collector QTE selama 6 detik
                const qteCollector = replyMsg.createMessageComponentCollector({
                  time: qteDuration * 1000
                });

                let stepSuccess = false;

                const qtePromise = new Promise((resolveQte) => {
                  qteCollector.on('collect', async iQte => {
                    try {
                      // Cek apakah pengklik adalah target yang benar
                      if (iQte.user.id === step.targetUserId) {
                        stepSuccess = true;
                        qteCollector.stop('success');
                        await iQte.reply({ content: `✅ Sukses! Langkah ${stepNumber} diselesaikan dengan cepat.`, flags: 64 });
                        resolveQte();
                      } 
                      // Cek apakah pengklik adalah peserta heist lain (Interference Instafail!)
                      else if (participants.includes(iQte.user.id)) {
                        isHeistFailed = true;
                        qteCollector.stop('interference');
                        
                        // Heist gagal instan karena salah klik
                        const res = robbery.executeHeistQteFailure(guildId, iQte.user.id, 'Interference');
                        const failEmbed = embeds.heistQteFailureEmbed(guild, iQte.user.id, 'Interference', participants);
                        const failLoadingImg = new AttachmentBuilder('./assets/heist_loading.png', { name: 'heist_loading.png' });
                        
                        await iQte.reply({ content: `🚨 Anda memicu alarm karena menekan tombol di luar giliran!`, flags: 64 });
                        await replyMsg.edit({
                          content: `❌ **HEIST GAGAL: OPERASI DIGAGALKAN OLEH KRU!**`,
                          embeds: [failEmbed],
                          components: [],
                          files: [failLoadingImg]
                        }).catch(() => {});
                        
                        resolveQte();
                      } 
                      // Pengklik bukan peserta heist
                      else {
                        await iQte.reply({ content: `❌ Anda tidak berpartisipasi dalam perampokan ini!`, flags: 64 });
                      }
                    } catch (err) {
                      console.error(err);
                      resolveQte();
                    }
                  });

                  qteCollector.on('end', async (collected, reason) => {
                    if (reason === 'success' || reason === 'interference') {
                      return;
                    }
                    // Jika waktu habis (6 detik) dan tidak ditekan
                    if (!stepSuccess && !isHeistFailed) {
                      isHeistFailed = true;
                      
                      const res = robbery.executeHeistQteFailure(guildId, step.targetUserId, 'Timeout');
                      const failEmbed = embeds.heistQteFailureEmbed(guild, step.targetUserId, 'Timeout', participants);
                      const failLoadingImg = new AttachmentBuilder('./assets/heist_loading.png', { name: 'heist_loading.png' });
                      
                      await replyMsg.edit({
                        content: `❌ **HEIST GAGAL: WAKTU REAKSI TIM HABIS!**`,
                        embeds: [failEmbed],
                        components: [],
                        files: [failLoadingImg]
                      }).catch(() => {});
                    }
                    resolveQte();
                  });
                });

                await qtePromise;
                if (isHeistFailed) {
                  break;
                }

                // Beri jeda singkat 1 detik antar tahapan
                await new Promise(r => setTimeout(r, 1000));
              }

              // Jika seluruh tahapan QTE sukses dilewati tanpa kegagalan
              if (!isHeistFailed) {
                const res = robbery.executeHeist(guildId);

                const resultEmbed = embeds.heistResultEmbed(
                  guild,
                  res.success,
                  res.participants,
                  res.logs,
                  res.totalReward,
                  res.rewardPerPerson,
                  res.fineAmount,
                  res.jailHours,
                  res.stolenFromPlayers,
                  res.deductionLogs,
                  res
                );

                let contentMsg = `💥 **OPERASI BANK HEIST SELESAI!**`;
                if (!res.success && res.soapUsedUsers && res.soapUsedUsers.length > 0) {
                  const mentions = res.soapUsedUsers.map(u => `<@${u}>`).join(', ');
                  contentMsg += `\n🧼 **Sabun Licin Terpakai!** ${mentions} menggunakan Sabun Licin untuk memotong waktu penjara heist sebesar 50%!`;
                }

                  const resultLoadingImg = new AttachmentBuilder('./assets/heist_loading.png', { name: 'heist_loading.png' });
                  await replyMsg.edit({
                    content: contentMsg,
                    embeds: [resultEmbed],
                    components: [],
                    files: [resultLoadingImg]
                  }).catch(async () => {
                    await message.channel.send({
                      content: contentMsg,
                      embeds: [resultEmbed],
                      files: [resultLoadingImg]
                    });
                  });
              }

            } catch (err) {
              console.error(err);
              await message.channel.send({ content: `❌ Gagal mengeksekusi heist: ${err.message}` });
            }
          }, 90000);

          // Collector untuk tombol interaksi lobi
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
                  endTimeUnix,
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

                clearTimeout(lobby.timeout);
                robbery.cancelHeistLobby(author.id, guildId);

                await iHeist.reply({ content: '✖️ Operasi bank heist dibatalkan dan biaya persiapan telah dikembalikan ke seluruh kru.' });
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

        } catch (err) {
          await message.reply({ embeds: [embeds.errorEmbed('Gagal Memulai Heist!', err.message)] });
        }
      }
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah: .jail
    // ═══════════════════════════════════════════════════
    if (['jail', 'topjail', 'top-jail', 'jailtop', 'jail-top'].includes(commandName)) {
      if (['topjail', 'top-jail', 'jailtop', 'jail-top'].includes(commandName) || args[0] === 'top' || args[0] === 'leaderboard') {
        const topJail = database.all(
          `SELECT user_id, jail_count FROM wallets 
           WHERE guild_id = ? AND jail_count > 0 
           ORDER BY jail_count DESC LIMIT 10`,
          [guildId]
        );

        if (topJail.length === 0) {
          const emptyEmbed = embeds.successEmbed(
            'Papan Peringkat Penjara 👮',
            '🟢 **Keamanan Terjamin!** Belum ada warga server yang pernah dijebloskan ke dalam penjara virtual.'
          );
          return message.reply({ embeds: [emptyEmbed] });
        }

        let desc = '🚨 **BURONAN KELAS KAKAP & REKOR SEL TAHANAN** 🔒\n';
        desc += '`==========================================`\n\n';
        for (let i = 0; i < topJail.length; i++) {
          const row = topJail[i];
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `\`#${i + 1}\``;
          const reason = getFunnyArrestReason(row.user_id);
          desc += `${medal} ┃ <@${row.user_id}>\n`;
          desc += `┗ 👮 **${row.jail_count}x Masuk Tahanan**\n`;
          desc += `┗ 💬 *"${reason}"*\n\n`;
        }
        desc += '`==========================================`\n';
        desc += '👉 *Selalu patuhi hukum server atau Anda berakhir di daftar ini!*';

        const topJailEmbed = new EmbedBuilder()
          .setColor(0xC0392B) // Crimson warning red
          .setTitle('🕵️‍♂️ PAPAN BURONAN: NARAPIDANA PALING SERING DIPENJARA! 🔒')
          .setThumbnail('https://cdn-icons-png.flaticon.com/512/3037/3037233.png')
          .setDescription(desc)
          .setFooter({ text: `Klasemen Buronan Server ${message.guild.name} • Total Narapidana: ${topJail.length}`, iconURL: message.guild.iconURL({ dynamic: true }) || null })
          .setTimestamp();

        return message.reply({ embeds: [topJailEmbed] });
      }

      const targetUser = message.mentions.users.first() || author;
      const targetMember = message.mentions.members?.first() || message.member;
      const jailInfo = robbery.checkJail(targetUser.id, guildId, targetMember);

      if (!jailInfo.jailed) {
        return message.reply({ embeds: [embeds.successEmbed('Status Penjara', `🟢 **${targetUser.username}** bebas berkeliaran dan tidak sedang di penjara!`)] });
      }

      const jailEmbed = embeds.jailStatusEmbed(targetUser, jailInfo.remaining, jailInfo.bailAmount, jailInfo.jailType);

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

          await handleBailFriendProposal(iJail, targetUser, iJail.user, jailInfo.bailAmount, replyMsg, collector);
          return;
        }

        if (iJail.customId === 'jail_btn_tebus_status') {
          if (iJail.user.id !== targetUser.id) {
            return iJail.reply({ content: '❌ Tombol ini hanya untuk tahanan yang bersangkutan!', flags: 64 });
          }

          try {
            const res = robbery.payBail(targetUser.id, guildId, targetMember);
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
        const debts = database.all('SELECT creditor_id, amount FROM bail_debts WHERE debtor_id = ? AND guild_id = ?', [userId, guildId]);
        const hasFriendDebts = debts && debts.length > 0;

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
            .setDisabled(!activeLoan && !hasFriendDebts),
          new ButtonBuilder()
            .setCustomId('bank_btn_transfer')
            .setLabel('💸 Transfer')
            .setStyle(ButtonStyle.Primary)
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
            if (robbery.activeHeists.has(guildId)) {
              return iBank.reply({ embeds: [embeds.bankLockdownEmbed(iBank.guild)], flags: 64 });
            }
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
                if (!submitted.replied && !submitted.deferred) {
                  await submitted.reply({ embeds: [embeds.bankErrorEmbed('Deposit Gagal!', err.message)] }).catch(() => { });
                } else {
                  console.error('Error updating bank dashboard after deposit:', err);
                }
              }
            }
          }

          else if (iBank.customId === 'bank_btn_withdraw') {
            if (robbery.activeHeists.has(guildId)) {
              return iBank.reply({ embeds: [embeds.bankLockdownEmbed(iBank.guild)], flags: 64 });
            }
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
                if (!submitted.replied && !submitted.deferred) {
                  await submitted.reply({ embeds: [embeds.bankErrorEmbed('Penarikan Gagal!', err.message)] }).catch(() => { });
                } else {
                  console.error('Error updating bank dashboard after withdraw:', err);
                }
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

            await iBank.reply({
              content: '💡 **PILIH JANGKA TEMPO PINJAMAN (TENOR)**\nSilakan pilih jangka waktu pengembalian utang di bawah ini:',
              components: [tenorRow, cancelRow]
            });
            const askTenorMsg = await iBank.fetchReply();

            const tenorCollector = askTenorMsg.createMessageComponentCollector({
              time: 60000
            });

            tenorCollector.on('collect', async iTenor => {
              if (iTenor.user.id !== author.id) {
                return iTenor.reply({ content: '❌ Pilihan ini bukan untuk Anda!', flags: 64 });
              }

              if (iTenor.customId === 'bank_loan_cancel') {
                tenorCollector.stop('cancel');
                await iTenor.update({ content: '❌ Pengajuan pinjaman dibatalkan.', components: [] });
              } else if (iTenor.customId === 'bank_select_tenor') {
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

                const submitted = await iTenor.awaitModalSubmit({
                  filter: (sub) => sub.customId === `bank_modal_loan_${selectedTenor}` && sub.user.id === author.id,
                  time: 60000
                }).catch(() => null);

                if (submitted) {
                  tenorCollector.stop('submitted');
                  await askTenorMsg.delete().catch(() => { });
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
                    if (!submitted.replied && !submitted.deferred) {
                      await submitted.reply({ embeds: [embeds.bankErrorEmbed('Pinjaman Ditolak!', err.message)] }).catch(() => { });
                    } else {
                      console.error('Error updating bank dashboard after loan:', err);
                    }
                  }
                } else {
                  tenorCollector.stop('timeout');
                }
              }
            });

            tenorCollector.on('end', async (collected, reason) => {
              if (reason !== 'submitted' && reason !== 'cancel') {
                await askTenorMsg.delete().catch(() => { });
              }
            });
          }

          else if (iBank.customId === 'bank_btn_repay') {
            try {
              const activeLoan = bank.getActiveLoan(author.id, guildId);
              const debts = database.all('SELECT creditor_id, amount FROM bail_debts WHERE debtor_id = ? AND guild_id = ?', [author.id, guildId]);
              const hasFriendDebts = debts && debts.length > 0;

              const handleFriendRepayFlow = async (iSelectRepay) => {
                const friendDebts = database.all('SELECT creditor_id, amount FROM bail_debts WHERE debtor_id = ? AND guild_id = ?', [author.id, guildId]);
                if (!friendDebts || friendDebts.length === 0) {
                  return iSelectRepay.reply({ content: '❌ Anda tidak memiliki hutang tebusan ke teman.', flags: 64 });
                }

                const selectMenu = new StringSelectMenuBuilder()
                  .setCustomId('bank_repay_friend_menu')
                  .setPlaceholder('👉 Pilih teman yang ingin Anda bayar...');

                for (const d of friendDebts) {
                  let displayName = d.creditor_id;
                  try {
                    const member = await iSelectRepay.guild.members.fetch(d.creditor_id).catch(() => null);
                    if (member) displayName = member.displayName;
                  } catch (err) {}

                  selectMenu.addOptions(
                    new StringSelectMenuOptionBuilder()
                      .setLabel(`👥 ${displayName}`)
                      .setDescription(`Sisa Hutang: Rp ${d.amount.toLocaleString('id-ID')}`)
                      .setValue(d.creditor_id)
                  );
                }

                const cancelBtn = new ButtonBuilder().setCustomId('bank_repay_friend_cancel').setLabel('✖️ Batalkan').setStyle(ButtonStyle.Secondary);
                
                const rowMenu = new ActionRowBuilder().addComponents(selectMenu);
                const rowBtn = new ActionRowBuilder().addComponents(cancelBtn);

                const askFriendMsg = iSelectRepay.replied || iSelectRepay.deferred
                  ? await iSelectRepay.followUp({ content: '👥 **PILIH TEMAN TARGET PEMBAYARAN**\nSilakan pilih teman yang dihutangi dari menu di bawah:', components: [rowMenu, rowBtn] })
                  : await iSelectRepay.reply({ content: '👥 **PILIH TEMAN TARGET PEMBAYARAN**\nSilakan pilih teman yang dihutangi dari menu di bawah:', components: [rowMenu, rowBtn], fetchReply: true });


                const friendCollector = askFriendMsg.createMessageComponentCollector({ time: 60000 });

                friendCollector.on('collect', async iFriend => {
                  if (iFriend.user.id !== author.id) return;
                  friendCollector.stop();

                  if (iFriend.customId === 'bank_repay_friend_cancel') {
                    await iFriend.update({ content: '❌ Pembayaran dibatalkan.', components: [] });
                  } else if (iFriend.customId === 'bank_repay_friend_menu') {
                    const creditorId = iFriend.values[0];
                    const specificDebt = database.get('SELECT amount FROM bail_debts WHERE guild_id = ? AND debtor_id = ? AND creditor_id = ?', [guildId, author.id, creditorId]);
                    if (!specificDebt) {
                      return iFriend.reply({ content: '❌ Hutang ke user tersebut tidak ditemukan.', flags: 64 });
                    }

                    const modal = new ModalBuilder()
                      .setCustomId(`bank_modal_repay_friend_${creditorId}`)
                      .setTitle('💳 Bayar Hutang Teman');

                    const amountInput = new TextInputBuilder()
                      .setCustomId('repay_amount')
                      .setLabel(`Jumlah bayar (Hutang: Rp ${specificDebt.amount.toLocaleString('id-ID')})`)
                      .setPlaceholder('Contoh: 1000 atau all')
                      .setStyle(TextInputStyle.Short)
                      .setRequired(true);

                    modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
                    await iFriend.showModal(modal);
                    await askFriendMsg.delete().catch(() => {});

                    const submitted = await iFriend.awaitModalSubmit({
                      filter: (sub) => sub.customId === `bank_modal_repay_friend_${creditorId}` && sub.user.id === author.id,
                      time: 60000
                    }).catch(() => null);

                    if (submitted) {
                      try {
                        const amountStr = submitted.fields.getTextInputValue('repay_amount');
                        const res = bank.repayFriendDebt(author.id, creditorId, guildId, amountStr);

                        let creditorName = creditorId;
                        try {
                          const credMember = await submitted.guild.members.fetch(creditorId).catch(() => null);
                          if (credMember) creditorName = credMember.displayName;
                        } catch (err) {}

                        let desc = '';
                        if (res.isFullyPaid) {
                          desc = `Selamat! Hutang tebusan Anda kepada **${creditorName}** telah **LUNAS SEPENUHNYA**.\n\n` +
                            `💳 **Koin Dibayarkan:** **Rp ${res.amountPaid.toLocaleString('id-ID')}**\n` +
                            `💵 **Sisa Saldo Dompet:** **Rp ${res.walletBalance.toLocaleString('id-ID')}**`;
                        } else {
                          desc = `Pembayaran cicilan hutang teman berhasil diproses.\n\n` +
                            `💳 **Koin Dibayarkan:** **Rp ${res.amountPaid.toLocaleString('id-ID')}**\n` +
                            `⚠️ **Sisa Hutang Ke ${creditorName}:** **Rp ${res.remainingDebt.toLocaleString('id-ID')}**\n` +
                            `💵 **Sisa Saldo Dompet:** **Rp ${res.walletBalance.toLocaleString('id-ID')}**`;
                        }

                        await submitted.reply({ embeds: [embeds.bankSuccessEmbed('Pembayaran Hutang Berhasil!', desc)] });
                        const freshData = getBankDashboardData(author.id, guildId);
                        await replyMsg.edit(freshData).catch(console.error);
                      } catch (err) {
                        await submitted.reply({ embeds: [embeds.bankErrorEmbed('Pembayaran Gagal!', err.message)] });
                      }
                    }
                  }
                });
              };

              if (activeLoan && hasFriendDebts) {
                // Tampilkan pilihan jenis hutang
                const choiceBank = new ButtonBuilder().setCustomId('bank_repay_choice_bank').setLabel('🏛️ Pinjaman Bank').setStyle(ButtonStyle.Primary);
                const choiceFriend = new ButtonBuilder().setCustomId('bank_repay_choice_friend').setLabel('👥 Hutang Teman').setStyle(ButtonStyle.Success);
                const choiceCancel = new ButtonBuilder().setCustomId('bank_repay_choice_cancel').setLabel('✖️ Batalkan').setStyle(ButtonStyle.Secondary);
                
                const askChoiceMsg = await iBank.reply({
                  content: '❓ **PILIH UTANG YANG AKAN DIBAYAR**\nAnda memiliki pinjaman bank aktif dan hutang tebusan ke teman. Mana yang ingin Anda bayar?',
                  components: [new ActionRowBuilder().addComponents(choiceBank, choiceFriend, choiceCancel)],
                  fetchReply: true
                });


                const choiceCollector = askChoiceMsg.createMessageComponentCollector({ time: 60000 });

                choiceCollector.on('collect', async iChoice => {
                  if (iChoice.user.id !== author.id) return;
                  choiceCollector.stop();

                  if (iChoice.customId === 'bank_repay_choice_cancel') {
                    await iChoice.update({ content: '❌ Pembayaran dibatalkan.', components: [] });
                  } else if (iChoice.customId === 'bank_repay_choice_bank') {
                    // Jalankan pelunasan bank
                    try {
                      const res = bank.repayLoan(author.id, guildId);
                      let desc = '';
                      if (res.isFullyPaid) {
                        desc = `Selamat! Utang pinjaman Anda telah **LUNAS SEPENUHNYA**.\n\n` +
                          `💳 **Dibayarkan:** **Rp ${res.amountPaid.toLocaleString('id-ID')}**\n` +
                          `💵 **Sisa Saldo Dompet:** **Rp ${res.walletBalance.toLocaleString('id-ID')}**`;
                      } else {
                        desc = `Pembayaran utang berhasil diproses sebagian.\n\n` +
                          `💳 **Dibayarkan:** **Rp ${res.amountPaid.toLocaleString('id-ID')}**\n` +
                          `⚠️ **Sisa Hutang:** **Rp ${res.remainingDebt.toLocaleString('id-ID')}**\n` +
                          `💵 **Sisa Saldo Dompet:** **Rp ${res.walletBalance.toLocaleString('id-ID')}**`;
                      }
                      await iChoice.update({ embeds: [embeds.bankSuccessEmbed('Pembayaran Berhasil!', desc)], content: null, components: [] });
                      const freshData = getBankDashboardData(author.id, guildId);
                      await replyMsg.edit(freshData).catch(console.error);
                    } catch (err) {
                      await iChoice.update({ embeds: [embeds.bankErrorEmbed('Pembayaran Gagal!', err.message)], content: null, components: [] });
                    }
                  } else if (iChoice.customId === 'bank_repay_choice_friend') {
                    // Lanjut ke pemilihan teman
                    await handleFriendRepayFlow(iChoice);
                  }
                });
              } else if (activeLoan) {
                // Langsung bayar pinjaman bank
                const res = bank.repayLoan(author.id, guildId);
                let desc = '';
                if (res.isFullyPaid) {
                  desc = `Selamat! Utang pinjaman Anda telah **LUNAS SEPENUHNYA**.\n\n` +
                    `💳 **Dibayarkan:** **Rp ${res.amountPaid.toLocaleString('id-ID')}**\n` +
                    `💵 **Sisa Saldo Dompet:** **Rp ${res.walletBalance.toLocaleString('id-ID')}**`;
                } else {
                  desc = `Pembayaran utang berhasil diproses sebagian.\n\n` +
                    `💳 **Dibayarkan:** **Rp ${res.amountPaid.toLocaleString('id-ID')}**\n` +
                    `⚠️ **Sisa Hutang:** **Rp ${res.remainingDebt.toLocaleString('id-ID')}**\n` +
                    `💵 **Sisa Saldo Dompet:** **Rp ${res.walletBalance.toLocaleString('id-ID')}**`;
                }
                await iBank.reply({ embeds: [embeds.bankSuccessEmbed('Pembayaran Berhasil!', desc)] });
                const freshData = getBankDashboardData(author.id, guildId);
                await replyMsg.edit(freshData).catch(console.error);
              } else if (hasFriendDebts) {
                // Langsung bayar hutang teman
                await handleFriendRepayFlow(iBank);
              }
            } catch (err) {
              if (!iBank.replied && !iBank.deferred) {
                await iBank.reply({ embeds: [embeds.bankErrorEmbed('Pembayaran Gagal!', err.message)] });
              } else {
                console.error(err);
              }
            }
          }

          else if (iBank.customId === 'bank_btn_transfer') {
            const userSelect = new UserSelectMenuBuilder()
              .setCustomId('bank_transfer_select_target')
              .setPlaceholder('👤 Pilih Target Penerima Transfer');

            const rowMenu = new ActionRowBuilder().addComponents(userSelect);
            const cancelBtn = new ButtonBuilder().setCustomId('bank_transfer_cancel').setLabel('✖️ Batalkan').setStyle(ButtonStyle.Secondary);
            const rowBtn = new ActionRowBuilder().addComponents(cancelBtn);

            const askTransferMsg = await iBank.reply({
              content: '💸 **TRANSFER TABUNGAN BANK**\nSilakan pilih anggota target penerima transfer tabungan bank di bawah ini:',
              components: [rowMenu, rowBtn],
              fetchReply: true
            });


            const transferCollector = askTransferMsg.createMessageComponentCollector({ time: 60000 });

            transferCollector.on('collect', async iSelect => {
              if (iSelect.user.id !== author.id) return;
              transferCollector.stop();

              if (iSelect.customId === 'bank_transfer_cancel') {
                await iSelect.update({ content: '❌ Transfer dibatalkan.', components: [] });
              } else if (iSelect.customId === 'bank_transfer_select_target') {
                const targetUserId = iSelect.values[0];
                if (targetUserId === author.id) {
                  return iSelect.reply({ content: '❌ Anda tidak bisa mentransfer ke diri sendiri!', flags: 64 });
                }

                const typeButtons = new ActionRowBuilder().addComponents(
                  new ButtonBuilder().setCustomId(`bank_tf_biasa_${targetUserId}`).setLabel('💸 Transfer Biasa').setStyle(ButtonStyle.Primary),
                  new ButtonBuilder().setCustomId(`bank_tf_bayar_${targetUserId}`).setLabel('📉 Bayar Hutang').setStyle(ButtonStyle.Success),
                  new ButtonBuilder().setCustomId(`bank_tf_beri_${targetUserId}`).setLabel('📈 Beri Hutang (Pinjamkan)').setStyle(ButtonStyle.Secondary),
                  new ButtonBuilder().setCustomId('bank_tf_cancel').setLabel('✖️ Batal').setStyle(ButtonStyle.Danger)
                );

                await iSelect.update({
                  content: `👉 **Pilih tipe transfer tabungan ke <@${targetUserId}>:**`,
                  components: [typeButtons]
                });

                const typeCollector = askTransferMsg.createMessageComponentCollector({
                  componentType: ComponentType.Button,
                  time: 60000
                });

                typeCollector.on('collect', async iType => {
                  if (iType.user.id !== author.id) return;
                  typeCollector.stop();

                  if (iType.customId === 'bank_tf_cancel') {
                    await iType.update({ content: '❌ Transfer dibatalkan.', components: [] });
                    return;
                  }

                  const selectedType = iType.customId.split('_')[2]; // biasa, bayar, beri

                  const modal = new ModalBuilder()
                    .setCustomId(`bank_modal_tf_${selectedType}_${targetUserId}`)
                    .setTitle('💸 Transfer Tabungan Bank');

                  const amountInput = new TextInputBuilder()
                    .setCustomId('transfer_amount')
                    .setLabel('Jumlah koin (angka atau "all")')
                    .setPlaceholder('Contoh: 10000')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                  modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
                  await iType.showModal(modal);
                  await askTransferMsg.delete().catch(() => {});

                  const submitted = await iType.awaitModalSubmit({
                    filter: (sub) => sub.customId === `bank_modal_tf_${selectedType}_${targetUserId}` && sub.user.id === author.id,
                    time: 60000
                  }).catch(() => null);

                  if (submitted) {
                    try {
                      const amountStr = submitted.fields.getTextInputValue('transfer_amount');

                      if (selectedType === 'bayar') {
                        const debt = database.get(
                          'SELECT amount FROM bail_debts WHERE guild_id = ? AND debtor_id = ? AND creditor_id = ?',
                          [guildId, author.id, targetUserId]
                        );
                        if (!debt || debt.amount <= 0) {
                          return submitted.reply({ embeds: [embeds.errorEmbed('Transfer Gagal!', `Anda tidak memiliki hutang jaminan ke <@${targetUserId}>!`)], flags: 64 });
                        }
                      }

                      // JIKA TIPE = BERI HUTANG (PINJAMKAN) -> TAWARKAN PINJAMAN INTERAKTIF
                      if (selectedType === 'beri') {
                        let amount = bank.parseAmount(amountStr);
                        if (amount === 'all') {
                          const senderSavings = bank.getSavings(author.id, guildId);
                          amount = senderSavings.balance;
                        }

                        if (isNaN(amount) || amount <= 0) {
                          return submitted.reply({ embeds: [embeds.errorEmbed('Transfer Gagal!', 'Nominal transfer harus berupa angka di atas 0.')], flags: 64 });
                        }

                        const senderSavings = bank.getSavings(author.id, guildId);
                        if (senderSavings.balance < amount) {
                          return submitted.reply({ embeds: [embeds.errorEmbed('Transfer Gagal!', `Saldo tabungan Anda tidak mencukupi! Saldo Anda Rp ${senderSavings.balance.toLocaleString('id-ID')}`)], flags: 64 });
                        }

                        const promptEmbed = new EmbedBuilder()
                          .setColor(embeds.COLORS.SUCCESS)
                          .setTitle('🤝 Tawaran Pinjaman Bank (Beri Hutang)')
                          .setDescription(
                            `👤 **Pengirim (Kreditur):** <@${author.id}>\n` +
                            `👤 **Penerima (Debitur):** <@${targetUserId}>\n` +
                            `💰 **Jumlah Pinjaman:** **Rp ${amount.toLocaleString('id-ID')}**\n\n` +
                            `📢 <@${targetUserId}>, **<@${author.id}>** ingin meminjamkan koin sebesar **Rp ${amount.toLocaleString('id-ID')}** dari tabungan banknya kepada Anda.\n` +
                            `Jika Anda **Menerima**, koin akan masuk ke tabungan bank Anda, dan Anda akan **tercatat memiliki hutang** sebesar koin bersih yang diterima ke <@${author.id}>.\n\n` +
                            `Apakah Anda bersedia menerima pinjaman ini?`
                          )
                          .setTimestamp();

                        const promptButtons = new ActionRowBuilder().addComponents(
                          new ButtonBuilder().setCustomId(`loan_accept_${author.id}_${targetUserId}_${amount}`).setLabel('✅ Terima Pinjaman').setStyle(ButtonStyle.Success),
                          new ButtonBuilder().setCustomId(`loan_reject_${author.id}_${targetUserId}_${amount}`).setLabel('❌ Tolak Pinjaman').setStyle(ButtonStyle.Danger)
                        );

                        await submitted.reply({ content: `📨 Tawaran pinjaman Anda sebesar **Rp ${amount.toLocaleString('id-ID')}** telah dikirim ke channel <#${submitted.channelId}> untuk dikonfirmasi oleh <@${targetUserId}>.`, flags: 64 });

                        const promptMessage = await submitted.channel.send({
                          content: `<@${targetUserId}>`,
                          embeds: [promptEmbed],
                          components: [promptButtons]
                        });

                        const promptCollector = submitted.channel.createMessageComponentCollector({
                          filter: i => i.message.id === promptMessage.id,
                          componentType: ComponentType.Button,
                          time: 120000
                        });

                        promptCollector.on('collect', async iPrompt => {
                          if (iPrompt.user.id !== targetUserId) {
                            return iPrompt.reply({ content: '❌ Hanya penerima pinjaman yang dapat mengklik tombol ini!', flags: 64 });
                          }
                          promptCollector.stop();

                          if (iPrompt.customId.startsWith('loan_reject_')) {
                            const rejectEmbed = new EmbedBuilder()
                              .setColor(0xC0392B)
                              .setTitle('❌ Pinjaman Ditolak!')
                              .setDescription(`Tawaran pinjaman sebesar **Rp ${amount.toLocaleString('id-ID')}** dari <@${author.id}> telah ditolak oleh <@${targetUserId}>.`)
                              .setTimestamp();
                            await iPrompt.update({ embeds: [rejectEmbed], components: [] });
                          } else if (iPrompt.customId.startsWith('loan_accept_')) {
                            try {
                              const currentSenderSavings = bank.getSavings(author.id, guildId);
                              if (currentSenderSavings.balance < amount) {
                                throw new Error(`Saldo tabungan pengirim (<@${author.id}>) sudah tidak mencukupi untuk melakukan transfer ini!`);
                              }

                              const res = bank.transferSavings(author.id, targetUserId, guildId, amount.toString());

                              database.run(
                                `INSERT INTO bail_debts (guild_id, debtor_id, creditor_id, amount) 
                                 VALUES (?, ?, ?, ?) 
                                 ON CONFLICT(guild_id, debtor_id, creditor_id) 
                                 DO UPDATE SET amount = amount + EXCLUDED.amount`,
                                [guildId, targetUserId, author.id, res.netAmount]
                              );

                              const newDebt = database.get(
                                'SELECT amount FROM bail_debts WHERE guild_id = ? AND debtor_id = ? AND creditor_id = ?',
                                [guildId, targetUserId, author.id]
                              );

                              const roomTierName = res.roomTier === 'DEFAULT' ? 'Biasa / Tanpa Sewa' :
                                res.roomTier === 'KIPAS' ? '💨 Kamar Kipas Angin' :
                                  res.roomTier === 'AC' ? '❄️ Kamar AC' : '👑 Penthouse Kosan';

                              const successEmb = embeds.bankSuccessEmbed(
                                'Pinjaman Berhasil Diterima! 🤝',
                                `Koin dipinjamkan: **Rp ${res.amount.toLocaleString('id-ID')}**\n` +
                                `✂️ Pajak Transfer (${res.taxRatePercent}%): **-Rp ${res.tax.toLocaleString('id-ID')}** (Dibakar)\n` +
                                `📥 Bersih masuk tabungan Anda: **Rp ${res.netAmount.toLocaleString('id-ID')}**\n` +
                                `🏢 Kasta Sewa Kamar Pengirim: **${roomTierName}**\n\n` +
                                `📈 **STATUS HUTANG BARU:**\n` +
                                `• Jumlah Pinjaman Baru: **Rp ${res.netAmount.toLocaleString('id-ID')}**\n` +
                                `• Total Hutang Anda ke <@${author.id}>: **Rp ${newDebt.amount.toLocaleString('id-ID')}**\n\n` +
                                `🏦 **Sisa Tabungan Pengirim:** **Rp ${res.senderSavingsBalance.toLocaleString('id-ID')}**`
                              );

                              await iPrompt.update({ embeds: [successEmb], components: [] });
                            } catch (err) {
                              await iPrompt.update({ content: `❌ Gagal memproses pinjaman: ${err.message}`, embeds: [], components: [] });
                            }
                          }
                        });

                        promptCollector.on('end', async (collected, reason) => {
                          if (reason === 'time') {
                            const timeoutEmbed = new EmbedBuilder()
                              .setColor(0x7F8C8D)
                              .setTitle('⏰ Waktu Konfirmasi Habis!')
                              .setDescription(`Tawaran pinjaman sebesar **Rp ${amount.toLocaleString('id-ID')}** dari <@${author.id}> kepada <@${targetUserId}> telah kedaluwarsa karena tidak direspons.`)
                              .setTimestamp();
                            await promptMessage.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
                          }
                        });

                        return;
                      }

                      // JIKA TIPE = BIASA ATAU BAYAR -> TRANSFER LANGSUNG SEPERTI BIASA
                      const res = bank.transferSavings(author.id, targetUserId, guildId, amountStr);

                      let targetName = targetUserId;
                      try {
                        const targetMember = await submitted.guild.members.fetch(targetUserId).catch(() => null);
                        if (targetMember) targetName = targetMember.displayName;
                      } catch (err) {}

                      const roomTierName = res.roomTier === 'DEFAULT' ? 'Biasa / Tanpa Sewa' :
                        res.roomTier === 'KIPAS' ? '💨 Kamar Kipas Angin' :
                          res.roomTier === 'AC' ? '❄️ Kamar AC' : '👑 Penthouse Kosan';

                      let extraDesc = '';
                      if (selectedType === 'bayar') {
                        const debt = database.get(
                          'SELECT amount FROM bail_debts WHERE guild_id = ? AND debtor_id = ? AND creditor_id = ?',
                          [guildId, author.id, targetUserId]
                        );
                        const paidAmount = Math.min(res.netAmount, debt.amount);
                        const remains = debt.amount - paidAmount;

                        database.transaction(() => {
                          if (remains <= 0) {
                            database.run(
                              'DELETE FROM bail_debts WHERE guild_id = ? AND debtor_id = ? AND creditor_id = ?',
                              [guildId, author.id, targetUserId]
                            );
                          } else {
                            database.run(
                              'UPDATE bail_debts SET amount = ? WHERE guild_id = ? AND debtor_id = ? AND creditor_id = ?',
                              [remains, guildId, author.id, targetUserId]
                            );
                          }
                        })();

                        extraDesc = `\n\n📉 **PEMBAYARAN HUTANG:**\n` +
                          `• Hutang Awal: **Rp ${debt.amount.toLocaleString('id-ID')}**\n` +
                          `• Dibayar (dari Net Transfer): **Rp ${paidAmount.toLocaleString('id-ID')}**\n` +
                          `• Sisa Hutang: ` + (remains > 0 ? `**Rp ${remains.toLocaleString('id-ID')}**` : `✨ **LUNAS!**`);
                      }

                      const successEmb = embeds.bankSuccessEmbed(
                        'Transfer Tabungan Berhasil!',
                        `Koin ditransfer: **Rp ${res.amount.toLocaleString('id-ID')}**\n` +
                        `✂️ Pajak Transfer (${res.taxRatePercent}%): **-Rp ${res.tax.toLocaleString('id-ID')}** (Dibakar)\n` +
                        `📥 Bersih masuk tabungan target: **Rp ${res.netAmount.toLocaleString('id-ID')}**\n` +
                        `🏢 Kasta Sewa Kamar Pengirim: **${roomTierName}**\n\n` +
                        `👉 Penerima: **${targetName}** (<@${targetUserId}>)` +
                        `${extraDesc}\n\n` +
                        `🏦 **Sisa Tabungan Anda:** **Rp ${res.senderSavingsBalance.toLocaleString('id-ID')}**`
                      );

                      await submitted.reply({ embeds: [successEmb] });
                      const freshData = getBankDashboardData(author.id, guildId);
                      await replyMsg.edit(freshData).catch(console.error);

                      // KIRIM NOTIFIKASI CHANNEL UNTUK PENERIMA
                      try {
                        if (submitted.channelId !== '1510121069783023646') {
                          const embed = embeds.bankTransferNotificationEmbed(author, targetUserId, res.netAmount, selectedType === 'bayar');
                          await submitted.channel.send({ content: `<@${targetUserId}>`, embeds: [embed] });
                        }
                      } catch (err) {
                        console.error('Gagal mengirim notifikasi transfer ke channel:', err);
                      }
                    } catch (err) {
                      await submitted.reply({ embeds: [embeds.bankErrorEmbed('Transfer Gagal!', err.message)] });
                    }
                  }
                });
              }
            });
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
    // Perintah: .balance / .bal / .profile
    if (commandName === 'balance' || commandName === 'bal' || commandName === 'profile') {
      const now = Date.now();
      const lastUsed = balCooldowns.get(author.id) || 0;
      const cooldownMs = 15000;
      if (now - lastUsed < cooldownMs) {
        const remaining = Math.ceil((cooldownMs - (now - lastUsed)) / 1000);
        const reply = await message.reply({
          embeds: [embeds.errorEmbed('Cooldown!', `Perintah ini sedang cooldown. Silakan tunggu **${remaining} detik** lagi.`)]
        });
        setTimeout(() => {
          reply.delete().catch(() => {});
          message.delete().catch(() => {});
        }, 3000);
        return true;
      }

      balCooldowns.set(author.id, now);

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

      // Query extra data
      const kosRental = database.get('SELECT room_tier, ends_at FROM kos_rentals WHERE user_id = ? AND guild_id = ?', [targetUser.id, guildId]);
      const kosUpgrades = database.all('SELECT upgrade_id FROM kos_upgrades WHERE user_id = ? AND guild_id = ?', [targetUser.id, guildId]);
      const gardenSlots = database.all('SELECT slot_index, seed_id, planted_at, last_watered_at, water_count FROM garden_slots WHERE user_id = ? AND guild_id = ? ORDER BY slot_index ASC', [targetUser.id, guildId]);
      
      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
      const dailyQuest = database.get('SELECT * FROM user_daily_quests WHERE user_id = ? AND guild_id = ? AND quest_date = ?', [targetUser.id, guildId, todayStr]);
      
      const lotteryTickets = lottery.getUserTickets(targetUser.id, guildId);
      const lotteryPool = lottery.getPool(guildId);

      const extraData = {
        kosRental,
        kosUpgrades,
        gardenSlots,
        dailyQuest,
        lotteryTickets,
        lotteryPool,
        wantedUntil: wallet.wanted_until || 0,
        curseUntil: wallet.curse_until || 0,
        curseType: wallet.curse_type || ''
      };

      const buildProfileButtons = (activeTab, disabled = false) => {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('bal_btn_dashboard')
            .setLabel('🏠 Dashboard')
            .setStyle(activeTab === 'dashboard' ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(disabled),
          new ButtonBuilder()
            .setCustomId('bal_btn_assets')
            .setLabel('📈 Aset & Saham')
            .setStyle(activeTab === 'assets' ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(disabled),
          new ButtonBuilder()
            .setCustomId('bal_btn_pet')
            .setLabel('🐾 Pet & PvP')
            .setStyle(activeTab === 'pet' ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(disabled),
          new ButtonBuilder()
            .setCustomId('bal_btn_property')
            .setLabel('🏠 Hunian & Kebun')
            .setStyle(activeTab === 'property' ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(disabled),
          new ButtonBuilder()
            .setCustomId('bal_btn_quests')
            .setLabel('🎯 Misi & Lotre')
            .setStyle(activeTab === 'quests' ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(disabled)
        );
      };

      const buildCloseButton = (disabled = false) => {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('bal_btn_close')
            .setLabel('✖️ Tutup Profil')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled)
        );
      };

      let currentTab = 'dashboard';
      const initialEmbed = embeds.profileEmbed(
        targetUser, wallet, porto.totalPortfolioValue, targetMember, shopItems, userPet, activeLoan, bailDebts, porto.items, extraData, currentTab
      );

      const replyMsg = await message.reply({
        embeds: [initialEmbed],
        components: [buildProfileButtons(currentTab), buildCloseButton()]
      });

      const collector = replyMsg.createMessageComponentCollector({
        time: 60000 // 60 detik masa interaksi aktif
      });

      collector.on('collect', async i => {
        if (i.user.id !== author.id) {
          return i.reply({ content: '❌ Hanya pemanggil asli perintah ini yang dapat mengganti tab profil!', flags: 64 });
        }

        if (i.customId === 'bal_btn_close') {
          collector.stop('closed');
          return;
        }

        const tabMap = {
          bal_btn_dashboard: 'dashboard',
          bal_btn_assets: 'assets',
          bal_btn_pet: 'pet',
          bal_btn_property: 'property',
          bal_btn_quests: 'quests'
        };

        const nextTab = tabMap[i.customId];
        if (nextTab) {
          currentTab = nextTab;

          // Ambil ulang data fresh agar sinkron secara realtime
          const freshWallet = economy.getWallet(targetUser.id, guildId);
          const freshPorto = stocks.getPortfolio(targetUser.id, guildId);
          const freshUserPet = pet.getPet(targetUser.id, guildId);
          const freshActiveLoan = bank.getActiveLoan(targetUser.id, guildId);

          const freshDebts = database.all('SELECT creditor_id, amount FROM bail_debts WHERE debtor_id = ? AND guild_id = ?', [targetUser.id, guildId]);
          const freshReceivables = database.all('SELECT debtor_id, amount FROM bail_debts WHERE creditor_id = ? AND guild_id = ?', [targetUser.id, guildId]);
          const freshBailDebts = { debts: freshDebts, receivables: freshReceivables };

          const freshKosRental = database.get('SELECT room_tier, ends_at FROM kos_rentals WHERE user_id = ? AND guild_id = ?', [targetUser.id, guildId]);
          const freshKosUpgrades = database.all('SELECT upgrade_id FROM kos_upgrades WHERE user_id = ? AND guild_id = ?', [targetUser.id, guildId]);
          const freshGardenSlots = database.all('SELECT slot_index, seed_id, planted_at, last_watered_at, water_count FROM garden_slots WHERE user_id = ? AND guild_id = ? ORDER BY slot_index ASC', [targetUser.id, guildId]);
          const freshDailyQuest = database.get('SELECT * FROM user_daily_quests WHERE user_id = ? AND guild_id = ? AND quest_date = ?', [targetUser.id, guildId, todayStr]);
          const freshLotteryTickets = lottery.getUserTickets(targetUser.id, guildId);
          const freshLotteryPool = lottery.getPool(guildId);

          const freshExtraData = {
            kosRental: freshKosRental,
            kosUpgrades: freshKosUpgrades,
            gardenSlots: freshGardenSlots,
            dailyQuest: freshDailyQuest,
            lotteryTickets: freshLotteryTickets,
            lotteryPool: freshLotteryPool,
            wantedUntil: freshWallet.wanted_until || 0,
            curseUntil: freshWallet.curse_until || 0,
            curseType: freshWallet.curse_type || ''
          };

          const nextEmbed = embeds.profileEmbed(
            targetUser, freshWallet, freshPorto.totalPortfolioValue, targetMember, shopItems, freshUserPet, freshActiveLoan, freshBailDebts, freshPorto.items, freshExtraData, currentTab
          );

          await i.update({
            embeds: [nextEmbed],
            components: [buildProfileButtons(currentTab), buildCloseButton()]
          }).catch(console.error);
        }
      });

      collector.on('end', async (collected, reason) => {
        if (reason === 'closed') {
          await replyMsg.delete().catch(() => {});
          await message.delete().catch(() => {});
        } else {
          // Nonaktifkan tombol secara elegan setelah timeout
          await replyMsg.edit({
            components: [buildProfileButtons(currentTab, true), buildCloseButton(true)]
          }).catch(() => {});

          // Hapus pesan 15 detik kemudian
          setTimeout(() => {
            replyMsg.delete().catch(() => {});
            message.delete().catch(() => {});
          }, 15000);
        }
      });

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
    // Perintah: .claim <code> / .redeem <code>
    // ═══════════════════════════════════════════════════
    if (commandName === 'claim' || commandName === 'redeem') {
      const code = args[0]?.trim().toUpperCase();
      if (!code) {
        return message.reply({
          embeds: [embeds.warnEmbed('Kode Voucher Tidak Boleh Kosong!', 'Gunakan perintah `.claim <KODE>` atau `.redeem <KODE>` untuk mengklaim kode promo.')]
        });
      }

      // Ambil kode promo dari database
      const promo = database.get('SELECT * FROM promo_codes WHERE code = ?', [code]);
      if (!promo) {
        return message.reply({
          embeds: [embeds.errorEmbed('Kode Tidak Valid!', `Kode promo **${code}** tidak ditemukan atau tidak terdaftar.`)]
        });
      }

      const now = Math.floor(Date.now() / 1000);
      if (promo.expires_at > 0 && now > promo.expires_at) {
        return message.reply({
          embeds: [embeds.errorEmbed('Kode Kedaluwarsa!', `Kode promo **${code}** sudah kedaluwarsa pada <t:${promo.expires_at}:F>.`)]
        });
      }

      if (promo.max_claims > -1 && promo.current_claims >= promo.max_claims) {
        return message.reply({
          embeds: [embeds.errorEmbed('Kuota Habis!', `Maaf, kuota klaim untuk kode promo **${code}** telah habis digunakan.`)]
        });
      }

      // Periksa apakah user sudah klaim
      const alreadyClaimed = database.get('SELECT 1 FROM promo_claims WHERE code = ? AND user_id = ?', [code, author.id]);
      if (alreadyClaimed) {
        return message.reply({
          embeds: [embeds.warnEmbed('Sudah Diklaim!', `Anda sudah pernah mengklaim kode promo **${code}** sebelumnya.`)]
        });
      }

      // Proses klaim di dalam transaksi database
      let success = false;
      let rewardText = '';
      try {
        database.transaction(() => {
          // 1. Catat klaim
          database.run('INSERT INTO promo_claims (code, user_id) VALUES (?, ?)', [code, author.id]);
          
          // 2. Increment claims count
          database.run('UPDATE promo_codes SET current_claims = current_claims + 1 WHERE code = ?', [code]);

          // 3. Berikan koin jika ada
          if (promo.reward_coins > 0) {
            const wallet = database.get('SELECT balance FROM wallets WHERE user_id = ? AND guild_id = ?', [author.id, guildId]);
            if (!wallet) {
              database.run('INSERT INTO wallets (user_id, guild_id, balance) VALUES (?, ?, ?)', [author.id, guildId, promo.reward_coins]);
            } else {
              database.run('UPDATE wallets SET balance = balance + ? WHERE user_id = ? AND guild_id = ?', [promo.reward_coins, author.id, guildId]);
            }
            rewardText += `• 🪙 Koin Rupiah: **+Rp ${promo.reward_coins.toLocaleString('id-ID')}**\n`;
          }

          // 4. Berikan item jika ada
          if (promo.reward_item_id && promo.reward_item_qty > 0) {
            const itemId = promo.reward_item_id.toUpperCase();
            const qty = promo.reward_item_qty;

            const petItemIds = ['FOOD_BASIC', 'FOOD_PREMIUM', 'TOY', 'SODA', 'SOAP', 'MEDICINE', 'AMULET'];
            if (petItemIds.includes(itemId)) {
              const exist = database.get('SELECT quantity FROM pet_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?', [author.id, guildId, itemId]);
              if (!exist) {
                database.run('INSERT INTO pet_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, ?, ?)', [author.id, guildId, itemId, qty]);
              } else {
                database.run('UPDATE pet_inventory SET quantity = quantity + ? WHERE user_id = ? AND guild_id = ? AND item_id = ?', [qty, author.id, guildId, itemId]);
              }
              rewardText += `• 🐾 Item Pet: **${qty}x \`${itemId}\`**\n`;
            } else {
              const exist = database.get('SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?', [author.id, guildId, itemId]);
              if (!exist) {
                database.run('INSERT INTO user_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, ?, ?)', [author.id, guildId, itemId, qty]);
              } else {
                database.run('UPDATE user_inventory SET quantity = quantity + ? WHERE user_id = ? AND guild_id = ? AND item_id = ?', [qty, author.id, guildId, itemId]);
              }
              rewardText += `• 🎒 Item Tas: **${qty}x \`${itemId}\`**\n`;
            }
          }
        })();
        success = true;
      } catch (txErr) {
        console.error('Failed to claim promo code:', txErr);
        return message.reply({
          embeds: [embeds.errorEmbed('Gagal Mengklaim!', `Terjadi kesalahan saat memproses klaim voucher: ${txErr.message}`)]
        });
      }

      if (success) {
        const claimEmbed = new EmbedBuilder()
          .setColor(0x2ECC71) // Emerald Green
          .setTitle('🎉 REDEEM CODE SUKSES! 🎉')
          .setThumbnail(author.displayAvatarURL())
          .setDescription(
            `Selamat <@${author.id}>! Kode promo **${code}** berhasil diklaim.\n\n` +
            `🎁 **Hadiah yang Anda Peroleh:**\n${rewardText}\n` +
            `*Gunakan \`.tas\` atau \`.bal\` untuk memeriksa perolehan hadiah baru Anda!*`
          )
          .setTimestamp();
        await message.reply({ embeds: [claimEmbed] });
      }
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah: .bid <id_lelang> <jumlah_koin>
    // ═══════════════════════════════════════════════════
    if (commandName === 'bid') {
      const aId = parseInt(args[0]);
      const bidAmount = parseInt(args[1]);

      if (isNaN(aId) || isNaN(bidAmount) || bidAmount <= 0) {
        return message.reply({
          embeds: [embeds.warnEmbed('Format Salah!', 'Gunakan perintah `.bid <id_lelang> <jumlah_koin>`.\nContoh: `.bid 1 5000`')]
        });
      }

      const auction = database.get("SELECT * FROM auction_items WHERE id = ? AND status = 'ACTIVE'", [aId]);
      if (!auction) {
        return message.reply({
          embeds: [embeds.errorEmbed('Lelang Tidak Ditemukan!', `Lelang aktif dengan ID \`${aId}\` tidak ditemukan atau sudah ditutup.`)]
        });
      }

      const now = Math.floor(Date.now() / 1000);
      if (now > auction.ends_at) {
        return message.reply({
          embeds: [embeds.errorEmbed('Lelang Berakhir!', `Masa penawaran untuk lelang ID \`${aId}\` sudah berakhir.`)]
        });
      }

      const minRequiredBid = auction.highest_bidder_id ? auction.current_bid + Math.max(10, Math.round(auction.min_bid * 0.05)) : auction.min_bid;
      if (bidAmount < minRequiredBid) {
        return message.reply({
          embeds: [embeds.warnEmbed('Penawaran Terlalu Rendah!', `Penawaran minimal berikutnya harus sebesar **Rp ${minRequiredBid.toLocaleString('id-ID')}**!`)]
        });
      }

      const wallet = database.get('SELECT balance FROM wallets WHERE user_id = ? AND guild_id = ?', [author.id, guildId]);
      const currentCoins = wallet ? wallet.balance : 0;
      if (currentCoins < bidAmount) {
        return message.reply({
          embeds: [embeds.warnEmbed('Koin Tidak Cukup!', `Koin di dompet Anda (**Rp ${currentCoins.toLocaleString('id-ID')}**) tidak mencukupi untuk melakukan bid sebesar **Rp ${bidAmount.toLocaleString('id-ID')}**!`)]
        });
      }

      if (auction.highest_bidder_id === author.id) {
        return message.reply({
          embeds: [embeds.warnEmbed('Bid Tertinggi Milik Anda!', `Anda sudah memegang bid tertinggi untuk lelang ini.`)]
        });
      }

      let success = false;
      try {
        database.transaction(() => {
          database.run(
            'UPDATE auction_items SET current_bid = ?, highest_bidder_id = ? WHERE id = ?',
            [bidAmount, author.id, aId]
          );

          database.run(
            'INSERT INTO auction_bids (auction_id, user_id, bid_amount) VALUES (?, ?, ?)',
            [aId, author.id, bidAmount]
          );
        })();
        success = true;
      } catch (txErr) {
        console.error('Failed to submit bid:', txErr);
        return message.reply({
          embeds: [embeds.errorEmbed('Gagal Melakukan Bid!', `Terjadi kesalahan internal: ${txErr.message}`)]
        });
      }

      if (success) {
        const bidSuccessEmbed = new EmbedBuilder()
          .setColor(0x3498DB)
          .setTitle('🔨 PENAWARAN HARGA DITERIMA!')
          .setDescription(
            `Kandidat tertinggi lelang terupdate!\n\n` +
            `• ID Lelang: \`${aId}\`\n` +
            `• Barang: **${auction.quantity}x ${auction.item_id}**\n` +
            `• Bid Baru: **Rp ${bidAmount.toLocaleString('id-ID')}** oleh <@${author.id}>\n\n` +
            `*Pemberitahuan otomatis akan dikirim ke penawar sebelumnya jika terlampaui.*`
          )
          .setTimestamp();
        await message.reply({ embeds: [bidSuccessEmbed] });
      }
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
    // Perintah: .lottery / .lotre [beli <jumlah>]
    // ═══════════════════════════════════════════════════
    if (commandName === 'lottery' || commandName === 'lotre') {
      const subCommand = args[0] ? args[0].toLowerCase() : null;

      if (subCommand === 'buy' || subCommand === 'beli') {
        const qty = parseInt(args[1]);
        if (isNaN(qty) || qty <= 0) {
          return message.reply({
            embeds: [embeds.warnEmbed('Jumlah Tiket Tidak Valid!', 'Tentukan jumlah tiket yang ingin dibeli.\nContoh: `.lotre beli 5`')]
          });
        }

        try {
          const res = lottery.buyTickets(author.id, guildId, qty);
          const successEmbed = new EmbedBuilder()
            .setColor(embeds.COLORS?.SUCCESS || 0x00FF88)
            .setTitle('🎟️ Pembelian Tiket Lotre Berhasil!')
            .setDescription(
              `🎉 **Terima kasih telah berpartisipasi dalam lotre mingguan!**\n\n` +
              `👤 **Pembeli:** <@${author.id}>\n` +
              `🎫 Tiket Dibeli: **${res.quantity} tiket**\n` +
              `💰 Total Biaya: **Rp ${res.totalCost.toLocaleString('id-ID')}**\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `📊 **Status Lotre Anda:**\n` +
              `┊ 🎫 Total Tiket Anda: **${res.userTotalTickets} tiket**\n` +
              `┊ 💰 Total Pool Server: **Rp ${res.pool.total_pool.toLocaleString('id-ID')}** (dari **${res.pool.total_tickets} tiket** terjual)\n\n` +
              `💡 *Undian otomatis dilakukan setiap hari Minggu pukul 21:00 WIB.*`
            )
            .setTimestamp();
          return message.reply({ embeds: [successEmbed] });
        } catch (err) {
          return message.reply({
            embeds: [embeds.errorEmbed('Gagal Membeli Tiket Lotre', err.message)]
          });
        }
      }

      // Tampilkan status lotre saat ini
      const pool = lottery.getPool(guildId);
      const userTickets = lottery.getUserTickets(author.id, guildId);
      const participants = lottery.getParticipants(guildId);
      const participantCount = participants.length;
      const ticketPrice = config.lottery?.TICKET_PRICE || 100;
      const burnPercent = config.lottery?.BURN_PERCENT || 15;

      const winChance = pool.total_tickets > 0 
        ? ((userTickets / pool.total_tickets) * 100).toFixed(2)
        : '0.00';

      const lotteryEmbed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🎟️ 🏆 LOTRE MINGGUAN BOT KOSAN 1A')
        .setDescription(
          `🍀 **Selamat datang di Lotre Mingguan Server!**\n` +
          `Beli tiket sekarang dan menangkan total pool koin terkumpul! Setiap tiket yang Anda beli akan menambah total hadiah pool.\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📈 **Status Pool Saat Ini:**\n` +
          `┊ 💰 Total Pool Hadiah: **Rp ${pool.total_pool.toLocaleString('id-ID')}**\n` +
          `┊ 🎫 Total Tiket Terjual: **${pool.total_tickets} tiket**\n` +
          `┊ 👥 Jumlah Peserta: **${participantCount} orang**\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `👤 **Status Anda (<@${author.id}>):**\n` +
          `┊ 🎫 Jumlah Tiket: **${userTickets} tiket**\n` +
          `┊ 🎯 Peluang Menang: **${winChance}%**\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `📋 **Informasi Lotre:**\n` +
          `┊ 🪙 Harga Tiket: **Rp ${ticketPrice.toLocaleString('id-ID')}** per tiket\n` +
          `┊ 🔥 Koin Dibakar: **${burnPercent}%** dari total pool akan dibakar (dihapus) saat undian untuk stabilitas ekonomi.\n` +
          `┊ ⏱️ Jadwal Undian: Setiap **Minggu pukul 21:00 WIB**\n\n` +
          `👉 **Cara Membeli Tiket:**\n` +
          `Ketik \`.lotre beli <jumlah_tiket>\` atau \`.lottery buy <jumlah_tiket>\`\n` +
          `*Contoh: \`.lotre beli 5\`*`
        )
        .setTimestamp()
        .setFooter({ text: 'Lotre Mingguan • Semoga Beruntung!' });

      return message.reply({ embeds: [lotteryEmbed] });
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
      if (targetUser.bot) {
        return message.reply({ embeds: [embeds.errorEmbed('Transfer Gagal!', 'Anda tidak dapat mentransfer koin ke bot!')] });
      }
      if (isNaN(amount) || amount <= 0) {
        return message.reply({ embeds: [embeds.warnEmbed('Jumlah Tidak Valid!', 'Nominal transfer harus berupa angka di atas 0.')] });
      }

      const res = economy.transferBalance(author.id, targetUser.id, guildId, amount, message.member);

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

      const res = stocks.sellStock(author.id, guildId, ticker, shares, message.member);
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

      const res = stocks.sellStock(author.id, guildId, ticker, portfolio.shares, message.member);
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
      const wallet = economy.getWallet(targetUser.id, guildId);
      const now = Math.floor(Date.now() / 1000);

      // Cek apakah target sedang kena prank fake_crash
      if (wallet.curse_type === 'fake_crash' && wallet.curse_until > now) {
        const embed = new EmbedBuilder()
          .setColor(0xE74C3C) // RED
          .setTitle('⚠️ NOTIFIKASI KEBANGKRUTAN MASSAL ⚠️')
          .setThumbnail('https://cdn-icons-png.flaticon.com/512/2622/2622649.png')
          .setDescription(
            `Waduh! **${targetUser.username}**, seluruh aset portofolio saham Anda disita oleh Otoritas Jasa Keuangan Virtual!\n\n` +
            `🔴 **Status Aset:** \`DILIKUIDASI TOTAL\`\n` +
            `💰 **Kerugian Negara:** \`Rp 999.999.999\`\n` +
            `🚫 **Tuduhan:** \`Dugaan Manipulasi Pasar Saham & Transaksi Koin Palsu\`\n\n` +
            `*Catatan: Seluruh dividen dibekukan dan lembar saham Anda dilelang kembali ke pasar publik.*`
          )
          .setFooter({ text: 'Klik tombol di bawah untuk melakukan klarifikasi & banding segera!' })
          .setTimestamp();

        const btn = new ButtonBuilder()
          .setCustomId(`prank_fake_crash_btn_${targetUser.id}`)
          .setLabel('⚠️ AJUKAN BANDING SEKARANG')
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(btn);
        const reply = await message.reply({ embeds: [embed], components: [row] });

        const collector = reply.createMessageComponentCollector({
          time: 60000
        });

        collector.on('collect', async iBanding => {
          if (iBanding.user.id !== targetUser.id) {
            return iBanding.reply({ content: '❌ Tombol ini hanya untuk warga yang bersangkutan!', flags: 64 });
          }

          // Bersihkan kutukan di database
          database.run("UPDATE wallets SET curse_type = '', curse_until = 0 WHERE user_id = ? AND guild_id = ?", [targetUser.id, guildId]);

          // Tampilkan portofolio asli
          const realPorto = stocks.getPortfolio(targetUser.id, guildId);
          const realWallet = economy.getWallet(targetUser.id, guildId);
          const realEmbed = embeds.portfolioEmbed(targetUser, realPorto, realWallet);

          const prankEmbed = new EmbedBuilder()
            .setColor(0x2ECC71) // GREEN
            .setTitle('😜 KENA PRANK ADMIN! 🎈')
            .setDescription(
              `**Hahaha! Tarik napas dalam-dalam sultan...**\n\n` +
              `Tenang, tidak ada manipulasi pasar kok. Aset portofolio saham Anda yang berharga aman sepenuhnya!\n` +
              `Jangan lupa berterima kasih kepada Admin yang sudah peduli dengan kesehatan jantung Anda hari ini. 🤣✨`
            )
            .setTimestamp();

          await iBanding.update({ embeds: [prankEmbed, realEmbed], components: [] });
          collector.stop();
        });
        return true;
      }

      const porto = stocks.getPortfolio(targetUser.id, guildId);
      const embed = embeds.portfolioEmbed(targetUser, porto, wallet);
      await message.reply({ embeds: [embed] });
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah: .top-pencuri / .toppencuri / .top-thief / .top-rob
    // ═══════════════════════════════════════════════════
    if (commandName === 'top-pencuri' || commandName === 'toppencuri' || commandName === 'top-thief' || commandName === 'top-rob') {
      const thiefData = economy.getThiefLeaderboard(guildId, 10);
      await Promise.all(thiefData.map(async u => {
        try { await client.users.fetch(u.user_id); } catch (e) { }
      }));
      const embed = embeds.thiefLeaderboardEmbed(guild.name, thiefData, client);
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

      const components = [];
      const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('eco_btn_profile').setLabel('💰 Profil & Saldo').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('eco_btn_gacha').setLabel('🎲 Gacha Role').setStyle(ButtonStyle.Danger)
      );
      components.push(btnRow);

      if (items.length > 0) {
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('eco_select_buy_role')
          .setPlaceholder('👉 Pilih role untuk dibeli secara langsung...');

        const TIER_EMOJIS = {
          COMMON: '🟢',
          RARE: '🔵',
          EPIC: '🟣',
          LEGENDARY: '👑',
          MYTHIC: '🌟'
        };

        const options = items.slice(0, 25).map(item => {
          const emoji = TIER_EMOJIS[item.tier?.toUpperCase()] || '🟢';
          const stockText = item.stock === -1 ? '♾️ Tanpa Batas' : (item.stock <= 0 ? 'SOLD OUT' : `Sisa ${item.stock}`);
          return new StringSelectMenuOptionBuilder()
            .setLabel(`${emoji} ${item.role_name}`)
            .setValue(item.id.toString())
            .setDescription(`Harga: Rp ${item.price.toLocaleString('id-ID')} | Stok: ${stockText}`);
        });

        selectMenu.addOptions(options);
        components.push(new ActionRowBuilder().addComponents(selectMenu));
      }

      const shopMsg = await message.reply({ embeds: [embed], components });

      const collector = shopMsg.createMessageComponentCollector({
        time: 120000 // 2 menit navigasi
      });

      collector.on('collect', async i => {
        if (i.user.id !== author.id) {
          return i.reply({ content: '❌ Tombol/Menu ini hanya bisa digunakan oleh orang yang memanggil perintah ini!', flags: 64 });
        }

        try {
          if (i.customId === 'eco_btn_profile') {
            const wallet2 = economy.getWallet(author.id, guildId);
            const porto = stocks.getPortfolio(author.id, guildId);
            const shopItems = database.all('SELECT * FROM shop_items WHERE guild_id = ?', [guildId]);
            const userPet = pet.getPet(author.id, guildId);
            const activeLoan = bank.getActiveLoan(author.id, guildId);
            const debts = database.all('SELECT creditor_id, amount FROM bail_debts WHERE debtor_id = ? AND guild_id = ?', [author.id, guildId]);
            const receivables = database.all('SELECT debtor_id, amount FROM bail_debts WHERE creditor_id = ? AND guild_id = ?', [author.id, guildId]);
            const bailDebts = { debts, receivables };
            const profileEmbed = embeds.profileEmbed(author, wallet2, porto.totalPortfolioValue, i.member, shopItems, userPet, activeLoan, bailDebts, porto.items);
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
            // Perbarui embed utama setelah gacha
            const wallet2 = economy.getWallet(author.id, guildId);
            const items2 = database.all('SELECT * FROM shop_items WHERE guild_id = ?', [guildId]);
            const updatedEmbed = embeds.shopEmbed(items2, wallet2);
            await shopMsg.edit({ embeds: [updatedEmbed] }).catch(() => {});
          } else if (i.isStringSelectMenu() && i.customId === 'eco_select_buy_role') {
            const itemId = parseInt(i.values[0]);
            await executeRolePurchase({
              replyTarget: i,
              user: author,
              guild,
              guildId,
              itemId,
              isInteraction: true,
              member: i.member
            });
            // Perbarui embed utama setelah pembelian role
            const wallet2 = economy.getWallet(author.id, guildId);
            const items2 = database.all('SELECT * FROM shop_items WHERE guild_id = ?', [guildId]);
            const updatedEmbed = embeds.shopEmbed(items2, wallet2);
            
            // Perbarui juga opsi select menu karena sisa stok kemungkinan berubah
            const updatedComponents = [];
            const freshBtnRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId('eco_btn_profile').setLabel('💰 Profil & Saldo').setStyle(ButtonStyle.Success),
              new ButtonBuilder().setCustomId('eco_btn_gacha').setLabel('🎲 Gacha Role').setStyle(ButtonStyle.Danger)
            );
            updatedComponents.push(freshBtnRow);

            if (items2.length > 0) {
              const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('eco_select_buy_role')
                .setPlaceholder('👉 Pilih role untuk dibeli secara langsung...');

              const TIER_EMOJIS = {
                COMMON: '🟢',
                RARE: '🔵',
                EPIC: '🟣',
                LEGENDARY: '👑',
                MYTHIC: '🌟'
              };

              const options = items2.slice(0, 25).map(item => {
                const emoji = TIER_EMOJIS[item.tier?.toUpperCase()] || '🟢';
                const stockText = item.stock === -1 ? '♾️ Tanpa Batas' : (item.stock <= 0 ? 'SOLD OUT' : `Sisa ${item.stock}`);
                return new StringSelectMenuOptionBuilder()
                  .setLabel(`${emoji} ${item.role_name}`)
                  .setValue(item.id.toString())
                  .setDescription(`Harga: Rp ${item.price.toLocaleString('id-ID')} | Stok: ${stockText}`);
              });

              selectMenu.addOptions(options);
              updatedComponents.push(new ActionRowBuilder().addComponents(selectMenu));
            }

            await shopMsg.edit({ embeds: [updatedEmbed], components: updatedComponents }).catch(() => {});
          }
        } catch (err) {
          console.error('Error handling interaction in shop text command:', err);
          await i.reply({ content: '❌ Terjadi kesalahan saat memproses permintaan Anda.', flags: 64 }).catch(() => { });
        }
      });

      collector.on('end', async () => {
        const disabledRows = [];
        const disabledBtnRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('eco_btn_profile').setLabel('💰 Profil & Saldo').setStyle(ButtonStyle.Success).setDisabled(true),
          new ButtonBuilder().setCustomId('eco_btn_gacha').setLabel('🎲 Gacha Role').setStyle(ButtonStyle.Danger).setDisabled(true)
        );
        disabledRows.push(disabledBtnRow);

        // Ambil status terbaru untuk layout penutup yang presisi
        const freshItems = database.all('SELECT * FROM shop_items WHERE guild_id = ?', [guildId]);
        if (freshItems.length > 0) {
          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('eco_select_buy_role')
            .setPlaceholder('👉 Pilih role untuk dibeli secara langsung...')
            .setDisabled(true);

          const TIER_EMOJIS = {
            COMMON: '🟢',
            RARE: '🔵',
            EPIC: '🟣',
            LEGENDARY: '👑',
            MYTHIC: '🌟'
          };

          const options = freshItems.slice(0, 25).map(item => {
            const emoji = TIER_EMOJIS[item.tier?.toUpperCase()] || '🟢';
            const stockText = item.stock === -1 ? '♾️ Tanpa Batas' : (item.stock <= 0 ? 'SOLD OUT' : `Sisa ${item.stock}`);
            return new StringSelectMenuOptionBuilder()
              .setLabel(`${emoji} ${item.role_name}`)
              .setValue(item.id.toString())
              .setDescription(`Harga: Rp ${item.price.toLocaleString('id-ID')} | Stok: ${stockText}`);
          });

          selectMenu.addOptions(options);
          disabledRows.push(new ActionRowBuilder().addComponents(selectMenu));
        }

        await shopMsg.edit({ components: disabledRows }).catch(() => { });
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

      await executeRolePurchase({
        replyTarget: message,
        user: author,
        guild,
        guildId,
        itemId: item.id,
        isInteraction: false,
        member: message.member
      });

      // Picu suara TTS jika bot tersambung di voice channel & jika tier tinggi
      if (item.tier === 'EPIC' || item.tier === 'LEGENDARY' || item.tier === 'MYTHIC') {
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
    const adminCommands = ['eco-give', 'eco-giveall', 'eco-take', 'market-add', 'market-remove', 'market-drop', 'eco-reset', 'eco-resetall', 'market-reinit', 'shop-add', 'shop-remove', 'shop-setstock', 'eco-announce', 'event-trigger', 'autoshoprole', 'shop-auto', 'anoncemen', 'announcement', 'dividends-trigger', 'admincup', 'admin-cup'];
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

      const totalPayout = distributions.reduce((sum, d) => sum + d.amount, 0);
      const uniqueRecipients = new Set(distributions.map(d => d.userId)).size;
      const topEarner = [...distributions].sort((a, b) => b.amount - a.amount)[0];
      const topUser = topEarner ? (client.users.cache.get(topEarner.userId)?.username || `<@${topEarner.userId}>`) : '-';
      const topPayoutText = topEarner ? `👑 **${topUser}** (+Rp ${topEarner.amount.toLocaleString('id-ID')} via **${topEarner.ticker}**)` : '`-`';

      let listText = '';
      distributions.slice(0, 10).forEach((d) => {
        const user = client.users.cache.get(d.userId);
        const username = user ? user.username : `<@${d.userId}>`;
        listText += `> 💰 **${username}** Menerima **Rp ${d.amount.toLocaleString('id-ID')}** dari **${d.ticker}**\n` +
                    `> ┊ 📈 *Rate:* \`${d.rate}%\` · ⚡ *Skor Aktif:* \`${d.activity}\` · 📦 *Hold:* \`${d.shares} lbr\`\n`;
      });
      if (distributions.length > 10) {
        listText += `> *...dan ${distributions.length - 10} transaksi dividen lainnya!*`;
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
          .setColor(0x00FF88) // Neon Emerald Green
          .setTitle('💸 DISTRIBUSI DIVIDEN BURSA (MANUAL TRIGGER) 📈')
          .setDescription(
            `📢 **Pengumuman Bursa:** Pembayaran dividen mingguan dinamis berbasis keaktifan chat warga telah dipicu secara manual oleh Administrator!\n\n` +
            `Dividen dihitung secara proporsional berdasarkan jumlah lembar saham yang di-hold dan keaktifan chat masing-masing channel selama 7 hari terakhir.`
          )
          .addFields(
            {
              name: '📊 Ringkasan Distribusi',
              value: `├─ 👥 **Total Penerima:** \`${uniqueRecipients} Warga\`\n` +
                     `├─ 💸 **Total Transaksi:** \`${distributions.length} Transaksi\`\n` +
                     `├─ 💰 **Dana Cair:** **Rp ${totalPayout.toLocaleString('id-ID')}**\n` +
                     `└─ 🏆 **Penerima Tertinggi:** ${topPayoutText}`,
              inline: false
            },
            {
              name: '📋 Rincian Transaksi Teratas',
              value: listText || '> *Tidak ada transaksi*',
              inline: false
            },
            {
              name: '💡 Tips Finansial',
              value: `Hold saham channel teraktif untuk mendapatkan tingkat keuntungan (rate) dividen mingguan yang jauh lebih tinggi! Gunakan \`.porto\` untuk cek portofolio Anda atau \`.bal\` untuk saldo saat ini.`,
              inline: false
            }
          )
          .setFooter({ text: 'Bursa Saham Kosan 1A • Pemicu Dividen Manual' })
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
    // Perintah Admin: .admincup [start/stop/force-end]
    // ═══════════════════════════════════════════════════
    if (commandName === 'admincup' || commandName === 'admin-cup') {
      const action = args[0] ? args[0].toLowerCase() : null;
      const tournament = require('./tournament');

      if (action === 'start') {
        const durationMins = parseInt(args[1]) || 30;
        const minLevel = parseInt(args[2]) || 10;
        const maxLevel = parseInt(args[3]) || 9999;

        const statusMsg = await message.reply({ embeds: [embeds.successEmbed('Memproses...', 'Sedang mempersiapkan dan membuat channel turnamen otomatis. Mohon tunggu...')] }).catch(() => null);

        try {
          const targetChannelObj = await tournament.createTournamentChannel(message.guild);
          const targetChannelId = targetChannelObj.id;

          const res = tournament.startTournament(author.id, guildId, targetChannelId, durationMins, minLevel, maxLevel);
          const announceEmbed = new EmbedBuilder()
            .setColor(0x7C4DFF)
            .setTitle('🏆 ADMIN CUP PET TOURNAMENT 🏆')
            .setDescription(
              `📢 **Pendaftaran turnamen adu pet telah dibuka oleh Admin!**\n` +
              `Siapkan pet terkuat Anda untuk merebut gelar juara server!\n\n` +
              `⏱️ **Sisa Waktu Pendaftaran:** ${durationMins} Menit (Pendaftaran ditutup otomatis)\n` +
              `📈 **Kriteria Level:** Level ${minLevel} s/d ${maxLevel}\n\n` +
              `👉 Ketik **\`.pet cup register\`** atau klik tombol ** Gabung Turnamen ** di bawah ini untuk mendaftarkan pet aktif Anda!\n\n` +
              `*Pemenang akan mendapatkan hadiah istimewa yang akan diberikan langsung oleh Admin secara manual setelah turnamen selesai!*`
            )
            .setFooter({ text: 'Admin Cup • Registration Phase' })
            .setTimestamp();

          const joinRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('cup_btn_join_public')
              .setLabel('🏆 Gabung Turnamen')
              .setStyle(ButtonStyle.Success)
          );

          await targetChannelObj.send({ embeds: [announceEmbed], components: [joinRow] });

          if (statusMsg) {
            await statusMsg.edit({ embeds: [embeds.successEmbed('Turnamen Dimulai!', `Pendaftaran turnamen telah dibuka di channel otomatis <#${targetChannelId}> selama **${durationMins}** menit.`)] }).catch(() => {});
          } else {
            await message.reply({ embeds: [embeds.successEmbed('Turnamen Dimulai!', `Pendaftaran turnamen telah dibuka di channel otomatis <#${targetChannelId}> selama **${durationMins}** menit.`)] }).catch(() => {});
          }

          // Jadwalkan penutupan registrasi dan seeding
          setTimeout(() => {
            tournament.closeRegistrationAndGenerateBracket(guildId, client);
          }, durationMins * 60 * 1000);

          return true;
        } catch (err) {
          const errMsg = embeds.errorEmbed('Gagal Memulai Turnamen!', err.message);
          if (statusMsg) {
            return statusMsg.edit({ embeds: [errMsg] }).catch(() => {});
          }
          return message.reply({ embeds: [errMsg] }).catch(() => {});
        }
      }

      if (action === 'stop' || action === 'force-end' || action === 'batal') {
        try {
          const active = tournament.stopTournament(guildId);
          if (active && active.channel_id) {
            const channel = message.guild.channels.cache.get(active.channel_id) || await client.channels.fetch(active.channel_id).catch(() => null);
            if (channel) {
              await channel.delete().catch(() => {});
            }
          }
          return message.reply({ embeds: [embeds.successEmbed('Turnamen Dibatalkan!', 'Turnamen Admin Cup aktif berhasil dibatalkan dan semua data pendaftaran telah dibersihkan.')] });
        } catch (err) {
          return message.reply({ embeds: [embeds.errorEmbed('Gagal Membatalkan Turnamen!', err.message)] });
        }
      }

      return message.reply({ embeds: [embeds.warnEmbed('Format Salah!', 'Gunakan:\n👉 \`.admincup start [durasi_menit] [min_level] [max_level]\`\n👉 \`.admincup stop\`')] });
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
      if (pumped.length > 0) summaryParts.push(`🚀 ${pumped.length} Pumped`);
      if (gainers.length > 0) summaryParts.push(`🟢 ${gainers.length} Naik`);
      if (losers.length > 0) summaryParts.push(`🔴 ${losers.length} Turun`);
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
        .setFooter({ text: `Bot Kosan 1A  •  Manual Update by Admin  •  ${updates.length} saham diperbarui` })
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
        // Kirim Embed Pengumuman Pembaruan Ekonomi & Perpetan Kosan 1A dengan tag @everyone
        const announcementEmbed = embeds.economyUpdateEmbed(message.guild);

        await targetChannel.send({
          content: '📢 **PENGUMUMAN PEMBARUAN EKONOMI & PERPETAN KOSAN 1A** @everyone\n\n🏠 *Warga Kosan 1A wajib menyimak pembaruan di bawah ini agar tetap kompetitif!*',
          embeds: [announcementEmbed],
          allowedMentions: { parse: ['everyone'] }
        });

        if (targetChannel.id !== message.channel.id) {
          await message.reply(`✅ **Berhasil!** Pengumuman pembaruan ekonomi premium telah diposting di channel ${targetChannel}.`);
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
        [channel.id, guildId, channel.name, ticker, config.market.INITIAL_PRICE, config.market.INITIAL_PRICE, config.market.TOTAL_BURSA_SHARES || 500, config.market.TOTAL_BURSA_SHARES || 500]
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
      const isOwner = message.author.id === '436554535037698059';
      const isAdmin = message.member && message.member.permissions.has(PermissionsBitField.Flags.Administrator);
      if (!isOwner && !isAdmin) {
        return message.reply({ content: '❌ Perintah ini hanya dapat dijalankan oleh Owner utama & Administrator server!', flags: 64 });
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
        'UPDATE ebyus_settings SET gacha_mode = ?, expires_at = ?, is_active = 1, updated_at = ?, updated_by = ? WHERE guild_id = ?',
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
      const isOwner = message.author.id === '436554535037698059';
      const isAdmin = message.member && message.member.permissions.has(PermissionsBitField.Flags.Administrator);
      if (!isOwner && !isAdmin) {
        return message.reply({ content: '❌ Perintah ini hanya dapat dijalankan oleh Owner utama & Administrator server!', flags: 64 });
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
        'UPDATE ebyus_settings SET coin_multiplier = ?, expires_at = ?, is_active = 1, updated_at = ?, updated_by = ? WHERE guild_id = ?',
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

      const isOwner = message.author.id === '436554535037698059';
      const isAdmin = message.member && message.member.permissions.has(PermissionsBitField.Flags.Administrator);
      if (!isOwner && !isAdmin) {
        return message.reply({ content: '❌ Akses Ditolak! Menu dashboard ini dikunci khusus untuk Owner utama & Administrator server.', flags: 64 });
      }

      const adminPanel = require('./adminPanel');
      await adminPanel.handleAdminAbyusPanel(message, client);
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: Panel Pet (.admin-pet / .panel-pet)
    // ═══════════════════════════════════════════════════
    if (['admin-pet', 'panel-pet', 'pet-panel'].includes(commandName)) {
      const isOwner = message.author.id === '436554535037698059';
      const isAdmin = message.member && message.member.permissions.has(PermissionsBitField.Flags.Administrator);
      if (!isOwner && !isAdmin) {
        return message.reply({ content: '❌ Akses Ditolak! Menu dashboard ini dikunci khusus untuk Owner utama & Administrator server.', flags: 64 });
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
      const isOwner = message.author.id === '436554535037698059';
      const isAdmin = message.member && message.member.permissions.has(PermissionsBitField.Flags.Administrator);
      if (!isOwner && !isAdmin) {
        return message.reply({ content: '❌ Akses Ditolak! Menu dashboard ini dikunci khusus untuk Owner utama & Administrator server.', flags: 64 });
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
      const isOwner = message.author.id === '436554535037698059';
      const isAdmin = message.member && message.member.permissions.has(PermissionsBitField.Flags.Administrator);
      if (!isOwner && !isAdmin) {
        return message.reply({ content: '❌ Akses Ditolak! Menu dashboard ini dikunci khusus untuk Owner utama & Administrator server.', flags: 64 });
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
      const isOwner = message.author.id === '436554535037698059';
      const isAdmin = message.member && message.member.permissions.has(PermissionsBitField.Flags.Administrator);
      if (!isOwner && !isAdmin) {
        return message.reply({ content: '❌ Akses Ditolak! Menu dashboard ini dikunci khusus untuk Owner utama & Administrator server.', flags: 64 });
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
      const isOwner = message.author.id === '436554535037698059';
      const isAdmin = message.member && message.member.permissions.has(PermissionsBitField.Flags.Administrator);
      if (!isOwner && !isAdmin) {
        return message.reply({ content: '❌ Akses Ditolak! Menu dashboard ini dikunci khusus untuk Owner utama & Administrator server.', flags: 64 });
      }

      const adminPanel = require('./adminPanel');
      await adminPanel.handleAdminShopPanel(message, client);
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: Panel Warga (.admin-warga / .panel-warga)
    // ═══════════════════════════════════════════════════
    if (['admin-warga', 'adminwarga', 'panel-warga', 'panelwarga'].includes(commandName)) {
      const isOwner = message.author.id === '436554535037698059';
      const isAdmin = message.member && message.member.permissions.has(PermissionsBitField.Flags.Administrator);
      if (!isOwner && !isAdmin) {
        return message.reply({ content: '❌ Akses Ditolak! Menu dashboard ini dikunci khusus untuk Owner utama & Administrator server.', flags: 64 });
      }

      const adminPanel = require('./adminPanel');
      const targetUser = message.mentions.users.first() || (args[0] ? { id: args[0] } : null);
      await adminPanel.handleAdminWargaPanel(message, client, targetUser?.id);
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: Panel Gift & Event (.admin-gift / .panel-gift / .gift-panel)
    // ═══════════════════════════════════════════════════
    if (['admin-gift', 'panel-gift', 'gift-panel', 'giftpanel'].includes(commandName)) {
      const isOwner = message.author.id === '436554535037698059';
      const isAdmin = message.member && message.member.permissions.has(PermissionsBitField.Flags.Administrator);
      if (!isOwner && !isAdmin) {
        return message.reply({ content: '❌ Akses Ditolak! Menu dashboard ini dikunci khusus untuk Owner utama & Administrator server.', flags: 64 });
      }

      const adminPanel = require('./adminPanel');
      await adminPanel.handleAdminGiftPanel(message, client);
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: .stop-abyus / .stop-ebyus (Penghentian Darurat Event Abuse)
    // ═══════════════════════════════════════════════════
    if (['stop-abyus', 'stop-ebyus'].includes(commandName)) {
      const isOwner = message.author.id === '436554535037698059';
      const isAdmin = message.member && message.member.permissions.has(PermissionsBitField.Flags.Administrator);
      if (!isOwner && !isAdmin) {
        return message.reply({ content: '❌ Akses Ditolak! Perintah ini dikunci khusus untuk Owner utama & Administrator server.', flags: 64 });
      }

      const nowUnix = Math.floor(Date.now() / 1000);
      database.run(
        'UPDATE ebyus_settings SET gacha_mode = ?, coin_multiplier = ?, expires_at = 0, is_active = 0, updated_at = ?, updated_by = ? WHERE guild_id = ?',
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
    // Perintah Khusus Owner: .ow (Membuka Dashboard Admin secara Privat)
    // ═══════════════════════════════════════════════════
    if (commandName === 'ow') {
      const isOwner = message.author.id === '436554535037698059';
      if (!isOwner) {
        return message.reply({ content: '❌ Akses Ditolak! Perintah ini dikunci khusus untuk Owner utama.', flags: 64 });
      }

      await message.delete().catch(() => {});

      const promptEmbed = new EmbedBuilder()
        .setColor(0x7C4DFF)
        .setDescription(`🔒 **Admin Panel Bot Kosan 1A** | <@${message.author.id}>, klik tombol di bawah ini untuk membuka Dashboard Admin secara rahasia.`);

      const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('eco_btn_open_admin_panel_private')
          .setLabel('🔑 Buka Admin Panel')
          .setStyle(ButtonStyle.Success)
      );

      const promptMsg = await message.channel.send({ embeds: [promptEmbed], components: [btnRow] });
      setTimeout(() => {
        promptMsg.delete().catch(() => {});
      }, 20000);

      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: .admin-panel / .adminpanel / .panel-admin / .paneladmin (Dashboard Kontrol Utama)
    // ═══════════════════════════════════════════════════
    if (['admin-panel', 'adminpanel', 'panel-admin', 'paneladmin'].includes(commandName)) {
      const isOwner = message.author.id === '436554535037698059';
      const isAdmin = message.member && message.member.permissions.has(PermissionsBitField.Flags.Administrator);
      if (!isOwner && !isAdmin) {
        return message.reply({ content: '❌ Akses Ditolak! Menu dashboard ini dikunci khusus untuk Owner utama & Administrator server.', flags: 64 });
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

      const { embed, row } = getPortalHubData(client);
      await message.channel.send({ embeds: [embed], components: [row] });
      return true;
    }

    // ═══════════════════════════════════════════════════
    // Perintah Admin: .setup-panel-admin / .setup-admin-panel
    // ═══════════════════════════════════════════════════
    if (['setup-admin-panel', 'setup-adminpanel', 'setup-panel-admin', 'setup-paneladmin'].includes(commandName)) {
      const isOwner = message.author.id === '436554535037698059';
      const isAdmin = message.member && message.member.permissions.has(PermissionsBitField.Flags.Administrator);
      if (!isOwner && !isAdmin) {
        await message.delete().catch(() => { });
        await author.send('❌ Akses Ditolak! Hanya Owner utama & Administrator yang dapat menggunakan perintah setup ini.').catch(() => { });
        return true;
      }

      const { ChannelType, PermissionFlagsBits } = require('discord.js');
      const guild = message.guild;

      // Look up parent category
      const STAFF_CATEGORY_ID = '1472479634971955221';
      const parentId = guild.channels.cache.has(STAFF_CATEGORY_ID) ? STAFF_CATEGORY_ID : null;

      try {
        // Look up existing channel
        let settings = database.get('SELECT * FROM ebyus_settings WHERE guild_id = ?', [guild.id]);
        let adminChannel = settings?.admin_panel_channel_id ? guild.channels.cache.get(settings.admin_panel_channel_id) : null;

        // Fallback: check by name
        if (!adminChannel) {
          adminChannel = guild.channels.cache.find(c => c.name === '🛡️┃panel-admin' || c.name === 'panel-admin');
        }

        if (!adminChannel) {
          // Create the channel
          adminChannel = await guild.channels.create({
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
            await adminChannel.lockPermissions().catch(() => { });
          } else {
            // If no staff category, allow Administrator role/permission explicitly
            const adminRoles = guild.roles.cache.filter(r => r.permissions.has(PermissionFlagsBits.Administrator));
            for (const [rId, role] of adminRoles) {
              await adminChannel.permissionOverwrites.edit(role.id, {
                ViewChannel: true,
                SendMessages: true,
                EmbedLinks: true
              }).catch(() => { });
            }
          }
        }

        // Update settings in database
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

        // Purge all messages in the channel to clean it up
        let fetched;
        do {
          fetched = await adminChannel.messages.fetch({ limit: 100 });
          if (fetched.size > 0) {
            try {
              await adminChannel.bulkDelete(fetched);
            } catch (err) {
              for (const msg of fetched.values()) {
                await msg.delete().catch(() => {});
              }
            }
          }
        } while (fetched.size > 0);

        // Send one persistent admin panel there
        const adminPanel = require('./adminPanel');
        await adminPanel.handleAdminPanel(adminChannel, client);

        return message.reply({ content: `✅ Berhasil setup channel khusus admin panel: <#${adminChannel.id}>!\nSeluruh pesan lama telah dibersihkan dan panel kontrol utama telah dikirim ke sana secara permanen.` });
      } catch (err) {
        console.error('Error setup admin panel channel:', err);
        return message.reply({ content: `❌ Gagal setup channel: ${err.message}` });
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
  handleEconomyCommands,
  getPortalHubData,
  sendInteractiveTradePanel
};
