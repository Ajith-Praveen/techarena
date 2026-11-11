import Ionicons from '@expo/vector-icons/Ionicons';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Modal, Platform, StyleSheet, Vibration, View } from 'react-native';

import { api } from '@/api/client';
import type { TurnResponse } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { storage } from '@/auth/storage';
import { AppText, Button } from '@/components';
import { Burst } from '@/components/comic/Burst';
import { HudBackground } from '@/components/hud/HudBackground';
import { colors, fonts, hardShadow, ink, palette, spacing } from '@/theme';

const POLL_MS = 10_000;
/** Stop ringing after this long if nobody taps the alert. */
const RING_MS = 30_000;
const SEEN_KEY = 'techarena.turnAlert';

type AlertStage = 'next' | 'after-next';

const SOUNDS: Record<AlertStage, number> = {
  next: require('../../../assets/sounds/next.wav'),
  'after-next': require('../../../assets/sounds/after-next.wav'),
};

// "You're next": long buzzes. "After next": shorter double taps.
const VIBRATE: Record<AlertStage, number[]> = {
  next: [0, 700, 300, 700, 300, 700, 1200],
  'after-next': [0, 250, 150, 250, 1500],
};

const COPY: Record<AlertStage, { title: string; body: string; color: string; icon: 'megaphone' | 'hourglass' }> = {
  next: {
    title: "YOU'RE NEXT!",
    body: 'The judges are with the team just before you. Get to your stall, poster and project ready!',
    color: palette.red,
    icon: 'megaphone',
  },
  'after-next': {
    title: 'ALMOST UP!',
    body: 'Two teams to go. Start getting your team and your demo together.',
    color: palette.yellow,
    icon: 'hourglass',
  },
};

/**
 * Rings and vibrates a team's phones when the judges are one team away ("You're next!") and two
 * teams away ("Almost up!"), with a different comic ringtone for each. Polls while the app is open.
 */
export function TurnAlerts() {
  const { role } = useAuth();
  const isTeam = role === 'lead' || role === 'member';
  const [alert, setAlert] = useState<{ stage: AlertStage; turn: TurnResponse } | null>(null);
  const players = useRef<Partial<Record<AlertStage, AudioPlayer>>>({});
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playerFor = useCallback((stage: AlertStage) => {
    if (!players.current[stage]) {
      const p = createAudioPlayer(SOUNDS[stage]);
      p.loop = true;
      players.current[stage] = p;
    }
    return players.current[stage]!;
  }, []);

  const stop = useCallback(() => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = null;
    Vibration.cancel();
    for (const p of Object.values(players.current)) {
      try {
        p?.pause();
        void p?.seekTo(0);
      } catch {
        // Player already released.
      }
    }
  }, []);

  const ring = useCallback(
    (stage: AlertStage) => {
      stop();
      try {
        const p = playerFor(stage);
        p.volume = 1;
        void p.seekTo(0);
        p.play();
      } catch {
        // No audio (e.g. blocked by the browser): the alert and vibration still show.
      }
      Vibration.vibrate(VIBRATE[stage], Platform.OS === 'android');
      stopTimer.current = setTimeout(stop, RING_MS);
    },
    [playerFor, stop],
  );

  // Ring even when the phone is on silent (iOS), and keep it short of grabbing other audio.
  useEffect(() => {
    if (!isTeam) return;
    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
    // Browsers only allow sound after the user has touched the page once: prime both players then.
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const unlock = () => {
        for (const stage of ['next', 'after-next'] as AlertStage[]) {
          try {
            const p = playerFor(stage);
            p.volume = 0;
            p.play();
            setTimeout(() => {
              p.pause();
              void p.seekTo(0);
              p.volume = 1;
            }, 60);
          } catch {
            // ignore
          }
        }
        document.removeEventListener('pointerdown', unlock);
      };
      document.addEventListener('pointerdown', unlock);
      return () => document.removeEventListener('pointerdown', unlock);
    }
    return undefined;
  }, [isTeam, playerFor]);

  useEffect(() => {
    if (!isTeam) return;
    let cancelled = false;
    const check = async () => {
      try {
        const turn = await api.turn();
        if (cancelled || !turn.key || (turn.stage !== 'next' && turn.stage !== 'after-next')) return;
        const seen = await storage.get(SEEN_KEY);
        if (seen === turn.key) return;
        await storage.set(SEEN_KEY, turn.key);
        setAlert({ stage: turn.stage, turn });
        ring(turn.stage);
      } catch {
        // Offline: try again on the next tick.
      }
    };
    void check();
    const id = setInterval(() => {
      if (AppState.currentState === 'active') void check();
    }, POLL_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void check();
    });
    return () => {
      cancelled = true;
      clearInterval(id);
      sub.remove();
    };
  }, [isTeam, ring]);

  useEffect(
    () => () => {
      stop();
      for (const p of Object.values(players.current)) p?.remove();
      players.current = {};
    },
    [stop],
  );

  if (!alert) return null;
  return (
    <TurnAlertSheet
      stage={alert.stage}
      turn={alert.turn}
      onClose={() => {
        stop();
        setAlert(null);
      }}
      onQueue={() => {
        stop();
        setAlert(null);
        router.push('/team/queue');
      }}
    />
  );
}

function TurnAlertSheet({ stage, turn, onClose, onQueue }: { stage: AlertStage; turn: TurnResponse; onClose: () => void; onQueue: () => void }) {
  const c = COPY[stage];
  const shake = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 90, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(shake, { toValue: -1, duration: 180, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(shake, { toValue: 0, duration: 90, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' }),
        Animated.delay(500),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shake]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <HudBackground />
        <View style={styles.center}>
          <Animated.View style={{ transform: [{ rotate: shake.interpolate({ inputRange: [-1, 1], outputRange: ['-10deg', '10deg'] }) }] }}>
            <Burst size={210} color={c.color} points={16}>
              <Ionicons name={c.icon} size={74} color={stage === 'next' ? palette.white : palette.ink} />
            </Burst>
          </Animated.View>
          <AppText style={[styles.title, { color: stage === 'next' ? palette.red : palette.ink }]}>{c.title}</AppText>
          {turn.myPosition ? (
            <View style={[styles.slot, hardShadow(3)]}>
              <AppText style={styles.slotText}>{`You present #${turn.myPosition}`}</AppText>
            </View>
          ) : null}
          <AppText color="textSecondary" align="center" style={styles.body}>
            {c.body}
          </AppText>
          {turn.judgesAt ? (
            <AppText variant="footnote" color="muted" align="center">
              {`Judges are now at #${turn.judgesAt.position} · ${turn.judgesAt.teamName}`}
            </AppText>
          ) : null}
          <View style={styles.actions}>
            <Button title="On my way!" icon="checkmark" size="lg" onPress={onClose} />
            <Button title="See the queue" variant="secondary" onPress={onQueue} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  title: { fontFamily: fonts.display, fontSize: 56, lineHeight: 60, letterSpacing: 2, textAlign: 'center' },
  slot: { backgroundColor: palette.white, borderWidth: ink.thick, borderColor: colors.border, paddingHorizontal: spacing.lg, paddingVertical: 4, transform: [{ rotate: '-2deg' }] },
  slotText: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, color: palette.ink },
  body: { maxWidth: 420, fontSize: 17, lineHeight: 24 },
  actions: { alignSelf: 'stretch', maxWidth: 420, width: '100%', gap: spacing.md, marginTop: spacing.md },
});
