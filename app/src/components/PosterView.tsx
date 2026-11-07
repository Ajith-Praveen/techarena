import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { imageUri } from '@/api/client';
import { colors, radius, spacing } from '@/theme';

import { AppText } from './AppText';
import { ComicPoster, type AutoPosterData } from './comic/ComicPoster';

export interface PosterViewProps {
  /** Relative `/api/images/<id>` URL, local URI, or null when no poster exists yet. */
  url: string | null | undefined;
  /** Thumbnail width (height follows the 3:4 portrait ratio). Omit to fill the parent width. */
  width?: number;
  /** Text shown when there is no poster. */
  emptyText?: string;
  /** Team data for the auto-generated comic poster, shown when no poster was uploaded. */
  auto?: AutoPosterData | null;
  style?: StyleProp<ViewStyle>;
}

/**
 * Portrait poster thumbnail; tap to open it full screen. Shows the uploaded poster, or the
 * auto-generated comic poster (`auto`) when the team has not uploaded one.
 */
export function PosterView({ url, width, emptyText = 'No poster uploaded', auto, style }: PosterViewProps) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [measured, setMeasured] = useState(0);
  const insets = useSafeAreaInsets();
  const screen = useWindowDimensions();
  const uri = imageUri(url ?? null);
  const box: ViewStyle = width ? { width, aspectRatio: 3 / 4 } : { width: '100%', aspectRatio: 3 / 4 };

  if ((!uri || failed) && auto) {
    const thumbW = width ?? measured;
    const fullW = Math.max(200, Math.min(screen.width - spacing.lg * 2, (screen.height - insets.top - insets.bottom - 120) * 0.75));
    return (
      <>
        <Pressable
          onPress={() => setOpen(true)}
          onLayout={width ? undefined : (e) => setMeasured(e.nativeEvent.layout.width)}
          accessibilityRole="imagebutton"
          accessibilityLabel="Open poster"
          style={({ pressed }) => [styles.thumb, styles.autoThumb, box, pressed ? styles.pressed : null, style]}
        >
          {thumbW > 0 ? <ComicPoster data={auto} width={thumbW - 4} /> : null}
          {thumbW >= 110 ? (
            <View style={[styles.tag, styles.tagTop]}>
              <Ionicons name="sparkles" size={12} color="#FFFFFF" />
              <AppText variant="caption2" style={styles.tagText}>
                Auto poster
              </AppText>
            </View>
          ) : null}
        </Pressable>
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
          <View style={styles.backdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="Close poster" />
            <View style={[styles.autoFull, { marginTop: insets.top + 64 }]} pointerEvents="none">
              <View style={styles.autoFrame}>
                <ComicPoster data={auto} width={fullW} />
              </View>
            </View>
            <Pressable
              onPress={() => setOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={12}
              style={[styles.close, { top: insets.top + spacing.md }]}
            >
              <Ionicons name="close" size={22} color={colors.text} />
              <AppText variant="sectionHeader">Close</AppText>
            </Pressable>
          </View>
        </Modal>
      </>
    );
  }

  if (!uri || failed) {
    return (
      <View style={[styles.empty, box, style]}>
        <Ionicons name="document-outline" size={28} color={colors.faint} />
        <AppText variant="caption2" color="muted" align="center">
          {emptyText}
        </AppText>
      </View>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="imagebutton"
        accessibilityLabel="Open poster"
        style={({ pressed }) => [styles.thumb, box, pressed ? styles.pressed : null, style]}
      >
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} />
        <View style={styles.tag}>
          <Ionicons name="expand-outline" size={12} color={colors.text} />
          <AppText variant="caption2" color="text">
            Poster
          </AppText>
        </View>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="Close poster" />
          <View style={[styles.full, { marginTop: insets.top + 56, marginBottom: insets.bottom + spacing.lg }]} pointerEvents="none">
            <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
          </View>
          <Pressable
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={12}
            style={[styles.close, { top: insets.top + spacing.md }]}
          >
            <Ionicons name="close" size={22} color={colors.text} />
            <AppText variant="sectionHeader">Close</AppText>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  thumb: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' },
  pressed: { opacity: 0.8 },
  autoThumb: { borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tagText: { color: '#FFFFFF' },
  tagTop: { top: 6, right: 6, bottom: 'auto', left: 'auto' },
  autoFull: { alignItems: 'center' },
  autoFrame: { borderWidth: 3, borderColor: '#111111', backgroundColor: '#FFFFFF' },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  tag: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: radius.sm,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(1, 3, 7, 0.96)' },
  full: { flex: 1, marginHorizontal: spacing.md },
  close: {
    position: 'absolute',
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
});
