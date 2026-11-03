import {
  deriverLaGraine,
  err,
  ok,
  resoudreLesValeurs,
  verifierLaDefinition,
  verifierLeResultat,
  type DefautDeDefinition,
  type DefinitionDeSysteme,
  type ErreurDeResultat,
  type ErreurDeValeur,
  type Graine,
  type Result,
  type Resultat,
  type Valeurs,
} from '@batchtester/core';
import type { Simulateur } from './ports.ts';

/** Au-delà, un lot doit être découpé : tout le lot est gardé en mémoire pour les statistiques. */
export const ITERATIONS_MAXIMALES = 100_000;

export const SIMULTANEES_PAR_DEFAUT = 8;

export interface DemandeDeLot {
  /** Valeurs qui remplacent celles par défaut ; les autres paramètres gardent leur défaut. */
  readonly surcharges: Readonly<Record<string, unknown>>;
  readonly graine: Graine;
  readonly iterations: number;
}

export interface OptionsDeLot {
  /**
   * Itérations en cours en même temps. Utile quand le simulateur attend (worker, processus
   * externe) ; un système synchrone dans ce processus s'exécute de toute façon une itération à
   * la fois.
   */
  readonly simultanees?: number;
  readonly surProgression?: (faites: number, total: number) => void;
  /** Interrompt le lot : plus aucune itération n'est entamée, et le lot rapporte son annulation. */
  readonly signal?: AbortSignal;
}

export interface Iteration {
  readonly index: number;
  /** De quoi rejouer cette itération seule, avec les mêmes valeurs. */
  readonly graine: Graine;
  readonly resultat: Resultat;
}

export interface Lot {
  readonly definition: DefinitionDeSysteme;
  readonly valeurs: Valeurs;
  readonly graine: Graine;
  /** Dans l'ordre des index, quel que soit l'ordre dans lequel elles se sont terminées. */
  readonly iterations: readonly Iteration[];
}

export type EchecDIteration =
  | {
      readonly kind: 'simulation-en-echec';
      readonly index: number;
      readonly graine: Graine;
      readonly message: string;
    }
  | {
      readonly kind: 'resultat-invalide';
      readonly index: number;
      readonly graine: Graine;
      readonly erreurs: readonly ErreurDeResultat[];
    };

export type ProblemeDeLot =
  | { readonly kind: 'definition-invalide'; readonly defauts: readonly DefautDeDefinition[] }
  | { readonly kind: 'iterations-invalides'; readonly iterations: number }
  | { readonly kind: 'simultanees-invalides'; readonly simultanees: number }
  | { readonly kind: 'valeurs-invalides'; readonly erreurs: readonly ErreurDeValeur[] }
  | { readonly kind: 'lot-annule' }
  | EchecDIteration;

async function jouer(
  simulateur: Simulateur,
  valeurs: Valeurs,
  maitre: Graine,
  index: number,
): Promise<Result<Iteration, EchecDIteration>> {
  const graine = deriverLaGraine(maitre, index);
  let brut: unknown;
  try {
    brut = await simulateur.simuler(valeurs, graine);
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    return err({ kind: 'simulation-en-echec', index, graine, message });
  }
  const resultat = verifierLeResultat(simulateur.definition.mesures, brut);
  return resultat.ok
    ? ok({ index, graine, resultat: resultat.value })
    : err({ kind: 'resultat-invalide', index, graine, erreurs: resultat.error });
}

/**
 * Joue `iterations` fois le système avec les mêmes valeurs ; l'itération i reçoit une graine
 * dérivée de la graine maître et de i. Le lot s'arrête au premier échec.
 */
export async function lancerUnLot(
  simulateur: Simulateur,
  demande: DemandeDeLot,
  options: OptionsDeLot = {},
): Promise<Result<Lot, ProblemeDeLot>> {
  const { definition } = simulateur;
  const defauts = verifierLaDefinition(definition);
  if (defauts.length > 0) return err({ kind: 'definition-invalide', defauts });

  const total = demande.iterations;
  if (!Number.isInteger(total) || total < 1 || total > ITERATIONS_MAXIMALES) {
    return err({ kind: 'iterations-invalides', iterations: total });
  }
  const simultanees = options.simultanees ?? SIMULTANEES_PAR_DEFAUT;
  if (!Number.isInteger(simultanees) || simultanees < 1) {
    return err({ kind: 'simultanees-invalides', simultanees });
  }
  const valeurs = resoudreLesValeurs(definition.parametres, demande.surcharges);
  if (!valeurs.ok) return err({ kind: 'valeurs-invalides', erreurs: valeurs.error });

  const iterations: Iteration[] = [];
  let suivante = 0;
  let faites = 0;
  let arreter = false;

  const ouvrier = async (): Promise<EchecDIteration | null> => {
    while (!arreter && options.signal?.aborted !== true && suivante < total) {
      const index = suivante;
      suivante += 1;
      const issue = await jouer(simulateur, valeurs.value, demande.graine, index);
      if (!issue.ok) {
        arreter = true;
        return issue.error;
      }
      iterations[index] = issue.value;
      faites += 1;
      options.surProgression?.(faites, total);
    }
    return null;
  };

  const issues = await Promise.all(Array.from({ length: Math.min(simultanees, total) }, ouvrier));
  // Un lot interrompu est incomplet : ses statistiques ne veulent rien dire, même sans échec.
  if (options.signal?.aborted === true) return err({ kind: 'lot-annule' });
  // Les itérations déjà lancées se terminent toutes : parmi leurs échecs, on rapporte celui de
  // plus petit index, pour qu'un même lot rapporte toujours le même échec.
  const [premierEchec] = issues.filter((issue) => issue !== null).sort((a, b) => a.index - b.index);
  if (premierEchec !== undefined) return err(premierEchec);
  return ok({ definition, valeurs: valeurs.value, graine: demande.graine, iterations });
}
