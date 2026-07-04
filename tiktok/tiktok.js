const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db } = require('../stockmarket/database');

// ─────────────────────────────────────────────────────────────────
// KONSTANTA
// ─────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 60_000; // 60 detik
const CHANNEL_NAME     = '📱┃notif-tiktok';
const LIVE_COOLDOWN_MS = 5 * 60_000; // 5 menit cooldown notif live ulang

// User-Agent agar tidak diblokir TikTok
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ─────────────────────────────────────────────────────────────────
// DATABASE HELPERS
// ─────────────────────────────────────────────────────────────────

function getSettings(guildId) {
  return db.prepare('SELECT * FROM tiktok_settings WHERE guild_id = ?').get(guildId);
}

function upsertSettings(guildId, data) {
  const existing = getSettings(guildId);
  if (!existing) {
    db.prepare(`
      INSERT INTO tiktok_settings (guild_id, notification_channel_id, notify_live, notify_video, mention_role_id, updated_at)
      VALUES (?, ?, 1, 1, NULL, strftime('%s','now'))
    `).run(guildId, data.notification_channel_id || null);
  } else {
    const sets = Object.keys(data).map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE tiktok_settings SET ${sets}, updated_at = strftime('%s','now') WHERE guild_id = ?`)
      .run(...Object.values(data), guildId);
  }
}

function getAccount(userId, guildId) {
  return db.prepare('SELECT * FROM tiktok_accounts WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
}

function upsertAccount(userId, guildId, tiktokUsername, displayName = '') {
  db.prepare(`
    INSERT INTO tiktok_accounts (user_id, guild_id, tiktok_username, display_name, is_active, created_at)
    VALUES (?, ?, ?, ?, 1, strftime('%s','now'))
    ON CONFLICT(user_id, guild_id) DO UPDATE SET
      tiktok_username = excluded.tiktok_username,
      display_name    = excluded.display_name,
      is_active       = 1
  `).run(userId, guildId, tiktokUsername, displayName);
}

function deleteAccount(userId, guildId) {
  return db.prepare('DELETE FROM tiktok_accounts WHERE user_id = ? AND guild_id = ?').run(userId, guildId);
}

function getAllActiveAccounts(guildId) {
  if (guildId) {
    return db.prepare('SELECT * FROM tiktok_accounts WHERE guild_id = ? AND is_active = 1').all(guildId);
  }
  return db.prepare('SELECT * FROM tiktok_accounts WHERE is_active = 1').all();
}

function updateAccountState(id, { lastVideoId, isLive, lastLiveAt, lastCheckedAt }) {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    UPDATE tiktok_accounts
    SET last_video_id   = COALESCE(?, last_video_id),
        is_live         = COALESCE(?, is_live),
        last_live_at    = COALESCE(?, last_live_at),
        last_checked_at = ?
    WHERE id = ?
  `).run(lastVideoId ?? null, isLive ?? null, lastLiveAt ?? null, lastCheckedAt ?? now, id);
}

// ─────────────────────────────────────────────────────────────────
// TIKTOK SCRAPER
// ─────────────────────────────────────────────────────────────────

/**
 * Mengambil info profil TikTok dari halaman web (tanpa API resmi).
 * Mengembalikan { displayName, latestVideoId, isLive, liveTitle, viewerCount } atau null jika gagal.
 */
async function fetchTikTokProfile(username) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`https://www.tiktok.com/@${username}`, {
      headers: {
        'User-Agent': UA,
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow'
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const html = await res.text();

    // Cari JSON embedded SIGI_STATE atau UNIVERSAL_DATA_FOR_REHYDRATION
    let jsonData = null;
    const scriptMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
    if (scriptMatch) {
      try { jsonData = JSON.parse(scriptMatch[1]); } catch { /* skip */ }
    }

    if (!jsonData) {
      const sigiMatch = html.match(/window\['SIGI_STATE'\]\s*=\s*(\{[\s\S]*?\});\s*window\['SIGI_RETRY'\]/);
      if (sigiMatch) {
        try { jsonData = JSON.parse(sigiMatch[1]); } catch { /* skip */ }
      }
    }

    // Ambil data dari JSON
    let displayName = username;
    let latestVideoId = null;
    let isLive = false;

    if (jsonData) {
      try {
        // Coba path UNIVERSAL_DATA
        const webapp = jsonData?.['__DEFAULT_SCOPE__']?.['webapp.user-detail']?.userInfo;
        if (webapp?.user?.nickname) displayName = webapp.user.nickname;

        // Cari video terbaru
        const itemList = jsonData?.['__DEFAULT_SCOPE__']?.['webapp.user-detail']?.itemList;
        if (Array.isArray(itemList) && itemList.length > 0) {
          latestVideoId = String(itemList[0].id || itemList[0].aweme_id || '');
        }

        // Cek is_live dari user stats
        if (webapp?.user?.roomId || webapp?.user?.isUnderAge === false && webapp?.liveRoom) {
          isLive = true;
        }
      } catch { /* skip parsing error */ }
    }

    // Fallback: cek keberadaan "LIVE" badge di HTML mentah
    if (!isLive && html.includes('"roomId"') && html.includes('"liveRoom"')) {
      isLive = true;
    }

    // Fallback latestVideoId dari og:url atau canonical
    if (!latestVideoId) {
      const videoUrlMatch = html.match(/https:\/\/www\.tiktok\.com\/@[^/]+\/video\/(\d+)/);
      if (videoUrlMatch) latestVideoId = videoUrlMatch[1];
    }

    return { displayName, latestVideoId, isLive };
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error(`[TikTok] Gagal fetch profil @${username}:`, err.message);
    }
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// EMBED BUILDERS
// ─────────────────────────────────────────────────────────────────

function buildLiveEmbed(discordUserId, tiktokUsername, displayName) {
  return new EmbedBuilder()
    .setColor(0xFF0050) // TikTok pink-red
    .setTitle('🔴 LIVE SEKARANG DI TIKTOK!')
    .setDescription(
      `> <@${discordUserId}> sedang **LIVE** di TikTok!\n` +
      `> Jangan sampai ketinggalan siaran langsungnya!\n\u200b`
    )
    .addFields(
      { name: '👤 Akun TikTok', value: `[@${tiktokUsername}](https://www.tiktok.com/@${tiktokUsername}/live)`, inline: true },
      { name: '🎥 Nama', value: displayName || tiktokUsername, inline: true }
    )
    .setImage(`https://p16-sign-sg.tiktokcdn.com/obj/tos-alisg-p-0037/${tiktokUsername}`) // placeholder, bisa null
    .setFooter({ text: '📱 TikTok Live Notification • Sentinel' })
    .setTimestamp();
}

function buildVideoEmbed(discordUserId, tiktokUsername, displayName, videoId) {
  const videoUrl = `https://www.tiktok.com/@${tiktokUsername}/video/${videoId}`;
  return new EmbedBuilder()
    .setColor(0x010101) // TikTok black
    .setTitle('📹 VIDEO BARU DI TIKTOK!')
    .setDescription(
      `> <@${discordUserId}> baru saja mengunggah **video baru**!\n` +
      `> Tonton dan berikan dukunganmu! 💪\n\u200b`
    )
    .addFields(
      { name: '👤 Akun TikTok', value: `[@${tiktokUsername}](${videoUrl})`, inline: true },
      { name: '🎥 Nama', value: displayName || tiktokUsername, inline: true }
    )
    .setFooter({ text: '📱 TikTok Video Notification • Sentinel' })
    .setTimestamp();
}

function buildLiveButton(tiktokUsername) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('🔴 Tonton Live Sekarang')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://www.tiktok.com/@${tiktokUsername}/live`)
  );
}

function buildVideoButton(tiktokUsername, videoId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('📹 Tonton Video')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://www.tiktok.com/@${tiktokUsername}/video/${videoId}`)
  );
}

// ─────────────────────────────────────────────────────────────────
// AUTO-CREATE CHANNEL
// ─────────────────────────────────────────────────────────────────

/**
 * Membuat channel TikTok secara otomatis jika belum ada.
 * Dicari dulu berdasarkan nama, jika tidak ada baru dibuat.
 */
async function autoCreateTikTokChannel(guild) {
  try {
    // Cek apakah sudah ada di settings
    const settings = getSettings(guild.id);
    if (settings?.notification_channel_id) {
      const existing = guild.channels.cache.get(settings.notification_channel_id);
      if (existing) return existing;
    }

    // Cari channel dengan nama yang cocok
    let channel = guild.channels.cache.find(c =>
      c.name === '📱┃notif-tiktok' || c.name === 'notif-tiktok' || c.name === 'tiktok-notif'
    );

    // Jika tidak ada, buat channel baru
    if (!channel) {
      // Cari kategori yang tepat (INFORMASI / ANNOUNCEMENT / INFO)
      const category = guild.channels.cache.find(c =>
        c.type === 4 && /info|pengumuman|announce|notif/i.test(c.name)
      );

      channel = await guild.channels.create({
        name: '📱┃notif-tiktok',
        type: 0, // GUILD_TEXT
        parent: category?.id || null,
        topic: '🔴 Notifikasi otomatis TikTok Live & Video Baru dari member komunitas! | /settiktok untuk daftar akun TikTokmu.',
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            allow: ['ViewChannel', 'ReadMessageHistory'],
            deny: ['SendMessages']
          }
        ]
      });

      console.log(`📱 [TikTok] Channel '${channel.name}' berhasil dibuat di guild ${guild.name}`);
    }

    // Simpan ke settings
    upsertSettings(guild.id, { notification_channel_id: channel.id });

    return channel;
  } catch (err) {
    console.error(`❌ [TikTok] Gagal membuat channel di guild ${guild.name}:`, err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// WATCHER (POLLING LOOP)
// ─────────────────────────────────────────────────────────────────

async function runWatcherCycle(client) {
  const allAccounts = getAllActiveAccounts();
  if (allAccounts.length === 0) return;

  for (const account of allAccounts) {
    try {
      const profile = await fetchTikTokProfile(account.tiktok_username);
      if (!profile) continue;

      const { displayName, latestVideoId, isLive } = profile;
      const now = Math.floor(Date.now() / 1000);

      // Ambil guild dan channel notifikasi
      const guild = client.guilds.cache.get(account.guild_id);
      if (!guild) continue;

      const settings = getSettings(account.guild_id);
      if (!settings?.notification_channel_id) continue;

      const channel = guild.channels.cache.get(settings.notification_channel_id);
      if (!channel) continue;

      const mentionText = settings.mention_role_id
        ? `<@&${settings.mention_role_id}> `
        : '';

      // ── Deteksi LIVE ──
      const wasLive = account.is_live === 1;
      const liveCooldownOk = now - (account.last_live_at || 0) > LIVE_COOLDOWN_MS / 1000;

      if (isLive && !wasLive && settings.notify_live === 1) {
        const embed = buildLiveEmbed(account.user_id, account.tiktok_username, displayName);
        const row   = buildLiveButton(account.tiktok_username);
        await channel.send({ content: `${mentionText}🔴 **@${account.tiktok_username} sedang LIVE!**`, embeds: [embed], components: [row] });
        updateAccountState(account.id, { isLive: 1, lastLiveAt: now, lastCheckedAt: now });
        console.log(`📱 [TikTok] Live notif dikirim: @${account.tiktok_username}`);
      } else if (!isLive && wasLive) {
        // Live selesai — update status
        updateAccountState(account.id, { isLive: 0, lastCheckedAt: now });
      }

      // ── Deteksi Video Baru ──
      const isNewVideo = latestVideoId &&
        account.last_video_id !== null &&
        latestVideoId !== account.last_video_id;

      if (isNewVideo && settings.notify_video === 1) {
        const embed = buildVideoEmbed(account.user_id, account.tiktok_username, displayName, latestVideoId);
        const row   = buildVideoButton(account.tiktok_username, latestVideoId);
        await channel.send({ content: `${mentionText}📹 **@${account.tiktok_username} upload video baru!**`, embeds: [embed], components: [row] });
        console.log(`📱 [TikTok] Video notif dikirim: @${account.tiktok_username} (${latestVideoId})`);
      }

      // Selalu update last_video_id (juga untuk initial seed)
      updateAccountState(account.id, {
        lastVideoId: latestVideoId || account.last_video_id,
        isLive: isLive ? 1 : (wasLive ? 0 : account.is_live),
        lastCheckedAt: now
      });

      // Delay antar akun agar tidak kena rate limit
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`❌ [TikTok] Error saat memproses @${account.tiktok_username}:`, err.message);
    }
  }
}

/**
 * Memulai watcher TikTok.
 * Dipanggil sekali saat bot ready.
 */
function startTikTokWatcher(client) {
  console.log(`📱 [TikTok] Watcher dimulai (interval: ${POLL_INTERVAL_MS / 1000}s)`);
  setInterval(() => runWatcherCycle(client).catch(err => {
    console.error('❌ [TikTok] Watcher cycle error:', err.message);
  }), POLL_INTERVAL_MS);
}

module.exports = {
  // DB
  getSettings,
  upsertSettings,
  getAccount,
  upsertAccount,
  deleteAccount,
  getAllActiveAccounts,
  // Channel
  autoCreateTikTokChannel,
  // Watcher
  startTikTokWatcher,
  fetchTikTokProfile
};
