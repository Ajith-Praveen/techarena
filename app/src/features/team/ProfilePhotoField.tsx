import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button } from '@/components';
import { alert } from '@/lib/dialogs';
import { pickProfilePhoto, type PickedImage } from '@/lib/image';
import { colors, spacing } from '@/theme';

export interface ProfilePhotoFieldProps {
  label: string;
  value: PickedImage | null;
  onChange: (img: PickedImage | null) => void;
  error?: string | null;
  hint?: string;
  disabled?: boolean;
  size?: number;
}

/** Round profile-photo picker (gallery, plus camera on native). */
export function ProfilePhotoField({ label, value, onChange, error, hint, disabled, size = 96 }: ProfilePhotoFieldProps) {
  const [busy, setBusy] = useState(false);

  const choose = async (source: 'library' | 'camera') => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      const img = await pickProfilePhoto(source);
      if (img) onChange(img);
    } catch (e) {
      await alert('Photo', e instanceof Error ? e.message : 'Could not load that photo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <AppText variant="label" color="textSecondary" style={styles.label}>
        {label}
      </AppText>
      <View style={styles.row}>
        <Pressable
          onPress={() => choose('library')}
          disabled={disabled || busy}
          accessibilityRole="button"
          accessibilityLabel={value ? 'Change profile photo' : 'Choose profile photo'}
          style={({ pressed }) => [
            styles.circle,
            { width: size, height: size, borderRadius: size / 2 },
            error ? styles.circleError : null,
            pressed ? styles.pressed : null,
          ]}
        >
          {value ? (
            <Image source={{ uri: value.uri }} style={{ width: size, height: size }} resizeMode="cover" />
          ) : (
            <Ionicons name="person" size={size * 0.45} color={colors.faint} />
          )}
        </Pressable>
        <View style={styles.actions}>
          <Button
            title={value ? 'Change photo' : 'Choose photo'}
            icon="images-outline"
            variant="secondary"
            size="sm"
            fullWidth={false}
            loading={busy}
            disabled={disabled}
            onPress={() => choose('library')}
          />
          {Platform.OS !== 'web' ? (
            <Button
              title="Take photo"
              icon="camera-outline"
              variant="secondary"
              size="sm"
              fullWidth={false}
              disabled={disabled || busy}
              onPress={() => choose('camera')}
            />
          ) : null}
          {value ? (
            <Button title="Remove" icon="close" variant="ghost" size="sm" fullWidth={false} onPress={() => onChange(null)} />
          ) : null}
        </View>
      </View>
      {error ? (
        <AppText variant="caption" color="danger" style={styles.helper}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" color="muted" style={styles.helper}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.lg },
  label: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, flexWrap: 'wrap' },
  circle: {
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleError: { borderColor: colors.danger },
  pressed: { opacity: 0.85 },
  actions: { flex: 1, minWidth: 160, gap: spacing.sm, alignItems: 'flex-start' },
  helper: { marginTop: spacing.xs },
});
