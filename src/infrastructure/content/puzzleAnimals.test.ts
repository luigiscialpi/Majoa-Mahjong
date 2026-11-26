/** @jest-environment node */
import { ANIMAL_DESIGNS } from './puzzleAnimals';

const ORIGINAL_HTML = 'reference/majoa-originale/Majoa Mahjong.html'; // percorso dalla radice del progetto
// Modulo di Node senza tipi nel progetto (`tsconfig.json` ha solo `jest`): `requireActual` lo restituisce come `any`.
const { readFileSync } = jest.requireActual('node:fs') as { readFileSync(path: string, encoding: 'utf8'): string };
const html = readFileSync(ORIGINAL_HTML, 'utf8');

describe('animali dei rompicapi', () => {
  test('sono i 28 disegni di ANIMAL_TYPES dell\'originale', () => {
    const original = JSON.parse(/var ANIMAL_TYPES=(\[[\d,]*\]);/.exec(html)?.[1] ?? 'null') as number[];
    expect(original).toHaveLength(28);
    expect(ANIMAL_DESIGNS).toEqual(original);
  });
});
