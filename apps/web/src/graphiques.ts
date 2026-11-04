import {
  elementA,
  intervalleDeLaMoyenne,
  type Classe,
  type Frequence,
  type PointDeConvergence,
  type PointDeSerie,
  type Resume,
} from '@batchtester/core';
import type { ComparaisonDeCategorie, ConvergenceDeCategorie } from '@batchtester/runner';
import type { CustomSeriesRenderItemReturn, EChartsOption } from 'echarts';
import { formaterNombre, formaterPourcentage } from './format.ts';
import { COULEURS_DE_SERIE, type Theme } from './theme.ts';

// Constructeurs d'options ECharts : des fonctions pures du résumé et du thème, testées sans
// navigateur. Règles (skill dataviz) : traits fins, une couleur par entité dans un ordre fixe,
// grille discrète, infobulle sur chaque marque, aucun double axe.

const POLICE = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const echapper = (texte: string): string =>
  texte.replace(/[&<>"']/g, (c) => `&#${String(c.charCodeAt(0))};`);

interface Marque {
  readonly dataIndex: number;
  readonly seriesIndex?: number;
}

/** Ce qu'ECharts passe à une infobulle : la marque survolée, ou toutes celles d'un axe. */
export type Survol = Marque | readonly Marque[];

/** Index de la marque survolée, que l'infobulle reçoive une marque ou la liste d'un axe. */
export const indexSurvole = (params: Survol): number => [params].flat()[0]?.dataIndex ?? 0;

/** Série de la marque survolée (0 pour la première). */
export const serieSurvolee = (params: Survol): number => [params].flat()[0]?.seriesIndex ?? 0;

/** Ce que le dessin d'une marque personnalisée lit dans l'API d'ECharts. */
export interface ApiDeDessin {
  value(dimension: number): unknown;
  coord(point: number[]): number[];
}

export const enPourcentage = (valeur: unknown): string => formaterPourcentage(Number(valeur) / 100);

export const enNombre = (valeur: unknown): string => formaterNombre(Number(valeur));

export function base(theme: Theme): EChartsOption {
  return {
    backgroundColor: 'transparent',
    animationDuration: 200,
    textStyle: { fontFamily: POLICE, color: theme.encreSecondaire },
  };
}

export const infobulle = (theme: Theme) => ({
  backgroundColor: theme.surface,
  borderColor: theme.axe,
  textStyle: { color: theme.encre, fontFamily: POLICE },
});

export const axeDeValeurs = (theme: Theme) => ({
  type: 'value' as const,
  axisLine: { show: false },
  axisLabel: { color: theme.discret },
  splitLine: { lineStyle: { color: theme.grille } },
});

export const axeDeCategories = (theme: Theme, donnees: readonly string[]) => ({
  type: 'category' as const,
  data: [...donnees],
  axisLine: { lineStyle: { color: theme.axe } },
  axisTick: { show: false },
  axisLabel: { color: theme.encreSecondaire },
});

/** Nom d'axe centré sous l'axe : au bout, il serait coupé par le bord du graphique. */
export const nomDAxe = (theme: Theme, nom: string) => ({
  name: nom,
  nameLocation: 'middle' as const,
  nameGap: 26,
  nameTextStyle: { color: theme.discret },
});

const axeDesIterations = (theme: Theme) => ({
  ...axeDeValeurs(theme),
  ...nomDAxe(theme, 'itérations'),
  min: 1,
  // Sans cela, l'axe s'arrondit (210 pour un lot de 200) et laisse un vide après la courbe.
  max: 'dataMax' as const,
});

export const GRILLE = { left: 8, right: 16, top: 16, bottom: 24, containLabel: true };
export const GRILLE_AVEC_NOM_D_AXE = { ...GRILLE, bottom: 36 };

// --- Taux par catégorie : un point et son intervalle de confiance à 95 % --------------------

export const infobulleDeFrequence = (f: Frequence, total: number): string =>
  `<strong>${echapper(f.categorie)}</strong> : ${formaterPourcentage(f.proportion)}<br>` +
  `IC 95 % : ${formaterPourcentage(f.basse)} – ${formaterPourcentage(f.haute)}<br>` +
  `${String(f.effectif)} sur ${String(total)} itérations`;

export const infobulleDesFrequences =
  (frequences: readonly Frequence[]) =>
  (params: Survol): string =>
    infobulleDeFrequence(
      elementA(frequences, indexSurvole(params)),
      frequences.reduce((somme, f) => somme + f.effectif, 0),
    );

export interface StyleDIntervalle {
  readonly couleur: string;
  /** Facteur entre la valeur et l'axe : 100 pour une proportion affichée en pourcentage. */
  readonly echelle: number;
  readonly formater: (valeur: number) => string;
  /** Décalage vertical en pixels : sépare deux lots sur la même ligne. */
  readonly decalage: number;
}

/** Dessine, pour une ligne [index, valeur, basse, haute], la moustache, le point et son étiquette. */
export const dessinerUnIntervalle =
  ({ couleur, echelle, formater, decalage }: StyleDIntervalle, theme: Theme) =>
  (_params: unknown, api: ApiDeDessin): CustomSeriesRenderItemReturn => {
    const surLAxe = (dimension: number) => Number(api.value(dimension)) * echelle;
    const ligne = Number(api.value(0));
    const valeur = surLAxe(1);
    const point = api.coord([valeur, ligne]);
    const gauche = elementA(api.coord([surLAxe(2), ligne]), 0);
    const droite = elementA(api.coord([surLAxe(3), ligne]), 0);
    const x = elementA(point, 0);
    const y = elementA(point, 1) + decalage;
    const trait = { stroke: couleur, lineWidth: 2 };
    return {
      type: 'group',
      children: [
        { type: 'line', shape: { x1: gauche, y1: y, x2: droite, y2: y }, style: trait },
        { type: 'line', shape: { x1: gauche, y1: y - 5, x2: gauche, y2: y + 5 }, style: trait },
        { type: 'line', shape: { x1: droite, y1: y - 5, x2: droite, y2: y + 5 }, style: trait },
        {
          type: 'circle',
          shape: { cx: x, cy: y, r: 5 },
          style: { fill: couleur, stroke: theme.surface, lineWidth: 2 },
        },
        {
          type: 'text',
          x: droite + 8,
          y,
          style: {
            text: formater(valeur / echelle),
            fill: theme.encre,
            verticalAlign: 'middle',
            font: `12px ${POLICE}`,
          },
        },
      ],
    };
  };

/** Un taux : proportion affichée en pourcentage, sur un axe de 0 à 100. */
export const dessinerUnTaux = (couleur: string, theme: Theme) =>
  dessinerUnIntervalle(
    { couleur, echelle: 100, formater: formaterPourcentage, decalage: 0 },
    theme,
  );

export function optionDesFrequences(frequences: readonly Frequence[], theme: Theme): EChartsOption {
  return {
    ...base(theme),
    grid: { ...GRILLE, right: 64, top: 8 },
    xAxis: {
      ...axeDeValeurs(theme),
      min: 0,
      max: 100,
      axisLabel: { color: theme.discret, formatter: '{value} %' },
    },
    yAxis: {
      ...axeDeCategories(
        theme,
        frequences.map((f) => f.categorie),
      ),
      inverse: true,
    },
    tooltip: {
      ...infobulle(theme),
      trigger: 'item',
      formatter: infobulleDesFrequences(frequences),
    },
    series: [
      {
        type: 'custom',
        renderItem: dessinerUnTaux(elementA(theme.series, 0), theme),
        encode: { x: [1, 2, 3], y: 0 },
        data: frequences.map((f, i) => [i, f.proportion, f.basse, f.haute]),
      },
    ],
  };
}

// --- Convergence ------------------------------------------------------------------------------

/** Proportion de chaque catégorie au fil des itérations, une courbe par catégorie. */
export function optionDeConvergenceDesCategories(
  convergence: readonly ConvergenceDeCategorie[],
  theme: Theme,
): EChartsOption {
  return {
    ...base(theme),
    grid: { ...GRILLE_AVEC_NOM_D_AXE, top: 36 },
    legend: { top: 0, left: 0, textStyle: { color: theme.encreSecondaire }, icon: 'roundRect' },
    xAxis: axeDesIterations(theme),
    yAxis: {
      ...axeDeValeurs(theme),
      min: 0,
      max: 100,
      axisLabel: { color: theme.discret, formatter: '{value} %' },
    },
    tooltip: { ...infobulle(theme), trigger: 'axis', valueFormatter: enPourcentage },
    series: convergence.slice(0, COULEURS_DE_SERIE).map(({ categorie, points }, i) => ({
      type: 'line',
      name: categorie,
      showSymbol: false,
      color: elementA(theme.series, i),
      lineStyle: { width: 2 },
      data: points.map((p) => [p.iterations, p.moyenne * 100]),
    })),
  };
}

/** Moyenne d'une mesure au fil des itérations : si la fin bouge encore, le lot est trop court. */
export function optionDeConvergence(
  points: readonly PointDeConvergence[],
  theme: Theme,
): EChartsOption {
  return {
    ...base(theme),
    grid: GRILLE_AVEC_NOM_D_AXE,
    xAxis: axeDesIterations(theme),
    yAxis: { ...axeDeValeurs(theme), scale: true },
    tooltip: { ...infobulle(theme), trigger: 'axis', valueFormatter: enNombre },
    series: [
      {
        type: 'line',
        name: 'moyenne',
        showSymbol: false,
        color: elementA(theme.series, 0),
        lineStyle: { width: 2 },
        data: points.map((p) => [p.iterations, p.moyenne]),
      },
    ],
  };
}

// --- Distribution -----------------------------------------------------------------------------

export const etiquetteDeClasse = (classe: Classe, discret: boolean): string =>
  discret
    ? formaterNombre(classe.debut)
    : `${formaterNombre(classe.debut)} – ${formaterNombre(classe.fin)}`;

export const infobulleDeClasse =
  (classes: readonly Classe[], discret: boolean) =>
  (params: Survol): string => {
    const classe = elementA(classes, indexSurvole(params));
    const pluriel = classe.effectif > 1 ? 's' : '';
    return `${etiquetteDeClasse(classe, discret)} : ${String(classe.effectif)} itération${pluriel}`;
  };

export function optionDeLHistogramme(
  classes: readonly Classe[],
  discret: boolean,
  theme: Theme,
): EChartsOption {
  return {
    ...base(theme),
    grid: GRILLE,
    xAxis: axeDeCategories(
      theme,
      classes.map((c) => etiquetteDeClasse(c, discret)),
    ),
    yAxis: { ...axeDeValeurs(theme), minInterval: 1 },
    tooltip: {
      ...infobulle(theme),
      trigger: 'item',
      formatter: infobulleDeClasse(classes, discret),
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 24,
        itemStyle: { color: elementA(theme.series, 0), borderRadius: [4, 4, 0, 0] },
        data: classes.map((c) => c.effectif),
      },
    ],
  };
}

// --- Série par tour : moyenne et bande min–max ------------------------------------------------

export const infobulleDeSerie = (point: PointDeSerie): string =>
  `<strong>Tour ${String(point.indice)}</strong><br>` +
  `moyenne ${formaterNombre(point.moyenne)} ` +
  `(${formaterNombre(point.min)} – ${formaterNombre(point.max)})<br>` +
  `sur ${String(point.n)} itération${point.n > 1 ? 's' : ''}`;

export const infobulleDesSeries =
  (points: readonly PointDeSerie[]) =>
  (params: Survol): string =>
    infobulleDeSerie(elementA(points, indexSurvole(params)));

export function optionDeLaSerie(points: readonly PointDeSerie[], theme: Theme): EChartsOption {
  const couleur = elementA(theme.series, 0);
  const invisible = { opacity: 0 };
  return {
    ...base(theme),
    grid: GRILLE_AVEC_NOM_D_AXE,
    xAxis: {
      ...axeDeCategories(
        theme,
        points.map((p) => String(p.indice)),
      ),
      ...nomDAxe(theme, 'tour'),
      boundaryGap: false,
    },
    yAxis: { ...axeDeValeurs(theme), scale: true },
    tooltip: { ...infobulle(theme), trigger: 'axis', formatter: infobulleDesSeries(points) },
    series: [
      // La bande est empilée : le minimum (invisible), puis l'écart jusqu'au maximum.
      {
        type: 'line',
        name: 'min',
        stack: 'bande',
        showSymbol: false,
        lineStyle: invisible,
        data: points.map((p) => p.min),
      },
      {
        type: 'line',
        name: 'min – max',
        stack: 'bande',
        showSymbol: false,
        lineStyle: invisible,
        areaStyle: { color: couleur, opacity: 0.18 },
        data: points.map((p) => p.max - p.min),
      },
      {
        type: 'line',
        name: 'moyenne',
        showSymbol: false,
        color: couleur,
        lineStyle: { width: 2 },
        data: points.map((p) => p.moyenne),
      },
    ],
  };
}

// --- Comparaison de deux lots : A dans la première couleur, B dans la seconde ---------------

/** Écart vertical entre A et B sur une même ligne, en pixels. */
export const DECALAGE_A_B = 7;

export const LOTS = ['A', 'B'] as const;

const styleDuLot = (
  theme: Theme,
  rang: number,
  echelle: number,
  formater: (valeur: number) => string,
  decalage: number,
): StyleDIntervalle => ({ couleur: elementA(theme.series, rang), echelle, formater, decalage });

const legendeAB = (theme: Theme) => ({
  top: 0,
  left: 0,
  data: [...LOTS],
  textStyle: { color: theme.encreSecondaire },
  icon: 'roundRect',
});

export const infobulleDeComparaisonDesTaux =
  (categories: readonly ComparaisonDeCategorie[]) =>
  (params: Survol): string => {
    const rang = serieSurvolee(params);
    const frequences = categories.flatMap((c) => (rang === 0 ? c.a : c.b) ?? []);
    const total = frequences.reduce((somme, f) => somme + f.effectif, 0);
    const frequence = elementA(frequences, indexSurvole(params));
    return `${elementA(LOTS, rang)} · ${infobulleDeFrequence(frequence, total)}`;
  };

/** Taux de chaque catégorie dans A et dans B, chacun avec son intervalle, sur la même ligne. */
export function optionDeComparaisonDesTaux(
  categories: readonly ComparaisonDeCategorie[],
  theme: Theme,
): EChartsOption {
  const lignesDe = (rang: number) =>
    categories.flatMap((c, i) => {
      const f = rang === 0 ? c.a : c.b;
      return f === null ? [] : [[i, f.proportion, f.basse, f.haute]];
    });
  return {
    ...base(theme),
    grid: { ...GRILLE, right: 64, top: 32 },
    legend: legendeAB(theme),
    xAxis: {
      ...axeDeValeurs(theme),
      min: 0,
      max: 100,
      axisLabel: { color: theme.discret, formatter: '{value} %' },
    },
    yAxis: {
      ...axeDeCategories(
        theme,
        categories.map((c) => c.categorie),
      ),
      inverse: true,
    },
    tooltip: {
      ...infobulle(theme),
      trigger: 'item',
      formatter: infobulleDeComparaisonDesTaux(categories),
    },
    series: LOTS.map((nom, rang) => ({
      type: 'custom',
      name: nom,
      color: elementA(theme.series, rang),
      renderItem: dessinerUnIntervalle(
        styleDuLot(
          theme,
          rang,
          100,
          formaterPourcentage,
          rang === 0 ? -DECALAGE_A_B : DECALAGE_A_B,
        ),
        theme,
      ),
      encode: { x: [1, 2, 3], y: 0 },
      data: lignesDe(rang),
    })),
  };
}

export const infobulleDeComparaisonDesMoyennes =
  (resumes: readonly (Resume | null)[]) =>
  (params: Survol): string => {
    const rang = serieSurvolee(params);
    const r = elementA(resumes, rang);
    if (r === null) return elementA(LOTS, rang);
    const { basse, haute } = intervalleDeLaMoyenne(r);
    return (
      `<strong>${elementA(LOTS, rang)}</strong> : moyenne ${formaterNombre(r.moyenne)}<br>` +
      `IC 95 % : ${formaterNombre(basse)} – ${formaterNombre(haute)}<br>` +
      `sur ${String(r.n)} itérations`
    );
  };

/** Moyenne de A et de B, chacune avec son intervalle de confiance, sur deux lignes. */
export function optionDeComparaisonDesMoyennes(
  a: Resume | null,
  b: Resume | null,
  theme: Theme,
): EChartsOption {
  const resumes = [a, b];
  return {
    ...base(theme),
    grid: { ...GRILLE, right: 64, top: 8 },
    xAxis: { ...axeDeValeurs(theme), scale: true },
    yAxis: { ...axeDeCategories(theme, LOTS), inverse: true },
    tooltip: {
      ...infobulle(theme),
      trigger: 'item',
      formatter: infobulleDeComparaisonDesMoyennes(resumes),
    },
    series: resumes.map((r, rang) => {
      const intervalle = r === null ? null : intervalleDeLaMoyenne(r);
      return {
        type: 'custom',
        name: elementA(LOTS, rang),
        renderItem: dessinerUnIntervalle(styleDuLot(theme, rang, 1, formaterNombre, 0), theme),
        encode: { x: [1, 2, 3], y: 0 },
        data:
          r === null || intervalle === null
            ? []
            : [[rang, r.moyenne, intervalle.basse, intervalle.haute]],
      };
    }),
  };
}

/** Moyenne par tour de A et de B. */
export function optionDeComparaisonDesSeries(
  a: readonly PointDeSerie[],
  b: readonly PointDeSerie[],
  theme: Theme,
): EChartsOption {
  const longueur = Math.max(a.length, b.length);
  return {
    ...base(theme),
    grid: { ...GRILLE_AVEC_NOM_D_AXE, top: 32 },
    legend: legendeAB(theme),
    xAxis: {
      ...axeDeCategories(
        theme,
        Array.from({ length: longueur }, (_, i) => String(i)),
      ),
      ...nomDAxe(theme, 'tour'),
      boundaryGap: false,
    },
    yAxis: { ...axeDeValeurs(theme), scale: true },
    tooltip: { ...infobulle(theme), trigger: 'axis', valueFormatter: enNombre },
    series: [a, b].map((points, rang) => ({
      type: 'line',
      name: elementA(LOTS, rang),
      showSymbol: false,
      color: elementA(theme.series, rang),
      lineStyle: { width: 2 },
      data: points.map((p) => p.moyenne),
    })),
  };
}
