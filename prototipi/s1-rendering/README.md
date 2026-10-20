# S1 — rendering Skia dei disegni e della tavola (prototipo)

Il prototipo S1 risponde a due domande del README principale (sezione 8): Skia rende fedelmente i 129 disegni esportati dall'originale? E la tavola del livello 20 (96 tessere, 5 piani) con le animazioni gira fluida su un Android di fascia bassa? È un esperimento usa e getta: non fa parte dell'app e il suo codice non si riusa così com'è.

## Cosa contiene

| Percorso | Contenuto |
|---|---|
| `assets/tiles/000.svg … 128.svg` | I 129 disegni esportati dall'originale (`viewBox 0 0 60 80`), con i testi già convertiti in tracciati |
| `src/data/level20.json` | Geometria del livello 20 dell'originale (96 tessere, 5 piani, 24 disegni). L'assegnazione dei disegni è un campione: l'originale la genera a caso a ogni partita |
| `src/board.ts` | Geometria della tavola, tessera libera (`isFree`), `hitTest`, colonna di gioco 3:4. Funzioni pure, con test in `src/board.test.ts` |
| `src/TileBoard.tsx` | Tavola in un unico `<Canvas>` Skia; animazioni con valori condivisi di Reanimated; tocco con `hitTest` |
| `src/TileBoardLayered.tsx` | Tavola a due strati: le tessere ferme in un'unica immagine (`drawAsImage`), solo quelle animate disegnate dal vivo |
| `src/TileBody.tsx` | Corpo della tessera (bordo, ombra, faccia) e sua versione in cache: un'immagine disegnata una volta con `drawAsImage` |
| `src/Gallery.tsx` | Griglia dei 129 disegni |
| `src/FpsMeter.tsx` | Misura i fotogrammi sul thread UI (`useFrameCallback`) e l'eco di andata e ritorno col thread UI |
| `src/perf.ts`, `src/layout.ts` | Ritardo del thread JS; altezza dell'intestazione condivisa con la prova web |
| `src/SvgAt.tsx` | Disegna un SVG in una posizione (aggira un limite di `ImageSVG`, vedi «Problemi trovati») |
| `tools/` | Esportazione dall'originale, conversione dei testi, confronto di fedeltà, prova web |

L'interfaccia ha undici pulsanti: **Tavola** e **Galleria** cambiano schermata; **Anima** fa oscillare le tessere; **Ombre** aggiunge l'ombra sfocata a ogni tessera; **Entrata** rigioca l'animazione di ingresso a ritardi sfalsati; **Memo** attiva o disattiva la stabilità delle proprietà delle tessere; **Cache** disegna il corpo delle tessere come immagine in cache; **Strati** passa alla tavola a due strati; **Vive N** sceglie quante tessere sono animate dal vivo nella tavola a strati (0, 2, 8, 24, 96); **Prova 1** e **Prova 2** eseguono le prove automatiche. In alto: caricamento degli SVG, tessere libere, dimensione della tessera, fotogrammi del thread UI, ritardo dall'ultimo tocco al commit di React e ultima tessera toccata.

## Prove automatiche

Ogni prova esegue passaggi di 6,5 secondi (1,5 di riscaldamento e 5 di misura) e mostra una tabella; l'esito va anche nel log con il prefisso `S1-BENCH`. In ogni passaggio simula un tocco ogni 0,4 secondi su una tessera libera diversa. **Prova 1** (10 passaggi) confronta memo e cache; **Prova 2** (6 passaggi) confronta la tavola tutta dal vivo con la tavola a strati e con un numero crescente di tessere vive.

Colonne: `m` memo, `c` cache del corpo (+ attivo, − spento); fps medi del thread UI; `pegg` = peggior fotogramma; `JS` = ritardo massimo del thread JS (un timer da 20 ms che arriva in ritardo); `tocco` = tempo medio e massimo dal gesto al commit di React; `eco` = andata e ritorno di un messaggio JS → thread UI → JS, medio e massimo; `img` = tempo per costruire l'immagine dello strato fermo. Tutti i tempi sono in millisecondi.

Per misure realistiche eseguire l'app in modalità di produzione: `npx expo start --no-dev --minify`.

## Esecuzione su dispositivo

```bash
cd prototipi/s1-rendering
npm install
npx expo start
```

Aprire poi l'app con Expo Go su Android. Se l'Expo Go dello store non supporta ancora la SDK 57, costruire una build di sviluppo con `npx expo run:android`. Per provarla in un browser: `npm run setup:web && npx expo start --web`.

## Comandi di verifica

| Comando | Cosa verifica |
|---|---|
| `npm run typecheck` | Tipi TypeScript |
| `npm test` | Test del dominio (`src/board.test.ts`) con il runner di Node, senza dipendenze aggiuntive |
| `npm run setup:web && npm run web:build` | Copia CanvasKit in `public/` e produce `dist/` per il web |
| `node tools/web-test.mjs [cartella]` | Prova in Chromium headless: caricamento dei 129 SVG, tocco confrontato con `hitTest`, errori in console, screenshot |
| `python3 tools/fidelity.py assets/tiles <cartella> 3` | Confronto pixel tra il motore SVG di Skia e Chromium sui 129 disegni (richiede `skia-python`, `numpy`, `pillow`, `playwright`) |

Per rigenerare gli asset dall'originale (dopo la patch di riallineamento, l'originale sta in `reference/majoa-originale/`):

```bash
node tools/export-designs.js "../../reference/majoa-originale/Majoa Mahjong.html" .
python3 tools/text_to_paths.py assets/tiles <Poppins-Bold.ttf> <DejaVuSerif-Bold.ttf>
node tools/generate-tile-index.js
```

I due font sono una scelta provvisoria con licenza libera: la scelta definitiva del carattere di lettere e numeri è una decisione di grafica.

## Risultati (18/10/2026)

| Domanda | Esito | Come è stato misurato |
|---|---|---|
| Il motore SVG di Skia legge i 129 disegni? | Sì: 129 su 129, nessun errore | `skia-python` 144 (modulo SkSVG), `tools/fidelity.py` |
| Il risultato coincide con Chromium? | 127 identici; 2 con differenza media di al più 0,001 su 255; nessuno con più dell'1% di pixel diversi | Confronto pixel a 180 × 240 |
| E i testi? | **SkSVG non disegna `<text>`**: 11 tessere (A, M, 7, 3, K, Z, 5, 9, π, ∞, √) risultavano senza lettera. Convertiti in tracciati, ora identici | Confronto prima e dopo la conversione, controllo visivo |
| Il tocco funziona? | Sì: 3 prove su 3 coincidono con `hitTest` (tessera in cima, tocco fuori, bordino di una tessera coperta), con telefono (390 dp) e finestra larga (1280 dp) | `tools/web-test.mjs` |
| Quanto è raggiungibile una tessera libera? | Delle 96 tessere, 26 sono libere all'inizio; ognuna è raggiungibile per almeno l'84% della propria area (telefono) | `src/Main.tsx`, `visibleFraction` |
| Il bundle nativo si compila? | Sì per Android e per iOS (Hermes, circa 1420 moduli) | `expo export --platform android` e `ios` |
| Fotogrammi su un Android | Primo test dell'utente, con «Anima» e «Ombre» attivi: **21 fps, peggior fotogramma 50 ms**; 129 SVG caricati in 933 ms. Modello del dispositivo non indicato | Schermata inviata dall'utente |
| Ritardo della selezione al tocco | **Circoscritto, non risolto**: sul dispositivo la selezione arrivava dopo circa 2 secondi; compare con le animazioni su tutte le tessere (eco medio fino a 2,7 s), non con la scena ferma né con le ombre. Correzione a strati da verificare su dispositivo | Prova 1 dell'utente, sezione «Ritardo al tocco» |

Nota sul tocco: la tessera coperta si raggiunge solo dal bordino scoperto (4-5 px tra i piani), ma le tessere coperte non sono selezionabili nel gioco. Il limite pesa solo sul feedback «ecco cosa la blocca»; per le tessere libere l'area utile è quasi intera.

### Limiti della verifica

- `skia-python` usa la versione 144 di Skia; React Native Skia 2.6.2 incorpora una versione diversa (non verificata). Il modulo SVG è lo stesso, ma l'esito va riconfermato su dispositivo.
- Su web React Native Skia disegna gli SVG con l'elemento `<img>` del browser (`JsiSkSVGFactory`): la prova web **non** collauda il motore SVG nativo, ma l'integrazione dell'app.
- Gli fps misurati in Chromium headless (WebGL software, 1-6 fps) non sono rappresentativi.
- L'app non è stata eseguita su dispositivo né su emulatore.
- `expo-doctor` passa 19 controlli su 21; i due falliti richiedono l'accesso a `exp.host`, non raggiungibile dall'ambiente di prova.

### Problemi trovati

1. **`<text>` non viene disegnato dal motore SVG di Skia.** Rimedio: conversione in tracciati in fase di esportazione (`tools/text_to_paths.py`).
2. **`ImageSVG` ignora x e y se uno dei due è zero** (`sksg/Recorder/commands/Drawing.js`: `if (x && y) canvas.translate(x, y)`): i disegni con `x=0` o `y=0` finiscono tutti in `(0, 0)`. Rimedio: `src/SvgAt.tsx` trasla con un `Group`. Il codice è del player JavaScript di Skia; che valga anche su nativo è da confermare su dispositivo.
3. **`Image.resolveAssetSource` non esiste su `react-native-web`.** Rimedio: `loadData` di Skia, che risolve l'asset su ogni piattaforma.
4. **`setup-skia-web` copia `canvaskit.wasm` in `web/static/js/`** invece che in `public/` con questo progetto Expo. Rimedio: lo script `npm run setup:web`.
5. **TypeScript 6 non include più i tipi di `@types/*` per impostazione predefinita.** Rimedio: `"types": ["node"]` in `tsconfig.json`.
6. **Versione della SDK.** Al 18/10/2026 npm indica Expo 58 come `latest` (React Native 0.88.0, pubblicato il 15/10/2026). Il prototipo usa la 57, come da README: se passare alla 58 prima di creare l'app è una decisione da prendere.

### Ritardo al tocco: esito della Prova 1 su dispositivo

Misure dell'utente (Android, modalità di produzione, modello non indicato; ms salvo indicazione):

| Passaggio | fps | pegg | JS | tocco medio/max | eco medio/max |
|---|---|---|---|---|---|
| m− c− fermo | 50 | 83 | 135 | 32/46 | 74/137 |
| m− c− Anima+Ombre | 21,5 | 100 | 2870 | 50/51 | 2746/2890 |
| m+ c− fermo | 48,4 | 67 | 121 | 39/153 | 81/151 |
| m+ c− Anima | 45,6 | 67 | 1523 | 36/75 | 914/1239 |
| m+ c− Ombre | 39,8 | 117 | 212 | 31/69 | 74/205 |
| m+ c− Anima+Ombre | 21,3 | 100 | 2678 | 34/48 | 2357/2699 |
| m+ c+ fermo | 51 | 84 | 156 | 31/58 | 41/102 |
| m+ c+ Anima | 50,2 | 50 | 823 | 24/25 | 745/844 |
| m+ c+ Ombre | 53,2 | 83 | 116 | 38/107 | 61/119 |
| m+ c+ Anima+Ombre | 51,3 | 34 | 1160 | 23/27 | 853/1181 |

Cosa dicono i numeri:

1. **Il ritardo non nasce nel commit di React.** `tocco` resta tra 23 e 50 ms in ogni passaggio e «memo sì» e «memo no» sono indistinguibili (fermo: 32/46 contro 39/153; Anima+Ombre: 50/51 contro 34/48). La memoizzazione corretta resta, ma non spiega i due secondi.
2. **La scena ferma va bene, anche con le ombre.** Con «fermo» 48-51 fps ed eco di 41-81 ms; con «Ombre» da sole 40-53 fps ed eco di 61-74 ms. Le ombre sfocate costano fotogrammi (40 contro 53 fps con la cache), non ritardo.
3. **Il ritardo compare con «Anima».** L'eco medio sale a 914 ms (745 ms con la cache), e con «Anima+Ombre» senza cache a 2,4-2,7 secondi: coincide con i «due secondi» segnalati. Anche il ritardo del thread JS arriva a 0,8-2,9 secondi.
4. **La cache aiuta molto ma non basta.** Con «Anima+Ombre» porta i fotogrammi da 21 a 51 fps e l'eco medio da 2357 a 853 ms, ma restano ritardi di 0,7-1,2 secondi con tutte le 96 tessere animate.
5. **I fotogrammi da soli ingannano.** Con cache e «Anima+Ombre»: 51 fps, ma eco di 853 ms. Fotogrammi alti e ritardo alto possono coesistere.

Meccanismo probabile, **letto nel codice di React Native Skia 2.6.2** (`sksg/Container.native.js`) e non misurato: ogni proprietà animata è un valore condiviso, e a ogni suo cambiamento un «mapper» rigioca sul thread UI l'intera registrazione di disegno, cioè tutte le tessere, non solo quelle animate. Il costo per fotogramma segue quindi le tessere disegnate, e anche una sola tessera animata rigiocherebbe tutte le 96. Il passaggio «A tutto dal vivo, 2 animate» della Prova 2 serve a verificarlo.

### Prova 2: architettura a strati

Le tessere ferme stanno in un'unica immagine (un solo `<Image>`); solo le tessere animate sono disegnate dal vivo. Se il meccanismo sopra è giusto, il costo dovrebbe seguire le tessere vive. Prova in Chromium con WebGL software (indicativa, non rappresentativa di un dispositivo):

| Passaggio | fps | tocco medio/max | eco medio/max | img |
|---|---|---|---|---|
| A tutto dal vivo, 2 animate | 10,6 | 140/248 | 72/282 | |
| B a strati, 0 vive | 40,2 | 3/15 | 11/38 | 1913 |
| B a strati, 2 vive | 59,8 | 5/15 | 8/21 | 813 |
| B a strati, 8 vive | 56,1 | 17/58 | 9/16 | 814 |
| B a strati, 24 vive | 29,6 | 39/65 | 13/22 | 669 |
| B a strati, 96 vive | 10,9 | 130/228 | 73/405 | 107 |

Su Chromium il comportamento è coerente con il meccanismo: con 2-8 tessere vive la tavola è fluida e il tocco immediato; il costo cresce con le tessere vive e a 96 torna quello di «tutto dal vivo». La colonna `img` è la grandezza nuova da misurare sul dispositivo: tempo per ricostruire l'immagine dello strato fermo, che serve a ogni rimozione di una coppia; se è troppo alto (oltre un centinaio di millisecondi) la soluzione va riprogettata.

### Da misurare su dispositivo

Eseguire **Prova 2** in modalità di produzione e riportare la tabella. Poi aprire **Galleria** e verificare che tutti i disegni siano presenti, comprese le tessere con lettere, numeri e simboli (A M 7 3 K Z 5 9 π ∞ √). Soglia proposta (da confermare): con 2-8 tessere vive almeno 50 fps, eco medio sotto 50 ms e `img` sotto 100 ms.

| Dispositivo | Android | Modalità | Esito della Prova 2 («B a strati, 8 vive») |
|---|---|---|---|
|  |  |  |  |
