/** @vitest-environment jsdom */
import { histogramme } from '@batchtester/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CarteDeMesure } from './CarteDeMesure.tsx';

describe('carte de mesure sans valeur', () => {
  it.each([
    {
      kind: 'categorie' as const,
      mesure: { kind: 'categorie' as const, nom: 'issue', categories: ['pile'] },
      frequences: [],
      convergence: [],
    },
    {
      kind: 'nombre' as const,
      mesure: { kind: 'nombre' as const, nom: 'duree' },
      resume: null,
      histogramme: histogramme([]),
      convergence: [],
    },
    {
      kind: 'serie' as const,
      mesure: { kind: 'serie' as const, nom: 'pv', unite: 'PV' },
      points: [],
    },
  ])('le dit au lieu de dessiner un graphique vide ($kind)', (resume) => {
    render(<CarteDeMesure resume={resume} />);
    expect(screen.getByText('Aucune valeur dans ce lot.')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
