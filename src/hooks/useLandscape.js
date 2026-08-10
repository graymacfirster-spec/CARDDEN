import { useEffect } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

/**
 * Pins the table to landscape. The whole game is designed wide — the fan, the
 * seats and the board all assume a horizontal table.
 *
 * On native this hard-locks the device. On web, browsers only allow an
 * orientation lock while fullscreen, so we attempt it and fall back to
 * reporting `needsRotate` so the screen can ask the player to turn the phone.
 */
export function useLandscape() {
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    let mounted = true;
    let ScreenOrientation;
    (async () => {
      try {
        ScreenOrientation = require('expo-screen-orientation');
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } catch {
        /* web without fullscreen, or module unavailable — handled by needsRotate */
      }
    })();
    return () => {
      mounted = false;
      if (Platform.OS === 'web') return;
      try {
        ScreenOrientation?.unlockAsync?.();
      } catch {
        /* ignore */
      }
      void mounted;
    };
  }, []);

  return {
    width,
    height,
    isLandscape: width >= height,
    // Only nag on small screens; a portrait tablet or desktop window is fine.
    needsRotate: width < height && Math.min(width, height) < 500,
  };
}
