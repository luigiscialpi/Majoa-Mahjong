import { useEffect, useRef } from 'react';
import { NO_COMBO, nextCombo } from '../application/combo';
import type { Feedback, Phase } from '../application/session';
import { getSoundService, type SoundService } from '../infrastructure/audio/soundService';

export type GameAudioInput = {
  feedback: Feedback | null;
  seq: number;
  phase: Phase;
  revealingCount?: number;
  soundEnabled?: boolean;
  hapticsEnabled?: boolean;
  service?: SoundService;
  now?: () => number;
};

/**
 * Hook che orchestra i suoni e il feedback aptico della partita (docs/gioco-originale.md, sezione 10).
 * Ascolta gli eventi della sessione (`feedback`, `seq`, `phase`, nebbia) e invoca il `SoundService`.
 */
export function useGameAudio({
  feedback,
  seq,
  phase,
  revealingCount = 0,
  soundEnabled = true,
  hapticsEnabled = true,
  service = getSoundService(),
  now = Date.now,
}: GameAudioInput) {
  const combo = useRef(NO_COMBO);
  const mounted = useRef(false);
  const prevPhase = useRef(phase);

  // Aggiorna le preferenze di suono e aptica
  useEffect(() => {
    service.setSoundEnabled(soundEnabled);
    service.setHapticsEnabled(hapticsEnabled);
  }, [service, soundEnabled, hapticsEnabled]);

  // Suono di avvio al montaggio della partita
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      service.play('start');
    }
  }, [service]);

  // Suoni guidati dal feedback delle azioni di gioco
  useEffect(() => {
    if (!feedback) return;

    switch (feedback.kind) {
      case 'selected':
        service.play('select');
        service.haptic('light');
        break;

      case 'deselected':
        service.play('select');
        break;

      case 'rejected':
        service.play('blocked');
        service.haptic('warning');
        break;

      case 'mismatch':
      case 'no-aid-left':
      case 'nothing-to-undo':
      case 'shuffle-failed':
        service.play('blocked');
        break;

      case 'matched': {
        combo.current = nextCombo(combo.current, now());
        service.playMatch(combo.current.count);
        service.haptic('light');
        if (feedback.gold > 0) service.play('gold');
        if (feedback.unlocked) service.play('unlock');
        break;
      }

      case 'hint':
        service.play('hint');
        service.haptic('light');
        break;

      case 'undone':
        service.play('undo');
        service.haptic('light');
        break;

      case 'shuffled':
        service.play('shuffle');
        service.haptic('medium');
        break;

      case 'rescued':
        service.play('stuck');
        service.play('shuffle');
        break;

      case 'dead':
        service.play('stuck');
        service.haptic('error');
        break;
    }
  }, [seq]); // eslint-disable-line react-hooks/exhaustive-deps -- si esegue solo al cambio dell'azione

  // Suono quando si dirada la nebbia
  useEffect(() => {
    if (revealingCount > 0) {
      service.play('fog');
    }
  }, [revealingCount, service]);

  // Suono di vittoria
  useEffect(() => {
    if (phase === 'won' && prevPhase.current !== 'won') {
      service.play('win');
      service.haptic('success');
    }
    prevPhase.current = phase;
  }, [phase, service]);
}
