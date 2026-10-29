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
- **Stato**: `DRAFT`. Esistono la documentazione, la copia dell'originale in `reference/majoa-originale/` e tutti i 5 prototipi di validazione (S1 rendering, S2 audio, S3 layout, S4 motore dei livelli, S5 OTA) in `prototipi/`; l'app è avviata (Expo Router e Jest, schermata segnaposto) `src/domain/` contiene il nucleo del dominio con test (tessere libere, mosse, mossa suggerita, rimescolo, layout e `hitTest`, generatore con seme, solver, indice di difficoltà) e `src/infrastructure/content/` i 100 livelli dell'originale con test di regressione; non esistono ancora schermate né funzionalità per il giocatore (sezione 2).
- **Fuori ambito**: layout orizzontale; account e sincronizzazione cloud; banner pubblicitari in partita; mediazione con altre reti pubblicitarie; destinazione dell'app ai bambini.

## 2. Funzionalità

Ogni funzionalità ha una riga: cosa fa, in che stato è, dove si trova nel codice e quale capitolo la spiega. La tabella è l'indice da cui partire per cercare qualcosa. Stato `TO DO`: nessun codice, il capitolo indicato descrive il comportamento dell'originale o il modello deciso. Stato `PARZIALE`: logica di dominio implementata e testata, senza interfaccia; la colonna *Codice* dice dove.

| Funzionalità | Stato | Cosa fa | Codice | Capitolo |
|---|---|---|---|---|
| Tavola e abbinamento | PARZIALE | tessera libera, coppie (tris nei livelli Tris), `applyMove`, layout sullo schermo e `hitTest`; selezione `TO DO` | `src/domain/geometry.ts`, `gameState.ts`, `board.ts` | `docs/dominio-di-gioco.md`, `docs/gioco-originale.md` |
| Motore dei livelli | PARZIALE | `LevelSpec`, generazione risolvibile con seme, solver di verifica, 100 livelli dell'originale come dati; livelli infiniti (`levelForIndex`) `TO DO` | `src/domain/types.ts`, `generator.ts`, `solver.ts`, `prng.ts`; `src/infrastructure/content/legacyLevels.ts` | `docs/motore-livelli.md`, `docs/dominio-di-gioco.md` |
| Difficoltà | PARZIALE | indice di livello (nove misure, pesi, etichetta 1-5); 6 profili scelti dal giocatore `TO DO` | `src/domain/difficulty.ts`, `src/domain/weights.ts` | `docs/motore-livelli.md` |
| Isole e progressione | TO DO | isole da 20 livelli con temi, sblocco per stelle, mappa | TO DO | `docs/motore-livelli.md` |
| Meccaniche speciali | TO DO | tessere nascoste, d'oro, nebbiose; boss | TO DO | `docs/gioco-originale.md` |
| Aiuti | PARZIALE | Aiuto (mossa suggerita e rilevamento «nessuna mossa») e Mischia (riassegnazione dei disegni, partita sempre risolvibile); Annulla, conteggio degli usi, tempi e limiti del rimescolo automatico `TO DO` | `src/domain/hint.ts`, `reshuffle.ts` | `docs/dominio-di-gioco.md`, `docs/gioco-originale.md` |
| Stelle, ✨ e record | TO DO | 1-3 stelle per tempo e aiuti, monete, record | TO DO | `docs/gioco-originale.md` |
| Rompicapi | TO DO | 10 mini-giochi in 3 difficoltà | TO DO | `docs/gioco-originale.md` |
| Album e sfide | TO DO | carte da collezionare per isola e generali | TO DO | `docs/gioco-originale.md` |
| Mascotte | TO DO | 4 mascotte e nessuna; combo e finestre regalo | TO DO | `docs/gioco-originale.md` |
| Livelli Tris | TO DO | 10 livelli con gruppi da 3, fuori dalle isole | TO DO | `docs/gioco-originale.md` |
| Modalità comoda e accessibilità | TO DO | modalità «senior», testi grandi, contrasto, segnali senza colore | TO DO | `docs/gioco-originale.md` |
| Salvataggi | TO DO | progressi e una partita in corso, in SQLite | TO DO | `docs/gioco-originale.md` (originale) |
| Lingue | TO DO | lingua del dispositivo, inglese di riserva, FR/EN/IT | TO DO | `docs/gioco-originale.md` (originale) |
| Audio e vibrazione | TO DO | effetti come campioni, haptics | TO DO | `docs/gioco-originale.md` (originale) |
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

Struttura delle cartelle (`DRAFT`: esistono `src/app/`, `src/domain/` e `src/infrastructure/content/`; `application/`, `ui/`, il resto di `infrastructure/` e `tools/` non ancora):

```text
package.json, app.json, tsconfig.json  # configurazione dell'app, nella radice
src/
  app/             # route di Expo Router: solo instradamento, le schermate stanno in ui/
  domain/          # logica pura + test (Jest)
  application/     # casi d'uso, controller
  infrastructure/  # storage, ads, audio, contenuti, API native
  ui/              # schermate, componenti, rendering
docs/              # capitoli di approfondimento
reference/         # copia di sola lettura del gioco HTML originale (majoa-originale/)
prototipi/         # prototipi di validazione usa e getta (S1: rendering; S2: audio; S3: layout; S4: motore; S5: OTA)
tools/             # script di esportazione (livelli, disegni, campioni audio)
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

## 5. Decisioni vigenti

Ogni scelta che condiziona il progetto ha una riga: cosa vale oggi, perché, e cosa è stato scartato. Chi subentra non deve ricostruirla né riproporre ciò che è già stato escluso.

| Decisione | Motivo | Scartato e perché |
|---|---|---|
| Expo SDK 57, TypeScript `strict`, development build con EAS, Expo Router; solo Android | stack già in uso; New Architecture obbligatoria; serve una build nativa per gli annunci; S1 è validato sulla 57; identificativo Android `it.luigiscialpi.majoa`; le dipendenze native che Expo Router richiede come peer (`expo-font`, `react-dom`, `react-native-reanimated`, `react-native-worklets`, `react-native-gesture-handler`) sono fissate alle versioni dell'SDK 57 (`bundledNativeModules.json`) | non passare per ora alla SDK 58 (uscita il 15/10/2026): da rivalutare al prossimo aggiornamento; non usare Flutter o app native doppie: stack nuovo o due codebase; non avvolgere l'HTML in una WebView: contraddice la riscrittura; non usare Unity o Godot: motore pesante, dominio non riusabile; non rilasciare su iOS: nessun rilascio previsto su App Store; non lasciare che npm risolva da solo i peer di Expo Router: installa le versioni più recenti, fuori SDK (duplicati nativi, `expo-doctor` fallisce) |
| Quattro livelli; dominio puro con stato immutabile verso l'esterno (`applyMove(stato, gruppo)` restituisce un nuovo stato o un errore tipizzato; solo solver e generatore mutano una copia) | logica testabile senza dispositivo; il solver visita decine di migliaia di stati | non mettere logica nei componenti: non testabile senza renderer; non chiamare `GameState.apply` fuori dal dominio: muta lo stato |
| Livelli descritti da `LevelSpec`, generati con PRNG con seme; campagna dell'originale esportata in JSON | livelli infiniti, test deterministici, porting fedele e verificabile; verificato in S4 (1000 tavole su Android senza fallimenti, solver indipendente) | non usare `Math.random()` senza seme: livelli non riproducibili e risolvibilità non verificabile |
| Indice di difficoltà del livello distinto dal profilo scelto dal giocatore; isole infinite da 20 livelli con temi; sblocco con una quota delle stelle della sola isola precedente (`docs/motore-livelli.md`) | mantiene viaggio, boss e album; si estende all'infinito; indice con pesi uniformi: la campagna dell'originale non li identifica (S4) | non tarare i pesi sulla campagna dell'originale: non li identifica; non usare soglie cumulative di stelle: margine costante di 40, sempre più severe; non usare un solo asse senza isole, né campagna fissa più modalità infinita separata, né sola campagna fissa |
| Tavola a due strati in un canvas Skia: strato fermo in un'unica immagine (corpo delle tessere in cache), strato vivo con le sole tessere libere e in rimozione (al massimo circa 30); animazioni Reanimated; tocco risolto da `hitTest` del dominio (`docs/rendering.md`) | misurato su dispositivo: con tutte le tessere dal vivo l'eco col thread UI è 0,7-2,7 s anche con 2 tessere animate, a strati sotto 50 ms | non disegnare tutte le tessere dal vivo con valori condivisi: il costo segue le tessere disegnate, non quelle animate; non usare una vista per tessera con SVG: costo e tocco legato alle viste; non usare sprite PNG: sfocatura su tablet e risorse moltiplicate |
| Disegni esportati una volta in SVG statici con solo `viewBox`, testi convertiti in tracciati, ritaglio sul riquadro (`docs/rendering.md`) | indipendenti dalla risoluzione; SkSVG non disegna `<text>`, ignora `width` e `height` fissi e non ritaglia | non tenere le stringhe SVG nel codice: non riusabili né testabili; non usare `<text>` né `width` e `height` fissi negli SVG |
| Interfaccia sempre verticale: blocco da configurazione sui telefoni e, con `android:appCategory="game"`, sui tablet Android; su iPad tutte le orientazioni dichiarate e colonna di gioco centrata (rapporto massimo 3:4) | Android 16 e 17 esentano i giochi dalle restrizioni; iPadOS 26 non garantisce il blocco | non usare layout orizzontali con pannelli (esclusi); non usare `supportsTablet: false` (nessun supporto tablet); non usare `UIRequiresFullScreen` (deprecata) |
| Salvataggi in SQLite (`expo-sqlite`): transazioni, migrazioni, partita ricostruibile da spec, seme e mosse con hash della tavola; conferma prima di sostituire; reset transazionale | atomicità, versioni, progresso illimitato; corregge i difetti 1, 3 e 5 dell'originale | non usare MMKV, AsyncStorage o file JSON: niente transazioni né schema; non usare Realm o WatermelonDB: eccessivi |
| Effetti come campioni con `expo-audio`; vibrazione con `expo-haptics` | funzionano in Expo Go; risorse sostituibili | non usare `react-native-audio-api` come prima scelta: modulo nativo e dipendenza più giovane (piano B se la latenza è alta) |
| Lingue con `expo-localization` e `i18next`: lingua del dispositivo, inglese di riserva, test di parità delle chiavi, parole del «Cerca parole» per lingua | aggiungere una lingua senza toccare il codice | non usare soluzioni proprie: riscrivono plurali e interpolazione |
| App non destinata ai bambini; AdMob con `react-native-google-mobile-ads` dietro `AdsService`; interstitial a fine livello, rewarded per ✨ e aiuti; consenso UMP; nessun banner in partita | momenti naturali del percorso; il dominio non conosce gli annunci | non mettere banner in partita: tocchi accidentali; non aggiungere mediazione: peso e privacy; non usare app a pagamento o abbonamento: contrasta col modello gratuito |
| Contenuti come dati dietro `ContentRepository`; OTA con EAS Update (dati, risorse, JavaScript dei rompicapi); contenuti solo in aggiunta, applicati all'avvio successivo | nuove isole, carte e rompicapi senza una revisione dello store per ciascuno | non aggiornare codice nativo via OTA: impossibile; non chiudere i contenuti nel binario: una release per ogni isola |
| Stato di gioco con Zustand | selettori: il canvas non si ridisegna a ogni cambiamento | non usare Context (ridisegni inutili) né Redux Toolkit (eccessivo) |
| Test: Jest 29 con preset `jest-expo` (e `@react-native/jest-preset`, richiesto da jest-expo 57) sul dominio, test sui semi con il solver, regressione sulla campagna esportata, parità delle lingue; UI e nativo a mano | garanzia di risolvibilità su livelli infiniti | non limitarsi ai test manuali; non introdurre test end-to-end finché la UI cambia di continuo |

**Nota:** quando una decisione cambia, la riga si riscrive: la storia è nel log di git. La colonna *Scartato e perché* si formula come vincolo attuale (es. «non usare X: causa Y»), non come cronologia.

## 6. Verifica

La verifica distingue ciò che è provato da ciò che non lo è: dichiararlo è parte del lavoro.

- **Build e test**: `npm install`, poi `npm test` (Jest, solo `src/`), `npm run typecheck` (`tsc --noEmit`) e `npx expo-doctor`; bundle Android con `npx expo export --platform android`. `expo-doctor` richiede la rete per due controlli (schema di `app.json`, directory di React Native).
- **Dominio**: test automatici su ogni regola.
- **UI e integrazioni native**: verifica manuale su dispositivo reale e su emulatori di tablet e pieghevole.

| Area | Come viene verificata | Stato |
|---|---|---|
| Scaffold dell'app | `tsc --noEmit`, `expo export --platform android` (bundle Hermes), `expo-doctor` offline | verificato: 19 controlli su 21 di `expo-doctor` (restano i 2 che richiedono la rete); avvio su dispositivo non verificato |
| Dominio (`src/domain/`) e campagna (`src/infrastructure/content/`) | Jest: 94 test; 76 su forme sintetiche (regole, `applyMove`, generatore, solver, misure e indice, layout e `hitTest`, mossa suggerita, rimescolo) e 18 sui 100 livelli dell'originale (forma dei dati, tessera libera contro `isFree` dell'originale, generazione con soluzione rigiocata, solver, indice contro ordine di progetto ed etichette, misure simulate riprodotte dal prototipo, tavola dentro l'area, tessere libere del livello 20 raggiungibili al tocco, mossa suggerita contro `findMove` dell'originale, rimescolo a un terzo e a due terzi della partita, tavole generate fissate a parità di seme); 15 difetti introdotti di proposito nel dominio, 3 sulla regola della tessera libera, 7 sull'indice, 10 sul layout, 6 sulla mossa suggerita e 8 sul rimescolo, tutti rilevati | verificato; prestazioni su dispositivo non rimisurate sul codice dell'app |
| Prototipo S1 (rendering) | `skia-python`, Chromium, test di dominio e prova su un Android (`prototipi/s1-rendering/README.md`) | verificato su un dispositivo Android; tablet e fascia bassa no; iOS escluso dal rilascio |
| Prototipo S4 (motore dei livelli) | Node, 14 test, bundle nativi e prova su un Android con Hermes (`prototipi/s4-generatore/README.md`) | verificato su un dispositivo Android; pesi dell'indice non calibrati su dati di gioco |
| Prototipo S2 (audio) | `expo-audio` e `expo-haptics`, 24 campioni WAV da Chromium, benchmark latenza e combo (`prototipi/s2-audio/README.md`) | verificato su un dispositivo Android con `--no-dev --minify`; latenza combo e polifonia ok, decisione confermata |
| Prototipo S5 (OTA e salvataggi) | Node, 5 test, `expo-updates`, simulazione ripristino e validatore append-only (`prototipi/s5-ota/README.md`) | verificato: 5 test automatici passati; regole 1-4 confermate, gestione sicura di integrità e scarto |
| Prototipo S3 (layout e blocco tablet) | Node, 6 test, config plugin `appCategory="game"`, simulazione colonna 3:4 e tetto tessere (`prototipi/s3-layout/README.md`) | verificato: 6 test passati; plugin validato su prebuild; layout 3:4 e tetto tessere a 60 dp verificati (iOS non prioritario) |
| UI, audio, annunci, tablet | prova manuale su dispositivo | non verificato |
| Descrizione dell'originale | lettura del codice ed esecuzione in Chromium; 142 controlli della suite in 8 sezioni su 25 | verificato in parte (`docs/gioco-originale.md`, «Verifica») |

## 7. Capitoli di approfondimento

Ogni capitolo spiega un'area in modo tecnico e aggiornato allo stato attuale. I nomi dei file sono stabili: un capitolo non si rinomina senza aggiornare questa tabella.

| Capitolo | Contenuto | Quando leggerlo |
|---|---|---|
| `docs/linee-guida-codice.md` | Principi di codice con esempi | Prima di scrivere codice |
| `docs/gioco-originale.md` | Regole, livelli, aiuti, punteggi, rompicapi, album, grafica, impostazioni e salvataggi dell'originale; difetti noti | Prima di implementare una funzione che nasce dall'originale |
| `docs/dominio-di-gioco.md` | Tessere, tessera libera, stato di partita, `applyMove`, determinismo (`DRAFT`) | Prima di toccare `src/domain/` |
| `docs/motore-livelli.md` | `LevelSpec`, generazione, indice di difficoltà, isole da 20 livelli, sblocco (`DRAFT`) | Prima di toccare livelli, mappa o progressione |
| `docs/rendering.md` | Tavola a due strati, tessere vive, vincoli degli SVG, tocco e rimozione, misure di S1 (`DRAFT`) | Prima di scrivere il rendering, le animazioni o la pipeline dei disegni |
| `docs/decisioni-tecniche.md` | Ragionamento esteso delle decisioni: alternative scartate, verifiche sulle piattaforme, prototipi S1-S5 | Prima di rimettere in discussione una decisione della sezione 5 |

**Nota:** per creare un capitolo nuovo, partire da `docs/_capitolo.template.md`.

## 8. TO DO aperto

Elenco delle aree non ancora decise o analizzate: segnala che il documento è vivo.

- Prototipi di validazione: S1, S2, S3, S4 e S5 sono tutti completati e chiusi.
- `DRAFT`: isole 3-7 dell'originale estese a 20 livelli con 10 livelli generati (ipotesi da confermare).
- `DRAFT`: pesi dell'indice di difficoltà uniformi, da affinare con dati di gioco (stelle e tempo per livello).
- `TO DO`: tolleranza dell'indice dentro l'isola, curva tra isole, `ρ` di sblocco (proposta 2/3), formula delle carte d'album per isola; generazione delle forme e `levelForIndex`.
- `TO DO`: Tris senza rimescolo possibile: l'originale riordina le tessere in file distanziate (cambia le posizioni), qui il rimescolo restituisce `generation-failed`; da decidere.
- `TO DO`: livelli Tris generati; nebbia aggiuntiva dei profili alti (difetto 7); ricalibrazione di soglie e fattori (difetto 6).
- `TO DO`: tetto della tessera nella colonna di gioco; accessibilità delle singole tessere; zoom o tolleranza di tocco.
- `TO DO`: frequenza degli interstitial e limite dei rewarded per aiuti; dichiarazione del pubblico negli store; eventuale acquisto «rimuovi pubblicità».
- `TO DO`: sincronizzazione cloud e hosting dei contenuti oltre EAS Update; limiti e costi del piano EAS.
- `TO DO`: S1 chiuso (`docs/rendering.md`); resta da provare tablet e un telefono di fascia bassa. iOS escluso dal rilascio.
- `TO DO`: animazioni dell'intera tavola (ingresso del livello, rimescolo) come immagine unica o a gruppi; scintille di rimozione; fantasmi con un giocatore più veloce; font definitivo di lettere e numeri (provvisori Poppins Bold e DejaVu Serif Bold).
- Limite del solver: con budget di 200000 nodi, su una griglia piatta sintetica di 90 tessere in tris con 8 tipi 3 tavole su 20 restano `unknown` (sui 100 livelli dell'originale nessuna).
- `TO DO`: creare `tools/`; capitoli di salvataggi, audio, lingue, pubblicità, contenuti OTA.
