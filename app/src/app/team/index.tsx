import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { AppText, AppTile, Badge, Banner, HomeGrid, Screen } from '@/components';
import { TeamBanner } from '@/components/comic/TeamBanner';
import { useIsWide } from '@/features/team/notices';
import { photoUrlOf } from '@/features/team/people';
import { PersonAvatar } from '@/features/team/PersonAvatar';
import { useApi, useConfig, usePolling } from '@/hooks';
import { confirm } from '@/lib/dialogs';
import { teamColorOf } from '@/lib/teamColor';
import { colors, spacing } from '@/theme';

async function loadSummary() {
  const [order, report] = await Promise.all([api.order(), api.report()]);
  return { order, report };
}

export default function TeamHomeScreen() {
  const { session, role, signOut, refreshMe } = useAuth();
  const { config, refresh: refreshConfig } = useConfig();
  const params = useLocalSearchParams<{ welcome?: string }>();
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const wide = useIsWide();
  const summary = useApi(loadSummary);
  usePolling(summary.reload, 30_000);

  const team = session?.team;
  const member = session?.member;
  const isLead = role === 'lead';

  const onRefresh = async () => {
    await Promise.all([summary.refresh(), refreshMe().catch(() => null), refreshConfig()]);
  };

  const onLogout = async () => {
    const ok = await confirm('Log out?', 'You can log back in with your phone number and team password.', 'Log out', {
      destructive: true,
    });
    if (!ok) return;
    await signOut();
    router.replace('/');
  };

  const order = summary.data?.order;
  const report = summary.data?.report;
  const queueEntry = order?.generated && team ? order.teams.find((t) => t.id === team.id) : undefined;
  const position = order?.generated ? (queueEntry?.orderPosition ?? null) : null;
  const evalCount = report?.scoredCount ?? report?.evaluations.length ?? 0;
  const resultsPublished = report?.resultsPublished ?? config?.resultsPublished ?? false;
  const registrationOpen = config?.registrationOpen ?? true;
  const showWelcome = params.welcome === '1' && !welcomeDismissed && isLead;
  const ownPoster = Boolean(team?.posterUrl);

  let presentation = summary.loading ? 'Loading…' : 'Order not drawn yet';
  if (position && order) presentation = `You present #${position} of ${order.teams.length}`;
  let scores = summary.loading || !report ? '' : 'No scores yet';
  if (report && evalCount) scores = `${evalCount} of ${report.activeJudgeCount} judges have scored you`;

  return (
    <Screen back={false} header={false} refreshing={summary.refreshing} onRefresh={() => void onRefresh()}>
      {showWelcome ? (
        <Banner
          type="success"
          title="Your team is registered"
          message="Next, add your teammates and send them their login details."
          action={{ label: 'Add teammates', onPress: () => router.push('/team/members') }}
          onClose={() => {
            setWelcomeDismissed(true);
            router.setParams({ welcome: undefined });
          }}
        />
      ) : null}

      <TeamBanner
        name={team?.name ?? 'Your team'}
        color={teamColorOf(team)}
        projectTitle={team?.projectTitle}
        imageUrl={team?.imageUrl ?? null}
        style={styles.banner}
        right={member && wide ? <PersonAvatar name={member.name} photoUrl={photoUrlOf(member)} size={56} /> : null}
      >
        <View style={styles.badges}>
          <Badge label={isLead ? 'Lead' : 'Member'} tone={isLead ? 'accent' : 'violet'} />
          {member ? (
            <AppText variant="footnote" color="secondaryLabel" numberOfLines={1} style={styles.flex}>
              {member.name}
            </AppText>
          ) : null}
        </View>
        <AppText variant="subheadline" color={position ? 'accent' : 'secondaryLabel'}>
          {presentation}
        </AppText>
        {scores ? (
          <AppText variant="footnote" color="secondaryLabel">
            {scores}
          </AppText>
        ) : null}
      </TeamBanner>


      {summary.error && !summary.loading ? (
        <Banner
          type="error"
          message={`Couldn't load the latest status. ${summary.error.message}`}
          action={{ label: 'Retry', onPress: () => void summary.refresh() }}
        />
      ) : null}

      <HomeGrid title="Expo">
        <AppTile label="My Code" icon="keypad" color={colors.blue} href="/team/code" value={team?.code} />
        <AppTile label="Team" icon="people" color={colors.indigo} href="/team/members" />
        <AppTile
          label="Poster"
          icon="document-attach"
          color={colors.amber}
          href="/team/poster"
          value={ownPoster ? 'Uploaded' : 'Auto'}
        />
        <AppTile
          label="Queue"
          icon="list"
          color={colors.orange}
          href="/team/queue"
          value={position ? `#${position}` : undefined}
        />
        <AppTile label="Report" icon="stats-chart" color={colors.green} href="/team/report" badge={evalCount || undefined} />
        <AppTile
          label="Results"
          icon="trophy"
          color={colors.yellow}
          href="/team/results"
          value={resultsPublished ? 'Live' : undefined}
          badge={resultsPublished ? true : undefined}
        />
      </HomeGrid>

      {isLead ? (
        <HomeGrid
          title="Team lead"
          footer={registrationOpen ? undefined : 'Registration is closed, so members and project details are locked.'}
        >
          <AppTile label="Add Members" icon="person-add" color={colors.teal} href="/team/members" disabled={!registrationOpen} />
          <AppTile label="Send Logins" icon="paper-plane" color={colors.pink} href="/team/notify" />
          <AppTile label="Edit Project" icon="create" color={colors.purple} href="/team/edit" />
          <AppTile label="Team Colour" icon="color-palette" color={teamColorOf(team)} href="/team/color" />
          <AppTile label="Change Password" icon="key" color={colors.gray} href="/team/password" />
        </HomeGrid>
      ) : null}

      <HomeGrid>
        <AppTile label="Log out" icon="log-out" onPress={() => void onLogout()} />
      </HomeGrid>
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: { marginTop: spacing.lg },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flexShrink: 1 },
});
