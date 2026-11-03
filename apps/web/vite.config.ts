import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  plugins: [react()],
  // En développement, Vite sert l'interface et transmet l'API au serveur local (pnpm serveur).
  server: { proxy: { '/api': 'http://127.0.0.1:5174' } },
  build: { outDir: '../dist', emptyOutDir: true },
});
