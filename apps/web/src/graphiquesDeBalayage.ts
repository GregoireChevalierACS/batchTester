import { elementA, type ValeurDeParametre } from '@batchtester/core';
import type { AxeDeBalayage, Indicateur, ValeurDIndicateur } from '@batchtester/runner';
import type { EChartsOption } from 'echarts';
import { formaterNombre, formaterPourcentage } from './format.ts';
import {
  axeDeCategories,
  axeDeValeurs,
  base,
  echapper,
  GRILLE,
  GRILLE_AVEC_NOM_D_AXE,
  indexSurvole,
  infobulle,
  nomDAxe,
  type Survol,
} from './graphiques.ts';
import type { Theme } from './theme.ts';

// Graphiques d'un balayage : l'indicateur choisi en fonction d'un paramètre (courbe et bande
// d'incertitude), ou de deux (carte de chaleur à une seule teinte, du clair au foncé).

export const valeurLisible = (v: ValeurDeParametre): string => {
  if (typeof v === 'number') return formaterNombre(v);
  if (typeof v === 'boolean') return v ? 'oui' : 'non';
  return v;
};

/** Valeur d'un indicateur telle qu'on la lit : pourcentage pour un taux, nombre sinon. */
export const formaterIndicateur = (indicateur: Indicateur, x: number): string =>
  indicateur.taux ? formaterPourcentage(x) : formaterNombre(x);

export function decrireUnPoint(indicateur: Indicateur, v: ValeurDIndicateur | null): string {
  if (v === null) return 'aucune valeur';
  const f = (x: number) => formaterIndicateur(indicateur, x);
  return `${f(v.valeur)} (IC 95 % : ${f(v.basse)} – ${f(v.haute)})`;
}

/** Sur l'axe, un taux est en pourcentage (0 à 100) ; un nombre reste tel quel. */
const surLAxe = (indicateur: Indicateur, x: number): number => (indicateur.taux ? x * 100 : x);

export const infobulleDUnAxe =
  (axe: AxeDeBalayage, indicateur: Indicateur) =>
  (params: Survol): string => {
    const i = indexSurvole(params);
    const valeur = valeurLisible(elementA(axe.valeurs, i));
    return (
      `<strong>${echapper(axe.parametre)} = ${echapper(valeur)}</strong><br>` +
      `${echapper(indicateur.libelle)} : ${decrireUnPoint(indicateur, elementA(indicateur.valeurs, i))}`
    );
  };

/** L'indicateur selon les valeurs d'un paramètre : courbe et bande de l'intervalle à 95 %. */
export function optionDUnAxe(
  axe: AxeDeBalayage,
  indicateur: Indicateur,
  theme: Theme,
): EChartsOption {
  const couleur = elementA(theme.series, 0);
  const invisible = { opacity: 0 };
  const point = (f: (v: ValeurDIndicateur) => number) =>
    indicateur.valeurs.map((v) => (v === null ? null : surLAxe(indicateur, f(v))));
  const basses = point((v) => v.basse);
  const hautes = point((v) => v.haute);
  return {
    ...base(theme),
    grid: GRILLE_AVEC_NOM_D_AXE,
    xAxis: {
      ...axeDeCategories(theme, axe.valeurs.map(valeurLisible)),
      ...nomDAxe(theme, axe.parametre),
      boundaryGap: false,
    },
    yAxis: {
      ...axeDeValeurs(theme),
      scale: true,
      ...(indicateur.taux ? { axisLabel: { color: theme.discret, formatter: '{value} %' } } : {}),
    },
    tooltip: { ...infobulle(theme), trigger: 'axis', formatter: infobulleDUnAxe(axe, indicateur) },
    series: [
      // La bande est empilée : la borne basse (invisible), puis l'écart jusqu'à la borne haute.
      {
        type: 'line',
        name: 'basse',
        stack: 'ic',
        showSymbol: false,
        lineStyle: invisible,
        data: basses,
      },
      {
        type: 'line',
        name: 'IC 95 %',
        stack: 'ic',
        showSymbol: false,
        lineStyle: invisible,
        areaStyle: { color: couleur, opacity: 0.18 },
        data: hautes.map((h, i) => {
          const b = elementA(basses, i);
          return h === null || b === null ? null : h - b;
        }),
      },
      {
        type: 'line',
        name: indicateur.libelle,
        color: couleur,
        lineStyle: { width: 2 },
        symbolSize: 8,
        data: point((v) => v.valeur),
      },
    ],
  };
}

/**
 * Infobulle d'une case. `points` donne, pour chaque case dessinée, l'index du point du balayage :
 * les points sans valeur n'ont pas de case.
 */
export const infobulleDeGrille =
  (
    [x, y]: readonly [AxeDeBalayage, AxeDeBalayage],
    indicateur: Indicateur,
    points: readonly number[],
  ) =>
  (params: Survol): string => {
    const k = elementA(points, indexSurvole(params));
    const valeurX = valeurLisible(elementA(x.valeurs, Math.floor(k / y.valeurs.length)));
    const valeurY = valeurLisible(elementA(y.valeurs, k % y.valeurs.length));
    const point = elementA(indicateur.valeurs, k);
    return (
      `<strong>${echapper(x.parametre)} = ${echapper(valeurX)}, ` +
      `${echapper(y.parametre)} = ${echapper(valeurY)}</strong><br>` +
      `${echapper(indicateur.libelle)} : ${decrireUnPoint(indicateur, point)}`
    );
  };

/** L'indicateur selon deux paramètres : une case par point, plus foncée quand la valeur monte. */
export function optionDeGrille(
  axes: readonly [AxeDeBalayage, AxeDeBalayage],
  indicateur: Indicateur,
  theme: Theme,
): EChartsOption {
  const [x, y] = axes;
  // Le premier axe varie le plus lentement : le point k est en (k ÷ |y|, k mod |y|).
  const dessines = indicateur.valeurs.flatMap((v, k) => (v === null ? [] : [{ k, v }]));
  const cases = dessines.map(({ k, v }) => [
    Math.floor(k / y.valeurs.length),
    k % y.valeurs.length,
    surLAxe(indicateur, v.valeur),
  ]);
  const valeurs = cases.map((c) => elementA(c, 2));
  const min = valeurs.length === 0 ? 0 : Math.min(...valeurs);
  const max = valeurs.length === 0 ? 1 : Math.max(...valeurs);
  // L'échelle est sur l'axe : un taux y est en centièmes, on le réécrit en pourcentage.
  const etiquette = (x: number) => formaterIndicateur(indicateur, indicateur.taux ? x / 100 : x);
  return {
    ...base(theme),
    grid: { ...GRILLE, bottom: 72, top: 28 },
    xAxis: {
      ...axeDeCategories(theme, x.valeurs.map(valeurLisible)),
      ...nomDAxe(theme, x.parametre),
    },
    yAxis: {
      ...axeDeCategories(theme, y.valeurs.map(valeurLisible)),
      name: y.parametre,
      nameTextStyle: { color: theme.discret },
    },
    visualMap: {
      type: 'continuous',
      min,
      max,
      // Sans ces bornes écrites, la couleur ne dit pas quelle valeur elle représente.
      text: [etiquette(max), etiquette(min)],
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      calculable: false,
      inRange: { color: [...theme.sequentielle] },
      textStyle: { color: theme.encreSecondaire },
    },
    tooltip: {
      ...infobulle(theme),
      trigger: 'item',
      formatter: infobulleDeGrille(
        axes,
        indicateur,
        dessines.map(({ k }) => k),
      ),
    },
    series: [
      {
        type: 'heatmap',
        name: indicateur.libelle,
        data: cases,
        // Fin liseré de la couleur de la surface entre les cases (skill dataviz).
        itemStyle: { borderColor: theme.surface, borderWidth: 2 },
      },
    ],
  };
}
