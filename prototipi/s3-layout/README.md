# S3 — Orientamento, tablet Android e colonna di gioco (prototipo)

Il prototipo S3 risponde a una domanda del README principale (sezione 8) e di `docs/decisioni-tecniche.md` (sezioni 5 e 13): **il blocco verticale regge su tablet Android 16 con `appCategory="game"` e la colonna di gioco 3:4 funziona su telefono, tablet e finestra larga?**

> **Nota di destinazione:** La piattaforma target primaria del progetto è **Android** (telefoni, tablet, pieghevoli); la versione iOS non è prioritaria.

## Cosa contiene

| Percorso | Contenuto |
|---|---|
| `plugins/withAppCategory.js` | Config Plugin Expo locale che inietta `android:appCategory="game"` nel tag `<application>` dell'AndroidManifest |
| `src/layout.ts` | Funzioni pure di dominio: `computeGameColumn` (colonna centrata con rapporto max 3:4 e tetto 640 dp) e `computeTileScale` (calcolo dimensioni tessere con tetto a 60 dp e tocco min 44 dp) |
| `src/layout.test.ts` | 6 test automatici per le diverse classi di dispositivo (Pixel 7, Pixel Tablet portrait/landscape, desktop/DeX, tetto tessere e plugin manifest) |
| `App.tsx` | Schermata dimostrativa con simulatore visivo di preset (telefono, tablet verticale, tablet orizzontale, DeX) e rendering delle bande laterali |
| `package.json`, `app.json`, `tsconfig.json` | Configurazione Expo SDK 57 |

## Come funziona

### 1. Blocco verticale su tablet Android 16 e 17 (`appCategory="game"`)
A partire da `targetSdk 36` (Android 16), Android ignora le restrizioni di orientamento sulle app per schermi grandi (larghezza minima ≥ 600 dp). Tuttavia, la documentazione ufficiale stabilisce che **i giochi sono esenti da questa restrizione** se dichiarano l'attributo `android:appCategory="game"`.

Il plugin `plugins/withAppCategory.js` applica questa dichiarazione a build/prebuild nel tag `<application>`:
```xml
<application android:name=".MainApplication" android:appCategory="game" ...>
```

### 2. Colonna di gioco centrata (rapporto max 3:4)
Qualora il dispositivo ignori il blocco (es. finestre mobili, modalità multi-window o Samsung DeX), l'interfaccia non si rompe e non richiede layout orizzontali complessi:
- **Su telefono (schermo verticale < 3:4)**: la colonna occupa il 100% della larghezza disponibile.
- **Su tablet o schermi larghi (> 3:4)**: la larghezza della colonna si vincola al massimo a `altezza × 0.75` (fino a un tetto massimo di 640 dp), rimanendo ancorata al centro dello schermo con sfondo tematico ai lati.

### 3. Tetto della tessera (Tile Capping)
Su tablet con schermi da 10" a 12", tessere proporzionate alla larghezza dello schermo diventerebbero giganti e disarmoniche. La funzione `computeTileScale`:
- Garantisce un bersaglio minimo di tocco di **44 dp**.
- Fissa un **tetto massimo a 60 dp** di larghezza: oltre questo valore, la tavola Mahjong rimane centrata nella colonna senza deformarsi.

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm test` | Esegue i 6 test con `tsx` |
| `npm run typecheck` | Controllo tipi TypeScript (`tsc --noEmit`) |
| `npx expo config --type prebuild` | Verifica che il config plugin sia registrato correttamente |
| `npx expo start` | Avvia l'interfaccia interattiva con simulatore di risoluzioni |

## Risultati (27/10/2026)

- **Test unitari**: 6 su 6 superati con successo:
  - Pixel 7 (412 × 915): colonna al 100%, nessun margine.
  - Pixel Tablet verticale (800 × 1280): colonna limitata a 640 dp, 80 dp di margine per lato.
  - Pixel Tablet orizzontale (1280 × 800): colonna 3:4 (600 dp centrata, 340 dp di margine per lato).
  - Schermo 1920 × 1080 (DeX): colonna limitata a 640 dp centrata.
  - Tetto tessere: applicato correttamente a 60 dp su griglie larghe.
  - Config plugin: iniezione di `android:appCategory="game"` convalidata.
- **Conclusione**: il modello della colonna 3:4 e la configurazione `appCategory="game"` risolvono interamente il requisito di interfaccia verticale su Android.
