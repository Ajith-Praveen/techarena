import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Avatar } from '@/components';

export interface PersonAvatarProps {
  name: string;
  /** Relative server URL or a local URI. Falls back to initials when missing or broken. */
  photoUrl?: string | null;
  size?: number;
  /** Colored ring, e.g. to highlight the viewer. */
  ringColor?: string;
  style?: StyleProp<ViewStyle>;
}

/** Shared Avatar with an optional highlight ring. */
export function PersonAvatar({ name, photoUrl, size = 40, ringColor, style }: PersonAvatarProps) {
  if (!ringColor) {
    return (
      <View style={style}>
        <Avatar name={name} photoUrl={photoUrl} size={size} />
      </View>
    );
  }
  return (
    <View style={[{ borderWidth: 2, borderColor: ringColor, padding: 2, borderRadius: size }, style]}>
      <Avatar name={name} photoUrl={photoUrl} size={size - 8} />
    </View>
  );
}
