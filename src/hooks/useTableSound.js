import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

/**
 * Table ambience + one-shot stingers, on expo-audio (expo-av is legacy in
 * SDK 57). Players are created once and re-triggered by seeking to zero, which
 * avoids the old code's habit of allocating a fresh Sound object per effect.
 */
export function useTableSound({ ambience = true } = {}) {
  const bg = useAudioPlayer(require('../../assets/bg.wav'));
  const check = useAudioPlayer(require('../../assets/check.wav'));
  const win = useAudioPlayer(require('../../assets/win.wav'));
  const ready = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          // Voice chat needs the mic, and game audio must duck rather than
          // seize the session.
          allowsRecording: true,
          interruptionMode: 'mixWithOthers',
          shouldPlayInBackground: false,
        });
      } catch {
        /* audio session is best-effort */
      }
      if (cancelled) return;
      ready.current = true;
      if (ambience) {
        try {
          bg.loop = true;
          bg.volume = 0.18;
          bg.play();
        } catch {
          /* ignore */
        }
      }
    })();
    return () => {
      cancelled = true;
      try {
        bg.pause();
      } catch {
        /* ignore */
      }
    };
  }, [ambience, bg]);

  const fire = useCallback((player, volume = 0.8) => {
    try {
      player.volume = volume;
      player.seekTo(0);
      player.play();
    } catch {
      /* ignore */
    }
  }, []);

  const tap = useCallback((style = 'light') => {
    if (Platform.OS === 'web') return;
    const map = {
      light: Haptics.ImpactFeedbackStyle.Light,
      medium: Haptics.ImpactFeedbackStyle.Medium,
      heavy: Haptics.ImpactFeedbackStyle.Heavy,
    };
    Haptics.impactAsync(map[style] ?? map.light).catch(() => {});
  }, []);

  const notify = useCallback((type = 'success') => {
    if (Platform.OS === 'web') return;
    const map = {
      success: Haptics.NotificationFeedbackType.Success,
      warning: Haptics.NotificationFeedbackType.Warning,
      error: Haptics.NotificationFeedbackType.Error,
    };
    Haptics.notificationAsync(map[type] ?? map.success).catch(() => {});
  }, []);

  return {
    playCheck: useCallback(() => {
      fire(check, 0.85);
      notify('warning');
    }, [fire, check, notify]),
    playWin: useCallback(() => {
      fire(win, 1);
      notify('success');
    }, [fire, win, notify]),
    tap,
    notify,
  };
}
