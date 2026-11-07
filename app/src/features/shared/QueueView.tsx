import { StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import type { QueueTeam } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { homeFor } from '@/auth/routes';
import { AppText, Badge, Banner, Card, EmptyState, ErrorView, LoadingView, Screen, TeamImage } from '@/components';
import { useIsWide } from '@/features/team/notices';
import { publicMembers } from '@/features/team/people';
import { PersonAvatar } from '@/features/team/PersonAvatar';
import { useApi, usePolling } from '@/hooks';
import { formatTime, plural } from '@/lib/format';
import { colors, radius, spacing } from '@/theme';
import { teamColorOf, textOn } from '@/lib/teamColor';

const POLL_MS = 15_000;
const MAX_AVATARS = 5;

function QueueRow({ team, mine, wide, last }: { team: QueueTeam; mine: boolean; wide: boolean; last: boolean }) {
  const people = publicMembers(team);
  const hasPhotos = people.some((p) => p.photoUrl);
  const evaluated = team.evaluationCount > 0;
  const numSize = wide ? 64 : 48;

  return (
    <View style={mine ? styles.mineRow : null}>
      <View style={[styles.row, wide ? styles.rowWide : null, last ? null : styles.separator]}>
        <View
          style={[
            styles.position,
            { width: numSize, height: numSize, borderRadius: numSize / 2 },
            { backgroundColor: teamColorOf(team), borderWidth: 2, borderColor: colors.border },
          ]}
        >
          <AppText
            style={[styles.positionText, { fontSize: wide ? 26 : 20, lineHeight: wide ? 32 : 26 }]}
            color={textOn(teamColorOf(team))}
          >
            {team.orderPosition ?? '–'}
          </AppText>
        </View>
        {wide ? <TeamImage url={team.imageUrl} size={88} borderRadius={radius.md} /> : null}
        <View style={styles.body}>
          <View style={styles.nameRow}>
            <AppText variant={wide ? 'heading' : 'bodyStrong'} numberOfLines={1} style={styles.name}>
              {team.name}
            </AppText>
            {mine ? <Badge label="Your team" tone="accent" icon="star" /> : null}
          </View>
          <AppText variant={wide ? 'body' : 'caption'} color="textSecondary" numberOfLines={wide ? 2 : 1}>
            {team.projectTitle}
          </AppText>
          {hasPhotos ? (
            <View style={styles.avatars}>
              {people.slice(0, MAX_AVATARS).map((p, i) => (
                <PersonAvatar
                  key={`${p.name}-${i}`}
                  name={p.name}
                  photoUrl={p.photoUrl}
                  size={wide ? 30 : 24}
                  style={i ? styles.avatarOverlap : null}
                />
              ))}
              <AppText variant="caption" color="muted" numberOfLines={1} style={styles.memberText}>
                {people.map((p) => p.name).join(', ')}
              </AppText>
            </View>
          ) : people.length ? (
            <AppText variant="caption" color="muted" numberOfLines={wide ? 2 : 1}>
              {people.map((p) => p.name).join(' · ')}
            </AppText>
          ) : null}
        </View>
        <Badge
          label={evaluated ? `${team.evaluationCount} ${team.evaluationCount === 1 ? 'score' : 'scores'}` : 'Waiting'}
          tone={evaluated ? 'success' : 'neutral'}
          icon={evaluated ? 'checkmark-circle' : 'time-outline'}
          size={wide ? 'md' : 'sm'}
        />
      </View>
    </View>
  );
}

/** Presentation order (GET /api/order). Complete screen shared by team, judge and admin routes. */
export function QueueView() {
  const { session, role } = useAuth();
  const { data, error, loading, refreshing, refresh, reload } = useApi(() => api.order());
  usePolling(reload, POLL_MS);
  const wide = useIsWide();
  const backHref = homeFor(role);
  const myTeamId = role === 'lead' || role === 'member' ? (session?.team?.id ?? null) : null;

  if (loading) {
    return (
      <Screen title="Queue" backHref={backHref}>
        <LoadingView message="Loading the queue…" />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen title="Queue" backHref={backHref}>
        <ErrorView error={error} onRetry={refresh} />
      </Screen>
    );
  }

  const teams = [...data.teams].sort((a, b) => (a.orderPosition ?? Infinity) - (b.orderPosition ?? Infinity));
  const mine = myTeamId ? teams.find((t) => t.id === myTeamId) : undefined;
  const ahead = mine?.orderPosition ? teams.filter((t) => (t.orderPosition ?? 0) < mine.orderPosition!).length : 0;
  const done = teams.filter((t) => t.evaluationCount > 0).length;

  return (
    <Screen
      title="Queue"
      subtitle={data.generated ? `${plural(teams.length, 'team')} · drawn ${formatTime(data.generatedAt)}` : undefined}
      backHref={backHref}
      refreshing={refreshing}
      onRefresh={() => void refresh()}
    >
      {error ? <Banner type="warning" message={`Couldn't refresh: ${error.message}`} /> : null}

      {!data.generated ? (
        <EmptyState
          icon="shuffle"
          title="Order not generated yet"
          message="On expo day a random presentation order is drawn for all teams. It will appear here automatically."
        />
      ) : teams.length === 0 ? (
        <EmptyState icon="list-outline" title="No teams in the queue" message="There are no registered teams yet." />
      ) : (
        <>
          {mine ? (
            <Card tone="accent">
              <AppText variant="overline" color="muted">
                Your slot
              </AppText>
              <AppText variant="title" color="accent">
                You present #{mine.orderPosition} of {teams.length}
              </AppText>
              <AppText color="textSecondary">
                {mine.evaluationCount > 0
                  ? `Judged by ${plural(mine.evaluationCount, 'judge')} so far.`
                  : ahead === 0
                    ? 'You are first. Be ready at your stall!'
                    : `${plural(ahead, 'team')} before you.`}
              </AppText>
            </Card>
          ) : (
            <AppText variant="caption" color="muted" style={styles.intro}>
              {done} of {teams.length} teams have received at least one score.
            </AppText>
          )}
          <Card padded={false}>
            {teams.map((t, i) => (
              <QueueRow key={t.id} team={t} mine={t.id === myTeamId} wide={wide} last={i === teams.length - 1} />
            ))}
          </Card>
          <AppText variant="caption" color="faint" align="center" style={styles.footnote}>
            Updates automatically every 15 seconds.
          </AppText>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { marginBottom: spacing.md },
  mineRow: { backgroundColor: colors.accentDim },
  separator: { borderBottomWidth: 1, borderBottomColor: colors.separator },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  rowWide: { gap: spacing.lg, padding: spacing.lg },
  position: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fill,
  },
  positionMine: { backgroundColor: colors.accent },
  positionText: { fontWeight: '600' },
  body: { flex: 1, gap: 2, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  name: { flexShrink: 1 },
  avatars: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  avatarOverlap: { marginLeft: -8 },
  memberText: { flex: 1, marginLeft: spacing.sm },
  footnote: { marginTop: spacing.md },
});
