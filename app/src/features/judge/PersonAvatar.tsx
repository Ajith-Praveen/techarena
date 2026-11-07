import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { imageUri } from '@/api/client';
import { Avatar } from '@/components';
import { colors } from '@/theme';

export interface PersonAvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: number;
}

/** Round profile photo, falling back to initials when there is no photo or it fails to load. */
export function PersonAvatar({ name, photoUrl, size = 40 }: PersonAvatarProps) {
  const [failed, setFailed] = useState(false);
  const uri = imageUri(photoUrl);
  if (!uri || failed) return <Avatar name={name} size={size} />;
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        onError={() => setFailed(true)}
        accessibilityLabel={name}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
});
