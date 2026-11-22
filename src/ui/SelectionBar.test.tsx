import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { LanguageProvider, locale, type Language } from '../infrastructure/i18n';
import type { Palette } from '../infrastructure/content/legacyThemes';
import { SelectionBar } from './SelectionBar';
import type { BarView } from './selectionBarView';

// Ogni casella è una `MiniTile` finta che espone ciò che riceve: il disegno vero è provato in miniTiles.test.tsx.
jest.mock('./miniTiles', () => {
  const React = require('react'); // eslint-disable-line @typescript-eslint/no-require-imports
  return { MINI_FACE: { w: 42, h: 54, radius: 9 }, MINI_RECENT: { w: 24, h: 31 }, MiniTile: (props: { slot: unknown; width: number; height: number; testID?: string }) => React.createElement('View', { testID: props.testID ?? 'selection-bar-mini-recent', slot: props.slot, width: props.width, height: props.height }) };
});

const palette: Palette = ['#111', '#222', '#333', '#444', '#555'];
const svgs = [] as never[];
const none: BarView = { slots: [], status: null };

async function bar(view: BarView, recent: number[] = [], groupSize = 2, lang: Language = 'it', highContrast = false) {
  await render(
    <LanguageProvider initial={lang}>
      <SelectionBar view={view} recent={recent} groupSize={groupSize} svgs={svgs} palette={palette} highContrast={highContrast} />
    </LanguageProvider>,
  );
}
const style = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID, { includeHiddenElements: true }).props.style);

// Misure e colori dell'originale (righe 192-200), lette dall'HTML.
const fs: { readFileSync(path: string, encoding: string): string } = jest.requireActual('fs');
const html = fs.readFileSync('reference/majoa-originale/Majoa Mahjong.html', 'utf8');
const rule = (selector: string) => new RegExp(`${selector.replace(/[.#]/g, '\\$&')}\\{([^}]*)\\}`).exec(html)![1];

// I colori del segno li sceglie `sbShow` (riga 1965): verde per ✔, rosso chiaro per ✖, bianco per il resto.
const statusColor = (mark: string) => new RegExp(`st===\'${mark}\'\\?\'(#[0-9a-f]{6})\'`).exec(html)![1];

describe('SelectionBar', () => {
  test('senza tessere: due caselle vuote tratteggiate (tre nei livelli Tris), nessun segno, nessun nome', async () => {
    await bar(none);
    expect(screen.getByTestId('selection-bar-slot-0').props.testID).toBe('selection-bar-slot-0');
    expect(screen.getByTestId('selection-bar-slot-1')).toBeTruthy();
    expect(screen.queryByTestId('selection-bar-slot-2')).toBeNull();
    expect(style('selection-bar-slot-0')).toMatchObject({ borderStyle: 'dashed' });
    expect(screen.getByTestId('selection-bar-name').props.children).toBe('');
    expect(screen.queryByTestId('status-ok')).toBeNull();
  });

  test('livello Tris: tre caselle', async () => {
    await bar(none, [], 3);
    expect(screen.getByTestId('selection-bar-slot-2')).toBeTruthy();
  });

  test('mostra il disegno di ogni tessera e il loro nome, con «≠» se sono diverse', async () => {
    await bar({ slots: [0, 1], status: 'bad' });
    const tn = locale('it').tn;
    expect(screen.getByTestId('selection-bar-slot-0').props.slot).toBe(0);
    expect(screen.getByTestId('selection-bar-slot-1').props.slot).toBe(1);
    expect(screen.getByTestId('selection-bar-name').props.children).toBe(`${tn[0]} ≠ ${tn[1]}`);
  });

  test('nella lingua attiva; le tessere nascoste e velate hanno il loro nome', async () => {
    await bar({ slots: ['locked'], status: 'locked' }, [], 2, 'en');
    expect(screen.getByTestId('selection-bar-name').props.children).toBe('Hidden tile');
    expect(screen.getByTestId('selection-bar-slot-0').props.slot).toBe('locked');
    expect(screen.queryByTestId('selection-bar-slot-1')).toBeTruthy();
  });

  test('il segno di ogni esito è una forma diversa (non solo un colore)', async () => {
    for (const [status, testID] of [['ok', 'status-ok'], ['bad', 'status-bad'], ['blocked', 'status-blocked']] as const) {
      await bar({ slots: [0], status });
      expect(screen.getByTestId(testID, { includeHiddenElements: true })).toBeTruthy(); // il contenitore del segno è nascosto ai lettori di schermo
      await screen.unmount();
    }
    await bar({ slots: ['locked'], status: 'locked' });
    for (const testID of ['status-ok', 'status-bad', 'status-blocked']) expect(screen.queryByTestId(testID, { includeHiddenElements: true })).toBeNull();
  });

  test('i colori del segno sono quelli dell\'originale (verde per ✔, rosso chiaro per ✖, bianco il resto)', async () => {
    await bar({ slots: [0], status: 'ok' });
    expect(style('status-ok').borderColor).toBe(statusColor('✔'));
    await screen.unmount();
    await bar({ slots: [0], status: 'bad' });
    const bars = screen.getByTestId('status-bad', { includeHiddenElements: true }).children as unknown as { props: { style: { backgroundColor: string } } }[];
    expect(bars.length).toBe(2);
    expect(StyleSheet.flatten(bars[0].props.style).backgroundColor).toBe(statusColor('✖'));
    expect(/color:#fff\b/.test(rule('.sbstat'))).toBe(true);
  });

  test('il nome è bianco in alto contrasto (`--ink`, riga 215) e color inchiostro negli altri casi', async () => {
    await bar({ slots: [0], status: null });
    expect(style('selection-bar-name').color).toBe('#f6efd9');
    await screen.unmount();
    await bar({ slots: [0], status: null }, [], 2, 'it', true);
    expect(style('selection-bar-name').color).toBe('#fff');
  });

  test('si mostrano solo gli ultimi quattro abbinamenti, dal più vecchio', async () => {
    await bar(none, [1, 2, 3, 4, 5, 6]);
    const recent = screen.getAllByTestId('selection-bar-mini-recent');
    expect(recent.map((r) => r.props.slot)).toEqual([3, 4, 5, 6]);
  });

  test('la barra annuncia i cambiamenti ai lettori di schermo; segno e caselle sono decorativi', async () => {
    await bar({ slots: [0], status: 'ok' });
    expect(screen.getByTestId('selection-bar').props.accessibilityLiveRegion).toBe('polite');
    expect(screen.getByTestId('selection-bar-status', { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true);
  });

  test('misure e colori sono quelli dell\'originale', async () => {
    await bar({ slots: [0], status: 'ok' }, [1]);
    const selbar = rule('#selbar');
    const px = (rules: string, prop: string) => Number(new RegExp(`${prop}:(\\d+)px`).exec(rules)![1]);
    expect(style('selection-bar')).toMatchObject({ gap: px(selbar, 'gap'), minHeight: px(selbar, 'min-height') });
    const [top, side, bottom] = /padding:(\d+)px (\d+)px (\d+)px/.exec(selbar)!.slice(1).map(Number);
    expect(style('selection-bar')).toMatchObject({ paddingTop: top, paddingHorizontal: side, paddingBottom: bottom });
    const slot = screen.getByTestId('selection-bar-slot-0').props;
    expect([slot.width, slot.height]).toEqual([px(rule('.sbslot'), 'width'), px(rule('.sbslot'), 'height')]);
    const small = screen.getByTestId('selection-bar-mini-recent').props;
    expect([small.width, small.height]).toEqual([px(rule('.sbrec .mt'), 'width'), px(rule('.sbrec .mt'), 'height')]);
    expect(style('selection-bar-status').width).toBe(px(rule('.sbstat'), 'width'));
    expect(style('selection-bar-name').fontSize).toBe(px(rule('.sbname'), 'font-size'));
    expect(style('selection-bar-recent').gap).toBe(px(rule('.sbrec'), 'gap'));
    expect(/border:2px dashed rgba\(255,255,255,\.35\)/.test(rule('.sbslot.empty'))).toBe(true);
    await screen.unmount();
    await bar(none);
    expect(style('selection-bar-slot-0')).toMatchObject({ width: px(rule('.sbslot'), 'width'), height: px(rule('.sbslot'), 'height'), borderWidth: 2, borderRadius: px(rule('.sbslot.empty'), 'border-radius'), borderColor: 'rgba(255,255,255,0.35)' });
  });
});
