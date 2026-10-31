import { useRouter } from 'expo-router';
import { LevelPicker } from '../ui/LevelPicker';

export default function Home() {
  const router = useRouter();
  return <LevelPicker onPlay={(level, profile) => router.push({ pathname: '/play', params: { level: String(level), profile } })} />;
}
