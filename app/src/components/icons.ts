import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

/** Any Ionicons glyph name, e.g. 'trophy', 'people-outline'. */
export type IconName = ComponentProps<typeof Ionicons>['name'];
