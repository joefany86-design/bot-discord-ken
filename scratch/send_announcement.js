const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const token = process.env.DISCORD_TOKEN;
const channelId = '1510920596127481988';

if (!token) {
  console.error('Error: DISCORD_TOKEN tidak ditemukan di file .env');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      console.error(`Error: Channel dengan ID ${channelId} tidak ditemukan.`);
      process.exit(1);
    }

    console.log(`Mengirim pengumuman premium ke channel: #${channel.name}`);

    // Embed 1: Header Banner (Royal Violet)
    const headerEmbed = new EmbedBuilder()
      .setColor(0x7C4DFF) // Royal Violet
      .setTitle('📢 EXPANSION UPDATE: NEW PETS ARRIVED!')
      .setDescription(
        `Halo warga **${channel.guild.name}**! 🌅\n` +
        `Kabar gembira bagi seluruh Trainer peliharaan! Sistem kependudukan Kosan 1A baru saja merilis **9 Spesies Pet Baru** tingkat **Epic** & **Legendary** yang siap Anda dapatkan melalui Gacha atau jinakkan secara langsung di Safari liar!`
      )
      .setImage('https://media.tenor.com/eKcQ9MT2dR8AAAAC/uwu-cute.gif')
      .setTimestamp();

    // Embed 2: Epic Pets (Amethyst Purple)
    const epicEmbed = new EmbedBuilder()
      .setColor(0x9B59B6) // Amethyst Purple
      .setTitle('🟣 DAFTAR PET BARU — KELAS [ EPIC ]')
      .setDescription('Pet langka dengan elemen khusus dan stats seimbang:')
      .addFields(
        {
          name: '🧜‍♀️ Siren (WATER)',
          value: '• **Deskripsi**: Makhluk laut bersuara merdu. Menghipnotis lawan dengan kidung air abadi.\n• **Combat**: ATK: `Siren Melody` | DEF: `Aqua Wall`\n• **Habitat**: 🌊 Danau Abyss (abyss)',
          inline: false
        },
        {
          name: '🦄 Pegasus (DRAGON)',
          value: '• **Deskripsi**: Kuda bersayap suci penjaga langit. Pelari cepat pembawa keajaiban.\n• **Combat**: ATK: `Wind Tempest` | DEF: `Divine Feather`\n• **Habitat**: ⛰️ Pegunungan Kuno (mountain)',
          inline: false
        },
        {
          name: '🦊 Kitsune (FIRE)',
          value: '• **Deskripsi**: Rubah ekor sembilan legendaris. Memanipulasi api mistis biru pelindung jiwa.\n• **Combat**: ATK: `Fox Fire` | DEF: `Illusion Shield`\n• **Habitat**: 🌋 Lembah Volcanic (volcano)',
          inline: false
        },
        {
          name: '⚡ Kirin (DRAGON)',
          value: '• **Deskripsi**: Rusa petir mitologi pembawa kemakmuran. Langkah kakinya memicu guntur.\n• **Combat**: ATK: `Kirin Judgement` | DEF: `Lightning Cloak`\n• **Habitat**: ⛰️ Pegunungan Kuno (mountain)',
          inline: false
        },
        {
          name: '❄️ Yeti (WATER)',
          value: '• **Deskripsi**: Raksasa salju penjaga puncak es dingin. Kekuatannya mampu membekukan lawan.\n• **Combat**: ATK: `Yeti Smash` | DEF: `Frost Armor`\n• **Habitat**: 🌊 Danau Abyss (abyss)',
          inline: false
        }
      )
      .setTimestamp();

    // Embed 3: Legendary Pets (Vibrant Gold)
    const legendaryEmbed = new EmbedBuilder()
      .setColor(0xFFD700) // Vibrant Gold
      .setTitle('🟡 DAFTAR PET BARU — KELAS [ LEGENDARY ]')
      .setDescription(
        'Pet legendaris super tangguh! Membawa **buff permanen +25% pendapatan koin saat Bekerja/Hunt** dan terlahir dengan **2 Trait Acak** sekaligus!'
      )
      .addFields(
        {
          name: '🐺 Cerberus (FIRE)',
          value: '• **Deskripsi**: Anjing berkepala tiga penjaga neraka. Menguasai api jahanam pembakar jiwa.\n• **Combat**: ATK: `Triple Bite` | DEF: `Underworld Shield`\n• **Habitat**: 🌋 Lembah Volcanic (volcano)',
          inline: false
        },
        {
          name: '🌪️ Typhon (DRAGON)',
          value: '• **Deskripsi**: Bapa dari segala monster mitologi. Membawa kekuatan badai penghancur dimensi.\n• **Combat**: ATK: `Typhoon Blast` | DEF: `Tempest Shield`\n• **Habitat**: ⛰️ Pegunungan Kuno (mountain)',
          inline: false
        },
        {
          name: '⚔️ Valkyrie (EARTH)',
          value: '• **Deskripsi**: Ksatria wanita pemandu jiwa pejuang. Memiliki pertahanan emas yang tak tertembus.\n• **Combat**: ATK: `Valkyrie Strike` | DEF: `Aegis Guard`\n• **Habitat**: 🌊 Danau Abyss (abyss)',
          inline: false
        },
        {
          name: '👹 Ifrit (FIRE)',
          value: '• **Deskripsi**: Raja jin api dari gurun terdalam berkekuatan destruktif tinggi.\n• **Combat**: ATK: `Hellfire Inferno` | DEF: `Magma Shield`\n• **Habitat**: 🌋 Lembah Volcanic (volcano)',
          inline: false
        }
      )
      .setFooter({ text: 'Sentinel Bot System • Kosan A1 Updates' })
      .setTimestamp();

    await channel.send({ 
      content: '🔔 **PEMBERITAHUAN UPDATE WARGA: SPESIES PET BARU KOSAN 1A**',
      embeds: [headerEmbed, epicEmbed, legendaryEmbed] 
    });

    console.log('✅ Pengumuman berhasil dikirim!');
  } catch (err) {
    console.error('❌ Gagal mengirim pengumuman:', err);
  } finally {
    client.destroy();
    process.exit(0);
  }
});

client.login(token);
