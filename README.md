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

### Historique et comparaison

« Enregistrer ce lancement » garde les réglages, la graine et le résumé dans `donnees/historique.sqlite` (ignoré par git ; autre emplacement avec `BATCHTESTER_HISTORIQUE`). Depuis l'historique :

- **Recharger** remet les réglages et relance le lot : l'interface confirme que le résultat est identique à l'enregistrement, ou signale que le système a changé depuis.
- **Cocher deux lancements** puis « Comparer A et B » : réglages côte à côte, puis pour chaque mesure les valeurs de A et B et l'écart B − A avec son intervalle de confiance à 95 %, et s'il est significatif.

### Balayages

L'onglet « Balayage » fait varier un paramètre (de, à, nombre de points), ou deux en grille ; tous les autres restent aux réglages du lot en cours. Chaque point est un lot complet qui rejoue la même graine : les écarts entre points viennent des réglages, pas du hasard. On choisit ensuite l'indicateur affiché : moyenne d'une mesure ou taux d'une catégorie, avec son intervalle de confiance à 95 % (courbe et bande pour un paramètre, carte de chaleur pour deux).

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

Paramètres : `nombre` (min, max, pas), `entier`, `choix`, `booleen`. Mesures : `nombre`, `categorie`, `serie` (une valeur par tour). Exemples : [combat 1 contre 1](systemes/combat/src/combat.ts), [duel de cartes](systemes/cartes/src/cartes.ts).

### Dans un autre langage

Un dossier de `systemes/` avec un `systeme.json` est un système externe :

```json
{ "commande": "python", "arguments": ["des.py"] }
```

Le programme écrit sa définition en JSON sur sa première ligne, puis répond à chaque ligne `{"id", "valeurs", "graine"}` par `{"id", "resultat"}` ; son hasard doit venir de la graine reçue (protocole complet : [ADR 0003](docs/adr/0003-systemes-externes-json-par-ligne.md)). Exemple : [bataille de dés en Python](systemes/des/des.py), jouable aussi en ligne de commande : `pnpm --silent simuler systemes/des/systeme.json -n 500`.

Chaque système du dépôt, quel que soit son langage, passe automatiquement la suite de contrat (même graine, même résultat ; résultats conformes à la définition).

## Vérifications

| Commande                 | Vérifie                                                              |
| ------------------------ | -------------------------------------------------------------------- |
| `pnpm lint`              | ESLint strict, sans avertissement                                    |
| `pnpm lint:architecture` | Dépendances entre couches (dependency-cruiser)                       |
| `pnpm typecheck`         | Types de tous les paquets                                            |
| `pnpm test:coverage`     | Tests, 100 % de couverture exigés                                    |
| `pnpm test:mutation`     | Test de mutation du noyau et du runner (Stryker), score minimal 80 % |
| `pnpm format:check`      | Formatage Prettier                                                   |

Les commits suivent le format `aaaa-mm-jj # N : (type) description`, vérifié par commitlint. `main` n'évolue que par pull request, avec le check « Vérification » de la CI.

Voir aussi la [feuille de route](ROADMAP.md), les [bonnes pratiques](BONNES-PRATIQUES.md) et les [décisions d'architecture](docs/adr/).
