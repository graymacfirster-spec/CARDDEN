import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Modal, Alert, ScrollView, Animated, LayoutAnimation, Vibration, Platform, UIManager } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import PlayingCard from '../components/PlayingCard';
import { generateDeck, isValidPlay, shuffleDeck } from '../engine/GameEngine';

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

export default function GameScreen({ route, navigation }) {
  const { playerName, rules, playerCount = 4, chatEnabled = true, startingCards = 7 } = route.params;

  const [deck, setDeck] = useState([]);
  const [discardPile, setDiscardPile] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [opponents, setOpponents] = useState([]);
  
  const [currentTurn, setCurrentTurn] = useState(0); 
  const [direction, setDirection] = useState(1);
  const [calledSuit, setCalledSuit] = useState(null);
  const [showSuitPicker, setShowSuitPicker] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [activePenalty, setActivePenalty] = useState(0);
  const [selectedCardIndices, setSelectedCardIndices] = useState([]);
  const [isFreeTurn, setIsFreeTurn] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [winState, setWinState] = useState(null);

  useEffect(() => {
    const newDeck = generateDeck();
    const pHand = newDeck.splice(0, startingCards);
    
    const opps = [];
    const names = ['Ray', 'John', 'Sarah'];
    for (let i = 0; i < playerCount - 1; i++) {
      const oHand = newDeck.splice(0, startingCards);
      opps.push({
        id: i + 1,
        name: names[i] || `Bot ${i + 1}`,
        hand: oHand
      });
    }

    const validBaseValues = ['3', '4', '5', '6', '9', '10'];
    let firstDiscardIndex = newDeck.findIndex(c => validBaseValues.includes(c.value));
    if (firstDiscardIndex === -1) firstDiscardIndex = 0; 
    const firstDiscard = newDeck.splice(firstDiscardIndex, 1)[0];

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPlayerHand(pHand);
    setOpponents(opps);
    setDiscardPile([firstDiscard]);
    setDeck(newDeck);
  }, [playerCount, startingCards]);

  useEffect(() => {
    if (gameOver) return;
    if (currentTurn > 0 && opponents.length > 0 && !showSuitPicker) {
      const timer = setTimeout(() => {
        simulateOpponentTurn();
      }, 1200); 
      return () => clearTimeout(timer);
    }
  }, [currentTurn, opponents, discardPile, showSuitPicker, activePenalty]);

  const advanceTurn = (dir = direction, steps = 1) => {
    setCurrentTurn(prev => {
      let nextTurn = (prev + (dir * steps)) % playerCount;
      if (nextTurn < 0) nextTurn += playerCount;
      return nextTurn;
    });
    setHasDrawn(false);
    setSelectedCardIndices([]);
    setIsFreeTurn(steps === 0);
  };

  const applyCardPenalties = (card) => {
    if (card.value === '2') setActivePenalty(prev => prev + 2);
    if (card.value === 'Joker') setActivePenalty(prev => prev + 5);
    if (card.value === 'A') setActivePenalty(0);
  };

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

  const checkWinCondition = (handLength, name, isPlayer) => {
    if (handLength === 0) {
      setGameOver(true);
      Vibration.vibrate([0, 500, 200, 500]);
      playSFX('win');
      setWinState({ isPlayer, name });
      return true;
    } else if (handLength === 1) {
      Vibration.vibrate(100);
      playSFX('check');
      Alert.alert("CHECK!", isPlayer ? "You have one card left!" : `${name} has one card left!`);
    }
    return false;
  };

  const simulateOpponentTurn = () => {
    const oppIndex = currentTurn - 1;
    const opp = opponents[oppIndex];
    if (!opp) {
      advanceTurn();
      return;
    }

    const topCard = discardPile[discardPile.length - 1];
    
    const specialCards = ['A', 'Joker', '2', '7', '8', 'J', 'Q', 'K'];
    let validIndex = opp.hand.findIndex(c => isValidPlay(c, topCard, rules, activePenalty, calledSuit, isFreeTurn));
    let cardsToPlay = [];
    let playedIndices = [];

    let nextDir = direction;
    let nextOpponents = [...opponents];
    let nextDeck = [...deck];
    let nextDiscard = [...discardPile];
    
    if (validIndex !== -1) {
      const validCard = opp.hand[validIndex];
      cardsToPlay.push(validCard);
      playedIndices.push(validIndex);
      
      for (let i = 0; i < opp.hand.length; i++) {
        if (i !== validIndex && opp.hand[i].value === validCard.value) {
          cardsToPlay.push(opp.hand[i]);
          playedIndices.push(i);
        }
      }
    } else {
      // Draw cards
      let cardsToDraw = activePenalty > 0 ? activePenalty : 1;
      let drawnCards = [];
      
      for (let i = 0; i < cardsToDraw; i++) {
        if (nextDeck.length === 0 && nextDiscard.length > 1) {
          nextDeck = shuffleDeck(nextDiscard.slice(0, -1));
          nextDiscard = [nextDiscard[nextDiscard.length - 1]];
        }
        if (nextDeck.length > 0) {
          drawnCards.push(nextDeck[0]);
          nextDeck.shift();
        }
      }

      if (activePenalty > 0) {
        setActivePenalty(0);
        const newHand = [...opp.hand, ...drawnCards];
        nextOpponents[oppIndex] = { ...opp, hand: newHand };
        setOpponents(nextOpponents);
        setDeck(nextDeck);
        setDiscardPile(nextDiscard);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        advanceTurn(nextDir, 1);
        return; 
      } else {
        if (drawnCards.length > 0) {
          const drawnCard = drawnCards[0];
          if (isValidPlay(drawnCard, topCard, rules, activePenalty, calledSuit, isFreeTurn)) {
            cardsToPlay.push(drawnCard);
            // Drawn card is playable! Are there matching doubles in hand?
            for (let i = 0; i < opp.hand.length; i++) {
              if (opp.hand[i].value === drawnCard.value) {
                cardsToPlay.push(opp.hand[i]);
                playedIndices.push(i);
              }
            }
          } else {
            const newHand = [...opp.hand, drawnCard];
            nextOpponents[oppIndex] = { ...opp, hand: newHand };
          }
        }
      }
    }

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDeck(nextDeck);

    if (cardsToPlay.length > 0) {
      let newHand = opp.hand.filter((_, i) => !playedIndices.includes(i));
      const lastCardPlayed = cardsToPlay[cardsToPlay.length - 1];
      
      if (newHand.length === 0 && specialCards.includes(lastCardPlayed.value)) {
        if (nextDeck.length === 0 && nextDiscard.length > 1) {
          nextDeck = shuffleDeck(nextDiscard.slice(0, -1));
          nextDiscard = [nextDiscard[nextDiscard.length - 1]];
        }
        if (nextDeck.length > 0) {
          newHand = [nextDeck[0]];
          nextDeck.shift();
        }
      }

      nextOpponents[oppIndex] = { ...opp, hand: newHand };
      
      nextDiscard.push(...cardsToPlay);
      setOpponents(nextOpponents);
      setDiscardPile(nextDiscard);
      
      cardsToPlay.forEach(c => applyCardPenalties(c));
      const didWin = checkWinCondition(newHand.length, opp.name, false);
      if (didWin) return;

      let steps = 1;
      const jCount = cardsToPlay.filter(c => c.value === 'J').length;
      if (jCount > 0) {
        if (jCount % 2 === 1) {
          nextDir = -direction;
          setDirection(nextDir);
        } else {
          steps = 0;
        }
      }

      const sevensCount = cardsToPlay.filter(c => c.value === '7').length;
      if (playerCount === 2) {
        if (cardsToPlay.some(c => c.value === '7' || c.value === 'J' || c.value === 'K')) steps = 0;
      } else {
        if (sevensCount > 0) steps = 1 + sevensCount;
        if (cardsToPlay.some(c => c.value === 'K')) steps = 0;
      }

      if (lastCardPlayed.value === '8') {
        const suits = ['♥️', '♦️', '♣️', '♠️'];
        setCalledSuit(suits[Math.floor(Math.random() * suits.length)]);
      } else {
        setCalledSuit(null);
      }

      advanceTurn(nextDir, steps);
    } else {
      setDiscardPile(nextDiscard);
      setOpponents(nextOpponents);
      advanceTurn(nextDir, 1);
    }
  };

  const handleCardTap = (index) => {
    if (currentTurn !== 0 || showSuitPicker) return;
    
    setSelectedCardIndices(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      }
      return [...prev, index];
    });
  };

  const handlePlaySelection = () => {
    if (selectedCardIndices.length === 0) return;

    const selectedCards = selectedCardIndices.map(i => playerHand[i]);
    const firstValue = selectedCards[0].value;
    
    if (!selectedCards.every(c => c.value === firstValue)) {
      Alert.alert("Invalid Move", "You can only play multiple cards if they have the same value!");
      return;
    }

    const specialCards = ['A', 'Joker', '2', '7', '8', 'J', 'Q', 'K'];

    const topCard = discardPile[discardPile.length - 1];
    const validIndex = selectedCards.findIndex(c => isValidPlay(c, topCard, rules, activePenalty, calledSuit, isFreeTurn));
    
    if (validIndex === -1) {
      if (activePenalty > 0) {
        Alert.alert("Invalid Move", "You must play a blocking card or draw the penalty!");
      } else {
        Alert.alert("Invalid Move", "None of these cards can be played on the discard pile right now!");
      }
      return;
    }

    Vibration.vibrate(50);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    const cardsToPlay = [...selectedCards];
    const validCard = cardsToPlay.splice(validIndex, 1)[0];
    cardsToPlay.unshift(validCard);

    const lastCardPlayed = cardsToPlay[cardsToPlay.length - 1];
    let newHand = playerHand.filter((_, i) => !selectedCardIndices.includes(i));
    
    if (newHand.length === 0 && specialCards.includes(lastCardPlayed.value)) {
      Alert.alert("Special Card Check!", "You cannot win with a special card, so you must draw a card!");
      let nextDeck = [...deck];
      let nextDiscard = [...discardPile, ...cardsToPlay];
      
      if (nextDeck.length === 0 && nextDiscard.length > 1) {
        nextDeck = shuffleDeck(nextDiscard.slice(0, -1));
        nextDiscard = [nextDiscard[nextDiscard.length - 1]];
        setDiscardPile(nextDiscard);
      }
      if (nextDeck.length > 0) {
        newHand = [nextDeck[0]];
        nextDeck.shift();
        setDeck(nextDeck);
      }
    }

    setPlayerHand(newHand);
    setSelectedCardIndices([]);

    setDiscardPile(prev => [...prev, ...cardsToPlay]);
    cardsToPlay.forEach(c => applyCardPenalties(c));

    const didWin = checkWinCondition(newHand.length, playerName, true);
    if (didWin) return;

    if (lastCardPlayed.value === '8') {
      setShowSuitPicker(true);
    } else {
      let nextDir = direction;
      let steps = 1;

      const jCount = cardsToPlay.filter(c => c.value === 'J').length;
      if (jCount > 0) {
        if (jCount % 2 === 1) {
          nextDir = -direction;
          setDirection(nextDir);
        } else {
          steps = 0;
        }
      }

      const sevensCount = cardsToPlay.filter(c => c.value === '7').length;
      if (playerCount === 2) {
        if (cardsToPlay.some(c => c.value === '7' || c.value === 'J' || c.value === 'K')) steps = 0;
      } else {
        if (sevensCount > 0) steps = 1 + sevensCount;
        if (cardsToPlay.some(c => c.value === 'K')) steps = 0;
      }

      setCalledSuit(null);
      advanceTurn(nextDir, steps);
    }
  };

  const handleSelectSuit = (suit) => {
    setCalledSuit(suit);
    setShowSuitPicker(false);
    advanceTurn(direction, 1);
  };

  const drawCard = () => {
    if (currentTurn !== 0 || showSuitPicker || hasDrawn) return; 

    if (activePenalty > 0) {
      const topCard = discardPile[discardPile.length - 1];
      const hasBlock = playerHand.some(c => isValidPlay(c, topCard, rules, activePenalty, calledSuit, isFreeTurn));
      
      if (hasBlock) {
        Alert.alert(
          "Block Available!", 
          "You have a card that can block this penalty! Are you sure you want to draw instead?", 
          [
            { text: "Cancel", style: "cancel" },
            { text: "Draw Penalty", style: "destructive", onPress: () => executeDraw() }
          ]
        );
        return;
      }
    }
    
    executeDraw();
  };

  const executeDraw = () => {
    Vibration.vibrate(50);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    let currentDeck = [...deck];
    let cardsToDraw = activePenalty > 0 ? activePenalty : 1;
    let drawnCards = [];
    let currentDiscard = [...discardPile];

    for (let i = 0; i < cardsToDraw; i++) {
       if (currentDeck.length === 0) {
         if (currentDiscard.length > 1) {
           currentDeck = shuffleDeck(currentDiscard.slice(0, -1));
           currentDiscard = [currentDiscard[currentDiscard.length - 1]];
         } else {
           break; 
         }
       }
       if (currentDeck.length > 0) {
         drawnCards.push(currentDeck[0]);
         currentDeck.shift();
       }
    }

    setDeck(currentDeck);
    setDiscardPile(currentDiscard);
    setPlayerHand(prev => [...prev, ...drawnCards]);
    setSelectedCardIndices([]);

    if (activePenalty > 0) {
      setActivePenalty(0);
      advanceTurn(direction, 1); 
    } else {
      setHasDrawn(true);
    }
  };

  const handlePass = () => {
    if (currentTurn !== 0 || !hasDrawn) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    advanceTurn(direction, 1);
  };

  const handleChat = () => {
    if (!chatEnabled) Alert.alert('Chat Disabled', 'Chat is disabled for this game.');
    else Alert.alert('Chat', 'Quick chat opened! (Coming soon)');
  };

  const handleAbort = () => {
    setWinState({ isPlayer: false, name: opponents.length > 0 ? opponents[0].name : 'Opponent' });
  };

  const handleRestart = () => {
    Alert.alert("Restart Request", "Waiting for opponent to accept...", [], { cancelable: false });
    setTimeout(() => {
      if (Math.random() > 0.3) {
        navigation.replace('Game', route.params);
      } else {
        Alert.alert("Restart Declined", "The opponent rejected the restart.");
      }
    }, 1500);
  };

  return (
    <LinearGradient colors={['#000000', '#1a0b2e', '#000000']} style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.topActions}>
          <TouchableOpacity style={styles.abortBtn} onPress={handleAbort}>
            <Text style={styles.abortBtnText}>ABORT</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.restartBtn} onPress={handleRestart}>
            <Text style={styles.restartBtnText}>RESTART</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.bridgeContainer}>
          {opponents.map((opp) => {
            const isTurn = currentTurn === opp.id;
          return (
            <View key={opp.id} style={[styles.opponent, isTurn && styles.activeOpponent]}>
              <Text style={styles.opponentName}>{opp.name}</Text>
              <Text style={styles.cardCount}>{opp.hand.length}</Text>
              <Text style={styles.cardLabel}>CARDS</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.boardContainer}>
        <View style={styles.deckSection}>
          <TouchableOpacity 
            onPress={drawCard} 
            activeOpacity={0.8} 
            style={[
              currentTurn === 0 && !hasDrawn && styles.glowDeck, 
              hasDrawn && styles.disabledDeck,
              activePenalty > 0 && currentTurn === 0 && styles.penaltyDeck
            ]}
          >
            <PlayingCard isHidden={true} />
          </TouchableOpacity>
          {activePenalty > 0 && (
            <View style={styles.penaltyBadge}>
              <Text style={styles.penaltyText}>+{activePenalty}</Text>
            </View>
          )}
        </View>
        
        <View style={styles.discardContainer}>
          {discardPile.map((card, index) => {
            if (index < discardPile.length - 4) return null; 
            return (
              <PlayingCard 
                key={`${card.id}-${index}`}
                suit={card.suit} 
                value={card.value}
                style={{ position: 'absolute', transform: [{ rotate: `${(index * 7) % 20 - 10}deg` }] }}
              />
            );
          })}
          {calledSuit && (
            <View style={styles.calledSuitBadge}>
              <Text style={styles.calledSuitText}>{calledSuit}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={[styles.playerContainer, currentTurn === 0 && styles.activePlayerContainer]}>
        <View style={styles.handHeader}>
          <View>
            <Text style={styles.playerName}>{playerName.toUpperCase()}</Text>
            <Text style={styles.directionBadge}>{direction === 1 ? '▶' : '◀'} {rules}</Text>
          </View>
          <View style={styles.actionRow}>
            {selectedCardIndices.length > 0 && currentTurn === 0 && (
              <TouchableOpacity style={styles.playBtn} onPress={handlePlaySelection}>
                <Text style={styles.playBtnText}>PLAY CARDS</Text>
              </TouchableOpacity>
            )}
            {hasDrawn && currentTurn === 0 && activePenalty === 0 && selectedCardIndices.length === 0 && (
              <TouchableOpacity style={styles.passBtn} onPress={handlePass}>
                <Text style={styles.passBtnText}>PASS</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={[styles.chatBtn, !chatEnabled && styles.chatBtnDisabled]} 
              onPress={handleChat}
            >
              <Text style={styles.chatBtnText}>💬 CHAT</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={{ width: '100%', alignItems: 'center' }}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.handScroll}
          >
          {playerHand.map((card, index) => {
            const isSelected = selectedCardIndices.includes(index);
            const middleIndex = (playerHand.length - 1) / 2;
            const distance = index - middleIndex;
            
            const maxDistance = 6;
            const effectiveDistance = Math.max(-maxDistance, Math.min(maxDistance, distance));
            
            const rotation = effectiveDistance * 4; 
            const yOffset = Math.pow(Math.abs(effectiveDistance), 1.5) * 3;

            return (
              <TouchableOpacity 
                key={card.id} 
                onPress={() => handleCardTap(index)}
                activeOpacity={0.9}
                style={{ 
                  marginLeft: index === 0 ? 0 : -45, 
                  opacity: currentTurn === 0 ? 1 : 0.7,
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

      {showSuitPicker && (
        <View style={styles.modalOverlay}>
          <View style={styles.suitPickerContainer}>
            <Text style={styles.suitPickerTitle}>Select a Suit</Text>
            <View style={styles.suitRow}>
              {['♥️', '♦️', '♣️', '♠️'].map(s => (
                <TouchableOpacity key={s} style={styles.suitBtn} onPress={() => handleSelectSuit(s)}>
                  <Text style={[styles.suitBtnText, (s === '♥️' || s === '♦️') && styles.redText]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {winState && (
        <View style={styles.modalOverlay}>
          <View style={styles.winContainer}>
            <Text style={styles.winTitle}>
              {winState.isPlayer ? 'VICTORY!' : 'GAME OVER'}
            </Text>
            <Text style={styles.winSubtitle}>
              {winState.isPlayer ? 'You won the game! 🎉' : `${winState.name} won! 😢`}
            </Text>
            <TouchableOpacity 
              style={styles.lobbyButton} 
              onPress={() => navigation.replace('Lobby')}
            >
              <Text style={styles.lobbyButtonText}>BACK TO LOBBY</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
  },
  topActions: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 15,
    zIndex: 10,
    flexDirection: 'row',
    gap: 10,
  },
  abortBtn: {
    backgroundColor: 'rgba(255, 0, 234, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff00ea',
  },
  abortBtnText: {
    fontFamily: Platform.OS === 'ios' ? 'Impact' : 'sans-serif-black',
    color: '#ff00ea',
    fontSize: 14,
    letterSpacing: 1,
  },
  restartBtn: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00e5ff',
  },
  restartBtnText: {
    fontFamily: Platform.OS === 'ios' ? 'Impact' : 'sans-serif-black',
    color: '#00e5ff',
    fontSize: 14,
    letterSpacing: 1,
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
  cardCount: {
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
  calledSuitText: {
    fontSize: 20,
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
  chatBtn: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  chatBtnDisabled: {
    backgroundColor: '#475569',
    shadowOpacity: 0,
  },
  chatBtnText: {
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
