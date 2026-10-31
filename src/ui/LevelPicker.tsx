import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PROFILES, type Profile } from '../domain/profile';
import { legacyLevels } from '../infrastructure/content/legacyLevels';
import { PROFILE_NAMES } from './format';

// ponytail: selettore provvisorio dei 100 livelli e dei profili, per provare le partite; lo sostituisce la mappa delle isole.
export function LevelPicker({ onPlay }: { onPlay: (level: number, profile: Profile) => void }) {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<Profile>('normal');
  return (
    <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom }]}>
      <Text style={styles.title}>Majoa Mahjong</Text>
      <Text style={styles.hint}>Scegli profilo e livello</Text>
      <View style={styles.chips}>
        {PROFILES.map((p) => (
          <Pressable key={p} onPress={() => setProfile(p)} style={[styles.chip, p === profile ? styles.chipOn : null]} accessibilityRole="button" accessibilityState={{ selected: p === profile }} testID={`profile-${p}`}>
            <Text style={[styles.chipText, p === profile ? styles.chipTextOn : null]}>{PROFILE_NAMES[p]}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={legacyLevels}
        keyExtractor={(l) => String(l.id)}
        numColumns={5}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.gridRow}
        renderItem={({ item }) => (
          <Pressable style={[styles.level, item.groupSize === 3 ? styles.levelTris : null]} onPress={() => onPlay(item.id, profile)} accessibilityRole="button" accessibilityLabel={`Livello ${item.id}`} testID={`level-${item.id}`}>
            <Text style={styles.levelText}>{item.id}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff' },
  title: { fontSize: 28, fontWeight: '700', color: '#111111', textAlign: 'center' },
  hint: { fontSize: 14, color: '#666666', textAlign: 'center', marginTop: 4, marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, paddingHorizontal: 12, marginBottom: 12 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#eeeeee' },
  chipOn: { backgroundColor: '#1f6b57' },
  chipText: { fontSize: 14, color: '#222222', fontWeight: '600' },
  chipTextOn: { color: '#ffffff' },
  grid: { paddingHorizontal: 12, paddingBottom: 16, gap: 8 },
  gridRow: { gap: 8 },
  level: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#e8f1ee' },
  levelTris: { backgroundColor: '#f3e7d7' },
  levelText: { fontSize: 16, fontWeight: '700', color: '#17503b' },
});
