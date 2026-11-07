import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { fonts, palette, spacing } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { Burst } from './comic/Burst';
import type { IconName } from './icons';

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void | Promise<unknown>; icon?: IconName };
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({ icon = 'file-tray-outline', title, message, action, style }: EmptyStateProps) {
  return (
    <View style={[styles.wrap, style]}>
      <Burst size={96} color={palette.white} points={11} depth={0.8} shadow={4} style={styles.burst}>
        <Ionicons name={icon} size={32} color={palette.ink} />
      </Burst>
      <AppText align="center" style={styles.title}>
        {title}
      </AppText>
      {message ? (
        <AppText variant="footnote" color="muted" align="center" style={styles.message}>
          {message}
        </AppText>
      ) : null}
      {action ? (
        <Button
          title={action.label}
          icon={action.icon}
          onPress={action.onPress}
          variant="secondary"
          size="sm"
          fullWidth={false}
          style={styles.button}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl },
  burst: { marginBottom: spacing.md, transform: [{ rotate: '-8deg' }] },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, letterSpacing: 1, color: palette.ink },
  message: { marginTop: spacing.xs + 2, maxWidth: 420 },
  button: { marginTop: spacing.lg, alignSelf: 'center' },
});
