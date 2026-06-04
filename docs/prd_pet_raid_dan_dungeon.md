# Product Requirement Document (PRD)
## Fitur: Raid World Boss Mingguan (`.pet raid`) & Menara Ujian (`.pet tower`)

| Dokumen Info | Detail |
| --- | --- |
| **Status** | Draft (Proposed) |
| **Penulis** | Antigravity AI |
| **Tanggal Pembuatan** | 5 Juni 2026 |
| **Target Rilis** | Sprint 9 (Sistem Pertempuran Lanjutan & PVE End-Game) |
| **Target Platform** | Discord Bot (Sentinel Bot) |

---

## 1. Latar Belakang & Tujuan
Setelah diimplementasikannya fitur **Pusat Kebugaran Pet (`.pet gym`)** dan **Sistem Kustomisasi Stat**, pemain kini memiliki kontrol penuh terhadap alokasi status pet mereka (STR, VIT, DEF, DEX). Namun, saat ini utilitas pertempuran pet masih terbatas pada PvP Arena satu lawan satu dan ekspedisi peta statis. 

Untuk memperkaya ekosistem pet dan memberikan tantangan end-game yang menarik, diperlukan dua mode permainan baru:
1. **Raid World Boss Mingguan (`.pet raid`):** Mode pertempuran kooperatif (Co-op PVE) berskala server untuk menguji total kekuatan serangan pet seluruh server demi mendapatkan hadiah mingguan yang prestisius.
2. **Menara Ujian / Tower of Trials (`.pet tower`):** Mode pertempuran solo bertingkat (Solo PVE) dengan kesulitan yang meningkat secara bertahap untuk menguji keseimbangan stat pet dan kecocokan elemen guna mendapatkan hadiah sekali-selesai (*First Clear Reward*).

**Tujuan Fitur Ini:**
*   **Engagement & Retention:** Meningkatkan retensi pemain harian melalui batas tantangan menara dan mingguan melalui kemunculan World Boss.
*   **Sinergi Sistem Stat & Elemen:** Memberikan signifikansi nyata terhadap alokasi poin Gym dan Elemen bawaan pet (*FIRE*, *WATER*, *EARTH*, *DRAGON*) dalam skenario pertempuran taktis.
*   **Sinkronisasi Ekonomi (Money Sink & Source):** Menghadirkan keseimbangan ekonomi server dengan mengenakan biaya reset/tambahan tiket masuk menara (Money Sink) dan memberikan hadiah koin terukur (Money Source).

---

## 2. Spesifikasi Fitur 1: World Boss / Raid Mingguan (`.pet raid`)

World Boss adalah monster raksasa dengan HP jutaan yang muncul secara berkala di server. Seluruh pemain harus bahu-membahu melumpuhkannya sebelum batas waktu habis.

### 2.1 Jadwal Kemunculan & Atribut Boss
*   **Waktu Aktif:** Boss otomatis muncul setiap hari **Sabtu pukul 20:00 WIB** dan menghilang/berakhir pada hari **Minggu pukul 20:00 WIB** (Durasi 24 Jam).
*   **Jenis & Elemen:** Setiap minggu, bot akan memilih satu dari 4 variasi World Boss secara acak dengan elemen tertentu:
    1.  🌋 **Volcanus (Fire):** Sangat rentan terhadap serangan tipe *WATER* (+25% damage).
    2.  ⛰️ **Terrasaur (Earth):** Sangat rentan terhadap serangan tipe *FIRE* (+25% damage).
    3.  🌊 **Leviathan Core (Water):** Sangat rentan terhadap serangan tipe *EARTH* (+25% damage).
    4.  🌀 **Aetherius (Dragon):** Elemen kosmik netral, tidak memiliki kelemahan khusus, tetapi memiliki statistik pertahanan yang tinggi.
*   **Skala HP Boss:** HP dasar Boss diskalakan berdasarkan jumlah pemain aktif di server dengan formula:
    $$Max\_HP\_Boss = \text{Jumlah User Aktif} \times 250.000\text{ HP} \text{ (Minimal } 5.000.000\text{ HP)}$$

### 2.2 Mekanisme Sesi Serangan (`.pet raid attack`)
*   **Syarat Partisipasi:** Pet aktif harus sehat (HP > 20, Hunger > 20, Thirst > 20) dan berstatus `BABY` atau `ADULT`. Pet bertipe `EGG` atau `DEAD` tidak diperbolehkan bertempur.
*   **Batas Serangan Harian:** Pemain diberikan **3 kali kesempatan serangan gratis** selama periode aktif Boss.
*   **Konsumsi Decay:** Setiap melakukan serangan, status pet aktif akan berkurang:
    *   Hunger: $-15$ Poin
    *   Thirst: $-15$ Poin
    *   Happiness: $-10$ Poin
*   **Pengaruh Soda Energi (`SODA_ENERGY`):** Jika kesempatan serangan gratis sudah habis, pemain dapat menggunakan **1x Soda Energi Pet** dari `pet_inventory` untuk mendapatkan **+1 kesempatan serangan tambahan** (maksimal +2 pembelian/penggunaan tambahan per minggu).

### 2.3 Simulasi Pertempuran & Formula Damage
Pertarungan berjalan secara otomatis sepanjang **5 Turn** (5 putaran saling serang). Pet aktif menyerang terlebih dahulu, lalu Boss membalas.

1.  **Daya Serang Pet (Damage Dealt):**
    *   **Base ATK:** Dihitung dari level pet, spesies bawaan, dan alokasi poin *Strength* (STR).
    *   **Keunggulan Elemen:** Jika Elemen Pet mengalahkan Elemen Boss (misal Pet Air vs Boss Api), total damage dikalikan $1.25$ (+25% damage).
    *   **Serangan Kritis (Crit Rate):** Peluang serangan kritis dipengaruhi langsung oleh status *Dexterity* (DEX) pet dengan maksimal 35% peluang. Jika sukses, damage dikalikan $1.5$.
2.  **Pertahanan Pet (Damage Taken):**
    *   Setiap turn, Boss membalas serangan dengan damage dasar konstan yang meningkat sebesar +10% di setiap turn berikutnya (Turn 5 adalah yang tersulit).
    *   Damage yang diterima pet dikurangi berdasarkan alokasi status *Defense* (DEF) pet dengan batas reduksi maksimal 50% ($0.5\%$ reduksi per poin DEF).
    *   Jika HP pet mencapai 0 sebelum Turn 5 selesai, pet pingsan (status berubah menjadi `WEAK` dengan HP tersisa 1) dan pertarungan langsung dihentikan. Damage yang dicatat adalah damage kumulatif yang berhasil dikirim sebelum pingsan.

### 2.4 Sistem Hadiah (Raid Rewards)
Setelah Boss dikalahkan atau waktu habis pada Minggu pukul 20:00 WIB, hadiah didistribusikan secara otomatis berdasarkan peringkat kontribusi damage:

| Peringkat (Tier) | Kriteria Kontribusi | Hadiah Koin (Wallet) | Item Drops |
| --- | --- | --- | --- |
| 🥇 **Gold Tier** | Top 10% Damage Teratas | Rp 6.000 - Rp 10.000 | 2x `TICKET_GACHA` + 15% Peluang Aksesoris Acak |
| 🥈 **Silver Tier** | Top 11% - 30% Damage | Rp 3.000 - Rp 5.000 | 1x `TICKET_GACHA` |
| 🥉 **Bronze Tier** | Partisipasi (Min. 1 Attack) | Rp 1.000 - Rp 2.000 | 1x `FOOD_PREMIUM` |

*   **Bonus Kematian Boss (Defeat Bonus):** Jika HP Boss mencapai 0 sebelum batas waktu berakhir, seluruh pemain yang berpartisipasi mendapatkan bonus koin tambahan sebesar **Rp 2.000**.
*   **Last Hit Bonus:** Pemain yang pet-nya memberikan serangan terakhir hingga HP Boss menjadi 0 mendapatkan bonus instan **Rp 3.000** dan gelar visual `⚔️ World Boss Slayer` pada embed pet.

---

## 3. Spesifikasi Fitur 2: Menara Ujian / Tower of Trials (`.pet tower`)

Menara Ujian adalah tantangan PVE solo bertingkat. Pemain menantang monster penjaga lantai demi lantai untuk membuktikan ketangguhan pet mereka.

### 3.1 Struktur Lantai & Kesulitan
Menara terdiri dari **50 Lantai**. Setiap lantai memiliki bos statis dengan statistik yang meningkat:

| Rentang Lantai | Tingkat Kesulitan | Rekomendasi Level Pet | Elemen Musuh | Hadiah Utama (Koin) |
| --- | --- | --- | --- | --- |
| **Lantai 1 - 10** | Mudah (Easy) | Level 1 - 20 | Campuran | Rp 500 - Rp 1.500 |
| **Lantai 11 - 20** | Sedang (Medium) | Level 21 - 50 | Bergantian per Lantai | Rp 2.000 - Rp 4.500 |
| **Lantai 21 - 40** | Sulit (Hard) | Level 51 - 100 | Tipe Elemen Tunggal | Rp 5.000 - Rp 12.000 |
| **Lantai 41 - 50** | Ekstrim (Nightmare) | Level 101 - 150+ | *DRAGON* / Elemen Kontra | Rp 15.000 - Rp 50.000 |

*   Setiap lantai kelipatan 5 (5, 10, 15, ..., 50) adalah **Lantai Checkpoint (Lantai Boss)** dengan tingkat kesulitan yang jauh lebih tinggi dan menawarkan hadiah item langka selain koin.

### 3.2 Mekanisme Pemanjatan (`.pet tower climb`)
*   Pemain menantang lantai aktif saat ini.
*   Jika **Menang**, progres lantai pet tersebut bertambah 1 (`current_floor = current_floor + 1`), user menerima *First Clear Reward*, pet mendapatkan bonus XP besar, dan pet tidak menderita kerusakan HP.
*   Jika **Kalah**, progres tidak bertambah, pet kehilangan sebagian HP berdasarkan sisa serangan musuh (HP pet dapat berkurang hingga tersisa minimal 1 HP / pingsan).
*   **Batas Tantangan Harian:** Pemain dibatasi hanya dapat memanjat menara sebanyak **5 kali percobaan sukses/gagal per hari**.
*   **Mekanisme Reset Tiket (Money Sink):** Jika kuota 5 kali tantangan harian habis, pemain dapat membeli tambahan tiket tantangan seharga **Rp 500 koin** (potong dari dompet) atau menukarkan **1x Soda Energi Pet**.

### 3.3 Sistem Sapu Bersih (Sweep / Auto-Claim)
Pemain tidak perlu mengulang lantai yang sudah pernah mereka kalahkan setiap hari.
*   Pemain dapat memicu perintah **Sapu Bersih (`.pet tower sweep`)** sekali sehari.
*   **Kalkulasi Reward Sweep:** Memberikan **10%** dari total akumulasi hadiah koin dan XP dari seluruh lantai yang telah diselesaikan sebelumnya.
    *   *Contoh:* Jika pemain sudah menyelesaikan hingga Lantai 20 (total akumulasi hadiah kumulatif lantai 1-20 adalah Rp 25.000), maka hasil Sweep harian adalah `Rp 25.000 * 10% = Rp 2.500` koin secara instan.
*   **Syarat Sweep:** Pet harus dalam keadaan sehat dan bahagia (Hunger > 50%, Thirst > 50%, Happiness > 50%). Melakukan Sweep akan memotong Hunger dan Thirst pet masing-masing sebesar $-10$ poin.

---

## 4. Desain Database & Skema Tabel Baru

Untuk mendukung kedua fitur di atas, tabel baru berikut akan ditambahkan ke database `stockmarket/database.js` melalui migrasi:

```sql
-- 1. Tabel World Boss Aktif Mingguan
CREATE TABLE IF NOT EXISTS world_boss (
  guild_id TEXT NOT NULL,
  week_start TEXT NOT NULL,       -- Format: YYYY-WW (Contoh: '2026-23')
  boss_name TEXT NOT NULL,
  boss_type TEXT NOT NULL,       -- 'FIRE', 'WATER', 'EARTH', 'DRAGON'
  max_hp INTEGER NOT NULL,
  current_hp INTEGER NOT NULL,
  status TEXT DEFAULT 'ACTIVE',  -- 'ACTIVE', 'DEFEATED', 'EXPIRED'
  created_at INTEGER DEFAULT (strftime('%s','now')),
  PRIMARY KEY (guild_id, week_start)
);

-- 2. Tabel Partisipasi & Akumulasi Damage Pemain di World Boss
CREATE TABLE IF NOT EXISTS world_boss_participants (
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  pet_name TEXT NOT NULL,
  week_start TEXT NOT NULL,
  damage_dealt INTEGER DEFAULT 0,
  attacks_count INTEGER DEFAULT 0,
  last_attack_at INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, guild_id, pet_name, week_start)
);

-- 3. Tabel Progres Menara Ujian (Tower of Trials) Pemain
CREATE TABLE IF NOT EXISTS user_pet_tower (
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  current_floor INTEGER DEFAULT 1,      -- Lantai aktif saat ini (Mulai dari 1)
  daily_attempts INTEGER DEFAULT 0,     -- Jumlah percobaan memanjat hari ini
  last_attempt_date TEXT DEFAULT '',    -- Format: YYYY-MM-DD (Untuk reset kuota harian)
  last_sweep_date TEXT DEFAULT '',      -- Format: YYYY-MM-DD (Untuk membatasi sweep 1x sehari)
  created_at INTEGER DEFAULT (strftime('%s','now')),
  PRIMARY KEY (user_id, guild_id)
);
```

---

## 5. Integrasi UI/UX (Discord Embed Layout)

### 5.1 Dashboard Raid World Boss (`.pet raid`)
Menampilkan status Boss saat ini, damage kontribusi pemain, sisa kesempatan serang, dan sisa waktu aktif event.

```
🌋 WORLD BOSS EVENT: VOLCANUS 🌋
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🐾 Elemen: FIRE (Sangat rentan terhadap WATER!)
❤️ Health Boss: [██████░░░░] 6,240,000 / 10,000,000 HP (62.4%)
⏳ Waktu Tersisa: 14 Jam 22 Menit

📊 KONTRIBUSI ANDA:
• Pet Aktif: Ciko (Dragon Lv. 45)
• Total Damage Dikirim: 125,450 DMG
• Estimasi Peringkat: Silver Tier
• Sisa Kesempatan Menyerang: 🔴 2 Kali Lagi

💰 Biaya Tambah Kesempatan: 1x 🥤 Soda Energi Pet
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ ⚔️ Serang Boss ]  [ 🥤 Gunakan Soda ]  [ ❌ Tutup Panel ]
```

### 5.2 Dashboard Menara Ujian (`.pet tower`)
Menampilkan lantai aktif saat ini, statistik bos penjaga lantai, sisa kuota tantangan harian, dan tombol aksi Sweep.

```
🏰 MENARA UJIAN (TOWER OF TRIALS) 🏰
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🐾 Pet Anda: Ciko (Dragon Lv. 45)
🌟 Lantai Aktif Saat Ini: Lantai 15 (Boss Checkpoint)

👾 BOSS LANTAI 15: Golem Magma Raksasa
• ❤️ HP: 25,000 HP | ⚔️ ATK: 350 ATK
• 🛡️ Elemen: FIRE (Rekomendasi Pet tipe WATER)

🎫 Kuota Harian: 3/5 Percobaan Hari Ini
🎁 Hadiah Lantai Ini: Rp 3.000 + 1x Tiket Gacha Pet!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ ⚔️ Tantang Lantai 15 ]  [ 🧹 Sapu Bersih (Sweep) ]  [ ❌ Tutup ]
```

---

## 6. Kontrol Administratif Pet Raid & Tower (Admin Panel Actions)
Untuk keperluan pengujian, pemecahan masalah (troubleshooting), dan koordinasi event oleh moderator/admin, fitur ini diintegrasikan ke dalam Admin Control Panel Pet (`.pet admin` / `.pet-admin`).

### 6.1 Tindakan Administratif Baru (Select Menu Actions)
Opsi tindakan berikut ditambahkan pada menu pilihan panel admin pet:

1.  **Atur Lantai Menara Ujian (`action_admin_set_floor_modal`):**
    *   **Deskripsi:** Admin dapat memanipulasi lantai aktif (`current_floor` di tabel `user_pet_tower`) dari pet target secara instan melalui modal input angka.
    *   **Guna:** Mempermudah pengujian mekanika pertempuran di lantai-lantai tinggi tanpa harus memanjat satu per satu secara manual.

2.  **Reset Percobaan Menara Harian (`action_admin_reset_tower_attempts`):**
    *   **Deskripsi:** Mereset kolom `daily_attempts` kembali ke `0` untuk user target.
    *   **Guna:** Membantu pemain yang mengalami kegagalan/bug koneksi di tengah tantangan menara.

3.  **Spawn / Edit World Boss Instan (`action_admin_spawn_boss_modal`):**
    *   **Deskripsi:** Membuka modal berisi field:
        *   Nama Boss (Teks)
        *   Elemen Boss (FIRE, WATER, EARTH, DRAGON)
        *   HP Maksimal (Angka)
    *   **Guna:** Men-trigger kemunculan World Boss di luar jadwal resmi untuk tujuan testing atau event dadakan.

4.  **Kalahkan World Boss Paksa (`action_admin_kill_boss`):**
    *   **Deskripsi:** Mengubah HP World Boss aktif saat ini menjadi 0 secara instan.
    *   **Guna:** Menguji alur pembagian hadiah peringkat (Gold, Silver, Bronze) dan trigger pengiriman koin kemenangan.

---

## 7. Rencana Verifikasi & Pengujian

### 7.1 Uji Coba Otomatis (Simulation Script)
Membuat skrip simulasi di folder `scratch/` untuk menguji:
1.  **Simulasi Alur Tempur Boss:** Menjalankan pertempuran 5 turn antara pet dengan berbagai variasi stat STR, VIT, DEF, dan DEX melawan Boss. Memastikan damage reduction dan crit rate berfungsi tepat waktu.
2.  **Skenario Keuntungan Elemen:** Memvalidasi bahwa pet tipe Air (`Water`) menghasilkan damage +25% lebih besar ke Boss tipe Api (`Fire`).
3.  **Kalkulasi Akumulasi Sweep:** Menguji kecocokan nilai pengembalian koin hasil Sweep (10% dari akumulasi lantai sebelumnya).

### 7.2 Uji Coba Manual
1.  **Skenario Pemanjatan Menara:**
    *   Menjalankan `.pet tower` saat tidak memiliki pet aktif, memastikan bot membalas dengan pesan error yang tepat.
    *   Menjalankan `.pet tower climb`, memverifikasi pengurangan kuota harian dari 5 menjadi 4.
    *   Jika menang, pastikan kolom `current_floor` bertambah 1 di database dan saldo user bertambah sesuai nilai hadiah pertama kali.
2.  **Skenario Raid World Boss:**
    *   Memicu kemunculan World Boss lewat perintah admin.
    *   Menyerang Boss dengan pet lapar/sakit, pastikan ditolak.
    *   Menyerang Boss dengan pet sehat, pastikan status kelaparan dan kehausan berkurang setelah menyerang, dan damage terakumulasi di tabel `world_boss_participants`.
    *   Menggunakan `Soda Energi` saat kuota habis, memverifikasi kuota bertambah +1 dan item di `pet_inventory` berkurang 1.
3.  **Pengujian Admin Panel:**
    *   Membuka panel admin `.pet-admin`, memilih opsi **"Atur Lantai Menara Ujian"** dan memverifikasi lantai pet berubah instan.
    *   Memilih opsi **"Spawn World Boss"**, mengisi modal, dan memastikan Boss baru muncul di `.pet raid`.
    *   Memilih opsi **"Kalahkan World Boss Paksa"**, memverifikasi pembagian koin hadiah kepada seluruh partisipan secara akurat.

