import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInputInstance } from 'react-native';

import { api, isApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { AppText, Banner, Button, Card, Screen, TextField } from '@/components';
import { formErrorMessage, serverFieldErrors } from '@/features/team/forms';
import { LeadOnlyNotice } from '@/features/team/notices';
import { compact, LIMITS, passwordError, type FieldErrors } from '@/features/team/validation';
import { errorFeedback, successFeedback } from '@/lib/haptics';
import { colors, spacing } from '@/theme';

export default function ChangePasswordScreen() {
  const { role } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmValue, setConfirmValue] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const nextRef = useRef<TextInputInstance>(null);
  const confirmRef = useRef<TextInputInstance>(null);

  if (role !== 'lead') {
    return (
      <Screen title="Change password" backHref="/team">
        <LeadOnlyNotice what="change the team password" />
      </Screen>
    );
  }

  const clearError = (key: string) => {
    if (errors[key]) setErrors(({ [key]: _, ...rest }) => rest);
  };

  const onSubmit = async () => {
    setFormError(null);
    const local = compact({
      currentPassword: current ? undefined : 'Enter the current team password',
      newPassword:
        passwordError(next, 'New password') ??
        (next === current ? 'Choose a password different from the current one' : undefined),
      confirm: !confirmValue ? 'Re-enter the new password' : confirmValue !== next ? 'Passwords do not match' : undefined,
    });
    setErrors(local);
    if (Object.keys(local).length) {
      errorFeedback();
      return;
    }
    try {
      await api.changePassword({ currentPassword: current, newPassword: next });
      successFeedback();
      setCurrent('');
      setNext('');
      setConfirmValue('');
      setErrors({});
      setDone(true);
    } catch (e) {
      errorFeedback();
      if (isApiError(e) && e.status === 401) {
        setErrors({ currentPassword: 'Current password is incorrect' });
        return;
      }
      setErrors(serverFieldErrors(e));
      setFormError(formErrorMessage(e));
    }
  };

  if (done) {
    return (
      <Screen title="Change password" backHref="/team" maxWidth={560}>
        <Card tone="success" style={styles.doneCard}>
          <View style={styles.doneIcon}>
            <Ionicons name="checkmark-circle" size={56} color={colors.success} />
          </View>
          <AppText variant="heading" align="center">
            Team password changed
          </AppText>
          <AppText color="textSecondary" align="center" style={styles.doneText}>
            Anyone already logged in stays logged in. New logins need the new password, so send your teammates their updated login
            details.
          </AppText>
          <View style={styles.actions}>
            <Button title="Re-send login details" icon="paper-plane" onPress={() => router.replace('/team/notify')} />
            <Button title="Back to home" variant="ghost" onPress={() => router.replace('/team')} />
          </View>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title="Change password" backHref="/team" maxWidth={560}>
      <Banner
        type="info"
        message="This is the one password your whole team uses to log in. After changing it, send everyone the new login details."
      />
      <Card>
        <TextField
          label="Current password"
          type="password"
          value={current}
          onChangeText={(v) => {
            setCurrent(v);
            clearError('currentPassword');
          }}
          error={errors.currentPassword}
          autoComplete="current-password"
          icon="lock-closed-outline"
          returnKeyType="next"
          onSubmitEditing={() => nextRef.current?.focus()}
        />
        <TextField
          ref={nextRef}
          label="New password"
          type="password"
          value={next}
          onChangeText={(v) => {
            setNext(v);
            clearError('newPassword');
          }}
          error={errors.newPassword}
          placeholder={`At least ${LIMITS.passwordMin} characters`}
          autoComplete="new-password"
          textContentType="newPassword"
          icon="key-outline"
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
        />
        <TextField
          ref={confirmRef}
          label="Confirm new password"
          type="password"
          value={confirmValue}
          onChangeText={(v) => {
            setConfirmValue(v);
            clearError('confirm');
          }}
          error={errors.confirm}
          autoComplete="new-password"
          textContentType="newPassword"
          icon="key-outline"
          returnKeyType="done"
          onSubmitEditing={() => void onSubmit()}
        />
        {formError ? <Banner type="error" message={formError} onClose={() => setFormError(null)} /> : null}
        <Button title="Change password" icon="checkmark" size="lg" onPress={onSubmit} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  doneCard: { alignItems: 'stretch', paddingVertical: spacing.xl },
  doneIcon: { alignItems: 'center', marginBottom: spacing.md },
  doneText: { marginTop: spacing.sm, marginBottom: spacing.xl },
  actions: { gap: spacing.md },
});
