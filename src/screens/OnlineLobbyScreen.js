import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { generateDeck } from '../engine/GameEngine';
import FeltTable from '../components/FeltTable';
import { BrassButton } from '../components/TableUI';
import { useLandscape } from '../hooks/useLandscape';
import { COLORS, FONTS, RADIUS, glow, shadow } from '../theme/casino';

const RULE_FORMS = [
  { id: 'Form 4', blurb: 'Black Ace is a wildcard and cancels penalties.' },
  { id: 'Form 3', blurb: 'Black Ace is a normal card. Standard checkout.' },
];

export default function OnlineLobbyScreen({ route, navigation }) {
  const { roomId, roomCode, isHost, role } = route.params;
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  useLandscape();

  const [participants, setParticipants] = useState([]);
  const [roomData, setRoomData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Host-controlled table settings
  const [playerCount, setPlayerCount] = useState(4);
  const [rulesForm, setRulesForm] = useState('Form 4');
  const [startingCards, setStartingCards] = useState(7);

  const fetchInitialData = useCallback(async () => {
    try {
      const [{ data: room }, { data: parts }] = await Promise.all([
        supabase.from('rooms').select('*').eq('id', roomId).single(),
        supabase.from('room_participants').select('*, profiles(username)').eq('room_id', roomId),
      ]);
      setRoomData(room);
      setParticipants(parts || []);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    fetchInitialData();

    const sub = supabase
      .channel(`lobby:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` },
        fetchInitialData
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          setRoomData(payload.new);
          if (payload.new.status === 'playing') {
            navigation.replace('OnlineGame', { roomId, isHost, role });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [roomId, isHost, role, navigation, fetchInitialData]);

  const handleShare = async () => {
    try {
      await Share.share({ message: `Join my CARDDEN table. Room code: ${roomCode}` });
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const players = participants.filter((p) => p.role === 'participant');
  const audience = participants.filter((p) => p.role === 'audience');
  const canStart = players.length === playerCount;

  const startGame = async () => {
    if (!isHost) return;
    setLoading(true);

    const deck = generateDeck();
    const hands = {};
    const turnOrder = players.map((p) => p.profile_id);
    turnOrder.forEach((pid) => {
      hands[pid] = deck.splice(0, startingCards);
    });

    // Don't open on a card whose effect nobody can respond to.
    const openers = ['3', '4', '5', '6', '9', '10'];
    let openerAt = deck.findIndex((c) => openers.includes(c.value));
    if (openerAt === -1) openerAt = 0;
    const discardPile = [deck.splice(openerAt, 1)[0]];

    const gameState = {
      version: 1,
      origin: profile.id,
      // `rulesForm` is what the engine reads — without it Form 4's black-Ace
      // wildcard never applies.
      rules: { rulesForm, startingCards, targetPlayers: playerCount },
      deck,
      discardPile,
      hands,
      turnOrder,
      currentTurnIndex: Math.floor(Math.random() * turnOrder.length),
      direction: 1,
      calledSuit: null,
      activePenalty: 0,
      isFreeTurn: false,
      gameOver: false,
      winState: null,
    };

    const { error } = await supabase
      .from('rooms')
      .update({ status: 'playing', game_state: gameState })
      .eq('id', roomId);

    if (error) {
      Alert.alert('Could not start', error.message);
      setLoading(false);
    }
  };

  if (loading && !roomData) {
    return (
      <FeltTable>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.gold} />
        </View>
      </FeltTable>
    );
  }

  const targetSeats = isHost ? playerCount : roomData?.game_state?.rules?.targetPlayers ?? '?';

  return (
    <FeltTable>
      <View
        style={[
          styles.screen,
          { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10 },
        ]}
      >
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
            <Text style={styles.backGlyph}>‹</Text>
          </Pressable>
          <View>
            <Text style={styles.title}>THE LOBBY</Text>
            <Text style={styles.subtitle}>WAITING FOR THE TABLE TO FILL</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>ROOM CODE</Text>
              <Text style={styles.code}>{roomCode}</Text>
            </View>
            <BrassButton label="SHARE" tone="slate" compact onPress={handleShare} />
          </View>
        </View>

        <View style={styles.columns}>
          {/* Seats */}
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>
              PLAYERS · {players.length}/{targetSeats}
            </Text>
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {players.map((p) => (
                <View key={p.id} style={styles.seatRow}>
                  <Text style={styles.seatName}>{p.profiles?.username || 'Unknown'}</Text>
                  {roomData?.host_id === p.profile_id && <Text style={styles.hostBadge}>HOST</Text>}
                </View>
              ))}
              {players.length === 0 && <Text style={styles.emptyText}>No one seated yet.</Text>}
            </ScrollView>

            <Text style={styles.panelTitle}>AUDIENCE · {audience.length}</Text>
            <ScrollView style={styles.listShort} contentContainerStyle={styles.listContent}>
              {audience.map((p) => (
                <View key={p.id} style={styles.seatRow}>
                  <Text style={styles.seatName}>{p.profiles?.username || 'Unknown'}</Text>
                </View>
              ))}
              {audience.length === 0 && <Text style={styles.emptyText}>No spectators.</Text>}
            </ScrollView>
          </View>

          {/* Settings */}
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>HOUSE RULES</Text>

            {isHost ? (
              <ScrollView contentContainerStyle={{ gap: 14 }}>
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

                <View>
                  <Text style={styles.label}>OPENING HAND</Text>
                  <View style={styles.chipRow}>
                    {[5, 7, 9].map((n) => (
                      <Pressable
                        key={n}
                        onPress={() => setStartingCards(n)}
                        style={[styles.chip, startingCards === n && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, startingCards === n && styles.chipTextActive]}>
                          {n}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View>
                  <Text style={styles.label}>RULE SET</Text>
                  <View style={{ gap: 8 }}>
                    {RULE_FORMS.map((f) => (
                      <Pressable
                        key={f.id}
                        onPress={() => setRulesForm(f.id)}
                        style={[styles.ruleCard, rulesForm === f.id && styles.ruleCardActive]}
                      >
                        <Text style={[styles.ruleName, rulesForm === f.id && styles.ruleNameActive]}>
                          {f.id}
                        </Text>
                        <Text style={styles.ruleBlurb}>{f.blurb}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </ScrollView>
            ) : (
              <View style={styles.waitBox}>
                <Text style={styles.emptyText}>The host is setting the table…</Text>
              </View>
            )}

            {isHost ? (
              <BrassButton
                label={
                  loading
                    ? 'DEALING…'
                    : canStart
                      ? 'DEAL THE CARDS'
                      : `WAITING FOR ${playerCount - players.length} MORE`
                }
                tone="gold"
                onPress={startGame}
                disabled={loading || !canStart}
              />
            ) : (
              <View style={styles.waitPill}>
                <Text style={styles.waitPillText}>WAITING FOR HOST…</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </FeltTable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  screen: { flex: 1, paddingHorizontal: 20, gap: 12 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
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
  },
  subtitle: {
    fontFamily: FONTS.ui,
    fontSize: 9,
    letterSpacing: 2.5,
    color: COLORS.creamDim,
    fontWeight: '700',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  codeBox: {
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 4,
    ...glow(COLORS.gold, 8, 0.4),
  },
  codeLabel: {
    fontFamily: FONTS.ui,
    color: COLORS.creamDim,
    fontSize: 7,
    letterSpacing: 2,
    fontWeight: '700',
  },
  code: {
    fontFamily: FONTS.display,
    color: COLORS.goldBright,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 5,
  },

  columns: { flex: 1, flexDirection: 'row', gap: 14 },
  panel: {
    flex: 1,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.goldDim,
    backgroundColor: 'rgba(3, 26, 15, 0.7)',
    padding: 14,
    gap: 10,
    ...shadow(10),
  },
  panelTitle: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 3,
    color: COLORS.goldBright,
    fontWeight: '800',
  },
  list: { flex: 1 },
  listShort: { maxHeight: 92 },
  listContent: { gap: 6 },
  seatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
  },
  seatName: { fontFamily: FONTS.ui, color: COLORS.cream, fontSize: 13, fontWeight: '700' },
  hostBadge: {
    fontFamily: FONTS.ui,
    color: COLORS.ink,
    backgroundColor: COLORS.gold,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  emptyText: { fontFamily: FONTS.ui, color: COLORS.creamDim, fontSize: 11, fontStyle: 'italic' },

  label: {
    fontFamily: FONTS.ui,
    color: COLORS.creamDim,
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: '800',
    marginBottom: 6,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minWidth: 34,
    height: 30,
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
  chipText: { fontFamily: FONTS.ui, color: COLORS.cream, fontSize: 13, fontWeight: '800' },
  chipTextActive: { color: '#2b2004' },

  ruleCard: {
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ruleCardActive: { borderColor: COLORS.goldBright, backgroundColor: 'rgba(122, 92, 8, 0.35)' },
  ruleName: {
    fontFamily: FONTS.ui,
    color: COLORS.cream,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  ruleNameActive: { color: COLORS.goldBright },
  ruleBlurb: { fontFamily: FONTS.ui, color: COLORS.creamDim, fontSize: 10, marginTop: 2 },

  waitBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  waitPill: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.goldDim,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  waitPillText: {
    fontFamily: FONTS.ui,
    color: COLORS.creamDim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
});
