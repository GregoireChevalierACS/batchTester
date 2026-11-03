// Règles d'architecture vérifiées en CI sur le graphe complet des dépendances.
// ESLint (no-restricted-imports) ne voit qu'un fichier à la fois ; ici, on voit les cycles et les
// dépendances transitives.

const TESTS = '\\.test\\.tsx?$|/testing/';

/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: 'noyau-pur',
      comment:
        'Le noyau ne dépend que de lui-même : ni paquet npm, ni module Node, ni autre paquet du dépôt.',
      severity: 'error',
      // Les tests, eux, ont droit à leurs outils (vitest, fast-check).
      from: { path: '^packages/core/src', pathNot: TESTS },
      to: { pathNot: '^packages/core/src' },
    },
    {
      name: 'runner-sans-infrastructure',
      comment:
        "Le runner ne connaît que le noyau. Les adapters (systèmes, stockage, serveur) dépendent de lui, pas l'inverse.",
      severity: 'error',
      from: { path: '^packages/runner/src', pathNot: TESTS },
      to: { pathNot: ['^packages/runner/src', '^packages/core/src'] },
    },
    {
      name: 'systeme-independant-du-framework',
      comment:
        "Un système ne connaît que le contrat du noyau : il doit pouvoir être exécuté par n'importe quel adapter.",
      severity: 'error',
      from: { path: '^systemes/([^/]+)/src', pathNot: TESTS },
      to: { pathNot: ['^systemes/$1/src', '^packages/core/src'] },
    },
    {
      name: 'interface-isolee',
      comment:
        "L'interface tourne dans le navigateur : ni module Node, ni adapters, ni serveur. Elle ne parle au serveur que par l'API HTTP.",
      severity: 'error',
      from: { path: '^apps/web/src', pathNot: TESTS },
      to: {
        path: [
          '^node:',
          '^(fs|path|os|crypto|child_process|http)$',
          '^packages/adapters/',
          '^apps/serveur/',
        ],
      },
    },
    {
      name: 'api-publique-seulement',
      comment:
        "Un paquet n'importe un autre paquet du dépôt que par ses points d'entrée (index.ts, et testing/index.ts réservé aux tests), jamais par ses fichiers internes.",
      severity: 'error',
      from: { path: '^(packages|apps|systemes)/([^/]+)/' },
      to: {
        path: '^(packages|systemes)/([^/]+)/src/(?!(testing/)?index\\.ts$)',
        pathNot: '^(packages|apps|systemes)/$2/',
      },
    },
    {
      name: 'pas-de-cycle',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'production-independante-des-tests',
      comment: 'Le code livré ne doit jamais importer un fichier de test ou une fixture.',
      severity: 'error',
      from: { pathNot: TESTS },
      to: { path: TESTS },
    },
    {
      name: 'production-sans-dependance-de-dev',
      severity: 'error',
      from: { path: '^(packages|apps|systemes)/[^/]+/src', pathNot: TESTS },
      to: { dependencyTypes: ['npm-dev'], dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'pas-de-fourre-tout',
      comment:
        'Pas de fichier utils, helpers ou common : un nom vague cache une responsabilité mal définie.',
      severity: 'error',
      from: {},
      // Seulement notre code : les paquets npm nomment leurs dossiers comme ils l'entendent.
      to: { path: '/(utils?|helpers?|common|misc)(\\.ts|/)', pathNot: 'node_modules/' },
    },
    {
      name: 'pas-d-orphelin',
      comment: "Un module que personne n'importe est du code mort.",
      severity: 'warn',
      from: {
        orphan: true,
        pathNot: [
          '\\.test\\.tsx?$',
          '\\.config\\.(ts|mjs)$',
          '/index\\.ts$',
          '\\.d\\.ts$',
          '/main\\.tsx?$',
          // Modules chargés dynamiquement par les tests de la ligne de commande.
          '^packages/adapters/fixtures/',
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(dist|coverage|reports|\\.stryker-tmp)/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: {
      conditionNames: ['import', 'types', 'default'],
      exportsFields: ['exports'],
    },
  },
};
