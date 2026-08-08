import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';

export default function PlayingCard({ suit, value, isHidden, style, isStacked = false }) {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 10, stiffness: 100 });
    opacity.value = withTiming(1, { duration: 300 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  const isRed = suit === '♥️' || suit === '♦️' || suit === '🔴';
  
  let displaySuit = suit;
  let displayValue = value;
  
  if (value === 'Joker') {
    displayValue = 'J';
    displayValue = suit === '🔴' ? '🔴' : '⚫';
    displaySuit = '🃏';
  }

  if (isHidden) {
    return (
      <Animated.View style={[styles.card, styles.hiddenCard, animatedStyle, style]}>
        <View style={styles.cardBackPattern}>
          <Text style={styles.cardBackText}>R</Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.card, animatedStyle, style, isStacked && styles.stacked]}>
      <Text style={[styles.topCorner, isRed ? styles.redText : styles.blackText]}>
        {displayValue}
      </Text>
      <Text style={[styles.centerSuit, isRed ? styles.redText : styles.blackText]}>{displaySuit}</Text>
      <Text style={[styles.bottomCorner, isRed ? styles.redText : styles.blackText]}>
        {displayValue}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 90,
    height: 130,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  hiddenCard: {
    backgroundColor: '#8b5cf6', // neon purple back
    borderColor: '#6d28d9',
  },
  cardBackPattern: {
    width: '85%',
    height: '85%',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBackText: {
    color: 'white',
    fontSize: 40,
    fontWeight: '900',
    opacity: 0.5,
  },
  stacked: {
    shadowOffset: { width: -2, height: -2 },
  },
  topCorner: {
    position: 'absolute',
    top: 5,
    left: 8,
    fontSize: 18,
    fontWeight: 'bold',
  },
  bottomCorner: {
    position: 'absolute',
    bottom: 5,
    right: 8,
    fontSize: 18,
    fontWeight: 'bold',
    transform: [{ rotate: '180deg' }],
  },
  centerSuit: {
    fontSize: 45,
  },
  redText: {
    color: '#ef4444',
  },
  blackText: {
    color: '#0f172a',
  },
});
