# Resa visiva

> **Stato: DRAFT.** Il capitolo fissa l'obiettivo visivo dell'app (identica all'originale, o migliore), come lo si verifica e cosa resta da portare. L'inventario è parziale: tessere, animazioni della tavola, combo, scintille e schermata di vittoria sono state provate in parte su un dispositivo; gli elementi mancanti sono indicati nell'inventario.

Questo capitolo serve a non perdere nulla della resa visiva dell'originale: elenca ogni elemento con il suo riferimento nel codice dell'originale, dice a che punto è e come si controlla che sia uguale o migliore. Si legge prima di toccare l'aspetto di una schermata e si aggiorna a ogni elemento portato.

## Cosa fa

**Obiettivo.** A parità di schermo e di stato, l'app deve avere l'aspetto e il movimento dell'originale (`reference/majoa-originale/Majoa Mahjong.html`), oppure migliori. *Identica* significa che forma, colore, tempi e curve coincidono. *Migliore* significa la stessa estetica con più nitidezza (disegno vettoriale alla densità dello schermo, 60 fotogrammi al secondo, accessibilità), mai un'estetica diversa. Una scelta di stile diversa dall'originale si ammette solo se è scritta nella sezione «Scelte della nuova app rispetto all'originale» di `docs/gioco-originale.md`, con il motivo.

**Cosa non è.** Non è il catalogo delle funzioni (README, sezione 2) né la descrizione del rendering (`docs/rendering.md`): è l'elenco di ciò che si vede e si sente, con lo stato di ciascun elemento.

## Come funziona

### Come si controlla

1. **Riferimento.** Ogni elemento ha nell'inventario il riferimento nell'originale (riga, funzione o regola CSS).
2. **Valori copiati, non scritti a occhio.** Colori, durate, curve e dimensioni si ricavano dall'originale. Dove è possibile un test legge la costante dall'HTML e la confronta con quella dell'app, come già avviene per i profili (`legacyProfiles.test.ts`) e per disegni e tavolozze (`originalThemes.test.ts`).
3. **Catture di riferimento.** Per gli aspetti che un test non vede si confrontano catture dell'originale (schermata o breve video, in Chromium) con catture dell'app sullo stesso stato. Servono almeno: livello 20 appena iniziato; tessera selezionata, bloccata, nascosta, nebbiosa, d'oro, evidenziata dall'aiuto, «uguale» e «bloccante»; sparizione di una coppia; sblocco di un gruppo nascosto; nebbia che si dirada; combo (4 livelli); vittoria con fuochi d'artificio; mappa delle isole; impostazioni; guida. Le catture le produce chi usa l'originale in un browser: nell'ambiente di sviluppo di questo progetto non c'è un browser.
4. **Esito per elemento.** *Identico*, *migliore* (con il motivo) o *diverso* (con il motivo e la decisione). Si scrive nell'inventario.
5. **Fedeltà già misurata sulle tessere.** In S1 i 129 disegni letti da Skia sono stati confrontati con Chromium: 127 identici e 2 con differenza media sotto 0,001/255 (`docs/rendering.md`).

### Inventario

Stato: **Fatto**, **Parziale**, **Da fare**. I numeri di riga sono quelli di `Majoa Mahjong.html`.

| Elemento | Riferimento nell'originale | Stato | Cosa resta |
|---|---|---|---|
| Faccia della tessera: 129 disegni SVG (`viewBox 0 0 60 80`) | sezione 10.1 di `docs/gioco-originale.md` | Fatto | — |
| Corpo 3D della tessera: bordo laterale a due toni, ombra, faccia sfumata | regola CSS riga 43 (`--edge`, `--edge2`) | Fatto | Confronto con le catture a più densità di schermo |
| Tavolozza del livello (5 colori) | `l.th`, riga 1330 | Parziale | Si usano il secondo colore (sfondo), l'accento, il bordo e il bordo scuro; il feltro chiaro non si usa |
| Sfondo della schermata | riga 20-21: `radial-gradient(ellipse at 50% 40%, var(--felt-a), var(--felt-b) 75%)` | Fatto | `FeltBackground.tsx`: Canvas Skia con `RadialGradient` centrato a `50 % × 40 %`, raggio `max(w, h) × 0.75`; applicato a `LevelPicker` e `GameScreen` |
| Tipografia | corpo riga 23: «Trebuchet MS», «Segoe UI», Roboto, system-ui; titoli (righe 95, 103, 120, 162, 166, 173, 238): Georgia, serif | Parziale | Lora (titoli, cifre e timer) e Nunito (interfaccia e testi) incorporati con licenza OFL in `assets/fonts/` e centralizzati in `src/ui/theme/typography.ts`; resta il rendering testo Skia per il «?» dei veli |
| Colori e pannelli dell'interfaccia | righe 12-14 (`--ink`, `--ink-soft`, `--accent`, `--panel`) e 28 (bordo 2 px, raggio 14) | Fatto | Centralizzati in `src/ui/theme/colors.ts` (`feltA`, `feltB`, `ink`, `inkSoft`, `panel`, `btn`, `accent`, `edge`); applicati a selettore, home, dialoghi di conferma, pulsanti e gioco |
| Tessera selezionata | stato della tessera, sezione 10.1; righe 50-53 CSS | Fatto | Sollevamento di 4 px (`translateY(-4px)`), bordo d'accento 3 px, bagliore esterno d'accento e filo interno chiaro (`TileBoard.tsx`) |
| Tessera bloccata (scurita, con gradazione per profilo) | sezione 10.1 e 6.2; righe 48, 49, 285, 286 CSS | Fatto | Velo d'oscuramento graduato nel layer statico in base al profilo: Facile/Normale/Medio 40%, Difficile 28%, Esperto 15%, Maestro 0% (`blockedDimOverlay` in `tile.tsx`) |
| Tessera nascosta: sagoma con «?» e lucchetto | sezione 10.1 | Fatto | Sfondo viola-indaco (CSS .tile.locked riga 61 HTML), cerchio tratteggiato, stella a 5 punte, «?» e lucchetto vettoriali scalati al tile; bordo interno dorato 1.5px |
| Tessera nebbiosa: nuvola con «?», deriva e diradamento in 700 ms | `fogdrift` riga 293, `fogaway` riga 296 | Parziale | Sfondo azzurro (CSS .tile.fog riga 287 HTML), cerchio, nuvola e curva inferiori vettoriali, «?»; diradamento `reveal` in 550 ms con curva `flipEase` (`FlippingTile kind="reveal"`); manca l'animazione fogdrift |
| Tessera d'oro: alone dorato e ✨ | `gemtw` riga 263, `glow` riga 68 | Fatto | Gradient dorato sulla faccia (CSS .tile.gold riga 260 HTML), bordo 2.5px #ffd54a, scintilla vettoriale a 4 punte in alto a sinistra (nessun emoji, sicura su tutti i font) |
| Aiuto, «uguale», attenuata, bloccante | `blk` riga 223, `mglow` riga 230 | Fatto | Anello bianco per l'Aiuto; anello verde + badge ✔ per «uguale» (match); velo d'attenuazione solido 20% sulle libere non-match (fade); outline rosso solido 4px con bagliore sulle tessere che bloccano (top/sides, blocker) e messaggio contestuale |
| Rifiuto di un tocco | `shake` riga 225 | Fatto | Animazione shake ±5px in 420 ms su tessera bloccata/nascosta toccata (`ShakingTile` con `useDerivedValue`) |
| Sparizione della coppia (260 ms) | `.tile.gone` | Fatto | Confronto con un video |
| Ingresso della tavola con ritardo per tessera (piano, riga, colonna) | `tin` riga 59 | Fatto | `TileWaveGroup` (raggruppamento per ondate temporali di 40 ms): soli 9-16 mapper Reanimated anziché fino a 192 (docs/rendering.md); curva elastica naturale `tinEase` (`easeOutBack` cubic-bezier(.34,1.25,.64,1) con rimbalzo armonico all'atterraggio), discesa continua (-28px -> 0), opacità progressiva, avvio sincrono senza attese asincrone (eliminato il singhiozzo iniziale), zero carico GPU asincrono e callback `onBoardInDone` nativo a 60 fps garantiti |
| Sblocco di un gruppo nascosto | `flip` riga 67 | Fatto | `FlippingTile kind="unlock"`: flip 3D 700 ms con curva `flipEase` (perspective 300, rotateY 90°→0°, scale 0.8→1.0) + bagliore d'accento 1 s fade-out; rilevamento in `GameScreen` tramite confronto `game.unlocked` |
| Scheda di vittoria: ingresso, trofeo, stelle | `cardIn` 129, `trophy` 130, `starpop` 131 | Parziale | Su Redmi Note 9 Pro, con build aggiornata: «Livello 23 superato!», una stella, tempo, aiuti e `✨ Tessere d'oro: 1/1`. Nel test del livello 23 sono verificati anche la ricompensa `+4 ✨` e il salvataggio della stella. L'interpolazione oro è coperta anche da test. Restano animazione d'ingresso, trofeo e fuochi d'artificio |
| Combo: scritta a 4 livelli e scintille che crescono | riga 2106 (Web Animations), scintille riga 2090 | Fatto | Su Redmi Note 9 Pro: «Grande!» al quarto abbinamento e «Incredibile!» al quinto, con scintille visibili. Combo = abbinamenti a meno di 4,5 s l'uno dall'altro (`nextCombo`); scritta «Bene! / Super! / Grande! / Incredibile!» (livelli 1-4, rosa dal 3) per 1300 ms con `ease-out`, e `5 + 2·livello` scintille a `70 + 12·livello` px; il livello si ferma a 4 (scelta in `docs/gioco-originale.md`). Senza mascotte (tappa 7) e senza il bagliore dorato sfocato |
| Scintille di oro, regali e abbinamenti (⭐ ✨ 💛) | riga 2084 | Parziale | Abbinamenti normali e d'oro verificati su Redmi Note 9 Pro; `SparkLayer` si monta solo con esplosioni. A riposo: 3→2 layer GL e circa 7 MB in meno; GfxInfo (12 s) passa da 57 frame/2 scadenze perse a 51/0, p95 da 16 a 14 ms. Un match d'oro dopo la modifica mostra ancora scintille (34 frame, 2 scadenze, p95 21 ms; campione breve che include i tocchi). 4 scintille per tessera, 12 e cuori per l'oro, 600-950 ms; forme vettoriali. Finestra regalo (`showGift`, riga 2487: 24 scintille a 150 px): da fare con la finestra; resta da isolare il costo per fotogramma sotto carico |
| Fuochi d'artificio: razzi, scintille, coriandoli | `launch`, riga 2214 | Da fare | Razzi `2 + ⌊livello/3⌋` (livello al massimo 12), +3 nei finali; coriandoli 5 s (9 s nei finali); finali: livelli 20 e 90 e fine isola |
| Riduzione del movimento e «Effetti speciali» | sezione 10.3 | Parziale | Scintille e scritta della combo rispettano la riduzione del movimento del sistema (`useReduceMotion`); le altre animazioni e l'opzione «Effetti speciali» (con la schermata Impostazioni) restano da fare |
| Mascotte (4 e nessuna) | sezione 10.2 | Da fare | Esportare gli SVG con uno strumento in `tools/` |
| Audio: 15 effetti, scala di 8 gradi nelle combo | sezione 10.4 | Da fare | Campioni con `expo-audio` (decisione presa, validata da S2), volume e interruttore |
| Vibrazione: 14 ms a ogni abbinamento, 30 ms in anteprima | sezione 10.4 | Da fare | `expo-haptics` |
| Mappa delle isole, selettore dei livelli, guida, impostazioni | `#map`, `#menu`, `#guide`, `#settings` | Da fare | Oggi c'è solo un selettore provvisorio |
| Colonna di gioco e adattamento alle dimensioni | layout dell'originale | Fatto | Provare su telefoni e tablet |

### Combo e scintille

Ogni abbinamento (`feedback.kind === 'matched'`) fa partire `useMatchEffects` (`src/ui/useMatchEffects.ts`): una esplosione di scintille su ogni tessera tolta, più ricca se è d'oro, e dal secondo abbinamento ravvicinato la scritta della combo con altre scintille. La combo si calcola con `nextCombo` (`src/application/combo.ts`), funzione pura con l'orologio passato come argomento (README, regola 9); lo stato sta in un ref di `GameScreen`, parte da zero a ogni partita e non fa parte della sessione, quindi non si salva e non entra nella ricostruzione da eventi. Il conteggio non ha tetto, perché servirà alla scala di 8 gradi dei suoni; la scritta e le scintille si fermano al livello 4.

Le scintille stanno su un canvas Skia trasparente sopra la tavola (`SparkLayer`, senza tocchi): lo strato fermo e quello vivo non si toccano. Ogni esplosione è un solo nodo `Picture` con un solo valore derivato, che a ogni fotogramma ridisegna tutte le sue scintille dal tempo trascorso (`drawSparks`: posizione, scala e opacità di `sparkFrame`, strato per strato); percorsi e pennelli di Skia si creano sul thread UI a partire da dati semplici (`GLYPHS`). La scritta è una vista Reanimated (`ComboBanner`) con testo Lora, animata solo su trasformazione e opacità. Tutti i valori (numeri, distanze, durate, curva `ease-out`, fotogrammi della scritta, colori) li legge un test dall'HTML dell'originale (`effects.test.ts`, `ComboBanner.test.tsx`).

Costo: in questo Skia ogni canvas ha un solo mapper che a ogni fotogramma rigioca l'intera registrazione, e a ogni modifica dell'albero (un'esplosione che compare o sparisce) il thread JS lo ripercorre tutto (`sksg/Container.native.ts`): il costo segue i nodi e i valori derivati, come per `tin` (`docs/rendering.md`). Per questo un'esplosione non ha un nodo e due valori derivati per scintilla: nel caso peggiore (due tessere d'oro e combo al livello 4) sarebbero 37 gruppi e 74 valori derivati creati nel momento più carico della partita, quello dell'abbinamento. Con un solo `Picture` e un solo valore derivato per esplosione sono al massimo 3 per abbinamento. `SparkLayer` non mantiene più un canvas vuoto: sul Redmi Note 9 Pro, a riposo, i layer GL passano da 3 a 2 e la memoria dei layer da 24.528 a 17.326 KB. GfxInfo sull'intera schermata (non isolato da Skia) in due campioni di 12 s: 57 frame, 2 scadenze perse e p95 16 ms prima; 51 frame, zero scadenze perse e p95 14 ms dopo. Durante un match d'oro dopo la modifica, scintille visibili; campione di 34 frame con 2 scadenze perse e p95 21 ms, comprensivo dei tocchi e della rimozione. Resta da isolare il lavoro per fotogramma (circa dieci chiamate a Skia per scintilla e creazione degli strati) con una combo al livello 4 e oro.

### Ordine di lavoro

1. **Verifica iniziale su dispositivo completata** su Redmi Note 9 Pro; il canvas vuoto è stato tolto e i campioni GfxInfo a riposo sono registrati sopra. Restano il ritardo del tocco e la fluidità sotto combo al livello 4 con oro. Ogni elemento animato pesa sul rendering a due strati (`docs/rendering.md`): gli effetti vanno costruiti sapendo quanto margine c'è.
2. Sfondo, tipografia e colori dell'interfaccia: poco costo e molto effetto.
3. Stati delle tessere (bloccata, nascosta, nebbiosa, d'oro, «uguale», bloccante) e scuotimento.
4. Animazioni della tavola: ingresso, selezione, sblocco, diradamento della nebbia.
5. Combo e scintille (portate e verificate su dispositivo; restano mascotte, misura sotto combo al livello 4 con oro e scintille della finestra regalo).
6. Vittoria: scheda e stelle verificate su dispositivo; restano animazione del trofeo e fuochi d'artificio.
7. Mascotte.
8. Schermate: mappa delle isole, impostazioni, guida (insieme alla funzione che mostrano).
9. Audio e vibrazione.

Per ogni tappa: portare, confrontare con le catture, registrare l'esito nell'inventario.

## Punti d'ingresso nel codice

| Elemento | Percorso | Ruolo |
|---|---|---|
| `StaticTile`, `RemovingTile`, `useBodyImage()` | `src/ui/tile.tsx` | Tessera in Skia: corpo, disegno, stati, rimozione |
| `TileBoard` | `src/ui/TileBoard.tsx` | Tavola a due strati |
| `GameScreen` | `src/ui/GameScreen.tsx` | Intestazione, pulsanti, avvisi, schede di fine partita |
| `nextCombo`, `COMBO_WINDOW_MS` | `src/application/combo.ts` | Logica della combo, pura, con orologio passato come argomento |
| `useMatchEffects` | `src/ui/useMatchEffects.ts` | Dal feedback di un abbinamento a scintille e scritta; stato della combo |
| `effects.ts` | `src/ui/effects.ts` | Costanti, curva `ease-out`, fotogrammi di scintille e scritta e disegno di un'esplosione su una tela qualsiasi (`drawSparks`), tutto puro |
| `SparkLayer`, `ComboBanner` | `src/ui/SparkLayer.tsx`, `src/ui/ComboBanner.tsx` | Canvas delle scintille sopra la tavola; scritta della combo |
| `useReduceMotion` | `src/ui/useReduceMotion.ts` | Riduzione del movimento del sistema |
| `levelPalette()`, `designOf()` | `src/infrastructure/content/legacyThemes.ts` | Tavolozza e disegno di ogni tessera |

## Vincoli e scartato

- Nessun valore visivo (colore, durata, curva, dimensione) scritto a occhio: si copia dall'originale con il suo riferimento.
- Nessun effetto aggiunto prima di sapere quanto costa sul rendering a due strati: un elemento animato nello strato fermo obbliga a rifarlo a ogni fotogramma.
- Una scelta diversa dall'originale, anche se «migliore», si scrive in `docs/gioco-originale.md`, sezione «Scelte della nuova app rispetto all'originale».
- Scartato: un'estetica nuova. L'obiettivo è la stessa resa, più nitida e più fluida.

## Decisioni aperte

- **Effetti e strati.** Combo e scintille usano un canvas separato sopra la tavola (deciso, sopra); resta da decidere se i fuochi d'artificio lo riusano.
- **Obiettivi di fluidità.** Fissarli con le misure su dispositivo; proposta di partenza: non peggiori dell'originale su un telefono Android di fascia media.
- **Mascotte predefinita.** L'originale usa Collie: confermare se resta così.

## Verifica

- **Coperto da test**: disegni, tavolozze e geometria dai test di `docs/rendering.md`; suite di test Jest sui componenti UI migrata a `@testing-library/react-native` v14 (639 test passati su 51 suite con `npm run test:all` su Node 22, typecheck pulito; nei test di `GameScreen` qualsiasi `console.error` fa fallire il test); combo e scintille: `combo.test.ts` (finestra di 4,5 s, confronto stretto, nessun tetto), `effects.test.ts` (costanti, durate, curva `ease-out`, fotogrammi e interpolazione della scritta letti dall'HTML dell'originale), `useMatchEffects.test.tsx`, `SparkLayer.test.tsx` (un nodo e un valore derivato per esplosione, disegno registrato da una tela finta), `ComboBanner.test.tsx`, `useReduceMotion.test.tsx`, la tessera d'oro (`tile.test.tsx`) e la schermata di gioco con scintille e scritta simulate; 37 difetti introdotti di proposito (finestra, contatori, distanze, durate, curva, soglie della scritta, oro, posizione, disegno delle scintille, riduzione del movimento, colori), tutti rilevati; `blockedDimOverlay`, `designBox`, `starPathD`, `tinDelayMs`, `tinEase`, `tinTransform`, `flipEase`, `flipTransform` coperti da `src/ui/tile.test.tsx`; calcolo tessere bloccanti `blockersOf` coperto da `src/domain/geometry.test.ts`. Rimossa la dipendenza deprecata `react-test-renderer`.
- **Verificato su dispositivo**: verificati su dispositivo reale Redmi Note 9 Pro in development build:
  - tipografia incorporata (Lora e Nunito);
  - tavolozza colori/pannelli a tema e gradiente radiale di sfondo (`FeltBackground`);
  - stati tessere: tessera nascosta (viola-indaco, stella, «?», lucchetto vettoriale su livello 11), tessera nebbiosa (azzurro, nuvola e curva su livello 3), tessera d'oro (gradiente dorato, bordo e scintilla a 4 punte), tessera selezionata (sollevata con bagliore), tessere uguali «match» (anello verde con badge ✔ vettoriale), tessere attenuate «fade» (overlay 20% solido anti-trasparenza 3D) e tessere bloccate oscurate per profilo;
  - rifiuto tocco con scuotimento e avviso; evidenziazione tessere bloccanti (`blockers` con outline rosso solido 4px e bagliore) con avviso contestuale («coperta dall'alto», «bloccata ai lati», ecc.); tocco tessera nascosta con guida luminosa sulle stelle libere;
  - animazioni tavola: ingresso `tin` a scaglioni fluido a 60 fps con curva elastica `tinEase` cubic-bezier(.2,1.3,.4,1) e attesa `body`, sblocco lucchetto e diradamento nebbia `flip` 3D con curva `flipEase`;
  - effetti di partita: scintille su un abbinamento normale e uno d'oro; combo «Grande!» al quarto e «Incredibile!» al quinto abbinamento;
  - `SparkLayer` a riposo e durante un match d'oro: layer GL da 3 a 2 a riposo; scintille ancora visibili quando il canvas si monta al match;
  - vittoria del livello 23 Facile: build aggiornata con scheda a una stella e conteggio `1/1`; nel test del livello sono state verificate anche ricompensa `+4 ✨` e persistenza della stella nel selettore.
- **Non verificato**: animazione fogdrift, audio e vibrazione; fluidità isolata durante una combo al livello 4 con oro e lavoro per fotogramma; bagliore dorato sfocato e ombra del riquadro combo; scintille della finestra regalo; animazione d'ingresso e trofeo della scheda di vittoria.

## Collegamenti

- `docs/rendering.md`: come si disegna la tavola e perché a due strati.
- `docs/gioco-originale.md`: sezione 10 (grafica, animazioni, audio) e scelte rispetto all'originale.
- `docs/sessione-di-gioco.md`: la partita che la schermata mostra.
- README, sezioni 5 e 8: decisione e ordine di lavoro.
