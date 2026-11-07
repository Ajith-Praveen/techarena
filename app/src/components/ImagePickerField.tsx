import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { alert } from '@/lib/dialogs';
import { pickImage, type PickedImage } from '@/lib/image';
import { colors, ink, radius, spacing } from '@/theme';

import { AppText } from './AppText';
import type { IconName } from './icons';
import { TeamImage } from './TeamImage';

export interface ImagePickerFieldProps {
  label?: string;
  /** Newly picked image (send `value.base64` / `value.mime`). */
  value: PickedImage | null;
  onChange: (image: PickedImage | null) => void;
  /** Current server image (relative URL) shown until a new one is picked. */
  existingUrl?: string | null;
  error?: string | null;
  hint?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** How images are picked and compressed (default: project-image settings). */
  picker?: (source: 'library' | 'camera') => Promise<PickedImage | null>;
}

function ActionRow({
  title,
  icon,
  onPress,
  destructive,
  disabled,
  busy,
  separator,
}: {
  title: string;
  icon: IconName;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  busy?: boolean;
  separator?: boolean;
}) {
  const color = destructive ? colors.danger : colors.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.row, pressed && !disabled ? styles.rowPressed : null, disabled ? styles.disabled : null]}
    >
      <Ionicons name={icon} size={22} color={color} style={styles.rowIcon} />
      <View style={[styles.rowBody, separator ? styles.separator : null]}>
        <AppText variant="body" style={{ color, flex: 1 }}>
          {title}
        </AppText>
        {busy ? <ActivityIndicator size="small" color={colors.accent} /> : null}
      </View>
    </Pressable>
  );
}

/** Grouped section: photo preview plus "Choose Photo" / "Take Photo" / "Remove Photo" rows. */
export function ImagePickerField({
  label,
  value,
  onChange,
  existingUrl,
  error,
  hint = 'A photo of your project. It is resized automatically.',
  disabled = false,
  picker = pickImage,
  style,
}: ImagePickerFieldProps) {
  const [busy, setBusy] = useState(false);
  const previewUrl = value?.uri ?? existingUrl ?? null;
  const allowCamera = Platform.OS !== 'web';

  const choose = async (source: 'library' | 'camera') => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      const img = await picker(source);
      if (img) onChange(img);
    } catch (e) {
      await alert('Image', e instanceof Error ? e.message : 'Could not load that image.');
    } finally {
      setBusy(false);
    }
  };

  const rows: Array<{ key: string; title: string; icon: IconName; onPress: () => void; destructive?: boolean; busy?: boolean }> = [
    {
      key: 'library',
      title: previewUrl ? 'Choose Another Photo' : 'Choose Photo',
      icon: 'images-outline',
      onPress: () => void choose('library'),
      busy,
    },
  ];
  if (allowCamera) rows.push({ key: 'camera', title: 'Take Photo', icon: 'camera-outline', onPress: () => void choose('camera') });
  if (value) rows.push({ key: 'remove', title: 'Remove Photo', icon: 'trash-outline', onPress: () => onChange(null), destructive: true });

  return (
    <View style={[styles.container, style]}>
      {label ? (
        <AppText variant="label" color="textSecondary" style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <View style={[styles.group, error ? styles.groupError : null]}>
        {previewUrl ? (
          <Pressable onPress={() => void choose('library')} disabled={disabled || busy} accessibilityLabel="Change image">
            <TeamImage url={previewUrl} aspectRatio={16 / 9} borderRadius={0} />
          </Pressable>
        ) : null}
        {previewUrl ? <View style={styles.fullSeparator} /> : null}
        {rows.map((r, i) => (
          <ActionRow
            key={r.key}
            title={r.title}
            icon={r.icon}
            onPress={r.onPress}
            destructive={r.destructive}
            busy={r.busy}
            disabled={disabled || (busy && r.key !== 'library')}
            separator={i < rows.length - 1}
          />
        ))}
      </View>
      {error ? (
        <AppText variant="footnote" color="danger" style={styles.helper}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="footnote" color="secondaryLabel" style={styles.helper}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.lg },
  label: { marginBottom: 6 },
  group: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: ink.thin + 0.5, borderColor: colors.borderStrong, overflow: 'hidden' },
  groupError: { borderColor: colors.danger },
  row: { minHeight: 44, flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.lg, backgroundColor: colors.card },
  rowPressed: { backgroundColor: colors.cardPressed },
  rowIcon: { width: 29, marginRight: 15 },
  rowBody: {
    flex: 1,
    alignSelf: 'stretch',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.lg,
  },
  separator: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  fullSeparator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator },
  disabled: { opacity: 0.4 },
  helper: { marginTop: 6 },
});
