import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { ComboBanner } from './ComboBanner';
import { COMBO_BANNER_TOP } from './effects';

// Reanimated non si carica nei test (richiede i moduli nativi di worklets): finto, con l'animazione già arrivata alla fine.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    withTiming: (v: unknown, _options: unknown, done?: (finished: boolean) => void) => {
      done?.(true);
      return v;
    },
    runOnJS: (fn: unknown) => fn,
    Easing: { linear: (t: number) => t },
  };
});

// L'aspetto si confronta con le regole CSS dell'originale (`.cmbox`, righe 270-273), non con valori scritti a occhio.
const fs: { readFileSync(path: string, encoding: string): string } = jest.requireActual('fs');
const src = fs.readFileSync('reference/majoa-originale/Majoa Mahjong.html', 'utf8'); // percorso dalla radice del progetto
const numbers = (css: string) => css.match(/-?[\d.]+/g)!.map(Number);
const must = (m: RegExpExecArray | null): RegExpExecArray => {
  expect(m).not.toBeNull();
  return m!;
};

// La scritta è nascosta ai lettori di schermo di proposito (è decorativa): le query devono includere gli elementi nascosti.
const HIDDEN = { includeHiddenElements: true };

const box = must(/\.cmbox\{[^}]*background:(rgba\([^)]*\));border:(\d+)px solid (#\w+);border-radius:(\d+)px;padding:[^;]*;box-shadow:0 (\d+)px 0 (rgba\([^)]*\))/.exec(src));
const text = must(/\.cmbox span\{[^}]*font-size:(\d+)px;color:(#\w+);text-shadow:0 (\d+)px 0 (#\w+)\}/.exec(src));
const hot = must(/\.cmbox\.hot span\{color:(#\w+);text-shadow:0 \d+px 0 (#\w+)\}/.exec(src));

describe('ComboBanner', () => {
  test('mostra il testo e segnala la fine dell\'animazione una volta sola', async () => {
    const onDone = jest.fn();
    await render(<ComboBanner text="Bene!" hot={false} onDone={onDone} />);
    expect(screen.getByText('Bene!', HIDDEN)).toBeOnTheScreen();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  test('riquadro: fondo, bordo e angoli come `.cmbox`; ombra piena spostata di 5 px', async () => {
    await render(<ComboBanner text="Super!" hot={false} onDone={() => {}} />);
    const b = StyleSheet.flatten(screen.getByTestId('combo-box', HIDDEN).props.style);
    expect(numbers(b.backgroundColor as string)).toEqual(numbers(box[1]));
    expect([b.borderWidth, b.borderColor, b.borderRadius]).toEqual([Number(box[2]), box[3], Number(box[4])]);
    const sh = StyleSheet.flatten(screen.getByTestId('combo-shadow', HIDDEN).props.style);
    expect([sh.top, sh.bottom]).toEqual([Number(box[5]), -Number(box[5])]);
    expect(numbers(sh.backgroundColor as string)).toEqual(numbers(box[6]));
    expect(sh.borderRadius).toBe(Number(box[4]));
  });

  test('testo dorato, rosa dal livello 3', async () => {
    await render(<ComboBanner text="Super!" hot={false} onDone={() => {}} />);
    const plain = StyleSheet.flatten(screen.getByText('Super!', HIDDEN).props.style);
    expect([plain.fontSize, plain.color, plain.textShadowColor, plain.textShadowOffset]).toEqual([Number(text[1]), text[2], text[4], { width: 0, height: Number(text[3]) }]);
    await render(<ComboBanner text="Grande!" hot onDone={() => {}} />);
    const pink = StyleSheet.flatten(screen.getByText('Grande!', HIDDEN).props.style);
    expect([pink.color, pink.textShadowColor]).toEqual([hot[1], hot[2]]);
  });

  test('non intercetta i tocchi, non è letto dai lettori di schermo ed è nella posizione prevista', async () => {
    await render(<ComboBanner text="Super!" hot={false} onDone={() => {}} />);
    const wrap = screen.getByTestId('combo-banner', HIDDEN);
    expect(wrap.props.pointerEvents).toBe('none');
    expect(wrap.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(StyleSheet.flatten(wrap.props.style)).toMatchObject({ position: 'absolute', top: COMBO_BANNER_TOP });
  });

  test('parte invisibile e in scala 0,6, come il primo fotogramma dell\'originale', async () => {
    await render(<ComboBanner text="Super!" hot={false} onDone={() => {}} />);
    const wrap = screen.getByTestId('combo-banner', HIDDEN);
    const animated = wrap.children[0] as unknown as { props: { style: { opacity: number; transform: { translateY?: number; scale?: number }[] } } };
    expect(animated.props.style.opacity).toBe(0);
    expect(animated.props.style.transform).toEqual([{ translateY: -26 }, { scale: 0.6 }]);
  });
});
