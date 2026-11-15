import { getSoundService, setSoundService, type SoundService } from './soundService';
import type { SoundKey } from './soundAssets';

describe('SoundService', () => {
  beforeEach(() => {
    setSoundService(null);
  });

  test('fornisce un singleton SoundService', () => {
    const s1 = getSoundService();
    const s2 = getSoundService();
    expect(s1).toBe(s2);
  });

  test('permette di attivare e disattivare suono e vibrazione', () => {
    const service = getSoundService();
    expect(service.isSoundEnabled()).toBe(true);
    expect(service.isHapticsEnabled()).toBe(true);

    service.setSoundEnabled(false);
    expect(service.isSoundEnabled()).toBe(false);

    service.setHapticsEnabled(false);
    expect(service.isHapticsEnabled()).toBe(false);

    expect(service.getVolume()).toBe(1.0);
    service.setVolume(0.5);
    expect(service.getVolume()).toBe(0.5);
    service.setVolume(2.0);
    expect(service.getVolume()).toBe(1.0);
    service.setVolume(-0.5);
    expect(service.getVolume()).toBe(0.0);
  });

  test('playMatch scala le note della combo e limita l’indice a 7', () => {
    const played: SoundKey[] = [];
    const mockService: SoundService = {
      play: (key) => played.push(key),
      playMatch: (step) => mockService.play(`match_${Math.min(Math.max(0, step), 7)}` as SoundKey),
      playStar: (idx) => mockService.play(`star_${Math.min(Math.max(0, idx), 2)}` as SoundKey),
      playBoom: () => mockService.play('boom'),
      haptic: () => {},
      setSoundEnabled: () => {},
      setHapticsEnabled: () => {},
      isSoundEnabled: () => true,
      isHapticsEnabled: () => true,
      setVolume: () => {},
      getVolume: () => 1,
      dispose: () => {},
    };

    setSoundService(mockService);
    const service = getSoundService();

    service.playMatch(0);
    expect(played).toEqual(['match_0']);

    service.playMatch(3);
    expect(played).toEqual(['match_0', 'match_3']);

    service.playMatch(10);
    expect(played).toEqual(['match_0', 'match_3', 'match_7']);
  });

  test('playStar scala le 3 stelle (0..2)', () => {
    const played: SoundKey[] = [];
    const mockService: SoundService = {
      play: (key) => played.push(key),
      playMatch: () => {},
      playStar: (idx) => mockService.play(`star_${Math.min(Math.max(0, idx), 2)}` as SoundKey),
      playBoom: () => {},
      haptic: () => {},
      setSoundEnabled: () => {},
      setHapticsEnabled: () => {},
      isSoundEnabled: () => true,
      isHapticsEnabled: () => true,
      setVolume: () => {},
      getVolume: () => 1,
      dispose: () => {},
    };

    setSoundService(mockService);
    const service = getSoundService();

    service.playStar(0);
    service.playStar(1);
    service.playStar(2);
    service.playStar(5);

    expect(played).toEqual(['star_0', 'star_1', 'star_2', 'star_2']);
  });
});
