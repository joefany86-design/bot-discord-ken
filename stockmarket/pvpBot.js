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

const ELEMENT_SKILLS = {
  FIRE: [
    { key: 'burn_slash', name: '🔥 Ledakan Bara', desc: 'Deals 1.0x damage, 60% chance to Burn target for 2 turns.' },
    { key: 'flame_claw', name: '⚔️ Cakar Api', desc: 'Deals 1.2x damage, high crit chance (+15% crit).' }
  ],
  WATER: [
    { key: 'water_jet', name: '🌊 Tembakan Air', desc: 'Deals 0.8x damage, heals self for 15% Max HP.' },
    { key: 'frost_shield', name: '❄️ Pembekuan', desc: 'Deals 0.7x damage, gains +20% Dodge for 2 turns.' }
  ],
  EARTH: [
    { key: 'ancient_wall', name: '🧱 Tameng Purba', desc: 'Gains a shield (absorbs 30% damage for 2 turns) and deals 0.6x damage.' },
    { key: 'earthquake', name: '🪨 Gempa Bumi', desc: 'Deals 1.1x damage, reduces target\'s DEF by 20% for 2 turns.' }
  ],
  DRAGON: [
    { key: 'cosmic_breath', name: '🐉 Cosmic Breath', desc: 'Deals 1.2x damage (ignores 20% of target\'s DEF).' },
    { key: 'dragon_rage', name: '⚡ Dragon Rage', desc: 'Deals 0.9x damage, increases ATK by 25% for 2 turns.' }
  ]
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
  // Starts at 0.95 for Bronze V, goes up to 1.65 for Immortal (balanced scaling)
  let scaleMultiplier = 0.95 + (tierIndex * 0.025); 

  let playerTotalStats = 0;
  if (petObj) {
    playerTotalStats = (petObj.stat_str || 0) + (petObj.stat_vit || 0) + (petObj.stat_def || 0) + (petObj.stat_dex || 0);
  }

  const basePoints = Math.max(15, playerTotalStats);
  const totalPoints = Math.round(basePoints * scaleMultiplier);

  const archetypes = ['TANKER', 'GLASS_CANNON', 'ASSASSIN', 'BALANCED'];
  const archetype = archetypes[Math.floor(Math.random() * archetypes.length)];

  // Tentukan trait untuk bot sesuai arketipe secara adil (Hanya 1 trait aktif, tidak ganda)
  let trait = '';
  let gacha_trait2 = '';

  if (archetype === 'TANKER') {
    trait = 'STURDY';
  } else if (archetype === 'GLASS_CANNON' || archetype === 'ASSASSIN') {
    trait = 'WARRIOR';
  } else {
    trait = Math.random() < 0.5 ? 'STURDY' : 'WARRIOR';
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

  let templates = botTemplates[archetype];
  
  // Counter-Element Pick logic based on Tier and player pet element
  if (petObj) {
    const playerEl = (petObj.gacha_element || 'EARTH').toUpperCase();
    let counterElement = '';
    if (playerEl === 'FIRE') counterElement = 'WATER';
    else if (playerEl === 'EARTH') counterElement = 'FIRE';
    else if (playerEl === 'WATER') counterElement = Math.random() < 0.5 ? 'EARTH' : 'DRAGON';
    else if (playerEl === 'DRAGON') counterElement = 'DRAGON';

    let counterChance = 0.0;
    if (tierIndex >= 10 && tierIndex < 20) { // GOLD & PLATINUM
      counterChance = 0.50;
    } else if (tierIndex >= 20) { // DIAMOND & ABOVE
      counterChance = 0.80;
    }

    if (counterElement && Math.random() < counterChance) {
      let filtered = templates.filter(t => t.element === counterElement);
      if (filtered.length > 0) {
        templates = filtered;
      } else {
        // Fallback to searching other archetypes if chosen archetype lacks the element
        const allTemplates = Object.values(botTemplates).flat();
        filtered = allTemplates.filter(t => t.element === counterElement);
        if (filtered.length > 0) {
          templates = filtered;
        }
      }
    }
  }

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
  const speciesInfo = pet.GACHA_SPECIES[petObj.pet_type];
  const specBaseHp = speciesInfo ? (speciesInfo.baseHP || 100) : 100;
  const starLevel = petObj.star_level || 1;
  const hpBonus = (starLevel - 1) * 15;
  const maxHP = (specBaseHp + hpBonus + (petObj.stat_vit || 0) * 10) * 4;
  
  const specBaseAtk = speciesInfo ? (speciesInfo.baseAtk || 10) : 10;
  const specBaseDef = speciesInfo ? (speciesInfo.baseDef || 0) : 0;
  
  const baseAtk = specBaseAtk + (petObj.stat_str || 0) * 6;
  const defenderDEF = specBaseDef + (petObj.stat_def || 0) * 2.0;
  const defPercent = Math.min(80, (defenderDEF / 150) * 100);
  const critPercent = Math.min(35, (petObj.stat_dex || 0) * 0.5);
  const dodgePercent = Math.min(40, (petObj.stat_dex || 0) * 0.8);

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
         `• ⚔️ **Base ATK:** \`${baseAtk} DMG\` *(Spesies: ${specBaseAtk}, +6 per STR)*\n` +
         `• 🛡️ **Damage Reduction:** \`${defPercent.toFixed(1)}%\` *(Spesies: ${specBaseDef}, +2.0 per DEF, maks 80%)*\n` +
         `• ⚡ **Crit Chance:** \`${critPercent.toFixed(1)}%\` *(+0.5% per DEX, maks 35%)*\n` +
         `• 💨 **Dodge Chance:** \`${dodgePercent.toFixed(1)}%\` *(+0.8% per DEX, maks 40%)*\n` +
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
    if (actor.dodgeBonusTurns > 0) buffs.push(`💨 Dodge +20% (${actor.dodgeBonusTurns}T)`);
    if (actor.defBonusTurns > 0) buffs.push(`🧱 Def Reduced (${actor.defBonusTurns}T)`);
    if (actor.atkBonusTurns > 0) buffs.push(`⚔️ ATK +25% (${actor.atkBonusTurns}T)`);
    return buffs.length > 0 ? buffs.join(' · ') : '*Normal*';
  };

  const sortedGauges = [
    { name: `🐾 ${p.name}`, gauge: p.gauge || 0 },
    { name: `🤖 ${b.name}`, gauge: b.gauge || 0 }
  ].sort((a, b) => b.gauge - a.gauge);
  const timelineText = `🏃 **Urutan Giliran Berikutnya:**\n` +
                       `• **${sortedGauges[0].name}** (Gauge: \`${Math.round(sortedGauges[0].gauge)}/100\`)\n` +
                       `• **${sortedGauges[1].name}** (Gauge: \`${Math.round(sortedGauges[1].gauge)}/100\`)\n\n`;

  const arenaInfo = combatData.arena ? `🏟️ **Lokasi: ${combatData.arena.name}**\n*ℹ️ ${combatData.arena.desc}*\n\n` : '';

  const embed = new EmbedBuilder()
    .setColor(0x7C4DFF)
    .setTitle(`⚔️ PVP ARENA: ${p.name} VS ${b.name}`)
    .setDescription(
      arenaInfo +
      `🏟️ **Ronde ${combatData.turnCount}**\n` +
      `Pilihlah tindakan pet Anda untuk giliran ini. Gunakan tombol di bawah ini!\n\n` +
      `👟 **Action Speed Gauge:**\n` +
      `• **${p.name}**: \`${Math.round(p.gauge || 0)} / 100\`\n` +
      `• **${b.name}**: \`${Math.round(b.gauge || 0)} / 100\`\n\n` +
      timelineText +
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
        if (line.includes('KEMENANGAN') || line.includes('CRITICAL') || line.includes('menyerang') || line.includes('memberikan') || line.includes('DOUBLE ACTION')) return `+ ${line}`;
        if (line.includes('KEKALAHAN') || line.includes('membalas') || line.includes('tumbang') || line.includes('melarikan')) return `- ${line}`;
        return `  ${line}`;
      }).join('\n') +
      `\`\`\``
    )
    .setFooter({ text: 'Gunakan tombol di bawah untuk bertindak!' });

  const skillsList = ELEMENT_SKILLS[p.gacha_element] || ELEMENT_SKILLS.EARTH;
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('pvpbot_act_atk')
      .setLabel('🗡️ Serang (+20 SP)')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('pvpbot_act_skill1')
      .setLabel(`${skillsList[0].name} (+20 SP)`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('pvpbot_act_skill2')
      .setLabel(`${skillsList[1].name} (+20 SP)`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('pvpbot_act_ult')
      .setLabel(`🔥 Ultimate (60 SP)`)
      .setStyle(ButtonStyle.Danger)
      .setDisabled(p.energy < 60)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('pvpbot_act_item')
      .setLabel('🎒 Item')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(p.hasUsedItem),
    new ButtonBuilder()
      .setCustomId('pvpbot_act_surr')
      .setLabel('🏳️ Menyerah')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row1, row2] };
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
  let equipHpBonus = 0;
  const logs = [];

  // Fetch and apply equipment bonuses
  try {
    const eq = require('./equipment');
    const petElement = petObj.gacha_element || 'EARTH';
    const eqBonuses = eq.getPetEquipmentStatsBonus(petObj.user_id, petObj.guild_id, petObj.pet_name, petElement);
    if (eqBonuses) {
      if (eqBonuses.ATK > 0) {
        str += eqBonuses.ATK; // weapon ATK acts as STR / flat ATK scaling
      }
      if (eqBonuses.DEF > 0) {
        def += eqBonuses.DEF;
      }
      if (eqBonuses.HP > 0) {
        equipHpBonus += eqBonuses.HP;
      }
      if (eqBonuses.DEX > 0) {
        dex += eqBonuses.DEX;
      }
      const activeEquips = eq.getPetEquipment(petObj.user_id, petObj.guild_id, petObj.pet_name, petElement);
      if (activeEquips.length > 0) {
        const itemNames = activeEquips.map(e => {
          const matchedText = e.elementMatch ? ` 🌟 [Affinity Match]` : '';
          const brokenText = e.durability <= 0 ? ' (Rusak!)' : '';
          return `[+${e.level}] ${e.equip_name}${matchedText}${brokenText}`;
        }).join(', ');
        logs.push(`🛡️ **Equipment Aktif:** Memakai ${itemNames} (Bonus Stat diterapkan!)`);
      }
    }
  } catch (err) {
    console.error('❌ [pvpBot] Gagal menghitung equipment bonus:', err.message);
  }

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

  return { str, vit, def, dex, baseAtkBonus, equipHpBonus, logs };
}

/**
 * Memulai tantangan PvP vs Bot interaktif (Ronde 1)
 */
async function startPvPChallenge(interaction, client, petName) {
  const { guildId, user } = interaction;
  
  // Set lock agar tidak double spam arena
  client.activePvPBotGames = client.activePvPBotGames || new Map();
  if (client.activePvPBotGames.has(user.id)) {
    return interaction.reply({ content: '❌ Pet Anda sedang dalam arena tempur aktif! Harap selesaikan pertarungan Anda.', flags: 64 }).catch(() => {});
  }

  await interaction.deferUpdate().catch(() => {});

  const petObj = pet.getPet(user.id, guildId);
  if (!petObj || petObj.pet_name !== petName) {
    return interaction.followUp({ content: '❌ Terjadi kesalahan! Pet tidak ditemukan.', flags: 64 }).catch(() => {});
  }
  if (petObj.status === 'DEAD' || petObj.status === 'EGG') {
    return interaction.followUp({ content: '❌ Kondisi pet Anda tidak memenuhi syarat tanding!', flags: 64 }).catch(() => {});
  }
  if (petObj.health < 20) {
    return interaction.followUp({ content: '❌ Pet Anda terlalu lelah (HP < 20)! Pulihkan terlebih dahulu sebelum tanding.', flags: 64 }).catch(() => {});
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
      }).catch(() => {});
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

    // Reduce durability (1-2 points) of equipped items (Requirement 3)
    db.run(
      "UPDATE pet_equipment SET durability = CASE WHEN durability - 2 < 0 THEN 0 ELSE durability - 2 END WHERE user_id = ? AND guild_id = ? AND equipped_pet = ?",
      [user.id, guildId, petObj.pet_name]
    );

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

    // Hitung status tempur awal berbasis Gym Stats (TANPA Level), memperhitungkan Spesies Base HP dan Bintang/Fusion
    const playerSpeciesInfo = pet.GACHA_SPECIES[petObj.pet_type];
    const playerBaseHP = playerSpeciesInfo ? (playerSpeciesInfo.baseHP || 100) : 100;
    const playerStarLevel = petObj.star_level || 1;
    const playerHpBonus = (playerStarLevel - 1) * 15;
    const playerMaxHP = (playerBaseHP + playerHpBonus + pStats.vit * 10 + pStats.equipHpBonus) * 4;

    const botSpeciesInfo = pet.GACHA_SPECIES[botOpponent.pet_type];
    const botBaseHP = botSpeciesInfo ? (botSpeciesInfo.baseHP || 100) : 100;
    const botMaxHP = (botBaseHP + botOpponent.stat_vit * 10) * 4;

    const botTierIndex = TIERS.indexOf(botOpponent.tier || 'BRONZE_V');
    const startShield = botTierIndex >= 25 ? 3 : 0; // Master, Grandmaster, Legend, Immortal start with 3 turns shield

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
        chosenAction: null,
        statsRecap: { damageDealt: 0, damageAbsorbed: 0, dodges: 0, crits: 0 }
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
        shieldTurns: startShield,
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
        tier: botOpponent.tier,
        itemsUsedCount: 0,
        statsRecap: { damageDealt: 0, damageAbsorbed: 0, dodges: 0, crits: 0 }
      }
    };

    if (startShield > 0) {
      combatData.logs.push(`🛡️ **[PASIF BOT]** **${botOpponent.name}** memulai laga dengan Zirah Pelindung (3 Turn)!`);
    }

    if (pStats.logs.length > 0) {
      combatData.logs.push(...pStats.logs);
    }
    if (weather !== 'CLEAR') {
      combatData.logs.push(`⚠️ **Cuaca Ekstrem Terdeteksi:** **${weatherName}**! *(${weatherDesc})*`);
    }

    const betRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pvpbot_bet_start_${user.id}`)
        .setLabel('💸 Pasang Taruhan (Bet)')
        .setStyle(ButtonStyle.Success)
    );

    // Kirim pesan undangan/notifikasi di channel utama terlebih dahulu
    const replyMsg = await interaction.channel.send({
      content: `⚔️ **Arena PvP Bot**: <@${user.id}> menantang **${botOpponent.name}** di **${randomArena.name}**!\n*Ayo dukung dan pasang taruhan koin Anda!*`,
      components: [betRow]
    });

    let thread;
    try {
      thread = await replyMsg.startThread({
        name: `⚔️ Arena - ${user.username}`,
        autoArchiveDuration: 60,
        reason: 'Sesi Game PvP Bot'
      });
      // Kirim pesan sambutan di dalam thread
      await thread.send({ content: `👋 Selamat datang di Arena Tempur, <@${user.id}>! Bersiaplah melawan perwakilan bot.` }).catch(() => {});
    } catch (err) {
      console.error('Gagal membuat thread pvp, fallback ke channel biasa:', err);
      thread = interaction.channel;
    }

    if (thread.id !== interaction.channel.id) {
      await replyMsg.edit({
        content: `⚔️ Pertandingan Arena PvP Bot <@${user.id}> sedang berlangsung! Silakan tonton di <#${thread.id}>. Taruhan masih dibuka!`,
        components: [betRow]
      }).catch(() => {});
    }

    const payload = getBattleEmbedData(combatData);
    const vsAttachment = await petCard.getArenaVsCardAttachment(petObj, botOpponent, pvpState.tier, combatData.arena.key);
    if (vsAttachment) {
      payload.files = [vsAttachment];
      payload.embeds[0].setImage('attachment://arena_vs.png');
    }

    let battleMsg;
    if (thread.id !== interaction.channel.id) {
      battleMsg = await thread.send(payload);
    } else {
      battleMsg = replyMsg;
      await battleMsg.edit(payload);
    }

    combatData.messageId = battleMsg.id;
    combatData.channelId = thread.id;
    combatData.parentMessageId = replyMsg.id;
    combatData.parentChannelId = interaction.channel.id;

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
    atkMultiplier += 0.15;
    combatData.logs.push(`⚡ **[PASIF BOT]** **${attacker.name}** memicu **Adrenaline** (+15% ATK)!`);
  }

  // Defender buffs
  let defMultiplier = 1.0;
  if (defender.trait === 'STURDY' || (defender.gacha_trait2 && defender.gacha_trait2.includes('STURDY'))) defMultiplier *= 0.85;

  // Dodge & Crit
  const baseDodgeChance = Math.min(0.40, (defender.stat_dex || 0) * 0.008);
  let dodgeChance = defender.isDefending ? baseDodgeChance + 0.20 : baseDodgeChance;
  let critChance = Math.min(0.35, (attacker.stat_dex || 0) * 0.005);

  // Bot passive Crit/Dodge scaling based on tier
  if (attacker.tier) {
    const tIndex = TIERS.indexOf(attacker.tier);
    if (tIndex >= 20 && tIndex < 25) { // DIAMOND
      critChance += 0.10;
    } else if (tIndex >= 25 && tIndex < 28) { // MASTER, GRANDMASTER
      critChance += 0.15;
    } else if (tIndex >= 28) { // LEGEND, IMMORTAL
      critChance += 0.20;
    }
  }
  if (defender.tier) {
    const tIndex = TIERS.indexOf(defender.tier);
    if (tIndex >= 20 && tIndex < 25) { // DIAMOND
      dodgeChance += 0.05;
    } else if (tIndex >= 25 && tIndex < 28) { // MASTER, GRANDMASTER
      dodgeChance += 0.10;
    } else if (tIndex >= 28) { // LEGEND, IMMORTAL
      dodgeChance += 0.15;
    }
  }

  if (actionType === 'ult' && attacker.gacha_element === 'DRAGON') {
    critChance = Math.min(0.55, critChance + 0.20);
  }

  // Element advantage (+40% ATK)
  const isAdv = pet.isElementAdvantage(attacker.gacha_element, defender.gacha_element);
  if (isAdv) {
    atkMultiplier += 0.40;
  }

  const arenaSuffix = arenaBuffApplied ? ' 🏟️**[BUFF ARENA]**' : '';

  // Handle skills custom effects
  let skill = null;
  const skillsList = ELEMENT_SKILLS[attacker.gacha_element] || ELEMENT_SKILLS.EARTH;
  if (actionType === 'skill1') skill = skillsList[0];
  if (actionType === 'skill2') skill = skillsList[1];

  let skillMult = 1.0;
  if (skill) {
    if (skill.key === 'flame_claw') {
      skillMult = 1.2;
      critChance += 0.15;
    } else if (skill.key === 'water_jet') {
      skillMult = 0.8;
    } else if (skill.key === 'frost_shield') {
      skillMult = 0.7;
    } else if (skill.key === 'ancient_wall') {
      skillMult = 0.6;
    } else if (skill.key === 'earthquake') {
      skillMult = 1.1;
    } else if (skill.key === 'cosmic_breath') {
      skillMult = 1.2;
      defenderDEF = defenderDEF * 0.8; // Ignores 20% DEF
    } else if (skill.key === 'dragon_rage') {
      skillMult = 0.9;
      attacker.atkBonusTurns = 2;
    }
  }

  if (attacker.atkBonusTurns > 0) {
    atkMultiplier += 0.25;
  }
  if (defender.defBonusTurns > 0) {
    defenderDEF = defenderDEF * 0.8;
  }

  let finalDodgeChance = dodgeChance;
  if (defender.dodgeBonusTurns > 0) {
    finalDodgeChance += 0.20;
  }

  if (actionType === 'atk' || actionType === 'skill1' || actionType === 'skill2') {
    isDodged = Math.random() < finalDodgeChance;
    if (isDodged) {
      logMsg = `💨 **${attacker.name}** melancarkan serangan, namun **${defender.name}** berhasil menghindar!`;
      if (defender.statsRecap) defender.statsRecap.dodges++;
    } else {
      isCrit = Math.random() < critChance;
      let rawDmg = Math.round(attackerATK * skillMult * atkMultiplier * arenaMultiplier * (0.8 + Math.random() * 0.4));
      if (isCrit) rawDmg = Math.round(rawDmg * 1.5);

      let defFactor = defenderDEF / 150;
      if (defFactor > 0.8) defFactor = 0.8;
      damage = Math.round(rawDmg * (1 - defFactor) * defMultiplier);
      if (defender.isDefending) damage = Math.round(damage * 0.5);

      // Bot Bronze Passive: Iron Skin
      if (defender.tier && defender.tier.startsWith('BRONZE')) {
        const reduced = Math.round(damage * 0.10);
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

      // Rage passive for Legend / Immortal bots
      if (isCrit && defender.tier) {
        const tIndex = TIERS.indexOf(defender.tier);
        if (tIndex >= 27) { // LEGEND (27), IMMORTAL (28)
          defender.energy = Math.min(100, defender.energy + 20);
          combatData.logs.push(`⚡ **[PASIF BOT]** Terkena Critical Strike memicu amarah **${defender.name}**! (+20 SP)`);
        }
      }

      const critText = isCrit ? ' 💥 **CRITICAL STRIKE!**' : '';
      
      // Fetch equipped Weapon name dynamically for aesthetic combat logs
      let attackActionText = 'serangan biasa';
      try {
        const eq = require('./equipment');
        const activeEquips = eq.getPetEquipment(combatData.userId || attacker.id, guildId, attacker.name);
        const weaponItem = activeEquips.find(e => e.equip_type === 'WEAPON');
        if (weaponItem && weaponItem.durability > 0) {
          const matchedEmoji = weaponItem.elementMatch ? ' 🌟' : '';
          const elEmoji = weaponItem.element !== 'NONE' ? ` [${weaponItem.element}]` : '';
          attackActionText = `senjata **[+${weaponItem.level}] ${weaponItem.equip_name}**${elEmoji}${matchedEmoji}`;
        }
      } catch (err) {
        console.error('Error fetching weapon for combat log:', err);
      }

      const actionName = skill ? `Skill **[${skill.name}]**` : attackActionText;
      logMsg = `⚔️ **${attacker.name}** menggunakan ${actionName} ke **${defender.name}** sebesar **${damage} DMG**!${critText}${arenaSuffix}`;

      // Stats tracking
      if (attacker.statsRecap) {
        attacker.statsRecap.damageDealt += damage;
        if (isCrit) attacker.statsRecap.crits++;
      }
      if (defender.statsRecap) {
        defender.statsRecap.damageAbsorbed += Math.max(0, rawDmg - damage);
      }

      // Apply skill side-effects on hit
      if (skill) {
        if (skill.key === 'burn_slash' && Math.random() < 0.60) {
          defender.burnTurns = 2;
          logMsg += ` dan membakar tubuh lawan! (Burn 2 Turn)`;
        } else if (skill.key === 'water_jet') {
          const heal = Math.round(attacker.maxHP * 0.15);
          attacker.hp = Math.min(attacker.maxHP, attacker.hp + heal);
          logMsg += ` dan memulihkan diri sebesar **${heal} HP**!`;
        } else if (skill.key === 'frost_shield') {
          attacker.dodgeBonusTurns = 2;
          logMsg += ` dan meningkatkan peluang menghindar! (Dodge +20% 2 Turn)`;
        } else if (skill.key === 'ancient_wall') {
          attacker.shieldTurns = 2;
          logMsg += ` dan memicu Zirah Pelindung! (Shield 2 Turn)`;
        } else if (skill.key === 'earthquake') {
          defender.defBonusTurns = 2;
          logMsg += ` dan melemahkan pertahanan lawan! (DEF -20% 2 Turn)`;
        }
      }
    }

  } else if (actionType === 'ult') {
    attacker.energy = Math.max(0, attacker.energy - 60);
    attacker.hasUsedUltimate = true;

    let missChance = 0.30;
    if (attacker.tier) {
      const attTierIndex = TIERS.indexOf(attacker.tier);
      if (attTierIndex >= 20) { // Diamond & Above
        missChance = 0.05; // 5% miss chance
      } else if (attTierIndex >= 10) { // Gold / Platinum
        missChance = 0.10; // 10% miss chance
      }
    }
    const isMissed = Math.random() < missChance;
    if (isMissed) {
      logMsg = `💨 **${attacker.name}** melancarkan Jurus Ultimate, namun meleset!`;
      if (defender.statsRecap) defender.statsRecap.dodges++;
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
        const reduced = Math.round(damage * 0.10);
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

      // Rage passive for Legend / Immortal bots
      if (isCrit && defender.tier) {
        const tIndex = TIERS.indexOf(defender.tier);
        if (tIndex >= 27) { // LEGEND (27), IMMORTAL (28)
          defender.energy = Math.min(100, defender.energy + 20);
          combatData.logs.push(`⚡ **[PASIF BOT]** Terkena Critical Strike memicu amarah **${defender.name}**! (+20 SP)`);
        }
      }

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

      // Stats tracking
      if (attacker.statsRecap) {
        attacker.statsRecap.damageDealt += damage;
        if (isCrit) attacker.statsRecap.crits++;
      }
      if (defender.statsRecap) {
        defender.statsRecap.damageAbsorbed += Math.max(0, rawDmg - damage);
      }
      
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
      return interaction.reply({ content: '❌ Pertandingan Anda tidak ditemukan atau telah berakhir!', flags: 64 }).catch(() => {});
    }
    return;
  }

  if (combatData.isProcessing) {
    if (interaction && !interaction.replied && !interaction.deferred && typeof interaction.deferUpdate === 'function') {
      await interaction.deferUpdate().catch(() => {});
    }
    return;
  }
  combatData.isProcessing = true;

  if (interaction && !interaction.replied && !interaction.deferred && typeof interaction.deferUpdate === 'function' && !interaction.ephemeral) {
    await interaction.deferUpdate().catch(() => {});
  }

  const p = combatData.player;
  const b = combatData.bot;

  if (actionType === 'surr') {
    combatData.logs.push(`🏳️ **${p.name}** menyerah dari pertandingan!`);
    return endPvPGame(interaction, client, combatData, 'lose');
  }

  // --- BOT DECISION AI (Archetype-based & Predictive & Smart Survival & Item Usage) ---
  let botAction = 'atk';
  const arch = b.archetype || 'BALANCED';

  if (b.hasUsedItem === undefined) {
    b.hasUsedItem = false;
  }

  const botSpec = pet.GACHA_SPECIES[b.pet_type];
  const botBaseAtk = botSpec ? (botSpec.baseAtk || 10) : 10;
  const estimatedBotDmg = (botBaseAtk + b.stat_str * 6) * 1.5;

  const playerSpec = pet.GACHA_SPECIES[p.pet_type];
  const playerBaseAtk = playerSpec ? (playerSpec.baseAtk || 10) : 10;
  const estimatedPlayerDmg = (playerBaseAtk + p.stat_str * 6) * 1.5;

  if (b.itemsUsedCount === undefined) {
    b.itemsUsedCount = 0;
  }

  const tierIndexForItems = TIERS.indexOf(b.tier || 'BRONZE_V');
  const botHasItems = tierIndexForItems >= 5; // SILVER_V and above (index 5)
  let maxBotItems = 1;
  if (tierIndexForItems >= 20) {
    maxBotItems = 3; // Diamond & Above gets 3 uses
  } else if (tierIndexForItems >= 10) {
    maxBotItems = 2; // Gold / Platinum gets 2 uses
  }
  let botUsedItemThisTurn = false;

  // 1. VIRTUAL ITEM USAGE
  if (botHasItems && b.itemsUsedCount < maxBotItems) {
    // Virtual Medicine (heals 25% if HP is low < 30%)
    if (b.hp < b.maxHP * 0.30) {
      const healAmt = Math.round(b.maxHP * 0.25);
      b.hp = Math.min(b.maxHP, b.hp + healAmt);
      b.itemsUsedCount++;
      botUsedItemThisTurn = true;
      combatData.logs.push(`🎒 **${b.name}** menggunakan **Ramuan Kesehatan**! (+${healAmt} HP) [Sisa Item: ${maxBotItems - b.itemsUsedCount}]`);
      botAction = 'def'; // Defend turn when using item
    }
    // Virtual Soda Energy (gains 50 SP if energy < 30% and player HP is high. Platinum (index 15) and above)
    else if (tierIndexForItems >= 15 && b.energy < 30 && p.hp > p.maxHP * 0.50 && Math.random() < 0.40) {
      b.energy = Math.min(100, b.energy + 50);
      b.itemsUsedCount++;
      botUsedItemThisTurn = true;
      combatData.logs.push(`🥤 **${b.name}** meminum **Soda Energi**! (+50 SP) [Sisa Item: ${maxBotItems - b.itemsUsedCount}]`);
      botAction = 'atk';
    }
  }

  if (botUsedItemThisTurn) {
    // Action already finalized
  }
  // 2. EXECUTE INSTINCT (If bot's Ultimate can kill player, and bot has energy, use it!)
  else if (b.energy >= 60 && p.hp <= estimatedBotDmg * 2.2) {
    botAction = 'ult';
  }
  // 3. SURVIVAL INSTINCT (If bot HP is low (< 35% Max HP))
  else if (b.hp < b.maxHP * 0.35) {
    if (b.energy >= 60) {
      botAction = 'ult';
    } else {
      const r = Math.random();
      if (b.gacha_element === 'WATER' && r < 0.70) {
        botAction = 'skill1'; // water_jet heals 15%
      } else if (b.gacha_element === 'EARTH' && r < 0.70) {
        botAction = 'skill1'; // ancient_wall shields 30%
      } else {
        botAction = 'def';
      }
    }
  }
  // 4. PREDICTIVE COUNTER (If player has Ultimate ready, attempt to defend/block)
  else if (p.energy >= 60 && Math.random() < 0.80) {
    if (b.gacha_element === 'EARTH' && Math.random() < 0.50) {
      botAction = 'skill1';
    } else {
      botAction = 'def';
    }
  }
  // 5. STANDARD ARCHETYPE AI (Intelligent decision tree)
  else {
    const r = Math.random();
    if (arch === 'TANKER') {
      if (b.energy >= 60 && Math.random() < 0.40) {
        botAction = 'ult';
      } else {
        if (r < 0.40) botAction = 'skill1'; // shield/heal
        else if (r < 0.65) botAction = 'def';
        else if (r < 0.90) botAction = 'skill2'; // debuff
        else botAction = 'atk';
      }
    } else if (arch === 'GLASS_CANNON') {
      if (b.energy >= 60 && Math.random() < 0.80) {
        botAction = 'ult';
      } else {
        if (r < 0.45) botAction = 'skill2'; // high damage/crit
        else if (r < 0.75) botAction = 'skill1'; // burn/status
        else if (r < 0.95) botAction = 'atk';
        else botAction = 'def';
      }
    } else if (arch === 'ASSASSIN') {
      if (b.energy >= 60 && Math.random() < 0.75) {
        botAction = 'ult';
      } else {
        if (r < 0.45) botAction = 'skill2'; // high damage/buff
        else if (r < 0.80) botAction = 'skill1'; // ignore def/speed
        else if (r < 0.95) botAction = 'atk';
        else botAction = 'def';
      }
    } else { // BALANCED
      if (b.energy >= 60 && Math.random() < 0.50) {
        botAction = 'ult';
      } else {
        if (r < 0.30) botAction = 'skill1';
        else if (r < 0.60) botAction = 'skill2';
        else if (r < 0.85) botAction = 'atk';
        else botAction = 'def';
      }
    }
  }
  b.chosenAction = botAction;

  if (actionType === 'item_med') {
    const healAmt = Math.round(p.maxHP * 0.25);
    p.hp = Math.min(p.maxHP, p.hp + healAmt);
    p.hasUsedItem = true;
    combatData.logs.push(`🎒 **${p.name}** menggunakan **Ramuan Kesehatan**! (+${healAmt} HP)`);
    p.chosenAction = 'item_med';
  } else if (actionType === 'item_soda') {
    p.energy = Math.min(100, p.energy + 50);
    p.hasUsedItem = true;
    combatData.logs.push(`🎒 **${p.name}** meminum **Soda Energi**! (+50 SP)`);
    p.chosenAction = 'item_soda';
  } else {
    p.chosenAction = actionType;
  }

  // Find messageToEdit early for animation effect
  let messageToEdit = null;
  if (interaction && interaction.message && (!interaction.message.flags || (interaction.message.flags.bitfield & 64) === 0)) {
    messageToEdit = interaction.message;
  } else if (combatData.channelId && combatData.messageId) {
    try {
      const channel = await client.channels.fetch(combatData.channelId);
      if (channel) {
        messageToEdit = await channel.messages.fetch(combatData.messageId);
      }
    } catch (err) {}
  }

  if (messageToEdit) {
    await messageToEdit.edit({ content: `⏳ **${p.name}** sedang menyerang! Bot sedang menganalisis gerakan...`, components: [] }).catch(() => {});
    await new Promise(resolve => setTimeout(resolve, 1200));
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

  // 2. Tambah SP Serang Biasa / Skill
  if (['atk', 'skill1', 'skill2'].includes(p.chosenAction)) p.energy = Math.min(100, p.energy + 20);
  if (['atk', 'skill1', 'skill2'].includes(b.chosenAction)) b.energy = Math.min(100, b.energy + 20);

  // 3. JRPG Speed Gauge System
  const botTierIndex = TIERS.indexOf(b.tier || 'BRONZE_V');
  const botSpeedMult = botTierIndex >= 10 ? 1.2 : 0.95; // Gold V (10) and above gets same speed scaling as player
  p.gauge = (p.gauge || 0) + (p.stat_dex || 10) * 1.2;
  b.gauge = (b.gauge || 0) + (b.stat_dex || 10) * botSpeedMult;

  let first = p;
  let second = b;
  let doubleActionActor = null;

  if (b.gauge > p.gauge) {
    first = b;
    second = p;
  } else if (p.gauge === b.gauge) {
    if (Math.random() < 0.5) {
      first = b;
      second = p;
    }
  }

  first.gauge = Math.max(0, first.gauge - 100);
  // Pemain butuh 80 gauge sisa untuk Double Action. Bot di Gold V ke atas juga butuh 80, lainnya 95.
  let doubleActionThreshold = 95;
  if (first === p || (first === b && botTierIndex >= 10)) {
    doubleActionThreshold = 80;
  }
  if (first.gauge >= doubleActionThreshold) {
    doubleActionActor = first;
    first.gauge = Math.max(0, first.gauge - doubleActionThreshold);
  }

  // 4. Eksekusi Aksi
  if (first.hp > 0 && ['atk', 'ult', 'skill1', 'skill2'].includes(first.chosenAction)) {
    executeSingleAction(first, second, first.chosenAction, combatData);
    if (doubleActionActor === first && second.hp > 0) {
      combatData.logs.push(`⚡ **[DOUBLE ACTION]** Kecepatan luar biasa! **${first.name}** mendapat giliran ekstra!`);
      executeSingleAction(first, second, 'atk', combatData);
    }
  }
  if (second.hp > 0 && ['atk', 'ult', 'skill1', 'skill2'].includes(second.chosenAction)) {
    executeSingleAction(second, first, second.chosenAction, combatData);
    if (doubleActionActor === second && first.hp > 0) {
      combatData.logs.push(`⚡ **[DOUBLE ACTION]** Kecepatan luar biasa! **${second.name}** mendapat giliran ekstra!`);
      executeSingleAction(second, first, 'atk', combatData);
    }
  }

  // 5. Terapkan Burn
  applyBurnDamage(p, combatData);
  applyBurnDamage(b, combatData);

  // 6. Shield & Buff Decay
  if (p.shieldTurns > 0) p.shieldTurns--;
  if (b.shieldTurns > 0) b.shieldTurns--;
  if (p.atkBonusTurns > 0) p.atkBonusTurns--;
  if (p.defBonusTurns > 0) p.defBonusTurns--;
  if (p.dodgeBonusTurns > 0) p.dodgeBonusTurns--;
  if (b.atkBonusTurns > 0) b.atkBonusTurns--;
  if (b.defBonusTurns > 0) b.defBonusTurns--;
  if (b.dodgeBonusTurns > 0) b.dodgeBonusTurns--;

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

  resetPvPTimeout(combatData, client);

  const payload = getBattleEmbedData(combatData);
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

  const pRecap = combatData.player.statsRecap || { damageDealt: 0, damageAbsorbed: 0, dodges: 0, crits: 0 };
  const bRecap = combatData.bot.statsRecap || { damageDealt: 0, damageAbsorbed: 0, dodges: 0, crits: 0 };

  const resultEmbed = new EmbedBuilder()
    .setColor(result === 'win' ? 0x10B981 : 0xFF3366)
    .setTitle(resultTitle)
    .setDescription(`🐾 **${petObj.pet_name}** bertarung melawan **${combatData.bot.name}** di **${combatData.arena.name}**!`)
    .addFields([
      {
        name: '🎁 Hadiah & XP Laga',
        value: `• **XP Didapat:** \`+${winXp} XP\`\n` +
               `• **Pangkat:** ${rankChangesText}`,
        inline: true
      },
      {
        name: '🔋 Kondisi Akhir Pet',
        value: `• **Sisa HP:** \`${Math.min(100, nextHP)}%\` *(Dampak: -${result === 'win' ? 10 : 30}% HP)*\n` +
               `• **Kesenangan:** \`${nextHappiness}%\``,
        inline: true
      },
      {
        name: `📊 Statistik: ${combatData.player.name}`,
        value: `• **Dmg Dealt:** \`${pRecap.damageDealt} DMG\`\n` +
               `• **Dmg Blocked:** \`${pRecap.damageAbsorbed} DMG\`\n` +
               `• **Crit / Dodge:** \`${pRecap.crits}x\` / \`${pRecap.dodges}x\``,
        inline: true
      },
      {
        name: `📊 Statistik: ${combatData.bot.name}`,
        value: `• **Dmg Dealt:** \`${bRecap.damageDealt} DMG\`\n` +
               `• **Dmg Blocked:** \`${bRecap.damageAbsorbed} DMG\`\n` +
               `• **Crit / Dodge:** \`${bRecap.crits}x\` / \`${bRecap.dodges}x\``,
        inline: true
      }
    ]);

  // Process spectator bets
  if (combatData.bets && combatData.bets.length > 0) {
    const winningChoice = result === 'win' ? 'player' : 'bot';
    const totalPlayerBets = combatData.bets.filter(b => b.choice === 'player').reduce((sum, b) => sum + b.amount, 0);
    const totalBotBets = combatData.bets.filter(b => b.choice === 'bot').reduce((sum, b) => sum + b.amount, 0);
    const totalPool = totalPlayerBets + totalBotBets;

    const winners = combatData.bets.filter(b => b.choice === winningChoice);
    const totalWinningBets = winners.reduce((sum, b) => sum + b.amount, 0);

    let betFormatted = '';
    if (winners.length === 0) {
      betFormatted = `• Tidak ada penonton yang memenangkan taruhan kali ini.`;
      if (totalPool > 0) {
        economy.addBalance(config.OWNER_ID, guildId, totalPool, 'TAX_COLLECT_PVP_BATTLE');
      }
    } else {
      const losingPool = totalPool - totalWinningBets;
      const tax = Math.floor(losingPool * 0.10);
      const netLosingPool = losingPool - tax;

      if (tax > 0) {
        economy.addBalance(config.OWNER_ID, guildId, tax, 'TAX_COLLECT_PVP_BATTLE');
      }

      for (const bet of winners) {
        const share = bet.amount / totalWinningBets;
        const prize = Math.floor(bet.amount + share * netLosingPool);
        economy.addBalance(bet.userId, guildId, prize, 'PVP_BET_WON');
        betFormatted += `• <@${bet.userId}> menang **Rp ${prize.toLocaleString('id-ID')} koin**! *(Modal: Rp ${bet.amount.toLocaleString('id-ID')})*\n`;
      }
    }
    resultEmbed.addFields([{ name: '💸 Taruhan Penonton', value: betFormatted, inline: false }]);
  }

  resultEmbed.addFields([{
    name: '📝 Log Akhir Pertandingan',
    value: `\`\`\`diff\n` +
      combatData.logs.map(line => {
        if (line.includes('KEMENANGAN') || line.includes('CRITICAL') || line.includes('memberikan') || line.includes('menyerang') || line.includes('DOUBLE ACTION')) return `+ ${line}`;
        if (line.includes('KEKALAHAN') || line.includes('membalas') || line.includes('tumbang') || line.includes('menyerah')) return `- ${line}`;
        return `  ${line}`;
      }).join('\n').substring(0, 1000) +
      `\`\`\``,
    inline: false
  }])
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

  // Jika pertarungan berjalan di dalam thread, kirim hasil ke channel utama dan hapus thread
  try {
    const thread = client.channels.cache.get(combatData.channelId) || await client.channels.fetch(combatData.channelId).catch(() => null);
    if (thread && thread.isThread()) {
      const parentChannel = thread.parent || await client.channels.fetch(thread.parentId).catch(() => null);
      if (parentChannel) {
        await parentChannel.send({ content: `<@${userId}>`, embeds: [resultEmbed] }).catch(() => {});
      }
      setTimeout(async () => {
        if (combatData.parentMessageId && parentChannel) {
          const parentMsg = await parentChannel.messages.fetch(combatData.parentMessageId).catch(() => null);
          if (parentMsg) await parentMsg.delete().catch(() => {});
        }
        await thread.delete().catch(() => {});
      }, 3000);
      return;
    }
  } catch (err) {
    console.error('Failed to cleanup thread in endPvPGame:', err);
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
      // Hadiah tambahan Pet Mythic acak untuk peringkat 1, 2, dan 3
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

        db.logPetAction(row.guild_id, row.user_id, null, petName, 'SEASON_RESET_REWARD', `Menerima Pet Mythic ${chosenType} (${petName}) dari Hadiah Top ${i + 1} Season Reset.`);
        
        announcementText += `   ⭐ *Hadiah Spesial Juara ${i + 1}:* **Pet Mythic ${petInfo.emoji} ${petName}** (${chosenType})!\n`;

        // Simpan Riwayat Juara ke Hall of Fame
        const rewardDesc = `Pet Mythic ${petInfo.emoji} ${petName} (${chosenType}) & +${prizeXp} XP Pet`;
        db.run(
          `INSERT INTO pvp_season_history (season_number, user_id, guild_id, pet_name, tier, points, rank_number, reward_desc, reset_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [seasonNum, row.user_id, row.guild_id, row.pet_name, row.tier, row.points, i + 1, rewardDesc, now]
        );

      } catch (mythicErr) {
        console.error(`[PvP Season Reset] Failed to award mythic pet to top ${i + 1} player:`, mythicErr);
        // Fallback simpan riwayat jika gagal insert pet
        try {
          const rewardDesc = `+${prizeXp} XP Pet`;
          const now = Math.floor(Date.now() / 1000);
          db.run(
            `INSERT INTO pvp_season_history (season_number, user_id, guild_id, pet_name, tier, points, rank_number, reward_desc, reset_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [seasonNum, row.user_id, row.guild_id, row.pet_name, row.tier, row.points, i + 1, rewardDesc, now]
          );
        } catch(hofErr) {
          console.error('[PvP Season Reset] Failed to save Top to HOF:', hofErr);
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

    // Manage Discord Dynamic Roles for Top 3 Gladiator
    try {
      const topRoles = ['Gladiator 1', 'Gladiator 2', 'Gladiator 3'];
      for (const guild of client.guilds.cache.values()) {
        // Find or create the Gladiator roles
        const roles = [];
        for (const roleName of topRoles) {
          let role = guild.roles.cache.find(r => r.name === roleName);
          if (!role) {
            role = await guild.roles.create({
              name: roleName,
              color: roleName === 'Gladiator 1' ? '#FFD700' : roleName === 'Gladiator 2' ? '#C0C0C0' : '#CD7F32',
              reason: 'Automatic PvP Season Reset Role Creation'
            }).catch(() => null);
          }
          if (role) roles.push(role);
        }

        // Clean up previous role holders
        for (const role of roles) {
          for (const member of role.members.values()) {
            await member.roles.remove(role).catch(() => {});
          }
        }

        // Assign to new Top 3 in this guild (if they are in the guild)
        const guildTop3 = top3.filter(t => t.guild_id === guild.id);
        for (let i = 0; i < guildTop3.length; i++) {
          if (roles[i]) {
            const member = await guild.members.fetch(guildTop3[i].user_id).catch(() => null);
            if (member) {
              await member.roles.add(roles[i]).catch(err => {
                console.error(`❌ Gagal memberikan role ${roles[i].name} ke ${member.user.username}:`, err.message);
              });
            }
          }
        }
      }
    } catch (roleErr) {
      console.error('[PvP Season Reset] Gagal mengelola Discord gladiator roles:', roleErr.message);
    }

    announcementText += `\n✅ Semua pangkat pemain berhasil didegradasi. Selamat berjuang kembali di Season baru! ⚔️`;

    try {
      const settingsRow = db.get("SELECT tournament_admin_channel_id FROM ebyus_settings LIMIT 1");
      const targetChannelId = (settingsRow && settingsRow.tournament_admin_channel_id) ? settingsRow.tournament_admin_channel_id : channelId;
      if (client && client.channels && typeof client.channels.fetch === 'function') {
        const channel = await client.channels.fetch(targetChannelId).catch(() => null);
        if (channel) {
          await channel.send({ content: announcementText });
        }
      } else {
        console.log('[PvP Season Reset] client.channels.fetch is not available (likely in testing mode). Announcement details:\n', announcementText);
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

  // Reduce durability (1-2 points) of equipped items for both players (Requirement 3)
  if (challengerPet) {
    db.run(
      "UPDATE pet_equipment SET durability = CASE WHEN durability - 2 < 0 THEN 0 ELSE durability - 2 END WHERE user_id = ? AND guild_id = ? AND equipped_pet = ?",
      [challengerId, guildId, challengerPet.pet_name]
    );
  }
  if (opponentPet) {
    db.run(
      "UPDATE pet_equipment SET durability = CASE WHEN durability - 2 < 0 THEN 0 ELSE durability - 2 END WHERE user_id = ? AND guild_id = ? AND equipped_pet = ?",
      [opponentId, guildId, opponentPet.pet_name]
    );
  }

  if (!challengerPet || !opponentPet) {
    return interaction.reply({ content: '❌ Terjadi kesalahan! Pet tidak ditemukan.', flags: 64 });
  }

  const randomArena = ARENAS[Math.floor(Math.random() * ARENAS.length)];

  const nowUnix = Math.floor(Date.now() / 1000);
  const p1Stats = calculateEffectiveStats(challengerPet, nowUnix);
  const p2Stats = calculateEffectiveStats(opponentPet, nowUnix);

  const p1SpeciesInfo = pet.GACHA_SPECIES[challengerPet.pet_type];
  const p1BaseHP = p1SpeciesInfo ? (p1SpeciesInfo.baseHP || 100) : 100;
  const p1StarLevel = challengerPet.star_level || 1;
  const p1HpBonus = (p1StarLevel - 1) * 15;
  const challengerMaxHP = (p1BaseHP + p1HpBonus + p1Stats.vit * 10 + p1Stats.equipHpBonus) * 4;

  const p2SpeciesInfo = pet.GACHA_SPECIES[opponentPet.pet_type];
  const p2BaseHP = p2SpeciesInfo ? (p2SpeciesInfo.baseHP || 100) : 100;
  const p2StarLevel = opponentPet.star_level || 1;
  const p2HpBonus = (p2StarLevel - 1) * 15;
  const opponentMaxHP = (p2BaseHP + p2HpBonus + p2Stats.vit * 10 + p2Stats.equipHpBonus) * 4;

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
      chosenAction: null,
      statsRecap: { damageDealt: 0, damageAbsorbed: 0, dodges: 0, crits: 0 }
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
      chosenAction: null,
      statsRecap: { damageDealt: 0, damageAbsorbed: 0, dodges: 0, crits: 0 }
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
    if (actor.dodgeBonusTurns > 0) buffs.push(`💨 Dodge +20% (${actor.dodgeBonusTurns}T)`);
    if (actor.defBonusTurns > 0) buffs.push(`🧱 Def Reduced (${actor.defBonusTurns}T)`);
    if (actor.atkBonusTurns > 0) buffs.push(`⚔️ ATK +25% (${actor.atkBonusTurns}T)`);
    return buffs.length > 0 ? buffs.join(' · ') : '*Normal*';
  };

  const getStatusText = (actor) => {
    if (actor.chosenAction) return '🟢 **Ready**';
    return '⏳ *Memilih...*';
  };

  const arenaInfo = combatData.arena ? `🏟️ **Lokasi: ${combatData.arena.name}**\n*ℹ️ ${combatData.arena.desc}*\n\n` : '';

  const sortedGauges = [
    { name: `🐾 ${p1.name}`, gauge: p1.gauge || 0 },
    { name: `⚔️ ${p2.name}`, gauge: p2.gauge || 0 }
  ].sort((a, b) => b.gauge - a.gauge);
  const timelineText = `🏃 **Urutan Giliran Berikutnya:**\n` +
                       `• **${sortedGauges[0].name}** (Gauge: \`${Math.round(sortedGauges[0].gauge)}/100\`)\n` +
                       `• **${sortedGauges[1].name}** (Gauge: \`${Math.round(sortedGauges[1].gauge)}/100\`)\n\n`;

  const embed = new EmbedBuilder()
    .setColor(0x7C4DFF)
    .setTitle(`⚔️ PVP ARENA: ${p1.name} VS ${p2.name}`)
    .setDescription(
      arenaInfo +
      `🏟️ **Ronde ${combatData.turnCount}**\n` +
      `Pilihlah tindakan pet Anda untuk giliran ini. Gunakan tombol di bawah ini!\n\n` +
      `👟 **Action Speed Gauge:**\n` +
      `• **${p1.name}**: \`${Math.round(p1.gauge || 0)} / 100\`\n` +
      `• **${p2.name}**: \`${Math.round(p2.gauge || 0)} / 100\`\n\n` +
      timelineText +
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
        if (line.includes('KEMENANGAN') || line.includes('CRITICAL') || line.includes('menyerang') || line.includes('memberikan') || line.includes('DOUBLE ACTION')) return `+ ${line}`;
        if (line.includes('KEKALAHAN') || line.includes('membalas') || line.includes('tumbang') || line.includes('melarikan') || line.includes('menyerah')) return `- ${line}`;
        return `  ${line}`;
      }).join('\n') +
      `\`\`\``
    )
    .setFooter({ text: 'Taruhan: Rp ' + combatData.betAmount.toLocaleString('id-ID') + ' koin' });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('pvp_act_atk')
      .setLabel('🗡️ Serang (+20 SP)')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('pvp_act_skill1')
      .setLabel('🔮 Skill 1 (+20 SP)')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('pvp_act_skill2')
      .setLabel('🔮 Skill 2 (+20 SP)')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('pvp_act_ult')
      .setLabel('🔥 Ultimate (60 SP)')
      .setStyle(ButtonStyle.Danger)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('pvp_act_item')
      .setLabel('🎒 Item')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('pvp_act_surr')
      .setLabel('🏳️ Menyerah')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row1, row2] };
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
    return interaction.reply({ content: '❌ Pertandingan Anda tidak ditemukan atau telah berakhir!', flags: 64 }).catch(() => {});
  }

  if (combatData.isProcessing) {
    if (interaction && !interaction.replied && !interaction.deferred && typeof interaction.deferUpdate === 'function') {
      await interaction.deferUpdate().catch(() => {});
    }
    return;
  }

  const p1 = combatData.p1;
  const p2 = combatData.p2;

  const actor = user.id === p1.id ? p1 : (user.id === p2.id ? p2 : null);
  const enemy = actor === p1 ? p2 : p1;

  if (!actor) {
    return interaction.reply({ content: '❌ Anda tidak berada dalam pertarungan ini!', flags: 64 }).catch(() => {});
  }

  if (actionType === 'surr') {
    combatData.isProcessing = true;
    combatData.logs.push(`🏳️ **${actor.name}** menyerah dari pertandingan!`);
    return endPvPGamePvP(interaction, client, combatData, enemy.id, 'surrender');
  }

  if (actor.chosenAction) {
    return interaction.reply({ content: '❌ Anda sudah memilih tindakan untuk giliran ini!', flags: 64 }).catch(() => {});
  }

  if (actionType === 'ult' && actor.energy < 60) {
    return interaction.reply({ content: '❌ Energi Pet Anda tidak cukup (butuh 60 SP)!', flags: 64 }).catch(() => {});
  }

  if ((actionType === 'item_med' || actionType === 'item_soda') && actor.hasUsedItem) {
    return interaction.reply({ content: '❌ Anda sudah menggunakan item di pertarungan ini!', flags: 64 }).catch(() => {});
  }

  if (interaction && !interaction.replied && !interaction.deferred && typeof interaction.deferUpdate === 'function' && !interaction.ephemeral) {
    await interaction.deferUpdate().catch(() => {});
  }

  if (actionType === 'item_med') {
    const healAmt = Math.round(actor.maxHP * 0.25);
    actor.hp = Math.min(actor.maxHP, actor.hp + healAmt);
    actor.hasUsedItem = true;
    combatData.logs.push(`🎒 **${actor.name}** menggunakan **Ramuan Kesehatan**! (+${healAmt} HP)`);
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

    if (['atk', 'skill1', 'skill2'].includes(p1.chosenAction)) p1.energy = Math.min(100, p1.energy + 20);
    if (['atk', 'skill1', 'skill2'].includes(p2.chosenAction)) p2.energy = Math.min(100, p2.energy + 20);

    let messageToEdit = null;
    if (combatData.channelId && combatData.messageId) {
      try {
        const channel = await client.channels.fetch(combatData.channelId);
        if (channel) {
          messageToEdit = await channel.messages.fetch(combatData.messageId);
        }
      } catch (err) {}
    }

    if (messageToEdit) {
      await messageToEdit.edit({ content: `⏳ Kedua pet sedang beradu mekanik! Ronde dihitung...`, components: [] }).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 1200));
    }

    // 3. JRPG Speed Gauge System
    p1.gauge = (p1.gauge || 0) + (p1.stat_dex || 10) * 1.2;
    p2.gauge = (p2.gauge || 0) + (p2.stat_dex || 10) * 1.2;

    let first = p1;
    let second = p2;
    let doubleActionActor = null;

    if (p2.gauge > p1.gauge) {
      first = p2;
      second = p1;
    } else if (p1.gauge === p2.gauge) {
      if (Math.random() < 0.5) {
        first = p2;
        second = p1;
      }
    }

    first.gauge = Math.max(0, first.gauge - 100);
    if (first.gauge >= 80) {
      doubleActionActor = first;
      first.gauge = Math.max(0, first.gauge - 80);
    }

    // 4. Eksekusi Aksi
    if (first.hp > 0 && ['atk', 'ult', 'skill1', 'skill2'].includes(first.chosenAction)) {
      executeSingleAction(first, second, first.chosenAction, combatData);
      if (doubleActionActor === first && second.hp > 0) {
        combatData.logs.push(`⚡ **[DOUBLE ACTION]** Kecepatan luar biasa! **${first.name}** mendapat giliran ekstra!`);
        executeSingleAction(first, second, 'atk', combatData);
      }
    }
    if (second.hp > 0 && ['atk', 'ult', 'skill1', 'skill2'].includes(second.chosenAction)) {
      executeSingleAction(second, first, second.chosenAction, combatData);
      if (doubleActionActor === second && first.hp > 0) {
        combatData.logs.push(`⚡ **[DOUBLE ACTION]** Kecepatan luar biasa! **${second.name}** mendapat giliran ekstra!`);
        executeSingleAction(second, first, 'atk', combatData);
      }
    }

    applyBurnDamage(p1, combatData);
    applyBurnDamage(p2, combatData);

    // Shield & Buff Decay
    if (p1.shieldTurns > 0) p1.shieldTurns--;
    if (p2.shieldTurns > 0) p2.shieldTurns--;
    if (p1.atkBonusTurns > 0) p1.atkBonusTurns--;
    if (p1.defBonusTurns > 0) p1.defBonusTurns--;
    if (p1.dodgeBonusTurns > 0) p1.dodgeBonusTurns--;
    if (p2.atkBonusTurns > 0) p2.atkBonusTurns--;
    if (p2.defBonusTurns > 0) p2.defBonusTurns--;
    if (p2.dodgeBonusTurns > 0) p2.dodgeBonusTurns--;

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
      } catch (err) {}
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

  const p1Recap = combatData.p1.statsRecap || { damageDealt: 0, damageAbsorbed: 0, dodges: 0, crits: 0 };
  const p2Recap = combatData.p2.statsRecap || { damageDealt: 0, damageAbsorbed: 0, dodges: 0, crits: 0 };

  const resultEmbed = new EmbedBuilder()
    .setColor(0x10B981)
    .setTitle(resultTitle)
    .setDescription(`🐾 **${winnerName}** berhasil memenangkan duel melawan **${loserName}**!`)
    .addFields([
      {
        name: '🎁 Hasil Pertandingan',
        value: `• **Pemenang:** <@${winnerId}>\n• **Hadiah Bersih:** Rp \`${prizePool.toLocaleString('id-ID')}\` koin`,
        inline: true
      },
      {
        name: '🔋 XP Pet Didapat',
        value: `• **${winnerName}**: \`+50 XP\`\n• **${loserName}**: \`+20 XP\``,
        inline: true
      },
      {
        name: `📊 Statistik: ${combatData.p1.name}`,
        value: `• **Dmg Dealt:** \`${p1Recap.damageDealt} DMG\`\n` +
               `• **Dmg Blocked:** \`${p1Recap.damageAbsorbed} DMG\`\n` +
               `• **Crit / Dodge:** \`${p1Recap.crits}x\` / \`${p1Recap.dodges}x\``,
        inline: true
      },
      {
        name: `📊 Statistik: ${combatData.p2.name}`,
        value: `• **Dmg Dealt:** \`${p2Recap.damageDealt} DMG\`\n` +
               `• **Dmg Blocked:** \`${p2Recap.damageAbsorbed} DMG\`\n` +
               `• **Crit / Dodge:** \`${p2Recap.crits}x\` / \`${p2Recap.dodges}x\``,
        inline: true
      },
      {
        name: '📝 Log Akhir Pertandingan',
        value: `\`\`\`diff\n` +
          combatData.logs.map(line => {
            if (line.includes('KEMENANGAN') || line.includes('CRITICAL') || line.includes('memberikan') || line.includes('menyerang') || line.includes('DOUBLE ACTION')) return `+ ${line}`;
            if (line.includes('KEKALAHAN') || line.includes('membalas') || line.includes('tumbang') || line.includes('menyerah')) return `- ${line}`;
            return `  ${line}`;
          }).join('\n').substring(0, 1000) +
          `\`\`\``,
        inline: false
      }
    ])
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

async function handleBetInteraction(interaction, client) {
  const { StringSelectMenuBuilder } = require('discord.js');
  const customId = interaction.customId;
  const user = interaction.user;
  const guildId = interaction.guildId;

  const parts = customId.split('_');
  const action = parts[2];
  const trainerId = parts[3];

  const combatData = client.activePvPBotGames ? client.activePvPBotGames.get(trainerId) : null;
  if (!combatData) {
    if (interaction.isStringSelectMenu()) {
      return interaction.update({ content: '❌ Pertandingan tidak ditemukan atau telah berakhir!', components: [] });
    }
    return interaction.reply({ content: '❌ Pertandingan tidak ditemukan atau telah berakhir!', flags: 64 });
  }

  if (user.id === trainerId) {
    return interaction.reply({ content: '❌ Anda tidak bisa bertaruh pada pertandingan Anda sendiri!', flags: 64 });
  }

  if (action === 'start') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pvpbot_bet_side_${trainerId}_player`)
        .setLabel(`🐾 Dukung Pet (${combatData.player.name})`)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`pvpbot_bet_side_${trainerId}_bot`)
        .setLabel(`🤖 Dukung Bot (${combatData.bot.name})`)
        .setStyle(ButtonStyle.Danger)
    );
    return interaction.reply({ content: 'Silakan pilih pihak yang ingin Anda dukung:', components: [row], flags: 64 });
  }

  if (action === 'side') {
    const side = parts[4];
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`pvpbot_bet_select_${trainerId}_${side}`)
      .setPlaceholder('Pilih jumlah koin taruhan...')
      .addOptions([
        { label: 'Rp 2.000 koin', value: '2000' },
        { label: 'Rp 5.000 koin', value: '5000' },
        { label: 'Rp 10.000 koin', value: '10000' },
        { label: 'Rp 25.000 koin', value: '25000' },
        { label: 'Rp 50.000 koin', value: '50000' }
      ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);
    return interaction.update({ content: `Dukungan: **${side === 'player' ? 'Pet Trainer' : 'Bot Musuh'}**.\nSekarang pilih jumlah taruhan Anda:`, components: [row] });
  }

  if (action === 'select') {
    const side = parts[4];
    const amount = parseInt(interaction.values[0]);

    const wallet = economy.getWallet(user.id, guildId);
    if (!wallet || wallet.balance < amount) {
      return interaction.update({ content: `❌ Saldo Dompet Anda tidak cukup! (Milik Anda: Rp ${wallet?.balance?.toLocaleString('id-ID') || 0})`, components: [] });
    }

    economy.subtractBalance(user.id, guildId, amount, 'PVP_SPECTATOR_BET');

    combatData.bets = combatData.bets || [];
    const existingBet = combatData.bets.find(b => b.userId === user.id);
    if (existingBet) {
      economy.addBalance(user.id, guildId, existingBet.amount, 'PVP_BET_REFUND');
      existingBet.amount = amount;
      existingBet.choice = side;
    } else {
      combatData.bets.push({ userId: user.id, choice: side, amount });
    }

    return interaction.update({
      content: `✅ **Taruhan Berhasil!**\nAnda memasang **Rp ${amount.toLocaleString('id-ID')}** koin untuk mendukung **${side === 'player' ? 'Pet Trainer' : 'Bot Musuh'}**!`,
      components: []
    });
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
  showPvPHallOfFame,
  handleBetInteraction,
  executeSingleAction
};

