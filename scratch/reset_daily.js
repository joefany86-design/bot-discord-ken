const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Menggunakan process.cwd() agar kompatibel dijalankan dari folder project manapun
const configPath = path.join(process.cwd(), 'stockmarket/config');
const config = require(configPath);
let finalDbPath = config.DATABASE_PATH;

if (!fs.existsSync(finalDbPath)) {
  finalDbPath = path.join(process.cwd(), 'data/economy.db');
}

console.log(`Menghubungkan ke database: ${finalDbPath}`);
const db = new Database(finalDbPath);

const targetUserId = process.argv[2];

if (!targetUserId) {
  console.error('❌ Harap masukkan User ID Discord target!');
  console.log('Penggunaan: node scratch/reset_daily.js <USER_ID>');
  db.close();
  process.exit(1);
}

try {
  // Set last_active_date ke tanggal kemarin agar dianggap belum klaim hari ini
  const result = db.prepare("UPDATE wallets SET last_active_date = '2026-06-01' WHERE user_id = ?").run(targetUserId);
  
  if (result.changes > 0) {
    console.log(`✅ BERHASIL: Status Daily Claim untuk User ID ${targetUserId} telah di-reset!`);
    console.log(`Silakan kirim pesan chat pertama Anda di server untuk memicu Auto-Daily Claim.`);
  } else {
    console.log(`⚠️ Peringatan: Tidak ada data wallet ditemukan untuk User ID ${targetUserId}. Pastikan User ID benar.`);
  }
} catch (err) {
  console.error('❌ Terjadi error:', err.message);
} finally {
  db.close();
}
