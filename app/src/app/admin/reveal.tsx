import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import type { LeaderboardEntry, PublicTeam } from '@/api/types';
import { AppText, Banner, Button, Card, EmptyState, ErrorView, LoadingView, Screen, SectionTitle, TextField } from '@/components';
import { BigReveal, type ShowEntry } from '@/features/reveal/BigReveal';
import {
  DEFAULT_TIMES,
  deleteSong,
  fmtTime,
  loadSong,
  loadTimes,
  MOMENT_LABEL,
  MOMENTS,
  pickAudioFile,
  saveSong,
  saveTimes,
  timelineProblems,
  type MomentKey,
  type ShowTimes,
  type StoredTrack,
} from '@/features/reveal/trackStore';
import { useApi, useConfig } from '@/hooks';
import { plural, toApiError } from '@/lib';
import { colors, fonts, palette, spacing } from '@/theme';

const MOMENT_HINT: Record<MomentKey, string> = {
  countdown: 'The big 10 appears. The numbers count down on the beat of the song.',
  zero: '0 slams in with a flash and a burst of sparks.',
  congrats: '"Congratulations to the winning teams, in advance!"',
  top3: '"And the top 3 teams are…" while three shields (III, II, I) light up.',
  build3: 'Suspense: a charging ring, scrambling letters and a spinning starburst that speeds up. Lights dim just before the hit.',
  third: '3rd place slams in (POW!) in the team\'s own colour with the project photo; teammate photos land every 2 beats.',
  second: 'A short "In second place…" teaser plays 2 seconds before this.',
  build1: 'Suspense for the champion, in gold. Lights dim just before the hit.',
  first: 'The champion. Results publish to every phone at this moment (if ticked below).',
  finale: 'All 3 winners, each in their team colour with project photo and teammates, until the song ends.',
};

const MYSTERY_COLORS = ['#7B3FE4', '#1E5BFF', '#E4002B'];

/** A "classified" placeholder project image, so rehearsals show the photo frame too. */
function mysteryImage(color: string, rank: number): string {
  const lines = Array.from({ length: 9 }, (_, i) => `<line x1='${i * 40}' y1='0' x2='${i * 40 - 120}' y2='200'/>`).join('');
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 200'>` +
    `<defs><radialGradient id='g' cx='.5' cy='.45' r='.8'><stop offset='0' stop-color='${color}'/><stop offset='1' stop-color='#03050b'/></radialGradient></defs>` +
    `<rect width='320' height='200' fill='url(#g)'/><g stroke='rgba(255,255,255,.12)' stroke-width='10'>${lines}</g>` +
    `<rect x='36' y='78' width='248' height='44' fill='rgba(0,0,0,.55)' stroke='#fff' stroke-width='2'/>` +
    `<text x='160' y='108' font-family='Georgia,serif' font-size='20' font-weight='bold' fill='#fff' text-anchor='middle' letter-spacing='4'>CLASSIFIED ${rank}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function mysteryTeam(rank: number): ShowEntry {
  const color = MYSTERY_COLORS[rank - 1] ?? '#1E5BFF';
  const team: PublicTeam = {
    id: `mystery-${rank}`,
    name: `Mystery Team ${rank}`,
    projectTitle: 'A top secret project (rehearsal)',
    projectDesc: '',
    imageUrl: mysteryImage(color, rank),
    posterUrl: null,
    color,
    orderPosition: null,
    memberNames: ['Agent One', 'Agent Two', 'Agent Three'],
    members: ['Agent One', 'Agent Two', 'Agent Three'].map((name, i) => ({ name, role: i === 0 ? 'lead' : 'member', photoUrl: null })),
  };
  return { rank, team, average: 30 - rank * 1.5 };
}

function podiumOf(teams: LeaderboardEntry[]): { entries: ShowEntry[]; tied: boolean } {
  const top = teams.filter((t) => t.rank !== null && t.rank <= 3);
  return {
    entries: top.map((t) => ({ rank: t.rank!, team: t.team, average: t.average })),
    tied: top.some((t) => t.tied) || new Set(top.map((t) => t.rank)).size !== top.length,
  };
}

export default function RevealScreen() {
  if (Platform.OS !== 'web') {
    return (
      <Screen title="Big screen reveal" backHref="/admin/results">
        <EmptyState
          icon="tv-outline"
          title="Open this on the projector laptop"
          message="The music reveal runs in a web browser (Chrome works best). Sign in as Admin on the laptop connected to the projector."
        />
      </Screen>
    );
  }
  return <RevealSetup />;
}

function RevealSetup() {
  const { config } = useConfig();
  const board = useApi(() => api.leaderboard());
  const overview = useApi(() => api.adminOverview());

  const [song, setSong] = useState<StoredTrack | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [times, setTimes] = useState<ShowTimes>(() => loadTimes());
  const [storeError, setStoreError] = useState<string | null>(null);
  const [publishOn, setPublishOn] = useState(true);
  const [show, setShow] = useState<{ entries: ShowEntry[]; rehearsal: boolean } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const url = useMemo(() => (song ? URL.createObjectURL(song.blob) : null), [song]);
  useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url]);

  useEffect(() => {
    loadSong()
      .then(setSong)
      .catch((e: unknown) => setStoreError(e instanceof Error ? e.message : 'Could not read the saved song.'));
  }, []);

  useEffect(() => {
    setDuration(null);
    if (!url) return;
    const a = new Audio(url);
    a.preload = 'metadata';
    a.onloadedmetadata = () => setDuration(a.duration);
  }, [url]);

  useEffect(() => saveTimes(times), [times]);

  // ---- Preview player --------------------------------------------------------------------------
  const preview = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [clock, setClock] = useState(0);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setClock(preview.current?.currentTime ?? 0), 100);
    return () => clearInterval(id);
  }, [playing]);
  useEffect(() => () => preview.current?.pause(), []);

  const stopPreview = () => {
    preview.current?.pause();
    setPlaying(false);
  };
  const playFrom = (at: number) => {
    if (!url) return;
    preview.current?.pause();
    const a = new Audio(url);
    a.currentTime = Math.max(0, at);
    a.onended = () => setPlaying(false);
    preview.current = a;
    setPlaying(true);
    setClock(a.currentTime);
    void a.play().catch(() => setPlaying(false));
  };

  const setTime = (k: keyof ShowTimes, v: number) => setTimes((t) => ({ ...t, [k]: v }));

  const choose = async () => {
    const file = await pickAudioFile();
    if (!file) return;
    stopPreview();
    try {
      await saveSong(file);
      setSong({ name: file.name, blob: file });
      setStoreError(null);
    } catch (e) {
      setStoreError(e instanceof Error ? e.message : 'Could not save the file in this browser.');
    }
  };
  const remove = async () => {
    stopPreview();
    await deleteSong().catch(() => {});
    setSong(null);
  };

  // ---- Start -----------------------------------------------------------------------------------
  const published = overview.data?.resultsPublished ?? false;
  const pending = overview.data ? Math.max(0, overview.data.expectedEvaluations - overview.data.evaluations) : 0;
  const podium = board.data ? podiumOf(board.data.teams) : null;
  const problems = timelineProblems(times, duration ?? undefined);

  const start = async (rehearsal: boolean) => {
    stopPreview();
    setStartError(null);
    setStatus(rehearsal ? 'REHEARSAL · nothing is published' : null);
    if (rehearsal) {
      setShow({ entries: [3, 2, 1].map(mysteryTeam), rehearsal });
      return;
    }
    setStarting(true);
    try {
      const fresh = await api.leaderboard();
      const p = podiumOf(fresh.teams);
      if (p.entries.length === 0) throw new Error('No team has been scored yet.');
      if (p.tied) throw new Error('There is a tie in the top 3. The judges must decide it first (Judge app, Progress screen).');
      setShow({ entries: p.entries, rehearsal });
    } catch (e) {
      setStartError(toApiError(e).message);
    } finally {
      setStarting(false);
    }
  };

  const onChampion = () => {
    if (!show || show.rehearsal || published || !publishOn) return;
    setStatus('Publishing…');
    api
      .publishResults({ force: pending > 0 })
      .then(() => {
        setStatus('Published to every phone');
        void overview.reload();
      })
      .catch((e: unknown) => {
        const err = toApiError(e);
        setStatus(err.code === 'RESULTS_PUBLISHED' ? 'Already published' : `NOT published: ${err.message}`);
      });
  };

  if (board.loading || overview.loading) {
    return (
      <Screen title="Big screen reveal" backHref="/admin/results">
        <LoadingView />
      </Screen>
    );
  }
  if (!board.data) {
    return (
      <Screen title="Big screen reveal" backHref="/admin/results">
        <ErrorView error={board.error} onRetry={board.refresh} />
      </Screen>
    );
  }

  return (
    <Screen title="Big screen reveal" subtitle="One song, every moment on the beat" backHref="/admin/results">
      <Card tone="accent">
        <AppText variant="bodyStrong">How it works</AppText>
        <AppText color="textSecondary" style={styles.para}>
          Load your song below. On the night, press Start on the projector laptop and then SPACE: it goes full screen and the
          whole show plays to the song by itself. Countdown, congratulations, the top 3, suspense, then 3rd, 2nd and 1st place
          with their project photos and team photos, and all 3 winners together at the end.
        </AppText>
        <View style={styles.lockRow}>
          <Ionicons name="lock-closed" size={14} color={colors.textSecondary} />
          <AppText variant="caption" color="textSecondary" style={styles.flex}>
            The song stays in this browser on this laptop. It is never uploaded.
          </AppText>
        </View>
      </Card>

      {storeError ? <Banner type="error" message={storeError} onClose={() => setStoreError(null)} /> : null}

      <SectionTitle title="Song" />
      <Card bandColor={palette.red}>
        {song ? (
          <>
            <View style={styles.fileRow}>
              <Ionicons name="musical-notes" size={18} color={palette.ink} />
              <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
                {song.name}
              </AppText>
              {duration ? (
                <AppText variant="caption" color="muted">
                  {fmtTime(duration)}
                </AppText>
              ) : null}
            </View>
            <View style={styles.player}>
              <AppText style={styles.clock}>{playing ? fmtTime(clock) : '–:––'}</AppText>
              {playing ? (
                <Button title="Stop" icon="stop" variant="secondary" size="sm" fullWidth={false} onPress={stopPreview} />
              ) : (
                <>
                  <Button title="Play the show part" icon="play" variant="secondary" size="sm" fullWidth={false} onPress={() => playFrom(times.countdown - 1.6)} />
                  <Button title="From 0:00" icon="refresh" variant="ghost" size="sm" fullWidth={false} onPress={() => playFrom(0)} />
                </>
              )}
            </View>
            <View style={styles.fileActions}>
              <Button title="Replace file" icon="swap-horizontal" variant="ghost" size="sm" fullWidth={false} onPress={() => void choose()} />
              <Button title="Remove" icon="trash-outline" variant="ghost" size="sm" fullWidth={false} onPress={() => void remove()} />
            </View>
          </>
        ) : (
          <>
            <AppText color="textSecondary">Pick the song from this laptop (MP3, M4A or WAV).</AppText>
            <Button title="Choose song" icon="musical-notes-outline" variant="secondary" onPress={() => void choose()} style={styles.choose} />
          </>
        )}
      </Card>

      <SectionTitle title="Timeline" />
      <Card>
        <AppText color="textSecondary">
          Times are in seconds from the start of the song. They are already tuned to your song: every moment sits on the beat
          nearest the time you asked for. To change one, type the seconds, or play the song and press Now at the right moment.
        </AppText>
        {MOMENTS.map((k) => (
          <MomentRow
            key={k}
            label={MOMENT_LABEL[k]}
            hint={MOMENT_HINT[k]}
            value={times[k]}
            canPlay={!!song}
            playing={playing}
            onChange={(v) => setTime(k, v)}
            onHear={() => playFrom(Math.max(0, times[k] - 3))}
            onNow={() => setTime(k, Math.round(clock * 100) / 100)}
          />
        ))}
        <View style={styles.cueRow}>
          <CueField label="Beat (BPM)" value={times.bpm} onChange={(v) => setTime('bpm', Math.max(30, Math.min(240, v || 120)))} />
          <CueField label="A beat lands at (s)" value={times.beat} onChange={(v) => setTime('beat', v)} />
        </View>
        <AppText variant="caption" color="muted" style={styles.para}>
          The beat grid makes the countdown numbers, pulses and team photos land on the music.
        </AppText>
        {problems.map((p) => (
          <Banner key={p} type="warning" message={p} />
        ))}
        <View style={styles.fileActions}>
          <Button title="Reset to the tuned times" icon="refresh" variant="ghost" size="sm" fullWidth={false} onPress={() => setTimes({ ...DEFAULT_TIMES })} />
        </View>
      </Card>

      <SectionTitle title="Showtime" />
      <Card>
        {published ? (
          <Banner type="info" message="Results are already published. The show uses the published top 3." />
        ) : (
          <Pressable style={styles.check} onPress={() => setPublishOn((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: publishOn }}>
            <Ionicons name={publishOn ? 'checkbox' : 'square-outline'} size={24} color={publishOn ? palette.red : colors.textSecondary} />
            <View style={styles.flex}>
              <AppText variant="bodyStrong">Publish to everyone&apos;s phones the moment 1st place is revealed</AppText>
              <AppText variant="caption" color="textSecondary">
                {pending > 0
                  ? `Judging is not finished: ${plural(pending, 'evaluation')} missing. They will be ignored (force publish).`
                  : 'Judging is complete.'}
              </AppText>
            </View>
          </Pressable>
        )}
        {podium?.tied ? <Banner type="error" message="There is a tie in the top 3. The judges must decide it before the show." /> : null}
        {podium && podium.entries.length === 0 ? <Banner type="warning" message="No team has been scored yet. Use the rehearsal to test your song." /> : null}
        {!song ? <Banner type="warning" message="No song loaded. The show would run silently on a timer." /> : null}
        {problems.length ? <Banner type="warning" message="Fix the timeline warnings above first." /> : null}
        {startError ? <Banner type="error" message={startError} onClose={() => setStartError(null)} /> : null}
        <View style={styles.startRow}>
          <Button
            title="Start the show"
            icon="play"
            size="lg"
            loading={starting}
            disabled={!!podium?.tied || problems.length > 0}
            onPress={() => start(false)}
            style={styles.flex}
          />
          <Button
            title="Rehearse (mystery teams)"
            icon="eye-off-outline"
            variant="secondary"
            size="lg"
            disabled={problems.length > 0}
            onPress={() => start(true)}
            style={styles.flex}
          />
        </View>
        <AppText variant="caption" color="muted" style={styles.para}>
          Keys: SPACE = start · P = pause / resume · SHIFT + ← / → = jump 5 s (rehearsal) · ESC = exit. Test the laptop sound on
          the hall speakers first.
        </AppText>
      </Card>

      {show ? (
        <BigReveal
          entries={show.entries}
          song={url}
          times={times}
          eventName={config?.eventName || 'Tech Arena'}
          maxPerJudge={config?.maxPerJudge ?? null}
          onChampion={onChampion}
          status={status}
          onExit={() => {
            setShow(null);
            void overview.reload();
          }}
        />
      ) : null}
    </Screen>
  );
}

function num(v: string, fallback: number): number {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : fallback;
}

function CueField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <View style={styles.cueField}>
      <TextField
        label={label}
        value={text}
        onChangeText={setText}
        onBlur={() => onChange(num(text, value))}
        onSubmitEditing={() => onChange(num(text, value))}
        containerStyle={styles.noMargin}
      />
    </View>
  );
}

function MomentRow({
  label,
  hint,
  value,
  canPlay,
  playing,
  onChange,
  onHear,
  onNow,
}: {
  label: string;
  hint: string;
  value: number;
  canPlay: boolean;
  playing: boolean;
  onChange: (v: number) => void;
  onHear: () => void;
  onNow: () => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => onChange(num(text, value));
  return (
    <View style={styles.moment}>
      <View style={styles.momentText}>
        <AppText variant="bodyStrong">
          {label} <AppText color="muted">· {fmtTime(value)}</AppText>
        </AppText>
        <AppText variant="caption" color="textSecondary">
          {hint}
        </AppText>
      </View>
      <View style={styles.momentControls}>
        <View style={styles.momentField}>
          <TextField label="Seconds" value={text} onChangeText={setText} onBlur={commit} onSubmitEditing={commit} containerStyle={styles.noMargin} />
        </View>
        {canPlay ? <Button title="Hear" icon="headset-outline" variant="ghost" size="sm" fullWidth={false} onPress={onHear} /> : null}
        {playing ? <Button title="Now" icon="flash" size="sm" fullWidth={false} onPress={onNow} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  para: { marginTop: spacing.xs },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  player: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  clock: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, minWidth: 92, color: palette.ink },
  cueRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg, flexWrap: 'wrap' },
  cueField: { flexGrow: 1, flexBasis: 140 },
  noMargin: { marginBottom: 0 },
  fileActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  choose: { marginTop: spacing.md },
  check: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', marginBottom: spacing.md },
  startRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  moment: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  momentText: { flexGrow: 1, flexBasis: 260, flexShrink: 1 },
  momentControls: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  momentField: { width: 110 },
});
