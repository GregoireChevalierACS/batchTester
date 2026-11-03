import react from '@vitejs/plugin-react';
import { defineProject } from 'vitest/config';

export default defineProject({
  plugins: [react()],
  test: {
    name: 'web',
    // Les tests de composants déclarent jsdom en tête de fichier ; les autres restent en Node.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/testing/preparation.ts'],
  },
});
