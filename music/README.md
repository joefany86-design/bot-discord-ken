# Folder Musik Bot Discord

Folder ini digunakan untuk menyimpan file audio lokal yang ingin Anda putar secara otomatis dan terus-menerus (looping) ketika bot Discord bergabung (join) ke dalam Voice Channel.

## 🎵 Cara Menggunakan
1. Masukkan file musik Anda ke dalam folder `music/` ini.
2. Bot mendukung berbagai format audio populer, seperti:
   - `.mp3` (Sangat direkomendasikan)
   - `.wav`
   - `.ogg`
   - `.m4a`
3. Jika Anda memasukkan lebih dari satu file, bot akan memutarnya secara berurutan dan mengulangnya kembali dari awal jika semua file telah selesai diputar.
4. Jika folder ini kosong, bot akan tetap berjalan normal tetapi akan memunculkan peringatan di log dan memberi tahu Anda bahwa folder musik kosong.

## ⚙️ Cara Kerja Bot saat Memutar Musik Lokal
- **Auto-Play**: Cukup panggil bot ke dalam voice channel menggunakan perintah `.join` atau slash command `/join`. Bot akan langsung memutar file musik dari folder ini.
- **Smart Pause & Resume (TTS)**: Jika Anda menggunakan perintah TTS (`.speak` atau `/speak`), musik lokal akan dijeda sementara secara otomatis, bot membacakan teks Anda, dan melanjutkan kembali pemutaran musik secara mulus.
- **Smart Pause & Resume (YouTube)**: Jika Anda memutar musik YouTube melalui `/play` atau `.play`, musik lokal akan dijeda. Begitu antrian YouTube habis (`finish`), bot akan otomatis memainkan kembali musik dari folder lokal ini.
