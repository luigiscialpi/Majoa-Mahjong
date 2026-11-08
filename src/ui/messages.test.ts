import type { Feedback } from '../application/session';
import { messageFor } from './messages';
import { setActiveLanguage, t } from '../infrastructure/i18n';

describe('messageFor', () => {
  beforeEach(() => setActiveLanguage('it'));
  afterEach(() => setActiveLanguage('it'));

  test('gli avvisi dei feedback che ne hanno uno in italiano', () => {
    const cases: [Feedback, string][] = [
      [{ kind: 'rejected', reason: 'locked' }, t('tLockedTile')],
      [{ kind: 'rejected', reason: 'tile-blocked' }, t('tBlockedTile')],
      [{ kind: 'no-aid-left', aid: 'hints' }, t('tNoHints')],
      [{ kind: 'no-aid-left', aid: 'shuffles' }, t('tNoShuf')],
      [{ kind: 'no-aid-left', aid: 'undo' }, t('tNoUndo')],
      [{ kind: 'nothing-to-undo', afterShuffle: false }, t('tNoUndoHist')],
      [{ kind: 'nothing-to-undo', afterShuffle: true }, t('tNoUndoShuffle')],
      [{ kind: 'rescued' }, t('tRescue')],
      [{ kind: 'advice', use: 'shuffle' }, t('tUseShuffle')],
      [{ kind: 'advice', use: 'undo' }, t('tUseUndo')],
      [{ kind: 'shuffled' }, t('tShuffled')],
      [{ kind: 'dead' }, t('deadTitle')],
    ];
    for (const [feedback, text] of cases) {
      expect({ feedback, text: messageFor(feedback) }).toEqual({ feedback, text });
    }
  });

  test('cambia lingua istantaneamente con setActiveLanguage', () => {
    setActiveLanguage('en');
    expect(messageFor({ kind: 'rescued' })).toBe(t('tRescue'));
    expect(messageFor({ kind: 'rescued' })).toContain('No moves left');

    setActiveLanguage('fr');
    expect(messageFor({ kind: 'rescued' })).toBe(t('tRescue'));
    expect(messageFor({ kind: 'rescued' })).toContain('Plus de coups');
  });

  test('nessun avviso per i feedback che si vedono già: selezione, abbinamento, suggerimento, shuffle-failed', () => {
    const quiet: Feedback[] = [
      { kind: 'ignored' },
      { kind: 'selected' },
      { kind: 'deselected' },
      { kind: 'mismatch' },
      { kind: 'matched', group: [0, 1], unlocked: false, gold: 0 },
      { kind: 'hint', group: [0, 1] },
      { kind: 'undone' },
      { kind: 'rejected', reason: 'not-matching' },
      { kind: 'shuffle-failed' },
    ];
    for (const feedback of quiet) {
      expect({ feedback, text: messageFor(feedback) }).toEqual({ feedback, text: null });
    }
  });
});
