import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type Ref } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextInputInstance,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { colors, fonts, hardShadow, ink, palette, radius, spacing } from '@/theme';

import { AppText } from './AppText';
import type { IconName } from './icons';

export type TextFieldType = 'text' | 'name' | 'email' | 'phone' | 'password' | 'number' | 'username' | 'multiline';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  /** Shown in red below the field; also turns the border red. */
  error?: string | null;
  /** Muted helper text below the field (hidden while an error is shown). */
  hint?: string;
  /** Preset for keyboard, autocomplete and capitalization (default 'text'). */
  type?: TextFieldType;
  icon?: IconName;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  ref?: Ref<TextInputInstance>;
}

const PRESETS: Record<TextFieldType, Partial<TextInputProps>> = {
  text: {},
  name: { autoCapitalize: 'words', autoComplete: 'name', textContentType: 'name' },
  email: {
    keyboardType: 'email-address',
    autoCapitalize: 'none',
    autoCorrect: false,
    autoComplete: 'email',
    textContentType: 'emailAddress',
    inputMode: 'email',
  },
  phone: { keyboardType: 'phone-pad', autoComplete: 'tel', textContentType: 'telephoneNumber', inputMode: 'tel' },
  password: { autoCapitalize: 'none', autoCorrect: false, autoComplete: 'password', textContentType: 'password' },
  number: { keyboardType: 'number-pad', inputMode: 'numeric' },
  username: { autoCapitalize: 'none', autoCorrect: false, autoComplete: 'username', textContentType: 'username' },
  multiline: { multiline: true, textAlignVertical: 'top' },
};

export function TextField({
  label,
  error,
  hint,
  type = 'text',
  icon,
  containerStyle,
  inputStyle,
  ref,
  onFocus,
  onBlur,
  editable = true,
  ...rest
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const isPassword = type === 'password';
  const multiline = type === 'multiline' || rest.multiline;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <AppText variant="label" style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <View
        style={[
          styles.field,
          multiline ? styles.fieldMultiline : null,
          focused ? [styles.fieldFocused, hardShadow(3, palette.red)] : null,
          error ? styles.fieldError : null,
          !editable ? styles.fieldDisabled : null,
        ]}
      >
        {icon ? <Ionicons name={icon} size={18} color={focused ? colors.accent : colors.text} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.tertiaryLabel}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          editable={editable}
          {...PRESETS[type]}
          {...rest}
          secureTextEntry={isPassword ? hidden : rest.secureTextEntry}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, multiline ? styles.inputMultiline : null, inputStyle]}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            style={({ pressed }) => (pressed ? styles.togglePressed : null)}
          >
            <AppText variant="caption2" color="accent">
              {hidden ? 'Show' : 'Hide'}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="footnote" color="danger" style={styles.helper}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="footnote" color="secondaryLabel" style={styles.helper}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.lg },
  // Comic form: bold label above, white field with an ink outline; focus turns it red.
  label: { marginBottom: 6 },
  field: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: ink.thin + 0.5,
    borderColor: colors.border,
    backgroundColor: palette.white,
  },
  fieldMultiline: { alignItems: 'flex-start', paddingVertical: spacing.xs },
  fieldFocused: { borderColor: palette.red },
  fieldError: { borderColor: palette.red, backgroundColor: '#FFF1F3' },
  fieldDisabled: { opacity: 0.5 },
  input: {
    flex: 1,
    alignSelf: 'stretch',
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: 0,
    paddingVertical: 11,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  inputMultiline: { minHeight: 110 },
  togglePressed: { opacity: 0.35 },
  helper: { marginTop: 6 },
});
