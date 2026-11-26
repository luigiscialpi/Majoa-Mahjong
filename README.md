# Majoa Mahjong

Questo documento è la memoria tecnica sintetica del progetto: descrive **com'è fatto oggi**, non come ci si è arrivati (la storia delle modifiche è nel log di git). Serve a chi subentra, persona o assistente IA, per capire in pochi minuti cosa esiste, dove si trova e dove approfondire. I dettagli stanno nei capitoli di `docs/`, richiamati dalle tabelle qui sotto.

Per ripartire:

1. Leggere questo file per intero.
2. Aprire i capitoli di `docs/` relativi all'area su cui si lavora, scegliendoli dalla sezione 2 o dalla sezione 7.
3. Seguire le regole di lavoro di `AGENTS.md`.

---

## 1. Panoramica

La sezione dichiara il *perché* prima del *cosa* e fissa i confini del progetto, per evitare funzionalità non richieste.

- **Scopo (PERCHÉ)**: portare su Android il gioco di abbinamento tessere in stile mahjong «Majoa Mahjong», nato come gioco HTML/CSS/JavaScript, riscrivendolo da zero (il vecchio codice è solo riferimento per grafica e funzionalità) e aggiungendo un motore di livelli infiniti, organizzati in isole da 20 livelli e ampliabili con nuovi contenuti. iOS escluso: non è previsto un rilascio su App Store.
- **Piattaforme e stack**: Android (telefoni e tablet; target unico; iOS escluso dal rilascio), interfaccia sempre in verticale. Expo SDK 57, TypeScript `strict`, React Native Skia, Reanimated.
- **Stato**: `DRAFT`. Esistono la documentazione, la copia dell'originale in `reference/majoa-originale/` e tutti i 5 prototipi di validazione (S1 rendering, S2 audio, S3 layout, S4 motore dei livelli, S5 OTA) in `prototipi/`; l'app usa Expo Router e Jest; `src/domain/` contiene il nucleo del dominio con test e `src/infrastructure/content/` i 100 livelli originali con disegni e tavolozze. La mappa mostra le sette isole da 20 livelli, numerate in sequenza; dalla prima isola generata in poi i livelli usano forme originali verificate, temi ciclici e difficoltà crescente fino a 14 tipi. Codice e verifica sono elencati nella sezione 2.
- **Fuori ambito**: layout orizzontale; account e sincronizzazione cloud; banner pubblicitari in partita; mediazione con altre reti pubblicitarie; destinazione dell'app ai bambini.

## 2. Funzionalità

Ogni funzionalità ha una riga: cosa fa, in che stato è, dove si trova nel codice e quale capitolo la spiega. La tabella è l'indice da cui partire per cercare qualcosa. Stato `TO DO`: nessun codice, il capitolo indicato descrive il comportamento dell'originale o il modello deciso. Stato `PARZIALE`: logica di dominio implementata e testata, senza interfaccia; la colonna *Codice* dice dove.

| Funzionalità | Stato | Cosa fa | Codice | Capitolo |
|---|---|---|---|---|
| Tavola e abbinamento | PARZIALE | tessera libera, coppie (tris nei livelli Tris), `applyMove`, layout sullo schermo, `hitTest`, selezione (sessione) e disegno della tavola in Skia, provati su dispositivo Android reale | `src/domain/geometry.ts`, `gameState.ts`, `board.ts`, `src/ui/TileBoard.tsx` | `docs/dominio-di-gioco.md`, `docs/rendering.md`, `docs/gioco-originale.md` |
| Motore dei livelli | PARZIALE | `LevelSpec`, generazione risolvibile con seme e solver; 100 livelli originali, 50 livelli generati per completare la campagna e livelli infiniti generati su richiesta da forme originali; curva dell'indice numerico ancora `TO DO` | `src/domain/types.ts`, `generator.ts`, `solver.ts`, `prng.ts`; `src/infrastructure/content/legacyLevels.ts`, `campaignLevels.ts` | `docs/motore-livelli.md`, `docs/dominio-di-gioco.md` |
| Difficoltà | PARZIALE | indice di livello (nove misure, pesi, etichetta 1-5); 6 profili (aiuti, disegni, nebbia, soglie di tempo, bonus); scelta del profilo in Impostazioni e nel selettore (da provare su dispositivo) | `src/domain/difficulty.ts`, `weights.ts`, `profile.ts` | `docs/motore-livelli.md` |
| Isole e progressione | PARZIALE | sette isole da 20 livelli, poi isole generate in sequenza; livelli progressivi, sblocco con 2/3 delle stelle dell'isola precedente e regali ✨ | `src/domain/progress.ts`, `src/infrastructure/content/campaignLevels.ts`, `src/ui/levelStatus.ts` | `docs/motore-livelli.md` |
| Meccaniche speciali | PARZIALE | tessere nascoste, d'oro, nebbiose (rese su tavola con velo scuro e «?», velo chiaro e bordo oro); boss `TO DO` | `src/ui/tile.tsx` | `docs/gioco-originale.md`, `docs/rendering.md` |
| Aiuti | PARZIALE | Aiuto, Annulla, Mischia e rimescolo automatico, con conteggi e limiti per profilo; pulsanti, avvisi e avvio del rimescolo nella schermata, provati su dispositivo; evidenziare le tessere che bloccano `TO DO` | `src/domain/hint.ts`, `reshuffle.ts`, `src/application/session.ts`, `src/ui/GameScreen.tsx` | `docs/dominio-di-gioco.md`, `docs/sessione-di-gioco.md`, `docs/gioco-originale.md` |
| Sessione di gioco | PARZIALE | partita in corso: selezione, mosse, aiuti, tempo (in pausa in secondo piano), vittoria con stelle, rimescolo automatico, ricostruzione da eventi; schermata di gioco provata su dispositivo; suoni e animazioni oltre la rimozione `TO DO` | `src/application/session.ts`, `round.ts`, `src/ui/GameScreen.tsx` | `docs/sessione-di-gioco.md`, `docs/rendering.md` |
| Mappa delle isole e selettore dei livelli | PARZIALE | elenco virtualizzato delle isole aperte e della prossima chiusa; livelli per isola con numero visibile globale e progressivo, identificativi di salvataggio distinti dal numero mostrato; modalità prova e Tris separati | `src/ui/LevelPicker.tsx`, `src/ui/levelStatus.ts`, `src/ui/format.ts`, `src/infrastructure/content/campaignLevels.ts` | `docs/motore-livelli.md`, `docs/ux.md`, `docs/salvataggi.md`, `docs/resa-visiva.md` |
| Stelle, ✨ e record | PARZIALE | 1-3 stelle per tempo e aiuti, ✨ di una vittoria, migliore stella, record di tempo e profilo più alto per livello (`recordWin`); archiviazione dei progressi su disco in SQLite | `src/domain/stars.ts`, `progress.ts` | `docs/dominio-di-gioco.md`, `docs/motore-livelli.md`, `docs/gioco-originale.md` |
| Rompicapi | TO DO | 10 mini-giochi in 3 difficoltà | TO DO | `docs/gioco-originale.md` |
| Album e sfide | PARZIALE | 111 carte in 6 album (5 di tema da 14, «Animali» da 41): formule, ordine fisso, carta del regalo d'isola, salvataggio v3 e collegamento alla vittoria fatti e coperti da test; schermata Album, finestre «Nuova carta» e i dieci rompicapi `TO DO` (telaio comune e logica di Memory fatti: `src/domain/puzzles.ts`, `src/domain/memoryPuzzle.ts`) | `src/domain/album.ts`, `src/infrastructure/content/albumCards.ts`, `src/application/saveFlow.ts` | `docs/gioco-originale.md`, `docs/motore-livelli.md` |
| Resa visiva identica o migliore dell'originale | PARZIALE | tessere (129 disegni, corpo 3D), tavolozze, tipografia (Lora e Nunito con OFL), colori/pannelli a tema (`--felt`, `--ink`, `--accent`, `--btn`) e sfondo della schermata rasterizzato fuori schermo (`FeltBackground`), stati delle tessere (la nebbia in parte), animazioni di sparizione, ingresso e sblocco, combo e scintille; `SparkLayer` si monta solo durante le esplosioni; scheda di vittoria animata (`cardIn`, trofeo `trophy`, stelle `starpop`, fuochi d'artificio, contatore oro e ricompense ✨) e profilata su Samsung Galaxy A36 con smontaggio di `TileBoard` alla vittoria e driver unificati (1,42% frame janky su 2.395 frame, p95 18 ms, p95 GPU 6 ms, 1 solo layer Vulkan attivo e 15,4 MB GPU); mascotte esportate e nella combo; audio e vibrazione integrati con volume regolabile (5 livelli); icona ⚙️ nel LevelPicker e in GameScreen | `src/ui/tile.tsx`, `TileBoard.tsx`, `FeltBackground.tsx`, `SparkLayer.tsx`, `ComboBanner.tsx`, `fireworks.ts`, `FireworksLayer.tsx`, `mascots.tsx`, `MascotMedallion.tsx`, `src/ui/theme/`; icone di controllo monocromatiche | `docs/resa-visiva.md` |
| Mascotte | PARZIALE | 4 mascotte e nessuna: SVG esportati dall'originale con tre ritocchi visivi e nella scritta della combo, Collie predefinita, provate su dispositivo (Samsung Galaxy A36); selettore in Impostazioni (76 px); finestra regalo (92 px con 24 particelle ✨⭐💛 e suono win, `GiftDialog`); album `TO DO` | `tools/export-mascots.js`, `tools/mascot-refinements.js`, `src/domain/mascot.ts`, `src/ui/GiftDialog.tsx`, `assets/mascots/` | `docs/resa-visiva.md`, `docs/gioco-originale.md` |
| Livelli Tris | PARZIALE | un Tris al primo posto di ogni isola dalla seconda (numeri mostrati 21, 41, 61…): la forma del livello sostituito giocata a gruppi di 3, da provare su dispositivo, con la spiegazione prima del livello e la spunta «Non mostrare più» (`IntroDialog`) e l'anticipazione a fine isola (`teaser.ts`); i 10 Tris dell'originale restano fuori dalle isole, in una sala che compare in fondo alla mappa quando si vince il primo Tris del percorso (`isTrisRoomOpen`), con i livelli in sequenza e le stelle a parte; in Modalità prova sempre aperta | `src/infrastructure/content/trisSlots.ts` | `docs/motore-livelli.md` |
| Modalità comoda e accessibilità | PARZIALE | modalità «senior»: layout dedicati a 5 colonne (livelli 1-20), disegni ridotti, niente nebbia, aiuti illimitati, nessun limite di tempo (chip «Comoda» al posto del cronometro), aiuti ingranditi, aiuto automatico dopo 120s; evidenziazione tessere uguali accesa di base, spegnibile e indipendente, con l'avviso «nessuna tessera uguale è libera» (da provare su dispositivo); contrasto alto e segnali daltonismo in partita (da provare su dispositivo) | `src/infrastructure/content/legacyComfortLevels.ts`, `src/domain/settings.ts`, `src/ui/GameScreen.tsx`, `src/ui/contrastSignals.ts` | `docs/gioco-originale.md`, `docs/dominio-di-gioco.md` |
| Salvataggi | PARZIALE | progressi e una sola partita in corso, senza pulsante «Salva»; fatti: formato della partita salvata con impronta della tavola, ricostruzione, codec dei progressi con errori tipizzati, archivio in memoria e archivio SQLite (migrazioni, transazioni, errori di disco), logica senza interfaccia (home, conferma di sostituzione, autosalvataggio, calcolo e scrittura della vittoria), scheda completa con contatore testuale della ricompensa mostrata prima del termine del salvataggio, salvataggio automatico e chiusura della partita nella schermata di gioco, home con «Continua», conferma di sostituzione, errori di lettura e selettore con stelle, lucchetti e modalità prova; provati su dispositivo Android reale | `src/application/savedGame.ts`, `progressCodec.ts`, `saveFormat.ts`, `saveStore.ts`, `saveFlow.ts`, `src/domain/fingerprint.ts`, `src/infrastructure/storage/`, `src/ui/SaveProvider.tsx`, `src/ui/GameScreen.tsx`, `src/ui/HomeScreen.tsx`, `src/ui/ConfirmDialog.tsx` | `docs/salvataggi.md`, `docs/ux.md`, `docs/gioco-originale.md` (originale) |
| Lingue | FATTO | Dizionari type-safe IT, EN, FR per interfaccia, 129 nomi tessere e contenuti localizzati; cambio lingua al volo con React Context e `t(key, params)` fuori da React; selettore rapido, chiavi verificate dal tipo e test di parità/interpolazione. I dizionari si aggiornano direttamente: il generatore citato nelle intestazioni non è presente | `src/infrastructure/i18n/`, `src/ui/SaveProvider.tsx`, `src/ui/HomeScreen.tsx`, `src/ui/LevelPicker.tsx`, `src/ui/GameScreen.tsx`, `src/app/play.tsx`, `src/ui/format.ts`, `src/ui/levelStatus.ts` | `docs/ux.md`, `docs/linee-guida-codice.md`, `docs/gioco-originale.md` (originale) |
| Audio e vibrazione | FATTO | 24 effetti sonori WAV a 44.1 kHz con pool lazy di AudioPlayer (`expo-audio`) e feedback aptico (`expo-haptics`) per tocco, abbinamenti, combo, aiuti, blocco, vittoria, fuochi d'artificio e stelle; volume regolabile (5 step: 0, 25, 50, 75, 100%) tramite `SoundService.setVolume()` | `assets/sounds/`, `src/infrastructure/audio/`, `src/ui/useGameAudio.ts` | `docs/resa-visiva.md`, `docs/gioco-originale.md` (originale) |
| Impostazioni | PARZIALE | scheda della barra in basso; selettore mascotte (76 px con `MascotMedallion`), difficoltà (sei profili), aspetto (sfondo e bordo tessere con 8 palette ciascuno, live preview in FeltBackground e GameScreen), suoni on/off e volume (5 step), vibrazione, effetti speciali, aiuti di gioco, comfort e accessibilità, spiegazioni (rivederle dopo la spunta «Non mostrare più»), lingua, ripristino; persistenza su SQLite; icona ⚙️ nel LevelPicker e in GameScreen; Modalità comoda effettiva con layout 5 colonne, no chrono, aiuti illimitati e aiuto automatico; barra tessere selezionate provata su dispositivo; alto contrasto e daltonismo in partita (da provare su dispositivo) | `src/domain/settings.ts`, `src/infrastructure/content/appearancePalettes.ts`, `src/application/settingsStore.ts`, `src/infrastructure/storage/sqliteSettingsStore.ts`, `src/ui/SettingsProvider.tsx`, `src/ui/SettingsScreen.tsx`, `src/ui/SelectionBar.tsx`, `src/app/settings.tsx` | `docs/gioco-originale.md` sezione 11 |
| Pubblicità | TO DO | AdMob: interstitial a fine livello, rewarded | TO DO | `docs/decisioni-tecniche.md` |
| Aggiornamenti OTA | TO DO | nuove isole, carte, parole e rompicapi senza release | TO DO | `docs/decisioni-tecniche.md` |
| Interfaccia verticale | TO DO | blocco di orientamento e colonna di gioco | TO DO | `docs/decisioni-tecniche.md` |

**Nota:** una funzionalità senza riga in questa tabella, per chi subentra, non esiste. La riga si aggiunge nella stessa consegna in cui nasce il codice.

## 3. Architettura a colpo d'occhio

L'architettura separa la logica dagli effetti collaterali, perché la logica pura si testa senza dispositivo, senza framework e senza rete.

Il progetto è organizzato in quattro livelli:

- **Dominio**: regole e dati del problema. Codice puro, senza I/O e senza dipendenze da framework o UI.
- **Applicazione**: casi d'uso e controller che orchestrano il dominio e coordinano i bordi.
- **Infrastruttura**: tutto ciò che tocca l'esterno (storage, rete, API native, permessi).
- **UI**: rendering e input. Mostra lo stato e inoltra gli eventi, non contiene regole.

Le dipendenze puntano verso il dominio: il dominio non importa nulla dagli altri livelli, e gli effetti collaterali entrano dai bordi, dietro interfacce.

```text
   UI ───────────┐
                 ▼
   Infrastruttura ──► Applicazione ──► Dominio
   (storage, rete,                     (puro, testabile,
    API native)                         nessuna dipendenza)
```

Struttura delle cartelle (`DRAFT`: esistono `src/app/` (barra in basso con Mappa e Impostazioni in `(tabs)`, partita `play` a tutto schermo; Giochi e Album si aggiungeranno), `src/domain/`, `src/application/`, `src/ui/`, `src/infrastructure/` [content, audio, storage, i18n] e `tools/`):

```text
package.json, app.json, tsconfig.json  # configurazione dell'app, nella radice
src/
  app/             # route di Expo Router: solo instradamento, le schermate stanno in ui/
  domain/          # logica pura + test (Jest)
  application/     # casi d'uso, controller
  infrastructure/  # storage, ads, audio, contenuti, API native
  ui/              # schermate, componenti, rendering
docs/              # capitoli di approfondimento
assets/            # icone dell'app e i 129 disegni delle tessere (assets/tiles/, SVG)
reference/         # copia di sola lettura del gioco HTML originale (majoa-originale/)
prototipi/         # prototipi di validazione usa e getta (S1: rendering; S2: audio; S3: layout; S4: motore; S5: OTA)
tools/             # script di esportazione e generazione (tavolozze, indice dei disegni); gli altri sono ancora nei prototipi
```

## 4. Regole essenziali

Mini-contratto vincolante, senza narrazione. Definizioni ed esempi sono in `docs/linee-guida-codice.md`.

1. Il dominio non importa codice di UI, storage o rete.
2. Nessuna funzionalità fuori ambito (sezione 1) o senza riga nell'indice (sezione 2).
3. Gli errori previsti sono valori tipizzati.
4. Ogni semplificazione intenzionale porta il commento `ponytail:`.
5. Ogni dipendenza nuova è motivata nella sezione 5.
6. Il colore non è l'unica informazione in UI.
7. Nessuna modifica viene consegnata senza essere stata provata: in chat, la patch su un clone pulito; con accesso diretto al repository, build e test.
8. Ciò che non è stato verificato viene dichiarato come tale.
9. Il dominio non usa sorgenti non deterministiche (`Math.random()`, `Date.now()`): generatore con seme e orologio entrano come argomenti.
10. I testi visibili o annunciati dell'interfaccia si aggiungono ai dizionari i18n tipizzati e si richiamano con `useTranslation()` in React o `t(key, params)` fuori da React; vedere `docs/linee-guida-codice.md`.

## 5. Decisioni vigenti

Ogni scelta che condiziona il progetto ha una riga: cosa vale oggi, perché, e cosa è stato scartato. Chi subentra non deve ricostruirla né riproporre ciò che è già stato escluso.

| Decisione | Motivo | Scartato e perché |
|---|---|---|
| Expo SDK 57, TypeScript `strict`, development build con EAS, Expo Router; solo Android | stack già in uso; New Architecture obbligatoria; serve una build nativa per gli annunci; S1 è validato sulla 57; identificativo Android `it.luigiscialpi.majoa`; le dipendenze native che Expo Router richiede come peer (`expo-font`, `react-dom`, `react-native-reanimated`, `react-native-worklets`, `react-native-gesture-handler`) sono fissate alle versioni dell'SDK 57 (`bundledNativeModules.json`), come `@shopify/react-native-skia` (2.6.2) per il disegno della tavola; `@testing-library/react-native` (14.1.0) per i test sui componenti UI | non passare per ora alla SDK 58 (uscita il 15/10/2026): da rivalutare al prossimo aggiornamento; non usare Flutter o app native doppie: stack nuovo o due codebase; non avvolgere l'HTML in una WebView: contraddice la riscrittura; non usare Unity o Godot: motore pesante, dominio non riusabile; non rilasciare su iOS: nessun rilascio previsto su App Store; non lasciare che npm risolva da solo i peer di Expo Router: installa le versioni più recenti, fuori SDK (duplicati nativi, `expo-doctor` fallisce); non usare `react-test-renderer` (deprecato in React 19) |
| Quattro livelli; dominio puro con stato immutabile verso l'esterno (`applyMove(stato, gruppo)` restituisce un nuovo stato o un errore tipizzato; solo solver e generatore mutano una copia) | logica testabile senza dispositivo; il solver visita decine di migliaia di stati | non mettere logica nei componenti: non testabile senza renderer; non chiamare `GameState.apply` fuori dal dominio: muta lo stato |
| Obiettivo visivo: la resa dell'app è identica a quella dell'originale o migliore, elemento per elemento; ogni elemento ha un riferimento nell'originale, una riga nell'inventario di `docs/resa-visiva.md` e un confronto con le catture; colori, tempi e curve si copiano dall'originale e dove possibile li legge un test | l'originale è il riferimento di aspetto e di tempi; l'inventario evita di perdere dettagli | un'estetica nuova; abbellire prima di aver provato il rendering su dispositivo, perché ogni elemento animato pesa sul rendering a due strati |
| Sessione di gioco in `application/`: stato immutabile, ogni azione è una funzione che restituisce `{ session, feedback }`, eventi in sola aggiunta per ricostruire la partita da specifica, profilo, seme ed eventi | testabile senza dispositivo, adatta a `useReducer`, base dei salvataggi; il feedback serve a suoni e animazioni | stato mutabile nei componenti; timer e rimescolo automatico dentro la sessione (i ritardi sono dell'interfaccia); funzioni con prefisso `use`, che le regole degli hook leggerebbero come hook |
| Ordine di lavoro: prima la sessione di gioco e la schermata della tavola, poi il resto della sezione 8 (salvataggi, isole e progressione, progressi, profilo e Modalità comoda, decisioni aperte, contenuti) | vedere presto l'app giocabile: i pezzi di dominio rimasti non la bloccano, e una schermata vera dà un riscontro che i test non danno | continuare con salvataggi e isole prima di avere una schermata; perdere i punti in sospeso, che restano tutti elencati nella sezione 8 |
| Livelli descritti da `LevelSpec`, generati con PRNG con seme; campagna dell'originale esportata in JSON | livelli infiniti, test deterministici, porting fedele e verificabile; verificato in S4 (1000 tavole su Android senza fallimenti, solver indipendente) | non usare `Math.random()` senza seme: livelli non riproducibili e risolvibilità non verificabile |
| Sette isole da 20 livelli, poi isole generate riusando forme verificate; tipi di disegno 12, 13, poi 14 come tetto; sblocco con `ρ = 2/3` delle stelle dell'isola precedente (`docs/motore-livelli.md`) | mantiene il viaggio, amplia la campagna e dà un criterio iniziale semplice per la progressione infinita; 40 stelle su 60 per aprire un'isola | non usare soglie cumulative; non usare un solo asse senza isole né una modalità infinita separata |
| Identificativi interni dei livelli distinti dal numero mostrato | i progressi associano stelle e record a un identificativo e alla firma del livello (gruppo e celle): valgono solo sul livello che li ha prodotti, quindi un identificativo si può riusare per un altro livello; i record senza firma, precedenti alle firme, si assumono guadagnati sul livello di prima; la partita salvata porta con sé la propria specifica e non ne dipende; il numero visibile segue l'ordine delle isole e può cambiare quando si aggiungono livelli | cambiare le celle o il gruppo di un livello azzera le sue stelle; ritoccare disegni, nebbia, oro e aiuti no |
| Tavola a due strati in un canvas Skia: strato fermo in un'unica immagine (corpo delle tessere in cache), strato vivo con le sole tessere libere e in rimozione (al massimo circa 30); animazioni Reanimated; tocco risolto da `hitTest` del dominio (`docs/rendering.md`) | misurato su dispositivo: con tutte le tessere dal vivo l'eco col thread UI è 0,7-2,7 s anche con 2 tessere animate, a strati sotto 50 ms | non disegnare tutte le tessere dal vivo con valori condivisi: il costo segue le tessere disegnate, non quelle animate; non usare una vista per tessera con SVG: costo e tocco legato alle viste; non usare sprite PNG: sfocatura su tablet e risorse moltiplicate |
| Fuochi d'artificio con target `FPS=60` e clock a passi di un refresh su display a 60 Hz (`docs/resa-visiva.md`) | Sul Redmi Note 9 Pro, build debug: 56,2-56,5 aggiornamenti del `Picture`/s contro 28,8 a target 30; resa giudicata molto migliore | non mantenere il target 30, visivamente meno fluido; il target 60 non garantisce 60 frame presentati, da verificare con profilo release e GPU |
| Disegni esportati una volta in SVG statici con solo `viewBox`, testi convertiti in tracciati, ritaglio sul riquadro (`docs/rendering.md`) | indipendenti dalla risoluzione; SkSVG non disegna `<text>`, ignora `width` e `height` fissi e non ritaglia | non tenere le stringhe SVG nel codice: non riusabili né testabili; non usare `<text>` né `width` e `height` fissi negli SVG |
| Interfaccia sempre verticale: blocco da configurazione sui telefoni e, con `android:appCategory="game"`, sui tablet Android; su iPad tutte le orientazioni dichiarate e colonna di gioco centrata (rapporto massimo 3:4) | Android 16 e 17 esentano i giochi dalle restrizioni; iPadOS 26 non garantisce il blocco | non usare layout orizzontali con pannelli (esclusi); non usare `supportsTablet: false` (nessun supporto tablet); non usare `UIRequiresFullScreen` (deprecata) |
| Salvataggi in SQLite (`expo-sqlite`): una sola partita salvata, separata dai progressi e salvata da sola (nessun «Salva», nessuna conferma all'uscita); transazioni, migrazioni, partita ricostruibile da specifica, seme ed eventi con impronta della tavola; conferma prima di sostituire; azzeramento in transazione; ricompense calcolate prima dell'I/O e mostrate insieme alla scheda di vittoria (`docs/salvataggi.md`, `docs/ux.md`) | atomicità, versioni, progresso illimitato; il salvataggio fallito lascia i progressi su disco invariati e viene segnalato; corregge i difetti 1, 3 e 5 dell'originale | non usare MMKV, AsyncStorage o file JSON: niente transazioni né schema; non usare Realm o WatermelonDB: eccessivi; non usare un pulsante «Salva» né più partite salvate in parallelo |
| Effetti come campioni con `expo-audio`; vibrazione con `expo-haptics` | funzionano in Expo Go; risorse sostituibili | non usare `react-native-audio-api` come prima scelta: modulo nativo e dipendenza più giovane (piano B se la latenza è alta) |
| Dizionari statici `Locale` type-safe IT/EN/FR; React Context (`LanguageProvider` + `useTranslation`) nei componenti e `t(key, params)` fuori da React; fallback francese | cambio lingua al volo e chiavi mancanti rilevate da TypeScript, senza dipendenze runtime | non usare `expo-localization`: la scelta corrente è manuale; non usare `i18next`: le traduzioni attuali richiedono solo interpolazione semplice |
| App non destinata ai bambini; AdMob con `react-native-google-mobile-ads` dietro `AdsService`; interstitial a fine livello, rewarded per ✨ e aiuti; consenso UMP; nessun banner in partita | momenti naturali del percorso; il dominio non conosce gli annunci | non mettere banner in partita: tocchi accidentali; non aggiungere mediazione: peso e privacy; non usare app a pagamento o abbonamento: contrasta col modello gratuito |
| Contenuti come dati dietro `ContentRepository`; OTA con EAS Update (dati, risorse, JavaScript dei rompicapi); contenuti solo in aggiunta, applicati all'avvio successivo | nuove isole, carte e rompicapi senza una revisione dello store per ciascuno | non aggiornare codice nativo via OTA: impossibile; non chiudere i contenuti nel binario: una release per ogni isola |
| Stato di gioco con Zustand | selettori: il canvas non si ridisegna a ogni cambiamento | non usare Context (ridisegni inutili) né Redux Toolkit (eccessivo) |
| Tipografia con font incorporati (OFL): Lora (serif) per titoli, numeri di livello e timer; Nunito (humanist sans) per testi, chip e pulsanti; centralizzati in `src/ui/theme/typography.ts` | fedeltà stilistica (sostituto moderno di Georgia e Trebuchet MS), resa uniforme su Android, licenza libera OFL e facilità di sostituzione | non usare font di sistema Android: resa difforme e assenza di serif storici; non vincolare i singoli componenti: centralizzare in typography.ts |
| Test: Jest 29 con preset `jest-expo` (e `@react-native/jest-preset`, richiesto da jest-expo 57) sul dominio, test sui semi con il solver, regressione sulla campagna esportata, parità delle lingue; UI e nativo a mano | garanzia di risolvibilità su livelli infiniti | non limitarsi ai test manuali; non introdurre test end-to-end finché la UI cambia di continuo |

**Nota:** quando una decisione cambia, la riga si riscrive: la storia è nel log di git. La colonna *Scartato e perché* si formula come vincolo attuale (es. «non usare X: causa Y»), non come cronologia.

## 6. Verifica

La verifica distingue ciò che è provato da ciò che non lo è: dichiararlo è parte del lavoro.

- **Build e test**: `npm install`, poi `npm test` (Jest, solo `src/`), `npm run typecheck` (`tsc --noEmit`) e `npx expo-doctor`; bundle Android con `npx expo export --platform android`. `expo-doctor` richiede la rete per due controlli (schema di `app.json`, directory di React Native). **Avvio**: l'app non gira più in Expo Go ma in una development build (`expo-dev-client`): `npm run android` (`expo run:android`) compila e installa la build su un dispositivo o emulatore (serve l'SDK Android) e `npm start` apre il bundler per la build; in alternativa `eas build --profile development --platform android` (`eas.json`). La cartella `android/` si genera con `expo prebuild` e non si versiona.
- **Dominio**: test automatici su ogni regola.
- **UI e integrazioni native**: verifica manuale su dispositivo reale e su emulatori di tablet e pieghevole; elenco delle prove e comandi `adb` in `docs/prove-su-dispositivo.md`.

| Area | Come viene verificata | Stato |
|---|---|---|
| Scaffold dell'app | `tsc --noEmit`, `expo export --platform android` (bundle Hermes), `expo-doctor` offline | verificato: 19 controlli su 21 di `expo-doctor` (restano i 2 che richiedono la rete); con la development build (`expo-dev-client`), prebuild nativo, compilazione (`./gradlew installDebug`), avvio e caricamento dal bundler Metro provati con successo su Redmi Note 9 Pro |
| Dominio (`src/domain/`), sessione (`src/application/`) e campagna (`src/infrastructure/content/`) | Jest: `npm run test:all -- --watchman=false --runInBand` su Node 22 | verificato: 1019 test su 80 suite, tutti PASS; comprende i livelli generati 101-170 |
| Schermata di gioco (`src/ui/`) | TypeScript, `expo export --platform android`, build Android release e prova su dispositivo | verificato: typecheck e bundle passano; APK release compilato e avviato su Galaxy A36; mappa 1-9, isola 8 con livelli visibili 141-160 e livello 141 generato con 16 coppie |
| Prototipo S1 (rendering) | `skia-python`, Chromium, test di dominio e prova su un Android (`prototipi/s1-rendering/README.md`) | verificato su un dispositivo Android; tablet e fascia bassa no; iOS escluso dal rilascio |
| Prototipo S4 (motore dei livelli) | Node, 14 test, bundle nativi e prova su un Android con Hermes (`prototipi/s4-generatore/README.md`) | verificato su un dispositivo Android; pesi dell'indice non calibrati su dati di gioco |
| Prototipo S2 (audio) | `expo-audio` e `expo-haptics`, 24 campioni WAV da Chromium, benchmark latenza e combo (`prototipi/s2-audio/README.md`) | verificato su un dispositivo Android con `--no-dev --minify`; latenza combo e polifonia ok, decisione confermata |
| Prototipo S5 (OTA e salvataggi) | Node, 5 test, `expo-updates`, simulazione ripristino e validatore append-only (`prototipi/s5-ota/README.md`) | verificato: 5 test automatici passati; regole 1-4 confermate, gestione sicura di integrità e scarto |
| Prototipo S3 (layout e blocco tablet) | Node, 6 test, config plugin `appCategory="game"`, simulazione colonna 3:4 e tetto tessere (`prototipi/s3-layout/README.md`) | verificato: 6 test passati; plugin validato su prebuild; layout 3:4 e tetto tessere a 60 dp verificati (iOS non prioritario) |
| UI, audio, annunci, tablet | prova manuale su dispositivo | schermata home, mappa, numerazione 141-160 e tavola generata del livello 141 provate sul Galaxy A36; audio e vibrazione già provati; Impostazioni, annunci e tablet da verificare |
| Descrizione dell'originale | lettura del codice ed esecuzione in Chromium; 142 controlli della suite in 8 sezioni su 25 | verificato in parte (`docs/gioco-originale.md`, «Verifica») |

## 7. Capitoli di approfondimento

Ogni capitolo spiega un'area in modo tecnico e aggiornato allo stato attuale. I nomi dei file sono stabili: un capitolo non si rinomina senza aggiornare questa tabella.

| Capitolo | Contenuto | Quando leggerlo |
|---|---|---|
| `docs/linee-guida-codice.md` | Principi di codice con esempi | Prima di scrivere codice |
| `docs/gioco-originale.md` | Regole, livelli, aiuti, punteggi, rompicapi, album, grafica, impostazioni e salvataggi dell'originale; difetti noti | Prima di implementare una funzione che nasce dall'originale |
| `docs/dominio-di-gioco.md` | Tessere, tessera libera, stato di partita, `applyMove`, determinismo (`DRAFT`) | Prima di toccare `src/domain/` |
| `docs/resa-visiva.md` | Obiettivo «identica o migliore», inventario degli elementi visivi con riferimenti nell'originale, metodo di confronto, ordine, decisioni aperte (`DRAFT`) | Prima di toccare l'aspetto di una schermata |
| `docs/sessione-di-gioco.md` | Partita in corso: selezione, aiuti, rimescolo automatico, vittoria, ricostruzione da eventi (`DRAFT`) | Prima di toccare `src/application/` o di collegare la schermata di gioco |
| `docs/salvataggi.md` | Salvataggio automatico, «Continua», conferme, modello della partita salvata e dei progressi, stati ed errori (`DRAFT`) | Prima di toccare la persistenza o la home |
| `docs/ux.md` | Principi generali di interazione: conferme, ricompense, errori, accessibilità (`DRAFT`) | Prima di progettare o cambiare una schermata o un messaggio |
| `docs/motore-livelli.md` | `LevelSpec`, generazione, indice di difficoltà, isole da 20 livelli, sblocco (`DRAFT`) | Prima di toccare livelli, mappa o progressione |
| `docs/rendering.md` | Tavola a due strati, tessere vive, vincoli degli SVG, tocco e rimozione, misure di S1 (`DRAFT`) | Prima di scrivere il rendering, le animazioni o la pipeline dei disegni |
| `docs/decisioni-tecniche.md` | Ragionamento esteso delle decisioni: alternative scartate, verifiche sulle piattaforme, prototipi S1-S5 | Prima di rimettere in discussione una decisione della sezione 5 |

**Nota:** per creare un capitolo nuovo, partire da `docs/_capitolo.template.md`.

## 8. TO DO aperto

Elenco delle aree non ancora decise o analizzate: segnala che il documento è vivo.

Ordine di lavoro: per vedere presto l'app giocabile si porta prima l'interfaccia di gioco; tutto il resto resta in sospeso e va fatto, nell'ordine sotto salvo nuove decisioni. Si aggiorna quando cambia.

1. Fatto: sessione di gioco (`src/application/session.ts`, `docs/sessione-di-gioco.md`).
2. Fatto: schermata della tavola (disegno con Skia portato da S1, tocco con `hitTest`, pulsanti Aiuto, Annulla e Mischia, avvisi e rimescolo automatico, schermata di vittoria con le stelle) e selettore provvisorio di livello e profilo (`src/ui/`), provati con successo su un dispositivo Android reale (Redmi Note 9 Pro).
3. Fatto: salvataggi su SQLite (partita in corso separata dai progressi, autosalvataggio, scheda «Continua», pausa in secondo piano, conferma di sostituzione e salvataggio dei progressi con stelle) provati su dispositivo reale.
4. Fatto: resa visiva a tappe; Modalità comoda; Aspetto con 8 palette per sfondo e bordo tessere; finestra regalo mascotte; mappa e selezione per le sette isole da 20 livelli e per le isole infinite. Mappa, numerazione 141-160 e avvio di una tavola generata provati sul Galaxy A36. Barra delle tessere selezionate provata su Redmi Note 9 Pro. Da verificare su dispositivo: Impostazioni, Modalità comoda, daltonismo, alto contrasto, difficoltà ed evidenzia-uguali. Da decidere: disco bianco di fondo dei disegni in alto contrasto (`docs/gioco-originale.md`).
5. In sospeso, da fare dopo: decisioni aperte sul rimescolo dei Tris e sulle soglie (difetto 6); una sezione di giochi alternativi, dove confluirà la sala dei Tris; rompicapi e album (con una lista di parole per lingua per «Cerca parole»); pubblicità e contenuti OTA; altre lingue oltre a IT, EN e FR; spostare in `tools/` gli altri script di esportazione (livelli, audio), oggi nei prototipi. Lingue e audio sono fatti: dell'audio resta da provare l'ascolto sull'altoparlante e la vibrazione sul dispositivo (`docs/resa-visiva.md`). I progressi tengono già migliore stella, record di tempo e profilo più alto battuto per livello, e le carte d'album regalate.

- Prototipi di validazione: S1, S2, S3, S4 e S5 sono tutti completati e chiusi (S1 in `docs/rendering.md`); `TO DO`: provare tablet e un telefono di fascia bassa; iOS escluso dal rilascio.
- Decisione presa: gli ID 101–150 completano le isole 3-7, poi i livelli infiniti iniziano dal 151; il contenuto di un ID può cambiare, perché i progressi portano la firma del livello (19 novembre 2026: i Tris al primo posto delle isole riusano gli ID dei livelli sostituiti e le stelle dei livelli di prima non si attaccano al Tris). Il numero mostrato segue l'ordine globale della campagna; i dieci Tris dell'originale hanno numerazione separata.
- `DRAFT`: pesi dell'indice di difficoltà uniformi, da affinare con dati di gioco (stelle e tempo per livello).
- `TO DO`: tolleranza e curva dell'indice di difficoltà, generatore di forme nuove e `levelForIndex`/`islandForIndex` (il generatore infinito attuale riusa forme originali).
- `TO DO`: Tris senza rimescolo possibile: l'originale riordina le tessere in file distanziate (cambia le posizioni), qui il rimescolo restituisce `generation-failed`; da decidere.
- Livelli Tris generati: fatti per il primo posto di ogni isola, da verificare su dispositivo; `TO DO`: nebbia in più dei profili alti: fatta (difetto 7 corretto), restano da verificare su dispositivo i livelli a Difficile, Esperto e Maestro; ricalibrazione di soglie di tempo e fattori dei profili (difetto 6, oggi quelli dell'originale).
- `TO DO`: tetto della tessera nella colonna di gioco; accessibilità delle singole tessere; zoom o tolleranza di tocco.
- `TO DO`: frequenza degli interstitial e limite dei rewarded per aiuti; dichiarazione del pubblico negli store; eventuale acquisto «rimuovi pubblicità».
- `TO DO`: sincronizzazione cloud e hosting dei contenuti oltre EAS Update; limiti e costi del piano EAS.
- `TO DO`: animazioni dell'intera tavola (ingresso del livello, rimescolo) come immagine unica o a gruppi; fantasmi con un giocatore più veloce; font del «?» nei veli Skia.
- Limite del solver: con budget di 200000 nodi, su una griglia piatta sintetica di 90 tessere in tris con 8 tipi 3 tavole su 20 restano `unknown` (sui 100 livelli dell'originale nessuna).
- `TO DO`: dettagli della schermata rispetto all'originale (tessere che bloccano, suoni e animazioni): l'inventario completo è in `docs/resa-visiva.md`.
- `TO DO`: `NullPointerException` su `NativeDatabase.prepareAsync` (Android, intermittente), causa da accertare con le prove elencate in `docs/salvataggi.md`, sezione «Verifica», «Da provare».
