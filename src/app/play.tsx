import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { GameScreen } from '../ui/GameScreen';
import { parsePlayParams } from '../ui/playParams';
import { useSaves } from '../ui/SaveProvider';

/**
 * Rotta di una partita: `/play?level=<1-100>&profile=<easy|normal|medium|hard|expert|master>` per una partita nuova,
 * `/play?resume=1` per riprendere quella salvata (livello e profilo vengono dal salvataggio).
 */
export default function Play() {
  const params = useLocalSearchParams<{ level?: string; profile?: string; resume?: string }>();
  const router = useRouter();
  const { store, home, setProgress } = useSaves();
  const exit = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const resuming = params.resume === '1' && home.resume.kind === 'ready' ? home.resume : null;
  const { level, profile } = resuming ? parsePlayParams(String(resuming.info.levelId), resuming.info.profile) : parsePlayParams(params.level, params.profile);
  if (!level || !home.progress.ok) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>{level ? 'Progressi non leggibili' : 'Livello non trovato'}</Text>
      </View>
    );
  }
  return <GameScreen level={level} profile={profile} onExit={exit} store={store} progress={home.progress.value} onProgress={setProgress} resume={resuming?.session} />;
}

const styles = StyleSheet.create({
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  missingText: { fontSize: 16, color: '#111111' },
});
