require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const ANNOUNCEMENT_CHANNEL_ID = '1509770711839805641';

client.once('ready', async () => {
  console.log(`🤖 Login berhasil sebagai ${client.user.tag}`);

  try {
    const channel = await client.channels.fetch(ANNOUNCEMENT_CHANNEL_ID);
    if (!channel) {
      console.error('❌ Saluran pengumuman tidak ditemukan.');
      process.exit(1);
    }

    console.log(`📢 Mengirim pengumuman Sistem Gacha Role ke #${channel.name}...`);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // EMBED 1: HEADER & PENJELASAN SISTEM
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const embed1 = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🎰 PANDUAN LENGKAP: SISTEM GACHA ROLE PREMIUM 🎰')
      .setDescription(
        `Halo @everyone! 👋✨\n\n` +
        `Berikut adalah panduan lengkap **Sistem Gacha Role Premium** — sebuah fitur eksklusif yang memberikan berbagai keuntungan spesial kepada pemiliknya di seluruh aspek ekonomi server!\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🎲 **CARA MENDAPATKAN ROLE**\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Ketik perintah \`.gacha\` untuk memutar mesin gacha!\n\n` +
        `*   🪙 **Biaya Per Spin**: **Rp 800**\n` +
        `*   🎯 **Peluang Menang**: **25%** (75% kemungkinan ZONK)\n` +
        `*   💸 **Cashback Duplikat**: Jika mendapat role yang sudah dimiliki, Anda mendapatkan **cashback Rp 150**\n` +
        `*   🏆 **Prioritas Tier**: Jika Anda memiliki lebih dari satu role, sistem akan menggunakan **tier tertinggi** sebagai bonus aktif Anda\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📊 **PROBABILITAS DROP RATE**\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `\`\`\`\n` +
        `┌────────────────┬──────────────┐\n` +
        `│    TIER        │  DROP RATE   │\n` +
        `├────────────────┼──────────────┤\n` +
        `│ ⚪ COMMON      │    81.5%     │\n` +
        `│ 🟢 RARE        │    15.0%     │\n` +
        `│ 🟣 EPIC        │     3.0%     │\n` +
        `│ 🟡 LEGENDARY   │     0.5%     │\n` +
        `│ 🔴 MYTHIC      │     0.0%     │\n` +
        `└────────────────┴──────────────┘\n` +
        `\`\`\`\n` +
        `> ⚠️ *Drop rate dihitung dari 25% peluang menang. MYTHIC tidak bisa didapat dari gacha biasa — hanya tersedia melalui event khusus atau pemberian Owner!*`
      )
      .setTimestamp()
      .setFooter({ text: 'Kosan 1A Finance • Panduan Gacha Role Premium' });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // EMBED 2: COMMON & RARE
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const embed2 = new EmbedBuilder()
      .setColor('#A8A8A8')
      .setTitle('⚪ TIER COMMON — Role Pemula')
      .setDescription(
        `Role dasar yang memberikan sedikit keunggulan awal bagi pemiliknya.\n\n` +
        `\`\`\`\n` +
        `┌──────────────────────────┬────────────┐\n` +
        `│ 💬 Chat Earn Bonus       │ +1 Rp/msg  │\n` +
        `│ 🗡️ Rob Success Rate      │ +2%        │\n` +
        `│ 🐾 Pet XP (Work & Hunt)  │ +10%       │\n` +
        `└──────────────────────────┴────────────┘\n` +
        `\`\`\``
      );

    const embed3 = new EmbedBuilder()
      .setColor('#2ECC71')
      .setTitle('🟢 TIER RARE — Role Berkelas')
      .setDescription(
        `Peningkatan signifikan di banyak aspek ekonomi dan perlindungan.\n\n` +
        `\`\`\`\n` +
        `┌──────────────────────────┬────────────┐\n` +
        `│ 💬 Chat Earn Bonus       │ +2 Rp/msg  │\n` +
        `│ 🗡️ Rob Success Rate      │ +5%        │\n` +
        `│ 🛡️ Proteksi Dirampok     │ -10%       │\n` +
        `│ ⏱️ Durasi Penjara        │ -10%       │\n` +
        `│ 💸 Pajak Transfer        │ -1%        │\n` +
        `│ 📈 Pajak Jual Saham      │ -1%        │\n` +
        `│ 🐾 Pet XP (Work & Hunt)  │ +20%       │\n` +
        `│ 🥤 Risiko Sakit Soda     │ 35% → 25%  │\n` +
        `└──────────────────────────┴────────────┘\n` +
        `\`\`\``
      );

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // EMBED 3: EPIC
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const embed4 = new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle('🟣 TIER EPIC — Role Elite')
      .setDescription(
        `Keuntungan besar di seluruh aspek — mulai dari pendapatan pet hingga perbankan!\n\n` +
        `\`\`\`\n` +
        `┌──────────────────────────┬────────────┐\n` +
        `│ 💬 Chat Earn Bonus       │ +3 Rp/msg  │\n` +
        `│ 🗡️ Rob Success Rate      │ +8%        │\n` +
        `│ 🛡️ Proteksi Dirampok     │ -20%       │\n` +
        `│ ⏱️ Durasi Penjara        │ -20%       │\n` +
        `│ 💰 Biaya Tebus Penjara   │ -15%       │\n` +
        `│ 💸 Pajak Transfer        │ -2%        │\n` +
        `│ 📈 Pajak Jual Saham      │ -3%        │\n` +
        `│ 🐾 Pet Earnings (W & H)  │ +10%       │\n` +
        `│ 🐾 Pet XP (Work & Hunt)  │ +30%       │\n` +
        `│ 🏦 Bank Interest Cap     │ +5,000 Rp  │\n` +
        `│ 🥤 Risiko Sakit Soda     │ 35% → 15%  │\n` +
        `└──────────────────────────┴────────────┘\n` +
        `\`\`\``
      );

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // EMBED 4: LEGENDARY
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const embed5 = new EmbedBuilder()
      .setColor('#F1C40F')
      .setTitle('🟡 TIER LEGENDARY — Role Bangsawan')
      .setDescription(
        `Privilege kelas atas dengan perlindungan dan penghasilan luar biasa!\n\n` +
        `\`\`\`\n` +
        `┌──────────────────────────┬────────────┐\n` +
        `│ 💬 Chat Earn Bonus       │ +5 Rp/msg  │\n` +
        `│ 🗡️ Rob Success Rate      │ +15%       │\n` +
        `│ 🛡️ Proteksi Dirampok     │ -35%       │\n` +
        `│ ⏱️ Durasi Penjara        │ -35%       │\n` +
        `│ 💰 Biaya Tebus Penjara   │ -25%       │\n` +
        `│ 💸 Pajak Transfer        │ -3%        │\n` +
        `│ 📈 Pajak Jual Saham      │ -5%        │\n` +
        `│ 🐾 Pet Earnings (W & H)  │ +20%       │\n` +
        `│ 🐾 Pet XP (Work & Hunt)  │ +50%       │\n` +
        `│ 🏦 Bank Interest Cap     │ +15,000 Rp │\n` +
        `│ ☠️ Risiko Pet Mati Exped  │ 3% → 1%   │\n` +
        `│ 🥤 Risiko Sakit Soda     │ 35% → 5%   │\n` +
        `└──────────────────────────┴────────────┘\n` +
        `\`\`\``
      );

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // EMBED 5: MYTHIC
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const embed6 = new EmbedBuilder()
      .setColor('#E74C3C')
      .setTitle('🔴 TIER MYTHIC — Role Dewa ☀️')
      .setDescription(
        `**Tier tertinggi yang tidak bisa didapat dari gacha biasa!** Hanya tersedia melalui event khusus atau pemberian langsung dari Owner.\n\n` +
        `\`\`\`\n` +
        `┌──────────────────────────┬────────────┐\n` +
        `│ 💬 Chat Earn Bonus       │ +8 Rp/msg  │\n` +
        `│ 🗡️ Rob Success Rate      │ +25%       │\n` +
        `│ 🛡️ KEBAL TOTAL DIRAMPOK  │ IMMUNE ✦   │\n` +
        `│ ⏱️ Durasi Penjara        │ -50%       │\n` +
        `│ 💰 Biaya Tebus Penjara   │ -50%       │\n` +
        `│ 💸 Pajak Transfer        │ -5%        │\n` +
        `│ 📈 Pajak Jual Saham      │ -8%        │\n` +
        `│ 🐾 Pet Earnings (W & H)  │ +35%       │\n` +
        `│ 🐾 Pet XP (Work & Hunt)  │ +100% (2x) │\n` +
        `│ 🏦 Bank Interest Rate    │ +0.5%      │\n` +
        `│ 🏦 Bank Interest Cap     │ +30,000 Rp │\n` +
        `│ ☠️ Risiko Pet Mati Exped  │ 0% KEBAL ✦ │\n` +
        `│ 🥤 Risiko Sakit Soda     │ 0% KEBAL ✦ │\n` +
        `└──────────────────────────┴────────────┘\n` +
        `\`\`\`\n` +
        `> 🌟 *Pemilik MYTHIC adalah entitas kebal — tidak bisa dirampok, pet tidak bisa mati di ekspedisi, dan soda tidak pernah menyebabkan sakit!*`
      );

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // EMBED 6: FOOTER / TIPS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const embed7 = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('💡 TIPS & INFORMASI PENTING')
      .setDescription(
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📌 **CARA MEMULAI**\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*   Ketik \`.gacha\` di channel bot untuk memutar gacha\n` +
        `*   Pastikan saldo Anda minimal **Rp 800** sebelum spin\n` +
        `*   Gunakan \`.shop\` untuk melihat daftar role yang tersedia\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⚙️ **MEKANISME PRIORITAS TIER**\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*   Jika Anda memiliki **lebih dari satu role gacha**, sistem akan secara otomatis menggunakan **tier tertinggi** sebagai bonus aktif\n` +
        `*   Urutan prioritas: **MYTHIC > LEGENDARY > EPIC > RARE > COMMON**\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🎯 **STRATEGI CERDAS**\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*   💰 Kumpulkan koin dari chat, daily claim, dan pet work sebelum spin\n` +
        `*   📈 Role tier tinggi sangat menguntungkan untuk investor saham (pengurangan pajak jual besar!)\n` +
        `*   🗡️ Bagi perampok, role LEGENDARY/MYTHIC memberikan success rate yang sangat dominan\n` +
        `*   🐾 Bagi pecinta pet, bonus XP 2x dari MYTHIC mempercepat leveling secara drastis\n` +
        `*   🏦 Simpan koin di bank — role tier tinggi menambah batas bunga harian Anda!\n\n` +
        `Selamat bermain dan semoga keberuntungan berpihak pada Anda! 🎲🍀\n` +
        `*— Kosan 1A Finance Team ✨*`
      )
      .setTimestamp()
      .setFooter({ text: 'Kosan 1A Finance • Panduan Gacha Role Premium' });

    // Kirim semua embed
    await channel.send({ content: '@everyone', embeds: [embed1] });
    await channel.send({ embeds: [embed2, embed3] });
    await channel.send({ embeds: [embed4, embed5] });
    await channel.send({ embeds: [embed6, embed7] });

    console.log('✅ Seluruh embed pengumuman Gacha Role berhasil terkirim!');
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
