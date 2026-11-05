import { systemeTypeScript } from '@batchtester/adapters';
import { creerAleatoire, resoudreLesValeurs } from '@batchtester/core';
import { lancerUnLot, resumerLeLot } from '@batchtester/runner';
import { graine, verifierLeContratDuSimulateur } from '@batchtester/runner/testing';
import { describe, expect, it } from 'vitest';
import { carteDeCout, cartes, TOURS_MAXIMAUX } from './cartes.ts';

verifierLeContratDuSimulateur('duel de cartes', () => systemeTypeScript(cartes).simulateur);

function jouer(surcharges: Record<string, unknown>, n = 1) {
  const valeurs = resoudreLesValeurs(cartes.definition.parametres, surcharges);
  if (!valeurs.ok) throw new Error(JSON.stringify(valeurs.error));
  return cartes.simuler(valeurs.value, creerAleatoire(graine(n)));
}

async function tauxDeVictoire(
  surcharges: Record<string, unknown>,
  mesure: string,
  categorie: string,
) {
  const lot = await lancerUnLot(systemeTypeScript(cartes).simulateur, {
    surcharges,
    graine: graine(2026),
    iterations: 400,
  });
  if (!lot.ok) throw new Error(lot.error.kind);
  const resume = resumerLeLot(lot.value).mesures.find((m) => m.mesure.nom === mesure);
  if (resume?.kind !== 'categorie') throw new Error(mesure);
  return resume.frequences.find((f) => f.categorie === categorie);
}

describe('cartes', () => {
  it('donne 2 × coût + 1 points, répartis selon l’agressivité, avec au moins 1 PV', () => {
    expect(carteDeCout(3, 0.5)).toEqual({ cout: 3, attaque: 4, pv: 3 });
    expect(carteDeCout(3, 0)).toEqual({ cout: 3, attaque: 0, pv: 7 });
    expect(carteDeCout(3, 1)).toEqual({ cout: 3, attaque: 6, pv: 1 });
    expect(carteDeCout(1, 0.2)).toEqual({ cout: 1, attaque: 1, pv: 2 });
  });
});

describe('duel de cartes', () => {
  it('garde les PV des héros à chaque tour, du départ à la fin', () => {
    const { tours, pvA, pvB } = jouer({}, 3);
    expect(pvA).toHaveLength(tours + 1);
    expect(pvB).toHaveLength(tours + 1);
    expect([pvA[0], pvB[0]]).toEqual([20, 20]);
    expect(Math.min(...pvA, ...pvB)).toBeGreaterThanOrEqual(0);
  });

  it('respecte l’ordre de jeu imposé', () => {
    for (let n = 0; n < 20; n += 1) {
      const resultat = jouer({ premier: 'A' }, n);
      const attendu = resultat.vainqueur === 'A' ? 'premier' : 'second';
      expect(resultat.gagnantSelonLOrdre).toBe(attendu);
      expect(jouer({ premier: 'B' }, n).gagnantSelonLOrdre).not.toBe('nul');
    }
  });

  it('fait perdre un joueur dont le paquet est vide, de plus en plus vite', () => {
    // Créatures sans attaque : seule la fatigue fait perdre des PV. A pioche le premier.
    const { vainqueur, tours, pvA } = jouer({
      agressiviteA: 0,
      agressiviteB: 0,
      tailleDuPaquet: 5,
      mainDeDepart: 0,
      pvDesHeros: 3,
      premier: 'A',
      avantageDuSecond: false,
    });
    // A pioche 5 cartes, puis perd 1, puis 2 PV : il tombe au tour 7, avant B.
    expect({ vainqueur, tours }).toEqual({ vainqueur: 'B', tours: 7 });
    expect(pvA.slice(-3)).toEqual([3, 2, 0]);
  });

  it('déclare la partie nulle quand personne ne peut gagner à temps', () => {
    const resultat = jouer({
      agressiviteA: 0,
      agressiviteB: 0,
      tailleDuPaquet: 60,
      pvDesHeros: 100,
    });
    expect(resultat).toMatchObject({
      vainqueur: 'nul',
      gagnantSelonLOrdre: 'nul',
      tours: TOURS_MAXIMAUX,
    });
  });

  it('compte les cartes posées par A', () => {
    const { cartesJoueesA } = jouer({ tailleDuPaquet: 10, coutMax: 1, mainDeDepart: 0 }, 5);
    expect(cartesJoueesA).toBeGreaterThan(0);
    expect(cartesJoueesA).toBeLessThanOrEqual(10);
  });

  it('est équilibré entre deux paquets identiques', async () => {
    const a = await tauxDeVictoire({}, 'vainqueur', 'A');
    expect(a?.basse).toBeLessThan(0.5);
    expect(a?.haute).toBeGreaterThan(0.5);
  });

  it('déséquilibre nettement la partie quand les agressivités diffèrent', async () => {
    // Avec ces règles, le paquet défensif l'emporte : ses créatures encaissent et ripostent.
    // Le test ne fige pas ce constat d'équilibrage, seulement que l'agressivité compte.
    const a = await tauxDeVictoire({ agressiviteA: 0.8, agressiviteB: 0.2 }, 'vainqueur', 'A');
    expect(a !== undefined && (a.haute < 0.5 || a.basse > 0.5)).toBe(true);
  });

  it('donne l’avantage au premier joueur sans carte de compensation', async () => {
    const premier = await tauxDeVictoire(
      { avantageDuSecond: false },
      'gagnantSelonLOrdre',
      'premier',
    );
    expect(premier?.basse).toBeGreaterThan(0.5);
  });
});
