# Product Requirement Document (PRD)
## Fitur: Simplifikasi & Standarisasi Panel Ekonomi, Finansial & Gaya Hidup

| Dokumen Info | Detail |
| --- | --- |
| **Status** | Draft / In Review |
| **Penulis** | Antigravity AI |
| **Tanggal Pembuatan** | 5 Juni 2026 |
| **Target Rilis** | Sprint 7 (Penyelarasan UI/UX Global) |
| **Target Platform** | Discord Bot (Sentinel Bot) |

---

## 1. Latar Belakang & Tujuan
Menyusul suksesnya rencana penyederhanaan panel **Portal Hub Utama (`.hub`)** dan **Kandang Pet**, panel-panel ekonomi dan gaya hidup lainnya juga memerlukan penyesuaian. 

Beberapa panel seperti **Bursa Saham (Trade Panel)**, **Cozy Garden (Toko Benih & Kebun Utama)**, dan **Black Market** saat ini masih menggunakan susunan tombol (button) horizontal yang sangat padat (hingga 5 tombol per baris) atau tersebar di banyak baris. Di perangkat seluler (mobile), tombol-tombol yang terlalu padat ini akan menyusut secara ekstrem, teksnya terpotong, dan rawan salah klik oleh pemain.

**Tujuan Dokumen Ini:**
- Menstandarisasi seluruh panel menu bot agar ramah perangkat seluler (mobile-first design).
- Mengurangi kepadatan tombol horizontal dengan mengonversinya menjadi dropdown menu (`StringSelectMenu`) yang responsif.
- Menciptakan alur interaksi yang konsisten di semua fitur ekonomi: Toko, Kebun, Bursa Saham, dan Pasar Gelap.

---

## 2. Spesifikasi Perubahan Per Panel

### 2.1 Bursa Saham: Modul Perdagangan (Stock Trade Panel)
*   **Masalah:** Memiliki 5 tombol Beli dan 5 tombol Jual dalam baris horizontal yang sangat sempit di mobile (`Beli 1/10/50/Max/Custom` dan `Jual 1/10/50/Semua/Custom`).
*   **Solusi:** Ubah tombol-tombol tersebut menjadi 2 menu dropdown terpisah yang bersih:
    *   **Baris ke-1 (Pilih Saham):** Dropdown `eco_trade_select_stock` (Pilih instrumen saham).
    *   **Baris ke-2 (Aksi Beli - Buy Options):** Dropdown `eco_trade_select_buy` berisi pilihan:
        1. `📥 Beli 1 Lembar`
        2. `📥 Beli 10 Lembar`
        3. `📥 Beli 50 Lembar`
        4. `📥 Beli Maksimal (Max Afford/Stock)`
        5. `📥 Beli Jumlah Kustom (Custom Input)`
    *   **Baris ke-3 (Aksi Jual - Sell Options):** Dropdown `eco_trade_select_sell` berisi pilihan:
        1. `📤 Jual 1 Lembar`
        2. `📤 Jual 10 Lembar`
        3. `📤 Jual 50 Lembar`
        4. `📤 Jual Semua (Sell All)`
        5. `📤 Jual Jumlah Kustom (Custom Input)`
    *   **Baris ke-4 (Navigasi):** Tombol `✖️ Keluar Panel` (ButtonStyle.Secondary).

---

### 2.2 Cozy Garden: Panel Kebun Utama & Toko Benih
*   **Masalah Kebun Utama:** Menggunakan 6 tombol yang tersebar di 2 baris serta 1 dropdown penanaman benih.
*   **Solusi Kebun Utama:** Pertahankan tombol aksi instan yang butuh akses cepat, dan kelompokkan aksi sekunder ke dalam satu dropdown menu:
    *   **Baris ke-1 (Aksi Cepat):** 
        - `💦 Siram Semua` (garden_btn_water_all_perm) - Style: Primary
        - `🧺 Panen Semua` (garden_btn_harvest_all_perm) - Style: Success
    *   **Baris ke-2 (Aksi Kelola Kebun):** Dropdown menu baru `garden_select_manage_actions` berisi pilihan:
        1. `🛒 Toko Benih & Kertas Kado` (Membuka menu belanja kebun)
        2. `💐 Rangkai Buket Bunga` (Membuka menu crafting buket)
        3. `💰 Jual Bunga Hasil Panen` (Membuka menu penjualan bunga)
        4. `🎁 Kirim Kado Buket ke Warga` (Membuka lobi pengiriman kado)
    *   **Baris ke-3 (Aksi Menanam):** Dropdown `garden_select_plant_perm` (Pilih benih & slot untuk menanam).

*   **Masalah Toko Benih:** Menggunakan 3 baris tombol terpisah untuk pembelian benih dan kertas kado (total 7 tombol).
*   **Solusi Toko Benih:** Konversi tombol pembelian menjadi menu dropdown tunggal:
    *   **Baris ke-1 (Dropdown Belanja):** Dropdown menu baru `garden_select_buy_seeds` berisi pilihan pembelian barang:
        - `🌹 Mawar` (Rp 80)
        - `🌷 Tulip` (Rp 150)
        - `🪻 Lavender` (Rp 250)
        - `🌸 Sakura` (Rp 500)
        - `👑 Anggrek` (Rp 1.200)
        - `🎗️ Kertas Kado` (Rp 100)
    *   **Baris ke-2 (Navigasi):** Tombol `🏡 Kembali ke Kebun` (ButtonStyle.Secondary).

---

### 2.3 Black Market (Pasar Gelap)
*   **Masalah:** Menggunakan 4 tombol horizontal bersebelahan untuk pembelian barang (`Linggis`, `Topeng`, `Daging`, `Sabun`).
*   **Solusi:** Ubah menjadi sistem dropdown yang selaras dengan Toko Pet dan Toko Benih:
    *   **Baris ke-1 (Dropdown Belanja BM):** Dropdown menu baru `bm_select_buy_items` berisi pilihan:
        1. `🗝️ Linggis / Lockpick` (Rp 450)
        2. `🎭 Topeng Samaran` (Rp 600)
        3. `🥩 Daging Bius` (Rp 350)
        4. `🧼 Sabun Licin` (Rp 500)
    *   **Baris ke-2 (Navigasi):** Tombol `✖️ Tutup Pasar Gelap` (ButtonStyle.Danger).

---

### 2.4 Bank Sentral (`🏦 Bank Sentral`) & Sewa Kosan (`🛌 Sewa Kosan`)
*   **Bank Sentral:** Saat ini memiliki 5 tombol dalam 1 baris (`Deposit`, `Tarik`, `Pinjam`, `Bayar`, `Transfer`). Desain ini dinilai masih cukup rapi dan pas batas maksimal baris Discord. Tidak diperlukan perubahan besar, namun jika ingin disederhanakan di masa depan, tombol `Pinjam` & `Bayar` dapat dikonsolidasikan ke dropdown Kredit. *Rekomendasi saat ini: Pertahankan karena frekuensi penggunaan sangat tinggi.*
*   **Sewa Kosan:** Panel Kosan saat ini sudah menggunakan desain mobile-first yang bersih (menggunakan dropdown pemilihan kamar dan upgrade fasilitas). *Status: Sudah optimal, tidak memerlukan perubahan.*

---

## 3. UI/UX Mockup Perbandingan

| Fitur | Desain Lama (Button-Heavy) | Desain Baru (Dropdown-Consolidated) |
| --- | --- | --- |
| **Bursa Saham** | 1 Dropdown + 10 Tombol Transaksi + 1 Tombol Keluar | 3 Dropdown (Saham, Beli, Jual) + 1 Tombol Keluar |
| **Kebun Utama** | 6 Tombol Utama + 1 Dropdown Slot | 2 Tombol Utama + 2 Dropdown (Kelola & Slot Tanam) |
| **Toko Benih** | 6 Tombol Benih + 1 Tombol Kembali | 1 Dropdown Benih + 1 Tombol Kembali |
| **Black Market** | 4 Tombol Peralatan | 1 Dropdown Peralatan + 1 Tombol Tutup |

---

## 4. Pertanyaan Terbuka untuk User (Open Questions)

> [!IMPORTANT]
> 1. Apakah Anda setuju jika tombol transaksi Saham sepenuhnya menggunakan dropdown, atau ingin menyisakan tombol "Beli 1" & "Jual Semua" sebagai tombol cepat di luar dropdown?
> 2. Apakah susunan pengelompokan menu Kebun Utama (Siram & Panen sebagai tombol cepat, sisanya di dropdown) sudah sesuai dengan kenyamanan bermain Anda?
