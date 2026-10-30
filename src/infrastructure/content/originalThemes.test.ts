/** @jest-environment node */
// Ambiente `node` e non quello di React Native: jsdom ha bisogno delle API standard di Node.
import themes from './legacy-themes.json';

jest.setTimeout(60_000);

// Moduli CommonJS senza tipi: `requireActual` li restituisce come `any`.
const { extract } = jest.requireActual('../../../tools/export-themes.js') as { extract(htmlPath: string): Promise<unknown> };
const ORIGINAL_HTML = 'reference/majoa-originale/Majoa Mahjong.html'; // percorso dalla radice del progetto

test('legacy-themes.json coincide con quello che l\'originale produce oggi', async () => {
  expect(await extract(ORIGINAL_HTML)).toEqual(themes);
});
