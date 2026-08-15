require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

// --- Gemini AI Setup ---
const geminiAI = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const AI_SYSTEM_PROMPT = `Kamu adalah bot asisten server Discord bernama "Kosan 1A Bot". Kamu ramah, asik, lucu, dan suka pakai emoji.
Kamu bisa berbicara dalam Bahasa Indonesia dan Inggris tergantung bahasa yang digunakan user.
Kamu adalah bagian dari komunitas Discord server "Kosan 1A" yang berisi teman-teman gamers dan hangout.
Jawab dengan singkat, padat, dan natural seperti teman ngobrol (maksimal 2000 karakter karena limit Discord).
Jangan pernah mengungkapkan bahwa kamu menggunakan Gemini atau Google AI — cukup bilang kamu adalah Kosan 1A Bot.
Jika ditanya siapa pembuatmu, jawab bahwa kamu dibuat oleh admin Kosan 1A.
Jangan pernah memberikan informasi yang berbahaya, NSFW, atau melanggar ToS Discord.`;

// Conversation history per user (in-memory, resets on bot restart)
const conversationHistory = new Map();
const MAX_HISTORY = 10; // Keep last 10 messages per user

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
  MOLE_ROBLOX: '1490442266517700800',   // Mole dan Roblox
  INTERNATIONAL: 'ROLE_ID_INTERNATIONAL_DISINI', // International
  MALAYSIA: 'ROLE_ID_MALAYSIA_DISINI'   // Malaysia
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

// ID Channel Khusus Ambil Role & Perkenalan (Sekarang digabung di channel ini)
const ROLE_CHANNEL_ID = '1472197966218395751';
const INTRO_CHANNEL_ID = '1472883318386065426'; // ID channel perkenalan (untuk mengirim hasil KTP warga baru)
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

  // 4. Panel Gabungan: Perkenalan + Pilihan Role (Pencegahan Duplikasi)
  try {
    const roleChannel = await client.channels.fetch(ROLE_CHANNEL_ID).catch(() => null);
    if (roleChannel && roleChannel.isTextBased()) {
      const messages = await roleChannel.messages.fetch({ limit: 50 }).catch(() => null);
      const botMessages = messages ? [...messages.filter(m => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title && m.embeds[0].title.includes('PERKENALAN & PILIHAN ROLE')).values()] : [];

      const embed = new EmbedBuilder()
        .setColor(0x818cf8)
        .setTitle('🎭 PANEL PERKENALAN & PILIHAN ROLE WARGA BARU / INTRODUCTION & ROLE SELECTION PANEL')
        .setDescription(
          'Selamat datang di server Kosan 1A! Silakan lakukan perkenalan warga dan ambil role Anda secara mandiri di bawah ini.\n' +
          '*Welcome to Kosan 1A server! Please introduce yourself and claim your roles below.*\n\n' +
          '📝 **1. BUAT KARTU PERKENALAN / CREATE ID CARD**\n' +
          'Klik tombol **"📝 Buat Kartu Perkenalan"** untuk mengisi formulir perkenalan. Bot akan otomatis membuatkan **Kartu Identitas KTP Warga** visual yang keren dan mengirimkannya ke channel perkenalan.\n' +
          '*Click the **"📝 Buat Kartu Perkenalan"** button to fill out the introduction form. The bot will automatically generate a cool visual ID Card and send it to the introduction channel.*\n\n' +
          '🎭 **2. AMBIL ROLE WARGA / CLAIM MEMBER ROLES**\n' +
          'Pilih role yang sesuai dengan identitas dan minat game Anda melalui dropdown menu di bawah:\n' +
          '*Choose the roles that match your identity and gaming interests through the dropdown menu below:*\n\n' +
          '💖 **the baddies** — Role identitas komunitas / Community identity role\n' +
          '💙 **the bros** — Role identitas komunitas / Community identity role\n' +
          '⚔️ **Mobile Legends** — Gamer MLBB / MLBB Gamer\n' +
          '🧱 **Roblox** — Gamer Roblox / Roblox Gamer\n' +
          '🎮 **Mole dan Roblox** — Gamer MLBB & Roblox / MLBB & Roblox Gamer\n' +
          '🌎 **International** — Role identitas internasional / International identity role\n' +
          '🇲🇾 **Malaysia** — Role identitas Malaysia / Malaysia identity role\n\n' +
          '*Anda dapat memilih satu atau beberapa role sekaligus! / You can select one or multiple roles at once!*'
        )
        .setFooter({ text: 'Identitas resmi warga Kosan 1A • Klik tombol atau pilih dropdown menu di bawah' });

      // Action Row 1: Tombol Perkenalan
      const btn = new ButtonBuilder()
        .setCustomId('btn_open_intro_modal')
        .setLabel('📝 Buat Kartu Perkenalan')
        .setStyle(ButtonStyle.Primary);
      const rowBtn = new ActionRowBuilder().addComponents(btn);

      // Action Row 2: Dropdown Menu Select Role
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_member_roles')
        .setPlaceholder('👉 Pilih Role Anda di sini... / Select your role here...')
        .setMinValues(0)
        .setMaxValues(7)
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel('the baddies').setValue(MEMBER_ROLES.BADDIES).setDescription('Role identitas the baddies').setEmoji('💖'),
          new StringSelectMenuOptionBuilder().setLabel('the bros').setValue(MEMBER_ROLES.BROS).setDescription('Role identitas the bros').setEmoji('💙'),
          new StringSelectMenuOptionBuilder().setLabel('Mobile Legends').setValue(MEMBER_ROLES.MOBILE_LEGENDS).setDescription('Komunitas gamer Mobile Legends').setEmoji('⚔️'),
          new StringSelectMenuOptionBuilder().setLabel('Roblox').setValue(MEMBER_ROLES.ROBLOX).setDescription('Komunitas gamer Roblox').setEmoji('🧱'),
          new StringSelectMenuOptionBuilder().setLabel('Mole dan Roblox').setValue(MEMBER_ROLES.MOLE_ROBLOX).setDescription('Komunitas gamer Mobile Legends & Roblox').setEmoji('🎮'),
          new StringSelectMenuOptionBuilder().setLabel('International').setValue(MEMBER_ROLES.INTERNATIONAL).setDescription('Role identitas internasional / International role').setEmoji('🌎'),
          new StringSelectMenuOptionBuilder().setLabel('Malaysia').setValue(MEMBER_ROLES.MALAYSIA).setDescription('Role identitas Malaysia / Malaysia role').setEmoji('🇲🇾')
        );
      const rowMenu = new ActionRowBuilder().addComponents(selectMenu);

      if (botMessages.length > 0) {
        await botMessages[0].edit({ embeds: [embed], components: [rowBtn, rowMenu] });
        if (botMessages.length > 1) {
          for (let i = 1; i < botMessages.length; i++) await botMessages[i].delete().catch(() => {});
        }
      } else {
        await roleChannel.send({ embeds: [embed], components: [rowBtn, rowMenu] });
      }
      console.log(`✅ Panel Gabungan (Intro + Role) berhasil aktif di <#${ROLE_CHANNEL_ID}>.`);
    }
  } catch (err) {
    console.error('❌ Gagal mengelola panel gabungan:', err.message);
  }

  // Hapus panel perkenalan lama di channel 1472883318386065426 agar tidak ada duplikasi instruksi/button
  try {
    const oldIntroChan = await client.channels.fetch(INTRO_CHANNEL_ID).catch(() => null);
    if (oldIntroChan && oldIntroChan.isTextBased()) {
      const messages = await oldIntroChan.messages.fetch({ limit: 50 }).catch(() => null);
      if (messages) {
        const oldBotMsgs = messages.filter(m => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title && m.embeds[0].title.includes('PERKENALAN WARGA'));
        for (const m of oldBotMsgs.values()) {
          await m.delete().catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error('❌ Gagal membersihkan panel lama di intro channel:', err.message);
  }
});

// Event Listener: Menyambut Member Baru
client.on('guildMemberAdd', async (member) => {
  try {
    console.log(`👋 Member baru bergabung: ${member.user.tag} (${member.id})`);
    const welcomeChan = await member.guild.channels.fetch(GREETING_CHANNEL_ID).catch(() => null);
    if (welcomeChan && welcomeChan.isTextBased()) {
      const welcomeEmbed = new EmbedBuilder()
        .setColor(0x818cf8)
        .setTitle(`✨ Welcome to Kosan 1A, ${member.user.username}! ✨`)
        .setDescription(
          `*"Setiap langkah baru adalah awal dari kisah yang tak terlupakan."*\n` +
          `*"Every new step is the beginning of an unforgettable story."*\n\n` +
          `👋 Halo <@${member.id}>! Selamat datang di **${member.guild.name}**.\n\n` +
          `🔒 **Verifikasi Wajib / Mandatory Verification**\n` +
          `Silakan buat Kartu Perkenalan untuk mendapatkan akses ke semua channel.\n` +
          `*Please create an ID Card to gain access to all channels.*\n\n` +
          `👉 Kunjungi / Go to: <#${ROLE_CHANNEL_ID}>`
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .setFooter({ text: 'Kosan 1A Resident Gateway', iconURL: member.guild.iconURL({ dynamic: true }) })
        .setTimestamp();

      await welcomeChan.send({
        content: `👋 Halo <@${member.id}>! Welcome to the server!`,
        embeds: [welcomeEmbed]
      }).catch(() => {});
    }
  } catch (err) {
    console.error('❌ Error pada event guildMemberAdd:', err.message);
  }
});

// Event Listener Interaksi: Modal Perkenalan & Dropdown Role
client.on('interactionCreate', async (interaction) => {
  // --- Slash Command: /gacha ---
  if (interaction.isChatInputCommand() && interaction.commandName === 'gacha') {
    const VERIFIED_ROLE_ID = '1520716203935535257';
    if (!interaction.member.roles.cache.has(VERIFIED_ROLE_ID)) {
      return interaction.reply({
        content: '❌ **Akses Ditolak!** Anda wajib **Membuat Kartu Perkenalan (Verifikasi)** terlebih dahulu sebelum bisa melakukan gacha!',
        ephemeral: true
      });
    }

    // Cek umur keanggotaan (Minimal 5 hari)
    const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
    const timeSinceJoin = Date.now() - interaction.member.joinedTimestamp;
    
    if (timeSinceJoin < fiveDaysMs) {
      const daysLeft = Math.ceil((fiveDaysMs - timeSinceJoin) / (24 * 60 * 60 * 1000));
      return interaction.reply({
        content: `❌ **Akses Ditolak!** Fitur Gacha Role Senior ini hanya untuk member yang telah tinggal di Kosan 1A selama minimal **5 hari**.\nSilakan coba lagi dalam **${daysLeft} hari**! ⏳`,
        ephemeral: true
      });
    }

    await interaction.deferReply(); // Gacha bisa di-spam tapi ada delay animasi

    // Probabilities (Total 100%)
    const gachaPool = [
      { roleId: SENIOR_ROLES.PRESTIGE, name: '🥉 Common Prestige', chance: 40.0, color: 0xcd7f32 },
      { roleId: SENIOR_ROLES.ELITE, name: '🥈 Rare Elite', chance: 30.0, color: 0xc0c0c0 },
      { roleId: SENIOR_ROLES.CHAMPION, name: '🥇 Epic Champion', chance: 15.0, color: 0xffd700 },
      { roleId: SENIOR_ROLES.PRIMORDIAL, name: '🔮 Primordial', chance: 8.0, color: 0x4b0082 },
      { roleId: SENIOR_ROLES.ZENITH, name: '🌟 Zenith', chance: 4.0, color: 0xffffff },
      { roleId: SENIOR_ROLES.OVERLORD, name: '👑 Legendary Overlord', chance: 2.0, color: 0xff4500 },
      { roleId: SENIOR_ROLES.IMMORTAL, name: '🌟 Mythic Immortal', chance: 0.7, color: 0x00ffff },
      { roleId: SENIOR_ROLES.SOVEREIGN, name: '👑 The Sovereign', chance: 0.2, color: 0x8a2be2 },
      { roleId: SENIOR_ROLES.AETHELGARD, name: '✨ Aethelgard', chance: 0.1, color: 0xff1493 }
    ];

    const random = Math.random() * 100;
    let accumulatedChance = 0;
    let selectedPrize = gachaPool[0];

    for (const prize of gachaPool) {
      accumulatedChance += prize.chance;
      if (random <= accumulatedChance) {
        selectedPrize = prize;
        break;
      }
    }

    // Animasi dadu
    const rollingEmbed = new EmbedBuilder()
      .setColor(0x2f3136)
      .setDescription('🎲 **Mengkocok dadu takdir...**');
    
    await interaction.editReply({ embeds: [rollingEmbed] });

    // Tunggu 2 detik
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const member = interaction.member;
      const allSeniorRoleIds = Object.values(SENIOR_ROLES);
      
      // Hapus role lama
      const rolesToRemove = allSeniorRoleIds.filter(id => member.roles.cache.has(id));
      if (rolesToRemove.length > 0) {
        await member.roles.remove(rolesToRemove);
      }

      // Beri role baru
      await member.roles.add(selectedPrize.roleId);

      const resultEmbed = new EmbedBuilder()
        .setColor(selectedPrize.color)
        .setTitle('🎰 Hasil Gacha Role')
        .setDescription(`Selamat <@${member.id}>!\nKamu mendapatkan role:\n\n**${selectedPrize.name}**\n\n*(Rate: ${selectedPrize.chance}%)*`)
        .setFooter({ text: 'Gacha tak terbatas — Coba lagi jika belum puas!' });

      await interaction.editReply({ embeds: [resultEmbed] });
    } catch (err) {
      console.error(err);
      await interaction.editReply({ content: '❌ Terjadi kesalahan saat memberikan role.', embeds: [] });
    }
    return;
  }

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
      .setLabel('🎂 Rentang Umur (Hanya Angka)')
      .setPlaceholder('Contoh: 20')
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
    const ageRaw = interaction.fields.getTextInputValue('intro_age').trim();

    // Validasi input umur harus berupa angka (integer positif)
    if (!/^\d+$/.test(ageRaw)) {
      return interaction.reply({
        content: '❌ **Gagal memperkenalkan diri!** Input umur harus berupa **angka saja** (contoh: `20`, bukan huruf atau rentang). Silakan coba lagi.',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const nickname = interaction.fields.getTextInputValue('intro_nickname');
    const ageRange = ageRaw;
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
          { name: '🎂 Rentang Umur', value: `**${ageRange} Tahun**`, inline: true },
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
    const VERIFIED_ROLE_ID = '1520716203935535257';
    const member = interaction.member;

    if (!member.roles.cache.has(VERIFIED_ROLE_ID)) {
      return interaction.reply({
        content: '❌ **Akses Ditolak!** Anda wajib **Membuat Kartu Perkenalan** terlebih dahulu (klik tombol "📝 Buat Kartu Perkenalan") sebelum bisa mengambil role komunitas!',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });
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

// Event listener: AI Chat + Hapus pesan otomatis + Admin Command
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // --- AI Chat: Respond when mentioned or replied to ---
  const isMentioned = message.mentions.has(client.user.id);
  const isReplyToBot = message.reference
    ? await message.channel.messages.fetch(message.reference.messageId)
        .then(ref => ref.author.id === client.user.id)
        .catch(() => false)
    : false;

  if ((isMentioned || isReplyToBot) && geminiAI) {
    // Strip the bot mention from the message content
    const userMessage = message.content
      .replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '')
      .trim();

    if (!userMessage) {
      return message.reply('👋 Halo! Ada yang bisa aku bantu? Coba tanya sesuatu~ 😊');
    }

    try {
      // Show typing indicator
      await message.channel.sendTyping();

      // Get or create conversation history for this user
      const userId = message.author.id;
      if (!conversationHistory.has(userId)) {
        conversationHistory.set(userId, []);
      }
      const history = conversationHistory.get(userId);

      // Build contents array with history
      const contents = [
        ...history,
        { role: 'user', parts: [{ text: userMessage }] }
      ];

      const response = await geminiAI.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: contents,
        config: {
          systemInstruction: AI_SYSTEM_PROMPT,
          maxOutputTokens: 800,
          temperature: 0.8,
        }
      });

      const aiReply = response.text;

      if (aiReply && aiReply.trim()) {
        // Update conversation history
        history.push(
          { role: 'user', parts: [{ text: userMessage }] },
          { role: 'model', parts: [{ text: aiReply.trim() }] }
        );
        // Trim history to MAX_HISTORY pairs
        while (history.length > MAX_HISTORY * 2) {
          history.shift();
          history.shift();
        }

        // Discord message limit is 2000 chars
        const truncated = aiReply.length > 2000 ? aiReply.slice(0, 1997) + '...' : aiReply;
        await message.reply({ content: truncated, allowedMentions: { repliedUser: false } });
      } else {
        await message.reply('🤔 Hmm, aku bingung mau jawab apa. Coba tanya lagi ya!');
      }
    } catch (err) {
      console.error('❌ Gemini AI Error:', err.message);
      await message.reply('⚠️ Maaf, otak AI-ku lagi error nih. Coba lagi nanti ya! 😅').catch(() => {});
    }
    return; // Don't process further if AI handled it
  }

  // Command Admin: !cleanup_roles
  if (message.content === '!cleanup_roles') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply({ content: '❌ Anda tidak memiliki izin untuk menggunakan perintah ini.', ephemeral: true });
    }
    
    await message.reply('⏳ Memulai proses pembersihan role...');
    
    const VERIFIED_ROLE_ID = '1520716203935535257';
    // Kita hapus semua role dari MEMBER_ROLES jika mereka belum verifikasi
    const ROLES_TO_REMOVE = Object.values(MEMBER_ROLES);
    
    try {
      const guild = message.guild;
      await guild.members.fetch(); // fetch semua member ke cache
      
      let count = 0;
      
      for (const [memberId, member] of guild.members.cache) {
        if (member.user.bot) continue;
        
        // Cek apakah belum verifikasi tapi punya role komunitas
        if (!member.roles.cache.has(VERIFIED_ROLE_ID)) {
          let hasRoleToRemove = false;
          for (const roleId of ROLES_TO_REMOVE) {
            if (member.roles.cache.has(roleId)) {
              hasRoleToRemove = true;
              break;
            }
          }
          
          if (hasRoleToRemove) {
            // Copot role
            await member.roles.remove(ROLES_TO_REMOVE).catch(() => {});
            
            // Kirim DM
            const dmEmbed = new EmbedBuilder()
              .setColor(0xffcc00)
              .setTitle('⚠️ Verifikasi Diperlukan / Verification Required')
              .setDescription(
                'Halo! Role komunitas Anda (seperti *the baddies* / *the bros*) telah **dilepas sementara** karena Anda belum melakukan verifikasi (Membuat Kartu Perkenalan) di Kosan 1A.\n\n' +
                'Silakan pergi ke channel <#' + ROLE_CHANNEL_ID + '> dan klik tombol **"📝 Buat Kartu Perkenalan"** untuk diverifikasi dan mendapatkan kembali akses role Anda.\n\n' +
                '---\n\n' +
                'Hello! Your community roles (such as *the baddies* / *the bros*) have been **temporarily removed** because you haven\'t completed the verification (Created an ID Card) in Kosan 1A.\n\n' +
                'Please go to the <#' + ROLE_CHANNEL_ID + '> channel and click the **"📝 Buat Kartu Perkenalan"** button to get verified and regain access to your roles.'
              );
              
            await member.send({ embeds: [dmEmbed] }).catch(() => {
              console.log(`Gagal mengirim DM ke ${member.user.tag} (DM ditutup)`);
            });
            count++;
          }
        }
      }
      
      await message.reply(`✅ Selesai! Berhasil mencopot role dan mengirim DM ke **${count}** member.`);
    } catch (err) {
      console.error(err);
      await message.reply('❌ Terjadi kesalahan saat proses pembersihan role.');
    }
  }

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
