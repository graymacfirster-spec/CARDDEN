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

/* ------------------------------------------------------------------ *
 * State transitions
 *
 * These are pure: they mutate the draft they are handed and return it.
 * Both the local and the online screen drive the game through these, so the
 * rules exist in exactly one place.
 * ------------------------------------------------------------------ */

export function topCardOf(state) {
  return state.discardPile[state.discardPile.length - 1];
}

export function advanceTurn(state, steps = 1) {
  const n = state.turnOrder.length;
  for (let i = 0; i < steps; i++) {
    state.currentTurnIndex = (state.currentTurnIndex + state.direction + n) % n;
  }
  return state;
}

export function checkWin(state, playerId) {
  if (state.hands[playerId]?.length === 0) {
    state.gameOver = true;
    state.winState = { winner: playerId };
  }
  return state;
}

/** Refill the draw pile from the discard pile, keeping the face-up card. */
export function reshuffleIfEmpty(state) {
  if (state.deck.length > 0) return state;
  const top = state.discardPile.pop();
  state.deck = shuffleDeck(state.discardPile);
  state.discardPile = top ? [top] : [];
  return state;
}

/**
 * How many seats the turn moves after `card` is played.
 * K holds the turn, 7 skips the next player, J reverses. In a two-player game
 * both a skip and a reverse simply hand the turn straight back.
 */
export function turnStepsFor(card, state) {
  const headsUp = state.turnOrder.length === 2;
  if (card.value === 'K') return 0;
  if (card.value === '7') return headsUp ? 0 : 2;
  if (card.value === 'J') {
    if (headsUp) return 0;
    state.direction *= -1;
    return 1;
  }
  return 1;
}

/**
 * Play an ordered run of same-value cards for `playerId`.
 * `cards` must already be ordered so the legal card leads.
 */
export function applyPlay(state, playerId, handIndices, cards, chosenSuit = null) {
  const drop = new Set(handIndices);
  state.hands[playerId] = state.hands[playerId].filter((_, i) => !drop.has(i));
  state.discardPile.push(...cards);
  state.isFreeTurn = false;
  state.calledSuit = chosenSuit || null;

  for (const card of cards) {
    if (card.value === '2') state.activePenalty += 2;
    if (card.value === 'Joker') state.activePenalty += 5;
  }

  const last = cards[cards.length - 1];
  const steps = turnStepsFor(last, state);

  if (state.hands[playerId].length > 0) advanceTurn(state, steps);
  return checkWin(state, playerId);
}

/** Draw: either eat the stacked penalty (turn ends) or take a single card. */
export function applyDraw(state, playerId) {
  reshuffleIfEmpty(state);

  if (state.activePenalty > 0) {
    const drawn = state.deck.splice(0, state.activePenalty);
    state.hands[playerId].push(...drawn);
    state.activePenalty = 0;
    advanceTurn(state, 1);
    return { state, endedTurn: true, drawnCount: drawn.length };
  }

  const card = state.deck.shift();
  if (card) state.hands[playerId].push(card);
  return { state, endedTurn: false, drawnCount: card ? 1 : 0 };
}

export function applyPass(state) {
  return advanceTurn(state, 1);
}

/** Indices in `hand` that are legal right now — used to highlight playable cards. */
export function playableIndices(hand, state) {
  const top = topCardOf(state);
  if (!top) return [];
  const out = [];
  for (let i = 0; i < hand.length; i++) {
    if (isValidPlay(hand[i], top, state.rules?.rulesForm, state.activePenalty, state.calledSuit, state.isFreeTurn)) {
      out.push(i);
    }
  }
  return out;
}
