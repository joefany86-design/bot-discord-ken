const { db } = require('./stockmarket/database');

console.log("=== Memulai Pembersihan Database Piala Dunia ===");

try {
  // Ambil data sebelum dihapus untuk log
  const legacyMatches = db.prepare("SELECT id, home, away, stage, unique_key FROM worldcup_matches WHERE unique_key NOT LIKE 'worldcup26-%'").all();
  console.log(`Menemukan ${legacyMatches.length} pertandingan lama untuk dihapus.`);
  
  if (legacyMatches.length > 0) {
    db.transaction(() => {
      // Hapus skor pertandingan lama
      const scoreDel = db.prepare(`
        DELETE FROM worldcup_match_scores WHERE match_id IN (
          SELECT id FROM worldcup_matches WHERE unique_key NOT LIKE 'worldcup26-%'
        )
      `).run();
      console.log(`-> Berhasil menghapus ${scoreDel.changes} skor pertandingan lama.`);

      // Hapus pertandingan lama
      const matchDel = db.prepare("DELETE FROM worldcup_matches WHERE unique_key NOT LIKE 'worldcup26-%'").run();
      console.log(`-> Berhasil menghapus ${matchDel.changes} pertandingan lama.`);
      
      // Hapus event gol lama
      db.exec("DELETE FROM worldcup_match_events");
      console.log("-> Berhasil mereset tabel event gol.");
    })();
  }
  
  console.log("=== Pembersihan Selesai dengan Sukses! ===");
} catch (error) {
  console.error("❌ Gagal membersihkan database:", error.message);
}
