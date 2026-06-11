const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const http = require('http');
const fs = require('fs');
const Database = require('better-sqlite3');

const config = require('../stockmarket/config');

const PORT = 80;
const PUBLIC_DIR = path.join(__dirname, 'public');
let DB_PATH = config.DATABASE_PATH;
const LOG_FILE = path.join(__dirname, 'server.log');

let db;
try {
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  db = new Database(DB_PATH, { fileMustExist: false });
  console.log(`✅ Web Server SQLite connected at: ${DB_PATH}`);
} catch (err) {
  console.warn(`⚠️ Web Server failed to connect to: ${DB_PATH} (${err.message}). Menggunakan fallback database lokal...`);
  DB_PATH = path.join(__dirname, '../data/economy.db');
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  db = new Database(DB_PATH, { fileMustExist: false });
  console.log(`✅ Web Server SQLite connected at fallback: ${DB_PATH}`);
}

// Ensure wallets columns exist
try {
  const tableInfo = db.prepare("PRAGMA table_info(wallets)").all();
  const hasUsername = tableInfo.some(col => col.name === 'username');
  if (!hasUsername) {
    db.prepare("ALTER TABLE wallets ADD COLUMN username TEXT DEFAULT ''").run();
    db.prepare("ALTER TABLE wallets ADD COLUMN display_name TEXT DEFAULT ''").run();
    console.log("✅ Web Server migrated wallets table with username & display_name columns.");
  }
} catch (migErr) {
  console.error("⚠️ Web Server wallets table migration safeguard failed:", migErr.message);
}

// Ensure bot_broadcasts table exists
try {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS bot_broadcasts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING',
      error_message TEXT DEFAULT '',
      created_at INTEGER DEFAULT (strftime('%s','now'))
    )
  `).run();
  console.log("✅ Web Server verified bot_broadcasts table schema.");
} catch (broadErr) {
  console.error("⚠️ Web Server bot_broadcasts safeguard failed:", broadErr.message);
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

// Helper function to append to log file
function appendLog(action) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const logLine = `[${timestamp}] WEB_ADMIN: ${action}\n`;
  try {
    fs.appendFileSync(LOG_FILE, logLine, 'utf8');
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }
}

function logPetAction(guildId, userId, petName, actionType, details) {
  try {
    const wallet = db.prepare('SELECT username FROM wallets WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
    const username = wallet ? (wallet.username || '') : '';
    db.prepare(`
      INSERT INTO user_pet_logs (guild_id, user_id, username, pet_name, action_type, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(guildId, userId, username, petName || '', actionType, details || '');
  } catch (err) {
    console.error('Failed to log pet action from admin panel:', err);
  }
}

// Helper to send JSON response
function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Router
const server = http.createServer((req, res) => {
  // CORS Headers for local development if needed
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // API Endpoints
  if (pathname.startsWith('/api/')) {
    // Auth route to verify passcode
    if (pathname === '/api/auth' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { token } = JSON.parse(body);
          const expectedToken = process.env.ADMIN_ACCESS_TOKEN || '123456';
          if (token === expectedToken) {
            sendJSON(res, 200, { success: true, message: 'Autentikasi berhasil!' });
          } else {
            sendJSON(res, 401, { success: false, message: 'Kode akses admin salah!' });
          }
        } catch (err) {
          sendJSON(res, 400, { success: false, message: 'Invalid payload' });
        }
      });
      return;
    }

    // Auth verification middleware
    const token = req.headers['x-admin-token'];
    const expectedToken = process.env.ADMIN_ACCESS_TOKEN || '123456';
    if (token !== expectedToken) {
      sendJSON(res, 401, { success: false, message: 'Akses Ditolak! Harap masukkan kode akses admin yang valid.' });
      return;
    }

    if (pathname === '/api/stats' && req.method === 'GET') {
      try {
        const walletsCount = db.prepare('SELECT COUNT(*) as count FROM wallets').get().count;
        const activePetsCount = db.prepare('SELECT COUNT(*) as count FROM user_pets WHERE is_active = 1').get().count;
        
        const totalCoinsRow = db.prepare('SELECT SUM(balance) as total FROM wallets').get();
        const totalSavingsRow = db.prepare('SELECT SUM(balance) as total FROM bank_savings').get();
        const totalCoins = (totalCoinsRow.total || 0) + (totalSavingsRow.total || 0);

        const settings = db.prepare('SELECT * FROM ebyus_settings LIMIT 1').get() || {
          gacha_mode: 'NORMAL',
          coin_multiplier: 1,
          is_active: 0
        };

        sendJSON(res, 200, {
          success: true,
          walletsCount,
          activePetsCount,
          totalCoins,
          settings
        });
      } catch (err) {
        sendJSON(res, 500, { success: false, message: err.message });
      }
    }
    else if (pathname === '/api/users' && req.method === 'GET') {
      try {
        // Query users list
        const users = db.prepare(`
          SELECT 
            w.user_id, 
            w.username,
            w.display_name,
            w.balance as wallet_balance,
            COALESCE(bs.balance, 0) as bank_balance,
            w.last_active_date,
            w.jail_until,
            (SELECT COUNT(*) FROM bot_blacklist b WHERE b.user_id = w.user_id) as is_blacklisted,
            (SELECT COUNT(*) FROM user_pets up WHERE up.user_id = w.user_id AND up.status = 'DEAD' AND up.is_active = 1) as has_dead_pet
          FROM wallets w
          LEFT JOIN bank_savings bs ON w.user_id = bs.user_id AND w.guild_id = bs.guild_id
          WHERE w.guild_id = ?
          ORDER BY (w.balance + COALESCE(bs.balance, 0)) DESC
        `).all(config.TARGET_GUILD_ID);

        sendJSON(res, 200, { success: true, users });
      } catch (err) {
        sendJSON(res, 500, { success: false, message: err.message });
      }
    }
    else if (pathname === '/api/assets' && req.method === 'GET') {
      // Return list of items available
      const items = [
        { id: 'LOCKPICK', name: '🕵️‍♂️ Lockpick', category: 'general', description: 'Alat membobol rumah/kosan warga' },
        { id: 'SOAP', name: '🧼 Soap (Sabun)', category: 'general', description: 'Sabun licin untuk melarikan diri' },
        { id: 'LAMBO', name: '🏎️ Lamborgini Kosan', category: 'general', description: 'Mobil sports prestise sultan kos' },
        { id: 'GOLD', name: '👑 Emas Batangan 24K', category: 'general', description: 'Pajangan laci kos penahan inflasi' },
        { id: 'IPHONE', name: '📱 iPhone 16 Pro Max', category: 'general', description: 'Hp sultan meskipun layar retak' },
        { id: 'TICKET_GACHA', name: '🎫 Tiket Gacha Pet', category: 'general', description: 'Tiket memutar gacha peliharaan' },
        { id: 'FOOD_PREMIUM', name: '🥩 Pakan Premium Pet', category: 'pet', description: 'Makanan bernutrisi tinggi untuk pet' },
        { id: 'MEDICINE', name: '💊 Obat Pet Sakit', category: 'pet', description: 'Sembuhkan HP pet yang terluka parah' },
        { id: 'LUCKY_AMULET', name: '🔮 Jimat Keberuntungan (Amulet)', category: 'pet', description: 'Jimat pelindung kematian pet sekali pakai' }
      ];
      sendJSON(res, 200, { success: true, items });
    }
    else if (pathname === '/api/give' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { userId, guildId = config.TARGET_GUILD_ID, category, target, amount } = JSON.parse(body);
          if (!userId || !category || isNaN(amount)) {
            return sendJSON(res, 400, { success: false, message: 'Invalid request body' });
          }

          db.transaction(() => {
            if (category === 'coin') {
              const wallet = db.prepare('SELECT balance FROM wallets WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
              if (!wallet) {
                db.prepare('INSERT INTO wallets (user_id, guild_id, balance) VALUES (?, ?, ?)').run(userId, guildId, Math.max(0, amount));
              } else {
                db.prepare('UPDATE wallets SET balance = ? WHERE user_id = ? AND guild_id = ?').run(Math.max(0, wallet.balance + amount), userId, guildId);
              }
              db.prepare('INSERT INTO transactions (user_id, guild_id, type, amount) VALUES (?, ?, ?, ?)').run(
                userId, guildId, amount > 0 ? 'ADMIN_GIVE' : 'ADMIN_TAKE', amount
              );
            } 
            else if (category === 'bank') {
              const savings = db.prepare('SELECT balance FROM bank_savings WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
              const newBal = Math.max(0, (savings ? savings.balance : 0) + amount);
              if (!savings) {
                db.prepare('INSERT INTO bank_savings (user_id, guild_id, balance) VALUES (?, ?, ?)').run(userId, guildId, newBal);
              } else {
                db.prepare('UPDATE bank_savings SET balance = ? WHERE user_id = ? AND guild_id = ?').run(newBal, userId, guildId);
              }
            } 
            else if (category === 'item') {
              const exist = db.prepare('SELECT quantity FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?').get(userId, guildId, target);
              const newQty = Math.max(0, (exist ? exist.quantity : 0) + amount);
              if (newQty <= 0) {
                db.prepare('DELETE FROM user_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?').run(userId, guildId, target);
              } else if (!exist) {
                db.prepare('INSERT INTO user_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, ?, ?)').run(userId, guildId, target, newQty);
              } else {
                db.prepare('UPDATE user_inventory SET quantity = ? WHERE user_id = ? AND guild_id = ? AND item_id = ?').run(newQty, userId, guildId, target);
              }
            } 
            else if (category === 'pet_item') {
              const exist = db.prepare('SELECT quantity FROM pet_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?').get(userId, guildId, target);
              const newQty = Math.max(0, (exist ? exist.quantity : 0) + amount);
              if (newQty <= 0) {
                db.prepare('DELETE FROM pet_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?').run(userId, guildId, target);
              } else if (!exist) {
                db.prepare('INSERT INTO pet_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, ?, ?)').run(userId, guildId, target, newQty);
              } else {
                db.prepare('UPDATE pet_inventory SET quantity = ? WHERE user_id = ? AND guild_id = ? AND item_id = ?').run(newQty, userId, guildId, target);
              }
            }
          })();

          appendLog(`Gave ${amount} of ${category} (${target || ''}) to user ${userId}`);
          sendJSON(res, 200, { success: true, message: 'Quick Give executed successfully!' });
        } catch (err) {
          sendJSON(res, 500, { success: false, message: err.message });
        }
      });
    }
    else if (pathname === '/api/db/backup' && req.method === 'POST') {
      try {
        const backupsDir = path.join(__dirname, 'backups');
        if (!fs.existsSync(backupsDir)) {
          fs.mkdirSync(backupsDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').substring(0, 19);
        const backupFile = path.join(backupsDir, `web_backup_${timestamp}.db`);
        fs.copyFileSync(DB_PATH, backupFile);

        appendLog(`Backup database created successfully: ${backupFile}`);
        sendJSON(res, 200, { success: true, backupFile: path.basename(backupFile) });
      } catch (err) {
        sendJSON(res, 500, { success: false, message: err.message });
      }
    }
    else if (pathname === '/api/logs' && req.method === 'GET') {
      try {
        if (!fs.existsSync(LOG_FILE)) {
          fs.writeFileSync(LOG_FILE, '', 'utf8');
        }
        const logData = fs.readFileSync(LOG_FILE, 'utf8');
        const logs = logData.split('\n').filter(Boolean).slice(-30).reverse(); // 30 logs terbaru
        sendJSON(res, 200, { success: true, logs });
      } catch (err) {
        sendJSON(res, 500, { success: false, message: err.message });
      }
    }
    else if (pathname === '/api/admin/detailed-stats' && req.method === 'GET') {
      try {
        const totalCirculation = db.prepare('SELECT SUM(balance) as total FROM wallets').get().total || 0;
        const bankSavings = db.prepare('SELECT SUM(balance) as total FROM bank_savings').get().total || 0;
        const activeWallets = db.prepare('SELECT COUNT(*) as count FROM wallets WHERE last_active_date != "" AND guild_id = ?').get(config.TARGET_GUILD_ID).count;
        const inactiveWallets = db.prepare('SELECT COUNT(*) as count FROM wallets WHERE last_active_date = "" AND guild_id = ?').get(config.TARGET_GUILD_ID).count;
        
        const stocks = db.prepare('SELECT * FROM stocks WHERE guild_id = ?').all(config.TARGET_GUILD_ID);
        for (const stock of stocks) {
          const historyRows = db.prepare(`
            SELECT price 
            FROM price_history 
            WHERE channel_id = ? AND guild_id = ? 
            ORDER BY recorded_at DESC LIMIT 10
          `).all(stock.channel_id, config.TARGET_GUILD_ID);
          stock.history = historyRows.map(h => h.price).reverse();
        }
        
        const auctions = db.prepare(`
          SELECT ai.*, w.username as bidder_username, w.display_name as bidder_display_name
          FROM auction_items ai
          LEFT JOIN wallets w ON ai.highest_bidder_id = w.user_id AND ai.guild_id = w.guild_id
          WHERE ai.guild_id = ?
        `).all(config.TARGET_GUILD_ID);
        
        const backupsDir = path.join(__dirname, 'backups');
        const backups = fs.existsSync(backupsDir) ? fs.readdirSync(backupsDir).filter(f => f.endsWith('.db')) : [];

        const strongestPet = db.prepare(`
          SELECT up.user_id, up.pet_name, up.level, up.star_level, up.pet_type,
                 w.username, w.display_name
          FROM user_pets up
          LEFT JOIN wallets w ON up.user_id = w.user_id AND up.guild_id = w.guild_id
          WHERE up.is_active = 1 AND up.status != 'DEAD' AND up.guild_id = ?
          ORDER BY up.level DESC, up.star_level DESC LIMIT 1
        `).get(config.TARGET_GUILD_ID) || null;

        const longestJail = db.prepare(`
          SELECT user_id, jail_until, username, display_name
          FROM wallets 
          WHERE jail_until > ? AND guild_id = ?
          ORDER BY jail_until DESC LIMIT 1
        `).get(Math.floor(Date.now() / 1000), config.TARGET_GUILD_ID) || null;

        sendJSON(res, 200, {
          success: true,
          totalCirculation,
          bankSavings,
          activeWallets,
          inactiveWallets,
          stocks,
          auctions,
          backups,
          strongestPet,
          longestJail
        });
      } catch (err) {
        sendJSON(res, 500, { success: false, message: err.message });
      }
    }
    else if (pathname === '/api/admin/abyus' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { gachaMode, coinMultiplier, isActive, ownerGodMode, ownerProtection, backupFile, action } = JSON.parse(body);
          
          if (action === 'restore' && backupFile) {
            const backupPath = path.join(__dirname, 'backups', backupFile);
            if (!fs.existsSync(backupPath)) {
              return sendJSON(res, 400, { success: false, message: 'File backup tidak ditemukan' });
            }
            const databaseModule = require('../stockmarket/database');
            databaseModule.restoreBackup(backupPath);
            appendLog(`Restored database from backup: ${backupFile}`);
            return sendJSON(res, 200, { success: true, message: 'Database berhasil dipulihkan!' });
          }

          const exist = db.prepare('SELECT 1 FROM ebyus_settings WHERE guild_id = ?').get(config.TARGET_GUILD_ID);
          if (!exist) {
            db.prepare('INSERT INTO ebyus_settings (guild_id, gacha_mode, coin_multiplier, is_active, owner_god_mode, owner_protection) VALUES (?, ?, ?, ?, ?, ?)')
              .run(config.TARGET_GUILD_ID, gachaMode || 'NORMAL', coinMultiplier || 1, isActive || 0, ownerGodMode || 0, ownerProtection || 0);
          } else {
            db.prepare(`
              UPDATE ebyus_settings 
              SET gacha_mode = COALESCE(?, gacha_mode), 
                  coin_multiplier = COALESCE(?, coin_multiplier), 
                  is_active = COALESCE(?, is_active), 
                  owner_god_mode = COALESCE(?, owner_god_mode), 
                  owner_protection = COALESCE(?, owner_protection)
              WHERE guild_id = ?
            `).run(gachaMode, coinMultiplier, isActive, ownerGodMode, ownerProtection, config.TARGET_GUILD_ID);
          }
          appendLog(`Updated Abyus config: Gacha=${gachaMode}, Multiplier=${coinMultiplier}, Active=${isActive}`);
          sendJSON(res, 200, { success: true, message: 'Konfigurasi berhasil disimpan!' });
        } catch (err) {
          sendJSON(res, 500, { success: false, message: err.message });
        }
      });
    }
    else if (pathname === '/api/admin/citizen' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { userId, action, duration } = JSON.parse(body);
          if (!userId || !action) {
            return sendJSON(res, 400, { success: false, message: 'Missing userId or action' });
          }

          if (action === 'blacklist') {
            const exists = db.prepare('SELECT 1 FROM bot_blacklist WHERE user_id = ?').get(userId);
            if (exists) {
              db.prepare('DELETE FROM bot_blacklist WHERE user_id = ?').run(userId);
              appendLog(`Whitelisted user ${userId}`);
              sendJSON(res, 200, { success: true, message: `User ${userId} berhasil di-whitelist!` });
            } else {
              db.prepare('INSERT INTO bot_blacklist (user_id, reason) VALUES (?, "WEB_ADMIN_BLACKLIST")').run(userId);
              appendLog(`Blacklisted user ${userId}`);
              sendJSON(res, 200, { success: true, message: `User ${userId} berhasil di-blacklist!` });
            }
          } 
          else if (action === 'jail') {
            const jailTime = Math.floor(Date.now() / 1000) + (duration || 3600);
            db.prepare('UPDATE wallets SET jail_until = ?, jail_type = "admin" WHERE user_id = ? AND guild_id = ?')
              .run(jailTime, userId, config.TARGET_GUILD_ID);
            appendLog(`Jailed user ${userId} for ${duration}s`);
            sendJSON(res, 200, { success: true, message: `User ${userId} berhasil dijebloskan ke Lapas!` });
          }
          else if (action === 'release') {
            db.prepare('UPDATE wallets SET jail_until = 0, jail_type = "" WHERE user_id = ? AND guild_id = ?')
              .run(userId, config.TARGET_GUILD_ID);
            appendLog(`Released user ${userId} from jail`);
            sendJSON(res, 200, { success: true, message: `User ${userId} dibebaskan dari Lapas!` });
          }
          else if (action === 'reset_cooldowns') {
            db.prepare(`
              UPDATE wallets 
              SET last_rob_at = 0, wanted_until = 0, wanted_bounty = 0, last_heist_at = 0
              WHERE user_id = ? AND guild_id = ?
            `).run(userId, config.TARGET_GUILD_ID);
            db.prepare('DELETE FROM heist_cooldown WHERE user_id = ? AND guild_id = ?').run(userId, config.TARGET_GUILD_ID);
            appendLog(`Reset criminal cooldowns for user ${userId}`);
            sendJSON(res, 200, { success: true, message: `Cooldown kejahatan user ${userId} di-reset!` });
          }
        } catch (err) {
          sendJSON(res, 500, { success: false, message: err.message });
        }
      });
    }
    else if (pathname === '/api/admin/pet' && req.method === 'GET') {
      try {
        const userId = parsedUrl.searchParams.get('userId');
        if (!userId) {
          return sendJSON(res, 400, { success: false, message: 'Missing userId parameter' });
        }
        const pet = db.prepare('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1').get(userId, config.TARGET_GUILD_ID);
        const tower = db.prepare('SELECT * FROM user_pet_tower WHERE user_id = ? AND guild_id = ?').get(userId, config.TARGET_GUILD_ID) || { current_floor: 1, max_floor: 1 };
        
        sendJSON(res, 200, { success: true, pet, tower });
      } catch (err) {
        sendJSON(res, 500, { success: false, message: err.message });
      }
    }
    else if (pathname === '/api/admin/pet-logs' && req.method === 'GET') {
      try {
        const limit = parseInt(parsedUrl.searchParams.get('limit') || '15', 10);
        const offset = parseInt(parsedUrl.searchParams.get('offset') || '0', 10);
        const actionType = parsedUrl.searchParams.get('actionType') || '';
        const search = parsedUrl.searchParams.get('search') || '';

        let query = `
          SELECT id, guild_id, user_id, username, pet_name, action_type, details, created_at 
          FROM user_pet_logs 
          WHERE guild_id = ?
        `;
        const params = [config.TARGET_GUILD_ID];

        if (actionType) {
          query += ` AND action_type = ?`;
          params.push(actionType);
        }
        if (search) {
          query += ` AND (username LIKE ? OR user_id LIKE ? OR pet_name LIKE ? OR details LIKE ?)`;
          params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const logs = db.prepare(query).all(...params);

        let countQuery = `
          SELECT COUNT(*) as count 
          FROM user_pet_logs 
          WHERE guild_id = ?
        `;
        const countParams = [config.TARGET_GUILD_ID];

        if (actionType) {
          countQuery += ` AND action_type = ?`;
          countParams.push(actionType);
        }
        if (search) {
          countQuery += ` AND (username LIKE ? OR user_id LIKE ? OR pet_name LIKE ? OR details LIKE ?)`;
          countParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        const totalCount = db.prepare(countQuery).get(...countParams).count;

        sendJSON(res, 200, { success: true, logs, totalCount });
      } catch (err) {
        sendJSON(res, 500, { success: false, message: err.message });
      }
    }
    else if (pathname === '/api/admin/pet' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { userId, action, level, xp, trait, star, floor, petName, petType } = JSON.parse(body);
          if (!userId || !action) {
            return sendJSON(res, 400, { success: false, message: 'Missing userId or action' });
          }

          const pet = db.prepare('SELECT * FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1').get(userId, config.TARGET_GUILD_ID);

          if (!pet && action !== 'give_custom') {
            return sendJSON(res, 404, { success: false, message: 'User tidak memiliki pet aktif!' });
          }

          if (action === 'heal') {
            const vit = pet.stat_vit || 0;
            const maxHP = (pet.pet_type === 'TURTLE' ? 120 : (pet.pet_type === 'SLIME' ? 120 : 100)) + (pet.star_level - 1) * 15 + vit * 3;
            db.prepare('UPDATE user_pets SET health = ?, hunger = 100, thirst = 100, happiness = 100 WHERE user_id = ? AND guild_id = ? AND is_active = 1')
              .run(maxHP, userId, config.TARGET_GUILD_ID);
            appendLog(`Healed pet of user ${userId}`);
            logPetAction(config.TARGET_GUILD_ID, userId, pet.pet_name, 'ADMIN_HEAL', 'Admin menyembuhkan dan mengenyangkan pet');
            sendJSON(res, 200, { success: true, message: 'Pet berhasil disembuhkan dan dikenyangkan!' });
          }
          else if (action === 'revive') {
            const vit = pet.stat_vit || 0;
            const maxHP = (pet.pet_type === 'TURTLE' ? 120 : (pet.pet_type === 'SLIME' ? 120 : 100)) + (pet.star_level - 1) * 15 + vit * 3;
            const newStatus = pet.level >= 10 ? 'ADULT' : 'BABY';
            db.prepare('UPDATE user_pets SET status = ?, health = ?, hunger = 100, thirst = 100, happiness = 100, last_interaction_at = ? WHERE user_id = ? AND guild_id = ? AND is_active = 1')
              .run(newStatus, maxHP, Math.floor(Date.now() / 1000), userId, config.TARGET_GUILD_ID);
            appendLog(`Revived pet of user ${userId}`);
            logPetAction(config.TARGET_GUILD_ID, userId, pet.pet_name, 'ADMIN_REVIVE', 'Admin menghidupkan kembali pet');
            sendJSON(res, 200, { success: true, message: 'Pet berhasil dihidupkan kembali!' });
          }
          else if (action === 'hatch') {
            db.prepare('UPDATE user_pets SET status = "BABY", hatch_at = 0, last_interaction_at = ? WHERE user_id = ? AND guild_id = ? AND is_active = 1')
              .run(Math.floor(Date.now() / 1000), userId, config.TARGET_GUILD_ID);
            appendLog(`Hatched pet egg of user ${userId}`);
            logPetAction(config.TARGET_GUILD_ID, userId, pet.pet_name, 'ADMIN_HATCH', 'Admin meneteskan telur pet instan');
            sendJSON(res, 200, { success: true, message: 'Telur pet berhasil ditetaskan!' });
          }
          else if (action === 'reset_cooldown') {
            db.prepare('UPDATE wallets SET daily_expedition_count = 0, expedition_cooldown_until = 0 WHERE user_id = ? AND guild_id = ?')
              .run(userId, config.TARGET_GUILD_ID);
            db.prepare('UPDATE user_pets SET last_interaction_at = ? WHERE user_id = ? AND guild_id = ? AND is_active = 1')
              .run(Math.floor(Date.now() / 1000), userId, config.TARGET_GUILD_ID);
            appendLog(`Reset activity cooldowns for user ${userId}`);
            logPetAction(config.TARGET_GUILD_ID, userId, pet.pet_name, 'ADMIN_RESET_COOLDOWN', 'Admin mereset cooldown ekspedisi dan aktivitas pet');
            sendJSON(res, 200, { success: true, message: 'Cooldown pet berhasil di-reset!' });
          }
          else if (action === 'level' && level) {
            db.prepare('UPDATE user_pets SET level = ?, unused_tp = unused_tp + ? WHERE user_id = ? AND guild_id = ? AND is_active = 1')
              .run(level, Math.max(0, (level - pet.level) * 3), userId, config.TARGET_GUILD_ID);
            appendLog(`Set pet level of user ${userId} to ${level}`);
            logPetAction(config.TARGET_GUILD_ID, userId, pet.pet_name, 'ADMIN_ACTION', `Admin mengubah level pet menjadi Level ${level}`);
            sendJSON(res, 200, { success: true, message: `Level pet berhasil diubah ke ${level}!` });
          }
          else if (action === 'trait' && trait) {
            db.prepare('UPDATE user_pets SET trait = ? WHERE user_id = ? AND guild_id = ? AND is_active = 1')
              .run(trait, userId, config.TARGET_GUILD_ID);
            appendLog(`Changed pet trait of user ${userId} to ${trait}`);
            logPetAction(config.TARGET_GUILD_ID, userId, pet.pet_name, 'ADMIN_ACTION', `Admin mengubah trait pet menjadi ${trait}`);
            sendJSON(res, 200, { success: true, message: `Trait pet berhasil diubah ke ${trait}!` });
          }
          else if (action === 'star' && star) {
            db.prepare('UPDATE user_pets SET star_level = ? WHERE user_id = ? AND guild_id = ? AND is_active = 1')
              .run(star, userId, config.TARGET_GUILD_ID);
            appendLog(`Forced pet star of user ${userId} to ${star}`);
            logPetAction(config.TARGET_GUILD_ID, userId, pet.pet_name, 'ADMIN_FORCE_STAR', `Admin mengubah bintang pet secara paksa menjadi ⭐${star}`);
            sendJSON(res, 200, { success: true, message: `Bintang pet berhasil diubah ke ${star}!` });
          }
          else if (action === 'toggle_autofeed') {
            const newFeed = pet.auto_feed === 2 ? 0 : 2;
            db.prepare('UPDATE user_pets SET auto_feed = ? WHERE user_id = ? AND guild_id = ? AND is_active = 1')
              .run(newFeed, userId, config.TARGET_GUILD_ID);
            appendLog(`Toggled VIP auto-feed for user ${userId} to ${newFeed}`);
            logPetAction(config.TARGET_GUILD_ID, userId, pet.pet_name, 'ADMIN_ACTION', `Admin mengubah status VIP auto-feed pet menjadi ${newFeed === 2 ? 'Aktif' : 'Nonaktif'}`);
            sendJSON(res, 200, { success: true, message: `VIP Auto-feed disetel ke ${newFeed === 2 ? 'Aktif' : 'Nonaktif'}!` });
          }
          else if (action === 'delete') {
            db.prepare('DELETE FROM user_pets WHERE user_id = ? AND guild_id = ? AND is_active = 1')
              .run(userId, config.TARGET_GUILD_ID);
            appendLog(`Deleted pet of user ${userId}`);
            logPetAction(config.TARGET_GUILD_ID, userId, pet.pet_name, 'ADMIN_DELETE', `Admin menghapus pet ${pet.pet_name} dari kandang`);
            sendJSON(res, 200, { success: true, message: 'Pet berhasil dihapus dari kandang!' });
          }
          else if (action === 'give_custom' && petName && petType) {
            const now = Math.floor(Date.now() / 1000);
            db.prepare('UPDATE user_pets SET is_active = 0 WHERE user_id = ? AND guild_id = ?').run(userId, config.TARGET_GUILD_ID);
            db.prepare(`
              INSERT INTO user_pets (user_id, guild_id, pet_name, pet_type, status, level, xp, health, hunger, thirst, happiness, last_interaction_at, star_level, is_active, created_at)
              VALUES (?, ?, ?, ?, 'BABY', ?, 0, 100, 100, 100, 100, ?, ?, 1, ?)
            `).run(userId, config.TARGET_GUILD_ID, petName, petType, level || 1, now, star || 1, now);
            appendLog(`Gave custom pet ${petName} (${petType}) to user ${userId}`);
            logPetAction(config.TARGET_GUILD_ID, userId, petName, 'ADMIN_GIVE_CUSTOM', `Admin menyuntikkan pet custom baru: ${petName} (${petType})`);
            sendJSON(res, 200, { success: true, message: 'Pet custom berhasil diberikan!' });
          }
          else if (action === 'floor' && floor) {
            db.prepare('INSERT OR REPLACE INTO user_pet_tower (user_id, guild_id, current_floor, max_floor, daily_attempts, updated_at) VALUES (?, ?, ?, ?, 0, ?)')
              .run(userId, config.TARGET_GUILD_ID, floor, Math.max(floor, pet.max_floor || 1), Math.floor(Date.now() / 1000));
            appendLog(`Set pet tower floor of user ${userId} to ${floor}`);
            logPetAction(config.TARGET_GUILD_ID, userId, pet ? pet.pet_name : '', 'ADMIN_ACTION', `Admin mengubah progress lantai menara ujian pet menjadi Lantai ${floor}`);
            sendJSON(res, 200, { success: true, message: `Lantai menara diubah ke ${floor}!` });
          }
        } catch (err) {
          sendJSON(res, 500, { success: false, message: err.message });
        }
      });
    }
    else if (pathname === '/api/admin/economy' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { action, amount, percent } = JSON.parse(body);
          if (!action) {
            return sendJSON(res, 400, { success: false, message: 'Missing action' });
          }

          if (action === 'bansos' && amount) {
            db.prepare('UPDATE wallets SET balance = balance + ? WHERE last_active_date != "" AND guild_id = ?')
              .run(amount, config.TARGET_GUILD_ID);
            appendLog(`Distributed bansos of ${amount} to all active users`);
            sendJSON(res, 200, { success: true, message: `Bansos Rp ${amount.toLocaleString('id-ID')} berhasil dibagikan!` });
          }
          else if (action === 'tax' && percent) {
            const taxPct = parseFloat(percent);
            if (isNaN(taxPct) || taxPct <= 0 || taxPct > 100) {
              return sendJSON(res, 400, { success: false, message: 'Persentase pajak tidak valid!' });
            }
            db.prepare(`
              UPDATE wallets 
              SET balance = MAX(1000, CAST(balance * (1.0 - (? / 100.0)) AS INTEGER)) 
              WHERE guild_id = ?
            `).run(taxPct, config.TARGET_GUILD_ID);
            appendLog(`Applied mass wealth tax of ${taxPct}% on wallets`);
            sendJSON(res, 200, { success: true, message: `Pajak massal sebesar ${taxPct}% berhasil ditarik!` });
          }
          else if (action === 'reset') {
            db.transaction(() => {
              db.prepare('UPDATE wallets SET balance = 1000, total_earned = 0, total_invested = 0 WHERE guild_id = ?').run(config.TARGET_GUILD_ID);
              db.prepare('DELETE FROM bank_savings WHERE guild_id = ?').run(config.TARGET_GUILD_ID);
              db.prepare('DELETE FROM bank_loans WHERE guild_id = ?').run(config.TARGET_GUILD_ID);
            })();
            appendLog('Reset all wallet and bank balances to defaults');
            sendJSON(res, 200, { success: true, message: 'Semua keuangan warga berhasil di-reset!' });
          }
          else if (action === 'reset_all') {
            db.transaction(() => {
              const guildId = config.TARGET_GUILD_ID;
              
              // 1. Reset wallets to default values and clear activity indicators/cooldowns
              db.prepare(`
                UPDATE wallets 
                SET balance = 1000, total_earned = 0, total_invested = 0, streak_days = 0, 
                    last_active_date = '', daily_expedition_count = 0, last_expedition_date = '', 
                    expedition_cooldown_until = 0, last_water_at = 0, last_rob_at = 0, 
                    wanted_until = 0, wanted_bounty = 0, last_heist_at = 0, curse_type = '', 
                    curse_until = 0, jail_until = 0, jail_type = '', jail_count = 0 
                WHERE guild_id = ?
              `).run(guildId);
              
              // 2. Clear economic, rental, and transaction data
              db.prepare('DELETE FROM bank_savings WHERE guild_id = ?').run(guildId);
              db.prepare('DELETE FROM bank_loans WHERE guild_id = ?').run(guildId);
              db.prepare('DELETE FROM portfolios WHERE guild_id = ?').run(guildId);
              db.prepare('DELETE FROM transactions WHERE guild_id = ?').run(guildId);
              db.prepare('DELETE FROM kos_rentals WHERE guild_id = ?').run(guildId);
              db.prepare('DELETE FROM kos_upgrades WHERE guild_id = ?').run(guildId);
              db.prepare('DELETE FROM bail_debts WHERE guild_id = ?').run(guildId);
              db.prepare('DELETE FROM heist_cooldown WHERE guild_id = ?').run(guildId);
              
              // 3. Clear inventories
              db.prepare('DELETE FROM user_inventory WHERE guild_id = ?').run(guildId);
              db.prepare('DELETE FROM pet_inventory WHERE guild_id = ?').run(guildId);
              db.prepare('DELETE FROM pet_item_cooldowns WHERE guild_id = ?').run(guildId);
              
              // 4. Clear pets & pet tower progress
              db.prepare('DELETE FROM user_pets WHERE guild_id = ?').run(guildId);
              db.prepare('DELETE FROM user_pet_tower WHERE guild_id = ?').run(guildId);
              
              // 5. Clear activities (garden, quests, lottery, robberies)
              db.prepare('DELETE FROM garden_slots WHERE guild_id = ?').run(guildId);
              db.prepare('DELETE FROM user_daily_quests WHERE guild_id = ?').run(guildId);
              db.prepare('DELETE FROM lottery_pool WHERE guild_id = ?').run(guildId);
              db.prepare('DELETE FROM lottery_tickets WHERE guild_id = ?').run(guildId);
              db.prepare('DELETE FROM robbery_attempts WHERE guild_id = ?').run(guildId);
              
              // 6. Clear bosses & tournaments
              db.prepare('DELETE FROM world_boss WHERE guild_id = ?').run(guildId);
              db.prepare('DELETE FROM world_boss_participants WHERE guild_id = ?').run(guildId);
              db.prepare('DELETE FROM tournament_events WHERE guild_id = ?').run(guildId);
              db.prepare('DELETE FROM tournament_participants WHERE guild_id = ?').run(guildId);
              db.prepare('DELETE FROM tournament_matches WHERE guild_id = ?').run(guildId);
              
              // 7. Clear marketplace & auctions
              db.prepare('DELETE FROM marketplace_listings WHERE guild_id = ?').run(guildId);
              db.prepare('DELETE FROM auction_bids WHERE auction_id IN (SELECT id FROM auction_items WHERE guild_id = ?)').run(guildId);
              db.prepare('DELETE FROM auction_items WHERE guild_id = ?').run(guildId);
              
              // 8. Clear user promo claims
              db.prepare('DELETE FROM promo_claims WHERE user_id IN (SELECT user_id FROM wallets WHERE guild_id = ?)').run(guildId);
            })();
            
            appendLog('Wiped out all guild user data and reset systems to clean state');
            sendJSON(res, 200, { success: true, message: 'Seluruh data warga, inventory, pet, bursa, kebun, dan turnamen berhasil di-wipe!' });
          }
        } catch (err) {
          sendJSON(res, 500, { success: false, message: err.message });
        }
      });
    }
    else if (pathname === '/api/admin/stocks' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { action, ticker, price, stockName, channelId, eventType, hours } = JSON.parse(body);
          if (!action) {
            return sendJSON(res, 400, { success: false, message: 'Missing action' });
          }

          if (action === 'add' && ticker && stockName && channelId) {
            db.prepare('INSERT INTO stocks (channel_id, guild_id, stock_name, stock_ticker, current_price, previous_price, total_shares, available_shares) VALUES (?, ?, ?, ?, ?, ?, 1000, 1000)')
              .run(channelId, config.TARGET_GUILD_ID, stockName, ticker.toUpperCase(), price || 100, price || 100);
            appendLog(`Added new stock ${ticker} (${stockName})`);
            sendJSON(res, 200, { success: true, message: `Saham ${ticker} berhasil didaftarkan!` });
          }
          else if (action === 'delete' && ticker) {
            db.prepare('DELETE FROM stocks WHERE stock_ticker = ? AND guild_id = ?').run(ticker.toUpperCase(), config.TARGET_GUILD_ID);
            appendLog(`Deleted stock ${ticker}`);
            sendJSON(res, 200, { success: true, message: `Saham ${ticker} berhasil dihapus!` });
          }
          else if (action === 'set_price' && ticker && price) {
            db.prepare('UPDATE stocks SET previous_price = current_price, current_price = ? WHERE stock_ticker = ? AND guild_id = ?')
              .run(price, ticker.toUpperCase(), config.TARGET_GUILD_ID);
            appendLog(`Set price of ${ticker} to ${price}`);
            sendJSON(res, 200, { success: true, message: `Harga saham ${ticker} disetel ke Rp ${price}!` });
          }
          else if (action === 'market_event' && eventType) {
            const duration = hours ? parseInt(hours, 10) * 3600 : 3600;
            const forceUntil = Math.floor(Date.now() / 1000) + duration;
            let trend = 'NONE';
            if (eventType === 'BULL') trend = 'PUMP';
            if (eventType === 'BEAR') trend = 'DUMP';
            if (eventType === 'CRASH') trend = 'DUMP_MIN';
            if (eventType === 'PUMP_MAX') trend = 'PUMP_MAX';
            if (eventType === 'RESET') trend = 'NONE';

            db.prepare('UPDATE stocks SET force_trend = ?, force_until = ? WHERE guild_id = ?')
              .run(trend, trend === 'NONE' ? 0 : forceUntil, config.TARGET_GUILD_ID);

            appendLog(`Market event triggered: ${eventType} (trend=${trend}) for ${duration}s`);
            sendJSON(res, 200, { 
              success: true, 
              message: trend === 'NONE' 
                ? 'Bursa saham dikembalikan ke pergerakan normal.' 
                : `Event ${eventType} berhasil dipicu untuk semua emiten saham!` 
            });
          }
        } catch (err) {
          sendJSON(res, 500, { success: false, message: err.message });
        }
      });
    }
    else if (pathname === '/api/admin/auctions' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { action, itemId, amount, minBid, hours, auctionId } = JSON.parse(body);
          if (!action) {
            return sendJSON(res, 400, { success: false, message: 'Missing action' });
          }

          if (action === 'host' && itemId && amount && minBid && hours) {
            const endsAt = Math.floor(Date.now() / 1000) + (hours * 3600);
            db.prepare('INSERT INTO auction_items (guild_id, item_type, item_id, quantity, min_bid, current_bid, ends_at, status) VALUES (?, "general", ?, ?, ?, ?, ?, "ACTIVE")')
              .run(config.TARGET_GUILD_ID, itemId, amount, minBid, minBid, endsAt);
            appendLog(`Hosted new global auction for ${amount}x ${itemId}`);
            sendJSON(res, 200, { success: true, message: 'Lelang global berhasil diluncurkan!' });
          }
          else if (action === 'cancel' && auctionId) {
            db.prepare('UPDATE auction_items SET status = "CANCELLED" WHERE id = ?').run(auctionId);
            appendLog(`Cancelled auction ID ${auctionId}`);
            sendJSON(res, 200, { success: true, message: 'Lelang berhasil dibatalkan!' });
          }
        } catch (err) {
          sendJSON(res, 500, { success: false, message: err.message });
        }
      });
    }
    else if (pathname === '/api/admin/promos' && req.method === 'GET') {
      try {
        const promos = db.prepare('SELECT * FROM promo_codes ORDER BY created_at DESC').all();
        sendJSON(res, 200, { success: true, promos });
      } catch (err) {
        sendJSON(res, 500, { success: false, message: err.message });
      }
    }
    else if (pathname === '/api/admin/promos' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { action, code, coins, itemId, itemQty, quota, expiresHours } = JSON.parse(body);
          if (!action) {
            return sendJSON(res, 400, { success: false, message: 'Missing action' });
          }

          if (action === 'create') {
            if (!code) {
              return sendJSON(res, 400, { success: false, message: 'Kode promo wajib diisi!' });
            }
            const cleanCode = code.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
            if (!cleanCode) {
              return sendJSON(res, 400, { success: false, message: 'Kode promo harus alfanumerik!' });
            }

            const pCoins = parseInt(coins, 10) || 0;
            const pItemId = itemId ? itemId.toUpperCase().trim() : null;
            const pItemQty = parseInt(itemQty, 10) || 0;
            const pQuota = parseInt(quota, 10) || -1;
            
            let pExpiresAt = 0;
            const pExpiresHours = parseInt(expiresHours, 10) || 0;
            if (pExpiresHours > 0) {
              pExpiresAt = Math.floor(Date.now() / 1000) + (pExpiresHours * 3600);
            }

            // Check if exists
            const exist = db.prepare('SELECT 1 FROM promo_codes WHERE code = ?').get(cleanCode);
            if (exist) {
              db.prepare('UPDATE promo_codes SET reward_coins = ?, reward_item_id = ?, reward_item_qty = ?, max_claims = ?, expires_at = ? WHERE code = ?')
                .run(pCoins, pItemId, pItemQty, pQuota, pExpiresAt, cleanCode);
              appendLog(`Updated promo code ${cleanCode}`);
            } else {
              db.prepare('INSERT INTO promo_codes (code, reward_coins, reward_item_id, reward_item_qty, max_claims, current_claims, expires_at) VALUES (?, ?, ?, ?, ?, 0, ?)')
                .run(cleanCode, pCoins, pItemId, pItemQty, pQuota, pExpiresAt);
              appendLog(`Created promo code ${cleanCode}`);
            }

            sendJSON(res, 200, { success: true, message: `Kode promo ${cleanCode} berhasil dibuat/diperbarui!` });
          }
          else if (action === 'delete') {
            if (!code) {
              return sendJSON(res, 400, { success: false, message: 'Missing code' });
            }
            const cleanCode = code.toUpperCase().trim();
            db.prepare('DELETE FROM promo_codes WHERE code = ?').run(cleanCode);
            db.prepare('DELETE FROM promo_claims WHERE code = ?').run(cleanCode);
            appendLog(`Deleted promo code ${cleanCode}`);
            sendJSON(res, 200, { success: true, message: `Kode promo ${cleanCode} berhasil dihapus!` });
          }
          else {
            sendJSON(res, 400, { success: false, message: 'Invalid action' });
          }
        } catch (err) {
          sendJSON(res, 500, { success: false, message: err.message });
        }
      });
    }
    else if (pathname === '/api/admin/inventory' && req.method === 'GET') {
      try {
        const userId = parsedUrl.searchParams.get('userId');
        if (!userId) {
          return sendJSON(res, 400, { success: false, message: 'Missing userId parameter' });
        }
        const userInventory = db.prepare('SELECT item_id, quantity FROM user_inventory WHERE user_id = ? AND guild_id = ?').all(userId, config.TARGET_GUILD_ID);
        const petInventory = db.prepare('SELECT item_id, quantity FROM pet_inventory WHERE user_id = ? AND guild_id = ?').all(userId, config.TARGET_GUILD_ID);
        sendJSON(res, 200, { success: true, userInventory, petInventory });
      } catch (err) {
        sendJSON(res, 500, { success: false, message: err.message });
      }
    }
    else if (pathname === '/api/admin/broadcast' && req.method === 'GET') {
      try {
        const broadcasts = db.prepare('SELECT * FROM bot_broadcasts ORDER BY created_at DESC LIMIT 30').all();
        sendJSON(res, 200, { success: true, broadcasts });
      } catch (err) {
        sendJSON(res, 500, { success: false, message: err.message });
      }
    }
    else if (pathname === '/api/admin/broadcast' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { channelId, message } = JSON.parse(body);
          if (!channelId || !message) {
            return sendJSON(res, 400, { success: false, message: 'Missing channelId or message' });
          }
          db.prepare('INSERT INTO bot_broadcasts (channel_id, message, status) VALUES (?, ?, ?)')
            .run(channelId, message, 'PENDING');
          appendLog(`Queued broadcast to channel ${channelId}`);
          sendJSON(res, 200, { success: true, message: 'Broadcast queued successfully!' });
        } catch (err) {
          sendJSON(res, 500, { success: false, message: err.message });
        }
      });
    }
    else if (pathname === '/api/admin/tables' && req.method === 'GET') {
      try {
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r => r.name);
        const schema = {};
        for (const table of tables) {
          schema[table] = db.prepare(`PRAGMA table_info(${table})`).all().map(c => ({ name: c.name, type: c.type }));
        }
        sendJSON(res, 200, { success: true, schema });
      } catch (err) {
        sendJSON(res, 500, { success: false, message: err.message });
      }
    }
    else if (pathname === '/api/admin/bot/restart' && req.method === 'POST') {
      try {
        const { exec } = require('child_process');
        appendLog('Restarting bot-2026 process via PM2 command...');
        exec('pm2 restart bot-2026', (err, stdout, stderr) => {
          if (err) {
            console.warn('Failed to restart bot via global PM2, trying npx pm2...', err.message);
            exec('npx pm2 restart bot-2026', (err2, stdout2, stderr2) => {
              if (err2) {
                appendLog(`Failed to restart bot: ${err2.message}`);
                return sendJSON(res, 500, { success: false, message: `Gagal me-restart bot: ${err2.message}` });
              }
              appendLog('Bot successfully restarted via npx pm2 restart');
              sendJSON(res, 200, { success: true, message: 'Bot berhasil di-restart!' });
            });
            return;
          }
          appendLog('Bot successfully restarted via pm2 restart');
          sendJSON(res, 200, { success: true, message: 'Bot berhasil di-restart!' });
        });
      } catch (err) {
        sendJSON(res, 500, { success: false, message: err.message });
      }
    }
    else if (pathname === '/api/admin/query' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { query } = JSON.parse(body);
          if (!query) {
            return sendJSON(res, 400, { success: false, message: 'Missing SQL query parameter' });
          }

          // Strip comments and check safety
          const cleanSql = query.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '').trim();
          const normalized = cleanSql.toUpperCase();
          
          if (!/^(SELECT|WITH)\b/.test(normalized)) {
            return sendJSON(res, 400, { success: false, message: 'Hanya query SELECT atau WITH yang diperbolehkan!' });
          }

          const forbiddenKeywords = [
            /\bINSERT\b/, /\bUPDATE\b/, /\bDELETE\b/, /\bDROP\b/,
            /\bCREATE\b/, /\bALTER\b/, /\bREPLACE\b/, /\bPRAGMA\b/,
            /\bEXEC\b/, /\bEXECUTE\b/, /\bINTO\b/
          ];

          for (const regex of forbiddenKeywords) {
            if (regex.test(normalized)) {
              return sendJSON(res, 400, { success: false, message: `Query mengandung kata kunci terlarang: ${regex.source}` });
            }
          }

          const rows = db.prepare(query).all();
          appendLog(`Executed SELECT query via SQL Console: ${query.substring(0, 100)}`);
          sendJSON(res, 200, { success: true, rows });
        } catch (err) {
          sendJSON(res, 400, { success: false, message: err.message });
        }
      });
    }
    else {
      sendJSON(res, 404, { success: false, message: 'Endpoint not found' });
    }
    return;
  }

  // Static File Server
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  
  // Safe directory check to prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const extname = path.extname(filePath);
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Web Admin Dashboard running at http://localhost:${PORT}`);
  appendLog(`Server started on port ${PORT}`);
});
