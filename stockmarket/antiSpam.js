const config = require('./config');
const db = require('./database');

// Cache memory untuk pelacakan dinamis (untuk menghindari query database yang terlalu berat)
// Struktur: { guildId: { userId: { lastMessageContent: '', repeatCount: 0, hourlyPoints: 0, hourStart: Date.now() } } }
const userSpamState = new Map();

/**
 * Validasi apakah pesan memenuhi syarat untuk menghasilkan poin ekonomi.
 * Mengembalikan true jika valid, false jika terdeteksi spam/tidak memenuhi syarat.
 */
function validateMessage(message) {
  const { author, guildId, channel, content } = message;
  
  // 1. Abaikan bot
  if (author.bot) return false;
  if (!guildId) return false;

  // 2. Abaikan channel yang dikecualikan
  const channelName = channel.name.toLowerCase();
  const isExcluded = config.antiSpam.EXCLUDED_CHANNELS.some(
    excluded => channelName.includes(excluded)
  );
  if (isExcluded) return false;

  // 3. Validasi isi pesan (Panjang minimal & Jumlah kata)
  const trimmed = content.trim();
  if (trimmed.length < config.economy.MSG_MIN_LENGTH) return false;

  const words = trimmed.split(/\s+/);
  if (words.length < config.economy.MSG_MIN_WORDS) return false;

  // Cek kata-kata unik (menghindari spam satu kata berulang-ulang: "aaaa aaaa aaaa")
  const uniqueWords = new Set(words.map(w => w.toLowerCase()));
  if (uniqueWords.size < 2) return false;

  // 4. Deteksi Spam & Cooldown
  const now = Date.now();
  const userId = author.id;

  // Ambil atau buat status user
  if (!userSpamState.has(guildId)) {
    userSpamState.set(guildId, new Map());
  }
  const guildState = userSpamState.get(guildId);
  
  if (!guildState.has(userId)) {
    guildState.set(userId, {
      lastContent: '',
      repeatCount: 0,
      hourlyPoints: 0,
      hourStart: now
    });
  }
  const userState = guildState.get(userId);

  // A. Cek duplikasi pesan berulang (Duplicate Spam)
  const messageLower = trimmed.toLowerCase();
  if (userState.lastContent === messageLower) {
    userState.repeatCount++;
    if (userState.repeatCount >= config.antiSpam.DUPLICATE_LIMIT) {
      console.log(`⚠️ Spam Terdeteksi (Duplikasi): User ${author.tag} di Guild ${guildId}`);
      return false;
    }
  } else {
    userState.lastContent = messageLower;
    userState.repeatCount = 0; // Reset jika pesannya berbeda
  }

  // B. Batasan akumulasi poin per jam (Hourly Cap)
  if (now - userState.hourStart > 60 * 60 * 1000) {
    // Reset siklus jam baru
    userState.hourStart = now;
    userState.hourlyPoints = 0;
  }
  
  if (userState.hourlyPoints >= config.antiSpam.MAX_POINTS_PER_HOUR) {
    console.log(`⚠️ Spam Terdeteksi (Hourly Cap Tercapai): User ${author.tag} di Guild ${guildId}`);
    return false;
  }

  // C. Cooldown antar pesan (30 detik)
  // Kita cek dari record database 'last_message_at' untuk persistensi data
  const wallet = db.get(
    'SELECT last_message_at FROM wallets WHERE user_id = ? AND guild_id = ?',
    [userId, guildId]
  );

  const lastMessageTimestamp = wallet ? wallet.last_message_at * 1000 : 0;
  if (now - lastMessageTimestamp < config.economy.COOLDOWN_MS) {
    return false; // Terlalu cepat mengobrol
  }

  return true;
}

/**
 * Mencatat penambahan poin ke dalam limit per jam.
 */
function recordPoints(userId, guildId, amount) {
  const guildState = userSpamState.get(guildId);
  if (guildState) {
    const userState = guildState.get(userId);
    if (userState) {
      userState.hourlyPoints += amount;
    }
  }
}

module.exports = {
  validateMessage,
  recordPoints
};
