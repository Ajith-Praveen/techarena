import { Redirect, router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, isApiError } from '@/api/client';
import type { RegisterRequest } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { homeFor } from '@/auth/routes';
import {
  AppText,
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorView,
  ImagePickerField,
  LoadingView,
  Screen,
  SectionTitle,
  TeamColorPicker,
  TextField,
} from '@/components';
import { formErrorMessage, serverFieldErrors } from '@/features/team/forms';
import { toPhotoUpload, type PhotoUpload } from '@/features/team/people';
import { ProfilePhotoField } from '@/features/team/ProfilePhotoField';
import {
  compact,
  emailError,
  LIMITS,
  lengthError,
  passwordError,
  phoneError,
  usnError,
  type FieldErrors,
} from '@/features/team/validation';
import { useApi, useConfig } from '@/hooks';
import { errorFeedback, successFeedback } from '@/lib/haptics';
import type { PickedImage } from '@/lib/image';
import { pickPoster, toImageUpload, toPosterUpload } from '@/lib/image';
import { spacing } from '@/theme';

interface FormState {
  leadName: string;
  usn: string;
  phone: string;
  email: string;
  teamName: string;
  projectTitle: string;
  projectDesc: string;
  password: string;
  confirm: string;
}

const EMPTY: FormState = {
  leadName: '',
  usn: '',
  phone: '',
  email: '',
  teamName: '',
  projectTitle: '',
  projectDesc: '',
  password: '',
  confirm: '',
};

const FORM_WIDTH = 640;

function validate(f: FormState, image: PickedImage | null, photo: PickedImage | null, color: string | null, colorNeeded: boolean): FieldErrors {
  return compact({
    color: colorNeeded && !color ? 'Pick a team colour' : undefined,
    photo: photo ? undefined : 'Add a profile photo of yourself',
    leadName: lengthError(f.leadName, 'Name', LIMITS.name),
    usn: usnError(f.usn, true),
    phone: phoneError(f.phone),
    email: emailError(f.email),
    teamName: lengthError(f.teamName, 'Team name', LIMITS.teamName),
    projectTitle: lengthError(f.projectTitle, 'Project title', LIMITS.projectTitle),
    projectDesc: lengthError(f.projectDesc, 'Project description', LIMITS.projectDesc),
    image: image ? undefined : 'Add a photo of your project',
    password: passwordError(f.password, 'Team password'),
    confirm: !f.confirm ? 'Re-enter the password' : f.confirm !== f.password ? 'Passwords do not match' : undefined,
  });
}

export default function RegisterScreen() {
  const { role, signIn } = useAuth();
  const { config, loading, error: configError, refresh } = useConfig();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [image, setImage] = useState<PickedImage | null>(null);
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [poster, setPoster] = useState<PickedImage | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const palette = useApi(() => api.teamColors());
  const freeColors = palette.data?.colors.filter((c) => !c.taken) ?? [];
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const registering = useRef(false);

  // Already signed in (and not mid-registration): go home.
  if (role && !registering.current) return <Redirect href={homeFor(role)} />;

  const set = (key: keyof FormState) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(({ [key]: _, ...rest }) => rest);
  };

  const submit = async () => {
    setFormError(null);
    const local = validate(form, image, photo, color, freeColors.length > 0);
    setErrors(local);
    if (Object.keys(local).length || !image || !photo) {
      errorFeedback();
      setFormError('Please fix the highlighted fields.');
      return;
    }
    const body: RegisterRequest & PhotoUpload = {
      leadName: form.leadName.trim(),
      usn: form.usn.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      teamName: form.teamName.trim(),
      projectTitle: form.projectTitle.trim(),
      projectDesc: form.projectDesc.trim(),
      password: form.password,
      ...toImageUpload(image),
      ...toPhotoUpload(photo),
      ...(poster ? toPosterUpload(poster) : {}),
      ...(color ? { color } : {}),
    };
    registering.current = true;
    try {
      const session = await api.register(body);
      await signIn(session);
      successFeedback();
      router.replace({ pathname: '/team', params: { welcome: '1' } });
    } catch (e) {
      registering.current = false;
      errorFeedback();
      if (isApiError(e) && e.code === 'REGISTRATION_CLOSED') void refresh();
      // Someone grabbed the colour first: show the fresh palette and ask for another pick.
      if (isApiError(e) && e.fields?.color) {
        setColor(null);
        void palette.refresh();
      }
      setErrors(serverFieldErrors(e));
      setFormError(formErrorMessage(e));
    }
  };

  if (loading) {
    return (
      <Screen title="Register team" backHref="/welcome">
        <LoadingView message="Checking registration…" />
      </Screen>
    );
  }
  if (!config) {
    return (
      <Screen title="Register team" backHref="/welcome">
        <ErrorView error={configError} onRetry={refresh} />
      </Screen>
    );
  }
  if (!config.registrationOpen) {
    return (
      <Screen title="Register team" backHref="/welcome" onRefresh={() => void refresh()} refreshing={false}>
        <EmptyState
          icon="lock-closed-outline"
          title="Registration is closed"
          message={`New teams can no longer register for ${config.eventName}. Already registered? Log in with your phone number and team password.`}
          action={{ label: 'Team login', icon: 'log-in-outline', onPress: () => router.replace('/login') }}
        />
      </Screen>
    );
  }

  const descLen = form.projectDesc.trim().length;

  return (
    <Screen title="Register team" subtitle={config.eventName} backHref="/welcome" maxWidth={FORM_WIDTH}>
      <Banner
        type="info"
        icon="person-add"
        message="You are registering as the team lead. After this you can add your teammates and send them their login."
      />

      <SectionTitle title="About you" />
      <Card>
        <ProfilePhotoField
          label="Your profile photo"
          value={photo}
          onChange={(img) => {
            setPhoto(img);
            if (errors.photo) setErrors(({ photo: _, ...rest }) => rest);
          }}
          error={errors.photo}
          hint="A clear photo of your face. Judges use it to recognise your team."
        />
        <TextField
          label="Full name"
          type="name"
          value={form.leadName}
          onChangeText={set('leadName')}
          error={errors.leadName}
          placeholder="e.g. Ananya Rao"
          maxLength={LIMITS.name.max}
          icon="person-outline"
        />
        <TextField
          label="USN"
          value={form.usn}
          onChangeText={(v) => set('usn')(v.toUpperCase())}
          error={errors.usn}
          placeholder="e.g. 1AB21CS001"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={LIMITS.usn.max}
          icon="id-card-outline"
        />
        <TextField
          label="Phone number"
          type="phone"
          value={form.phone}
          onChangeText={set('phone')}
          error={errors.phone}
          placeholder="10-digit mobile number"
          hint="You and your team log in with your own phone number."
          maxLength={20}
          icon="call-outline"
        />
        <TextField
          label="Email"
          type="email"
          value={form.email}
          onChangeText={set('email')}
          error={errors.email}
          placeholder="you@example.com"
          maxLength={120}
          icon="mail-outline"
          containerStyle={styles.last}
        />
      </Card>

      <SectionTitle title="Your team & project" />
      <Card>
        <TextField
          label="Team name"
          value={form.teamName}
          onChangeText={set('teamName')}
          error={errors.teamName}
          placeholder="e.g. Circuit Breakers"
          maxLength={LIMITS.teamName.max}
          icon="people-outline"
        />
        <TextField
          label="Project title"
          value={form.projectTitle}
          onChangeText={set('projectTitle')}
          error={errors.projectTitle}
          placeholder="e.g. Smart irrigation controller"
          maxLength={LIMITS.projectTitle.max}
          icon="bulb-outline"
        />
        <TextField
          label="Project description"
          type="multiline"
          value={form.projectDesc}
          onChangeText={set('projectDesc')}
          error={errors.projectDesc}
          placeholder="What does it do, and how does it work?"
          hint={`${descLen} / ${LIMITS.projectDesc.max} characters (min ${LIMITS.projectDesc.min})`}
          maxLength={LIMITS.projectDesc.max}
        />
        <ImagePickerField
          label="Project image"
          value={image}
          onChange={(img) => {
            setImage(img);
            if (errors.image) setErrors(({ image: _, ...rest }) => rest);
          }}
          error={errors.image}
        />
        <ImagePickerField
          label="Your own poster (optional)"
          value={poster}
          onChange={setPoster}
          picker={pickPoster}
          error={errors.posterBase64}
          hint="Skip this and the app makes a comic poster for you from your project image and description, in your team colour."
          style={styles.last}
        />
      </Card>

      <SectionTitle title="Team colour" />
      <Card>
        <AppText variant="caption" color="muted" style={styles.note}>
          Pick your team's colour. It's used for your team banner and your poster. Every team gets a different colour, so
          crossed-out ones are already taken.
        </AppText>
        {palette.data ? (
          <TeamColorPicker
            options={palette.data.colors}
            value={color}
            onChange={(hex) => {
              setColor(hex);
              if (errors.color) setErrors(({ color: _, ...rest }) => rest);
            }}
          />
        ) : palette.error ? (
          <Button title="Load colours again" variant="secondary" size="sm" fullWidth={false} onPress={() => void palette.refresh()} />
        ) : (
          <AppText color="muted">Loading colours…</AppText>
        )}
        {errors.color ? (
          <AppText variant="footnote" color="danger" style={styles.colorError}>
            {errors.color}
          </AppText>
        ) : null}
      </Card>

      <SectionTitle title="Team password" />
      <Card>
        <AppText variant="caption" color="muted" style={styles.note}>
          Everyone in your team logs in with this one password. You will send it to your teammates later.
        </AppText>
        <TextField
          label="Team password"
          type="password"
          value={form.password}
          onChangeText={set('password')}
          error={errors.password}
          placeholder={`At least ${LIMITS.passwordMin} characters`}
          autoComplete="new-password"
          textContentType="newPassword"
          icon="lock-closed-outline"
        />
        <TextField
          label="Confirm password"
          type="password"
          value={form.confirm}
          onChangeText={set('confirm')}
          error={errors.confirm}
          autoComplete="new-password"
          textContentType="newPassword"
          icon="lock-closed-outline"
          containerStyle={styles.last}
          onSubmitEditing={() => void submit()}
        />
      </Card>

      {formError ? <Banner type="error" message={formError} onClose={() => setFormError(null)} /> : null}

      <View style={styles.actions}>
        <Button title="Register team" icon="checkmark-circle" size="lg" onPress={submit} />
        <Button title="Already registered? Log in" variant="ghost" onPress={() => router.replace('/login')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  last: { marginBottom: 0 },
  note: { marginBottom: spacing.md },
  actions: { gap: spacing.md, marginTop: spacing.sm },
  colorError: { marginTop: spacing.md },
});
