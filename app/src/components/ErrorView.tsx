import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { toApiError } from '@/lib/errors';
import { colors, spacing } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';

export interface ErrorViewProps {
  /** Anything thrown (ApiError, Error, string). */
  error?: unknown;
  title?: string;
  /** Overrides the message derived from `error`. */
  message?: string;
  onRetry?: () => void | Promise<unknown>;
  fullScreen?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ErrorView({ error, title, message, onRetry, fullScreen = false, style }: ErrorViewProps) {
  const apiError = error !== undefined && error !== null ? toApiError(error) : null;
  const offline = apiError?.code === 'NETWORK';
  return (
    <View style={[styles.wrap, fullScreen ? styles.full : null, style]}>
      <Ionicons name={offline ? 'cloud-offline-outline' : 'warning-outline'} size={40} color={colors.muted} />
      <AppText variant="title3" align="center" style={[styles.title, styles.caps]}>
        {title ?? (offline ? 'No connection' : 'Something went wrong')}
      </AppText>
      <AppText variant="footnote" color="muted" align="center" style={styles.message}>
        {message ?? apiError?.message ?? 'Please try again.'}
      </AppText>
      {onRetry ? (
        <Button title="Try Again" onPress={onRetry} variant="secondary" fullWidth={false} style={styles.button} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  full: { flex: 1, backgroundColor: colors.bg },
  title: { marginTop: spacing.md },
  caps: {},
  message: { marginTop: spacing.xs + 2, maxWidth: 420 },
  button: { marginTop: spacing.md, alignSelf: 'center' },
});
