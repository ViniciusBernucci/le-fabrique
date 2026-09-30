const fs = require('node:fs');

const value = fs.readFileSync('result.txt', 'utf8').trim();

if (value !== 'FAC002_WRITE_OK') {
  console.error(`valor inesperado: ${value}`);
  process.exit(1);
}

console.log('FAC002_WRITE_CHECK_PASSED');
