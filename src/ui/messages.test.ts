import type { Feedback } from '../application/session';
import { messageFor } from './messages';

test('gli avvisi dei feedback che ne hanno uno', () => {
  const cases: [Feedback, string][] = [
    [{ kind: 'rejected', reason: 'locked' }, 'Tessera nascosta: abbina prima le stelle'],
    [{ kind: 'rejected', reason: 'tile-blocked' }, 'Tessera bloccata'],
    [{ kind: 'no-aid-left', aid: 'hints' }, 'Aiuto: nessun uso rimasto'],
    [{ kind: 'no-aid-left', aid: 'shuffles' }, 'Mischia: nessun uso rimasto'],
    [{ kind: 'no-aid-left', aid: 'undo' }, 'Annulla: nessun uso rimasto'],
    [{ kind: 'nothing-to-undo', afterShuffle: false }, 'Niente da annullare'],
    [{ kind: 'nothing-to-undo', afterShuffle: true }, 'Dopo un rimescolo non si può annullare'],
    [{ kind: 'rescued' }, 'Nessuna mossa: tessere rimescolate'],
    [{ kind: 'advice', use: 'shuffle' }, 'Nessuna mossa: usa Mischia'],
    [{ kind: 'advice', use: 'undo' }, 'Nessuna mossa: prova Annulla'],
    [{ kind: 'shuffled' }, 'Tessere rimescolate'],
    [{ kind: 'shuffle-failed' }, 'Impossibile rimescolare'],
    [{ kind: 'dead' }, 'Bloccato!'],
  ];
  for (const [feedback, text] of cases) expect({ feedback, text: messageFor(feedback) }).toEqual({ feedback, text });
});

test('nessun avviso per i feedback che si vedono già: selezione, abbinamento, suggerimento', () => {
  const quiet: Feedback[] = [{ kind: 'ignored' }, { kind: 'selected' }, { kind: 'deselected' }, { kind: 'mismatch' }, { kind: 'matched', group: [0, 1], unlocked: false, gold: 0 }, { kind: 'hint', group: [0, 1] }, { kind: 'undone' }, { kind: 'rejected', reason: 'not-matching' }];
  for (const feedback of quiet) expect({ feedback, text: messageFor(feedback) }).toEqual({ feedback, text: null });
});
