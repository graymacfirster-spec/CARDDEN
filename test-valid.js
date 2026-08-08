import { isValidPlay } from './src/engine/GameEngine.js';
console.log(isValidPlay({suit: '♣️', value: 'K'}, {suit: '♥️', value: '5'}, 'Form 4', 0, null));
