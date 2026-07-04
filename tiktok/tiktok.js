const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType
} = require('discord.js');
const { db } = require('../stockmarket/database');

// ─────────────────────────────────────────────────────────────────
// KONSTANTA
// ─────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS  = 60_000;       // 60 detik polling
const LIVE_COOLDOWN_MS  = 5 * 60_000;  // 5 menit cooldown notif live ulang
const PANEL_CHANNEL_NAME = '📱┃panel-tiktok';
const NOTIF_CHANNEL_NAME = '📱┃notif-tiktok';

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

function updateAccountState(id, { lastVideoId, isLive, lastLiveAt, lastCheckedAt, videoCount }) {
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    UPDATE tiktok_accounts
    SET last_video_id   = COALESCE(?, last_video_id),
        is_live         = COALESCE(?, is_live),
        last_live_at    = COALESCE(?, last_live_at),
        last_checked_at = ?,
        video_count     = COALESCE(?, video_count)
    WHERE id = ?
  `).run(lastVideoId ?? null, isLive ?? null, lastLiveAt ?? null, lastCheckedAt ?? now, videoCount ?? null, id);
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
    let videoCount = -1;

    if (jsonData) {
      try {
        // Coba path UNIVERSAL_DATA
        const webapp = jsonData?.['__DEFAULT_SCOPE__']?.['webapp.user-detail']?.userInfo;
        if (webapp?.user?.nickname) displayName = webapp.user.nickname;

        // Cari videoCount
        if (webapp?.stats?.videoCount !== undefined) {
          videoCount = parseInt(webapp.stats.videoCount);
        } else if (webapp?.statsV2?.videoCount !== undefined) {
          videoCount = parseInt(webapp.statsV2.videoCount);
        }

        // Cek is_live dari user stats / roomId
        if (webapp?.user?.roomId) {
          isLive = true;
        } else if (webapp?.user?.isUnderAge === false && webapp?.liveRoom) {
          isLive = true;
        }
      } catch { /* skip parsing error */ }
    }

    // Fallback: cek keberadaan "roomId" / "liveRoom" dengan nilai valid di HTML mentah
    if (!isLive && (html.includes('"roomId":"') && !html.includes('"roomId":""')) && html.includes('"liveRoom"')) {
      isLive = true;
    }

    // Fallback latestVideoId dari og:url atau canonical
    if (!latestVideoId) {
      const videoUrlMatch = html.match(/https:\/\/www\.tiktok\.com\/@[^/]+\/video\/(\d+)/);
      if (videoUrlMatch) latestVideoId = videoUrlMatch[1];
    }

    return { displayName, latestVideoId, isLive, videoCount };
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
  const hasVideoId = videoId && videoId !== 'null';
  const videoUrl = hasVideoId 
    ? `https://www.tiktok.com/@${tiktokUsername}/video/${videoId}`
    : `https://www.tiktok.com/@${tiktokUsername}`;
  
  return new EmbedBuilder()
    .setColor(0x010101) // TikTok black
    .setTitle('📹 VIDEO BARU DI TIKTOK!')
    .setDescription(
      `> <@${discordUserId}> baru saja mengunggah **video/konten baru**!\n` +
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
  const hasVideoId = videoId && videoId !== 'null';
  const targetUrl = hasVideoId 
    ? `https://www.tiktok.com/@${tiktokUsername}/video/${videoId}`
    : `https://www.tiktok.com/@${tiktokUsername}`;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel(hasVideoId ? '📹 Tonton Video' : '👤 Buka Profil TikTok')
      .setStyle(ButtonStyle.Link)
      .setURL(targetUrl)
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

      if (isLive && !wasLive && settings.notify_live === 1) {
        const embed = buildLiveEmbed(account.user_id, account.tiktok_username, displayName);
        const row   = buildLiveButton(account.tiktok_username);
        await channel.send({ content: `@everyone 🔴 **@${account.tiktok_username} sedang LIVE!**`, embeds: [embed], components: [row] });
        updateAccountState(account.id, { isLive: 1, lastLiveAt: now, lastCheckedAt: now });
        console.log(`📱 [TikTok] Live notif dikirim: @${account.tiktok_username}`);
      } else if (!isLive && wasLive) {
        // Live selesai — update status
        updateAccountState(account.id, { isLive: 0, lastCheckedAt: now });
      }

      // ── Deteksi Video Baru (melalui video_count) ──
      const isNewVideo = profile.videoCount !== -1 &&
        account.video_count !== -1 &&
        profile.videoCount > account.video_count;

      if (isNewVideo && settings.notify_video === 1) {
        const embed = buildVideoEmbed(account.user_id, account.tiktok_username, displayName, latestVideoId);
        const row   = buildVideoButton(account.tiktok_username, latestVideoId);
        await channel.send({ content: `@everyone 📹 **@${account.tiktok_username} memposting video/konten baru!**`, embeds: [embed], components: [row] });
        console.log(`📱 [TikTok] Video/foto baru terdeteksi via count: @${account.tiktok_username} (Lama: ${account.video_count} -> Baru: ${profile.videoCount})`);
      }

      // Selalu update state terakhir (termasuk video_count baru & initial seed)
      updateAccountState(account.id, {
        lastVideoId: latestVideoId || account.last_video_id,
        isLive: isLive ? 1 : (wasLive ? 0 : account.is_live),
        videoCount: profile.videoCount !== -1 ? profile.videoCount : account.video_count,
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

// ─────────────────────────────────────────────────────────────────
// PANEL UI — EMBED & BUTTONS
// ─────────────────────────────────────────────────────────────────

/**
 * Membuat embed panel utama TikTok dengan daftar akun terdaftar.
 */
function buildPanelEmbed(guild) {
  const accounts = getAllActiveAccounts(guild.id);
  const now = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta'
  }).format(new Date());

  const embed = new EmbedBuilder()
    .setColor(0xFF0050)
    .setTitle('📱 TikTok Notification Center')
    .setDescription(
      '> Daftarkan akun **TikTok**mu agar komunitas dapat notifikasi\n' +
      '> otomatis saat kamu **🔴 LIVE** atau **📹 Upload Video** baru!\n\u200b'
    )
    .setThumbnail('https://upload.wikimedia.org/wikipedia/en/thumb/a/a9/TikTok_logo.svg/320px-TikTok_logo.svg.png')
    .setFooter({ text: `📱 Panel TikTok Kosan 1A  •  Update: ${now} WIB` });

  if (accounts.length === 0) {
    embed.addFields({
      name: '📭 Belum Ada Akun Terdaftar',
      value: '> Jadilah yang pertama daftar! Klik tombol **Daftar TikTok** di bawah.'
    });
  } else {
    const lines = accounts.map((a, i) => {
      const liveTag = a.is_live ? ' 🔴 **LIVE!**' : '';
      const name    = a.display_name || a.tiktok_username;
      return `\`${String(i + 1).padStart(2, '0')}\` <@${a.user_id}> — [@${a.tiktok_username}](https://www.tiktok.com/@${a.tiktok_username}) *(${name})*${liveTag}`;
    });

    // Discord field max 1024 chars — split jika perlu
    const chunks = [];
    let current  = '';
    for (const line of lines) {
      if ((current + '\n' + line).length > 1000) {
        chunks.push(current);
        current = line;
      } else {
        current = current ? current + '\n' + line : line;
      }
    }
    if (current) chunks.push(current);

    chunks.forEach((chunk, idx) => {
      embed.addFields({
        name: idx === 0 ? `👥 Akun TikTok Terdaftar (${accounts.length})` : '\u200b',
        value: chunk
      });
    });
  }

  embed.addFields({ name: '\u200b', value: '> **Gunakan tombol di bawah untuk mengelola akun TikTok kamu:**' });
  return embed;
}

/**
 * Membuat action row tombol panel.
 */
function buildPanelButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('tt_panel_register')
      .setLabel('Daftar TikTok')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('tt_panel_my')
      .setLabel('Akun Saya')
      .setEmoji('👤')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('tt_panel_delete')
      .setLabel('Hapus Akun')
      .setEmoji('🗑️')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('tt_panel_list')
      .setLabel('Semua Akun')
      .setEmoji('📋')
      .setStyle(ButtonStyle.Secondary),
  );
}

/**
 * Membuat modal untuk input username TikTok.
 */
function buildRegisterModal() {
  return new ModalBuilder()
    .setCustomId('tt_modal_register')
    .setTitle('📱 Daftarkan Akun TikTok')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('tt_input_username')
          .setLabel('Username TikTok (tanpa @)')
          .setPlaceholder('Contoh: joefany86')
          .setStyle(TextInputStyle.Short)
          .setMinLength(2)
          .setMaxLength(50)
          .setRequired(true)
      )
    );
}

/**
 * Membuat atau mengambil channel panel TikTok.
 */
async function autoCreatePanelChannel(guild) {
  try {
    const settings = getSettings(guild.id);
    if (settings?.panel_channel_id) {
      const existing = guild.channels.cache.get(settings.panel_channel_id);
      if (existing) return existing;
    }

    // Cari channel yang sudah ada
    let channel = guild.channels.cache.find(c =>
      c.name === '📱┃panel-tiktok' || c.name === 'panel-tiktok'
    );

    if (!channel) {
      // Cari kategori yang tepat
      const category = guild.channels.cache.find(c =>
        c.type === 4 && /info|pengumuman|announce|notif|sosial|social|media/i.test(c.name)
      );

      channel = await guild.channels.create({
        name: PANEL_CHANNEL_NAME,
        type: ChannelType.GuildText,
        parent: category?.id || null,
        topic: '📱 Daftarkan akun TikTokmu! Bot akan notif komunitas saat kamu Live atau upload video baru.',
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            allow: ['ViewChannel', 'ReadMessageHistory'],
            deny:  ['SendMessages']
          }
        ]
      });
      console.log(`📱 [TikTok] Panel channel '${channel.name}' dibuat di guild ${guild.name}`);
    }

    // Simpan ke settings
    upsertSettings(guild.id, { panel_channel_id: channel.id });
    return channel;
  } catch (err) {
    console.error(`❌ [TikTok] Gagal membuat panel channel:`, err.message);
    return null;
  }
}

/**
 * Post atau update panel UI di channel panel.
 * Jika panel sudah ada (berdasarkan panel_message_id), edit pesannya.
 * Jika belum ada, kirim pesan baru.
 */
async function postOrUpdatePanel(guild, channel) {
  try {
    const embed   = buildPanelEmbed(guild);
    const buttons = buildPanelButtons();
    const settings = getSettings(guild.id);

    // Coba edit pesan yang sudah ada
    if (settings?.panel_message_id) {
      try {
        const existingMsg = await channel.messages.fetch(settings.panel_message_id);
        if (existingMsg) {
          await existingMsg.edit({ embeds: [embed], components: [buttons] });
          return existingMsg;
        }
      } catch {
        // Pesan tidak ditemukan, buat baru
      }
    }

    // Kirim pesan baru
    const msg = await channel.send({ embeds: [embed], components: [buttons] });
    upsertSettings(guild.id, { panel_message_id: msg.id });
    return msg;
  } catch (err) {
    console.error(`❌ [TikTok] Gagal post/update panel:`, err.message);
    return null;
  }
}

/**
 * Refresh panel di semua guild (dipanggil setelah ada perubahan akun).
 */
async function refreshAllPanels(client) {
  for (const guild of client.guilds.cache.values()) {
    try {
      const settings = getSettings(guild.id);
      if (!settings?.panel_channel_id) continue;
      const channel = guild.channels.cache.get(settings.panel_channel_id);
      if (!channel) continue;
      await postOrUpdatePanel(guild, channel);
    } catch { /* skip */ }
  }
}

/**
 * Handler utama semua interaksi tombol & modal TikTok panel.
 * Dipanggil dari interactionCreate di index.js.
 */
async function handlePanelInteraction(interaction, client) {
  const { customId, guild, member, user } = interaction;
  const guildId = guild.id;

  // ── Tombol: Daftar TikTok → tampilkan modal ──
  if (customId === 'tt_panel_register') {
    return interaction.showModal(buildRegisterModal());
  }

  // ── Modal Submit: proses pendaftaran ──
  if (customId === 'tt_modal_register') {
    const rawUsername = interaction.fields.getTextInputValue('tt_input_username').replace(/^@/, '').trim();
    await interaction.deferReply({ flags: 64 });

    const profile = await fetchTikTokProfile(rawUsername);
    const displayName = profile?.displayName || rawUsername;

    upsertAccount(user.id, guildId, rawUsername, displayName);

    // Seed initial data agar notif tidak langsung trigger saat pertama daftar
    db.prepare('UPDATE tiktok_accounts SET last_video_id = ?, video_count = ? WHERE user_id = ? AND guild_id = ?')
      .run(profile?.latestVideoId || null, profile?.videoCount !== undefined ? profile.videoCount : -1, user.id, guildId);

    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0xFF0050)
        .setTitle('✅ Akun TikTok Berhasil Didaftarkan!')
        .setDescription(
          `Akun **@${rawUsername}** (${displayName}) sudah terdaftar.\n` +
          `Bot akan memantau **Live** & **Video Baru** kamu secara otomatis!`
        )
        .setFooter({ text: 'Gunakan tombol Hapus Akun untuk berhenti dipantau' })
        .setTimestamp()
      ]
    });

    // Refresh panel
    await refreshAllPanels(client);
    return;
  }

  // ── Tombol: Lihat Akun Saya ──
  if (customId === 'tt_panel_my') {
    const account = getAccount(user.id, guildId);
    if (!account) {
      return interaction.reply({
        content: '❌ Kamu belum mendaftarkan akun TikTok.\nKlik tombol **✅ Daftar TikTok** untuk mendaftar!',
        flags: 64
      });
    }
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xFF0050)
        .setTitle('📱 Akun TikTok Kamu')
        .addFields(
          { name: '👤 Username',    value: `[@${account.tiktok_username}](https://www.tiktok.com/@${account.tiktok_username})`, inline: true },
          { name: '🎥 Nama',        value: account.display_name || account.tiktok_username, inline: true },
          { name: '🔴 Status Live', value: account.is_live ? '🔴 **LIVE Sekarang!**' : '⚫ Tidak Live', inline: true },
          { name: '🕒 Terdaftar',   value: `<t:${account.created_at}:R>`, inline: true },
          { name: '🔍 Terakhir Dicek', value: account.last_checked_at ? `<t:${account.last_checked_at}:R>` : 'Belum pernah', inline: true }
        )
        .setTimestamp()
      ], flags: 64
    });
  }

  // ── Tombol: Hapus Akun ──
  if (customId === 'tt_panel_delete') {
    const result = deleteAccount(user.id, guildId);
    if (result.changes === 0) {
      return interaction.reply({
        content: '❌ Kamu belum memiliki akun TikTok yang terdaftar.',
        flags: 64
      });
    }
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0x6B7280)
        .setTitle('🗑️ Akun TikTok Dihapus')
        .setDescription('Akun TikTokmu berhasil dihapus dari sistem pemantauan bot.\nGunakan tombol **✅ Daftar TikTok** kapan saja untuk mendaftar kembali.')
        .setTimestamp()
      ], flags: 64
    });
    // Refresh panel
    await refreshAllPanels(client);
    return;
  }

  // ── Tombol: Lihat Semua Akun ──
  if (customId === 'tt_panel_list') {
    const accounts = getAllActiveAccounts(guildId);
    if (accounts.length === 0) {
      return interaction.reply({
        content: '📭 Belum ada member yang mendaftarkan akun TikTok di server ini.',
        flags: 64
      });
    }
    const lines = accounts.map((a, i) => {
      const liveTag = a.is_live ? ' 🔴 LIVE!' : '';
      return `\`${i + 1}\`. <@${a.user_id}> → [@${a.tiktok_username}](https://www.tiktok.com/@${a.tiktok_username})${liveTag}`;
    });
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xFF0050)
        .setTitle(`📋 Semua Akun TikTok Terdaftar (${accounts.length})`)
        .setDescription(lines.join('\n'))
        .setTimestamp()
      ], flags: 64
    });
  }
}

// ─── Re-export dengan fungsi panel ───
Object.assign(module.exports, {
  // Panel UI
  buildPanelEmbed,
  buildPanelButtons,
  buildRegisterModal,
  autoCreatePanelChannel,
  postOrUpdatePanel,
  refreshAllPanels,
  handlePanelInteraction
});

