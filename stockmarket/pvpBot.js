const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('./database');
const pet = require('./pet');
const economy = require('./economy');
const config = require('./config');
const petCard = require('./petCard');

const TIERS = [
  'BRONZE_V', 'BRONZE_IV', 'BRONZE_III', 'BRONZE_II', 'BRONZE_I',
  'SILVER_V', 'SILVER_IV', 'SILVER_III', 'SILVER_II', 'SILVER_I',
  'GOLD_V', 'GOLD_IV', 'GOLD_III', 'GOLD_II', 'GOLD_I',
  'PLATINUM_V', 'PLATINUM_IV', 'PLATINUM_III', 'PLATINUM_II', 'PLATINUM_I',
  'DIAMOND_V', 'DIAMOND_IV', 'DIAMOND_III', 'DIAMOND_II', 'DIAMOND_I',
  'MASTER', 'GRANDMASTER', 'LEGEND', 'IMMORTAL'
];

const TIER_TITLES = {
  GOLD_V: "⚔️ Gladiator Kuning",
  GOLD_IV: "⚔️ Gladiator Kuning",
  GOLD_III: "⚔️ Gladiator Kuning",
  GOLD_II: "⚔️ Gladiator Kuning",
  GOLD_I: "⚔️ Gladiator Kuning",
  PLATINUM_V: "🛡️ Iron Defender",
  PLATINUM_IV: "🛡️ Iron Defender",
  PLATINUM_III: "🛡️ Iron Defender",
  PLATINUM_II: "🛡️ Iron Defender",
  PLATINUM_I: "🛡️ Iron Defender",
  DIAMOND_V: "💎 Diamond Slayer",
  DIAMOND_IV: "💎 Diamond Slayer",
  DIAMOND_III: "💎 Diamond Slayer",
  DIAMOND_II: "💎 Diamond Slayer",
  DIAMOND_I: "💎 Diamond Slayer",
  MASTER: "🔥 Arena Master",
  GRANDMASTER: "👑 Grand Champion",
  LEGEND: "⚡ Divine Challenger",
  IMMORTAL: "✨ Immortal God"
};

const TIER_NAMES = {
  BRONZE_V: '🥉 Bronze V',
  BRONZE_IV: '🥉 Bronze IV',
  BRONZE_III: '🥉 Bronze III',
  BRONZE_II: '🥉 Bronze II',
  BRONZE_I: '🥉 Bronze I',
  SILVER_V: '🥈 Silver V',
  SILVER_IV: '🥈 Silver IV',
  SILVER_III: '🥈 Silver III',
  SILVER_II: '🥈 Silver II',
  SILVER_I: '🥈 Silver I',
  GOLD_V: '🥇 Gold V',
  GOLD_IV: '🥇 Gold IV',
  GOLD_III: '🥇 Gold III',
  GOLD_II: '🥇 Gold II',
  GOLD_I: '🥇 Gold I',
  PLATINUM_V: '💎 Platinum V',
  PLATINUM_IV: '💎 Platinum IV',
  PLATINUM_III: '💎 Platinum III',
  PLATINUM_II: '💎 Platinum II',
  PLATINUM_I: '💎 Platinum I',
  DIAMOND_V: '🔷 Diamond V',
  DIAMOND_IV: '🔷 Diamond IV',
  DIAMOND_III: '🔷 Diamond III',
  DIAMOND_II: '🔷 Diamond II',
  DIAMOND_I: '🔷 Diamond I',
  MASTER: '🔥 Master',
  GRANDMASTER: '👑 Grandmaster',
  LEGEND: '🐉 Legend',
  IMMORTAL: '✨ Immortal'
};

const COLORS = {
  BRONZE: 0x8D6E63,
  SILVER: 0xB0BEC5,
  GOLD: 0xFFD54F,
  PLATINUM: 0x4DD0E1,
  DIAMOND: 0x64B5F6,
  MASTER: 0xFF8A65,
  GRANDMASTER: 0xBA68C8,
  LEGEND: 0xFF1744,
  IMMORTAL: 0xFFD700
};

const ARENAS = [
  { key: 'VOLCANO', name: '🌋 Gunung Berapi (VOLCANO)', element: 'FIRE', desc: 'Pet berelemen FIRE mendapat +20% damage!' },
  { key: 'OCEAN', name: '🌊 Samudra Dalam (OCEAN)', element: 'WATER', desc: 'Pet berelemen WATER mendapat +20% damage!' },
  { key: 'FOREST', name: '🌲 Hutan Purba (FOREST)', element: 'EARTH', desc: 'Pet berelemen EARTH mendapat +20% damage!' },
  { key: 'DRAGON_DEN', name: '🐉 Sarang Naga (DRAGON_DEN)', element: 'DRAGON', desc: 'Pet berelemen DRAGON mendapat +20% damage!' }
];

function getFriendlyTierName(tierKey) {
  return TIER_NAMES[tierKey] || tierKey;
}

function getTierColor(tierKey) {
  const prefix = tierKey.split('_')[0];
  return COLORS[prefix] || 0x78909C;
}

/**
 * Mengambil atau membuat state PvP untuk pet pemain
 */
function getOrCreatePvPState(userId, guildId, petName) {
  let state = db.get(
    'SELECT * FROM user_pet_pvp_bot WHERE user_id = ? AND guild_id = ? AND pet_name = ?',
    [userId, guildId, petName]
  );

  if (!state) {
    db.run(
      `INSERT INTO user_pet_pvp_bot (user_id, guild_id, pet_name, tier, points, daily_attempts, last_attempt_date, last_battle_at)
       VALUES (?, ?, ?, 'BRONZE_V', 0, 0, '', 0)`,
      [userId, guildId, petName]
    );
    state = db.get(
      'SELECT * FROM user_pet_pvp_bot WHERE user_id = ? AND guild_id = ? AND pet_name = ?',
      [userId, guildId, petName]
    );
  }

  // Reset kuota harian jika hari telah berganti
  const todayStr = new Date().toLocaleDateString('id-ID');
  if (state.last_attempt_date !== todayStr) {
    db.run(
      'UPDATE user_pet_pvp_bot SET daily_attempts = 0, last_attempt_date = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?',
      [todayStr, userId, guildId, petName]
    );
    state.daily_attempts = 0;
    state.last_attempt_date = todayStr;
  }

  return state;
}

/**
 * Menghasilkan statistik bot secara dinamis berdasarkan tier pemain saat ini dengan spesialisasi acak
 */
function generateBotForTier(tierKey, petObj = null) {
  const tierIndex = TIERS.indexOf(tierKey);
  // Starts at 1.30 for Bronze V, goes up to 2.42 for Immortal! (Significant increase in difficulty)
  let scaleMultiplier = 1.30 + (tierIndex * 0.04); 

  let playerTotalStats = 0;
  if (petObj) {
    playerTotalStats = (petObj.stat_str || 0) + (petObj.stat_vit || 0) + (petObj.stat_def || 0) + (petObj.stat_dex || 0);
  }

  const basePoints = Math.max(15, playerTotalStats);
  const totalPoints = Math.round(basePoints * scaleMultiplier);

  const archetypes = ['TANKER', 'GLASS_CANNON', 'ASSASSIN', 'BALANCED'];
  const archetype = archetypes[Math.floor(Math.random() * archetypes.length)];

  // Tentukan trait untuk bot berdasarkan kasta liga
  let trait = '';
  let gacha_trait2 = '';

  if (tierIndex >= 10) { // Gold ke atas: Bot mendapatkan KEDUA trait tempur (WARRIOR & STURDY)
    trait = 'WARRIOR';
    gacha_trait2 = 'STURDY';
  } else { // Bronze & Silver: Bot mendapatkan trait tempur sesuai arketipe
    if (archetype === 'TANKER') {
      trait = 'STURDY';
    } else if (archetype === 'GLASS_CANNON' || archetype === 'ASSASSIN') {
      trait = 'WARRIOR';
    } else {
      trait = Math.random() < 0.5 ? 'STURDY' : 'WARRIOR';
    }
  }

  let str = 0, vit = 0, def = 0, dex = 0;

  if (archetype === 'TANKER') {
    vit = Math.round(totalPoints * 0.45);
    def = Math.round(totalPoints * 0.25);
    str = Math.round(totalPoints * 0.20);
    dex = totalPoints - (str + vit + def);
  } else if (archetype === 'GLASS_CANNON') {
    str = Math.round(totalPoints * 0.45);
    dex = Math.round(totalPoints * 0.30);
    vit = Math.round(totalPoints * 0.15);
    def = totalPoints - (str + dex + vit);
  } else if (archetype === 'ASSASSIN') {
    dex = Math.round(totalPoints * 0.45);
    str = Math.round(totalPoints * 0.35);
    vit = Math.round(totalPoints * 0.10);
    def = totalPoints - (str + dex + vit);
  } else {
    str = Math.round(totalPoints * 0.25);
    vit = Math.round(totalPoints * 0.25);
    def = Math.round(totalPoints * 0.25);
    dex = totalPoints - (str + vit + def);
  }

  str = Math.max(1, str);
  vit = Math.max(1, vit);
  def = Math.max(1, def);
  dex = Math.max(1, dex);

  const botTemplates = {
    TANKER: [
      { name: '🛡️ Ancient Iron Golem', type: 'GOLEM', element: 'EARTH' },
      { name: '🛡️ Old Mountain Turtle', type: 'TURTLE', element: 'EARTH' },
      { name: '🛡️ Deepsea Behemoth', type: 'BEHEMOTH', element: 'WATER' }
    ],
    GLASS_CANNON: [
      { name: '🔥 Phoenix Ember Sprite', type: 'PHOENIX', element: 'FIRE' },
      { name: '🔥 Infernal Volcano Dragon', type: 'DRAGON', element: 'FIRE' },
      { name: '🔥 Ifrit Fire Lord', type: 'IFRIT', element: 'FIRE' }
    ],
    ASSASSIN: [
      { name: '⚡ Shadow Swift Kit', type: 'CAT', element: 'DRAGON' },
      { name: '⚡ Storm Pegasus', type: 'PEGASUS', element: 'WATER' },
      { name: '⚡ Kirin Thunder Strike', type: 'KIRIN', element: 'FIRE' }
    ],
    BALANCED: [
      { name: '⚖️ Arena Recruit Slime', type: 'SLIME', element: 'EARTH' },
      { name: '⚖️ Siren Deepsea Guardian', type: 'SIREN', element: 'WATER' },
      { name: '⚖️ Kitsune Fox Warrior', type: 'KITSUNE', element: 'DRAGON' }
    ]
  };

  const templates = botTemplates[archetype];
  const template = templates[Math.floor(Math.random() * templates.length)];

  return {
    name: template.name,
    pet_type: template.type,
    gacha_element: template.element,
    archetype: archetype,
    stat_str: str,
    stat_vit: vit,
    stat_def: def,
    stat_dex: dex,
    tier: tierKey,
    trait: trait,
    gacha_trait2: gacha_trait2
  };
}

function getPvpStatsDescription(petObj, pvpState) {
  const maxHP = 100 + (petObj.stat_vit || 0) * 10;
  const baseAtk = 20 + (petObj.stat_str || 0) * 3;
  const defPercent = Math.min(75, (petObj.stat_def || 0) * 0.5);
  const critPercent = Math.min(40, (petObj.stat_dex || 0) * 0.5);

  const totalGymStats = (petObj.stat_str || 0) + (petObj.stat_vit || 0) + (petObj.stat_def || 0) + (petObj.stat_dex || 0);

  // Status Efek & Debuff Aktif
  const activeDebuffs = [];
  if ((petObj.hunger || 0) < 50) activeDebuffs.push('🍗 **Debuff Lapar** (ATK -20%)');
  if ((petObj.thirst || 0) < 50) activeDebuffs.push('💧 **Debuff Haus** (DEX -30%)');
  const nowUnix = Math.floor(Date.now() / 1000);
  if (petObj.curse_type === 'injured' && petObj.curse_until > nowUnix) {
    activeDebuffs.push('🤕 **Cedera Tempur** (Semua Stat -25%)');
  }
  const debuffText = activeDebuffs.length > 0 ? activeDebuffs.join(', ') : '✅ *Normal*';

  return `🏋️ **Statistik Tempur Arena (Berdasarkan Gym):**\n` +
         `• ❤️ **Max HP:** \`${maxHP} HP\` *(+10 per VIT)*\n` +
         `• ⚔️ **Base ATK:** \`${baseAtk} DMG\` *(+3 per STR)*\n` +
         `• 🛡️ **Damage Reduction:** \`${defPercent.toFixed(1)}%\` *(+0.5% per DEF, maks 75%)*\n` +
         `• ⚡ **Crit Chance:** \`${critPercent.toFixed(1)}%\` *(+0.5% per DEX, maks 40%)*\n` +
         `• 👟 **Total Gym Stats:** \`${totalGymStats} Poin\`\n` +
         `• 🔋 **Gym Fatigue:** \`${petObj.gym_fatigue || 0}/100%\` *(Maks 100% untuk latihan)*\n` +
         `• ✨ **Kondisi Fisik:** ${debuffText}\n` +
         `\n🏆 **Liga Progres PvP Bot:**\n` +
         `• 🌟 **Tier/Pangkat:** **${getFriendlyTierName(pvpState.tier)}**\n` +
         `• 📊 **Poin Liga:** **${pvpState.tier === 'IMMORTAL' ? `${pvpState.points} LP` : `${pvpState.points}/100 LP`}** *(Win +25, Lose -10)*\n` +
         `• 🥤 **Tantangan Harian:** **${pvpState.daily_attempts}/5** gratis terpakai hari ini.`;
}

async function showPvPArena(message, client, args = []) {
  const subAction = args[1] ? args[1].toLowerCase() : null;
  if (subAction === 'hof' || subAction === 'history' || subAction === 'juara') {
    return showPvPHallOfFame(message, client);
  }

  const { guildId, author } = message;
  const petObj = pet.getPet(author.id, guildId);

  if (!petObj) {
    return message.reply({ embeds: [new EmbedBuilder().setColor(0xFF3366).setDescription('❌ Anda tidak memiliki hewan peliharaan aktif!')] });
  }
  if (petObj.status === 'EGG') {
    return message.reply({ embeds: [new EmbedBuilder().setColor(0xFF3366).setDescription('❌ Pet Anda masih berupa telur! Tunggu menetas.')] });
  }
  if (petObj.status === 'DEAD') {
    return message.reply({ embeds: [new EmbedBuilder().setColor(0xFF3366).setDescription('❌ Pet Anda sudah meninggal! Hidupkan kembali terlebih dahulu.')] });
  }

  const pvpState = getOrCreatePvPState(author.id, guildId, petObj.pet_name);

  let sodaQty = 0;
  try {
    const sodaRow = db.get("SELECT quantity FROM pet_inventory WHERE user_id = ? AND guild_id = ? AND item_id = 'SODA_ENERGY'", [author.id, guildId]);
    if (sodaRow) sodaQty = sodaRow.quantity;
  } catch(e) {}

  const embed = new EmbedBuilder()
    .setColor(getTierColor(pvpState.tier))
    .setAuthor({ name: `🏛️ PVP BOT ARENA — ${author.username}`, iconURL: author.displayAvatarURL({ dynamic: true }) })
    .setTitle(`🐾 [${getFriendlyTierName(pvpState.tier)}] ${petObj.pet_name} — Arena Tangga`)
    .setDescription(
      `Selamat datang di Arena Tangga PvP Bot!\n` +
      `Latih kekuatan pet Anda di Gym lalu kalahkan bot perwakilan di setiap kasta pangkat untuk membuktikan ketangguhan pet Anda!\n\n` +
      getPvpStatsDescription(petObj, pvpState) + `\n` +
      `🎒 **Soda Energi di Kandang:** \`${sodaQty} Pcs\` *(Dipakai jika kuota harian habis)*\n\n` +
      `*Kemenangan memberikan **XP Pet** melimpah serta menaikkan Pangkat Anda!*`
    )
    .setFooter({ text: 'PvP Bot Arena • Kekuatan didasarkan pada tingkat Gym' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`pvpbot_challenge_${petObj.pet_name}`)
      .setLabel('⚔️ Tantang Bot')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`pvpbot_leaderboard`)
      .setLabel('🏆 Papan Peringkat')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`pvpbot_hof`)
      .setLabel('🏅 Hall of Fame')
      .setStyle(ButtonStyle.Success)
  );

  return message.reply({ embeds: [embed], components: [row] });
}

async function showPvPHallOfFame(messageOrInteraction, client) {
  const isInteraction = typeof messageOrInteraction.reply === 'function' && 
                        typeof messageOrInteraction.isRepliable === 'function' && 
                        messageOrInteraction.isRepliable();
  
  try {
    const list = db.all("SELECT * FROM pvp_season_history ORDER BY season_number DESC, rank_number ASC LIMIT 30");
    
    const embed = new EmbedBuilder()
      .setColor(0x00FFBB)
      .setTitle('🏅 HALL OF FAME — JUARA SEASON PVP BOT')
      .setTimestamp();

    if (!list || list.length === 0) {
      embed.setDescription('*Belum ada riwayat juara season terdahulu. Jadilah yang pertama menjuarai season ini! 🏆*');
    } else {
      const seasons = {};
      for (const row of list) {
        if (!seasons[row.season_number]) {
          seasons[row.season_number] = [];
        }
        seasons[row.season_number].push(row);
      }

      let desc = 'Berikut adalah daftar legenda yang berhasil menduduki podium teratas pada Season reset sebelumnya:\n\n';
      
      const sortedSeasonNums = Object.keys(seasons).map(Number).sort((a, b) => b - a);
      for (const sNum of sortedSeasonNums) {
        desc += `👑 **SEASON ${sNum}**\n`;
        const rows = seasons[sNum].sort((a, b) => a.rank_number - b.rank_number);
        for (const row of rows) {
          const medal = row.rank_number === 1 ? '🥇' : row.rank_number === 2 ? '🥈' : '🥉';
          desc += `${medal} **Rank #${row.rank_number}**: <@${row.user_id}> dengan Pet **${row.pet_name}**\n` +
                  `   🏆 *Pangkat Akhir:* **${getFriendlyTierName(row.tier)}** (${row.points} LP)\n` +
                  `   🎁 *Hadiah:* ${row.reward_desc}\n`;
        }
        desc += '\n';
      }
      embed.setDescription(desc);
    }

    if (isInteraction) {
      await messageOrInteraction.reply({ embeds: [embed], flags: 64 });
    } else {
      await messageOrInteraction.reply({ embeds: [embed] });
    }
  } catch (err) {
    console.error('[PvP HoF] Error fetching Hall of Fame:', err);
    const errEmb = new EmbedBuilder().setColor(0xFF3366).setDescription(`❌ Gagal mengambil Hall of Fame: ${err.message}`);
    if (isInteraction) {
      await messageOrInteraction.reply({ embeds: [errEmb], flags: 64 });
    } else {
      await messageOrInteraction.reply({ embeds: [errEmb] });
    }
  }
}

/**
 * Helper to render visually appealing HP and SP status bars in Discord
 */
function renderStatusBar(value, max, filledChar = '🟩', emptyChar = '⬛') {
  const totalSegments = 10;
  const pct = Math.min(100, Math.max(0, Math.round((value / max) * 100)));
  const filled = Math.min(totalSegments, Math.max(0, Math.round((pct / 100) * totalSegments)));
  const empty = totalSegments - filled;
  return `\`[${filledChar.repeat(filled)}${emptyChar.repeat(empty)}]\` **${value}/${max}** (${pct}%)`;
}

/**
 * Generates Embed & components payload for an active interactive battle
 */
function getBattleEmbedData(combatData) {
  const p = combatData.player;
  const b = combatData.bot;

  const playerHPBar = renderStatusBar(p.hp, p.maxHP, '🟩', '⬛');
  const playerSPBar = renderStatusBar(p.energy, 100, '🟪', '⬛');

  const botHPBar = renderStatusBar(b.hp, b.maxHP, '🟥', '⬛');
  const botSPBar = renderStatusBar(b.energy, 100, '🟪', '⬛');

  // Format active buffs/debuffs
  const formatBuffs = (actor) => {
    const buffs = [];
    if (actor.shieldTurns > 0) buffs.push(`🛡️ Shield (${actor.shieldTurns}T)`);
    if (actor.burnTurns > 0) buffs.push(`🔥 Burn (${actor.burnTurns}T)`);
    if (actor.isDefending) buffs.push(`🛡️ Defending`);
    return buffs.length > 0 ? buffs.join(' · ') : '*Normal*';
  };

  const arenaInfo = combatData.arena ? `🏟️ **Lokasi: ${combatData.arena.name}**\n*ℹ️ ${combatData.arena.desc}*\n\n` : '';

  const embed = new EmbedBuilder()
    .setColor(0x7C4DFF)
    .setTitle(`⚔️ PVP ARENA: ${p.name} VS ${b.name}`)
    .setDescription(
      arenaInfo +
      `🏟️ **Ronde ${combatData.turnCount}**\n` +
      `Pilihlah tindakan pet Anda untuk giliran ini. Gunakan tombol di bawah ini!\n\n` +
      `🐾 **${p.name}** *(Elemen: ${p.gacha_element})*\n` +
      `├─ ❤️ HP: ${playerHPBar}\n` +
      `├─ ⚡ SP: ${playerSPBar}\n` +
      `└─ ✨ Status: ${formatBuffs(p)}\n\n` +
      `🤖 **${b.name}** *(Elemen: ${b.gacha_element} · ${b.archetype})*\n` +
      `├─ ❤️ HP: ${botHPBar}\n` +
      `├─ ⚡ SP: ${botSPBar}\n` +
      `└─ ✨ Status: ${formatBuffs(b)}\n\n` +
      `📝 **Log Pertempuran:**\n` +
      `\`\`\`diff\n` +
      combatData.logs.slice(-5).map(line => {
        if (line.includes('KEMENANGAN') || line.includes('CRITICAL') || line.includes('menyerang') || line.includes('memberikan')) return `+ ${line}`;
        if (line.includes('KEKALAHAN') || line.includes('membalas') || line.includes('tumbang') || line.includes('melarikan')) return `- ${line}`;
        return `  ${line}`;
      }).join('\n') +
      `\`\`\``
    )
    .setFooter({ text: 'Gunakan tombol di bawah untuk bertindak!' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('pvpbot_act_atk')
      .setLabel('🗡️ Serang')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('pvpbot_act_def')
      .setLabel('🛡️ Bertahan')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('pvpbot_act_ult')
      .setLabel('🔥 Ultimate')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(p.energy < 60), // Memerlukan minimal 60 SP
    new ButtonBuilder()
      .setCustomId('pvpbot_act_item')
      .setLabel('🎒 Item')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(p.hasUsedItem),
    new ButtonBuilder()
      .setCustomId('pvpbot_act_surr')
      .setLabel('🏳️')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

/**
 * Reset timer timeout 60 detik untuk turn pemain
 */
function resetPvPTimeout(combatData, client) {
  if (combatData.timeout) {
    clearTimeout(combatData.timeout);
  }
  combatData.timeout = setTimeout(async () => {
    combatData.logs.push(`⏳ **${combatData.player.name}** kehabisan waktu turn (60 detik AFK)!`);
    combatData.logs.push(`🏳️ **${combatData.player.name}** otomatis menyerah dari pertandingan.`);
    await endPvPGame(null, client, combatData, 'lose');
  }, 60000);
}

function calculateEffectiveStats(petObj, nowUnix) {
  let str = petObj.stat_str || 0;
  let vit = petObj.stat_vit || 0;
  let def = petObj.stat_def || 0;
  let dex = petObj.stat_dex || 0;
  let baseAtkBonus = petObj.base_atk_bonus_pct || 0.0;
  const logs = [];

  // Debuff Hunger (< 50) -> ATK -20%
  if ((petObj.hunger || 0) < 50) {
    baseAtkBonus -= 0.20;
    logs.push(`⚠️ **Debuff Kelaparan!** **${petObj.pet_name}** sangat lapar (Kenyangan < 50%), ATK berkurang 20%!`);
  }

  // Debuff Thirst (< 50) -> DEX -30%
  if ((petObj.thirst || 0) < 50) {
    dex = Math.round(dex * 0.70);
    logs.push(`⚠️ **Debuff Kehausan!** **${petObj.pet_name}** sangat haus (Hidrasi < 50%), DEX berkurang 30%!`);
  }

  // Injured Status -> All Stats -25%
  if (petObj.curse_type === 'injured' && petObj.curse_until > nowUnix) {
    str = Math.round(str * 0.75);
    vit = Math.round(vit * 0.75);
    def = Math.round(def * 0.75);
    dex = Math.round(dex * 0.75);
    logs.push(`⚠️ **Status Cedera!** **${petObj.pet_name}** bertarung dalam kondisi cedera parah, seluruh statistik tempur berkurang 25%!`);
  }

  return { str, vit, def, dex, baseAtkBonus, logs };
}

/**
 * Memulai tantangan PvP vs Bot interaktif (Ronde 1)
 */
async function startPvPChallenge(interaction, client, petName) {
  const { guildId, user } = interaction;
  
  // Set lock agar tidak double spam arena
  client.activePvPBotGames = client.activePvPBotGames || new Map();
  if (client.activePvPBotGames.has(user.id)) {
    return interaction.reply({ content: '❌ Pet Anda sedang dalam arena tempur aktif! Harap selesaikan pertarungan Anda.', flags: 64 });
  }

  await interaction.deferUpdate().catch(() => {});

  const petObj = pet.getPet(user.id, guildId);
  if (!petObj || petObj.pet_name !== petName) {
    return interaction.followUp({ content: '❌ Terjadi kesalahan! Pet tidak ditemukan.', flags: 64 });
  }
  if (petObj.status === 'DEAD' || petObj.status === 'EGG') {
    return interaction.followUp({ content: '❌ Kondisi pet Anda tidak memenuhi syarat tanding!', flags: 64 });
  }
  if (petObj.health < 20) {
    return interaction.followUp({ content: '❌ Pet Anda terlalu lelah (HP < 20)! Pulihkan terlebih dahulu sebelum tanding.', flags: 64 });
  }

  const pvpState = getOrCreatePvPState(user.id, guildId, petObj.pet_name);

  // Kuota Harian (Bypass jika Owner/Developer)
  let usedSoda = false;
  const isOwner = user.id === config.OWNER_ID;
  if (pvpState.daily_attempts >= 5 && !isOwner) {
    const sodaRow = db.get("SELECT quantity FROM pet_inventory WHERE user_id = ? AND guild_id = ? AND item_id = 'SODA_ENERGY'", [user.id, guildId]);
    if (!sodaRow || sodaRow.quantity <= 0) {
      return interaction.followUp({
        content: '❌ **Kuota harian habis!** Anda telah menggunakan 5 tantangan gratis hari ini. Gunakan **🥤 Soda Energi Pet** untuk bertanding kembali.',
        flags: 64
      });
    }
    usedSoda = true;
  }

  try {
    if (usedSoda) {
      db.run("UPDATE pet_inventory SET quantity = quantity - 1 WHERE user_id = ? AND guild_id = ? AND item_id = 'SODA_ENERGY'", [user.id, guildId]);
    }

    if (!isOwner) {
      db.run(
        'UPDATE user_pet_pvp_bot SET daily_attempts = daily_attempts + 1 WHERE user_id = ? AND guild_id = ? AND pet_name = ?',
        [user.id, guildId, petObj.pet_name]
      );
    }

    // Increment Quest Progress
    pet.incrementQuestProgress(user.id, guildId, 'PVP_BOT', 1);

    const randomArena = ARENAS[Math.floor(Math.random() * ARENAS.length)];
    const botOpponent = generateBotForTier(pvpState.tier, petObj);

    // Weather hazard selection (20% chance)
    let weather = 'CLEAR';
    let weatherName = 'Cerah';
    let weatherDesc = '';
    if (Math.random() < 0.20) {
      const weathers = [
        { key: 'SANDSTORM', name: '🌪️ Badai Pasir', desc: 'Kedua pet terkena 3% Max HP damage di akhir setiap turn!' },
        { key: 'ACID_RAIN', name: '🌧️ Hujan Asam', desc: 'Kedua pet terkena 3% Max HP damage di akhir setiap turn!' }
      ];
      const selectedWeather = weathers[Math.floor(Math.random() * weathers.length)];
      weather = selectedWeather.key;
      weatherName = selectedWeather.name;
      weatherDesc = selectedWeather.desc;
    }

    const nowUnix = Math.floor(Date.now() / 1000);
    const pStats = calculateEffectiveStats(petObj, nowUnix);

    // Hitung status tempur awal berbasis Gym Stats (TANPA Level)
    const playerMaxHP = 100 + pStats.vit * 10;
    const botMaxHP = 100 + botOpponent.stat_vit * 10;

    // Siapkan object game state
    const combatData = {
      guildId,
      userId: user.id,
      turnCount: 1,
      arena: randomArena,
      weather: weather,
      weatherName: weatherName,
      logs: [`⚔️ Pertandingan liga dimulai di **${randomArena.name}** melawan **${botOpponent.name}**!`],
      player: {
        name: petObj.pet_name,
        pet_type: petObj.pet_type,
        gacha_element: petObj.gacha_element || 'EARTH',
        hp: playerMaxHP,
        maxHP: playerMaxHP,
        energy: 0,
        isDefending: false,
        burnTurns: 0,
        shieldTurns: 0,
        hasUsedUltimate: false,
        hasUsedItem: false,
        stat_str: pStats.str,
        stat_vit: pStats.vit,
        stat_def: pStats.def,
        stat_dex: pStats.dex,
        base_atk_bonus_pct: pStats.baseAtkBonus,
        base_def_bonus_pct: petObj.base_def_bonus_pct || 0.0,
        trait: petObj.trait || '',
        gacha_trait2: petObj.gacha_trait2 || '',
        accessory: petObj.accessory || null,
        chosenAction: null
      },
      bot: {
        name: botOpponent.name,
        pet_type: botOpponent.pet_type,
        gacha_element: botOpponent.gacha_element,
        archetype: botOpponent.archetype,
        hp: botMaxHP,
        maxHP: botMaxHP,
        energy: 0,
        isDefending: false,
        burnTurns: 0,
        shieldTurns: 0,
        hasUsedUltimate: false,
        stat_str: botOpponent.stat_str,
        stat_vit: botOpponent.stat_vit,
        stat_def: botOpponent.stat_def,
        stat_dex: botOpponent.stat_dex,
        base_atk_bonus_pct: 0.0,
        base_def_bonus_pct: 0.0,
        trait: botOpponent.trait || '',
        gacha_trait2: botOpponent.gacha_trait2 || '',
        accessory: null,
        chosenAction: null,
        tier: botOpponent.tier
      }
    };

    if (pStats.logs.length > 0) {
      combatData.logs.push(...pStats.logs);
    }
    if (weather !== 'CLEAR') {
      combatData.logs.push(`⚠️ **Cuaca Ekstrem Terdeteksi:** **${weatherName}**! *(${weatherDesc})*`);
    }

    const payload = getBattleEmbedData(combatData);
    const vsAttachment = await petCard.getArenaVsCardAttachment(petObj, botOpponent, pvpState.tier, combatData.arena.key);
    if (vsAttachment) {
      payload.files = [vsAttachment];
      payload.embeds[0].setImage('attachment://arena_vs.png');
    }
    const battleMsg = await interaction.channel.send(payload);

    combatData.messageId = battleMsg.id;
    combatData.channelId = interaction.channel.id;

    // Simpan game state di memori
    client.activePvPBotGames.set(user.id, combatData);

    // Mulai timeout turn pertama (60 detik)
    resetPvPTimeout(combatData, client);

    await interaction.followUp({ content: `⚔️ Pertarungan dimulai! Silakan bertindak pada panel tempur di bawah ini.`, flags: 64 }).catch(() => {});

  } catch(err) {
    console.error('Error starting interactive PvP Bot Game:', err);
    await interaction.followUp({ content: `❌ Gagal memulai arena tempur: ${err.message}`, flags: 64 }).catch(() => {});
  }
}

/**
 * Logika Aksi Satu Karakter (Atk atau Ult) persis aturan Admin Cup
 */
function executeSingleAction(attacker, defender, actionType, combatData) {
  let damage = 0;
  let logMsg = '';
  let isCrit = false;
  let isDodged = false;

  const attackerSpecies = pet.GACHA_SPECIES[attacker.pet_type];
  const attackerSpecBaseAtk = attackerSpecies ? (attackerSpecies.baseAtk || 10) : 10;
  // ATK berbasis Gym Stats (stat_str), Tanpa Level
  let attackerATK = attackerSpecBaseAtk + (attacker.stat_str || 0) * 6;

  const defenderSpecies = pet.GACHA_SPECIES[defender.pet_type];
  const defenderSpecBaseDef = defenderSpecies ? (defenderSpecies.baseDef || 0) : 0;
  // DEF berbasis Gym Stats (stat_def)
  let defenderDEF = defenderSpecBaseDef + (defender.stat_def || 0) * 2.0;

  // Arena Buff (+20% damage if attacker element matches arena element)
  let arenaMultiplier = 1.0;
  let arenaBuffApplied = false;
  if (combatData.arena && combatData.arena.element === attacker.gacha_element) {
    arenaMultiplier = 1.2;
    arenaBuffApplied = true;
  }

  // Attacker buffs
  let atkMultiplier = attacker.pet_type === 'DRAGON' ? 1.15 : 1.0;
  if (attacker.trait === 'WARRIOR' || (attacker.gacha_trait2 && attacker.gacha_trait2.includes('WARRIOR'))) atkMultiplier += 0.15;
  if (attacker.accessory === 'SWORD_TOY') atkMultiplier += 0.15;
  atkMultiplier += (attacker.base_atk_bonus_pct || 0.0);

  // Bot Silver Passive: Adrenaline
  if (attacker.tier && attacker.tier.startsWith('SILVER') && attacker.hp < attacker.maxHP * 0.35) {
    atkMultiplier += 0.25;
    combatData.logs.push(`⚡ **[PASIF BOT]** **${attacker.name}** memicu **Adrenaline** (+25% ATK)!`);
  }

  // Defender buffs
  let defMultiplier = 1.0;
  if (defender.trait === 'STURDY' || (defender.gacha_trait2 && defender.gacha_trait2.includes('STURDY'))) defMultiplier *= 0.85;

  // Dodge & Crit
  const baseDodgeChance = Math.min(0.40, (defender.stat_dex || 0) * 0.008);
  const dodgeChance = defender.isDefending ? baseDodgeChance + 0.20 : baseDodgeChance;
  let critChance = Math.min(0.35, (attacker.stat_dex || 0) * 0.005);

  if (actionType === 'ult' && attacker.gacha_element === 'DRAGON') {
    critChance = Math.min(0.55, critChance + 0.20);
  }

  // Element advantage (+25% ATK)
  const isAdv = pet.isElementAdvantage(attacker.gacha_element, defender.gacha_element);
  if (isAdv) {
    atkMultiplier += 0.25;
  }

  const arenaSuffix = arenaBuffApplied ? ' 🏟️**[BUFF ARENA]**' : '';

  if (actionType === 'atk') {
    isDodged = Math.random() < dodgeChance;
    if (isDodged) {
      logMsg = `💨 **${attacker.name}** melancarkan serangan, namun **${defender.name}** berhasil menghindar!`;
    } else {
      isCrit = Math.random() < critChance;
      let rawDmg = Math.round(attackerATK * atkMultiplier * arenaMultiplier * (0.8 + Math.random() * 0.4));
      if (isCrit) rawDmg = Math.round(rawDmg * 1.5);

      let defFactor = defenderDEF / 150;
      if (defFactor > 0.8) defFactor = 0.8;
      damage = Math.round(rawDmg * (1 - defFactor) * defMultiplier);
      if (defender.isDefending) damage = Math.round(damage * 0.5);

      // Bot Bronze Passive: Iron Skin
      if (defender.tier && defender.tier.startsWith('BRONZE')) {
        const reduced = Math.round(damage * 0.15);
        damage = Math.max(1, damage - reduced);
        combatData.logs.push(`🛡️ **[PASIF BOT]** Zirah **Iron Skin** milik **${defender.name}** menyerap **${reduced} DMG**!`);
      }

      // Shield reduction (absorb 40%)
      if (defender.shieldTurns > 0) {
        const shieldReduced = Math.round(damage * 0.40);
        damage = Math.max(1, damage - shieldReduced);
        combatData.logs.push(`🛡️ **[SHIELD]** Zirah Gunung Purba melindungi **${defender.name}** dan menyerap **${shieldReduced} DMG**!`);
      }

      if (damage < 1) damage = 1;

      defender.hp = Math.max(0, defender.hp - damage);
      const critText = isCrit ? ' 💥 **CRITICAL STRIKE!**' : '';
      logMsg = `⚔️ **${attacker.name}** menyerang **${defender.name}** sebesar **${damage} DMG**!${critText}${arenaSuffix}`;
    }

  } else if (actionType === 'ult') {
    attacker.energy = Math.max(0, attacker.energy - 60);
    attacker.hasUsedUltimate = true;

    const isMissed = Math.random() < 0.30;
    if (isMissed) {
      logMsg = `💨 **${attacker.name}** melancarkan Jurus Ultimate, namun meleset!`;
    } else {
      isCrit = Math.random() < critChance;
      
      const mult = attacker.gacha_element === 'DRAGON' ? 2.2 : 2.0;
      let rawDmg = Math.round((attackerATK * mult) * atkMultiplier * arenaMultiplier * (0.8 + Math.random() * 0.4));
      if (isCrit) rawDmg = Math.round(rawDmg * 1.5);

      let defFactor = defenderDEF / 150;
      if (defFactor > 0.8) defFactor = 0.8;
      damage = Math.round(rawDmg * (1 - defFactor) * defMultiplier);
      if (defender.isDefending) damage = Math.round(damage * 0.5);

      // Bot Bronze Passive: Iron Skin
      if (defender.tier && defender.tier.startsWith('BRONZE')) {
        const reduced = Math.round(damage * 0.15);
        damage = Math.max(1, damage - reduced);
        combatData.logs.push(`🛡️ **[PASIF BOT]** Zirah **Iron Skin** milik **${defender.name}** menyerap **${reduced} DMG**!`);
      }

      if (defender.shieldTurns > 0) {
        const shieldReduced = Math.round(damage * 0.40);
        damage = Math.max(1, damage - shieldReduced);
        combatData.logs.push(`🛡️ **[SHIELD]** Zirah Gunung Purba melindungi **${defender.name}** dan menyerap **${shieldReduced} DMG**!`);
      }

      if (damage < 1) damage = 1;

      defender.hp = Math.max(0, defender.hp - damage);
      const critText = isCrit ? ' 💥 **CRITICAL STRIKE!**' : '';
      
      const element = attacker.gacha_element;
      const ultNames = {
        FIRE: '🔥 Ledakan Supernova Neraka',
        WATER: '🌊 Pusaran Air Abyss Pemulih',
        EARTH: '🧱 Zirah Pelindung Gunung Purba',
        DRAGON: '🐉 Hembusan Naga Kosmik'
      };
      const ultName = ultNames[element] || '💥 Ultimate Strike';

      logMsg = `🔥 **${attacker.name}** menggunakan Ultimate **${ultName}** sebesar **${damage} DMG**!${critText}${arenaSuffix}`;
      
      // Efek elemental tambahan (40% peluang)
      if (Math.random() < 0.40) {
        if (element === 'FIRE') {
          defender.burnTurns = 2;
          logMsg += ` dan membakar tubuh lawan! (Burn 2 Turn)`;
        } else if (element === 'WATER') {
          const healAmount = Math.round(attacker.maxHP * 0.25);
          attacker.hp = Math.min(attacker.maxHP, attacker.hp + healAmount);
          logMsg += ` dan memulihkan dirinya sebesar **${healAmount} HP**!`;
        } else if (element === 'EARTH') {
          attacker.shieldTurns = 2;
          logMsg += ` dan membuat Zirah Pelindung! (Shield 2 Turn)`;
        }
      }
    }
  }

  if (logMsg) {
    combatData.logs.push(logMsg);
  }
}

/**
 * Terapkan damage Burn
 */
function applyBurnDamage(player, combatData) {
  if (player.hp > 0 && player.burnTurns > 0) {
    const burnDmg = Math.round(player.maxHP * 0.08); // 8% HP per turn
    player.hp = Math.max(0, player.hp - burnDmg);
    player.burnTurns--;
    combatData.logs.push(`🔥 **[BURN]** **${player.name}** terbakar dan terkena **${burnDmg} DMG**! (Sisa: ${player.burnTurns} turn)`);
  }
}

/**
 * Memproses turn interaktif ketika pemain mengklik tombol
 */
async function handlePvPAction(interaction, client, actionType) {
  const guildId = interaction ? interaction.guildId : null;
  const user = interaction ? interaction.user : null;
  
  if (!user || !guildId) return;
  
  const combatData = client.activePvPBotGames ? client.activePvPBotGames.get(user.id) : null;
  if (!combatData) {
    if (interaction && typeof interaction.reply === 'function') {
      return interaction.reply({ content: '❌ Pertandingan Anda tidak ditemukan atau telah berakhir!', flags: 64 });
    }
    return;
  }

  if (combatData.isProcessing) return;
  combatData.isProcessing = true;

  if (interaction && typeof interaction.deferUpdate === 'function' && !interaction.ephemeral) {
    await interaction.deferUpdate().catch(() => {});
  }

  const p = combatData.player;
  const b = combatData.bot;

  if (actionType === 'surr') {
    combatData.logs.push(`🏳️ **${p.name}** menyerah dari pertandingan!`);
    return endPvPGame(interaction, client, combatData, 'lose');
  }

  // --- BOT DECISION AI (Archetype-based) ---
  let botAction = 'atk';
  const arch = b.archetype || 'BALANCED';

  if (arch === 'TANKER') {
    // TANKER: Fokus pertahanan dan bertahan ketika SP penuh, sesekali melepaskan ult
    if (b.energy >= 60) {
      const r = Math.random();
      if (r < 0.20) botAction = 'ult';
      else if (r < 0.70) botAction = 'def';
      else botAction = 'atk';
    } else {
      // Lebih sering def
      botAction = Math.random() < 0.50 ? 'def' : 'atk';
    }
  } else if (arch === 'GLASS_CANNON') {
    // GLASS_CANNON: Super agresif! Peluang 0% untuk bertahan. Langsung ult jika SP >= 60.
    if (b.energy >= 60) {
      botAction = 'ult';
    } else {
      botAction = 'atk';
    }
  } else if (arch === 'ASSASSIN') {
    // ASSASSIN: Jika HP lawan di bawah 30% dan SP >= 60, prioritaskan Ultimate 100% untuk finishing blow.
    if (p.hp < p.maxHP * 0.30 && b.energy >= 60) {
      botAction = 'ult';
    } else if (b.energy >= 60) {
      const r = Math.random();
      if (r < 0.70) botAction = 'ult';
      else if (r < 0.90) botAction = 'atk';
      else botAction = 'def';
    } else {
      botAction = Math.random() < 0.60 ? 'atk' : 'def';
    }
  } else {
    // BALANCED (dan default)
    if (b.energy >= 60) {
      const r = Math.random();
      if (r < 0.30) botAction = 'ult';
      else if (r < 0.70) botAction = 'atk';
      else botAction = 'def';
    } else {
      botAction = Math.random() < 0.60 ? 'atk' : 'def';
    }
  }
  b.chosenAction = botAction;
  if (actionType === 'item_med') {
    p.hp = Math.min(p.maxHP, p.hp + 150);
    p.hasUsedItem = true;
    combatData.logs.push(`🎒 **${p.name}** menggunakan **Ramuan Kesehatan**! (+150 HP)`);
    p.chosenAction = 'item_med';
  } else if (actionType === 'item_soda') {
    p.energy = Math.min(100, p.energy + 50);
    p.hasUsedItem = true;
    combatData.logs.push(`🎒 **${p.name}** meminum **Soda Energi**! (+50 SP)`);
    p.chosenAction = 'item_soda';
  } else {
    p.chosenAction = actionType;
  }

  // --- ATURAN COMBAT RESOLUTION ---
  p.isDefending = false;
  b.isDefending = false;

  // 1. Bertahan terlebih dahulu
  if (p.chosenAction === 'def') {
    p.isDefending = true;
    p.energy = Math.min(100, p.energy + 35);
    combatData.logs.push(`🛡️ **${p.name}** memasang kuda-kuda bertahan! (+35 SP)`);
  }
  if (b.chosenAction === 'def') {
    b.isDefending = true;
    b.energy = Math.min(100, b.energy + 35);
    combatData.logs.push(`🛡️ **${b.name}** memasang kuda-kuda bertahan! (+35 SP)`);
  }

  // 2. Tambah SP Serang Biasa
  if (p.chosenAction === 'atk') p.energy = Math.min(100, p.energy + 20);
  if (b.chosenAction === 'atk') b.energy = Math.min(100, b.energy + 20);

  // 3. DEX Speed Check
  let first = p;
  let second = b;
  if (b.stat_dex > p.stat_dex) {
    first = b;
    second = p;
  } else if (p.stat_dex === b.stat_dex) {
    if (Math.random() < 0.5) {
      first = b;
      second = p;
    }
  }

  // 4. Eksekusi Aksi
  if (first.hp > 0 && ['atk', 'ult'].includes(first.chosenAction)) {
    executeSingleAction(first, second, first.chosenAction, combatData);
  }
  if (second.hp > 0 && ['atk', 'ult'].includes(second.chosenAction)) {
    executeSingleAction(second, first, second.chosenAction, combatData);
  }

  // 5. Terapkan Burn
  applyBurnDamage(p, combatData);
  applyBurnDamage(b, combatData);

  // 6. Shield Decay
  if (p.shieldTurns > 0) p.shieldTurns--;
  if (b.shieldTurns > 0) b.shieldTurns--;

  // 6b. Terapkan Weather Damage
  if (combatData.weather && combatData.weather !== 'CLEAR') {
    const pDmg = Math.round(p.maxHP * 0.03);
    const bDmg = Math.round(b.maxHP * 0.03);
    p.hp = Math.max(0, p.hp - pDmg);
    b.hp = Math.max(0, b.hp - bDmg);
    combatData.logs.push(`🌪️ **[CUACA]** **${combatData.weatherName}** menerjang arena! **${p.name}** terkena **${pDmg} DMG** & **${b.name}** terkena **${bDmg} DMG**!`);
  }

  // 7. Cek Kondisi Game Over
  if (p.hp <= 0 && b.hp <= 0) {
    // Mati bersamaan
    if (p.stat_dex >= b.stat_dex) {
      return endPvPGame(interaction, client, combatData, 'win');
    } else {
      return endPvPGame(interaction, client, combatData, 'lose');
    }
  } else if (p.hp <= 0) {
    return endPvPGame(interaction, client, combatData, 'lose');
  } else if (b.hp <= 0) {
    return endPvPGame(interaction, client, combatData, 'win');
  }

  // Jika pertarungan masih lanjut
  p.chosenAction = null;
  b.chosenAction = null;
  combatData.turnCount++;
  combatData.isProcessing = false;

  // Reset timer timeout 60 detik untuk turn berikutnya
  resetPvPTimeout(combatData, client);

  // Update embed & buttons
  const payload = getBattleEmbedData(combatData);
  let messageToEdit = null;
  if (interaction && interaction.message && (!interaction.message.flags || (interaction.message.flags.bitfield & 64) === 0)) {
    messageToEdit = interaction.message;
  } else if (combatData.channelId && combatData.messageId) {
    try {
      const channel = await client.channels.fetch(combatData.channelId);
      if (channel) {
        messageToEdit = await channel.messages.fetch(combatData.messageId);
      }
    } catch (err) {
      console.error('Failed to fetch pvp battle message for update:', err);
    }
  }

  if (messageToEdit) {
    await messageToEdit.edit(payload).catch(() => {});
  }
}

/**
 * Menyelesaikan game, memberikan rewards LP/XP, memotong HP pet, dan membersihkan data memori
 */
async function endPvPGame(interaction, client, combatData, result) {
  const { guildId, userId } = combatData;

  if (combatData.timeout) {
    clearTimeout(combatData.timeout);
    combatData.timeout = null;
  }

  // Bersihkan dari memori game aktif
  if (client.activePvPBotGames) {
    client.activePvPBotGames.delete(userId);
  }

  const petObj = pet.getPet(userId, guildId);
  const pvpState = getOrCreatePvPState(userId, guildId, combatData.player.name);

  const currentTierIndex = TIERS.indexOf(pvpState.tier);

  let resultTitle = '';
  let resultDesc = '';
  let winXp = 0;
  let rankChangesText = '';

  let nextHP = Math.max(10, petObj.health - 10);
  let nextHappiness = Math.max(10, petObj.happiness - 10);

  if (result === 'win') {
    winXp = 50 + currentTierIndex * 10;
    
    const newStreak = (pvpState.win_streak || 0) + 1;
    let pointsBonus = 0;
    let streakAnnounceText = '';
    if (newStreak >= 3) {
      pointsBonus = 10;
      streakAnnounceText = `🔥 **WIN STREAK!** Kemenangan beruntun ke-${newStreak}! Mendapatkan bonus **+10 LP**!\n`;
    }

    let nextPoints = pvpState.points + 25 + pointsBonus;
    let nextTier = pvpState.tier;

    if (nextPoints >= 100) {
      if (currentTierIndex < TIERS.length - 1) {
        const nextTierIndex = currentTierIndex + 1;
        nextTier = TIERS[nextTierIndex];
        nextPoints = nextTier === 'IMMORTAL' ? 0 : nextPoints - 100;
        rankChangesText = `🎉 **PROMOSI TIER!** Pet Anda berhasil naik pangkat menjadi **${getFriendlyTierName(nextTier)}**!`;
      } else {
        rankChangesText = `👑 Pertahankan kejayaan Anda di Puncak Immortal!`;
      }
    } else {
      rankChangesText = `📈 LP bertambah **+${25 + pointsBonus} LP** *(Poin sekarang: ${nextPoints}/100 LP)*`;
    }

    const currentHighestIndex = TIERS.indexOf(pvpState.highest_tier_reached || 'BRONZE_V');
    const newTierIndex = TIERS.indexOf(nextTier);
    const updatedHighestTier = newTierIndex > currentHighestIndex ? nextTier : (pvpState.highest_tier_reached || 'BRONZE_V');

    db.transaction(() => {
      db.run(
        'UPDATE user_pet_pvp_bot SET tier = ?, points = ?, highest_tier_reached = ?, win_streak = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?',
        [nextTier, nextPoints, updatedHighestTier, newStreak, userId, guildId, petObj.pet_name]
      );
    })();

    resultTitle = `🎉 KEMENANGAN ARENA!`;
    resultDesc = `**${petObj.pet_name}** berhasil menaklukkan **${combatData.bot.name}**!\n\n` +
                 streakAnnounceText +
                 `✨ **Reward XP Pet:** **+${winXp} XP**\n` +
                 `${rankChangesText}\n\n` +
                 `🔋 **Status HP Pet:** Sisa HP Anda **${nextHP}%** *(Dampak bertarung -10% HP)*`;

  } else {
    // LOSE / SURRENDER
    nextHP = Math.max(1, petObj.health - 30);
    nextHappiness = Math.max(10, petObj.happiness - 20);

    let pointsDeducted = 10;
    let nextPoints = pvpState.points - pointsDeducted;
    let nextTier = pvpState.tier;

    const isBronze = pvpState.tier.startsWith('BRONZE');

    if (isBronze) {
      pointsDeducted = 0;
      rankChangesText = `ℹ️ LP Anda tidak berkurang karena berada di Kasta Bronze.`;
    } else {
      if (nextPoints < 0) {
        if (currentTierIndex > 0) {
          const nextTierIndex = currentTierIndex - 1;
          nextTier = TIERS[nextTierIndex];
          nextPoints = nextTier === 'IMMORTAL' ? 0 : 90;
          rankChangesText = `🚨 **TURUN TIER!** Pet Anda turun pangkat menjadi **${getFriendlyTierName(nextTier)}**!`;
        } else {
          nextPoints = 0;
          rankChangesText = `📉 LP Anda berkurang ke **0 LP**.`;
        }
      } else {
        rankChangesText = `📉 LP berkurang **-10 LP** *(Poin sekarang: ${nextPoints}/100 LP)*`;
      }
    }

    db.transaction(() => {
      db.run(
        'UPDATE user_pet_pvp_bot SET tier = ?, points = ?, win_streak = 0 WHERE user_id = ? AND guild_id = ? AND pet_name = ?',
        [nextTier, nextPoints, userId, guildId, petObj.pet_name]
      );
    })();

    resultTitle = `💀 KEKALAHAN ARENA!`;
    resultDesc = `**${petObj.pet_name}** tumbang dalam pertarungan melawan **${combatData.bot.name}**!\n\n` +
                 `🔥 **Win Streak terputus!** Streak kembali ke 0.\n` +
                 `${rankChangesText}\n\n` +
                 `🔋 **Status HP Pet:** Sisa HP Anda **${nextHP}%** *(Dampak kekalahan -30% HP)*`;
  }

  // Terapkan penalti status & berikan XP pet
  db.transaction(() => {
    const xpResult = pet.addXp(petObj, winXp, pet.getMaxHP(petObj));
    db.run(
      `UPDATE user_pets 
       SET health = ?, happiness = ?, xp = ?, level = ?, last_interaction_at = ?
       WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
      [nextHP, nextHappiness, xpResult.newXp, xpResult.newLevel, Math.floor(Date.now() / 1000), userId, guildId, petObj.pet_name]
    );
  })();

  const resultEmbed = new EmbedBuilder()
    .setColor(result === 'win' ? 0x10B981 : 0xFF3366)
    .setTitle(resultTitle)
    .setDescription(
      resultDesc + `\n\n` +
      `📝 **Log Akhir Pertandingan:**\n` +
      `\`\`\`diff\n` +
      combatData.logs.map(line => {
        if (line.includes('KEMENANGAN') || line.includes('CRITICAL') || line.includes('memberikan') || line.includes('menyerang')) return `+ ${line}`;
        if (line.includes('KEKALAHAN') || line.includes('membalas') || line.includes('tumbang') || line.includes('menyerah')) return `- ${line}`;
        return `  ${line}`;
      }).join('\n').substring(0, 1000) +
      `\`\`\``
    )
    .setTimestamp();

  let messageToEdit = null;
  if (interaction && interaction.message && (!interaction.message.flags || (interaction.message.flags.bitfield & 64) === 0)) {
    messageToEdit = interaction.message;
  } else if (combatData.channelId && combatData.messageId) {
    try {
      const channel = await client.channels.fetch(combatData.channelId);
      if (channel) {
        messageToEdit = await channel.messages.fetch(combatData.messageId);
      }
    } catch (err) {
      console.error('Failed to fetch pvp battle message for timeout:', err);
    }
  }

  if (messageToEdit) {
    await messageToEdit.edit({ embeds: [resultEmbed], components: [] }).catch(() => {});
    // Hapus pesan hasil pertarungan setelah 15 detik agar channel tetap bersih
    setTimeout(async () => {
      await messageToEdit.delete().catch(() => {});
    }, 15000);
  }
}

/**
 * Menampilkan Papan Peringkat PvP Bot Arena Server
 */
async function showPvPLeaderboard(interaction, client) {
  const { guildId } = interaction;
  await interaction.deferUpdate().catch(() => {});

  try {
    const list = db.all(
      `SELECT * FROM user_pet_pvp_bot WHERE guild_id = ? ORDER BY 
       CASE 
         WHEN tier = 'IMMORTAL' THEN 9
         WHEN tier = 'LEGEND' THEN 8
         WHEN tier = 'GRANDMASTER' THEN 7
         WHEN tier = 'MASTER' THEN 6
         WHEN tier LIKE 'DIAMOND%' THEN 5
         WHEN tier LIKE 'PLATINUM%' THEN 4
         WHEN tier LIKE 'GOLD%' THEN 3
         WHEN tier LIKE 'SILVER%' THEN 2
         WHEN tier LIKE 'BRONZE%' THEN 1
         ELSE 0
       END DESC,
       CASE
         WHEN tier LIKE '%_V' THEN 1
         WHEN tier LIKE '%_IV' THEN 2
         WHEN tier LIKE '%_III' THEN 3
         WHEN tier LIKE '%_II' THEN 4
         WHEN tier LIKE '%_I' THEN 5
         ELSE 0
       END DESC,
       points DESC
       LIMIT 10`,
      [guildId]
    );

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle(`🏆 KLASEMEN ARENA PVP BOT — ${interaction.guild.name}`)
      .setDescription(`Berikut adalah 10 Pet terkuat di Server yang menguasai Arena Tangga PvP Bot:\n▬`.repeat(15));

    if (list.length === 0) {
      embed.addFields({ name: 'Belum Ada Data', value: '*Belum ada pet yang bertarung di Arena ini.*' });
    } else {
      const fieldLines = await Promise.all(
        list.map(async (row, idx) => {
          let username = 'Trainer';
          try {
            const discordUser = client.users.cache.get(row.user_id) || await client.users.fetch(row.user_id);
            if (discordUser) username = discordUser.username;
          } catch(e) {}

          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '▪️';
          return `${medal} **#${idx + 1}** · <@${row.user_id}> (${username})\n` +
                 `   🐾 Pet: **${row.pet_name}** · Pangkat: **${getFriendlyTierName(row.tier)}** (${row.points} LP)`;
        })
      );

      embed.setDescription(fieldLines.join('\n\n'));
    }

    embed.setTimestamp();
    await interaction.followUp({ embeds: [embed] });

  } catch(err) {
    console.error('Error fetching PvP Leaderboard:', err);
    await interaction.followUp({ content: `❌ Gagal mengambil papan peringkat: ${err.message}`, flags: 64 });
  }
}

async function resetRankedSeason(client) {
  try {
    console.log('[PvP Season Reset] Starting ranked season reset...');
    const list = db.all(`SELECT * FROM user_pet_pvp_bot`);
    if (!list || list.length === 0) {
      console.log('[PvP Season Reset] No players to reset.');
      return;
    }

    const sortedList = list.sort((a, b) => {
      const indexA = TIERS.indexOf(a.tier);
      const indexB = TIERS.indexOf(b.tier);
      if (indexB !== indexA) return indexB - indexA;
      return b.points - a.points;
    });

    const historyCountRow = db.get("SELECT COUNT(DISTINCT season_number) as count FROM pvp_season_history");
    const seasonNum = (historyCountRow ? historyCountRow.count : 0) + 1;

    const top3 = sortedList.slice(0, 3);
    const channelId = '1513187966074490890';
    
    let announcementText = `🏆 **RESET RANKED SEASON ARENA PVP BOT (SEASON ${seasonNum})** 🏆\n` +
                           `Musim ini telah resmi berakhir! Terima kasih kepada semua Trainer yang telah berjuang keras.\n\n` +
                           `👑 **Top 3 Juara Season Ini:**\n`;

    for (let i = 0; i < top3.length; i++) {
      const row = top3[i];
      const prizeXp = i === 0 ? 1500 : i === 1 ? 1000 : 500;
      let username = 'Trainer';
      try {
        const discordUser = await client.users.fetch(row.user_id).catch(() => null);
        if (discordUser) username = discordUser.username;
      } catch(e) {}

      announcementText += `🏅 **#${i + 1}** - <@${row.user_id}> (${username}) dengan Pet **${row.pet_name}** [Tier: **${getFriendlyTierName(row.tier)}**]\n` +
                          `   🎁 *Hadiah:* **+${prizeXp} XP Pet**\n`;

      const petObj = pet.getPet(row.user_id, row.guild_id);
      if (petObj && petObj.pet_name === row.pet_name) {
        db.transaction(() => {
          const xpResult = pet.addXp(petObj, prizeXp, pet.getMaxHP(petObj));
          db.run(
            `UPDATE user_pets SET xp = ?, level = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
            [xpResult.newXp, xpResult.newLevel, row.user_id, row.guild_id, row.pet_name]
          );
        })();
      }

      // Hadiah tambahan Pet Mythic acak untuk peringkat 1
      if (i === 0) {
        try {
          const mythicList = ['FENRIR', 'BAHAMUT', 'KRAKEN', 'JORMUNGANDR'];
          const chosenType = mythicList[Math.floor(Math.random() * mythicList.length)];
          const petInfo = pet.GACHA_SPECIES[chosenType];
          
          const mythicNames = {
            FENRIR: 'Fenrir',
            BAHAMUT: 'Bahamut',
            KRAKEN: 'Kraken',
            JORMUNGANDR: 'Jormungandr'
          };
          const baseName = mythicNames[chosenType] || 'Mythic';
          
          let petName = baseName;
          let suffix = 1;
          while (true) {
            const exists = db.get('SELECT 1 FROM user_pets WHERE user_id = ? AND guild_id = ? AND LOWER(pet_name) = LOWER(?)', [row.user_id, row.guild_id, petName]);
            if (!exists) break;
            petName = `${baseName} ${suffix}`;
            suffix++;
          }

          const countRow = db.get('SELECT COUNT(*) as count FROM user_pets WHERE user_id = ? AND guild_id = ?', [row.user_id, row.guild_id]);
          const petCount = countRow ? countRow.count : 0;
          const isActive = petCount === 0 ? 1 : 0;

          const allTraits = ['GENIUS', 'STURDY', 'MUTANT', 'WARRIOR', 'SURVIVOR'];
          const shuffledTraits = [...allTraits].sort(() => Math.random() - 0.5);
          const trait1 = shuffledTraits[0];
          const trait2 = shuffledTraits.slice(1, 3).join(',');

          const now = Math.floor(Date.now() / 1000);
          db.run(
            `INSERT INTO user_pets 
             (user_id, guild_id, pet_name, pet_type, status, level, xp, health, hunger, thirst, happiness,
              last_interaction_at, hatch_at, created_at, is_active, trait, gacha_source, gacha_rarity, gacha_element, gacha_trait2, star_level)
             VALUES (?, ?, ?, ?, 'ADULT', 1, 0, ?, 100, 100, 100, ?, 0, ?, ?, ?, 'SEASON_RESET', 'MYTHIC', ?, ?, 1)`,
            [row.user_id, row.guild_id, petName, chosenType, petInfo.baseHP, now, now, isActive,
             trait1, petInfo.element, trait2]
          );

          db.logPetAction(row.guild_id, row.user_id, null, petName, 'SEASON_RESET_REWARD', `Menerima Pet Mythic ${chosenType} (${petName}) dari Hadiah Top 1 Season Reset.`);
          
          announcementText += `   ⭐ *Hadiah Spesial Juara 1:* **Pet Mythic ${petInfo.emoji} ${petName}** (${chosenType})!\n`;

          // Simpan Riwayat Juara 1 ke Hall of Fame
          const rewardDesc = `Pet Mythic ${petInfo.emoji} ${petName} (${chosenType}) & +1500 XP Pet`;
          db.run(
            `INSERT INTO pvp_season_history (season_number, user_id, guild_id, pet_name, tier, points, rank_number, reward_desc, reset_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [seasonNum, row.user_id, row.guild_id, row.pet_name, row.tier, row.points, 1, rewardDesc, now]
          );

        } catch (mythicErr) {
          console.error('[PvP Season Reset] Failed to award mythic pet to top player:', mythicErr);
        }
      } else {
        // Simpan Riwayat Juara 2 & 3 ke Hall of Fame
        try {
          const rewardDesc = `+${prizeXp} XP Pet`;
          const now = Math.floor(Date.now() / 1000);
          db.run(
            `INSERT INTO pvp_season_history (season_number, user_id, guild_id, pet_name, tier, points, rank_number, reward_desc, reset_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [seasonNum, row.user_id, row.guild_id, row.pet_name, row.tier, row.points, i + 1, rewardDesc, now]
          );
        } catch(hofErr) {
          console.error('[PvP Season Reset] Failed to save Top 2/3 to HOF:', hofErr);
        }
      }
    }

    announcementText += `\n🎁 **Hadiah Season Berdasarkan Kasta Terakhir:**\n` +
                        `• **Master / Grandmaster / Legend / Immortal:** Rp 100.000 & 5x Tiket Gacha\n` +
                        `• **Diamond:** Rp 50.000 & 3x Tiket Gacha\n` +
                        `• **Platinum:** Rp 25.000 & 2x Tiket Gacha\n` +
                        `• **Gold:** Rp 10.000 & 1x Tiket Gacha\n` +
                        `• **Silver:** Rp 5.000\n` +
                        `• **Bronze:** Rp 2.000\n`;

    announcementText += `\n📉 **Demosi Season Baru (Seluruh Pemain diturunkan 5 Divisi / 1 Kasta):**\n`;

    db.transaction(() => {
      for (const row of sortedList) {
        const currentTierIndex = TIERS.indexOf(row.tier);
        const nextTierIndex = Math.max(0, currentTierIndex - 5);
        const nextTier = TIERS[nextTierIndex];
        
        db.run(
          `UPDATE user_pet_pvp_bot SET tier = ?, points = 0 WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
          [nextTier, row.user_id, row.guild_id, row.pet_name]
        );

        // Berikan hadiah berbasis kasta akhir sebelum demosi
        let coinsPrize = 0;
        let ticketsPrize = 0;
        const tier = row.tier;

        if (tier.startsWith('IMMORTAL') || tier.startsWith('LEGEND') || tier.startsWith('GRANDMASTER') || tier.startsWith('MASTER')) {
          coinsPrize = 100000;
          ticketsPrize = 5;
        } else if (tier.startsWith('DIAMOND')) {
          coinsPrize = 50000;
          ticketsPrize = 3;
        } else if (tier.startsWith('PLATINUM')) {
          coinsPrize = 25000;
          ticketsPrize = 2;
        } else if (tier.startsWith('GOLD')) {
          coinsPrize = 10000;
          ticketsPrize = 1;
        } else if (tier.startsWith('SILVER')) {
          coinsPrize = 5000;
        } else if (tier.startsWith('BRONZE')) {
          coinsPrize = 2000;
        }

        if (coinsPrize > 0) {
          economy.addBalance(row.user_id, row.guild_id, coinsPrize, 'SEASON_RESET_COIN');
        }
        if (ticketsPrize > 0) {
          pet.addGachaTickets(row.user_id, row.guild_id, ticketsPrize);
        }
      }
    })();

    announcementText += `\n✅ Semua pangkat pemain berhasil didegradasi. Selamat berjuang kembali di Season baru! ⚔️`;;

    try {
      const settingsRow = db.get("SELECT tournament_admin_channel_id FROM ebyus_settings LIMIT 1");
      const targetChannelId = (settingsRow && settingsRow.tournament_admin_channel_id) ? settingsRow.tournament_admin_channel_id : channelId;
      const channel = await client.channels.fetch(targetChannelId).catch(() => null);
      if (channel) {
        await channel.send({ content: announcementText });
      }
    } catch (err) {
      console.error('[PvP Season Reset] Failed to send announcement:', err);
    }
  } catch (err) {
    console.error('[PvP Season Reset] Error in resetRankedSeason:', err);
  }
}

function getCollectibleTitle(highestTier) {
  if (!highestTier) return null;
  return TIER_TITLES[highestTier] || null;
}

/**
 * Memulai tantangan PvP antar 2 pemain secara interaktif (Ronde 1)
 */
async function startInteractivePvP(interaction, client, challengerId, opponentId, betAmount) {
  const guildId = interaction.guildId;
  
  client.activePvPGames = client.activePvPGames || new Map();
  client.activePvPBotGames = client.activePvPBotGames || new Map();

  if (client.activePvPGames.has(challengerId) || client.activePvPBotGames.has(challengerId)) {
    return interaction.reply({ content: '❌ Penantang sedang dalam pertempuran lain!', flags: 64 });
  }
  if (client.activePvPGames.has(opponentId) || client.activePvPBotGames.has(opponentId)) {
    return interaction.reply({ content: '❌ Anda sedang dalam pertempuran lain!', flags: 64 });
  }

  const challengerPet = pet.getPet(challengerId, guildId);
  const opponentPet = pet.getPet(opponentId, guildId);

  if (!challengerPet || !opponentPet) {
    return interaction.reply({ content: '❌ Terjadi kesalahan! Pet tidak ditemukan.', flags: 64 });
  }

  const randomArena = ARENAS[Math.floor(Math.random() * ARENAS.length)];

  const nowUnix = Math.floor(Date.now() / 1000);
  const p1Stats = calculateEffectiveStats(challengerPet, nowUnix);
  const p2Stats = calculateEffectiveStats(opponentPet, nowUnix);

  const challengerMaxHP = 100 + p1Stats.vit * 10;
  const opponentMaxHP = 100 + p2Stats.vit * 10;

  // Weather hazard selection (20% chance)
  let weather = 'CLEAR';
  let weatherName = 'Cerah';
  let weatherDesc = '';
  if (Math.random() < 0.20) {
    const weathers = [
      { key: 'SANDSTORM', name: '🌪️ Badai Pasir', desc: 'Kedua pet terkena 3% Max HP damage di akhir setiap turn!' },
      { key: 'ACID_RAIN', name: '🌧️ Hujan Asam', desc: 'Kedua pet terkena 3% Max HP damage di akhir setiap turn!' }
    ];
    const selectedWeather = weathers[Math.floor(Math.random() * weathers.length)];
    weather = selectedWeather.key;
    weatherName = selectedWeather.name;
    weatherDesc = selectedWeather.desc;
  }

  const combatData = {
    guildId,
    challengerId,
    opponentId,
    betAmount,
    turnCount: 1,
    arena: randomArena,
    weather: weather,
    weatherName: weatherName,
    logs: [`⚔️ Pertandingan taruhan Rp ${betAmount.toLocaleString('id-ID')} koin dimulai di **${randomArena.name}**!`],
    p1: {
      id: challengerId,
      name: challengerPet.pet_name,
      pet_type: challengerPet.pet_type,
      gacha_element: challengerPet.gacha_element || 'EARTH',
      hp: challengerMaxHP,
      maxHP: challengerMaxHP,
      energy: 0,
      isDefending: false,
      burnTurns: 0,
      shieldTurns: 0,
      hasUsedUltimate: false,
      hasUsedItem: false,
      stat_str: p1Stats.str,
      stat_vit: p1Stats.vit,
      stat_def: p1Stats.def,
      stat_dex: p1Stats.dex,
      base_atk_bonus_pct: p1Stats.baseAtkBonus,
      base_def_bonus_pct: challengerPet.base_def_bonus_pct || 0.0,
      trait: challengerPet.trait || '',
      accessory: challengerPet.accessory || null,
      chosenAction: null
    },
    p2: {
      id: opponentId,
      name: opponentPet.pet_name,
      pet_type: opponentPet.pet_type,
      gacha_element: opponentPet.gacha_element || 'EARTH',
      hp: opponentMaxHP,
      maxHP: opponentMaxHP,
      energy: 0,
      isDefending: false,
      burnTurns: 0,
      shieldTurns: 0,
      hasUsedUltimate: false,
      hasUsedItem: false,
      stat_str: p2Stats.str,
      stat_vit: p2Stats.vit,
      stat_def: p2Stats.def,
      stat_dex: p2Stats.dex,
      base_atk_bonus_pct: p2Stats.baseAtkBonus,
      base_def_bonus_pct: opponentPet.base_def_bonus_pct || 0.0,
      trait: opponentPet.trait || '',
      accessory: opponentPet.accessory || null,
      chosenAction: null
    }
  };

  if (p1Stats.logs.length > 0) {
    combatData.logs.push(...p1Stats.logs);
  }
  if (p2Stats.logs.length > 0) {
    combatData.logs.push(...p2Stats.logs);
  }
  if (weather !== 'CLEAR') {
    combatData.logs.push(`⚠️ **Cuaca Ekstrem Terdeteksi:** **${weatherName}**! *(${weatherDesc})*`);
  }

  const payload = getBattleEmbedDataPvP(combatData);
  const oppPetForCard = { ...opponentPet, name: opponentPet.pet_name };
  const vsAttachment = await petCard.getArenaVsCardAttachment(challengerPet, oppPetForCard, 'PVP DUEL', combatData.arena.key);
  if (vsAttachment) {
    payload.files = [vsAttachment];
    payload.embeds[0].setImage('attachment://arena_vs.png');
  }

  const battleMsg = await interaction.channel.send(payload);
  combatData.messageId = battleMsg.id;
  combatData.channelId = interaction.channel.id;

  client.activePvPGames.set(challengerId, combatData);
  client.activePvPGames.set(opponentId, combatData);

  resetPvPTimeoutPvP(combatData, client);

  await interaction.channel.send(`⚔️ PvP Duel dimulai! <@${challengerId}> vs <@${opponentId}>. Silakan tentukan aksi pet kalian!`).catch(() => {});
}

/**
 * Mendapatkan embeds & components payload untuk PvP interaktif antar 2 pemain
 */
function getBattleEmbedDataPvP(combatData) {
  const p1 = combatData.p1;
  const p2 = combatData.p2;

  const p1HPBar = renderStatusBar(p1.hp, p1.maxHP, '🟩', '⬛');
  const p1SPBar = renderStatusBar(p1.energy, 100, '🟪', '⬛');

  const p2HPBar = renderStatusBar(p2.hp, p2.maxHP, '🟩', '⬛');
  const p2SPBar = renderStatusBar(p2.energy, 100, '🟪', '⬛');

  const formatBuffs = (actor) => {
    const buffs = [];
    if (actor.shieldTurns > 0) buffs.push(`🛡️ Shield (${actor.shieldTurns}T)`);
    if (actor.burnTurns > 0) buffs.push(`🔥 Burn (${actor.burnTurns}T)`);
    if (actor.isDefending) buffs.push(`🛡️ Defending`);
    return buffs.length > 0 ? buffs.join(' · ') : '*Normal*';
  };

  const getStatusText = (actor) => {
    if (actor.chosenAction) return '🟢 **Ready**';
    return '⏳ *Memilih...*';
  };

  const arenaInfo = combatData.arena ? `🏟️ **Lokasi: ${combatData.arena.name}**\n*ℹ️ ${combatData.arena.desc}*\n\n` : '';

  const embed = new EmbedBuilder()
    .setColor(0x7C4DFF)
    .setTitle(`⚔️ PVP ARENA: ${p1.name} VS ${p2.name}`)
    .setDescription(
      arenaInfo +
      `🏟️ **Ronde ${combatData.turnCount}**\n` +
      `Pilihlah tindakan pet Anda untuk giliran ini. Gunakan tombol di bawah ini!\n\n` +
      `🐾 **${p1.name}** (<@${p1.id}>) · ${getStatusText(p1)}\n` +
      `├─ ❤️ HP: ${p1HPBar}\n` +
      `├─ ⚡ SP: ${p1SPBar}\n` +
      `└─ ✨ Status: ${formatBuffs(p1)}\n\n` +
      `⚔️ **${p2.name}** (<@${p2.id}>) · ${getStatusText(p2)}\n` +
      `├─ ❤️ HP: ${p2HPBar}\n` +
      `├─ ⚡ SP: ${p2SPBar}\n` +
      `└─ ✨ Status: ${formatBuffs(p2)}\n\n` +
      `📝 **Log Pertempuran:**\n` +
      `\`\`\`diff\n` +
      combatData.logs.slice(-5).map(line => {
        if (line.includes('KEMENANGAN') || line.includes('CRITICAL') || line.includes('menyerang') || line.includes('memberikan')) return `+ ${line}`;
        if (line.includes('KEKALAHAN') || line.includes('membalas') || line.includes('tumbang') || line.includes('melarikan') || line.includes('menyerah')) return `- ${line}`;
        return `  ${line}`;
      }).join('\n') +
      `\`\`\``
    )
    .setFooter({ text: 'Taruhan: Rp ' + combatData.betAmount.toLocaleString('id-ID') + ' koin' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('pvp_act_atk')
      .setLabel('🗡️ Serang')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('pvp_act_def')
      .setLabel('🛡️ Bertahan')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('pvp_act_ult')
      .setLabel('🔥 Ultimate')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('pvp_act_item')
      .setLabel('🎒 Item')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('pvp_act_surr')
      .setLabel('🏳️')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

/**
 * Mereset timer timeout 60 detik untuk turn PvP 2 pemain
 */
function resetPvPTimeoutPvP(combatData, client) {
  if (combatData.timeout) {
    clearTimeout(combatData.timeout);
  }
  combatData.timeout = setTimeout(async () => {
    const p1 = combatData.p1;
    const p2 = combatData.p2;

    combatData.isProcessing = true;

    if (!p1.chosenAction && !p2.chosenAction) {
      combatData.logs.push(`⏳ Kedua pemain kehabisan waktu turn (60 detik AFK)!`);
      await endPvPGamePvP(null, client, combatData, p2.id, 'timeout');
    } else if (!p1.chosenAction) {
      combatData.logs.push(`⏳ **${p1.name}** kehabisan waktu turn (60 detik AFK)!`);
      await endPvPGamePvP(null, client, combatData, p2.id, 'timeout');
    } else {
      combatData.logs.push(`⏳ **${p2.name}** kehabisan waktu turn (60 detik AFK)!`);
      await endPvPGamePvP(null, client, combatData, p1.id, 'timeout');
    }
  }, 60000);
}

/**
 * Memproses turn interaktif ketika salah satu pemain mengklik tombol aksi
 */
async function handlePvPActionPvP(interaction, client, actionType) {
  const guildId = interaction.guildId;
  const user = interaction.user;

  const combatData = client.activePvPGames ? client.activePvPGames.get(user.id) : null;
  if (!combatData) {
    return interaction.reply({ content: '❌ Pertandingan Anda tidak ditemukan atau telah berakhir!', flags: 64 });
  }

  if (combatData.isProcessing) return;

  const p1 = combatData.p1;
  const p2 = combatData.p2;

  const actor = user.id === p1.id ? p1 : (user.id === p2.id ? p2 : null);
  const enemy = actor === p1 ? p2 : p1;

  if (!actor) {
    return interaction.reply({ content: '❌ Anda tidak berada dalam pertarungan ini!', flags: 64 });
  }

  if (actionType === 'surr') {
    combatData.isProcessing = true;
    combatData.logs.push(`🏳️ **${actor.name}** menyerah dari pertandingan!`);
    return endPvPGamePvP(interaction, client, combatData, enemy.id, 'surrender');
  }

  if (actor.chosenAction) {
    return interaction.reply({ content: '❌ Anda sudah memilih tindakan untuk giliran ini!', flags: 64 });
  }

  if (actionType === 'ult' && actor.energy < 60) {
    return interaction.reply({ content: '❌ Energi Pet Anda tidak cukup (butuh 60 SP)!', flags: 64 });
  }

  if ((actionType === 'item_med' || actionType === 'item_soda') && actor.hasUsedItem) {
    return interaction.reply({ content: '❌ Anda sudah menggunakan item di pertarungan ini!', flags: 64 });
  }

  if (interaction && typeof interaction.deferUpdate === 'function' && !interaction.ephemeral) {
    await interaction.deferUpdate().catch(() => {});
  }

  if (actionType === 'item_med') {
    actor.hp = Math.min(actor.maxHP, actor.hp + 150);
    actor.hasUsedItem = true;
    combatData.logs.push(`🎒 **${actor.name}** menggunakan **Ramuan Kesehatan**! (+150 HP)`);
    actor.chosenAction = 'item_med';
  } else if (actionType === 'item_soda') {
    actor.energy = Math.min(100, actor.energy + 50);
    actor.hasUsedItem = true;
    combatData.logs.push(`🎒 **${actor.name}** meminum **Soda Energi**! (+50 SP)`);
    actor.chosenAction = 'item_soda';
  } else {
    actor.chosenAction = actionType;
  }

  if (p1.chosenAction && p2.chosenAction) {
    combatData.isProcessing = true;

    p1.isDefending = false;
    p2.isDefending = false;

    if (p1.chosenAction === 'def') {
      p1.isDefending = true;
      p1.energy = Math.min(100, p1.energy + 35);
      combatData.logs.push(`🛡️ **${p1.name}** memasang kuda-kuda bertahan! (+35 SP)`);
    }
    if (p2.chosenAction === 'def') {
      p2.isDefending = true;
      p2.energy = Math.min(100, p2.energy + 35);
      combatData.logs.push(`🛡️ **${p2.name}** memasang kuda-kuda bertahan! (+35 SP)`);
    }

    if (p1.chosenAction === 'atk') p1.energy = Math.min(100, p1.energy + 20);
    if (p2.chosenAction === 'atk') p2.energy = Math.min(100, p2.energy + 20);

    let first = p1;
    let second = p2;
    if (p2.stat_dex > p1.stat_dex) {
      first = p2;
      second = p1;
    } else if (p1.stat_dex === p2.stat_dex) {
      if (Math.random() < 0.5) {
        first = p2;
        second = p1;
      }
    }

    if (first.hp > 0 && ['atk', 'ult'].includes(first.chosenAction)) {
      executeSingleAction(first, second, first.chosenAction, combatData);
    }
    if (second.hp > 0 && ['atk', 'ult'].includes(second.chosenAction)) {
      executeSingleAction(second, first, second.chosenAction, combatData);
    }

    applyBurnDamage(p1, combatData);
    applyBurnDamage(p2, combatData);

    if (p1.shieldTurns > 0) p1.shieldTurns--;
    if (p2.shieldTurns > 0) p2.shieldTurns--;

    // 6b. Terapkan Weather Damage
    if (combatData.weather && combatData.weather !== 'CLEAR') {
      const p1Dmg = Math.round(p1.maxHP * 0.03);
      const p2Dmg = Math.round(p2.maxHP * 0.03);
      p1.hp = Math.max(0, p1.hp - p1Dmg);
      p2.hp = Math.max(0, p2.hp - p2Dmg);
      combatData.logs.push(`🌪️ **[CUACA]** **${combatData.weatherName}** menerjang arena! **${p1.name}** terkena **${p1Dmg} DMG** & **${p2.name}** terkena **${p2Dmg} DMG**!`);
    }

    if (p1.hp <= 0 && p2.hp <= 0) {
      if (p1.stat_dex >= p2.stat_dex) {
        return endPvPGamePvP(interaction, client, combatData, p1.id, 'win');
      } else {
        return endPvPGamePvP(interaction, client, combatData, p2.id, 'win');
      }
    } else if (p1.hp <= 0) {
      return endPvPGamePvP(interaction, client, combatData, p2.id, 'win');
    } else if (p2.hp <= 0) {
      return endPvPGamePvP(interaction, client, combatData, p1.id, 'win');
    }

    p1.chosenAction = null;
    p2.chosenAction = null;
    combatData.turnCount++;
    combatData.isProcessing = false;

    resetPvPTimeoutPvP(combatData, client);

    const payload = getBattleEmbedDataPvP(combatData);
    let messageToEdit = null;
    if (combatData.channelId && combatData.messageId) {
      try {
        const channel = await client.channels.fetch(combatData.channelId);
        if (channel) {
          messageToEdit = await channel.messages.fetch(combatData.messageId);
        }
      } catch (err) {
        console.error('Failed to fetch pvp battle message for update:', err);
      }
    }

    if (messageToEdit) {
      await messageToEdit.edit(payload).catch(() => {});
    }
  } else {
    const payload = getBattleEmbedDataPvP(combatData);
    let messageToEdit = null;
    if (combatData.channelId && combatData.messageId) {
      try {
        const channel = await client.channels.fetch(combatData.channelId);
        if (channel) {
          messageToEdit = await channel.messages.fetch(combatData.messageId);
        }
      } catch (err) {
        console.error('Failed to fetch pvp battle message for update:', err);
      }
    }

    if (messageToEdit) {
      await messageToEdit.edit(payload).catch(() => {});
    }
  }
}

/**
 * Menyelesaikan game PvP interaktif antar 2 pemain
 */
async function endPvPGamePvP(interaction, client, combatData, winnerId, reason) {
  const { guildId, challengerId, opponentId, betAmount } = combatData;

  if (combatData.timeout) {
    clearTimeout(combatData.timeout);
    combatData.timeout = null;
  }

  if (client.activePvPGames) {
    client.activePvPGames.delete(challengerId);
    client.activePvPGames.delete(opponentId);
  }

  const challengerPet = pet.getPet(challengerId, guildId);
  const opponentPet = pet.getPet(opponentId, guildId);

  const winnerPet = winnerId === challengerId ? challengerPet : opponentPet;
  const loserPet = winnerId === challengerId ? opponentPet : challengerPet;
  const loserId = winnerId === challengerId ? opponentId : challengerId;

  const winnerName = winnerPet.pet_name;
  const loserName = loserPet.pet_name;

  const tax = Math.floor(betAmount * 2 * 0.05);
  const prizePool = (betAmount * 2) - tax;

  let resultTitle = '🎉 KEMENANGAN ARENA!';
  let resultDesc = `**${winnerName}** (<@${winnerId}>) berhasil menaklukkan **${loserName}** (<@${loserId}>)!\n\n` +
                   `✨ **Reward XP Pet Pemenang:** **+50 XP**\n` +
                   `✨ **Reward XP Pet Kalah:** **+20 XP**\n\n` +
                   `🪙 **Hadiah Bersih:** Rp **${prizePool.toLocaleString('id-ID')}** koin *(Pajak 5% Server: Rp ${tax})*\n`;

  let wHP = Math.max(10, winnerPet.health - 10);
  let lHP = Math.max(10, loserPet.health - 30);
  let wHappy = Math.max(20, winnerPet.happiness - 5);
  let lHappy = Math.max(10, loserPet.happiness - 25);

  if (pet.isGodPet(winnerPet)) {
    wHP = 100;
    wHappy = 100;
  }
  if (pet.isGodPet(loserPet)) {
    lHP = 100;
    lHappy = 100;
  }

  const wMaxHP = pet.getMaxHP(winnerPet);
  const wXpGained = Math.round(50 * (winnerPet.xp_multiplier || 1.0));
  let { newXp: wXp, newLevel: wLevel } = pet.addXp(winnerPet, wXpGained, wMaxHP);

  const lMaxHP = pet.getMaxHP(loserPet);
  const lXpGained = Math.round(20 * (loserPet.xp_multiplier || 1.0));
  let { newXp: lXp, newLevel: lLevel } = pet.addXp(loserPet, lXpGained, lMaxHP);

  let lStatus = loserPet.status;
  if (pet.isGodPet(winnerPet)) {
    lHP = 0;
    lStatus = 'DEAD';
  }

  let finalCurseType = loserPet.curse_type;
  let finalCurseUntil = loserPet.curse_until;
  let injuredTriggered = false;
  if (!pet.isGodPet(loserPet) && lStatus !== 'DEAD' && Math.random() < 0.15) {
    finalCurseType = 'injured';
    finalCurseUntil = Math.floor(Date.now() / 1000) + 86400 * 7;
    injuredTriggered = true;
  }

  db.transaction(() => {
    economy.subtractBalance(loserId, guildId, betAmount, 'PET_PVP_BET_LOST');
    economy.addBalance(winnerId, guildId, prizePool - betAmount, 'PET_PVP_BET_WON');

    // Kirim pajak ke owner
    if (tax > 0) {
      economy.addBalance(config.OWNER_ID, guildId, tax, 'TAX_COLLECT_PVP_BATTLE');
    }

    db.run(
      `UPDATE user_pets SET health = ?, happiness = ?, xp = ?, level = ?, pvp_wins = pvp_wins + 1, last_interaction_at = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
      [wHP, wHappy, wXp, wLevel, Math.floor(Date.now() / 1000), winnerId, guildId, winnerName]
    );

    db.run(
      `UPDATE user_pets SET health = ?, status = ?, happiness = ?, xp = ?, level = ?, pvp_losses = pvp_losses + 1, last_interaction_at = ?, curse_type = ?, curse_until = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
      [lHP, lStatus, lHappy, lXp, lLevel, Math.floor(Date.now() / 1000), finalCurseType, finalCurseUntil, loserId, guildId, loserName]
    );

    if (injuredTriggered) {
      combatData.logs.push(`⚠️ **Cedera Tempur!** Pet **${loserName}** terluka parah akibat kekalahan bertarung di PvP Arena dan mengalami status **INJURED** (Cedera).`);
    }
  })();

  db.logPetAction(guildId, winnerId, null, winnerName, 'PVP_BATTLE', `Menang PvP interaktif melawan ${loserName} (milik <@${loserId}>). Taruhan: Rp ${betAmount}, Bersih: Rp ${prizePool}`);
  db.logPetAction(guildId, loserId, null, loserName, 'PVP_BATTLE', `Kalah PvP interaktif melawan ${winnerName} (milik <@${winnerId}>). Taruhan: Rp ${betAmount}`);

  let files = [];
  try {
    const petCardModule = require('./petCard');
    const freshChal = pet.getPet(challengerId, guildId);
    const freshOpp = pet.getPet(opponentId, guildId);
    if (freshChal && freshOpp) {
      const resultObj = {
        draw: false,
        winnerId,
        winnerName,
        loserName,
        prizePool,
        tax,
        challengerHP: combatData.p1.hp,
        opponentHP: combatData.p2.hp
      };
      const pvpCardAtt = await petCardModule.getPvpCardAttachment(freshChal, freshOpp, resultObj);
      if (pvpCardAtt) files.push(pvpCardAtt);
    }
  } catch (e) {
    console.error('[PvP] Gagal membuat visual PvP card:', e.message);
  }

  const resultEmbed = new EmbedBuilder()
    .setColor(0x10B981)
    .setTitle(resultTitle)
    .setDescription(
      resultDesc + `\n\n` +
      `📝 **Log Akhir Pertandingan:**\n` +
      `\`\`\`diff\n` +
      combatData.logs.map(line => {
        if (line.includes('KEMENANGAN') || line.includes('CRITICAL') || line.includes('memberikan') || line.includes('menyerang')) return `+ ${line}`;
        if (line.includes('KEKALAHAN') || line.includes('membalas') || line.includes('tumbang') || line.includes('menyerah')) return `- ${line}`;
        return `  ${line}`;
      }).join('\n').substring(0, 1000) +
      `\`\`\``
    )
    .setTimestamp();

  let messageToEdit = null;
  if (combatData.channelId && combatData.messageId) {
    try {
      const channel = await client.channels.fetch(combatData.channelId);
      if (channel) {
        messageToEdit = await channel.messages.fetch(combatData.messageId);
      }
    } catch (err) {
      console.error('Failed to fetch pvp battle message for end of game:', err);
    }
  }

  if (messageToEdit) {
    await messageToEdit.edit({ embeds: [resultEmbed], components: [], files }).catch(() => {});
  }
}

module.exports = {
  showPvPArena,
  startPvPChallenge,
  showPvPLeaderboard,
  handlePvPAction,
  getFriendlyTierName,
  getOrCreatePvPState,
  getCollectibleTitle,
  TIER_TITLES,
  resetRankedSeason,
  startInteractivePvP,
  handlePvPActionPvP,
  generateBotForTier,
  showPvPHallOfFame
};

