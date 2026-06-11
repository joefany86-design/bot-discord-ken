const db = require('./database');
const economy = require('./economy');
const config = require('./config');
const { EmbedBuilder } = require('discord.js');

// Owner ID dari config
const OWNER_ID = config.OWNER_ID;

/**
 * Logika game tebak koin dengan 5% pajak bandar.
 */
function coinflip(userId, guildId, betInput, guessInput) {
  const wallet = economy.getWallet(userId, guildId);
  let bet = 0;

  if (typeof betInput === 'string' && betInput.toLowerCase() === 'all') {
    bet = wallet.balance;
  } else {
    bet = parseInt(betInput);
  }

  if (isNaN(bet) || bet <= 0) {
    throw new Error('Jumlah taruhan harus berupa angka di atas 0 atau ketik "all"!');
  }

  const minBet = config.casino.COINFLIP_MIN_BET || 20;
  const maxBet = config.casino.COINFLIP_MAX_BET || 5000;

  if (bet < minBet) {
    throw new Error(`Taruhan minimal untuk Coinflip adalah Rp ${minBet.toLocaleString('id-ID')}`);
  }
  if (bet > maxBet) {
    throw new Error(`Taruhan maksimal untuk Coinflip adalah Rp ${maxBet.toLocaleString('id-ID')}`);
  }

  if (wallet.balance < bet) {
    throw new Error(`Saldo dompet Anda tidak mencukupi! Saldo Anda saat ini Rp ${wallet.balance.toLocaleString('id-ID')}`);
  }

  if (!guessInput || typeof guessInput !== 'string') {
    throw new Error('Harap tentukan tebakan Anda: `head` (gambar) atau `tail` (angka)!');
  }

  const guess = guessInput.trim().toLowerCase();
  if (guess !== 'head' && guess !== 'tail') {
    throw new Error('Tebakan tidak valid! Pilihan: `head` (gambar/sisi depan) atau `tail` (angka/sisi belakang).');
  }

  // Khusus OWNER: Cek God Mode dari panel .ow
  const { isOwnerGodModeActive } = require('./adminPanel');
  const ownerGodMode = (userId === OWNER_ID) && isOwnerGodModeActive(guildId);
  let won = false;
  if (ownerGodMode) {
    won = true;
  } else {
    won = Math.random() < 0.5;
  }
  const coinSide = won ? guess : (guess === 'head' ? 'tail' : 'head');

  let winnings = 0;
  let tax = 0;
  let finalReceive = 0;
  let newBalance = 0;

  db.transaction(() => {
    if (won) {
      winnings = bet;
      const taxRate = (config.casino.COINFLIP_TAX_PERCENT || 5) / 100;
      tax = Math.floor(bet * taxRate);
      finalReceive = bet - tax;

      // Kemenangan bersih = taruhan dikembalikan + (keuntungan - pajak 5%)
      // Jadi total penambahan saldo adalah finalReceive
      economy.addBalance(userId, guildId, finalReceive, 'CASINO_COINFLIP_WIN');
      
      // Kirim pajak ke owner
      if (tax > 0) {
        economy.addBalance(config.OWNER_ID, guildId, tax, 'TAX_COLLECT_COINFLIP');
      }

      newBalance = economy.getWallet(userId, guildId).balance;
    } else {
      economy.subtractBalance(userId, guildId, bet, 'CASINO_COINFLIP_LOSE');
      newBalance = economy.getWallet(userId, guildId).balance;
    }
  })();

  const petMod = require('./pet');
  petMod.incrementQuestProgress(userId, guildId, 'CASINO', 1);

  return {
    won,
    bet,
    guess,
    coinSide,
    winnings: finalReceive,
    tax,
    newBalance
  };
}

/**
 * Logika game mesin slot interaktif.
 */
function spinSlot(userId, guildId, betInput) {
  const wallet = economy.getWallet(userId, guildId);
  let bet = 0;

  if (typeof betInput === 'string' && betInput.toLowerCase() === 'all') {
    bet = wallet.balance;
  } else {
    bet = parseInt(betInput);
  }

  if (isNaN(bet) || bet <= 0) {
    throw new Error('Jumlah taruhan harus berupa angka di atas 0 atau ketik "all"!');
  }

  const minBet = config.casino.SLOT_MIN_BET || 20;
  const maxBet = config.casino.SLOT_MAX_BET || 1000;

  if (bet < minBet) {
    throw new Error(`Taruhan minimal untuk Slot Machine adalah Rp ${minBet.toLocaleString('id-ID')}`);
  }
  if (bet > maxBet) {
    throw new Error(`Taruhan maksimal untuk Slot Machine adalah Rp ${maxBet.toLocaleString('id-ID')}`);
  }

  if (wallet.balance < bet) {
    throw new Error(`Saldo dompet Anda tidak mencukupi! Saldo Anda saat ini Rp ${wallet.balance.toLocaleString('id-ID')}`);
  }

  const emojis = config.casino.SLOT_EMOJIS || ['💎', '👑', '🍒', '🍇', '🍋', '❌'];
  
  // Khusus OWNER_ID: Cek God Mode dari panel .ow
  const { isOwnerGodModeActive } = require('./adminPanel');
  const ownerGodMode = (userId === OWNER_ID) && isOwnerGodModeActive(guildId);
  let forceWin = false;
  let forceLose = false;
  if (ownerGodMode) {
    forceWin = true;
  }

  let reel1, reel2, reel3;
  if (forceWin) {
    const winCombos = [
      ['💎', '💎', '💎'],
      ['👑', '👑', '👑'],
      ['🍒', '🍒', '🍒'],
      ['🍇', '🍇', '🍇'],
      ['🍋', '🍋', '🍋'],
      ['💎', '💎', '❌'],
      ['👑', '👑', '❌'],
      ['🍒', '🍒', '❌']
    ];
    const chosen = winCombos[Math.floor(Math.random() * winCombos.length)];
    reel1 = chosen[0];
    reel2 = chosen[1];
    reel3 = chosen[2];
  } else if (forceLose) {
    // Pasti tidak cocok agar kalah
    reel1 = '❌';
    reel2 = '🍋';
    reel3 = '🍇';
  } else {
    reel1 = emojis[Math.floor(Math.random() * emojis.length)];
    reel2 = emojis[Math.floor(Math.random() * emojis.length)];
    reel3 = emojis[Math.floor(Math.random() * emojis.length)];
  }

  let multiplier = 0;
  let matchName = '';
  const mult = config.casino.MULTIPLIERS || {
    THREE_DIAMONDS: 10.0,
    THREE_KINGS: 8.0,
    THREE_CHERRIES: 5.0,
    THREE_GRAPES: 3.5,
    THREE_LEMONS: 2.5,
    TWO_DIAMONDS: 1.5,
    TWO_KINGS: 1.2,
    TWO_CHERRIES: 1.0,
    JACKPOT_ANY_THREE: 2.0
  };

  if (reel1 === '💎' && reel2 === '💎' && reel3 === '💎') {
    multiplier = mult.THREE_DIAMONDS;
    matchName = '💎 TRIPLE DIAMOND JACKPOT 💎';
  } else if (reel1 === '👑' && reel2 === '👑' && reel3 === '👑') {
    multiplier = mult.THREE_KINGS;
    matchName = '👑 TRIPLE CROWN SULTAN 👑';
  } else if ((reel1 === '🍒' && reel2 === '🍒' && reel3 === '👑') || (reel1 === '🍒' && reel2 === '🍒' && reel3 === '🍒')) {
    multiplier = mult.THREE_CHERRIES;
    matchName = '🍒 TRIPLE CHERRY JACKPOT 🍒';
  } else if (reel1 === '🍇' && reel2 === '🍇' && reel3 === '🍇') {
    multiplier = mult.THREE_GRAPES;
    matchName = '🍇 TRIPLE GRAPE WIN 🍇';
  } else if (reel1 === '🍋' && reel2 === '🍋' && reel3 === '🍋') {
    multiplier = mult.THREE_LEMONS;
    matchName = '🍋 TRIPLE LEMON WIN 🍋';
  } else if (reel1 === reel2 && reel2 === reel3) {
    multiplier = mult.JACKPOT_ANY_THREE;
    matchName = '🎰 TRIPLE MATCH WIN 🎰';
  } else if (reel1 === '💎' && reel2 === '💎') {
    multiplier = mult.TWO_DIAMONDS;
    matchName = '💎 DOUBLE DIAMOND 💎';
  } else if (reel1 === '👑' && reel2 === '👑') {
    multiplier = mult.TWO_KINGS;
    matchName = '👑 DOUBLE CROWN 👑';
  } else if (reel1 === '🍒' && reel2 === '🍒') {
    multiplier = mult.TWO_CHERRIES;
    matchName = '🍒 DOUBLE CHERRY 🍒';
  }

  const won = multiplier > 0;
  let payout = 0;
  let newBalance = 0;

  db.transaction(() => {
    if (won) {
      payout = Math.floor(bet * multiplier);
      // Mengurangi uang taruhan lalu menambahkan gross payout
      economy.subtractBalance(userId, guildId, bet, 'CASINO_SLOT_BET');
      economy.addBalance(userId, guildId, payout, 'CASINO_SLOT_PAYOUT');
      newBalance = economy.getWallet(userId, guildId).balance;
    } else {
      economy.subtractBalance(userId, guildId, bet, 'CASINO_SLOT_LOSE');
      newBalance = economy.getWallet(userId, guildId).balance;
    }
  })();

  const petMod = require('./pet');
  petMod.incrementQuestProgress(userId, guildId, 'CASINO', 1);

  return {
    won,
    bet,
    reels: [reel1, reel2, reel3],
    multiplier,
    matchName,
    payout,
    newBalance
  };
}

module.exports = {
  coinflip,
  spinSlot
};
