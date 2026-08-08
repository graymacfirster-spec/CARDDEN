import { isValidPlay } from './src/engine/GameEngine.js';
console.log(isValidPlay({suit: '🔴', value: 'Joker'}, {suit: '♥️', value: '10'}, 'Form 4', 0, null));
console.log(isValidPlay({suit: '⚫', value: 'Joker'}, {suit: '♠️', value: '3'}, 'Form 4', 0, null));
