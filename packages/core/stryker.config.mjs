// Test de mutation : Stryker modifie le code (mutants) et vérifie qu'au moins un test échoue.
// La couverture dit qu'une ligne a été exécutée ; la mutation prouve qu'elle a été vérifiée.
// Un mutant équivalent ne s'ignore qu'avec un commentaire « // Stryker disable next-line … : raison ».

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  // Déclarés explicitement : avec pnpm, Stryker ne découvre pas ses plugins tout seul.
  plugins: ['@stryker-mutator/vitest-runner', '@stryker-mutator/typescript-checker'],
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.ts' },
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  mutate: ['src/**/*.ts', '!src/**/*.test.ts', '!src/index.ts'],
  coverageAnalysis: 'perTest',
  thresholds: { high: 100, low: 90, break: 80 },
  reporters: ['clear-text', 'progress', 'html'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  tempDirName: '.stryker-tmp',
};
