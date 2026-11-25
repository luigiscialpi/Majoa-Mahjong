import { Text } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { render, screen } from '@testing-library/react-native';
import { TabScreen } from './TabScreen';

const METRICS = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 24, bottom: 34, left: 0, right: 0 } };

function Insets() {
  const { top, bottom } = useSafeAreaInsets();
  return <Text testID="insets">{`${top}/${bottom}`}</Text>;
}

describe('TabScreen', () => {
  test('toglie il margine inferiore (lo prende la barra) e lascia gli altri', async () => {
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <TabScreen>
          <Insets />
        </TabScreen>
      </SafeAreaProvider>,
    );
    expect(screen.getByTestId('insets').props.children).toBe('24/0');
  });

  test('fuori da TabScreen il margine inferiore c\'è', async () => {
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <Insets />
      </SafeAreaProvider>,
    );
    expect(screen.getByTestId('insets').props.children).toBe('24/34');
  });
});
