import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { imageUri } from '@/api/client';
import { initials } from '@/lib/format';
import { colors, fonts } from '@/theme';

import { AppText } from './AppText';

export interface AvatarProps {
  name: string;
  size?: number;
  /** Optional photo (relative `/api/images/<id>` or absolute URI). Falls back to initials. */
  photoUrl?: string | null;
}

/** Contacts-style circle: the photo, or white initials on gray. */
export function Avatar({ name, size = 40, photoUrl }: AvatarProps) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const uri = imageUri(photoUrl ?? null);
  const circle = { width: size, height: size, borderRadius: size / 2 };

  if (uri && uri !== failedUri) {
    return (
      <Image
        source={{ uri }}
        onError={() => setFailedUri(uri)}
        style={[styles.photo, circle, { borderWidth: Math.max(1, size / 28) }]}
        accessibilityLabel={name}
      />
    );
  }
  return (
    <View style={[styles.circle, circle, { borderWidth: Math.max(1, size / 28) }]} accessibilityLabel={name}>
      <AppText
        style={{ color: colors.textSecondary, fontFamily: fonts.serif, fontSize: size * 0.4, lineHeight: size * 0.5 }}
        numberOfLines={1}
      >
        {initials(name) || '?'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  photo: { backgroundColor: colors.surface, borderColor: colors.border },
});
