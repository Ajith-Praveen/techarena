import { useState } from 'react';
import { Image, View } from 'react-native';

import { imageUri } from '@/api/client';
import { Avatar } from '@/components';
import { colors } from '@/theme';

/** Round profile photo with an initials fallback. */
export function PersonAvatar({ name, photoUrl, size = 40 }: { name: string; photoUrl: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const uri = imageUri(photoUrl);
  if (!uri || failed) return <Avatar name={name} size={size} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: colors.surface }}>
      <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" onError={() => setFailed(true)} />
    </View>
  );
}
