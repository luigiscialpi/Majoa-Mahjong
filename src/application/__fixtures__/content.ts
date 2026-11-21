import type { ContentSignatures } from '../../domain/progress';

/** Una firma di livello qualunque per i test che non si occupano di firme. */
export const SIG = '0123456789abcdef';

/** Contenuti in cui ogni livello ha sempre la stessa firma (e l'aveva prima): nessun record viene scartato. */
export const sameContent: ContentSignatures = { current: () => SIG, base: () => SIG };
