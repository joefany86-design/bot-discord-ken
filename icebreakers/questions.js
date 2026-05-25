/**
 * Database Pertanyaan Ice Breaker — Bahasa Indonesia
 * 
 * Berisi 50+ Truth, 50+ Dare, dan 50+ Would You Rather
 * Semua pertanyaan dibuat relevan untuk komunitas Discord gaming/casual.
 */

// ═══════════════════════════════════════════════════
// TRUTH — Pertanyaan jujur yang seru & relatable
// ═══════════════════════════════════════════════════
const truths = [
  "Apa hal paling memalukan yang pernah kamu lakukan di depan teman-teman?",
  "Siapa orang di server ini yang paling sering kamu stalking profilnya?",
  "Pernah nggak kamu pura-pura offline padahal lagi online?",
  "Apa hal terbodoh yang pernah kamu ketik di chat lalu langsung hapus?",
  "Siapa orang pertama yang kamu cek kalau buka Discord?",
  "Pernah nggak kamu ngomong jelek tentang seseorang di server ini di DM orang lain?",
  "Apa kebiasaan aneh kamu yang nggak ada orang tahu?",
  "Kalau bisa baca DM satu orang di server ini, siapa yang kamu pilih?",
  "Apa lagu yang sering kamu dengerin tapi malu kalau ketahuan?",
  "Pernah nggak kamu nangis gara-gara film atau anime? Film/anime apa?",
  "Apa hal yang paling kamu sesali dalam hidup?",
  "Siapa orang di server ini yang menurut kamu paling lucu?",
  "Pernah nggak kamu bohong ke teman dekat? Tentang apa?",
  "Apa mimpi paling aneh yang pernah kamu alami?",
  "Kalau dunia mau kiamat besok, apa yang pertama kamu lakukan?",
  "Apa makanan yang semua orang suka tapi kamu benci?",
  "Pernah nggak kamu cemburu sama teman sendiri? Kenapa?",
  "Apa rahasia kecil yang belum pernah kamu ceritakan ke siapapun?",
  "Siapa guru/dosen yang paling kamu benci dan kenapa?",
  "Apa hal paling nekat yang pernah kamu lakukan?",
  "Pernah nggak kamu ketiduran pas lagi voice call? Sama siapa?",
  "Apa wallpaper HP kamu sekarang? Kenapa pilih itu?",
  "Siapa artis/idol yang diam-diam kamu simp?",
  "Apa skill yang pengen banget kamu punya tapi males belajar?",
  "Pernah nggak kamu sengaja AFK biar nggak diajak main?",
  "Apa game yang paling bikin kamu rage quit?",
  "Siapa teman online yang paling kamu anggap teman dekat di real life?",
  "Pernah nggak kamu nge-Google pertanyaan yang sangat bodoh?",
  "Apa hal yang bikin kamu langsung ilfeel sama orang?",
  "Kalau disuruh delete satu social media selamanya, yang mana?",
  "Pernah nggak kamu pura-pura ngerti padahal bingung banget?",
  "Apa comfort food kamu kalau lagi sedih?",
  "Siapa member di server ini yang paling pengen kamu ketemu IRL?",
  "Apa hal yang selalu kamu tunda-tunda tapi nggak pernah dikerjain?",
  "Pernah nggak kamu ketahuan ngegosip? Sama siapa?",
  "Apa password WiFi kamu? (bercanda) Apa nama WiFi paling lucu yang pernah kamu lihat?",
  "Kalau bisa jadi invisible selama 1 hari, apa yang kamu lakukan?",
  "Apa hal pertama yang kamu lakukan begitu bangun tidur?",
  "Pernah nggak kamu stalking mantan? Kapan terakhir kali?",
  "Apa unpopular opinion kamu yang bikin orang kesel?",
  "Siapa public figure yang menurut kamu overrated?",
  "Apa kebiasaan buruk kamu yang susah dihilangkan?",
  "Pernah nggak kamu berbohong tentang umur kamu di internet?",
  "Apa hal yang bikin kamu nggak bisa tidur di malam hari?",
  "Kalau bisa teleport ke satu tempat sekarang, ke mana?",
  "Apa momen paling awkward yang pernah kamu alami di Discord?",
  "Siapa orang yang paling kamu kagumi dan kenapa?",
  "Apa hal yang kamu lakuin diam-diam tapi kalau ketahuan malu banget?",
  "Pernah nggak kamu nge-stalk akun seseorang sampai scroll jauh ke bawah?",
  "Apa cita-cita kecil kamu yang sekarang bikin ketawa sendiri?",
  "Siapa member di server ini yang kalau chat pasti kamu baca duluan?",
  "Apa topik yang bisa bikin kamu ngobrol berjam-jam tanpa bosen?"
];

// ═══════════════════════════════════════════════════
// DARE — Tantangan seru yang bisa dilakukan di Discord
// ═══════════════════════════════════════════════════
const dares = [
  "Ganti profile picture kamu jadi foto terjelek yang kamu punya selama 1 jam!",
  "Kirim voice note di channel ini sambil nyanyi lagu anak-anak!",
  "Mention 3 orang di server ini dan bilang sesuatu yang manis ke masing-masing!",
  "Ganti nickname kamu jadi 'Budak Server' selama 2 jam!",
  "Kirim emoji terakhir yang kamu pakai sebanyak 10 kali berturut-turut!",
  "Ceritakan momen paling memalukan kamu di voice channel (bukan chat)!",
  "Kirim selfie kamu sekarang juga di channel ini (atau foto jempol kaki)!",
  "Reply ke pesan terakhir admin dengan 'I love you min 💕'!",
  "Tulis puisi 4 baris tentang orang yang terakhir chat di server ini!",
  "Ganti status Discord kamu jadi sesuatu yang cringe selama 1 jam!",
  "Kirim DM ke orang random di server ini dan bilang 'Kamu itu spesial 🌟'!",
  "Roleplay jadi customer service selama 5 menit ke depan!",
  "Ketik pesan berikutnya kamu pakai caps lock semua!",
  "Ceritakan joke terburuk yang kamu tahu!",
  "Kirim foto terakhir di gallery HP kamu (yang SFW)!",
  "Tag seseorang dan tebak zodiak mereka!",
  "Kirim voice note bilang 'Aku cinta server ini' dengan suara paling dramatis!",
  "Ganti bio Discord kamu jadi lirik lagu dangdut selama 1 jam!",
  "Tulis review bintang 5 tentang server ini seolah-olah ini restoran!",
  "Kirim GIF yang menggambarkan mood kamu sekarang!",
  "Ceritakan pengalaman gaming paling noob yang pernah kamu alami!",
  "Nyanyikan lagu nasional lewat voice note!",
  "Tulis pantun tentang admin server!",
  "Kirim pesan 'Halo semuanya, aku kangen kalian 🥺' ke 3 group chat berbeda!",
  "Roleplay jadi bot selama 3 menit (jawab semua chat dengan format bot)!",
  "Kirim foto makanan terakhir yang kamu makan!",
  "Ceritakan pengalaman kamu ketahuan main HP pas kerja/sekolah!",
  "Tulis surat cinta untuk server ini minimal 3 kalimat!",
  "Ganti profile picture jadi warna polos selama 30 menit!",
  "Kirim voice note tirukan suara karakter anime favorit kamu!",
  "Mention orang yang terakhir online dan ajak main game!",
  "Tulis 3 hal yang kamu syukuri hari ini!",
  "Ketik dengan mata tertutup: 'Aku jago banget main game'!",
  "Ceritakan kenapa kamu join server ini pertama kali!",
  "Kirim screenshot home screen HP kamu!",
  "Buat akronim dari username orang yang di atas chat kamu!",
  "Kirim voice note ketawa selama 10 detik!",
  "Tulis rap 4 baris tentang kehidupan anak Discord!",
  "Bilang 'GG EZ' di chat game terakhir yang kamu main (screenshot)!",
  "Ganti nickname jadi nama karakter anime terakhir yang kamu tonton!",
  "Kirim pesan menggunakan bahasa daerah kamu!",
  "Ceritakan dream setup PC/gaming kamu!",
  "Tulis haiku (puisi 3 baris) tentang internet lemot!",
  "React semua pesan di atas dengan emoji random!",
  "Kirim foto pemandangan dari jendela kamu sekarang!",
  "Ceritakan conspiracy theory paling absurd yang pernah kamu denger!",
  "Tulis thread appreciation post untuk member yang jarang chat!",
  "Kirim voice note baca tongue twister secepat mungkin!",
  "Roleplay jadi motivational speaker selama 2 menit!",
  "Bikin meme tentang server ini dan kirim di sini!",
  "Kirim playlist lagu favorit kamu (minimal 5 lagu)!",
  "Tulis prediksi lucu tentang apa yang terjadi di server ini minggu depan!"
];

// ═══════════════════════════════════════════════════
// WOULD YOU RATHER — Dilema seru & bikin mikir
// ═══════════════════════════════════════════════════
const wouldYouRather = [
  {
    optionA: "Gak bisa pakai Discord selamanya",
    optionB: "Gak bisa main game selamanya"
  },
  {
    optionA: "Selalu telat 15 menit ke mana-mana",
    optionB: "Selalu kecepetan 2 jam ke mana-mana"
  },
  {
    optionA: "Bisa baca pikiran orang",
    optionB: "Bisa jadi invisible kapan saja"
  },
  {
    optionA: "Hidup tanpa musik selamanya",
    optionB: "Hidup tanpa film/series selamanya"
  },
  {
    optionA: "Punya internet super cepat tapi cuma bisa buka 1 website",
    optionB: "Punya internet super lemot tapi bisa buka semua website"
  },
  {
    optionA: "Selalu bilang apa yang ada di pikiran (jujur 100%)",
    optionB: "Nggak pernah bisa ngomong lagi selamanya"
  },
  {
    optionA: "Kembali ke masa lalu tapi nggak bisa ubah apapun",
    optionB: "Lihat masa depan tapi nggak bisa cerita ke siapapun"
  },
  {
    optionA: "Jadi orang paling pintar tapi nggak punya teman",
    optionB: "Jadi orang biasa tapi punya banyak teman"
  },
  {
    optionA: "Punya kemampuan terbang tapi cuma 1 meter dari tanah",
    optionB: "Bisa teleport tapi cuma ke tempat yang pernah dikunjungi"
  },
  {
    optionA: "Makan makanan favorit kamu setiap hari selamanya",
    optionB: "Nggak pernah makan makanan favorit lagi tapi bisa makan apapun"
  },
  {
    optionA: "Hidup di dunia Harry Potter",
    optionB: "Hidup di dunia Marvel/DC"
  },
  {
    optionA: "Punya uang 1 miliar tapi nggak bisa beli gadget",
    optionB: "Punya semua gadget terbaru tapi nggak punya uang cash"
  },
  {
    optionA: "Ketahuan lagi ngorok di meeting/kelas online",
    optionB: "Ketahuan lagi nge-stalk crush di depan banyak orang"
  },
  {
    optionA: "Nggak bisa pakai HP selama 1 tahun",
    optionB: "Nggak bisa makan makanan favorit selama 5 tahun"
  },
  {
    optionA: "Jadi YouTuber terkenal tapi semua video cringe",
    optionB: "Jadi streamer biasa tapi konten berkualitas"
  },
  {
    optionA: "Bisa ngomong semua bahasa di dunia",
    optionB: "Bisa main semua alat musik di dunia"
  },
  {
    optionA: "Hidup di dunia tanpa deadline",
    optionB: "Hidup di dunia tanpa WiFi"
  },
  {
    optionA: "Punya superpower tapi cuma berlaku di hari Senin",
    optionB: "Bisa time travel tapi cuma 5 menit ke masa lalu"
  },
  {
    optionA: "Selalu menang suit/gunting-batu-kertas",
    optionB: "Selalu dapet parking spot terdepan"
  },
  {
    optionA: "Nggak bisa makan pedas selamanya",
    optionB: "Nggak bisa makan manis selamanya"
  },
  {
    optionA: "Ketemu idola kamu tapi cuma 10 detik",
    optionB: "Video call sama idola kamu selama 1 jam tapi nggak boleh screenshot"
  },
  {
    optionA: "Punya robot asisten pribadi",
    optionB: "Punya mobil terbang"
  },
  {
    optionA: "Jadi karakter NPC di game favorit kamu",
    optionB: "Jadi main character di game yang kamu benci"
  },
  {
    optionA: "Nggak bisa nonton YouTube selamanya",
    optionB: "Nggak bisa scroll TikTok/Instagram selamanya"
  },
  {
    optionA: "Selalu kebangun jam 5 pagi setiap hari",
    optionB: "Nggak bisa tidur sebelum jam 3 pagi setiap hari"
  },
  {
    optionA: "Hidup di era tahun 80an",
    optionB: "Hidup di tahun 2080"
  },
  {
    optionA: "Punya ingatan fotografis (ingat semua hal)",
    optionB: "Bisa melupakan memori apapun yang kamu mau"
  },
  {
    optionA: "Jadi kucing selama seminggu",
    optionB: "Jadi burung selama seminggu"
  },
  {
    optionA: "Harus selalu pakai kostum cosplay ke mana-mana",
    optionB: "Harus selalu pakai piyama ke mana-mana"
  },
  {
    optionA: "Nggak bisa pakai emoji selamanya",
    optionB: "Setiap chat harus pakai minimal 5 emoji"
  },
  {
    optionA: "Punya unlimited storage di cloud",
    optionB: "Punya unlimited bandwidth internet"
  },
  {
    optionA: "Bisa masak makanan apapun dengan sempurna",
    optionB: "Bisa nyanyi dengan suara sempurna"
  },
  {
    optionA: "Ketahuan nge-stalk mantan jam 3 pagi",
    optionB: "Ketahuan nangis nonton film romance di bioskop"
  },
  {
    optionA: "Hidup tanpa AC/kipas angin",
    optionB: "Hidup tanpa air panas"
  },
  {
    optionA: "Jadi pro player esports tapi game yang nggak populer",
    optionB: "Jadi casual player tapi di game paling populer"
  },
  {
    optionA: "Nggak bisa copy-paste selamanya",
    optionB: "Nggak bisa undo (Ctrl+Z) selamanya"
  },
  {
    optionA: "Semua impian kamu jadi kenyataan tapi kamu lupa semuanya",
    optionB: "Ingat semua impian kamu tapi nggak ada yang jadi kenyataan"
  },
  {
    optionA: "Hanya bisa pakai dark mode selamanya",
    optionB: "Hanya bisa pakai light mode selamanya"
  },
  {
    optionA: "Punya waktu tambahan 2 jam setiap hari",
    optionB: "Bisa skip 1 hari kerja/sekolah setiap minggu"
  },
  {
    optionA: "Jadi admin di server Discord terbesar di dunia",
    optionB: "Punya server kecil tapi isinya teman-teman dekat semua"
  },
  {
    optionA: "Bisa rewind percakapan yang udah dikirim",
    optionB: "Bisa preview reaksi orang sebelum ngirim chat"
  },
  {
    optionA: "Main game tanpa lag selamanya tapi grafik potato",
    optionB: "Grafik ultra HD tapi lag 200ms terus"
  },
  {
    optionA: "Nggak bisa pakai headset/earphone selamanya",
    optionB: "Nggak bisa pakai speaker selamanya"
  },
  {
    optionA: "Dapet 100 juta tapi harus off internet 1 tahun",
    optionB: "Dapet 10 juta tapi boleh tetap online"
  },
  {
    optionA: "Bisa nge-hack tapi cuma buat kebaikan",
    optionB: "Bisa bikin app apapun tapi butuh waktu 1 tahun per app"
  },
  {
    optionA: "Ketemu semua member server ini IRL",
    optionB: "Dapat badge eksklusif Discord yang super langka"
  },
  {
    optionA: "Keyboard mekanikal unlimited tapi mouse biasa",
    optionB: "Mouse gaming terbaik tapi keyboard membrane"
  },
  {
    optionA: "Nggak bisa pakai stiker Discord selamanya",
    optionB: "Nggak bisa pakai GIF selamanya"
  },
  {
    optionA: "Selalu rank 1 di leaderboard tapi nggak ada yang tahu",
    optionB: "Selalu rank 2 tapi semua orang tahu dan kagum"
  },
  {
    optionA: "Bisa pause kehidupan nyata kayak game",
    optionB: "Punya save point di kehidupan nyata"
  },
  {
    optionA: "Nggak bisa skip iklan YouTube selamanya",
    optionB: "Nggak bisa skip intro Netflix selamanya"
  },
  {
    optionA: "Jadi orang paling jago masak di keluarga",
    optionB: "Jadi orang paling jago repair elektronik di keluarga"
  }
];

module.exports = {
  truths,
  dares,
  wouldYouRather
};
