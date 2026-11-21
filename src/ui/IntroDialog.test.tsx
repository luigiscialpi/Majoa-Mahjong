import { fireEvent, render, screen } from '@testing-library/react-native';
import { LanguageProvider, locale, type Language } from '../infrastructure/i18n';
import { IntroDialog } from './IntroDialog';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

async function show(lang: Language = 'it') {
  const onPlay = jest.fn();
  const onDismiss = jest.fn();
  const entry = locale(lang).intro[91]!;
  await render(
    <LanguageProvider initial={lang}>
      <IntroDialog entry={entry} onPlay={onPlay} onDismiss={onDismiss} />
    </LanguageProvider>,
  );
  return { onPlay, onDismiss, entry };
}

describe('IntroDialog', () => {
  test('mostra il titolo, le tre righe di spiegazione, la spunta spenta e il pulsante «Gioca»', async () => {
    const { entry } = await show();
    expect(screen.getByText(entry.t)).toBeTruthy();
    expect(screen.getByText(entry.l.join('\n\n'))).toBeTruthy();
    expect(screen.getByTestId('intro-dont-show').props.accessibilityState.checked).toBe(false);
    expect(screen.getByText(locale('it').introDontShow)).toBeTruthy();
    expect(screen.getByText(locale('it').introPlay)).toBeTruthy();
    expect(screen.queryByTestId('intro-check', { includeHiddenElements: true })).toBeNull();
  });

  test('«Gioca» senza spunta avvia e dice di non nascondere la spiegazione', async () => {
    const { onPlay, onDismiss } = await show();
    await fireEvent.press(screen.getByTestId('btn-intro-play'));
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(onPlay).toHaveBeenCalledWith(false);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  test('con la spunta «Gioca» dice di non mostrarla più; togliendola, torna a no', async () => {
    const { onPlay } = await show();
    await fireEvent.press(screen.getByTestId('intro-dont-show'));
    expect(screen.getByTestId('intro-dont-show').props.accessibilityState.checked).toBe(true);
    expect(screen.getByTestId('intro-check', { includeHiddenElements: true })).toBeTruthy(); // il segno è decorativo: la casella dice già «selezionata»
    await fireEvent.press(screen.getByTestId('btn-intro-play'));
    expect(onPlay).toHaveBeenLastCalledWith(true);
    await fireEvent.press(screen.getByTestId('intro-dont-show'));
    expect(screen.getByTestId('intro-dont-show').props.accessibilityState.checked).toBe(false);
    await fireEvent.press(screen.getByTestId('btn-intro-play'));
    expect(onPlay).toHaveBeenLastCalledWith(false);
  });

  test('il tasto indietro chiude senza iniziare', async () => {
    const { onPlay, onDismiss } = await show();
    await fireEvent(screen.getByTestId('intro-dialog'), 'requestClose'); // il tasto indietro di Android, sulla Modal
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onPlay).not.toHaveBeenCalled();
  });

  test('è in tutte le lingue', async () => {
    for (const lang of ['en', 'fr'] as const) {
      const { entry } = await show(lang);
      expect(screen.getByText(entry.t)).toBeTruthy();
      expect(screen.getByText(locale(lang).introDontShow)).toBeTruthy();
      expect(screen.getByText(locale(lang).introPlay)).toBeTruthy();
      await screen.unmount();
    }
  });

  test('la spunta è una casella con etichetta per i lettori di schermo', async () => {
    await show();
    const box = screen.getByTestId('intro-dont-show');
    expect(box.props.accessibilityRole).toBe('checkbox');
    expect(box.props.accessibilityLabel).toBe(locale('it').introDontShow);
  });
});
