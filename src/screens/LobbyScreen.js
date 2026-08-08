import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, TextInput, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function LobbyScreen({ navigation }) {
  const [playerName, setPlayerName] = useState('');
  const [selectedRule, setSelectedRule] = useState('Form 4');
  const [playerCount, setPlayerCount] = useState(4);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [startingCards, setStartingCards] = useState('7');

  const handleStartGame = () => {
    const numCards = parseInt(startingCards, 10);
    if (isNaN(numCards) || numCards < 1) {
      Alert.alert("Invalid Input", "Please enter a valid number for starting cards.");
      return;
    }
    const maxCards = Math.floor(53 / playerCount);
    if (numCards > maxCards) {
      Alert.alert("Invalid Input", `The deck only has 54 cards. With ${playerCount} players, you can only start with up to ${maxCards} cards each to have equal amounts!`);
      return;
    }

    navigation.navigate('Game', { 
      playerName: playerName || 'Player 1', 
      rules: selectedRule,
      playerCount,
      chatEnabled,
      startingCards: numCards
    });
  };

  return (
    <LinearGradient colors={['#050814', '#0a0b10']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.content}>
          <Text style={styles.title}>CARDDEN</Text>
          <Text style={styles.subtitle}>Enter the game and play with your friends</Text>

        <View style={styles.inputRow}>
          <View style={[styles.inputContainer, { flex: 1, marginRight: 15 }]}>
            <Text style={styles.label}>YOUR NAME</Text>
            <TextInput 
              style={styles.input}
              placeholder="e.g. Daddy Ray"
              placeholderTextColor="#475569"
              value={playerName}
              onChangeText={setPlayerName}
            />
          </View>

          <View style={[styles.inputContainer, { width: 100 }]}>
            <Text style={styles.label}>CARDS</Text>
            <TextInput 
              style={[styles.input, { textAlign: 'center' }]}
              keyboardType="number-pad"
              value={startingCards}
              onChangeText={setStartingCards}
              maxLength={2}
            />
          </View>
        </View>

        {/* Game Settings Grid */}
        <View style={styles.settingsGrid}>
          {/* Player Count */}
          <View style={styles.settingBlock}>
            <Text style={styles.label}>PLAYERS</Text>
            <View style={styles.playerCountContainer}>
              {[2, 3, 4].map(num => (
                <TouchableOpacity 
                  key={num}
                  style={[styles.countBtn, playerCount === num && styles.countBtnActive]}
                  onPress={() => setPlayerCount(num)}
                >
                  <Text style={[styles.countBtnText, playerCount === num && styles.countBtnTextActive]}>{num}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Chat Toggle */}
          <View style={styles.settingBlock}>
            <Text style={styles.label}>CHAT ENABLED</Text>
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>{chatEnabled ? 'ON' : 'OFF'}</Text>
              <Switch 
                value={chatEnabled}
                onValueChange={setChatEnabled}
                trackColor={{ false: '#334155', true: '#ff00ea' }}
                thumbColor={chatEnabled ? '#f8fafc' : '#94a3b8'}
              />
            </View>
          </View>
        </View>

        <View style={styles.rulesContainer}>
          <Text style={styles.label}>SELECT RULES</Text>
          <View style={styles.ruleButtons}>
            <TouchableOpacity 
              style={[styles.ruleBtn, selectedRule === 'Form 4' && styles.ruleBtnActive]}
              onPress={() => setSelectedRule('Form 4')}
            >
              <Text style={[styles.ruleBtnText, selectedRule === 'Form 4' && styles.ruleBtnTextActive]}>Form 4 Rules</Text>
              <Text style={styles.ruleDesc}>Black A is Universal. Cannot win with power cards.</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.ruleBtn, selectedRule === 'Form 3' && styles.ruleBtnActive]}
              onPress={() => setSelectedRule('Form 3')}
            >
              <Text style={[styles.ruleBtnText, selectedRule === 'Form 3' && styles.ruleBtnTextActive]}>Form 3 Rules</Text>
              <Text style={styles.ruleDesc}>Black A is normal. Normal checkout rules.</Text>
            </TouchableOpacity>
          </View>
        </View>

      </KeyboardAvoidingView>

      <TouchableOpacity 
        style={[styles.playButton, !playerName.trim() && styles.playButtonDisabled]}
        onPress={handleStartGame}
        activeOpacity={0.8}
        disabled={!playerName.trim()}
      >
        <Text style={[styles.playButtonText, !playerName.trim() && styles.playButtonTextDisabled]}>HOST GAME</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    padding: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  title: {
    fontFamily: Platform.OS === 'ios' ? 'Impact' : 'sans-serif-black',
    color: '#00e5ff',
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: 4,
    marginBottom: 5,
    textShadowColor: 'rgba(0, 229, 255, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  subtitle: {
    fontFamily: Platform.OS === 'ios' ? 'Impact' : 'sans-serif-black',
    color: '#e2e8f0',
    fontSize: 16,
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  settingsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    gap: 15,
  },
  settingBlock: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  label: {
    fontFamily: Platform.OS === 'ios' ? 'Impact' : 'sans-serif-black',
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  input: {
    fontFamily: Platform.OS === 'ios' ? 'Impact' : 'sans-serif-black',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    color: '#f8fafc',
    fontSize: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  playerCountContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  countBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBtnActive: {
    backgroundColor: '#ff00ea',
    shadowColor: '#ff00ea',
    shadowOpacity: 0.8,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  countBtnText: {
    fontFamily: Platform.OS === 'ios' ? 'Impact' : 'sans-serif-black',
    color: '#e2e8f0',
    fontWeight: 'bold',
    fontSize: 18,
  },
  countBtnTextActive: {
    color: '#ffffff',
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
  },
  switchLabel: {
    fontFamily: Platform.OS === 'ios' ? 'Impact' : 'sans-serif-black',
    color: '#f8fafc',
    fontWeight: 'bold',
  },
  rulesContainer: {
    marginBottom: 40,
  },
  ruleButtons: {
    flexDirection: 'column',
    gap: 15,
  },
  ruleBtn: {
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  ruleBtnActive: {
    backgroundColor: 'rgba(255, 0, 234, 0.1)',
    borderColor: '#ff00ea',
    shadowColor: '#ff00ea',
    shadowOpacity: 0.8,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  ruleBtnText: {
    fontFamily: Platform.OS === 'ios' ? 'Impact' : 'sans-serif-black',
    color: '#e2e8f0',
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 5,
  },
  ruleBtnTextActive: {
    color: '#ff00ea',
  },
  ruleDesc: {
    fontFamily: Platform.OS === 'ios' ? 'Impact' : 'sans-serif-black',
    color: '#64748b',
    fontSize: 12,
  },
  playButton: {
    backgroundColor: 'transparent', 
    borderWidth: 2,
    borderColor: '#00e5ff',
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#00e5ff',
    shadowOpacity: 0.8,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 0 },
  },
  playButtonDisabled: {
    backgroundColor: '#334155',
    shadowOpacity: 0,
    elevation: 0,
  },
  playButtonText: {
    fontFamily: Platform.OS === 'ios' ? 'Impact' : 'sans-serif-black',
    color: '#00e5ff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  playButtonTextDisabled: {
    color: '#94a3b8',
  }
});
