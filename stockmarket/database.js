const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

// Tentukan path database dan pastikan foldernya ada
let finalDbPath = config.DATABASE_PATH;
let dbDir = path.dirname(finalDbPath);
let db;

try {
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`📁 Folder database dibuat di: ${dbDir}`);
  }
  db = new Database(finalDbPath);
} catch (error) {
  console.warn(`⚠️ Gagal mengakses database di '${finalDbPath}' (${error.message}). Menggunakan fallback database lokal...`);
  // Fallback ke path lokal
  finalDbPath = path.join(__dirname, '../data/economy.db');
  dbDir = path.dirname(finalDbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`📁 Folder database lokal dibuat di: ${dbDir}`);
  }
  db = new Database(finalDbPath);
}

console.log(`✅ Database SQLite terhubung di: ${finalDbPath}`);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// Inisialisasi Tabel
function initSchema() {
  // 1. Wallets (Saldo & Profil Ekonomi per Guild)
  db.exec(`
    CREATE TABLE IF NOT EXISTS wallets (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      balance INTEGER DEFAULT 0,
      total_earned INTEGER DEFAULT 0,
      total_invested INTEGER DEFAULT 0,
      last_message_at INTEGER DEFAULT 0,
      streak_days INTEGER DEFAULT 0,
      last_active_date TEXT DEFAULT '',
      created_at INTEGER DEFAULT (strftime('%s','now')),
      PRIMARY KEY (user_id, guild_id)
    )
  `);

  // 1b. Migrasi dinamis: Tambahkan kolom auto_trade jika belum ada
  try {
    db.exec("ALTER TABLE wallets ADD COLUMN auto_trade INTEGER DEFAULT 0");
    console.log("⚡ [Database] Kolom 'auto_trade' berhasil ditambahkan/diverifikasi di tabel wallets.");
  } catch (e) {
    // Kolom sudah ada
  }

  // 1c. Migrasi dinamis: Tambahkan kolom jail_until jika belum ada
  try {
    db.exec("ALTER TABLE wallets ADD COLUMN jail_until INTEGER DEFAULT 0");
    console.log("⚡ [Database] Kolom 'jail_until' berhasil ditambahkan/diverifikasi di tabel wallets.");
  } catch (e) {
    // Kolom sudah ada
  }

  // 1d. Migrasi dinamis: Tambahkan kolom jail_type jika belum ada
  try {
    db.exec("ALTER TABLE wallets ADD COLUMN jail_type TEXT DEFAULT ''");
    console.log("⚡ [Database] Kolom 'jail_type' berhasil ditambahkan/diverifikasi di tabel wallets.");
  } catch (e) {
    // Kolom sudah ada
  }

  // 2. Stocks (Data Saham Channel per Guild)
  db.exec(`
    CREATE TABLE IF NOT EXISTS stocks (
      channel_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      stock_name TEXT NOT NULL,
      stock_ticker TEXT NOT NULL,
      current_price INTEGER DEFAULT 100,
      previous_price INTEGER DEFAULT 100,
      total_shares INTEGER DEFAULT 1000,
      available_shares INTEGER DEFAULT 1000,
      activity_score REAL DEFAULT 0.0,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (strftime('%s','now')),
      PRIMARY KEY (channel_id, guild_id)
    )
  `);

  // 3. Portfolios (Portofolio Investor per Guild)
  db.exec(`
    CREATE TABLE IF NOT EXISTS portfolios (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      shares INTEGER DEFAULT 0,
      avg_buy_price INTEGER DEFAULT 0,
      total_invested INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, guild_id, channel_id)
    )
  `);

  // 4. Transactions (Riwayat Transaksi)
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      type TEXT NOT NULL, -- 'BUY', 'SELL', 'EARN', 'DAILY', 'TRANSFER_IN', 'TRANSFER_OUT', 'DIVIDEND'
      channel_id TEXT,
      amount INTEGER NOT NULL,
      shares INTEGER DEFAULT 0,
      price_per_share INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    )
  `);

  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_transactions_user_guild ON transactions (user_id, guild_id)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_transactions_guild ON transactions (guild_id)");
    console.log("⚡ [Database] Index untuk tabel 'transactions' berhasil diverifikasi/dibuat.");
  } catch (e) {
    console.error("❌ [Database] Gagal membuat index pada tabel transactions:", e.message);
  }

  // 5. Price History (Untuk chart pergerakan harga saham)
  db.exec(`
    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      price INTEGER NOT NULL,
      activity_score REAL NOT NULL,
      recorded_at INTEGER DEFAULT (strftime('%s','now'))
    )
  `);

  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_price_history_channel_guild ON price_history (channel_id, guild_id)");
    console.log("⚡ [Database] Index untuk tabel 'price_history' berhasil diverifikasi/dibuat.");
  } catch (e) {
    console.error("❌ [Database] Gagal membuat index pada tabel price_history:", e.message);
  }

  // 6. Shop Items (Toko Role Discord Gamified)
  db.exec(`
    CREATE TABLE IF NOT EXISTS shop_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      role_name TEXT NOT NULL,
      price INTEGER NOT NULL,
      tier TEXT DEFAULT 'COMMON',
      stock INTEGER DEFAULT -1,
      is_gacha INTEGER DEFAULT 0,
      description TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    )
  `);

  // 7. Active Events (Untuk menyimpan event berdurasi aktif per guild)
  db.exec(`
    CREATE TABLE IF NOT EXISTS active_events (
      guild_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      ends_at INTEGER NOT NULL,
      PRIMARY KEY (guild_id)
    )
  `);

  // 8. Bank Savings (Untuk sistem tabungan berbunga)
  db.exec(`
    CREATE TABLE IF NOT EXISTS bank_savings (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      balance INTEGER DEFAULT 0,
      last_interest_at INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now')),
      PRIMARY KEY (user_id, guild_id)
    )
  `);

  // 9. Bank Loans (Untuk sistem pinjaman berjangka tempo)
  db.exec(`
    CREATE TABLE IF NOT EXISTS bank_loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      principal_amount INTEGER NOT NULL,
      interest_rate REAL NOT NULL,
      total_due INTEGER NOT NULL,
      penalty_accumulated INTEGER DEFAULT 0,
      tenor_days INTEGER NOT NULL,
      due_at INTEGER NOT NULL,
      status TEXT DEFAULT 'ACTIVE',
      created_at INTEGER DEFAULT (strftime('%s','now'))
    )
  `);

  // 10. Kos Rentals (Untuk melacak durasi sewa kamar berdurasi)
  db.exec(`
    CREATE TABLE IF NOT EXISTS kos_rentals (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      room_tier TEXT NOT NULL,
      ends_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, guild_id)
    )
  `);

  // 11. Kos Upgrades (Untuk melacak upgrade kamar permanen yang dibeli)
  db.exec(`
    CREATE TABLE IF NOT EXISTS kos_upgrades (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      upgrade_id TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s','now')),
      PRIMARY KEY (user_id, guild_id, upgrade_id)
    )
  `);

  // 12. User Pets (Sistem Tamagotchi Pet)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_pets (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      pet_name TEXT NOT NULL,
      pet_type TEXT NOT NULL,
      status TEXT DEFAULT 'EGG',
      level INTEGER DEFAULT 1,
      xp INTEGER DEFAULT 0,
      health INTEGER DEFAULT 100,
      hunger INTEGER DEFAULT 100,
      thirst INTEGER DEFAULT 100,
      happiness INTEGER DEFAULT 100,
      last_interaction_at INTEGER DEFAULT (strftime('%s','now')),
      last_work_at INTEGER DEFAULT 0,
      last_hunt_at INTEGER DEFAULT 0,
      hatch_at INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s','now')),
      last_play_at INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, guild_id, pet_name)
    )
  `);

  // 13. Pet Inventory (Stok makanan & obat-obatan pet)
  db.exec(`
    CREATE TABLE IF NOT EXISTS pet_inventory (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      quantity INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, guild_id, item_id)
    )
  `);

  // 14. Heist Cooldown (Untuk sistem perampokan bersama)
  db.exec(`
    CREATE TABLE IF NOT EXISTS heist_cooldown (
      guild_id TEXT NOT NULL PRIMARY KEY,
      last_heist_at INTEGER DEFAULT 0
    )
  `);

  // 15. Ebyus Settings (Admin Abuse / Sabotase)
  db.exec(`
    CREATE TABLE IF NOT EXISTS ebyus_settings (
      guild_id TEXT PRIMARY KEY,
      gacha_mode TEXT DEFAULT 'NORMAL',
      coin_multiplier INTEGER DEFAULT 1,
      updated_at INTEGER DEFAULT 0,
      updated_by TEXT,
      expires_at INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 0
    )
  `);

  // Migrasi dinamis: Tambahkan kolom is_active ke ebyus_settings jika belum ada
  try {
    db.exec("ALTER TABLE ebyus_settings ADD COLUMN is_active INTEGER DEFAULT 0");
    console.log("⚡ [Database] Kolom 'is_active' berhasil diverifikasi/ditambahkan di tabel ebyus_settings.");
  } catch (e) {
    // Kolom sudah ada
  }

  // Migrasi dinamis: Tambahkan kolom expires_at ke ebyus_settings jika belum ada
  try {
    db.exec("ALTER TABLE ebyus_settings ADD COLUMN expires_at INTEGER DEFAULT 0");
    console.log("⚡ [Database] Kolom 'expires_at' berhasil diverifikasi/ditambahkan di tabel ebyus_settings.");
  } catch (e) {
    // Kolom sudah ada
  }

  // Migrasi dinamis: Tambahkan kolom admin_panel_channel_id ke ebyus_settings jika belum ada
  try {
    db.exec("ALTER TABLE ebyus_settings ADD COLUMN admin_panel_channel_id TEXT");
    console.log("⚡ [Database] Kolom 'admin_panel_channel_id' berhasil diverifikasi/ditambahkan di tabel ebyus_settings.");
  } catch (e) {
    // Kolom sudah ada
  }

  // Migrasi dinamis: Tambahkan kolom last_play_at ke user_pets jika belum ada
  try {
    db.exec("ALTER TABLE user_pets ADD COLUMN last_play_at INTEGER DEFAULT 0");
    console.log("⚡ [Database] Kolom 'last_play_at' berhasil diverifikasi/ditambahkan di tabel user_pets.");
  } catch (e) {
    // Kolom sudah ada
  }

  // Migrasi dinamis: Tambahkan kolom jail_count ke wallets jika belum ada
  try {
    db.exec("ALTER TABLE wallets ADD COLUMN jail_count INTEGER DEFAULT 0");
    console.log("⚡ [Database] Kolom 'jail_count' berhasil diverifikasi/ditambahkan di tabel wallets.");
  } catch (e) {
    // Kolom sudah ada
  }

  // Migrasi dinamis: Tambahkan tabel bail_debts jika belum ada
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS bail_debts (
        guild_id TEXT NOT NULL,
        debtor_id TEXT NOT NULL,
        creditor_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s','now')),
        PRIMARY KEY (guild_id, debtor_id, creditor_id)
      )
    `);
    console.log("⚡ [Database] Tabel 'bail_debts' berhasil diverifikasi/dibuat.");
  } catch (e) {
    console.error("❌ [Database] Gagal membuat tabel bail_debts:", e.message);
  }

  // Migrasi dinamis: Tambahkan kolom is_active dan ubah PRIMARY KEY ke (user_id, guild_id, pet_name) jika belum ada
  try {
    const columns = db.prepare("PRAGMA table_info(user_pets)").all();
    const hasIsActive = columns.some(col => col.name === 'is_active');
    if (!hasIsActive) {
      console.log("⚡ [Database] Melakukan migrasi user_pets ke skema multi-pet...");
      db.transaction(() => {
        // 1. Rename tabel lama
        db.exec("ALTER TABLE user_pets RENAME TO user_pets_old");
        
        // 2. Buat tabel baru dengan primary key (user_id, guild_id, pet_name)
        db.exec(`
          CREATE TABLE user_pets (
            user_id TEXT NOT NULL,
            guild_id TEXT NOT NULL,
            pet_name TEXT NOT NULL,
            pet_type TEXT NOT NULL,
            status TEXT DEFAULT 'EGG',
            level INTEGER DEFAULT 1,
            xp INTEGER DEFAULT 0,
            health INTEGER DEFAULT 100,
            hunger INTEGER DEFAULT 100,
            thirst INTEGER DEFAULT 100,
            happiness INTEGER DEFAULT 100,
            last_interaction_at INTEGER DEFAULT (strftime('%s','now')),
            last_work_at INTEGER DEFAULT 0,
            last_hunt_at INTEGER DEFAULT 0,
            hatch_at INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (strftime('%s','now')),
            last_play_at INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, guild_id, pet_name)
          )
        `);

        // 3. Salin data dari tabel lama ke baru, set is_active = 1 untuk pet lama
        db.exec(`
          INSERT INTO user_pets (
            user_id, guild_id, pet_name, pet_type, status, level, xp, health, hunger, thirst, happiness, 
            last_interaction_at, last_work_at, last_hunt_at, hatch_at, created_at, last_play_at, is_active
          )
          SELECT 
            user_id, guild_id, pet_name, pet_type, status, level, xp, health, hunger, thirst, happiness, 
            last_interaction_at, last_work_at, last_hunt_at, hatch_at, created_at, COALESCE(last_play_at, 0), 1
          FROM user_pets_old
        `);

        // 4. Hapus tabel lama
        db.exec("DROP TABLE user_pets_old");
      })();
      console.log("✅ [Database] Migrasi tabel user_pets selesai dengan sukses.");
    }
  } catch (err) {
    console.error("❌ [Database] Gagal melakukan migrasi user_pets:", err.message);
  }

  // 16. User General Inventory (Black Market & future items)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_inventory (
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        quantity INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, guild_id, item_id)
      )
    `);
    console.log("⚡ [Database] Tabel 'user_inventory' berhasil diverifikasi/dibuat.");
  } catch (e) {
    console.error("❌ [Database] Gagal membuat tabel user_inventory:", e.message);
  }

  // 17. Migrasi dinamis: Tambahkan kolom trait ke user_pets jika belum ada
  try {
    db.exec("ALTER TABLE user_pets ADD COLUMN trait TEXT DEFAULT ''");
    console.log("⚡ [Database] Kolom 'trait' berhasil diverifikasi/ditambahkan di tabel user_pets.");
  } catch (e) {
    // Kolom sudah ada
  }

  // 18. Migrasi dinamis: Tambahkan kolom last_breed_at ke user_pets jika belum ada
  try {
    db.exec("ALTER TABLE user_pets ADD COLUMN last_breed_at INTEGER DEFAULT 0");
    console.log("⚡ [Database] Kolom 'last_breed_at' berhasil diverifikasi/ditambahkan di tabel user_pets.");
  } catch (e) {
    // Kolom sudah ada
  }

  // 19. Migrasi dinamis: Tambahkan kolom daily_expedition_count ke wallets jika belum ada
  try {
    db.exec("ALTER TABLE wallets ADD COLUMN daily_expedition_count INTEGER DEFAULT 0");
    console.log("⚡ [Database] Kolom 'daily_expedition_count' berhasil diverifikasi/ditambahkan di tabel wallets.");
  } catch (e) {
    // Kolom sudah ada
  }

  // 20. Migrasi dinamis: Tambahkan kolom last_expedition_date ke wallets jika belum ada
  try {
    db.exec("ALTER TABLE wallets ADD COLUMN last_expedition_date TEXT DEFAULT ''");
    console.log("⚡ [Database] Kolom 'last_expedition_date' berhasil diverifikasi/ditambahkan di tabel wallets.");
  } catch (e) {
    // Kolom sudah ada
  }

  // 21. Migrasi dinamis: Tambahkan kolom xp_multiplier ke user_pets jika belum ada
  try {
    db.exec("ALTER TABLE user_pets ADD COLUMN xp_multiplier REAL DEFAULT 1.0");
    console.log("⚡ [Database] Kolom 'xp_multiplier' berhasil diverifikasi/ditambahkan di tabel user_pets.");
  } catch (e) {
    // Kolom sudah ada
  }

  // 22. Migrasi dinamis: Tambahkan kolom pvp_wins ke user_pets jika belum ada
  try {
    db.exec("ALTER TABLE user_pets ADD COLUMN pvp_wins INTEGER DEFAULT 0");
    console.log("⚡ [Database] Kolom 'pvp_wins' berhasil diverifikasi/ditambahkan di tabel user_pets.");
  } catch (e) {
    // Kolom sudah ada
  }

  // 23. Migrasi dinamis: Tambahkan kolom pvp_losses ke user_pets jika belum ada
  try {
    db.exec("ALTER TABLE user_pets ADD COLUMN pvp_losses INTEGER DEFAULT 0");
    console.log("⚡ [Database] Kolom 'pvp_losses' berhasil diverifikasi/ditambahkan di tabel user_pets.");
  } catch (e) {
    // Kolom sudah ada
  }

  // 24. Migrasi dinamis: Tambahkan kolom expedition_cooldown_until ke wallets jika belum ada
  try {
    db.exec("ALTER TABLE wallets ADD COLUMN expedition_cooldown_until INTEGER DEFAULT 0");
    console.log("⚡ [Database] Kolom 'expedition_cooldown_until' berhasil diverifikasi/ditambahkan di tabel wallets.");
  } catch (e) {
    // Kolom sudah ada
  }

  // 25. Migrasi dinamis: Tambahkan kolom auto_feed ke user_pets jika belum ada
  try {
    db.exec("ALTER TABLE user_pets ADD COLUMN auto_feed INTEGER DEFAULT 0");
    console.log("⚡ [Database] Kolom 'auto_feed' berhasil diverifikasi/ditambahkan di tabel user_pets.");
  } catch (e) {
    // Kolom sudah ada
  }

  // 26. Migrasi dinamis: Tambahkan kolom custom_image ke user_pets jika belum ada
  try {
    db.exec("ALTER TABLE user_pets ADD COLUMN custom_image TEXT DEFAULT NULL");
    console.log("⚡ [Database] Kolom 'custom_image' berhasil diverifikasi/ditambahkan di tabel user_pets.");
  } catch (e) {
    // Kolom sudah ada
  }

  // 27. Migrasi dinamis: Tambahkan kolom last_water_at ke wallets jika belum ada
  try {
    db.exec("ALTER TABLE wallets ADD COLUMN last_water_at INTEGER DEFAULT 0");
    console.log("⚡ [Database] Kolom 'last_water_at' berhasil diverifikasi/ditambahkan di tabel wallets.");
  } catch (e) {
    // Kolom sudah ada
  }

  // 28. Migrasi dinamis: Tambahkan tabel garden_slots jika belum ada
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS garden_slots (
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        slot_index INTEGER NOT NULL, -- Slot 1, 2, atau 3
        seed_id TEXT DEFAULT NULL,   -- ID Benih (SEED_ROSE, dll)
        planted_at INTEGER DEFAULT 0, -- Unix timestamp detik ditanam
        last_watered_at INTEGER DEFAULT 0, -- Unix timestamp terakhir disiram
        water_count INTEGER DEFAULT 0, -- Berapa kali sudah disiram
        PRIMARY KEY (user_id, guild_id, slot_index)
      )
    `);
    console.log("⚡ [Database] Tabel 'garden_slots' berhasil diverifikasi/dibuat.");
  } catch (e) {
    console.error("❌ [Database] Gagal membuat tabel garden_slots:", e.message);
  }

  // 29. Migrasi dinamis: Tambahkan kolom force_trend ke tabel stocks jika belum ada
  try {
    db.exec("ALTER TABLE stocks ADD COLUMN force_trend TEXT DEFAULT 'NONE'");
    console.log("⚡ [Database] Kolom 'force_trend' berhasil diverifikasi/ditambahkan di tabel stocks.");
  } catch (e) {
    // Kolom sudah ada
  }

  // 30. Migrasi dinamis: Tambahkan kolom force_until ke tabel stocks jika belum ada
  try {
    db.exec("ALTER TABLE stocks ADD COLUMN force_until INTEGER DEFAULT 0");
    console.log("⚡ [Database] Kolom 'force_until' berhasil diverifikasi/ditambahkan di tabel stocks.");
  } catch (e) {
    // Kolom sudah ada
  }

  // 31. Migrasi dinamis: Batasi total saham beredar per channel di bursa sejumlah 500 lembar
  try {
    const needBursaCap = db.prepare("SELECT 1 FROM stocks WHERE total_shares != 500 LIMIT 1").get();
    if (needBursaCap) {
      db.transaction(() => {
        db.prepare(`
          UPDATE stocks 
          SET total_shares = 500,
              available_shares = 500 - COALESCE((
                SELECT SUM(shares) 
                FROM portfolios 
                WHERE portfolios.channel_id = stocks.channel_id AND portfolios.guild_id = stocks.guild_id
              ), 0)
        `).run();
      })();
      console.log("⚡ [Database] Batasi total_shares bursa saham ke 500 lembar & hitung ulang available_shares BERHASIL!");
    }
  } catch (e) {
    console.error("❌ [Database] Gagal membatasi total_shares bursa saham:", e.message);
  }

  // 32. Migrasi dinamis: Tambahkan kolom curse_type dan curse_until di tabel user_pets jika belum ada
  try {
    db.exec("ALTER TABLE user_pets ADD COLUMN curse_type TEXT DEFAULT ''");
    db.exec("ALTER TABLE user_pets ADD COLUMN curse_until INTEGER DEFAULT 0");
  } catch (e) {
    // Kolom sudah ada
  }

  // 33. Migrasi dinamis: Tambahkan kolom curse_type dan curse_until di tabel wallets jika belum ada
  try {
    db.exec("ALTER TABLE wallets ADD COLUMN curse_type TEXT DEFAULT ''");
    db.exec("ALTER TABLE wallets ADD COLUMN curse_until INTEGER DEFAULT 0");
  } catch (e) {
    // Kolom sudah ada
  }

  // 34. (DIHAPUS) Migrasi harga saham ke 10.000 sudah tidak diperlukan lagi.
  // Harga saham kini dikelola oleh scheduler dan admin secara dinamis.

  // 35. Tabel Misi Harian Pet
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_daily_quests (
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        quest_date TEXT NOT NULL,
        quest_1_type TEXT NOT NULL,
        quest_1_progress INTEGER DEFAULT 0,
        quest_1_target INTEGER NOT NULL,
        quest_2_type TEXT NOT NULL,
        quest_2_progress INTEGER DEFAULT 0,
        quest_2_target INTEGER NOT NULL,
        quest_3_type TEXT NOT NULL,
        quest_3_progress INTEGER DEFAULT 0,
        quest_3_target INTEGER NOT NULL,
        reward_claimed INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, guild_id, quest_date)
      )
    `);
    console.log("⚡ [Database] Tabel 'user_daily_quests' berhasil diverifikasi/dibuat.");
  } catch (e) {
    console.error("❌ [Database] Gagal membuat tabel user_daily_quests:", e.message);
  }

  // 36. Tabel Lotre Mingguan
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS lottery_pool (
        guild_id TEXT NOT NULL,
        total_pool INTEGER DEFAULT 0,
        total_tickets INTEGER DEFAULT 0,
        week_start TEXT NOT NULL,
        PRIMARY KEY (guild_id, week_start)
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS lottery_tickets (
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        ticket_count INTEGER DEFAULT 0,
        week_start TEXT NOT NULL,
        PRIMARY KEY (user_id, guild_id, week_start)
      )
    `);
    console.log("⚡ [Database] Tabel 'lottery_pool' & 'lottery_tickets' berhasil diverifikasi/dibuat.");
  } catch (e) {
    console.error("❌ [Database] Gagal membuat tabel lottery:", e.message);
  }

  // 37. Migrasi dinamis: Tambahkan kolom baru untuk pet update (soda_today, accessory, last_soda_reset_at)
  try {
    db.exec("ALTER TABLE user_pets ADD COLUMN soda_today INTEGER DEFAULT 0");
  } catch (e) {
    // Kolom sudah ada
  }
  try {
    db.exec("ALTER TABLE user_pets ADD COLUMN accessory TEXT DEFAULT NULL");
  } catch (e) {
    // Kolom sudah ada
  }
  try {
    db.exec("ALTER TABLE user_pets ADD COLUMN last_soda_reset_at INTEGER DEFAULT 0");
  } catch (e) {
    // Kolom sudah ada
  }

  // 38. Migrasi dinamis: Tambahkan tabel pet_item_cooldowns jika belum ada
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS pet_item_cooldowns (
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        last_used_at INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, guild_id, item_id)
      )
    `);
    console.log("⚡ [Database] Tabel 'pet_item_cooldowns' berhasil diverifikasi/dibuat.");
  } catch (e) {
    console.error("❌ [Database] Gagal membuat tabel pet_item_cooldowns:", e.message);
  }

  // 39. Migrasi dinamis: Tambahkan kolom last_rob_at ke wallets jika belum ada
  try {
    db.exec("ALTER TABLE wallets ADD COLUMN last_rob_at INTEGER DEFAULT 0");
    console.log("⚡ [Database] Kolom 'last_rob_at' berhasil diverifikasi/ditambahkan di tabel wallets.");
  } catch (e) {
    // Kolom sudah ada
  }

  // 40. Migrasi dinamis: Tambahkan kolom wanted_until ke wallets jika belum ada
  try {
    db.exec("ALTER TABLE wallets ADD COLUMN wanted_until INTEGER DEFAULT 0");
    console.log("⚡ [Database] Kolom 'wanted_until' berhasil diverifikasi/ditambahkan di tabel wallets.");
  } catch (e) {
    // Kolom sudah ada
  }

  // 41. Migrasi dinamis: Tambahkan kolom last_heist_at ke wallets jika belum ada
  try {
    db.exec("ALTER TABLE wallets ADD COLUMN last_heist_at INTEGER DEFAULT 0");
    console.log("⚡ [Database] Kolom 'last_heist_at' berhasil diverifikasi/ditambahkan di tabel wallets.");
  } catch (e) {
    // Kolom sudah ada
  }

  // 42. Migrasi dinamis: Sistem Upgrade Bintang Pet — star_level & bonus stats
  try {
    db.exec("ALTER TABLE user_pets ADD COLUMN star_level INTEGER DEFAULT 1");
    console.log("⚡ [Database] Kolom 'star_level' berhasil diverifikasi/ditambahkan di tabel user_pets.");
  } catch (e) {
    // Kolom sudah ada
  }
  try {
    db.exec("ALTER TABLE user_pets ADD COLUMN base_hp_bonus INTEGER DEFAULT 0");
    console.log("⚡ [Database] Kolom 'base_hp_bonus' berhasil diverifikasi/ditambahkan di tabel user_pets.");
  } catch (e) {
    // Kolom sudah ada
  }
  try {
    db.exec("ALTER TABLE user_pets ADD COLUMN base_atk_bonus_pct REAL DEFAULT 0.0");
    console.log("⚡ [Database] Kolom 'base_atk_bonus_pct' berhasil diverifikasi/ditambahkan di tabel user_pets.");
  } catch (e) {
    // Kolom sudah ada
  }
  try {
    db.exec("ALTER TABLE user_pets ADD COLUMN base_def_bonus_pct REAL DEFAULT 0.0");
    console.log("⚡ [Database] Kolom 'base_def_bonus_pct' berhasil diverifikasi/ditambahkan di tabel user_pets.");
  } catch (e) {
    // Kolom sudah ada
  }

  // 43. Migrasi dinamis: Kolom gacha_source untuk melacak asal pet (SHOP/GACHA)
  try {
    db.exec("ALTER TABLE user_pets ADD COLUMN gacha_source TEXT DEFAULT 'SHOP'");
    console.log("⚡ [Database] Kolom 'gacha_source' berhasil diverifikasi/ditambahkan di tabel user_pets.");
  } catch (e) {
    // Kolom sudah ada
  }

  // 44. Migrasi dinamis: Kolom gacha_rarity untuk menyimpan rarity pet gacha
  try {
    db.exec("ALTER TABLE user_pets ADD COLUMN gacha_rarity TEXT DEFAULT ''");
    console.log("⚡ [Database] Kolom 'gacha_rarity' berhasil diverifikasi/ditambahkan di tabel user_pets.");
  } catch (e) {
    // Kolom sudah ada
  }

  // 45. Migrasi dinamis: Kolom gacha_element untuk elemen pet gacha (FIRE, EARTH, WATER, DRAGON)
  try {
    db.exec("ALTER TABLE user_pets ADD COLUMN gacha_element TEXT DEFAULT ''");
    console.log("⚡ [Database] Kolom 'gacha_element' berhasil diverifikasi/ditambahkan di tabel user_pets.");
  } catch (e) {
    // Kolom sudah ada
  }

  // 46. Migrasi dinamis: Kolom gacha_trait2 untuk trait kedua (khusus Legendary punya 2 trait)
  try {
    db.exec("ALTER TABLE user_pets ADD COLUMN gacha_trait2 TEXT DEFAULT ''");
    console.log("⚡ [Database] Kolom 'gacha_trait2' berhasil diverifikasi/ditambahkan di tabel user_pets.");
  } catch (e) {
    // Kolom sudah ada
  }

  // 47. Tabel bot_blacklist untuk memblokir akses user dari bot
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS bot_blacklist (
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s','now')),
        PRIMARY KEY (user_id, guild_id)
      )
    `);
    console.log("⚡ [Database] Tabel 'bot_blacklist' berhasil diverifikasi/dibuat.");
  } catch (e) {
    console.error("❌ [Database] Gagal membuat tabel bot_blacklist:", e.message);
  }

  console.log('✅ Skema tabel database Stock Market, Toko Role, Perbankan, Kosan, Sistem Pet, Perampokan, Cozy Flower Garden & Ebyus Settings berhasil diinisialisasi.');
}

// Panggil fungsi inisialisasi skema saat startup
initSchema();

module.exports = {
  db,
  
  // Helper Query Dasar
  run: (sql, params = []) => db.prepare(sql).run(...params),
  get: (sql, params = []) => db.prepare(sql).get(...params),
  all: (sql, params = []) => db.prepare(sql).all(...params),
  transaction: (fn) => {
    if (db.inTransaction) {
      return fn;
    }
    return db.transaction(fn);
  }
};
