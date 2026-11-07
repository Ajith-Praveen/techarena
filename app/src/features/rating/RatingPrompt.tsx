import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/api/client';
import { AppText, Button, TextField } from '@/components';
import { Burst } from '@/components/comic/Burst';
import { useConfig } from '@/hooks';
import { errorMessage } from '@/lib/errors';
import { errorFeedback, successFeedback, tapFeedback } from '@/lib/haptics';
import { openUrl } from '@/lib/share';
import { colors, fonts, hardShadow, ink, palette, radius, spacing } from '@/theme';

const LABELS = ['', 'Not good', 'Could be better', 'Okay', 'Good', 'Loved it!'];

// "Later" hides the prompt until the app is opened again (it comes back until they rate).
let dismissedThisRun = false;

/**
 * Asks the signed-in team member or judge to rate Tech Arena (1-5 stars + optional feedback)
 * once `ready` is true and they have not rated yet. After rating, offers "Star on GitHub".
 */
export function RatingPrompt({ ready }: { ready: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ready || dismissedThisRun) return;
    let cancelled = false;
    api
      .myRating()
      .then((r) => {
        if (!cancelled && !r.rating) setVisible(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ready]);

  const close = useCallback(() => {
    dismissedThisRun = true;
    setVisible(false);
  }, []);

  if (!visible) return null;
  return <RatingSheet onClose={close} onDone={() => setVisible(false)} />;
}

function RatingSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { config } = useConfig();
  const [stars, setStars] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const githubUrl = config?.githubUrl || '';

  const submit = async () => {
    if (!stars) {
      setError('Tap the stars to pick a rating.');
      errorFeedback();
      return;
    }
    setError(null);
    try {
      await api.rateApp({ stars, ...(feedback.trim() ? { feedback: feedback.trim() } : {}) });
      successFeedback();
      setSent(true);
    } catch (e) {
      errorFeedback();
      setError(errorMessage(e));
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={sent ? onDone : onClose} statusBarTranslucent>
      <View style={[styles.backdrop, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.sheet, hardShadow(6)]}>
            <Burst size={104} color={palette.yellow} points={12} shadow={4} style={styles.burst}>
              <Ionicons name={sent ? 'heart' : 'star'} size={38} color={sent ? palette.red : palette.ink} />
            </Burst>

            {sent ? (
              <>
                <AppText style={styles.title}>Thanks a ton!</AppText>
                <AppText color="textSecondary" align="center" style={styles.body}>
                  Your rating helps us make Tech Arena better.
                  {githubUrl ? ' Got a GitHub account? Give the project a star too.' : ''}
                </AppText>
                <View style={styles.actions}>
                  {githubUrl ? (
                    <Button
                      title="Star on GitHub"
                      icon="logo-github"
                      onPress={() => {
                        void openUrl(githubUrl);
                      }}
                    />
                  ) : null}
                  <Button title="Done" variant="secondary" onPress={onDone} />
                </View>
              </>
            ) : (
              <>
                <AppText style={styles.title}>Rate Tech Arena!</AppText>
                <AppText color="textSecondary" align="center" style={styles.body}>
                  How was the app for you? It takes five seconds.
                </AppText>
                <View style={styles.stars} accessibilityRole="radiogroup">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable
                      key={n}
                      onPress={() => {
                        tapFeedback();
                        setStars(n);
                        setError(null);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: stars === n }}
                      accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`}
                      hitSlop={6}
                      style={({ pressed }) => (pressed ? styles.pressed : null)}
                    >
                      <Ionicons name={n <= stars ? 'star' : 'star-outline'} size={44} color={n <= stars ? palette.yellow : colors.faint} style={n <= stars ? styles.starOn : null} />
                    </Pressable>
                  ))}
                </View>
                <AppText style={styles.label}>{LABELS[stars] || ' '}</AppText>
                <TextField
                  label="Feedback (optional)"
                  type="multiline"
                  value={feedback}
                  onChangeText={setFeedback}
                  placeholder="What did you like? What should we fix?"
                  maxLength={1000}
                  containerStyle={styles.field}
                />
                {error ? (
                  <AppText variant="footnote" color="danger" align="center" style={styles.error}>
                    {error}
                  </AppText>
                ) : null}
                <View style={styles.actions}>
                  <Button title="Send rating" icon="send" onPress={submit} />
                  <Button title="Later" variant="ghost" onPress={onClose} />
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(17, 17, 17, 0.55)' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  sheet: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    backgroundColor: palette.paper,
    borderWidth: ink.thick,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.xl,
    paddingTop: spacing.xxxl + spacing.lg,
    alignItems: 'stretch',
  },
  burst: { position: 'absolute', top: -52, alignSelf: 'center', transform: [{ rotate: '-8deg' }] },
  title: { fontFamily: fonts.display, fontSize: 36, lineHeight: 40, letterSpacing: 1, color: palette.ink, textAlign: 'center' },
  body: { marginTop: spacing.xs, marginBottom: spacing.lg },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
  starOn: { textShadowColor: palette.ink, textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 },
  pressed: { transform: [{ scale: 0.9 }] },
  label: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: palette.ink, textAlign: 'center', marginVertical: spacing.sm },
  field: { marginBottom: spacing.md },
  error: { marginBottom: spacing.md },
  actions: { gap: spacing.md },
});
