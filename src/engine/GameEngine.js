export const SUITS = ['♥️', '♦️', '♣️', '♠️'];
export const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export function generateDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({ id: `${value}-${suit}`, suit, value });
    }
  }
  // Add 2 Jokers (Red and Black)
  deck.push({ id: 'Joker-Red', suit: '🔴', value: 'Joker' });
  deck.push({ id: 'Joker-Black', suit: '⚫', value: 'Joker' });
  
  return shuffleDeck(deck);
}

export function shuffleDeck(deck) {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
}

const isRed = (suit) => suit === '♥️' || suit === '♦️' || suit === '🔴';
const isBlack = (suit) => suit === '♣️' || suit === '♠️' || suit === '⚫';

export function isValidPlay(card, topCard, rulesForm, activePenalty, calledSuit, isFreeTurn = false) {
  if (activePenalty > 0) {
    if (card.value === '2' || card.value === 'Joker' || card.value === 'A') {
      return true;
    }
    return false; 
  }

  // 8 was played, color was called
  if (topCard.value === '8') {
    if (calledSuit) {
      if (card.value === 'Joker') {
         if (card.suit === '🔴') return isRed(calledSuit);
         if (card.suit === '⚫') return isBlack(calledSuit);
      }
      if (card.value === '8') {
        return isFreeTurn ? card.suit === calledSuit : true;
      }
      return card.suit === calledSuit;
    }
    return true;
  }

  // Joker was played
  if (topCard.value === 'Joker') {
    if (topCard.suit === '🔴') return isRed(card.suit);
    if (topCard.suit === '⚫') return isBlack(card.suit);
  }

  if (card.value === 'Joker') {
    if (card.suit === '🔴') return isRed(topCard.suit);
    if (card.suit === '⚫') return isBlack(topCard.suit);
  }

  if (card.value === '8') {
    return isFreeTurn ? (card.suit === topCard.suit || card.value === topCard.value) : true;
  }

  if (rulesForm === 'Form 4' && card.value === 'A' && isBlack(card.suit)) {
    return true; 
  }

  if (card.suit === topCard.suit || card.value === topCard.value) return true;

  if (topCard.value === 'A' && rulesForm === 'Form 4' && isBlack(topCard.suit)) {
    return true; 
  }
  
  return false;
}
