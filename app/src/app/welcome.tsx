import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthContext';
import { homeFor } from '@/auth/routes';
import { AppText, Banner, Button } from '@/components';
import { Burst } from '@/components/comic/Burst';
import { HudBackground } from '@/components/hud/HudBackground';
import { STEPS } from '@/features/landing/steps';
import { useConfig } from '@/hooks/useConfig';
import { alert } from '@/lib/dialogs';
import { openUrl } from '@/lib/share';
import { colors, fonts, hardShadow, ink, palette, radius, spacing } from '@/theme';

/** Panel colors for the five "how it works" panels, in order. */
const PANEL_BG = [palette.white, '#FFF0A3', '#DCE7FF', '#FFD9EC', '#D5F5DF'];
const NUMBER_BG = [palette.red, palette.blue, palette.purple, palette.pink, palette.green];
const FALLBACK_CRITERIA = ['Idea & Innovation', 'Working Model', 'Uniqueness', 'Impact & Feasibility', 'Presentation & Q&A'];

/** Comic caption box: yellow strip with an ink outline, slightly tilted. */
function Caption({ children, tilt = -1.5, color = palette.yellow }: { children: string; tilt?: number; color?: string }) {
  return (
    <View style={[styles.caption, { backgroundColor: color, transform: [{ rotate: `${tilt}deg` }] }]}>
      <AppText style={styles.captionText}>{children}</AppText>
    </View>
  );
}

/** Speech bubble with a tail on the bottom left. */
function Bubble({ children }: { children: string }) {
  return (
    <View style={styles.bubbleWrap}>
      <View style={[styles.bubble, hardShadow(4)]}>
        <AppText style={styles.bubbleText}>{children}</AppText>
      </View>
      <View style={styles.bubbleTailOuter} />
      <View style={styles.bubbleTailInner} />
    </View>
  );
}

export default function WelcomeScreen() {
  const { role, loading } = useAuth();
  const { config, error, refresh } = useConfig();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pop = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 90, delay: 150, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [pop]);

  if (!loading && role) return <Redirect href={homeFor(role)} />;

  const phone = width < 600;
  const wide = width >= 960;
  const eventName = config?.eventName || 'Tech Arena';
  const registrationOpen = config ? config.registrationOpen : true;
  const apkUrl = config?.apkUrl || '';
  const showApk = Boolean(apkUrl) && Platform.OS !== 'ios';
  const criteria = config?.criteria?.length ? config.criteria.map((c) => ({ label: c.label, max: c.max })) : FALLBACK_CRITERIA.map((label) => ({ label, max: 10 }));
  const year = new Date().getFullYear();
  const stepCols = wide ? 5 : phone ? 1 : 2;
  const contentW = Math.min(width, 1120) - spacing.lg * 2;
  const stepW = Math.floor((contentW - (stepCols - 1) * spacing.lg - 6) / stepCols);
  const burstSize = wide ? 360 : phone ? Math.min(250, width - 110) : 300;

  const onRegister = () => {
    if (!registrationOpen) {
      void alert('Registration closed', 'Team registration is closed. Ask the organisers if you need help.');
      return;
    }
    router.push('/register');
  };

  return (
    <View style={styles.root}>
      <HudBackground />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom }} showsVerticalScrollIndicator={false}>
        <View style={styles.column}>
          {/* ---------- Top bar ---------- */}
          <View style={styles.topBar}>
            <AppText style={styles.logo}>{eventName}</AppText>
            <View style={[styles.status, { backgroundColor: registrationOpen ? palette.green : palette.white }]}>
              <View style={[styles.statusDot, { backgroundColor: registrationOpen ? palette.white : palette.pencil }]} />
              <AppText style={[styles.statusText, { color: registrationOpen ? palette.white : palette.ink }]}>
                {registrationOpen ? 'Registration open' : 'Registration closed'}
              </AppText>
            </View>
          </View>

          {error && !config ? (
            <Banner type="error" title="Can't reach the server" message={error.message} action={{ label: 'Retry', onPress: () => void refresh() }} />
          ) : null}

          {/* ---------- Cover ---------- */}
          <View style={[styles.cover, hardShadow(7), wide ? styles.coverWide : null]}>
            <View style={[styles.coverText, wide ? styles.flex : null]}>
              <Caption>{`Issue #1 · ${year} · The project expo`}</Caption>
              <AppText style={[styles.headline, phone ? styles.headlinePhone : null]}>
                Build it.{'\n'}
                <AppText style={[styles.headline, phone ? styles.headlinePhone : null, { color: palette.red }]}>Pitch it.</AppText>
                {'\n'}Win it!
              </AppText>
              <AppText style={styles.lede}>
                Register your team, get your 4-digit code and face two judges on expo day. The best three take the trophy.
              </AppText>
              <View style={[styles.actions, phone ? null : styles.actionsRow]}>
                <Button title={registrationOpen ? 'Register your team!' : 'Registration closed'} iconRight={registrationOpen ? 'arrow-forward' : 'lock-closed'} size="lg" onPress={onRegister} disabled={!registrationOpen} fullWidth={phone} />
                <View style={styles.loginRow}>
                  <Button title="Team login" variant="secondary" onPress={() => router.push('/login')} fullWidth={phone} style={phone ? styles.flex : null} />
                  <Button title="Judge login" variant="secondary" onPress={() => router.push('/judge-login')} fullWidth={phone} style={phone ? styles.flex : null} />
                </View>
              </View>
            </View>
            <View style={[styles.coverArt, wide ? null : styles.coverArtStacked]}>
              <Animated.View style={{ transform: [{ scale: pop }, { rotate: '-6deg' }] }}>
                <Burst size={burstSize} color={palette.yellow}>
                  <AppText style={[styles.pow, { fontSize: burstSize * 0.2, lineHeight: burstSize * 0.21 }]}>KA-{'\n'}BUILD!</AppText>
                </Burst>
              </Animated.View>
              <Bubble>2 judges. 5 scores. Top 3 win!</Bubble>
            </View>
          </View>

          {/* ---------- How it works: a comic strip ---------- */}
          <View style={styles.sectionHead}>
            <Caption tilt={1.5} color={palette.white}>How it works</Caption>
          </View>
          <View style={styles.strip}>
            {STEPS.map((step, i) => (
              <View
                key={step.title}
                style={[
                  styles.panel,
                  hardShadow(5),
                  { width: stepW, backgroundColor: PANEL_BG[i % PANEL_BG.length], transform: [{ rotate: phone ? '0deg' : `${i % 2 ? 0.8 : -0.8}deg` }] },
                ]}
              >
                <View style={styles.panelTop}>
                  <View style={[styles.num, { backgroundColor: NUMBER_BG[i % NUMBER_BG.length] }]}>
                    <AppText style={styles.numText}>{i + 1}</AppText>
                  </View>
                  <Ionicons name={step.icon} size={30} color={palette.ink} />
                </View>
                <AppText style={styles.panelTitle}>{step.title}</AppText>
                <AppText variant="subheadline" style={styles.panelText}>
                  {step.text}
                </AppText>
              </View>
            ))}
          </View>

          {/* ---------- The scores ---------- */}
          <View style={[styles.scores, hardShadow(6)]}>
            <View style={styles.scoresHead}>
              <AppText style={styles.scoresTitle}>How you're scored</AppText>
              <AppText variant="footnote" style={styles.scoresNote}>
                Each judge marks every one of these. Marks are final once submitted.
              </AppText>
            </View>
            <View style={styles.chips}>
              {criteria.map((c, i) => (
                <View key={c.label} style={[styles.chip, hardShadow(3), { backgroundColor: i % 2 ? palette.white : palette.yellow }]}>
                  <AppText style={styles.chipLabel}>{c.label}</AppText>
                  <View style={styles.chipMax}>
                    <AppText style={styles.chipMaxText}>{`0–${c.max}`}</AppText>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* ---------- Footer ---------- */}
          <View style={styles.footer}>
            <AppText style={styles.footerTitle}>Ready, set, ship!</AppText>
            <View style={[styles.footerActions, phone ? null : styles.actionsRow]}>
              <Button title="Register your team!" size="md" onPress={onRegister} disabled={!registrationOpen} fullWidth={phone} />
              {showApk ? <Button title="Get the Android app" icon="logo-android" variant="secondary" onPress={() => void openUrl(apkUrl)} fullWidth={phone} /> : null}
            </View>
            <AppText variant="footnote" style={styles.install}>
              On iPhone: open this page in Safari, tap Share, then Add to Home Screen.
            </AppText>
            <Pressable onPress={() => router.push('/admin-login')} hitSlop={10} accessibilityRole="link">
              <AppText variant="label" style={styles.footerLink}>
                Organisers
              </AppText>
            </Pressable>
            <AppText style={styles.company}>{`© ${year} robos.inc`}</AppText>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: spacing.lg, paddingRight: spacing.lg + 6 },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.lg, gap: spacing.md },
  logo: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, letterSpacing: 1.2, color: palette.red, textTransform: 'uppercase' },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: ink.thin,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: palette.ink },
  statusText: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16 },

  cover: {
    backgroundColor: palette.white,
    borderWidth: ink.thick + 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.xxl,
    overflow: 'visible',
  },
  coverWide: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl, padding: spacing.xxl },
  coverText: { gap: spacing.lg },
  headline: { fontFamily: fonts.display, fontSize: 76, lineHeight: 74, letterSpacing: 1.5, color: palette.ink },
  headlinePhone: { fontSize: 58, lineHeight: 57 },
  lede: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 25, color: colors.textSecondary, maxWidth: 520 },
  actions: { gap: spacing.md, marginTop: spacing.sm },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  loginRow: { flexDirection: 'row', gap: spacing.md },

  coverArt: { alignItems: 'center', justifyContent: 'center' },
  coverArtStacked: { marginTop: spacing.xl },
  pow: { fontFamily: fonts.display, color: palette.red, textAlign: 'center', letterSpacing: 1 },

  caption: {
    alignSelf: 'flex-start',
    borderWidth: ink.thin,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  captionText: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase', color: palette.ink },

  bubbleWrap: { marginTop: spacing.lg, alignSelf: 'center' },
  bubble: {
    backgroundColor: palette.white,
    borderWidth: ink.thick,
    borderColor: colors.border,
    borderRadius: 26,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  bubbleText: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 21, color: palette.ink, textAlign: 'center' },
  bubbleTailOuter: {
    position: 'absolute',
    top: -14,
    left: 34,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: palette.ink,
  },
  bubbleTailInner: {
    position: 'absolute',
    top: -8,
    left: 38,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 11,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: palette.white,
  },

  sectionHead: { marginBottom: spacing.lg },
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginBottom: spacing.xxl },
  panel: {
    borderWidth: ink.thick,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    minHeight: 190,
  },
  panelTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  num: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: ink.thin,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, color: palette.white },
  panelTitle: { fontFamily: fonts.display, fontSize: 30, lineHeight: 32, letterSpacing: 1, color: palette.ink },
  panelText: { color: colors.textSecondary },

  scores: {
    backgroundColor: palette.blue,
    borderWidth: ink.thick,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.xxl,
    gap: spacing.lg,
  },
  scoresHead: { gap: spacing.xs },
  scoresTitle: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, letterSpacing: 1, color: palette.white },
  scoresNote: { color: palette.white },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: ink.thin,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingLeft: spacing.md,
    paddingRight: 4,
    paddingVertical: 4,
  },
  chipLabel: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 18, color: palette.ink },
  chipMax: { backgroundColor: palette.ink, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  chipMaxText: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16, color: palette.white },

  footer: { alignItems: 'center', paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  footerTitle: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, letterSpacing: 1.2, color: palette.ink, textAlign: 'center' },
  footerActions: { gap: spacing.md, alignSelf: 'stretch', justifyContent: 'center' },
  install: { color: colors.muted, textAlign: 'center', maxWidth: 420 },
  footerLink: { textDecorationLine: 'underline' },
  company: { fontFamily: fonts.regular, fontSize: 10, lineHeight: 14, color: colors.faint, marginTop: spacing.sm },
});
