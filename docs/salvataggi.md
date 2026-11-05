# Salvataggi

> **Stato: DRAFT, in parte costruito.** Esistono il formato della partita salvata, la ricostruzione, il codec dei progressi, gli archivi in memoria e SQLite e la logica che li usa senza interfaccia (passi a e b e prima parte del c); la UI è ancora da fare. I principi generali di interazione sono in `docs/ux.md`.

Questo capitolo spiega cosa si salva, quando, come si riprende e cosa succede quando qualcosa va storto. Si legge prima di toccare la persistenza (`src/application/`, `src/infrastructure/`) o la home.

## Cosa fa

Il giocatore non salva mai: l'app conserva da sola due dati distinti. I **progressi** (`Progress`: stelle, record, oro, profilo più alto, ✨, regali già dati) e la **partita in corso**, al massimo una. Sono separati perché perdere o scartare una partita non deve toccare i progressi, e l'azzeramento dei progressi è un'operazione a parte. Impostazioni e lingua non sono qui.

## Come funziona

### Esperienza

| Momento | Cosa succede | Cosa vede il giocatore |
|---|---|---|
| Dopo ogni mossa, aiuto, annulla o rimescolo | La partita si salva | Niente: nessun indicatore, nessun pulsante «Salva» |
| L'app va in secondo piano | La partita si salva e il tempo si ferma | Niente; al ritorno il tempo riparte da dove era |
| Uscita dalla partita | Nessuna conferma: la partita resta salvata | La home, con la scheda «Continua» |
| Home con una partita salvata | In cima, la scheda «Continua» | Livello, profilo, tempo trascorso (`m:ss`) e tessere rimaste; un tocco riprende |
| Avvio di un'altra partita con una salvata | Conferma che spiega cosa si perde | «La partita del livello 20 (Normale, 4:12) andrà persa». Pulsanti «Continua quella» (predefinito) e «Sostituisci» |
| Vittoria | Si registrano `recordWin` e `openGifts` e si cancella la partita salvata, in un'unica transazione | Stelle, «+N ✨», «Nuovo record!» se il tempo migliora e, se si apre un'isola, il regalo |
| Partita bloccata (`dead`) | Si cancella la partita salvata | La schermata di blocco |
| Partita salvata illeggibile | I progressi restano intatti | Messaggio chiaro e «Ricomincia» (sezione «Stati ed errori») |
| «Cancella tutta la progressione» (quando esisterà la schermata Impostazioni) | Conferma che elenca cosa si perde; poi progressi ai valori predefiniti e partita cancellata, in una transazione | La sessione resta utilizzabile subito dopo |

Il tempo corre solo mentre si gioca: `tick` si chiama solo con l'app in primo piano. Oggi l'intervallo di `GameScreen` non guarda lo stato dell'app (letto nel codice; cosa accada in secondo piano su Android non è misurato).

### Modello

**Partita salvata** (`SavedGame`, JSON con numero di versione del formato, oggi 1): `levelId` (il numero del livello nei progressi, che serve a `recordWin` e alla scheda «Continua»; `LevelSpec.id` è una stringa come `legacy-20` e non si interpreta), `spec` (la specifica di base, `Session.base`, senza il profilo applicato: applicato due volte cambierebbe la tavola), `profile`, `seed`, `noTimePressure`, `events`, `seconds` e `fingerprint`. Le tessere non si salvano: `restoreSession` ricostruisce la partita con `replaySession(ingresso, eventi, secondi)` (`docs/sessione-di-gioco.md`), che riparte da specifica, profilo e seme e riapplica gli eventi. Si salva la specifica e non solo il numero del livello perché la partita non dipende da contenuti che cambiano dopo. Una partita salvata subito dopo l'ultima mossa può risultare già vinta: la registrazione dell'esito spetta a chi chiama. La lettura (`parseSavedGame`) è rigida: una versione sconosciuta dà `unsupported-version`; campi mancanti o in più, tipi e valori fuori intervallo danno `malformed` con il percorso del campo (per esempio `spec.cells[2].z`). Le coordinate delle tessere sono numeri finiti, non solo interi, perché le tessere possono stare a mezzi passi; non c'è un tetto ai conteggi.

**Impronta della tavola** (`boardFingerprint`, `src/domain/fingerprint.ts`): valore a 64 bit (due FNV-1a a 32 bit con moltiplicatori diversi, la funzione `fingerprint` che fissa anche le tavole in `legacyGolden.test.ts`) calcolato sulla partita al momento del salvataggio: per ogni tessera, in ordine, posizione, disegno, gruppo nascosto, nebbia, oro e se è ancora in tavola, più i gruppi aperti. Dopo la ricostruzione si ricalcola e si confronta: se il generatore, i rimescoli o le regole sono cambiati, la partita non coincide (`board-mismatch`) e si scarta invece di riprendere su una tavola diversa (difetto 5 dell'originale).

**Progressi** (`serializeProgress`, `parseProgress`): `Progress` serializzato con versione, oggi 1. In JSON le chiavi di `levels` sono stringhe: devono essere interi positivi in forma canonica (`3`, non `03`). La lettura valida forma e valori (stelle 0-3, record di tempo `null` o numero non negativo, oro e ✨ interi non negativi, profilo `null` o noto, regali come testi non vuoti e senza duplicati), rifiuta campi mancanti o in più e restituisce errori tipizzati, senza correggere nulla di nascosto.

**Porta `SaveStore`** (asincrona): `loadProgress` e `saveProgress`; `loadGame`, `saveGame` e `clearGame`; `finishGame(progress)` (scrive i progressi e cancella la partita insieme); `resetAll()` (progressi iniziali e partita cancellata insieme). Ogni operazione restituisce un `Result` con `SaveError`, non un'eccezione; senza dati salvati `loadProgress` dà i progressi iniziali e `loadGame` dà `null`. `createMemorySaveStore({ progress, game })` è la versione in memoria per i test e per sviluppare la UI: tiene i testi serializzati come un archivio vero, quindi passa dagli stessi codec, e accetta contenuti iniziali scritti a mano, anche illeggibili. Non produce mai `storage-failed`.

**Archiviazione SQLite** (`createSqliteSaveStore`, `src/infrastructure/storage/`): `expo-sqlite` dietro l'interfaccia minima `SqlDatabase` (`exec`, `run`, `first`, `transaction`), con un solo database, `majoa.db`, e una tabella `save(slot, json)` con due righe al massimo: `progress` e `game`, con lo stesso JSON dei codec. Lo schema ha una versione (`PRAGMA user_version`, il numero di migrazioni già applicate): al primo uso `migrate` applica in una sola transazione le migrazioni mancanti di `MIGRATIONS`, tutte o nessuna; se fallisce, l'operazione dà `storage-failed` e la successiva riprova. Un database con versione più recente dell'app non si tocca: ogni operazione dà `unsupported-version`. Le operazioni vanno in coda una alla volta, nell'ordine di arrivo, così una transazione non si mescola con altre scritture; `finishGame` e `resetAll` sono una transazione; ogni eccezione del database diventa `storage-failed` col suo messaggio, senza correggere né cancellare nulla. L'adattatore `wrapExpoSqlite` si verifica solo in compilazione, contro i tipi di `expo-sqlite`: sul dispositivo non è provato. Per i test, `createNodeSqliteDatabase` (`__fixtures__`) usa un SQLite vero con `node:sqlite` (Node 22.13 o successivo; il file di test dichiara `@jest-environment node`).

### Logica senza interfaccia

`src/application/saveFlow.ts` collega l'archivio alle scelte della UI, senza React:

- **`loadHome(store)`** legge progressi e partita in corso, indipendenti l'uno dall'altra. La partita è `none`, `ready` (con la sessione ricostruita e `ResumeInfo`: livello, profilo, secondi, tessere rimaste, per la scheda «Continua») o `broken` (con l'errore e, se il documento si leggeva ma non si ricostruiva, il `SavedGame` letto: così «Ricomincia» sa livello e profilo).
- **`planStart(resume)`** dice se partire subito o chiedere conferma: con una partita `ready` chiede sempre conferma, anche per lo stesso livello e profilo (riprendere è un'altra strada); con `none` o `broken` parte subito.
- **`createAutosaver(store, levelId, onTrouble)`** salva la partita a ogni chiamata. Un errore non interrompe il gioco: `onTrouble(true)` scatta al secondo errore di fila, una sola volta, e `onTrouble(false)` al primo salvataggio riuscito dopo.
- **`finishWin(store, progress, session, levelId, islands)`** registra la vittoria (`recordWin`), dà i regali delle isole appena aperte (`openGifts`) e scrive progressi e cancellazione della partita con `finishGame`. Restituisce i progressi nuovi, le ricompense (stelle, ✨, «nuovo record», regali) e l'esito della scrittura. «Nuovo record» solo se esisteva un record e il tempo lo migliora, e mai con «senza pressione del tempo». Se la scrittura fallisce i progressi e le ricompense si danno comunque, la partita salvata resta com'era e i progressi su disco sono quelli di prima: giocando di nuovo l'ultima mossa si rivince.
- La partita bloccata (`dead`) non ha una funzione: la UI chiama `clearGame()`.

Una sessione ricostruita già vinta o bloccata (solo se l'app si è chiusa tra l'ultima mossa e la chiusura della partita) non è un caso a parte: la UI avvia la chiusura quando la fase diventa `won` o `dead`, anche al primo disegno.

### Stati ed errori

| Errore (`SaveError`) | Quando | Cosa vede il giocatore | Dati |
|---|---|---|---|
| nessuno (`null`) | Non c'è una partita salvata | Home senza «Continua» | — |
| `unsupported-version` | Versione del formato o dello schema sconosciuta (per esempio più recente) | Come «illeggibile» | La partita non si cancella da sola; un database più recente dell'app non si tocca |
| `malformed` (con il campo) | JSON non valido, campo mancante o di tipo o valore sbagliato | «Non riesco a riprendere questa partita» e «Ricomincia» | I progressi restano intatti |
| `start-failed` | Il generatore non rigenera la tavola | Come sopra | Come sopra |
| `event-rejected` (con la posizione) | Un evento non si applica | Come sopra | Come sopra |
| `board-mismatch` | L'impronta dopo la ricostruzione non coincide | Come sopra | Come sopra |
| `storage-failed` | Lettura o scrittura su disco non riuscita (disco pieno, file bloccato, migrazione fallita) | Il gioco continua; avviso breve al secondo errore di fila | Nessuna scrittura parziale: le scritture multiple sono transazioni |

I progressi illeggibili (`malformed` o `unsupported-version` nella lettura dei progressi) non si sovrascrivono mai in automatico.

### Decisioni prese

1. **Fine partita**: vittoria e blocco cancellano la partita salvata.
2. **«Ricomincia»**: scarta la partita illeggibile e riavvia lo stesso livello e profilo con un seme nuovo se si leggono ancora, altrimenti torna alla home.
3. **Progressi illeggibili**: messaggio che lo dice con «Riprova» e «Riparti da zero»; la seconda spiega cosa si perde e ha come scelta predefinita quella sicura.
4. **Scrittura non riuscita**: la porta segnala l'errore (`storage-failed`) e il gioco non si interrompe; avviso breve solo al secondo errore di fila.

### Proposte per la UI

Scelte visibili al giocatore da confermare prima di costruirle:

1. **Home**: in cima la scheda «Continua» (titolo «Livello 20», sotto «Normale · 4:12 · 40 tessere»), poi il selettore dei livelli. Senza partita salvata la scheda non c'è.
2. **Conferma di sostituzione**: titolo «Hai una partita in corso», testo «La partita del livello 20 (Normale, 4:12) andrà persa.», pulsanti «Continua quella» (predefinito, riprende la salvata) e «Sostituisci».
3. **Vittoria**: stelle e tempo; «Nuovo record!» solo se si migliora un record esistente (alla prima vittoria no); «+N ✨»; per ogni isola aperta «Isola Animali aperta: +G ✨». Pulsanti «Rigioca» e «Livelli» come oggi.
4. **Partita illeggibile** (nella home): «Non riesco a riprendere la partita salvata» e «Ricomincia».
5. **Progressi illeggibili**: schermata «Non riesco a leggere i tuoi progressi» con «Riprova» e «Riparti da zero»; quest'ultima apre «Perderai stelle, record e ✨» con «Annulla» (predefinito) e «Cancella tutto».
6. **Avviso di salvataggio**: striscia «Non riesco a salvare la partita» al secondo errore di fila, che sparisce al primo salvataggio riuscito.
7. **Selettore**: stelle sotto ogni livello; lucchetto 🔒 con il motivo toccandolo («Servono 40 ★ per aprire Animali», «Vinci il livello 19 per aprire questo»); interruttore «Modalità prova: tutti i livelli aperti», acceso all'inizio.
8. **Quando si salva**: dopo ogni mossa, aiuto, annulla o rimescolo e quando l'app va in secondo piano; non quando la partita è vinta o bloccata. In secondo piano il tempo non corre.

## Punti d'ingresso nel codice

| Elemento | Percorso | Ruolo |
|---|---|---|
| `SavedGame`, `toSavedGame()`, `restoreSession()`, `serializeSavedGame()`, `parseSavedGame()` | `src/application/savedGame.ts` | Formato della partita salvata, ricostruzione con controllo dell'impronta, lettura e scrittura |
| `serializeProgress()`, `parseProgress()` | `src/application/progressCodec.ts` | Serializzazione e validazione dei progressi |
| `SaveError`, `isInt()`, `keysMismatch()`, `parseJson()` | `src/application/saveFormat.ts` | Errori tipizzati e predicati comuni di lettura |
| `SaveStore`, `createMemorySaveStore()` | `src/application/saveStore.ts` | Porta di archiviazione e versione in memoria |
| `loadHome()`, `planStart()`, `createAutosaver()`, `finishWin()` | `src/application/saveFlow.ts` | Logica dei salvataggi senza interfaccia |
| `fingerprint()`, `boardFingerprint()` | `src/domain/fingerprint.ts` | Impronta a 64 bit e impronta della tavola |
| `Session.base` | `src/application/session.ts` | Specifica di partenza, senza profilo |
| `SqlDatabase`, `SqlValue` | `src/infrastructure/storage/sqlDatabase.ts` | Interfaccia minima di un database SQL |
| `wrapExpoSqlite()`, `openExpoSqliteDatabase()` | `src/infrastructure/storage/expoSqliteDatabase.ts` | Adattatore di `expo-sqlite` (solo compilato) |
| `createSqliteSaveStore()`, `migrate()`, `MIGRATIONS` | `src/infrastructure/storage/sqliteSaveStore.ts` | Archivio SQLite con migrazioni |
| `createNodeSqliteDatabase()` | `src/infrastructure/storage/__fixtures__/nodeSqliteDatabase.ts` | `SqlDatabase` su `node:sqlite`, per i test |
| `describeSaveStore()` | `src/application/__fixtures__/saveStoreContract.ts` | Test comuni a ogni archivio |

## Vincoli e scartato

- Una sola partita salvata. Non usare più partite in parallelo.
- Nessun pulsante «Salva» e nessuna conferma all'uscita: nulla si perde.
- Non salvare le tessere: la partita si ricostruisce. L'originale le salvava una per una e non controllava la tavola.
- Non cambiare il generatore a parità di seme (`legacyGolden.test.ts`), il seme derivato dei rimescoli né l'ordine degli eventi senza una decisione esplicita: le partite salvate si ricostruiscono da lì.
- Il tempo non è un evento: si salva a parte in `seconds`.
- Una migrazione già pubblicata non si modifica: se ne aggiunge un'altra in fondo a `MIGRATIONS`.
- Non scrivere sul database senza passare dall'archivio: le operazioni vanno in coda una alla volta, e una transazione di `expo-sqlite` (`withTransactionAsync`) non è esclusiva rispetto ad altre query.
- Non cambiare l'algoritmo di `fingerprint()`: lo fissano `legacyGolden.test.ts` e le partite salvate.
- Non salvare la specifica con il profilo applicato (`Session.spec`): si salva `Session.base`. Il numero del livello (`levelId`) lo passa chi chiama `toSavedGame`.
- Il dominio non legge l'orologio: nessun timestamp nella partita salvata.
- Un cambio di formato è una migrazione con nuova versione, mai una lettura tollerante.
- Non usare MMKV, AsyncStorage o file JSON: niente transazioni né schema (README, sezione 5).

## Verifica

- **Coperto da test**: impronta (`src/domain/fingerprint.test.ts`, 13 test: valori fissi dell'algoritmo, ogni attributo della tessera, quale tessera è uscita, parti delimitate); partita salvata (`src/application/savedGame.test.ts`, 97 test: `toSavedGame`, ricostruzione con sei profili, a metà e a fine partita, partita vinta, `event-rejected`, `start-failed` e `board-mismatch`, lettura con ogni campo mancante, in più o fuori intervallo, versioni); progressi (`progressCodec.test.ts`, 46 test); archivio in memoria (`saveStore.test.ts`, 10 test: vuoto, scritture e letture, `finishGame`, `resetAll`, contenuti illeggibili); 100 livelli dell'originale salvati, letti e ricostruiti, a metà con sei profili e a fine partita con Normale e Maestro (`src/infrastructure/content/legacySave.test.ts`, 2 test); logica dei salvataggi (`src/application/saveFlow.test.ts`, 27 test: home con partita pronta, illeggibile o non ricostruibile, progressi illeggibili, conferma, regola dei due errori di fila, fine partita con record, oro, regali una volta sola e scrittura fallita); archivio SQLite su un SQLite vero (`src/infrastructure/storage/sqliteSaveStore.test.ts`, 27 test: i 10 comuni a ogni archivio, schema e migrazioni (parziali, fallite, database più recente), righe, errori di scrittura, `finishGame` e `resetAll` tutto o niente, operazioni in coda). `expo export` per Android riesce e `expo-doctor` offline passa 19 controlli su 21 (gli altri due richiedono la rete). Sensibilità controllata introducendo 117 difetti di proposito: 114 rilevati; i 3 sopravvissuti sono equivalenti (il `;` dopo `alive` nell'impronta, perché `alive` è una sola cifra e la stringa resta non ambigua; una modifica che cambia solo i tipi; il valore di riserva di `PRAGMA user_version`, che restituisce sempre una riga).
- **Come eseguirli**: `npx jest src/application src/domain/fingerprint src/infrastructure/storage src/infrastructure/content/legacySave` (Node 22.13 o successivo per l'archivio SQLite).
- **Non verificato**: l'adattatore di `expo-sqlite` su un dispositivo (compilato soltanto), in particolare il comportamento di `withTransactionAsync` e la versione di SQLite inclusa, che può differire da quella di `node:sqlite`; l'esperienza descritta (nessuna parte è collegata alla UI); le proposte per la UI, non ancora confermate; il tempo in secondo piano. Per l'originale, sezione 12 di `docs/gioco-originale.md`, letta dal codice.

## Collegamenti

- `docs/ux.md`: principi di interazione da cui discende l'esperienza.
- `docs/sessione-di-gioco.md`: ricostruzione da eventi (`replaySession`).
- `docs/motore-livelli.md`: progressi, sblocco e regali.
- `docs/gioco-originale.md`: sezione 12 (salvataggi dell'originale) e difetti 1, 3 e 5.
- README, sezioni 5 e 8: decisioni correlate e punti in sospeso.
