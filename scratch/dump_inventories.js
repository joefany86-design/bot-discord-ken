const database = require('../stockmarket/database');

try {
  const userInv = database.all('SELECT * FROM user_inventory');
  console.log("=== USER INVENTORY ===");
  console.log(userInv);

  const petInv = database.all('SELECT * FROM pet_inventory');
  console.log("=== PET INVENTORY ===");
  console.log(petInv);
} catch (e) {
  console.error("Error dumping:", e.message);
}
