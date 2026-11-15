import { fireEvent, render, screen } from '@testing-library/react-native';
import { GiftDialog } from './GiftDialog';
import { SettingsProvider } from './SettingsProvider';
import { LanguageProvider } from '../infrastructure/i18n';
import { getSoundService } from '../infrastructure/audio/soundService';

describe('GiftDialog', () => {
  test('mostra titolo, corpo, pulsante OK e suona win', async () => {
    const playSpy = jest.spyOn(getSoundService(), 'play').mockImplementation(() => {});
    const onClose = jest.fn();
    await render(
      <LanguageProvider initial="it">
        <SettingsProvider initial={{ mascot: 'none' } as any}>
          <GiftDialog
            title="Nuova isola scoperta!"
            body="L'Isola degli animali appare sulla mappa. Regalo: +3 monete"
            onClose={onClose}
            testID="gift-dialog"
          />
        </SettingsProvider>
      </LanguageProvider>,
    );

    expect(screen.getByTestId('gift-title')).toHaveTextContent('Nuova isola scoperta!');
    expect(screen.getByTestId('gift-body')).toHaveTextContent("L'Isola degli animali appare sulla mappa. Regalo: +3 monete");
    expect(screen.getByText('Evviva!')).toBeTruthy();
    expect(playSpy).toHaveBeenCalledWith('win');

    fireEvent.press(screen.getByTestId('gift-ok'));
    expect(onClose).toHaveBeenCalledTimes(1);

    playSpy.mockRestore();
  });

  test('mostra emoji regalo quando la mascotte è none', async () => {
    await render(
      <LanguageProvider initial="it">
        <SettingsProvider initial={{ mascot: 'none' } as any}>
          <GiftDialog
            title="Regalo"
            body="Descrizione"
            onClose={() => {}}
          />
        </SettingsProvider>
      </LanguageProvider>,
    );

    expect(screen.getByLabelText('regalo')).toBeTruthy();
  });
});
