import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Share } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { generateDeck } from '../engine/GameEngine';

export default function OnlineLobbyScreen({ route, navigation }) {
  const { roomId, roomCode, isHost, role } = route.params;
  const { profile } = useAuth();
  
  const [participants, setParticipants] = useState([]);
  const [roomData, setRoomData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Settings state (only host can change)
  const [playerCount, setPlayerCount] = useState(4);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [startingCards, setStartingCards] = useState(7);

  useEffect(() => {
    fetchInitialData();
    
    // Subscribe to participant changes
    const participantSub = supabase.channel(`public:room_participants:room_id=eq.${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` }, payload => {
        fetchInitialData(); // Lazy re-fetch, could be optimized
      })
      .subscribe();
      
    // Subscribe to room changes (start game, setting changes)
    const roomSub = supabase.channel(`public:rooms:id=eq.${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, payload => {
        const newRoomData = payload.new;
        setRoomData(newRoomData);
        if (newRoomData.status === 'playing') {
          navigation.replace('OnlineGame', { roomId, isHost, role });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(participantSub);
      supabase.removeChannel(roomSub);
      // If leaving, we should ideally delete participant row, but keeping it simple for now
    };
  }, []);

  const fetchInitialData = async () => {
    try {
      // Get Room Data
      const { data: room } = await supabase.from('rooms').select('*').eq('id', roomId).single();
      setRoomData(room);

      // Get Participants
      const { data: parts } = await supabase
        .from('room_participants')
        .select('*, profiles(username)')
        .eq('room_id', roomId);
      
      setParticipants(parts || []);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join my CARDDEN room! The room code is: ${roomCode}`,
      });
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const players = participants.filter(p => p.role === 'participant');
  const audience = participants.filter(p => p.role === 'audience');

  const startGame = async () => {
    if (!isHost) return;
    setLoading(true);
    
    const deck = generateDeck();
    const hands = {};
    const turnOrder = players.map(p => p.profile_id);
    
    // Deal starting cards
    players.forEach(p => {
      hands[p.profile_id] = deck.splice(0, startingCards);
    });
    
    const discardPile = [deck.shift()];
    
    const gameState = {
      rules: { chatEnabled, startingCards, targetPlayers: playerCount },
      deck,
      discardPile,
      hands,
      turnOrder,
      currentTurnIndex: Math.floor(Math.random() * players.length),
      direction: 1,
      calledSuit: null,
      activePenalty: 0,
      isFreeTurn: false,
      gameOver: false,
      winState: null
    };
    
    const { error } = await supabase
      .from('rooms')
      .update({ status: 'playing', game_state: gameState })
      .eq('id', roomId);
      
    if (error) {
      Alert.alert("Error starting game", error.message);
      setLoading(false);
    }
  };

  if (loading && !roomData) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#00ffcc" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>LOBBY</Text>
        <View style={{flexDirection: 'row', gap: 10, alignItems: 'center'}}>
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>ROOM CODE</Text>
            <Text style={styles.code}>{roomCode}</Text>
          </View>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
            <Text style={styles.shareBtnText}>SHARE</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.playersCol}>
          <Text style={styles.sectionTitle}>PLAYERS ({players.length}/{isHost ? playerCount : (roomData?.game_state?.rules?.targetPlayers || '?')})</Text>
          <ScrollView style={styles.list}>
            {players.map(p => (
              <View key={p.id} style={styles.playerRow}>
                <Text style={styles.playerName}>{p.profiles?.username || 'Unknown'}</Text>
                {roomData?.host_id === p.profile_id && <Text style={styles.hostBadge}>HOST</Text>}
              </View>
            ))}
          </ScrollView>

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>AUDIENCE ({audience.length})</Text>
          <ScrollView style={styles.list}>
            {audience.map(p => (
              <View key={p.id} style={styles.playerRow}>
                <Text style={styles.playerName}>{p.profiles?.username || 'Unknown'}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.settingsCol}>
          <Text style={styles.sectionTitle}>SETTINGS</Text>
          {isHost ? (
            <View style={styles.settingsCard}>
              <Text style={styles.label}>MAX PLAYERS</Text>
              <View style={styles.row}>
                {[2,3,4,5,6,7].map(num => (
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
          ) : (
            <View style={styles.settingsCard}>
              <Text style={styles.label}>Waiting for host to configure game...</Text>
            </View>
          )}

          {isHost ? (
            <TouchableOpacity 
              style={[styles.startBtn, (loading || players.length !== playerCount) && { opacity: 0.5 }]} 
              onPress={startGame} 
              disabled={loading || players.length !== playerCount}
            >
              <Text style={styles.startBtnText}>
                {loading ? 'STARTING...' : (players.length !== playerCount ? `WAITING FOR ${playerCount} PLAYERS` : 'START GAME')}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.startBtn, { backgroundColor: '#475569', shadowOpacity: 0 }]}>
              <Text style={styles.startBtnText}>WAITING FOR HOST...</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 20,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 40,
    fontWeight: '900',
    color: '#8b5cf6',
  },
  codeBox: {
    backgroundColor: '#1e293b',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00ffcc',
  },
  codeLabel: {
    color: '#00ffcc',
    fontSize: 10,
    fontWeight: 'bold',
  },
  code: {
    color: 'white',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 3,
  },
  shareBtn: {
    backgroundColor: '#8b5cf6',
    padding: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#a78bfa',
  },
  shareBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 1,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    gap: 20,
  },
  playersCol: {
    flex: 1,
  },
  settingsCol: {
    flex: 1,
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  list: {
    backgroundColor: '#1e293b',
    borderRadius: 15,
    padding: 10,
    maxHeight: '45%',
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  playerName: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  hostBadge: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '900',
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  settingsCard: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 15,
  },
  label: {
    color: '#94a3b8',
    fontWeight: 'bold',
    marginBottom: 15,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  countBtnText: {
    color: 'white',
    fontWeight: 'bold',
  },
  countBtnTextActive: {
    color: 'white',
  },
  startBtn: {
    backgroundColor: '#00ffcc',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#00ffcc',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    marginTop: 20,
  },
  startBtnText: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
  }
});
