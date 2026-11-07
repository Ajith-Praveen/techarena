import { StyleSheet, View } from 'react-native';

import { JudgeStatusStrip } from '@/features/judge/JudgeStatusStrip';
import { QueueView } from '@/features/shared/QueueView';
import { colors } from '@/theme';

export default function JudgeQueueScreen() {
  return (
    <View style={styles.root}>
      <View style={styles.flex}>
        <QueueView />
      </View>
      <JudgeStatusStrip />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
});
