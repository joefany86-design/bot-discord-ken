const { EmbedBuilder } = require('discord.js');
const config = require('./config');

// Ikon sumber berita
const SOURCE_ICONS = {
  'antara': '🟢',
  'detik': '🔵',
  'kompas': '🔴',
  'cnbc': '🟡',
  'kumparan': '🟣',
  'tribun': '🟠',
};

function getSourceIcon(title) {
  const t = title.toLowerCase();
  if (t.includes('antara')) return SOURCE_ICONS.antara;
  if (t.includes('detik')) return SOURCE_ICONS.detik;
  if (t.includes('kompas')) return SOURCE_ICONS.kompas;
  if (t.includes('cnbc')) return SOURCE_ICONS.cnbc;
  if (t.includes('kumparan')) return SOURCE_ICONS.kumparan;
  if (t.includes('tribun')) return SOURCE_ICONS.tribun;
  return '📰';
}

function cleanTitle(raw) {
  return raw
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function extractDate(content) {
  const pubMatch = content.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
  if (!pubMatch) return null;
  try {
    return new Date(pubMatch[1].trim());
  } catch {
    return null;
  }
}

function extractSource(content) {
  // Google News format: "Judul Artikel - Nama Media"
  const srcMatch = content.match(/<source url="[^"]*">([^<]+)<\/source>/);
  if (srcMatch) return srcMatch[1].trim();
  return null;
}

/**
 * Mengambil berita terkini dari multiple RSS feed dan menggabungkannya.
 * Diurutkan berdasarkan waktu terbaru.
 */
async function fetchLatestNews() {
  const feeds = [
    { url: 'https://www.antaranews.com/rss/terkini.xml', name: 'Antara News' },
    { url: 'https://rss.detik.com/index.php/detikcom_terbaru', name: 'Detik.com' },
    { url: 'https://news.google.com/rss/search?q=berita+terkini+indonesia&hl=id&gl=ID&ceid=ID:id', name: 'Google News' },
  ];

  const allItems = [];

  for (const feed of feeds) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(feed.url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) continue;
      const xml = await res.text();

      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      let count = 0;

      while ((match = itemRegex.exec(xml)) !== null && count < 10) {
        const content = match[1];
        const titleMatch = content.match(/<title>([\s\S]*?)<\/title>/);
        const linkMatch  = content.match(/<link>([\s\S]*?)<\/link>/);
        if (!titleMatch || !linkMatch) continue;

        const title = cleanTitle(titleMatch[1]);
        const link  = linkMatch[1].trim();
        const pubDate = extractDate(content);
        const source = extractSource(content) || feed.name;

        // Hindari duplikat berdasarkan judul
        if (!allItems.some(i => i.title === title)) {
          allItems.push({ title, link, pubDate, source });
        }
        count++;
      }
    } catch (err) {
      console.error(`[News] Gagal ambil feed ${feed.name}:`, err.message);
    }
  }

  // Urutkan dari yang paling baru
  allItems.sort((a, b) => {
    if (!a.pubDate && !b.pubDate) return 0;
    if (!a.pubDate) return 1;
    if (!b.pubDate) return -1;
    return b.pubDate - a.pubDate;
  });

  return allItems.slice(0, 5);
}

/**
 * Membuat Discord Embed premium untuk Berita Terkini.
 */
function generateNewsEmbed(client, items) {
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Asia/Jakarta'
  }).format(now);

  const embed = new EmbedBuilder()
    .setColor(0x1A56DB) // Biru profesional
    .setTitle('📰 Berita Terkini Indonesia')
    .setDescription(
      `> 🗓️ **${dateStr}**\n` +
      `> Berikut headline berita paling baru yang terkini dari berbagai sumber terpercaya.\n\u200b`
    )
    .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/2/24/ANTARA_News.svg')
    .setFooter({
      text: `📡 Sumber: Antara News • Detik.com • Google News  |  ${client.user?.username || 'Sentinel'}`,
      iconURL: client.user?.displayAvatarURL() || null
    })
    .setTimestamp();

  if (items.length === 0) {
    embed.addFields({
      name: '⚠️ Tidak Ada Berita',
      value: 'Saat ini berita tidak tersedia. Silakan gunakan `/berita` beberapa saat lagi.'
    });
  } else {
    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    items.forEach((item, index) => {
      const icon = getSourceIcon(item.source || '');
      const timeStr = item.pubDate
        ? new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }).format(item.pubDate)
        : null;
      const sourceLine = `${icon} *${item.source || 'Berita'}*${timeStr ? ` • \`${timeStr} WIB\`` : ''}`;

      embed.addFields({
        name: `${medals[index]} ${item.title.length > 80 ? item.title.slice(0, 77) + '...' : item.title}`,
        value: `${sourceLine}\n> [🔗 Baca Selengkapnya](${item.link})`
      });
    });
  }

  return embed;
}

/**
 * Mengirimkan berita harian secara otomatis ke target channel yang terdaftar.
 */
async function sendDailyNews(client) {
  console.log('[News] Memulai pengiriman berita harian...');
  const items = await fetchLatestNews();
  if (items.length === 0) {
    console.error('[News] Gagal mengirim berita harian karena data kosong.');
    return;
  }

  const newsEmbed = generateNewsEmbed(client, items);

  let jobsEmbed = null;
  try {
    const { fetchLatestJobs, generateJobsEmbed } = require('./loker');
    const jobItems = await fetchLatestJobs();
    if (jobItems.length > 0) {
      jobsEmbed = generateJobsEmbed(client, jobItems);
    }
  } catch (jobErr) {
    console.error('[News] Gagal mengambil info loker untuk berita harian:', jobErr.message);
  }

  const targets = config.targets || [];

  for (const target of targets) {
    if (!target.guildId || !target.channelId) continue;
    try {
      const guild = client.guilds.cache.get(target.guildId) || await client.guilds.fetch(target.guildId).catch(() => null);
      if (!guild) continue;

      const channel = guild.channels.cache.get(target.channelId) || await guild.channels.fetch(target.channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) continue;

      const embedsToSend = [newsEmbed];
      if (jobsEmbed) embedsToSend.push(jobsEmbed);

      await channel.send({ content: '📢 **Kabar & Info Lowongan Kerja Hari Ini!**', embeds: embedsToSend });
      console.log(`[News] Berita & Loker harian berhasil dikirim ke #${channel.name} di server ${guild.name}`);
    } catch (error) {
      console.error(`[News] Gagal mengirim berita ke guild ${target.guildId}:`, error.message);
    }
  }
}

module.exports = {
  fetchLatestNews,
  generateNewsEmbed,
  sendDailyNews
};
