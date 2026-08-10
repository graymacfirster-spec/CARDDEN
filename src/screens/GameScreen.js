import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import PlayingCard, { CARD_ASPECT } from '../components/PlayingCard';
import CardFan from '../components/CardFan';
import FeltTable from '../components/FeltTable';
import { BrassButton, Plaque, PlayerSeat } from '../components/TableUI';
import { useTableSound } from '../hooks/useTableSound';
import { useLandscape } from '../hooks/useLandscape';
import { COLORS, FONTS, RADIUS, glow, shadow, isRedSuit, suitGlyph } from '../theme/casino';
import { generateDeck, isValidPlay, shuffleDeck } from '../engine/GameEngine';

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

const SUIT_CHOICES = ['♥️', '♦️', '♣️', '♠️'];

export default function GameScreen({ route, navigation }) {
  const { playerName, rules, playerCount = 4, chatEnabled = true, startingCards = 7 } = route.params;

  const { width, height, needsRotate } = useLandscape();
  const insets = useSafeAreaInsets();
  const { playCheck, playWin, tap, notify } = useTableSound();

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const showToast = useCallback((message) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);
  useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);

  const metrics = useMemo(() => {
    const shortSide = Math.min(width, height);
    // The fan is ~1.85 card-heights tall, so cards stay modest in landscape.
    const handCard = Math.round(Math.max(46, Math.min(76, shortSide * 0.17)));
    return { handCard, boardCard: Math.round(handCard * 1.05), compactSeats: width < 760 };
  }, [width, height]);

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

  const checkWinCondition = (handLength, name, isPlayer, isSpecialFinish) => {
    if (handLength === 0) {
      if (isSpecialFinish) {
        if (isPlayer) {
          showToast('No winning on a special card — you must draw next turn.');
          notify('warning');
        }
        return false;
      }
      setGameOver(true);
      playWin();
      setWinState({ isPlayer, name });
      return true;
    } else if (handLength === 1) {
      playCheck();
      showToast(isPlayer ? 'CHECK — one card left!' : `CHECK — ${name} is on one card!`);
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
      nextOpponents[oppIndex] = { ...opp, hand: newHand };
      
      nextDiscard.push(...cardsToPlay);
      setOpponents(nextOpponents);
      setDiscardPile(nextDiscard);
      
      cardsToPlay.forEach(c => applyCardPenalties(c));
      const didWin = checkWinCondition(newHand.length, opp.name, false, specialCards.includes(lastCardPlayed.value));
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
      showToast('Multiple cards must all share the same value.');
      notify('error');
      return;
    }

    const specialCards = ['A', 'Joker', '2', '7', '8', 'J', 'Q', 'K'];

    const topCard = discardPile[discardPile.length - 1];
    const validIndex = selectedCards.findIndex(c => isValidPlay(c, topCard, rules, activePenalty, calledSuit, isFreeTurn));
    
    if (validIndex === -1) {
      if (activePenalty > 0) {
        showToast(`Block with a 2, Ace or Joker — or draw ${activePenalty}.`);
      } else {
        showToast("That won't go on the pile.");
      }
      notify('error');
      return;
    }

    tap('medium');
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    const cardsToPlay = [...selectedCards];
    const validCard = cardsToPlay.splice(validIndex, 1)[0];
    cardsToPlay.unshift(validCard);

    const lastCardPlayed = cardsToPlay[cardsToPlay.length - 1];
    let newHand = playerHand.filter((_, i) => !selectedCardIndices.includes(i));
    setPlayerHand(newHand);
    setSelectedCardIndices([]);

    setDiscardPile(prev => [...prev, ...cardsToPlay]);
    cardsToPlay.forEach(c => applyCardPenalties(c));

    const didWin = checkWinCondition(newHand.length, playerName, true, specialCards.includes(lastCardPlayed.value));
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
    tap('light');
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
    showToast(chatEnabled ? 'Quick chat is coming soon.' : 'Chat is disabled for this game.');
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


  if (needsRotate) {
    return (
      <FeltTable>
        <View style={styles.rotateWrap}>
          <Text style={styles.rotateGlyph}>⟳</Text>
          <Text style={styles.rotateText}>TURN YOUR DEVICE SIDEWAYS</Text>
          <Text style={styles.rotateSub}>CARDDEN is played on a wide table.</Text>
        </View>
      </FeltTable>
    );
  }

  const topCard = discardPile[discardPile.length - 1];

  return (
    <FeltTable>
      <View
        style={[
          styles.safe,
          { paddingTop: insets.top, paddingLeft: 12 + insets.left, paddingRight: 12 + insets.right },
        ]}
      >
        {/* ---- Top rail ---- */}
        <View style={styles.topRail}>
          <View style={styles.topLeft}>
            <BrassButton label="ABORT" tone="red" compact onPress={handleAbort} />
            <BrassButton label="RESTART" tone="slate" compact onPress={handleRestart} />
          </View>

          <View style={styles.seatRow}>
            {opponents.map((opp) => (
              <PlayerSeat
                key={opp.id}
                name={opp.name}
                cardCount={opp.hand.length}
                isTurn={currentTurn === opp.id}
                compact={metrics.compactSeats}
              />
            ))}
          </View>

          <BrassButton
            label={chatEnabled ? 'CHAT' : 'NO CHAT'}
            tone="slate"
            compact
            onPress={handleChat}
          />
        </View>

        {/* ---- Board ---- */}
        <View style={styles.board}>
          <View style={styles.pileWrap}>
            <Pressable
              onPress={drawCard}
              disabled={currentTurn !== 0 || hasDrawn}
              style={(currentTurn !== 0 || hasDrawn) && styles.pileIdle}
            >
              <View>
                {currentTurn === 0 && !hasDrawn && (
                  <View
                    style={[
                      styles.drawHalo,
                      {
                        width: metrics.boardCard + 12,
                        height: metrics.boardCard * CARD_ASPECT + 12,
                        borderRadius: metrics.boardCard * 0.14,
                      },
                      activePenalty > 0 && styles.drawHaloDanger,
                    ]}
                    pointerEvents="none"
                  />
                )}
                <PlayingCard isHidden width={metrics.boardCard} />
              </View>
            </Pressable>
            <Text style={styles.pileLabel}>{deck.length} LEFT</Text>
            {activePenalty > 0 && (
              <Animated.View entering={ZoomIn.springify()} style={styles.penaltyBadge}>
                <Text style={styles.penaltyBadgeText}>+{activePenalty}</Text>
              </Animated.View>
            )}
          </View>

          <View style={styles.centerColumn}>
            <Plaque tone={currentTurn === 0 ? 'live' : 'neutral'} style={styles.turnPlaque}>
              <Text style={[styles.turnText, currentTurn === 0 && styles.turnTextLive]} numberOfLines={1}>
                {gameOver
                  ? 'HAND OVER'
                  : currentTurn === 0
                    ? 'YOUR TURN'
                    : `${(opponents[currentTurn - 1]?.name ?? 'DEALER').toUpperCase()}'S TURN`}
              </Text>
            </Plaque>
            <View style={styles.metaRow}>
              <Plaque>
                <Text style={styles.metaText}>{direction === 1 ? '↻ CLOCKWISE' : '↺ COUNTER'}</Text>
              </Plaque>
              <Plaque>
                <Text style={styles.metaText}>{rules}</Text>
              </Plaque>
            </View>
          </View>

          <View style={[styles.pileWrap, { width: metrics.boardCard * 1.5 }]}>
            <View style={{ width: metrics.boardCard, height: metrics.boardCard * CARD_ASPECT }}>
              {discardPile.slice(-4).map((card, i, arr) => {
                const absIndex = discardPile.length - arr.length + i;
                const angle = (((absIndex * 37) % 17) - 8) * 1.1;
                return (
                  <Animated.View
                    key={`${card.id}-${absIndex}`}
                    entering={i === arr.length - 1 ? ZoomIn.springify().damping(15).mass(0.6) : undefined}
                    style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${angle}deg` }], zIndex: i }]}
                  >
                    <PlayingCard suit={card.suit} value={card.value} width={metrics.boardCard} />
                  </Animated.View>
                );
              })}
            </View>
            <Text style={styles.pileLabel}>DISCARD</Text>
            {!!calledSuit && (
              <Animated.View entering={ZoomIn.springify()} style={styles.calledSuit}>
                <Text
                  style={[
                    styles.calledSuitGlyph,
                    { color: isRedSuit(calledSuit) ? COLORS.suitRed : COLORS.suitBlack },
                  ]}
                >
                  {suitGlyph(calledSuit)}
                </Text>
              </Animated.View>
            )}
          </View>
        </View>

        {/* ---- Player rail ---- */}
        <View style={styles.playerRail}>
          <View style={styles.railHeader}>
            <View style={styles.railIdentity}>
              <Text style={styles.railName} numberOfLines={1}>
                {playerName?.toUpperCase() ?? 'YOU'}
              </Text>
              <Text style={styles.railCount}>{playerHand.length} IN HAND</Text>
            </View>

            <View style={styles.railActions}>
              {currentTurn === 0 && activePenalty > 0 && (
                <Plaque tone="warn">
                  <Text style={styles.penaltyText}>STACKED +{activePenalty}</Text>
                </Plaque>
              )}
              {selectedCardIndices.length > 0 && currentTurn === 0 && (
                <BrassButton
                  label={selectedCardIndices.length > 1 ? `PLAY ${selectedCardIndices.length}` : 'PLAY'}
                  tone="green"
                  compact
                  onPress={handlePlaySelection}
                />
              )}
              {selectedCardIndices.length > 0 && (
                <BrassButton
                  label="CLEAR"
                  tone="slate"
                  compact
                  onPress={() => setSelectedCardIndices([])}
                />
              )}
              {hasDrawn && currentTurn === 0 && activePenalty === 0 && selectedCardIndices.length === 0 && (
                <BrassButton label="PASS" tone="gold" compact onPress={handlePass} />
              )}
            </View>
          </View>

          <CardFan
            cards={playerHand}
            selectedIndices={selectedCardIndices}
            onCardPress={handleCardTap}
            cardWidth={metrics.handCard}
            availableWidth={width - 32}
            dimmed={currentTurn !== 0}
          />
        </View>

        {/* ---- Toast ---- */}
        {toast && (
          <Animated.View entering={FadeInDown.duration(160)} style={styles.toast} pointerEvents="none">
            <Text style={styles.toastText}>{toast}</Text>
          </Animated.View>
        )}

        {/* ---- Suit picker ---- */}
        {showSuitPicker && (
          <Animated.View entering={FadeIn.duration(140)} style={styles.overlay}>
            <Animated.View entering={ZoomIn.springify().damping(16)} style={styles.modal}>
              <Text style={styles.modalTitle}>CALL THE SUIT</Text>
              <View style={styles.suitRow}>
                {SUIT_CHOICES.map((s) => (
                  <Pressable key={s} style={styles.suitBtn} onPress={() => handleSelectSuit(s)}>
                    <Text
                      style={[
                        styles.suitGlyph,
                        { color: isRedSuit(s) ? COLORS.suitRed : COLORS.suitBlack },
                      ]}
                    >
                      {suitGlyph(s)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Animated.View>
          </Animated.View>
        )}

        {/* ---- Game over ---- */}
        {winState && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.overlay}>
            <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.modal}>
              <Text style={styles.winKicker}>
                {winState.isPlayer ? 'YOU TAKE THE TABLE' : 'THE HAND IS OVER'}
              </Text>
              <Text style={styles.winName}>
                {(winState.isPlayer ? playerName : winState.name)?.toUpperCase()}
              </Text>
              <Text style={styles.winSub}>TAKES THE POT</Text>
              <BrassButton
                label="BACK TO THE FLOOR"
                tone="gold"
                onPress={() => navigation.replace('Lobby')}
                style={{ marginTop: 18 }}
              />
            </Animated.View>
          </Animated.View>
        )}
      </View>
    </FeltTable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  rotateWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  rotateGlyph: { fontSize: 44, color: COLORS.goldBright },
  rotateText: {
    fontFamily: FONTS.ui,
    color: COLORS.goldBright,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
  },
  rotateSub: { fontFamily: FONTS.ui, color: COLORS.creamDim, fontSize: 12, letterSpacing: 1 },

  topRail: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingTop: 4,
  },
  topLeft: { flexDirection: 'row', gap: 6 },
  seatRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
  },

  board: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  centerColumn: { alignItems: 'center', gap: 8, maxWidth: 260 },
  metaRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' },
  metaText: {
    fontFamily: FONTS.ui,
    color: COLORS.cream,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  turnPlaque: { paddingHorizontal: 20, paddingVertical: 7 },
  turnText: {
    fontFamily: FONTS.display,
    color: COLORS.cream,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 2,
  },
  turnTextLive: { color: COLORS.goldBright },

  pileWrap: { alignItems: 'center', gap: 6 },
  pileIdle: { opacity: 0.62 },
  drawHalo: {
    position: 'absolute',
    top: -6,
    left: -6,
    borderWidth: 2,
    borderColor: COLORS.goldBright,
    ...glow(COLORS.goldBright, 14, 1),
  },
  drawHaloDanger: { borderColor: COLORS.danger, ...glow(COLORS.danger, 14, 1) },
  pileLabel: {
    fontFamily: FONTS.ui,
    color: COLORS.creamDim,
    fontSize: 9,
    letterSpacing: 1.6,
    fontWeight: '700',
  },
  penaltyBadge: {
    position: 'absolute',
    top: -10,
    right: -8,
    backgroundColor: COLORS.danger,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderWidth: 1.5,
    borderColor: COLORS.goldBright,
    ...glow(COLORS.danger, 10, 0.9),
  },
  penaltyBadgeText: { fontFamily: FONTS.ui, color: '#fff', fontSize: 12, fontWeight: '900' },
  calledSuit: {
    position: 'absolute',
    top: -10,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.ivory,
    borderWidth: 2,
    borderColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow(6),
  },
  calledSuitGlyph: { fontSize: 15, fontWeight: '700' },

  playerRail: {
    borderTopWidth: 1.5,
    borderTopColor: COLORS.goldDim,
    backgroundColor: 'rgba(2, 24, 14, 0.55)',
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    paddingTop: 4,
  },
  railHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    gap: 10,
  },
  railIdentity: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  railName: {
    fontFamily: FONTS.ui,
    color: COLORS.goldBright,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
    maxWidth: 160,
  },
  railCount: {
    fontFamily: FONTS.ui,
    color: COLORS.creamDim,
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  railActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  penaltyText: {
    fontFamily: FONTS.ui,
    color: COLORS.cream,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  toast: {
    position: 'absolute',
    bottom: '38%',
    alignSelf: 'center',
    backgroundColor: 'rgba(10,0,0,0.88)',
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: RADIUS.md,
    paddingHorizontal: 16,
    paddingVertical: 9,
    maxWidth: 420,
    ...shadow(10),
  },
  toastText: {
    fontFamily: FONTS.ui,
    color: COLORS.cream,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textAlign: 'center',
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: '#07301c',
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: COLORS.gold,
    paddingHorizontal: 28,
    paddingVertical: 22,
    alignItems: 'center',
    gap: 12,
    ...shadow(20),
  },
  modalTitle: {
    fontFamily: FONTS.display,
    color: COLORS.goldBright,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 3,
  },
  suitRow: { flexDirection: 'row', gap: 12 },
  suitBtn: {
    width: 58,
    height: 58,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.ivory,
    borderWidth: 2,
    borderColor: COLORS.ivoryEdge,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow(6),
  },
  suitGlyph: { fontSize: 30, fontWeight: '700' },

  winKicker: {
    fontFamily: FONTS.ui,
    color: COLORS.creamDim,
    fontSize: 10,
    letterSpacing: 3,
    fontWeight: '800',
  },
  winName: {
    fontFamily: FONTS.display,
    color: COLORS.goldBright,
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
  },
  winSub: {
    fontFamily: FONTS.ui,
    color: COLORS.cream,
    fontSize: 12,
    letterSpacing: 3,
    fontWeight: '800',
  },
});
