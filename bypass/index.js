/**
 * Premium Webhook Mirroring & Link Bypass Module
 * 
 * Modul ini mendeteksi link video yang memiliki preview rusak di Discord (TikTok, Twitter/X, Instagram)
 * dan secara instan menggantinya dengan link bypass yang mendukung video native player.
 * Menggunakan Discord Webhook untuk menduplikasi identitas pengirim asli secara persis demi estetika premium.
 */

// Rate limiter untuk mencegah spam webhook (maks 3 bypass per 30 detik per user)
const bypassCooldowns = new Map();
const BYPASS_RATE_LIMIT = 3;
const BYPASS_RATE_WINDOW_MS = 30 * 1000;

/**
 * Mengecek apakah user masih dalam batas rate limit bypass.
 * @param {string} userId - ID user Discord.
 * @returns {boolean} - true jika masih diizinkan, false jika sudah mencapai limit.
 */
function checkBypassRateLimit(userId) {
  const now = Date.now();
  if (!bypassCooldowns.has(userId)) {
    bypassCooldowns.set(userId, []);
  }
  const timestamps = bypassCooldowns.get(userId).filter(ts => now - ts < BYPASS_RATE_WINDOW_MS);
  bypassCooldowns.set(userId, timestamps);

  if (timestamps.length >= BYPASS_RATE_LIMIT) return false;
  timestamps.push(now);
  return true;
}

/**
 * Mendeteksi dan mengganti link video dari platform TikTok, Twitter/X, dan Instagram Reels.
 * @param {string} text - Teks pesan asli.
 * @returns {Object} - Mengembalikan { hasChanges: boolean, modified: string }
 */
function bypassLinks(text) {
  let modified = text;
  let hasChanges = false;

  // 1. TikTok -> tnktok.com
  // Mencakup tiktok.com, vm.tiktok.com, vt.tiktok.com, www.tiktok.com
  modified = modified.replace(/https?:\/\/(?:[a-z0-9-]+\.)?tiktok\.com\/[^\s]+/gi, (match) => {
    if (match.includes('tnktok.com')) return match;
    hasChanges = true;
    return match.replace(/tiktok\.com/i, 'tnktok.com');
  });

  // 2. Twitter/X -> fxtwitter.com
  // Mencakup twitter.com, x.com, www.twitter.com, www.x.com
  modified = modified.replace(/https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[^\s]+/gi, (match) => {
    if (match.includes('fxtwitter.com')) return match;
    hasChanges = true;
    return match.replace(/(?:www\.)?(?:twitter\.com|x\.com)/i, 'fxtwitter.com');
  });

  // 3. Instagram -> ddinstagram.com
  // Mencakup instagram.com/reel/, instagram.com/reels/, instagram.com/p/
  modified = modified.replace(/https?:\/\/(?:www\.)?instagram\.com\/(?:reel|reels|p)\/[^\s]+/gi, (match) => {
    if (match.includes('ddinstagram.com')) return match;
    hasChanges = true;
    return match.replace(/(?:www\.)?instagram\.com/i, 'ddinstagram.com');
  });

  return { hasChanges, modified };
}

/**
 * Memproses pesan, melakukan Webhook Mirroring jika ada link yang perlu di-bypass.
 * @param {Message} message - Objek pesan discord.js.
 * @param {Client} client - Instance Discord Client.
 * @returns {Promise<boolean>} - Mengembalikan true jika pesan diintersepsi dan diproses, false jika diabaikan.
 */
async function handleLinkMirroring(message, client) {
  // Hanya proses jika pesan memiliki konten teks
  if (!message.content) return false;

  // Cek rate limit per user (mencegah spam webhook)
  if (!checkBypassRateLimit(message.author.id)) return false;

  const { hasChanges, modified } = bypassLinks(message.content);
  // Jika tidak ada link yang perlu di-bypass, lewati
  if (!hasChanges) return false;

  const { channel, guild } = message;

  // Persiapkan lampiran file jika pengirim menyertakan media dalam pesan asli
  const files = message.attachments.size > 0 
    ? [...message.attachments.values()].map(att => att.url) 
    : [];

  // Jika pesan dikirim di DM atau channel tidak mendukung Webhook (misalnya thread)
  if (!guild || !channel || typeof channel.fetchWebhooks !== 'function') {
    try {
      await message.reply({
        content: `🎥 **Bypass Video Embed:**\n${modified}`,
        files: files,
        allowedMentions: { repliedUser: false }
      });
      // Hapus pesan asli jika bisa
      if (message.deletable) {
        await message.delete().catch(() => {});
      }
    } catch (err) {
      console.error('[Bypass Fallback] Gagal mengirim fallback reply:', err.message);
    }
    return true; // Berhasil diintersepsi
  }

  try {
    // 1. Ambil atau buat webhook di channel ini
    const webhooks = await channel.fetchWebhooks();
    let webhook = webhooks.find(wh => wh.owner.id === client.user.id);

    if (!webhook) {
      webhook = await channel.createWebhook({
        name: 'Premium Link Mirror',
        avatar: client.user.displayAvatarURL(),
        reason: 'Premium Webhook Mirroring untuk perbaikan preview video'
      });
      console.log(`[Bypass] Berhasil membuat Webhook baru di channel #${channel.name}`);
    }

    // 2. Duplikasi identitas pengirim asli secara persis
    const displayName = message.member?.displayName || message.author.displayName || message.author.username;
    // Gunakan avatar dinamis (gif jika animasi, png jika statis)
    const avatarURL = message.author.displayAvatarURL({ forceStatic: false, size: 256 });

    // 3. Kirim pesan duplikat yang sudah diperbaiki via Webhook
    await webhook.send({
      content: modified,
      username: displayName,
      avatarURL: avatarURL,
      files: files,
      allowedMentions: { parse: ['users'] } // Batasi pings agar rapi dan tidak mengganggu
    });

    // 4. Hapus pesan asli secara instan
    if (message.deletable) {
      await message.delete().catch(err => {
        console.warn(`[Bypass] Tidak dapat menghapus pesan asli: ${err.message}`);
      });
    }

    console.log(`[Bypass] Berhasil melakukan mirroring pesan dari ${message.author.tag} di #${channel.name}`);
    return true;
  } catch (error) {
    console.error(`[Bypass Webhook Error] Gagal melakukan webhook mirroring:`, error.message);

    // Mekanisme Fallback Premium jika terjadi error (misalnya kekurangan permission Manage Webhooks)
    try {
      await message.reply({
        content: `🎥 **Bypass Video Embed:**\n${modified}`,
        files: files,
        allowedMentions: { repliedUser: false }
      });
      
      if (message.deletable) {
        await message.delete().catch(() => {});
      }
    } catch (fallbackError) {
      console.error('[Bypass Fallback] Gagal menjalankan fallback:', fallbackError.message);
    }

    return true;
  }
}

module.exports = {
  bypassLinks,
  handleLinkMirroring,
  checkBypassRateLimit
};
