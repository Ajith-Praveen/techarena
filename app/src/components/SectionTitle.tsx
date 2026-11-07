import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { spacing } from '@/theme';

import { AppText } from './AppText';

export interface SectionTitleProps {
  title: string;
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
}

/** Comic caption section label with an optional right-side link. */
export function SectionTitle({ title, action, style }: SectionTitleProps) {
  return (
    <View style={[styles.row, style]}>
      <AppText variant="sectionHeader" numberOfLines={1} style={styles.title}>
        {title}
      </AppText>
      {action ? (
        <Pressable onPress={action.onPress} hitSlop={8} accessibilityRole="button" style={({ pressed }) => (pressed ? styles.pressed : null)}>
          <AppText variant="label" color="accent" style={styles.link}>
            {action.label}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm + 2,
  },
  title: { flex: 1 },
  pressed: { opacity: 0.5 },
  link: { textDecorationLine: 'underline' },
});
