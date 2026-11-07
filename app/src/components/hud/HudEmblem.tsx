import Ionicons from '@expo/vector-icons/Ionicons';
import type { StyleProp, ViewStyle } from 'react-native';

import { palette } from '@/theme';

import { Burst } from '../comic/Burst';
import type { IconName } from '../icons';

export interface HudEmblemProps {
  icon: IconName;
  /** Burst fill (default yellow). */
  color?: string;
  /** Icon size in px; the burst is about 1.8x this (default 64). */
  size?: number;
  /** @deprecated No rings any more. */
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Screen emblem: an ink icon on a small comic starburst. */
export function HudEmblem({ icon, color = palette.yellow, size = 64, style }: HudEmblemProps) {
  const fill = color === palette.ink ? palette.yellow : color;
  return (
    <Burst size={Math.round(size * 1.8)} color={fill} points={12} depth={0.8} shadow={4} style={[{ transform: [{ rotate: '-6deg' }] }, style]}>
      <Ionicons name={icon} size={size * 0.62} color={palette.ink} />
    </Burst>
  );
}
