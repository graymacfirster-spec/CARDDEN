import fs from 'fs';
const path = './src/components/PlayingCard.js';
let code = fs.readFileSync(path, 'utf8');
code = code.replace(
  "displaySuit = suit === '🔴' ? '🔴' : '⚫';",
  "displayValue = suit === '🔴' ? '🔴' : '⚫';\n    displaySuit = '🃏';"
);
fs.writeFileSync(path, code);
