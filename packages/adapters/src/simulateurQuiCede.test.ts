import { lancerUnLot, type Simulateur } from '@batchtester/runner';
import {
  DEFINITION_DE_TEST,
  graine,
  resultatDeTest,
  verifierLeContratDuSimulateur,
} from '@batchtester/runner/testing';
import { describe, expect, it } from 'vitest';
import { ITERATIONS_ENTRE_DEUX_PAUSES, simulateurQuiCede } from './simulateurQuiCede.ts';

// Simulateur qui ne rend jamais la main de lui-même : uniquement des microtâches.
const synchrone = (): Simulateur => ({
  definition: DEFINITION_DE_TEST,
  simuler: (valeurs, g) => Promise.resolve(resultatDeTest(valeurs, g)),
});

verifierLeContratDuSimulateur('simulateur qui cède', () => simulateurQuiCede(synchrone()));

describe('simulateur qui cède', () => {
  it('laisse passer les événements en attente pendant un lot', async () => {
    const vus: number[] = [];
    let faites = 0;
    setImmediate(() => vus.push(faites));
    await lancerUnLot(
      simulateurQuiCede(synchrone(), 10),
      { surcharges: {}, graine: graine(1), iterations: 100 },
      { simultanees: 1, surProgression: (n) => (faites = n) },
    );
    // Le premier setImmediate passe à la première pause, après 9 itérations terminées.
    expect(vus).toEqual([9]);
  });

  it('sans pause, le même lot bloque les événements jusqu’à la fin', async () => {
    const vus: number[] = [];
    let faites = 0;
    setImmediate(() => vus.push(faites));
    await lancerUnLot(
      synchrone(),
      { surcharges: {}, graine: graine(1), iterations: 100 },
      { simultanees: 1, surProgression: (n) => (faites = n) },
    );
    expect(vus).toEqual([]);
  });

  it(`fait une pause toutes les ${String(ITERATIONS_ENTRE_DEUX_PAUSES)} itérations par défaut`, () => {
    expect(ITERATIONS_ENTRE_DEUX_PAUSES).toBe(20);
  });
});
