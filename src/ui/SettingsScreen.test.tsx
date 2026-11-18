import { StyleSheet } from 'react-native';
import { render, fireEvent, screen, cleanup, act } from '@testing-library/react-native';
import { createMemorySettingsStore } from '../application/settingsStore';
import { DEFAULT_SETTINGS, type Settings } from '../domain/settings';
import { PROFILES } from '../domain/profile';
import { LanguageProvider, locale } from '../infrastructure/i18n';
import { getSoundService } from '../infrastructure/audio/soundService';
import { SettingsProvider } from './SettingsProvider';
import { SettingsScreen } from './SettingsScreen';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

afterEach(async () => {
  cleanup();
});

async function renderSettings(initialSettings?: Settings, onBack = jest.fn()) {
  const store = createMemorySettingsStore(initialSettings);
  await render(
    <LanguageProvider initial="it">
      <SettingsProvider store={store} initial={initialSettings}>
        <SettingsScreen onBack={onBack} />
      </SettingsProvider>
    </LanguageProvider>,
  );
  return {
    onBack,
    store,
  };
}

describe('SettingsScreen', () => {
  test('mostra tutte le sezioni di impostazione con i loro titoli', async () => {
    await renderSettings();

    expect(screen.getByText('Impostazioni')).toBeTruthy();
    expect(screen.getByText('Mascotte')).toBeTruthy();
    expect(screen.getByText('Difficoltà')).toBeTruthy();
    expect(screen.getByText('Aspetto')).toBeTruthy();
    expect(screen.getByText('Suoni e vibrazione')).toBeTruthy();
    expect(screen.getByText('Aiuti di gioco')).toBeTruthy();
    expect(screen.getByText('Comfort e accessibilità')).toBeTruthy();
    expect(screen.getByText('Lingua')).toBeTruthy();
    expect(screen.getByText('Ripristina predefiniti')).toBeTruthy();
  });

  test('il pulsante Indietro chiama onBack', async () => {
    const onBack = jest.fn();
    await renderSettings(DEFAULT_SETTINGS, onBack);

    const backBtn = screen.getByTestId('btn-settings-back');
    await fireEvent.press(backBtn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test('permette di selezionare una mascotte diversa', async () => {
    const { store } = await renderSettings();

    const sheltieBtn = screen.getByTestId('mascot-sheltie');
    await fireEvent.press(sheltieBtn);

    const saved = await store.loadSettings();
    expect(saved.mascot).toBe('sheltie');
  });

  test('permette di scegliere la tavolozza di sfondo e del bordo tessere', async () => {
    const { store } = await renderSettings();

    const bgOcean = screen.getByTestId('bg-ocean');
    await fireEvent.press(bgOcean);

    const tilePink = screen.getByTestId('tile-pink');
    await fireEvent.press(tilePink);

    const saved = await store.loadSettings();
    expect(saved.bgPalette).toBe('ocean');
    expect(saved.tilePalette).toBe('pink');
  });

  test('permette di attivare/disattivare suoni e vibrazione', async () => {
    const { store } = await renderSettings();

    const soundSwitch = screen.getByTestId('switch-sound');
    await fireEvent(soundSwitch, 'valueChange', false);

    const vibSwitch = screen.getByTestId('switch-vib');
    await fireEvent(vibSwitch, 'valueChange', false);

    const saved = await store.loadSettings();
    expect(saved.sound).toBe(false);
    expect(saved.vibration).toBe(false);
  });

  test('permette di cambiare il volume', async () => {
    const { store } = await renderSettings();

    const vol50 = screen.getByTestId('volume-50');
    await fireEvent.press(vol50);

    const saved = await store.loadSettings();
    expect(saved.volume).toBe(50);
  });

  test('permette di cambiare la lingua', async () => {
    await renderSettings();

    const enBtn = screen.getByTestId('lang-btn-en');
    await fireEvent.press(enBtn);

    expect(screen.getByText('Settings')).toBeTruthy();
  });

  test('il tasto Ripristina predefiniti resetta le impostazioni modificate', async () => {
    const custom: Settings = {
      ...DEFAULT_SETTINGS,
      mascot: 'siamlong',
      sound: false,
      volume: 25,
      comfort: true,
    };
    const { store } = await renderSettings(custom);

    const resetBtn = screen.getByTestId('btn-reset-settings');
    await fireEvent.press(resetBtn);

    const saved = await store.loadSettings();
    expect(saved).toEqual(DEFAULT_SETTINGS);
  });
});

describe('SettingsScreen: difficoltà', () => {
  // L'ordine, i punti e i colori vengono dall'HTML dell'originale (`DIFS`, riga 1368; `buildSettings`, righe 3452-3459; CSS righe 297-303).
  const fs: { readFileSync(path: string, encoding: string): string } = jest.requireActual('fs');
  const html = fs.readFileSync('reference/majoa-originale/Majoa Mahjong.html', 'utf8');
  const css = (selector: string) => new RegExp(`\\n${selector.replace(/[.#]/g, '\\$&')}\\{([^}]*)\\}`).exec(html)![1];
  const px = (rules: string, prop: string) => Number(new RegExp(`${prop}:([\\d.]+)px`).exec(rules)![1]);
  const it = locale('it');
  const text = (id: string) => (screen.getByTestId(id).children as unknown as { children: string[] }[]).map((c) => c.children.join(''));
  const style = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style) as Record<string, unknown>;

  test('è tra Mascotte e Aspetto, come nell\'originale, con sei profili nell\'ordine di `DIFS`', async () => {
    expect(/var DIFS=\[([^\]]+)\]/.exec(html)![1].replace(/'/g, '').split(',')).toEqual([...PROFILES]);
    await renderSettings();
    const titles = ['Mascotte', 'Difficoltà', 'Aspetto'].map((t) => JSON.stringify(screen.toJSON()).indexOf(`"${t}"`));
    expect(titles[0]).toBeGreaterThan(-1);
    expect(titles[1]).toBeGreaterThan(titles[0]);
    expect(titles[2]).toBeGreaterThan(titles[1]);
    for (const p of PROFILES) expect(screen.getByTestId(`dif-${p}`)).toBeTruthy();
  });

  test('ogni profilo ha nome, descrizione e punti «●» per il livello su cinque', async () => {
    expect(html).toContain("'●'.repeat(i+1)+'○'.repeat(5-i)");
    await renderSettings();
    PROFILES.forEach((p, i) => {
      expect(text(`dif-${p}`)).toEqual([it[`dif_${p}`], it[`difd_${p}`], '●'.repeat(i + 1) + '○'.repeat(5 - i)]);
    });
  });

  test('è scelto «Normale» di base; toccarne un altro lo salva (`S.dif`) e sposta la selezione', async () => {
    const { store } = await renderSettings();
    const selected = () => PROFILES.filter((p) => screen.getByTestId(`dif-${p}`).props.accessibilityState.selected);
    expect(selected()).toEqual(['normal']);
    await fireEvent.press(screen.getByTestId('dif-hard'));
    expect(selected()).toEqual(['hard']);
    expect((await store.loadSettings()).defaultProfile).toBe('hard');
    await fireEvent.press(screen.getByTestId('dif-easy'));
    expect(selected()).toEqual(['easy']);
    expect((await store.loadSettings()).defaultProfile).toBe('easy');
  });

  test('parte dal profilo salvato', async () => {
    await renderSettings({ ...DEFAULT_SETTINGS, defaultProfile: 'master' });
    expect(screen.getByTestId('dif-master').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('dif-normal').props.accessibilityState.selected).toBe(false);
  });

  test('la nota ricorda che la Modalità comoda ignora la difficoltà, solo se è accesa (`difnote`)', async () => {
    await renderSettings();
    expect(screen.getByTestId('dif-note').props.children).toBe(it.difNote);
    await screen.unmount();
    await renderSettings({ ...DEFAULT_SETTINGS, comfort: true });
    expect(screen.getByTestId('dif-note').props.children).toBe(it.difNote + ' ' + it.difCfNote);
  });

  test('scegliere la difficoltà non fa rumore (nell\'originale non c\'è suono)', async () => {
    const play = jest.spyOn(getSoundService(), 'play');
    await renderSettings();
    await fireEvent.press(screen.getByTestId('dif-expert'));
    expect(play).not.toHaveBeenCalled();
    play.mockRestore();
  });

  test('l\'etichetta per i lettori di schermo dice nome e descrizione; i punti sono decorativi', async () => {
    await renderSettings();
    expect(screen.getByTestId('dif-hard').props.accessibilityLabel).toBe(`${it.dif_hard}. ${it.difd_hard}`);
    const dots = screen.getByTestId('dif-dots-hard', { includeHiddenElements: true }).props;
    expect(dots.accessibilityElementsHidden).toBe(true);
    expect(dots.importantForAccessibility).toBe('no');
  });

  test('misure e colori sono quelli dell\'originale', async () => {
    await renderSettings({ ...DEFAULT_SETTINGS, defaultProfile: 'medium' });
    const btn = css('.difbtn');
    expect(style('dif-easy')).toMatchObject({ paddingVertical: 9, paddingHorizontal: 12, borderRadius: px(btn, 'border-radius'), borderWidth: 2, gap: px(btn, 'gap'), backgroundColor: 'rgba(255,255,255,0.12)' });
    expect(/padding:9px 12px/.test(btn) && /background:rgba\(255,255,255,\.12\)/.test(btn)).toBe(true);
    expect(style('dif-medium')).toMatchObject({ backgroundColor: 'rgba(255,255,255,0.28)' });
    expect(/background:rgba\(255,255,255,\.28\)/.test(css('.difbtn.on'))).toBe(true);
    expect(StyleSheet.flatten(screen.getByTestId('dif-medium').props.style).borderColor).not.toBe('transparent');
    expect(px(css('.difbtn b'), 'font-size')).toBe(16);
    expect(px(css('.difbtn span'), 'font-size')).toBe(12.5);
    expect(px(css('.difbtn i'), 'letter-spacing')).toBe(2);
    expect(px(css('.difnote'), 'font-size')).toBe(12.5);

    // e i testi di ogni pulsante e la nota portano gli stessi valori
    const [name, desc, dots] = (screen.getByTestId('dif-easy').children as unknown as { props: { style: object } }[]).map((c) => StyleSheet.flatten(c.props.style) as Record<string, unknown>);
    expect(name.fontSize).toBe(px(css('.difbtn b'), 'font-size'));
    expect(desc).toMatchObject({ fontSize: px(css('.difbtn span'), 'font-size'), lineHeight: 12.5 * 1.3 });
    expect(/line-height:1\.3\b/.test(css('.difbtn span'))).toBe(true);
    expect(dots).toMatchObject({ fontSize: px(css('.difbtn i'), 'font-size'), letterSpacing: px(css('.difbtn i'), 'letter-spacing') });
    const note = StyleSheet.flatten(screen.getByTestId('dif-note').props.style) as Record<string, unknown>;
    expect(note).toMatchObject({ fontSize: px(css('.difnote'), 'font-size'), lineHeight: 12.5 * 1.35 });
    expect(/line-height:1\.35\b/.test(css('.difnote'))).toBe(true);
  });
});
