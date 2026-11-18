import { useEffect, useState, type ReactNode } from 'react';
import { FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PROFILES, type Profile } from '../domain/profile';
import { islandStars, levelProgress, type IslandInfo, type Progress } from '../domain/progress';
import { campaignLevelById, campaignLevelsFor, trisLevelIds } from '../infrastructure/content/campaignLevels';
import { PROFILE_KEYS, displayLevelNumber, islandName, starsText } from './format';
import { islandStatus, levelStatus } from './levelStatus';
import { FeltBackground } from './FeltBackground';
import { colors } from './theme/colors';
import { fontFamilies } from './theme/typography';
import { useTranslation, type Language } from '../infrastructure/i18n';
import { useSettings } from './SettingsProvider';
import { BG_PALETTE_COLORS } from '../infrastructure/content/appearancePalettes';
import { AppIcon } from './AppIcon';

/** Quanto resta visibile il motivo di un lucchetto. */
export const REASON_MS = 4000;

const LANGS: readonly Language[] = ['it', 'en', 'fr'];
const LANG_LABELS: Record<Language, string> = { it: 'IT', en: 'EN', fr: 'FR' };
const LANG_NAMES: Record<Language, string> = { it: 'Italiano', en: 'English', fr: 'Français' };

type IslandRow = { island: IslandInfo; index: number; open: boolean; reason?: string };

type LevelPickerProps = {
  progress: Progress;
  islands: readonly IslandInfo[];
  onPlay: (level: number, profile: Profile) => void;
  /** Sopra la mappa: la scheda «Continua» e gli avvisi della home. */
  top?: ReactNode;
  /** Apre la schermata delle impostazioni. */
  onOpenSettings?: () => void;
};

/** Mappa della campagna e livelli dell'isola scelta (`docs/motore-livelli.md`, «Progressione e sblocco»). */
export function LevelPicker({ progress, islands, onPlay, top, onOpenSettings }: LevelPickerProps) {
  const insets = useSafeAreaInsets();
  const [prova, setProva] = useState(true);
  const [selectedIslandId, setSelectedIslandId] = useState<string | null>(null);
  const [reason, setReason] = useState<{ text: string } | null>(null);
  const { t, lang, setLang } = useTranslation();
  const { settings, updateSetting } = useSettings();
  // Il profilo è l'impostazione «Difficoltà»: la scelta qui e quella nelle Impostazioni sono la stessa
  const profile = settings.defaultProfile;
  const bgFeltA = settings.bgPalette !== 'level' ? BG_PALETTE_COLORS[settings.bgPalette].feltA : colors.feltA;
  const bgFeltB = settings.bgPalette !== 'level' ? BG_PALETTE_COLORS[settings.bgPalette].feltB : colors.feltB;
  const selectedIsland = islands.find((island) => island.id === selectedIslandId);
  const selectedTris = selectedIslandId === 'tris';
  const selectedLevelIds = selectedIsland?.levelIds ?? (selectedTris ? trisLevelIds : []);
  const selectedName = selectedIsland ? islandName(selectedIsland.id, t) : t('trisLabel');
  const trisStars = trisLevelIds.reduce((sum, id) => sum + levelProgress(progress, id).stars, 0);

  // Il motivo di un livello chiuso sparisce da solo; un nuovo tocco lo sostituisce e riparte il conto.
  useEffect(() => {
    if (!reason) return;
    const id = setTimeout(() => setReason(null), REASON_MS);
    return () => clearTimeout(id);
  }, [reason]);

  const firstClosed = islands.findIndex((island, index) => !islandStatus(progress, islands, index, false, t).open);
  const mapRows: IslandRow[] = islands.flatMap((island, index) => {
    const status = islandStatus(progress, islands, index, prova, t);
    return status.open || index === firstClosed ? [{ island, index, open: status.open, reason: status.open ? undefined : status.reason }] : [];
  });

  const toggle = (
    <View style={styles.prova} testID="prova-row">
      <Text style={styles.provaText}>{t('testMode')}</Text>
      <Switch value={prova} onValueChange={setProva} accessibilityLabel={t('testMode')} testID="prova-switch" />
    </View>
  );

  return (
    <FeltBackground colorA={bgFeltA} colorB={bgFeltB} cyRatio={0.2} testID="level-picker-bg">
      <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom }]}>
        <View style={styles.topRow}>
          <View style={styles.langRow}>
            {LANGS.map((l) => (
              <Pressable
                key={l}
                onPress={() => setLang(l)}
                style={[styles.langChip, l === lang ? styles.langChipOn : null]}
                accessibilityRole="button"
                accessibilityLabel={LANG_NAMES[l]}
                accessibilityState={{ selected: l === lang }}
                testID={'lang-' + l}
              >
                <Text style={[styles.langText, l === lang ? styles.langTextOn : null]}>{LANG_LABELS[l]}</Text>
              </Pressable>
            ))}
          </View>
          {onOpenSettings ? (
            <Pressable
              onPress={onOpenSettings}
              style={styles.settingsBtn}
              accessibilityRole="button"
              accessibilityLabel={t('setAria')}
              testID="btn-settings"
            >
              <AppIcon name="settings" size={20} color={colors.ink} />
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.title} accessibilityRole="header">
          Majoa Mahjong
        </Text>
        {top}
        {selectedIsland || selectedTris ? (
          <>
            <Pressable
              onPress={() => {
                setSelectedIslandId(null);
                setReason(null);
              }}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel={t('backToIslands')}
              testID="btn-back-islands"
            >
              <Text style={styles.backText}>‹ {t('backToIslands')}</Text>
            </Pressable>
            <Text style={styles.sectionTitle} accessibilityRole="header">{selectedName}</Text>
            <Text style={styles.hint}>{t('chooseLevel')}</Text>
            {toggle}
            <View style={styles.chips}>
              {PROFILES.map((p) => (
                <Pressable key={p} onPress={() => void updateSetting('defaultProfile', p)} style={[styles.chip, p === profile ? styles.chipOn : null]} accessibilityRole="button" accessibilityState={{ selected: p === profile }} testID={'profile-' + p}>
                  <Text style={[styles.chipText, p === profile ? styles.chipTextOn : null]}>{t(PROFILE_KEYS[p])}</Text>
                </Pressable>
              ))}
            </View>
            {reason ? (
              <View style={styles.reason} accessibilityRole="alert" accessibilityLiveRegion="polite" testID="level-reason">
                <AppIcon name="lock" size={16} color={colors.accent} />
                <Text style={styles.reasonText}>{reason.text}</Text>
              </View>
            ) : null}
            <FlatList
              key={'levels-' + selectedIslandId}
              testID="island-level-grid"
              data={selectedIsland ? campaignLevelsFor(selectedIsland) : selectedTris ? trisLevelIds.map(campaignLevelById).filter((level) => level !== undefined) : []}
              keyExtractor={(level) => String(level.id)}
              numColumns={5}
              initialNumToRender={selectedLevelIds.length}
              extraData={`${prova}|${progress.coins}|${JSON.stringify(progress.levels)}`}
              contentContainerStyle={styles.grid}
              columnWrapperStyle={styles.gridRow}
              renderItem={({ item }) => {
                const status = levelStatus(progress, islands, item.id, prova, t);
                const stars = levelProgress(progress, item.id).stars;
                const number = displayLevelNumber(islands, item.id);
                const tris = item.groupSize === 3;
                const trisLabel = tris ? ` (${t('trisLabel')})` : '';
                const label = status.open
                  ? `${t('level', { n: number })}${trisLabel}, ${t('starsOfThree', { n: stars })}`
                  : `${t('level', { n: number })}${trisLabel}, ${t('lockedLv').toLowerCase()}. ${status.reason}`;
                return (
                  <Pressable
                    style={({ pressed }) => [styles.level, tris ? styles.levelTris : null, status.open ? null : styles.levelLocked, pressed ? styles.levelPressed : null]}
                    onPress={() => (status.open ? onPlay(item.id, profile) : setReason({ text: status.reason }))}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    testID={'level-' + item.id}
                  >
                    <View style={styles.levelNumber}>
                      {status.open ? null : <AppIcon name="lock" size={13} color="rgba(255,255,255,0.75)" />}
                      <Text style={[styles.levelText, status.open ? null : styles.levelTextLocked]}>{number}</Text>
                    </View>
                    {status.open ? <Text style={styles.stars}>{starsText(stars)}</Text> : null}
                  </Pressable>
                );
              }}
            />
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle} accessibilityRole="header">{t('islandMap')}</Text>
            {toggle}
            <FlatList
              testID="island-map-list"
              data={mapRows}
              keyExtractor={(row) => row.island.id}
              contentContainerStyle={styles.islandList}
              renderItem={({ item }) => {
                const stars = islandStars(progress, item.island);
                const maxStars = item.island.levelIds.length * 3;
                const name = islandName(item.island.id, t);
                const label = [t('islandLabel', { n: item.index + 1 }), name, t('islandProgress', { stars, max: maxStars }), item.reason].filter(Boolean).join('. ');
                return (
                  <Pressable
                    onPress={() => item.open && setSelectedIslandId(item.island.id)}
                    disabled={!item.open}
                    style={({ pressed }) => [styles.islandCard, item.open ? null : styles.islandCardLocked, pressed ? styles.islandPressed : null]}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityState={{ disabled: !item.open }}
                    testID={'island-' + item.island.id}
                  >
                    <View style={styles.islandCardTop}>
                      <View style={styles.islandMain}>
                        <Text style={styles.islandNumber}>{t('islandLabel', { n: item.index + 1 })}</Text>
                        <Text style={styles.islandName}>{name}</Text>
                        <Text style={styles.islandProgress}>{t('islandProgress', { stars, max: maxStars })}</Text>
                      </View>
                      {item.open ? <Text style={styles.chevron}>›</Text> : <AppIcon name="lock" size={22} color={colors.inkSoft} />}
                    </View>
                    {item.reason ? <Text style={styles.islandReason}>{item.reason}</Text> : null}
                  </Pressable>
                );
              }}
              ListFooterComponent={prova && trisLevelIds.length > 0 ? (
                <Pressable
                  onPress={() => setSelectedIslandId('tris')}
                  style={({ pressed }) => [styles.islandCard, styles.trisCard, pressed ? styles.islandPressed : null]}
                  accessibilityRole="button"
                  accessibilityLabel={t('trisLabel')}
                  testID="island-tris"
                >
                  <View style={styles.islandCardTop}>
                    <View style={styles.islandMain}>
                      <Text style={styles.islandNumber}>{t('testModeShort')}</Text>
                      <Text style={styles.islandName}>{t('trisLabel')}</Text>
                      <Text style={styles.islandProgress}>{t('islandProgress', { stars: trisStars, max: trisLevelIds.length * 3 })}</Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </View>
                </Pressable>
              ) : null}
            />
          </>
        )}
      </View>
    </FeltBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginBottom: 4, position: 'relative' },
  settingsBtn: { position: 'absolute', right: 16, width: 48, height: 48, borderRadius: 24, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' },
  langRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  langChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, backgroundColor: colors.panel, minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'center' },
  langChipOn: { backgroundColor: colors.feltA, borderWidth: 1.5, borderColor: colors.accent },
  langText: { fontSize: 13, color: colors.inkSoft, fontFamily: fontFamilies.bodyBold },
  langTextOn: { color: colors.ink },
  title: { fontSize: 30, color: colors.accent, textAlign: 'center', fontFamily: fontFamilies.title, letterSpacing: 0.5 },
  sectionTitle: { fontSize: 24, color: colors.ink, textAlign: 'center', marginTop: 6, fontFamily: fontFamilies.title },
  hint: { fontSize: 14, color: colors.inkSoft, textAlign: 'center', marginTop: 2, marginBottom: 8, fontFamily: fontFamilies.body },
  backButton: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 16 },
  backText: { color: colors.ink, fontSize: 15, fontFamily: fontFamilies.bodyBold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, paddingHorizontal: 12, marginBottom: 8 },
  chip: { minHeight: 48, paddingHorizontal: 16, borderRadius: 24, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.feltA, borderWidth: 1.5, borderColor: colors.accent },
  chipText: { fontSize: 14, color: colors.inkSoft, fontFamily: fontFamilies.bodyBold },
  chipTextOn: { color: colors.ink },
  prova: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, marginBottom: 4 },
  provaText: { flex: 1, fontSize: 14, color: colors.ink, fontFamily: fontFamilies.body },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 12, marginBottom: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.panelHeavy },
  reasonText: { flex: 1, color: colors.ink, fontSize: 14, textAlign: 'left', fontFamily: fontFamilies.bodyBold },
  grid: { paddingHorizontal: 12, paddingBottom: 16, gap: 8 },
  gridRow: { gap: 8 },
  level: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#f6edd2' },
  levelTris: { backgroundColor: '#ffe9cb' },
  levelLocked: { backgroundColor: 'rgba(0,0,0,0.4)' },
  levelPressed: { opacity: 0.8 },
  levelNumber: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  levelText: { fontSize: 16, color: colors.edge2, fontFamily: fontFamilies.title },
  levelTextLocked: { color: 'rgba(255,255,255,0.8)' },
  stars: { fontSize: 11, color: '#c48900', marginTop: 2, fontFamily: fontFamilies.title },
  islandList: { paddingHorizontal: 12, paddingBottom: 20, gap: 10 },
  islandCard: { minHeight: 88, gap: 6, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, backgroundColor: colors.panel, borderWidth: 1.5, borderColor: colors.edge2 },
  islandCardTop: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12 },
  islandCardLocked: { backgroundColor: colors.panelHeavy, borderColor: colors.edge, opacity: 0.95 },
  trisCard: { marginTop: 8, borderColor: colors.accent },
  islandPressed: { opacity: 0.78 },
  islandMain: { flex: 1, gap: 2 },
  islandNumber: { color: colors.accent, fontSize: 12, fontFamily: fontFamilies.bodyBold },
  islandName: { color: colors.ink, fontSize: 20, fontFamily: fontFamilies.title },
  islandProgress: { color: colors.inkSoft, fontSize: 14, fontFamily: fontFamilies.bodyBold },
  islandReason: { color: colors.ink, fontSize: 13, fontFamily: fontFamilies.body },
  chevron: { color: colors.accent, fontSize: 30, fontWeight: '300', paddingLeft: 8 },
});
