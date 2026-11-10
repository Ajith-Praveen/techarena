import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button } from '@/components';
import { Burst } from '@/components/comic/Burst';
import { HudBackground } from '@/components/hud/HudBackground';
import { useConfig } from '@/hooks';
import { openUrl } from '@/lib/share';
import { colors, fonts, hardShadow, ink, palette, radius, spacing } from '@/theme';

/** Don't hit the update server more than once per this interval. */
const CHECK_EVERY_MS = 10 * 60 * 1000;

/** Version of the installed app (the native build), e.g. "1.0.0". */
function installedVersion(): string {
  return Updates.runtimeVersion || Constants.expoConfig?.version || '0.0.0';
}

/** -1 / 0 / 1 for dotted versions ("1.2.0" vs "1.10"). */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

/**
 * Keeps installed apps up to date (Android/iOS builds only; the web app is always current):
 * - downloads new app updates (EAS Update) in the background when the app opens or comes back,
 *   then offers "Restart" (otherwise it applies on the next launch);
 * - if the server says this build is too old for that (`minAppVersion`), blocks the app with an
 *   "Update Tech Arena" screen and the download button.
 */
export function AppUpdates() {
  const { config } = useConfig();
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const lastCheck = useRef(0);
  const native = Platform.OS !== 'web';

  useEffect(() => {
    if (!native || __DEV__ || !Updates.isEnabled) return;
    const check = async () => {
      if (Date.now() - lastCheck.current < CHECK_EVERY_MS) return;
      lastCheck.current = Date.now();
      try {
        const found = await Updates.checkForUpdateAsync();
        if (!found.isAvailable) return;
        const fetched = await Updates.fetchUpdateAsync();
        if (fetched.isNew) setReady(true);
      } catch {
        // Offline or server hiccup: try again next time the app comes back.
      }
    };
    void check();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void check();
    });
    return () => sub.remove();
  }, [native]);

  const min = config?.minAppVersion?.trim();
  const tooOld = native && !!min && compareVersions(installedVersion(), min) < 0;
  if (tooOld) return <UpdateRequired downloadUrl={config?.apkDownloadUrl || config?.apkUrl || ''} />;
  if (!ready || dismissed) return null;
  return <RestartBanner onRestart={() => void Updates.reloadAsync()} onLater={() => setDismissed(true)} />;
}

function RestartBanner({ onRestart, onLater }: { onRestart: () => void; onLater: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.bannerWrap, { bottom: insets.bottom + spacing.lg }]}>
      <View style={[styles.banner, hardShadow(4)]}>
        <Ionicons name="sparkles" size={22} color={palette.ink} />
        <View style={styles.flex}>
          <AppText style={styles.bannerTitle}>New version ready!</AppText>
          <AppText variant="caption" color="textSecondary">
            Restart to use it now, or it updates next time you open the app.
          </AppText>
        </View>
        <View style={styles.bannerButtons}>
          <Button title="Restart" size="sm" fullWidth={false} onPress={onRestart} />
          <Button title="Later" size="sm" variant="ghost" fullWidth={false} onPress={onLater} />
        </View>
      </View>
    </View>
  );
}

function UpdateRequired({ downloadUrl }: { downloadUrl: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[StyleSheet.absoluteFill, styles.blocker, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <HudBackground />
      <View style={styles.center}>
        <Burst size={160} color={palette.yellow} points={14}>
          <Ionicons name="download" size={56} color={palette.ink} />
        </Burst>
        <AppText style={styles.blockTitle}>Update Tech Arena</AppText>
        <AppText color="textSecondary" align="center" style={styles.blockText}>
          This version of the app is too old. Download the latest one and install it over this one. Your login and team
          stay the same.
        </AppText>
        {downloadUrl ? (
          <Button title="Download the update" icon="download" size="lg" onPress={() => void openUrl(downloadUrl)} style={styles.blockButton} />
        ) : (
          <AppText color="muted" align="center">
            Ask the organisers for the new app.
          </AppText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bannerWrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center', zIndex: 900 },
  banner: {
    width: '100%',
    maxWidth: 560,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: palette.yellow,
    borderWidth: ink.thick,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  bannerTitle: { fontFamily: fonts.display, fontSize: 20, lineHeight: 23, letterSpacing: 1, color: palette.ink },
  bannerButtons: { alignItems: 'center', gap: 2 },
  blocker: { zIndex: 950, elevation: 950, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  blockTitle: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, letterSpacing: 1, color: palette.ink, textAlign: 'center' },
  blockText: { maxWidth: 420 },
  blockButton: { marginTop: spacing.md, alignSelf: 'stretch', maxWidth: 420, width: '100%' },
});
