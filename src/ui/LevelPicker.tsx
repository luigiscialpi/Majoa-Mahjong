import { useEffect, useState, type ReactNode } from 'react';
import { FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PROFILES, type Profile } from '../domain/profile';
import { levelProgress, type IslandInfo, type Progress } from '../domain/progress';
import { legacyLevels } from '../infrastructure/content/legacyLevels';
import { PROFILE_NAMES, starsText } from './format';
import { levelStatus } from './levelStatus';

/** Quanto resta visibile il motivo di un lucchetto. */
export const REASON_MS = 4000;

export type LevelPickerProps = {
  progress: Progress;
  islands: readonly IslandInfo[];
  onPlay: (level: number, profile: Profile) => void;
  /** Sopra la scelta del profilo: la scheda «Continua» e gli avvisi della home. */
  top?: ReactNode;
};

// ponytail: selettore provvisorio dei 100 livelli e dei profili, per provare le partite; lo sostituisce la mappa delle isole.
export function LevelPicker({ progress, islands, onPlay, top }: LevelPickerProps) {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<Profile>('normal');
  const [prova, setProva] = useState(true);
  const [reason, setReason] = useState<{ text: string } | null>(null);

  // Il motivo di un lucchetto sparisce da solo; un nuovo tocco lo sostituisce e riparte il conto.
  useEffect(() => {
    if (!reason) return;
    const id = setTimeout(() => setReason(null), REASON_MS);
    return () => clearTimeout(id);
  }, [reason]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom }]}>
      <Text style={styles.title} accessibilityRole="header">
        Majoa Mahjong
      </Text>
      {top}
      <Text style={styles.hint}>Scegli profilo e livello</Text>
      <View style={styles.chips}>
        {PROFILES.map((p) => (
          <Pressable key={p} onPress={() => setProfile(p)} style={[styles.chip, p === profile ? styles.chipOn : null]} accessibilityRole="button" accessibilityState={{ selected: p === profile }} testID={`profile-${p}`}>
            <Text style={[styles.chipText, p === profile ? styles.chipTextOn : null]}>{PROFILE_NAMES[p]}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.prova}>
        <Text style={styles.provaText}>Modalità prova: tutti i livelli aperti</Text>
        <Switch value={prova} onValueChange={setProva} accessibilityLabel="Modalità prova: tutti i livelli aperti" testID="prova-switch" />
      </View>
      {reason ? (
        <View style={styles.reason} accessibilityRole="alert" accessibilityLiveRegion="polite" testID="level-reason">
          <Text style={styles.reasonText}>🔒 {reason.text}</Text>
        </View>
      ) : null}
      <FlatList
        data={legacyLevels}
        keyExtractor={(l) => String(l.id)}
        numColumns={5}
        initialNumToRender={legacyLevels.length} // sono solo 100 celle semplici: renderle tutte evita buchi per i lettori di schermo
        extraData={`${prova}|${progress.coins}|${JSON.stringify(progress.levels)}`}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.gridRow}
        renderItem={({ item }) => {
          const status = levelStatus(progress, islands, item.id, prova);
          const stars = levelProgress(progress, item.id).stars;
          const tris = item.groupSize === 3;
          const label = status.open ? `Livello ${item.id}${tris ? ' (Tris)' : ''}, ${stars} stelle su 3` : `Livello ${item.id}${tris ? ' (Tris)' : ''}, bloccato. ${status.reason}`;
          return (
            <Pressable
              style={({ pressed }) => [styles.level, tris ? styles.levelTris : null, status.open ? null : styles.levelLocked, pressed ? styles.levelPressed : null]}
              onPress={() => (status.open ? onPlay(item.id, profile) : setReason({ text: status.reason }))}
              accessibilityRole="button"
              accessibilityLabel={label}
              testID={`level-${item.id}`}
            >
              <Text style={[styles.levelText, status.open ? null : styles.levelTextLocked]}>{status.open ? item.id : `🔒 ${item.id}`}</Text>
              {status.open ? <Text style={styles.stars}>{starsText(stars)}</Text> : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },
  title: { fontSize: 28, fontWeight: '700', color: '#111111', textAlign: 'center' },
  hint: { fontSize: 14, color: '#555555', textAlign: 'center', marginTop: 4, marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, paddingHorizontal: 12, marginBottom: 8 },
  chip: { minHeight: 48, paddingHorizontal: 16, borderRadius: 24, backgroundColor: '#eeeeee', alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: '#1f6b57' },
  chipText: { fontSize: 14, color: '#222222', fontWeight: '600' },
  chipTextOn: { color: '#ffffff' },
  prova: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, marginBottom: 8 },
  provaText: { flex: 1, fontSize: 14, color: '#222222' },
  reason: { marginHorizontal: 12, marginBottom: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: '#1c1426' },
  reasonText: { color: '#ffffff', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  grid: { paddingHorizontal: 12, paddingBottom: 16, gap: 8 },
  gridRow: { gap: 8 },
  level: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#e8f1ee' },
  levelTris: { backgroundColor: '#f3e7d7' },
  levelLocked: { backgroundColor: '#dddddd' },
  levelPressed: { opacity: 0.7 },
  levelText: { fontSize: 16, fontWeight: '700', color: '#17503b' },
  levelTextLocked: { color: '#444444' },
  stars: { fontSize: 11, color: '#3f6354', marginTop: 2 },
});
