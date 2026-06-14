const path = require('path');
const db = require('../stockmarket/database');

console.log("==================================================");
console.log("🧹 RESET PVP ARENA STANDINGS DATABASE SCRIPT");
console.log("==================================================\n");

try {
  // Truncate current player PvP standings
  const res1 = db.run("DELETE FROM user_pet_pvp_bot");
  console.log(`✅ Table 'user_pet_pvp_bot' cleared! (Changes: ${res1.changes})`);

  // Clear pvp season history / Hall of Fame
  const res2 = db.run("DELETE FROM pvp_season_history");
  console.log(`✅ Table 'pvp_season_history' cleared! (Changes: ${res2.changes})`);

  console.log("\n🎉 PvP Arena Standings has been successfully reset/restarted!");
} catch (err) {
  console.error("❌ Failed to reset PvP Standings:", err.message);
  process.exit(1);
}
