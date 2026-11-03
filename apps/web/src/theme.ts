import { useSyncExternalStore } from 'react';

/**
 * Couleurs des graphiques. Palette de référence du skill dataviz, validée (contraste, daltonisme)
 * en clair et en sombre : les catégories prennent les couleurs dans cet ordre fixe, jamais
 * recyclées, et gardent la même couleur d'un lot à l'autre.
 */
export interface Theme {
  readonly surface: string;
  readonly encre: string;
  readonly encreSecondaire: string;
  readonly discret: string;
  readonly grille: string;
  readonly axe: string;
  readonly series: readonly string[];
}

export const CLAIR: Theme = {
  surface: '#fcfcfb',
  encre: '#0b0b0b',
  encreSecondaire: '#52514e',
  discret: '#898781',
  grille: '#e1e0d9',
  axe: '#c3c2b7',
  series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
};

export const SOMBRE: Theme = {
  surface: '#1a1a19',
  encre: '#f0efec',
  encreSecondaire: '#c3c2b7',
  discret: '#898781',
  grille: '#2c2c2a',
  axe: '#383835',
  series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
};

/** Au-delà, des courbes de catégories se confondraient : elles restent dans le tableau. */
export const COULEURS_DE_SERIE = CLAIR.series.length;

const REQUETE_SOMBRE = '(prefers-color-scheme: dark)';

function abonner(prevenir: () => void): () => void {
  const requete = window.matchMedia(REQUETE_SOMBRE);
  requete.addEventListener('change', prevenir);
  return () => {
    requete.removeEventListener('change', prevenir);
  };
}

const estSombre = (): boolean => window.matchMedia(REQUETE_SOMBRE).matches;

/** Thème du système, suivi en direct quand l'utilisateur bascule en mode sombre. */
export function useTheme(): Theme {
  return useSyncExternalStore(abonner, estSombre) ? SOMBRE : CLAIR;
}
