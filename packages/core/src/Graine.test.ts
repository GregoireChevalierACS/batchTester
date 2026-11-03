import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { brasser, creerGraine, deriverLaGraine, GRAINE_MAXIMALE, type Graine } from './Graine.ts';

const graine = (n: number): Graine => {
  const creee = creerGraine(n);
  if (!creee.ok) throw new Error(`graine invalide : ${String(n)}`);
  return creee.value;
};

describe('creerGraine', () => {
  it.each([0, 1, 42, GRAINE_MAXIMALE])('accepte %d', (n) => {
    expect(creerGraine(n)).toEqual({ ok: true, value: n });
  });

  it.each([-1, GRAINE_MAXIMALE + 1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuse %d',
    (n) => {
      expect(creerGraine(n)).toEqual({ ok: false, error: { kind: 'graine-invalide' } });
    },
  );

  it('a pour maximum 2^32 - 1', () => {
    expect(GRAINE_MAXIMALE).toBe(2 ** 32 - 1);
  });
});

// Valeurs figées : changer le brassage changerait le résultat de tous les lancements enregistrés.
describe('brasser', () => {
  it('donne toujours les mêmes valeurs', () => {
    expect([0, 1, 42, GRAINE_MAXIMALE].map(brasser)).toEqual([
      1684164658, 1580013426, 551831576, 3950124170,
    ]);
  });

  it('renvoie un entier non signé sur 32 bits', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: GRAINE_MAXIMALE }), (x) => {
        const y = brasser(x);
        return Number.isInteger(y) && y >= 0 && y <= GRAINE_MAXIMALE;
      }),
    );
  });
});

describe('deriverLaGraine', () => {
  it('donne toujours les mêmes graines', () => {
    expect([deriverLaGraine(graine(42), 0), deriverLaGraine(graine(42), 1)]).toEqual([
      1759338658, 2370221968,
    ]);
    expect(deriverLaGraine(graine(42), 2)).toBe(1993415469);
    expect(deriverLaGraine(graine(7), 0)).toBe(236867408);
  });

  it("donne une graine différente à chaque itération d'un lot", () => {
    const graines = Array.from({ length: 10_000 }, (_, i) => deriverLaGraine(graine(42), i));
    expect(new Set(graines).size).toBe(10_000);
  });

  it('donne une graine valide', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: GRAINE_MAXIMALE }),
        fc.nat({ max: 1_000_000 }),
        (maitre, index) => creerGraine(deriverLaGraine(graine(maitre), index)).ok,
      ),
    );
  });
});
