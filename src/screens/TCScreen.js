import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView, Animated, Alert, BackHandler } from 'react-native';

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
            <TouchableOpacity 
              style={[styles.button, styles.noButton]}
              onPress={handleNo}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>NO</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.button, styles.yesButton]}
              onPress={() => navigation.replace('MainMenu')}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>YES</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    padding: 24,
  },
  splashContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tcContent: {
    flex: 1,
    justifyContent: 'center',
  },
  logo: {
    width: 250,
    height: 250,
    marginBottom: 10,
  },
  studioText: {
    color: '#8b5cf6', // neon purple
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 40,
    textShadow: '0px 0px 10px rgba(139, 92, 246, 0.5)',
  },
  card: {
    backgroundColor: '#1e293b',
    padding: 24,
    borderRadius: 20,
    width: '100%',
    boxShadow: '0px 10px 20px rgba(0, 0, 0, 0.3)',
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    marginBottom: 30,
  },
  warningTitle: {
    color: '#fbbf24',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: 1,
  },
  rule: {
    color: '#94a3b8',
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 15,
    fontWeight: '500',
  },
  highlight: {
    color: '#f8fafc',
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    boxShadow: '0px 0px 15px rgba(0, 0, 0, 0.6)',
    elevation: 8,
  },
  noButton: {
    backgroundColor: '#ef4444', // red
    boxShadow: '0px 0px 15px rgba(239, 68, 68, 0.6)',
    marginRight: 10,
  },
  yesButton: {
    backgroundColor: '#8b5cf6', // neon purple
    boxShadow: '0px 0px 15px rgba(139, 92, 246, 0.6)',
    marginLeft: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.5,
  }
});
