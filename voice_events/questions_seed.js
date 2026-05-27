/**
 * Seeder untuk Populasi Kumpulan Pertanyaan Truth or Dare Klasik & Premium
 * Bahasa Indonesia, Kategori: Chill, Deep, Spicy
 */
const { db } = require('./database');

const TRUTH_QUESTIONS = {
  chill: [
    "Siapa orang di Voice Channel ini yang paling ingin kamu ajak jalan seharian?",
    "Apa kebiasaan teraneh yang kamu lakukan saat sendirian di kamar?",
    "Kapan terakhir kali kamu pura-pura tertawa padahal gak ngerti jokes-nya?",
    "Apa nama kontak paling aneh yang pernah kamu simpan di HP-mu?",
    "Aplikasi apa di HP-mu yang paling sering bikin kamu malu kalau ketahuan orang?",
    "Pernahkah kamu kentut di depan umum lalu pura-pura mencari pelakunya?",
    "Apa makanan paling aneh yang pernah kamu coba dan ternyata kamu suka?",
    "Siapa selebriti lokal yang diam-diam sering kamu stalk akun Instagramnya?",
    "Pernahkah kamu ngirim chat ke orang lain padahal niatnya nge-ghibahin orang itu?",
    "Apa lagu memalukan yang diam-diam masih sering kamu dengerin lewat headset?"
  ],
  deep: [
    "Apa penyesalan terbesar yang sampai sekarang masih sering terlintas di pikiranmu?",
    "Jika hari ini adalah hari terakhirmu di dunia, apa satu hal yang ingin kamu sampaikan pada orang tuamu?",
    "Kapan momen terakhir kalinya kamu menangis sendirian dan apa alasannya?",
    "Pernahkah kamu merasa sangat kesepian bahkan saat sedang berkumpul bersama teman-teman?",
    "Apa satu kebohongan besar yang pernah kamu katakan dan belum pernah kamu akuinya hingga sekarang?",
    "Apa ketakutan terbesar yang membuatmu tidak bisa tidur nyenyak di malam hari?",
    "Siapa orang yang paling ingin kamu mintai maaf secara tulus tapi belum sempat kamu lakukan?",
    "Bagian mana dari dirimu yang paling ingin kamu ubah jika diberi kesempatan lahir kembali?",
    "Pernahkah kamu merasa gagal dalam hidup, dan apa yang membuatmu bangkit kembali?",
    "Apa arti kebahagiaan sejati menurut sudut pandang pribadimu saat ini?"
  ],
  spicy: [
    "Siapa orang di guild/server ini yang menurutmu paling menarik secara fisik?",
    "Pernahkah kamu berfantasi tentang seseorang yang sudah memiliki pasangan?",
    "Apa hal paling nekat atau gila yang pernah kamu lakukan di dalam kamar tidur?",
    "Kapan terakhir kali kamu mengirimkan foto atau chat bernada sensual ke seseorang?",
    "Pernahkah kamu diam-diam mengagumi secara fisik salah satu teman dekatmu di VC ini?",
    "Apa tipe atau kriteria fisik pasangan ideal yang diam-diam paling membuatmu bergairah?",
    "Pernahkah kamu tertangkap basah saat sedang menonton konten dewasa?",
    "Apa bagian tubuhmu sendiri yang menurutmu paling seksi dan menarik?",
    "Pernahkah kamu berciuman dengan orang asing yang baru kamu kenal dalam hitungan jam?",
    "Apa rahasia paling dewasa yang belum pernah diketahui oleh teman-teman dekatmu?"
  ]
};

const DARE_QUESTIONS = {
  chill: [
    "Kirim pesan teks random berbunyi 'Aku tahu rahasiamu...' ke kontak WhatsApp ke-5 di HP-mu!",
    "Lakukan impersonate (meniru gaya bicara) salah satu anggota di VC ini sampai ada yang menebak siapa!",
    "Bicaralah menggunakan logat daerah (Jawa/Sunda/Medan) selama 2 putaran game berikutnya!",
    "Nyanyikan reff dari lagu kesukaanmu dengan suara sekencang mungkin lewat mic!",
    "Bacakan chat terakhir yang kamu kirimkan di WhatsApp tanpa sensor sama sekali!",
    "Sebutkan 3 kekurangan terbesar dari teman yang berada di sebelah kananmu (atau user kedua di VC)!",
    "Tunjukkan foto paling memalukan yang tersimpan di galeri HP-mu ke channel text!",
    "Ganti status custom Discord-mu menjadi 'Aku cinta admin server ini' selama 24 jam ke depan!",
    "Gunakan filter suara terlucu atau ubah nada bicaramu menjadi sangat manja sampai giliranmu selesai!",
    "Kirimkan meme paling absurd yang ada di galeri HP-mu ke channel obrolan sekarang juga!"
  ],
  deep: [
    "Kirim pesan suara (voice note) ke salah satu teman lama di WA dan katakan bahwa kamu merindukannya secara tulus!",
    "Hubungi nomor acak / teman dekatmu, katakan secara jujur satu hal tentang mereka yang selama ini mengganjal pikiranmu!",
    "Tuliskan surat apresiasi singkat berisi 3 baris kalimat hangat untuk orang yang paling berharga di server ini!",
    "Akui satu kesalahan masa lalu terburuk yang pernah kamu perbuat kepada salah satu orang di VC ini secara tulus!",
    "Tutup matamu selama 1 menit penuh, renungkan masa depanmu, lalu jelaskan apa yang paling ingin kamu capai dalam 5 tahun ke depan!",
    "Sebutkan satu nama orang di server ini yang ingin kamu ajak bicara empat mata untuk menyelesaikan kesalahpahaman masa lalu!",
    "Tuliskan sebuah status panjang di sosial mediamu tentang betapa bersyukurnya kamu memiliki hidup saat ini!",
    "Tatap profil Discord teman di VC ini yang paling jarang kamu ajak bicara, lalu berikan pujian terdalam yang belum pernah ia dengar!",
    "Ceritakan tentang masa tersulit dalam hidupmu yang berhasil kamu lalui hingga membentuk dirimu yang sekarang!",
    "Sebutkan satu impian terbesarmu yang orang-orang terdekatmu anggap konyol atau mustahil dicapai!"
  ],
  spicy: [
    "Kirim DM Discord ke orang yang kamu taksir di server ini dan katakan 'Kamu hari ini kelihatan menarik banget'!",
    "Ganti nickname Discord-mu menjadi 'Budak Cinta @[User Terpilih di VC]' selama permainan berlangsung!",
    "Ucapkan rayuan gombal paling maut bernada seksi ke salah satu member lawan jenis di VC ini!",
    "Kirimkan foto selfie terbaikmu saat ini dengan gaya berkedip (wink) ke text channel game!",
    "Ceritakan pengalaman cinta pertamamu secara detail tanpa melewatkan detail mendebarkan sedikit pun!",
    "Katakan secara blak-blakan hal fisik apa dari @[Pemain Terpilih di VC] yang paling kamu sukai!",
    "Tuliskan pesan teks sensual pendek di status Discord-mu dan biarkan selama 1 jam penuh!",
    "Lakukan desahan manja singkat lewat mikrofon selama 3 detik penuh tanpa tertawa!",
    "Ceritakan kencan impian paling romantis dan sensual versi dirimu yang belum terwujud!",
    "Tunjukkan riwayat pencarian (search history) browser HP-mu tanpa disensor ke chat channel!"
  ]
};

function runSeeding() {
  console.log('🌱 [VoiceDb] Menjalankan seeding data pertanyaan ToD...');

  try {
    db.prepare('DELETE FROM tod_questions').run();

    const insertStmt = db.prepare(`
      INSERT INTO tod_questions (type, category, question_text, created_by)
      VALUES (?, ?, ?, 'SYSTEM')
    `);

    let truthCount = 0;
    let dareCount = 0;

    // Seed Truths
    for (const [category, list] of Object.entries(TRUTH_QUESTIONS)) {
      for (const question of list) {
        insertStmt.run('truth', category, question);
        truthCount++;
      }
    }

    // Seed Dares
    for (const [category, list] of Object.entries(DARE_QUESTIONS)) {
      for (const question of list) {
        insertStmt.run('dare', category, question);
        dareCount++;
      }
    }

    console.log(`✅ [VoiceDb] Sukses menanamkan ${truthCount} Truth & ${dareCount} Dare pertanyaan premium!`);
  } catch (err) {
    console.error('❌ [VoiceDb] Gagal melakukan seeding:', err.message);
  }
}

module.exports = { runSeeding };
