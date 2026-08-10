import { Platform } from 'react-native';

/**
 * CARDDEN — classic casino design system.
 * Green felt, mahogany rail, brass/gold trim, ivory cards.
 * Everything visual pulls from here so the whole app reads as one table.
 */

export const COLORS = {
  // Felt
  feltDeep: '#06341d',
  felt: '#0a5232',
  feltLight: '#0f6b41',
  feltEdge: '#042415',

  // Rail / wood
  woodDark: '#2a1710',
  wood: '#4a2a18',
  woodLight: '#6b3f24',

  // Brass & gold
  gold: '#d4af37',
  goldBright: '#f4de91',
  goldDim: '#8a6f22',

  // Cards
  ivory: '#fbf7ec',
  ivoryEdge: '#ddd4bd',
  suitRed: '#b3121f',
  suitBlack: '#16181d',
  cardBackRed: '#7c1420',
  cardBackDeep: '#4d0c14',

  // UI
  ink: '#0d0f12',
  smoke: 'rgba(0,0,0,0.55)',
  cream: '#f5efe0',
  creamDim: '#bfb59c',
  danger: '#c1121f',
  success: '#2f9e58',
  chipBlue: '#1f4e8c',
};

/** Serif face for card ranks and headline numerals — reads "playing card". */
export const FONTS = {
  display: Platform.select({
    ios: 'Georgia',
    android: 'serif',
    default: 'Georgia, "Times New Roman", serif',
  }),
  ui: Platform.select({
    ios: 'Avenir Next Condensed',
    android: 'sans-serif-condensed',
    default: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  }),
};

export const RADIUS = { sm: 6, md: 10, lg: 16, xl: 24, pill: 999 };

/** Soft drop shadow that works on iOS, Android and web. */
export const shadow = (elevation = 6, color = '#000', opacity = 0.35) => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: elevation / 2 },
  shadowOpacity: opacity,
  shadowRadius: elevation,
  elevation,
});

/** Warm brass glow used for the active player / your turn. */
export const glow = (color = COLORS.gold, radius = 14, opacity = 0.75) => ({
  shadowColor: color,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: opacity,
  shadowRadius: radius,
  elevation: Platform.OS === 'android' ? 8 : 0,
});

export const SUIT_META = {
  '♥️': { glyph: '♥', red: true },
  '♦️': { glyph: '♦', red: true },
  '♣️': { glyph: '♣', red: false },
  '♠️': { glyph: '♠', red: false },
  '🔴': { glyph: '★', red: true },
  '⚫': { glyph: '★', red: false },
};

export const suitGlyph = (suit) => SUIT_META[suit]?.glyph ?? suit;
export const isRedSuit = (suit) => !!SUIT_META[suit]?.red;
