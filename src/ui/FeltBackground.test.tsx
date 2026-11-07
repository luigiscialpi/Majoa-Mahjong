import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
import { FeltBackground } from './FeltBackground';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('FeltBackground', () => {
  test('renderizza i contenuti figli e il canvas dello sfondo', () => {
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <FeltBackground testID="bg">
          <Text testID="child">Gioco</Text>
        </FeltBackground>
      );
    });

    expect(renderer.root.findByProps({ testID: 'child' })).toBeDefined();
    expect(renderer.root.findByProps({ testID: 'bg' })).toBeDefined();
  });
});
