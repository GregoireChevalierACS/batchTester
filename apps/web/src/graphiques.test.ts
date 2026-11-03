import { elementA, frequences, histogramme, type PointDeSerie } from '@batchtester/core';
import { describe, expect, it } from 'vitest';
import { formaterNombre, formaterPourcentage } from './format.ts';
import {
  dessinerUnTaux,
  enNombre,
  enPourcentage,
  etiquetteDeClasse,
  indexSurvole,
  infobulleDeClasse,
  infobulleDeFrequence,
  infobulleDeSerie,
  infobulleDesFrequences,
  infobulleDesSeries,
  optionDeConvergence,
  optionDeConvergenceDesCategories,
  optionDeLaSerie,
  optionDeLHistogramme,
  optionDesFrequences,
} from './graphiques.ts';
import { champ, seriesDe } from './testing/lireOption.ts';
import { CLAIR, SOMBRE } from './theme.ts';

// Intl met des espaces fines insécables (milliers, « % ») : on compare le texte tel qu'il se lit.
const lisible = (texte: unknown): string => String(texte).replace(/[\u202f\u00a0]/g, ' ');

describe('formats', () => {
  it('écrit les nombres et les pourcentages à la française', () => {
    expect(lisible(formaterNombre(1234.567))).toBe('1 234,57');
    expect(lisible(formaterPourcentage(0.485))).toBe('48,5 %');
    expect(enNombre(10.456)).toBe('10,46');
    expect(lisible(enPourcentage(48.5))).toBe('48,5 %');
  });
});

describe('marque survolée', () => {
  it("lit l'index d'une marque seule ou de la première d'une liste", () => {
    expect(indexSurvole({ dataIndex: 3 })).toBe(3);
    expect(indexSurvole([{ dataIndex: 2 }, { dataIndex: 5 }])).toBe(2);
    expect(indexSurvole([])).toBe(0);
  });
});

const FREQUENCES = frequences(['A', 'A', 'B', 'A'], ['A', 'B', 'nul']);

describe('taux par catégorie', () => {
  it("place une ligne par catégorie, dans l'ordre de la définition, de 0 à 100 %", () => {
    const option = optionDesFrequences(FREQUENCES, CLAIR);
    expect(option.yAxis).toMatchObject({ data: ['A', 'B', 'nul'], inverse: true });
    expect(option.xAxis).toMatchObject({ min: 0, max: 100 });
    expect(champ(seriesDe(option)[0], 'data')).toEqual(
      FREQUENCES.map((f, i) => [i, f.proportion, f.basse, f.haute]),
    );
    expect(option.tooltip).toMatchObject({ trigger: 'item' });
  });

  it("dit le taux, l'intervalle et l'effectif au survol, sans interpréter de HTML", () => {
    expect(lisible(infobulleDesFrequences(FREQUENCES)({ dataIndex: 0 }))).toBe(
      '<strong>A</strong> : 75,0 %<br>IC 95 % : 30,1 % – 95,4 %<br>3 sur 4 itérations',
    );
    const piege = { ...elementA(FREQUENCES, 0), categorie: '<b>"&\'' };
    expect(infobulleDeFrequence(piege, 4)).toContain('&#60;b&#62;&#34;&#38;&#39;');
  });

  it('dessine la moustache de basse à haute, le point et son étiquette', () => {
    const ligne = [1, 0.5, 0.25, 0.75];
    const api = {
      value: (dimension: number) => ligne[dimension],
      coord: ([x = 0, y = 0]: number[]) => [x * 2, y * 10],
    };
    expect(dessinerUnTaux('#123456', CLAIR)({}, api)).toMatchObject({
      type: 'group',
      children: [
        { type: 'line', shape: { x1: 50, y1: 10, x2: 150, y2: 10 }, style: { stroke: '#123456' } },
        { type: 'line', shape: { x1: 50, y1: 5, x2: 50, y2: 15 } },
        { type: 'line', shape: { x1: 150, y1: 5, x2: 150, y2: 15 } },
        {
          type: 'circle',
          shape: { cx: 100, cy: 10, r: 5 },
          style: { fill: '#123456', stroke: CLAIR.surface },
        },
        {
          type: 'text',
          x: 158,
          y: 10,
          style: { text: formaterPourcentage(0.5), fill: CLAIR.encre },
        },
      ],
    });
  });
});

describe('convergence', () => {
  it("trace une courbe par catégorie, en pourcentage, aux couleurs de la palette dans l'ordre", () => {
    const convergence = [
      {
        categorie: 'A',
        points: [
          { iterations: 1, moyenne: 1 },
          { iterations: 2, moyenne: 0.5 },
        ],
      },
      { categorie: 'B', points: [{ iterations: 1, moyenne: 0 }] },
    ];
    const option = optionDeConvergenceDesCategories(convergence, SOMBRE);
    expect(seriesDe(option)).toMatchObject([
      {
        name: 'A',
        color: SOMBRE.series[0],
        data: [
          [1, 100],
          [2, 50],
        ],
      },
      { name: 'B', color: SOMBRE.series[1], data: [[1, 0]] },
    ]);
    expect(option.tooltip).toMatchObject({ trigger: 'axis', valueFormatter: enPourcentage });
  });

  it("ne trace jamais plus de courbes que la palette n'a de couleurs", () => {
    const convergence = Array.from({ length: 10 }, (_, i) => ({
      categorie: String(i),
      points: [],
    }));
    expect(seriesDe(optionDeConvergenceDesCategories(convergence, CLAIR))).toHaveLength(8);
  });

  it("trace la moyenne cumulée d'une mesure, sur une échelle ajustée aux valeurs", () => {
    const option = optionDeConvergence([{ iterations: 10, moyenne: 4.5 }], CLAIR);
    expect(seriesDe(option)).toMatchObject([{ data: [[10, 4.5]], color: CLAIR.series[0] }]);
    expect(option.yAxis).toMatchObject({ scale: true });
    expect(option.tooltip).toMatchObject({ valueFormatter: enNombre });
  });
});

describe('distribution', () => {
  it('nomme une classe discrète par sa valeur, une classe réelle par ses bornes', () => {
    expect(etiquetteDeClasse({ debut: 7, fin: 8, effectif: 1 }, true)).toBe('7');
    expect(etiquetteDeClasse({ debut: -2.5, fin: 1.25, effectif: 1 }, false)).toBe('-2,5 – 1,25');
  });

  it("dessine des barres fines, arrondies en haut, d'une seule couleur", () => {
    const { classes, discret } = histogramme([3, 5, 5]);
    const option = optionDeLHistogramme(classes, discret, CLAIR);
    expect(option.xAxis).toMatchObject({ data: ['3', '4', '5'] });
    expect(seriesDe(option)).toMatchObject([
      {
        type: 'bar',
        barMaxWidth: 24,
        data: [1, 0, 2],
        itemStyle: { color: CLAIR.series[0], borderRadius: [4, 4, 0, 0] },
      },
    ]);
  });

  it("donne l'effectif de la classe survolée", () => {
    const { classes, discret } = histogramme([3, 5, 5]);
    expect(infobulleDeClasse(classes, discret)({ dataIndex: 2 })).toBe('5 : 2 itérations');
    expect(infobulleDeClasse(classes, discret)({ dataIndex: 0 })).toBe('3 : 1 itération');
  });
});

describe('série par tour', () => {
  const points: PointDeSerie[] = [
    { indice: 0, n: 3, moyenne: 100, min: 100, max: 100 },
    { indice: 1, n: 1, moyenne: 60, min: 50, max: 70 },
  ];

  it('empile une bande min – max sous la courbe de la moyenne', () => {
    expect(seriesDe(optionDeLaSerie(points, CLAIR))).toMatchObject([
      { name: 'min', stack: 'bande', data: [100, 50] },
      { name: 'min – max', stack: 'bande', data: [0, 20] },
      { name: 'moyenne', data: [100, 60] },
    ]);
    expect(champ(seriesDe(optionDeLaSerie(points, CLAIR))[2], 'stack')).toBeUndefined();
  });

  it('résume le tour survolé', () => {
    expect(infobulleDesSeries(points)([{ dataIndex: 1 }])).toBe(
      '<strong>Tour 1</strong><br>moyenne 60 (50 – 70)<br>sur 1 itération',
    );
    expect(infobulleDeSerie(elementA(points, 0))).toContain('sur 3 itérations');
  });
});
