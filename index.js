require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require('discord.js');

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

// Mapping Role ID
const MEMBER_ROLES = {
  BADDIES: '1472170290175021193',       // the baddies
  BROS: '1472170093416022096',          // the bros
  MOBILE_LEGENDS: '1490303477161656391',// Mobile Legends
  ROBLOX: '1490442107960299560',        // roblox
  MOLE_ROBLOX: '1490442266517700800'    // Mole dan Roblox
};

// ID Channel Khusus Ambil Role (Self-Role Channel)
const ROLE_CHANNEL_ID = '1472197966218395751';
// ID Channel Welcome/Greeting
const GREETING_CHANNEL_ID = process.env.GREETING_CHANNEL_ID || '1422642326798598348';

client.once('ready', async () => {
  console.log(`🤖 Bot berhasil login sebagai ${client.user.tag}!`);

  // 🗑️ ONE-TIME CLEANUP: Hapus seluruh Role Item/Garden/Weather/Crate/Tooling lama dari server Discord
  for (const guild of client.guilds.cache.values()) {
    console.log(`🧹 Memulai pembersihan role lama di server: ${guild.name}`);
    try {
      const roles = await guild.roles.fetch();
      
      // Keywords role yang akan dihapus dari Discord
      const keywordsToDelete = [
        'Grape', 'Coconut', 'Mango', 'Dragon Fruit', 'Acorn', 'Cherry', 
        'Sunflower', 'Venus Fly Trap', 'Pomegranate', 'Poison Apple', 
        'Venom Spitter', 'Moon Bloom', "Dragon's Breath", 'Tulip', 'Apple', 'Bamboo', 'Cactus', 'Pineapple', 'Mushroom', 'Green Bean', 'Banana',
        'Watering Can', 'Sprinkler', 'Trowel', 'Jump Mushroom', 'Speed Mushroom', 
        'Lantern', 'Shrink Mushroom', 'Supersize Mushroom', 'Gnome', 'Flashbang', 
        'Basic Pot', 'Strawberry Sniper', 'Invisibility Mushroom', 'Teleporter', 
        'Wheelbarrow', 'Crate', 'Aurora', 'Bloodmoon', 'Goldmoon', 'Lightning', 
        'Mega Moon', 'Rain', 'Rainbow', 'Snowfall', 'Starfall', 'Grow a Garden'
      ];

      for (const role of roles.values()) {
        // Jangan hapus role bot sendiri atau @everyone
        if (role.managed || role.id === guild.id) continue;

        const shouldDelete = keywordsToDelete.some(kw => role.name.toLowerCase().includes(kw.toLowerCase()));
        if (shouldDelete) {
          try {
            await role.delete('Pembersihan role item/garden lama yang tidak dipakai');
            console.log(`🗑️ Berhasil menghapus role Discord: ${role.name} (${role.id})`);
          } catch (e) {
            console.error(`⚠️ Gagal menghapus role ${role.name}:`, e.message);
          }
        }
      }
      console.log(`✨ Pembersihan role lama selesai di server ${guild.name}.`);
    } catch (err) {
      console.error(`❌ Gagal fetching role di server ${guild.name}:`, err.message);
    }
  }

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

  // 4. Kirim / Update Panel Self-Role Pilihan di Channel 1472197966218395751
  try {
    const roleChannel = await client.channels.fetch(ROLE_CHANNEL_ID).catch(() => null);
    if (roleChannel && roleChannel.isTextBased()) {
      const messages = await roleChannel.messages.fetch({ limit: 20 }).catch(() => null);
      const existingMenu = messages ? messages.find(m => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title && m.embeds[0].title.includes('PILIH ROLE WARGA')) : null;

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('🎭 PANEL PILIHAN ROLE WARGA BARU')
        .setDescription(
          'Selamat datang! Silakan pilih role yang sesuai dengan identitas dan minat game Anda melalui dropdown menu di bawah ini:\n\n' +
          '💖 **the baddies** — Role identitas komunitas\n' +
          '💙 **the bros** — Role identitas komunitas\n' +
          '⚔️ **Mobile Legends** — Gamer MLBB\n' +
          '🧱 **Roblox** — Gamer Roblox\n' +
          '🎮 **Mole dan Roblox** — Gamer MLBB & Roblox\n\n' +
          '*Anda dapat memilih satu atau beberapa role sekaligus!*'
        )
        .setFooter({ text: 'Klik pilihan untuk menambah/menghapus role Anda secara mandiri.' });

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_member_roles')
        .setPlaceholder('👉 Pilih Role Anda di sini...')
        .setMinValues(0)
        .setMaxValues(5)
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel('the baddies')
            .setValue(MEMBER_ROLES.BADDIES)
            .setDescription('Role identitas the baddies')
            .setEmoji('💖'),
          new StringSelectMenuOptionBuilder()
            .setLabel('the bros')
            .setValue(MEMBER_ROLES.BROS)
            .setDescription('Role identitas the bros')
            .setEmoji('💙'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Mobile Legends')
            .setValue(MEMBER_ROLES.MOBILE_LEGENDS)
            .setDescription('Komunitas gamer Mobile Legends')
            .setEmoji('⚔️'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Roblox')
            .setValue(MEMBER_ROLES.ROBLOX)
            .setDescription('Komunitas gamer Roblox')
            .setEmoji('🧱'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Mole dan Roblox')
            .setValue(MEMBER_ROLES.MOLE_ROBLOX)
            .setDescription('Komunitas gamer Mobile Legends & Roblox')
            .setEmoji('🎮')
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      if (existingMenu) {
        await existingMenu.edit({ embeds: [embed], components: [row] });
        console.log(`✅ Panel Pilihan Role Warga berhasil di-update di channel <#${ROLE_CHANNEL_ID}>.`);
      } else {
        await roleChannel.send({ embeds: [embed], components: [row] });
        console.log(`✅ Panel Pilihan Role Warga berhasil dikirim ke channel <#${ROLE_CHANNEL_ID}>.`);
      }
    }
  } catch (err) {
    console.error('❌ Gagal mengirim panel pilihan role:', err.message);
  }
});

// Event Listener: Menyambut Member Baru & Mengarahkan ke Channel 1472197966218395751
client.on('guildMemberAdd', async (member) => {
  try {
    console.log(`👋 Member baru bergabung: ${member.user.tag} (${member.id})`);
    const welcomeChan = await member.guild.channels.fetch(GREETING_CHANNEL_ID).catch(() => null);
    if (welcomeChan && welcomeChan.isTextBased()) {
      await welcomeChan.send({
        content: `👋 Selamat datang <@${member.id}> di **${member.guild.name}**! Silakan ambil role Anda di channel <#${ROLE_CHANNEL_ID}> ✨`
      }).catch(() => {});
    }
  } catch (err) {
    console.error('❌ Error pada event guildMemberAdd:', err.message);
  }
});

// Event Listener: Interaksi Select Menu Pilihan Role Mandiri
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;

  if (interaction.customId === 'select_member_roles') {
    await interaction.deferReply({ ephemeral: true });
    const member = interaction.member;
    const selectedRoleIds = interaction.values;
    const allRoleIds = Object.values(MEMBER_ROLES);

    try {
      // Role yang dipilih diset, role lain di list dihapus jika tidak dipilih lagi
      for (const roleId of allRoleIds) {
        if (selectedRoleIds.includes(roleId)) {
          if (!member.roles.cache.has(roleId)) {
            await member.roles.add(roleId).catch(() => {});
          }
        } else {
          if (member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId).catch(() => {});
          }
        }
      }

      await interaction.editReply({
        content: '✅ **Role Anda berhasil diperbarui!** Terima kasih sudah memilih role.'
      });
    } catch (err) {
      console.error('❌ Gagal memperbarui role member:', err.message);
      await interaction.editReply({
        content: '❌ Gagal memperbarui role. Pastikan posisi role bot berada di atas role yang ingin diberikan.'
      });
    }
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
