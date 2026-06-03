const database = require('../stockmarket/database');

const PET_ITEM_IDS = [
  'FOOD_BASIC', 'FOOD_PREMIUM', 'WATER', 'MEDICINE', 'TOY', 'SODA_ENERGY', 'SOAP_PET',
  'COLLAR_IRON', 'SWORD_TOY', 'SHIELD_TOY', 'LUCKY_AMULET',
  'XP_2X', 'XP_4X', 'XP_6X', 'XP_8X'
];

try {
  // 1. Move non-pet items from pet_inventory to user_inventory
  const placeholders = PET_ITEM_IDS.map(() => '?').join(', ');
  const selectNonPetQuery = `SELECT * FROM pet_inventory WHERE item_id NOT IN (${placeholders})`;
  const misplacedNonPet = database.all(selectNonPetQuery, PET_ITEM_IDS);
  
  console.log("Menemukan " + misplacedNonPet.length + " barang non-pet di pet_inventory:");
  
  database.transaction(() => {
    misplacedNonPet.forEach(row => {
      console.log(`Memindahkan ${row.item_id} x${row.quantity} milik User ID ${row.user_id} ke user_inventory`);
      
      // Check if already in user_inventory
      const exist = database.get(
        'SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?',
        [row.user_id, row.guild_id, row.item_id]
      );
      
      if (exist) {
        database.run(
          'UPDATE user_inventory SET quantity = quantity + ? WHERE user_id = ? AND guild_id = ? AND item_id = ?',
          [row.quantity, row.user_id, row.guild_id, row.item_id]
        );
      } else {
        database.run(
          'INSERT INTO user_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, ?, ?)',
          [row.user_id, row.guild_id, row.item_id, row.quantity]
        );
      }
      
      // Delete from pet_inventory
      database.run(
        'DELETE FROM pet_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?',
        [row.user_id, row.guild_id, row.item_id]
      );
    });
  })();

  // 2. Move pet items from user_inventory to pet_inventory
  const selectPetQuery = `SELECT * FROM user_inventory WHERE item_id IN (${placeholders})`;
  const misplacedPet = database.all(selectPetQuery, PET_ITEM_IDS);
  
  console.log("Menemukan " + misplacedPet.length + " pet items di user_inventory:");
  
  database.transaction(() => {
    misplacedPet.forEach(row => {
      console.log(`Memindahkan ${row.item_id} x${row.quantity} milik User ID ${row.user_id} ke pet_inventory`);
      
      // Check if already in pet_inventory
      const exist = database.get(
        'SELECT quantity FROM pet_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?',
        [row.user_id, row.guild_id, row.item_id]
      );
      
      if (exist) {
        database.run(
          'UPDATE pet_inventory SET quantity = quantity + ? WHERE user_id = ? AND guild_id = ? AND item_id = ?',
          [row.quantity, row.user_id, row.guild_id, row.item_id]
        );
      } else {
        database.run(
          'INSERT INTO pet_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, ?, ?)',
          [row.user_id, row.guild_id, row.item_id, row.quantity]
        );
      }
      
      // Delete from user_inventory
      database.run(
        'DELETE FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?',
        [row.user_id, row.guild_id, row.item_id]
      );
    });
  })();
  
  console.log("Selesai memigrasi data!");
} catch (e) {
  console.error("Gagal melakukan migrasi data:", e.message);
}
