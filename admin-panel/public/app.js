document.addEventListener('DOMContentLoaded', () => {
  // --- State Variables ---
  let usersData = [];
  let availableAssets = [];
  let currentCategory = 'coin';
  let activeStocks = [];
  let activeAuctions = [];
  let activeBackups = [];

  // --- Element Selectors ---
  // Auth Screen elements
  const authOverlay = document.getElementById('auth-overlay');
  const authPasscode = document.getElementById('auth-passcode');
  const authLoginBtn = document.getElementById('auth-login-btn');

  // Navigation tabs
  const menuItems = {
    dash: document.getElementById('menu-dash'),
    users: document.getElementById('menu-users'),
    pet: document.getElementById('menu-pet'),
    economy: document.getElementById('menu-economy'),
    stocks: document.getElementById('menu-stocks'),
    auctions: document.getElementById('menu-auctions'),
    logs: document.getElementById('menu-logs')
  };

  const sections = {
    dash: document.getElementById('section-dashboard'),
    users: document.getElementById('section-users'),
    pet: document.getElementById('section-pet'),
    economy: document.getElementById('section-economy'),
    stocks: document.getElementById('section-stocks'),
    auctions: document.getElementById('section-auctions'),
    logs: document.getElementById('section-logs')
  };

  // Dashboard elements
  const statWallets = document.getElementById('stat-wallets');
  const statCoins = document.getElementById('stat-coins');
  const statPets = document.getElementById('stat-pets');
  const statEvent = document.getElementById('stat-event');
  const cfgGacha = document.getElementById('abyus-gacha-mode');
  const cfgMult = document.getElementById('abyus-coin-multiplier');
  const cfgActive = document.getElementById('abyus-event-active');
  const cfgGodMode = document.getElementById('abyus-god-mode');
  const saveAbyusBtn = document.getElementById('save-abyus-btn');

  // Member Grid elements
  const membersList = document.getElementById('members-list');
  const memberSearch = document.getElementById('member-search');

  // Pet Tamagotchi elements
  const petOwnerSelector = document.getElementById('pet-owner-selector');
  const petDisplayCard = document.getElementById('pet-display-card');
  const petActionsCard = document.getElementById('pet-actions-card');
  
  const petDisplayName = document.getElementById('pet-display-name');
  const petDisplayStars = document.getElementById('pet-display-stars');
  const petValHp = document.getElementById('pet-val-hp');
  const petValHunger = document.getElementById('pet-val-hunger');
  const petValThirst = document.getElementById('pet-val-thirst');
  const petValHappy = document.getElementById('pet-val-happy');
  const petValTrait = document.getElementById('pet-val-trait');
  const petValFloor = document.getElementById('pet-val-floor');
  const petValAutofeed = document.getElementById('pet-val-autofeed');
  const petValStatus = document.getElementById('pet-val-status');

  // Pet Action buttons
  const petActHeal = document.getElementById('pet-act-heal');
  const petActRevive = document.getElementById('pet-act-revive');
  const petActHatch = document.getElementById('pet-act-hatch');
  const petActResetCooldown = document.getElementById('pet-act-reset-cooldown');
  const petActToggleAutofeed = document.getElementById('pet-act-toggle-autofeed');
  const petActDelete = document.getElementById('pet-act-delete');

  // Pet mod forms
  const petSetLevel = document.getElementById('pet-set-level');
  const petSaveLevelBtn = document.getElementById('pet-save-level-btn');
  const petSetTrait = document.getElementById('pet-set-trait');
  const petSaveTraitBtn = document.getElementById('pet-save-trait-btn');
  const petSetStar = document.getElementById('pet-set-star');
  const petSaveStarBtn = document.getElementById('pet-save-star-btn');
  const petSetFloor = document.getElementById('pet-set-floor');
  const petSaveFloorBtn = document.getElementById('pet-save-floor-btn');

  // Custom pet spawn form
  const custPetName = document.getElementById('cust-pet-name');
  const custPetType = document.getElementById('cust-pet-type');
  const custPetLevel = document.getElementById('cust-pet-level');
  const custPetStar = document.getElementById('cust-pet-star');
  const giveCustomPetBtn = document.getElementById('give-custom-pet-btn');

  // Economy elements
  const ecoTotalWallets = document.getElementById('eco-total-wallets');
  const ecoTotalSavings = document.getElementById('eco-total-savings');
  const ecoActiveRatio = document.getElementById('eco-active-ratio');
  const bansosAmount = document.getElementById('bansos-amount');
  const payoutBansosBtn = document.getElementById('payout-bansos-btn');
  const resetEconomyBtn = document.getElementById('reset-economy-btn');

  // Stock Market elements
  const stocksList = document.getElementById('stocks-list');
  const newStockTicker = document.getElementById('new-stock-ticker');
  const newStockName = document.getElementById('new-stock-name');
  const newStockPrice = document.getElementById('new-stock-price');
  const newStockChannel = document.getElementById('new-stock-channel');
  const addStockBtn = document.getElementById('add-stock-btn');

  // Auction House elements
  const auctionsList = document.getElementById('auctions-list');
  const aucItemId = document.getElementById('auc-item-id');
  const aucQty = document.getElementById('auc-qty');
  const aucMinBid = document.getElementById('auc-min-bid');
  const aucHours = document.getElementById('auc-hours');
  const hostAuctionBtn = document.getElementById('host-auction-btn');

  // Logs & backups
  const logsList = document.getElementById('logs-list');
  const refreshLogsBtn = document.getElementById('refresh-logs-btn');
  const dbBackupsSelector = document.getElementById('db-backups-selector');
  const restoreDbBtn = document.getElementById('restore-db-btn');
  const backupDbBtn = document.getElementById('backup-db-btn');

  // Modal elements
  const giveModal = document.getElementById('give-modal');
  const closeBtn = document.getElementById('close-modal-btn');
  const cancelBtn = document.getElementById('cancel-modal-btn');
  const submitBtn = document.getElementById('submit-give-btn');
  const targetUserInp = document.getElementById('give-target-user');
  const categoryCards = document.querySelectorAll('.category-card');
  const itemSelectGroup = document.getElementById('item-select-group');
  const itemSelector = document.getElementById('give-item-selector');
  const amountInp = document.getElementById('give-amount');
  const coinPresets = document.getElementById('coin-presets');
  const itemPresets = document.getElementById('item-presets');

  // Citizen quick actions inside Modal
  const citActBlacklist = document.getElementById('cit-act-blacklist');
  const citActCooldowns = document.getElementById('cit-act-cooldowns');
  const citActRelease = document.getElementById('cit-act-release');
  const citJailDuration = document.getElementById('cit-jail-duration');
  const citActJail = document.getElementById('cit-act-jail');

  // Toast Container
  const toastBox = document.getElementById('toast-box');

  // --- Toast Alert Helper ---
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    toastBox.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) reverse';
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3000);
  }

  // --- Formatting Helpers ---
  function formatCurrency(amount) {
    return 'Rp ' + amount.toLocaleString('id-ID');
  }

  function formatDate(isoString) {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleDateString('id-ID') + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  }

  // --- Secure Fetch Wrapper ---
  async function secureFetch(url, options = {}) {
    const token = localStorage.getItem('admin_token') || '';
    if (!options.headers) {
      options.headers = {};
    }
    options.headers['X-Admin-Token'] = token;

    const response = await fetch(url, options);
    if (response.status === 401) {
      localStorage.removeItem('admin_token');
      authOverlay.classList.remove('hidden');
      showToast('Sesi ditolak! Harap masukkan kode akses admin yang valid.', 'error');
      throw new Error('Unauthorized');
    }
    return response;
  }

  // --- Tab Switcher ---
  function switchTab(activeTabId) {
    // Stop if not authenticated
    if (!localStorage.getItem('admin_token')) return;

    Object.keys(menuItems).forEach(key => {
      menuItems[key].classList.remove('active');
      sections[key].classList.remove('active');
    });

    menuItems[activeTabId].classList.add('active');
    sections[activeTabId].classList.add('active');

    // Trigger API calls depending on selected Tab
    if (activeTabId === 'dash') {
      fetchDashboardStats();
    } else if (activeTabId === 'users') {
      fetchUsers();
    } else if (activeTabId === 'pet') {
      fetchUsersForPetDropdown();
    } else if (activeTabId === 'economy') {
      fetchDetailedStats();
    } else if (activeTabId === 'stocks') {
      fetchDetailedStats();
    } else if (activeTabId === 'auctions') {
      fetchDetailedStats();
    } else if (activeTabId === 'logs') {
      fetchLogs();
      fetchDetailedStats(); // Loads backups selector
    }
  }

  // Set up navigation click event listeners
  Object.keys(menuItems).forEach(key => {
    menuItems[key].addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(key);
      window.location.hash = key;
    });
  });

  // --- API Fetching Functions ---
  async function fetchDashboardStats() {
    try {
      const res = await secureFetch('/api/stats');
      const data = await res.json();
      if (data.success) {
        statWallets.textContent = data.walletsCount.toLocaleString('id-ID');
        statCoins.textContent = formatCurrency(data.totalCoins);
        statPets.textContent = data.activePetsCount.toLocaleString('id-ID');
        
        const isAbyusActive = data.settings.is_active === 1;
        statEvent.textContent = isAbyusActive ? 'AKTIF 🚀' : 'Nonaktif';
        statEvent.className = isAbyusActive ? 'emerald-text' : 'muted-text';
        
        // Populate inputs in config details
        cfgGacha.value = data.settings.gacha_mode || 'NORMAL';
        cfgMult.value = data.settings.coin_multiplier || 1;
        cfgActive.value = data.settings.is_active === 1 ? '1' : '0';
        cfgGodMode.value = data.settings.owner_god_mode === 1 ? '1' : '0';
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') showToast('Koneksi server terputus', 'error');
    }
  }

  async function fetchUsers() {
    try {
      const res = await secureFetch('/api/users');
      const data = await res.json();
      if (data.success) {
        usersData = data.users;
        renderUsersTable();
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') showToast('Gagal memuat list warga', 'error');
    }
  }

  async function fetchDetailedStats() {
    try {
      const res = await secureFetch('/api/admin/detailed-stats');
      const data = await res.json();
      if (data.success) {
        // Detailed Finansial
        ecoTotalWallets.textContent = formatCurrency(data.totalCirculation);
        ecoTotalSavings.textContent = formatCurrency(data.bankSavings);
        const total = data.activeWallets + data.inactiveWallets;
        const ratio = total > 0 ? Math.round((data.activeWallets / total) * 100) : 0;
        ecoActiveRatio.textContent = ratio + '%';

        // Stocks
        activeStocks = data.stocks;
        renderStocksTable();

        // Auctions
        activeAuctions = data.auctions;
        renderAuctionsTable();

        // Backups Selector
        activeBackups = data.backups;
        populateBackupsSelector();
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchLogs() {
    try {
      const res = await secureFetch('/api/logs');
      const data = await res.json();
      if (data.success) {
        logsList.innerHTML = '';
        if (data.logs.length === 0) {
          logsList.innerHTML = '<li style="border-left-color: var(--color-text-muted);">Belum ada riwayat aktivitas log.</li>';
        } else {
          data.logs.forEach(log => {
            const li = document.createElement('li');
            li.textContent = log;
            if (log.includes('Gave') || log.includes('Bansos')) {
              li.style.borderLeftColor = 'var(--color-emerald)';
            } else if (log.includes('Backup') || log.includes('Restored')) {
              li.style.borderLeftColor = 'var(--color-gold)';
            } else if (log.includes('Blacklisted') || log.includes('Jailed')) {
              li.style.borderLeftColor = 'var(--color-red)';
            } else {
              li.style.borderLeftColor = 'var(--color-primary)';
            }
            logsList.appendChild(li);
          });
        }
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') showToast('Gagal memuat logs', 'error');
    }
  }

  async function fetchAssets() {
    try {
      const res = await secureFetch('/api/assets');
      const data = await res.json();
      if (data.success) {
        availableAssets = data.items;
      }
    } catch (err) {
      console.error(err);
    }
  }

  // --- Sub-Panel 1: Save Abyus Settings ---
  saveAbyusBtn.addEventListener('click', async () => {
    saveAbyusBtn.disabled = true;
    try {
      const response = await secureFetch('/api/admin/abyus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gachaMode: cfgGacha.value,
          coinMultiplier: parseInt(cfgMult.value, 10),
          isActive: parseInt(cfgActive.value, 10),
          ownerGodMode: parseInt(cfgGodMode.value, 10)
        })
      });
      const data = await response.json();
      if (data.success) {
        showToast(data.message || 'Konfigurasi berhasil disimpan!', 'success');
        fetchDashboardStats();
      } else {
        showToast(data.message, 'error');
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') showToast('Koneksi server gagal saat menyimpan', 'error');
    } finally {
      saveAbyusBtn.disabled = false;
    }
  });

  // --- Sub-Panel 2: Users Grid & Citizen Actions ---
  function renderUsersTable() {
    membersList.innerHTML = '';
    const query = memberSearch.value.trim().toLowerCase();
    const filteredUsers = usersData.filter(user => user.user_id.toLowerCase().includes(query));

    if (filteredUsers.length === 0) {
      membersList.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--color-text-muted);">Tidak ada warga ditemukan.</td></tr>`;
      return;
    }

    filteredUsers.forEach(user => {
      const totalWealth = user.wallet_balance + user.bank_balance;
      const tr = document.createElement('tr');
      const blBadge = user.is_blacklisted > 0 ? '<span class="badge badge-red">BLACKLISTED</span>' : '<span class="badge badge-muted">AMAN</span>';

      tr.innerHTML = `
        <td style="font-weight: 500; font-family: monospace;">${user.user_id}</td>
        <td>${formatCurrency(user.wallet_balance)}</td>
        <td>${formatCurrency(user.bank_balance)}</td>
        <td style="font-weight: 600; color: var(--color-text-light);">${formatCurrency(totalWealth)}</td>
        <td style="color: var(--color-text-muted); font-size: 13px;">${formatDate(user.last_active_date)}</td>
        <td>${blBadge}</td>
        <td>
          <button class="btn btn-primary btn-give btn-sm" data-userid="${user.user_id}">⚙️ Kelola Aset & Warga</button>
        </td>
      `;

      tr.querySelector('.btn-give').addEventListener('click', () => {
        targetUserInp.value = user.user_id;
        giveModal.classList.add('active');
        setGiveCategory('coin');
      });

      membersList.appendChild(tr);
    });
  }

  memberSearch.addEventListener('input', renderUsersTable);

  // Bind citizen controls inside modal
  const executeCitizenAction = async (action, additionalData = {}) => {
    const userId = targetUserInp.value;
    try {
      const res = await secureFetch('/api/admin/citizen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action, ...additionalData })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        giveModal.classList.remove('active');
        fetchUsers();
      } else {
        showToast(data.message, 'error');
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') showToast('Koneksi server gagal', 'error');
    }
  };

  citActBlacklist.addEventListener('click', (e) => { e.preventDefault(); executeCitizenAction('blacklist'); });
  citActCooldowns.addEventListener('click', (e) => { e.preventDefault(); executeCitizenAction('reset_cooldowns'); });
  citActRelease.addEventListener('click', (e) => { e.preventDefault(); executeCitizenAction('release'); });
  citActJail.addEventListener('click', (e) => {
    e.preventDefault();
    const duration = parseInt(citJailDuration.value, 10);
    executeCitizenAction('jail', { duration });
  });

  // --- Sub-Panel 3: Pet Tamagotchi Center ---
  async function fetchUsersForPetDropdown() {
    try {
      const res = await secureFetch('/api/users');
      const data = await res.json();
      if (data.success) {
        petOwnerSelector.innerHTML = '<option value="">-- Pilih Warga --</option>';
        data.users.forEach(user => {
          const opt = document.createElement('option');
          opt.value = user.user_id;
          opt.textContent = `Warga: ${user.user_id}`;
          petOwnerSelector.appendChild(opt);
        });
      }
    } catch (err) {
      console.error(err);
    }
  }

  petOwnerSelector.addEventListener('change', async () => {
    const userId = petOwnerSelector.value;
    if (!userId) {
      petDisplayCard.style.display = 'none';
      petActionsCard.style.display = 'none';
      return;
    }
    fetchAndDisplayPet(userId);
  });

  async function fetchAndDisplayPet(userId) {
    try {
      const res = await secureFetch(`/api/admin/pet?userId=${userId}`);
      const data = await res.json();
      if (data.success && data.pet) {
        const pet = data.pet;
        petDisplayName.textContent = `🐾 ${pet.pet_name} (Lv. ${pet.level} ${pet.pet_type})`;
        petDisplayStars.textContent = '⭐'.repeat(pet.star_level || 1);
        petValHp.textContent = `${pet.health} HP`;
        petValHunger.textContent = `${pet.hunger}%`;
        petValThirst.textContent = `${pet.thirst}%`;
        petValHappy.textContent = `${pet.happiness}%`;
        petValTrait.textContent = pet.trait || 'Tidak Ada Trait';
        petValFloor.textContent = `Lantai ${data.tower.current_floor || 1} (Max: ${data.tower.max_floor || 1})`;
        petValAutofeed.textContent = pet.auto_feed === 2 ? '👑 VIP (Aktif)' : '❌ Nonaktif';
        petValStatus.textContent = pet.status;
        petValStatus.className = `badge ${pet.status === 'DEAD' ? 'badge-red' : 'badge-emerald'}`;

        // Populate update forms
        petSetLevel.value = pet.level;
        petSetTrait.value = pet.trait || '';
        petSetStar.value = pet.star_level;
        petSetFloor.value = data.tower.current_floor || 1;

        petDisplayCard.style.display = 'block';
        petActionsCard.style.display = 'block';
      } else {
        petDisplayName.textContent = 'Pet tidak ditemukan';
        petDisplayCard.style.display = 'block';
        petActionsCard.style.display = 'block';
        
        // Hide stats & specific actions
        petValHp.textContent = '-';
        petValHunger.textContent = '-';
        petValThirst.textContent = '-';
        petValHappy.textContent = '-';
        petValTrait.textContent = '-';
        petValFloor.textContent = '-';
        petValAutofeed.textContent = '-';
        petValStatus.textContent = 'TIADA';
        petValStatus.className = 'badge badge-muted';
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') showToast('Gagal memuat info pet', 'error');
    }
  }

  const executePetAction = async (action, valObject = {}) => {
    const userId = petOwnerSelector.value;
    if (!userId) return;
    try {
      const response = await secureFetch('/api/admin/pet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action, ...valObject })
      });
      const data = await response.json();
      if (data.success) {
        showToast(data.message, 'success');
        fetchAndDisplayPet(userId);
      } else {
        showToast(data.message, 'error');
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') showToast('Koneksi server gagal', 'error');
    }
  };

  petActHeal.addEventListener('click', () => executePetAction('heal'));
  petActRevive.addEventListener('click', () => executePetAction('revive'));
  petActHatch.addEventListener('click', () => executePetAction('hatch'));
  petActResetCooldown.addEventListener('click', () => executePetAction('reset_cooldown'));
  petActToggleAutofeed.addEventListener('click', () => executePetAction('toggle_autofeed'));
  petActDelete.addEventListener('click', () => {
    if (confirm('Apakah Anda yakin ingin menghapus pet ini secara permanen dari database?')) {
      executePetAction('delete');
    }
  });

  // Save changes buttons
  petSaveLevelBtn.addEventListener('click', () => executePetAction('level', { level: parseInt(petSetLevel.value, 10) }));
  petSaveTraitBtn.addEventListener('click', () => executePetAction('trait', { trait: petSetTrait.value }));
  petSaveStarBtn.addEventListener('click', () => executePetAction('star', { star: parseInt(petSetStar.value, 10) }));
  petSaveFloorBtn.addEventListener('click', () => executePetAction('floor', { floor: parseInt(petSetFloor.value, 10) }));

  // Spawn new custom pet form
  giveCustomPetBtn.addEventListener('click', async () => {
    const userId = petOwnerSelector.value;
    if (!userId) {
      showToast('Harap pilih warga terlebih dahulu!', 'error');
      return;
    }
    const petName = custPetName.value.trim();
    if (!petName) {
      showToast('Nama pet harus diisi!', 'error');
      return;
    }

    giveCustomPetBtn.disabled = true;
    try {
      const response = await secureFetch('/api/admin/pet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          action: 'give_custom',
          petName: petName,
          petType: custPetType.value,
          level: parseInt(custPetLevel.value, 10),
          star: parseInt(custPetStar.value, 10)
        })
      });
      const data = await response.json();
      if (data.success) {
        showToast(data.message, 'success');
        custPetName.value = '';
        fetchAndDisplayPet(userId);
      } else {
        showToast(data.message, 'error');
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') showToast('Koneksi server gagal', 'error');
    } finally {
      giveCustomPetBtn.disabled = false;
    }
  });

  // --- Sub-Panel 4: Finansial & Bansos ---
  payoutBansosBtn.addEventListener('click', async () => {
    const amount = parseInt(bansosAmount.value, 10);
    if (isNaN(amount) || amount <= 0) {
      showToast('Nominal bansos tidak valid!', 'error');
      return;
    }
    payoutBansosBtn.disabled = true;
    try {
      const res = await secureFetch('/api/admin/economy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bansos', amount })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        bansosAmount.value = '';
        fetchDetailedStats();
      } else {
        showToast(data.message, 'error');
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') showToast('Koneksi server gagal', 'error');
    } finally {
      payoutBansosBtn.disabled = false;
    }
  });

  resetEconomyBtn.addEventListener('click', async () => {
    if (confirm('🚨 PERINGATAN: Aksi ini akan me-reset saldo seluruh dompet warga ke Rp 1.000, menghapus seluruh tabungan, dan menghapus seluruh pinjaman bank! Apakah Anda yakin?')) {
      resetEconomyBtn.disabled = true;
      try {
        const res = await secureFetch('/api/admin/economy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reset' })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
          fetchDetailedStats();
        } else {
          showToast(data.message, 'error');
        }
      } catch (err) {
        if (err.message !== 'Unauthorized') showToast('Koneksi server gagal', 'error');
      } finally {
        resetEconomyBtn.disabled = false;
      }
    }
  });

  // --- Sub-Panel 5: Bursa Saham Control ---
  function renderStocksTable() {
    stocksList.innerHTML = '';
    if (activeStocks.length === 0) {
      stocksList.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--color-text-muted);">Tidak ada saham terdaftar.</td></tr>';
      return;
    }
    activeStocks.forEach(stock => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 600; color: var(--color-primary);">${stock.stock_ticker}</td>
        <td>${stock.stock_name}</td>
        <td style="font-weight: 500;">${formatCurrency(stock.current_price)}</td>
        <td style="color: var(--color-text-muted);">${formatCurrency(stock.previous_price)}</td>
        <td>${stock.available_shares.toLocaleString('id-ID')} / ${stock.total_shares.toLocaleString('id-ID')}</td>
        <td>
          <button class="btn btn-secondary btn-sm btn-stock-price" data-ticker="${stock.stock_ticker}">💸 Set Harga</button>
          <button class="btn btn-danger btn-sm btn-stock-del" data-ticker="${stock.stock_ticker}">❌ Hapus</button>
        </td>
      `;

      // Set price logic
      tr.querySelector('.btn-stock-price').addEventListener('click', async () => {
        const newPrice = prompt(`Set Harga Baru untuk ${stock.stock_ticker} (Harga Saat Ini: Rp ${stock.current_price}):`);
        if (newPrice && !isNaN(newPrice)) {
          try {
            const response = await secureFetch('/api/admin/stocks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'set_price',
                ticker: stock.stock_ticker,
                price: parseInt(newPrice, 10)
              })
            });
            const d = await response.json();
            if (d.success) {
              showToast(d.message, 'success');
              fetchDetailedStats();
            }
          } catch {
            showToast('Gagal memproses perubahan harga', 'error');
          }
        }
      });

      // Delete stock logic
      tr.querySelector('.btn-stock-del').addEventListener('click', async () => {
        if (confirm(`Apakah Anda yakin ingin menghapus emiten saham ${stock.stock_ticker} secara permanen?`)) {
          try {
            const response = await secureFetch('/api/admin/stocks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'delete',
                ticker: stock.stock_ticker
              })
            });
            const d = await response.json();
            if (d.success) {
              showToast(d.message, 'success');
              fetchDetailedStats();
            }
          } catch {
            showToast('Gagal menghapus emiten', 'error');
          }
        }
      });

      stocksList.appendChild(tr);
    });
  }

  addStockBtn.addEventListener('click', async () => {
    const ticker = newStockTicker.value.trim().toUpperCase();
    const name = newStockName.value.trim();
    const price = parseInt(newStockPrice.value, 10);
    const channel = newStockChannel.value.trim();

    if (!ticker || !name || isNaN(price) || !channel) {
      showToast('Semua input data saham harus diisi lengkap!', 'error');
      return;
    }

    addStockBtn.disabled = true;
    try {
      const response = await secureFetch('/api/admin/stocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          ticker,
          stockName: name,
          price,
          channelId: channel
        })
      });
      const data = await response.json();
      if (data.success) {
        showToast(data.message, 'success');
        newStockTicker.value = '';
        newStockName.value = '';
        newStockPrice.value = '100';
        newStockChannel.value = '';
        fetchDetailedStats();
      } else {
        showToast(data.message, 'error');
      }
    } catch {
      showToast('Koneksi server gagal', 'error');
    } finally {
      addStockBtn.disabled = false;
    }
  });

  // --- Sub-Panel 6: Auction House Control ---
  function renderAuctionsTable() {
    auctionsList.innerHTML = '';
    if (activeAuctions.length === 0) {
      auctionsList.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--color-text-muted);">Tidak ada lelang aktif.</td></tr>';
      return;
    }
    activeAuctions.forEach(auc => {
      const tr = document.createElement('tr');
      const timeText = new Date(auc.ends_at * 1000).toLocaleString('id-ID');
      
      tr.innerHTML = `
        <td style="font-family: monospace;">#${auc.id}</td>
        <td style="font-weight: 500;">${auc.item_id}</td>
        <td>${auc.quantity}</td>
        <td>${formatCurrency(auc.min_bid)}</td>
        <td style="color: var(--color-emerald); font-weight: 600;">${formatCurrency(auc.current_bid)}</td>
        <td style="font-family: monospace;">${auc.highest_bidder_id || '-'}</td>
        <td style="font-size: 12px; color: var(--color-text-muted);">${timeText}</td>
        <td>
          <button class="btn btn-danger btn-sm btn-auc-cancel" data-id="${auc.id}">❌ Batalkan</button>
        </td>
      `;

      tr.querySelector('.btn-auc-cancel').addEventListener('click', async () => {
        if (confirm(`Apakah Anda yakin ingin membatalkan lelang ID #${auc.id}?`)) {
          try {
            const res = await secureFetch('/api/admin/auctions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'cancel', auctionId: auc.id })
            });
            const d = await res.json();
            if (d.success) {
              showToast(d.message, 'success');
              fetchDetailedStats();
            }
          } catch {
            showToast('Gagal membatalkan lelang', 'error');
          }
        }
      });

      auctionsList.appendChild(tr);
    });
  }

  hostAuctionBtn.addEventListener('click', async () => {
    const itemId = aucItemId.value;
    const qty = parseInt(aucQty.value, 10);
    const minBid = parseInt(aucMinBid.value, 10);
    const hours = parseInt(aucHours.value, 10);

    if (isNaN(qty) || qty <= 0 || isNaN(minBid) || minBid <= 0 || isNaN(hours) || hours <= 0) {
      showToast('Kuantitas, bid, dan durasi harus berupa angka positif!', 'error');
      return;
    }

    hostAuctionBtn.disabled = true;
    try {
      const response = await secureFetch('/api/admin/auctions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'host',
          itemId,
          amount: qty,
          minBid,
          hours
        })
      });
      const data = await response.json();
      if (data.success) {
        showToast(data.message, 'success');
        aucQty.value = '1';
        aucMinBid.value = '100';
        aucHours.value = '2';
        fetchDetailedStats();
      } else {
        showToast(data.message, 'error');
      }
    } catch {
      showToast('Koneksi server gagal', 'error');
    } finally {
      hostAuctionBtn.disabled = false;
    }
  });

  // --- Sub-Panel 7: Backups Database ---
  function populateBackupsSelector() {
    dbBackupsSelector.innerHTML = '<option value="">-- Pilih File Backup --</option>';
    activeBackups.forEach(backup => {
      const opt = document.createElement('option');
      opt.value = backup;
      opt.textContent = backup;
      dbBackupsSelector.appendChild(opt);
    });
  }

  restoreDbBtn.addEventListener('click', async () => {
    const file = dbBackupsSelector.value;
    if (!file) {
      showToast('Harap pilih file database backup terlebih dahulu!', 'error');
      return;
    }

    if (confirm(`🚨 PERINGATAN KERAS: Aksi ini akan menimpa basis data aktif saat ini dengan cadangan file "${file}"! Bot Discord Anda akan di-reset koneksinya secara dinamis. Apakah Anda yakin?`)) {
      restoreDbBtn.disabled = true;
      restoreDbBtn.textContent = '💾 Memulihkan...';
      try {
        const response = await secureFetch('/api/admin/abyus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'restore',
            backupFile: file
          })
        });
        const data = await response.json();
        if (data.success) {
          showToast(data.message || 'Database berhasil dipulihkan!', 'success');
          fetchLogs();
          fetchDashboardStats();
        } else {
          showToast(data.message, 'error');
        }
      } catch {
        showToast('Koneksi server gagal', 'error');
      } finally {
        restoreDbBtn.disabled = false;
        restoreDbBtn.textContent = '💾 Pulihkan Database Sekarang';
      }
    }
  });

  backupDbBtn.addEventListener('click', async () => {
    backupDbBtn.disabled = true;
    backupDbBtn.textContent = '💾 Mengirim...';
    try {
      const res = await secureFetch('/api/db/backup', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(`Backup berhasil dibuat: ${data.backupFile}`, 'success');
        fetchLogs();
        fetchDetailedStats();
      } else {
        showToast('Gagal mem-backup database: ' + data.message, 'error');
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') showToast('Koneksi server gagal', 'error');
    } finally {
      backupDbBtn.disabled = false;
      backupDbBtn.textContent = '💾 Backup SQLite';
    }
  });

  // --- Modal Controllers (Quick Give) ---
  function closeQuickGiveModal() {
    giveModal.classList.remove('active');
  }

  closeBtn.addEventListener('click', closeQuickGiveModal);
  cancelBtn.addEventListener('click', closeQuickGiveModal);
  window.addEventListener('click', (e) => {
    if (e.target === giveModal) {
      closeQuickGiveModal();
    }
  });

  categoryCards.forEach(card => {
    card.addEventListener('click', () => {
      const selectedCat = card.getAttribute('data-cat');
      setGiveCategory(selectedCat);
    });
  });

  function setGiveCategory(category) {
    currentCategory = category;

    categoryCards.forEach(c => {
      if (c.getAttribute('data-cat') === category) {
        c.classList.add('active');
      } else {
        c.classList.remove('active');
      }
    });

    if (category === 'coin' || category === 'bank') {
      itemSelectGroup.style.display = 'none';
      coinPresets.style.display = 'flex';
      itemPresets.style.display = 'none';
      amountInp.value = '1000';
    } else {
      itemSelectGroup.style.display = 'block';
      coinPresets.style.display = 'none';
      itemPresets.style.display = 'flex';
      amountInp.value = '1';
      populateAssetDropdown(category);
    }
  }

  function populateAssetDropdown(category) {
    itemSelector.innerHTML = '';
    const targetType = category === 'item' ? 'general' : 'pet';
    const filtered = availableAssets.filter(item => item.category === targetType);
    
    if (filtered.length === 0) {
      itemSelector.innerHTML = '<option value="">(Tidak ada item tersedia)</option>';
      return;
    }

    filtered.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = `${item.name} (${item.description})`;
      itemSelector.appendChild(option);
    });
  }

  // Preset Addition Logic
  const allPresetButtons = document.querySelectorAll('.btn-preset');
  allPresetButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const val = parseInt(btn.getAttribute('data-val'), 10);
      let currentVal = parseInt(amountInp.value, 10);
      if (isNaN(currentVal)) currentVal = 0;
      amountInp.value = currentVal + val;
    });
  });

  // Submit Give Execution
  submitBtn.addEventListener('click', async () => {
    const userId = targetUserInp.value;
    const amount = parseInt(amountInp.value, 10);
    const targetItem = itemSelector.value;

    if (isNaN(amount) || amount === 0) {
      showToast('Jumlah/Nominal harus diisi dengan angka bukan nol!', 'error');
      return;
    }

    if ((currentCategory === 'item' || currentCategory === 'pet_item') && !targetItem) {
      showToast('Silakan pilih item tujuan terlebih dahulu!', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'GIVING...';

    try {
      const response = await secureFetch('/api/give', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          category: currentCategory,
          target: (currentCategory === 'item' || currentCategory === 'pet_item') ? targetItem : null,
          amount: amount
        })
      });

      const resData = await response.json();
      if (resData.success) {
        showToast(resData.message || 'Quick Give berhasil dieksekusi!', 'success');
        closeQuickGiveModal();
        fetchUsers();
        fetchDashboardStats();
      } else {
        showToast('Gagal mengeksekusi Quick Give: ' + resData.message, 'error');
      }
    } catch {
      showToast('Terjadi kesalahan koneksi saat mengirim data', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'GIVE NOW';
    }
  });

  // --- Auth Verification Handler ---
  async function checkAuth() {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      authOverlay.classList.remove('hidden');
      return;
    }

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (data.success) {
        authOverlay.classList.add('hidden');
        // Initial Loading
        fetchDashboardStats();
        fetchAssets();
      } else {
        localStorage.removeItem('admin_token');
        authOverlay.classList.remove('hidden');
      }
    } catch {
      localStorage.removeItem('admin_token');
      authOverlay.classList.remove('hidden');
    }
  }

  authLoginBtn.addEventListener('click', async () => {
    const passcode = authPasscode.value.trim();
    if (!passcode) {
      showToast('Masukkan kode akses admin!', 'error');
      return;
    }

    authLoginBtn.disabled = true;
    authLoginBtn.textContent = 'MEMVERIFIKASI...';

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: passcode })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('admin_token', passcode);
        authOverlay.classList.add('hidden');
        showToast('Login berhasil!', 'success');
        authPasscode.value = '';
        
        // Initial Loading
        fetchDashboardStats();
        fetchAssets();
      } else {
        showToast('Kode akses admin salah!', 'error');
      }
    } catch {
      showToast('Koneksi server gagal', 'error');
    } finally {
      authLoginBtn.disabled = false;
      authLoginBtn.textContent = 'MASUK DASHBOARD';
    }
  });

  // --- Mobile Menu Toggle Controllers ---
  const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
  const sidebarElement = document.querySelector('.sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');

  if (mobileMenuToggle && sidebarElement && sidebarOverlay) {
    const toggleSidebar = () => {
      sidebarElement.classList.toggle('mobile-open');
      sidebarOverlay.classList.toggle('active');
    };

    const closeSidebar = () => {
      sidebarElement.classList.remove('mobile-open');
      sidebarOverlay.classList.remove('active');
    };

    mobileMenuToggle.addEventListener('click', toggleSidebar);
    sidebarOverlay.addEventListener('click', closeSidebar);

    // Close sidebar menu automatically when navigating tabs on mobile
    Object.keys(menuItems).forEach(key => {
      menuItems[key].addEventListener('click', closeSidebar);
    });
  }

  // Run passcode auth check on load
  checkAuth();
});

