import type { Profile } from '../domain/profile';
import { newProgress, type Progress } from '../domain/progress';
import { legacyIslands } from '../infrastructure/content/legacyIslands';
import { LevelPicker, REASON_MS } from './LevelPicker';
import { TRIS_REASON } from './levelStatus';
import { StyleSheet } from 'react-native';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

// react-test-renderer non ha tipi nel progetto: `requireActual` lo restituisce come `any`.
const { act, create } = jest.requireActual('react-test-renderer');
const originalError = console.error;
beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  console.error = (...args: unknown[]) => {
    if (!String(args[0]).includes('react-test-renderer is deprecated')) originalError(...args);
  };
});
afterAll(() => {
  console.error = originalError;
});

const mounted: any[] = [];
afterEach(() => {
  act(() => mounted.splice(0).forEach((r) => r.unmount())); // la FlatList programma aggiornamenti differiti: si smonta a fine test
});

function render(onPlay: (level: number, profile: Profile) => void, progress: Progress = newProgress()) {
  let renderer: any;
  act(() => {
    renderer = create(<LevelPicker progress={progress} islands={legacyIslands} onPlay={onPlay} />);
  });
  mounted.push(renderer);
  return renderer;
}
const press = (renderer: any, testID: string) => act(() => renderer.root.findAllByProps({ testID })[0].props.onPress());

test('con il profilo Normale di partenza, toccare un livello lo avvia', () => {
  const calls: [number, Profile][] = [];
  const r = render((level, profile) => calls.push([level, profile]));
  press(r, 'level-1');
  expect(calls).toEqual([[1, 'normal']]);
});

test('il profilo scelto vale per i livelli toccati dopo', () => {
  const calls: [number, Profile][] = [];
  const r = render((level, profile) => calls.push([level, profile]));
  press(r, 'profile-master');
  press(r, 'level-7');
  press(r, 'profile-easy');
  press(r, 'level-3');
  expect(calls).toEqual([[7, 'master'], [3, 'easy']]);
});

const withStars = (byLevel: Record<number, number>): Progress => ({
  ...newProgress(),
  levels: Object.fromEntries(Object.entries(byLevel).map(([id, stars]) => [id, { stars, bestSeconds: null, gold: 0, profile: null }])),
});
const texts = (renderer: any): string => renderer.root.findAll((n: any) => n.type === 'Text').map((n: any) => [n.props.children].flat(Infinity).join('')).join('|');
const reason = (renderer: any): string | null => {
  const node = renderer.root.findAllByProps({ testID: 'level-reason' })[0];
  return node ? [node.findByType('Text' as any).props.children].flat(Infinity).join('') : null;
};
const toggle = (renderer: any, value: boolean) => act(() => renderer.root.findAllByProps({ testID: 'prova-switch' })[0].props.onValueChange(value));
const label = (renderer: any, level: number): string => renderer.root.findAllByProps({ testID: `level-${level}` })[0].props.accessibilityLabel;

describe('modalità prova', () => {
  test('è accesa all\'inizio, col suo testo, e con lei ogni livello si gioca', () => {
    const calls: [number, Profile][] = [];
    const r = render((level, profile) => calls.push([level, profile]));
    expect(texts(r)).toContain('Modalità prova: tutti i livelli aperti');
    expect(r.root.findAllByProps({ testID: 'prova-switch' })[0].props.value).toBe(true);
    press(r, 'level-50');
    press(r, 'level-95');
    expect(calls).toEqual([[50, 'normal'], [95, 'normal']]);
    expect(reason(r)).toBeNull();
  });

  test('spenta, i livelli chiusi non partono e dicono perché; quelli aperti sì', () => {
    const calls: number[] = [];
    const r = render((level) => calls.push(level));
    toggle(r, false);
    press(r, 'level-1');
    expect(calls).toEqual([1]);
    press(r, 'level-2');
    expect(reason(r)).toBe('🔒 Vinci il livello 1 per aprire questo');
    press(r, 'level-21');
    expect(reason(r)).toBe('🔒 Servono 40 ★ per aprire Animali');
    press(r, 'level-91');
    expect(reason(r)).toBe(`🔒 ${TRIS_REASON}`);
    expect(calls).toEqual([1]);
  });

  test('riaccendendola si torna a poter giocare tutto', () => {
    const calls: number[] = [];
    const r = render((level) => calls.push(level));
    toggle(r, false);
    toggle(r, true);
    press(r, 'level-30');
    expect(calls).toEqual([30]);
  });
});

describe('progressi nel selettore', () => {
  test('stelle sotto ogni livello aperto; i chiusi mostrano il lucchetto e non le stelle', () => {
    const r = render(() => {}, withStars({ 1: 3, 2: 1 }));
    toggle(r, false);
    const t = texts(r);
    expect(t).toContain('★★★');
    expect(t).toContain('★☆☆');
    expect(t).toContain('☆☆☆');
    expect(t).toContain('🔒 21');
    expect(r.root.findAllByProps({ testID: 'level-21' })[0].findAll((n: any) => n.type === 'Text').map((n: any) => [n.props.children].flat(Infinity).join('')).join('')).not.toMatch(/[★☆]/);
  });

  test('si aggiornano con i progressi', () => {
    const r = render(() => {}, withStars({ 5: 2 }));
    expect(label(r, 5)).toBe('Livello 5, 2 stelle su 3');
    act(() => r.update(<LevelPicker progress={withStars({ 5: 3 })} islands={legacyIslands} onPlay={() => {}} />));
    expect(label(r, 5)).toBe('Livello 5, 3 stelle su 3');
  });

  test('anche i livelli sbloccati dai progressi si giocano con la modalità prova spenta', () => {
    const calls: number[] = [];
    const r = render((level) => calls.push(level), withStars({ 1: 1 }));
    toggle(r, false);
    press(r, 'level-2');
    expect(calls).toEqual([2]);
  });
});

describe('lucchetti accessibili e motivo', () => {
  test('l\'etichetta per i lettori di schermo dice stelle o blocco e motivo', () => {
    const r = render(() => {}, withStars({ 1: 2 }));
    toggle(r, false);
    expect(label(r, 1)).toBe('Livello 1, 2 stelle su 3');
    expect(label(r, 3)).toBe('Livello 3, bloccato. Vinci il livello 2 per aprire questo');
    expect(label(r, 91)).toBe(`Livello 91 (Tris), bloccato. ${TRIS_REASON}`);
  });

  test('i Tris aperti si annunciano come tali', () => {
    expect(label(render(() => {}), 91)).toBe('Livello 91 (Tris), 0 stelle su 3');
  });

  test('il motivo sparisce da solo dopo qualche secondo e un nuovo tocco lo sostituisce', () => {
    jest.useFakeTimers();
    try {
      const r = render(() => {});
      toggle(r, false);
      press(r, 'level-2');
      act(() => jest.advanceTimersByTime(REASON_MS - 1));
      expect(reason(r)).not.toBeNull();
      press(r, 'level-21'); // un nuovo tocco rinnova il conto
      act(() => jest.advanceTimersByTime(REASON_MS - 1));
      expect(reason(r)).toBe('🔒 Servono 40 ★ per aprire Animali');
      act(() => jest.advanceTimersByTime(1));
      expect(reason(r)).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  test('toccare lo stesso livello chiuso due volte rinnova il conto', () => {
    jest.useFakeTimers();
    try {
      const r = render(() => {});
      toggle(r, false);
      press(r, 'level-2');
      act(() => jest.advanceTimersByTime(REASON_MS - 1));
      press(r, 'level-2');
      act(() => jest.advanceTimersByTime(REASON_MS - 1));
      expect(reason(r)).not.toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});

test('i controlli del selettore sono alti almeno 48 dp', () => {
  const r = render(() => {});
  for (const id of ['profile-easy', 'profile-master']) {
    const node = r.root.findAllByProps({ testID: id }).find((n: any) => n.props.style);
    expect(StyleSheet.flatten(node.props.style).minHeight).toBeGreaterThanOrEqual(48);
  }
});
