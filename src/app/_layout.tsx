import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { openAppStore } from '../infrastructure/storage/openAppStore';
import { SaveProvider } from '../ui/SaveProvider';
import { FONT_MAP } from '../ui/theme/typography';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_MAP);

  // Non blocchiamo se c'è un errore di caricamento: si usa il font di fallback
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SaveProvider open={openAppStore}>
        <Stack screenOptions={{ headerShown: false }} />
      </SaveProvider>
    </GestureHandlerRootView>
  );
}
