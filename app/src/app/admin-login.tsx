import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInputInstance } from 'react-native';

import { api } from '@/api/client';
import type { AdminLoginRequest } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { AppText, HudEmblem, Banner, Button, Screen, TextField } from '@/components';
import { errorMessage, errorFeedback, fieldErrors, successFeedback, toApiError } from '@/lib';
import { colors, spacing } from '@/theme';

export default function AdminLoginScreen() {
  const { signIn } = useAuth();
  const passwordRef = useRef<TextInputInstance>(null);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<{ message: string; unavailable: boolean } | null>(null);

  const submit = async () => {
    const nextErrors: Record<string, string> = {};
    if (!username.trim()) nextErrors.username = 'Enter the admin username';
    if (!password) nextErrors.password = 'Enter the admin password';
    setErrors(nextErrors);
    setFormError(null);
    if (Object.keys(nextErrors).length) return;

    const body: AdminLoginRequest = { username: username.trim(), password };
    try {
      const session = await api.adminLogin(body);
      successFeedback();
      await signIn(session);
      router.replace('/');
    } catch (e) {
      errorFeedback();
      const err = toApiError(e);
      setErrors(fieldErrors(err));
      setFormError({
        message:
          err.status === 503
            ? errorMessage(err) || 'Admin login is not configured on the server (ADMIN_PASSWORD secret is missing).'
            : errorMessage(err),
        unavailable: err.status === 503,
      });
    }
  };

  return (
    <Screen title="Admin" backHref="/welcome" maxWidth={480}>
      <View style={styles.hero}>
        <HudEmblem icon="shield-checkmark" color={colors.amber} />
        <AppText variant="title" align="center">
          Admin sign in
        </AppText>
        <AppText color="muted" align="center">
          Organisers only. Manage teams, judges, the presentation order and results.
        </AppText>
      </View>

      {formError ? (
        <Banner
          type={formError.unavailable ? 'warning' : 'error'}
          title={formError.unavailable ? 'Admin login unavailable' : 'Could not sign in'}
          message={formError.message}
        />
      ) : null}

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
        onSubmitEditing={() => void submit()}
        autoFocus
      />
      <Button title="Sign in" icon="log-in-outline" size="lg" onPress={submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.xl },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
});
