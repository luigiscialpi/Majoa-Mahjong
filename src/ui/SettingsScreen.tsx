import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MASCOT_IDS, type Mascot } from '../domain/mascot';
import { BG_PALETTES, TILE_PALETTES, type BgPalette, type TilePalette } from '../domain/settings';
import { BG_PALETTE_COLORS, TILE_PALETTE_COLORS } from '../infrastructure/content/appearancePalettes';
import { getSoundService } from '../infrastructure/audio/soundService';
import { useTranslation, type Language } from '../infrastructure/i18n';
import { Button } from './Button';
import { FeltBackground } from './FeltBackground';
import { MascotMedallion, MEDALLION_COLOR } from './MascotMedallion';
import { useMascotUri } from './mascots';
import { useSettings } from './SettingsProvider';
import { colors } from './theme/colors';
import { fontFamilies } from './theme/typography';

const VOLUME_STEPS = [0, 25, 50, 75, 100] as const;
const LANG_OPTIONS: readonly { id: Language; label: string }[] = [
  { id: 'fr', label: '🇫🇷 FR' },
  { id: 'en', label: '🇬🇧 EN' },
  { id: 'it', label: '🇮🇹 IT' },
];

export type SettingsScreenProps = {
  onBack: () => void;
};

/**
 * Schermata Impostazioni dell'app:
 * Fedele all'originale HTML (righe 3416-3496: buildSettings).
 * Include: Mascotte (76 px), Suoni e vibrazione, Aiuti di gioco, Comfort e accessibilità, Lingua, Ripristino.
 */
export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const { t, lang, setLang } = useTranslation();
  const { settings, updateSetting, resetSettings } = useSettings();
  const soundService = getSoundService();

  const handleSelectMascot = useCallback(
    (m: Mascot) => {
      void updateSetting('mascot', m);
      soundService.play('select');
    },
    [updateSetting, soundService],
  );

  const handleToggleSound = useCallback(
    (v: boolean) => {
      void updateSetting('sound', v);
      if (v) soundService.play('select');
    },
    [updateSetting, soundService],
  );

  const handleSelectVolume = useCallback(
    (vol: number) => {
      void updateSetting('volume', vol);
      soundService.playMatch(1);
    },
    [updateSetting, soundService],
  );

  const handleToggleVib = useCallback(
    (v: boolean) => {
      void updateSetting('vibration', v);
      if (v) soundService.haptic('light');
    },
    [updateSetting, soundService],
  );

  const handleSelectLang = useCallback(
    (l: Language) => {
      setLang(l);
      soundService.play('select');
    },
    [setLang, soundService],
  );

  const handleReset = useCallback(() => {
    void resetSettings();
    soundService.play('select');
  }, [resetSettings, soundService]);

  const handleSelectBg = useCallback(
    (key: BgPalette) => {
      void updateSetting('bgPalette', key);
      soundService.play('select');
    },
    [updateSetting, soundService],
  );

  const handleSelectTile = useCallback(
    (key: TilePalette) => {
      void updateSetting('tilePalette', key);
      soundService.play('select');
    },
    [updateSetting, soundService],
  );

  const bgFeltA = settings.bgPalette !== 'level' ? BG_PALETTE_COLORS[settings.bgPalette].feltA : colors.feltA;
  const bgFeltB = settings.bgPalette !== 'level' ? BG_PALETTE_COLORS[settings.bgPalette].feltB : colors.feltB;

  return (
    <FeltBackground colorA={bgFeltA} colorB={bgFeltB} cyRatio={0.15} testID="settings-bg">
      <View style={[styles.root, { paddingTop: insets.top + 6, paddingBottom: insets.bottom }]}>
        {/* Intestazione */}
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('backToLevels')} testID="btn-settings-back">
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle} accessibilityRole="header">
            {t('setTitle')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* 1. Mascotte */}
          <View style={styles.group}>
            <Text style={styles.groupTitle}>{t('sgMascot')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mascotRow}>
              {(['collie', 'sheltie', 'siamshort', 'siamlong', 'none'] as const).map((id) => (
                <MascotItem
                  key={id}
                  id={id}
                  selected={settings.mascot === id}
                  onSelect={() => handleSelectMascot(id)}
                  name={t(`mc_${id}` as any)}
                />
              ))}
            </ScrollView>
          </View>

          {/* 2. Aspetto */}
          <View style={styles.group}>
            <Text style={styles.groupTitle}>{t('sgApp')}</Text>

            {/* Sfondo */}
            <View style={styles.swatchSection}>
              <Text style={styles.rowLabel}>{t('slBg')}</Text>
              <View style={styles.swatchesRow}>
                {BG_PALETTES.map((k) => {
                  const isSelected = settings.bgPalette === k;
                  const label = k === 'level' ? t('setLevelTheme') : t(`bg_${k}` as any);
                  const color = k === 'level' ? colors.feltA : BG_PALETTE_COLORS[k].feltA;
                  return (
                    <Pressable
                      key={k}
                      onPress={() => handleSelectBg(k)}
                      style={[
                        styles.swatch,
                        { backgroundColor: color },
                        isSelected ? styles.swatchOn : null,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      accessibilityState={{ selected: isSelected }}
                      testID={`bg-${k}`}
                    >
                      {k === 'level' ? <Text style={styles.swatchAutoText}>↺</Text> : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Bordo tessere */}
            <View style={styles.swatchSection}>
              <Text style={styles.rowLabel}>{t('slTile')}</Text>
              <View style={styles.swatchesRow}>
                {TILE_PALETTES.map((k) => {
                  const isSelected = settings.tilePalette === k;
                  const label = k === 'level' ? t('setLevelTheme') : t(`tile_${k}` as any);
                  const color = k === 'level' ? colors.edge : TILE_PALETTE_COLORS[k].edge;
                  return (
                    <Pressable
                      key={k}
                      onPress={() => handleSelectTile(k)}
                      style={[
                        styles.swatch,
                        { backgroundColor: color },
                        isSelected ? styles.swatchOn : null,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      accessibilityState={{ selected: isSelected }}
                      testID={`tile-${k}`}
                    >
                      {k === 'level' ? <Text style={styles.swatchAutoText}>↺</Text> : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* 3. Suoni e vibrazione */}
          <View style={styles.group}>
            <Text style={styles.groupTitle}>{t('sgSound')}</Text>
            <SettingSwitchRow
              label={t('setSound')}
              value={settings.sound}
              onValueChange={handleToggleSound}
              testID="switch-sound"
            />
            <View style={styles.volumeRow}>
              <Text style={styles.rowLabel}>{t('setVolume')}</Text>
              <View style={styles.volumeSteps}>
                {VOLUME_STEPS.map((vol) => (
                  <Pressable
                    key={vol}
                    onPress={() => handleSelectVolume(vol)}
                    style={[styles.volChip, settings.volume === vol ? styles.volChipOn : null]}
                    accessibilityRole="button"
                    accessibilityLabel={`${vol}%`}
                    accessibilityState={{ selected: settings.volume === vol }}
                    testID={`volume-${vol}`}
                  >
                    <Text style={[styles.volText, settings.volume === vol ? styles.volTextOn : null]}>
                      {vol}%
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <SettingSwitchRow
              label={t('setVib')}
              value={settings.vibration}
              onValueChange={handleToggleVib}
              testID="switch-vib"
            />
          </View>

          {/* 3. Aiuti di gioco */}
          <View style={styles.group}>
            <Text style={styles.groupTitle}>{t('sgHelp')}</Text>
            <SettingSwitchRow
              label={t('setFx')}
              hint={t('setFxHint')}
              value={settings.effects}
              onValueChange={(v) => updateSetting('effects', v)}
              testID="switch-fx"
            />
            <SettingSwitchRow
              label={t('setEq')}
              hint={t('setEqHint')}
              value={settings.highlightEqual}
              onValueChange={(v) => updateSetting('highlightEqual', v)}
              testID="switch-eq"
            />
            <SettingSwitchRow
              label={t('setAuto')}
              hint={t('setAutoHint')}
              value={settings.autoHint}
              onValueChange={(v) => updateSetting('autoHint', v)}
              testID="switch-auto"
            />
          </View>

          {/* 4. Comfort e accessibilità */}
          <View style={styles.group}>
            <Text style={styles.groupTitle}>{t('sgComfort')}</Text>
            <SettingSwitchRow
              label={t('setCf')}
              hint={t('setCfHint')}
              value={settings.comfort}
              onValueChange={(v) => updateSetting('comfort', v)}
              testID="switch-cf"
            />
            <SettingSwitchRow
              label={t('setBigUi')}
              value={settings.bigUi}
              onValueChange={(v) => updateSetting('bigUi', v)}
              testID="switch-bigui"
            />
            <SettingSwitchRow
              label={t('setHc')}
              hint={t('setHcHint')}
              value={settings.highContrast}
              onValueChange={(v) => updateSetting('highContrast', v)}
              testID="switch-hc"
            />
            <SettingSwitchRow
              label={t('setCb')}
              hint={t('setCbHint')}
              value={settings.colorBlind}
              onValueChange={(v) => updateSetting('colorBlind', v)}
              testID="switch-cb"
            />
            <SettingSwitchRow
              label={t('setNoTime')}
              hint={t('setNoTimeHint')}
              value={settings.noTimeLimit}
              onValueChange={(v) => updateSetting('noTimeLimit', v)}
              testID="switch-notime"
            />
            <SettingSwitchRow
              label={t('setSelBar')}
              hint={t('setSelBarHint')}
              value={settings.selectedBar}
              onValueChange={(v) => updateSetting('selectedBar', v)}
              testID="switch-selbar"
            />
          </View>

          {/* 5. Lingua */}
          <View style={styles.group}>
            <Text style={styles.groupTitle}>{t('sgLang')}</Text>
            <View style={styles.langRow}>
              {LANG_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.id}
                  onPress={() => handleSelectLang(opt.id)}
                  style={[styles.langChip, lang === opt.id ? styles.langChipOn : null]}
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                  accessibilityState={{ selected: lang === opt.id }}
                  testID={`lang-btn-${opt.id}`}
                >
                  <Text style={[styles.langText, lang === opt.id ? styles.langTextOn : null]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* 6. Ripristino */}
          <View style={styles.resetContainer}>
            <Button
              label={t('setReset')}
              onPress={handleReset}
              testID="btn-reset-settings"
            />
          </View>
        </ScrollView>
      </View>
    </FeltBackground>
  );
}

function MascotItem({ id, selected, onSelect, name }: { id: Mascot; selected: boolean; onSelect: () => void; name: string }) {
  const uri = useMascotUri(id);

  return (
    <Pressable
      onPress={onSelect}
      style={[styles.mascotBtn, selected ? styles.mascotBtnOn : null]}
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityState={{ selected }}
      testID={`mascot-${id}`}
    >
      <View style={[styles.mascotCircle, selected ? styles.mascotCircleOn : null]}>
        {id === 'none' ? (
          <View style={styles.noneCircle}>
            <Text style={styles.noneText}>∅</Text>
          </View>
        ) : uri ? (
          <MascotMedallion uri={uri} size={76} />
        ) : (
          <View style={styles.noneCircle} />
        )}
      </View>
      <Text style={[styles.mascotName, selected ? styles.mascotNameOn : null]} numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
}

function SettingSwitchRow({
  label,
  hint,
  value,
  onValueChange,
  testID,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  testID?: string;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.labelCol}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: 'rgba(255,255,255,0.2)', true: colors.accent }}
        thumbColor={value ? colors.btn : '#f4f3f4'}
        accessibilityLabel={label}
        testID={testID}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  backText: {
    color: colors.ink,
    fontSize: 28,
    fontFamily: fontFamilies.bodyBold,
    lineHeight: 32,
    marginTop: -2,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.ink,
    fontSize: 24,
    fontFamily: fontFamilies.title,
  },
  headerSpacer: { width: 44 },
  scrollContent: {
    paddingHorizontal: 14,
    paddingBottom: 40,
    gap: 16,
  },
  group: {
    backgroundColor: colors.panel,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  groupTitle: {
    color: colors.accent,
    fontSize: 14,
    textTransform: 'uppercase',
    fontFamily: fontFamilies.bodyBold,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  mascotRow: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 4,
  },
  mascotBtn: {
    alignItems: 'center',
    width: 84,
    gap: 6,
  },
  mascotBtnOn: {
    opacity: 1,
  },
  mascotCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  mascotCircleOn: {
    borderColor: colors.accent,
  },
  noneCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: MEDALLION_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noneText: {
    fontSize: 32,
    color: '#8b7355',
    fontFamily: fontFamilies.title,
  },
  mascotName: {
    color: colors.inkSoft,
    fontSize: 12,
    fontFamily: fontFamilies.body,
    textAlign: 'center',
  },
  mascotNameOn: {
    color: colors.ink,
    fontFamily: fontFamilies.bodyBold,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 12,
  },
  labelCol: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    color: colors.ink,
    fontSize: 16,
    fontFamily: fontFamilies.bodyBold,
  },
  rowHint: {
    color: colors.inkSoft,
    fontSize: 13,
    fontFamily: fontFamilies.body,
    lineHeight: 18,
  },
  volumeRow: {
    paddingVertical: 6,
    gap: 8,
  },
  volumeSteps: {
    flexDirection: 'row',
    gap: 8,
  },
  volChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  volChipOn: {
    backgroundColor: colors.accent,
  },
  volText: {
    color: colors.inkSoft,
    fontSize: 13,
    fontFamily: fontFamilies.bodyBold,
  },
  volTextOn: {
    color: colors.btnInk,
  },
  langRow: {
    flexDirection: 'row',
    gap: 10,
  },
  langChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langChipOn: {
    backgroundColor: colors.accent,
  },
  langText: {
    color: colors.inkSoft,
    fontSize: 14,
    fontFamily: fontFamilies.bodyBold,
  },
  langTextOn: {
    color: colors.btnInk,
  },
  resetContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  swatchSection: {
    gap: 8,
    paddingVertical: 4,
  },
  swatchesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  swatchOn: {
    borderColor: '#ffffff',
    transform: [{ scale: 1.08 }],
  },
  swatchAutoText: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: fontFamilies.title,
    lineHeight: 22,
  },
});
