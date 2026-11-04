import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  agregerLesSeries,
  CLASSES_DISCRETES_MAXIMALES,
  convergence,
  ecartDeMoyennes,
  ecartDeProportions,
  estSignificatif,
  intervalleDeLaMoyenne,
  frequences,
  histogramme,
  nombreDeClassesDeSturges,
  proportionDeWilson,
  quantile,
  resumer,
} from './Statistiques.ts';

describe('quantile', () => {
  const triees = [1, 2, 3, 4, 10];

  it.each([
    [0, 1],
    [0.25, 2],
    [0.5, 3],
    [1, 10],
    [0.875, 7],
    [0.1, 1.4],
  ])('q = %d donne %d', (q, attendu) => {
    expect(quantile(triees, q)).toBeCloseTo(attendu, 12);
  });

  it("vaut l'unique valeur d'une série d'un élément", () => {
    expect(quantile([4], 0.95)).toBe(4);
  });
});

describe('resumer', () => {
  it('ne résume pas une série vide', () => {
    expect(resumer([])).toBeNull();
  });

  it('résume une série connue (comparée à un tableur)', () => {
    const resume = resumer([4, 8, 15, 16, 23, 42]);
    expect(resume).toMatchObject({
      n: 6,
      moyenne: 18,
      min: 4,
      p5: 5,
      mediane: 15.5,
      p75: 21.25,
      max: 42,
    });
    expect(resume?.ecartType).toBeCloseTo(13.490737563232042, 12);
    expect(resume?.p25).toBeCloseTo(9.75, 12);
    expect(resume?.p95).toBeCloseTo(37.25, 12);
  });

  it("ne dépend pas de l'ordre des valeurs", () => {
    expect(resumer([42, 4, 23, 15, 8, 16])).toEqual(resumer([4, 8, 15, 16, 23, 42]));
  });

  it('donne un écart-type nul pour une seule valeur et pour des valeurs égales', () => {
    expect(resumer([7])).toMatchObject({ n: 1, moyenne: 7, ecartType: 0, min: 7, max: 7 });
    expect(resumer([3, 3, 3])?.ecartType).toBe(0);
  });

  it('ordonne min ≤ p5 ≤ p25 ≤ médiane ≤ p75 ≤ p95 ≤ max', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -1000, max: 1000 }), { minLength: 1 }), (valeurs) => {
        const r = resumer(valeurs);
        if (r === null) return false;
        const ordre = [r.min, r.p5, r.p25, r.mediane, r.p75, r.p95, r.max];
        return ordre.every((v, i) => i === 0 || (ordre[i - 1] ?? v) <= v) && r.ecartType >= 0;
      }),
    );
  });
});

describe('histogramme', () => {
  it("n'a aucune classe pour une série vide", () => {
    expect(histogramme([])).toEqual({ discret: false, classes: [] });
  });

  it('compte chaque valeur entière dans sa propre classe', () => {
    expect(histogramme([3, 5, 5, 3, 3])).toEqual({
      discret: true,
      classes: [
        { debut: 3, fin: 4, effectif: 3 },
        { debut: 4, fin: 5, effectif: 0 },
        { debut: 5, fin: 6, effectif: 2 },
      ],
    });
  });

  it("n'a qu'une classe quand toutes les valeurs sont égales", () => {
    expect(histogramme([2, 2])).toEqual({
      discret: true,
      classes: [{ debut: 2, fin: 3, effectif: 2 }],
    });
  });

  it(`passe en classes réelles au-delà de ${String(CLASSES_DISCRETES_MAXIMALES)} valeurs entières`, () => {
    // L'écart compte, pas la valeur : de 100 à 139, il y a 40 valeurs possibles.
    const juste = histogramme([100, 100 + CLASSES_DISCRETES_MAXIMALES - 1]);
    expect(juste.discret).toBe(true);
    expect(juste.classes).toHaveLength(CLASSES_DISCRETES_MAXIMALES);
    expect(histogramme([100, 100 + CLASSES_DISCRETES_MAXIMALES]).discret).toBe(false);
  });

  it('découpe des réels en classes de Sturges de même largeur', () => {
    // 8 valeurs : 4 classes de largeur 2,5 entre 10 et 20.
    expect(histogramme([10, 11, 12.5, 13, 15.5, 17, 19.9, 20])).toEqual({
      discret: false,
      classes: [
        { debut: 10, fin: 12.5, effectif: 2 },
        { debut: 12.5, fin: 15, effectif: 2 },
        { debut: 15, fin: 17.5, effectif: 2 },
        { debut: 17.5, fin: 20, effectif: 2 },
      ],
    });
  });

  it("n'a qu'une classe pour des réels égaux ou trop proches pour être séparés", () => {
    expect(histogramme([0.5, 0.5, 0.5])).toEqual({
      discret: false,
      classes: [{ debut: 0.5, fin: 0.5, effectif: 3 }],
    });
    expect(histogramme([0, 5e-324]).classes).toEqual([{ debut: 0, fin: 5e-324, effectif: 2 }]);
  });

  it('met fin à la dernière classe exactement sur le maximum', () => {
    // Sans correction, 0,1 + 3 × ((0,3 - 0,1) / 3) vaut 0,30000000000000004.
    const { classes } = histogramme([0.1, 0.2, 0.3]);
    expect(classes.at(-1)?.fin).toBe(0.3);
  });

  it('compte chaque valeur une et une seule fois', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: -1e6, max: 1e6, noNaN: true }), { minLength: 1 }),
        (valeurs) => {
          const total = histogramme(valeurs).classes.reduce((somme, c) => somme + c.effectif, 0);
          return total === valeurs.length;
        },
      ),
    );
  });

  it('suit la règle de Sturges', () => {
    expect([1, 2, 8, 9, 100, 1000].map(nombreDeClassesDeSturges)).toEqual([1, 2, 4, 5, 8, 11]);
  });
});

describe('proportionDeWilson', () => {
  it('donne les bornes de référence pour 7 succès sur 20', () => {
    const { proportion, basse, haute } = proportionDeWilson(7, 20);
    expect(proportion).toBe(0.35);
    expect(basse).toBeCloseTo(0.1812, 4);
    expect(haute).toBeCloseTo(0.5671, 4);
  });

  it('reste dans [0, 1] aux extrêmes', () => {
    const aucun = proportionDeWilson(0, 10);
    expect([aucun.proportion, aucun.basse]).toEqual([0, 0]);
    expect(aucun.haute).toBeCloseTo(0.2775, 4);
    const tous = proportionDeWilson(10, 10);
    expect([tous.proportion, tous.haute]).toEqual([1, 1]);
    expect(tous.basse).toBeCloseTo(0.7225, 4);
  });

  it("se resserre quand l'échantillon grandit", () => {
    const petit = proportionDeWilson(5, 10);
    const grand = proportionDeWilson(500, 1000);
    expect(grand.haute - grand.basse).toBeLessThan(petit.haute - petit.basse);
  });

  it('encadre toujours la proportion observée', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000 }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (total, part) => {
          const succes = Math.round(total * part);
          const { proportion, basse, haute } = proportionDeWilson(succes, total);
          return basse >= 0 && basse <= proportion && proportion <= haute && haute <= 1;
        },
      ),
    );
  });

  it.each([
    [1, 0],
    [-1, 10],
    [11, 10],
    [1.5, 10],
    [1, 10.5],
    [0, 0],
  ])('refuse %d succès sur %d', (succes, total) => {
    expect(() => proportionDeWilson(succes, total)).toThrow(
      new RangeError(
        `proportion de ${String(succes)} sur ${String(total)} : 0 ≤ succès ≤ total, total > 0`,
      ),
    );
  });
});

describe('écarts entre deux lots', () => {
  it("donne l'intervalle de Newcombe de l'exemple de référence (56/70 contre 48/80)", () => {
    const { ecart, basse, haute } = ecartDeProportions(
      proportionDeWilson(48, 80),
      proportionDeWilson(56, 70),
    );
    expect(ecart).toBeCloseTo(0.2, 12);
    expect(basse).toBeCloseTo(0.0524, 4);
    expect(haute).toBeCloseTo(0.3339, 4);
  });

  it('change de signe quand on inverse les lots', () => {
    const a = proportionDeWilson(10, 40);
    const b = proportionDeWilson(25, 50);
    const direct = ecartDeProportions(a, b);
    const inverse = ecartDeProportions(b, a);
    expect(inverse.ecart).toBeCloseTo(-direct.ecart, 12);
    expect(inverse.basse).toBeCloseTo(-direct.haute, 12);
    expect(inverse.haute).toBeCloseTo(-direct.basse, 12);
  });

  it("donne l'intervalle de Welch d'un écart de moyennes", () => {
    const a = resumer([1, 2, 3, 4, 5]);
    const b = resumer([3, 4, 5, 6, 7]);
    if (a === null || b === null) throw new Error('résumés vides');
    // Écart 2, erreur type √(2,5/5 + 2,5/5) = 1.
    expect(ecartDeMoyennes(a, b)).toEqual({
      ecart: 2,
      basse: 2 - 1.959963984540054,
      haute: 2 + 1.959963984540054,
    });
  });

  it("élargit l'intervalle de Welch avec l'erreur type", () => {
    const a = resumer([1, 2, 3, 4, 5]);
    const b = resumer([2, 4, 6, 8, 10]);
    if (a === null || b === null) throw new Error('résumés vides');
    // Écart 3, erreur type √(2,5/5 + 10/5) = √2,5.
    const { ecart, basse, haute } = ecartDeMoyennes(a, b);
    expect(ecart).toBe(3);
    expect(haute - ecart).toBeCloseTo(1.959963984540054 * Math.sqrt(2.5), 12);
    expect(ecart - basse).toBeCloseTo(1.959963984540054 * Math.sqrt(2.5), 12);
  });

  it("donne l'intervalle de confiance d'une moyenne", () => {
    const r = resumer([1, 2, 3, 4, 5]);
    if (r === null) throw new Error('résumé vide');
    // Écart-type √2,5, erreur type √(2,5 / 5).
    const marge = 1.959963984540054 * Math.sqrt(0.5);
    const { basse, haute } = intervalleDeLaMoyenne(r);
    expect(basse).toBeCloseTo(3 - marge, 12);
    expect(haute).toBeCloseTo(3 + marge, 12);
  });

  it("n'est significatif que si l'intervalle exclut zéro", () => {
    expect(estSignificatif({ ecart: 0.1, basse: 0.01, haute: 0.2 })).toBe(true);
    expect(estSignificatif({ ecart: -0.1, basse: -0.2, haute: -0.01 })).toBe(true);
    expect(estSignificatif({ ecart: 0.1, basse: -0.01, haute: 0.2 })).toBe(false);
    expect(estSignificatif({ ecart: 0, basse: 0, haute: 0 })).toBe(false);
  });
});

describe('frequences', () => {
  it('compte chaque catégorie dans l’ordre donné, y compris les absentes', () => {
    const resultat = frequences(['A', 'B', 'A', 'A'], ['B', 'A', 'nul']);
    expect(
      resultat.map(({ categorie, effectif, proportion }) => [categorie, effectif, proportion]),
    ).toEqual([
      ['B', 1, 0.25],
      ['A', 3, 0.75],
      ['nul', 0, 0],
    ]);
    expect(resultat[1]).toEqual({ categorie: 'A', effectif: 3, ...proportionDeWilson(3, 4) });
  });

  it("n'a rien à dire d'une série vide", () => {
    expect(frequences([], ['A'])).toEqual([]);
  });
});

describe('convergence', () => {
  it('donne la moyenne cumulée à chaque itération quand les points suffisent', () => {
    expect(convergence([4, 2, 6, 0], 10)).toEqual([
      { iterations: 1, moyenne: 4 },
      { iterations: 2, moyenne: 3 },
      { iterations: 3, moyenne: 4 },
      { iterations: 4, moyenne: 3 },
    ]);
  });

  it('répartit régulièrement les points et finit toujours sur la dernière itération', () => {
    const valeurs = Array.from({ length: 10 }, (_, i) => i + 1);
    expect(convergence(valeurs, 4)).toEqual([
      { iterations: 3, moyenne: 2 },
      { iterations: 5, moyenne: 3 },
      { iterations: 8, moyenne: 4.5 },
      { iterations: 10, moyenne: 5.5 },
    ]);
  });

  it("n'a aucun point sans valeur ou sans point demandé", () => {
    expect(convergence([], 10)).toEqual([]);
    expect(convergence([1, 2], 0)).toEqual([]);
  });

  it('donne au plus le nombre de points demandé, la moyenne finale en dernier', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -100, max: 100 }), { minLength: 1, maxLength: 500 }),
        fc.integer({ min: 1, max: 50 }),
        (valeurs, points) => {
          const courbe = convergence(valeurs, points);
          const derniere = courbe.at(-1);
          const moyenne = valeurs.reduce((s, v) => s + v, 0) / valeurs.length;
          return (
            courbe.length === Math.min(points, valeurs.length) &&
            derniere?.iterations === valeurs.length &&
            Math.abs(derniere.moyenne - moyenne) < 1e-9
          );
        },
      ),
    );
  });
});

describe('agregerLesSeries', () => {
  it("n'a aucun point sans série", () => {
    expect(agregerLesSeries([])).toEqual([]);
    expect(agregerLesSeries([[], []])).toEqual([]);
  });

  it('agrège indice par indice, en suivant les séries plus longues', () => {
    expect(agregerLesSeries([[10, 6, 2], [10, 4], [10]])).toEqual([
      { indice: 0, n: 3, moyenne: 10, min: 10, max: 10 },
      { indice: 1, n: 2, moyenne: 5, min: 4, max: 6 },
      { indice: 2, n: 1, moyenne: 2, min: 2, max: 2 },
    ]);
  });
});
