const { EmbedBuilder } = require('discord.js');
const config = require('./config');

/**
 * Mengambil 5 lowongan kerja terbaru dari RSS Feed Google News.
 * @returns {Promise<Array>} List lowongan kerja dengan judul dan link.
 */
async function fetchLatestJobs() {
  try {
    const res = await fetch('https://news.google.com/rss/search?q=lowongan+kerja+indonesia&hl=id&gl=ID&ceid=ID:id');
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const xml = await res.text();
    
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    
    while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
      const content = match[1];
      const titleMatch = content.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = content.match(/<link>([\s\S]*?)<\/link>/);
      
      if (titleMatch && linkMatch) {
        items.push({
          title: titleMatch[1].replace(/&amp;/g, '&').replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
          link: linkMatch[1].trim()
        });
      }
    }
    return items;
  } catch (error) {
    console.error('[Jobs Helper] Gagal mengambil/memparse info loker:', error.message);
    return [];
  }
}

/**
 * Membuat Discord Embed untuk Lowongan Kerja Terbaru.
 * @param {Client} client - Instance dari Discord Client.
 * @param {Array} items - List lowongan kerja.
 * @returns {EmbedBuilder} Embed lowongan kerja.
 */
function generateJobsEmbed(client, items) {
  const embed = new EmbedBuilder()
    .setColor(0x00FF87)
    .setTitle('💼 Info Lowongan Kerja Terbaru')
    .setDescription('Berikut adalah daftar informasi lowongan pekerjaan terbaru yang dihimpun hari ini:')
    .setFooter({ 
      text: `Informasi Loker • ${client.user?.username || 'Sentinel'}`, 
      iconURL: client.user?.displayAvatarURL() || null 
    })
    .setTimestamp();

  if (items.length === 0) {
    embed.setDescription('⚠️ Saat ini tidak ada info lowongan kerja terbaru yang dapat ditampilkan. Silakan coba beberapa saat lagi.');
  } else {
    items.forEach((item, index) => {
      embed.addFields({ name: `${index + 1}. ${item.title}`, value: `🔗 [Detail Lowongan & Apply](${item.link})` });
    });
  }

  return embed;
}

module.exports = {
  fetchLatestJobs,
  generateJobsEmbed
};
