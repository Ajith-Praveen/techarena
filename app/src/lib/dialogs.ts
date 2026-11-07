import { Alert, Platform } from 'react-native';

export interface ConfirmOptions {
  cancelText?: string;
  /** Red confirm button on iOS. */
  destructive?: boolean;
}

/** Yes/no dialog. Uses window.confirm on web, where RN Alert buttons do not work. */
export function confirm(
  title: string,
  message = '',
  confirmText = 'OK',
  { cancelText = 'Cancel', destructive = false }: ConfirmOptions = {},
): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return Promise.resolve(false);
    return Promise.resolve(window.confirm(message ? `${title}\n\n${message}` : title));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message || undefined,
      [
        { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
        { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/** Simple message dialog; resolves when dismissed. */
export function alert(title: string, message = ''): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message ? `${title}\n\n${message}` : title);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    Alert.alert(title, message || undefined, [{ text: 'OK', onPress: () => resolve() }], {
      cancelable: true,
      onDismiss: () => resolve(),
    });
  });
}

/** Alias of `alert` for "toast-ish" notices. */
export const notify = alert;
