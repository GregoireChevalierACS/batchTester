import { defineProject } from 'vitest/config';

export default defineProject({
  test: { name: 'systeme-cartes', include: ['src/**/*.test.ts'] },
});
