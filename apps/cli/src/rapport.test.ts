import {
  agregerLesSeries,
  frequences,
  histogramme,
  resumer,
  type DefinitionDeSysteme,
  type DefMesureCategorie,
  type DefMesureNombre,
  type DefMesureSerie,
} from '@batchtester/core';
import type { ResumeDeLot } from '@batchtester/runner';
import { graine } from '@batchtester/runner/testing';
import { describe, expect, it } from 'vitest';
import {
  formaterLeRapport,
  formaterNombre,
  formaterPourcentage,
  indicesAffiches,
} from './rapport.ts';

describe('formats', () => {
  it.each([
    [12, '12'],
    [0.5, '0,5'],
    [-3.14159, '-3,14'],
    [2.005, '2,01'],
    [-0.001, '0'],
    [1234567.891, '1234567,89'],
  ])('formate le nombre %d en « %s »', (x, texte) => {
    expect(formaterNombre(x)).toBe(texte);
  });

  it.each([
    [0, '0,0 %'],
    [0.335, '33,5 %'],
    [1, '100,0 %'],
  ])('formate la proportion %d en « %s »', (p, texte) => {
    expect(formaterPourcentage(p)).toBe(texte);
  });

  it('affiche tous les tours d’une série courte, et un échantillon régulier d’une longue', () => {
    expect(indicesAffiches(0)).toEqual([]);
    expect(indicesAffiches(10)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(indicesAffiches(11)).toEqual([0, 1, 2, 3, 4, 6, 7, 8, 9, 10]);
    expect(indicesAffiches(101)).toEqual([0, 11, 22, 33, 44, 56, 67, 78, 89, 100]);
  });
});

const VAINQUEUR: DefMesureCategorie = {
  kind: 'categorie',
  nom: 'vainqueur',
  libelle: 'Vainqueur',
  categories: ['A', 'B', 'nul'],
};
const TOURS: DefMesureNombre = { kind: 'nombre', nom: 'tours', unite: 'tours' };
const ECART: DefMesureNombre = { kind: 'nombre', nom: 'ecart', libelle: 'Écart' };
const PV: DefMesureSerie = { kind: 'serie', nom: 'pv', libelle: 'PV par tour', unite: 'PV' };

const DEFINITION: DefinitionDeSysteme = {
  nom: 'Duel',
  version: '2.1',
  parametres: [
    { kind: 'entier', nom: 'pv', libelle: 'Points de vie', min: 1, max: 500, defaut: 100 },
    { kind: 'nombre', nom: 'precision', min: 0, max: 1, pas: 0.05, defaut: 0.75 },
    { kind: 'booleen', nom: 'bouclier', defaut: true },
    { kind: 'choix', nom: 'classe', options: ['mage', 'guerrier'], defaut: 'mage' },
  ],
  mesures: [VAINQUEUR, TOURS, ECART, PV],
};

const RESUME: ResumeDeLot = {
  definition: DEFINITION,
  valeurs: { pv: 100, precision: 0.75, bouclier: true, classe: 'mage' },
  graine: graine(42),
  iterations: 4,
  mesures: [
    {
      kind: 'categorie',
      mesure: VAINQUEUR,
      frequences: frequences(['A', 'A', 'B', 'A'], ['A', 'B', 'nul']),
    },
    {
      kind: 'nombre',
      mesure: TOURS,
      resume: resumer([3, 5, 5, 4]),
      histogramme: histogramme([3, 5, 5, 4]),
    },
    {
      kind: 'nombre',
      mesure: ECART,
      resume: resumer([-12.5, 40, 3.25, 0]),
      histogramme: histogramme([-12.5, 40, 3.25, 0]),
    },
    {
      kind: 'serie',
      mesure: PV,
      points: agregerLesSeries([[100, 60, 20], [100, 50], [100, 70, 30], [100]]),
    },
  ],
};

describe('rapport texte', () => {
  it('présente le lot, ses paramètres et chaque mesure', () => {
    expect(formaterLeRapport(RESUME)).toMatchInlineSnapshot(`
      "Duel — version 2.1
      4 itérations · graine 42

      Paramètres
        pv         100   Points de vie
        precision  0,75
        bouclier   oui
        classe     mage

      Vainqueur
        A     75,0 %  [30,1 % – 95,4 %]  ██████████████████████████████
        B     25,0 %  [4,6 % – 69,9 %]   ██████████
        nul    0,0 %  [0,0 % – 49,0 %]

      tours (tours)
        moyenne 4,25 · écart-type 0,96
        min 3 · p5 3,15 · p25 3,75 · médiane 4,5 · p75 5 · p95 5 · max 5
        3 │███████████████                1
        4 │███████████████                1
        5 │██████████████████████████████ 2

      Écart
        moyenne 7,69 · écart-type 22,59
        min -12,5 · p5 -10,62 · p25 -3,12 · médiane 1,63 · p75 12,44 · p95 34,49 · max 40
        -12,5 – 5 │██████████████████████████████ 3
         5 – 22,5 │                               0
        22,5 – 40 │██████████                     1

      PV par tour (PV)
        0 : moyenne 100  [100 – 100]  sur 4
        1 : moyenne 60  [50 – 70]  sur 3
        2 : moyenne 25  [20 – 30]  sur 2
      "
    `);
  });

  it('affiche un booléen faux par « non »', () => {
    const sansBouclier = { ...RESUME, valeurs: { ...RESUME.valeurs, bouclier: false } };
    expect(formaterLeRapport(sansBouclier)).toContain('  bouclier   non\n');
  });

  it('signale les sections sans valeur', () => {
    const vide: ResumeDeLot = {
      ...RESUME,
      definition: { ...DEFINITION, parametres: [] },
      mesures: [
        { kind: 'categorie', mesure: VAINQUEUR, frequences: [] },
        { kind: 'nombre', mesure: TOURS, resume: null, histogramme: histogramme([]) },
        { kind: 'serie', mesure: PV, points: [] },
      ],
    };
    expect(formaterLeRapport(vide)).toBe(
      [
        'Duel — version 2.1',
        '4 itérations · graine 42',
        '',
        'Paramètres',
        '  aucun',
        '',
        'Vainqueur',
        '  aucune valeur',
        '',
        'tours (tours)',
        '  aucune valeur',
        '',
        'PV par tour (PV)',
        '  aucune valeur',
        '',
      ].join('\n'),
    );
  });
});
