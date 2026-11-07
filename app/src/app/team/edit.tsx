import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, isApiError } from '@/api/client';
import type { Team, UpdateTeamRequest } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import {
  AppText,
  Banner,
  Button,
  Card,
  ErrorView,
  ImagePickerField,
  LoadingView,
  Screen,
  TeamImage,
  TextField,
} from '@/components';
import { formErrorMessage, serverFieldErrors } from '@/features/team/forms';
import { LeadOnlyNotice, RegistrationClosedBanner } from '@/features/team/notices';
import { compact, LIMITS, lengthError, type FieldErrors } from '@/features/team/validation';
import { useApi, useConfig } from '@/hooks';
import { errorFeedback, successFeedback } from '@/lib/haptics';
import { toImageUpload, type PickedImage } from '@/lib/image';
import { spacing } from '@/theme';

const FORM_WIDTH = 640;

export default function EditProjectScreen() {
  const { role, refreshMe } = useAuth();
  const { config, refresh: refreshConfig } = useConfig();
  const { data, error, loading, refreshing, refresh, setData } = useApi(() => api.team(), [], { enabled: role === 'lead' });

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [image, setImage] = useState<PickedImage | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Fill the form once per team load; later background refetches must not overwrite edits.
  useEffect(() => {
    if (data && loadedFor !== data.team.id) {
      setTitle(data.team.projectTitle);
      setDesc(data.team.projectDesc);
      setLoadedFor(data.team.id);
    }
  }, [data, loadedFor]);

  if (role !== 'lead') {
    return (
      <Screen title="Edit project" backHref="/team">
        <LeadOnlyNotice what="edit the project" />
      </Screen>
    );
  }
  if (loading) {
    return (
      <Screen title="Edit project" backHref="/team">
        <LoadingView />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen title="Edit project" backHref="/team">
        <ErrorView error={error} onRetry={refresh} />
      </Screen>
    );
  }

  const team: Team = data.team;
  const registrationOpen = config?.registrationOpen ?? true;

  if (!registrationOpen) {
    return (
      <Screen title="Edit project" backHref="/team" refreshing={refreshing} onRefresh={() => void refresh()}>
        <RegistrationClosedBanner message="Project details are locked now. This is what the judges will see." />
        <Card>
          <TeamImage url={team.imageUrl} />
          <AppText variant="heading" style={styles.readTitle}>
            {team.projectTitle}
          </AppText>
          <AppText color="textSecondary">{team.projectDesc}</AppText>
        </Card>
      </Screen>
    );
  }

  const trimmedTitle = title.trim();
  const trimmedDesc = desc.trim();
  const changed = trimmedTitle !== team.projectTitle || trimmedDesc !== team.projectDesc || image !== null;

  const onSave = async () => {
    setFormError(null);
    setSaved(false);
    const local = compact({
      projectTitle: lengthError(title, 'Project title', LIMITS.projectTitle),
      projectDesc: lengthError(desc, 'Project description', LIMITS.projectDesc),
    });
    setErrors(local);
    if (Object.keys(local).length) {
      errorFeedback();
      return;
    }
    const body: UpdateTeamRequest = {
      ...(trimmedTitle !== team.projectTitle ? { projectTitle: trimmedTitle } : null),
      ...(trimmedDesc !== team.projectDesc ? { projectDesc: trimmedDesc } : null),
      ...(image ? toImageUpload(image) : null),
    };
    try {
      const res = await api.updateTeam(body);
      successFeedback();
      setData((prev) => (prev ? { ...prev, team: res.team } : prev));
      setTitle(res.team.projectTitle);
      setDesc(res.team.projectDesc);
      setImage(null);
      setSaved(true);
      void refreshMe().catch(() => null);
    } catch (e) {
      errorFeedback();
      if (isApiError(e) && e.code === 'REGISTRATION_CLOSED') void refreshConfig();
      setErrors(serverFieldErrors(e));
      setFormError(formErrorMessage(e));
    }
  };

  return (
    <Screen
      title="Edit project"
      subtitle={team.name}
      backHref="/team"
      maxWidth={FORM_WIDTH}
      refreshing={refreshing}
      onRefresh={() => {
        void refresh();
        void refreshConfig();
      }}
    >
      {error ? <Banner type="error" message={error.message} /> : null}
      {saved ? <Banner type="success" message="Project details saved." onClose={() => setSaved(false)} /> : null}
      <Banner type="info" message="You can change these until registration closes on expo day." />

      <Card>
        <TextField
          label="Project title"
          value={title}
          onChangeText={(v) => {
            setTitle(v);
            setSaved(false);
            if (errors.projectTitle) setErrors(({ projectTitle: _, ...rest }) => rest);
          }}
          error={errors.projectTitle}
          maxLength={LIMITS.projectTitle.max}
          icon="bulb-outline"
        />
        <TextField
          label="Project description"
          type="multiline"
          value={desc}
          onChangeText={(v) => {
            setDesc(v);
            setSaved(false);
            if (errors.projectDesc) setErrors(({ projectDesc: _, ...rest }) => rest);
          }}
          error={errors.projectDesc}
          hint={`${trimmedDesc.length} / ${LIMITS.projectDesc.max} characters (min ${LIMITS.projectDesc.min})`}
          maxLength={LIMITS.projectDesc.max}
        />
        <ImagePickerField
          label="Project image"
          value={image}
          onChange={(img) => {
            setImage(img);
            setSaved(false);
          }}
          existingUrl={team.imageUrl}
          error={errors.image}
          style={styles.noMargin}
        />
      </Card>

      {formError ? <Banner type="error" message={formError} onClose={() => setFormError(null)} /> : null}

      <View style={styles.actions}>
        <Button title="Save changes" icon="checkmark" size="lg" onPress={onSave} disabled={!changed} />
        {changed ? (
          <Button
            title="Discard changes"
            variant="ghost"
            onPress={() => {
              setTitle(team.projectTitle);
              setDesc(team.projectDesc);
              setImage(null);
              setErrors({});
              setFormError(null);
            }}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  readTitle: { marginTop: spacing.md, marginBottom: spacing.xs },
  noMargin: { marginBottom: 0 },
  actions: { gap: spacing.md },
});
