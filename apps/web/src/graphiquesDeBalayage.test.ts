import type { AxeDeBalayage, Indicateur } from '@batchtester/runner';
import { describe, expect, it } from 'vitest';
import {
  decrireUnPoint,
  formaterIndicateur,
  infobulleDeGrille,
  infobulleDUnAxe,
  optionDeGrille,
  optionDUnAxe,
  valeurLisible,
} from './graphiquesDeBalayage.ts';
import { champ, seriesDe } from './testing/lireOption.ts';
import { CLAIR, SOMBRE } from './theme.ts';

const lisible = (texte: unknown): string => String(texte).replace(/[\u202f\u00a0]/g, ' ');

const PV: AxeDeBalayage = { parametre: 'pvA', valeurs: [80, 100, 120] };
const INITIATIVE: AxeDeBalayage = { parametre: 'initiative', valeurs: ['A', 'B'] };

const TAUX: Indicateur = {
  id: 'vainqueur=A',
  libelle: 'Vainqueur : taux de « A »',
  taux: true,
  valeurs: [
    { valeur: 0.25, basse: 0.2, haute: 0.3 },
    null,
    { valeur: 0.75, basse: 0.7, haute: 0.8 },
  ],
};

const MOYENNE: Indicateur = {
  id: 'tours:moyenne',
  libelle: 'Durée (tours) : moyenne',
  taux: false,
  valeurs: [
    { valeur: 10, basse: 9, haute: 11 },
    { valeur: 12, basse: 11.5, haute: 12.5 },
    { valeur: 8, basse: 7, haute: 9 },
    null,
    { valeur: 6, basse: 5, haute: 7 },
    { valeur: 7, basse: 6, haute: 8 },
  ],
};

describe('textes', () => {
  it('écrit une valeur de paramètre de chaque sorte', () => {
    expect(valeurLisible(1.5)).toBe('1,5');
    expect(valeurLisible(true)).toBe('oui');
    expect(valeurLisible(false)).toBe('non');
    expect(valeurLisible('A')).toBe('A');
  });

  it('écrit un taux en pourcentage et une moyenne en nombre, avec son intervalle', () => {
    expect(lisible(formaterIndicateur(TAUX, 0.25))).toBe('25,0 %');
    expect(formaterIndicateur(MOYENNE, 12.5)).toBe('12,5');
    expect(lisible(decrireUnPoint(TAUX, { valeur: 0.25, basse: 0.2, haute: 0.3 }))).toBe(
      '25,0 % (IC 95 % : 20,0 % – 30,0 %)',
    );
    expect(decrireUnPoint(MOYENNE, null)).toBe('aucune valeur');
  });
});

describe('balayage sur un axe', () => {
  it('trace la valeur et une bande empilée de la borne basse à la borne haute, en pourcentage', () => {
    const option = optionDUnAxe(PV, TAUX, CLAIR);
    expect(option.xAxis).toMatchObject({ data: ['80', '100', '120'], name: 'pvA' });
    expect(option.yAxis).toMatchObject({ axisLabel: { formatter: '{value} %' } });
    const [basse, ecart, valeur] = seriesDe(option);
    expect(champ(basse, 'data')).toEqual([20, null, 70]);
    expect(champ(ecart, 'data')).toEqual([expect.closeTo(10, 9), null, expect.closeTo(10, 9)]);
    expect(champ(valeur, 'data')).toEqual([25, null, 75]);
    expect(valeur).toMatchObject({ name: TAUX.libelle, color: CLAIR.series[0] });
  });

  it('garde les valeurs telles quelles pour une moyenne', () => {
    const option = optionDUnAxe(PV, { ...MOYENNE, valeurs: MOYENNE.valeurs.slice(0, 3) }, CLAIR);
    expect(champ(seriesDe(option)[2], 'data')).toEqual([10, 12, 8]);
    expect(option.yAxis).not.toHaveProperty('axisLabel.formatter');
  });

  it('décrit le point survolé', () => {
    expect(lisible(infobulleDUnAxe(PV, TAUX)([{ dataIndex: 2 }]))).toBe(
      '<strong>pvA = 120</strong><br>Vainqueur : taux de « A » : 75,0 % (IC 95 % : 70,0 % – 80,0 %)',
    );
  });
});

describe('balayage en grille', () => {
  it('place une case par point, le premier axe en abscisse, sans case pour un point vide', () => {
    const option = optionDeGrille([PV, INITIATIVE], MOYENNE, SOMBRE);
    expect(option.xAxis).toMatchObject({ data: ['80', '100', '120'] });
    expect(option.yAxis).toMatchObject({ data: ['A', 'B'], name: 'initiative' });
    expect(seriesDe(option)).toMatchObject([
      {
        type: 'heatmap',
        data: [
          [0, 0, 10],
          [0, 1, 12],
          [1, 0, 8],
          [2, 0, 6],
          [2, 1, 7],
        ],
        itemStyle: { borderColor: SOMBRE.surface },
      },
    ]);
    // Les bornes de l'échelle sont écrites : la couleur seule ne dit pas la valeur.
    expect(option.visualMap).toMatchObject({
      min: 6,
      max: 12,
      text: ['12', '6'],
      inRange: { color: SOMBRE.sequentielle },
    });
  });

  it('écrit les bornes d’un taux en pourcentage, et garde une échelle même sans aucune valeur', () => {
    const vide: Indicateur = { ...TAUX, valeurs: [null, null, null, null, null, null] };
    const option = optionDeGrille([PV, INITIATIVE], vide, CLAIR);
    expect(seriesDe(option)).toMatchObject([{ data: [] }]);
    expect(option.visualMap).toMatchObject({ min: 0, max: 1 });
    const deuxTaux: Indicateur = { ...TAUX, valeurs: [...TAUX.valeurs, null, null, null] };
    const echelle = champ(optionDeGrille([PV, INITIATIVE], deuxTaux, CLAIR).visualMap, 'text');
    expect(Array.isArray(echelle) && echelle.map(lisible)).toEqual(['75,0 %', '25,0 %']);
  });

  it('décrit la case survolée, en retrouvant son point malgré les cases absentes', () => {
    const infobulle = infobulleDeGrille([PV, INITIATIVE], MOYENNE, [0, 1, 2, 4, 5]);
    expect(infobulle({ dataIndex: 3 })).toBe(
      '<strong>pvA = 120, initiative = A</strong><br>Durée (tours) : moyenne : 6 (IC 95 % : 5 – 7)',
    );
  });

  it('a une échelle séquentielle d’une seule teinte, du clair au foncé en mode clair', () => {
    expect(CLAIR.sequentielle).toEqual([...SOMBRE.sequentielle].reverse());
  });
});
