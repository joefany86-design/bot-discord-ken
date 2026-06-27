/**
 * Konfigurasi Onboarding (Customization Questions)
 * Ganti ID Role di bawah ini sesuai dengan ID Role yang ada di server Discord Anda.
 */
module.exports = {
  // Role ID yang diberikan setelah menyelesaikan Onboarding (Verified/Member)
  VERIFIED_ROLE_ID: '1422638848772542474', // Ganti dengan ID Role member/verified Anda

  // Role ID sementara untuk anggota baru yang belum terverifikasi (jika ada, opsional)
  // Jika diisi, role ini akan dihapus setelah menekan tombol "Selesai"
  UNVERIFIED_ROLE_ID: '', // Biarkan kosong jika tidak digunakan

  // Pertanyaan 1: Pemilihan Gender (Button)
  gender: {
    title: '🚻 Pilih Gender Anda',
    description: 'Silakan pilih gender Anda untuk mendapatkan role gender di server ini.',
    options: [
      {
        id: 'male',
        label: 'Laki-laki',
        emoji: '👨',
        style: 'Primary', // Primary, Secondary, Success, Danger
        roleId: '1422639148006854727' // Ganti dengan ID Role Laki-laki
      },
      {
        id: 'female',
        label: 'Perempuan',
        emoji: '👩',
        style: 'Danger',
        roleId: '1422639190104903721' // Ganti dengan ID Role Perempuan
      }
    ]
  },

  // Pertanyaan 2: Hobi / Interest (Select Menu - Multi Select)
  interests: {
    title: '🎨 Pilih Hobi & Interest',
    description: 'Pilih satu atau lebih hobi/interest yang paling sesuai dengan Anda.',
    placeholder: 'Pilih hobi Anda di sini...',
    minValues: 1,
    maxValues: 5,
    options: [
      {
        value: 'gamer',
        label: 'Gamer',
        description: 'Bermain game PC, Console, atau Mobile',
        emoji: '🎮',
        roleId: '1422639235889758299' // Ganti dengan ID Role Gamer
      },
      {
        value: 'music',
        label: 'Music Listener',
        description: 'Pecinta musik dan lagu santai',
        emoji: '🎧',
        roleId: '1422639281788289065' // Ganti dengan ID Role Music
      },
      {
        value: 'wibu',
        label: 'Anime / Wibu',
        description: 'Menonton anime, membaca manga, dll.',
        emoji: '🌸',
        roleId: '1422639316538097705' // Ganti dengan ID Role Wibu
      },
      {
        value: 'art',
        label: 'Artist / Designer',
        description: 'Menggambar, melukis, atau desain grafis',
        emoji: '🎨',
        roleId: '1422639352109858888' // Ganti dengan ID Role Art
      },
      {
        value: 'movie',
        label: 'Movie / Series Streamer',
        description: 'Suka menonton film, drama, atau serial TV',
        emoji: '🎬',
        roleId: '1422639391032999936' // Ganti dengan ID Role Movie
      }
    ]
  },

  // Pertanyaan 3: Regional / Wilayah Asal (Select Menu - Single Select)
  regional: {
    title: '🗺️ Pilih Wilayah Asal',
    description: 'Pilih wilayah asal atau tempat tinggal Anda saat ini.',
    placeholder: 'Pilih wilayah Anda di sini...',
    options: [
      {
        value: 'jawa',
        label: 'Jawa',
        description: 'DKI, Jabar, Jateng, Jatim, DIY, Banten',
        emoji: '🕌',
        roleId: '1422639432107954207' // Ganti dengan ID Role Regional Jawa
      },
      {
        value: 'sumatra',
        label: 'Sumatra',
        description: 'Aceh, Medan, Palembang, Lampung, dll.',
        emoji: '🌴',
        roleId: '1422639471014318181' // Ganti dengan ID Role Regional Sumatra
      },
      {
        value: 'kalimantan',
        label: 'Kalimantan',
        description: 'Pontianak, Samarinda, Banjarmasin, dll.',
        emoji: '🪵',
        roleId: '1422639511103340574' // Ganti dengan ID Role Regional Kalimantan
      },
      {
        value: 'sulawesi',
        label: 'Sulawesi',
        description: 'Makassar, Manado, Gorontalo, dll.',
        emoji: '🌊',
        roleId: '1422639551096131645' // Ganti dengan ID Role Regional Sulawesi
      },
      {
        value: 'balilombok',
        label: 'Bali & Nusa Tenggara',
        description: 'Bali, Lombok, Kupang, dll.',
        emoji: '🌅',
        roleId: '1422639591107436574' // Ganti dengan ID Role Regional Bali/Lombok
      },
      {
        value: 'other',
        label: 'Luar Indonesia / Wilayah Lain',
        description: 'Berasal dari luar wilayah di atas',
        emoji: '🌍',
        roleId: '1422639632111116298' // Ganti dengan ID Role Regional Lainnya
      }
    ]
  }
};
