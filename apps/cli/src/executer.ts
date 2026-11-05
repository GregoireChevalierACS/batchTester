import { ouvrirUnSysteme } from '@batchtester/adapters';
import { lancerUnLot, resumerLeLot } from '@batchtester/runner';
import { AIDE, lireLesArguments } from './arguments.ts';
import { interpreterLesParametres } from './interpreterLesParametres.ts';
import { expliquer } from './messages.ts';
import { formaterLeRapport } from './rapport.ts';

export interface Sorties {
  readonly ecrire: (texte: string) => void;
  readonly ecrireErreur: (texte: string) => void;
}

export const SORTIE_OK = 0;
export const SORTIE_ECHEC = 1;
export const SORTIE_USAGE = 2;

/**
 * La ligne de commande entière, sans process : arguments et répertoire en entrée, textes écrits
 * et code de sortie en retour. main.ts ne fait que la brancher sur le vrai processus.
 */
export async function executer(
  argv: readonly string[],
  repertoire: string,
  sorties: Sorties,
): Promise<number> {
  const commande = lireLesArguments(argv);
  if (!commande.ok) {
    sorties.ecrireErreur(`${expliquer(commande.error)}\n\n${AIDE}`);
    return SORTIE_USAGE;
  }
  if (commande.value.kind === 'aide') {
    sorties.ecrire(AIDE);
    return SORTIE_OK;
  }

  const { chemin, iterations, graine, parametres, simultanees, json } = commande.value;
  const systeme = await ouvrirUnSysteme(chemin, repertoire);
  if (!systeme.ok) {
    sorties.ecrireErreur(`${expliquer(systeme.error)}\n`);
    return SORTIE_ECHEC;
  }

  const surcharges = interpreterLesParametres(systeme.value.definition.parametres, parametres);
  const lot = await lancerUnLot(
    systeme.value.simulateur,
    { surcharges, graine, iterations },
    simultanees === null ? {} : { simultanees },
  );
  // Un système externe est un programme lancé pour ce lot : il s'arrête avec lui.
  await systeme.value.fermer();
  if (!lot.ok) {
    sorties.ecrireErreur(`${expliquer(lot.error)}\n`);
    return SORTIE_ECHEC;
  }

  const resume = resumerLeLot(lot.value);
  sorties.ecrire(json ? `${JSON.stringify(resume, null, 2)}\n` : formaterLeRapport(resume));
  return SORTIE_OK;
}
