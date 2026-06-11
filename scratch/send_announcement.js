const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
  console.log(`🤖 Bot logged in as ${client.user.tag}`);
  
  const channelId = '1510920596127481988';
  const channel = await client.channels.fetch(channelId).catch(err => {
    console.error('Failed to fetch channel:', err);
    return null;
  });

  if (!channel) {
    console.error(`Channel with ID ${channelId} not found!`);
    process.exit(1);
  }

  const embed = new EmbedBuilder()
    .setTitle('🏰 MENARA UJIAN (TOWER OF TRIALS) — TANTANGAN PVE SOLO!')
    .setURL('https://discord.com')
    .setDescription(
      'Uji batas kemampuan hewan peliharaan Anda! Panjat **Menara Ujian (Tower of Trials)** dengan total **50 lantai** yang penuh dengan rintangan dan monster penjaga. Tunjukkan bahwa pet Anda adalah petarung terkuat! ⚔️🛡️'
    )
    .setColor('#F1C40F') // Golden premium color
    .addFields([
      {
        name: '⚔️ Cara Bermain',
        value: 
          '1️⃣ Ketik perintah **`.pet tower`** di chat.\n' +
          '2️⃣ Klik tombol **`⚔️ Tantang Lantai`** pada panel kontrol untuk memulai simulasi pertempuran.\n' +
          '3️⃣ **Menang:** Pet Anda akan naik ke lantai berikutnya, mendapatkan koin, dan memperoleh XP Pet!\n' +
          '4️⃣ **Kalah:** Pet Anda akan pingsan (status menjadi **WEAK/LEMAS** dengan sisa **1 HP**). Obati pet Anda terlebih dahulu sebelum menantang kembali.',
        inline: false
      },
      {
        name: '🎫 Kuota Harian & Tiket Masuk',
        value: 
          '• Setiap warga mendapatkan **5x Percobaan Gratis** setiap harinya.\n' +
          '• Jika kuota harian habis, Anda tetap bisa masuk dengan membayar biaya masuk sebesar **Rp 500 koin** atau menggunakan **1x 🥤 Soda Energi Pet**.',
        inline: false
      },
      {
        name: '🎁 Hadiah Lantai Menara',
        value: 
          '🏆 **Koin & XP:** Setiap lantai memberikan hadiah yang terus meningkat seiring bertambahnya kesulitan:\n' +
          '• **Lantai 1 - 10 (🟢 Mudah):** Rp 500 - Rp 1.500\n' +
          '• **Lantai 11 - 20 (🟡 Sedang):** Rp 2.000 - Rp 4.500\n' +
          '• **Lantai 21 - 40 (🔴 Sulit):** Rp 5.000 - Rp 12.000\n' +
          '• **Lantai 41 - 50 (💀 Ekstrem):** Rp 15.000 - Rp 50.000\n\n' +
          '🔥 **Lantai Boss (Kelipatan 5):** Setiap menyelesaikan lantai kelipatan 5, Anda dijamin mendapatkan hadiah bonus tambahan berupa **1x 🎟️ Tiket Gacha Pet**!',
        inline: false
      },
      {
        name: '🧹 Fitur Sapu Bersih (Sweep)',
        value: 
          '• Malas memanjat satu per satu setiap hari? Gunakan tombol **`🧹 Sapu Bersih`**!\n' +
          '• Anda dapat melakukan Sweep **sekali sehari** untuk langsung mengklaim **10% dari total koin & XP** dari semua lantai yang sudah pernah Anda taklukkan (Maksimal **Rp 15.000**).\n' +
          '• **Syarat Sweep:** Status kesejahteraan pet (Hunger, Thirst, Happiness) wajib berada di atas **50%**.',
        inline: false
      },
      {
        name: '💡 Tips Sukses',
        value: 
          '• **Latih Stat:** Naikkan level pet Anda lalu alokasikan Poin Latihan (TP) di **`.pet gym`** untuk meningkatkan STR, VIT, DEF, atau DEX.\n' +
          '• **Manfaatkan Elemen:** Sesuaikan pet aktif Anda dengan elemen boss di lantai tersebut untuk mempermudah kemenangan!',
        inline: false
      }
    ])
    .setThumbnail('https://cdn-icons-png.flaticon.com/512/619/619043.png') // Nice Castle/Tower icon
    .setTimestamp()
    .setFooter({
      text: 'Sentinel Bot RPG System • Kosan 1A',
      iconURL: client.user.displayAvatarURL()
    });

  try {
    await channel.send({ embeds: [embed] });
    console.log('✅ Premium embed announcement successfully sent!');
  } catch (err) {
    console.error('Failed to send announcement:', err);
  } finally {
    client.destroy();
    process.exit(0);
  }
});

client.login(process.env.DISCORD_TOKEN);
