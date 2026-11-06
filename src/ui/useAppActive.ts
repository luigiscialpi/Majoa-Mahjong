import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

const isActive = (state: AppStateStatus): boolean => state !== 'background' && state !== 'inactive';

/** `true` finché l'app è in primo piano. Il tempo di gioco corre solo allora e la partita si salva quando smette di esserlo. */
export function useAppActive(): boolean {
  const [active, setActive] = useState(() => isActive(AppState.currentState));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setActive(isActive(state)));
    return () => subscription.remove();
  }, []);
  return active;
}
