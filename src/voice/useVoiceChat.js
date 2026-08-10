import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  attachRemoteAudio,
  createLevelMeter,
  detachRemoteAudio,
  isSupported,
  mediaDevices,
  unavailableReason,
} from './rtc';

/**
 * Always-on mesh voice chat, Call-of-Duty style: once you join, everyone in the
 * room hears you live until you mute. Audio never touches our server — it is
 * peer-to-peer WebRTC. The Supabase realtime channel the game already holds
 * open is reused as the signalling path, so voice costs no extra connection.
 *
 * Mesh (rather than an SFU) is the right call at this table size: with up to 7
 * seats each client holds at most 6 peer connections of ~30 kbps Opus.
 *
 * Muting disables the outgoing track rather than tearing the mesh down, so a
 * muted player still hears everyone and unmuting is instant.
 */

const ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  // A TURN relay is needed for players behind symmetric NAT / strict mobile
  // carriers. Drop credentials in .env and they get picked up automatically.
  ...(process.env.EXPO_PUBLIC_TURN_URL
    ? [
        {
          urls: process.env.EXPO_PUBLIC_TURN_URL,
          username: process.env.EXPO_PUBLIC_TURN_USERNAME,
          credential: process.env.EXPO_PUBLIC_TURN_CREDENTIAL,
        },
      ]
    : []),
];

const AUDIO_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
  },
  video: false,
};

const SPEAKING_THRESHOLD = 0.045;
const METER_HZ = 12;

export function useVoiceChat({ channelRef, selfId, channelEpoch = 0 }) {
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [error, setError] = useState(null);
  const [speaking, setSpeaking] = useState({});
  const [connectedPeers, setConnectedPeers] = useState([]);

  const localStream = useRef(null);
  const peers = useRef(new Map()); // peerId -> { pc, pendingIce[], meter, stream }
  const meters = useRef(new Map()); // peerId | 'self' -> meter
  const joinedRef = useRef(false);
  const mutedRef = useRef(false);
  const deafenedRef = useRef(false);

  const send = useCallback(
    (event, payload) => {
      channelRef?.current?.send({ type: 'broadcast', event, payload });
    },
    [channelRef]
  );

  const refreshPeerList = useCallback(() => {
    setConnectedPeers(Array.from(peers.current.keys()));
  }, []);

  const teardownPeer = useCallback(
    (peerId) => {
      const entry = peers.current.get(peerId);
      if (!entry) return;
      try {
        entry.pc.close();
      } catch {
        /* already closed */
      }
      meters.current.get(peerId)?.dispose?.();
      meters.current.delete(peerId);
      detachRemoteAudio(peerId);
      peers.current.delete(peerId);
      refreshPeerList();
      setSpeaking((s) => {
        const next = { ...s };
        delete next[peerId];
        return next;
      });
    },
    [refreshPeerList]
  );

  /** Build (or fetch) the peer connection for `peerId`. */
  const ensurePeer = useCallback(
    (peerId) => {
      const existing = peers.current.get(peerId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const entry = { pc, pendingIce: [], stream: null };
      peers.current.set(peerId, entry);

      if (localStream.current) {
        localStream.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStream.current);
        });
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          send('voice_ice', { from: selfId, to: peerId, candidate: e.candidate.toJSON?.() ?? e.candidate });
        }
      };

      pc.ontrack = (e) => {
        const stream = e.streams?.[0];
        if (!stream) return;
        entry.stream = stream;
        if (!deafenedRef.current) attachRemoteAudio(peerId, stream);
        const meter = createLevelMeter(stream);
        if (meter) meters.current.set(peerId, meter);
      };

      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        if (st === 'failed' || st === 'closed') teardownPeer(peerId);
      };

      refreshPeerList();
      return entry;
    },
    [selfId, send, teardownPeer, refreshPeerList]
  );

  /** Deterministic glare avoidance: the lower id always makes the offer. */
  const shouldOffer = useCallback((peerId) => String(selfId) < String(peerId), [selfId]);

  const makeOffer = useCallback(
    async (peerId) => {
      const { pc } = ensurePeer(peerId);
      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: true });
        await pc.setLocalDescription(offer);
        send('voice_offer', { from: selfId, to: peerId, sdp: pc.localDescription });
      } catch (e) {
        console.warn('[voice] offer failed', e?.message);
      }
    },
    [ensurePeer, selfId, send]
  );

  // ---- Signalling ---------------------------------------------------------
  useEffect(() => {
    const channel = channelRef?.current;
    if (!channel) return undefined;

    const onJoin = ({ payload }) => {
      const from = payload?.from;
      if (!from || from === selfId || !joinedRef.current) return;
      // Tell the newcomer we are already here, then connect.
      send('voice_here', { from: selfId, to: from });
      ensurePeer(from);
      if (shouldOffer(from)) makeOffer(from);
    };

    const onHere = ({ payload }) => {
      const { from, to } = payload || {};
      if (!from || from === selfId || to !== selfId || !joinedRef.current) return;
      ensurePeer(from);
      if (shouldOffer(from)) makeOffer(from);
    };

    const onOffer = async ({ payload }) => {
      const { from, to, sdp } = payload || {};
      if (to !== selfId || !joinedRef.current) return;
      const entry = ensurePeer(from);
      try {
        await entry.pc.setRemoteDescription(new RTCSessionDescription(sdp));
        for (const c of entry.pendingIce.splice(0)) {
          await entry.pc.addIceCandidate(new RTCIceCandidate(c));
        }
        const answer = await entry.pc.createAnswer();
        await entry.pc.setLocalDescription(answer);
        send('voice_answer', { from: selfId, to: from, sdp: entry.pc.localDescription });
      } catch (e) {
        console.warn('[voice] answer failed', e?.message);
      }
    };

    const onAnswer = async ({ payload }) => {
      const { from, to, sdp } = payload || {};
      if (to !== selfId || !joinedRef.current) return;
      const entry = peers.current.get(from);
      if (!entry) return;
      try {
        await entry.pc.setRemoteDescription(new RTCSessionDescription(sdp));
        for (const c of entry.pendingIce.splice(0)) {
          await entry.pc.addIceCandidate(new RTCIceCandidate(c));
        }
      } catch (e) {
        console.warn('[voice] set answer failed', e?.message);
      }
    };

    const onIce = async ({ payload }) => {
      const { from, to, candidate } = payload || {};
      if (to !== selfId || !candidate) return;
      const entry = peers.current.get(from);
      if (!entry) return;
      // Candidates can beat the SDP; hold them until there is somewhere to put them.
      if (!entry.pc.remoteDescription) {
        entry.pendingIce.push(candidate);
        return;
      }
      try {
        await entry.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('[voice] ice failed', e?.message);
      }
    };

    const onLeave = ({ payload }) => teardownPeer(payload?.from);

    channel
      .on('broadcast', { event: 'voice_join' }, onJoin)
      .on('broadcast', { event: 'voice_here' }, onHere)
      .on('broadcast', { event: 'voice_offer' }, onOffer)
      .on('broadcast', { event: 'voice_answer' }, onAnswer)
      .on('broadcast', { event: 'voice_ice' }, onIce)
      .on('broadcast', { event: 'voice_leave' }, onLeave);

    return undefined; // handlers die with the channel in useRoomSync
    // `channelEpoch` changes when useRoomSync builds a fresh channel, which is
    // our cue to bind onto the new one.
  }, [channelRef, channelEpoch, selfId, ensurePeer, makeOffer, shouldOffer, send, teardownPeer]);

  // ---- Level metering -----------------------------------------------------
  useEffect(() => {
    if (!joined) return undefined;
    const id = setInterval(() => {
      const next = {};
      meters.current.forEach((meter, key) => {
        next[key] = (meter.read?.() ?? 0) > SPEAKING_THRESHOLD;
      });
      // Only re-render when someone actually starts or stops talking.
      setSpeaking((prev) => {
        const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
        for (const k of keys) {
          if (!!prev[k] !== !!next[k]) return next;
        }
        return prev;
      });
    }, 1000 / METER_HZ);
    return () => clearInterval(id);
  }, [joined]);

  // ---- Public controls ----------------------------------------------------
  const join = useCallback(async () => {
    if (joinedRef.current) return;
    if (!isSupported) {
      setError(unavailableReason);
      return;
    }
    try {
      const stream = await mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
      localStream.current = stream;
      joinedRef.current = true;
      setJoined(true);
      setError(null);

      const meter = createLevelMeter(stream);
      if (meter) meters.current.set(selfId, meter);

      send('voice_join', { from: selfId });
    } catch (e) {
      setError(
        e?.name === 'NotAllowedError'
          ? 'Microphone permission denied.'
          : e?.message || 'Could not open the microphone.'
      );
    }
  }, [selfId, send]);

  const leave = useCallback(() => {
    if (!joinedRef.current) return;
    send('voice_leave', { from: selfId });
    peers.current.forEach((_, peerId) => teardownPeer(peerId));
    localStream.current?.getTracks?.().forEach((t) => t.stop());
    localStream.current = null;
    meters.current.get(selfId)?.dispose?.();
    meters.current.clear();
    joinedRef.current = false;
    setJoined(false);
    setSpeaking({});
  }, [selfId, send, teardownPeer]);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    localStream.current?.getAudioTracks?.().forEach((t) => {
      t.enabled = !next;
    });
    setMuted(next);
  }, []);

  const toggleDeafen = useCallback(() => {
    const next = !deafenedRef.current;
    deafenedRef.current = next;
    peers.current.forEach((entry, peerId) => {
      if (next) detachRemoteAudio(peerId);
      else if (entry.stream) attachRemoteAudio(peerId, entry.stream);
    });
    setDeafened(next);
  }, []);

  // Clean up if the screen unmounts while still in voice.
  useEffect(() => () => {
    if (joinedRef.current) {
      peers.current.forEach((_, peerId) => teardownPeer(peerId));
      localStream.current?.getTracks?.().forEach((t) => t.stop());
    }
  }, [teardownPeer]);

  return {
    supported: isSupported,
    unavailableReason,
    joined,
    muted,
    deafened,
    error,
    speaking,
    connectedPeers,
    join,
    leave,
    toggleMute,
    toggleDeafen,
  };
}
