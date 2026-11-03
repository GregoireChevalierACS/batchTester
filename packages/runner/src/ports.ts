import type { DefinitionDeSysteme, Graine, Valeurs } from '@batchtester/core';

/**
 * Ce qui exécute une itération d'un système, où qu'il tourne : dans ce processus, dans un worker
 * ou dans un programme externe. Le résultat est `unknown` : le runner le vérifie contre la
 * définition avant de l'utiliser.
 */
export interface Simulateur {
  readonly definition: DefinitionDeSysteme;
  simuler(valeurs: Valeurs, graine: Graine): Promise<unknown>;
}
