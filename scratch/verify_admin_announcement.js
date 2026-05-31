const { EmbedBuilder } = require('discord.js');
const embeds = require('../stockmarket/embeds');

function assert(condition, message) {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
  console.log(`✅ OK: ${message}`);
}

async function runTests() {
  console.log('🏁 Memulai Pengujian Fungsi Pembuat Embed Pengumuman Tindakan Global...\n');

  // Setup Mock User
  const mockAdminUser = {
    username: 'JoeAdmin',
    displayAvatarURL: (opts) => 'https://cdn.discordapp.com/embed/avatars/0.png'
  };

  // TEST 1: Tindakan Ekonomi Global (Bansos)
  console.log('=== TEST 1: Tindakan Ekonomi Global (Bansos) ===');
  const embedBansos = embeds.globalActionAnnouncementEmbed(
    mockAdminUser,
    '💸 Bansos Massal (Kekayaan Terbatas)',
    'Administrator mendistribusikan bantuan sosial (bansos) koin kepada member dengan kekayaan terbatas.',
    '#00FF88',
    [
      { name: 'Batas Kekayaan Maksimal', value: 'Rp 2.000', inline: true },
      { name: 'Nominal Bansos per Orang', value: 'Rp 2.000', inline: true },
      { name: 'Jumlah Penerima', value: '5 member', inline: true }
    ],
    false
  );

  assert(embedBansos instanceof EmbedBuilder, 'Hasil pemanggilan harus berupa instance EmbedBuilder');
  assert(embedBansos.data.title === '📢 PENGUMUMAN TINDAKAN EKONOMI GLOBAL', 'Title sesuai untuk tindakan ekonomi');
  assert(embedBansos.data.color === 0x00FF88, 'Warna embed sesuai dengan parameter input hex');
  assert(embedBansos.data.fields.length === 3, 'Jumlah field detail sesuai');
  assert(embedBansos.data.author.name === 'JoeAdmin', 'Nama author sesuai dengan adminUser');

  // TEST 2: Tindakan Hukum Global (Reset Heist)
  console.log('\n=== TEST 2: Tindakan Hukum/Hukuman Global (Reset Heist) ===');
  const embedResetHeist = embeds.globalActionAnnouncementEmbed(
    mockAdminUser,
    '🚨 Reset Cooldown Global Bank Heist',
    'Cooldown global untuk melakukan perampokan bank server telah direset. Bank Heist kini siap untuk kembali dirampok oleh warga!',
    '#3498db',
    [],
    true
  );

  assert(embedResetHeist instanceof EmbedBuilder, 'Hasil pemanggilan harus berupa instance EmbedBuilder');
  assert(embedResetHeist.data.title === '🚨 PENGUMUMAN REGULASI HUKUM GLOBAL', 'Title sesuai untuk tindakan hukum/hukuman');
  assert(embedResetHeist.data.color === 0x3498DB, 'Warna embed sesuai dengan parameter input hex');
  assert(embedResetHeist.data.fields === undefined || embedResetHeist.data.fields.length === 0, 'Tidak memiliki fields opsional jika dikosongkan');

  console.log('\n🎉 Pengujian Unit Pembuat Embed Pengumuman Berhasil!');
}

runTests().catch(err => {
  console.error('\n❌ Pengujian gagal dengan error:');
  console.error(err);
  process.exit(1);
});
