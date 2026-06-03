# Product Requirement Document (PRD)
## Fitur: Uncapped Pet Level & 10 Peta Ekspedisi Baru

| Dokumen Info | Detail |
| --- | --- |
| **Status** | Draft (Proposed) |
| **Penulis** | Antigravity AI |
| **Tanggal Pembuatan** | 3 Juni 2026 |
| **Target Rilis** | Sprint 7 (Sistem Leveling & Co-op PvE) |
| **Target Platform** | Discord Bot (Sentinel Bot) |

---

## 1. Latar Belakang & Tujuan
Untuk memberikan tantangan jangka panjang (end-game content) bagi para pemain, batasan tingkat level hewan peliharaan (*pet level*) akan ditiadakan (*uncapped*). Pemain dapat melatih pet mereka hingga level setinggi-tingginya tanpa batas buatan.

Seiring dengan tidak terbatasnya level pet, sistem ekspedisi kelompok (*Co-op PvE*) juga perlu dikembangkan. Peta ekspedisi yang sebelumnya hanya berjumlah 4 akan diekspansi menjadi **10 Peta Ekspedisi**. Peta-peta baru ini dirancang dengan peningkatan tingkat kesulitan (rekomendasi level) dan imbalan (*rewards*) yang menarik untuk mengakomodasi pet dengan level sangat tinggi.

---

## 2. Deskripsi Fitur & Perubahan Sistem

### 2.1 Penghapusan Batas Level Pet (Uncapped Pet Level)
* **Mekanisme Leveling:** Pet dapat terus naik level secara tidak terbatas.
* **Perhitungan Kebutuhan XP:** Rumus kebutuhan XP per level tetap konsisten menggunakan formula dinamis:
  $$XP\_Needed = Level \times 100$$
  * *Pengecualian (Genius Trait):* Pet dengan trait `GENIUS` mendapatkan potongan 20% kebutuhan XP, sehingga rumusnya menjadi:
    $$XP\_Needed = Level \times 80$$
* **Peningkatan Status Tempur PvP:**
  * Base Attack pet akan bertambah sebesar **+5 ATK** per level:
    $$Base\_ATK = Species\_Base\_ATK + (Level \times 5)$$
  * Hal ini membuat peningkatan level di atas level 50 tetap sangat berdampak bagi kekuatan duel pet di PvP Arena.

### 2.2 Dampak pada Ekspedisi Tim (Team Power & Level Difference)
* **Team Power:** Dihitung dari jumlahan level seluruh pet yang berpartisipasi dalam ekspedisi.
* **Modifikasi Peluang Sukses Berdasarkan Level:**
  * Jika level pet di bawah *Recommended Level* peta, pet akan mendapatkan penalti peluang sukses sebesar **-3% per level selisih**. Jika selisihnya $\ge 10$ level, ditambahkan penalti flat sebesar **-30%**.
  * Jika level pet di atas *Recommended Level* peta, pet akan mendapatkan bonus peluang sukses sebesar **+1% per level selisih** (maksimal bonus +15% per pet).

### 2.3 Penyesuaian pada Admin Control Panel (Uncapped Admin Level Inputs)
Untuk mendukung pet level tanpa batas, batas input level pet pada panel admin (maksimal level 100) akan dihapus:
* **Ubah Level Pet (`action_set_level_pet_modal`):** Logika validasi input level ditiadakan batas atasnya. Label input diubah dari `Level Pet (1 - 100)` menjadi `Level Pet (Min: 1)` dan validasi hanya membatasi `level >= 1` (angka bulat positif).
* **Beri Pet Kustom (`action_give_custom_pet_modal`):** Batasan clamping `Math.min(100, pLevel)` dihapus sehingga admin bisa membuat pet baru dengan level awal di atas 100. Label input diubah dari `Level Awal (1 - 100)` menjadi `Level Awal (Min: 1)`.

### 2.4 Sistem Drop Item Acak (Random Expedition Item Rewards)
Pemain yang sukses menyelesaikan ekspedisi berkesempatan mendapatkan drop item acak dari seluruh pool item game bot:
* **Peluang Drop:** Tetap di kisaran **20% per pet** yang sukses kembali dari ekspedisi.
* **Pool Item Hadiah:**
  * **Black Market (BM):** `LOCKPICK`, `MASK`, `MEAT`, `SOAP`, `BRANKAS` (disimpan ke `user_inventory`).
  * **Tiket Gacha Pet:** `TICKET_GACHA` (disimpan ke `user_inventory`).
  * **Bunga & Benih (Garden):** Benih bunga (`SEED_ROSE`, `SEED_TULIP`, `SEED_LAVENDER`, `SEED_SAKURA`, `SEED_ORCHID`), bunga panen (`FLOWER_ROSE`, `FLOWER_TULIP`, `FLOWER_LAVENDER`, `FLOWER_SAKURA`, `FLOWER_ORCHID`), serta `GIFT_WRAPPING` (disimpan ke `user_inventory`).
  * **Makanan & Perawatan (Pet Shop):** `FOOD_BASIC`, `FOOD_PREMIUM`, `WATER`, `MEDICINE`, `TOY`, `SODA_ENERGY`, `SOAP_PET` (disimpan ke `pet_inventory`).
* **Sistem Penyimpanan:** Sistem mendeteksi secara dinamis tabel tujuan item untuk meminimalkan bug database.

---



## 3. Spesifikasi 10 Peta Ekspedisi
Berikut adalah rancangan 10 peta ekspedisi (termasuk 4 peta lama yang disesuaikan tingkat kesulitannya dan 6 peta baru):

| ID Peta | Nama Peta | Rekomendasi Level | Peluang Sukses Dasar | Rentang Hadiah (Koin) | Elemen Utama | Bos Peta | Deskripsi |
| :---: | :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **1** | 🌲 Hutan Pemula *(Beginner Forest)* | 1 | 85% | Rp 200 - Rp 400 | EARTH | Raksasa Hutan | Hutan rindang bersahabat dengan kelinci liar & jamur kecil. |
| **2** | 🦇 Gua Gelap *(Dark Cave)* | 10 | 75% | Rp 400 - Rp 800 | EARTH | Kelelawar Raksasa | Lorong gua basah penuh kelelawar penghisap darah & laba-laba raksasa. |
| **3** | 🔥 Lembah Api *(Fire Valley)* | 25 | 65% | Rp 800 - Rp 1.500 | FIRE | Golem Magma | Ngarai panas berpijar dengan naga api liar dan golem magma raksasa. |
| **4** | 🏰 Istana Kuno *(Ancient Palace)* | 40 | 55% | Rp 1.500 - Rp 2.500 | DRAGON | Iblis Kuno | Reruntuhan istana misterius yang dijaga oleh iblis kuno bermata satu. |
| **5** | ❄️ Tundra Beku *(Frozen Tundra)* | 55 | 45% | Rp 2.500 - Rp 4.500 | WATER | Yeti Raksasa | Padang salju abadi dingin membeku, dijaga oleh Yeti berbulu tebal. |
| **6** | ⚡ Rawa Petir *(Thunder Swamp)* | 70 | 40% | Rp 4.500 - Rp 7.000 | FIRE | Belut Listrik Purba | Rawa-rawa dengan petir menyambar tiada henti, dihuni belut listrik purba. |
| **7** | 🌫️ Kabut Kematian *(Death Mist)* | 85 | 35% | Rp 7.000 - Rp 10.000 | DRAGON | Lich Necromancer | Lembah berkabut racun kelam tempat bersemayamnya arwah penasaran & raja undead. |
| **8** | 🌊 Samudera Abyss *(Abyssal Ocean)* | 100 | 30% | Rp 10.000 - Rp 14.000 | WATER | Gurita Kraken | Palung laut terdalam tak tertembus cahaya, dihuni Kraken pelahap kapal bajak laut. |
| **9** | 🏔️ Puncak Langit *(Sky Sanctuary)* | 125 | 25% | Rp 14.000 - Rp 20.000 | DRAGON | Garuda Emas | Kuil melayang tinggi di atas awan, diselimuti angin kencang tempat tinggal penjaga surgawi. |
| **10** | 🌌 Dimensi Kosmik *(Cosmic Abyss)* | 150 | 20% | Rp 20.000 - Rp 30.000 | DRAGON | Void Sovereign | Ujung dimensi tempat waktu dan ruang terdistorsi. Hanya untuk pet terkuat! |

---

## 4. Mekanisme Keunggulan & Kelemahan Elemen (Peta 5 - 10)
Untuk peta baru 5 hingga 10, kalkulator peluang sukses akan menerapkan penyesuaian elemen (`elementMod = +15%` atau `-15%`) secara dinamis terhadap pet:

* **Peta 5: Tundra Beku (WATER)**
  * Keuntungan (+15%): Pet berelemen `EARTH` (karena bumi menahan/membendung aliran air/es).
  * Kelemahan (-15%): Pet berelemen `FIRE` (karena panas api padam oleh dinginnya tundra beku).
* **Peta 6: Rawa Petir (FIRE - Representasi Kilat)**
  * Keuntungan (+15%): Pet berelemen `DRAGON` atau `EARTH` (karena bumi menetralisir/meng-ground energi listrik).
  * Kelemahan (-15%): Pet berelemen `WATER` (karena air menghantarkan listrik secara fatal).
* **Peta 7: Kabut Kematian (DRAGON - Gelap/Kematian)**
  * Keuntungan (+15%): Pet berelemen `FIRE` (panah api/cahaya abadi Phoenix melenyapkan kabut kegelapan).
  * Kelemahan (-15%): Pet berelemen `EARTH` (tanah terserap oleh racun pembusukan).
* **Peta 8: Samudera Abyss (WATER)**
  * Keuntungan (+15%): Pet berelemen `DRAGON` (makhluk legenda naga menguasai lautan dalam).
  * Kelemahan (-15%): Pet berelemen `FIRE` (api padam seketika di laut terdalam).
* **Peta 9: Puncak Langit (DRAGON - Cahaya/Udara)**
  * Keuntungan (+15%): Pet berelemen `DRAGON` atau `FIRE` (Phoenix terbang bebas di awan).
  * Kelemahan (-15%): Pet berelemen `EARTH` (Golem/Kura-kura terlalu berat untuk mengudara).
* **Peta 10: Dimensi Kosmik (DRAGON - Kosmik/Void)**
  * Keuntungan (+15%): Spesies Legendaris (`LEVIATHAN`, `BEHEMOTH`, `ARCHDRAGON`) karena mereka adalah entitas kosmik purba.
  * Kelemahan (-15%): Seluruh spesies tingkat *Common* (`CAT`, `GOLEM`, `SLIME`).

---

## 5. Rencana Implementasi Teknis

### 5.1 Kode Konfigurasi (`stockmarket/pet.js`)
* Memperbarui array `EXPEDITION_MAPS` untuk menampung seluruh 10 konfigurasi peta baru.
* Memperbarui fungsi `calculateSuccessRate` untuk memproses logika keunggulan/kelemahan elemen pada peta `id` 5 sampai 10 sesuai aturan di atas.
* Menambahkan konstanta/array data `EXPEDITION_DROPS` yang mendaftarkan seluruh item bot (BM, Garden, Gacha, Pet Shop) beserta tabel tujuannya.
* Memperbarui logika drop item di dalam `executeExpedition` agar memilik item secara acak dari `EXPEDITION_DROPS` dan menyimpannya ke tabel yang sesuai (`user_inventory` atau `pet_inventory`).

### 5.2 Kode Tampilan (`stockmarket/index.js`)
* Memastikan format tampilan embed daftar ekspedisi (`.pet expedition` / `.pet exp`) dapat memuat hingga 10 peta tanpa terpotong (*Discord embed character limit validation*).

### 5.3 Kode Admin Control Panel (`stockmarket/adminPanel.js`)
* Memperbarui label input dan logika validasi modal di `action_set_level_pet_modal` dan `action_give_custom_pet_modal` agar tidak membatasi level maksimal pet sampai 100 saja.

---

## 6. Rencana Verifikasi
### 6.1 Uji Coba Otomatis / Simulasi
* Membuat script pengujian mandiri di folder `scratch/` untuk menyimulasikan jalannya ekspedisi pada peta 1 hingga 10 dengan pet level rendah, menengah, dan sangat tinggi (level 150+).
* Memastikan perhitungan peluang sukses dan pembagian koin/XP berjalan dengan benar tanpa error pembagian dengan nol atau angka negatif.

### 6.2 Uji Coba Manual
* Menjalankan perintah `.pet expedition list` di Discord untuk memverifikasi list peta terformat dengan rapi.
* Melakukan uji coba eksekusi ekspedisi untuk memastikan bos baru dideklarasikan dengan benar dalam log pertarungan.
