import { simulateurEnMemoire } from '@batchtester/adapters';
import { creerAleatoire, resoudreLesValeurs } from '@batchtester/core';
import { lancerUnLot, resumerLeLot } from '@batchtester/runner';
import { graine, verifierLeContratDuSimulateur } from '@batchtester/runner/testing';
import { describe, expect, it } from 'vitest';
import { combat } from './combat.ts';

verifierLeContratDuSimulateur('combat 1 contre 1', () => simulateurEnMemoire(combat));

function jouer(surcharges: Record<string, unknown>, n = 1) {
  const valeurs = resoudreLesValeurs(combat.definition.parametres, surcharges);
  if (!valeurs.ok) throw new Error(JSON.stringify(valeurs.error));
  return combat.simuler(valeurs.value, creerAleatoire(graine(n)));
}

const INFAILLIBLE = { precisionA: 1, precisionB: 1, critiqueA: 0, critiqueB: 0 };

describe('combat 1 contre 1', () => {
  it('finit sur un nul quand personne ne touche', () => {
    expect(jouer({ precisionA: 0, precisionB: 0, toursMax: 3 })).toEqual({
      vainqueur: 'nul',
      tours: 3,
      ecart: -20,
      pvA: [100, 100, 100, 100],
      pvB: [120, 120, 120, 120],
    });
  });

  it('arrête le combat dès que le défenseur tombe, sans riposte', () => {
    const resultat = jouer({ ...INFAILLIBLE, initiative: 'A', degatsA: 200, pvB: 50 });
    expect(resultat).toEqual({
      vainqueur: 'A',
      tours: 1,
      ecart: 100,
      pvA: [100, 100],
      pvB: [50, 0],
    });
  });

  it("laisse frapper B en premier quand il a l'initiative", () => {
    const resultat = jouer({ ...INFAILLIBLE, initiative: 'B', degatsB: 200, degatsA: 200 });
    expect(resultat).toMatchObject({ vainqueur: 'B', tours: 1, pvA: [100, 0], pvB: [120, 120] });
  });

  it('tire au sort le premier à frapper avec une initiative aléatoire', () => {
    const premiers = new Set(
      Array.from({ length: 50 }, (_, n) => {
        const r = jouer({ ...INFAILLIBLE, initiative: 'aleatoire', degatsA: 200, degatsB: 200 }, n);
        return r.vainqueur;
      }),
    );
    expect(premiers).toEqual(new Set(['A', 'B']));
  });

  it('inflige les dégâts de base à ± 20 %', () => {
    const pertes = new Set<number>();
    for (let n = 0; n < 200; n += 1) {
      const { pvB } = jouer({ ...INFAILLIBLE, initiative: 'A', degatsA: 10, toursMax: 1 }, n);
      pertes.add(120 - (pvB.at(-1) ?? 0));
    }
    expect([...pertes].sort((a, b) => a - b)).toEqual([8, 9, 10, 11, 12]);
  });

  it('double les dégâts sur un coup critique', () => {
    const { pvB } = jouer({
      ...INFAILLIBLE,
      critiqueA: 1,
      initiative: 'A',
      degatsA: 10,
      toursMax: 1,
    });
    const perte = 120 - (pvB.at(-1) ?? 0);
    expect(perte % 2).toBe(0);
    expect(perte).toBeGreaterThanOrEqual(16);
    expect(perte).toBeLessThanOrEqual(24);
  });

  it('garde les PV de chaque tour, du départ à la fin', () => {
    const { tours, pvA, pvB } = jouer({}, 7);
    expect(pvA).toHaveLength(tours + 1);
    expect(pvB).toHaveLength(tours + 1);
    expect([pvA[0], pvB[0]]).toEqual([100, 120]);
  });

  it('est équilibré entre deux combattants identiques', async () => {
    const identiques = {
      pvB: 100,
      degatsB: 12,
      precisionB: 0.8,
      critiqueB: 0.1,
      initiative: 'aleatoire',
    };
    const lot = await lancerUnLot(simulateurEnMemoire(combat), {
      surcharges: identiques,
      graine: graine(2026),
      iterations: 2000,
    });
    if (!lot.ok) throw new Error(lot.error.kind);
    const [vainqueur] = resumerLeLot(lot.value).mesures;
    const victoiresDeA = vainqueur?.kind === 'categorie' ? vainqueur.frequences[0] : undefined;
    expect(victoiresDeA?.basse).toBeLessThan(0.5);
    expect(victoiresDeA?.haute).toBeGreaterThan(0.5);
  });
});
