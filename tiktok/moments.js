const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, ApplicationCommandType
} = require('discord.js');
const { db } = require('../stockmarket/database');
const config = require('../stockmarket/config');

const OWNER_ID = config.OWNER_ID;

// ─────────────────────────────────────────────────────────────────
// DATABASE FUNCTIONS
// ─────────────────────────────────────────────────────────────────

function addMoment(guildId, channelId, messageId, authorId, reporterId, content, attachments, note = '') {
  const result = db.prepare(`
    INSERT INTO tiktok_moments (guild_id, channel_id, message_id, author_id, reporter_id, content, attachments, note, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', strftime('%s','now'))
  `).run(guildId, channelId, messageId, authorId, reporterId, content, JSON.stringify(attachments || []), note);
  return result.lastInsertRowid;
}

function getMoment(id) {
  return db.prepare('SELECT * FROM tiktok_moments WHERE id = ?').get(id);
}

function updateMomentStatus(id, status) {
  return db.prepare('UPDATE tiktok_moments SET status = ? WHERE id = ?').run(status, id);
}

function getMomentsByStatus(status, guildId) {
  if (guildId) {
    return db.prepare('SELECT * FROM tiktok_moments WHERE status = ? AND guild_id = ? ORDER BY created_at DESC').all(status, guildId);
  }
  return db.prepare('SELECT * FROM tiktok_moments WHERE status = ? ORDER BY created_at DESC').all(status);
}

function getAllMoments(guildId) {
  if (guildId) {
    return db.prepare('SELECT * FROM tiktok_moments WHERE guild_id = ? ORDER BY created_at DESC').all(guildId);
  }
  return db.prepare('SELECT * FROM tiktok_moments ORDER BY created_at DESC').all();
}

// ─────────────────────────────────────────────────────────────────
// NOTIFICATION & UI BUILDERS
// ─────────────────────────────────────────────────────────────────

function buildMomentEmbed(moment, title = '🎬 Momen TikTok Baru Dilaporkan!') {
  let color = 0xFF0050; // TikTok pink
  if (moment.status === 'COMPLETED') color = 0x10B981; // Green
  if (moment.status === 'REJECTED') color = 0xEF4444; // Red

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(
      `> **Pesan Asli:**\n${moment.content ? moment.content : '*Tidak ada konten teks (mungkin gambar/embed/file)*'}\n\u200b`
    )
    .addFields(
      { name: '👤 Penulis Momen', value: `<@${moment.author_id}>`, inline: true },
      { name: '📥 Pelapor', value: `<@${moment.reporter_id}>`, inline: true },
      { name: '📍 Lokasi', value: `<#${moment.channel_id}>`, inline: true },
      { name: '📝 Catatan Pelapor', value: moment.note || '*Tidak ada catatan*', inline: false },
      { name: '⚙️ Status Saat Ini', value: `\`${moment.status}\``, inline: true },
      { name: '🕒 Dilaporkan pada', value: `<t:${moment.created_at}:R>`, inline: true }
    )
    .setTimestamp();

  // Lampiran media jika ada
  let attachments = [];
  try {
    attachments = JSON.parse(moment.attachments || '[]');
  } catch (err) {}

  if (attachments && attachments.length > 0) {
    embed.addFields({ name: '📎 Lampiran File', value: attachments.map((a, i) => `[File ${i+1}](${a})`).join(', ') });
    // Jika ada satu gambar, pasang sebagai Image Embed
    const firstImg = attachments.find(url => /\.(jpg|jpeg|png|gif|webp)/i.test(url));
    if (firstImg) {
      embed.setImage(firstImg);
    }
  }

  return embed;
}

function buildMomentButtons(momentId, isActionable = true) {
  const row = new ActionRowBuilder();
  if (isActionable) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`tt_moment_approve_${momentId}`)
        .setLabel('Jadikan Konten (Done)')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`tt_moment_reject_${momentId}`)
        .setLabel('Tolak / Hapus')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger)
    );
  }
  return row;
}

// ─────────────────────────────────────────────────────────────────
// NOTIFY OWNER
// ─────────────────────────────────────────────────────────────────

async function notifyOwnerOfMoment(client, momentId) {
  try {
    const moment = getMoment(momentId);
    if (!moment) return;

    const owner = await client.users.fetch(OWNER_ID).catch(() => null);
    if (!owner) {
      console.warn(`[TikTok Moments] Owner dengan ID ${OWNER_ID} tidak ditemukan atau DM tidak dapat diakses.`);
      return;
    }

    const embed = buildMomentEmbed(moment);
    const buttons = buildMomentButtons(momentId, true);
    
    // Tambahkan tombol link ke pesan asli
    const messageUrl = `https://discord.com/channels/${moment.guild_id}/${moment.channel_id}/${moment.message_id}`;
    const linkRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('🔗 Buka Pesan Asli')
        .setStyle(ButtonStyle.Link)
        .setURL(messageUrl)
    );

    const components = [linkRow];
    if (moment.status === 'PENDING') {
      components.push(buttons);
    }

    await owner.send({
      content: `🔔 **Halo Owner!** Seseorang melaporkan momen seru/lucu baru untuk dijadikan bahan konten TikTok:`,
      embeds: [embed],
      components: components
    }).catch(err => {
      console.error(`[TikTok Moments] Gagal mengirim DM ke owner:`, err.message);
    });
  } catch (err) {
    console.error(`[TikTok Moments] Error saat menotifikasi owner:`, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// INTERACTION HANDLERS
// ─────────────────────────────────────────────────────────────────

async function handleMomentContextMenu(interaction, client) {
  const message = interaction.targetMessage;
  
  // Buat modal untuk memasukkan note / alasan
  const modal = new ModalBuilder()
    .setCustomId(`tt_modal_moment_${message.id}`)
    .setTitle('🎬 Laporkan Momen TikTok');

  const noteInput = new TextInputBuilder()
    .setCustomId('note_input')
    .setLabel('Kenapa momen ini seru / lucu?')
    .setPlaceholder('Contoh: Si A kalah taruhan RPG koin habis wkwk')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(300)
    .setRequired(false);

  modal.addComponents(new ActionRowBuilder().addComponents(noteInput));
  await interaction.showModal(modal);
}

async function handleMomentModalSubmit(interaction, client) {
  if (!interaction.customId.startsWith('tt_modal_moment_')) return;
  const messageId = interaction.customId.replace('tt_modal_moment_', '');
  const note = interaction.fields.getTextInputValue('note_input') || '';

  await interaction.deferReply({ flags: 64 });

  try {
    const channel = interaction.channel;
    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) {
      return interaction.editReply({ content: '❌ Gagal melacak pesan asli. Pastikan pesan tersebut tidak dihapus.' });
    }

    const attachments = [...message.attachments.values()].map(a => a.url);
    if (message.embeds && message.embeds.length > 0) {
      // Masukkan gambar embed jika ada
      message.embeds.forEach(emb => {
        if (emb.image?.url) attachments.push(emb.image.url);
        if (emb.thumbnail?.url) attachments.push(emb.thumbnail.url);
      });
    }

    const momentId = addMoment(
      interaction.guildId,
      interaction.channelId,
      messageId,
      message.author.id,
      interaction.user.id,
      message.content,
      attachments,
      note
    );

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x10B981)
          .setTitle('✅ Momen Berhasil Dilaporkan!')
          .setDescription('Momen ini telah disimpan ke database dan dikirim ke Owner untuk dijadikan konten TikTok. Terima kasih atas laporannya! 🙌')
          .setTimestamp()
      ]
    });

    // Kirim DM ke owner
    await notifyOwnerOfMoment(client, momentId);
  } catch (err) {
    console.error('[TikTok Moments] Gagal menyimpan dari modal:', err.message);
    await interaction.editReply({ content: '❌ Terjadi kesalahan saat menyimpan momen.' });
  }
}

async function handleMomentButtonInteraction(interaction, client) {
  const { customId, user } = interaction;
  
  // Keamanan: Hanya Owner yang dapat menyetujui / menolak momen
  if (user.id !== OWNER_ID) {
    return interaction.reply({ content: '❌ Hanya Owner bot yang dapat mengelola status momen ini!', flags: 64 });
  }

  const isApprove = customId.startsWith('tt_moment_approve_');
  const isReject = customId.startsWith('tt_moment_reject_');
  if (!isApprove && !isReject) return;

  const momentId = customId.replace(isApprove ? 'tt_moment_approve_' : 'tt_moment_reject_', '');
  const moment = getMoment(momentId);

  if (!moment) {
    return interaction.reply({ content: '❌ Momen tidak ditemukan di database.', flags: 64 });
  }

  await interaction.deferUpdate();

  const newStatus = isApprove ? 'COMPLETED' : 'REJECTED';
  updateMomentStatus(momentId, newStatus);
  moment.status = newStatus;

  // Edit pesan DM Owner dengan embed status baru dan hapus tombol aksi
  const embed = buildMomentEmbed(moment, isApprove ? '✅ Momen Disetujui (Jadi Konten)' : '❌ Momen Ditolak / Dihapus');
  
  const messageUrl = `https://discord.com/channels/${moment.guild_id}/${moment.channel_id}/${moment.message_id}`;
  const linkRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('🔗 Buka Pesan Asli')
      .setStyle(ButtonStyle.Link)
      .setURL(messageUrl)
  );

  await interaction.editReply({
    embeds: [embed],
    components: [linkRow]
  });
}

// Perintah Slash /momen
async function handleMomentSlashCommand(interaction, client) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'lapor') {
    const linkOrId = interaction.options.getString('pesan');
    const note = interaction.options.getString('catatan') || '';

    // Parsing link pesan jika user memberikan URL
    let messageId = linkOrId;
    let channelId = interaction.channelId;
    let guildId = interaction.guildId;

    const urlMatch = linkOrId.match(/channels\/(\d+)\/(\d+)\/(\d+)/);
    if (urlMatch) {
      guildId = urlMatch[1];
      channelId = urlMatch[2];
      messageId = urlMatch[3];
    }

    await interaction.deferReply({ flags: 64 });

    try {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        return interaction.editReply({ content: '❌ Channel tidak ditemukan atau bot tidak memiliki izin membaca.' });
      }

      const message = await channel.messages.fetch(messageId).catch(() => null);
      if (!message) {
        return interaction.editReply({ content: '❌ Pesan tidak ditemukan. Silakan periksa kembali Link / ID pesan.' });
      }

      const attachments = [...message.attachments.values()].map(a => a.url);
      if (message.embeds && message.embeds.length > 0) {
        message.embeds.forEach(emb => {
          if (emb.image?.url) attachments.push(emb.image.url);
          if (emb.thumbnail?.url) attachments.push(emb.thumbnail.url);
        });
      }

      const momentId = addMoment(
        guildId,
        channelId,
        messageId,
        message.author.id,
        interaction.user.id,
        message.content,
        attachments,
        note
      );

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x10B981)
            .setTitle('✅ Momen Berhasil Dilaporkan!')
            .setDescription('Momen ini telah disimpan ke database dan dikirim ke Owner untuk dijadikan konten TikTok. Terima kasih! 🙌')
            .setTimestamp()
        ]
      });

      await notifyOwnerOfMoment(client, momentId);
    } catch (err) {
      console.error('[TikTok Moments] Error in slash command lapor:', err.message);
      await interaction.editReply({ content: '❌ Gagal melacak atau memproses pesan tersebut.' });
    }
  }

  else if (sub === 'list') {
    // Hanya Admin / Owner
    const isOwner = interaction.user.id === OWNER_ID;
    const isAdmin = interaction.member && interaction.member.permissions.has('Administrator');
    if (!isOwner && !isAdmin) {
      return interaction.reply({ content: '❌ Hanya Owner atau Administrator yang dapat melihat daftar momen!', flags: 64 });
    }

    await interaction.deferReply({ flags: 64 });

    const statusFilter = interaction.options.getString('status') || 'PENDING';
    const moments = getMomentsByStatus(statusFilter, interaction.guildId);

    if (moments.length === 0) {
      return interaction.editReply({ content: `📭 Tidak ada momen dengan status \`${statusFilter}\` di server ini.` });
    }

    const embed = new EmbedBuilder()
      .setColor(0xFF0050)
      .setTitle(`📋 Daftar Momen TikTok (${statusFilter})`)
      .setDescription(`Ditemukan **${moments.length}** momen. Berikut adalah daftarnya:`)
      .setTimestamp();

    const lines = moments.slice(0, 10).map((m, idx) => {
      const url = `https://discord.com/channels/${m.guild_id}/${m.channel_id}/${m.message_id}`;
      return `\`${idx + 1}\`. <@${m.author_id}>: "${m.content ? m.content.substring(0, 40) + '...' : 'Media'}"\n   👉 [Buka Pesan](${url}) | Oleh: <@${m.reporter_id}> | Catatan: *${m.note || '-'}*`;
    });

    embed.addFields({ name: 'Daftar Momen (10 Teratas)', value: lines.join('\n\n') });
    await interaction.editReply({ embeds: [embed] });
  }
}

// ─────────────────────────────────────────────────────────────────
// AUTOMATIC REACTION LISTENER
// ─────────────────────────────────────────────────────────────────

async function handleMessageReactionAdd(reaction, user, client) {
  try {
    if (user.bot) return;

    // Hanya merespon jika emoji adalah clapper board 🎬 atau ketawa 😂
    const emojiName = reaction.emoji.name;
    if (emojiName !== '🎬' && emojiName !== '😂') return;

    // Pastikan reaction partial di-fetch
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (err) {
        console.error('[TikTok Moments] Gagal mengambil detail reaksi:', err.message);
        return;
      }
    }

    const message = reaction.message;
    if (!message.guildId) return;

    // Cek apakah sudah pernah dilaporkan dengan memeriksa database agar tidak duplikat
    const existing = db.prepare('SELECT id FROM tiktok_moments WHERE message_id = ?').get(message.id);
    if (existing) return;

    const attachments = [...message.attachments.values()].map(a => a.url);
    if (message.embeds && message.embeds.length > 0) {
      message.embeds.forEach(emb => {
        if (emb.image?.url) attachments.push(emb.image.url);
        if (emb.thumbnail?.url) attachments.push(emb.thumbnail.url);
      });
    }

    const momentId = addMoment(
      message.guildId,
      message.channelId,
      message.id,
      message.author.id,
      user.id,
      message.content,
      attachments,
      `Dilaporkan secara otomatis via reaksi emoji ${emojiName}`
    );

    // Kirim notifikasi DM ke owner
    await notifyOwnerOfMoment(client, momentId);
    
    // Beri tanda jempol / reaksi balik dari bot sebagai konfirmasi tersimpan
    await message.react('📥').catch(() => {});
  } catch (err) {
    console.error('[TikTok Moments] Gagal memproses reaksi emoji:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// AUTOMATIC GAME HIGHLIGHTS LOGGING
// ─────────────────────────────────────────────────────────────────

function logGameHighlight(guildId, channelId, messageId, winnerId, gameName, detailsScore, note) {
  try {
    const attachments = [];
    const content = `🎮 **HIGHLIGHT GAME BOT**\n**Game:** ${gameName}\n**Pemain:** <@${winnerId}>\n**Hasil:** ${detailsScore}`;
    
    const momentId = addMoment(
      guildId,
      channelId,
      messageId,
      winnerId,
      'BOT_SYSTEM',
      content,
      attachments,
      note
    );
    
    return momentId;
  } catch (err) {
    console.error('[TikTok Moments] Gagal log game highlight:', err.message);
    return null;
  }
}

module.exports = {
  addMoment,
  getMoment,
  updateMomentStatus,
  notifyOwnerOfMoment,
  handleMomentContextMenu,
  handleMomentModalSubmit,
  handleMomentButtonInteraction,
  handleMomentSlashCommand,
  handleMessageReactionAdd,
  logGameHighlight
};
