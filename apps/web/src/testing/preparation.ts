import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { fauxEcharts } from './fauxEcharts.ts';

// jsdom ne dessine pas : ECharts est remplacé par une doublure qui enregistre ce qu'on lui demande.
vi.mock('../echarts.ts', () => ({ creerUnGraphique: fauxEcharts.creer }));

// Ce que jsdom ne fournit pas : préférences d'affichage et observation des tailles.
export const preferences = { sombre: false, abonnes: new Set<() => void>() };

beforeEach(() => {
  fauxEcharts.oublier();
  preferences.sombre = false;
  preferences.abonnes.clear();
  if (typeof window === 'undefined') return;
  vi.stubGlobal('matchMedia', (requete: string) => ({
    media: requete,
    get matches() {
      return preferences.sombre;
    },
    addEventListener: (_: string, rappel: () => void) => preferences.abonnes.add(rappel),
    removeEventListener: (_: string, rappel: () => void) => preferences.abonnes.delete(rappel),
  }));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      disconnect = vi.fn();
    },
  );
});

afterEach(() => {
  if (typeof window !== 'undefined') cleanup();
  vi.unstubAllGlobals();
});
