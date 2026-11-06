import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { HomeScreen } from '../ui/HomeScreen';
import { useSaves } from '../ui/SaveProvider';

export default function Home() {
  const router = useRouter();
  const { store, home, reload } = useSaves();
  // Tornando dalla partita la home rilegge l'archivio: la scheda «Continua» e le stelle riflettono ciò che è salvato.
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );
  return (
    <HomeScreen
      home={home}
      store={store}
      onPlay={(level, profile) => router.push({ pathname: '/play', params: { level: String(level), profile } })}
      onResume={() => router.push({ pathname: '/play', params: { resume: '1' } })}
      onReload={reload}
    />
  );
}
