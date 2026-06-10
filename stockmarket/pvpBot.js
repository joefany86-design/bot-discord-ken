const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('./database');
const pet = require('./pet');
const economy = require('./economy');
const config = require('./config');

const TIERS = [
  'BRONZE_V', 'BRONZE_IV', 'BRONZE_III', 'BRONZE_II', 'BRONZE_I',
  'SILVER_V', 'SILVER_IV', 'SILVER_III', 'SILVER_II', 'SILVER_I',
  'GOLD_V', 'GOLD_IV', 'GOLD_III', 'GOLD_II', 'GOLD_I',
  'PLATINUM_V', 'PLATINUM_IV', 'PLATINUM_III', 'PLATINUM_II', 'PLATINUM_I',
  'DIAMOND_V', 'DIAMOND_IV', 'DIAMOND_III', 'DIAMOND_II', 'DIAMOND_I',
  'MASTER', 'GRANDMASTER', 'LEGEND', 'IMMORTAL'
];

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
function generateBotForTier(tierKey) {
  const tierIndex = TIERS.indexOf(tierKey);
  const totalPoints = 15 + tierIndex * 8;

  const archetypes = ['TANKER', 'GLASS_CANNON', 'ASSASSIN', 'BALANCED'];
  const archetype = archetypes[Math.floor(Math.random() * archetypes.length)];

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
    stat_dex: dex
  };
}

function getPvpStatsDescription(petObj, pvpState) {
  const maxHP = 100 + (petObj.stat_vit || 0) * 10;
  const baseAtk = 20 + (petObj.stat_str || 0) * 3;
  const defPercent = Math.min(75, (petObj.stat_def || 0) * 0.5);
  const critPercent = Math.min(40, (petObj.stat_dex || 0) * 0.5);

  const totalGymStats = (petObj.stat_str || 0) + (petObj.stat_vit || 0) + (petObj.stat_def || 0) + (petObj.stat_dex || 0);

  return `🏋️ **Statistik Tempur Arena (Berdasarkan Gym):**\n` +
         `• ❤️ **Max HP:** \`${maxHP} HP\` *(+10 per VIT)*\n` +
         `• ⚔️ **Base ATK:** \`${baseAtk} DMG\` *(+3 per STR)*\n` +
         `• 🛡️ **Damage Reduction:** \`${defPercent.toFixed(1)}%\` *(+0.5% per DEF, maks 75%)*\n` +
         `• ⚡ **Crit Chance:** \`${critPercent.toFixed(1)}%\` *(+0.5% per DEX, maks 40%)*\n` +
         `• 👟 **Total Gym Stats:** \`${totalGymStats} Poin\`\n` +
         `\n🏆 **Liga Progres PvP Bot:**\n` +
         `• 🌟 **Tier/Pangkat:** **${getFriendlyTierName(pvpState.tier)}**\n` +
         `• 📊 **Poin Liga:** **${pvpState.tier === 'IMMORTAL' ? `${pvpState.points} LP` : `${pvpState.points}/100 LP`}** *(Win +25, Lose -10)*\n` +
         `• 🥤 **Tantangan Harian:** **${pvpState.daily_attempts}/5** gratis terpakai hari ini.`;
}

async function showPvPArena(message, client) {
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
      .setStyle(ButtonStyle.Primary)
  );

  return message.reply({ embeds: [embed], components: [row] });
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

  const embed = new EmbedBuilder()
    .setColor(0x7C4DFF)
    .setTitle(`⚔️ PVP ARENA: ${p.name} VS ${b.name}`)
    .setDescription(
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
    .setFooter({ text: 'Gunakan tombol di bawah untuk menyerang, bertahan, ultimate, atau menyerah!' });

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
      .setCustomId('pvpbot_act_surr')
      .setLabel('🏳️ Menyerah')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
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

  // Kuota Harian
  let usedSoda = false;
  if (pvpState.daily_attempts >= 5) {
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

    db.run(
      'UPDATE user_pet_pvp_bot SET daily_attempts = daily_attempts + 1 WHERE user_id = ? AND guild_id = ? AND pet_name = ?',
      [user.id, guildId, petObj.pet_name]
    );

    const botOpponent = generateBotForTier(pvpState.tier);

    // Hitung status tempur awal berbasis Gym Stats (TANPA Level)
    const playerMaxHP = 100 + (petObj.stat_vit || 0) * 10;
    const botMaxHP = 100 + botOpponent.stat_vit * 10;

    // Siapkan object game state
    const combatData = {
      guildId,
      userId: user.id,
      turnCount: 1,
      logs: [`⚔️ Pertandingan liga dimulai melawan **${botOpponent.name}**!`],
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
        stat_str: petObj.stat_str || 0,
        stat_vit: petObj.stat_vit || 0,
        stat_def: petObj.stat_def || 0,
        stat_dex: petObj.stat_dex || 0,
        base_atk_bonus_pct: petObj.base_atk_bonus_pct || 0.0,
        base_def_bonus_pct: petObj.base_def_bonus_pct || 0.0,
        trait: petObj.trait || '',
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
        trait: '',
        accessory: null,
        chosenAction: null
      }
    };

    const payload = getBattleEmbedData(combatData);
    const battleMsg = await interaction.channel.send(payload);

    combatData.messageId = battleMsg.id;

    // Simpan game state di memori
    client.activePvPBotGames.set(user.id, combatData);

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

  // Attacker buffs
  let atkMultiplier = attacker.pet_type === 'DRAGON' ? 1.15 : 1.0;
  if (attacker.trait === 'WARRIOR') atkMultiplier += 0.15;
  if (attacker.accessory === 'SWORD_TOY') atkMultiplier += 0.15;
  atkMultiplier += (attacker.base_atk_bonus_pct || 0.0);

  // Defender buffs
  let defMultiplier = 1.0;
  if (defender.trait === 'STURDY') defMultiplier *= 0.85;

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

  if (actionType === 'atk') {
    isDodged = Math.random() < dodgeChance;
    if (isDodged) {
      logMsg = `💨 **${attacker.name}** melancarkan serangan, namun **${defender.name}** berhasil menghindar!`;
    } else {
      isCrit = Math.random() < critChance;
      let rawDmg = Math.round(attackerATK * atkMultiplier * (0.8 + Math.random() * 0.4));
      if (isCrit) rawDmg = Math.round(rawDmg * 1.5);

      let defFactor = defenderDEF / 150;
      if (defFactor > 0.8) defFactor = 0.8;
      damage = Math.round(rawDmg * (1 - defFactor) * defMultiplier);
      if (defender.isDefending) damage = Math.round(damage * 0.5);

      // Shield reduction (absorb 40%)
      if (defender.shieldTurns > 0) {
        const shieldReduced = Math.round(damage * 0.40);
        damage = Math.max(1, damage - shieldReduced);
        combatData.logs.push(`🛡️ **[SHIELD]** Zirah Gunung Purba melindungi **${defender.name}** dan menyerap **${shieldReduced} DMG**!`);
      }

      if (damage < 1) damage = 1;

      defender.hp = Math.max(0, defender.hp - damage);
      const critText = isCrit ? ' 💥 **CRITICAL STRIKE!**' : '';
      logMsg = `⚔️ **${attacker.name}** menyerang **${defender.name}** sebesar **${damage} DMG**!${critText}`;
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
      let rawDmg = Math.round((attackerATK * mult) * atkMultiplier * (0.8 + Math.random() * 0.4));
      if (isCrit) rawDmg = Math.round(rawDmg * 1.5);

      let defFactor = defenderDEF / 150;
      if (defFactor > 0.8) defFactor = 0.8;
      damage = Math.round(rawDmg * (1 - defFactor) * defMultiplier);
      if (defender.isDefending) damage = Math.round(damage * 0.5);

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

      logMsg = `🔥 **${attacker.name}** menggunakan Ultimate **${ultName}** sebesar **${damage} DMG**!${critText}`;
      
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
  const { guildId, user } = interaction;
  
  const combatData = client.activePvPBotGames ? client.activePvPBotGames.get(user.id) : null;
  if (!combatData) {
    return interaction.reply({ content: '❌ Pertandingan Anda tidak ditemukan atau telah berakhir!', flags: 64 });
  }

  await interaction.deferUpdate().catch(() => {});

  const p = combatData.player;
  const b = combatData.bot;

  if (actionType === 'surr') {
    combatData.logs.push(`🏳️ **${p.name}** menyerah dari pertandingan!`);
    return endPvPGame(interaction, client, combatData, 'lose');
  }

  // --- BOT DECISION AI ---
  let botAction = 'atk';
  if (b.energy >= 60) {
    botAction = Math.random() < 0.65 ? 'ult' : 'atk';
  } else if (b.hp < b.maxHP * 0.30 && p.energy >= 60) {
    botAction = Math.random() < 0.40 ? 'def' : 'atk';
  } else {
    botAction = Math.random() < 0.80 ? 'atk' : 'def';
  }
  b.chosenAction = botAction;
  p.chosenAction = actionType;

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

  // Update embed & buttons
  const payload = getBattleEmbedData(combatData);
  await interaction.message.edit(payload).catch(() => {});
}

/**
 * Menyelesaikan game, memberikan rewards LP/XP, memotong HP pet, dan membersihkan data memori
 */
async function endPvPGame(interaction, client, combatData, result) {
  const { guildId, userId } = combatData;

  // Bersihkan dari memori game aktif
  client.activePvPBotGames.delete(userId);

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
    let nextPoints = pvpState.points + 25;
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
      rankChangesText = `📈 LP bertambah **+25 LP** *(Poin sekarang: ${nextPoints}/100 LP)*`;
    }

    db.transaction(() => {
      db.run(
        'UPDATE user_pet_pvp_bot SET tier = ?, points = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?',
        [nextTier, nextPoints, userId, guildId, petObj.pet_name]
      );
    })();

    resultTitle = `🎉 KEMENANGAN ARENA!`;
    resultDesc = `**${petObj.pet_name}** berhasil menaklukkan **${combatData.bot.name}**!\n\n` +
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
        'UPDATE user_pet_pvp_bot SET tier = ?, points = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?',
        [nextTier, nextPoints, userId, guildId, petObj.pet_name]
      );
    })();

    resultTitle = `💀 KEKALAHAN ARENA!`;
    resultDesc = `**${petObj.pet_name}** tumbang dalam pertarungan melawan **${combatData.bot.name}**!\n\n` +
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

  await interaction.message.edit({ embeds: [resultEmbed], components: [] }).catch(() => {});

  // Hapus pesan hasil pertarungan setelah 15 detik agar channel tetap bersih
  setTimeout(async () => {
    await interaction.message.delete().catch(() => {});
  }, 15000);
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

module.exports = {
  showPvPArena,
  startPvPChallenge,
  showPvPLeaderboard,
  handlePvPAction,
  getFriendlyTierName,
  getOrCreatePvPState
};
