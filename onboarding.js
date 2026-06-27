const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  StringSelectMenuBuilder, 
  ButtonStyle, 
  StringSelectMenuOptionBuilder 
} = require('discord.js');
const config = require('./stockmarket/config');
const onboardConfig = require('./onboardingConfig');

/**
 * Mengirimkan panel onboarding interaktif ke channel saat ini
 */
async function setupOnboardingCommand(interaction) {
  const { member, guild } = interaction;
  
  // Hanya Owner atau Administrator yang boleh menggunakan
  const isOwner = interaction.user.id === config.OWNER_ID;
  const isAdmin = member && member.permissions.has('Administrator');
  
  if (!isOwner && !isAdmin) {
    return interaction.reply({
      content: '❌ Hanya Administrator yang dapat mengatur panel onboarding!',
      flags: 64
    });
  }

  await interaction.deferReply({ flags: 64 });

  try {
    // 1. Embed Utama Onboarding
    const welcomeEmbed = new EmbedBuilder()
      .setColor(0x7C4DFF)
      .setTitle('🌟 PANEL ONBOARDING - CUSTOMIZATION QUESTIONS 🌟')
      .setDescription(
        `Selamat Datang di **${guild.name}**!\n\n` +
        `Silakan pilih kustomisasi profil Anda di bawah ini untuk mendapatkan role yang sesuai dan membuka akses penuh ke seluruh saluran server.\n\n` +
        `📝 **Langkah-langkah:**\n` +
        `1️⃣ Pilih gender Anda pada tombol **Gender**.\n` +
        `2️⃣ Pilih hobi/minat Anda pada menu **Hobi & Interest**.\n` +
        `3️⃣ Pilih asal wilayah Anda pada menu **Asal Wilayah**.\n` +
        `4️⃣ Tekan tombol **🚪 Selesai Onboarding** jika sudah selesai!`
      )
      .setImage('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop') // Aesthetic banner
      .setFooter({ text: `${guild.name} • Onboarding System`, iconURL: guild.iconURL() })
      .setTimestamp();

    // 2. Baris Komponen 1: Gender (Buttons)
    const genderRow = new ActionRowBuilder();
    onboardConfig.gender.options.forEach(opt => {
      let btnStyle = ButtonStyle.Primary;
      if (opt.style === 'Secondary') btnStyle = ButtonStyle.Secondary;
      if (opt.style === 'Success') btnStyle = ButtonStyle.Success;
      if (opt.style === 'Danger') btnStyle = ButtonStyle.Danger;

      genderRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`onboard_gender_${opt.id}`)
          .setLabel(opt.label)
          .setStyle(btnStyle)
          .setEmoji(opt.emoji)
      );
    });

    // 3. Baris Komponen 2: Interests (Select Menu)
    const interestMenu = new StringSelectMenuBuilder()
      .setCustomId('onboard_interest')
      .setPlaceholder(onboardConfig.interests.placeholder)
      .setMinValues(onboardConfig.interests.minValues)
      .setMaxValues(onboardConfig.interests.maxValues);

    onboardConfig.interests.options.forEach(opt => {
      interestMenu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(opt.label)
          .setDescription(opt.description)
          .setValue(opt.value)
          .setEmoji(opt.emoji)
      );
    });
    const interestRow = new ActionRowBuilder().addComponents(interestMenu);

    // 4. Baris Komponen 3: Regional (Select Menu)
    const regionalMenu = new StringSelectMenuBuilder()
      .setCustomId('onboard_regional')
      .setPlaceholder(onboardConfig.regional.placeholder)
      .setMinValues(1)
      .setMaxValues(1);

    onboardConfig.regional.options.forEach(opt => {
      regionalMenu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(opt.label)
          .setDescription(opt.description)
          .setValue(opt.value)
          .setEmoji(opt.emoji)
      );
    });
    const regionalRow = new ActionRowBuilder().addComponents(regionalMenu);

    // 5. Baris Komponen 4: Selesai Button
    const finishRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('onboard_finish')
        .setLabel('🚪 Selesai Onboarding')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🛡️')
    );

    // Kirim pesan ke channel
    await interaction.channel.send({
      embeds: [welcomeEmbed],
      components: [genderRow, interestRow, regionalRow, finishRow]
    });

    await interaction.editReply({
      content: '✅ Panel onboarding berhasil dikirim ke channel ini!'
    });

  } catch (error) {
    console.error('Error sending onboarding panel:', error);
    await interaction.editReply({
      content: '❌ Gagal mengirimkan panel onboarding ke channel ini.'
    });
  }
}

/**
 * Menangani interaksi tombol dan menu onboarding
 */
async function handleOnboardingInteractions(interaction) {
  const { customId, guild, member } = interaction;

  // Pastikan member masih valid
  if (!member) return;

  try {
    // ── 1. GENDER BUTTONS ──
    if (customId.startsWith('onboard_gender_')) {
      await interaction.deferReply({ flags: 64 });
      const genderId = customId.replace('onboard_gender_', '');
      
      const maleOption = onboardConfig.gender.options.find(o => o.id === 'male');
      const femaleOption = onboardConfig.gender.options.find(o => o.id === 'female');
      
      const roleToAdd = genderId === 'male' ? maleOption.roleId : femaleOption.roleId;
      const roleToRemove = genderId === 'male' ? femaleOption.roleId : maleOption.roleId;
      
      // Hapus role gender lawan jika ada
      if (roleToRemove && member.roles.cache.has(roleToRemove)) {
        await member.roles.remove(roleToRemove).catch(() => {});
      }
      
      // Tambah role gender terpilih
      if (roleToAdd) {
        await member.roles.add(roleToAdd);
        const label = genderId === 'male' ? maleOption.label : femaleOption.label;
        const emoji = genderId === 'male' ? maleOption.emoji : femaleOption.emoji;
        return interaction.editReply({
          content: `✅ Berhasil memilih gender: ${emoji} **${label}**!`
        });
      } else {
        return interaction.editReply({ content: '❌ Terjadi kesalahan: ID Role tidak ditemukan.' });
      }
    }

    // ── 2. INTEREST SELECT MENU ──
    if (customId === 'onboard_interest') {
      await interaction.deferReply({ flags: 64 });
      const selectedValues = interaction.values;
      
      // Ambil semua role interest yang ada di config
      const allInterestRoleIds = onboardConfig.interests.options.map(o => o.roleId).filter(Boolean);
      
      // Cari role mana saja yang dipilih
      const rolesToAdd = [];
      const rolesToRemove = [];
      
      onboardConfig.interests.options.forEach(opt => {
        if (selectedValues.includes(opt.value)) {
          if (opt.roleId) rolesToAdd.push(opt.roleId);
        } else {
          if (opt.roleId) rolesToRemove.push(opt.roleId);
        }
      });

      // Proses pelepasan role yang tidak dipilih
      for (const roleId of rolesToRemove) {
        if (member.roles.cache.has(roleId)) {
          await member.roles.remove(roleId).catch(() => {});
        }
      }

      // Proses pemasangan role yang dipilih
      for (const roleId of rolesToAdd) {
        if (!member.roles.cache.has(roleId)) {
          await member.roles.add(roleId).catch(() => {});
        }
      }

      const labels = onboardConfig.interests.options
        .filter(o => selectedValues.includes(o.value))
        .map(o => `${o.emoji} ${o.label}`)
        .join(', ');

      return interaction.editReply({
        content: `✅ Berhasil memperbarui Hobi/Interest Anda menjadi: **${labels}**!`
      });
    }

    // ── 3. REGIONAL SELECT MENU ──
    if (customId === 'onboard_regional') {
      await interaction.deferReply({ flags: 64 });
      const selectedValue = interaction.values[0];

      const allRegionalRoleIds = onboardConfig.regional.options.map(o => o.roleId).filter(Boolean);
      const chosenOption = onboardConfig.regional.options.find(o => o.value === selectedValue);

      if (!chosenOption || !chosenOption.roleId) {
        return interaction.editReply({ content: '❌ Terjadi kesalahan: Opsi regional tidak valid.' });
      }

      // Hapus role regional lainnya yang sedang dimiliki
      for (const roleId of allRegionalRoleIds) {
        if (roleId !== chosenOption.roleId && member.roles.cache.has(roleId)) {
          await member.roles.remove(roleId).catch(() => {});
        }
      }

      // Tambahkan role regional terpilih
      if (!member.roles.cache.has(chosenOption.roleId)) {
        await member.roles.add(chosenOption.roleId);
      }

      return interaction.editReply({
        content: `✅ Berhasil memperbarui Wilayah Asal Anda menjadi: ${chosenOption.emoji} **${chosenOption.label}**!`
      });
    }

    // ── 4. FINISH ONBOARDING BUTTON ──
    if (customId === 'onboard_finish') {
      await interaction.deferReply({ flags: 64 });

      // Cek apakah member sudah punya role Verified
      const hasVerified = member.roles.cache.has(onboardConfig.VERIFIED_ROLE_ID);

      // Berikan role Verified
      if (onboardConfig.VERIFIED_ROLE_ID && !hasVerified) {
        await member.roles.add(onboardConfig.VERIFIED_ROLE_ID);
      }

      // Hapus role Unverified jika dikonfigurasi
      if (onboardConfig.UNVERIFIED_ROLE_ID && member.roles.cache.has(onboardConfig.UNVERIFIED_ROLE_ID)) {
        await member.roles.remove(onboardConfig.UNVERIFIED_ROLE_ID).catch(() => {});
      }

      return interaction.editReply({
        content: `🎉 **Onboarding Selesai!** Selamat bergabung secara resmi di server kami. Anda sekarang telah memiliki akses penuh!`
      });
    }

  } catch (error) {
    console.error('Error handling onboarding interaction:', error);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: '❌ Terjadi kesalahan saat memproses pilihan Anda.' }).catch(() => {});
      } else {
        await interaction.reply({ content: '❌ Terjadi kesalahan saat memproses pilihan Anda.', flags: 64 }).catch(() => {});
      }
    } catch (e) {}
  }
}

module.exports = {
  setupOnboardingCommand,
  handleOnboardingInteractions
};
