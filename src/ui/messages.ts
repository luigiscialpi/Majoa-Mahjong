import { t } from '../infrastructure/i18n';
import type { Feedback } from '../application/session';

/** Avvisi da mostrare per un feedback della sessione, o `null` se basta il segnale visivo. */
export function messageFor(feedback: Feedback): string | null {
  switch (feedback.kind) {
    case 'rejected':
      if (feedback.reason === 'locked') return t('tLockedTile');
      if (feedback.reason === 'tile-blocked') return t('tBlockedTile');
      return null;
    case 'no-aid-left':
      if (feedback.aid === 'hints') return t('tNoHints');
      if (feedback.aid === 'undo') return t('tNoUndo');
      return t('tNoShuf');
    case 'nothing-to-undo':
      return feedback.afterShuffle ? t('tNoUndoShuffle') : t('tNoUndoHist');
    case 'rescued':
      return t('tRescue');
    case 'advice':
      return feedback.use === 'shuffle' ? t('tUseShuffle') : t('tUseUndo');
    case 'shuffled':
      return t('tShuffled');
    case 'shuffle-failed':
      return null;
    case 'dead':
      return t('deadTitle');
    default:
      return null;
  }
}
