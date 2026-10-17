# Majoa Mahjong

Questo documento è la memoria tecnica sintetica del progetto: descrive **com'è fatto oggi**, non come ci si è arrivati (la storia delle modifiche è nel log di git). Serve a chi subentra, persona o assistente IA, per capire in pochi minuti cosa esiste, dove si trova e dove approfondire. I dettagli stanno nei capitoli di `docs/`, richiamati dalle tabelle qui sotto.

Per ripartire:

1. Leggere questo file per intero.
2. Aprire i capitoli di `docs/` relativi all'area su cui si lavora, scegliendoli dalla sezione 2 o dalla sezione 7.
3. Seguire le regole di lavoro di `AGENTS.md`.

---

## 1. Panoramica

La sezione dichiara il *perché* prima del *cosa* e fissa i confini del progetto, per evitare funzionalità non richieste.

- **Scopo (PERCHÉ)**: portare su Android e iOS il gioco di abbinamento tessere in stile mahjong «Majoa Mahjong», nato come gioco HTML/CSS/JavaScript, riscrivendolo da zero (il vecchio codice è solo riferimento per grafica e funzionalità) e aggiungendo un motore di livelli infiniti, organizzati in isole da 20 livelli e ampliabili con nuovi contenuti.
- **Piattaforme e stack**: Android e iOS, telefoni e tablet, interfaccia sempre in verticale. Expo SDK 57, TypeScript `strict`, React Native Skia, Reanimated.
- **Stato**: `DRAFT`. Esiste solo la documentazione: nessun codice, nessun repository, prototipi non eseguiti (sezione 8).
- **Fuori ambito**: layout orizzontale; account e sincronizzazione cloud; banner pubblicitari in partita; mediazione con altre reti pubblicitarie; destinazione dell'app ai bambini.

## 2. Funzionalità

Ogni funzionalità ha una riga: cosa fa, in che stato è, dove si trova nel codice e quale capitolo la spiega. La tabella è l'indice da cui partire per cercare qualcosa. Nessuna funzionalità è ancora implementata: la colonna *Codice* è `TO DO` e il capitolo indicato descrive il comportamento dell'originale o il modello deciso.

| Funzionalità | Stato | Cosa fa | Codice | Capitolo |
|---|---|---|---|---|
| Tavola e abbinamento | TO DO | tessera libera, coppie (tris nei livelli Tris), selezione | TO DO | `docs/gioco-originale.md` |
| Motore dei livelli | TO DO | `LevelSpec`, generazione risolvibile con seme, livelli infiniti | TO DO | `docs/motore-livelli.md` |
| Difficoltà | TO DO | indice di livello e 6 profili scelti dal giocatore | TO DO | `docs/motore-livelli.md` |
| Isole e progressione | TO DO | isole da 20 livelli con temi, sblocco per stelle, mappa | TO DO | `docs/motore-livelli.md` |
| Meccaniche speciali | TO DO | tessere nascoste, d'oro, nebbiose; boss | TO DO | `docs/gioco-originale.md` |
| Aiuti | TO DO | Aiuto, Annulla, Mischia, rimescolo e aiuto automatici | TO DO | `docs/gioco-originale.md` |
| Stelle, ✨ e record | TO DO | 1-3 stelle per tempo e aiuti, monete, record | TO DO | `docs/gioco-originale.md` |
| Rompicapi | TO DO | 10 mini-giochi in 3 difficoltà | TO DO | `docs/gioco-originale.md` |
| Album e sfide | TO DO | carte da collezionare per isola e generali | TO DO | `docs/gioco-originale.md` |
| Mascotte | TO DO | 4 mascotte e nessuna; combo e finestre regalo | TO DO | `docs/gioco-originale.md` |
| Livelli Tris | TO DO | 10 livelli con gruppi da 3, fuori dalle isole | TO DO | `docs/gioco-originale.md` |
| Modalità comoda e accessibilità | TO DO | modalità «senior», testi grandi, contrasto, segnali senza colore | TO DO | `docs/gioco-originale.md` |
| Salvataggi | TO DO | progressi e una partita in corso, in SQLite | TO DO | `docs/gioco-originale.md` (originale) |
| Lingue | TO DO | lingua del dispositivo, inglese di riserva, FR/EN/IT | TO DO | `docs/gioco-originale.md` (originale) |
| Audio e vibrazione | TO DO | effetti come campioni, haptics | TO DO | `docs/gioco-originale.md` (originale) |
| Pubblicità | TO DO | AdMob: interstitial a fine livello, rewarded | TO DO | nessuno (sezione 5) |
| Aggiornamenti OTA | TO DO | nuove isole, carte, parole e rompicapi senza release | TO DO | nessuno (sezione 5) |
| Interfaccia verticale | TO DO | blocco di orientamento e colonna di gioco | TO DO | nessuno (sezione 5) |

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

Struttura prevista delle cartelle (`DRAFT`: nessuna esiste ancora):

```text
src/
  domain/          # logica pura + test (Jest)
  application/     # casi d'uso, controller
  infrastructure/  # storage, ads, audio, contenuti, API native
  ui/              # schermate, componenti, rendering
docs/              # capitoli di approfondimento
reference/         # copia di sola lettura del gioco HTML originale
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
| Expo SDK 57, TypeScript `strict`, development build con EAS, Expo Router | stack già in uso; New Architecture obbligatoria; serve una build nativa per gli annunci | non usare Flutter o app native doppie: stack nuovo o due codebase; non avvolgere l'HTML in una WebView: contraddice la riscrittura; non usare Unity o Godot: motore pesante, dominio non riusabile |
| Quattro livelli; dominio puro con stato immutabile (`applyMove(stato, mossa)`) | logica testabile senza dispositivo | non mettere logica nei componenti: non testabile senza renderer |
| Livelli descritti da `LevelSpec`, generati con PRNG con seme; campagna dell'originale esportata in JSON | livelli infiniti, test deterministici, porting fedele e verificabile | non usare `Math.random()` senza seme: livelli non riproducibili e risolvibilità non verificabile |
| Indice di difficoltà del livello distinto dal profilo scelto dal giocatore; isole infinite da 20 livelli con temi; sblocco con una quota delle stelle della sola isola precedente (`docs/motore-livelli.md`) | mantiene viaggio, boss e album; si estende all'infinito | non usare soglie cumulative di stelle: margine costante di 40, sempre più severe; non usare un solo asse senza isole, né campagna fissa più modalità infinita separata, né sola campagna fissa |
| Tavola in un unico canvas Skia, animazioni Reanimated, tocco risolto da `hitTest` del dominio | pochi elementi nativi; zone di tocco governate dalle regole | non usare una vista per tessera con SVG: costo e tocco legato alle viste; non usare sprite PNG: sfocatura su tablet e risorse moltiplicate |
| Disegni esportati una volta in SVG statici, testi convertiti in tracciati | indipendenti dalla risoluzione, nessun font da caricare | non tenere le stringhe SVG nel codice: non riusabili né testabili |
| Interfaccia sempre verticale: blocco da configurazione sui telefoni e, con `android:appCategory="game"`, sui tablet Android; su iPad tutte le orientazioni dichiarate e colonna di gioco centrata (rapporto massimo 3:4) | Android 16 e 17 esentano i giochi dalle restrizioni; iPadOS 26 non garantisce il blocco | non usare layout orizzontali con pannelli (esclusi); non usare `supportsTablet: false` (nessun supporto tablet); non usare `UIRequiresFullScreen` (deprecata) |
| Salvataggi in SQLite (`expo-sqlite`): transazioni, migrazioni, partita ricostruibile da spec, seme e mosse con hash della tavola; conferma prima di sostituire; reset transazionale | atomicità, versioni, progresso illimitato; corregge i difetti 1, 3 e 5 dell'originale | non usare MMKV, AsyncStorage o file JSON: niente transazioni né schema; non usare Realm o WatermelonDB: eccessivi |
| Effetti come campioni con `expo-audio`; vibrazione con `expo-haptics` | funzionano in Expo Go; risorse sostituibili | non usare `react-native-audio-api` come prima scelta: modulo nativo e dipendenza più giovane (piano B se la latenza è alta) |
| Lingue con `expo-localization` e `i18next`: lingua del dispositivo, inglese di riserva, test di parità delle chiavi, parole del «Cerca parole» per lingua | aggiungere una lingua senza toccare il codice | non usare soluzioni proprie: riscrivono plurali e interpolazione |
| App non destinata ai bambini; AdMob con `react-native-google-mobile-ads` dietro `AdsService`; interstitial a fine livello, rewarded per ✨ e aiuti; consenso UMP; nessun banner in partita | momenti naturali del percorso; il dominio non conosce gli annunci | non mettere banner in partita: tocchi accidentali; non aggiungere mediazione: peso e privacy; non usare app a pagamento o abbonamento: contrasta col modello gratuito |
| Contenuti come dati dietro `ContentRepository`; OTA con EAS Update (dati, risorse, JavaScript dei rompicapi); contenuti solo in aggiunta, applicati all'avvio successivo | nuove isole, carte e rompicapi senza una revisione dello store per ciascuno | non aggiornare codice nativo via OTA: impossibile; non chiudere i contenuti nel binario: una release per ogni isola |
| Stato di gioco con Zustand | selettori: il canvas non si ridisegna a ogni cambiamento | non usare Context (ridisegni inutili) né Redux Toolkit (eccessivo) |
| Test: Jest sul dominio, test sui semi con il solver, regressione sulla campagna esportata, parità delle lingue; UI e nativo a mano | garanzia di risolvibilità su livelli infiniti | non limitarsi ai test manuali; non introdurre test end-to-end finché la UI cambia di continuo |

**Nota:** quando una decisione cambia, la riga si riscrive: la storia è nel log di git. La colonna *Scartato e perché* si formula come vincolo attuale (es. «non usare X: causa Y»), non come cronologia.

## 6. Verifica

La verifica distingue ciò che è provato da ciò che non lo è: dichiararlo è parte del lavoro.

- **Build e test**: `TO DO` (nessun progetto ancora). Previsti: `npx jest`, `npx tsc --noEmit`, `npx expo-doctor`.
- **Dominio**: test automatici su ogni regola.
- **UI e integrazioni native**: verifica manuale su dispositivo reale e su emulatori di tablet e pieghevole.

| Area | Come viene verificata | Stato |
|---|---|---|
| Dominio | Jest, test sui semi, regressione sulla campagna esportata | non verificato (nessun codice) |
| Prototipi S1-S5 | prove su dispositivo e su emulatore (sezione 8) | non verificato |
| UI, audio, annunci, tablet | prova manuale su dispositivo | non verificato |
| Descrizione dell'originale | lettura del codice ed esecuzione in Chromium; 142 controlli della suite in 8 sezioni su 25 | verificato in parte (`docs/gioco-originale.md`, «Verifica») |

## 7. Capitoli di approfondimento

Ogni capitolo spiega un'area in modo tecnico e aggiornato allo stato attuale. I nomi dei file sono stabili: un capitolo non si rinomina senza aggiornare questa tabella.

| Capitolo | Contenuto | Quando leggerlo |
|---|---|---|
| `docs/linee-guida-codice.md` | Principi di codice con esempi | Prima di scrivere codice |
| `docs/gioco-originale.md` | Regole, livelli, aiuti, punteggi, rompicapi, album, grafica, impostazioni e salvataggi dell'originale; difetti noti | Prima di implementare una funzione che nasce dall'originale |
| `docs/motore-livelli.md` | `LevelSpec`, generazione, indice di difficoltà, isole da 20 livelli, sblocco (`DRAFT`) | Prima di toccare livelli, mappa o progressione |

**Nota:** per creare un capitolo nuovo, partire da `docs/_capitolo.template.md`.

## 8. TO DO aperto

Elenco delle aree non ancora decise o analizzate: segnala che il documento è vivo.

- `DRAFT`: prototipi di validazione. S1 rendering Skia dei 129 SVG e prestazioni; S2 latenza audio dei campioni; S3 blocco verticale su tablet Android 16 con `appCategory`, caricamento iPad su TestFlight, colonna 3:4; S4 generatore con seme, solver e simulazione su Hermes; S5 flusso OTA con partita salvata.
- `DRAFT`: isole 3-7 dell'originale estese a 20 livelli con 10 livelli generati (ipotesi da confermare).
- `TO DO`: pesi dell'indice di difficoltà, tolleranza, curva tra isole, `ρ` di sblocco (proposta 2/3), formula delle carte d'album per isola.
- `TO DO`: livelli Tris generati; nebbia aggiuntiva dei profili alti (difetto 7); ricalibrazione di soglie e fattori (difetto 6).
- `TO DO`: tetto della tessera nella colonna di gioco; accessibilità delle singole tessere; zoom o tolleranza di tocco.
- `TO DO`: frequenza degli interstitial e limite dei rewarded per aiuti; dichiarazione del pubblico negli store; eventuale acquisto «rimuovi pubblicità».
- `TO DO`: sincronizzazione cloud e hosting dei contenuti oltre EAS Update; limiti e costi del piano EAS.
- `TO DO`: creare `reference/majoa-originale/` e `tools/`; capitoli di rendering, salvataggi, audio, lingue, pubblicità, contenuti OTA.
