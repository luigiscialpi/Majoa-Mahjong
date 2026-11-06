import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { planStart, type Home, type ResumeInfo } from '../application/saveFlow';
import type { SaveStore } from '../application/saveStore';
import type { Profile } from '../domain/profile';
import type { IslandInfo } from '../domain/progress';
import { legacyIslands } from '../infrastructure/content/legacyIslands';
import { legacyLevels } from '../infrastructure/content/legacyLevels';
import { Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';
import { PROFILE_NAMES, formatTime } from './format';
import { LevelPicker } from './LevelPicker';

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
};

// Le tessere si tolgono a coppie o a terne: ne resta sempre più di una.
const tiles = (n: number) => `${n} tessere`;

/**
 * Home: la scheda «Continua» con la partita salvata, il selettore dei livelli con i progressi, la conferma prima di
 * sostituire la partita salvata e gli errori di lettura (`docs/salvataggi.md`, «Scelte per la UI»).
 */
export function HomeScreen({ home, store, onPlay, onResume, onReload, islands = legacyIslands }: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const [pending, setPending] = useState<{ levelId: number; profile: Profile } | null>(null);
  const [resetting, setResetting] = useState(false);
  const [busy, setBusy] = useState(false);
  const { resume } = home;
  const plan = planStart(resume);

  // Le operazioni che toccano l'archivio disattivano i pulsanti finché non finiscono.
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
    } finally {
      setBusy(false);
    }
  };

  const pick = (levelId: number, profile: Profile) => (plan.kind === 'confirm' ? setPending({ levelId, profile }) : onPlay(levelId, profile));

  // «Ricomincia»: scarta la partita illeggibile e riavvia lo stesso livello e profilo se si leggono ancora e il livello esiste;
  // altrimenti resta nella home.
  const restart = () =>
    run(async () => {
      await store.clearGame();
      const saved = resume.kind === 'broken' ? resume.saved : null;
      if (saved && legacyLevels.some((l) => l.id === saved.levelId)) onPlay(saved.levelId, saved.profile);
      else await onReload();
    });

  const resetDialog = resetting ? (
    <ConfirmDialog
      title="Cancellare tutto?"
      body="Perderai stelle, record e ✨."
      onDismiss={() => setResetting(false)}
      testID="reset-dialog"
      actions={[
        { label: 'Annulla', primary: true, disabled: busy, onPress: () => setResetting(false), testID: 'btn-reset-cancel' },
        {
          label: 'Cancella tutto',
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
          Non riesco a leggere i tuoi progressi
        </Text>
        <Text style={styles.errorText}>Puoi riprovare oppure ripartire da zero.</Text>
        <View style={styles.errorActions}>
          <Button label="Riprova" kind="primary" disabled={busy} onPress={() => run(onReload)} testID="btn-progress-retry" />
          <Button label="Riparti da zero" disabled={busy} onPress={() => setResetting(true)} testID="btn-progress-reset" />
        </View>
        {resetDialog}
      </View>
    );
  }

  const top =
    resume.kind === 'ready' ? (
      <ContinueCard info={resume.info} onPress={onResume} />
    ) : resume.kind === 'broken' ? (
      <View style={styles.notice} testID="broken-notice">
        <Text style={styles.noticeText} accessibilityRole="alert">
          Non riesco a riprendere la partita salvata
        </Text>
        <Button label="Ricomincia" kind="primary" disabled={busy} onPress={restart} testID="btn-restart-saved" />
      </View>
    ) : null;

  return (
    <View style={styles.root}>
      <LevelPicker progress={home.progress.value} islands={islands} onPlay={pick} top={top} />
      {pending && plan.kind === 'confirm' ? (
        <ConfirmDialog
          title="Hai una partita in corso"
          body={`La partita del livello ${plan.info.levelId} (${PROFILE_NAMES[plan.info.profile]}, ${formatTime(plan.info.seconds)}) andrà persa.`}
          onDismiss={() => setPending(null)}
          testID="replace-dialog"
          actions={[
            {
              label: 'Continua quella',
              primary: true,
              disabled: busy,
              testID: 'btn-keep',
              onPress: () => {
                setPending(null);
                onResume();
              },
            },
            {
              label: 'Sostituisci',
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
      {resetDialog}
    </View>
  );
}

function ContinueCard({ info, onPress }: { info: ResumeInfo; onPress: () => void }) {
  const detail = `${PROFILE_NAMES[info.profile]} · ${formatTime(info.seconds)} · ${tiles(info.remaining)}`;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
      accessibilityRole="button"
      accessibilityLabel={`Continua: livello ${info.levelId}, ${PROFILE_NAMES[info.profile]}, ${formatTime(info.seconds)}, ${tiles(info.remaining)}`}
      testID="continue-card"
    >
      <View style={styles.cardTexts}>
        <Text style={styles.kicker}>Continua</Text>
        <Text style={styles.cardTitle}>Livello {info.levelId}</Text>
        <Text style={styles.cardDetail}>{detail}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  card: { minHeight: 72, flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginTop: 12, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, backgroundColor: '#1f6b57' },
  cardPressed: { opacity: 0.8 },
  cardTexts: { flex: 1 },
  kicker: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  cardTitle: { color: '#ffffff', fontSize: 22, fontWeight: '800' },
  cardDetail: { color: '#ffffff', fontSize: 15 },
  chevron: { color: '#ffffff', fontSize: 32, fontWeight: '300', paddingLeft: 12 },
  notice: { marginHorizontal: 12, marginTop: 12, padding: 16, borderRadius: 16, backgroundColor: '#1c1426', gap: 12 },
  noticeText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  errorRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 24, backgroundColor: '#1c1426' },
  errorTitle: { color: '#ffffff', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  errorText: { color: 'rgba(255,255,255,0.88)', fontSize: 16, textAlign: 'center' },
  errorActions: { alignSelf: 'stretch', gap: 12, marginTop: 8 },
});
