require('dotenv').config();
const db = require('../stockmarket/database');

async function resetCooldowns() {
  console.log('🔄 Memulai reset cooldown ekspedisi pet untuk semua pemain...');
  
  try {
    const result = db.run(
      'UPDATE wallets SET daily_expedition_count = 0, expedition_cooldown_until = 0'
    );
    
    console.log(`✅ Sukses mereset cooldown dan kuota ekspedisi! Jumlah baris dompet/pemain yang diupdate: ${result.changes}`);
  } catch (error) {
    console.error('❌ Gagal mereset cooldown:', error.message);
  }
}

resetCooldowns();
