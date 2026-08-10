/**
 * WebRTC bindings for the browser (Vercel build). The platform ships all of
 * this natively, so there is nothing to install.
 */
const hasWindow = typeof window !== 'undefined';

export const isSupported = hasWindow && !!window.RTCPeerConnection && !!navigator?.mediaDevices;

export const RTCPeerConnection = hasWindow ? window.RTCPeerConnection : null;
export const RTCSessionDescription = hasWindow ? window.RTCSessionDescription : null;
export const RTCIceCandidate = hasWindow ? window.RTCIceCandidate : null;
export const mediaDevices = hasWindow ? navigator.mediaDevices : null;

export const unavailableReason = isSupported
  ? null
  : 'This browser does not support WebRTC audio.';

/**
 * Browsers need a real <audio> sink for a remote stream. RN has no equivalent
 * element, so we drop straight to the DOM here.
 */
export function attachRemoteAudio(peerId, stream) {
  if (!hasWindow) return null;
  let el = document.getElementById(`cardden-voice-${peerId}`);
  if (!el) {
    el = document.createElement('audio');
    el.id = `cardden-voice-${peerId}`;
    el.autoplay = true;
    el.playsInline = true;
    el.style.display = 'none';
    document.body.appendChild(el);
  }
  el.srcObject = stream;
  const p = el.play?.();
  if (p?.catch) p.catch(() => {}); // autoplay policy — resolved by the mic tap
  return el;
}

export function detachRemoteAudio(peerId) {
  if (!hasWindow) return;
  const el = document.getElementById(`cardden-voice-${peerId}`);
  if (el) {
    el.srcObject = null;
    el.remove();
  }
}

/**
 * Voice-activity meter, so we can light up who is talking. Returns a function
 * that reads current loudness (0..1), plus a disposer.
 */
export function createLevelMeter(stream) {
  if (!hasWindow) return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  try {
    const ctx = new Ctx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);

    return {
      read() {
        analyser.getByteFrequencyData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i];
        return sum / buf.length / 255;
      },
      dispose() {
        try {
          source.disconnect();
          ctx.close();
        } catch {
          /* already torn down */
        }
      },
    };
  } catch {
    return null;
  }
}
