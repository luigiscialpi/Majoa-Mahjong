import { render } from '@testing-library/react-native';
import type { Feedback, Phase } from '../application/session';
import type { HapticType, SoundService } from '../infrastructure/audio/soundService';
import type { SoundKey } from '../infrastructure/audio/soundAssets';
import { useGameAudio } from './useGameAudio';

function createMockService() {
  const played: SoundKey[] = [];
  const matches: number[] = [];
  const haptics: HapticType[] = [];

  const service: SoundService = {
    play: (k) => played.push(k),
    playMatch: (step) => {
      matches.push(step);
      played.push(`match_${Math.min(step, 7)}` as SoundKey);
    },
    playStar: () => {},
    playBoom: () => {},
    haptic: (h) => haptics.push(h),
    setSoundEnabled: () => {},
    setHapticsEnabled: () => {},
    isSoundEnabled: () => true,
    isHapticsEnabled: () => true,
    setVolume: () => {},
    getVolume: () => 1,
    dispose: () => {},
  };

  return { service, played, matches, haptics };
}

function Harness(props: {
  feedback: Feedback | null;
  seq: number;
  phase: Phase;
  revealingCount?: number;
  service: SoundService;
  now?: () => number;
}) {
  useGameAudio(props);
  return null;
}

describe('useGameAudio', () => {
  test('all’avvio suona start', async () => {
    const { service, played } = createMockService();
    await render(<Harness feedback={null} seq={0} phase="playing" service={service} />);
    expect(played).toContain('start');
  });

  test('selezione e rifiuto emettono suoni e aptica corretti', async () => {
    const { service, played, haptics } = createMockService();
    const { rerender } = await render(<Harness feedback={null} seq={0} phase="playing" service={service} />);

    await rerender(<Harness feedback={{ kind: 'selected' }} seq={1} phase="playing" service={service} />);
    expect(played).toContain('select');
    expect(haptics).toContain('light');

    await rerender(<Harness feedback={{ kind: 'rejected', reason: 'locked' }} seq={2} phase="playing" service={service} />);
    expect(played).toContain('blocked');
    expect(haptics).toContain('warning');
  });

  test('abbinamenti consecutivi scalano la combo e suonano oro e sblocco', async () => {
    const { service, played, matches, haptics } = createMockService();
    let time = 1000;
    const now = () => time;

    const { rerender } = await render(<Harness feedback={null} seq={0} phase="playing" service={service} now={now} />);

    // Primo match
    await rerender(
      <Harness
        feedback={{ kind: 'matched', group: [0, 1], gold: 0, unlocked: false }}
        seq={1}
        phase="playing"
        service={service}
        now={now}
      />,
    );
    expect(matches).toEqual([0]);
    expect(played).toContain('match_0');
    expect(haptics).toContain('light');

    // Secondo match dopo 500 ms (entro la finestra di 4.5s)
    time += 500;
    await rerender(
      <Harness
        feedback={{ kind: 'matched', group: [2, 3], gold: 1, unlocked: true }}
        seq={2}
        phase="playing"
        service={service}
        now={now}
      />,
    );
    expect(matches).toEqual([0, 1]);
    expect(played).toContain('match_1');
    expect(played).toContain('gold');
    expect(played).toContain('unlock');
  });

  test('vittoria emette win e aptica di successo', async () => {
    const { service, played, haptics } = createMockService();
    const { rerender } = await render(<Harness feedback={null} seq={0} phase="playing" service={service} />);

    await rerender(<Harness feedback={null} seq={1} phase="won" service={service} />);
    expect(played).toContain('win');
    expect(haptics).toContain('success');
  });

  test('diradamento della nebbia suona fog', async () => {
    const { service, played } = createMockService();
    const { rerender } = await render(<Harness feedback={null} seq={0} phase="playing" service={service} revealingCount={0} />);

    await rerender(<Harness feedback={null} seq={1} phase="playing" service={service} revealingCount={2} />);
    expect(played).toContain('fog');
  });
});
