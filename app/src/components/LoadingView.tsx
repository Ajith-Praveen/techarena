import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, spacing } from '@/theme';

import { AppText } from './AppText';
import { HudBackground } from './hud/HudBackground';

export interface LoadingViewProps {
  message?: string;
  /** Fill the whole screen with the app background (default false: fills its parent). */
  fullScreen?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function LoadingView({ message, fullScreen = false, style }: LoadingViewProps) {
  return (
    <View style={[styles.wrap, fullScreen ? styles.full : null, style]} accessibilityLabel={message ?? 'Loading'}>
      {fullScreen ? <HudBackground /> : null}
      <ActivityIndicator size="large" color={colors.accent} />
      {message ? (
        <AppText variant="footnote" color="muted" align="center" style={styles.message}>
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl },
  full: { flex: 1, backgroundColor: colors.bg },
  message: { marginTop: spacing.lg },
});
