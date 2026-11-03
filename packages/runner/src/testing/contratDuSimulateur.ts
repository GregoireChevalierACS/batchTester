import {
  creerGraine,
  valeursParDefaut,
  verifierLaDefinition,
  type Graine,
} from '@batchtester/core';
import { describe, expect, it } from 'vitest';
import { lancerUnLot } from '../lancerUnLot.ts';
import type { Simulateur } from '../ports.ts';

const graine = (n: number): Graine => {
  const creee = creerGraine(n);
  if (!creee.ok) throw new Error(`graine invalide : ${String(n)}`);
  return creee.value;
};

/**
 * Ce que tout simulateur doit garantir, quel que soit l'endroit où tourne le système. Chaque
 * adapter rejoue cette suite : un nouvel adapter n'est branché que s'il la passe.
 */
export function verifierLeContratDuSimulateur(
  nom: string,
  fabriquer: () => Simulateur | Promise<Simulateur>,
): void {
  describe(`contrat du simulateur : ${nom}`, () => {
    it('a une définition valide', async () => {
      const simulateur = await fabriquer();
      expect(verifierLaDefinition(simulateur.definition)).toEqual([]);
    });

    it('rejoue exactement le même résultat avec la même graine et les mêmes valeurs', async () => {
      const simulateur = await fabriquer();
      const valeurs = valeursParDefaut(simulateur.definition.parametres);
      for (let n = 0; n < 10; n += 1) {
        const premier = await simulateur.simuler(valeurs, graine(n));
        const second = await simulateur.simuler(valeurs, graine(n));
        expect(second).toEqual(premier);
      }
    });

    it('renvoie des résultats conformes à sa définition', async () => {
      const simulateur = await fabriquer();
      const lot = await lancerUnLot(simulateur, {
        surcharges: {},
        graine: graine(2026),
        iterations: 50,
      });
      expect(lot.ok ? 'conforme' : lot.error).toBe('conforme');
    });
  });
}
