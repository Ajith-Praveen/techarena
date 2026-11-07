import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import type { AdminTeam } from '@/api/types';
import {
  AppText,
  autoPosterFor,
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorView,
  LoadingView,
  Screen,
  PosterView,
  TeamImage,
  TextField,
} from '@/components';
import { CodeChip } from '@/features/admin/CodeChip';
import { missingPhotosOf, photoUrlOf } from '@/features/admin/compat';
import { PersonAvatar } from '@/features/admin/PersonAvatar';
import { useIsWide } from '@/features/admin/useIsWide';
import { useApi } from '@/hooks';
import { confirm, errorMessage, formatAverage, formatDateTime, formatPhone, plural, successFeedback } from '@/lib';
import { colors, radius, spacing } from '@/theme';
import { teamColorOf } from '@/lib/teamColor';

function matches(team: AdminTeam, q: string): boolean {
  if (!q) return true;
  const digits = q.replace(/\D/g, '');
  const hay = [team.name, team.projectTitle, team.code, ...team.members.flatMap((m) => [m.name, m.email, m.usn ?? ''])]
    .join(' ')
    .toLowerCase();
  if (hay.includes(q)) return true;
  return digits.length >= 3 && team.members.some((m) => m.phone.replace(/\D/g, '').includes(digits));
}

export default function AdminTeamsScreen() {
  const { data, error, loading, refreshing, refresh, reload, setData } = useApi(() => api.adminTeams());
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const teams = data?.teams;
  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => (teams ?? []).filter((t) => matches(t, q)), [teams, q]);

  if (loading) {
    return (
      <Screen title="Teams" backHref="/admin">
        <LoadingView message="Loading teams…" />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen title="Teams" backHref="/admin">
        <ErrorView error={error} onRetry={refresh} />
      </Screen>
    );
  }

  const participants = data.teams.reduce((n, t) => n + t.members.length, 0);
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const onDeleted = (id: string) => {
    setData((d) => (d ? { teams: d.teams.filter((t) => t.id !== id) } : d));
    void reload();
  };

  return (
    <Screen
      title="Teams"
      subtitle={`${plural(data.teams.length, 'team')} · ${plural(participants, 'participant')}`}
      backHref="/admin"
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {error ? <Banner type="error" message={`Could not refresh: ${error.message}`} action={{ label: 'Retry', onPress: () => void refresh() }} /> : null}

      {data.teams.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No teams yet"
          message="Teams appear here as soon as a team lead registers."
          action={{ label: 'Refresh', icon: 'refresh', onPress: refresh }}
        />
      ) : (
        <>
          <TextField
            icon="search"
            placeholder="Search team, project, code, member, phone, email"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
          {filtered.length === 0 ? (
            <EmptyState icon="search-outline" title="No matches" message={`Nothing matches "${query.trim()}".`} />
          ) : (
            filtered.map((team) => (
              <TeamRow
                key={team.id}
                team={team}
                expanded={expanded.has(team.id)}
                onToggle={() => toggle(team.id)}
                onDeleted={() => onDeleted(team.id)}
              />
            ))
          )}
        </>
      )}
    </Screen>
  );
}

function TeamRow({
  team,
  expanded,
  onToggle,
  onDeleted,
}: {
  team: AdminTeam;
  expanded: boolean;
  onToggle: () => void;
  onDeleted: () => void;
}) {
  const wide = useIsWide();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const missing = missingPhotosOf(team);
  const evaluated = team.evaluationCount > 0;

  const remove = async () => {
    setDeleteError(null);
    const ok = await confirm(
      `Delete "${team.name}"?`,
      `This permanently removes the team, its ${plural(team.members.length, 'member')} and their logins. This cannot be undone.`,
      'Delete team',
      { destructive: true },
    );
    if (!ok) return;
    try {
      await api.adminDeleteTeam(team.id);
      successFeedback();
      onDeleted();
    } catch (e) {
      setDeleteError(errorMessage(e));
    }
  };

  return (
    <Card padded={false} bandColor={teamColorOf(team)}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${team.name}, ${expanded ? 'collapse' : 'expand'}`}
        style={({ pressed }) => [styles.head, pressed ? { backgroundColor: colors.cardPressed } : null]}
      >
        <View style={styles.position}>
          <AppText variant="overline" color="muted">
            Slot
          </AppText>
          <AppText variant="heading" color={team.orderPosition ? 'accent' : 'faint'}>
            {team.orderPosition ?? '—'}
          </AppText>
        </View>
        <TeamImage url={team.imageUrl} size={wide ? 64 : 52} borderRadius={radius.md} />
        <View style={styles.headText}>
          <AppText variant="subheading" numberOfLines={1}>
            {team.name}
          </AppText>
          <AppText variant="caption" color="muted" numberOfLines={1}>
            {team.projectTitle}
          </AppText>
          <View style={styles.badges}>
            <CodeChip code={team.code} />
            <Badge label={plural(team.members.length, 'member')} icon="people" />
            <Badge
              label={`${plural(team.evaluationCount, 'eval')}`}
              tone={evaluated ? 'accent' : 'neutral'}
              icon="checkmark-done"
            />
            {team.average !== null ? <Badge label={`Avg ${formatAverage(team.average)}`} tone="gold" icon="star" /> : null}
            {missing ? <Badge label={`${missing} missing photo${missing === 1 ? '' : 's'}`} tone="warning" icon="camera" /> : null}
            {team.posterUrl ? null : <Badge label="No poster" tone="warning" icon="document-outline" />}
          </View>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color={colors.muted} />
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          <AppText variant="overline" color="muted">
            Project
          </AppText>
          <AppText variant="bodyStrong" style={styles.gapTop}>
            {team.projectTitle}
          </AppText>
          <AppText color="textSecondary" style={styles.gapTop}>
            {team.projectDesc}
          </AppText>
          {team.imageUrl ? <TeamImage url={team.imageUrl} style={styles.bigImage} /> : null}
          <AppText variant="overline" color="muted" style={styles.section}>
            Poster
          </AppText>
          <PosterView
            url={team.posterUrl}
            auto={autoPosterFor(team, team.members.map((m) => ({ name: m.name, role: m.role, photoUrl: photoUrlOf(m) })), teamColorOf(team))}
            width={160}
            style={styles.gapTop}
          />

          <AppText variant="overline" color="muted" style={styles.section}>
            Members
          </AppText>
          {team.members.map((m) => {
            const photo = photoUrlOf(m);
            return (
              <View key={m.id} style={styles.member}>
                <PersonAvatar name={m.name} photoUrl={photo} size={44} />
                <View style={styles.memberText}>
                  <View style={styles.memberName}>
                    <AppText variant="bodyStrong" numberOfLines={1} style={styles.shrink}>
                      {m.name}
                    </AppText>
                    <Badge label={m.role === 'lead' ? 'Lead' : 'Member'} tone={m.role === 'lead' ? 'accent' : 'neutral'} />
                    {missing !== null && !photo ? <Badge label="No photo" tone="warning" icon="camera" /> : null}
                  </View>
                  <AppText variant="caption" color="textSecondary" selectable>
                    {formatPhone(m.phone)}
                    {m.usn ? `  ·  ${m.usn}` : ''}
                  </AppText>
                  <AppText variant="caption" color="muted" selectable numberOfLines={1}>
                    {m.email}
                  </AppText>
                </View>
              </View>
            );
          })}

          <AppText variant="caption" color="faint" style={styles.section}>
            Registered {formatDateTime(team.createdAt)}
          </AppText>

          {deleteError ? <Banner type="error" title="Could not delete" message={deleteError} style={styles.gapTop} /> : null}
          <View style={styles.actions}>
            <Button
              title="Delete team"
              icon="trash-outline"
              variant="danger"
              size="sm"
              fullWidth={!wide}
              disabled={evaluated}
              onPress={remove}
            />
            {evaluated ? (
              <AppText variant="caption" color="muted" style={styles.shrink}>
                Evaluated teams can't be deleted, so scores stay intact.
              </AppText>
            ) : null}
          </View>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  position: { width: 40, alignItems: 'center' },
  headText: { flex: 1, minWidth: 0, gap: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs + 2, marginTop: spacing.xs },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  gapTop: { marginTop: spacing.xs },
  bigImage: { marginTop: spacing.md, maxWidth: 360 },
  section: { marginTop: spacing.lg, marginBottom: spacing.xs },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  memberText: { flex: 1, minWidth: 0, gap: 1 },
  memberName: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  shrink: { flexShrink: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap', marginTop: spacing.md },
});
