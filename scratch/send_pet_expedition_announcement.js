require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const ANNOUNCEMENT_CHANNEL_ID = '1510920596127481988';

client.once('ready', async () => {
  console.log(`🤖 Login berhasil sebagai ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(ANNOUNCEMENT_CHANNEL_ID);
    if (!channel) {
      console.error('❌ Saluran pengumuman tidak ditemukan.');
      process.exit(1);
    }

    console.log(`📢 Mengirim pengumuman Sistem Pet Ekspedisi Premium ke #${channel.name}...`);

    // Load epic map banner (Map 10 - Dimensi Kosmik)
    const mapPath = path.join(__dirname, '../assets/maps/map10.png');
    const attachments = [];
    if (fs.existsSync(mapPath)) {
      attachments.push(new AttachmentBuilder(mapPath, { name: 'map10.png' }));
      console.log('✅ Aset map10.png berhasil dimuat.');
    } else {
      console.warn('⚠️ Aset map10.png tidak ditemukan di lokal.');
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // EMBED 1: PENGANTAR & FITUR UTAMA
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const embed1 = new EmbedBuilder()
      .setColor('#7C4DFF') // Deep Purple / Neon
      .setTitle('🦖 BIG UPDATE: PET EKSPEDISI CO-OP RPG ⚔️')
      .setDescription(
        `Halo @everyone! 👋✨\n\n` +
        `Sistem **Ekspedisi Pet** (\`.pet expedition\`) telah dirombak secara besar-besaran menjadi game **Co-op PvE RPG** yang seru, menantang, penuh visual, dan membutuhkan kerja sama tim yang solid! Bersiaplah menghadapi ancaman Bos Penjaga di setiap peta!`
      )
      .addFields(
        {
          name: '🗺️ 10 Peta Zona Baru & Ilustrasi Visual',
          value: '> Peta diperluas dari 4 menjadi **10 zona petualangan** (Level 1 hingga 150+). Setiap zona kini memiliki **gambar ilustrasi peta dinamis** yang indah langsung di layar embed ekspedisi Anda!',
          inline: false
        },
        {
          name: '⚔️ Sequential Active QTE (Boss Fight)',
          value: '> Pertempuran bos akhir (Stage 3) dirombak total menjadi berbasis giliran aktif! Target pet harus menekan tombol **`⚡ Lepaskan Skill Pet`** dalam batas waktu reaksi **6 detik**.',
          inline: false
        },
        {
          name: '💀 Risiko Kematian & Blame System',
          value: '> **Jangan salah klik!** Jika kru lain salah klik (*Interference*) atau *Timeout* (AFK), pertempuran langsung gagal. Pet Anda berisiko **Meninggal Dunia (`DEAD`, HP 0)** kecuali dilindungi item **Jimat Keberuntungan** (\`LUCKY_AMULET\`) atau memiliki trait **\`SURVIVOR\`**.',
          inline: false
        },
        {
          name: '💰 Dynamic Reward (Solo vs Co-op)',
          value: '> • **Solo (1 Pet)**: Koin & XP dipotong **70%** (anti-farming mandiri).\n> • **Co-op (2+ Pet)**: Seluruh kru mendapatkan bonus **+50%** (total 150%) koin & XP bersih per orang! Semakin ramai semakin untung!',
          inline: false
        },
        {
          name: '🔒 Proteksi Command Lock Channel',
          value: '> Selama ekspedisi berlangsung, semua command bot lain di channel tersebut otomatis dikunci dan dihapus demi menjaga kelancaran alur cerita ekspedisi.',
          inline: false
        },
        {
          name: '⚡ XP Booster Instan Level-Up',
          value: '> Menggunakan item XP Booster (\`XP_2X\` s/d \`XP_8X\`) di toko pet sekarang memberikan **level up/XP instan secara langsung** berbasis level pet Anda, di samping pengali XP permanen.',
          inline: false
        }
      )
      .setImage('attachment://map10.png')
      .setTimestamp()
      .setFooter({ text: 'Kosan 1A RPG • Pet Ekspedisi Update' });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // EMBED 2: PANDUAN TAKTIS BERMAIN
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const embed2 = new EmbedBuilder()
      .setColor('#00E676') // Neon Green
      .setTitle('🧭 PANDUAN TAKTIS: CARA BERMAIN EKSPEDISI')
      .setDescription('Ikuti panduan taktis berikut untuk menaklukkan ekspedisi bersama kru Anda:')
      .addFields(
        {
          name: '📝 1. Persiapan Awal',
          value: 'Ketik **`.pet`** untuk mengecek status pet aktif Anda. Pastikan pet sehat (**HP >= 40**, tidak sedang `DEAD`/`EGG`). Siapkan koin ransum perbekalan sebesar **Rp 250**.',
          inline: false
        },
        {
          name: '🛡️ 2. Buka Lobi / Gabung Kru',
          value: 'Ketik **`.pet expedition <ID>`** (Contoh: \`.pet expedition 1\` untuk Hutan Pemula). Teman Anda dapat bergabung ke lobi dengan mengklik tombol **`🛡️ Ikut Ekspedisi`**.',
          inline: false
        },
        {
          name: '🛣️ 3. Stage 1 & 2 (Petualangan)',
          value: '• **Stage 1 (Jalur)**: Pemimpin tim memilih rute (Aman, Pintas, Rawa).\n• **Stage 2 (Kejadian)**: Kejadian acak seperti peti terkunci (gunakan Lockpick) atau air terjun segar pemulih HP.',
          inline: false
        },
        {
          name: '⚡ 4. Stage 3 (Pertempuran QTE)',
          value: 'Perhatikan layar instruksi baik-baik! **HANYA** target giliran yang boleh menekan tombol skill. Salah klik atau giliran akan langsung membantai tim dan membunuh pet Anda!',
          inline: false
        }
      )
      .setTimestamp()
      .setFooter({ text: 'Kosan 1A RPG • Hubungi Dokter Pet (.pet dokter) jika pet Anda tewas' });

    // Kirim embed pengumuman
    await channel.send({ content: '@everyone', embeds: [embed1, embed2], files: attachments });

    console.log('✅ Pengumuman Sistem Pet Ekspedisi berhasil terkirim!');
    process.exit(0);

  } catch (err) {
    console.error('❌ Gagal mengirim pengumuman:', err);
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN).catch(e => {
  console.error("Login failed:", e.message);
  process.exit(1);
});
