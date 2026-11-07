import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

/** Light tap feedback (buttons, digit entry). No-op on web. */
export function tapFeedback(): void {
  if (enabled) void Haptics.selectionAsync().catch(() => undefined);
}

export function successFeedback(): void {
  if (enabled) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

export function errorFeedback(): void {
  if (enabled) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
}
