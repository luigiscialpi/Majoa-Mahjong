# <Nome area> (Esempio: Dominio di gioco)

> **Nota (template):** copiare in `docs/<nome-stabile>.md`, compilare le sezioni e cancellare i blocchi `Nota (template)`. Il capitolo descrive lo stato attuale dell'area, senza cronologia («prima... ora...»). Aggiungere una riga in README, sezioni 2 e 7.

Questo capitolo spiega `<area>`: `<una frase sullo scopo, es. come vengono rappresentati e validati i livelli del gioco>`. Si legge prima di toccare il codice indicato nella sezione «Punti d'ingresso».

## Cosa fa

`<2-4 frasi: responsabilità dell'area e confini rispetto alle altre>`.

## Come funziona

Spiegazione tecnica dell'area: flusso dei dati, tipi o strutture chiave, algoritmi, invarianti. Se utile, aggiungere un diagramma.

`<es. Il livello è una lista di tessere con coordinate (x, y, z). Una tessera è libera se non ha altre tessere sopra e almeno un lato sinistro o destro scoperto.>`

## Punti d'ingresso nel codice

| Elemento | Percorso | Ruolo |
|---|---|---|
| `<es. freeTiles()>` | `<es. src/domain/freeTiles.ts>` | `<es. calcola le tessere selezionabili>` |

## Vincoli e scartato

Vincoli attuali dell'area e approcci esclusi, formulati come regole valide oggi.

- `<es. Non usare Math.random() nel dominio: lo shuffle riceve un generatore iniettato, per rendere i test deterministici.>`

## Verifica

- **Coperto da test**: `<es. regole di accoppiamento, tessere libere, shuffle risolvibile>`.
- **Come eseguirli**: `<es. npx jest src/domain>`.
- **Non verificato**: `<es. comportamento su dispositivi di fascia bassa>`.

## Collegamenti

- `<es. docs/rendering.md: come il dominio viene disegnato>`
- `<es. README, sezione 5: decisioni correlate>`
