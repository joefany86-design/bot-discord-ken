const fs = require('fs');

const targetRoles = [
  '🥉 Common Prestige',
  '🥈 Rare Elite',
  '🥇 Epic Champion',
  '🔮 Primordial',
  '🌟 Zenith',
  '👑 Legendary Overlord',
  '🌟 Mythic Immortal',
  '👑The Sovereign',
  '✨ Aethelgard'
];

const reportText = fs.readFileSync('permissions_report.txt', 'utf8');
const lines = reportText.split('\n');

let currentChannel = '';
let currentRole = '';
const rolePermissions = {};

targetRoles.forEach(role => {
  rolePermissions[role] = { allowed: [], denied: [] };
});

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  if (line.startsWith('[')) {
    currentChannel = line.trim();
  } else if (line.includes('-> @')) {
    const roleMatch = line.match(/-> @(.*):/);
    if (roleMatch) {
      currentRole = roleMatch[1].trim();
    }
  } else if (line.includes('Allowed:') && currentRole) {
    const isTargetRole = targetRoles.some(r => currentRole.includes(r));
    if (isTargetRole) {
      const matchedRole = targetRoles.find(r => currentRole.includes(r));
      const allowed = line.split('Allowed: ')[1].trim();
      if (allowed !== 'None') {
        rolePermissions[matchedRole].allowed.push({ channel: currentChannel, perms: allowed });
      }
    }
  } else if (line.includes('Denied:') && currentRole) {
    const isTargetRole = targetRoles.some(r => currentRole.includes(r));
    if (isTargetRole) {
      const matchedRole = targetRoles.find(r => currentRole.includes(r));
      const denied = line.split('Denied:  ')[1].trim();
      if (denied !== 'None') {
        rolePermissions[matchedRole].denied.push({ channel: currentChannel, perms: denied });
      }
      currentRole = ''; // Reset for next role block
    }
  }
}

let markdown = `# Laporan Hak Akses Role Gacha\n\n`;

targetRoles.forEach(role => {
  markdown += `## ${role}\n`;
  const data = rolePermissions[role];
  
  if (data.allowed.length === 0 && data.denied.length === 0) {
    markdown += `- *Tidak ada permission khusus (Overwrites) diatur untuk role ini. Mengikuti izin default channel/kategori.*\n\n`;
    return;
  }

  if (data.allowed.length > 0) {
    markdown += `**✅ Diizinkan (Allowed):**\n`;
    data.allowed.forEach(item => {
      markdown += `- \`${item.channel}\`: ${item.perms}\n`;
    });
  }
  
  if (data.denied.length > 0) {
    markdown += `**❌ Dilarang (Denied):**\n`;
    data.denied.forEach(item => {
      markdown += `- \`${item.channel}\`: ${item.perms}\n`;
    });
  }
  markdown += '\n';
});

fs.writeFileSync('role_analysis_report.md', markdown);
console.log('✅ Analysis saved to role_analysis_report.md');
