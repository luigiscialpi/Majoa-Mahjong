import { COMBO_KEYS, SOUND_ASSETS, STAR_KEYS, type SoundKey } from './soundAssets';

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

export interface SoundService {
  play(key: SoundKey): void;
  playMatch(comboStep: number): void;
  playStar(index: number): void;
  playBoom(): void;
  haptic(type: HapticType): void;
  setSoundEnabled(enabled: boolean): void;
  setHapticsEnabled(enabled: boolean): void;
  isSoundEnabled(): boolean;
  isHapticsEnabled(): boolean;
  setVolume(volume: number): void;
  getVolume(): number;
  dispose(): void;
}

type AudioPlayerLike = {
  play(): void;
  pause(): void;
  seekTo(seconds: number): void | Promise<void>;
  volume: number;
};

/**
 * Gestore dell'audio e della vibrazione dell'app (docs/decisioni-tecniche.md e prototipo S2).
 * Usa un pool di AudioPlayer pre-istratti per azzerare la latenza I/O al momento della riproduzione.
 */
class ExpoAudioSoundService implements SoundService {
  private players = new Map<SoundKey, AudioPlayerLike>();
  private soundEnabled = true;
  private hapticsEnabled = true;
  private volume = 1.0;
  private initialized = false;
  private lastBoom = 0;

  constructor() {
    this.initPool();
  }

  private initPool() {
    try {
      // Caricamento dinamico sicuro per ambienti headless/Jest dove i moduli nativi mancano
      const expoAudio = (() => {
        try {
          return require('expo-audio');
        } catch {
          return null;
        }
      })();

      if (expoAudio?.setAudioModeAsync) {
        expoAudio.setAudioModeAsync({
          playsInSilentMode: true,
          interruptionMode: 'mixWithOthers',
        }).catch(() => {});
      }

      if (expoAudio?.createAudioPlayer) {
        for (const [key, asset] of Object.entries(SOUND_ASSETS) as [SoundKey, unknown][]) {
          try {
            const player = expoAudio.createAudioPlayer(asset as number);
            player.volume = 1.0;
            this.players.set(key, player);
          } catch {
            // Ignorato in ambienti senza supporto audio nativo
          }
        }
        this.initialized = true;
      }
    } catch {
      // Ignorato se il modulo nativo non è caricato
    }
  }

  play(key: SoundKey): void {
    if (!this.soundEnabled) return;
    const player = this.players.get(key);
    if (!player) return;

    try {
      player.seekTo(0);
      player.play();
    } catch {
      // Non bloccare il thread di rendering se l'audio fallisce
    }
  }

  playMatch(comboStep: number): void {
    const idx = Math.min(Math.max(0, comboStep), COMBO_KEYS.length - 1);
    this.play(COMBO_KEYS[idx]);
  }

  playStar(index: number): void {
    const idx = Math.min(Math.max(0, index), STAR_KEYS.length - 1);
    this.play(STAR_KEYS[idx]);
  }

  /** Boom dei fuochi d'artificio: limitato a un massimo di uno ogni 140 ms come riga 2220 dell'originale. */
  playBoom(): void {
    const now = Date.now();
    if (now - this.lastBoom > 140) {
      this.play('boom');
      this.lastBoom = now;
    }
  }

  haptic(type: HapticType): void {
    if (!this.hapticsEnabled) return;
    try {
      const Haptics = require('expo-haptics');
      switch (type) {
        case 'light':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          break;
        case 'medium':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          break;
        case 'heavy':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
          break;
        case 'success':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          break;
        case 'warning':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          break;
        case 'error':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          break;
      }
    } catch {
      // Nessun feedback se il modulo nativo non è supportato
    }
  }

  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
  }

  setHapticsEnabled(enabled: boolean): void {
    this.hapticsEnabled = enabled;
  }

  isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  isHapticsEnabled(): boolean {
    return this.hapticsEnabled;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    for (const player of this.players.values()) {
      try {
        player.volume = this.volume;
      } catch {
        // Ignorato se il player nativo fallisce
      }
    }
  }

  getVolume(): number {
    return this.volume;
  }

  dispose(): void {
    this.players.forEach((player) => {
      try {
        player.pause();
      } catch {}
    });
    this.players.clear();
    this.initialized = false;
  }
}

let instance: SoundService | null = null;

export function getSoundService(): SoundService {
  if (!instance) {
    instance = new ExpoAudioSoundService();
  }
  return instance;
}

/** Per test unitari: consente di iniettare un mock o resettare l'istanza. */
export function setSoundService(service: SoundService | null): void {
  instance = service;
}
