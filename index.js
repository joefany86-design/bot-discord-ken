require('dotenv').config();
const { Client, GatewayIntentBits, Partials, PermissionFlagsBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction]
});

client.once('ready', async () => {
  console.log(`🤖 Bot berhasil login sebagai ${client.user.tag}!`);

  // Setting Permission Channel 1422642326798598348:
  // Hanya bisa kirim pesan teks, TIDAK bisa lampirkan file (AttachFiles) & TIDAK bisa kirim link/embed (EmbedLinks)
  const targetChannelId = '1422642326798598348';

  try {
    const channel = await client.channels.fetch(targetChannelId).catch(() => null);
    if (channel) {
      // Set permission overwrite untuk role @everyone di channel ini
      await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
        [PermissionFlagsBits.SendMessages]: true,     // Boleh kirim chat teks
        [PermissionFlagsBits.AttachFiles]: false,    // TIDAK boleh kirim foto / file / lampiran
        [PermissionFlagsBits.EmbedLinks]: false,     // TIDAK boleh kirim link dengan preview embed
      });
      console.log(`✅ Permisi channel #${channel.name} (${targetChannelId}) berhasil diperbarui! (Chat: Aktif, Foto/Lampiran: Nonaktif)`);
    } else {
      console.log(`⚠️ Channel ${targetChannelId} tidak ditemukan.`);
    }
  } catch (err) {
    console.error(`❌ Gagal memperbarui permisi channel ${targetChannelId}:`, err.message);
  }
});

client.login(process.env.DISCORD_TOKEN);
