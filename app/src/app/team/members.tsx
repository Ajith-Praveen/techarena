import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api, isApiError } from '@/api/client';
import type { AddMemberRequest, Member } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
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
import { formErrorMessage, serverFieldErrors } from '@/features/team/forms';
import { MemberRow } from '@/features/team/MemberRow';
import { RegistrationClosedBanner, useIsWide } from '@/features/team/notices';
import { toPhotoUpload, type PhotoUpload } from '@/features/team/people';
import { ProfilePhotoField } from '@/features/team/ProfilePhotoField';
import { compact, emailError, LIMITS, lengthError, phoneError, usnError, type FieldErrors } from '@/features/team/validation';
import { useApi, useConfig } from '@/hooks';
import { confirm } from '@/lib/dialogs';
import { errorMessage } from '@/lib/errors';
import { errorFeedback, successFeedback } from '@/lib/haptics';
import type { PickedImage } from '@/lib/image';
import { colors, spacing } from '@/theme';

interface AddForm {
  name: string;
  phone: string;
  email: string;
  usn: string;
}

const EMPTY_FORM: AddForm = { name: '', phone: '', email: '', usn: '' };

function sortMembers(members: Member[]): Member[] {
  return [...members].sort((a, b) => (a.role === b.role ? 0 : a.role === 'lead' ? -1 : 1));
}

export default function TeamMembersScreen() {
  const { session, role } = useAuth();
  const { config, refresh: refreshConfig } = useConfig();
  const { data, error, loading, refreshing, refresh, setData, reload } = useApi(() => api.team());
  const wide = useIsWide();

  const [form, setForm] = useState<AddForm>(EMPTY_FORM);
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string; addedName?: string } | null>(null);

  const isLead = role === 'lead';
  const registrationOpen = config?.registrationOpen ?? true;
  const maxTeamSize = config?.maxTeamSize ?? 5;

  if (loading) {
    return (
      <Screen title="Team" backHref="/team">
        <LoadingView message="Loading your team…" />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen title="Team" backHref="/team">
        <ErrorView error={error} onRetry={refresh} />
      </Screen>
    );
  }

  const members = sortMembers(data.members);
  const full = members.length >= maxTeamSize;
  const canEdit = isLead && registrationOpen;

  const set = (key: keyof AddForm) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(({ [key]: _, ...rest }) => rest);
  };

  const onAdd = async () => {
    setFormError(null);
    setNotice(null);
    const local = compact({
      name: lengthError(form.name, 'Name', LIMITS.name),
      phone: phoneError(form.phone),
      email: emailError(form.email),
      usn: usnError(form.usn, false),
    });
    setErrors(local);
    if (Object.keys(local).length) {
      errorFeedback();
      return;
    }
    const body: AddMemberRequest & Partial<PhotoUpload> = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      ...(form.usn.trim() ? { usn: form.usn.trim().toUpperCase() } : null),
      ...(photo ? toPhotoUpload(photo) : null),
    };
    try {
      const { member } = await api.addMember(body);
      successFeedback();
      setData((prev) => (prev ? { ...prev, members: [...prev.members, member] } : prev));
      setForm(EMPTY_FORM);
      setPhoto(null);
      setErrors({});
      setNotice({ type: 'success', message: `${member.name} was added to your team.`, addedName: member.name });
    } catch (e) {
      errorFeedback();
      if (isApiError(e) && e.code === 'REGISTRATION_CLOSED') void refreshConfig();
      if (isApiError(e) && e.code === 'CONFLICT' && !e.fields) void reload();
      setErrors(serverFieldErrors(e));
      setFormError(formErrorMessage(e));
    }
  };

  const onRemove = async (m: Member) => {
    const ok = await confirm(
      `Remove ${m.name}?`,
      'They will be logged out and can no longer use the app for your team.',
      'Remove',
      { destructive: true },
    );
    if (!ok) return;
    setNotice(null);
    try {
      await api.removeMember(m.id);
      setData((prev) => (prev ? { ...prev, members: prev.members.filter((x) => x.id !== m.id) } : prev));
      setNotice({ type: 'success', message: `${m.name} was removed from your team.` });
    } catch (e) {
      errorFeedback();
      if (isApiError(e) && e.code === 'REGISTRATION_CLOSED') void refreshConfig();
      setNotice({ type: 'error', message: errorMessage(e) });
    }
  };

  const onRefresh = () => {
    void refresh();
    void refreshConfig();
  };

  const list = (
    <View style={wide ? styles.col : null}>
      <SectionTitle title={`Members · ${members.length} of ${maxTeamSize}`} />
      <Card>
        {members.length === 0 ? (
          <EmptyState icon="people-outline" title="No members yet" />
        ) : (
          members.map((m, i) => (
            <MemberRow
              key={m.id}
              member={m}
              isMe={m.id === session?.member?.id}
              last={i === members.length - 1}
              right={
                canEdit && m.role !== 'lead' ? (
                  <Pressable
                    onPress={() => onRemove(m)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${m.name}`}
                    hitSlop={8}
                    style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.4 }]}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  </Pressable>
                ) : null
              }
            />
          ))
        )}
      </Card>
      {isLead && members.length > 1 ? (
        <Button
          title="Send login details"
          icon="paper-plane-outline"
          variant="secondary"
          onPress={() => router.push('/team/notify')}
          style={styles.sendLogins}
        />
      ) : null}
    </View>
  );

  const addForm = canEdit ? (
    <View style={wide ? styles.col : null}>
      <SectionTitle title="Add a teammate" />
      {full ? (
        <Card>
          <EmptyState
            icon="checkmark-done-circle-outline"
            title="Your team is full"
            message={`A team can have at most ${maxTeamSize} people including the lead. Remove someone to add another person.`}
          />
        </Card>
      ) : (
        <Card>
          <TextField
            label="Name"
            type="name"
            value={form.name}
            onChangeText={set('name')}
            error={errors.name}
            placeholder="Teammate's full name"
            maxLength={LIMITS.name.max}
            icon="person-outline"
          />
          <TextField
            label="Phone number"
            type="phone"
            value={form.phone}
            onChangeText={set('phone')}
            error={errors.phone}
            placeholder="10-digit mobile number"
            hint="They log in with this number."
            maxLength={20}
            icon="call-outline"
          />
          <TextField
            label="Email"
            type="email"
            value={form.email}
            onChangeText={set('email')}
            error={errors.email}
            placeholder="name@example.com"
            hint="Saved with their details. Send their login by SMS or WhatsApp."
            maxLength={120}
            icon="mail-outline"
          />
          <TextField
            label="USN (optional)"
            value={form.usn}
            onChangeText={(v) => set('usn')(v.toUpperCase())}
            error={errors.usn}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={LIMITS.usn.max}
            icon="id-card-outline"
          />
          <ProfilePhotoField
            label="Profile photo (optional)"
            value={photo}
            onChange={setPhoto}
            error={errors.photo}
            hint="If you skip it, they'll be asked to add one when they first log in."
            size={72}
          />
          {formError ? <Banner type="error" message={formError} onClose={() => setFormError(null)} /> : null}
          <Button title="Add to team" icon="person-add" onPress={onAdd} />
        </Card>
      )}
    </View>
  ) : null;

  return (
    <Screen
      title="Team"
      subtitle={data.team.name}
      backHref="/team"
      refreshing={refreshing}
      onRefresh={onRefresh}
      right={<Badge label={`${members.length}/${maxTeamSize}`} tone={full ? 'success' : 'neutral'} />}
    >
      {error ? <Banner type="error" message={error.message} action={{ label: 'Retry', onPress: () => void refresh() }} /> : null}
      {notice ? (
        <Banner
          type={notice.type}
          message={notice.message}
          onClose={() => setNotice(null)}
          action={
            notice.addedName ? { label: 'Send their login details', onPress: () => router.push('/team/notify') } : undefined
          }
        />
      ) : null}
      {!registrationOpen ? (
        <RegistrationClosedBanner
          message={isLead ? 'Team members can no longer be added or removed.' : 'The team list is now final.'}
        />
      ) : !isLead ? (
        <Banner type="info" icon="information-circle" message="Only your team lead can add or remove members." />
      ) : null}

      <View style={wide && addForm ? styles.columns : null}>
        {list}
        {addForm}
      </View>

      {!isLead ? (
        <AppText variant="caption" color="faint" align="center" style={styles.footnote}>
          Contact details are only visible to your own team.
        </AppText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  removeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  columns: { flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' },
  col: { flex: 1, minWidth: 0 },
  footnote: { marginTop: spacing.lg },
  sendLogins: { marginBottom: spacing.xl },
});
