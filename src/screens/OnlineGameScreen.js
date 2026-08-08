import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert, Vibration, Platform, UIManager, LayoutAnimation } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import PlayingCard from '../components/PlayingCard';
import { isValidPlay, SUITS } from '../engine/GameEngine';

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

export default function OnlineGameScreen({ route, navigation }) {
  const { roomId, isHost, role } = route.params;
  const { profile } = useAuth();
  
  const [roomData, setRoomData] = useState(null);
  const [participants, setParticipants] = useState([]);
  
  // Local state for UI only
  const [showSuitPicker, setShowSuitPicker] = useState(false);
  const [pendingCardIndex, setPendingCardIndex] = useState(null);
  const [pendingCard, setPendingCard] = useState(null);
  const [hasDrawn, setHasDrawn] = useState(false); // Track if user drew this turn
  const [selectedCardIndices, setSelectedCardIndices] = useState([]);
  const [prevHandCounts, setPrevHandCounts] = useState({});

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

  // Audio setup
  useEffect(() => {
    let bgSound;
    async function initAudio() {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require('../../assets/bg.wav'),
          { shouldPlay: true, isLooping: true, volume: 0.3 }
        );
        bgSound = sound;
      } catch (e) {
        console.log("Audio load error:", e);
      }
    }
    initAudio();
    return () => {
      if (bgSound) bgSound.unloadAsync();
    };
  }, []);

  const playSFX = async (type) => {
    try {
      const file = type === 'win' ? require('../../assets/win.wav') : require('../../assets/check.wav');
      const { sound } = await Audio.Sound.createAsync(file, { shouldPlay: true });
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) sound.unloadAsync();
      });
    } catch (e) {
      console.log("SFX error:", e);
    }
  };

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
    await supabase.from('rooms').update({ game_state: newState }).eq('id', roomId);
  };

  const gs = roomData?.game_state;
  const isMyTurn = gs ? (gs.turnOrder[gs.currentTurnIndex] === profile.id && role === 'participant' && !gs.gameOver) : false;

  // Reset hasDrawn when it's our turn again
  useEffect(() => {
    if (isMyTurn) setHasDrawn(false);
  }, [isMyTurn]);

  // Networked Voice/SFX Features
  useEffect(() => {
    if (!roomData?.game_state) return;
    const currentHands = roomData.game_state.hands;
    const newCounts = {};
    let checkTriggered = false;
    let winTriggered = false;

    Object.keys(currentHands).forEach(pid => {
      newCounts[pid] = currentHands[pid].length;
      if (prevHandCounts[pid] !== undefined) {
        if (prevHandCounts[pid] > 1 && newCounts[pid] === 1) checkTriggered = true;
        if (prevHandCounts[pid] > 0 && newCounts[pid] === 0) winTriggered = true;
      }
    });

    if (winTriggered) {
      playSFX('win');
      Vibration.vibrate([0, 500, 200, 500]);
    } else if (checkTriggered) {
      playSFX('check');
      Vibration.vibrate(100);
    }

    setPrevHandCounts(newCounts);
  }, [roomData?.game_state?.hands]);

  if (!roomData || !roomData.game_state) return <View style={styles.loadingContainer}><Text style={styles.title}>Loading Game...</Text></View>;
  
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
    if (showSuitPicker) return;
    if (!isMyTurn) {
      Alert.alert("Not Your Turn!", "Please wait for the active player to make their move.");
      return;
    }
    
    setSelectedCardIndices(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      }
      return [...prev, index];
    });
  };

  const handlePlaySelection = () => {
    if (selectedCardIndices.length === 0) return;

    const selectedCards = selectedCardIndices.map(i => myHand[i]);
    const firstValue = selectedCards[0].value;
    
    if (!selectedCards.every(c => c.value === firstValue)) {
      Alert.alert("Invalid Move", "You can only play multiple cards if they have the same value!");
      return;
    }

    const validIndex = selectedCards.findIndex(c => isValidPlay(c, topCard, gs.rules.rulesForm, gs.activePenalty, gs.calledSuit, gs.isFreeTurn));
    
    if (validIndex === -1) {
      if (gs.activePenalty > 0) {
        Alert.alert("Invalid Move", "You must play a blocking card or draw the penalty!");
      } else {
        Alert.alert("Invalid Move", "None of these cards can be played on the discard pile right now!");
      }
      return;
    }

    const cardsToPlay = [...selectedCards];
    const validCard = cardsToPlay.splice(validIndex, 1)[0];
    cardsToPlay.unshift(validCard); 

    const lastCardPlayed = cardsToPlay[cardsToPlay.length - 1];

    if (lastCardPlayed.value === '8' || lastCardPlayed.value === 'Joker' || lastCardPlayed.value === 'A') {
      setPendingCard(cardsToPlay);
      setShowSuitPicker(true);
      return;
    }

    executePlay(cardsToPlay, null);
  };

  const executePlay = (cardsToPlay, chosenSuit) => {
    setShowSuitPicker(false);
    Vibration.vibrate(50);
    
    const newState = JSON.parse(JSON.stringify(gs));
    
    newState.hands[profile.id] = newState.hands[profile.id].filter((_, i) => !selectedCardIndices.includes(i));
    setSelectedCardIndices([]);
    
    newState.discardPile.push(...cardsToPlay);
    newState.isFreeTurn = false;
    newState.calledSuit = chosenSuit || null;
    
    const lastCardPlayed = cardsToPlay[cardsToPlay.length - 1];
    
    cardsToPlay.forEach(card => {
      if (card.value === '2') newState.activePenalty += 2;
      if (card.value === 'Joker') newState.activePenalty += 5;
      if (card.value === '10') newState.direction *= -1;
    });
    
    let steps = 1;
    const jCount = cardsToPlay.filter(c => c.value === 'J').length;
    if (jCount > 0) {
      if (jCount % 2 === 1) {
        newState.direction *= -1;
      } else {
        steps = 0;
      }
    }
    
    let skips = (lastCardPlayed.value === 'A' && !chosenSuit) ? 1 : 0;
    
    if (newState.hands[profile.id].length > 0 || (!['2','Joker','8','A','J','7','Q','K'].includes(lastCardPlayed.value))) {
        for(let i=0; i<steps + skips; i++) {
           nextTurn(newState);
        }
    }
    
    checkWinCondition(newState, profile.id);
    updateGameState(newState);
  };

  const handleDraw = () => {
    if (!isMyTurn || hasDrawn) return;
    
    Vibration.vibrate(50);

    const newState = JSON.parse(JSON.stringify(gs));
    setSelectedCardIndices([]);

    
    if (newState.deck.length === 0) {
      const top = newState.discardPile.pop();
      newState.deck = newState.discardPile.sort(() => Math.random() - 0.5);
      newState.discardPile = [top];
    }
    
    if (newState.activePenalty > 0) {
      const drawn = newState.deck.splice(0, newState.activePenalty);
      newState.hands[profile.id].push(...drawn);
      newState.activePenalty = 0;
      nextTurn(newState); // Turn ends after drawing penalty
    } else {
      const drawn = newState.deck.shift();
      if(drawn) newState.hands[profile.id].push(drawn);
      setHasDrawn(true); // Can still play if it matches, otherwise must manually pass
    }
    
    updateGameState(newState);
  };

  const handlePass = () => {
    if (!isMyTurn || !hasDrawn) return;
    const newState = JSON.parse(JSON.stringify(gs));
    nextTurn(newState);
    updateGameState(newState);
  };

  const getPlayerName = (id) => {
    const p = participants.find(part => part.profile_id === id);
    return p?.profiles?.username || 'Unknown';
  };

  return (
    <LinearGradient colors={['#000000', '#1a0b2e', '#000000']} style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        
        {/* Bridge Container for Opponents */}
        <View style={styles.bridgeContainer}>
          {gs.turnOrder.map((pid, idx) => {
            if (pid === profile.id && role === 'participant') return null; 
            const isTurn = gs.currentTurnIndex === idx;
            return (
              <View key={pid} style={[styles.opponent, isTurn && styles.activeOpponent]}>
                <Text style={styles.opponentName}>{getPlayerName(pid)}</Text>
                <Text style={styles.cardCountText}>{gs.hands[pid]?.length || 0}</Text>
                <Text style={styles.cardLabel}>CARDS</Text>
              </View>
            );
          })}
        </View>

        {/* Turn Indicator */}
        <View style={styles.turnIndicator}>
          <Text style={[styles.turnText, isMyTurn ? styles.myTurnText : styles.opponentTurnText]}>
            {isMyTurn ? "YOUR TURN!" : `${getPlayerName(gs.turnOrder[gs.currentTurnIndex]).toUpperCase()}'S TURN`}
          </Text>
        </View>

        
        {/* Play Area */}
        <View style={styles.boardContainer}>
          <View style={styles.deckSection}>
            <TouchableOpacity 
              onPress={handleDraw} 
              onLongPress={handlePass}
              activeOpacity={0.8} 
              style={[
                isMyTurn && !hasDrawn && styles.glowDeck, 
                (!isMyTurn || hasDrawn) && styles.disabledDeck,
                gs.activePenalty > 0 && isMyTurn && styles.penaltyDeck
              ]}
              disabled={!isMyTurn || hasDrawn}
            >
              <PlayingCard isHidden={true} />
            </TouchableOpacity>
            {gs.activePenalty > 0 && (
              <View style={styles.penaltyBadge}>
                <Text style={styles.penaltyText}>+{gs.activePenalty}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.discardContainer}>
            {gs.discardPile.map((card, index) => {
              if (index < gs.discardPile.length - 4) return null; 
              return (
                <PlayingCard 
                  key={`${card.id}-${index}`}
                  suit={card.suit} 
                  value={card.value}
                  style={{ position: 'absolute', transform: [{ rotate: `${(index * 7) % 20 - 10}deg` }] }}
                />
              );
            })}
            {gs.calledSuit && (
              <View style={styles.calledSuitBadge}>
                <Text style={styles.calledSuitBadgeText}>{gs.calledSuit}</Text>
              </View>
            )}
          </View>
        </View>
        
        {/* Bottom Area - Player Hand */}
        {role === 'participant' ? (
          <View style={[styles.playerContainer, isMyTurn && styles.activePlayerContainer]}>
            <View style={styles.handHeader}>
              <View>
                <Text style={styles.playerName}>{profile.username ? profile.username.toUpperCase() : 'YOU'}</Text>
                <Text style={styles.directionBadge}>{gs.direction === 1 ? '▶' : '◀'} {gs.rules.rulesForm}</Text>
              </View>
              <View style={styles.actionRow}>
                {selectedCardIndices.length > 0 && isMyTurn && (
                  <TouchableOpacity style={styles.playBtn} onPress={handlePlaySelection}>
                    <Text style={styles.playBtnText}>PLAY CARDS</Text>
                  </TouchableOpacity>
                )}
                {hasDrawn && isMyTurn && gs.activePenalty === 0 && selectedCardIndices.length === 0 && (
                  <TouchableOpacity style={styles.passBtn} onPress={handlePass}>
                    <Text style={styles.passBtnText}>PASS</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            
            <View style={{ width: '100%', alignItems: 'center' }}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.handScroll}
              >
              {myHand.map((card, index) => {
                const isSelected = selectedCardIndices.includes(index);
                const middleIndex = (myHand.length - 1) / 2;
                const distance = index - middleIndex;
                const maxDistance = 6;
                const effectiveDistance = Math.max(-maxDistance, Math.min(maxDistance, distance));
                const rotation = effectiveDistance * 4; 
                const yOffset = Math.pow(Math.abs(effectiveDistance), 1.5) * 3;

                return (
                  <TouchableOpacity 
                    key={`${card.id}-${index}`} 
                    onPress={() => handleCardPress(index)}
                    activeOpacity={0.9}
                    style={{ 
                      marginLeft: index === 0 ? 0 : -45, 
                      opacity: isMyTurn ? 1 : 0.7,
                      transform: [
                        { translateY: (isSelected ? -30 : 0) + yOffset },
                        { rotateZ: `${rotation}deg` }
                      ],
                      zIndex: index
                    }}
                  >
                    <PlayingCard suit={card.suit} value={card.value} />
                  </TouchableOpacity>
                )
              })}
              </ScrollView>
            </View>
          </View>
        ) : (
          <View style={[styles.playerContainer]}>
            <Text style={{color: '#00ffcc', fontWeight: '900', fontSize: 18, textAlign: 'center'}}>SPECTATING</Text>
          </View>
        )}

        {/* Suit Picker Modal */}
        {showSuitPicker && (
          <View style={styles.modalOverlay}>
            <View style={styles.suitPickerContainer}>
              <Text style={styles.suitPickerTitle}>Select a Suit</Text>
              <View style={styles.suitRow}>
                {['♥️', '♦️', '♣️', '♠️'].map(s => (
                  <TouchableOpacity key={s} style={styles.suitBtn} onPress={() => executePlay(pendingCard, s)}>
                    <Text style={[styles.suitBtnText, (s === '♥️' || s === '♦️') && styles.redText]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}
        
        {/* Game Over Modal */}
        {gs.gameOver && (
          <View style={styles.modalOverlay}>
            <View style={styles.winContainer}>
              <Text style={styles.winTitle}>GAME OVER</Text>
              <Text style={styles.winSubtitle}>{getPlayerName(gs.winState.winner)} WON! 🎉</Text>
              <TouchableOpacity style={styles.lobbyButton} onPress={() => navigation.replace('MainMenu')}>
                <Text style={styles.lobbyButtonText}>BACK TO MENU</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
  title: { color: '#00ffcc', fontSize: 24, fontWeight: 'bold' },
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
  },
  bridgeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 50,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#166534',
  },
  opponent: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    padding: 15,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#334155',
    minWidth: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  activeOpponent: {
    borderColor: '#fbbf24',
    shadowColor: '#fbbf24',
    shadowOpacity: 0.8,
    shadowRadius: 15,
  },
  opponentName: {
    fontFamily: Platform.OS === 'ios' ? 'Impact' : 'sans-serif-black',
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  turnIndicator: {
    padding: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  turnText: {
    fontFamily: Platform.OS === 'ios' ? 'Impact' : 'sans-serif-black',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
  },
  myTurnText: {
    color: '#00ffcc',
    textShadowColor: 'rgba(0, 255, 204, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  opponentTurnText: {
    color: '#ef4444',
  },
  cardCountText: {
    fontFamily: Platform.OS === 'ios' ? 'Impact' : 'sans-serif-black',
    color: '#fbbf24',
    fontSize: 32,
    fontWeight: '900',
    textShadowColor: 'rgba(251, 191, 36, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  cardLabel: {
    fontFamily: Platform.OS === 'ios' ? 'Impact' : 'sans-serif-black',
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
  },
  boardContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 40,
  },
  deckSection: {
    alignItems: 'center',
  },
  glowDeck: {
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
  },
  penaltyDeck: {
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
  },
  penaltyBadge: {
    position: 'absolute',
    top: -15,
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#f8fafc',
    shadowColor: '#ef4444',
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  penaltyText: {
    color: 'white',
    fontWeight: '900',
    fontSize: 16,
  },
  disabledDeck: {
    opacity: 0.5,
  },
  discardContainer: {
    width: 90,
    height: 130,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calledSuitBadge: {
    position: 'absolute',
    top: -20,
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fbbf24',
  },
  calledSuitBadgeText: {
    fontSize: 20,
    color: 'white',
  },
  playerContainer: {
    padding: 25,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    borderTopWidth: 2,
    borderTopColor: '#334155',
  },
  activePlayerContainer: {
    borderTopColor: '#8b5cf6',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  handHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  playerName: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1,
  },
  directionBadge: {
    color: '#8b5cf6',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
  },
  playBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  playBtnText: {
    fontFamily: Platform.OS === 'ios' ? 'Impact' : 'sans-serif-black',
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  passBtn: {
    backgroundColor: '#7c3aed',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  passBtnText: {
    fontFamily: Platform.OS === 'ios' ? 'Impact' : 'sans-serif-black',
    color: 'white',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  handScroll: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 220,
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  suitPickerContainer: {
    backgroundColor: '#1e293b',
    padding: 25,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fbbf24',
    shadowColor: '#fbbf24',
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  suitPickerTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Impact' : 'sans-serif-black',
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 20,
  },
  suitRow: {
    flexDirection: 'row',
    gap: 15,
  },
  suitBtn: {
    backgroundColor: '#0f172a',
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#334155',
  },
  suitBtnText: {
    fontSize: 35,
    color: '#f8fafc',
  },
  redText: {
    color: '#ef4444',
  },
  winContainer: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fbbf24',
    shadowColor: '#fbbf24',
    shadowOpacity: 0.8,
    shadowRadius: 30,
  },
  winTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Impact' : 'sans-serif-black',
    fontSize: 55,
    color: '#fbbf24',
    marginBottom: 10,
    textShadowColor: 'rgba(251, 191, 36, 0.5)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
  },
  winSubtitle: {
    fontFamily: Platform.OS === 'ios' ? 'Impact' : 'sans-serif-black',
    fontSize: 20,
    color: '#f8fafc',
    marginBottom: 30,
  },
  lobbyButton: {
    backgroundColor: '#7c3aed',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 15,
  },
  lobbyButtonText: {
    fontFamily: Platform.OS === 'ios' ? 'Impact' : 'sans-serif-black',
    fontSize: 22,
    color: '#ffffff',
  },
});
