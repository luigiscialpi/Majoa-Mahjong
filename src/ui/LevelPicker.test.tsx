import type { Profile } from '../domain/profile';
import { LevelPicker } from './LevelPicker';

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

function render(onPlay: (level: number, profile: Profile) => void) {
  let renderer: any;
  act(() => {
    renderer = create(<LevelPicker onPlay={onPlay} />);
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
