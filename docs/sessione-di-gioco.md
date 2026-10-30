# Sessione di gioco

> **Stato: DRAFT.** Il capitolo descrive `src/application/session.ts` così com'è: una partita in corso, senza interfaccia. Schermata, suoni, animazioni, salvataggio su disco e progressi per livello non esistono ancora (README, sezione 8).

Questo capitolo spiega la sessione di gioco: come si rappresenta una partita in corso, cosa fa ogni azione del giocatore e come una partita si ricostruisce da specifica, seme ed eventi. Si legge prima di toccare `src/application/` o di collegare la schermata di gioco.

## Cosa fa

La sessione mette insieme i pezzi del dominio (`docs/dominio-di-gioco.md`) in una partita: selezione delle tessere, mosse, Aiuto, Annulla, Mischia, rimescolo automatico, tempo e vittoria con le stelle. Non disegna, non ha timer, non scrive su disco e non conosce suoni o animazioni: restituisce per ogni azione una nuova sessione e un `feedback` che l'interfaccia traduce in suoni ed effetti. I ritardi (per esempio l'avviso prima del rimescolo automatico) sono dell'interfaccia.

## Come funziona

### Modello

`Session` è un valore immutabile. Contiene la specifica con il profilo già applicato (`spec`), il profilo, il seme e `noTimePressure`; la partita (`game`, un `GameState`); la cronologia degli stati precedenti per Annulla (`history`); la selezione (`selected`); gli aiuti rimasti (`left`, con `null` = illimitati) e quelli usati (`aidsUsed`); i rimescoli automatici gratuiti rimasti (`freeShuffles`); i secondi (`seconds`); la fase (`phase`: `playing`, `won` o `dead`); l'esito della vittoria (`outcome`) e il registro degli eventi (`events`). `startSession({ spec, profile, seed, noTimePressure })` applica il profilo, genera la tavola con il seme e restituisce `Result<Session, GenError>`.

### Azioni e feedback

| Azione | Effetto | Feedback |
|---|---|---|
| `tap(sessione, tessera)` | Tessera già tolta o inesistente, o partita finita: nulla. Nascosta o non libera: rifiutata, la selezione resta (si controlla prima «nascosta»). Già selezionata: deseleziona tutto. Dello stesso tipo della prima selezionata: completa il gruppo (nei Tris serve una seconda tessera) e lo toglie. Di tipo diverso: sostituisce la selezione. | `ignored`, `rejected` (`locked` o un `MoveError`), `deselected`, `selected`, `matched`, `mismatch` |
| `playGroup(sessione, gruppo)` | Toglie un gruppo con le regole di `applyMove`, lo aggiunge alla cronologia e registra l'evento; se è l'ultimo, la partita è vinta. | `matched` (gruppo, se ha aperto un gruppo nascosto, tessere d'oro prese) o `rejected` |
| `hint` | Suggerisce `findMove`, consuma un uso e conta come aiuto, senza toccare la selezione. Senza usi rimasti non fa nulla. Senza mosse possibili avvia `rescue` e non consuma l'Aiuto. | `hint` (gruppo), `no-aid-left`, oppure il feedback di `rescue` |
| `undo` | Ripristina lo stato precedente (anche lo sblocco di un gruppo e le tessere d'oro), consuma un uso e conta come aiuto. Si controlla prima la cronologia, poi gli usi. | `undone`, `nothing-to-undo` (con `afterShuffle`), `no-aid-left` |
| `shuffle` | Mischia: riassegna i disegni delle rimaste (`reshuffle`), consuma un uso, conta come aiuto e azzera cronologia e selezione. Con meno di 2 tessere non fa nulla. | `shuffled`, `shuffle-failed`, `no-aid-left`, `ignored` |
| `rescue` | Rimescolo automatico, solo se non c'è nessuna mossa: gratuito, non conta come aiuto, consuma un rimescolo gratuito del profilo, azzera cronologia e selezione. | `rescued`, `advice`, `dead`, oppure `ignored` se una mossa esiste |
| `tick(sessione, secondi)` | Aggiunge tempo solo mentre si gioca. | — |

`isStuck(sessione)` dice se la partita è senza mosse: dopo ogni mossa l'interfaccia lo controlla, mostra l'avviso e, dopo il ritardo, chiama `rescue`. `goldCount(sessione)` dà le tessere d'oro prese e totali, ricavate dallo stato.

### Aiuti e profili

Gli aiuti iniziali e i rimescoli gratuiti vengono dal profilo (`applyProfile` e `PROFILE_RULES`). Aiuto, Annulla e Mischia consumano un uso (se non illimitato) e fanno salire `aidsUsed`; il rimescolo automatico consuma solo i gratuiti. Nell'originale dopo una Mischia o un rimescolo non si annulla più: `afterShuffle` resta vero e spiega perché Annulla non ha nulla da annullare.

### Rimescolo automatico e fine della partita

`rescue` esaurisce le vie in quest'ordine. Se restano rimescoli gratuiti (o sono illimitati), rimescola. Se sono finiti, o se il rimescolo non riesce, consiglia Mischia (`advice` con `use: 'shuffle'`) finché ne restano; poi Annulla (`use: 'undo'`) se c'è cronologia e usi; altrimenti la partita passa a `dead` e il tempo si ferma.

### Fine partita

Quando si toglie l'ultima tessera la fase diventa `won` e `outcome` contiene stelle (`starsFor`), secondi, aiuti usati e oro preso e totale. A partita finita tutte le azioni sono ignorate. Le ✨ della vittoria dipendono dai progressi precedenti del livello (`coinsForWin`) e le calcola chi conserva i progressi.

### Ricostruzione da eventi

Ogni azione che cambia la partita aggiunge un evento (`move` con il gruppo, `hint`, `undo`, `shuffle`, `rescue`); selezioni, azioni rifiutate e consigli non lo aggiungono. `replaySession(ingresso, eventi, secondi)` riparte da `startSession` e riapplica gli eventi con le stesse funzioni: ricostruisce la stessa partita, perché i rimescoli usano un seme derivato `hashSeed(seme, 'reshuffle', numero di rimescoli)`. Se un evento non si applica restituisce `event-rejected` con la posizione. I secondi non sono un evento: si passano a parte, perché servono alle stelle di una vittoria. Una partita `dead` si ricostruisce fino all'ultima azione: resta senza mosse e `rescue` la riporta a `dead`, perché «bloccata» non è un evento ma l'effetto di `rescue` su uno stato senza vie d'uscita.

## Punti d'ingresso nel codice

| Elemento | Percorso | Ruolo |
|---|---|---|
| `startSession()`, `Session`, `Feedback`, `Step` | `src/application/session.ts` | Nuova partita e tipi |
| `tap()`, `playGroup()` | `src/application/session.ts` | Selezione e mosse |
| `hint()`, `undo()`, `shuffle()`, `rescue()` | `src/application/session.ts` | Aiuti e rimescolo automatico |
| `tick()`, `isStuck()`, `goldCount()` | `src/application/session.ts` | Tempo e stato derivato |
| `replaySession()`, `SessionEvent` | `src/application/session.ts` | Ricostruzione da eventi |
| `playRandomSession()`, `snapshot()` | `src/application/__fixtures__/play.ts` | Partite casuali e confronti nei test |

## Vincoli e scartato

- La sessione usa solo il dominio: non importa React Native, Expo né l'infrastruttura.
- Nessun timer, ritardo o accesso a disco nella sessione: l'interfaccia chiama `tick` e, dopo l'avviso, `rescue`.
- Ogni azione restituisce una nuova sessione e non modifica quella ricevuta. Le funzioni non iniziano con `use`: le regole degli hook di React le leggerebbero come hook.
- Un evento si registra solo se cambia la partita. Non cambiare il seme derivato dei rimescoli né l'ordine degli eventi senza una decisione esplicita: le partite salvate si ricostruiranno da lì.
- Se un rimescolo non riesce (`generation-failed`) la Mischia non consuma nulla e il rimescolo automatico passa ai consigli; cosa fare se capitasse davvero è da decidere (nei test non succede mai).

## Verifica

- **Coperto da test**: 33 test in `src/application/session.test.ts` su partite generate (selezione e rifiuti, gruppi nascosti e stelle, Tris, Aiuto, Annulla, Mischia, rimescolo automatico e consigli fino alla partita bloccata, vittoria, stelle per tempo e aiuti, tempo, immutabilità, ricostruzione da eventi con tre profili, errori). `src/infrastructure/content/legacySession.test.ts` gioca a caso partite complete su tutti i 100 livelli: 100 con Normale (tutte vinte) e 200 con Difficile e Maestro (una sola finisce bloccata), controllando che i contatori degli aiuti coincidano con gli eventi, che le stelle e l'oro siano quelli attesi, che una partita bloccata non avesse vie d'uscita e che ogni partita si ricostruisca dagli eventi. Sensibilità controllata introducendo 22 difetti di proposito: tutti rilevati.
- **Come eseguirli**: `npx jest src/application src/infrastructure/content/legacySession`.
- **Non verificato**: come la partita si gioca davvero (nessuna schermata ancora; i test giocano a caso); il ritardo dell'avviso prima del rimescolo e la reazione dell'interfaccia; il caso di un rimescolo che non riesce.

## Collegamenti

- `docs/dominio-di-gioco.md`: tessere, `applyMove`, mossa suggerita, Mischia, profili e stelle usati dalla sessione.
- `docs/gioco-originale.md`: sezioni 6 e 7, regole di aiuti, rimescolo, stelle e ✨ da cui deriva.
- README, sezioni 5 e 8: decisioni correlate e punti in sospeso.
