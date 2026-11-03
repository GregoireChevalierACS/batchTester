import { creerAleatoire, type Systeme } from '@batchtester/core';
import type { Simulateur } from '@batchtester/runner';

/**
 * Exécute un système TypeScript dans ce processus. Chaque itération reçoit un générateur neuf,
 * créé à partir de sa graine : aucune itération ne dépend de celles jouées avant elle.
 */
export function simulateurEnMemoire(systeme: Systeme): Simulateur {
  return {
    definition: systeme.definition,
    // Dans un then : une exception du système devient une promesse rejetée, que le runner
    // rapporte avec l'index et la graine de l'itération.
    simuler: (valeurs, graine) =>
      Promise.resolve().then(() => systeme.simuler(valeurs, creerAleatoire(graine))),
  };
}
