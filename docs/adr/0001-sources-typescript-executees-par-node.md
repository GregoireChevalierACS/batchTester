# ADR 0001 — Sources TypeScript exécutées directement par Node

**Statut** : acceptée (2026-11-03)

## Contexte

L'outil tourne en local, pour un seul utilisateur. Chaque paquet du dépôt (noyau, runner, adapters, ligne de commande, systèmes) est consommé par les autres depuis ses sources. Node 24 sait effacer les types TypeScript à l'exécution, sans étape de compilation, à condition que le code n'utilise que de la syntaxe effaçable (pas d'`enum`, de `namespace` ni de propriété de paramètre) et importe les fichiers avec leur extension `.ts`.

## Décision

- Aucune étape de build : `node apps/cli/src/main.ts` exécute directement les sources, et chaque paquet exporte `./src/index.ts`.
- Les imports relatifs portent l'extension `.ts` (`allowImportingTsExtensions`), et `erasableSyntaxOnly` refuse toute syntaxe que Node ne sait pas effacer.
- `tsc` ne sert qu'à vérifier les types (`noEmit`).

## Conséquences

- Une modification se teste immédiatement, sans compilation ni carte de sources.
- Moins d'outillage : ni tsdown, ni tsx, ni configuration de build par paquet.
- Un paquet ne peut pas être publié tel quel sur npm (Node refuse d'effacer les types sous `node_modules`). Si un système doit un jour être distribué, il faudra le compiler.
- L'interface web (phase 2) sera construite par Vite, qui lit les mêmes sources.
