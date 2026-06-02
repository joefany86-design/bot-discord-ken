const database = require('../stockmarket/database');
const petModule = require('../stockmarket/pet');

const selectedTargetUserId = '461890500258037760';
const guildId = '1410239829874053296';
const sanitizedName = 'Testy' + Math.floor(Math.random() * 1000);
const pType = 'PHOENIX';
const pLevel = 10;
const pStar = 3;
const pTrait = 'GENIUS';

try {
  const speciesInfo = petModule.GACHA_SPECIES[pType] || petModule.PET_SPECIES[pType];
  if (!speciesInfo) {
    throw new Error('Invalid species');
  }

  const pStatus = pLevel >= 10 ? 'ADULT' : 'BABY';
  const now = Math.floor(Date.now() / 1000);
  const isActive = 0;
  const hatchAt = 0;

  const baseHP = speciesInfo.baseHP || 100;
  const starMultiplier = 1 + (pStar - 1) * 0.15;
  const bonusHp = Math.round(baseHP * (starMultiplier - 1));
  const bonusAtkPct = (pStar - 1) * 0.15;
  const bonusDefPct = (pStar - 1) * 0.15;
  const maxHP = baseHP + bonusHp;

  const gSource = 'ADMIN';
  const gRarity = speciesInfo.rarity || 'COMMON';
  const gElement = speciesInfo.element || '';

  let finalTrait = pTrait;
  let finalTrait2 = '';

  database.run(
    `INSERT INTO user_pets (
      user_id, guild_id, pet_name, pet_type, status, level, xp, health, hunger, thirst, happiness, 
      last_interaction_at, hatch_at, created_at, is_active, trait, 
      star_level, base_hp_bonus, base_atk_bonus_pct, base_def_bonus_pct,
      gacha_source, gacha_rarity, gacha_element, gacha_trait2
    ) VALUES (
      ?, ?, ?, ?, ?, ?, 0, ?, 100, 100, 100, 
      ?, ?, ?, ?, ?, 
      ?, ?, ?, ?,
      ?, ?, ?, ?
    )`,
    [
      selectedTargetUserId, guildId, sanitizedName, pType, pStatus, pLevel, maxHP, 
      now, hatchAt, now, isActive, finalTrait,
      pStar, bonusHp, bonusAtkPct, bonusDefPct,
      gSource, gRarity, gElement, finalTrait2
    ]
  );
  console.log("SUCCESS!");
} catch (err) {
  console.error("ERROR OCCURRED:", err);
}
