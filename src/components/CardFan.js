import React, { memo, useCallback, useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import PlayingCard, { CARD_ASPECT } from './PlayingCard';
import { COLORS, FONTS } from '../theme/casino';

/**
 * The "revolver" hand.
 *
 * Cards ride a circular arc whose pivot sits below the fan, so the hand reads
 * as a bridged spread. When the hand outgrows the available width the fan
 * *spins* rather than scrolling: drag or flick sideways and the cylinder
 * rotates, bringing new cards up to the focus point at top-centre. Cards are
 * never crushed together and there is never a scrollbar.
 */

const SPRING = { damping: 18, stiffness: 140, mass: 0.7 };
const SPREAD_RATIO = 0.44; // centre-to-centre gap as a share of card width
const STEP_DEG = 7; // angular pitch between neighbouring cards

function clampW(v, lo, hi) {
  'worklet';
  return Math.min(hi, Math.max(lo, v));
}

function FanCard({
  card,
  index,
  focus,
  riffle,
  radius,
  stepRad,
  cardWidth,
  cardHeight,
  selected,
  spinnable,
  onPress,
}) {
  const lift = useSharedValue(0);

  useEffect(() => {
    lift.value = withSpring(selected ? 1 : 0, SPRING);
  }, [selected, lift]);

  const animatedStyle = useAnimatedStyle(() => {
    const delta = index - focus.value;
    const angle = delta * stepRad;

    // Position on the cylinder
    const x = radius * Math.sin(angle);
    const y = radius * (1 - Math.cos(angle));

    // Riffle flourish: a travelling wave down the fan after a hard flick
    const wave = Math.sin(riffle.value * Math.PI * 2 - index * 0.55);
    const riffleLift = wave * riffle.value * cardHeight * 0.07;

    const dist = Math.abs(delta);
    // Cards away from focus recede: smaller, dimmer, tucked back
    const scale = interpolate(dist, [0, 1, 5], [1.06, 1, 0.9], Extrapolation.CLAMP);
    const opacity = spinnable
      ? interpolate(dist, [0, 4, 6.5], [1, 1, 0], Extrapolation.CLAMP)
      : 1;

    return {
      opacity,
      zIndex: Math.round(1000 - dist * 10),
      transform: [
        { translateX: x },
        { translateY: y - lift.value * cardHeight * 0.28 - riffleLift },
        { rotateZ: `${angle}rad` },
        { scale },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.cardSlot,
        { width: cardWidth, height: cardHeight, marginLeft: -cardWidth / 2 },
        animatedStyle,
      ]}
    >
      <Pressable onPress={() => onPress(index)}>
        <PlayingCard suit={card.suit} value={card.value} width={cardWidth} selected={selected} />
      </Pressable>
    </Animated.View>
  );
}

const MemoFanCard = memo(FanCard);

function CardFan({
  cards,
  selectedIndices = [],
  onCardPress,
  cardWidth = 78,
  availableWidth = 600,
  dimmed = false,
}) {
  const count = cards.length;
  const cardHeight = Math.round(cardWidth * CARD_ASPECT);

  // Fixed, readable overlap — cards are never squeezed to make them fit.
  const spacing = cardWidth * SPREAD_RATIO;
  const stepRad = (STEP_DEG * Math.PI) / 180;
  const radius = spacing / Math.sin(stepRad);

  const fanWidth = (count - 1) * spacing + cardWidth;
  const spinnable = fanWidth > availableWidth - 24 && count > 1;
  const centerIndex = (count - 1) / 2;

  const focus = useSharedValue(centerIndex);
  const riffle = useSharedValue(0);
  const startFocus = useSharedValue(0);

  // Keep focus valid as the hand grows and shrinks.
  useEffect(() => {
    if (count === 0) return;
    const target = spinnable
      ? Math.min(Math.max(focus.value, 0), count - 1)
      : centerIndex;
    focus.value = withSpring(target, SPRING);
  }, [count, spinnable, centerIndex, focus]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // Let taps through to the cards; only steal the gesture on real drags.
        .activeOffsetX([-8, 8])
        .failOffsetY([-24, 24])
        .enabled(spinnable)
        .onBegin(() => {
          startFocus.value = focus.value;
        })
        .onUpdate((e) => {
          focus.value = clampW(startFocus.value - e.translationX / spacing, -0.6, count - 0.4);
        })
        .onEnd((e) => {
          const projected = focus.value - (e.velocityX / spacing) * 0.12;
          const target = clampW(Math.round(projected), 0, count - 1);
          // Hard flick riffles the fan like a bridge shuffle.
          if (Math.abs(e.velocityX) > 900) {
            riffle.value = withSequence(
              withTiming(1, { duration: 210 }),
              withTiming(0, { duration: 260 })
            );
          }
          focus.value = withSpring(target, { ...SPRING, velocity: -e.velocityX / spacing });
        }),
    [spinnable, spacing, count, focus, startFocus, riffle]
  );

  const handlePress = useCallback(
    (index) => {
      // A card buried out at the edge spins into reach instead of being played
      // by accident.
      if (spinnable && Math.abs(index - focus.value) > 2.5) {
        focus.value = withSpring(index, SPRING);
        return;
      }
      onCardPress?.(index);
    },
    [focus, spinnable, onCardPress]
  );

  return (
    <GestureDetector gesture={pan}>
      <View
        // Tall enough for both ends of the arc to dip and for a selected card
        // to lift clear without the overflow clipping it.
        style={[styles.container, { height: cardHeight * 1.85 }, dimmed && styles.dimmed]}
        collapsable={false}
      >
        <View style={styles.pivot} pointerEvents="box-none">
          {cards.map((card, index) => (
            <MemoFanCard
              key={card.id ?? `${card.value}-${card.suit}-${index}`}
              card={card}
              index={index}
              focus={focus}
              riffle={riffle}
              radius={radius}
              stepRad={stepRad}
              cardWidth={cardWidth}
              cardHeight={cardHeight}
              selected={selectedIndices.includes(index)}
              spinnable={spinnable}
              onPress={handlePress}
            />
          ))}
        </View>

        {spinnable && (
          <View style={styles.spinHint} pointerEvents="none">
            <Text style={styles.spinHintText}>◄ SPIN THE FAN ►</Text>
          </View>
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  dimmed: { opacity: 0.55 },
  pivot: {
    position: 'absolute',
    // Headroom above the arc so a lifted (selected) card stays fully visible.
    top: '19%',
    left: '50%',
    width: 0,
    height: 0,
  },
  cardSlot: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  spinHint: {
    position: 'absolute',
    bottom: 4,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.goldDim,
  },
  spinHintText: {
    color: COLORS.goldBright,
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '700',
  },
});

export default memo(CardFan);
