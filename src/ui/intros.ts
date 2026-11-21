import type { IntroId } from '../domain/settings';
import type { LegacyLevel } from '../infrastructure/content/legacyLevels';
import type { IntroEntry } from '../infrastructure/i18n/types';

// Spiegazioni prima di un tipo di livello. Una per meccanica, non per numero di livello: i numeri cambiano, la meccanica no.

/** La spiegazione da mostrare prima di giocare questo livello, se ne ha una. Per ora solo il Tris. */
export function introFor(level: Pick<LegacyLevel, 'groupSize'>): IntroId | null {
  return level.groupSize === 3 ? 'tris' : null;
}

/** I testi dell'originale stanno sotto il numero del primo livello che li mostrava: per il Tris, il 91. */
const TEXT_KEY: Record<IntroId, number> = { tris: 91 };

export function introText(id: IntroId, intro: Partial<Record<number, IntroEntry>>): IntroEntry | undefined {
  return intro[TEXT_KEY[id]];
}
