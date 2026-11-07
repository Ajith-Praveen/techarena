import { Bangers_400Regular } from '@expo-google-fonts/bangers';
import { SpaceGrotesk_400Regular, SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { PhotoGate } from '@/auth/PhotoGate';
import { BootOverlay } from '@/components/BootScreen';
import { colors, fonts } from '@/theme';

SystemUI.setBackgroundColorAsync(colors.bg).catch(() => undefined);

// Web: paper page behind the app, app font on form controls, no tap flash.
if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('hud-base-style')) {
  const style = document.createElement('style');
  style.id = 'hud-base-style';
  style.textContent = [
    `html,body{background-color:${colors.bg};color-scheme:light;font-family:${fonts.regular},system-ui,sans-serif;`,
    '-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;-webkit-tap-highlight-color:transparent;}',
    `input,textarea,button,select{font-family:${fonts.medium},system-ui,sans-serif;}`,
    `::selection{background:${colors.accentDim};}`,
  ].join('');
  document.head.appendChild(style);
  const meta = document.querySelector('meta[name="theme-color"]') ?? document.createElement('meta');
  meta.setAttribute('name', 'theme-color');
  meta.setAttribute('content', colors.bg);
  if (!meta.parentNode) document.head.appendChild(meta);
}

const navTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.accent,
    background: colors.bg,
    card: colors.cardSolid,
    text: colors.text,
    border: colors.border,
    notification: colors.amber,
  },
};

function Boot({ fontsReady }: { fontsReady: boolean }) {
  const { loading } = useAuth();
  return <BootOverlay ready={fontsReady && !loading} />;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Bangers_400Regular,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });
  // A font failure must never block the app: fall back to system fonts.
  const fontsReady = fontsLoaded || Boolean(fontError);

  return (
    <SafeAreaProvider style={{ backgroundColor: colors.bg }}>
      <ThemeProvider value={navTheme}>
        <AuthProvider>
          <StatusBar style="dark" />
          <View style={{ flex: 1, backgroundColor: colors.bg }}>
            {fontsReady ? (
              <PhotoGate>
                <Stack
                  screenOptions={{
                    // Screens draw their own HUD nav bar via <Screen title=...>.
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.bg },
                    animation: 'fade',
                  }}
                />
              </PhotoGate>
            ) : null}
            <Boot fontsReady={fontsReady} />
          </View>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
