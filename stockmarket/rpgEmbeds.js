const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

/**
 * Palette Warna Premium
 */
const COLORS = {
  GOLD_PREMIUM: '#FFB800',  // Kuning Emas Premium
  CRIMSON_DARK: '#990000',  // Merah Crimson Gelap (Kesan Menantang)
  GRAY_DARK: '#1E1F22'      // Dark Onyx Discord
};

/**
 * Membuat progress bar visual untuk tingkat kesulitan ekspedisi
 * @param {number} difficulty - Angka kesulitan (1 - 10 atau 0% - 100%)
 * @param {number} max - Maksimal skala (misal 10)
 * @returns {string} String progress bar
 */
function createDifficultyBar(difficulty, max = 10) {
  const filledCount = Math.min(max, Math.max(0, Math.round(difficulty)));
  const emptyCount = max - filledCount;
  
  // Menggunakan kotak merah crimson/orange untuk kesan menantang, dan kotak hitam untuk sisanya
  return '🟥'.repeat(filledCount) + '⬛'.repeat(emptyCount);
}

/**
 * Membuat Discord Embed Premium untuk Pet Expedition (Ekspedisi Hewan Peliharaan)
 * 
 * @param {Object} pet - Data Pet (nama, tipe/spesies, rarity, star_level)
 * @param {Object} map - Data Peta Ekspedisi (nama, difficulty, recommendedLevel, minPrize, maxPrize, boss)
 * @param {number} durationSeconds - Durasi ekspedisi dalam detik
 * @param {boolean} useLocalAssets - Apakah ingin menggunakan asset gambar lokal (pet_explorer.png & volcanic_expedition.png)
 * @returns {Object} Objek berisi embed dan files attachment (jika useLocalAssets true)
 */
function getPetExpeditionEmbed(pet, map, durationSeconds, useLocalAssets = true) {
  // Hitung Timestamp Selesai untuk Fitur Dynamic Real-time Timer
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const finishTimestamp = nowInSeconds + durationSeconds;
  
  // Tentukan warna berdasarkan tingkat kesulitan (Merah Crimson jika sulit, Gold jika sedang/mudah)
  const isChallenging = map.recommendedLevel >= 25;
  const embedColor = isChallenging ? COLORS.CRIMSON_DARK : COLORS.GOLD_PREMIUM;
  
  // Tentukan emoji rarity
  const rarityEmojis = {
    COMMON: '⚪',
    RARE: '🟢',
    EPIC: '🟣',
    LEGENDARY: '🟡',
    MYTHIC: '🔴',
    IMMORTAL: '✨'
  };
  
  const petRarity = pet.gacha_rarity || 'COMMON';
  const rarityEmoji = rarityEmojis[petRarity.toUpperCase()] || '🐾';
  const petStars = '⭐'.repeat(pet.star_level || 1);

  // Setup Visual Assets (Thumbnail & Image)
  let thumbnailURL = 'https://i.imgur.com/vH9XzWw.png'; // Fallback Placeholder Pet Adventure
  let imageURL = 'https://i.imgur.com/TKe5C0I.png';     // Fallback Placeholder Volcanic Cave
  const files = [];

  if (useLocalAssets) {
    try {
      // Menggunakan asset premium hasil generate yang sudah disimpan di folder assets
      const petExplorer = new AttachmentBuilder('./assets/pet_explorer.png');
      const volcanicExpedition = new AttachmentBuilder('./assets/volcanic_expedition.png');
      
      files.push(petExplorer, volcanicExpedition);
      
      thumbnailURL = 'attachment://pet_explorer.png';
      imageURL = 'attachment://volcanic_expedition.png';
    } catch (error) {
      console.warn("Asset lokal tidak ditemukan atau gagal dimuat, menggunakan tautan cadangan URL online.", error.message);
    }
  }

  // Buat Embed Builder
  const embed = new EmbedBuilder()
    .setTitle('⚔️ PET EXPEDITION: DEEP INTO THE WILD')
    .setDescription(
      `*Matahari meredup saat sekelompok petualang melangkah ke wilayah terlarang. Angin kencang membawa aroma belerang dan bahaya nyata. Akankah pet kesayanganmu kembali membawa harta karun legendaris, atau terkubur di bawah panasnya magma?*`
    )
    .setColor(embedColor)
    .setThumbnail(thumbnailURL)
    .setImage(imageURL)
    
    // 1. Field Nama Pet & Rarity
    .addFields({
      name: '🐾 PET EXPEDITIONER',
      value: `**${pet.pet_name}** (${pet.pet_type})\n` +
             `├ Rarity: ${rarityEmoji} **${petRarity}**\n` +
             `└ Bintang: ${petStars}`,
      inline: true
    })
    
    // 2. Field Lokasi & Difficulty Bar
    .addFields({
      name: '🌋 DESTINATION AREA',
      value: `**${map.name}**\n` +
             `├ Rekomendasi Level: **Lv. ${map.recommendedLevel}**\n` +
             `└ Difficulty: \`[${createDifficultyBar(map.difficulty, 10)}]\` (${map.difficulty * 10}%)`,
      inline: true
    })
    
    // 3. Field Estimasi Loot/Hadiah (Bullet points rapi)
    .addFields({
      name: '🎁 ESTIMATED LOOT & REWARDS',
      value: `• 🪙 **Coins**: \`Rp ${map.minPrize.toLocaleString('id-ID')} - Rp ${map.maxPrize.toLocaleString('id-ID')}\`\n` +
             `• ⚡ **Bonus XP**: \`+${map.recommendedLevel * 20} XP\`\n` +
             `• 🎒 **Loot Chance**: \`Daging Premium / Ramuan Kesehatan / Tiket Gacha\``,
      inline: false
    })
    
    // 4. Field Real-time Timer (Discord Dynamic Timestamp)
    .addFields({
      name: '⏳ TIME REMAINING (REAL-TIME)',
      value: `⏳ Ekspedisi selesai **<t:${finishTimestamp}:R>**\n` +
             `*(Sisa waktu akan berjalan mundur secara otomatis di Discord)*`,
      inline: false
    })
    
    // Footer & Started Timestamp
    .setFooter({ 
      text: '🛡️ Status: Dalam Petualangan · Semoga beruntung, petualang!', 
      iconURL: 'https://i.imgur.com/vH9XzWw.png' 
    })
    .setTimestamp(new Date()); // Menandakan kapan ekspedisi dimulai

  return { embeds: [embed], files };
}

module.exports = {
  COLORS,
  getPetExpeditionEmbed
};
