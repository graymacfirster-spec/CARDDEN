import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, SafeAreaView, Animated, Alert, BackHandler } from 'react-native';
import FeltTable from '../components/FeltTable';
import { BrassButton } from '../components/TableUI';
import { COLORS, FONTS, RADIUS, shadow } from '../theme/casino';

export default function TCScreen({ navigation }) {
  const [step, setStep] = useState('splash');
  
  const splashOpacity = useRef(new Animated.Value(0)).current;
  const splashScale = useRef(new Animated.Value(0.5)).current;
  const tcOpacity = useRef(new Animated.Value(0)).current;
  const tcTranslateY = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // Casino-ey splash entrance (pop and fade in)
    Animated.sequence([
      Animated.parallel([
        Animated.timing(splashOpacity, { toValue: 1, duration: 1200, useNativeDriver: false }),
        Animated.spring(splashScale, { toValue: 1, friction: 4, tension: 40, useNativeDriver: false })
      ]),
      Animated.delay(2000),
      // Fade out and scale up slightly before disappearing
      Animated.parallel([
        Animated.timing(splashOpacity, { toValue: 0, duration: 800, useNativeDriver: false }),
        Animated.timing(splashScale, { toValue: 1.2, duration: 800, useNativeDriver: false })
      ])
    ]).start(() => {
      setStep('tc');
    });
  }, []);

  useEffect(() => {
    if (step === 'tc') {
      Animated.parallel([
        Animated.timing(tcOpacity, { toValue: 1, duration: 800, useNativeDriver: false }),
        Animated.spring(tcTranslateY, { toValue: 0, friction: 6, tension: 40, useNativeDriver: false })
      ]).start();
    }
  }, [step]);

  const handleNo = () => {
    Alert.alert('Access Denied', 'You must agree to the terms to play.', [
      { text: 'OK', onPress: () => BackHandler.exitApp() }
    ]);
  };

  return (
    <FeltTable>
      <SafeAreaView style={styles.container}>
      {step === 'splash' && (
        <Animated.View style={[styles.splashContent, { opacity: splashOpacity, transform: [{ scale: splashScale }] }]}>
          <Image 
            source={require('../../assets/logo.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.studioText}>DADDY RAY WE TRUST, INC.</Text>
        </Animated.View>
      )}

      {step === 'tc' && (
        <Animated.View style={[styles.tcContent, { opacity: tcOpacity, transform: [{ translateY: tcTranslateY }] }]}>
          <View style={styles.card}>
            <Text style={styles.warningTitle}>⚠️ TERMS & CONDITIONS</Text>
            
            <Text style={styles.rule}>
              1. <Text style={styles.highlight}>Ask your parents</Text> for permission before playing this game.
            </Text>
            
            <Text style={styles.rule}>
              2. Strictly <Text style={styles.highlight}>NO GAMBLING</Text> allowed. This is just for fun.
            </Text>
            
            <Text style={styles.rule}>
              3. By proceeding, you agree to release <Text style={styles.highlight}>Daddy Ray We Trust, Inc.</Text> from all liabilities. 
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <BrassButton label="I DECLINE" tone="red" onPress={handleNo} style={styles.grow} />
            <BrassButton
              label="I AGREE — DEAL ME IN"
              tone="gold"
              onPress={() => navigation.replace('MainMenu')}
              style={styles.grow}
            />
          </View>
        </Animated.View>
      )}
      </SafeAreaView>
    </FeltTable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 18,
  },
  splashContent: { alignItems: 'center', justifyContent: 'center' },
  tcContent: { flex: 1, justifyContent: 'center' },
  logo: { width: 190, height: 190, marginBottom: 6 },
  studioText: {
    fontFamily: FONTS.display,
    color: COLORS.goldBright,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 4,
    marginBottom: 20,
  },
  card: {
    backgroundColor: 'rgba(3, 26, 15, 0.78)',
    padding: 20,
    borderRadius: RADIUS.lg,
    width: '100%',
    borderWidth: 1.5,
    borderColor: COLORS.goldDim,
    marginBottom: 18,
    ...shadow(14),
  },
  warningTitle: {
    fontFamily: FONTS.display,
    color: COLORS.goldBright,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
    textAlign: 'center',
    letterSpacing: 3,
  },
  rule: {
    fontFamily: FONTS.ui,
    color: COLORS.creamDim,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 10,
  },
  highlight: { color: COLORS.cream, fontWeight: '800' },
  buttonContainer: { flexDirection: 'row', gap: 14, width: '100%' },
  grow: { flex: 1 },
});
