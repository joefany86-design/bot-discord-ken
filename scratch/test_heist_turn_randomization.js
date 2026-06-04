// Verification script for Heist Turn Randomization and Dynamic Role Assignment

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function generateHeistSteps(participants) {
  const kruCount = participants.length;
  const steps = [];

  if (kruCount === 1) {
    // Solo heist
    steps.push({
      roleName: 'Hacker',
      title: '💻 Peretas Keamanan (Hacker)',
      desc: '💻 **Tugas:** Bobol firewall bank! Tekan tombol di bawah untuk melumpuhkan sistem alarm digital.',
      buttonLabel: '💻 Jalankan Hack',
      buttonId: 'heist_qte_hacker',
      targetUserId: participants[0]
    });
    steps.push({
      roleName: 'Peledak',
      title: '🧨 Ahli Peledak (Demolition)',
      desc: '🧨 **Tugas:** Pasang dan ledakkan thermite di pintu brankas utama! Tekan tombol di bawah untuk meledakkan pintu.',
      buttonLabel: '🧨 Ledakkan Pintu',
      buttonId: 'heist_qte_peledak',
      targetUserId: participants[0]
    });
    steps.push({
      roleName: 'Supir',
      title: '🚗 Pembalap Pelarian (Driver)',
      desc: '🚗 **Tugas:** Polisi datang mengepung! Tancap gas dan bawa kabur uang jarahannya! Tekan tombol di bawah untuk tancap gas.',
      buttonLabel: '🚗 Tancap Gas',
      buttonId: 'heist_qte_driver',
      targetUserId: participants[0]
    });
  } else {
    // Multiplayer heist
    const shuffledParticipants = shuffleArray(participants);

    // Step 1: Hacker
    steps.push({
      roleName: 'Hacker',
      title: '💻 Peretas Keamanan (Hacker)',
      desc: '💻 **Tugas:** Bobol firewall bank! Tekan tombol di bawah untuk melumpuhkan sistem alarm digital.',
      buttonLabel: '💻 Jalankan Hack',
      buttonId: 'heist_qte_hacker',
      targetUserId: shuffledParticipants[0]
    });

    // Middle Steps: shuffledParticipants[1] to shuffledParticipants[kruCount - 2]
    const middleRoles = [
      {
        roleName: 'Peledak',
        title: '🧨 Ahli Peledak (Demolition)',
        desc: '🧨 **Tugas:** Pasang dan ledakkan thermite di pintu brankas utama! Tekan tombol di bawah untuk meledakkan pintu.',
        buttonLabel: '🧨 Ledakkan Pintu',
        buttonId: 'heist_qte_peledak'
      },
      {
        roleName: 'Eksekutor',
        title: '🔫 Jaga Sandera (Enforcer)',
        desc: '🔫 **Tugas:** Jaga sandera dan lumpuhkan petugas keamanan yang mencoba melawan! Tekan tombol di bawah untuk menembak.',
        buttonLabel: '🔫 Lumpuhkan Penjaga',
        buttonId: 'heist_qte_enforcer'
      },
      {
        roleName: 'Lockpicker',
        title: '🗝️ Ahli Cungkil Brankas (Lockpicker)',
        desc: '🗝️ **Tugas:** Cungkil laci emas tambahan dan isi tas jarahan! Tekan tombol di bawah untuk membobol kunci.',
        buttonLabel: '🗝️ Bobol Laci Emas',
        buttonId: 'heist_qte_lockpicker'
      },
      {
        roleName: 'Spotter',
        title: '🚁 Pemantau Lapangan (Spotter)',
        desc: '🚁 **Tugas:** Pantau pergerakan patroli polisi dari atas helikopter! Tekan tombol di bawah untuk memberikan rute aman.',
        buttonLabel: '🚁 Berikan Rute Aman',
        buttonId: 'heist_qte_spotter'
      },
      {
        roleName: 'Cleaner',
        title: '🧼 Pembersih TKP (Cleaner)',
        desc: '🧼 **Tugas:** Bersihkan sidik jari dan barang bukti di TKP! Tekan tombol di bawah untuk menyeka jejak.',
        buttonLabel: '🧼 Bersihkan Jejak',
        buttonId: 'heist_qte_cleaner'
      },
      {
        roleName: 'Decoy',
        title: '💨 Pengalih Perhatian (Decoy)',
        desc: '💨 **Tugas:** Ledakkan bom asap di lobi depan untuk mengalihkan perhatian polisi! Tekan tombol di bawah untuk melempar asap.',
        buttonLabel: '💨 Lempar Bom Asap',
        buttonId: 'heist_qte_decoy'
      },
      {
        roleName: 'Bagman',
        title: '👜 Pengangkut Jarahan (Bagman)',
        desc: '👜 **Tugas:** Angkut kantong koin jarahan ke bagasi mobil dengan cepat! Tekan tombol di bawah untuk melempar tas.',
        buttonLabel: '👜 Lempar Tas Jarahan',
        buttonId: 'heist_qte_bagman'
      },
      {
        roleName: 'Negotiator',
        title: '📞 Negosiator Sandera (Negotiator)',
        desc: '📞 **Tugas:** Berbicara di telepon dengan kepolisian untuk mengulur waktu pelarian! Tekan tombol di bawah untuk bernegosiasi.',
        buttonLabel: '📞 Ulur Waktu',
        buttonId: 'heist_qte_negotiator'
      }
    ];

    const shuffledMiddleRoles = shuffleArray(middleRoles);

    for (let i = 1; i < kruCount - 1; i++) {
      const roleTemplate = shuffledMiddleRoles[(i - 1) % shuffledMiddleRoles.length];
      steps.push({
        ...roleTemplate,
        targetUserId: shuffledParticipants[i]
      });
    }

    // Step N: Supir
    steps.push({
      roleName: 'Supir',
      title: '🚗 Pembalap Pelarian (Driver)',
      desc: '🚗 **Tugas:** Polisi datang mengepung! Tancap gas dan bawa kabur uang jarahannya! Tekan tombol di bawah untuk tancap gas.',
      buttonLabel: '🚗 Tancap Gas',
      buttonId: 'heist_qte_driver',
      targetUserId: shuffledParticipants[kruCount - 1]
    });
  }

  return { steps, participants };
}

function runTests() {
  console.log("=== RUNNING HEIST TURN RANDOMIZATION TESTS ===");

  const testCases = [
    { name: "Solo Heist", participants: ["UserA"] },
    { name: "2-Player Heist", participants: ["UserA", "UserB"] },
    { name: "3-Player Heist", participants: ["UserA", "UserB", "UserC"] },
    { name: "5-Player Heist", participants: ["UserA", "UserB", "UserC", "UserD", "UserE"] },
    { name: "10-Player Heist", participants: ["User1", "User2", "User3", "User4", "User5", "User6", "User7", "User8", "User9", "User10"] }
  ];

  testCases.forEach(tc => {
    console.log(`\nTesting: ${tc.name} (${tc.participants.length} players)`);
    const { steps } = generateHeistSteps(tc.participants);

    if (tc.participants.length === 1) {
      console.log(`- Expected: 3 steps, all UserA.`);
      console.log(`- Actual: ${steps.length} steps.`);
      steps.forEach((s, idx) => console.log(`  Step ${idx + 1}: ${s.roleName} -> ${s.targetUserId}`));
      if (steps.length === 3 && steps.every(s => s.targetUserId === "UserA")) {
        console.log("✅ Solo test passed.");
      } else {
        console.error("❌ Solo test failed.");
      }
    } else {
      console.log(`- Expected: ${tc.participants.length} steps. Every player assigned exactly once.`);
      console.log(`- Actual: ${steps.length} steps.`);
      
      const assignedUsers = steps.map(s => s.targetUserId);
      const uniqueAssigned = [...new Set(assignedUsers)];
      
      steps.forEach((s, idx) => console.log(`  Step ${idx + 1}: ${s.roleName} -> ${s.targetUserId}`));

      // Check first is Hacker
      const firstRoleCorrect = steps[0].roleName === 'Hacker';
      // Check last is Supir
      const lastRoleCorrect = steps[steps.length - 1].roleName === 'Supir';
      // Check unique players count
      const correctUniqueCount = uniqueAssigned.length === tc.participants.length;

      if (firstRoleCorrect && lastRoleCorrect && correctUniqueCount && steps.length === tc.participants.length) {
        console.log("✅ Multiplayer test passed.");
      } else {
        console.error(`❌ Multiplayer test failed. First role: ${steps[0].roleName} (expected Hacker), Last role: ${steps[steps.length - 1].roleName} (expected Supir), Unique assigned: ${uniqueAssigned.length} (expected ${tc.participants.length})`);
      }
    }
  });

  console.log("\n=== Testing Randomization (Running 3-Player 5 times to see shuffle variation) ===");
  for (let i = 0; i < 5; i++) {
    const { steps } = generateHeistSteps(["UserA", "UserB", "UserC"]);
    const sequence = steps.map(s => s.targetUserId).join(" -> ");
    console.log(`Run ${i + 1}: ${sequence}`);
  }
}

runTests();
