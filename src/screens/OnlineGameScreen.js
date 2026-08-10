import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useAuth } from '../context/AuthContext';
import { useRoomSync } from '../net/useRoomSync';
import { useVoiceChat } from '../voice/useVoiceChat';
import { useTableSound } from '../hooks/useTableSound';
import { useLandscape } from '../hooks/useLandscape';
import FeltTable from '../components/FeltTable';
import PlayingCard, { CARD_ASPECT } from '../components/PlayingCard';
import CardFan from '../components/CardFan';
import VoiceHUD from '../components/VoiceHUD';
import { BrassButton, Plaque, PlayerSeat } from '../components/TableUI';
import { COLORS, FONTS, RADIUS, glow, shadow, suitGlyph, isRedSuit } from '../theme/casino';
import {
  applyDraw,
  applyPass,
  applyPlay,
  isValidPlay,
  playableIndices,
  topCardOf,
} from '../engine/GameEngine';

const SUIT_CHOICES = ['♥️', '♦️', '♣️', '♠️'];

export default function OnlineGameScreen({ route, navigation }) {
  const { roomId, isHost, role } = route.params;
  const { profile } = useAuth();
  const selfId = profile?.id;

  const { width, height, needsRotate } = useLandscape();
  const insets = useSafeAreaInsets();
  const { playCheck, playWin, tap, notify } = useTableSound();

  const { gameState: gs, participants, connected, applyMove, channel, channelEpoch } = useRoomSync({
    roomId,
    isHost,
    selfId,
  });

  const voice = useVoiceChat({ channelRef: channel, selfId, channelEpoch });

  const [selected, setSelected] = useState([]);
  const [suitPickerFor, setSuitPickerFor] = useState(null); // { indices, cards }
  const [hasDrawn, setHasDrawn] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // ---- Responsive metrics (landscape-first) -------------------------------
  const metrics = useMemo(() => {
    const shortSide = Math.min(width, height);
    // The fan is ~1.85 card-heights tall, so cards stay modest in landscape.
    const handCard = Math.round(Math.max(46, Math.min(76, shortSide * 0.17)));
    return {
      handCard,
      boardCard: Math.round(handCard * 1.05),
      compactSeats: width < 760,
    };
  }, [width, height]);

  const showToast = useCallback((message, tone = 'warn') => {
    setToast({ message, tone });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);

  // ---- Derived game facts -------------------------------------------------
  const isPlayer = role === 'participant';
  const myHand = useMemo(() => (gs && selfId ? gs.hands?.[selfId] ?? [] : []), [gs, selfId]);
  const activePlayerId = gs ? gs.turnOrder[gs.currentTurnIndex] : null;
  const isMyTurn = !!gs && !gs.gameOver && isPlayer && activePlayerId === selfId;
  const topCard = gs ? topCardOf(gs) : null;

  const playable = useMemo(
    () => (gs && isMyTurn ? playableIndices(myHand, gs) : []),
    [gs, isMyTurn, myHand]
  );

  const nameOf = useCallback(
    (id) => participants.find((p) => p.profile_id === id)?.profiles?.username || 'Player',
    [participants]
  );

  // Reset the per-turn draw flag whenever the turn comes back around.
  useEffect(() => {
    if (isMyTurn) setHasDrawn(false);
  }, [isMyTurn, gs?.currentTurnIndex]);

  // Clear a stale selection if the hand changed underneath us.
  useEffect(() => {
    setSelected((prev) => prev.filter((i) => i < myHand.length));
  }, [myHand.length]);

  // ---- Stingers: someone hit one card, or won -----------------------------
  const prevCounts = useRef({});
  useEffect(() => {
    if (!gs?.hands) return;
    const counts = {};
    let check = false;
    let win = false;
    for (const [pid, hand] of Object.entries(gs.hands)) {
      counts[pid] = hand.length;
      const before = prevCounts.current[pid];
      if (before === undefined) continue;
      if (before > 1 && counts[pid] === 1) check = true;
      if (before > 0 && counts[pid] === 0) win = true;
    }
    prevCounts.current = counts;
    if (win) playWin();
    else if (check) playCheck();
  }, [gs?.hands, playCheck, playWin]);

  // ---- Actions ------------------------------------------------------------
  const handleCardPress = useCallback(
    (index) => {
      if (suitPickerFor) return;
      if (!isMyTurn) {
        showToast(`Hold up — it's ${nameOf(activePlayerId)}'s turn.`);
        return;
      }
      tap('light');
      setSelected((prev) =>
        prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
      );
    },
    [suitPickerFor, isMyTurn, showToast, nameOf, activePlayerId, tap]
  );

  const executePlay = useCallback(
    (indices, cards, chosenSuit) => {
      setSuitPickerFor(null);
      setSelected([]);
      setHasDrawn(false);
      tap('medium');
      applyMove((draft) => applyPlay(draft, selfId, indices, cards, chosenSuit));
    },
    [applyMove, selfId, tap]
  );

  const handlePlaySelection = useCallback(() => {
    if (!selected.length || !gs) return;

    const cards = selected.map((i) => myHand[i]);
    if (!cards.every((c) => c.value === cards[0].value)) {
      showToast('Multiple cards must all share the same value.');
      notify('error');
      return;
    }

    const leadAt = cards.findIndex((c) =>
      isValidPlay(c, topCard, gs.rules?.rulesForm, gs.activePenalty, gs.calledSuit, gs.isFreeTurn)
    );
    if (leadAt === -1) {
      showToast(
        gs.activePenalty > 0
          ? `Block with a 2, Ace or Joker — or draw ${gs.activePenalty}.`
          : "That won't go on the pile."
      );
      notify('error');
      return;
    }

    // The legal card has to lead the run; the rest follow.
    const ordered = [...cards];
    ordered.unshift(ordered.splice(leadAt, 1)[0]);

    if (ordered[ordered.length - 1].value === '8') {
      setSuitPickerFor({ indices: selected, cards: ordered });
      return;
    }
    executePlay(selected, ordered, null);
  }, [selected, gs, myHand, topCard, showToast, notify, executePlay]);

  const handleDraw = useCallback(() => {
    if (!isMyTurn || hasDrawn) return;
    tap('light');
    setSelected([]);
    let endedTurn = false;
    applyMove((draft) => {
      const res = applyDraw(draft, selfId);
      endedTurn = res.endedTurn;
      return res.state;
    });
    if (!endedTurn) setHasDrawn(true);
  }, [isMyTurn, hasDrawn, applyMove, selfId, tap]);

  const handlePass = useCallback(() => {
    if (!isMyTurn || !hasDrawn) return;
    tap('light');
    setSelected([]);
    setHasDrawn(false);
    applyMove((draft) => applyPass(draft));
  }, [isMyTurn, hasDrawn, applyMove, tap]);

  // ---- Render -------------------------------------------------------------
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

  if (!gs) {
    return (
      <FeltTable>
        <View style={styles.rotateWrap}>
          <Text style={styles.rotateText}>DEALING IN…</Text>
          <Text style={styles.rotateSub}>{connected ? 'Table connected' : 'Connecting to the table'}</Text>
        </View>
      </FeltTable>
    );
  }

  const opponents = gs.turnOrder.filter((pid) => !(isPlayer && pid === selfId));

  return (
    <FeltTable>
      <View
        style={[
          styles.safe,
          {
            paddingTop: insets.top,
            paddingLeft: 12 + insets.left,
            paddingRight: 12 + insets.right,
          },
        ]}
      >
        {/* ---- Top rail ---- */}
        <View style={styles.topRail}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
            <Text style={styles.backGlyph}>‹</Text>
          </Pressable>

          <View style={styles.seatRow}>
            {opponents.map((pid) => (
              <PlayerSeat
                key={pid}
                name={nameOf(pid)}
                cardCount={gs.hands[pid]?.length ?? 0}
                isTurn={activePlayerId === pid}
                inVoice={voice.connectedPeers.includes(pid)}
                isSpeaking={!!voice.speaking[pid]}
                compact={metrics.compactSeats}
              />
            ))}
          </View>

          <VoiceHUD
            supported={voice.supported}
            unavailableReason={voice.unavailableReason}
            joined={voice.joined}
            muted={voice.muted}
            deafened={voice.deafened}
            error={voice.error}
            selfSpeaking={!!voice.speaking[selfId]}
            peerCount={voice.connectedPeers.length}
            onJoin={voice.join}
            onLeave={voice.leave}
            onToggleMute={voice.toggleMute}
            onToggleDeafen={voice.toggleDeafen}
          />
        </View>

        {/* ---- Board ---- */}
        <View style={styles.board}>
          <DrawPile
            width={metrics.boardCard}
            count={gs.deck.length}
            penalty={gs.activePenalty}
            live={isMyTurn && !hasDrawn}
            onPress={handleDraw}
          />

          <View style={styles.centerColumn}>
            <TurnBanner
              isMyTurn={isMyTurn}
              label={
                gs.gameOver
                  ? 'HAND OVER'
                  : isMyTurn
                    ? 'YOUR TURN'
                    : `${nameOf(activePlayerId).toUpperCase()}'S TURN`
              }
            />
            <View style={styles.metaRow}>
              <Plaque>
                <Text style={styles.metaText}>
                  {gs.direction === 1 ? '↻ CLOCKWISE' : '↺ COUNTER'}
                </Text>
              </Plaque>
              <Plaque>
                <Text style={styles.metaText}>{gs.rules?.rulesForm ?? 'HOUSE RULES'}</Text>
              </Plaque>
              <Plaque tone={connected ? 'live' : 'warn'}>
                <Text style={styles.metaText}>{connected ? 'LIVE' : 'RECONNECTING'}</Text>
              </Plaque>
            </View>
          </View>

          <DiscardStack pile={gs.discardPile} width={metrics.boardCard} calledSuit={gs.calledSuit} />
        </View>

        {/* ---- Player rail ---- */}
        {isPlayer ? (
          <View style={styles.playerRail}>
            <View style={styles.railHeader}>
              <View style={styles.railIdentity}>
                {voice.joined && !voice.muted && (
                  <View style={[styles.liveDot, voice.speaking[selfId] && styles.liveDotOn]} />
                )}
                <Text style={styles.railName} numberOfLines={1}>
                  {(profile?.username || 'YOU').toUpperCase()}
                </Text>
                <Text style={styles.railCount}>{myHand.length} IN HAND</Text>
              </View>

              <View style={styles.railActions}>
                {isMyTurn && gs.activePenalty > 0 && (
                  <Plaque tone="warn">
                    <Text style={styles.penaltyText}>STACKED +{gs.activePenalty}</Text>
                  </Plaque>
                )}
                {selected.length > 0 && isMyTurn && (
                  <BrassButton
                    label={selected.length > 1 ? `PLAY ${selected.length}` : 'PLAY'}
                    tone="green"
                    compact
                    onPress={handlePlaySelection}
                  />
                )}
                {selected.length > 0 && (
                  <BrassButton label="CLEAR" tone="slate" compact onPress={() => setSelected([])} />
                )}
                {isMyTurn && hasDrawn && gs.activePenalty === 0 && selected.length === 0 && (
                  <BrassButton label="PASS" tone="gold" compact onPress={handlePass} />
                )}
                {isMyTurn && playable.length === 0 && !hasDrawn && (
                  <Plaque tone="warn">
                    <Text style={styles.penaltyText}>NOTHING PLAYS — DRAW</Text>
                  </Plaque>
                )}
              </View>
            </View>

            <CardFan
              cards={myHand}
              selectedIndices={selected}
              onCardPress={handleCardPress}
              cardWidth={metrics.handCard}
              availableWidth={width - 32}
              dimmed={!isMyTurn}
            />
          </View>
        ) : (
          <View style={styles.spectatorRail}>
            <Plaque tone="live">
              <Text style={styles.metaText}>SPECTATING · VOICE ENABLED</Text>
            </Plaque>
          </View>
        )}

        {/* ---- Toast ---- */}
        {toast && (
          <Animated.View entering={FadeInDown.duration(160)} style={styles.toast} pointerEvents="none">
            <Text style={styles.toastText}>{toast.message}</Text>
          </Animated.View>
        )}

        {/* ---- Suit picker ---- */}
        {suitPickerFor && (
          <Animated.View entering={FadeIn.duration(140)} style={styles.overlay}>
            <Animated.View entering={ZoomIn.springify().damping(16)} style={styles.modal}>
              <Text style={styles.modalTitle}>CALL THE SUIT</Text>
              <View style={styles.suitRow}>
                {SUIT_CHOICES.map((s) => (
                  <Pressable
                    key={s}
                    style={styles.suitBtn}
                    onPress={() => executePlay(suitPickerFor.indices, suitPickerFor.cards, s)}
                  >
                    <Text
                      style={[styles.suitGlyph, { color: isRedSuit(s) ? COLORS.suitRed : COLORS.suitBlack }]}
                    >
                      {suitGlyph(s)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable onPress={() => setSuitPickerFor(null)} hitSlop={8}>
                <Text style={styles.modalCancel}>CANCEL</Text>
              </Pressable>
            </Animated.View>
          </Animated.View>
        )}

        {/* ---- Game over ---- */}
        {gs.gameOver && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.overlay}>
            <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.modal}>
              <Text style={styles.winKicker}>THE HAND IS OVER</Text>
              <Text style={styles.winName}>{nameOf(gs.winState?.winner).toUpperCase()}</Text>
              <Text style={styles.winSub}>TAKES THE POT</Text>
              <BrassButton
                label="BACK TO THE FLOOR"
                tone="gold"
                onPress={() => navigation.replace('MainMenu')}
                style={{ marginTop: 18 }}
              />
            </Animated.View>
          </Animated.View>
        )}
      </View>
    </FeltTable>
  );
}

/* ---------------------------------------------------------------- */

function TurnBanner({ label, isMyTurn }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = isMyTurn
      ? withRepeat(
          withSequence(withTiming(1, { duration: 800 }), withTiming(0, { duration: 800 })),
          -1,
          false
        )
      : withTiming(0, { duration: 200 });
  }, [isMyTurn, pulse]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.035 }],
  }));

  return (
    <Animated.View style={style}>
      <Plaque tone={isMyTurn ? 'live' : 'neutral'} style={styles.turnPlaque}>
        <Text style={[styles.turnText, isMyTurn && styles.turnTextLive]} numberOfLines={1}>
          {label}
        </Text>
      </Plaque>
    </Animated.View>
  );
}

function DrawPile({ width, count, penalty, live, onPress }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = live
      ? withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 700 })), -1, false)
      : withTiming(0, { duration: 200 });
  }, [live, pulse]);

  const halo = useAnimatedStyle(() => ({ opacity: 0.2 + pulse.value * 0.6 }));

  // A few offset backs so the pile reads as a stack with depth.
  const depth = Math.min(3, Math.max(0, Math.ceil(count / 12)));

  return (
    <View style={styles.pileWrap}>
      <Pressable onPress={onPress} disabled={!live} style={!live && styles.pileIdle}>
        <View>
          {Array.from({ length: depth }).map((_, i) => (
            <View
              key={i}
              style={[styles.pileShadowCard, { top: -(i + 1) * 2, left: (i + 1) * 2 }]}
            >
              <PlayingCard isHidden width={width} />
            </View>
          ))}
          {live && (
            <Animated.View
              style={[
                styles.drawHalo,
                { width: width + 12, height: width * CARD_ASPECT + 12, borderRadius: width * 0.14 },
                penalty > 0 && styles.drawHaloDanger,
                halo,
              ]}
              pointerEvents="none"
            />
          )}
          <PlayingCard isHidden width={width} />
        </View>
      </Pressable>

      <Text style={styles.pileLabel}>{count} LEFT</Text>

      {penalty > 0 && (
        <Animated.View entering={ZoomIn.springify()} style={styles.penaltyBadge}>
          <Text style={styles.penaltyBadgeText}>+{penalty}</Text>
        </Animated.View>
      )}
    </View>
  );
}

function DiscardStack({ pile, width, calledSuit }) {
  // Only the last few cards are ever visible — rendering the whole pile was
  // pointless work that grew with the length of the game.
  const visible = pile.slice(-4);

  return (
    <View style={[styles.pileWrap, { width: width * 1.5 }]}>
      <View style={{ width, height: width * CARD_ASPECT }}>
        {visible.map((card, i) => {
          const isTop = i === visible.length - 1;
          const seed = (pile.length - visible.length + i) * 37;
          const angle = ((seed % 17) - 8) * 1.1;
          return (
            <Animated.View
              key={`${card.id}-${pile.length - visible.length + i}`}
              entering={isTop ? ZoomIn.springify().damping(15).mass(0.6) : undefined}
              style={[
                StyleSheet.absoluteFill,
                { transform: [{ rotate: `${angle}deg` }], zIndex: i },
              ]}
            >
              <PlayingCard suit={card.suit} value={card.value} width={width} />
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
  );
}

/* ---------------------------------------------------------------- */

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
  pileShadowCard: { position: 'absolute', opacity: 0.75 },
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
  penaltyBadgeText: {
    fontFamily: FONTS.ui,
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
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
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  liveDotOn: { backgroundColor: COLORS.success, ...glow(COLORS.success, 8, 1) },
  penaltyText: {
    fontFamily: FONTS.ui,
    color: COLORS.cream,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  spectatorRail: { alignItems: 'center', paddingVertical: 16 },

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
  modalCancel: {
    fontFamily: FONTS.ui,
    color: COLORS.creamDim,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '700',
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
