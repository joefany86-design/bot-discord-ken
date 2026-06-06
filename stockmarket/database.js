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

// Helper untuk menambahkan kolom secara aman jika belum ada
function addColumn(tableName, columnName, definition) {
  try {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    const exists = columns.some(col => col.name === columnName);
    if (!exists) {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
      return true;
    }
  } catch (err) {
    console.error(`❌ [Database] Gagal menambahkan kolom '${columnName}' ke tabel '${tableName}':`, err.message);
  }
  return false;
}

// Inisialisasi Tabel & Migrasi
function initSchema() {
  // 1. Buat tabel tracking versi jika belum ada
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      updated_at INTEGER DEFAULT (strftime('%s','now'))
    )
  `);

  const currentVersionRow = db.prepare("SELECT MAX(version) as ver FROM schema_version").get();
  const currentVersion = currentVersionRow ? (currentVersionRow.ver || 0) : 0;

  // Definisikan daftar migrasi skema
  const migrations = [
    {
      version: 1,
      description: "Membuat semua tabel dasar database dan index awal",
      run: () => {
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
        db.exec(`
          CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            guild_id TEXT NOT NULL,
            type TEXT NOT NULL,
            channel_id TEXT,
            amount INTEGER NOT NULL,
            shares INTEGER DEFAULT 0,
            price_per_share INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (strftime('%s','now'))
          )
        `);
        db.exec("CREATE INDEX IF NOT EXISTS idx_transactions_user_guild ON transactions (user_id, guild_id)");
        db.exec("CREATE INDEX IF NOT EXISTS idx_transactions_guild ON transactions (guild_id)");
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
        db.exec("CREATE INDEX IF NOT EXISTS idx_price_history_channel_guild ON price_history (channel_id, guild_id)");
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
        db.exec(`
          CREATE TABLE IF NOT EXISTS active_events (
            guild_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            ends_at INTEGER NOT NULL,
            PRIMARY KEY (guild_id)
          )
        `);
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
        db.exec(`
          CREATE TABLE IF NOT EXISTS kos_rentals (
            user_id TEXT NOT NULL,
            guild_id TEXT NOT NULL,
            room_tier TEXT NOT NULL,
            ends_at INTEGER NOT NULL,
            PRIMARY KEY (user_id, guild_id)
          )
        `);
        db.exec(`
          CREATE TABLE IF NOT EXISTS kos_upgrades (
            user_id TEXT NOT NULL,
            guild_id TEXT NOT NULL,
            upgrade_id TEXT NOT NULL,
            created_at INTEGER DEFAULT (strftime('%s','now')),
            PRIMARY KEY (user_id, guild_id, upgrade_id)
          )
        `);
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
            PRIMARY KEY (user_id, guild_id)
          )
        `);
        db.exec(`
          CREATE TABLE IF NOT EXISTS pet_inventory (
            user_id TEXT NOT NULL,
            guild_id TEXT NOT NULL,
            item_id TEXT NOT NULL,
            quantity INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, guild_id, item_id)
          )
        `);
        db.exec(`
          CREATE TABLE IF NOT EXISTS heist_cooldown (
            guild_id TEXT NOT NULL PRIMARY KEY,
            last_heist_at INTEGER DEFAULT 0
          )
        `);
        db.exec(`
          CREATE TABLE IF NOT EXISTS ebyus_settings (
            guild_id TEXT PRIMARY KEY,
            gacha_mode TEXT DEFAULT 'NORMAL',
            coin_multiplier INTEGER DEFAULT 1,
            updated_at INTEGER DEFAULT 0,
            updated_by TEXT
          )
        `);
      }
    },
    {
      version: 2,
      description: "Migrasi multi-pet untuk tabel user_pets",
      run: () => {
        try {
          const columns = db.prepare("PRAGMA table_info(user_pets)").all();
          const hasIsActive = columns.some(col => col.name === 'is_active');
          if (!hasIsActive) {
            console.log("⚡ [Database] Melakukan migrasi user_pets ke skema multi-pet...");
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
            console.log("✅ [Database] Migrasi tabel user_pets selesai dengan sukses.");
          }
        } catch (err) {
          console.error("❌ [Database] Gagal melakukan migrasi user_pets:", err.message);
          throw err;
        }
      }
    },
    {
      version: 3,
      description: "Menambahkan kolom dinamis dan tabel tambahan",
      run: () => {
        // Buat tabel-tabel baru yang ditambahkan di fase-fase berikutnya
        db.exec(`
          CREATE TABLE IF NOT EXISTS user_inventory (
            user_id TEXT NOT NULL,
            guild_id TEXT NOT NULL,
            item_id TEXT NOT NULL,
            quantity INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, guild_id, item_id)
          )
        `);

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

        db.exec(`
          CREATE TABLE IF NOT EXISTS garden_slots (
            user_id TEXT NOT NULL,
            guild_id TEXT NOT NULL,
            slot_index INTEGER NOT NULL,
            seed_id TEXT DEFAULT NULL,
            planted_at INTEGER DEFAULT 0,
            last_watered_at INTEGER DEFAULT 0,
            water_count INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, guild_id, slot_index)
          )
        `);

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

        db.exec(`
          CREATE TABLE IF NOT EXISTS pet_item_cooldowns (
            user_id TEXT NOT NULL,
            guild_id TEXT NOT NULL,
            item_id TEXT NOT NULL,
            last_used_at INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, guild_id, item_id)
          )
        `);

        db.exec(`
          CREATE TABLE IF NOT EXISTS bot_blacklist (
            user_id TEXT NOT NULL,
            guild_id TEXT NOT NULL,
            created_at INTEGER DEFAULT (strftime('%s','now')),
            PRIMARY KEY (user_id, guild_id)
          )
        `);

        db.exec(`
          CREATE TABLE IF NOT EXISTS robbery_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            robber_id TEXT NOT NULL,
            target_id TEXT NOT NULL,
            guild_id TEXT NOT NULL,
            success INTEGER NOT NULL,
            created_at INTEGER DEFAULT (strftime('%s','now'))
          )
        `);
        db.exec("CREATE INDEX IF NOT EXISTS idx_robbery_attempts_robber_target ON robbery_attempts (robber_id, target_id, guild_id, created_at)");
        db.exec("CREATE INDEX IF NOT EXISTS idx_robbery_attempts_target ON robbery_attempts (target_id, guild_id, created_at)");

        db.exec(`
          CREATE TABLE IF NOT EXISTS world_boss (
            guild_id TEXT NOT NULL,
            week_start TEXT NOT NULL,
            boss_name TEXT NOT NULL,
            boss_type TEXT NOT NULL,
            max_hp INTEGER NOT NULL,
            current_hp INTEGER NOT NULL,
            status TEXT DEFAULT 'ACTIVE',
            created_at INTEGER DEFAULT (strftime('%s','now')),
            PRIMARY KEY (guild_id, week_start)
          )
        `);

        db.exec(`
          CREATE TABLE IF NOT EXISTS world_boss_participants (
            user_id TEXT NOT NULL,
            guild_id TEXT NOT NULL,
            pet_name TEXT NOT NULL,
            week_start TEXT NOT NULL,
            damage_dealt INTEGER DEFAULT 0,
            attacks_count INTEGER DEFAULT 0,
            last_attack_at INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, guild_id, pet_name, week_start)
          )
        `);

        db.exec(`
          CREATE TABLE IF NOT EXISTS user_pet_tower (
            user_id TEXT NOT NULL,
            guild_id TEXT NOT NULL,
            current_floor INTEGER DEFAULT 1,
            daily_attempts INTEGER DEFAULT 0,
            last_attempt_date TEXT DEFAULT '',
            last_sweep_date TEXT DEFAULT '',
            created_at INTEGER DEFAULT (strftime('%s','now')),
            PRIMARY KEY (user_id, guild_id)
          )
        `);

        db.exec(`
          CREATE TABLE IF NOT EXISTS tournament_events (
            guild_id TEXT PRIMARY KEY,
            status TEXT NOT NULL,
            admin_id TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            registration_end_at INTEGER NOT NULL,
            current_round INTEGER DEFAULT 1,
            min_level INTEGER DEFAULT 10,
            max_level INTEGER DEFAULT 9999,
            created_at INTEGER DEFAULT (strftime('%s','now'))
          )
        `);

        db.exec(`
          CREATE TABLE IF NOT EXISTS tournament_participants (
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            pet_name TEXT NOT NULL,
            status TEXT DEFAULT 'ACTIVE',
            PRIMARY KEY (guild_id, user_id)
          )
        `);

        db.exec(`
          CREATE TABLE IF NOT EXISTS tournament_matches (
            match_id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            round_number INTEGER NOT NULL,
            player_1_id TEXT NOT NULL,
            player_2_id TEXT,
            winner_id TEXT,
            thread_id TEXT,
            match_status TEXT DEFAULT 'PENDING'
          )
        `);

        db.exec(`
          CREATE TABLE IF NOT EXISTS marketplace_listings (
            listing_id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            seller_id TEXT NOT NULL,
            item_type TEXT NOT NULL,
            item_id TEXT NOT NULL,
            quantity INTEGER DEFAULT 1,
            price INTEGER NOT NULL,
            pet_details TEXT DEFAULT NULL,
            created_at INTEGER DEFAULT (strftime('%s','now'))
          )
        `);

        // Wallets Column Additions
        addColumn('wallets', 'auto_trade', 'INTEGER DEFAULT 0');
        addColumn('wallets', 'jail_until', 'INTEGER DEFAULT 0');
        addColumn('wallets', 'jail_type', "TEXT DEFAULT ''");
        addColumn('wallets', 'wanted_bounty', 'INTEGER DEFAULT 0');
        addColumn('wallets', 'jail_count', 'INTEGER DEFAULT 0');
        addColumn('wallets', 'daily_expedition_count', 'INTEGER DEFAULT 0');
        addColumn('wallets', 'last_expedition_date', "TEXT DEFAULT ''");
        addColumn('wallets', 'expedition_cooldown_until', 'INTEGER DEFAULT 0');
        addColumn('wallets', 'last_water_at', 'INTEGER DEFAULT 0');
        addColumn('wallets', 'last_rob_at', 'INTEGER DEFAULT 0');
        addColumn('wallets', 'wanted_until', 'INTEGER DEFAULT 0');
        addColumn('wallets', 'last_heist_at', 'INTEGER DEFAULT 0');
        addColumn('wallets', 'curse_type', "TEXT DEFAULT ''");
        addColumn('wallets', 'curse_until', 'INTEGER DEFAULT 0');

        // Ebyus Settings Column Additions
        addColumn('ebyus_settings', 'is_active', 'INTEGER DEFAULT 0');
        addColumn('ebyus_settings', 'expires_at', 'INTEGER DEFAULT 0');
        addColumn('ebyus_settings', 'admin_panel_channel_id', 'TEXT');
        addColumn('ebyus_settings', 'owner_god_mode', 'INTEGER DEFAULT 0');
        addColumn('ebyus_settings', 'owner_protection', 'INTEGER DEFAULT 0');
        addColumn('ebyus_settings', 'gift_coins', 'INTEGER DEFAULT 0');
        addColumn('ebyus_settings', 'gift_item_id', 'TEXT');
        addColumn('ebyus_settings', 'gift_item_qty', 'INTEGER DEFAULT 0');

        // User Pets Column Additions
        addColumn('user_pets', 'last_play_at', 'INTEGER DEFAULT 0');
        addColumn('user_pets', 'trait', "TEXT DEFAULT ''");
        addColumn('user_pets', 'last_breed_at', 'INTEGER DEFAULT 0');
        addColumn('user_pets', 'xp_multiplier', 'REAL DEFAULT 1.0');
        addColumn('user_pets', 'pvp_wins', 'INTEGER DEFAULT 0');
        addColumn('user_pets', 'pvp_losses', 'INTEGER DEFAULT 0');
        addColumn('user_pets', 'auto_feed', 'INTEGER DEFAULT 0');
        addColumn('user_pets', 'custom_image', 'TEXT DEFAULT NULL');
        addColumn('user_pets', 'curse_type', "TEXT DEFAULT ''");
        addColumn('user_pets', 'curse_until', 'INTEGER DEFAULT 0');
        addColumn('user_pets', 'soda_today', 'INTEGER DEFAULT 0');
        addColumn('user_pets', 'accessory', 'TEXT DEFAULT NULL');
        addColumn('user_pets', 'last_soda_reset_at', 'INTEGER DEFAULT 0');
        addColumn('user_pets', 'star_level', 'INTEGER DEFAULT 1');
        addColumn('user_pets', 'base_hp_bonus', 'INTEGER DEFAULT 0');
        addColumn('user_pets', 'base_atk_bonus_pct', 'REAL DEFAULT 0.0');
        addColumn('user_pets', 'base_def_bonus_pct', 'REAL DEFAULT 0.0');
        addColumn('user_pets', 'gacha_source', "TEXT DEFAULT 'SHOP'");
        addColumn('user_pets', 'gacha_rarity', "TEXT DEFAULT ''");
        addColumn('user_pets', 'gacha_element', "TEXT DEFAULT ''");
        addColumn('user_pets', 'gacha_trait2', "TEXT DEFAULT ''");
        addColumn('user_pets', 'stat_str', 'INTEGER DEFAULT 0');
        addColumn('user_pets', 'stat_vit', 'INTEGER DEFAULT 0');
        addColumn('user_pets', 'stat_def', 'INTEGER DEFAULT 0');
        addColumn('user_pets', 'stat_dex', 'INTEGER DEFAULT 0');
        addColumn('user_pets', 'unused_tp', 'INTEGER DEFAULT 0');

        // Stocks Column Additions
        addColumn('stocks', 'force_trend', "TEXT DEFAULT 'NONE'");
        addColumn('stocks', 'force_until', 'INTEGER DEFAULT 0');

        // Bursa cap limit to 500
        try {
          const needBursaCap = db.prepare("SELECT 1 FROM stocks WHERE total_shares != 500 LIMIT 1").get();
          if (needBursaCap) {
            db.prepare(`
              UPDATE stocks 
              SET total_shares = 500,
                  available_shares = 500 - COALESCE((
                    SELECT SUM(shares) 
                    FROM portfolios 
                    WHERE portfolios.channel_id = stocks.channel_id AND portfolios.guild_id = stocks.guild_id
                  ), 0)
            `).run();
          }
        } catch (e) {}

        // Retroactive TP calculation for active pets
        try {
          db.prepare(`
            UPDATE user_pets 
            SET unused_tp = (level - 1) * 3 
            WHERE level > 1 AND unused_tp = 0 AND stat_str = 0 AND stat_vit = 0 AND stat_def = 0 AND stat_dex = 0
          `).run();
        } catch (e) {}
      }
    },
    {
      version: 4,
      description: "Membuat tabel promo_codes, promo_claims, auction_items, auction_bids",
      run: () => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS promo_codes (
            code TEXT PRIMARY KEY,
            reward_coins INTEGER DEFAULT 0,
            reward_item_id TEXT DEFAULT NULL,
            reward_item_qty INTEGER DEFAULT 0,
            max_claims INTEGER DEFAULT -1,
            current_claims INTEGER DEFAULT 0,
            expires_at INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (strftime('%s','now'))
          )
        `);
        db.exec(`
          CREATE TABLE IF NOT EXISTS promo_claims (
            code TEXT NOT NULL,
            user_id TEXT NOT NULL,
            claimed_at INTEGER DEFAULT (strftime('%s','now')),
            PRIMARY KEY (code, user_id)
          )
        `);
        db.exec(`
          CREATE TABLE IF NOT EXISTS auction_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            item_type TEXT NOT NULL,
            item_id TEXT NOT NULL,
            quantity INTEGER DEFAULT 1,
            min_bid INTEGER DEFAULT 0,
            current_bid INTEGER DEFAULT 0,
            highest_bidder_id TEXT DEFAULT NULL,
            ends_at INTEGER NOT NULL,
            status TEXT DEFAULT 'ACTIVE',
            created_at INTEGER DEFAULT (strftime('%s','now'))
          )
        `);
        db.exec(`
          CREATE TABLE IF NOT EXISTS auction_bids (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            auction_id INTEGER NOT NULL,
            user_id TEXT NOT NULL,
            bid_amount INTEGER NOT NULL,
            created_at INTEGER DEFAULT (strftime('%s','now'))
          )
        `);
        db.exec("CREATE INDEX IF NOT EXISTS idx_auction_bids_auction ON auction_bids (auction_id)");
      }
    },
    {
      version: 5,
      description: "Menambahkan kolom username dan display_name di tabel wallets",
      run: () => {
        addColumn('wallets', 'username', "TEXT DEFAULT ''");
        addColumn('wallets', 'display_name', "TEXT DEFAULT ''");
      }
    }
  ];

  // Jalankan migrasi sekuensial
  let migrationCount = 0;
  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      console.log(`🚀 [Database] Menjalankan migrasi versi ${migration.version}: ${migration.description}...`);
      try {
        db.transaction(() => {
          migration.run();
          db.prepare("INSERT INTO schema_version (version) VALUES (?)").run(migration.version);
        })();
        migrationCount++;
      } catch (err) {
        console.error(`❌ [Database] Gagal mengeksekusi migrasi skema versi ${migration.version}:`, err.message);
        throw err;
      }
    }
  }

  if (migrationCount > 0) {
    console.log(`✅ [Database] Migrasi database selesai. ${migrationCount} migrasi berhasil diterapkan.`);
  } else {
    console.log(`✅ [Database] Skema database siap & berada di versi terbaru (Versi ${currentVersion}).`);
  }
}

// Panggil fungsi inisialisasi skema saat startup
initSchema();

module.exports = {
  db,
  
  // Helper Query Dasar
  run: (sql, params = []) => db.prepare(sql).run(...params),
  get: (sql, params = []) => db.prepare(sql).get(...params),
  all: (sql, params = []) => db.prepare(sql).all(...params),

  /**
   * Helper untuk menjalankan transaksi database (Better-SQLite3).
   * Mendukung "nested transactions" dengan mendeteksi jika database sudah dalam status transaksi (`db.inTransaction`).
   * Jika sudah berada dalam transaksi, ia akan mengembalikan fungsi target `fn` secara langsung (untuk dijalankan
   * dalam konteks transaksi induk), bukan membuat transaksi baru yang dapat memicu crash.
   * 
   * WARNING: Fungsi yang dikembalikan HARUS segera dipanggil (invoked), contoh:
   * `db.transaction(() => { ... })()`
   * 
   * @param {Function} fn - Fungsi berisi query-query SQL yang akan dijalankan.
   * @returns {Function} Fungsi transaksional yang harus di-invoke/dipanggil.
   */
  restoreBackup: (backupPath) => {
    db.close();
    fs.copyFileSync(backupPath, finalDbPath);
    db = new Database(finalDbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    module.exports.db = db;
    console.log(`✅ Database SQLite dipulihkan dari: ${backupPath}`);
  },

  transaction: (fn) => {
    if (db.inTransaction) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('⚠️ [Database] Nested transaction terdeteksi. Fungsi akan dieksekusi di dalam transaksi induk saat ini.');
      }
      return fn;
    }
    return db.transaction(fn);
  }
};
