const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  const publicChannelId = '1509770711839805641'; // Saluran pengumuman publik
  const channel = await client.channels.fetch(publicChannelId).catch(err => {
    console.error("Gagal mengambil channel pengumuman:", err.message);
    process.exit(1);
  });
  
  if (!channel) {
    console.error("Channel pengumuman tidak ditemukan.");
    process.exit(1);
  }

  console.log(`Menghubungkan ke saluran: ${channel.name}`);

  // Bersihkan channel terlebih dahulu agar rapi dan estetik
  console.log("Memulai pembersihan (purging) channel pengumuman...");
  try {
    const fetched = await channel.messages.fetch({ limit: 50 });
    if (fetched.size > 0) {
      console.log(`Mengambil ${fetched.size} pesan untuk dihapus...`);
      try {
        await channel.bulkDelete(fetched);
        console.log("Bulk delete sukses.");
      } catch (err) {
        console.log("Bulk delete gagal (pesan >14 hari), menghapus satu-persatu...");
        for (const msg of fetched.values()) {
          await msg.delete().catch(e => console.error("Gagal hapus pesan:", e.message));
          await new Promise(r => setTimeout(r, 200)); // anti rate limit
        }
      }
    }
  } catch (err) {
    console.error("Gagal membersihkan channel:", err.message);
  }
  console.log("✅ Pembersihan selesai!");

  // Lampirkan aset gambar retro pixel art yang kita buat secara premium
  const imagePath = '/Users/joefany/.gemini/antigravity-ide/brain/a7441e53-d8a3-4acf-983a-048b5c95c537/pet_heist_art_1780240188059.png';
  const file = new AttachmentBuilder(imagePath, { name: 'pet_heist_art.png' });

  // Bangun embed pengumuman resmi premium V2
  const embed = new EmbedBuilder()
    .setColor(0x10B981) // Premium Mint Emerald Green
    .setTitle('🛡️ RELEASE UPDATE: PLAYER HAPPINESS & AUTOMATIC STOCK MARKET 🛡️')
    .setThumbnail('https://cdn-icons-png.flaticon.com/512/3037/3037233.png')
    .setImage('attachment://pet_heist_art.png')
    .setDescription(
      `👋 **Halo Warga Kosan 1A & Para Petualang!**\n` +
      `Dewan Kota Sentinel resmi meluncurkan paket pembaruan keseimbangan game (**Player Happiness & Dynamic Market**) demi menghadirkan iklim bermain yang jauh lebih seru, menguntungkan, dan adiktif bagi kita semua!\n\n` +
      `*Pembaruan ini telah aktif secara penuh dan instan di seluruh penjuru server! Berikut adalah catatan pembaruan resmi:*`
    )
    .addFields(
      {
        name: '🪙 1. PENDAPATAN KOIN & DAILY NAIK (ECONOMY BOOSTER)',
        value: 
          `💰 **Daily Claim**: \`Rp 15 - Rp 35\` ➔ **\`Rp 35 - Rp 75\`** / hari!\n` +
          `💬 **Chat Earning**: \`Rp 1 - Rp 4\` ➔ **\`Rp 2 - Rp 5\`** / pesan chat.\n` +
          `⏱️ **Cooldown Chat**: \`45 detik\` ➔ **\`40 detik\`** (obrolan mengalir deras!).\n` +
          `🎙️ **Voice Earning**: \`Rp 1 / 5m\` ➔ **\`Rp 2 / 5m\`** (Limit harian: **\`Rp 40\`**).`,
        inline: false
      },
      {
        name: '🥷 2. PENYEIMBANGAN HUKUM PERAMPOKAN (ROBBERY REBALANCE)',
        value:
          `🎯 **Sukses Solo Rob**: Peluang naik dari \`40%\` ➔ **\`45%\`** dasar!\n` +
          `🏚️ **Tanpa Linggis**: Penalti diperingan dari \`-25%\` ➔ **\`-18%\`** (sisa \`27%\` sukses dasar).\n` +
          `🛠️ **Dengan Linggis**: Peluang sukses bertambah kokoh hingga **\`60%\`**!\n` +
          `⛓️ **Tahanan Lapas Solo**: Dipotong dari \`30 menit\` ➔ **\`15 menit\`** saja!\n` +
          `💸 **Tebusan Jaminan Solo**: \`Rp 500\` ➔ **\`Rp 250\`** koin.\n` +
          `🌋 **Tahanan & Tebusan Heist**: Kini hanya **\`30 menit\`** dengan tebusan **\`Rp 500\`**!`,
        inline: false
      },
      {
        name: '🐾 3. KELANGKAAN TRAIT PET & PASIF BARU (TAMAGOTCHI BUFFS)',
        value:
          `🥚 **Trait Telur Toko (Hatch)**: Peluang dapat trait naik \`15%\` ➔ **\`35%\`**!\n` +
          `🧬 **Trait Breeding (Kawin)**: Peluang mewarisi trait naik \`30%\` ➔ **\`50%\`**!\n` +
          `🦖 **Mutant**: Peningkatan koin kerja/berburu naik \`+10%\` ➔ **\`+15%\`**!\n` +
          `🧠 **Genius**: Pemotongan target XP naik level diperbesar \`-15%\` ➔ **\`-20%\`**!\n` +
          `⚔️ **Warrior**: Peningkatan Attack duel PvP naik \`+10%\` ➔ **\`+15%\`**!\n` +
          `🛡️ **Sturdy (Baru)**: Mengurangi penyusutan status lapar/haus pet sebesar **\`40%\`** (pet jarang sakit/pingsan) & meningkatkan **\`+15% PvP Defense\`**!`,
        inline: false
      },
      {
        name: '🔮 4. GACHA ROLE LEBIH RAMAH & PRESTISE TERJAGA (PRESTIGE GACHA)',
        value:
          `🎰 **Zonk Rate**: Diturunkan drastis dari \`75%\` ➔ **\`60%\`** (Pelahang dapet role **\`40%\`**!).\n` +
          `👑 **Kasta Dewa Tetap Langka**: Kasta role atas diatur sangat eksklusif:\n` +
          `   └─ *Common: \`73%\` | Rare: \`20%\` | Epic: \`5.6%\` | Legendary: \`1.1%\` | Mythic: \`0.3%\`*\n` +
          `🗑️ **Humor Zonk**: Ditambahkan lore deskripsi barang rongsokan kocak saat Zonk agar Anda tetap terhibur!`,
        inline: false
      },
      {
        name: '📈 5. BURSA SAHAM FULL OTOMATIS & DIVIDEN CHAT (DYNAMIC MARKET)',
        value:
          `📊 **Pergerakan Otomatis**: Harga saham kini naik turun otomatis setiap 2 jam mengikuti bursa nyata (45% naik, 45% turun, 10% siklus ekstrem).\n` +
          `💬 **Dividen Chat**: Keaktifan chat tetap berharga! Semakin ramai channel chat, **Dividen Mingguan** saham channel tersebut dilipatgandakan hingga **\`9%\`** dari harga per lembar bagi para investor pemegang (*hold*) saham!`,
        inline: false
      }
    )
    .setFooter({ text: 'Sentinel Bot 2026 • Kebahagiaan Warga Kosan 1A', iconURL: channel.guild.iconURL({ dynamic: true }) || null })
    .setTimestamp();

  await channel.send({
    content: '@everyone',
    embeds: [embed],
    files: [file],
    allowedMentions: { parse: ['everyone'] }
  });

  console.log("✅ Public Announcement successfully posted with premium fields!");
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error("Gagal login:", err.message);
  process.exit(1);
});
