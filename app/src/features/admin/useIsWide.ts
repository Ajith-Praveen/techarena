import { useWindowDimensions } from 'react-native';

import { layout } from '@/theme';

/** True on tablets / desktop browsers (window at least `min` dp wide). */
export function useIsWide(min: number = layout.tabletMinWidth): boolean {
  return useWindowDimensions().width >= min;
}
