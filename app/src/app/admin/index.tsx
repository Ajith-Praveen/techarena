import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { api } from '@/api/client';
import type { AdminOverview } from '@/api/types';
import {
  AppText,
  AppTile,
  Badge,
  Banner,
  Card,
  ErrorView,
  HomeGrid,
  LoadingView,
  Screen,
  SectionTitle,
  StatRow,
  StatTile,
} from '@/components';
import { missingPhotosOf } from '@/features/admin/compat';
import { useAdminLogout } from '@/features/admin/logout';
import { ProgressBar } from '@/features/admin/ProgressBar';
import { fetchConfig, useApi, useConfig, usePolling } from '@/hooks';
import { confirm, errorMessage, formatDateTime, formatRelative, successFeedback } from '@/lib';
import { colors, spacing } from '@/theme';

export default function AdminHomeScreen() {
  const { config } = useConfig();
  const logout = useAdminLogout();
  const { data, error, loading, refreshing, refresh, reload, setData } = useApi(() => api.adminOverview());
  usePolling(reload, 15_000);

  const title = config?.eventName || 'Tech Arena';
  const header = { title, subtitle: 'Admin console', back: false, right: <Badge label="Admin" tone="violet" /> };

  if (loading) {
    return (
      <Screen {...header}>
        <LoadingView message="Loading event status…" />
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

  const evaluationsComplete = data.expectedEvaluations > 0 && data.evaluations >= data.expectedEvaluations;

  return (
    <Screen {...header} refreshing={refreshing} onRefresh={refresh}>
      {error ? <Banner type="error" message={`Could not refresh: ${error.message}`} action={{ label: 'Retry', onPress: () => void refresh() }} /> : null}

      <HomeGrid>
        <AppTile label="Teams" icon="people" gradient="violet" href="/admin/teams" />
        <AppTile label="Judges" icon="ribbon" gradient="blue" href="/admin/judges" badge={data.judges === 0 ? true : undefined} />
        <AppTile
          label="Order"
          icon="shuffle"
          gradient="orange"
          href="/admin/order"
          badge={!data.orderGenerated && data.teams > 0 ? true : undefined}
        />
        <AppTile label="Leaderboard" icon="podium" gradient="cyan" href="/admin/leaderboard" />
        <AppTile
          label="Results"
          icon="trophy"
          gradient="gold"
          href="/admin/results"
          badge={evaluationsComplete && !data.resultsPublished ? true : undefined}
        />
        <AppTile label="Ratings" icon="star" gradient="pink" href="/admin/ratings" />
      </HomeGrid>

      <RegistrationCard overview={data} onChanged={(registrationOpen) => {
        setData((d) => (d ? { ...d, registrationOpen, ...(registrationOpen ? { orderGenerated: false, orderGeneratedAt: null } : null) } : d));
        void reload();
      }} />

      <SectionTitle title="Judging progress" />
      <Card>
        <View style={styles.progressHead}>
          <AppText variant="bodyStrong">
            {data.evaluations} of {data.expectedEvaluations} evaluations
          </AppText>
          <AppText variant="label" color={evaluationsComplete ? 'success' : 'accent'}>
            {data.expectedEvaluations > 0 ? `${Math.round((Math.min(data.evaluations, data.expectedEvaluations) / data.expectedEvaluations) * 100)}%` : '—'}
          </AppText>
        </View>
        <ProgressBar
          value={data.evaluations}
          max={data.expectedEvaluations}
          color={evaluationsComplete ? colors.success : colors.accent}
          style={styles.bar}
        />
        <AppText variant="caption" color="muted">
          {data.expectedEvaluations === 0
            ? 'Add teams and active judges to start judging.'
            : evaluationsComplete
              ? data.resultsPublished
                ? 'All teams evaluated. Results are published.'
                : 'All teams evaluated. Results can be published.'
              : `Every team needs a score from each of the ${data.judges} active judges.`}
        </AppText>
      </Card>

      <SectionTitle title="Event status" />
      <StatRow>
        <StatTile label="Teams" value={data.teams} icon="people" tone="violet" />
        <StatTile label="Participants" value={data.participants} icon="person" tone="accent" />
        <StatTile label="Active judges" value={data.judges} icon="ribbon" tone={data.judges > 0 ? 'accent' : 'warning'} />
        <StatTile
          label="Order ready"
          value={data.orderGenerated ? 'Yes' : 'No'}
          icon="shuffle"
          tone={data.orderGenerated ? 'success' : 'neutral'}
          hint={data.orderGenerated ? formatRelative(data.orderGeneratedAt) : undefined}
        />
        <StatTile
          label="Published"
          value={data.resultsPublished ? 'Yes' : 'No'}
          icon="trophy"
          tone={data.resultsPublished ? 'gold' : 'neutral'}
          hint={data.resultsPublished ? formatDateTime(data.resultsPublishedAt) : undefined}
        />
        <StatTile
          label="Email"
          value={data.emailConfigured ? 'On' : 'Off'}
          icon="mail"
          tone={data.emailConfigured ? 'success' : 'warning'}
          hint={data.emailConfigured ? 'Login emails work' : 'SMS / WhatsApp only'}
        />
        <MissingPhotosTile overview={data} />
        <MissingPostersTile overview={data} />
      </StatRow>
      {!data.emailConfigured ? (
        <Banner
          type="info"
          title="Email is not configured"
          message="Set the RESEND_API_KEY secret on the Worker to email login details. Leads can still share logins by SMS or WhatsApp."
        />
      ) : null}
      <HomeGrid>
        <AppTile label="Logout" icon="log-out" onPress={() => void logout()} />
      </HomeGrid>
    </Screen>
  );
}

function MissingPostersTile({ overview }: { overview: AdminOverview }) {
  const missing = overview.missingPosters ?? 0;
  return (
    <StatTile
      label="Missing posters"
      value={missing}
      icon="document-attach"
      tone={missing > 0 ? 'warning' : 'success'}
      hint={missing > 0 ? 'Teams without a poster' : 'Every team has a poster'}
    />
  );
}

function MissingPhotosTile({ overview }: { overview: AdminOverview }) {
  const missing = missingPhotosOf(overview);
  if (missing === null) return null;
  return (
    <StatTile
      label="Missing photos"
      value={missing}
      icon="camera"
      tone={missing > 0 ? 'warning' : 'success'}
      hint={missing > 0 ? 'People without a profile photo' : 'Everyone has a photo'}
    />
  );
}

function RegistrationCard({ overview, onChanged }: { overview: AdminOverview; onChanged: (open: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = overview.registrationOpen;
  const judgingStarted = overview.evaluations > 0;
  const reopenLocked = !open && judgingStarted;

  const toggle = async (next: boolean) => {
    setError(null);
    const ok = next
      ? await confirm(
          'Re-open registration?',
          `New teams will be able to register and leads can edit their teams again.${
            overview.orderGenerated ? '\n\nThis CLEARS the current presentation order. You will need to generate it again.' : ''
          }\n\nThis is not possible once judging has started.`,
          'Re-open',
          { destructive: overview.orderGenerated },
        )
      : await confirm(
          'Close registration?',
          'New teams can no longer register, and leads can no longer add members or edit their project.',
          'Close registration',
        );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await api.setRegistration(next);
      successFeedback();
      onChanged(res.registrationOpen);
      void fetchConfig(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionTitle title="Registration" />
      <Card tone={open ? 'success' : 'default'}>
        <View style={styles.regRow}>
          <View style={styles.regText}>
            <View style={styles.regTitle}>
              <AppText variant="subheading">Team registration</AppText>
              <Badge label={open ? 'Open' : 'Closed'} tone={open ? 'success' : 'neutral'} icon={open ? 'lock-open' : 'lock-closed'} />
            </View>
            <AppText variant="caption" color="muted">
              {open
                ? 'Leads can register teams and manage members. Generating the order closes registration.'
                : reopenLocked
                  ? 'Judging has started, so registration can no longer be re-opened.'
                  : 'Re-opening clears the presentation order. It is not possible after judging starts.'}
            </AppText>
          </View>
          <Switch
            value={open}
            onValueChange={(v) => void toggle(v)}
            disabled={busy || reopenLocked}
            trackColor={{ false: colors.faint, true: colors.success }}
            thumbColor={colors.card}
            accessibilityLabel={open ? 'Close registration' : 'Open registration'}
          />
        </View>
        {error ? <Banner type="error" message={error} style={styles.regError} onClose={() => setError(null)} /> : null}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bar: { marginVertical: spacing.md },
  regRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  regText: { flex: 1, gap: spacing.xs },
  regTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  regError: { marginTop: spacing.md, marginBottom: 0 },
});
