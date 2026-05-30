const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const embeds = require('../stockmarket/embeds');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  const channelId = '1478566460124041428';
  const channel = await client.channels.fetch(channelId).catch(err => {
    console.error("Gagal mengambil channel:", err.message);
    process.exit(1);
  });
  
  if (!channel) {
    console.error("Channel tidak ditemukan.");
    process.exit(1);
  }
  
  console.log(`Channel ditemukan: #${channel.name}`);
  
  // 1. Purge/Hapus semua chat di channel
  console.log("Memulai pembersihan (purging) channel...");
  let fetched;
  let totalDeleted = 0;
  do {
    fetched = await channel.messages.fetch({ limit: 100 });
    if (fetched.size > 0) {
      console.log(`Mengambil ${fetched.size} pesan untuk dihapus...`);
      // Coba bulk delete terlebih dahulu
      try {
        await channel.bulkDelete(fetched);
        console.log("Bulk delete sukses.");
        totalDeleted += fetched.size;
      } catch (err) {
        console.log("Bulk delete gagal (mungkin ada pesan >14 hari), menghapus satu-persatu...");
        for (const msg of fetched.values()) {
          await msg.delete().catch(e => console.error("Gagal hapus pesan:", e.message));
          totalDeleted++;
          await new Promise(r => setTimeout(r, 800)); // anti rate limit
        }
      }
    }
  } while (fetched.size > 0);
  
  console.log(`✅ Channel bersih! Total pesan dihapus: ${totalDeleted}`);
  
  // 2. Kirim Penjelasan Fitur & Panduan Profesional
  console.log("Mengirim panduan fitur...");
  
  const guild = channel.guild;
  const announcementEmbeds = embeds.updateAnnouncementEmbeds(guild);
  
  // Kirim Pesan 1
  await channel.send({
    content: '📢 **PENGUMUMAN RESMI — ENSIKLOPEDIA LENGKAP FITUR & PANDUAN SENTINEL BOT 2026!** @everyone\n\n🏠 *Gunakan ensiklopedia ini sebagai panduan lengkap bermain dan bertransaksi secara profesional di server ini. Seluruh fitur dijelaskan secara rinci di bawah ini:*',
    embeds: [announcementEmbeds[0], announcementEmbeds[1]],
    allowedMentions: { parse: ['everyone'] }
  });
  
  // Kirim Pesan 2
  await channel.send({
    embeds: [announcementEmbeds[2], announcementEmbeds[3]]
  });
  
  // Kirim Pesan 3
  await channel.send({
    embeds: [announcementEmbeds[4], announcementEmbeds[5]]
  });
  
  console.log("✅ Panduan berhasil diposting!");
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error("Gagal login:", err.message);
  process.exit(1);
});
