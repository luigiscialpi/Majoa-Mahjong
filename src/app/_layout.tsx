import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { openAppStore } from '../infrastructure/storage/openAppStore';
import { SaveProvider } from '../ui/SaveProvider';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SaveProvider open={openAppStore}>
        <Stack screenOptions={{ headerShown: false }} />
      </SaveProvider>
    </GestureHandlerRootView>
  );
}
