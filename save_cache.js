// Usage: node save_cache.js <filename> < data.json
const fs = require('fs');
const path = require('path');
const filename = process.argv[2];
if (!filename) { console.error('Usage: node save_cache.js <filename>'); process.exit(1); }
const fp = path.join(__dirname, 'server', 'cache', filename);
const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  const data = JSON.parse(Buffer.concat(chunks).toString());
  fs.writeFileSync(fp, JSON.stringify(data, null, 2));
  console.log(`Saved ${data.length} rows to ${fp}`);
});
