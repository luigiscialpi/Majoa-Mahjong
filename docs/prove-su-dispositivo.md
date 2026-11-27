# Prove su dispositivo — Majoa Mahjong

> **Stato: DRAFT.** Elenco delle prove che non si possono fare in chat (`docs/decisioni-tecniche.md`, regola 8). Ogni prova ha passi, esito atteso e un modo per farla con `adb`, così la può eseguire una persona o un'IA che abbia un emulatore o un dispositivo collegato. Dove una prova è stata fatta, qui si scrive su che dispositivo e quando; dove non è stata fatta resta «Da fare». Ogni patch con interfaccia aggiunge qui le sue prove.

## Come eseguire le prove con adb

Pacchetto: `it.luigiscialpi.majoa`. Serve un dispositivo o un emulatore Android con `adb devices` che lo mostra, e una build di sviluppo (`npm run android`) o `--no-dev`. Le build di sviluppo sono debuggabili, quindi `run-as` funziona.

- **Avvio e arresto:** `adb shell monkey -p it.luigiscialpi.majoa -c android.intent.category.LAUNCHER 1`; `adb shell am force-stop it.luigiscialpi.majoa`.
- **Log:** `adb logcat -c` prima della prova, poi `adb logcat -d -s ReactNativeJS AndroidRuntime ExpoModulesCore` e `adb logcat -b crash -d`.
- **Schermata:** `adb exec-out screencap -p > /tmp/prova.png`.
- **Albero della schermata:** `adb shell uiautomator dump /sdcard/ui.xml && adb pull /sdcard/ui.xml /tmp/ui.xml`. Il `testID` dei componenti compare come `resource-id`, l'`accessibilityLabel` come `content-desc`; i `bounds` danno il punto da toccare con `adb shell input tap X Y` (centro del rettangolo).
- **Dati salvati:** `adb exec-out run-as it.luigiscialpi.majoa cat files/SQLite/majoa.db > /tmp/majoa.db`, poi `sqlite3 /tmp/majoa.db "select slot, json from save"` (righe `progress` e `game`). Per mettere un documento di prova: `adb shell run-as it.luigiscialpi.majoa sh -c 'cat > files/SQLite/majoa.db' < prova.db` a app chiusa.
- **Limite:** i record dei livelli hanno una firma del contenuto (`docs/salvataggi.md`); un documento di progressi scritto a mano senza firme vale solo per la prova di migrazione dal formato 1.

## Prove da fare

### P1. Barra di navigazione in basso (patch 0194)
Da fare. Su telefono con navigazione a gesti, con tre pulsanti e su emulatore di tablet.
1. Aprire l'app: la mappa mostra la barra con «Mappa» e «Impostazioni».
2. Toccare «Impostazioni»: si apre senza pulsante Indietro; toccare «Mappa»: si torna.
3. Guardare lo spazio tra l'ultimo contenuto e la barra, sia nella mappa sia nelle impostazioni: nessuno spazio vuoto in più (la barra prende il margine inferiore, `TabScreen` lo toglie alle schermate).
4. Avviare un livello: la barra non c'è e la partita è a tutto schermo; uscendo si torna alla mappa con la barra.
Atteso: nessuna sovrapposizione con la barra di sistema. Automatizzabile: sì (dump dei `resource-id` `tab-map` e `tab-settings`, tocco, screenshot).

### P2. Migrazione dei progressi (formati 1, 2 e 3 verso il 4)
Da fare. Con un database vero, anche precedente alle firme.
1. Con l'app chiusa, mettere in `majoa.db` un documento `progress` di versione 1 (poi 2 e 3), con qualche livello vinto.
2. Aprire l'app: la mappa mostra le stelle già ottenute e nessun errore.
3. Vincere un livello, chiudere e leggere `majoa.db`: il documento ha `version` 4, `giftCards` e `puzzles` (`{}`).
Atteso: nessuna perdita di stelle, ✨ né regali già aperti. Automatizzabile: sì, tutta.

### P3. Carta del regalo d'isola
Da fare, finché non c'è la schermata Album si legge solo dal database.
1. Aprire un'isola con regalo (l'Isola degli animali, poi le isole di tema).
2. Leggere `progress`: `giftCards` ha una carta nuova dell'album di quel tema (`dogs…`, `cats…` e così via per Animali; `sweets…`, `art…` per le isole di tema).
3. Ripetere con lo stesso salvataggio: la carta è la stessa (seme dell'isola).
Atteso: a collezione completa nessuna carta, solo ✨. Automatizzabile: parziale (serve arrivare all'apertura dell'isola giocando).

### P4. Percorso fino al livello 20, anticipazione e isola 2
Da fare. Giocare o far giocare i livelli fino al 20.
1. Finire il livello 20: compare l'anticipazione del livello speciale (Tris) dell'isola dopo.
2. Aprire l'isola 2: regalo ✨ e mappa con i numeri giusti.
3. Il Tris al primo posto dell'isola 2 si apre con la spiegazione prima del livello; con la spunta «Non mostrare più» non ricompare, e dalle Impostazioni si ripristina.
Automatizzabile: parziale (la partita va giocata con tocchi sulle tessere).

### P5. Sala dei Tris dell'originale
Da fare. Dopo il primo Tris vinto la scheda compare in fondo alla mappa; i dieci Tris (91–100) si giocano a gruppi di 3. Automatizzabile: parziale.

### P6. Errore `NullPointerException` su `NativeDatabase.prepareAsync`
Da fare. Intermittente, già descritto in `docs/salvataggi.md`.
1. `adb logcat -c`, poi 20 volte di fila: `am force-stop`, avvio, attesa 3 s, `adb logcat -b crash -d` (salvare lo stack se compare).
2. Ripetere in build di sviluppo e `--no-dev`, e con Fast Refresh acceso.
Atteso: nessun arresto; se compare, conservare lo stack completo e la versione di `expo-sqlite`. Automatizzabile: sì, tutta.

### P7. Funzioni già costruite ma non ancora provate sul dispositivo
Da fare, una riga ciascuna: difficoltà nelle Impostazioni (sei profili, punti ●○ e nota sulla Modalità comoda), daltonismo e alto contrasto in partita, evidenzia-uguali acceso di base e spegnibile, lingue IT/EN/FR dalla mappa, audio e vibrazione. Esito atteso: come nelle tabelle di `docs/resa-visiva.md`. Automatizzabile: parziale (screenshot da confrontare a occhio).

### P8. Memory (patch 0201)
Da fare. Finché non c'è la scheda Giochi si apre con il link: `adb shell am start -a android.intent.action.VIEW -d "majoa://puzzle?id=memory&difficulty=easy" it.luigiscialpi.majoa` (anche `medium` e `hard`).
1. Il costo: all'apertura le ✨ calano di 1 e `majoa.db` lo mostra subito (`progress.coins`). Griglie: facile 3×4, medio 4×4, difficile 4×5; carte larghe circa 70-100 dp, senza uscire dallo schermo.
2. Due carte uguali restano girate, due diverse si rigirano dopo circa 0,8 s e nel frattempo le altre carte non si girano; «Tentativi» sale a ogni coppia girata.
3. Aiuto: mostra tutte le carte per circa 1,5 s, ne restano 3, 2, 1, 0; dopo il terzo compare «Non ci sono più aiuti»; con un aiuto usato compare «con aiuto: massimo 2 ★».
4. Vittoria: dopo circa 0,7 s compare «Bravo!» con le stelle (3 fino a metà coppie di errori, 2 fino a un numero di errori uguale alle coppie, poi 1) e «+2 ✨» solo alla prima vittoria della coppia gioco e difficoltà; `progress.puzzles` ha la chiave `memory:easy` con le stelle migliori.
5. Uscita: con il tasto ‹ o con il tasto Indietro di sistema, prima di ogni tentativo la ✨ torna (anche con una carta girata); dopo un tentativo no.
6. Senza ✨: con `coins` a 0 nel database (documento v4 `{"version":4,"levels":{},"coins":0,"giftsOpened":[],"giftCards":[],"puzzles":{}}`) compare l'avviso e nessuna carta.
Atteso: nessuna perdita di ✨ chiudendo l'app a metà (il costo è già scritto). Automatizzabile: in gran parte (`resource-id` `memory-card-N`, `memory-hint`, `memory-back`, `memory-attempts`; per trovare le coppie serve lo screenshot o l'aiuto, perché i disegni sono immagini).

## Prove future
Le prove della scheda Giochi e degli altri rompicapi si aggiungono con le loro patch.
