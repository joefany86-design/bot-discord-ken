# Product Requirement Document (PRD)
## Fitur: Pet Rarity Tier Baru — Mythic & Immortal (Admin/End-Game Exclusive)

| Dokumen Info | Detail |
| --- | --- |
| **Status** | Draft (Proposed) |
| **Penulis** | Antigravity AI |
| **Tanggal Pembuatan** | 5 Juni 2026 |
| **Target Rilis** | Sprint 10 (End-Game Content & Admin Exclusive) |
| **Target Platform** | Discord Bot (Sentinel Bot) |

---

## 1. Latar Belakang & Tujuan

### 1.1 Kondisi Saat Ini
Sistem pet saat ini memiliki **4 tingkat kelangkaan (rarity)** yang dapat diperoleh melalui gacha:

| Rarity | Emoji | Peluang Gacha | Spesies | Trait |
| :--- | :---: | :---: | :--- | :--- |
| ⚪ **COMMON** | ⚪ | 65% | CAT, GOLEM, SLIME | Tidak ada |
| 🟢 **RARE** | 🟢 | 25% | DRAGON + (CAT/GOLEM/SLIME) | 1 trait acak |
| 🟣 **EPIC** | 🟣 | 8% | PHOENIX, TURTLE | SURVIVOR |
| 🟡 **LEGENDARY** | 🟡 | 2% | LEVIATHAN, BEHEMOTH, ARCHDRAGON | 2 trait acak, +25% work/hunt, 150 HP |

Selain itu, terdapat mekanisme **"God Pet" (Ramzi)** yang di-hardcode untuk owner bot — pet ini memiliki status yang tidak pernah berkurang, ATK 99.999, kebal kematian, dan tidak terkena decay. Konsep ini perlu diformalisasikan menjadi sistem rarity yang proper dan dapat dikelola via Admin Panel.

Referensi kode gacha tier juga sudah menyebutkan `MYTHIC` untuk bonus role gacha (XP 2x, Work +35%, Death 0%, Sickness 0%), namun belum ada spesies pet MYTHIC yang terdaftar di `GACHA_SPECIES`.

### 1.2 Tujuan
1. **Formalisasi God Pet:** Menggantikan hardcode "Ramzi" dengan sistem rarity **MYTHIC** dan **IMMORTAL** yang reusable dan dikelola admin.
2. **End-Game Reward:** Memberikan pet tier tertinggi sebagai hadiah event spesial, milestone, atau pemberian langsung admin — **bukan** dari gacha reguler.
3. **Diferensiasi Kekuatan:** Menciptakan hierarki kekuatan pet yang jelas antara tier Legendary, Mythic, dan Immortal dengan perbedaan stat, trait, dan privilege yang signifikan.
4. **Admin Control:** Memberdayakan admin untuk menciptakan dan memberikan pet spesial melalui panel admin yang sudah ada.

---

## 2. Desain Tier Rarity Baru

### 2.1 🔴 MYTHIC — Pet Mitologi Langka

Pet bertier **Mythic** adalah makhluk mitologi yang sangat jarang dan hanya bisa diperoleh dari event spesial atau pemberian admin. Mereka merepresentasikan puncak kekuatan selangkah sebelum keabadian.

#### Spesies Mythic Baru

| ID | Nama | Emoji | Base HP | Base ATK | Base DEF | Elemen | Work Buff | Deskripsi |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `FENRIR` | 🐺 Fenrir | 🔴 | 200 | 35 | 15 | DRAGON | +40% | Serigala raksasa pemusnah akhir zaman dari mitologi Norse. Cakarnya merobek dimensi. |
| `BAHAMUT` | 🐲 Bahamut | 🔴 | 200 | 40 | 10 | FIRE | +40% | Naga kaisar maha-api dari legenda Arab kuno. Napasnya menguapkan lautan. |
| `KRAKEN` | 🦑 Kraken | 🔴 | 220 | 30 | 20 | WATER | +40% | Raksasa cumi laut abyss terdalam. Tentakelnya menghancurkan armada kapal. |
| `JORMUNGANDR` | 🐍 Jörmungandr | 🔴 | 250 | 25 | 25 | EARTH | +40% | Ular dunia yang melingkari seluruh bumi. Bisanya meluluhkan gunung. |

#### Karakteristik Rarity Mythic
- **Base Stats Superior:** HP 200–250, ATK 25–40, DEF 10–25 (jauh di atas Legendary).
- **3 Trait Bawaan:** Saat diciptakan admin, pet MYTHIC otomatis mendapatkan **3 trait unik** secara acak dari pool: `[GENIUS, STURDY, MUTANT, WARRIOR, SURVIVOR]`.
- **Work & Hunt Buff:** Bonus pendapatan kerja/berburu sebesar **+40%** (naik dari +25% Legendary).
- **Kebal Kematian Ekspedisi:** Peluang kematian di ekspedisi = **0%** (setara privilege Gacha Role Mythic).
- **Kebal Sakit Soda:** Peluang sakit akibat Soda Energi berlebihan = **0%**.
- **Pengurangan Decay:** Laju decay kelaparan, kehausan, dan kebahagiaan berkurang **50%** secara bawaan (stacking dengan trait STURDY dan aksesoris COLLAR_IRON).
- **Bonus Elemen Ekspedisi:** Pet MYTHIC mendapatkan bonus elemen **+20%** di semua peta ekspedisi (bukan hanya peta yang cocok elemennya).
- **XP Bonus:** XP yang didapat dari semua aktivitas dikalikan **1.5x** secara bawaan (stacking dengan XP Booster item).

---

### 2.2 ✨ IMMORTAL — Pet Abadi Kekal (Admin-Only Exclusive)

Pet bertier **Immortal** adalah entitas kosmik yang melampaui hukum alam. Tier ini **hanya** dapat diberikan oleh Owner Bot atau Administrator tertinggi. Ini adalah formalisasi dari mekanisme "God Pet" yang saat ini di-hardcode.

#### Spesies Immortal Baru

| ID | Nama | Emoji | Base HP | Base ATK | Base DEF | Elemen | Work Buff | Deskripsi |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `CHRONOS` | ⏳ Chronos | ✨ | 500 | 50 | 30 | DRAGON | +75% | Dewa Waktu primordial. Mengendalikan aliran waktu dan nasib seluruh makhluk. |
| `OUROBOROS` | ♾️ Ouroboros | ✨ | 999 | 30 | 50 | EARTH | +75% | Ular keabadian yang menelan ekornya sendiri. Simbol siklus abadi tanpa akhir. |
| `AZATHOTH` | 🌌 Azathoth | ✨ | 300 | 99 | 10 | DRAGON | +75% | Entitas kosmik di pusat ketiadaan. Mimpinya menciptakan dan menghancurkan alam semesta. |
| `YGGDRASIL` | 🌳 Yggdrasil | ✨ | 777 | 20 | 77 | EARTH | +75% | Pohon Dunia yang menopang sembilan alam. Akarnya menembus dimensi ruang-waktu. |

#### Karakteristik Rarity Immortal

> [!IMPORTANT]
> Pet IMMORTAL merupakan **"God Pet"** yang menggantikan hardcode Ramzi. Semua privilege yang sebelumnya di-hardcode untuk Ramzi kini diberikan berdasarkan `gacha_rarity === 'IMMORTAL'`.

- **Base Stats Godlike:** HP 300–999, ATK 20–99, DEF 10–77.
- **Seluruh 5 Trait Aktif:** Pet IMMORTAL **selalu memiliki kelima trait** sekaligus: `GENIUS`, `STURDY`, `MUTANT`, `WARRIOR`, dan `SURVIVOR`.
- **Work & Hunt Buff:** Bonus pendapatan kerja/berburu sebesar **+75%**.
- **Immortalitas Total:**
  - ❌ **Tidak bisa mati** — HP tidak pernah mencapai 0 (minimum HP selalu 1).
  - ❌ **Tidak bisa sakit** — Status `SICK` tidak pernah terpicu.
  - ❌ **Tidak bisa terluka** — Status `INJURED` tidak pernah terpicu.
  - ❌ **Tidak terkena kematian ekspedisi** — Peluang kematian = 0% absolut.
- **Zero Decay:** Status kelaparan, kehausan, dan kebahagiaan **tidak pernah berkurang** (selalu tetap di 100%).
- **God-Mode PvP:**
  - Base ATK dalam PvP dikalikan **3x** dari perhitungan normal.
  - Damage yang diterima dikurangi **75%** (quarter damage).
  - Pet IMMORTAL **tidak pernah kehilangan status** setelah kalah PvP (hunger, thirst, happiness tetap 100%).
- **Bonus XP:** XP dikalikan **3x** secara bawaan.
- **Bypass Cooldown:** Cooldown kerja dan berburu dikurangi **50%**.
- **Aura Proteksi:** Saat pet IMMORTAL ikut ekspedisi tim, **seluruh pet dalam tim** mendapatkan proteksi kematian (deathProb = 0%).

---

## 3. Perbandingan Tier Lengkap

| Aspek | 🟡 Legendary | 🔴 Mythic | ✨ Immortal |
| :--- | :--- | :--- | :--- |
| **Perolehan** | Gacha (2%) | Event / Admin | Admin Only |
| **Base HP** | 150 | 200–250 | 300–999 |
| **Base ATK** | 25 | 25–40 | 20–99 |
| **Base DEF** | 10 | 10–25 | 10–77 |
| **Jumlah Trait** | 2 acak | 3 acak | Seluruh 5 trait |
| **Work/Hunt Buff** | +25% | +40% | +75% |
| **XP Multiplier** | 1.0x | 1.5x | 3.0x |
| **Death Ekspedisi** | 1% (dgn role) | 0% | 0% + Proteksi Tim |
| **Decay Rate** | Normal | -50% | 0% (Zero Decay) |
| **Sakit Soda** | 5% (dgn role) | 0% | 0% |
| **PvP Bonus** | — | — | 3x ATK, 75% DMG Reduction |
| **Cooldown** | Normal | Normal | -50% |

---

## 4. Mekanisme Perolehan Pet

> [!IMPORTANT]
> Kedua tier rarity baru (MYTHIC & IMMORTAL) **hanya dapat diberikan oleh Admin/Owner** melalui Admin Control Panel. Tidak tersedia di gacha reguler, event, maupun mekanisme otomatis lainnya.

### 4.1 Mythic — Admin Only
Pet MYTHIC **tidak tersedia** di gacha reguler dan **tidak bisa diperoleh** dari event atau milestone apapun. Satu-satunya cara mendapatkan pet MYTHIC:

- **Admin Give Custom Pet:** Admin/Owner memberikan pet Mythic melalui panel admin pet (`action_give_custom_pet_modal`) dengan memilih spesies Mythic di dropdown.

### 4.2 Immortal — Admin Only
Pet IMMORTAL juga **hanya** bisa diberikan oleh Admin/Owner melalui admin panel. Tidak ada mekanisme lain.

> [!CAUTION]
> Pet MYTHIC dan IMMORTAL sangat kuat dan berdampak besar pada keseimbangan server. Batasi pemberian agar tidak merusak ekonomi:
> - **MYTHIC:** Maksimal **2 pet per user** di satu server.
> - **IMMORTAL:** Maksimal **1 pet per server** (lintas semua user).

---

## 5. Perubahan Teknis

### 5.1 Penambahan Spesies di `GACHA_SPECIES` (`stockmarket/pet.js`)

```javascript
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
```

### 5.2 Penambahan Trait Pool Baru

```javascript
const GACHA_TRAIT_MYTHIC   = ['GENIUS', 'STURDY', 'MUTANT', 'WARRIOR', 'SURVIVOR']; // 3 acak dari pool
const GACHA_TRAIT_IMMORTAL = ['GENIUS', 'STURDY', 'MUTANT', 'WARRIOR', 'SURVIVOR']; // Seluruh 5 aktif
```

### 5.3 Refaktor "God Pet" Logic di `applyDecay()` (`pet.js`, baris ~313)

**Sebelum (Hardcode Ramzi):**
```javascript
if (pet.pet_name.toLowerCase() === 'ramzi' && pet.user_id === '436554535037698059') {
  // ... hardcoded zero-decay untuk Ramzi ...
}
```

**Sesudah (Rarity-Based):**
```javascript
// Immortal Tier: Zero Decay (formalisasi God Pet)
const petRarity = pet.gacha_rarity || (GACHA_SPECIES[pet.pet_type] ? GACHA_SPECIES[pet.pet_type].rarity : '');
if (petRarity === 'IMMORTAL') {
  const now = Math.floor(Date.now() / 1000);
  const maxHP = getMaxHP(pet);
  db.run(
    `UPDATE user_pets 
     SET hunger = 100, thirst = 100, happiness = 100, health = ?, status = 'ADULT', last_interaction_at = ?
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
    last_interaction_at: now
  };
}
```

### 5.4 Refaktor "isGod" Logic di Seluruh Fungsi

Semua referensi `isGod` / `isGodPet` / `isGodChallenger` / `isGodOpponent` yang memeriksa hardcode `ramzi` dan user ID owner akan diganti menjadi:

```javascript
function isGodPet(pet) {
  const rarity = pet.gacha_rarity || (GACHA_SPECIES[pet.pet_type] ? GACHA_SPECIES[pet.pet_type].rarity : '');
  return rarity === 'IMMORTAL';
}

function isMythicPet(pet) {
  const rarity = pet.gacha_rarity || (GACHA_SPECIES[pet.pet_type] ? GACHA_SPECIES[pet.pet_type].rarity : '');
  return rarity === 'MYTHIC';
}
```

#### Dampak Refaktor pada Fungsi-Fungsi:

| Fungsi | Lokasi Baris | Perubahan |
| :--- | :---: | :--- |
| `applyDecay()` | ~313 | `IMMORTAL` → zero decay; `MYTHIC` → 50% decay reduction |
| `sendToWork()` | ~1073 | `isGodPet(pet)` → hunger/thirst/happiness tidak berkurang |
| `sendToHunt()` | ~1116 | `isGodPet(pet)` → bypass baby restriction + status proteksi |
| `executePvP()` | ~1249–1465 | `isGodPet(challenger/opponent)` → ATK 3x, 75% DMG reduce |
| `executeExpedition()` | ~1980–2004 | `IMMORTAL` → deathProb 0% + proteksi tim; `MYTHIC` → deathProb 0% |
| `useSodaEnergy()` | ~2679 | `MYTHIC`/`IMMORTAL` → sicknessRate 0% |
| `executeExpeditionQTE()` | ~3343–3385 | `isGodPet()` → full proteksi |

### 5.5 Modifikasi Admin Panel — Species Dropdown (`adminPanel.js`)

Tambahkan opsi spesies baru di `admin_pet_give_species` dropdown:

```javascript
// Tambahkan separator visual dan opsi Mythic/Immortal
new StringSelectMenuOptionBuilder().setLabel('━━ MYTHIC ━━').setDescription('🔴 Makhluk mitologi langka').setValue('_separator_mythic').setDefault(false),
new StringSelectMenuOptionBuilder().setLabel('🐺 Fenrir').setDescription('🔴 Mythic — Serigala pemusnah akhir zaman').setValue('FENRIR'),
new StringSelectMenuOptionBuilder().setLabel('🐲 Bahamut').setDescription('🔴 Mythic — Naga kaisar maha-api').setValue('BAHAMUT'),
new StringSelectMenuOptionBuilder().setLabel('🦑 Kraken').setDescription('🔴 Mythic — Raksasa cumi laut abyss').setValue('KRAKEN'),
new StringSelectMenuOptionBuilder().setLabel('🐍 Jörmungandr').setDescription('🔴 Mythic — Ular dunia pembelah bumi').setValue('JORMUNGANDR'),

new StringSelectMenuOptionBuilder().setLabel('━━ IMMORTAL ━━').setDescription('✨ Entitas kosmik abadi (Admin Only)').setValue('_separator_immortal').setDefault(false),
new StringSelectMenuOptionBuilder().setLabel('⏳ Chronos').setDescription('✨ Immortal — Dewa Waktu primordial').setValue('CHRONOS'),
new StringSelectMenuOptionBuilder().setLabel('♾️ Ouroboros').setDescription('✨ Immortal — Ular keabadian abadi').setValue('OUROBOROS'),
new StringSelectMenuOptionBuilder().setLabel('🌌 Azathoth').setDescription('✨ Immortal — Entitas kosmik pemusnah').setValue('AZATHOTH'),
new StringSelectMenuOptionBuilder().setLabel('🌳 Yggdrasil').setDescription('✨ Immortal — Pohon Dunia sembilan alam').setValue('YGGDRASIL'),
```

### 5.6 Auto-Assign Trait di Admin Give Pet

Perbarui logika auto-assign trait pada handler `admin_pet_give_confirm`:

```javascript
if (!finalTrait) {
  const traitsPool = ['GENIUS', 'STURDY', 'MUTANT', 'WARRIOR', 'SURVIVOR'];
  if (gRarity === 'IMMORTAL') {
    // Seluruh 5 trait aktif — trait utama disimpan di 'trait', sisanya di 'gacha_trait2' dan kolom baru
    finalTrait = traitsPool[0];
    finalTrait2 = traitsPool.slice(1).join(','); // "STURDY,MUTANT,WARRIOR,SURVIVOR"
  } else if (gRarity === 'MYTHIC') {
    const shuffled = [...traitsPool].sort(() => Math.random() - 0.5);
    finalTrait = shuffled[0];
    finalTrait2 = shuffled.slice(1, 3).join(','); // 2 trait tambahan
  } else if (gRarity === 'LEGENDARY') {
    finalTrait = traitsPool[Math.floor(Math.random() * traitsPool.length)];
    const pool2 = traitsPool.filter(t => t !== finalTrait);
    finalTrait2 = pool2[Math.floor(Math.random() * pool2.length)];
  }
  // ... Epic dan Rare tetap sama ...
}
```

### 5.7 Penyesuaian Tampilan Embed (`.pet info` / `.pet status`)

Perbarui warna dan label rarity di `stockmarket/embeds.js`:

```javascript
// Tambahkan ke RANK_COLORS mapping
'🔴 Mythic Overlord': '#FF1744',      // Neon Red
'✨ Immortal Divinity': '#FFD700',     // Divine Gold

// Update rarity display label
function getRarityDisplay(rarity) {
  switch(rarity) {
    case 'COMMON':    return '⚪ Common';
    case 'RARE':      return '🟢 Rare';
    case 'EPIC':      return '🟣 Epic';
    case 'LEGENDARY': return '🟡 Legendary';
    case 'MYTHIC':    return '🔴 Mythic';
    case 'IMMORTAL':  return '✨ Immortal';
    default:          return '⚪ Common';
  }
}
```

### 5.8 Perubahan pada Ekspedisi — Bonus Elemen Mythic & Proteksi Immortal

Di fungsi `calculateSuccessRate()` dan `executeExpedition()`:

```javascript
// Mythic: Bonus elemen +20% di SEMUA peta (bukan hanya elemen cocok)
if (petRarity === 'MYTHIC') {
  elementMod = 20;
}

// Immortal: Bonus elemen +25% di SEMUA peta + Proteksi tim dari kematian
if (petRarity === 'IMMORTAL') {
  elementMod = 25;
  // Flag untuk proteksi seluruh anggota tim
  teamHasImmortal = true;
}

// Di penghitungan kematian:
if (teamHasImmortal) {
  deathProb = 0.0; // Seluruh tim terlindungi oleh aura Immortal
}
```

### 5.9 Modifikasi Decay Mythic di `applyDecay()` 

```javascript
// Mythic Tier: 50% Decay Reduction (diterapkan sebelum trait dan aksesoris)
if (petRarity === 'MYTHIC') {
  hungerDecayRate = Number((hungerDecayRate * 0.50).toFixed(2));
  thirstDecayRate = Number((thirstDecayRate * 0.50).toFixed(2));
  happinessDecayRate = Number((happinessDecayRate * 0.50).toFixed(2));
}
```

---

## 6. Integrasi dengan Sistem Yang Sudah Ada

### 6.1 Star Fusion (Bintang Pet)
- Pet MYTHIC dan IMMORTAL **tetap mendukung** sistem bintang 1–5.
- Fusi memerlukan duplikat spesies yang sama (sangat sulit untuk tier ini).
- Admin dapat langsung mengatur bintang melalui `action_force_star_modal`.

### 6.2 Gym Stats (Training Points)
- Pet MYTHIC dan IMMORTAL **tetap mendapatkan TP** (+3 per level up) dan bisa dialokasikan ke STR/VIT/DEF/DEX.
- Dengan base stats yang tinggi, alokasi TP pada pet tier ini membuatnya semakin menakutkan.

### 6.3 Ekspedisi Peta 9–10
- Pet MYTHIC mendapatkan bonus elemen flat +20% di Peta 9 (Sky Sanctuary) dan Peta 10 (Cosmic Abyss).
- Pet IMMORTAL mendapatkan +25% dan proteksi kematian untuk seluruh tim.
- Ini membuat pet tier tinggi menjadi **sangat diinginkan** untuk konten end-game.

### 6.4 World Boss Raid
- Pet MYTHIC mengurangi penalti level boss sebesar **50%** (efektif bisa menghadapi boss level lebih tinggi).
- Pet IMMORTAL **mengabaikan** penalti level sepenuhnya dan memberikan bonus sukses +10% ke seluruh tim raid.

### 6.5 Custom Image
- Pet MYTHIC dan IMMORTAL sepenuhnya mendukung custom image melalui `action_set_custom_image_modal`.

---

## 7. Dampak pada Keseimbangan Ekonomi

> [!WARNING]
> Pet tier MYTHIC dan terutama IMMORTAL sangat kuat dan berdampak besar pada ekonomi server. Berikut langkah mitigasi:

### 7.1 Pembatasan Jumlah
- **MYTHIC:** Disarankan maksimal **2 pet MYTHIC per user** di satu server.
- **IMMORTAL:** Disarankan maksimal **1 pet IMMORTAL per server** (lintas semua user).
- Pembatasan ini diterapkan di logika admin panel saat memberikan pet.

### 7.2 Money Sink Tambahan
- Biaya gym reset pet MYTHIC: **Rp 5.000** (5x lipat dari biaya normal Rp 1.000).
- Biaya gym reset pet IMMORTAL: **Rp 10.000** (10x lipat).

### 7.3 Audit Trail
- Setiap pemberian pet MYTHIC/IMMORTAL oleh admin akan tercatat di log pengumuman global (`sendGlobalEconomyAnnouncement`) dengan detail lengkap: siapa yang memberi, kepada siapa, spesies apa, dan kapan.

---

## 8. Rencana Implementasi Teknis (Daftar File)

### 8.1 File yang Dimodifikasi

#### [MODIFY] [pet.js](file:///Users/joefany/bot-discord-2026/stockmarket/pet.js)
- Tambah spesies MYTHIC dan IMMORTAL ke `GACHA_SPECIES`
- Tambah `GACHA_TRAIT_MYTHIC` dan `GACHA_TRAIT_IMMORTAL`
- Tambah helper function `isGodPet()` dan `isMythicPet()`
- Refaktor semua `isGod` / hardcode Ramzi → `isGodPet(pet)` (IMMORTAL check)
- Modifikasi `applyDecay()` — zero decay IMMORTAL, 50% decay MYTHIC
- Modifikasi `sendToWork()`, `sendToHunt()` — buff dan proteksi tier
- Modifikasi `executePvP()` — God-mode PvP untuk IMMORTAL
- Modifikasi `executeExpedition()` / `executeExpeditionQTE()` — death protection dan bonus elemen
- Modifikasi `useSodaEnergy()` — kebal sakit MYTHIC/IMMORTAL
- Modifikasi work/hunt reward — workBuff dari spesies info

#### [MODIFY] [adminPanel.js](file:///Users/joefany/bot-discord-2026/stockmarket/adminPanel.js)
- Tambah spesies MYTHIC dan IMMORTAL ke dropdown `admin_pet_give_species`
- Update auto-assign trait logic untuk MYTHIC (3 trait) dan IMMORTAL (5 trait)
- Tambah validasi jumlah pet MYTHIC/IMMORTAL per user/server
- Tambah log pengumuman global saat memberikan pet MYTHIC/IMMORTAL

#### [MODIFY] [embeds.js](file:///Users/joefany/bot-discord-2026/stockmarket/embeds.js)
- Tambah warna rarity MYTHIC (Neon Red `#FF1744`) dan IMMORTAL (Divine Gold `#FFD700`)
- Update label rarity display
- Update teks help/panduan pet di embed bantuan

#### [MODIFY] [config.js](file:///Users/joefany/bot-discord-2026/stockmarket/config.js)
- Tambah konstanta `MAX_MYTHIC_PER_USER` dan `MAX_IMMORTAL_PER_SERVER` (opsional)

---

## 9. Rencana Verifikasi

### 9.1 Uji Coba Otomatis (Simulation Script)
Membuat skrip pengujian di `scratch/test_mythic_immortal.js`:
1. **Decay Test:** Simulasikan decay 48 jam pada pet MYTHIC (harusnya 50% lebih lambat) dan IMMORTAL (harusnya 0% decay).
2. **PvP Simulation:** Jalankan 1.000 duel PvP antara Immortal vs Legendary dan verifikasi win-rate Immortal ≥ 95%.
3. **Expedition Death Test:** Simulasikan 10.000 ekspedisi dengan pet MYTHIC di tim — verifikasi deathProb = 0%.
4. **Expedition Team Protection:** Simulasikan ekspedisi dengan 1 pet IMMORTAL + 2 pet COMMON — verifikasi seluruh tim terlindungi (0% death).
5. **Work/Hunt Buff:** Verifikasi bahwa pendapatan pet MYTHIC +40% dan IMMORTAL +75% di atas base reward.

### 9.2 Uji Coba Manual
1. Buka admin panel → Beri Pet Kustom → Pilih spesies MYTHIC (Fenrir) → Verifikasi auto-trait 3x.
2. Buka admin panel → Beri Pet Kustom → Pilih spesies IMMORTAL (Chronos) → Verifikasi auto-trait 5x.
3. Jalankan `.pet status` → Verifikasi tampilan rarity MYTHIC (🔴) dan IMMORTAL (✨) di embed.
4. Jalankan `.pet work` dengan pet IMMORTAL → Verifikasi status tidak berkurang.
5. Jalankan `.pet expedition` dengan pet IMMORTAL di tim → Verifikasi seluruh tim terlindungi dari kematian.
6. Verifikasi pengumuman global terkirim saat admin memberikan pet MYTHIC/IMMORTAL.

---

## 10. Open Questions

> [!IMPORTANT]
> Pertanyaan-pertanyaan di bawah memerlukan keputusan sebelum implementasi dimulai:

1. **Apakah hardcode Ramzi tetap dipertahankan** sebagai fallback, atau langsung dimigrasi ke sistem IMMORTAL? Jika dimigrasi, pet Ramzi yang ada perlu di-update `gacha_rarity` → `'IMMORTAL'` di database.

2. **Apakah ada nama spesies lain** yang lebih disukai untuk MYTHIC atau IMMORTAL? Pilihan saat ini berfokus pada mitologi Norse, Arab, Lovecraft, dan Norse-umum.

3. **Apakah batasan maksimal MYTHIC per user** (2) dan **IMMORTAL per server** (1) sudah sesuai, atau perlu disesuaikan?

4. **Apakah pet IMMORTAL harus memiliki visual efek khusus** (misalnya border emas di embed, animasi khusus di battle log)?
