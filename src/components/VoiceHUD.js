import React, { memo, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { COLORS, FONTS, RADIUS, glow, shadow } from '../theme/casino';

/**
 * Compact live-voice control cluster: join, mute, deafen — plus a level ring
 * that lights while you are transmitting.
 */
function VoiceHUD({
  supported,
  unavailableReason,
  joined,
  muted,
  deafened,
  error,
  selfSpeaking,
  peerCount,
  onJoin,
  onLeave,
  onToggleMute,
  onToggleDeafen,
}) {
  const ring = useSharedValue(0);

  useEffect(() => {
    if (selfSpeaking && !muted) {
      ring.value = withRepeat(
        withSequence(withTiming(1, { duration: 240 }), withTiming(0.35, { duration: 240 })),
        -1,
        true
      );
    } else {
      ring.value = withTiming(0, { duration: 180 });
    }
  }, [selfSpeaking, muted, ring]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value,
    transform: [{ scale: 1 + ring.value * 0.18 }],
  }));

  if (!supported) {
    return (
      <View style={[styles.wrap, styles.disabledWrap]}>
        <Text style={styles.disabledText} numberOfLines={2}>
          {unavailableReason ?? 'Voice unavailable'}
        </Text>
      </View>
    );
  }

  if (!joined) {
    return (
      <Pressable onPress={onJoin} style={[styles.wrap, styles.joinWrap]}>
        <Text style={styles.micGlyph}>🎧</Text>
        <Text style={styles.joinText}>JOIN VOICE</Text>
        {!!error && (
          <Text style={styles.errText} numberOfLines={1}>
            {error}
          </Text>
        )}
      </Pressable>
    );
  }

  return (
    <View style={styles.wrap}>
      <Pressable onPress={onToggleMute} style={styles.micButton}>
        <Animated.View style={[styles.speakRing, ringStyle]} pointerEvents="none" />
        <View style={[styles.micInner, muted && styles.micInnerMuted]}>
          <Text style={styles.micGlyph}>{muted ? '🔇' : '🎙'}</Text>
        </View>
      </Pressable>

      <Pressable onPress={onToggleDeafen} style={[styles.chip, deafened && styles.chipOff]}>
        <Text style={styles.chipText}>{deafened ? 'DEAF' : 'HEAR'}</Text>
      </Pressable>

      <View style={styles.chip}>
        <Text style={styles.chipText}>{peerCount}</Text>
      </View>

      <Pressable onPress={onLeave} style={[styles.chip, styles.chipLeave]}>
        <Text style={styles.chipText}>EXIT</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.goldDim,
    backgroundColor: 'rgba(0,0,0,0.45)',
    ...shadow(4),
  },
  joinWrap: { paddingHorizontal: 12, gap: 6 },
  disabledWrap: { maxWidth: 190, borderColor: 'rgba(255,255,255,0.15)' },
  disabledText: {
    fontFamily: FONTS.ui,
    color: COLORS.creamDim,
    fontSize: 9,
    lineHeight: 12,
  },
  joinText: {
    fontFamily: FONTS.ui,
    color: COLORS.goldBright,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  errText: {
    fontFamily: FONTS.ui,
    color: COLORS.danger,
    fontSize: 9,
    maxWidth: 120,
  },
  micButton: { alignItems: 'center', justifyContent: 'center' },
  speakRing: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: COLORS.success,
    ...glow(COLORS.success, 10, 1),
  },
  micInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success,
  },
  micInnerMuted: { backgroundColor: COLORS.danger },
  micGlyph: { fontSize: 13 },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  chipOff: { backgroundColor: 'rgba(193,18,31,0.35)', borderColor: COLORS.danger },
  chipLeave: { backgroundColor: 'rgba(0,0,0,0.4)' },
  chipText: {
    fontFamily: FONTS.ui,
    color: COLORS.cream,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
});

export default memo(VoiceHUD);
