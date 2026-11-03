import js from '@eslint/js';
import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// Ce que le noyau n'a pas le droit d'importer. dependency-cruiser vérifie le graphe complet en CI ;
// cette règle donne le même retour dès l'écriture, dans l'éditeur.
const IMPORTS_INTERDITS_DANS_LE_NOYAU = [
  {
    group: ['@batchtester/*', '**/apps/**', '**/systemes/**'],
    message: 'Le noyau ne dépend de rien : ni du runner, ni des adapters, ni des systèmes.',
  },
  {
    group: ['node:*', 'fs', 'path', 'os', 'crypto', 'process', 'http', 'child_process'],
    message:
      "Le noyau est pur : pas d'accès au système (il doit aussi tourner dans le navigateur).",
  },
];

// Une simulation doit être reproductible : même graine, même résultat. Le hasard passe par
// Aleatoire, jamais par Math.random ; le temps n'entre pas dans un calcul.
const SOURCES_DE_NON_DETERMINISME = [
  {
    selector: "NewExpression[callee.name='Date']",
    message: 'Pas de new Date() ici : le résultat doit être reproductible.',
  },
  {
    selector: "MemberExpression[object.name='Date'][property.name='now']",
    message: 'Pas de Date.now() ici : le résultat doit être reproductible.',
  },
  {
    selector: "MemberExpression[object.name='Math'][property.name='random']",
    message: 'Pas de Math.random() : utiliser le générateur Aleatoire reçu en paramètre.',
  },
];

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/reports/**', '**/.stryker-tmp/**'],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  comments.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      // Un cast est un mensonge fait au compilateur : interdit, sauf désactivation explicite
      // et justifiée (voir eslint-comments/require-description).
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@eslint-community/eslint-comments/require-description': ['error', { ignore: [] }],
      '@eslint-community/eslint-comments/no-unlimited-disable': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: IMPORTS_INTERDITS_DANS_LE_NOYAU }],
    },
  },
  {
    files: ['packages/core/src/**/*.ts', 'packages/runner/src/**/*.ts', 'systemes/*/src/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...SOURCES_DE_NON_DETERMINISME],
    },
  },
  {
    // Interface : règles des hooks React, et aucun accès à Node ni au code qui en dépend.
    files: ['apps/web/src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'node:*',
                '@batchtester/adapters',
                '@batchtester/serveur',
                '**/apps/serveur/**',
              ],
              message:
                "L'interface tourne dans le navigateur : elle ne parle au serveur que par l'API.",
            },
          ],
        },
      ],
    },
  },
  {
    // Fichiers de configuration et scripts en JavaScript : pas de typage à exploiter.
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: globals.node,
    },
  },
);
