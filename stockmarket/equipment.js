const db = require('./database');

// Equipment Configuration
const EQUIP_TYPES = ['WEAPON', 'ARMOR', 'RING'];
const RARITIES = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'];
const STAT_TYPES = ['ATK', 'HP', 'DEF', 'DEX'];

const STAT_BY_TYPE_AND_RARITY = {
  WEAPON: {
    stat_type: 'ATK',
    COMMON: { min: 5, max: 15 },
    RARE: { min: 16, max: 35 },
    EPIC: { min: 36, max: 70 },
    LEGENDARY: { min: 71, max: 120 }
  },
  ARMOR: {
    stat_type: 'DEF',
    COMMON: { min: 3, max: 8 },
    RARE: { min: 9, max: 18 },
    EPIC: { min: 19, max: 35 },
    LEGENDARY: { min: 36, max: 60 }
  },
  RING: {
    // Ring can randomly be HP or DEX
    COMMON: { HP: { min: 20, max: 60 }, DEX: { min: 3, max: 8 } },
    RARE: { HP: { min: 61, max: 150 }, DEX: { min: 9, max: 18 } },
    EPIC: { HP: { min: 151, max: 300 }, DEX: { min: 19, max: 35 } },
    LEGENDARY: { HP: { min: 301, max: 600 }, DEX: { min: 36, max: 60 } }
  }
};

// Refinement (Forging) configuration
const FORGE_RATES = {
  // level -> { successChance (%), cost (koin) }
  1: { chance: 100, cost: 500 }, // to +2
  2: { chance: 90, cost: 1000 }, // to +3
  3: { chance: 80, cost: 2000 }, // to +4
  4: { chance: 70, cost: 4000 }, // to +5
  5: { chance: 60, cost: 8000 }, // to +6
  6: { chance: 50, cost: 15000 }, // to +7
  7: { chance: 40, cost: 30000 }, // to +8
  8: { chance: 30, cost: 60000 }, // to +9
  9: { chance: 20, cost: 120000 } // to +10
};

// Base equipment names
const EQUIP_NAMES = {
  WEAPON: {
    COMMON: ['Wooden Sword', 'Rusty Dagger', 'Novice Staff'],
    RARE: ['Steel Broadsword', 'Assassins Blade', 'Apprentice Wand'],
    EPIC: ['Dragon Tooth', 'Shadow Dagger', 'Archmage Staff'],
    LEGENDARY: ['Excalibur', 'Infinity Edge', 'Astra Staff']
  },
  ARMOR: {
    COMMON: ['Ragged Clothes', 'Leather Vest', 'Rookie Robe'],
    RARE: ['Chainmail Plate', 'Hardened Leather Jacket', 'Sage Cloak'],
    EPIC: ['Dragon Scale Mail', 'Shadow Assassin Garb', 'Archmage Robe'],
    LEGENDARY: ['Aegis Plate', 'Chrono Cloak', 'Valkyries Guard']
  },
  RING: {
    COMMON: ['Copper Ring', 'Dull Band', 'Simple Loop'],
    RARE: ['Silver Ring', 'Jade Band', 'Garnet Loop'],
    EPIC: ['Gold Ring', 'Ruby Band', 'Sapphire Loop'],
    LEGENDARY: ['Chronos Loop', 'Ouroboros Band', 'Celestial Ring']
  }
};

/**
 * Generate a random equipment drop
 */
function generateRandomEquipment(userId, guildId) {
  // Roll rarity: COMMON 60%, RARE 25%, EPIC 11%, LEGENDARY 4%
  const roll = Math.random() * 100;
  let rarity = 'COMMON';
  if (roll < 4) rarity = 'LEGENDARY';
  else if (roll < 15) rarity = 'EPIC';
  else if (roll < 40) rarity = 'RARE';

  const type = EQUIP_TYPES[Math.floor(Math.random() * EQUIP_TYPES.length)];
  
  let statType = 'ATK';
  let minStat = 0, maxStat = 0;
  
  if (type === 'WEAPON') {
    statType = 'ATK';
    minStat = STAT_BY_TYPE_AND_RARITY.WEAPON[rarity].min;
    maxStat = STAT_BY_TYPE_AND_RARITY.WEAPON[rarity].max;
  } else if (type === 'ARMOR') {
    statType = 'DEF';
    minStat = STAT_BY_TYPE_AND_RARITY.ARMOR[rarity].min;
    maxStat = STAT_BY_TYPE_AND_RARITY.ARMOR[rarity].max;
  } else { // RING
    statType = Math.random() < 0.5 ? 'HP' : 'DEX';
    minStat = STAT_BY_TYPE_AND_RARITY.RING[rarity][statType].min;
    maxStat = STAT_BY_TYPE_AND_RARITY.RING[rarity][statType].max;
  }

  const statValue = minStat + Math.floor(Math.random() * (maxStat - minStat + 1));
  
  const names = EQUIP_NAMES[type][rarity];
  const baseName = names[Math.floor(Math.random() * names.length)];

  // Insert into DB
  const stmt = db.db.prepare(`
    INSERT INTO pet_equipment (user_id, guild_id, equip_name, equip_type, rarity, stat_type, stat_value, level, equipped_pet)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, NULL)
  `);
  const result = stmt.run(userId, guildId, baseName, type, rarity, statType, statValue);
  
  return {
    id: result.lastInsertRowid,
    user_id: userId,
    guild_id: guildId,
    equip_name: baseName,
    equip_type: type,
    rarity: rarity,
    stat_type: statType,
    stat_value: statValue,
    level: 1,
    equipped_pet: null
  };
}

/**
 * Calculates current stats of an equipment based on its level
 */
function getEquipmentEffectiveStats(equip) {
  if (!equip) return null;
  // Stat increases by +10% per level above 1
  const multiplier = 1 + (equip.level - 1) * 0.10;
  const effectiveValue = Math.floor(equip.stat_value * multiplier);
  return {
    ...equip,
    effectiveValue
  };
}

/**
 * Get all equipment currently equipped on a pet
 */
function getPetEquipment(userId, guildId, petName) {
  const items = db.all(
    'SELECT * FROM pet_equipment WHERE user_id = ? AND guild_id = ? AND equipped_pet = ?',
    [userId, guildId, petName]
  );
  return items.map(getEquipmentEffectiveStats);
}

/**
 * Calculate total stats bonus from all equipment on a pet
 */
function getPetEquipmentStatsBonus(userId, guildId, petName) {
  const items = getPetEquipment(userId, guildId, petName);
  const bonuses = { ATK: 0, DEF: 0, HP: 0, DEX: 0 };
  for (const item of items) {
    if (bonuses[item.stat_type] !== undefined) {
      bonuses[item.stat_type] += item.effectiveValue;
    }
  }
  return bonuses;
}

module.exports = {
  generateRandomEquipment,
  getEquipmentEffectiveStats,
  getPetEquipment,
  getPetEquipmentStatsBonus,
  FORGE_RATES,
  EQUIP_TYPES,
  RARITIES,
  STAT_TYPES
};
