import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { Profile } from '../domain/profile';
import { newProgress, type Progress } from '../domain/progress';
import { legacyIslands } from '../infrastructure/content/legacyIslands';
import { LevelPicker, REASON_MS } from './LevelPicker';
import { LanguageProvider, type Language } from '../infrastructure/i18n';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

async function renderPicker(onPlay: (level: number, profile: Profile) => void = () => {}, progress: Progress = newProgress(), lang: Language = 'it') {
  return render(
    <LanguageProvider initial={lang}>
      <LevelPicker progress={progress} islands={legacyIslands} onPlay={onPlay} />
    </LanguageProvider>,
  );
}

const press = async (testID: string) => {
  await fireEvent.press(screen.getByTestId(testID));
};

const toggle = async (value: boolean) => {
  await fireEvent(screen.getByTestId('prova-switch'), 'valueChange', value);
};

function extractTexts(node: unknown): string[] {
  if (!node) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(extractTexts);
  if (typeof node === 'object' && 'children' in (node as Record<string, unknown>)) {
    return extractTexts((node as { children: unknown }).children);
  }
  return [];
}
const texts = (): string => extractTexts(screen.toJSON()).join('|');

const reason = (): string | null => {
  const node = screen.queryByTestId('level-reason');
  return node ? extractTexts(node).join('') : null;
};

const label = (level: number): string => screen.getByTestId(`level-${level}`).props.accessibilityLabel;

const withStars = (byLevel: Record<number, number>): Progress => ({
  ...newProgress(),
  levels: Object.fromEntries(Object.entries(byLevel).map(([id, stars]) => [id, { stars, bestSeconds: null, gold: 0, profile: null }])),
});

test('con il profilo Normale di partenza, toccare un livello lo avvia', async () => {
  const calls: [number, Profile][] = [];
  await renderPicker((level, profile) => calls.push([level, profile]));
  await press('level-1');
  expect(calls).toEqual([[1, 'normal']]);
});

test('etichetta Tris e motivo di sblocco seguono la lingua selezionata', async () => {
  await renderPicker(() => {}, newProgress(), 'en');
  expect(label(91)).toBe('Level 91 (Triples), 0 stars out of 3');
  await toggle(false);
  await press('level-21');
  expect(reason()).toBe('Need 40 ★ to open Animals');
});

test('il profilo scelto vale per i livelli toccati dopo', async () => {
  const calls: [number, Profile][] = [];
  await renderPicker((level, profile) => calls.push([level, profile]));
  await press('profile-master');
  await press('level-7');
  await press('profile-easy');
  await press('level-3');
  expect(calls).toEqual([
    [7, 'master'],
    [3, 'easy'],
  ]);
});

describe('modalità prova', () => {
  test("è accesa all'inizio, col suo testo, e con lei ogni livello si gioca", async () => {
    const calls: [number, Profile][] = [];
    await renderPicker((level, profile) => calls.push([level, profile]));
    expect(texts()).toContain('Modalità prova: tutti i livelli aperti');
    expect(screen.getByTestId('prova-switch').props.value).toBe(true);
    await press('level-50');
    await press('level-95');
    expect(calls).toEqual([
      [50, 'normal'],
      [95, 'normal'],
    ]);
    expect(reason()).toBeNull();
  });

  test('spenta, i livelli chiusi non partono e dicono perché; quelli aperti sì', async () => {
    const calls: number[] = [];
    await renderPicker((level) => calls.push(level));
    await toggle(false);
    await press('level-1');
    expect(calls).toEqual([1]);
    await press('level-2');
    expect(reason()).toBe('Vinci il livello 1 per aprire questo');
    await press('level-21');
    expect(reason()).toBe('Servono 40 ★ per aprire Animali');
    await press('level-91');
    expect(reason()).toBe('Si sbloccano più avanti');
    expect(calls).toEqual([1]);
  });

  test('riaccendendola si torna a poter giocare tutto', async () => {
    const calls: number[] = [];
    await renderPicker((level) => calls.push(level));
    await toggle(false);
    await toggle(true);
    await press('level-30');
    expect(calls).toEqual([30]);
  });
});

describe('progressi nel selettore', () => {
  test('stelle sotto ogni livello aperto; i chiusi mostrano il lucchetto e non le stelle', async () => {
    await renderPicker(() => {}, withStars({ 1: 3, 2: 1 }));
    await toggle(false);
    const t = texts();
    expect(t).toContain('★★★');
    expect(t).toContain('★☆☆');
    expect(t).toContain('☆☆☆');
    expect(t).toContain('21');
    const level21Text = extractTexts(screen.getByTestId('level-21')).join('');
    expect(level21Text).not.toMatch(/[★☆]/);
  });

  test('si aggiornano con i progressi', async () => {
    const { rerender } = await renderPicker(() => {}, withStars({ 5: 2 }));
    expect(label(5)).toBe('Livello 5, 2 stelle su 3');
    await rerender(<LevelPicker progress={withStars({ 5: 3 })} islands={legacyIslands} onPlay={() => {}} />);
    expect(label(5)).toBe('Livello 5, 3 stelle su 3');
  });

  test('anche i livelli sbloccati dai progressi si giocano con la modalità prova spenta', async () => {
    const calls: number[] = [];
    await renderPicker((level) => calls.push(level), withStars({ 1: 1 }));
    await toggle(false);
    await press('level-2');
    expect(calls).toEqual([2]);
  });
});

describe('lucchetti accessibili e motivo', () => {
  test("l'etichetta per i lettori di schermo dice stelle o blocco e motivo", async () => {
    await renderPicker(() => {}, withStars({ 1: 2 }));
    await toggle(false);
    expect(label(1)).toBe('Livello 1, 2 stelle su 3');
    expect(label(3)).toBe('Livello 3, bloccato. Vinci il livello 2 per aprire questo');
    expect(label(91)).toBe('Livello 91 (Tris), bloccato. Si sbloccano più avanti');
  });

  test('i Tris aperti si annunciano come tali', async () => {
    await renderPicker(() => {});
    expect(label(91)).toBe('Livello 91 (Tris), 0 stelle su 3');
  });

  test('il motivo sparisce da solo dopo qualche secondo e un nuovo tocco lo sostituisce', async () => {
    jest.useFakeTimers();
    try {
      await renderPicker(() => {});
      await toggle(false);
      await press('level-2');
      await act(async () => {
        jest.advanceTimersByTime(REASON_MS - 1);
      });
      expect(reason()).not.toBeNull();
      await press('level-21');
      await act(async () => {
        jest.advanceTimersByTime(REASON_MS - 1);
      });
      expect(reason()).toBe('Servono 40 ★ per aprire Animali');
      await act(async () => {
        jest.advanceTimersByTime(1);
      });
      expect(reason()).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  test('toccare lo stesso livello chiuso due volte rinnova il conto', async () => {
    jest.useFakeTimers();
    try {
      await renderPicker(() => {});
      await toggle(false);
      await press('level-2');
      await act(async () => {
        jest.advanceTimersByTime(REASON_MS - 1);
      });
      await press('level-2');
      await act(async () => {
        jest.advanceTimersByTime(REASON_MS - 1);
      });
      expect(reason()).not.toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});

test('i controlli del selettore sono alti almeno 48 dp', async () => {
  await renderPicker(() => {});
  for (const id of ['profile-easy', 'profile-master']) {
    expect(StyleSheet.flatten(screen.getByTestId(id).props.style).minHeight).toBeGreaterThanOrEqual(48);
  }
});

describe('cambio lingua al volo', () => {
  test('toccare una lingua aggiorna i testi del selettore istantaneamente', async () => {
    await renderPicker(() => {});
    expect(texts()).toContain('Scegli un livello · 20 sfide');
    expect(texts()).toContain('Normale');

    await press('lang-en');
    expect(texts()).toContain('Choose a level · 20 challenges');
    expect(texts()).toContain('Normal');

    await press('lang-fr');
    expect(texts()).toContain('Choisis un niveau · 20 défis');
    expect(texts()).toContain('Normal');

    await press('lang-it');
    expect(texts()).toContain('Scegli un livello · 20 sfide');
    expect(texts()).toContain('Normale');
  });
});
