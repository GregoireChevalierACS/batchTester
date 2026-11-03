import { agregerLesSeries, convergence, frequences, histogramme, resumer } from '@batchtester/core';
import { describe, expect, it } from 'vitest';
import type { Lot } from './lancerUnLot.ts';
import { POINTS_DE_CONVERGENCE, resumerLeLot } from './resumerLeLot.ts';
import { DEFINITION_DE_TEST, graine } from './testing/index.ts';

const iteration = (index: number, piles: number, issue: string, cumul: number[]) => ({
  index,
  graine: graine(index),
  resultat: { piles, issue, cumul },
});

const LOT: Lot = {
  definition: DEFINITION_DE_TEST,
  valeurs: { lancers: 3 },
  graine: graine(7),
  iterations: [
    iteration(0, 2, 'pile', [1, 2]),
    iteration(1, 0, 'face', [0]),
    iteration(2, 3, 'pile', [1, 2, 3]),
  ],
};

describe('résumer un lot', () => {
  it('limite chaque courbe de convergence à 100 points', () => {
    expect(POINTS_DE_CONVERGENCE).toBe(100);
  });

  it('reprend ce qui identifie le lot', () => {
    const resume = resumerLeLot(LOT);
    expect(resume).toMatchObject({
      definition: DEFINITION_DE_TEST,
      valeurs: { lancers: 3 },
      graine: graine(7),
      iterations: 3,
    });
  });

  it('résume chaque mesure selon sa sorte, dans l’ordre de la définition', () => {
    const [nombre, categorie, serie] = DEFINITION_DE_TEST.mesures;
    expect(resumerLeLot(LOT).mesures).toEqual([
      {
        kind: 'nombre',
        mesure: nombre,
        resume: resumer([2, 0, 3]),
        histogramme: histogramme([2, 0, 3]),
        convergence: convergence([2, 0, 3], POINTS_DE_CONVERGENCE),
      },
      {
        kind: 'categorie',
        mesure: categorie,
        frequences: frequences(['pile', 'face', 'pile'], ['pile', 'face']),
        convergence: [
          { categorie: 'pile', points: convergence([1, 0, 1], POINTS_DE_CONVERGENCE) },
          { categorie: 'face', points: convergence([0, 1, 0], POINTS_DE_CONVERGENCE) },
        ],
      },
      { kind: 'serie', mesure: serie, points: agregerLesSeries([[1, 2], [0], [1, 2, 3]]) },
    ]);
  });
});
