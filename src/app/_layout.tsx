import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { openAppStore } from '../infrastructure/storage/openAppStore';
import { openAppSettingsStore } from '../infrastructure/storage/sqliteSettingsStore';
import { SaveProvider } from '../ui/SaveProvider';
import { SettingsProvider } from '../ui/SettingsProvider';
import { FONT_MAP } from '../ui/theme/typography';
import { LanguageProvider } from '../infrastructure/i18n';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_MAP);

  // Non blocchiamo se c'è un errore di caricamento: si usa il font di fallback
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SettingsProvider open={openAppSettingsStore}>
        <LanguageProvider initial="it">
          <SaveProvider open={openAppStore}>
            <Stack screenOptions={{ headerShown: false }} />
          </SaveProvider>
        </LanguageProvider>
      </SettingsProvider>
    </GestureHandlerRootView>
  );
}
