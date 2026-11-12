import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import type { PublicTeam } from '@/api/types';
import { AppText, Avatar, TeamImage } from '@/components';
import { Burst } from '@/components/comic/Burst';
import { Confetti } from '@/features/shared/results/Confetti';
import { publicMembers } from '@/features/team/people';
import { formatAverage } from '@/lib/format';
import { teamColorOf, textOn } from '@/lib/teamColor';
import { fonts, palette } from '@/theme';

import type { Cue, Slot } from './trackStore';

export interface ShowEntry {
  rank: number;
  team: PublicTeam;
  average: number | null;
}

export interface BigRevealProps {
  /** Top 3, any order. */
  entries: ShowEntry[];
  /** Object URLs of the organiser's local audio files. */
  tracks: Partial<Record<Slot, string>>;
  cues: Record<Slot, Cue>;
  eventName: string;
  maxPerJudge: number | null;
  /** Called once, the moment 1st place is revealed (used to publish to everyone's phones). */
  onChampion?: () => void;
  /** Small operator line in the corner (e.g. publish status). */
  status?: string | null;
  onExit: () => void;
}

type Stage = { kind: 'ready' } | { kind: 'countdown' } | { kind: 'top3' } | { kind: 'place'; idx: number } | { kind: 'finale' };
interface Tick {
  /** Countdown number (10..0), null before the countdown starts. */
  n: number | null;
  revealed: boolean;
  /** Beats since the hit (negative before it). */
  beat: number;
}

const SLOT_OF: Record<number, Slot> = { 1: 'first', 2: 'second', 3: 'third' };
const PLACE_WORD: Record<number, string> = { 1: '1ST', 2: '2ND', 3: '3RD' };
const MEDAL: Record<number, string> = { 1: palette.yellow, 2: '#D9DEE6', 3: '#E39A5B' };
const NUM_COLORS = [palette.red, palette.blue, palette.yellow, palette.green, palette.pink, palette.orange, palette.purple, palette.cyan];

function fadeOut(a: HTMLAudioElement, ms = 1400) {
  const v0 = a.volume || 1;
  const t0 = performance.now();
  const id = setInterval(() => {
    const p = (performance.now() - t0) / ms;
    if (p >= 1 || a.paused) {
      clearInterval(id);
      a.pause();
      a.volume = 1;
    } else {
      a.volume = Math.max(0, v0 * (1 - p));
    }
  }, 40);
  return id;
}

/** Full-screen, music-synced podium reveal for the projector. Everything is driven by the audio clock. */
export function BigReveal({ entries, tracks, cues, eventName, maxPerJudge, onChampion, status, onExit }: BigRevealProps) {
  const { width, height } = useWindowDimensions();
  const k = Math.max(0.5, Math.min(width / 1280, height / 720));
  // Places revealed in this order: 3rd, 2nd, 1st (whichever exist).
  const places = useMemo(() => [...entries].filter((e) => e.rank >= 1 && e.rank <= 3).sort((a, b) => b.rank - a.rank), [entries]);

  const [stage, setStage] = useState<Stage>({ kind: 'ready' });
  const [tick, setTick] = useState<Tick>({ n: null, revealed: false, beat: -999 });
  const [confetti, setConfetti] = useState(0);
  const stageRef = useRef(stage);
  stageRef.current = stage;

  // ---- Audio -------------------------------------------------------------------------------
  const audios = useRef<Partial<Record<Slot, HTMLAudioElement>>>({});
  const fades = useRef(new Map<HTMLAudioElement, ReturnType<typeof setInterval>>());
  const clock = useRef<{ slot: Slot; audio: HTMLAudioElement | null; t0: number; ended: boolean } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const championFired = useRef(false);

  useEffect(() => {
    const made: Partial<Record<Slot, HTMLAudioElement>> = {};
    for (const [slot, url] of Object.entries(tracks) as [Slot, string][]) {
      const a = new Audio(url);
      a.preload = 'auto';
      made[slot] = a;
    }
    audios.current = made;
    const fadeMap = fades.current;
    return () => {
      fadeMap.forEach(clearInterval);
      Object.values(made).forEach((a) => a?.pause());
      timers.current.forEach(clearTimeout);
    };
  }, [tracks]);

  const startSlot = (slot: Slot) => {
    const prev = clock.current?.audio;
    const a = audios.current[slot] ?? null;
    if (prev && prev !== a) fades.current.set(prev, fadeOut(prev));
    const cue = cues[slot];
    const c = { slot, audio: a, t0: performance.now(), ended: false };
    clock.current = c;
    if (!a) return;
    const f = fades.current.get(a);
    if (f) clearInterval(f);
    a.pause();
    a.volume = 1;
    a.currentTime = cue.start;
    a.onended = () => {
      if (clock.current === c) c.ended = true;
    };
    a.play().catch(() => {
      // Could not play (blocked or bad file): keep going on a silent clock.
      if (clock.current === c) {
        c.audio = null;
        c.t0 = performance.now();
      }
    });
  };

  const now = (): number => {
    const c = clock.current;
    if (!c) return 0;
    if (c.ended) return Infinity;
    if (c.audio) return c.audio.currentTime;
    return cues[c.slot].start + (performance.now() - c.t0) / 1000;
  };

  // ---- Frame loop: derive what to show from the music position --------------------------------
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const s = stageRef.current;
      const c = clock.current;
      if (c && (s.kind === 'countdown' || s.kind === 'top3' || s.kind === 'place')) {
        const cue = cues[c.slot];
        const t = now();
        let next: Tick;
        if (c.slot === 'countdown') {
          const left = cue.hit - t;
          next = {
            n: left <= 0 ? 0 : left > 10 ? null : Math.min(10, Math.ceil(left)),
            revealed: left <= 0,
            beat: left > 10 && Number.isFinite(t) ? Math.floor(t) : 0,
          };
        } else {
          const beatLen = 60 / Math.max(30, cue.bpm || 120);
          const beat = Number.isFinite(t) ? Math.floor((t - cue.hit) / beatLen) : 999;
          next = { n: null, revealed: t >= cue.hit, beat: Math.max(-999, Math.min(999, beat)) };
        }
        setTick((p) => (p.n === next.n && p.revealed === next.revealed && p.beat === next.beat ? p : next));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cues]);

  const goPlace = (idx: number) => {
    const e = places[idx];
    if (!e) {
      setStage({ kind: 'finale' });
      return;
    }
    setTick({ n: null, revealed: false, beat: -999 });
    startSlot(SLOT_OF[e.rank]!);
    setStage({ kind: 'place', idx });
  };

  // Countdown hits 0: "TOP 3!" splash, then on to the first place.
  useEffect(() => {
    if (stage.kind !== 'countdown' || tick.n !== 0) return;
    setConfetti((x) => x + 1);
    timers.current.push(setTimeout(() => setStage({ kind: 'top3' }), 1300));
    timers.current.push(
      setTimeout(() => {
        if (stageRef.current.kind === 'top3') goPlace(0);
      }, 4300),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.kind, tick.n]);

  // Reveal moments: confetti for every place, the big one for the champion.
  const current = stage.kind === 'place' ? places[stage.idx] : undefined;
  const photoCount = current ? publicMembers(current.team).length : 0;
  useEffect(() => {
    if (!current || !tick.revealed) return;
    if (tick.beat === 0) setConfetti((x) => x + 1);
    if (current.rank === 1) {
      if (!championFired.current) {
        championFired.current = true;
        onChampion?.();
      }
      if (tick.beat === photoCount) setConfetti((x) => x + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.team.id, tick.revealed, tick.beat]);

  const exit = () => {
    timers.current.forEach(clearTimeout);
    Object.values(audios.current).forEach((a) => a && !a.paused && fadeOut(a, 900));
    if (typeof document !== 'undefined' && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    setTimeout(onExit, 300);
  };

  const next = () => {
    const s = stageRef.current;
    if (s.kind === 'ready') {
      if (typeof document !== 'undefined' && !document.fullscreenElement) {
        void document.documentElement.requestFullscreen?.().catch(() => {});
      }
      // Unlock every track inside this key press so later cues can start on their own.
      Object.values(audios.current).forEach((a) => {
        if (!a) return;
        a.muted = true;
        void a
          .play()
          .then(() => {
            if (clock.current?.audio !== a) a.pause();
            a.muted = false;
          })
          .catch(() => {
            a.muted = false;
          });
      });
      startSlot('countdown');
      setTick({ n: null, revealed: false, beat: 0 });
      setStage({ kind: 'countdown' });
    } else if (s.kind === 'top3') {
      goPlace(0);
    } else if (s.kind === 'place') {
      if (!tickRef.current.revealed) return; // wait for the drop
      if (s.idx + 1 < places.length) goPlace(s.idx + 1);
      else setStage({ kind: 'finale' });
    }
  };
  const tickRef = useRef(tick);
  tickRef.current = tick;
  const nextRef = useRef(next);
  nextRef.current = next;
  const exitRef = useRef(exit);
  exitRef.current = exit;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === 'ArrowRight' || e.key === 'Enter' || e.key === 'PageDown') {
        e.preventDefault();
        nextRef.current();
      } else if (e.key === 'Escape' || e.key === 'q') {
        exitRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---- Render --------------------------------------------------------------------------------
  const rayColor =
    stage.kind === 'place' && tick.revealed && current
      ? teamColorOf(current.team)
      : stage.kind === 'finale'
        ? palette.yellow
        : palette.red;
  const fast = stage.kind === 'countdown' || (stage.kind === 'place' && !tick.revealed);

  let body: ReactNode = null;
  if (stage.kind === 'ready') {
    body = (
      <View style={styles.center}>
        <Shout size={44 * k} color={palette.white}>
          {eventName.toUpperCase()}
        </Shout>
        <Pop key="ready">
          <Shout size={120 * k} color={palette.yellow}>
            {'AND THE WINNERS\nARE…'}
          </Shout>
        </Pop>
        <AppText style={[styles.hint, { fontSize: 22 * k, lineHeight: 30 * k, marginTop: 30 * k }]}>Press SPACE to start the countdown</AppText>
      </View>
    );
  } else if (stage.kind === 'countdown' || stage.kind === 'top3') {
    const n = stage.kind === 'top3' ? -1 : tick.n;
    body = (
      <View style={styles.center}>
        {n === null ? (
          <Pulse beat={tick.beat}>
            <Shout size={110 * k} color={palette.yellow}>
              GET READY…
            </Shout>
          </Pulse>
        ) : n === -1 ? (
          <Pop key="top3">
            <Burst size={560 * k} color={palette.yellow} points={18} shadow={10 * k}>
              <Shout size={130 * k} color={palette.red}>
                {'THE\nTOP 3!'}
              </Shout>
            </Burst>
          </Pop>
        ) : (
          <Pop key={`n${n}`}>
            <Burst size={(n === 0 ? 560 : 440) * k} color={NUM_COLORS[n % NUM_COLORS.length]} points={n === 0 ? 20 : 14} shadow={10 * k}>
              <Shout size={(n === 0 ? 300 : 260) * k} color={textOn(NUM_COLORS[n % NUM_COLORS.length]!)}>
                {String(n)}
              </Shout>
            </Burst>
          </Pop>
        )}
      </View>
    );
  } else if (stage.kind === 'place' && current) {
    body = (
      <PlaceView entry={current} revealed={tick.revealed} beat={tick.beat} k={k} maxPerJudge={maxPerJudge} />
    );
  } else if (stage.kind === 'finale') {
    body = <Finale places={places} k={k} />;
  }

  const waiting = stage.kind === 'place' && tick.revealed;
  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={exit}>
      <Pressable style={styles.root} onPress={() => nextRef.current()} accessibilityLabel="Next">
        <Rays color={rayColor} fast={fast} size={Math.hypot(width, height)} />
        <View style={styles.fill} pointerEvents="box-none">
          {body}
        </View>
        {confetti > 0 ? <Confetti key={confetti} burstKey={confetti} count={current?.rank === 1 || stage.kind === 'finale' ? 160 : 90} /> : null}
        <View style={styles.operator} pointerEvents="box-none">
          <AppText style={styles.operatorText}>
            {[
              status,
              waiting && stage.kind === 'place' && stage.idx + 1 < places.length ? 'SPACE: next place' : null,
              waiting && stage.kind === 'place' && stage.idx + 1 >= places.length ? 'SPACE: podium' : null,
              'ESC: exit',
            ]
              .filter(Boolean)
              .join('   ·   ')}
          </AppText>
        </View>
      </Pressable>
    </Modal>
  );
}

// ---- Pieces --------------------------------------------------------------------------------------

function Shout({ size, color, children }: { size: number; color: string; children: ReactNode }) {
  return (
    <AppText
      style={{
        fontFamily: fonts.display,
        fontSize: size,
        lineHeight: size * 1.02,
        letterSpacing: size * 0.03,
        color,
        textAlign: 'center',
        textShadowColor: palette.ink,
        textShadowOffset: { width: size * 0.05, height: size * 0.05 },
        textShadowRadius: 0,
      }}
    >
      {children}
    </AppText>
  );
}

/** Springs its children in from big and tilted (remount with a new key to replay). */
function Pop({ children, from = 0.2, delay = 0 }: { children: ReactNode; from?: number; delay?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([Animated.delay(delay), Animated.spring(v, { toValue: 1, friction: 4, tension: 120, useNativeDriver: false })]).start();
  }, [v, delay]);
  return (
    <Animated.View
      style={{
        opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 1] }),
        transform: [
          { scale: v.interpolate({ inputRange: [0, 1], outputRange: [from, 1] }) },
          { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '0deg'] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** Bumps on every beat. */
function Pulse({ beat, children }: { beat: number; children: ReactNode }) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    v.setValue(1.12);
    Animated.timing(v, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [beat, v]);
  return <Animated.View style={{ transform: [{ scale: v }] }}>{children}</Animated.View>;
}

/** Slams down from the camera once `show` is true. */
function Slam({ show, children, style }: { show: boolean; children: ReactNode; style?: object }) {
  const v = useRef(new Animated.Value(show ? 1 : 0)).current;
  useEffect(() => {
    if (show) Animated.spring(v, { toValue: 1, friction: 6, tension: 110, useNativeDriver: false }).start();
    else v.setValue(0);
  }, [show, v]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [2.4, 1] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Comic speed rays spinning behind everything. */
function Rays({ color, fast, size }: { color: string; fast: boolean; size: number }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    spin.setValue(0);
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: fast ? 9000 : 30000, easing: Easing.linear, useNativeDriver: false }));
    loop.start();
    return () => loop.stop();
  }, [fast, spin]);
  const n = 20;
  const r = size / 2;
  const points = Array.from({ length: n }, (_, i) => {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = a0 + Math.PI / n;
    return `${r},${r} ${r + Math.cos(a0) * r * 1.05},${r + Math.sin(a0) * r * 1.05} ${r + Math.cos(a1) * r * 1.05},${r + Math.sin(a1) * r * 1.05}`;
  });
  return (
    <View style={[StyleSheet.absoluteFill, styles.raysWrap]} pointerEvents="none">
      <Animated.View
        style={{
          width: size,
          height: size,
          transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
        }}
      >
        <Svg width={size} height={size}>
          {points.map((p, i) => (
            <Polygon key={i} points={p} fill={color} opacity={0.22} />
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
}

function PlaceView({ entry, revealed, beat, k, maxPerJudge }: { entry: ShowEntry; revealed: boolean; beat: number; k: number; maxPerJudge: number | null }) {
  const people = publicMembers(entry.team);
  const color = teamColorOf(entry.team);
  const champion = entry.rank === 1;
  const shownPhotos = revealed ? Math.max(0, beat) : 0;
  const photo = Math.min(130, 720 / Math.max(1, people.length)) * k;

  if (!revealed) {
    return (
      <View style={styles.center}>
        <Pulse beat={beat}>
          <Shout size={(champion ? 120 : 110) * k} color={champion ? palette.yellow : palette.white}>
            {champion ? 'AND THE\nCHAMPION IS…' : `IN ${PLACE_WORD[entry.rank]} PLACE…`}
          </Shout>
        </Pulse>
      </View>
    );
  }

  return (
    <View style={[styles.place, { padding: 40 * k, gap: 28 * k }]}>
      <View style={[styles.placeTop, { gap: 44 * k }]}>
        <Slam show style={{ width: 440 * k }}>
          <View style={[styles.frame, { borderWidth: 6 * k, padding: 8 * k, transform: [{ rotate: '-2.5deg' }] }]}>
            <TeamImage url={entry.team.imageUrl} aspectRatio={4 / 3} borderRadius={2} />
          </View>
          <View style={[styles.rankBurst, { right: -56 * k, top: -44 * k }]}>
            <Burst size={(champion ? 230 : 190) * k} color={MEDAL[entry.rank] ?? palette.yellow} points={16} shadow={8 * k}>
              <Shout size={(champion ? 66 : 56) * k} color={palette.ink}>
                {`${PLACE_WORD[entry.rank]}!`}
              </Shout>
            </Burst>
          </View>
          {champion ? (
            <View style={[styles.winner, { left: -50 * k, bottom: -60 * k }]} pointerEvents="none">
              <Pop from={0.1} delay={300}>
                <Burst size={200 * k} color={palette.red} points={14} shadow={8 * k}>
                  <Shout size={46 * k} color={palette.yellow}>
                    {'WIN-\nNER!'}
                  </Shout>
                </Burst>
              </Pop>
            </View>
          ) : null}
        </Slam>
        <Slam show style={styles.flex}>
          <View style={[styles.namePlate, { backgroundColor: color, borderWidth: 6 * k, paddingHorizontal: 26 * k, paddingVertical: 14 * k }]}>
            <Shout size={(entry.team.name.length > 18 ? 66 : 88) * k} color={textOn(color)}>
              {entry.team.name.toUpperCase()}
            </Shout>
          </View>
          <AppText numberOfLines={3} style={[styles.project, { fontSize: 30 * k, lineHeight: 38 * k, marginTop: 18 * k }]}>
            {entry.team.projectTitle}
          </AppText>
          <View style={[styles.scoreRow, { marginTop: 14 * k, gap: 12 * k }]}>
            <Shout size={64 * k} color={palette.yellow}>
              {formatAverage(entry.average)}
            </Shout>
            <AppText style={[styles.scoreOf, { fontSize: 26 * k, lineHeight: 30 * k }]}>{maxPerJudge ? `/ ${maxPerJudge} avg` : 'avg'}</AppText>
          </View>
        </Slam>
      </View>
      <View style={[styles.photos, { gap: 26 * k }]}>
        {people.map((p, i) =>
          i < shownPhotos ? (
            <Pop key={`${p.name}-${i}`} from={0.1}>
              <View style={styles.personCol}>
                <View style={[styles.photoRing, { borderColor: color, borderWidth: 6 * k, padding: 3 * k }]}>
                  <Avatar name={p.name} photoUrl={p.photoUrl} size={photo} />
                </View>
                <AppText numberOfLines={1} style={[styles.personName, { fontSize: 24 * k, lineHeight: 30 * k, maxWidth: photo + 60 * k }]}>
                  {p.name}
                </AppText>
              </View>
            </Pop>
          ) : (
            <View key={`${p.name}-${i}`} style={{ width: photo + 18 * k, height: photo + 48 * k }} />
          ),
        )}
      </View>
    </View>
  );
}

const PEDESTAL: Record<number, number> = { 1: 200, 2: 140, 3: 100 };

function Finale({ places, k }: { places: ShowEntry[]; k: number }) {
  const order = [2, 1, 3].map((r) => places.find((p) => p.rank === r)).filter((e): e is ShowEntry => !!e);
  return (
    <View style={[styles.finale, { padding: 30 * k }]}>
      <Pop>
        <Shout size={92 * k} color={palette.yellow}>
          CHAMPIONS ASSEMBLED!
        </Shout>
      </Pop>
      <View style={[styles.podium, { gap: 30 * k, marginTop: 20 * k }]}>
        {order.map((e, i) => {
          const color = teamColorOf(e.team);
          const people = publicMembers(e.team);
          return (
            <Pop key={e.team.id} delay={i * 250} from={0.4}>
              <View style={[styles.finaleCol, { width: 340 * k }]}>
                <View style={[styles.finaleCard, { borderWidth: 5 * k, padding: 14 * k, gap: 10 * k }]}>
                  <View style={[styles.namePlate, { backgroundColor: color, borderWidth: 4 * k, paddingHorizontal: 12 * k, paddingVertical: 6 * k }]}>
                    <Shout size={(e.team.name.length > 16 ? 32 : 40) * k} color={textOn(color)}>
                      {e.team.name.toUpperCase()}
                    </Shout>
                  </View>
                  <View style={[styles.finalePeople, { gap: 8 * k }]}>
                    {people.map((p, j) => (
                      <Avatar key={`${p.name}-${j}`} name={p.name} photoUrl={p.photoUrl} size={(people.length > 4 ? 52 : 64) * k} />
                    ))}
                  </View>
                </View>
                <View style={[styles.pedestal, { height: (PEDESTAL[e.rank] ?? 90) * k, backgroundColor: MEDAL[e.rank], borderWidth: 5 * k }]}>
                  <Shout size={90 * k} color={palette.ink}>
                    {String(e.rank)}
                  </Shout>
                </View>
              </View>
            </Pop>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.ink, overflow: 'hidden', cursor: 'default' } as object,
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  raysWrap: { alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  hint: { fontFamily: fonts.bold, color: palette.white, opacity: 0.7, textAlign: 'center' },
  flex: { flex: 1 },
  place: { flex: 1, justifyContent: 'center' },
  placeTop: { flexDirection: 'row', alignItems: 'center' },
  frame: { backgroundColor: palette.white, borderColor: palette.ink },
  rankBurst: { position: 'absolute' },
  namePlate: { alignSelf: 'flex-start', borderColor: palette.ink, transform: [{ rotate: '-1.5deg' }] },
  project: { fontFamily: fonts.bold, color: palette.white },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline' },
  scoreOf: { fontFamily: fonts.bold, color: palette.white, opacity: 0.8 },
  photos: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' },
  personCol: { alignItems: 'center', gap: 8 },
  photoRing: { borderRadius: 999, backgroundColor: palette.white },
  personName: { fontFamily: fonts.display, color: palette.white, letterSpacing: 1, textAlign: 'center' },
  winner: { position: 'absolute', transform: [{ rotate: '-10deg' }] },
  finale: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  podium: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center' },
  finaleCol: { alignItems: 'stretch' },
  finaleCard: { backgroundColor: palette.paper, borderColor: palette.ink, alignItems: 'center' },
  finalePeople: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  pedestal: { borderColor: palette.ink, borderBottomWidth: 0, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  operator: { position: 'absolute', left: 0, right: 0, bottom: 10, alignItems: 'center' },
  operatorText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 16, color: palette.white, opacity: 0.35 },
});
