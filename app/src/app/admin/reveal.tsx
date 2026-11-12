import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import type { LeaderboardEntry, PublicTeam } from '@/api/types';
import { AppText, Banner, Button, Card, EmptyState, ErrorView, LoadingView, Screen, SectionTitle, TextField } from '@/components';
import { BigReveal, type ShowEntry } from '@/features/reveal/BigReveal';
import {
  DEFAULT_CUES,
  deleteTrack,
  fmtTime,
  loadCues,
  loadTracks,
  pickAudioFile,
  saveCues,
  saveTrack,
  SLOTS,
  type Cue,
  type Slot,
  type StoredTrack,
} from '@/features/reveal/trackStore';
import { useApi, useConfig } from '@/hooks';
import { plural, toApiError } from '@/lib';
import { colors, fonts, palette, spacing } from '@/theme';

const SLOT_INFO: Record<Slot, { title: string; what: string; ideas: string }> = {
  countdown: {
    title: 'Countdown 10 → 0',
    what: 'The big numbers count down to the drop: 0 lands exactly on it.',
    ideas: 'Avengers ideas: "Infinity War" (Avengers: Infinity War), or the build-up of "The Avengers" main theme.',
  },
  third: {
    title: '3rd place',
    what: '"In 3rd place…" builds until the drop, then the team slams in and each teammate photo pops on the beat.',
    ideas: 'Avengers ideas: "Avengers: Age of Ultron Title" (Brian Tyler).',
  },
  second: {
    title: '2nd place',
    what: 'Same as 3rd place, with its own track.',
    ideas: 'Avengers ideas: "Assemble" (The Avengers, 2012).',
  },
  first: {
    title: '1st place · the grand one',
    what: '"And the champion is…" until the drop, then the winner, photos on the beat and a confetti storm.',
    ideas: 'Avengers ideas: "Portals" (Avengers: Endgame) or "The Avengers" main theme.',
  },
};

const MYSTERY_COLORS = ['#7B3FE4', '#1E5BFF', '#E4002B'];

function mysteryTeam(rank: number): ShowEntry {
  const team: PublicTeam = {
    id: `mystery-${rank}`,
    name: `Mystery Team ${rank}`,
    projectTitle: 'A top secret project (rehearsal)',
    projectDesc: '',
    imageUrl: null,
    posterUrl: null,
    color: MYSTERY_COLORS[rank - 1] ?? null,
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

  const [tracks, setTracks] = useState<Partial<Record<Slot, StoredTrack>>>({});
  const [durations, setDurations] = useState<Partial<Record<Slot, number>>>({});
  const [cues, setCues] = useState<Record<Slot, Cue>>(() => loadCues());
  const [storeError, setStoreError] = useState<string | null>(null);
  const [publishOn, setPublishOn] = useState(true);
  const [show, setShow] = useState<{ entries: ShowEntry[]; rehearsal: boolean } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Object URLs for the stored files.
  const urls = useMemo(() => {
    const out: Partial<Record<Slot, string>> = {};
    for (const slot of SLOTS) {
      const t = tracks[slot];
      if (t) out[slot] = URL.createObjectURL(t.blob);
    }
    return out;
  }, [tracks]);
  useEffect(() => () => Object.values(urls).forEach((u) => u && URL.revokeObjectURL(u)), [urls]);

  useEffect(() => {
    loadTracks()
      .then(setTracks)
      .catch((e: unknown) => setStoreError(e instanceof Error ? e.message : 'Could not read saved music.'));
  }, []);

  // Track lengths, for the readouts and sanity checks.
  useEffect(() => {
    for (const slot of SLOTS) {
      const url = urls[slot];
      if (!url) continue;
      const a = new Audio(url);
      a.preload = 'metadata';
      a.onloadedmetadata = () => setDurations((d) => ({ ...d, [slot]: a.duration }));
    }
  }, [urls]);

  useEffect(() => saveCues(cues), [cues]);

  // ---- Preview player --------------------------------------------------------------------------
  const preview = useRef<HTMLAudioElement | null>(null);
  const [previewSlot, setPreviewSlot] = useState<Slot | null>(null);
  const [previewTime, setPreviewTime] = useState(0);
  useEffect(() => {
    if (!previewSlot) return;
    const id = setInterval(() => setPreviewTime(preview.current?.currentTime ?? 0), 100);
    return () => clearInterval(id);
  }, [previewSlot]);
  useEffect(() => () => preview.current?.pause(), []);

  const stopPreview = () => {
    preview.current?.pause();
    setPreviewSlot(null);
  };
  const playFrom = (slot: Slot, at: number) => {
    const url = urls[slot];
    if (!url) return;
    preview.current?.pause();
    const a = new Audio(url);
    a.currentTime = Math.max(0, at);
    a.onended = () => setPreviewSlot((s) => (s === slot ? null : s));
    preview.current = a;
    setPreviewSlot(slot);
    setPreviewTime(a.currentTime);
    void a.play().catch(() => setPreviewSlot(null));
  };

  const setCue = (slot: Slot, patch: Partial<Cue>) => setCues((c) => ({ ...c, [slot]: { ...c[slot], ...patch } }));

  const choose = async (slot: Slot) => {
    const file = await pickAudioFile();
    if (!file) return;
    try {
      await saveTrack(slot, file);
      setTracks((t) => ({ ...t, [slot]: { name: file.name, blob: file } }));
      setStoreError(null);
    } catch (e) {
      setStoreError(e instanceof Error ? e.message : 'Could not save the file in this browser.');
    }
  };
  const remove = async (slot: Slot) => {
    if (previewSlot === slot) stopPreview();
    await deleteTrack(slot).catch(() => {});
    setTracks((t) => {
      const n = { ...t };
      delete n[slot];
      return n;
    });
  };

  // ---- Start -----------------------------------------------------------------------------------
  const published = overview.data?.resultsPublished ?? false;
  const pending = overview.data ? Math.max(0, overview.data.expectedEvaluations - overview.data.evaluations) : 0;
  const podium = board.data ? podiumOf(board.data.teams) : null;

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

  const missing = SLOTS.filter((s) => !tracks[s]);

  return (
    <Screen title="Big screen reveal" subtitle="Music-synced results for the projector" backHref="/admin/results">
      <Card tone="accent">
        <AppText variant="bodyStrong">How it works</AppText>
        <AppText color="textSecondary" style={styles.para}>
          Load your 4 tracks below and mark the drop in each one. On the night, press Start on the projector laptop: it goes
          full screen, counts 10 → 0 to the countdown track, then reveals 3rd, 2nd and 1st, each landing on the drop of its
          own track. Press SPACE (or a presenter clicker) to move to the next place.
        </AppText>
        <View style={styles.lockRow}>
          <Ionicons name="lock-closed" size={14} color={colors.textSecondary} />
          <AppText variant="caption" color="textSecondary" style={styles.flex}>
            Music files stay in this browser on this laptop. They are never uploaded.
          </AppText>
        </View>
      </Card>

      {storeError ? <Banner type="error" message={storeError} onClose={() => setStoreError(null)} /> : null}

      <SectionTitle title="Music" />
      {SLOTS.map((slot) => (
        <SlotCard
          key={slot}
          slot={slot}
          track={tracks[slot]}
          duration={durations[slot]}
          cue={cues[slot]}
          playing={previewSlot === slot}
          time={previewSlot === slot ? previewTime : null}
          onChoose={() => void choose(slot)}
          onRemove={() => void remove(slot)}
          onPlay={(at) => playFrom(slot, at)}
          onStop={stopPreview}
          onCue={(patch) => setCue(slot, patch)}
          onReset={() => setCue(slot, DEFAULT_CUES[slot])}
        />
      ))}

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
        {podium && podium.entries.length === 0 ? <Banner type="warning" message="No team has been scored yet. Use the rehearsal to test your music." /> : null}
        {missing.length ? (
          <Banner
            type="warning"
            message={`No music for: ${missing.map((s) => SLOT_INFO[s].title).join(', ')}. Those parts run silently on a timer.`}
          />
        ) : null}
        {startError ? <Banner type="error" message={startError} onClose={() => setStartError(null)} /> : null}
        <View style={styles.startRow}>
          <Button title="Start the show" icon="play" size="lg" loading={starting} disabled={!!podium?.tied} onPress={() => start(false)} style={styles.flex} />
          <Button title="Rehearse (mystery teams)" icon="eye-off-outline" variant="secondary" size="lg" onPress={() => start(true)} style={styles.flex} />
        </View>
        <AppText variant="caption" color="muted" style={styles.para}>
          Keys: SPACE / → / clicker = next · ESC = exit. Test the laptop sound on the hall speakers first.
        </AppText>
      </Card>

      {show ? (
        <BigReveal
          entries={show.entries}
          tracks={urls}
          cues={cues}
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
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : fallback;
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

function SlotCard({
  slot,
  track,
  duration,
  cue,
  playing,
  time,
  onChoose,
  onRemove,
  onPlay,
  onStop,
  onCue,
  onReset,
}: {
  slot: Slot;
  track: StoredTrack | undefined;
  duration: number | undefined;
  cue: Cue;
  playing: boolean;
  time: number | null;
  onChoose: () => void;
  onRemove: () => void;
  onPlay: (at: number) => void;
  onStop: () => void;
  onCue: (patch: Partial<Cue>) => void;
  onReset: () => void;
}) {
  const info = SLOT_INFO[slot];
  const isCountdown = slot === 'countdown';
  const warnings: string[] = [];
  if (cue.hit <= cue.start) warnings.push('The drop must come after the start time.');
  if (isCountdown && cue.hit - cue.start < 10)
    warnings.push(`The countdown begins 10 s before the drop. Start the track at ${Math.max(0, cue.hit - 10).toFixed(1)} s or earlier to show all 10 numbers.`);
  if (duration && cue.hit > duration) warnings.push(`The drop (${fmtTime(cue.hit)}) is after the end of the track (${fmtTime(duration)}).`);

  return (
    <Card bandColor={slot === 'first' ? palette.yellow : slot === 'countdown' ? palette.red : palette.blue}>
      <AppText style={styles.slotTitle}>{info.title}</AppText>
      <AppText color="textSecondary" style={styles.para}>
        {info.what}
      </AppText>
      <AppText variant="caption" color="muted" style={styles.para}>
        {info.ideas}
      </AppText>

      {track ? (
        <>
          <View style={styles.fileRow}>
            <Ionicons name="musical-notes" size={18} color={palette.ink} />
            <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
              {track.name}
            </AppText>
            {duration ? <AppText variant="caption" color="muted">{fmtTime(duration)}</AppText> : null}
          </View>

          <View style={styles.player}>
            <AppText style={styles.clock}>{time !== null ? fmtTime(time) : '–:––'}</AppText>
            {playing ? (
              <>
                <Button title="Stop" icon="stop" variant="secondary" size="sm" fullWidth={false} onPress={onStop} />
                <Button title="Drop is HERE" icon="flash" size="sm" fullWidth={false} onPress={() => {
                    if (time !== null) onCue({ hit: Math.round(time * 10) / 10 });
                  }} />
                <Button title="Start here" icon="flag-outline" variant="ghost" size="sm" fullWidth={false} onPress={() => {
                    if (time !== null) onCue({ start: Math.round(time * 10) / 10 });
                  }} />
              </>
            ) : (
              <>
                <Button title="Play from start" icon="play" variant="secondary" size="sm" fullWidth={false} onPress={() => onPlay(cue.start)} />
                <Button title="Hear the drop" icon="headset-outline" variant="secondary" size="sm" fullWidth={false} onPress={() => onPlay(Math.max(cue.start, cue.hit - (isCountdown ? 10 : 3)))} />
                <Button title="From 0:00" icon="refresh" variant="ghost" size="sm" fullWidth={false} onPress={() => onPlay(0)} />
              </>
            )}
          </View>
          <AppText variant="caption" color="muted" style={styles.para}>
            Tip: play the track and press &quot;Drop is HERE&quot; right on the big hit. Fine-tune the seconds below.
          </AppText>

          <View style={styles.cueRow}>
            <CueField label="Start at (s)" value={cue.start} onChange={(n) => onCue({ start: n })} />
            <CueField label={isCountdown ? '0 lands at (s)' : 'Reveal at (s)'} value={cue.hit} onChange={(n) => onCue({ hit: n })} />
            {isCountdown ? null : <CueField label="Beat (BPM)" value={cue.bpm} onChange={(n) => onCue({ bpm: Math.max(30, Math.min(240, n || 120)) })} />}
          </View>
          {warnings.map((w) => (
            <Banner key={w} type="warning" message={w} />
          ))}
          <View style={styles.fileActions}>
            <Button title="Replace file" icon="swap-horizontal" variant="ghost" size="sm" fullWidth={false} onPress={onChoose} />
            <Button title="Reset timings" icon="refresh" variant="ghost" size="sm" fullWidth={false} onPress={onReset} />
            <Button title="Remove" icon="trash-outline" variant="ghost" size="sm" fullWidth={false} onPress={onRemove} />
          </View>
        </>
      ) : (
        <Button title="Choose audio file" icon="musical-notes-outline" variant="secondary" onPress={onChoose} style={styles.choose} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  para: { marginTop: spacing.xs },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
  slotTitle: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, letterSpacing: 1, color: palette.ink },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  player: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  clock: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, minWidth: 92, color: palette.ink },
  cueRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md, flexWrap: 'wrap' },
  cueField: { flexGrow: 1, flexBasis: 120 },
  noMargin: { marginBottom: 0 },
  fileActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  choose: { marginTop: spacing.md },
  check: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', marginBottom: spacing.md },
  startRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
});
