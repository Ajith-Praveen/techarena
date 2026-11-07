import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useState } from 'react';

import { api, isApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { AppText, autoPosterFor, Banner, Button, Card, ErrorView, LoadingView, PosterView, Screen, SectionTitle } from '@/components';
import { useApi } from '@/hooks';
import { errorMessage } from '@/lib/errors';
import { errorFeedback, successFeedback } from '@/lib/haptics';
import { ImagePickError, pickPoster, toPosterUpload, type PickedImage } from '@/lib/image';
import { teamColorOf } from '@/lib/teamColor';
import { spacing } from '@/theme';

async function loadPoster() {
  const [team, report] = await Promise.all([api.team(), api.report()]);
  const people = team.members.map((m) => ({ name: m.name, role: m.role, photoUrl: m.photoUrl }));
  return { team: team.team, people, locked: (report.scoredCount ?? report.evaluations.length) > 0 || report.resultsPublished };
}

export default function PosterScreen() {
  const { role, refreshMe } = useAuth();
  const { width } = useWindowDimensions();
  const { data, error, loading, refreshing, refresh, reload } = useApi(loadPoster);
  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isLead = role === 'lead';
  const wide = width >= 760;
  const posterWidth = Math.min(wide ? 380 : width - spacing.lg * 2, 420);

  if (loading) {
    return (
      <Screen title="Poster" backHref="/team">
        <LoadingView />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen title="Poster" backHref="/team">
        <ErrorView error={error} onRetry={refresh} />
      </Screen>
    );
  }

  const { team, locked, people } = data;
  const shown = picked?.uri ?? team.posterUrl;
  const auto = autoPosterFor(team, people, teamColorOf(team));

  const choose = async (source: 'library' | 'camera') => {
    setNotice(null);
    try {
      const img = await pickPoster(source);
      if (img) setPicked(img);
    } catch (e) {
      setNotice({ type: 'error', message: e instanceof ImagePickError ? e.message : errorMessage(e) });
    }
  };

  const upload = async () => {
    if (!picked) return;
    setNotice(null);
    try {
      await api.uploadPoster(toPosterUpload(picked));
      successFeedback();
      setPicked(null);
      setNotice({ type: 'success', message: 'Poster uploaded. Judges will see it when they open your team.' });
      await Promise.all([reload(), refreshMe().catch(() => null)]);
    } catch (e) {
      errorFeedback();
      const msg = isApiError(e) && e.code === 'CONFLICT' ? 'The poster is locked because the judges have started scoring your team.' : errorMessage(e);
      setNotice({ type: 'error', message: msg });
      if (isApiError(e) && e.code === 'CONFLICT') void reload();
    }
  };

  const useAuto = async () => {
    setNotice(null);
    try {
      await api.removePoster();
      successFeedback();
      setNotice({ type: 'success', message: 'Done. Judges now see your auto poster.' });
      await Promise.all([reload(), refreshMe().catch(() => null)]);
    } catch (e) {
      errorFeedback();
      setNotice({ type: 'error', message: isApiError(e) && e.code === 'CONFLICT' ? 'The poster is locked because the judges have started scoring your team.' : errorMessage(e) });
    }
  };

  const controls = isLead ? (
    locked ? (
      <Banner type="info" title="Poster locked" message="Judging of your team has started, so the poster can no longer be changed." />
    ) : (
      <Card>
        <SectionTitle title={team.posterUrl ? 'Your own poster' : 'Auto poster'} />
        <AppText variant="footnote" color="textSecondary" style={styles.help}>
          {team.posterUrl
            ? 'Judges see the poster you uploaded. You can replace it, or switch back to the auto poster, until the first judge scores your team.'
            : 'The app made this poster from your project image, description and team, in your team colour. Edit your project or colour and it updates by itself. Prefer your own design? Upload a portrait image of it instead.'}
        </AppText>
        <View style={styles.buttons}>
          <Button title="Upload my own" icon="images-outline" variant="secondary" onPress={() => choose('library')} />
          {Platform.OS !== 'web' ? (
            <Button title="Take photo" icon="camera-outline" variant="secondary" onPress={() => choose('camera')} />
          ) : null}
          {picked ? <Button title="Upload poster" icon="cloud-upload-outline" onPress={upload} /> : null}
          {picked ? <Button title="Cancel" variant="ghost" onPress={() => setPicked(null)} /> : null}
          {team.posterUrl && !picked ? <Button title="Use the auto poster" icon="sparkles" variant="ghost" onPress={useAuto} /> : null}
        </View>
      </Card>
    )
  ) : (
    <Banner
      type="info"
      message={team.posterUrl ? 'This is the poster the judges will see.' : 'This is your auto poster, made from your project. Your team lead can upload your own design instead.'}
    />
  );

  return (
    <Screen title="Poster" subtitle={team.name} backHref="/team" refreshing={refreshing} onRefresh={() => void refresh()}>
      {notice ? <Banner type={notice.type} message={notice.message} onClose={() => setNotice(null)} /> : null}
      <View style={[styles.layout, wide ? styles.layoutWide : null]}>
        <View style={styles.posterCol}>
          {picked ? (
            <AppText variant="sectionHeader" color="amber" style={styles.previewLabel}>
              Preview · not uploaded yet
            </AppText>
          ) : null}
          <PosterView url={shown} auto={auto} width={posterWidth} />
        </View>
        <View style={[styles.controls, wide ? styles.controlsWide : null]}>{controls}</View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  layout: { gap: spacing.lg },
  layoutWide: { flexDirection: 'row', alignItems: 'flex-start' },
  posterCol: { alignItems: 'center' },
  previewLabel: { marginBottom: spacing.sm },
  controls: {},
  controlsWide: { flex: 1 },
  help: { marginBottom: spacing.lg },
  buttons: { gap: spacing.md },
});
