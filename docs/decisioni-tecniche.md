# Decisioni tecniche — Majoa Mahjong

> **Stato: CONFERMATO (17/10/2026).** La sintesi vigente è nel README, sezione 5; questo documento conserva il ragionamento esteso.

Lo scopo di questo documento è fissare le scelte tecniche per la nuova app, ciascuna con il suo motivo e con le alternative scartate, prima di scrivere qualsiasi codice. Le scelte rispondono ai requisiti emersi nella fase 1 (sezione 1) e seguono la struttura a quattro livelli del template (dominio, applicazione, infrastruttura, UI).

Convenzioni di lettura. **[Verificato]** indica un'informazione controllata nella documentazione ufficiale o in fonti dichiarate il 17/10/2026 (data di redazione); **[Da validare]** indica un'ipotesi da confermare con un prototipo (sezione 13); **[Da decidere]** indica una scelta di prodotto che spetta a te. Le versioni delle librerie non sono fissate qui: le allinea `npx expo install` alla SDK in uso.

## 1. Punto di partenza

### 1.1 Decisioni già prese (risposte alla fase 1)

1. Si porta tutto il perimetro dell'originale (100 livelli, 10 rompicapi, 6 album, 4 mascotte, 6 difficoltà, Modalità comoda, Tris), **ma** si progetta un **motore di livelli infiniti** e di conseguenza si rivede l'esistenza delle isole e della progressione.
2. I difetti dell'originale sono corretti, non replicati: reset della progressione che rompe la sessione, sostituzione della partita salvata senza conferma, posizione delle tessere non verificata nel salvataggio.
3. Un solo criterio per il conteggio delle stelle (album e sblocchi).
4. «Cerca parole» mantiene FR/EN/IT; altre lingue verranno aggiunte in futuro.
5. Lingua iniziale: quella del dispositivo; se non supportata, inglese.
6. Supporto ai tablet.
7. App **non destinata ai bambini** (pubblicità AdMob standard con consenso).
8. **Rewarded** anche per gli aiuti in partita.
9. Interfaccia **sempre in verticale** su ogni dispositivo; se non è tecnicamente possibile, la migliore alternativa valida (sezione 5).
10. I prototipi di validazione si fanno prima di scrivere il resto del codice (sezione 13).
11. Da valutare: alternative per progressione e isole (sezione 3) e aggiornamenti OTA di isole, carte e rompicapi (sezione 10).

### 1.2 Misure dell'originale che pesano sulle scelte

| Misura | Valore | Perché conta |
|---|---|---|
| Tessere nella tavola più grande | 96 (livello 20; massimo 72 in Modalità comoda), 5 piani, griglia 6 × 7 | Il carico di rendering è basso: non serve ottimizzare in anticipo. |
| Disegni di tessere | 129, forme semplici senza filtri, gradienti, maschere o clip; solo 3 occorrenze di `<text>` (lettere e numeri) | Sono convertibili in risorse statiche; i testi vanno trasformati in tracciati. |
| Audio | 15 effetti sintetizzati con Web Audio, nessun file | Nel nuovo stack non esiste Web Audio nativo (sezione 7). |
| Testi | 254 chiavi per lingua, 3 lingue, parole del «Cerca parole» per lingua | Base per il sistema di lingue (sezione 8). |
| Generatore | `Math.random` ovunque, nessun seme | Per un motore infinito e testabile serve un generatore deterministico (sezione 3). |

## 2. Stack e piattaforma

**Decisione.** Expo con TypeScript in modalità `strict`, su **Expo SDK 57** (React Native 0.86, React 19.2 **[Verificato]**: SDK pubblicata il 30/06/2026), con **development build** tramite EAS Build. Navigazione con Expo Router. Android e iOS da un'unica codebase.

**Motivo.**
- È lo stack già in uso (Kotlin/Compose, React Native/Expo, TypeScript): nessun costo di apprendimento e strumenti già noti.
- La New Architecture è obbligatoria dalla SDK 55 in poi **[Verificato]**: si parte senza debito legacy. Reanimated 4 funziona solo con la New Architecture **[Verificato]**, quindi non c'è conflitto.
- La development build serve comunque per la pubblicità (modulo nativo non incluso in Expo Go, sezione 9); lo stesso vale per eventuali moduli nativi futuri.

Nota: Expo ha dichiarato di valutare una cadenza di release diversa a partire dalla SDK 57 (aggiornamenti non distruttivi tra release maggiori) **[Verificato]**. Il README registrerà la SDK in uso; gli aggiornamenti si fanno con `npx expo install --fix` e `npx expo-doctor`.

**Alternative scartate.**

| Alternativa | Perché non va |
|---|---|
| Flutter | Stack non in uso: Dart, strumenti e librerie nuovi da imparare senza vantaggio per un gioco 2D di questa dimensione. |
| Kotlin + Swift nativi | Due codebase da mantenere per un solo sviluppatore. |
| Unity / Godot | Motore pesante per un gioco 2D a tessere; nessun uso di TypeScript; il dominio puro (sezione 3) non sarebbe riusabile. |
| Avvolgere l'HTML originale in una WebView | Contraddice l'obiettivo dichiarato (riscrittura da zero) e non risolve tablet, animazioni e qualità da store. |
| React Native «nudo» senza Expo | Perde CNG, EAS e il controllo delle versioni di Skia/Reanimated garantito dalla SDK. |

## 3. Architettura e motore dei livelli

**Decisione.** Quattro livelli come da template: `src/domain` (puro, testato con Jest), `src/application` (casi d'uso), `src/infrastructure` (storage, pubblicità, audio, API native), `src/ui` (schermate, componenti, rendering). Gli errori previsti sono valori tipizzati. Lo stato di gioco è **immutabile** e il dominio espone funzioni pure (`applyMove(stato, mossa) → stato`), perché Annulla, salvataggio e test lavorano meglio su stati e mosse che su oggetti mutabili.

**Moduli del dominio** (nomi indicativi):

| Modulo | Contenuto |
|---|---|
| `board` | Tessera `{id, x, y, z}`; tessera libera (stessa regola dell'originale: nessuna tessera a `z+1` con `|Δx|<1` e `|Δy|<1`; non vicina sia a sinistra sia a destra, con distanza in `x` minore di 2 e `|Δy|<1`); hit-test sulla tavola. |
| `rules` | Abbinamento a gruppi di 2 o 3 (parametro `groupSize`), nascoste/oro/nebbia, selezione. |
| `generator` | Generazione risolvibile per costruzione (rimozione simulata a ritroso, come nell'originale), con **PRNG con seme** (`mulberry32` o simile). Stesso `LevelSpec` + stesso seme = stessa tavola. |
| `solver` | Verifica di risolvibilità (per i test) e ricerca della prossima mossa (per l'Aiuto). |
| `difficulty` | Le 6 difficoltà come **tabella di dati**, non come condizioni sparse nel codice. |
| `scoring` | Stelle (un solo criterio), soglie, ✨. |
| `progress` | Avanzamento per indice di livello, album, sfide. |

**Il motore dei livelli infiniti.** Ogni livello è descritto da un `LevelSpec` (dati): forma, insieme di disegni, numero di tipi, `groupSize`, meccaniche (gruppi di nascoste, tessere d'oro, nebbia), aiuti iniziali, tema grafico. Due sorgenti producono `LevelSpec`:
1. **Campagna dell'originale**: i 100 livelli esportati una sola volta in JSON da uno script che pilota l'HTML originale (lo stesso metodo usato per l'inventario). Così il porting è fedele e verificabile con test di regressione sui numeri dell'inventario (tessere, piani, aiuti per livello).
2. **Livelli generati**: `levelForIndex(n, difficoltà)` produce lo spec dei livelli oltre il centesimo (forme procedurali o scelte da una libreria, curva di difficoltà, comparsa progressiva delle meccaniche).

Conseguenze tecniche già decise, indipendenti da come si ridisegna la progressione:
- Il progresso si registra **per indice di livello, in modo sparso**, senza un massimo.
- Le spiegazioni al primo incontro dell'originale (livelli 1, 3, 4, 8, 11, 13, 16, 19, 23, 33, 91) diventano spiegazioni legate alla **prima comparsa della meccanica**, non al numero di livello: l'unico modo per funzionare con livelli infiniti.
- Le isole non possono più essere blocchi a soglia fissa di stelle su un numero finito di livelli.

**[Deciso] — progressione e isole.** Il motore infinito rende obsoleta la struttura a isole finite con soglie fisse. Un vincolo ricavato dall'originale: la soglia per aprire un'isola lascia sempre un **margine costante di 40 stelle** sul massimo disponibile (80 stelle su 120 possibili nei primi 40 livelli, poi 110 su 150, 140 su 180, 170 su 210, 200 su 240). Su isole infinite una regola così richiede in percentuale sempre più stelle, fino a quasi tre stelle ovunque: va sostituita, non estesa.

Alternative a confronto:

| Id | Alternativa | Vantaggi | Limiti |
|---|---|---|---|
| A | Un solo asse di livelli; i temi ruotano ogni N livelli, senza blocchi | Il più semplice; nessuna mappa da costruire; progressione continua | Si perdono il «viaggio» e le isole come traguardi; regali e album legati a eventi diversi |
| **B** | **Isole infinite con temi** (idea dello sviluppatore): ogni isola è un capitolo da **20 livelli di difficoltà crescente** prodotto da un modello di tema (14 disegni, tavolozze, nomi tradotti, mascotte, 14 carte d'album); le prime 7 isole sono quelle dell'originale, dall'ottava in poi si generano da temi in sequenza; finiti i temi, si ripetono con varianti | Conserva viaggio, boss, regali ✨ e album per isola; si estende con nuovi temi via OTA; il percorso originale resta intatto | Serve una nuova regola di sblocco; la mappa diventa un elenco illimitato (da virtualizzare); serve produrre temi con continuità (disegni e nomi in tutte le lingue) |
| C | Campagna fissa dell'originale (100 livelli) più una «Modalità infinita» separata | Nessun ridisegno della campagna; il motore infinito resta isolato | Due progressioni e due economie da collegare; l'infinito non è «il gioco» |
| D | Solo campagna fissa, con isole nuove aggiunte a mano via OTA | Qualità controllata di ogni isola | Non è infinito: ogni livello nuovo va prodotto a mano |

**Decisione: B**, con isole da 20 livelli (`docs/motore-livelli.md`). È l'unica che rende infinite le isole senza perdere la struttura dell'originale, e si combina con gli aggiornamenti OTA (sezione 10). In termini tecnici:
- L'isola diventa un dato, `IslandSpec` (tema, regole di generazione, carte, regalo, indici dei boss), e una funzione pura `islandForIndex(i)` la restituisce: tabella fissa per le prime 7, generata dal tema `i mod T` con una variante per le successive.
- I livelli di un'isola generata usano il motore con seme `(isola, livello, difficoltà)`; le meccaniche compaiono per posizione dentro l'isola, come nell'Isola degli animali dell'originale (oro dal livello 3, nascoste dall'11, nebbia dal 13, boss ai livelli 5, 10, 15 e 20). L'indice di difficoltà e le isole dell'originale estese a 20 livelli sono definiti in `docs/motore-livelli.md`.
- Sblocco dell'isola successiva: isola precedente completata **e** una percentuale (da calibrare) delle stelle della sola isola precedente, al posto della soglia cumulativa. Un criterio di stelle unico (decisione 3 della fase 1) alimenta sia lo sblocco sia l'album.
- Il progresso è sparso per indice di isola e di livello; la mappa è un elenco virtualizzato.

**[Da approfondire] — difficoltà dei livelli generati.** Per generare livelli «più difficili» serve una misura oggettiva; la proposta è ricavarla dal solver (ad esempio numero di mosse libere in media, rischio di vicoli ciechi). Nell'originale la difficoltà del livello è solo un'etichetta, quindi non esiste una misura da riusare.

**Alternative scartate.**
- *Portare la logica dell'originale così com'è* (stato mutabile, `Math.random`): non testabile in modo deterministico, difetti dell'originale (sezione 14 dell'inventario) replicati.
- *Logica nei componenti React*: non testabile senza renderer; viola la regola 1 del README.
- *Seme assente*: nessun modo di riprodurre un livello difettoso né di verificare automaticamente la risolvibilità di migliaia di livelli.

## 4. Rendering, animazioni e input

**Decisione.** La **tavola è un unico `<Canvas>` di React Native Skia**. Le animazioni sono guidate da valori condivisi di Reanimated letti direttamente da Skia. L'input è un **solo gestore di tocco sul canvas** (Gesture Handler) che converte il punto in coordinate di tavola e chiama `hitTest` del dominio. Tutto il resto (menu, finestre, impostazioni, album, rompicapi a griglia) è UI React Native ordinaria.

**Come diventano i disegni.**
- Le 129 stringhe SVG dell'originale si esportano **una sola volta** in file `.svg` statici (script in `tools/`, eseguito sull'HTML originale), più un manifesto con i nomi.
- Le lettere e i numeri (3 `<text>` nell'originale) si convertono in tracciati all'esportazione, per non dipendere dai font.
- Ogni disegno si carica con `Skia.SVG.MakeFromString` e si registra in una `SkPicture` memorizzata: il disegno è indipendente dalla risoluzione, quindi nitido su telefono e tablet.
- Il corpo della tessera (faccia, bordo laterale a due toni, stati selezionata/bloccata/nascosta/nebbiosa/oro/evidenziata) si disegna con primitive Skia dalle tavolozze di tema, così le combinazioni di colori non moltiplicano le risorse.
- Fuochi d'artificio e coriandoli: particelle Skia, sostituiscono il `<canvas>` dell'originale.

**Motivo.**
- Un canvas unico evita centinaia di viste native (fino a 96 tessere, 5 piani, più effetti per tessera) e rende l'ordine di disegno dei piani esplicito.
- Le regole di tocco stanno nel dominio e non nel DOM: la zona toccabile di ogni tessera è definita dal codice, e il limite dell'originale (una tessera coperta si tocca solo dal bordino scoperto di 4-5 px) diventa una scelta modificabile, ad esempio con tolleranza o zoom.
- Skia e Reanimated sono nel pacchetto di librerie gestite dalla SDK 57 e Skia è disponibile anche in Expo Go **[Verificato]**.

**Limite dichiarato.** Con un canvas unico le singole tessere non sono elementi di accessibilità. L'originale non ha accessibilità per le singole tessere (inventario, sezione 11); se verrà richiesta, servirà un livello di accessibilità dedicato (ad esempio azioni su un elenco delle tessere libere) **[Da approfondire]**. Il colore non deve essere l'unica informazione (regola 6): i segnali senza colore dell'originale (tratteggio, contorni) vanno portati.

**[Validato in parte] (prototipo S1).** Il canvas unico resta, ma l'architettura è a due strati, con le sole tessere libere disegnate dal vivo: l'esito e le misure su dispositivo sono in `docs/rendering.md`. Da provare ancora: iOS, tablet, telefono di fascia bassa, animazione di ingresso e fuochi d'artificio.

**Alternative scartate.**

| Alternativa | Vantaggi | Limiti (perché non va) |
|---|---|---|
| Una `View` per tessera con `react-native-svg` | Il più vicino al DOM originale; accessibilità per tessera più semplice. | Fino a 96 viste native animate più parsing SVG; animazioni dei piani e degli effetti più costose; regole di tocco legate alle viste. |
| Sprite sheet PNG precalcolati | Rendering molto veloce. | Sfocatura su tablet e densità diverse; risorse moltiplicate da tavolozze e stati; nessun vantaggio col carico misurato. |
| Lottie / Rive per le animazioni | Animazioni complesse da designer. | Dipendenza in più non richiesta: le animazioni dell'originale sono semplici (selezione, sparizione, combo, nebbia). |
| Motore di gioco (Unity, Godot) | Strumenti per effetti e particelle. | Vedi sezione 2. |

## 5. Orientamento, tablet e layout

**Richiesta.** Interfaccia sempre in verticale su ogni dispositivo, tablet compresi. Verifica nella documentazione ufficiale (17/10/2026):

| Piattaforma | Il blocco in verticale funziona? | Fonte |
|---|---|---|
| Telefoni Android (larghezza minima sotto 600 dp) | **Sì**: le restrizioni di orientamento restano valide | Android 16 e 17 **[Verificato]** |
| Tablet e pieghevoli Android (≥ 600 dp) | **Sì, per i giochi**: dal `targetSdk 36` le app ignorano blocchi di orientamento e ridimensionamento su schermi grandi, ma sono **esenti i giochi, in base all'attributo `android:appCategory`**; l'esenzione vale anche per Android 17, dove sparisce invece l'opt-out generico | Documentazione Android 16 e 17 **[Verificato]** |
| iPhone | **Sì** (la chiave `UIRequiresFullScreen` riguarda solo iPad) | Apple TN3192 **[Verificato]** |
| iPad | **No, non in modo garantito**: da iPadOS 26 la modalità a schermo intero obbligatorio è deprecata e verrà ignorata; Apple chiede di supportare tutte le orientazioni e le scene ridimensionabili. Un blocco si può solo *richiedere* (`prefersInterfaceOrientationLocked`) e il sistema non garantisce di rispettarlo. Alcuni sviluppatori segnalano un avviso in fase di caricamento («il supporto a tutte le orientazioni sarà presto obbligatorio») | Apple TN3192 e forum sviluppatori **[Verificato]**; esito esatto del caricamento **[Da validare]** |

**Decisione (migliore alternativa valida).**
1. **Telefoni, iPhone e Android**: blocco in verticale da configurazione.
2. **Tablet e pieghevoli Android**: blocco in verticale mantenuto dichiarando l'app come gioco con `android:appCategory="game"`. Expo non offre una chiave di configurazione per questo attributo: serve un piccolo *config plugin* locale che lo aggiunga al tag `<application>` **[Da validare]**.
3. **iPad**: l'app dichiara tutte le orientazioni e accetta finestre ridimensionabili (per restare conforme), ma l'esperienza resta **verticale** grazie a una **colonna di gioco**: tutta l'interfaccia (intestazione, tavola, barra azioni) vive in un contenitore verticale centrato con rapporto larghezza/altezza al massimo 3:4; oltre quel rapporto, la colonna occupa l'altezza disponibile e ai lati resta uno sfondo tematico senza controlli. In orizzontale o in finestra larga l'app non si rompe, ma resta una colonna verticale ingrandita. Si prova inoltre a *richiedere* il blocco di orientamento come ottimizzazione, senza farci affidamento **[Da validare]**.
4. **La colonna di gioco si usa anche su Android** (e su iPhone, dove coincide con lo schermo): è la rete di sicurezza se un dispositivo o una modalità (finestra mobile, schermo esterno) ignorasse il blocco.

**Conseguenza di progetto.** Non servono classi di finestra, pannelli laterali né layout orizzontali: la UI si progetta per **una sola colonna** con larghezza tra circa 320 e 768 dp, e il resto è scalatura. È meno lavoro della proposta della revisione 1.

**Regole del layout.**
- La tavola si adatta allo spazio della colonna (dimensione della tessera = minimo tra larghezza e altezza disponibili, proporzione 1 : 1,3). Il tetto della tessera è relativo alla larghezza della colonna, non un valore fisso in pixel; si calibra col prototipo.
- Modali con larghezza massima fissa; griglie (menu livelli, album, sala rompicapi) con numero di colonne calcolato dalla larghezza della colonna.
- Aree sicure con `react-native-safe-area-context` (già nella SDK); controlli con bersaglio minimo di 48 dp; per le tessere vale la regola di `hitTest` della sezione 4.
- Il blocco statico si configura in `app.json` (`orientation`, `ios.supportsTablet: true`, voci `infoPlist` per iPad); `expo-screen-orientation` si aggiunge solo se serve un blocco a runtime.

**[Da validare] (prototipo S3).** (a) Su emulatore di tablet Android 16 (ad esempio Pixel Tablet) con `appCategory="game"`, la rotazione non viene imposta e la colonna resta stabile; (b) il caricamento di una build iPad su TestFlight con solo verticale richiesto non viene rifiutato; (c) proporzioni della colonna (3:4) e tetto della tessera.

**Alternative scartate.**

| Alternativa | Perché non va |
|---|---|
| Layout orizzontali con pannelli laterali su tablet | Esclusi dal requisito di interfaccia sempre verticale. |
| `supportsTablet: false` (su iPad l'app gira in una finestra da telefono) | Niente supporto vero ai tablet, contrario alla decisione 6; rendering ingrandito e meno nitido. |
| `UIRequiresFullScreen` per forzare lo schermo intero su iPad | Deprecata da iPadOS 26 e destinata a essere ignorata. |
| Opt-out Android `PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY` | Temporaneo, rimosso con le app che puntano a `targetSdk 37` (agosto 2027); per un gioco con `appCategory` non serve. |
| Scalare l'interfaccia del telefono a tutto schermo | Tessere enormi e margini sproporzionati. |

Nota: Google ha annunciato `targetSdk 36` obbligatorio per i nuovi invii su Play da agosto 2026 e `targetSdk 37` da agosto 2027 (piano pubblicato: da riverificare in Play Console al momento del rilascio).

## 6. Salvataggi

**Decisione.** Archiviazione locale con **`expo-sqlite`**, dietro interfacce di repository nel livello applicazione (implementate nell'infrastruttura). Nessun cloud per ora; le interfacce lasciano aperta la porta a una sincronizzazione futura (Supabase è già nel tuo stack) **[Da decidere in futuro]**.

**Modello dei dati (bozza).**

| Tabella | Contenuto |
|---|---|
| `meta` | Versione dello schema (`PRAGMA user_version`) |
| `settings` | Impostazioni (chiave, valore) |
| `level_result` | Per livello: stelle migliori, record di tempo, difficoltà massima battuta, tessere d'oro massime |
| `puzzle_result` | Per rompicapo e difficoltà: stelle migliori |
| `album_card` | Carte sbloccate e carte già mostrate |
| `wallet` | ✨ |
| `saved_game` | **Una** partita in corso: versione, identificativo dello spec, seme, mosse, hash della tavola, timestamp |

**Regole.**
- Le scritture sono **transazionali**; la partita si salva dopo ogni mossa con scrittura ritardata di poche centinaia di millisecondi e subito quando l'app passa in secondo piano (`AppState`), che sostituisce `visibilitychange` e `pagehide` dell'originale.
- La partita salvata registra **spec, seme e mosse**; alla ripresa lo stato si ricostruisce e si confronta con l'hash della tavola: se non coincide, il salvataggio si scarta con un messaggio. Corregge il difetto della posizione non verificata.
- **Reset della progressione**: un'unica operazione transazionale che cancella e reinstalla i valori predefiniti da `defaultProgress()`; un test automatico esegue tutti i casi d'uso (rompicapi, vittoria, mappa) subito dopo il reset, senza ricaricare. Corregge il difetto 1.
- **Avvio di un livello con una partita già salvata**: il caso d'uso restituisce «serve conferma» e la UI chiede conferma prima di sostituirla. Corregge il difetto 3.
- Le migrazioni sono funzioni ordinate legate a `user_version`, con test.
- La validazione dei dati letti usa funzioni di guardia scritte a mano nel dominio (`ponytail:` se serve semplificare); `zod` si valuta solo se i formati crescono.
- **Nessuna migrazione** dai dati del gioco HTML (`localStorage`): l'originale è un prototipo personale **[Da confermare]**.

**Alternative scartate.**

| Alternativa | Vantaggi | Limiti (perché non va) |
|---|---|---|
| MMKV | Velocissimo, API semplice. | Nessuno schema, nessuna migrazione, nessuna query; porterebbe a riscrivere blob JSON interi come l'originale e non regge bene un progresso per livello senza limite. |
| AsyncStorage | Incluso nell'ecosistema Expo. | Chiave-valore con JSON, nessuna transazione su più chiavi. |
| File JSON su disco | Semplice. | Nessuna atomicità: rischio di file a metà dopo una chiusura brusca. |
| Realm / WatermelonDB | Ricchi di funzioni. | Eccessivi per una sola app locale. |
| Cloud come fonte primaria | Sincronizzazione tra dispositivi. | Richiede account e backend, fuori ambito. |

## 7. Audio e vibrazione

**Decisione (proposta, da validare).** Gli effetti diventano **campioni** (`.ogg` o `.wav`) generati **una volta** dallo script che rende gli effetti sintetizzati dell'originale (ad esempio con un contesto audio offline nello stesso Chromium usato per gli altri export) e riprodotti con **`expo-audio`**. Le 8 note della scala dell'abbinamento sono 8 file; il volume è per player. La vibrazione usa **`expo-haptics`**.

**Motivo.**
- `expo-audio` è nell'SDK e funziona anche in Expo Go **[Verificato]**; i campioni sono risorse deterministiche e sostituibili da un sound designer senza toccare il codice.
- Il Web Audio dell'originale non esiste in React Native.

Nota: i 14 ms e i 30 ms di vibrazione dell'originale non hanno equivalente esatto: gli haptics usano stili di impatto (leggero, medio) e non una durata, soprattutto su iOS.

**[Verificato] (prototipo S2).** Su un dispositivo Android in modalità `--no-dev --minify` la combo a 8 note (intervalli 80-200 ms) e la polifonia non mostrano ritardi percepibili o drop: decisione confermata, piano B non necessario.

**Alternative scartate.**
- *`react-native-audio-api`* (Software Mansion, compatibile con Web Audio): permetterebbe di portare il sintetizzatore quasi 1:1 senza risorse, ma è un modulo nativo non incluso in Expo Go **[Verificato]** e una dipendenza più giovane da mantenere. Resta il **piano B** se il prototipo S2 mostra latenze troppo alte.
- *`expo-av`*: sostituita da `expo-audio` e `expo-video` nello sviluppo di Expo **[Da verificare nello stato della SDK 57]**.
- *Sintetizzare a runtime con codice proprio*: reinventa un motore audio senza vantaggi sul piano B.

## 8. Lingue

**Decisione.**
- Rilevamento con **`expo-localization`**: si sceglie la prima lingua preferita del dispositivo che sia supportata; se nessuna lo è, **inglese**. La scelta manuale in Impostazioni prevale e viene salvata.
- Testi con **`i18next` + `react-i18next`**: un file JSON per lingua, chiavi tipizzate a partire dall'inglese, plurali gestiti dalla libreria, spazi dei nomi separati per testi dell'interfaccia (`ui`) e nomi di tessere e livelli (`tiles`).
- **Test di parità**: ogni lingua ha esattamente le chiavi della lingua di riferimento (l'originale già verifica 254 chiavi coerenti tra FR, EN e IT): il test fallisce se manca o avanza una chiave.
- Parole del «Cerca parole»: file `wordlists/<lingua>.json`, con regole di validità per lingua (alfabeto, lunghezza massima rispetto alla griglia). Una lingua senza lista usa l'inglese **[Da decidere]**.
- Aggiungere una lingua = aggiungere un file di testi, un file di parole e, se necessario, il nome mostrato nel selettore: nessun cambiamento di codice.

**Fuori ambito per ora.** Alfabeti non latini e lingue da destra a sinistra: la struttura li permette (stringhe e parole trattate per grafemi, nessun testo nel codice) ma non vengono verificati ora **[Da approfondire]**.

**Alternative scartate.** *i18n-js* (più leggera, ma meno funzioni sui plurali); *Lingui* (estrazione e compilazione a build, complessità aggiuntiva per un progetto con poche lingue); *FormatJS* (più pesante); *soluzione propria* (riscrive plurali e interpolazione).

## 9. Monetizzazione

La proposta segue le regole di progettazione del flusso utente: ogni annuncio sta in un momento naturale del percorso, non durante l'azione di gioco. Non è una garanzia di ricavi né una consulenza legale.

**Pubblico dell'app [Deciso].** Confermata l'opzione A: app **non destinata ai bambini**. Conseguenze: AdMob standard con consenso; dichiarazione coerente del pubblico in Play Console e nelle risposte dell'App Store; la Modalità comoda (etichettata «senior» nell'originale) non cambia il target. Nota: la grafica con animali stilizzati può risultare attraente per i bambini, quindi la dichiarazione va fatta con attenzione e le regole correnti degli store vanno rilette prima della pubblicazione **[Da verificare]**. Se il pubblico cambiasse (misto o bambini) varrebbero le regole delle app per famiglie (filtro d'età neutro, SDK pubblicitari certificati) **[Verificato]**: sarebbe una variazione sostanziale della monetizzazione.

**Decisione.** Gioco gratuito con **AdMob** tramite **`react-native-google-mobile-ads`** (con plugin di configurazione Expo).

| Momento | Formato | Comportamento |
|---|---|---|
| Fine livello, passaggio al successivo | Interstitial | Mai a partita in corso; frequenza limitata da un tempo minimo e da un numero minimo di livelli (parametri configurabili, valori **da calibrare**); precaricamento dopo ogni visualizzazione o fallimento; scadenza dell'annuncio gestita. |
| ✨ finiti nella sala Rompicapi | Rewarded | «Guarda un video e ottieni 1 ✨»: valore chiaro in cambio; si abbina alla struttura dei ✨ già presente nell'originale. |
| Aiuti esauriti in partita | Rewarded (**deciso: sì**) | «+1 aiuto»: limite per livello e per difficoltà **da calibrare** perché l'equilibrio delle difficoltà alte non vada perso (il Maestro non ha aiuti iniziali). |
| Schermata di gioco | Nessun banner | Rischio di tocchi accidentali vicino alla tavola e meno spazio per le tessere. |

**Consenso e privacy.** Modulo di consenso **UMP** (`AdsConsent`) prima dell'inizializzazione; su iOS il permesso di tracciamento (ATT) viene gestito dal flusso UMP o con una libreria di permessi **[Verificato]**; `app-ads.txt` sul dominio dello sviluppatore; dispositivi di test per non cliccare mai annunci reali.

**Architettura.** Il dominio non sa nulla di pubblicità (regola 1): il livello applicazione espone un'interfaccia `AdsService`; l'infrastruttura la implementa con AdMob; un'implementazione `NoAds` copre sviluppo, assenza di consenso e un'eventuale rimozione delle pubblicità. Sempre definito il comportamento quando non c'è nessun annuncio: si prosegue senza attese.

**Misurazione.** Impression, tasso di visualizzazione, eCPM, ricavo per sessione e, soprattutto, completamento dei livelli e ritenzione, per misurare il costo in esperienza. Un solo eCPM non basta per giudicare un cambio.

**Alternative scartate (per ora).**
- *Mediazione con altre reti*: più SDK, più peso dell'app e più implicazioni di privacy; si rivaluta con dati reali.
- *Solo banner*: ricavi bassi e rischio di tocchi accidentali sulla tavola.
- *App a pagamento o abbonamento*: contraddice il modello gratuito con pubblicità scelto per il progetto e non si abbina a un motore di livelli infiniti.
- *Acquisto «Rimuovi pubblicità»*: non c'è nell'originale; richiede una libreria di acquisti **[Da decidere]**.

## 10. Contenuti e aggiornamenti OTA

**Obiettivo.** Diffondere nuove isole, nuove carte d'album e nuovi rompicapi senza passare da una revisione dello store per ogni contenuto.

**Cosa si può aggiornare via OTA [Verificato].** EAS Update (libreria `expo-updates`) aggiorna le parti *non native* dell'app: JavaScript, stili e immagini. Non si possono aggiornare codice nativo, dipendenze native, versione della SDK Expo e config plugin. Gli aggiornamenti sono legati a una *runtime version* che li invia solo alle build compatibili e restano soggetti alle linee guida degli store come qualsiasi release; esiste la firma del codice end-to-end.

**Principio di progetto: contenuti come dati, codice separato.**

| Cosa | Natura | Via OTA |
|---|---|---|
| Nuove isole e temi (set di 14 disegni SVG, tavolozze, nomi tradotti, regole di generazione) | Dati e risorse | Sì |
| Nuove carte d'album | Dati e risorse | Sì |
| Nuove liste di parole, nuove traduzioni | Dati | Sì |
| Nuove forme e parametri dei livelli | Dati | Sì |
| Nuovo *tipo* di rompicapo (meccanica nuova) | Codice JavaScript | Sì con EAS Update, se non servono moduli nativi; altrimenti release su store |
| Nuovi moduli nativi (altro SDK, nuovi permessi), cambio di SDK Expo | Nativo | No: release su store |

**Mezzi a confronto.**

| Mezzo | Vantaggi | Limiti |
|---|---|---|
| **EAS Update** | Nessuna infrastruttura propria; versioni e canali (anteprima, produzione); firma del codice; aggiorna anche codice JavaScript | Dipende dal servizio Expo; limiti e costi del piano da verificare; ogni aggiornamento passa dal ciclo di pubblicazione di Expo |
| Pacchetti di contenuto remoti (JSON e SVG firmati su storage proprio, ad esempio Supabase Storage, già usato dallo sviluppatore) | Solo dati, nessuna questione sul codice scaricato; indipendenti dalle build; si possono scaricare a richiesta | Più codice da scrivere e mantenere (manifesto, versioni, firma, cache, comportamento offline) |
| Solo release su store | Nessuna complessità aggiuntiva | Lento; una revisione per ogni isola |

**Decisione.** Partire con **EAS Update**, tenendo i contenuti dietro un'interfaccia `ContentRepository` nell'infrastruttura: se in futuro servirà scaricare i pacchetti a richiesta, si sostituisce l'implementazione senza toccare dominio e UI.

**Regole di compatibilità.**
1. Ogni pacchetto ha `contentVersion` e versione minima dell'app; l'app ignora pacchetti che non comprende.
2. I contenuti sono **append-only**: gli identificativi (isole, livelli, carte, disegni, rompicapi) non si rinominano né si riusano.
3. La partita salvata registra identificativo dello spec e `contentVersion`; se un aggiornamento cambia o rimuove lo spec in uso, la partita si scarta con un messaggio (stesso meccanismo dell'hash della sezione 6).
4. Gli aggiornamenti si applicano **all'avvio successivo**, mai a partita in corso.
5. Prima di ogni pubblicazione, in integrazione continua: validazione dei pacchetti (schema, identificativi unici, chiavi di traduzione presenti in tutte le lingue, SVG validi, ogni spec risolvibile con un campione di semi).
6. Prima del primo aggiornamento che contenga *codice*, rileggere le regole correnti di Apple e Google sul codice scaricato **[Da verificare]**.

**Alternative scartate.** *Contenuti sempre dentro il binario*: una revisione dello store per ogni isola, in contrasto con l'obiettivo. *Aggiornare codice nativo via OTA*: tecnicamente impossibile.

## 11. Verifica

**Decisione.**
- **Dominio**: Jest su ogni regola; test sui semi: per un insieme fisso di semi e di `LevelSpec`, il solver conferma che ogni tavola generata è risolvibile (ciclo deterministico, senza librerie aggiuntive).
- **Regressione sulla campagna dell'originale**: test che confrontano tessere, piani e aiuti dei 100 livelli esportati con le tabelle dell'inventario.
- **Persistenza**: test sulle migrazioni, sul reset e sulla ricostruzione della partita.
- **Lingue**: test di parità delle chiavi.
- **UI, rendering e integrazioni native** (Skia, audio, annunci, tablet): verifica manuale su dispositivo reale e su emulatori di tablet e pieghevole; in chat non è verificabile e va dichiarato come tale (regola 8).
- Integrazione continua con controllo dei tipi, lint e Jest su ogni consegna; la build EAS resta manuale.

**Alternative scartate.** *Solo test manuali*: nessuna garanzia sulla risolvibilità di livelli infiniti. *Test end-to-end subito* (Maestro, Detox): valore basso finché la UI cambia di continuo; si rivalutano a UI stabile **[Da approfondire]**.

## 12. Dipendenze

Ogni dipendenza è motivata (regola 5). Le versioni sono quelle della SDK in uso.

| Dipendenza | Motivo |
|---|---|
| `expo`, `expo-router`, `expo-build-properties` | Piattaforma, navigazione, opzioni di build richieste dal modulo annunci |
| `@shopify/react-native-skia` | Canvas della tavola, tessere, effetti |
| `react-native-reanimated`, `react-native-worklets` | Animazioni guidate da valori condivisi (Reanimated 4 richiede il pacchetto worklets) |
| `react-native-gesture-handler` | Gestione del tocco sul canvas |
| `react-native-safe-area-context` | Aree sicure e layout adattivo |
| `zustand` | Stato di gioco consultabile a selettori: il canvas non deve ridisegnarsi per ogni cambiamento (alternative scartate: Context, per i ridisegni inutili; Redux Toolkit, eccessivo) |
| `expo-sqlite` | Salvataggi (sezione 6) |
| `expo-audio`, `expo-haptics` | Effetti sonori e vibrazione (sezione 7) |
| `expo-localization`, `i18next`, `react-i18next` | Lingue (sezione 8) |
| `expo-updates` | Aggiornamenti OTA di contenuti e rompicapi (sezione 10) |
| `react-native-google-mobile-ads` | Pubblicità e consenso (sezione 9) |
| `jest` (via `jest-expo`) | Test del dominio |

## 13. Prototipi di validazione

Piccoli esperimenti da fare **prima** di fissare le decisioni segnate come da validare. Ognuno ha un esito misurabile.

| Id | Domanda | Esito atteso |
|---|---|---|
| S1 | Skia rende fedelmente i 129 SVG esportati (compresi quelli con testo convertito)? Il livello 20 (96 tessere, 5 piani) con le animazioni gira fluido su un Android di fascia bassa? | Differenze visive con l'originale elencate; fotogrammi al secondo misurati. |
| S2 | `expo-audio` con campioni regge 8 note in combo ravvicinata senza ritardi percepibili? | Latenza misurata; se alta, passaggio al piano B. Eseguito: provato su Android con `--no-dev --minify`, riproduzione fluida senza ritardi, decisione `expo-audio` confermata (`prototipi/s2-audio/README.md`). |
| S3 | Il blocco verticale regge su tablet Android 16 con `appCategory="game"` (config plugin) e su iPad (caricamento TestFlight)? La colonna di gioco 3:4 funziona su telefono, tablet e finestra larga? | Esito dei due controlli; proporzioni della colonna e tetto della tessera scelti con schermate. |
| S4 | Il generatore con seme crea una tavola da 96 tessere in Hermes in un tempo accettabile, e il solver la verifica? | Tempo medio e massimo su un campione di semi. Eseguito: su Android generazione media 0,9 ms e massimo 17,6 ms, nessun fallimento, solver al più 218 ms (`docs/motore-livelli.md`). |
| S5 | EAS Update su una build di sviluppo: un pacchetto dati di prova (isola nuova) arriva, si applica all'avvio successivo e una partita salvata resta valida o viene scartata correttamente? | Flusso OTA funzionante e regole di compatibilità (sezione 10) verificate. Eseguito: 5 test automatici con tsx, prototipo interattivo in `prototipi/s5-ota/`, confermate le 4 regole di compatibilità (append-only, hash tavola e applicazione all'avvio successivo). |

## 14. Riepilogo per il README (sezione 5, «Decisioni vigenti»)

La tabella è già nel formato del template; la colonna *Scartato e perché* è formulata come vincolo attuale. Se differisce dal README, vale il README.

| Decisione | Motivo | Scartato e perché |
|---|---|---|
| Expo SDK 57 con TypeScript `strict`, development build via EAS, Expo Router | Stack già in uso; New Architecture obbligatoria; serve una build nativa per gli annunci | Non usare Flutter o app native doppie: stack nuovo o due codebase; non avvolgere l'HTML in una WebView: contraddice la riscrittura |
| Quattro livelli (dominio, applicazione, infrastruttura, UI); dominio puro con stato immutabile | Logica testabile senza dispositivo; regola 1 del README | Non mettere logica nei componenti: non testabile senza renderer |
| Livelli descritti da `LevelSpec` e generati con PRNG con seme; campagna dell'originale esportata in JSON | Livelli infiniti, test deterministici, porting fedele e verificabile | Non usare `Math.random` senza seme: livelli non riproducibili e risolvibilità non verificabile |
| Progresso sparso per indice di livello e di isola; spiegazioni legate alla prima comparsa di una meccanica; isole come dati (`IslandSpec`) | Compatibile con isole e livelli infiniti | Non usare soglie cumulative fisse di stelle: lasciano un margine costante e diventano sempre più severe |
| Tavola in un unico canvas Skia, animazioni Reanimated, tocco con `hitTest` del dominio | Meno viste native, zone di tocco governate dalle regole | Non usare una vista per tessera con SVG: costo e regole di tocco legate alle viste; non usare sprite PNG: sfocatura su tablet e risorse moltiplicate |
| Disegni esportati una volta in SVG statici (testi convertiti in tracciati) | Indipendenti dalla risoluzione, nessun font da caricare | Non portare le stringhe SVG nel codice: non riusabili e non testabili |
| Interfaccia sempre verticale: blocco da configurazione su telefoni e, con `android:appCategory="game"`, su tablet Android; su iPad tutte le orientazioni dichiarate ma gioco in colonna verticale centrata (rapporto massimo 3:4) | I giochi sono esentati dalle restrizioni di Android 16 e 17; iPadOS 26 non garantisce il blocco | Non usare layout orizzontali con pannelli laterali (esclusi); `supportsTablet: false` (nessun supporto tablet); `UIRequiresFullScreen` (deprecata) |
| Salvataggi in SQLite con transazioni, migrazioni e partita ricostruibile da spec, seme e mosse | Atomicità, versioni, progresso illimitato; corregge i difetti 1, 3 e 5 | Non usare MMKV, AsyncStorage o file JSON: niente transazioni o schema |
| Effetti come campioni con `expo-audio`; vibrazione con `expo-haptics` | Funziona in Expo Go; risorse sostituibili | Non usare `react-native-audio-api` come prima scelta: modulo nativo e dipendenza più giovane (piano B) |
| Lingue con `expo-localization` e `i18next`, inglese come predefinita, test di parità delle chiavi | Aggiungere una lingua senza modificare il codice | Non usare soluzioni proprie: riscrivono plurali e interpolazione |
| App non destinata ai bambini; pubblicità AdMob con `AdsService` dietro interfaccia; interstitial a fine livello, rewarded per i ✨ e per gli aiuti; nessun banner in partita | Momenti naturali del percorso; il dominio non conosce gli annunci | Non mettere banner in partita: tocchi accidentali; non aggiungere mediazione per ora: peso e privacy |
| Contenuti come dati dietro `ContentRepository`; aggiornamenti OTA con EAS Update (dati, risorse e codice JavaScript dei rompicapi), contenuti append-only e applicati all'avvio successivo | Nuove isole, carte e rompicapi senza una revisione dello store per ciascuno | Non aggiornare codice nativo via OTA (impossibile); non inserire i contenuti solo nel binario: una revisione per ogni isola |

**Nota:** le righe segnate **[Da decidere]** o **[Da validare]** nel documento entrano nel README come `TO DO` o `DRAFT` (sezione 8 del template), non come decisioni.

## 15. Punti aperti

Tutte le domande della revisione precedente sono chiuse: progressione B con isole da 20 livelli, colonna verticale su iPad, OTA con EAS Update. Restano `DRAFT` e `TO DO` nel README, sezione 8 (prototipi S1-S5, taratura dell'indice di difficoltà, estensione a 20 livelli delle isole 3-7 dell'originale).
