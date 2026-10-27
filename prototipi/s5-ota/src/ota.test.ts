import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUNDLE_V1, BUNDLE_V2, BUNDLE_INVALID_MUTATED } from './bundles';
import { ContentRepository, validateAppendOnly } from './content-repository';
import { MemoryStorageAdapter } from './storage';
import {
  computeBoardHash,
  saveGame,
  loadSavedGame,
  restoreSavedGame,
} from './saved-game';

test('1. Salvataggio e ripristino su Bundle V1', () => {
  const repo = new ContentRepository(BUNDLE_V1);
  const storage = new MemoryStorageAdapter();

  const spec = repo.getLevel('island-1-lv-5')!;
  assert.ok(spec, 'Il livello 5 di isola 1 deve esistere');

  const seed = 12345;
  const moves = [0, 4, 12];
  const hash = computeBoardHash(spec, seed, moves);

  saveGame(storage, {
    levelId: spec.id,
    contentVersion: BUNDLE_V1.contentVersion,
    seed,
    moves,
    boardHash: hash,
    timestamp: Date.now(),
  });

  const restore = restoreSavedGame(storage, repo);
  assert.equal(restore.status, 'restored');
  if (restore.status === 'restored') {
    assert.equal(restore.levelSpec.id, 'island-1-lv-5');
    assert.equal(restore.playedMoves, 3);
  }
});

test('2. Aggiornamento Append-Only (V2): Partita preservata e nuova isola aggiunta', () => {
  const repo = new ContentRepository(BUNDLE_V1);
  const storage = new MemoryStorageAdapter();

  // Partita salvata su isola 1
  const spec = repo.getLevel('island-1-lv-5')!;
  const seed = 54321;
  const moves = [1, 2];
  const hash = computeBoardHash(spec, seed, moves);

  saveGame(storage, {
    levelId: spec.id,
    contentVersion: BUNDLE_V1.contentVersion,
    seed,
    moves,
    boardHash: hash,
    timestamp: Date.now(),
  });

  // Ricezione aggiornamento OTA v2
  const staged = repo.stageUpdate(BUNDLE_V2);
  assert.equal(staged.ok, true, 'Bundle v2 append-only deve essere accettato');

  // Applicazione al "riavvio"
  repo.applyStagedUpdate();
  assert.equal(repo.getActiveBundle().contentVersion, 2);

  // La partita precedente deve riprendere normalmente
  const restore = restoreSavedGame(storage, repo);
  assert.equal(restore.status, 'restored');
  if (restore.status === 'restored') {
    assert.equal(restore.levelSpec.id, 'island-1-lv-5');
  }

  // La nuova Isola 3 deve essere presente e accessibile
  const island3 = repo.getIsland('island-3');
  assert.ok(island3, 'Isola 3 deve essere presente nel bundle v2');
  assert.equal(island3?.name, 'Picco Vulcanico');
  assert.equal(repo.getAllIslands().length, 3);
});

test('3. Violazione integrità: Spec mutato scarta la partita in modo sicuro senza crash', () => {
  const repo = new ContentRepository(BUNDLE_V1);
  const storage = new MemoryStorageAdapter();

  // Partita salvata con spec originale di V1
  const specV1 = repo.getLevel('island-1-lv-5')!;
  const seed = 999;
  const moves = [0, 1];
  const hashOriginal = computeBoardHash(specV1, seed, moves);

  saveGame(storage, {
    levelId: specV1.id,
    contentVersion: 1,
    seed,
    moves,
    boardHash: hashOriginal,
    timestamp: Date.now(),
  });

  // Simuliamo un repo corrotto o che ha applicato BUNDLE_INVALID_MUTATED
  const corruptRepo = new ContentRepository(BUNDLE_INVALID_MUTATED);

  // Il ripristino deve rilevare l'incongruenza dell'hash e scartare la partita
  const restore = restoreSavedGame(storage, corruptRepo);
  assert.equal(restore.status, 'discarded');
  if (restore.status === 'discarded') {
    assert.equal(restore.reason, 'hash-mismatch');
  }

  // Lo storage della partita deve essere stato pulito
  assert.equal(loadSavedGame(storage), null, 'La partita corrotta deve essere stata rimossa dallo storage');
});

test('4. Regola 4: Gli aggiornamenti si applicano solo all avvio successivo', () => {
  const repo = new ContentRepository(BUNDLE_V1);

  // Arriva un aggiornamento mentre il giocatore è in sessione
  repo.stageUpdate(BUNDLE_V2);

  // Il bundle attivo DEVE rimanere V1 durante la sessione corrente
  assert.equal(repo.getActiveBundle().contentVersion, 1);
  assert.equal(repo.getAllIslands().length, 2);

  // Solo dopo il riavvio (applyStagedUpdate) diventa V2
  repo.applyStagedUpdate();
  assert.equal(repo.getActiveBundle().contentVersion, 2);
  assert.equal(repo.getAllIslands().length, 3);
});

test('5. Validatore Append-Only intercetta alterazioni retroattive', () => {
  const check = validateAppendOnly(BUNDLE_V1, BUNDLE_INVALID_MUTATED);
  assert.equal(check.valid, false, 'La mutazione dello spec deve fallire la validazione');
  assert.ok(check.errors.some((e) => e.includes('island-1-lv-5')));
});
