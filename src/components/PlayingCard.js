import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, FONTS, RADIUS, isRedSuit, suitGlyph } from '../theme/casino';

/**
 * Classic casino playing card, drawn entirely with views/text (no image assets).
 * Pure + memoized: no animation drivers live here, so a 15-card fan costs 15
 * plain views. Motion is owned by whatever lays the cards out.
 */

export const CARD_ASPECT = 1.4; // poker stock: 2.5" x 3.5"
export const DEFAULT_CARD_WIDTH = 78;

/** Pip coordinates in unit space: x across 3 columns, y down the face. */
const PIP_LAYOUTS = {
  '2': [[0.5, 0], [0.5, 1]],
  '3': [[0.5, 0], [0.5, 0.5], [0.5, 1]],
  '4': [[0, 0], [1, 0], [0, 1], [1, 1]],
  '5': [[0, 0], [1, 0], [0.5, 0.5], [0, 1], [1, 1]],
  '6': [[0, 0], [1, 0], [0, 0.5], [1, 0.5], [0, 1], [1, 1]],
  '7': [[0, 0], [1, 0], [0.5, 0.25], [0, 0.5], [1, 0.5], [0, 1], [1, 1]],
  '8': [[0, 0], [1, 0], [0.5, 0.25], [0, 0.5], [1, 0.5], [0.5, 0.75], [0, 1], [1, 1]],
  '9': [
    [0, 0], [1, 0], [0, 1 / 3], [1, 1 / 3], [0.5, 0.5],
    [0, 2 / 3], [1, 2 / 3], [0, 1], [1, 1],
  ],
  '10': [
    [0, 0], [1, 0], [0.5, 1 / 6], [0, 1 / 3], [1, 1 / 3],
    [0, 2 / 3], [1, 2 / 3], [0.5, 5 / 6], [0, 1], [1, 1],
  ],
};

const COURT = { J: 'JACK', Q: 'QUEEN', K: 'KING' };

function CardBack({ w, h, style }) {
  const inset = Math.round(w * 0.07);
  return (
    <View style={[cardBase(w, h), styles.back, style]}>
      <View style={[styles.backPanel, { margin: inset, borderRadius: RADIUS.sm }]}>
        <View style={styles.backLattice}>
          {Array.from({ length: 5 }).map((_, i) => (
            <View key={i} style={[styles.backStripe, { transform: [{ rotate: '45deg' }] }]} />
          ))}
        </View>
        <View style={[styles.backMedallion, { width: w * 0.44, height: w * 0.44, borderRadius: w * 0.22 }]}>
          <Text style={[styles.backMonogram, { fontSize: w * 0.26 }]}>C</Text>
        </View>
      </View>
    </View>
  );
}

function PlayingCard({
  suit,
  value,
  isHidden = false,
  width = DEFAULT_CARD_WIDTH,
  style,
  faded = false,
  selected = false,
  playable = false,
}) {
  const w = width;
  const h = Math.round(width * CARD_ASPECT);

  if (isHidden) return <CardBack w={w} h={h} style={style} />;

  const red = isRedSuit(suit);
  const tint = red ? COLORS.suitRed : COLORS.suitBlack;
  const glyph = suitGlyph(suit);
  const isJoker = value === 'Joker';
  const rankLabel = isJoker ? '★' : value;

  const cornerSize = w * 0.19;
  const cornerSuit = w * 0.15;
  const pips = PIP_LAYOUTS[value];

  return (
    <View
      style={[
        cardBase(w, h),
        faded && styles.faded,
        selected && styles.selected,
        playable && styles.playable,
        style,
      ]}
    >
      {/* Ivory inner bevel — gives the card printed-stock depth */}
      <View style={styles.bevel} pointerEvents="none" />

      {/* Corner indices, top-left and bottom-right (rotated) */}
      <View style={[styles.corner, { top: h * 0.035, left: w * 0.06 }]}>
        <Text style={[styles.rank, { fontSize: cornerSize, color: tint }]} allowFontScaling={false}>
          {rankLabel}
        </Text>
        <Text style={[styles.cornerSuit, { fontSize: cornerSuit, color: tint }]} allowFontScaling={false}>
          {glyph}
        </Text>
      </View>
      <View
        style={[
          styles.corner,
          { bottom: h * 0.035, right: w * 0.06, transform: [{ rotate: '180deg' }] },
        ]}
      >
        <Text style={[styles.rank, { fontSize: cornerSize, color: tint }]} allowFontScaling={false}>
          {rankLabel}
        </Text>
        <Text style={[styles.cornerSuit, { fontSize: cornerSuit, color: tint }]} allowFontScaling={false}>
          {glyph}
        </Text>
      </View>

      {/* Face */}
      {isJoker ? (
        <View style={styles.faceCenter}>
          <Text style={[styles.jokerGlyph, { fontSize: w * 0.42, color: tint }]} allowFontScaling={false}>
            ☘
          </Text>
          <Text style={[styles.jokerWord, { fontSize: w * 0.13, color: tint }]} allowFontScaling={false}>
            JOKER
          </Text>
        </View>
      ) : pips ? (
        <View style={[styles.pipField, { marginHorizontal: w * 0.2, marginVertical: h * 0.13 }]}>
          {pips.map(([px, py], i) => {
            // Each pip is a fixed-size box centred on its unit coordinate, so
            // the layout is identical regardless of how the glyph measures.
            const box = w * 0.3;
            return (
              <Text
                key={i}
                allowFontScaling={false}
                style={[
                  styles.pip,
                  {
                    fontSize: w * 0.24,
                    lineHeight: box,
                    width: box,
                    height: box,
                    color: tint,
                    left: `${px * 100}%`,
                    top: `${py * 100}%`,
                    marginLeft: -box / 2,
                    marginTop: -box / 2,
                    transform: [{ rotate: py > 0.55 ? '180deg' : '0deg' }],
                  },
                ]}
              >
                {glyph}
              </Text>
            );
          })}
        </View>
      ) : (
        // A / J / Q / K — engraved center panel
        <View style={styles.faceCenter}>
          {value === 'A' ? (
            <Text style={[styles.aceGlyph, { fontSize: w * 0.56, color: tint }]} allowFontScaling={false}>
              {glyph}
            </Text>
          ) : (
            <View
              style={[
                styles.courtPanel,
                { borderColor: tint, width: w * 0.56, height: h * 0.56, borderRadius: RADIUS.sm },
              ]}
            >
              <Text style={[styles.courtSuit, { fontSize: w * 0.17, color: tint }]} allowFontScaling={false}>
                {glyph}
              </Text>
              <Text style={[styles.courtLetter, { fontSize: w * 0.34, color: tint }]} allowFontScaling={false}>
                {value}
              </Text>
              <Text
                style={[styles.courtSuit, { fontSize: w * 0.17, color: tint, transform: [{ rotate: '180deg' }] }]}
                allowFontScaling={false}
              >
                {glyph}
              </Text>
              <Text style={[styles.courtName, { fontSize: w * 0.09, color: tint }]} allowFontScaling={false}>
                {COURT[value]}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const cardBase = (w, h) => ({
  width: w,
  height: h,
  backgroundColor: COLORS.ivory,
  borderRadius: Math.max(6, w * 0.09),
  borderWidth: 1,
  borderColor: COLORS.ivoryEdge,
  overflow: 'hidden',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.4,
  shadowRadius: 5,
  elevation: 5,
});

const styles = StyleSheet.create({
  bevel: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  faded: { opacity: 0.55 },
  selected: {
    borderColor: COLORS.gold,
    borderWidth: 2,
  },
  playable: {
    borderColor: COLORS.success,
    borderWidth: 2,
  },
  corner: {
    position: 'absolute',
    alignItems: 'center',
  },
  rank: {
    fontFamily: FONTS.display,
    fontWeight: '700',
    lineHeight: undefined,
  },
  cornerSuit: {
    marginTop: -2,
    fontWeight: '600',
  },
  pipField: {
    flex: 1,
  },
  pip: {
    position: 'absolute',
    fontWeight: '600',
    textAlign: 'center',
  },
  faceCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aceGlyph: {
    fontWeight: '600',
  },
  courtPanel: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  courtLetter: {
    fontFamily: FONTS.display,
    fontWeight: '700',
  },
  courtSuit: { fontWeight: '600' },
  courtName: {
    position: 'absolute',
    bottom: 3,
    letterSpacing: 1,
    fontWeight: '700',
    opacity: 0.7,
  },
  jokerGlyph: { fontWeight: '700' },
  jokerWord: {
    fontFamily: FONTS.display,
    letterSpacing: 2,
    fontWeight: '700',
    marginTop: 2,
  },

  // Card back
  back: {
    backgroundColor: COLORS.cardBackRed,
    borderColor: COLORS.ivory,
    borderWidth: 2,
  },
  backPanel: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: COLORS.cardBackDeep,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  backLattice: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-evenly',
  },
  backStripe: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  backMedallion: {
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  backMonogram: {
    fontFamily: FONTS.display,
    color: COLORS.gold,
    fontWeight: '700',
  },
});

export default memo(PlayingCard);
