import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type TextInputInstance } from 'react-native';

import { api } from '@/api/client';
import type { Member } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { AppText, Banner, Button, Card, EmptyState, ErrorView, LoadingView, Screen, SectionTitle, TextField } from '@/components';
import { buildLoginMessage } from '@/features/team/loginMessage';
import { MemberRow } from '@/features/team/MemberRow';
import { LeadOnlyNotice } from '@/features/team/notices';
import { useApi, useConfig } from '@/hooks';
import { errorFeedback, successFeedback } from '@/lib/haptics';
import { copyToClipboard, smsTo, whatsappTo } from '@/lib/share';
import { spacing } from '@/theme';

export default function NotifyScreen() {
  const { role } = useAuth();
  const { config } = useConfig();
  const { data, error, loading, refreshing, refresh } = useApi(() => api.team(), [], { enabled: role === 'lead' });

  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  const members = useMemo(
    () => [...(data?.members ?? [])].sort((a, b) => (a.role === b.role ? 0 : a.role === 'lead' ? -1 : 1)),
    [data],
  );

  if (role !== 'lead') {
    return (
      <Screen title="Send logins" backHref="/team">
        <LeadOnlyNotice what="send login details" />
      </Screen>
    );
  }
  if (loading) {
    return (
      <Screen title="Send logins" backHref="/team">
        <LoadingView />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen title="Send logins" backHref="/team">
        <ErrorView error={error} onRetry={refresh} />
      </Screen>
    );
  }

  const teammates = members.filter((m) => m.role !== 'lead');

  const requirePassword = (): boolean => {
    if (password) return true;
    setPasswordError('Type the team password first. It goes into the message.');
    errorFeedback();
    passwordRef.current?.focus();
    return false;
  };

  const messageFor = (m: Member) => buildLoginMessage({ config, teamName: data.team.name, phone: m.phone, password });

  const onSms = async (m: Member) => {
    if (!requirePassword()) return;
    const ok = await smsTo(m.phone, messageFor(m));
    if (!ok) setFormError('Could not open the SMS app on this device. Use Copy message instead.');
  };

  const onWhatsApp = async (m: Member) => {
    if (!requirePassword()) return;
    const ok = await whatsappTo(m.phone, messageFor(m));
    if (!ok) setFormError('Could not open WhatsApp. Use Copy message instead.');
  };

  const onCopy = async (m: Member) => {
    if (!requirePassword()) return;
    const ok = await copyToClipboard(messageFor(m));
    if (ok) {
      successFeedback();
      setCopied(m.id);
      setTimeout(() => setCopied((c) => (c === m.id ? null : c)), 2500);
    } else {
      setFormError('Could not copy to the clipboard on this device.');
    }
  };

  return (
    <Screen
      title="Send logins"
      subtitle={data.team.name}
      backHref="/team"
      refreshing={refreshing}
      onRefresh={() => void refresh()}
    >
      {error ? <Banner type="error" message={error.message} action={{ label: 'Retry', onPress: () => void refresh() }} /> : null}

      {teammates.length === 0 ? (
        <EmptyState
          icon="person-add-outline"
          title="Add teammates first"
          message="Once your teammates are added you can send them their login details here."
          action={{ label: 'Add members', icon: 'person-add', onPress: () => router.replace('/team/members') }}
        />
      ) : (
        <>
          <Card>
            <AppText variant="bodyStrong">Team password</AppText>
            <AppText variant="caption" color="muted" style={styles.note}>
              The password is stored encrypted, so type it again here. It is only used to build the message and is never saved on
              this device.
            </AppText>
            <TextField
              ref={passwordRef}
              type="password"
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                setPasswordError(null);
              }}
              error={passwordError}
              placeholder="Current team password"
              autoComplete="current-password"
              icon="lock-closed-outline"
              containerStyle={styles.noMargin}
            />
          </Card>

          {formError ? <Banner type="error" message={formError} onClose={() => setFormError(null)} /> : null}

          <SectionTitle title={`Teammates · ${teammates.length}`} />
          <AppText variant="caption" color="muted" style={styles.note}>
            Send each teammate their login from your phone. The message has the app link, their phone number and the team password.
          </AppText>

          {teammates.map((m) => (
              <Card key={m.id} style={styles.memberCard}>
                <MemberRow member={m} last />
                <View style={styles.actions}>
                  <Button
                    title="SMS"
                    icon="chatbubble-outline"
                    variant="secondary"
                    size="sm"
                    fullWidth={false}
                    onPress={() => onSms(m)}
                  />
                  <Button
                    title="WhatsApp"
                    icon="logo-whatsapp"
                    variant="secondary"
                    size="sm"
                    fullWidth={false}
                    onPress={() => onWhatsApp(m)}
                  />
                  <Button
                    title={copied === m.id ? 'Copied!' : 'Copy message'}
                    icon={copied === m.id ? 'checkmark' : 'copy-outline'}
                    variant="ghost"
                    size="sm"
                    fullWidth={false}
                    onPress={() => onCopy(m)}
                  />
                </View>
              </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { marginTop: spacing.xs, marginBottom: spacing.md },
  noMargin: { marginBottom: 0 },
  memberCard: { paddingVertical: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingBottom: spacing.sm },
});
