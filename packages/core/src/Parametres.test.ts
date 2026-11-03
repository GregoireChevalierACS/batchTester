import { describe, expect, it } from 'vitest';
import {
  lireUnBooleen,
  lireUneValeur,
  lireUnNombre,
  lireUnTexte,
  resoudreLesValeurs,
  valeursParDefaut,
  verifierUnParametre,
  type DefBooleen,
  type DefChoix,
  type DefEntier,
  type DefNombre,
  type DefParametre,
} from './Parametres.ts';

const PRECISION: DefNombre = {
  kind: 'nombre',
  nom: 'precision',
  min: 0,
  max: 1,
  pas: 0.01,
  defaut: 0.8,
};
const PV: DefEntier = { kind: 'entier', nom: 'pv', min: 1, max: 500, defaut: 100 };
const CLASSE: DefChoix = {
  kind: 'choix',
  nom: 'classe',
  options: ['guerrier', 'mage'],
  defaut: 'mage',
};
const BOUCLIER: DefBooleen = { kind: 'booleen', nom: 'bouclier', defaut: false };
const DEFINITIONS: readonly DefParametre[] = [PRECISION, PV, CLASSE, BOUCLIER];

describe('lireUneValeur', () => {
  describe('nombre', () => {
    it.each([0, 1, 0.5, 0.07, 0.29])('accepte %d', (v) => {
      expect(lireUneValeur(PRECISION, v)).toEqual({ ok: true, value: v });
    });

    it('accepte une valeur sur la grille du pas quand min ne vaut pas 0', () => {
      // Les crans partent de min : 1,1 = 0,1 + 2 × 0,5 (et 1,1 n'est pas un multiple de 0,5).
      const decale = { ...PRECISION, min: 0.1, max: 2, pas: 0.5 };
      expect(lireUneValeur(decale, 1.1).ok).toBe(true);
      expect(lireUneValeur(decale, 1)).toEqual({ ok: false, error: 'hors-pas' });
    });

    it.each([
      [-0.01, 'hors-bornes'],
      [1.01, 'hors-bornes'],
      [0.005, 'hors-pas'],
      [0.123, 'hors-pas'],
      ['0.5', 'type-incorrect'],
      [Number.NaN, 'type-incorrect'],
      [Number.POSITIVE_INFINITY, 'type-incorrect'],
    ])('refuse %j : %s', (v, raison) => {
      expect(lireUneValeur(PRECISION, v)).toEqual({ ok: false, error: raison });
    });
  });

  describe('entier', () => {
    it.each([1, 250, 500])('accepte %d', (v) => {
      expect(lireUneValeur(PV, v)).toEqual({ ok: true, value: v });
    });

    it.each([
      [0, 'hors-bornes'],
      [501, 'hors-bornes'],
      [2.5, 'type-incorrect'],
      ['100', 'type-incorrect'],
      [2 ** 53, 'type-incorrect'],
    ])('refuse %j : %s', (v, raison) => {
      expect(lireUneValeur(PV, v)).toEqual({ ok: false, error: raison });
    });
  });

  describe('choix', () => {
    it('accepte une option', () => {
      expect(lireUneValeur(CLASSE, 'guerrier')).toEqual({ ok: true, value: 'guerrier' });
    });

    it.each([
      ['voleur', 'option-inconnue'],
      ['Mage', 'option-inconnue'],
      [1, 'type-incorrect'],
    ])('refuse %j : %s', (v, raison) => {
      expect(lireUneValeur(CLASSE, v)).toEqual({ ok: false, error: raison });
    });
  });

  describe('booléen', () => {
    it.each([true, false])('accepte %j', (v) => {
      expect(lireUneValeur(BOUCLIER, v)).toEqual({ ok: true, value: v });
    });

    it.each(['true', 0, null])('refuse %j', (v) => {
      expect(lireUneValeur(BOUCLIER, v)).toEqual({ ok: false, error: 'type-incorrect' });
    });
  });
});

describe('verifierUnParametre', () => {
  it.each(DEFINITIONS)('accepte $nom', (def) => {
    expect(verifierUnParametre(def)).toEqual([]);
  });

  it('accepte des bornes réelles pour un nombre, pas pour un entier', () => {
    expect(verifierUnParametre({ ...PRECISION, min: 0.5, max: 1.5, defaut: 1 })).toEqual([]);
    expect(verifierUnParametre({ ...PV, min: 0.5 })).toEqual([
      { kind: 'bornes-invalides', nom: 'pv' },
    ]);
  });

  it('accepte des bornes égales', () => {
    expect(verifierUnParametre({ ...PV, min: 3, max: 3, defaut: 3 })).toEqual([]);
  });

  it.each<DefParametre>([
    { ...PRECISION, min: 2 },
    { ...PRECISION, min: Number.NaN },
    { ...PRECISION, max: Number.POSITIVE_INFINITY },
    { ...PV, min: 1.5 },
    { ...PV, max: 600.5 },
    { ...PV, min: 600 },
  ])('signale des bornes invalides (min $min, max $max)', (def) => {
    expect(verifierUnParametre(def)).toEqual([{ kind: 'bornes-invalides', nom: def.nom }]);
  });

  it.each([0, -0.1, Number.NaN, Number.POSITIVE_INFINITY])('signale un pas de %d', (pas) => {
    expect(verifierUnParametre({ ...PRECISION, pas })).toEqual([
      { kind: 'pas-invalide', nom: 'precision' },
    ]);
  });

  it.each([[[]], [['mage', 'mage']]])('signale les options %j', (options) => {
    expect(verifierUnParametre({ ...CLASSE, options })).toEqual([
      { kind: 'options-invalides', nom: 'classe' },
    ]);
  });

  it.each<[DefParametre, string]>([
    [{ ...PRECISION, defaut: 1.5 }, 'hors-bornes'],
    [{ ...PRECISION, defaut: 0.333 }, 'hors-pas'],
    [{ ...PV, defaut: 0 }, 'hors-bornes'],
    [{ ...CLASSE, defaut: 'voleur' }, 'option-inconnue'],
  ])('signale une valeur par défaut invalide (%j)', (def, raison) => {
    expect(verifierUnParametre(def)).toEqual([{ kind: 'defaut-invalide', nom: def.nom, raison }]);
  });
});

describe('valeursParDefaut', () => {
  it('donne la valeur par défaut de chaque paramètre', () => {
    expect(valeursParDefaut(DEFINITIONS)).toEqual({
      precision: 0.8,
      pv: 100,
      classe: 'mage',
      bouclier: false,
    });
  });
});

describe('resoudreLesValeurs', () => {
  it('prend les valeurs par défaut sans surcharge', () => {
    expect(resoudreLesValeurs(DEFINITIONS, {})).toEqual({
      ok: true,
      value: valeursParDefaut(DEFINITIONS),
    });
  });

  it('remplace les valeurs surchargées', () => {
    expect(resoudreLesValeurs(DEFINITIONS, { pv: 250, bouclier: true })).toEqual({
      ok: true,
      value: { precision: 0.8, pv: 250, classe: 'mage', bouclier: true },
    });
  });

  it("ne lit pas les propriétés héritées de l'objet", () => {
    const surcharges = { __proto__: { pv: 999 } };
    expect(resoudreLesValeurs(DEFINITIONS, surcharges).ok).toBe(true);
  });

  it('rapporte toutes les erreurs à la fois', () => {
    expect(resoudreLesValeurs(DEFINITIONS, { pv: 0, vitesse: 3, classe: 'voleur' })).toEqual({
      ok: false,
      error: [
        { kind: 'parametre-inconnu', nom: 'vitesse' },
        { kind: 'valeur-invalide', nom: 'pv', valeur: 0, raison: 'hors-bornes' },
        { kind: 'valeur-invalide', nom: 'classe', valeur: 'voleur', raison: 'option-inconnue' },
      ],
    });
  });
});

describe('lecture typée depuis une simulation', () => {
  const valeurs = { pv: 100, classe: 'mage', bouclier: true };

  it('lit chaque type', () => {
    expect(lireUnNombre(valeurs, 'pv')).toBe(100);
    expect(lireUnTexte(valeurs, 'classe')).toBe('mage');
    expect(lireUnBooleen(valeurs, 'bouclier')).toBe(true);
  });

  it('signale un nom ou un type faux', () => {
    expect(() => lireUnNombre(valeurs, 'pV')).toThrow(
      new TypeError('paramètre « pV » : nombre attendu'),
    );
    expect(() => lireUnTexte(valeurs, 'pv')).toThrow(
      new TypeError('paramètre « pv » : texte attendu'),
    );
    expect(() => lireUnBooleen(valeurs, 'classe')).toThrow(
      new TypeError('paramètre « classe » : booléen attendu'),
    );
  });
});
