import { defineProject } from 'vitest/config';

export default defineProject({
  test: { name: 'systeme-combat', include: ['src/**/*.test.ts'] },
});
