import type { AxeDeBalayage, Balayage } from './balayer.ts';
import type { ResumeDeLot } from './resumerLeLot.ts';

/**
 * Ce qu'un lot lancé à distance renvoie au fil de l'eau : des progressions, puis soit le résumé,
 * soit le problème qui l'a arrêté. Le serveur les écrit une par ligne (NDJSON), l'interface les
 * lit dans le même ordre (ADR 0002).
 */
export type EvenementDeLot =
  | { readonly type: 'progression'; readonly faites: number; readonly total: number }
  | { readonly type: 'resume'; readonly resume: ResumeDeLot }
  | { readonly type: 'probleme'; readonly message: string };

/** Demande de lot envoyée par l'interface : les surcharges sont typées, pas du texte. */
export interface DemandeDeLotADistance {
  readonly systeme: string;
  readonly graine: number;
  readonly iterations: number;
  readonly surcharges: Readonly<Record<string, unknown>>;
}

/** Ce qu'un balayage lancé à distance renvoie : des progressions, puis le balayage ou le problème. */
export type EvenementDeBalayage =
  | { readonly type: 'progression'; readonly faites: number; readonly total: number }
  | { readonly type: 'balayage'; readonly balayage: Balayage }
  | { readonly type: 'probleme'; readonly message: string };

export interface DemandeDeBalayageADistance extends DemandeDeLotADistance {
  readonly axes: readonly AxeDeBalayage[];
}
