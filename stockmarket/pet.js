const db = require('./database');
const economy = require('./economy');
const config = require('./config');

// Konfigurasi Item Kebutuhan Pet
const PET_ITEMS = {
  FOOD_BASIC: { id: 'FOOD_BASIC', name: '🍗 Pakan Pet Biasa', price: 80, hunger: 30, thirst: 0, hp: 0, happiness: 0, cooldown: 0, desc: 'Pakan standar untuk mengisi perut pet.' },
  FOOD_PREMIUM: { id: 'FOOD_PREMIUM', name: '🥩 Daging Premium', price: 200, hunger: 70, thirst: 0, hp: 10, happiness: 5, cooldown: 0, desc: 'Daging lezat kualitas prima. Menambah Kenyangan & HP.' },
  WATER: { id: 'WATER', name: '🥤 Air Bersih', price: 50, hunger: 0, thirst: 35, hp: 0, happiness: 0, cooldown: 0, desc: 'Air mineral segar untuk hidrasi pet.' },
  MEDICINE: { id: 'MEDICINE', name: '💊 Ramuan Kesehatan', price: 500, hunger: 0, thirst: 0, hp: 50, happiness: 0, cures: true, cooldown: 0, desc: 'Ramuan penyembuh untuk pet sakit/pingsan.' },
  TOY: { id: 'TOY', name: '⚽ Bola Karet', price: 120, hunger: 0, thirst: 0, hp: 0, happiness: 50, cooldown: 0, desc: 'Bola karet elastis untuk meningkatkan mood pet.' },
  SODA_ENERGY: { id: 'SODA_ENERGY', name: '🥤 Soda Energi Pet', price: 150, hunger: 0, thirst: 10, hp: 0, happiness: 10, cooldown: 1800, desc: 'Soda manis berkafein. Menghapus cooldown kerja/berburu secara instan!' },
  SOAP_PET: { id: 'SOAP_PET', name: '🧼 Sabun Mandi Pet', price: 50, hunger: 0, thirst: 0, hp: 0, happiness: 5, cooldown: 0, desc: 'Sabun wangi stroberi khusus untuk mandi pet.' },
  COLLAR_IRON: { id: 'COLLAR_IRON', name: '🪮 Kalung Besi', price: 1500, type: 'ACCESSORY', cooldown: 0, desc: 'Aksesoris Pet: Mengurangi laju decay kelaparan/kehausan/kebahagiaan pet sebesar 15%.' },
  SWORD_TOY: { id: 'SWORD_TOY', name: '⚔️ Pedang Mainan', price: 1500, type: 'ACCESSORY', cooldown: 0, desc: 'Aksesoris Pet: Meningkatkan DMG serangan pet di PvP Arena sebesar +15%.' },
  SHIELD_TOY: { id: 'SHIELD_TOY', name: '🛡️ Tameng Mainan', price: 1500, type: 'ACCESSORY', cooldown: 0, desc: 'Aksesoris Pet: Mengurangi DMG yang diterima pet di PvP Arena sebesar 15%.' },
  LUCKY_AMULET: { id: 'LUCKY_AMULET', name: '🔮 Jimat Keberuntungan', price: 2500, type: 'ACCESSORY', cooldown: 0, desc: 'Aksesoris Pet: Jimat pelindung sekali pakai. Menyelamatkan pet dari kematian (jika HP mencapai 0) lalu hancur.' },
  XP_2X: { id: 'XP_2X', name: '⚡ XP Booster 2x', price: 3000, hunger: 0, thirst: 0, hp: 0, happiness: 0, multiplier: 2.0, cooldown: 0, desc: 'Booster energi untuk mempercepat peningkatan XP pet sebesar 2x secara permanen.' },
  XP_4X: { id: 'XP_4X', name: '⚡ XP Booster 4x', price: 6000, hunger: 0, thirst: 0, hp: 0, happiness: 0, multiplier: 4.0, cooldown: 0, desc: 'Booster energi untuk mempercepat peningkatan XP pet sebesar 4x secara permanen.' },
  XP_6X: { id: 'XP_6X', name: '⚡ XP Booster 6x', price: 9000, hunger: 0, thirst: 0, hp: 0, happiness: 0, multiplier: 6.0, cooldown: 0, desc: 'Booster energi untuk mempercepat peningkatan XP pet sebesar 6x secara permanen.' },
  XP_8X: { id: 'XP_8X', name: '⚡ XP Booster 8x', price: 12000, hunger: 0, thirst: 0, hp: 0, happiness: 0, multiplier: 8.0, cooldown: 0, desc: 'Booster energi untuk mempercepat peningkatan XP pet sebesar 8x secara permanen.' },
  MYSTERY_BOX_ANCIENT: { id: 'MYSTERY_BOX_ANCIENT', name: '🎁 Kotak Misteri Peliharaan Kuno', price: 0, type: 'CONSUMABLE', desc: 'Kotak hadiah legendaris dari kekalahan Raid Boss. Buka untuk menetaskan pet langka acak!' }
};

// Konfigurasi Spesies Pet
const PET_SPECIES = {
  SLIME:  { id: 'SLIME',  name: '🟢 Slime',       desc: 'Sangat kenyal dan memiliki vitalitas tinggi. (+20 Max HP / Tahan Lapar)' },
  DRAGON: { id: 'DRAGON', name: '🔥 Naga / Dragon', desc: 'Makhluk legendaris bernapas api. Sangat tangguh di PvP Arena (+15% Attack).' },
  CAT:    { id: 'CAT',    name: '🐱 Kucing / Cat',  desc: 'Lincah dan menggemaskan. Peluang mendapat item langka saat Hunt meningkat (+5%).' },
  GOLEM:  { id: 'GOLEM',  name: '🧱 Golem',         desc: 'Terbuat dari batu kokoh. Sangat rajin bekerja (Cooldown Kerja -20 Menit).' }
};

// ═══════════════════════════════════════════════
// KONFIGURASI SISTEM GACHA PET
// ═══════════════════════════════════════════════

const GACHA_RATES = {
  COMMON:    0.65,
  RARE:      0.25,
  EPIC:      0.08,
  LEGENDARY: 0.02,
};

const GACHA_SPECIES = {
  // ⚪ Common — spesies standar tanpa trait bawaan
  CAT:        { id: 'CAT',        name: '🐱 Kucing',     rarity: 'COMMON',    emoji: '⚪', baseHP: 100, baseAtk: 10, baseDef: 0, element: '',      workBuff: 0,    desc: 'Kucing lincah yang gemar berburu.' },
  GOLEM:      { id: 'GOLEM',      name: '🧱 Golem',      rarity: 'COMMON',    emoji: '⚪', baseHP: 100, baseAtk: 10, baseDef: 0, element: '',      workBuff: 0,    desc: 'Golem batu pekerja keras.' },
  SLIME:      { id: 'SLIME',      name: '🟢 Slime',      rarity: 'COMMON',    emoji: '⚪', baseHP: 120, baseAtk: 8,  baseDef: 0, element: '',      workBuff: 0,    desc: 'Slime kenyal dengan vitalitas tinggi.' },
  // 🟢 Rare — trait diaktifkan otomatis; DRAGON hanya 5% dari pool Rare
  // (CAT, GOLEM, SLIME bisa juga Rare, bedanya ada trait)
  DRAGON:     { id: 'DRAGON',     name: '🔥 Naga',       rarity: 'RARE',      emoji: '🟢', baseHP: 100, baseAtk: 15, baseDef: 0, element: 'FIRE',  workBuff: 0,    desc: 'Naga api legendaris berbisa (+15% ATK).' },
  // 🟣 Epic — spesies khusus bertipe elemen
  PHOENIX:    { id: 'PHOENIX',    name: '🦅 Phoenix',    rarity: 'EPIC',      emoji: '🟣', baseHP: 100, baseAtk: 20, baseDef: 0, element: 'FIRE',  workBuff: 0,    desc: 'Burung api abadi. Elemen Kebakaran (+20% ATK).' },
  TURTLE:     { id: 'TURTLE',     name: '🐢 Kura-Kura',  rarity: 'EPIC',      emoji: '🟣', baseHP: 120, baseAtk: 10, baseDef: 20, element: 'EARTH', workBuff: 0,   desc: 'Kura-kura bumi yang sangat tangguh (+20% HP & DEF).' },
  SIREN:      { id: 'SIREN',      name: '🧜‍♀️ Siren',      rarity: 'EPIC',      emoji: '🟣', baseHP: 110, baseAtk: 15, baseDef: 5, element: 'WATER', workBuff: 0,   desc: 'Makhluk laut bersuara merdu. Menghipnotis lawan dengan kidung air abadi.' },
  PEGASUS:    { id: 'PEGASUS',    name: '🦄 Pegasus',    rarity: 'EPIC',      emoji: '🟣', baseHP: 105, baseAtk: 12, baseDef: 8, element: 'DRAGON',workBuff: 0,   desc: 'Kuda bersayap suci penjaga langit. Pelari cepat pembawa keajaiban.' },
  KITSUNE:    { id: 'KITSUNE',    name: '🦊 Kitsune',    rarity: 'EPIC',      emoji: '🟣', baseHP: 100, baseAtk: 18, baseDef: 5, element: 'FIRE',  workBuff: 0,    desc: 'Rubah ekor sembilan legendaris. Memanipulasi api mistis biru pelindung jiwa.' },
  KIRIN:      { id: 'KIRIN',      name: '⚡ Kirin',      rarity: 'EPIC',      emoji: '🟣', baseHP: 110, baseAtk: 16, baseDef: 6, element: 'DRAGON',workBuff: 0,   desc: 'Rusa petir mitologi pembawa kemakmuran. Langkah kakinya memicu guntur.' },
  YETI:       { id: 'YETI',       name: '❄️ Yeti',       rarity: 'EPIC',      emoji: '🟣', baseHP: 115, baseAtk: 13, baseDef: 12, element: 'WATER',workBuff: 0,   desc: 'Raksasa salju penjaga puncak es dingin. Kekuatannya mampu membekukan lawan.' },
  // 🟡 Legendary — buff super +25% kerja & hunt, 150 base HP, 2 trait acak
  LEVIATHAN:  { id: 'LEVIATHAN',  name: '🌊 Leviathan',  rarity: 'LEGENDARY', emoji: '🟡', baseHP: 150, baseAtk: 25, baseDef: 10, element: 'WATER', workBuff: 0.25, desc: 'Naga lautan kuno. Menguasai ombak samudera.' },
  BEHEMOTH:   { id: 'BEHEMOTH',   name: '🦏 Behemoth',   rarity: 'LEGENDARY', emoji: '🟡', baseHP: 150, baseAtk: 25, baseDef: 10, element: 'EARTH', workBuff: 0.25, desc: 'Monster bumi tak terkalahkan. Kekuatan tiada batas.' },
  ARCHDRAGON: { id: 'ARCHDRAGON', name: '🐉 Archdragon', rarity: 'LEGENDARY', emoji: '🟡', baseHP: 150, baseAtk: 25, baseDef: 10, element: 'DRAGON',workBuff: 0.25, desc: 'Naga purba tertua. Penguasa langit dan bumi.' },
  CERBERUS:   { id: 'CERBERUS',   name: '🐺 Cerberus',   rarity: 'LEGENDARY', emoji: '🟡', baseHP: 150, baseAtk: 28, baseDef: 7, element: 'FIRE',  workBuff: 0.25, desc: 'Anjing berkepala tiga penjaga neraka. Menguasai api jahanam pembakar jiwa.' },
  TYPHON:     { id: 'TYPHON',     name: '🌪️ Typhon',     rarity: 'LEGENDARY', emoji: '🟡', baseHP: 150, baseAtk: 27, baseDef: 8, element: 'DRAGON',workBuff: 0.25, desc: 'Bapa dari segala monster mitologi. Membawa kekuatan badai penghancur dimensi.' },
  VALKYRIE:   { id: 'VALKYRIE',   name: '⚔️ Valkyrie',   rarity: 'LEGENDARY', emoji: '🟡', baseHP: 160, baseAtk: 22, baseDef: 18, element: 'EARTH', workBuff: 0.25, desc: 'Ksatria wanita pemandu jiwa pejuang. Memiliki pertahanan emas yang tak tertembus.' },
  IFRIT:      { id: 'IFRIT',      name: '👹 Ifrit',      rarity: 'LEGENDARY', emoji: '🟡', baseHP: 145, baseAtk: 30, baseDef: 5, element: 'FIRE',  workBuff: 0.25, desc: 'Raja jin api dari gurun terdalam berkekuatan destruktif tinggi.' },
  // 🔴 Mythic — makhluk mitologi langka, 3 trait bawaan, buff +40%
  FENRIR:      { id: 'FENRIR',      name: '🐺 Fenrir',      rarity: 'MYTHIC',   emoji: '🔴', baseHP: 200, baseAtk: 35, baseDef: 15, element: 'DRAGON', workBuff: 0.40, desc: 'Serigala pemusnah akhir zaman. Cakarnya merobek dimensi.' },
  BAHAMUT:     { id: 'BAHAMUT',     name: '🐲 Bahamut',     rarity: 'MYTHIC',   emoji: '🔴', baseHP: 200, baseAtk: 40, baseDef: 10, element: 'FIRE',   workBuff: 0.40, desc: 'Naga kaisar maha-api. Napasnya menguapkan lautan.' },
  KRAKEN:      { id: 'KRAKEN',      name: '🦑 Kraken',      rarity: 'MYTHIC',   emoji: '🔴', baseHP: 220, baseAtk: 30, baseDef: 20, element: 'WATER',  workBuff: 0.40, desc: 'Raksasa cumi laut abyss. Tentakelnya menghancurkan armada.' },
  JORMUNGANDR: { id: 'JORMUNGANDR', name: '🐍 Jörmungandr', rarity: 'MYTHIC',   emoji: '🔴', baseHP: 250, baseAtk: 25, baseDef: 25, element: 'EARTH',  workBuff: 0.40, desc: 'Ular dunia yang melingkari bumi. Bisanya meluluhkan gunung.' },
  // ✨ Immortal — entitas kosmik abadi, 5 trait aktif, God-Mode
  CHRONOS:     { id: 'CHRONOS',     name: '⏳ Chronos',     rarity: 'IMMORTAL', emoji: '✨', baseHP: 500, baseAtk: 50, baseDef: 30, element: 'DRAGON', workBuff: 0.75, desc: 'Dewa Waktu primordial. Mengendalikan aliran waktu dan nasib.' },
  OUROBOROS:   { id: 'OUROBOROS',   name: '♾️ Ouroboros',   rarity: 'IMMORTAL', emoji: '✨', baseHP: 999, baseAtk: 30, baseDef: 50, element: 'EARTH',  workBuff: 0.75, desc: 'Ular keabadian abadi. Simbol siklus tanpa akhir.' },
  AZATHOTH:    { id: 'AZATHOTH',    name: '🌌 Azathoth',    rarity: 'IMMORTAL', emoji: '✨', baseHP: 300, baseAtk: 99, baseDef: 10, element: 'DRAGON', workBuff: 0.75, desc: 'Entitas kosmik. Mimpinya menciptakan dan menghancurkan alam semesta.' },
  YGGDRASIL:   { id: 'YGGDRASIL',   name: '🌳 Yggdrasil',  rarity: 'IMMORTAL', emoji: '✨', baseHP: 777, baseAtk: 20, baseDef: 77, element: 'EARTH',  workBuff: 0.75, desc: 'Pohon Dunia penopang sembilan alam. Akar menembus dimensi.' },
};

const GACHA_TRAITS_ALL   = ['GENIUS', 'STURDY', 'MUTANT', 'WARRIOR'];
const GACHA_TRAIT_RARE   = ['GENIUS', 'STURDY', 'MUTANT', 'WARRIOR'];
const GACHA_TRAIT_EPIC   = ['SURVIVOR'];
const GACHA_TRAIT_LEGENDARY = ['GENIUS', 'STURDY', 'MUTANT', 'WARRIOR', 'SURVIVOR'];

const GACHA_PRICES = {
  SINGLE:  1500,
  MULTI10: 15000,
};

const RECYCLE_REWARD = 800;

// ═══════════════════════════════════════════════
// KONFIGURASI UPGRADE BINTANG PET (STAR FUSION)
// ═══════════════════════════════════════════════

// Format: { dupCount, minStarDup, coinCost }
const STAR_UPGRADE_REQ = {
  1: { dupCount: 1, minStarDup: 1, coinCost: 2500  }, // ⭐1 → ⭐2
  2: { dupCount: 1, minStarDup: 2, coinCost: 5000  }, // ⭐2 → ⭐3
  3: { dupCount: 2, minStarDup: 2, coinCost: 10000 }, // ⭐3 → ⭐4
  4: { dupCount: 2, minStarDup: 3, coinCost: 20000 }, // ⭐4 → ⭐5
};

// Bonus per bintang relatif dari bintang 1 (base)
function getStarBonuses(starLevel) {
  const s = Math.max(1, Math.min(5, starLevel || 1));
  const starsAboveBase = s - 1; // 0 untuk ⭐1
  return {
    hpBonus:     starsAboveBase * 15,          // +15 HP per bintang
    atkBonusPct: starsAboveBase * 0.25,        // +25% ATK per bintang
    defBonusPct: starsAboveBase * 0.05,        // +5% DEF (reduksi DMG) per bintang
    cdReduction: starsAboveBase * 0.10,        // -10% cooldown per bintang
    stars:       s
  };
}

// String visual bintang ⭐
function renderStars(n) {
  return '⭐'.repeat(Math.max(1, Math.min(5, n || 1)));
}

function isGodPet(pet) {
  if (!pet) return false;
  // God pet configurable: pet milik Owner dengan nama khusus, atau rarity IMMORTAL
  const ownerID = config.OWNER_ID || process.env.OWNER_ID;
  if (ownerID && pet.user_id === ownerID) {
    // Cek apakah owner_god_mode diaktifkan di ebyus_settings
    try {
      const settings = db.get('SELECT owner_god_mode FROM ebyus_settings WHERE guild_id = ?', [pet.guild_id]);
      if (settings && settings.owner_god_mode === 1) return true;
    } catch (e) {
      // Fallback: tetap bukan god pet jika query gagal
    }
  }
  const rarity = pet.gacha_rarity || (GACHA_SPECIES[pet.pet_type] ? GACHA_SPECIES[pet.pet_type].rarity : '');
  return rarity === 'IMMORTAL';
}

function isMythicPet(pet) {
  if (!pet) return false;
  const rarity = pet.gacha_rarity || (GACHA_SPECIES[pet.pet_type] ? GACHA_SPECIES[pet.pet_type].rarity : '');
  return rarity === 'MYTHIC';
}

function petHasTrait(pet, traitName) {
  if (!pet) return false;
  const rarity = pet.gacha_rarity || (GACHA_SPECIES[pet.pet_type] ? GACHA_SPECIES[pet.pet_type].rarity : '');
  if (rarity === 'IMMORTAL') {
    return ['GENIUS', 'STURDY', 'MUTANT', 'WARRIOR', 'SURVIVOR'].includes(traitName);
  }
  const traits = [];
  if (pet.trait) traits.push(pet.trait);
  if (pet.gacha_trait2) {
    pet.gacha_trait2.split(',').forEach(t => {
      const trimmed = t.trim();
      if (trimmed) traits.push(trimmed);
    });
  }
  return traits.includes(traitName);
}

// Dapatkan Max HP dinamis berdasarkan spesies dan bintang
function getMaxHP(pet) {
  if (!pet) return 100;
  const speciesInfo = GACHA_SPECIES[pet.pet_type];
  const baseHP = speciesInfo ? (speciesInfo.baseHP || 100) : (pet.pet_type === 'SLIME' ? 120 : 100);
  const starLevel = pet.star_level || 1;
  const hpBonus = (starLevel - 1) * 15;
  const vitBonus = (pet.stat_vit || 0) * 3; // +3 Max HP per Vitality
  return baseHP + hpBonus + vitBonus;
}



// Konfigurasi Peta Ekspedisi Pet (Co-op PVE)
const EXPEDITION_MAPS = [
  {
    id: 1,
    name: '🌲 Hutan Pemula (Beginner Forest)',
    recommendedLevel: 1,
    baseSuccessRate: 85,
    minPrize: 200,
    maxPrize: 400,
    description: 'Hutan rindang bersahabat dengan kelinci liar & jamur kecil.',
    element: 'EARTH',
    boss: 'Raksasa Hutan'
  },
  {
    id: 2,
    name: '🦇 Gua Gelap (Dark Cave)',
    recommendedLevel: 10,
    baseSuccessRate: 75,
    minPrize: 400,
    maxPrize: 800,
    description: 'Lorong gua basah penuh kelelawar penghisap darah & laba-laba raksasa.',
    element: 'EARTH',
    boss: 'Kelelawar Raksasa'
  },
  {
    id: 3,
    name: '🔥 Lembah Api (Fire Valley)',
    recommendedLevel: 25,
    baseSuccessRate: 65,
    minPrize: 800,
    maxPrize: 1500,
    description: 'Ngarai panas berpijar dengan naga api liar dan golem magma raksasa.',
    element: 'FIRE',
    boss: 'Golem Magma'
  },
  {
    id: 4,
    name: '🏰 Istana Kuno (Ancient Palace)',
    recommendedLevel: 40,
    baseSuccessRate: 55,
    minPrize: 1500,
    maxPrize: 2500,
    description: 'Reruntuhan istana misterius yang dijaga oleh iblis kuno bermata satu.',
    element: 'DRAGON',
    boss: 'Iblis Kuno'
  },
  {
    id: 5,
    name: '❄️ Tundra Beku (Frozen Tundra)',
    recommendedLevel: 55,
    baseSuccessRate: 45,
    minPrize: 2500,
    maxPrize: 4500,
    description: 'Padang salju abadi dingin membeku, dijaga oleh Yeti berbulu tebal.',
    element: 'WATER',
    boss: 'Yeti Raksasa'
  },
  {
    id: 6,
    name: '⚡ Rawa Petir (Thunder Swamp)',
    recommendedLevel: 70,
    baseSuccessRate: 40,
    minPrize: 4500,
    maxPrize: 7000,
    description: 'Rawa-rawa dengan petir menyambar tiada henti, dihuni belut listrik purba.',
    element: 'FIRE',
    boss: 'Belut Listrik Purba'
  },
  {
    id: 7,
    name: '🌫️ Kabut Kematian (Death Mist)',
    recommendedLevel: 85,
    baseSuccessRate: 35,
    minPrize: 7000,
    maxPrize: 10000,
    description: 'Lembah berkabut racun kelam tempat bersemayamnya arwah penasaran & raja undead.',
    element: 'DRAGON',
    boss: 'Lich Necromancer'
  },
  {
    id: 8,
    name: '🌊 Samudera Abyss (Abyssal Ocean)',
    recommendedLevel: 100,
    baseSuccessRate: 30,
    minPrize: 10000,
    maxPrize: 14000,
    description: 'Palung laut terdalam tak tertembus cahaya, dihuni Kraken pelahap kapal bajak laut.',
    element: 'WATER',
    boss: 'Gurita Kraken'
  },
  {
    id: 9,
    name: '🏔️ Puncak Langit (Sky Sanctuary)',
    recommendedLevel: 125,
    baseSuccessRate: 25,
    minPrize: 14000,
    maxPrize: 20000,
    description: 'Kuil melayang tinggi di atas awan, diselimuti angin kencang tempat tinggal penjaga surgawi.',
    element: 'DRAGON',
    boss: 'Garuda Emas'
  },
  {
    id: 10,
    name: '🌌 Dimensi Kosmik (Cosmic Abyss)',
    recommendedLevel: 150,
    baseSuccessRate: 20,
    minPrize: 20000,
    maxPrize: 30000,
    description: 'Ujung dimensi tempat waktu dan ruang terdistorsi. Hanya untuk pet terkuat!',
    element: 'DRAGON',
    boss: 'Void Sovereign'
  }
];

// Daftar item acak yang dapat dijatuhkan dari ekspedisi pet
const EXPEDITION_DROPS = [
  // Black Market Items (Disimpan di user_inventory)
  { id: 'LOCKPICK', name: '🗝️ Linggis / Lockpick', table: 'user_inventory' },
  { id: 'MASK', name: '🎭 Topeng Samaran', table: 'user_inventory' },
  { id: 'MEAT', name: '🥩 Daging Bius', table: 'user_inventory' },
  { id: 'SOAP', name: '🧼 Sabun Licin', table: 'user_inventory' },
  { id: 'BRANKAS', name: '🛡️ Brankas Anti-Hacker', table: 'user_inventory' },

  // Gacha Tickets (Disimpan di user_inventory)
  { id: 'TICKET_GACHA', name: '🎟️ Tiket Gacha Pet', table: 'user_inventory' },

  // Garden Seeds (Disimpan di user_inventory)
  { id: 'SEED_ROSE', name: '🌱 Benih Mawar Merah', table: 'user_inventory' },
  { id: 'SEED_TULIP', name: '🌱 Benih Bunga Tulip', table: 'user_inventory' },
  { id: 'SEED_LAVENDER', name: '🌱 Benih Bunga Lavender', table: 'user_inventory' },
  { id: 'SEED_SAKURA', name: '🌱 Benih Bunga Sakura', table: 'user_inventory' },
  { id: 'SEED_ORCHID', name: '🌱 Benih Anggrek Langka', table: 'user_inventory' },

  // Garden Flowers (Disimpan di user_inventory)
  { id: 'FLOWER_ROSE', name: '🌹 Mawar Merah', table: 'user_inventory' },
  { id: 'FLOWER_TULIP', name: '🌷 Bunga Tulip', table: 'user_inventory' },
  { id: 'FLOWER_LAVENDER', name: '🪻 Bunga Lavender', table: 'user_inventory' },
  { id: 'FLOWER_SAKURA', name: '🌸 Bunga Sakura', table: 'user_inventory' },
  { id: 'FLOWER_ORCHID', name: '🪻 Anggrek Langka', table: 'user_inventory' },
  { id: 'GIFT_WRAPPING', name: '🎗️ Kertas Kado Premium', table: 'user_inventory' },

  // Pet Shop Items (Disimpan di pet_inventory)
  { id: 'FOOD_BASIC', name: '🍗 Pakan Pet Biasa', table: 'pet_inventory' },
  { id: 'FOOD_PREMIUM', name: '🥩 Daging Premium', table: 'pet_inventory' },
  { id: 'WATER', name: '🥤 Air Bersih', table: 'pet_inventory' },
  { id: 'MEDICINE', name: '💊 Ramuan Kesehatan', table: 'pet_inventory' },
  { id: 'TOY', name: '⚽ Bola Karet', table: 'pet_inventory' },
  { id: 'SODA_ENERGY', name: '🥤 Soda Energi Pet', table: 'pet_inventory' },
  { id: 'SOAP_PET', name: '🧼 Sabun Mandi Pet', table: 'pet_inventory' }
];

function getXpNeeded(level, petOrTrait) {
  const base = level * 100;
  const hasGenius = typeof petOrTrait === 'string' ? (petOrTrait === 'GENIUS') : petHasTrait(petOrTrait, 'GENIUS');
  if (hasGenius) {
    return Math.round(base * 0.80); // -20% XP cap (GENIUS leveling bonus!)
  }
  return base;
}

/**
 * Menambahkan XP ke pet dan memproses kemungkinan naik level berulang kali (recursive/iterative level up)
 */
function addXp(pet, xpGained, maxHP) {
  let newXp = pet.xp + xpGained;
  let newLevel = pet.level;
  let levelUp = false;
  let tpGained = 0;

  while (true) {
    const xpNeeded = getXpNeeded(newLevel, pet);
    if (newXp >= xpNeeded) {
      newXp -= xpNeeded;
      newLevel += 1;
      levelUp = true;
      tpGained += 3;
    } else {
      break;
    }
  }

  if (levelUp && tpGained > 0 && pet.user_id && pet.guild_id && pet.pet_name) {
    db.run(
      'UPDATE user_pets SET unused_tp = unused_tp + ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?',
      [tpGained, pet.user_id, pet.guild_id, pet.pet_name]
    );
  }

  return { newXp, newLevel, levelUp, tpGained };
}

/**
 * Menerapkan lazy decay: menghitung pengurangan status berdasarkan waktu berlalu.
 */
function applyDecay(pet) {
  if (!pet) {
    return pet;
  }

  if (isGodPet(pet)) {
    const maxHP = getMaxHP(pet);
    if (pet.hunger === 100 && pet.thirst === 100 && pet.happiness === 100 && pet.health === maxHP && pet.status === 'ADULT' && (pet.gym_fatigue || 0) === 0) {
      return pet;
    }
    const now = Math.floor(Date.now() / 1000);
    db.run(
      `UPDATE user_pets 
       SET hunger = 100, thirst = 100, happiness = 100, health = ?, status = 'ADULT', last_interaction_at = ?, gym_fatigue = 0
       WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
      [maxHP, now, pet.user_id, pet.guild_id, pet.pet_name]
    );
    return {
      ...pet,
      hunger: 100,
      thirst: 100,
      happiness: 100,
      health: maxHP,
      status: 'ADULT',
      gym_fatigue: 0,
      last_interaction_at: now
    };
  }

  if (pet.status === 'EGG' || pet.status === 'DEAD') {
    return pet;
  }

  const now = Math.floor(Date.now() / 1000);
  const elapsedSeconds = now - pet.last_interaction_at;
  const elapsedHours = elapsedSeconds / 3600;

  const newFatigue = Math.max(0, (pet.gym_fatigue || 0) - Math.floor(elapsedHours * 10));

  if (elapsedHours < 0.25) {
    return pet;
  }

  let hungerDecayRate = 4;
  let thirstDecayRate = 5;
  let happinessDecayRate = 3;

  if (pet.pet_type === 'SLIME') {
    hungerDecayRate = 3;
    thirstDecayRate = 4;
  }

  // A. Neglect Multiplier (Pengabaian Beruntun)
  let neglectDecayMultiplier = 1.0;
  let neglectHPMultiplier = 1.0;
  if (elapsedHours > 48) {
    neglectDecayMultiplier = 2.0;
    neglectHPMultiplier = 2.0;
  } else if (elapsedHours > 24) {
    neglectDecayMultiplier = 1.5;
    neglectHPMultiplier = 1.0;
  }

  hungerDecayRate = Number((hungerDecayRate * neglectDecayMultiplier).toFixed(2));
  thirstDecayRate = Number((thirstDecayRate * neglectDecayMultiplier).toFixed(2));
  happinessDecayRate = Number((happinessDecayRate * neglectDecayMultiplier).toFixed(2));

  // Mythic: laju decay status berkurang 50% (perkalian 0.50)
  if (isMythicPet(pet)) {
    hungerDecayRate = Number((hungerDecayRate * 0.50).toFixed(2));
    thirstDecayRate = Number((thirstDecayRate * 0.50).toFixed(2));
    happinessDecayRate = Number((happinessDecayRate * 0.50).toFixed(2));
  }

  // Trait STURDY: mengurangi laju decay status sebesar 40% (perkalian 0.60)
  if (petHasTrait(pet, 'STURDY')) {
    hungerDecayRate = Number((hungerDecayRate * 0.60).toFixed(2));
    thirstDecayRate = Number((thirstDecayRate * 0.60).toFixed(2));
    happinessDecayRate = Number((happinessDecayRate * 0.60).toFixed(2));
  }

  // Aksesoris COLLAR_IRON: mengurangi laju decay status sebesar 15% (perkalian 0.85)
  if (pet.accessory === 'COLLAR_IRON') {
    hungerDecayRate = Number((hungerDecayRate * 0.85).toFixed(2));
    thirstDecayRate = Number((thirstDecayRate * 0.85).toFixed(2));
    happinessDecayRate = Number((happinessDecayRate * 0.85).toFixed(2));
  }

  let wallet = null;
  if (pet.auto_feed === 1) {
    wallet = economy.getWallet(pet.user_id, pet.guild_id);
  }

  let newHunger = pet.hunger;
  let newThirst = pet.thirst;
  let newHappiness = pet.happiness;
  let newHealth = pet.health;

  let hungerOverdueHours = 0;
  let thirstOverdueHours = 0;

  const hoursToSimulate = Math.floor(elapsedHours);
  const fractionalHour = elapsedHours - hoursToSimulate;

  for (let h = 0; h < hoursToSimulate; h++) {
    newHunger = Math.max(0, newHunger - hungerDecayRate);
    newThirst = Math.max(0, newThirst - thirstDecayRate);
    newHappiness = Math.max(0, newHappiness - happinessDecayRate);

    if (pet.auto_feed === 2) {
      if (newHunger <= 50) {
        newHunger = Math.min(100, newHunger + 30);
      }
      if (newThirst <= 50) {
        newThirst = Math.min(100, newThirst + 35);
      }
    } else if (pet.auto_feed === 1 && wallet) {
      if (newHunger <= 50 && wallet.balance >= 150) {
        economy.subtractBalance(pet.user_id, pet.guild_id, 150, 'PET_AUTO_FEED_FOOD');
        wallet.balance -= 150;
        newHunger = Math.min(100, newHunger + 30);
      }
      if (newThirst <= 50 && wallet.balance >= 100) {
        economy.subtractBalance(pet.user_id, pet.guild_id, 100, 'PET_AUTO_FEED_WATER');
        wallet.balance -= 100;
        newThirst = Math.min(100, newThirst + 35);
      }
    }

    if (newHunger === 0) hungerOverdueHours += 1;
    if (newThirst === 0) thirstOverdueHours += 1;
  }

  if (fractionalHour > 0) {
    newHunger = Math.max(0, newHunger - (fractionalHour * hungerDecayRate));
    newThirst = Math.max(0, newThirst - (fractionalHour * thirstDecayRate));
    newHappiness = Math.max(0, newHappiness - (fractionalHour * happinessDecayRate));

    if (pet.auto_feed === 2) {
      if (newHunger <= 50) {
        newHunger = Math.min(100, newHunger + 30);
      }
      if (newThirst <= 50) {
        newThirst = Math.min(100, newThirst + 35);
      }
    } else if (pet.auto_feed === 1 && wallet) {
      if (newHunger <= 50 && wallet.balance >= 150) {
        economy.subtractBalance(pet.user_id, pet.guild_id, 150, 'PET_AUTO_FEED_FOOD');
        wallet.balance -= 150;
        newHunger = Math.min(100, newHunger + 30);
      }
      if (newThirst <= 50 && wallet.balance >= 100) {
        economy.subtractBalance(pet.user_id, pet.guild_id, 100, 'PET_AUTO_FEED_WATER');
        wallet.balance -= 100;
        newThirst = Math.min(100, newThirst + 35);
      }
    }

    if (newHunger === 0) hungerOverdueHours += fractionalHour;
    if (newThirst === 0) thirstOverdueHours += fractionalHour;
  }

  // Starvation/Dehydration HP reduction
  let baseHPLossRate = 5;
  if (petHasTrait(pet, 'FRAGILE')) {
    baseHPLossRate = 10;
  }
  let hpReduction = Math.floor((hungerOverdueHours * baseHPLossRate * neglectHPMultiplier) + (thirstOverdueHours * baseHPLossRate * neglectHPMultiplier));
  if (petHasTrait(pet, 'STURDY')) {
    hpReduction = Math.floor(hpReduction / 2);
  }
  newHealth = Math.max(0, newHealth - hpReduction);

  // Passive HP Loss (SICK / INJURED) & HP Regen (Happiness > 80% and not starving)
  let passiveHpChange = 0;
  if (pet.status === 'SICK') {
    passiveHpChange -= 1; // -1 HP/hour
  }
  if (pet.curse_type === 'injured' && pet.curse_until > now) {
    passiveHpChange -= 2; // -2 HP/hour
  }
  // Happiness HP Regen
  if (passiveHpChange === 0 && newHappiness > 80 && hungerOverdueHours === 0 && thirstOverdueHours === 0) {
    passiveHpChange += 1; // +1 HP/hour regen
  }

  if (passiveHpChange !== 0) {
    const maxHP = getMaxHP(pet);
    newHealth = Math.max(0, Math.min(maxHP, newHealth + Math.floor(passiveHpChange * elapsedHours)));
  }

  // Death Handling, LUCKY_AMULET, and SURVIVOR Trait
  let newStatus = pet.status;
  let finalAccessory = pet.accessory;
  if (newHealth <= 0) {
    if (petHasTrait(pet, 'SURVIVOR')) {
      newHealth = 1;
      newStatus = 'WEAK';
    } else if (pet.accessory === 'LUCKY_AMULET') {
      newHealth = 20;
      newStatus = pet.level >= 10 ? 'ADULT' : 'BABY';
      finalAccessory = ''; // Jimat hancur
    } else {
      newStatus = 'DEAD';
      newHealth = 0;
    }
  }

  if (newStatus === 'WEAK' && newHealth > 1) {
    newStatus = pet.level >= 10 ? 'ADULT' : 'BABY';
  }

  db.run(
    `UPDATE user_pets 
     SET hunger = ?, thirst = ?, happiness = ?, health = ?, status = ?, last_interaction_at = ?, accessory = ?, gym_fatigue = ?
     WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
    [newHunger, newThirst, newHappiness, newHealth, newStatus, now, finalAccessory, newFatigue, pet.user_id, pet.guild_id, pet.pet_name]
  );

  return {
    ...pet,
    hunger: newHunger,
    thirst: newThirst,
    happiness: newHappiness,
    health: newHealth,
    status: newStatus,
    last_interaction_at: now,
    accessory: finalAccessory,
    gym_fatigue: newFatigue
  };
}

/**
 * Mengambil data pet user di server.
 * Sekaligus mendeteksi penetasan telur dan menerapkan decay.
 */
function getPet(userId, guildId) {
  let pet = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [userId, guildId]);
  
  if (!pet) {
    // Fallback: jika tidak ada pet aktif tapi ada pet lain, aktifkan pet pertama secara otomatis
    const anyPet = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? LIMIT 1', [userId, guildId]);
    if (anyPet) {
      db.run('UPDATE user_pets SET is_active = 1 WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [userId, guildId, anyPet.pet_name]);
      pet = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [userId, guildId]);
    } else {
      return null;
    }
  }

  const now = Math.floor(Date.now() / 1000);

  // 1. Deteksi penetasan telur
  if (pet.status === 'EGG' && pet.hatch_at <= now) {
    let hatchedTrait = pet.trait || '';
    
    // Jika tidak ada trait (telur toko), ada 35% peluang mendapatkan trait acak
    if (!hatchedTrait && Math.random() < 0.35) {
      const traits = ['MUTANT', 'GENIUS', 'STURDY', 'WARRIOR'];
      hatchedTrait = traits[Math.floor(Math.random() * traits.length)];
    }

    db.run(
      "UPDATE user_pets SET status = 'BABY', last_interaction_at = ?, trait = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?",
      [now, hatchedTrait, userId, guildId, pet.pet_name]
    );
    db.logPetAction(guildId, userId, null, pet.pet_name, 'HATCH', `Telur menetas menjadi BABY ${pet.pet_type}${hatchedTrait ? ` dengan trait ${hatchedTrait}` : ''}`);
    pet = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [userId, guildId, pet.pet_name]);
  }

  // 1b. Deteksi pertumbuhan dari BABY ke ADULT jika level >= 10
  if (pet.status === 'BABY' && pet.level >= 10) {
    db.run(
      "UPDATE user_pets SET status = 'ADULT', last_interaction_at = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?",
      [now, userId, guildId, pet.pet_name]
    );
    db.logPetAction(guildId, userId, null, pet.pet_name, 'GROWTH', `Pet tumbuh menjadi ADULT (Level ${pet.level})`);
    pet = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [userId, guildId, pet.pet_name]);
  }

  // 2. Terapkan decay status
  return applyDecay(pet);
}

/**
 * Membersihkan nama pet dari sebutan Discord, karakter zero-width,
 * karakter kontrol, backticks, dan spasi berlebih.
 * Melempar error jika nama tidak valid atau terlalu panjang.
 * 
 * @param {string} petName - Nama mentah dari input user.
 * @returns {string} Nama yang sudah dibersihkan.
 */
function sanitizePetName(petName) {
  if (!petName || typeof petName !== 'string' || petName.trim().length === 0) {
    throw new Error('Harap berikan nama untuk peliharaan Anda!');
  }
  const sanitized = petName
    .replace(/<@!?\d*>|<@&\d*>|<#\d*>|@everyone|@here/g, '')  // Discord mentions
    .replace(/[\u200B-\u200D\uFEFF\u2060\u00AD]/g, '')          // Zero-width characters
    .replace(/[\x00-\x1F\x7F]/g, '')                            // Control characters
    .replace(/`/g, '')                                           // Backticks (embed escape)
    .trim();
    
  if (sanitized.length === 0) {
    throw new Error('Nama pet tidak valid setelah dibersihkan dari karakter khusus!');
  }
  if (sanitized.length > 25) {
    throw new Error('Nama pet maksimal 25 karakter!');
  }
  // Validasi: setidaknya ada 1 huruf/angka yang terlihat
  if (!/[a-zA-Z0-9\u00C0-\u024F\u1100-\u11FF\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(sanitized)) {
    throw new Error('Nama pet harus mengandung setidaknya 1 huruf atau angka yang terlihat!');
  }
  return sanitized;
}

/**
 * Mengadopsi / membeli telur pet baru seharga Rp 1.500.
 */
function adoptPet(userId, guildId, petName, petType, paymentSource = 'pocket') {
  // Validasi input
  if (!petType || typeof petType !== 'string') {
    throw new Error('Jenis pet harus berupa teks yang valid!');
  }
  const typeUpper = petType.trim().toUpperCase();
  if (!PET_SPECIES[typeUpper]) {
    throw new Error(`Spesies pet tidak valid! Pilihan: ${Object.keys(PET_SPECIES).join(', ')}`);
  }
  
  const sanitizedName = sanitizePetName(petName);

  // Hitung jumlah pet yang sudah dimiliki (tetap dihitung untuk menentukan isActive)
  const petsCountRow = db.get('SELECT COUNT(*) as count FROM user_pets WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  const petsCount = petsCountRow ? petsCountRow.count : 0;

  // Cek apakah ada pet dengan nama yang sama (case-insensitive)
  const nameExists = db.get('SELECT 1 FROM user_pets WHERE user_id = ? AND guild_id = ? AND LOWER(pet_name) = LOWER(?)', [userId, guildId, sanitizedName.toLowerCase()]);
  if (nameExists) {
    throw new Error(`Anda sudah memiliki peliharaan dengan nama **"${sanitizedName}"**! Harap gunakan nama lain.`);
  }

  // Kurangi saldo koin Rp 1.500
  const eggPrice = 1500;
  
  let balance = 0;
  if (paymentSource === 'bank') {
    const bank = require('./bank');
    const savings = bank.getSavings(userId, guildId);
    balance = savings.balance;
  } else {
    const wallet = economy.getWallet(userId, guildId);
    balance = wallet.balance;
  }

  if (balance < eggPrice) {
    throw new Error(`Saldo koin Anda tidak mencukupi untuk mengadopsi telur pet seharga Rp ${eggPrice.toLocaleString('id-ID')}!`);
  }

  db.transaction(() => {
    economy.subtractBalance(userId, guildId, eggPrice, 'PET_ADOPT', null, paymentSource);

    const now = Math.floor(Date.now() / 1000);
    const hatchDuration = 1 * 3600; // 1 Jam menetaskan telur
    const hatchAt = now + hatchDuration;

    // Jika ini pet pertama, set is_active = 1, jika tidak set 0
    const isActive = petsCount === 0 ? 1 : 0;

    db.run(
      `INSERT INTO user_pets (user_id, guild_id, pet_name, pet_type, status, level, xp, health, hunger, thirst, happiness, last_interaction_at, hatch_at, created_at, is_active)
       VALUES (?, ?, ?, ?, 'EGG', 1, 0, 100, 100, 100, 100, ?, ?, ?, ?)`,
      [userId, guildId, sanitizedName, typeUpper, now, hatchAt, now, isActive]
    );

    db.logPetAction(guildId, userId, null, sanitizedName, 'ADOPT', `Mengadopsi telur pet ${typeUpper} seharga Rp 1.500 lewat ${paymentSource}`);
  })();

  return db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [userId, guildId, sanitizedName]);
}

/**
 * Meriset data pet (untuk menghapus pet yang mati / membuang pet).
 */
function resetPet(userId, guildId) {
  const pet = getPet(userId, guildId);
  if (!pet) {
    throw new Error('Anda tidak memiliki peliharaan aktif untuk di-reset.');
  }

  db.transaction(() => {
    db.run('DELETE FROM user_pets WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [userId, guildId, pet.pet_name]);
    
    // Cek sisa pet
    const remainingRow = db.get('SELECT COUNT(*) as count FROM user_pets WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
    const remaining = remainingRow ? remainingRow.count : 0;
    
    if (remaining > 0) {
      // Aktifkan pet tersisa lainnya secara otomatis
      const nextPet = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? LIMIT 1', [userId, guildId]);
      if (nextPet) {
        db.run('UPDATE user_pets SET is_active = 1 WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [userId, guildId, nextPet.pet_name]);
      }
    }
  })();

  return true;
}

/**
 * Mendapatkan daftar inventory barang pet.
 */
function getInventory(userId, guildId) {
  const inv = db.all('SELECT * FROM pet_inventory WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  
  // Pastikan seluruh item default tercatat minimal 0
  const mapped = {};
  Object.keys(PET_ITEMS).forEach(key => {
    mapped[key] = {
      ...PET_ITEMS[key],
      quantity: 0
    };
  });

  inv.forEach(item => {
    if (mapped[item.item_id]) {
      mapped[item.item_id].quantity = item.quantity;
    }
  });

  return Object.values(mapped);
}

/**
 * Mendapatkan stok kuantitas spesifik item di inventory.
 */
function getItemQuantity(userId, guildId, itemId) {
  const row = db.get('SELECT quantity FROM pet_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?', [userId, guildId, itemId]);
  return row ? row.quantity : 0;
}

/**
 * Membeli item supplies pet dari pet shop.
 */
function buyItem(userId, guildId, itemId, quantity = 1, paymentSource = 'pocket') {
  const qty = parseInt(quantity);
  if (isNaN(qty) || qty <= 0) {
    throw new Error('Jumlah pembelian harus minimal 1!');
  }

  const item = PET_ITEMS[itemId.toUpperCase()];
  if (!item) {
    throw new Error('Item tidak ditemukan di toko pet!');
  }

  const totalPrice = item.price * qty;
  let balance = 0;
  if (paymentSource === 'bank') {
    const bank = require('./bank');
    const savings = bank.getSavings(userId, guildId);
    balance = savings.balance;
  } else {
    const wallet = economy.getWallet(userId, guildId);
    balance = wallet.balance;
  }

  if (balance < totalPrice) {
    throw new Error(`Saldo koin Anda tidak mencukupi untuk membeli ${qty}x ${item.name} seharga Rp ${totalPrice.toLocaleString('id-ID')}!`);
  }

  if (item.type === 'ACCESSORY') {
    if (qty !== 1) {
      throw new Error('Anda hanya bisa membeli dan memasang 1 aksesoris pet dalam satu waktu!');
    }

    const petObj = getPet(userId, guildId);
    if (!petObj) {
      throw new Error('Anda tidak memiliki hewan peliharaan aktif untuk memasang aksesoris ini!');
    }
    if (petObj.status === 'DEAD') {
      throw new Error('Pet Anda sudah meninggal! Anda tidak bisa memasangkan aksesoris pada pet yang mati.');
    }
    if (petObj.status === 'EGG') {
      throw new Error('Pet Anda masih berbentuk telur! Tunggu sampai menetas untuk memasang aksesoris.');
    }

    db.transaction(() => {
      // Kurangi koin
      economy.subtractBalance(userId, guildId, totalPrice, 'PET_ACCESSORY_BUY', null, paymentSource);

      // Pasang ke pet
      db.run(
        'UPDATE user_pets SET accessory = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?',
        [item.id, userId, guildId, petObj.pet_name]
      );
    })();

    return {
      item,
      quantity: 1,
      totalPrice,
      newInventoryQty: 1,
      isAccessory: true
    };
  }

  db.transaction(() => {
    // Kurangi koin
    economy.subtractBalance(userId, guildId, totalPrice, 'PET_SHOP_BUY', null, paymentSource);

    // Tambah kuantitas ke inventory pet
    const exist = db.get('SELECT quantity FROM pet_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?', [userId, guildId, item.id]);
    if (exist) {
      db.run(
        'UPDATE pet_inventory SET quantity = quantity + ? WHERE user_id = ? AND guild_id = ? AND item_id = ?',
        [qty, userId, guildId, item.id]
      );
    } else {
      db.run(
        'INSERT INTO pet_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, ?, ?)',
        [userId, guildId, item.id, qty]
      );
    }
  })();

  return {
    item,
    quantity: qty,
    totalPrice,
    newInventoryQty: getItemQuantity(userId, guildId, item.id)
  };
}

/**
 * Memberikan item perawatan ke pet (Feed, Drink, Play, Cure).
 */
function useItem(userId, guildId, itemId, autoBuy = true, petName = null) {
  const itemKey = itemId.toUpperCase();
  const item = PET_ITEMS[itemKey];
  if (!item) {
    throw new Error('Item perawatan tidak valid!');
  }

  if (itemKey === 'MYSTERY_BOX_ANCIENT') {
    if (!petName || petName.trim() === '') {
      throw new Error('Harap berikan nama untuk pet baru Anda! Contoh: `.pet use MYSTERY_BOX_ANCIENT Kuro`');
    }
    
    // Cek slot kandang
    const countRow = db.get('SELECT COUNT(*) as count FROM user_pets WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
    const count = countRow ? countRow.count : 0;
    if (count >= 3) {
      throw new Error('Kandang pet Anda sudah penuh (Maksimal 3 Pet)! Daur ulang (recycle) pet lama Anda terlebih dahulu.');
    }
    
    // Cek kuota item di user_inventory
    const exist = db.get("SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = 'MYSTERY_BOX_ANCIENT'", [userId, guildId]);
    if (!exist || exist.quantity <= 0) {
      throw new Error('Anda tidak memiliki 🎁 Kotak Misteri Peliharaan Kuno di inventory Anda!');
    }
    
    // Kurangi item
    db.run("UPDATE user_inventory SET quantity = quantity - 1 WHERE user_id = ? AND guild_id = ? AND item_id = 'MYSTERY_BOX_ANCIENT'", [userId, guildId]);
    db.run("DELETE FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = 'MYSTERY_BOX_ANCIENT' AND quantity <= 0", [userId, guildId]);
    
    // Roll pet
    const pullResult = _rollAncientBox();
    const newPet = saveGachaPet(userId, guildId, pullResult, petName);
    
    return {
      item,
      pet: newPet,
      pullResult,
      isAncientBox: true
    };
  }

  let pet = getPet(userId, guildId);
  if (!pet) {
    throw new Error('Anda tidak memiliki hewan peliharaan!');
  }
  if (pet.status === 'EGG') {
    throw new Error('Pet Anda masih berupa telur! Mengerami telur dengan ketik `.pet` / `.pet hatch`!');
  }
  if (pet.status === 'DEAD') {
    throw new Error('Pet Anda telah meninggal dunia 🪦. Ketik `.pet reset` untuk mengadopsi yang baru.');
  }

  // Cek batas status pet (100% capacity)
  if (item.hunger > 0 && pet.hunger >= 100) {
    throw new Error('Pet Anda sudah kenyang!');
  }
  if (item.id === 'WATER' && pet.thirst >= 100) {
    throw new Error('Pet Anda sudah tidak haus!');
  }
  if (item.id === 'TOY' && pet.happiness >= 100) {
    throw new Error('Pet Anda sudah sangat bahagia!');
  }

  // Cek cooldown item
  const remainingCooldown = getItemCooldown(userId, guildId, item.id);
  if (remainingCooldown > 0) {
    const mins = Math.floor(remainingCooldown / 60);
    const secs = remainingCooldown % 60;
    throw new Error(`Item **${item.name}** sedang cooldown! Silakan tunggu **${mins} menit ${secs} detik** lagi.`);
  }

  // 1. Cek stok, jika habis gunakan auto-buy jika diizinkan
  let qty = getItemQuantity(userId, guildId, item.id);
  let didAutoBuy = false;

  if (qty <= 0) {
    if (autoBuy) {
      buyItem(userId, guildId, item.id, 1);
      didAutoBuy = true;
    } else {
      throw new Error(`Anda tidak memiliki **${item.name}**! Beli dulu di toko pet.`);
    }
  }

  // 2. Validasi status spesifik dengan batas HP dinamis
  const maxHP = getMaxHP(pet);
  const isInjured = pet.curse_type === 'injured' && pet.curse_until > Math.floor(Date.now() / 1000);
  if (!item.multiplier && item.cures && pet.health >= maxHP && pet.status !== 'SICK' && !isInjured) {
    throw new Error('Pet Anda dalam kondisi sangat sehat, tidak memerlukan obat-obatan!');
  }

  if (item.multiplier) {
    if ((pet.xp_multiplier || 1.0) >= item.multiplier) {
      throw new Error(`Pet Anda sudah memiliki pengali XP **${pet.xp_multiplier || 1.0}x** atau lebih tinggi!`);
    }
  }

  let xpGained = 0;
  let levelUp = false;

  // 3. Eksekusi konsumsi item
  db.transaction(() => {
    // Potong kuantitas inventory
    db.run(
      'UPDATE pet_inventory SET quantity = quantity - 1 WHERE user_id = ? AND guild_id = ? AND item_id = ?',
      [userId, guildId, item.id]
    );

    // Set cooldown
    if (item.cooldown > 0) {
      setItemCooldown(userId, guildId, item.id, item.cooldown);
    }

    const now = Math.floor(Date.now() / 1000);

    if (item.multiplier) {
      // Set XP multiplier & give instant XP based on pet level * 100 * (multiplier / 2)
      xpGained = Math.round(pet.level * 100 * (item.multiplier / 2.0));
      const resXp = addXp(pet, xpGained, maxHP);
      levelUp = resXp.levelUp;
      const newHealth = levelUp ? maxHP : pet.health;
      const newStatus = levelUp && pet.status === 'BABY' && resXp.newLevel >= 10 ? 'ADULT' : pet.status;

      db.run(
        `UPDATE user_pets 
         SET xp_multiplier = ?, xp = ?, level = ?, health = ?, status = ?, last_interaction_at = ?
         WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
        [item.multiplier, resXp.newXp, resXp.newLevel, newHealth, newStatus, now, userId, guildId, pet.pet_name]
      );
    } else {
      // Update stats pet
      let newHunger = Math.min(100, pet.hunger + item.hunger);
      let newThirst = Math.min(100, pet.thirst + item.thirst);
      let newHappiness = Math.min(100, pet.happiness + item.happiness);
      let newHealth = Math.min(maxHP, pet.health + item.hp);

      // Dapatkan XP dari perawatan (+10 XP per aksi perawatan) dikali xp_multiplier
      xpGained = Math.round(10 * (pet.xp_multiplier || 1.0));
      let { newXp, newLevel, levelUp: careLevelUp } = addXp(pet, xpGained, maxHP);
      levelUp = careLevelUp;
      if (levelUp) {
        newHealth = maxHP; // Full HP saat naik level
      }

      let newStatus = pet.status;
      let finalCurseType = pet.curse_type;
      let finalCurseUntil = pet.curse_until;

      if (item.cures) {
        if (pet.status === 'SICK') {
          newStatus = newLevel >= 10 ? 'ADULT' : 'BABY';
        }
        if (pet.curse_type === 'injured') {
          finalCurseType = '';
          finalCurseUntil = 0;
        }
      }

      if (newStatus === 'WEAK' && newHealth > 1) {
        newStatus = newLevel >= 10 ? 'ADULT' : 'BABY';
      }

      db.run(
        `UPDATE user_pets 
         SET hunger = ?, thirst = ?, happiness = ?, health = ?, xp = ?, level = ?, status = ?, last_interaction_at = ?, curse_type = ?, curse_until = ?
         WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
        [newHunger, newThirst, newHappiness, newHealth, newXp, newLevel, newStatus, now, finalCurseType, finalCurseUntil, userId, guildId, pet.pet_name]
      );

      // Hook quest progress for FEED
      if (item.hunger > 0 || item.thirst > 0) {
        incrementQuestProgress(userId, guildId, 'FEED', 1);
      }
    }
  })();

  const updatedPet = getPet(userId, guildId);
  db.logPetAction(guildId, userId, null, pet.pet_name, 'USE_ITEM', `Menggunakan item ${item.name}${didAutoBuy ? ' (Auto-buy)' : ''}. XP: +${xpGained}${levelUp ? ` (Naik ke Level ${updatedPet.level}!)` : ''}`);
  return {
    pet: updatedPet,
    item,
    didAutoBuy,
    xpGained,
    levelUp
  };
}

/**
 * Bermain dengan pet (tanpa item, memulihkan +20 happiness, cooldown 15 menit).
 */
function playWithPet(userId, guildId) {
  const pet = getPet(userId, guildId);
  if (!pet) throw new Error('Anda tidak memiliki hewan peliharaan!');
  if (pet.status === 'EGG') throw new Error('Pet Anda masih berupa telur!');
  if (pet.status === 'DEAD') throw new Error('Pet Anda sudah meninggal 🪦.');

  const now = Math.floor(Date.now() / 1000);
  if (pet.curse_type === 'smelly' && pet.curse_until > now) {
    throw new Error(`🦨 **${pet.pet_name}** menutup hidungnya dan berteriak:\n*"Gak mau! Badan aku bau busuk jigong naga! Mandiin aku dulu pake sabun Sultan (\\.pet mandiin)!"*`);
  }

  if (pet.happiness >= 100) {
    throw new Error('Pet Anda sudah sangat bahagia dan tidak ingin bermain lagi saat ini!');
  }

  // Cek cooldown bermain (15 menit)
  const cooldownDuration = 15 * 60; // 15 Menit
  const nextPlayTime = (pet.last_play_at || 0) + cooldownDuration;
  if (now < nextPlayTime) {
    const timeLeft = nextPlayTime - now;
    const minLeft = Math.ceil(timeLeft / 60);
    throw new Error(`Pet Anda masih lelah bermain. Ajak dia bermain lagi dalam **${minLeft} menit**.`);
  }

  // Beri batas bermain: gratis memulihkan +25 Happiness, +15 XP dikali xp_multiplier
  db.transaction(() => {
    let newHappiness = Math.min(100, pet.happiness + 25);
    let xpGained = Math.round(15 * (pet.xp_multiplier || 1.0));
    const maxHP = getMaxHP(pet);
    let { newXp, newLevel, levelUp } = addXp(pet, xpGained, maxHP);

    db.run(
      `UPDATE user_pets SET happiness = ?, xp = ?, level = ?, last_interaction_at = ?, last_play_at = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
      [newHappiness, newXp, newLevel, now, now, userId, guildId, pet.pet_name]
    );

    // Hook quest progress for PLAY
    incrementQuestProgress(userId, guildId, 'PLAY', 1);
  })();

  const updatedPet = getPet(userId, guildId);
  db.logPetAction(guildId, userId, null, pet.pet_name, 'PLAY', `Bermain dengan pet. Kebahagiaan menjadi ${updatedPet.happiness}%.`);
  return updatedPet;
}

/**
 * Mengirim pet untuk Bekerja (Work) mencari uang aman (cooldown 2 jam).
 */
function sendToWork(userId, guildId, member = null) {
  const pet = getPet(userId, guildId);
  if (!pet) throw new Error('Anda tidak memiliki hewan peliharaan!');
  if (pet.status === 'EGG') throw new Error('Pet Anda masih berupa telur!');
  if (pet.status === 'DEAD') throw new Error('Pet Anda sudah meninggal 🪦.');

  const now = Math.floor(Date.now() / 1000);
  if (pet.curse_type === 'smelly' && pet.curse_until > now) {
    throw new Error(`🦨 **${pet.pet_name}** menutup hidungnya dan berteriak:\n*"Gak mau! Badan aku bau busuk jigong naga! Mandiin aku dulu pake sabun Sultan (\\.pet mandiin)!"*`);
  }
  if (pet.curse_type === 'injured' && pet.curse_until > now) {
    throw new Error(`🤕 **${pet.pet_name}** terluka parah akibat kekalahan bertarung! Dia terbaring lemas dan membutuhkan Ramuan Kesehatan (.pet pakai medicine) untuk diobati.`);
  }
  if (pet.status === 'WEAK') {
    throw new Error(`🤕 **${pet.pet_name}** sangat lemas kelaparan! Beri dia makan/minum terlebih dahulu.`);
  }

  // Syarat kerja
  if (pet.health < 30) {
    throw new Error('Pet Anda terlalu lelah atau sakit (HP < 30)! Obati dia terlebih dahulu.');
  }
  if (pet.hunger < 20 || pet.thirst < 20) {
    throw new Error('Pet Anda terlalu lapar atau haus! Beri makan dan minum sebelum bekerja.');
  }

  // Hitung cooldown (Work: 15 Menit)
  let cooldownDuration = 15 * 60; // 15 Menit
  // Golem Perk: Cooldown kerja dikurangi 5 menit (300 detik)
  if (pet.pet_type === 'GOLEM') {
    cooldownDuration -= 5 * 60;
  }

  // Integrasi Luxury Shop: Rolex mengurangi cooldown kerja pet sebesar 5 menit (300 detik)
  try {
    const rolexQty = db.get(
      "SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = 'ROLEX'",
      [userId, guildId]
    );
    if (rolexQty && rolexQty.quantity > 0) {
      cooldownDuration -= 5 * 60;
    }
  } catch (e) {
    console.error("Gagal membaca rolex untuk pet work cooldown:", e.message);
  }

  // Bypass Cooldown: Cooldown kerja dikurangi 50% untuk pet IMMORTAL
  if (isGodPet(pet)) {
    cooldownDuration = Math.round(cooldownDuration * 0.5);
  }

  const nextWorkTime = (pet.last_work_at || 0) + cooldownDuration;
  if (now < nextWorkTime) {
    const timeLeft = nextWorkTime - now;
    const minLeft = Math.ceil(timeLeft / 60);
    throw new Error(`Pet Anda sedang istirahat. Dia bisa bekerja kembali dalam **${minLeft} menit**.`);
  }

  // Kalkulasi Pendapatan Kerja
  // Level memberikan bonus multiplier
  const baseRewardMin = 40;
  const baseRewardMax = 100;
  let reward = Math.floor(Math.random() * (baseRewardMax - baseRewardMin + 1)) + baseRewardMin;
  
  // Bonus level: +5% pendapatan per level pet (dibatasi di maksimal Level 20 untuk menyeimbangkan ekonomi)
  const levelBonus = Math.floor(reward * (Math.min(20, pet.level) * 0.05));
  let finalReward = reward + levelBonus;
  if (petHasTrait(pet, 'MUTANT')) {
    finalReward = Math.round(finalReward * 1.15); // Mutant: +15% work earnings
  }

  // Apply species workBuff if exists
  const speciesInfo = GACHA_SPECIES[pet.pet_type];
  const workBuff = speciesInfo ? (speciesInfo.workBuff || 0) : 0;
  if (workBuff > 0) {
    finalReward = Math.round(finalReward * (1 + workBuff));
  }

  // Gacha Role Bonus untuk Pendapatan & XP Pet Work
  let gachaWorkBonus = 1.0;
  let gachaXpBonus = 1.0;
  if (member) {
    const gachaTier = economy.getMemberGachaTier(member, guildId);
    if (gachaTier === 'COMMON') {
      gachaXpBonus = 1.10;
    } else if (gachaTier === 'RARE') {
      gachaXpBonus = 1.20;
    } else if (gachaTier === 'EPIC') {
      gachaXpBonus = 1.30;
      gachaWorkBonus = 1.10;
    } else if (gachaTier === 'LEGENDARY') {
      gachaXpBonus = 1.50;
      gachaWorkBonus = 1.20;
    } else if (gachaTier === 'MYTHIC') {
      gachaXpBonus = 2.00;
      gachaWorkBonus = 1.35;
    }
  }

  finalReward = Math.round(finalReward * gachaWorkBonus);

  // Dampak Kerja: Mengurangi Kenyangan -15, Hidrasi -15, Kebahagiaan -10
  db.transaction(() => {
    // Tambahkan saldo uang bot
    economy.addBalance(userId, guildId, finalReward, 'PET_WORK');

    // Beri XP (+30 XP) dikali xp_multiplier dan gacha bonus
    let xpGained = Math.round(30 * (pet.xp_multiplier || 1.0) * gachaXpBonus);
    const maxHP = getMaxHP(pet);
    let { newXp, newLevel, levelUp } = addXp(pet, xpGained, maxHP);

    const isGod = isGodPet(pet);
    const newHunger = isGod ? 100 : Math.max(0, pet.hunger - 20);
    const newThirst = isGod ? 100 : Math.max(0, pet.thirst - 20);
    const newHappiness = isGod ? 100 : Math.max(0, pet.happiness - 15);

    db.run(
      `UPDATE user_pets 
       SET last_work_at = ?, hunger = ?, thirst = ?, happiness = ?, xp = ?, level = ?, last_interaction_at = ?
       WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
      [now, newHunger, newThirst, newHappiness, newXp, newLevel, now, userId, guildId, pet.pet_name]
    );

    // Hook quest progress for WORK
    incrementQuestProgress(userId, guildId, 'WORK', 1);
  })();

  db.logPetAction(guildId, userId, null, pet.pet_name, 'WORK', `Bekerja dan menghasilkan Rp ${finalReward.toLocaleString('id-ID')}.`);
  return {
    pet: getPet(userId, guildId),
    reward: finalReward,
    baseReward: reward,
    levelBonus
  };
}

/**
 * Mengirim pet untuk Berburu (Hunt) ke dalam hutan liar (cooldown 4 jam).
 */
function sendToHunt(userId, guildId, member = null) {
  const pet = getPet(userId, guildId);
  if (!pet) throw new Error('Anda tidak memiliki hewan peliharaan!');
  if (pet.status === 'EGG') throw new Error('Pet Anda masih berupa telur!');
  if (pet.status === 'DEAD') throw new Error('Pet Anda sudah meninggal 🪦.');

  const now = Math.floor(Date.now() / 1000);
  if (pet.curse_type === 'smelly' && pet.curse_until > now) {
    throw new Error(`🦨 **${pet.pet_name}** menutup hidungnya dan berteriak:\n*"Gak mau! Badan aku bau busuk jigong naga! Mandiin aku dulu pake sabun Sultan (\\.pet mandiin)!"*`);
  }
  if (pet.curse_type === 'injured' && pet.curse_until > now) {
    throw new Error(`🤕 **${pet.pet_name}** terluka parah akibat kekalahan bertarung! Dia terbaring lemas dan membutuhkan Ramuan Kesehatan (.pet pakai medicine) untuk diobati.`);
  }
  if (pet.status === 'WEAK') {
    throw new Error(`🤕 **${pet.pet_name}** sangat lemas kelaparan! Beri dia makan/minum terlebih dahulu.`);
  }
  const isGod = isGodPet(pet);
  if (!isGod && pet.status === 'BABY') {
    throw new Error('Pet Anda masih bayi! Dia harus bertumbuh menjadi dewasa (Level >= 10) terlebih dahulu sebelum bisa berburu.');
  }

  // Syarat berburu
  if (pet.health < 50) {
    throw new Error('Kondisi pet Anda terlalu lemah untuk berburu (HP < 50)! Berikan obat.');
  }
  if (pet.happiness < 50) {
    throw new Error('Mood pet Anda terlalu buruk untuk berburu (Kebahagiaan < 50)! Ajak bermain.');
  }
  let cooldownDuration = 30 * 60; // 30 Menit
  if (isGod) {
    cooldownDuration = Math.round(cooldownDuration * 0.5);
  }

  const nextHuntTime = (pet.last_hunt_at || 0) + cooldownDuration;
  if (now < nextHuntTime) {
    const timeLeft = nextHuntTime - now;
    const minLeft = Math.ceil(timeLeft / 60);
    throw new Error(`Pet Anda masih lelah berburu. Dia bisa pergi berburu lagi dalam **${minLeft} menit**.`);
  }

  // Pendapatan Berburu (Lebih besar namun menguras status)
  const baseRewardMin = 75;
  const baseRewardMax = 200;
  let reward = Math.floor(Math.random() * (baseRewardMax - baseRewardMin + 1)) + baseRewardMin;

  // Cat Perk: Kucing lincah mendapat bonus +15% hunt earnings
  if (pet.pet_type === 'CAT') {
    reward = Math.round(reward * 1.15);
  }

  const levelBonus = Math.floor(reward * (Math.min(20, pet.level) * 0.05));
  let finalReward = reward + levelBonus;
  if (petHasTrait(pet, 'MUTANT')) {
    finalReward = Math.round(finalReward * 1.15); // Mutant: +15% hunt earnings
  }

  // Apply species workBuff if exists
  const speciesInfo = GACHA_SPECIES[pet.pet_type];
  const workBuff = speciesInfo ? (speciesInfo.workBuff || 0) : 0;
  if (workBuff > 0) {
    finalReward = Math.round(finalReward * (1 + workBuff));
  }

  // Gacha Role Bonus untuk Pendapatan & XP Pet Hunt
  let gachaHuntBonus = 1.0;
  let gachaXpBonus = 1.0;
  if (member) {
    const gachaTier = economy.getMemberGachaTier(member, guildId);
    if (gachaTier === 'COMMON') {
      gachaXpBonus = 1.10;
    } else if (gachaTier === 'RARE') {
      gachaXpBonus = 1.20;
    } else if (gachaTier === 'EPIC') {
      gachaXpBonus = 1.30;
      gachaHuntBonus = 1.10;
    } else if (gachaTier === 'LEGENDARY') {
      gachaXpBonus = 1.50;
      gachaHuntBonus = 1.20;
    } else if (gachaTier === 'MYTHIC') {
      gachaXpBonus = 2.00;
      gachaHuntBonus = 1.35;
    }
  }

  finalReward = Math.round(finalReward * gachaHuntBonus);

  // Peluang dapat item langka
  let dropItem = null;
  let dropProb = 0.05; // 5% default
  if (pet.pet_type === 'CAT') {
    dropProb = 0.10; // Kucing perk: +5% (total 10%)
  }

  if (Math.random() < dropProb) {
    // Acak item langka
    const items = ['FOOD_PREMIUM', 'MEDICINE', 'TOY'];
    const selectedItemKey = items[Math.floor(Math.random() * items.length)];
    dropItem = PET_ITEMS[selectedItemKey];

    // Tambahkan item ke inventory
    const exist = db.get('SELECT quantity FROM pet_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?', [userId, guildId, dropItem.id]);
    if (exist) {
      db.run(
        'UPDATE pet_inventory SET quantity = quantity + 1 WHERE user_id = ? AND guild_id = ? AND item_id = ?',
        [userId, guildId, dropItem.id]
      );
    } else {
      db.run(
        'INSERT INTO pet_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, ?, 1)',
        [userId, guildId, dropItem.id]
      );
    }
  }

  // Dampak Berburu: Kenyangan -25, Hidrasi -25, Kebahagiaan -15, HP -10
  db.transaction(() => {
    // Berikan koin
    economy.addBalance(userId, guildId, finalReward, 'PET_HUNT');

    // Beri XP (+60 XP) dikali xp_multiplier dan gacha bonus
    let xpGained = Math.round(60 * (pet.xp_multiplier || 1.0) * gachaXpBonus);
    const maxHP = getMaxHP(pet);
    let { newXp, newLevel, levelUp } = addXp(pet, xpGained, maxHP);

    const newHunger = isGod ? 100 : Math.max(0, pet.hunger - 30);
    const newThirst = isGod ? 100 : Math.max(0, pet.thirst - 30);
    const newHappiness = isGod ? 100 : Math.max(0, pet.happiness - 20);
    const newHealth = isGod ? 100 : Math.max(1, pet.health - 15);

    db.run(
      `UPDATE user_pets 
       SET last_hunt_at = ?, hunger = ?, thirst = ?, happiness = ?, health = ?, xp = ?, level = ?, last_interaction_at = ?
       WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
      [now, newHunger, newThirst, newHappiness, newHealth, newXp, newLevel, now, userId, guildId, pet.pet_name]
    );

    // Hook quest progress for HUNT
    incrementQuestProgress(userId, guildId, 'HUNT', 1);
  })();

  db.logPetAction(guildId, userId, null, pet.pet_name, 'HUNT', `Berburu dan menghasilkan Rp ${finalReward.toLocaleString('id-ID')}.${dropItem ? ` Mendapatkan item drop: ${dropItem.name}` : ''}`);
  return {
    pet: getPet(userId, guildId),
    reward: finalReward,
    baseReward: reward,
    levelBonus,
    dropItem
  };
}

/**
 * Melakukan pertempuran PvP antar pet di arena taruhan.
 */
function executePvP(challengerId, opponentId, guildId, betAmount) {
  const challenger = getPet(challengerId, guildId);
  const opponent = getPet(opponentId, guildId);
  if (!challenger) throw new Error('Anda tidak memiliki pet aktif untuk bertarung!');
  if (!opponent) throw new Error('Lawan tidak memiliki pet aktif untuk bertarung!');

  const isGodChallenger = isGodPet(challenger);
  if (!isGodChallenger && (challenger.status === 'EGG' || challenger.status === 'BABY')) {
    throw new Error('Pet Anda harus berstatus Dewasa (Level >= 10) untuk bertarung di PvP Arena!');
  }

  const isGodOpponent = isGodPet(opponent);
  if (!isGodOpponent && (opponent.status === 'EGG' || opponent.status === 'BABY')) {
    throw new Error('Pet lawan masih bayi atau berupa telur! Pertarungan dibatalkan.');
  }

  if (challenger.health < 40) throw new Error('Pet Anda terlalu lemah (HP < 40) untuk bertarung! Obati dia.');
  if (opponent.health < 40) throw new Error('Pet lawan dalam kondisi terlalu lelah (HP < 40) untuk bertarung!');

  // Cek koin kedua pemain
  const chalWallet = economy.getWallet(challengerId, guildId);
  const oppWallet = economy.getWallet(opponentId, guildId);

  if (chalWallet.balance < betAmount) throw new Error(`Saldo koin Anda tidak mencukupi taruhan Rp ${betAmount.toLocaleString('id-ID')}!`);
  if (oppWallet.balance < betAmount) throw new Error(`Saldo koin lawan tidak mencukupi taruhan Rp ${betAmount.toLocaleString('id-ID')}!`);

  // --- BATTLE SIMULATION ---
  const logs = [];
  let chalHP = challenger.health;
  let oppHP = opponent.health;

  // Hitung stats tempur awal
  // Base Attack = Species Base ATK + Level * 5 + STR * 2
  const chalSpecies = GACHA_SPECIES[challenger.pet_type];
  const chalSpecBaseAtk = chalSpecies ? (chalSpecies.baseAtk || 10) : 10;
  let chalBaseAtk = chalSpecBaseAtk + challenger.level * 5 + (challenger.stat_str || 0) * 2;
  if (isGodChallenger) chalBaseAtk *= 3; // Immortal: 3x ATK
 
  const oppSpecies = GACHA_SPECIES[opponent.pet_type];
  const oppSpecBaseAtk = oppSpecies ? (oppSpecies.baseAtk || 10) : 10;
  let oppBaseAtk = oppSpecBaseAtk + opponent.level * 5 + (opponent.stat_str || 0) * 2;
  if (isGodOpponent) oppBaseAtk *= 3; // Immortal: 3x ATK
 
  let chalAtkMultiplier = challenger.pet_type === 'DRAGON' ? 1.15 : 1.0;
  if (petHasTrait(challenger, 'WARRIOR')) chalAtkMultiplier += 0.15; // Warrior: +15% attack
  if (challenger.accessory === 'SWORD_TOY') chalAtkMultiplier += 0.15; // Toy Sword: +15% damage
  chalAtkMultiplier += (challenger.base_atk_bonus_pct || 0.0); // Tambah bonus bintang gacha
 
  let oppAtkMultiplier = opponent.pet_type === 'DRAGON' ? 1.15 : 1.0;
  if (petHasTrait(opponent, 'WARRIOR')) oppAtkMultiplier += 0.15; // Warrior: +15% attack
  if (opponent.accessory === 'SWORD_TOY') oppAtkMultiplier += 0.15; // Toy Sword: +15% damage
  oppAtkMultiplier += (opponent.base_atk_bonus_pct || 0.0); // Tambah bonus bintang gacha
 
  // Kalkulasi Reduksi Damage (Defense: base def + Sturdy/Shield + stat_def * 0.5%)
  const chalSpecBaseDef = chalSpecies ? (chalSpecies.baseDef || 0) : 0;
  let chalDefMult = 1.0;
  if (petHasTrait(challenger, 'STURDY')) chalDefMult *= 0.85; // Sturdy: -15% damage
  if (challenger.accessory === 'SHIELD_TOY') chalDefMult *= 0.85; // Toy Shield: -15% damage
  const chalDefGym = Math.min(0.50, (challenger.stat_def || 0) * 0.005);
  let chalDamageTakenMult = (1.0 - (chalSpecBaseDef / 100)) * chalDefMult * (1.0 - (challenger.base_def_bonus_pct || 0.0)) * (1.0 - chalDefGym);
  if (isGodChallenger) chalDamageTakenMult *= 0.25; // Immortal: 75% Damage Reduction
 
  const oppSpecBaseDef = oppSpecies ? (oppSpecies.baseDef || 0) : 0;
  let oppDefMult = 1.0;
  if (petHasTrait(opponent, 'STURDY')) oppDefMult *= 0.85; // Sturdy: -15% damage
  if (opponent.accessory === 'SHIELD_TOY') oppDefMult *= 0.85; // Toy Shield: -15% damage
  const oppDefGym = Math.min(0.50, (opponent.stat_def || 0) * 0.005);
  let oppDamageTakenMult = (1.0 - (oppSpecBaseDef / 100)) * oppDefMult * (1.0 - (opponent.base_def_bonus_pct || 0.0)) * (1.0 - oppDefGym);
  if (isGodOpponent) oppDamageTakenMult *= 0.25; // Immortal: 75% Damage Reduction
 
  let round = 1;
  const maxRounds = 5;
 
  while (round <= maxRounds && chalHP > 0 && oppHP > 0) {
    // 1. Giliran Challenger menyerang Opponent
    let chalDmg = Math.round((chalBaseAtk * chalAtkMultiplier * (0.8 + Math.random() * 0.4))); // Fluktuasi 80%-120%
    chalDmg = Math.round(chalDmg * oppDamageTakenMult);
    
    // Crit Chance DEX (0.5% per DEX, max 35%, Crit DMG = 1.5x)
    const chalDex = challenger.stat_dex || 0;
    const chalCritChance = Math.min(0.35, chalDex * 0.005);
    const isChalCrit = Math.random() < chalCritChance;
    if (isChalCrit) {
      chalDmg = Math.round(chalDmg * 1.5);
    }
    
    oppHP = Math.max(0, oppHP - chalDmg);
    const critText = isChalCrit ? ' 💥 **CRITICAL STRIKE!**' : '';
    logs.push(`⚔️ **Ronde ${round} (Serangan):** **${challenger.pet_name}** menyerang **${opponent.pet_name}** dan memberikan **${chalDmg} DMG**!${critText} (HP Lawan: ${oppHP}%)`);
 
    if (oppHP <= 0) break;
 
    // 2. Giliran Opponent menyerang Challenger
    let oppDmg = Math.round((oppBaseAtk * oppAtkMultiplier * (0.8 + Math.random() * 0.4)));
    oppDmg = Math.round(oppDmg * chalDamageTakenMult);
    
    // Crit Chance DEX (0.5% per DEX, max 35%, Crit DMG = 1.5x)
    const oppDex = opponent.stat_dex || 0;
    const oppCritChance = Math.min(0.35, oppDex * 0.005);
    const isOppCrit = Math.random() < oppCritChance;
    if (isOppCrit) {
      oppDmg = Math.round(oppDmg * 1.5);
    }
    
    chalHP = Math.max(0, chalHP - oppDmg);
    const critTextOpp = isOppCrit ? ' 💥 **CRITICAL STRIKE!**' : '';
    logs.push(`🛡️ **Ronde ${round} (Balasan):** **${opponent.pet_name}** membalas serang **${challenger.pet_name}** sebesar **${oppDmg} DMG**!${critTextOpp} (HP Anda: ${chalHP}%)`);
 
    round++;
  }

  // Tentukan pemenang
  let winnerId = null;
  let loserId = null;
  let winnerName = '';
  let loserName = '';

  if (chalHP > oppHP) {
    winnerId = challengerId;
    loserId = opponentId;
    winnerName = challenger.pet_name;
    loserName = opponent.pet_name;
  } else if (oppHP > chalHP) {
    winnerId = opponentId;
    loserId = challengerId;
    winnerName = opponent.pet_name;
    loserName = challenger.pet_name;
  } else {
    // Seri, potong taruhan dikembalikan utuh (tanpa pemenang)
    db.logPetAction(guildId, challengerId, null, challenger.pet_name, 'PVP_BATTLE', `PvP seri melawan ${opponent.pet_name} (milik <@${opponentId}>). Taruhan: Rp ${betAmount}`);
    db.logPetAction(guildId, opponentId, null, opponent.pet_name, 'PVP_BATTLE', `PvP seri melawan ${challenger.pet_name} (milik <@${challengerId}>). Taruhan: Rp ${betAmount}`);
    return {
      draw: true,
      logs,
      challengerHP: chalHP,
      opponentHP: oppHP,
      challengerName: challenger.pet_name,
      opponentName: opponent.pet_name
    };
  }

  // Distribusi Hadiah (Pajak 5%)
  const tax = Math.floor(betAmount * 2 * 0.05);
  const prizePool = (betAmount * 2) - tax;

  db.transaction(() => {
    // Potong taruhan pecundang
    economy.subtractBalance(loserId, guildId, betAmount, 'PET_PVP_BET_LOST');
    // Tambah taruhan ke pemenang (dikurangi pajak)
    economy.addBalance(winnerId, guildId, prizePool - betAmount, 'PET_PVP_BET_WON'); // Menambah selisih bersih

    // Update HP & Kebahagiaan kedua pet
    // Pemenang kehilangan -10 HP, -5 Kebahagiaan
    // Pecundang kehilangan -30 HP, -20 Kebahagiaan
    let wHP = Math.max(10, (winnerId === challengerId ? chalHP : oppHP) - 10);
    let lHP = Math.max(10, (loserId === challengerId ? chalHP : oppHP) - 30);

    let wHappy = Math.max(20, (winnerId === challengerId ? challenger.happiness : opponent.happiness) - 5);
    let lHappy = Math.max(10, (loserId === challengerId ? challenger.happiness : opponent.happiness) - 25);

    // Proteksi God Pet Ramzi agar status tidak berkurang
    if (winnerId === challengerId && isGodChallenger) {
      wHP = 100;
      wHappy = 100;
    } else if (winnerId === opponentId && isGodOpponent) {
      wHP = 100;
      wHappy = 100;
    }

    if (loserId === challengerId && isGodChallenger) {
      lHP = 100;
      lHappy = 100;
    } else if (loserId === opponentId && isGodOpponent) {
      lHP = 100;
      lHappy = 100;
    }

    // Beri XP (+50 XP pemenang, +20 XP kalah) dikali xp_multiplier masing-masing
    const winnerPet = winnerId === challengerId ? challenger : opponent;
    const wMaxHP = getMaxHP(winnerPet);
    const wXpGained = Math.round(50 * (winnerPet.xp_multiplier || 1.0));
    let { newXp: wXp, newLevel: wLevel } = addXp(winnerPet, wXpGained, wMaxHP);

    const loserPet = loserId === challengerId ? challenger : opponent;
    const lMaxHP = getMaxHP(loserPet);
    const lXpGained = Math.round(20 * (loserPet.xp_multiplier || 1.0));
    let { newXp: lXp, newLevel: lLevel } = addXp(loserPet, lXpGained, lMaxHP);

    let lStatus = loserPet.status;
    if ((winnerId === challengerId && isGodChallenger) || (winnerId === opponentId && isGodOpponent)) {
      lHP = 0;
      lStatus = 'DEAD';
    }

    let finalCurseType = loserPet.curse_type;
    let finalCurseUntil = loserPet.curse_until;
    let injuredTriggered = false;

    const isGodLoser = isGodPet(loserPet);
    if (!isGodLoser && lStatus !== 'DEAD' && Math.random() < 0.15) {
      finalCurseType = 'injured';
      finalCurseUntil = Math.floor(Date.now() / 1000) + 86400 * 7; // Cedera 7 hari
      injuredTriggered = true;
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
      logs.push(`⚠️ **Cedera Tempur!** Pet **${loserName}** terluka parah akibat kekalahan bertarung di PvP Arena dan mengalami status **INJURED** (Kurang 2 HP/jam secara pasif sampai diobati dengan Ramuan Kesehatan).`);
    }
  })();

  db.logPetAction(guildId, winnerId, null, winnerName, 'PVP_BATTLE', `Menang PvP melawan ${loserName} (milik <@${loserId}>). Taruhan: Rp ${betAmount}, Bersih: Rp ${prizePool}`);
  db.logPetAction(guildId, loserId, null, loserName, 'PVP_BATTLE', `Kalah PvP melawan ${winnerName} (milik <@${winnerId}>). Taruhan: Rp ${betAmount}`);

  return {
    draw: false,
    winnerId,
    loserId,
    winnerName,
    loserName,
    prizePool,
    tax,
    logs,
    challengerHP: chalHP,
    opponentHP: oppHP
  };
}

function getPetsList(userId, guildId) {
  const pets = db.all('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  return pets.map(pet => applyDecay(pet));
}

function switchActivePet(userId, guildId, petName) {
  const pet = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND LOWER(pet_name) = LOWER(?)', [userId, guildId, petName.trim()]);
  if (!pet) {
    throw new Error(`Pet dengan nama "${petName}" tidak ditemukan!`);
  }
  
  db.transaction(() => {
    db.run('UPDATE user_pets SET is_active = 0 WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
    db.run('UPDATE user_pets SET is_active = 1 WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [userId, guildId, pet.pet_name]);
  })();
  
  db.logPetAction(guildId, userId, null, pet.pet_name, 'SWITCH_ACTIVE', `Mengaktifkan pet ${pet.pet_name} the ${pet.pet_type}.`);
  return pet;
}

/**
 * Breeding Pet (Kawin Silang): Mengawinkan dua pet aktif dewasa.
 */
function breedPets(challengerId, partnerId, guildId, newPetName) {
  const challenger = getPet(challengerId, guildId);
  const partner = getPet(partnerId, guildId);

  if (!challenger) throw new Error('Anda tidak memiliki hewan peliharaan aktif!');
  if (!partner) throw new Error('Partner tidak memiliki hewan peliharaan aktif!');

  if (challenger.status !== 'ADULT') {
    throw new Error(`Pet Anda **${challenger.pet_name}** belum dewasa! Dia harus bertumbuh hingga Level >= 10.`);
  }
  if (partner.status !== 'ADULT') {
    throw new Error(`Pet partner **${partner.pet_name}** belum dewasa! Harus bertumbuh hingga Level >= 10.`);
  }

  if (challenger.curse_type === 'smelly' && challenger.curse_until > now) {
    throw new Error(`🦨 Pet Anda **${challenger.pet_name}** terlalu bau busuk untuk kawin! Mandikan dia terlebih dahulu.`);
  }
  if (partner.curse_type === 'smelly' && partner.curse_until > now) {
    throw new Error(`🦨 Pet partner **${partner.pet_name}** terlalu bau busuk! Partner harus memandikannya terlebih dahulu.`);
  }
  if (challenger.curse_type === 'injured' && challenger.curse_until > now) {
    throw new Error(`🤕 Pet Anda **${challenger.pet_name}** sedang terluka parah untuk kawin! Sembuhkan dia terlebih dahulu.`);
  }
  if (partner.curse_type === 'injured' && partner.curse_until > now) {
    throw new Error(`🤕 Pet partner **${partner.pet_name}** sedang terluka parah! Sembuhkan dia terlebih dahulu.`);
  }
  if (challenger.status === 'WEAK') {
    throw new Error(`🤕 Pet Anda **${challenger.pet_name}** sedang lemas kelaparan! Beri makan/minum terlebih dahulu.`);
  }
  if (partner.status === 'WEAK') {
    throw new Error(`🤕 Pet partner **${partner.pet_name}** sedang lemas kelaparan!`);
  }

  if (challenger.health < 50 || challenger.happiness < 50) {
    throw new Error(`Pet Anda **${challenger.pet_name}** terlalu lelah atau stress untuk kawin (HP/Mood harus >= 50)!`);
  }
  if (partner.health < 50 || partner.happiness < 50) {
    throw new Error(`Pet partner **${partner.pet_name}** terlalu lelah atau stress untuk kawin (HP/Mood harus >= 50)!`);
  }

  // Cek Cooldown (24 jam = 86400 detik)
  const now = Math.floor(Date.now() / 1000);
  const cooldownSecs = 24 * 3600;
  if (now - (challenger.last_breed_at || 0) < cooldownSecs) {
    const remaining = cooldownSecs - (now - (challenger.last_breed_at || 0));
    const hours = Math.ceil(remaining / 3600);
    throw new Error(`Pet Anda sedang lelah. Bisa kawin lagi dalam **${hours} jam**.`);
  }
  if (now - (partner.last_breed_at || 0) < cooldownSecs) {
    const remaining = cooldownSecs - (now - (partner.last_breed_at || 0));
    const hours = Math.ceil(remaining / 3600);
    throw new Error(`Pet partner sedang lelah. Bisa kawin lagi dalam **${hours} jam**.`);
  }

  // Cek Kandang / Slot Pet Pemohon
  const chalCountRow = db.get('SELECT COUNT(*) as count FROM user_pets WHERE user_id = ? AND guild_id = ?', [challengerId, guildId]);
  const chalCount = chalCountRow ? chalCountRow.count : 0;

  const sanitizedName = sanitizePetName(newPetName);

  // Cek Nama Duplikat
  const nameExists = db.get('SELECT 1 FROM user_pets WHERE user_id = ? AND guild_id = ? AND LOWER(pet_name) = LOWER(?)', [challengerId, guildId, sanitizedName.toLowerCase()]);
  if (nameExists) {
    throw new Error(`Anda sudah memiliki peliharaan dengan nama **"${sanitizedName}"**! Harap gunakan nama lain.`);
  }

  // Cek Saldo (Rp 800 per orang)
  const breedFee = 800;
  const chalWallet = economy.getWallet(challengerId, guildId);
  const partWallet = economy.getWallet(partnerId, guildId);

  if (chalWallet.balance < breedFee) {
    throw new Error(`Saldo Anda kurang untuk biaya perkawinan sebesar Rp ${breedFee}!`);
  }
  if (partWallet.balance < breedFee) {
    throw new Error(`Saldo partner Anda kurang untuk biaya perkawinan sebesar Rp ${breedFee}!`);
  }

  // Eksekusi Breeding
  let childType = Math.random() < 0.5 ? challenger.pet_type : partner.pet_type;
  
  // Tentukan Trait Spesial (50% peluang)
  let trait = '';
  if (Math.random() < 0.50) {
    const traits = ['MUTANT', 'GENIUS', 'STURDY', 'WARRIOR'];
    trait = traits[Math.floor(Math.random() * traits.length)];
  }

  const hatchDuration = 2 * 3600; // 2 Jam penetasan telur hybrid
  const hatchAt = now + hatchDuration;

  db.transaction(() => {
    // Potong koin
    economy.subtractBalance(challengerId, guildId, breedFee, 'PET_BREED_FEE');
    economy.subtractBalance(partnerId, guildId, breedFee, 'PET_BREED_FEE');

    // Update cooldown kedua orang tua
    db.run('UPDATE user_pets SET last_breed_at = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [now, challengerId, guildId, challenger.pet_name]);
    db.run('UPDATE user_pets SET last_breed_at = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [now, partnerId, guildId, partner.pet_name]);

    // Masukkan anak sebagai telur tidak aktif
    db.run(
      `INSERT INTO user_pets (user_id, guild_id, pet_name, pet_type, status, level, xp, health, hunger, thirst, happiness, last_interaction_at, hatch_at, created_at, is_active, trait)
       VALUES (?, ?, ?, ?, 'EGG', 1, 0, 100, 100, 100, 100, ?, ?, ?, 0, ?)`,
      [challengerId, guildId, sanitizedName, childType, now, hatchAt, now, trait]
    );
  })();

  db.logPetAction(guildId, challengerId, null, challenger.pet_name, 'BREED', `Mengawinkan dengan pet ${partner.pet_name} (milik <@${partnerId}>). Telur: ${sanitizedName} (${childType})`);
  db.logPetAction(guildId, partnerId, null, partner.pet_name, 'BREED', `Mengawinkan dengan pet ${challenger.pet_name} (milik <@${challengerId}>). Telur: ${sanitizedName} (${childType})`);

  return {
    childName: sanitizedName,
    childType,
    trait,
    hatchAt
  };
}

/**
 * Memeriksa dan menambahkan jumlah partisipasi ekspedisi harian (Maks 10)
 */
function checkExpeditionLimit(userId, guildId, dryRun = false) {
  // Pastikan wallet terdaftar
  economy.getWallet(userId, guildId);

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

  const wallet = db.get(
    'SELECT daily_expedition_count, expedition_cooldown_until, last_expedition_date FROM wallets WHERE user_id = ? AND guild_id = ?',
    [userId, guildId]
  );

  const nowUnix = Math.floor(Date.now() / 1000);
  let lastExpDate = wallet ? (wallet.last_expedition_date || '') : '';
  let cooldownUntil = wallet ? (wallet.expedition_cooldown_until || 0) : 0;
  let currentCount = wallet ? (wallet.daily_expedition_count || 0) : 0;

  // 0. Jika hari telah berganti, reset count dan cooldown ke 0
  if (lastExpDate !== todayStr) {
    currentCount = 0;
    cooldownUntil = 0;
    if (!dryRun) {
      db.run(
        'UPDATE wallets SET daily_expedition_count = 0, expedition_cooldown_until = 0, last_expedition_date = ? WHERE user_id = ? AND guild_id = ?',
        [todayStr, userId, guildId]
      );
    }
  }

  // 1. Cek jika masih dalam masa cooldown
  if (nowUnix < cooldownUntil) {
    const timeLeft = cooldownUntil - nowUnix;
    const hours = Math.floor(timeLeft / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    const seconds = timeLeft % 60;
    
    let timeStr = '';
    if (hours > 0) timeStr += `${hours} jam `;
    if (minutes > 0 || hours > 0) timeStr += `${minutes} menit `;
    timeStr += `${seconds} detik`;

    throw new Error(`Anda sedang dalam masa cooldown ekspedisi pet (30 menit) setelah bermain 6 kali! Harap tunggu **${timeStr}** lagi.`);
  }

  // 2. Jika cooldown sudah terlewati, dan count = 6, reset count ke 0
  if (currentCount >= 6) {
    currentCount = 0;
    if (!dryRun) {
      db.run(
        'UPDATE wallets SET daily_expedition_count = 0, last_expedition_date = ? WHERE user_id = ? AND guild_id = ?',
        [todayStr, userId, guildId]
      );
    }
  }

  // 3. Jika ini eksekusi nyata, tambahkan jumlah permainan
  if (!dryRun) {
    const nextCount = currentCount + 1;
    let nextCooldown = 0;

    // Jika mencapai 6 kali bermain, set cooldown 30 menit
    if (nextCount >= 6) {
      nextCooldown = nowUnix + (30 * 60); // 30 menit dari sekarang
    }

    db.run(
      `UPDATE wallets 
       SET daily_expedition_count = ?, expedition_cooldown_until = ?, last_expedition_date = ? 
       WHERE user_id = ? AND guild_id = ?`,
      [nextCount, nextCooldown, todayStr, userId, guildId]
    );
    
    return nextCount;
  }

  return currentCount;
}

/**
 * Simulasi Ekspedisi Pet Kelompok (Co-op PVE)
 */
/**
 * Menghitung peluang sukses ekspedisi dan log elemental secara dinamis
 */
function calculateSuccessRate(guildId, participantIds, mapId, pathChoice = 'SAFE') {
  const activePets = [];
  participantIds.forEach(pId => {
    const p = getPet(pId, guildId);
    if (p && p.status !== 'DEAD' && p.status !== 'EGG') {
      activePets.push({ userId: pId, pet: p });
    }
  });

  const selectedMap = EXPEDITION_MAPS.find(m => m.id === parseInt(mapId)) || EXPEDITION_MAPS[0];
  const teamPower = activePets.reduce((sum, ap) => sum + ap.pet.level, 0);

  let baseSuccessRate = selectedMap.baseSuccessRate;
  let totalModifications = 0;
  const logs = [];

  activePets.forEach(ap => {
    let elementMod = 0;
    const petType = ap.pet.pet_type;
    const petRarity = ap.pet.gacha_rarity || (GACHA_SPECIES[petType] ? GACHA_SPECIES[petType].rarity : '') || '';

    if (petRarity === 'MYTHIC') {
      elementMod = 20;
    } else if (petRarity === 'IMMORTAL') {
      elementMod = 25;
    } else {
      const petEl = ap.pet.gacha_element || (GACHA_SPECIES[petType] ? GACHA_SPECIES[petType].element : '') || '';
      if (selectedMap.id === 1) { // Hutan Pemula (EARTH)
        if (petEl === 'FIRE' || petType === 'PHOENIX' || petType === 'DRAGON') elementMod = 15;
        else if (petEl === 'WATER' || petType === 'LEVIATHAN') elementMod = -15;
      } else if (selectedMap.id === 2) { // Gua Gelap (EARTH)
        if (petEl === 'DRAGON' || petType === 'ARCHDRAGON') elementMod = 15;
        else if (petType === 'PHOENIX') elementMod = -15;
      } else if (selectedMap.id === 3) { // Lembah Api (FIRE)
        if (petEl === 'WATER' || petType === 'LEVIATHAN') elementMod = 15;
        else if (petEl === 'EARTH' || petType === 'TURTLE' || petType === 'BEHEMOTH') elementMod = -15;
      } else if (selectedMap.id === 4) { // Istana Kuno (DRAGON)
        if (petEl === 'EARTH' || petType === 'TURTLE' || petType === 'BEHEMOTH' || petEl === 'DRAGON' || petType === 'ARCHDRAGON') elementMod = 15;
        else if (petType === 'PHOENIX') elementMod = -15;
      } else if (selectedMap.id === 5) { // Tundra Beku (WATER)
        if (petEl === 'EARTH' || petType === 'TURTLE' || petType === 'BEHEMOTH') elementMod = 15;
        else if (petEl === 'FIRE' || petType === 'PHOENIX' || petType === 'DRAGON') elementMod = -15;
      } else if (selectedMap.id === 6) { // Rawa Petir (FIRE - Kilat)
        if (petEl === 'DRAGON' || petType === 'ARCHDRAGON' || petEl === 'EARTH' || petType === 'TURTLE' || petType === 'BEHEMOTH') elementMod = 15;
        else if (petEl === 'WATER' || petType === 'LEVIATHAN') elementMod = -15;
      } else if (selectedMap.id === 7) { // Kabut Kematian (DRAGON - Undead)
        if (petEl === 'FIRE' || petType === 'PHOENIX' || petType === 'DRAGON') elementMod = 15;
        else if (petEl === 'EARTH' || petType === 'TURTLE' || petType === 'BEHEMOTH') elementMod = -15;
      } else if (selectedMap.id === 8) { // Samudera Abyss (WATER)
        if (petEl === 'DRAGON' || petType === 'ARCHDRAGON') elementMod = 15;
        else if (petEl === 'FIRE' || petType === 'PHOENIX' || petType === 'DRAGON') elementMod = -15;
      } else if (selectedMap.id === 9) { // Puncak Langit (DRAGON - Holy/Sky)
        if (petEl === 'DRAGON' || petType === 'ARCHDRAGON' || petEl === 'FIRE' || petType === 'PHOENIX' || petEl === 'DRAGON') elementMod = 15;
        else if (petEl === 'EARTH' || petType === 'TURTLE' || petType === 'BEHEMOTH') elementMod = -15;
      } else if (selectedMap.id === 10) { // Dimensi Kosmik (DRAGON - Void)
        if (petRarity === 'LEGENDARY') elementMod = 15;
        else if (petRarity === 'COMMON' || !petRarity) elementMod = -15;
      }
    }

    if (elementMod !== 0) {
      totalModifications += elementMod;
      const petDisplay = GACHA_SPECIES[petType] ? GACHA_SPECIES[petType].name : petType;
      logs.push(`• **${ap.pet.pet_name}** (${petDisplay} vs Bos ${selectedMap.element}): ${elementMod > 0 ? `🟢 Keuntungan Elemen +${elementMod}%` : `🔴 Kelemahan Elemen ${elementMod}%`}`);
    }

    // Modifikasi DEX (Kelincahan: +0.1% sukses flat per DEX, max +5.0%)
    const dexBonus = Math.min(5.0, (ap.pet.stat_dex || 0) * 0.1);
    if (dexBonus > 0) {
      totalModifications += dexBonus;
      logs.push(`• **${ap.pet.pet_name}** (DEX Bonus Kelincahan): +${dexBonus.toFixed(1)}% Peluang Sukses`);
    }
  });

  // 2. Modifikasi Level Pet
  activePets.forEach(ap => {
    const levelDiff = ap.pet.level - selectedMap.recommendedLevel;
    if (levelDiff < 0) {
      totalModifications += levelDiff * 3;
      if (-levelDiff >= 10) {
        totalModifications -= 30; // Flat penalti -30% tambahan
      }
    } else {
      totalModifications += Math.min(15, levelDiff * 1);
    }
  });

  // 3. Modifikasi Jalur Perjalanan (Path Choice)
  let pathMod = 0;
  if (pathChoice === 'SHORTCUT') {
    pathMod = 15;
  } else if (pathChoice === 'SWAMP') {
    pathMod = 25;
  }

  let successRate = Math.round(baseSuccessRate + totalModifications + pathMod);
  if (successRate > 90) successRate = 90;
  if (successRate < 5) successRate = 5;

  return {
    successRate,
    teamPower,
    logs,
    activePets
  };
}

/**
 * Simulasi Ekspedisi Pet Kelompok (Co-op PVE) dengan elemen & pilihan interaktif
 */
function executeExpedition(guildId, participantIds, mapId = 1, pathChoice = 'SAFE', eventChoice = 'SAFE', eventSuccess = false, forceChestExploded = false, waterRefreshed = false, membersMap = {}) {
  const calc = calculateSuccessRate(guildId, participantIds, mapId, pathChoice);
  const activePets = calc.activePets;
  const teamPower = calc.teamPower;
  const successRate = calc.successRate;
  const logs = calc.logs;

  const teamHasImmortal = activePets.some(ap => {
    const petRarity = ap.pet.gacha_rarity || (GACHA_SPECIES[ap.pet.pet_type] ? GACHA_SPECIES[ap.pet.pet_type].rarity : '') || '';
    return petRarity === 'IMMORTAL';
  });

  if (activePets.length === 0) {
    throw new Error('Tidak ada pet aktif yang memenuhi syarat ekspedisi!');
  }

  // Pastikan HP pet mencukupi (>= 40)
  const weakPets = activePets.filter(ap => ap.pet.health < 40);
  if (weakPets.length > 0) {
    const names = weakPets.map(wp => `**${wp.pet.pet_name}** (<@${wp.userId}>)`).join(', ');
    throw new Error(`Pet berikut terlalu lelah/HP kurang dari 40: ${names}.`);
  }

  // Pilih Peta Ekspedisi Pilihan (Map selection)
  const selectedMap = EXPEDITION_MAPS.find(m => m.id === parseInt(mapId)) || EXPEDITION_MAPS[0];
  const kruCount = activePets.length;
  
  const zoneName = selectedMap.name;
  const recommendedLevel = selectedMap.recommendedLevel;
  const minReward = selectedMap.minPrize;
  const maxReward = selectedMap.maxPrize;

  // Cari pet paling jago dan paling cupu
  let bestPet = null;
  let worstPet = null;

  if (activePets.length > 1) {
    const getCP = (p) => {
      let traitBonus = 0;
      if (['GENIUS', 'WARRIOR', 'MUTANT'].includes(p.trait)) {
        traitBonus = 250;
      } else if (p.trait === 'STURDY') {
        traitBonus = 150;
      }
      return (p.level * 120) + p.health + (p.happiness * 1.5) + traitBonus;
    };

    const sorted = [...activePets].sort((a, b) => {
      if (b.pet.level !== a.pet.level) {
        return b.pet.level - a.pet.level;
      }
      return getCP(b.pet) - getCP(a.pet);
    });

    bestPet = {
      userId: sorted[0].userId,
      petName: sorted[0].pet.pet_name,
      level: sorted[0].pet.level
    };
    worstPet = {
      userId: sorted[sorted.length - 1].userId,
      petName: sorted[sorted.length - 1].pet.pet_name,
      level: sorted[sorted.length - 1].pet.level
    };
  }

  const lowLevelCulprits = [];
  activePets.forEach(ap => {
    const levelDiff = ap.pet.level - recommendedLevel;
    if (levelDiff < 0 && -levelDiff >= 10) {
      lowLevelCulprits.push(ap);
    }
  });

  // 3. Modifikasi Jalur Perjalanan (Path Choice) - Menambahkan logs
  if (pathChoice === 'SHORTCUT') {
    logs.push("🧗 **Jalur:** Tim mengambil jalan pintas terjal! (+15% Peluang Sukses, seluruh pet kelelahan -15 HP)");
  } else if (pathChoice === 'SWAMP') {
    logs.push("🌲 **Jalur:** Tim menyusup melewati Rawa Beracun! (+25% Peluang Sukses, pet berisiko terkena bau busuk/luka)");
  } else {
    logs.push("🛣️ **Jalur:** Tim memilih menyusuri jalan raya utama yang aman.");
  }

  // 4. Kejadian di Perjalanan (Event Choice) - Menambahkan logs
  if (eventChoice === 'LOCKPICK') {
    if (eventSuccess) {
      logs.push("🗝️ **Kejadian:** Tim membuka Peti Kuno menggunakan **Lockpick** pembuat lobi! Satu kawan beruntung mendapat drop item langka.");
    } else {
      logs.push("🏃 **Kejadian:** Tim mengabaikan Peti Kuno karena Lockpick tidak tersedia.");
    }
  } else if (eventChoice === 'FORCE') {
    if (eventSuccess) {
      logs.push("💥 **Kejadian:** Tim mendobrak paksa Peti Kuno secara manual dan berhasil! Menemukan barang rampasan tambahan.");
    } else {
      logs.push("💥 **Kejadian:** Tim mencoba mendobrak paksa Peti Kuno secara manual tetapi memicu ledakan jebakan! Semua pet terkena guncangan (-15 HP).");
    }
  } else if (eventChoice === 'DRINK') {
    logs.push("💧 **Kejadian:** Seluruh tim meminum air dari Air Terjun Suci yang menyegarkan! (+20 HP & +20 Hidrasi)");
  } else {
    logs.push("🏃 **Kejadian:** Tim memilih mengabaikan kejadian di jalan dan terus fokus melangkah.");
  }

  const roll = Math.random() * 100;
  // Cek God Mode Owner: jika Owner ikut ekspedisi dan God Mode ON, selalu sukses
  let ownerExpGodMode = false;
  if (participantIds.includes(config.OWNER_ID)) {
    try {
      const { isOwnerGodModeActive } = require('./adminPanel');
      ownerExpGodMode = isOwnerGodModeActive(guildId);
    } catch (e) {}
  }
  const isSuccess = ownerExpGodMode ? true : (roll < successRate);

  const rewards = [];
  const now = Math.floor(Date.now() / 1000);

  // Pemrosesan drop peti tambahan
  let chestAwardedUser = null;
  let chestDropItem = null;
  if (eventSuccess && activePets.length > 0) {
    const luckyWinnerObj = activePets[Math.floor(Math.random() * activePets.length)];
    chestAwardedUser = luckyWinnerObj.userId;
    const randomDrop = EXPEDITION_DROPS[Math.floor(Math.random() * EXPEDITION_DROPS.length)];
    chestDropItem = randomDrop.name;
    if (randomDrop.table === 'pet_inventory') {
      db.run("INSERT INTO pet_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, ?, 1) ON CONFLICT(user_id, guild_id, item_id) DO UPDATE SET quantity = quantity + 1", [chestAwardedUser, guildId, randomDrop.id]);
    } else {
      db.run("INSERT INTO user_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, ?, 1) ON CONFLICT(user_id, guild_id, item_id) DO UPDATE SET quantity = quantity + 1", [chestAwardedUser, guildId, randomDrop.id]);
    }
  }

  if (isSuccess) {
    // Sukses: Koin acak dibagi merata
    const totalPrize = minReward + Math.floor(Math.random() * (maxReward - minReward + 1));
    let prizePerPerson = Math.floor(totalPrize / kruCount);

    // Terapkan pengali Solo vs Co-op
    if (kruCount === 1) {
      prizePerPerson = Math.floor(prizePerPerson * 0.3); // Solo: 30% koin
    } else {
      prizePerPerson = Math.floor(prizePerPerson * 1.5); // Co-op: 150% koin
    }

    db.transaction(() => {
      activePets.forEach(ap => {
        // Increment daily expedition count
        checkExpeditionLimit(ap.userId, guildId, false);

        // Berikan Koin
        economy.addBalance(ap.userId, guildId, prizePerPerson, 'PET_EXPEDITION_REWARD');

        // Berikan XP (+200 XP dasar) dikali xp_multiplier
        let xpGained = Math.round(200 * (ap.pet.xp_multiplier || 1.0));
        if (kruCount === 1) {
          xpGained = Math.round(xpGained * 0.3); // Solo: 30% XP
        } else {
          xpGained = Math.round(xpGained * 1.5); // Co-op: 150% XP
        }
        const maxHP = getMaxHP(ap.pet);
        let { newXp, newLevel, levelUp } = addXp(ap.pet, xpGained, maxHP);

        // Dampak petualangan sukses: lapar -10, haus -10, kebahagiaan +10
        const isGod = isGodPet(ap.pet) || (ap.userId === config.OWNER_ID && ownerExpGodMode);
        const newHunger = isGod ? 100 : Math.max(0, ap.pet.hunger - 10);
        const newThirst = isGod ? 100 : Math.max(0, ap.pet.thirst - 10);
        const newHappiness = isGod ? 100 : Math.min(100, ap.pet.happiness + 10);

        // finalHealth is equal to current health (since updates are applied in stages)
        let finalHealth = isGod ? maxHP : ap.pet.health;
        if (levelUp) {
          finalHealth = maxHP; // Full HP saat naik level
        }

        let finalStatus = ap.pet.status;
        let finalAccessory = ap.pet.accessory;
        let deathTriggered = false;
        let isSavedByAmulet = false;
        let isSavedBySurvivor = false;

        const mId = parseInt(mapId) || 1;
        let deathProb = 0.03;
        if (mId <= 3) deathProb = 0.04;
        else if (mId <= 6) deathProb = 0.08;
        else if (mId <= 9) deathProb = 0.12;
        else deathProb = 0.16;

        const petRarity = ap.pet.gacha_rarity || (GACHA_SPECIES[ap.pet.pet_type] ? GACHA_SPECIES[ap.pet.pet_type].rarity : '') || '';
        
        if (teamHasImmortal || petRarity === 'IMMORTAL' || petRarity === 'MYTHIC') {
          deathProb = 0.0;
        } else if (membersMap && membersMap[ap.userId]) {
          const gachaTier = economy.getMemberGachaTier(membersMap[ap.userId], guildId);
          if (gachaTier === 'LEGENDARY') deathProb = Math.max(0.01, Math.round(deathProb * 0.3 * 100) / 100);
          else if (gachaTier === 'MYTHIC') deathProb = 0.0;
        }

        if (!isGod && Math.random() < deathProb) {
          deathTriggered = true;
          if (ap.pet.accessory === 'LUCKY_AMULET') {
            isSavedByAmulet = true;
            finalHealth = 20;
            finalAccessory = '';
            if (finalStatus === 'WEAK') {
              finalStatus = ap.pet.level >= 10 ? 'ADULT' : 'BABY';
            }
          } else if (petHasTrait(ap.pet, 'SURVIVOR')) {
            isSavedBySurvivor = true;
            finalHealth = 1;
            finalStatus = 'WEAK';
          } else {
            finalHealth = 0;
            finalStatus = 'DEAD';
          }
        }

        db.run(
          `UPDATE user_pets 
           SET xp = ?, level = ?, hunger = ?, thirst = ?, happiness = ?, health = ?, status = ?, accessory = ?, last_interaction_at = ?
           WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
          [newXp, newLevel, newHunger, newThirst, newHappiness, finalHealth, finalStatus, finalAccessory, now, ap.userId, guildId, ap.pet.pet_name]
        );

        let statusText = '';
        if (deathTriggered) {
          if (isSavedByAmulet) {
            statusText = 'Jimat Keberuntungan Hancur! (Selamat) 🛡️';
            logs.push(`🛡️ **${ap.pet.pet_name}** (<@${ap.userId}>) hampir tewas karena jebakan mematikan, tetapi diselamatkan oleh **Jimat Keberuntungan** yang hancur berkeping-keping!`);
          } else if (isSavedBySurvivor) {
            statusText = 'Lemas & Terluka (Bertahan 1 HP) 🩹';
            logs.push(`❤️ **${ap.pet.pet_name}** (<@${ap.userId}>) menderita luka fatal, tetapi berkat trait **Survivor**, ia bertahan hidup dengan sisa 1 HP!`);
          } else {
            statusText = 'MENINGGAL DUNIA (Butuh Dokter) 🪦';
            logs.push(`💀 **${ap.pet.pet_name}** (<@${ap.userId}>) mengalami kecelakaan fatal di dalam ekspedisi dan **MENINGGAL DUNIA**! Bawa dia ke Dokter Pet (\`.pet dokter\`) untuk menghidupkannya kembali.`);
          }
        } else if (ap.pet.curse_type === 'smelly') {
          statusText = 'Bau Busuk (Lumpur Rawa) 🤢';
        } else if (ap.pet.curse_type === 'injured') {
          statusText = 'Terluka Parah 🩹';
        }

        // Peluang 20% mendapat drop item biasa
        let dropText = '';
        if (Math.random() < 0.20) {
          const randomDrop = EXPEDITION_DROPS[Math.floor(Math.random() * EXPEDITION_DROPS.length)];
          dropText = randomDrop.name;
          if (randomDrop.table === 'pet_inventory') {
            db.run("INSERT INTO pet_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, ?, 1) ON CONFLICT(user_id, guild_id, item_id) DO UPDATE SET quantity = quantity + 1", [ap.userId, guildId, randomDrop.id]);
          } else {
            db.run("INSERT INTO user_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, ?, 1) ON CONFLICT(user_id, guild_id, item_id) DO UPDATE SET quantity = quantity + 1", [ap.userId, guildId, randomDrop.id]);
          }
        }

        rewards.push({
          userId: ap.userId,
          petName: ap.pet.pet_name,
          koin: prizePerPerson,
          xpGained: xpGained,
          levelUp,
          newLevel,
          dropItem: dropText,
          statusText
        });
      });
    })();

    logs.push(
      `⚔️ Tim pet berhasil menerobos pertahanan bos di **${zoneName}**!`,
      `💥 Dengan koordinasi yang apik, bos zona berhasil ditaklukan dan tumpukan koin jarahan disita!`
    );

    rewards.forEach(r => {
      const details = `Ekspedisi sukses ke ${zoneName}. Koin: Rp ${r.koin.toLocaleString('id-ID')}, XP: +${r.xpGained}${r.levelUp ? ` (Naik ke Level ${r.newLevel}!)` : ''}${r.dropItem ? `, Drop: ${r.dropItem}` : ''}${r.statusText ? `, Status: ${r.statusText}` : ''}`;
      db.logPetAction(guildId, r.userId, null, r.petName, 'EXPEDITION', details);
    });

    return {
      success: true,
      zoneName,
      teamPower,
      successRate,
      rewards,
      logs,
      bestPet,
      worstPet,
      pathChoice,
      eventChoice,
      eventSuccess,
      forceChestExploded,
      waterRefreshed,
      chestAwardedUser,
      chestDropItem
    };
  } else {
    // Tentukan penyebab kegagalan dan kambing hitam
    const failScenarios = [];

    if (lowLevelCulprits.length > 0) {
      const culpritLow = lowLevelCulprits[Math.floor(Math.random() * lowLevelCulprits.length)];
      failScenarios.push({
        culprit: culpritLow,
        reason: `Pet **${culpritLow.pet.pet_name}** milik <@${culpritLow.userId}> masih sangat pemula (Lv. ${culpritLow.pet.level} vs Rekomendasi Lv. ${recommendedLevel}) dan langsung pingsan ketakutan melihat Bos ${zoneName}, menyabotase formasi bertarung tim!`
      });
    }

    const minLevel = Math.min(...activePets.map(ap => ap.pet.level));
    const lowestLevelPets = activePets.filter(ap => ap.pet.level === minLevel);
    const culpritLevel = lowestLevelPets[Math.floor(Math.random() * lowestLevelPets.length)];
    failScenarios.push({
      culprit: culpritLevel,
      reason: `Pet **${culpritLevel.pet.pet_name}** milik <@${culpritLevel.userId}> yang berlevel paling rendah (Lv. ${culpritLevel.pet.level}) gemetar ketakutan melihat Bos Zona dan bersembunyi di balik semak-semak, membuat barisan tempur hancur!`
    });

    const lowHpPets = activePets.filter(ap => ap.pet.health < 60);
    if (lowHpPets.length > 0) {
      const culpritHp = lowHpPets[Math.floor(Math.random() * lowHpPets.length)];
      failScenarios.push({
        culprit: culpritHp,
        reason: `Pet **${culpritHp.pet.pet_name}** milik <@${culpritHp.userId}> kehabisan nafas dan kelelahan di tengah jalan (HP hanya ${culpritHp.pet.health}%), memperlambat pergerakan seluruh tim!`
      });
    }

    const lowHappyPets = activePets.filter(ap => ap.pet.happiness < 60);
    if (lowHappyPets.length > 0) {
      const culpritHappy = lowHappyPets[Math.floor(Math.random() * lowHappyPets.length)];
      failScenarios.push({
        culprit: culpritHappy,
        reason: `Pet **${culpritHappy.pet.pet_name}** milik <@${culpritHappy.userId}> sedang bad mood / malas-malasan (Kebahagiaan ${culpritHappy.pet.happiness}%) sehingga tidak fokus menyerang bos!`
      });
    }

    const randomCulprit = activePets[Math.floor(Math.random() * activePets.length)];
    const funnyAccidents = [
      `Pet **${randomCulprit.pet.pet_name}** milik <@${randomCulprit.userId}> tidak sengaja terpeleset kulit pisang saat ingin menerjang bos, membuat formasi tim kacau balau!`,
      `Pet **${randomCulprit.pet.pet_name}** milik <@${randomCulprit.userId}> mendadak kebelet pipis di tengah pertarungan sengit, memaksa seluruh tim mundur untuk mencari toilet!`,
      `Pet **${randomCulprit.pet.pet_name}** milik <@${randomCulprit.userId}> terdistraksi oleh kupu-kupu warna-warni yang terbang lewat dan malah mengejarnya sambil mengabaikan bos!`,
      `Pet **${randomCulprit.pet.pet_name}** milik <@${randomCulprit.userId}> malah asyik memakan ransum perbekalan tim sendirian di belakang hingga kekenyangan dan tertidur pulas!`,
      `Pet **${randomCulprit.pet.pet_name}** milik <@${randomCulprit.userId}> salah membaca peta jalan sehingga menuntun tim masuk ke dalam jebakan rawa berlumpur!`
    ];
    funnyAccidents.forEach(accident => {
      failScenarios.push({
        culprit: randomCulprit,
        reason: accident
      });
    });

    const selectedScenario = failScenarios[Math.floor(Math.random() * failScenarios.length)];

    // Gagal: Pet terluka (-30 HP, -25 Happiness), tapi mendapat +60 XP dasar dikali xp_multiplier
    db.transaction(() => {
      activePets.forEach(ap => {
        // Increment daily expedition count
        checkExpeditionLimit(ap.userId, guildId, false);

        let xpGained = Math.round(60 * (ap.pet.xp_multiplier || 1.0));
        if (kruCount === 1) {
          xpGained = Math.round(xpGained * 0.3); // Solo: 30% XP
        } else {
          xpGained = Math.round(xpGained * 1.5); // Co-op: 150% XP
        }
        const maxHP = getMaxHP(ap.pet);
        let { newXp, newLevel, levelUp } = addXp(ap.pet, xpGained, maxHP);

        const isGod = isGodPet(ap.pet) || (ap.userId === config.OWNER_ID && ownerExpGodMode);
        const newHappiness = isGod ? 100 : Math.max(10, ap.pet.happiness - 25);
        const newHunger = isGod ? 100 : Math.max(0, ap.pet.hunger - 15);
        const newThirst = isGod ? 100 : Math.max(0, ap.pet.thirst - 15);

        // Gagal mengurangi HP pet sebesar 30 HP
        let finalHealth = isGod ? maxHP : Math.max(5, ap.pet.health - 30);
        if (levelUp) {
          finalHealth = maxHP;
        }

        let finalStatus = ap.pet.status;
        let finalAccessory = ap.pet.accessory;
        let deathTriggered = false;
        let isSavedByAmulet = false;
        let isSavedBySurvivor = false;

        const mId = parseInt(mapId) || 1;
        let deathProb = 0.03;
        if (mId <= 3) deathProb = 0.04;
        else if (mId <= 6) deathProb = 0.08;
        else if (mId <= 9) deathProb = 0.12;
        else deathProb = 0.16;

        const petRarity = ap.pet.gacha_rarity || (GACHA_SPECIES[ap.pet.pet_type] ? GACHA_SPECIES[ap.pet.pet_type].rarity : '') || '';
        
        if (teamHasImmortal || petRarity === 'IMMORTAL' || petRarity === 'MYTHIC') {
          deathProb = 0.0;
        } else if (membersMap && membersMap[ap.userId]) {
          const gachaTier = economy.getMemberGachaTier(membersMap[ap.userId], guildId);
          if (gachaTier === 'LEGENDARY') deathProb = Math.max(0.01, Math.round(deathProb * 0.3 * 100) / 100);
          else if (gachaTier === 'MYTHIC') deathProb = 0.0;
        }

        if (!isGod && Math.random() < deathProb) {
          deathTriggered = true;
          if (ap.pet.accessory === 'LUCKY_AMULET') {
            isSavedByAmulet = true;
            finalHealth = 20;
            finalAccessory = '';
            if (finalStatus === 'WEAK') {
              finalStatus = ap.pet.level >= 10 ? 'ADULT' : 'BABY';
            }
          } else if (petHasTrait(ap.pet, 'SURVIVOR')) {
            isSavedBySurvivor = true;
            finalHealth = 1;
            finalStatus = 'WEAK';
          } else {
            finalHealth = 0;
            finalStatus = 'DEAD';
          }
        }

        db.run(
          `UPDATE user_pets 
           SET xp = ?, level = ?, health = ?, status = ?, happiness = ?, hunger = ?, thirst = ?, last_interaction_at = ?, accessory = ?
           WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
          [newXp, newLevel, finalHealth, finalStatus, newHappiness, newHunger, newThirst, now, finalAccessory, ap.userId, guildId, ap.pet.pet_name]
        );

        let statusText = '';
        if (deathTriggered) {
          if (isSavedByAmulet) {
            statusText = 'Jimat Keberuntungan Hancur! (Selamat) 🛡️';
            logs.push(`🛡️ **${ap.pet.pet_name}** (<@${ap.userId}>) hampir tewas, tetapi diselamatkan oleh **Jimat Keberuntungan** yang hancur berkeping-keping!`);
          } else if (isSavedBySurvivor) {
            statusText = 'Lemas & Terluka (Bertahan 1 HP) 🩹';
            logs.push(`❤️ **${ap.pet.pet_name}** (<@${ap.userId}>) mengalami luka mematikan, tetapi berkat trait **Survivor**, ia bertahan hidup dengan sisa 1 HP!`);
          } else {
            statusText = 'MENINGGAL DUNIA (Butuh Dokter) 🪦';
            logs.push(`💀 **${ap.pet.pet_name}** (<@${ap.userId}>) mengalami kecelakaan fatal di dalam ekspedisi dan **MENINGGAL DUNIA**! Bawa dia ke Dokter Pet (\`.pet dokter\`) untuk menghidupkannya kembali.`);
          }
        } else if (ap.pet.curse_type === 'smelly') {
          statusText = 'Bau Busuk (Lumpur Rawa) 🤢';
        } else if (ap.pet.curse_type === 'injured') {
          statusText = 'Terluka Parah 🩹';
        }

        rewards.push({
          userId: ap.userId,
          petName: ap.pet.pet_name,
          koin: 0,
          xpGained: xpGained,
          levelUp,
          newLevel,
          statusText
        });
      });
    })();

    logs.push(
      `😢 Tim pet dipaksa mundur dari **${zoneName}** oleh bos penjaga yang terlampau kuat!`,
      `💥 **Penyebab Kegagalan:**\n${selectedScenario.reason}`,
      `🩸 Seluruh pet menderita luka-luka ringan dan stress, tapi membawa pulang sedikit pengalaman tempur.`
    );

    rewards.forEach(r => {
      const details = `Ekspedisi gagal ke ${zoneName}. XP: +${r.xpGained}${r.levelUp ? ` (Naik ke Level ${r.newLevel}!)` : ''}${r.statusText ? `, Status: ${r.statusText}` : ''}`;
      db.logPetAction(guildId, r.userId, null, r.petName, 'EXPEDITION', details);
    });

    return {
      success: false,
      zoneName,
      teamPower,
      successRate,
      rewards,
      logs,
      bestPet,
      worstPet,
      pathChoice,
      eventChoice,
      eventSuccess,
      forceChestExploded,
      waterRefreshed,
      chestAwardedUser,
      chestDropItem
    };
  }
}

/**
 * Mendapatkan daftar pet teratas di guild untuk leaderboard.
 */
function getPetLeaderboard(guildId, category = 'level', limit = 10) {
  let orderByClause = '';
  if (category === 'pvp') {
    orderByClause = 'ORDER BY pvp_wins DESC, (pvp_wins * 1.0 / (pvp_wins + pvp_losses)) DESC, level DESC';
  } else if (category === 'cp') {
    orderByClause = `ORDER BY (
      (level * 120) + health + (happiness * 1.5) + 
      (CASE 
        WHEN trait IN ('GENIUS', 'WARRIOR', 'MUTANT') THEN 250 
        WHEN trait = 'STURDY' THEN 150 
        ELSE 0 
      END)
    ) DESC`;
  } else {
    // Default: level
    orderByClause = 'ORDER BY level DESC, xp DESC, created_at ASC';
  }

  const pets = db.all(
    `SELECT *,
            ((level * 120) + health + (happiness * 1.5) + 
             (CASE 
               WHEN trait IN ('GENIUS', 'WARRIOR', 'MUTANT') THEN 250 
               WHEN trait = 'STURDY' THEN 150 
               ELSE 0 
             END)
            ) as cp
     FROM user_pets
     WHERE guild_id = ? AND status != 'DEAD'
     ${orderByClause}
     LIMIT ?`,
    [guildId, limit]
  );

  return pets.map(p => applyDecay(p));
}

/**
 * Mengatur URL gambar custom untuk pet aktif.
 */
function setCustomImage(userId, guildId, imageUrl) {
  const pet = getPet(userId, guildId);
  if (!pet) {
    throw new Error("Anda belum memiliki pet aktif!");
  }
  
  let validUrl = null;
  if (imageUrl && typeof imageUrl === 'string') {
    const trimmed = imageUrl.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      validUrl = trimmed;
    } else if (trimmed.toLowerCase() === 'reset' || trimmed.toLowerCase() === 'none' || trimmed.toLowerCase() === 'default') {
      validUrl = null;
    } else {
      throw new Error("Link gambar tidak valid! Harus berawalan `http://` atau `https://`, atau ketik `reset` untuk menghapus gambar custom.");
    }
  }

  db.run(
    'UPDATE user_pets SET custom_image = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?',
    [validUrl, userId, guildId, pet.pet_name]
  );

  return validUrl;
}

/**
 * Memandikan pet untuk membersihkan kutukan bau busuk
 */
function washPet(userId, guildId) {
  const pet = getPet(userId, guildId);
  if (!pet) throw new Error('Anda tidak memiliki peliharaan!');
  if (pet.status === 'EGG') throw new Error('Pet Anda masih berupa telur!');
  if (pet.status === 'DEAD') throw new Error('Pet Anda sudah meninggal 🪦.');

  const now = Math.floor(Date.now() / 1000);
  if (pet.curse_type !== 'smelly' || pet.curse_until <= now) {
    throw new Error(`Pet Anda (**${pet.pet_name}**) sudah wangi dan bersih kok! Tidak perlu dimandikan.`);
  }

  // Cek kepemilikan sabun
  const soapPetQty = getItemQuantity(userId, guildId, 'SOAP_PET');
  const bmSoapRow = db.get('SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?', [userId, guildId, 'SOAP']);
  const bmSoapQty = bmSoapRow ? bmSoapRow.quantity : 0;

  if (soapPetQty <= 0 && bmSoapQty <= 0) {
    throw new Error('Anda tidak memiliki sabun mandi! Beli Sabun Mandi Pet di toko (.pet buy-item soap_pet) seharga Rp 100.');
  }

  const usedSoapPet = soapPetQty > 0;

  if (usedSoapPet) {
    const remainingCooldown = getItemCooldown(userId, guildId, 'SOAP_PET');
    if (remainingCooldown > 0) {
      const mins = Math.floor(remainingCooldown / 60);
      const secs = remainingCooldown % 60;
      throw new Error(`Item **Sabun Mandi Pet** sedang cooldown! Silakan tunggu **${mins} menit ${secs} detik** lagi.`);
    }
  }

  db.transaction(() => {
    if (usedSoapPet) {
      db.run('UPDATE pet_inventory SET quantity = quantity - 1 WHERE user_id = ? AND guild_id = ? AND item_id = ?', [userId, guildId, 'SOAP_PET']);
      setItemCooldown(userId, guildId, 'SOAP_PET', PET_ITEMS.SOAP_PET.cooldown);
    } else {
      db.run('UPDATE user_inventory SET quantity = quantity - 1 WHERE user_id = ? AND guild_id = ? AND item_id = ?', [userId, guildId, 'SOAP']);
    }

    db.run(
      "UPDATE user_pets SET curse_type = '', curse_until = 0 WHERE user_id = ? AND guild_id = ? AND is_active = 1",
      [userId, guildId]
    );
  })();

  return {
    pet: getPet(userId, guildId)
  };
}

/**
 * Mendapatkan atau membuat misi harian Kosan 1A untuk hari ini.
 */
function getOrCreateDailyQuests(userId, guildId) {
  // Pastikan user memiliki pet aktif
  const petObj = getPet(userId, guildId);
  if (!petObj) {
    throw new Error('Anda tidak memiliki hewan peliharaan! Adopsi telur pet terlebih dahulu.');
  }

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

  let row = db.get(
    'SELECT * FROM user_daily_quests WHERE user_id = ? AND guild_id = ? AND quest_date = ?',
    [userId, guildId, todayStr]
  );

  if (row) {
    return row;
  }

  // Pilih 3 misi harian acak dari 6 jenis misi
  const QUEST_POOL = [
    { type: 'WORK', target: 3 },
    { type: 'HUNT', target: 2 },
    { type: 'FEED', target: 2 },
    { type: 'PLAY', target: 2 },
    { type: 'WATER', target: 2 },
    { type: 'EXPEDITION', target: 1 },
    { type: 'SELL_FLOWER', target: 2 },
    { type: 'GIFT_BOUQUET', target: 1 },
    { type: 'ROB', target: 1 },
    { type: 'HEIST', target: 1 },
    { type: 'CASINO', target: 2 },
    { type: 'STOCK_BUY', target: 2 },
    { type: 'BANK_DEPOSIT', target: 1 },
    { type: 'GARDEN_PLANT', target: 2 },
    { type: 'GARDEN_HARVEST', target: 2 },
    { type: 'PVP_BOT', target: 2 }
  ];

  // Shuffle pool dan ambil 3 item teratas
  const shuffled = [...QUEST_POOL].sort(() => 0.5 - Math.random());
  const q1 = shuffled[0];
  const q2 = shuffled[1];
  const q3 = shuffled[2];

  db.run(
    `INSERT INTO user_daily_quests (
      user_id, guild_id, quest_date,
      quest_1_type, quest_1_progress, quest_1_target,
      quest_2_type, quest_2_progress, quest_2_target,
      quest_3_type, quest_3_progress, quest_3_target,
      reward_claimed
    ) VALUES (?, ?, ?, ?, 0, ?, ?, 0, ?, ?, 0, ?, 0)`,
    [userId, guildId, todayStr, q1.type, q1.target, q2.type, q2.target, q3.type, q3.target]
  );

  return db.get(
    'SELECT * FROM user_daily_quests WHERE user_id = ? AND guild_id = ? AND quest_date = ?',
    [userId, guildId, todayStr]
  );
}

/**
 * Menambah progres misi harian untuk quest_type tertentu.
 */
function incrementQuestProgress(userId, guildId, questType, amount = 1) {
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

  const row = db.get(
    'SELECT * FROM user_daily_quests WHERE user_id = ? AND guild_id = ? AND quest_date = ?',
    [userId, guildId, todayStr]
  );

  if (!row || row.reward_claimed === 1) {
    return; // Misi belum dibuat untuk hari ini, atau hadiah sudah diklaim
  }

  db.transaction(() => {
    if (row.quest_1_type === questType && row.quest_1_progress < row.quest_1_target) {
      const newProgress = Math.min(row.quest_1_target, row.quest_1_progress + amount);
      db.run(
        'UPDATE user_daily_quests SET quest_1_progress = ? WHERE user_id = ? AND guild_id = ? AND quest_date = ?',
        [newProgress, userId, guildId, todayStr]
      );
    }
    if (row.quest_2_type === questType && row.quest_2_progress < row.quest_2_target) {
      const newProgress = Math.min(row.quest_2_target, row.quest_2_progress + amount);
      db.run(
        'UPDATE user_daily_quests SET quest_2_progress = ? WHERE user_id = ? AND guild_id = ? AND quest_date = ?',
        [newProgress, userId, guildId, todayStr]
      );
    }
    if (row.quest_3_type === questType && row.quest_3_progress < row.quest_3_target) {
      const newProgress = Math.min(row.quest_3_target, row.quest_3_progress + amount);
      db.run(
        'UPDATE user_daily_quests SET quest_3_progress = ? WHERE user_id = ? AND guild_id = ? AND quest_date = ?',
        [newProgress, userId, guildId, todayStr]
      );
    }
  })();
}

/**
 * Mengklaim hadiah misi harian Kosan 1A jika semua misi hari ini selesai.
 */
function claimDailyQuestReward(userId, guildId) {
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

  const row = db.get(
    'SELECT * FROM user_daily_quests WHERE user_id = ? AND guild_id = ? AND quest_date = ?',
    [userId, guildId, todayStr]
  );

  if (!row) {
    throw new Error('Anda belum memulai misi harian untuk hari ini! Jalankan perintah \\`.pet misi\\` terlebih dahulu.');
  }

  if (row.reward_claimed === 1) {
    throw new Error('Anda sudah mengklaim hadiah misi harian hari ini! Silakan kembali lagi besok.');
  }

  const allCompleted =
    row.quest_1_progress >= row.quest_1_target &&
    row.quest_2_progress >= row.quest_2_target &&
    row.quest_3_progress >= row.quest_3_target;

  if (!allCompleted) {
    throw new Error('Anda belum menyelesaikan seluruh misi harian Kosan 1A hari ini! Periksa status dengan \\`.pet misi\\`.');
  }

  // Cari item drop secara acak
  const roll = Math.random();
  let itemId = '';
  let itemName = '';
  let isPetItem = true;

  if (roll < 0.25) {
    itemId = 'FOOD_PREMIUM';
    itemName = '🥩 Daging Premium';
    isPetItem = true;
  } else if (roll < 0.50) {
    itemId = 'TOY';
    itemName = '⚽ Bola Karet';
    isPetItem = true;
  } else if (roll < 0.75) {
    itemId = 'MEDICINE';
    itemName = '💊 Ramuan Kesehatan';
    isPetItem = true;
  } else if (roll < 0.90) {
    itemId = 'LOCKPICK';
    itemName = '🗝️ Linggis / Lockpick';
    isPetItem = false;
  } else {
    itemId = 'SOAP';
    itemName = '🧼 Sabun Licin';
    isPetItem = false;
  }

  db.transaction(() => {
    // 1. Berikan koin bonus Rp 300
    economy.addBalance(userId, guildId, 300, 'DAILY_QUEST');

    // 2. Set status claimed
    db.run(
      'UPDATE user_daily_quests SET reward_claimed = 1 WHERE user_id = ? AND guild_id = ? AND quest_date = ?',
      [userId, guildId, todayStr]
    );

    // 3. Berikan Tiket Gacha Pet Gratis
    addGachaTickets(userId, guildId, 1);

    // 4. Tambahkan item drop ke inventory
    if (isPetItem) {
      const exist = db.get(
        'SELECT quantity FROM pet_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?',
        [userId, guildId, itemId]
      );
      if (exist) {
        db.run(
          'UPDATE pet_inventory SET quantity = quantity + 1 WHERE user_id = ? AND guild_id = ? AND item_id = ?',
          [userId, guildId, itemId]
        );
      } else {
        db.run(
          'INSERT INTO pet_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, ?, 1)',
          [userId, guildId, itemId]
        );
      }
    } else {
      const exist = db.get(
        'SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?',
        [userId, guildId, itemId]
      );
      if (exist) {
        db.run(
          'UPDATE user_inventory SET quantity = quantity + 1 WHERE user_id = ? AND guild_id = ? AND item_id = ?',
          [userId, guildId, itemId]
        );
      } else {
        db.run(
          'INSERT INTO user_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, ?, 1)',
          [userId, guildId, itemId]
        );
      }
    }
  })();

  return {
    rewardAmount: 300,
    dropItemName: itemName,
    gachaTicketBonus: 1
  };
}

function checkAndResetSodaLimit(pet) {
  const now = Math.floor(Date.now() / 1000);
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const lastResetStr = pet.last_soda_reset_at ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(pet.last_soda_reset_at * 1000)) : '';

  if (todayStr !== lastResetStr) {
    db.run(
      'UPDATE user_pets SET soda_today = 0, last_soda_reset_at = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?',
      [now, pet.user_id, pet.guild_id, pet.pet_name]
    );
    pet.soda_today = 0;
    pet.last_soda_reset_at = now;
  }
}

function useSodaEnergy(userId, guildId, autoBuy = true, member = null) {
  let petObj = getPet(userId, guildId);
  if (!petObj) throw new Error('Anda tidak memiliki hewan peliharaan!');
  if (petObj.status === 'EGG') throw new Error('Pet Anda masih berupa telur!');
  if (petObj.status === 'DEAD') throw new Error('Pet Anda sudah meninggal 🪦.');
  if (petObj.status === 'SICK') throw new Error('Pet Anda sedang sakit 🤢! Sembuhkan terlebih dahulu.');

  const item = PET_ITEMS.SODA_ENERGY;

  // Cek cooldown item
  const remainingCooldown = getItemCooldown(userId, guildId, item.id);
  if (remainingCooldown > 0) {
    const mins = Math.floor(remainingCooldown / 60);
    const secs = remainingCooldown % 60;
    throw new Error(`Item **${item.name}** sedang cooldown! Silakan tunggu **${mins} menit ${secs} detik** lagi.`);
  }

  let qty = getItemQuantity(userId, guildId, item.id);
  let didAutoBuy = false;

  if (qty <= 0) {
    if (autoBuy) {
      buyItem(userId, guildId, item.id, 1);
      didAutoBuy = true;
    } else {
      throw new Error(`Anda tidak memiliki **${item.name}**! Beli dulu di toko pet.`);
    }
  }

  // Cek reset limit
  checkAndResetSodaLimit(petObj);

  let gotSick = false;
  const now = Math.floor(Date.now() / 1000);

  db.transaction(() => {
    // Potong kuantitas
    db.run(
      'UPDATE pet_inventory SET quantity = quantity - 1 WHERE user_id = ? AND guild_id = ? AND item_id = ?',
      [userId, guildId, item.id]
    );

    // Set cooldown
    setItemCooldown(userId, guildId, item.id, item.cooldown);

    const newSodaToday = petObj.soda_today + 1;
    let newStatus = petObj.status;
    let newHealth = petObj.health;

    // Jika minum > 2 kali (berarti botol ke-3 dst), ada 35% peluang sakit
    let sicknessRate = 0.35;
    const petRarity = petObj.gacha_rarity || (GACHA_SPECIES[petObj.pet_type] ? GACHA_SPECIES[petObj.pet_type].rarity : '') || '';
    if (petRarity === 'MYTHIC' || petRarity === 'IMMORTAL') {
      sicknessRate = 0.0;
    } else if (member) {
      const gachaTier = economy.getMemberGachaTier(member, guildId);
      if (gachaTier === 'RARE') sicknessRate = 0.25;
      else if (gachaTier === 'EPIC') sicknessRate = 0.15;
      else if (gachaTier === 'LEGENDARY') sicknessRate = 0.05;
      else if (gachaTier === 'MYTHIC') sicknessRate = 0.0;
    }

    if (newSodaToday > 2 && Math.random() < sicknessRate) {
      gotSick = true;
      newStatus = 'SICK';
      newHealth = 5;
    }

    // Reset cooldown work dan hunt, tambah soda_today
    db.run(
      `UPDATE user_pets 
       SET last_work_at = 0, last_hunt_at = 0, soda_today = ?, status = ?, health = ?, last_interaction_at = ?
       WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
      [newSodaToday, newStatus, newHealth, now, userId, guildId, petObj.pet_name]
    );
  })();

  const updatedPet = getPet(userId, guildId);
  return {
    pet: updatedPet,
    item,
    didAutoBuy,
    gotSick
  };
}

function trainPet(userId, guildId) {
  const petObj = getPet(userId, guildId);
  if (!petObj) throw new Error('Anda tidak memiliki hewan peliharaan!');
  if (petObj.status === 'EGG') throw new Error('Pet Anda masih berupa telur!');
  if (petObj.status === 'DEAD') throw new Error('Pet Anda sudah meninggal 🪦.');
  if (petObj.status === 'SICK') throw new Error('Pet Anda sedang sakit 🤢! Sembuhkan terlebih dahulu.');
  if (petObj.status === 'WEAK') throw new Error('Pet Anda sedang lemas kelaparan! Beri makan/minum terlebih dahulu.');
  if (petObj.curse_type === 'injured' && petObj.curse_until > Math.floor(Date.now() / 1000)) {
    throw new Error('Pet Anda sedang terluka parah 🤕! Obati dia terlebih dahulu.');
  }

  if ((petObj.gym_fatigue || 0) >= 100) {
    throw new Error('❌ Pet Anda terlalu lelah berlatih! Istirahatkan pet terlebih dahulu agar ototnya pulih.');
  }

  if (petObj.health < 40) {
    throw new Error('Pet Anda terlalu lemah/lelah (HP < 40) untuk berlatih!');
  }
  if (petObj.hunger < 30 || petObj.thirst < 30) {
    throw new Error('Pet Anda terlalu lapar/haus (Kenyangan/Hidrasi < 30) untuk berlatih!');
  }

  const fee = 80;
  const wallet = economy.getWallet(userId, guildId);
  if (wallet.balance < fee) {
    throw new Error(`Saldo koin Anda tidak mencukupi untuk biaya latihan sebesar Rp ${fee}!`);
  }

  const now = Math.floor(Date.now() / 1000);
  const maxHP = getMaxHP(petObj);
  const newFatigue = Math.min(100, (petObj.gym_fatigue || 0) + 20);

  db.transaction(() => {
    // Kurangi koin
    economy.subtractBalance(userId, guildId, fee, 'PET_GYM_FEE');

    // Berikan XP (+50 XP) dikali xp_multiplier
    let xpGained = Math.round(50 * (petObj.xp_multiplier || 1.0));
    let { newXp, newLevel, levelUp } = addXp(petObj, xpGained, maxHP);

    const newHunger = Math.max(0, petObj.hunger - 30);
    const newThirst = Math.max(0, petObj.thirst - 30);
    let newHealth = petObj.health;
    if (levelUp) {
      newHealth = maxHP; // Full HP saat naik level
    }

    db.run(
      `UPDATE user_pets 
       SET xp = ?, level = ?, hunger = ?, thirst = ?, health = ?, last_interaction_at = ?, gym_fatigue = ?
       WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
      [newXp, newLevel, newHunger, newThirst, newHealth, now, newFatigue, userId, guildId, petObj.pet_name]
    );
  })();

  return {
    pet: getPet(userId, guildId),
    fee,
    xpGained: Math.round(50 * (petObj.xp_multiplier || 1.0))
  };
}

function revivePet(userId, guildId, paymentSource = 'pocket') {
  const petObj = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [userId, guildId]);
  if (!petObj) throw new Error('Anda tidak memiliki hewan peliharaan aktif!');
  if (petObj.status !== 'DEAD') {
    throw new Error(`Pet Anda **"${petObj.pet_name}"** masih hidup sehat walafiat! Tidak perlu dihidupkan kembali.`);
  }

  const cost = 500 * petObj.level;
  let balance = 0;
  if (paymentSource === 'bank') {
    const bank = require('./bank');
    const savings = bank.getSavings(userId, guildId);
    balance = savings.balance;
  } else {
    const wallet = economy.getWallet(userId, guildId);
    balance = wallet.balance;
  }

  if (balance < cost) {
    throw new Error(`Saldo tidak mencukupi! Menghidupkan kembali pet Lv. ${petObj.level} membutuhkan Rp ${cost.toLocaleString('id-ID')} (saldo Anda: Rp ${balance.toLocaleString('id-ID')}).`);
  }

  const now = Math.floor(Date.now() / 1000);
  const newStatus = petObj.level >= 10 ? 'ADULT' : 'BABY';

  db.transaction(() => {
    // Kurangi koin
    economy.subtractBalance(userId, guildId, cost, 'PET_REVIVE', null, paymentSource);

    // Revive pet
    db.run(
      `UPDATE user_pets 
       SET status = ?, health = 50, hunger = 50, thirst = 50, happiness = 50, last_interaction_at = ?
       WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
      [newStatus, now, userId, guildId, petObj.pet_name]
    );
  })();

  return {
    pet: getPet(userId, guildId),
    cost
  };
}

function getItemCooldown(userId, guildId, itemId) {
  const row = db.get('SELECT last_used_at FROM pet_item_cooldowns WHERE user_id = ? AND guild_id = ? AND item_id = ?', [userId, guildId, itemId]);
  if (!row) return 0;
  const item = PET_ITEMS[itemId.toUpperCase()];
  if (!item || !item.cooldown) return 0;
  const now = Math.floor(Date.now() / 1000);
  const elapsed = now - row.last_used_at;
  const remaining = item.cooldown - elapsed;
  return remaining > 0 ? remaining : 0;
}

function setItemCooldown(userId, guildId, itemId, durationSeconds) {
  if (!durationSeconds || durationSeconds <= 0) return;
  const now = Math.floor(Date.now() / 1000);
  db.run(
    'INSERT OR REPLACE INTO pet_item_cooldowns (user_id, guild_id, item_id, last_used_at) VALUES (?, ?, ?, ?)',
    [userId, guildId, itemId, now]
  );
}

function unlockAutoCare(userId, guildId) {
  const petObj = getPet(userId, guildId);
  if (!petObj) {
    throw new Error('Anda tidak memiliki hewan peliharaan aktif!');
  }
  if (petObj.status === 'EGG') {
    throw new Error('Pet Anda masih berupa telur! Tunggu sampai menetas untuk membuka Auto Care.');
  }
  if (petObj.status === 'DEAD') {
    throw new Error('Pet Anda telah mati! Bersihkan kandang terlebih dahulu.');
  }
  if (petObj.auto_feed === 1 || petObj.auto_feed === 2) {
    throw new Error('Fitur Auto Care sudah aktif pada peliharaan ini!');
  }

  const cost = 5000;
  economy.subtractBalance(userId, guildId, cost, 'PET_AUTOCARE_UNLOCK');

  db.run(
    'UPDATE user_pets SET auto_feed = 1 WHERE user_id = ? AND guild_id = ? AND is_active = 1',
    [userId, guildId]
  );

  return {
    petName: petObj.pet_name,
    autoFeed: 1
  };
}

function toggleAutoFeed(userId, guildId) {
  const petObj = getPet(userId, guildId);
  if (!petObj) {
    throw new Error('Anda tidak memiliki hewan peliharaan aktif!');
  }
  if (petObj.status === 'EGG') {
    throw new Error('Pet Anda masih berupa telur! Tunggu sampai menetas.');
  }
  if (petObj.status === 'DEAD') {
    throw new Error('Pet Anda telah mati! Bersihkan kandang terlebih dahulu.');
  }
  
  // Toggle between 0 and 1. If 2 (VIP), throw error.
  if (petObj.auto_feed === 2) {
    throw new Error('Pet Anda memiliki fitur VIP Auto Care Gratis! Tidak perlu dinonaktifkan.');
  }
  
  const nextStatus = petObj.auto_feed === 1 ? 0 : 1;
  db.run(
    'UPDATE user_pets SET auto_feed = ? WHERE user_id = ? AND guild_id = ? AND is_active = 1',
    [nextStatus, userId, guildId]
  );
  return {
    petName: petObj.pet_name,
    autoFeed: nextStatus
  };
}

/**
 * Alokasikan 1 poin Training Point (TP) ke salah satu stat: str, vit, def, dex
 */
function allocateStat(userId, guildId, statName) {
  const allowedStats = ['str', 'vit', 'def', 'dex'];
  const sName = statName.toLowerCase();
  if (!allowedStats.includes(sName)) {
    throw new Error('Stat tidak dikenal! Gunakan: str, vit, def, dex');
  }

  const petObj = getPet(userId, guildId);
  if (!petObj) {
    throw new Error('Anda tidak memiliki hewan peliharaan aktif!');
  }
  if (petObj.status === 'EGG') {
    throw new Error('Pet Anda masih berupa telur! Tunggu sampai menetas.');
  }
  if (petObj.status === 'DEAD') {
    throw new Error('Pet Anda telah meninggal! Revive di Dokter terlebih dahulu.');
  }

  const unusedTp = petObj.unused_tp || 0;
  if (unusedTp <= 0) {
    throw new Error('Pet Anda tidak memiliki sisa Poin Latihan (TP) yang tersedia!');
  }

  const column = `stat_${sName}`;
  
  db.transaction(() => {
    db.run(
      `UPDATE user_pets 
       SET ${column} = ${column} + 1, unused_tp = unused_tp - 1 
       WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
      [userId, guildId, petObj.pet_name]
    );
  })();

  const updatedPet = getPet(userId, guildId);
  db.logPetAction(guildId, userId, null, petObj.pet_name, 'ALLOCATE_STAT', `Meningkatkan stat ${sName.toUpperCase()} sebesar +1. Sisa TP: ${updatedPet.unused_tp}`);
  return updatedPet;
}

/**
 * Reset seluruh alokasi stat pet dan kembalikan ke unused_tp untuk biaya Rp 1.000 koin
 */
function resetGymStats(userId, guildId) {
  const petObj = getPet(userId, guildId);
  if (!petObj) {
    throw new Error('Anda tidak memiliki hewan peliharaan aktif!');
  }
  if (petObj.status === 'EGG') {
    throw new Error('Pet Anda masih berupa telur!');
  }
  if (petObj.status === 'DEAD') {
    throw new Error('Pet Anda telah meninggal!');
  }

  const str = petObj.stat_str || 0;
  const vit = petObj.stat_vit || 0;
  const def = petObj.stat_def || 0;
  const dex = petObj.stat_dex || 0;
  const totalAllocated = str + vit + def + dex;

  if (totalAllocated === 0) {
    throw new Error('Pet Anda belum memiliki alokasi stat apapun yang perlu di-reset!');
  }

  const resetCost = 1000;
  const wallet = economy.getWallet(userId, guildId);
  if (wallet.balance < resetCost) {
    throw new Error(`Saldo koin Anda kurang untuk biaya reset sebesar Rp ${resetCost.toLocaleString('id-ID')}!`);
  }

  db.transaction(() => {
    // Potong koin
    economy.subtractBalance(userId, guildId, resetCost, 'PET_GYM_RESET');

    // Reset stat dan kembalikan ke unused_tp
    db.run(
      `UPDATE user_pets 
       SET stat_str = 0, stat_vit = 0, stat_def = 0, stat_dex = 0, unused_tp = unused_tp + ? 
       WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
      [totalAllocated, userId, guildId, petObj.pet_name]
    );
  })();

  db.logPetAction(guildId, userId, null, petObj.pet_name, 'RESET_STATS', `Mereset latihan Gym pet. Mengembalikan ${totalAllocated} TP. Biaya: Rp ${resetCost.toLocaleString('id-ID')}`);
  return {
    pet: getPet(userId, guildId),
    cost: resetCost,
    pointsRefunded: totalAllocated
  };
}

// ═══════════════════════════════════════════════════════════════
// SISTEM GACHA PET
// ═══════════════════════════════════════════════════════════════

/**
 * Mengambil jumlah TICKET_GACHA yang dimiliki user.
 */
function getGachaTickets(userId, guildId) {
  const row = db.get(
    "SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = 'TICKET_GACHA'",
    [userId, guildId]
  );
  return row ? (row.quantity || 0) : 0;
}

/**
 * Menambah TICKET_GACHA ke inventori user (digunakan admin).
 */
function addGachaTickets(userId, guildId, qty) {
  const q = Math.max(1, parseInt(qty) || 1);
  economy.getWallet(userId, guildId); // pastikan wallet terdaftar
  const exist = db.get(
    "SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = 'TICKET_GACHA'",
    [userId, guildId]
  );
  if (exist) {
    db.run(
      "UPDATE user_inventory SET quantity = quantity + ? WHERE user_id = ? AND guild_id = ? AND item_id = 'TICKET_GACHA'",
      [q, userId, guildId]
    );
  } else {
    db.run(
      "INSERT INTO user_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'TICKET_GACHA', ?)",
      [userId, guildId, q]
    );
  }
  return getGachaTickets(userId, guildId);
}

/**
 * Melakukan satu tarikan gacha dan mengembalikan data pet (belum disimpan ke DB).
 * method: 'COIN_1' | 'COIN_10' | 'TICKET'
 * Mengembalikan array hasil (1 item untuk COIN_1/TICKET, 10 untuk COIN_10).
 */
function rollGacha(userId, guildId, method = 'COIN_1') {
  // Validasi & potong biaya
  const wallet = economy.getWallet(userId, guildId);
  if (method === 'COIN_1') {
    if (wallet.balance < GACHA_PRICES.SINGLE) {
      throw new Error(`Saldo koin Anda tidak cukup! Dibutuhkan **Rp ${GACHA_PRICES.SINGLE.toLocaleString('id-ID')}**, saldo Anda **Rp ${wallet.balance.toLocaleString('id-ID')}**.`);
    }
    economy.subtractBalance(userId, guildId, GACHA_PRICES.SINGLE, 'PET_GACHA_1X');
  } else if (method === 'COIN_10') {
    if (wallet.balance < GACHA_PRICES.MULTI10) {
      throw new Error(`Saldo koin Anda tidak cukup! Dibutuhkan **Rp ${GACHA_PRICES.MULTI10.toLocaleString('id-ID')}**, saldo Anda **Rp ${wallet.balance.toLocaleString('id-ID')}**.`);
    }
    economy.subtractBalance(userId, guildId, GACHA_PRICES.MULTI10, 'PET_GACHA_10X');
  } else if (method === 'TICKET') {
    const tickets = getGachaTickets(userId, guildId);
    if (tickets < 1) {
      throw new Error('Anda tidak memiliki **Tiket Gacha**! Dapatkan tiket dari ekspedisi, daily quest, atau menang PvP.');
    }
    db.run(
      "UPDATE user_inventory SET quantity = quantity - 1 WHERE user_id = ? AND guild_id = ? AND item_id = 'TICKET_GACHA'",
      [userId, guildId]
    );
  } else {
    throw new Error('Metode gacha tidak valid!');
  }

  const count = method === 'COIN_10' ? 10 : 1;
  const results = [];

  for (let i = 0; i < count; i++) {
    results.push(_rollOnce());
  }

  return results;
}

/**
 * Internal: satu tarikan gacha, menentukan rarity → spesies → trait.
 */
function _rollOnce() {
  const rand = Math.random();
  let rarity;
  if      (rand < GACHA_RATES.LEGENDARY) rarity = 'LEGENDARY';
  else if (rand < GACHA_RATES.LEGENDARY + GACHA_RATES.EPIC) rarity = 'EPIC';
  else if (rand < GACHA_RATES.LEGENDARY + GACHA_RATES.EPIC + GACHA_RATES.RARE) rarity = 'RARE';
  else    rarity = 'COMMON';

  // Pilih spesies berdasarkan rarity
  let speciesPool;
  let trait  = '';
  let trait2 = '';

  if (rarity === 'COMMON') {
    speciesPool = ['CAT', 'GOLEM', 'SLIME'];
    // Tidak ada trait untuk common
  } else if (rarity === 'RARE') {
    // Dragon hanya 5% dari pool Rare (20% dari 25% total = 5%); sisanya CAT/GOLEM/SLIME
    const dragonRoll = Math.random();
    if (dragonRoll < 0.20) {
      speciesPool = ['DRAGON'];
    } else {
      speciesPool = ['CAT', 'GOLEM', 'SLIME'];
    }
    trait = GACHA_TRAIT_RARE[Math.floor(Math.random() * GACHA_TRAIT_RARE.length)];
  } else if (rarity === 'EPIC') {
    speciesPool = ['PHOENIX', 'TURTLE', 'SIREN', 'PEGASUS', 'KITSUNE', 'KIRIN', 'YETI'];
    trait = GACHA_TRAIT_EPIC[0]; // SURVIVOR
  } else { // LEGENDARY
    speciesPool = ['LEVIATHAN', 'BEHEMOTH', 'ARCHDRAGON', 'CERBERUS', 'TYPHON', 'VALKYRIE', 'IFRIT'];
    // 2 trait acak unik
    const shuffled = [...GACHA_TRAIT_LEGENDARY].sort(() => Math.random() - 0.5);
    trait  = shuffled[0];
    trait2 = shuffled[1];
  }

  const speciesId = speciesPool[Math.floor(Math.random() * speciesPool.length)];
  const species   = GACHA_SPECIES[speciesId];

  return {
    speciesId,
    species,
    rarity,
    trait,
    trait2,
    baseHP:  species.baseHP,
    baseAtk: species.baseAtk,
    baseDef: species.baseDef,
    element: species.element,
    workBuff: species.workBuff,
  };
}

function _rollAncientBox() {
  const roll = Math.random();
  let rarity;
  let speciesPool;
  let trait = '';
  let trait2 = '';

  if (roll < 0.15) {
    rarity = 'LEGENDARY';
    speciesPool = ['LEVIATHAN', 'BEHEMOTH', 'ARCHDRAGON'];
    // 2 random unique traits
    const shuffled = [...GACHA_TRAIT_LEGENDARY].sort(() => Math.random() - 0.5);
    trait = shuffled[0];
    trait2 = shuffled[1];
  } else if (roll < 0.50) {
    rarity = 'EPIC';
    speciesPool = ['PHOENIX', 'TURTLE'];
    trait = GACHA_TRAIT_EPIC[0]; // SURVIVOR
  } else {
    rarity = 'RARE';
    speciesPool = ['DRAGON'];
    trait = GACHA_TRAIT_RARE[Math.floor(Math.random() * GACHA_TRAIT_RARE.length)];
  }

  const speciesId = speciesPool[Math.floor(Math.random() * speciesPool.length)];
  const species = GACHA_SPECIES[speciesId];

  return {
    speciesId,
    species,
    rarity,
    trait,
    trait2,
    baseHP: species.baseHP,
    baseAtk: species.baseAtk,
    baseDef: species.baseDef,
    element: species.element,
    workBuff: species.workBuff,
  };
}

/**
 * Menyimpan satu hasil gacha ke database (user harus memiliki slot kandang tersisa).
 * petName: nama yang diberikan user.
 */
function saveGachaPet(userId, guildId, pullResult, petName) {
  // Sanitasi nama
  const sanitizedName = sanitizePetName(petName);

  // Cek slot kandang
  const countRow = db.get('SELECT COUNT(*) as count FROM user_pets WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  const count    = countRow ? countRow.count : 0;

  // Cek nama duplikat
  const nameExists = db.get(
    'SELECT 1 FROM user_pets WHERE user_id = ? AND guild_id = ? AND LOWER(pet_name) = LOWER(?)',
    [userId, guildId, sanitizedName.toLowerCase()]
  );
  if (nameExists) {
    throw new Error(`Anda sudah memiliki peliharaan bernama **"${sanitizedName}"**! Pilih nama lain.`);
  }

  const now      = Math.floor(Date.now() / 1000);
  const isActive = count === 0 ? 1 : 0;
  const hp       = pullResult.rarity === 'LEGENDARY' ? 150 : (pullResult.baseHP || 100);

  db.run(
    `INSERT INTO user_pets 
     (user_id, guild_id, pet_name, pet_type, status, level, xp, health, hunger, thirst, happiness,
      last_interaction_at, hatch_at, created_at, is_active, trait, gacha_source, gacha_rarity, gacha_element, gacha_trait2, star_level)
     VALUES (?, ?, ?, ?, 'ADULT', 1, 0, ?, 100, 100, 100, ?, 0, ?, ?, ?, 'GACHA', ?, ?, ?, 1)`,
    [userId, guildId, sanitizedName, pullResult.speciesId, hp, now, now, isActive,
     pullResult.trait, pullResult.rarity, pullResult.element, pullResult.trait2]
  );

  db.logPetAction(guildId, userId, null, sanitizedName, 'GACHA_SAVE', `Menyimpan pet hasil gacha: ${pullResult.speciesId} (${pullResult.rarity}). Element: ${pullResult.element || 'None'}, Trait: ${pullResult.trait || 'None'}`);
  return db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [userId, guildId, sanitizedName]);
}

/**
 * Mendaur ulang (menghapus) pet milik user dan memberikan Rp 1.000 ganti rugi.
 * petName: nama pet yang ingin direcycle.
 */
function recyclePet(userId, guildId, petName) {
  const petRow = db.get(
    'SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND LOWER(pet_name) = LOWER(?)',
    [userId, guildId, petName.trim().toLowerCase()]
  );
  if (!petRow) {
    throw new Error(`Pet dengan nama **"${petName}"** tidak ditemukan di kandang Anda!`);
  }

  const recycleReward = RECYCLE_REWARD;

  db.transaction(() => {
    db.run('DELETE FROM user_pets WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [userId, guildId, petRow.pet_name]);
    economy.addBalance(userId, guildId, recycleReward, 'PET_RECYCLE');

    // Jika pet yang direcycle adalah pet aktif, aktifkan pet lain
    if (petRow.is_active === 1) {
      const next = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? LIMIT 1', [userId, guildId]);
      if (next) {
        db.run('UPDATE user_pets SET is_active = 1 WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [userId, guildId, next.pet_name]);
      }
    }
  })();

  db.logPetAction(guildId, userId, null, petRow.pet_name, 'RECYCLE', `Mendaur ulang pet ${petRow.pet_name} (${petRow.pet_type}) seharga Rp ${recycleReward.toLocaleString('id-ID')}.`);
  return { petName: petRow.pet_name, reward: recycleReward };
}

// ═══════════════════════════════════════════════════════════════
// SISTEM UPGRADE BINTANG PET (STAR FUSION)
// ═══════════════════════════════════════════════════════════════

/**
 * Mengambil persyaratan upgrade bintang untuk pet saat ini.
 */
function getUpgradeRequirements(petRow) {
  const currentStar = petRow.star_level || 1;
  if (currentStar >= 5) {
    return null; // Sudah max bintang
  }
  const req = STAR_UPGRADE_REQ[currentStar];
  return {
    currentStar,
    nextStar:    currentStar + 1,
    dupCount:    req.dupCount,
    minStarDup:  req.minStarDup,
    coinCost:    req.coinCost,
  };
}

/**
 * Mendapatkan daftar pet yang bisa dijadikan tumbal untuk upgrade.
 * Mencari pet dengan spesies sama, bukan pet utama, dan memenuhi syarat min bintang.
 */
function getPetSacrificeList(userId, guildId, petType, minStarDup, excludeName) {
  const pets = db.all(
    `SELECT * FROM user_pets 
     WHERE user_id = ? AND guild_id = ? AND pet_type = ? AND LOWER(pet_name) != LOWER(?)
       AND (star_level IS NULL OR star_level >= ?)`,
    [userId, guildId, petType, excludeName, minStarDup]
  );
  return pets;
}

/**
 * Melaksanakan upgrade bintang pet.
 * sacrificeNames: array nama pet yang dikorbankan (1 atau 2 nama).
 */
function upgradePetStar(userId, guildId, mainPetName, sacrificeNames) {
  // Ambil pet utama
  const mainPet = db.get(
    'SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND LOWER(pet_name) = LOWER(?)',
    [userId, guildId, mainPetName.trim().toLowerCase()]
  );
  if (!mainPet) {
    throw new Error(`Pet **"${mainPetName}"** tidak ditemukan di kandang Anda!`);
  }

  const req = getUpgradeRequirements(mainPet);
  if (!req) {
    throw new Error(`Pet **${mainPet.pet_name}** sudah berada di bintang tertinggi (**⭐5**)!`);
  }

  if (!Array.isArray(sacrificeNames) || sacrificeNames.length < req.dupCount) {
    throw new Error(`Upgrade ini membutuhkan **${req.dupCount} pet tumbal**!`);
  }

  // Validasi setiap pet tumbal
  const sacrificePets = [];
  for (const sName of sacrificeNames.slice(0, req.dupCount)) {
    if (sName.toLowerCase() === mainPet.pet_name.toLowerCase()) {
      throw new Error('Anda tidak bisa mengorbankan pet utama yang ingin ditingkatkan!');
    }
    const sp = db.get(
      'SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND LOWER(pet_name) = LOWER(?)',
      [userId, guildId, sName.trim().toLowerCase()]
    );
    if (!sp) {
      throw new Error(`Pet tumbal **"${sName}"** tidak ditemukan di kandang Anda!`);
    }
    if (sp.pet_type !== mainPet.pet_type) {
      throw new Error(`Pet tumbal **${sp.pet_name}** harus berspesies sama (**${mainPet.pet_type}**)!`);
    }
    const spStar = sp.star_level || 1;
    if (spStar < req.minStarDup) {
      throw new Error(`Pet tumbal **${sp.pet_name}** harus memiliki minimal **⭐${req.minStarDup}** bintang!`);
    }
    sacrificePets.push(sp);
  }

  // Cek saldo koin
  const wallet = economy.getWallet(userId, guildId);
  if (wallet.balance < req.coinCost) {
    throw new Error(`Saldo koin tidak cukup! Dibutuhkan **Rp ${req.coinCost.toLocaleString('id-ID')}**, saldo Anda **Rp ${wallet.balance.toLocaleString('id-ID')}**.`);
  }

  // Hitung bonus stats baru
  const newStar    = req.nextStar;
  const newBonuses = getStarBonuses(newStar);
  const baseMaxHP  = mainPet.pet_type === 'SLIME' ? 120 : (mainPet.gacha_rarity === 'LEGENDARY' ? 150 : 100);
  const newMaxHP   = baseMaxHP + newBonuses.hpBonus;

  db.transaction(() => {
    // Kurangi koin
    economy.subtractBalance(userId, guildId, req.coinCost, 'PET_STAR_UPGRADE');

    // Hapus pet tumbal
    for (const sp of sacrificePets) {
      db.run('DELETE FROM user_pets WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [userId, guildId, sp.pet_name]);
    }

    // Upgrade bintang pet utama
    db.run(
      `UPDATE user_pets 
       SET star_level = ?, base_hp_bonus = ?, base_atk_bonus_pct = ?, base_def_bonus_pct = ?,
           health = MIN(health, ?)
       WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
      [newStar, newBonuses.hpBonus, newBonuses.atkBonusPct, newBonuses.defBonusPct,
       newMaxHP, userId, guildId, mainPet.pet_name]
    );
  })();

  const updatedPet = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [userId, guildId, mainPet.pet_name]);
  db.logPetAction(guildId, userId, null, mainPet.pet_name, 'STAR_UPGRADE', `Meningkatkan bintang pet ke ⭐${newStar} dengan mengorbankan: ${sacrificePets.map(s => s.pet_name).join(', ')}. Biaya: Rp ${req.coinCost.toLocaleString('id-ID')}`);
  return {
    pet:         updatedPet,
    newStar,
    newBonuses,
    coinCost:    req.coinCost,
    sacrificed:  sacrificePets.map(s => s.pet_name),
  };
}

/**
 * Admin: paksa set bintang pet secara langsung.
 */
function forceSetStar(userId, guildId, petName, starLevel) {
  const star = Math.max(1, Math.min(5, parseInt(starLevel) || 1));
  const petRow = db.get(
    'SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND LOWER(pet_name) = LOWER(?)',
    [userId, guildId, petName.trim().toLowerCase()]
  );
  if (!petRow) {
    throw new Error(`Pet **"${petName}"** tidak ditemukan!`);
  }
  const bonuses = getStarBonuses(star);
  db.run(
    `UPDATE user_pets SET star_level = ?, base_hp_bonus = ?, base_atk_bonus_pct = ?, base_def_bonus_pct = ?
     WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
    [star, bonuses.hpBonus, bonuses.atkBonusPct, bonuses.defBonusPct, userId, guildId, petRow.pet_name]
  );
  db.logPetAction(guildId, userId, null, petRow.pet_name, 'ADMIN_FORCE_STAR', `Admin mengubah bintang pet secara paksa menjadi ⭐${star}`);
  return db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [userId, guildId, petRow.pet_name]);
}

/**
 * Memproses kegagalan ekspedisi pet akibat salah klik (Interference) atau waktu reaksi habis (Timeout)
 * Menarik risiko kematian pet berdasarkan level pet, peta zona, dan di bawah level rekomendasi.
 */
function executeExpeditionQteFailure(guildId, participantIds, failedUserId, reasonType, mapId, membersMap = {}) {
  const activePets = [];
  participantIds.forEach(pId => {
    const p = getPet(pId, guildId);
    if (p && p.status !== 'DEAD' && p.status !== 'EGG') {
      activePets.push({ userId: pId, pet: p });
    }
  });

  const selectedMap = EXPEDITION_MAPS.find(m => m.id === parseInt(mapId)) || EXPEDITION_MAPS[0];
  const now = Math.floor(Date.now() / 1000);
  const results = [];

  const teamHasImmortal = activePets.some(ap => {
    const petRarity = ap.pet.gacha_rarity || (GACHA_SPECIES[ap.pet.pet_type] ? GACHA_SPECIES[ap.pet.pet_type].rarity : '') || '';
    return petRarity === 'IMMORTAL';
  });

  db.transaction(() => {
    activePets.forEach(ap => {
      // Increment daily expedition count
      checkExpeditionLimit(ap.userId, guildId, false);

      const isGod = isGodPet(ap.pet);
      const maxHP = getMaxHP(ap.pet);

      // Dampak kegagalan QTE: Lapar -15, Haus -15, Kebahagiaan -30 (Stress tinggi)
      const newHappiness = isGod ? 100 : Math.max(10, ap.pet.happiness - 30);
      const newHunger = isGod ? 100 : Math.max(0, ap.pet.hunger - 15);
      const newThirst = isGod ? 100 : Math.max(0, ap.pet.thirst - 15);

      // Hitung risiko kematian pet
      // Base: 2%
      let deathProb = 0.02;
      const petRarity = ap.pet.gacha_rarity || (GACHA_SPECIES[ap.pet.pet_type] ? GACHA_SPECIES[ap.pet.pet_type].rarity : '') || '';

      if (teamHasImmortal || petRarity === 'IMMORTAL' || petRarity === 'MYTHIC') {
        deathProb = 0.0;
      } else {
        // Faktor Level Pet: +(level - 1) * 0.5%
        deathProb += (ap.pet.level - 1) * 0.005;

        // Faktor Zona Map: +mapId * 2%
        deathProb += selectedMap.id * 0.02;

        // Penalti Level Di Bawah Rekomendasi: +(recommLvl - lvl) * 6%
        const lvlDiff = selectedMap.recommendedLevel - ap.pet.level;
        if (lvlDiff > 0) {
          deathProb += lvlDiff * 0.06;
        }

        // Gacha tier protection
        if (membersMap && membersMap[ap.userId]) {
          const gachaTier = economy.getMemberGachaTier(membersMap[ap.userId], guildId);
          if (gachaTier === 'LEGENDARY') deathProb = Math.max(0, deathProb - 0.10);
          else if (gachaTier === 'MYTHIC') deathProb = 0.0;
        }

        // Limit deathChance to 85% max
        if (deathProb > 0.85) deathProb = 0.85;
      }

      let finalHealth = isGod ? maxHP : Math.max(5, ap.pet.health - 25);
      let finalStatus = ap.pet.status;
      let finalAccessory = ap.pet.accessory;
      let deathTriggered = false;
      let isSavedByAmulet = false;
      let isSavedBySurvivor = false;

      // Roll kematian
      if (!isGod && Math.random() < deathProb) {
        deathTriggered = true;
        if (ap.pet.accessory === 'LUCKY_AMULET') {
          isSavedByAmulet = true;
          finalHealth = 20;
          finalAccessory = '';
          if (finalStatus === 'WEAK') {
            finalStatus = ap.pet.level >= 10 ? 'ADULT' : 'BABY';
          }
        } else if (petHasTrait(ap.pet, 'SURVIVOR')) {
          isSavedBySurvivor = true;
          finalHealth = 1;
          finalStatus = 'WEAK';
        } else {
          finalHealth = 0;
          finalStatus = 'DEAD';
        }
      }

      db.run(
        `UPDATE user_pets 
         SET health = ?, status = ?, happiness = ?, hunger = ?, thirst = ?, last_interaction_at = ?, accessory = ?
         WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
        [finalHealth, finalStatus, newHappiness, newHunger, newThirst, now, finalAccessory, ap.userId, guildId, ap.pet.pet_name]
      );

      let statusText = '';
      if (deathTriggered) {
        if (isSavedByAmulet) {
          statusText = '💥 **Jimat Keberuntungan Hancur!** Pet selamat dari maut dengan sisa 20 HP. 🛡️';
        } else if (isSavedBySurvivor) {
          statusText = '❤️ **Dampak Fatal!** Pet bertahan hidup dengan sisa 1 HP karena trait *Survivor*. 🩹';
        } else {
          statusText = '🪦 **MENINGGAL DUNIA!** Pet tewas di tempat pertempuran. (Butuh Dokter Pet untuk dihidupkan)';
        }
      } else {
        statusText = `🩹 Terluka parah (HP: **${finalHealth}%**, Mood: **${newHappiness}%**)`;
      }

      results.push({
        userId: ap.userId,
        petName: ap.pet.pet_name,
        statusText,
        deathTriggered,
        isSavedByAmulet,
        isSavedBySurvivor
      });
      db.logPetAction(guildId, ap.userId, null, ap.pet.pet_name, 'EXPEDITION_QTE_FAIL', `QTE gagal (gagal oleh <@${failedUserId}>) di ${selectedMap.name}. Status: ${statusText.replace(/\*\*|__/g, '')}`);
    });
  })();

  return results;
}


module.exports = {
  // Config & utils
  PET_ITEMS,

  PET_SPECIES,
  EXPEDITION_MAPS,
  GACHA_SPECIES,
  GACHA_RATES,
  GACHA_PRICES,
  RECYCLE_REWARD,
  STAR_UPGRADE_REQ,
  getStarBonuses,
  renderStars,
  getMaxHP,
  addXp,
  // Core
  getPet,
  adoptPet,
  resetPet,
  getInventory,
  buyItem,
  useItem,
  playWithPet,
  sendToWork,
  sendToHunt,
  executePvP,
  getPetsList,
  switchActivePet,
  breedPets,
  executeExpeditionQteFailure,
  calculateSuccessRate,
  executeExpedition,
  getXpNeeded,
  checkExpeditionLimit,
  getPetLeaderboard,
  setCustomImage,
  washPet,
  getOrCreateDailyQuests,
  incrementQuestProgress,
  claimDailyQuestReward,
  revivePet,
  useSodaEnergy,
  trainPet,
  getItemCooldown,
  setItemCooldown,
  unlockAutoCare,
  toggleAutoFeed,
  allocateStat,
  resetGymStats,
  // Gacha
  rollGacha,
  _rollOnce,
  saveGachaPet,
  recyclePet,
  getGachaTickets,
  addGachaTickets,
  // Upgrade Bintang
  upgradePetStar,
  getUpgradeRequirements,
  getPetSacrificeList,
  forceSetStar,
};

// ═══════════════════════════════════════════════
// FITUR BARU: MENARA UJIAN & RAID WORLD BOSS MINGGUAN
// ═══════════════════════════════════════════════

function getWeekStartString() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-${String(weekNo).padStart(2, '0')}`;
}

function getTowerBoss(floor) {
  const baseHp = 100;
  const baseAtk = 10;
  const baseDef = 0;
  
  const hp = Math.round(baseHp * Math.pow(1.15, floor) + floor * 50);
  const atk = Math.round(baseAtk * Math.pow(1.1, floor) + floor * 5);
  const def = Math.min(45, Math.round(baseDef + floor * 0.8));
  
  const elements = ['EARTH', 'FIRE', 'WATER', 'DRAGON'];
  let element = elements[(floor - 1) % elements.length];
  if (floor % 5 === 0) {
    element = 'DRAGON';
  }
  
  const bossNames = [
    'Slime Raksasa', 'Kelelawar Gua', 'Ular Hutan', 'Goblin Petarung', 'Raksasa Batu',
    'Golem Magma', 'Kepiting Samudera', 'Serigala Salju', 'Prajurit Tengkorak', 'Lich Necromancer',
    'Void Seeker', 'Behemoth Kecil', 'Hydra Rawa', 'Leviathan Muda', 'Archdragon Kuno'
  ];
  let name = bossNames[(floor - 1) % bossNames.length];
  if (floor % 5 === 0) {
    name += ' (BOSS)';
  }

  return { name, hp, maxHp: hp, atk, def, element };
}

function isElementAdvantage(petEl, opponentEl) {
  if (!petEl || !opponentEl) return false;
  const p = petEl.toUpperCase();
  const o = opponentEl.toUpperCase();
  if (p === 'WATER' && o === 'FIRE') return true;
  if (p === 'FIRE' && o === 'EARTH') return true;
  if (p === 'EARTH' && o === 'WATER') return true;
  if (p === 'DRAGON' && o !== 'DRAGON') return true;
  return false;
}

function getTowerState(userId, guildId) {
  const now = new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);
  
  let state = db.get('SELECT * FROM user_pet_tower WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  if (!state) {
    db.run(
      "INSERT INTO user_pet_tower (user_id, guild_id, current_floor, daily_attempts, last_attempt_date, last_sweep_date) VALUES (?, ?, 1, 0, ?, '')",
      [userId, guildId, todayStr]
    );
    state = db.get('SELECT * FROM user_pet_tower WHERE user_id = ? AND guild_id = ?', [userId, guildId]);
  } else if (state.last_attempt_date !== todayStr) {
    db.run(
      'UPDATE user_pet_tower SET daily_attempts = 0, last_attempt_date = ? WHERE user_id = ? AND guild_id = ?',
      [todayStr, userId, guildId]
    );
    state.daily_attempts = 0;
    state.last_attempt_date = todayStr;
  }
  return state;
}

function climbTower(userId, guildId, useSoda) {
  const petObj = getPet(userId, guildId);
  if (!petObj) throw new Error('Anda tidak memiliki hewan peliharaan aktif!');
  if (petObj.status === 'EGG') throw new Error('Pet Anda masih berupa telur! Tunggu sampai menetas.');
  if (petObj.status === 'DEAD') throw new Error('Pet Anda sudah meninggal! Revive terlebih dahulu.');
  if (petObj.health < 20) throw new Error('Pet Anda terlalu lelah (HP < 20)! Obati dia terlebih dahulu.');

  const towerState = getTowerState(userId, guildId);
  const floor = towerState.current_floor;
  if (floor > 50) throw new Error('Selamat! Anda telah menyelesaikan seluruh 50 lantai Menara Ujian!');

  // Cek Kuota Percobaan
  if (towerState.daily_attempts >= 5) {
    if (useSoda) {
      // Cari Soda Energi di inventory
      const sodaQty = getItemQuantity(userId, guildId, 'SODA_ENERGY');
      if (sodaQty > 0) {
        db.run("UPDATE pet_inventory SET quantity = quantity - 1 WHERE user_id = ? AND guild_id = ? AND item_id = 'SODA_ENERGY'", [userId, guildId]);
      } else {
        // Coba bayar Rp 500
        const wallet = economy.getWallet(userId, guildId);
        if (wallet.balance < 500) {
          throw new Error('Anda kehabisan kuota harian Menara Ujian! Anda butuh 🥤 Soda Energi Pet atau Rp 500 koin untuk tiket masuk tambahan.');
        }
        economy.subtractBalance(userId, guildId, 500, 'PET_TOWER_TICKET');
      }
    } else {
      throw new Error('Kuota harian (5/5) Menara Ujian Anda sudah habis! Konfirmasi penggunaan Soda Energi / Rp 500 koin untuk melanjutkan.');
    }
  }

  const boss = getTowerBoss(floor);

  // --- COMBAT SIMULATION ---
  const logs = [];
  let petHP = petObj.health;
  let bossHP = boss.hp;

  const speciesInfo = GACHA_SPECIES[petObj.pet_type];
  const specBaseAtk = speciesInfo ? (speciesInfo.baseAtk || 10) : 10;
  const petBaseAtk = specBaseAtk + petObj.level * 5 + (petObj.stat_str || 0) * 2;

  let petAtkMult = petObj.pet_type === 'DRAGON' ? 1.15 : 1.0;
  if (petObj.trait === 'WARRIOR') petAtkMult += 0.15;
  if (petObj.accessory === 'SWORD_TOY') petAtkMult += 0.15;
  petAtkMult += (petObj.base_atk_bonus_pct || 0.0);

  // Element Advantage
  const hasAdvantage = isElementAdvantage(petObj.gacha_element, boss.element);
  if (hasAdvantage) {
    petAtkMult += 0.25;
    logs.push(`⭐ **Efek Elemen:** Elemen **${petObj.gacha_element}** pet Anda diuntungkan melawan elemen **${boss.element}** Boss! (+25% ATK)`);
  }

  // Pet DEF
  const specBaseDef = speciesInfo ? (speciesInfo.baseDef || 0) : 0;
  let petDefMult = 1.0;
  if (petObj.trait === 'STURDY') petDefMult *= 0.85;
  if (petObj.accessory === 'SHIELD_TOY') petDefMult *= 0.85;
  const petDefGym = Math.min(0.50, (petObj.stat_def || 0) * 0.005);
  const petDamageTakenMult = (1.0 - (specBaseDef / 100)) * petDefMult * (1.0 - (petObj.base_def_bonus_pct || 0.0)) * (1.0 - petDefGym);

  const petDex = petObj.stat_dex || 0;
  const petCritChance = Math.min(0.35, petDex * 0.005);

  let round = 1;
  const maxRounds = 30;
  let isWin = false;

  logs.push(`⚔️ **Pertempuran Dimulai!** **${petObj.pet_name}** (HP: ${petHP}/${getMaxHP(petObj)}) VS **${boss.name}** (HP: ${boss.hp})`);

  while (round <= maxRounds && petHP > 0 && bossHP > 0) {
    // 1. Pet attacks Boss
    let dmg = Math.round(petBaseAtk * petAtkMult * (0.8 + Math.random() * 0.4));
    dmg = Math.round(dmg * (1.0 - (boss.def / 100)));
    
    const isCrit = Math.random() < petCritChance;
    if (isCrit) {
      dmg = Math.round(dmg * 1.5);
    }

    bossHP = Math.max(0, bossHP - dmg);
    const critText = isCrit ? ' 💥 **CRITICAL HIT!**' : '';
    logs.push(` R.${round}: **${petObj.pet_name}** menyerang **${boss.name}** sebesar **${dmg} DMG**!${critText} (HP Boss: ${bossHP})`);

    if (bossHP <= 0) {
      isWin = true;
      break;
    }

    // 2. Boss attacks Pet
    let bossDmg = Math.round(boss.atk * (0.8 + Math.random() * 0.4));
    bossDmg = Math.round(bossDmg * petDamageTakenMult);

    petHP = Math.max(0, petHP - bossDmg);
    logs.push(` R.${round}: **${boss.name}** membalas sebesar **${bossDmg} DMG**! (HP Pet: ${petHP})`);

    if (petHP <= 0) {
      break;
    }

    round++;
  }

  // --- POST COMBAT ---
  let rewardCoins = 0;
  let rewardXp = 0;
  let gotCheckpointReward = false;
  let checkpointRewardName = '';

  if (isWin) {
    logs.push(`🎉 **KEMENANGAN!** **${petObj.pet_name}** berhasil menaklukkan Lantai ${floor}!`);
    
    // Reward Formula
    rewardCoins = Math.round(500 + Math.pow(floor, 2.1) * 13);
    rewardXp = floor * 10 + 50;

    // Checkpoint reward (multiples of 5)
    if (floor % 5 === 0) {
      gotCheckpointReward = true;
      checkpointRewardName = '🎟️ Tiket Gacha Pet';
      // Add ticket to user_inventory
      const exist = db.get("SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = 'TICKET_GACHA'", [userId, guildId]);
      if (exist) {
        db.run("UPDATE user_inventory SET quantity = quantity + 1 WHERE user_id = ? AND guild_id = ? AND item_id = 'TICKET_GACHA'", [userId, guildId]);
      } else {
        db.run("INSERT INTO user_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'TICKET_GACHA', 1)", [userId, guildId]);
      }
    }

    // Add balance
    economy.addBalance(userId, guildId, rewardCoins, 'PET_TOWER_REWARD');

    // Add XP
    const xpResult = addXp(petObj, rewardXp, getMaxHP(petObj));
    db.run(
      'UPDATE user_pets SET xp = ?, level = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?',
      [xpResult.newXp, xpResult.newLevel, userId, guildId, petObj.pet_name]
    );

    // Update Tower State
    db.run(
      'UPDATE user_pet_tower SET current_floor = current_floor + 1, daily_attempts = daily_attempts + 1 WHERE user_id = ? AND guild_id = ?',
      [userId, guildId]
    );
  } else {
    logs.push(`💀 **KEKALAHAN!** **${petObj.pet_name}** pingsan di Lantai ${floor}.`);
    
    // Reduce HP
    db.run(
      "UPDATE user_pets SET health = 1, status = 'WEAK' WHERE user_id = ? AND guild_id = ? AND pet_name = ?",
      [userId, guildId, petObj.pet_name]
    );

    db.run(
      'UPDATE user_pet_tower SET daily_attempts = daily_attempts + 1 WHERE user_id = ? AND guild_id = ?',
      [userId, guildId]
    );
  }

  return {
    isWin,
    logs,
    floor,
    rewardCoins,
    rewardXp,
    gotCheckpointReward,
    checkpointRewardName,
    petHP: isWin ? petHP : 1
  };
}

function sweepTower(userId, guildId) {
  const petObj = getPet(userId, guildId);
  if (!petObj) throw new Error('Anda tidak memiliki hewan peliharaan aktif!');
  if (petObj.status === 'EGG') throw new Error('Pet Anda masih berupa telur!');
  if (petObj.status === 'DEAD') throw new Error('Pet Anda sudah meninggal!');

  const towerState = getTowerState(userId, guildId);
  const floor = towerState.current_floor;
  if (floor === 1) throw new Error('Anda harus menyelesaikan minimal Lantai 1 terlebih dahulu sebelum bisa melakukan Sweep!');

  const now = new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);

  if (towerState.last_sweep_date === todayStr) {
    throw new Error('Anda sudah melakukan Sweep hari ini! Silakan kembali besok.');
  }

  // Syarat Kesejahteraan Pet
  if (petObj.hunger < 50 || petObj.thirst < 50 || petObj.happiness < 50) {
    throw new Error('Pet Anda terlalu lapar, haus, atau sedih (harus > 50%) untuk melakukan Sweep! Rawat pet Anda terlebih dahulu.');
  }

  // Calculate rewards (10% sum of rewards of all cleared floors)
  let totalCumulativeCoins = 0;
  for (let f = 1; f < floor; f++) {
    totalCumulativeCoins += 500 + Math.pow(f, 2.1) * 13;
  }

  let rewardCoins = Math.round(totalCumulativeCoins * 0.10);
  // Cap reward coins to Rp 15.000 to prevent economy breaking
  rewardCoins = Math.min(15000, rewardCoins);

  let rewardXp = Math.min(150, (floor - 1) * 5 + 10);

  // Apply decay to pet: -10 Hunger, -10 Thirst
  const newHunger = Math.max(0, petObj.hunger - 10);
  const newThirst = Math.max(0, petObj.thirst - 10);

  // Add balance
  economy.addBalance(userId, guildId, rewardCoins, 'PET_TOWER_SWEEP');

  // Add XP
  const xpResult = addXp(petObj, rewardXp, getMaxHP(petObj));

  db.run(
    `UPDATE user_pets 
     SET hunger = ?, thirst = ?, xp = ?, level = ? 
     WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
    [newHunger, newThirst, xpResult.newXp, xpResult.newLevel, userId, guildId, petObj.pet_name]
  );

  // Update Sweep Date
  db.run(
    'UPDATE user_pet_tower SET last_sweep_date = ? WHERE user_id = ? AND guild_id = ?',
    [todayStr, userId, guildId]
  );

  return {
    rewardCoins,
    rewardXp,
    floorCleared: floor - 1
  };
}

function getOrCreateWorldBoss(guildId) {
  const weekStart = getWeekStartString();
  
  // Auto-distribute any undistributed previous bosses first
  const oldBosses = db.all("SELECT * FROM world_boss WHERE guild_id = ? AND week_start != ? AND status IN ('ACTIVE', 'DEFEATED')", [guildId, weekStart]);
  for (const ob of oldBosses) {
    if (ob.status === 'ACTIVE') {
      db.run("UPDATE world_boss SET status = 'EXPIRED' WHERE guild_id = ? AND week_start = ?", [guildId, ob.week_start]);
    }
    distributeWorldBossRewards(guildId, null, ob.week_start);
  }

  let boss = db.get('SELECT * FROM world_boss WHERE guild_id = ? AND week_start = ?', [guildId, weekStart]);

  if (!boss) {
    const activeUsersCountRow = db.get("SELECT COUNT(*) as count FROM wallets WHERE guild_id = ?", [guildId]);
    const activeUsersCount = activeUsersCountRow ? activeUsersCountRow.count : 1;
    const maxHp = Math.max(5000000, activeUsersCount * 250000);

    const elements = ['FIRE', 'WATER', 'EARTH', 'DRAGON'];
    const bossType = elements[Math.floor(Math.random() * elements.length)];

    const bossNames = {
      FIRE: '🌋 Volcanus',
      WATER: '🌊 Leviathan Core',
      EARTH: '⛰️ Terrasaur',
      DRAGON: '🌀 Aetherius'
    };
    const bossName = bossNames[bossType];

    db.run(
      "INSERT INTO world_boss (guild_id, week_start, boss_name, boss_type, max_hp, current_hp, status) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')",
      [guildId, weekStart, bossName, bossType, maxHp, maxHp]
    );

    boss = db.get('SELECT * FROM world_boss WHERE guild_id = ? AND week_start = ?', [guildId, weekStart]);
  }

  return boss;
}

function attackWorldBoss(userId, guildId, useSoda) {
  const petObj = getPet(userId, guildId);
  if (!petObj) throw new Error('Anda tidak memiliki hewan peliharaan aktif!');
  if (petObj.status === 'EGG') throw new Error('Pet Anda masih berupa telur!');
  if (petObj.status === 'DEAD') throw new Error('Pet Anda sudah meninggal!');
  if (petObj.health < 20 || petObj.hunger < 20 || petObj.thirst < 20) {
    throw new Error('Pet Anda terlalu lelah, lapar, atau haus (harus > 20) untuk menyerang World Boss! Rawat pet Anda terlebih dahulu.');
  }

  const boss = getOrCreateWorldBoss(guildId);
  if (boss.status !== 'ACTIVE' || boss.current_hp <= 0) {
    throw new Error('World Boss sudah berhasil dikalahkan minggu ini!');
  }

  const weekStart = getWeekStartString();
  let part = db.get('SELECT * FROM world_boss_participants WHERE user_id = ? AND guild_id = ? AND pet_name = ? AND week_start = ?', [userId, guildId, petObj.pet_name, weekStart]);

  if (!part) {
    db.run(
      'INSERT INTO world_boss_participants (user_id, guild_id, pet_name, week_start, damage_dealt, attacks_count, last_attack_at) VALUES (?, ?, ?, ?, 0, 0, 0)',
      [userId, guildId, petObj.pet_name, weekStart]
    );
    part = db.get('SELECT * FROM world_boss_participants WHERE user_id = ? AND guild_id = ? AND pet_name = ? AND week_start = ?', [userId, guildId, petObj.pet_name, weekStart]);
  }

  // Check Attack Count
  if (part.attacks_count >= 3) {
    if (useSoda) {
      if (part.attacks_count >= 5) {
        throw new Error('Anda telah mencapai batas maksimum serangan tambahan (soda) minggu ini (maksimal 5 kali serangan total)!');
      }
      const sodaQty = getItemQuantity(userId, guildId, 'SODA_ENERGY');
      if (sodaQty <= 0) {
        throw new Error('Anda kehabisan kuota serangan gratis! Anda butuh 🥤 Soda Energi Pet di inventory untuk menambah kuota.');
      }
      db.run("UPDATE pet_inventory SET quantity = quantity - 1 WHERE user_id = ? AND guild_id = ? AND item_id = 'SODA_ENERGY'", [userId, guildId]);
    } else {
      throw new Error('Kuota serangan gratis Anda minggu ini telah habis (3/3)! Konfirmasi penggunaan Soda Energi Pet untuk melakukan serangan tambahan.');
    }
  }

  // --- 5-ROUND COMBAT SIMULATION ---
  const logs = [];
  let petHP = petObj.health;
  let totalDmgDealt = 0;

  const speciesInfo = GACHA_SPECIES[petObj.pet_type];
  const specBaseAtk = speciesInfo ? (speciesInfo.baseAtk || 10) : 10;
  const petBaseAtk = specBaseAtk + petObj.level * 5 + (petObj.stat_str || 0) * 2;

  let petAtkMult = petObj.pet_type === 'DRAGON' ? 1.15 : 1.0;
  if (petObj.trait === 'WARRIOR') petAtkMult += 0.15;
  if (petObj.accessory === 'SWORD_TOY') petAtkMult += 0.15;
  petAtkMult += (petObj.base_atk_bonus_pct || 0.0);

  // Element Advantage
  const hasAdvantage = isElementAdvantage(petObj.gacha_element, boss.boss_type);
  if (hasAdvantage) {
    petAtkMult += 0.25;
    logs.push(`⭐ **Efek Elemen:** Elemen **${petObj.gacha_element}** pet Anda diuntungkan melawan elemen **${boss.boss_type}** Boss! (+25% ATK)`);
  }

  const specBaseDef = speciesInfo ? (speciesInfo.baseDef || 0) : 0;
  let petDefMult = 1.0;
  if (petObj.trait === 'STURDY') petDefMult *= 0.85;
  if (petObj.accessory === 'SHIELD_TOY') petDefMult *= 0.85;
  const petDefGym = Math.min(0.50, (petObj.stat_def || 0) * 0.005);
  const petDamageTakenMult = (1.0 - (specBaseDef / 100)) * petDefMult * (1.0 - (petObj.base_def_bonus_pct || 0.0)) * (1.0 - petDefGym);

  const petDex = petObj.stat_dex || 0;
  const petCritChance = Math.min(0.35, petDex * 0.005);

  logs.push(`⚔️ **Menyerbu World Boss!** **${petObj.pet_name}** maju menyerang **${boss.boss_name}**!`);

  for (let r = 1; r <= 5; r++) {
    // 1. Pet attacks Boss
    let dmg = Math.round(petBaseAtk * petAtkMult * (0.8 + Math.random() * 0.4));
    const isCrit = Math.random() < petCritChance;
    if (isCrit) {
      dmg = Math.round(dmg * 1.5);
    }
    totalDmgDealt += dmg;
    const critText = isCrit ? ' 💥 **CRITICAL HIT!**' : '';
    logs.push(` T.${r}: **${petObj.pet_name}** memberikan **${dmg} DMG**!${critText}`);

    // 2. Boss counter attacks
    const bossBaseAtk = 150 + r * 30; // Damage increases over rounds
    let bossDmg = Math.round(bossBaseAtk * (0.8 + Math.random() * 0.4));
    bossDmg = Math.round(bossDmg * petDamageTakenMult);

    petHP = Math.max(0, petHP - bossDmg);
    logs.push(` T.${r}: **${boss.boss_name}** menghempaskan pet Anda sebesar **${bossDmg} DMG**! (Sisa HP Pet: ${petHP})`);

    if (petHP <= 0) {
      logs.push(`🤕 **${petObj.pet_name}** terlalu lelah dan terkapar pingsan.`);
      break;
    }
  }

  // --- POST COMBAT ---
  // Update Boss HP in DB
  const newBossHp = Math.max(0, boss.current_hp - totalDmgDealt);
  const bossKilled = newBossHp === 0;
  const bossStatus = bossKilled ? 'DEFEATED' : 'ACTIVE';

  db.run(
    'UPDATE world_boss SET current_hp = ?, status = ? WHERE guild_id = ? AND week_start = ?',
    [newBossHp, bossStatus, guildId, weekStart]
  );

  // Update Participant
  db.run(
    `UPDATE world_boss_participants 
     SET damage_dealt = damage_dealt + ?, attacks_count = attacks_count + 1, last_attack_at = ? 
     WHERE user_id = ? AND guild_id = ? AND pet_name = ? AND week_start = ?`,
    [totalDmgDealt, Math.floor(Date.now() / 1000), userId, guildId, petObj.pet_name, weekStart]
  );

  // Decay Pet Stats: -15 Hunger, -15 Thirst, -10 Happiness
  const newHunger = Math.max(0, petObj.hunger - 15);
  const newThirst = Math.max(0, petObj.thirst - 15);
  const newHappiness = Math.max(0, petObj.happiness - 10);
  const finalHealth = petHP <= 0 ? 1 : petHP;
  const finalStatus = petHP <= 0 ? 'WEAK' : petObj.status;

  db.run(
    `UPDATE user_pets 
     SET hunger = ?, thirst = ?, happiness = ?, health = ?, status = ? 
     WHERE user_id = ? AND guild_id = ? AND pet_name = ?`,
    [newHunger, newThirst, newHappiness, finalHealth, finalStatus, userId, guildId, petObj.pet_name]
  );

  // If Boss killed, distribute rewards
  let distributeResult = null;
  if (bossKilled) {
    distributeResult = distributeWorldBossRewards(guildId, userId, weekStart);
  }

  db.logPetAction(guildId, userId, null, petObj.pet_name, 'WORLD_BOSS_ATTACK', `Menyerang World Boss ${boss.boss_name}. Damage: ${totalDmgDealt}. Boss Mati: ${bossKilled ? 'Ya' : 'Tidak'}`);
  return {
    bossName: boss.boss_name,
    totalDmgDealt,
    bossKilled,
    logs,
    petHP: finalHealth,
    distributeResult
  };
}

function distributeWorldBossRewards(guildId, lastHitUserId = null, targetWeekStart = null) {
  const weekStart = targetWeekStart || getWeekStartString();
  const boss = db.get('SELECT * FROM world_boss WHERE guild_id = ? AND week_start = ?', [guildId, weekStart]);
  if (!boss) return null;

  // Prevent multiple distributions
  if (boss.status === 'DISTRIBUTED') return null;

  // Update status to DISTRIBUTED
  db.run("UPDATE world_boss SET status = 'DISTRIBUTED' WHERE guild_id = ? AND week_start = ?", [guildId, weekStart]);

  const participants = db.all('SELECT * FROM world_boss_participants WHERE guild_id = ? AND week_start = ? ORDER BY damage_dealt DESC', [guildId, weekStart]);
  if (participants.length === 0) return { totalRewarded: 0 };

  const totalPart = participants.length;
  const rewardsList = [];

  participants.forEach((p, idx) => {
    // Determine Tier
    let tier = 'BRONZE';
    let rewardCoins = 0;
    const itemsGained = [];

    const goldLimit = Math.max(1, Math.round(totalPart * 0.1));
    const silverLimit = Math.max(2, Math.round(totalPart * 0.3));

    if (idx < goldLimit) {
      tier = 'GOLD';
      rewardCoins = Math.floor(Math.random() * (10000 - 6000 + 1)) + 6000;
      
      // 2x Ticket Gacha
      itemsGained.push({ itemId: 'TICKET_GACHA', quantity: 2, name: '🎟️ Tiket Gacha Pet' });
      // 15% Accessory chance
      if (Math.random() < 0.15) {
        const accs = ['COLLAR_IRON', 'SWORD_TOY', 'SHIELD_TOY'];
        const chosenAcc = accs[Math.floor(Math.random() * accs.length)];
        
        const activePet = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [p.user_id, guildId]);
        if (activePet && !activePet.accessory) {
          db.run('UPDATE user_pets SET accessory = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [chosenAcc, p.user_id, guildId, activePet.pet_name]);
          const accNames = { COLLAR_IRON: '🪮 Kalung Besi', SWORD_TOY: '⚔️ Pedang Mainan', SHIELD_TOY: '🛡️ Tameng Mainan' };
          itemsGained.push({ itemId: chosenAcc, quantity: 1, name: `${accNames[chosenAcc]} (Langsung Terpasang)` });
        } else {
          // Give compensation coin value
          const compCoins = 1500;
          rewardCoins += compCoins;
          itemsGained.push({ itemId: chosenAcc, quantity: 0, name: `Kompensasi Aksesoris (Sudah punya equip): +Rp 1.500 koin` });
        }
      }
    } else if (idx < silverLimit) {
      tier = 'SILVER';
      rewardCoins = Math.floor(Math.random() * (5000 - 3000 + 1)) + 3000;
      itemsGained.push({ itemId: 'TICKET_GACHA', quantity: 1, name: '🎟️ Tiket Gacha Pet' });
    } else {
      tier = 'BRONZE';
      rewardCoins = Math.floor(Math.random() * (2000 - 1000 + 1)) + 1000;
      itemsGained.push({ itemId: 'FOOD_PREMIUM', quantity: 1, name: '🥩 Daging Premium' });
    }

    // Add Boss Defeat Bonus
    if (boss.current_hp <= 0 || boss.status === 'DEFEATED' || boss.status === 'DISTRIBUTED') {
      rewardCoins += 2000;
    }

    // Add Last Hit Bonus
    const isLastHit = lastHitUserId && p.user_id === lastHitUserId;
    if (isLastHit) {
      rewardCoins += 3000;
      // Add title tag to pet
      const activePet = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [p.user_id, guildId]);
      if (activePet) {
        db.run('UPDATE user_pets SET pet_name = pet_name || " (Slayer)" WHERE user_id = ? AND guild_id = ? AND pet_name = ? AND pet_name NOT LIKE "%(Slayer)%"', [p.user_id, guildId, activePet.pet_name]);
      }
    }

    // Add Coins to Wallet
    economy.addBalance(p.user_id, guildId, rewardCoins, 'PET_RAID_REWARD');

    // Add Items to inventories
    itemsGained.forEach(item => {
      if (item.quantity > 0) {
        if (item.itemId === 'TICKET_GACHA') {
          const exist = db.get('SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?', [p.user_id, guildId, item.itemId]);
          if (exist) {
            db.run('UPDATE user_inventory SET quantity = quantity + ? WHERE user_id = ? AND guild_id = ? AND item_id = ?', [item.quantity, p.user_id, guildId, item.itemId]);
          } else {
            db.run('INSERT INTO user_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, ?, ?)', [p.user_id, guildId, item.itemId, item.quantity]);
          }
        } else if (item.itemId === 'FOOD_PREMIUM') {
          const exist = db.get('SELECT quantity FROM pet_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?', [p.user_id, guildId, item.itemId]);
          if (exist) {
            db.run('UPDATE pet_inventory SET quantity = quantity + ? WHERE user_id = ? AND guild_id = ? AND item_id = ?', [item.quantity, p.user_id, guildId, item.itemId]);
          } else {
            db.run('INSERT INTO pet_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, ?, ?)', [p.user_id, guildId, item.itemId, item.quantity]);
          }
        }
      }
    });

    rewardsList.push({
      userId: p.user_id,
      petName: p.pet_name,
      damage: p.damage_dealt,
      tier,
      coins: rewardCoins,
      items: itemsGained.map(i => `${i.quantity > 0 ? `${i.quantity}x ` : ''}${i.name}`).join(', '),
      isLastHit
    });
    db.logPetAction(guildId, p.user_id, null, p.pet_name, 'WORLD_BOSS_REWARD', `Menerima hadiah World Boss ${boss.boss_name} (${tier}). Koin: Rp ${rewardCoins.toLocaleString('id-ID')}${isLastHit ? ' (LAST HIT!)' : ''}. Hadiah: ${itemsGained.map(i => `${i.quantity > 0 ? `${i.quantity}x ` : ''}${i.name}`).join(', ')}`);
  });

  return {
    bossName: boss.boss_name,
    totalRewarded: totalPart,
    rewards: rewardsList
  };
}

function registerPetToRaid(userId, guildId, petName = null) {
  // Check if user has already registered a pet in this guild
  const existingReg = db.get('SELECT * FROM pet_raid_registrations WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
  if (existingReg) {
    throw new Error(`Anda sudah mendaftarkan pet **${existingReg.pet_name}** Anda ke Raid!`);
  }

  // Get pet
  let pet;
  if (!petName || petName.trim() === '') {
    pet = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [userId, guildId]);
    if (!pet) {
      throw new Error('Anda tidak memiliki pet aktif untuk didaftarkan! Silakan tentukan nama pet Anda.');
    }
  } else {
    pet = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [userId, guildId, petName]);
    if (!pet) {
      throw new Error(`Peliharaan bernama **${petName}** tidak ditemukan!`);
    }
  }

  if (pet.status !== 'ADULT') {
    throw new Error('Hanya pet dewasa (ADULT / Lv. 10+) yang bisa mendaftar Raid Boss!');
  }
  if (pet.level < 10) {
    throw new Error('Level pet minimal harus Lv. 10 untuk ikut Raid Boss!');
  }
  if (pet.health < 20 || pet.hunger < 20 || pet.thirst < 20) {
    throw new Error('Pet Anda terlalu lelah, lapar, atau haus (HP, Hunger, Thirst harus >= 20) untuk mendaftar Raid Boss!');
  }

  // Deduct fee: Rp 2.500
  const wallet = economy.getWallet(userId, guildId);
  if (wallet.coins < 2500) {
    throw new Error('Saldo Anda tidak mencukupi untuk biaya pendaftaran Raid Boss (Dibutuhkan Rp 2.500 koin)!');
  }

  economy.subtractBalance(userId, guildId, 2500, 'PET_RAID_REGISTER');
  db.run(
    'INSERT INTO pet_raid_registrations (guild_id, user_id, pet_name, registered_at) VALUES (?, ?, ?, ?)',
    [guildId, userId, pet.pet_name, Math.floor(Date.now() / 1000)]
  );

  db.logPetAction(guildId, userId, null, pet.pet_name, 'PET_RAID_REGISTER', `Mendaftarkan pet ke Raid Boss. Membayar biaya Rp 2.500.`);

  return {
    userId,
    guildId,
    petName: pet.pet_name,
    pet
  };
}

function executeWorldRaid(guildId) {
  const participants = db.all('SELECT * FROM pet_raid_registrations WHERE guild_id = ? ORDER BY registered_at ASC', [guildId]);
  if (participants.length < 3) {
    throw new Error(`Dibutuhkan minimal 3 pet terdaftar untuk memulai Raid Boss (Saat ini terdaftar: ${participants.length})!`);
  }
  if (participants.length > 5) {
    throw new Error(`Maksimal 5 pet terdaftar untuk satu sesi Raid Boss! (Saat ini terdaftar: ${participants.length})`);
  }

  const boss = getOrCreateWorldBoss(guildId);
  if (boss.status !== 'ACTIVE' || boss.current_hp <= 0) {
    throw new Error('World Boss sudah berhasil dikalahkan minggu ini!');
  }

  // Load pets data
  const team = [];
  let totalLevel = 0;
  for (const p of participants) {
    const pet = db.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [p.user_id, guildId, p.pet_name]);
    if (!pet) {
      throw new Error(`Pet **${p.pet_name}** milik salah satu peserta tidak ditemukan!`);
    }
    team.push({
      ...pet,
      currentHP: pet.health
    });
    totalLevel += pet.level;
  }

  const teamPower = Math.round(totalLevel / team.length);
  const recommendedLevel = boss.boss_type === 'DRAGON' ? 40 : 30;

  // Level Penalty
  const levelDiff = recommendedLevel - teamPower;
  const levelPenaltyPct = levelDiff > 0 ? Math.min(0.75, levelDiff * 0.05) : 0;
  const levelMult = 1.0 - levelPenaltyPct;

  // Session Boss HP
  const sessionBossHpMax = Math.round((15000 + teamPower * 500) * team.length);
  let sessionBossHp = sessionBossHpMax;

  const logs = [];
  logs.push(`⚔️ **Sesi Raid Dimulai!** Tim pet menyerang **${boss.boss_name}** (Recommended Level: ${recommendedLevel})!`);
  logs.push(`👥 **Jumlah Anggota Tim:** ${team.length} Pet (Rata-rata Level: ${teamPower})`);
  if (levelPenaltyPct > 0) {
    logs.push(`⚠️ **Penalti Level:** Level tim lebih rendah dari level rekomendasi Boss! (-${Math.round(levelPenaltyPct * 100)}% ATK)`);
  }

  let totalDamageDealt = 0;
  let lastHitUserId = null;
  let lastHitPetName = null;
  let victory = false;

  // 5-Turn Combat Simulator
  for (let turn = 1; turn <= 5; turn++) {
    logs.push(`\n**[ TURN ${turn} / 5 ]**`);
    
    // 1. Pets Attack
    for (const pet of team) {
      if (pet.currentHP <= 0) continue;

      const speciesInfo = GACHA_SPECIES[pet.pet_type];
      const specBaseAtk = speciesInfo ? (speciesInfo.baseAtk || 10) : 10;
      const petBaseAtk = specBaseAtk + pet.level * 5 + (pet.stat_str || 0) * 2;

      let petAtkMult = pet.pet_type === 'DRAGON' ? 1.15 : 1.0;
      if (pet.trait === 'WARRIOR') petAtkMult += 0.15;
      if (pet.accessory === 'SWORD_TOY') petAtkMult += 0.15;
      petAtkMult += (pet.base_atk_bonus_pct || 0.0);
      petAtkMult *= levelMult;

      // Element advantage against boss
      const hasAdvantage = isElementAdvantage(pet.gacha_element, boss.boss_type);
      if (hasAdvantage) {
        petAtkMult *= 1.25;
      }

      let dmg = Math.round(petBaseAtk * petAtkMult * (0.8 + Math.random() * 0.4));
      
      const petDex = pet.stat_dex || 0;
      const petCritChance = Math.min(0.35, petDex * 0.005);
      const isCrit = Math.random() < petCritChance;
      if (isCrit) {
        dmg = Math.round(dmg * 1.5);
      }

      sessionBossHp = Math.max(0, sessionBossHp - dmg);
      totalDamageDealt += dmg;

      let hitText = `🐾 **${pet.pet_name}** menyerang dan memberikan **${dmg} DMG**!`;
      if (hasAdvantage) hitText += ' (🔥 *Advantage!*)';
      if (isCrit) hitText += ' 💥 **CRITICAL HIT!**';
      logs.push(hitText);

      if (sessionBossHp <= 0) {
        lastHitUserId = pet.user_id;
        lastHitPetName = pet.pet_name;
        victory = true;
        break;
      }
    }

    if (victory) {
      logs.push(`\n🎉 **World Boss berhasil dikalahkan!**`);
      break;
    }

    // 2. Boss Attacks All Pets
    const bossBaseAtk = 120 + turn * 40;
    logs.push(`💥 **${boss.boss_name}** membalas dengan serangan area!`);
    
    for (const pet of team) {
      if (pet.currentHP <= 0) continue;

      const speciesInfo = GACHA_SPECIES[pet.pet_type];
      const specBaseDef = speciesInfo ? (speciesInfo.baseDef || 0) : 0;
      
      let petDefMult = 1.0;
      if (pet.trait === 'STURDY') petDefMult *= 0.85;
      if (pet.accessory === 'SHIELD_TOY') petDefMult *= 0.85;

      const petDefGym = Math.min(0.50, (pet.stat_def || 0) * 0.005);
      const petDamageTakenMult = (1.0 - (specBaseDef / 100)) * petDefMult * (1.0 - (pet.base_def_bonus_pct || 0.0)) * (1.0 - petDefGym);

      let bossDmg = Math.round(bossBaseAtk * (0.8 + Math.random() * 0.4));
      bossDmg = Math.round(bossDmg * petDamageTakenMult);

      pet.currentHP = Math.max(0, pet.currentHP - bossDmg);
      logs.push(` 💥 **${pet.pet_name}** menerima **${bossDmg} DMG** (Sisa HP: ${pet.currentHP}/${getMaxHP(pet)})`);

      if (pet.currentHP <= 0) {
        logs.push(` 🤕 **${pet.pet_name}** pingsan!`);
      }
    }

    // Check if whole team is down
    const aliveCount = team.filter(p => p.currentHP > 0).length;
    if (aliveCount === 0) {
      logs.push(`\n💀 **Seluruh tim telah gugur! Raid gagal.**`);
      break;
    }
  }

  if (!victory && sessionBossHp > 0) {
    logs.push(`\n⌛ **Waktu habis!** Pertarungan 5 turn berakhir dan World Boss masih berdiri (Sisa HP Boss: ${sessionBossHp}/${sessionBossHpMax}).`);
  }

  // --- POST COMBAT ---
  const rewardList = [];
  
  if (victory) {
    // Distribute Jackpot Rp 15,000 - Rp 35,000 divided equally
    const jackpot = Math.floor(Math.random() * (35000 - 15000 + 1)) + 15000;
    const share = Math.floor(jackpot / team.length);

    team.forEach(pet => {
      // Add balance
      economy.addBalance(pet.user_id, guildId, share, 'PET_RAID_WIN');

      // Add 1x MYSTERY_BOX_ANCIENT
      const exist = db.get("SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = 'MYSTERY_BOX_ANCIENT'", [pet.user_id, guildId]);
      if (exist) {
        db.run("UPDATE user_inventory SET quantity = quantity + 1 WHERE user_id = ? AND guild_id = ? AND item_id = 'MYSTERY_BOX_ANCIENT'", [pet.user_id, guildId]);
      } else {
        db.run("INSERT INTO user_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, 'MYSTERY_BOX_ANCIENT', 1)", [pet.user_id, guildId]);
      }

      rewardList.push({
        userId: pet.user_id,
        petName: pet.pet_name,
        coins: share,
        item: '🎁 Kotak Misteri Peliharaan Kuno'
      });

      db.logPetAction(guildId, pet.user_id, null, pet.pet_name, 'PET_RAID_WIN', `Menang Raid Boss ${boss.boss_name}. Menerima Rp ${share.toLocaleString('id-ID')} dan 1x MYSTERY_BOX_ANCIENT.`);
    });

    // Update global World Boss HP
    const newGlobalHp = Math.max(0, boss.current_hp - totalDamageDealt);
    const bossStatus = newGlobalHp === 0 ? 'DEFEATED' : 'ACTIVE';
    db.run(
      'UPDATE world_boss SET current_hp = ?, status = ? WHERE guild_id = ? AND week_start = ?',
      [newGlobalHp, bossStatus, guildId, boss.week_start]
    );

    // If global boss defeated, distribute global rewards as well
    if (newGlobalHp === 0) {
      distributeWorldBossRewards(guildId, lastHitUserId, boss.week_start);
    }
  }

  // HP consequences: all participating pets lose 80% of their MAX HP
  team.forEach(pet => {
    const maxHP = getMaxHP(pet);
    let newHealth = Math.max(0, pet.health - Math.round(maxHP * 0.8));

    let finalAccessory = pet.accessory;
    let finalStatus = pet.status;
    let savedBy = null;

    if (newHealth <= 0) {
      if (petHasTrait(pet, 'SURVIVOR')) {
        newHealth = 1;
        finalStatus = 'WEAK';
        savedBy = 'SURVIVOR';
      } else if (pet.accessory === 'LUCKY_AMULET') {
        newHealth = 20;
        finalStatus = pet.level >= 10 ? 'ADULT' : 'BABY';
        finalAccessory = ''; // Jimat hancur
        savedBy = 'LUCKY_AMULET';
      } else {
        newHealth = 0;
        finalStatus = 'DEAD';
      }
    } else if (newHealth < 20) {
      finalStatus = 'WEAK';
    }

    db.run(
      'UPDATE user_pets SET health = ?, status = ?, accessory = ? WHERE user_id = ? AND guild_id = ? AND pet_name = ?',
      [newHealth, finalStatus, finalAccessory, pet.user_id, guildId, pet.pet_name]
    );

    if (newHealth === 0 && finalStatus === 'DEAD') {
      db.logPetAction(guildId, pet.user_id, null, pet.pet_name, 'PET_RAID_DEATH', `Pet mati di pertempuran Raid Boss ${boss.boss_name}!`);
    } else if (savedBy) {
      db.logPetAction(guildId, pet.user_id, null, pet.pet_name, 'PET_RAID_SAVE', `Pet terselamatkan dari kematian di pertempuran Raid Boss ${boss.boss_name} oleh ${savedBy}.`);
    }
  });

  // Clear registrations
  db.run('DELETE FROM pet_raid_registrations WHERE guild_id = ?', [guildId]);

  return {
    bossName: boss.boss_name,
    victory,
    lastHitUserId,
    lastHitPetName,
    totalDamageDealt,
    rewards: rewardList,
    logs
  };
}

module.exports = {
  // Config & utils
  PET_ITEMS,

  PET_SPECIES,
  EXPEDITION_MAPS,
  GACHA_SPECIES,
  GACHA_RATES,
  GACHA_PRICES,
  RECYCLE_REWARD,
  STAR_UPGRADE_REQ,
  getStarBonuses,
  renderStars,
  getMaxHP,
  addXp,
  isGodPet,
  isMythicPet,
  petHasTrait,
  // Core
  getPet,
  adoptPet,
  resetPet,
  getInventory,
  buyItem,
  useItem,
  playWithPet,
  sendToWork,
  sendToHunt,
  executePvP,
  getPetsList,
  switchActivePet,
  breedPets,
  executeExpeditionQteFailure,
  calculateSuccessRate,
  executeExpedition,
  getXpNeeded,
  checkExpeditionLimit,
  getPetLeaderboard,
  setCustomImage,
  washPet,
  getOrCreateDailyQuests,
  incrementQuestProgress,
  claimDailyQuestReward,
  revivePet,
  useSodaEnergy,
  trainPet,
  getItemCooldown,
  setItemCooldown,
  unlockAutoCare,
  toggleAutoFeed,
  allocateStat,
  resetGymStats,
  // Gacha
  rollGacha,
  _rollOnce,
  saveGachaPet,
  recyclePet,
  getGachaTickets,
  addGachaTickets,
  // Upgrade Bintang
  upgradePetStar,
  getUpgradeRequirements,
  getPetSacrificeList,
  forceSetStar,
  // Menara Ujian & World Boss
  getWeekStartString,
  getTowerBoss,
  isElementAdvantage,
  getTowerState,
  climbTower,
  sweepTower,
  getOrCreateWorldBoss,
  attackWorldBoss,
  distributeWorldBossRewards,
  registerPetToRaid,
  executeWorldRaid,
};


