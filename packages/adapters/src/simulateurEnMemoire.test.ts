import { lireUnNombre, type Systeme } from '@batchtester/core';
import { lancerUnLot } from '@batchtester/runner';
import {
  DEFINITION_DE_TEST,
  graine,
  verifierLeContratDuSimulateur,
} from '@batchtester/runner/testing';
import { describe, expect, it } from 'vitest';
import { simulateurEnMemoire } from './simulateurEnMemoire.ts';

const PILE_OU_FACE: Systeme = {
  definition: DEFINITION_DE_TEST,
  simuler: (valeurs, aleatoire) => {
    const cumul: number[] = [];
    let piles = 0;
    for (let i = 0; i < lireUnNombre(valeurs, 'lancers'); i += 1) {
      if (aleatoire.chance(0.5)) piles += 1;
      cumul.push(piles);
    }
    return { piles, issue: aleatoire.choisir(['pile', 'face']), cumul };
  },
};

verifierLeContratDuSimulateur('système TypeScript en mémoire', () =>
  simulateurEnMemoire(PILE_OU_FACE),
);

describe('simulateur en mémoire', () => {
  it('expose la définition du système', () => {
    expect(simulateurEnMemoire(PILE_OU_FACE).definition).toBe(DEFINITION_DE_TEST);
  });

  it('donne à chaque itération un générateur neuf, tiré de sa seule graine', async () => {
    const simulateur = simulateurEnMemoire(PILE_OU_FACE);
    const seule = await simulateur.simuler({ lancers: 10 }, graine(9));
    await simulateur.simuler({ lancers: 10 }, graine(1));
    expect(await simulateur.simuler({ lancers: 10 }, graine(9))).toEqual(seule);
  });

  it("transforme l'exception du système en promesse rejetée, rapportée par le runner", async () => {
    const enPanne: Systeme = {
      definition: DEFINITION_DE_TEST,
      simuler: () => {
        throw new Error('règle manquante');
      },
    };
    await expect(simulateurEnMemoire(enPanne).simuler({ lancers: 1 }, graine(0))).rejects.toThrow(
      'règle manquante',
    );
    const lot = await lancerUnLot(simulateurEnMemoire(enPanne), {
      surcharges: {},
      graine: graine(0),
      iterations: 5,
    });
    expect(!lot.ok && lot.error).toMatchObject({
      kind: 'simulation-en-echec',
      message: 'règle manquante',
    });
  });
});
