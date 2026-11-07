import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, isApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { AppText, Banner, Button, Card, ErrorView, goBack, LoadingView, Screen, TeamColorPicker } from '@/components';
import { TeamBanner } from '@/components/comic/TeamBanner';
import { LeadOnlyNotice } from '@/features/team/notices';
import { useApi } from '@/hooks';
import { errorFeedback, successFeedback } from '@/lib/haptics';
import { teamColorOf } from '@/lib/teamColor';
import { spacing } from '@/theme';

/** Lead picks the team banner colour; colours other teams use are crossed out. */
export default function TeamColorScreen() {
  const { role, session, refreshMe } = useAuth();
  const team = session?.team;
  const palette = useApi(() => api.teamColors());
  const [picked, setPicked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (role !== 'lead') {
    return (
      <Screen title="Team colour" backHref="/team">
        <LeadOnlyNotice what="change the team colour" />
      </Screen>
    );
  }
  if (palette.loading) {
    return (
      <Screen title="Team colour" backHref="/team">
        <LoadingView />
      </Screen>
    );
  }
  if (!palette.data) {
    return (
      <Screen title="Team colour" backHref="/team">
        <ErrorView error={palette.error} onRetry={palette.refresh} />
      </Screen>
    );
  }

  const current = team?.color ?? null;
  const chosen = picked ?? current;
  const changed = chosen !== null && chosen !== current;

  const save = async () => {
    if (!chosen) return;
    setError(null);
    setSaving(true);
    try {
      await api.setTeamColor(chosen);
      await Promise.all([refreshMe(), palette.refresh()]);
      setPicked(null);
      successFeedback();
      goBack('/team');
    } catch (e) {
      errorFeedback();
      if (isApiError(e) && e.fields?.color) {
        setError(e.fields.color);
        setPicked(null);
        void palette.refresh();
      } else {
        setError(e instanceof Error ? e.message : 'Could not save the colour.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title="Team colour" subtitle={team?.name} backHref="/team" maxWidth={640}>
      <TeamBanner
        name={team?.name ?? 'Your team'}
        color={chosen ?? teamColorOf(team)}
        projectTitle={team?.projectTitle}
        imageUrl={team?.imageUrl ?? null}
        kicker="Preview"
        size="md"
      />
      <Card>
        <AppText variant="caption" color="muted" style={styles.note}>
          Your colour is used for your team banner and your auto poster. Every team has a different colour, so crossed-out
          ones belong to other teams.
        </AppText>
        <TeamColorPicker options={palette.data.colors} value={chosen} ownColor={current} onChange={setPicked} disabled={saving} />
      </Card>
      {error ? <Banner type="error" message={error} onClose={() => setError(null)} /> : null}
      <View style={styles.actions}>
        <Button title="Save colour" icon="color-palette" size="lg" onPress={save} loading={saving} disabled={!changed} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { marginBottom: spacing.md },
  actions: { marginTop: spacing.sm },
});
