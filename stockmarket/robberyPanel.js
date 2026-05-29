const database = require('./database');
const economy = require('./economy');
const embeds = require('./embeds');
const robbery = require('./robbery');
const config = require('./config');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, UserSelectMenuBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

/**
 * 💥 PUSAT KRIMINALITAS & LAPAS VIRTUAL (ROB & HEIST INTERACTIVE PANEL)
 * Menyediakan konsol terpadu untuk merampok solo, merencanakan bank heist,
 * mengecek/menebus lapas, dan melunasi hutang jaminan kepada sesama warga.
 */
async function handleRobberyPanel(messageOrInteraction, client) {
  const isInteraction = !messageOrInteraction.author;
  const author = isInteraction ? messageOrInteraction.user : messageOrInteraction.author;
  const guildId = messageOrInteraction.guildId;
  const guild = messageOrInteraction.guild;

  if (!guildId) return false;

  const getRobberyPanelData = (userId, gId) => {
    const wallet = economy.getWallet(userId, gId);
    const jailCheck = robbery.checkJail(userId, gId);
    const heistCd = robbery.getHeistCooldown(gId);
    
    // Query hutang yang dimiliki (kreditor)
    const debts = database.all('SELECT creditor_id, amount FROM bail_debts WHERE guild_id = ? AND debtor_id = ?', [gId, userId]);
    // Query piutang (orang yang berhutang ke kita)
    const receivables = database.all('SELECT debtor_id, amount FROM bail_debts WHERE guild_id = ? AND creditor_id = ?', [gId, userId]);

    const embed = new EmbedBuilder()
      .setColor(jailCheck.jailed ? embeds.COLORS.ERROR : embeds.COLORS.PURPLE)
      .setTitle('💥 PANEL KRIMINALITAS & LAPAS VIRTUAL 🚓')
      .setThumbnail('https://cdn-icons-png.flaticon.com/512/3233/3233481.png')
      .setTimestamp()
      .setFooter({ text: 'Sentinel Kriminalitas • Gunakan tombol dan menu di bawah!' });

    // Status Penjara
    let jailStatusText = '🟢 **Bebas Berkeliaran** (Tidak dalam sel)';
    if (jailCheck.jailed) {
      const releaseTime = Math.floor(Date.now() / 1000) + jailCheck.remaining;
      jailStatusText = `🚨 **DITAHAN DI SEL TAHANAN** (Bebas <t:${releaseTime}:R>)\n` +
                       `💰 **Uang Jaminan (Bail):** \`Rp ${jailCheck.bailAmount.toLocaleString('id-ID')}\` untuk bebas instan.`;
    }

    // Status Heist
    let heistStatusText = '🟢 **Siap Merampok Bank**';
    if (heistCd > 0) {
      const heistReadyTime = Math.floor(Date.now() / 1000) + heistCd;
      heistStatusText = `⏳ **Polisi Patroli Ketat** (Siap <t:${heistReadyTime}:R>)`;
    }

    embed.setDescription(
      `Halo **${author.username}**! Selamat datang di dashboard kriminalitas terpadu.\n` +
      `Di sini Anda dapat meluncurkan operasi perampokan, menebus jaminan penjara, atau melunasi hutang tebusan kepada teman Anda secara instan.\n\n` +
      `👤 **INFORMASI STATUS ANDA:**\n` +
      `• **Status Hukum:** ${jailStatusText}\n` +
      `• **Status Heist:** ${heistStatusText}\n` +
      `• **Dompet Aktif:** \`Rp ${wallet.balance.toLocaleString('id-ID')}\` *(Min. Rp ${config.robbery.MIN_ROB_BALANCE_ROBBER} untuk merampok)*\n`
    );

    // Rincian Hutang
    let debtText = '*✨ Bersih dari hutang tebusan!*';
    if (debts.length > 0) {
      debtText = debts.map(d => `• Berhutang ke <@${d.creditor_id}>: \`Rp ${d.amount.toLocaleString('id-ID')}\``).join('\n');
    }
    embed.addFields({ name: '🤝 DAFTAR HUTANG TEBUSAN ANDA', value: debtText, inline: false });

    // Rincian Piutang
    let recText = '*Tidak ada piutang.*';
    if (receivables.length > 0) {
      recText = receivables.map(r => `• <@${r.debtor_id}> berhutang ke Anda: \`Rp ${r.amount.toLocaleString('id-ID')}\``).join('\n');
    }
    embed.addFields({ name: '💰 DAFTAR PIUTANG (TEMAN BERHUTANG PADA ANDA)', value: recText, inline: false });

    const components = [];

    // Row 1: Dropdown Rob Solo (UserSelectMenu)
    const userRobSelect = new UserSelectMenuBuilder()
      .setCustomId('rob_panel_select_target')
      .setPlaceholder('💥 Pilih Warga untuk Dirampok Solo')
      .setDisabled(jailCheck.jailed || wallet.balance < config.robbery.MIN_ROB_BALANCE_ROBBER);

    components.push(new ActionRowBuilder().addComponents(userRobSelect));

    // Row 2: Dropdown Bayar Hutang (StringSelectMenu of Creditors)
    const debtSelect = new StringSelectMenuBuilder()
      .setCustomId('rob_panel_select_creditor')
      .setPlaceholder('🤝 Pilih Teman untuk Melunasi Hutang');

    if (debts.length > 0) {
      debts.forEach(d => {
        const cachedUser = client.users.cache.get(d.creditor_id);
        const nameLabel = cachedUser ? cachedUser.username : `ID: ${d.creditor_id}`;
        debtSelect.addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel(`Bayar ke ${nameLabel}`)
            .setDescription(`Hutang: Rp ${d.amount.toLocaleString('id-ID')}`)
            .setValue(d.creditor_id)
        );
      });
    } else {
      debtSelect.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Tidak Ada Hutang')
          .setValue('NONE')
      ).setDisabled(true);
    }
    components.push(new ActionRowBuilder().addComponents(debtSelect));

    // Row 3: Buttons
    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('rob_panel_btn_heist')
        .setLabel('🚨 Rencanakan Heist')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(jailCheck.jailed || heistCd > 0),
      new ButtonBuilder()
        .setCustomId('rob_panel_btn_bail')
        .setLabel('🔓 Tebus Jaminan')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!jailCheck.jailed || wallet.balance < jailCheck.bailAmount),
      new ButtonBuilder()
        .setCustomId('rob_panel_btn_info')
        .setLabel('ℹ️ Info & Resiko')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('rob_panel_btn_close')
        .setLabel('❌ Tutup Panel')
        .setStyle(ButtonStyle.Danger)
    );
    components.push(btnRow);

    return { embeds: [embed], components };
  };

  const initialData = getRobberyPanelData(author.id, guildId);
  let replyMsg;

  if (isInteraction) {
    await messageOrInteraction.update(initialData);
    replyMsg = messageOrInteraction.message;
  } else {
    replyMsg = await messageOrInteraction.reply(initialData);
  }

  const collector = replyMsg.createMessageComponentCollector({
    time: 300000
  });

  collector.on('collect', async iRob => {
    if (iRob.user.id !== author.id) {
      return iRob.reply({ content: '❌ Anda tidak memiliki wewenang untuk menggunakan tombol panel ini!', ephemeral: true });
    }

    try {
      if (iRob.customId === 'rob_panel_btn_close') {
        collector.stop();
        await replyMsg.delete().catch(() => {});
        return;
      }

      if (iRob.customId === 'rob_panel_btn_info') {
        const robInfoEmbed = embeds.robAnnouncementEmbed(guild);
        return iRob.reply({ embeds: [robInfoEmbed], ephemeral: true });
      }

      if (iRob.customId === 'rob_panel_btn_bail') {
        try {
          const res = robbery.payBail(author.id, guildId);
          const successEmb = embeds.successEmbed(
            'Jaminan Ditebus! 🔓',
            `Anda telah membayar uang jaminan sebesar **Rp ${res.bailAmount.toLocaleString('id-ID')}** dan bebas dari penjara virtual!\n` +
            `💵 **Saldo Dompet Baru:** **Rp ${res.newBalance.toLocaleString('id-ID')}**`
          );
          await iRob.reply({ embeds: [successEmb] });
          const fresh = getRobberyPanelData(author.id, guildId);
          await replyMsg.edit(fresh).catch(() => {});
        } catch (err) {
          await iRob.reply({ content: `❌ Gagal menebus jaminan: ${err.message}`, ephemeral: true });
        }
        return;
      }

      if (iRob.customId === 'rob_panel_btn_heist') {
        collector.stop('heist_transition');
        await replyMsg.delete().catch(() => {});
        
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

          const heistMsg = await iRob.channel.send({
            content: `🚨 **OPERASI PERAMPOKAN BANK DIMULAI!** 🚨`,
            embeds: [lobbyEmbed],
            components: [row]
          });

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

            await heistMsg.edit({ embeds: [updatedEmbed] }).catch(() => {});
          }, 10000);

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

              await heistMsg.edit({
                content: `💥 **OPERASI BANK HEIST SELESAI!**`,
                embeds: [resultEmbed],
                components: []
              }).catch(async () => {
                await iRob.channel.send({
                  content: `💥 **OPERASI BANK HEIST SELESAI!**`,
                  embeds: [resultEmbed]
                });
              });
            } catch (err) {
              console.error(err);
              await iRob.channel.send({ content: `❌ Gagal mengeksekusi heist: ${err.message}` });
            }
          }, 90000);

          const lobbyCollector = heistMsg.createMessageComponentCollector({
            time: 90000
          });

          lobbyCollector.on('collect', async iHeist => {
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

                await iHeist.reply({ content: `🤝 Anda berhasil bergabung dengan tim heist! Biaya persiapan Rp ${updatedLobby.prepFee} terpotong.`, ephemeral: true });
                await heistMsg.edit({ embeds: [updatedEmbed] }).catch(() => {});
              } 
              
              else if (iHeist.customId === 'heist_btn_cancel') {
                if (iHeist.user.id !== author.id) {
                  return iHeist.reply({ content: '❌ Hanya inisiator (otak kriminal) yang bisa membatalkan operasi!', ephemeral: true });
                }

                clearInterval(interval);
                robbery.cancelHeistLobby(author.id, guildId);
                
                await iHeist.reply({ content: '✖️ Operasi bank heist dibatalkan dan biaya persiapan telah dikembalikan ke seluruh kru.', ephemeral: false });
                await heistMsg.edit({
                  content: '❌ **Operasi bank heist dibatalkan oleh inisiator.**',
                  embeds: [],
                  components: []
                }).catch(() => {});
                lobbyCollector.stop();
              }
            } catch (err) {
              await iHeist.reply({ content: `❌ Error: ${err.message}`, ephemeral: true });
            }
          });

          lobbyCollector.on('end', () => {
            clearInterval(interval);
          });
        } catch (err) {
          await iRob.channel.send({ embeds: [embeds.errorEmbed('Gagal Memulai Heist!', err.message)] });
        }
        return;
      }

      if (iRob.customId === 'rob_panel_select_target') {
        const targetUserId = iRob.values[0];
        if (targetUserId === author.id) {
          return iRob.reply({ content: '❌ Anda tidak bisa merampok diri sendiri, carilah target lain!', ephemeral: true });
        }

        try {
          const res = robbery.robSolo(author.id, targetUserId, guildId);
          let reportEmb;
          if (res.success) {
            reportEmb = embeds.successEmbed(
              '💥 Perampokan Berhasil! 💰',
              `Anda berhasil merampok <@${targetUserId}>!\n\n` +
              `💸 **Uang Didapat:** **Rp ${res.amount.toLocaleString('id-ID')}** (Mencuri ${res.percent}% dari dompet target)${res.hasGembok ? ' *(Potong 50% karena target memiliki Gembok)*' : ''}.${res.petMsg}`
            );
          } else {
            reportEmb = embeds.errorEmbed(
              '🚓 Perampokan Gagal! 👮',
              `Anda gagal merampok <@${targetUserId}>!\n\n` +
              `💸 **Denda Kompensasi:** **Rp ${res.fine.toLocaleString('id-ID')}** (diberikan ke korban)${res.hasCctv ? ' *(Tambahan denda karena target memiliki CCTV)*' : ''}.\n` +
              `🔒 **Hukuman:** Dijebloskan ke **Penjara Virtual selama ${res.jailDurationMinutes} menit**!`
            );
          }
          await iRob.reply({ embeds: [reportEmb] });
          const fresh = getRobberyPanelData(author.id, guildId);
          await replyMsg.edit(fresh).catch(() => {});
        } catch (err) {
          await iRob.reply({ content: `❌ Gagal merampok: ${err.message}`, ephemeral: true });
        }
        return;
      }

      if (iRob.customId === 'rob_panel_select_creditor') {
        const creditorId = iRob.values[0];
        if (creditorId === 'NONE') return;

        const debt = database.get(
          'SELECT amount FROM bail_debts WHERE guild_id = ? AND debtor_id = ? AND creditor_id = ?',
          [guildId, author.id, creditorId]
        );

        if (!debt || debt.amount <= 0) {
          return iRob.reply({ content: '❌ Anda tidak memiliki hutang tebusan ke anggota ini!', ephemeral: true });
        }

        const modal = new ModalBuilder()
          .setCustomId(`rob_panel_pay_modal_${creditorId}`)
          .setTitle('Melunasi Hutang Tebusan');

        const amountInput = new TextInputBuilder()
          .setCustomId('pay_amount')
          .setLabel(`Jumlah Nominal (Hutang: Rp ${debt.amount.toLocaleString('id-ID')})`)
          .setPlaceholder('Ketik angka nominal atau "all" untuk lunas...')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
        await iRob.showModal(modal);

        const sub = await iRob.awaitModalSubmit({
          filter: (s) => s.customId === `rob_panel_pay_modal_${creditorId}` && s.user.id === author.id,
          time: 60000
        }).catch(() => null);

        if (sub) {
          try {
            const inputVal = sub.fields.getTextInputValue('pay_amount').trim().toLowerCase();
            const wallet = economy.getWallet(author.id, guildId);

            if (wallet.balance <= 0) {
              return sub.reply({ content: '❌ Saldo dompet Anda kosong (Rp 0). Anda tidak bisa membayar hutang.', ephemeral: true });
            }

            let amountToPay = debt.amount;
            if (inputVal !== 'all' && inputVal !== 'lunas') {
              const parsed = parseInt(inputVal);
              if (isNaN(parsed) || parsed <= 0) {
                return sub.reply({ content: '❌ Nominal pembayaran tidak valid!', ephemeral: true });
              }
              amountToPay = parsed;
            }

            amountToPay = Math.min(amountToPay, wallet.balance, debt.amount);

            database.transaction(() => {
              economy.subtractBalance(author.id, guildId, amountToPay, 'PAY_DEBT');
              economy.addBalance(creditorId, guildId, amountToPay, 'RECEIVE_DEBT_PAYMENT');
              
              const newDebtAmount = debt.amount - amountToPay;
              if (newDebtAmount <= 0) {
                database.run(
                  'DELETE FROM bail_debts WHERE guild_id = ? AND debtor_id = ? AND creditor_id = ?',
                  [guildId, author.id, creditorId]
                );
              } else {
                database.run(
                  'UPDATE bail_debts SET amount = ? WHERE guild_id = ? AND debtor_id = ? AND creditor_id = ?',
                  [newDebtAmount, guildId, author.id, creditorId]
                );
              }
            })();

            const remains = debt.amount - amountToPay;
            const remainsText = remains > 0 ? `Sisa hutang Anda: **Rp ${remains.toLocaleString('id-ID')}**` : '✨ **Hutang Anda sekarang LUNAS!**';

            const successEmb = embeds.successEmbed(
              'Pembayaran Hutang Sukses! 💸',
              `Anda telah membayar **Rp ${amountToPay.toLocaleString('id-ID')}** kepada <@${creditorId}> untuk melunasi hutang tebusan Anda.\n\n` +
              `${remainsText}`
            );
            await sub.reply({ embeds: [successEmb] });
            const fresh = getRobberyPanelData(author.id, guildId);
            await replyMsg.edit(fresh).catch(() => {});
          } catch (err) {
            await sub.reply({ content: `❌ Terjadi kesalahan: ${err.message}`, ephemeral: true });
          }
        }
        return;
      }
    } catch (err) {
      console.error('Error in Robbery Panel Interaction:', err);
      await iRob.reply({ content: `❌ Terjadi kesalahan: ${err.message}`, ephemeral: true }).catch(() => {});
    }
  });

  collector.on('end', async (collected, reason) => {
    if (reason === 'heist_transition') return;
    try {
      const fresh = getRobberyPanelData(author.id, guildId);
      fresh.components = [];
      await replyMsg.edit(fresh).catch(() => {});
    } catch (e) {}
  });

  return true;
}

module.exports = {
  handleRobberyPanel
};
