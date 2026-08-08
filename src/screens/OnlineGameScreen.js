import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import PlayingCard from '../components/PlayingCard';
import { isValidPlay, SUITS, VALUES } from '../engine/GameEngine';

export default function OnlineGameScreen({ route, navigation }) {
  const { roomId, isHost, role } = route.params;
  const { profile } = useAuth();
  
  const [roomData, setRoomData] = useState(null);
  const [participants, setParticipants] = useState([]);
  
  // Local state for UI only (suit picker)
  const [showSuitPicker, setShowSuitPicker] = useState(false);
  const [pendingCardIndex, setPendingCardIndex] = useState(null);
  const [pendingCard, setPendingCard] = useState(null);

  useEffect(() => {
    fetchRoom();
    
    const roomSub = supabase.channel(`public:rooms:id=eq.${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, payload => {
        setRoomData(payload.new);
      })
      .subscribe();
      
    const partSub = supabase.channel(`public:room_participants:room_id=eq.${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` }, () => {
        fetchParticipants();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(roomSub);
      supabase.removeChannel(partSub);
    };
  }, []);

  const fetchRoom = async () => {
    const { data } = await supabase.from('rooms').select('*').eq('id', roomId).single();
    setRoomData(data);
    fetchParticipants();
  };
  
  const fetchParticipants = async () => {
    const { data } = await supabase.from('room_participants').select('*, profiles(username)').eq('room_id', roomId);
    setParticipants(data || []);
  };

  const updateGameState = async (newState) => {
    // Only the host or the current player should really update state
    await supabase.from('rooms').update({ game_state: newState }).eq('id', roomId);
  };

  if (!roomData || !roomData.game_state) return <View style={styles.container}><Text style={styles.title}>Loading Game...</Text></View>;
  
  const gs = roomData.game_state;
  const isMyTurn = gs.turnOrder[gs.currentTurnIndex] === profile.id && role === 'participant' && !gs.gameOver;
  const myHand = gs.hands[profile.id] || [];
  const topCard = gs.discardPile[gs.discardPile.length - 1];
  
  const nextTurn = (state) => {
    state.currentTurnIndex = (state.currentTurnIndex + state.direction + state.turnOrder.length) % state.turnOrder.length;
    return state;
  };

  const checkWinCondition = (state, playerId) => {
    if (state.hands[playerId].length === 0) {
      state.gameOver = true;
      state.winState = { winner: playerId };
    }
    return state;
  };

  const handleCardPress = (index) => {
    if (!isMyTurn) return;
    const card = myHand[index];
    
    const valid = isValidPlay(card, topCard, gs.rules.rulesForm, gs.activePenalty, gs.calledSuit, gs.isFreeTurn);
    if (!valid) return;
    
    if (card.value === '8' || card.value === 'Joker' || card.value === 'A') {
      setPendingCardIndex(index);
      setPendingCard(card);
      setShowSuitPicker(true);
      return;
    }
    
    executePlay(index, card, null);
  };

  const executePlay = (index, card, chosenSuit) => {
    setShowSuitPicker(false);
    
    // Create new state copy
    const newState = JSON.parse(JSON.stringify(gs));
    
    // Remove card from hand
    newState.hands[profile.id].splice(index, 1);
    
    // Add to discard pile
    newState.discardPile.push(card);
    newState.isFreeTurn = false;
    newState.calledSuit = chosenSuit || null;
    
    // Handle special cards
    if (card.value === '2') newState.activePenalty += 2;
    if (card.value === 'Joker') newState.activePenalty += 5;
    if (card.value === '10') newState.direction *= -1;
    
    let skips = (card.value === 'A' && !chosenSuit) ? 1 : 0;
    
    if (newState.hands[profile.id].length > 0 || (card.value !== '2' && card.value !== 'Joker' && card.value !== '8' && card.value !== 'A')) {
        for(let i=0; i<=skips; i++) {
           nextTurn(newState);
        }
    }
    
    checkWinCondition(newState, profile.id);
    updateGameState(newState);
  };

  const handleDraw = () => {
    if (!isMyTurn) return;
    
    const newState = JSON.parse(JSON.stringify(gs));
    
    if (newState.deck.length === 0) {
      // Reshuffle discard pile (excluding top card) into deck
      const top = newState.discardPile.pop();
      newState.deck = newState.discardPile.sort(() => Math.random() - 0.5);
      newState.discardPile = [top];
    }
    
    if (newState.activePenalty > 0) {
      const drawn = newState.deck.splice(0, newState.activePenalty);
      newState.hands[profile.id].push(...drawn);
      newState.activePenalty = 0;
    } else {
      const drawn = newState.deck.shift();
      if(drawn) newState.hands[profile.id].push(drawn);
    }
    
    nextTurn(newState);
    updateGameState(newState);
  };

  const getPlayerName = (id) => {
    const p = participants.find(part => part.profile_id === id);
    return p ? p.profiles.username : 'Unknown';
  };

  return (
    <View style={styles.container}>
      {/* Top Bar - Opponents */}
      <View style={styles.opponentsRow}>
        {gs.turnOrder.map((pid, idx) => {
          if (pid === profile.id && role === 'participant') return null; // Don't show self in opponents row
          const isTurn = gs.currentTurnIndex === idx;
          return (
            <View key={pid} style={[styles.opponentAvatar, isTurn && styles.activeOpponent]}>
              <Text style={styles.opponentName}>{getPlayerName(pid)}</Text>
              <Text style={styles.cardCount}>{gs.hands[pid]?.length || 0} cards</Text>
            </View>
          );
        })}
      </View>
      
      {/* Center Area - Play Area */}
      <View style={styles.playArea}>
        <TouchableOpacity style={styles.deck} onPress={handleDraw} disabled={!isMyTurn}>
          <Text style={styles.deckText}>DECK</Text>
          <Text style={styles.cardCountText}>{gs.deck.length}</Text>
          {gs.activePenalty > 0 && <Text style={styles.penaltyText}>+{gs.activePenalty}</Text>}
        </TouchableOpacity>
        
        <View style={styles.discardPile}>
          {topCard && <PlayingCard suit={topCard.suit} value={topCard.value} />}
          {gs.calledSuit && <Text style={styles.calledSuitText}>Called: {gs.calledSuit}</Text>}
        </View>
      </View>
      
      {/* Bottom Area - My Hand */}
      {role === 'participant' ? (
        <View style={styles.myHandArea}>
          <Text style={styles.myTurnText}>{isMyTurn ? "YOUR TURN" : "WAITING..."}</Text>
          <ScrollView horizontal style={styles.handScroll} contentContainerStyle={styles.handScrollContent}>
            {myHand.map((card, idx) => {
              const valid = isMyTurn && isValidPlay(card, topCard, gs.rules.rulesForm, gs.activePenalty, gs.calledSuit, gs.isFreeTurn);
              return (
                <TouchableOpacity key={`${card.id}-${idx}`} onPress={() => handleCardPress(idx)} disabled={!valid}>
                  <View style={[styles.cardWrapper, !valid && isMyTurn && styles.invalidCard]}>
                    <PlayingCard suit={card.suit} value={card.value} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.myHandArea}>
          <Text style={styles.myTurnText}>SPECTATING</Text>
        </View>
      )}

      {/* Suit Picker Modal */}
      {showSuitPicker && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose a suit:</Text>
            <View style={styles.suitRow}>
              {SUITS.map(suit => (
                <TouchableOpacity key={suit} style={styles.suitBtn} onPress={() => executePlay(pendingCardIndex, pendingCard, suit)}>
                  <Text style={styles.suitText}>{suit}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}
      
      {/* Game Over Modal */}
      {gs.gameOver && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>GAME OVER</Text>
            <Text style={{color:'white', marginBottom:20}}>{getPlayerName(gs.winState.winner)} WINS!</Text>
            <TouchableOpacity style={styles.startBtn} onPress={() => navigation.replace('MainMenu')}>
              <Text style={{color:'black', fontWeight:'bold'}}>EXIT TO MENU</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  opponentsRow: { flexDirection: 'row', justifyContent: 'center', gap: 15, padding: 20, paddingTop: 40, backgroundColor: '#1e293b' },
  opponentAvatar: { backgroundColor: '#334155', padding: 10, borderRadius: 10, alignItems: 'center' },
  activeOpponent: { borderColor: '#00ffcc', borderWidth: 2 },
  opponentName: { color: 'white', fontWeight: 'bold' },
  cardCount: { color: '#94a3b8', fontSize: 12 },
  playArea: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 40 },
  deck: { width: 100, height: 140, backgroundColor: '#334155', borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#00ffcc' },
  deckText: { color: 'white', fontWeight: 'bold' },
  cardCountText: { color: '#94a3b8', marginTop: 10 },
  penaltyText: { color: '#ef4444', fontWeight: '900', fontSize: 24, marginTop: 5 },
  discardPile: { alignItems: 'center' },
  calledSuitText: { color: '#ff00ea', fontWeight: 'bold', fontSize: 20, marginTop: 10 },
  myHandArea: { height: 220, backgroundColor: '#1e293b', padding: 10 },
  myTurnText: { color: '#00ffcc', fontWeight: '900', fontSize: 18, textAlign: 'center', marginBottom: 10 },
  handScroll: { flex: 1 },
  handScrollContent: { paddingHorizontal: 20, gap: -40, alignItems: 'center' },
  cardWrapper: { shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.5, shadowRadius: 10 },
  invalidCard: { opacity: 0.4 },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  modalContent: { backgroundColor: '#1e293b', padding: 30, borderRadius: 20, alignItems: 'center' },
  modalTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  suitRow: { flexDirection: 'row', gap: 15 },
  suitBtn: { backgroundColor: '#334155', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  suitText: { fontSize: 30 },
  startBtn: { backgroundColor: '#00ffcc', padding: 15, borderRadius: 10 }
});
