import type { Feedback } from '../application/session';

const AID_NAMES = { hints: 'Aiuto', shuffles: 'Mischia', undo: 'Annulla' } as const;

/** Avviso da mostrare per un feedback della sessione, o `null` se basta il segnale visivo. Testi provvisori: le lingue sono da fare. */
export function messageFor(feedback: Feedback): string | null {
  switch (feedback.kind) {
    case 'rejected':
      if (feedback.reason === 'locked') return 'Tessera nascosta: abbina prima le stelle';
      if (feedback.reason === 'tile-blocked') return 'Tessera bloccata';
      return null;
    case 'no-aid-left':
      return `${AID_NAMES[feedback.aid]}: nessun uso rimasto`;
    case 'nothing-to-undo':
      return feedback.afterShuffle ? 'Dopo un rimescolo non si può annullare' : 'Niente da annullare';
    case 'rescued':
      return 'Nessuna mossa: tessere rimescolate';
    case 'advice':
      return feedback.use === 'shuffle' ? 'Nessuna mossa: usa Mischia' : 'Nessuna mossa: prova Annulla';
    case 'shuffled':
      return 'Tessere rimescolate';
    case 'shuffle-failed':
      return 'Impossibile rimescolare';
    case 'dead':
      return 'Bloccato!';
    default:
      return null;
  }
}
