const config = require('./config');
const database = require('./database');
const economy = require('./economy');
const stocks = require('./stocks');
const embeds = require('./embeds');
const scheduler = require('./scheduler');
const robbery = require('./robbery');
const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder, 
  StringSelectMenuOptionBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ModalBuilder, 
  PermissionsBitField, 
  UserSelectMenuBuilder 
} = require('discord.js');

/**
 * Handle Unified Visual Admin Panel Dashboard
 */
async function handleAdminPanel(message, client, initialTab = 'member') {
  const { guildId, author, guild } = message;
  if (!guildId) return false;

  const getOrCreateEbyusSettings = (gId) => {
    let settings = database.get('SELECT * FROM ebyus_settings WHERE guild_id = ?', [gId]);
    if (!settings) {
      database.run('INSERT INTO ebyus_settings (guild_id, gacha_mode, coin_multiplier, updated_at, updated_by, expires_at) VALUES (?, ?, ?, ?, ?, 0)', [gId, 'NORMAL', 1, 0, '']);
      settings = {
        guild_id: gId,
        gacha_mode: 'NORMAL',
        coin_multiplier: 1,
        updated_at: 0,
        updated_by: '',
        expires_at: 0
      };
    }
    return settings;
  };

  let selectedTargetUserId = null;
  let selectedTicker = null;
  let activeTab = initialTab; // member, event, bursa, shop

  const getAdminPanelData = (gId, targetUserId, ticker, currentTab) => {
    const settings = getOrCreateEbyusSettings(gId);
    
    let embed = new EmbedBuilder()
      .setThumbnail(client.user.displayAvatarURL())
      .setTimestamp();

    // 1. TABS NAVIGATION ROW
    const tabRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_tab_member')
        .setLabel('👤 Member Tools')
        .setStyle(currentTab === 'member' ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('admin_tab_event')
        .setLabel('🌐 Event & Bypass')
        .setStyle(currentTab === 'event' ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('admin_tab_bursa')
        .setLabel('📈 Bursa Saham')
        .setStyle(currentTab === 'bursa' ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('admin_tab_shop')
        .setLabel('🎭 Toko & ToD')
        .setStyle(currentTab === 'shop' ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );

    let components = [tabRow];

    if (currentTab === 'member') {
      embed.setColor(0x5865F2)
        .setTitle('👤 ADMIN CONTROL PANEL — MEMBER TOOLS')
        .setFooter({ text: 'Sentinel Admin • Member Tools Tab' });

      let targetText = '*Belum ada anggota terpilih (Silakan pilih di menu dropdown di bawah)*';
      if (targetUserId) {
        targetText = `🎯 **<@${targetUserId}>**\n` +
                     `• ID: \`${targetUserId}\`\n`;
        
        const walletRow = database.get('SELECT balance FROM wallets WHERE user_id = ? AND guild_id = ?', [targetUserId, gId]);
        const savingsRow = database.get('SELECT balance FROM bank_savings WHERE user_id = ? AND guild_id = ?', [targetUserId, gId]);
        const walletVal = walletRow ? walletRow.balance : 0;
        const bankVal = savingsRow ? savingsRow.balance : 0;
        targetText += `• Dompet: \`Rp ${walletVal.toLocaleString('id-ID')}\` | Bank: \`Rp ${bankVal.toLocaleString('id-ID')}\`\n`;
        
        const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [targetUserId, gId]);
        if (targetPet) {
          targetText += `• Pet: **${targetPet.pet_name}** (Lv.${targetPet.level} ${targetPet.pet_type.toUpperCase()}) | HP: \`${targetPet.health}%\` | XP: \`${targetPet.xp}/${targetPet.level * 100}\`\n`;
        } else {
          targetText += `• Pet: *Tidak ada peliharaan*\n`;
        }
        
        const nowUnix = Math.floor(Date.now() / 1000);
        const jail = database.get('SELECT jail_until FROM wallets WHERE user_id = ? AND guild_id = ? AND jail_until > ?', [targetUserId, gId, nowUnix]);
        if (jail) {
          targetText += `• Status Lapas: 🚨 **DITAHAN** (Sisa <t:${jail.jail_until}:R>)\n`;
        } else {
          targetText += `• Status Lapas: 🟢 Bebas\n`;
        }
      }

      embed.setDescription(
        `Gunakan dropdown untuk memilih target anggota, lalu pilih tindakan cepat yang ingin dilakukan ke anggota tersebut:\n\n` +
        `👤 **INFORMASI TARGET ANGGOTA:**\n${targetText}`
      );

      const userSelect = new UserSelectMenuBuilder()
        .setCustomId('admin_panel_select_target')
        .setPlaceholder('👤 Pilih Target Anggota untuk Tindakan');

      const userRow = new ActionRowBuilder().addComponents(userSelect);

      const actionSelect = new StringSelectMenuBuilder()
        .setCustomId('admin_panel_select_action')
        .setPlaceholder('🎯 Pilih Tindakan Cepat ke Target Anggota')
        .setDisabled(!targetUserId);

      actionSelect.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('🔓 Bebaskan dari Penjara Virtual')
          .setDescription('Mengeluarkan paksa target dari Lapas instan')
          .setValue('action_free_jail'),
        new StringSelectMenuOptionBuilder()
          .setLabel('❤️ Sembuhkan & Pulihkan Pet')
          .setDescription('HP, Kenyangan, Hidrasi Pet target disuntik 100%')
          .setValue('action_heal_pet'),
        new StringSelectMenuOptionBuilder()
          .setLabel('🐣 Percepat Penetasan Telur Pet')
          .setDescription('Mengatur status telur target agar siap menetas seketika')
          .setValue('action_hatch_pet'),
        new StringSelectMenuOptionBuilder()
          .setLabel('🧪 Suntik Custom XP Pet (Modal)')
          .setDescription('Menambahkan jumlah XP kustom ke Pet target')
          .setValue('action_give_xp_pet_modal'),
        new StringSelectMenuOptionBuilder()
          .setLabel('🦁 Ubah Level Pet (Modal)')
          .setDescription('Mengatur langsung level Pet target ke angka tertentu')
          .setValue('action_set_level_pet_modal'),
        new StringSelectMenuOptionBuilder()
          .setLabel('💀 Reset Data Pet Target')
          .setDescription('Menghapus total Pet target dari database kandang')
          .setValue('action_reset_pet'),
        new StringSelectMenuOptionBuilder()
          .setLabel('💸 Suntik Custom Koin (Modal)')
          .setDescription('Menambahkan koin dalam jumlah kustom ke dompet target')
          .setValue('action_give_coins_modal'),
        new StringSelectMenuOptionBuilder()
          .setLabel('📉 Tarik/Potong Custom Koin (Modal)')
          .setDescription('Menarik koin dalam jumlah kustom dari dompet target')
          .setValue('action_take_coins_modal'),
        new StringSelectMenuOptionBuilder()
          .setLabel('🚨 RESET EKONOMI TARGET')
          .setDescription('Mereset dompet, bank, & saham target ke nol')
          .setValue('action_reset_economy')
      );

      const actionRow = new ActionRowBuilder().addComponents(actionSelect);

      const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_panel_btn_status')
          .setLabel('📊 Status Real-time')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_panel_btn_close')
          .setLabel('❌ Tutup Panel')
          .setStyle(ButtonStyle.Danger)
      );

      components.push(userRow, actionRow, btnRow);
    }
    else if (currentTab === 'event') {
      embed.setColor(0x00FF88)
        .setTitle('🌐 ADMIN CONTROL PANEL — EVENT & BYPASS')
        .setFooter({ text: 'Sentinel Admin • Event & Bypass Tab' });

      embed.setDescription(
        `Kustomisasi tingkat kesulitan gacha, multiplier koin chat, durasi event, pemicu event bursa, serta reset cooldown Bank Heist:\n\n` +
        `📊 **STATUS BYPASS & EKONOMI SERVER:**\n` +
        `🎰 **Mode Gacha Role**: \`${settings.gacha_mode}\`\n` +
        `🪙 **Pengali Koin Chat**: \`${settings.coin_multiplier === 1 ? 'Nonaktif (1x)' : settings.coin_multiplier + 'x'}\`\n` +
        `⏱️ **Masa Berlaku Bypass**: ${settings.expires_at > 0 ? `<t:${settings.expires_at}:R>` : '`Permanen (Manual)`'}`
      );

      const gachaSelect = new StringSelectMenuBuilder()
        .setCustomId('admin_panel_select_gacha')
        .setPlaceholder('🎰 Atur Kesulitan Gacha Role');

      const gachaOptions = [
        { label: '🟢 Normal Mode (75% Zonk)', value: 'NORMAL', desc: 'Sesuai dengan probabilitas standar mesin gacha' },
        { label: '🟡 Easy Mode (40% Zonk)', value: 'EASY', desc: 'Tingkat kemenangan ditingkatkan hampir 2x lipat' },
        { label: '🟠 Super Easy Mode (15% Zonk)', value: 'SUPER_EASY', desc: 'Tingkat kemenangan ditingkatkan sangat tinggi' },
        { label: '🔴 Abuse Mode (0% Zonk - 100% Win!)', value: 'ABUSE', desc: 'Menang terus! Tingkat kegagalan disetel ke nol persen' }
      ];

      gachaOptions.forEach(opt => {
        gachaSelect.addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel(opt.label)
            .setDescription(opt.desc)
            .setValue(opt.value)
            .setDefault(settings.gacha_mode === opt.value)
        );
      });

      const gachaRow = new ActionRowBuilder().addComponents(gachaSelect);

      const coinSelect = new StringSelectMenuBuilder()
        .setCustomId('admin_panel_select_multiplier')
        .setPlaceholder('🪙 Atur Pengali Koin Chat');

      const coinOptions = [
        { label: '❌ Nonaktifkan Multiplier (1x)', value: '1', desc: 'Pendapatan koin chat normal (5 - 15 Rp per chat)' },
        { label: '⚡ 3x Coin Multiplier', value: '3', desc: 'Koin yang didapat dilipatgandakan 3 kali lipat!' },
        { label: '⚡ 4x Coin Multiplier', value: '4', desc: 'Koin yang didapat dilipatgandakan 4 kali lipat!' },
        { label: '⚡ 5x Coin Multiplier', value: '5', desc: 'Koin yang didapat dilipatgandakan 5 kali lipat!' },
        { label: '⚡ 6x Coin Multiplier', value: '6', desc: 'Koin yang didapat dilipatgandakan 6 kali lipat!' },
        { label: '⚡ 7x Coin Multiplier', value: '7', desc: 'Koin yang didapat dilipatgandakan 7 kali lipat!' },
        { label: '💀 8x ABUSE Multiplier!', value: '8', desc: 'SABOTASE MAKSIMAL! Koin chat dilipatgandakan 8x lipat!' }
      ];

      coinOptions.forEach(opt => {
        coinSelect.addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel(opt.label)
            .setDescription(opt.desc)
            .setValue(opt.value)
            .setDefault(settings.coin_multiplier === parseInt(opt.value))
        );
      });

      const coinRow = new ActionRowBuilder().addComponents(coinSelect);

      const globalSelect = new StringSelectMenuBuilder()
        .setCustomId('admin_panel_select_global')
        .setPlaceholder('🌐 Picu Event Global & Reset Cooldown');

      globalSelect.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('📈 Picu Bursa: Event Bull Run')
          .setDescription('Event harga saham melesat naik di bursa')
          .setValue('global_trigger_bull'),
        new StringSelectMenuOptionBuilder()
          .setLabel('📉 Picu Bursa: Event Market Crash')
          .setDescription('Event penurunan tajam harga saham bursa')
          .setValue('global_trigger_crash'),
        new StringSelectMenuOptionBuilder()
          .setLabel('💰 Picu Bursa: Double Earning Hour')
          .setDescription('Picu event pendapatan ganda bursa instan')
          .setValue('global_trigger_double'),
        new StringSelectMenuOptionBuilder()
          .setLabel('🚨 Reset Cooldown Global Bank Heist')
          .setDescription('Admins & Warga bisa merampok bank lagi tanpa cooldown')
          .setValue('global_reset_heist_cd'),
        new StringSelectMenuOptionBuilder()
          .setLabel('🔓 Bebaskan Seluruh Tahanan Lapas')
          .setDescription('Mengeluarkan paksa semua tahanan dari penjara virtual')
          .setValue('global_free_all_jail'),
        new StringSelectMenuOptionBuilder()
          .setLabel('💸 Bagikan Dividen Saham Mingguan')
          .setDescription('Memicu pembagian dividen bursa mingguan secara manual')
          .setValue('global_trigger_dividends'),
        new StringSelectMenuOptionBuilder()
          .setLabel('💰 Suntik Koin ke Seluruh Member (Eco-GiveAll)')
          .setDescription('Membuka modal untuk membagikan koin ke semua warga')
          .setValue('global_give_all_coins_modal')
      );

      const globalRow = new ActionRowBuilder().addComponents(globalSelect);

      const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_panel_btn_broadcast')
          .setLabel('📢 Broadcast Event')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('admin_panel_btn_duration')
          .setLabel('⏱️ Set Durasi (Modal)')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('admin_panel_btn_stop_abyus')
          .setLabel('🛑 Stop Event Abyus')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('admin_panel_btn_close')
          .setLabel('❌ Tutup Panel')
          .setStyle(ButtonStyle.Danger)
      );

      components.push(gachaRow, coinRow, globalRow, btnRow);
    }
    else if (currentTab === 'bursa') {
      embed.setColor(0xFFA500)
        .setTitle('📈 ADMIN CONTROL PANEL — MANAJEMEN BURSA')
        .setFooter({ text: 'Sentinel Admin • Bursa Saham Tab' });

      const activeStocks = database.all('SELECT * FROM stocks WHERE guild_id = ?', [gId]);
      
      let bursaList = '*Tidak ada instrumen saham terdaftar di bursa*';
      if (activeStocks.length > 0) {
        bursaList = activeStocks.map(s => {
          return `👉 **${s.stock_ticker}** (#${s.stock_name}) — Harga: \`Rp ${s.current_price.toLocaleString('id-ID')}\` | Tersedia: \`${s.available_shares} lbr\``;
        }).join('\n');
      }

      let tickerText = ticker ? `🎯 **Ticker Terpilih:** \`${ticker}\` (Silakan pilih aksi saham di bawah)` : '*Belum ada ticker terpilih (Silakan pilih di dropdown bursa)*';

      embed.setDescription(
        `Kelola bursa saham server: daftarkan channel baru, hapus saham lama, atau paksa turunkan harga saham tertentu:\n\n` +
        `📈 **DAFTAR SAHAM AKTIF BURSA:**\n${bursaList}\n\n` +
        `${tickerText}`
      );

      const tickerSelect = new StringSelectMenuBuilder()
        .setCustomId('admin_panel_select_ticker')
        .setPlaceholder('📈 Pilih Ticker Saham Terdaftar');

      if (activeStocks.length > 0) {
        activeStocks.forEach(s => {
          tickerSelect.addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel(`${s.stock_ticker} - Rp ${s.current_price.toLocaleString('id-ID')}`)
              .setDescription(`Saham channel #${s.stock_name}`)
              .setValue(s.stock_ticker)
              .setDefault(ticker === s.stock_ticker)
          );
        });
      } else {
        tickerSelect.addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel('Kosong')
            .setValue('KOSONG')
        ).setDisabled(true);
      }

      const tickerRow = new ActionRowBuilder().addComponents(tickerSelect);

      const bursaActionSelect = new StringSelectMenuBuilder()
        .setCustomId('admin_panel_select_bursa_action')
        .setPlaceholder('📉 Tindakan untuk Saham Terpilih')
        .setDisabled(!ticker || ticker === 'KOSONG');

      bursaActionSelect.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('📉 Paksa Turunkan Harga Saham (Drop Modal)')
          .setDescription('Menurunkan harga saham terpilih sebesar persentase tertentu')
          .setValue('bursa_action_drop_modal'),
        new StringSelectMenuOptionBuilder()
          .setLabel('❌ Hapus Saham dari Bursa')
          .setDescription('Menghapus total instrumen saham ini beserta portofolio terkait')
          .setValue('bursa_action_remove')
      );

      const bursaActionRow = new ActionRowBuilder().addComponents(bursaActionSelect);

      const bursaGlobalSelect = new StringSelectMenuBuilder()
        .setCustomId('admin_panel_select_bursa_global')
        .setPlaceholder('🌐 Tindakan Global Bursa');

      bursaGlobalSelect.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('➕ Daftarkan Channel Baru ke Bursa (Modal)')
          .setDescription('Mendaftarkan text channel baru sebagai instrumen saham')
          .setValue('bursa_global_add_modal'),
        new StringSelectMenuOptionBuilder()
          .setLabel('🔄 Re-Inisialisasi Bursa (Reset Default)')
          .setDescription('Menghapus semua saham lama & memulihkan setelan default')
          .setValue('bursa_global_reinit')
      );

      const bursaGlobalRow = new ActionRowBuilder().addComponents(bursaGlobalSelect);

      const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_panel_btn_close')
          .setLabel('❌ Tutup Panel')
          .setStyle(ButtonStyle.Danger)
      );

      components.push(tickerRow, bursaActionRow, bursaGlobalRow, btnRow);
    }
    else if (currentTab === 'shop') {
      embed.setColor(0xFF3366)
        .setTitle('🎭 ADMIN CONTROL PANEL — TOKO ROLE & GAME ToD')
        .setFooter({ text: 'Sentinel Admin • Toko & ToD Tab' });

      const shopItems = database.all('SELECT * FROM shop_items WHERE guild_id = ?', [gId]);
      let shopList = '*Tidak ada item role terdaftar di toko*';
      if (shopItems.length > 0) {
        shopList = shopItems.map((item, idx) => {
          return `${idx + 1}. <@&${item.role_id}> (${item.tier}) — Harga: \`Rp ${item.price.toLocaleString('id-ID')}\` | Stok: \`${item.stock === -1 ? 'Unlimited' : item.stock + ' slot'}\``;
        }).join('\n');
      }

      embed.setDescription(
        `Tambahkan/hapus role dari toko, kelola ketersediaan stok role, atau kontrol sesi game Truth or Dare di Voice Channel:\n\n` +
        `🎭 **DAFTAR ITEM TOKO ROLE AKTIF:**\n${shopList}`
      );

      const shopActionSelect = new StringSelectMenuBuilder()
        .setCustomId('admin_panel_select_shop_action')
        .setPlaceholder('🎭 Kelola Penjualan Toko Role');

      shopActionSelect.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('➕ Tambahkan Jual Role Baru (Modal)')
          .setDescription('Menjual role server ke etalase toko beserta tier & deskripsi')
          .setValue('shop_action_add_modal'),
        new StringSelectMenuOptionBuilder()
          .setLabel('❌ Hapus Item Role dari Toko (Modal)')
          .setDescription('Menghapus item role terdaftar dari toko bursa')
          .setValue('shop_action_remove_modal'),
        new StringSelectMenuOptionBuilder()
          .setLabel('⚙️ Ubah Jumlah Stok Role (Modal)')
          .setDescription('Mengubah ketersediaan slot role terdaftar')
          .setValue('shop_action_stock_modal'),
        new StringSelectMenuOptionBuilder()
          .setLabel('👑 Auto-Setup 5 Toko Role Prestise')
          .setDescription('Membuat & menyetel otomatis role Common s/d Mythic')
          .setValue('shop_action_auto')
      );

      const shopActionRow = new ActionRowBuilder().addComponents(shopActionSelect);

      const todActionSelect = new StringSelectMenuBuilder()
        .setCustomId('admin_panel_select_tod_action')
        .setPlaceholder('🎲 Kelola Game Truth or Dare (ToD)');

      todActionSelect.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('📢 Siarkan Pengumuman Sesi ToD Baru')
          .setDescription('Menyiarkan template embed peluncuran game ToD cantik')
          .setValue('tod_action_announce'),
        new StringSelectMenuOptionBuilder()
          .setLabel('🛑 Hentikan Paksa Sesi Game ToD Aktif')
          .setDescription('Menghentikan paksa sesi ToD yang berjalan di Voice Channel')
          .setValue('tod_action_stop'),
        new StringSelectMenuOptionBuilder()
          .setLabel('➕ Tambahkan Pertanyaan ToD Baru (Modal)')
          .setDescription('Menambahkan pertanyaan kustom baru ke database ToD')
          .setValue('tod_action_add_question_modal')
      );

      const todActionRow = new ActionRowBuilder().addComponents(todActionSelect);

      const btnRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_panel_btn_close')
          .setLabel('❌ Tutup Panel')
          .setStyle(ButtonStyle.Danger)
      );

      components.push(shopActionRow, todActionRow, btnRow);
    }

    return { embeds: [embed], components };
  };

  const initialPanel = getAdminPanelData(guildId, selectedTargetUserId, selectedTicker, activeTab);
  const replyMsg = await message.reply(initialPanel);

  const collector = replyMsg.createMessageComponentCollector({
    time: 300000
  });

  collector.on('collect', async iAdmin => {
    if (!iAdmin.member || !iAdmin.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return iAdmin.reply({ content: '❌ Akses Ditolak! Tombol/menu dashboard ini dikunci khusus untuk Administrator server.', ephemeral: true });
    }

    const nowUnix = Math.floor(Date.now() / 1000);

    try {
      // TAB NAVIGATION SWAP
      if (iAdmin.customId === 'admin_tab_member') {
        activeTab = 'member';
        const fresh = getAdminPanelData(guildId, selectedTargetUserId, selectedTicker, activeTab);
        await iAdmin.update(fresh);
      }
      else if (iAdmin.customId === 'admin_tab_event') {
        activeTab = 'event';
        const fresh = getAdminPanelData(guildId, selectedTargetUserId, selectedTicker, activeTab);
        await iAdmin.update(fresh);
      }
      else if (iAdmin.customId === 'admin_tab_bursa') {
        activeTab = 'bursa';
        const fresh = getAdminPanelData(guildId, selectedTargetUserId, selectedTicker, activeTab);
        await iAdmin.update(fresh);
      }
      else if (iAdmin.customId === 'admin_tab_shop') {
        activeTab = 'shop';
        const fresh = getAdminPanelData(guildId, selectedTargetUserId, selectedTicker, activeTab);
        await iAdmin.update(fresh);
      }
      // 1. Pilihan target user
      else if (iAdmin.customId === 'admin_panel_select_target') {
        selectedTargetUserId = iAdmin.values[0];
        const fresh = getAdminPanelData(guildId, selectedTargetUserId, selectedTicker, activeTab);
        await iAdmin.update(fresh);
      }
      // 2. Tindakan cepat ke target user
      else if (iAdmin.customId === 'admin_panel_select_action') {
        const action = iAdmin.values[0];
        if (!selectedTargetUserId) {
          return iAdmin.reply({ content: '❌ Silakan pilih target anggota terlebih dahulu!', ephemeral: true });
        }

        if (action === 'action_free_jail') {
          const nowUnix = Math.floor(Date.now() / 1000);
          const wallet = database.get('SELECT jail_until FROM wallets WHERE user_id = ? AND guild_id = ?', [selectedTargetUserId, guildId]);
          const isJailed = wallet && wallet.jail_until > nowUnix;
          if (!isJailed) {
            return iAdmin.reply({ content: '❌ Anggota terpilih tidak sedang berada di dalam penjara virtual!', ephemeral: true });
          }
          database.run("UPDATE wallets SET jail_until = 0, jail_type = '' WHERE user_id = ? AND guild_id = ?", [selectedTargetUserId, guildId]);
          await iAdmin.reply({ content: `🔓 Sukses membebaskan paksa <@${selectedTargetUserId}> dari penjara virtual.`, ephemeral: true });
          const fresh = getAdminPanelData(guildId, selectedTargetUserId, selectedTicker, activeTab);
          await replyMsg.edit(fresh).catch(() => {});
        }
        else if (action === 'action_hatch_pet') {
          const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          if (!targetPet) {
            return iAdmin.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan (pet)!', ephemeral: true });
          }
          if (targetPet.status !== 'EGG') {
            return iAdmin.reply({ content: '❌ Pet milik anggota terpilih sudah menetas!', ephemeral: true });
          }
          const now = Math.floor(Date.now() / 1000);
          database.run('UPDATE user_pets SET hatch_at = ? WHERE user_id = ? AND guild_id = ? AND is_active = 1', [now - 10, selectedTargetUserId, guildId]);
          await iAdmin.reply({ content: `🐣 Sukses mempercepat penetasan telur pet **${targetPet.pet_name}** milik <@${selectedTargetUserId}>. Telur sekarang siap menetas!`, ephemeral: true });
          const fresh = getAdminPanelData(guildId, selectedTargetUserId, selectedTicker, activeTab);
          await replyMsg.edit(fresh).catch(() => {});
        }
        else if (action === 'action_heal_pet') {
          const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          if (!targetPet) {
            return iAdmin.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan (pet)!', ephemeral: true });
          }
          database.run('UPDATE user_pets SET health = 100, hunger = 100, thirst = 100, happiness = 100 WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          await iAdmin.reply({ content: `❤️ Sukses memulihkan stats HP, Kenyangan, & Hidrasi pet milik <@${selectedTargetUserId}> menjadi 100%.`, ephemeral: true });
          const fresh = getAdminPanelData(guildId, selectedTargetUserId, selectedTicker, activeTab);
          await replyMsg.edit(fresh).catch(() => {});
        }
        else if (action === 'action_give_xp_pet_modal') {
          const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          if (!targetPet) {
            return iAdmin.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan (pet)!', ephemeral: true });
          }
          
          const modal = new ModalBuilder()
            .setCustomId('admin_give_xp_modal')
            .setTitle('Suntik XP Pet Member');

          const xpInput = new TextInputBuilder()
            .setCustomId('xp_amount')
            .setLabel('Jumlah XP Pet')
            .setPlaceholder('Contoh: 500')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(xpInput));
          await iAdmin.showModal(modal);

          const sub = await iAdmin.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_give_xp_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const amount = parseInt(sub.fields.getTextInputValue('xp_amount'));
            if (isNaN(amount) || amount <= 0) {
              return sub.reply({ content: '❌ Jumlah harus berupa angka bulat di atas 0!', ephemeral: true });
            }
            const petData = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
            if (!petData) {
              return sub.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan (pet)!', ephemeral: true });
            }
            let newXp = petData.xp + amount;
            let level = petData.level;
            const xpNeeded = level * 100;
            let leveledUp = false;
            if (newXp >= xpNeeded) {
              newXp -= xpNeeded;
              level += 1;
              leveledUp = true;
            }
            database.run('UPDATE user_pets SET xp = ?, level = ? WHERE user_id = ? AND guild_id = ? AND is_active = 1', [newXp, level, selectedTargetUserId, guildId]);
            
            await sub.reply({ content: `🧪 Sukses memberikan **+${amount} XP** ke pet milik <@${selectedTargetUserId}>!${leveledUp ? ` Pet naik ke Level **${level}**! 🎉` : ''}`, ephemeral: true });
            const fresh = getAdminPanelData(guildId, selectedTargetUserId, selectedTicker, activeTab);
            await replyMsg.edit(fresh).catch(() => {});
          }
        }
        else if (action === 'action_set_level_pet_modal') {
          const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          if (!targetPet) {
            return iAdmin.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan (pet)!', ephemeral: true });
          }
          
          const modal = new ModalBuilder()
            .setCustomId('admin_set_level_modal')
            .setTitle('Atur Level Pet Member');

          const lvlInput = new TextInputBuilder()
            .setCustomId('lvl_amount')
            .setLabel('Level Pet (1 - 100)')
            .setPlaceholder('Contoh: 10')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(lvlInput));
          await iAdmin.showModal(modal);

          const sub = await iAdmin.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_set_level_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const level = parseInt(sub.fields.getTextInputValue('lvl_amount'));
            if (isNaN(level) || level <= 0 || level > 100) {
              return sub.reply({ content: '❌ Level harus berupa angka bulat antara 1 hingga 100!', ephemeral: true });
            }
            const petData = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
            if (!petData) {
              return sub.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan (pet)!', ephemeral: true });
            }
            
            let newStatus = petData.status;
            if (newStatus !== 'DEAD') {
              newStatus = level >= 10 ? 'ADULT' : (newStatus === 'EGG' ? 'EGG' : 'BABY');
            }
            
            database.run('UPDATE user_pets SET level = ?, status = ? WHERE user_id = ? AND guild_id = ? AND is_active = 1', [level, newStatus, selectedTargetUserId, guildId]);
            
            await sub.reply({ content: `🦁 Sukses mengatur level pet milik <@${selectedTargetUserId}> menjadi Level **${level}**! (Status: **${newStatus}**)`, ephemeral: true });
            const fresh = getAdminPanelData(guildId, selectedTargetUserId, selectedTicker, activeTab);
            await replyMsg.edit(fresh).catch(() => {});
          }
        }
        else if (action === 'action_reset_pet') {
          const targetPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1', [selectedTargetUserId, guildId]);
          if (!targetPet) {
            return iAdmin.reply({ content: '❌ Anggota terpilih tidak memiliki peliharaan (pet) aktif untuk direset!', ephemeral: true });
          }
          
          database.transaction(() => {
            database.run('DELETE FROM user_pets WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [selectedTargetUserId, guildId, targetPet.pet_name]);
            const remainingRow = database.get('SELECT COUNT(*) as count FROM user_pets WHERE user_id = ? AND guild_id = ?', [selectedTargetUserId, guildId]);
            const remaining = remainingRow ? remainingRow.count : 0;
            if (remaining === 0) {
              database.run('DELETE FROM pet_inventory WHERE user_id = ? AND guild_id = ?', [selectedTargetUserId, guildId]);
            } else {
              const nextPet = database.get('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? LIMIT 1', [selectedTargetUserId, guildId]);
              if (nextPet) {
                database.run('UPDATE user_pets SET is_active = 1 WHERE user_id = ? AND guild_id = ? AND pet_name = ?', [selectedTargetUserId, guildId, nextPet.pet_name]);
              }
            }
          })();
          
          await iAdmin.reply({ content: `💀 Sukses menghapus data pet aktif **${targetPet.pet_name}** milik <@${selectedTargetUserId}> dari database kandang.`, ephemeral: true });
          const fresh = getAdminPanelData(guildId, selectedTargetUserId, selectedTicker, activeTab);
          await replyMsg.edit(fresh).catch(() => {});
        }
        else if (action === 'action_give_coins_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_give_coins_modal')
            .setTitle('Suntik Koin Member');

          const amountInput = new TextInputBuilder()
            .setCustomId('coin_amount')
            .setLabel('Jumlah Koin (Rupiah)')
            .setPlaceholder('Contoh: 15000')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
          await iAdmin.showModal(modal);

          const sub = await iAdmin.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_give_coins_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const amount = parseInt(sub.fields.getTextInputValue('coin_amount'));
            if (isNaN(amount) || amount <= 0) {
              return sub.reply({ content: '❌ Jumlah harus berupa angka bulat di atas 0!', ephemeral: true });
            }
            economy.addBalance(selectedTargetUserId, guildId, amount, 'ADMIN_GIVE');
            
            await sub.reply({ content: `💸 Sukses menyuntikkan koin **Rp ${amount.toLocaleString('id-ID')}** langsung ke dompet <@${selectedTargetUserId}>!`, ephemeral: true });
            const fresh = getAdminPanelData(guildId, selectedTargetUserId, selectedTicker, activeTab);
            await replyMsg.edit(fresh).catch(() => {});
          }
        }
        else if (action === 'action_take_coins_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_take_coins_modal')
            .setTitle('Tarik Koin Member');

          const amountInput = new TextInputBuilder()
            .setCustomId('coin_amount')
            .setLabel('Jumlah Koin (Rupiah)')
            .setPlaceholder('Contoh: 5000')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
          await iAdmin.showModal(modal);

          const sub = await iAdmin.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_take_coins_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const amount = parseInt(sub.fields.getTextInputValue('coin_amount'));
            if (isNaN(amount) || amount <= 0) {
              return sub.reply({ content: '❌ Jumlah harus berupa angka bulat di atas 0!', ephemeral: true });
            }
            const wallet = economy.getWallet(selectedTargetUserId, guildId);
            const amountToTake = Math.min(wallet.balance, amount);
            if (amountToTake > 0) {
              economy.subtractBalance(selectedTargetUserId, guildId, amountToTake, 'ADMIN_TAKE');
            }
            
            await sub.reply({ content: `📉 Sukses menarik/memotong koin **Rp ${amountToTake.toLocaleString('id-ID')}** dari dompet <@${selectedTargetUserId}>!`, ephemeral: true });
            const fresh = getAdminPanelData(guildId, selectedTargetUserId, selectedTicker, activeTab);
            await replyMsg.edit(fresh).catch(() => {});
          }
        }
        else if (action === 'action_reset_economy') {
          database.run('UPDATE wallets SET balance = 0, total_earned = 0, total_invested = 0, streak_days = 0 WHERE user_id = ? AND guild_id = ?', [selectedTargetUserId, guildId]);
          database.run('UPDATE bank_savings SET balance = 0 WHERE user_id = ? AND guild_id = ?', [selectedTargetUserId, guildId]);
          database.run('DELETE FROM portfolios WHERE user_id = ? AND guild_id = ?', [selectedTargetUserId, guildId]);
          await iAdmin.reply({ content: `🚨 **RESET TOTAL SUKSES!** Dompet, tabungan bank, dan seluruh lembar saham milik <@${selectedTargetUserId}> telah dikembalikan ke 0.`, ephemeral: true });
          const fresh = getAdminPanelData(guildId, selectedTargetUserId, selectedTicker, activeTab);
          await replyMsg.edit(fresh).catch(() => {});
        }
      }
      // Tab 2 Events
      else if (iAdmin.customId === 'admin_panel_select_gacha') {
        const mode = iAdmin.values[0];
        database.run('UPDATE ebyus_settings SET gacha_mode = ?, updated_at = ?, updated_by = ? WHERE guild_id = ?', [mode, nowUnix, iAdmin.user.id, guildId]);
        await iAdmin.reply({ content: `🎰 Sukses mengubah mode gacha server menjadi **${mode}**!`, ephemeral: true });
        const fresh = getAdminPanelData(guildId, selectedTargetUserId, selectedTicker, activeTab);
        await replyMsg.edit(fresh).catch(() => {});
      }
      else if (iAdmin.customId === 'admin_panel_select_multiplier') {
        const mult = parseInt(iAdmin.values[0]);
        database.run('UPDATE ebyus_settings SET coin_multiplier = ?, updated_at = ?, updated_by = ? WHERE guild_id = ?', [mult, nowUnix, iAdmin.user.id, guildId]);
        await iAdmin.reply({ content: `🪙 Sukses mengubah multiplier koin chat menjadi **${mult}x**!`, ephemeral: true });
        const fresh = getAdminPanelData(guildId, selectedTargetUserId, selectedTicker, activeTab);
        await replyMsg.edit(fresh).catch(() => {});
      }
      else if (iAdmin.customId === 'admin_panel_select_global') {
        const action = iAdmin.values[0];

        if (action === 'global_trigger_bull') {
          const events = require('./events');
          events.triggerEvent(client, guild, events.EVENT_TYPES.BULL_RUN);
          await iAdmin.reply({ content: '📈 Event bursa saham **BULL RUN** berhasil dipicu secara instan!', ephemeral: true });
        }
        else if (action === 'global_trigger_crash') {
          const events = require('./events');
          events.triggerEvent(client, guild, events.EVENT_TYPES.MARKET_CRASH);
          await iAdmin.reply({ content: '📉 Event bursa saham **MARKET CRASH** berhasil dipicu secara instan!', ephemeral: true });
        }
        else if (action === 'global_trigger_double') {
          const events = require('./events');
          events.triggerEvent(client, guild, events.EVENT_TYPES.DOUBLE_EARNINGS);
          await iAdmin.reply({ content: '💰 Event bursa saham **DOUBLE EARNING HOUR** berhasil dipicu secara instan!', ephemeral: true });
        }
        else if (action === 'global_reset_heist_cd') {
          database.run(
            'INSERT INTO heist_cooldown (guild_id, last_heist_at) VALUES (?, 0) ON CONFLICT(guild_id) DO UPDATE SET last_heist_at = 0',
            [guildId]
          );
          await iAdmin.reply({ content: '🚨 Sukses mereset global cooldown Bank Heist server. Warga dapat melakukan perampokan kembali!', ephemeral: true });
        }
        else if (action === 'global_free_all_jail') {
          database.run("UPDATE wallets SET jail_until = 0, jail_type = '' WHERE guild_id = ?", [guildId]);
          await iAdmin.reply({ content: '🔓 Sukses membebaskan seluruh tahanan dari penjara virtual secara massal!', ephemeral: true });
        }
        else if (action === 'global_trigger_dividends') {
          const triggerSuccess = scheduler.triggerDividendsWeekly ? scheduler.triggerDividendsWeekly(client, guildId) : false;
          await iAdmin.reply({ content: `💸 Pembagian Dividen Saham Mingguan berhasil dipicu secara manual!`, ephemeral: true });
        }
        else if (action === 'global_give_all_coins_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_give_all_coins_modal')
            .setTitle('Bagi Koin ke Seluruh Member');

          const amountInput = new TextInputBuilder()
            .setCustomId('coin_amount')
            .setLabel('Jumlah Koin (Rupiah)')
            .setPlaceholder('Contoh: 2000')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
          await iAdmin.showModal(modal);

          const sub = await iAdmin.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_give_all_coins_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const amount = parseInt(sub.fields.getTextInputValue('coin_amount'));
            if (isNaN(amount) || amount <= 0) {
              return sub.reply({ content: '❌ Jumlah harus berupa angka bulat di atas 0!', ephemeral: true });
            }
            
            database.run('UPDATE wallets SET balance = balance + ?, total_earned = total_earned + ? WHERE guild_id = ?', [amount, amount, guildId]);
            
            await sub.reply({ content: `💸 Sukses membagikan koin **Rp ${amount.toLocaleString('id-ID')}** kepada seluruh member terdaftar di server ini!`, ephemeral: true });
          }
        }

        const fresh = getAdminPanelData(guildId, selectedTargetUserId, selectedTicker, activeTab);
        await replyMsg.edit(fresh).catch(() => {});
      }
      // Tab 3 Bursa
      else if (iAdmin.customId === 'admin_panel_select_ticker') {
        selectedTicker = iAdmin.values[0];
        const fresh = getAdminPanelData(guildId, selectedTargetUserId, selectedTicker, activeTab);
        await iAdmin.update(fresh);
      }
      else if (iAdmin.customId === 'admin_panel_select_bursa_action') {
        const action = iAdmin.values[0];
        if (!selectedTicker || selectedTicker === 'KOSONG') {
          return iAdmin.reply({ content: '❌ Silakan pilih ticker saham terlebih dahulu!', ephemeral: true });
        }

        if (action === 'bursa_action_drop_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_bursa_drop_modal')
            .setTitle(`Drop Harga Saham ${selectedTicker}`);

          const pctInput = new TextInputBuilder()
            .setCustomId('drop_percent')
            .setLabel('Persentase Penurunan (1 - 99)')
            .setPlaceholder('Contoh: 15')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(pctInput));
          await iAdmin.showModal(modal);

          const sub = await iAdmin.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_bursa_drop_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const percent = parseInt(sub.fields.getTextInputValue('drop_percent'));
            if (isNaN(percent) || percent < 1 || percent > 99) {
              return sub.reply({ content: '❌ Nilai harus berupa angka bulat antara 1 hingga 99!', ephemeral: true });
            }
            const stock = stocks.getStock(guildId, selectedTicker);
            if (!stock) {
              return sub.reply({ content: '❌ Saham tidak ditemukan!', ephemeral: true });
            }
            const oldPrice = stock.current_price;
            const newPrice = Math.max(config.market.MIN_PRICE, Math.round(oldPrice * (1 - percent / 100)));

            database.transaction(() => {
              database.run(
                'UPDATE stocks SET previous_price = ?, current_price = ? WHERE channel_id = ? AND guild_id = ?',
                [oldPrice, newPrice, stock.channel_id, guildId]
              );
              database.run(
                'INSERT INTO price_history (channel_id, guild_id, price, activity_score) VALUES (?, ?, ?, 0.0)',
                [stock.channel_id, guildId, newPrice]
              );
            })();

            await sub.reply({ content: `📉 Sukses menurunkan harga saham **${selectedTicker}** sebesar **${percent}%** (Lama: Rp ${oldPrice.toLocaleString('id-ID')} -> Baru: Rp ${newPrice.toLocaleString('id-ID')})!`, ephemeral: true });
            const fresh = getAdminPanelData(guildId, selectedTargetUserId, selectedTicker, activeTab);
            await replyMsg.edit(fresh).catch(() => {});
          }
        }
        else if (action === 'bursa_action_remove') {
          const stock = stocks.getStock(guildId, selectedTicker);
          if (!stock) {
            return iAdmin.reply({ content: '❌ Saham tidak ditemukan!', ephemeral: true });
          }
          database.transaction(() => {
            database.run('DELETE FROM stocks WHERE stock_ticker = ? AND guild_id = ?', [selectedTicker, guildId]);
            database.run('DELETE FROM portfolios WHERE channel_id = ? AND guild_id = ?', [stock.channel_id, guildId]);
          })();
          selectedTicker = null;
          await iAdmin.reply({ content: `❌ Sukses menghapus instrumen saham **${stock.stock_ticker}** dari bursa server.`, ephemeral: true });
          const fresh = getAdminPanelData(guildId, selectedTargetUserId, selectedTicker, activeTab);
          await replyMsg.edit(fresh).catch(() => {});
        }
      }
      else if (iAdmin.customId === 'admin_panel_select_bursa_global') {
        const action = iAdmin.values[0];

        if (action === 'bursa_global_add_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_bursa_add_modal')
            .setTitle('Daftarkan Saham Baru');

          const channelInput = new TextInputBuilder()
            .setCustomId('channel_id')
            .setLabel('ID Text Channel')
            .setPlaceholder('Masukkan ID channel (Contoh: 1503324994153873458)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const tickerInput = new TextInputBuilder()
            .setCustomId('ticker_name')
            .setLabel('Ticker Saham (Mulai dengan $)')
            .setPlaceholder('Contoh: $LOUNGE')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(channelInput),
            new ActionRowBuilder().addComponents(tickerInput)
          );
          await iAdmin.showModal(modal);

          const sub = await iAdmin.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_bursa_add_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const chId = sub.fields.getTextInputValue('channel_id').trim();
            let tickName = sub.fields.getTextInputValue('ticker_name').trim().toUpperCase();
            if (!tickName.startsWith('$')) {
              tickName = '$' + tickName;
            }

            const channelObj = guild.channels.cache.get(chId);
            if (!channelObj) {
              return sub.reply({ content: '❌ Text channel dengan ID tersebut tidak ditemukan di server ini!', ephemeral: true });
            }

            const existing = database.get('SELECT * FROM stocks WHERE (stock_ticker = ? OR channel_id = ?) AND guild_id = ?', [tickName, chId, guildId]);
            if (existing) {
              return sub.reply({ content: '❌ Ticker saham atau ID channel tersebut sudah terdaftar di bursa!', ephemeral: true });
            }

            database.run(
              'INSERT INTO stocks (guild_id, channel_id, stock_name, stock_ticker, current_price, previous_price, available_shares) VALUES (?, ?, ?, ?, 100, 100, 500)',
              [guildId, chId, channelObj.name, tickName]
            );

            await sub.reply({ content: `✅ Sukses mendaftarkan channel <#${chId}> sebagai saham **${tickName}** di bursa!`, ephemeral: true });
            const fresh = getAdminPanelData(guildId, selectedTargetUserId, selectedTicker, activeTab);
            await replyMsg.edit(fresh).catch(() => {});
          }
        }
        else if (action === 'bursa_global_reinit') {
          database.transaction(() => {
            database.run('DELETE FROM stocks WHERE guild_id = ?', [guildId]);
            database.run('DELETE FROM portfolios WHERE guild_id = ?', [guildId]);
            
            const defaults = [
              { name: 'general', ticker: '$GENERAL', price: 100 },
              { name: 'lounge', ticker: '$LOUNGE', price: 100 },
              { name: 'bot-spam', ticker: '$SPAM', price: 100 }
            ];

            defaults.forEach(d => {
              const ch = guild.channels.cache.find(c => c.name === d.name && c.isTextBased());
              if (ch) {
                database.run(
                  'INSERT INTO stocks (guild_id, channel_id, stock_name, stock_ticker, current_price, previous_price, available_shares) VALUES (?, ?, ?, ?, ?, ?, 500)',
                  [guildId, ch.id, d.name, d.ticker, d.price, d.price]
                );
              }
            });
          })();
          await iAdmin.reply({ content: '🔄 Sukses mereset total seluruh instrumen bursa saham server kembali ke setelan default.', ephemeral: true });
          const fresh = getAdminPanelData(guildId, selectedTargetUserId, selectedTicker, activeTab);
          await replyMsg.edit(fresh).catch(() => {});
        }
      }
      // Tab 4 Shop & ToD
      else if (iAdmin.customId === 'admin_panel_select_shop_action') {
        const action = iAdmin.values[0];

        if (action === 'shop_action_add_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_shop_add_modal')
            .setTitle('Jual Role Baru di Toko');

          const roleInput = new TextInputBuilder()
            .setCustomId('role_id')
            .setLabel('ID Role Discord')
            .setPlaceholder('Masukkan ID role (Contoh: 1503324994153873458)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const priceInput = new TextInputBuilder()
            .setCustomId('role_price')
            .setLabel('Harga Jual (Koin Rupiah)')
            .setPlaceholder('Contoh: 150000')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const tierInput = new TextInputBuilder()
            .setCustomId('role_tier')
            .setLabel('Tier Rarity (COMMON/RARE/EPIC/LEGENDARY)')
            .setPlaceholder('Masukkan tier (Contoh: EPIC)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(roleInput),
            new ActionRowBuilder().addComponents(priceInput),
            new ActionRowBuilder().addComponents(tierInput)
          );
          await iAdmin.showModal(modal);

          const sub = await iAdmin.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_shop_add_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const rId = sub.fields.getTextInputValue('role_id').trim();
            const price = parseInt(sub.fields.getTextInputValue('role_price'));
            const tier = sub.fields.getTextInputValue('role_tier').trim().toUpperCase();

            if (isNaN(price) || price <= 0) {
              return sub.reply({ content: '❌ Harga harus berupa angka di atas 0!', ephemeral: true });
            }

            const roleObj = guild.roles.cache.get(rId);
            if (!roleObj) {
              return sub.reply({ content: '❌ Role dengan ID tersebut tidak ditemukan di server!', ephemeral: true });
            }

            database.run(
              'INSERT INTO shop_items (guild_id, role_id, role_name, price, tier, stock, description) VALUES (?, ?, ?, ?, ?, -1, ?)',
              [guildId, rId, roleObj.name, price, tier, `Koleksi kasta role ${tier} eksklusif.`]
            );

            await sub.reply({ content: `✅ Sukses menjual role <@&${rId}> seharga **Rp ${price.toLocaleString('id-ID')}** di etalase Toko!`, ephemeral: true });
            const fresh = getAdminPanelData(guildId, selectedTargetUserId, selectedTicker, activeTab);
            await replyMsg.edit(fresh).catch(() => {});
          }
        }
        else if (action === 'shop_action_remove_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_shop_remove_modal')
            .setTitle('Hapus Role dari Toko');

          const roleInput = new TextInputBuilder()
            .setCustomId('role_id')
            .setLabel('ID Role Discord')
            .setPlaceholder('Masukkan ID role terdaftar')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(roleInput));
          await iAdmin.showModal(modal);

          const sub = await iAdmin.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_shop_remove_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const rId = sub.fields.getTextInputValue('role_id').trim();
            database.run('DELETE FROM shop_items WHERE role_id = ? AND guild_id = ?', [rId, guildId]);
            
            await sub.reply({ content: `❌ Sukses menghapus role ID \`${rId}\` dari etalase toko.`, ephemeral: true });
            const fresh = getAdminPanelData(guildId, selectedTargetUserId, selectedTicker, activeTab);
            await replyMsg.edit(fresh).catch(() => {});
          }
        }
        else if (action === 'shop_action_stock_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_shop_stock_modal')
            .setTitle('Ubah Stok Role Toko');

          const roleInput = new TextInputBuilder()
            .setCustomId('role_id')
            .setLabel('ID Role Discord')
            .setPlaceholder('Masukkan ID role')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const stockInput = new TextInputBuilder()
            .setCustomId('role_stock')
            .setLabel('Jumlah Slot Stok (-1 untuk Unlimited)')
            .setPlaceholder('Contoh: 10')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(roleInput),
            new ActionRowBuilder().addComponents(stockInput)
          );
          await iAdmin.showModal(modal);

          const sub = await iAdmin.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_shop_stock_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const rId = sub.fields.getTextInputValue('role_id').trim();
            const stock = parseInt(sub.fields.getTextInputValue('role_stock'));

            if (isNaN(stock) || stock < -1) {
              return sub.reply({ content: '❌ Stok tidak valid!', ephemeral: true });
            }

            database.run('UPDATE shop_items SET stock = ? WHERE role_id = ? AND guild_id = ?', [stock, rId, guildId]);

            await sub.reply({ content: `✅ Sukses memperbarui stok role ID \`${rId}\` menjadi **${stock === -1 ? 'Unlimited' : stock + ' slot'}**!`, ephemeral: true });
            const fresh = getAdminPanelData(guildId, selectedTargetUserId, selectedTicker, activeTab);
            await replyMsg.edit(fresh).catch(() => {});
          }
        }
        else if (action === 'shop_action_auto') {
          const defaultRoles = [
            { name: 'Mythic Resident', color: '#FF007F', price: 1500000, tier: 'MYTHIC', desc: 'Kasta legendaris tertinggi di server.' },
            { name: 'Legendary Resident', color: '#FFD700', price: 500000, tier: 'LEGENDARY', desc: 'Pemukim legendaris berwibawa tinggi.' },
            { name: 'Epic Resident', color: '#9D00FF', price: 150000, tier: 'EPIC', desc: 'Warga elit yang disegani oleh publik.' },
            { name: 'Rare Resident', color: '#00BFFF', price: 50000, tier: 'RARE', desc: 'Warga kelas menengah yang aktif.' },
            { name: 'Common Resident', color: '#00FF88', price: 15000, tier: 'COMMON', desc: 'Anggota pemukiman resmi pemegang KTP.' }
          ];
          
          let createdCount = 0;
          for (const rData of defaultRoles) {
            const existing = database.get('SELECT * FROM shop_items WHERE role_name = ? AND guild_id = ?', [rData.name, guildId]);
            if (!existing) {
              const newRole = await guild.roles.create({
                name: rData.name,
                color: rData.color,
                reason: 'Sentinel Auto Shop Role Initialization'
              }).catch(() => null);
              
              if (newRole) {
                database.run(
                  'INSERT INTO shop_items (guild_id, role_id, role_name, price, tier, stock, description) VALUES (?, ?, ?, ?, ?, -1, ?)',
                  [guildId, newRole.id, rData.name, rData.price, rData.tier, rData.desc]
                );
                createdCount++;
              }
            }
          }
          await iAdmin.reply({ content: `🎭 Sukses menginisialisasi Toko Role. Berhasil mendaftarkan & membuat **${createdCount}/5** kasta role prestise server!`, ephemeral: true });
          const fresh = getAdminPanelData(guildId, selectedTargetUserId, selectedTicker, activeTab);
          await replyMsg.edit(fresh).catch(() => {});
        }
      }
      else if (iAdmin.customId === 'admin_panel_select_tod_action') {
        const action = iAdmin.values[0];

        if (action === 'tod_action_announce') {
          const todAnnounceEmb = embeds.todAnnounceEmbed ? embeds.todAnnounceEmbed(guild) : new EmbedBuilder().setTitle('🎲 TRUTH OR DARE GAME').setDescription('Game Truth or Dare telah diluncurkan di Voice Channel!');
          await message.channel.send({ content: '@everyone 🎲 **GAME TRUTH OR DARE AKTIF!** 🎲', embeds: [todAnnounceEmb] });
          await iAdmin.reply({ content: '📢 Sukses menyiarkan template pengumuman ToD ke channel ini!', ephemeral: true });
        }
        else if (action === 'tod_action_stop') {
          try {
            const voiceEvents = require('../voice_events');
            if (voiceEvents.forceStopTodGame) {
              voiceEvents.forceStopTodGame(guildId);
            } else {
              const audio = require('../voice_events/audio');
              if (audio.clearVoiceConnection) {
                audio.clearVoiceConnection(guildId);
              }
            }
          } catch (e) {}
          await iAdmin.reply({ content: '🛑 Sukses menghentikan paksa sesi aktif game ToD di Voice Channel.', ephemeral: true });
        }
        else if (action === 'tod_action_add_question_modal') {
          const modal = new ModalBuilder()
            .setCustomId('admin_tod_add_modal')
            .setTitle('Tambah Pertanyaan ToD');

          const typeInput = new TextInputBuilder()
            .setCustomId('question_type')
            .setLabel('Tipe (TRUTH / DARE)')
            .setPlaceholder('Contoh: truth')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const categoryInput = new TextInputBuilder()
            .setCustomId('question_cat')
            .setLabel('Kategori (CHILL / DEEP / SPICY)')
            .setPlaceholder('Contoh: chill')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const textInput = new TextInputBuilder()
            .setCustomId('question_text')
            .setLabel('Pertanyaan / Tantangan')
            .setPlaceholder('Masukkan pertanyaan/tantangan...')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(typeInput),
            new ActionRowBuilder().addComponents(categoryInput),
            new ActionRowBuilder().addComponents(textInput)
          );
          await iAdmin.showModal(modal);

          const sub = await iAdmin.awaitModalSubmit({
            filter: (s) => s.customId === 'admin_tod_add_modal' && s.user.id === author.id,
            time: 60000
          }).catch(() => null);

          if (sub) {
            const qType = sub.fields.getTextInputValue('question_type').trim().toLowerCase();
            const qCat = sub.fields.getTextInputValue('question_cat').trim().toLowerCase();
            const qText = sub.fields.getTextInputValue('question_text').trim();

            if (!['truth', 'dare'].includes(qType) || !['chill', 'deep', 'spicy'].includes(qCat)) {
              return sub.reply({ content: '❌ Tipe atau Kategori tidak valid! Pilihan tipe: truth/dare. Pilihan kategori: chill/deep/spicy.', ephemeral: true });
            }

            database.run(
              'INSERT INTO tod_questions (type, category, question_text, created_by) VALUES (?, ?, ?, ?)',
              [qType, qCat, qText, author.id]
            );

            await sub.reply({ content: `✅ Sukses menambahkan pertanyaan **${qType}** (${qCat}) ke database!`, ephemeral: true });
          }
        }
      }
      // Tab 2 Event Buttons
      else if (iAdmin.customId === 'admin_panel_btn_broadcast') {
        const settings = getOrCreateEbyusSettings(guildId);
        const broadcastEmb = embeds.ebyusBroadcastEmbed(guild, settings.gacha_mode, settings.coin_multiplier, settings.expires_at);
        
        let targetChannel = guild.channels.cache.get('1422642326798598348');
        if (!targetChannel) {
          try {
            targetChannel = await guild.channels.fetch('1422642326798598348');
          } catch (e) {
            targetChannel = message.channel;
          }
        }

        if (targetChannel) {
          await targetChannel.send({ content: '@everyone 🚨 **EVENT ABUSE AKTIF!** 🚨', embeds: [broadcastEmb] });
          await iAdmin.reply({ content: `✅ Sukses menyiarkan pengumuman Ebyus ke channel <#${targetChannel.id}>!`, ephemeral: true });
        } else {
          await iAdmin.reply({ content: '❌ Gagal menemukan channel untuk menyiarkan pengumuman!', ephemeral: true });
        }
      }
      else if (iAdmin.customId === 'admin_panel_btn_duration') {
        const modal = new ModalBuilder()
          .setCustomId('admin_ebyus_duration_modal')
          .setTitle('Atur Durasi Event Bypass');

        const durInput = new TextInputBuilder()
          .setCustomId('dur_minutes')
          .setLabel('Durasi Event (dalam Menit)')
          .setPlaceholder('Masukkan angka menit (Contoh: 20)')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(durInput));
        await iAdmin.showModal(modal);

        const sub = await iAdmin.awaitModalSubmit({
          filter: (s) => s.customId === 'admin_ebyus_duration_modal' && s.user.id === author.id,
          time: 60000
        }).catch(() => null);

        if (sub) {
          const minutes = parseInt(sub.fields.getTextInputValue('dur_minutes'));
          if (isNaN(minutes) || minutes < 0) {
            return sub.reply({ content: '❌ Durasi harus berupa angka di atas 0!', ephemeral: true });
          }
          const expiresAt = minutes > 0 ? nowUnix + minutes * 60 : 0;
          database.run('UPDATE ebyus_settings SET expires_at = ?, updated_at = ?, updated_by = ? WHERE guild_id = ?', [expiresAt, nowUnix, iAdmin.user.id, guildId]);
          
          await sub.reply({ content: `⏱️ Sukses memperbarui durasi event bypass menjadi **${minutes} menit** (auto-reset).`, ephemeral: true });
          const fresh = getAdminPanelData(guildId, selectedTargetUserId, selectedTicker, activeTab);
          await replyMsg.edit(fresh).catch(() => {});
        }
      }
      else if (iAdmin.customId === 'admin_panel_btn_stop_abyus') {
        database.run(
          'UPDATE ebyus_settings SET gacha_mode = ?, coin_multiplier = ?, expires_at = 0, updated_at = ?, updated_by = ? WHERE guild_id = ?',
          ['NORMAL', 1, nowUnix, iAdmin.user.id, guildId]
        );
        await iAdmin.reply({ content: '🛑 **Sukses menghentikan seluruh Event Abuse!** Mode gacha direset ke `NORMAL` dan multiplier koin chat kembali ke `1x` (nonaktif).', ephemeral: true });
        const fresh = getAdminPanelData(guildId, selectedTargetUserId, selectedTicker, activeTab);
        await replyMsg.edit(fresh).catch(() => {});
      }
      else if (iAdmin.customId === 'admin_panel_btn_status') {
        const settings = getOrCreateEbyusSettings(guildId);
        const statusEmb = embeds.ebyusStatusEmbed(guild, settings);
        await iAdmin.reply({ embeds: [statusEmb], ephemeral: true });
      }
      else if (iAdmin.customId === 'admin_panel_btn_close') {
        collector.stop();
        await replyMsg.delete().catch(() => {});
      }
    } catch (err) {
      console.error('Error in admin panel dashboard interaction:', err);
      await iAdmin.reply({ content: `❌ Terjadi kesalahan: ${err.message}`, ephemeral: true }).catch(() => {});
    }
  });

  collector.on('end', async () => {
    if (collector.destroyed) return;
    try {
      const fresh = getAdminPanelData(guildId, selectedTargetUserId, selectedTicker, activeTab);
      fresh.components = [];
      await replyMsg.edit(fresh).catch(() => {});
    } catch (e) {}
  });

  return true;
}

module.exports = {
  handleAdminPanel
};
