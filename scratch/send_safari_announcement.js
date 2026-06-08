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
    // EMBED 1: BANNER & BIOMES
    // ═══════════════════════════════════════════
    const embedHeader = new EmbedBuilder()
      .setColor(0x7C4DFF) // Purple
      .setTitle('🌳  NEW UPDATE: WILD PET SAFARI ADVENTURE!  🦁')
      .setDescription(
        '```\n' +
        '╔══════════════════════════════════════╗\n' +
        '║  🐾 Jelajahi Biome & Tangkap Pet!   ║\n' +
        '║   🎮 Mini-game Taktis & Menantang!   ║\n' +
        '╚══════════════════════════════════════╝\n' +
        '```\n\n' +
        'Halo **Warga Kosan 1A!** 🏠✨\n\n' +
        'Kini kalian tidak perlu lagi hanya mengandalkan gacha telur untuk mendapatkan peliharaan baru! Telah resmi hadir fitur **Pet Safari** — sebuah petualangan interaktif di mana kalian bisa melacak, berinteraksi, dan menangkap pet liar secara langsung!\n\n' +
        '> 🕹️ **Mulai Berpetualang:** Ketik `.pet safari` atau `.safari` atau `.catch`!'
      )
      .addFields(
        {
          name: '🗺️ 4 Pilihan Wilayah (Biome)',
          value: 
            'Setiap wilayah memiliki biaya masuk, tingkat kesulitan tangkapan, dan spesies unik masing-masing:\n\n' +
            '🌳 **Hutan Hijau (Green Forest)**\n' +
            '• 🪙 *Biaya Masuk:* `GRATIS` (Sangat cocok untuk pemula!)\n' +
            '• 🐾 *Pet Liar:* Slime ⚪, Kucing ⚪, Golem ⚪/🟢\n\n' +
            '🌋 **Lembah Volcanic (Volcanic Valley)**\n' +
            '• 🪙 *Biaya Masuk:* `Rp 150`\n' +
            '• 🐾 *Pet Liar:* Naga 🟢, Phoenix 🟣, Behemoth 🟣\n\n' +
            '🌊 **Danau Abyss (Abyss Lake)**\n' +
            '• 🪙 *Biaya Masuk:* `Rp 150`\n' +
            '• 🐾 *Pet Liar:* Kura-Kura 🟢, Leviathan 🟡\n\n' +
            '⛰️ **Pegunungan Kuno (Ancient Peak)**\n' +
            '• 🪙 *Biaya Masuk:* `Rp 250`\n' +
            '• 🐾 *Pet Liar:* Behemoth 🟣, Archdragon 🟡\n\n' +
            '*Catatan: Warna emoji mewakili kelangkaan (⚪ Common, 🟢 Rare, 🟣 Epic, 🟡 Legendary).*',
          inline: false
        }
      )
      .setFooter({ text: '🤖 Sentinel Bot • Update Juni 2026' })
      .setTimestamp();

    // ═══════════════════════════════════════════
    // EMBED 2: GAMEPLAY MECHANICS & STRATEGY
    // ═══════════════════════════════════════════
    const embedGameplay = new EmbedBuilder()
      .setColor(0x3498DB) // Blue
      .setTitle('🎮  STRATEGI & CARA MENANGKAP  🎯')
      .setDescription(
        'Menangkap pet liar, terutama tingkat **Legendary 🟡**, sangatlah menantang dan butuh taktik jitu! Anda dibekali dengan:\n' +
        '🎒 **Perlengkapan:** 🥎 5x Safari Ball | 🍖 3x Safari Bait | 💫 3x Mainan Pet\n\n' +
        'Gunakan aksi berikut secara bijak di setiap giliran sebelum pet kabur:\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      )
      .addFields(
        {
          name: '🥎 Lempar Safari Ball',
          value: '```diff\n+ Mencoba menangkap pet langsung.\n- Mengurangi sisa bola Anda.\n```\n*Tip: Jangan langsung melempar bola ke pet langka tanpa persiapan!*',
          inline: true
        },
        {
          name: '🍖 Beri Umpan (Bait)',
          value: '```diff\n+ Meningkatkan Peluang Tangkap (+10%)\n+ Memberi makan 3x membuat pet TIDUR 💤\n- Ada sedikit risiko pet kabur saat mendekat.\n```\n*Status Tidur: 0% Risiko Kabur untuk 2 giliran!*',
          inline: true
        },
        {
          name: '\u200b',
          value: '\u200b',
          inline: false
        },
        {
          name: '🔎 Dekati Perlahan (Sneak)',
          value: '```diff\n+ Peluang Tangkap naik pesat (+15%)\n- Risiko kabur naik (+8%)\n- Ada peluang 20% pet kaget & langsung kabur!\n```',
          inline: true
        },
        {
          name: '💫 Goyang Mainan (Toy)',
          value: '```diff\n+ Meningkatkan Peluang Tangkap (+12%)\n+ Peluang 10% memberikan trait spesial!\n- Ada sedikit risiko pet kabur pasif.\n```',
          inline: true
        }
      )
      .setFooter({ text: '⚠️ Berpikir sebelum bertindak! Sesi safari dibatasi waktu 2 menit per giliran.' });

    // ═══════════════════════════════════════════
    // EMBED 3: DESTINY & REWARDS
    // ═══════════════════════════════════════════
    const embedDestiny = new EmbedBuilder()
      .setColor(0xE67E22) // Orange
      .setTitle('📥  PILIH NASIB PET TANGKAPAN: ADOPSI ATAU RILIS!  🕊️')
      .setDescription(
        'Setelah berhasil menangkap pet liar, Anda dapat menentukan nasibnya:\n\n' +
        '🥇 **1. ADOPSI (Simpan di Kandang)**\n' +
        '• Masukkan ke dalam kandang Anda (maksimal 3 slot pet).\n' +
        '• Pet langsung berstatus **BABY** yang aktif sehat bugar!\n' +
        '• **TANPA WAKTU TETAS!** Bisa langsung diajak bekerja (`.pet work`), dilatih (`.pet gym`), atau bertarung.\n\n' +
        '🥈 **2. RILIS & JUAL (Hadiah Insentif)**\n' +
        '• Lepaskan pet kembali ke alam liar untuk mendapatkan hadiah melimpah berdasarkan tingkat kelangkaannya:\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      )
      .addFields(
        {
          name: '⚪ Common',
          value: '```fix\nRp 250 - 450 Koin + 50 XP Pet Utama\n```',
          inline: true
        },
        {
          name: '🟢 Rare',
          value: '```fix\nRp 500 - 800 Koin + 120 XP Pet Utama + 50% Tiket Gacha\n```',
          inline: true
        },
        {
          name: '\u200b',
          value: '\u200b',
          inline: false
        },
        {
          name: '🟣 Epic',
          value: '```fix\nRp 900 - 1.500 Koin + 250 XP Pet Utama + 1x Tiket Gacha\n```',
          inline: true
        },
        {
          name: '🟡 Legendary',
          value: '```fix\nRp 2.000 - 3.500 Koin + 500 XP Pet Utama + 2x Tiket Gacha + 1x Soda Energi\n```',
          inline: true
        },
        {
          name: '\u200b',
          value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
          inline: false
        },
        {
          name: '💡 Tips & Ketentuan Penting',
          value:
            '• **XP Rilis** akan langsung disuntikkan ke **Pet Utama Aktif** Anda, cara terbaik untuk leveling cepat!\n' +
            '• **Trait Pet Safari** bisa berupa trait langka bawaan, atau didapatkan dengan melempar mainan (`💫 Goyang Mainan`).\n' +
            '• Ada cooldown **3 menit** setelah memulai sesi safari agar karakter Anda beristirahat.\n\n' +
            '*Selamat berburu, susun strategi terbaikmu, dan jadilah kolektor pet legendaris nomor satu di server!* 🏆🐾✨'
        }
      )
      .setFooter({ text: 'Sentinel Bot Team • Pet Safari System' })
      .setTimestamp();

    console.log('📤 Mengirim pengumuman...');

    await channel.send({ content: '@everyone', embeds: [embedHeader] });
    await channel.send({ embeds: [embedGameplay] });
    await channel.send({ embeds: [embedDestiny] });

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
