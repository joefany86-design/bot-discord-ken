const { EmbedBuilder } = require('discord.js');
const config = require('./config');

/**
 * Mengambil 5 berita terbaru dari RSS Feed Antara News.
 * @returns {Promise<Array>} List berita dengan judul dan link.
 */
async function fetchLatestNews() {
  try {
    const res = await fetch('https://www.antaranews.com/rss/terkini.xml');
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const xml = await res.text();
    
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    
    while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
      const content = match[1];
      const titleMatch = content.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || content.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = content.match(/<link>([\s\S]*?)<\/link>/);
      
      if (titleMatch && linkMatch) {
        items.push({
          title: titleMatch[1].trim(),
          link: linkMatch[1].trim()
        });
      }
    }
    return items;
  } catch (error) {
    console.error('[News Helper] Gagal mengambil/memparse berita:', error.message);
    return [];
  }
}

/**
 * Membuat Discord Embed untuk Berita Terkini.
 * @param {Client} client - Instance dari Discord Client.
 * @param {Array} items - List berita.
 * @returns {EmbedBuilder} Embed berita.
 */
function generateNewsEmbed(client, items) {
  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('📰 Berita Terkini Hari Ini')
    .setDescription('Berikut adalah ringkasan berita terbaru untuk menemani aktivitas Anda hari ini:')
    .setFooter({ 
      text: `Informasi Berita • ${client.user?.username || 'Sentinel'}`, 
      iconURL: client.user?.displayAvatarURL() || null 
    })
    .setTimestamp();

  if (items.length === 0) {
    embed.setDescription('⚠️ Saat ini tidak ada berita terbaru yang dapat ditampilkan. Silakan coba beberapa saat lagi.');
  } else {
    items.forEach((item, index) => {
      embed.addFields({ name: `${index + 1}. ${item.title}`, value: `🔗 [Baca selengkapnya di sini](${item.link})` });
    });
  }

  return embed;
}

/**
 * Mengirimkan berita harian secara otomatis ke target channel yang terdaftar.
 * @param {Client} client - Instance dari Discord Client.
 */
async function sendDailyNews(client) {
  console.log('[News] Memulai pengiriman berita harian...');
  const items = await fetchLatestNews();
  if (items.length === 0) {
    console.error('[News] Gagal mengirim berita harian karena data kosong.');
    return;
  }

  const embed = generateNewsEmbed(client, items);
  const targets = config.targets || [];

  for (const target of targets) {
    if (!target.guildId || !target.channelId) continue;
    try {
      const guild = client.guilds.cache.get(target.guildId) || await client.guilds.fetch(target.guildId).catch(() => null);
      if (!guild) continue;
      
      const channel = guild.channels.cache.get(target.channelId) || await guild.channels.fetch(target.channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) continue;

      await channel.send({ content: '📢 **Kabar Hari Ini!**', embeds: [embed] });
      console.log(`[News] Berita harian berhasil dikirim ke #${channel.name} di server ${guild.name}`);
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
