const { EmbedBuilder, AuditLogEvent } = require('discord.js');

const ADMIN_LOG_CHANNEL_ID = '1503324994153873458';

/**
 * Mencari pelaku (executor) tindakan di Discord Audit Logs.
 * Memastikan log terjadi sangat baru (kurang dari 10 detik yang lalu).
 * 
 * @param {import('discord.js').Guild} guild 
 * @param {number} actionType 
 * @param {string} targetId 
 * @returns {Promise<import('discord.js').User | null>}
 */
async function getAuditLogExecutor(guild, actionType, targetId) {
  try {
    const auditLogs = await guild.fetchAuditLogs({
      limit: 1,
      type: actionType,
    });
    const entry = auditLogs.entries.first();
    if (entry && entry.target && entry.target.id === targetId) {
      if (Date.now() - entry.createdTimestamp < 10000) {
        return entry.executor;
      }
    }
  } catch (e) {
    console.error(`[logger] Gagal membaca audit log untuk aksi ${actionType}:`, e.message);
  }
  return null;
}

/**
 * Mengirimkan pesan log berbentuk embed estetis ke saluran log admin khusus.
 * 
 * @param {import('discord.js').Client} client 
 * @param {import('discord.js').Guild} guild 
 * @param {EmbedBuilder | string | object} embedOrPayload 
 */
async function sendAdminLog(client, guild, embedOrPayload) {
  try {
    if (!guild) return;
    const channel = guild.channels.cache.get(ADMIN_LOG_CHANNEL_ID) || await guild.channels.fetch(ADMIN_LOG_CHANNEL_ID).catch(() => null);
    if (!channel) {
      console.warn(`[logger] Saluran log admin ${ADMIN_LOG_CHANNEL_ID} tidak ditemukan di server ${guild.name}`);
      return;
    }

    let payload = {};
    if (embedOrPayload instanceof EmbedBuilder) {
      payload = { embeds: [embedOrPayload] };
    } else if (typeof embedOrPayload === 'string') {
      payload = { content: embedOrPayload };
    } else if (embedOrPayload && embedOrPayload.embeds) {
      payload = embedOrPayload;
    } else {
      payload = { embeds: [new EmbedBuilder(embedOrPayload)] };
    }

    await channel.send(payload);
  } catch (err) {
    console.error('[logger] Gagal mengirim pesan log ke saluran:', err.message);
  }
}

/**
 * Mendapatkan nama tipe saluran yang ramah dibaca manusia.
 * 
 * @param {number} type 
 * @returns {string}
 */
function getChannelTypeName(type) {
  switch (type) {
    case 0: return 'GuildText (Saluran Teks)';
    case 2: return 'GuildVoice (Saluran Suara)';
    case 4: return 'GuildCategory (Kategori)';
    case 5: return 'GuildAnnouncement (Pengumuman)';
    case 11: return 'PublicThread (Utas Publik)';
    case 12: return 'PrivateThread (Utas Privat)';
    case 13: return 'GuildStageVoice (Stage Channel)';
    default: return `Type ${type}`;
  }
}

module.exports = {
  ADMIN_LOG_CHANNEL_ID,
  sendAdminLog,
  getAuditLogExecutor,
  getChannelTypeName
};
