import type { Simulateur } from '@batchtester/runner';

export const ITERATIONS_ENTRE_DEUX_PAUSES = 20;

const pause = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

/**
 * Rend la main à la boucle d'événements toutes les `toutesLes` itérations. Sans cela, un système
 * synchrone n'enchaîne que des microtâches : le serveur ne peut ni envoyer la progression, ni
 * apprendre que le navigateur a annulé la demande, avant la fin du lot.
 */
export function simulateurQuiCede(
  simulateur: Simulateur,
  toutesLes = ITERATIONS_ENTRE_DEUX_PAUSES,
): Simulateur {
  let appels = 0;
  return {
    definition: simulateur.definition,
    simuler: async (valeurs, graine) => {
      appels += 1;
      if (appels % toutesLes === 0) await pause();
      return simulateur.simuler(valeurs, graine);
    },
  };
}
