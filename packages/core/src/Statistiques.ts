import { elementA } from './Indexation.ts';

export interface Resume {
  readonly n: number;
  readonly moyenne: number;
  /** Écart-type de l'échantillon (division par n - 1) ; 0 pour une seule valeur. */
  readonly ecartType: number;
  readonly min: number;
  readonly p5: number;
  readonly p25: number;
  readonly mediane: number;
  readonly p75: number;
  readonly p95: number;
  readonly max: number;
}

/**
 * Quantile q (de 0 à 1) d'une série triée, par interpolation linéaire entre les deux rangs
 * voisins : la méthode 7 de Hyndman et Fan, celle des tableurs et de NumPy.
 */
export function quantile(triees: readonly number[], q: number): number {
  const position = (triees.length - 1) * q;
  const rang = Math.floor(position);
  const bas = elementA(triees, rang);
  return bas + (elementA(triees, Math.ceil(position)) - bas) * (position - rang);
}

/** Résumé d'une série de valeurs, ou null si elle est vide. */
export function resumer(valeurs: readonly number[]): Resume | null {
  const n = valeurs.length;
  if (n === 0) return null;
  const triees = [...valeurs].sort((a, b) => a - b);
  const moyenne = valeurs.reduce((somme, v) => somme + v, 0) / n;
  const ecarts = valeurs.reduce((somme, v) => somme + (v - moyenne) ** 2, 0);
  return {
    n,
    moyenne,
    ecartType: n === 1 ? 0 : Math.sqrt(ecarts / (n - 1)),
    min: elementA(triees, 0),
    p5: quantile(triees, 0.05),
    p25: quantile(triees, 0.25),
    mediane: quantile(triees, 0.5),
    p75: quantile(triees, 0.75),
    p95: quantile(triees, 0.95),
    max: elementA(triees, n - 1),
  };
}

/** Intervalle [debut, fin[ ; la dernière classe inclut sa borne haute. */
export interface Classe {
  readonly debut: number;
  readonly fin: number;
  readonly effectif: number;
}

export interface Histogramme {
  /** Vrai quand chaque classe correspond à une seule valeur entière (durées en tours, scores…). */
  readonly discret: boolean;
  readonly classes: readonly Classe[];
}

/** Au-delà, des valeurs entières sont regroupées en classes comme des réels. */
export const CLASSES_DISCRETES_MAXIMALES = 40;

/** Règle de Sturges : assez de classes pour voir la forme, pas assez pour ne voir que du bruit. */
export const nombreDeClassesDeSturges = (n: number): number => Math.ceil(Math.log2(n)) + 1;

function compter(
  valeurs: readonly number[],
  min: number,
  largeur: number,
  nombre: number,
): number[] {
  const effectifs = Array.from({ length: nombre }, () => 0);
  for (const v of valeurs) {
    const i = Math.min(nombre - 1, Math.floor((v - min) / largeur));
    effectifs[i] = elementA(effectifs, i) + 1;
  }
  return effectifs;
}

export function histogramme(valeurs: readonly number[]): Histogramme {
  if (valeurs.length === 0) return { discret: false, classes: [] };
  // reduce plutôt que Math.min(...valeurs) : l'étalement dépasse la pile au-delà de ~100 000 valeurs.
  const min = valeurs.reduce((a, b) => Math.min(a, b));
  const max = valeurs.reduce((a, b) => Math.max(a, b));

  if (valeurs.every(Number.isInteger) && max - min < CLASSES_DISCRETES_MAXIMALES) {
    const effectifs = compter(valeurs, min, 1, max - min + 1);
    const classes = effectifs.map((effectif, i) => ({
      debut: min + i,
      fin: min + i + 1,
      effectif,
    }));
    return { discret: true, classes };
  }

  const nombre = nombreDeClassesDeSturges(valeurs.length);
  const largeur = (max - min) / nombre;
  // Valeurs toutes égales, ou si proches que la largeur s'arrondit à 0 : une seule classe.
  if (largeur === 0)
    return { discret: false, classes: [{ debut: min, fin: max, effectif: valeurs.length }] };
  const classes = compter(valeurs, min, largeur, nombre).map((effectif, i) => ({
    debut: min + i * largeur,
    // La dernière borne est max exactement, sans erreur d'arrondi cumulée.
    fin: i === nombre - 1 ? max : min + (i + 1) * largeur,
    effectif,
  }));
  return { discret: false, classes };
}

export interface Proportion {
  readonly proportion: number;
  /** Bornes de l'intervalle de confiance à 95 %. */
  readonly basse: number;
  readonly haute: number;
}

// Quantile 97,5 % de la loi normale : intervalle bilatéral à 95 %.
const Z_95 = 1.959963984540054;

/**
 * Proportion de succès et son intervalle de confiance à 95 % de Wilson. Contrairement à
 * l'intervalle « p ± 1,96 σ », il reste dans [0, 1] et reste juste quand p est proche de 0 ou 1,
 * ou quand l'échantillon est petit : exactement les cas d'un réglage déséquilibré.
 */
export function proportionDeWilson(succes: number, total: number): Proportion {
  if (
    !Number.isInteger(succes) ||
    !Number.isInteger(total) ||
    succes < 0 ||
    succes > total ||
    total === 0
  ) {
    throw new RangeError(
      `proportion de ${String(succes)} sur ${String(total)} : 0 ≤ succès ≤ total, total > 0`,
    );
  }
  const p = succes / total;
  const z2 = Z_95 ** 2;
  const denominateur = 1 + z2 / total;
  const centre = (p + z2 / (2 * total)) / denominateur;
  const demiLargeur =
    (Z_95 * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total ** 2))) / denominateur;
  // Les arrondis peuvent placer une borne une fraction au-delà de p (en 0 et en 1) : on la ramène
  // pour que l'intervalle contienne toujours la proportion observée et reste dans [0, 1].
  return {
    proportion: p,
    basse: Math.min(p, Math.max(0, centre - demiLargeur)),
    haute: Math.max(p, Math.min(1, centre + demiLargeur)),
  };
}

export interface Frequence extends Proportion {
  readonly categorie: string;
  readonly effectif: number;
}

/** Fréquence de chaque catégorie, dans l'ordre donné, y compris celles jamais observées. */
export function frequences(
  valeurs: readonly string[],
  categories: readonly string[],
): readonly Frequence[] {
  if (valeurs.length === 0) return [];
  return categories.map((categorie) => {
    const effectif = valeurs.filter((v) => v === categorie).length;
    return { categorie, effectif, ...proportionDeWilson(effectif, valeurs.length) };
  });
}

export interface PointDeSerie {
  readonly indice: number;
  /** Nombre d'itérations encore en cours à cet indice : les séries n'ont pas toutes la même longueur. */
  readonly n: number;
  readonly moyenne: number;
  readonly min: number;
  readonly max: number;
}

/** Moyenne, minimum et maximum de plusieurs séries, indice par indice (tour par tour). */
export function agregerLesSeries(series: readonly (readonly number[])[]): readonly PointDeSerie[] {
  const longueur = series.reduce((plusLongue, serie) => Math.max(plusLongue, serie.length), 0);
  return Array.from({ length: longueur }, (_, indice) => {
    const valeurs = series
      .filter((serie) => serie.length > indice)
      .map((serie) => elementA(serie, indice));
    return {
      indice,
      n: valeurs.length,
      moyenne: valeurs.reduce((somme, v) => somme + v, 0) / valeurs.length,
      min: valeurs.reduce((a, b) => Math.min(a, b)),
      max: valeurs.reduce((a, b) => Math.max(a, b)),
    };
  });
}
