import { useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Platform, StyleSheet, TextInput, View, useWindowDimensions, type TextInputInstance } from 'react-native';

import { tapFeedback } from '@/lib/haptics';
import { colors, fonts, hardShadow, ink, palette, radius, spacing } from '@/theme';

import { AppText } from './AppText';

export interface OtpInputHandle {
  focus: () => void;
  blur: () => void;
}

export interface OtpInputProps {
  /** Digits entered so far (controlled). */
  value: string;
  onChange: (value: string) => void;
  /** Fired once when the last digit is entered (or a full code is pasted). */
  onComplete?: (code: string) => void;
  length?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  /** Red boxes (e.g. after "no team with that code"). */
  error?: boolean;
  size?: 'md' | 'lg';
  ref?: Ref<OtpInputHandle>;
}

const BOX = { md: { w: 60, h: 72, font: 36 }, lg: { w: 76, h: 92, font: 48 } };

/**
 * OTP-style numeric input. A single transparent TextInput covers the boxes, which gives
 * auto-advance, backspace-goes-back, paste and SMS autofill for free on every platform.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 4,
  autoFocus = false,
  disabled = false,
  error = false,
  size = 'lg',
  ref,
}: OtpInputProps) {
  const inputRef = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);
  const { width } = useWindowDimensions();
  const dims = BOX[size === 'lg' && width < 400 ? 'md' : size];

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    blur: () => inputRef.current?.blur(),
  }));

  const handleChange = (text: string) => {
    const next = text.replace(/\D/g, '').slice(0, length);
    if (next === value) return;
    if (next.length > value.length) tapFeedback();
    onChange(next);
    if (next.length === length && value.length !== length) onComplete?.(next);
  };

  const active = Math.min(value.length, length - 1);

  return (
    <View style={[styles.wrap, disabled ? styles.disabled : null]}>
      <View style={styles.row} pointerEvents="none">
        {Array.from({ length }, (_, i) => {
          const isActive = focused && i === active && !disabled;
          return (
            <View
              key={i}
              style={[
                styles.box,
                { width: dims.w, height: dims.h },
                value[i] ? styles.filled : null,
                isActive ? [styles.active, hardShadow(4, palette.ink)] : value[i] ? hardShadow(3) : null,
                error ? styles.error : null,
              ]}
            >
              <AppText style={[styles.digit, { fontSize: dims.font, lineHeight: dims.font + 8 }]}>
                {value[i] ?? ''}
              </AppText>
              {isActive && !value[i] ? <View style={styles.caret} /> : null}
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        editable={!disabled}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoCorrect={false}
        caretHidden
        selection={{ start: value.length, end: value.length }}
        contextMenuHidden={false}
        selectionColor="transparent"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={`${length} digit code`}
        style={styles.hiddenInput}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', position: 'relative' },
  disabled: { opacity: 0.5 },
  row: { flexDirection: 'row', gap: spacing.md },
  // Comic panels: white boxes with a thick ink outline; the focused box turns yellow.
  box: {
    borderRadius: radius.md,
    borderWidth: ink.thick,
    borderColor: colors.borderStrong,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filled: { borderColor: colors.borderStrong },
  active: { backgroundColor: palette.yellow },
  error: { borderColor: colors.danger, backgroundColor: '#FFD9DF' },
  // Digits use the bold sans: in Bangers a 7 reads like a 1.
  digit: { color: colors.text, fontFamily: fonts.bold, letterSpacing: 0 },
  caret: { position: 'absolute', width: '45%', height: 4, bottom: '22%', backgroundColor: palette.ink },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.011,
    color: 'transparent',
    fontSize: 16,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', caretColor: 'transparent' } as object) : null),
  },
});
