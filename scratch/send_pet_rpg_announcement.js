const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const CHANNEL_ID = '1510920596127481988';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once('ready', async () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) {
      console.error('❌ Channel not found!');
      process.exit(1);
    }

    // ═══════════════════════════════════════════
    // EMBED 1: HEADER / BANNER UTAMA
    // ═══════════════════════════════════════════
    const embedHeader = new EmbedBuilder()
      .setColor(0x5865F2) // Discord Blurple
      .setTitle('📢  MAJOR UPDATE: PET RPG BATTLE SYSTEM  ⚔️')
      .setDescription(
        '```\n' +
        '╔══════════════════════════════════════╗\n' +
        '║   🐉 Pet Gym • World Boss • Tower   ║\n' +
        '║      ⚔️ 3 Fitur Baru Sekaligus! ⚔️     ║\n' +
        '╚══════════════════════════════════════╝\n' +
        '```\n\n' +
        'Halo **Warga Kosan 1A!** 🏠✨\n\n' +
        'Pet kalian kini bukan cuma teman peliharaan biasa — mereka resmi jadi **petarung RPG sejati!** 🐉🔥\n\n' +
        'Kami meluncurkan **3 fitur combat & progression baru** yang bikin pet kalian makin kuat, makin berguna, dan makin seru untuk dilatih.\n\n' +
        '> 📖 **Scroll ke bawah untuk baca penjelasan lengkap setiap fitur!**'
      )
      .setFooter({ text: '🤖 Sentinel Bot • Update Juni 2026' })
      .setTimestamp();

    // ═══════════════════════════════════════════
    // EMBED 2: PET GYM
    // ═══════════════════════════════════════════
    const embedGym = new EmbedBuilder()
      .setColor(0xED4245) // Merah — kekuatan
      .setTitle('💪  FITUR 1: PET GYM — Latih Stat Pet Kamu!')
      .setDescription(
        '> 🕹️ **Command:** `.pet gym`\n\n' +
        'Setiap kali pet naik level, dia mendapatkan **+3 Poin Latihan (TP)**.\n' +
        'Gunakan TP untuk melatih **4 stat combat** yang menentukan kekuatan pet kamu di pertempuran!\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      )
      .addFields(
        {
          name: '💪 Strength (STR)',
          value: '```diff\n+ Efek: +2 ATK damage per poin\n```\nMeningkatkan daya serang pet.',
          inline: true
        },
        {
          name: '❤️ Vitality (VIT)',
          value: '```diff\n+ Efek: +3 Max HP per poin\n```\nMeningkatkan darah maksimal pet.',
          inline: true
        },
        {
          name: '\u200b',
          value: '\u200b',
          inline: false
        },
        {
          name: '🛡️ Defense (DEF)',
          value: '```diff\n+ Efek: +0.5% Damage Reduction\n+ Maksimal: 50%\n```\nMengurangi damage yang diterima.',
          inline: true
        },
        {
          name: '⚡ Dexterity (DEX)',
          value: '```diff\n+ Efek: +0.5% Critical Rate\n+ Maksimal: 35%\n```\nCritical Hit = **1.5x damage!**',
          inline: true
        },
        {
          name: '\u200b',
          value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          inline: false
        },
        {
          name: '🔄 Reset Stat',
          value: 'Salah alokasi? Bisa direset kapan saja seharga **Rp 1.000 koin**.',
          inline: false
        },
        {
          name: '📝 Cara Pakai',
          value:
            '1️⃣ Ketik `.pet gym`\n' +
            '2️⃣ Klik tombol stat (+STR, +VIT, +DEF, +DEX)\n' +
            '3️⃣ Embed ter-update otomatis secara realtime!',
          inline: false
        }
      )
      .setFooter({ text: '⚠️ Pet harus hidup (BABY/ADULT) untuk masuk gym. Telur & pet mati tidak bisa dilatih.' });

    // ═══════════════════════════════════════════
    // EMBED 3: MENARA UJIAN (TOWER)
    // ═══════════════════════════════════════════
    const embedTower = new EmbedBuilder()
      .setColor(0xFEE75C) // Kuning emas — tower
      .setTitle('🏰  FITUR 2: MENARA UJIAN (Tower of Trials)')
      .setDescription(
        '> 🕹️ **Command:** `.pet tower`\n\n' +
        'Tantangan **Solo PVE bertingkat!** Uji kekuatan pet kamu dengan memanjat **50 lantai** menara yang dijaga monster tangguh.\n' +
        'Makin tinggi = makin susah = makin besar hadiahnya! 🎁\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      )
      .addFields(
        {
          name: '⚔️ Cara Bermain',
          value:
            '> Ketik `.pet tower` → klik **"Tantang Lantai"**\n\n' +
            '✅ **Menang** → Naik lantai, dapat **koin + XP pet**\n' +
            '❌ **Kalah** → HP pet berkurang, status jadi **LEMAS** (HP 1)',
          inline: false
        },
        {
          name: '🎫 Kuota Harian',
          value:
            '```\n' +
            '• 5 percobaan GRATIS per hari\n' +
            '• Kuota habis?\n' +
            '  → Pakai 🥤 Soda Energi Pet\n' +
            '  → Atau bayar Rp 500 koin\n' +
            '```',
          inline: true
        },
        {
          name: '🌟 Lantai Boss',
          value:
            '```\n' +
            '• Setiap kelipatan 5 lantai\n' +
            '  (5, 10, 15, 20, ...50)\n' +
            '• Hadiah BONUS item langka\n' +
            '  atau lootbox gratis! 🎁\n' +
            '```',
          inline: true
        },
        {
          name: '\u200b',
          value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          inline: false
        },
        {
          name: '💰 Tabel Hadiah Per Lantai',
          value:
            '```\n' +
            '┌──────────────┬────────────┬──────────────────┐\n' +
            '│ Lantai       │ Kesulitan  │ Hadiah Koin      │\n' +
            '├──────────────┼────────────┼──────────────────┤\n' +
            '│ 1 - 10       │ 🟢 Mudah   │ Rp 500 - 1.500   │\n' +
            '│ 11 - 20      │ 🟡 Sedang  │ Rp 2.000 - 4.500 │\n' +
            '│ 21 - 40      │ 🔴 Sulit   │ Rp 5.000 - 12K   │\n' +
            '│ 41 - 50      │ 💀 Ekstrim │ Rp 15K - 50K     │\n' +
            '└──────────────┴────────────┴──────────────────┘\n' +
            '```',
          inline: false
        },
        {
          name: '🧹 Sapu Bersih (Sweep)',
          value:
            'Males manjat manual? Klik **Sweep** sekali sehari!\n' +
            '→ Langsung dapat **10% total koin & XP** dari semua lantai yang pernah diselesaikan (maks Rp 15.000)\n\n' +
            '> ⚠️ Syarat: Hunger, Thirst, Happiness pet harus > 50%',
          inline: false
        }
      );

    // ═══════════════════════════════════════════
    // EMBED 4: WORLD BOSS RAID
    // ═══════════════════════════════════════════
    const embedRaid = new EmbedBuilder()
      .setColor(0xE67E22) // Orange — api/boss
      .setTitle('🌋  FITUR 3: WORLD BOSS RAID — Lawan Boss Bareng!')
      .setDescription(
        '> 🕹️ **Command:** `.pet raid`\n\n' +
        'Boss raksasa dengan **JUTAAN HP** muncul tiap minggu! 🔥\n' +
        'Seluruh warga server harus bersatu menyerangnya.\n' +
        '**Ini bukan solo — ini kerja tim satu server!** 💪\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      )
      .addFields(
        {
          name: '⚔️ Cara Bermain',
          value:
            '> Ketik `.pet raid` → klik **"Serang Boss"**\n\n' +
            '• Pet kamu otomatis bertarung **5 turn** vs Boss\n' +
            '• Damage kamu terakumulasi di **leaderboard**\n' +
            '• 🎫 **3 serangan gratis** per minggu\n' +
            '• 🥤 Tambah kesempatan pakai **Soda Energi** (maks +2)',
          inline: false
        },
        {
          name: '🔥 Tabel Elemen & Kelemahan Boss',
          value:
            '```\n' +
            '┌──────────────────┬────────┬─────────────────┐\n' +
            '│ Boss             │ Elemen │ Lemah Terhadap   │\n' +
            '├──────────────────┼────────┼─────────────────┤\n' +
            '│ 🌋 Volcanus      │ FIRE   │ 🌊 Pet WATER    │\n' +
            '│ ⛰️ Terrasaur     │ EARTH  │ 🌋 Pet FIRE     │\n' +
            '│ 🌊 Leviathan     │ WATER  │ ⛰️ Pet EARTH    │\n' +
            '│ 🌀 Aetherius     │ DRAGON │ — (Tidak ada)   │\n' +
            '└──────────────────┴────────┴─────────────────┘\n' +
            '```\n' +
            '> 💡 Gunakan pet dengan **elemen yang tepat** → bonus **+25% ATK!**',
          inline: false
        },
        {
          name: '\u200b',
          value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          inline: false
        },
        {
          name: '🏆 Hadiah Berdasarkan Peringkat Damage',
          value:
            '🥇 **Gold Tier** (Top 10% Damage)\n' +
            '```fix\n' +
            'Rp 6.000 - 10.000 + 2x Gacha + 15% Aksesoris Langka\n' +
            '```\n' +
            '🥈 **Silver Tier** (Top 30% Damage)\n' +
            '```fix\n' +
            'Rp 3.000 - 5.000 + 1x Tiket Gacha\n' +
            '```\n' +
            '🥉 **Bronze Tier** (Partisipasi)\n' +
            '```fix\n' +
            'Rp 1.000 - 2.000 + 1x Daging Premium\n' +
            '```',
          inline: false
        },
        {
          name: '🎁 Bonus Spesial',
          value:
            '🏆 **Bonus Kemenangan** — Jika Boss dikalahkan, SEMUA peserta dapat **+Rp 2.000 koin!**\n' +
            '💥 **Last Hit Bonus** — Serangan terakhir dapat **+Rp 3.000 koin** + gelar **⚔️ (Slayer)** permanen!',
          inline: false
        }
      );

    // ═══════════════════════════════════════════
    // EMBED 5: RINGKASAN COMMAND + TIPS
    // ═══════════════════════════════════════════
    const embedTips = new EmbedBuilder()
      .setColor(0x57F287) // Hijau — tips
      .setTitle('🕹️  RINGKASAN COMMAND & TIPS PEMULA')
      .setDescription(
        '```\n' +
        '╔══════════════════════════════════════╗\n' +
        '║  📋 COMMAND BARU YANG BISA DIPAKAI   ║\n' +
        '╠══════════════════════════════════════╣\n' +
        '║  .pet gym    → Panel latihan stat    ║\n' +
        '║  .pet tower  → Menara Ujian          ║\n' +
        '║  .pet raid   → World Boss Raid       ║\n' +
        '║  .pet-admin  → Panel Admin (Owner)   ║\n' +
        '╚══════════════════════════════════════╝\n' +
        '```'
      )
      .addFields(
        {
          name: '💡 Tips Untuk Pemula',
          value:
            '1️⃣ **Latih pet dulu!** → `.pet gym` sebelum bertarung\n' +
            '2️⃣ **Mulai dari Menara** → `.pet tower` cocok untuk solo grind\n' +
            '3️⃣ **Jangan lupa Raid!** → Cek `.pet raid` tiap minggu\n' +
            '4️⃣ **Perhatikan elemen** → Gunakan elemen yang tepat = +25% bonus\n' +
            '5️⃣ **Rawat pet kamu** → Pet lapar/haus tidak bisa bertarung!',
          inline: false
        }
      )
      .setFooter({ text: '🐉 Selamat bertualang! Semoga pet kamu jadi yang terkuat di server! 💪⚔️✨' })
      .setTimestamp();

    // ═══════════════════════════════════════════
    // KIRIM SEMUA EMBED
    // ═══════════════════════════════════════════
    console.log('📤 Mengirim pengumuman...');

    await channel.send({ embeds: [embedHeader] });
    await channel.send({ embeds: [embedGym] });
    await channel.send({ embeds: [embedTower] });
    await channel.send({ embeds: [embedRaid] });
    await channel.send({ embeds: [embedTips] });

    console.log('✅ Pengumuman berhasil dikirim ke channel ' + CHANNEL_ID);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('❌ Gagal login:', err.message);
  process.exit(1);
});
