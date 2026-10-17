# Linee guida di codice

Le linee guida valgono per tutto il codice del progetto e sono la versione estesa delle regole in README, sezione 4. Per ciascun principio sono indicati definizione, regola ed esempio.

## Dominio puro

Il dominio non conosce UI, storage o rete. Regola: ogni funzione del dominio dipende solo dai propri argomenti e si testa senza mock di framework.

Esempio: il calcolo delle tessere libere è una funzione `(stato) -> tessere`, non un metodo di un componente grafico.

## Determinismo nel dominio

Il dominio non usa sorgenti non deterministiche, perché livelli e test devono essere riproducibili. Regola: niente `Math.random()` né `Date.now()` nel dominio; generatore con seme e orologio entrano come argomenti.

Esempio: `generateLevel(spec, seed)` restituisce sempre la stessa tavola per lo stesso `spec` e lo stesso `seed`; il test della risolvibilità la ripete su un elenco fisso di semi.

## YAGNI e semplificazioni dichiarate

Non si scrive ciò che non serve ora. Regola: niente astrazioni, opzioni o dipendenze senza un requisito presente. Quando una semplificazione è intenzionale, va segnalata nel codice con il commento `ponytail:` e il motivo.

Esempio: `// ponytail: lista in memoria, nessuna paginazione finché i livelli sono meno di 100`.

## Errori espliciti

Gli errori previsti sono valori, non eccezioni silenziose né `null` ambigui.

```ts
// Errato: il chiamante non sa perché la mossa è fallita
function pairTiles(a: Tile, b: Tile): Board | null { /* ... */ }

// Corretto: il motivo è parte del tipo di ritorno
type PairResult =
  | { ok: true; board: Board }
  | { ok: false; reason: "not-matching" | "tile-blocked" };
function pairTiles(a: Tile, b: Tile): PairResult { /* ... */ }
```

## Dipendenze

Prima di aggiungere una dipendenza si verifica che libreria standard, piattaforma o una dipendenza già presente non coprano il caso. Regola: ogni dipendenza nuova va registrata nella tabella delle decisioni (README, sezione 5) con il motivo.

## Accessibilità

Regola: il colore non è mai l'unica informazione (affiancarlo a forma, testo o icona), i bersagli touch hanno dimensioni adeguate e il contrasto è sufficiente.

## Test

I test del dominio coprono ogni regola. La loro sensibilità si controlla introducendo di proposito un difetto nel codice e verificando che almeno un test fallisca: un test che non fallisce mai non protegge nulla.
