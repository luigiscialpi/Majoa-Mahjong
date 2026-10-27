# S2 — Audio e vibrazione con `expo-audio` (prototipo)

Il prototipo S2 risponde a una domanda del README principale (sezione 8) e di `docs/decisioni-tecniche.md` (sezione 7 e 13): **`expo-audio` con campioni regge 8 note in combo ravvicinata senza ritardi percepibili?** 

Verifica la fattibilità della sostituzione del sintetizzatore Web Audio dell'originale con campioni audio deterministici (`.wav`, 16-bit PCM, 44.1 kHz) e feedback aptico (`expo-haptics`), misurando latenza di dispatch, polifonia e jitter delle note della combo.

## Cosa contiene

| Percorso | Contenuto |
|---|---|
| `tools/export-sounds.js` | Script Node che esegue un rendering deterministico tramite `OfflineAudioContext` in Chromium headless per esportare i suoni sintetizzati dell'originale in campioni WAV |
| `assets/sounds/*.wav` | I 24 file audio campionati (8 note per la scala combo, 3 per le stelle, 13 per meccaniche ed effetti di gioco) |
| `src/sounds.ts` | Catalogo e mappatura TypeScript dei 24 campioni audio e delle chiavi della combo |
| `App.tsx` | Schermata interattiva di benchmark su dispositivo: test combo a intervalli configurabili (80-200 ms), misura latenza al tocco, test polifonia simultanea e catalogo di ascolto |
| `package.json`, `app.json`, `tsconfig.json` | Configurazione Expo SDK 57 con `expo-audio` e `expo-haptics` |

## Come sono stati generati i campioni

Nel gioco originale (`reference/majoa-originale/Majoa Mahjong.html`, righe 1705-1758) non esistono file audio: i suoni vengono sintetizzati a runtime con Web Audio (oscillatori con rampe esponenziali di frequenza e ampiezza, rumore bianco con filtri biquad passa-banda/passa-basso).

Lo script `tools/export-sounds.js`:
1. Ricalca fedelmente le formule dei 15 effetti e le 8 note della scala (`SCALE = [1, 1.125, 1.25, 1.5, 1.667, 2, 2.25, 2.5]`) a partire dalla frequenza di base Do4 (261.6 Hz).
2. Usa un generatore pseudocasuale deterministico con seme per il rumore bianco (eliminando differenze tra export).
3. Esegue il rendering in un `OfflineAudioContext` (44.1 kHz mono) e codifica direttamente l'array di float in WAV 16-bit PCM senza compressione né dipendenze esterne.

I 24 file occupano circa 1,2 MB complessivi (da 17 KB a 150 KB per file).

## Strategia di riproduzione nel gioco

Per azzerare l'I/O al momento della partita, l'app usa un **pool di player pre-istranziati** all'avvio con `createAudioPlayer`:
```typescript
player.seekTo(0);
player.play();
```
In questo modo la decodifica iniziale in memoria avviene all'apertura della schermata e il comando `play()` è immediato.

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run typecheck` | Controllo dei tipi TypeScript (`tsc --noEmit`) |
| `npm run export-sounds` | Riesporta i 24 campioni WAV da Chromium headless |
| `npx expo start` | Avvia il server di sviluppo per testare su Expo Go o build di sviluppo |
| `npx expo start --android` | Prova su dispositivo/emulatore Android |
| `npx expo start --ios` | Prova su simulatore/dispositivo iOS |

## Verifica ed esito

1. **Latenza al tocco (Touch-to-dispatch)**: la chiamata `player.seekTo(0); player.play()` con pool pre-caricato si completa senza ritardi percepibili dal thread JS.
2. **Combo 8 note**: le 8 note si susseguono a intervalli rapidi (80-200 ms) fluide e senza accumulo di lag.
3. **Polifonia e aptica**: 4 suoni simultanei riprodotti senza drop audio; feedback aptico sincrono con l'abbinamento.

## Risultati (27/10/2026)

Provato su un dispositivo Android in modalità `--no-dev --minify`:
- **Esito**: riproduzione fluida, nessuna latenza percepibile su combo rapida e polifonia.
- **Conclusione**: la decisione di usare **`expo-audio` con campioni WAV e `expo-haptics` è confermata**. Il piano B (`react-native-audio-api`) non è necessario.

