import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useWindowDimensions } from 'react-native';

import { imageUri } from '@/api/client';
import type { PublicTeam } from '@/api/types';
import { publicMembers } from '@/features/team/people';
import { formatAverage } from '@/lib/format';
import { teamColorOf } from '@/lib/teamColor';

import { CINEMA_CSS, CINEMA_FONTS } from './cinemaCss';
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
  /** Small operator line at the bottom (e.g. publish status). */
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
const PLACE_WORD: Record<number, string> = { 1: 'First place', 2: 'Second place', 3: 'Third place' };
const METAL_CLASS: Record<number, string> = { 1: 'cin-gold', 2: 'cin-silver', 3: 'cin-bronze' };
const MEDAL_COLOR: Record<number, string> = { 1: '#ffd36b', 2: '#cfd8e6', 3: '#e59a62' };

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
    if (!document.getElementById('cin-css')) {
      const s = document.createElement('style');
      s.id = 'cin-css';
      s.textContent = CINEMA_CSS;
      document.head.appendChild(s);
    }
  }, []);
}

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

/** Full-screen, music-synced, cinematic podium reveal for the projector. Driven by the audio clock. */
export function BigReveal({ entries, tracks, cues, eventName, maxPerJudge, onChampion, status, onExit }: BigRevealProps) {
  useCinemaStyles();
  const { width, height } = useWindowDimensions();
  // Places revealed in this order: 3rd, 2nd, 1st (whichever exist).
  const places = useMemo(() => [...entries].filter((e) => e.rank >= 1 && e.rank <= 3).sort((a, b) => b.rank - a.rank), [entries]);

  const [stage, setStage] = useState<Stage>({ kind: 'ready' });
  const [tick, setTick] = useState<Tick>({ n: null, revealed: false, beat: -999 });
  const [fx, setFx] = useState<{ id: number; gold: boolean; big: boolean }>({ id: 0, gold: false, big: false });
  const [sparks, setSparks] = useState(0);
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const tickRef = useRef(tick);
  tickRef.current = tick;
  const camRef = useRef<HTMLDivElement | null>(null);

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
    const pending = timers.current;
    return () => {
      fadeMap.forEach(clearInterval);
      Object.values(made).forEach((a) => a?.pause());
      pending.forEach(clearTimeout);
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

  /** Flash + shockwave + lens flare + camera shake. */
  const hit = (gold: boolean, big: boolean) => {
    setFx((f) => ({ id: f.id + 1, gold, big }));
    const cam = camRef.current;
    if (cam?.animate) {
      const a = big ? 16 : 9;
      cam.animate(
        [
          { transform: 'translate3d(0,0,0)' },
          { transform: `translate3d(${-a}px,${a * 0.6}px,0) scale(1.02)` },
          { transform: `translate3d(${a}px,${-a * 0.6}px,0) scale(1.02)` },
          { transform: `translate3d(${-a * 0.6}px,${a * 0.4}px,0)` },
          { transform: `translate3d(${a * 0.4}px,${-a * 0.2}px,0)` },
          { transform: 'translate3d(0,0,0)' },
        ],
        { duration: big ? 800 : 600, easing: 'cubic-bezier(.36,.07,.19,.97)' },
      );
    }
  };

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

  // Countdown hits 0: big hit, "THE TOP 3", then on to the first place.
  useEffect(() => {
    if (stage.kind !== 'countdown' || tick.n !== 0) return;
    hit(false, true);
    setSparks((x) => x + 1);
    timers.current.push(setTimeout(() => setStage({ kind: 'top3' }), 1600));
    timers.current.push(
      setTimeout(() => {
        if (stageRef.current.kind === 'top3') goPlace(0);
      }, 5200),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.kind, tick.n]);

  // Reveal moments.
  const current = stage.kind === 'place' ? places[stage.idx] : undefined;
  const memberCount = current ? publicMembers(current.team).length : 0;
  useEffect(() => {
    if (!current || !tick.revealed) return;
    if (tick.beat === 0) {
      hit(current.rank === 1, current.rank === 1);
      setSparks((x) => x + 1);
    }
    if (current.rank === 1) {
      if (!championFired.current) {
        championFired.current = true;
        onChampion?.();
      }
      if (tick.beat === memberCount + 1) setSparks((x) => x + 1);
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
      else {
        hit(true, false);
        setSparks((x) => x + 1);
        setStage({ kind: 'finale' });
      }
    }
  };
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

  // ---- Look ----------------------------------------------------------------------------------
  const revealed = stage.kind === 'place' && tick.revealed && !!current;
  const champ = (current?.rank === 1 && stage.kind === 'place') || stage.kind === 'finale';
  const glow = revealed && current ? `${teamColorOf(current.team)}55` : champ ? '#5a3a0a' : stage.kind === 'top3' ? '#4a3208' : '#0d2a66';
  const raysOn = (champ && (revealed || stage.kind === 'finale')) || stage.kind === 'top3' || (current?.rank === 1 && !tick.revealed);
  const backdrop = revealed && current?.team.imageUrl ? imageUri(current.team.imageUrl) : null;
  const wide = revealed || stage.kind === 'finale' || stage.kind === 'top3';
  const emberTone: 'cool' | 'warm' | 'gold' = champ ? 'gold' : revealed ? 'warm' : 'cool';

  let body: ReactNode = null;
  if (stage.kind === 'ready') {
    body = (
      <div className="cin-center">
        <Emblem size={height * 0.78} fast={false} opacity={0.35} />
        <div className="cin-caps cin-track" style={{ fontSize: height * 0.026, color: '#a9bedf' }}>
          {eventName} presents
        </div>
        <div style={{ height: height * 0.03 }} />
        <Metal cls="cin-metal cin-shine cin-zoom" size={fit('The Results', width, height, 0.16)}>
          The Results
        </Metal>
        <div style={{ height: height * 0.03 }} />
        <div className="cin-caps cin-rise" style={{ fontSize: height * 0.022, color: '#8ea3c4', animationDelay: '.8s' }}>
          Project Expo 2026
        </div>
        <div className="cin-caps" style={{ position: 'absolute', bottom: height * 0.16, fontSize: 12, opacity: 0.35, letterSpacing: '.3em' }}>
          Press space to begin
        </div>
      </div>
    );
  } else if (stage.kind === 'countdown') {
    const n = tick.n;
    body = (
      <div className="cin-center">
        <Emblem size={height * 0.8} fast opacity={n === null ? 0.3 : 0.55} />
        {n === null ? (
          <Pulse beat={tick.beat}>
            <Metal cls="cin-metal cin-track" size={fit('Get ready', width, height, 0.09, 1.1)} style={{ letterSpacing: '.3em' }}>
              Get ready
            </Metal>
          </Pulse>
        ) : (
          <div key={`n${n}`} className={`cin-num ${n === 0 ? 'zero' : ''}`} style={{ position: 'relative' }}>
            <Metal cls={n <= 3 ? 'cin-gold cin-shine' : 'cin-metal cin-shine'} size={height * (n === 0 ? 0.6 : 0.52)}>
              {String(n)}
            </Metal>
          </div>
        )}
        {n !== null && n > 0 ? <div key={`r${n}`} className="cin-ring" style={{ '--accent': n <= 3 ? '#ffbf47' : '#7fb0ff', opacity: 0.6 } as CSSProperties} /> : null}
      </div>
    );
  } else if (stage.kind === 'top3') {
    body = (
      <div className="cin-center">
        <div className="cin-caps cin-track" style={{ fontSize: height * 0.03, color: '#ffe3a1' }}>
          Presenting
        </div>
        <div style={{ height: height * 0.02 }} />
        <Metal cls="cin-gold cin-shine cin-zoom" size={fit('The Top 3', width, height, 0.2)}>
          The Top 3
        </Metal>
      </div>
    );
  } else if (stage.kind === 'place' && current) {
    body = revealed ? (
      <PlaceReveal entry={current} beat={tick.beat} w={width} h={height} maxPerJudge={maxPerJudge} />
    ) : (
      <div className="cin-center">
        <Pulse beat={tick.beat}>
          {current.rank === 1 ? (
            <>
              <div className="cin-caps cin-track" style={{ fontSize: height * 0.032, color: '#ffe3a1' }}>
                And the
              </div>
              <div style={{ height: height * 0.02 }} />
              <Metal cls="cin-gold cin-shine cin-zoom" size={fit('Champion is', width, height, 0.15)}>
                Champion is
              </Metal>
            </>
          ) : (
            <>
              <div className="cin-caps cin-track" style={{ fontSize: height * 0.03, color: '#a9bedf' }}>
                In
              </div>
              <div style={{ height: height * 0.02 }} />
              <Metal cls={`${METAL_CLASS[current.rank]} cin-zoom`} size={fit(PLACE_WORD[current.rank]!, width, height, 0.14)}>
                {PLACE_WORD[current.rank]!}
              </Metal>
            </>
          )}
        </Pulse>
      </div>
    );
  } else if (stage.kind === 'finale') {
    body = <Finale places={places} w={width} h={height} />;
  }

  const waiting = stage.kind === 'place' && tick.revealed;
  const hint = [
    status,
    waiting && stage.kind === 'place' ? (stage.idx + 1 < places.length ? 'Space · next place' : 'Space · champions') : null,
    'Esc · exit',
  ]
    .filter(Boolean)
    .join('     ·     ');

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className={`cin-root ${wide ? 'wide' : ''}`} onClick={() => nextRef.current()}>
      <div className="cin-cam" ref={camRef}>
        <div className="cin-bg" style={{ '--glow': glow } as CSSProperties} />
        <div
          key={backdrop ?? 'none'}
          className={`cin-backdrop ${backdrop ? 'on' : ''}`}
          style={backdrop ? { backgroundImage: `url("${backdrop}")` } : undefined}
        />
        <div className="cin-smoke">
          <i />
          <i />
          <i />
        </div>
        <div className={`cin-rays ${raysOn ? 'on' : ''}`} />
        <Embers tone={emberTone} burst={sparks} />
        {body}
        <div className="cin-vig" />
      </div>
      {fx.id > 0 ? (
        <div key={fx.id} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div className="cin-flash" style={fx.big ? undefined : { animationDuration: '.7s' }} />
          <div className="cin-ring" style={{ '--accent': fx.gold ? '#ffc04a' : '#8fbaff' } as CSSProperties} />
          <div className="cin-ring late" style={{ '--accent': fx.gold ? '#fff0c0' : '#d8e8ff' } as CSSProperties} />
          <div className={`cin-flare ${fx.gold ? 'gold' : ''}`} />
        </div>
      ) : null}
      <div className="cin-grain" />
      <div className="cin-bar top" />
      <div className="cin-bar bot" />
      <div className="cin-op">{hint}</div>
    </div>,
    document.body,
  );
}

// ---- Pieces --------------------------------------------------------------------------------------

/** Bumps (scale + brightness) on every beat without remounting its children. */
function Pulse({ beat, children }: { beat: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (beat <= -999) return;
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

function Metal({ cls, size, children, style }: { cls: string; size: number; children: string; style?: CSSProperties }) {
  return (
    <div className={cls} data-text={children} style={{ fontSize: size, ...style }}>
      {children}
    </div>
  );
}

/** Original Tech Arena emblem: a machined ring with tick marks (rotates slowly). */
function Emblem({ size, fast, opacity }: { size: number; fast: boolean; opacity: number }) {
  const ticks = Array.from({ length: 72 }, (_, i) => i);
  return (
    <div
      className={`cin-emblem ${fast ? 'fast' : ''}`}
      style={{ width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2, opacity, transition: 'opacity 1s' }}
    >
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

/** Floating embers, plus a spark burst whenever `burst` changes. Additive canvas. */
function Embers({ tone, burst }: { tone: 'cool' | 'warm' | 'gold'; burst: number }) {
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
    };
  }, []);

  useEffect(() => {
    if (!burst || !ref.current) return;
    const dpr = window.devicePixelRatio || 1;
    const W = ref.current.width;
    const H = ref.current.height;
    const gold = toneRef.current === 'gold';
    for (let i = 0; i < (gold ? 420 : 260); i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (200 + Math.random() * (gold ? 900 : 650)) * dpr;
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
  }, [burst]);

  return <canvas ref={ref} className="cin-canvas" style={{ width: '100%', height: '100%' }} />;
}

/** Largest Cinzel caps size (px) at which `text` fits 86% of the screen width, capped at `maxH` of the height. */
function fit(text: string, w: number, h: number, maxH: number, spacing = 0.92): number {
  return Math.min(h * maxH, (w * 0.86) / Math.max(4, text.length * spacing));
}
const nameSize = (name: string, w: number, h: number, maxH: number) => fit(name, w, h, maxH);

function Hero({ name, photoUrl, color, size, role }: { name: string; photoUrl: string | null; color: string; size: number; role?: string | null }) {
  const uri = imageUri(photoUrl);
  const [broken, setBroken] = useState(false);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
  return (
    <div className="cin-hero" style={{ '--w': `${size}px`, '--team': color } as CSSProperties}>
      {uri && !broken ? (
        <img src={uri} alt={name} onError={() => setBroken(true)} />
      ) : (
        <div className="ini">
          <span className="cin-metal">{initials}</span>
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

function PlaceReveal({ entry, beat, w, h, maxPerJudge }: { entry: ShowEntry; beat: number; w: number; h: number; maxPerJudge: number | null }) {
  const people = publicMembers(entry.team);
  const color = teamColorOf(entry.team);
  const shown = Math.max(0, beat);
  const n = Math.max(1, people.length);
  const card = Math.min(w * 0.16, (w * 0.86) / n - w * 0.018, (h * 0.42) / 1.36);
  const metal = METAL_CLASS[entry.rank] ?? 'cin-metal';
  return (
    <div className="cin-center" style={{ justifyContent: 'flex-start', paddingTop: h * 0.1 }}>
      <div className="cin-rule cin-caps cin-rise" style={{ fontSize: h * 0.026, color: MEDAL_COLOR[entry.rank] }}>
        {PLACE_WORD[entry.rank]}
      </div>
      <div style={{ height: h * 0.025 }} />
      <div className="cin-slam">
        <Metal cls={`${metal} cin-shine`} size={nameSize(entry.team.name, w, h, entry.rank === 1 ? 0.17 : 0.15)}>
          {entry.team.name}
        </Metal>
      </div>
      <div style={{ height: h * 0.022 }} />
      <div
        className="cin-caps cin-rise"
        style={{ fontSize: h * 0.024, letterSpacing: '.22em', color: '#dfe7f3', fontWeight: 400, maxWidth: w * 0.8, animationDelay: '.35s' }}
      >
        {entry.team.projectTitle}
      </div>
      <div style={{ height: h * 0.012 }} />
      <div className="cin-caps cin-rise" style={{ fontSize: h * 0.02, color: MEDAL_COLOR[entry.rank], animationDelay: '.6s' }}>
        Score {formatAverage(entry.average)}
        {maxPerJudge ? ` / ${maxPerJudge}` : ''}
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

function Finale({ places, w, h }: { places: ShowEntry[]; w: number; h: number }) {
  const order = [2, 1, 3].map((r) => places.find((p) => p.rank === r)).filter((e): e is ShowEntry => !!e);
  const colW = w * 0.3;
  return (
    <div className="cin-center" style={{ justifyContent: 'flex-start', paddingTop: h * 0.09 }}>
      <Metal cls="cin-gold cin-shine cin-zoom" size={fit('Champions', w, h, 0.13)}>
        Champions
      </Metal>
      <div className="cin-caps cin-rise" style={{ fontSize: h * 0.02, color: '#ffe3a1', marginTop: h * 0.015, animationDelay: '.5s' }}>
        Tech Arena · Project Expo 2026
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: w * 0.02, marginBottom: h * 0.09 }}>
        {order.map((e, i) => {
          const people = publicMembers(e.team);
          const big = e.rank === 1;
          const card = Math.min((colW * (big ? 1.05 : 0.9)) / Math.max(1, people.length) - 8, h * (big ? 0.2 : 0.16));
          return (
            <div
              key={e.team.id}
              className="cin-rise"
              style={{ width: colW, display: 'flex', flexDirection: 'column', alignItems: 'center', animationDelay: `${0.4 + i * 0.35}s` }}
            >
              <div className="cin-caps" style={{ fontSize: h * 0.018, color: MEDAL_COLOR[e.rank], marginBottom: h * 0.01 }}>
                {PLACE_WORD[e.rank]}
              </div>
              <Metal
                cls={`${METAL_CLASS[e.rank]} cin-shine`}
                size={Math.min(h * (big ? 0.07 : 0.05), (colW * 0.95) / Math.max(4, e.team.name.length * 0.8))}
              >
                {e.team.name}
              </Metal>
              <div className="cin-heroes" style={{ gap: 8, marginTop: h * 0.025 }}>
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
