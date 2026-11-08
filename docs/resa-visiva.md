# Resa visiva

> **Stato: DRAFT.** Il capitolo fissa l'obiettivo visivo dell'app (identica all'originale, o migliore), come lo si verifica e cosa resta da portare. Dell'inventario è fatta solo la parte sulle tessere; il resto è `TO DO` e non è mai stato provato su un dispositivo.

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
| Scheda di vittoria: ingresso, trofeo, stelle | `cardIn` 129, `trophy` 130, `starpop` 131 | Da fare | |
| Combo: scritta a 4 livelli e scintille che crescono | riga 2106 (Web Animations), scintille riga 2090 | Da fare | |
| Scintille di oro, regali e abbinamenti (⭐ ✨ 💛) | riga 2084 | Da fare | |
| Fuochi d'artificio: razzi, scintille, coriandoli | `launch`, riga 2214 | Da fare | Razzi `2 + ⌊livello/3⌋` (livello al massimo 12), +3 nei finali; coriandoli 5 s (9 s nei finali); finali: livelli 20 e 90 e fine isola |
| Riduzione del movimento e «Effetti speciali» | sezione 10.3 | Da fare | Rispettare la preferenza di sistema e l'opzione |
| Mascotte (4 e nessuna) | sezione 10.2 | Da fare | Esportare gli SVG con uno strumento in `tools/` |
| Audio: 15 effetti, scala di 8 gradi nelle combo | sezione 10.4 | Da fare | Campioni con `expo-audio` (decisione presa, validata da S2), volume e interruttore |
| Vibrazione: 14 ms a ogni abbinamento, 30 ms in anteprima | sezione 10.4 | Da fare | `expo-haptics` |
| Mappa delle isole, selettore dei livelli, guida, impostazioni | `#map`, `#menu`, `#guide`, `#settings` | Da fare | Oggi c'è solo un selettore provvisorio |
| Colonna di gioco e adattamento alle dimensioni | layout dell'originale | Fatto | Provare su telefoni e tablet |

### Ordine di lavoro

1. **Prima la prova su dispositivo** della schermata attuale: fluidità, ritardo del tocco, SVG. Ogni elemento animato pesa sul rendering a due strati (`docs/rendering.md`): gli effetti vanno costruiti sapendo quanto margine c'è.
2. Sfondo, tipografia e colori dell'interfaccia: poco costo e molto effetto.
3. Stati delle tessere (bloccata, nascosta, nebbiosa, d'oro, «uguale», bloccante) e scuotimento.
4. Animazioni della tavola: ingresso, selezione, sblocco, diradamento della nebbia.
5. Combo e scintille.
6. Vittoria: scheda, stelle e fuochi d'artificio.
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
| `levelPalette()`, `designOf()` | `src/infrastructure/content/legacyThemes.ts` | Tavolozza e disegno di ogni tessera |

## Vincoli e scartato

- Nessun valore visivo (colore, durata, curva, dimensione) scritto a occhio: si copia dall'originale con il suo riferimento.
- Nessun effetto aggiunto prima di sapere quanto costa sul rendering a due strati: un elemento animato nello strato fermo obbliga a rifarlo a ogni fotogramma.
- Una scelta diversa dall'originale, anche se «migliore», si scrive in `docs/gioco-originale.md`, sezione «Scelte della nuova app rispetto all'originale».
- Scartato: un'estetica nuova. L'obiettivo è la stessa resa, più nitida e più fluida.

## Decisioni aperte

- **Effetti e strati.** Dove disegnare combo, scintille e fuochi (un canvas separato sopra la tavola, probabilmente) senza rifare lo strato fermo.
- **Obiettivi di fluidità.** Fissarli con le misure su dispositivo; proposta di partenza: non peggiori dell'originale su un telefono Android di fascia media.
- **Mascotte predefinita.** L'originale usa Collie: confermare se resta così.

## Verifica

- **Coperto da test**: disegni, tavolozze e geometria dai test di `docs/rendering.md`; suite di test Jest sui componenti UI migrata a `@testing-library/react-native` v14 (553 test passati su 44 suite con `npm run test:all` su Node 22, typecheck pulito); `blockedDimOverlay`, `designBox`, `starPathD`, `tinDelayMs`, `tinEase`, `tinTransform`, `flipEase`, `flipTransform` coperti da `src/ui/tile.test.tsx`; calcolo tessere bloccanti `blockersOf` coperto da `src/domain/geometry.test.ts`. Rimossa la dipendenza deprecata `react-test-renderer`.
- **Verificato su dispositivo**: verificati su dispositivo reale Redmi Note 9 Pro in development build:
  - tipografia incorporata (Lora e Nunito);
  - tavolozza colori/pannelli a tema e gradiente radiale di sfondo (`FeltBackground`);
  - stati tessere: tessera nascosta (viola-indaco, stella, «?», lucchetto vettoriale su livello 11), tessera nebbiosa (azzurro, nuvola e curva su livello 3), tessera d'oro (gradiente dorato, bordo e scintilla a 4 punte), tessera selezionata (sollevata con bagliore), tessere uguali «match» (anello verde con badge ✔ vettoriale), tessere attenuate «fade» (overlay 20% solido anti-trasparenza 3D) e tessere bloccate oscurate per profilo;
  - rifiuto tocco con scuotimento e avviso; evidenziazione tessere bloccanti (`blockers` con outline rosso solido 4px e bagliore) con avviso contestuale («coperta dall'alto», «bloccata ai lati», ecc.); tocco tessera nascosta con guida luminosa sulle stelle libere;
  - animazioni tavola: ingresso `tin` a scaglioni fluido a 60 fps con curva elastica `tinEase` cubic-bezier(.2,1.3,.4,1) e attesa `body`, sblocco lucchetto e diradamento nebbia `flip` 3D con curva `flipEase`.
- **Non verificato**: animazione fogdrift, audio e vibrazione.

## Collegamenti

- `docs/rendering.md`: come si disegna la tavola e perché a due strati.
- `docs/gioco-originale.md`: sezione 10 (grafica, animazioni, audio) e scelte rispetto all'originale.
- `docs/sessione-di-gioco.md`: la partita che la schermata mostra.
- README, sezioni 5 e 8: decisione e ordine di lavoro.
