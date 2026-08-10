import React, { memo, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { COLORS, FONTS, RADIUS, glow, shadow } from '../theme/casino';

/** Brass-rimmed action button — the only button style at the table. */
export const BrassButton = memo(function BrassButton({
  label,
  onPress,
  tone = 'gold',
  disabled = false,
  compact = false,
  style,
}) {
  const press = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.05 }],
  }));

  const palette = {
    gold: [COLORS.goldBright, COLORS.gold, COLORS.goldDim],
    green: ['#48c07a', COLORS.success, '#1c6c3c'],
    red: ['#e2565f', COLORS.danger, '#7d0c15'],
    slate: ['#5b6472', '#39414d', '#1e232b'],
  }[tone];

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={() => (press.value = withTiming(1, { duration: 80 }))}
      onPressOut={() => (press.value = withSpring(0))}
      disabled={disabled}
      style={style}
    >
      <Animated.View
        style={[
          styles.btn,
          compact && styles.btnCompact,
          disabled && styles.btnDisabled,
          animated,
          !disabled && glow(palette[1], 10, 0.5),
        ]}
      >
        <LinearGradient colors={palette} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
        <Text
          style={[
            styles.btnText,
            compact && styles.btnTextCompact,
            tone === 'gold' ? styles.btnTextDark : styles.btnTextLight,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
});

/** One opponent's place at the table. */
export const PlayerSeat = memo(function PlayerSeat({
  name,
  cardCount,
  isTurn,
  isSpeaking,
  inVoice,
  compact = false,
}) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (isTurn) {
      pulse.value = withRepeat(
        withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 900 })),
        -1,
        false
      );
    } else {
      pulse.value = withTiming(0, { duration: 200 });
    }
  }, [isTurn, pulse]);

  const halo = useAnimatedStyle(() => ({
    opacity: 0.25 + pulse.value * 0.5,
    transform: [{ scale: 1 + pulse.value * 0.04 }],
  }));

  return (
    <View style={[styles.seat, compact && styles.seatCompact, isTurn && styles.seatActive]}>
      {isTurn && <Animated.View style={[styles.seatHalo, halo]} pointerEvents="none" />}

      <View style={styles.seatNameRow}>
        {inVoice && (
          <View style={[styles.micDot, isSpeaking && styles.micDotLive]}>
            <Text style={styles.micGlyph}>🎙</Text>
          </View>
        )}
        <Text style={[styles.seatName, compact && styles.seatNameCompact]} numberOfLines={1}>
          {name}
        </Text>
      </View>

      <View style={styles.seatCountRow}>
        <Text style={[styles.seatCount, compact && styles.seatCountCompact]}>{cardCount}</Text>
        <Text style={styles.seatCountLabel}>{cardCount === 1 ? 'CARD' : 'CARDS'}</Text>
      </View>

      {cardCount === 1 && (
        <View style={styles.checkPill}>
          <Text style={styles.checkPillText}>CHECK</Text>
        </View>
      )}
    </View>
  );
});

/** Engraved brass plaque used for the turn banner and headings. */
export const Plaque = memo(function Plaque({ children, tone = 'neutral', style }) {
  return (
    <View
      style={[
        styles.plaque,
        tone === 'live' && styles.plaqueLive,
        tone === 'warn' && styles.plaqueWarn,
        style,
      ]}
    >
      {children}
    </View>
  );
});

export const styles = StyleSheet.create({
  btn: {
    minWidth: 96,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadow(5),
  },
  btnCompact: {
    minWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: {
    fontFamily: FONTS.ui,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  btnTextCompact: { fontSize: 11, letterSpacing: 1.1 },
  btnTextDark: { color: '#2b2004' },
  btnTextLight: { color: '#fff' },

  seat: {
    minWidth: 96,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.goldDim,
    backgroundColor: 'rgba(4, 32, 19, 0.82)',
    alignItems: 'center',
    ...shadow(4),
  },
  seatCompact: { minWidth: 78, paddingHorizontal: 8, paddingVertical: 5 },
  seatActive: { borderColor: COLORS.goldBright },
  seatHalo: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.goldBright,
  },
  seatNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seatName: {
    fontFamily: FONTS.ui,
    color: COLORS.cream,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    maxWidth: 92,
  },
  seatNameCompact: { fontSize: 10, maxWidth: 68 },
  seatCountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  seatCount: {
    fontFamily: FONTS.display,
    color: COLORS.goldBright,
    fontSize: 24,
    fontWeight: '700',
  },
  seatCountCompact: { fontSize: 19 },
  seatCountLabel: {
    fontFamily: FONTS.ui,
    color: COLORS.creamDim,
    fontSize: 8,
    letterSpacing: 1.4,
    fontWeight: '700',
  },
  checkPill: {
    position: 'absolute',
    top: -8,
    right: -6,
    backgroundColor: COLORS.danger,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.goldBright,
  },
  checkPillText: {
    fontFamily: FONTS.ui,
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  micDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micDotLive: {
    backgroundColor: COLORS.success,
    ...glow(COLORS.success, 8, 0.9),
  },
  micGlyph: { fontSize: 8 },

  plaque: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.goldDim,
    backgroundColor: 'rgba(0,0,0,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plaqueLive: {
    borderColor: COLORS.goldBright,
    backgroundColor: 'rgba(122, 92, 8, 0.4)',
  },
  plaqueWarn: {
    borderColor: COLORS.danger,
    backgroundColor: 'rgba(122, 12, 20, 0.45)',
  },
});
