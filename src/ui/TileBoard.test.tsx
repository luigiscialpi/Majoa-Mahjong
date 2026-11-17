// Mock manuali: i moduli nativi di Reanimated e dei gesti non si caricano nei test.
jest.mock('react-native-reanimated', () => ({
  useSharedValue: (v: unknown) => ({ value: v }),
  useDerivedValue: (fn: () => unknown) => ({ value: fn() }),
  withTiming: (v: unknown) => v,
  withDelay: (_d: number, v: unknown) => v,
  withSequence: (...args: unknown[]) => args[args.length - 1],
  runOnJS: (fn: unknown) => fn,
  Easing: { linear: (t: number) => t, inOut: () => (t: number) => t, out: () => (t: number) => t, ease: (t: number) => t, bezier: () => (t: number) => t },
  default: {},
}));
jest.mock('react-native-gesture-handler', () => ({
  Gesture: { Tap: () => ({ runOnJS: () => ({ onEnd: () => ({}) }) }) },
  GestureDetector: ({ children }: { children: unknown }) => children,
}));

import { render, screen } from '@testing-library/react-native';
import { startRound } from '../application/round';
import { designOf, levelPalette } from '../infrastructure/content/legacyThemes';
import { legacyLevels, toSpec } from '../infrastructure/content/legacyLevels';
import { tileStatuses } from './boardView';
import { HATCH } from './contrastSignals';
import { TileBoard, type TileBoardProps } from './TileBoard';

type Node = { type: string; props: Record<string, unknown>; children?: Node[] | null };
const walk = (node: Node | Node[] | null, out: Node[] = []): Node[] => {
  if (!node) return out;
  if (Array.isArray(node)) node.forEach((n) => walk(n, out));
  else {
    out.push(node);
    walk(node.children as Node[] | null, out);
  }
  return out;
};
const nodes = () => walk(screen.toJSON() as unknown as Node);
const rings = (width: number, color?: string) => nodes().filter((n) => n.type === 'RoundedRect' && n.props.style === 'stroke' && n.props.strokeWidth === width && (color === undefined || n.props.color === color));

const level = legacyLevels[0];
const started = startRound({ spec: toSpec(level), profile: 'normal', seed: 3 });
if (!started.ok) throw new Error('la partita non parte');
const game = started.value.session.game;
const statuses = tileStatuses(game);
const free = new Set<number>([...game.ft.freeList()]);
const blockedTiles = game.tiles.map((_, i) => i).filter((i) => game.ft.alive[i] === 1 && !free.has(i) && !statuses[i].locked);
const [tileA, tileB] = [...free];

const props: TileBoardProps = {
  tiles: game.tiles,
  designs: game.tiles.map((t) => designOf(level.island, t.type)),
  svgs: [],
  statuses,
  palette: levelPalette(level.id, level.island),
  width: 360,
  height: 480,
  free,
  gone: new Set(),
  removing: new Set(),
  removeKey: 0,
  selected: [],
  hint: [],
  match: [],
  rejected: null,
  onTap: () => undefined,
};

describe('TileBoard: segnali che non dipendono dal colore', () => {
  test('senza i segnali: niente tratteggio, né contorni bianchi, né anelli neri', async () => {
    await render(<TileBoard {...props} selected={[tileA]} hint={[tileA]} blockers={[tileB]} match={[tileB]} />);
    expect(nodes().filter((n) => n.type === 'Path' && n.props.color === HATCH.color)).toHaveLength(0);
    expect(rings(5, '#fff')).toHaveLength(0);
    expect(nodes().filter((n) => n.type === 'DashPathEffect')).toHaveLength(0);
    expect(rings(4, '#000')).toHaveLength(0);
    expect(rings(4, '#ff4d4d')).toHaveLength(1); // il contorno rosso delle bloccanti
    expect(nodes().filter((n) => n.type === 'Circle' && n.props.color === '#1fbf5a')).toHaveLength(1); // il pallino verde del match
  });

  test('tratteggio: una striscia di linee per ogni tessera bloccata e non nascosta, e per nessun\'altra', async () => {
    expect(blockedTiles.length).toBeGreaterThan(0);
    await render(<TileBoard {...props} signals />);
    const hatched = nodes().filter((n) => n.type === 'Path' && n.props.color === HATCH.color);
    expect(hatched).toHaveLength(blockedTiles.length);
    expect(hatched.every((n) => n.props.strokeWidth === HATCH.width)).toBe(true);
  });

  test('tessera selezionata: contorno bianco di 5 px, oltre al suo bordo d\'accento', async () => {
    await render(<TileBoard {...props} signals selected={[tileA]} />);
    expect(rings(5, '#fff')).toHaveLength(1);
    expect(rings(3, props.palette[2])).toHaveLength(2); // bagliore e bordo d'accento restano (CSS: `.cb .tile.sel` aggiunge soltanto il contorno)
  });

  test('aiuto: contorno tratteggiato bianco di 4 px, oltre all\'anello bianco di sempre', async () => {
    await render(<TileBoard {...props} signals hint={[tileA]} />);
    const dashed = nodes().filter((n) => n.type === 'RoundedRect' && n.props.strokeWidth === 4 && (n.children ?? []).some((c) => c.type === 'DashPathEffect'));
    expect(dashed).toHaveLength(1);
    expect(dashed[0].props.color).toBe('#fff');
    expect(rings(4, '#ffffff')).toHaveLength(1);
  });

  test('tessere bloccanti: due linee bianche sottili al posto del rosso', async () => {
    await render(<TileBoard {...props} signals blockers={[tileB]} />);
    expect(rings(4, '#ff4d4d')).toHaveLength(0);
    expect(rings(5 / 3, '#fff')).toHaveLength(2);
  });

  test('tessere uguali: anelli nero, bianco e nero con il segno in un quadrato nero, non il verde', async () => {
    await render(<TileBoard {...props} signals match={[tileB]} />);
    expect(rings(4, '#000')).toHaveLength(2); // interno ed esterno
    expect(rings(4, '#fff')).toHaveLength(1);
    expect(nodes().filter((n) => n.type === 'Circle' && n.props.color === '#1fbf5a')).toHaveLength(0);
    expect(nodes().filter((n) => n.type === 'RoundedRect' && n.props.color === '#000' && n.props.style === undefined)).toHaveLength(1); // il quadrato nero
    expect(nodes().filter((n) => n.type === 'Path' && n.props.color === '#ffffff' && n.props.strokeWidth === 2.2)).toHaveLength(1); // il ✔ resta bianco
  });
});
