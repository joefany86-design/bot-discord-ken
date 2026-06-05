const http = require('http');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const config = require('../stockmarket/config');

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DB_PATH = config.DATABASE_PATH;
const LOG_FILE = path.join(__dirname, 'server.log');

let db;
try {
  db = new Database(DB_PATH, { fileMustExist: false });
  console.log(`✅ Web Server SQLite connected at: ${DB_PATH}`);
} catch (err) {
  console.error(`❌ Web Server failed to connect to database: ${err.message}`);
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
            w.balance as wallet_balance,
            COALESCE(bs.balance, 0) as bank_balance,
            w.last_active_date,
            (SELECT COUNT(*) FROM bot_blacklist b WHERE b.user_id = w.user_id) as is_blacklisted
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
        { id: 'AMULET', name: '📿 Amulet Proteksi Pet', category: 'pet', description: 'Amulet mistis penangkal kematian pet' }
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
              if (!exist) {
                db.prepare('INSERT INTO user_inventory (user_id, guild_id, item_id, quantity) VALUES (?, ?, ?, ?)').run(userId, guildId, target, newQty);
              } else {
                db.prepare('UPDATE user_inventory SET quantity = ? WHERE user_id = ? AND guild_id = ? AND item_id = ?').run(newQty, userId, guildId, target);
              }
            } 
            else if (category === 'pet_item') {
              const exist = db.prepare('SELECT quantity FROM pet_inventory WHERE user_id = ? AND guild_id = ? AND item_id = ?').get(userId, guildId, target);
              const newQty = Math.max(0, (exist ? exist.quantity : 0) + amount);
              if (!exist) {
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
