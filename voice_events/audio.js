const { getVoiceConnection } = require('@discordjs/voice');

/**
 * Menyuarakan teks via TTS dengan aman (mendukung Promise Await).
 * @param {Client} client - Instance Discord Client.
 * @param {string} guildId - Server ID.
 * @param {string} text - Teks yang akan diucapkan.
 */
async function speak(client, guildId, text) {
  const connection = getVoiceConnection(guildId);
  if (!connection) {
    console.log(`[VoiceAudio] Batal speak: Bot tidak terhubung ke voice channel di guild ${guildId}`);
    return;
  }

  if (typeof client.speakText === 'function') {
    // Memanggil fungsi speakText yang diekspor dari index.js untuk bisa di-await
    await client.speakText(connection, text, guildId, 'id');
  } else {
    // Fallback ke emit event jika tidak terekspos secara langsung
    client.emit('playTtsEvent', { guildId, text, lang: 'id' });
    // Berikan jeda perkiraan agar suara selesai
    await new Promise(resolve => setTimeout(resolve, text.length * 90)); 
  }
}

/**
 * Pengumuman saat game Truth or Dare dimulai.
 */
async function announceGameStart(client, guildId) {
  await speak(
    client, 
    guildId, 
    "Game Truth or Dare klasik dimulai! Bersiaplah, botol sedang diputar untuk memilih pemain!"
  );
}

/**
 * Pengumuman saat giliran pemain terpilih.
 */
async function announcePlayerSelection(client, guildId, victimName, challengerName) {
  const text = `Giliran telah ditentukan! Korban terpilih adalah ${victimName}. Dan penanya adalah ${challengerName}. Hei ${victimName}, tentukan pilihanmu sekarang! Ketik titik truth atau titik dare!`;
  await speak(client, guildId, text);
}

/**
 * Pengumuman pertanyaan Truth atau Dare.
 */
async function announceQuestion(client, guildId, type, questionText) {
  const cleanText = questionText.replace(/\[Klasik\]|\[Seru\]|\[Tantangan\]|\[Jujur\]|\[Koran Server\]|\[Spesial VC\]/g, '').trim();
  const intro = type === 'truth' ? "Pertanyaan jujur untukmu:" : "Tantangan berani untukmu:";
  await speak(client, guildId, `${intro} ${cleanText}`);
}

/**
 * Pengumuman sukses menyelesaikan tantangan.
 */
async function announceSuccess(client, guildId, playerName, reward) {
  await speak(
    client, 
    guildId, 
    `Selamat kepada ${playerName}! Kamu berhasil menyelesaikan tantangan dan mendapatkan hadiah sebesar ${reward} Rupiah!`
  );
}

/**
 * Pengumuman jika pemain menyerah/skip.
 */
async function announceSkip(client, guildId, playerName, fine) {
  await speak(
    client, 
    guildId, 
    `Aduh, sayang sekali ${playerName} menyerah! Kamu dikenakan denda pelanggaran sebesar ${fine} Rupiah!`
  );
}

module.exports = {
  speak,
  announceGameStart,
  announcePlayerSelection,
  announceQuestion,
  announceSuccess,
  announceSkip
};
