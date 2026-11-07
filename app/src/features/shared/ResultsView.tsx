import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

import { api } from '@/api/client';
import type { ResultEntry } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { homeFor } from '@/auth/routes';
import { AppText, Badge, Banner, Button, Card, ErrorView, LoadingView, Screen, TeamImage } from '@/components';
import { Burst } from '@/components/comic/Burst';
import { publicMembers } from '@/features/team/people';
import { PersonAvatar } from '@/features/team/PersonAvatar';
import { useApi, useConfig, usePolling } from '@/hooks';
import { formatAverage, formatDateTime, ordinal } from '@/lib/format';
import { successFeedback } from '@/lib/haptics';
import { teamColorOf } from '@/lib/teamColor';
import { colors, fonts, palette, radius, rankColors, spacing } from '@/theme';

import { Confetti } from './results/Confetti';
import { RevealIntro } from './results/RevealIntro';

const POLL_MS = 15_000;
/** Below this content width the podium stacks vertically. */
const PODIUM_MIN_WIDTH = 560;

function medalColor(rank: number): string {
  return rank === 1 || rank === 2 || rank === 3 ? rankColors[rank] : colors.accent;
}

const PEDESTAL: Record<number, number> = { 1: 120, 2: 84, 3: 60 };

function PodiumCard({
  entry,
  maxPerJudge,
  mine,
  layout,
}: {
  entry: ResultEntry;
  maxPerJudge: number | null;
  mine: boolean;
  layout: 'row' | 'stack';
}) {
  const color = medalColor(entry.rank);
  const people = publicMembers(entry.team);
  const first = entry.rank === 1;
  const inRow = layout === 'row';

  return (
    <View style={inRow ? styles.slot : null}>
      <Card
        bandColor={teamColorOf(entry.team)}
        style={[
          styles.podiumCard,
          first && inRow ? styles.firstCard : null,
          inRow ? null : styles.stackCard,
        ]}
      >
        <View style={styles.medalRow}>
          <View style={[styles.medal, { backgroundColor: color }]}>
            <Ionicons name={first ? 'trophy' : 'medal'} size={first ? 24 : 19} color={palette.ink} />
          </View>
          <View style={styles.flex}>
            <AppText style={styles.place}>{`${ordinal(entry.rank)} place`}</AppText>
          </View>
          {mine ? <Badge label="Your team" tone="accent" icon="star" /> : null}
        </View>
        <TeamImage url={entry.team.imageUrl} aspectRatio={16 / 10} borderRadius={radius.md} />
        <AppText variant={first ? 'title' : 'heading'} numberOfLines={2} style={styles.teamName}>
          {entry.team.name}
        </AppText>
        <AppText color="textSecondary" numberOfLines={2}>
          {entry.team.projectTitle}
        </AppText>
        <View style={styles.scoreRow}>
          <AppText style={[styles.score, first ? styles.scoreFirst : null]}>
            {formatAverage(entry.average)}
          </AppText>
          {maxPerJudge ? <AppText color="muted">/ {maxPerJudge} avg</AppText> : <AppText color="muted">avg</AppText>}
        </View>
        {people.length ? (
          <View style={styles.people}>
            {people.map((p, i) => (
              <View key={`${p.name}-${i}`} style={styles.person}>
                <PersonAvatar name={p.name} photoUrl={p.photoUrl} size={28} />
                <AppText variant="caption" color="textSecondary" numberOfLines={1} style={styles.personName}>
                  {p.name}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
      </Card>
      {inRow ? (
        <View
          style={[
            styles.pedestal,
            { height: PEDESTAL[entry.rank] ?? 48, backgroundColor: color },
          ]}
        >
          <AppText style={styles.pedestalText}>{entry.rank}</AppText>
        </View>
      ) : null}
    </View>
  );
}


const NATIVE = Platform.OS !== 'web';
/** Seconds between podium reveals (3rd, then 2nd, then 1st). */
const STEP_MS = 900;

// The big reveal plays once per publish on each device (per browser tab on web).
const seenReveals = new Set<string>();
function revealSeen(id: string): boolean {
  if (seenReveals.has(id)) return true;
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    try {
      return sessionStorage.getItem(`ta.reveal.${id}`) === '1';
    } catch {
      return false;
    }
  }
  return false;
}
function markRevealSeen(id: string) {
  seenReveals.add(id);
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(`ta.reveal.${id}`, '1');
    } catch {
      // Private mode: it just plays again.
    }
  }
}

/** Drops a podium card in with a comic bounce once `show` turns true; the winner also gets a "WINNER!" burst. */
function RevealSlot({ show, rank, children }: { show: boolean; rank: number; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(show ? 1 : 0)).current;
  const sticker = useRef(new Animated.Value(show ? 1 : 0)).current;
  useEffect(() => {
    if (!show) {
      v.setValue(0);
      sticker.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.spring(v, { toValue: 1, friction: 5, tension: 90, useNativeDriver: NATIVE }),
      Animated.sequence([
        Animated.delay(450),
        Animated.spring(sticker, { toValue: 1, friction: 3, tension: 140, useNativeDriver: NATIVE }),
      ]),
    ]).start();
  }, [show, v, sticker]);
  return (
    <Animated.View
      style={{
        opacity: v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1] }),
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-260, 0] }) },
          { rotate: v.interpolate({ inputRange: [0, 0.7, 1], outputRange: [rank % 2 ? '-8deg' : '8deg', rank % 2 ? '2deg' : '-2deg', '0deg'] }) },
          { scale: v.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.6, 1.06, 1] }) },
        ],
      }}
    >
      {children}
      {rank === 1 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.winner,
            { opacity: sticker, transform: [{ scale: sticker.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }, { rotate: '12deg' }] },
          ]}
        >
          <Burst size={118} color={palette.yellow} points={13} shadow={5}>
            <AppText style={styles.winnerText}>{'WIN-\nNER!'}</AppText>
          </Burst>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/** Results podium (GET /api/results). Complete screen shared by team, judge and admin routes. */
export function ResultsView() {
  const { session, role } = useAuth();
  const { config } = useConfig();
  const { data, error, loading, refreshing, refresh, reload } = useApi(() => api.results());
  usePolling(reload, POLL_MS, !data?.published);
  const { width } = useWindowDimensions();
  const backHref = homeFor(role);
  const myTeamId = role === 'lead' || role === 'member' ? (session?.team?.id ?? null) : null;
  const eventName = config?.eventName || 'Tech Arena';
  const publishedAt = data?.published ? data.publishedAt : null;
  // Reveal phases: 'intro' (drum roll) -> 'podium' (cards drop in 3, 2, 1) -> 'done'.
  const [phase, setPhase] = useState<'intro' | 'podium' | 'done'>('done');
  const [revealed, setRevealed] = useState(3); // how many podium places are visible
  const [burst, setBurst] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const runPodium = () => {
    timers.current.forEach(clearTimeout);
    setPhase('podium');
    setRevealed(0);
    timers.current = [1, 2, 3].map((n) =>
      setTimeout(() => {
        setRevealed(n);
        if (n === 3) {
          successFeedback();
          setBurst((b) => b + 1);
          setPhase('done');
        }
      }, n * STEP_MS),
    );
  };

  const startReveal = (withIntro: boolean) => {
    timers.current.forEach(clearTimeout);
    setRevealed(0);
    if (withIntro) setPhase('intro');
    else runPodium();
  };

  useEffect(() => {
    if (!publishedAt || revealSeen(publishedAt)) return;
    markRevealSeen(publishedAt);
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (!cancelled && !reduce) startReveal(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publishedAt]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  if (loading) {
    return (
      <Screen title="Results" backHref={backHref}>
        <LoadingView message="Loading results…" />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen title="Results" backHref={backHref}>
        <ErrorView error={error} onRetry={refresh} />
      </Screen>
    );
  }

  if (!data.published) {
    return (
      <Screen title="Results" backHref={backHref} refreshing={refreshing} onRefresh={() => void refresh()}>
        {error ? <Banner type="warning" message={`Couldn't refresh: ${error.message}`} /> : null}
        <View style={styles.waiting}>
          <View style={styles.waitingIcon}>
            <Ionicons name="trophy-outline" size={44} color={colors.gold} />
          </View>
          <AppText variant="title" align="center">
            Results not published yet
          </AppText>
          <AppText color="muted" align="center" style={styles.waitingText}>
            The judges publish the top 3 once every team has been evaluated. This page updates automatically, so keep it open.
          </AppText>
          <Badge label="Checking every 15 seconds" tone="neutral" icon="sync" style={styles.center} />
        </View>
      </Screen>
    );
  }

  const top = [...data.top].sort((a, b) => a.rank - b.rank);
  const podium = top.slice(0, 3);
  const extra = top.slice(3);
  const contentWidth = Math.min(width, 900);
  const rowLayout = contentWidth >= PODIUM_MIN_WIDTH && podium.length > 1;
  // Classic podium order: 2nd, 1st, 3rd.
  const rowOrder = [podium[1], podium[0], podium[2]].filter((e): e is ResultEntry => !!e);
  const maxPerJudge = config?.maxPerJudge ?? null;
  const myPlace = myTeamId ? top.find((e) => e.team.id === myTeamId) : undefined;
  const shown = (rank: number) => phase === 'done' || (phase === 'podium' && revealed >= 4 - Math.min(rank, 3));

  return (
    <Screen
      title="Results"
      subtitle={eventName}
      backHref={backHref}
      refreshing={refreshing}
      onRefresh={() => void refresh()}
      overlay={
        <>
          {burst > 0 ? <Confetti burstKey={burst} /> : null}
          {phase === 'intro' ? <RevealIntro eventName={eventName} onDone={runPodium} /> : null}
        </>
      }
    >
      {error ? <Banner type="warning" message={`Couldn't refresh: ${error.message}`} /> : null}

      <View style={styles.hero}>
        <AppText align="center" style={styles.heroTitle}>
          Top 3
        </AppText>
        <AppText variant="caption" color="muted" align="center">
          Published {formatDateTime(data.publishedAt)}
        </AppText>
      </View>

      {myPlace && phase === 'done' ? (
        <Banner
          type="success"
          icon="trophy"
          title={`Congratulations! Your team placed ${ordinal(myPlace.rank)}.`}
          message="Well done to everyone in the team."
        />
      ) : null}

      {top.length === 0 ? (
        <Card>
          <AppText color="muted" align="center">
            No teams were ranked.
          </AppText>
        </Card>
      ) : rowLayout ? (
        <View style={styles.podiumRow}>
          {rowOrder.map((e) => (
            <View key={e.team.id} style={styles.slotWrap}>
              <RevealSlot show={shown(e.rank)} rank={e.rank}>
                <PodiumCard entry={e} maxPerJudge={maxPerJudge} mine={e.team.id === myTeamId} layout="row" />
              </RevealSlot>
            </View>
          ))}
        </View>
      ) : (
        podium.map((e) => (
          <RevealSlot key={e.team.id} show={shown(e.rank)} rank={e.rank}>
            <PodiumCard entry={e} maxPerJudge={maxPerJudge} mine={e.team.id === myTeamId} layout="stack" />
          </RevealSlot>
        ))
      )}

      {extra.map((e) => (
        <PodiumCard key={e.team.id} entry={e} maxPerJudge={maxPerJudge} mine={e.team.id === myTeamId} layout="stack" />
      ))}

      <AppText variant="caption" color="faint" align="center" style={styles.footnote}>
        Ranked by the average of all judges' totals. Thank you to every team that took part!
      </AppText>
      {top.length > 0 && phase === 'done' ? (
        <Button title="Replay the reveal" icon="sparkles" variant="secondary" size="sm" fullWidth={false} onPress={() => startReveal(true)} style={styles.replay} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  waiting: { alignItems: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.lg, gap: spacing.md },
  waitingIcon: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  heroTitle: { fontFamily: fonts.display, fontSize: 44, lineHeight: 48, letterSpacing: 1, color: colors.text },
  flex: { flex: 1 },
  score: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, color: colors.text },
  scoreFirst: { fontSize: 42, lineHeight: 48 },
  waitingText: { maxWidth: 440, marginBottom: spacing.sm },
  center: { alignSelf: 'center' },
  hero: { alignItems: 'center', gap: spacing.xs, paddingTop: spacing.md, paddingBottom: spacing.xl },
  podiumRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  slot: { flex: 1, minWidth: 0 },
  podiumCard: { gap: spacing.sm, marginBottom: 0 },
  place: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, letterSpacing: 1, color: palette.ink },
  firstCard: { paddingVertical: spacing.xl },
  stackCard: { marginBottom: spacing.md },
  medalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.xs },
  medal: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: palette.ink, alignItems: 'center', justifyContent: 'center' },
  teamName: { marginTop: spacing.xs },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs, flexWrap: 'wrap' },
  people: { gap: spacing.xs, marginTop: spacing.xs },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  personName: { flex: 1 },
  pedestal: {
    marginTop: spacing.sm,
    marginRight: 5,
    borderWidth: 3,
    borderColor: palette.ink,
    borderBottomWidth: 0,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pedestalText: { fontFamily: fonts.bold, fontSize: 34, lineHeight: 40, color: palette.ink },
  footnote: { marginTop: spacing.xl },
  replay: { alignSelf: 'center', marginTop: spacing.lg },
  slotWrap: { flex: 1, minWidth: 0 },
  winner: { position: 'absolute', top: -34, right: -18 },
  winnerText: { fontFamily: fonts.display, fontSize: 24, lineHeight: 24, letterSpacing: 1, color: palette.red, textAlign: 'center' },
});
