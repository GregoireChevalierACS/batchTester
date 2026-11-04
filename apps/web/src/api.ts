import type { DefinitionDeSysteme } from '@batchtester/core';
import type {
  ApercuDeLancement,
  DemandeDeBalayageADistance,
  DemandeDeLotADistance,
  EvenementDeBalayage,
  EvenementDeLot,
  Lancement,
} from '@batchtester/runner';

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
  /** Lance un balayage ; même déroulement qu'un lot, avec le balayage complet à la fin. */
  balayer(
    demande: DemandeDeBalayageADistance,
    ecouter: (evenement: EvenementDeBalayage) => void,
    signal: AbortSignal,
  ): Promise<void>;
  lancements(): Promise<readonly ApercuDeLancement[]>;
  lancement(id: number): Promise<Lancement>;
  /** Le serveur rejoue le lot avec ces réglages et l'enregistre ; un nom vide est remplacé. */
  enregistrer(demande: DemandeDeLotADistance, nom: string): Promise<ApercuDeLancement>;
  supprimer(id: number): Promise<void>;
}

export const MESSAGE_SERVEUR_INJOIGNABLE =
  'Le serveur ne répond pas. Est-il lancé (pnpm serveur ou pnpm studio) ?';

// Le serveur est celui du dépôt : on vérifie la forme générale, pas chaque champ.
const aUnTypeParmi = (valeur: unknown, types: readonly string[]): boolean =>
  typeof valeur === 'object' &&
  valeur !== null &&
  'type' in valeur &&
  types.includes(String(valeur.type));

const estUnEvenementDeLot = (valeur: unknown): valeur is EvenementDeLot =>
  aUnTypeParmi(valeur, ['progression', 'resume', 'probleme']);

const estUnEvenementDeBalayage = (valeur: unknown): valeur is EvenementDeBalayage =>
  aUnTypeParmi(valeur, ['progression', 'balayage', 'probleme']);

function estUneListeDeSystemes(valeur: unknown): valeur is SystemeDisponible[] {
  return (
    Array.isArray(valeur) && valeur.every((s: unknown) => estUnObjetAvec(s, 'id', 'definition'))
  );
}

const estUnObjetAvec = (valeur: unknown, ...champs: string[]): valeur is object =>
  typeof valeur === 'object' && valeur !== null && champs.every((champ) => champ in valeur);

function estUneListeDApercus(valeur: unknown): valeur is ApercuDeLancement[] {
  return Array.isArray(valeur) && valeur.every((l: unknown) => estUnObjetAvec(l, 'id', 'nom'));
}

const estUnLancement = (valeur: unknown): valeur is Lancement =>
  estUnObjetAvec(valeur, 'id', 'nom', 'resume');

const estUnApercu = (valeur: unknown): valeur is ApercuDeLancement =>
  estUnObjetAvec(valeur, 'id', 'nom');

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
  /** Demande du JSON au serveur : une erreur HTTP devient une exception avec son message. */
  async function demander<T>(
    adresse: string,
    estValide: (valeur: unknown) => valeur is T,
    init?: RequestInit,
  ): Promise<T> {
    const reponse = await chercher(adresse, init);
    if (!reponse.ok) throw new Error(await messageDErreur(reponse));
    const corps: unknown = await reponse.json();
    if (!estValide(corps)) throw new Error(`Réponse illisible pour ${adresse}.`);
    return corps;
  }

  /**
   * Envoie une demande et transmet chaque événement du flux NDJSON de la réponse. Une erreur HTTP
   * ou réseau devient un événement « probleme » ; un abandon voulu ne transmet rien.
   */
  async function diffuser<E>(
    adresse: string,
    demande: unknown,
    estUnEvenement: (valeur: unknown) => valeur is E,
    ecouter: (evenement: E | { type: 'probleme'; message: string }) => void,
    signal: AbortSignal,
  ): Promise<void> {
    try {
      const reponse = await chercher(adresse, {
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
      // Abandon voulu (un réglage a changé, ou annulation) : plus personne n'attend ce calcul.
      if (signal.aborted) return;
      ecouter({
        type: 'probleme',
        message: erreur instanceof TypeError ? MESSAGE_SERVEUR_INJOIGNABLE : String(erreur),
      });
    }
  }

  return {
    systemes: () => demander('/api/systemes', estUneListeDeSystemes),
    lancements: () => demander('/api/lancements', estUneListeDApercus),
    lancement: (id) => demander(`/api/lancements/${String(id)}`, estUnLancement),
    enregistrer: (demande, nom) =>
      demander('/api/lancements', estUnApercu, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...demande, nom }),
      }),
    async supprimer(id) {
      const reponse = await chercher(`/api/lancements/${String(id)}`, { method: 'DELETE' });
      if (!reponse.ok) throw new Error(await messageDErreur(reponse));
    },

    lancer: (demande, ecouter, signal) =>
      diffuser('/api/lots', demande, estUnEvenementDeLot, ecouter, signal),
    balayer: (demande, ecouter, signal) =>
      diffuser('/api/balayages', demande, estUnEvenementDeBalayage, ecouter, signal),
  };
}
