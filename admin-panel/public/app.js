document.addEventListener('DOMContentLoaded', () => {
  // --- State Variables ---
  let usersData = [];
  let availableAssets = [];
  let currentCategory = 'coin';

  // --- Element Selectors ---
  const menuDash = document.getElementById('menu-dash');
  const menuUsers = document.getElementById('menu-users');
  const menuLogs = document.getElementById('menu-logs');

  const secDashboard = document.getElementById('section-dashboard');
  const secUsers = document.getElementById('section-users');
  const secLogs = document.getElementById('section-logs');

  // Dashboard Stats
  const statWallets = document.getElementById('stat-wallets');
  const statCoins = document.getElementById('stat-coins');
  const statPets = document.getElementById('stat-pets');
  const statEvent = document.getElementById('stat-event');
  const cfgGacha = document.getElementById('cfg-gacha');
  const cfgMult = document.getElementById('cfg-mult');

  // Members Grid
  const membersList = document.getElementById('members-list');
  const memberSearch = document.getElementById('member-search');

  // Logs
  const logsList = document.getElementById('logs-list');
  const refreshLogsBtn = document.getElementById('refresh-logs-btn');

  // Backup
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

  // Toast container
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

  // --- Tab Switcher ---
  function switchTab(activeTabId) {
    // Remove active classes
    [menuDash, menuUsers, menuLogs].forEach(menu => menu.classList.remove('active'));
    [secDashboard, secUsers, secLogs].forEach(sec => sec.classList.remove('active'));

    if (activeTabId === 'dashboard') {
      menuDash.classList.add('active');
      secDashboard.classList.add('active');
      fetchDashboardStats();
    } else if (activeTabId === 'users') {
      menuUsers.classList.add('active');
      secUsers.classList.add('active');
      fetchUsers();
    } else if (activeTabId === 'logs') {
      menuLogs.classList.add('active');
      secLogs.classList.add('active');
      fetchLogs();
    }
  }

  // Listen for sidebar navigation clicks
  menuDash.addEventListener('click', (e) => { e.preventDefault(); switchTab('dashboard'); });
  menuUsers.addEventListener('click', (e) => { e.preventDefault(); switchTab('users'); });
  menuLogs.addEventListener('click', (e) => { e.preventDefault(); switchTab('logs'); });

  // Handle URL Hash if loaded directly
  const hash = window.location.hash.replace('#', '');
  if (['dashboard', 'users', 'logs'].includes(hash)) {
    switchTab(hash);
  } else {
    switchTab('dashboard');
  }

  // --- API Fetch Functions ---
  async function fetchDashboardStats() {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      if (data.success) {
        statWallets.textContent = data.walletsCount.toLocaleString('id-ID');
        statCoins.textContent = formatCurrency(data.totalCoins);
        statPets.textContent = data.activePetsCount.toLocaleString('id-ID');
        
        const isAbyusActive = data.settings.is_active === 1;
        statEvent.textContent = isAbyusActive ? 'AKTIF 🚀' : 'Nonaktif';
        statEvent.className = isAbyusActive ? 'emerald-text' : 'muted-text';
        
        cfgGacha.textContent = data.settings.gacha_mode || 'NORMAL';
        cfgMult.textContent = (data.settings.coin_multiplier || 1) + 'x';
      } else {
        showToast('Gagal memuat statistik: ' + data.message, 'error');
      }
    } catch (err) {
      showToast('Koneksi server terputus', 'error');
    }
  }

  async function fetchUsers() {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success) {
        usersData = data.users;
        renderUsersTable();
      } else {
        showToast('Gagal memuat data warga: ' + data.message, 'error');
      }
    } catch (err) {
      showToast('Koneksi server terputus', 'error');
    }
  }

  async function fetchAssets() {
    try {
      const res = await fetch('/api/assets');
      const data = await res.json();
      if (data.success) {
        availableAssets = data.items;
      }
    } catch (err) {
      console.error('Failed to load assets', err);
    }
  }

  async function fetchLogs() {
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      if (data.success) {
        logsList.innerHTML = '';
        if (data.logs.length === 0) {
          logsList.innerHTML = '<li style="border-left-color: var(--color-text-muted);">Belum ada riwayat aktivitas log.</li>';
        } else {
          data.logs.forEach(log => {
            const li = document.createElement('li');
            li.textContent = log;
            // Highlight give vs system logs visually
            if (log.includes('Gave')) {
              li.style.borderLeftColor = 'var(--color-emerald)';
            } else if (log.includes('Backup')) {
              li.style.borderLeftColor = 'var(--color-gold)';
            } else {
              li.style.borderLeftColor = 'var(--color-primary)';
            }
            logsList.appendChild(li);
          });
        }
      } else {
        showToast('Gagal memuat riwayat log: ' + data.message, 'error');
      }
    } catch (err) {
      showToast('Koneksi server terputus', 'error');
    }
  }

  // --- Search and Render Tables ---
  function renderUsersTable() {
    membersList.innerHTML = '';
    const query = memberSearch.value.trim().toLowerCase();
    
    const filteredUsers = usersData.filter(user => {
      return user.user_id.toLowerCase().includes(query);
    });

    if (filteredUsers.length === 0) {
      membersList.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--color-text-muted);">
            Tidak ada warga ditemukan.
          </td>
        </tr>
      `;
      return;
    }

    filteredUsers.forEach(user => {
      const totalWealth = user.wallet_balance + user.bank_balance;
      const tr = document.createElement('tr');
      
      const blacklistBadge = user.is_blacklisted > 0 
        ? '<span class="badge badge-red">BLACKLISTED</span>' 
        : '<span class="badge badge-muted">AMAN</span>';

      tr.innerHTML = `
        <td style="font-weight: 500; font-family: monospace;">${user.user_id}</td>
        <td>${formatCurrency(user.wallet_balance)}</td>
        <td>${formatCurrency(user.bank_balance)}</td>
        <td style="font-weight: 600; color: var(--color-text-light);">${formatCurrency(totalWealth)}</td>
        <td style="color: var(--color-text-muted); font-size: 13px;">${formatDate(user.last_active_date)}</td>
        <td>${blacklistBadge}</td>
        <td>
          <button class="btn btn-primary btn-give" data-userid="${user.user_id}">🎁 Quick Give</button>
        </td>
      `;

      // Event listener for Quick Give button
      tr.querySelector('.btn-give').addEventListener('click', () => {
        openQuickGiveModal(user.user_id);
      });

      membersList.appendChild(tr);
    });
  }

  memberSearch.addEventListener('input', renderUsersTable);
  refreshLogsBtn.addEventListener('click', fetchLogs);

  // --- Backup Operation ---
  backupDbBtn.addEventListener('click', async () => {
    backupDbBtn.disabled = true;
    backupDbBtn.textContent = '💾 Mengirim...';
    try {
      const res = await fetch('/api/db/backup', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(`Backup berhasil dibuat: ${data.backupFile}`, 'success');
        fetchLogs();
      } else {
        showToast('Gagal mem-backup database: ' + data.message, 'error');
      }
    } catch (err) {
      showToast('Koneksi server gagal', 'error');
    } finally {
      backupDbBtn.disabled = false;
      backupDbBtn.textContent = '💾 Backup SQLite';
    }
  });

  // --- Modal Controllers ---
  function openQuickGiveModal(userId) {
    targetUserInp.value = userId;
    giveModal.classList.add('active');
    
    // Set default category to coin
    setGiveCategory('coin');
  }

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

  // Category selection card switcher
  categoryCards.forEach(card => {
    card.addEventListener('click', () => {
      const selectedCat = card.getAttribute('data-cat');
      setGiveCategory(selectedCat);
    });
  });

  function setGiveCategory(category) {
    currentCategory = category;

    // Reset card active styles
    categoryCards.forEach(c => {
      if (c.getAttribute('data-cat') === category) {
        c.classList.add('active');
      } else {
        c.classList.remove('active');
      }
    });

    // Toggle dropdown & preset visibility
    if (category === 'coin' || category === 'bank') {
      itemSelectGroup.style.display = 'none';
      coinPresets.style.display = 'flex';
      itemPresets.style.display = 'none';
      
      // Default amount for money
      amountInp.value = '1000';
    } else {
      itemSelectGroup.style.display = 'block';
      coinPresets.style.display = 'none';
      itemPresets.style.display = 'flex';
      
      // Default amount for items
      amountInp.value = '1';
      
      // Filter assets & populate items select
      populateAssetDropdown(category);
    }
  }

  function populateAssetDropdown(category) {
    itemSelector.innerHTML = '';
    // Map categories: 'item' -> 'general', 'pet_item' -> 'pet'
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

  // Preset Button Addition Logic
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
      const response = await fetch('/api/give', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
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
        
        // Refresh users list and dashboard stats to show updated wallet values
        fetchUsers();
        fetchDashboardStats();
      } else {
        showToast('Gagal mengeksekusi Quick Give: ' + resData.message, 'error');
      }
    } catch (err) {
      showToast('Terjadi kesalahan koneksi saat mengirim data', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'GIVE NOW';
    }
  });

  // --- Initial Loading ---
  fetchDashboardStats();
  fetchAssets();
  // Set up periodic dashboard stats refresh every 30 seconds
  setInterval(fetchDashboardStats, 30000);
});
