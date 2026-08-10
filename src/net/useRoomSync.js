import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabase';

/**
 * Low-latency room synchronisation.
 *
 * The old path for a single card play was:
 *     player → broadcast → host device → Postgres UPDATE → WAL → replication
 *     → postgres_changes → every client
 * which is two device hops plus a full database round trip. That is why moves
 * took most of a second to show up on the other screen.
 *
 * The new path is:
 *     player applies locally (0 ms) → one broadcast hop → peers apply
 *
 * The database is no longer in the critical path at all. The host still
 * persists state, but debounced and fire-and-forget, purely so a refresh or a
 * late joiner can recover. Correctness is protected by a monotonic `version`
 * on the state: any message that isn't strictly newer than what we already
 * have is dropped, so a slow database echo can never roll the game backwards.
 */

const PERSIST_DEBOUNCE_MS = 400;

/** Newer-wins, with a stable tiebreak so all clients converge on the same state. */
function isNewer(incoming, current) {
  if (!incoming) return false;
  if (!current) return true;
  const a = incoming.version ?? 0;
  const b = current.version ?? 0;
  if (a !== b) return a > b;
  return String(incoming.origin ?? '') > String(current.origin ?? '');
}

export function useRoomSync({ roomId, isHost, selfId }) {
  const [gameState, setGameState] = useState(null);
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [connected, setConnected] = useState(false);
  const [peers, setPeers] = useState([]);
  // Bumped whenever a new channel object is created, so consumers that attach
  // their own listeners (voice chat) know to rebind.
  const [channelEpoch, setChannelEpoch] = useState(0);

  // Mirrors of state that the channel callbacks need without re-subscribing.
  const stateRef = useRef(null);
  const channelRef = useRef(null);
  const persistTimer = useRef(null);
  const pendingPersist = useRef(null);
  const isHostRef = useRef(isHost);
  isHostRef.current = isHost;

  const commitLocal = useCallback((next) => {
    stateRef.current = next;
    setGameState(next);
  }, []);

  /** Host-only, debounced, off the critical path. */
  const schedulePersist = useCallback(
    (state) => {
      if (!isHostRef.current) return;
      pendingPersist.current = state;
      if (persistTimer.current) return;
      persistTimer.current = setTimeout(async () => {
        persistTimer.current = null;
        const toWrite = pendingPersist.current;
        pendingPersist.current = null;
        if (!toWrite) return;
        const { error } = await supabase
          .from('rooms')
          .update({ game_state: toWrite })
          .eq('id', roomId);
        if (error) console.warn('[roomSync] persist failed:', error.message);
      }, PERSIST_DEBOUNCE_MS);
    },
    [roomId]
  );

  /** Adopt remote state if it is strictly newer than ours. */
  const adopt = useCallback(
    (incoming) => {
      if (!isNewer(incoming, stateRef.current)) return false;
      commitLocal(incoming);
      schedulePersist(incoming);
      return true;
    },
    [commitLocal, schedulePersist]
  );

  const fetchParticipants = useCallback(async () => {
    const { data } = await supabase
      .from('room_participants')
      .select('*, profiles(username)')
      .eq('room_id', roomId);
    if (data) setParticipants(data);
  }, [roomId]);

  useEffect(() => {
    let cancelled = false;

    // Single multiplexed channel: game state, presence and voice signalling all
    // ride the same socket, so there is one connection to keep warm.
    const channel = supabase.channel(`room:${roomId}`, {
      config: {
        // ack:false — do not wait for the server to confirm before returning.
        // presence key lets peers identify each other for the seat list.
        broadcast: { self: false, ack: false },
        presence: { key: selfId },
      },
    });
    channelRef.current = channel;
    setChannelEpoch((n) => n + 1);

    channel
      .on('broadcast', { event: 'state' }, ({ payload }) => {
        if (!cancelled) adopt(payload?.state);
      })
      // A client that just (re)joined asks whoever is live for the truth.
      .on('broadcast', { event: 'resync_request' }, () => {
        if (cancelled || !stateRef.current) return;
        channel.send({
          type: 'broadcast',
          event: 'state',
          payload: { state: stateRef.current },
        });
      })
      .on('presence', { event: 'sync' }, () => {
        if (cancelled) return;
        setPeers(Object.keys(channel.presenceState() || {}));
      })
      .subscribe(async (status) => {
        if (cancelled) return;
        setConnected(status === 'SUBSCRIBED');
        if (status !== 'SUBSCRIBED') return;
        await channel.track({ id: selfId, at: Date.now() });
        // Ask for live state immediately; the DB read below is only a fallback.
        channel.send({ type: 'broadcast', event: 'resync_request', payload: {} });
      });

    // Slow lane: initial hydrate + a safety net for anyone who missed a
    // broadcast entirely (backgrounded app, dropped socket).
    (async () => {
      const { data } = await supabase.from('rooms').select('*').eq('id', roomId).single();
      if (cancelled || !data) return;
      setRoom(data);
      adopt(data.game_state);
    })();

    fetchParticipants();

    const dbChannel = supabase
      .channel(`room_db:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          if (cancelled) return;
          setRoom(payload.new);
          adopt(payload.new?.game_state); // no-op unless we genuinely fell behind
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` },
        () => {
          if (!cancelled) fetchParticipants();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (persistTimer.current) clearTimeout(persistTimer.current);
      supabase.removeChannel(channel);
      supabase.removeChannel(dbChannel);
      channelRef.current = null;
    };
  }, [roomId, selfId, adopt, fetchParticipants]);

  /**
   * Apply a move. `mutate` receives a draft of the current state and returns
   * the next one. The local UI updates synchronously; peers are notified in a
   * single hop; the database catches up whenever it gets around to it.
   */
  const applyMove = useCallback(
    (mutate) => {
      const current = stateRef.current;
      if (!current) return null;

      const draft = structuredCloneSafe(current);
      const next = mutate(draft) ?? draft;
      next.version = (current.version ?? 0) + 1;
      next.origin = selfId;

      commitLocal(next); // instant, before any network work happens
      channelRef.current?.send({
        type: 'broadcast',
        event: 'state',
        payload: { state: next },
      });
      schedulePersist(next);
      return next;
    },
    [selfId, commitLocal, schedulePersist]
  );

  /** Force-publish a state (used when the host seeds a fresh game). */
  const publishState = useCallback(
    (state) => {
      const next = { ...state, version: (state.version ?? 0) + 1, origin: selfId };
      commitLocal(next);
      channelRef.current?.send({ type: 'broadcast', event: 'state', payload: { state: next } });
      schedulePersist(next);
      return next;
    },
    [selfId, commitLocal, schedulePersist]
  );

  return {
    gameState,
    room,
    participants,
    connected,
    peers,
    applyMove,
    publishState,
    channel: channelRef,
    channelEpoch,
  };
}

/** structuredClone where available (much faster than JSON round-tripping). */
function structuredCloneSafe(value) {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      /* fall through */
    }
  }
  return JSON.parse(JSON.stringify(value));
}
