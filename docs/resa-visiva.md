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
| Tessera selezionata | stato della tessera, sezione 10.1 | Parziale | Oggi è un anello; manca il rialzo e il bagliore dell'originale |
| Tessera bloccata (scurita, con gradazione per profilo) | sezione 10.1 e 6.2 | Da fare | |
| Tessera nascosta: sagoma con «?» e lucchetto | sezione 10.1 | Parziale | Velo scuro con «?»; manca il lucchetto |
| Tessera nebbiosa: nuvola con «?», deriva e diradamento in 700 ms | `fogdrift` riga 293, `fogaway` riga 296 | Parziale | Velo chiaro fisso; mancano la nuvola e le due animazioni |
| Tessera d'oro: alone dorato e ✨ | `gemtw` riga 263, `glow` riga 68 | Parziale | Bordo giallo; mancano alone e ✨ |
| Aiuto, «uguale», attenuata, bloccante | `blk` riga 223, `mglow` riga 230 | Parziale | Anello bianco per l'Aiuto; mancano gli altri |
| Rifiuto di un tocco | `shake` riga 225 | Da fare | Scuotimento |
| Sparizione della coppia (260 ms) | `.tile.gone` | Fatto | Confronto con un video |
| Ingresso della tavola con ritardo per tessera (piano, riga, colonna) | `tin` riga 59 | Da fare | |
| Sblocco di un gruppo nascosto | `flip` riga 67 | Da fare | |
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

- **Coperto da test**: disegni, tavolozze e geometria dai test di `docs/rendering.md`; suite di test Jest sui componenti UI migrata a `@testing-library/react-native` v14 (530 test passati su 43 suite con `npm run test:all` su Node 22, typecheck pulito). Rimossa la dipendenza deprecata `react-test-renderer`.
- **Verificato su dispositivo**: la tipografia incorporata (Lora e Nunito), la tavolozza colori/pannelli a tema e il gradiente radiale di sfondo sono stati verificati visivamente con catture di schermata su dispositivo reale Redmi Note 9 Pro in development build.
- **Non verificato**: il resto dell'inventario (stati tessere avanzati, animazioni, audio); il confronto sistematico con le catture dell'originale.

## Collegamenti

- `docs/rendering.md`: come si disegna la tavola e perché a due strati.
- `docs/gioco-originale.md`: sezione 10 (grafica, animazioni, audio) e scelte rispetto all'originale.
- `docs/sessione-di-gioco.md`: la partita che la schermata mostra.
- README, sezioni 5 e 8: decisione e ordine di lavoro.
