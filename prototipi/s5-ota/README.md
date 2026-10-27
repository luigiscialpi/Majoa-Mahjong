# S5 — Aggiornamenti OTA e compatibilità salvataggi (prototipo)

Il prototipo S5 risponde a una domanda del README principale (sezione 8) e di `docs/decisioni-tecniche.md` (sezioni 10 e 13): **un pacchetto dati di prova (nuova isola) rilasciato via OTA arriva, si applica all'avvio successivo e una partita salvata resta valida o viene scartata correttamente?**

Verifica la correttezza del modello dei **contenuti come dati**, dell'interfaccia `ContentRepository`, della semantica **append-only** e delle 4 regole di compatibilità per gli aggiornamenti OTA con EAS Update e la persistenza delle partite in corso.

## Cosa contiene

| Percorso | Contenuto |
|---|---|
| `src/types.ts` | Definizioni TypeScript di `IslandSpec`, `LevelSpec`, `ContentBundle`, `SavedGame` e `RestoreResult` |
| `src/bundles.ts` | Pacchetti dati: Bundle Base v1 (2 isole, 40 livelli), Bundle OTA v2 (nuova Isola 3 vulcanica aggiunta in append-only) e bundle con mutazione distruttiva |
| `src/content-repository.ts` | Implementazione di `ContentRepository`: catalogo attivo, gestione aggiornamenti in stage e validatore formale append-only |
| `src/saved-game.ts` | Funzioni di calcolo hash deterministico della tavola (`computeBoardHash`), salvataggio e ripristino sicuro conforme alle regole 3 e 4 |
| `src/storage.ts` | Adattatore di persistenza in memoria (`MemoryStorageAdapter`) |
| `src/ota.test.ts` | 5 test automatici che convalidano il ciclo di vita, il ripristino e la gestione degli errori |
| `App.tsx` | Schermata interattiva di simulazione per testare visivamente la ricezione di un aggiornamento OTA, l'aggiunta dell'isola e la conservazione della partita salvata |
| `package.json`, `app.json`, `tsconfig.json` | Configurazione Expo SDK 57 con `expo-updates` |

## Le 4 regole di compatibilità verificate

In base alla sezione 10 di `docs/decisioni-tecniche.md`:

1. **Versione dei contenuti (`contentVersion`)**: ogni pacchetto dati dichiara una versione sequenziale intera (`1`, `2`, ...) e la versione minima dell'app supportata.
2. **Contenuti append-only**: le isole e i livelli esistenti non possono essere rinominati, rimossi o alterati nei parametri di gioco. Nuove isole e nuovi livelli entrano solo in aggiunta. La funzione `validateAppendOnly()` intercetta e blocca qualsiasi mutazione retroattiva.
3. **Integrità della partita salvata**: la partita registra l'identificativo dello spec (`levelId`), `contentVersion`, `seed`, `moves` e `boardHash`.
   - Se l'aggiornamento è append-only e non tocca il livello in corso: la partita viene ripristinata con successo e la nuova isola compare nel catalogo.
   - Se uno spec viene mutato o rimosso: il controllo di congruenza sull'hash fallisce e la partita viene scartata in modo sicuro (`hash-mismatch` o `spec-not-found`) con un messaggio esplicito all'utente, senza crash.
4. **Applicazione all'avvio successivo**: quando un aggiornamento viene scaricato durante una partita attiva, viene collocato in *stage* e non altera il catalogo in uso. L'aggiornamento viene promosso a bundle attivo solo all'avvio successivo (o ricaricamento) dell'app.

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm test` | Esegue i 5 test automatici delle regole OTA con `tsx` |
| `npm run typecheck` | Controllo tipi TypeScript (`tsc --noEmit`) |
| `npx expo start` | Avvia l'interfaccia interattiva di simulazione su Expo Go o emulatore |

## Risultati (27/10/2026)

- **Test unitari**: 5 su 5 superati con successo:
  - Salvataggio e ripristino su Bundle Base v1.
  - Ricezione di Bundle v2 append-only: partita in corso preservata al 100% e nuova Isola 3 vulcanica sbloccata.
  - Rilevamento violazione integrità: bundle con spec alterato scarta la partita in modo pulito senza eccezioni non gestite.
  - Applicazione differita all'avvio successivo: sessione di gioco isolata durante il download.
  - Validatore formale: blocca bundle non conformi.
- **Conclusione**: il modello dei contenuti come dati dietro `ContentRepository` e il protocollo di ripristino con `boardHash` rispondono positivamente a tutti i vincoli di progetto.
