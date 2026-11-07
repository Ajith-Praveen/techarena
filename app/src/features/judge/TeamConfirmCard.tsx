import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { AppText, autoPosterFor, Badge, Card, PosterView, TeamImage } from '@/components';
import { teamColorOf } from '@/lib/teamColor';
import { colors, layout, spacing } from '@/theme';

import { PersonAvatar } from './PersonAvatar';
import { teamPeople, type JudgePublicTeam } from './types';

export interface TeamConfirmCardProps {
  team: JudgePublicTeam;
  /** Hide the long description (e.g. compact header on the evaluate screen). */
  compact?: boolean;
}

/** Team card a judge checks before scoring: image, name, project, members and queue position. */
export function TeamConfirmCard({ team, compact = false }: TeamConfirmCardProps) {
  const { width } = useWindowDimensions();
  const wide = width >= layout.tabletMinWidth;
  const people = teamPeople(team);
  const avatarSize = compact ? 36 : wide ? 72 : 52;
  const auto = autoPosterFor(team, people, teamColorOf(team));

  if (compact) {
    return (
      <Card bandColor={teamColorOf(team)}>
        <View style={styles.compact}>
        <TeamImage url={team.imageUrl} size={wide ? 88 : 64} />
        <View style={styles.flex}>
          <View style={styles.titleRow}>
            {team.orderPosition !== null ? <Badge label={`#${team.orderPosition}`} tone="accent" /> : null}
            <AppText variant="heading" numberOfLines={1} style={styles.flex}>
              {team.name}
            </AppText>
          </View>
          <AppText color="textSecondary" numberOfLines={2}>
            {team.projectTitle}
          </AppText>
        </View>
        <PosterView url={team.posterUrl} auto={auto} width={wide ? 66 : 48} />
        </View>
      </Card>
    );
  }

  return (
    <Card padded={false} bandColor={teamColorOf(team)}>
      <View style={wide ? styles.wideRow : null}>
        <View style={wide ? styles.wideImage : null}>
          <TeamImage url={team.imageUrl} aspectRatio={wide ? 4 / 3 : 16 / 9} borderRadius={0} style={styles.image} />
        </View>
        <View style={[styles.body, wide ? styles.flex : null]}>
          <View style={styles.badges}>
            {team.orderPosition !== null ? (
              <Badge label={`Position #${team.orderPosition}`} tone="accent" icon="list" size="md" />
            ) : (
              <Badge label="No position yet" tone="neutral" size="md" />
            )}
          </View>
          <AppText variant="title">{team.name}</AppText>
          <AppText variant="subheading" color="accent" style={styles.project}>
            {team.projectTitle}
          </AppText>
          <AppText color="textSecondary">{team.projectDesc}</AppText>
        </View>
      </View>
      {people.length > 0 ? (
        <View style={styles.members}>
          <AppText variant="overline" color="muted" style={styles.membersTitle}>
            Team members
          </AppText>
          <View style={styles.memberGrid}>
            {people.map((p, i) => (
              <View key={`${p.name}-${i}`} style={[styles.member, { width: avatarSize + 56 }]}>
                <PersonAvatar name={p.name} photoUrl={p.photoUrl} size={avatarSize} />
                <AppText variant="caption" weight="600" align="center" numberOfLines={2}>
                  {p.name}
                </AppText>
                {p.role === 'lead' ? (
                  <AppText variant="caption" color="accent" align="center">
                    Lead
                  </AppText>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}
      <View style={[styles.members, styles.posterRow]}>
        <PosterView url={team.posterUrl} auto={auto} width={wide ? 200 : 132} />
        <View style={styles.flex}>
          <AppText variant="overline" color="muted" style={styles.membersTitle}>
            Poster
          </AppText>
          <AppText variant="footnote" color="textSecondary">
            {team.posterUrl
              ? 'Tap the poster to open it full screen.'
              : 'Made automatically from the team’s project. Tap to open it full screen.'}
          </AppText>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  compact: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xxs },
  wideRow: { flexDirection: 'row' },
  wideImage: { width: '42%' },
  image: { borderWidth: 0 },
  body: { padding: spacing.lg, gap: spacing.xs },
  badges: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  project: { marginBottom: spacing.xs },
  members: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.lg,
  },
  membersTitle: { marginBottom: spacing.md },
  memberGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  member: { alignItems: 'center', gap: spacing.xs },
  posterRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg },
});
