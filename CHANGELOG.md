# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-06-05

### Added
- Kolom `wanted_bounty` pada tabel `wallets` untuk menyimpan nilai buruan status Wanted.
- Item `HANDCUFFS` (Borgol) di Black Market seharga Rp 500.
- Perintah `.arrest @user` dan slash command `/arrest` untuk menangkap buronan (wanted) yang aktif.
- Mekanisme **Alarm Teriak Maling (QTE)** berdurasi 15 detik jika korban memiliki upgrade kosan `ALARM` dan perampok tidak membawa `MEAT` (Daging Bius).
- Mekanisme **Kejaran Polisi (Police Chase QTE)** berdurasi 10 detik dengan 3 tombol rute pelarian acak (Gang Sempit [70%], Keramaian Pasar [40%], Jembatan Layang [20%]) untuk meloloskan diri dari denda/jail jika perampokan gagal.

### Changed
- Panel Transaksi Saham (`sendInteractiveTradePanel`) diubah dari tombol horizontal padat menjadi menu dropdown `StringSelectMenu` (`eco_trade_select_buy` dan `eco_trade_select_sell`).
- Panel Cozy Garden (`getGardenDashboardDataPrivate`) disederhanakan dengan mengganti tombol navigasi menu menjadi dropdown select menu (`garden_select_manage_actions`).
- Panel Toko Benih kebun (`getGardenShopDataPrivate`) tombol belinya disederhanakan menjadi dropdown menu (`garden_select_buy_seeds`).
- Panel Black Market (`eco_btn_open_bm_private_perm`) tombol belinya disederhanakan menjadi dropdown menu (`bm_select_buy_items`).
- Fungsi `robSolo` diubah menjadi dry-run (perhitungan denda/durasi penjara dikembalikan tanpa langsung ditulis ke database jika gagal, agar diproses terlebih dahulu melalui Police Chase QTE).
- Penyesuaian harga item kriminal Black Market:
  - `LOCKPICK`: Rp 450
  - `MASK`: Rp 600
  - `MEAT`: Rp 350
  - `SOAP`: Rp 500
