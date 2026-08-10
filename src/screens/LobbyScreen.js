import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Switch, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FeltTable from '../components/FeltTable';
import { BrassButton } from '../components/TableUI';
import { useLandscape } from '../hooks/useLandscape';
import { COLORS, FONTS, RADIUS, glow, shadow } from '../theme/casino';

const RULE_FORMS = [
  { id: 'Form 4', blurb: 'Black Ace is universal. You cannot win on a power card.' },
  { id: 'Form 3', blurb: 'Black Ace is a normal card. Standard checkout.' },
];

export default function LobbyScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  useLandscape();

  const [playerName, setPlayerName] = useState('');
  const [selectedRule, setSelectedRule] = useState('Form 4');
  const [playerCount, setPlayerCount] = useState(4);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [startingCards, setStartingCards] = useState('7');
  const [error, setError] = useState(null);

  const handleStartGame = () => {
    const numCards = parseInt(startingCards, 10);
    if (Number.isNaN(numCards) || numCards < 1) {
      setError('Enter a valid number of starting cards.');
      return;
    }
    // 54 cards total, one turned up to open the pile.
    const maxCards = Math.floor(53 / playerCount);
    if (numCards > maxCards) {
      setError(`With ${playerCount} players you can deal at most ${maxCards} each.`);
      return;
    }

    setError(null);
    navigation.navigate('Game', {
      playerName: playerName.trim() || 'Player 1',
      rules: selectedRule,
      playerCount,
      chatEnabled,
      startingCards: numCards,
    });
  };

  return (
    <FeltTable>
      <View
        style={[styles.screen, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10 }]}
      >
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
            <Text style={styles.backGlyph}>‹</Text>
          </Pressable>
          <View>
            <Text style={styles.title}>SET THE TABLE</Text>
            <Text style={styles.subtitle}>LOCAL GAME · PLAY THE HOUSE</Text>
          </View>
          <View style={{ width: 32 }} />
        </View>

        <View style={styles.columns}>
          <View style={styles.panel}>
            <View>
              <Text style={styles.label}>YOUR NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Daddy Ray"
                placeholderTextColor="rgba(245,239,224,0.3)"
                value={playerName}
                onChangeText={setPlayerName}
              />
            </View>

            <View style={styles.splitRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>OPENING HAND</Text>
                <TextInput
                  style={[styles.input, styles.inputCentred]}
                  keyboardType="number-pad"
                  value={startingCards}
                  onChangeText={setStartingCards}
                  maxLength={2}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>TABLE CHAT</Text>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>{chatEnabled ? 'ON' : 'OFF'}</Text>
                  <Switch
                    value={chatEnabled}
                    onValueChange={setChatEnabled}
                    trackColor={{ false: '#2a2f38', true: COLORS.goldDim }}
                    thumbColor={chatEnabled ? COLORS.goldBright : '#8d8d8d'}
                  />
                </View>
              </View>
            </View>

            <View>
              <Text style={styles.label}>SEATS</Text>
              <View style={styles.chipRow}>
                {[2, 3, 4, 5, 6, 7].map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => setPlayerCount(n)}
                    style={[styles.chip, playerCount === n && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, playerCount === n && styles.chipTextActive]}>
                      {n}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.label}>RULE SET</Text>
            <ScrollView contentContainerStyle={{ gap: 8 }}>
              {RULE_FORMS.map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => setSelectedRule(f.id)}
                  style={[styles.ruleCard, selectedRule === f.id && styles.ruleCardActive]}
                >
                  <Text style={[styles.ruleName, selectedRule === f.id && styles.ruleNameActive]}>
                    {f.id}
                  </Text>
                  <Text style={styles.ruleBlurb}>{f.blurb}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {!!error && <Text style={styles.errorText}>{error}</Text>}

            <BrassButton
              label={playerName.trim() ? 'DEAL ME IN' : 'ENTER YOUR NAME'}
              tone="gold"
              onPress={handleStartGame}
              disabled={!playerName.trim()}
            />
          </View>
        </View>
      </View>
    </FeltTable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 20, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.goldDim,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: { color: COLORS.goldBright, fontSize: 22, lineHeight: 24, marginTop: -2 },
  title: {
    fontFamily: FONTS.display,
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.goldBright,
    letterSpacing: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FONTS.ui,
    fontSize: 9,
    letterSpacing: 2.5,
    color: COLORS.creamDim,
    fontWeight: '700',
    textAlign: 'center',
  },

  columns: { flex: 1, flexDirection: 'row', gap: 14 },
  panel: {
    flex: 1,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.goldDim,
    backgroundColor: 'rgba(3, 26, 15, 0.7)',
    padding: 16,
    gap: 12,
    justifyContent: 'center',
    ...shadow(10),
  },
  label: {
    fontFamily: FONTS.ui,
    color: COLORS.creamDim,
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: '800',
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    color: COLORS.cream,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    fontFamily: FONTS.ui,
    fontSize: 15,
    fontWeight: '700',
    borderWidth: 1.5,
    borderColor: COLORS.goldDim,
  },
  inputCentred: { textAlign: 'center', letterSpacing: 3 },
  splitRow: { flexDirection: 'row', gap: 12 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.goldDim,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  switchLabel: {
    fontFamily: FONTS.ui,
    color: COLORS.cream,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minWidth: 36,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.goldBright,
    ...glow(COLORS.gold, 8, 0.6),
  },
  chipText: { fontFamily: FONTS.ui, color: COLORS.cream, fontSize: 14, fontWeight: '800' },
  chipTextActive: { color: '#2b2004' },

  ruleCard: {
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  ruleCardActive: { borderColor: COLORS.goldBright, backgroundColor: 'rgba(122, 92, 8, 0.35)' },
  ruleName: {
    fontFamily: FONTS.ui,
    color: COLORS.cream,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  ruleNameActive: { color: COLORS.goldBright },
  ruleBlurb: { fontFamily: FONTS.ui, color: COLORS.creamDim, fontSize: 10, marginTop: 3, lineHeight: 14 },
  errorText: { fontFamily: FONTS.ui, color: COLORS.danger, fontSize: 11, fontWeight: '700' },
});
