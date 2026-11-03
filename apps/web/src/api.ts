import type { DefinitionDeSysteme } from '@batchtester/core';
import type { DemandeDeLotADistance, EvenementDeLot } from '@batchtester/runner';

export interface SystemeDisponible {
  readonly id: string;
  readonly definition: DefinitionDeSysteme;
}

/** Tout ce que l'interface demande au serveur. Les tests la remplacent par une doublure. */
export interface Api {
  systemes(): Promise<readonly SystemeDisponible[]>;
  /** Lance un lot et transmet chaque événement ; abandonné dès que `signal` est levé. */
  lancer(
    demande: DemandeDeLotADistance,
    ecouter: (evenement: EvenementDeLot) => void,
    signal: AbortSignal,
  ): Promise<void>;
}

export const MESSAGE_SERVEUR_INJOIGNABLE =
  'Le serveur ne répond pas. Est-il lancé (pnpm serveur ou pnpm studio) ?';

const TYPES_D_EVENEMENT = new Set(['progression', 'resume', 'probleme']);

// Le serveur est celui du dépôt : on vérifie la forme générale, pas chaque champ.
function estUnEvenement(valeur: unknown): valeur is EvenementDeLot {
  return (
    typeof valeur === 'object' &&
    valeur !== null &&
    'type' in valeur &&
    TYPES_D_EVENEMENT.has(String(valeur.type))
  );
}

function estUneListeDeSystemes(valeur: unknown): valeur is SystemeDisponible[] {
  return (
    Array.isArray(valeur) &&
    valeur.every(
      (s: unknown) => typeof s === 'object' && s !== null && 'id' in s && 'definition' in s,
    )
  );
}

async function messageDErreur(reponse: Response): Promise<string> {
  const corps: unknown = await reponse.json().catch(() => null);
  return typeof corps === 'object' && corps !== null && 'message' in corps
    ? String(corps.message)
    : `Le serveur a répondu ${String(reponse.status)}.`;
}

/** Découpe un flux d'octets en lignes JSON, même quand une ligne arrive en plusieurs morceaux. */
export async function lireLesLignes(
  flux: ReadableStream<Uint8Array>,
  surLigne: (valeur: unknown) => void,
): Promise<void> {
  const decodeur = new TextDecoder();
  let reste = '';
  for await (const morceau of flux) {
    const lignes = (reste + decodeur.decode(morceau, { stream: true })).split('\n');
    // Le dernier morceau n'est peut-être qu'un début de ligne : il attend la suite.
    reste = lignes.splice(-1).join('');
    for (const ligne of lignes) if (ligne.trim() !== '') surLigne(JSON.parse(ligne));
  }
  if (reste.trim() !== '') surLigne(JSON.parse(reste));
}

export function creerLApi(chercher: typeof fetch = fetch): Api {
  return {
    async systemes() {
      const reponse = await chercher('/api/systemes');
      if (!reponse.ok) throw new Error(await messageDErreur(reponse));
      const corps: unknown = await reponse.json();
      if (!estUneListeDeSystemes(corps)) throw new Error('Liste des systèmes illisible.');
      return corps;
    },

    async lancer(demande, ecouter, signal) {
      try {
        const reponse = await chercher('/api/lots', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(demande),
          signal,
        });
        if (!reponse.ok || reponse.body === null) {
          ecouter({ type: 'probleme', message: await messageDErreur(reponse) });
          return;
        }
        await lireLesLignes(reponse.body, (valeur) => {
          if (estUnEvenement(valeur)) ecouter(valeur);
        });
      } catch (erreur) {
        // Abandon voulu (un réglage a changé) : ce lot n'intéresse plus personne.
        if (signal.aborted) return;
        ecouter({
          type: 'probleme',
          message: erreur instanceof TypeError ? MESSAGE_SERVEUR_INJOIGNABLE : String(erreur),
        });
      }
    },
  };
}
