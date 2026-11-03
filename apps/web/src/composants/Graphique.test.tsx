/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fauxEcharts } from '../testing/fauxEcharts.ts';
import { Graphique } from './Graphique.tsx';

describe('graphique', () => {
  it('dessine dans un conteneur nommé, à la hauteur demandée', () => {
    render(<Graphique titre="Vainqueur" option={{ series: [] }} hauteur={120} />);
    const conteneur = screen.getByRole('img', { name: 'Vainqueur' });
    expect(conteneur).toHaveStyle({ height: '120px' });
    expect(screen.getByText('Vainqueur', { selector: 'figcaption' })).toBeInTheDocument();
    expect(fauxEcharts.graphiques.map((g) => g.element)).toEqual([conteneur]);
  });

  it('a une hauteur par défaut', () => {
    render(<Graphique titre="Durée" option={{}} />);
    expect(screen.getByRole('img', { name: 'Durée' })).toHaveStyle({ height: '240px' });
  });

  it("remplace l'option à chaque changement, sans recréer le graphique", () => {
    const premiere = { series: [{ type: 'bar' as const }] };
    const seconde = { series: [{ type: 'line' as const }] };
    const { rerender } = render(<Graphique titre="t" option={premiere} />);
    rerender(<Graphique titre="t" option={seconde} />);
    rerender(<Graphique titre="t" option={seconde} />);
    expect(fauxEcharts.graphiques).toHaveLength(1);
    expect(fauxEcharts.graphiques[0]?.options).toEqual([premiere, seconde]);
  });

  it('suit la taille de son conteneur et se détruit avec lui', () => {
    const rappels: (() => void)[] = [];
    const observer = vi.fn();
    const deconnecter = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(rappel: () => void) {
          rappels.push(rappel);
        }
        observe = observer;
        disconnect = deconnecter;
      },
    );
    const { unmount } = render(<Graphique titre="t" option={{}} />);
    expect(observer).toHaveBeenCalledWith(screen.getByRole('img', { name: 't' }));
    for (const rappel of rappels) rappel();
    expect(fauxEcharts.graphiques[0]?.redimensionnements).toBe(1);
    unmount();
    expect(deconnecter).toHaveBeenCalled();
    expect(fauxEcharts.graphiques[0]?.detruit).toBe(true);
  });
});
