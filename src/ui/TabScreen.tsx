import type { ReactNode } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

/**
 * Contenuto di una scheda della barra in basso. La barra si prende da sola il margine di sicurezza inferiore (gesti di
 * sistema): le schermate che stanno dentro non lo aggiungono, o resterebbe uno spazio vuoto sopra la barra.
 */
export function TabScreen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaInsetsContext.Consumer>
      {(insets) => <SafeAreaInsetsContext.Provider value={insets && { ...insets, bottom: 0 }}>{children}</SafeAreaInsetsContext.Provider>}
    </SafeAreaInsetsContext.Consumer>
  );
}
