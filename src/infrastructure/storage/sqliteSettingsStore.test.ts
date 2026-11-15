/** @jest-environment node */
import { DEFAULT_SETTINGS, type Settings } from '../../domain/settings';
import { createNodeSqliteDatabase } from './__fixtures__/nodeSqliteDatabase';
import { createSqliteSettingsStore } from './sqliteSettingsStore';

describe('sqliteSettingsStore (node:sqlite)', () => {
  test('restituisce DEFAULT_SETTINGS su database nuovo', async () => {
    const db = createNodeSqliteDatabase();
    const store = createSqliteSettingsStore(db);
    const settings = await store.loadSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  test('salva e ricarica le impostazioni', async () => {
    const db = createNodeSqliteDatabase();
    const store = createSqliteSettingsStore(db);
    const custom: Settings = {
      ...DEFAULT_SETTINGS,
      mascot: 'siamlong',
      sound: false,
      volume: 40,
      vibration: false,
      effects: false,
      comfort: true,
    };
    await store.saveSettings(custom);
    const loaded = await store.loadSettings();
    expect(loaded).toEqual(custom);
  });

  test('resetSettings ripristina DEFAULT_SETTINGS', async () => {
    const db = createNodeSqliteDatabase();
    const store = createSqliteSettingsStore(db);
    await store.saveSettings({
      ...DEFAULT_SETTINGS,
      mascot: 'sheltie',
      volume: 20,
    });
    const reset = await store.resetSettings();
    expect(reset).toEqual(DEFAULT_SETTINGS);
    const loaded = await store.loadSettings();
    expect(loaded).toEqual(DEFAULT_SETTINGS);
  });
});
