import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { imageUri } from '@/api/client';
import { colors, radius } from '@/theme';

export interface TeamImageProps {
  /** Relative `/api/images/<id>` URL from the API, or any absolute/local URI. */
  url: string | null | undefined;
  /** Square size in dp. Omit to fill the width with `aspectRatio`. */
  size?: number;
  /** Width / height when `size` is omitted (default 16/9). */
  aspectRatio?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Project image with a placeholder for missing / broken images. */
export function TeamImage({ url, size, aspectRatio = 16 / 9, borderRadius = radius.md, style }: TeamImageProps) {
  const [failed, setFailed] = useState(false);
  const uri = imageUri(url);
  const box: ViewStyle = size ? { width: size, height: size } : { width: '100%', aspectRatio };
  return (
    <View style={[styles.box, box, { borderRadius }, style]}>
      {uri && !failed ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} />
      ) : (
        <Ionicons name="image" size={size ? Math.max(16, size * 0.4) : 40} color={colors.faint} style={styles.placeholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: { opacity: 0.6 },
});
