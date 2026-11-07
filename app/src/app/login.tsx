import { Redirect, router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInputInstance } from 'react-native';

import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { homeFor } from '@/auth/routes';
import { AppText, HudEmblem, Banner, Button, Card, Divider, Screen, TextField } from '@/components';
import { formErrorMessage, serverFieldErrors } from '@/features/team/forms';
import { compact, phoneError, type FieldErrors } from '@/features/team/validation';
import { useConfig } from '@/hooks';
import { errorFeedback } from '@/lib/haptics';
import { spacing } from '@/theme';

export default function LoginScreen() {
  const { role, signIn } = useAuth();
  const { config } = useConfig();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const signingIn = useRef(false);

  if (role && !signingIn.current) return <Redirect href={homeFor(role)} />;

  const submit = async () => {
    setFormError(null);
    const local = compact({
      phone: phoneError(phone),
      password: password ? undefined : 'Enter your team password',
    });
    setErrors(local);
    if (Object.keys(local).length) {
      errorFeedback();
      return;
    }
    signingIn.current = true;
    try {
      const session = await api.login({ phone: phone.trim(), password });
      await signIn(session);
      router.replace('/');
    } catch (e) {
      signingIn.current = false;
      errorFeedback();
      setErrors(serverFieldErrors(e));
      setFormError(formErrorMessage(e));
    }
  };

  const eventName = config?.eventName || 'Tech Arena';
  const canRegister = config?.registrationOpen !== false;

  return (
    <Screen title="Team login" backHref="/welcome" maxWidth={520}>
      <View style={styles.hero}>
        <HudEmblem icon="people" style={styles.logo} />
        <AppText variant="title2" align="center" style={styles.caps}>
          {eventName}
        </AppText>
        <AppText variant="subheadline" color="secondaryLabel" align="center">
          Log in with your phone number and the team password.
        </AppText>
      </View>

      <Card>
        <TextField
          label="Phone number"
          type="phone"
          value={phone}
          onChangeText={(v) => {
            setPhone(v);
            if (errors.phone) setErrors(({ phone: _, ...rest }) => rest);
          }}
          error={errors.phone}
          placeholder="Your 10-digit mobile number"
          icon="call-outline"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          maxLength={20}
        />
        <TextField
          ref={passwordRef}
          label="Team password"
          type="password"
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            if (errors.password) setErrors(({ password: _, ...rest }) => rest);
          }}
          error={errors.password}
          placeholder="Set by your team lead"
          icon="lock-closed-outline"
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
        />
        {formError ? <Banner type="error" message={formError} onClose={() => setFormError(null)} /> : null}
        <Button title="Log in" icon="log-in-outline" size="lg" onPress={submit} />
      </Card>

      <AppText variant="caption" color="muted" align="center" style={styles.help}>
        Don't have the password? Ask your team lead to send your login details from the app.
      </AppText>

      <Divider label="or" />

      <View style={styles.links}>
        {canRegister ? (
          <Button
            title="Register a new team"
            icon="person-add-outline"
            variant="secondary"
            onPress={() => router.replace('/register')}
          />
        ) : null}
        <Button title="I'm a judge" icon="ribbon-outline" variant="ghost" onPress={() => router.replace('/judge-login')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.lg, paddingBottom: spacing.xl },
  logo: { marginBottom: spacing.sm },
  caps: {},
  help: { marginTop: spacing.sm },
  links: { gap: spacing.md },
});
