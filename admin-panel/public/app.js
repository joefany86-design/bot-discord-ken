document.addEventListener('DOMContentLoaded', () => {
  // --- State Variables ---
  let usersData = [];
  let availableAssets = [];
  let currentCategory = 'coin';
  let activeStocks = [];
  let activeAuctions = [];
  let activeBackups = [];
  let currentFilter = 'all';

  // --- Web Audio SFX Synthesizer ---
  const SoundEffects = {
    ctx: null,
    init() {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
    },
    playCoin() {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880.00, now + 0.08); // A5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    },
    playJail() {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(100, now);
      osc1.frequency.linearRampToValueAtTime(40, now + 0.4);
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(125, now);
      osc2.frequency.linearRampToValueAtTime(30, now + 0.4);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.5);
      osc2.stop(now + 0.5);
    },
    playHeal() {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.4);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    },
    playWarning() {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.linearRampToValueAtTime(120, now + 0.15);
      osc.frequency.setValueAtTime(180, now + 0.15);
      osc.frequency.linearRampToValueAtTime(120, now + 0.3);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    },
    playSuccess() {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
      notes.forEach((freq, index) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + index * 0.08);
        gain.gain.setValueAtTime(0.12, now + index * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.3);
        osc.start(now + index * 0.08);
        osc.stop(now + index * 0.08 + 0.3);
      });
    }
  };

  // --- Confetti System ---
  function triggerConfetti() {
    const colors = ['#388bfd', '#10b981', '#f59e0b', '#f85149', '#8e44ad', '#ecf0f1'];
    for (let i = 0; i < 60; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-piece';
      p.style.left = Math.random() * 100 + 'vw';
      p.style.top = '-10px';
      p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      p.style.width = Math.random() * 8 + 6 + 'px';
      p.style.height = Math.random() * 12 + 6 + 'px';
      p.style.transform = `rotate(${Math.random() * 360}deg)`;
      const duration = Math.random() * 1.5 + 1.5;
      p.style.transition = `transform ${duration}s linear, top ${duration}s cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
      document.body.appendChild(p);
      setTimeout(() => {
        p.style.top = '105vh';
        p.style.transform = `rotate(${Math.random() * 720 - 360}deg) translate(${Math.random() * 100 - 50}px)`;
      }, 50);
      setTimeout(() => { p.remove(); }, duration * 1000 + 100);
    }
  }

  // --- Circular Progress Ring Updater ---
  function setRingValue(circleElement, value, maxVal = 100) {
    if (!circleElement) return;
    const radius = 24; // Circle 'r' value in HTML
    const circumference = 2 * Math.PI * radius;
    circleElement.style.strokeDasharray = `${circumference} ${circumference}`;
    const percent = Math.min(Math.max(0, value), maxVal) / maxVal;
    const offset = circumference - (percent * circumference);
    circleElement.style.strokeDashoffset = offset;
  }

  // --- Pet Avatar SVG Renderer ---
  function getPetAvatarSVG(petType, status, hpPercent) {
    const isDead = status === 'DEAD' || hpPercent <= 0;
    const animateClass = isDead ? 'animate-dead' : `animate-${petType.toLowerCase()}`;
    const shakeClass = (!isDead && hpPercent < 30) ? 'shake-critical' : '';
    let color = '#3498db';
    let detailColor = '#2980b9';
    
    if (petType === 'SLIME') { color = '#2ecc71'; detailColor = '#27ae60'; }
    else if (petType === 'DRAGON') { color = '#e74c3c'; detailColor = '#c0392b'; }
    else if (petType === 'CAT') { color = '#f39c12'; detailColor = '#d35400'; }
    else if (petType === 'GOLEM') { color = '#7f8c8d'; detailColor = '#95a5a6'; }
    else if (petType === 'PHOENIX') { color = '#e67e22'; detailColor = '#d35400'; }
    else if (petType === 'TURTLE') { color = '#16a085'; detailColor = '#11806a'; }
    else if (petType === 'CHRONOS') { color = '#9b59b6'; detailColor = '#8e44ad'; }
    else if (petType === 'OUROBOROS') { color = '#1abc9c'; detailColor = '#16a085'; }
    
    if (isDead) {
      return `
        <svg viewBox="0 0 100 100" class="pet-svg ${animateClass}">
          <ellipse cx="50" cy="85" rx="35" ry="8" fill="rgba(0,0,0,0.3)"/>
          <path d="M25,85 L25,45 C25,25 75,25 75,45 L75,85 Z" fill="#7f8c8d" stroke="#5d6d7e" stroke-width="2"/>
          <rect x="20" y="80" width="60" height="8" rx="2" fill="#5d6d7e"/>
          <rect x="47" y="40" width="6" height="25" fill="#34495e"/>
          <rect x="37" y="47" width="26" height="6" fill="#34495e"/>
          <text x="50" y="75" fill="#2c3e50" font-family="var(--font-title)" font-size="10" font-weight="700" text-anchor="middle">R.I.P</text>
        </svg>
      `;
    }

    let shapes = '';
    if (petType === 'SLIME') {
      shapes = `
        <path d="M15,70 Q15,40 50,30 Q85,40 85,70 Q85,85 50,85 Q15,85 15,70 Z" fill="${color}"/>
        <path d="M30,75 Q50,80 70,75" fill="none" stroke="${detailColor}" stroke-width="4" stroke-linecap="round"/>
        <circle cx="50" cy="55" r="8" fill="${detailColor}" opacity="0.6"/>
        <circle cx="40" cy="50" r="4" fill="#111"/>
        <circle cx="60" cy="50" r="4" fill="#111"/>
        <circle cx="39" cy="48" r="1.5" fill="#fff"/>
        <circle cx="59" cy="48" r="1.5" fill="#fff"/>
        <circle cx="34" cy="54" r="3" fill="#ff7675" opacity="0.8"/>
        <circle cx="66" cy="54" r="3" fill="#ff7675" opacity="0.8"/>
      `;
    } 
    else if (petType === 'DRAGON') {
      shapes = `
        <path d="M50,55 L20,35 Q10,50 25,65 Z" fill="${detailColor}"/>
        <path d="M50,55 L80,35 Q90,50 75,65 Z" fill="${detailColor}"/>
        <circle cx="50" cy="55" r="28" fill="${color}"/>
        <path d="M30,35 L40,42 L50,22 L60,42 L70,35 L65,55 L35,55 Z" fill="${detailColor}"/>
        <circle cx="50" cy="52" r="22" fill="${color}"/>
        <ellipse cx="50" cy="60" rx="12" ry="7" fill="${detailColor}"/>
        <circle cx="46" cy="58" r="1.5" fill="#111"/>
        <circle cx="54" cy="58" r="1.5" fill="#111"/>
        <circle cx="42" cy="46" r="4.5" fill="#ffeaa7"/>
        <circle cx="58" cy="46" r="4.5" fill="#ffeaa7"/>
        <circle cx="42" cy="46" r="2" fill="#d63031"/>
        <circle cx="58" cy="46" r="2" fill="#d63031"/>
      `;
    }
    else if (petType === 'CAT') {
      shapes = `
        <path d="M72,60 Q85,45 80,30" fill="none" stroke="${detailColor}" stroke-width="8" stroke-linecap="round"/>
        <polygon points="25,35 40,50 20,55" fill="${detailColor}"/>
        <polygon points="75,35 60,50 80,55" fill="${detailColor}"/>
        <circle cx="50" cy="62" r="26" fill="${color}"/>
        <circle cx="50" cy="48" r="20" fill="${color}"/>
        <polygon points="27,39 37,49 24,51" fill="#ff7675"/>
        <polygon points="73,39 63,49 76,51" fill="#ff7675"/>
        <ellipse cx="42" cy="45" rx="3.5" ry="5" fill="#111"/>
        <ellipse cx="58" cy="45" rx="3.5" ry="5" fill="#111"/>
        <circle cx="41" cy="43" r="1.2" fill="#fff"/>
        <circle cx="57" cy="43" r="1.2" fill="#fff"/>
        <polygon points="50,51 47,49 53,49" fill="#ff7675"/>
        <path d="M47,53 Q50,56 53,53" fill="none" stroke="#111" stroke-width="2"/>
        <line x1="28" y1="49" x2="16" y2="47" stroke="${detailColor}" stroke-width="2" stroke-linecap="round"/>
        <line x1="28" y1="53" x2="14" y2="54" stroke="${detailColor}" stroke-width="2" stroke-linecap="round"/>
        <line x1="72" y1="49" x2="84" y2="47" stroke="${detailColor}" stroke-width="2" stroke-linecap="round"/>
        <line x1="72" y1="53" x2="86" y2="54" stroke="${detailColor}" stroke-width="2" stroke-linecap="round"/>
      `;
    }
    else if (petType === 'GOLEM') {
      shapes = `
        <rect x="15" y="45" width="70" height="20" rx="6" fill="${detailColor}"/>
        <rect x="12" y="52" width="16" height="25" rx="4" fill="${color}"/>
        <rect x="72" y="52" width="16" height="25" rx="4" fill="${color}"/>
        <rect x="28" y="55" width="44" height="30" rx="4" fill="${color}"/>
        <rect x="36" y="60" width="28" height="15" fill="${detailColor}" opacity="0.8"/>
        <rect x="38" y="25" width="24" height="22" rx="4" fill="${color}"/>
        <rect x="42" y="32" width="16" height="4" rx="1" fill="#74b9ff"/>
      `;
    }
    else {
      shapes = `
        <circle cx="50" cy="50" r="32" fill="none" stroke="${detailColor}" stroke-width="4" stroke-dasharray="10 5" opacity="0.6"/>
        <circle cx="50" cy="50" r="22" fill="${color}"/>
        <path d="M32,50 L68,50 M50,32 L50,68" stroke="${detailColor}" stroke-width="2"/>
        <circle cx="50" cy="50" r="10" fill="#fff" opacity="0.8"/>
        <circle cx="28" cy="28" r="2" fill="#fff"/>
        <circle cx="72" cy="28" r="2" fill="#fff"/>
        <circle cx="28" cy="72" r="2" fill="#fff"/>
        <circle cx="72" cy="72" r="2" fill="#fff"/>
      `;
    }

    return `
      <svg viewBox="0 0 100 100" class="pet-svg ${animateClass} ${shakeClass}">
        <ellipse cx="50" cy="88" rx="26" ry="6" fill="rgba(0,0,0,0.3)"/>
        ${shapes}
      </svg>
    `;
  }

  // --- Canvas Sparkline Painter ---
  function paintSparkline(canvas, history) {
    if (!canvas || !history || history.length < 2) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    
    const maxVal = Math.max(...history);
    const minVal = Math.min(...history);
    const valRange = maxVal === minVal ? 1 : maxVal - minVal;
    
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    const lastPrice = history[history.length - 1];
    const prevPrice = history[history.length - 2] || lastPrice;
    
    let strokeColor = '#388bfd';
    let fillColorStart = 'rgba(56, 139, 253, 0.2)';
    if (lastPrice > prevPrice) {
      strokeColor = '#10b981';
      fillColorStart = 'rgba(16, 185, 129, 0.2)';
    } else if (lastPrice < prevPrice) {
      strokeColor = '#f85149';
      fillColorStart = 'rgba(248, 81, 73, 0.2)';
    }
    
    gradient.addColorStop(0, fillColorStart);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    
    const points = [];
    const stepX = w / (history.length - 1);
    history.forEach((val, i) => {
      const x = i * stepX;
      const y = h - 4 - ((val - minVal) / valRange) * (h - 8);
      points.push({ x, y });
    });
    
    ctx.beginPath();
    ctx.moveTo(0, h);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const cpX = (points[i-1].x + points[i].x) / 2;
      ctx.quadraticCurveTo(points[i-1].x, points[i-1].y, cpX, (points[i-1].y + points[i].y) / 2);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    const lastPoint = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(lastPoint.x - 2, lastPoint.y, 3, 0, 2 * Math.PI);
    ctx.fillStyle = strokeColor;
    ctx.fill();
  }

  // --- Donut Chart & Inflation Status ---
  function updateEconomyCharts(totalWallet, totalBank) {
    const donutSegmentWallet = document.getElementById('donut-segment-wallet');
    const donutSegmentBank = document.getElementById('donut-segment-bank');
    const donutValTotal = document.getElementById('donut-val-total');
    const chartLblWallet = document.getElementById('chart-lbl-wallet');
    const chartLblBank = document.getElementById('chart-lbl-bank');
    
    const totalAset = totalWallet + totalBank;
    if (donutValTotal) donutValTotal.textContent = formatCurrency(totalAset);
    if (chartLblWallet) chartLblWallet.textContent = formatCurrency(totalWallet);
    if (chartLblBank) chartLblBank.textContent = formatCurrency(totalBank);
    
    if (totalAset === 0) return;
    
    const circumference = 314.15;
    const walletPct = totalWallet / totalAset;
    const bankPct = totalBank / totalAset;
    
    const walletOffset = circumference - (walletPct * circumference);
    if (donutSegmentWallet) {
      donutSegmentWallet.style.strokeDashoffset = walletOffset;
    }
    
    const bankOffset = circumference - (bankPct * circumference);
    if (donutSegmentBank) {
      donutSegmentBank.style.strokeDashoffset = bankOffset;
      donutSegmentBank.style.transform = `rotate(${walletPct * 360}deg)`;
      donutSegmentBank.style.transformOrigin = '75px 75px';
    }
    
    updateInflationDetector(totalWallet, usersData.length);
  }
  
  function updateInflationDetector(totalWalletCoins, totalUsers) {
    const inflationBox = document.getElementById('inflation-box');
    const inflationStatusText = document.getElementById('inflation-status-text');
    if (!inflationBox || !inflationStatusText || totalUsers === 0) return;
    
    const avgCoins = totalWalletCoins / totalUsers;
    let status = 'STABIL 🟢';
    let bgColor = 'rgba(16, 185, 129, 0.15)';
    let borderClr = 'rgba(16, 185, 129, 0.3)';
    let textClr = 'var(--color-emerald)';
    
    if (avgCoins > 20000) {
      status = 'INFLASI EKSTRIM 🚨';
      bgColor = 'rgba(248, 81, 73, 0.15)';
      borderClr = 'rgba(248, 81, 73, 0.3)';
      textClr = 'var(--color-red)';
    } else if (avgCoins > 8000) {
      status = 'INFLASI MODERAT ⚠️';
      bgColor = 'rgba(245, 158, 11, 0.15)';
      borderClr = 'rgba(245, 158, 11, 0.3)';
      textClr = 'var(--color-gold)';
    }
    
    inflationBox.style.backgroundColor = bgColor;
    inflationBox.style.borderColor = borderClr;
    inflationStatusText.textContent = status;
    inflationStatusText.style.color = textClr;
  }

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
    logs: document.getElementById('menu-logs'),
    promos: document.getElementById('menu-promos'),
    broadcast: document.getElementById('menu-broadcast')
  };

  const sections = {
    dash: document.getElementById('section-dashboard'),
    users: document.getElementById('section-users'),
    pet: document.getElementById('section-pet'),
    economy: document.getElementById('section-economy'),
    stocks: document.getElementById('section-stocks'),
    auctions: document.getElementById('section-auctions'),
    logs: document.getElementById('section-logs'),
    promos: document.getElementById('section-promos'),
    broadcast: document.getElementById('section-broadcast')
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
  const resetAllBtn = document.getElementById('reset-all-btn');

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
    } else if (activeTabId === 'promos') {
      fetchPromos();
    } else if (activeTabId === 'broadcast') {
      fetchBroadcasts();
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
        
        // Populate Richest Citizen insight leaderboard card
        const valRichestUser = document.getElementById('val-richest-user');
        const valRichestAmount = document.getElementById('val-richest-amount');
        if (usersData.length > 0 && valRichestUser && valRichestAmount) {
          const richest = usersData[0];
          const richestAset = richest.wallet_balance + richest.bank_balance;
          const rName = richest.display_name ? `${richest.display_name} (@${richest.username || ''})` : richest.user_id;
          valRichestUser.textContent = `Warga: ${rName}`;
          valRichestAmount.textContent = formatCurrency(richestAset);
        } else if (valRichestUser && valRichestAmount) {
          valRichestUser.textContent = '-';
          valRichestAmount.textContent = 'Rp 0';
        }
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

        // Call helper to render wealth distribution Donut Chart & Inflation Status
        updateEconomyCharts(data.totalCirculation, data.bankSavings);

        // Populate Strongest Pet Insight Card
        const valStrongestPet = document.getElementById('val-strongest-pet');
        const valStrongestDesc = document.getElementById('val-strongest-desc');
        if (valStrongestPet && valStrongestDesc) {
          if (data.strongestPet) {
            const pOwner = data.strongestPet.display_name ? `${data.strongestPet.display_name} (@${data.strongestPet.username || ''})` : data.strongestPet.user_id;
            valStrongestPet.textContent = `Warga: ${pOwner}`;
            valStrongestDesc.textContent = `🐾 ${data.strongestPet.pet_name} (Lv. ${data.strongestPet.level} ${data.strongestPet.pet_type})`;
          } else {
            valStrongestPet.textContent = '-';
            valStrongestDesc.textContent = 'Tidak ada pet aktif';
          }
        }

        // Populate Jailed User Insight Card
        const valJailedUser = document.getElementById('val-jailed-user');
        const valJailedTime = document.getElementById('val-jailed-time');
        if (valJailedUser && valJailedTime) {
          if (data.longestJail) {
            const jName = data.longestJail.display_name ? `${data.longestJail.display_name} (@${data.longestJail.username || ''})` : data.longestJail.user_id;
            valJailedUser.textContent = `Warga: ${jName}`;
            const durationSec = data.longestJail.jail_until - Math.floor(Date.now() / 1000);
            const mins = Math.max(0, Math.round(durationSec / 60));
            valJailedTime.textContent = `Sisa: ${mins} menit`;
          } else {
            valJailedUser.textContent = '-';
            valJailedTime.textContent = 'Bebas Lapas';
          }
        }

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
        SoundEffects.playSuccess();
        triggerConfetti();
        fetchDashboardStats();
      } else {
        showToast(data.message, 'error');
        SoundEffects.playWarning();
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
    let filteredUsers = usersData.filter(user => {
      const uId = (user.user_id || '').toLowerCase();
      const uName = (user.username || '').toLowerCase();
      const dName = (user.display_name || '').toLowerCase();
      return uId.includes(query) || uName.includes(query) || dName.includes(query);
    });

    // Client-side Filter tabs logic
    if (currentFilter === 'jail') {
      const nowUnix = Math.floor(Date.now() / 1000);
      filteredUsers = filteredUsers.filter(user => user.jail_until && user.jail_until > nowUnix);
    } else if (currentFilter === 'blacklist') {
      filteredUsers = filteredUsers.filter(user => user.is_blacklisted > 0);
    } else if (currentFilter === 'rich') {
      filteredUsers = filteredUsers.filter(user => (user.wallet_balance + user.bank_balance) >= 20000);
    } else if (currentFilter === 'dead_pet') {
      filteredUsers = filteredUsers.filter(user => user.has_dead_pet > 0);
    }

    if (filteredUsers.length === 0) {
      membersList.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--color-text-muted);">Tidak ada warga ditemukan.</td></tr>`;
      return;
    }

    filteredUsers.forEach(user => {
      const totalWealth = user.wallet_balance + user.bank_balance;
      const tr = document.createElement('tr');
      
      let blBadge = '<span class="badge badge-muted">AMAN</span>';
      if (user.is_blacklisted > 0) {
        blBadge = '<span class="badge badge-red">BLACKLISTED</span>';
      } else if (user.jail_until && user.jail_until > Math.floor(Date.now() / 1000)) {
        blBadge = '<span class="badge badge-purple">👮 LAPAS</span>';
      }

      const citizenName = user.display_name 
        ? `<div style="font-weight: 600; color: var(--color-text-light);">${user.display_name}</div><div style="font-size: 11px; color: var(--color-text-muted);">@${user.username || ''}</div>`
        : `<div style="font-weight: 600; color: var(--color-text-muted);">@${user.username || 'Warga'}</div>`;

      tr.innerHTML = `
        <td style="font-weight: 500; font-family: monospace; font-size: 12px; color: var(--color-text-muted);">${user.user_id}</td>
        <td>${citizenName}</td>
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
        fetchAndDisplayInventory(user.user_id);
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
        if (action === 'jail') SoundEffects.playJail();
        else if (action === 'blacklist') SoundEffects.playWarning();
        else SoundEffects.playSuccess();
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
          const uText = user.display_name ? `${user.display_name} (@${user.username || ''})` : `@${user.username || user.user_id || 'Warga'}`;
          opt.textContent = `${uText} (${user.user_id})`;
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
      const petAvatarWrapper = document.getElementById('pet-avatar-wrapper');
      
      if (data.success && data.pet) {
        const pet = data.pet;
        petDisplayName.textContent = `🐾 ${pet.pet_name} (Lv. ${pet.level} ${pet.pet_type})`;
        petDisplayStars.textContent = '⭐'.repeat(pet.star_level || 1);
        
        // Calculate Max HP to show correct percentage in ring
        const vit = pet.stat_vit || 0;
        const maxHP = (pet.pet_type === 'TURTLE' ? 120 : (pet.pet_type === 'SLIME' ? 120 : 100)) + (pet.star_level - 1) * 15 + vit * 3;
        
        // Update circular progress rings
        setRingValue(document.getElementById('ring-hp'), pet.health, maxHP);
        setRingValue(document.getElementById('ring-hunger'), pet.hunger);
        setRingValue(document.getElementById('ring-thirst'), pet.thirst);
        setRingValue(document.getElementById('ring-happy'), pet.happiness);
        
        // Update stats labels inside rings
        document.getElementById('pet-val-hp').textContent = `${Math.round((pet.health / maxHP) * 100)}%`;
        document.getElementById('pet-val-hunger').textContent = `${pet.hunger}%`;
        document.getElementById('pet-val-thirst').textContent = `${pet.thirst}%`;
        document.getElementById('pet-val-happy').textContent = `${pet.happiness}%`;

        petValTrait.textContent = pet.trait || 'Tidak Ada Trait';
        petValFloor.textContent = `Lantai ${data.tower.current_floor || 1} (Max: ${data.tower.max_floor || 1})`;
        petValAutofeed.textContent = pet.auto_feed === 2 ? '👑 VIP (Aktif)' : '❌ Nonaktif';
        petValStatus.textContent = pet.status;
        petValStatus.className = `badge ${pet.status === 'DEAD' ? 'badge-red' : 'badge-emerald'}`;

        // Render visual SVG avatar
        if (petAvatarWrapper) {
          petAvatarWrapper.innerHTML = getPetAvatarSVG(pet.pet_type, pet.status, pet.health);
        }

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
        setRingValue(document.getElementById('ring-hp'), 0);
        setRingValue(document.getElementById('ring-hunger'), 0);
        setRingValue(document.getElementById('ring-thirst'), 0);
        setRingValue(document.getElementById('ring-happy'), 0);
        
        document.getElementById('pet-val-hp').textContent = '-';
        document.getElementById('pet-val-hunger').textContent = '-';
        document.getElementById('pet-val-thirst').textContent = '-';
        document.getElementById('pet-val-happy').textContent = '-';
        
        petValTrait.textContent = '-';
        petValFloor.textContent = '-';
        petValAutofeed.textContent = '-';
        petValStatus.textContent = 'TIADA';
        petValStatus.className = 'badge badge-muted';

        if (petAvatarWrapper) {
          petAvatarWrapper.innerHTML = '<span style="font-size: 40px; opacity: 0.3;">📭</span>';
        }
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
        if (action === 'heal' || action === 'revive' || action === 'hatch') {
          SoundEffects.playHeal();
        } else if (action === 'delete') {
          SoundEffects.playWarning();
        } else {
          SoundEffects.playSuccess();
        }
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
        SoundEffects.playSuccess();
        triggerConfetti();
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

  // Taxation button trigger
  const payoutTaxBtn = document.getElementById('payout-tax-btn');
  const taxPercent = document.getElementById('tax-percent');
  if (payoutTaxBtn && taxPercent) {
    payoutTaxBtn.addEventListener('click', async () => {
      const percent = parseFloat(taxPercent.value);
      if (isNaN(percent) || percent <= 0 || percent > 90) {
        showToast('Persentase pajak harus antara 1% dan 90%!', 'error');
        return;
      }
      payoutTaxBtn.disabled = true;
      try {
        const res = await secureFetch('/api/admin/economy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'tax', percent })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
          SoundEffects.playWarning();
          fetchDetailedStats();
          fetchUsers();
        } else {
          showToast(data.message, 'error');
        }
      } catch (err) {
        if (err.message !== 'Unauthorized') showToast('Koneksi server gagal', 'error');
      } finally {
        payoutTaxBtn.disabled = false;
      }
    });
  }

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
          SoundEffects.playWarning();
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

  resetAllBtn.addEventListener('click', async () => {
    if (confirm('💀 PERINGATAN KERAS: Aksi ini akan me-reset total seluruh data server! Semua peliharaan (pets), barang/inventory, kebun, portofolio saham, turnamen, dan data finansial warga akan dihapus secara permanen. Apakah Anda yakin ingin melakukan WIPE OUT?')) {
      if (confirm('🚨 KONFIRMASI KEDUA: Apakah Anda benar-benar yakin? Tindakan ini TIDAK BISA DIBATALKAN dan seluruh riwayat warga akan hilang!')) {
        resetAllBtn.disabled = true;
        try {
          const res = await secureFetch('/api/admin/economy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reset_all' })
          });
          const data = await res.json();
          if (data.success) {
            showToast(data.message, 'success');
            SoundEffects.playWarning();
            fetchDetailedStats();
            fetchUsers();
          } else {
            showToast(data.message, 'error');
          }
        } catch (err) {
          if (err.message !== 'Unauthorized') showToast('Koneksi server gagal', 'error');
        } finally {
          resetAllBtn.disabled = false;
        }
      }
    }
  });

  function renderStocksTable() {
    stocksList.innerHTML = '';
    if (activeStocks.length === 0) {
      stocksList.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--color-text-muted);">Tidak ada saham terdaftar.</td></tr>';
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
          <canvas class="sparkline-canvas" width="90" height="28" id="spark-${stock.stock_ticker}"></canvas>
        </td>
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

      // Paint Sparkline Chart
      const canvas = tr.querySelector(`#spark-${stock.stock_ticker}`);
      if (canvas && stock.history) {
        paintSparkline(canvas, stock.history);
      }
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
      
      const bidderText = auc.bidder_display_name 
        ? `${auc.bidder_display_name} (@${auc.bidder_username})` 
        : (auc.highest_bidder_id ? auc.highest_bidder_id : '-');

      tr.innerHTML = `
        <td style="font-family: monospace;">#${auc.id}</td>
        <td style="font-weight: 500;">${auc.item_id}</td>
        <td>${auc.quantity}</td>
        <td>${formatCurrency(auc.min_bid)}</td>
        <td style="color: var(--color-emerald); font-weight: 600;">${formatCurrency(auc.current_bid)}</td>
        <td style="font-size: 13px;">${bidderText}</td>
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
        SoundEffects.playSuccess();
        triggerConfetti();
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
          SoundEffects.playSuccess();
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
        SoundEffects.playSuccess();
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
        
        // SFX and visual effects
        if (currentCategory === 'coin' || currentCategory === 'bank') {
          SoundEffects.playCoin();
        } else {
          SoundEffects.playSuccess();
        }
        triggerConfetti();

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

  // --- Warga Filter Tabs click listeners ---
  const filterTabs = document.querySelectorAll('.badge-tab');
  filterTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.getAttribute('data-filter');
      renderUsersTable();
      SoundEffects.playCoin(); // click feedback
    });
  });

  // --- Market Event Control bindings ---
  const btnMarketBull = document.getElementById('btn-market-bull');
  const btnMarketBear = document.getElementById('btn-market-bear');
  const btnMarketReset = document.getElementById('btn-market-reset');
  const marketEventHours = document.getElementById('market-event-hours');

  const triggerMarketEvent = async (eventType) => {
    const hours = marketEventHours ? parseInt(marketEventHours.value, 10) : 1;
    if (isNaN(hours) || hours <= 0) {
      showToast('Durasi event tidak valid!', 'error');
      return;
    }
    
    try {
      const response = await secureFetch('/api/admin/stocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'market_event',
          eventType,
          hours
        })
      });
      const data = await response.json();
      if (data.success) {
        showToast(data.message, 'success');
        if (eventType === 'BULL') {
          SoundEffects.playSuccess();
          triggerConfetti();
        } else if (eventType === 'BEAR') {
          SoundEffects.playWarning();
        } else {
          SoundEffects.playSuccess();
        }
        fetchDetailedStats();
      } else {
        showToast(data.message, 'error');
      }
    } catch {
      showToast('Koneksi server gagal memproses event', 'error');
    }
  };

  if (btnMarketBull) btnMarketBull.addEventListener('click', () => triggerMarketEvent('BULL'));
  if (btnMarketBear) btnMarketBear.addEventListener('click', () => triggerMarketEvent('BEAR'));
  if (btnMarketReset) btnMarketReset.addEventListener('click', () => triggerMarketEvent('RESET'));

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

  // --- Promo Voucher Management Logic ---
  const promosTableBody = document.getElementById('promos-table-body');
  const createPromoForm = document.getElementById('create-promo-form');
  const promoCodeInput = document.getElementById('promo-code-input');
  const promoCoinsInput = document.getElementById('promo-coins-input');
  const promoItemSelect = document.getElementById('promo-item-select');
  const promoItemQtyInput = document.getElementById('promo-item-qty-input');
  const promoQuotaInput = document.getElementById('promo-quota-input');
  const promoExpiresInput = document.getElementById('promo-expires-input');

  async function fetchPromos() {
    if (!promosTableBody) return;
    try {
      const res = await secureFetch('/api/admin/promos');
      const data = await res.json();
      if (data.success) {
        renderPromos(data.promos);
      } else {
        showToast(data.message, 'error');
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') showToast('Gagal memuat kode promo', 'error');
    }
  }

  function renderPromos(promos) {
    if (promos.length === 0) {
      promosTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 20px; color: var(--color-text-muted);">
            ℹ️ Belum ada kode promo terdaftar di database.
          </td>
        </tr>
      `;
      return;
    }

    promosTableBody.innerHTML = promos.map(p => {
      const rewardCoins = p.reward_coins > 0 ? formatCurrency(p.reward_coins) : '-';
      const rewardItem = (p.reward_item_id && p.reward_item_qty > 0) ? `🎁 ${p.reward_item_qty}x ${p.reward_item_id}` : '-';
      
      let expiryText = '-';
      if (p.expires_at > 0) {
        const d = new Date(p.expires_at * 1000);
        const now = Date.now() / 1000;
        const expired = now > p.expires_at;
        expiryText = `<span class="${expired ? 'danger-text' : 'emerald-text'}">${d.toLocaleDateString('id-ID')} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}${expired ? ' (Expired)' : ''}</span>`;
      }

      return `
        <tr style="border-bottom: 1px solid var(--color-border);">
          <td style="padding: 10px; font-weight: bold; font-family: monospace;">${p.code}</td>
          <td style="padding: 10px;">${rewardCoins}</td>
          <td style="padding: 10px;">${rewardItem}</td>
          <td style="padding: 10px;">${p.current_claims} / ${p.max_claims === -1 ? '∞' : p.max_claims}</td>
          <td style="padding: 10px;">${expiryText}</td>
          <td style="padding: 10px; text-align: center;">
            <button class="btn btn-danger btn-sm delete-promo-btn" data-code="${p.code}">🗑️ Hapus</button>
          </td>
        </tr>
      `;
    }).join('');

    // Bind delete buttons
    document.querySelectorAll('.delete-promo-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const code = e.target.getAttribute('data-code');
        if (confirm(`Apakah Anda yakin ingin menghapus voucher "${code}" beserta log klaimnya?`)) {
          try {
            const res = await secureFetch('/api/admin/promos', {
              method: 'POST',
              body: JSON.stringify({ action: 'delete', code })
            });
            const data = await res.json();
            if (data.success) {
              showToast(data.message, 'success');
              if (window.SoundEffects) SoundEffects.playSuccess();
              fetchPromos();
            } else {
              showToast(data.message, 'error');
            }
          } catch (err) {
            if (err.message !== 'Unauthorized') showToast('Gagal menghapus kode promo', 'error');
          }
        }
      });
    });
  }

  if (createPromoForm) {
    createPromoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = promoCodeInput.value.trim();
      const coins = parseInt(promoCoinsInput.value, 10) || 0;
      const itemId = promoItemSelect.value || null;
      const itemQty = parseInt(promoItemQtyInput.value, 10) || 0;
      const quota = parseInt(promoQuotaInput.value, 10) || -1;
      const expiresHours = parseInt(promoExpiresInput.value, 10) || 0;

      if (!code) {
        showToast('Kode promo tidak boleh kosong!', 'error');
        return;
      }

      try {
        const res = await secureFetch('/api/admin/promos', {
          method: 'POST',
          body: JSON.stringify({
            action: 'create',
            code,
            coins,
            itemId,
            itemQty,
            quota,
            expiresHours
          })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
          if (window.SoundEffects) SoundEffects.playSuccess();
          createPromoForm.reset();
          fetchPromos();
        } else {
          showToast(data.message, 'error');
        }
      } catch (err) {
        if (err.message !== 'Unauthorized') showToast('Gagal membuat kode promo', 'error');
      }
    });
  }

  // --- Broadcast Terminal Logic ---
  const broadcastForm = document.getElementById('broadcast-form');
  const bcChannelPreset = document.getElementById('bc-channel-preset');
  const bcChannelIdInput = document.getElementById('bc-channel-id-input');
  const bcMessageInput = document.getElementById('bc-message-input');
  const broadcastsTableBody = document.getElementById('broadcasts-table-body');

  if (bcChannelPreset && bcChannelIdInput) {
    bcChannelPreset.addEventListener('change', () => {
      if (bcChannelPreset.value) {
        bcChannelIdInput.value = bcChannelPreset.value;
      }
    });
  }

  async function fetchBroadcasts() {
    if (!broadcastsTableBody) return;
    try {
      const res = await secureFetch('/api/admin/broadcast');
      const data = await res.json();
      if (data.success) {
        renderBroadcasts(data.broadcasts);
      } else {
        showToast(data.message, 'error');
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') showToast('Gagal memuat riwayat broadcast', 'error');
    }
  }

  function renderBroadcasts(broadcasts) {
    if (broadcasts.length === 0) {
      broadcastsTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 20px; color: var(--color-text-muted);">
            ℹ️ Belum ada riwayat broadcast di database.
          </td>
        </tr>
      `;
      return;
    }

    broadcastsTableBody.innerHTML = broadcasts.map(b => {
      const dateText = formatDate(new Date(b.created_at * 1000).toISOString());
      let statusBadge = '';
      if (b.status === 'PENDING') {
        statusBadge = '<span class="badge badge-gold">⏳ PENDING</span>';
      } else if (b.status === 'SENT') {
        statusBadge = '<span class="badge badge-emerald">✅ SENT</span>';
      } else {
        statusBadge = '<span class="badge badge-red">❌ FAILED</span>';
      }

      return `
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="padding: 10px; font-size: 12px; color: var(--color-text-muted);">${dateText}</td>
          <td style="padding: 10px; font-family: monospace; font-size: 12px;">${b.channel_id}</td>
          <td style="padding: 10px; font-size: 13px; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${b.message}">${b.message}</td>
          <td style="padding: 10px;">${statusBadge}</td>
          <td style="padding: 10px; font-size: 12px; color: var(--color-red);">${b.error_message || '-'}</td>
        </tr>
      `;
    }).join('');
  }

  if (broadcastForm) {
    broadcastForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const channelId = bcChannelIdInput.value.trim();
      const message = bcMessageInput.value.trim();

      if (!channelId || !message) {
        showToast('ID Saluran dan Pesan tidak boleh kosong!', 'error');
        return;
      }

      const submitBtn = broadcastForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'MENGIRIM BROADCAST...';

      try {
        const res = await secureFetch('/api/admin/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelId, message })
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
          if (window.SoundEffects) SoundEffects.playSuccess();
          bcMessageInput.value = '';
          fetchBroadcasts();
        } else {
          showToast(data.message, 'error');
        }
      } catch (err) {
        if (err.message !== 'Unauthorized') showToast('Gagal mengirim broadcast', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '⚡ KIRIM BROADCAST SEKARANG';
      }
    });
  }

  // --- Citizen Inventory Manager Logic ---
  const citizenInventoryList = document.getElementById('citizen-inventory-list');

  async function fetchAndDisplayInventory(userId) {
    if (!citizenInventoryList) return;
    citizenInventoryList.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--color-text-muted); padding: 8px;">Memuat inventory...</td></tr>';
    
    try {
      const res = await secureFetch(`/api/admin/inventory?userId=${userId}`);
      const data = await res.json();
      if (data.success) {
        renderInventoryList(userId, data.userInventory, data.petInventory);
      } else {
        citizenInventoryList.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--color-red); padding: 8px;">Gagal memuat: ${data.message}</td></tr>`;
      }
    } catch (err) {
      if (err.message !== 'Unauthorized') {
        citizenInventoryList.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--color-red); padding: 8px;">Koneksi error memuat inventory.</td></tr>';
      }
    }
  }

  function renderInventoryList(userId, userInv, petInv) {
    citizenInventoryList.innerHTML = '';
    
    if (userInv.length === 0 && petInv.length === 0) {
      citizenInventoryList.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--color-text-muted); padding: 8px;">Tas warga kosong (0 item).</td></tr>';
      return;
    }

    const allRows = [];

    const getAssetName = (id) => {
      const asset = availableAssets.find(a => a.id === id);
      return asset ? asset.name : id;
    };

    userInv.forEach(item => {
      allRows.push({
        id: item.item_id,
        name: getAssetName(item.item_id),
        type: '🎒 Tas Warga',
        category: 'item',
        quantity: item.quantity
      });
    });

    petInv.forEach(item => {
      allRows.push({
        id: item.item_id,
        name: getAssetName(item.item_id),
        type: '🐾 Item Pet',
        category: 'pet_item',
        quantity: item.quantity
      });
    });

    allRows.forEach(row => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border-color)';
      tr.innerHTML = `
        <td style="padding: 6px 10px; font-weight: 500; color: var(--color-text-light);">${row.name}</td>
        <td style="padding: 6px 10px; color: var(--color-text-muted);">${row.type}</td>
        <td style="padding: 6px 10px; text-align: center; font-weight: bold;">${row.quantity}</td>
        <td style="padding: 6px 10px; text-align: center;">
          <button class="btn btn-secondary btn-sm btn-inv-adjust" data-change="-1" style="padding: 2px 6px; font-size: 10px; min-width: 20px;">-</button>
          <button class="btn btn-secondary btn-sm btn-inv-adjust" data-change="1" style="padding: 2px 6px; font-size: 10px; min-width: 20px;">+</button>
        </td>
      `;

      tr.querySelectorAll('.btn-inv-adjust').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          const change = parseInt(btn.getAttribute('data-change'), 10);
          
          btn.disabled = true;
          try {
            const response = await secureFetch('/api/give', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: userId,
                category: row.category,
                target: row.id,
                amount: change
              })
            });

            const resData = await response.json();
            if (resData.success) {
              showToast(`${row.name} berhasil diubah!`, 'success');
              if (window.SoundEffects) SoundEffects.playSuccess();
              fetchAndDisplayInventory(userId);
            } else {
              showToast(resData.message, 'error');
              btn.disabled = false;
            }
          } catch {
            showToast('Gagal mengubah kuantitas item', 'error');
            btn.disabled = false;
          }
        });
      });

      citizenInventoryList.appendChild(tr);
    });
  }

  // Run passcode auth check on load
  checkAuth();
});

