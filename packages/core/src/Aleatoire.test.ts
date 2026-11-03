import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { creerAleatoire } from './Aleatoire.ts';
import { creerGraine, GRAINE_MAXIMALE, type Graine } from './Graine.ts';

const graine = (n: number): Graine => {
  const creee = creerGraine(n);
  if (!creee.ok) throw new Error(`graine invalide : ${String(n)}`);
  return creee.value;
};

const uneGraine = fc.integer({ min: 0, max: GRAINE_MAXIMALE }).map(graine);

// Valeurs figées : changer le générateur changerait le résultat de tous les lancements enregistrés.
describe('reproductibilité', () => {
  it('donne toujours la même suite pour la graine 42', () => {
    const aleatoire = creerAleatoire(graine(42));
    expect([aleatoire.reel(), aleatoire.reel(), aleatoire.reel()]).toEqual([
      0.9211069431621581, 0.729273772565648, 0.8167118318378925,
    ]);
  });

  it('donne toujours les mêmes lancers de dé pour la graine 42', () => {
    const aleatoire = creerAleatoire(graine(42));
    expect(Array.from({ length: 10 }, () => aleatoire.entier(1, 6))).toEqual([
      6, 5, 5, 2, 2, 3, 5, 6, 1, 2,
    ]);
  });

  it('donne toujours le même mélange puis le même choix pour la graine 1', () => {
    const aleatoire = creerAleatoire(graine(1));
    expect(aleatoire.melanger([1, 2, 3, 4, 5, 6, 7, 8])).toEqual([3, 7, 6, 4, 1, 8, 5, 2]);
    expect(aleatoire.choisir(['a', 'b', 'c', 'd'])).toBe('c');
  });

  it('rejoue la même suite avec la même graine', () => {
    fc.assert(
      fc.property(uneGraine, (g) => {
        const a = creerAleatoire(g);
        const b = creerAleatoire(g);
        return Array.from({ length: 20 }, () => a.reel() === b.reel()).every(Boolean);
      }),
    );
  });

  it('donne des suites différentes pour des graines voisines', () => {
    const premiers = Array.from({ length: 1000 }, (_, i) => creerAleatoire(graine(i)).reel());
    expect(new Set(premiers).size).toBe(1000);
  });
});

describe('reel', () => {
  it('reste dans [0, 1[', () => {
    fc.assert(
      fc.property(uneGraine, (g) => {
        const aleatoire = creerAleatoire(g);
        return Array.from({ length: 50 }, () => aleatoire.reel()).every((x) => x >= 0 && x < 1);
      }),
    );
  });

  it('est uniforme : chaque dixième reçoit environ 10 % des tirages', () => {
    const aleatoire = creerAleatoire(graine(2026));
    const effectifs = Array.from({ length: 10 }, () => 0);
    for (let i = 0; i < 100_000; i += 1) {
      const dixieme = Math.floor(aleatoire.reel() * 10);
      effectifs[dixieme] = (effectifs[dixieme] ?? 0) + 1;
    }
    // Écart-type d'un effectif : √(100 000 × 0,1 × 0,9) ≈ 95 ; 400 laisse plus de 4 σ.
    for (const effectif of effectifs) expect(Math.abs(effectif - 10_000)).toBeLessThan(400);
  });
});

describe('entier', () => {
  it('reste entre les bornes, bornes comprises, et les atteint', () => {
    const aleatoire = creerAleatoire(graine(3));
    const tirages = new Set(Array.from({ length: 1000 }, () => aleatoire.entier(-2, 2)));
    expect([...tirages].sort((a, b) => a - b)).toEqual([-2, -1, 0, 1, 2]);
  });

  it('renvoie la borne quand min = max', () => {
    expect(creerAleatoire(graine(3)).entier(7, 7)).toBe(7);
  });

  it.each([
    [2, 1],
    [0.5, 3],
    [0, 2.5],
    [Number.NaN, 3],
    [0, Number.POSITIVE_INFINITY],
    [0, 2 ** 53],
  ])('refuse les bornes (%d, %d)', (min, max) => {
    expect(() => creerAleatoire(graine(3)).entier(min, max)).toThrow(
      new RangeError(
        `entier(${String(min)}, ${String(max)}) : bornes entières attendues, min ≤ max`,
      ),
    );
  });
});

describe('chance', () => {
  it('ne se produit jamais pour p = 0 et toujours pour p = 1', () => {
    const aleatoire = creerAleatoire(graine(5));
    const tirages = Array.from({ length: 1000 }, () => [aleatoire.chance(0), aleatoire.chance(1)]);
    expect(tirages.every(([jamais, toujours]) => jamais === false && toujours === true)).toBe(true);
  });

  it('se produit avec la probabilité demandée', () => {
    const aleatoire = creerAleatoire(graine(5));
    const succes = Array.from({ length: 100_000 }, () => aleatoire.chance(0.3)).filter(Boolean);
    // Écart-type : √(100 000 × 0,3 × 0,7) ≈ 145 ; 600 laisse plus de 4 σ.
    expect(Math.abs(succes.length - 30_000)).toBeLessThan(600);
  });
});

describe('choisir', () => {
  it('peut renvoyer chaque élément', () => {
    const aleatoire = creerAleatoire(graine(8));
    const choisis = new Set(Array.from({ length: 200 }, () => aleatoire.choisir(['a', 'b', 'c'])));
    expect(choisis).toEqual(new Set(['a', 'b', 'c']));
  });

  it("renvoie l'unique élément", () => {
    expect(creerAleatoire(graine(8)).choisir(['seul'])).toBe('seul');
  });
});

describe('melanger', () => {
  it('garde les mêmes éléments sans modifier le tableau reçu', () => {
    fc.assert(
      fc.property(uneGraine, fc.array(fc.integer()), (g, elements) => {
        const copie = [...elements];
        const melange = creerAleatoire(g).melanger(elements);
        expect(elements).toEqual(copie);
        expect([...melange].sort((a, b) => a - b)).toEqual([...elements].sort((a, b) => a - b));
      }),
    );
  });

  it('place chaque élément en tête environ une fois sur trois', () => {
    const aleatoire = creerAleatoire(graine(13));
    const enTete = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 30_000; i += 1) {
      const [premier] = aleatoire.melanger(['a', 'b', 'c'] as const);
      if (premier !== undefined) enTete[premier] += 1;
    }
    // Écart-type : √(30 000 × 1/3 × 2/3) ≈ 82 ; 400 laisse plus de 4 σ.
    for (const effectif of Object.values(enTete))
      expect(Math.abs(effectif - 10_000)).toBeLessThan(400);
  });
});
