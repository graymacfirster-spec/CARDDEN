/**
 * WebRTC bindings for iOS/Android.
 *
 * `react-native-webrtc` is a native module, so it only exists once you move to
 * a custom dev build / EAS build (it cannot run inside Expo Go). We resolve it
 * lazily and degrade to a clear "unavailable" state rather than crashing the
 * app, so the same code runs in Expo Go today and lights up voice the moment
 * you produce a standalone build:
 *
 *     npx expo install react-native-webrtc
 *     npx expo prebuild && eas build --profile development
 */
let mod = null;
let loadError = null;

try {
  // eslint-disable-next-line global-require
  mod = require('react-native-webrtc');
} catch (e) {
  loadError = e;
}

export const isSupported = !!mod?.RTCPeerConnection;

export const RTCPeerConnection = mod?.RTCPeerConnection ?? null;
export const RTCSessionDescription = mod?.RTCSessionDescription ?? null;
export const RTCIceCandidate = mod?.RTCIceCandidate ?? null;
export const mediaDevices = mod?.mediaDevices ?? null;

export const unavailableReason = isSupported
  ? null
  : 'Live voice needs a standalone build. Run `npx expo install react-native-webrtc` and build a dev client — it cannot run in Expo Go.';

/**
 * On native, remote audio tracks are routed to the output device by the
 * WebRTC audio session automatically; there is no element to attach.
 */
export function attachRemoteAudio() {
  return null;
}

export function detachRemoteAudio() {}

/** No Web Audio API on native — speaking indicators fall back to transport state. */
export function createLevelMeter() {
  return null;
}

export { loadError };
