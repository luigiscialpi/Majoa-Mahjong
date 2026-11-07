import { StyleSheet } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Button } from './Button';
import { colors } from './theme/colors';

async function renderButton(props: Partial<Parameters<typeof Button>[0]> = {}) {
  const onPress = jest.fn();
  const res = await render(<Button label="Continua quella" onPress={onPress} testID="b" {...props} />);
  return { onPress, ...res };
}

function flatStyle() {
  const el = screen.getByTestId('b');
  return StyleSheet.flatten(el.props.style);
}

describe('Button', () => {
  test('almeno 48 dp di altezza, ruolo pulsante ed etichetta per i lettori di schermo', async () => {
    await renderButton();
    const el = screen.getByTestId('b');
    expect(flatStyle().minHeight).toBeGreaterThanOrEqual(48);
    expect(el.props.accessibilityRole).toBe('button');
    expect(el.props.accessibilityLabel).toBe('Continua quella');
    expect(el.props.accessibilityState).toEqual({ disabled: false });
  });

  test("un'etichetta per i lettori di schermo diversa dal testo, se serve", async () => {
    await renderButton({ accessibilityLabel: 'Riprendi la partita del livello 20' });
    expect(screen.getByTestId('b').props.accessibilityLabel).toBe('Riprendi la partita del livello 20');
  });

  test('il tocco chiama onPress', async () => {
    const { onPress } = await renderButton();
    await fireEvent.press(screen.getByTestId('b'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('disattivato: non risponde, ha aspetto spento e lo dice ai lettori di schermo', async () => {
    await renderButton({ disabled: true });
    const el = screen.getByTestId('b');
    expect(el).toBeDisabled();
    expect(el.props.accessibilityState).toEqual({ disabled: true });
    expect(flatStyle().opacity).toBeLessThan(1);
  });

  test('premuto cambia aspetto', async () => {
    await renderButton();
    const el = screen.getByTestId('b');
    const normalOpacity = flatStyle().opacity ?? 1;
    await fireEvent(el, 'responderGrant', { nativeEvent: { timestamp: Date.now() }, persist: () => {} });
    const pressedOpacity = flatStyle().opacity ?? 1;
    expect(pressedOpacity).toBeLessThan(normalOpacity);
  });

  test("l'azione consigliata ha lo sfondo chiaro e il testo scuro, le altre il contrario", async () => {
    const { unmount } = await renderButton({ kind: 'primary' });
    expect(flatStyle().backgroundColor).toBe(colors.btn);
    await unmount();
    await renderButton({ kind: 'plain' });
    expect(flatStyle().backgroundColor).not.toBe(colors.btn);
  });
});
