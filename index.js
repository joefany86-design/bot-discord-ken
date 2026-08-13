require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder
} = require('discord.js');
const { generateIdCard } = require('./idCardGenerator');

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

// Mapping Role ID Warga Baru
const MEMBER_ROLES = {
  BADDIES: '1472170290175021193',       // the baddies
  BROS: '1472170093416022096',          // the bros
  MOBILE_LEGENDS: '1490303477161656391',// Mobile Legends
  ROBLOX: '1490442107960299560',        // roblox
  MOLE_ROBLOX: '1490442266517700800'    // Mole dan Roblox
};

// Mapping Role Senior / Veteran Member
const SENIOR_ROLES = {
  PRESTIGE: '1509202467563241613',  // 🥉 Common Prestige
  ELITE: '1509202469828165904',     // 🥈 Rare Elite
  CHAMPION: '1509202471803813990',  // 🥇 Epic Champion
  OVERLORD: '1509202474416865482',  // 👑 Legendary Overlord
  IMMORTAL: '1509203784230768860',  // 🌟 Mythic Immortal
  SOVEREIGN: '1508835510087581696', // 👑 The Sovereign
  AETHELGARD: '1508835994630230106',// ✨ Aethelgard
  PRIMORDIAL: '1508836141019955301',// 🔮 Primordial
  ZENITH: '1508836447229050980'     // 🌟 Zenith
};

// ID Channel Khusus Ambil Role (Self-Role Channel)
const ROLE_CHANNEL_ID = '1472197966218395751';
// ID Channel Perkenalan Warga / Intro Channel
const INTRO_CHANNEL_ID = '1472883318386065426';
// ID Channel Welcome/Greeting
const GREETING_CHANNEL_ID = process.env.GREETING_CHANNEL_ID || '1422642326798598348';

client.once('ready', async () => {
  console.log(`🤖 Bot berhasil login sebagai ${client.user.tag}!`);

  // 1. Channel 1422642326798598348: CHAT TEKS ONLY (Kecuali Role Senior BISA kirim foto & link)
  try {
    const textOnlyChan = await client.channels.fetch('1422642326798598348').catch(() => null);
    if (textOnlyChan) {
      await textOnlyChan.permissionOverwrites.edit(textOnlyChan.guild.roles.everyone, {
        [PermissionFlagsBits.SendMessages]: true,
        [PermissionFlagsBits.AttachFiles]: false,
        [PermissionFlagsBits.EmbedLinks]: false,
      });

      for (const [roleName, roleId] of Object.entries(SENIOR_ROLES)) {
        try {
          await textOnlyChan.permissionOverwrites.edit(roleId, {
            [PermissionFlagsBits.SendMessages]: true,
            [PermissionFlagsBits.AttachFiles]: true,
            [PermissionFlagsBits.EmbedLinks]: true,
            [PermissionFlagsBits.UseExternalEmojis]: true,
            [PermissionFlagsBits.UseExternalStickers]: true,
          });
        } catch (e) {}
      }
      console.log(`✅ Channel #${textOnlyChan.name} (1422642326798598348): Permisi diatur.`);
    }
  } catch (err) {
    console.error('❌ Gagal mengatur channel 1422642326798598348:', err.message);
  }

  // 2. Channel 1472428770710261952: CHAT + KIRIM FOTO / LAMPIRAN UNTUK SEMUA
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

  // 3. Channel 1422656689710305381: HANYA FOTO
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

  // 4. Panel Self-Role (Pencegahan Duplikasi)
  try {
    const roleChannel = await client.channels.fetch(ROLE_CHANNEL_ID).catch(() => null);
    if (roleChannel && roleChannel.isTextBased()) {
      const messages = await roleChannel.messages.fetch({ limit: 50 }).catch(() => null);
      const botMessages = messages ? [...messages.filter(m => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title && m.embeds[0].title.includes('PILIH ROLE WARGA')).values()] : [];

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
          new StringSelectMenuOptionBuilder().setLabel('the baddies').setValue(MEMBER_ROLES.BADDIES).setDescription('Role identitas the baddies').setEmoji('💖'),
          new StringSelectMenuOptionBuilder().setLabel('the bros').setValue(MEMBER_ROLES.BROS).setDescription('Role identitas the bros').setEmoji('💙'),
          new StringSelectMenuOptionBuilder().setLabel('Mobile Legends').setValue(MEMBER_ROLES.MOBILE_LEGENDS).setDescription('Komunitas gamer Mobile Legends').setEmoji('⚔️'),
          new StringSelectMenuOptionBuilder().setLabel('Roblox').setValue(MEMBER_ROLES.ROBLOX).setDescription('Komunitas gamer Roblox').setEmoji('🧱'),
          new StringSelectMenuOptionBuilder().setLabel('Mole dan Roblox').setValue(MEMBER_ROLES.MOLE_ROBLOX).setDescription('Komunitas gamer Mobile Legends & Roblox').setEmoji('🎮')
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      if (botMessages.length > 0) {
        await botMessages[0].edit({ embeds: [embed], components: [row] });
        if (botMessages.length > 1) {
          for (let i = 1; i < botMessages.length; i++) await botMessages[i].delete().catch(() => {});
        }
      } else {
        await roleChannel.send({ embeds: [embed], components: [row] });
      }
    }
  } catch (err) {
    console.error('❌ Gagal mengelola panel pilihan role:', err.message);
  }

  // 5. Panel Modal Perkenalan (Intro Card Trigger Panel)
  try {
    const introChannel = await client.channels.fetch(INTRO_CHANNEL_ID).catch(() => null);
    if (introChannel && introChannel.isTextBased()) {
      const messages = await introChannel.messages.fetch({ limit: 50 }).catch(() => null);
      const botMessages = messages ? [...messages.filter(m => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title && m.embeds[0].title.includes('PERKENALAN WARGA')).values()] : [];

      const embed = new EmbedBuilder()
        .setColor(0x818cf8)
        .setTitle('📝 PANEL PERKENALAN WARGA KOSAN 1A')
        .setDescription(
          'Halo Warga Kosan 1A! Yuk saling kenalan satu sama lain dengan membuat Kartu Identitas Resmi Warga Kosan 1A!\n\n' +
          'Klik tombol **"📝 Buat Kartu Perkenalan"** di bawah ini untuk mengisi formulir perkenalan Anda secara instan. Bot akan membuatkan **Kartu Identitas Visual Premium** secara otomatis!'
        )
        .setFooter({ text: 'Identitas resmi warga Kosan 1A • Klik tombol di bawah untuk perkenalan' });

      const btn = new ButtonBuilder()
        .setCustomId('btn_open_intro_modal')
        .setLabel('📝 Buat Kartu Perkenalan')
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(btn);

      if (botMessages.length > 0) {
        await botMessages[0].edit({ embeds: [embed], components: [row] });
        if (botMessages.length > 1) {
          for (let i = 1; i < botMessages.length; i++) await botMessages[i].delete().catch(() => {});
        }
      } else {
        await introChannel.send({ embeds: [embed], components: [row] });
      }
      console.log(`✅ Panel Perkenalan Warga berhasil aktif di <#${INTRO_CHANNEL_ID}>.`);
    }
  } catch (err) {
    console.error('❌ Gagal mengelola panel perkenalan warga:', err.message);
  }
});

// Event Listener: Menyambut Member Baru
client.on('guildMemberAdd', async (member) => {
  try {
    console.log(`👋 Member baru bergabung: ${member.user.tag} (${member.id})`);
    const welcomeChan = await member.guild.channels.fetch(GREETING_CHANNEL_ID).catch(() => null);
    if (welcomeChan && welcomeChan.isTextBased()) {
      await welcomeChan.send({
        content: `👋 Selamat datang <@${member.id}> di **${member.guild.name}**! Silakan perkenalkan diri Anda di <#${INTRO_CHANNEL_ID}> & ambil role Anda di <#${ROLE_CHANNEL_ID}> ✨`
      }).catch(() => {});
    }
  } catch (err) {
    console.error('❌ Error pada event guildMemberAdd:', err.message);
  }
});

// Event Listener Interaksi: Modal Perkenalan & Dropdown Role
client.on('interactionCreate', async (interaction) => {
  // A. Tombol Buka Modal Perkenalan
  if (interaction.isButton() && interaction.customId === 'btn_open_intro_modal') {
    const modal = new ModalBuilder()
      .setCustomId('modal_intro_submission')
      .setTitle('📝 Formulir Kartu Identitas Warga');

    const inputNickname = new TextInputBuilder()
      .setCustomId('intro_nickname')
      .setLabel('👤 Nama Panggilan')
      .setPlaceholder('Contoh: Lyn / Budi / Siska')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const inputAge = new TextInputBuilder()
      .setCustomId('intro_age')
      .setLabel('🎂 Rentang Umur')
      .setPlaceholder('Contoh: 20 / 18-22')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const inputOrigin = new TextInputBuilder()
      .setCustomId('intro_origin')
      .setLabel('📍 Daerah Asal')
      .setPlaceholder('Contoh: Batam / Jakarta / Bandung')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const inputGameId = new TextInputBuilder()
      .setCustomId('intro_game_id')
      .setLabel('🎮 Roblox / MLBB ID')
      .setPlaceholder('Contoh: Floryn_pl / 12345678')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const inputHobbies = new TextInputBuilder()
      .setCustomId('intro_hobbies')
      .setLabel('✨ Ketertarikan / Hobi')
      .setPlaceholder('Contoh: ice skating, watching movies')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(inputNickname),
      new ActionRowBuilder().addComponents(inputAge),
      new ActionRowBuilder().addComponents(inputOrigin),
      new ActionRowBuilder().addComponents(inputGameId),
      new ActionRowBuilder().addComponents(inputHobbies)
    );

    return interaction.showModal(modal);
  }

  // B. Submit Modal Perkenalan (Generate KTP Card & Post Embed)
  if (interaction.isModalSubmit() && interaction.customId === 'modal_intro_submission') {
    await interaction.deferReply({ ephemeral: true });

    const nickname = interaction.fields.getTextInputValue('intro_nickname');
    const ageRange = interaction.fields.getTextInputValue('intro_age');
    const origin = interaction.fields.getTextInputValue('intro_origin');
    const gameId = interaction.fields.getTextInputValue('intro_game_id') || '-';
    const hobbies = interaction.fields.getTextInputValue('intro_hobbies') || '-';

    const user = interaction.user;
    const member = interaction.member;
    const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 512 });

    try {
      // Generate Visual Graphic ID Card
      const buffer = await generateIdCard({
        nickname,
        ageRange,
        origin,
        gameId,
        hobbies,
        avatarUrl,
        tag: user.username
      });

      const attachment = new AttachmentBuilder(buffer, { name: 'kartu_identitas_warga.png' });

      // Build Premium Intro Embed
      const introEmbed = new EmbedBuilder()
        .setColor(0x818cf8)
        .setTitle(`📝 KARTU IDENTITAS RESMI WARGA KOSAN 1A`)
        .setDescription(`Warga baru telah mengenalkan diri! Yuk kenalan dengan <@${user.id}> ✨`)
        .addFields(
          { name: '👤 Nama Panggilan', value: `**${nickname}**`, inline: true },
          { name: '🎂 Rentang Umur', value: `**${ageRange}**`, inline: true },
          { name: '📍 Daerah Asal', value: `**${origin}**`, inline: true },
          { name: '🎮 Roblox / MLBB', value: `**${gameId}**`, inline: true },
          { name: '✨ Ketertarikan / Hobi', value: `*${hobbies}*`, inline: false }
        )
        .setImage('attachment://kartu_identitas_warga.png')
        .setFooter({ text: `Kosan 1A Resident • ${user.username}`, iconURL: avatarUrl })
        .setTimestamp();

      const introChannel = await interaction.guild.channels.fetch(INTRO_CHANNEL_ID).catch(() => null);
      if (introChannel && introChannel.isTextBased()) {
        await introChannel.send({
          content: `🎉 Menyambut warga baru <@${user.id}>!`,
          embeds: [introEmbed],
          files: [attachment]
        });
      }

      // Verifikasi otomatis role Verified jika ada
      const VERIFIED_ROLE_ID = '1520716203935535257';
      if (member && !member.roles.cache.has(VERIFIED_ROLE_ID)) {
        await member.roles.add(VERIFIED_ROLE_ID).catch(() => {});
      }

      await interaction.editReply({
        content: '✅ **Kartu Perkenalan Anda berhasil diterbitkan & dikirim ke channel perkenalan!** Terima kasih sudah memperkenalkan diri.'
      });
    } catch (err) {
      console.error('❌ Gagal menerbitkan Kartu Identitas Perkenalan:', err);
      await interaction.editReply({
        content: '❌ Terjadi kesalahan saat membuat Kartu Perkenalan. Silakan coba lagi.'
      });
    }
  }

  // C. Interaksi Select Menu Pilihan Role Mandiri
  if (interaction.isStringSelectMenu() && interaction.customId === 'select_member_roles') {
    await interaction.deferReply({ ephemeral: true });
    const member = interaction.member;
    const selectedRoleIds = interaction.values;
    const allRoleIds = Object.values(MEMBER_ROLES);

    try {
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
