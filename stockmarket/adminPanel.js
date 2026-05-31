const config = require('./config');
const database = require('./database');
const economy = require('./economy');
const stocks = require('./stocks');
const embeds = require('./embeds');
const scheduler = require('./scheduler');
const robbery = require('./robbery');
const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder, 
  StringSelectMenuOptionBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ModalBuilder, 
  PermissionsBitField, 
  UserSelectMenuBuilder 
} = require('discord.js');

/**
 * Global database helper for Ebyus settings.
 */
function getOrCreateEbyusSettings(gId) {
  let settings = database.get('SELECT * FROM ebyus_settings WHERE guild_id = ?', [gId]);
  if (!settings) {
    database.run('INSERT INTO ebyus_settings (guild_id, gacha_mode, coin_multiplier, updated_at, updated_by, expires_at) VALUES (?, ?, ?, ?, ?, 0)', [gId, 'NORMAL', 1, 0, '']);
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
}

/**
 * 🐾 1. PANEL PET & KANDANG (TAMAGOTCHI)
 */
async function handleAdminPetPanel(messageOrInteraction, client, initialTargetUserId = null) {
  const isInteraction = !messageOrInteraction.author;
  const author = isInteraction ? messageOrInteraction.user : messageOrInteraction.author;
  const guildId = messageOrInteraction.guildId;
  const guild = messageOrInteraction.guild;

  const isOwner = author.id === '436554535037698059';
  const isAdmin = messageOrInteraction.member && messageOrInteraction.member.permissions.has(PermissionsBitField.Flags.Administrator);
  if (!isOwner && !isAdmin) {
    if (isInteraction) {
      return messageOrInteraction.reply({ content: '❌ Akses Ditolak! Panel Admin Pet dikunci khusus untuk Owner utama & Administrator server.', flags: 64 });
    } else {
      return messageOrInteraction.reply({ content: '❌ Akses Ditolak! Panel Admin Pet dikunci khusus untuk Owner utama & Administrator server.' });
    }
  }

  if (!guildId) return false;

  let selectedTargetUserId = initialTargetUserId;

  const getPetPanelData = (gId, targetUserId) => {
    let embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('🐾 ADMIN CONTROL PANEL — PET TAMAGOTCHI')
      .setThumbnail(client.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({ text: 'Sentinel Admin • Kandang & Perawatan Pet' });

    let targetText = '*Belum ada anggota terpilih (Silakan pilih di menu dropdown di bawah)*';
    if (targetUserId) {
      targetText = `🎯 **<@${targetUserId}>**\n` +
                   `• ID: \`${targetUserId}\`\n`;

      const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [targetUserId, gId]);
      const wallet = database.get('SELECT daily_expedition_count, expedition_cooldown_until FROM wallets WHERE user_id = ? AND guild_id = ?', [targetUserId, gId]);
      const expCount = wallet ? (wallet.daily_expedition_count || 0) : 0;
      const expCD = wallet ? (wallet.expedition_cooldown_until || 0) : 0;
      const nowUnix = Math.floor(Date.now() / 1000);
      const cdText = expCD > nowUnix ? `<t:${expCD}:R>` : '🟢 Ready';

      if (targetPet) {
        const autoFeedLabel = targetPet.auto_feed === 2 ? '👑 VIP (Gratis)' : (targetPet.auto_feed === 1 ? '✅ Aktif (Bayar)' : '❌ Nonaktif');
        const traitLabel = targetPet.trait ? `**${targetPet.trait}**` : '*Tidak ada*';

        targetText += `• Pet: **${targetPet.pet_name}** (Lv.${targetPet.level} ${targetPet.pet_type.toUpperCase()})\n` +
                      `• HP: \`${targetPet.health}%\` | XP: \`${targetPet.xp}/${targetPet.level * 100}\`\n` +
                      `• Kenyang: \`${targetPet.hunger}%\` | Hidrasi: \`${targetPet.thirst}%\` | Ceria: \`${targetPet.happiness}%\`\n` +
                      `• Trait: ${traitLabel}\n` +
                      `• Auto-Feed: ${autoFeedLabel}\n` +
                      `• Status: **${targetPet.status}**\n` +
                      `• Ekspedisi Harian: \`${expCount}/10\` | Cooldown: ${cdText}\n`;
      } else {
        targetText += `• Pet: *Tidak ada peliharaan aktif*\n` +
                      `• Ekspedisi Harian: \`${expCount}/10\` | Cooldown: ${cdText}\n`;
      }
    }

    embed.setDescription(
      `Gunakan menu di bawah untuk memilih target anggota, lalu tentukan tindakan cepat untuk mengelola peliharaan mereka:\n\n` +
      `👤 **INFORMASI TARGET ANGGOTA:**\n${targetText}`
    );

    const userSelect = new UserSelectMenuBuilder()
      .setCustomId('admin_pet_select_target')
      .setPlaceholder('👤 Pilih Target Anggota');

    const userRow = new ActionRowBuilder().addComponents(userSelect);

    const actionSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_pet_select_action')
      .setPlaceholder('🎯 Pilih Tindakan Perawatan Pet')
      .setDisabled(!targetUserId);

    actionSelect.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('❤️ Sembuhkan & Pulihkan Pet')
        .setDescription('Mengisi HP, Kenyangan, Hidrasi & Kebahagiaan Pet menjadi 100%')
        .setValue('action_heal_pet'),
      new StringSelectMenuOptionBuilder()
        .setLabel('💖 Hidupkan Kembali Pet (Revive)')
        .setDescription('Menghidupkan kembali pet yang mati (DEAD) dan memulihkan HP/status ke 100%')
        .setValue('action_revive_pet'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🐣 Percepat Penetasan Telur Pet')
        .setDescription('Mengatur telur agar siap menetas saat ini juga')
        .setValue('action_hatch_pet'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🛡️ Reset Cooldown Ekspedisi')
        .setDescription('Mereset batas harian & cooldown ekspedisi pet target')
        .setValue('action_reset_expedition_cooldown'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🧪 Suntik Custom XP Pet (Modal)')
        .setDescription('Menambahkan jumlah XP tertentu ke Pet target')
        .setValue('action_give_xp_pet_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🦁 Ubah Level Pet (Modal)')
        .setDescription('Mengatur level Pet target secara instan')
        .setValue('action_set_level_pet_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🧬 Modifikasi Trait Pet (Modal)')
        .setDescription('Mengubah Trait khusus (MUTANT, GENIUS, dll) pet target')
        .setValue('action_change_trait_pet_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('⏳ Reset Cooldown Aktivitas')
        .setDescription('Reset cooldown Bekerja, Berburu, & Bermain pet target')
        .setValue('action_reset_activity_cooldowns'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🔋 Toggle VIP Auto-Feed')
        .setDescription('Toggle fitur Auto-Feed Gratis (VIP) untuk pet target')
        .setValue('action_toggle_vip_autofeed'),
      new StringSelectMenuOptionBuilder()
        .setLabel('💀 Reset Data Pet Kandang')
        .setDescription('Menghapus total Pet target dari kandang (database)')
        .setValue('action_reset_pet'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🎁 Beri Pet Kustom (Modal)')
        .setDescription('Buatkan pet baru dengan spesies, level, & trait khusus')
        .setValue('action_give_custom_pet_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('📸 Ubah Gambar Pet Custom (Modal)')
        .setDescription('Mengubah atau menghapus gambar/GIF custom pet target')
        .setValue('action_set_custom_image_modal')
    );

    const actionRow = new ActionRowBuilder().addComponents(actionSelect);

    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_pet_btn_back')
        .setLabel('🔙 Kembali ke Hub')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('admin_pet_btn_audit')
        .setLabel('🏆 Audit & Leaderboard Pet')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('admin_pet_btn_close')
        .setLabel('❌ Tutup Panel')
        .setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [userRow, actionRow, btnRow] };
  };

  const initialData = getPetPanelData(guildId, selectedTargetUserId);
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

  collector.on('collect', async iPet => {
    const isOwner = iPet.user.id === '436554535037698059';
    const isAdmin = iPet.member && iPet.member.permissions.has(PermissionsBitField.Flags.Administrator);
    if (!isOwner && !isAdmin) {
      return iPet.reply({ content: '❌ Akses Ditolak! Tombol/menu dashboard ini dikunci khusus untuk Owner utama & Administrator server.', flags: 64 });
    }

    try {
      if (iPet.customId === 'admin_pet_select_target') {
        selectedTargetUserId = iPet.values[0];
        const fresh = getPetPanelData(guildId, selectedTargetUserId);
        await iPet.update(fresh);
      }
      else if (iPet.customId === 'admin_pet_btn_back') {
        collector.stop('transition');
        await handleAdminPanel(iPet, client);
      }
      else if (iPet.customId === 'admin_pet_btn_close') {
        collector.stop();
        await replyMsg.delete().catch(() => {});
      }
      else if (iPet.customId === 'admin_pet_btn_audit') {
        // Query Top 3 Level
        const topLevels = database.all(
          `SELECT pet_name, pet_type, level, user_id 
           FROM user_pets 
           WHERE guild_id = ? AND is_active = 1 
           ORDER BY level DESC, xp DESC 
           LIMIT 3`, 
          [guildId]
        );

        // Query Top 3 PVP wins
        const topPvp = database.all(
          `SELECT pet_name, pet_type, pvp_wins, user_id 
           FROM user_pets 
           WHERE guild_id = ? AND is_active = 1 
           ORDER BY pvp_wins DESC 
           LIMIT 3`, 
          [guildId]
        );

        // Query Summary Status
        const summaryStatus = database.all(
          `SELECT status, COUNT(*) as count 
           FROM user_pets 
           WHERE guild_id = ? 
           GROUP BY status`, 
          [guildId]
        );

        // Query Summary Species
        const summarySpecies = database.all(
          `SELECT pet_type, COUNT(*) as count 
           FROM user_pets 
           WHERE guild_id = ? 
           GROUP BY pet_type`, 
          [guildId]
        );

        // Build Embed
        const auditEmbed = new EmbedBuilder()
          .setColor(0x8E44AD)
          .setTitle('🏆 AUDIT & LEADERBOARD PET — GLOBAL SERVER')
          .setThumbnail(client.user.displayAvatarURL())
          .setTimestamp();

        let lvlText = '';
        if (topLevels.length === 0) {
          lvlText = '*Belum ada data pet terdaftar.*';
        } else {
          topLevels.forEach((pet, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
            lvlText += `${medal} **${pet.pet_name}** (${pet.pet_type}) — **Lv.${pet.level}**\n` +
                       `> Owner: <@${pet.user_id}>\n`;
          });
        }

        let pvpText = '';
        if (topPvp.length === 0) {
          pvpText = '*Belum ada data pvp pet.*';
        } else {
          topPvp.forEach((pet, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
            pvpText += `${medal} **${pet.pet_name}** (${pet.pet_type}) — **${pet.pvp_wins} Kemenangan**\n` +
                       `> Owner: <@${pet.user_id}>\n`;
          });
        }

        let statusText = '';
        const statusMap = { 'EGG': '🥚 Telur', 'BABY': '👶 Bayi', 'ADULT': '🦁 Dewasa', 'DEAD': '🪦 Meninggal' };
        summaryStatus.forEach(row => {
          const label = statusMap[row.status] || row.status;
          statusText += `• ${label}: **${row.count} pet**\n`;
        });
        if (!statusText) statusText = '*Tidak ada data.*';

        let speciesText = '';
        const speciesMap = { 'SLIME': '🟢 Slime', 'DRAGON': '🔥 Dragon', 'CAT': '🐱 Cat', 'GOLEM': '🧱 Golem' };
        summarySpecies.forEach(row => {
          const label = speciesMap[row.pet_type] || row.pet_type;
          speciesText += `• ${label}: **${row.count} pet**\n`;
        });
        if (!speciesText) speciesText = '*Tidak ada data.*';

        auditEmbed.addFields(
          { name: '🌟 TOP LEVEL PET', value: lvlText, inline: false },
          { name: '⚔️ TOP PvP ARENA WINS', value: pvpText, inline: false },
          { name: '📊 STATUS KANDANG GLOBAL', value: statusText, inline: true },
          { name: '🧬 DISTRIBUSI SPESIES', value: speciesText, inline: true }
        );

        return iPet.reply({ embeds: [auditEmbed], flags: 64 });
      }
      else if (iPet.customId === 'admin_pet_select_action') {
        const action = iPet.values[0];
        if (!selectedTargetUserId) {
          return iPet.reply({ content: '❌ Silakan pilih target anggota terlebih dahulu!', flags: 64 });
        }

        if (action === 'action_hatch_pet') {
          const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          if (!targetPet) {
            return iPet.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan!', flags: 64 });
          }
          if (targetPet.status !== 'EGG') {
            return iPet.reply({ content: '❌ Pet milik anggota terpilih sudah menetas!', flags: 64 });
          }
          const now = Math.floor(Date.now() / 1000);
          database.run('UPDATE user_pets SET hatch_at = ? WHERE user_id = ? AND guild_id = ? AND is_active = 1', [now - 10, selectedTargetUserId, guildId]);
          await iPet.reply({ content: `🐣 Sukses mempercepat penetasan telur pet **${targetPet.pet_name}** milik <@${selectedTargetUserId}>. Telur sekarang siap menetas!`, flags: 64 });
          const fresh = getPetPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => {});
        }
        else if (action === 'action_heal_pet') {
          const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          if (!targetPet) {
            return iPet.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan!', flags: 64 });
          }
          const maxHP = targetPet.pet_type === 'SLIME' ? 120 : 100;
          database.run('UPDATE user_pets SET health = ?, hunger = 100, thirst = 100, happiness = 100 WHERE user_id = ? AND guild_id = ? AND is_active = 1', [maxHP, selectedTargetUserId, guildId]);
          await iPet.reply({ content: `❤️ Sukses memulihkan stats HP (${maxHP} HP), Kenyangan, & Hidrasi pet milik <@${selectedTargetUserId}> menjadi 100%.`, flags: 64 });
          const fresh = getPetPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => {});
        }
        else if (action === 'action_revive_pet') {
          const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          if (!targetPet) {
            return iPet.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan!', flags: 64 });
          }
          if (targetPet.status !== 'DEAD') {
            return iPet.reply({ content: `❌ Pet milik <@${selectedTargetUserId}> (**${targetPet.pet_name}**) masih hidup (Status: **${targetPet.status}**)!`, flags: 64 });
          }
          const maxHP = targetPet.pet_type === 'SLIME' ? 120 : 100;
          const newStatus = targetPet.level >= 10 ? 'ADULT' : 'BABY';
          const now = Math.floor(Date.now() / 1000);
          
          database.run(
            `UPDATE user_pets 
             SET status = ?, health = ?, hunger = 100, thirst = 100, happiness = 100, last_interaction_at = ? 
             WHERE user_id = ? AND guild_id = ? AND is_active = 1`,
            [newStatus, maxHP, now, selectedTargetUserId, guildId]
          );
          
          await iPet.reply({ content: `💖 Sukses menghidupkan kembali pet **${targetPet.pet_name}** milik <@${selectedTargetUserId}>! Status diubah menjadi **${newStatus}** dengan HP & Kebutuhan penuh 100%.`, flags: 64 });
          const fresh = getPetPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => {});
        }
        else if (action === 'action_reset_expedition_cooldown') {
          database.run('UPDATE wallets SET daily_expedition_count = 0, expedition_cooldown_until = 0 WHERE user_id = ? AND guild_id = ?', [selectedTargetUserId, guildId]);
          await iPet.reply({ content: `🛡️ Sukses mereset batas harian & cooldown ekspedisi pet milik <@${selectedTargetUserId}>!`, flags: 64 });
          const fresh = getPetPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => {});
        }
        else if (action === 'action_give_xp_pet_modal') {
          const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          if (!targetPet) {
            return iPet.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan!', flags: 64 });
          }
          
          const modal = new ModalBuilder()
            .setCustomId('admin_pet_give_xp_modal')
            .setTitle('Suntik XP Pet Member');

          const xpInput = new TextInputBuilder()
            .setCustomId('xp_amount')
            .setLabel('Jumlah XP Pet')
            .setPlaceholder('Contoh: 500')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(xpInput));
          await iPet.showModal(modal);

          const sub = await iPet.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_pet_give_xp_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const amount = parseInt(sub.fields.getTextInputValue('xp_amount'));
            if (isNaN(amount) || amount <= 0) {
              return sub.reply({ content: '❌ Jumlah harus berupa angka bulat di atas 0!', flags: 64 });
            }
            const petData = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
            if (!petData) {
              return sub.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan!', flags: 64 });
            }
            let newXp = petData.xp + amount;
            let level = petData.level;
            const xpNeeded = level * 100;
            let leveledUp = false;
            if (newXp >= xpNeeded) {
              newXp -= xpNeeded;
              level += 1;
              leveledUp = true;
            }
            database.run('UPDATE user_pets SET xp = ?, level = ? WHERE user_id = ? AND guild_id = ? AND is_active = 1', [newXp, level, selectedTargetUserId, guildId]);
            
            await sub.reply({ content: `🧪 Sukses memberikan **+${amount} XP** ke pet milik <@${selectedTargetUserId}>!${leveledUp ? ` Pet naik ke Level **${level}**! 🎉` : ''}`, flags: 64 });
            const fresh = getPetPanelData(guildId, selectedTargetUserId);
            await replyMsg.edit(fresh).catch(() => {});
          }
        }
        else if (action === 'action_set_level_pet_modal') {
          const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          if (!targetPet) {
            return iPet.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan!', flags: 64 });
          }
          
          const modal = new ModalBuilder()
            .setCustomId('admin_pet_set_level_modal')
            .setTitle('Atur Level Pet Member');

          const lvlInput = new TextInputBuilder()
            .setCustomId('lvl_amount')
            .setLabel('Level Pet (1 - 100)')
            .setPlaceholder('Contoh: 10')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(lvlInput));
          await iPet.showModal(modal);

          const sub = await iPet.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_pet_set_level_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const level = parseInt(sub.fields.getTextInputValue('lvl_amount'));
            if (isNaN(level) || level <= 0 || level > 100) {
              return sub.reply({ content: '❌ Level harus berupa angka bulat antara 1 hingga 100!', flags: 64 });
            }
            const petData = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
            if (!petData) {
              return sub.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan!', flags: 64 });
            }
            
            let newStatus = petData.status;
            if (newStatus !== 'DEAD') {
              newStatus = level >= 10 ? 'ADULT' : (newStatus === 'EGG' ? 'EGG' : 'BABY');
            }
            
            database.run('UPDATE user_pets SET level = ?, status = ? WHERE user_id = ? AND guild_id = ? AND is_active = 1', [level, newStatus, selectedTargetUserId, guildId]);
            
            await sub.reply({ content: `🦁 Sukses mengatur level pet milik <@${selectedTargetUserId}> menjadi Level **${level}**! (Status: **${newStatus}**)`, flags: 64 });
            const fresh = getPetPanelData(guildId, selectedTargetUserId);
            await replyMsg.edit(fresh).catch(() => {});
          }
        }
        else if (action === 'action_change_trait_pet_modal') {
          const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          if (!targetPet) {
            return iPet.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan aktif!', flags: 64 });
          }

          const modal = new ModalBuilder()
            .setCustomId('admin_pet_change_trait_modal')
            .setTitle('Modifikasi Trait Pet');

          const traitInput = new TextInputBuilder()
            .setCustomId('trait_name')
            .setLabel('Trait (MUTANT, GENIUS, STURDY, WARRIOR, NONE)')
            .setPlaceholder('Ketik nama trait atau NONE untuk menghapus')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(traitInput));
          await iPet.showModal(modal);

          const sub = await iPet.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_pet_change_trait_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const rawTrait = sub.fields.getTextInputValue('trait_name').trim().toUpperCase();
            const validTraits = ['MUTANT', 'GENIUS', 'STURDY', 'WARRIOR'];
            
            let finalTrait = '';
            if (rawTrait !== 'NONE' && validTraits.includes(rawTrait)) {
              finalTrait = rawTrait;
            }

            database.run('UPDATE user_pets SET trait = ? WHERE user_id = ? AND guild_id = ? AND is_active = 1', [finalTrait, selectedTargetUserId, guildId]);
            
            const traitMsg = finalTrait ? `menjadi Trait **${finalTrait}**` : 'menjadi **Tanpa Trait** (NONE)';
            await sub.reply({ content: `🧬 Sukses mengubah trait pet aktif milik <@${selectedTargetUserId}> ${traitMsg}!`, flags: 64 });
            const fresh = getPetPanelData(guildId, selectedTargetUserId);
            await replyMsg.edit(fresh).catch(() => {});
          }
        }
        else if (action === 'action_reset_activity_cooldowns') {
          const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          if (!targetPet) {
            return iPet.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan aktif!', flags: 64 });
          }

          database.run(
            `UPDATE user_pets 
             SET last_work_at = 0, last_hunt_at = 0, last_play_at = 0 
             WHERE user_id = ? AND guild_id = ? AND is_active = 1`, 
            [selectedTargetUserId, guildId]
          );

          await iPet.reply({ content: `⏳ Sukses mereset cooldown Bekerja, Berburu, & Bermain pet aktif milik <@${selectedTargetUserId}> secara instan!`, flags: 64 });
          const fresh = getPetPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => {});
        }
        else if (action === 'action_toggle_vip_autofeed') {
          const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          if (!targetPet) {
            return iPet.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan aktif!', flags: 64 });
          }

          const newStatus = targetPet.auto_feed === 2 ? 0 : 2;
          database.run(
            'UPDATE user_pets SET auto_feed = ? WHERE user_id = ? AND guild_id = ? AND is_active = 1',
            [newStatus, selectedTargetUserId, guildId]
          );

          const statusMsg = newStatus === 2 ? '👑 **VIP Gratis (Auto-Feed tanpa biaya)**' : '❌ **Nonaktif**';
          await iPet.reply({ content: `🔋 Sukses mengubah mode Auto-Feed pet aktif milik <@${selectedTargetUserId}> menjadi ${statusMsg}!`, flags: 64 });
          const fresh = getPetPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => {});
        }
        else if (action === 'action_give_custom_pet_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_pet_give_custom_modal')
            .setTitle('Beri Pet Kustom');

          const nameInput = new TextInputBuilder()
            .setCustomId('custom_pet_name')
            .setLabel('Nama Pet')
            .setPlaceholder('Contoh: Ciko')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const typeInput = new TextInputBuilder()
            .setCustomId('custom_pet_type')
            .setLabel('Spesies (Slime/Dragon/Cat/Golem)')
            .setPlaceholder('Ketik jenis pet')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const traitInput = new TextInputBuilder()
            .setCustomId('custom_pet_trait')
            .setLabel('Trait (Genius/Sturdy/Mutant/Warrior/None)')
            .setPlaceholder('Kosongkan jika tidak ada')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

          const lvlInput = new TextInputBuilder()
            .setCustomId('custom_pet_level')
            .setLabel('Level Awal (1 - 100)')
            .setPlaceholder('Default: 1')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

          const statusInput = new TextInputBuilder()
            .setCustomId('custom_pet_status')
            .setLabel('Status/Fase (BABY/ADULT/EGG)')
            .setPlaceholder('Default: BABY')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

          modal.addComponents(
            new ActionRowBuilder().addComponents(nameInput),
            new ActionRowBuilder().addComponents(typeInput),
            new ActionRowBuilder().addComponents(traitInput),
            new ActionRowBuilder().addComponents(lvlInput),
            new ActionRowBuilder().addComponents(statusInput)
          );

          await iPet.showModal(modal);

          const sub = await iPet.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_pet_give_custom_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            try {
              const pName = sub.fields.getTextInputValue('custom_pet_name');
              const pType = sub.fields.getTextInputValue('custom_pet_type').trim().toUpperCase();
              let pTrait = sub.fields.getTextInputValue('custom_pet_trait').trim().toUpperCase();
              let pLevel = parseInt(sub.fields.getTextInputValue('custom_pet_level')) || 1;
              let pStatus = sub.fields.getTextInputValue('custom_pet_status').trim().toUpperCase() || 'BABY';

              // Validasi Spesies
              const petModule = require('./pet');
              if (!petModule.PET_SPECIES[pType]) {
                return sub.reply({ content: `❌ Spesies tidak valid! Pilihan: ${Object.keys(petModule.PET_SPECIES).join(', ')}`, flags: 64 });
              }

              // Sanitasi & Validasi Nama
              const sanitizedName = pName.replace(/<@!?\d*>|<@&\d*>|<#\d*>|@everyone|@here/g, '').trim();
              if (sanitizedName.length === 0 || sanitizedName.length > 25) {
                return sub.reply({ content: '❌ Nama pet tidak valid atau lebih dari 25 karakter!', flags: 64 });
              }

              // Validasi Slot
              const countRow = database.get('SELECT COUNT(*) as count FROM user_pets WHERE user_id = ? AND guild_id = ?', [selectedTargetUserId, guildId]);
              const count = countRow ? countRow.count : 0;
              if (count >= 3) {
                return sub.reply({ content: '❌ Anggota terpilih sudah memiliki batas maksimal **3 pet**!', flags: 64 });
              }

              // Cek Duplikat Nama
              const nameExists = database.get('SELECT 1 FROM user_pets WHERE user_id = ? AND guild_id = ? AND LOWER(pet_name) = LOWER(?)', [selectedTargetUserId, guildId, sanitizedName.toLowerCase()]);
              if (nameExists) {
                return sub.reply({ content: `❌ Anggota terpilih sudah memiliki pet bernama **"${sanitizedName}"**!`, flags: 64 });
              }

              // Validasi Trait
              const validTraits = ['GENIUS', 'STURDY', 'MUTANT', 'WARRIOR'];
              if (pTrait === 'NONE' || !validTraits.includes(pTrait)) {
                pTrait = '';
              }

              // Clamping Level
              pLevel = Math.max(1, Math.min(100, pLevel));

              // Validasi Status
              const validStatuses = ['BABY', 'ADULT', 'EGG'];
              if (!validStatuses.includes(pStatus)) {
                pStatus = 'BABY';
              }
              if (pLevel >= 10 && pStatus === 'BABY') {
                pStatus = 'ADULT';
              }

              const now = Math.floor(Date.now() / 1000);
              const isActive = count === 0 ? 1 : 0;
              let hatchAt = 0;
              if (pStatus === 'EGG') {
                hatchAt = now + 7200;
              }

              const maxHP = pType === 'SLIME' ? 120 : 100;

              database.run(
                `INSERT INTO user_pets (user_id, guild_id, pet_name, pet_type, status, level, xp, health, hunger, thirst, happiness, last_interaction_at, hatch_at, created_at, is_active, trait)
                 VALUES (?, ?, ?, ?, ?, ?, 0, ?, 100, 100, 100, ?, ?, ?, ?, ?)`,
                [selectedTargetUserId, guildId, sanitizedName, pType, pStatus, pLevel, maxHP, now, hatchAt, now, isActive, pTrait]
              );

              const traitText = pTrait ? ` dengan Trait **${pTrait}**` : '';
              await sub.reply({ content: `🎁 Sukses memberikan pet baru **${sanitizedName}** (${pType})${traitText} level **${pLevel}** (Status: **${pStatus}**) ke <@${selectedTargetUserId}>!`, flags: 64 });
              
              const fresh = getPetPanelData(guildId, selectedTargetUserId);
              await replyMsg.edit(fresh).catch(() => {});
            } catch (err) {
              await sub.reply({ content: `❌ Gagal memproses pemberian pet: ${err.message}`, flags: 64 }).catch(() => {});
            }
          }
        }
        else if (action === 'action_reset_pet') {
          const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          if (!targetPet) {
            return iPet.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan aktif untuk direset!', flags: 64 });
          }
          
          database.transaction(() => {
            database.run('DELETE FROM user_pets WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [selectedTargetUserId, guildId, targetPet.pet_name]);
            const remainingRow = database.get('SELECT COUNT(*) as count FROM user_pets WHERE user_id = ? AND guild_id = ?', [selectedTargetUserId, guildId]);
            const remaining = remainingRow ? remainingRow.count : 0;
            if (remaining === 0) {
               database.run('DELETE FROM pet_inventory WHERE user_id = ? AND guild_id = ?', [selectedTargetUserId, guildId]);
            } else {
               const nextPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? LIMIT 1', [selectedTargetUserId, guildId]);
               if (nextPet) {
                 database.run('UPDATE user_pets SET is_active = 1 WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [selectedTargetUserId, guildId, nextPet.pet_name]);
               }
            }
          })();
          
          await iPet.reply({ content: `💀 Sukses menghapus data pet aktif **${targetPet.pet_name}** milik <@${selectedTargetUserId}> dari database kandang.`, flags: 64 });
          const fresh = getPetPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => {});
        }
        else if (action === 'action_set_custom_image_modal') {
          const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          if (!targetPet) {
            return iPet.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan aktif!', flags: 64 });
          }

          const modal = new ModalBuilder()
            .setCustomId('admin_pet_set_custom_image_modal')
            .setTitle('Ubah Gambar Pet Custom');

          const urlInput = new TextInputBuilder()
            .setCustomId('image_url')
            .setLabel('URL Gambar / GIF')
            .setPlaceholder('https://... (Ketik "reset" untuk hapus)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(urlInput));
          await iPet.showModal(modal);

          const sub = await iPet.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_pet_set_custom_image_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            try {
              const url = sub.fields.getTextInputValue('image_url');
              const petModule = require('./pet');
              const savedUrl = petModule.setCustomImage(selectedTargetUserId, guildId, url);
              
              if (savedUrl) {
                await sub.reply({ content: `📸 Sukses! Gambar pet aktif milik <@${selectedTargetUserId}> berhasil diubah secara kustom.`, flags: 64 });
              } else {
                await sub.reply({ content: `📸 Sukses mereset gambar pet aktif milik <@${selectedTargetUserId}> ke tampilan bawaan.`, flags: 64 });
              }
              const fresh = getPetPanelData(guildId, selectedTargetUserId);
              await replyMsg.edit(fresh).catch(() => {});
            } catch (err) {
              await sub.reply({ content: `❌ Gagal mengubah gambar: ${err.message}`, flags: 64 }).catch(() => {});
            }
          }
        }
      }
    } catch (err) {
      console.error('Error in Pet Panel Interaction:', err);
      await iPet.reply({ content: `❌ Terjadi kesalahan: ${err.message}`, flags: 64 }).catch(() => {});
    }
  });

  collector.on('end', async (collected, reason) => {
    if (reason === 'transition') return;
    try {
      const fresh = getPetPanelData(guildId, selectedTargetUserId);
      fresh.components = [];
      await replyMsg.edit(fresh).catch(() => {});
    } catch (e) {}
  });

  return true;
}

/**
 * 🏦 2. PANEL FINANSIAL & BANK SERVER
 */
async function handleAdminBankPanel(messageOrInteraction, client, initialTargetUserId = null) {
  const isInteraction = !messageOrInteraction.author;
  const author = isInteraction ? messageOrInteraction.user : messageOrInteraction.author;
  const guildId = messageOrInteraction.guildId;
  const guild = messageOrInteraction.guild;

  if (!guildId) return false;

  let selectedTargetUserId = initialTargetUserId;

  const getBankPanelData = (gId, targetUserId) => {
    let embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🏦 ADMIN CONTROL PANEL — BANK & FINANSIAL')
      .setThumbnail(client.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({ text: 'Sentinel Admin • Sistem Bank & Keuangan' });

    let targetText = '*Belum ada anggota terpilih (Silakan pilih di menu dropdown di bawah)*';
    if (targetUserId) {
      const walletRow = database.get('SELECT balance FROM wallets WHERE user_id = ? AND guild_id = ?', [targetUserId, gId]);
      const savingsRow = database.get('SELECT balance FROM bank_savings WHERE user_id = ? AND guild_id = ?', [targetUserId, gId]);
      const walletVal = walletRow ? walletRow.balance : 0;
      const bankVal = savingsRow ? savingsRow.balance : 0;
      
      targetText = `🎯 **<@${targetUserId}>**\n` +
                   `• ID: \`${targetUserId}\`\n` +
                   `• Dompet: \`Rp ${walletVal.toLocaleString('id-ID')}\`\n` +
                   `• Tabungan Bank: \`Rp ${bankVal.toLocaleString('id-ID')}\`\n`;

      const activeLoan = database.get('SELECT * FROM bank_loans WHERE user_id = ? AND guild_id = ? AND status IN (\'ACTIVE\', \'OVERDUE\')', [targetUserId, gId]);
      if (activeLoan) {
        targetText += `• Pinjaman Bank: ⚠️ **ADA PINJAMAN** (\`Rp ${activeLoan.amount.toLocaleString('id-ID')}\` - Status: **${activeLoan.status}**)\n`;
      } else {
        targetText += `• Pinjaman Bank: 🟢 Bersih\n`;
      }
    }

    embed.setDescription(
      `Gunakan menu di bawah untuk menyuntikkan dana, memotong saldo, mereset ekonomi anggota secara spesifik, atau membagikan bantuan koin massal:\n\n` +
      `👤 **INFORMASI KEUANGAN TARGET:**\n${targetText}`
    );

    const userSelect = new UserSelectMenuBuilder()
      .setCustomId('admin_bank_select_target')
      .setPlaceholder('👤 Pilih Target Anggota');

    const userRow = new ActionRowBuilder().addComponents(userSelect);

    const actionSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_bank_select_action')
      .setPlaceholder('🎯 Pilih Tindakan Kustom Target')
      .setDisabled(!targetUserId);

    actionSelect.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('💸 Suntik Koin Kustom (Modal)')
        .setDescription('Menambahkan saldo dompet kustom ke anggota target')
        .setValue('action_give_coins_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('📉 Tarik/Potong Koin Kustom (Modal)')
        .setDescription('Memotong paksa koin dompet anggota target')
        .setValue('action_take_coins_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🚨 RESET EKONOMI TARGET')
        .setDescription('Mengembalikan saldo dompet, bank, & portfolio target ke 0')
        .setValue('action_reset_economy')
    );

    const actionRow = new ActionRowBuilder().addComponents(actionSelect);

    const globalSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_bank_select_global')
      .setPlaceholder('🌐 Tindakan Ekonomi Global');

    globalSelect.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('💰 Suntik Koin ke Seluruh Member (Massal)')
        .setDescription('Membuka modal input untuk membagikan koin ke semua warga terdaftar')
        .setValue('global_give_all_coins_modal')
    );

    const globalRow = new ActionRowBuilder().addComponents(globalSelect);

    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_bank_btn_back')
        .setLabel('🔙 Kembali ke Hub')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('admin_bank_btn_close')
        .setLabel('❌ Tutup Panel')
        .setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [userRow, actionRow, globalRow, btnRow] };
  };

  const initialData = getBankPanelData(guildId, selectedTargetUserId);
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

  collector.on('collect', async iBank => {
    if (!iBank.member || !iBank.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return iBank.reply({ content: '❌ Akses Ditolak! Tombol/menu dashboard ini dikunci khusus untuk Administrator server.', flags: 64 });
    }

    try {
      if (iBank.customId === 'admin_bank_select_target') {
        selectedTargetUserId = iBank.values[0];
        const fresh = getBankPanelData(guildId, selectedTargetUserId);
        await iBank.update(fresh);
      }
      else if (iBank.customId === 'admin_bank_btn_back') {
        collector.stop('transition');
        await handleAdminPanel(iBank, client);
      }
      else if (iBank.customId === 'admin_bank_btn_close') {
        collector.stop();
        await replyMsg.delete().catch(() => {});
      }
      else if (iBank.customId === 'admin_bank_select_action') {
        const action = iBank.values[0];
        if (!selectedTargetUserId) {
          return iBank.reply({ content: '❌ Silakan pilih target anggota terlebih dahulu!', flags: 64 });
        }

        if (action === 'action_give_coins_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_bank_give_coins_modal')
            .setTitle('Suntik Koin Member');

          const amountInput = new TextInputBuilder()
            .setCustomId('coin_amount')
            .setLabel('Jumlah Koin (Rupiah)')
            .setPlaceholder('Contoh: 15000')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
          await iBank.showModal(modal);

          const sub = await iBank.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_bank_give_coins_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const amount = parseInt(sub.fields.getTextInputValue('coin_amount'));
            if (isNaN(amount) || amount <= 0) {
              return sub.reply({ content: '❌ Jumlah harus berupa angka bulat di atas 0!', flags: 64 });
            }
            economy.addBalance(selectedTargetUserId, guildId, amount, 'ADMIN_GIVE');
            await sub.reply({ content: `💸 Sukses menyuntikkan koin **Rp ${amount.toLocaleString('id-ID')}** langsung ke dompet <@${selectedTargetUserId}>!`, flags: 64 });
            const fresh = getBankPanelData(guildId, selectedTargetUserId);
            await replyMsg.edit(fresh).catch(() => {});
          }
        }
        else if (action === 'action_take_coins_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_bank_take_coins_modal')
            .setTitle('Tarik Koin Member');

          const amountInput = new TextInputBuilder()
            .setCustomId('coin_amount')
            .setLabel('Jumlah Koin (Rupiah)')
            .setPlaceholder('Contoh: 5000')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
          await iBank.showModal(modal);

          const sub = await iBank.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_bank_take_coins_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const amount = parseInt(sub.fields.getTextInputValue('coin_amount'));
            if (isNaN(amount) || amount <= 0) {
              return sub.reply({ content: '❌ Jumlah harus berupa angka bulat di atas 0!', flags: 64 });
            }
            const wallet = economy.getWallet(selectedTargetUserId, guildId);
            const amountToTake = Math.min(wallet.balance, amount);
            if (amountToTake > 0) {
              economy.subtractBalance(selectedTargetUserId, guildId, amountToTake, 'ADMIN_TAKE');
            }
            await sub.reply({ content: `📉 Sukses menarik/memotong koin **Rp ${amountToTake.toLocaleString('id-ID')}** dari dompet <@${selectedTargetUserId}>!`, flags: 64 });
            const fresh = getBankPanelData(guildId, selectedTargetUserId);
            await replyMsg.edit(fresh).catch(() => {});
          }
        }
        else if (action === 'action_reset_economy') {
          database.run('UPDATE wallets SET balance = 0, total_earned = 0, total_invested = 0, streak_days = 0 WHERE user_id = ? AND guild_id = ?', [selectedTargetUserId, guildId]);
          database.run('UPDATE bank_savings SET balance = 0 WHERE user_id = ? AND guild_id = ?', [selectedTargetUserId, guildId]);
          database.run('DELETE FROM portfolios WHERE user_id = ? AND guild_id = ?', [selectedTargetUserId, guildId]);
          await iBank.reply({ content: `🚨 **RESET TOTAL SUKSES!** Dompet, tabungan bank, dan seluruh lembar saham milik <@${selectedTargetUserId}> telah dikembalikan ke 0.`, flags: 64 });
          const fresh = getBankPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => {});
        }
      }
      else if (iBank.customId === 'admin_bank_select_global') {
        const action = iBank.values[0];

        if (action === 'global_give_all_coins_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_bank_give_all_coins_modal')
            .setTitle('Bagi Koin ke Seluruh Member');

          const amountInput = new TextInputBuilder()
            .setCustomId('coin_amount')
            .setLabel('Jumlah Koin (Rupiah)')
            .setPlaceholder('Contoh: 2000')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
          await iBank.showModal(modal);

          const sub = await iBank.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_bank_give_all_coins_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const amount = parseInt(sub.fields.getTextInputValue('coin_amount'));
            if (isNaN(amount) || amount <= 0) {
              return sub.reply({ content: '❌ Jumlah harus berupa angka bulat di atas 0!', flags: 64 });
            }
            database.run('UPDATE wallets SET balance = balance + ?, total_earned = total_earned + ? WHERE guild_id = ?', [amount, amount, guildId]);
            await sub.reply({ content: `💸 Sukses membagikan koin **Rp ${amount.toLocaleString('id-ID')}** kepada seluruh member terdaftar di server ini!`, flags: 64 });
            const fresh = getBankPanelData(guildId, selectedTargetUserId);
            await replyMsg.edit(fresh).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.error('Error in Bank Panel Interaction:', err);
      await iBank.reply({ content: `❌ Terjadi kesalahan: ${err.message}`, flags: 64 }).catch(() => {});
    }
  });

  collector.on('end', async (collected, reason) => {
    if (reason === 'transition') return;
    try {
      const fresh = getBankPanelData(guildId, selectedTargetUserId);
      fresh.components = [];
      await replyMsg.edit(fresh).catch(() => {});
    } catch (e) {}
  });

  return true;
}

/**
 * 🚓 3. PANEL ROBBERY, LAW & JAIL (LAPAS VIRTUAL)
 */
async function handleAdminRobberyPanel(messageOrInteraction, client, initialTargetUserId = null) {
  const isInteraction = !messageOrInteraction.author;
  const author = isInteraction ? messageOrInteraction.user : messageOrInteraction.author;
  const guildId = messageOrInteraction.guildId;
  const guild = messageOrInteraction.guild;

  if (!guildId) return false;

  let selectedTargetUserId = initialTargetUserId;

  const getRobberyPanelData = (gId, targetUserId) => {
    let embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle('🚓 ADMIN CONTROL PANEL — HUKUM & LAPAS VIRTUAL')
      .setThumbnail(client.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({ text: 'Sentinel Admin • Lapas & Keamanan' });

    let targetText = '*Belum ada anggota terpilih (Silakan pilih di menu dropdown di bawah)*';
    if (targetUserId) {
      targetText = `🎯 **<@${targetUserId}>**\n` +
                   `• ID: \`${targetUserId}\`\n`;

      const nowUnix = Math.floor(Date.now() / 1000);
      const jail = database.get('SELECT jail_until, jail_type FROM wallets WHERE user_id = ? AND guild_id = ? AND jail_until > ?', [targetUserId, gId, nowUnix]);
      if (jail) {
        targetText += `• Status Lapas: 🚨 **DITAHAN** (Sisa <t:${jail.jail_until}:R>)\n` +
                      `• Alasan Sel: \`${jail.jail_type || 'Kegagalan Robbery/Tindakan Kriminal'}\`\n`;
      } else {
        targetText += `• Status Lapas: 🟢 Bebas Aktif\n`;
      }
    }

    embed.setDescription(
      `Kelola sanksi lapas virtual server, bebaskan tahanan paksa, reset global cooldown bank robbery, atau atur kedamaian server dari kejahatan:\n\n` +
      `👤 **STATUS PENJARA TARGET:**\n${targetText}`
    );

    const userSelect = new UserSelectMenuBuilder()
      .setCustomId('admin_rob_select_target')
      .setPlaceholder('👤 Pilih Anggota Target');

    const userRow = new ActionRowBuilder().addComponents(userSelect);

    const actionSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_rob_select_action')
      .setPlaceholder('🎯 Tindakan Hukum Target')
      .setDisabled(!targetUserId);

    actionSelect.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('🔓 Bebaskan Paksa dari Lapas')
        .setDescription('Mengeluarkan paksa anggota terpilih dari tahanan virtual saat ini')
        .setValue('action_free_jail')
    );

    const actionRow = new ActionRowBuilder().addComponents(actionSelect);

    const globalSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_rob_select_global')
      .setPlaceholder('🌐 Tindakan Hukum Global / Heist');

    globalSelect.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('🚨 Reset Cooldown Global Bank Heist')
        .setDescription('Mengizinkan seluruh warga kembali merampok Bank Server tanpa batas waktu tunggu')
        .setValue('global_reset_heist_cd'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🔓 Bebaskan Seluruh Tahanan Lapas')
        .setDescription('Mengeluarkan massal seluruh warga server dari penjara virtual seketika')
        .setValue('global_free_all_jail')
    );

    const globalRow = new ActionRowBuilder().addComponents(globalSelect);

    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_rob_btn_back')
        .setLabel('🔙 Kembali ke Hub')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('admin_rob_btn_close')
        .setLabel('❌ Tutup Panel')
        .setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [userRow, actionRow, globalRow, btnRow] };
  };

  const initialData = getRobberyPanelData(guildId, selectedTargetUserId);
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
    if (!iRob.member || !iRob.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return iRob.reply({ content: '❌ Akses Ditolak! Tombol/menu dashboard ini dikunci khusus untuk Administrator server.', flags: 64 });
    }

    try {
      if (iRob.customId === 'admin_rob_select_target') {
        selectedTargetUserId = iRob.values[0];
        const fresh = getRobberyPanelData(guildId, selectedTargetUserId);
        await iRob.update(fresh);
      }
      else if (iRob.customId === 'admin_rob_btn_back') {
        collector.stop('transition');
        await handleAdminPanel(iRob, client);
      }
      else if (iRob.customId === 'admin_rob_btn_close') {
        collector.stop();
        await replyMsg.delete().catch(() => {});
      }
      else if (iRob.customId === 'admin_rob_select_action') {
        const action = iRob.values[0];
        if (!selectedTargetUserId) {
          return iRob.reply({ content: '❌ Silakan pilih target anggota terlebih dahulu!', flags: 64 });
        }

        if (action === 'action_free_jail') {
          const nowUnix = Math.floor(Date.now() / 1000);
          const wallet = database.get('SELECT jail_until FROM wallets WHERE user_id = ? AND guild_id = ?', [selectedTargetUserId, guildId]);
          const isJailed = wallet && wallet.jail_until > nowUnix;
          if (!isJailed) {
            return iRob.reply({ content: '❌ Anggota terpilih tidak sedang berada di dalam penjara virtual!', flags: 64 });
          }
          database.run("UPDATE wallets SET jail_until = 0, jail_type = '' WHERE user_id = ? AND guild_id = ?", [selectedTargetUserId, guildId]);
          await iRob.reply({ content: `🔓 Sukses membebaskan paksa <@${selectedTargetUserId}> dari penjara virtual.`, flags: 64 });
          const fresh = getRobberyPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => {});
        }
      }
      else if (iRob.customId === 'admin_rob_select_global') {
        const action = iRob.values[0];

        if (action === 'global_reset_heist_cd') {
          database.run(
            'INSERT INTO heist_cooldown (guild_id, last_heist_at) VALUES (?, 0) ON CONFLICT(guild_id) DO UPDATE SET last_heist_at = 0',
            [guildId]
          );
          await iRob.reply({ content: '🚨 Sukses mereset global cooldown Bank Heist server. Warga dapat melakukan perampokan kembali!', flags: 64 });
        }
        else if (action === 'global_free_all_jail') {
          database.run("UPDATE wallets SET jail_until = 0, jail_type = '' WHERE guild_id = ?", [guildId]);
          await iRob.reply({ content: '🔓 Sukses membebaskan seluruh tahanan dari penjara virtual secara massal!', flags: 64 });
          const fresh = getRobberyPanelData(guildId, selectedTargetUserId);
          await replyMsg.edit(fresh).catch(() => {});
        }
      }
    } catch (err) {
      console.error('Error in Robbery Panel Interaction:', err);
      await iRob.reply({ content: `❌ Terjadi kesalahan: ${err.message}`, flags: 64 }).catch(() => {});
    }
  });

  collector.on('end', async (collected, reason) => {
    if (reason === 'transition') return;
    try {
      const fresh = getRobberyPanelData(guildId, selectedTargetUserId);
      fresh.components = [];
      await replyMsg.edit(fresh).catch(() => {});
    } catch (e) {}
  });

  return true;
}

/**
 * 📈 4. PANEL BURSA SAHAM & EVENT PASAR
 */
async function handleAdminSahamPanel(messageOrInteraction, client, initialTicker = null) {
  const isInteraction = !messageOrInteraction.author;
  const author = isInteraction ? messageOrInteraction.user : messageOrInteraction.author;
  const guildId = messageOrInteraction.guildId;
  const guild = messageOrInteraction.guild;

  if (!guildId) return false;

  let selectedTicker = initialTicker;

  const getSahamPanelData = (gId, ticker) => {
    let embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('📈 ADMIN CONTROL PANEL — BURSA SAHAM & EVENT PASAR')
      .setThumbnail(client.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({ text: 'Sentinel Admin • Bursa Saham & Analitik' });

    const activeStocks = database.all('SELECT * FROM stocks WHERE guild_id = ?', [gId]);
    
    let bursaList = '*Tidak ada instrumen saham terdaftar di bursa*';
    if (activeStocks.length > 0) {
      const nowUnix = Math.floor(Date.now() / 1000);
      bursaList = activeStocks.map(s => {
        let trendSuffix = '';
        if (s.force_trend && s.force_trend !== 'NONE' && s.force_until > nowUnix) {
          const remainingMinutes = Math.ceil((s.force_until - nowUnix) / 60);
          const trendEmoji = s.force_trend.includes('PUMP') ? '🔥' : '💥';
          trendSuffix = ` [${trendEmoji} **${s.force_trend}** sisa ${remainingMinutes}m]`;
        }
        const bursaSupplyText = s.total_shares === 99999999 ? 'Tanpa Batas (♾️)' : `${s.available_shares.toLocaleString('id-ID')} lbr`;
        return `👉 **${s.stock_ticker}** (#${s.stock_name}) — Harga: \`Rp ${s.current_price.toLocaleString('id-ID')}\` | Sisa Bursa: \`${bursaSupplyText}\`${trendSuffix}`;
      }).join('\n');
    }

    let tickerText = ticker && ticker !== 'KOSONG' ? `🎯 **Ticker Terpilih:** \`${ticker}\` (Silakan tentukan tindakan di bawah)` : '*Belum ada ticker terpilih (Silakan pilih di dropdown bursa)*';

    embed.setDescription(
      `Kelola instrumen pasar server: daftarkan channel baru ke lantai bursa, manipulasi harga saham tertentu, bagikan dividen mingguan, atau picu event ekonomi makro:\n\n` +
      `📈 **DAFTAR SAHAM BURSA AKTIF:**\n${bursaList}\n\n` +
      `${tickerText}`
    );

    const tickerSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_saham_select_ticker')
      .setPlaceholder('📈 Pilih Ticker Saham');

    if (activeStocks.length > 0) {
      activeStocks.forEach(s => {
        tickerSelect.addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel(`${s.stock_ticker} - Rp ${s.current_price.toLocaleString('id-ID')}`)
            .setDescription(`Saham channel #${s.stock_name}`)
            .setValue(s.stock_ticker)
            .setDefault(ticker === s.stock_ticker)
        );
      });
    } else {
      tickerSelect.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Kosong')
          .setValue('KOSONG')
      ).setDisabled(true);
    }

    const tickerRow = new ActionRowBuilder().addComponents(tickerSelect);

    const actionSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_saham_select_action')
      .setPlaceholder('📉 Tindakan untuk Saham Terpilih')
      .setDisabled(!ticker || ticker === 'KOSONG');

    actionSelect.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('📈 Paksa Naikkan Harga (Pump Modal)')
        .setDescription('Meningkatkan paksa harga saham terpilih sebesar persentase tertentu (1 - 500%)')
        .setValue('bursa_action_pump_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('📉 Paksa Turunkan Harga (Drop Modal)')
        .setDescription('Menurunkan paksa harga saham terpilih sebesar persentase tertentu (1 - 99%)')
        .setValue('bursa_action_drop_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🧬 Manipulasi Tren Saham (Seharian/Per Jam)')
        .setDescription('Mengunci tren pergerakan harga saham terpilih (PUMP/DUMP/MAX/MIN) untuk durasi tertentu')
        .setValue('bursa_action_manipulate_trend_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('❌ Hapus Saham dari Bursa')
        .setDescription('Menghapus permanen instrumen saham ini dan membersihkan portofolio warga')
        .setValue('bursa_action_remove')
    );

    const actionRow = new ActionRowBuilder().addComponents(actionSelect);

    const globalSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_saham_select_global')
      .setPlaceholder('🌐 Picu Event Global & Kelola Bursa');

    globalSelect.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('📈 Picu Bursa: Event Bull Run')
        .setDescription('Memicu kenaikan harga saham bursa secara masif dan instan')
        .setValue('global_trigger_bull'),
      new StringSelectMenuOptionBuilder()
        .setLabel('📉 Picu Bursa: Event Market Crash')
        .setDescription('Memicu penurunan drastis harga saham bursa secara masif')
        .setValue('global_trigger_crash'),
      new StringSelectMenuOptionBuilder()
        .setLabel('📈 Pompa Semua Harga Saham (Max Out)')
        .setDescription('Membuat semua saham bernilai maksimal (Rp 10.000) secara instan')
        .setValue('global_action_pump_all'),
      new StringSelectMenuOptionBuilder()
        .setLabel('📉 Banting Semua Harga Saham (Crash Out)')
        .setDescription('Membuat semua saham runtuh ke harga minimal (Rp 10) secara instan')
        .setValue('global_action_drop_all'),
      new StringSelectMenuOptionBuilder()
        .setLabel('💰 Picu Bursa: Double Earning Hour')
        .setDescription('Memicu event pendapatan ganda bursa instan selama 1 jam')
        .setValue('global_trigger_double'),
      new StringSelectMenuOptionBuilder()
        .setLabel('💸 Bagikan Dividen Saham Mingguan')
        .setDescription('Memicu kalkulasi & pembagian dividen mingguan berbasis keaktifan chat warga')
        .setValue('global_trigger_dividends'),
      new StringSelectMenuOptionBuilder()
        .setLabel('➕ Daftarkan Channel Baru ke Bursa (Modal)')
        .setDescription('Mendaftarkan text channel baru server menjadi saham bursa')
        .setValue('bursa_global_add_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🔄 Re-Inisialisasi Bursa (Reset Default)')
        .setDescription('Mereset total bursa kembali ke setelan standard bot ($GENERAL, $LOUNGE, $SPAM)')
        .setValue('bursa_global_reinit')
    );

    const globalRow = new ActionRowBuilder().addComponents(globalSelect);

    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_saham_btn_back')
        .setLabel('🔙 Kembali ke Hub')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('admin_saham_btn_close')
        .setLabel('❌ Tutup Panel')
        .setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [tickerRow, actionRow, globalRow, btnRow] };
  };

  const initialData = getSahamPanelData(guildId, selectedTicker);
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

  collector.on('collect', async iSaham => {
    if (!iSaham.member || !iSaham.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return iSaham.reply({ content: '❌ Akses Ditolak! Tombol/menu dashboard ini dikunci khusus untuk Administrator server.', flags: 64 });
    }

    try {
      if (iSaham.customId === 'admin_saham_select_ticker') {
        selectedTicker = iSaham.values[0];
        const fresh = getSahamPanelData(guildId, selectedTicker);
        await iSaham.update(fresh);
      }
      else if (iSaham.customId === 'admin_saham_btn_back') {
        collector.stop('transition');
        await handleAdminPanel(iSaham, client);
      }
      else if (iSaham.customId === 'admin_saham_btn_close') {
        collector.stop();
        await replyMsg.delete().catch(() => {});
      }
      else if (iSaham.customId === 'admin_saham_select_action') {
        const action = iSaham.values[0];
        if (!selectedTicker || selectedTicker === 'KOSONG') {
          return iSaham.reply({ content: '❌ Silakan pilih ticker saham terlebih dahulu!', flags: 64 });
        }

        if (action === 'bursa_action_pump_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_saham_pump_modal')
            .setTitle(`Pump Harga Saham ${selectedTicker}`);

          const pctInput = new TextInputBuilder()
            .setCustomId('pump_percent')
            .setLabel('Persentase Kenaikan (1 - 500)')
            .setPlaceholder('Contoh: 50 untuk naik +50%')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(pctInput));
          await iSaham.showModal(modal);

          const sub = await iSaham.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_saham_pump_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const percent = parseInt(sub.fields.getTextInputValue('pump_percent'));
            if (isNaN(percent) || percent < 1 || percent > 500) {
              return sub.reply({ content: '❌ Nilai harus berupa angka bulat antara 1 hingga 500!', flags: 64 });
            }
            const stock = stocks.getStock(guildId, selectedTicker);
            if (!stock) {
              return sub.reply({ content: '❌ Saham tidak ditemukan!', flags: 64 });
            }
            const oldPrice = stock.current_price;
            const newPrice = Math.min(config.market.MAX_PRICE, Math.round(oldPrice * (1 + percent / 100)));

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

            await sub.reply({ content: `📈 Sukses menaikkan harga saham **${selectedTicker}** sebesar **+${percent}%** (Lama: Rp ${oldPrice.toLocaleString('id-ID')} -> Baru: Rp ${newPrice.toLocaleString('id-ID')})!`, flags: 64 });
            const fresh = getSahamPanelData(guildId, selectedTicker);
            await replyMsg.edit(fresh).catch(() => {});
          }
        }
        else if (action === 'bursa_action_drop_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_saham_drop_modal')
            .setTitle(`Drop Harga Saham ${selectedTicker}`);

          const pctInput = new TextInputBuilder()
            .setCustomId('drop_percent')
            .setLabel('Persentase Penurunan (1 - 99)')
            .setPlaceholder('Contoh: 15')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(pctInput));
          await iSaham.showModal(modal);

          const sub = await iSaham.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_saham_drop_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const percent = parseInt(sub.fields.getTextInputValue('drop_percent'));
            if (isNaN(percent) || percent < 1 || percent > 99) {
              return sub.reply({ content: '❌ Nilai harus berupa angka bulat antara 1 hingga 99!', flags: 64 });
            }
            const stock = stocks.getStock(guildId, selectedTicker);
            if (!stock) {
              return sub.reply({ content: '❌ Saham tidak ditemukan!', flags: 64 });
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

            await sub.reply({ content: `📉 Sukses menurunkan harga saham **${selectedTicker}** sebesar **${percent}%** (Lama: Rp ${oldPrice.toLocaleString('id-ID')} -> Baru: Rp ${newPrice.toLocaleString('id-ID')})!`, flags: 64 });
            const fresh = getSahamPanelData(guildId, selectedTicker);
            await replyMsg.edit(fresh).catch(() => {});
          }
        }
        else if (action === 'bursa_action_manipulate_trend_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_saham_trend_modal')
            .setTitle(`Kunci Tren ${selectedTicker}`);

          const trendInput = new TextInputBuilder()
            .setCustomId('trend_type')
            .setLabel('Tren (PUMP / DUMP / PUMP_MAX / DUMP_MIN / NONE)')
            .setPlaceholder('Ketik jenis tren (contoh: PUMP)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const durationInput = new TextInputBuilder()
            .setCustomId('trend_duration')
            .setLabel('Durasi Jam (Contoh: 24 untuk seharian, 1 per jam)')
            .setPlaceholder('Ketik angka jam (contoh: 24)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(trendInput),
            new ActionRowBuilder().addComponents(durationInput)
          );
          await iSaham.showModal(modal);

          const sub = await iSaham.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_saham_trend_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const trendVal = sub.fields.getTextInputValue('trend_type').trim().toUpperCase();
            const durationVal = parseFloat(sub.fields.getTextInputValue('trend_duration'));

            const validTrends = ['PUMP', 'DUMP', 'PUMP_MAX', 'DUMP_MIN', 'NONE'];
            if (!validTrends.includes(trendVal)) {
              return sub.reply({ content: '❌ Jenis tren tidak valid! Pilih: PUMP, DUMP, PUMP_MAX, DUMP_MIN, atau NONE.', flags: 64 });
            }

            if (isNaN(durationVal) || durationVal <= 0) {
              return sub.reply({ content: '❌ Durasi jam tidak valid! Masukkan angka positif (contoh: 24 untuk seharian, 1 untuk 1 jam).', flags: 64 });
            }

            const stock = stocks.getStock(guildId, selectedTicker);
            if (!stock) {
              return sub.reply({ content: '❌ Saham tidak ditemukan!', flags: 64 });
            }

            const durationSecs = durationVal * 3600;
            const expiresAt = trendVal === 'NONE' ? 0 : Math.floor(Date.now() / 1000) + durationSecs;

            database.transaction(() => {
              database.run(
                "UPDATE stocks SET force_trend = ?, force_until = ? WHERE channel_id = ? AND guild_id = ?",
                [trendVal, expiresAt, stock.channel_id, guildId]
              );
              // Jika MAX/MIN dipicu, perbarui harga langsung demi kepuasan admin instan!
              if (trendVal === 'PUMP_MAX') {
                const oldP = stock.current_price;
                const newP = config.market.MAX_PRICE;
                database.run('UPDATE stocks SET previous_price = ?, current_price = ? WHERE channel_id = ? AND guild_id = ?', [oldP, newP, stock.channel_id, guildId]);
                database.run('INSERT INTO price_history (channel_id, guild_id, price, activity_score) VALUES (?, ?, ?, 0.0)', [stock.channel_id, guildId, newP]);
              } else if (trendVal === 'DUMP_MIN') {
                const oldP = stock.current_price;
                const newP = config.market.MIN_PRICE;
                database.run('UPDATE stocks SET previous_price = ?, current_price = ? WHERE channel_id = ? AND guild_id = ?', [oldP, newP, stock.channel_id, guildId]);
                database.run('INSERT INTO price_history (channel_id, guild_id, price, activity_score) VALUES (?, ?, ?, 0.0)', [stock.channel_id, guildId, newP]);
              }
            })();

            let durationMsg = trendVal === 'NONE' ? 'tren dibersihkan' : `dikunci ke **${trendVal}** selama **${durationVal} jam**`;
            await sub.reply({ content: `🧬 Saham **${selectedTicker}** berhasil ${durationMsg}!`, flags: 64 });
            const fresh = getSahamPanelData(guildId, selectedTicker);
            await replyMsg.edit(fresh).catch(() => {});
          }
        }
        else if (action === 'bursa_action_remove') {
          const stock = stocks.getStock(guildId, selectedTicker);
          if (!stock) {
            return iSaham.reply({ content: '❌ Saham tidak ditemukan!', flags: 64 });
          }
          database.transaction(() => {
            database.run('DELETE FROM stocks WHERE stock_ticker = ? AND guild_id = ?', [selectedTicker, guildId]);
            database.run('DELETE FROM portfolios WHERE channel_id = ? AND guild_id = ?', [stock.channel_id, guildId]);
          })();
          selectedTicker = null;
          await iSaham.reply({ content: `❌ Sukses menghapus instrumen saham **${stock.stock_ticker}** dari bursa server.`, flags: 64 });
          const fresh = getSahamPanelData(guildId, selectedTicker);
          await replyMsg.edit(fresh).catch(() => {});
        }
      }
      else if (iSaham.customId === 'admin_saham_select_global') {
        const action = iSaham.values[0];

        if (action === 'global_trigger_bull') {
          const events = require('./events');
          events.triggerEvent(client, guild, events.EVENT_TYPES.BULL_RUN);
          await iSaham.reply({ content: '📈 Event bursa saham **BULL RUN** berhasil dipicu secara instan!', flags: 64 });
        }
        else if (action === 'global_trigger_crash') {
          const events = require('./events');
          events.triggerEvent(client, guild, events.EVENT_TYPES.MARKET_CRASH);
          await iSaham.reply({ content: '📉 Event bursa saham **MARKET CRASH** berhasil dipicu secara instan!', flags: 64 });
        }
        else if (action === 'global_action_pump_all') {
          const activeStocks = database.all('SELECT * FROM stocks WHERE guild_id = ?', [guildId]);
          if (activeStocks.length === 0) {
            return iSaham.reply({ content: '❌ Tidak ada saham bursa terdaftar!', flags: 64 });
          }

          database.transaction(() => {
            activeStocks.forEach(s => {
              const oldPrice = s.current_price;
              const newPrice = config.market.MAX_PRICE;
              database.run(
                'UPDATE stocks SET previous_price = ?, current_price = ? WHERE channel_id = ? AND guild_id = ?',
                [oldPrice, newPrice, s.channel_id, guildId]
              );
              database.run(
                'INSERT INTO price_history (channel_id, guild_id, price, activity_score) VALUES (?, ?, ?, 0.0)',
                [s.channel_id, guildId, newPrice]
              );
            });
          })();

          await iSaham.reply({ content: '📈 Pompa Pasar Sukses! Seluruh saham server telah dinaikkan ke **Rp 10.000 (Maksimal)** secara instan! 🚀', flags: 64 });
          const fresh = getSahamPanelData(guildId, selectedTicker);
          await replyMsg.edit(fresh).catch(() => {});
        }
        else if (action === 'global_action_drop_all') {
          const activeStocks = database.all('SELECT * FROM stocks WHERE guild_id = ?', [guildId]);
          if (activeStocks.length === 0) {
            return iSaham.reply({ content: '❌ Tidak ada saham bursa terdaftar!', flags: 64 });
          }

          database.transaction(() => {
            activeStocks.forEach(s => {
              const oldPrice = s.current_price;
              const newPrice = config.market.MIN_PRICE;
              database.run(
                'UPDATE stocks SET previous_price = ?, current_price = ? WHERE channel_id = ? AND guild_id = ?',
                [oldPrice, newPrice, s.channel_id, guildId]
              );
              database.run(
                'INSERT INTO price_history (channel_id, guild_id, price, activity_score) VALUES (?, ?, ?, 0.0)',
                [s.channel_id, guildId, newPrice]
              );
            });
          })();

          await iSaham.reply({ content: '📉 Banting Pasar Sukses! Seluruh saham server telah diturunkan runtuh ke **Rp 10 (Minimal)** secara instan! 💥', flags: 64 });
          const fresh = getSahamPanelData(guildId, selectedTicker);
          await replyMsg.edit(fresh).catch(() => {});
        }
        else if (action === 'global_trigger_double') {
          const events = require('./events');
          events.triggerEvent(client, guild, events.EVENT_TYPES.DOUBLE_EARNINGS);
          await iSaham.reply({ content: '💰 Event bursa saham **DOUBLE EARNING HOUR** berhasil dipicu secara instan!', flags: 64 });
        }
        else if (action === 'global_trigger_dividends') {
          const triggerSuccess = scheduler.triggerDividendsWeekly ? scheduler.triggerDividendsWeekly(client, guildId) : false;
          await iSaham.reply({ content: `💸 Pembagian Dividen Saham Mingguan berhasil dipicu secara manual!`, flags: 64 });
        }
        else if (action === 'bursa_global_add_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_saham_add_modal')
            .setTitle('Daftarkan Saham Baru');

          const channelInput = new TextInputBuilder()
            .setCustomId('channel_id')
            .setLabel('ID Text Channel')
            .setPlaceholder('Masukkan ID channel (Contoh: 1503324994153873458)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const tickerInput = new TextInputBuilder()
            .setCustomId('ticker_name')
            .setLabel('Ticker Saham (Mulai dengan $)')
            .setPlaceholder('Contoh: $LOUNGE')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(channelInput),
            new ActionRowBuilder().addComponents(tickerInput)
          );
          await iSaham.showModal(modal);

          const sub = await iSaham.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_saham_add_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const chId = sub.fields.getTextInputValue('channel_id').trim();
            let tickName = sub.fields.getTextInputValue('ticker_name').trim().toUpperCase();
            if (!tickName.startsWith('$')) {
              tickName = '$' + tickName;
            }

            const channelObj = guild.channels.cache.get(chId);
            if (!channelObj) {
              return sub.reply({ content: '❌ Text channel dengan ID tersebut tidak ditemukan di server ini!', flags: 64 });
            }

            const existing = database.get('SELECT * FROM stocks WHERE (stock_ticker = ? OR channel_id = ?) AND guild_id = ?', [tickName, chId, guildId]);
            if (existing) {
              return sub.reply({ content: '❌ Ticker saham atau ID channel tersebut sudah terdaftar di bursa!', flags: 64 });
            }

            database.run(
              'INSERT INTO stocks (guild_id, channel_id, stock_name, stock_ticker, current_price, previous_price, available_shares) VALUES (?, ?, ?, ?, 100, 100, 500)',
              [guildId, chId, channelObj.name, tickName]
            );

            await sub.reply({ content: `✅ Sukses mendaftarkan channel <#${chId}> sebagai saham **${tickName}** di bursa!`, flags: 64 });
            const fresh = getSahamPanelData(guildId, selectedTicker);
            await replyMsg.edit(fresh).catch(() => {});
          }
        }
        else if (action === 'bursa_global_reinit') {
          database.transaction(() => {
            database.run('DELETE FROM stocks WHERE guild_id = ?', [guildId]);
            database.run('DELETE FROM portfolios WHERE guild_id = ?', [guildId]);
            
            const defaults = [
              { name: 'general', ticker: '$GENERAL', price: 100 },
              { name: 'lounge', ticker: '$LOUNGE', price: 100 },
              { name: 'bot-spam', ticker: '$SPAM', price: 100 }
            ];

            defaults.forEach(d => {
              const ch = guild.channels.cache.find(c => c.name === d.name && c.isTextBased());
              if (ch) {
                database.run(
                  'INSERT INTO stocks (guild_id, channel_id, stock_name, stock_ticker, current_price, previous_price, available_shares) VALUES (?, ?, ?, ?, ?, ?, 500)',
                  [guildId, ch.id, d.name, d.ticker, d.price, d.price]
                );
              }
            });
          })();
          await iSaham.reply({ content: '🔄 Sukses mereset total seluruh instrumen bursa saham server kembali ke setelan default.', flags: 64 });
          const fresh = getSahamPanelData(guildId, selectedTicker);
          await replyMsg.edit(fresh).catch(() => {});
        }
      }
    } catch (err) {
      console.error('Error in Saham Panel Interaction:', err);
      await iSaham.reply({ content: `❌ Terjadi kesalahan: ${err.message}`, flags: 64 }).catch(() => {});
    }
  });

  collector.on('end', async (collected, reason) => {
    if (reason === 'transition') return;
    try {
      const fresh = getSahamPanelData(guildId, selectedTicker);
      fresh.components = [];
      await replyMsg.edit(fresh).catch(() => {});
    } catch (e) {}
  });

  return true;
}

/**
 * ⚡ 5. PANEL BYPASS & ABYUS (SABOTASE EKONOMI)
 */
async function handleAdminAbyusPanel(messageOrInteraction, client) {
  const isInteraction = !messageOrInteraction.author;
  const author = isInteraction ? messageOrInteraction.user : messageOrInteraction.author;
  const guildId = messageOrInteraction.guildId;
  const guild = messageOrInteraction.guild;

  if (!guildId) return false;

  const getAbyusPanelData = (gId) => {
    const settings = getOrCreateEbyusSettings(gId);
    
    let embed = new EmbedBuilder()
      .setColor(0x00FFFF)
      .setTitle('⚡ ADMIN CONTROL PANEL — BYPASS & EVENT ABYUS')
      .setThumbnail(client.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({ text: 'Sentinel Admin • Keamanan & Bypass Server' });

    embed.setDescription(
      `Sabotase persentase kemenangan gacha role, atur multiplier obrolan chat warga, set batas waktu auto-reset event, atau lakukan penghentian darurat:\n\n` +
      `📊 **STATUS BYPASS & EKONOMI SERVER:**\n` +
      `🎰 **Mode Gacha Role**: \`${settings.gacha_mode}\`\n` +
      `🪙 **Pengali Koin Chat**: \`${settings.coin_multiplier === 1 ? 'Nonaktif (1x)' : settings.coin_multiplier + 'x'}\`\n` +
      `⏱️ **Masa Berlaku Bypass**: ${settings.expires_at > 0 ? `<t:${settings.expires_at}:R>` : '`Permanen (Manual)`'}`
    );

    const gachaSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_abyus_select_gacha')
      .setPlaceholder('🎰 Atur Kesulitan Gacha Role');

    const gachaOptions = [
      { label: '🟢 Normal Mode (75% Zonk)', value: 'NORMAL', desc: 'Sesuai dengan probabilitas standar mesin gacha' },
      { label: '🟡 Easy Mode (40% Zonk)', value: 'EASY', desc: 'Tingkat kemenangan ditingkatkan hampir 2x lipat' },
      { label: '🟠 Super Easy Mode (15% Zonk)', value: 'SUPER_EASY', desc: 'Tingkat kemenangan ditingkatkan sangat tinggi' },
      { label: '🔴 Abuse Mode (0% Zonk - 100% Win!)', value: 'ABUSE', desc: 'Menang terus! Tingkat kegagalan disetel ke nol persen' }
    ];

    gachaOptions.forEach(opt => {
      gachaSelect.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(opt.label)
          .setDescription(opt.desc)
          .setValue(opt.value)
          .setDefault(settings.gacha_mode === opt.value)
      );
    });

    const gachaRow = new ActionRowBuilder().addComponents(gachaSelect);

    const coinSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_abyus_select_multiplier')
      .setPlaceholder('🪙 Atur Pengali Koin Chat');

    const coinOptions = [
      { label: '❌ Nonaktifkan Multiplier (1x)', value: '1', desc: 'Pendapatan koin chat normal (5 - 15 Rp per chat)' },
      { label: '⚡ 3x Coin Multiplier', value: '3', desc: 'Koin yang didapat dilipatgandakan 3 kali lipat!' },
      { label: '⚡ 4x Coin Multiplier', value: '4', desc: 'Koin yang didapat dilipatgandakan 4 kali lipat!' },
      { label: '⚡ 5x Coin Multiplier', value: '5', desc: 'Koin yang didapat dilipatgandakan 5 kali lipat!' },
      { label: '⚡ 6x Coin Multiplier', value: '6', desc: 'Koin yang didapat dilipatgandakan 6 kali lipat!' },
      { label: '⚡ 7x Coin Multiplier', value: '7', desc: 'Koin yang didapat dilipatgandakan 7 kali lipat!' },
      { label: '💀 8x ABUSE Multiplier!', value: '8', desc: 'SABOTASE MAKSIMAL! Koin chat dilipatgandakan 8x lipat!' }
    ];

    coinOptions.forEach(opt => {
      coinSelect.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(opt.label)
          .setDescription(opt.desc)
          .setValue(opt.value)
          .setDefault(settings.coin_multiplier === parseInt(opt.value))
      );
    });

    const coinRow = new ActionRowBuilder().addComponents(coinSelect);

    const btnRow1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_abyus_btn_broadcast')
        .setLabel('📢 Broadcast Event')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('admin_abyus_btn_duration')
        .setLabel('⏱️ Set Durasi (Modal)')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('admin_abyus_btn_stop_abyus')
        .setLabel('🛑 Stop Event Abyus')
        .setStyle(ButtonStyle.Danger)
    );

    const btnRow2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_abyus_btn_status')
        .setLabel('📊 Status Real-time')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('admin_abyus_btn_back')
        .setLabel('🔙 Kembali ke Hub')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('admin_abyus_btn_close')
        .setLabel('❌ Tutup Panel')
        .setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [gachaRow, coinRow, btnRow1, btnRow2] };
  };

  const initialData = getAbyusPanelData(guildId);
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

  collector.on('collect', async iAbyus => {
    if (!iAbyus.member || !iAbyus.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return iAbyus.reply({ content: '❌ Akses Ditolak! Tombol/menu dashboard ini dikunci khusus untuk Administrator server.', flags: 64 });
    }

    const nowUnix = Math.floor(Date.now() / 1000);

    try {
      if (iAbyus.customId === 'admin_abyus_select_gacha') {
        const mode = iAbyus.values[0];
        database.run('UPDATE ebyus_settings SET gacha_mode = ?, updated_at = ?, updated_by = ? WHERE guild_id = ?', [mode, nowUnix, iAbyus.user.id, guildId]);
        await iAbyus.reply({ content: `🎰 Sukses mengubah mode gacha server menjadi **${mode}**!`, flags: 64 });
        const fresh = getAbyusPanelData(guildId);
        await replyMsg.edit(fresh).catch(() => {});
      }
      else if (iAbyus.customId === 'admin_abyus_select_multiplier') {
        const mult = parseInt(iAbyus.values[0]);
        database.run('UPDATE ebyus_settings SET coin_multiplier = ?, updated_at = ?, updated_by = ? WHERE guild_id = ?', [mult, nowUnix, iAbyus.user.id, guildId]);
        await iAbyus.reply({ content: `🪙 Sukses mengubah multiplier koin chat menjadi **${mult}x**!`, flags: 64 });
        const fresh = getAbyusPanelData(guildId);
        await replyMsg.edit(fresh).catch(() => {});
      }
      else if (iAbyus.customId === 'admin_abyus_btn_broadcast') {
        const settings = getOrCreateEbyusSettings(guildId);
        const broadcastEmb = embeds.ebyusBroadcastEmbed(guild, settings.gacha_mode, settings.coin_multiplier, settings.expires_at);
        
        let targetChannel = guild.channels.cache.get('1422642326798598348');
        if (!targetChannel) {
          try {
            targetChannel = await guild.channels.fetch('1422642326798598348');
          } catch (e) {
            targetChannel = messageOrInteraction.channel;
          }
        }

        if (targetChannel) {
          await targetChannel.send({ content: '@everyone 🚨 **EVENT ABUSE AKTIF!** 🚨', embeds: [broadcastEmb] });
          await iAbyus.reply({ content: `✅ Sukses menyiarkan pengumuman Ebyus ke channel <#${targetChannel.id}>!`, flags: 64 });
        } else {
          await iAbyus.reply({ content: '❌ Gagal menemukan channel untuk menyiarkan pengumuman!', flags: 64 });
        }
      }
      else if (iAbyus.customId === 'admin_abyus_btn_duration') {
        const modal = new ModalBuilder()
          .setCustomId('admin_ebyus_duration_modal')
          .setTitle('Atur Durasi Event Bypass');

        const durInput = new TextInputBuilder()
          .setCustomId('dur_minutes')
          .setLabel('Durasi Event (dalam Menit)')
          .setPlaceholder('Masukkan angka menit (Contoh: 20)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(durInput));
        await iAbyus.showModal(modal);

        const sub = await iAbyus.awaitModalSubmit({
          filter: (s) => s.customId === 'admin_ebyus_duration_modal' && s.user.id === author.id,
          time: 60000
        }).catch(() => null);

        if (sub) {
          const minutes = parseInt(sub.fields.getTextInputValue('dur_minutes'));
          if (isNaN(minutes) || minutes < 0) {
            return sub.reply({ content: '❌ Durasi harus berupa angka di atas 0!', flags: 64 });
          }
          const expiresAt = minutes > 0 ? nowUnix + minutes * 60 : 0;
          database.run('UPDATE ebyus_settings SET expires_at = ?, updated_at = ?, updated_by = ? WHERE guild_id = ?', [expiresAt, nowUnix, iAbyus.user.id, guildId]);
          
          await sub.reply({ content: `⏱️ Sukses memperbarui durasi event bypass menjadi **${minutes} menit** (auto-reset).`, flags: 64 });
          const fresh = getAbyusPanelData(guildId);
          await replyMsg.edit(fresh).catch(() => {});
        }
      }
      else if (iAbyus.customId === 'admin_abyus_btn_stop_abyus') {
        database.run(
          'UPDATE ebyus_settings SET gacha_mode = ?, coin_multiplier = ?, expires_at = 0, updated_at = ?, updated_by = ? WHERE guild_id = ?',
          ['NORMAL', 1, nowUnix, iAbyus.user.id, guildId]
        );
        await iAbyus.reply({ content: '🛑 **Sukses menghentikan seluruh Event Abuse!** Mode gacha direset ke `NORMAL` dan multiplier koin chat kembali ke `1x` (nonaktif).', flags: 64 });
        const fresh = getAbyusPanelData(guildId);
        await replyMsg.edit(fresh).catch(() => {});
      }
      else if (iAbyus.customId === 'admin_abyus_btn_status') {
        const settings = getOrCreateEbyusSettings(guildId);
        const statusEmb = embeds.ebyusStatusEmbed(guild, settings);
        await iAbyus.reply({ embeds: [statusEmb], flags: 64 });
      }
      else if (iAbyus.customId === 'admin_abyus_btn_back') {
        collector.stop('transition');
        await handleAdminPanel(iAbyus, client);
      }
      else if (iAbyus.customId === 'admin_abyus_btn_close') {
        collector.stop();
        await replyMsg.delete().catch(() => {});
      }
    } catch (err) {
      console.error('Error in Abyus Panel Interaction:', err);
      await iAbyus.reply({ content: `❌ Terjadi kesalahan: ${err.message}`, flags: 64 }).catch(() => {});
    }
  });

  collector.on('end', async (collected, reason) => {
    if (reason === 'transition') return;
    try {
      const fresh = getAbyusPanelData(guildId);
      fresh.components = [];
      await replyMsg.edit(fresh).catch(() => {});
    } catch (e) {}
  });

  return true;
}

/**
 * 🎭 6. PANEL TOKO ROLE & GAME ToD
 */
async function handleAdminShopPanel(messageOrInteraction, client) {
  const isInteraction = !messageOrInteraction.author;
  const author = isInteraction ? messageOrInteraction.user : messageOrInteraction.author;
  const guildId = messageOrInteraction.guildId;
  const guild = messageOrInteraction.guild;

  if (!guildId) return false;

  const getShopPanelData = (gId) => {
    let embed = new EmbedBuilder()
      .setColor(0xFF3366)
      .setTitle('🎭 ADMIN CONTROL PANEL — TOKO ROLE & GAME ToD')
      .setThumbnail(client.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({ text: 'Sentinel Admin • Toko Role & ToD Sesi' });

    const shopItems = database.all('SELECT * FROM shop_items WHERE guild_id = ?', [gId]);
    let shopList = '*Tidak ada item role terdaftar di toko*';
    if (shopItems.length > 0) {
      shopList = shopItems.map((item, idx) => {
        return `${idx + 1}. <@&${item.role_id}> (${item.tier}) — Harga: \`Rp ${item.price.toLocaleString('id-ID')}\` | Stok: \`${item.stock === -1 ? 'Unlimited' : item.stock + ' slot'}\``;
      }).join('\n');
    }

    embed.setDescription(
      `Tambahkan/hapus role dari toko, kelola ketersediaan stok role, atau kontrol sesi game Truth or Dare di Voice Channel:\n\n` +
      `🎭 **DAFTAR ITEM TOKO ROLE AKTIF:**\n${shopList}`
    );

    const shopActionSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_shop_select_action')
      .setPlaceholder('🎭 Kelola Penjualan Toko Role');

    shopActionSelect.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('➕ Tambahkan Jual Role Baru (Modal)')
        .setDescription('Menjual role server ke etalase toko beserta tier & deskripsi')
        .setValue('shop_action_add_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('❌ Hapus Item Role dari Toko (Modal)')
        .setDescription('Menghapus item role terdaftar dari toko bursa')
        .setValue('shop_action_remove_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('⚙️ Ubah Jumlah Stok Role (Modal)')
        .setDescription('Mengubah ketersediaan slot role terdaftar')
        .setValue('shop_action_stock_modal'),
      new StringSelectMenuOptionBuilder()
        .setLabel('👑 Auto-Setup 5 Toko Role Prestise')
        .setDescription('Membuat & menyetel otomatis role Common s/d Mythic')
        .setValue('shop_action_auto')
    );

    const shopActionRow = new ActionRowBuilder().addComponents(shopActionSelect);

    const todActionSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_shop_select_tod')
      .setPlaceholder('🎲 Kelola Game Truth or Dare (ToD)');

    todActionSelect.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('📢 Siarkan Pengumuman Sesi ToD Baru')
        .setDescription('Menyiarkan template embed peluncuran game ToD cantik')
        .setValue('tod_action_announce'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🛑 Hentikan Paksa Sesi Game ToD Aktif')
        .setDescription('Menghentikan paksa sesi ToD yang berjalan di Voice Channel')
        .setValue('tod_action_stop'),
      new StringSelectMenuOptionBuilder()
        .setLabel('➕ Tambahkan Pertanyaan ToD Baru (Modal)')
        .setDescription('Menambahkan pertanyaan kustom baru ke database ToD')
        .setValue('tod_action_add_question_modal')
    );

    const todActionRow = new ActionRowBuilder().addComponents(todActionSelect);

    const btnRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_shop_btn_back')
        .setLabel('🔙 Kembali ke Hub')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('admin_shop_btn_close')
        .setLabel('❌ Tutup Panel')
        .setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [shopActionRow, todActionRow, btnRow] };
  };

  const initialData = getShopPanelData(guildId);
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

  collector.on('collect', async iShop => {
    if (!iShop.member || !iShop.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return iShop.reply({ content: '❌ Akses Ditolak! Tombol/menu dashboard ini dikunci khusus untuk Administrator server.', flags: 64 });
    }

    try {
      if (iShop.customId === 'admin_shop_btn_back') {
        collector.stop('transition');
        await handleAdminPanel(iShop, client);
      }
      else if (iShop.customId === 'admin_shop_btn_close') {
        collector.stop();
        await replyMsg.delete().catch(() => {});
      }
      else if (iShop.customId === 'admin_shop_select_action') {
        const action = iShop.values[0];

        if (action === 'shop_action_add_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_shop_add_modal')
            .setTitle('Jual Role Baru di Toko');

          const roleInput = new TextInputBuilder()
            .setCustomId('role_id')
            .setLabel('ID Role Discord')
            .setPlaceholder('Masukkan ID role (Contoh: 1503324994153873458)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const priceInput = new TextInputBuilder()
            .setCustomId('role_price')
            .setLabel('Harga Jual (Koin Rupiah)')
            .setPlaceholder('Contoh: 150000')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const tierInput = new TextInputBuilder()
            .setCustomId('role_tier')
            .setLabel('Tier Rarity (COMMON/RARE/EPIC/LEGENDARY)')
            .setPlaceholder('Masukkan tier (Contoh: EPIC)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(roleInput),
            new ActionRowBuilder().addComponents(priceInput),
            new ActionRowBuilder().addComponents(tierInput)
          );
          await iShop.showModal(modal);

          const sub = await iShop.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_shop_add_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const rId = sub.fields.getTextInputValue('role_id').trim();
            const price = parseInt(sub.fields.getTextInputValue('role_price'));
            const tier = sub.fields.getTextInputValue('role_tier').trim().toUpperCase();

            if (isNaN(price) || price <= 0) {
              return sub.reply({ content: '❌ Harga harus berupa angka di atas 0!', flags: 64 });
            }

            const roleObj = guild.roles.cache.get(rId);
            if (!roleObj) {
              return sub.reply({ content: '❌ Role dengan ID tersebut tidak ditemukan di server!', flags: 64 });
            }

            database.run(
              'INSERT INTO shop_items (guild_id, role_id, role_name, price, tier, stock, description) VALUES (?, ?, ?, ?, ?, -1, ?)',
              [guildId, rId, roleObj.name, price, tier, `Koleksi kasta role ${tier} eksklusif.`]
            );

            await sub.reply({ content: `✅ Sukses menjual role <@&${rId}> seharga **Rp ${price.toLocaleString('id-ID')}** di etalase Toko!`, flags: 64 });
            const fresh = getShopPanelData(guildId);
            await replyMsg.edit(fresh).catch(() => {});
          }
        }
        else if (action === 'shop_action_remove_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_shop_remove_modal')
            .setTitle('Hapus Role dari Toko');

          const roleInput = new TextInputBuilder()
            .setCustomId('role_id')
            .setLabel('ID Role Discord')
            .setPlaceholder('Masukkan ID role terdaftar')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(roleInput));
          await iShop.showModal(modal);

          const sub = await iShop.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_shop_remove_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const rId = sub.fields.getTextInputValue('role_id').trim();
            database.run('DELETE FROM shop_items WHERE role_id = ? AND guild_id = ?', [rId, guildId]);
            
            await sub.reply({ content: `❌ Sukses menghapus role ID \`${rId}\` dari etalase toko.`, flags: 64 });
            const fresh = getShopPanelData(guildId);
            await replyMsg.edit(fresh).catch(() => {});
          }
        }
        else if (action === 'shop_action_stock_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_shop_stock_modal')
            .setTitle('Ubah Stok Role Toko');

          const roleInput = new TextInputBuilder()
            .setCustomId('role_id')
            .setLabel('ID Role Discord')
            .setPlaceholder('Masukkan ID role')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const stockInput = new TextInputBuilder()
            .setCustomId('role_stock')
            .setLabel('Jumlah Slot Stok (-1 untuk Unlimited)')
            .setPlaceholder('Contoh: 10')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(roleInput),
            new ActionRowBuilder().addComponents(stockInput)
          );
          await iShop.showModal(modal);

          const sub = await iShop.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_shop_stock_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const rId = sub.fields.getTextInputValue('role_id').trim();
            const stock = parseInt(sub.fields.getTextInputValue('role_stock'));

            if (isNaN(stock) || stock < -1) {
              return sub.reply({ content: '❌ Stok tidak valid!', flags: 64 });
            }

            database.run('UPDATE shop_items SET stock = ? WHERE role_id = ? AND guild_id = ?', [stock, rId, guildId]);

            await sub.reply({ content: `✅ Sukses memperbarui stok role ID \`${rId}\` menjadi **${stock === -1 ? 'Unlimited' : stock + ' slot'}**!`, flags: 64 });
            const fresh = getShopPanelData(guildId);
            await replyMsg.edit(fresh).catch(() => {});
          }
        }
        else if (action === 'shop_action_auto') {
          const defaultRoles = [
            { name: 'Mythic Resident', color: '#FF007F', price: 1500000, tier: 'MYTHIC', desc: 'Kasta legendaris tertinggi di server.' },
            { name: 'Legendary Resident', color: '#FFD700', price: 500000, tier: 'LEGENDARY', desc: 'Pemukim legendaris berwibawa tinggi.' },
            { name: 'Epic Resident', color: '#9D00FF', price: 150000, tier: 'EPIC', desc: 'Warga elit yang disegani oleh publik.' },
            { name: 'Rare Resident', color: '#00BFFF', price: 50000, tier: 'RARE', desc: 'Warga kelas menengah yang aktif.' },
            { name: 'Common Resident', color: '#00FF88', price: 15000, tier: 'COMMON', desc: 'Anggota pemukiman resmi pemegang KTP.' }
          ];
          
          let createdCount = 0;
          for (const rData of defaultRoles) {
            const existing = database.get('SELECT * FROM shop_items WHERE role_name = ? AND guild_id = ?', [rData.name, guildId]);
            if (!existing) {
              const newRole = await guild.roles.create({
                name: rData.name,
                color: rData.color,
                reason: 'Sentinel Auto Shop Role Initialization'
              }).catch(() => null);
              
              if (newRole) {
                database.run(
                  'INSERT INTO shop_items (guild_id, role_id, role_name, price, tier, stock, description) VALUES (?, ?, ?, ?, ?, -1, ?)',
                  [guildId, newRole.id, rData.name, rData.price, rData.tier, rData.desc]
                );
                createdCount++;
              }
            }
          }
          await iShop.reply({ content: `🎭 Sukses menginisialisasi Toko Role. Berhasil mendaftarkan & membuat **${createdCount}/5** kasta role prestise server!`, flags: 64 });
          const fresh = getShopPanelData(guildId);
          await replyMsg.edit(fresh).catch(() => {});
        }
      }
      else if (iShop.customId === 'admin_shop_select_tod') {
        const action = iShop.values[0];

        if (action === 'tod_action_announce') {
          const todAnnounceEmb = embeds.todAnnounceEmbed ? embeds.todAnnounceEmbed(guild) : new EmbedBuilder().setTitle('🎲 TRUTH OR DARE GAME').setDescription('Game Truth or Dare telah diluncurkan di Voice Channel!');
          await messageOrInteraction.channel.send({ content: '@everyone 🎲 **GAME TRUTH OR DARE AKTIF!** 🎲', embeds: [todAnnounceEmb] });
          await iShop.reply({ content: '📢 Sukses menyiarkan template pengumuman ToD ke channel ini!', flags: 64 });
        }
        else if (action === 'tod_action_stop') {
          try {
            const voiceEvents = require('../voice_events');
            if (voiceEvents.forceStopTodGame) {
              voiceEvents.forceStopTodGame(guildId);
            } else {
              const audio = require('../voice_events/audio');
              if (audio.clearVoiceConnection) {
                audio.clearVoiceConnection(guildId);
              }
            }
          } catch (e) {}
          await iShop.reply({ content: '🛑 Sukses menghentikan paksa sesi aktif game ToD di Voice Channel.', flags: 64 });
        }
        else if (action === 'tod_action_add_question_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_shop_tod_add_modal')
            .setTitle('Tambah Pertanyaan ToD');

          const typeInput = new TextInputBuilder()
            .setCustomId('question_type')
            .setLabel('Tipe (TRUTH / DARE)')
            .setPlaceholder('Contoh: truth')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const categoryInput = new TextInputBuilder()
            .setCustomId('question_cat')
            .setLabel('Kategori (CHILL / DEEP / SPICY)')
            .setPlaceholder('Contoh: chill')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const textInput = new TextInputBuilder()
            .setCustomId('question_text')
            .setLabel('Pertanyaan / Tantangan')
            .setPlaceholder('Masukkan pertanyaan/tantangan...')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(typeInput),
            new ActionRowBuilder().addComponents(categoryInput),
            new ActionRowBuilder().addComponents(textInput)
          );
          await iShop.showModal(modal);

          const sub = await iShop.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_shop_tod_add_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const qType = sub.fields.getTextInputValue('question_type').trim().toLowerCase();
            const qCat = sub.fields.getTextInputValue('question_cat').trim().toLowerCase();
            const qText = sub.fields.getTextInputValue('question_text').trim();

            if (!['truth', 'dare'].includes(qType) || !['chill', 'deep', 'spicy'].includes(qCat)) {
              return sub.reply({ content: '❌ Tipe atau Kategori tidak valid! Pilihan tipe: truth/dare. Pilihan kategori: chill/deep/spicy.', flags: 64 });
            }

            database.run(
              'INSERT INTO tod_questions (type, category, question_text, created_by) VALUES (?, ?, ?, ?)',
              [qType, qCat, qText, author.id]
            );

            await sub.reply({ content: `✅ Sukses menambahkan pertanyaan **${qType}** (${qCat}) ke database!`, flags: 64 });
          }
        }
      }
    } catch (err) {
      console.error('Error in Shop Panel Interaction:', err);
      await iShop.reply({ content: `❌ Terjadi kesalahan: ${err.message}`, flags: 64 }).catch(() => {});
    }
  });

  collector.on('end', async (collected, reason) => {
    if (reason === 'transition') return;
    try {
      const fresh = getShopPanelData(guildId);
      fresh.components = [];
      await replyMsg.edit(fresh).catch(() => {});
    } catch (e) {}
  });

  return true;
}

/**
 * 🎮 7. MAIN HUB PORTAL (ADMIN DASHBOARD CONTROL HUB)
 */
async function handleAdminPanel(messageOrInteraction, client) {
  const isInteraction = !messageOrInteraction.author;
  const guildId = messageOrInteraction.guildId;

  if (!guildId) return false;

  const getHubPanelData = () => {
    let embed = new EmbedBuilder()
      .setColor(0x2F3136)
      .setTitle('🎮 PUSAT KONTROL ADMINISTRATOR — SENTINEL')
      .setThumbnail(client.user.displayAvatarURL())
      .setDescription(
        `Selamat datang di **Pusat Kontrol Terpadu Sentinel Bot 2026**! 🛡️✨\n\n` +
        `Dashboard visual ini dipecah menjadi **5 Sub-Panel Mandiri** terfokus untuk membantu Anda mengelola server tanpa kebingungan:\n\n` +
        `🐾 **\`Panel Pet\`** — Sembuhkan HP, percepat tetas telur, atur level, atau reset peliharaan warga.\n` +
        `🏦 **\`Panel Bank\`** — Suntik/potong koin dompet warga, reset total ekonomi, atau bagi-bagi koin massal.\n` +
        `🚓 **\`Panel Robbery\`** — Bebaskan tahanan Lapas, reset global cooldown bank robbery.\n` +
        `📈 **\`Panel Saham\`** — Tambah/hapus saham bursa, drop harga, picu event bull/crash, dividen.\n` +
        `⚡ **\`Panel Abyus\`** — Sabotase kesulitan gacha role, atur multiplier obrolan chat warga, stop event.\n` +
        `🎭 **\`Panel Shop\`** — Tambahkan penjualan role server, set stok role, kontrol sesi game ToD VC.\n\n` +
        `👉 **Silakan klik tombol di bawah untuk membuka panel kontrol yang Anda inginkan:**`
      )
      .setTimestamp()
      .setFooter({ text: 'Sentinel Bot • Dashboard Utama Portal' });

    const btnRow1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('hub_btn_pet')
        .setLabel('🐾 Pet Panel')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('hub_btn_bank')
        .setLabel('🏦 Bank Panel')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('hub_btn_rob')
        .setLabel('🚓 Robbery Panel')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('hub_btn_saham')
        .setLabel('📈 Saham Panel')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('hub_btn_abyus')
        .setLabel('⚡ Abyus Panel')
        .setStyle(ButtonStyle.Success)
    );

    const btnRow2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('hub_btn_shop')
        .setLabel('🎭 Shop & ToD')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('hub_btn_close')
        .setLabel('❌ Tutup Hub')
        .setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [btnRow1, btnRow2] };
  };

  const initialData = getHubPanelData();
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

  collector.on('collect', async iHub => {
    if (!iHub.member || !iHub.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return iHub.reply({ content: '❌ Akses Ditolak! Tombol ini dikunci khusus untuk Administrator server.', flags: 64 });
    }

    try {
      if (iHub.customId === 'hub_btn_pet') {
        const isOwner = iHub.user.id === '436554535037698059';
        const isAdmin = iHub.member && iHub.member.permissions.has(PermissionsBitField.Flags.Administrator);
        if (!isOwner && !isAdmin) {
          return iHub.reply({ content: '❌ Akses Ditolak! Panel Admin Pet dikunci khusus untuk Owner utama & Administrator server.', flags: 64 });
        }
        collector.stop('transition');
        await handleAdminPetPanel(iHub, client);
      }
      else if (iHub.customId === 'hub_btn_bank') {
        collector.stop('transition');
        await handleAdminBankPanel(iHub, client);
      }
      else if (iHub.customId === 'hub_btn_rob') {
        collector.stop('transition');
        await handleAdminRobberyPanel(iHub, client);
      }
      else if (iHub.customId === 'hub_btn_saham') {
        collector.stop('transition');
        await handleAdminSahamPanel(iHub, client);
      }
      else if (iHub.customId === 'hub_btn_abyus') {
        collector.stop('transition');
        await handleAdminAbyusPanel(iHub, client);
      }
      else if (iHub.customId === 'hub_btn_shop') {
        collector.stop('transition');
        await handleAdminShopPanel(iHub, client);
      }
      else if (iHub.customId === 'hub_btn_close') {
        collector.stop();
        await replyMsg.delete().catch(() => {});
      }
    } catch (err) {
      console.error('Error in Hub Panel Interaction:', err);
      await iHub.reply({ content: `❌ Terjadi kesalahan: ${err.message}`, flags: 64 }).catch(() => {});
    }
  });

  collector.on('end', async (collected, reason) => {
    if (reason === 'transition') return;
    try {
      const fresh = getHubPanelData();
      fresh.components = [];
      await replyMsg.edit(fresh).catch(() => {});
    } catch (e) {}
  });

  return true;
}

module.exports = {
  handleAdminPanel,
  handleAdminPetPanel,
  handleAdminBankPanel,
  handleAdminRobberyPanel,
  handleAdminSahamPanel,
  handleAdminAbyusPanel,
  handleAdminShopPanel
};
