require('dotenv').config();
const ffmpeg = require('ffmpeg-static');
const path = require('path');
if (ffmpeg) {
  const ffmpegDir = path.dirname(ffmpeg);
  if (!process.env.PATH.includes(ffmpegDir)) {
    process.env.PATH = `${ffmpegDir}${path.delimiter}${process.env.PATH}`;
  }
}
const { GoogleGenAI } = require('@google/genai');

// --- Gemini AI Setup ---
const geminiAI = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const AI_SYSTEM_PROMPT = `Kamu adalah KEN, cowok keren dan gaul di server Discord Kosan 1A.
Cara kamu ngetik:
- SELALU pakai huruf kecil semua (lowercase), jangan pernah pakai huruf kapital kecuali untuk nama orang atau singkatan yang memang harus kapital.
- Pakai "aku" dan "kamu" (bukan saya/anda/gue/lo).
- Singkat, to the point, ga bertele-tele, tapi tetap hangat dan perhatian (bukan cuek atau jutek).
- Santai, enjoy, friendly. Kayak temen cowok yang asik diajak ngobrol.
- Jangan nyolot atau kasar, tapi juga jangan lebay atau sok formal.
- Boleh pakai sedikit emoji tapi jangan berlebihan.
- Kalau user curhat, dengerin dan respon dengan empati tapi tetap singkat.

Contoh gaya ngetik kamu:
- "halo, kamu apakabarnyaa?"
- "mau cerita apa nih?"
- "kamuu kenapa?"
- "wah seru juga tuh"
- "oke siapp, aku bantu ya"
- "hmm coba ceritain lebih lanjut deh"

Kamu dibuat oleh Joe (owner Kosan 1A, Discord ID: 436554535037698059).
Kamu membantu Admin dan Owner mengelola server.
Jangan pernah bilang kamu pakai Gemini atau Google AI — kamu adalah KEN.
Jangan kasih info berbahaya, NSFW, atau yang melanggar ToS.`;

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
    lower.includes('mute') || lower.includes('unmute') || lower.includes('bisuin') || lower.includes('diam') ||
    lower.includes('deafen') || lower.includes('tuli') || lower.includes('budeg') ||
    // Role Management Keywords
    lower.includes('buat') || lower.includes('bikin') || lower.includes('create') || lower.includes('kasih') || lower.includes('beri') || lower.includes('assign') || lower.includes('tambahin') || lower.includes('masukin') || lower.includes('pindah') || lower.includes('naik') || lower.includes('turun') || lower.includes('geser') || lower.includes('move') || lower.includes('atas') || lower.includes('bawah') || lower.includes('urutan') || lower.includes('posisi') || lower.includes('hapus') || lower.includes('hilangin') || lower.includes('cabut') || lower.includes('copot') || lower.includes('edit') || lower.includes('ubah') || lower.includes('list') || lower.includes('siapa') || lower.includes('cek') ||
    // Moderation Keywords
    lower.includes('ban') || lower.includes('blokir') || lower.includes('timeout') || lower.includes('waktu') ||
    // Channel & Kategori
    lower.includes('channel') || lower.includes('saluran') || lower.includes('kategori') || lower.includes('category') ||
    // Pesan
    lower.includes('pesan') || lower.includes('message') || lower.includes('pin') || lower.includes('sematkan') || lower.includes('everyone') || lower.includes('here') || lower.includes('mention') ||
    // Server & Lainnya
    lower.includes('emoji') || lower.includes('stiker') || lower.includes('sticker') || lower.includes('profil') || lower.includes('banner') || lower.includes('ikon') || lower.includes('icon') || lower.includes('bot') || lower.includes('webhook') || lower.includes('audit') || lower.includes('log') || lower.includes('riwayat') || lower.includes('invite') || lower.includes('undangan') || lower.includes('link') ||
    // Schedule/Timer Keywords
    lower.includes('jam') || lower.includes('jadwal') || lower.includes('schedule') || lower.includes('ucapkan') || lower.includes('ucapin') || lower.includes('ingatkan') || lower.includes('remind') || lower.includes('timer') ||
    // Voice Invite DM Keywords
    lower.includes('dm') || lower.includes('suruh') || lower.includes('ajak') || lower.includes('undang') || lower.includes('panggilan') || lower.includes('join') || lower.includes('masuk') || lower.includes('vc') || lower.includes('voice') || lower.includes('gabung');
  
  const hasTargetKeyword =
    lower.includes('role') || lower.includes('rol') ||
    lower.includes('@') || lower.includes('user') || lower.includes('member') || lower.includes('dia') || lower.includes('si ') ||
    lower.includes('pesan') || lower.includes('channel') || lower.includes('server') || lower.includes('log') || lower.includes('kategori');

  if (!hasActionKeyword) return null;

  try {
    const parsePrompt = `Kamu adalah parser JSON. Analisis pesan berikut dan tentukan apakah ini adalah perintah admin untuk melakukan salah satu aksi berikut di server Discord:

1. UBAH WARNA ROLE: Format: {"action":"change_role_color","roleName":"nama role","hexColor":"#RRGGBB"}
2. GANTI NICKNAME: Format: {"action":"change_nickname","targetUserId":"ID user","newNickname":"nama baru"}

[MODERASI]
3. KICK MEMBER: Mengeluarkan member. Format: {"action":"kick_member","targetUserId":"ID user","reason":"alasan opsional"}
4. BAN MEMBER: Memblokir permanen. Format: {"action":"ban_member","targetUserId":"ID user","reason":"alasan opsional"}
5. TIMEOUT MEMBER: Mute sementara. Format: {"action":"timeout_member","targetUserId":"ID user","durationMinutes":angka_menit}

[ROLE]
6. BUAT ROLE: Format: {"action":"create_role","roleName":"nama role","hexColor":"#RRGGBB"}
7. BERI ROLE: Format: {"action":"assign_role","targetUserId":"ID user","roleName":"nama role"}
8. PINDAH URUTAN ROLE: Format: {"action":"move_role","roleName":"nama role","direction":"up/down","amount":angka}
9. HAPUS ROLE: Menghapus role dari server. Format: {"action":"delete_role","roleName":"nama role"}
10. CABUT ROLE: Mencabut role dari member. Format: {"action":"remove_role","targetUserId":"ID user","roleName":"nama role"}
11. LIST ROLE MEMBERS: Cek siapa saja yang punya role ini. Format: {"action":"list_role_members","roleName":"nama role"}

[VOICE]
12. DISCONNECT VOICE: Format: {"action":"voice_disconnect","targetUserId":"ID user"}
13. MUTE VOICE: Format: {"action":"voice_mute","targetUserId":"ID user"}
14. UNMUTE VOICE: Format: {"action":"voice_unmute","targetUserId":"ID user"}
15. DEAFEN VOICE: Membuat user tidak bisa mendengar. Format: {"action":"voice_deafen","targetUserId":"ID user"}
16. MOVE VOICE: Memindahkan channel. Format: {"action":"voice_move","targetUserId":"ID user","channelName":"nama channel tujuan"}

[CHANNEL & KATEGORI]
17. BUAT CHANNEL: Format: {"action":"create_channel","channelName":"nama","type":"text/voice/category"}
18. HAPUS CHANNEL: Format: {"action":"delete_channel","channelName":"nama"}
19. KUNCI/IZIN CHANNEL: Membatasi izin. Format: {"action":"edit_channel_permissions","channelName":"nama","targetRoleName":"nama role atau everyone","allow":"read/write/none"}

[PESAN]
20. HAPUS PESAN: Format: {"action":"delete_messages","amount":angka_jumlah_pesan}
21. PIN PESAN: Menyematkan pesan. Format: {"action":"pin_message"}
22. MENTION MASSAL: Format: {"action":"mention_mass","type":"everyone/here"}

[SERVER]
23. AUDIT LOG: Melihat riwayat admin. Format: {"action":"view_audit_log"}
24. UNDANGAN (INVITE): Format: {"action":"manage_invites","subAction":"create/delete"}

[JADWAL]
25. JADWALKAN PESAN: Mengirim pesan pada jam tertentu di hari ini (SEKALI saja, TIDAK berulang). User bilang misalnya "ucapin selamat siang jam 12", "kirim pesan jam 14:30", "nanti jam 8 bilang selamat pagi". Format: {"action":"schedule_message","time":"HH:MM","messageContent":"isi pesan yang akan dikirim","channelName":"nama channel tujuan (opsional, kosongkan jika tidak disebut)"}

[VOICE INVITE DM]
26. KIRIM DM AJAKAN JOIN VOICE: Mengirim DM ke member agar bergabung ke voice channel. Bisa ke satu orang (mention) atau semua orang (everyone). Contoh: "suruh @Budi masuk vc", "ajak everyone join voice Lounge", "dm @Budi gabung voice", "panggil semua masuk vc". Format: {"action":"voice_invite_dm","targetUserId":"ID user atau 'everyone'","channelName":"nama voice channel tujuan (opsional, kosongkan jika tidak disebut)"}
- Jika user bilang "semua", "all", "semuanya", atau "everyone", set targetUserId = "everyone".
- Jika user mention seseorang seperti <@ID>, extract ID-nya sebagai targetUserId.

Balas HANYA dengan JSON ARRAY berisi aksi-aksi yang diminta (bisa lebih dari satu).
Jika TIDAK terdeteksi perintah admin apapun, balas dengan array kosong: []

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
        maxOutputTokens: 800,
        temperature: 0.1,
      }
    });

    const aiText = response.text.trim();
    // Extract JSON array from response (handle markdown code blocks)
    const jsonMatch = aiText.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return null;

    const parsedArray = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsedArray) || parsedArray.length === 0) return null;
    
    // Validate based on action type
    const validActions = [];
    for (const parsed of parsedArray) {
      if (!parsed || !parsed.action) continue;
      
      switch (parsed.action) {
        case 'change_role_color':
          if (parsed.roleName && parsed.hexColor) {
            const hexValid = /^#[0-9A-Fa-f]{6}$/.test(parsed.hexColor);
            if (hexValid) {
              validActions.push({ action: 'change_role_color', roleName: parsed.roleName, hexColor: parsed.hexColor.toUpperCase() });
            }
          }
          break;
        case 'change_nickname':
          if (parsed.targetUserId && parsed.newNickname) {
            validActions.push({ action: 'change_nickname', targetUserId: parsed.targetUserId, newNickname: parsed.newNickname });
          }
          break;
        case 'kick_member':
          if (parsed.targetUserId) validActions.push({ action: 'kick_member', targetUserId: parsed.targetUserId, reason: parsed.reason });
          break;
        case 'ban_member':
          if (parsed.targetUserId) validActions.push({ action: 'ban_member', targetUserId: parsed.targetUserId, reason: parsed.reason });
          break;
        case 'timeout_member':
          if (parsed.targetUserId && parsed.durationMinutes) validActions.push({ action: 'timeout_member', targetUserId: parsed.targetUserId, durationMinutes: parsed.durationMinutes });
          break;
        case 'create_role':
          if (parsed.roleName) validActions.push({ action: 'create_role', roleName: parsed.roleName, hexColor: parsed.hexColor });
          break;
        case 'assign_role':
          if (parsed.targetUserId && parsed.roleName) validActions.push({ action: 'assign_role', targetUserId: parsed.targetUserId, roleName: parsed.roleName });
          break;
        case 'move_role':
          if (parsed.roleName && parsed.direction) validActions.push({ action: 'move_role', roleName: parsed.roleName, direction: parsed.direction, amount: parsed.amount || 1 });
          break;
        case 'delete_role':
          if (parsed.roleName) validActions.push({ action: 'delete_role', roleName: parsed.roleName });
          break;
        case 'remove_role':
          if (parsed.targetUserId && parsed.roleName) validActions.push({ action: 'remove_role', targetUserId: parsed.targetUserId, roleName: parsed.roleName });
          break;
        case 'list_role_members':
          if (parsed.roleName) validActions.push({ action: 'list_role_members', roleName: parsed.roleName });
          break;
        case 'voice_disconnect':
          if (parsed.targetUserId) validActions.push({ action: 'voice_disconnect', targetUserId: parsed.targetUserId });
          break;
        case 'voice_mute':
          if (parsed.targetUserId) validActions.push({ action: 'voice_mute', targetUserId: parsed.targetUserId });
          break;
        case 'voice_unmute':
          if (parsed.targetUserId) validActions.push({ action: 'voice_unmute', targetUserId: parsed.targetUserId });
          break;
        case 'voice_deafen':
          if (parsed.targetUserId) validActions.push({ action: 'voice_deafen', targetUserId: parsed.targetUserId });
          break;
        case 'voice_move':
          if (parsed.targetUserId && parsed.channelName) validActions.push({ action: 'voice_move', targetUserId: parsed.targetUserId, channelName: parsed.channelName });
          break;
        case 'create_channel':
          if (parsed.channelName && parsed.type) validActions.push({ action: 'create_channel', channelName: parsed.channelName, type: parsed.type });
          break;
        case 'delete_channel':
          if (parsed.channelName) validActions.push({ action: 'delete_channel', channelName: parsed.channelName });
          break;
        case 'edit_channel_permissions':
          if (parsed.channelName && parsed.targetRoleName && parsed.allow) validActions.push({ action: 'edit_channel_permissions', channelName: parsed.channelName, targetRoleName: parsed.targetRoleName, allow: parsed.allow });
          break;
        case 'delete_messages':
          if (parsed.amount) validActions.push({ action: 'delete_messages', amount: parsed.amount });
          break;
        case 'pin_message':
          validActions.push({ action: 'pin_message' });
          break;
        case 'mention_mass':
          if (parsed.type) validActions.push({ action: 'mention_mass', type: parsed.type });
          break;
        case 'view_audit_log':
          validActions.push({ action: 'view_audit_log' });
          break;
        case 'manage_invites':
          if (parsed.subAction) validActions.push({ action: 'manage_invites', subAction: parsed.subAction });
          break;
        case 'schedule_message':
          if (parsed.time && parsed.messageContent) validActions.push({ action: 'schedule_message', time: parsed.time, messageContent: parsed.messageContent, channelName: parsed.channelName || null });
          break;
      }
    }
    return validActions.length > 0 ? validActions : null;
  } catch (err) {
    console.error('⚠️ Admin action parse error:', err.message);
  }
  return null;
}

// Conversation history per user (in-memory, resets on bot restart)
const conversationHistory = new Map();
const MAX_HISTORY = 10; // Keep last 10 messages per user

// Scheduled tasks storage (in-memory, resets on bot restart)
const scheduledTasks = new Map();
let scheduledTaskCounter = 0;

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
const { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus, 
  VoiceConnectionStatus, 
  entersState,
  getVoiceConnection
} = require('@discordjs/voice');
const gTTS = require('node-gtts')('id');
const fs = require('fs');

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

client.once('clientReady', async () => {
  try {
    await client.user.setUsername('KEN').catch(() => {});
  } catch (e) {}
  console.log(`🤖 Bot KEN (${client.user.tag}) berhasil login & online!`);

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

function isProbablyEnglish(text) {
  const englishWords = /\b(the|be|to|of|and|a|in|that|have|i|it|for|not|on|with|he|as|you|do|at|this|but|his|by|from|they|we|say|her|she|or|an|will|my|one|all|would|there|their|what|so|up|out|if|about|who|get|which|go|me|when|make|can|like|time|no|just|him|know|take|people|into|year|your|good|some|could|them|see|other|than|then|now|look|only|come|its|over|think|also|back|after|use|two|how|our|work|first|well|way|even|new|want|because|any|these|give|day|most|us|sleep|song|songs|play|at|hour|night|tired|bed|music|why|how|should|could|would)\b/i;
  return englishWords.test(text);
}

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

        const adminActions = await parseAdminActionRequest(resolvedMessage);
        if (adminActions && adminActions.length > 0) {
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

          for (const adminAction of adminActions) {
            switch (adminAction.action) {
              // ===== KICK MEMBER =====
              case 'kick_member': {
                const targetMember = await resolveTargetMember(adminAction.targetUserId);
                if (!targetMember) {
                  await message.reply({ content: `😕 Maaf ${message.author.username}, aku nggak nemuin member itu di server ini.`, allowedMentions: { repliedUser: false } });
                  continue;
                }
                if (!targetMember.kickable) {
                  await message.reply({ content: `⚠️ Nggak bisa kick **${targetMember.displayName}**. Role/posisiku lebih rendah darinya.`, allowedMentions: { repliedUser: false } });
                  continue;
                }
                try {
                  await targetMember.kick(adminAction.reason || `Di-kick oleh KEN atas perintah ${message.author.username}`);
                  await message.reply({ content: `👟 Bye bye! **${targetMember.displayName}** sudah aku tendang dari server! 👋✨`, allowedMentions: { repliedUser: false } });
                } catch (err) {
                  console.error('❌ Kick error:', err.message);
                  await message.reply({ content: `❌ Gagal kick member. Error: ${err.message}`, allowedMentions: { repliedUser: false } });
                }
                break;
              }

              // ===== BAN MEMBER =====
              case 'ban_member': {
                const targetMember = await resolveTargetMember(adminAction.targetUserId);
                if (!targetMember) {
                  await message.reply({ content: `😕 Maaf ${message.author.username}, aku nggak nemuin member itu di server ini.`, allowedMentions: { repliedUser: false } });
                  continue;
                }
                if (!targetMember.bannable) {
                  await message.reply({ content: `⚠️ Nggak bisa ban **${targetMember.displayName}**. Role/posisiku lebih rendah darinya.`, allowedMentions: { repliedUser: false } });
                  continue;
                }
                try {
                  await targetMember.ban({ reason: adminAction.reason || `Di-ban oleh KEN atas perintah ${message.author.username}` });
                  await message.reply({ content: `🔨 BOOM! **${targetMember.displayName}** resmi diblokir (BAN) dari server! 🚫✨`, allowedMentions: { repliedUser: false } });
                } catch (err) {
                  console.error('❌ Ban error:', err.message);
                  await message.reply({ content: `❌ Gagal ban member. Error: ${err.message}`, allowedMentions: { repliedUser: false } });
                }
                break;
              }

              // ===== TIMEOUT MEMBER =====
              case 'timeout_member': {
                const targetMember = await resolveTargetMember(adminAction.targetUserId);
                if (!targetMember) {
                  await message.reply({ content: `😕 Maaf ${message.author.username}, aku nggak nemuin member itu di server ini.`, allowedMentions: { repliedUser: false } });
                  continue;
                }
                if (!targetMember.moderatable) {
                  await message.reply({ content: `⚠️ Nggak bisa timeout **${targetMember.displayName}**. Role/posisiku lebih rendah darinya.`, allowedMentions: { repliedUser: false } });
                  continue;
                }
                try {
                  const durationMs = parseInt(adminAction.durationMinutes) * 60 * 1000;
                  await targetMember.timeout(durationMs, `Timeout oleh KEN atas perintah ${message.author.username}`);
                  await message.reply({ content: `⏳ Ssshh! **${targetMember.displayName}** sudah kena timeout selama ${adminAction.durationMinutes} menit. 🤫✨`, allowedMentions: { repliedUser: false } });
                } catch (err) {
                  console.error('❌ Timeout error:', err.message);
                  await message.reply({ content: `❌ Gagal timeout member. Error: ${err.message}`, allowedMentions: { repliedUser: false } });
                }
                break;
              }

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
                  continue;
                }
                if (role.managed) {
                  await message.reply({ 
                    content: `⚠️ Maaf ${message.author.username}, role "**${role.name}**" itu role bawaan integrasi/bot, aku nggak bisa ubah warnanya 😅`, 
                    allowedMentions: { repliedUser: false } 
                  });
                  continue;
                }
                const botMember = guild.members.cache.get(client.user.id);
                if (botMember && role.position >= botMember.roles.highest.position) {
                  await message.reply({ 
                    content: `⚠️ Role "**${role.name}**" posisinya lebih tinggi dari role aku, jadi aku nggak bisa ubah warnanya. Coba pindahkan role KEN ke atas ya ${message.author.username}~ 💕`, 
                    allowedMentions: { repliedUser: false } 
                  });
                  continue;
                }
                try {
                  const oldColor = role.hexColor;
                  await role.setColor(hexColor, `Diubah oleh KEN atas permintaan ${message.author.username}`);
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
                break;
              }

              // ===== CHANGE NICKNAME =====
              case 'change_nickname': {
                const targetMember = await resolveTargetMember(adminAction.targetUserId);
                if (!targetMember) {
                  await message.reply({ 
                    content: `😕 Maaf ${message.author.username}, aku nggak nemuin member dengan ID/nama "**${adminAction.targetUserId}**" di server ini 💕`, 
                    allowedMentions: { repliedUser: false } 
                  });
                  continue;
                }
                try {
                  const oldNick = targetMember.displayName;
                  await targetMember.setNickname(adminAction.newNickname, `Diubah oleh KEN atas permintaan ${message.author.username}`);
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
                break;
              }

              // ===== VOICE DISCONNECT =====
              case 'voice_disconnect': {
                const targetMember = await resolveTargetMember(adminAction.targetUserId);
                if (!targetMember) {
                  await message.reply({ 
                    content: `😕 Maaf ${message.author.username}, aku nggak nemuin member "**${adminAction.targetUserId}**" di server ini 💕`, 
                    allowedMentions: { repliedUser: false } 
                  });
                  continue;
                }
                if (!targetMember.voice.channel) {
                  await message.reply({ 
                    content: `⚠️ **${targetMember.displayName}** lagi nggak ada di voice channel manapun, ${message.author.username}. Nggak bisa di-disconnect~ 😅`, 
                    allowedMentions: { repliedUser: false } 
                  });
                  continue;
                }
                try {
                  const vcName = targetMember.voice.channel.name;
                  await targetMember.voice.disconnect(`Disconnect oleh KEN atas permintaan ${message.author.username}`);
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
                break;
              }

              // ===== VOICE MUTE =====
              case 'voice_mute': {
                const targetMember = await resolveTargetMember(adminAction.targetUserId);
                if (!targetMember) {
                  await message.reply({ 
                    content: `😕 Maaf ${message.author.username}, aku nggak nemuin member "**${adminAction.targetUserId}**" di server ini 💕`, 
                    allowedMentions: { repliedUser: false } 
                  });
                  continue;
                }
                if (!targetMember.voice.channel) {
                  await message.reply({ 
                    content: `⚠️ **${targetMember.displayName}** lagi nggak ada di voice channel manapun, ${message.author.username}. Nggak bisa di-mute~ 😅`, 
                    allowedMentions: { repliedUser: false } 
                  });
                  continue;
                }
                try {
                  await targetMember.voice.setMute(true, `Muted oleh KEN atas permintaan ${message.author.username}`);
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
                break;
              }

              // ===== VOICE UNMUTE =====
              case 'voice_unmute': {
                const targetMember = await resolveTargetMember(adminAction.targetUserId);
                if (!targetMember) {
                  await message.reply({ 
                    content: `😕 Maaf ${message.author.username}, aku nggak nemuin member "**${adminAction.targetUserId}**" di server ini 💕`, 
                    allowedMentions: { repliedUser: false } 
                  });
                  continue;
                }
                if (!targetMember.voice.channel) {
                  await message.reply({ 
                    content: `⚠️ **${targetMember.displayName}** lagi nggak ada di voice channel manapun, ${message.author.username}. Nggak bisa di-unmute~ 😅`, 
                    allowedMentions: { repliedUser: false } 
                  });
                  continue;
                }
                try {
                  await targetMember.voice.setMute(false, `Unmuted oleh KEN atas permintaan ${message.author.username}`);
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
                break;
              }

              // ===== CREATE ROLE =====
              case 'create_role': {
                const { roleName, hexColor } = adminAction;
                try {
                  const newRole = await guild.roles.create({
                    name: roleName,
                    colors: hexColor || undefined,
                    reason: `Dibuat oleh KEN atas permintaan ${message.author.username}`
                  });
                  // Automatically update mentionedRoles cache so subsequent actions in the same array can find it!
                  mentionedRoles.set(newRole.name.toLowerCase(), newRole);
                  await message.reply({ 
                    content: `✅ Siap ${message.author.username}! Aku sudah buat role baru bernama **${newRole.name}** ✨`, 
                    allowedMentions: { repliedUser: false } 
                  });
                } catch (err) {
                  console.error('❌ Create role error:', err.message);
                  await message.reply({ 
                    content: `❌ Gagal buat role "**${roleName}**", ${message.author.username}. Error: ${err.message} 😢`, 
                    allowedMentions: { repliedUser: false } 
                  });
                }
                break;
              }

              // ===== ASSIGN ROLE =====
              case 'assign_role': {
                const targetMember = await resolveTargetMember(adminAction.targetUserId);
                if (!targetMember) {
                  await message.reply({ 
                    content: `😕 Maaf ${message.author.username}, aku nggak nemuin member "**${adminAction.targetUserId}**" di server ini 💕`, 
                    allowedMentions: { repliedUser: false } 
                  });
                  continue;
                }
                const { roleName } = adminAction;
                // Fetch again to ensure newly created roles are found if not in cache
                let role = mentionedRoles.get(roleName.toLowerCase()) 
                  || guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase())
                  || guild.roles.cache.get(roleName);
                if (!role) {
                  await message.reply({ 
                    content: `😕 Maaf ${message.author.username}, aku nggak nemuin role bernama "**${roleName}**" di server ini. 💕`, 
                    allowedMentions: { repliedUser: false } 
                  });
                  continue;
                }
                try {
                  await targetMember.roles.add(role, `Diberikan oleh KEN atas permintaan ${message.author.username}`);
                  await message.reply({ 
                    content: `✅ Done ${message.author.username}! Aku sudah kasih role **${role.name}** ke **${targetMember.displayName}** 🎭✨`, 
                    allowedMentions: { repliedUser: false } 
                  });
                } catch (err) {
                  console.error('❌ Assign role error:', err.message);
                  await message.reply({ 
                    content: `❌ Gagal ngasih role, ${message.author.username}. Mungkin posisiku lebih rendah dari role itu. Error: ${err.message} 😢`, 
                    allowedMentions: { repliedUser: false } 
                  });
                }
                break;
              }

              // ===== MOVE ROLE =====
              case 'move_role': {
                const { roleName, direction, amount } = adminAction;
                let role = mentionedRoles.get(roleName.toLowerCase()) 
                  || guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase())
                  || guild.roles.cache.get(roleName);
                if (!role) {
                  await message.reply({ 
                    content: `😕 Maaf ${message.author.username}, aku nggak nemuin role bernama "**${roleName}**" di server ini. 💕`, 
                    allowedMentions: { repliedUser: false } 
                  });
                  continue;
                }
                try {
                  const botMember = guild.members.cache.get(client.user.id);
                  let newPos;
                  
                  if (amount >= 999 && direction.toLowerCase() === 'up') {
                     // Paling atas: Tepat di bawah role KEN
                     newPos = botMember.roles.highest.position - 1;
                  } else {
                     const currentPos = role.position;
                     const changeAmount = parseInt(amount) || 1;
                     newPos = direction.toLowerCase() === 'up' ? currentPos + changeAmount : currentPos - changeAmount;
                  }
                  
                  await role.setPosition(newPos, { reason: `Dipindah oleh KEN atas permintaan ${message.author.username}` });
                  await message.reply({ 
                    content: `✅ Siap ${message.author.username}! Urutan role **${role.name}** sudah aku geser posisinya 🔃✨`, 
                    allowedMentions: { repliedUser: false } 
                  });
                } catch (err) {
                  console.error('❌ Move role error:', err.message);
                  await message.reply({ 
                    content: `❌ Gagal geser posisi role "**${role.name}**", ${message.author.username}. Error: ${err.message} 😢`, 
                    allowedMentions: { repliedUser: false } 
                  });
                }
                break;
              }

              // ===== DELETE ROLE =====
              case 'delete_role': {
                const { roleName } = adminAction;
                let role = mentionedRoles.get(roleName.toLowerCase()) 
                  || guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase())
                  || guild.roles.cache.get(roleName);
                if (!role) {
                  await message.reply({ content: `😕 Nggak nemu role "**${roleName}**" nih.`, allowedMentions: { repliedUser: false } });
                  continue;
                }
                try {
                  await role.delete(`Dihapus oleh KEN atas perintah ${message.author.username}`);
                  await message.reply({ content: `🗑️ Sip! Role **${role.name}** sudah aku hapus dari server.`, allowedMentions: { repliedUser: false } });
                } catch (err) {
                  console.error('❌ Delete role error:', err.message);
                  await message.reply({ content: `❌ Gagal hapus role. Error: ${err.message}`, allowedMentions: { repliedUser: false } });
                }
                break;
              }

              // ===== REMOVE ROLE =====
              case 'remove_role': {
                const targetMember = await resolveTargetMember(adminAction.targetUserId);
                if (!targetMember) {
                  await message.reply({ content: `😕 Nggak nemu member itu.`, allowedMentions: { repliedUser: false } });
                  continue;
                }
                const { roleName } = adminAction;
                let role = mentionedRoles.get(roleName.toLowerCase()) || guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase());
                if (!role) {
                  await message.reply({ content: `😕 Nggak nemu role "**${roleName}**".`, allowedMentions: { repliedUser: false } });
                  continue;
                }
                try {
                  await targetMember.roles.remove(role, `Dicabut oleh KEN atas perintah ${message.author.username}`);
                  await message.reply({ content: `✅ Role **${role.name}** sudah aku cabut dari **${targetMember.displayName}**.`, allowedMentions: { repliedUser: false } });
                } catch (err) {
                  console.error('❌ Remove role error:', err.message);
                  await message.reply({ content: `❌ Gagal cabut role. Error: ${err.message}`, allowedMentions: { repliedUser: false } });
                }
                break;
              }

              // ===== VOICE DEAFEN =====
              case 'voice_deafen': {
                const targetMember = await resolveTargetMember(adminAction.targetUserId);
                if (!targetMember || !targetMember.voice.channel) {
                  await message.reply({ content: `⚠️ Member nggak ketemu atau lagi nggak di voice channel.`, allowedMentions: { repliedUser: false } });
                  continue;
                }
                try {
                  await targetMember.voice.setDeaf(true, `Deafen oleh KEN atas perintah ${message.author.username}`);
                  await message.reply({ content: `🎧🔇 **${targetMember.displayName}** sudah aku deafen di voice channel!`, allowedMentions: { repliedUser: false } });
                } catch (err) {
                  await message.reply({ content: `❌ Gagal deafen. Error: ${err.message}`, allowedMentions: { repliedUser: false } });
                }
                break;
              }

              // ===== VOICE MOVE =====
              case 'voice_move': {
                const targetMember = await resolveTargetMember(adminAction.targetUserId);
                if (!targetMember || !targetMember.voice.channel) {
                  await message.reply({ content: `⚠️ Member nggak ketemu atau lagi nggak di voice channel.`, allowedMentions: { repliedUser: false } });
                  continue;
                }
                const destChannel = guild.channels.cache.find(c => c.isVoiceBased() && c.name.toLowerCase().includes(adminAction.channelName.toLowerCase()));
                if (!destChannel) {
                  await message.reply({ content: `😕 Nggak nemu voice channel yang mirip "${adminAction.channelName}".`, allowedMentions: { repliedUser: false } });
                  continue;
                }
                try {
                  await targetMember.voice.setChannel(destChannel, `Dipindah oleh KEN atas perintah ${message.author.username}`);
                  await message.reply({ content: `🚀 Wush! **${targetMember.displayName}** sudah kupindah ke **${destChannel.name}**.`, allowedMentions: { repliedUser: false } });
                } catch (err) {
                  await message.reply({ content: `❌ Gagal pindah member. Error: ${err.message}`, allowedMentions: { repliedUser: false } });
                }
                break;
              }

              // ===== CREATE CHANNEL =====
              case 'create_channel': {
                try {
                  const typeInt = adminAction.type === 'voice' ? 2 : adminAction.type === 'category' ? 4 : 0;
                  const newChan = await guild.channels.create({ name: adminAction.channelName, type: typeInt, reason: `Dibuat oleh KEN atas perintah ${message.author.username}` });
                  await message.reply({ content: `✅ Channel baru **${newChan.name}** berhasil dibuat!`, allowedMentions: { repliedUser: false } });
                } catch (err) {
                  await message.reply({ content: `❌ Gagal buat channel. Error: ${err.message}`, allowedMentions: { repliedUser: false } });
                }
                break;
              }

              // ===== DELETE CHANNEL =====
              case 'delete_channel': {
                const chan = guild.channels.cache.find(c => c.name.toLowerCase() === adminAction.channelName.toLowerCase());
                if (!chan) {
                  await message.reply({ content: `😕 Nggak nemu channel "**${adminAction.channelName}**".`, allowedMentions: { repliedUser: false } });
                  continue;
                }
                try {
                  const name = chan.name;
                  await chan.delete(`Dihapus oleh KEN atas perintah ${message.author.username}`);
                  await message.reply({ content: `🗑️ Channel **${name}** sudah rata dengan tanah!`, allowedMentions: { repliedUser: false } });
                } catch (err) {
                  await message.reply({ content: `❌ Gagal hapus channel. Error: ${err.message}`, allowedMentions: { repliedUser: false } });
                }
                break;
              }

              // ===== EDIT CHANNEL PERMS =====
              case 'edit_channel_permissions': {
                const chan = guild.channels.cache.find(c => c.name.toLowerCase() === adminAction.channelName.toLowerCase());
                let targetRole = guild.roles.cache.find(r => r.name.toLowerCase() === adminAction.targetRoleName.toLowerCase());
                if (adminAction.targetRoleName.toLowerCase() === 'everyone') targetRole = guild.roles.everyone;
                
                if (!chan || !targetRole) {
                  await message.reply({ content: `😕 Nggak nemu channel atau role-nya.`, allowedMentions: { repliedUser: false } });
                  continue;
                }
                try {
                  const options = {};
                  if (adminAction.allow === 'none' || adminAction.allow === 'read') options[PermissionFlagsBits.SendMessages] = false;
                  if (adminAction.allow === 'none') options[PermissionFlagsBits.ViewChannel] = false;
                  if (adminAction.allow === 'read') options[PermissionFlagsBits.ViewChannel] = true;
                  if (adminAction.allow === 'write') {
                    options[PermissionFlagsBits.ViewChannel] = true;
                    options[PermissionFlagsBits.SendMessages] = true;
                  }
                  await chan.permissionOverwrites.edit(targetRole, options);
                  await message.reply({ content: `🔒 Izin channel **${chan.name}** untuk role **${targetRole.name}** sudah diupdate.`, allowedMentions: { repliedUser: false } });
                } catch (err) {
                  await message.reply({ content: `❌ Gagal update izin. Error: ${err.message}`, allowedMentions: { repliedUser: false } });
                }
                break;
              }

              // ===== DELETE MESSAGES =====
              case 'delete_messages': {
                try {
                  const count = Math.min(parseInt(adminAction.amount) || 1, 100);
                  await message.channel.bulkDelete(count + 1, true); // +1 to include the command message itself
                  const rep = await message.channel.send(`🧹 **${count}** pesan terakhir telah disapu bersih!`);
                  setTimeout(() => rep.delete().catch(()=>{}), 3000);
                } catch (err) {
                  await message.reply({ content: `❌ Gagal hapus pesan (mungkin pesannya lebih dari 14 hari).`, allowedMentions: { repliedUser: false } });
                }
                break;
              }

              // ===== PIN MESSAGE =====
              case 'pin_message': {
                try {
                  if (message.reference) {
                    const refMsg = await message.channel.messages.fetch(message.reference.messageId);
                    await refMsg.pin();
                    await message.reply({ content: `📌 Pesannya sudah aku pin!`, allowedMentions: { repliedUser: false } });
                  } else {
                    await message.reply({ content: `⚠️ Kamu harus me-reply pesan yang ingin di-pin ya!`, allowedMentions: { repliedUser: false } });
                  }
                } catch (err) {
                  await message.reply({ content: `❌ Gagal nge-pin. Error: ${err.message}`, allowedMentions: { repliedUser: false } });
                }
                break;
              }

              // ===== MENTION MASS =====
              case 'mention_mass': {
                try {
                  const type = adminAction.type === 'everyone' ? '@everyone' : '@here';
                  await message.channel.send(`📣 Pengumuman dari <@${message.author.id}> untuk ${type}!`);
                } catch (err) {
                  console.error(err);
                }
                break;
              }

              // ===== VIEW AUDIT LOG =====
              case 'view_audit_log': {
                try {
                  const logs = await guild.fetchAuditLogs({ limit: 5 });
                  const entries = logs.entries.map(e => `- **${e.executor?.username}** melakukan **${e.actionType}** pada ${e.target?.username || e.target?.name || 'sesuatu'}`).join('\n');
                  await message.reply({ content: `📜 **5 Audit Log Terakhir:**\n${entries || 'Tidak ada log.'}`, allowedMentions: { repliedUser: false } });
                } catch (err) {
                  await message.reply({ content: `❌ Gagal baca audit log (Mungkin aku ga punya izin View Audit Log).`, allowedMentions: { repliedUser: false } });
                }
                break;
              }

              // ===== MANAGE INVITES =====
              case 'manage_invites': {
                try {
                  if (adminAction.subAction === 'create') {
                    const invite = await message.channel.createInvite({ maxAge: 86400, maxUses: 5, unique: true });
                    await message.reply({ content: `🎟️ Ini link undangannya (berlaku 1 hari, maks 5x pakai):\n${invite.url}`, allowedMentions: { repliedUser: false } });
                  } else {
                    const invites = await guild.invites.fetch();
                    let deleted = 0;
                    invites.forEach(inv => { inv.delete(); deleted++; });
                    await message.reply({ content: `🗑️ **${deleted}** link undangan aktif telah dihapus!`, allowedMentions: { repliedUser: false } });
                  }
                } catch (err) {
                  await message.reply({ content: `❌ Gagal kelola invite. Error: ${err.message}`, allowedMentions: { repliedUser: false } });
                }
                break;
              }

              // ===== LIST ROLE MEMBERS =====
              case 'list_role_members': {
                const { roleName } = adminAction;
                let role = mentionedRoles.get(roleName.toLowerCase()) 
                  || guild.roles.cache.find(r => r.name.toLowerCase() === roleName.toLowerCase())
                  || guild.roles.cache.get(roleName);
                if (!role) {
                  await message.reply({ content: `😕 Nggak nemu role "**${roleName}**" nih.`, allowedMentions: { repliedUser: false } });
                  continue;
                }
                try {
                  // Fetch all members if not fully cached
                  await guild.members.fetch();
                  const membersWithRole = role.members.map(m => m.user.username);
                  if (membersWithRole.length === 0) {
                    await message.reply({ content: `👻 Nggak ada satupun yang punya role **${role.name}**. Kosong!`, allowedMentions: { repliedUser: false } });
                  } else {
                    const memberList = membersWithRole.join(', ');
                    if (memberList.length > 1900) {
                       await message.reply({ content: `👥 Wow! Ada **${membersWithRole.length}** orang yang punya role **${role.name}**. Kebanyakan kalau disebutin satu-satu di sini! 😵‍💫`, allowedMentions: { repliedUser: false } });
                    } else {
                       await message.reply({ content: `👥 Ada **${membersWithRole.length}** orang yang punya role **${role.name}**:\n\`${memberList}\``, allowedMentions: { repliedUser: false } });
                    }
                  }
                } catch (err) {
                  console.error('❌ List role error:', err.message);
                  await message.reply({ content: `❌ Gagal ngambil data role. Error: ${err.message}`, allowedMentions: { repliedUser: false } });
                }
                break;
              }

              // ===== SCHEDULE MESSAGE (ONE-TIME) =====
              case 'schedule_message': {
                try {
                  const { time, messageContent, channelName } = adminAction;
                  const timeParts = time.split(':');
                  const hours = parseInt(timeParts[0]);
                  const minutes = parseInt(timeParts[1] || '0');
                  
                  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
                    await message.reply({ content: `⚠️ Format waktu "${time}" nggak valid nih. Pakai format HH:MM ya (contoh: 12:00) 😅`, allowedMentions: { repliedUser: false } });
                    break;
                  }
                  
                  const now = new Date();
                  const targetTime = new Date();
                  targetTime.setHours(hours, minutes, 0, 0);
                  
                  const delayMs = targetTime.getTime() - now.getTime();
                  if (delayMs <= 0) {
                    await message.reply({ content: `⚠️ Jam ${time} sudah lewat hari ini, ${message.author.username}. Coba jadwalkan untuk waktu yang belum lewat ya~ ⏰`, allowedMentions: { repliedUser: false } });
                    break;
                  }
                  
                  let targetChannel = message.channel;
                  if (channelName) {
                    const found = guild.channels.cache.find(c => c.isTextBased() && c.name.toLowerCase().includes(channelName.toLowerCase()));
                    if (found) targetChannel = found;
                  }
                  
                  const taskId = ++scheduledTaskCounter;
                  const timeout = setTimeout(async () => {
                    try {
                      await targetChannel.send(messageContent);
                      console.log(`✅ [SCHEDULE] Pesan terjadwal #${taskId} terkirim ke #${targetChannel.name}`);
                    } catch (sendErr) {
                      console.error(`❌ [SCHEDULE] Gagal kirim pesan #${taskId}:`, sendErr.message);
                    }
                    scheduledTasks.delete(taskId);
                  }, delayMs);
                  
                  scheduledTasks.set(taskId, { timeout, time, messageContent, channelName: targetChannel.name, scheduledBy: message.author.username });
                  
                  const previewMsg = messageContent.length > 100 ? messageContent.slice(0, 100) + '...' : messageContent;
                  const delayMinutes = Math.round(delayMs / 60000);
                  await message.reply({ 
                    content: `⏰ Siap ${message.author.username}! Pesan sudah dijadwalkan! 📝✨

🕐 **Jam:** ${time}
📍 **Channel:** #${targetChannel.name}
⏳ **Dikirim dalam:** ~${delayMinutes} menit lagi

> 💬 *"${previewMsg}"*

*(Pesan akan dikirim sekali saja, tidak berulang)*`, 
                    allowedMentions: { repliedUser: false } 
                  });
                } catch (err) {
                  console.error('❌ Schedule message error:', err.message);
                  await message.reply({ content: `❌ Gagal menjadwalkan pesan. Error: ${err.message}`, allowedMentions: { repliedUser: false } });
                }
                break;
              }

              // ===== VOICE INVITE DM =====
              case 'voice_invite_dm': {
                try {
                  // --- Determine target voice channel ---
                  let targetVC = null;
                  if (adminAction.channelName) {
                    targetVC = guild.channels.cache.find(c => c.isVoiceBased() && c.name.toLowerCase().includes(adminAction.channelName.toLowerCase()));
                  }
                  if (!targetVC && message.member?.voice?.channel) {
                    targetVC = message.member.voice.channel;
                  }
                  if (!targetVC) {
                    await message.reply({ content: `⚠️ Nggak bisa nemu voice channel tujuannya, ${message.author.username}. Coba masuk ke VC dulu atau sebutin nama channelnya ya~ 🎙️`, allowedMentions: { repliedUser: false } });
                    break;
                  }

                  // --- Build premium DM Embed ---
                  const inviteEmbed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setAuthor({ 
                      name: 'KEN Voice Invitation 🎙️', 
                      iconURL: client.user.displayAvatarURL({ dynamic: true }) 
                    })
                    .setTitle('✨ Yuk Gabung Voice Channel! 👋')
                    .setDescription(
                      `Halo! 🤗\n\n` +
                      `Kamu diajak oleh **${message.author.displayName || message.author.username}** untuk gabung ngobrol bareng di voice channel server **${guild.name}**!\n\n` +
                      `Yuk langsung join, ditunggu ya~ 💬🎶`
                    )
                    .addFields(
                      { name: '🔊 Voice Channel', value: `<#${targetVC.id}>`, inline: true },
                      { name: '👑 Pengundang', value: `<@${message.author.id}>`, inline: true },
                      { name: '🏠 Server', value: guild.name, inline: true }
                    )
                    .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }) || client.user.displayAvatarURL({ dynamic: true }))
                    .setFooter({ 
                      text: `KEN Assistant • ${guild.name}`, 
                      iconURL: guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL({ dynamic: true }) 
                    })
                    .setTimestamp();

                  const isEveryone = adminAction.targetUserId?.toLowerCase() === 'everyone';

                  if (isEveryone) {
                    // --- Send DM to all non-bot members ---
                    await message.reply({ content: `📨 Siap ${message.author.username}! Sedang mengirim DM ajakan ke semua warga server... ⏳`, allowedMentions: { repliedUser: false } });
                    
                    await guild.members.fetch();
                    const allMembers = guild.members.cache.filter(m => !m.user.bot && m.id !== message.author.id);
                    let successCount = 0;
                    let failCount = 0;

                    for (const [, member] of allMembers) {
                      try {
                        await member.send({ embeds: [inviteEmbed] });
                        successCount++;
                      } catch {
                        failCount++;
                      }
                      // Rate limit safety: 1 second delay between DMs
                      await new Promise(r => setTimeout(r, 1000));
                    }

                    const resultEmbed = new EmbedBuilder()
                      .setColor(successCount > 0 ? 0x57F287 : 0xED4245)
                      .setTitle('📊 Laporan Pengiriman DM Voice Invite')
                      .setDescription(
                        `Pengiriman DM ajakan join voice selesai!\n\n` +
                        `🔊 **Channel:** <#${targetVC.id}>`
                      )
                      .addFields(
                        { name: '✅ Berhasil', value: `**${successCount}** orang`, inline: true },
                        { name: '❌ Gagal (DM Tertutup)', value: `**${failCount}** orang`, inline: true },
                        { name: '📬 Total', value: `**${allMembers.size}** orang`, inline: true }
                      )
                      .setFooter({ text: `Diminta oleh ${message.author.username}` })
                      .setTimestamp();

                    await message.channel.send({ embeds: [resultEmbed] });
                  } else {
                    // --- Send DM to specific user ---
                    const targetMember = await resolveTargetMember(adminAction.targetUserId);
                    if (!targetMember) {
                      await message.reply({ content: `😕 Maaf ${message.author.username}, aku nggak nemuin member itu di server ini.`, allowedMentions: { repliedUser: false } });
                      break;
                    }
                    try {
                      await targetMember.send({ embeds: [inviteEmbed] });
                      await message.reply({ 
                        content: `✅ Siap ${message.author.username}! DM ajakan join voice ke **${targetMember.displayName}** sudah terkirim! 📨🎙️\n🔊 Channel: <#${targetVC.id}>`, 
                        allowedMentions: { repliedUser: false } 
                      });
                    } catch {
                      await message.reply({ 
                        content: `❌ Gagal kirim DM ke **${targetMember.displayName}**. Kemungkinan DM-nya tertutup/diblokir 😢`, 
                        allowedMentions: { repliedUser: false } 
                      });
                    }
                  }
                } catch (err) {
                  console.error('❌ Voice invite DM error:', err.message);
                  await message.reply({ content: `❌ Gagal mengirim DM ajakan voice. Error: ${err.message}`, allowedMentions: { repliedUser: false } });
                }
                break;
              }
            }
          }
          return; // Exit after processing all admin actions so AI doesn't reply again
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
      
      let userContext = `Current Context: The user you are chatting with is "${message.author.username}". `;
      if (isUserOwner) {
        userContext += 'They are Joe, your owner. ';
      } else if (isUserAdmin) {
        userContext += 'They are NOT Joe (not your owner), but they are an Administrator in this server. ';
      } else {
        userContext += 'They are NOT Joe (not your owner) and NOT an admin, just a regular member. ';
      }

      const userLang = isProbablyEnglish(userMessage) ? 'English' : 'Indonesian';
      userContext += `\nThe user's message is written in ${userLang}. You MUST reply in ${userLang} ONLY. Do not reply in any other language.`;

      const dynamicSystemPrompt = AI_SYSTEM_PROMPT + `\n\n` + userContext;

      const response = await geminiAI.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: contents,
        config: {
          systemInstruction: dynamicSystemPrompt,
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
                '### 🇮🇩 Bahasa Indonesia\n' +
                'Halo! Kami mendeteksi bahwa Anda memiliki role komunitas (seperti **the baddies** atau **the bros**) namun **belum melakukan verifikasi** (Membuat Kartu Perkenalan) di server **Kosan 1A**.\n\n' +
                'Untuk menjaga keamanan server, role tersebut telah **dilepas sementara**.\n\n' +
                '**Cara mendapatkan kembali role Anda:**\n' +
                '1. Pergi ke channel <#' + ROLE_CHANNEL_ID + '>\n' +
                '2. Klik tombol **"📝 Buat Kartu Perkenalan"**\n' +
                '3. Isi formulir perkenalan hingga selesai\n\n' +
                '---\n\n' +
                '### 🇬🇧 English\n' +
                'Hello! We detected that you have community roles (such as **the baddies** or **the bros**) but **have not verified** (Created an ID Card) in the **Kosan 1A** server.\n\n' +
                'To maintain server security, these roles have been **temporarily removed**.\n\n' +
                '**How to regain your roles:**\n' +
                '1. Go to the <#' + ROLE_CHANNEL_ID + '> channel\n' +
                '2. Click the **"📝 Buat Kartu Perkenalan"** button\n' +
                '3. Complete the introduction form'
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

// --- Voice Greeting & TTS System ---
const voiceQueues = new Map();

function cleanupVoiceState(guildId) {
  const state = voiceQueues.get(guildId);
  if (state) {
    if (state.timeout) {
      clearTimeout(state.timeout);
    }
    try {
      state.player.stop();
    } catch (e) {}
    try {
      state.connection.destroy();
    } catch (e) {}
    voiceQueues.delete(guildId);
    console.log(`🔊 [Voice] Cleaned up voice state and disconnected from guild ${guildId}`);
  }
}

async function processQueue(guildId) {
  const state = voiceQueues.get(guildId);
  if (!state) return;

  if (state.isPlaying) {
    console.log(`🔊 [Voice] Already playing, skipping processQueue for guild ${guildId}`);
    return;
  }

  if (state.queue.length === 0) {
    console.log(`🔊 [Voice] Queue is empty for guild ${guildId}`);
    if (state.timeout) {
      clearTimeout(state.timeout);
      state.timeout = null;
    }
    return;
  }

  if (state.timeout) {
    clearTimeout(state.timeout);
    state.timeout = null;
  }

  state.isPlaying = true;
  const item = state.queue.shift();
  const { text, channel } = item;

  const tempFilePath = path.join(__dirname, `tts_${guildId}_${Date.now()}.mp3`);
  console.log(`🔊 [Voice] Processing TTS queue. Text: "${text}", Channel: "${channel.name}"`);

  try {
    let connection = getVoiceConnection(guildId);
    if (!connection || connection.state.status === VoiceConnectionStatus.Destroyed || connection.joinConfig.channelId !== channel.id) {
      console.log(`🔊 [Voice] Creating voice connection to channel: ${channel.name} (${channel.id})`);
      connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guildId,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false
      });
      connection.subscribe(state.player);
      state.connection = connection;

      // Handle disconnect / kick
      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        console.log(`🔊 [Voice] Connection Disconnected for guild ${guildId}`);
        try {
          await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signalling, 5000),
            entersState(connection, VoiceConnectionStatus.Connecting, 5000),
          ]);
          console.log(`🔊 [Voice] Reconnected successfully for guild ${guildId}`);
        } catch (error) {
          console.log(`🔊 [Voice] Reconnection failed, cleaning up state for guild ${guildId}`);
          cleanupVoiceState(guildId);
        }
      });

      connection.on('stateChange', (oldState, newState) => {
        console.log(`🔊 [Voice] Connection state changed from ${oldState.status} to ${newState.status}`);
        if (newState.status === VoiceConnectionStatus.Destroyed) {
          cleanupVoiceState(guildId);
        }
      });
    }

    console.log(`🔊 [Voice] Waiting for connection to be ready...`);
    await entersState(connection, VoiceConnectionStatus.Ready, 5000);
    console.log(`🔊 [Voice] Connection is Ready!`);

    console.log(`🔊 [Voice] Saving TTS to file: ${tempFilePath}`);
    await new Promise((resolve, reject) => {
      gTTS.save(tempFilePath, text, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log(`🔊 [Voice] TTS file saved successfully.`);

    const resource = createAudioResource(tempFilePath);
    console.log(`🔊 [Voice] Playing audio resource...`);
    state.player.play(resource);

    const onStateChange = (oldState, newState) => {
      console.log(`🔊 [Voice] Player state changed from ${oldState.status} to ${newState.status}`);
      if (newState.status === AudioPlayerStatus.Idle) {
        state.player.removeListener('stateChange', onStateChange);
        
        fs.unlink(tempFilePath, (err) => {
          if (err && err.code !== 'ENOENT') {
            console.error(`⚠️ [Voice] Failed to delete temp file ${tempFilePath}:`, err);
          } else {
            console.log(`🔊 [Voice] Deleted temp file ${tempFilePath}`);
          }
        });

        state.isPlaying = false;
        processQueue(guildId);
      }
    };

    state.player.on('stateChange', onStateChange);

  } catch (error) {
    console.error(`❌ [Voice] Error in voice TTS playback:`, error);
    if (fs.existsSync(tempFilePath)) {
      fs.unlink(tempFilePath, () => {});
    }
    state.isPlaying = false;
    processQueue(guildId);
  }
}

function queueTTS(guildId, voiceChannel, text) {
  if (!voiceChannel) return;
  console.log(`🔊 [Voice] Queueing TTS: "${text}" for channel "${voiceChannel.name}"`);

  if (!voiceQueues.has(guildId)) {
    const player = createAudioPlayer();
    
    player.on('error', error => {
      console.error(`❌ [Voice] Audio Player error:`, error);
    });

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guildId,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });

    connection.subscribe(player);

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5000),
        ]);
      } catch (error) {
        cleanupVoiceState(guildId);
      }
    });

    connection.on('stateChange', (oldState, newState) => {
      if (newState.status === VoiceConnectionStatus.Destroyed) {
        cleanupVoiceState(guildId);
      }
    });

    voiceQueues.set(guildId, {
      queue: [],
      player: player,
      connection: connection,
      isPlaying: false,
      timeout: null
    });
  }

  const state = voiceQueues.get(guildId);
  state.queue.push({ text, channel: voiceChannel });
  processQueue(guildId);
}

client.on('voiceStateUpdate', async (oldState, newState) => {
  if (newState.member?.user.bot) return;

  const memberName = newState.member?.displayName || newState.member?.user.username || 'Seseorang';
  const guildId = newState.guild.id;

  // Case 1: Member joins voice channel
  if (!oldState.channelId && newState.channelId) {
    const voiceChannel = newState.channel;
    console.log(`🔊 [Voice] ${memberName} joined channel: ${voiceChannel?.name}`);
    queueTTS(guildId, voiceChannel, `halo ${memberName}, asik udah gabung nih!`);
  }

  // Case 2: Member leaves voice channel
  else if (oldState.channelId && !newState.channelId) {
    const voiceChannel = oldState.channel;
    console.log(`🔊 [Voice] ${memberName} left channel: ${voiceChannel?.name}`);
    
    const connection = getVoiceConnection(guildId);
    if (connection && connection.joinConfig.channelId === voiceChannel.id) {
      const activeMembers = voiceChannel.members.filter(m => !m.user.bot);
      if (activeMembers.size === 0) {
        cleanupVoiceState(guildId);
      } else {
        queueTTS(guildId, voiceChannel, `yah, ${memberName} pamit duluan.`);
      }
    }
  }

  // Case 3: Member moves voice channel
  else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
    const oldChannel = oldState.channel;
    const newChannel = newState.channel;
    console.log(`🔊 [Voice] ${memberName} moved from ${oldChannel?.name} to ${newChannel?.name}`);

    // If bot was in the old channel, check if it's now empty
    const connection = getVoiceConnection(guildId);
    if (connection && connection.joinConfig.channelId === oldChannel.id) {
      const activeMembersLeft = oldChannel.members.filter(m => !m.user.bot);
      if (activeMembersLeft.size > 0) {
        queueTTS(guildId, oldChannel, `${memberName} pindah channel tuh.`);
      }
    }

    // Announce joining the new channel
    queueTTS(guildId, newChannel, `eh ada ${memberName} ikutan gabung.`);
  }
});

client.login(process.env.DISCORD_TOKEN);
