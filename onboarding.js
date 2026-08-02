const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

// Konfigurasi Peran (Roles)
const ROLES = {
  BADDIES: '1472170290175021193', // the baddies
  BROS: '1472170093416022096',     // the bros
  VERIFIED: '1520716203935535257'   // ✅ Terverifikasi
};

const INTRO_CHANNEL_ID = '1472883318386065426';

const CITIZENSHIPS = {
  INDONESIA: '1520707284819513374',
  MALAYSIA: '1520705391695106158',
  INTERNATIONAL: '1520707287759585311'
};

/**
 * Mengirimkan panel filter notifikasi kebun ke channel tempat perintah dijalankan.
 * @param {ChatInputCommandInteraction} interaction - Interaksi slash command.
 */
async function sendGardenPanel(interaction) {
  // Hanya izinkan Administrator
  if (!interaction.member.permissions.has('Administrator')) {
    return interaction.reply({
      content: '❌ Anda tidak memiliki izin untuk menggunakan perintah ini! Hanya Administrator yang diperbolehkan.',
      flags: 64
    });
  }

  const { message1, message2, message3, message4 } = getOnboardingMessages();

  await interaction.reply({
    content: '✅ Panel filter notifikasi kebun berhasil dikirim!',
    flags: 64
  });

  await interaction.channel.send(message1);
  await interaction.channel.send(message2);
  await interaction.channel.send(message3);
  await interaction.channel.send(message4);
}


/**
 * Mengirimkan panel onboarding ke channel tempat perintah dijalankan.
 * @param {ChatInputCommandInteraction} interaction - Interaksi slash command.
 */
async function sendOnboardingPanel(interaction) {
  // Hanya izinkan Administrator
  if (!interaction.member.permissions.has('Administrator')) {
    return interaction.reply({
      content: '❌ Anda tidak memiliki izin untuk menggunakan perintah ini! Hanya Administrator yang diperbolehkan.',
      flags: 64
    });
  }

  const embed = new EmbedBuilder()
    .setColor(0x7C4DFF) // Purple Accent
    .setTitle('🏡 SISTEM ONBOARDING WARGA KOSAN 1A')
    .setDescription(
      'Selamat datang di server komunitas **Kosan 1A**! Untuk menyelaraskan profil Anda dengan database server ' +
      'dan membuka hak akses saluran secara penuh, silakan lengkapi profil onboarding Anda di bawah ini:\n\n' +
      '📋 **Langkah Onboarding:**\n' +
      '1️⃣ **Pilih Kelompok Sosial Anda** pada menu pilihan pertama.\n' +
      '2️⃣ **Pilih Kewarganegaraan/Regional Anda** pada menu pilihan kedua.'
    )
    .addFields(
      {
        name: '👥 Pilihan Kelompok',
        value: '• **The Baddies** 💋\n• **The Bros** 🍻',
        inline: true
      },
      {
        name: '🌏 Kewarganegaraan',
        value: '• **🇮🇩 Indonesia**\n• **🇲🇾 Malaysia**\n• **🌍 International**',
        inline: true
      },
      {
        name: '────────────────────────────────────────',
        value: ' '
      },
      {
        name: '👑 Server Owner / Founder',
        value: '<@436554535037698059>',
        inline: true
      },
      {
        name: '🔑 Estate Manager (Admin)',
        value: '<@&1477641960381743245>',
        inline: true
      },
      {
        name: '🛠️ Hubungi Kami (Bantuan Teknik)',
        value: 'Jika Anda memiliki pertanyaan atau kendala seputar server, silakan hubungi tim <@&1503307301363384320> atau Estate Manager.',
        inline: false
      }
    )
    .setFooter({ text: 'Onboarding Kosan 1A • Silakan lengkapi kedua pilihan di bawah' })
    .setTimestamp();

  // Create Group Select Menu
  const groupMenu = new StringSelectMenuBuilder()
    .setCustomId('onboarding_select_group')
    .setPlaceholder('Pilih Kelompok')
    .addOptions([
      new StringSelectMenuOptionBuilder()
        .setLabel('The Baddies 💋')
        .setValue('baddies'),
      new StringSelectMenuOptionBuilder()
        .setLabel('The Bros 🍻')
        .setValue('bros')
    ]);

  // Create Citizenship Select Menu
  const citizenshipMenu = new StringSelectMenuBuilder()
    .setCustomId('onboarding_select_citizenship')
    .setPlaceholder('Pilih Kewarganegaraan')
    .addOptions([
      new StringSelectMenuOptionBuilder()
        .setLabel('🇮🇩 Indonesia')
        .setValue('indonesia'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🇲🇾 Malaysia')
        .setValue('malaysia'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🌍 International')
        .setValue('international')
    ]);

  const rowGroup = new ActionRowBuilder().addComponents(groupMenu);
  const rowCitizenship = new ActionRowBuilder().addComponents(citizenshipMenu);
  
  const introButton = new ButtonBuilder()
    .setCustomId('onboarding_trigger_intro')
    .setLabel('📝 Isi Intro Card (Wajib)')
    .setStyle(ButtonStyle.Success);
    
  const rowIntro = new ActionRowBuilder().addComponents(introButton);

  await interaction.reply({
    content: '✅ Panel onboarding berhasil dikirim!',
    flags: 64
  });

  await interaction.channel.send({
    embeds: [embed],
    components: [rowGroup, rowCitizenship, rowIntro]
  });
}

/**
 * Menangani interaksi dari menu pilihan onboarding.
 * @param {StringSelectMenuInteraction} interaction - Interaksi select menu.
 */
async function handleOnboardingSelect(interaction) {
  const { values, member, guild } = interaction;
  const selectedValue = values[0];

  await interaction.deferReply({ flags: 64 });

  try {
    const roleId = selectedValue === 'baddies' ? ROLES.BADDIES : ROLES.BROS;
    const targetRole = guild.roles.cache.get(roleId);

    if (!targetRole) {
      return interaction.editReply({
        content: `❌ Gagal: Peran dengan ID \`${roleId}\` tidak ditemukan di server ini. Silakan hubungi admin.`
      });
    }

    // Tentukan role yang harus dihapus (jika memilih baddies, hapus bros, dan sebaliknya)
    const roleToRemoveId = selectedValue === 'baddies' ? ROLES.BROS : ROLES.BADDIES;

    // Proses update role
    if (member.roles.cache.has(roleToRemoveId)) {
      await member.roles.remove(roleToRemoveId);
    }
    await member.roles.add(roleId);

    const groupName = selectedValue === 'baddies' ? 'The Baddies 💋' : 'The Bros 🍻';

    return interaction.editReply({
      content: `🎉 **Onboarding Berhasil!** Anda kini terdaftar sebagai bagian dari **${groupName}**.\n` +
        `Sistem bot eksternal kami akan otomatis menyinkronkan profil Anda melalui peran baru ini.`
    });
  } catch (error) {
    console.error('Error saat onboarding select:', error);
    return interaction.editReply({
      content: '❌ Terjadi kesalahan saat mencoba menambahkan peran ke akun Anda. Pastikan bot memiliki posisi role yang cukup tinggi.'
    });
  }
}

/**
 * Menangani interaksi dari menu pilihan kewarganegaraan onboarding.
 * @param {StringSelectMenuInteraction} interaction - Interaksi select menu.
 */
async function handleOnboardingCitizenship(interaction) {
  const { values, member, guild } = interaction;
  const selectedValue = values[0];

  await interaction.deferReply({ flags: 64 });

  try {
    let roleId = '';
    let countryName = '';

    if (selectedValue === 'indonesia') {
      roleId = CITIZENSHIPS.INDONESIA;
      countryName = '🇮🇩 Indonesia';
    } else if (selectedValue === 'malaysia') {
      roleId = CITIZENSHIPS.MALAYSIA;
      countryName = '🇲🇾 Malaysia';
    } else if (selectedValue === 'international') {
      roleId = CITIZENSHIPS.INTERNATIONAL;
      countryName = '🌍 International';
    }

    const targetRole = guild.roles.cache.get(roleId);
    if (!targetRole) {
      return interaction.editReply({
        content: `❌ Gagal: Peran kewarganegaraan tidak ditemukan di server ini. Silakan hubungi admin.`
      });
    }

    // Hapus role kewarganegaraan lain agar tidak bertumpuk
    for (const key of Object.keys(CITIZENSHIPS)) {
      const otherRoleId = CITIZENSHIPS[key];
      if (otherRoleId !== roleId && member.roles.cache.has(otherRoleId)) {
        await member.roles.remove(otherRoleId);
      }
    }

    // Tambah role baru
    await member.roles.add(roleId);

    return interaction.editReply({
      content: `🎉 **Pembaruan Kewarganegaraan Berhasil!** Profil Anda sekarang terdaftar sebagai warga negara **${countryName}**.`
    });
  } catch (error) {
    console.error('Error saat onboarding citizenship:', error);
    return interaction.editReply({
      content: '❌ Terjadi kesalahan saat memperbarui kewarganegaraan Anda. Pastikan bot memiliki posisi role yang cukup tinggi.'
    });
  }
}

/**
 * Memunculkan pop-up modal Intro Card kepada pengguna.
 * @param {ButtonInteraction} interaction - Interaksi klik tombol.
 */
async function showIntroCardModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('onboarding_intro_modal')
    .setTitle('Form Intro Card Kosan 1A');

  // Input Fields
  const nameInput = new TextInputBuilder()
    .setCustomId('intro_name')
    .setLabel('Nama Lengkap / Panggilan')
    .setPlaceholder('Contoh: Key')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(100)
    .setRequired(true);

  const ageInput = new TextInputBuilder()
    .setCustomId('intro_age')
    .setLabel('Rentang Umur / Usia')
    .setPlaceholder('Contoh: 21+')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(20)
    .setRequired(true);

  const fromInput = new TextInputBuilder()
    .setCustomId('intro_from')
    .setLabel('Daerah Asal / Domisili')
    .setPlaceholder('Contoh: Sumatera')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(100)
    .setRequired(true);

  const robloxInput = new TextInputBuilder()
    .setCustomId('intro_roblox')
    .setLabel('Username Roblox / Mobile Legends (Opsional)')
    .setPlaceholder('Contoh: Roblox: oopsikeyed | MLBB: 12345678 (9012)')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(100)
    .setRequired(false);

  const interestsInput = new TextInputBuilder()
    .setCustomId('intro_interests')
    .setLabel('Hobi / Ketertarikan')
    .setPlaceholder('Contoh: kucing-kucingku, mendengarkan musik, gaming')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(1000)
    .setRequired(true);

  // Wrap inputs in Action Rows
  const row1 = new ActionRowBuilder().addComponents(nameInput);
  const row2 = new ActionRowBuilder().addComponents(ageInput);
  const row3 = new ActionRowBuilder().addComponents(fromInput);
  const row4 = new ActionRowBuilder().addComponents(robloxInput);
  const row5 = new ActionRowBuilder().addComponents(interestsInput);

  modal.addComponents(row1, row2, row3, row4, row5);

  await interaction.showModal(modal);
}

/**
 * Memproses pengiriman formulir Intro Card dari modal.
 * @param {ModalSubmitInteraction} interaction - Interaksi kirim modal.
 */
async function handleIntroCardSubmit(interaction) {
  const { member, guild } = interaction;
  await interaction.deferReply({ flags: 64 });

  try {
    const name = interaction.fields.getTextInputValue('intro_name');
    const age = interaction.fields.getTextInputValue('intro_age');
    const from = interaction.fields.getTextInputValue('intro_from');
    const roblox = interaction.fields.getTextInputValue('intro_roblox') || '-';
    const interests = interaction.fields.getTextInputValue('intro_interests');

    // 1. Dapatkan channel target #intro-card
    const introChannel = guild.channels.cache.get(INTRO_CHANNEL_ID) || await guild.channels.fetch(INTRO_CHANNEL_ID).catch(() => null);
    if (!introChannel || !introChannel.isTextBased()) {
      return interaction.editReply({
        content: '❌ Gagal: Saluran `#intro-card` tidak ditemukan. Silakan hubungi staff.'
      });
    }

    // 2. Buat Embed Intro Card
    const embed = new EmbedBuilder()
      .setColor(0x2ECC71) // Hijau ramah
      .setTitle('📝 KARTU IDENTITAS RESMI WARGA KOSAN 1A')
      .setDescription(`Warga baru telah mengenalkan diri! Yuk kenalan dengan <@${member.id}>.`)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '👤 Nama Panggilan', value: name, inline: true },
        { name: '🎂 Rentang Umur', value: age, inline: true },
        { name: '📍 Daerah Asal', value: from, inline: true },
        { name: '🎮 Roblox / MLBB', value: roblox !== '-' && roblox.trim() !== '' ? `\`${roblox}\`` : '-', inline: true },
        { name: '✨ Ketertarikan / Hobi', value: interests, inline: false }
      )
      .setFooter({ 
        text: `Kosan 1A Resident • ${member.user.tag}`, 
        iconURL: member.user.displayAvatarURL() 
      })
      .setTimestamp();

    // 3. Kirim ke channel #intro-card
    await introChannel.send({
      content: `📢 **Intro Card Baru dari <@${member.id}>!**`,
      embeds: [embed]
    });

    // 4. Berikan role terverifikasi (VIP Resident)
    const verifiedRole = guild.roles.cache.get(ROLES.VERIFIED);
    if (verifiedRole) {
      await member.roles.add(verifiedRole);
    } else {
      console.warn(`[Onboarding] Peran terverifikasi dengan ID ${ROLES.VERIFIED} tidak ditemukan di server.`);
    }

    // 5. Kembalikan peran yang dicabut (jika ada backup)
    try {
      const fs = require('fs');
      const path = require('path');
      const backupPath = path.join(__dirname, 'data', 'stripped_roles_backup.json');
      if (fs.existsSync(backupPath)) {
        const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        const userRoles = backupData[member.id];
        if (userRoles && Array.isArray(userRoles)) {
          console.log(`[Onboarding] Mengembalikan ${userRoles.length} peran untuk ${member.user.tag} dari backup...`);
          for (const roleId of userRoles) {
            const role = guild.roles.cache.get(roleId);
            if (role) {
              await member.roles.add(roleId).catch(err => {
                console.error(`[Onboarding] Gagal mengembalikan role ${role.name} ke ${member.user.tag}:`, err.message);
              });
            }
          }
          // Hapus dari data backup agar bersih
          delete backupData[member.id];
          fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf8');
        }
      }
    } catch (err) {
      console.error('[Onboarding] Gagal mengembalikan peran dari backup:', err.message);
    }

    return interaction.editReply({
      content: '🎉 **Intro Card Berhasil Dikirim!** Terima kasih telah mengenalkan diri. ' +
        'Peran **✅ Terverifikasi** serta seluruh peran Anda sebelumnya telah dikembalikan, dan seluruh area Kosan 1A kini terbuka untuk Anda! Selamat bergabung!'
    });
  } catch (error) {
    console.error('Error saat submit intro card:', error);
    return interaction.editReply({
      content: '❌ Terjadi kesalahan saat memproses formulir Anda. Pastikan bot memiliki izin dan posisi role yang cukup tinggi.'
    });
  }
}

/**
 * Menangani interaksi toggle tombol notifikasi onboarding.
 * @param {ButtonInteraction} interaction - Interaksi tombol.
 */
async function handleOnboardingNotificationToggle(interaction) {
  const { customId, member, guild } = interaction;
  await interaction.deferReply({ flags: 64 });

  let roleId = '';
  let roleName = '';

  if (customId === 'onboarding_toggle_notif_me') {
    roleId = '1520484871208960071';
    roleName = 'Notif Umum';
  } else if (customId === 'onboarding_toggle_gag2') {
    roleId = '1520484873700249671';
    roleName = 'Notif Grow a Garden 2';
  } else if (customId === 'onboarding_toggle_notif_gear') {
    roleId = '1520490683759329431';
    roleName = 'Notif Gear';
  }

  if (!roleId) {
    return interaction.editReply({ content: '❌ Terjadi kesalahan: Role ID tidak valid.' });
  }

  try {
    const role = guild.roles.cache.get(roleId);
    if (!role) {
      return interaction.editReply({ content: `❌ Gagal: Peran **${roleName}** (\`${roleId}\`) tidak ditemukan di server ini.` });
    }

    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId);
      return interaction.editReply({ content: `✅ Berhasil menghapus peran **${role.name}** dari akun Anda.` });
    } else {
      await member.roles.add(roleId);
      return interaction.editReply({ content: `✅ Berhasil menambahkan peran **${role.name}** ke akun Anda!` });
    }
  } catch (error) {
    console.error('Error toggling notification role:', error);
    return interaction.editReply({ content: '❌ Terjadi kesalahan saat memperbarui peran Anda. Pastikan bot memiliki posisi role yang cukup tinggi.' });
  }
}

/**
 * Menangani interaksi pemilihan peran dari select menu (dropdown).
 * @param {StringSelectMenuInteraction} interaction - Interaksi select menu.
 */
async function handleOnboardingRoleSelect(interaction) {
  const { values, member, guild } = interaction;
  await interaction.deferReply({ flags: 64 });

  let selectedRoleName = values[0].toLowerCase().trim();
  if (selectedRoleName === 'bloodmoon') selectedRoleName = 'blodmoon';

  // Load roles map
  let rolesMap = {};
  try {
    const fs = require('fs');
    const path = require('path');
    const mapPath = path.join(__dirname, 'roles_map.json');
    if (fs.existsSync(mapPath)) {
      rolesMap = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
    }
  } catch (e) {
    console.error("Failed to load roles_map.json:", e);
  }

  const roleId = rolesMap[selectedRoleName];
  if (!roleId) {
    return interaction.editReply({ content: `❌ Peran **${values[0]}** tidak terkonfigurasi di server ini.` });
  }

  try {
    const role = guild.roles.cache.get(roleId);
    if (!role) {
      return interaction.editReply({ content: `❌ Gagal: Peran **${values[0]}** (\`${roleId}\`) tidak ditemukan di server.` });
    }

    if (member.roles.cache.has(roleId)) {
      await member.roles.remove(roleId);
      return interaction.editReply({ content: `✅ Berhasil menghapus peran **${role.name}** dari akun Anda.` });
    } else {
      await member.roles.add(roleId);
      return interaction.editReply({ content: `✅ Berhasil menambahkan peran **${role.name}** ke akun Anda!` });
    }
  } catch (error) {
    console.error('Error toggling dropdown role:', error);
    return interaction.editReply({ content: '❌ Terjadi kesalahan saat memperbarui peran Anda. Pastikan bot memiliki posisi role yang cukup tinggi.' });
  }
}

/**
 * Menangani pencarian otomatis (autocomplete) nama peran untuk perintah /notif.
 * @param {AutocompleteInteraction} interaction - Interaksi autocomplete.
 */
async function handleNotifAutocomplete(interaction) {
  const focusedValue = interaction.options.getFocused().toLowerCase();

  // Load roles map
  let rolesMap = {};
  try {
    const fs = require('fs');
    const path = require('path');
    const mapPath = path.join(__dirname, 'roles_map.json');
    if (fs.existsSync(mapPath)) {
      rolesMap = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
    }
  } catch (e) {
    console.error("Failed to load roles_map.json:", e);
  }

  // Filter peran-peran spesifik GAG2 agar hasil pencarian rapi
  const allRoleNames = Object.keys(rolesMap).filter(name => {
    return name !== '@everyone' && (
      name.includes('2x+') ||
      name.includes('4x+') ||
      name.includes('notif') ||
      name.includes('sprinkler') ||
      name.includes('watering') ||
      name.includes('trowel') ||
      name.includes('aurora') ||
      name.includes('goldmoon') ||
      name.includes('lightning') ||
      name.includes('mega moon') ||
      name.includes('rain') ||
      name.includes('snowfall') ||
      name.includes('starfall') ||
      name.includes('blodmoon') ||
      name.includes('eclipse') ||
      name.includes('sunburst') ||
      name.includes('crate') ||
      name.includes('maple') ||
      ['carrot', 'strawberry', 'blueberry', 'tulip', 'tomato', 'apple', 'bamboo', 'corn', 'cactus', 'pineapple', 'mushroom', 'green bean', 'banana', 'grape', 'coconut', 'mango', 'dragon fruit', 'acorn', 'cherry', 'sunflower', 'venus fly trap', 'pomegranate', 'poison apple', 'venom spitter', 'moon bloom', 'dragon\'s breath', 'hypno bloom', 'hypnobloom', 'fire fern', 'rocket pop', 'star fruit', 'sun bloom',
        'basic pot', 'flashbang', 'gnome', 'invisibility mushroom', 'jump mushroom', 'lantern', 'shrink mushroom', 'speed mushroom', 'strawberry sniper', 'supersize mushroom', 'teleporter', 'wheelbarrow', 'briar rose'].includes(name)
    );
  });

  const filtered = allRoleNames
    .filter(choice => choice.toLowerCase().includes(focusedValue))
    .slice(0, 25);

  await interaction.respond(
    filtered.map(choice => ({
      name: choice.replace(/\b\w/g, c => c.toUpperCase()),
      value: choice
    }))
  ).catch(() => { });
}

/**
 * Menangani eksekusi perintah /notif untuk toggle peran.
 * @param {ChatInputCommandInteraction} interaction - Interaksi slash command.
 */
async function handleNotifCommand(interaction) {
  await interaction.deferReply({ flags: 64 });
  let selectedRoleName = interaction.options.getString('peran').toLowerCase().trim();
  if (selectedRoleName === 'bloodmoon') selectedRoleName = 'blodmoon';

  // Load roles map
  let rolesMap = {};
  try {
    const fs = require('fs');
    const path = require('path');
    const mapPath = path.join(__dirname, 'roles_map.json');
    if (fs.existsSync(mapPath)) {
      rolesMap = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
    }
  } catch (e) {
    console.error("Failed to load roles_map.json:", e);
  }

  const roleId = rolesMap[selectedRoleName];
  if (!roleId) {
    return interaction.editReply({ content: `❌ Peran **${interaction.options.getString('peran')}** tidak terkonfigurasi di server ini.` });
  }

  try {
    const role = interaction.guild.roles.cache.get(roleId);
    if (!role) {
      return interaction.editReply({ content: `❌ Gagal: Peran **${interaction.options.getString('peran')}** (\`${roleId}\`) tidak ditemukan di server.` });
    }

    if (interaction.member.roles.cache.has(roleId)) {
      await interaction.member.roles.remove(roleId);
      return interaction.editReply({ content: `✅ Berhasil menghapus peran **${role.name}** dari akun Anda.` });
    } else {
      await interaction.member.roles.add(roleId);
      return interaction.editReply({ content: `✅ Berhasil menambahkan peran **${role.name}** ke akun Anda!` });
    }
  } catch (error) {
    console.error('Error toggling slash command role:', error);
    return interaction.editReply({ content: '❌ Terjadi kesalahan saat memperbarui peran Anda. Pastikan bot memiliki posisi role yang cukup tinggi.' });
  }
}

/**
 * Membangun pesan-pesan panel onboarding untuk dikirim/diperbarui.
 */
function getOnboardingMessages() {
  const embed1 = new EmbedBuilder()
    .setColor(0x7C4DFF)
    .setTitle('🏡 PORTAL NOTIFIKASI KOSAN 1A')
    .setDescription(
      'Halo! Atur kustomisasi notifikasi utama server Anda di bawah ini:\n\n' +
      '• **Notif Umum**: Pengumuman penting server.\n' +
      '• **Notif Grow a Garden 2**: Notifikasi event, cuaca, & info kebun.\n' +
      '• **Notif Gear**: Pemberitahuan restok item & perkakas kebun.\n\n' +
      'Klik tombol **🔄 Segarkan** untuk memperbarui daftar menu kebun di bawah jika ada benih baru!'
    )
    .setFooter({ text: 'Kosan 1A Onboarding • Notifikasi Umum' })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('onboarding_toggle_notif_me').setLabel('🔔 Notif Umum').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('onboarding_toggle_gag2').setLabel('🌾 Notif Grow a Garden 2').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('onboarding_toggle_notif_gear').setLabel('⚙️ Notif Gear').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('onboarding_refresh_panel').setLabel('🔄 Segarkan').setStyle(ButtonStyle.Secondary)
  );

  // ═══════════════════════════════════════
  // MESSAGE 2: Tanaman, Item & Stok 2x+
  // ═══════════════════════════════════════
  const embed2 = new EmbedBuilder()
    .setColor(0x7C4DFF)
    .setTitle('▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n🌸  GARDEN NOTIFICATION FILTER  🌸\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬')
    .setDescription(
      'Atur preferensi notifikasi Anda secara mandiri agar tidak ketinggalan cuaca penting, restok peralatan langka, maupun pelipatgandaan stok benih di Grow a Garden 2.\n\n' +
      '📝 **Petunjuk Penggunaan:**\n' +
      ' 1. Pilih nama peran dari menu dropdown di bawah untuk **mengaktifkan** peran tersebut.\n' +
      ' 2. Pilih nama peran yang sama kembali untuk **menonaktifkan** peran tersebut.\n\n' +
      '🔍 **Pencarian Cepat Lewat Ketik:**\n' +
      'Gunakan perintah **`/notif`** di chat room mana saja lalu ketik nama peran (contoh: `Carrot`, `Aurora`, `Notif Gear`) untuk mencari dan mengambil peran secara instan!'
    )
    .setFooter({ text: 'Onboarding System • Tanaman, Item & Stok 2x+' })
    .setTimestamp();

  // Tanaman A–G (15 opsi)
  const menuPlantsAG = new StringSelectMenuBuilder()
    .setCustomId('onboarding_select_standar')
    .setPlaceholder('🌱 Tanaman A–G')
    .addOptions([
      { label: 'Acorn', value: 'Acorn', emoji: '🌰' },
      { label: 'Apple', value: 'Apple', emoji: '🍎' },
      { label: 'Bamboo', value: 'Bamboo', emoji: '🎍' },
      { label: 'Banana', value: 'Banana', emoji: '🍌' },
      { label: 'Blueberry', value: 'Blueberry', emoji: '🫐' },
      { label: 'Cactus', value: 'Cactus', emoji: '🌵' },
      { label: 'Carrot', value: 'Carrot', emoji: '🥕' },
      { label: 'Cherry', value: 'Cherry', emoji: '🍒' },
      { label: 'Coconut', value: 'Coconut', emoji: '🥥' },
      { label: 'Corn', value: 'Corn', emoji: '🌽' },
      { label: 'Dragon Fruit', value: 'Dragon Fruit', emoji: '🐉' },
      { label: 'Dragon\'s Breath', value: 'Dragon\'s Breath', emoji: '🔥' },
      { label: 'Fire Fern', value: 'Fire Fern', emoji: '🔥' },
      { label: 'Grape', value: 'Grape', emoji: '🍇' },
      { label: 'Green Bean', value: 'Green Bean', emoji: '🫛' }
    ].map(o => new StringSelectMenuOptionBuilder().setLabel(o.label).setValue(o.value).setEmoji(o.emoji)));

  // Tanaman H–Z (16 opsi)
  const menuPlantsHZ = new StringSelectMenuBuilder()
    .setCustomId('onboarding_select_standar2')
    .setPlaceholder('🌱 Tanaman H–Z')
    .addOptions([
      { label: 'Hypno Bloom', value: 'Hypno Bloom', emoji: '🌀' },
      { label: 'Mango', value: 'Mango', emoji: '🥭' },
      { label: 'Moon Bloom', value: 'Moon Bloom', emoji: '🌸' },
      { label: 'Mushroom', value: 'Mushroom', emoji: '🍄' },
      { label: 'Pineapple', value: 'Pineapple', emoji: '🍍' },
      { label: 'Poison Apple', value: 'Poison Apple', emoji: '🍏' },
      { label: 'Pomegranate', value: 'Pomegranate', emoji: '🍎' },
      { label: 'Rocket Pop', value: 'Rocket Pop', emoji: '🚀' },
      { label: 'Star Fruit', value: 'Star Fruit', emoji: '⭐' },
      { label: 'Strawberry', value: 'Strawberry', emoji: '🍓' },
      { label: 'Sun Bloom', value: 'Sun Bloom', emoji: '☀️' },
      { label: 'Sunflower', value: 'Sunflower', emoji: '🌻' },
      { label: 'Tomato', value: 'Tomato', emoji: '🍅' },
      { label: 'Tulip', value: 'Tulip', emoji: '🌷' },
      { label: 'Venom Spitter', value: 'Venom Spitter', emoji: '🧪' },
      { label: 'Venus Fly Trap', value: 'Venus Fly Trap', emoji: '🥀' }
    ].map(o => new StringSelectMenuOptionBuilder().setLabel(o.label).setValue(o.value).setEmoji(o.emoji)));

  // Item / Consumable (12 opsi)
  const menuItems = new StringSelectMenuBuilder()
    .setCustomId('onboarding_select_items')
    .setPlaceholder('🎒 Item & Consumable')
    .addOptions([
      { label: 'Basic Pot', value: 'Basic Pot', emoji: '🪴' },
      { label: 'Flashbang', value: 'Flashbang', emoji: '💥' },
      { label: 'Gnome', value: 'Gnome', emoji: '🧙' },
      { label: 'Invisibility Mushroom', value: 'Invisibility Mushroom', emoji: '👻' },
      { label: 'Jump Mushroom', value: 'Jump Mushroom', emoji: '🦘' },
      { label: 'Lantern', value: 'Lantern', emoji: '🏮' },
      { label: 'Shrink Mushroom', value: 'Shrink Mushroom', emoji: '🔬' },
      { label: 'Speed Mushroom', value: 'Speed Mushroom', emoji: '⚡' },
      { label: 'Strawberry Sniper', value: 'Strawberry Sniper', emoji: '🎯' },
      { label: 'Supersize Mushroom', value: 'Supersize Mushroom', emoji: '🍄' },
      { label: 'Teleporter', value: 'Teleporter', emoji: '🌀' },
      { label: 'Wheelbarrow', value: 'Wheelbarrow', emoji: '🛒' }
    ].map(o => new StringSelectMenuOptionBuilder().setLabel(o.label).setValue(o.value).setEmoji(o.emoji)));

  // 2x+ A–G (13 opsi)
  const menu2xAG = new StringSelectMenuBuilder()
    .setCustomId('onboarding_select_2x')
    .setPlaceholder('📈 Stok 2x+ (A–G)')
    .addOptions([
      { label: 'Acorn 2x+', value: 'Acorn 2x+', emoji: '🌰' },
      { label: 'Apple 2x+', value: 'Apple 2x+', emoji: '🍎' },
      { label: 'Baby Cactus 2x+', value: 'Baby Cactus 2x+', emoji: '🌵' },
      { label: 'Bamboo 2x+', value: 'Bamboo 2x+', emoji: '🎍' },
      { label: 'Banana 2x+', value: 'Banana 2x+', emoji: '🍌' },
      { label: 'Cactus 2x+', value: 'Cactus 2x+', emoji: '🌵' },
      { label: 'Cherry 2x+', value: 'Cherry 2x+', emoji: '🍒' },
      { label: 'Dragon Fruit 2x+', value: 'Dragon Fruit 2x+', emoji: '🐉' },
      { label: 'Dragon\'s Breath 2x+', value: 'Dragon\'s Breath 2x+', emoji: '🔥' },
      { label: 'Ghost Pepper 2x+', value: 'Ghost Pepper 2x+', emoji: '🌶️' },
      { label: 'Glow Mushroom 2x+', value: 'Glow Mushroom 2x+', emoji: '🍄' },
      { label: 'Grape 2x+', value: 'Grape 2x+', emoji: '🍇' },
      { label: 'Green Bean 2x+', value: 'Green Bean 2x+', emoji: '🫛' }
    ].map(o => new StringSelectMenuOptionBuilder().setLabel(o.label).setValue(o.value).setEmoji(o.emoji)));

  // 2x+ H–Z (14 opsi)
  const menu2xHZ = new StringSelectMenuBuilder()
    .setCustomId('onboarding_select_2x2')
    .setPlaceholder('📈 Stok 2x+ (H–Z)')
    .addOptions([
      { label: 'Horned Melon 2x+', value: 'Horned Melon 2x+', emoji: '🍈' },
      { label: 'Hypno Bloom 2x+', value: 'Hypno Bloom 2x+', emoji: '🌀' },
      { label: 'Mango 2x+', value: 'Mango 2x+', emoji: '🥭' },
      { label: 'Moon Bloom 2x+', value: 'Moon Bloom 2x+', emoji: '🌸' },
      { label: 'Mushroom 2x+', value: 'Mushroom 2x+', emoji: '🍄' },
      { label: 'Pineapple 2x+', value: 'Pineapple 2x+', emoji: '🍍' },
      { label: 'Poison Apple 2x+', value: 'Poison Apple 2x+', emoji: '🍏' },
      { label: 'Poison Ivy 2x+', value: 'Poison Ivy 2x+', emoji: '🌿' },
      { label: 'Pomegranate 2x+', value: 'Pomegranate 2x+', emoji: '🍎' },
      { label: 'Sunflower 2x+', value: 'Sunflower 2x+', emoji: '🌻' },
      { label: 'Tulip 2x+', value: 'Tulip 2x+', emoji: '🌷' },
      { label: 'Venom Spitter 2x+', value: 'Venom Spitter 2x+', emoji: '🧪' },
      { label: 'Venus Fly Trap 2x+', value: 'Venus Fly Trap 2x+', emoji: '🥀' },
      { label: 'Watermelon 2x+', value: 'Watermelon 2x+', emoji: '🍉' }
    ].map(o => new StringSelectMenuOptionBuilder().setLabel(o.label).setValue(o.value).setEmoji(o.emoji)));

  // ═══════════════════════════════════════
  // MESSAGE 3: Stok 4x+, Gear, Crate & Cuaca
  // ═══════════════════════════════════════
  const embed3 = new EmbedBuilder()
    .setColor(0x7C4DFF)
    .setTitle('▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n🚀  STOK 4x+, GEAR & CUACA  🚀\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬')
    .setDescription(
      'Lanjutan filter notifikasi kebun — pilih peran pelipatgandaan stok **4x+**, peralatan kebun (**Gear**), peti (**Crate**), dan cuaca (**Weather**) yang ingin Anda terima.'
    )
    .setFooter({ text: 'Onboarding System • Stok 4x+, Gear & Cuaca' })
    .setTimestamp();

  // 4x+ A–G (19 opsi)
  const menu4xAG = new StringSelectMenuBuilder()
    .setCustomId('onboarding_select_4x')
    .setPlaceholder('🚀 Stok 4x+ (A–G)')
    .addOptions([
      { label: 'Acorn 4x+', value: 'Acorn 4x+', emoji: '🌰' },
      { label: 'Apple 4x+', value: 'Apple 4x+', emoji: '🍎' },
      { label: 'Baby Cactus 4x+', value: 'Baby Cactus 4x+', emoji: '🌵' },
      { label: 'Bamboo 4x+', value: 'Bamboo 4x+', emoji: '🎍' },
      { label: 'Banana 4x+', value: 'Banana 4x+', emoji: '🍌' },
      { label: 'Blueberry 4x+', value: 'Blueberry 4x+', emoji: '🫐' },
      { label: 'Briar Rose 4x+', value: 'Briar Rose 4x+', emoji: '🌹' },
      { label: 'Cactus 4x+', value: 'Cactus 4x+', emoji: '🌵' },
      { label: 'Carrot 4x+', value: 'Carrot 4x+', emoji: '🥕' },
      { label: 'Cherry 4x+', value: 'Cherry 4x+', emoji: '🍒' },
      { label: 'Coconut 4x+', value: 'Coconut 4x+', emoji: '🥥' },
      { label: 'Corn 4x+', value: 'Corn 4x+', emoji: '🌽' },
      { label: 'Dragon Fruit 4x+', value: 'Dragon Fruit 4x+', emoji: '🐉' },
      { label: 'Dragon\'s Breath 4x+', value: 'Dragon\'s Breath 4x+', emoji: '🔥' },
      { label: 'Fire Fern 4x+', value: 'Fire Fern 4x+', emoji: '🔥' },
      { label: 'Ghost Pepper 4x+', value: 'Ghost Pepper 4x+', emoji: '🌶️' },
      { label: 'Glow Mushroom 4x+', value: 'Glow Mushroom 4x+', emoji: '🍄' },
      { label: 'Grape 4x+', value: 'Grape 4x+', emoji: '🍇' },
      { label: 'Green Bean 4x+', value: 'Green Bean 4x+', emoji: '🫛' }
    ].map(o => new StringSelectMenuOptionBuilder().setLabel(o.label).setValue(o.value).setEmoji(o.emoji)));

  // 4x+ H–Z (18 opsi)
  const menu4xHZ = new StringSelectMenuBuilder()
    .setCustomId('onboarding_select_4x2')
    .setPlaceholder('🚀 Stok 4x+ (H–Z)')
    .addOptions([
      { label: 'Horned Melon 4x+', value: 'Horned Melon 4x+', emoji: '🍈' },
      { label: 'Hypno Bloom 4x+', value: 'Hypno Bloom 4x+', emoji: '🌀' },
      { label: 'Mango 4x+', value: 'Mango 4x+', emoji: '🥭' },
      { label: 'Moon Bloom 4x+', value: 'Moon Bloom 4x+', emoji: '🌸' },
      { label: 'Mushroom 4x+', value: 'Mushroom 4x+', emoji: '🍄' },
      { label: 'Pineapple 4x+', value: 'Pineapple 4x+', emoji: '🍍' },
      { label: 'Poison Apple 4x+', value: 'Poison Apple 4x+', emoji: '🍏' },
      { label: 'Poison Ivy 4x+', value: 'Poison Ivy 4x+', emoji: '🌿' },
      { label: 'Pomegranate 4x+', value: 'Pomegranate 4x+', emoji: '🍎' },
      { label: 'Rocket Pop 4x+', value: 'Rocket Pop 4x+', emoji: '🚀' },
      { label: 'Star Fruit 4x+', value: 'Star Fruit 4x+', emoji: '⭐' },
      { label: 'Strawberry 4x+', value: 'Strawberry 4x+', emoji: '🍓' },
      { label: 'Sun Bloom 4x+', value: 'Sun Bloom 4x+', emoji: '☀️' },
      { label: 'Sunflower 4x+', value: 'Sunflower 4x+', emoji: '🌻' },
      { label: 'Tomato 4x+', value: 'Tomato 4x+', emoji: '🍅' },
      { label: 'Tulip 4x+', value: 'Tulip 4x+', emoji: '🌷' },
      { label: 'Venom Spitter 4x+', value: 'Venom Spitter 4x+', emoji: '🧪' },
      { label: 'Venus Fly Trap 4x+', value: 'Venus Fly Trap 4x+', emoji: '🥀' }
    ].map(o => new StringSelectMenuOptionBuilder().setLabel(o.label).setValue(o.value).setEmoji(o.emoji)));

  // Peralatan Kebun / Gears (8 opsi)
  const menuGears = new StringSelectMenuBuilder()
    .setCustomId('onboarding_select_gears')
    .setPlaceholder('🛠️ Peralatan Kebun')
    .addOptions([
      { label: 'Common Watering Can', value: 'Common Watering Can', emoji: '💧' },
      { label: 'Common Sprinkler', value: 'Common Sprinkler', emoji: '⚙️' },
      { label: 'Uncommon Sprinkler', value: 'Uncommon Sprinkler', emoji: '⚙️' },
      { label: 'Trowel', value: 'Trowel', emoji: '🛠️' },
      { label: 'Rare Sprinkler', value: 'Rare Sprinkler', emoji: '⚙️' },
      { label: 'Legendary Sprinkler', value: 'Legendary Sprinkler', emoji: '⚙️' },
      { label: 'Super Watering Can', value: 'Super Watering Can', emoji: '💧' },
      { label: 'Super Sprinkler', value: 'Super Sprinkler', emoji: '⚙️' }
    ].map(o => new StringSelectMenuOptionBuilder().setLabel(o.label).setValue(o.value).setEmoji(o.emoji)));

  // Peti / Crates (17 opsi)
  const menuCrates = new StringSelectMenuBuilder()
    .setCustomId('onboarding_select_crates')
    .setPlaceholder('📦 Peti / Crates')
    .addOptions([
      { label: 'Arch Crate', value: 'Arch Crate', emoji: '🏛️' },
      { label: 'Bear Trap Crate', value: 'Bear Trap Crate', emoji: '🪤' },
      { label: 'Bench Crate', value: 'Bench Crate', emoji: '🪑' },
      { label: 'Boombox Crate', value: 'Boombox Crate', emoji: '📻' },
      { label: 'Bridge Crate', value: 'Bridge Crate', emoji: '🌉' },
      { label: 'Conveyor Crate', value: 'Conveyor Crate', emoji: '🔄' },
      { label: 'Fence Crate', value: 'Fence Crate', emoji: '🏗️' },
      { label: 'Fourth of July Crate', value: 'Fourth of July Crate', emoji: '🎆' },
      { label: 'Ladder Crate', value: 'Ladder Crate', emoji: '🪜' },
      { label: 'Light Crate', value: 'Light Crate', emoji: '💡' },
      { label: 'Owner Door Crate', value: 'Owner Door Crate', emoji: '🚪' },
      { label: 'Picture Frame Crate', value: 'Picture Frame Crate', emoji: '🖼️' },
      { label: 'Roleplay Crate', value: 'Roleplay Crate', emoji: '🎭' },
      { label: 'Seesaw Crate', value: 'Seesaw Crate', emoji: '⚖️' },
      { label: 'Sign Crate', value: 'Sign Crate', emoji: '🪧' },
      { label: 'Spring Crate', value: 'Spring Crate', emoji: '🌸' },
      { label: 'Teleporter Pad Crate', value: 'Teleporter Pad Crate', emoji: '🌀' }
    ].map(o => new StringSelectMenuOptionBuilder().setLabel(o.label).setValue(o.value).setEmoji(o.emoji)));

  // Cuaca / Weather (12 opsi)
  const menuWeather = new StringSelectMenuBuilder()
    .setCustomId('onboarding_select_weather')
    .setPlaceholder('🌤️ Cuaca Kebun')
    .addOptions([
      { label: 'Aurora', value: 'Aurora', emoji: '🌌' },
      { label: 'Bloodmoon', value: 'blodmoon', emoji: '🔴' },
      { label: 'Eclipse', value: 'Eclipse', emoji: '🌑' },
      { label: 'Goldmoon', value: 'Goldmoon', emoji: '🌙' },
      { label: 'Lightning', value: 'Lightning', emoji: '⚡' },
      { label: 'Mega Moon', value: 'Mega Moon', emoji: '🌕' },
      { label: 'Rain', value: 'Rain', emoji: '🌧️' },
      { label: 'Rainbow', value: 'Rainbow', emoji: '🌈' },
      { label: 'Rainbow Moon', value: 'Rainbow Moon', emoji: '🌈' },
      { label: 'Snowfall', value: 'Snowfall', emoji: '❄️' },
      { label: 'Starfall', value: 'Starfall', emoji: '🌠' },
      { label: 'Sunburst', value: 'Sunburst', emoji: '☀️' }
    ].map(o => new StringSelectMenuOptionBuilder().setLabel(o.label).setValue(o.value).setEmoji(o.emoji)));

  // ═══════════════════════════════════════
  // MESSAGE 4: Maple Roles
  // ═══════════════════════════════════════
  const embed4 = new EmbedBuilder()
    .setColor(0x7C4DFF)
    .setTitle('▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n🍁  MAPLE NOTIFICATION FILTER  🌸\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬')
    .setDescription(
      'Pilih preferensi notifikasi peran **Maple** baru Anda di Grow a Garden 2 agar selalu ter-update dengan aktivitas benih Maple pilihan Anda.'
    )
    .setFooter({ text: 'Onboarding System • Maple Roles' })
    .setTimestamp();

  // Maple (24 opsi)
  const menuMaple = new StringSelectMenuBuilder()
    .setCustomId('onboarding_select_maple')
    .setPlaceholder('🍁 Peran Maple')
    .addOptions([
      { label: 'Maple Acorn', value: 'Maple Acorn', emoji: '🍁' },
      { label: 'Maple Apple', value: 'Maple Apple', emoji: '🍁' },
      { label: 'Maple Bamboo', value: 'Maple Bamboo', emoji: '🍁' },
      { label: 'Maple Banana', value: 'Maple Banana', emoji: '🍁' },
      { label: 'Maple Blueberry', value: 'Maple Blueberry', emoji: '🍁' },
      { label: 'Maple Cactus', value: 'Maple Cactus', emoji: '🍁' },
      { label: 'Maple Carrot', value: 'Maple Carrot', emoji: '🍁' },
      { label: 'Maple Cherry', value: 'Maple Cherry', emoji: '🍁' },
      { label: 'Maple Coconut', value: 'Maple Coconut', emoji: '🍁' },
      { label: 'Maple Corn', value: 'Maple Corn', emoji: '🍁' },
      { label: 'Maple Dragon Fruit', value: 'Maple Dragon Fruit', emoji: '🍁' },
      { label: 'Maple Grape', value: 'Maple Grape', emoji: '🍁' },
      { label: 'Maple Green Bean', value: 'Maple Green Bean', emoji: '🍁' },
      { label: 'Maple Mango', value: 'Maple Mango', emoji: '🍁' },
      { label: 'Maple Mushroom', value: 'Maple Mushroom', emoji: '🍁' },
      { label: 'Maple Pineapple', value: 'Maple Pineapple', emoji: '🍁' },
      { label: 'Maple Poison Apple', value: 'Maple Poison Apple', emoji: '🍁' },
      { label: 'Maple Pomegranate', value: 'Maple Pomegranate', emoji: '🍁' },
      { label: 'Maple Strawberry', value: 'Maple Strawberry', emoji: '🍁' },
      { label: 'Maple Sunflower', value: 'Maple Sunflower', emoji: '🍁' },
      { label: 'Maple Tomato', value: 'Maple Tomato', emoji: '🍁' },
      { label: 'Maple Tulip', value: 'Maple Tulip', emoji: '🍁' },
      { label: 'Maple Venom Spitter', value: 'Maple Venom Spitter', emoji: '🍁' },
      { label: 'Maple Venus Fly Trap', value: 'Maple Venus Fly Trap', emoji: '🍁' }
    ].map(o => new StringSelectMenuOptionBuilder().setLabel(o.label).setValue(o.value).setEmoji(o.emoji)));

  // Susun baris per pesan (max 5 ActionRow per pesan)
  const row2_1 = new ActionRowBuilder().addComponents(menuPlantsAG);
  const row2_2 = new ActionRowBuilder().addComponents(menuPlantsHZ);
  const row2_3 = new ActionRowBuilder().addComponents(menuItems);
  const row2_4 = new ActionRowBuilder().addComponents(menu2xAG);
  const row2_5 = new ActionRowBuilder().addComponents(menu2xHZ);

  const row3_1 = new ActionRowBuilder().addComponents(menu4xAG);
  const row3_2 = new ActionRowBuilder().addComponents(menu4xHZ);
  const row3_3 = new ActionRowBuilder().addComponents(menuGears);
  const row3_4 = new ActionRowBuilder().addComponents(menuCrates);
  const row3_5 = new ActionRowBuilder().addComponents(menuWeather);

  const row4_1 = new ActionRowBuilder().addComponents(menuMaple);

  return {
    message1: { embeds: [embed1], components: [row1] },
    message2: { embeds: [embed2], components: [row2_1, row2_2, row2_3, row2_4, row2_5] },
    message3: { embeds: [embed3], components: [row3_1, row3_2, row3_3, row3_4, row3_5] },
    message4: { embeds: [embed4], components: [row4_1] }
  };
}

/**
 * Menangani klik tombol refresh untuk memperbarui seluruh panel onboarding di saluran ini.
 */
async function handleOnboardingRefresh(interaction) {
  try {
    await interaction.deferReply({ flags: 64 });
    const { message1, message2, message3, message4 } = getOnboardingMessages();

    // Ambil beberapa pesan terakhir dari bot di channel ini
    const messages = await interaction.channel.messages.fetch({ limit: 25 });
    const botMessages = messages.filter(m => m.author.id === interaction.client.user.id).toJSON();

    // Temukan pesan dengan tombol refresh
    const buttonMsg = botMessages.find(m => m.components.some(row => row.components.some(c => c.customId === 'onboarding_refresh_panel')));
    // Temukan pesan dengan dropdowns tanaman (message2)
    const dropdownMsg = botMessages.find(m => m.components.some(row => row.components[0]?.customId === 'onboarding_select_standar'));
    // Temukan pesan dengan dropdowns 4x+/gear/cuaca (message3)
    const dropdownMsg3 = botMessages.find(m => m.components.some(row => row.components[0]?.customId === 'onboarding_select_4x'));
    // Temukan pesan dengan dropdown Maple (message4)
    const dropdownMsg4 = botMessages.find(m => m.components.some(row => row.components[0]?.customId === 'onboarding_select_maple'));

    if (buttonMsg) {
      await buttonMsg.edit({ embeds: message1.embeds, components: message1.components });
    }
    if (dropdownMsg) {
      await dropdownMsg.edit({ embeds: message2.embeds, components: message2.components });
    }
    if (dropdownMsg3) {
      await dropdownMsg3.edit({ embeds: message3.embeds, components: message3.components });
    }
    if (dropdownMsg4) {
      await dropdownMsg4.edit({ embeds: message4.embeds, components: message4.components });
    }

    return interaction.editReply({ content: '✅ Tampilan panel onboarding berhasil diperbarui!' });
  } catch (error) {
    console.error('Error saat refresh onboarding:', error);
    return interaction.editReply({ content: '❌ Terjadi kesalahan saat mencoba memperbarui panel onboarding.' });
  }
}



module.exports = {
  sendOnboardingPanel,
  sendGardenPanel,
  handleOnboardingSelect,
  handleOnboardingCitizenship,
  showIntroCardModal,
  handleIntroCardSubmit,
  handleOnboardingNotificationToggle,
  handleOnboardingRoleSelect,
  handleNotifAutocomplete,
  handleNotifCommand,
  getOnboardingMessages,
  handleOnboardingRefresh
};

