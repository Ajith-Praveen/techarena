import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import { palette } from '@/theme';

export interface BurstProps {
  /** Outer diameter in px. */
  size: number;
  /** Fill color (default yellow). */
  color?: string;
  /** Number of spikes (default 14). */
  points?: number;
  /** Inner radius as a share of the outer one (default 0.78). */
  depth?: number;
  /** Offset ink shadow behind the burst, in px (default 6, 0 for none). */
  shadow?: number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Comic "POW" starburst with an ink outline; children are centered on top. */
export function Burst({ size, color = palette.yellow, points = 14, depth = 0.78, shadow = 6, children, style }: BurstProps) {
  const pts = useMemo(() => {
    const r = size / 2 - 3 - shadow / 2;
    const c = size / 2 - shadow / 2;
    const out: string[] = [];
    for (let i = 0; i < points * 2; i++) {
      // Slightly irregular spikes so it looks hand-drawn rather than geometric.
      const jitter = i % 2 === 0 ? 1 - ((i * 37) % 7) / 60 : depth + ((i * 53) % 5) / 80;
      const a = (Math.PI * i) / points - Math.PI / 2;
      out.push(`${(c + Math.cos(a) * r * jitter).toFixed(1)},${(c + Math.sin(a) * r * jitter).toFixed(1)}`);
    }
    return out.join(' ');
  }, [size, points, depth, shadow]);

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {shadow ? <Polygon points={pts} fill={palette.ink} transform={`translate(${shadow} ${shadow})`} /> : null}
        <Polygon points={pts} fill={color} stroke={palette.ink} strokeWidth={3} strokeLinejoin="round" />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center, { right: shadow, bottom: shadow }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
