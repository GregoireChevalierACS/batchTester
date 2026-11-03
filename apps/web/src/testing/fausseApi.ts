import { creerAleatoire, creerGraine, type Systeme } from '@batchtester/core';
import {
  lancerUnLot,
  resumerLeLot,
  type DemandeDeLotADistance,
  type EvenementDeLot,
} from '@batchtester/runner';
import combat from '../../../../systemes/combat/src/index.ts';
import type { Api, SystemeDisponible } from '../api.ts';

export const COMBAT: SystemeDisponible = { id: 'combat', definition: combat.definition };

export const PILE_OU_FACE: SystemeDisponible = {
  id: 'pile',
  definition: {
    nom: 'Pile ou face',
    version: '2.0.0',
    parametres: [
      { kind: 'nombre', nom: 'biais', min: 0, max: 1, pas: 0.1, defaut: 0.5 },
      { kind: 'booleen', nom: 'truque', libelle: 'Pièce truquée', defaut: false },
    ],
    mesures: [{ kind: 'categorie', nom: 'issue', categories: ['pile', 'face'] }],
  },
};

const pileOuFace: Systeme = {
  definition: PILE_OU_FACE.definition,
  simuler: (valeurs, aleatoire) => ({
    issue:
      valeurs['truque'] === true || aleatoire.chance(Number(valeurs['biais'])) ? 'pile' : 'face',
  }),
};

type Scenario = (
  demande: DemandeDeLotADistance,
  ecouter: (evenement: EvenementDeLot) => void,
  signal: AbortSignal,
) => Promise<void>;

/** Joue réellement le lot avec le runner, comme le ferait le serveur. */
export const scenarioReel: Scenario = async (demande, ecouter, signal) => {
  const systeme = demande.systeme === 'pile' ? pileOuFace : combat;
  const graine = creerGraine(demande.graine);
  if (!graine.ok) throw new Error('graine invalide');
  const lot = await lancerUnLot(
    {
      definition: systeme.definition,
      simuler: (valeurs, g) => Promise.resolve(systeme.simuler(valeurs, creerAleatoire(g))),
    },
    { surcharges: demande.surcharges, graine: graine.value, iterations: demande.iterations },
    {
      signal,
      surProgression: (faites, total) => {
        ecouter({ type: 'progression', faites, total });
      },
    },
  );
  if (lot.ok) ecouter({ type: 'resume', resume: resumerLeLot(lot.value) });
  else ecouter({ type: 'probleme', message: lot.error.kind });
};

export class FausseApi implements Api {
  readonly demandes: { demande: DemandeDeLotADistance; signal: AbortSignal }[] = [];
  liste: Promise<readonly SystemeDisponible[]> = Promise.resolve([COMBAT, PILE_OU_FACE]);
  scenario: Scenario = scenarioReel;

  systemes() {
    return this.liste;
  }

  lancer(
    demande: DemandeDeLotADistance,
    ecouter: (e: EvenementDeLot) => void,
    signal: AbortSignal,
  ) {
    this.demandes.push({ demande, signal });
    return this.scenario(demande, ecouter, signal);
  }

  get derniere(): DemandeDeLotADistance | undefined {
    return this.demandes.at(-1)?.demande;
  }
}
