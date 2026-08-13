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

  // Log seluruh Guild (Server) & Role yang ada
  console.log('\n=================== DAFTAR SERVER & ROLE ===================');
  for (const guild of client.guilds.cache.values()) {
    console.log(`\n🏰 Guild/Server: ${guild.name} (ID: ${guild.id})`);
    try {
      const roles = await guild.roles.fetch();
      const sortedRoles = [...roles.values()].sort((a, b) => b.position - a.position);
      
      console.log(`📋 Total Role: ${sortedRoles.length}`);
      sortedRoles.forEach(role => {
        console.log(`   - ID: ${role.id.padEnd(20)} | Name: ${role.name.padEnd(30)} | Color: ${role.hexColor} | Pos: ${role.position}`);
      });
    } catch (err) {
      console.error(`❌ Gagal mengambil role untuk guild ${guild.name}:`, err.message);
    }
  }
  console.log('============================================================\n');

  // 1. Channel 1422642326798598348: HANYA CHAT TEKS (Matikan foto & link)
  try {
    const textOnlyChan = await client.channels.fetch('1422642326798598348').catch(() => null);
    if (textOnlyChan) {
      await textOnlyChan.permissionOverwrites.edit(textOnlyChan.guild.roles.everyone, {
        [PermissionFlagsBits.SendMessages]: true,
        [PermissionFlagsBits.AttachFiles]: false,
        [PermissionFlagsBits.EmbedLinks]: false,
      });
      console.log(`✅ Channel #${textOnlyChan.name} (1422642326798598348): Permisi diatur ke CHAT ONLY.`);
    }
  } catch (err) {
    console.error('❌ Gagal mengatur channel 1422642326798598348:', err.message);
  }

  // 2. Channel 1472428770710261952: CHAT + KIRIM FOTO / LAMPIRAN
  try {
    const chatAndPhotoChan = await client.channels.fetch('1472428770710261952').catch(() => null);
    if (chatAndPhotoChan) {
      await chatAndPhotoChan.permissionOverwrites.edit(chatAndPhotoChan.guild.roles.everyone, {
        [PermissionFlagsBits.SendMessages]: true,
        [PermissionFlagsBits.AttachFiles]: true,
        [PermissionFlagsBits.EmbedLinks]: true,
      });
      console.log(`✅ Channel #${chatAndPhotoChan.name} (1472428770710261952): Permisi diatur ke CHAT & FOTO.`);
    }
  } catch (err) {
    console.error('❌ Gagal mengatur channel 1472428770710261952:', err.message);
  }

  // 3. Channel 1422656689710305381: HANYA FOTO (Boleh AttachFiles & SendMessages, tapi bot auto-delete pesan tanpa foto)
  try {
    const photoOnlyChan = await client.channels.fetch('1422656689710305381').catch(() => null);
    if (photoOnlyChan) {
      await photoOnlyChan.permissionOverwrites.edit(photoOnlyChan.guild.roles.everyone, {
        [PermissionFlagsBits.SendMessages]: true,
        [PermissionFlagsBits.AttachFiles]: true,
        [PermissionFlagsBits.EmbedLinks]: true,
      });
      console.log(`✅ Channel #${photoOnlyChan.name} (1422656689710305381): Permisi diatur ke HANYA FOTO.`);
    }
  } catch (err) {
    console.error('❌ Gagal mengatur channel 1422656689710305381:', err.message);
  }
});

// Event listener: Hapus pesan otomatis di channel 1422656689710305381 jika tidak melampirkan foto/file
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.channelId === '1422656689710305381') {
    const hasAttachment = message.attachments.size > 0;
    if (!hasAttachment) {
      try {
        await message.delete();
        const warnMsg = await message.channel.send(`⚠️ <@${message.author.id}>, channel ini khusus untuk mengirim foto/gambar saja! Pesan teks tanpa foto akan dihapus otomatis.`);
        setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
      } catch (err) {
        console.error('❌ Gagal menghapus pesan tanpa foto:', err.message);
      }
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
