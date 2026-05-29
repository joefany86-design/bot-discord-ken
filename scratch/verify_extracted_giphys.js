const https = require('https');

const groups = {
  EGG: ['mSuzNvPvE2KFrGpywl', 'l41lGU07rD3fMQxYQ', 'fX8zOAyerYzd3UPtBH', 'TMEkcW3BZyMZzgvGB4', 'ZKVnwPUC0i9E3oH6un', '3oEdv9R4D62GPrVY4g', 'QAzHrokGoqTk0kTVpW', 'UOCc2iuuGRtCIt5IcM'],
  DEAD: ['ukNqewtLpt81JN7SIS', 'dprajnVHVhdqo', 'xUPJPn8l1m8odg1Bxm', 'pVGsAWjzvXcZW4ZBTE', 'GXr8EtS1WY0LavZAoT', '3o7aTobMJhjgnH3Aly', 'xThuWhGG79OblPr368', 'uYsuqAWsJX8sw'],
  SLIME: ['2tTh7wB6DtL1QQvAF5', '2s4Z9TMV0oMFQsNpzn', 'YA89yckARWXC6Y6Kx4', 'bVJ2oxOOHA4BJntIFN', 'ZLSJQUIWk47IUJft2s', '3ARYgT5xzZzUhIIvWY', 'Z8ywMJLdE4N2Z6Qlta', 'KkUlEVMBL7FIJnZvrL'],
  DRAGON: ['JMqM0nNT3AXS8xuiIZ', 'Pyp923TIC4Iq4', 'bAYPxIai139Nuc4F5e', 'Xb2Bw5hUU56XsudVF8', 'TjjLhpZU4roPz4SkW5', 'RlfsTNtMxGhb4T7P07', 'asyYAYLXu5Oz4ITidu', 'AHMPR6ASCvZY17KsdB'],
  CAT: ['gx54W1mSpeYMg', 'cPZdap8PGhSvABr6xW', 'U6Xgx1pCLMPFaO0Uw3', '2wicMBKqNZlrW', 'MSemvqMIRY3jMcvpd2', 'VCP6Kpf6guFm4nnF04', '1k1ytCiReJMZWVtjXd'],
  GOLEM: ['3s4pjpA8Vb7lTy73Nn', '7ueLs2fU5c8QeeYHKg', 'yDV8j0e3cGhSoAuJ0M', '4YHLDTS2yKKZpnZ9WN', 'Ss6CM89p5n3yBYfQ0P', 'mQ2Bh0OcdxT5C', 'BU327u9UNM2Sk', 'bY1nCaREnzeI4BoKFG']
};

function checkId(id) {
  return new Promise((resolve) => {
    const url = `https://i.giphy.com/media/${id}/giphy.gif`;
    https.get(url, (res) => {
      resolve({ id, statusCode: res.statusCode, length: parseInt(res.headers['content-length'] || '0') });
    }).on('error', (err) => {
      resolve({ id, error: err.message });
    });
  });
}

async function run() {
  for (const groupName in groups) {
    console.log(`=== Group: ${groupName} ===`);
    for (const id of groups[groupName]) {
      const res = await checkId(id);
      if (res.error) {
        console.log(`  ID: ${id} -> Error: ${res.error}`);
      } else {
        const isFallback = res.length === 239321;
        console.log(`  ID: ${id} -> Status: ${res.statusCode}, Length: ${res.length} ${isFallback ? '(FALLBACK/404)' : '(VALID)'}`);
      }
    }
  }
}

run();
