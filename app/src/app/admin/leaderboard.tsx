import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import type { Criterion, Evaluation, LeaderboardEntry } from '@/api/types';
import {
  AppText,
  Badge,
  Banner,
  Card,
  EmptyState,
  ErrorView,
  LoadingView,
  Screen,
  SectionTitle,
  TeamImage,
} from '@/components';
import { judgePhotoOf, tiedRanks } from '@/features/admin/compat';
import { PersonAvatar } from '@/features/admin/PersonAvatar';
import { useIsWide } from '@/features/admin/useIsWide';
import { useApi, usePolling } from '@/hooks';
import { formatAverage, formatScore, formatTime, plural } from '@/lib';
import { colors, radius, rankColors, spacing } from '@/theme';

const POLL_MS = 15_000;
/** Below this width the table would be cramped, so rows render as cards. */
const TABLE_MIN_WIDTH = 860;

function rankColor(rank: number | null): string {
  return rank !== null && rank >= 1 && rank <= 3 ? rankColors[rank as 1 | 2 | 3] : colors.textSecondary;
}

function rankLabel(rank: number | null, tied: boolean): string {
  if (rank === null) return '—';
  return tied ? `=${rank}` : String(rank);
}

function shortLabel(c: Criterion): string {
  return c.label.split(/[\s&]+/)[0] ?? c.label;
}

export default function AdminLeaderboardScreen() {
  const { data, error, loading, refreshing, refresh, reload } = useApi(() => api.leaderboard());
  usePolling(reload, POLL_MS);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const table = useIsWide(TABLE_MIN_WIDTH);

  const entries = data?.teams;
  const tied = useMemo(() => tiedRanks(entries ?? []), [entries]);
  useEffect(() => {
    if (data) setUpdatedAt(new Date().toISOString());
  }, [data]);

  const header = {
    title: 'Leaderboard',
    backHref: '/admin' as const,
    right: <Badge label="Live" tone="success" icon="pulse" />,
  };

  if (loading) {
    return (
      <Screen {...header}>
        <LoadingView message="Loading leaderboard…" />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen {...header}>
        <ErrorView error={error} onRetry={refresh} />
      </Screen>
    );
  }

  const { criteria, teams } = data;
  const maxPerJudge = criteria.reduce((n, c) => n + c.max, 0);
  const ranked = teams.filter((t) => t.rank !== null);
  const unranked = teams.filter((t) => t.rank === null);
  const topTie = ranked.some((t) => tied.has(t.team.id) && (t.rank ?? 99) <= 3);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const renderEntry = (entry: LeaderboardEntry) => {
    const props = {
      entry,
      criteria,
      maxPerJudge,
      tied: tied.has(entry.team.id),
      expanded: expanded.has(entry.team.id),
      onToggle: () => toggle(entry.team.id),
    };
    return table ? <TableRow key={entry.team.id} {...props} /> : <EntryCard key={entry.team.id} {...props} />;
  };

  return (
    <Screen
      {...header}
      subtitle={updatedAt ? `Updated ${formatTime(updatedAt)} · every 15 s` : undefined}
      refreshing={refreshing}
      onRefresh={refresh}
      maxWidth={table ? 1100 : undefined}
    >
      {error ? <Banner type="error" message={`Could not refresh: ${error.message}`} action={{ label: 'Retry', onPress: () => void refresh() }} /> : null}
      {topTie ? (
        <Banner
          type="warning"
          title="Tie in the top 3 — judges must decide"
          message="Judges break ties from their Progress screen once every team is evaluated. Results can't be published until they agree."
        />
      ) : null}
      <AppText variant="caption" color="muted" style={styles.note}>
        Read only. Average = mean of judge totals (out of {maxPerJudge}). Nobody can edit scores here.
      </AppText>

      {teams.length === 0 ? (
        <EmptyState icon="podium-outline" title="No teams yet" message="The leaderboard fills up as judges submit scores." />
      ) : (
        <>
          {ranked.length === 0 ? (
            <Card>
              <EmptyState icon="hourglass-outline" title="No scores yet" message="Teams are ranked as soon as a judge submits a score." />
            </Card>
          ) : (
            <>
              {table ? <TableHeader criteria={criteria} /> : null}
              {ranked.map(renderEntry)}
            </>
          )}
          {unranked.length ? (
            <>
              <SectionTitle title={`Not yet evaluated · ${unranked.length}`} />
              {table ? <TableHeader criteria={criteria} /> : null}
              {unranked.map(renderEntry)}
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

interface EntryProps {
  entry: LeaderboardEntry;
  criteria: Criterion[];
  maxPerJudge: number;
  tied: boolean;
  expanded: boolean;
  onToggle: () => void;
}

function RankBubble({ rank, tied, size = 40 }: { rank: number | null; tied: boolean; size?: number }) {
  const c = rankColor(rank);
  return (
    <View style={[styles.rank, { width: size, height: size, borderRadius: size / 2, borderColor: c }]}>
      <AppText weight="800" style={{ color: c, fontSize: size * 0.4, lineHeight: size * 0.5 }}>
        {rankLabel(rank, tied)}
      </AppText>
    </View>
  );
}

function TieBadge({ rank }: { rank: number | null }) {
  if (rank === null) return null;
  return rank <= 3 ? (
    <Badge label="Tie — judges must decide" tone="warning" icon="git-compare" />
  ) : (
    <Badge label="Tied" tone="neutral" />
  );
}

const COL = { rank: 56, crit: 80, evals: 56, avg: 80, chevron: 28 };

function TableHeader({ criteria }: { criteria: Criterion[] }) {
  return (
    <View style={[styles.tRow, styles.tHead]}>
      <AppText variant="caption" color="muted" style={{ width: COL.rank }}>
        Rank
      </AppText>
      <AppText variant="caption" color="muted" style={styles.flex}>
        Team
      </AppText>
      {criteria.map((c) => (
        <AppText key={c.key} variant="caption" color="muted" align="center" numberOfLines={1} style={{ width: COL.crit }}>
          {shortLabel(c)}
        </AppText>
      ))}
      <AppText variant="caption" color="muted" align="center" style={{ width: COL.evals }}>
        Evals
      </AppText>
      <AppText variant="caption" color="muted" align="right" style={{ width: COL.avg }}>
        Avg
      </AppText>
      <View style={{ width: COL.chevron }} />
    </View>
  );
}

function TableRow({ entry, criteria, maxPerJudge, tied, expanded, onToggle }: EntryProps) {
  const { team, rank } = entry;
  return (
    <Card padded={false} tone={rank !== null && rank <= 3 && !tied ? 'gold' : tied && rank !== null && rank <= 3 ? 'warning' : 'default'} style={styles.tCard}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={({ pressed }) => [styles.tRow, pressed ? { backgroundColor: colors.cardPressed } : null]}
      >
        <View style={{ width: COL.rank }}>
          <RankBubble rank={rank} tied={tied} />
        </View>
        <View style={[styles.flex, styles.teamCell]}>
          <TeamImage url={team.imageUrl} size={44} borderRadius={radius.sm} />
          <View style={styles.flexShrink}>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {team.name}
            </AppText>
            <AppText variant="caption" color="muted" numberOfLines={1}>
              {team.projectTitle}
            </AppText>
            {tied ? <TieBadge rank={rank} /> : null}
          </View>
        </View>
        {criteria.map((c) => (
          <AppText key={c.key} align="center" color={entry.evaluationCount ? 'text' : 'faint'} style={{ width: COL.crit }}>
            {entry.evaluationCount ? formatScore(entry.criteriaAverages[c.key]) : '—'}
          </AppText>
        ))}
        <AppText align="center" color="textSecondary" style={{ width: COL.evals }}>
          {entry.evaluationCount}
        </AppText>
        <AppText variant="subheading" weight="800" align="right" style={{ width: COL.avg, color: rankColor(rank) }}>
          {formatAverage(entry.average)}
        </AppText>
        <View style={{ width: COL.chevron, alignItems: 'flex-end' }}>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />
        </View>
      </Pressable>
      {expanded ? <Breakdown evaluations={entry.evaluations} criteria={criteria} maxPerJudge={maxPerJudge} /> : null}
    </Card>
  );
}

function EntryCard({ entry, criteria, maxPerJudge, tied, expanded, onToggle }: EntryProps) {
  const { team, rank } = entry;
  return (
    <Card padded={false} tone={rank !== null && rank <= 3 ? (tied ? 'warning' : 'gold') : 'default'}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={({ pressed }) => [styles.cardHead, pressed ? { backgroundColor: colors.cardPressed } : null]}
      >
        <View style={styles.cardTop}>
          <RankBubble rank={rank} tied={tied} size={44} />
          <View style={styles.flex}>
            <AppText variant="subheading" numberOfLines={1}>
              {team.name}
            </AppText>
            <AppText variant="caption" color="muted" numberOfLines={1}>
              {team.projectTitle}
            </AppText>
          </View>
          <View style={styles.avgBox}>
            <AppText variant="heading" weight="800" style={{ color: rankColor(rank) }}>
              {formatAverage(entry.average)}
            </AppText>
            <AppText variant="caption" color="muted">
              {plural(entry.evaluationCount, 'eval')}
            </AppText>
          </View>
        </View>
        {tied ? (
          <View style={styles.tieRow}>
            <TieBadge rank={rank} />
          </View>
        ) : null}
        {entry.evaluationCount ? (
          <View style={styles.chips}>
            {criteria.map((c) => (
              <View key={c.key} style={[styles.chip, styles.chipInline]}>
                <AppText variant="caption" color="muted" numberOfLines={1} style={styles.flexShrink}>
                  {shortLabel(c)}
                </AppText>
                <AppText variant="label" weight="600">
                  {formatScore(entry.criteriaAverages[c.key])}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.expandHint}>
          <AppText variant="caption" color="accent">
            {expanded ? 'Hide judges' : 'Judge breakdown'}
          </AppText>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
        </View>
      </Pressable>
      {expanded ? <Breakdown evaluations={entry.evaluations} criteria={criteria} maxPerJudge={maxPerJudge} /> : null}
    </Card>
  );
}

function Breakdown({ evaluations, criteria, maxPerJudge }: { evaluations: Evaluation[]; criteria: Criterion[]; maxPerJudge: number }) {
  if (evaluations.length === 0) {
    return (
      <View style={styles.breakdown}>
        <AppText color="muted" variant="caption">
          No judge has scored this team yet.
        </AppText>
      </View>
    );
  }
  return (
    <View style={styles.breakdown}>
      {evaluations.map((ev) => (
        <View key={ev.id} style={styles.evalCard}>
          <View style={styles.evalHead}>
            <PersonAvatar name={ev.judgeName} photoUrl={judgePhotoOf(ev)} size={32} />
            <View style={styles.flex}>
              <AppText variant="label">
                {ev.judgeLabel} · {ev.judgeName}
              </AppText>
              <AppText variant="caption" color="faint">
                Submitted {formatTime(ev.createdAt)}
              </AppText>
            </View>
            <AppText variant="subheading" weight="800" color="accent">
              {ev.total}
              <AppText variant="caption" color="muted">
                {' '}
                / {maxPerJudge}
              </AppText>
            </AppText>
          </View>
          <View style={styles.chips}>
            {criteria.map((c) => (
              <View key={c.key} style={[styles.chip, styles.chipInline, styles.chipWide]}>
                <AppText variant="caption" color="muted" numberOfLines={1} style={styles.flexShrink}>
                  {c.label}
                </AppText>
                <AppText variant="label" weight="600">
                  {ev.scores[c.key] ?? '—'}
                  <AppText variant="caption" color="faint">
                    {' '}
                    / {c.max}
                  </AppText>
                </AppText>
              </View>
            ))}
          </View>
          {ev.remarks ? (
            <AppText variant="caption" color="textSecondary" style={styles.remarks}>
              “{ev.remarks}”
            </AppText>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  flexShrink: { flexShrink: 1, minWidth: 0, gap: 2 },
  note: { marginBottom: spacing.md },
  rank: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, backgroundColor: colors.surface },
  tHead: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  tRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs },
  tCard: { marginBottom: spacing.sm },
  teamCell: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardHead: { padding: spacing.md, gap: spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avgBox: { alignItems: 'flex-end' },
  tieRow: { flexDirection: 'row' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  chip: {
    flexGrow: 1,
    flexBasis: 96,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
  },
  chipInline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  chipWide: { flexBasis: 150 },
  expandHint: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-end' },
  breakdown: {
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  evalCard: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  evalHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  remarks: { fontStyle: 'italic' },
});
