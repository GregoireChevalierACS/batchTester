import { deriverLaGraine } from '@batchtester/core';
import { describe, expect, it } from 'vitest';
import { ITERATIONS_MAXIMALES, lancerUnLot, SIMULTANEES_PAR_DEFAUT } from './lancerUnLot.ts';
import {
  DEFINITION_DE_TEST,
  graine,
  resultatDeTest,
  SimulateurScripte,
  verifierLeContratDuSimulateur,
} from './testing/index.ts';

verifierLeContratDuSimulateur('doublure scriptée', () => new SimulateurScripte(resultatDeTest));

const DEMANDE = { surcharges: {}, graine: graine(42), iterations: 20 };

describe('lancer un lot', () => {
  it("joue chaque itération avec la graine dérivée de son index, dans l'ordre des index", async () => {
    const simulateur = new SimulateurScripte(resultatDeTest);
    const lot = await lancerUnLot(simulateur, DEMANDE);
    if (!lot.ok) throw new Error(lot.error.kind);
    expect(lot.value.iterations).toHaveLength(20);
    lot.value.iterations.forEach((iteration, i) => {
      const g = deriverLaGraine(graine(42), i);
      expect(iteration).toEqual({ index: i, graine: g, resultat: resultatDeTest({}, g) });
    });
    expect(lot.value).toMatchObject({ definition: DEFINITION_DE_TEST, graine: 42 });
  });

  it('applique les surcharges aux valeurs par défaut', async () => {
    const simulateur = new SimulateurScripte(resultatDeTest);
    const lot = await lancerUnLot(simulateur, { ...DEMANDE, surcharges: { lancers: 7 } });
    expect(lot.ok && lot.value.valeurs).toEqual({ lancers: 7 });
    expect(simulateur.appels.every(({ valeurs }) => valeurs['lancers'] === 7)).toBe(true);
  });

  it('donne le même lot pour la même graine, et un autre pour une autre graine', async () => {
    const simulateur = new SimulateurScripte(resultatDeTest);
    const premier = await lancerUnLot(simulateur, DEMANDE);
    const second = await lancerUnLot(simulateur, DEMANDE);
    const autre = await lancerUnLot(simulateur, { ...DEMANDE, graine: graine(43) });
    expect(second).toEqual(premier);
    expect(autre).not.toEqual(premier);
  });

  it('donne le même lot quel que soit le nombre de simulations simultanées', async () => {
    const simulateur = new SimulateurScripte(resultatDeTest);
    const seule = await lancerUnLot(simulateur, DEMANDE, { simultanees: 1 });
    const plusieurs = await lancerUnLot(simulateur, DEMANDE, { simultanees: 7 });
    expect(plusieurs).toEqual(seule);
  });

  it('ne garde jamais plus de simulations en cours que demandé', async () => {
    let enCours = 0;
    let maximum = 0;
    const simulateur = new SimulateurScripte(async (valeurs, g) => {
      enCours += 1;
      maximum = Math.max(maximum, enCours);
      await new Promise((resolve) => setTimeout(resolve, 1));
      enCours -= 1;
      return resultatDeTest(valeurs, g);
    });
    await lancerUnLot(simulateur, DEMANDE, { simultanees: 3 });
    expect(maximum).toBe(3);
    await lancerUnLot(simulateur, { ...DEMANDE, iterations: 2 }, { simultanees: 50 });
    expect(maximum).toBe(3);
  });

  it(`lance ${String(SIMULTANEES_PAR_DEFAUT)} simulations à la fois par défaut`, async () => {
    let enCours = 0;
    let maximum = 0;
    const simulateur = new SimulateurScripte(async (valeurs, g) => {
      enCours += 1;
      maximum = Math.max(maximum, enCours);
      await new Promise((resolve) => setTimeout(resolve, 1));
      enCours -= 1;
      return resultatDeTest(valeurs, g);
    });
    await lancerUnLot(simulateur, DEMANDE);
    expect(maximum).toBe(SIMULTANEES_PAR_DEFAUT);
  });

  it('signale la progression après chaque itération', async () => {
    const progression: [number, number][] = [];
    await lancerUnLot(
      new SimulateurScripte(resultatDeTest),
      { ...DEMANDE, iterations: 3 },
      {
        surProgression: (faites, total) => progression.push([faites, total]),
      },
    );
    expect(progression).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });
});

describe('refus avant de lancer', () => {
  it('refuse une définition invalide', async () => {
    const definition = { ...DEFINITION_DE_TEST, version: '' };
    const simulateur = new SimulateurScripte(resultatDeTest, definition);
    expect(await lancerUnLot(simulateur, DEMANDE)).toEqual({
      ok: false,
      error: { kind: 'definition-invalide', defauts: [{ kind: 'version-vide' }] },
    });
    expect(simulateur.appels).toHaveLength(0);
  });

  it.each([0, -1, 2.5, Number.NaN, ITERATIONS_MAXIMALES + 1])(
    'refuse %d itérations',
    async (iterations) => {
      const simulateur = new SimulateurScripte(resultatDeTest);
      expect(await lancerUnLot(simulateur, { ...DEMANDE, iterations })).toEqual({
        ok: false,
        error: { kind: 'iterations-invalides', iterations },
      });
    },
  );

  it('accepte 1 et le maximum d’itérations', async () => {
    const simulateur = new SimulateurScripte(resultatDeTest);
    expect((await lancerUnLot(simulateur, { ...DEMANDE, iterations: 1 })).ok).toBe(true);
    const maximum = await lancerUnLot(simulateur, { ...DEMANDE, iterations: ITERATIONS_MAXIMALES });
    expect(maximum.ok && maximum.value.iterations).toHaveLength(ITERATIONS_MAXIMALES);
  });

  it.each([0, -2, 1.5])('refuse %d simulations simultanées', async (simultanees) => {
    const simulateur = new SimulateurScripte(resultatDeTest);
    expect(await lancerUnLot(simulateur, DEMANDE, { simultanees })).toEqual({
      ok: false,
      error: { kind: 'simultanees-invalides', simultanees },
    });
  });

  it('refuse des valeurs invalides', async () => {
    const simulateur = new SimulateurScripte(resultatDeTest);
    expect(await lancerUnLot(simulateur, { ...DEMANDE, surcharges: { lancers: 11 } })).toEqual({
      ok: false,
      error: {
        kind: 'valeurs-invalides',
        erreurs: [{ kind: 'valeur-invalide', nom: 'lancers', valeur: 11, raison: 'hors-bornes' }],
      },
    });
    expect(simulateur.appels).toHaveLength(0);
  });
});

describe("échec d'une itération", () => {
  const grainesEnEchec = new Set([5, 9].map((i) => deriverLaGraine(graine(42), i)));

  it("rapporte l'exception d'une simulation avec de quoi la rejouer", async () => {
    const simulateur = new SimulateurScripte((valeurs, g) => {
      if (grainesEnEchec.has(g)) throw new Error('pv négatifs');
      return resultatDeTest(valeurs, g);
    });
    expect(await lancerUnLot(simulateur, DEMANDE)).toEqual({
      ok: false,
      error: {
        kind: 'simulation-en-echec',
        index: 5,
        graine: deriverLaGraine(graine(42), 5),
        message: 'pv négatifs',
      },
    });
  });

  it("rapporte une exception qui n'est pas une Error", async () => {
    const simulateur = new SimulateurScripte(() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- un système externe peut lever n'importe quoi
      throw 'boum';
    });
    const lot = await lancerUnLot(simulateur, DEMANDE);
    expect(!lot.ok && lot.error).toMatchObject({
      kind: 'simulation-en-echec',
      index: 0,
      message: 'boum',
    });
  });

  it('rapporte un résultat non conforme à la définition', async () => {
    const simulateur = new SimulateurScripte((valeurs, g) =>
      grainesEnEchec.has(g) ? { piles: 'deux' } : resultatDeTest(valeurs, g),
    );
    const lot = await lancerUnLot(simulateur, DEMANDE);
    expect(lot).toEqual({
      ok: false,
      error: {
        kind: 'resultat-invalide',
        index: 5,
        graine: deriverLaGraine(graine(42), 5),
        erreurs: [
          { kind: 'type-incorrect', nom: 'piles' },
          { kind: 'mesure-manquante', nom: 'issue' },
          { kind: 'mesure-manquante', nom: 'cumul' },
        ],
      },
    });
  });

  it("rapporte toujours l'échec de plus petit index, même s'il se termine après un autre", async () => {
    const simulateur = new SimulateurScripte(async (valeurs, g) => {
      if (g === deriverLaGraine(graine(42), 5)) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        throw new Error('lent');
      }
      if (g === deriverLaGraine(graine(42), 6)) throw new Error('rapide');
      return resultatDeTest(valeurs, g);
    });
    const lot = await lancerUnLot(simulateur, DEMANDE, { simultanees: 4 });
    expect(!lot.ok && lot.error).toMatchObject({ index: 5, message: 'lent' });
  });

  it("n'entame plus de nouvelle itération après un échec", async () => {
    const simulateur = new SimulateurScripte((valeurs, g) => {
      if (grainesEnEchec.has(g)) throw new Error('pv négatifs');
      return resultatDeTest(valeurs, g);
    });
    await lancerUnLot(simulateur, DEMANDE, { simultanees: 1 });
    expect(simulateur.appels).toHaveLength(6);
  });
});
