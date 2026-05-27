const config = require('./config');
const database = require('./database');
const economy = require('./economy');
const stocks = require('./stocks');
const antiSpam = require('./antiSpam');
const embeds = require('./embeds');
const scheduler = require('./scheduler');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle, ModalBuilder, PermissionsBitField } = require('discord.js');

// Owner ID dari environment variable (fallback ke default)
const OWNER_ID = process.env.OWNER_ID || '436554535037698059';

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

  let totalEarned = earnedCoins + investorBonus;

  // 3b. Cek Event Ekonomi: Double Earning Hour
  const events = require('./events');
  const activeEvent = events.getActiveEvent(guildId);
  if (activeEvent && activeEvent.type === 'DOUBLE_EARNING') {
    totalEarned *= 2;
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

      const replyMsg = await message.reply({ embeds: [embed], components: [row] });

      const collector = replyMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000
      });

      collector.on('collect', async i => {
        if (i.user.id !== author.id) {
          return i.reply({ content: '❌ Tombol ini hanya bisa digunakan oleh orang yang memanggil perintah ini!', ephemeral: true });
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
            const profileEmbed = embeds.profileEmbed(author, wallet, porto.totalPortfolioValue);
            await i.reply({ embeds: [profileEmbed] });
          } else if (i.customId === 'eco_btn_shop') {
            const wallet = economy.getWallet(author.id, guildId);
            const items = database.all('SELECT * FROM shop_items WHERE guild_id = ?', [guildId]);
            const shopEmbed = embeds.shopEmbed(items, wallet);
            await i.reply({ embeds: [shopEmbed] });
          } else if (i.customId === 'eco_btn_gacha') {
            const gachaCost = config.gacha.COST || 250;
            const wallet = economy.getWallet(author.id, guildId);
            const gachaPromptEmbed = new EmbedBuilder()
              .setColor(embeds.COLORS.INFO)
              .setTitle('🎲 Putar Gacha Role!')
              .setDescription(
                `Untuk memutar Gacha, silakan ketik \`.gacha-role\` di channel teks publik ini agar semua member dapat melihat animasi rolling dan hasil jackpot Anda secara langsung!\n\n` +
                `💵 **Saldo Anda:** Rp ${wallet.balance.toLocaleString('id-ID')}\n` +
                `💰 **Biaya Roll:** Rp ${gachaCost.toLocaleString('id-ID')}`
              )
              .setFooter({ text: 'Ketik .gacha-role di chat!' });
            await i.reply({ embeds: [gachaPromptEmbed] });
          } else if (i.customId === 'eco_btn_trade') {
            const latestStocks = stocks.getStocks(guildId);
            if (latestStocks.length === 0) {
              return i.reply({ content: '❌ Tidak ada instrumen saham aktif di server ini!', ephemeral: true });
            }

            const selectMenu = new StringSelectMenuBuilder()
              .setCustomId('eco_trade_select_stock')
              .setPlaceholder('👉 Pilih Saham untuk Diperdagangkan...');

            latestStocks.forEach(stock => {
              selectMenu.addOptions(
                new StringSelectMenuOptionBuilder()
                  .setLabel(`${stock.stock_ticker} - #${stock.stock_name}`)
                  .setDescription(`Harga: Rp ${stock.current_price.toLocaleString('id-ID')} | Sisa Bursa: ${stock.available_shares} lembar`)
                  .setValue(stock.stock_ticker)
              );
            });

            const selectRow = new ActionRowBuilder().addComponents(selectMenu);

            const tradeEmbed = new EmbedBuilder()
              .setColor(embeds.COLORS.INFO)
              .setTitle('📈 Menu Transaksi Saham Rupiah Server')
              .setDescription(
                `Pilih salah satu instrumen saham di bawah ini untuk memulai transaksi **Beli (BUY)** atau **Jual (SELL)** secara instan!\n\n` +
                `*Transaksi dilakukan secara aman dan privat (ephemeral).*`
              )
              .setFooter({ text: 'Rupiah Server • Interactive Trading' });

            const tradeMsg = await i.reply({
              embeds: [tradeEmbed],
              components: [selectRow],
              ephemeral: true,
              fetchReply: true
            });

            const tradeCollector = tradeMsg.createMessageComponentCollector({
              time: 120000 // 2 menit transaksi
            });

            let selectedTicker = null;

            const updateTradeMessage = async (interaction, ticker, isUpdateResponse = false) => {
              const stock = stocks.getStock(guildId, ticker);
              if (!stock) return;

              const wallet = economy.getWallet(author.id, guildId);
              const portfolio = database.get(
                'SELECT shares, avg_buy_price, total_invested FROM portfolios WHERE user_id = ? AND guild_id = ? AND channel_id = ?',
                [author.id, guildId, stock.channel_id]
              );
              const userShares = portfolio ? portfolio.shares : 0;
              const avgBuyPrice = portfolio ? portfolio.avg_buy_price : 0;
              const totalInvested = portfolio ? portfolio.total_invested : 0;

              const currentValue = userShares * stock.current_price;
              const profitRp = currentValue - totalInvested;
              const profitPercent = totalInvested > 0 ? ((profitRp / totalInvested) * 100).toFixed(1) : '0.0';
              const profitIndicator = profitRp >= 0 ? '🟢' : '🔴';
              const profitSign = profitRp >= 0 ? '+' : '';

              const activeStocksForSelect = stocks.getStocks(guildId);
              const freshSelectMenu = new StringSelectMenuBuilder()
                .setCustomId('eco_trade_select_stock')
                .setPlaceholder('👉 Pilih Saham untuk Diperdagangkan...');

              activeStocksForSelect.forEach(s => {
                freshSelectMenu.addOptions(
                  new StringSelectMenuOptionBuilder()
                    .setLabel(`${s.stock_ticker} - #${s.stock_name}`)
                    .setDescription(`Harga: Rp ${s.current_price.toLocaleString('id-ID')} | Sisa Bursa: ${s.available_shares} lembar`)
                    .setValue(s.stock_ticker)
                    .setDefault(s.stock_ticker === ticker)
                );
              });

              const freshSelectRow = new ActionRowBuilder().addComponents(freshSelectMenu);

              const detailEmbed = new EmbedBuilder()
                .setColor(profitRp >= 0 ? embeds.COLORS.SUCCESS : embeds.COLORS.ERROR)
                .setTitle(`📊 Transaksi Saham: ${stock.stock_ticker} — #${stock.stock_name}`)
                .setDescription(
                  `🏛️ **Harga Saham:** **Rp ${stock.current_price.toLocaleString('id-ID')}** per lembar\n` +
                  `📉 **Sisa Bursa:** \`${stock.available_shares} / ${stock.total_shares} lembar\`\n` +
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
                new ButtonBuilder().setCustomId('trade_buy_1').setLabel('📥 Beli 1').setStyle(ButtonStyle.Success).setDisabled(wallet.balance < stock.current_price || stock.available_shares < 1 || userShares >= 500),
                new ButtonBuilder().setCustomId('trade_buy_10').setLabel('📥 Beli 10').setStyle(ButtonStyle.Success).setDisabled(wallet.balance < stock.current_price * 10 || stock.available_shares < 10 || userShares + 10 > 500),
                new ButtonBuilder().setCustomId('trade_buy_50').setLabel('📥 Beli 50').setStyle(ButtonStyle.Success).setDisabled(wallet.balance < stock.current_price * 50 || stock.available_shares < 50 || userShares + 50 > 500),
                new ButtonBuilder().setCustomId('trade_buy_max').setLabel('📥 Beli Max').setStyle(ButtonStyle.Success).setDisabled(wallet.balance < stock.current_price || stock.available_shares < 1 || userShares >= 500),
                new ButtonBuilder().setCustomId('trade_buy_custom').setLabel('📥 Custom').setStyle(ButtonStyle.Success).setDisabled(wallet.balance < stock.current_price || stock.available_shares < 1 || userShares >= 500)
              );

              // SELL row
              const sellRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('trade_sell_1').setLabel('📤 Jual 1').setStyle(ButtonStyle.Danger).setDisabled(userShares < 1),
                new ButtonBuilder().setCustomId('trade_sell_10').setLabel('📤 Jual 10').setStyle(ButtonStyle.Danger).setDisabled(userShares < 10),
                new ButtonBuilder().setCustomId('trade_sell_50').setLabel('📤 Jual 50').setStyle(ButtonStyle.Danger).setDisabled(userShares < 50),
                new ButtonBuilder().setCustomId('trade_sell_all').setLabel('📤 Jual Semua').setStyle(ButtonStyle.Danger).setDisabled(userShares < 1),
                new ButtonBuilder().setCustomId('trade_sell_custom').setLabel('📤 Custom').setStyle(ButtonStyle.Danger).setDisabled(userShares < 1)
              );

              // Nav row
              const navRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('trade_btn_back').setLabel('⬅️ Kembali ke Pilihan').setStyle(ButtonStyle.Secondary)
              );

              const components = [freshSelectRow, buyRow, sellRow, navRow];

              if (isUpdateResponse) {
                await tradeMsg.edit({ embeds: [detailEmbed], components }).catch(console.error);
              } else {
                await interaction.update({ embeds: [detailEmbed], components });
              }
            };

            tradeCollector.on('collect', async iTrade => {
              if (iTrade.user.id !== author.id) {
                return iTrade.reply({ content: '❌ Tombol ini bukan untuk Anda!', ephemeral: true });
              }

              try {
                if (iTrade.customId === 'eco_trade_select_stock') {
                  selectedTicker = iTrade.values[0];
                  await updateTradeMessage(iTrade, selectedTicker);
                } else if (iTrade.customId.startsWith('trade_buy_') || iTrade.customId.startsWith('trade_sell_')) {
                  const action = iTrade.customId.startsWith('trade_buy_') ? 'BUY' : 'SELL';
                  const amountType = iTrade.customId.split('_').pop();

                  const stock = stocks.getStock(guildId, selectedTicker);
                  if (!stock) {
                    return iTrade.reply({ content: '❌ Saham tidak ditemukan!', ephemeral: true });
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
                        return iTrade.reply({ content: '❌ Anda tidak dapat membeli lembar saham lagi (saldo tidak cukup, stok bursa habis, atau sudah mencapai batas kepemilikan 500 lembar)!', ephemeral: true });
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
                          return submitted.reply({ content: '❌ Jumlah lembar harus berupa angka di atas 0!', ephemeral: true });
                        }

                        try {
                          const res = stocks.buyStock(author.id, guildId, selectedTicker, inputVal);
                          const successEmb = embeds.transactionSuccessEmbed(author, true, res);
                          await submitted.reply({ embeds: [successEmb], ephemeral: true });

                          if (inputVal >= 50) {
                            client.emit('playTtsEvent', {
                              guildId,
                              text: `Wow gila sih! Sultan ${author.username} baru saja memborong ${inputVal} lembar saham ${res.ticker} senilai total ${res.totalPrice} Rupiah! Hype banget bursa hari ini!`,
                              lang: 'id'
                            });
                          }

                          await updateTradeMessage(submitted, selectedTicker, true);
                        } catch (err) {
                          const cleaned = err.message.replace(/^❌\s*/, '');
                          await submitted.reply({ content: `❌ Transaksi gagal: ${cleaned}`, ephemeral: true });
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
                        return iTrade.reply({ content: '❌ Anda tidak memiliki saham ini untuk dijual!', ephemeral: true });
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
                          return submitted.reply({ content: '❌ Jumlah lembar harus berupa angka di atas 0!', ephemeral: true });
                        }

                        try {
                          const res = stocks.sellStock(author.id, guildId, selectedTicker, inputVal);
                          const successEmb = embeds.transactionSuccessEmbed(author, false, res);
                          await submitted.reply({ embeds: [successEmb], ephemeral: true });

                          if (inputVal >= 50) {
                            client.emit('playTtsEvent', {
                              guildId,
                              text: `Perhatian warga server! Sultan ${author.username} baru saja menjual ${inputVal} lembar saham ${res.ticker} senilai total ${res.finalRevenue} Rupiah! Pergerakan modal yang sangat besar!`,
                              lang: 'id'
                            });
                          }

                          await updateTradeMessage(submitted, selectedTicker, true);
                        } catch (err) {
                          const cleaned = err.message.replace(/^❌\s*/, '');
                          await submitted.reply({ content: `❌ Transaksi gagal: ${cleaned}`, ephemeral: true });
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
                        await iTrade.reply({ embeds: [successEmb], ephemeral: true });
                        
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
                        await iTrade.reply({ embeds: [successEmb], ephemeral: true });

                        if (shares >= 50) {
                          client.emit('playTtsEvent', {
                            guildId,
                            text: `Perhatian warga server! Sultan ${author.username} baru saja menjual ${shares} lembar saham ${res.ticker} senilai total ${res.finalRevenue} Rupiah! Pergerakan modal yang sangat besar!`,
                            lang: 'id'
                          });
                        }
                      }
                      await updateTradeMessage(iTrade, selectedTicker, true);
                    } catch (err) {
                      const cleaned = err.message.replace(/^❌\s*/, '');
                      await iTrade.reply({ content: `❌ Transaksi gagal: ${cleaned}`, ephemeral: true });
                    }
                  }
                } else if (iTrade.customId === 'trade_btn_back') {
                  selectedTicker = null;
                  const rowSelect = new ActionRowBuilder().addComponents(selectMenu);
                  await iTrade.update({ embeds: [tradeEmbed], components: [rowSelect] });
                }
              } catch (err) {
                console.error('Error in trade sub-collector:', err);
              }
            });

            tradeCollector.on('end', async () => {
              const selectDisabled = selectMenu.setDisabled(true);
              const rowSelectDisabled = new ActionRowBuilder().addComponents(selectDisabled);
              await tradeMsg.edit({ components: [rowSelectDisabled] }).catch(() => {});
            });
          }
        } catch (err) {
          console.error('Error handling button click:', err);
          await i.reply({ content: '❌ Terjadi kesalahan saat memproses permintaan Anda.', ephemeral: true }).catch(() => {});
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
        await replyMsg.edit({ components: [disabledRow] }).catch(() => {});
      });
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

      // Ambil 5 histori harga terakhir
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

      const replyMsg = await message.reply({ embeds: [embed], components: [row] });

      const collector = replyMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000
      });

      collector.on('collect', async i => {
        if (i.user.id !== author.id) {
          return i.reply({ content: '❌ Tombol ini hanya bisa digunakan oleh orang yang memanggil perintah ini!', ephemeral: true });
        }

        try {
          if (i.customId === 'eco_btn_profile') {
            const wallet = economy.getWallet(author.id, guildId);
            const porto = stocks.getPortfolio(author.id, guildId);
            const profileEmbed = embeds.profileEmbed(author, wallet, porto.totalPortfolioValue);
            await i.reply({ embeds: [profileEmbed] });
          } else if (i.customId === 'eco_btn_gacha') {
            const gachaCost = config.gacha.COST || 250;
            const wallet = economy.getWallet(author.id, guildId);
            const gachaPromptEmbed = new EmbedBuilder()
              .setColor(embeds.COLORS.INFO)
              .setTitle('🎲 Putar Gacha Role!')
              .setDescription(
                `Untuk memutar Gacha, silakan ketik \`.gacha-role\` di channel teks publik ini agar semua member dapat melihat animasi rolling dan hasil jackpot Anda secara langsung!\n\n` +
                `💵 **Saldo Anda:** Rp ${wallet.balance.toLocaleString('id-ID')}\n` +
                `💰 **Biaya Roll:** Rp ${gachaCost.toLocaleString('id-ID')}`
              )
              .setFooter({ text: 'Ketik .gacha-role di chat!' });
            await i.reply({ embeds: [gachaPromptEmbed] });
          }
        } catch (err) {
          console.error('Error handling button click in shop:', err);
          await i.reply({ content: '❌ Terjadi kesalahan saat memproses permintaan Anda.', ephemeral: true }).catch(() => {});
        }
      });

      collector.on('end', async () => {
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('eco_btn_profile').setLabel('💰 Profil & Saldo').setStyle(ButtonStyle.Success).setDisabled(true),
          new ButtonBuilder().setCustomId('eco_btn_gacha').setLabel('🎲 Gacha Role').setStyle(ButtonStyle.Danger).setDisabled(true)
        );
        await replyMsg.edit({ components: [disabledRow] }).catch(() => {});
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
        await memberObj.roles.remove(discordRole).catch(() => {});
        throw dbErr;
      }

      const successEmbed = embeds.rolePurchaseSuccessEmbed(author, item.role_name, item.price, finalWallet.balance, item.tier);
      await message.reply({ embeds: [successEmbed] });

      // Broadcast Heboh jika tingkat EPIC / LEGENDARY / MYTHIC
      if (item.tier === 'EPIC' || item.tier === 'LEGENDARY' || item.tier === 'MYTHIC') {
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
      const gachaCost = config.gacha.COST || 250;
      const wallet = economy.getWallet(author.id, guildId);

      if (wallet.balance < gachaCost) {
        return message.reply({ embeds: [embeds.warnEmbed('Saldo Koin Tidak Cukup!', `Biaya putar gacha adalah **Rp ${gachaCost.toLocaleString('id-ID')}**, sedangkan saldo Anda saat ini hanya **Rp ${wallet.balance.toLocaleString('id-ID')}**.`)] });
      }

      const gachaItems = database.all('SELECT * FROM shop_items WHERE guild_id = ? AND is_gacha = 1', [guildId]);
      if (gachaItems.length === 0) {
        return message.reply({ embeds: [embeds.warnEmbed('Gacha Tidak Tersedia!', 'Belum ada role gacha yang dikonfigurasi di server ini. Silakan admin menambahkan role gacha terlebih dahulu!')] });
      }

      // Animasi rolling menegangkan multi-tahap
      const rollingMsg = await message.reply('🎰 **[ GACHA START ]** Memasukkan koin ke mesin gacha... 🪙');

      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      await delay(1000);
      await rollingMsg.edit('🎰 `[ SPINNING... ] ────────── [ 🔄 ]` Menyeimbangkan tuas mesin gacha...');
      await delay(1200);
      await rollingMsg.edit('🎰 `[ FILTERING TIER... ] 💎✨ [ 🔮 ]` Menyaring tingkat kelangkaan...');
      await delay(1200);
      await rollingMsg.edit('🎰 `[ DECRYPTING JACKPOT... ] ⚡📦` Membuka peti misteri...');
      await delay(1000);

      // Probabilitas Gacha ZONK
      const roll = Math.random() * 100;
      const zonkRate = config.gacha.ZONK_RATE !== undefined ? config.gacha.ZONK_RATE : 75;

      if (roll < zonkRate) {
        // ZONK! Kurangi koin
        let finalWallet;
        database.transaction(() => {
          economy.subtractBalance(author.id, guildId, gachaCost, 'GACHA_SPEND', null);
        })();
        finalWallet = economy.getWallet(author.id, guildId);

        // Pilih item sampah acak
        const trashItems = config.gacha.TRASH_ITEMS || [{ name: 'Batu Kali', desc: 'Hanya batu biasa.' }];
        const selectedTrash = trashItems[Math.floor(Math.random() * trashItems.length)];

        const zonkEmbed = embeds.gachaResultEmbed(author, selectedTrash, gachaCost, finalWallet.balance, false);
        await rollingMsg.edit({ content: '🎰 **[ GACHA SELESAI! ]**', embeds: [zonkEmbed] });

        // TTS Zonk / Ampas (dengan penyebutan item sampah)
        client.emit('playTtsEvent', {
          guildId,
          text: `Amsyong! ${author.username} baru saja gacha seharga ${gachaCost} Rupiah, dan malah mendapatkan ${selectedTrash.name}! Sangat ampas!`,
          lang: 'id'
        });
        return true;
      }

      // MENANG! Kelompokkan berdasarkan Tier kelayakan yang ada stock-nya
      const mythic = gachaItems.filter(i => i.tier === 'MYTHIC' && (i.stock === -1 || i.stock > 0));
      const legendary = gachaItems.filter(i => i.tier === 'LEGENDARY' && (i.stock === -1 || i.stock > 0));
      const epic = gachaItems.filter(i => i.tier === 'EPIC' && (i.stock === -1 || i.stock > 0));
      const rare = gachaItems.filter(i => i.tier === 'RARE' && (i.stock === -1 || i.stock > 0));
      const common = gachaItems.filter(i => i.tier === 'COMMON' && (i.stock === -1 || i.stock > 0));

      const rates = config.gacha.RATES || { COMMON: 70, RARE: 22, EPIC: 6.8, LEGENDARY: 1.1, MYTHIC: 0.1 };
      const tierRoll = Math.random() * 100;
      let selectedItem = null;

      // Logika kumulatif berdasarkan tingkat kelangkaan rates
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
        // Fallback: jika tier terpilih kosong, ambil acak dari semua yang tersedia
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

      // Cek jika user sudah punya role tersebut -> beri cashback koin
      const alreadyHas = memberObj.roles.cache.has(selectedItem.role_id);
      const cashbackAmount = config.gacha.CASHBACK || 100;
      let finalWallet;

      if (alreadyHas) {
        database.transaction(() => {
          // Hanya kurangi koin bersih (gachaCost - cashback)
          const netCost = gachaCost - cashbackAmount;
          economy.subtractBalance(author.id, guildId, netCost, 'GACHA_SPEND_CASHBACK', null);
        })();
        finalWallet = economy.getWallet(author.id, guildId);

        const winEmbed = embeds.gachaResultEmbed(author, selectedItem, gachaCost, finalWallet.balance, true);
        winEmbed.setDescription(
          `**${author.username}** baru saja melakukan roll Gacha seharga **Rp ${gachaCost.toLocaleString('id-ID')}**!\n\n` +
          `🎰 **HASIL ROLL:**\n` +
          `🌟 **${selectedItem.role_name}** (\`${selectedItem.tier}\`)\n\n` +
          `💸 **DUPLIKAT CASHBACK!** Karena Anda sudah memiliki role ini, Anda mendapatkan **cashback Rp ${cashbackAmount}**! Saldo Anda dikembalikan sebagian.\n` +
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

        // Broadcast Heboh jika Legendary / Epic / Mythic
        if (selectedItem.tier === 'EPIC' || selectedItem.tier === 'LEGENDARY' || selectedItem.tier === 'MYTHIC') {
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
    // PROTEKSI ADMIN: Hanya bisa digunakan oleh Owner atau Administrator Guild
    // ═══════════════════════════════════════════════════
    const adminCommands = ['eco-give', 'eco-giveall', 'eco-take', 'market-add', 'market-remove', 'eco-reset', 'eco-resetall', 'market-reinit', 'shop-add', 'shop-remove', 'shop-setstock', 'eco-announce', 'event-trigger', 'autoshoprole', 'shop-auto', 'anoncemen', 'announcement', 'dividends-trigger'];
    if (adminCommands.includes(commandName)) {
      const isOwner = author.id === OWNER_ID;
      const isAdmin = message.member && message.member.permissions.has('Administrator');
      if (!isOwner && !isAdmin) {
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
        
        await targetChannel.send({ embeds: [embed] }).catch(() => {});
      }

      const successEmbed = embeds.successEmbed(
        'Dividen Berhasil Didistribusikan!',
        `Sukses mendistribusikan dividen dinamis ke **${distributions.length} investor** server.`
      );
      await message.reply({ embeds: [successEmbed] });
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
      
      // Ambil daftar member secara aman & robust dengan fallback jika intent tidak aktif
      try {
        const fetchedMembers = await guild.members.fetch();
        for (const [id, member] of fetchedMembers) {
          if (!member.user.bot) {
            memberIds.add(id);
          }
        }
      } catch (err) {
        console.warn('Gagal fetch all members (intent GuildMembers mungkin belum aktif):', err.message);
        
        // Fallback 1: Ambil dari cache
        guild.members.cache.forEach(member => {
          if (!member.user.bot) {
            memberIds.add(member.id);
          }
        });

        // Fallback 2: Ambil dari database wallets (user aktif)
        try {
          const activeWallets = database.all('SELECT user_id FROM wallets WHERE guild_id = ?', [guildId]);
          activeWallets.forEach(w => {
            memberIds.add(w.user_id);
          });
        } catch (dbErr) {
          console.error('Gagal mengambil wallets dari db:', dbErr.message);
        }
      }

      if (memberIds.size === 0) {
        const errEmbed = embeds.errorEmbed('Gagal!', 'Tidak dapat menemukan member untuk dibagikan koin.');
        return statusMsg.edit({ embeds: [errEmbed] });
      }

      let totalAmountGiven = 0;
      let memberCount = 0;

      try {
        // Jangan gunakan database.transaction di sini karena economy.addBalance sudah menggunakannya secara internal.
        // Loop ini sangat cepat karena SQLite WAL mode aktif.
        for (const memberId of memberIds) {
          let giveAmount = amount;
          if (isRandom) {
            giveAmount = Math.floor(Math.random() * (maxRange - minRange + 1)) + minRange;
          }
          economy.addBalance(memberId, guildId, giveAmount, 'ADMIN_GIVEALL');
          totalAmountGiven += giveAmount;
          memberCount++;
        }
      } catch (dbErr) {
        console.error('Database error in eco-giveall:', dbErr);
        const errEmbed = embeds.errorEmbed('Database Error!', 'Terjadi kesalahan internal saat memperbarui saldo database.');
        return statusMsg.edit({ embeds: [errEmbed] });
      }

      const successTitle = isRandom ? '🎰 RAIN / AIRDROP KOIN ACAK SUKSES! 💸' : '📢 BAGI-BAGI KOIN MASSAL SUKSES! 💸';
      
      let successDesc = '';
      if (isRandom) {
        successDesc = `👑 **KEMAKMURAN UNTUK SEMUA!**\n\n` +
                      `Owner / Administrator telah menyebarkan koin keberuntungan acak kepada **${memberCount} member** server!\n\n` +
                      `📊 **Metode Distribusi:** \`🎰 Acak (Random Roll)\`\n` +
                      `📈 **Rentang Hadiah:** \`Rp ${minRange.toLocaleString('id-ID')} - Rp ${maxRange.toLocaleString('id-ID')}\` per member\n` +
                      `💰 **Total Koin Tersebar:** **Rp ${totalAmountGiven.toLocaleString('id-ID')}** koin\n\n` +
                      `*Setiap warga menerima jumlah koin acak masing-masing yang unik. Cek saldo Anda dengan perintah \`.bal\`!* 🚀`;
      } else {
        successDesc = `👑 **DISTRIBUSI KESEJAHTERAAN SELESAI!**\n\n` +
                      `Owner / Administrator telah membagikan koin secara merata kepada **${memberCount} member** server!\n\n` +
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

      // Kirim Embed Pengumuman Pembaruan Cantik & Rapi dengan tag @everyone
      const embed = embeds.updateAnnouncementEmbed(message.guild);
      await targetChannel.send({ 
        content: '📢 **Pemberitahuan Pembaruan Sistem Ekonomi Bot!** @everyone', 
        embeds: [embed],
        allowedMentions: { parse: ['everyone'] }
      });

      if (targetChannel.id !== message.channel.id) {
        await message.reply(`✅ **Berhasil!** Pengumuman pembaruan ekonomi telah diposting secara eksklusif dengan embed cantik di channel ${targetChannel}.`);
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
