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
  
  // Base points: Bronze V mulai dari 15, bertambah 8 points tiap kenaikan tier index
  const totalPoints = 15 + tierIndex * 8;

  // Pilih tipe spesialisasi acak (Archetype)
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
    // BALANCED
    str = Math.round(totalPoints * 0.25);
    vit = Math.round(totalPoints * 0.25);
    def = Math.round(totalPoints * 0.25);
    dex = totalPoints - (str + vit + def);
  }

  // Pastikan tidak ada statistik negatif
  str = Math.max(1, str);
  vit = Math.max(1, vit);
  def = Math.max(1, def);
  dex = Math.max(1, dex);

  // Kustom nama bot & spesies berdasarkan archetype
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

/**
 * Formats pet pvp stats into a beautiful description
 */
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

/**
 * Tampilkan panel Dashboard PvP Bot Arena
 */
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

  // Cari sisa Soda Energy di inventory untuk info di panel
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
 * Jalankan simulasi pertarungan PvP vs Bot secara dinamis (Live Text Edit)
 */
async function startPvPChallenge(interaction, client, petName) {
  const { guildId, user } = interaction;
  
  // Set lock agar tidak bisa double spam battle
  client.activePvPBotBattles = client.activePvPBotBattles || new Set();
  if (client.activePvPBotBattles.has(user.id)) {
    return interaction.reply({ content: '❌ Pet Anda sedang dalam simulasi pertarungan PvP Bot Arena! Harap tunggu pertarungan selesai.', flags: 64 });
  }

  // Defer Update
  await interaction.deferUpdate().catch(() => {});

  const petObj = pet.getPet(user.id, guildId);
  if (!petObj || petObj.pet_name !== petName) {
    return interaction.followUp({ content: '❌ Terjadi kesalahan! Pet aktif tidak ditemukan atau telah diganti.', flags: 64 });
  }
  if (petObj.status === 'DEAD' || petObj.status === 'EGG') {
    return interaction.followUp({ content: '❌ Kondisi pet tidak memenuhi syarat tanding!', flags: 64 });
  }
  if (petObj.health < 20) {
    return interaction.followUp({ content: '❌ Pet Anda terlalu lelah (HP < 20)! Berikan makanan/obat terlebih dahulu sebelum bertanding.', flags: 64 });
  }

  const pvpState = getOrCreatePvPState(user.id, guildId, petObj.pet_name);

  // Batasan kuota harian (5 gratis)
  let usedSoda = false;
  if (pvpState.daily_attempts >= 5) {
    // Cek Soda Energy
    const sodaRow = db.get("SELECT quantity FROM pet_inventory WHERE user_id = ? AND guild_id = ? AND item_id = 'SODA_ENERGY'", [user.id, guildId]);
    if (!sodaRow || sodaRow.quantity <= 0) {
      return interaction.followUp({
        content: '❌ **Kuota harian habis!** Anda telah menggunakan 5 tantangan gratis hari ini. Anda butuh **🥤 Soda Energi Pet** (`.pet pakai soda_energy` atau beli di toko) untuk bertanding kembali.',
        flags: 64
      });
    }
    usedSoda = true;
  }

  // Kunci pertempuran pemain
  client.activePvPBotBattles.add(user.id);

  try {
    // Kurangi soda jika menggunakan
    if (usedSoda) {
      db.run("UPDATE pet_inventory SET quantity = quantity - 1 WHERE user_id = ? AND guild_id = ? AND item_id = 'SODA_ENERGY'", [user.id, guildId]);
    }

    // Naikkan jumlah attempts harian
    db.run(
      'UPDATE user_pet_pvp_bot SET daily_attempts = daily_attempts + 1 WHERE user_id = ? AND guild_id = ? AND pet_name = ?',
      [user.id, guildId, petObj.pet_name]
    );

    // Generate musuh bot
    const botOpponent = generateBotForTier(pvpState.tier);

    // --- FORMULA COMBAT BERDASARKAN GYM STATS ---
    // Player
    const playerMaxHP = 100 + (petObj.stat_vit || 0) * 10;
    const playerBaseAtk = 20 + (petObj.stat_str || 0) * 3;
    const playerDefMult = 1.0 - Math.min(0.75, (petObj.stat_def || 0) * 0.005);
    const playerCritChance = Math.min(0.40, (petObj.stat_dex || 0) * 0.005);

    // Bot
    const botMaxHP = 100 + botOpponent.stat_vit * 10;
    const botBaseAtk = 20 + botOpponent.stat_str * 3;
    const botDefMult = 1.0 - Math.min(0.75, botOpponent.stat_def * 0.005);
    const botCritChance = Math.min(0.40, botOpponent.stat_dex * 0.005);

    let pHP = playerMaxHP;
    let bHP = botMaxHP;

    // Hitung pengali elemen
    let pAtkMult = 1.0;
    let bAtkMult = 1.0;

    // Check trait
    if (petObj.trait === 'WARRIOR') pAtkMult += 0.15;
    if (petObj.accessory === 'SWORD_TOY') pAtkMult += 0.15;
    pAtkMult += (petObj.base_atk_bonus_pct || 0.0);

    // Element advantage
    const playerHasAdv = pet.isElementAdvantage(petObj.gacha_element, botOpponent.gacha_element);
    const botHasAdv = pet.isElementAdvantage(botOpponent.gacha_element, petObj.gacha_element);

    let elementNote = '';
    if (playerHasAdv) {
      pAtkMult += 0.25;
      elementNote = `⭐ **Keunggulan Elemen:** Elemen **${petObj.gacha_element}** pet Anda unggul melawan elemen **${botOpponent.gacha_element}** bot! (+25% ATK)`;
    } else if (botHasAdv) {
      bAtkMult += 0.25;
      elementNote = `⚠️ **Kerugian Elemen:** Elemen **${botOpponent.gacha_element}** bot unggul melawan elemen **${petObj.gacha_element}** pet Anda! (Bot +25% ATK)`;
    }

    const logs = [];
    logs.push(`⚔️ **Pertempuran Dimulai!**`);
    logs.push(`🐾 **${petObj.pet_name}** (HP: ${pHP}) VS **${botOpponent.name}** (HP: ${bHP})`);
    if (elementNote) logs.push(elementNote);

    const botArchetypeEmoji = {
      TANKER: '🛡️ TANKER (HP/DEF Tinggi)',
      GLASS_CANNON: '🔥 GLASS CANNON (STR Tinggi)',
      ASSASSIN: '⚡ ASSASSIN (STR/DEX Tinggi)',
      BALANCED: '⚖️ BALANCED (Statistik Merata)'
    };
    logs.push(`🤖 Musuh: **${botArchetypeEmoji[botOpponent.archetype]}** dengan elemen **${botOpponent.gacha_element}**.`);

    // Buat embed tempur awal
    const battleEmbed = new EmbedBuilder()
      .setColor(0x7C4DFF)
      .setTitle(`⚔️ PVP ARENA: ${petObj.pet_name} VS ${botOpponent.name}`)
      .setDescription(`\`\`\`diff\n${logs.join('\n')}\n\`\`\``)
      .setFooter({ text: 'Mempersiapkan ronde pertempuran...' });

    const battleMsg = await interaction.channel.send({ embeds: [battleEmbed] });

    let round = 1;
    const maxRounds = 10;
    let isWin = false;
    let isDraw = false;

    // Loop pertempuran asinkron untuk live-editing message
    while (round <= maxRounds && pHP > 0 && bHP > 0) {
      // Tunggu 1.5 detik per ronde agar ada efek menonton siaran langsung
      await new Promise(resolve => setTimeout(resolve, 1500));

      const roundLogs = [];
      roundLogs.push(`\n--- RONDE ${round} ---`);

      // 1. Giliran Player menyerang Bot
      let pDmg = Math.round(playerBaseAtk * pAtkMult * (0.8 + Math.random() * 0.4));
      pDmg = Math.round(pDmg * botDefMult);
      const isPlayerCrit = Math.random() < playerCritChance;
      if (isPlayerCrit) pDmg = Math.round(pDmg * 1.5);

      bHP = Math.max(0, bHP - pDmg);
      const pCritText = isPlayerCrit ? ' 💥 **CRITICAL STRIKE!**' : '';
      roundLogs.push(`+ ${petObj.pet_name} memberikan ${pDmg} DMG!${pCritText} (${botOpponent.name} HP: ${bHP})`);

      if (bHP <= 0) {
        isWin = true;
        logs.push(roundLogs.join('\n'));
        break;
      }

      // 2. Giliran Bot menyerang Player
      let bDmg = Math.round(botBaseAtk * bAtkMult * (0.8 + Math.random() * 0.4));
      bDmg = Math.round(bDmg * playerDefMult);
      const isBotCrit = Math.random() < botCritChance;
      if (isBotCrit) bDmg = Math.round(bDmg * 1.5);

      pHP = Math.max(0, pHP - bDmg);
      const bCritText = isBotCrit ? ' 💥 **CRITICAL STRIKE!**' : '';
      roundLogs.push(`- ${botOpponent.name} membalas sebesar ${bDmg} DMG!${bCritText} (${petObj.pet_name} HP: ${pHP})`);

      logs.push(roundLogs.join('\n'));

      if (pHP <= 0) {
        break;
      }

      // Update embed untuk ronde saat ini
      const roundEmbed = new EmbedBuilder()
        .setColor(0x7C4DFF)
        .setTitle(`⚔️ PVP ARENA: ${petObj.pet_name} VS ${botOpponent.name}`)
        .setDescription(`\`\`\`diff\n${logs.join('\n').substring(0, 1900)}\n\`\`\``)
        .setFooter({ text: `Ronde ${round} selesai...` });
      
      await battleMsg.edit({ embeds: [roundEmbed] }).catch(() => {});

      round++;
    }

    if (pHP > 0 && bHP > 0) {
      isDraw = true;
    }

    // --- PROSES PASCA COMBAT (Hadiah & Poin Liga) ---
    let resultTitle = '';
    let resultDesc = '';
    let winXp = 0;
    let rankChangesText = '';

    const currentTierIndex = TIERS.indexOf(pvpState.tier);

    // HP & Happiness changes
    let nextHP = Math.max(10, petObj.health - 10); // Default berkurang 10 HP
    let nextHappiness = Math.max(10, petObj.happiness - 10);

    if (isWin) {
      winXp = 50 + currentTierIndex * 10;
      
      // Update Rank Points (+25)
      let nextPoints = pvpState.points + 25;
      let nextTier = pvpState.tier;

      if (nextPoints >= 100) {
        if (currentTierIndex < TIERS.length - 1) {
          const nextTierIndex = currentTierIndex + 1;
          nextTier = TIERS[nextTierIndex];
          nextPoints = nextTier === 'IMMORTAL' ? 0 : nextPoints - 100;
          rankChangesText = `🎉 **PROMOSI TIER!** Pet Anda naik pangkat menjadi **${getFriendlyTierName(nextTier)}**!`;
        } else {
          // Sudah IMMORTAL, poin bertambah terus tanpa cap 100
          rankChangesText = `👑 Pertahankan posisi Anda di Puncak Immortal!`;
        }
      } else {
        rankChangesText = `📈 Poin Liga bertambah **+25 LP** *(Poin sekarang: ${nextPoints}/100 LP)*`;
      }

      db.transaction(() => {
        db.run(
          'UPDATE user_pet_pvp_bot SET tier = ?, points = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?',
          [nextTier, nextPoints, user.id, guildId, petObj.pet_name]
        );
      })();

      resultTitle = `🎉 KEMENANGAN ARENA!`;
      resultDesc = `**${petObj.pet_name}** berhasil mengalahkan **${botOpponent.name}**!\n\n` +
                   `✨ **Reward XP Pet:** **+${winXp} XP**\n` +
                   `${rankChangesText}\n\n` +
                   `🔋 **Status HP Pet:** Tersisa **${nextHP}%** *(Kurang -10%)*`;

    } else if (isDraw) {
      resultTitle = `🤝 HASIL SERI!`;
      resultDesc = `Pertarungan sangat sengit hingga ronde ke-10 selesai tetapi tidak ada pet yang tumbang!\n\n` +
                   `📈 **Poin Liga:** Tetap (0 LP)\n` +
                   `🔋 **Status HP Pet:** Tersisa **${nextHP}%**`;
    } else {
      // KALAH
      nextHP = Math.max(1, petObj.health - 30); // Kalah HP berkurang 30%
      nextHappiness = Math.max(10, petObj.happiness - 20);

      let pointsDeducted = 10;
      let nextPoints = pvpState.points - pointsDeducted;
      let nextTier = pvpState.tier;

      const isBronze = pvpState.tier.startsWith('BRONZE');

      if (isBronze) {
        // Kekalahan di Bronze tidak mengurangi poin
        pointsDeducted = 0;
        rankChangesText = `ℹ️ Poin liga Anda tidak berkurang karena berada di Kasta Bronze.`;
      } else {
        if (nextPoints < 0) {
          if (currentTierIndex > 0) {
            const nextTierIndex = currentTierIndex - 1;
            nextTier = TIERS[nextTierIndex];
            nextPoints = nextTier.startsWith('IMMORTAL') ? 0 : 90; // Demote ke 90 LP tier bawah
            rankChangesText = `🚨 **TURUN TIER!** Pet Anda turun pangkat menjadi **${getFriendlyTierName(nextTier)}**!`;
          } else {
            nextPoints = 0;
            rankChangesText = `📉 Poin Liga Anda berkurang ke **0 LP**.`;
          }
        } else {
          rankChangesText = `📉 Poin Liga berkurang **-10 LP** *(Poin sekarang: ${nextPoints}/100 LP)*`;
        }
      }

      db.transaction(() => {
        db.run(
          'UPDATE user_pet_pvp_bot SET tier = ?, points = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?',
          [nextTier, nextPoints, user.id, guildId, petObj.pet_name]
        );
      })();

      resultTitle = `💀 KEKALAHAN ARENA!`;
      resultDesc = `**${petObj.pet_name}** tumbang di tangan **${botOpponent.name}**!\n\n` +
                   `${rankChangesText}\n\n` +
                   `🔋 **Status HP Pet:** Tersisa **${nextHP}%** *(Kurang -30%)*`;
    }

    // Terapkan penalti HP, Happiness, dan beri XP
    db.transaction(() => {
      // Add XP
      const xpResult = pet.addXp(petObj, winXp, pet.getMaxHP(petObj));
      
      db.run(
        `UPDATE user_pets 
         SET health = ?, happiness = ?, xp = ?, level = ?, last_interaction_at = ?
         WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
        [nextHP, nextHappiness, xpResult.newXp, xpResult.newLevel, Math.floor(Date.now() / 1000), user.id, guildId, petObj.pet_name]
      );
    })();

    // Kirim embed hasil akhir pertempuran
    const resultEmbed = new EmbedBuilder()
      .setColor(isWin ? 0x10B981 : 0xFF3366)
      .setTitle(resultTitle)
      .setDescription(
        resultDesc + `\n\n` +
        `📝 **Log Akhir Pertandingan:**\n` +
        `\`\`\`diff\n` +
        logs.map(line => {
          if (line.includes('KEMENANGAN') || line.includes('CRITICAL') || line.includes('memberikan')) return `+ ${line}`;
          if (line.includes('KEKALAHAN') || line.includes('membalas') || line.includes('tumbang')) return `- ${line}`;
          return `  ${line}`;
        }).join('\n').substring(0, 1000) +
        `\`\`\``
      )
      .setTimestamp();

    await battleMsg.edit({ embeds: [resultEmbed] }).catch(() => {});

  } catch(err) {
    console.error('Error during PvP Bot Battle:', err);
    await interaction.followUp({ content: `❌ Terjadi kesalahan saat menyimulasikan pertempuran: ${err.message}`, flags: 64 });
  } finally {
    // Buka kunci pertempuran
    client.activePvPBotBattles.delete(user.id);
  }
}

/**
 * Menampilkan Papan Peringkat PvP Bot Arena Server
 */
async function showPvPLeaderboard(interaction, client) {
  const { guildId, user } = interaction;
  
  // Defer Update
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
  getFriendlyTierName,
  getOrCreatePvPState
};
