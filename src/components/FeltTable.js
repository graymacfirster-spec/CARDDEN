import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RADIUS } from '../theme/casino';

/**
 * The table itself: mahogany rail, brass trim, green felt bed with a lit
 * center and a darkened vignette at the edges. Purely decorative — children
 * render on top of the felt.
 */
function FeltTable({ children, style }) {
  return (
    <View style={[styles.rail, style]}>
      <LinearGradient
        colors={[COLORS.woodLight, COLORS.wood, COLORS.woodDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.brass}>
        <LinearGradient
          colors={[COLORS.feltLight, COLORS.felt, COLORS.feltDeep]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Center spotlight */}
        <LinearGradient
          colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.02)', 'transparent']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.85 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/* Edge vignette */}
        <LinearGradient
          colors={['rgba(0,0,0,0.45)', 'transparent', 'transparent', 'rgba(0,0,0,0.5)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.35)', 'transparent', 'rgba(0,0,0,0.55)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    flex: 1,
    backgroundColor: COLORS.woodDark,
    padding: 6,
  },
  brass: {
    flex: 1,
    borderRadius: RADIUS.xl,
    borderWidth: 2,
    borderColor: COLORS.goldDim,
    overflow: 'hidden',
    backgroundColor: COLORS.felt,
  },
  content: { flex: 1 },
});

export default memo(FeltTable);
