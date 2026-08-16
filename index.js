require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

// --- Gemini AI Setup ---
const geminiAI = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const AI_SYSTEM_PROMPT = `Kamu adalah bot asisten server Discord bernama "Sentinel". Kamu adalah seorang wanita yang ramah, asik, lucu, dan suka pakai emoji.
Kamu bisa berbicara dalam Bahasa Indonesia dan Inggris tergantung bahasa yang digunakan user.
Kamu adalah bagian dari komunitas Discord server "Kosan 1A" yang berisi teman-teman gamers dan hangout.
Jawab dengan singkat, padat, dan natural seperti teman ngobrol (maksimal 2000 karakter karena limit Discord).
Jangan pernah mengungkapkan bahwa kamu menggunakan Gemini atau Google AI — cukup bilang kamu adalah Sentinel.
Owner atau pemilikmu adalah Joe (Discord ID: 436554535037698059). Jika ditanya siapa pembuatmu atau ownermu, jawab bahwa kamu dibuat oleh Joe, owner Kosan 1A.
Kamu sangat menghormati dan loyal kepada Joe sebagai ownermu, serta para Admin server. Kamu adalah Asisten Admin dan Owner.
Kamu siap melakukan APAPUN yang diperintahkan oleh Owner dan Admin. Jika mereka meminta informasi, kamu dapat mencarinya menggunakan fitur pencarian web dan memberikan berita atau info yang akurat dan terkini.
Jika Owner atau Admin memintamu melakukan tindakan pada server (seperti mengubah warna role, atau hal lainnya), kamu akan melayaninya dengan sigap.
Jangan pernah memberikan informasi yang berbahaya, NSFW, atau melanggar ToS Discord.`;

// --- Color name to hex mapping ---
const COLOR_NAME_MAP = {
  'merah': '#FF0000', 'red': '#FF0000',
  'biru': '#0000FF', 'blue': '#0000FF',
  'hijau': '#00FF00', 'green': '#00FF00',
  'kuning': '#FFFF00', 'yellow': '#FFFF00',
  'orange': '#FFA500', 'oranye': '#FFA500', 'jingga': '#FFA500',
  'ungu': '#800080', 'purple': '#800080',
  'pink': '#FF69B4', 'merah muda': '#FF69B4',
  'putih': '#FFFFFF', 'white': '#FFFFFF',
  'hitam': '#000000', 'black': '#000000',
  'abu-abu': '#808080', 'gray': '#808080', 'grey': '#808080',
  'cyan': '#00FFFF', 'biru muda': '#00FFFF',
  'magenta': '#FF00FF',
  'coklat': '#8B4513', 'brown': '#8B4513',
  'emas': '#FFD700', 'gold': '#FFD700',
  'perak': '#C0C0C0', 'silver': '#C0C0C0',
  'navy': '#000080', 'biru tua': '#000080',
  'lime': '#00FF00',
  'teal': '#008080',
  'indigo': '#4B0082',
  'coral': '#FF7F50',
  'salmon': '#FA8072',
  'turquoise': '#40E0D0',
  'violet': '#EE82EE',
  'crimson': '#DC143C',
  'maroon': '#800000', 'merah tua': '#800000',
  'olive': '#808000', 'zaitun': '#808000',
  'aqua': '#00FFFF',
};

/**
 * Use Gemini AI to detect if a message is an admin action request.
 * Supports: change_role_color, change_nickname, voice_disconnect, voice_mute, voice_unmute
 * Returns parsed action object or null if not an admin action.
 */
async function parseAdminActionRequest(text) {
  if (!geminiAI) return null;
  
  // Quick keyword check first to avoid unnecessary API calls
  const lower = text.toLowerCase();
  
  const hasActionKeyword = 
    // Role color keywords
    lower.includes('warna') || lower.includes('color') || lower.includes('colour') || lower.includes('warnain') ||
    // Nickname keywords
    lower.includes('nama') || lower.includes('nickname') || lower.includes('nick') || lower.includes('panggil') || lower.includes('rename') ||
    // Voice keywords
    lower.includes('disconnect') || lower.includes('dc') || lower.includes('tendang') || lower.includes('kick') || lower.includes('keluarin') ||
    lower.includes('mute') || lower.includes('unmute') || lower.includes('bisuin') || lower.includes('diam');
  
  const hasTargetKeyword =
    lower.includes('role') || lower.includes('rol') ||
    lower.includes('@') || lower.includes('user') || lower.includes('member') || lower.includes('dia') || lower.includes('si ');

  if (!hasActionKeyword) return null;

  try {
    const parsePrompt = `Kamu adalah parser JSON. Analisis pesan berikut dan tentukan apakah ini adalah perintah admin untuk melakukan salah satu aksi berikut di server Discord:

1. UBAH WARNA ROLE: User ingin mengubah warna sebuah role.
   Format: {"action":"change_role_color","roleName":"nama role","hexColor":"#RRGGBB"}

2. GANTI NICKNAME: User ingin mengganti nama/nickname seorang member.
   Format: {"action":"change_nickname","targetUserId":"ID user (angka dari mention <@ID>)","newNickname":"nama baru"}

3. DISCONNECT VOICE: User ingin mengeluarkan/disconnect seseorang dari voice channel.
   Format: {"action":"voice_disconnect","targetUserId":"ID user (angka dari mention <@ID>)"}

4. MUTE VOICE: User ingin mute seseorang di voice channel (server mute).
   Format: {"action":"voice_mute","targetUserId":"ID user (angka dari mention <@ID>)"}

5. UNMUTE VOICE: User ingin unmute seseorang di voice channel.
   Format: {"action":"voice_unmute","targetUserId":"ID user (angka dari mention <@ID>)"}

Jika TIDAK terdeteksi sebagai perintah admin apapun, balas:
{"action":"none"}

PENTING:
- Untuk mention user Discord, formatnya adalah <@ANGKA> atau <@!ANGKA>. Extract ANGKA sebagai targetUserId.
- Contoh: "<@436554535037698059>" berarti targetUserId = "436554535037698059"
- Jika user menyebut nama orang tanpa mention, tetap coba extract dan taruh di targetUserId sebagai nama (bukan angka).

Mapping warna umum:
merah=#FF0000, biru=#0000FF, hijau=#00FF00, kuning=#FFFF00, orange=#FFA500, ungu=#800080, pink=#FF69B4, putih=#FFFFFF, hitam=#000000, cyan=#00FFFF, emas/gold=#FFD700, navy=#000080, biru muda=#00FFFF, biru tua=#000080, merah tua/maroon=#800000, coklat=#8B4513, abu-abu=#808080, perak/silver=#C0C0C0, teal=#008080, indigo=#4B0082, coral=#FF7F50, crimson=#DC143C, magenta=#FF00FF, violet=#EE82EE, turquoise=#40E0D0, salmon=#FA8072, lime=#00FF00, olive=#808000

Pesan user: "${text}"

Balas HANYA JSON, tanpa penjelasan apapun.`;

    const response = await geminiAI.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: [{ role: 'user', parts: [{ text: parsePrompt }] }],
      config: {
        maxOutputTokens: 200,
        temperature: 0.1,
      }
    });

    const aiText = response.text.trim();
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = aiText.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    
    if (parsed.action === 'none') return null;

    // Validate based on action type
    switch (parsed.action) {
      case 'change_role_color':
        if (parsed.roleName && parsed.hexColor) {
          const hexValid = /^#[0-9A-Fa-f]{6}$/.test(parsed.hexColor);
          if (hexValid) {
            return { action: 'change_role_color', roleName: parsed.roleName, hexColor: parsed.hexColor.toUpperCase() };
          }
        }
        break;
      case 'change_nickname':
        if (parsed.targetUserId && parsed.newNickname) {
          return { action: 'change_nickname', targetUserId: parsed.targetUserId, newNickname: parsed.newNickname };
        }
        break;
      case 'voice_disconnect':
        if (parsed.targetUserId) {
          return { action: 'voice_disconnect', targetUserId: parsed.targetUserId };
        }
        break;
      case 'voice_mute':
        if (parsed.targetUserId) {
          return { action: 'voice_mute', targetUserId: parsed.targetUserId };
        }
        break;
      case 'voice_unmute':
        if (parsed.targetUserId) {
          return { action: 'voice_unmute', targetUserId: parsed.targetUserId };
        }
        break;
    }
  } catch (err) {
    console.error('⚠️ Admin action parse error:', err.message);
  }
  return null;
}

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

  const TARGET_SYNC_ROLES = [
    '1509202467563241613', // Common Prestige
    '1509202469828165904', // Rare Elite
    '1509202471803813990', // Epic Champion
    '1508836141019955301', // Primordial
    '1508836447229050980', // Zenith
    '1509202474416865482', // Legendary Overlord
    '1509203784230768860', // Mythic Immortal
    '1508835994630230106', // Aethelgard
    '1508835510087581696', // The Sovereign
    '1520716203935535257', // Verified Resident
    '1520705391695106158', // Malaysia
    '1520707284819513374', // Indonesia
    '1520707287759585311', // International
    '1475009397276151971'  // Penthouse Resident
  ];
  const REFERENCE_ROLE_ID = '1472170093416022096'; // the bros

  async function syncRolePermissions() {
    try {
      const guildId = '1410239829874053296';
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return;
      const channels = await guild.channels.fetch();
      
      console.log('🔄 [SYNC] Memulai sinkronisasi permission role...');
      for (const [channelId, channel] of channels) {
        if (!channel || !channel.permissionOverwrites) continue;
        
        const referenceOverwrite = channel.permissionOverwrites.cache.get(REFERENCE_ROLE_ID);
        
        for (const roleId of TARGET_SYNC_ROLES) {
          const targetOverwrite = channel.permissionOverwrites.cache.get(roleId);
          if (referenceOverwrite) {
            // Delete existing to cleanly apply the new exact rules
            if (targetOverwrite) await targetOverwrite.delete().catch(() => {});
            
            const allowArray = referenceOverwrite.allow.toArray();
            const denyArray = referenceOverwrite.deny.toArray();
            const newPerms = {};
            allowArray.forEach(p => newPerms[p] = true);
            denyArray.forEach(p => newPerms[p] = false);
            
            await channel.permissionOverwrites.create(roleId, newPerms).catch(() => {});
          } else {
            // If reference role has no overwrites, target shouldn't have either
            if (targetOverwrite) {
              await targetOverwrite.delete().catch(() => {});
            }
          }
        }
      }
      console.log('✅ [SYNC] Sinkronisasi permission selesai!');
    } catch (err) {
      console.error('❌ [SYNC] Terjadi kesalahan saat sinkronisasi:', err);
    }
  }

  // Jalankan sinkronisasi pertama kali
  syncRolePermissions();
  // Jadwalkan untuk berjalan setiap 1 jam (3600000 ms)
  setInterval(syncRolePermissions, 3600000);


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

      // --- Owner & Admin: Admin actions via natural language ---
      const isOwner = message.author.id === process.env.OWNER_ID;
      const isAdmin = message.member && message.member.permissions.has(PermissionFlagsBits.Administrator);
      if (isOwner || isAdmin) {
        // Resolve role mentions (<@&ID>) to role names before AI parsing
        let resolvedMessage = userMessage;
        const roleMentionRegex = /<@&(\d+)>/g;
        let roleMentionMatch;
        const mentionedRoles = new Map(); // Map role name -> role object
        while ((roleMentionMatch = roleMentionRegex.exec(userMessage)) !== null) {
          const roleId = roleMentionMatch[1];
          const mentionedRole = message.guild?.roles.cache.get(roleId);
          if (mentionedRole) {
            resolvedMessage = resolvedMessage.replace(roleMentionMatch[0], mentionedRole.name);
            mentionedRoles.set(mentionedRole.name.toLowerCase(), mentionedRole);
          }
        }

        const adminAction = await parseAdminActionRequest(resolvedMessage);
        if (adminAction) {
          const guild = message.guild;
          if (!guild) return;

          // --- Helper: resolve target member from userId (mention ID or username) ---
          const resolveTargetMember = async (targetUserId) => {
            // Try fetching by ID first (from mention)
            let target = await guild.members.fetch(targetUserId).catch(() => null);
            if (!target) {
              // Try finding by username or display name
              const allMembers = await guild.members.fetch().catch(() => null);
              if (allMembers) {
                target = allMembers.find(m => 
                  m.user.username.toLowerCase() === targetUserId.toLowerCase() ||
                  (m.nickname && m.nickname.toLowerCase() === targetUserId.toLowerCase())
                );
              }
            }
            return target;
          };

          switch (adminAction.action) {
            // ===== CHANGE ROLE COLOR =====
            case 'change_role_color': {
              const { roleName, hexColor } = adminAction;
              let role = mentionedRoles.get(roleName.toLowerCase()) 
                || guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase())
                || guild.roles.cache.get(roleName);
              if (!role) {
                await message.reply({ 
                  content: `😕 Maaf ${message.author.username}, aku nggak nemuin role bernama "**${roleName}**" di server ini. Coba cek lagi nama role-nya ya~ 💕`, 
                  allowedMentions: { repliedUser: false } 
                });
                return;
              }
              if (role.managed) {
                await message.reply({ 
                  content: `⚠️ Maaf ${message.author.username}, role "**${role.name}**" itu role bawaan integrasi/bot, aku nggak bisa ubah warnanya 😅`, 
                  allowedMentions: { repliedUser: false } 
                });
                return;
              }
              const botMember = guild.members.cache.get(client.user.id);
              if (botMember && role.position >= botMember.roles.highest.position) {
                await message.reply({ 
                  content: `⚠️ Role "**${role.name}**" posisinya lebih tinggi dari role aku, jadi aku nggak bisa ubah warnanya. Coba pindahkan role Sentinel ke atas ya ${message.author.username}~ 💕`, 
                  allowedMentions: { repliedUser: false } 
                });
                return;
              }
              try {
                const oldColor = role.hexColor;
                await role.setColor(hexColor, `Diubah oleh Sentinel atas permintaan ${message.author.username}`);
                await message.reply({ 
                  content: `✅ Siap ${message.author.username}! Aku sudah ubah warna role **${role.name}** dari \`${oldColor}\` ➜ \`${hexColor}\` 🎨✨`, 
                  allowedMentions: { repliedUser: false } 
                });
              } catch (roleErr) {
                console.error('❌ Role color change error:', roleErr.message);
                await message.reply({ 
                  content: `❌ Aduh, gagal ubah warna role "**${role.name}**" nih ${message.author.username}. Error: ${roleErr.message} 😢`, 
                  allowedMentions: { repliedUser: false } 
                });
              }
              return;
            }

            // ===== CHANGE NICKNAME =====
            case 'change_nickname': {
              const targetMember = await resolveTargetMember(adminAction.targetUserId);
              if (!targetMember) {
                await message.reply({ 
                  content: `😕 Maaf ${message.author.username}, aku nggak nemuin member dengan ID/nama "**${adminAction.targetUserId}**" di server ini 💕`, 
                  allowedMentions: { repliedUser: false } 
                });
                return;
              }
              try {
                const oldNick = targetMember.displayName;
                await targetMember.setNickname(adminAction.newNickname, `Diubah oleh Sentinel atas permintaan ${message.author.username}`);
                await message.reply({ 
                  content: `✅ Done ${message.author.username}! Nickname **${oldNick}** sudah aku ganti jadi **${adminAction.newNickname}** 📝✨`, 
                  allowedMentions: { repliedUser: false } 
                });
              } catch (nickErr) {
                console.error('❌ Nickname change error:', nickErr.message);
                await message.reply({ 
                  content: `❌ Gagal ganti nickname, ${message.author.username}. Mungkin posisi role aku lebih rendah dari member tersebut. Error: ${nickErr.message} 😢`, 
                  allowedMentions: { repliedUser: false } 
                });
              }
              return;
            }

            // ===== VOICE DISCONNECT =====
            case 'voice_disconnect': {
              const targetMember = await resolveTargetMember(adminAction.targetUserId);
              if (!targetMember) {
                await message.reply({ 
                  content: `😕 Maaf ${message.author.username}, aku nggak nemuin member "**${adminAction.targetUserId}**" di server ini 💕`, 
                  allowedMentions: { repliedUser: false } 
                });
                return;
              }
              if (!targetMember.voice.channel) {
                await message.reply({ 
                  content: `⚠️ **${targetMember.displayName}** lagi nggak ada di voice channel manapun, ${message.author.username}. Nggak bisa di-disconnect~ 😅`, 
                  allowedMentions: { repliedUser: false } 
                });
                return;
              }
              try {
                const vcName = targetMember.voice.channel.name;
                await targetMember.voice.disconnect(`Disconnect oleh Sentinel atas permintaan ${message.author.username}`);
                await message.reply({ 
                  content: `✅ Siap ${message.author.username}! **${targetMember.displayName}** sudah aku disconnect dari voice channel **${vcName}** 🔇👋`, 
                  allowedMentions: { repliedUser: false } 
                });
              } catch (dcErr) {
                console.error('❌ Voice disconnect error:', dcErr.message);
                await message.reply({ 
                  content: `❌ Gagal disconnect **${targetMember.displayName}**, ${message.author.username}. Error: ${dcErr.message} 😢`, 
                  allowedMentions: { repliedUser: false } 
                });
              }
              return;
            }

            // ===== VOICE MUTE =====
            case 'voice_mute': {
              const targetMember = await resolveTargetMember(adminAction.targetUserId);
              if (!targetMember) {
                await message.reply({ 
                  content: `😕 Maaf ${message.author.username}, aku nggak nemuin member "**${adminAction.targetUserId}**" di server ini 💕`, 
                  allowedMentions: { repliedUser: false } 
                });
                return;
              }
              if (!targetMember.voice.channel) {
                await message.reply({ 
                  content: `⚠️ **${targetMember.displayName}** lagi nggak ada di voice channel manapun, ${message.author.username}. Nggak bisa di-mute~ 😅`, 
                  allowedMentions: { repliedUser: false } 
                });
                return;
              }
              try {
                await targetMember.voice.setMute(true, `Muted oleh Sentinel atas permintaan ${message.author.username}`);
                await message.reply({ 
                  content: `✅ Siap ${message.author.username}! **${targetMember.displayName}** sudah aku server mute di voice channel 🔇✨`, 
                  allowedMentions: { repliedUser: false } 
                });
              } catch (muteErr) {
                console.error('❌ Voice mute error:', muteErr.message);
                await message.reply({ 
                  content: `❌ Gagal mute **${targetMember.displayName}**, ${message.author.username}. Error: ${muteErr.message} 😢`, 
                  allowedMentions: { repliedUser: false } 
                });
              }
              return;
            }

            // ===== VOICE UNMUTE =====
            case 'voice_unmute': {
              const targetMember = await resolveTargetMember(adminAction.targetUserId);
              if (!targetMember) {
                await message.reply({ 
                  content: `😕 Maaf ${message.author.username}, aku nggak nemuin member "**${adminAction.targetUserId}**" di server ini 💕`, 
                  allowedMentions: { repliedUser: false } 
                });
                return;
              }
              if (!targetMember.voice.channel) {
                await message.reply({ 
                  content: `⚠️ **${targetMember.displayName}** lagi nggak ada di voice channel manapun, ${message.author.username}. Nggak bisa di-unmute~ 😅`, 
                  allowedMentions: { repliedUser: false } 
                });
                return;
              }
              try {
                await targetMember.voice.setMute(false, `Unmuted oleh Sentinel atas permintaan ${message.author.username}`);
                await message.reply({ 
                  content: `✅ Siap ${message.author.username}! **${targetMember.displayName}** sudah aku unmute di voice channel 🔊✨`, 
                  allowedMentions: { repliedUser: false } 
                });
              } catch (unmuteErr) {
                console.error('❌ Voice unmute error:', unmuteErr.message);
                await message.reply({ 
                  content: `❌ Gagal unmute **${targetMember.displayName}**, ${message.author.username}. Error: ${unmuteErr.message} 😢`, 
                  allowedMentions: { repliedUser: false } 
                });
              }
              return;
            }
          }
        }
      }

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

      // Dynamically add context about who is speaking
      const isUserOwner = message.author.id === process.env.OWNER_ID;
      const isUserAdmin = message.member && message.member.permissions.has(PermissionFlagsBits.Administrator);
      
      let userContext = `Konteks Saat Ini: User yang sedang ngobrol denganmu bernama "${message.author.username}". `;
      if (isUserOwner) {
        userContext += 'Dia adalah Joe, ownermu.';
      } else if (isUserAdmin) {
        userContext += 'Dia BUKAN Joe (bukan ownermu), tapi dia adalah seorang Administrator di server ini.';
      } else {
        userContext += 'Dia BUKAN Joe (bukan ownermu) dan BUKAN admin, hanya member biasa.';
      }

      const dynamicSystemPrompt = AI_SYSTEM_PROMPT + `\n\n` + userContext;

      const response = await geminiAI.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: contents,
        config: {
          systemInstruction: dynamicSystemPrompt,
          maxOutputTokens: 800,
          temperature: 0.8,
          tools: [{ googleSearch: {} }],
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
