import { defineConfig } from 'vitest/config';

const TOUT = { lines: 100, branches: 100, functions: 100, statements: 100 };

export default defineConfig({
  test: {
    // Chaque paquet décrit son projet dans son propre vitest.config.ts (réutilisé par Stryker).
    projects: ['packages/*', 'apps/*', 'systemes/*'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.ts', 'systemes/*/src/**/*.ts'],
      // Points d'entrée : ils ne font que réexporter ou brancher des modules déjà testés. La ligne
      // de commande est en plus lancée pour de vrai en CI (étape « Démonstration reproductible »).
      exclude: [
        '**/*.test.ts',
        '**/index.ts',
        '**/testing/**',
        '**/*.d.ts',
        'apps/cli/src/main.ts',
      ],
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
      thresholds: {
        // Le noyau calcule tout ce qui est affiché : une statistique fausse fausse chaque réglage.
        'packages/core/src/**': TOUT,
        'packages/runner/src/**': TOUT,
        'packages/adapters/src/**': TOUT,
        'apps/cli/src/**': TOUT,
        'systemes/*/src/**': TOUT,
      },
    },
  },
});
