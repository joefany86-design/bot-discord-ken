/**
 * Audio / TTS Helper for Truth or Dare Game
 */
const { getVoiceConnection } = require('@discordjs/voice');

async function speak(client, guildId, text, lang = 'id') {
  try {
    const connection = getVoiceConnection(guildId);
    if (!connection) return;

    // Gunakan fungsi speakText dari client jika tersedia
    if (client.speakText) {
      await client.speakText(connection, text, guildId, lang);
    } else {
      client.emit('playTtsEvent', { guildId, text, lang });
    }
  } catch (err) {
    console.error('❌ [VoiceAudio] Gagal memutar TTS:', err.message);
  }
}

async function announceGameStart(client, guildId) {
  return speak(client, guildId, 'Sesi game Truth or Dare baru saja dibuka di lobi! Ayo bergabung.');
}

async function announceNewHotseat(client, guildId, userName) {
  return speak(client, guildId, `${userName} terpilih berada di Hot Seat! Bersiaplah menjawab.`);
}

async function announceChallengerTurn(client, guildId, challengerName, victimName) {
  return speak(client, guildId, `Kini giliran ${challengerName} untuk bertanya kepada ${victimName}.`);
}

async function announceSuccess(client, guildId, userName, reward) {
  return speak(client, guildId, `Luar biasa, ${userName} berhasil menyelesaikan tantangan dan mendapatkan tiga puluh lima koin rupiah!`);
}

async function announceSkip(client, guildId, userName, fine) {
  return speak(client, guildId, `Sayang sekali, ${userName} menyerah dan didenda dua puluh koin rupiah!`);
}

async function askTruthOrDareTTS(client, guildId, userName) {
  return speak(client, guildId, `${userName}, truth atau dare? Silakan pilih tombol di layar chat kamu.`);
}

async function readQuestionTTS(client, guildId, userName, type, questionText) {
  const intro = type === 'truth' ? 'pertanyaannya adalah' : 'tantangannya adalah';
  return speak(client, guildId, `${userName}, ${intro}: ${questionText}`);
}

module.exports = {
  speak,
  announceGameStart,
  announceNewHotseat,
  announceChallengerTurn,
  announceSuccess,
  announceSkip,
  askTruthOrDareTTS,
  readQuestionTTS
};
