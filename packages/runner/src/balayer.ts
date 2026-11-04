import {
  elementA,
  err,
  intervalleDeLaMoyenne,
  lireUneValeur,
  ok,
  type DefautDeValeur,
  type DefinitionDeSysteme,
  type Graine,
  type Result,
  type ValeurDeParametre,
} from '@batchtester/core';
import { lancerUnLot, type OptionsDeLot, type ProblemeDeLot } from './lancerUnLot.ts';
import type { Simulateur } from './ports.ts';
import { resumerLeLot, type ResumeDeLot } from './resumerLeLot.ts';

/** Au plus 20 × 20 points : au-delà, une grille ne se lit plus et coûte trop cher. */
export const POINTS_MAXIMAUX_PAR_BALAYAGE = 400;

export interface AxeDeBalayage {
  readonly parametre: string;
  readonly valeurs: readonly ValeurDeParametre[];
}

export interface DemandeDeBalayage {
  /** Réglages communs à tous les points ; les paramètres balayés sont remplacés point par point. */
  readonly surcharges: Readonly<Record<string, unknown>>;
  readonly graine: Graine;
  /** Itérations de chaque point. */
  readonly iterations: number;
  /** Un axe (courbe) ou deux (grille). */
  readonly axes: readonly AxeDeBalayage[];
}

export interface PointDeBalayage {
  /** Valeur de chaque axe, dans l'ordre des axes. */
  readonly valeurs: readonly ValeurDeParametre[];
  readonly resume: ResumeDeLot;
}

export interface Balayage {
  readonly definition: DefinitionDeSysteme;
  readonly axes: readonly AxeDeBalayage[];
  readonly graine: Graine;
  readonly iterations: number;
  /** Le premier axe varie le plus lentement : (x1, y1), (x1, y2)…, (x2, y1)… */
  readonly points: readonly PointDeBalayage[];
}

export type ProblemeDeBalayage =
  | { readonly kind: 'nombre-d-axes'; readonly axes: number }
  | { readonly kind: 'parametre-inconnu'; readonly parametre: string }
  | { readonly kind: 'parametre-en-double'; readonly parametre: string }
  | { readonly kind: 'axe-vide'; readonly parametre: string }
  | { readonly kind: 'trop-de-points'; readonly points: number }
  | {
      readonly kind: 'valeur-hors-definition';
      readonly parametre: string;
      readonly valeur: ValeurDeParametre;
      readonly raison: DefautDeValeur;
    }
  | {
      readonly kind: 'point-en-echec';
      readonly valeurs: readonly ValeurDeParametre[];
      readonly probleme: ProblemeDeLot;
    }
  | { readonly kind: 'balayage-annule' };

function verifierLesAxes(
  definition: DefinitionDeSysteme,
  axes: readonly AxeDeBalayage[],
): ProblemeDeBalayage | null {
  if (axes.length < 1 || axes.length > 2) return { kind: 'nombre-d-axes', axes: axes.length };
  const vus = new Set<string>();
  for (const { parametre, valeurs } of axes) {
    const def = definition.parametres.find((p) => p.nom === parametre);
    if (def === undefined) return { kind: 'parametre-inconnu', parametre };
    if (vus.has(parametre)) return { kind: 'parametre-en-double', parametre };
    vus.add(parametre);
    if (valeurs.length === 0) return { kind: 'axe-vide', parametre };
    for (const valeur of valeurs) {
      const lue = lireUneValeur(def, valeur);
      if (!lue.ok) return { kind: 'valeur-hors-definition', parametre, valeur, raison: lue.error };
    }
  }
  const points = axes.reduce((produit, axe) => produit * axe.valeurs.length, 1);
  return points > POINTS_MAXIMAUX_PAR_BALAYAGE ? { kind: 'trop-de-points', points } : null;
}

/** Toutes les combinaisons de valeurs, le premier axe variant le plus lentement. */
const combinaisons = (axes: readonly AxeDeBalayage[]): ValeurDeParametre[][] =>
  axes.reduce<ValeurDeParametre[][]>(
    (prefixes, axe) => prefixes.flatMap((prefixe) => axe.valeurs.map((v) => [...prefixe, v])),
    [[]],
  );

/**
 * Joue un lot par point du balayage. Tous les points rejouent la même graine : les écarts entre
 * deux points viennent des réglages, pas d'un tirage plus ou moins chanceux.
 */
export async function lancerUnBalayage(
  simulateur: Simulateur,
  demande: DemandeDeBalayage,
  options: OptionsDeLot = {},
): Promise<Result<Balayage, ProblemeDeBalayage>> {
  const { definition } = simulateur;
  const probleme = verifierLesAxes(definition, demande.axes);
  if (probleme !== null) return err(probleme);

  const aJouer = combinaisons(demande.axes);
  const total = aJouer.length * demande.iterations;
  const points: PointDeBalayage[] = [];
  for (const valeurs of aJouer) {
    const surcharges = {
      ...demande.surcharges,
      ...Object.fromEntries(demande.axes.map((axe, i) => [axe.parametre, elementA(valeurs, i)])),
    };
    const dejaFaites = points.length * demande.iterations;
    const lot = await lancerUnLot(
      simulateur,
      { surcharges, graine: demande.graine, iterations: demande.iterations },
      {
        ...options,
        surProgression: (faites) => options.surProgression?.(dejaFaites + faites, total),
      },
    );
    if (!lot.ok) {
      return err(
        lot.error.kind === 'lot-annule'
          ? { kind: 'balayage-annule' }
          : { kind: 'point-en-echec', valeurs, probleme: lot.error },
      );
    }
    points.push({ valeurs, resume: resumerLeLot(lot.value) });
  }
  return ok({
    definition,
    axes: demande.axes,
    graine: demande.graine,
    iterations: demande.iterations,
    points,
  });
}

// --- Indicateurs : ce qu'on lit d'un balayage, une valeur et son intervalle par point -------

export interface ValeurDIndicateur {
  readonly valeur: number;
  readonly basse: number;
  readonly haute: number;
}

export interface Indicateur {
  readonly id: string;
  readonly libelle: string;
  /** Taux entre 0 et 1, à afficher en pourcentage. */
  readonly taux: boolean;
  /** Une valeur par point, dans l'ordre des points ; null si le point n'en a pas. */
  readonly valeurs: readonly (ValeurDIndicateur | null)[];
}

/**
 * Pour chaque mesure : la moyenne d'un nombre, ou le taux de chaque catégorie, avec son
 * intervalle de confiance à 95 %. Les séries par tour ne se résument pas en une valeur.
 */
export function indicateursDuBalayage(balayage: Balayage): readonly Indicateur[] {
  return balayage.definition.mesures.flatMap((mesure, i): Indicateur[] => {
    const titre = mesure.libelle ?? mesure.nom;
    const mesuresDesPoints = balayage.points.map((p) => elementA(p.resume.mesures, i));
    switch (mesure.kind) {
      case 'nombre':
        return [
          {
            id: `${mesure.nom}:moyenne`,
            libelle: `${titre}${mesure.unite === undefined ? '' : ` (${mesure.unite})`} : moyenne`,
            taux: false,
            valeurs: mesuresDesPoints.map((m) =>
              m.kind === 'nombre' && m.resume !== null
                ? { valeur: m.resume.moyenne, ...intervalleDeLaMoyenne(m.resume) }
                : null,
            ),
          },
        ];
      case 'categorie':
        return mesure.categories.map((categorie) => ({
          id: `${mesure.nom}=${categorie}`,
          libelle: `${titre} : taux de « ${categorie} »`,
          taux: true,
          valeurs: mesuresDesPoints.map((m) => {
            // Chaque point suit la même définition : sa i-ème mesure est cette catégorie.
            const f =
              // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- || ramène aussi false (autre sorte de mesure) à null
              (m.kind === 'categorie' && m.frequences.find((x) => x.categorie === categorie)) ||
              null;
            return f === null ? null : { valeur: f.proportion, basse: f.basse, haute: f.haute };
          }),
        }));
      case 'serie':
        return [];
    }
  });
}
