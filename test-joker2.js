import { isValidPlay } from './src/engine/GameEngine.js';
console.log('Test 1:', isValidPlay({suit: '🔴', value: 'Joker'}, {suit: '♥️', value: '3'}, 'Form 4', 0, null));
console.log('Test 2:', isValidPlay({suit: '⚫', value: 'Joker'}, {suit: '♠️', value: '3'}, 'Form 4', 0, null));
console.log('Test 3 (Invalid):', isValidPlay({suit: '🔴', value: 'Joker'}, {suit: '♠️', value: '3'}, 'Form 4', 0, null));
