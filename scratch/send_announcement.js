const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// GACHA SPECIES dari pet.js
const { GACHA_SPECIES } = require('../stockmarket/pet');

// PET ASSETS dari embeds.js (local variable extraction / recreation)
const PET_ASSETS = {
  EGG: [
    'https://media.tenor.com/Ns7iP4fWsUQAAAAC/egg-easter-egg.gif',
    'https://media1.tenor.com/m/rI6KDaQGE48AAAAC/potz-content-potz.gif',
    'https://i.giphy.com/media/mSuzNvPvE2KFrGpywl/giphy.gif',
    'https://i.giphy.com/media/fX8zOAyerYzd3UPtBH/giphy.gif',
    'https://i.giphy.com/media/3oEdv9R4D62GPrVY4g/giphy.gif'
  ],
  DEAD: [
    'https://i.giphy.com/media/ukNqewtLpt81JN7SIS/giphy.gif',
    'https://i.giphy.com/media/pVGsAWjzvXcZW4ZBTE/giphy.gif',
    'https://i.giphy.com/media/xThuWhGG79OblPr368/giphy.gif',
    'https://i.giphy.com/media/xUPJPn8l1m8odg1Bxm/giphy.gif'
  ],
  SLIME: {
    BABY: [
      'https://media.tenor.com/y596ptM1394AAAAC/slime-pixel-art.gif',
      'https://media.tenor.com/TVdvv_3wKY8AAAAC/glorp-bouncing-slime.gif',
      'https://media.tenor.com/bIs7ms2JdRIAAAAC/slime-bouncing.gif',
      'https://media.tenor.com/OUSsQCqKT-EAAAAC/slime.gif',
      'https://media.tenor.com/Hw9CvBd8mx4AAAAC/slime-pixel.gif'
    ],
    ADULT: [
      'https://media.tenor.com/mgZBc6GhNlUAAAAC/game-pixel-art.gif',
      'https://media.tenor.com/GvwoI9f1lyQAAAAC/dragon-dragon-quest.gif',
      'https://media.tenor.com/1AdjvXKcJjIAAAAC/slime-slime-chamber.gif',
      'https://media.tenor.com/NGUJV2lqUx0AAAAC/slime-morphing.gif',
      'https://media.tenor.com/Bfc_sJd7yuEAAAAC/terraria-terraria-mod.gif'
    ]
  },
  DRAGON: {
    BABY: [
      'https://i.giphy.com/media/Pyp923TIC4Iq4/giphy.gif',
      'https://i.giphy.com/media/Xb2Bw5hUU56XsudVF8/giphy.gif',
      'https://i.giphy.com/media/AHMPR6ASCvZY17KsdB/giphy.gif',
      'https://img.pokemondb.net/sprites/black-white/anim/normal/bagon.gif',
      'https://i.giphy.com/media/3o7qE1YN7aBOFPRw8E/giphy.gif'
    ],
    ADULT: [
      'https://i.giphy.com/media/JMqM0nNT3AXS8xuiIZ/giphy.gif',
      'https://i.giphy.com/media/TjjLhpZU4roPz4SkW5/giphy.gif',
      'https://i.giphy.com/media/RlfsTNtMxGhb4T7P07/giphy.gif',
      'https://img.pokemondb.net/sprites/black-white/anim/normal/charizard.gif',
      'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExYjR3Z21oMzF0Y3I0b3RqcjF5NGRteWk5bDR5OTJ3emk3OXg3ZjY2byZlcD12MV9naWZzX3NlYXJjaCZjdD1n/12PA1eI8FBqEBa/giphy.gif'
    ]
  },
  CAT: {
    BABY: [
      'https://i.giphy.com/media/gx54W1mSpeYMg/giphy.gif',
      'https://i.giphy.com/media/MSemvqMIRY3jMcvpd2/giphy.gif',
      'https://i.giphy.com/media/VCP6Kpf6guFm4nnF04/giphy.gif',
      'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExc2w2OGRqcWM3NG95d3IxcTl2eWljcWthazg3a3V5Y3pkaThvbzlodSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/ND6xkVPaj8tHO/giphy.gif',
      'https://img.pokemondb.net/sprites/black-white/anim/normal/meowth.gif'
    ],
    ADULT: [
      'https://i.giphy.com/media/U6Xgx1pCLMPFaO0Uw3/giphy.gif',
      'https://i.giphy.com/media/2wicMBKqNZlrW/giphy.gif',
      'https://i.giphy.com/media/1k1ytCiReJMZWVtjXd/giphy.gif',
      'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExdXg4aGQ5ZWc0NjBhaGZqcjYxZjVzZG92cW5xMDhxbXlxbnNoMHRwNCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/mlvseq9yvZhba/giphy.gif',
      'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExcGw0aWViZnpyNGlkNndtMGN1cXRvenR3MGo2c2E5Y2h3NDZoMjc1MSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/nR4L10XlJcSeQ/giphy.gif'
    ]
  },
  GOLEM: {
    BABY: [
      'https://i.giphy.com/media/3s4pjpA8Vb7lTy73Nn/giphy.gif',
      'https://i.giphy.com/media/BU327u9UNM2Sk/giphy.gif',
      'https://media.tenor.com/R4QclJPFD1gAAAAC/16bit-80s.gif',
      'https://img.pokemondb.net/sprites/black-white/anim/normal/geodude.gif'
    ],
    ADULT: [
      'https://i.giphy.com/media/7ueLs2fU5c8QeeYHKg/giphy.gif',
      'https://i.giphy.com/media/4YHLDTS2yKKZpnZ9WN/giphy.gif',
      'https://i.giphy.com/media/Ss6CM89p5n3yBYfQ0P/giphy.gif',
      'https://img.pokemondb.net/sprites/black-white/anim/normal/golem.gif',
      'https://media.tenor.com/ykpEHGFKYDoAAAAC/elements-solana.gif'
    ]
  },
  PHOENIX: {
    BABY: ['https://img.pokemondb.net/sprites/black-white/anim/normal/moltres.gif'],
    ADULT: ['https://img.pokemondb.net/sprites/black-white/anim/normal/ho-oh.gif']
  },
  TURTLE: {
    BABY: ['https://img.pokemondb.net/sprites/black-white/anim/normal/squirtle.gif'],
    ADULT: ['https://img.pokemondb.net/sprites/black-white/anim/normal/torterra.gif']
  },
  LEVIATHAN: {
    BABY: ['https://img.pokemondb.net/sprites/black-white/anim/normal/dratini.gif'],
    ADULT: ['https://img.pokemondb.net/sprites/black-white/anim/normal/gyarados.gif']
  },
  BEHEMOTH: {
    BABY: ['https://img.pokemondb.net/sprites/black-white/anim/normal/phanpy.gif'],
    ADULT: ['https://img.pokemondb.net/sprites/black-white/anim/normal/groudon.gif']
  },
  ARCHDRAGON: {
    BABY: ['https://img.pokemondb.net/sprites/black-white/anim/normal/gible.gif'],
    ADULT: ['https://img.pokemondb.net/sprites/black-white/anim/normal/rayquaza.gif']
  },
  SIREN: {
    BABY: ['https://img.pokemondb.net/sprites/black-white/anim/normal/horsea.gif'],
    ADULT: ['https://img.pokemondb.net/sprites/black-white/anim/normal/milotic.gif']
  },
  PEGASUS: {
    BABY: ['https://img.pokemondb.net/sprites/black-white/anim/normal/ponyta.gif'],
    ADULT: ['https://img.pokemondb.net/sprites/black-white/anim/normal/rapidash.gif']
  },
  KITSUNE: {
    BABY: ['https://img.pokemondb.net/sprites/black-white/anim/normal/vulpix.gif'],
    ADULT: ['https://img.pokemondb.net/sprites/black-white/anim/normal/ninetales.gif']
  },
  KIRIN: {
    BABY: ['https://img.pokemondb.net/sprites/black-white/anim/normal/electrike.gif'],
    ADULT: ['https://img.pokemondb.net/sprites/black-white/anim/normal/raikou.gif']
  },
  YETI: {
    BABY: ['https://img.pokemondb.net/sprites/black-white/anim/normal/cubchoo.gif'],
    ADULT: ['https://img.pokemondb.net/sprites/black-white/anim/normal/beartic.gif']
  },
  CERBERUS: {
    BABY: ['https://img.pokemondb.net/sprites/black-white/anim/normal/houndour.gif'],
    ADULT: ['https://img.pokemondb.net/sprites/black-white/anim/normal/houndoom.gif']
  },
  TYPHON: {
    BABY: ['https://img.pokemondb.net/sprites/black-white/anim/normal/deino.gif'],
    ADULT: ['https://img.pokemondb.net/sprites/black-white/anim/normal/hydreigon.gif']
  },
  VALKYRIE: {
    BABY: ['https://img.pokemondb.net/sprites/black-white/anim/normal/ralts.gif'],
    ADULT: ['https://img.pokemondb.net/sprites/black-white/anim/normal/gardevoir.gif']
  },
  IFRIT: {
    BABY: ['https://img.pokemondb.net/sprites/black-white/anim/normal/magby.gif'],
    ADULT: ['https://img.pokemondb.net/sprites/black-white/anim/normal/magmortar.gif']
  },
  FENRIR: {
    BABY: ['https://img.pokemondb.net/sprites/black-white/anim/normal/growlithe.gif'],
    ADULT: ['https://img.pokemondb.net/sprites/black-white/anim/normal/lucario.gif']
  },
  BAHAMUT: {
    BABY: ['https://img.pokemondb.net/sprites/black-white/anim/normal/charmander.gif'],
    ADULT: ['https://img.pokemondb.net/sprites/black-white/anim/normal/reshiram.gif']
  },
  KRAKEN: {
    BABY: ['https://img.pokemondb.net/sprites/black-white/anim/normal/tentacool.gif'],
    ADULT: ['https://img.pokemondb.net/sprites/black-white/anim/normal/kyogre.gif']
  },
  JORMUNGANDR: {
    BABY: ['https://img.pokemondb.net/sprites/black-white/anim/normal/ekans.gif'],
    ADULT: ['https://img.pokemondb.net/sprites/black-white/anim/normal/steelix.gif']
  },
  CHRONOS: {
    BABY: ['https://img.pokemondb.net/sprites/black-white/anim/normal/celebi.gif'],
    ADULT: ['https://img.pokemondb.net/sprites/black-white/anim/normal/dialga.gif']
  },
  OUROBOROS: {
    BABY: ['https://img.pokemondb.net/sprites/black-white/anim/normal/dunsparce.gif'],
    ADULT: ['https://img.pokemondb.net/sprites/black-white/anim/normal/serperior.gif']
  },
  AZATHOTH: {
    BABY: ['https://img.pokemondb.net/sprites/black-white/anim/normal/unown.gif'],
    ADULT: ['https://img.pokemondb.net/sprites/black-white/anim/normal/giratina-origin.gif']
  },
  YGGDRASIL: {
    BABY: ['https://img.pokemondb.net/sprites/black-white/anim/normal/oddish.gif'],
    ADULT: ['https://img.pokemondb.net/sprites/black-white/anim/normal/abomasnow.gif']
  }
};

client.once('ready', async () => {
  console.log(`🤖 Bot logged in as ${client.user.tag}`);
  
  const channelId = '1514702244589731940';
  const channel = await client.channels.fetch(channelId).catch(err => {
    console.error('Failed to fetch channel:', err);
    return null;
  });

  if (!channel) {
    console.error(`Channel with ID ${channelId} not found!`);
    process.exit(1);
  }

  // 1. EMBED BANNER UTAMA
  const mainBanner = new EmbedBuilder()
    .setTitle('📖 KODEX PET RPG KOSAN 1A — DAFTAR LENGKAP SPESIES & STATS 📖')
    .setDescription(
      'Selamat datang di **Kamus Ensiklopedia Pet RPG**! Di sini Anda dapat melihat seluruh daftar peliharaan yang dapat Anda dapatkan dari Gacha, Safari, maupun petualangan Ekspedisi. Setiap pet memiliki stats dasar, tipe elemen, dan keunikan pasif masing-masing!\n\n' +
      'Gunakan menu ini sebagai referensi utama dalam melatih dan memilih pet terbaik untuk bertanding di **Gym**, menaklukkan **Menara Ujian (Tower)**, maupun menghadapi **World Boss Raid** bersama warga lainnya! ⚔️🔥🛡️'
    )
    .setColor('#F1C40F')
    .setThumbnail('https://cdn-icons-png.flaticon.com/512/3505/3505030.png')
    .addFields([
      {
        name: '✨ Cara Mendapatkan Pet',
        value: 
          '• **`.pet buy <nama> <cat/golem/slime>`** — Membeli telur pet Common seharga **Rp 1.500**.\n' +
          '• **`.pet gacha`** — Gacha premium menggunakan **Tiket Gacha** / Koin untuk mendapatkan pet langka.\n' +
          '• **`.pet safari`** — Menjelajahi biome liar untuk melacak dan menangkap pet elemen secara interaktif.',
        inline: false
      },
      {
        name: '🌟 Keuntungan Rarity Tinggi',
        value:
          '• ⚪ **Common:** Pet standar yang rajin berlatih.\n' +
          '• 🟢 **Rare:** Memiliki **1 Trait** bawaan acak.\n' +
          '• 🟣 **Epic:** Memiliki stats elemen kuat & **Trait Survivor**.\n' +
          '• 🟡 **Legendary:** Bonus kerja/hunt **+25%**, HP sangat besar, & **2 Trait** acak.\n' +
          '• 🔴 **Mythic:** Laju decay status melambat **-50%**, bonus kerja/hunt **+40%**, & **3 Trait** bawaan.\n' +
          '• ✨ **Immortal:** Status **abadi** (tidak ada decay status), bonus kerja/hunt **+75%**, **5 Trait** sekaligus!',
        inline: false
      }
    ])
    .setTimestamp();

  // Helper untuk memformat list pet per Rarity
  const getEmbedForRarity = (rarityName, colorHex, emojiSymbol) => {
    const list = Object.values(GACHA_SPECIES).filter(p => p.rarity === rarityName);
    
    const embed = new EmbedBuilder()
      .setTitle(`${emojiSymbol} DAFTAR PET: TIER ${rarityName} ${emojiSymbol}`)
      .setColor(colorHex)
      .setTimestamp();

    let description = '';
    list.forEach(p => {
      const babyImg = PET_ASSETS[p.id]?.BABY?.[0] || '';
      const adultImg = PET_ASSETS[p.id]?.ADULT?.[0] || '';
      const elementStr = p.element ? `\`🔥 ${p.element}\`` : '`❌ Tanpa Elemen`';
      
      description += `### ${p.emoji} **${p.name}**\n` +
        `• **Tipe Elemen:** ${elementStr}\n` +
        `• **Stats Dasar:** ❤️ HP: \`${p.baseHP}\` | ⚔️ ATK: \`${p.baseAtk}\` | 🛡️ DEF: \`${p.baseDef}\`\n` +
        `• **Kemampuan Pasif:** *${p.desc}*\n` +
        `• **Visual:** [🥚 Bentuk Bayi](${babyImg}) • [🐉 Dewasa](${adultImg})\n\n`;
    });

    embed.setDescription(description || '*Tidak ada pet di tier ini.*');
    return embed;
  };

  const embeds = [
    mainBanner,
    getEmbedForRarity('COMMON', '#8A95A5', '⚪'),
    getEmbedForRarity('RARE', '#00A8FF', '🟢'),
    getEmbedForRarity('EPIC', '#6C5CE7', '🟣'),
    getEmbedForRarity('LEGENDARY', '#8E44AD', '🟡'),
    getEmbedForRarity('MYTHIC', '#FF3366', '🔴'),
    getEmbedForRarity('IMMORTAL', '#D4AF37', '✨')
  ];

  try {
    for (const emb of embeds) {
      await channel.send({ embeds: [emb] });
      // Berikan delay kecil agar urutan pengiriman rapi
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    console.log('✅ Premium pet encyclopedia successfully sent!');
  } catch (err) {
    console.error('Failed to send announcement:', err);
  } finally {
    client.destroy();
    process.exit(0);
  }
});

client.login(process.env.DISCORD_TOKEN);
