import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { planStart, type Home, type ResumeInfo } from '../application/saveFlow';
import type { SaveStore } from '../application/saveStore';
import type { Profile } from '../domain/profile';
import { isIntroDismissed, withIntroDismissed, type IntroId } from '../domain/settings';
import type { IslandInfo } from '../domain/progress';
import { campaignIslandsForProgress, campaignLevelById } from '../infrastructure/content/campaignLevels';
import { locale, useTranslation } from '../infrastructure/i18n';
import { Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';
import { displayLevelNumber, formatTime, PROFILE_KEYS } from './format';
import { IntroDialog } from './IntroDialog';
import { introFor, introText } from './intros';
import { LevelPicker } from './LevelPicker';
import { useSettings } from './SettingsProvider';
import { loadTileSvgs } from './svgs';
import { colors } from './theme/colors';
import { fontFamilies } from './theme/typography';

export type HomeScreenProps = {
  home: Home;
  store: SaveStore;
  /** Avvia una partita nuova. */
  onPlay: (levelId: number, profile: Profile) => void;
  /** Riprende la partita salvata. */
  onResume: () => void;
  /** Rilegge progressi e partita dall'archivio. */
  onReload: () => Promise<void>;
  islands?: readonly IslandInfo[];
  /** Apre la schermata delle impostazioni. */
};

/**
 * Home: la scheda «Continua» con la partita salvata, il selettore dei livelli con i progressi, la conferma prima di
 * sostituire la partita salvata e gli errori di lettura (`docs/salvataggi.md`, «Scelte per la UI»).
 */
export function HomeScreen({ home, store, onPlay, onResume, onReload, islands: suppliedIslands }: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { t, lang } = useTranslation();
  const { settings, updateSetting } = useSettings();
  const [pending, setPending] = useState<{ levelId: number; profile: Profile } | null>(null);
  const [intro, setIntro] = useState<{ levelId: number; profile: Profile; id: IntroId } | null>(null);
  const [resetting, setResetting] = useState(false);
  const [busy, setBusy] = useState(false);
  const { resume } = home;
  const plan = planStart(resume);
  const islands = suppliedIslands ?? (home.progress.ok ? campaignIslandsForProgress(home.progress.value) : []);

  // Precarica i 129 SVG in background appena la home è visibile: quando l'utente
  // entra in partita i disegni sono già pronti e il "Caricamento dei disegni" non appare.
  useEffect(() => { void loadTileSvgs(); }, []);

  // Le operazioni che toccano l'archivio disattivano i pulsanti finché non finiscono.
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
    } finally {
      setBusy(false);
    }
  };

  // Con una partita salvata si chiede prima di sostituirla; senza, si parte
  const start = (levelId: number, profile: Profile) => (plan.kind === 'confirm' ? setPending({ levelId, profile }) : onPlay(levelId, profile));
  // Prima di un livello di un tipo con la sua spiegazione (il Tris) compare la finestra, finché non si mette la spunta «Non mostrare più».
  // Viene per prima: chiuderla non cambia nulla, mentre sostituire la partita salvata è la scelta che costa.
  const pick = (levelId: number, profile: Profile) => {
    const level = campaignLevelById(levelId);
    const id = level ? introFor(level) : null;
    if (id && !isIntroDismissed(settings, id)) setIntro({ levelId, profile, id });
    else start(levelId, profile);
  };

  // «Ricomincia»: scarta la partita illeggibile e riavvia lo stesso livello e profilo se si leggono ancora e il livello esiste;
  // altrimenti resta nella home.
  const restart = () =>
    run(async () => {
      await store.clearGame();
      const saved = resume.kind === 'broken' ? resume.saved : null;
      if (saved && campaignLevelById(saved.levelId)) onPlay(saved.levelId, saved.profile);
      else await onReload();
    });

  const resetDialog = resetting ? (
    <ConfirmDialog
      title={t('resetAllTitle')}
      body={t('resetAllBody')}
      onDismiss={() => setResetting(false)}
      testID="reset-dialog"
      actions={[
        { label: t('cancel'), primary: true, disabled: busy, onPress: () => setResetting(false), testID: 'btn-reset-cancel' },
        {
          label: t('clearAll'),
          disabled: busy,
          testID: 'btn-reset-confirm',
          onPress: () =>
            run(async () => {
              await store.resetAll();
              setResetting(false);
              await onReload();
            }),
        },
      ]}
    />
  ) : null;

  if (!home.progress.ok) {
    return (
      <View style={[styles.errorRoot, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]} testID="progress-error">
        <Text style={styles.errorTitle} accessibilityRole="header">
          {t('progressReadErrorTitle')}
        </Text>
        <Text style={styles.errorText}>{t('progressReadErrorBody')}</Text>
        <View style={styles.errorActions}>
          <Button label={t('retry')} kind="primary" disabled={busy} onPress={() => run(onReload)} testID="btn-progress-retry" />
          <Button label={t('startOver')} disabled={busy} onPress={() => setResetting(true)} testID="btn-progress-reset" />
        </View>
        {resetDialog}
      </View>
    );
  }

  const top =
    resume.kind === 'ready' ? (
      <ContinueCard info={resume.info} islands={islands} onPress={onResume} />
    ) : resume.kind === 'broken' ? (
      <View style={styles.notice} testID="broken-notice">
        <Text style={styles.noticeText} accessibilityRole="alert">
          {t('savedGameReadError')}
        </Text>
        <Button label={t('deadRestart')} kind="primary" disabled={busy} onPress={restart} testID="btn-restart-saved" />
      </View>
    ) : null;

  return (
    <View style={styles.root}>
      <LevelPicker progress={home.progress.value} islands={islands} onPlay={pick} top={top} />
      {pending && plan.kind === 'confirm' ? (
        <ConfirmDialog
          title={t('replaceGameTitle')}
          body={t('replaceGameBody', {
            level: displayLevelNumber(islands, plan.info.levelId),
            profile: t(PROFILE_KEYS[plan.info.profile]),
            time: formatTime(plan.info.seconds),
          })}
          onDismiss={() => setPending(null)}
          testID="replace-dialog"
          actions={[
            {
              label: t('continueSavedGame'),
              primary: true,
              disabled: busy,
              testID: 'btn-keep',
              onPress: () => {
                setPending(null);
                onResume();
              },
            },
            {
              label: t('replaceSavedGame'),
              disabled: busy,
              testID: 'btn-replace',
              onPress: () =>
                run(async () => {
                  await store.clearGame();
                  setPending(null);
                  onPlay(pending.levelId, pending.profile);
                }),
            },
          ]}
        />
      ) : null}
      {intro && introText(intro.id, locale(lang).intro) ? (
        <IntroDialog
          entry={introText(intro.id, locale(lang).intro)!}
          onDismiss={() => setIntro(null)}
          onPlay={(dontShowAgain) => {
            if (dontShowAgain) void updateSetting('introsDismissed', withIntroDismissed(settings.introsDismissed, intro.id));
            setIntro(null);
            start(intro.levelId, intro.profile);
          }}
        />
      ) : null}
      {resetDialog}
    </View>
  );
}

function ContinueCard({ info, islands, onPress }: { info: ResumeInfo; islands: readonly IslandInfo[]; onPress: () => void }) {
  const { t } = useTranslation();
  const profile = t(PROFILE_KEYS[info.profile]);
  const time = formatTime(info.seconds);
  const level = displayLevelNumber(islands, info.levelId);
  const remaining = t('resumeTiles', { n: info.remaining });
  const detail = `${profile} · ${time} · ${remaining}`;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
      accessibilityRole="button"
      accessibilityLabel={t('resumeAria', { level, profile, time, tiles: remaining })}
      testID="continue-card"
    >
      <View style={styles.cardTexts}>
        <Text style={styles.kicker}>{t('continueShort')}</Text>
        <Text style={styles.cardTitle}>{t('level', { n: level })}</Text>
        <Text style={styles.cardDetail}>{detail}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.feltB },
  card: { minHeight: 72, flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginTop: 12, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, backgroundColor: colors.panel, borderWidth: 2, borderColor: colors.accent },
  cardPressed: { opacity: 0.8 },
  cardTexts: { flex: 1 },
  kicker: { color: colors.accent, fontSize: 12, textTransform: 'uppercase', fontFamily: fontFamilies.bodyBold, letterSpacing: 0.5 },
  cardTitle: { color: colors.ink, fontSize: 22, fontFamily: fontFamilies.title },
  cardDetail: { color: colors.inkSoft, fontSize: 15, fontFamily: fontFamilies.body },
  chevron: { color: colors.accent, fontSize: 32, fontWeight: '300', paddingLeft: 12 },
  notice: { marginHorizontal: 12, marginTop: 12, padding: 16, borderRadius: 16, backgroundColor: colors.panelHeavy, gap: 12 },
  noticeText: { color: colors.ink, fontSize: 16, fontFamily: fontFamilies.bodyBold },
  errorRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 24, backgroundColor: colors.feltB },
  errorTitle: { color: colors.accent, fontSize: 22, textAlign: 'center', fontFamily: fontFamilies.title },
  errorText: { color: colors.inkSoft, fontSize: 16, textAlign: 'center', fontFamily: fontFamilies.body },
  errorActions: { alignSelf: 'stretch', gap: 12, marginTop: 8 },
});
