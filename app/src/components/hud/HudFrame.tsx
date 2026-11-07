import type { StyleProp, ViewStyle } from 'react-native';

export interface HudFrameProps {
  color?: string;
  size?: number;
  thickness?: number;
  inset?: number;
  style?: StyleProp<ViewStyle>;
}

/** @deprecated Corner brackets were removed from the design; kept so existing code compiles. */
export function HudFrame(_props: HudFrameProps) {
  return null;
}
