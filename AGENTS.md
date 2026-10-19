# AGENTS.md — Majoa Mahjong

Questo file contiene le istruzioni operative per assistenti IA, in chat o come agenti. Le chat non conservano memoria tra una sessione e l'altra, quindi ogni regola di lavoro deve essere scritta qui. La memoria tecnica del progetto è nel `README.md`, che rimanda ai capitoli di `docs/`.

## 0. Modalità di lavoro

**Modalità attiva:** `chat`

Le regole su come consegnare le modifiche dipendono dalla modalità:

- **chat**: l'assistente non ha accesso al repository e consegna le modifiche come patch git, applicate dallo sviluppatore.
- **agente**: l'assistente (es. GitHub Copilot) lavora direttamente sulla codebase e modifica i file.

Le sezioni e i punti marcati *(solo chat)* o *(solo agente)* si applicano solo alla modalità corrispondente; tutto il resto vale in entrambe. Se il valore sopra manca o non è chiaro, chiedere prima di procedere.

## 1. Prima di intervenire

1. Leggere `README.md` per intero e i capitoli di `docs/` relativi all'area interessata, scelti dalle sezioni 2 e 7 del README.
2. Verificare che i percorsi citati nell'indice (README, sezione 2) esistano davvero, con `ls` o `grep`. Se qualcosa non torna, segnalarlo prima di lavorare.
3. Se l'intervento richiesto esce dall'ambito (README, sezione 1), segnalarlo e attendere conferma.
4. Nel dubbio, chiedere oppure proporre un breve piano prima di modificare, invece di indovinare.
5. *(solo chat)* Clonare il repository da zero o aggiornarlo; mai ricostruire lo stato di `master` a partire dalle patch precedenti.
6. *(solo chat)* Se il repository è privato e non è clonabile, avvisare. In alternativa, confrontare `git rev-parse master^{tree}` per accertarsi di partire dallo stesso stato.

*(solo chat)* Prompt di avvio, da incollare con `AGENTS.md`, `README.md` e i capitoli di `docs/` pertinenti allegati:

```text
In allegato AGENTS.md, README.md e i capitoli di docs/ pertinenti.
Leggere AGENTS.md e README.md per intero prima di intervenire.
Se una decisione non è registrata o l'intervento esce dall'ambito,
chiedere prima di procedere.
```

## 2. Consegna delle modifiche

Valido in entrambe le modalità:

1. Commit convenzionali in italiano (Esempio: `feat(dominio): aggiunge il calcolo delle tessere libere`). Si lavora su `master`.
2. Ogni modifica che cambia il comportamento aggiorna la documentazione corrispondente: il capitolo di `docs/` toccato, la riga dell'indice (README, sezione 2) e, se una decisione cambia, la sua riga in sezione 5.

*(solo chat)* Consegna come patch:

1. Formato: unified diff pronto per `git apply`, numerato (`NNNN-descrizione.patch`).
2. Patch sequenziali e incrementali: ciascuna si applica sullo stato lasciato dalla precedente, mai cumulative rispetto a un repository già patchato.
3. Ogni patch viene provata su un clone pulito prima della consegna.
4. Patch di codice e patch di documentazione sono separate; dopo ogni patch di codice segue quella di documentazione.

*(solo agente)* Modifica diretta:

1. La documentazione viene aggiornata nello stesso commit del codice che la rende necessaria.
2. Commit piccoli, uno per scopo.
3. Prima di dichiarare concluso l'intervento, eseguire build e test indicati nel README (sezione 6) e riportarne l'esito.

## 3. Scrittura della documentazione

1. Descrivere lo stato attuale, mai la cronologia («prima era così, adesso così»): la storia è nel log di git.
2. Stile tecnico ma sintetico. Il README resta breve (indicativamente sotto le 200 righe): i dettagli vanno in `docs/`.
3. Ogni funzionalità ha una riga nell'indice e un capitolo di riferimento.
4. I nomi dei capitoli sono stabili: non rinominare senza aggiornare l'indice.
5. Gli approcci scartati si registrano come vincoli attuali nella colonna *Scartato e perché* (README, sezione 5).

## 4. Qualità

1. Applicare le regole del README (sezione 4) e `docs/linee-guida-codice.md`.
2. Non introdurre astrazioni, dipendenze o funzionalità non richieste.
3. Segnalare ogni semplificazione intenzionale con `ponytail:`.
4. Cercare la causa radice dei difetti invece di aggiungere correzioni sintomatiche.

## 5. Onestà sulla verifica

1. Dichiarare cosa è stato verificato e come.
2. Dichiarare cosa non è verificabile nell'ambiente corrente (UI, build completa, integrazioni native, dispositivo).
3. Non affermare che qualcosa funziona se non è stato provato.

## 6. Comunicazione

Diretta e tecnicamente precisa. Non spiegare concetti di base già noti allo sviluppatore.
