# batchTester

Environnement de test local, en TypeScript, pour simuler un système (jeu de cartes, système de combat…) des dizaines ou centaines de fois et voir l'effet de chaque réglage de valeurs.

## Démarrer

Prérequis : Node 24.11 ou plus récent, pnpm 10.

```bash
pnpm install
pnpm --silent simuler systemes/combat/src/index.ts -n 500 -g 42 -p pvA=120 -p precisionB=0,9
pnpm simuler --aide
```

La même graine (`-g`) et les mêmes paramètres (`-p`) redonnent toujours exactement le même rapport.

### Interface

```bash
pnpm studio      # construit l'interface et ouvre le serveur sur http://127.0.0.1:5174
```

Chaque système du dossier `systemes/` est proposé. Chaque curseur ou champ modifié relance le lot (le précédent est annulé) et met à jour les graphiques : taux par catégorie avec intervalle de confiance, distribution, convergence, séries par tour.

En développement : `pnpm serveur` dans un terminal, `pnpm dev:web` dans un autre (Vite transmet `/api` au serveur).

## Brancher un système

Un système est un module dont l'export par défaut décrit ses paramètres et ses mesures, et joue une itération. Tout le hasard passe par `aleatoire` :

```ts
import { lireUnNombre, type Systeme } from '@batchtester/core';

export default {
  definition: {
    nom: 'Pile ou face',
    version: '1.0.0',
    parametres: [{ kind: 'nombre', nom: 'biais', min: 0, max: 1, pas: 0.01, defaut: 0.5 }],
    mesures: [{ kind: 'categorie', nom: 'issue', categories: ['pile', 'face'] }],
  },
  simuler: (valeurs, aleatoire) => ({
    issue: aleatoire.chance(lireUnNombre(valeurs, 'biais')) ? 'pile' : 'face',
  }),
} satisfies Systeme;
```

Paramètres : `nombre` (min, max, pas), `entier`, `choix`, `booleen`. Mesures : `nombre`, `categorie`, `serie` (une valeur par tour). L'exemple complet est dans [systemes/combat](systemes/combat/src/combat.ts).

## Vérifications

| Commande                 | Vérifie                                                 |
| ------------------------ | ------------------------------------------------------- |
| `pnpm lint`              | ESLint strict, sans avertissement                       |
| `pnpm lint:architecture` | Dépendances entre couches (dependency-cruiser)          |
| `pnpm typecheck`         | Types de tous les paquets                               |
| `pnpm test:coverage`     | Tests, 100 % de couverture exigés                       |
| `pnpm test:mutation`     | Test de mutation du noyau (Stryker), score minimal 80 % |
| `pnpm format:check`      | Formatage Prettier                                      |

Les commits suivent le format `aaaa-mm-jj # N : (type) description`, vérifié par commitlint. `main` n'évolue que par pull request, avec le check « Vérification » de la CI.

Voir aussi la [feuille de route](ROADMAP.md), les [bonnes pratiques](BONNES-PRATIQUES.md) et les [décisions d'architecture](docs/adr/).
