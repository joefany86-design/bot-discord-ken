const db = require('./database');
const economy = require('./economy');
const config = require('./config');
const { EmbedBuilder } = require('discord.js');

// Owner ID dari environment variable (fallback ke default)
const OWNER_ID = process.env.OWNER_ID || '436554535037698059';

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

  // Khusus OWNER: taruhan < 500 pasti kalah, >= 500 pasti menang
  let won = false;
  if (userId === OWNER_ID) {
    won = bet >= 500;
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
      newBalance = economy.getWallet(userId, guildId).balance;
    } else {
      economy.subtractBalance(userId, guildId, bet, 'CASINO_COINFLIP_LOSE');
      newBalance = economy.getWallet(userId, guildId).balance;
    }
  })();

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

module.exports = {
  coinflip
};
