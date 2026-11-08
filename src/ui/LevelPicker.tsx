import { useEffect, useState, type ReactNode } from 'react';
import { FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PROFILES, type Profile } from '../domain/profile';
import { levelProgress, type IslandInfo, type Progress } from '../domain/progress';
import { legacyLevels } from '../infrastructure/content/legacyLevels';
import { PROFILE_KEYS, starsText } from './format';
import { levelStatus } from './levelStatus';
import { FeltBackground } from './FeltBackground';
import { colors } from './theme/colors';
import { fontFamilies } from './theme/typography';
import { useTranslation, type Language } from '../infrastructure/i18n';

/** Quanto resta visibile il motivo di un lucchetto. */
export const REASON_MS = 4000;

const LANGS: readonly Language[] = ['it', 'en', 'fr'];
const LANG_LABELS: Record<Language, string> = { it: '🇮🇹 IT', en: '🇬🇧 EN', fr: '🇫🇷 FR' };

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
  const { t, lang, setLang } = useTranslation();

  // Il motivo di un lucchetto sparisce da solo; un nuovo tocco lo sostituisce e riparte il conto.
  useEffect(() => {
    if (!reason) return;
    const id = setTimeout(() => setReason(null), REASON_MS);
    return () => clearTimeout(id);
  }, [reason]);

  return (
    <FeltBackground cyRatio={0.2} testID="level-picker-bg">
      <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}>
        <View style={styles.langRow}>
          {LANGS.map((l) => (
            <Pressable
              key={l}
              onPress={() => setLang(l)}
              style={[styles.langChip, l === lang ? styles.langChipOn : null]}
              accessibilityRole="button"
              accessibilityState={{ selected: l === lang }}
              testID={`lang-${l}`}
            >
              <Text style={[styles.langText, l === lang ? styles.langTextOn : null]}>{LANG_LABELS[l]}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.title} accessibilityRole="header">
          Majoa Mahjong
        </Text>
        {top}
        <Text style={styles.hint}>{t('chooseLevel')}</Text>
        <View style={styles.chips}>
          {PROFILES.map((p) => (
            <Pressable key={p} onPress={() => setProfile(p)} style={[styles.chip, p === profile ? styles.chipOn : null]} accessibilityRole="button" accessibilityState={{ selected: p === profile }} testID={`profile-${p}`}>
              <Text style={[styles.chipText, p === profile ? styles.chipTextOn : null]}>{t(PROFILE_KEYS[p])}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.prova}>
          <Text style={styles.provaText}>{t('testMode')}</Text>
          <Switch value={prova} onValueChange={setProva} accessibilityLabel={t('testMode')} testID="prova-switch" />
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
            const status = levelStatus(progress, islands, item.id, prova, t);
            const stars = levelProgress(progress, item.id).stars;
            const tris = item.groupSize === 3;
            const trisLabel = tris ? ` (${t('trisLabel')})` : '';
            const label = status.open
              ? `${t('level', { n: item.id })}${trisLabel}, ${t('starsOfThree', { n: stars })}`
              : `${t('level', { n: item.id })}${trisLabel}, ${t('lockedLv').toLowerCase()}. ${status.reason}`;
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
    </FeltBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  langRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingHorizontal: 12, marginBottom: 4 },
  langChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, backgroundColor: colors.panel, minHeight: 32, justifyContent: 'center', alignItems: 'center' },
  langChipOn: { backgroundColor: colors.feltA, borderWidth: 1.5, borderColor: colors.accent },
  langText: { fontSize: 13, color: colors.inkSoft, fontFamily: fontFamilies.bodyBold },
  langTextOn: { color: colors.ink },
  title: { fontSize: 30, color: colors.accent, textAlign: 'center', fontFamily: fontFamilies.title, letterSpacing: 0.5 },
  hint: { fontSize: 14, color: colors.inkSoft, textAlign: 'center', marginTop: 4, marginBottom: 12, fontFamily: fontFamilies.body },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, paddingHorizontal: 12, marginBottom: 8 },
  chip: { minHeight: 48, paddingHorizontal: 16, borderRadius: 24, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.feltA, borderWidth: 1.5, borderColor: colors.accent },
  chipText: { fontSize: 14, color: colors.inkSoft, fontFamily: fontFamilies.bodyBold },
  chipTextOn: { color: colors.ink },
  prova: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, marginBottom: 8 },
  provaText: { flex: 1, fontSize: 14, color: colors.ink, fontFamily: fontFamilies.body },
  reason: { marginHorizontal: 12, marginBottom: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.panelHeavy },
  reasonText: { color: colors.ink, fontSize: 14, textAlign: 'center', fontFamily: fontFamilies.bodyBold },
  grid: { paddingHorizontal: 12, paddingBottom: 16, gap: 8 },
  gridRow: { gap: 8 },
  level: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#f6edd2' },
  levelTris: { backgroundColor: '#ffe9cb' },
  levelLocked: { backgroundColor: 'rgba(0,0,0,0.35)' },
  levelPressed: { opacity: 0.7 },
  levelText: { fontSize: 16, color: colors.edge2, fontFamily: fontFamilies.title },
  levelTextLocked: { color: 'rgba(255,255,255,0.45)' },
  stars: { fontSize: 11, color: '#c48900', marginTop: 2, fontFamily: fontFamilies.title },
});
