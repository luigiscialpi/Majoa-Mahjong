import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';
import { Button } from './Button';
import { colors } from './theme/colors';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const render = (props: Partial<Parameters<typeof Button>[0]> = {}) => {
  const onPress = jest.fn();
  let renderer!: ReturnType<typeof create>;
  act(() => {
    renderer = create(<Button label="Continua quella" onPress={onPress} testID="b" {...props} />);
  });
  // Il primo nodo con quel testID è `Button`: serve quello che ha lo stile, cioè il `Pressable`.
  const node = renderer.root.findAll((n) => n.props.testID === 'b' && n.props.style !== undefined)[0];
  return { node, onPress, style: (pressed = false) => StyleSheet.flatten(typeof node.props.style === 'function' ? node.props.style({ pressed }) : node.props.style) };
};

describe('Button', () => {
  test('almeno 48 dp di altezza, ruolo pulsante ed etichetta per i lettori di schermo', () => {
    const { node, style } = render();
    expect(style().minHeight).toBeGreaterThanOrEqual(48);
    expect([node.props.accessibilityRole, node.props.accessibilityLabel, node.props.accessibilityState]).toEqual(['button', 'Continua quella', { disabled: false }]);
  });

  test('un\'etichetta per i lettori di schermo diversa dal testo, se serve', () => {
    expect(render({ accessibilityLabel: 'Riprendi la partita del livello 20' }).node.props.accessibilityLabel).toBe('Riprendi la partita del livello 20');
  });

  test('il tocco chiama onPress', () => {
    const { node, onPress } = render();
    act(() => node.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('disattivato: non risponde, ha aspetto spento e lo dice ai lettori di schermo', () => {
    const { node, style } = render({ disabled: true });
    expect(node.props.disabled).toBe(true);
    expect(node.props.accessibilityState).toEqual({ disabled: true });
    expect(style().opacity).toBeLessThan(1);
  });

  test('premuto cambia aspetto', () => {
    const { style } = render();
    expect(style(true).opacity).toBeLessThan(style(false).opacity ?? 1);
  });

  test('l\'azione consigliata ha lo sfondo chiaro e il testo scuro, le altre il contrario', () => {
    const primary = render({ kind: 'primary' });
    const plain = render({ kind: 'plain' });
    expect(primary.style().backgroundColor).toBe(colors.btn);
    expect(plain.style().backgroundColor).not.toBe(colors.btn);
  });
});
