import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';

import { colors, palette } from '@/theme';

export interface HudBackgroundProps {
  /** Halftone dot spacing in px (default 14). */
  cell?: number;
  /** Show the halftone dots (default true). */
  glow?: boolean;
}

/** Comic paper page with a faint halftone dot screen. Absolute-fills its parent. */
export const HudBackground = memo(function HudBackground({ cell = 14, glow = true }: HudBackgroundProps) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]}>
      {glow ? (
        <Svg width="100%" height="100%">
          <Defs>
            <Pattern id="halftone" width={cell} height={cell} patternUnits="userSpaceOnUse">
              <Circle cx={cell / 2} cy={cell / 2} r={1.3} fill={palette.ink} fillOpacity={0.09} />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#halftone)" />
        </Svg>
      ) : null}
    </View>
  );
});
