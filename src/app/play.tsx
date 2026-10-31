import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { GameScreen } from '../ui/GameScreen';
import { parsePlayParams } from '../ui/playParams';

/** Rotta di una partita: `/play?level=<1-100>&profile=<easy|normal|medium|hard|expert|master>`. */
export default function Play() {
  const params = useLocalSearchParams<{ level?: string; profile?: string }>();
  const router = useRouter();
  const { level, profile } = parsePlayParams(params.level, params.profile);
  const exit = () => (router.canGoBack() ? router.back() : router.replace('/'));
  if (!level) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>Livello non trovato</Text>
      </View>
    );
  }
  return <GameScreen level={level} profile={profile} onExit={exit} />;
}

const styles = StyleSheet.create({
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  missingText: { fontSize: 16, color: '#111111' },
});
