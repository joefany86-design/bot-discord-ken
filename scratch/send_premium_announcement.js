const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config({ path: '/root/bot-discord-2026/.env' });

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  try {
    const channelId = '1510920596127481988';
    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      console.error('Channel not found');
      process.exit(1);
    }

    const embed = new EmbedBuilder()
      .setColor(0x6366F1) // Indigo premium color
      .setTitle('🏆 LIGA PvP ADMIN CUP — PANDUAN STRATEGIS MENDALAM 🏆')
      .setDescription(
        `Halo Warga Kosan 1A! 🐾⚔️\n\n` +
        `Liga PvP Admin Cup kini terintegrasi penuh dengan **Sistem Gym & Kustomisasi Stat Pet**! Pertarungan menggunakan sistem **Simultaneous Button Selection** (kedua pawang memilih aksi bersamaan, lalu ronde diselesaikan berdasarkan urutan kecepatan).\n\n` +
        `Berikut adalah panduan lengkap mekanik dan strategi terbaik untuk mendominasi arena turnamen:`
      )
      .addFields(
        {
          name: '📊 1. MEMAHAMI STATS PET DARI PUSAT KEBUGARAN (GYM)',
          value: 
            `💪 **Strength (STR)**: \`+2 Base ATK\` per poin STR. Memperbesar damage dasar.\n` +
            `❤️ **Vitality (VIT)**: \`+3 Max HP\` per poin VIT. Meningkatkan darah maksimal pet (\`getMaxHP\`).\n` +
            `🛡️ **Defense (DEF)**: \`+0.5% damage reduction\` per poin DEF. Maksimal **50% reduksi** (pada 100 DEF).\n` +
            `⚡ **Dexterity (DEX)**: Menentukan **SPD (Speed)** pertempuran. Juga meningkatkan **Crit Rate** sebesar \`+0.5%\` per poin (maksimal **35% Crit Rate** pada 70 DEX).`
        },
        {
          name: '🕹️ 2. MEMILIH AKSI DENGAN CERMAT (4 TOMBOL DUEL)',
          value:
            `🗡️ **Serang (Basic Attack)**: Damage standar (**ATK vs DEF**). Aman, konsisten, bisa Crit, dan tidak memiliki peluang meleset bawaan.\n` +
            `🔥 **Ultimate (Jurus Pamungkas)**: Menghasilkan **2x ATK**. Memiliki **peluang 30% meleset (miss / 0 DMG)**. Gunakan di awal laga, jangan gunakan saat HP musuh kritis!\n` +
            `🛡️ **Bertahan (Defend)**: **Memotong 50% damage** serangan musuh di ronde tersebut. Sangat efektif untuk meng-counter Ultimate musuh.\n` +
            `🏳️ **Menyerah (Forfeit)**: Mengakibatkan kekalahan instan.`
        },
        {
          name: '🧠 3. ALUR DUEL SIMULTAN & TRIK SPD',
          value:
            `• **Urutan Eksekusi**: Ronde diproses berurutan sesuai **SPD (DEX)** tertinggi.\n` +
            `• **Trik "Speed-Blitz"**: Jika pet Anda lebih cepat dan HP musuh tinggal sedikit, gunakan **🗡️ Serang** biasa. Karena bergerak lebih cepat, pet Anda akan menghabisi musuh terlebih dahulu sehingga aksi musuh di ronde tersebut batal!`
        },
        {
          name: '🧪 4. REKOMENDASI FORMULA BUILD GYM & SINERGI',
          value:
            `🐉 **Dragon / Cat (DPS Kecepatan)**:\n` +
            `• *Stat*: **STR 70% | DEX 30%** (VIT & DEF secukupnya).\n` +
            `• *Sinergi*: Trait **Warrior** (+15% ATK) + Aksesoris **Pedang Mainan** (\`SWORD_TOY\` / +15% DMG PvP).\n\n` +
            `🧱 **Golem / Slime (Tanker Alot)**:\n` +
            `• *Stat*: **DEF 100 poin (Maks 50% Reduksi) | VIT 50% | STR 50%**.\n` +
            `• *Sinergi*: Trait **Sturdy** (-15% DMG) + Aksesoris **Tameng Mainan** (\`SHIELD_TOY\` / -15% DMG).`
        }
      )
      .setFooter({ text: 'Atur stat pet Anda di .pet gym sebelum mendaftar! • Kosan 1A PvP League' })
      .setTimestamp();

    await channel.send({ content: '@everyone', embeds: [embed] });
    console.log('Announcement sent successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Failed to send announcement:', err);
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN);
