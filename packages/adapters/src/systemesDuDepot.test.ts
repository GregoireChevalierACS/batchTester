import { fileURLToPath } from 'node:url';
import { verifierLeContratDuSimulateur } from '@batchtester/runner/testing';
import { afterAll, describe, expect, it } from 'vitest';
import { decouvrirLesSystemes } from './decouvrirLesSystemes.ts';
import { expliquerUnProblemeDOuverture } from './ouvrirUnSysteme.ts';

// Chaque système du dossier systemes/, quel que soit son langage, passe la suite de contrat :
// un système ajouté au dépôt y est soumis sans rien écrire de plus.
const SYSTEMES_DU_DEPOT = fileURLToPath(new URL('../../../systemes', import.meta.url));
const { systemes, problemes } = await decouvrirLesSystemes(SYSTEMES_DU_DEPOT);

afterAll(async () => {
  await Promise.all(systemes.map((s) => s.fermer()));
});

describe('systèmes du dépôt', () => {
  it('démarrent tous', () => {
    expect(problemes.map(expliquerUnProblemeDOuverture)).toEqual([]);
    expect(systemes.map((s) => s.id)).toEqual(['cartes', 'combat', 'des']);
  });
});

for (const systeme of systemes) {
  verifierLeContratDuSimulateur(`système du dépôt « ${systeme.id} »`, () => systeme.simulateur);
}
