import { isValidPlay } from './src/engine/GameEngine.js';
console.log(isValidPlay({suit: '♠️', value: '5'}, {suit: '♥️', value: '10'}, 'Form 4', null));
