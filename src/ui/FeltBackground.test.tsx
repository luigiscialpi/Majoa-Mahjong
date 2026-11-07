import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { FeltBackground } from './FeltBackground';

describe('FeltBackground', () => {
  test('renderizza i contenuti figli e il canvas dello sfondo', async () => {
    await render(
      <FeltBackground testID="bg">
        <Text testID="child">Gioco</Text>
      </FeltBackground>,
    );

    expect(screen.getByTestId('child')).toBeOnTheScreen();
    expect(screen.getByTestId('bg')).toBeOnTheScreen();
  });
});
