const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  StringSelectMenuOptionBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} = require('discord.js');

// Konfigurasi Peran (Roles)
const ROLES = {
  BADDIES: '1472170290175021193', // the baddies
  BROS: '1472170093416022096',     // the bros
};

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
    .setTitle('🏡 Selamat Datang di Server Kosan 1A!')
    .setDescription(
      'Halo! Silakan lengkapi profil onboarding Anda untuk membuka akses penuh ke seluruh area kosan ' +
      'dan menyinkronkan profil Anda dengan sistem server.\n\n' +
      '**Silakan pilih kelompok Anda di bawah ini:**\n' +
      '• **The Baddies** 💋\n' +
      '• **The Bros** 🍻'
    )
    .setFooter({ text: 'Onboarding Kosan 1A • Silakan pilih salah satu opsi di bawah' })
    .setTimestamp();

  // Create Select Menu
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('onboarding_select_group')
    .setPlaceholder('👉 Pilih kelompok Anda...')
    .addOptions([
      new StringSelectMenuOptionBuilder()
        .setLabel('The Baddies 💋')
        .setValue('baddies')
        .setDescription('Masuk ke kelompok The Baddies'),
      new StringSelectMenuOptionBuilder()
        .setLabel('The Bros 🍻')
        .setValue('bros')
        .setDescription('Masuk ke kelompok The Bros')
    ]);

  const row = new ActionRowBuilder().addComponents(selectMenu);

  await interaction.reply({
    content: '✅ Panel onboarding berhasil dikirim!',
    flags: 64
  });

  await interaction.channel.send({
    embeds: [embed],
    components: [row]
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

  const selectedRoleName = values[0].toLowerCase().trim();
  
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

module.exports = {
  sendOnboardingPanel,
  handleOnboardingSelect,
  handleOnboardingNotificationToggle,
  handleOnboardingRoleSelect
};
