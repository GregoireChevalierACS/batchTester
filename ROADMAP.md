# Feuille de route

batchTester est un environnement de test local, en TypeScript, pour simuler un système (jeu de cartes, système de combat…) des dizaines ou centaines de fois et visualiser l'effet de chaque réglage de valeurs.

Chaque phase a un critère vérifiable : elle est terminée quand il est rempli, pas avant. Les pratiques suivies sont dans [BONNES-PRATIQUES.md](BONNES-PRATIQUES.md).

## Principe

Un moteur Node exécute les simulations ; une page dans le navigateur affiche les réglages et les graphiques. Le moteur ne connaît aucun jeu : seulement des paramètres, une graine et des mesures.

Chaque système branché respecte un seul contrat :

```ts
interface Systeme {
  definition: {
    parametres: DefParametre[]; // nombre (min, max, pas), entier, choix, booléen
    mesures: DefMesure[]; // nombre, catégorie (ex. vainqueur), série par tour
  };
  simuler(params: Valeurs, rng: Aleatoire): Resultat; // une itération
}
```

Deux adapters tiennent ce contrat :

- **Module TypeScript** : la voie normale, la plus rapide.
- **Processus externe** : un programme dans n'importe quel langage, qui échange en JSON ligne par ligne (stdin/stdout).

## Découpage

| Partie                          | Rôle                                                                                                                              |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core` (domaine)       | Générateur aléatoire à graine, schéma des paramètres, statistiques (moyenne, percentiles, histogrammes, intervalles de confiance) |
| `packages/runner` (application) | Lancement d'un lot, balayage (1 paramètre ou grille de 2), comparaison A/B, parallélisme borné par workers                        |
| `packages/adapters`             | Système TypeScript, processus externe, stockage des lancements (SQLite intégré à Node), serveur local HTTP/WebSocket              |
| `apps/cli`                      | Ligne de commande : lance un lot sur un système et affiche le rapport texte ou le résumé JSON                                     |
| `apps/ui`                       | Vite + React : curseurs et champs texte générés depuis la définition, progression en direct, graphiques ECharts                   |
| `systemes/`                     | Exemples qui prouvent la généricité : combat 1 contre 1, mini jeu de cartes                                                       |

**Reproductibilité** : même graine maître et mêmes paramètres donnent exactement les mêmes résultats ; chaque itération reçoit une graine dérivée. Chaque lancement enregistré garde paramètres, graine, résultats et version du système.

**Pile** : pnpm workspaces, TypeScript strict, Vitest + Stryker (mutation), ESLint, Fastify, Vite + React, ECharts.

## Graphiques prévus

- Distribution d'une mesure : histogramme et boîte à moustaches.
- Taux par catégorie (taux de victoire…) avec intervalle de confiance.
- Convergence : moyenne au fil des itérations, pour savoir si N suffit.
- Comparaison avant/après un réglage : distributions superposées et écart.
- Balayage d'un paramètre : courbe de la mesure selon la valeur, avec bande d'incertitude.
- Grille de deux paramètres : carte de chaleur.
- Séries par tour, si le système en émet : moyenne avec bande min-max.

## Phase 1 — Socle ✅

**Terminée quand** : le noyau, le runner et l'adapter TypeScript passent la CI (100 % de couverture, mutation du domaine ≥ 80 %), et le système de combat d'exemple tourne en ligne de commande avec une graine fixe en donnant deux fois le même résultat.

- [x] Monorepo pnpm, TypeScript strict, ESLint, dependency-cruiser, Vitest, Stryker, commitlint, CI.
- [x] Domaine : générateur aléatoire à graine (sfc32) et graines dérivées, valeurs figées par les tests.
- [x] Domaine : définition et validation des paramètres (bornes, pas, types) et des mesures.
- [x] Domaine : statistiques (moyenne, écart-type, quantiles, histogramme, intervalle de Wilson, séries par tour).
- [x] Application : lancement d'un lot de N itérations, nombre de simulations simultanées borné.
- [x] Adapter système TypeScript, tenu par une suite de contrat.
- [x] Exemple : combat 1 contre 1.
- [x] Ligne de commande : lancer un lot et afficher un rapport texte ou un résumé JSON.

Les simulations d'un système TypeScript tournent dans le processus principal : la limite de simultanéité sert aux simulateurs asynchrones. Des workers ne seront ajoutés que si une itération devient assez coûteuse pour le justifier (phase 4).

## Phase 2 — Interface

**Terminée quand** : modifier un curseur ou un champ texte relance le lot et met à jour les graphiques, sans recharger la page.

- [ ] Serveur local (HTTP + WebSocket) avec progression en direct.
- [ ] Formulaire généré depuis la définition du système : curseurs et champs texte synchronisés.
- [ ] Graphiques : distribution, taux par catégorie, convergence, séries par tour.
- [ ] Choix du système parmi ceux disponibles.

## Phase 3 — Historique et comparaison

**Terminée quand** : deux lancements enregistrés s'affichent côte à côte avec leur écart, et un lancement relancé depuis l'historique redonne les mêmes résultats.

- [ ] Stockage SQLite des lancements (paramètres, graine, résultats, version du système).
- [ ] Liste de l'historique, relance d'un lancement.
- [ ] Comparaison A/B : distributions superposées et écart.

## Phase 4 — Balayages et ouverture

**Terminée quand** : un balayage sur une grille de deux paramètres produit sa carte de chaleur, et un système écrit hors TypeScript tourne par l'adapter externe.

- [ ] Balayage d'un paramètre (courbe avec bande d'incertitude).
- [ ] Grille de deux paramètres (carte de chaleur).
- [ ] Adapter processus externe (JSON ligne par ligne), tenu par la même suite de contrat.
- [ ] Exemple : mini jeu de cartes.
- [ ] Simulateur en workers (`worker_threads`), si une itération devient coûteuse.

## Pièges rencontrés

- **Arrondis flottants dans les statistiques** : `min + n × ((max - min) / n)` ne retombe pas toujours sur `max` (0,30000000000000004), et l'intervalle de Wilson peut sortir d'un cheveu de [p, p] en 0 et en 1. Les bornes sont recalées explicitement ; des tests par propriétés (fast-check) gardent ces cas.
- **Histogramme de réels tous égaux** : la largeur de classe vaut 0 et la division donne `NaN`. Une seule classe est renvoyée dans ce cas.
- **Sources `.ts` exécutées par Node** (ADR 0001) : Node refuse d'effacer les types d'un fichier situé sous `node_modules`. Les paquets du dépôt y sont des liens symboliques résolus vers leur vrai chemin : cela fonctionne, mais un système publié sur npm devra être compilé.
- **`-n -5`** : `parseArgs` lit `-5` comme une option. Une valeur négative s'écrit `--iterations=-5` (elle est alors refusée avec un message clair).
- **`pnpm simuler` sans `--silent`** ajoute l'en-tête de pnpm à la sortie : utiliser `pnpm --silent simuler …` pour rediriger le rapport dans un fichier.
