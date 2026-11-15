import { useRouter } from 'expo-router';
import { SettingsScreen } from '../ui/SettingsScreen';

export default function SettingsRoute() {
  const router = useRouter();
  return <SettingsScreen onBack={() => router.back()} />;
}
