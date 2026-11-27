import { Text } from 'react-native';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import TabsLayout from '../app/(tabs)/_layout';

// I file delle rotte vere (mappa, impostazioni, partita) hanno bisogno di archivi e impostazioni: qui si provano la barra e la
// struttura delle rotte, con schermate finte al posto delle vere.
const routes = {
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': () => <Text>schermata-mappa</Text>,
  '(tabs)/games': () => <Text>schermata-giochi</Text>,
  '(tabs)/settings': () => <Text>schermata-impostazioni</Text>,
  play: () => <Text>schermata-partita</Text>,
};

describe('barra di navigazione in basso', () => {
  test('si apre sulla mappa, con le schede Mappa, Giochi e Impostazioni', async () => {
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByText('schermata-mappa')).toBeTruthy();
    expect(screen.getByTestId('tab-map')).toBeTruthy();
    expect(screen.getByTestId('tab-games')).toBeTruthy();
    expect(screen.getByTestId('tab-settings')).toBeTruthy();
    expect(screen.getByText('Mappa')).toBeTruthy();
    expect(screen.getByText('Giochi')).toBeTruthy();
    expect(screen.getByText('Impostazioni')).toBeTruthy();
    // l'ordine della barra: Mappa, Giochi, Impostazioni
    expect(screen.getAllByTestId(/^tab-/).map((tab) => tab.props.testID)).toEqual(['tab-map', 'tab-games', 'tab-settings']);
  });

  test('la scheda Impostazioni apre le impostazioni e la Mappa torna alla mappa', async () => {
    await renderRouter(routes, { initialUrl: '/' });
    await fireEvent.press(await screen.findByTestId('tab-settings'));
    expect(await screen.findByText('schermata-impostazioni')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('tab-map'));
    expect(await screen.findByText('schermata-mappa')).toBeTruthy();
  });

  test('la scheda Giochi apre i giochi e la Mappa torna indietro', async () => {
    await renderRouter(routes, { initialUrl: '/' });
    await fireEvent.press(await screen.findByTestId('tab-games'));
    expect(await screen.findByText('schermata-giochi')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('tab-map'));
    expect(await screen.findByText('schermata-mappa')).toBeTruthy();
  });

  test('la partita sta fuori dalla barra, a tutto schermo', async () => {
    await renderRouter(routes, { initialUrl: '/play' });
    expect(await screen.findByText('schermata-partita')).toBeTruthy();
    expect(screen.queryByTestId('tab-map')).toBeNull();
    expect(screen.queryByTestId('tab-settings')).toBeNull();
  });
});
