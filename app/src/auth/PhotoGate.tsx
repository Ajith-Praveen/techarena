import { useState, type ReactNode } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { Banner } from '@/components/Banner';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { errorMessage } from '@/lib/errors';
import { errorFeedback, successFeedback } from '@/lib/haptics';
import { pickProfilePhoto, toImageUpload, type PickedImage } from '@/lib/image';
import { colors, spacing } from '@/theme';

import { useAuth } from './AuthContext';

const PREVIEW = 160;

/**
 * Renders the app, and on top of it a full-screen "Add your profile photo" step while the signed-in
 * lead/member/judge has no photo (`session.needsPhoto`). The navigator stays mounted underneath so
 * routing keeps working; only logging out bypasses the gate.
 */
export function PhotoGate({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  return (
    <View style={styles.fill}>
      {children}
      {session?.needsPhoto ? (
        <View style={[StyleSheet.absoluteFill, styles.overlay]}>
          <PhotoStep />
        </View>
      ) : null}
    </View>
  );
}

function PhotoStep() {
  const { session, refreshMe, signOut } = useAuth();
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = session?.member?.name ?? session?.judge?.name ?? '';
  const why =
    session?.role === 'judge'
      ? 'Teams see it next to your scores.'
      : 'Judges use it to recognise your team at the stall.';

  const choose = async (source: 'camera' | 'library') => {
    setPicking(true);
    setError(null);
    try {
      const img = await pickProfilePhoto(source);
      if (img) setPhoto(img);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load that photo.');
    } finally {
      setPicking(false);
    }
  };

  const save = async () => {
    if (!photo) return;
    setError(null);
    try {
      await api.updatePhoto(toImageUpload(photo));
      successFeedback();
      await refreshMe();
    } catch (e) {
      errorFeedback();
      setError(errorMessage(e));
    }
  };

  return (
    <Screen title="Profile Photo" back={false} maxWidth={520}>
      <View style={styles.hero}>
        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.preview} accessibilityLabel="Selected photo" />
        ) : (
          <Avatar name={name || '?'} size={PREVIEW} />
        )}
        <AppText variant="title3" align="center">
          Add your profile photo
        </AppText>
        <AppText variant="subheadline" color="secondaryLabel" align="center">
          Everyone needs a clear photo of their face. {why}
        </AppText>
      </View>

      {error ? <Banner type="error" message={error} /> : null}

      <Card>
        <View style={styles.actions}>
          <Button
            title="Take Photo"
            icon="camera-outline"
            variant={photo ? 'secondary' : 'primary'}
            disabled={picking}
            onPress={() => choose('camera')}
          />
          <Button
            title="Choose from Gallery"
            icon="images-outline"
            variant="secondary"
            disabled={picking}
            onPress={() => choose('library')}
          />
          {photo ? <Button title="Save Photo" onPress={save} disabled={picking} /> : null}
        </View>
      </Card>
      {Platform.OS === 'web' ? (
        <AppText variant="footnote" color="secondaryLabel" style={styles.footnote}>
          On a phone, Take Photo opens the camera.
        </AppText>
      ) : null}

      <View style={styles.logout}>
        <Button title="Log Out" variant="danger" fullWidth={false} onPress={signOut} style={styles.logoutButton} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  overlay: { backgroundColor: colors.bg, zIndex: 10 },
  hero: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  preview: { width: PREVIEW, height: PREVIEW, borderRadius: PREVIEW / 2, backgroundColor: colors.surface },
  actions: { gap: spacing.md },
  footnote: { marginTop: -spacing.sm, marginBottom: spacing.lg, paddingHorizontal: spacing.lg },
  logout: { alignItems: 'center' },
  logoutButton: { alignSelf: 'center' },
});
