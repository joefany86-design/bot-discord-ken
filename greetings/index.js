const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const config = require('./config');

/**
 * Menginisialisasi semua jadwal sapaan otomatis menggunakan node-cron.
 * @param {Client} client - Instance dari Discord Client.
 */
function initGreetings(client) {
  console.log('══════════════════════════════════════');
  console.log('  [Greetings] Menginisialisasi sapaan otomatis...');
  const targets = config.targets || [];
  console.log(`  [Greetings] Terdaftar ${targets.length} target server/channel`);
  console.log('  [Greetings] Status: AKTIF MULTI-CHANNEL');
  console.log('══════════════════════════════════════');

  config.greetings.forEach(greeting => {
    cron.schedule(greeting.cron, () => {
      sendGreeting(client, greeting);
    }, {
      scheduled: true,
      timezone: config.TIMEZONE
    });

    console.log(`  ✅ Jadwal sapaan "${greeting.title}" terdaftar (${greeting.cron} WIB)`);
  });
}

/**
 * Mengirimkan sapaan ke channel Discord yang dituju.
 * @param {Client} client - Instance dari Discord Client.
 * @param {Object} greeting - Objek data sapaan.
 */
async function sendGreeting(client, greeting) {
  const embed = new EmbedBuilder()
    .setColor(greeting.color)
    .setTitle(greeting.title)
    .setDescription(greeting.message)
    .setFooter({ text: `${greeting.image} Sapaan otomatis dari Bot` })
    .setTimestamp();

  const targets = config.targets || [];
  if (targets.length === 0) {
    console.error('[Greetings] Gagal: Tidak ada target server/channel yang dikonfigurasi.');
    return;
  }

  for (const target of targets) {
    if (!target.guildId || !target.channelId) {
      console.error('[Greetings] Gagal: guildId atau channelId kosong untuk salah satu target.');
      continue;
    }

    try {
      // 1. Dapatkan Server (Guild) tujuan terlebih dahulu
      const guild = client.guilds.cache.get(target.guildId) || await client.guilds.fetch(target.guildId).catch(() => null);
      if (!guild) {
        console.error(`[Greetings] Gagal: Bot tidak berada di Server ID ${target.guildId}.`);
        continue;
      }

      // 2. Dapatkan Channel tujuan dari Server tersebut saja
      const channel = guild.channels.cache.get(target.channelId) || await guild.channels.fetch(target.channelId).catch(() => null);
      if (!channel) {
        console.error(`[Greetings] Gagal: Channel ID ${target.channelId} tidak ditemukan di server ${guild.name}.`);
        continue;
      }

      if (!channel.isTextBased()) {
        console.error(`[Greetings] Gagal: Channel #${channel.name} bukan channel teks.`);
        continue;
      }

      // 3. Kirim pesan ke channel tersebut dengan mention seluruh member (@everyone)
      await channel.send({ content: '@everyone', embeds: [embed] });
      console.log(`[Greetings] Sapaan "${greeting.title}" berhasil dikirim ke #${channel.name} di server ${guild.name}`);
    } catch (error) {
      console.error(`[Greetings] Terjadi kesalahan saat mengirim sapaan ke guild ${target.guildId}:`, error.message);
    }
  }
}

module.exports = {
  initGreetings
};
