const { EmbedBuilder } = require('discord.js');
const config = require('./config');

// Kata kunci yang menyaring hasil bukan loker asli
const BLACKLIST_KEYWORDS = [
  'hoaks', 'hoax', 'penipuan', 'palsu', '[hoaks]', '[penipuan]', 'turnbackhoax',
  'jala hoaks', 'dampak mbg', 'ciptakan', 'purbaya', 'ungkap', 'prakiraan',
  'banjir', 'hujan', 'gempa', 'demo', 'pilkada', 'korupsi', 'kriminal'
];

// Kata kunci yang harus ada agar dianggap loker asli
const LOKER_KEYWORDS = [
  'lowongan', 'rekrutmen', 'karir', 'career', 'hiring', 'open recruitment',
  'dibuka', 'dibutuhkan', 'staff', 'karyawan', 'fresh graduate', 'magang'
];

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
  try { return new Date(pubMatch[1].trim()); } catch { return null; }
}

function extractSource(content) {
  const srcMatch = content.match(/<source url="[^"]*">([^<]+)<\/source>/);
  return srcMatch ? srcMatch[1].trim() : null;
}

function isValidLoker(title) {
  const lower = title.toLowerCase();
  const isBlacklisted = BLACKLIST_KEYWORDS.some(k => lower.includes(k));
  if (isBlacklisted) return false;
  const hasLokerKeyword = LOKER_KEYWORDS.some(k => lower.includes(k));
  return hasLokerKeyword;
}

// Ekstrak nama perusahaan dari judul
function extractCompanyHint(title) {
  // Coba cocokkan pola "Lowongan Kerja PT XXX" atau "Rekrutmen XXX"
  const ptMatch = title.match(/(?:PT|CV|BUMN|Bank|Perusahaan|Rekrutmen|Lowongan Kerja)\s+([A-Z][a-zA-Z\s]+?)(?:\s+-|\s+Tahun|\s+Bulan|,|\.)/);
  if (ptMatch) return ptMatch[1].trim();
  return null;
}

/**
 * Mengambil lowongan kerja terbaru dari multiple sumber RSS yang relevan,
 * memfilter konten yang tidak relevan (hoaks, berita biasa, dsb).
 */
async function fetchLatestJobs() {
  const feeds = [
    // Google News dengan keyword spesifik loker asli
    { url: 'https://news.google.com/rss/search?q=lowongan+kerja+2026+rekrutmen+resmi&hl=id&gl=ID&ceid=ID:id', name: 'Google News' },
    { url: 'https://news.google.com/rss/search?q=loker+2026+PT+BUMN+hiring&hl=id&gl=ID&ceid=ID:id', name: 'Google News' },
    { url: 'https://news.google.com/rss/search?q="open+recruitment"+2026+Indonesia&hl=id&gl=ID&ceid=ID:id', name: 'Google News' },
  ];

  const allItems = [];

  for (const feed of feeds) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(feed.url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) continue;
      const xml = await res.text();

      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;

      while ((match = itemRegex.exec(xml)) !== null) {
        const content = match[1];
        const titleMatch = content.match(/<title>([\s\S]*?)<\/title>/);
        const linkMatch  = content.match(/<link>([\s\S]*?)<\/link>/);
        if (!titleMatch || !linkMatch) continue;

        const title = cleanTitle(titleMatch[1]);
        const link  = linkMatch[1].trim();
        const pubDate = extractDate(content);
        const source = extractSource(content) || feed.name;

        // Filter validasi
        if (!isValidLoker(title)) continue;

        // Hindari duplikat
        if (allItems.some(i => i.title === title)) continue;

        allItems.push({ title, link, pubDate, source });
      }
    } catch (err) {
      console.error(`[Jobs] Gagal ambil feed:`, err.message);
    }
  }

  // Urutkan dari terbaru
  allItems.sort((a, b) => {
    if (!a.pubDate && !b.pubDate) return 0;
    if (!a.pubDate) return 1;
    if (!b.pubDate) return -1;
    return b.pubDate - a.pubDate;
  });

  return allItems.slice(0, 5);
}

/**
 * Membuat Discord Embed premium untuk Lowongan Kerja Terbaru.
 */
function generateJobsEmbed(client, items) {
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Asia/Jakarta'
  }).format(now);

  const embed = new EmbedBuilder()
    .setColor(0x059669) // Hijau teal profesional
    .setTitle('💼 Lowongan Kerja Terbaru')
    .setDescription(
      `> 🗓️ **${dateStr}**\n` +
      `> Daftar lowongan kerja terbaru yang terverifikasi dari sumber terpercaya.\n` +
      `> ⚠️ *Selalu verifikasi melalui website resmi perusahaan sebelum melamar.*\n\u200b`
    )
    .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Briefcase.svg/240px-Briefcase.svg.png')
    .setFooter({
      text: `💼 Sumber: Google News  |  ${client.user?.username || 'Sentinel'}`,
      iconURL: client.user?.displayAvatarURL() || null
    })
    .setTimestamp();

  if (items.length === 0) {
    embed.addFields({
      name: '⚠️ Tidak Ada Loker Terbaru',
      value: 'Tidak ada lowongan kerja relevan yang ditemukan hari ini. Coba lagi nanti dengan `/loker`.'
    });
  } else {
    const numbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
    items.forEach((item, index) => {
      const timeStr = item.pubDate
        ? new Intl.DateTimeFormat('id-ID', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
            hour12: false, timeZone: 'Asia/Jakarta'
          }).format(item.pubDate) + ' WIB'
        : null;

      const sourceLine = `📌 *${item.source}*${timeStr ? ` • \`${timeStr}\`` : ''}`;

      embed.addFields({
        name: `${numbers[index]} ${item.title.length > 80 ? item.title.slice(0, 77) + '...' : item.title}`,
        value: `${sourceLine}\n> [🔗 Detail Lowongan & Daftar](${item.link})`
      });
    });
  }

  return embed;
}

module.exports = {
  fetchLatestJobs,
  generateJobsEmbed
};
