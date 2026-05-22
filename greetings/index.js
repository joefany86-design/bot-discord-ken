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
  console.log(`  [Greetings] Target Guild ID: ${config.GREETING_GUILD_ID}`);
  console.log(`  [Greetings] Target Channel ID: ${config.GREETING_CHANNEL_ID}`);
  console.log('  [Greetings] Status: TERKUNCI KHUSUS CHANNEL DI ATAS');
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

  // Validasi ID Server dan ID Channel wajib terisi
  if (!config.GREETING_GUILD_ID || !config.GREETING_CHANNEL_ID) {
    console.error('[Greetings] Gagal: GREETING_GUILD_ID atau GREETING_CHANNEL_ID belum dikonfigurasi.');
    return;
  }

  try {
    // 1. Dapatkan Server (Guild) tujuan terlebih dahulu
    const guild = client.guilds.cache.get(config.GREETING_GUILD_ID) || await client.guilds.fetch(config.GREETING_GUILD_ID).catch(() => null);
    if (!guild) {
      console.error(`[Greetings] Gagal: Bot tidak berada di Server ID ${config.GREETING_GUILD_ID}.`);
      return;
    }

    // 2. Dapatkan Channel tujuan dari Server tersebut saja (mencegah salah channel di server lain)
    const channel = guild.channels.cache.get(config.GREETING_CHANNEL_ID) || await guild.channels.fetch(config.GREETING_CHANNEL_ID).catch(() => null);
    if (!channel) {
      console.error(`[Greetings] Gagal: Channel ID ${config.GREETING_CHANNEL_ID} tidak ditemukan di server ${guild.name}.`);
      return;
    }

    if (!channel.isTextBased()) {
      console.error(`[Greetings] Gagal: Channel #${channel.name} bukan channel teks.`);
      return;
    }

    // 3. Kirim pesan ke channel tersebut
    await channel.send({ embeds: [embed] });
    console.log(`[Greetings] Sapaan "${greeting.title}" berhasil dikirim ke #${channel.name} di server ${guild.name}`);
  } catch (error) {
    console.error(`[Greetings] Terjadi kesalahan saat mengirim sapaan:`, error.message);
  }
}

module.exports = {
  initGreetings
};
