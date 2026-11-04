# Salvataggi

> **Stato: DRAFT, nessun codice.** Il capitolo descrive l'esperienza e il modello decisi per i progressi e la partita in corso; i nomi nel codice sono quelli previsti. Si aggiorna a ogni passo di costruzione (formato, archiviazione, collegamento alla UI). I principi generali di interazione sono in `docs/ux.md`.

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

**Partita salvata** (`SavedGame`, JSON con numero di versione del formato): `levelId` (il numero del livello nei progressi, che serve a `recordWin` e alla scheda «Continua»; `LevelSpec.id` è una stringa come `legacy-20` e non si interpreta), `spec` (la specifica di base, senza il profilo applicato), `profile`, `seed`, `noTimePressure`, `events`, `seconds` e `fingerprint`. Le tessere non si salvano: la partita si ricostruisce con `replaySession(ingresso, eventi, secondi)` (`docs/sessione-di-gioco.md`), che riparte da specifica, profilo e seme e riapplica gli eventi. Si salva la specifica e non solo il numero del livello perché la partita non dipende da contenuti che cambiano dopo.

**Impronta della tavola**: valore a 64 bit (due FNV-1a a 32 bit con moltiplicatori diversi, come in `legacyGolden.test.ts`) calcolato sulla partita al momento del salvataggio: per ogni tessera, in ordine, posizione, disegno, gruppo nascosto, nebbia, oro e se è ancora in tavola, più i gruppi aperti. Dopo la ricostruzione si ricalcola e si confronta: se il generatore, i rimescoli o le regole sono cambiati, la partita non coincide e si scarta invece di riprendere su una tavola diversa (difetto 5 dell'originale).

**Progressi**: `Progress` serializzato con versione. In JSON le chiavi di `levels` sono stringhe: la lettura le riconverte in interi e rifiuta le altre. La lettura valida forma e valori (stelle 0-3, tempi e ✨ non negativi, profilo noto, regali senza duplicati) e restituisce errori tipizzati, senza correggere nulla di nascosto.

**Porta `SaveStore`** (asincrona): leggere e scrivere i progressi; leggere, scrivere e cancellare la partita; `finishGame(progress)` (scrive i progressi e cancella la partita insieme); `resetAll()` (progressi predefiniti e partita cancellata insieme). Ogni operazione restituisce un valore con l'errore tipizzato, non un'eccezione. Esiste una versione in memoria per i test e per sviluppare la UI.

**Archiviazione** (passo successivo): SQLite con `expo-sqlite` dietro l'interfaccia minima `SqlDatabase`; schema versionato con migrazioni; `finishGame` e `resetAll` in una transazione. L'adattatore di `expo-sqlite` si verifica solo in compilazione: sul dispositivo non è provato. Per i test si usa un SQLite vero.

### Stati ed errori

| Errore (`SaveError`) | Quando | Cosa vede il giocatore | Dati |
|---|---|---|---|
| nessuno (`null`) | Non c'è una partita salvata | Home senza «Continua» | — |
| `unsupported-version` | Versione del formato sconosciuta (per esempio più recente) | Come «illeggibile» | La partita non si cancella da sola |
| `malformed` (con il campo) | JSON non valido, campo mancante o di tipo o valore sbagliato | «Non riesco a riprendere questa partita» e «Ricomincia» | I progressi restano intatti |
| `start-failed` | Il generatore non rigenera la tavola | Come sopra | Come sopra |
| `event-rejected` (con la posizione) | Un evento non si applica | Come sopra | Come sopra |
| `board-mismatch` | L'impronta dopo la ricostruzione non coincide | Come sopra | Come sopra |
| `storage-failed` | Lettura o scrittura su disco non riuscita | Vedi decisioni aperte | Nessuna scrittura parziale: le scritture multiple sono transazioni |

I progressi illeggibili (`malformed` o `unsupported-version` nella lettura dei progressi) non si sovrascrivono mai in automatico.

### Decisioni aperte

Proposte da confermare prima di costruire il passo c:

1. **Fine partita**: vittoria e blocco cancellano la partita salvata. Se l'app si chiude tra l'ultima mossa e la registrazione, la ricostruzione dà una partita già vinta e l'interfaccia registra l'esito come dopo una vittoria normale.
2. **«Ricomincia»**: scarta la partita illeggibile e riavvia lo stesso livello e profilo con un seme nuovo se si leggono ancora, altrimenti torna alla home.
3. **Progressi illeggibili**: messaggio che lo dice con «Riprova» e «Riparti da zero»; la seconda spiega cosa si perde e ha come scelta predefinita quella sicura.
4. **Scrittura non riuscita**: il salvataggio automatico non interrompe il gioco; dopo un secondo errore consecutivo compare un avviso breve e non bloccante.

## Punti d'ingresso nel codice

Nessun codice oggi. Percorsi e nomi previsti:

| Elemento | Percorso | Ruolo |
|---|---|---|
| `SavedGame`, `toSavedGame()`, `restoreSession()`, `boardFingerprint()` | `src/application/savedGame.ts` | Formato della partita salvata e ricostruzione con controllo dell'impronta |
| `serializeProgress()`, `parseProgress()`, `SaveError` | `src/application/progressCodec.ts` | Serializzazione e validazione dei progressi |
| `SaveStore`, `createMemorySaveStore()` | `src/application/saveStore.ts` | Porta di archiviazione e versione in memoria |
| `SqlDatabase`, adattatori, migrazioni | `src/infrastructure/storage/` | SQLite |

## Vincoli e scartato

- Una sola partita salvata. Non usare più partite in parallelo.
- Nessun pulsante «Salva» e nessuna conferma all'uscita: nulla si perde.
- Non salvare le tessere: la partita si ricostruisce. L'originale le salvava una per una e non controllava la tavola.
- Non cambiare il generatore a parità di seme (`legacyGolden.test.ts`), il seme derivato dei rimescoli né l'ordine degli eventi senza una decisione esplicita: le partite salvate si ricostruiscono da lì.
- Il tempo non è un evento: si salva a parte in `seconds`.
- Il dominio non legge l'orologio: nessun timestamp nella partita salvata.
- Un cambio di formato è una migrazione con nuova versione, mai una lettura tollerante.
- Non usare MMKV, AsyncStorage o file JSON: niente transazioni né schema (README, sezione 5).

## Verifica

- **Coperto da test**: nulla, perché non c'è codice.
- **Non verificato**: tutto il capitolo. Un confronto con l'originale: sezione 12 di `docs/gioco-originale.md`, letta dal codice.

## Collegamenti

- `docs/ux.md`: principi di interazione da cui discende l'esperienza.
- `docs/sessione-di-gioco.md`: ricostruzione da eventi (`replaySession`).
- `docs/motore-livelli.md`: progressi, sblocco e regali.
- `docs/gioco-originale.md`: sezione 12 (salvataggi dell'originale) e difetti 1, 3 e 5.
- README, sezioni 5 e 8: decisioni correlate e punti in sospeso.
