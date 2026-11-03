import { defineConfig } from 'vitest/config';

const TOUT = { lines: 100, branches: 100, functions: 100, statements: 100 };

export default defineConfig({
  test: {
    // Chaque paquet décrit son projet dans son propre vitest.config.ts (réutilisé par Stryker).
    projects: ['packages/*', 'apps/*', 'systemes/*'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.{ts,tsx}', 'systemes/*/src/**/*.ts'],
      // Points d'entrée : ils ne font que réexporter ou brancher des modules déjà testés. La ligne
      // de commande est en plus lancée pour de vrai en CI (étape « Démonstration reproductible »),
      // et l'interface y est construite. echarts.ts ne fait qu'enregistrer des modules d'ECharts,
      // remplacé par une doublure dans les tests (jsdom ne dessine pas).
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/index.ts',
        '**/testing/**',
        '**/*.d.ts',
        'apps/cli/src/main.ts',
        'apps/serveur/src/main.ts',
        'apps/web/src/main.tsx',
        'apps/web/src/echarts.ts',
      ],
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
      thresholds: {
        // Le noyau calcule tout ce qui est affiché : une statistique fausse fausse chaque réglage.
        'packages/core/src/**': TOUT,
        'packages/runner/src/**': TOUT,
        'packages/adapters/src/**': TOUT,
        'apps/cli/src/**': TOUT,
        'apps/serveur/src/**': TOUT,
        // L'interface est testée par ses comportements (Testing Library).
        'apps/web/src/**': TOUT,
        'systemes/*/src/**': TOUT,
      },
    },
  },
});
