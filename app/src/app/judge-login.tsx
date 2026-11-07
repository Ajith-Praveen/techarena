import { Redirect, router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInputInstance } from 'react-native';

import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { homeFor } from '@/auth/routes';
import { AppText, HudEmblem, Banner, Button, Card, Screen, TextField } from '@/components';
import { errorFeedback, errorMessage, fieldErrors } from '@/lib';
import { spacing } from '@/theme';

export default function JudgeLoginScreen() {
  const { role, loading, signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);

  if (!loading && role && !submitting) return <Redirect href={homeFor(role)} />;

  const onSubmit = async () => {
    if (submitting) return;
    const next: Record<string, string> = {};
    if (!username.trim()) next.username = 'Enter your username';
    if (!password) next.password = 'Enter your password';
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      const session = await api.judgeLogin({ username: username.trim().toLowerCase(), password });
      await signIn(session);
      router.replace('/');
    } catch (e) {
      errorFeedback();
      setErrors(fieldErrors(e));
      setFormError(errorMessage(e));
      setSubmitting(false);
    }
  };

  return (
    <Screen title="Judge login" backHref="/welcome" maxWidth={520}>
      <View style={styles.hero}>
        <HudEmblem icon="ribbon" />
        <AppText variant="title2" align="center" style={styles.caps}>
          Judge console
        </AppText>
        <AppText variant="caption" color="secondaryLabel" align="center">
          Use the username and password from the event admin.
        </AppText>
      </View>

      <Card>
        {formError ? <Banner type="error" message={formError} /> : null}
        <TextField
          label="Username"
          type="username"
          icon="person-outline"
          value={username}
          onChangeText={(v) => {
            setUsername(v);
            if (errors.username) setErrors((e) => ({ ...e, username: '' }));
          }}
          error={errors.username}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          submitBehavior="submit"
          editable={!submitting}
          autoFocus
        />
        <TextField
          ref={passwordRef}
          label="Password"
          type="password"
          icon="lock-closed-outline"
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            if (errors.password) setErrors((e) => ({ ...e, password: '' }));
          }}
          error={errors.password}
          returnKeyType="go"
          onSubmitEditing={() => void onSubmit()}
          editable={!submitting}
        />
        <Button title="Log in" icon="log-in-outline" size="lg" onPress={onSubmit} loading={submitting} />
      </Card>

      <AppText variant="caption" color="faint" align="center" style={styles.note}>
        Forgot your password? Ask the event admin to reset it.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.xl },
  caps: {},
  intro: { marginTop: spacing.lg, marginBottom: spacing.sm, marginHorizontal: spacing.lg },
  note: { marginTop: spacing.md },
});
