# Interazione (UX)

> **Stato: DRAFT.** I principi sono decisi; la UI esistente (`src/ui/`) li rispetta solo in parte e ogni scostamento è elencato in README, sezione 8.

Questo capitolo fissa i principi generali di interazione dell'app. Si legge prima di progettare o cambiare una schermata, un messaggio o una conferma. Il caso del salvataggio è in `docs/salvataggi.md`.

## Cosa fa

Dà una regola unica a ogni scelta visibile al giocatore, così che schermate diverse si comportino allo stesso modo. Non descrive l'aspetto (`docs/resa-visiva.md`) né il disegno della tavola (`docs/rendering.md`).

## Come funziona

### Metodo

Ogni scelta visibile al giocatore si ragiona su tre domande: cosa vede, cosa teme, cosa può sbagliare. Poi si documenta e si propone prima di costruirla; le proposte non ancora decise stanno nella sezione «Decisioni aperte» del capitolo dell'area.

### Principi

1. **Niente da salvare, niente da confermare per uscire.** Ciò che si può conservare da sé non si chiede al giocatore: la partita si salva da sola e uscire non chiede conferma, perché non si perde nulla.
2. **Il percorso più frequente è un tocco.** Riprendere la partita è la scheda «Continua» in cima alla home, con livello, profilo, tempo trascorso e tessere rimaste.
3. **Un'azione distruttiva dice cosa si perde.** La conferma nomina ciò che va perso («La partita del livello 20 (Normale, 4:12) andrà persa»), usa verbi al posto di «OK» («Continua quella», «Sostituisci») e ha come scelta predefinita quella sicura.
4. **Il tempo del giocatore è suo.** Il tempo di gioco non corre quando l'app è in secondo piano.
5. **Le ricompense si vedono.** Alla vittoria compaiono le stelle, «+N ✨», «Nuovo record!» e, se si apre un'isola, il regalo.
6. **Un errore non è un blocco.** Un dato illeggibile dà un messaggio chiaro e una via d'uscita («Ricomincia»), senza far perdere ciò che si può salvare: i progressi restano separati dalla partita.
7. **Lo stato si vede.** Il selettore mostra le stelle sotto ogni livello e il lucchetto spiega il motivo («Servono 40 ★ per aprire Animali»). L'interruttore «Modalità prova: tutti i livelli aperti» è acceso all'inizio, per continuare a provare livelli e profili.
8. **Accessibile per costruzione.** Aree toccabili di almeno 48 dp, contrasto sufficiente, etichette per i lettori di schermo su ogni controllo, il colore mai come unica informazione, testi brevi in italiano.

### Testi

Frasi brevi, in italiano, con il verbo dell'azione sul pulsante. Le conferme dicono il livello e il profilo, non «la partita». I testi stanno in `src/ui/messages.ts` e `src/ui/format.ts` (tempo come `m:ss`, nomi dei profili) finché non esiste il livello delle lingue.

## Punti d'ingresso nel codice

| Elemento | Percorso | Ruolo |
|---|---|---|
| `messageFor()` | `src/ui/messages.ts` | Avvisi della partita |
| `formatTime()`, `starsText()`, `PROFILE_NAMES` | `src/ui/format.ts` | Tempo, stelle e nomi dei profili |
| `LevelPicker` | `src/ui/LevelPicker.tsx` | Selettore provvisorio (non mostra ancora progressi né lucchetti) |

## Vincoli e scartato

- Non chiedere conferma per un'azione che non perde nulla.
- Non usare «OK» o «Sì/No» sulle conferme distruttive: i pulsanti dicono cosa fanno.
- Non preselezionare l'azione distruttiva.
- Non lasciare correre il tempo di gioco in secondo piano.
- Non far dipendere il significato dal solo colore (README, sezione 4, regola 6).
- Non nascondere un errore: se qualcosa non si può riprendere, lo si dice e si offre una via d'uscita.

## Verifica

- **Coperto da test**: nulla di questo capitolo come insieme; i testi delle partite sono provati da `src/ui/messages.test.ts` e `format.test.ts`.
- **Non verificato**: tutti i principi sulla UI reale; nessuna schermata è stata provata su un dispositivo. Aree da 48 dp, contrasto e lettori di schermo non sono stati controllati.

## Collegamenti

- `docs/salvataggi.md`: salvataggio, ripresa e conferme di sostituzione e di azzeramento.
- `docs/resa-visiva.md`: aspetto e animazioni.
- README, sezione 4 (regole essenziali) e sezione 8 (punti in sospeso).
