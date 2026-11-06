import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { loadHome, type Home } from '../application/saveFlow';
import type { SaveStore } from '../application/saveStore';
import type { Progress } from '../domain/progress';
import { Button } from './Button';

/** Archivio e stato letto all'avvio (progressi e partita in corso), per le schermate. */
export type Saves = {
  store: SaveStore;
  home: Home;
  /** Rilegge dall'archivio progressi e partita in corso (per esempio quando si torna alla home). */
  reload: () => Promise<void>;
  /** Aggiorna i progressi in memoria dopo una vittoria. */
  setProgress: (progress: Progress) => void;
};

const SavesContext = createContext<Saves | null>(null);

export function useSaves(): Saves {
  const saves = useContext(SavesContext);
  if (!saves) throw new Error('useSaves fuori da SaveProvider');
  return saves;
}

type State = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; store: SaveStore; home: Home };

/**
 * Apre l'archivio e legge progressi e partita in corso prima di mostrare le schermate: durante il caricamento una
 * schermata d'attesa, se l'archivio non si apre un messaggio con «Riprova».
 */
export function SaveProvider({ open, children }: { open: () => Promise<SaveStore>; children: ReactNode }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const storeRef = useRef<SaveStore | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const store = storeRef.current ?? (await open());
        storeRef.current = store;
        const home = await loadHome(store);
        if (!cancelled) setState({ kind: 'ready', store, home });
      } catch {
        if (!cancelled) setState({ kind: 'failed' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, attempt]);

  const reload = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return;
    const home = await loadHome(store);
    setState((s) => (s.kind === 'ready' ? { ...s, home } : s));
  }, []);
  const setProgress = useCallback((progress: Progress) => setState((s) => (s.kind === 'ready' ? { ...s, home: { ...s.home, progress: { ok: true, value: progress } } } : s)), []);
  const value = useMemo(() => (state.kind === 'ready' ? { store: state.store, home: state.home, reload, setProgress } : null), [state, reload, setProgress]);

  if (state.kind === 'loading') {
    return (
      <View style={styles.center} testID="saves-loading">
        <ActivityIndicator size="large" color="#1f6b57" />
        <Text style={styles.text}>Carico i tuoi progressi…</Text>
      </View>
    );
  }
  if (state.kind === 'failed') {
    return (
      <View style={styles.center} testID="saves-failed">
        <Text style={styles.title}>Non riesco ad aprire i salvataggi</Text>
        <Text style={styles.text}>La partita e i progressi non sono stati toccati.</Text>
        <Button
          label="Riprova"
          kind="primary"
          onPress={() => {
            setState({ kind: 'loading' });
            setAttempt((a) => a + 1);
          }}
          testID="btn-retry-open"
        />
      </View>
    );
  }
  return <SavesContext.Provider value={value}>{children}</SavesContext.Provider>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, backgroundColor: '#1c1426' },
  title: { color: '#ffffff', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  text: { color: 'rgba(255,255,255,0.85)', fontSize: 16, textAlign: 'center' },
});
