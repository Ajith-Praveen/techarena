import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { api } from '@/api/client';
import type { AdminJudge } from '@/api/types';
import {
  AppText,
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorView,
  LoadingView,
  Screen,
  SectionTitle,
  TextField,
} from '@/components';
import { photoUrlOf } from '@/features/admin/compat';
import { CredentialsCard, type ShownCredentials } from '@/features/admin/CredentialsCard';
import { generatePassword, USERNAME_RE } from '@/features/admin/password';
import { PersonAvatar } from '@/features/admin/PersonAvatar';
import { useIsWide } from '@/features/admin/useIsWide';
import { useApi } from '@/hooks';
import { confirm, errorMessage, fieldErrors, plural, successFeedback } from '@/lib';
import { colors, spacing } from '@/theme';

export default function AdminJudgesScreen() {
  const { data, error, loading, refreshing, refresh, reload, setData } = useApi(() => api.adminJudges());
  const [creds, setCreds] = useState<ShownCredentials | null>(null);

  const updateJudge = (judge: Partial<AdminJudge> & { id: string }) => {
    setData((d) => (d ? { judges: d.judges.map((j) => (j.id === judge.id ? { ...j, ...judge } : j)) } : d));
    void reload();
  };

  const body = () => {
    if (loading) return <LoadingView message="Loading judges…" />;
    if (!data) return <ErrorView error={error} onRetry={refresh} />;
    const active = data.judges.filter((j) => j.active).length;
    return (
      <>
        {error ? <Banner type="error" message={`Could not refresh: ${error.message}`} action={{ label: 'Retry', onPress: () => void refresh() }} /> : null}
        <SectionTitle title={`Judges · ${active} active`} />
        {data.judges.length === 0 ? (
          <Card>
            <EmptyState
              icon="ribbon-outline"
              title="No judges yet"
              message="Create a judge below. Each judge logs in with their own username and password."
            />
          </Card>
        ) : (
          data.judges.map((j) => <JudgeRow key={j.id} judge={j} onUpdated={updateJudge} />)
        )}
      </>
    );
  };

  return (
    <Screen title="Judges" backHref="/admin" refreshing={refreshing} onRefresh={refresh}>
      <Banner
        type="info"
        title="Create 2 judges and log them in on the iPads"
        message="Judges sign in from the welcome screen with Judge login. Every active judge must score every team before results can be published."
      />
      {body()}
      <CreateJudgeForm
        onCreated={(c) => {
          setCreds(c);
          void reload();
        }}
      />
      {creds ? <CredentialsCard creds={creds} onDismiss={() => setCreds(null)} /> : null}
    </Screen>
  );
}

function PasswordWithGenerate({
  value,
  onChange,
  error,
  label = 'Password',
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  label?: string;
}) {
  return (
    <View>
      <View style={styles.pwLabelRow}>
        <AppText variant="caption" color="textSecondary">
          {label}
        </AppText>
        <Pressable
          onPress={() => onChange(generatePassword())}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Generate a random password"
          style={({ pressed }) => [styles.genBtn, pressed ? { opacity: 0.5 } : null]}
        >
          <Ionicons name="dice-outline" size={18} color={colors.accent} />
          <AppText variant="label" color="accent">
            Generate
          </AppText>
        </Pressable>
      </View>
      <TextField
        type="password"
        icon="key-outline"
        value={value}
        onChangeText={onChange}
        error={error}
        hint="At least 6 characters"
        autoComplete="new-password"
        textContentType="newPassword"
        accessibilityLabel={label}
      />
    </View>
  );
}

function CreateJudgeForm({ onCreated }: { onCreated: (c: ShownCredentials) => void }) {
  const wide = useIsWide();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const clear = (field: string) => setErrors((e) => (e[field] ? { ...e, [field]: '' } : e));

  const submit = async () => {
    const u = username.trim().toLowerCase();
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = 'Enter the judge’s name (2–60 characters)';
    if (!USERNAME_RE.test(u)) next.username = '3–30 characters: letters, numbers, dot, dash or underscore';
    if (password.length < 6) next.password = 'At least 6 characters';
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;
    try {
      const { judge } = await api.createJudge({ name: name.trim(), username: u, password });
      successFeedback();
      onCreated({ name: judge.name, username: judge.username, password, kind: 'created' });
      setName('');
      setUsername('');
      setPassword('');
    } catch (e) {
      const fe = fieldErrors(e);
      setErrors(fe);
      setFormError(Object.keys(fe).length ? null : errorMessage(e));
    }
  };

  return (
    <>
      <SectionTitle title="Add a judge" />
      <Card>
        {formError ? <Banner type="error" message={formError} /> : null}
        <View style={wide ? styles.twoCol : null}>
          <TextField
            label="Name"
            type="name"
            icon="person-outline"
            placeholder="Dr. Priya Rao"
            value={name}
            onChangeText={(v) => {
              setName(v);
              clear('name');
            }}
            error={errors.name}
            containerStyle={wide ? styles.flex : null}
          />
          <TextField
            label="Username"
            type="username"
            icon="at"
            placeholder="judge1"
            value={username}
            onChangeText={(v) => {
              setUsername(v.toLowerCase());
              clear('username');
            }}
            error={errors.username}
            containerStyle={wide ? styles.flex : null}
            autoComplete="off"
          />
        </View>
        <PasswordWithGenerate
          value={password}
          onChange={(v) => {
            setPassword(v);
            clear('password');
          }}
          error={errors.password}
        />
        <Button title="Create judge" icon="person-add" onPress={submit} />
      </Card>
    </>
  );
}

function JudgeRow({
  judge,
  onUpdated,
}: {
  judge: AdminJudge;
  onUpdated: (j: Partial<AdminJudge> & { id: string }) => void;
}) {
  const [creds, setCreds] = useState<ShownCredentials | null>(null);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [pwError, setPwError] = useState<string | undefined>();

  const toggleActive = async (active: boolean) => {
    setError(null);
    const ok = active
      ? await confirm(`Activate ${judge.name}?`, 'They can log in again and must score every team before results can be published.', 'Activate')
      : await confirm(
          `Deactivate ${judge.name}?`,
          'They are signed out everywhere and cannot log in. Scores they already submitted are kept. Inactive judges are not required to score the remaining teams.',
          'Deactivate',
          { destructive: true },
        );
    if (!ok) return;
    setToggling(true);
    try {
      const res = await api.updateJudge(judge.id, { active });
      successFeedback();
      onUpdated({ ...res.judge, id: judge.id });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setToggling(false);
    }
  };

  const resetPassword = async () => {
    setError(null);
    if (newPassword.length < 6) {
      setPwError('At least 6 characters');
      return;
    }
    const ok = await confirm(
      `Reset password for ${judge.name}?`,
      'They will be signed out on every device and must log in with the new password.',
      'Reset password',
    );
    if (!ok) return;
    try {
      const res = await api.updateJudge(judge.id, { password: newPassword });
      successFeedback();
      setCreds({ name: res.judge.name, username: res.judge.username, password: newPassword, kind: 'reset' });
      setNewPassword('');
      setResetOpen(false);
      onUpdated({ ...res.judge, id: judge.id });
    } catch (e) {
      const fe = fieldErrors(e);
      if (fe.password) setPwError(fe.password);
      else setError(errorMessage(e));
    }
  };

  return (
    <Card tone={judge.active ? 'default' : 'warning'}>
      <View style={styles.row}>
        <PersonAvatar name={judge.name} photoUrl={photoUrlOf(judge)} size={48} />
        <View style={styles.rowText}>
          <AppText variant="subheading" numberOfLines={1}>
            {judge.name}
          </AppText>
          <AppText variant="caption" color="muted" numberOfLines={1} selectable>
            @{judge.username}
          </AppText>
          <View style={styles.badges}>
            <Badge label={judge.active ? 'Active' : 'Inactive'} tone={judge.active ? 'success' : 'warning'} />
            <Badge label={`${plural(judge.evaluatedCount, 'team')} scored`} tone="accent" icon="checkmark-done" />
          </View>
        </View>
        <Switch
          value={judge.active}
          onValueChange={(v) => void toggleActive(v)}
          disabled={toggling}
          trackColor={{ false: colors.faint, true: colors.success }}
          thumbColor={colors.card}
          accessibilityLabel={judge.active ? `Deactivate ${judge.name}` : `Activate ${judge.name}`}
        />
      </View>
      {error ? <Banner type="error" message={error} style={styles.top} onClose={() => setError(null)} /> : null}
      {creds ? (
        <View style={styles.top}>
          <CredentialsCard creds={creds} onDismiss={() => setCreds(null)} />
        </View>
      ) : null}
      {resetOpen ? (
        <View style={styles.reset}>
          <PasswordWithGenerate
            label="New password"
            value={newPassword}
            onChange={(v) => {
              setNewPassword(v);
              setPwError(undefined);
            }}
            error={pwError}
          />
          <View style={styles.resetActions}>
            <Button title="Cancel" variant="ghost" fullWidth={false} onPress={() => setResetOpen(false)} />
            <Button title="Save new password" icon="key" fullWidth={false} onPress={resetPassword} />
          </View>
        </View>
      ) : (
        <Button
          title="Reset password"
          icon="key-outline"
          variant="secondary"
          size="sm"
          fullWidth={false}
          style={styles.top}
          onPress={() => {
            setNewPassword(generatePassword());
            setPwError(undefined);
            setResetOpen(true);
          }}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  twoCol: { flexDirection: 'row', gap: spacing.md },
  // Mirrors TextField's own label placement.
  pwLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    marginLeft: spacing.lg,
  },
  genBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2, marginTop: spacing.xs },
  top: { marginTop: spacing.md },
  reset: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  resetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, flexWrap: 'wrap' },
});
