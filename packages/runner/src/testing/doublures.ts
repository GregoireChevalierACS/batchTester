import {
  creerGraine,
  type DefinitionDeSysteme,
  type Graine,
  type Valeurs,
} from '@batchtester/core';
import type { Simulateur } from '../ports.ts';

export const graine = (n: number): Graine => {
  const creee = creerGraine(n);
  if (!creee.ok) throw new Error(`graine invalide : ${String(n)}`);
  return creee.value;
};

/** Un système minimal avec une mesure de chaque sorte. */
export const DEFINITION_DE_TEST: DefinitionDeSysteme = {
  nom: 'Pile ou face',
  version: '1.0.0',
  parametres: [{ kind: 'entier', nom: 'lancers', min: 1, max: 10, defaut: 3 }],
  mesures: [
    { kind: 'nombre', nom: 'piles' },
    { kind: 'categorie', nom: 'issue', categories: ['pile', 'face'] },
    { kind: 'serie', nom: 'cumul' },
  ],
};

/**
 * Simulateur entièrement décrit par le test : `comportement` reçoit les valeurs et la graine et
 * renvoie (ou lève) ce que le simulateur doit renvoyer (ou lever).
 */
export class SimulateurScripte implements Simulateur {
  readonly appels: { readonly valeurs: Valeurs; readonly graine: Graine }[] = [];
  readonly definition: DefinitionDeSysteme;
  private readonly comportement: (valeurs: Valeurs, graine: Graine) => unknown;

  constructor(
    comportement: (valeurs: Valeurs, graine: Graine) => unknown,
    definition: DefinitionDeSysteme = DEFINITION_DE_TEST,
  ) {
    this.comportement = comportement;
    this.definition = definition;
  }

  async simuler(valeurs: Valeurs, graine: Graine): Promise<unknown> {
    this.appels.push({ valeurs, graine });
    // Rend la main à chaque itération, comme un vrai simulateur asynchrone.
    await Promise.resolve();
    return this.comportement(valeurs, graine);
  }
}

/** Résultat valide de DEFINITION_DE_TEST, tiré de la graine (pair : pile). */
export const resultatDeTest = (_valeurs: Valeurs, g: Graine) => ({
  piles: g % 4,
  issue: g % 2 === 0 ? 'pile' : 'face',
  cumul: [g % 3, g % 5],
});
