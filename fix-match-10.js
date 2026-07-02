const path = require('path');
const fs = require('fs');

// Load environment variables
const dotenv = require('dotenv');
dotenv.config();

// Use the existing database connection to avoid SQLITE_BUSY locking conflicts
const { db } = require('./stockmarket/database');

const economy = require('./stockmarket/economy');
const config = require('./stockmarket/config');

// We need a transaction to run this safely
const runFix = db.transaction(() => {
  const matchId = 10;
  const oldScore = '0 - 0';
  const newScore = '1 - 1 (Pen: 2 - 3)';

  console.log(`\n--- Fetching all bets for Match ID ${matchId} ---`);
  const bets = db.prepare("SELECT * FROM worldcup_bets WHERE match_id = ?").all(matchId);
  console.log(`Found ${bets.length} total bets.`);

  // 1. Revert Old Payouts
  // Exact Score bets
  const exactBets = bets.filter(b => b.bet_type === 'exact_score');
  const exactPool = exactBets.reduce((sum, b) => sum + b.bet_amount, 0);
  const oldExactWinners = exactBets.filter(b => b.home_score === 0 && b.away_score === 0);

  if (exactBets.length > 0) {
    if (oldExactWinners.length > 0) {
      const totalWinningBets = oldExactWinners.reduce((sum, w) => sum + w.bet_amount, 0);
      oldExactWinners.forEach(w => {
        const payout = Math.floor((w.bet_amount / totalWinningBets) * exactPool);
        console.log(`Reverting exact score win payout of Rp ${payout} from User ${w.user_id}`);
        economy.subtractBalance(w.user_id, w.guild_id, payout, 'WORLDCUP_BET_REVERT');
      });
    } else {
      console.log(`Reverting exact score forfeit payout of Rp ${exactPool} from Owner ${config.OWNER_ID}`);
      for (const guildId of [...new Set(exactBets.map(b => b.guild_id))]) {
        economy.subtractBalance(config.OWNER_ID, guildId, exactPool, 'WORLDCUP_BET_REVERT');
      }
    }
  }

  // Outcome bets
  const outcomeBets = bets.filter(b => b.bet_type === 'outcome');
  const outcomePool = outcomeBets.reduce((sum, b) => sum + b.bet_amount, 0);
  const oldOutcomeWinners = outcomeBets.filter(b => b.predicted_outcome === 'draw');

  if (outcomeBets.length > 0) {
    if (oldOutcomeWinners.length > 0) {
      const totalWinningBets = oldOutcomeWinners.reduce((sum, w) => sum + w.bet_amount, 0);
      oldOutcomeWinners.forEach(w => {
        const payout = Math.floor((w.bet_amount / totalWinningBets) * outcomePool);
        console.log(`Reverting outcome win payout of Rp ${payout} from User ${w.user_id}`);
        economy.subtractBalance(w.user_id, w.guild_id, payout, 'WORLDCUP_BET_REVERT');
      });
    } else {
      console.log(`Reverting outcome forfeit payout of Rp ${outcomePool} from Owner ${config.OWNER_ID}`);
      const guilds = [...new Set(outcomeBets.map(b => b.guild_id))];
      guilds.forEach(guildId => {
        const guildOutcomePool = outcomeBets.filter(b => b.guild_id === guildId).reduce((sum, b) => sum + b.bet_amount, 0);
        economy.subtractBalance(config.OWNER_ID, guildId, guildOutcomePool, 'WORLDCUP_BET_REVERT');
      });
    }
  }

  // 2. Reset bet statuses back to 'pending'
  console.log("Resetting bet statuses to 'pending' in database...");
  db.prepare("UPDATE worldcup_bets SET status = 'pending' WHERE match_id = ?").run(matchId);

  // 3. Update Match Score in database
  console.log(`Updating match score in worldcup_match_scores to ${newScore}...`);
  db.prepare("INSERT OR REPLACE INTO worldcup_match_scores (match_id, score, status) VALUES (?, ?, ?)")
    .run(matchId, newScore, 'Selesai');

  // 4. Run resolveMatchBets to recalculate and distribute payouts
  console.log("Resolving bets with correct results...");
  const worldcup = require('./stockmarket/worldcup');
  worldcup.resolveMatchBets(null, matchId, newScore);

  console.log("Fix completed successfully!");
});

try {
  runFix.immediate();
} catch (error) {
  console.error("Failed to run fix transaction:", error);
}
