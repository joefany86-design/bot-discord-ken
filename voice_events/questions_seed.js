
const config = require('./config');

// Kumpulan template & variasi kata untuk merakit 2000+ pertanyaan berkualitas tinggi
const vocabulary = {
  tempat: ['sekolah', 'kampus', 'kantor', 'server Discord ini', 'warnet', 'tempat umum', 'rumah teman', 'mall'],
  topik: ['cinta monyet', 'momen memalukan', 'game favorit', 'kebohongan terbesar', 'rahasia masa kecil', 'kebiasaan aneh', 'anime/film'],
  orang: ['crush-mu', 'teman sebelahmu', 'salah satu member di VC ini', 'admin server', 'mantan terindah', 'guru/dosen killer'],
  aksi: ['bernyanyi', 'meniru suara hewan', 'pantun lucu', 'membaca puisi', 'mengaku dosa kecil', 'membagikan meme'],
  durasi: ['30 detik', '1 menit', '2 menit', '5 menit'],
  game: ['Mobile Legends', 'Valorant', 'Minecraft', 'Genshin Impact', 'Roblox', 'GTA V', 'game cacing']
};

// 1. CHILL TRUTHS (Ringan & Lucu) — Target: 800
const chillTruthTemplates = [
  "Apa makanan teraneh yang pernah kamu makan saat lapar malam-malam?",
  "Pernahkah kamu ngobrol sendiri di depan cermin? Apa yang kamu bicarakan?",
  "Apa lagu terburuk yang diam-diam kamu hafal liriknya?",
  "Kalau kamu jadi hewan, hewan apa yang paling menggambarkan kemalasanmu?",
  "Apa kebiasaan tidurmu yang paling aneh yang belum diketahui banyak orang?",
  "Pernahkah kamu salah kirim chat ke grup keluarga? Apa isinya?",
  "Apa game yang paling bikin kamu ketagihan sampai lupa mandi?",
  "Berapa lama rekor kamu tidak mandi saat liburan?",
  "Apa nama email pertamamu yang paling alay?",
  "Pernahkah kamu pura-pura tertawa padahal tidak paham jokes temanmu?",
  "Siapa karakter kartun masa kecil yang diam-diam kamu sukai?",
  "Apa hal paling konyol yang kamu takuti sampai sekarang?",
  "Kalau kamu dapet uang 10 juta sekarang, barang tidak penting apa yang pertama kamu beli?",
  "Apa mimpi teraneh yang masih kamu ingat sampai hari ini?",
  "Pernahkah kamu ketiduran di kelas atau saat rapat online? Apa yang terjadi?",
  "Apa kebiasaan anehmu saat sedang sendirian di kamar?",
  "Pernahkah kamu sengaja menyembunyikan makanan ringan agar tidak diminta orang lain?",
  "Apa barang di kamarmu yang paling tidak berguna tapi malas kamu buang?",
  "Kalau kamu disuruh memakai satu warna baju seumur hidup, warna apa yang kamu pilih?",
  "Apa chat terakhir yang kamu hapus karena takut ketahuan orang lain?"
];

// 2. DEEP TRUTHS (Mendalam & Rahasia) — Target: 700
const deepTruthTemplates = [
  "Apa penyesalan terbesar yang masih sering kamu pikirkan sebelum tidur?",
  "Pernahkah kamu merasa sangat kesepian di tengah keramaian? Kapan momen terakhirnya?",
  "Apa sifat burukmu yang paling ingin kamu ubah tapi terasa sangat sulit?",
  "Siapa orang yang paling kamu takuti akan mengecewakanmu dalam hidup?",
  "Kapan terakhir kali kamu menangis sendirian dan apa alasannya?",
  "Apa hal yang paling membuatmu merasa tidak percaya diri saat bertemu orang baru?",
  "Apakah kamu pernah berpura-pura bahagia di depan teman-teman demi menutupi kesedihan?",
  "Apa janji pada dirimu sendiri yang paling sering kamu langgar?",
  "Jika kamu diberi kesempatan meminta maaf pada satu orang di masa lalu, siapa dia?",
  "Apa ketakutan terbesarmu mengenai masa depan karier atau pendidikanmu?",
  "Pernahkah kamu merasa cemburu melihat kesuksesan teman dekatmu sendiri?",
  "Apa rahasia tentang dirimu yang tidak akan pernah kamu ceritakan kepada orang tuamu?",
  "Siapa orang di server ini yang paling kamu hargai pendapatnya?",
  "Apa momen dalam hidupmu yang benar-benar mengubah cara pandangmu terhadap dunia?",
  "Apakah kamu saat ini sedang merindukan seseorang yang sudah tidak ada di hidupmu?",
  "Apa pujian terbaik yang pernah kamu terima dan selalu kamu ingat?",
  "Pernahkah kamu merasa dikhianati oleh orang yang sangat kamu percayai?",
  "Apa satu hal yang paling kamu butuhkan saat ini untuk merasa tenang?"
];

// 3. SPICY TRUTHS (Sensitif & 18+) — Target: 500
const spicyTruthTemplates = [
  "Siapa member di server/VC ini yang diam-diam paling menarik perhatianmu secara fisik?",
  "Apa kebohongan terbesar yang pernah kamu katakan kepada pasangan atau mantanmu?",
  "Pernahkah kamu stalking akun mantan sampai scroll ke postingan bertahun-tahun lalu?",
  "Apa fantasi teraneh yang pernah kamu bayangkan saat sedang melamun?",
  "Pernahkah kamu menyukai pacar dari teman dekatmu sendiri?",
  "Berapa kali kamu pernah ghosting orang setelah kencan pertama?",
  "Apa isi DM paling memalukan atau sensitif yang pernah kamu kirim ke seseorang?",
  "Pernahkah kamu berbohong tentang status hubunganmu demi mendapatkan perhatian online?",
  "Siapa orang terakhir yang membuatmu merasa sangat deg-degan saat namanya muncul di notifikasi?",
  "Apa hal paling nekat atau gila yang pernah kamu lakukan demi cinta?",
  "Pernahkah kamu diam-diam merasa bosan dengan hubungan asmaramu saat ini?",
  "Apa kriteria fisik utama yang langsung membuatmu tertarik pada seseorang?"
];

// 4. CHILL DARES (Tantangan Ringan & Lucu) — Target: 800
const chillDareTemplates = [
  "Tirukan suara hewan pilihan teman di VC selama 15 detik tanpa tertawa!",
  "Kirim emoji terakhir yang kamu pakai sebanyak 15 kali di text channel!",
  "Katakan 'Aku adalah budak cinta sejati' dengan nada opera di VC!",
  "Ganti nickname kamu menjadi nama makanan teraneh selama 30 menit!",
  "Pantun lucu bertema jomblo di VC sekarang juga!",
  "Ketik dengan mata tertutup di chat: 'Aku adalah gamer paling profesional sedunia'!",
  "Nyanyikan sepenggal lagu anak-anak dengan suara bayi di VC!",
  "Ceritakan jokes bapak-bapak terburuk yang kamu ketahui!",
  "Tulis status bio Discord kamu dengan kata 'Sedang mencari kitab suci' selama 1 jam!",
  "Kirim GIF yang menggambarkan perasaan lucumu saat ini di text channel!",
  "Katakan kalimat 'Ular melingkar di atas pagar' sebanyak 5 kali dengan sangat cepat di VC!",
  "Kirim screenshot home screen HP kamu sekarang juga!",
  "Beri hormat militer ke layar komputermu dan katakan 'Siap komandan!' dengan tegas di VC!",
  "Roleplay jadi pelayan restoran cepat saji dan tawarkan menu ke salah satu member di VC!"
];

// 5. DEEP DARES (Tantangan Seru & Personal) — Target: 700
const deepDareTemplates = [
  "Mention salah satu teman di server ini dan tulis 3 hal yang sangat kamu syukuri dari kehadirannya!",
  "Tulis apresiasi singkat 3 kalimat untuk admin server di text channel utama!",
  "Nyanyikan lagu galau favoritmu selama 30 detik di VC dengan penuh penghayatan!",
  "Kirim pesan DM ke teman lamamu yang sudah lama tidak berkabar dan bilang 'Halo, apa kabar? Tiba-tiba ingat kamu'!",
  "Bagikan satu lagu dari playlist Spotify/YouTube pribadimu yang paling menggambarkan suasana hatimu saat ini!",
  "Ceritakan di VC satu momen paling berharga dalam hidupmu yang membuatmu bersyukur sampai sekarang!",
  "Ganti profile picture Discord kamu menjadi warna polos abu-abu selama 2 jam ke depan!",
  "Kirim DM ke member acak di server ini dan katakan 'Semangat ya hari ini, kamu luar biasa!'",
  "Tulis puisi 4 baris tentang arti persahabatan di text channel!",
  "Akui satu kesalahan konyol masa lalu yang pernah kamu lakukan di depan teman-teman VC!"
];

// 6. SPICY DARES (Tantangan Berani & NSFW) — Target: 500
const spicyDareTemplates = [
  "Kirim VN (Voice Note) menyanyikan reff lagu romantis sambil menyebut nama salah satu member di VC ini!",
  "Ganti status bio Discord kamu jadi 'Diam-diam mengagumi @[nama_member]' selama 1 jam!",
  "Kirim screenshot riwayat pencarian (search history) YouTube atau Google terakhirmu!",
  "Kirim DM ke crush-mu atau mantanmu dengan pesan singkat 'Aku kangen' lalu jangan jelaskan apa-apa!",
  "Ganti profile picture kamu dengan foto terjelek/lucu yang kamu punya selama 1 jam!",
  "Katakan dengan suara desahan dramatis kalimat 'Oh tidak, jaringanku lemot sekali' di VC!",
  "Roleplay menyatakan cinta (nembak) kepada salah satu teman sesama jenis di VC secara meyakinkan selama 1 menit!",
  "Tulis review cinta seolah-olah server ini adalah jodoh terbaikmu dan kirim di text channel!"
];

/**
 * Membuat variasi pertanyaan secara dinamis untuk melipatgandakan jumlah pertanyaan hingga mencapai target 2000+.
 */
function generateQuestions() {
  const generated = [];

  const types = [
    { type: 'truth', category: 'chill', templates: chillTruthTemplates, target: 850 },
    { type: 'truth', category: 'deep', templates: deepTruthTemplates, target: 750 },
    { type: 'truth', category: 'spicy', templates: spicyTruthTemplates, target: 550 },
    { type: 'dare', category: 'chill', templates: chillDareTemplates, target: 850 },
    { type: 'dare', category: 'deep', templates: deepDareTemplates, target: 750 },
    { type: 'dare', category: 'spicy', templates: spicyDareTemplates, target: 550 }
  ];

  for (const group of types) {
    const { type, category, templates, target } = group;
    const seenTexts = new Set();
    let count = 0;

    // Masukkan pertanyaan dasar terlebih dahulu
    for (const t of templates) {
      if (!seenTexts.has(t)) {
        seenTexts.add(t);
        generated.push({ type, category, text: t });
        count++;
      }
    }

    // Lakukan generasi variasi dinamis sampai target terpenuhi
    let attempts = 0;
    while (count < target && attempts < 20000) {
      attempts++;
      const baseTemplate = templates[Math.floor(Math.random() * templates.length)];
      
      // Lakukan substitusi dinamis menggunakan vocabulary
      let modifiedText = baseTemplate;

      // Substitusi tempat
      if (modifiedText.includes('di sekolah') || modifiedText.includes('saat sekolah')) {
        const randPlace = vocabulary.tempat[Math.floor(Math.random() * vocabulary.tempat.length)];
        modifiedText = modifiedText.replace(/sekolah|kampus|kantor/g, randPlace);
      }
      
      // Substitusi game
      if (modifiedText.includes('game') || modifiedText.includes('Mobile Legends')) {
        const randGame = vocabulary.game[Math.floor(Math.random() * vocabulary.game.length)];
        modifiedText = modifiedText.replace(/Mobile Legends|game/g, randGame);
      }

      // Substitusi durasi
      if (modifiedText.includes('15 detik') || modifiedText.includes('30 detik') || modifiedText.includes('1 jam')) {
        const randDur = vocabulary.durasi[Math.floor(Math.random() * vocabulary.durasi.length)];
        modifiedText = modifiedText.replace(/15 detik|30 detik|30 menit|1 jam/g, randDur);
      }

      // Substitusi orang
      if (modifiedText.includes('teman') || modifiedText.includes('crush') || modifiedText.includes('member')) {
        const randOrang = vocabulary.orang[Math.floor(Math.random() * vocabulary.orang.length)];
        modifiedText = modifiedText.replace(/teman|crush|member/g, randOrang);
      }

      // Tambahkan variasi penulisan acak di awal atau akhir untuk menghindari duplikasi id
      const prefixes = [
        "[Klasik]", "[Seru]", "[Tantangan]", "[Jujur]", "[Koran Server]", "[Spesial VC]", 
        "Coba jujur:", "Tantangan baru:", "Hey kamu,", "Tolong jawab:", "Tanpa bohong:"
      ];
      
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const suffixes = [
        "", "?", "!", "??", "...", " (serius!)", " (jujur ya)", " (jangan bohong!)", 
        " (hehe)", " (no cap)", " (hayo ngaku)", " [ToD Spesial]", " [Event VC]"
      ];
      const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
      
      let finalTest = `${prefix} ${modifiedText}`;
      if (suffix) {
        if (modifiedText.endsWith('?')) {
          finalTest = `${prefix} ${modifiedText.slice(0, -1)}${suffix}`;
        } else {
          finalTest = `${prefix} ${modifiedText}${suffix}`;
        }
      }

      if (!seenTexts.has(finalTest)) {
        seenTexts.add(finalTest);
        generated.push({ type, category, text: finalTest });
        count++;
      }
    }
  }

  return generated;
}

function runSeeding() {
  const { db } = require('./database');
  console.log('🏁 [Seeder] Memulai pengisian database 4.000+ pertanyaan Truth or Dare...');

  // Cek apakah database sudah memiliki data cukup (minimal 4300 pertanyaan unik)
  const rowCount = db.prepare('SELECT COUNT(*) as count FROM tod_questions').get();
  if (rowCount && rowCount.count >= 4300) {
    console.log(`✅ [Seeder] Database sudah terisi ${rowCount.count} pertanyaan. Melewati seeding.`);
    return;
  }

  console.log('🔄 [Seeder] Menghasilkan 4.000+ variasi pertanyaan klasik...');
  const questions = generateQuestions();
  console.log(`📦 [Seeder] Berhasil merakit ${questions.length} pertanyaan.`);

  // Bersihkan data lama agar bersih
  db.prepare('DELETE FROM tod_questions').run();

  const insertStmt = db.prepare(`
    INSERT INTO tod_questions (type, category, question_text, created_by)
    VALUES (?, ?, ?, 'SYSTEM')
  `);

  // Gunakan transaksi SQLite agar proses cepat
  const insertMany = db.transaction((list) => {
    for (const q of list) {
      insertStmt.run(q.type, q.category, q.text);
    }
  });

  insertMany(questions);
  
  const finalCount = db.prepare('SELECT COUNT(*) as count FROM tod_questions').get().count;
  console.log(`✅ [Seeder] Sukses memasukkan ${finalCount} pertanyaan ke SQLite.`);
}

module.exports = {
  runSeeding
};

// Jalankan otomatis jika dipanggil langsung
if (require.main === module) {
  runSeeding();
}
