import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useWindowDimensions } from 'react-native';

import { imageUri } from '@/api/client';
import type { PublicTeam } from '@/api/types';
import { publicMembers } from '@/features/team/people';
import { formatAverage } from '@/lib/format';
import { teamColorOf } from '@/lib/teamColor';

import { CINEMA_CSS, CINEMA_FONTS } from './cinemaCss';
import { beatLength, snapToBeat, type ShowTimes } from './trackStore';

export interface ShowEntry {
  rank: number;
  team: PublicTeam;
  average: number | null;
}

export interface BigRevealProps {
  /** Top 3, any order. */
  entries: ShowEntry[];
  /** Object URL of the organiser's song (a local file), or null to run silently on a timer. */
  song: string | null;
  times: ShowTimes;
  eventName: string;
  maxPerJudge: number | null;
  /** Called once, the moment 1st place is revealed (used to publish to everyone's phones). */
  onChampion?: () => void;
  /** Small operator line at the bottom (e.g. publish status). */
  status?: string | null;
  onExit: () => void;
}

type Scene =
  | { kind: 'intro' }
  | { kind: 'count'; n: number }
  | { kind: 'congrats' }
  | { kind: 'top3' }
  | { kind: 'build'; rank: number; from: number; to: number }
  | { kind: 'reveal'; rank: number; at: number }
  | { kind: 'finale' };

interface Frame {
  key: string;
  scene: Scene;
  /** Beat number on the song's grid. */
  beat: number;
  /** Song time when this frame was taken. */
  t: number;
}

type Tone = 'blue' | 'gold' | 'silver' | 'bronze';
const TONE: Record<Tone, string> = { blue: '#8fbaff', gold: '#ffc04a', silver: '#e4ecf8', bronze: '#ec9a5e' };
interface Hit {
  at: number;
  tone: Tone;
  big: boolean;
  /** No flash, just a nudge (and sparks if any). */
  soft?: boolean;
  /** 0 none, 1 burst, 2 storm. */
  sparks: number;
}

interface Graph {
  ctx: AudioContext;
  gain: GainNode;
  an: AnalyserNode;
  buf: Uint8Array<ArrayBuffer>;
}

/** Seconds of music before the "10". */
const LEAD_IN = 1.6;
/** Length of the "In second place…" teaser, in beats. */
const TEASE_BEATS = 4;

const PLACE_WORD: Record<number, string> = { 1: 'First place', 2: 'Second place', 3: 'Third place' };
const ROMAN: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III' };
const METAL_CLASS: Record<number, string> = { 1: 'cin-gold', 2: 'cin-silver', 3: 'cin-bronze' };
const MEDAL_COLOR: Record<number, string> = { 1: '#ffd36b', 2: '#cfd8e6', 3: '#e59a62' };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** When each countdown number (10, 9 … 1, 0) appears: evenly spread, each on a beat. */
function countdownTimes(T: ShowTimes): number[] {
  const out: number[] = [];
  for (let k = 0; k <= 10; k++) {
    const raw = T.countdown + (k * (T.zero - T.countdown)) / 10;
    out.push(k === 0 ? T.countdown : k === 10 ? T.zero : snapToBeat(raw, T));
  }
  for (let k = 1; k < out.length; k++) if (out[k]! <= out[k - 1]!) out[k] = out[k - 1]! + 0.05;
  return out;
}

function teaseStart(T: ShowTimes, P: number) {
  return Math.max(T.third + P, T.second - TEASE_BEATS * P);
}

function sceneAt(t: number, T: ShowTimes, cd: number[], P: number): Scene {
  if (t < T.countdown) return { kind: 'intro' };
  if (t < T.congrats) {
    let k = 0;
    while (k < 10 && t >= cd[k + 1]!) k++;
    return { kind: 'count', n: 10 - k };
  }
  if (t < T.top3) return { kind: 'congrats' };
  if (t < T.build3) return { kind: 'top3' };
  if (t < T.third) return { kind: 'build', rank: 3, from: T.build3, to: T.third };
  const tease = teaseStart(T, P);
  if (t < tease) return { kind: 'reveal', rank: 3, at: T.third };
  if (t < T.second) return { kind: 'build', rank: 2, from: tease, to: T.second };
  if (t < T.build1) return { kind: 'reveal', rank: 2, at: T.second };
  if (t < T.first) return { kind: 'build', rank: 1, from: T.build1, to: T.first };
  if (t < T.finale) return { kind: 'reveal', rank: 1, at: T.first };
  return { kind: 'finale' };
}

const sceneKey = (s: Scene) =>
  s.kind === 'count' ? `count${s.n}` : s.kind === 'build' || s.kind === 'reveal' ? `${s.kind}${s.rank}` : s.kind;

function hitsOf(T: ShowTimes, cd: number[], P: number): Hit[] {
  return [
    // 3, 2, 1: a nudge on each.
    ...cd.slice(7, 10).map((at): Hit => ({ at, tone: 'gold', big: false, soft: true, sparks: 0 })),
    { at: T.zero, tone: 'blue', big: true, sparks: 1 },
    { at: T.congrats, tone: 'blue', big: false, sparks: 0 },
    { at: T.top3, tone: 'gold', big: false, sparks: 0 },
    { at: T.third, tone: 'bronze', big: true, sparks: 1 },
    { at: T.second, tone: 'silver', big: true, sparks: 1 },
    { at: T.first, tone: 'gold', big: true, sparks: 2 },
    { at: T.first + 4 * P, tone: 'gold', big: false, soft: true, sparks: 2 },
    { at: T.first + 8 * P, tone: 'gold', big: false, soft: true, sparks: 1 },
    { at: T.finale, tone: 'gold', big: true, sparks: 2 },
    { at: T.finale + 4 * P, tone: 'gold', big: false, soft: true, sparks: 1 },
  ];
}

// ---- Stylesheet + fonts (once) ---------------------------------------------------------------
function useCinemaStyles() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!document.getElementById('cin-fonts')) {
      const l = document.createElement('link');
      l.id = 'cin-fonts';
      l.rel = 'stylesheet';
      l.href = CINEMA_FONTS;
      document.head.appendChild(l);
    }
    const old = document.getElementById('cin-css');
    if (old && old.textContent !== CINEMA_CSS) old.remove();
    if (!document.getElementById('cin-css')) {
      const s = document.createElement('style');
      s.id = 'cin-css';
      s.textContent = CINEMA_CSS;
      document.head.appendChild(s);
    }
  }, []);
}

/**
 * Full-screen, cinematic podium reveal for the projector, choreographed to ONE song.
 * Everything on screen is derived from the song's playback position, so it can never drift out of sync.
 */
export function BigReveal({ entries, song, times, eventName, maxPerJudge, onChampion, status, onExit }: BigRevealProps) {
  useCinemaStyles();
  const { width, height } = useWindowDimensions();
  const byRank = useMemo(() => {
    const m = new Map<number, ShowEntry>();
    for (const e of entries) if (e.rank >= 1 && e.rank <= 3 && !m.has(e.rank)) m.set(e.rank, e);
    return m;
  }, [entries]);
  const P = beatLength(times);
  const cd = useMemo(() => countdownTimes(times), [times]);
  const hits = useMemo(() => hitsOf(times, cd, beatLength(times)), [times, cd]);

  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [frame, setFrame] = useState<Frame>({ key: 'ready', scene: { kind: 'intro' }, beat: 0, t: 0 });
  const [fx, setFx] = useState<{ id: number; tone: Tone; big: boolean }>({ id: 0, tone: 'blue', big: false });

  const rootRef = useRef<HTMLDivElement | null>(null);
  const camRef = useRef<HTMLDivElement | null>(null);
  const kickRef = useRef<HTMLDivElement | null>(null);
  const spinRef = useRef<HTMLDivElement | null>(null);
  const burstRef = useRef<((count: number, power: number) => void) | null>(null);

  // ---- Audio: one element, routed through an analyser (music-reactive glow) and a gain (fades).
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const graph = useRef<Graph | null>(null);
  const useAudio = useRef(false);
  const silent = useRef({ base: 0, t0: 0, paused: true });
  const startedRef = useRef(false);
  const championFired = useRef(false);

  useEffect(() => {
    if (!song) return;
    const a = new Audio(song);
    a.preload = 'auto';
    audioRef.current = a;
    let ctx: AudioContext | null = null;
    try {
      ctx = new AudioContext();
      const src = ctx.createMediaElementSource(a);
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      an.smoothingTimeConstant = 0.5;
      // Wide range so loud orchestral bass does not pin every bin at the top.
      an.minDecibels = -85;
      an.maxDecibels = -5;
      const gain = ctx.createGain();
      src.connect(an);
      an.connect(gain);
      gain.connect(ctx.destination);
      graph.current = { ctx, gain, an, buf: new Uint8Array(an.frequencyBinCount) };
    } catch {
      graph.current = null; // Plays straight out of the element; the glow follows the beat grid instead.
    }
    return () => {
      a.pause();
      void ctx?.close().catch(() => {});
      graph.current = null;
      audioRef.current = null;
      useAudio.current = false;
    };
  }, [song]);

  const now = (): number => {
    const a = audioRef.current;
    if (useAudio.current && a) return a.currentTime;
    const s = silent.current;
    return s.paused ? s.base : s.base + (performance.now() - s.t0) / 1000;
  };

  const shake = (amp: number, ms: number) => {
    camRef.current?.animate?.(
      [
        { transform: 'translate3d(0,0,0)' },
        { transform: `translate3d(${-amp}px,${amp * 0.6}px,0) scale(1.02)` },
        { transform: `translate3d(${amp}px,${-amp * 0.6}px,0) scale(1.02)` },
        { transform: `translate3d(${-amp * 0.6}px,${amp * 0.4}px,0)` },
        { transform: `translate3d(${amp * 0.4}px,${-amp * 0.2}px,0)` },
        { transform: 'translate3d(0,0,0)' },
      ],
      { duration: ms, easing: 'cubic-bezier(.36,.07,.19,.97)' },
    );
  };

  /** A scripted hit: flash + shockwave + lens flare + camera shake (+ sparks). */
  const fire = (h: Hit) => {
    if (!h.soft) setFx((f) => ({ id: f.id + 1, tone: h.tone, big: h.big }));
    shake(h.big ? 16 : h.soft ? 6 : 9, h.big ? 800 : 520);
    if (h.sparks) burstRef.current?.(h.sparks > 1 ? 520 : 300, h.sparks > 1 ? 1.35 : 1);
    if (h.soft) kickRef.current?.animate?.([{ opacity: 0.6 }, { opacity: 0 }], { duration: 500, easing: 'ease-out' });
  };

  /** A hit detected live in the music: a glow kick (and a few sparks once a team is on screen). */
  const kick = (strength: number, scene: Scene) => {
    kickRef.current?.animate?.([{ opacity: 0.2 + strength * 0.4 }, { opacity: 0 }], { duration: 420, easing: 'ease-out' });
    if (scene.kind === 'reveal' || scene.kind === 'finale') burstRef.current?.(26, 0.55);
  };

  const live = useRef({ now, fire, kick, times, cd, hits, P, byRank, onChampion });
  live.current = { now, fire, kick, times, cd, hits, P, byRank, onChampion };

  // ---- Frame loop: read the song position, fire hits, drive the glow and the emblem -------------
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let prevT = -1;
    let level = 0;
    let slow = 0.5;
    let prevX = 0;
    let lastKick = 0;
    let angle = 0;
    const loop = (ts: number) => {
      const L = live.current;
      const dt = Math.min(0.1, (ts - last) / 1000);
      last = ts;
      let spin = 7;
      if (startedRef.current) {
        const t = L.now();
        if (t > prevT) for (const h of L.hits) if (prevT < h.at && t >= h.at && t - h.at < 0.35) L.fire(h);
        prevT = t;
        if (!championFired.current && t >= L.times.first && L.byRank.has(1)) {
          championFired.current = true;
          L.onChampion?.();
        }
        const scene = sceneAt(t, L.times, L.cd, L.P);
        const key = sceneKey(scene);
        const beat = Math.floor((t - L.times.beat) / L.P);
        setFrame((p) => (p.key === key && p.beat === beat ? p : { key, scene, beat, t }));

        // Music level (bass) relative to its recent average, 0..1.
        let e = 0;
        const g = graph.current;
        const a = audioRef.current;
        const playing = useAudio.current ? !!a && !a.paused : !silent.current.paused;
        if (playing && g && useAudio.current) {
          g.an.getByteFrequencyData(g.buf);
          let sum = 0;
          for (let i = 1; i <= 8; i++) sum += g.buf[i]!;
          const x = sum / (8 * 255);
          slow += (x - slow) * Math.min(1, dt * 0.8);
          e = clamp01(0.25 + (x - slow) * 5);
          if (x - slow > 0.07 && x - prevX > 0.025 && ts - lastKick > 280) {
            lastKick = ts;
            L.kick(clamp01((x - slow) * 6), scene);
          }
          prevX = x;
        } else if (playing) {
          const frac = ((((t - L.times.beat) / L.P) % 1) + 1) % 1;
          e = Math.exp(-frac * 5) * 0.8;
        }
        level = e > level ? e : level * 0.88 + e * 0.12;
        rootRef.current?.style.setProperty('--lvl', level.toFixed(3));

        if (scene.kind === 'build') {
          const p = clamp01((t - scene.from) / (scene.to - scene.from));
          spin = 10 + 300 * p * p;
        } else if (scene.kind === 'count') spin = 36;
      }
      angle = (angle + spin * dt) % 360;
      if (spinRef.current) spinRef.current.style.transform = `rotate(${angle.toFixed(2)}deg) scale(${(1 + level * 0.07).toFixed(3)})`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ---- Operator controls --------------------------------------------------------------------
  const begin = () => {
    if (startedRef.current) return;
    if (typeof document !== 'undefined' && !document.fullscreenElement) {
      void document.documentElement.requestFullscreen?.().catch(() => {});
    }
    const from = Math.max(0, times.countdown - LEAD_IN);
    silent.current = { base: from, t0: performance.now(), paused: false };
    startedRef.current = true;
    setStarted(true);
    const a = audioRef.current;
    if (!a) return;
    useAudio.current = true;
    try {
      a.currentTime = from;
    } catch {
      // Not seekable yet: it starts from 0 instead.
    }
    const g = graph.current;
    if (g) {
      void g.ctx.resume();
      const at = g.ctx.currentTime;
      g.gain.gain.cancelScheduledValues(at);
      g.gain.gain.setValueAtTime(0.0001, at);
      g.gain.gain.linearRampToValueAtTime(1, at + 1.2);
    }
    a.play().catch(() => {
      // Could not play (blocked or bad file): keep going on a silent clock.
      useAudio.current = false;
      silent.current = { base: from, t0: performance.now(), paused: false };
    });
  };

  const togglePause = () => {
    if (!startedRef.current) return;
    const a = audioRef.current;
    if (useAudio.current && a) {
      if (a.paused) void a.play().catch(() => {});
      else a.pause();
      setTimeout(() => setPaused(a.paused), 60);
      return;
    }
    const s = silent.current;
    silent.current = s.paused ? { base: s.base, t0: performance.now(), paused: false } : { base: now(), t0: 0, paused: true };
    setPaused(silent.current.paused);
  };

  const seek = (d: number) => {
    if (!startedRef.current) return;
    const t = Math.max(0, now() + d);
    const a = audioRef.current;
    if (useAudio.current && a) a.currentTime = t;
    else silent.current = { ...silent.current, base: t, t0: performance.now() };
  };

  const exit = () => {
    const g = graph.current;
    if (g) {
      const at = g.ctx.currentTime;
      g.gain.gain.cancelScheduledValues(at);
      g.gain.gain.setValueAtTime(g.gain.gain.value, at);
      g.gain.gain.linearRampToValueAtTime(0.0001, at + 0.6);
    } else audioRef.current?.pause();
    if (typeof document !== 'undefined' && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    setTimeout(onExit, 650);
  };

  const keys = useRef({ begin, togglePause, seek, exit });
  keys.current = { begin, togglePause, seek, exit };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = keys.current;
      if (e.key === 'Escape' || e.key === 'q') {
        k.exit();
      } else if (!startedRef.current) {
        if (e.code === 'Space' || e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'PageDown') {
          e.preventDefault();
          k.begin();
        }
      } else if (e.key === 'p' || e.key === 'P') {
        k.togglePause();
      } else if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        k.seek(e.key === 'ArrowLeft' ? -5 : 5);
      } else if (e.code === 'Space') {
        e.preventDefault(); // A stray SPACE / clicker press must not scroll or restart anything.
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---- Look ----------------------------------------------------------------------------------
  const w = width;
  const h = height;
  const { scene, beat, t } = frame;
  const since = (at: number) => Math.floor((t - at) / P + 0.001);
  const rank = scene.kind === 'build' || scene.kind === 'reveal' ? scene.rank : null;
  const entry = rank ? byRank.get(rank) : undefined;
  const revealed = scene.kind === 'reveal' && !!entry;
  const champ = rank === 1 || scene.kind === 'finale';
  const showcase = revealed ? entry : scene.kind === 'finale' ? byRank.get(1) : undefined;
  const teamColor = revealed && entry ? teamColorOf(entry.team) : null;

  const glow = !started
    ? '#0d2a66'
    : teamColor
      ? `${teamColor}55`
      : champ
        ? '#5a3a0a'
        : scene.kind === 'top3'
          ? '#4a3208'
          : rank === 3
            ? '#3a1d0c'
            : '#0d2a66';
  const lvlColor = champ || scene.kind === 'top3' ? 'rgba(255,190,80,.5)' : teamColor ? `${teamColor}88` : 'rgba(110,160,255,.5)';
  const raysOn = started && (champ || scene.kind === 'top3');
  const backdropImg = showcase ? imageUri(showcase.team.imageUrl ?? showcase.team.posterUrl) : null;
  const wide = started && (revealed || scene.kind === 'finale' || scene.kind === 'top3' || scene.kind === 'congrats');
  const emberTone: 'cool' | 'warm' | 'gold' = champ ? 'gold' : rank ? 'warm' : 'cool';
  const dark = scene.kind === 'build' && scene.rank !== 2 && t >= scene.to - 2 * P;
  const emblem = (size: number, opacity: number) => <Emblem size={size} opacity={opacity} spinRef={spinRef} />;

  let body: ReactNode = null;
  if (!started) {
    body = (
      <div className="cin-center">
        {emblem(h * 0.78, 0.35)}
        <div className="cin-caps cin-track" style={{ fontSize: h * 0.026, color: '#a9bedf' }}>
          {eventName} presents
        </div>
        <div style={{ height: h * 0.03 }} />
        <Metal cls="cin-metal cin-shine cin-zoom" size={fit('The Results', w, h, 0.16)}>
          The Results
        </Metal>
        <div style={{ height: h * 0.03 }} />
        <div className="cin-caps cin-rise" style={{ fontSize: h * 0.022, color: '#8ea3c4', animationDelay: '.8s' }}>
          Project Expo 2026
        </div>
      </div>
    );
  } else if (scene.kind === 'intro') {
    body = (
      <div className="cin-center">
        {emblem(h * 0.8, 0.3)}
        <Pulse beat={beat}>
          <Metal cls="cin-metal cin-track" size={fit('Get ready', w, h, 0.09, 1.1)} style={{ letterSpacing: '.3em' }}>
            Get ready
          </Metal>
        </Pulse>
      </div>
    );
  } else if (scene.kind === 'count') {
    const n = scene.n;
    const k = 10 - n;
    const dur = n > 0 ? Math.max(0.6, cd[k + 1]! - cd[k]!) : 1;
    body = (
      <div className="cin-center">
        {emblem(h * 0.8, 0.55)}
        <div
          key={`n${n}`}
          className={`cin-num ${n === 0 ? 'zero' : ''}`}
          style={{ position: 'relative', animationDuration: n === 0 ? undefined : `${dur}s` }}
        >
          <Metal cls={n <= 3 ? 'cin-gold cin-shine' : 'cin-metal cin-shine'} size={h * (n === 0 ? 0.6 : 0.52)}>
            {String(n)}
          </Metal>
        </div>
        {n > 0 ? <div key={`r${n}`} className="cin-ring" style={{ '--accent': n <= 3 ? '#ffbf47' : '#7fb0ff', opacity: 0.6 } as CSSProperties} /> : null}
      </div>
    );
  } else if (scene.kind === 'congrats') {
    const s = since(times.congrats);
    body = (
      <div className="cin-center">
        {emblem(h * 0.86, 0.3)}
        <Pulse beat={Math.floor(s / 2)}>
          <Metal cls="cin-metal cin-shine cin-zoom" size={fit('Congratulations', w, h, 0.14)}>
            Congratulations
          </Metal>
        </Pulse>
        <div style={{ height: h * 0.035 }} />
        <Later show={s >= 1} className="cin-caps" style={{ fontSize: h * 0.042, color: '#e6edf7', letterSpacing: '.3em' }}>
          to the winning teams
        </Later>
        <Later show={s >= 5} className="cin-caps" style={{ fontSize: h * 0.034, color: '#ffd36b', marginTop: h * 0.022, letterSpacing: '.5em' }}>
          in advance!
        </Later>
      </div>
    );
  } else if (scene.kind === 'top3') {
    body = <TopThree since={since(times.top3)} w={w} h={h} emblem={emblem(h * 0.9, 0.22)} />;
  } else if (scene.kind === 'build') {
    const p = clamp01((t + P - scene.from) / (scene.to - scene.from));
    body = <Build rank={scene.rank} p={p} beat={beat} short={scene.rank === 2} w={w} h={h} emblem={emblem(h * 0.86, 0.22 + p * 0.4)} />;
  } else if (scene.kind === 'reveal') {
    body = entry ? (
      <PlaceReveal key={entry.team.id} entry={entry} since={since(scene.at)} w={w} h={h} maxPerJudge={maxPerJudge} />
    ) : (
      <TopThree since={99} w={w} h={h} emblem={emblem(h * 0.9, 0.22)} />
    );
  } else if (scene.kind === 'finale') {
    body = <Finale byRank={byRank} w={w} h={h} />;
  }

  const hint = !started
    ? [status, 'Space · start the show', 'Esc · exit'].filter(Boolean).join('     ·     ')
    : [status, paused ? 'Paused · P to resume' : null].filter(Boolean).join('     ·     ');

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div
      ref={rootRef}
      className={`cin-root ${wide ? 'wide' : ''}`}
      style={{ '--lvlc': lvlColor } as CSSProperties}
      onClick={() => {
        if (!startedRef.current) begin();
      }}
    >
      <div className="cin-cam" ref={camRef}>
        <div className="cin-bg" style={{ '--glow': glow } as CSSProperties} />
        <div
          key={backdropImg ?? 'none'}
          className={`cin-backdrop ${backdropImg ? 'on' : ''}`}
          style={backdropImg ? { backgroundImage: `url("${backdropImg}")` } : undefined}
        />
        <div className="cin-smoke">
          <i />
          <i />
          <i />
        </div>
        <div className={`cin-rays ${raysOn ? 'on' : ''}`} />
        <div className="cin-lvl" />
        <Embers tone={emberTone} burstRef={burstRef} />
        {body}
        <div className={`cin-dark ${dark ? 'on' : ''}`} />
        <div className="cin-vig" />
      </div>
      <div className="cin-kick" ref={kickRef} />
      {fx.id > 0 ? (
        <div key={fx.id} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div className="cin-flash" style={fx.big ? undefined : { animationDuration: '.7s', opacity: 0.6 }} />
          <div className="cin-ring" style={{ '--accent': TONE[fx.tone] } as CSSProperties} />
          <div className="cin-ring late" style={{ '--accent': fx.tone === 'gold' ? '#fff0c0' : '#e8f0ff' } as CSSProperties} />
          <div className={`cin-flare ${fx.tone === 'gold' || fx.tone === 'bronze' ? 'gold' : ''}`} />
        </div>
      ) : null}
      <div className="cin-grain" />
      <div className="cin-bar top" />
      <div className="cin-bar bot" />
      {hint ? <div className="cin-op">{hint}</div> : null}
    </div>,
    document.body,
  );
}

// ---- Pieces --------------------------------------------------------------------------------------

/** Bumps (scale + brightness) whenever `beat` changes, without remounting its children. */
function Pulse({ beat, children }: { beat: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    ref.current?.animate?.(
      [
        { transform: 'scale(1.05)', filter: 'brightness(1.5)' },
        { transform: 'scale(1)', filter: 'brightness(1)' },
      ],
      { duration: 450, easing: 'cubic-bezier(.2,.8,.3,1)' },
    );
  }, [beat]);
  return <div ref={ref}>{children}</div>;
}

/** Holds its space, then rises in when `show` turns true. */
function Later({ show, className, style, children }: { show: boolean; className: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <div className={show ? `${className} cin-rise` : className} style={show ? style : { ...style, opacity: 0 }}>
      {children}
    </div>
  );
}

function Metal({ cls, size, children, style }: { cls: string; size: number; children: string; style?: CSSProperties }) {
  return (
    <div className={cls} data-text={children} style={{ fontSize: size, ...style }}>
      {children}
    </div>
  );
}

/** Original Tech Arena emblem: a machined ring with tick marks. Spun by the frame loop (faster as suspense builds). */
function Emblem({ size, opacity, spinRef }: { size: number; opacity: number; spinRef: RefObject<HTMLDivElement | null> }) {
  const ticks = Array.from({ length: 72 }, (_, i) => i);
  return (
    <div
      className="cin-emblem driven"
      style={{ width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2, opacity, transition: 'opacity 1s' }}
    >
      <div className="spin" ref={spinRef}>
        <svg viewBox="0 0 200 200" width={size} height={size}>
          <defs>
            <linearGradient id="cinRingG" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset=".45" stopColor="#7d8aa0" />
              <stop offset=".5" stopColor="#1d2430" />
              <stop offset=".6" stopColor="#c6d0de" />
              <stop offset="1" stopColor="#5d6a80" />
            </linearGradient>
          </defs>
          <circle cx="100" cy="100" r="96" fill="none" stroke="url(#cinRingG)" strokeWidth="2.2" />
          <circle cx="100" cy="100" r="84" fill="none" stroke="url(#cinRingG)" strokeWidth="1" opacity=".7" />
          <circle cx="100" cy="100" r="62" fill="none" stroke="#9fb8e0" strokeWidth=".4" opacity=".5" strokeDasharray="2 3" />
          {ticks.map((i) => {
            const a = (i / ticks.length) * Math.PI * 2;
            const long = i % 6 === 0;
            const r1 = long ? 86 : 89;
            return (
              <line
                key={i}
                x1={100 + Math.cos(a) * r1}
                y1={100 + Math.sin(a) * r1}
                x2={100 + Math.cos(a) * 93}
                y2={100 + Math.sin(a) * 93}
                stroke={long ? '#e6edf7' : '#7f8ca3'}
                strokeWidth={long ? 1.2 : 0.5}
              />
            );
          })}
          {[0, 120, 240].map((d) => (
            <polygon key={d} points="100,6 104,15 96,15" fill="#e6edf7" transform={`rotate(${d} 100 100)`} />
          ))}
        </svg>
      </div>
    </div>
  );
}

/** Suspense ring that fills up until the reveal. */
function ChargeRing({ size, p, color }: { size: number; p: number; color: string }) {
  const r = 90;
  const c = 2 * Math.PI * r;
  const ticks = 24;
  return (
    <div className="cin-charge" style={{ width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }}>
      <svg viewBox="0 0 200 200" width={size} height={size} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
        <circle cx="100" cy="100" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="2.5" />
        <circle
          className="p"
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          style={{ filter: `drop-shadow(0 0 4px ${color}) drop-shadow(0 0 12px ${color})` }}
        />
        {Array.from({ length: ticks }, (_, i) => {
          const a = (i / ticks) * Math.PI * 2;
          const on = i / ticks < p;
          return (
            <line
              key={i}
              x1={100 + Math.cos(a) * 96}
              y1={100 + Math.sin(a) * 96}
              x2={100 + Math.cos(a) * 101}
              y2={100 + Math.sin(a) * 101}
              stroke={on ? color : 'rgba(255,255,255,.15)'}
              strokeWidth={on ? 2 : 1}
            />
          );
        })}
      </svg>
    </div>
  );
}

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@';
/** A row of scrambling letters: the name being "decoded". Changes on every beat. */
function Cipher({ beat, n, gold }: { beat: number; n: number; gold: boolean }) {
  return (
    <div className={`cin-cipher ${gold ? 'gold' : ''}`}>
      {Array.from({ length: n }, (_, i) => {
        const x = Math.sin((beat + 7) * 12.9898 + i * 78.233) * 43758.5453;
        return <span key={`${beat}-${i}`}>{GLYPHS[Math.floor((x - Math.floor(x)) * GLYPHS.length)]}</span>;
      })}
    </div>
  );
}

function TopThree({ since, w, h, emblem }: { since: number; w: number; h: number; emblem: ReactNode }) {
  const s = Math.min(w * 0.1, h * 0.19);
  return (
    <div className="cin-center">
      {emblem}
      <Pulse beat={Math.floor(since / 2)}>
        <div className="cin-caps cin-track" style={{ fontSize: h * 0.032, color: '#ffe3a1' }}>
          And the
        </div>
        <div style={{ height: h * 0.015 }} />
        <Metal cls="cin-gold cin-shine cin-zoom" size={fit('Top 3 teams', w, h, 0.15)}>
          Top 3 teams
        </Metal>
        <div style={{ height: h * 0.012 }} />
        <div className="cin-caps cin-rise" style={{ fontSize: h * 0.032, color: '#ffe3a1', animationDelay: '.6s' }}>
          are…
        </div>
      </Pulse>
      <div style={{ height: h * 0.06 }} />
      <div className="cin-shields">
        {[3, 2, 1].map((r, i) => {
          const on = since >= 4 + i * 4;
          const size = r === 1 ? s * 1.22 : s;
          return (
            <div
              key={r}
              className={`cin-shield ${r === 1 ? 'gold' : r === 3 ? 'bronze' : ''} ${on ? '' : 'off'}`}
              style={{ '--s': `${size}px` } as CSSProperties}
            >
              <div className="in">
                <Metal cls={METAL_CLASS[r]!} size={size * 0.4}>
                  {ROMAN[r]!}
                </Metal>
              </div>
            </div>
          );
        })}
      </div>
      {since >= 4 ? (
        <div
          key={`sh${Math.min(2, Math.floor((since - 4) / 4))}`}
          className="cin-ring"
          style={{ '--accent': since >= 12 ? '#ffc04a' : '#cfd8e6', opacity: 0.5 } as CSSProperties}
        />
      ) : null}
    </div>
  );
}

function Build({
  rank,
  p,
  beat,
  short,
  w,
  h,
  emblem,
}: {
  rank: number;
  p: number;
  beat: number;
  short: boolean;
  w: number;
  h: number;
  emblem: ReactNode;
}) {
  const color = MEDAL_COLOR[rank]!;
  return (
    <div className="cin-center">
      {emblem}
      {short ? null : <ChargeRing size={h * 0.7} p={p} color={color} />}
      <div className="cin-numeral">
        <Metal cls={METAL_CLASS[rank]!} size={h * 0.95}>
          {ROMAN[rank]!}
        </Metal>
      </div>
      <Pulse beat={short ? beat : Math.floor(beat / 2)}>
        {rank === 1 ? (
          <>
            <div className="cin-caps cin-track" style={{ fontSize: h * 0.034, color: '#ffe3a1' }}>
              And the
            </div>
            <div style={{ height: h * 0.02 }} />
            <Metal cls="cin-gold cin-shine cin-zoom" size={fit('Champion is', w, h, 0.15)}>
              Champion is
            </Metal>
          </>
        ) : (
          <>
            <div className="cin-caps cin-track" style={{ fontSize: h * 0.032, color: '#a9bedf' }}>
              In
            </div>
            <div style={{ height: h * 0.02 }} />
            <Metal cls={`${METAL_CLASS[rank]} cin-zoom`} size={fit(PLACE_WORD[rank]!, w, h, 0.14)}>
              {PLACE_WORD[rank]!}
            </Metal>
          </>
        )}
      </Pulse>
      {short ? null : (
        <>
          <div style={{ height: h * 0.055 }} />
          <Cipher beat={beat} n={9} gold={rank === 1} />
        </>
      )}
      <div key={`b${Math.floor(beat / 2)}`} className="cin-ring soft" style={{ '--accent': color } as CSSProperties} />
    </div>
  );
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
  hue: number;
  spark: boolean;
}

/** Floating embers, plus spark bursts on demand through `burstRef`. Additive canvas. */
function Embers({ tone, burstRef }: { tone: 'cool' | 'warm' | 'gold'; burstRef: RefObject<((count: number, power: number) => void) | null> }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const toneRef = useRef(tone);
  toneRef.current = tone;
  const parts = useRef<Particle[]>([]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    let raf = 0;
    let last = performance.now();
    const resize = () => {
      c.width = window.innerWidth * dpr;
      c.height = window.innerHeight * dpr;
    };
    resize();
    window.addEventListener('resize', resize);
    const hueFor = () =>
      toneRef.current === 'cool' ? 205 + Math.random() * 25 : toneRef.current === 'gold' ? 38 + Math.random() * 12 : 18 + Math.random() * 20;

    burstRef.current = (count: number, power: number) => {
      const W = c.width;
      const H = c.height;
      const gold = toneRef.current === 'gold';
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = (200 + Math.random() * 700 * power) * dpr;
        parts.current.push({
          x: W / 2,
          y: H * 0.45,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 150 * dpr,
          life: 0,
          max: 1.2 + Math.random() * 1.6,
          r: (0.8 + Math.random() * 1.6) * dpr,
          hue: gold ? 40 + Math.random() * 15 : toneRef.current === 'cool' ? 210 : 25 + Math.random() * 20,
          spark: true,
        });
      }
    };

    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const W = c.width;
      const H = c.height;
      const want = toneRef.current === 'gold' ? 200 : 120;
      let ambient = 0;
      for (const p of parts.current) if (!p.spark) ambient++;
      for (let i = ambient; i < want && Math.random() < 0.6; i++) {
        parts.current.push({
          x: Math.random() * W,
          y: H + 10,
          vx: (Math.random() - 0.5) * 20,
          vy: -(25 + Math.random() * 60) * dpr,
          life: 0,
          max: 6 + Math.random() * 8,
          r: (0.6 + Math.random() * 1.8) * dpr,
          hue: hueFor(),
          spark: false,
        });
      }
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      parts.current = parts.current.filter((p) => {
        p.life += dt;
        if (p.spark) {
          p.vy += 260 * dpr * dt;
          p.vx *= 0.985;
          p.vy *= 0.985;
        } else {
          p.vx += Math.sin((t / 1000) * 0.8 + p.x * 0.01) * 6 * dt;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const k = 1 - p.life / p.max;
        if (k <= 0 || p.y < -20 || p.y > H + 40) return false;
        const a = Math.min(1, p.life * 3) * k;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        g.addColorStop(0, `hsla(${p.hue},100%,${p.spark ? 80 : 70}%,${a})`);
        g.addColorStop(1, `hsla(${p.hue},100%,50%,0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
        ctx.fill();
        return true;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      burstRef.current = null;
    };
  }, [burstRef]);

  return <canvas ref={ref} className="cin-canvas" style={{ width: '100%', height: '100%' }} />;
}

/** Largest Cinzel caps size (px) at which `text` fits 86% of width `w`, capped at `maxH` of the height. */
function fit(text: string, w: number, h: number, maxH: number, spacing = 0.92): number {
  return Math.min(h * maxH, (w * 0.86) / Math.max(4, text.length * spacing));
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

function Hero({ name, photoUrl, color, size, role }: { name: string; photoUrl: string | null; color: string; size: number; role?: string | null }) {
  const uri = imageUri(photoUrl);
  const [broken, setBroken] = useState(false);
  return (
    <div className="cin-hero" style={{ '--w': `${size}px`, '--team': color } as CSSProperties}>
      {uri && !broken ? (
        <img src={uri} alt={name} onError={() => setBroken(true)} />
      ) : (
        <div className="ini">
          <span className="cin-metal">{initialsOf(name)}</span>
        </div>
      )}
      <div className="rim" />
      <div className="nm">
        {name}
        {role === 'lead' ? <span className="rl">Team lead</span> : null}
      </div>
    </div>
  );
}

/** The team's project photo in a glowing frame. Renders nothing if there is no photo (or it fails to load). */
function ProjectShot({
  team,
  width,
  color,
  from = 'left',
  delay,
}: {
  team: PublicTeam;
  width: number;
  color: string;
  from?: 'left' | 'right';
  delay?: string;
}) {
  const uri = imageUri(team.imageUrl ?? team.posterUrl);
  const [broken, setBroken] = useState(false);
  if (!uri || broken) return null;
  return (
    <div
      className={`cin-proj ${from === 'right' ? 'right' : ''}`}
      style={{ '--pw': `${width}px`, '--medal': color, animationDelay: delay } as CSSProperties}
    >
      <img src={uri} alt={team.projectTitle} onError={() => setBroken(true)} />
    </div>
  );
}

function PlaceReveal({ entry, since, w, h, maxPerJudge }: { entry: ShowEntry; since: number; w: number; h: number; maxPerJudge: number | null }) {
  const people = publicMembers(entry.team);
  const color = teamColorOf(entry.team);
  const medal = MEDAL_COLOR[entry.rank]!;
  // Teammates land one every 2 beats, starting 2 beats after the hit.
  const shown = since >= 2 ? Math.floor((since - 2) / 2) + 1 : 0;
  const n = Math.max(1, people.length);
  const card = Math.min(w * 0.14, (w * 0.86) / n - w * 0.018, (h * 0.28) / 1.36);
  const hasShot = !!(entry.team.imageUrl ?? entry.team.posterUrl);
  const shotW = Math.min(w * 0.3, h * 0.3 * 1.6);
  return (
    <div className="cin-center" style={{ justifyContent: 'flex-start', paddingTop: h * 0.09 }}>
      <div className="cin-rule cin-caps cin-rise" style={{ fontSize: h * 0.026, color: medal }}>
        {PLACE_WORD[entry.rank]}
      </div>
      <div style={{ height: h * 0.02 }} />
      <div className="cin-slam">
        <Metal cls={`${METAL_CLASS[entry.rank]} cin-shine`} size={fit(entry.team.name, w, h, entry.rank === 1 ? 0.14 : 0.13)}>
          {entry.team.name}
        </Metal>
      </div>
      <div style={{ height: h * 0.028 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: w * 0.03, maxWidth: w * 0.9 }}>
        {hasShot ? <ProjectShot team={entry.team} width={shotW} color={medal} delay=".3s" /> : null}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: hasShot ? 'flex-start' : 'center',
            textAlign: hasShot ? 'left' : 'center',
            maxWidth: hasShot ? w * 0.42 : w * 0.8,
          }}
        >
          {hasShot ? (
            <div className="cin-caps cin-rise" style={{ fontSize: h * 0.017, color: medal, letterSpacing: '.5em', animationDelay: '.45s' }}>
              The project
            </div>
          ) : null}
          <div
            className="cin-caps cin-rise"
            style={{
              fontSize: h * (hasShot ? 0.034 : 0.026),
              lineHeight: 1.25,
              letterSpacing: '.12em',
              color: '#eef3fa',
              fontWeight: 500,
              marginTop: h * 0.01,
              animationDelay: '.55s',
            }}
          >
            {entry.team.projectTitle}
          </div>
          <div className="cin-caps cin-rise" style={{ fontSize: h * 0.022, color: medal, marginTop: h * 0.018, animationDelay: '.8s' }}>
            Score {formatAverage(entry.average)}
            {maxPerJudge ? ` / ${maxPerJudge}` : ''}
          </div>
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <div className="cin-heroes" style={{ marginBottom: h * 0.085 }}>
        {people.map((p, i) =>
          i < shown ? (
            <Hero key={`${p.name}-${i}`} name={p.name} photoUrl={p.photoUrl} color={color} size={card} role={p.role} />
          ) : (
            <div key={`${p.name}-${i}`} className="cin-hero ghost" style={{ '--w': `${card}px` } as CSSProperties} />
          ),
        )}
      </div>
    </div>
  );
}

function Finale({ byRank, w, h }: { byRank: Map<number, ShowEntry>; w: number; h: number }) {
  const order = [2, 1, 3].map((r) => byRank.get(r)).filter((e): e is ShowEntry => !!e);
  const colW = w * 0.3;
  return (
    <div className="cin-center" style={{ justifyContent: 'flex-start', paddingTop: h * 0.085 }}>
      <Metal cls="cin-gold cin-shine cin-zoom" size={fit('Champions', w, h, 0.11)}>
        Champions
      </Metal>
      <div className="cin-caps cin-rise" style={{ fontSize: h * 0.019, color: '#ffe3a1', marginTop: h * 0.012, animationDelay: '.5s' }}>
        Tech Arena · Project Expo 2026
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: w * 0.02, marginBottom: h * 0.105 }}>
        {order.map((e, i) => {
          const people = publicMembers(e.team);
          const big = e.rank === 1;
          const card = Math.min((colW * (big ? 1 : 0.92)) / Math.max(1, people.length) - 8, h * (big ? 0.13 : 0.11));
          return (
            <div
              key={e.team.id}
              className="cin-rise"
              style={{ width: colW, display: 'flex', flexDirection: 'column', alignItems: 'center', animationDelay: `${0.4 + i * 0.35}s` }}
            >
              <div className="cin-caps" style={{ fontSize: h * 0.018, color: MEDAL_COLOR[e.rank], marginBottom: h * 0.012 }}>
                {PLACE_WORD[e.rank]}
              </div>
              <ProjectShot
                team={e.team}
                width={colW * (big ? 0.7 : 0.58)}
                color={MEDAL_COLOR[e.rank]!}
                from={i === 0 ? 'left' : 'right'}
                delay={`${0.5 + i * 0.35}s`}
              />
              <div style={{ height: h * 0.018 }} />
              <Metal
                cls={`${METAL_CLASS[e.rank]} cin-shine`}
                size={Math.min(h * (big ? 0.06 : 0.045), (colW * 0.95) / Math.max(4, e.team.name.length * 0.8))}
              >
                {e.team.name}
              </Metal>
              <div className="cin-heroes" style={{ gap: 8, marginTop: h * 0.02 }}>
                {people.map((p, j) => (
                  <Hero key={`${p.name}-${j}`} name={p.name.split(' ')[0] ?? p.name} photoUrl={p.photoUrl} color={teamColorOf(e.team)} size={card} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
