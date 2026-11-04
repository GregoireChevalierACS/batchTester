import {
  ecartDeMoyennes,
  ecartDeProportions,
  type DefMesureCategorie,
  type DefMesureNombre,
  type DefMesureSerie,
  type Ecart,
  type Frequence,
  type PointDeSerie,
  type Resume,
  type ValeurDeParametre,
} from '@batchtester/core';
import type { ResumeDeLot, ResumeDeMesure } from './resumerLeLot.ts';

export interface ComparaisonDeParametre {
  readonly nom: string;
  readonly libelle?: string;
  /** undefined : le paramètre n'existe pas dans ce lot (autre version du système). */
  readonly a: ValeurDeParametre | undefined;
  readonly b: ValeurDeParametre | undefined;
  readonly different: boolean;
}

export interface ComparaisonDeCategorie {
  readonly categorie: string;
  readonly a: Frequence | null;
  readonly b: Frequence | null;
  readonly ecart: Ecart | null;
}

export type ComparaisonDeMesure =
  | {
      readonly kind: 'categorie';
      readonly mesure: DefMesureCategorie;
      readonly categories: readonly ComparaisonDeCategorie[];
    }
  | {
      readonly kind: 'nombre';
      readonly mesure: DefMesureNombre;
      readonly a: Resume | null;
      readonly b: Resume | null;
      readonly ecart: Ecart | null;
    }
  | {
      readonly kind: 'serie';
      readonly mesure: DefMesureSerie;
      readonly a: readonly PointDeSerie[];
      readonly b: readonly PointDeSerie[];
    };

export interface Comparaison {
  readonly a: ResumeDeLot;
  readonly b: ResumeDeLot;
  /** Deux versions différentes : les écarts mêlent l'effet des réglages et celui des règles. */
  readonly memeVersion: boolean;
  readonly parametres: readonly ComparaisonDeParametre[];
  /** Mesures présentes, avec la même sorte, dans les deux lots, dans l'ordre du lot a. */
  readonly mesures: readonly ComparaisonDeMesure[];
  /** Mesures d'un seul des deux lots, ou de sortes différentes : non comparées. */
  readonly sansEquivalent: readonly string[];
}

const unique = (noms: readonly string[]): string[] => [...new Set(noms)];

function comparerLesParametres(a: ResumeDeLot, b: ResumeDeLot): ComparaisonDeParametre[] {
  const definitions = [...a.definition.parametres, ...b.definition.parametres];
  return unique(definitions.map((p) => p.nom)).map((nom) => {
    const libelle = definitions.find((p) => p.nom === nom)?.libelle;
    const [va, vb] = [a.valeurs[nom], b.valeurs[nom]];
    return {
      nom,
      ...(libelle === undefined ? {} : { libelle }),
      a: va,
      b: vb,
      different: va !== vb,
    };
  });
}

type Resumes<K extends ResumeDeMesure['kind']> = [
  Extract<ResumeDeMesure, { kind: K }>,
  Extract<ResumeDeMesure, { kind: K }>,
];

function comparerDesCategories([a, b]: Resumes<'categorie'>): ComparaisonDeMesure {
  const trouver = (frequences: readonly Frequence[], categorie: string) =>
    frequences.find((f) => f.categorie === categorie) ?? null;
  const categories = unique([...a.mesure.categories, ...b.mesure.categories]).map((categorie) => {
    const fa = trouver(a.frequences, categorie);
    const fb = trouver(b.frequences, categorie);
    return { categorie, a: fa, b: fb, ecart: fa && fb && ecartDeProportions(fa, fb) };
  });
  return { kind: 'categorie', mesure: a.mesure, categories };
}

function comparerDesNombres([a, b]: Resumes<'nombre'>): ComparaisonDeMesure {
  const ecart = a.resume && b.resume && ecartDeMoyennes(a.resume, b.resume);
  return { kind: 'nombre', mesure: a.mesure, a: a.resume, b: b.resume, ecart };
}

function comparerUneMesure(a: ResumeDeMesure, b: ResumeDeMesure): ComparaisonDeMesure | null {
  if (a.kind === 'categorie' && b.kind === 'categorie') return comparerDesCategories([a, b]);
  if (a.kind === 'nombre' && b.kind === 'nombre') return comparerDesNombres([a, b]);
  if (a.kind === 'serie' && b.kind === 'serie') {
    return { kind: 'serie', mesure: a.mesure, a: a.points, b: b.points };
  }
  return null;
}

/** Ce qui sépare deux lots : réglages, puis chaque mesure avec l'écart b − a et son incertitude. */
export function comparerDeuxLots(a: ResumeDeLot, b: ResumeDeLot): Comparaison {
  const mesures: ComparaisonDeMesure[] = [];
  const comparees = new Set<string>();
  for (const mesureA of a.mesures) {
    const mesureB = b.mesures.find((m) => m.mesure.nom === mesureA.mesure.nom);
    const comparee = mesureB === undefined ? null : comparerUneMesure(mesureA, mesureB);
    if (comparee !== null) {
      mesures.push(comparee);
      comparees.add(mesureA.mesure.nom);
    }
  }
  const toutes = unique([...a.mesures, ...b.mesures].map((m) => m.mesure.nom));
  return {
    a,
    b,
    memeVersion:
      a.definition.nom === b.definition.nom && a.definition.version === b.definition.version,
    parametres: comparerLesParametres(a, b),
    mesures,
    sansEquivalent: toutes.filter((nom) => !comparees.has(nom)),
  };
}
